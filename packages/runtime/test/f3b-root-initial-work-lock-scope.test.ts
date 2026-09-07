/**
 * F3-B (repair-r1) — the Root initial-work lock scope (INV-9.1, the N1
 * sibling of F3-A's member work-chain split) at the PRODUCTION-WIRED seam:
 * ONE shared per-team chain map (`TeamOperationCoordinator` chains)
 * installed on BOTH the TeamRuntime facade (router) and the
 * `createAdmitRootInitialWork` closure (the production root shape —
 * `root.ts` wires the same `coordination.chains` into the router and the
 * Root initial-work authority, plus the activity ledger's guarded
 * commit).
 *
 * The fix under test is the THREE-PHASE lock split of the Root
 * initial-work closure (`root-initial-work.ts`): Phase A (compatibility
 * gate + scan + the durable admission fact) runs in ONE acquisition of
 * the shared chain; the chain is then RELEASED; Phase B (the
 * `deliverRootWork` port call — the ROOT TURN) runs WITHOUT the shared
 * chain; Phase C (the terminal fact) re-acquires the SAME chain without
 * any abort signal (N6 — this seam accepts no request signal at all).
 * Before the fix, the closure held the chain across the WHOLE root turn
 * (gate + scan + admission + delivery + terminal), so the leader's own
 * team tools during that turn (`team_delegate` / `team_follow_up` /
 * `team_report_progress`) queued behind the closure's own pending tail
 * on the same non-re-entrant chain: the N1 deadlock.
 *
 * Coverage (contract rows F3B-T1 + the F3-A pattern rows):
 * - T1 (N1 re-entry, RED pre-fix = deadlock): the leader's
 *   `team_report_progress` DURING the root initial-work turn resolves
 *   against the shared chain — no deadlock — and the progress audit fact
 *   is durable before the admit settles; exactly one admission fact +
 *   one terminal fact; mode `fresh`; one delivery;
 * - T2 (the direct orchestrator seam): the SAME re-entry through
 *   `executeRootInitialWorkLocked` with `teamLocks` installed (the
 *   three-phase orchestrator acquires/releases/re-acquires — post-fix
 *   seam pin; pre-fix the seam held no chain at all and the row is
 *   vacuously green);
 * - T3 (concurrent mutation during the root delivery): an unrelated
 *   same-team mutation (`report-progress`) runs AND commits durably
 *   while the root initial-work delivery is gated in flight — the chain
 *   is released during the ROOT TURN (the F3-T3 analog; RED pre-fix =
 *   deadlock);
 * - T4 (throw-after-settle + retry/replay preserved on the shared
 *   chain, N3): a delivery fault yields WORK_DELIVERY_FAILED with the
 *   durable admission retained and NO terminal fact; the chain is not
 *   poisoned; the same-token retry redelivers and converges to the
 *   terminal fact WITHOUT re-admitting; the third call is a zero-
 *   delivery replay (at-least-once + the model-side token dedupe).
 *
 * The deterministic H3-root overlap (a concurrent SAME-token admit
 * passing Phase A as an admitted-only RETRY during the first's
 * in-flight delivery — two model-visible deliveries, exactly ONE
 * terminal fact via the Phase C fresh-read) is pinned by the LOCK-1
 * scenario of `tcm-m3-root-initial-work.test.ts` (updated to the
 * documented interleave by this leaf).
 *
 * House pattern of the runtime package: async world construction and
 * action execution at the TOP LEVEL (one bare block per scenario, each
 * destroyed in its finally); every `it` below asserts the captured
 * constants synchronously (the plain-node shim supports no async `it`).
 *
 * @module @dsh-agent-team/runtime/test/f3b-root-initial-work-lock-scope
 */

