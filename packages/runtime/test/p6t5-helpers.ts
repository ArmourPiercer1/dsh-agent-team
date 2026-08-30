/**
 * P6-T5 — activity-ledger test helpers: one P6-T2 durable world with the
 * activity ledger over it in PRODUCTION WIRING (injected TeamDomain +
 * TeamRuntime facade — no test-only write path exists), a deterministic
 * display clock, input builders with overridable defaults, and the closed
 * assertion helpers for the two DISJOINT error families (ActivityError vs
 * TeamRuntimeError).
 *
 * Runner constraint (plain-node vitest-equivalent): async setup happens at
 * MODULE SCOPE (top-level await blocks) and the `it` assertions are
 * synchronous over the precomputed results — no async `it`.
 */

import {
  createActivityLedger,
  isActivityError,
  isActivityFactType,
  projectTeamFromRows,
} from '../activity/index.js'
import type {
  ActivityFactRow,
  ActivityInstanceRef,
  ActivityIntervalCloseInput,
  ActivityIntervalOpenInput,
  ActivityLedger,
  ActivityProgressInput,
  ActivityTeamProjection,
} from '../activity/index.js'
import { isTeamRuntimeError } from '../admission/index.js'
import type { TeamRuntime } from '../admission/index.js'
import type { MemberInstanceRecordDto } from '../../contracts/src/index.js'
import type { LedgerEntry } from '../../storage/schema/index.js'
import {
  createP6T2Runtime,
  createP6T2World,
  humanCaller,
  leaderCaller,
  memberCaller,
  memberList,
  P6T2_ROOT,
  P6T2_SEEDS,
} from './p6t2-helpers.js'
import type { P6T2SeedName } from './p6t2-helpers.js'
import { destroyP6T1World, restartP6T1World } from './p6t1-helpers.js'
import type { P6T1World, P6T1WorldOptions } from './p6t1-helpers.js'

export { destroyP6T1World, humanCaller, leaderCaller, memberCaller, P6T2_SEEDS }
export type { P6T1World }

/** The P6-T5 team root (the P6-T2 fixture root: one world, one team). */
export const P6T5_ROOT = P6T2_ROOT

/** One deterministic display clock (ISO-8601 labels, +1 s per read). */
export interface P6T5Clock {
  readonly now: () => string
}

/** A fresh deterministic display clock starting at 2026-08-31T12:00:00Z. */
export function createP6T5Clock(): P6T5Clock {
  let ticks = 0
  return {
    now: (): string => {
      ticks += 1
      return new Date(Date.UTC(2026, 7, 31, 12, 0, 0) + ticks * 1000).toISOString()
    },
  }
}

/** One P6-T5 suite: the durable world + the production-wired ledger. */
export interface P6T5Suite {
  readonly world: P6T1World
  readonly runtime: TeamRuntime
  readonly ledger: ActivityLedger
}

/**
 * Build one P6-T5 suite over a P6-T2 world (leader + worker seeded by
 * default; the P6-T2 fixture blueprint envelopes allow `report-progress`
 * for the leader team envelope and the worker/scout template envelopes).
 *
 * @param basename - the scratch dir basename (unique per test).
 * @param seedNames - the seed members to install.
 * @param options - the P6-T1 world options (extra seeds, ...).
 * @returns the suite (destroy with `destroyP6T1World(suite.world)`).
 */
export async function createP6T5Suite(
  basename: string,
  seedNames: readonly P6T2SeedName[] = ['leader', 'worker'],
  options: P6T1WorldOptions = {},
): Promise<P6T5Suite> {
  const world = await createP6T2World(basename, seedNames, options)
  const clock = createP6T5Clock()
  const runtime = createP6T2Runtime(world)
  const ledger = createActivityLedger({ teamDomain: world.domain, runtime, now: clock.now })
  return { world, runtime, ledger }
}

/**
 * RESTART the suite at the unit level: close the domain and re-open the
 * repositories on the SAME durable store (the P6-T1 restart seam), then
 * re-instantiate the runtime + ledger over the reopened world. Recovery is
 * from the durable state ONLY (the in-memory lock map is fresh and empty).
 */
export async function restartP6T5Suite(suite: P6T5Suite): Promise<P6T5Suite> {
  const world = await restartP6T1World(suite.world)
  const clock = createP6T5Clock()
  const runtime = createP6T2Runtime(world)
  const ledger = createActivityLedger({ teamDomain: world.domain, runtime, now: clock.now })
  return { world, runtime, ledger }
}

// --- input builders (defaults overridable per test) -----------------------------

const DEFAULT_WORKER = P6T2_SEEDS.worker.instanceId

/** One progress input (defaults: the worker self-reports subject 'build'). */
export function p6t5Progress(
  overrides: Partial<ActivityProgressInput> = {},
): ActivityProgressInput {
  return {
    rootSessionId: P6T5_ROOT,
    caller: memberCaller(DEFAULT_WORKER),
    instanceId: DEFAULT_WORKER,
    subject: 'build',
    sequence: 1,
    progress: 'in-progress',
    requestToken: 'tok-p6t5-default',
    ...overrides,
  }
}

/** One interval-open input (defaults: the worker, subject 'build', corr-1). */
export function p6t5Open(
  overrides: Partial<ActivityIntervalOpenInput> = {},
): ActivityIntervalOpenInput {
  return {
    rootSessionId: P6T5_ROOT,
    caller: memberCaller(DEFAULT_WORKER),
    instanceId: DEFAULT_WORKER,
    subject: 'build',
    sequence: 1,
    progress: 'in-progress',
    requestToken: 'tok-p6t5-default',
    correlation: 'corr-1',
    ...overrides,
  }
}

