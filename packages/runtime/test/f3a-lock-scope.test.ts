/**
 * F3-A (repair-r1) — the work chain lock scope (INV-9.1) at the
 * PRODUCTION-WIRED seam: the router's `performAction` with the shared
 * per-team chain map installed on BOTH the runtime and the activity
 * ledger (the production root shape: one `TeamOperationCoordinator`
 * chain map shared across the facade, the work chain, and the guarded
 * ledger commit).
 *
 * The fix under test is the THREE-PHASE lock split of the member work
 * chain (`work-execution.ts`): Phase A (admission — fresh read, dedup
 * scan, CAS + admission fact, activity-interval open) runs in ONE
 * acquisition of the shared chain (the new-work path: compatibility
 * gate + Phase A together); the chain is then RELEASED; Phase B
 * (delivery — the member's model turn) runs WITHOUT the shared chain;
 * Phase C (settlement / fail-closed) re-acquires the SAME chain WITHOUT
 * the request signal (N6). Before the fix, the chain was held across
 * the whole member turn, so the member's own team tools (e.g.
 * `team_report_progress`) queued behind the leader's own pending tail
 * on the same non-re-entrant chain: the F3 deadlock.
 *
 * Coverage (contract rows F3-T1…F3-T6):
 * - T1 (F3 re-entry): a member's `team_report_progress` DURING its own
 *   work delivery resolves against the shared chain — no deadlock — and
 *   the progress row is durable before the follow-up settles;
 * - T2 (multiple progress): two consecutive follow-ups each report two
 *   progress rows (the deterministic head+1 guard holds across turns);
 * - T3 (concurrent mutation): an unrelated same-team mutation
 *   (archive-member) runs AND commits durably while a work delivery is
 *   in flight (the chain is released during delivery);
 * - T4 (H3 overlap): a second work unit for the same instance admitted
 *   during the first's delivery; each owns its admission fact +
 *   interval; the first delivery then FAILS — the fail-closed settle
 *   and the second unit's settle converge via the fresh-read settlement
 *   (exactly one state commit; both settlement facts durable);
 * - T5 (N6 abort): (a) an abort while WAITING for the Phase A chain
 *   acquisition rejects with the caller's abort reason and admits
 *   nothing (no admission fact), leaving the chain usable; (b) an abort
 *   during DELIVERY still gets its fail-closed settlement committed
 *   (Phase C durability after abort) before WORK_DELIVERY_FAILED
 *   propagates (N3 throw-after-settle);
 * - T6 (N3 throw-after-settle): a plain delivery fault yields the
 *   WORK_DELIVERY_FAILED rejection with the durable delivery-failed
 *   settlement already committed (state + fact, no fake RUNNING).
 *
 * House pattern of the runtime package: async world construction and
 * action execution at the TOP LEVEL (one bare block per scenario, each
 * destroyed in its finally); every `it` below asserts the captured
 * constants synchronously (the plain-node shim supports no async `it`).
 *
 * @module @dsh-agent-team/runtime/test/f3a-lock-scope
 */

import { describe, expect, it } from 'vitest'
import type { LedgerEntry } from '../../storage/schema/index.js'
import { createTeamRuntime } from '../action-router/index.js'
import { TEAM_RUNTIME_ERROR_CODES, isTeamRuntimeError } from '../admission/index.js'
import type {
  LifecycleCommitPort,
  RuntimeActionEffect,
  TeamRuntime,
  TeamRuntimeActionOutcome,
  WorkDeliveryPort,
  WorkDeliveryResult,
} from '../admission/index.js'
import { createActivityLedger, createWorkActivityWriter } from '../activity/index.js'
import type { ActivityFactRow, ActivityLedger } from '../activity/index.js'
import { destroyP6T1World } from './p6t1-helpers.js'
import type { P6T1World } from './p6t1-helpers.js'
import {
  P6T2_NOW,
  P6T2_ROOT,
  P6T2_SEEDS,
  createFakeLifecycleCommitPort,
  createP6T2World,
  makeActionRequest,
  p6t2Seed,
} from './p6t2-helpers.js'
import type { P6T2SeedName } from './p6t2-helpers.js'
import { createP6T5Clock, nextSequence, p6t5Progress } from './p6t5-helpers.js'
import { destroyDir, scratchDir } from '../../testkit/fault-injection/file-seam.mjs'

/**
 * Scratch hygiene: a crashed previous run of this suite (e.g. the
 * pre-fix RED check, where deadlocked promise chains are abandoned) can
 * leave a stale `f3a-*` scratch dir behind; the deterministic basenames
 * would then collide on re-run ("team_domain already exists"). Clean
 * ONLY this suite's own basenames before building any world (test
 * scratch under packages/testkit/test/.tmp-fault — gitignored;
 * destroyDir is a no-op when absent).
 */
const F3A_SCRATCH_BASES = [
  'f3a-t1',
  'f3a-t2',
  'f3a-t3',
  'f3a-t4',
  'f3a-t5a',
  'f3a-t5b',
  'f3a-t6',
]
for (const base of F3A_SCRATCH_BASES) {
  destroyDir(scratchDir(base))
}

const WORKER_ID = String(P6T2_SEEDS.worker.instanceId)
const WORKER_CHILD = String(P6T2_SEEDS.worker.childSessionId)
const SCOUT_ID = String(P6T2_SEEDS.scout.instanceId)

/** The delivery args (the port's deliver input). */
type DeliveryArgs = Parameters<WorkDeliveryPort['deliver']>[0]

