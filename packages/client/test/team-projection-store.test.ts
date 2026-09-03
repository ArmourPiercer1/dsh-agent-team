/**
 * P9-T3 (S2-B) — the generation-safe Team projection store.
 *
 * Coverage (Gate G2 invariants): a frame is written ONLY after the
 * frozen `assessProjectionSync` verdict is `apply` — first frame,
 * generation +1, duplicate (same frame reference), stale, foreign
 * TeamSession, and provenance generation mismatch all keep the applied
 * frame untouched; a typed RPC error resolves (never rejects) and is
 * stored intact as `lastError`; a delayed, stale response after a
 * reconnect never overwrites the newer applied frame; transport loss
 * enters `reconnecting` with the frozen backoff (attempt 1 → 500 ms,
 * attempt 2 → 1000 ms on the default CLIENT_LOCAL config), retries fire
 * through the scheduler and settle to `ready`; `markConnectionRestored`
 * restarts the backoff episode (frozen P8 `markConnected` semantics)
 * and fires the invalidation pull; snapshot references stay stable
 * between changes; `reset` returns to `idle`.
 *
 * Shim-constrained spec (run-tests.mjs): the `it()` bodies are
 * synchronous assertions on captured scenario state; the async scenarios
 * run at module level (top-level await, the P8-T3 round-trip pattern).
 * No real timers: the retry scheduler is manual (due-time driven).
 * Matchers used: toBe / toEqual (+ .not) only.
 */
import { describe, expect, it } from 'vitest'
import {
  REMOTE_CONTRACT_VERSION,
  PushTransportLossError,
  buildRemoteError,
  buildRemoteSuccess,
  type RemoteResponse,
} from '../../remote/src/index.js'
import {
  createTeamProjectionStore,
  DEFAULT_TEAM_PROJECTION_BACKOFF,
  type TeamProjectionScheduler,
} from '../src/state/team-projection-store.js'

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const METHOD = 'team.getProjection'

/** One frozen `team.getProjection` success envelope (G8 provenance intact). */
function projectionSuccess(
  teamSessionId: string,
  generation: number,
  provenanceGeneration?: number,
): RemoteResponse {
  return buildRemoteSuccess(
    {
      projection: {
        schemaVersion: 1,
        teamSessionId,
        blueprint: { blueprintId: 'b1', blueprintRevision: 1 },
        generation,
        generatedAt: '2026-08-29T00:00:00.000Z',
        root: { rootSessionId: teamSessionId },
        templates: [],
        members: [],
        ledger: { total: 0 },
      },
    },
    {
      method: METHOD,
      endpoint: METHOD,
      contractVersion: REMOTE_CONTRACT_VERSION,
      requestToken: null,
      projectionGeneration: provenanceGeneration === undefined ? generation : provenanceGeneration,
    },
  )
}

/** One frozen typed RPC error envelope. */
function projectionError(code: string, message: string): RemoteResponse {
  return buildRemoteError(code, message, {
    method: METHOD,
    endpoint: METHOD,
    contractVersion: REMOTE_CONTRACT_VERSION,
    requestToken: null,
  })
}

type ScriptItem =
  | { readonly kind: 'response'; readonly response: RemoteResponse }
  | { readonly kind: 'loss' }

const res = (response: RemoteResponse): ScriptItem => ({ kind: 'response', response })
const LOSS: ScriptItem = { kind: 'loss' }

/** Scripted projection pull: FIFO queue, rejects with the frozen loss error. */
function makeResponder(script: ScriptItem[]) {
  const calls: string[] = []
  const getProjection = (teamSessionId: string): Promise<RemoteResponse> => {
    calls.push(teamSessionId)
    const item = script.shift()
    if (item === undefined || item.kind === 'loss') {
      return Promise.reject(
        new PushTransportLossError('remote push transport: seam channel lost'),
      )
    }
    return Promise.resolve(item.response)
  }
  return { calls, getProjection }
}

