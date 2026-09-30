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
 * Wire-contract neutrality (team-view-sync-complete + pre-alpha3 PR-F
 * F.3): the store carries NO wire-contract version. The pull's contract
 * is expressed by the two WRAPPER-BOUND semantic bindings injected
 * alongside it (`assessProjectionSync` + `extractPushFrame`, bound to
 * the SAME pull at the client wrapper boundary — the only client place
 * the wire version may appear): the freshness-pair pull assesses every
 * response against the applied freshness PAIR (`appliedGeneration` +
 * `appliedLiveToken`) and extracts the pair frame; a live-only apply
 * (equal durable generation, changed live token) records the new token
 * WITHOUT advancing `appliedGeneration` — the applied-generation advance
 * remains the client's single ledger-refresh trigger, so a live-only
 * apply never refreshes the ledger (frozen decision 4). The
 * generation-only pull keeps the frozen generation-only behavior
 * byte-identical (its extractor's durability facts stay `null`, so the
 * stale-apply guard below stays inert).
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
 * pull. (PR #35 follow-up, P1-5) the notice WITHOUT the pull —
 * `noteConnectionRestored` — is the split the read-state-driven
 * coordinator needs: the loss episode (pending retry, attempt counter,
 * the `reconnecting` status) is cleared, but the invalidation pull
 * belongs to the coordinator's connection-restored round; the store's
 * own backoff lane stays intact and independent.
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
 * Stale-apply guard (PR #35 follow-up, P0-3): the F1 request-order
 * authority previously governed only the NON-apply verdicts (the
 * applied frame was deliberately untouched by request order — G2 hard
 * invariant). The freshness PAIR (the pair-carrying pull's contract)
 * extended the exposure: an OLD same-generation response (typically a
 * live-only frame carrying an older `liveToken`) settling LATE than a
 * newer round trip would still `apply` and ROLL BACK the newer token /
 * frame. The guard closes that case: an apply verdict of a superseded
 * request is dropped when it carries no durable advance (the
 * wrapper-bound extractor's `durableGeneration` — the fact is
 * contract-bound at the client wrapper; for a generation-only pull it
 * is `null` and the guard stays inert, exactly as before the pair); a
 * late response with a genuinely NEWER durable generation still applies
 * (durable authority outranks request order).
 *
 * Request-order liveness authority (PR #34 review follow-up, F1): the
 * request sequence ALSO decides which completed response owns the UI
 * liveness/error state — a response of a request that a LATER request
 * already superseded (a valid round trip completed after it started)
 * is resolved but NOT published: an old typed error must not downgrade
 * a newer success, an old duplicate/stale must not clear a newer
 * error, and an old foreign/inconsistent must not downgrade a newer
 * success. `noteRoundTrip` still records every completed round trip
 * (loss-episode absorption, baseline monotonicity, pending-retry
 * cancellation) — only the liveness write is suppressed. Frame
 * authority is deliberately separate and stays with the frozen
 * generation verdict: a late response carrying a genuinely NEWER
 * authoritative generation still `apply`s normally (the request order
 * never suppresses the frame verdict).
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
  backoffCapMs,
  isApplyAssessment,
  pickBackoffDelayMs,
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
  /**
   * The live token of the applied frame (recorded only by the
   * freshness-pair pull — `null` for a generation-only pull and before
   * the first pair frame). Together with {@link appliedGeneration} this
   * is the pair-carrying pull's freshness PAIR — the applied durable
   * generation is the client's single ledger-refresh trigger and stays
   * UNCHANGED by a live-only apply (frozen decision 4).
   */
  readonly appliedLiveToken: string | null
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

/**
 * The version-AGNOSTIC applied-identity view the injected semantic
 * assessor consumes: the applied frame's freshness facts exactly as the
 * store records them (all fields `null` before the first applied frame,
 * or when the session is unbound). The wrapper-bound assessor maps this
 * view to the frozen assessor's identity shape of the pull's wire
 * contract — the version shape exists ONLY at the client wrapper
 * boundary, never here.
 */
export interface AppliedProjectionView {
  readonly teamSessionId: string | null
  readonly generation: number | null
  readonly liveToken: string | null
}

/**
 * The result of the injected semantic frame extractor: the frozen frame
 * DTO (whatever wire shape the pull's contract serves — the base
 * projection + provenance) plus the applied-state durability facts the
 * store's stale-apply guard consumes. `durableGeneration` / `liveToken`
 * are `null` when the pull's contract carries NO freshness pair — the
 * guard then stays inert, exactly as before the pair existed.
 */
export interface ExtractedProjection {
  readonly frame: RemotePushFrame | null
  readonly durableGeneration: number | null
  readonly liveToken: string | null
}

/**
 * The semantic store bindings of ONE projection pull: the pull itself
 * plus the two wrapper-bound semantic functions of that pull's wire
 * contract (the structural subset of
 * {@link TeamProjectionStoreOptions} — spreadable into the options).
 * The bindings must be bound to the SAME pull they are injected with;
 * the client wrapper is the single place that binding happens.
 */
export interface ProjectionStoreBindings {
  readonly getProjection: (teamSessionId: string) => Promise<RemoteResponse>
  readonly assessProjectionSync: TeamProjectionStoreOptions['assessProjectionSync']
  readonly extractPushFrame: TeamProjectionStoreOptions['extractPushFrame']
}

/** Store options (all dependencies injected; no hidden globals). */
export interface TeamProjectionStoreOptions {
  /**
   * The frozen projection pull. The store stays wire-contract-free:
   * the pull's contract is expressed by the two semantic bindings
   * below, which MUST be bound to this same pull (the client wrapper
   * is the only place the wire version may appear — pre-alpha3 PR-F
   * plan §F.3).
   */
  readonly getProjection: (teamSessionId: string) => Promise<RemoteResponse>
  /**
   * The wrapper-bound SEMANTIC assessor: assesses one response against
   * the store's applied-identity view. This is the frozen assessor of
   * the pull's wire contract, bound at the client wrapper boundary —
   * the generation-only contract keeps the frozen generation-only
   * verdict byte-identical; the freshness-pair contract assesses the
   * (durable generation, live token) PAIR (a strictly newer durable
   * generation applies and advances the durable view; an equal durable
   * generation with a changed live token applies the live overlay
   * WITHOUT advancing the durable generation; both equal is a
   * duplicate).
   */
  readonly assessProjectionSync: (
    applied: AppliedProjectionView,
    response: RemoteResponse,
  ) => ProjectionSyncAssessment
  /**
   * The wrapper-bound SEMANTIC frame extractor (same boundary rule):
   * extracts the frame of one response plus the applied-state
   * durability facts the stale-apply guard consumes (`null` for a
   * generation-only contract).
   */
  readonly extractPushFrame: (response: RemoteResponse) => ExtractedProjection
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
  /**
   * Note channel restoration WITHOUT the store-owned pull (PR #35
   * follow-up, P1-5: the store API split). The loss episode is cleared
   * (pending retry cancelled, attempt counter reset, the
   * `reconnecting` status closed — an applied frame is `ready` again,
   * a missing frame is `loading`) but NO invalidation pull fires: the
   * invalidation pull is the refresh coordinator's CONNECTION-RESTORED
   * round (the read-state-driven lane). The staleness baseline
   * (S1-C3 round-trip evidence) is untouched — a completed round trip
   * still absorbs an unabsorbed loss, and a NEW loss after the notice
   * still opens a new backoff episode.
   */
  noteConnectionRestored(): void
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
  // (pre-alpha3 PR-F F.3) the wrapper-bound semantic bindings of the
  // injected pull — the store carries no wire-contract version: the
  // assessor / extractor shapes are the pull's contract, bound at the
  // client wrapper boundary (one store per pull, fixed for the store's
  // lifetime).
  const assess = options.assessProjectionSync
  const extract = options.extractPushFrame

  let state: TeamProjectionState = {
    status: 'idle',
    teamSessionId: null,
    appliedGeneration: null,
    appliedLiveToken: null,
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

  /** The applied-identity VIEW (version-agnostic — the wrapper-bound
   *  assessor maps it to the frozen assessor's identity shape; all
   *  fields null before the first applied frame). */
  const appliedView = (): AppliedProjectionView =>
    state.frame === null || state.teamSessionId === null
      ? { teamSessionId: null, generation: null, liveToken: null }
      : {
          teamSessionId: state.teamSessionId,
          generation: state.appliedGeneration,
          liveToken: state.appliedLiveToken,
        }

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

    const assessment = assess(appliedView(), response)
    // (PR #34 review follow-up, F1) request-order LIVENESS authority,
    // captured BEFORE the baseline advances: a response whose request
    // an LATER request already superseded (a valid round trip
    // completed after it started) no longer owns the UI status /
    // lastError / lastAssessment. Frame authority is deliberately
    // separate and stays with the generation verdict below (a late
    // response of a genuinely newer generation still applies).
    const supersededByNewerRoundTrip = lastCompletedSeq > seq
    noteRoundTrip(seq)
    // A scope change while in flight: the request is DEAD — no publish.
    if (epoch !== epochAtStart) return assessment

    if (response.ok === false) {
      // (F1) an OLDER request's typed error must not downgrade a
      // NEWER completed round trip — it resolves (never rejects) but
      // is not published as the latest state.
      if (supersededByNewerRoundTrip) return assessment
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
      const extracted = extract(response)
      const frame = extracted.frame
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
      // (PR #35 follow-up, P0-3) the stale-APPLY guard (behavior
      // unchanged): a response whose request a LATER request already
      // superseded (the F1 round-trip evidence) must not roll back the
      // applied freshness state when it carries NO durable advance —
      // an old same-generation response (e.g. a live-only frame with an
      // older liveToken) that settles late would otherwise overwrite
      // the newer liveToken / frame of the round trip that already
      // completed. The durability fact comes from the wrapper-bound
      // extractor (contract-bound at the client wrapper — `null` for a
      // generation-only pull, where the guard stays inert exactly as
      // before the pair). The guard drops ONLY the no-advance case: a
      // late response carrying a genuinely NEWER durable generation
      // still applies (the frozen generation-verdict authority stands —
      // request order never suppresses a newer durable frame).
      if (
        supersededByNewerRoundTrip &&
        extracted.durableGeneration !== null &&
        state.appliedGeneration !== null &&
        extracted.durableGeneration <= state.appliedGeneration
      ) {
        return assessment
      }
      publish({
        ...state,
        teamSessionId,
        status: 'ready',
        appliedGeneration: assessment.receivedGeneration,
        // (team-view-sync-complete, frozen decision 4) the pair-carrying
        // apply records the PAIR. The live-only case (equal durable
        // generation, changed token) advances the token while
        // appliedGeneration stays UNCHANGED — the applied-generation
        // advance is the client's single ledger-refresh trigger, so a
        // live-only apply never refreshes the ledger. The
        // generation-only contract carries no token fact — the prior
        // value is kept (byte-identical pre-pair behavior).
        appliedLiveToken: extracted.liveToken ?? state.appliedLiveToken,
        frame,
        lastError: undefined,
        lastAssessment: assessment,
        retryAttempt: 0,
        nextRetryDelayMs: null,
      })
      return assessment
    }

    // (F1) Superseded non-apply verdicts no longer touch the newest
    // liveness state: an old duplicate/stale must not clear a newer
    // request's error, and an old foreign/inconsistent must not
    // downgrade a newer success. (The applied frame was never touched
    // by any verdict except `apply` — G2 hard invariant.)
    if (supersededByNewerRoundTrip) return assessment

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

  const noteConnectionRestored = (): void => {
    if (state.teamSessionId === null) return
    // (PR #35 follow-up, P1-5) the split: clear the loss episode ONLY —
    // the invalidation pull belongs to the coordinator's
    // connection-restored round, not to the store's channel-notice
    // lane. The staleness baseline (lastCompletedSeq / openLossSeq) is
    // deliberately NOT touched (S1-C3: the channel notice is never
    // round-trip evidence; a NEW loss after the notice still opens a
    // fresh episode, and a completed round trip still absorbs an
    // unabsorbed one).
    cancelPendingRetry()
    // Frozen P2-T6 / P8 semantics: a restored connection restarts the
    // backoff episode (the attempt counter resets on connect).
    const cleared: TeamProjectionState = {
      ...state,
      retryAttempt: 0,
      nextRetryDelayMs: null,
    }
    if (state.status === 'reconnecting') {
      // The episode is closed by the notice: an applied frame is
      // `ready` again (durable content stays valid across the channel
      // gap); a missing frame is `loading` (the coordinator's round
      // pulls — the applied identity is missing, so its pair verdict is
      // "changed" by definition — and the settlement clears the status).
      publish({ ...cleared, status: state.frame !== null ? 'ready' : 'loading' })
    } else {
      publish(cleared)
    }
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
      appliedLiveToken: null,
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
    noteConnectionRestored,
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