// --- event-loop pump (deterministic hang detection — no wall clock) ------------

interface PumpFlag {
  done: boolean
  value?: unknown
}

/**
 * Pump the event loop (microtasks + zero-delay macrotask ticks) until
 * `cond` holds or the budget is exhausted. Returns whether `cond` held
 * in time. This is the bounded hang probe: a true deadlock (a promise
 * chain waiting on itself) can make NO progress under any pumping, so a
 * budget exhaustion is a definitive hang verdict without a wall clock.
 */
async function pumpWhile(cond: () => boolean, budget = 200_000): Promise<boolean> {
  for (let i = 1; i <= budget; i += 1) {
    if (cond()) return true
    if (i % 1000 === 0) {
      await new Promise((resolve) => {
        setTimeout(resolve, 0)
      })
    } else {
      await Promise.resolve()
    }
  }
  return cond()
}

/** Pump a fixed number of ticks (a small quiescence). */
async function pumpTicks(count: number): Promise<void> {
  for (let i = 0; i < count; i += 1) {
    if (i % 1000 === 0) {
      await new Promise((resolve) => {
        setTimeout(resolve, 0)
      })
    } else {
      await Promise.resolve()
    }
  }
}

/**
 * Start an action and observe it through a pump flag (NEVER awaited
 * directly — a hung promise must not hang the suite).
 */
function trackAction(action: Promise<unknown>): {
  readonly flag: PumpFlag
  readonly resolved: (budget?: number) => Promise<boolean>
} {
  const flag: PumpFlag = { done: false }
  void action.then(
    (value) => {
      flag.value = value
      flag.done = true
    },
    (error) => {
      flag.value = error
      flag.done = true
    },
  )
  return { flag, resolved: (budget?: number) => pumpWhile(() => flag.done, budget) }
}

// --- fakes ----------------------------------------------------------------------

/** The one-shot gate (release resolves the shared promise). */
function createGate(): { readonly promise: Promise<void>; readonly release: () => void } {
  let resolve: () => void = () => undefined
  const promise = new Promise<void>((r) => {
    resolve = r
  })
  return { promise, release: () => { resolve() } }
}

/** One behavior-driven delivery port fake (records the exact calls). */
interface FakeDelivery {
  readonly port: WorkDeliveryPort
  readonly calls: DeliveryArgs[]
}

function createFakeDelivery(
  behavior: (args: DeliveryArgs) => Promise<WorkDeliveryResult>,
): FakeDelivery {
  const calls: DeliveryArgs[] = []
  const port: WorkDeliveryPort = {
    async deliver(args) {
      calls.push(args)
      return behavior(args)
    },
  }
  return { port, calls }
}

/** The deterministic succeeded member result (the v2 C1 frozen shape). */
function successResult(args: DeliveryArgs): WorkDeliveryResult {
  return { requestToken: args.requestToken, status: 'succeeded', body: 'f3a member body' }
}

/**
 * The F3-A production-shaped world: the real durable world with ONE
 * shared per-team chain map installed on BOTH the runtime (router) and
 * the activity ledger (the production root wiring — the F3 hazard
 * shape). The model-visible delivery port is the scenario's fake.
 */
interface F3AWorld {
  readonly world: P6T1World
  readonly chains: Map<string, Promise<unknown>>
  readonly runtime: TeamRuntime
  readonly ledger: ActivityLedger
  readonly commitPort: ReturnType<typeof createFakeLifecycleCommitPort>
}

async function createF3AWorld(
  basename: string,
  seedNames: readonly P6T2SeedName[],
  delivery: WorkDeliveryPort,
  worldOptions: { readonly seedMembers?: readonly ReturnType<typeof p6t2Seed>[] } = {},
): Promise<F3AWorld> {
  const world = await createP6T2World(basename, seedNames, worldOptions)
  const clock = createP6T5Clock()
  const chains = new Map<string, Promise<unknown>>()
  const commitPort = createFakeLifecycleCommitPort(world)
  const runtime = createTeamRuntime({
    teamDomain: world.domain,
    activationProvider: world.provider,
    blueprintCatalog: world.catalog,
    environmentFacts: world.ports.environmentFacts,
    externalPolicyFacts: world.ports.externalPolicyFacts,
    now: () => P6T2_NOW,
    lifecycleCommit: commitPort,
    workDelivery: delivery,
    workActivity: createWorkActivityWriter({ teamDomain: world.domain, now: () => P6T2_NOW }),
    teamLocks: chains,
  })
  const ledger = createActivityLedger({
    teamDomain: world.domain,
    runtime,
    now: clock.now,
    teamLocks: chains,
  })
  return { world, chains, runtime, ledger, commitPort }
}

// --- probes ---------------------------------------------------------------------

/** All durable ledger facts of one type (deterministic order). */
function ledgerFacts(world: P6T1World, factType: string): LedgerEntry[] {
  return world.domain.repositories.ledger.list().filter(
    (entry) => entry.factType === factType,
  )
}

/** The member row of one world (test failure when absent). */
function memberRow(world: P6T1World, instanceId: string) {
  const row = world.domain.repositories.memberInstances.get(P6T2_ROOT, instanceId)
  if (row === undefined) {
    throw new Error(`memberRow: member '${instanceId}' is absent`)
  }
  return row
}