import { describe, expect, it } from 'vitest'
import type { LedgerEntry } from '../../storage/schema/index.js'
import {
  createAdmitRootInitialWork,
  createTeamRuntime,
  executeRootInitialWorkLocked,
} from '../action-router/index.js'
import type { RootWorkDeliveryPort } from '../action-router/index.js'
import {
  TEAM_RUNTIME_ERROR_CODES,
  isTeamRuntimeError,
  resolveCaller,
} from '../admission/index.js'
import type {
  ResolvedCaller,
  TeamRuntime,
  WorkDeliveryPort,
} from '../admission/index.js'
import { createActivityLedger, createWorkActivityWriter } from '../activity/index.js'
import type { ActivityLedger } from '../activity/index.js'
import { destroyP6T1World } from './p6t1-helpers.js'
import type { P6T1World } from './p6t1-helpers.js'
import {
  P6T2_NOW,
  P6T2_ROOT,
  P6T2_SEEDS,
  createFakeLifecycleCommitPort,
  createP6T2World,
  leaderCaller,
  makeActionRequest,
} from './p6t2-helpers.js'
import { createP6T5Clock } from './p6t5-helpers.js'
import { destroyDir, scratchDir } from '../../testkit/fault-injection/file-seam.mjs'

/**
 * Scratch hygiene: a crashed previous run of this suite (e.g. the
 * pre-fix RED check, where deadlocked promise chains are abandoned) can
 * leave a stale `f3b-*` scratch dir behind; the deterministic basenames
 * would then collide on re-run ("team_domain already exists"). Clean
 * ONLY this suite's own basenames before building any world (test
 * scratch under packages/testkit/test/.tmp-fault — gitignored;
 * destroyDir is a no-op when absent).
 */
const F3B_SCRATCH_BASES = ['f3b-t1', 'f3b-t2', 'f3b-t3', 'f3b-t4']
for (const base of F3B_SCRATCH_BASES) {
  destroyDir(scratchDir(base))
}

const WORKER_ID = String(P6T2_SEEDS.worker.instanceId)

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

/** The one-shot gate (release resolves the shared promise). */
function createGate(): { readonly promise: Promise<void>; readonly release: () => void } {
  let resolve: () => void = () => undefined
  const promise = new Promise<void>((r) => {
    resolve = r
  })
  return { promise, release: () => { resolve() } }
}

// --- fakes ----------------------------------------------------------------------

/** The Root initial-work delivery args (the port's deliverRootWork input). */
type RootDeliveryArgs = Parameters<RootWorkDeliveryPort['deliverRootWork']>[0]

/** One behavior-driven Root delivery port fake (records the exact calls). */
interface FakeRootDelivery {
  readonly port: RootWorkDeliveryPort
  readonly calls: RootDeliveryArgs[]
  /** Arm a failure for the next `n` deliveries (0 = never). */
  failNext(n: number): void
}

function createFakeRootDelivery(
  behavior: (args: RootDeliveryArgs) => Promise<void>,
): FakeRootDelivery {
  const calls: RootDeliveryArgs[] = []
  let failuresLeft = 0
  const port: RootWorkDeliveryPort = {
    async deliverRootWork(input) {
      calls.push({ ...input })
      if (failuresLeft > 0) {
        failuresLeft -= 1
        throw new Error('injected root delivery fault')
      }
      await behavior(input)
    },
  }
  return {
    port,
    calls,
    failNext(n: number) {
      failuresLeft = n
    },
  }
}

/** The unused member work delivery port (the P8-S3 shape; test-neutral). */
function createIdleMemberDelivery(): WorkDeliveryPort {
  return {
    async deliver(args) {
      return {
        requestToken: args.requestToken,
        status: 'unavailable',
        error: { code: 'TEST_FAKE_NO_BODY', message: 'test fake delivery: no member body produced' },
      }
    },
  }
}

/**
 * The F3-B production-shaped world: the real durable world with ONE
 * shared per-team chain map installed on BOTH the runtime (router) and
 * the activity ledger (the production root wiring — the N1 hazard
 * shape), plus the Root initial-work closure over the SAME map. The
 * model-visible Root delivery port is the scenario's fake.
 */
interface F3BWorld {
  readonly world: P6T1World
  readonly chains: Map<string, Promise<unknown>>
  readonly runtime: TeamRuntime
  readonly ledger: ActivityLedger
  readonly admit: ReturnType<typeof createAdmitRootInitialWork>
}

