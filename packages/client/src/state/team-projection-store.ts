/**
 * P9-T3 (S2-B) — the generation-safe Team projection store.
 *
 * REIMPLEMENT orchestration per plan §6.2; the verdict algorithm is
 * REUSED, never reimplemented: every incoming response is assessed by
 * the frozen `assessProjectionSync` (which lifts `decideFrameVerdict`
 * onto the response) and a frame is written to the store ONLY when the
 * assessment is `apply` — the hard invariant: no response may write to
 * the store before the generation check. A delayed, duplicated,
 * out-of-order, foreign, or provenance-mismatched response can never
 * overwrite newer state (gate G2).
 *
 * The store is React-free (data-object layer per the web client
 * stack rules): a bare observable source — stable snapshot between
 * changes, `subscribe`/`getSnapshot` — plus pull/transport actions.
 * The browser binding (framework `useStore` seat or a hook composed at
 * the T9 mount site) is deliberately NOT owned here.
 *
 * Reconnect policy (Seam 5: no push channel exists, so sync is
 * invalidation + pull): a transport loss or a rejected pull enters
 * `reconnecting` and schedules ONE retry through the frozen backoff
 * helpers (`backoffCapMs` + `pickBackoffDelayMs`, deterministic lower
 * bound by default); `markConnectionRestored` fires the invalidation
 * pull.
 *
 * Loss-staleness (repair 20260927, S1-C3): a FAILED REQUEST's
 * transport loss is stale ONLY when a request that started LATER
 * already completed a valid round trip (the request-sequence
 * comparison — `lastCompletedSeq > seq`). The old heuristic (an
 * internal `connected` channel flag that `markConnectionRestored` set
 * WITHOUT round-trip evidence) dismissed the very loss that fired
 * after the restored-connection pull failed, killing the episode with
 * no retry scheduled and the surface stuck. The channel event is
 * transport notice, never round-trip evidence: the staleness baseline
 * advances only when a pull actually completes. A reset / scope
 * switch bumps the epoch: an in-flight pull of the old scope is DEAD
 * on settlement (no publish, no schedule, no timer resurrection).
 * A loss report while a retry is already pending (or a retry pull is
 * already in flight) does not double-schedule, and every completed
 * round trip that passes the newest open loss cancels the pending
 * retry. The backoff tunables and the scheduler are CLIENT_LOCAL
 * transport policy — never authority: authority always comes from the
 * next fresh `team.getProjection` response. No native timer is
 * assumed by the store logic (the default scheduler may use
 * `setTimeout`; tests inject a manual scheduler).
 *
 * Failure discipline: a typed RPC error is stored as `lastError` (the
 * frozen `RemoteErrorResult`, never exception-ified); only a
 * transport-level rejection (`PushTransportLossError` class) drives
 * the reconnect path.
 *
 * Pure module: no React, no I/O. Erasable TS only.
 * @module @dsh-agent-team/client/state/team-projection-store
 */

import {
  assessProjectionSync,
  backoffCapMs,
  extractPushFrame,
  isApplyAssessment,
  pickBackoffDelayMs,
  type AppliedProjectionIdentity,
  type ProjectionSyncAssessment,
  type PushBackoffConfig,
  type RemoteErrorResult,
  type RemotePushFrame,
  type RemoteResponse,
} from '../../../remote/src/index.js'

/** The UI-facing liveness of the projection store (plan §6.2 state). */
export type TeamProjectionStatus =
  | 'idle'
  | 'loading'
  | 'ready'
  | 'reconnecting'
  | 'error'

/**
 * One published store snapshot (immutable; the reference is stable
 * until the next change — `getState` never rebuilds).
 */
export interface TeamProjectionState {
  /** The liveness status (plan §6.2 minimal state set). */
  readonly status: TeamProjectionStatus
  /** The TeamSession id this store is bound to (null before first pull). */
  readonly teamSessionId: string | null
  /** The generation of the applied frame (null before first frame). */
  readonly appliedGeneration: number | null
  /** The applied whole-projection frame (frozen DTO + provenance). */
  readonly frame: RemotePushFrame | null
  /** The last typed RPC error (the frozen `error` block, intact), if any. */
  readonly lastError?: RemoteErrorResult['error']
  /** The last pull assessment (frozen, closed status set). */
  readonly lastAssessment: ProjectionSyncAssessment | null
  /** The current reconnect backoff attempt (0 when healthy). */
  readonly retryAttempt: number
  /** The delay of the scheduled retry, ms (null when none pending). */
  readonly nextRetryDelayMs: number | null
}