/** The manual retry scheduler: due-time driven, no real timers. */
function makeManualScheduler(): TeamProjectionScheduler & {
  readonly advance: (ms: number) => void
  readonly pending: () => number
} {
  interface Task {
    readonly due: number
    readonly task: () => void
  }
  const tasks = new Map<number, Task>()
  let handle = 1
  let clock = 0
  return {
    schedule: (delayMs, task) => {
      const h = handle++
      tasks.set(h, { due: clock + delayMs, task })
      return h
    },
    cancel: (h) => {
      void tasks.delete(h)
    },
    advance: (ms) => {
      clock += ms
      const ready = [...tasks.entries()]
        .filter(([, t]) => t.due <= clock)
        .sort((a, b) => a[1].due - b[1].due || a[0] - b[0])
      for (const [h, t] of ready) {
        tasks.delete(h)
        t.task()
      }
    },
    pending: () => tasks.size,
  }
}

/** Settle the microtask queue (deterministic stand-in for event-loop turns). */
async function flush(turns = 8): Promise<void> {
  for (let i = 0; i < turns; i++) await Promise.resolve()
}

// ---------------------------------------------------------------------------
// Module-level scenarios
// ---------------------------------------------------------------------------

const firstFrameScenario = await (async () => {
  const { calls, getProjection } = makeResponder([res(projectionSuccess('t1', 1))])
  const scheduler = makeManualScheduler()
  const store = createTeamProjectionStore({ getProjection, scheduler })
  const before = store.getState()
  const assessment = await store.pull('t1')
  await flush()
  const after = store.getState()
  const stableRef = store.getState()
  return { before, after, stableRef, assessment, calls, store }
})()

const generationPlusOneScenario = await (async () => {
  const { calls, getProjection } = makeResponder([
    res(projectionSuccess('t1', 1)),
    res(projectionSuccess('t1', 2)),
  ])
  const scheduler = makeManualScheduler()
  const store = createTeamProjectionStore({ getProjection, scheduler })
  await store.pull('t1')
  await flush()
  const frameAfterFirst = store.getState().frame
  const assessment = await store.pull('t1')
  await flush()
  const after = store.getState()
  return { frameAfterFirst, after, assessment, calls, store }
})()

const duplicateScenario = await (async () => {
  const { getProjection } = makeResponder([
    res(projectionSuccess('t1', 1)),
    res(projectionSuccess('t1', 1)),
  ])
  const store = createTeamProjectionStore({ getProjection, scheduler: makeManualScheduler() })
  await store.pull('t1')
  await flush()
  const frameAfterFirst = store.getState().frame
  const assessment = await store.pull('t1')
  await flush()
  const after = store.getState()
  return { frameAfterFirst, after, assessment }
})()

const staleScenario = await (async () => {
  const { getProjection } = makeResponder([
    res(projectionSuccess('t1', 1)),
    res(projectionSuccess('t1', 3)),
    res(projectionSuccess('t1', 2)),
  ])
  const store = createTeamProjectionStore({ getProjection, scheduler: makeManualScheduler() })
  await store.pull('t1')
  await store.pull('t1')
  await flush()
  const assessment = await store.pull('t1')
  await flush()
  const after = store.getState()
  return { after, assessment }
})()

const foreignScenario = await (async () => {
  const { getProjection } = makeResponder([
    res(projectionSuccess('t1', 1)),
    res(projectionSuccess('t2', 2)),
  ])
  const store = createTeamProjectionStore({ getProjection, scheduler: makeManualScheduler() })
  await store.pull('t1')
  await flush()
  const frameAfterFirst = store.getState().frame
  const assessment = await store.pull('t1')
  await flush()
  const after = store.getState()
  return { frameAfterFirst, after, assessment }
})()

const provenanceMismatchScenario = await (async () => {
  const { getProjection } = makeResponder([
    res(projectionSuccess('t1', 1)),
    res(projectionSuccess('t1', 2, 99)),
  ])
  const store = createTeamProjectionStore({ getProjection, scheduler: makeManualScheduler() })
  await store.pull('t1')
  await flush()
  const frameAfterFirst = store.getState().frame
  const assessment = await store.pull('t1')
  await flush()
  const after = store.getState()
  return { frameAfterFirst, after, assessment }
})()

const rpcErrorScenario = await (async () => {
  const envelope = projectionError('team-not-found', 'no such team')
  const { getProjection } = makeResponder([res(projectionSuccess('t1', 1)), res(envelope)])
  const store = createTeamProjectionStore({ getProjection, scheduler: makeManualScheduler() })
  await store.pull('t1')
  await flush()
  const frameAfterFirst = store.getState().frame
  const assessment = await store.pull('t1')
  await flush()
  const after = store.getState()
  return { envelope, frameAfterFirst, after, assessment }
})()