async function createF3BWorld(
  basename: string,
  delivery: RootWorkDeliveryPort,
): Promise<F3BWorld> {
  const world = await createP6T2World(basename, ['leader', 'worker'])
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
    workDelivery: createIdleMemberDelivery(),
    workActivity: createWorkActivityWriter({ teamDomain: world.domain, now: () => P6T2_NOW }),
    teamLocks: chains,
  })
  const ledger = createActivityLedger({
    teamDomain: world.domain,
    runtime,
    now: clock.now,
    teamLocks: chains,
  })
  const admit = createAdmitRootInitialWork({
    teamLocks: chains,
    repositories: world.domain.repositories,
    environmentFacts: world.ports.environmentFacts,
    now: () => P6T2_NOW,
    deliverRootWork: delivery,
  })
  return { world, chains, runtime, ledger, admit }
}

// --- probes ---------------------------------------------------------------------

/** The resolved Leader caller of one world (the honest resolution). */
function worldCaller(world: P6T1World): ResolvedCaller {
  return resolveCaller(world.domain.repositories, P6T2_ROOT, leaderCaller())
}

/** The durable ledger entry count of one world. */
function ledgerCount(world: P6T1World): number {
  return world.domain.repositories.ledger.list().length
}

/** All durable Root initial-work facts of one type (the `targetKind: 'root'` pair). */
function rootWorkFacts(world: P6T1World, factType: string): LedgerEntry[] {
  return world.domain.repositories.ledger.list().filter(
    (entry) =>
      entry.rootSessionId === P6T2_ROOT &&
      entry.factType === factType &&
      entry.payload['targetKind'] === 'root',
  )
}

/** The durable coordination audit facts for one request token. */
function auditFactsForToken(world: P6T1World, requestToken: string): LedgerEntry[] {
  return world.domain.repositories.ledger.list().filter(
    (entry) =>
      entry.rootSessionId === P6T2_ROOT &&
      entry.factType === 'team-coordination-recorded' &&
      entry.payload['requestToken'] === requestToken,
  )
}

/** The single element of a filtered list (test failure otherwise). */
function only<T>(list: readonly T[], label: string): T {
  const item = list[0]
  if (item === undefined) {
    throw new Error(`only(${label}): list has ${list.length} entries`)
  }
  if (list.length !== 1) {
    throw new Error(`only(${label}): expected exactly 1, got ${list.length}`)
  }
  return item
}

/** The member row of one world (test failure when absent). */
function memberRow(world: P6T1World, instanceId: string) {
  const row = world.domain.repositories.memberInstances.get(P6T2_ROOT, instanceId)
  if (row === undefined) {
    throw new Error(`memberRow: member '${instanceId}' is absent`)
  }
  return row
}

/** Narrow a thrown value to a TeamRuntimeError with exactly `code`. */
function expectCode(error: unknown, code: string): string {
  if (!isTeamRuntimeError(error) || error.code !== code) {
    throw new Error(
      `expectCode: expected TeamRuntimeError '${code}', got ${error instanceof Error ? `${error.name}: ${error.message}` : String(error)}`,
    )
  }
  return error.code
}

// --- scenario captures -----------------------------------------------------------

interface ReEntryCase {
  readonly resolved: boolean
  readonly mode: string | undefined
  readonly delivered: boolean | undefined
  readonly progressFacts: number
  readonly admittedFacts: number
  readonly terminalFacts: number
  readonly ordering: boolean
  readonly deliveryCalls: number
  readonly workerLifecycle: string
}

interface MutationCase {
  readonly deliveryEntered: boolean
  readonly mutationResolved: boolean
  readonly mutationFacts: number
  readonly outerResolved: boolean
  readonly outerMode: string | undefined
  readonly admittedFacts: number
  readonly terminalFacts: number
  readonly deliveryCalls: number
}

interface FaultCase {
  readonly faultCode: string
  readonly faultAdmitted: number
  readonly faultTerminal: number
  readonly retryMode: string
  readonly retryDelivered: boolean
  readonly retryAdmitted: number
  readonly retryTerminal: number
  readonly retrySequence: boolean
  readonly replayMode: string
  readonly replayDelivered: boolean
  readonly deliveryCalls: number
  readonly terminalFacts: number
}

let t1: ReEntryCase
let t2: ReEntryCase
let t3: MutationCase
let t4: FaultCase

