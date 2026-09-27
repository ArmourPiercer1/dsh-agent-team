/**
 * team-view-sync-complete (frozen decisions 2 + 5) — the mount-level
 * per-team refresh coordinator.
 *
 * Client-owned polling, NO server push: while a team's Team view is
 * VISIBLE (attached) and the host tab is visible, one 3s tick per team
 * fires a projection round trip. Hidden (detached or tab-hidden) →
 * paused: the ticks stop, no round trips.
 *
 * The coordinator UNIFIES the refresh trigger sources (frozen decision
 * 5): the 3s tick, the manual view refresh, the post-mutation-success
 * refresh, and the visibility-resume immediate trigger. Per team there
 * is ONE in-flight round (`single-flight`) and a dirty flag that
 * COALESCES triggers arriving while a round is in flight: the forced
 * round runs exactly once after the in-flight round settles. A refresh
 * failure is a resolved assessment (the frozen store pull never
 * rejects) — the coordinator NEVER re-fires the mutation that preceded
 * it (mutations are one-shot UI RPCs; only the read is repeated).
 *
 * The forced rounds (manual / mutation / resume) always run; only the
 * TICK respects the tab-hidden pause (an explicit trigger is an event,
 * not polling). The store's channel-episode pulls (the backoff retry,
 * the connection-restore invalidation pull) are a SEPARATE frozen lane
 * that shares the same generation-safe store pull — the coordinator
 * gates only the triggers it owns; the F1 request-order liveness + the
 * generation verdict remain the final authority for both lanes.
 *
 * Pure module: no DOM, no timers of its own (the timer is injected;
 * tests use a manual one), no React. Erasable TS only.
 * @module @dsh-agent-team/client/state/team-refresh-coordinator
 */

import type { ProjectionSyncAssessment } from '../../../remote/src/index.js'

/** The refresh trigger sources (closed set, frozen decision 5). */
export type TeamRefreshTrigger = 'manual' | 'tick' | 'mutation' | 'resume'

/** The injectable timer (default: setTimeout/setInterval-backed). */
export interface TeamRefreshCoordinatorTimer {
  /** Arm a repeating task; returns the handle accepted by `clear`. */
  setInterval(callback: () => void, delayMs: number): number
  /** Disarm one repeating task (idempotent no-op for unknown handles). */
  clearInterval(handle: number): void
}

/** Coordinator options (all dependencies injected; no hidden globals). */
export interface TeamRefreshCoordinatorOptions {
  /**
   * The gated pull: ONE projection round trip for one team. Resolves
   * with the frozen assessment (the store pull never rejects — a
   * transport loss is the resolved `transport-loss` assessment).
   */
  readonly pull: (teamSessionId: string) => Promise<ProjectionSyncAssessment>
  /** The tick cadence, ms (frozen default 3000). */
  readonly tickMs?: number
  /** The repeating-timer facade (default: setInterval-backed). */
  readonly timer?: TeamRefreshCoordinatorTimer
}

/** The coordinator surface (per-team attach/detach + forced triggers). */
export interface TeamRefreshCoordinator {
  /**
   * Arm the 3s visible tick for one team (idempotent). Called by the
   * Team view on mount / team change.
   */
  attach(teamSessionId: string): void
  /**
   * Disarm the tick for one team (idempotent). Called by the Team view
   * on unmount / team change. Pending coalesced forced rounds are
   * dropped and their callers settle with the last settled assessment
   * (the team's view is gone; the store state stays).
   */
  detach(teamSessionId: string): void
  /**
   * One FORCED round trip (manual / mutation / resume): always runs —
   * if a round is already in flight for the team, the trigger is
   * coalesced into the dirty follow-up that runs after the in-flight
   * round settles. For an UNATTACHED team the round runs ungated (the
   * cold create-success path targets a team whose view is not mounted
   * yet).
   * @returns the assessment of the round that satisfies this trigger
   *   (the follow-up's assessment when coalesced).
   */
  trigger(teamSessionId: string, reason: TeamRefreshTrigger): Promise<ProjectionSyncAssessment>
  /** Pause the TICKS (host tab hidden). Forced triggers still run. */
  pause(): void
  /**
   * Resume the TICKS (host tab visible) and fire the immediate resume
   * trigger for EVERY attached team (frozen decision 2: visibility
   * resume → immediate trigger).
   */
  resume(): void
  /** The currently attached team ids (a stable copy). */
  attached(): readonly string[]
  /** Whether the ticks are paused. */
  isPaused(): boolean
}

/** The per-team entry (private). */
interface TeamEntry {
  /** The armed tick handle (null when disarmed). */
  timer: number | null
  /** Whether one coordinator-owned round is in flight. */
  inFlight: boolean
  /** Whether a forced trigger coalesced while a round was in flight. */
  dirty: boolean
  /**
   * The coalesced trigger callers, waiting for the follow-up round's
   * assessment. Settle order = push order.
   */
  followUpWaiters: Array<(assessment: ProjectionSyncAssessment) => void>
  /** The last settled coordinator-owned assessment (or null). */
  lastAssessment: ProjectionSyncAssessment | null
}

/**
 * Create one refresh coordinator over one gated pull.
 * @param options - the injected pull + cadence + timer.
 * @returns the coordinator surface.
 */