/** Narrow an executed outcome's effect to `work-admitted` (test failure otherwise). */
function asWorkAdmitted(outcome: TeamRuntimeActionOutcome): Extract<RuntimeActionEffect, { readonly kind: 'work-admitted' }> {
  const effect = outcome.effect
  if (effect.kind !== 'work-admitted') {
    throw new Error(`asWorkAdmitted: expected work-admitted, got ${effect.kind}`)
  }
  return effect
}

/** The admission facts for one request token (test failure when not exactly one). */
function admissionFact(world: P6T1World, requestToken: string): LedgerEntry {
  const facts = ledgerFacts(world, 'team-work-admitted').filter(
    (entry) => entry.payload['requestToken'] === requestToken,
  )
  if (facts.length !== 1) {
    throw new Error(`admissionFact: expected exactly one team-work-admitted for '${requestToken}', got ${facts.length}`)
  }
  const fact = facts[0]
  if (fact === undefined) {
    throw new Error(`admissionFact: no team-work-admitted fact for '${requestToken}'`)
  }
  return fact
}

/** The work-unit interval opens/closes for one correlation token. */
function intervalCount(world: P6T1World, kind: 'opened' | 'closed', requestToken: string): number {
  return ledgerFacts(world, `activity-interval-${kind}`).filter(
    (entry) => entry.payload['correlation'] === requestToken,
  ).length
}

// --- scenario captures -----------------------------------------------------------

interface T1Case {
  readonly resolved: boolean
  readonly settled: boolean | undefined
  readonly replayed: boolean | undefined
  readonly status: string | undefined
  readonly progressRows: number
  readonly progressToken: unknown
  readonly workerLifecycle: string
  readonly intervalOpens: number
  readonly intervalCloses: number
}

interface T2Case {
  readonly resolved1: boolean
  readonly resolved2: boolean
  readonly settled1: boolean | undefined
  readonly settled2: boolean | undefined
  readonly status1: string | undefined
  readonly status2: string | undefined
  readonly progressSequences: number[]
  readonly progressTokens: string[]
  readonly admissionFacts: number
  readonly workerLifecycle: string
  readonly intervalOpens: number
  readonly intervalCloses: number
}

interface T3Case {
  readonly deliveryEntered: boolean
  readonly followUpInFlightDuringArchive: boolean
  readonly archiveResolved: boolean
  readonly archiveEffectKind: string | undefined
  readonly archiveTo: unknown
  readonly scoutLifecycle: string
  readonly followUpResolved: boolean
  readonly followUpSettled: boolean | undefined
  readonly workerLifecycle: string
}

interface T4Case {
  readonly unit1Resolved: boolean
  readonly unit2Resolved: boolean
  readonly unit1Code: string | undefined
  readonly unit2Settled: boolean | undefined
  readonly unit2Status: string | undefined
  readonly commits: readonly (readonly [string, string])[]
  readonly admissionTokens: string[]
  readonly settlementFacts: {
    readonly token: unknown
    readonly workOutcome: unknown
    readonly from: unknown
  }[]
  readonly workerLifecycle: string
  readonly intervalOpens: number
  readonly intervalCloses: number
}

interface T5aCase {
  readonly rejected: boolean
  readonly reasonIdentity: boolean
  readonly notTeamRuntimeError: boolean
  readonly noAdmissionFact: boolean
  readonly workerActivityVersionUnchanged: boolean
  readonly controlResolved: boolean
  readonly controlSettled: boolean | undefined
}

interface T5bCase {
  readonly rejected: boolean
  readonly code: string | undefined
  readonly causeMessage: unknown
  readonly workerLifecycle: string
  readonly settlementOutcome: unknown
  readonly settlementFailure: unknown
  readonly intervalCloses: number
}

interface T6Case {
  readonly code: string | undefined
  readonly detailInstance: unknown
  readonly detailChild: unknown
  readonly detailToken: unknown
  readonly detailCause: unknown
  readonly messageCarriesFault: boolean
  readonly workerLifecycle: string
  readonly commits: readonly (readonly [string, string])[]
  readonly settlementOutcome: unknown
  readonly settlementFailure: unknown
  readonly admissionFactPrompt: unknown
  readonly intervalOpens: number
  readonly intervalCloses: number
}

let t1: T1Case
let t2: T2Case
let t3: T3Case
let t4: T4Case
let t5a: T5aCase
let t5b: T5bCase
let t6: T6Case

// --- T1: persistent deterministic RE-ENTRY (the F3 deadlock) ---------------------
//
// Production shape: the shared chain on the router AND the activity
// ledger. The member's delivery reports its own progress mid-turn —
// `team_report_progress` → activity facade → the SAME shared chain.
// Pre-fix: the leader's follow-up holds the chain across the delivery,
// so the member's progress queues behind the leader's own pending tail
// and NOTHING can progress (deadlock → the budget exhausts, red).
// Post-fix (INV-9.1): the chain is released during delivery; the
// progress resolves; the follow-up settles after it.

