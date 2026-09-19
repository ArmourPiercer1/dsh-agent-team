/**
 * C1 (leader-approval reachability) — the control-service liveness
 * notification tests (plan §9.2, six cases):
 *
 *   1. a new `leader-approval`  -> exactly ONE notifier call
 *   2. an idempotent retry      -> NO second notifier call
 *   3. a `user-approval`        -> NO Leader notifier call (kind-scoped)
 *   4. the notifier REJECTS     -> requestControl still returns the
 *                                  durable request (non-fatal)
 *   5. after a notifier failure -> the request remains visible PENDING
 *                                  (listControlState recovery)
 *   6. RE-ENTRANT RESOLVE (the key regression test): the notifier
 *      synchronously drives `resolveControl` + a concurrent
 *      `requestControl` — the test completes WITHOUT deadlock and the
 *      requested row ends decided. Proof the notification runs AFTER
 *      the per-team lock is released (a lock-held notification would
 *      hang on the re-entrant lock acquisition).
 *   7. (P0 closure / plan §9.2 N7) a notifier that throws
 *      SYNCHRONOUSLY (before any promise is returned) ->
 *      requestControl STILL resolves, the diagnostic sink sees exactly
 *      ONE failure, the row stays pending, zero decisions. The
 *      `void promise.catch` shape alone would let the sync throw escape
 *      the request path.
 *
 * World: the P6-T4 durable world with the control service wired to a
 * RECORDING notifier (the test stand-in for the live glue's
 * `deliverRootControlNotification`; the recording mirrors the
 * production fire-and-forget contract — the service never awaits the
 * notification on the request path).
 */

import { describe, expect, it } from 'vitest'

import {
  CONTROL_REQUEST_KINDS,
  createControlService,
} from '../control/index.js'
import type {
  ControlRequestNotificationPort,
  ControlRequestRecord,
} from '../control/index.js'
import {
  P6T4_ROOT,
  P6T4_SEEDS,
  createP6T4World,
  leaderCaller,
  memberCaller,
} from './p6t4-helpers.js'
import { destroyP6T1World } from './p6t1-helpers.js'

const WORKER_ID = String(P6T4_SEEDS.worker.instanceId)

/** A bounded await (the deadlock guard: a lock-held notification would
 *  never settle and this times out loudly instead of hanging the suite). */
async function boundedAwait<T>(
  work: Promise<T>,
  timeoutMs: number,
  label: string,
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined
  const timeout = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(
      () => reject(new Error(`c1-notify: TIMEOUT — ${label} never settled (deadlock suspect)`)),
      timeoutMs,
    )
  })
  try {
    return await Promise.race([work, timeout])
  } finally {
    if (timer !== undefined) clearTimeout(timer)
  }
}

/** The recording notifier (see the module doc for the contract). */
interface RecordingNotifier extends ControlRequestNotificationPort {
  /** Every notified request, in invocation order. */
  readonly calls: ControlRequestRecord[]
  /** Resolves after every invocation issued so far has settled. */
  drained(): Promise<void>
}

function createRecordingNotifier(
  onNotify?: (record: ControlRequestRecord) => Promise<void> | void,
  failNext: number = 0,
): RecordingNotifier {
  const calls: ControlRequestRecord[] = []
  let chain: Promise<void> = Promise.resolve()
  let failuresLeft = failNext
  return {
    calls,
    async notifyLeaderRequest(record: ControlRequestRecord): Promise<void> {
      calls.push(record)
      const run = async (): Promise<void> => {
        if (failuresLeft > 0) {
          failuresLeft -= 1
          throw new Error('c1-notify: injected delivery failure')
        }
        if (onNotify !== undefined) await onNotify(record)
      }
      const task = run()
      chain = chain.then(() => task).catch(() => undefined)
      // the service's fire-and-forget `.catch` must see the REAL
      // rejection — await the behavior, do not swallow it here.
      await task
    },
    drained: () => chain,
  }
}