/**
 * Stale response late after reconnect: gen5 applied; two in-flight pulls
 * (A → gen6, B → gen7); B settles first (applies gen7); A settles late
 * (gen6 < 7 → stale, no overwrite).
 */
const lateStaleAfterReconnectScenario = await (async () => {
  interface Gates {
    resolveA?: (r: RemoteResponse) => void
    resolveB?: (r: RemoteResponse) => void
  }
  const gates: Gates = {}
  const gateA = new Promise<RemoteResponse>((resolve) => {
    gates.resolveA = resolve
  })
  const gateB = new Promise<RemoteResponse>((resolve) => {
    gates.resolveB = resolve
  })
  const order: Array<Promise<RemoteResponse>> = [
    Promise.resolve(projectionSuccess('t1', 5)),
    gateA,
    gateB,
  ]
  const calls: string[] = []
  const store = createTeamProjectionStore({
    scheduler: makeManualScheduler(),
    getProjection: (id) => {
      calls.push(id)
      const gate = order.shift()
      if (gate === undefined) {
        return Promise.reject(new PushTransportLossError('gate exhausted'))
      }
      return gate
    },
  })
  // Seed: apply gen5.
  await store.pull('t1')
  await flush()
  // Channel loss → reconnecting with a scheduled retry.
  store.markConnectionLost()
  const lost = store.getState()
  // Restoration fires the invalidation pull (gateA, gen6 — still in flight).
  store.markConnectionRestored()
  await flush()
  // A second invalidation trigger (generation source event) fires pull 3
  // (gateB, gen7) — left in flight, like pull 2.
  const pendingThird = store.pull('t1')
  await flush()
  // B (gen7) settles first.
  gates.resolveB?.(projectionSuccess('t1', 7))
  await pendingThird
  await flush()
  const afterB = store.getState()
  // A (gen6) settles late: stale — must not overwrite gen7.
  gates.resolveA?.(projectionSuccess('t1', 6))
  await flush()
  const afterA = store.getState()
  return { lost, afterB, afterA, calls }
})()

/**
 * Transport loss → reconnecting + frozen backoff growth, retry fires
 * through the manual scheduler and settles to ready.
 */
const backoffScenario = await (async () => {
  const { calls, getProjection } = makeResponder([LOSS, LOSS, res(projectionSuccess('t1', 1))])
  const scheduler = makeManualScheduler()
  const store = createTeamProjectionStore({ getProjection, scheduler })
  const assessmentOne = await store.pull('t1')
  await flush()
  const afterFirstLoss = store.getState()
  const pendingAfterFirstLoss = scheduler.pending()
  // A second loss report while the retry is pending: no double schedule.
  store.markConnectionLost()
  const afterSecondReport = store.getState()
  const pendingAfterSecondReport = scheduler.pending()
  // The pending retry (500 ms) fires and fails again → attempt 2.
  scheduler.advance(500)
  await flush()
  const afterSecondLoss = store.getState()
  const pendingAfterSecondLoss = scheduler.pending()
  // The next retry (1000 ms) fires and succeeds → ready, episode done.
  scheduler.advance(1000)
  await flush()
  const afterRecovery = store.getState()
  const pendingAfterRecovery = scheduler.pending()
  return {
    assessmentOne,
    afterFirstLoss,
    afterSecondReport,
    afterSecondLoss,
    afterRecovery,
    pendingAfterFirstLoss,
    pendingAfterSecondReport,
    pendingAfterSecondLoss,
    pendingAfterRecovery,
    calls,
  }
})()

/**
 * `markConnectionRestored`: restarts the backoff episode (frozen P8
 * `markConnected` semantics: the attempt counter resets) and fires the
 * invalidation pull.
 */
const restoredScenario = await (async () => {
  const { calls, getProjection } = makeResponder([LOSS, res(projectionSuccess('t1', 1))])
  const scheduler = makeManualScheduler()
  const store = createTeamProjectionStore({ getProjection, scheduler })
  await store.pull('t1')
  await flush()
  const lost = store.getState()
  const lostPending = scheduler.pending()
  store.markConnectionRestored()
  const during = store.getState()
  const pendingAfterRestore = scheduler.pending()
  await flush()
  const after = store.getState()
  return { lost, lostPending, during, pendingAfterRestore, after, calls }
})()

