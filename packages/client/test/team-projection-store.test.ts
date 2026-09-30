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
 * Repair 20260927 (S1-C3) — loss staleness by round-trip evidence:
 * in-order success → the next real transport loss is FRESH
 * (`reconnecting` + one retry, not dismissed); the restored-connection
 * pull failing with a real loss re-opens the episode (the incident
 * shape); a typed error ends only on a successful round trip —
 * including a same-generation (duplicate) normal response; reset /
 * scope switch makes in-flight pulls dead on settlement (no state or
 * timer resurrection); an earlier request failing LATE after a later
 * request succeeded is ignored (no overwrite, no extra retry).
 *
 * PR #34 review follow-up (F1) — request-order liveness authority:
 * a response of a request that a LATER request already superseded is
 * resolved but NOT published — an old typed error does not downgrade
 * a newer success, an old foreign / inconsistent does not downgrade a
 * newer success, an old duplicate / stale does not clear a newer
 * typed error; while a late response of an earlier request carrying a
 * genuinely NEWER authoritative generation still applies normally
 * (the generation verdict, not the request order, owns frame
 * authority).
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
import { generationOnlyProjectionBindings } from '../src/transport/team-remote-client.js'

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
  const store = createTeamProjectionStore({ getProjection, scheduler, ...generationOnlyProjectionBindings })
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
  const store = createTeamProjectionStore({ getProjection, scheduler, ...generationOnlyProjectionBindings })
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
  const store = createTeamProjectionStore({ getProjection, scheduler: makeManualScheduler(), ...generationOnlyProjectionBindings })
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
  const store = createTeamProjectionStore({ getProjection, scheduler: makeManualScheduler(), ...generationOnlyProjectionBindings })
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
  const store = createTeamProjectionStore({ getProjection, scheduler: makeManualScheduler(), ...generationOnlyProjectionBindings })
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
  const store = createTeamProjectionStore({ getProjection, scheduler: makeManualScheduler(), ...generationOnlyProjectionBindings })
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
  const store = createTeamProjectionStore({ getProjection, scheduler: makeManualScheduler(), ...generationOnlyProjectionBindings })
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
    ...generationOnlyProjectionBindings,
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
  const store = createTeamProjectionStore({ getProjection, scheduler, ...generationOnlyProjectionBindings })
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
  const store = createTeamProjectionStore({ getProjection, scheduler, ...generationOnlyProjectionBindings })
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
    ...generationOnlyProjectionBindings,
    scheduler: makeManualScheduler(),
    getProjection: (_id) => {
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
  const store = createTeamProjectionStore({ getProjection, scheduler, ...generationOnlyProjectionBindings })
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
  const store = createTeamProjectionStore({ getProjection, scheduler: makeManualScheduler(), ...generationOnlyProjectionBindings })
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

/**
 * (repair 20260927, S1-C3) the incident shape: an IN-ORDER success,
 * then the NEXT round trip is a REAL transport loss. The old channel
 * guard dismissed it (the channel was "connected" after the success),
 * leaving the surface stuck with no retry. The loss must be fresh:
 * `reconnecting` + exactly one scheduled retry.
 */
const successThenLossScenario = await (async () => {
  const { calls, getProjection } = makeResponder([
    res(projectionSuccess('t1', 1)),
    LOSS,
    res(projectionSuccess('t1', 2)),
  ])
  const scheduler = makeManualScheduler()
  const store = createTeamProjectionStore({ getProjection, scheduler, ...generationOnlyProjectionBindings })
  await store.pull('t1')
  await flush()
  const afterSuccess = store.getState()
  // The very next round trip is a real transport loss.
  const assessment = await store.pull('t1')
  await flush()
  const afterLoss = store.getState()
  const pendingAfterLoss = scheduler.pending()
  // The retry (500 ms) succeeds → ready, episode absorbed.
  scheduler.advance(500)
  await flush()
  const afterRetry = store.getState()
  const pendingAfterRetry = scheduler.pending()
  return { afterSuccess, assessment, afterLoss, pendingAfterLoss, afterRetry, pendingAfterRetry, calls }
})()

/**
 * (repair 20260927, S1-C3) the RESTORED-CONNECTION loss: a loss episode
 * is open, `markConnectionRestored` fires the invalidation pull, and
 * THAT pull fails with a real transport loss. The old code declared
 * "connected" on the restore event (no round-trip evidence) and
 * dismissed the very loss it had just fired — the episode died with no
 * retry left and the surface stayed stuck. The loss must be fresh:
 * one retry scheduled.
 */
const restoredPullLossScenario = await (async () => {
  const { calls, getProjection } = makeResponder([LOSS, LOSS, res(projectionSuccess('t1', 1))])
  const scheduler = makeManualScheduler()
  const store = createTeamProjectionStore({ getProjection, scheduler, ...generationOnlyProjectionBindings })
  await store.pull('t1')
  await flush()
  const lost = store.getState()
  store.markConnectionRestored()
  await flush()
  const afterRestoredLoss = store.getState()
  const pendingAfterRestoredLoss = scheduler.pending()
  // The retry (500 ms) succeeds → ready.
  scheduler.advance(500)
  await flush()
  const afterRecovery = store.getState()
  const pendingAfterRecovery = scheduler.pending()
  return { lost, afterRestoredLoss, pendingAfterRestoredLoss, afterRecovery, pendingAfterRecovery, calls }
})()

/**
 * (PR #35 follow-up, P1-5) `noteConnectionRestored` — the SPLIT restore
 * notice: the loss episode is cleared (the pending retry cancelled, the
 * attempt counter reset, the `reconnecting` status closed — an applied
 * frame is `ready` again) but NO store-owned pull fires (the invalidation
 * pull is the coordinator's connection-restored round). The staleness
 * baseline is untouched: the IN-FLIGHT pull's late loss still opens a
 * FRESH episode (one new retry — the S1-C3 invariant holds under the
 * split), and that fresh episode recovers through the backoff lane.
 */
const notedRestoreScenario = await (async () => {
  // The in-flight pull's settle is GATED (a loss) so it truly outlives
  // the channel-state moves (loss report → split restore notice).
  interface Gate {
    readonly promise: Promise<RemoteResponse>
    readonly settle: (r: RemoteResponse) => void
    readonly fail: (e: Error) => void
  }
  const makeGate = (): Gate => {
    let settle!: (r: RemoteResponse) => void
    let fail!: (e: Error) => void
    const promise = new Promise<RemoteResponse>((resolve, reject) => {
      settle = resolve
      fail = reject
    })
    return { promise, settle, fail }
  }
  const gate = makeGate()
  const calls: string[] = []
  const script: Array<Promise<RemoteResponse>> = [
    Promise.resolve(projectionSuccess('t1', 1)), // the seed frame
    gate.promise, // the in-flight pull (settles LATE — see below)
    Promise.reject(
      new PushTransportLossError('remote push transport: seam channel lost'),
    ), // the fresh episode's retry #1 fails
    Promise.resolve(projectionSuccess('t1', 2)), // the fresh episode's retry #2 succeeds
  ]
  const getProjection = (_id: string): Promise<RemoteResponse> => {
    calls.push(_id)
    const next = script.shift()
    if (next === undefined) {
      return Promise.reject(new PushTransportLossError('script exhausted'))
    }
    return next
  }
  const scheduler = makeManualScheduler()
  const store = createTeamProjectionStore({ getProjection, scheduler, ...generationOnlyProjectionBindings })
  await store.pull('t1')
  await flush()
  const pendingPull = store.pull('t1')
  await flush()
  store.markConnectionLost()
  const lostState = store.getState()
  const lostPending = scheduler.pending()
  const callsBeforeNote = calls.length
  store.noteConnectionRestored()
  const notedState = store.getState()
  const notedPending = scheduler.pending()
  const callsAfterNote = calls.length
  // The in-flight pull settles LATE with a real loss: a FRESH episode
  // (the notice did not advance the staleness baseline).
  gate.fail(new PushTransportLossError('remote push transport: seam channel lost'))
  await pendingPull
  await flush()
  const afterLateLoss = store.getState()
  const afterLateLossPending = scheduler.pending()
  // The fresh episode recovers through its own backoff lane.
  scheduler.advance(500)
  await flush()
  const afterFirstRetry = store.getState()
  scheduler.advance(1000)
  await flush()
  const afterRecovery = store.getState()
  const afterRecoveryPending = scheduler.pending()
  return {
    lostState,
    lostPending,
    notedState,
    notedPending,
    callsBeforeNote,
    callsAfterNote,
    afterLateLoss,
    afterLateLossPending,
    afterFirstRetry,
    afterRecovery,
    afterRecoveryPending,
    calls,
  }
})()

/**
 * (repair 20260927, S1-C3) typed error → later success: the error state
 * is stored intact, and the successful recovery (a NEW generation)
 * ENDS it — `lastError` must not keep being presented.
 */
const typedErrorRecoveryScenario = await (async () => {
  const { getProjection } = makeResponder([
    res(projectionSuccess('t1', 1)),
    res(projectionError('remote-timeout', 'upstream timed out')),
    res(projectionSuccess('t1', 2)),
  ])
  const store = createTeamProjectionStore({ getProjection, scheduler: makeManualScheduler(), ...generationOnlyProjectionBindings })
  await store.pull('t1')
  await flush()
  await store.pull('t1')
  await flush()
  const afterError = store.getState()
  await store.pull('t1')
  await flush()
  const afterRecovery = store.getState()
  return { afterError, afterRecovery }
})()

/**
 * (repair 20260927, S1-C3) typed error → SAME-generation (duplicate)
 * normal response: the frozen assessment is `duplicate`, but the
 * round trip is a valid success — the error state still ends
 * (guide: "成功恢复（包括相同 generation 的正常响应）应结束错误状态").
 */
const sameGenerationRecoveryScenario = await (async () => {
  const { getProjection } = makeResponder([
    res(projectionSuccess('t1', 1)),
    res(projectionError('remote-timeout', 'upstream timed out')),
    res(projectionSuccess('t1', 1)),
  ])
  const store = createTeamProjectionStore({ getProjection, scheduler: makeManualScheduler(), ...generationOnlyProjectionBindings })
  await store.pull('t1')
  await flush()
  await store.pull('t1')
  await flush()
  const afterError = store.getState()
  const assessment = await store.pull('t1')
  await flush()
  const afterRecovery = store.getState()
  return { afterError, assessment, afterRecovery }
})()

/**
 * (repair 20260927, S1-C3) reset / scope switch: an in-flight pull of
 * the old scope settles LATE — first with a success, then with a
 * transport loss. Neither may resurrect the old scope's state (frame,
 * status) or schedule a timer on the new (empty) scope.
 */
const lateRequestAfterResetScenario = await (async () => {
  interface Gate {
    readonly promise: Promise<RemoteResponse>
    readonly settle: (r: RemoteResponse) => void
    readonly fail: (e: Error) => void
  }
  const makeGate = (): Gate => {
    let settle!: (r: RemoteResponse) => void
    let fail!: (e: Error) => void
    const promise = new Promise<RemoteResponse>((resolve, reject) => {
      settle = resolve
      fail = reject
    })
    return { promise, settle, fail }
  }
  const scheduler = makeManualScheduler()
  // One gate per pull start (collected in call order — the pull invokes
  // the responder synchronously before its first await).
  const gates: Gate[] = []
  const store = createTeamProjectionStore({
    ...generationOnlyProjectionBindings,
    scheduler,
    getProjection: (_id) => {
      const gate = makeGate()
      gates.push(gate)
      return gate.promise
    },
  })
  // (a) in-flight success → reset → the late success is dead.
  const pendingA = store.pull('t1')
  await flush()
  store.reset()
  const afterResetA = store.getState()
  const afterResetAPending = scheduler.pending()
  gates[0]?.settle(projectionSuccess('t1', 1))
  await pendingA
  await flush()
  const afterLateA = store.getState()
  const afterLateAPending = scheduler.pending()
  // (b) in-flight loss → reset → the late loss is dead (no schedule).
  const pendingB = store.pull('t1')
  await flush()
  store.reset()
  const afterResetB = store.getState()
  gates[1]?.fail(new PushTransportLossError('remote push transport: seam channel lost'))
  await pendingB
  await flush()
  const afterLateB = store.getState()
  const afterLateBPending = scheduler.pending()
  return {
    afterResetA,
    afterResetAPending,
    afterLateA,
    afterLateAPending,
    afterResetB,
    afterLateB,
    afterLateBPending,
  }
})()

/**
 * (repair 20260927, S1-C3) a request that started EARLIER fails LATE,
 * after a LATER request already completed a valid round trip: the stale
 * loss must not overwrite the newer success and must not add a retry
 * (the scheduler stays empty).
 */
const staleLossAfterNewerSuccessScenario = await (async () => {
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
  const scheduler = makeManualScheduler()
  const store = createTeamProjectionStore({
    ...generationOnlyProjectionBindings,
    scheduler,
    getProjection: (_id) => {
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
  // B (gen2, started later) succeeds first.
  gates.resolveB?.(projectionSuccess('t1', 2))
  await pendingB
  await flush()
  const afterB = store.getState()
  // A's (started earlier) loss report arrives late.
  gates.rejectA?.(new PushTransportLossError('remote push transport: seam channel lost'))
  await pendingA
  await flush()
  const afterALoss = store.getState()
  const pendingAfterALoss = scheduler.pending()
  return { afterB, afterALoss, pendingAfterALoss }
})()

// ---------------------------------------------------------------------------
// PR #34 review follow-up (F1): request-order LIVENESS authority. A
// response from a request that started EARLIER settles after a LATER
// request already completed its round trip — it no longer owns the UI
// liveness/error state (status / lastError / lastAssessment). Frame
// authority stays with the generation verdict: a late response carrying
// a genuinely NEWER authoritative generation still applies normally.
// ---------------------------------------------------------------------------

/** F1-T1: an earlier request settles LATE with a typed error after a later success. */
const staleTypedErrorAfterNewerSuccessScenario = await (async () => {
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
  const order: Array<Promise<RemoteResponse>> = [gateA, gateB]
  const store = createTeamProjectionStore({
    ...generationOnlyProjectionBindings,
    scheduler: makeManualScheduler(),
    getProjection: (_id) => {
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
  // B (gen2, started later) succeeds first.
  gates.resolveB?.(projectionSuccess('t1', 2))
  await pendingB
  await flush()
  const afterB = store.getState()
  // A (started earlier) settles late with a typed RPC error.
  gates.resolveA?.(projectionError('team-remote-internal-error', 'internal error in remote handler'))
  const assessmentA = await pendingA
  await flush()
  const afterA = store.getState()
  return { afterB, afterA, assessmentA }
})()

/** F1-T2: an earlier request settles LATE with a foreign team frame after a later success. */
const staleForeignAfterNewerSuccessScenario = await (async () => {
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
  const order: Array<Promise<RemoteResponse>> = [gateA, gateB]
  const store = createTeamProjectionStore({
    ...generationOnlyProjectionBindings,
    scheduler: makeManualScheduler(),
    getProjection: (_id) => {
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
  // B (gen2, started later) succeeds first.
  gates.resolveB?.(projectionSuccess('t1', 2))
  await pendingB
  await flush()
  const afterB = store.getState()
  // A (started earlier) settles late with a frame of ANOTHER team.
  gates.resolveA?.(projectionSuccess('t2', 2))
  const assessmentA = await pendingA
  await flush()
  const afterA = store.getState()
  return { afterB, afterA, assessmentA }
})()

/** F1-T2: an earlier request settles LATE with a provenance-mismatched frame after a later success. */
const staleInconsistentAfterNewerSuccessScenario = await (async () => {
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
  const order: Array<Promise<RemoteResponse>> = [gateA, gateB]
  const store = createTeamProjectionStore({
    ...generationOnlyProjectionBindings,
    scheduler: makeManualScheduler(),
    getProjection: (_id) => {
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
  // B (gen2, started later) succeeds first.
  gates.resolveB?.(projectionSuccess('t1', 2))
  await pendingB
  await flush()
  const afterB = store.getState()
  // A (started earlier) settles late with a provenance generation
  // mismatch (frame gen 2, provenance gen 99 → inconsistent).
  gates.resolveA?.(projectionSuccess('t1', 2, 99))
  const assessmentA = await pendingA
  await flush()
  const afterA = store.getState()
  return { afterB, afterA, assessmentA }
})()

/**
 * F1-T3/T4 (parameterized): an earlier request settles LATE with a
 * non-apply frame (duplicate / stale) after a later request's typed
 * error — the newer error must not be cleared by the older response.
 */
async function lateNonApplyAfterNewerErrorScenario(kind: 'duplicate' | 'stale') {
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
  // Seed (gen2 applied) → A (late non-apply) → B (typed error, first).
  const order: Array<Promise<RemoteResponse>> = [
    Promise.resolve(projectionSuccess('t1', 2)),
    gateA,
    gateB,
  ]
  const store = createTeamProjectionStore({
    ...generationOnlyProjectionBindings,
    scheduler: makeManualScheduler(),
    getProjection: (_id) => {
      const gate = order.shift()
      if (gate === undefined) {
        return Promise.reject(new PushTransportLossError('gate exhausted'))
      }
      return gate
    },
  })
  await store.pull('t1')
  await flush()
  const afterSeed = store.getState()
  const pendingA = store.pull('t1')
  const pendingB = store.pull('t1')
  await flush()
  // B (started later) fails first with a typed RPC error.
  gates.resolveB?.(projectionError('team-remote-internal-error', 'internal error in remote handler'))
  await pendingB
  await flush()
  const afterB = store.getState()
  // A (started earlier) settles late: same generation (duplicate) or an
  // older generation (stale) — a non-apply verdict either way.
  gates.resolveA?.(kind === 'duplicate'
    ? projectionSuccess('t1', 2)
    : projectionSuccess('t1', 1))
  const assessmentA = await pendingA
  await flush()
  const afterA = store.getState()
  return { afterSeed, afterB, afterA, assessmentA }
}

const lateDuplicateAfterNewerErrorScenario = await lateNonApplyAfterNewerErrorScenario('duplicate')
const lateStaleAfterNewerErrorScenario = await lateNonApplyAfterNewerErrorScenario('stale')

/**
 * F1-T5: a LATE response of an EARLIER request carrying a genuinely
 * NEWER authoritative generation still applies normally — the request
 * sequence must not suppress the generation verdict.
 */
const lateApplyAfterNewerErrorScenario = await (async () => {
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
    Promise.resolve(projectionSuccess('t1', 10)),
    gateA,
    gateB,
  ]
  const store = createTeamProjectionStore({
    ...generationOnlyProjectionBindings,
    scheduler: makeManualScheduler(),
    getProjection: (_id) => {
      const gate = order.shift()
      if (gate === undefined) {
        return Promise.reject(new PushTransportLossError('gate exhausted'))
      }
      return gate
    },
  })
  await store.pull('t1')
  await flush()
  const pendingA = store.pull('t1')
  const pendingB = store.pull('t1')
  await flush()
  // B (started later) fails first with a typed RPC error.
  gates.resolveB?.(projectionError('team-remote-internal-error', 'internal error in remote handler'))
  await pendingB
  await flush()
  const afterB = store.getState()
  // A (started earlier) settles late with gen11 — strictly newer than
  // the applied gen10: the generation verdict must win.
  gates.resolveA?.(projectionSuccess('t1', 11))
  const assessmentA = await pendingA
  await flush()
  const afterA = store.getState()
  return { afterB, afterA, assessmentA }
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
    // A (gen6) settled late → stale, no frame overwrite — and (PR #34
    // review follow-up, F1) A's round trip was SUPERSEDED (B's
    // completed after A started), so A no longer owns the latest
    // assessment either: the newer round trip's assessment stays.
    expect(afterA.status).toBe('ready')
    expect(afterA.appliedGeneration).toBe(7)
    expect(afterA.frame?.projection.generation).toBe(7)
    expect(afterA.lastAssessment).toEqual({ status: 'apply', receivedGeneration: 7 })
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

  it('noteConnectionRestored (PR #35 follow-up, P1-5): clears the loss episode WITHOUT a pull; the in-flight pull late-loss opens a FRESH episode; the fresh episode recovers', () => {
    const {
      lostState,
      lostPending,
      notedState,
      notedPending,
      callsBeforeNote,
      callsAfterNote,
      afterLateLoss,
      afterLateLossPending,
      afterFirstRetry,
      afterRecovery,
      afterRecoveryPending,
      calls,
    } = notedRestoreScenario
    // The loss episode is open (reconnecting + one scheduled retry).
    expect(lostState.status).toBe('reconnecting')
    expect(lostState.retryAttempt).toBe(1)
    expect(lostPending).toBe(1)
    // The SPLIT notice: the pending retry is cancelled, the episode
    // counter restarts, the `reconnecting` status closes (the applied
    // frame is `ready` again — durable content stays valid across the
    // channel gap) — and NO pull fired (the invalidation pull is the
    // coordinator's round, not the store's lane).
    expect(notedState.status).toBe('ready')
    expect(notedState.retryAttempt).toBe(0)
    expect(notedState.nextRetryDelayMs).toBe(null)
    expect(notedState.appliedGeneration).toBe(1)
    expect(notedPending).toBe(0)
    expect(callsAfterNote).toBe(callsBeforeNote)
    // The in-flight pull settles LATE with a real loss: a FRESH episode
    // (one new retry — the notice did not advance the staleness
    // baseline; the S1-C3 invariant holds under the split).
    expect(afterLateLoss.status).toBe('reconnecting')
    expect(afterLateLoss.retryAttempt).toBe(1)
    expect(afterLateLossPending).toBe(1)
    // The fresh episode's first retry fails (500 ms) → attempt 2.
    expect(afterFirstRetry.status).toBe('reconnecting')
    expect(afterFirstRetry.retryAttempt).toBe(2)
    // The second retry (1000 ms) succeeds → ready with the fresh frame.
    expect(afterRecovery.status).toBe('ready')
    expect(afterRecovery.appliedGeneration).toBe(2)
    expect(afterRecovery.retryAttempt).toBe(0)
    expect(afterRecoveryPending).toBe(0)
    expect(calls).toEqual(['t1', 't1', 't1', 't1'])
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

describe('createTeamProjectionStore — loss staleness by round-trip evidence (repair 20260927, S1-C3)', () => {
  it('in-order success → the NEXT real transport loss is fresh: reconnecting + one retry (not dismissed)', () => {
    const {
      afterSuccess,
      assessment,
      afterLoss,
      pendingAfterLoss,
      afterRetry,
      pendingAfterRetry,
      calls,
    } = successThenLossScenario
    expect(afterSuccess.status).toBe('ready')
    expect(afterSuccess.appliedGeneration).toBe(1)
    expect(assessment).toEqual({ status: 'transport-loss', receivedGeneration: null })
    // The loss after a success is NOT stale: the episode opens.
    expect(afterLoss.status).toBe('reconnecting')
    expect(afterLoss.retryAttempt).toBe(1)
    expect(afterLoss.nextRetryDelayMs).toBe(500)
    expect(afterLoss.lastAssessment).toEqual({
      status: 'transport-loss',
      receivedGeneration: null,
    })
    // Exactly ONE retry scheduled (no double, no zero).
    expect(pendingAfterLoss).toBe(1)
    // The retry fires and succeeds → ready at the fresh generation.
    expect(afterRetry.status).toBe('ready')
    expect(afterRetry.appliedGeneration).toBe(2)
    expect(afterRetry.retryAttempt).toBe(0)
    expect(afterRetry.nextRetryDelayMs).toBe(null)
    expect(pendingAfterRetry).toBe(0)
    expect(calls).toEqual(['t1', 't1', 't1'])
  })

  it('restored-connection pull that fails: the loss is fresh — one retry is scheduled (the incident shape)', () => {
    const {
      lost,
      afterRestoredLoss,
      pendingAfterRestoredLoss,
      afterRecovery,
      pendingAfterRecovery,
      calls,
    } = restoredPullLossScenario
    expect(lost.status).toBe('reconnecting')
    expect(lost.retryAttempt).toBe(1)
    // The restore fired the invalidation pull, which failed with a real
    // loss: the old code dismissed it (channel declared connected
    // WITHOUT round-trip evidence) — the episode died stuck. The new
    // code re-opens it: reconnecting + exactly one retry.
    expect(afterRestoredLoss.status).toBe('reconnecting')
    expect(afterRestoredLoss.retryAttempt).toBe(1)
    expect(afterRestoredLoss.nextRetryDelayMs).toBe(500)
    expect(pendingAfterRestoredLoss).toBe(1)
    // The retry succeeds → ready.
    expect(afterRecovery.status).toBe('ready')
    expect(afterRecovery.appliedGeneration).toBe(1)
    expect(afterRecovery.retryAttempt).toBe(0)
    expect(pendingAfterRecovery).toBe(0)
    expect(calls).toEqual(['t1', 't1', 't1'])
  })

  it('typed error → recovery: the successful round trip (new generation) ends the error state', () => {
    const { afterError, afterRecovery } = typedErrorRecoveryScenario
    expect(afterError.status).toBe('error')
    expect(afterError.lastError?.code).toBe('remote-timeout')
    expect(afterRecovery.status).toBe('ready')
    expect(afterRecovery.appliedGeneration).toBe(2)
    expect(afterRecovery.lastError).toBe(undefined)
  })

  it('typed error → same-generation normal response: the duplicate success still ends the error state', () => {
    const { afterError, assessment, afterRecovery } = sameGenerationRecoveryScenario
    expect(afterError.status).toBe('error')
    expect(afterError.lastError?.code).toBe('remote-timeout')
    expect(assessment).toEqual({ status: 'duplicate', receivedGeneration: 1 })
    expect(afterRecovery.status).toBe('ready')
    expect(afterRecovery.appliedGeneration).toBe(1)
    expect(afterRecovery.lastError).toBe(undefined)
  })

  it('reset while a pull is in flight: the late success and the late loss are both dead (no state, no timer resurrection)', () => {
    const {
      afterResetA,
      afterResetAPending,
      afterLateA,
      afterLateAPending,
      afterResetB,
      afterLateB,
      afterLateBPending,
    } = lateRequestAfterResetScenario
    // (a) reset: idle, no pending retry.
    expect(afterResetA.status).toBe('idle')
    expect(afterResetA.teamSessionId).toBe(null)
    expect(afterResetAPending).toBe(0)
    // The late success of the OLD scope must not resurrect the frame.
    expect(afterLateA.status).toBe('idle')
    expect(afterLateA.teamSessionId).toBe(null)
    expect(afterLateA.frame).toBe(null)
    expect(afterLateAPending).toBe(0)
    // (b) reset again: idle, no pending retry.
    expect(afterResetB.status).toBe('idle')
    // The late LOSS of the old scope must not open a new episode.
    expect(afterLateB.status).toBe('idle')
    expect(afterLateB.teamSessionId).toBe(null)
    expect(afterLateB.retryAttempt).toBe(0)
    expect(afterLateB.nextRetryDelayMs).toBe(null)
    expect(afterLateBPending).toBe(0)
  })

  it('an earlier request fails LATE after a later request succeeded: ignored, no overwrite, no extra retry', () => {
    const { afterB, afterALoss, pendingAfterALoss } = staleLossAfterNewerSuccessScenario
    expect(afterB.status).toBe('ready')
    expect(afterB.appliedGeneration).toBe(2)
    // The stale loss must not disturb the newer success.
    expect(afterALoss.status).toBe('ready')
    expect(afterALoss.appliedGeneration).toBe(2)
    expect(afterALoss.retryAttempt).toBe(0)
    expect(afterALoss.nextRetryDelayMs).toBe(null)
    // And it must not have scheduled a retry.
    expect(pendingAfterALoss).toBe(0)
  })
})

describe('createTeamProjectionStore — request-order liveness authority (PR #34 review follow-up, F1)', () => {
  it('an earlier request settles LATE with a typed error after a later success: the newer success is not downgraded (F1-T1)', () => {
    const { afterB, afterA, assessmentA } = staleTypedErrorAfterNewerSuccessScenario
    expect(afterB.status).toBe('ready')
    expect(afterB.appliedGeneration).toBe(2)
    // A's pull still RESOLVES with its own typed-error assessment ...
    expect(assessmentA.status).toBe('rpc-error')
    // ... but it is no longer the newest round trip: it must not be
    // published over the newer success.
    expect(afterA.status).toBe('ready')
    expect(afterA.appliedGeneration).toBe(2)
    expect(afterA.frame?.projection.generation).toBe(2)
    expect(afterA.lastError).toBeUndefined()
  })

  it('an earlier request settles LATE with a foreign frame after a later success: the newer success is not downgraded (F1-T2)', () => {
    const { afterB, afterA, assessmentA } = staleForeignAfterNewerSuccessScenario
    expect(afterB.status).toBe('ready')
    expect(afterB.appliedGeneration).toBe(2)
    expect(assessmentA.status).toBe('foreign')
    expect(afterA.status).toBe('ready')
    expect(afterA.appliedGeneration).toBe(2)
    expect(afterA.frame?.projection.generation).toBe(2)
    expect(afterA.lastError).toBeUndefined()
  })

  it('an earlier request settles LATE with a provenance-mismatched frame after a later success: the newer success is not downgraded (F1-T2)', () => {
    const { afterB, afterA, assessmentA } = staleInconsistentAfterNewerSuccessScenario
    expect(afterB.status).toBe('ready')
    expect(afterB.appliedGeneration).toBe(2)
    expect(assessmentA.status).toBe('inconsistent')
    expect(afterA.status).toBe('ready')
    expect(afterA.appliedGeneration).toBe(2)
    expect(afterA.frame?.projection.generation).toBe(2)
    expect(afterA.lastError).toBeUndefined()
  })

  it('an earlier request settles LATE with a duplicate after a later typed error: the newer error is not cleared (F1-T3)', () => {
    const { afterSeed, afterB, afterA, assessmentA } = lateDuplicateAfterNewerErrorScenario
    expect(afterSeed.status).toBe('ready')
    expect(afterSeed.appliedGeneration).toBe(2)
    // B (started later) fails first: the error state is the newest fact.
    expect(afterB.status).toBe('error')
    expect(afterB.lastError?.code).toBe('team-remote-internal-error')
    expect(assessmentA.status).toBe('duplicate')
    // A's (older) duplicate must not clear B's error.
    expect(afterA.status).toBe('error')
    expect(afterA.lastError?.code).toBe('team-remote-internal-error')
    // The applied frame is untouched either way (G2).
    expect(afterA.appliedGeneration).toBe(2)
    expect(afterA.frame?.projection.generation).toBe(2)
  })

  it('an earlier request settles LATE with a stale frame after a later typed error: the newer error is not cleared (F1-T4)', () => {
    const { afterSeed, afterB, afterA, assessmentA } = lateStaleAfterNewerErrorScenario
    expect(afterSeed.status).toBe('ready')
    expect(afterSeed.appliedGeneration).toBe(2)
    expect(afterB.status).toBe('error')
    expect(afterB.lastError?.code).toBe('team-remote-internal-error')
    expect(assessmentA.status).toBe('stale')
    expect(afterA.status).toBe('error')
    expect(afterA.lastError?.code).toBe('team-remote-internal-error')
    expect(afterA.appliedGeneration).toBe(2)
    expect(afterA.frame?.projection.generation).toBe(2)
  })

  it('a late response of an earlier request carrying a genuinely newer generation still applies: the generation verdict wins (F1-T5)', () => {
    const { afterB, afterA, assessmentA } = lateApplyAfterNewerErrorScenario
    // B (started later) failed first — the error state is real ...
    expect(afterB.status).toBe('error')
    expect(afterB.appliedGeneration).toBe(10)
    // ... but A's late frame (gen11 > applied gen10) is authoritative:
    // the request sequence must not suppress the generation verdict.
    expect(assessmentA.status).toBe('apply')
    expect(afterA.status).toBe('ready')
    expect(afterA.appliedGeneration).toBe(11)
    expect(afterA.frame?.projection.generation).toBe(11)
    expect(afterA.lastError).toBeUndefined()
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