/** One interval-close input (defaults: the worker, subject 'build', corr-1). */
export function p6t5Close(
  overrides: Partial<ActivityIntervalCloseInput> = {},
): ActivityIntervalCloseInput {
  return {
    rootSessionId: P6T5_ROOT,
    caller: memberCaller(DEFAULT_WORKER),
    instanceId: DEFAULT_WORKER,
    subject: 'build',
    sequence: 1,
    progress: 'completed',
    requestToken: 'tok-p6t5-default',
    correlation: 'corr-1',
    ...overrides,
  }
}

// --- error-family assertion helpers ----------------------------------------------

function describeError(error: unknown): string {
  return error instanceof Error ? `${error.name}: ${error.message}` : String(error)
}

/**
 * Assert `error` is an ActivityError with exactly `code` (test failure
 * otherwise); returns the typed code + a copy of the details.
 */
export function assertActivityCode(
  error: unknown,
  code: string,
): { readonly code: string; readonly details?: Record<string, unknown> } {
  if (!isActivityError(error)) {
    throw new Error(
      `assertActivityCode: expected ActivityError '${code}', got ${describeError(error)}`,
    )
  }
  if (error.code !== code) {
    throw new Error(
      `assertActivityCode: expected '${code}', got '${error.code}': ${error.message}`,
    )
  }
  const result: { code: string; details?: Record<string, unknown> } = { code: error.code }
  if (error.details !== undefined) {
    result.details = { ...error.details }
  }
  return result
}

/**
 * Assert `error` is a TeamRuntimeError with exactly `code` (the facade
 * family — the disjoint half of the two-family boundary); returns the
 * typed code + a copy of the details.
 */
export function assertFacadeCode(
  error: unknown,
  code: string,
): { readonly code: string; readonly details?: Record<string, unknown> } {
  if (!isTeamRuntimeError(error)) {
    throw new Error(
      `assertFacadeCode: expected TeamRuntimeError '${code}', got ${describeError(error)}`,
    )
  }
  if (error.code !== code) {
    throw new Error(
      `assertFacadeCode: expected '${code}', got '${error.code}': ${error.message}`,
    )
  }
  const result: { code: string; details?: Record<string, unknown> } = { code: error.code }
  if (error.details !== undefined) {
    result.details = { ...error.details }
  }
  return result
}

/** Expect an async call to REJECT with the typed ActivityError `code`. */
export function expectActivityRejection(
  promise: Promise<unknown>,
  code: string,
): Promise<{ readonly code: string; readonly details?: Record<string, unknown> }> {
  return promise.then(
    () => {
      throw new Error(`expectActivityRejection: expected '${code}' but the call succeeded`)
    },
    (error: unknown) => assertActivityCode(error, code),
  )
}

/** Expect an async call to REJECT with the TeamRuntimeError `code`. */
export function expectFacadeRejection(
  promise: Promise<unknown>,
  code: string,
): Promise<{ readonly code: string; readonly details?: Record<string, unknown> }> {
  return promise.then(
    () => {
      throw new Error(`expectFacadeRejection: expected '${code}' but the call succeeded`)
    },
    (error: unknown) => assertFacadeCode(error, code),
  )
}

// --- durable probes (fresh reads — the durable state is authoritative) ------------

/** The durable activity rows (synchronous read, deterministic order). */
export function activityRows(
  ledger: ActivityLedger,
  query: { readonly instanceId?: string; readonly subject?: string } = {},
): readonly ActivityFactRow[] {
  return ledger.listActivityFacts({ rootSessionId: P6T5_ROOT, ...query })
}

/** The next admissible per-subject sequence (the durable head + 1). */
export function nextSequence(
  ledger: ActivityLedger,
  instanceId: string,
  subject: string,
): number {
  const rows = ledger.listActivityFacts({ rootSessionId: P6T5_ROOT, instanceId, subject })
  return rows.reduce((max, row) => Math.max(max, row.sequence), 0) + 1
}

/** The team's member metadata (lane labels for the projection). */
export function instanceRefs(world: P6T1World): ActivityInstanceRef[] {
  return memberList(world).map((member: MemberInstanceRecordDto) => ({
    instanceId: String(member.instanceId),
    label: member.label,
    templateId: String(member.templateId),
  }))
}

/** The full team projection over the durable rows (production read path). */
export function teamProjection(
  ledger: ActivityLedger,
  world: P6T1World,
): ActivityTeamProjection {
  return projectTeamFromRows(activityRows(ledger), instanceRefs(world), P6T5_ROOT)
}

/** The total durable fact count of the team ledger (audit trail size). */
export function rawLedgerCount(world: P6T1World): number {
  return world.domain.repositories.ledger.entryCount()
}

/** The durable facade audit facts (`team-coordination-recorded`). */
export function rawAuditFacts(world: P6T1World): LedgerEntry[] {
  return world.domain
    .repositories.ledger.list()
    .filter((entry) => entry.factType === 'team-coordination-recorded')
}

/** The durable structured activity facts (the P6-T5 row family). */
export function rawActivityFacts(world: P6T1World): LedgerEntry[] {
  return world.domain
    .repositories.ledger.list()
    .filter((entry) => isActivityFactType(entry.factType))
}