{
  const world = await createF3AWorld(
    'f3a-t1',
    ['leader', 'worker'],
    createFakeDelivery(async (args) => {
      // The member's own team tool during the turn (the faithful
      // re-entry): sequence = the deterministic head+1 for the fresh
      // subject.
      const sequence = nextSequence(world.ledger, WORKER_ID, 'member-work')
      await world.ledger.recordProgress(
        p6t5Progress({
          subject: 'member-work',
          sequence,
          requestToken: args.requestToken,
        }),
      )
      return successResult(args)
    }).port,
  )
  try {
    const tracked = trackAction(
      world.runtime.performAction(
        makeActionRequest({
          targetInstanceId: WORKER_ID,
          requestToken: 'tok-f3a-t1',
          payload: { prompt: 'f3a t1 re-entry prompt' },
        }),
      ),
    )
    const resolved = await tracked.resolved()
    if (resolved) {
      const outcome = tracked.flag.value as TeamRuntimeActionOutcome
      const effect = asWorkAdmitted(outcome)
      const rows = world.ledger.listActivityFacts({
        rootSessionId: P6T2_ROOT,
        instanceId: WORKER_ID,
        subject: 'member-work',
      })
      t1 = {
        resolved: true,
        settled: effect.settled,
        replayed: effect.replayed,
        status: effect.memberResult?.status,
        progressRows: rows.length,
        progressToken: rows[0]?.requestToken,
        workerLifecycle: memberRow(world.world, WORKER_ID).lifecycle,
        intervalOpens: intervalCount(world.world, 'opened', 'tok-f3a-t1'),
        intervalCloses: intervalCount(world.world, 'closed', 'tok-f3a-t1'),
      }
    } else {
      t1 = {
        resolved: false,
        settled: undefined,
        replayed: undefined,
        status: undefined,
        progressRows: world.ledger.listActivityFacts({
          rootSessionId: P6T2_ROOT,
          instanceId: WORKER_ID,
          subject: 'member-work',
        }).length,
        progressToken: undefined,
        workerLifecycle: memberRow(world.world, WORKER_ID).lifecycle,
        intervalOpens: intervalCount(world.world, 'opened', 'tok-f3a-t1'),
        intervalCloses: intervalCount(world.world, 'closed', 'tok-f3a-t1'),
      }
    }
  } finally {
    await destroyP6T1World(world.world)
  }
}

// --- T2: multiple progress (two progress rows per turn, two turns) ---------------

{
  const world = await createF3AWorld(
    'f3a-t2',
    ['leader', 'worker'],
    createFakeDelivery(async (args) => {
      // Two progress rows per turn — the head+1 guard is dynamic, so
      // turn 2 continues where turn 1 left off (3, 4).
      const first = nextSequence(world.ledger, WORKER_ID, 'member-work')
      await world.ledger.recordProgress(
        p6t5Progress({
          subject: 'member-work',
          sequence: first,
          requestToken: args.requestToken,
        }),
      )
      const second = nextSequence(world.ledger, WORKER_ID, 'member-work')
      await world.ledger.recordProgress(
        p6t5Progress({
          subject: 'member-work',
          sequence: second,
          requestToken: args.requestToken,
        }),
      )
      return successResult(args)
    }).port,
  )
  try {
    const tracked1 = trackAction(
      world.runtime.performAction(
        makeActionRequest({
          targetInstanceId: WORKER_ID,
          requestToken: 'tok-f3a-t2-1',
          payload: { prompt: 'f3a t2 first prompt' },
        }),
      ),
    )
    const resolved1 = await tracked1.resolved()
    const tracked2 = trackAction(
      world.runtime.performAction(
        makeActionRequest({
          targetInstanceId: WORKER_ID,
          requestToken: 'tok-f3a-t2-2',
          payload: { prompt: 'f3a t2 second prompt' },
        }),
      ),
    )
    const resolved2 = await tracked2.resolved()
    const rows = [...world.ledger.listActivityFacts({
      rootSessionId: P6T2_ROOT,
      instanceId: WORKER_ID,
      subject: 'member-work',
    })].sort((a: ActivityFactRow, b: ActivityFactRow) => a.sequence - b.sequence)
    const effect1 = resolved1
      ? asWorkAdmitted(tracked1.flag.value as TeamRuntimeActionOutcome)
      : undefined
    const effect2 = resolved2
      ? asWorkAdmitted(tracked2.flag.value as TeamRuntimeActionOutcome)
      : undefined
    t2 = {
      resolved1,
      resolved2,
      settled1: effect1?.settled,
      settled2: effect2?.settled,
      status1: effect1?.memberResult?.status,
      status2: effect2?.memberResult?.status,
      progressSequences: rows.map((row) => row.sequence),
      progressTokens: rows.map((row) => String(row.requestToken)),
      admissionFacts: ledgerFacts(world.world, 'team-work-admitted').length,
      workerLifecycle: memberRow(world.world, WORKER_ID).lifecycle,
      intervalOpens:
        intervalCount(world.world, 'opened', 'tok-f3a-t2-1') +
        intervalCount(world.world, 'opened', 'tok-f3a-t2-2'),
      intervalCloses:
        intervalCount(world.world, 'closed', 'tok-f3a-t2-1') +
        intervalCount(world.world, 'closed', 'tok-f3a-t2-2'),
    }
  } finally {
    await destroyP6T1World(world.world)
  }
}

// --- T3: concurrent mutation during delivery (the released chain) ----------------
//
// While the follow-up sits at the delivery gate (Phase B — no chain),
// the leader archives the SETTLED scout (the only legal archive edge).
// Pre-fix the archive queues behind the held chain and hangs; post-fix
// the chain is free and the mutation commits durably mid-delivery.