// --- T1: the N1 RE-ENTRY through the production closure (RED pre-fix = deadlock) -
//
// Production shape: ONE shared chain on the router AND the Root
// initial-work closure. The leader's own team tool during the ROOT TURN
// (`team_report_progress` → the router's facade → the SAME shared chain).
// Pre-fix: the closure holds the chain across the whole root turn, so the
// progress queues behind the closure's own pending tail and NOTHING can
// progress (deadlock → the budget exhausts, red). Post-fix (INV-9.1):
// the chain is released during the delivery; the progress resolves; the
// admit settles after it.

{
  let worldRef: F3BWorld
  const delivery = createFakeRootDelivery(async () => {
    // The leader's own team tool during the root turn (the faithful N1
    // re-entry — report-progress to the live worker).
    await worldRef.runtime.performAction(
      makeActionRequest({
        action: 'report-progress',
        targetInstanceId: WORKER_ID,
        requestToken: 'tok-f3b-t1-progress',
        payload: { progress: 'in-progress', summary: 'root initial work in flight' },
      }),
    )
  })
  worldRef = await createF3BWorld('f3b-t1', delivery.port)
  const { world, admit } = worldRef
  try {
    const tracked = trackAction(
      admit({
        rootSessionId: P6T2_ROOT,
        caller: worldCaller(world),
        requestToken: 'tok-f3b-t1',
        prompt: 'f3b t1: initialize the team workspace',
        blueprint: world.blueprint,
      }),
    )
    const resolved = await tracked.resolved()
    const outcome = resolved ? (tracked.flag.value as { mode?: string; delivered?: boolean; sequence?: number; terminalSequence?: number }) : undefined
    const terminalFactsList = rootWorkFacts(world, 'team-root-work-delivered')
    t1 = {
      resolved,
      mode: outcome?.mode,
      delivered: outcome?.delivered,
      progressFacts: auditFactsForToken(world, 'tok-f3b-t1-progress').length,
      admittedFacts: rootWorkFacts(world, 'team-work-admitted').length,
      terminalFacts: terminalFactsList.length,
      ordering:
        outcome !== undefined &&
        terminalFactsList.length === 1 &&
        outcome.terminalSequence !== undefined &&
        outcome.sequence !== undefined
          ? outcome.terminalSequence > outcome.sequence
          : false,
      deliveryCalls: delivery.calls.length,
      workerLifecycle: memberRow(world, WORKER_ID).lifecycle,
    }
  } finally {
    await destroyP6T1World(world)
  }
}

// --- T2: the same re-entry through the direct orchestrator (the post-fix seam) ---
//
// `executeRootInitialWorkLocked` with `teamLocks` installed is the
// THREE-PHASE ORCHESTRATOR (Phase A under the chain → release → Phase B
// → Phase C re-acquired): the same N1 re-entry must resolve through it.
// Pre-fix this seam took no chain of its own (the closure owned the
// lock) and the row is vacuously green — it pins the post-fix seam.

{
  let worldRef: F3BWorld
  const delivery = createFakeRootDelivery(async () => {
    await worldRef.runtime.performAction(
      makeActionRequest({
        action: 'report-progress',
        targetInstanceId: WORKER_ID,
        requestToken: 'tok-f3b-t2-progress',
        payload: { progress: 'in-progress', summary: 'orchestrator root turn in flight' },
      }),
    )
  })
  worldRef = await createF3BWorld('f3b-t2', delivery.port)
  const { world, chains } = worldRef
  try {
    const tracked = trackAction(
      executeRootInitialWorkLocked({
        repositories: world.domain.repositories,
        now: () => P6T2_NOW,
        rootSessionId: P6T2_ROOT,
        caller: worldCaller(world),
        requestToken: 'tok-f3b-t2',
        prompt: 'f3b t2: orchestrator-seam root work',
        deliverRootWork: delivery.port,
        teamLocks: chains,
      }),
    )
    const resolved = await tracked.resolved()
    const outcome = resolved ? (tracked.flag.value as { mode?: string; delivered?: boolean; sequence?: number; terminalSequence?: number }) : undefined
    const terminalFactsList = rootWorkFacts(world, 'team-root-work-delivered')
    t2 = {
      resolved,
      mode: outcome?.mode,
      delivered: outcome?.delivered,
      progressFacts: auditFactsForToken(world, 'tok-f3b-t2-progress').length,
      admittedFacts: rootWorkFacts(world, 'team-work-admitted').length,
      terminalFacts: terminalFactsList.length,
      ordering:
        outcome !== undefined && terminalFactsList.length === 1 && outcome.sequence !== undefined
          ? outcome.terminalSequence !== undefined && outcome.terminalSequence > outcome.sequence
          : false,
      deliveryCalls: delivery.calls.length,
      workerLifecycle: memberRow(world, WORKER_ID).lifecycle,
    }
  } finally {
    await destroyP6T1World(world)
  }
}

