/**
 * p5t2-helpers — shared fixtures and fakes for the P5-T2 (persona overlay)
 * tests (TaskDoc §11.5 must-test groups 1–4).
 *
 * Contents:
 *
 * - {@link FakePresetSeam} / {@link presetSeamWith} — the scripted
 *   `AgentPresetSeam`: per-ROOT-session-id substrate facts + a fallback
 *   (the member-inherits-root rule is structural: the seam only ever
 *   answers root-keyed queries; the query log is the evidence);
 * - {@link FakePersonaSource} — the scriptable Team Blueprint persona
 *   source (leader/member texts + query logs);
 * - {@link FakePromptSurface} — the recording scoped-prompt surface (the
 *   installed scoped identities are the evidence);
 * - {@link countingEvaluator} — a counting wrapper around the REAL P3-T5
 *   `evaluateCompatibility` engine (records every input and result; the
 *   engine itself stays the production dependency);
 * - {@link recordingGuard} — an admission guard that records its `decide`
 *   contexts (admitting or rejecting);
 * - {@link createP5T2Rig} — the full P5-T2 rig: a fresh
 *   `FakeAgentSetupSurface` + a real `TeamAgentBinder` whose `persona`
 *   slot is the P5-T2 `createPersonaOverlaySlot` over the fakes (model /
 *   capability slots optional), over one durable TeamDomain world.
 *
 * Reuses the P5-T1 helpers (world seeding, the restart model, the fake
 * surface, the read-handle projection) — see `./p5t1-helpers.js`.
 *
 * Test-only module (no `.test.ts` suffix): never imported by production
 * code.
 * @module @dsh-agent-team/runtime/test/p5t2-helpers
 */

import {
  evaluateCompatibility,
} from '../../domain/compatibility/src/index.js'
import type {
  CompatibilityEvaluationInput,
  CompatibilityResult,
} from '../../domain/compatibility/src/index.js'
import { TeamAgentBinder } from '../agent-setup/binder/index.js'
import type {
  AdmissionGuard,
  OverlaySlot,
  OverlaySlotName,
  TeamAgentStepContext,
} from '../agent-setup/binder/index.js'
import { createPersonaOverlaySlot } from '../agent-setup/persona/index.js'
import type { ScopedPersonaIdentity } from '../agent-setup/persona/index.js'
import { PRESET_PERSONA_KINDS } from '../agent-setup/preset/index.js'
import type {
  AgentPresetSeam,
  AgentPresetSubstrateFacts,
  PresetPersonaKind,
} from '../agent-setup/preset/index.js'
import type { TeamDomain } from '../../storage/repositories/index.js'
import type { P5T1World } from './p5t1-helpers.js'
import { FakeAgentSetupSurface, readHandleFor } from './p5t1-helpers.js'

// --- FakePresetSeam -----------------------------------------------------------

/** The scripted-substrate options of the {@link FakePresetSeam}. */
export interface FakePresetSeamOptions {
  /**
   * Substrate facts keyed by ROOT session id (a member's query answers
   * its ROOT's entry — the inheritance rule is structural).
   */
  readonly substrates?: Record<string, AgentPresetSubstrateFacts>
  /**
   * The substrate for any unscripted root (default: the standard preset
   * `'preset-p5t2'`).
   */
  readonly fallback?: AgentPresetSubstrateFacts
}

/**
 * The scripted `AgentPresetSeam` (mock-first; the real DSH public binding
 * lands in T5/T6). Every query is logged in `queriedRootSessionIds` —
 * the evidence that a member's substrate resolves through the ROOT
 * (Architecture §13.1: no per-member selector exists).
 */
export class FakePresetSeam implements AgentPresetSeam {
  /** Every `getSubstrate` root session id, in order (the query log). */
  readonly queriedRootSessionIds: string[] = []
  private readonly substrates: Record<string, AgentPresetSubstrateFacts>
  private readonly fallback: AgentPresetSubstrateFacts

  constructor(options: FakePresetSeamOptions = {}) {
    this.substrates = options.substrates ?? {}
    this.fallback =
      options.fallback ??
      deepFreezeLocal({ presetId: 'preset-p5t2', personaKind: PRESET_PERSONA_KINDS.standard })
  }