{
  const gate = createGate()
  let deliveryEntered = false
  const world = await createF3AWorld(
    'f3a-t3',
    ['leader', 'worker'],
    createFakeDelivery(async (args) => {
      deliveryEntered = true
      await gate.promise
      return successResult(args)
    }).port,
    { seedMembers: [p6t2Seed('scout', { lifecycle: 'SETTLED' })] },
  )
  try {
    const trackedFu = trackAction(
      world.runtime.performAction(
        makeActionRequest({
          targetInstanceId: WORKER_ID,
          requestToken: 'tok-f3a-t3',
          payload: { prompt: 'f3a t3 gated prompt' },
        }),
      ),
    )
    const entered = await pumpWhile(() => deliveryEntered)
    // The unrelated same-team mutation DURING the in-flight delivery.
    const trackedArchive = trackAction(
      world.runtime.performAction(
        makeActionRequest({
          action: 'archive-member',
          targetInstanceId: SCOUT_ID,
          requestToken: 'tok-f3a-t3-archive',
        }),
      ),
    )
    const archiveResolved = await trackedArchive.resolved()
    const inFlightDuringArchive = !trackedFu.flag.done
    gate.release()
    const followUpResolved = await trackedFu.resolved()
    const archiveOutcome = archiveResolved
      ? (trackedArchive.flag.value as TeamRuntimeActionOutcome)
      : undefined
    const followUpOutcome = followUpResolved
      ? (trackedFu.flag.value as TeamRuntimeActionOutcome)
      : undefined
    t3 = {
      deliveryEntered: entered,
      followUpInFlightDuringArchive: inFlightDuringArchive,
      archiveResolved,
      archiveEffectKind: archiveOutcome?.effect.kind,
      archiveTo: archiveOutcome?.effect.kind === 'lifecycle-changed'
        ? (archiveOutcome.effect as Extract<RuntimeActionEffect, { readonly kind: 'lifecycle-changed' }>).to
        : undefined,
      scoutLifecycle: memberRow(world.world, SCOUT_ID).lifecycle,
      followUpResolved,
      followUpSettled: followUpOutcome !== undefined
        ? asWorkAdmitted(followUpOutcome).settled
        : undefined,
      workerLifecycle: memberRow(world.world, WORKER_ID).lifecycle,
    }
  } finally {
    await destroyP6T1World(world.world)
  }
}

// --- T4: H3 overlap (two work units, one instance, converging settlements) -------
//
// Unit 1 (tok-f3a-t4-1) admits (CAS SETTLED -> RUNNING) and sits at the
// delivery gate. Unit 2 (tok-f3a-t4-2) is then admitted on the SAME
// instance (fresh RUNNING: no CAS, its own admission fact + interval)
// and delivers immediately — its Phase C converges FIRST (the fresh
// read is still RUNNING: it commits RUNNING -> SETTLED). Unit 1's
// delivery then FAILS: its Phase C fail-closed settle re-reads the now
// SETTLED row and takes the convergence branch (its own settlement
// fact, no state commit). Both settlement facts are durable; exactly
// one state commit happened; the member ends SETTLED.

{
  const gate = createGate()
  let unit1Entered = false
  let unit1Failure: string | undefined
  const T1_TOKEN = 'tok-f3a-t4-1'
  const T2_TOKEN = 'tok-f3a-t4-2'
  const world = await createF3AWorld(
    'f3a-t4',
    ['leader'],
    createFakeDelivery(async (args) => {
      if (args.requestToken === T1_TOKEN) {
        unit1Entered = true
        await gate.promise
        if (unit1Failure !== undefined) {
          throw new Error(unit1Failure)
        }
        return successResult(args)
      }
      return successResult(args)
    }).port,
    { seedMembers: [p6t2Seed('worker', { lifecycle: 'SETTLED' })] },
  )
  try {
    const tracked1 = trackAction(
      world.runtime.performAction(
        makeActionRequest({
          targetInstanceId: WORKER_ID,
          requestToken: T1_TOKEN,
          payload: { prompt: 'f3a t4 unit 1 prompt' },
        }),
      ),
    )
    const unit1InDelivery = await pumpWhile(() => unit1Entered)
    if (!unit1InDelivery) {
      throw new Error('t4: unit 1 did not reach the delivery gate')
    }
    // Unit 2 — admitted during unit 1's delivery (the H3 window).
    const tracked2 = trackAction(
      world.runtime.performAction(
        makeActionRequest({
          targetInstanceId: WORKER_ID,
          requestToken: T2_TOKEN,
          payload: { prompt: 'f3a t4 unit 2 prompt' },
        }),
      ),
    )
    const unit2Resolved = await tracked2.resolved()
    // Now fail unit 1's in-flight delivery (N3: settle before throw).
    unit1Failure = 'f3a t4 unit 1 delivery failed'
    gate.release()
    const unit1Resolved = await tracked1.resolved()
    const unit1Error = tracked1.flag.value
    const unit2Outcome = unit2Resolved
      ? (tracked2.flag.value as TeamRuntimeActionOutcome)
      : undefined
    const settlements = ledgerFacts(world.world, 'member-lifecycle-changed')
      .filter(
        (entry) =>
          entry.payload['instanceId'] === WORKER_ID &&
          entry.payload['to'] === 'SETTLED',
      )
      .map((entry) => ({
        token: entry.payload['requestToken'],
        workOutcome: entry.payload['workOutcome'],
        from: entry.payload['from'],
      }))
    t4 = {
      unit1Resolved,
      unit2Resolved,
      unit1Code: isTeamRuntimeError(unit1Error) ? unit1Error.code : undefined,
      unit2Settled:
        unit2Outcome !== undefined ? asWorkAdmitted(unit2Outcome).settled : undefined,
      unit2Status:
        unit2Outcome !== undefined
          ? asWorkAdmitted(unit2Outcome).memberResult?.status
          : undefined,
      commits: world.commitPort.calls.map(
        (call) => [call.from, call.to] as [string, string],
      ),
      admissionTokens: ledgerFacts(world.world, 'team-work-admitted').map(
        (entry) => String(entry.payload['requestToken']),
      ),
      settlementFacts: settlements,
      workerLifecycle: memberRow(world.world, WORKER_ID).lifecycle,
      intervalOpens:
        intervalCount(world.world, 'opened', T1_TOKEN) +
        intervalCount(world.world, 'opened', T2_TOKEN),
      intervalCloses:
        intervalCount(world.world, 'closed', T1_TOKEN) +
        intervalCount(world.world, 'closed', T2_TOKEN),
    }
  } finally {
    await destroyP6T1World(world.world)
  }
}