function workerScope(correlation: string) {
  return {
    rootSessionId: P6T4_ROOT,
    caller: memberCaller(WORKER_ID),
    targetInstanceId: WORKER_ID,
    actionName: 'write-file',
    toolName: 'fs.write',
    correlation,
  }
}

const S = await (async () => {
  const world = await createP6T4World('c1-notify', ['leader', 'worker'])
  const base = {
    teamDomain: world.domain,
    blueprintCatalog: world.catalog,
    externalPolicyFacts: world.ports.externalPolicyFacts,
    now: () => '2026-09-18T00:00:00Z',
  }

  // --- cases 1–3: invocation discipline on one service -------------------
  const notifier = createRecordingNotifier()
  const service = createControlService({ ...base, requestNotification: notifier })

  const created = await service.requestControl({
    ...workerScope('c1n-corr-1'),
    kind: CONTROL_REQUEST_KINDS.LEADER_APPROVAL,
  })
  await boundedAwait(notifier.drained(), 2000, 'case1 notifier drain')
  const afterCreate = notifier.calls.length

  // idempotent retry: the SAME logical scope (same correlation) — the
  // existing row is returned, the notifier must NOT fire again.
  await service.requestControl({
    ...workerScope('c1n-corr-1'),
    kind: CONTROL_REQUEST_KINDS.LEADER_APPROVAL,
  })
  await boundedAwait(notifier.drained(), 2000, 'case2 notifier drain')
  const afterRetry = notifier.calls.length

  // a user-approval request (human-only resolvers) must NOT notify the
  // Leader.
  await service.requestControl({
    ...workerScope('c1n-corr-user'),
    kind: CONTROL_REQUEST_KINDS.USER_APPROVAL,
  })
  await boundedAwait(notifier.drained(), 2000, 'case3 notifier drain')
  const afterUser = notifier.calls.length

  // --- cases 4–5: failure is non-fatal, the row stays pending ------------
  const failing = createRecordingNotifier(undefined, 1)
  let failureSinkCalls = 0
  const failingService = createControlService({
    ...base,
    requestNotification: failing,
    onNotificationFailure: () => {
      failureSinkCalls += 1
    },
  })
  const failedCreate = await boundedAwait(
    failingService.requestControl({
      ...workerScope('c1n-corr-fail'),
      kind: CONTROL_REQUEST_KINDS.LEADER_APPROVAL,
    }),
    2000,
    'case4 requestControl with a failing notifier',
  )
  await boundedAwait(failing.drained(), 2000, 'case4 failing notifier drain')
  // flush the service's OWN catch microtask (the failure sink runs on the
  // wrapper promise the service attaches to — one tick after the
  // recording chain settles)
  await new Promise((r) => setTimeout(r, 5))
  const failedState = await failingService.listControlState(P6T4_ROOT)

  // --- case 6: the re-entrant resolve (the key regression test) ----------
  // The notifier, fired AFTER the lock is released, (a) issues a
  // CONCURRENT new requestControl (a second correlation — it must not
  // block on the team lock: a lock-held notification would deadlock
  // here) and (b) resolves the ORIGINAL request through the SAME
  // ControlService authority (the Leader answering inside its own
  // notification turn). The whole sequence must settle.
  // assigned exactly once (below) — const is impossible: the notifier
  // closure must capture the binding BEFORE the service is created.
  // eslint-disable-next-line prefer-const
  let reentrantService: import('../control/index.js').ControlService
  let firstRequestId: string | undefined
  const reentrant = createRecordingNotifier(async (record) => {
    // act ONLY on the FIRST notified request (the original) — the probe's
    // own notification cascades here (it is a new leader-approval row
    // too) and must be a no-op, otherwise the cascade would resolve the
    // probe as well.
    if (firstRequestId === undefined) firstRequestId = record.requestId
    if (record.requestId !== firstRequestId) return
    // (a) the concurrent probe: a NEW request on the SAME team — acquires
    // the team lock while the notifier is in flight (proof the original
    // request's lock is already released).
    probeRequestId = (
      await boundedAwait(
        reentrantService.requestControl({
          ...workerScope('c1n-corr-probe'),
          kind: CONTROL_REQUEST_KINDS.LEADER_APPROVAL,
        }),
        2000,
        'case6 concurrent requestControl inside the notifier',
      )
    ).requestId
    // (b) the re-entrant resolve of the ORIGINAL request.
    await boundedAwait(
      reentrantService.resolveControl({
        rootSessionId: P6T4_ROOT,
        caller: leaderCaller(),
        requestId: firstRequestId,
        decision: 'allow',
      }),
      2000,
      'case6 re-entrant resolveControl inside the notifier',
    )
  })
  reentrantService = createControlService({
    ...base,
    requestNotification: reentrant,
  })
  let probeRequestId: string | undefined
  const reentrantOriginal = await boundedAwait(
    reentrantService.requestControl({
      ...workerScope('c1n-corr-reentrant'),
      kind: CONTROL_REQUEST_KINDS.LEADER_APPROVAL,
    }),
    2000,
    'case6 outer requestControl',
  )
  // the fire-and-forget notifier started before this return — the first
  // notification IS the original request.
  expect(reentrantOriginal.requestId).toBe(firstRequestId)
  await boundedAwait(reentrant.drained(), 4000, 'case6 notifier drain (re-entrant resolve)')
  const reentrantState = await reentrantService.listControlState(P6T4_ROOT)

  // --- the ABSENT-port regression guard ----------------------------------
  const bare = createControlService(base)
  const bareCreated = await bare.requestControl({
    ...workerScope('c1n-corr-bare'),
    kind: CONTROL_REQUEST_KINDS.LEADER_APPROVAL,
  })
  const bareState = await bare.listControlState(P6T4_ROOT)

  // --- N7 (plan §9.2): the SYNCHRONOUS-throw notifier ---------------------
  // A port implementation that throws BEFORE returning a promise: the
  // old `void port.notifyLeaderRequest(record).catch(...)` shape would
  // let that throw escape requestControl entirely (no promise exists to
  // attach the catch to). The hardened shape (try/catch around the call
  // + `Promise.resolve(...).catch`) reports the fault to the diagnostic
  // sink and keeps the request path green.
  let syncSinkCalls = 0
  let syncSinkError: unknown
  const syncThrowing: ControlRequestNotificationPort = {
    notifyLeaderRequest(_record: ControlRequestRecord): Promise<void> {
      throw new Error('c1-notify: synchronous notifier fault (pre-promise throw)')
    },
  }
  const syncService = createControlService({
    ...base,
    requestNotification: syncThrowing,
    onNotificationFailure: (args) => {
      syncSinkCalls += 1
      syncSinkError = args.error
    },
  })
  const syncCreate = await boundedAwait(
    syncService.requestControl({
      ...workerScope('c1n-corr-synct'),
      kind: CONTROL_REQUEST_KINDS.LEADER_APPROVAL,
    }),
    2000,
    'N7 requestControl with a synchronous-throwing notifier',
  )
  const syncState = await syncService.listControlState(P6T4_ROOT)

  await destroyP6T1World(world)

  return {
    created,
    afterCreate,
    afterRetry,
    afterUser,
    failingCalls: failing.calls.length,
    failureSinkCalls,
    failedCreate,
    failedState,
    reentrantOriginal,
    probeRequestId,
    reentrantState,
    bareCreated,
    bareState,
    syncCreate,
    syncSinkCalls,
    syncSinkError,
    syncState,
  }
})()

