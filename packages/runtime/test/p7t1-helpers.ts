/**
 * p7t1-helpers — shared world factory and fakes for the P7-T1
 * (compatibility drift + ACK lifecycle) tests (TaskDoc §11.7 P7-T1;
 * DevPlan §20.1).
 *
 * Contents:
 *
 * - {@link MutableFacts} — the mutable environment-facts holder: the
 *   tests flip availability / bump probe generations on
 *   `facts.current`, and every later prober read observes the drifted
 *   environment (the environment itself is the test fixture);
 * - {@link ProbeObservation} — one `onProbe` observation (outcome + drift
 *   pair) captured in order (the provenance channel assertions);
 * - {@link P7T1Handle} — a P6-T1 world + the P7-T1 compatibility prober
 *   wired to the SAME mutable facts, a controlled clock, and the
 *   observation list;
 * - {@link createP7T1World} / {@link restartP7T1World} /
 *   {@link destroyP7T1World} — build / process-restart-model / destroy
 *   (the restart keeps the durable TeamDomain, the mutable facts, the
 *   clock, and the observation list — the new process re-creates a FRESH
 *   prober over the NEW domain, exactly like a real restart);
 * - fixture fact builders for the P6-T1 fixture blueprint (one OPTIONAL
 *   `tool/web` requirement, one REQUIRED `skill/base` requirement):
 *   {@link factsWebDown} (ack-able WARNING), {@link factsSkillBaseDown}
 *   (FATAL), {@link factsWebGenerationBump} (availability unchanged,
 *   generation bumped), {@link factsIrrelevantChurn} (unrelated
 *   capability churn — must not move the fingerprint);
 * - {@link assertCompatibilityCode} — the assert-and-return helper for
 *   {@link CompatibilityError} codes (the shim has no `rejects` matcher).
 *
 * @module @dsh-agent-team/runtime/test/p7t1-helpers
 */

import type { EnvironmentFact } from '../../domain/compatibility/src/index.js'
import {
  createCompatibilityProber,
  isCompatibilityError,
} from '../compatibility/index.js'
import type {
  CompatibilityProber,
  DriftObservation,
  ProbeOutcome,
} from '../compatibility/index.js'
import {
  P6T1_FIXTURE,
  createP6T1World,
  destroyP6T1World,
  makeEnvironmentFacts,
  restartP6T1World,
} from './p6t1-helpers.js'
import type { P6T1World } from './p6t1-helpers.js'

/** The controlled clock state (one shared counter, ISO-8601 UTC output). */
export interface P7T1Clock {
  /** The clock value in epoch milliseconds (mutated by `advance`). */
  ms: number
}

/**
 * The mutable environment-facts holder. Mutate `current` between prober
 * calls to model the environment drifting (a capability disappears, a
 * probe generation bumps, an unrelated capability churns).
 */
export interface MutableFacts {
  /** The facts the next prober/environment read observes. */
  current: EnvironmentFact[]
}

/** One captured `onProbe` observation (the outcome + the drift class). */
export interface ProbeObservation {
  readonly outcome: ProbeOutcome
  readonly drift: DriftObservation
}

/** One P7-T1 test world (the P6-T1 world + the compatibility prober). */
export interface P7T1Handle {
  /** The underlying P6-T1 world (REAL TeamDomain over a scratch dir). */
  readonly world: P6T1World
  /** The compatibility prober over the world's repositories. */
  readonly prober: CompatibilityProber
  /** The shared mutable environment-facts holder. */
  readonly facts: MutableFacts
  /** Every `onProbe` observation, in probe order. */
  readonly observations: ProbeObservation[]
  /** The shared controlled clock. */
  readonly clock: P7T1Clock
  /** Advance the controlled clock by `ms` milliseconds. */
  advance: (ms: number) => void
}

const P7T1_CLOCK_START_MS = Date.parse('2026-08-30T09:00:00.000Z')

function makeNow(clock: P7T1Clock): () => string {
  return () => new Date(clock.ms).toISOString()
}

function makeProber(
  world: P6T1World,
  facts: MutableFacts,
  observations: ProbeObservation[],
  clock: P7T1Clock,
): CompatibilityProber {
  return createCompatibilityProber({
    repositories: world.domain.repositories,
    rootSessionId: String(P6T1_FIXTURE.rootSessionId),
    blueprint: world.blueprint,
    environmentFacts: async () => facts.current,
    now: makeNow(clock),
    onProbe: (outcome, drift) => {
      observations.push({ outcome, drift })
    },
  })
}

