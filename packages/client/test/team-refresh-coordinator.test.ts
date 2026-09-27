/**
 * team-view-sync-complete (frozen decisions 2 + 5) — the mount-level
 * per-team refresh coordinator (the client-owned polling engine).
 *
 * Coverage: attach arms one 3s tick per team (idempotent; detach stops
 * it); the tick fires a gated pull while attached and respects the
 * tab-hidden pause (no round trips while paused); the forced triggers
 * (manual / mutation / resume) ALWAYS run — single-flight per team:
 * a trigger arriving while a round is in flight coalesces into the
 * dirty follow-up that runs exactly once after the in-flight round
 * settles, and the coalesced caller receives the FOLLOW-UP round's
 * assessment (never the in-flight one); an unattached team's forced
 * round runs ungated (the cold create-success path); `resume` fires
 * the immediate trigger for every attached team, re-arms the ticks
 * (including teams attached while paused), and is a no-op when already
 * running; a detach settles pending coalesced callers with the last
 * settled assessment (nothing hangs); a failed round is a resolved
 * transport-loss assessment — the coordinator never re-fires anything
 * but its own owed follow-up.
 *
 * Pure spec: the timer is manual (arm/fire driven), the pull is
 * scripted; no DOM, no real timers.
 */
import { describe, expect, it } from 'vitest'
import type { ProjectionSyncAssessment } from '../../remote/src/index.js'
import {
  createTeamRefreshCoordinator,
  type TeamRefreshCoordinatorTimer,
} from '../src/state/team-refresh-coordinator.js'

// ---------------------------------------------------------------------------
// Harness
// ---------------------------------------------------------------------------

/** One manual repeating-timer (the tests fire ticks explicitly). */
function manualTimer(): TeamRefreshCoordinatorTimer & {
  fire(handle: number): void
  fireAll(): void
  armed(): number[]
  delays: Map<number, number>
} {
  const tasks = new Map<number, { cb: () => void; delay: number }>()
  const delays = new Map<number, number>()
  let nextHandle = 1
  return {
    setInterval(callback, delayMs) {
      const handle = nextHandle++
      tasks.set(handle, { cb: callback, delay: delayMs })
      delays.set(handle, delayMs)
      return handle
    },
    clearInterval(handle) {
      tasks.delete(handle)
      delays.delete(handle)
    },
    fire(handle) {
      const task = tasks.get(handle)
      if (task === undefined) return
      task.cb()
    },
    fireAll() {
      for (const task of [...tasks.values()]) task.cb()
    },
    armed() {
      return [...tasks.keys()]
    },
    delays,
  }
}

/** One scripted pull: a queue of (assessment | gate promise) per team. */
interface ScriptedPull {
  calls: string[]
  pull: (teamSessionId: string) => Promise<ProjectionSyncAssessment>
}

function scriptedPull(queue: Record<string, ProjectionSyncAssessment[]> = {}): ScriptedPull {
  const calls: string[] = []
  const pull = (teamSessionId: string): Promise<ProjectionSyncAssessment> => {
    calls.push(teamSessionId)
    const teamQueue = queue[teamSessionId]
    const next = teamQueue === undefined ? undefined : teamQueue.shift()
    return Promise.resolve(next === undefined ? { status: 'duplicate', receivedGeneration: 1 } : next)
  }
  return { calls, pull }
}

const APPLY: ProjectionSyncAssessment = { status: 'apply', receivedGeneration: 9 }
const APPLY10: ProjectionSyncAssessment = { status: 'apply', receivedGeneration: 10 }
const DUPLICATE: ProjectionSyncAssessment = { status: 'duplicate', receivedGeneration: 9 }
const LOSS: ProjectionSyncAssessment = { status: 'transport-loss', receivedGeneration: null }

// ---------------------------------------------------------------------------
// Scenarios
// ---------------------------------------------------------------------------

// S1: attach arms the 3s tick; the tick fires a gated pull.
const s1 = scriptedPull({ t1: [APPLY, APPLY10] })
const s1Timer = manualTimer()
const s1Coord = createTeamRefreshCoordinator({ pull: s1.pull, timer: s1Timer })
s1Coord.attach('t1')
const s1TickHandle = s1Timer.armed()[0]
if (s1TickHandle === undefined) throw new Error('S1: no tick armed after attach')
s1Timer.fire(s1TickHandle)
s1Timer.fire(s1TickHandle)
const s1Armed = s1Timer.armed()
const s1Delays = [...s1Timer.delays.values()]

