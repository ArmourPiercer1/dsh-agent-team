/**
 * team-view-sync-complete (frozen decisions 2 + 5; PR #35 follow-up) —
 * the mount-level per-SESSION refresh coordinator.
 *
 * Client-owned polling, NO server push: while a session's Team view is
 * VISIBLE (attached) and the host tab is visible, one 3s tick per
 * session fires a refresh ROUND. Hidden (detached or tab-hidden) →
 * paused: the ticks stop, no rounds.
 *
 * The ROUND (PR #35 follow-up — the read-state-driven flow, frozen
 * §1.2): the session is probed with the LIGHTWEIGHT v6
 * `team.getReadState` (the authoritative ownership + the freshness
 * PAIR), and a full `team.getProjection` pull happens ONLY when the
 * probe says the pair (or the applied identity) actually changed:
 *
 * - probe `none` (positively confirmed) → the round ends with the
 *   authoritative no-team result; NO projection request is made;
 * - probe `team-root` / `team-member` → the owning root is
 *   `teamSessionId`; the applied identity of that root's projection
 *   store is compared (team id + durableGeneration + liveToken);
 *   unchanged → the round ends as a no-op (NO projection request);
 *   changed (or no applied frame yet) → the full projection pull;
 * - probe `remote-error` / `malformed` / `transport-loss` → fail
 *   closed: no ownership conclusion, no projection pull (a malformed
 *   success is NEVER degraded to `none`; a lost probe never drops a
 *   team).
 *
 * The coordinator UNIFIES the refresh trigger sources (frozen decision
 * 5 — extended): the 3s tick, the manual view refresh, the
 * post-mutation-success refresh, the visibility-resume immediate
 * trigger, and the CONNECTION-RESTORED immediate trigger (the channel
 * notice enters the coordinator lane — the store's own backoff retry
 * lane stays separate). Per session there is ONE in-flight round
 * (`single-flight`) and a dirty flag that COALESCES triggers arriving
 * while a round is in flight: the forced round runs exactly once after
 * the in-flight round settles. A failed probe / pull is a resolved
 * outcome — the coordinator NEVER re-fires the mutation that preceded
 * it (mutations are one-shot UI RPCs; only the read is repeated).
 *
 * The forced rounds (manual / mutation / resume / connection-restored)
 * always run; only the TICK respects the tab-hidden pause (an explicit
 * trigger is an event, not polling). The store's channel-episode pulls
 * (the backoff retry) remain a SEPARATE frozen lane that shares the
 * same generation-safe store pull — the F1 request-order liveness + the
 * generation verdict remain the final authority for both lanes.
 *
 * Pure module: no DOM, no timers of its own (the timer is injected;
 * tests use a manual one), no React. Erasable TS only.
 * @module @dsh-agent-team/client/state/team-refresh-coordinator
 */

import type {
  AppliedProjectionIdentityV6,
  ProjectionSyncAssessment,
} from '../../../remote/src/index.js'
import type {
  TeamReadStateOutcome,
} from './team-read-state.js'

/** The refresh trigger sources (closed set, frozen decision 5 — the
 *  PR #35 follow-up adds `connection-restored`: the channel restore
 *  notice enters the coordinator lane as a forced immediate round). */
export type TeamRefreshTrigger =
  | 'manual'
  | 'tick'
  | 'mutation'
  | 'resume'
  | 'connection-restored'

/** The injectable timer (default: setTimeout/setInterval-backed). */
export interface TeamRefreshCoordinatorTimer {
  /** Arm a repeating task; returns the handle accepted by `clear`. */
  setInterval(callback: () => void, delayMs: number): number
  /** Disarm one repeating task (idempotent no-op for unknown handles). */
  clearInterval(handle: number): void
}

/** One completed refresh round (the frozen §1.2 flow result). */
export interface TeamRefreshRoundResult {
  /** The probe outcome, INTACT (ok / remote-error / malformed /
   *  transport-loss). The mount layer records it into the per-session
   *  read-state store (the authoritative ownership + the pair). */
  readonly readState: TeamReadStateOutcome
  /** The projection round-trip assessment — `null` when the round
   *  made NO projection request (no-team, unchanged pair, or a
   *  failed-closed probe). */
  readonly projectionAssessment: ProjectionSyncAssessment | null
}

