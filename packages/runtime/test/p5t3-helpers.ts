/**
 * p5t3-helpers — shared fixtures and fakes for the P5-T3 (Team model
 * selection overlay) tests (TaskDoc §11.5 must-test groups: the DevPlan
 * §18.4 frozen sequence + restart).
 *
 * Contents:
 *
 * - {@link P5T3_MODEL_A} / {@link P5T3_MODEL_B} — the frozen DevPlan §18.4
 *   sequence's selections ("model A" / "model B"); B carries a reasoning
 *   effort to prove lossless carry-through;
 * - {@link FakeModelSelectionSource} — the mock-first test fake of the
 *   injected public ModelSelection seam (records every `current` read and
 *   every `select` — the call-recording evidence);
 * - {@link createModelOverlay} — the P5-T3 wiring (adapter + slot over one
 *   source);
 * - {@link binderWithModelSlot} — a fresh TeamAgentBinder with the P5-T3
 *   model slot replacing the T1 identity default (persona / capability
 *   keep their identity defaults — they are T2/T4-owned slots).
 *
 * The durable world, the process-restart model, and the fake surface are
 * REUSED from ./p5t1-helpers.js (the P5-T1 binder fixtures — the binder is
 * the frozen integration harness for the overlay slot; the P5-T3 tests
 * verify the overlay BEHAVIOR through the binder's fresh and cold paths,
 * not in isolation).
 *
 * Test-only module (no `.test.ts` suffix): never imported by production
 * code.
 * @module @dsh-agent-team/runtime/test/p5t3-helpers
 */

import { TeamAgentBinder } from '../agent-setup/binder/index.js'
import type { TeamAgentSetupSurface, TeamDomainReadHandle } from '../agent-setup/binder/index.js'
import {
  TeamModelOverlaySlot,
  TeamModelSelectionAdapter,
} from '../agent-setup/model/index.js'
import type { ModelSelection, ModelSelectionSource } from '../agent-setup/model/index.js'

/** The frozen DevPlan §18.4 sequence's selection A ("model A"). */
export const P5T3_MODEL_A: ModelSelection = {
  provider: 'provider-a',
  model: 'model-a',
}

/** The frozen DevPlan §18.4 sequence's selection B ("model B"). */
export const P5T3_MODEL_B: ModelSelection = {
  provider: 'provider-b',
  model: 'model-b',
  reasoningEffort: 'high',
}

/**
 * The mock-first test fake of the injected public ModelSelection seam:
 * holds one current selection value and records every `current` read and
 * every `select` argument (copied — the public contract is value-based).
 */
export class FakeModelSelectionSource implements ModelSelectionSource {
  /** The number of `current` reads (resolution happens at request time only). */
  currentReads = 0
  /** Every `select` argument, in order (copied). */
  readonly selects: ModelSelection[] = []
  private selection: ModelSelection | undefined

  /**
   * @param initial - the initial current selection (absent = none set).
   */
  constructor(initial?: ModelSelection) {
    this.selection = initial === undefined ? undefined : { ...initial }
  }

  current(): ModelSelection | undefined {
    this.currentReads += 1
    return this.selection
  }

  select(next: ModelSelection): void {
    this.selects.push({ ...next })
    this.selection = { ...next }
  }
}

/** One wired P5-T3 model overlay (the resolution core + slot over one source). */
export interface P5T3ModelOverlay {
  /** The session-scoped resolution core. */
  readonly adapter: TeamModelSelectionAdapter
  /** The binder `model` overlay slot (the T1 slot contract implementation). */
  readonly slot: TeamModelOverlaySlot
  /** The selection source the overlay resolves. */
  readonly source: ModelSelectionSource
}

/**
 * Wire the P5-T3 model overlay over one public ModelSelection seam.
 * @param source - the public ModelSelection seam (mock-first; the test
 *   fake in every P5-T3 world).
 */
export function createModelOverlay(source: ModelSelectionSource): P5T3ModelOverlay {
  const adapter = new TeamModelSelectionAdapter(source)
  return { adapter, slot: new TeamModelOverlaySlot(adapter), source }
}

/**
 * A model-selection source that never resolves (only used to construct
 * {@link FaultModelAdapter} — its `current` is never called in the fault
 * world because no request succeeds).
 */
export const NOOP_MODEL_SOURCE: ModelSelectionSource = {
  current(): ModelSelection | undefined {
    return undefined
  },
  select(): void {
    /* the fault world never selects */
  },
}

/**
 * The fault-injection fake for the binder's fail-closed posture: throws
 * `fault` on its FIRST `install` call (a model seam fault mid-fresh-path),
 * then behaves exactly like the real adapter (the binder retry converges —
 * slot idempotency).
 */
export class FaultModelAdapter extends TeamModelSelectionAdapter {
  private remainingFaults = 1
  private readonly fault: Error

  /**
   * @param fault - the error thrown by the first `install` call.
   */
  constructor(fault: Error) {
    super(NOOP_MODEL_SOURCE)
    this.fault = fault
  }

  override install(sessionId: string): void {
    if (this.remainingFaults > 0) {
      this.remainingFaults -= 1
      throw this.fault
    }
    super.install(sessionId)
  }
}

/**
 * Build a fresh TeamAgentBinder with the P5-T3 model slot replacing the T1
 * identity default (persona / capability keep their identity defaults).
 * @param surface - the injected public Agent setup surface (mock-first).
 * @param teamDomain - the READ-ONLY TeamDomain handle.
 * @param slot - the model overlay slot to install in the binder.
 */
export function binderWithModelSlot(
  surface: TeamAgentSetupSurface,
  teamDomain: TeamDomainReadHandle,
  slot: TeamModelOverlaySlot,
): TeamAgentBinder {
  return new TeamAgentBinder({ surface, teamDomain, slots: { model: slot } })
}