// S2: detach stops the tick.
const s2 = scriptedPull()
const s2Timer = manualTimer()
const s2Coord = createTeamRefreshCoordinator({ pull: s2.pull, timer: s2Timer })
s2Coord.attach('t1')
const s2Handle = s2Timer.armed()[0]
if (s2Handle === undefined) throw new Error('S2: no tick armed after attach')
s2Coord.detach('t1')
s2Timer.fire(s2Handle) // disarmed — no task anymore
const s2Calls = s2.calls

// S3: single-flight + dirty coalescing (two coalesced triggers → ONE
// follow-up). The scripted queue distinguishes the two rounds by value.
const s3 = scriptedPull({ t1: [APPLY, APPLY10] })
const s3Timer = manualTimer()
const s3Coord = createTeamRefreshCoordinator({ pull: s3.pull, timer: s3Timer })
s3Coord.attach('t1')
const s3InFlight = s3Coord.trigger('t1', 'manual')
const s3Coalesced1 = s3Coord.trigger('t1', 'mutation')
const s3Coalesced2 = s3Coord.trigger('t1', 'manual')
// The tick while in flight coalesces too.
const s3TickHandle = s3Timer.armed()[0]
if (s3TickHandle === undefined) throw new Error('S3: no tick armed after attach')
s3Timer.fire(s3TickHandle)
const s3CallsBeforeSettle = s3.calls.length
const [s3First, s3C1, s3C2] = await Promise.all([s3InFlight, s3Coalesced1, s3Coalesced2])
const s3CallsAfter = s3.calls.length

// S4: the unattached forced round runs ungated.
const s4 = scriptedPull({ fresh: [APPLY] })
const s4Coord = createTeamRefreshCoordinator({ pull: s4.pull, timer: manualTimer() })
const s4Result = await s4Coord.trigger('fresh', 'mutation')
const s4Attached = s4Coord.attached()

// S5: pause stops the ticks; the forced trigger still runs; resume fires
// the immediate trigger for every attached team and re-arms the ticks
// (including a team attached while paused). The queue values distinguish
// each round.
const s5 = scriptedPull({
  a: [APPLY, { status: 'apply', receivedGeneration: 21 }],
  b: [{ status: 'apply', receivedGeneration: 22 }],
  c: [{ status: 'apply', receivedGeneration: 23 }],
})
const s5Timer = manualTimer()
const s5Coord = createTeamRefreshCoordinator({ pull: s5.pull, timer: s5Timer })
s5Coord.attach('a')
s5Coord.attach('b')
s5Coord.pause()
s5Timer.fireAll() // paused — no round trips
const s5PausedCalls = s5.calls.length
const s5Forced = await s5Coord.trigger('a', 'mutation') // forced rounds ignore the pause
s5Coord.attach('c') // attached while paused — no tick armed yet
const s5ArmedWhilePaused = s5Timer.armed().length
s5Coord.resume()
const s5ResumedCalls = s5.calls
const s5ArmedAfterResume = s5Timer.armed().length
const s5ResumeAgain = (() => {
  s5Coord.resume() // no-op (already running)
  return s5.calls.length
})()

// S6: a detach settles the pending coalesced caller with the last
// settled assessment (nothing hangs).
const s6 = scriptedPull({ t1: [APPLY] })
const s6Timer = manualTimer()
const s6Coord = createTeamRefreshCoordinator({ pull: s6.pull, timer: s6Timer })
s6Coord.attach('t1')
const s6First = s6Coord.trigger('t1', 'manual')
const s6Coalesced = s6Coord.trigger('t1', 'mutation')
s6Coord.detach('t1') // drop the follow-up; the coalesced caller must settle
const [s6FirstResult, s6CoalescedResult] = await Promise.all([s6First, s6Coalesced])