/** A loss report that lands after a later success is stale: ignored. */
const staleLossReportScenario = await (async () => {
  interface Gates {
    rejectA?: (e: Error) => void
    resolveB?: (r: RemoteResponse) => void
  }
  const gates: Gates = {}
  const gateA = new Promise<RemoteResponse>((resolve, reject) => {
    gates.rejectA = reject
  })
  const gateB = new Promise<RemoteResponse>((resolve) => {
    gates.resolveB = resolve
  })
  const order: Array<Promise<RemoteResponse>> = [gateA, gateB]
  const store = createTeamProjectionStore({
    scheduler: makeManualScheduler(),
    getProjection: (id) => {
      const gate = order.shift()
      if (gate === undefined) {
        return Promise.reject(new PushTransportLossError('gate exhausted'))
      }
      return gate
    },
  })
  const pendingA = store.pull('t1')
  const pendingB = store.pull('t1')
  await flush()
  // B (gen2) succeeds first → ready, channel connected.
  gates.resolveB?.(projectionSuccess('t1', 2))
  await pendingB
  await flush()
  const afterB = store.getState()
  // A's loss report arrives late: stale — must not disturb the ready state.
  gates.rejectA?.(new PushTransportLossError('remote push transport: seam channel lost'))
  await pendingA
  await flush()
  const afterALoss = store.getState()
  return { afterB, afterALoss }
})()

const resetScenario = await (async () => {
  const { getProjection } = makeResponder([LOSS, res(projectionSuccess('t1', 1))])
  const scheduler = makeManualScheduler()
  const store = createTeamProjectionStore({ getProjection, scheduler })
  await store.pull('t1')
  await flush()
  const lost = store.getState()
  const lostPending = scheduler.pending()
  store.reset()
  const afterReset = store.getState()
  const afterResetPending = scheduler.pending()
  return { lost, lostPending, afterReset, afterResetPending }
})()

const subscribeScenario = await (async () => {
  const { getProjection } = makeResponder([
    res(projectionSuccess('t1', 1)),
    res(projectionSuccess('t1', 2)),
  ])
  const store = createTeamProjectionStore({ getProjection, scheduler: makeManualScheduler() })
  let notifications = 0
  const dispose = store.subscribe(() => {
    notifications += 1
  })
  const stableRef = store.getState()
  const stableAgain = store.getState()
  await store.pull('t1')
  await flush()
  const afterFirst = store.getState()
  const notificationsAfterFirst = notifications
  dispose()
  const notificationsAfterDispose = notifications
  await store.pull('t1')
  await flush()
  const afterSecond = store.getState()
  const notificationsFinal = notifications
  return {
    stableRef,
    stableAgain,
    afterFirst,
    afterSecond,
    notificationsAfterFirst,
    notificationsAfterDispose,
    notificationsFinal,
  }
})()

// ---------------------------------------------------------------------------
// Synchronous assertions on the captured scenarios
// ---------------------------------------------------------------------------