  getSubstrate(rootSessionId: string): AgentPresetSubstrateFacts {
    this.queriedRootSessionIds.push(rootSessionId)
    const exact = this.substrates[rootSessionId]
    return exact !== undefined ? exact : this.fallback
  }
}

/**
 * A {@link FakePresetSeam} whose fallback substrate carries the given
 * effective-persona kind (the three P5-T2 states of a preset).
 */
export function presetSeamWith(
  personaKind: PresetPersonaKind,
  presetId = 'preset-p5t2',
): FakePresetSeam {
  return new FakePresetSeam({
    fallback: deepFreezeLocal({ presetId, personaKind }),
  })
}

/** Minimal deep-freeze over the small substrate facts (no contracts import needed). */
function deepFreezeLocal<T extends Record<string, unknown>>(value: T): T {
  Object.freeze(value)
  return value
}

// --- FakePersonaSource --------------------------------------------------------

/** The scriptable Team Blueprint persona source (Architecture §13.3). */
export class FakePersonaSource {
  /** Every `getLeaderPersona` root session id, in order. */
  readonly leaderQueries: string[] = []
  /** Every `getMemberPersona` (root, template) query, in order. */
  readonly memberQueries: { readonly rootSessionId: string; readonly templateId: string }[] = []
  /** The leader-template persona text (the Blueprint owns the text). */
  leaderPersona: string
  /** The member-template persona text (the Blueprint owns the text). */
  memberPersona: string

  constructor(options: { leaderPersona?: string; memberPersona?: string } = {}) {
    this.leaderPersona = options.leaderPersona ?? 'P5T2 leader persona prose'
    this.memberPersona = options.memberPersona ?? 'P5T2 member persona prose'
  }

  getLeaderPersona(rootSessionId: string): string {
    this.leaderQueries.push(rootSessionId)
    return this.leaderPersona
  }

  getMemberPersona(rootSessionId: string, templateId: string): string {
    this.memberQueries.push({ rootSessionId, templateId })
    return this.memberPersona
  }
}

// --- FakePromptSurface ---------------------------------------------------------

/** One installed scoped identity (the effect evidence). */
export interface InstalledScopedPersona {
  readonly sessionId: string
  readonly identity: ScopedPersonaIdentity
}

/**
 * The recording scoped-prompt surface (mock-first; the real DSH public
 * scoped-prompt binding lands in T5/T6). The installed list is the
 * evidence of the runtime-context installation.
 */
export class FakePromptSurface {
  /** Every `installScopedPersona` call, in order. */
  readonly installed: InstalledScopedPersona[] = []

  installScopedPersona(sessionId: string, identity: ScopedPersonaIdentity): void {
    this.installed.push({ sessionId, identity })
  }
}

// --- counting evaluator --------------------------------------------------------

/**
 * A counting wrapper around one compatibility evaluator (default: the REAL
 * P3-T5 pure engine). Records every input and result in order; `count` is
 * the number of evaluations (the "the engine probed exactly once" evidence).
 */
export interface CountingCompatibilityEvaluator {
  /** Every evaluation input, in order. */
  readonly inputs: readonly CompatibilityEvaluationInput[]
  /** Every evaluation result, in order. */
  readonly results: readonly CompatibilityResult[]
  /** The number of evaluations so far. */
  readonly count: number
  /** The wrapped evaluator (pass as `evaluateCompatibility`). */
  readonly evaluate: (input: CompatibilityEvaluationInput) => CompatibilityResult
}

export function countingEvaluator(
  evaluate: (input: CompatibilityEvaluationInput) => CompatibilityResult = evaluateCompatibility,
): CountingCompatibilityEvaluator {
  const inputs: CompatibilityEvaluationInput[] = []
  const results: CompatibilityResult[] = []
  const counting = (input: CompatibilityEvaluationInput): CompatibilityResult => {
    inputs.push(input)
    const result = evaluate(input)
    results.push(result)
    return result
  }
  return {
    inputs,
    results,
    get count() {
      return inputs.length
    },
    evaluate: counting,
  }
}

// --- recording guard -----------------------------------------------------------