/** Coordinator options (all dependencies injected; no hidden globals). */
export interface TeamRefreshCoordinatorOptions {
  /**
   * The LIGHTWEIGHT probe (frozen §1.2): one `team.getReadState` for
   * one session. Resolves with the closed outcome (the async resolver
   * never rejects — the transport loss is a resolved outcome).
   */
  readonly readState: (sessionId: string) => Promise<TeamReadStateOutcome>
  /**
   * The full projection pull for one owning root (executed ONLY when
   * the probe decides the applied identity changed / is missing).
   * Resolves with the frozen assessment (the store pull never
   * rejects — a transport loss is the resolved assessment).
   */
  readonly pullProjection: (teamSessionId: string) => Promise<ProjectionSyncAssessment>
  /**
   * The applied identity of one root's projection store (the freshness
   * PAIR + team id) — `null` before the first applied frame. The
   * round compares it against the probe's pair to decide whether the
   * full pull is needed.
   */
  readonly getAppliedIdentity: (
    teamSessionId: string,
  ) => AppliedProjectionIdentityV6 | null
  /**
   * The per-session read-state recorder (the mount wires it to the
   * read-state store that TeamView subscribes through the hooks
   * compartment). Called with the probe outcome IMMEDIATELY when the
   * probe settles — before the optional projection pull — so the
   * ownership surface updates even on the no-pull rounds.
   */
  readonly onReadState?: (
    sessionId: string,
    outcome: TeamReadStateOutcome,
  ) => void
  /** The tick cadence, ms (frozen default 3000). */
  readonly tickMs?: number
  /** The repeating-timer facade (default: setInterval-backed). */
  readonly timer?: TeamRefreshCoordinatorTimer
}

/** The coordinator surface (per-session attach/detach + forced
 *  triggers). */
export interface TeamRefreshCoordinator {
  /**
   * Arm the 3s visible tick for one session (idempotent). Called by
   * the Team view on mount / session change.
   */
  attach(sessionId: string): void
  /**
   * Disarm the tick for one session (idempotent). Called by the Team
   * view on unmount / session change. Pending coalesced forced rounds
   * are dropped and their callers settle with the last settled round
   * (the session's view is gone; the store state stays).
   */
  detach(sessionId: string): void
  /**
   * One FORCED round (manual / mutation / resume / connection-restored):
   * always runs — if a round is already in flight for the session, the
   * trigger is coalesced into the dirty follow-up that runs after the
   * in-flight round settles. For an UNATTACHED session the round runs
   * ungated (the cold create-success path targets a team whose view is
   * not mounted yet; its probe answers the fresh root's read-state).
   * @returns the result of the round that satisfies this trigger
   *   (the follow-up's result when coalesced).
   */
  trigger(sessionId: string, reason: TeamRefreshTrigger): Promise<TeamRefreshRoundResult>
  /** Pause the TICKS (host tab hidden). Forced triggers still run. */
  pause(): void
  /**
   * Resume the TICKS (host tab visible) and fire the immediate resume
   * trigger for EVERY attached session (frozen decision 2: visibility
   * resume → immediate trigger).
   */
  resume(): void
  /** The currently attached session ids (a stable copy). */
  attached(): readonly string[]
  /** Whether the ticks are paused. */
  isPaused(): boolean
}

/** The per-session entry (private). */
interface SessionEntry {
  /** The armed tick handle (null when disarmed). */
  timer: number | null
  /** Whether one coordinator-owned round is in flight. */
  inFlight: boolean
  /** Whether a forced trigger coalesced while a round was in flight. */
  dirty: boolean
  /**
   * The coalesced trigger callers, waiting for the follow-up round's
   * result. Settle order = push order.
   */
  followUpWaiters: Array<(result: TeamRefreshRoundResult) => void>
  /** The last settled coordinator-owned round result (or null). */
  lastResult: TeamRefreshRoundResult | null
}