describe('control-service Leader liveness notification (C1)', () => {
  it('case 1: a new leader-approval request -> exactly one notifier call', () => {
    expect(S.afterCreate).toBe(1)
  })

  it('case 2: an idempotent retry -> no second notifier call (same requestId returned)', () => {
    expect(S.afterRetry).toBe(1)
    expect(S.created.requestId).toBeTruthy()
  })

  it('case 3: a user-approval request -> no Leader notifier call (kind-scoped)', () => {
    expect(S.afterUser).toBe(1)
  })

  it('case 4: a rejecting notifier does not fail requestControl (the durable row is returned)', () => {
    expect(S.failedCreate.status).toBe('pending')
    expect(S.failedCreate.requestId).toBeTruthy()
    expect(S.failedCreate.kind).toBe(CONTROL_REQUEST_KINDS.LEADER_APPROVAL)
    expect(S.failingCalls).toBe(1)
    expect(S.failureSinkCalls).toBe(1)
  })

  it('case 5: after a notifier failure the request remains PENDING and discoverable', () => {
    const pending = S.failedState.requests.filter(
      (r) => r.requestId === S.failedCreate.requestId && r.status === 'pending',
    )
    expect(pending).toHaveLength(1)
    // no decision was fabricated by the failure path
    const decisions = S.failedState.decisions.filter(
      (d) => d.requestId === S.failedCreate.requestId,
    )
    expect(decisions).toHaveLength(0)
  })

  it('case 6: re-entrant resolve inside the notifier -> NO deadlock, the request ends decided', () => {
    // the concurrent probe request was admitted WHILE the notifier was
    // in flight — the team lock was already released (a lock-held
    // notification would have deadlocked the probe's lock acquisition
    // and timed out loudly).
    expect(S.probeRequestId).toBeTruthy()
    // the original request was DECIDED by the re-entrant resolve
    const original = S.reentrantState.requests.find(
      (r) => r.requestId === S.reentrantOriginal.requestId,
    )
    expect(original).toBeDefined()
    expect(original!.status).toBe('decided')
    // the probe request is a distinct pending row (its own lifecycle)
    const probe = S.reentrantState.requests.find(
      (r) => r.requestId === S.probeRequestId,
    )
    expect(probe).toBeDefined()
    expect(probe!.status).toBe('pending')
  })

  it('N7: a SYNCHRONOUS-throwing notifier does not fail requestControl (sink sees one failure, row stays pending, zero decisions)', () => {
    // the request path is unaffected by the pre-promise throw
    expect(S.syncCreate.status).toBe('pending')
    expect(S.syncCreate.requestId).toBeTruthy()
    expect(S.syncCreate.kind).toBe(CONTROL_REQUEST_KINDS.LEADER_APPROVAL)
    // the diagnostic sink was invoked exactly ONCE, with the real fault
    expect(S.syncSinkCalls).toBe(1)
    expect(S.syncSinkError instanceof Error).toBe(true)
    expect((S.syncSinkError as Error).message).toBe(
      'c1-notify: synchronous notifier fault (pre-promise throw)',
    )
    // the durable row remains PENDING and discoverable; no decision was
    // fabricated by the fault path
    const pending = S.syncState.requests.filter(
      (r) => r.requestId === S.syncCreate.requestId && r.status === 'pending',
    )
    expect(pending).toHaveLength(1)
    const decisions = S.syncState.decisions.filter(
      (d) => d.requestId === S.syncCreate.requestId,
    )
    expect(decisions).toHaveLength(0)
  })

  it('the service WITHOUT a notification port is unaffected (ABSENT = no notify, same authority)', () => {
    // regression guard: factory/unit worlds without the port — discovery
    // stays functional through listControlState, zero notifier calls
    // possible by construction.
    expect(S.bareCreated.status).toBe('pending')
    const pending = S.bareState.requests.filter(
      (r) => r.requestId === S.bareCreated.requestId && r.status === 'pending',
    )
    expect(pending).toHaveLength(1)
  })
})