describe('createTeamProjectionStore — generation verdicts (G2)', () => {
  it('first frame: idle → ready with the applied generation', () => {
    const { before, after, stableRef, assessment, calls } = firstFrameScenario
    expect(before.status).toBe('idle')
    expect(before.teamSessionId).toBe(null)
    expect(before.appliedGeneration).toBe(null)
    expect(before.frame).toBe(null)
    expect(calls).toEqual(['t1'])
    expect(assessment).toEqual({ status: 'apply', receivedGeneration: 1 })
    expect(after.status).toBe('ready')
    expect(after.teamSessionId).toBe('t1')
    expect(after.appliedGeneration).toBe(1)
    expect(after.frame).not.toBe(null)
    expect(after.frame?.projection.generation).toBe(1)
    expect(after.frame?.provenance.projectionGeneration).toBe(1)
    expect(after.lastAssessment).toEqual({ status: 'apply', receivedGeneration: 1 })
    expect(after.lastError).toBe(undefined)
    expect(after.retryAttempt).toBe(0)
    expect(after.nextRetryDelayMs).toBe(null)
    // Snapshot reference is stable between changes (no action in flight).
    expect(firstFrameScenario.store.getState()).toBe(stableRef)
  })

  it('generation +1: the newer frame replaces the applied state', () => {
    const { frameAfterFirst, after, assessment } = generationPlusOneScenario
    expect(assessment).toEqual({ status: 'apply', receivedGeneration: 2 })
    expect(after.status).toBe('ready')
    expect(after.appliedGeneration).toBe(2)
    expect(after.frame?.projection.generation).toBe(2)
    expect(after.frame).not.toBe(frameAfterFirst)
  })

  it('duplicate: idempotent no-op — the same frame reference stays applied', () => {
    const { frameAfterFirst, after, assessment } = duplicateScenario
    expect(assessment).toEqual({ status: 'duplicate', receivedGeneration: 1 })
    expect(after.status).toBe('ready')
    expect(after.appliedGeneration).toBe(1)
    expect(after.frame).toBe(frameAfterFirst)
  })

  it('stale: never overwrites the newer applied frame', () => {
    const { after, assessment } = staleScenario
    expect(assessment).toEqual({ status: 'stale', receivedGeneration: 2 })
    expect(after.status).toBe('ready')
    expect(after.appliedGeneration).toBe(3)
    expect(after.frame?.projection.generation).toBe(3)
  })

  it('foreign TeamSession: never overwrites, the source anomaly surfaces as error', () => {
    const { frameAfterFirst, after, assessment } = foreignScenario
    expect(assessment).toEqual({ status: 'foreign', receivedGeneration: 2 })
    expect(after.status).toBe('error')
    expect(after.appliedGeneration).toBe(1)
    expect(after.teamSessionId).toBe('t1')
    expect(after.frame).toBe(frameAfterFirst)
  })

  it('provenance generation mismatch: inconsistent, the frame is never touched', () => {
    const { frameAfterFirst, after, assessment } = provenanceMismatchScenario
    expect(assessment).toEqual({ status: 'inconsistent', receivedGeneration: null })
    expect(after.status).toBe('error')
    expect(after.appliedGeneration).toBe(1)
    expect(after.frame).toBe(frameAfterFirst)
  })

  it('typed RPC error: resolves (never rejects), the error is stored intact', () => {
    const { envelope, frameAfterFirst, after, assessment } = rpcErrorScenario
    expect(assessment).toEqual({
      status: 'rpc-error',
      code: 'team-not-found',
      receivedGeneration: null,
    })
    expect(after.status).toBe('error')
    expect(after.appliedGeneration).toBe(1)
    expect(after.frame).toBe(frameAfterFirst)
    if (!envelope.ok) {
      expect(after.lastError).toEqual(envelope.error)
      expect(after.lastError?.code).toBe('team-not-found')
      expect(after.lastError?.details.method).toBe(METHOD)
    } else {
      expect(true).toBe(false)
    }
  })
})