// --- T5a: abort while WAITING for the Phase A chain acquisition (N6) -------------
//
// The shared chain is held by a pending unit (the sentinel — any
// strictly-sequential holder: another team action, a guarded ledger
// commit, ...). The follow-up (tok-f3a-t5a) queues behind it, the
// caller aborts while waiting, and the acquisition is then released:
// the request rejects with the CALLER'S ABORT REASON and NOTHING was
// admitted (no admission fact; the member row is untouched). The chain
// stays usable (the rejected unit poisons nothing).

{
  const world = await createF3AWorld(
    'f3a-t5a',
    ['leader', 'worker'],
    createFakeDelivery(async (args) => successResult(args)).port,
  )
  try {
    const baseline = memberRow(world.world, WORKER_ID).activityVersion
    // The chain is held by a pending unit (the documented pattern).
    let releaseSentinel: () => void = () => undefined
    const sentinel = new Promise<void>((r) => {
      releaseSentinel = r
    })
    world.chains.set(P6T2_ROOT, sentinel)
    const controller = new AbortController()
    const reason = new Error('f3a t5a caller cancelled')
    const tracked = trackAction(
      world.runtime.performAction(
        makeActionRequest({
          targetInstanceId: WORKER_ID,
          requestToken: 'tok-f3a-t5a',
          payload: { prompt: 'f3a t5a aborted prompt' },
          signal: controller.signal,
        }),
      ),
    )
    await pumpTicks(20)
    controller.abort(reason)
    // The signal governs the WAIT: aborting while queued rejects the
    // acquisition with the caller's reason (no work starts). Releasing
    // the sentinel completes the pending chain unit and proves the
    // rejected wait poisons nothing.
    releaseSentinel()
    const rejected = await tracked.resolved()
    // NOTHING was admitted by the aborted request: the member row is
    // untouched at this point (checked BEFORE the control runs — the
    // control follow-up below legitimately settles the worker).
    const activityVersionAfterAbort = memberRow(world.world, WORKER_ID).activityVersion
    // Control: the chain is healthy after the aborted wait.
    const trackedCtl = trackAction(
      world.runtime.performAction(
        makeActionRequest({
          targetInstanceId: WORKER_ID,
          requestToken: 'tok-f3a-t5a-ctl',
          payload: { prompt: 'f3a t5a control prompt' },
        }),
      ),
    )
    const controlResolved = await trackedCtl.resolved()
    const ctlOutcome = controlResolved
      ? (trackedCtl.flag.value as TeamRuntimeActionOutcome)
      : undefined
    t5a = {
      rejected,
      reasonIdentity: rejected && tracked.flag.value === reason,
      notTeamRuntimeError: rejected && !isTeamRuntimeError(tracked.flag.value),
      noAdmissionFact: ledgerFacts(world.world, 'team-work-admitted').every(
        (entry) => entry.payload['requestToken'] !== 'tok-f3a-t5a',
      ),
      workerActivityVersionUnchanged: activityVersionAfterAbort === baseline,
      controlResolved,
      controlSettled: ctlOutcome !== undefined
        ? asWorkAdmitted(ctlOutcome).settled
        : undefined,
    }
  } finally {
    await destroyP6T1World(world.world)
  }
}

// --- T5b: abort during DELIVERY (N6 Phase C durability after abort) --------------
//
// The delivery is at its gate; the caller aborts; the delivery rejects
// on the signal. Phase C runs WITHOUT the request signal: the
// fail-closed settlement is STILL committed (the delivery-failed fact +
// SETTLED), and only then does WORK_DELIVERY_FAILED propagate (N3).