/** An admission guard that records its `decide` contexts (the fail-before-admission evidence). */
export interface RecordingAdmissionGuard extends AdmissionGuard {
  /** Every decided context, in order. */
  readonly contexts: readonly TeamAgentStepContext[]
}

export function recordingGuard(admit = true): RecordingAdmissionGuard {
  const contexts: TeamAgentStepContext[] = []
  return {
    contexts,
    decide(context: TeamAgentStepContext) {
      contexts.push(context)
      return admit
        ? { status: 'admitted' }
        : { status: 'rejected', code: 'REJECT_RECORDING_GUARD' }
    },
  }
}

// --- the P5-T2 rig ---------------------------------------------------------------

/** The optional rig overrides. */
export interface P5T2RigOptions {
  /** Reuse an already-seeded seam (default: a fresh standard fallback). */
  readonly presetSeam?: FakePresetSeam
  /** Reuse an already-seeded persona source (default: a fresh one). */
  readonly personaSource?: FakePersonaSource
  /** Reuse an already-seeded prompt surface (default: a fresh one). */
  readonly promptSurface?: FakePromptSurface
  /** Reuse an evaluator (default: a fresh counting wrapper over the real engine). */
  readonly evaluator?: CountingCompatibilityEvaluator
  /** The durable domain the binder reads (default: the world's own domain). */
  readonly domain?: TeamDomain
  /** The model overlay slot (default: the T1 identity no-op). */
  readonly modelSlot?: OverlaySlot
  /** The capability overlay slot (default: the T1 identity no-op). */
  readonly capabilitySlot?: OverlaySlot
  /** The admission guard (default: the T1 admitting default). */
  readonly admissionGuard?: AdmissionGuard
}

/** The full P5-T2 test rig over one durable world. */
export interface P5T2Rig {
  /** The durable world the rig reads. */
  readonly world: P5T1World
  /** The durable domain actually used for the read handle. */
  readonly domain: TeamDomain
  /** The fresh mock agent-setup surface (all effects recorded here). */
  readonly surface: FakeAgentSetupSurface
  /** The real binder with the P5-T2 persona slot installed. */
  readonly binder: TeamAgentBinder
  /** The injected preset seam (query evidence). */
  readonly presetSeam: FakePresetSeam
  /** The injected blueprint persona source (query evidence). */
  readonly personaSource: FakePersonaSource
  /** The injected scoped-prompt surface (installation evidence). */
  readonly promptSurface: FakePromptSurface
  /** The counting evaluator (probe-count evidence). */
  readonly evaluator: CountingCompatibilityEvaluator
}

/**
 * Build the P5-T2 rig: a fresh `FakeAgentSetupSurface` + a real
 * `TeamAgentBinder` whose `persona` slot is the P5-T2
 * `createPersonaOverlaySlot` (the fakes + the counting evaluator), with
 * optional model/capability slot and admission-guard overrides, over one
 * durable TeamDomain world (or a re-opened one — the cold path).
 */
export function createP5T2Rig(world: P5T1World, options: P5T2RigOptions = {}): P5T2Rig {
  const domain = options.domain ?? world.domain
  const presetSeam = options.presetSeam ?? presetSeamWith(PRESET_PERSONA_KINDS.standard)
  const personaSource = options.personaSource ?? new FakePersonaSource()
  const promptSurface = options.promptSurface ?? new FakePromptSurface()
  const evaluator = options.evaluator ?? countingEvaluator()
  const surface = new FakeAgentSetupSurface()
  const slots: Partial<Record<OverlaySlotName, OverlaySlot>> = {
    persona: createPersonaOverlaySlot({
      presetSeam,
      personaSource,
      promptSurface,
      evaluateCompatibility: evaluator.evaluate,
    }),
  }
  if (options.modelSlot !== undefined) slots.model = options.modelSlot
  if (options.capabilitySlot !== undefined) slots.capability = options.capabilitySlot
  const binder = new TeamAgentBinder({
    surface,
    teamDomain: readHandleFor(domain),
    slots,
    admissionGuard: options.admissionGuard,
  })
  return { world, domain, surface, binder, presetSeam, personaSource, promptSurface, evaluator }
}