describe('createTeamProjectionStore — reconnect policy (Seam 5 / G2)', () => {
  it('a stale response late after reconnect never overwrites the new frame', () => {
    const { lost, afterB, afterA, calls } = lateStaleAfterReconnectScenario
    expect(lost.status).toBe('reconnecting')
    expect(lost.retryAttempt).toBe(1)
    expect(calls).toEqual(['t1', 't1', 't1'])
    // B (gen7) settled first → applied.
    expect(afterB.status).toBe('ready')
    expect(afterB.appliedGeneration).toBe(7)
    expect(afterB.frame?.projection.generation).toBe(7)
    // A (gen6) settled late → stale, no overwrite.
    expect(afterA.status).toBe('ready')
    expect(afterA.appliedGeneration).toBe(7)
    expect(afterA.frame?.projection.generation).toBe(7)
    expect(afterA.lastAssessment).toEqual({ status: 'stale', receivedGeneration: 6 })
  })

  it('transport loss: reconnecting with the frozen backoff (500 ms, then 1000 ms)', () => {
    const {
      assessmentOne,
      afterFirstLoss,
      afterSecondReport,
      afterSecondLoss,
      afterRecovery,
      pendingAfterFirstLoss,
      pendingAfterSecondReport,
      pendingAfterSecondLoss,
      pendingAfterRecovery,
      calls,
    } = backoffScenario
    expect(assessmentOne).toEqual({ status: 'transport-loss', receivedGeneration: null })
    expect(afterFirstLoss.status).toBe('reconnecting')
    expect(afterFirstLoss.retryAttempt).toBe(1)
    expect(afterFirstLoss.nextRetryDelayMs).toBe(500)
    expect(afterFirstLoss.lastAssessment).toEqual({
      status: 'transport-loss',
      receivedGeneration: null,
    })
    expect(pendingAfterFirstLoss).toBe(1)
    // A second loss report while the retry is pending: no double schedule.
    expect(afterSecondReport.retryAttempt).toBe(1)
    expect(afterSecondReport.nextRetryDelayMs).toBe(500)
    expect(pendingAfterSecondReport).toBe(1)
    // The 500 ms retry fires and fails again → attempt 2, cap 2000 → 1000 ms.
    expect(afterSecondLoss.status).toBe('reconnecting')
    expect(afterSecondLoss.retryAttempt).toBe(2)
    expect(afterSecondLoss.nextRetryDelayMs).toBe(1000)
    expect(pendingAfterSecondLoss).toBe(1)
    // The 1000 ms retry fires and succeeds → ready, the episode is over.
    expect(afterRecovery.status).toBe('ready')
    expect(afterRecovery.appliedGeneration).toBe(1)
    expect(afterRecovery.retryAttempt).toBe(0)
    expect(afterRecovery.nextRetryDelayMs).toBe(null)
    expect(pendingAfterRecovery).toBe(0)
    expect(calls).toEqual(['t1', 't1', 't1'])
  })

  it('markConnectionRestored: restarts the episode and fires the invalidation pull', () => {
    const { lost, lostPending, during, pendingAfterRestore, after, calls } = restoredScenario
    expect(lost.status).toBe('reconnecting')
    expect(lost.retryAttempt).toBe(1)
    expect(lost.nextRetryDelayMs).toBe(500)
    expect(lostPending).toBe(1)
    // Synchronously after the restore: the pending retry is cancelled and
    // the backoff episode restarted (frozen P8 markConnected semantics).
    expect(pendingAfterRestore).toBe(0)
    expect(during.retryAttempt).toBe(0)
    expect(during.nextRetryDelayMs).toBe(null)
    // The invalidation pull landed: ready with the fresh frame.
    expect(after.status).toBe('ready')
    expect(after.appliedGeneration).toBe(1)
    expect(calls).toEqual(['t1', 't1'])
  })

  it('a loss report after a later success is stale and ignored', () => {
    const { afterB, afterALoss } = staleLossReportScenario
    expect(afterB.status).toBe('ready')
    expect(afterB.appliedGeneration).toBe(2)
    expect(afterALoss.status).toBe('ready')
    expect(afterALoss.appliedGeneration).toBe(2)
    expect(afterALoss.retryAttempt).toBe(0)
    expect(afterALoss.nextRetryDelayMs).toBe(null)
  })

  it('reset: back to idle, the pending retry is cancelled', () => {
    const { lost, lostPending, afterReset, afterResetPending } = resetScenario
    expect(lost.status).toBe('reconnecting')
    expect(lostPending).toBe(1)
    expect(afterReset.status).toBe('idle')
    expect(afterReset.teamSessionId).toBe(null)
    expect(afterReset.appliedGeneration).toBe(null)
    expect(afterReset.frame).toBe(null)
    expect(afterReset.lastAssessment).toBe(null)
    expect(afterReset.retryAttempt).toBe(0)
    expect(afterReset.nextRetryDelayMs).toBe(null)
    expect(afterResetPending).toBe(0)
  })
})

describe('createTeamProjectionStore — observable source contract', () => {
  it('snapshot reference stable between changes; listeners notified once per change; disposed listeners stop', () => {
    const {
      stableRef,
      stableAgain,
      afterFirst,
      afterSecond,
      notificationsAfterFirst,
      notificationsAfterDispose,
      notificationsFinal,
    } = subscribeScenario
    expect(stableAgain).toBe(stableRef)
    expect(afterFirst).not.toBe(stableRef)
    expect(notificationsAfterFirst).toBeGreaterThan(0)
    expect(afterSecond).not.toBe(afterFirst)
    // After dispose: the second pull changed the snapshot but notified nobody.
    expect(notificationsFinal).toBe(notificationsAfterDispose)
  })
})

describe('createTeamProjectionStore — defaults', () => {
  it('the default backoff is the documented CLIENT_LOCAL transport policy', () => {
    expect(DEFAULT_TEAM_PROJECTION_BACKOFF.baseMs).toBe(1000)
    expect(DEFAULT_TEAM_PROJECTION_BACKOFF.factor).toBe(2)
    expect(DEFAULT_TEAM_PROJECTION_BACKOFF.maxMs).toBe(30000)
  })
})
