/**
 * TCM-M3 (Team Create Minimal Fix plan §15.7 / §15.8) — the creation-time
 * Root initial-work strategy over the REAL durable world.
 *
 * Every scenario wires the production closure (`createAdmitRootInitialWork`
 * — withTeamLock → enforceCompatibilityGate → executeRootInitialWorkLocked
 * over a shared team-lock chain) against a real FileStorageSeam world
 * (real repositories, real ledger counter); only the model-visible delivery
 * port is a fake (it records the exact submit call and can fail on
 * command). The durable representation is the plan §15.7 two-fact pair
 * (the EXISTING `team-work-admitted` type carrying `targetKind: 'root'` +
 * the ONE new terminal `team-root-work-delivered`), both in the existing
 * `team` ledger category.
 *
 * Coverage:
 * - HONEST-1: a fresh admit with NO member records at all (no Leader row):
 *   the honest Leader path — zero member records created, zero
 *   `member-lifecycle-changed` facts, zero activity-interval facts;
 * - HONEST-2: same token + same payload → TERMINAL REPLAY (zero delivery,
 *   zero durable ledger writes);
 * - HONEST-3: same token + different payload → ROOT_WORK_PAYLOAD_MISMATCH
 *   (zero writes);
 * - HONEST-4: a different token → INITIAL_WORK_ALREADY_ADMITTED (the one
 *   initial-work slot is occupied);
 * - RETRY-1: a delivery fault → WORK_DELIVERY_FAILED with the durable
 *   admission retained and NO terminal fact;
 * - RETRY-2: the same-token retry redelivers and converges to the terminal
 *   fact WITHOUT re-admitting;
 * - COMPAT-1: the gate runs BEFORE the scan — a blocked environment
 *   rejects with COMPATIBILITY_BLOCKED, zero ledger facts, zero delivery;
 * - LOCK-1: two concurrent same-token admits serialize on the shared
 *   chain (exactly one admission fact; one fresh + one replay; one
 *   delivery);
 * - COLLIDE-1: a same-token `targetKind: 'root'` fact is invisible to the
 *   ORDINARY member scanner (the token-collision guard) and a member
 *   follow-up with that token runs its OWN full chain (a fresh member
 *   admission fact, no targetKind), leaving the root fact untouched;
 * - FP-1: the payload fingerprint is the stable canonical hash (empty
 *   attachedContext ≡ absent).
 *
 * House pattern of the runtime package: async world construction and
 * action execution at the TOP LEVEL (one bare block per scenario, each
 * destroyed in its finally); every `it` below asserts the captured
 * constants synchronously (the plain-node shim supports no async `it`).
 *
 * @module @dsh-agent-team/runtime/test/tcm-m3-root-initial-work
 */

import { describe, expect, it } from 'vitest'
import type { LedgerEntry } from '../../storage/schema/index.js'
import {
  commitDurableFact,
  createAdmitRootInitialWork,
  createTeamRuntime,
  computeRootWorkPayloadFingerprint,
  scanRootInitialWorkFacts,
  scanWorkUnitFacts,
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
  TeamRuntimeActionOutcome,
  WorkDeliveryPort,
} from '../admission/index.js'
import { createWorkActivityWriter } from '../activity/index.js'
import { destroyP6T1World } from './p6t1-helpers.js'
import type { P6T1World } from './p6t1-helpers.js'
import {
  P6T2_NOW,
  P6T2_ROOT,
  P6T2_SEEDS,
  createFakeLifecycleCommitPort,
  createP6T2CompatBlockedWorld,
  createP6T2World,
  leaderCaller,
  makeActionRequest,
  memberList,
} from './p6t2-helpers.js'

const WORKER_ID = String(P6T2_SEEDS.worker.instanceId)
const WORKER_CHILD = String(P6T2_SEEDS.worker.childSessionId)

// --- probes -------------------------------------------------------------------

/** The durable ledger entry count of one world. */
function ledgerCount(world: P6T1World): number {
  return world.domain.repositories.ledger.list().length
}