/**
 * Build one P7-T1 world: the P6-T1 durable world (REAL repositories, REAL
 * fixture blueprint) with the P7-T1 compatibility prober wired to the
 * mutable facts + controlled clock + observation list.
 *
 * @param basename - the scratch dir basename (unique per test).
 */
export async function createP7T1World(basename: string): Promise<P7T1Handle> {
  const facts: MutableFacts = { current: makeEnvironmentFacts() }
  const observations: ProbeObservation[] = []
  const clock: P7T1Clock = { ms: P7T1_CLOCK_START_MS }
  const world = await createP6T1World(basename, {
    environmentFacts: async () => facts.current,
  })
  const prober = makeProber(world, facts, observations, clock)
  return {
    world,
    prober,
    facts,
    observations,
    clock,
    advance: (ms: number) => {
      clock.ms += ms
    },
  }
}

/**
 * The process-restart model over a P7-T1 world: the durable TeamDomain
 * survives (new seam over the SAME scratch dir), the mutable facts /
 * clock / observation list survive (same environment, same time line),
 * and a FRESH prober is created over the NEW domain — the in-memory
 * in-flight ledger of the old prober is gone (process restart).
 *
 * @param handle - the handle to restart.
 */
export async function restartP7T1World(handle: P7T1Handle): Promise<P7T1Handle> {
  const world = await restartP6T1World(handle.world)
  const prober = makeProber(world, handle.facts, handle.observations, handle.clock)
  return {
    world,
    prober,
    facts: handle.facts,
    observations: handle.observations,
    clock: handle.clock,
    advance: handle.advance,
  }
}

/** Close the world's domain and destroy the scratch dir. */
export async function destroyP7T1World(handle: P7T1Handle): Promise<void> {
  await destroyP6T1World(handle.world)
}

// --- fixture fact builders (the P6-T1 fixture blueprint) --------------------
//
// The fixture blueprint declares exactly two probeable requirements:
//   req-tool-web   (tool, `web`,   optional) — unmet => WARNING (ack-able)
//   req-skill-base (skill, `base`, required) — unmet => FATAL (no ack)

/** The `web` tool unavailable at `generation` (the ack-able WARNING). */
export function factsWebDown(generation = 2): EnvironmentFact[] {
  return makeEnvironmentFacts([
    { domain: 'tool', subject: 'web', available: false, generation },
  ])
}

/** The `base` skill unavailable (the required requirement => FATAL). */
export function factsSkillBaseDown(): EnvironmentFact[] {
  return makeEnvironmentFacts([
    { domain: 'skill', subject: 'base', available: false, generation: 2 },
  ])
}

/** The `web` tool generation bumped with availability unchanged. */
export function factsWebGenerationBump(generation = 2): EnvironmentFact[] {
  return makeEnvironmentFacts([
    { domain: 'tool', subject: 'web', available: true, generation },
  ])
}

/** An UNRELATED capability (not named by any requirement) churns. */
export function factsIrrelevantChurn(): EnvironmentFact[] {
  return makeEnvironmentFacts([
    { domain: 'mcpServer', subject: 'ghost-mcp', available: false, generation: 9 },
  ])
}

// --- assertion helpers --------------------------------------------------------

/**
 * Assert that `error` is a CompatibilityError with the exact code; return
 * the code + plain-JSON details for further assertions.
 *
 * @param error - the thrown error (e.g. from `captureError`).
 * @param code - the expected {@link COMPATIBILITY_ERROR_CODES} value.
 */
export function assertCompatibilityCode(
  error: unknown,
  code: string,
): { code: string; details?: Record<string, unknown> } {
  if (!isCompatibilityError(error)) {
    throw new Error(
      `assertCompatibilityCode: expected a CompatibilityError but got: ${String(error)}`,
    )
  }
  if (error.code !== code) {
    throw new Error(
      `assertCompatibilityCode: expected CompatibilityError code '${code}' but got '${error.code}'`,
    )
  }
  const details = error.details
  return {
    code: error.code,
    ...(details !== undefined ? { details } : {}),
  }
}