/** The CLIENT_LOCAL retry scheduler (tests inject a manual one). */
export interface TeamProjectionScheduler {
  /**
   * Schedule one task after `delayMs`.
   * @returns a handle accepted by `cancel`.
   */
  schedule(delayMs: number, task: () => void): number
  /** Cancel one scheduled task (idempotent no-op for unknown handles). */
  cancel(handle: number): void
}

/** Store options (all dependencies injected; no hidden globals). */
export interface TeamProjectionStoreOptions {
  /** The frozen projection pull (TeamRemoteClient.getProjection). */
  readonly getProjection: (teamSessionId: string) => Promise<RemoteResponse>
  /** CLIENT_LOCAL backoff tunables (frozen formula, local numbers). */
  readonly backoff?: PushBackoffConfig
  /** The retry scheduler (default: setTimeout-backed). */
  readonly scheduler?: TeamProjectionScheduler
}

/** The store surface (observable source + pull/transport actions). */
export interface TeamProjectionStore {
  /** The current snapshot (stable reference between changes). */
  getState(): TeamProjectionState
  /** Subscribe to snapshot changes; returns the disposer. */
  subscribe(listener: () => void): () => void
  /**
   * Pull one `team.getProjection` round trip and apply the generation
   * verdict.
   * @returns the frozen assessment of the round trip (`transport-loss`
   *   when the channel rejected).
   */
  pull(teamSessionId: string): Promise<ProjectionSyncAssessment>
  /** Note a channel loss (schedules the backoff retry, once). */
  markConnectionLost(): void
  /** Note channel restoration (cancels the retry, fires the pull). */
  markConnectionRestored(): void
  /** Drop all state (view switch / team change); cancels pending retry. */
  reset(): void
}

/**
 * The CLIENT_LOCAL default backoff (transport policy, never authority):
 * 1s base, ×2 per attempt, capped at 30s (frozen formula, local
 * tunables — plan Trap B: no backend push, the client owns the retry).
 */
export const DEFAULT_TEAM_PROJECTION_BACKOFF: PushBackoffConfig = {
  baseMs: 1000,
  factor: 2,
  maxMs: 30000,
}

/**
 * Create one projection store bound to one projection pull.
 * @param options - injected pull + CLIENT_LOCAL transport policy.
 * @returns the store (a bare observable source + actions).
 */