/** All durable Root initial-work facts (the `targetKind: 'root'` pair). */
function rootWorkFacts(world: P6T1World, factType: string): LedgerEntry[] {
  return world.domain.repositories.ledger.list().filter(
    (entry) =>
      entry.rootSessionId === P6T2_ROOT &&
      entry.factType === factType &&
      entry.payload['targetKind'] === 'root',
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

/** Narrow a thrown value to a TeamRuntimeError with exactly `code`. */
function expectCode(
  error: unknown,
  code: string,
): { readonly code: string; readonly details: Record<string, unknown> } {
  if (!isTeamRuntimeError(error) || error.code !== code) {
    throw new Error(
      `expectCode: expected TeamRuntimeError '${code}', got ${error instanceof Error ? `${error.name}: ${error.message}` : String(error)}`,
    )
  }
  return { code: error.code, details: { ...(error.details ?? {}) } }
}

/** The member row of one world (test failure when absent). */
function memberRow(world: P6T1World, instanceId: string) {
  const row = world.domain.repositories.memberInstances.get(P6T2_ROOT, instanceId)
  if (row === undefined) {
    throw new Error(`memberRow: member '${instanceId}' is absent`)
  }
  return row
}

// --- fakes ----------------------------------------------------------------------

/** The Root initial work delivery port fake (records the exact submit calls). */
interface FakeRootDelivery {
  readonly port: RootWorkDeliveryPort
  readonly calls: {
    readonly rootSessionId: string
    readonly requestToken: string
    readonly prompt: string
    readonly attachedContext?: string
  }[]
  /** Arm a failure for the next `n` deliveries (0 = never). */
  failNext(n: number): void
}

function createFakeRootDelivery(): FakeRootDelivery {
  const calls: FakeRootDelivery['calls'] = []
  let failuresLeft = 0
  const port: RootWorkDeliveryPort = {
    async deliverRootWork(input) {
      calls.push({ ...input })
      if (failuresLeft > 0) {
        failuresLeft -= 1
        throw new Error('injected root delivery fault')
      }
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

/** The member work delivery port fake (the P8-S3 shape). */
interface FakeMemberDelivery {
  readonly port: WorkDeliveryPort
  readonly calls: {
    readonly rootSessionId: string
    readonly instanceId: string
    readonly childSessionId: string
    readonly requestToken: string
    readonly prompt: string
    readonly attachedContext?: string
  }[]
}

function createFakeMemberDelivery(): FakeMemberDelivery {
  const calls: FakeMemberDelivery['calls'] = []
  const port: WorkDeliveryPort = {
    async deliver(args) {
      calls.push({ ...args })
      // v2 C1: the port now returns the frozen WorkDeliveryResult; the
      // fake produces no member body (test-neutral, result unused here).
      return {
        requestToken: args.requestToken,
        status: 'unavailable',
        error: { code: 'TEST_FAKE_NO_BODY', message: 'test fake delivery: no member body produced' },
      }
    },
  }
  return { port, calls }
}

/**
 * Build the production Root initial-work closure over one world (the plan
 * §15.8 shape: the shared team-lock chain + the real repositories + the
 * world's environment-facts port + the injected delivery port).
 */
function createRootAdmit(
  world: P6T1World,
  delivery: RootWorkDeliveryPort,
  teamLocks: Map<string, Promise<unknown>>,
) {
  return createAdmitRootInitialWork({
    teamLocks,
    repositories: world.domain.repositories,
    environmentFacts: world.ports.environmentFacts,
    now: () => P6T2_NOW,
    deliverRootWork: delivery,
  })
}

/** The resolved Leader caller of one world (the honest resolution). */
function worldCaller(world: P6T1World): ResolvedCaller {
  return resolveCaller(world.domain.repositories, P6T2_ROOT, leaderCaller())
}

// --- captured cases ---------------------------------------------------------------

/** HONEST: the fresh admit on a team with NO member records + the replay /
 *  mismatch / slot rejections over the same world. */
interface HonestCase {
  readonly mode: string
  readonly delivered: boolean
  readonly requestToken: string
  readonly fingerprint: string
  readonly sequence: number
  readonly terminalSequence: boolean
  readonly ordering: boolean
  readonly deliveryCalls: number
  readonly deliveryToken: string
  readonly deliveryPrompt: string
  readonly attachedAbsent: boolean
  readonly admittedFactCount: number
  readonly terminalFactCount: number
  readonly factToken: string
  readonly factFingerprint: boolean
  readonly factPrompt: string
  readonly factCallerRole: string
  readonly factAt: string
  readonly terminalOutcome: string
  readonly terminalFingerprint: boolean
  readonly memberRows: number
  readonly lifecycleFacts: number
  readonly activityFacts: number
  readonly replayMode: string
  readonly replayDelivered: boolean
  readonly replayLedgerDelta: number
  readonly replayDeliveryDelta: number
  readonly mismatchCode: string
  readonly mismatchLedgerDelta: number
  readonly slotCode: string
  readonly slotExistingToken: unknown
  readonly slotLedgerDelta: number
  readonly slotDeliveryDelta: number
}

/** RETRY: the delivery fault + the same-token recovery. */
interface RetryCase {
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
}

/** COMPAT: the gate before the scan. */
interface CompatCase {
  readonly code: string
  readonly ledgerFacts: number
  readonly deliveryCalls: number
}

/** LOCK: the concurrent same-token admits. */
interface LockCase {
  readonly modes: string
  readonly admittedFacts: number
  readonly terminalFacts: number
  readonly deliveryCalls: number
  readonly sameAdmittedSequence: boolean
}

/** COLLIDE: the member scanner skip + the full member chain. */
interface CollideCase {
  readonly memberScanAdmitted: boolean
  readonly memberScanSettled: boolean
  readonly rootScanAdmitted: boolean
  readonly rootScanTerminal: boolean
  readonly effectKind: string
  readonly memberAdmittedFacts: number
  readonly memberFactNoTargetKind: boolean
  readonly rootFactSequenceUnchanged: boolean
  readonly rootFactsAfter: number
  readonly deliveryCalls: number
  readonly deliveryChild: string
  readonly deliveryPrompt: string
  readonly workerLifecycle: string
}

/** CORRUPT: contradictory same-token admission/terminal fingerprints fail closed. */
interface CorruptPairCase {
  readonly requestACode: string
  readonly requestBCode: string
  readonly ledgerDelta: number
  readonly deliveryCalls: number
}

// --- scenario: HONEST (fresh + replay + mismatch + slot, zero member footprint) --

let honest: HonestCase

{
  const world = await createP6T2World('tcm-m3-honest', [])
  try {
    const delivery = createFakeRootDelivery()
    const admit = createRootAdmit(world, delivery.port, new Map())
    const caller = worldCaller(world)
    const token = 'tok-tcm-m3-honest-1'
    const prompt = 'initial work: plan the sprint scope'
    const fingerprint = computeRootWorkPayloadFingerprint(prompt)

    const fresh = await admit({
      rootSessionId: P6T2_ROOT,
      caller,
      requestToken: token,
      prompt,
      blueprint: world.blueprint,
    })

    const admittedFacts = rootWorkFacts(world, 'team-work-admitted')
    const terminalFacts = rootWorkFacts(world, 'team-root-work-delivered')
    const admitted = only(admittedFacts, 'admitted facts')
    const terminal = only(terminalFacts, 'terminal facts')

    const writesBeforeReplay = ledgerCount(world)
    const deliveriesBeforeReplay = delivery.calls.length
    const replay = await admit({
      rootSessionId: P6T2_ROOT,
      caller,
      requestToken: token,
      prompt,
      blueprint: world.blueprint,
    })

    const writesBeforeMismatch = ledgerCount(world)
    let mismatchCode = '(none)'
    try {
      await admit({
        rootSessionId: P6T2_ROOT,
        caller,
        requestToken: token,
        prompt: 'initial work: plan a DIFFERENT scope',
        blueprint: world.blueprint,
      })
    } catch (error) {
      mismatchCode = expectCode(
        error,
        TEAM_RUNTIME_ERROR_CODES.ROOT_WORK_PAYLOAD_MISMATCH,
      ).code
    }

    const writesBeforeSlot = ledgerCount(world)
    const deliveriesBeforeSlot = delivery.calls.length
    let slotCode = '(none)'
    let slotDetails: Record<string, unknown> = {}
    try {
      await admit({
        rootSessionId: P6T2_ROOT,
        caller,
        requestToken: 'tok-tcm-m3-honest-other',
        prompt: 'a fresh operation under a new token',
        blueprint: world.blueprint,
      })
    } catch (error) {
      const checked = expectCode(
        error,
        TEAM_RUNTIME_ERROR_CODES.INITIAL_WORK_ALREADY_ADMITTED,
      )
      slotCode = checked.code
      slotDetails = checked.details
    }

    honest = {
      mode: fresh.mode,
      delivered: fresh.delivered,
      requestToken: fresh.requestToken,
      fingerprint: fresh.payloadFingerprint,
      sequence: fresh.sequence,
      terminalSequence: fresh.terminalSequence > fresh.sequence,
      ordering: terminal.sequence > admitted.sequence,
      deliveryCalls: delivery.calls.length,
      deliveryToken: delivery.calls[0]?.requestToken ?? '(none)',
      deliveryPrompt: delivery.calls[0]?.prompt ?? '(none)',
      attachedAbsent: delivery.calls[0]?.attachedContext === undefined,
      admittedFactCount: admittedFacts.length,
      terminalFactCount: terminalFacts.length,
      factToken: String(admitted.payload['requestToken'] ?? ''),
      factFingerprint: admitted.payload['payloadFingerprint'] === fingerprint,
      factPrompt: String(admitted.payload['prompt'] ?? ''),
      factCallerRole: String((admitted.payload['caller'] as { role?: string })?.role ?? ''),
      factAt: String(admitted.payload['at'] ?? ''),
      terminalOutcome: String(terminal.payload['workOutcome'] ?? ''),
      terminalFingerprint: terminal.payload['payloadFingerprint'] === fingerprint,
      memberRows: memberList(world).length,
      lifecycleFacts: world.domain.repositories.ledger
        .list()
        .filter((entry) => entry.factType === 'member-lifecycle-changed').length,
      activityFacts: world.domain.repositories.ledger
        .list()
        .filter((entry) =>
          entry.factType === 'activity-interval-opened' ||
          entry.factType === 'activity-interval-closed',
        ).length,
      replayMode: replay.mode,
      replayDelivered: replay.delivered,
      replayLedgerDelta: ledgerCount(world) - writesBeforeReplay,
      replayDeliveryDelta: delivery.calls.length - deliveriesBeforeReplay,
      mismatchCode,
      mismatchLedgerDelta: ledgerCount(world) - writesBeforeMismatch,
      slotCode,
      slotExistingToken: slotDetails['existingToken'],
      slotLedgerDelta: ledgerCount(world) - writesBeforeSlot,
      slotDeliveryDelta: delivery.calls.length - deliveriesBeforeSlot,
    }
  } finally {
    await destroyP6T1World(world)
  }
}

// --- scenario: RETRY (delivery fault → admitted-only retry → replay) -------------

let retry: RetryCase

{
  const world = await createP6T2World('tcm-m3-retry', [])
  try {
    const delivery = createFakeRootDelivery()
    delivery.failNext(1)
    const admit = createRootAdmit(world, delivery.port, new Map())
    const caller = worldCaller(world)
    const token = 'tok-tcm-m3-retry-1'
    const prompt = 'retry me: initialize the workspace'

    let faultCode = '(none)'
    try {
      await admit({
        rootSessionId: P6T2_ROOT,
        caller,
        requestToken: token,
        prompt,
        blueprint: world.blueprint,
      })
    } catch (error) {
      faultCode = expectCode(error, TEAM_RUNTIME_ERROR_CODES.WORK_DELIVERY_FAILED).code
    }
    const faultAdmitted = rootWorkFacts(world, 'team-work-admitted').length
    const faultTerminal = rootWorkFacts(world, 'team-root-work-delivered').length

    const second = await admit({
      rootSessionId: P6T2_ROOT,
      caller,
      requestToken: token,
      prompt,
      blueprint: world.blueprint,
    })
    const retryAdmitted = rootWorkFacts(world, 'team-work-admitted').length
    const retryTerminal = rootWorkFacts(world, 'team-root-work-delivered').length

    const third = await admit({
      rootSessionId: P6T2_ROOT,
      caller,
      requestToken: token,
      prompt,
      blueprint: world.blueprint,
    })

    retry = {
      faultCode,
      faultAdmitted,
      faultTerminal,
      retryMode: second.mode,
      retryDelivered: second.delivered,
      retryAdmitted,
      retryTerminal,
      retrySequence: second.sequence === only(rootWorkFacts(world, 'team-work-admitted'), 'admitted').sequence,
      replayMode: third.mode,
      replayDelivered: third.delivered,
      deliveryCalls: delivery.calls.length,
    }
  } finally {
    await destroyP6T1World(world)
  }
}

// --- scenario: COMPAT (the gate runs before the scan) ----------------------------

let compat: CompatCase

{
  const world = await createP6T2CompatBlockedWorld('tcm-m3-compat', [])
  try {
    const delivery = createFakeRootDelivery()
    const admit = createRootAdmit(world, delivery.port, new Map())
    const caller = worldCaller(world)
    let code = '(none)'
    try {
      await admit({
        rootSessionId: P6T2_ROOT,
        caller,
        requestToken: 'tok-tcm-m3-compat-1',
        prompt: 'never admitted: blocked environment',
        blueprint: world.blueprint,
      })
    } catch (error) {
      code = expectCode(error, TEAM_RUNTIME_ERROR_CODES.COMPATIBILITY_BLOCKED).code
    }
    compat = {
      code,
      ledgerFacts: ledgerCount(world),
      deliveryCalls: delivery.calls.length,
    }
  } finally {
    await destroyP6T1World(world)
  }
}

// --- scenario: LOCK (concurrent same-token admits serialize) ----------------------

let lock: LockCase

{
  const world = await createP6T2World('tcm-m3-lock', [])
  try {
    const delivery = createFakeRootDelivery()
    const admit = createRootAdmit(world, delivery.port, new Map())
    const caller = worldCaller(world)
    const args = {
      rootSessionId: P6T2_ROOT,
      caller,
      requestToken: 'tok-tcm-m3-lock-1',
      prompt: 'concurrent same-token admits',
      blueprint: world.blueprint,
    }
    const [first, second] = await Promise.all([admit(args), admit(args)])
    const admittedFacts = rootWorkFacts(world, 'team-work-admitted')
    lock = {
      modes: [first.mode, second.mode].sort().join('+'),
      admittedFacts: admittedFacts.length,
      terminalFacts: rootWorkFacts(world, 'team-root-work-delivered').length,
      deliveryCalls: delivery.calls.length,
      sameAdmittedSequence:
        first.sequence === second.sequence &&
        first.sequence === admittedFacts[0]?.sequence,
    }
  } finally {
    await destroyP6T1World(world)
  }
}

// --- scenario: COLLIDE (the member scanner skips the root facts) ------------------

let collide: CollideCase

{
  const world = await createP6T2World('tcm-m3-collide', ['leader', 'worker'])
  try {
    const token = 'tok-tcm-m3-collide-1'
    // Seed the durable Root initial-work admission fact (a crashed fresh
    // admit: the admission committed, the delivery never ran).
    await commitDurableFact(
      world.domain.repositories,
      P6T2_ROOT,
      () => P6T2_NOW,
      'team-work-admitted',
      {
        targetKind: 'root',
        rootSessionId: P6T2_ROOT,
        requestToken: token,
        payloadFingerprint: computeRootWorkPayloadFingerprint('root work prompt'),
        prompt: 'root work prompt',
        caller: { kind: 'instance', role: 'leader' },
        at: P6T2_NOW,
      },
    )
    const seededRootFact = only(
      world.domain.repositories.ledger
        .list()
        .filter(
          (entry) =>
            entry.factType === 'team-work-admitted' &&
            entry.payload['targetKind'] === 'root' &&
            entry.payload['requestToken'] === token,
        ),
      'seeded root fact',
    )

    // The ORDINARY member scanner must not see the root fact as its own
    // admission (the token-collision guard).
    const memberScan = scanWorkUnitFacts(world.domain.repositories, P6T2_ROOT, token)
    const rootScan = scanRootInitialWorkFacts(world.domain.repositories, P6T2_ROOT, token)

    // The full member chain runs over the SAME token: it must execute its
    // OWN fresh chain (a member admission fact with no targetKind), not
    // resume the root fact.
    const memberDelivery = createFakeMemberDelivery()
    const runtime: TeamRuntime = createTeamRuntime({
      teamDomain: world.domain,
      activationProvider: world.provider,
      blueprintCatalog: world.catalog,
      environmentFacts: world.ports.environmentFacts,
      externalPolicyFacts: world.ports.externalPolicyFacts,
      now: () => P6T2_NOW,
      lifecycleCommit: createFakeLifecycleCommitPort(world),
      workDelivery: memberDelivery.port,
      workActivity: createWorkActivityWriter({ teamDomain: world.domain, now: () => P6T2_NOW }),
    })
    const outcome: TeamRuntimeActionOutcome = await runtime.performAction(
      makeActionRequest({
        targetInstanceId: WORKER_ID,
        requestToken: token,
        payload: { prompt: 'member work prompt (same token, member chain)' },
      }),
    )
    const effect = outcome.effect
    const memberAdmittedFacts = world.domain.repositories.ledger
      .list()
      .filter(
        (entry) =>
          entry.factType === 'team-work-admitted' &&
          entry.payload['requestToken'] === token &&
          entry.payload['targetKind'] !== 'root',
      )
    const rootFactsAfter = world.domain.repositories.ledger
      .list()
      .filter(
        (entry) =>
          entry.factType === 'team-work-admitted' &&
          entry.payload['targetKind'] === 'root' &&
          entry.payload['requestToken'] === token,
      )

    collide = {
      memberScanAdmitted: memberScan.admitted === undefined,
      memberScanSettled: memberScan.settled === undefined,
      rootScanAdmitted: rootScan.admitted !== undefined,
      rootScanTerminal: rootScan.terminal === undefined,
      effectKind: effect.kind,
      memberAdmittedFacts: memberAdmittedFacts.length,
      memberFactNoTargetKind:
        memberAdmittedFacts[0]?.payload['targetKind'] === undefined &&
        memberAdmittedFacts[0]?.payload['targetInstanceId'] === WORKER_ID,
      rootFactSequenceUnchanged:
        rootFactsAfter.length === 1 && rootFactsAfter[0]?.sequence === seededRootFact.sequence,
      rootFactsAfter: rootFactsAfter.length,
      deliveryCalls: memberDelivery.calls.length,
      deliveryChild: memberDelivery.calls[0]?.childSessionId ?? '(none)',
      deliveryPrompt: memberDelivery.calls[0]?.prompt ?? '(none)',
      workerLifecycle: memberRow(world, WORKER_ID).lifecycle,
    }
  } finally {
    await destroyP6T1World(world)
  }
}

// --- scenario: CORRUPT (same token, contradictory admission/terminal pair) ---------

let corruptPair: CorruptPairCase

{
  const world = await createP6T2World('tcm-m3-corrupt-pair', ['leader'])
  try {
    const delivery = createFakeRootDelivery()
    const token = 'tok-tcm-m3-corrupt-pair-1'
    await commitDurableFact(world.domain.repositories, P6T2_ROOT, () => P6T2_NOW, 'team-work-admitted', {
      targetKind: 'root',
      rootSessionId: P6T2_ROOT,
      requestToken: token,
      payloadFingerprint: computeRootWorkPayloadFingerprint('payload A'),
      prompt: 'payload A',
      caller: { kind: 'instance', role: 'leader' },
      at: P6T2_NOW,
    })
    await commitDurableFact(world.domain.repositories, P6T2_ROOT, () => P6T2_NOW, 'team-root-work-delivered', {
      targetKind: 'root',
      rootSessionId: P6T2_ROOT,
      requestToken: token,
      payloadFingerprint: computeRootWorkPayloadFingerprint('payload B'),
      workOutcome: 'delivered',
      at: P6T2_NOW,
    })
    const admit = createRootAdmit(world, delivery.port, new Map())
    const before = ledgerCount(world)
    let requestACode = '(none)'
    let requestBCode = '(none)'
    try {
      await admit({ rootSessionId: P6T2_ROOT, caller: worldCaller(world), requestToken: token, prompt: 'payload A', blueprint: world.blueprint })
    } catch (error) {
      requestACode = expectCode(error, 'TEAM_RUNTIME_ROOT_WORK_PAYLOAD_MISMATCH').code
    }
    try {
      await admit({ rootSessionId: P6T2_ROOT, caller: worldCaller(world), requestToken: token, prompt: 'payload B', blueprint: world.blueprint })
    } catch (error) {
      requestBCode = expectCode(error, 'TEAM_RUNTIME_ROOT_WORK_PAYLOAD_MISMATCH').code
    }
    corruptPair = {
      requestACode,
      requestBCode,
      ledgerDelta: ledgerCount(world) - before,
      deliveryCalls: delivery.calls.length,
    }
  } finally {
    await destroyP6T1World(world)
  }
}

// --- assertions -------------------------------------------------------------------

describe('TCM-M3: the creation-time Root initial-work strategy (plan §15.7/§15.8)', () => {
  describe('honest Leader (no member records, no lifecycle, no activity)', () => {
    it('runs the fresh chain: admission first, then delivery, then the terminal fact', () => {
      expect(honest.mode).toBe('fresh')
      expect(honest.delivered).toBe(true)
      expect(honest.requestToken).toBe('tok-tcm-m3-honest-1')
      expect(honest.fingerprint).toBe(computeRootWorkPayloadFingerprint('initial work: plan the sprint scope'))
      expect(honest.terminalSequence).toBe(true)
      expect(honest.ordering).toBe(true)
    })
    it('delivers the token + prompt through the port (no attached-context block when absent)', () => {
      expect(honest.deliveryCalls).toBe(1)
      expect(honest.deliveryToken).toBe('tok-tcm-m3-honest-1')
      expect(honest.deliveryPrompt).toBe('initial work: plan the sprint scope')
      expect(honest.attachedAbsent).toBe(true)
    })
    it('writes the two-fact pair with the plan §15.7 payload shape (the team category facts)', () => {
      expect(honest.admittedFactCount).toBe(1)
      expect(honest.terminalFactCount).toBe(1)
      expect(honest.factToken).toBe('tok-tcm-m3-honest-1')
      expect(honest.factFingerprint).toBe(true)
      expect(honest.factPrompt).toBe('initial work: plan the sprint scope')
      expect(honest.factCallerRole).toBe('leader')
      expect(honest.factAt).toBe(P6T2_NOW)
      expect(honest.terminalOutcome).toBe('delivered')
      expect(honest.terminalFingerprint).toBe(true)
    })
    it('creates NO member record, NO lifecycle fact, NO activity fact (the honest Leader)', () => {
      expect(honest.memberRows).toBe(0)
      expect(honest.lifecycleFacts).toBe(0)
      expect(honest.activityFacts).toBe(0)
    })
    it('replays a same-token same-payload call with zero delivery and zero durable writes', () => {
      expect(honest.replayMode).toBe('replay')
      expect(honest.replayDelivered).toBe(false)
      expect(honest.replayLedgerDelta).toBe(0)
      expect(honest.replayDeliveryDelta).toBe(0)
    })
    it('rejects a same-token different-payload call with the typed mismatch (zero writes)', () => {
      expect(honest.mismatchCode).toBe('TEAM_RUNTIME_ROOT_WORK_PAYLOAD_MISMATCH')
      expect(honest.mismatchLedgerDelta).toBe(0)
    })
    it('rejects a different-token call with the typed slot rejection (zero writes)', () => {
      expect(honest.slotCode).toBe('TEAM_RUNTIME_INITIAL_WORK_ALREADY_ADMITTED')
      expect(honest.slotExistingToken).toBe('tok-tcm-m3-honest-1')
      expect(honest.slotLedgerDelta).toBe(0)
      expect(honest.slotDeliveryDelta).toBe(0)
    })
  })

  describe('the admitted-only retry (the crash window between admission and terminal)', () => {
    it('surfaces the delivery fault as WORK_DELIVERY_FAILED with the admission retained and no terminal fact', () => {
      expect(retry.faultCode).toBe('TEAM_RUNTIME_WORK_DELIVERY_FAILED')
      expect(retry.faultAdmitted).toBe(1)
      expect(retry.faultTerminal).toBe(0)
    })
    it('recovers from the durable admission: the retry redelivers and converges WITHOUT re-admitting', () => {
      expect(retry.retryMode).toBe('retry')
      expect(retry.retryDelivered).toBe(true)
      expect(retry.retryAdmitted).toBe(1)
      expect(retry.retryTerminal).toBe(1)
      expect(retry.retrySequence).toBe(true)
    })
    it('is a zero-delivery replay afterwards (two deliveries total: the faulted one + the retry)', () => {
      expect(retry.replayMode).toBe('replay')
      expect(retry.replayDelivered).toBe(false)
      expect(retry.deliveryCalls).toBe(2)
    })
  })

  describe('the compatibility gate (the existing single compatibility authority)', () => {
    it('rejects before the scan: a blocked environment is COMPATIBILITY_BLOCKED with zero facts and zero delivery', () => {
      expect(compat.code).toBe('TEAM_RUNTIME_COMPATIBILITY_BLOCKED')
      expect(compat.ledgerFacts).toBe(0)
      expect(compat.deliveryCalls).toBe(0)
    })
  })

  describe('the shared team-lock chain (the plan §15.8 closure lock)', () => {
    it('serializes concurrent same-token admits: one admission fact, one fresh + one replay, one delivery', () => {
      expect(lock.modes).toBe('fresh+replay')
      expect(lock.admittedFacts).toBe(1)
      expect(lock.terminalFacts).toBe(1)
      expect(lock.deliveryCalls).toBe(1)
      expect(lock.sameAdmittedSequence).toBe(true)
    })
  })

  describe('corrupt durable pair fails closed', () => {
    it('rejects requests matching either contradictory fingerprint with zero effects', () => {
      expect(corruptPair.requestACode).toBe('TEAM_RUNTIME_ROOT_WORK_PAYLOAD_MISMATCH')
      expect(corruptPair.requestBCode).toBe('TEAM_RUNTIME_ROOT_WORK_PAYLOAD_MISMATCH')
      expect(corruptPair.ledgerDelta).toBe(0)
      expect(corruptPair.deliveryCalls).toBe(0)
    })
  })

  describe('the token-collision guard (the ordinary member scanner skips the root facts)', () => {
    it('does not see a same-token root fact as a member admission (the direct scan)', () => {
      expect(collide.memberScanAdmitted).toBe(true)
      expect(collide.memberScanSettled).toBe(true)
    })
    it('sees the same fact as its own admission (the root scan)', () => {
      expect(collide.rootScanAdmitted).toBe(true)
      expect(collide.rootScanTerminal).toBe(true)
    })
    it('runs the member chain as a FRESH chain over the same token (its own admission fact, no targetKind)', () => {
      expect(collide.effectKind).toBe('work-admitted')
      expect(collide.memberAdmittedFacts).toBe(1)
      expect(collide.memberFactNoTargetKind).toBe(true)
    })
    it('leaves the root fact untouched and settles the worker', () => {
      expect(collide.rootFactSequenceUnchanged).toBe(true)
      expect(collide.rootFactsAfter).toBe(1)
      expect(collide.deliveryCalls).toBe(1)
      expect(collide.deliveryChild).toBe(WORKER_CHILD)
      expect(collide.deliveryPrompt).toBe('member work prompt (same token, member chain)')
      expect(collide.workerLifecycle).toBe('SETTLED')
    })
  })

  describe('the payload fingerprint (the canonical content hash)', () => {
    it('is stable per content, distinct per change, and treats an empty attached-context as absent', () => {
      const fpA = computeRootWorkPayloadFingerprint('prompt A')
      expect(fpA).toBe(computeRootWorkPayloadFingerprint('prompt A'))
      expect(fpA).not.toBe(computeRootWorkPayloadFingerprint('prompt B'))
      expect(fpA.slice(0, 7)).toBe('sha256:')
      expect(computeRootWorkPayloadFingerprint('prompt A', '')).toBe(
        computeRootWorkPayloadFingerprint('prompt A'),
      )
      expect(computeRootWorkPayloadFingerprint('prompt A', 'ctx')).not.toBe(fpA)
      expect(computeRootWorkPayloadFingerprint('prompt A', 'ctx')).toBe(
        computeRootWorkPayloadFingerprint('prompt A', 'ctx'),
      )
    })
  })
})