// S7: a failing round is a resolved transport-loss assessment; the
// coordinator's owed follow-up still runs (the coalesced trigger is a
// forced round), then the tick cadence continues.
const s7 = scriptedPull({ t1: [LOSS, DUPLICATE, APPLY] })
const s7Timer = manualTimer()
const s7Coord = createTeamRefreshCoordinator({ pull: s7.pull, timer: s7Timer })
s7Coord.attach('t1')
const s7InFlight = s7Coord.trigger('t1', 'manual')
const s7Coalesced = s7Coord.trigger('t1', 'mutation')
const [s7FirstResult, s7FollowUp] = await Promise.all([s7InFlight, s7Coalesced])
const s7Calls = s7.calls

// ---------------------------------------------------------------------------
// Assertions
// ---------------------------------------------------------------------------

describe('team-view-sync-complete — the per-team refresh coordinator (client-owned polling)', () => {
  it('S1: attach arms ONE 3s tick per team; the tick fires a gated pull', () => {
    expect(s1Armed.length).toBe(1)
    expect(s1Delays).toEqual([3000])
    expect(s1.calls).toEqual(['t1', 't1'])
    expect(s1Coord.isPaused()).toBe(false)
  })

  it('S1b: attach is idempotent (one tick even for repeat attaches)', () => {
    s1Coord.attach('t1')
    s1Coord.attach('t1')
    expect(s1Timer.armed().length).toBe(1)
  })

  it('S2: detach disarms the tick (no further round trips)', () => {
    expect(s2Timer.armed().length).toBe(0)
    expect(s2Calls).toEqual([])
    expect(s2Coord.attached()).toEqual([])
  })

  it('S3: single-flight + dirty coalescing — two coalesced triggers + a tick yield exactly ONE follow-up; the coalesced callers get the FOLLOW-UP assessment', () => {
    // Round 1 (the in-flight manual) + ONE follow-up = 2 pulls total —
    // the second coalesced trigger + the in-flight tick added NO extra
    // rounds.
    expect(s3CallsBeforeSettle).toBe(1)
    expect(s3CallsAfter).toBe(2)
    expect(s3.calls).toEqual(['t1', 't1'])
    // The in-flight caller got round 1's assessment (the scripted first
    // value); the coalesced callers got the FOLLOW-UP round's
    // assessment (the scripted second value) — never the in-flight one.
    expect(s3First).toEqual(APPLY)
    expect(s3C1).toEqual(APPLY10)
    expect(s3C2).toEqual(APPLY10)
  })

  it('S4: an unattached team forced round runs ungated (the cold create-success path)', () => {
    expect(s4Result).toEqual(APPLY)
    expect(s4.calls).toEqual(['fresh'])
    expect(s4Attached).toEqual([]) // no attach side effect
  })

  it('S5: pause stops the ticks; forced triggers still run; resume fires the immediate trigger per team, re-arms the ticks (incl. a team attached while paused), and is a no-op when running', () => {
    expect(s5PausedCalls).toBe(0) // the tick no-ops while paused
    expect(s5Forced).toEqual(APPLY) // the forced round ran
    // 'a' and 'b' keep their armed handles while paused (the tick
    // callback no-ops); 'c' (attached while paused) gets NO tick yet.
    expect(s5ArmedWhilePaused).toBe(2)
    // resume: immediate trigger for 'a', 'b', 'c' (the forced 'a' round
    // already settled, so the resume trigger is a fresh round each).
    expect(s5ResumedCalls).toEqual(['a', 'a', 'b', 'c'])
    expect(s5ArmedAfterResume).toBe(3)
    expect(s5ResumeAgain).toBe(4) // the second resume is a no-op
  })

  it('S6: a detach settles the pending coalesced caller with the last settled assessment (nothing hangs)', () => {
    expect(s6FirstResult).toEqual(APPLY)
    // The follow-up was dropped (the view is gone): the coalesced
    // caller settles with the last settled assessment.
    expect(s6CoalescedResult).toEqual(APPLY)
    expect(s6.calls.length).toBe(1) // the in-flight round ran; the follow-up did not
  })

  it('S7: a failing round is a resolved transport-loss assessment; the owed follow-up still runs; the cadence continues', () => {
    expect(s7FirstResult).toEqual(LOSS)
    expect(s7FollowUp).toEqual(DUPLICATE)
    expect(s7Calls).toEqual(['t1', 't1'])
  })
})
