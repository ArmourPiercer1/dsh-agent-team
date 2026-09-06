/**
 * P8-S3 — the work execution chain over the REAL durable world (closure
 * plan §16.2, R1–R6; the package-level half of W1–W9).
 *
 * Every scenario wires the FULL production chain through `createTeamRuntime`
 * (lifecycle commit port + work delivery port + the in-facade work
 * activity writer) and drives it with `performAction` — the same entry
 * point the tools layer uses. Durable state is REAL (FileStorageSeam
 * world, real repositories, real CAS); only the model-visible delivery
 * port is a fake (it records the exact submit call and can fail on
 * command), and the lifecycle commit port is the repo-backed test fake
 * (the same CAS the production port delegates to).
 *
 * Coverage:
 * - R3: work admission fails closed without the lifecycle commit port
 *   (zero writes); a partial port install never runs the chain;
 * - W4: a failed delivery settles fail-closed (no fake RUNNING; the
 *   settlement fact carries `workOutcome: 'delivery-failed'`);
 * - W6: the work unit opens and closes its activity interval (subject
 *   `work-unit`, correlation = requestToken, the in-facade writer's
 *   `team-runtime` reporter);
 * - W9: a same-token retry is a durable REPLAY (zero writes, zero
 *   re-delivery, no duplicate member/child session) while a distinct
 *   token still executes a fresh work unit;
 * - resume: a pre-seeded admission fact (the crash window between
 *   admission and settlement) redelivers exactly once and converges to
 *   SETTLED without re-admitting;
 * - R1 (package-level vertical): a delegate-create runs the full chain
 *   on the NEW instance and leaves it durably SETTLED;
 * - R2: the delivered prompt is the explicit request prompt (no default
 *   transcript inheritance), with the explicit attachedContext when
 *   provided.
 * - C1 (v2 D2 frozen contract, work-execution level): the chain carries
 *   the WorkDeliveryPort's minimal member result (WorkDeliveryResult) —
 *   succeeded with the business body / failed with a stable code+message /
 *   unavailable, the requestToken echoed verbatim, and `settled` (control
 *   plane) staying separate from the business status; a replay of an
 *   already-settled token synthesizes the SAME explicit
 *   unavailable/WORK_REPLAYED result (no re-delivery, no re-report, zero
 *   durable writes); a resume carries the fresh this-attempt result.
 *
 * House pattern of the runtime package: async world construction and
 * action execution at the TOP LEVEL (one bare block per scenario, each
 * destroyed in its finally); every `it` below asserts the captured
 * constants synchronously (the plain-node shim supports no async `it`).
 *
 * @module @dsh-agent-team/runtime/test/p8s3-work-chain
 */

import { describe, expect, it } from 'vitest'
import type { LedgerEntry } from '../../storage/schema/index.js'
import { createTeamRuntime, executeWorkChain } from '../action-router/index.js'
import { TEAM_RUNTIME_ERROR_CODES } from '../admission/index.js'
import type {
  ResolvedCaller,
  RuntimeActionEffect,
  TeamRuntime,
  TeamRuntimeActionOutcome,
  WorkDeliveryPort,
  WorkDeliveryResult,
} from '../admission/index.js'
import { createWorkActivityWriter } from '../activity/index.js'
import { destroyP6T1World } from './p6t1-helpers.js'
import type { P6T1World } from './p6t1-helpers.js'
import {
  P6T2_NOW,
  P6T2_ROOT,
  P6T2_SEEDS,
  createFakeLifecycleCommitPort,
  createP6T2World,
  expectRejection,
  leaderCaller,
  makeActionRequest,
  memberList,
  p6t2Seed,
} from './p6t2-helpers.js'

const WORKER_ID = String(P6T2_SEEDS.worker.instanceId)
const WORKER_CHILD = String(P6T2_SEEDS.worker.childSessionId)

// --- probes -------------------------------------------------------------------

/** All durable ledger facts of one type (deterministic order). */
function ledgerFacts(world: P6T1World, factType: string): LedgerEntry[] {
  return world.domain.repositories.ledger.list().filter(
    (entry) => entry.factType === factType,
  )
}

/** Find one durable fact by type + exact payload-field match. */
function findFact(
  world: P6T1World,
  factType: string,
  match: Record<string, unknown>,
): LedgerEntry {
  const found = ledgerFacts(world, factType).find((entry) =>
    Object.entries(match).every(
      ([key, value]) => entry.payload[key] === value,
    ),
  )
  if (found === undefined) {
    throw new Error(`findFact: no ${factType} fact matches ${JSON.stringify(match)}`)
  }
  return found
}

/** Narrow an executed outcome's effect to `work-admitted` (test failure otherwise). */
function asWorkAdmitted(outcome: TeamRuntimeActionOutcome): Extract<RuntimeActionEffect, { readonly kind: 'work-admitted' }> {
  const effect = outcome.effect
  if (effect.kind !== 'work-admitted') {
    throw new Error(`asWorkAdmitted: expected work-admitted, got ${effect.kind}`)
  }
  return effect
}

/** Narrow an executed outcome's effect to `member-activated` (test failure otherwise). */
function asMemberActivated(outcome: TeamRuntimeActionOutcome): Extract<RuntimeActionEffect, { readonly kind: 'member-activated' }> {
  const effect = outcome.effect
  if (effect.kind !== 'member-activated') {
    throw new Error(`asMemberActivated: expected member-activated, got ${effect.kind}`)
  }
  return effect
}

/** The n-th element of a list (test failure when out of range). */
function at<T>(list: readonly T[], index: number, label: string): T {
  const item = list[index]
  if (item === undefined) {
    throw new Error(`at(${label}, ${index}): list has ${list.length} entries`)
  }
  return item
}