// --- T3: concurrent mutation during the root delivery (the released chain) --------
//
// While the root initial-work delivery sits at the gate (Phase B — no
// chain post-fix), the leader reports a worker's progress (an unrelated
// same-team mutation). Pre-fix the mutation queues behind the held chain
// and hangs (RED); post-fix the chain is free and the mutation commits
// durably mid-delivery.

{
  const gate = createGate()
  let deliveryEntered = false
  const delivery = createFakeRootDelivery(async () => {
    deliveryEntered = true
    await gate.promise
  })
  const { world, admit, runtime } = await createF3BWorld('f3b-t3', delivery.port)
  try {
    const trackedOuter = trackAction(
      admit({
        rootSessionId: P6T2_ROOT,
        caller: worldCaller(world),
        requestToken: 'tok-f3b-t3',
        prompt: 'f3b t3: gated root work',
        blueprint: world.blueprint,
      }),
    )
    const entered = await pumpWhile(() => deliveryEntered)
    const trackedMutation = trackAction(
      runtime.performAction(
        makeActionRequest({
          action: 'report-progress',
          targetInstanceId: WORKER_ID,
          requestToken: 'tok-f3b-t3-mutation',
          payload: { progress: 'in-progress', summary: 'mutation during root delivery' },
        }),
      ),
    )
    const mutationResolved = await trackedMutation.resolved()
    gate.release()
    const outerResolved = await trackedOuter.resolved()
    const outcome = outerResolved ? (trackedOuter.flag.value as { mode?: string }) : undefined
    t3 = {
      deliveryEntered: entered,
      mutationResolved,
      mutationFacts: auditFactsForToken(world, 'tok-f3b-t3-mutation').length,
      outerResolved,
      outerMode: outcome?.mode,
      admittedFacts: rootWorkFacts(world, 'team-work-admitted').length,
      terminalFacts: rootWorkFacts(world, 'team-root-work-delivered').length,
      deliveryCalls: delivery.calls.length,
    }
  } finally {
    await destroyP6T1World(world)
  }
}

// --- T4: delivery fault on the shared chain (throw-after-settle + retry/replay) ---
//
// N3 on the production-shaped wiring: a delivery fault yields the typed
// WORK_DELIVERY_FAILED with the durable admission retained and NO
// terminal fact (this strategy's fail-closed writes nothing); the chain
// is not poisoned; the same-token retry redelivers and converges to the
// terminal fact WITHOUT re-admitting; the third call is a zero-delivery
// replay (at-least-once + the model-side token dedupe — plan §15.7).

{
  const delivery = createFakeRootDelivery(async () => {
    // No behavior — the fault is armed by failNext.
  })
  delivery.failNext(1)
  const { world, admit } = await createF3BWorld('f3b-t4', delivery.port)
  const caller = worldCaller(world)
  const args = {
    rootSessionId: P6T2_ROOT,
    caller,
    requestToken: 'tok-f3b-t4',
    prompt: 'f3b t4: faulted then recovered root work',
    blueprint: world.blueprint,
  }
  try {
    let faultCode = '(none)'
    try {
      await admit(args)
    } catch (error) {
      faultCode = expectCode(error, TEAM_RUNTIME_ERROR_CODES.WORK_DELIVERY_FAILED)
    }
    const faultAdmitted = rootWorkFacts(world, 'team-work-admitted').length
    const faultTerminal = rootWorkFacts(world, 'team-root-work-delivered').length

    const second = await admit(args)
    const retryAdmitted = rootWorkFacts(world, 'team-work-admitted').length
    const retryTerminal = rootWorkFacts(world, 'team-root-work-delivered').length

    const third = await admit(args)
    t4 = {
      faultCode,
      faultAdmitted,
      faultTerminal,
      retryMode: second.mode,
      retryDelivered: second.delivered,
      retryAdmitted,
      retryTerminal,
      retrySequence:
        second.sequence === only(rootWorkFacts(world, 'team-work-admitted'), 'admitted').sequence,
      replayMode: third.mode,
      replayDelivered: third.delivered,
      deliveryCalls: delivery.calls.length,
      terminalFacts: rootWorkFacts(world, 'team-root-work-delivered').length,
    }
  } finally {
    await destroyP6T1World(world)
  }
}