/**
 * Run ONE refresh round for one session (the frozen §1.2 flow): probe
 * → (conditional) pull. NEVER rejects (every dependency resolves with
 * a closed outcome / assessment).
 */
async function runRound(
  options: TeamRefreshCoordinatorOptions,
  sessionId: string,
): Promise<TeamRefreshRoundResult> {
  const outcome = await options.readState(sessionId)
  if (outcome.status !== 'ok') {
    // Fail closed: remote-error / malformed / transport-loss — no
    // ownership conclusion (a malformed success is NEVER degraded to
    // `none`), no projection pull. The recorder still sees the outcome
    // (the mount surfaces / logs it per its own policy).
    options.onReadState?.(sessionId, outcome)
    return { readState: outcome, projectionAssessment: null }
  }
  options.onReadState?.(sessionId, outcome)
  const relation = outcome.relation
  if (relation.kind === 'none') {
    // The authoritative no-team result (frozen §1.2): NO projection
    // request is made for an ordinary session.
    return { readState: outcome, projectionAssessment: null }
  }
  // Team relation: the owning root + the freshness PAIR.
  const applied = options.getAppliedIdentity(relation.teamSessionId)
  const changed =
    applied === null ||
    applied.teamSessionId !== relation.teamSessionId ||
    applied.durableGeneration !== relation.durableGeneration ||
    applied.liveToken !== relation.liveToken
  if (!changed) {
    // Unchanged pair + identity: the round ends as a no-op — the
    // lightweight probe was enough (the frozen target: visible session
    // → every 3s → getReadState → compare → pull ONLY when needed).
    return { readState: outcome, projectionAssessment: null }
  }
  const projectionAssessment = await options.pullProjection(relation.teamSessionId)
  return { readState: outcome, projectionAssessment }
}

/**
 * Create one refresh coordinator over the read-state probe + the
 * gated projection pull.
 * @param options - the injected probe / pull / identity / cadence /
 *   timer.
 * @returns the coordinator surface.
 */