export function createTeamRefreshCoordinator(
  options: TeamRefreshCoordinatorOptions,
): TeamRefreshCoordinator {
  const tickMs: number = options.tickMs === undefined ? 3000 : options.tickMs
  const timer: TeamRefreshCoordinatorTimer =
    options.timer === undefined ? createDefaultTimer() : options.timer

  const entries = new Map<string, TeamEntry>()
  let paused = false

  const armTick = (teamSessionId: string): void => {
    const entry = entries.get(teamSessionId)
    if (entry === undefined || entry.timer !== null) return
    entry.timer = timer.setInterval(() => {
      // The tick respects the tab-hidden pause (an explicit trigger is
      // an event and is NOT gated — see `trigger`).
      if (paused) return
      void trigger(teamSessionId, 'tick')
    }, tickMs)
  }

  const disarmTick = (entry: TeamEntry): void => {
    if (entry.timer === null) return
    timer.clearInterval(entry.timer)
    entry.timer = null
  }

  /**
   * Run ONE round for an attached team and, on settle, drain the dirty
   * follow-up (which settles the coalesced trigger callers).
   */
  const startRound = (teamSessionId: string): Promise<ProjectionSyncAssessment> => {
    const entry = entries.get(teamSessionId)
    if (entry === undefined) return options.pull(teamSessionId)
    entry.inFlight = true
    const round = options
      .pull(teamSessionId)
      .then((assessment) => {
        entry.lastAssessment = assessment
        return assessment
      })
    void round.then(
      (assessment) => {
        entry.inFlight = false
        const waiters = entry.followUpWaiters.splice(0)
        if (entry.dirty && entries.get(teamSessionId) === entry) {
          // The forced follow-up runs (it is a FORCED round — even while
          // the tab is hidden the event-triggered round is owed).
          entry.dirty = false
          void startRound(teamSessionId).then(
            (followUp) => {
              for (const waiter of waiters) waiter(followUp)
            },
            (error) => {
              // Defensive: the gated pull never rejects; a rejection
              // settles the waiters with the frozen transport-loss
              // assessment rather than hanging the UI.
              for (const waiter of waiters) {
                waiter({ status: 'transport-loss', receivedGeneration: null })
              }
              void error
            },
          )
        } else {
          // Detached (or nothing coalesced): the coalesced callers
          // settle with THIS round's assessment — the follow-up is
          // dropped, the view is gone.
          for (const waiter of waiters) waiter(assessment)
        }
      },
      (error) => {
        // Defensive (the gated pull never rejects): settle the in-flight
        // state + the waiters so nothing hangs.
        entry.inFlight = false
        const waiters = entry.followUpWaiters.splice(0)
        const fallback: ProjectionSyncAssessment = {
          status: 'transport-loss',
          receivedGeneration: null,
        }
        for (const waiter of waiters) waiter(fallback)
        void error
      },
    )
    return round
  }

  const trigger = (
    teamSessionId: string,
    _reason: TeamRefreshTrigger,
  ): Promise<ProjectionSyncAssessment> => {
    const entry = entries.get(teamSessionId)
    if (entry === undefined) {
      // Unattached (the cold create-success path targets the NEW team
      // before its view mounts): the forced round runs UNGATED.
      return options.pull(teamSessionId)
    }
    if (!entry.inFlight) return startRound(teamSessionId)
    // Single-flight: coalesce into the dirty follow-up. The caller
    // awaits the FOLLOW-UP round (the forced round), not the in-flight
    // one.
    entry.dirty = true
    return new Promise<ProjectionSyncAssessment>((resolve) => {
      entry.followUpWaiters.push(resolve)
    })
  }

  const attach = (teamSessionId: string): void => {
    let entry = entries.get(teamSessionId)
    if (entry === undefined) {
      entry = {
        timer: null,
        inFlight: false,
        dirty: false,
        followUpWaiters: [],
        lastAssessment: null,
      }
      entries.set(teamSessionId, entry)
    }
    if (!paused) armTick(teamSessionId)
  }

  const detach = (teamSessionId: string): void => {
    const entry = entries.get(teamSessionId)
    if (entry === undefined) return
    disarmTick(entry)
    // The dirty follow-up is dropped (the view is gone): the entry
    // leaves the map, so the in-flight round's settle path takes the
    // "detached" branch and settles the coalesced callers with THAT
    // round's assessment (never a fabricated one).
    entry.dirty = false
    entries.delete(teamSessionId)
    // Defensive: a waiter list that survives while NOTHING is in flight
    // (unreachable — waiters only exist behind an in-flight round)
    // settles with the last settled assessment so no caller ever hangs.
    if (!entry.inFlight && entry.followUpWaiters.length > 0) {
      const waiters = entry.followUpWaiters.splice(0)
      const fallback: ProjectionSyncAssessment =
        entry.lastAssessment !== null
          ? entry.lastAssessment
          : { status: 'duplicate', receivedGeneration: null }
      for (const waiter of waiters) waiter(fallback)
    }
  }

  const pause = (): void => {
    paused = true
  }

  const resume = (): void => {
    if (!paused) return
    paused = false
    for (const [teamSessionId, entry] of [...entries.entries()]) {
      if (entry.timer === null) armTick(teamSessionId)
      // Frozen decision 2: visibility resume → IMMEDIATE trigger.
      void trigger(teamSessionId, 'resume')
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
