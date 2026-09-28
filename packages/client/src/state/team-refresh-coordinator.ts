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
 * SCOPE EPOCH (PR #35 second follow-up P1-B, third follow-up P1): a
 * detach does not cancel an in-flight round — it SUPERSEDES its
 * scope. Every scope (an attach incarnation) owns a monotonically
 * increasing epoch; a round captures the entry it started in and
 * re-checks the map before every external side effect (the read-state
 * publication, the conditional projection pull, the lastResult /
 * dirty follow-up wiring). A round settling late from an orphaned
 * scope (detach → reattach, or a permanent detach) therefore
 * publishes NO read-state authority (the new incarnation's probe is
 * the sole authority), makes NO conditional projection request, and
 * cannot touch the new entry's timer / state.
 *
 * ONE SESSION SCOPE (PR #35 third follow-up P1 — guide §3–§9): the
 * COLD-BOOTSTRAP round (the first trigger for a session before its
 * view attaches — the cold create-success path, the TeamView cold
 * open) is NOT a naked round outside the map: the first unattached
 * trigger creates a TRANSIENT session entry (a real scope with the
 * epoch + the map-identity guard), and a later `attach` REUSES that
 * entry (it does not start a new epoch), so the cold round and every
 * subsequent tick / manual / mutation / resume / connection-restored
 * round share ONE single-flight lane for the session. A late old cold
 * round is superseded exactly like any late attached round: after a
 * detach the cold scope is closed and its late settlement publishes
 * no authority and makes no conditional pull. If the session is never
 * attached, the transient entry is dropped after its last round
 * settles (no entry leak).
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
   * the Team view on mount / session change. If a first unattached
   * trigger already created a TRANSIENT entry for this session (the
   * cold bootstrap), attach REUSES it (flipping it to attached and
   * arming the tick on the same entry — one scope, one single-flight
   * lane); otherwise it creates a fresh attached entry.
   */
  attach(sessionId: string): void
  /**
   * Disarm the tick for one session and CLOSE its scope (P1-B): the
   * entry leaves the map, so every in-flight round started in this
   * incarnation is superseded — its late settlement publishes no
   * read-state authority and makes no conditional projection pull (a
   * reattach starts a fresh epoch). Idempotent. Called by the Team
   * view on unmount / session change. Pending coalesced forced rounds
   * are dropped and their callers settle with the last settled round
   * (the session's view is gone; the store state stays).
   */
  detach(sessionId: string): void
  /**
   * One FORCED round (manual / mutation / resume / connection-restored):
   * always runs — if a round is already in flight for the session, the
   * trigger is coalesced into the dirty follow-up that runs after the
   * in-flight round settles. For a session with NO entry yet (the cold
   * create-success path targets a team whose view is not mounted yet)
   * the trigger creates a TRANSIENT session entry — a real scope with
   * the epoch + the map-identity guard — and the round runs in it (a
   * later attach reuses the entry; if the session is never attached the
   * entry is dropped after its last round settles).
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
  /**
   * The scope EPOCH (PR #35 second follow-up P1-B): every FRESH scope
   * (a create on an empty slot — an attach with no entry, or the first
   * unattached trigger) advances the epoch. A round captures the entry
   * it started from and re-checks
   * `entries.get(sessionId) === entryAtStart` before every external
   * side effect (the read-state publication, the conditional
   * projection pull, the lastResult / dirty follow-up wiring): after a
   * detach → reattach the OLD scope is orphaned — a late-settling old
   * round publishes NO authority and makes NO conditional projection
   * request (the new entry owns the session's state + timer).
   */
  readonly epoch: number
  /**
   * Whether the session's view is ATTACHED to this entry (PR #35
   * third follow-up P1). `false` marks the TRANSIENT entry created by
   * a first unattached trigger (the cold bootstrap): it has no tick
   * and is dropped after its last round settles unless a later
   * `attach` reuses it (which flips this to `true` — one lane, no new
   * epoch).
   */
  attached: boolean
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
 *
 * PR #35 second follow-up P1-B + third follow-up P1 — the scope
 * guard: `isCurrent` answers whether the scope this round started in
 * still owns the session. Every round (ATTACHED or the cold
 * bootstrap's transient-scope round) is checked against the map
 * before every external side effect — a round whose scope was
 * superseded (detach → reattach, or a detach that stays — including
 * a cold scope closed by a detach before its round settled) by the
 * time it settles publishes NO read-state authority and makes NO
 * conditional projection pull: the late result is returned to its own
 * caller only (it is the caller's round result — the session's view
 * state belongs to the CURRENT scope). There is no always-true guard
 * anymore: the cold bootstrap belongs to the same session lane as
 * every later round (guide §8 — the dual guard is kept, only the
 * exemption is gone).
 */
async function runRound(
  options: TeamRefreshCoordinatorOptions,
  sessionId: string,
  isCurrent: () => boolean,
): Promise<TeamRefreshRoundResult> {
  const outcome = await options.readState(sessionId)
  // P1-B: the read-state settlement is an EXTERNAL side effect (the
  // per-session read-state store the TeamView renders from) — a
  // superseded scope never publishes its late outcome (it would
  // overwrite the new scope's fresh authority).
  if (!isCurrent()) {
    return { readState: outcome, projectionAssessment: null }
  }
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
  // P1-B: the conditional projection pull is an EXTERNAL side effect
  // (a store request) — re-check the scope after the probe settled:
  // a scope that was superseded while the probe was in flight makes NO
  // conditional pull (it would request a projection the new scope's
  // own rounds already govern).
  if (!isCurrent()) {
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
  // P1-B: the monotonic scope-epoch counter (per coordinator). Every
  // attach that creates a fresh entry advances it; a round started in
  // an orphaned scope (after detach → reattach) is superseded the
  // moment the new entry owns the session id.
  let nextEpoch = 1

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
   * Create one per-session entry (a fresh SCOPE — the next epoch) in
   * the map. Only an ATTACHED entry arms the tick (a transient cold
   * entry has no view to poll).
   */
  const createEntry = (sessionId: string, attached: boolean): SessionEntry => {
    const entry: SessionEntry = {
      epoch: nextEpoch++,
      attached,
      timer: null,
      inFlight: false,
      dirty: false,
      followUpWaiters: [],
      lastResult: null,
    }
    entries.set(sessionId, entry)
    if (attached && !paused) armTick(sessionId)
    return entry
  }

  /**
   * Drop a TRANSIENT entry (created by an unattached cold trigger and
   * never attached) once it is fully idle — no in-flight round, no
   * coalesced work, no pending waiters — so an unattached
   * mutation/create path cannot leak entries. The map-identity check
   * guards against deleting a NEWER scope that took the slot.
   */
  const maybeDropTransientEntry = (
    sessionId: string,
    entry: SessionEntry,
  ): void => {
    if (
      entries.get(sessionId) === entry &&
      entry.attached === false &&
      entry.inFlight === false &&
      entry.dirty === false &&
      entry.followUpWaiters.length === 0
    ) {
      entries.delete(sessionId)
    }
  }

  /**
   * Run ONE round for one session scope and, on settle, drain the
   * dirty follow-up (which settles the coalesced trigger callers).
   * The caller passes the entry the round starts in (the scope
   * guard's reference — PR #35 third follow-up P1: there is no naked
   * round outside an entry).
   */
  const startRound = (
    sessionId: string,
    entryAtStart: SessionEntry,
  ): Promise<TeamRefreshRoundResult> => {
    // P1-B: the round's guard checks the map for THIS entry (a detach
    // → reattach orients the session id to a fresh entry with a newer
    // epoch; a detach that stays removes it).
    const isCurrent = (): boolean => entries.get(sessionId) === entryAtStart
    entryAtStart.inFlight = true
    const round = runRound(options, sessionId, isCurrent).then((result) => {
      // P1-B: lastResult wiring is scope-guarded too — a superseded
      // scope's late result never lands in the CURRENT entry's state
      // (the orphaned entry's own field is harmless: nothing reads it
      // after the entry leaves the map).
      if (entries.get(sessionId) === entryAtStart) {
        entryAtStart.lastResult = result
      }
      return result
    })
    void round.then(
      (result) => {
        entryAtStart.inFlight = false
        const waiters = entryAtStart.followUpWaiters.splice(0)
        if (entryAtStart.dirty && entries.get(sessionId) === entryAtStart) {
          // The forced follow-up runs (it is a FORCED round — even
          // while the tab is hidden the event-triggered round is owed).
          // The entry stays in the map until the follow-up settles (the
          // follow-up's own settle does the transient drop).
          entryAtStart.dirty = false
          void startRound(sessionId, entryAtStart).then(
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
          // Third follow-up P1 (guide §6): a never-attached transient
          // entry that is now fully idle leaves the map (no leak).
          maybeDropTransientEntry(sessionId, entryAtStart)
        }
      },
      (error) => {
        // Defensive (runRound never rejects): settle the in-flight
        // state + the waiters so nothing hangs.
        entryAtStart.inFlight = false
        const waiters = entryAtStart.followUpWaiters.splice(0)
        const fallback: TeamRefreshRoundResult = {
          readState: { status: 'transport-loss', message: 'coordinator round rejected' },
          projectionAssessment: null,
        }
        for (const waiter of waiters) waiter(fallback)
        maybeDropTransientEntry(sessionId, entryAtStart)
        void error
      },
    )
    return round
  }

  const trigger = (
    sessionId: string,
    _reason: TeamRefreshTrigger,
  ): Promise<TeamRefreshRoundResult> => {
    let entry = entries.get(sessionId)
    if (entry === undefined) {
      // Third follow-up P1 (guide §4): the first unattached trigger
      // (the cold create-success path targets the NEW root before its
      // view mounts) no longer runs a naked round — it creates a
      // TRANSIENT session entry (a real scope: the epoch + the
      // map-identity guard). A later attach REUSES the entry (one
      // single-flight lane); a detach CLOSES it (the late round is
      // superseded like any other).
      entry = createEntry(sessionId, false)
    }
    if (!entry.inFlight) return startRound(sessionId, entry)
    // Single-flight: coalesce into the dirty follow-up. The caller
    // awaits the FOLLOW-UP round (the forced round), not the in-flight
    // one.
    entry.dirty = true
    return new Promise<TeamRefreshRoundResult>((resolve) => {
      entry.followUpWaiters.push(resolve)
    })
  }

  const attach = (sessionId: string): void => {
    const existing = entries.get(sessionId)
    if (existing === undefined) {
      // P1-B: a fresh attach is a fresh SCOPE — a new entry with the
      // next epoch (the previous incarnation's in-flight rounds are
      // superseded: their guard now sees a different entry in the map).
      createEntry(sessionId, true)
      return
    }
    // Third follow-up P1 (guide §5): a cold trigger before this attach
    // created a TRANSIENT entry for the same session — REUSE it (the
    // cold round and the tick / forced rounds share ONE lane; starting
    // a new epoch here would orphan the cold round's scope for no
    // reason).
    existing.attached = true
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
      // Third follow-up P1: a transient (never-attached) entry has no
      // view to resume — its lane is cold-only. Only ATTACHED sessions
      // get the re-arm + the immediate resume trigger.
      if (entry.attached === false) continue
      if (entry.timer === null) armTick(sessionId)
      // Frozen decision 2: visibility resume → IMMEDIATE trigger.
      void trigger(sessionId, 'resume')
    }
  }

  /** The currently ATTACHED session ids (a stable copy; transient
   *  cold entries are NOT attached). */
  const attached = (): readonly string[] =>
    [...entries.entries()]
      .filter(([, entry]) => entry.attached)
      .map(([sessionId]) => sessionId)

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