export function createTeamRefreshCoordinator(
  options: TeamRefreshCoordinatorOptions,
): TeamRefreshCoordinator {
  const tickMs: number = options.tickMs === undefined ? 3000 : options.tickMs
  const timer: TeamRefreshCoordinatorTimer =
    options.timer === undefined ? createDefaultTimer() : options.timer

  const entries = new Map<string, SessionEntry>()
  let paused = false

  const armTick = (sessionId: string): void => {
    const entry = entries.get(sessionId)
    if (entry === undefined || entry.timer !== null) return
    entry.timer = timer.setInterval(() => {
      // The tick respects the tab-hidden pause (an explicit trigger is
      // an event and is NOT gated — see `trigger`).
      if (paused) return
      void trigger(sessionId, 'tick')
    }, tickMs)
  }

  const disarmTick = (entry: SessionEntry): void => {
    if (entry.timer === null) return
    timer.clearInterval(entry.timer)
    entry.timer = null
  }

  /**
   * Run ONE round for an attached session and, on settle, drain the
   * dirty follow-up (which settles the coalesced trigger callers).
   */
  const startRound = (sessionId: string): Promise<TeamRefreshRoundResult> => {
    const entry = entries.get(sessionId)
    if (entry === undefined) return runRound(options, sessionId)
    entry.inFlight = true
    const round = runRound(options, sessionId).then((result) => {
      entry.lastResult = result
      return result
    })
    void round.then(
      (result) => {
        entry.inFlight = false
        const waiters = entry.followUpWaiters.splice(0)
        if (entry.dirty && entries.get(sessionId) === entry) {
          // The forced follow-up runs (it is a FORCED round — even
          // while the tab is hidden the event-triggered round is owed).
          entry.dirty = false
          void startRound(sessionId).then(
            (followUp) => {
              for (const waiter of waiters) waiter(followUp)
            },
            (error) => {
              // Defensive: runRound never rejects; a rejection settles
              // the waiters with a transport-loss round rather than
              // hanging the UI.
              const fallback: TeamRefreshRoundResult = {
                readState: { status: 'transport-loss', message: 'coordinator round rejected' },
                projectionAssessment: null,
              }
              for (const waiter of waiters) waiter(fallback)
              void error
            },
          )
        } else {
          // Detached (or nothing coalesced): the coalesced callers
          // settle with THIS round's result — the follow-up is
          // dropped, the view is gone.
          for (const waiter of waiters) waiter(result)
        }
      },
      (error) => {
        // Defensive (runRound never rejects): settle the in-flight
        // state + the waiters so nothing hangs.
        entry.inFlight = false
        const waiters = entry.followUpWaiters.splice(0)
        const fallback: TeamRefreshRoundResult = {
          readState: { status: 'transport-loss', message: 'coordinator round rejected' },
          projectionAssessment: null,
        }
        for (const waiter of waiters) waiter(fallback)
        void error
      },
    )
    return round
  }

  const trigger = (
    sessionId: string,
    _reason: TeamRefreshTrigger,
  ): Promise<TeamRefreshRoundResult> => {
    const entry = entries.get(sessionId)
    if (entry === undefined) {
      // Unattached (the cold create-success path targets the NEW root
      // before its view mounts): the forced round runs UNGATED.
      return runRound(options, sessionId)
    }
    if (!entry.inFlight) return startRound(sessionId)
    // Single-flight: coalesce into the dirty follow-up. The caller
    // awaits the FOLLOW-UP round (the forced round), not the in-flight
    // one.
    entry.dirty = true
    return new Promise<TeamRefreshRoundResult>((resolve) => {
      entry.followUpWaiters.push(resolve)
    })
  }

  const attach = (sessionId: string): void => {
    let entry = entries.get(sessionId)
    if (entry === undefined) {
      entry = {
        timer: null,
        inFlight: false,
        dirty: false,
        followUpWaiters: [],
        lastResult: null,
      }
      entries.set(sessionId, entry)
    }
    if (!paused) armTick(sessionId)
  }

  const detach = (sessionId: string): void => {
    const entry = entries.get(sessionId)
    if (entry === undefined) return
    disarmTick(entry)
    // The dirty follow-up is dropped (the view is gone): the entry
    // leaves the map, so the in-flight round's settle path takes the
    // "detached" branch and settles the coalesced callers with THAT
    // round's result (never a fabricated one).
    entry.dirty = false
    entries.delete(sessionId)
    // Defensive: a waiter list that survives while NOTHING is in flight
    // (unreachable — waiters only exist behind an in-flight round)
    // settles with the last settled result so no caller ever hangs.
    if (!entry.inFlight && entry.followUpWaiters.length > 0) {
      const waiters = entry.followUpWaiters.splice(0)
      const fallback: TeamRefreshRoundResult =
        entry.lastResult !== null
          ? entry.lastResult
          : {
              readState: { status: 'transport-loss', message: 'no settled round' },
              projectionAssessment: null,
            }
      for (const waiter of waiters) waiter(fallback)
    }
  }

  const pause = (): void => {
    paused = true
  }

  const resume = (): void => {
    if (!paused) return
    paused = false
    for (const [sessionId, entry] of [...entries.entries()]) {
      if (entry.timer === null) armTick(sessionId)
      // Frozen decision 2: visibility resume → IMMEDIATE trigger.
      void trigger(sessionId, 'resume')
    }
  }

  const attached = (): readonly string[] => [...entries.keys()]

  const isPaused = (): boolean => paused

  return { attach, detach, trigger, pause, resume, attached, isPaused }
}

/** The default timer: setInterval-backed (browser/node). */
function createDefaultTimer(): TeamRefreshCoordinatorTimer {
  const timers = new Map<number, ReturnType<typeof setInterval>>()
  let nextHandle = 1
  return {
    setInterval(callback, delayMs) {
      const handle = nextHandle++
      timers.set(
        handle,
        setInterval(callback, delayMs) as unknown as ReturnType<typeof setInterval>,
      )
      return handle
    },
    clearInterval(handle) {
      const timer = timers.get(handle)
      if (timer === undefined) return
      timers.delete(handle)
      clearInterval(timer)
    },
  }
}