// --- assertions -------------------------------------------------------------------

describe('F3-B: the Root initial-work lock scope (INV-9.1 / N1, repair-r1)', () => {
  describe('T1: the N1 re-entry through the production closure (the deadlock regression)', () => {
    it('resolves: the leader team_report_progress DURING the root turn takes the shared chain (no deadlock)', () => {
      expect(t1.resolved).toBe(true)
    })
    it('settles the fresh chain: mode fresh, delivered, one admission fact + one terminal fact in durable order', () => {
      expect(t1.mode).toBe('fresh')
      expect(t1.delivered).toBe(true)
      expect(t1.admittedFacts).toBe(1)
      expect(t1.terminalFacts).toBe(1)
      expect(t1.ordering).toBe(true)
    })
    it('commits the re-entry progress fact durably (the router effect ran on the released chain)', () => {
      expect(t1.progressFacts).toBe(1)
    })
    it('delivers exactly once and leaves the worker untouched', () => {
      expect(t1.deliveryCalls).toBe(1)
      expect(t1.workerLifecycle).toBe('RUNNING')
    })
  })

  describe('T2: the same re-entry through the direct orchestrator (teamLocks installed)', () => {
    it('resolves through the three-phase orchestrator (Phase A under the chain, Phase B released, Phase C re-acquired)', () => {
      expect(t2.resolved).toBe(true)
    })
    it('settles the fresh chain with the same durable shape', () => {
      expect(t2.mode).toBe('fresh')
      expect(t2.delivered).toBe(true)
      expect(t2.admittedFacts).toBe(1)
      expect(t2.terminalFacts).toBe(1)
      expect(t2.ordering).toBe(true)
    })
    it('commits the re-entry progress fact durably and delivers exactly once', () => {
      expect(t2.progressFacts).toBe(1)
      expect(t2.deliveryCalls).toBe(1)
      expect(t2.workerLifecycle).toBe('RUNNING')
    })
  })

  describe('T3: the released chain during the ROOT TURN (concurrent mutation)', () => {
    it('runs AND commits an unrelated same-team mutation while the delivery is gated in flight', () => {
      expect(t3.deliveryEntered).toBe(true)
      expect(t3.mutationResolved).toBe(true)
      expect(t3.mutationFacts).toBe(1)
    })
    it('then settles the root initial work (one admission, one terminal, one delivery)', () => {
      expect(t3.outerResolved).toBe(true)
      expect(t3.outerMode).toBe('fresh')
      expect(t3.admittedFacts).toBe(1)
      expect(t3.terminalFacts).toBe(1)
      expect(t3.deliveryCalls).toBe(1)
    })
  })

  describe('T4: throw-after-settle + the retry/replay protocol on the shared chain (N3)', () => {
    it('surfaces the delivery fault as WORK_DELIVERY_FAILED with the admission retained and no terminal fact', () => {
      expect(t4.faultCode).toBe('TEAM_RUNTIME_WORK_DELIVERY_FAILED')
      expect(t4.faultAdmitted).toBe(1)
      expect(t4.faultTerminal).toBe(0)
    })
    it('recovers from the durable admission: the retry redelivers and converges WITHOUT re-admitting', () => {
      expect(t4.retryMode).toBe('retry')
      expect(t4.retryDelivered).toBe(true)
      expect(t4.retryAdmitted).toBe(1)
      expect(t4.retryTerminal).toBe(1)
      expect(t4.retrySequence).toBe(true)
    })
    it('is a zero-delivery replay afterwards (two deliveries total: the faulted one + the retry)', () => {
      expect(t4.replayMode).toBe('replay')
      expect(t4.replayDelivered).toBe(false)
      expect(t4.deliveryCalls).toBe(2)
      expect(t4.terminalFacts).toBe(1)
    })
  })
})