{
  const gate = createGate()
  let deliveryEntered = false
  const TOKEN = 'tok-f3a-t5b'
  const world = await createF3AWorld(
    'f3a-t5b',
    ['leader'],
    createFakeDelivery(async (args) => {
      deliveryEntered = true
      const signal = args.signal as AbortSignal | undefined
      // Honor the caller's transient cancellation: reject on abort.
      await new Promise<void>((resolve, reject) => {
        if (signal === undefined) {
          void gate.promise.then(resolve)
          return
        }
        const onAbort = (): void => {
          signal.removeEventListener('abort', onAbort)
          reject(signal.reason ?? new Error('operation aborted'))
        }
        signal.addEventListener('abort', onAbort, { once: true })
        void gate.promise.then(() => {
          signal.removeEventListener('abort', onAbort)
          resolve()
        })
      })
      return successResult(args)
    }).port,
    { seedMembers: [p6t2Seed('worker', { lifecycle: 'SETTLED' })] },
  )
  try {
    const controller = new AbortController()
    const reason = new Error('f3a t5b caller cancelled')
    const tracked = trackAction(
      world.runtime.performAction(
        makeActionRequest({
          targetInstanceId: WORKER_ID,
          requestToken: TOKEN,
          payload: { prompt: 'f3a t5b aborted-during-delivery prompt' },
          signal: controller.signal,
        }),
      ),
    )
    const entered = await pumpWhile(() => deliveryEntered)
    controller.abort(reason)
    const rejected = await tracked.resolved()
    const error = tracked.flag.value
    const settlement = ledgerFacts(world.world, 'member-lifecycle-changed')
      .filter(
        (entry) =>
          entry.payload['instanceId'] === WORKER_ID &&
          entry.payload['to'] === 'SETTLED' &&
          entry.payload['requestToken'] === TOKEN,
      )
      .map((entry) => entry.payload)
    const sole = settlement.length === 1 ? settlement[0] : undefined
    t5b = {
      rejected: entered && rejected,
      code: isTeamRuntimeError(error) ? error.code : undefined,
      causeMessage:
        isTeamRuntimeError(error) ? (error.details?.['cause'] as Record<string, unknown> | undefined)?.['message'] : undefined,
      workerLifecycle: memberRow(world.world, WORKER_ID).lifecycle,
      settlementOutcome: sole?.['workOutcome'],
      settlementFailure: sole !== undefined
        ? (sole['failure'] as Record<string, unknown> | undefined)?.['message']
        : undefined,
      intervalCloses: intervalCount(world.world, 'closed', TOKEN),
    }
  } finally {
    await destroyP6T1World(world.world)
  }
}

// --- T6: throw-after-settle on a plain delivery fault (N3, production wiring) ----
//
// The delivery port throws a plain Error (no signal, no abort): the
// leader's follow-up rejects with WORK_DELIVERY_FAILED, but the durable
// state has ALREADY converged — the worker is SETTLED (never a fake
// RUNNING), the delivery-failed settlement fact carries the fault, and
// the interval opened and closed. The production-shaped wiring (shared
// chain on router + ledger) is what makes this the F3-A variant of the
// P8-S3 W4 invariant.

{
  const TOKEN = 'tok-f3a-t6'
  const world = await createF3AWorld(
    'f3a-t6',
    ['leader'],
    createFakeDelivery(async () => {
      throw new Error('f3a t6 delivery boom')
    }).port,
    { seedMembers: [p6t2Seed('worker', { lifecycle: 'SETTLED' })] },
  )
  try {
    const tracked = trackAction(
      world.runtime.performAction(
        makeActionRequest({
          targetInstanceId: WORKER_ID,
          requestToken: TOKEN,
          payload: { prompt: 'f3a t6 failing prompt' },
        }),
      ),
    )
    const rejected = await tracked.resolved()
    const error = tracked.flag.value
    const settlement = ledgerFacts(world.world, 'member-lifecycle-changed')
      .filter(
        (entry) =>
          entry.payload['instanceId'] === WORKER_ID &&
          entry.payload['to'] === 'SETTLED' &&
          entry.payload['requestToken'] === TOKEN,
      )
      .map((entry) => entry.payload)
    const sole = settlement.length === 1 ? settlement[0] : undefined
    t6 = {
      code: rejected && isTeamRuntimeError(error) ? error.code : undefined,
      detailInstance: isTeamRuntimeError(error) ? error.details?.['instanceId'] : undefined,
      detailChild: isTeamRuntimeError(error) ? error.details?.['childSessionId'] : undefined,
      detailToken: isTeamRuntimeError(error) ? error.details?.['requestToken'] : undefined,
      detailCause: isTeamRuntimeError(error) ? error.details?.['cause'] : undefined,
      messageCarriesFault:
        rejected &&
        error instanceof Error &&
        error.message.includes('f3a t6 delivery boom') &&
        error.message.includes(WORKER_CHILD),
      workerLifecycle: memberRow(world.world, WORKER_ID).lifecycle,
      commits: world.commitPort.calls.map(
        (call) => [call.from, call.to] as [string, string],
      ),
      settlementOutcome: sole?.['workOutcome'],
      settlementFailure: sole !== undefined
        ? (sole['failure'] as Record<string, unknown> | undefined)?.['message']
        : undefined,
      admissionFactPrompt: admissionFact(world.world, TOKEN).payload['prompt'],
      intervalOpens: intervalCount(world.world, 'opened', TOKEN),
      intervalCloses: intervalCount(world.world, 'closed', TOKEN),
    }
  } finally {
    await destroyP6T1World(world.world)
  }
}

// --- assertions (synchronous over the captured scenarios) -------------------------