/** The single element of a filtered single-entry list (test failure otherwise). */
function only<T>(list: readonly T[], label: string): T {
  return at(list, 0, label)
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

/** The model-visible delivery port fake (records the exact submit calls
 *  and returns the armed WorkDeliveryResult — the v2 C1 frozen shape). */
interface FakeDeliveryPort {
  readonly port: WorkDeliveryPort
  readonly calls: {
    readonly rootSessionId: string
    readonly instanceId: string
    readonly childSessionId: string
    readonly requestToken: string
    readonly prompt: string
    readonly attachedContext?: string
  }[]
  /** Arm a failure for every subsequent delivery (R6/W4). */
  setFailure(message: string): void
  /** Arm the exact result the next successful delivery returns (default:
   *  a succeeded result with a deterministic business body). */
  armResult(result: WorkDeliveryResult): void
}

function createFakeDeliveryPort(): FakeDeliveryPort {
  const calls: FakeDeliveryPort['calls'] = []
  let failMessage: string | undefined
  let armed: WorkDeliveryResult | undefined
  const port: WorkDeliveryPort = {
    async deliver(args) {
      calls.push({ ...args })
      if (failMessage !== undefined) {
        throw new Error(failMessage)
      }
      return (
        armed ?? {
          requestToken: args.requestToken,
          status: 'succeeded',
          body: 'fake member business body',
        }
      )
    },
  }
  return {
    port,
    calls,
    setFailure(message: string) {
      failMessage = message
    },
    armResult(result: WorkDeliveryResult) {
      armed = result
    },
  }
}

/**
 * Build the FULL P8-S3 production wiring over one world (the real
 * repositories + the repo-backed CAS commit port + the in-facade work
 * activity writer + one delivery port). `lifecycleCommit` overrides the
 * default repo-backed port (absent for the R3 fail-closed cases).
 */
function createWorkChainRuntime(
  world: P6T1World,
  delivery: WorkDeliveryPort,
  options: { readonly lifecycleCommit?: import('../admission/index.js').LifecycleCommitPort } = {},
): TeamRuntime {
  return createTeamRuntime({
    teamDomain: world.domain,
    activationProvider: world.provider,
    blueprintCatalog: world.catalog,
    environmentFacts: world.ports.environmentFacts,
    externalPolicyFacts: world.ports.externalPolicyFacts,
    now: () => P6T2_NOW,
    lifecycleCommit:
      options.lifecycleCommit ?? createFakeLifecycleCommitPort(world),
    workDelivery: delivery,
    workActivity: createWorkActivityWriter({ teamDomain: world.domain, now: () => P6T2_NOW }),
  })
}

/**
 * Execute one work chain directly at the work-execution seam (the v2 C1
 * contract level — the result contract is pinned on `executeWorkChain`'s
 * own outcome, before the effect mapping that C2 owns). The chain takes no
 * lock of its own; the scenarios run single-threaded per world, so calling
 * it outside the router is the honest work-execution-level seam.
 */
function runChainDirect(
  world: P6T1World,
  delivery: WorkDeliveryPort,
  requestToken: string,
  prompt: string,
) {
  const leaderRow = world.domain.repositories.memberInstances.get(P6T2_ROOT, 'inst-leader')
  if (leaderRow === undefined) {
    throw new Error('runChainDirect: the leader seed row is missing')
  }
  const caller: ResolvedCaller = { role: 'leader', callerMember: leaderRow }
  return executeWorkChain({
    repositories: world.domain.repositories,
    lifecycleCommit: createFakeLifecycleCommitPort(world),
    workDelivery: delivery,
    workActivity: createWorkActivityWriter({ teamDomain: world.domain, now: () => P6T2_NOW }),
    now: () => P6T2_NOW,
    rootSessionId: P6T2_ROOT,
    instanceId: WORKER_ID,
    action: 'follow-up',
    caller,
    requestToken,
    prompt,
  })
}

// --- captured cases (house pattern: top-level execution, sync assertions) -------

/** R3a: the fail-closed evidence path (no lifecycle commit port installed;
 *  the target is SETTLED so the CREATED/SETTLED -> RUNNING transition is
 *  REQUIRED and its absence fails closed). */
interface R3aCase {
  readonly code: string
  readonly newFacts: number
  readonly deliveries: number
  readonly workerLifecycle: string
}

/** R3b: a partial port install (commit port only) never runs the chain. */
interface R3bCase {
  readonly instanceId: string
  readonly settledAbsent: boolean
  readonly replayedAbsent: boolean
  readonly deliveries: number
  readonly intervalOpens: number
  readonly intervalCloses: number
}

/** W4: a failed delivery settles fail-closed (no fake RUNNING). */
interface W4Case {
  readonly code: string
  readonly lifecycle: string
  readonly activityVersion: number
  readonly commits: readonly (readonly [string, string])[]
  readonly detailInstance: unknown
  readonly detailChild: unknown
  readonly detailToken: unknown
  readonly detailCause: unknown
  readonly admittedPrompt: unknown
  readonly settledFrom: unknown
  readonly settledOutcome: unknown
  readonly settledFailure: unknown
  readonly intervalOpens: number
  readonly intervalCloses: number
}

/** W6: the work-unit activity interval opens and closes around delivery. */
interface W6Case {
  readonly settled: boolean | undefined
  readonly settledSequence: number | undefined
  readonly openCount: number
  readonly closeCount: number
  readonly openSubject: unknown
  readonly openSequence: unknown
  readonly openProgress: unknown
  readonly openReporter: unknown
  readonly openInstance: unknown
  readonly closeSubject: unknown
  readonly closeSequence: unknown
  readonly closeProgress: unknown
  readonly closeAfterOpen: boolean
}

/** W9: same-token retry = durable replay; distinct token still executes. */
interface W9Case {
  readonly e1Instance: string
  readonly e1Settled: boolean | undefined
  readonly e1NotReplayed: boolean
  readonly e1Sequence: number
  readonly e2Instance: string
  readonly e2Replayed: boolean | undefined
  readonly e2Settled: boolean | undefined
  readonly sameSequence: boolean
  readonly ledgerUnchanged: boolean
  readonly deliveriesAfterRetry: number
  readonly members: number
  readonly childUnchanged: boolean
  readonly e3NotReplayed: boolean
  readonly e3Settled: boolean | undefined
  readonly e3SequenceAdvanced: boolean
  readonly deliveriesTotal: number
  readonly thirdPrompt: string
}

/** Resume: the crash window (admission fact committed, settlement lost). */
interface ResumeCase {
  readonly instanceId: string
  readonly lifecycleCommitted: boolean
  readonly sameAdmissionSequence: boolean
  readonly settled: boolean | undefined
  readonly deliveries: number
  readonly redeliveredPrompt: string
  readonly admissionFactCount: number
  readonly settledFrom: unknown
  readonly workOutcome: unknown
  readonly rowLifecycle: string
}

/** R1 vertical: a delegate-create runs the full chain on the new instance. */
interface DelegateCase {
  readonly instanceId: string
  readonly childSessionId: string
  readonly workSettled: boolean | undefined
  readonly workSequencePositive: boolean
  readonly deliveries: number
  readonly deliveredInstance: string
  readonly deliveredChild: string
  readonly deliveredToken: string
  readonly deliveredPrompt: string
  readonly rowLifecycle: string
  readonly rowChildMatches: boolean
  readonly members: number
  readonly openCount: number
  readonly openOnInstance: boolean
  readonly settledFrom: unknown
}

/** R2: the explicit request prompt/context is what the model sees. */
interface R2Case {
  readonly deliveries: number
  readonly prompt: string
  readonly attached: string | undefined
  readonly token: string
  readonly factPrompt: unknown
  readonly factAttached: unknown
}

/** C1-S1: full mode carries the port's succeeded result (token verbatim). */
interface C1S1Case {
  readonly mode: string
  readonly settled: boolean
  readonly status: string | undefined
  readonly body: string | undefined
  readonly errorAbsent: boolean
  readonly token: string | undefined
  readonly deliveries: number
}

/** C1-S2: failed/unavailable mapping; settled never implies succeeded. */
interface C1S2Case {
  readonly failedMode: string
  readonly failedSettled: boolean
  readonly failedStatus: string | undefined
  readonly failedCode: string | undefined
  readonly failedMessage: string | undefined
  readonly failedBody: string | undefined
  readonly failedToken: string | undefined
  readonly unavailableMode: string
  readonly unavailableSettled: boolean
  readonly unavailableStatus: string | undefined
  readonly unavailableCode: string | undefined
  readonly unavailableBody: string | undefined
  readonly unavailableToken: string | undefined
}

/** C1-S3: replay = the SAME synthesized result, exactly once, zero writes. */
interface C1S3Case {
  readonly firstMode: string
  readonly firstStatus: string | undefined
  readonly firstBody: string | undefined
  readonly secondMode: string
  readonly secondSettled: boolean
  readonly secondResult: WorkDeliveryResult | undefined
  readonly thirdResult: WorkDeliveryResult | undefined
  readonly secondHasNoBody: boolean
  readonly deliveries: number
  readonly ledgerUnchangedOnReplay: boolean
  readonly ledgerUnchangedOnReplay2: boolean
  readonly sameSequence: boolean
}

/** C1-S4: resume mode carries the fresh this-attempt result. */
interface C1S4Case {
  readonly mode: string
  readonly settled: boolean
  readonly status: string | undefined
  readonly code: string | undefined
  readonly token: string | undefined
  readonly sameAdmissionSequence: boolean
  readonly deliveries: number
}

let r3a: R3aCase
let r3b: R3bCase
let w4: W4Case
let w6: W6Case
let w9: W9Case
let resume: ResumeCase
let delegate: DelegateCase
let r2: R2Case
let c1s1: C1S1Case
let c1s2: C1S2Case
let c1s3: C1S3Case
let c1s4: C1S4Case

// --- scenario: R3a (no lifecycle commit port) -----------------------------------

{
  const world = await createP6T2World('p8s3wc-r3a', ['leader'], {
    seedMembers: [p6t2Seed('worker', { lifecycle: 'SETTLED' })],
  })
  try {
    const delivery = createFakeDeliveryPort()
    // the full chain EXCEPT the lifecycle commit port: the guard falls
    // back to the P6-T2 evidence path, where the SETTLED target REQUIRES
    // the CREATED/SETTLED -> RUNNING commit — absent port fails closed
    const runtime = createTeamRuntime({
      teamDomain: world.domain,
      activationProvider: world.provider,
      blueprintCatalog: world.catalog,
      environmentFacts: world.ports.environmentFacts,
      externalPolicyFacts: world.ports.externalPolicyFacts,
      now: () => P6T2_NOW,
      workDelivery: delivery.port,
      workActivity: createWorkActivityWriter({ teamDomain: world.domain, now: () => P6T2_NOW }),
    })
    const baseline = world.domain.repositories.ledger.list().length
    const rejection = await expectRejection(
      runtime,
      makeActionRequest({
        targetInstanceId: WORKER_ID,
        requestToken: 'tok-p8s3-r3a',
        payload: { prompt: 'p8s3 R3 fail-closed prompt' },
      }),
      TEAM_RUNTIME_ERROR_CODES.LIFECYCLE_COMMIT_UNAVAILABLE,
    )
    r3a = {
      code: rejection.code,
      newFacts: world.domain.repositories.ledger.list().length - baseline,
      deliveries: delivery.calls.length,
      workerLifecycle: memberRow(world, WORKER_ID).lifecycle,
    }
  } finally {
    await destroyP6T1World(world)
  }
}

// --- scenario: R3b (partial install: commit port only) ---------------------------

{
  const world = await createP6T2World('p8s3wc-r3b', ['leader', 'worker'])
  try {
    const delivery = createFakeDeliveryPort()
    const runtime = createTeamRuntime({
      teamDomain: world.domain,
      activationProvider: world.provider,
      blueprintCatalog: world.catalog,
      environmentFacts: world.ports.environmentFacts,
      externalPolicyFacts: world.ports.externalPolicyFacts,
      now: () => P6T2_NOW,
      lifecycleCommit: createFakeLifecycleCommitPort(world),
    })
    const outcome = await runtime.performAction(
      makeActionRequest({
        targetInstanceId: WORKER_ID,
        requestToken: 'tok-p8s3-r3b',
        payload: { prompt: 'p8s3 R3 partial-install prompt' },
      }),
    )
    const effect = asWorkAdmitted(outcome)
    r3b = {
      instanceId: effect.instanceId,
      // no chain ran: no settlement, no replay flag, no delivery, no
      // work-unit activity interval
      settledAbsent: effect.settled === undefined,
      replayedAbsent: effect.replayed === undefined,
      deliveries: delivery.calls.length,
      intervalOpens: ledgerFacts(world, 'activity-interval-opened').length,
      intervalCloses: ledgerFacts(world, 'activity-interval-closed').length,
    }
  } finally {
    await destroyP6T1World(world)
  }
}

// --- scenario: W4 (failed delivery settles fail-closed) --------------------------

{
  const world = await createP6T2World('p8s3wc-w4', ['leader'], {
    seedMembers: [p6t2Seed('worker', { lifecycle: 'SETTLED' })],
  })
  try {
    const delivery = createFakeDeliveryPort()
    delivery.setFailure('model route unavailable')
    const commitPort = createFakeLifecycleCommitPort(world)
    const runtime = createWorkChainRuntime(world, delivery.port, {
      lifecycleCommit: commitPort,
    })
    const token = 'tok-p8s3-w4'
    const rejection = await expectRejection(
      runtime,
      makeActionRequest({
        targetInstanceId: WORKER_ID,
        requestToken: token,
        payload: { prompt: 'p8s3 W4 failing prompt' },
      }),
      TEAM_RUNTIME_ERROR_CODES.WORK_DELIVERY_FAILED,
    )
    // the durable row is SETTLED again — NEVER a fake RUNNING
    const row = memberRow(world, WORKER_ID)
    // the settlement fact carries the failure (R6 audit trail)
    const settled = findFact(world, 'member-lifecycle-changed', {
      to: 'SETTLED',
      requestToken: token,
    })
    w4 = {
      code: rejection.code,
      lifecycle: row.lifecycle,
      activityVersion: row.activityVersion, // 1 -> ADMIT(2) -> SETTLE(3)
      commits: commitPort.calls.map(
        (call) => [call.from, call.to] as [string, string],
      ),
      detailInstance: rejection.details?.['instanceId'],
      detailChild: rejection.details?.['childSessionId'],
      detailToken: rejection.details?.['requestToken'],
      detailCause: rejection.details?.['cause'],
      // the admission fact committed (evidence second, before delivery)
      admittedPrompt: findFact(world, 'team-work-admitted', {
        requestToken: token,
      }).payload.prompt,
      settledFrom: settled.payload.from,
      settledOutcome: settled.payload.workOutcome,
      settledFailure: settled.payload.failure,
      // the interval opened and closed (the close tolerates nothing — it
      // ran before the fail-closed settle)
      intervalOpens: ledgerFacts(world, 'activity-interval-opened').length,
      intervalCloses: ledgerFacts(world, 'activity-interval-closed').length,
    }
  } finally {
    await destroyP6T1World(world)
  }
}

// --- scenario: W6 (work-unit activity interval) ----------------------------------

{
  const world = await createP6T2World('p8s3wc-w6', ['leader', 'worker'])
  try {
    const delivery = createFakeDeliveryPort()
    const runtime = createWorkChainRuntime(world, delivery.port)
    const token = 'tok-p8s3-w6'
    const outcome = await runtime.performAction(
      makeActionRequest({
        targetInstanceId: WORKER_ID,
        requestToken: token,
        payload: { prompt: 'p8s3 W6 interval prompt' },
      }),
    )
    const effect = asWorkAdmitted(outcome)
    const opens = ledgerFacts(world, 'activity-interval-opened').filter(
      (entry) => entry.payload['correlation'] === token,
    )
    const closes = ledgerFacts(world, 'activity-interval-closed').filter(
      (entry) => entry.payload['correlation'] === token,
    )
    const open = only(opens, 'interval opens')
    const close = only(closes, 'interval closes')
    w6 = {
      settled: effect.settled,
      settledSequence: effect.settledSequence,
      openCount: opens.length,
      closeCount: closes.length,
      openSubject: open.payload['subject'],
      openSequence: open.payload['sequence'],
      openProgress: open.payload['progress'],
      openReporter: open.payload['reportedByInstanceId'],
      openInstance: open.payload['instanceId'],
      closeSubject: close.payload['subject'],
      closeSequence: close.payload['sequence'],
      closeProgress: close.payload['progress'],
      // the close lands after the open in the global durable order
      closeAfterOpen: close.sequence > open.sequence,
    }
  } finally {
    await destroyP6T1World(world)
  }
}

// --- scenario: W9 (same-token replay, distinct token executes) --------------------

{
  const world = await createP6T2World('p8s3wc-w9', ['leader', 'worker'])
  try {
    const delivery = createFakeDeliveryPort()
    const runtime = createWorkChainRuntime(world, delivery.port)
    const token = 'tok-p8s3-w9'
    const request = makeActionRequest({
      targetInstanceId: WORKER_ID,
      requestToken: token,
      payload: { prompt: 'p8s3 W9 prompt' },
    })
    const first = await runtime.performAction(request)
    const e1 = asWorkAdmitted(first)
    const ledgerAfterFirst = world.domain.repositories.ledger.list().length
    // the retry of the SAME logical work
    const second = await runtime.performAction(request)
    const e2 = asWorkAdmitted(second)
    // zero new durable writes by the retry (measured BEFORE the distinct
    // third work unit of this scenario runs)
    const ledgerAfterSecond = world.domain.repositories.ledger.list().length
    // zero re-delivery by the retry (measured BEFORE the third work unit)
    const deliveriesAfterSecond = delivery.calls.length
    // a DISTINCT logical work still executes (dedup is per-token)
    const third = await runtime.performAction(
      makeActionRequest({
        targetInstanceId: WORKER_ID,
        requestToken: 'tok-p8s3-w9b',
        payload: { prompt: 'p8s3 W9 second work' },
      }),
    )
    const e3 = asWorkAdmitted(third)
    w9 = {
      e1Instance: e1.instanceId,
      e1Settled: e1.settled,
      e1NotReplayed: e1.replayed !== true,
      e1Sequence: e1.sequence,
      e2Instance: e2.instanceId,
      e2Replayed: e2.replayed,
      e2Settled: e2.settled,
      sameSequence: e2.sequence === e1.sequence,
      // zero new durable writes, zero re-delivery, no duplicate member
      ledgerUnchanged: ledgerAfterSecond === ledgerAfterFirst,
      deliveriesAfterRetry: deliveriesAfterSecond,
      members: memberList(world).length,
      childUnchanged: memberRow(world, WORKER_ID).childSessionId === WORKER_CHILD,
      e3NotReplayed: e3.replayed !== true,
      e3Settled: e3.settled,
      e3SequenceAdvanced: e3.sequence > e1.sequence,
      deliveriesTotal: delivery.calls.length,
      thirdPrompt: at(delivery.calls, 1, 'delivery calls').prompt,
    }
  } finally {
    await destroyP6T1World(world)
  }
}

// --- scenario: resume (crash window: admission fact committed, settlement lost) ---

{
  const world = await createP6T2World('p8s3wc-resume', ['leader', 'worker'])
  try {
    // the crash window: the earlier attempt committed the admission fact
    // durably (state + fact) but died before the settlement
    const token = 'tok-p8s3-resume'
    const admittedSequence = await world.domain.repositories.ledger.allocateSequence()
    await world.domain.repositories.ledger.put({
      schemaVersion: 1,
      sequence: admittedSequence,
      rootSessionId: P6T2_ROOT,
      factType: 'team-work-admitted',
      payload: {
        action: 'follow-up',
        caller: leaderCaller(),
        targetInstanceId: WORKER_ID,
        childSessionId: WORKER_CHILD,
        fromLifecycle: 'SETTLED',
        lifecycleCommitted: true,
        prompt: 'p8s3 resume original prompt',
        requestToken: token,
        at: P6T2_NOW,
      },
      createdAt: P6T2_NOW,
    })
    const delivery = createFakeDeliveryPort()
    const runtime = createWorkChainRuntime(world, delivery.port)
    const outcome = await runtime.performAction(
      makeActionRequest({
        targetInstanceId: WORKER_ID,
        requestToken: token,
        payload: { prompt: 'p8s3 resume redelivery' },
      }),
    )
    const effect = asWorkAdmitted(outcome)
    // the settlement converged from the observed RUNNING state
    const settled = findFact(world, 'member-lifecycle-changed', {
      to: 'SETTLED',
      requestToken: token,
    })
    resume = {
      instanceId: effect.instanceId,
      // no re-admission: the durable admission stands
      lifecycleCommitted: effect.lifecycleCommitted,
      sameAdmissionSequence: effect.sequence === admittedSequence,
      settled: effect.settled,
      // delivery attempted exactly once (at-least-once, visible dedup)
      deliveries: delivery.calls.length,
      redeliveredPrompt: at(delivery.calls, 0, 'delivery calls').prompt,
      // exactly ONE admission fact for the token (no duplicate)
      admissionFactCount: ledgerFacts(world, 'team-work-admitted').filter(
        (entry) => entry.payload['requestToken'] === token,
      ).length,
      settledFrom: settled.payload.from,
      workOutcome: settled.payload.workOutcome,
      rowLifecycle: memberRow(world, WORKER_ID).lifecycle,
    }
  } finally {
    await destroyP6T1World(world)
  }
}

// --- scenario: R1 vertical (delegate-create runs the chain on the new instance) ---

{
  const world = await createP6T2World('p8s3wc-delegate', ['leader'])
  try {
    const delivery = createFakeDeliveryPort()
    const runtime = createWorkChainRuntime(world, delivery.port)
    const token = 'tok-p8s3-delegate'
    const outcome = await runtime.performAction(
      makeActionRequest({
        action: 'delegate',
        delegationTemplateId: 'worker',
        requestToken: token,
        payload: { label: 'p8s3-delegatee', prompt: 'p8s3 delegate prompt' },
      }),
    )
    const effect = asMemberActivated(outcome)
    // the create effect PRESERVES its kind (E4) and carries the chain
    // outcome on the same effect
    const delivered = at(delivery.calls, 0, 'delivery calls')
    // the new row is durably SETTLED on its own child session
    const row = memberRow(world, effect.instanceId)
    // the work-unit interval closed and the settlement fact landed
    const opens = ledgerFacts(world, 'activity-interval-opened').filter(
      (entry) => entry.payload['correlation'] === token,
    )
    delegate = {
      instanceId: effect.instanceId,
      childSessionId: effect.childSessionId,
      workSettled: effect.workSettled,
      workSequencePositive: (effect.workSequence ?? 0) > 0,
      deliveries: delivery.calls.length,
      deliveredInstance: delivered.instanceId,
      deliveredChild: delivered.childSessionId,
      deliveredToken: delivered.requestToken,
      deliveredPrompt: delivered.prompt,
      rowLifecycle: row.lifecycle,
      rowChildMatches: row.childSessionId === effect.childSessionId,
      // one created member (leader + the delegatee)
      members: memberList(world).length,
      openCount: opens.length,
      openOnInstance:
        opens.length === 1 &&
        only(opens, 'interval opens').payload['instanceId'] === effect.instanceId,
      settledFrom: findFact(world, 'member-lifecycle-changed', {
        to: 'SETTLED',
        requestToken: token,
        instanceId: effect.instanceId,
      }).payload.from,
    }
  } finally {
    await destroyP6T1World(world)
  }
}

// --- scenario: R2 (the explicit request prompt is the model-visible prompt) ------

{
  const world = await createP6T2World('p8s3wc-r2', ['leader', 'worker'])
  try {
    const delivery = createFakeDeliveryPort()
    const runtime = createWorkChainRuntime(world, delivery.port)
    await runtime.performAction(
      makeActionRequest({
        targetInstanceId: WORKER_ID,
        requestToken: 'tok-p8s3-r2',
        payload: {
          prompt: 'the exact model-visible prompt',
          attachedContext: 'explicit attached context block',
        },
      }),
    )
    const delivered = at(delivery.calls, 0, 'delivery calls')
    // the admission fact carries the same explicit content (R2 audit)
    const admitted = findFact(world, 'team-work-admitted', {
      requestToken: 'tok-p8s3-r2',
    })
    r2 = {
      deliveries: delivery.calls.length,
      prompt: delivered.prompt,
      attached: delivered.attachedContext,
      token: delivered.requestToken,
      factPrompt: admitted.payload['prompt'],
      factAttached: admitted.payload['attachedContext'],
    }
  } finally {
    await destroyP6T1World(world)
  }
}

// --- scenario: C1-S1 (full mode: the port's succeeded result is carried) ----

{
  const world = await createP6T2World('p8s3wc-c1s1', ['leader', 'worker'])
  try {
    const delivery = createFakeDeliveryPort()
    delivery.armResult({
      requestToken: 'tok-c1-s1',
      status: 'succeeded',
      body: 'member business answer',
    })
    const result = await runChainDirect(world, delivery.port, 'tok-c1-s1', 'p8s3 C1-S1 prompt')
    c1s1 = {
      mode: result.mode,
      settled: result.settled,
      status: result.memberResult?.status,
      body: result.memberResult?.body,
      errorAbsent: result.memberResult?.error === undefined,
      token: result.memberResult?.requestToken,
      deliveries: delivery.calls.length,
    }
  } finally {
    await destroyP6T1World(world)
  }
}

// --- scenario: C1-S2 (failed + unavailable mapping; settled/succeeded split) --

{
  const world = await createP6T2World('p8s3wc-c1s2', ['leader', 'worker'])
  try {
    const delivery = createFakeDeliveryPort()
    // failed: the delivery/turn failed with a stable code + message
    delivery.armResult({
      requestToken: 'tok-c1-s2f',
      status: 'failed',
      error: { code: 'WORK_TURN_ERROR', message: 'llm call failed (contained in the turn)' },
    })
    const failed = await runChainDirect(world, delivery.port, 'tok-c1-s2f', 'p8s3 C1-S2 failing turn')
    // unavailable: the turn completed but no readable business body exists
    delivery.armResult({
      requestToken: 'tok-c1-s2u',
      status: 'unavailable',
      error: { code: 'WORK_NO_ASSISTANT_BODY', message: 'no assistant text in the delivered turn' },
    })
    const unavailable = await runChainDirect(world, delivery.port, 'tok-c1-s2u', 'p8s3 C1-S2 bodyless turn')
    c1s2 = {
      failedMode: failed.mode,
      failedSettled: failed.settled,
      failedStatus: failed.memberResult?.status,
      failedCode: failed.memberResult?.error?.code,
      failedMessage: failed.memberResult?.error?.message,
      failedBody: failed.memberResult?.body,
      failedToken: failed.memberResult?.requestToken,
      unavailableMode: unavailable.mode,
      unavailableSettled: unavailable.settled,
      unavailableStatus: unavailable.memberResult?.status,
      unavailableCode: unavailable.memberResult?.error?.code,
      unavailableBody: unavailable.memberResult?.body,
      unavailableToken: unavailable.memberResult?.requestToken,
    }
  } finally {
    await destroyP6T1World(world)
  }
}

// --- scenario: C1-S3 (replay: identical synthesis, exactly once, no re-report)

{
  const world = await createP6T2World('p8s3wc-c1s3', ['leader', 'worker'])
  try {
    const delivery = createFakeDeliveryPort()
    delivery.armResult({
      requestToken: 'tok-c1-s3',
      status: 'succeeded',
      body: 'original member answer',
    })
    const first = await runChainDirect(world, delivery.port, 'tok-c1-s3', 'p8s3 C1-S3 prompt')
    const ledgerAfterFirst = world.domain.repositories.ledger.list().length
    // a retry of the SAME settled logical work: zero delivery, zero writes
    const second = await runChainDirect(world, delivery.port, 'tok-c1-s3', 'p8s3 C1-S3 prompt')
    const ledgerAfterSecond = world.domain.repositories.ledger.list().length
    // a third identical replay: the synthesis is idempotent
    const third = await runChainDirect(world, delivery.port, 'tok-c1-s3', 'p8s3 C1-S3 prompt')
    const ledgerAfterThird = world.domain.repositories.ledger.list().length
    c1s3 = {
      firstMode: first.mode,
      firstStatus: first.memberResult?.status,
      firstBody: first.memberResult?.body,
      secondMode: second.mode,
      secondSettled: second.settled,
      secondResult: second.memberResult,
      thirdResult: third.memberResult,
      secondHasNoBody: second.memberResult?.body === undefined,
      deliveries: delivery.calls.length,
      ledgerUnchangedOnReplay: ledgerAfterSecond === ledgerAfterFirst,
      ledgerUnchangedOnReplay2: ledgerAfterThird === ledgerAfterSecond,
      sameSequence: second.sequence === first.sequence,
    }
  } finally {
    await destroyP6T1World(world)
  }
}

// --- scenario: C1-S4 (resume: the fresh this-attempt result is carried) ------

{
  const world = await createP6T2World('p8s3wc-c1s4', ['leader', 'worker'])
  try {
    // the crash window: the earlier attempt committed the admission fact
    // durably but died before the settlement (same seed as the resume case)
    const token = 'tok-c1-s4'
    const admittedSequence = await world.domain.repositories.ledger.allocateSequence()
    await world.domain.repositories.ledger.put({
      schemaVersion: 1,
      sequence: admittedSequence,
      rootSessionId: P6T2_ROOT,
      factType: 'team-work-admitted',
      payload: {
        action: 'follow-up',
        caller: leaderCaller(),
        targetInstanceId: WORKER_ID,
        childSessionId: WORKER_CHILD,
        fromLifecycle: 'SETTLED',
        lifecycleCommitted: true,
        prompt: 'p8s3 C1-S4 original prompt',
        requestToken: token,
        at: P6T2_NOW,
      },
      createdAt: P6T2_NOW,
    })
    const delivery = createFakeDeliveryPort()
    delivery.armResult({
      requestToken: token,
      status: 'failed',
      error: { code: 'WORK_TURN_ABORTED', message: 'turn aborted by the caller' },
    })
    const result = await runChainDirect(world, delivery.port, token, 'p8s3 C1-S4 resume prompt')
    c1s4 = {
      mode: result.mode,
      settled: result.settled,
      status: result.memberResult?.status,
      code: result.memberResult?.error?.code,
      token: result.memberResult?.requestToken,
      sameAdmissionSequence: result.sequence === admittedSequence,
      deliveries: delivery.calls.length,
    }
  } finally {
    await destroyP6T1World(world)
  }
}

// --- assertions (synchronous; the shim supports no async `it`) --------------------

describe('P8-S3 work execution chain (R1–R6, package level)', () => {
  it('R3: work admission fails closed without the lifecycle commit port (zero writes)', () => {
    expect(r3a.code).toBe(TEAM_RUNTIME_ERROR_CODES.LIFECYCLE_COMMIT_UNAVAILABLE)
    expect(r3a.newFacts).toBe(0)
    expect(r3a.deliveries).toBe(0)
    expect(r3a.workerLifecycle).toBe('SETTLED')
  })

  it('partial install (commit port only) never runs the chain — the P6-T2 evidence path stands', () => {
    expect(r3b.instanceId).toBe(WORKER_ID)
    expect(r3b.settledAbsent).toBe(true)
    expect(r3b.replayedAbsent).toBe(true)
    expect(r3b.deliveries).toBe(0)
    expect(r3b.intervalOpens).toBe(0)
    expect(r3b.intervalCloses).toBe(0)
  })

  it('W4: a failed delivery settles fail-closed — no fake RUNNING, a delivery-failed settlement fact', () => {
    expect(w4.code).toBe(TEAM_RUNTIME_ERROR_CODES.WORK_DELIVERY_FAILED)
    expect(w4.lifecycle).toBe('SETTLED')
    expect(w4.activityVersion).toBe(3)
    expect(w4.commits).toEqual([
      ['SETTLED', 'RUNNING'],
      ['RUNNING', 'SETTLED'],
    ])
    // the rejection carries the delivery fault (visible cause)
    expect(w4.detailInstance).toBe(WORKER_ID)
    expect(w4.detailChild).toBe(WORKER_CHILD)
    expect(w4.detailToken).toBe('tok-p8s3-w4')
    expect(w4.detailCause).toEqual({ message: 'model route unavailable' })
    expect(w4.admittedPrompt).toBe('p8s3 W4 failing prompt')
    expect(w4.settledFrom).toBe('RUNNING')
    expect(w4.settledOutcome).toBe('delivery-failed')
    expect(w4.settledFailure).toEqual({ message: 'model route unavailable' })
    expect(w4.intervalOpens).toBe(1)
    expect(w4.intervalCloses).toBe(1)
  })

  it('W6: the work unit opens and closes its activity interval (subject work-unit, correlation = token)', () => {
    expect(w6.settled).toBe(true)
    expect(w6.settledSequence).toBeGreaterThan(0)
    expect(w6.openCount).toBe(1)
    expect(w6.closeCount).toBe(1)
    expect(w6.openSubject).toBe('work-unit')
    expect(w6.openSequence).toBe(1)
    expect(w6.openProgress).toBe('in-progress')
    expect(w6.openReporter).toBe('team-runtime')
    expect(w6.openInstance).toBe(WORKER_ID)
    expect(w6.closeSubject).toBe('work-unit')
    expect(w6.closeSequence).toBe(2)
    expect(w6.closeProgress).toBe('completed')
    expect(w6.closeAfterOpen).toBe(true)
  })

  it('W9: a same-token retry is a durable REPLAY — no re-delivery, no duplicate member/session; a new token still executes', () => {
    expect(w9.e1Instance).toBe(WORKER_ID)
    expect(w9.e1Settled).toBe(true)
    expect(w9.e1NotReplayed).toBe(true)
    expect(w9.e2Instance).toBe(WORKER_ID)
    expect(w9.e2Replayed).toBe(true)
    expect(w9.e2Settled).toBe(true)
    expect(w9.sameSequence).toBe(true)
    expect(w9.ledgerUnchanged).toBe(true)
    expect(w9.deliveriesAfterRetry).toBe(1)
    expect(w9.members).toBe(2)
    expect(w9.childUnchanged).toBe(true)
    expect(w9.e3NotReplayed).toBe(true)
    expect(w9.e3Settled).toBe(true)
    expect(w9.e3SequenceAdvanced).toBe(true)
    expect(w9.deliveriesTotal).toBe(2)
    expect(w9.thirdPrompt).toBe('p8s3 W9 second work')
  })

  it('resume: a pre-seeded admission fact redelivers exactly once and converges to SETTLED without re-admitting', () => {
    expect(resume.instanceId).toBe(WORKER_ID)
    expect(resume.lifecycleCommitted).toBe(false)
    expect(resume.sameAdmissionSequence).toBe(true)
    expect(resume.settled).toBe(true)
    expect(resume.deliveries).toBe(1)
    expect(resume.redeliveredPrompt).toBe('p8s3 resume redelivery')
    expect(resume.admissionFactCount).toBe(1)
    expect(resume.settledFrom).toBe('RUNNING')
    expect(resume.workOutcome).toBe('settled')
    expect(resume.rowLifecycle).toBe('SETTLED')
  })

  it('R1 (package-level vertical): a delegate-create runs the full chain on the NEW instance and leaves it durably SETTLED', () => {
    expect(delegate.workSettled).toBe(true)
    expect(delegate.workSequencePositive).toBe(true)
    expect(delegate.deliveries).toBe(1)
    expect(delegate.deliveredInstance).toBe(delegate.instanceId)
    expect(delegate.deliveredChild).toBe(delegate.childSessionId)
    expect(delegate.deliveredToken).toBe('tok-p8s3-delegate')
    expect(delegate.deliveredPrompt).toBe('p8s3 delegate prompt')
    expect(delegate.rowLifecycle).toBe('SETTLED')
    expect(delegate.rowChildMatches).toBe(true)
    expect(delegate.members).toBe(2)
    expect(delegate.openCount).toBe(1)
    expect(delegate.openOnInstance).toBe(true)
    expect(delegate.settledFrom).toBe('RUNNING')
  })

  it('R2: the delivered prompt is the explicit request prompt (no default inheritance), with attachedContext when provided', () => {
    expect(r2.deliveries).toBe(1)
    expect(r2.prompt).toBe('the exact model-visible prompt')
    expect(r2.attached).toBe('explicit attached context block')
    expect(r2.token).toBe('tok-p8s3-r2')
    expect(r2.factPrompt).toBe('the exact model-visible prompt')
    expect(r2.factAttached).toBe('explicit attached context block')
  })

  it('C1: full mode carries the port result — succeeded with the business body, requestToken verbatim', () => {
    expect(c1s1.mode).toBe('full')
    expect(c1s1.settled).toBe(true)
    expect(c1s1.status).toBe('succeeded')
    expect(c1s1.body).toBe('member business answer')
    expect(c1s1.errorAbsent).toBe(true)
    expect(c1s1.token).toBe('tok-c1-s1')
    expect(c1s1.deliveries).toBe(1)
  })

  it('C1: failed/unavailable are carried verbatim, and settled=true never maps to succeeded', () => {
    // failed: an explicit delivery/turn failure with a stable code+message
    expect(c1s2.failedMode).toBe('full')
    expect(c1s2.failedSettled).toBe(true)
    expect(c1s2.failedStatus).toBe('failed')
    expect(c1s2.failedCode).toBe('WORK_TURN_ERROR')
    expect(c1s2.failedMessage).toBe('llm call failed (contained in the turn)')
    expect(c1s2.failedBody).toBeUndefined()
    expect(c1s2.failedToken).toBe('tok-c1-s2f')
    // unavailable: the turn completed but no readable body is available
    expect(c1s2.unavailableMode).toBe('full')
    expect(c1s2.unavailableSettled).toBe(true)
    expect(c1s2.unavailableStatus).toBe('unavailable')
    expect(c1s2.unavailableCode).toBe('WORK_NO_ASSISTANT_BODY')
    expect(c1s2.unavailableBody).toBeUndefined()
    expect(c1s2.unavailableToken).toBe('tok-c1-s2u')
    // settled (control plane) and the business status stay separate
    expect(c1s2.failedSettled && c1s2.failedStatus !== 'succeeded').toBe(true)
    expect(c1s2.unavailableSettled && c1s2.unavailableStatus !== 'succeeded').toBe(true)
  })

  it('C1: a replay of an already-settled token synthesizes the SAME unavailable result — no re-delivery, no re-report', () => {
    expect(c1s3.firstMode).toBe('full')
    expect(c1s3.firstStatus).toBe('succeeded')
    expect(c1s3.firstBody).toBe('original member answer')
    expect(c1s3.secondMode).toBe('replay')
    expect(c1s3.secondSettled).toBe(true)
    // the frozen replay synthesis (existing durable state only)
    expect(c1s3.secondResult).toEqual({
      requestToken: 'tok-c1-s3',
      status: 'unavailable',
      error: {
        code: 'WORK_REPLAYED',
        message: 'work unit already settled (settlement fact present); original result not re-reported',
      },
    })
    // idempotent: the third replay is identical to the second
    expect(c1s3.thirdResult).toEqual(c1s3.secondResult)
    // no second business report, no double delivery, zero durable writes
    expect(c1s3.secondHasNoBody).toBe(true)
    expect(c1s3.deliveries).toBe(1)
    expect(c1s3.ledgerUnchangedOnReplay).toBe(true)
    expect(c1s3.ledgerUnchangedOnReplay2).toBe(true)
    expect(c1s3.sameSequence).toBe(true)
  })

  it('C1: resume mode carries the fresh this-attempt result (at-least-once, visible dedup)', () => {
    expect(c1s4.mode).toBe('resume')
    expect(c1s4.settled).toBe(true)
    expect(c1s4.status).toBe('failed')
    expect(c1s4.code).toBe('WORK_TURN_ABORTED')
    expect(c1s4.token).toBe('tok-c1-s4')
    expect(c1s4.sameAdmissionSequence).toBe(true)
    expect(c1s4.deliveries).toBe(1)
  })
})