export function createTeamProjectionStore(
  options: TeamProjectionStoreOptions,
): TeamProjectionStore {
  const backoff: PushBackoffConfig =
    options.backoff === undefined ? DEFAULT_TEAM_PROJECTION_BACKOFF : options.backoff
  const scheduler: TeamProjectionScheduler =
    options.scheduler === undefined ? createDefaultScheduler() : options.scheduler

  let state: TeamProjectionState = {
    status: 'idle',
    teamSessionId: null,
    appliedGeneration: null,
    frame: null,
    lastAssessment: null,
    retryAttempt: 0,
    nextRetryDelayMs: null,
  }
  const listeners = new Set<() => void>()
  let pendingRetry: number | null = null
  // (repair 20260927, S1-C3) request-sequence + epoch staleness — the
  // frozen round-trip evidence replaces the old channel flag:
  //   requestSeq        — monotonic; each pull start increments it.
  //   lastCompletedSeq  — the highest seq that completed a VALID round
  //                       trip (any response, ok or typed error).
  //   openLossSeq       — the highest seq of an UN-ABSORBED transport
  //                       loss (0 = no open episode).
  //   epoch             — bumped on reset / scope switch: an in-flight
  //                       pull of an older epoch is DEAD on settlement
  //                       (no publish, no schedule, no resurrection).
  //   retryPullInFlight / nextPullIsRetry — the scheduled retry is
  //                       itself one in-flight pull: it may reschedule
  //                       the next attempt on its own failure, and a
  //                       loss report while it runs must not
  //                       double-schedule.
  let requestSeq = 0
  let lastCompletedSeq = 0
  let openLossSeq = 0
  let epoch = 0
  let retryPullInFlight = false
  let nextPullIsRetry = false

  const publish = (next: TeamProjectionState): void => {
    state = next
    for (const listener of [...listeners]) listener()
  }

  const cancelPendingRetry = (): void => {
    if (pendingRetry === null) return
    scheduler.cancel(pendingRetry)
    pendingRetry = null
  }

  const appliedIdentity = (): AppliedProjectionIdentity | null =>
    state.frame === null || state.teamSessionId === null
      ? null
      : { teamSessionId: state.teamSessionId, generation: state.appliedGeneration }

  /**
   * Schedule the backoff retry (one pending at a time) and publish the
   * `reconnecting` snapshot.
   * @param base - the snapshot to advance (session already bound).
   */
  const scheduleRetry = (base: TeamProjectionState): void => {
    const attempt = base.retryAttempt + 1
    const capMs = backoffCapMs(attempt, backoff)
    const delayMs = pickBackoffDelayMs(capMs)
    cancelPendingRetry()
    const session = base.teamSessionId
    pendingRetry = scheduler.schedule(delayMs, () => {
      pendingRetry = null
      if (session === null) return
      // The scheduled retry is itself ONE in-flight pull: mark it so
      // (a) its own failure can reschedule the next attempt, and (b)
      // loss reports while it runs do not double-schedule.
      nextPullIsRetry = true
      retryPullInFlight = true
      void pull(session).then(() => {
        retryPullInFlight = false
      })
    })
    publish({
      ...base,
      status: 'reconnecting',
      lastAssessment: { status: 'transport-loss', receivedGeneration: null },
      retryAttempt: attempt,
      nextRetryDelayMs: delayMs,
    })
  }

  /**
   * A completed round trip (any response): the staleness baseline
   * advances; when it passes the newest open loss the loss episode is
   * absorbed (the pending retry is useless — cancelled).
   */
  const noteRoundTrip = (seq: number): void => {
    lastCompletedSeq = Math.max(lastCompletedSeq, seq)
    if (lastCompletedSeq > openLossSeq) {
      openLossSeq = 0
      cancelPendingRetry()
    }
  }

  const pull = async (teamSessionId: string): Promise<ProjectionSyncAssessment> => {
    const seq = ++requestSeq
    const epochAtStart = epoch
    const isRetryAttempt = nextPullIsRetry
    nextPullIsRetry = false
    cancelPendingRetry()
    // First data for this session: the surface shows loading. A
    // background refresh keeps its current status until the outcome.
    // The just-cancelled retry no longer exists: no pending delay.
    publish({
      ...state,
      teamSessionId,
      status: state.frame === null && state.status !== 'ready' ? 'loading' : state.status,
      nextRetryDelayMs: null,
    })

    let response: RemoteResponse
    try {
      response = await options.getProjection(teamSessionId)
    } catch {
      // Transport-level rejection (frozen: PushTransportLossError is
      // the only kind the seam carrier rejects with).
      const assessment: ProjectionSyncAssessment = {
        status: 'transport-loss',
        receivedGeneration: null,
      }
      // (repair 20260927, S1-C3) a scope change (reset / team switch)
      // while this pull was in flight: the request is DEAD — no
      // publish, no schedule, no timer resurrection.
      if (epoch !== epochAtStart) return assessment
      // STALE: a request that started LATER already completed a valid
      // round trip — the world moved past this loss; ignore it (no
      // publish, no schedule).
      if (lastCompletedSeq > seq) return assessment
      // FRESH: this loss opens (or continues) the episode.
      openLossSeq = Math.max(openLossSeq, seq)
      if (pendingRetry !== null) {
        // A loss was already recorded while this pull was in flight:
        // the pending retry stands — no double schedule, no churn.
        return assessment
      }
      if (retryPullInFlight && !isRetryAttempt) {
        // A scheduled retry pull (from another request) is in flight:
        // it reports its own outcome — no second schedule.
        return assessment
      }
      // First loss record, or the pending retry itself failed again:
      // schedule the next backoff attempt (the episode continues).
      scheduleRetry({ ...state, teamSessionId })
      return assessment
    }

    const assessment = assessProjectionSync(appliedIdentity(), response)
    noteRoundTrip(seq)
    // A scope change while in flight: the request is DEAD — no publish.
    if (epoch !== epochAtStart) return assessment

    if (response.ok === false) {
      // Typed RPC error: stored intact, never exception-ified.
      publish({
        ...state,
        teamSessionId,
        status: 'error',
        lastError: response.error,
        lastAssessment: assessment,
        retryAttempt: 0,
        nextRetryDelayMs: null,
      })
      return assessment
    }

    if (isApplyAssessment(assessment)) {
      const frame = extractPushFrame(response)
      if (frame === null) {
        // Unreachable by the frozen contract (apply ⟹ usable frame);
        // treat it as the inconsistent class rather than a write.
        publish({
          ...state,
          teamSessionId,
          status: 'error',
          lastAssessment: { status: 'inconsistent', receivedGeneration: null },
          retryAttempt: 0,
          nextRetryDelayMs: null,
        })
        return { status: 'inconsistent', receivedGeneration: null }
      }
      publish({
        ...state,
        teamSessionId,
        status: 'ready',
        appliedGeneration: assessment.receivedGeneration,
        frame,
        lastError: undefined,
        lastAssessment: assessment,
        retryAttempt: 0,
        nextRetryDelayMs: null,
      })
      return assessment
    }

    // Non-apply verdicts: the applied frame is never touched (G2 hard
    // invariant). duplicate / stale are normal ordering events — an
    // existing frame stays `ready`; foreign / inconsistent are source
    // anomalies — surface `error` (the frame is kept, never discarded,
    // but the stale data is not presented as current).
    if (assessment.status === 'duplicate' || assessment.status === 'stale') {
      publish({
        ...state,
        teamSessionId,
        status: state.frame !== null ? 'ready' : 'error',
        // (repair 20260927, S1-C3) a successful recovery — including a
        // same-generation (duplicate) normal response — ENDS the error
        // state: an old typed error from a prior failed pull must not
        // keep being presented.
        lastError: state.frame !== null ? undefined : state.lastError,
        lastAssessment: assessment,
        retryAttempt: 0,
        nextRetryDelayMs: null,
      })
    } else {
      publish({
        ...state,
        teamSessionId,
        status: 'error',
        lastAssessment: assessment,
        retryAttempt: 0,
        nextRetryDelayMs: null,
      })
    }
    return assessment
  }

  const markConnectionLost = (): void => {
    if (state.teamSessionId === null) return
    // The episode already has a retry (pending, or the retry pull
    // itself in flight): do not double-schedule (frozen once-per-
    // episode discipline).
    if (pendingRetry !== null || retryPullInFlight) return
    // A channel loss is a channel-level report, not a request loss:
    // its staleness position is "now" (the newest pull started), so
    // only a round trip from a LATER request absorbs it.
    openLossSeq = Math.max(openLossSeq, requestSeq)
    scheduleRetry({ ...state })
  }

  const markConnectionRestored = (): void => {
    if (state.teamSessionId === null) return
    // (repair 20260927, S1-C3) the channel event is transport NOTICE,
    // never round-trip evidence: cancel the pending retry and fire the
    // invalidation pull, but do NOT advance the staleness baseline —
    // that happens only when the pull actually completes
    // (noteRoundTrip). The old code declared "connected" here, so the
    // very loss this event fired, failing in flight, was dismissed as
    // stale — the episode died with no retry left and the surface
    // stayed stuck.
    cancelPendingRetry()
    // Frozen P2-T6 / P8 semantics: a restored connection restarts the
    // backoff episode (the attempt counter resets on connect — the P8
    // test client's `markConnected`).
    publish({ ...state, retryAttempt: 0, nextRetryDelayMs: null })
    void pull(state.teamSessionId)
  }

  const reset = (): void => {
    // (repair 20260927, S1-C3) a scope change: bump the epoch so every
    // in-flight pull of the old scope is dead on settlement (no
    // publish, no schedule, no timer resurrection).
    epoch += 1
    cancelPendingRetry()
    retryPullInFlight = false
    nextPullIsRetry = false
    publish({
      status: 'idle',
      teamSessionId: null,
      appliedGeneration: null,
      frame: null,
      lastAssessment: null,
      retryAttempt: 0,
      nextRetryDelayMs: null,
    })
  }

  return {
    getState: () => state,
    subscribe(listener) {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
    pull,
    markConnectionLost,
    markConnectionRestored,
    reset,
  }
}

/**
 * The default scheduler: setTimeout-backed (browser/node). Replaceable
 * via options for deterministic tests.
 */
function createDefaultScheduler(): TeamProjectionScheduler {
  const timers = new Map<number, ReturnType<typeof setTimeout>>()
  let nextHandle = 1
  return {
    schedule(delayMs, task) {
      const handle = nextHandle++
      const timer = setTimeout(task, delayMs)
      timers.set(handle, timer)
      return handle
    },
    cancel(handle) {
      const timer = timers.get(handle)
      if (timer === undefined) return
      timers.delete(handle)
      clearTimeout(timer)
    },
  }
}