describe('F3-A (repair-r1): the work chain lock scope (INV-9.1)', () => {
  it('T1: the member report_progress DURING its own delivery resolves against the shared chain (no deadlock) and is durable before the follow-up settles', () => {
    expect(t1.resolved).toBe(true)
    expect(t1.settled).toBe(true)
    expect(t1.replayed).toBe(false)
    expect(t1.status).toBe('succeeded')
    expect(t1.progressRows).toBe(1)
    expect(t1.progressToken).toBe('tok-f3a-t1')
    expect(t1.workerLifecycle).toBe('SETTLED')
    expect(t1.intervalOpens).toBe(1)
    expect(t1.intervalCloses).toBe(1)
  })

  it('T2: multiple progress across two follow-ups (head+1 per subject; both turns succeed and settle)', () => {
    expect(t2.resolved1).toBe(true)
    expect(t2.resolved2).toBe(true)
    expect(t2.settled1).toBe(true)
    expect(t2.settled2).toBe(true)
    expect(t2.status1).toBe('succeeded')
    expect(t2.status2).toBe('succeeded')
    expect(t2.progressSequences).toEqual([1, 2, 3, 4])
    expect(t2.progressTokens).toEqual([
      'tok-f3a-t2-1',
      'tok-f3a-t2-1',
      'tok-f3a-t2-2',
      'tok-f3a-t2-2',
    ])
    expect(t2.admissionFacts).toBe(2)
    expect(t2.workerLifecycle).toBe('SETTLED')
    expect(t2.intervalOpens).toBe(2)
    expect(t2.intervalCloses).toBe(2)
  })

  it('T3: an unrelated same-team mutation commits durably WHILE a work delivery is in flight (the chain is released during delivery)', () => {
    expect(t3.deliveryEntered).toBe(true)
    expect(t3.followUpInFlightDuringArchive).toBe(true)
    expect(t3.archiveResolved).toBe(true)
    expect(t3.archiveEffectKind).toBe('lifecycle-changed')
    expect(t3.archiveTo).toBe('ARCHIVED')
    expect(t3.scoutLifecycle).toBe('ARCHIVED')
    expect(t3.followUpResolved).toBe(true)
    expect(t3.followUpSettled).toBe(true)
    expect(t3.workerLifecycle).toBe('SETTLED')
  })

  it('T4 (H3): a second work unit admitted during the first delivery converges — one state commit, both settlement facts durable, member SETTLED, no deadlock', () => {
    expect(t4.unit2Resolved).toBe(true)
    expect(t4.unit1Resolved).toBe(true)
    // unit 2 settled first (the fresh read was still RUNNING) ...
    expect(t4.unit2Settled).toBe(true)
    expect(t4.unit2Status).toBe('succeeded')
    // ... unit 1 then failed fail-closed (the SETTLED convergence
    // branch: its own settlement fact, no state commit) and threw.
    expect(t4.unit1Code).toBe(TEAM_RUNTIME_ERROR_CODES.WORK_DELIVERY_FAILED)
    // exactly one lifecycle state commit pair (unit 1 admit + unit 2 settle)
    expect(t4.commits).toEqual([
      ['SETTLED', 'RUNNING'],
      ['RUNNING', 'SETTLED'],
    ])
    expect(t4.admissionTokens).toEqual(['tok-f3a-t4-1', 'tok-f3a-t4-2'])
    // both settlement facts durable (the convergence trail)
    expect(t4.settlementFacts.length).toBe(2)
    const unit1Fact = t4.settlementFacts.find((fact) => fact.token === 'tok-f3a-t4-1')
    const unit2Fact = t4.settlementFacts.find((fact) => fact.token === 'tok-f3a-t4-2')
    expect(unit1Fact?.workOutcome).toBe('delivery-failed')
    expect(unit1Fact?.from).toBe('RUNNING')
    expect(unit2Fact?.workOutcome).toBe('settled')
    expect(unit2Fact?.from).toBe('RUNNING')
    expect(t4.workerLifecycle).toBe('SETTLED')
    expect(t4.intervalOpens).toBe(2)
    expect(t4.intervalCloses).toBe(2)
  })

  it('T5a: an abort while WAITING for the Phase A acquisition rejects with the caller reason and admits nothing; the chain stays usable', () => {
    expect(t5a.rejected).toBe(true)
    expect(t5a.reasonIdentity).toBe(true)
    expect(t5a.notTeamRuntimeError).toBe(true)
    expect(t5a.noAdmissionFact).toBe(true)
    expect(t5a.workerActivityVersionUnchanged).toBe(true)
    expect(t5a.controlResolved).toBe(true)
    expect(t5a.controlSettled).toBe(true)
  })

  it('T5b: an abort during DELIVERY still gets its fail-closed settlement committed (Phase C without the signal), then WORK_DELIVERY_FAILED (N6/N3)', () => {
    expect(t5b.rejected).toBe(true)
    expect(t5b.code).toBe(TEAM_RUNTIME_ERROR_CODES.WORK_DELIVERY_FAILED)
    expect(t5b.causeMessage).toBe('f3a t5b caller cancelled')
    expect(t5b.workerLifecycle).toBe('SETTLED')
    expect(t5b.settlementOutcome).toBe('delivery-failed')
    expect(t5b.settlementFailure).toBe('f3a t5b caller cancelled')
    expect(t5b.intervalCloses).toBe(1)
  })

  it('T6: a plain delivery fault throws WORK_DELIVERY_FAILED with the durable delivery-failed settlement already committed (throw-after-settle)', () => {
    expect(t6.code).toBe(TEAM_RUNTIME_ERROR_CODES.WORK_DELIVERY_FAILED)
    expect(t6.detailInstance).toBe(WORKER_ID)
    expect(t6.detailChild).toBe(WORKER_CHILD)
    expect(t6.detailToken).toBe('tok-f3a-t6')
    expect(t6.detailCause).toEqual({ message: 'f3a t6 delivery boom' })
    expect(t6.messageCarriesFault).toBe(true)
    expect(t6.workerLifecycle).toBe('SETTLED')
    expect(t6.commits).toEqual([
      ['SETTLED', 'RUNNING'],
      ['RUNNING', 'SETTLED'],
    ])
    expect(t6.settlementOutcome).toBe('delivery-failed')
    expect(t6.settlementFailure).toBe('f3a t6 delivery boom')
    expect(t6.admissionFactPrompt).toBe('f3a t6 failing prompt')
    expect(t6.intervalOpens).toBe(1)
    expect(t6.intervalCloses).toBe(1)
  })
})
