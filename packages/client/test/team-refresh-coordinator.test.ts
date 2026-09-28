/**
 * team-view-sync-complete (frozen decisions 2 + 5; PR #35 follow-up) —
 * the mount-level per-SESSION refresh coordinator (the client-owned
 * polling engine, now READ-STATE DRIVEN: the frozen §1.2 round =
 * `team.getReadState` probe → conditional `team.getProjection` pull).
 *
 * Coverage: attach arms one 3s tick per session (idempotent; detach
 * stops it); the round flow (probe `none` → authoritative no-team
 * result + NO projection request; probe team relation with the applied
 * identity UNCHANGED → no-op no pull; probe team relation with a
 * CHANGED / missing applied identity → the full pull for the owning
 * root; probe remote-error / malformed / transport-loss → fail closed,
 * no pull, never a degraded `none`); the forced triggers (manual /
 * mutation / resume / connection-restored) ALWAYS run — single-flight
 * per session: a trigger arriving while a round is in flight coalesces
 * into the dirty follow-up that runs exactly once after the in-flight
 * round settles, and the coalesced caller receives the FOLLOW-UP
 * round's result (never the in-flight one); an UNATTACHED session's
 * forced round runs in a TRANSIENT session entry (PR #35 third
 * follow-up P1 — the cold create-success path: a real scope with the
 * epoch + the map-identity guard, no naked round; a later attach
 * reuses the entry so the cold round shares ONE single-flight lane
 * with the attached rounds; a never-attached entry is dropped after
 * its last round settles); the scope-epoch section (E + COLD-E)
 * covers detach → reattach invalidation of BOTH attached and cold
 * scopes; `resume` fires the immediate trigger for every attached
 * session, re-arms the
 * ticks (including sessions attached while paused), and is a no-op
 * when already running; a detach settles pending coalesced callers
 * with the last settled result (nothing hangs); a failed probe is a
 * resolved outcome — the coordinator never re-fires anything but its
 * own owed follow-up.
 *
 * Pure spec: the timer is manual (arm/fire driven), the probe + pull
 * are scripted; no DOM, no real timers.
 */
import { describe, expect, it } from 'vitest'
import type {
  AppliedProjectionIdentityV6,
  ProjectionSyncAssessment,
} from '../../remote/src/index.js'
import {
  createTeamRefreshCoordinator,
  type TeamRefreshCoordinatorTimer,
  type TeamRefreshRoundResult,
} from '../src/state/team-refresh-coordinator.js'
import type { TeamReadStateOutcome } from '../src/state/team-read-state.js'

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

// -- read-state outcome fixtures (the closed shapes) -------------------------

function okRoot(teamSessionId: string, generation: number, token: string): TeamReadStateOutcome {
  return {
    status: 'ok',
    relation: {
      kind: 'team-root',
      teamSessionId,
      memberInstanceId: null,
      disposed: false,
      durableGeneration: generation,
      liveToken: token,
    },
  }
}
function okMember(teamSessionId: string, instanceId: string, generation: number, token: string): TeamReadStateOutcome {
  return {
    status: 'ok',
    relation: {
      kind: 'team-member',
      teamSessionId,
      memberInstanceId: instanceId,
      disposed: false,
      durableGeneration: generation,
      liveToken: token,
    },
  }
}
function okNone(): TeamReadStateOutcome {
  return {
    status: 'ok',
    relation: {
      kind: 'none',
      teamSessionId: null,
      memberInstanceId: null,
      disposed: false,
      durableGeneration: null,
      liveToken: null,
    },
  }
}
function remoteErrorOutcome(code: string): TeamReadStateOutcome {
  return { status: 'remote-error', code, message: 'host failure' }
}
function malformedOutcome(reason: string): TeamReadStateOutcome {
  return { status: 'malformed', reason }
}
function lossOutcome(): TeamReadStateOutcome {
  return { status: 'transport-loss', message: 'seam channel lost' }
}

function appliedIdentity(teamSessionId: string, generation: number, token: string): AppliedProjectionIdentityV6 {
  return { teamSessionId, durableGeneration: generation, liveToken: token }
}

// -- scripted probe + pull ----------------------------------------------------

/** One scripted probe: a queue of outcomes per session. */
interface ScriptedProbe {
  calls: string[]
  readState: (sessionId: string) => Promise<TeamReadStateOutcome>
}
function scriptedProbe(queue: Record<string, TeamReadStateOutcome[]> = {}): ScriptedProbe {
  const calls: string[] = []
  const readState = (sessionId: string): Promise<TeamReadStateOutcome> => {
    calls.push(sessionId)
    const sessionQueue = queue[sessionId]
    const next = sessionQueue === undefined ? undefined : sessionQueue.shift()
    return Promise.resolve(next === undefined ? okNone() : next)
  }
  return { calls, readState }
}

/** One scripted projection pull: a queue of assessments per root. */
interface ScriptedPull {
  calls: string[]
  pullProjection: (teamSessionId: string) => Promise<ProjectionSyncAssessment>
}
function scriptedPullProjection(
  queue: Record<string, ProjectionSyncAssessment[]> = {},
): ScriptedPull {
  const calls: string[] = []
  const pullProjection = (teamSessionId: string): Promise<ProjectionSyncAssessment> => {
    calls.push(teamSessionId)
    const rootQueue = queue[teamSessionId]
    const next = rootQueue === undefined ? undefined : rootQueue.shift()
    return Promise.resolve(next === undefined ? { status: 'duplicate', receivedGeneration: 1 } : next)
  }
  return { calls, pullProjection }
}

const APPLY: ProjectionSyncAssessment = { status: 'apply', receivedGeneration: 9 }
const APPLY10: ProjectionSyncAssessment = { status: 'apply', receivedGeneration: 10 }
const DUPLICATE: ProjectionSyncAssessment = { status: 'duplicate', receivedGeneration: 9 }
const LOSS: ProjectionSyncAssessment = { status: 'transport-loss', receivedGeneration: null }

// ---------------------------------------------------------------------------
// Round-flow scenarios (the frozen §1.2 decision table)
// ---------------------------------------------------------------------------

// R1: probe team-root + NO applied frame → the full pull for the root.
const r1 = scriptedProbe({ s1: [okRoot('root-1', 10, 'lt-v1-a')] })
const r1Pull = scriptedPullProjection({ 'root-1': [APPLY] })
const r1Coord = createTeamRefreshCoordinator({
  readState: r1.readState,
  pullProjection: r1Pull.pullProjection,
  getAppliedIdentity: () => null,
  timer: manualTimer(),
})
const r1Result = await r1Coord.trigger('s1', 'manual')

// R2: probe team-root + applied identity UNCHANGED (same team + pair)
// → the round is a NO-OP: no projection request.
const r2 = scriptedProbe({ s2: [okRoot('root-1', 10, 'lt-v1-a')] })
const r2Pull = scriptedPullProjection()
const r2Coord = createTeamRefreshCoordinator({
  readState: r2.readState,
  pullProjection: r2Pull.pullProjection,
  getAppliedIdentity: () => appliedIdentity('root-1', 10, 'lt-v1-a'),
  timer: manualTimer(),
})
const r2Result = await r2Coord.trigger('s2', 'tick')

// R3: probe team-member + applied identity CHANGED (live-only token)
// → the full pull for the OWNING ROOT (the member's root, not the
// session id).
const r3 = scriptedProbe({ s3: [okMember('root-9', 'inst-1', 10, 'lt-v1-new')] })
const r3Pull = scriptedPullProjection({ 'root-9': [APPLY] })
const r3Coord = createTeamRefreshCoordinator({
  readState: r3.readState,
  pullProjection: r3Pull.pullProjection,
  getAppliedIdentity: () => appliedIdentity('root-9', 10, 'lt-v1-old'),
  timer: manualTimer(),
})
const r3Result = await r3Coord.trigger('s3', 'manual')

// R4: probe team-root + applied identity of a DIFFERENT team → the
// full pull (the identity mismatch is a change).
const r4 = scriptedProbe({ s4: [okRoot('root-1', 10, 'lt-v1-a')] })
const r4Pull = scriptedPullProjection({ 'root-1': [APPLY] })
const r4Coord = createTeamRefreshCoordinator({
  readState: r4.readState,
  pullProjection: r4Pull.pullProjection,
  getAppliedIdentity: () => appliedIdentity('root-other', 10, 'lt-v1-a'),
  timer: manualTimer(),
})
const r4Result = await r4Coord.trigger('s4', 'manual')

// R5: probe none (positively confirmed) → the authoritative no-team
// result; NO projection request.
const r5 = scriptedProbe({ s5: [okNone()] })
const r5Pull = scriptedPullProjection()
const r5Coord = createTeamRefreshCoordinator({
  readState: r5.readState,
  pullProjection: r5Pull.pullProjection,
  getAppliedIdentity: () => null,
  timer: manualTimer(),
})
const r5Result = await r5Coord.trigger('s5', 'manual')

// R6: probe remote-error → fail closed (no ownership conclusion, no
// pull — and NEVER a degraded none).
const r6 = scriptedProbe({ s6: [remoteErrorOutcome('TEAM_READ_STATE_OWNERSHIP_CONFLICT')] })
const r6Pull = scriptedPullProjection()
const r6Coord = createTeamRefreshCoordinator({
  readState: r6.readState,
  pullProjection: r6Pull.pullProjection,
  getAppliedIdentity: () => null,
  timer: manualTimer(),
})
const r6Result = await r6Coord.trigger('s6', 'manual')

// R7: probe malformed → fail closed (the typed malformed rides the
// round result; no pull; never a degraded none).
const r7 = scriptedProbe({ s7: [malformedOutcome('team-root with a null liveToken')] })
const r7Pull = scriptedPullProjection()
const r7Coord = createTeamRefreshCoordinator({
  readState: r7.readState,
  pullProjection: r7Pull.pullProjection,
  getAppliedIdentity: () => null,
  timer: manualTimer(),
})
const r7Result = await r7Coord.trigger('s7', 'manual')

// R8: probe transport-loss → fail closed (no pull).
const r8 = scriptedProbe({ s8: [lossOutcome()] })
const r8Pull = scriptedPullProjection()
const r8Coord = createTeamRefreshCoordinator({
  readState: r8.readState,
  pullProjection: r8Pull.pullProjection,
  getAppliedIdentity: () => null,
  timer: manualTimer(),
})
const r8Result = await r8Coord.trigger('s8', 'tick')

// R9: the onReadState recorder sees the probe outcome (every round,
// before the optional pull).
const r9Recorded: Array<{ sessionId: string; outcome: TeamReadStateOutcome }> = []
const r9 = scriptedProbe({ s9: [okRoot('root-1', 10, 'lt-v1-a')] })
const r9Pull = scriptedPullProjection({ 'root-1': [APPLY] })
const r9Coord = createTeamRefreshCoordinator({
  readState: r9.readState,
  pullProjection: r9Pull.pullProjection,
  getAppliedIdentity: () => null,
  onReadState: (sessionId, outcome) => {
    r9Recorded.push({ sessionId, outcome })
  },
  timer: manualTimer(),
})
await r9Coord.trigger('s9', 'manual')

// ---------------------------------------------------------------------------
// Coordinator mechanics (attach/tick/single-flight/pause/resume/detach)
// ---------------------------------------------------------------------------

// S1: attach arms the 3s tick; the tick fires a round (probe + pull).
const s1 = scriptedProbe({ t1: [okRoot('root-1', 10, 'lt-v1-a'), okRoot('root-1', 11, 'lt-v1-b')] })
const s1Pull = scriptedPullProjection({ 'root-1': [APPLY, APPLY10] })
const s1Timer = manualTimer()
const s1Coord = createTeamRefreshCoordinator({
  readState: s1.readState,
  pullProjection: s1Pull.pullProjection,
  getAppliedIdentity: () => null,
  timer: s1Timer,
})
s1Coord.attach('t1')
const s1TickHandle = s1Timer.armed()[0]
if (s1TickHandle === undefined) throw new Error('S1: no tick armed after attach')
s1Timer.fire(s1TickHandle)
s1Timer.fire(s1TickHandle)
const s1Armed = s1Timer.armed()
const s1Delays = [...s1Timer.delays.values()]
const s1ProbeCalls = s1.calls
const s1PullCalls = s1Pull.calls

// S2: detach stops the tick.
const s2 = scriptedProbe()
const s2Pull = scriptedPullProjection()
const s2Timer = manualTimer()
const s2Coord = createTeamRefreshCoordinator({
  readState: s2.readState,
  pullProjection: s2Pull.pullProjection,
  getAppliedIdentity: () => null,
  timer: s2Timer,
})
s2Coord.attach('t1')
const s2Handle = s2Timer.armed()[0]
if (s2Handle === undefined) throw new Error('S2: no tick armed after attach')
s2Coord.detach('t1')
s2Timer.fire(s2Handle) // disarmed — no task anymore
const s2ProbeCalls = s2.calls

// S3: single-flight + dirty coalescing (two coalesced triggers + a tick
// → ONE follow-up). The in-flight caller gets round 1's result; the
// coalesced callers get the FOLLOW-UP round's result.
const s3 = scriptedProbe({
  t1: [okRoot('root-1', 10, 'lt-v1-a'), okRoot('root-1', 11, 'lt-v1-b')],
})
const s3Pull = scriptedPullProjection({ 'root-1': [APPLY, APPLY10] })
const s3Timer = manualTimer()
const s3Coord = createTeamRefreshCoordinator({
  readState: s3.readState,
  pullProjection: s3Pull.pullProjection,
  getAppliedIdentity: () => null,
  timer: s3Timer,
})
s3Coord.attach('t1')
const s3InFlight = s3Coord.trigger('t1', 'manual')
const s3Coalesced1 = s3Coord.trigger('t1', 'mutation')
const s3Coalesced2 = s3Coord.trigger('t1', 'manual')
// The tick while in flight coalesces too.
const s3TickHandle = s3Timer.armed()[0]
if (s3TickHandle === undefined) throw new Error('S3: no tick armed after attach')
s3Timer.fire(s3TickHandle)
const s3ProbeCallsBeforeSettle = s3.calls.length
const [s3First, s3C1, s3C2] = await Promise.all([s3InFlight, s3Coalesced1, s3Coalesced2])
const s3ProbeCallsAfter = s3.calls.length

// S4: the unattached forced round runs in a TRANSIENT entry (PR #35
// third follow-up P1 — a real scope, no naked round): the round runs,
// the entry leaves no attach side effect, and it is dropped after the
// round settles (no entry leak — the session is not attached).
const s4 = scriptedProbe({ fresh: [okRoot('root-fresh', 5, 'lt-v1-f')] })
const s4Pull = scriptedPullProjection({ 'root-fresh': [APPLY] })
const s4Coord = createTeamRefreshCoordinator({
  readState: s4.readState,
  pullProjection: s4Pull.pullProjection,
  getAppliedIdentity: () => null,
  timer: manualTimer(),
})
const s4Result = await s4Coord.trigger('fresh', 'mutation')
const s4Attached = s4Coord.attached()

// S5: pause stops the ticks; the forced trigger still runs; resume fires
// the immediate trigger for every attached session and re-arms the
// ticks (including a session attached while paused). The queue values
// distinguish each round.
const s5 = scriptedProbe({
  a: [okRoot('ra', 20, 'lt-v1-a'), okRoot('ra', 21, 'lt-v1-a')],
  b: [okRoot('rb', 22, 'lt-v1-b')],
  c: [okRoot('rc', 23, 'lt-v1-c')],
})
const s5Pull = scriptedPullProjection({
  ra: [APPLY, { status: 'apply', receivedGeneration: 21 }],
  rb: [{ status: 'apply', receivedGeneration: 22 }],
  rc: [{ status: 'apply', receivedGeneration: 23 }],
})
const s5Timer = manualTimer()
const s5Coord = createTeamRefreshCoordinator({
  readState: s5.readState,
  pullProjection: s5Pull.pullProjection,
  getAppliedIdentity: () => null,
  timer: s5Timer,
})
s5Coord.attach('a')
s5Coord.attach('b')
s5Coord.pause()
s5Timer.fireAll() // paused — no rounds
const s5PausedProbeCalls = s5.calls.length
const s5Forced = await s5Coord.trigger('a', 'mutation') // forced rounds ignore the pause
s5Coord.attach('c') // attached while paused — no tick armed yet
const s5ArmedWhilePaused = s5Timer.armed().length
s5Coord.resume()
const s5ResumedProbeCalls = s5.calls
const s5ArmedAfterResume = s5Timer.armed().length
const s5ResumeAgain = (() => {
  s5Coord.resume() // no-op (already running)
  return s5.calls.length
})()

// S6: a detach settles the pending coalesced caller with the last
// settled result (nothing hangs).
const s6 = scriptedProbe({ t1: [okRoot('root-1', 10, 'lt-v1-a')] })
const s6Pull = scriptedPullProjection({ 'root-1': [APPLY] })
const s6Timer = manualTimer()
const s6Coord = createTeamRefreshCoordinator({
  readState: s6.readState,
  pullProjection: s6Pull.pullProjection,
  getAppliedIdentity: () => null,
  timer: s6Timer,
})
s6Coord.attach('t1')
const s6First = s6Coord.trigger('t1', 'manual')
const s6Coalesced = s6Coord.trigger('t1', 'mutation')
s6Coord.detach('t1') // drop the follow-up; the coalesced caller must settle
const [s6FirstResult, s6CoalescedResult] = await Promise.all([s6First, s6Coalesced])

// S7: a failing PROBE is a resolved outcome; the coordinator's owed
// follow-up still runs (the coalesced trigger is a forced round), then
// the tick cadence continues.
const s7 = scriptedProbe({
  t1: [lossOutcome(), okRoot('root-1', 10, 'lt-v1-a')],
})
// The first (failing) round makes NO pull — the follow-up consumes the
// FIRST queue value.
const s7Pull = scriptedPullProjection({ 'root-1': [APPLY] })
const s7Timer = manualTimer()
const s7Coord = createTeamRefreshCoordinator({
  readState: s7.readState,
  pullProjection: s7Pull.pullProjection,
  getAppliedIdentity: () => null,
  timer: s7Timer,
})
s7Coord.attach('t1')
const s7InFlight = s7Coord.trigger('t1', 'manual')
const s7Coalesced = s7Coord.trigger('t1', 'mutation')
const [s7FirstResult, s7FollowUp] = await Promise.all([s7InFlight, s7Coalesced])
const s7ProbeCalls = s7.calls
const s7PullCalls = s7Pull.calls

// S8: the CONNECTION-RESTORED forced trigger runs a full round (the
// channel notice enters the coordinator lane).
const s8 = scriptedProbe({ s8: [okRoot('root-1', 10, 'lt-v1-a')] })
const s8Pull = scriptedPullProjection({ 'root-1': [APPLY] })
const s8Coord = createTeamRefreshCoordinator({
  readState: s8.readState,
  pullProjection: s8Pull.pullProjection,
  getAppliedIdentity: () => null,
  timer: manualTimer(),
})
const s8Result = await s8Coord.trigger('s8', 'connection-restored')

// ---------------------------------------------------------------------------
// E — the SCOPE EPOCH (PR #35 second follow-up P1-B): detach → reattach
// supersedes the old scope's in-flight round
// ---------------------------------------------------------------------------

/** One probe gate: the probe promises are parked until released. */
interface ProbeGate {
  calls: number
  readState: (sessionId: string) => Promise<TeamReadStateOutcome>
  /** Settle the parked probe of the Nth call (0-based call order). */
  releaseAt: (callIndex: number, outcome: TeamReadStateOutcome) => void
}
function gatedProbe(): ProbeGate {
  // Each call parks a promise; `releaseAt(callIndex, outcome)` settles
  // the probe of the Nth CALL (call order — the late-settle scenarios
  // release the NEW round (the later call) first).
  let calls = 0
  const parked: Array<(outcome: TeamReadStateOutcome) => void> = []
  const readState = (sessionId: string): Promise<TeamReadStateOutcome> => {
    void sessionId
    const callIndex = calls
    calls += 1
    return new Promise<TeamReadStateOutcome>((resolve) => {
      parked[callIndex] = resolve
    })
  }
  const releaseAt = (callIndex: number, outcome: TeamReadStateOutcome): void => {
    const settle = parked[callIndex]
    if (settle === undefined) throw new Error(`E guard: no parked probe for call ${callIndex}`)
    parked[callIndex] = ((x) => {
      throw new Error('E guard: probe settled twice')
    }) as (outcome: TeamReadStateOutcome) => void
    settle(outcome)
  }
  return {
    get calls() {
      return calls
    },
    readState,
    releaseAt,
  }
}

// E1: A(old) readState blocked → detach S → reattach S → B(new) starts
// and settles FIRST → A settles LATE: the old scope publishes no
// authority, makes no conditional pull, and the new entry's timer is
// intact.
const e1Gate = gatedProbe()
const e1Pull = scriptedPullProjection({ 'root-e1': [APPLY, APPLY] })
const e1Timer = manualTimer()
const e1ReadStateLog: Array<TeamReadStateOutcome['status']> = []
const e1Coord = createTeamRefreshCoordinator({
  readState: e1Gate.readState,
  pullProjection: e1Pull.pullProjection,
  getAppliedIdentity: () => null,
  onReadState: (_sessionId, outcome) => {
    e1ReadStateLog.push(outcome.status)
  },
  timer: e1Timer,
})
e1Coord.attach('e1')
const e1RoundA = e1Coord.trigger('e1', 'manual') // round A: probe parked
const e1DetachThenReattach = (() => {
  e1Coord.detach('e1') // orphan round A's scope
  e1Coord.attach('e1') // fresh entry (new epoch + new tick)
})()
void e1DetachThenReattach
const e1RoundB = e1Coord.trigger('e1', 'manual') // round B: probe parked
const e1TimerAfterB = e1Timer.armed()
// B settles first (the NEW scope is current): the probe is the team
// relation → the conditional pull is allowed. (Call order: 0 = A old,
// 1 = B new.)
e1Gate.releaseAt(1, okRoot('root-e1', 10, 'lt-v1-e1-b'))
const e1ResultB = await e1RoundB
// A settles LATE (the OLD scope is superseded): no authority, no pull.
e1Gate.releaseAt(0, okRoot('root-e1', 99, 'lt-v1-e1-a-late'))
const e1ResultA = await e1RoundA
const e1TimerAfterA = e1Timer.armed()
const e1PullCalls = e1Pull.calls

// E2: a PERMANENT detach with the probe in flight: the late settlement
// publishes NO read-state authority and makes NO projection pull.
const e2Gate = gatedProbe()
const e2Pull = scriptedPullProjection()
const e2ReadStateLog: Array<TeamReadStateOutcome['status']> = []
const e2Coord = createTeamRefreshCoordinator({
  readState: e2Gate.readState,
  pullProjection: e2Pull.pullProjection,
  getAppliedIdentity: () => null,
  onReadState: (_sessionId, outcome) => {
    e2ReadStateLog.push(outcome.status)
  },
  timer: manualTimer(),
})
e2Coord.attach('e2')
const e2Round = e2Coord.trigger('e2', 'manual') // probe parked
e2Coord.detach('e2') // permanent detach — no reattach
e2Gate.releaseAt(0, okRoot('root-e2', 10, 'lt-v1-e2-late'))
const e2Result = await e2Round
const e2PullCalls = e2Pull.calls

// ---------------------------------------------------------------------------
// COLD-E — the COLD-BOOTSTRAP session scope (PR #35 third follow-up P1,
// guide §11): the first unattached trigger creates a TRANSIENT entry;
// attach reuses it (one single-flight lane); a detach closes the cold
// scope exactly like an attached one (the late cold round is
// superseded — the old "ungated naked round that always lands"
// semantics (round-2 E3) is deleted)
// ---------------------------------------------------------------------------

// COLD-E1: attach reuses the cold transient entry (guide §11).
// trigger(S) while unattached (the round's probe is PARKED so it is
// still in flight) → attach(S) reuses the transient entry (arms the
// tick on the SAME entry) → trigger(S, manual) must NOT start a second
// probe (single-flight: dirty-coalesced). After the first settle:
// exactly ONE follow-up. Final: two probes, one timer armed, no
// overlapping rounds.
const ce1 = scriptedProbe({ s: [okRoot('root-ce1', 10, 'lt-v1-ce1-a'), okNone()] })
const ce1Pull = scriptedPullProjection({ 'root-ce1': [APPLY] })
const ce1Timer = manualTimer()
const ce1Coord = createTeamRefreshCoordinator({
  readState: ce1.readState,
  pullProjection: ce1Pull.pullProjection,
  getAppliedIdentity: () => null,
  timer: ce1Timer,
})
const ce1Cold = ce1Coord.trigger('s', 'manual') // unattached → transient entry, probe 1 (resolved immediately, round in flight)
ce1Coord.attach('s') // the view mounts while round 1 is in flight — REUSES the transient entry
const ce1ProbeCallsWhileInFlight = ce1.calls.length
const ce1Coalesced = ce1Coord.trigger('s', 'manual') // must coalesce, NOT start probe 2
const ce1AttachedAfterAttach = ce1Coord.attached()
const ce1ArmedAfterAttach = ce1Timer.armed().length
const [ce1ColdResult, ce1CoalescedResult] = await Promise.all([ce1Cold, ce1Coalesced])
const ce1ProbeCallsFinal = ce1.calls.length
const ce1ArmedFinal = ce1Timer.armed().length

// COLD-E2: detach → reattach invalidates the OLD cold scope (guide §11).
// Cold A starts in the transient entry E1 (probe parked) → attach
// reuses E1 → detach deletes E1 → reattach creates E2 → round B (in
// E2) settles healthy → A settles LATE: A publishes no authority,
// makes no conditional pull; the recorder saw B only; E2's timer is
// intact.
const ce2Gate = gatedProbe()
const ce2Pull = scriptedPullProjection({ 'root-ce2': [APPLY] }) // B's pull only
const ce2Timer = manualTimer()
const ce2ReadStateLog: Array<TeamReadStateOutcome['status']> = []
const ce2Coord = createTeamRefreshCoordinator({
  readState: ce2Gate.readState,
  pullProjection: ce2Pull.pullProjection,
  getAppliedIdentity: () => null,
  onReadState: (_sessionId, outcome) => {
    ce2ReadStateLog.push(outcome.status)
  },
  timer: ce2Timer,
})
const ce2RoundA = ce2Coord.trigger('s', 'mutation') // cold: transient E1, probe 0 parked
ce2Coord.attach('s') // reuses E1 (tick handle 1 armed)
ce2Coord.detach('s') // E1 deleted (tick disarmed)
ce2Coord.attach('s') // fresh E2 (tick handle 2 armed)
const ce2RoundB = ce2Coord.trigger('s', 'manual') // round B in E2, probe 1 parked
const ce2TimerAfterB = ce2Timer.armed()
// B settles first (the NEW scope is current): the team relation
// triggers the conditional pull. (Call order: 0 = A cold, 1 = B new.)
ce2Gate.releaseAt(1, okRoot('root-ce2', 10, 'lt-v1-ce2-b'))
const ce2ResultB = await ce2RoundB
// A settles LATE (its transient scope was closed by the detach): no
// authority, no conditional pull.
ce2Gate.releaseAt(0, okRoot('root-ce2', 9, 'lt-v1-ce2-a-late'))
const ce2ResultA = await ce2RoundA
const ce2TimerAfterA = ce2Timer.armed()

// COLD-E3: a PERMANENT detach after the cold trigger (attach happened
// in between): the late cold settlement publishes nothing, pulls
// nothing, and the session is no longer attached.
const ce3Gate = gatedProbe()
const ce3Pull = scriptedPullProjection()
const ce3ReadStateLog: Array<TeamReadStateOutcome['status']> = []
const ce3Coord = createTeamRefreshCoordinator({
  readState: ce3Gate.readState,
  pullProjection: ce3Pull.pullProjection,
  getAppliedIdentity: () => null,
  onReadState: (_sessionId, outcome) => {
    ce3ReadStateLog.push(outcome.status)
  },
  timer: manualTimer(),
})
const ce3RoundA = ce3Coord.trigger('s', 'mutation') // cold: transient entry, probe parked
ce3Coord.attach('s') // reuses the transient entry
ce3Coord.detach('s') // permanent detach — the cold scope is closed
ce3Gate.releaseAt(0, okRoot('root-ce3', 10, 'lt-v1-ce3-late'))
const ce3ResultA = await ce3RoundA
const ce3Attached = ce3Coord.attached()

// COLD-E4: trigger → attach → tick all live in the SAME SessionEntry
// (closeout guide §3 / §10): the cold round's probe is PARKED (still
// in flight) when the view attaches; the attach reuses the transient
// entry (it starts NO second probe and arms ONE tick); the 3s TICK
// firing while the cold round is still in flight dirty-coalesces (no
// concurrent probe); when the cold probe settles, it PUBLISHES its
// authority and pulls — the entry that started it is STILL the
// current entry (the same-SessionEntry proof: a delete-and-recreate
// attach would have orphaned the cold round, whose late settlement
// would be silent, the COLD-E2 semantics). The coalesced tick caller
// receives the FOLLOW-UP round's result. Final: two probes, one
// pull, one timer armed.
const ce4Gate = gatedProbe()
const ce4Pull = scriptedPullProjection({ 'root-ce4': [APPLY] })
const ce4Timer = manualTimer()
const ce4ReadStateLog: Array<TeamReadStateOutcome['status']> = []
const ce4Coord = createTeamRefreshCoordinator({
  readState: ce4Gate.readState,
  pullProjection: ce4Pull.pullProjection,
  getAppliedIdentity: () => null,
  onReadState: (_sessionId, outcome) => {
    ce4ReadStateLog.push(outcome.status)
  },
  timer: ce4Timer,
})
const ce4Cold = ce4Coord.trigger('s', 'manual') // unattached → transient entry, probe 0 parked
const ce4ProbesAfterTrigger = ce4Gate.calls
ce4Coord.attach('s') // REUSES the transient entry (guide §2.2 — no delete + recreate)
const ce4ProbesAfterAttach = ce4Gate.calls
const ce4AttachedAfterAttach = ce4Coord.attached()
const ce4TickArmedAfterAttach = ce4Timer.armed()
const ce4Tick = ce4Coord.trigger('s', 'tick') // the tick fires while the cold round is in flight → dirty-coalesced
const ce4ProbesAfterTick = ce4Gate.calls
ce4Gate.releaseAt(0, okRoot('root-ce4', 10, 'lt-v1-ce4-a'))
const ce4ColdResult = await ce4Cold
const ce4FollowUpStarted = ce4Gate.calls // the dirty follow-up (the coalesced tick) started exactly once
ce4Gate.releaseAt(1, okNone())
const ce4TickResult = await ce4Tick
const ce4ProbesFinal = ce4Gate.calls
const ce4ArmedFinal = ce4Timer.armed().length

// ---------------------------------------------------------------------------
// Assertions
// ---------------------------------------------------------------------------

describe('team-view-sync-complete — the refresh coordinator round flow (PR #35 follow-up, frozen §1.2)', () => {
  it('R1: probe team-root + no applied frame → the full pull for the root (the round result carries both)', () => {
    expect(r1Result.projectionAssessment).toEqual(APPLY)
    expect(r1Result.readState.status).toBe('ok')
    expect(r1Pull.calls).toEqual(['root-1'])
  })

  it('R2: probe team-root + applied identity UNCHANGED → the round is a no-op (NO projection request)', () => {
    expect(r2Result.projectionAssessment).toBeNull()
    expect(r2Pull.calls).toEqual([])
  })

  it('R3: probe team-member + changed pair → the full pull for the OWNING ROOT (not the session id)', () => {
    expect(r3Result.projectionAssessment).toEqual(APPLY)
    expect(r3Pull.calls).toEqual(['root-9'])
  })

  it('R4: probe team-root + applied identity of a DIFFERENT team → the full pull (the identity mismatch is a change)', () => {
    expect(r4Result.projectionAssessment).toEqual(APPLY)
    expect(r4Pull.calls).toEqual(['root-1'])
  })

  it('R5: probe none → the authoritative no-team result; NO projection request', () => {
    expect(r5Result.readState.status).toBe('ok')
    if (r5Result.readState.status !== 'ok') throw new Error('guard')
    expect(r5Result.readState.relation.kind).toBe('none')
    expect(r5Result.projectionAssessment).toBeNull()
    expect(r5Pull.calls).toEqual([])
  })

  it('R6: probe remote-error → fail closed (no pull; never a degraded none)', () => {
    expect(r6Result.readState.status).toBe('remote-error')
    if (r6Result.readState.status !== 'remote-error') throw new Error('guard')
    expect(r6Result.readState.code).toBe('TEAM_READ_STATE_OWNERSHIP_CONFLICT')
    expect(r6Result.projectionAssessment).toBeNull()
    expect(r6Pull.calls).toEqual([])
  })

  it('R7: probe malformed → fail closed (the typed malformed rides the result; no pull; never a degraded none)', () => {
    expect(r7Result.readState.status).toBe('malformed')
    expect(r7Result.projectionAssessment).toBeNull()
    expect(r7Pull.calls).toEqual([])
  })

  it('R8: probe transport-loss → fail closed (no pull)', () => {
    expect(r8Result.readState.status).toBe('transport-loss')
    expect(r8Result.projectionAssessment).toBeNull()
    expect(r8Pull.calls).toEqual([])
  })

  it('R9: the onReadState recorder sees the probe outcome of the round', () => {
    expect(r9Recorded.length).toBe(1)
    expect(r9Recorded[0]?.sessionId).toBe('s9')
    expect(r9Recorded[0]?.outcome.status).toBe('ok')
  })
})

describe('team-view-sync-complete — the per-session refresh coordinator (client-owned polling)', () => {
  it('S1: attach arms ONE 3s tick per session; the tick fires a round (probe + pull)', () => {
    expect(s1Armed.length).toBe(1)
    expect(s1Delays).toEqual([3000])
    expect(s1ProbeCalls).toEqual(['t1', 't1'])
    expect(s1PullCalls).toEqual(['root-1', 'root-1'])
    expect(s1Coord.isPaused()).toBe(false)
  })

  it('S1b: attach is idempotent (one tick even for repeat attaches)', () => {
    s1Coord.attach('t1')
    s1Coord.attach('t1')
    expect(s1Timer.armed().length).toBe(1)
  })

  it('S2: detach disarms the tick (no further rounds)', () => {
    expect(s2Timer.armed().length).toBe(0)
    expect(s2ProbeCalls).toEqual([])
    expect(s2Coord.attached()).toEqual([])
  })

  it('S3: single-flight + dirty coalescing — two coalesced triggers + a tick yield exactly ONE follow-up; the coalesced callers get the FOLLOW-UP result', () => {
    // Round 1 (the in-flight manual) + ONE follow-up = 2 probes total —
    // the second coalesced trigger + the in-flight tick added NO extra
    // rounds.
    expect(s3ProbeCallsBeforeSettle).toBe(1)
    expect(s3ProbeCallsAfter).toBe(2)
    expect(s3.calls).toEqual(['t1', 't1'])
    // The in-flight caller got round 1's result; the coalesced callers
    // got the FOLLOW-UP round's result — never the in-flight one.
    expect(s3First.projectionAssessment).toEqual(APPLY)
    expect(s3C1.projectionAssessment).toEqual(APPLY10)
    expect(s3C2.projectionAssessment).toEqual(APPLY10)
  })

  it('S4: an unattached cold trigger runs in a transient entry (real scope, no naked round) — the round runs fully, with NO attach side effect', () => {
    expect(s4Result.projectionAssessment).toEqual(APPLY)
    expect(s4Pull.calls).toEqual(['root-fresh'])
    expect(s4Attached).toEqual([]) // no attach side effect (the transient entry is not attached)
  })

  it('S5: pause stops the ticks; forced triggers still run; resume fires the immediate trigger per session, re-arms the ticks (incl. a session attached while paused), and is a no-op when running', () => {
    expect(s5PausedProbeCalls).toBe(0) // the tick no-ops while paused
    expect(s5Forced.projectionAssessment).toEqual(APPLY) // the forced round ran
    // 'a' and 'b' keep their armed handles while paused (the tick
    // callback no-ops); 'c' (attached while paused) gets NO tick yet.
    expect(s5ArmedWhilePaused).toBe(2)
    // resume: immediate trigger for 'a', 'b', 'c' (the forced 'a' round
    // already settled, so the resume trigger is a fresh round each).
    expect(s5ResumedProbeCalls).toEqual(['a', 'a', 'b', 'c'])
    expect(s5ArmedAfterResume).toBe(3)
    expect(s5ResumeAgain).toBe(4) // the second resume is a no-op
  })

  it('S6: a detach during an in-flight round supersedes its scope (P1-B) — nothing hangs: both callers settle with the superseded round result (no conditional pull, no authority publication)', () => {
    // The detach happened while the probe was in flight: the round's
    // scope was superseded before it settled, so it published no
    // read-state authority and made NO conditional pull.
    expect(s6FirstResult.projectionAssessment).toBeNull()
    // The coalesced caller settles with the same superseded result
    // (nothing hangs).
    expect(s6CoalescedResult.projectionAssessment).toBeNull()
    expect(s6CoalescedResult.readState).toEqual(s6FirstResult.readState)
    expect(s6.calls.length).toBe(1) // the in-flight round ran; the follow-up did not
  })

  it('S7: a failing probe is a resolved outcome; the owed follow-up still runs (and pulls — its probe succeeds); the cadence continues', () => {
    expect(s7FirstResult.readState.status).toBe('transport-loss')
    expect(s7FirstResult.projectionAssessment).toBeNull()
    expect(s7FollowUp.readState.status).toBe('ok')
    expect(s7FollowUp.projectionAssessment).toEqual(APPLY)
    expect(s7ProbeCalls).toEqual(['t1', 't1'])
    expect(s7PullCalls).toEqual(['root-1']) // only the follow-up pulled
  })

  it('S8: the connection-restored forced trigger runs a full round', () => {
    expect(s8Result.readState.status).toBe('ok')
    expect(s8Result.projectionAssessment).toEqual(APPLY)
    expect(s8Pull.calls).toEqual(['root-1'])
  })
})

describe('team-view-sync-complete — the refresh coordinator scope epoch (PR #35 second follow-up P1-B)', () => {
  it('E1: detach then reattach supersedes the old scope — the late old round publishes NO authority, makes NO conditional pull; the new scope records its own probe and the new entry timer stays intact', async () => {
    // Round B (the NEW scope) settled first: its probe landed in the
    // read-state recorder and its team relation triggered the
    // conditional pull.
    expect(e1ResultB.readState.status).toBe('ok')
    if (e1ResultB.readState.status !== 'ok') throw new Error('E1 guard')
    expect(e1ResultB.readState.relation.kind).toBe('team-root')
    expect(e1ResultB.projectionAssessment).toEqual(APPLY)
    // Round A (the OLD scope) settled late: its result is returned to
    // its own caller only — the read-state recorder saw NO second
    // publication (the late outcome must not overwrite B's authority).
    expect(e1ResultA.readState.status).toBe('ok')
    if (e1ResultA.readState.status !== 'ok') throw new Error('E1 guard')
    // The late old scope made NO conditional projection pull (only B's
    // pull exists).
    expect(e1PullCalls).toEqual(['root-e1'])
    // The read-state recorder saw exactly B's outcome (one publication,
    // the new scope's).
    expect(e1ReadStateLog).toEqual(['ok'])
    // The new entry's timer is intact (the late old settlement neither
    // disarmed nor re-armed it; exactly one tick is armed).
    expect(e1TimerAfterB.length).toBe(1)
    expect(e1TimerAfterA).toEqual(e1TimerAfterB)
    // Both probes ran (A + B) — the coordinator did not swallow A's
    // probe, it only refused to publish its late result.
    expect(e1Gate.calls).toBe(2)
  })

  it('E2: a permanent detach with the probe in flight — the late settlement publishes NO read-state authority and makes NO projection pull', async () => {
    // The round result still reaches its own caller (nothing hangs).
    expect(e2Result.readState.status).toBe('ok')
    if (e2Result.readState.status !== 'ok') throw new Error('E2 guard')
    expect(e2Result.readState.relation.kind).toBe('team-root')
    // But the superseded scope made no side effects at all.
    expect(e2ReadStateLog).toEqual([])
    expect(e2PullCalls).toEqual([])
    expect(e2Result.projectionAssessment).toBeNull()
  })

})

describe('team-view-sync-complete — the cold-bootstrap session scope (PR #35 third follow-up P1, guide §11)', () => {
  it('COLD-E1: attach REUSES the cold transient entry — the second trigger is dirty-coalesced (no second probe), the follow-up runs exactly once, one timer armed, no overlapping rounds', async () => {
    // While round 1 (the cold round) was in flight, the second trigger
    // started NO second probe — single-flight over the SAME entry
    // (the attach reused the transient entry, it did not start a new
    // scope the cold round could not see).
    expect(ce1ProbeCallsWhileInFlight).toBe(1)
    // The attach saw the session as attached (the transient entry
    // flipped, not replaced) and armed exactly one tick.
    expect(ce1AttachedAfterAttach).toEqual(['s'])
    expect(ce1ArmedAfterAttach).toBe(1)
    // Round 1 (team relation, no applied identity) pulled; its caller
    // got round 1's result.
    expect(ce1ColdResult.readState.status).toBe('ok')
    if (ce1ColdResult.readState.status !== 'ok') throw new Error('COLD-E1 guard')
    expect(ce1ColdResult.readState.relation.kind).toBe('team-root')
    expect(ce1ColdResult.projectionAssessment).toEqual(APPLY)
    // The coalesced trigger got the FOLLOW-UP round's result (the
    // follow-up's probe = the default none → the authoritative
    // no-team round, no second pull).
    expect(ce1CoalescedResult.readState.status).toBe('ok')
    if (ce1CoalescedResult.readState.status !== 'ok') throw new Error('COLD-E1 guard')
    expect(ce1CoalescedResult.readState.relation.kind).toBe('none')
    expect(ce1CoalescedResult.projectionAssessment).toBeNull()
    // Final: round 1 + exactly ONE follow-up = two probes; one timer
    // armed; no overlapping rounds.
    expect(ce1ProbeCallsFinal).toBe(2)
    expect(ce1.calls).toEqual(['s', 's'])
    expect(ce1ArmedFinal).toBe(1)
    expect(ce1Pull.calls).toEqual(['root-ce1'])
  })

  it('COLD-E2: detach → reattach invalidates the OLD cold scope — the late cold round publishes NO authority, makes NO conditional pull; the new scope records its own probe and its timer stays intact', async () => {
    // Round B (the NEW scope E2) settled first: its probe landed in
    // the read-state recorder and its team relation triggered the
    // conditional pull.
    expect(ce2ResultB.readState.status).toBe('ok')
    if (ce2ResultB.readState.status !== 'ok') throw new Error('COLD-E2 guard')
    expect(ce2ResultB.readState.relation.kind).toBe('team-root')
    expect(ce2ResultB.projectionAssessment).toEqual(APPLY)
    // Round A (the COLD scope E1, closed by the detach) settled late:
    // its result is returned to its own caller only — no authority
    // publication, no conditional projection pull.
    expect(ce2ResultA.readState.status).toBe('ok')
    if (ce2ResultA.readState.status !== 'ok') throw new Error('COLD-E2 guard')
    expect(ce2ResultA.readState.relation.kind).toBe('team-root')
    expect(ce2ResultA.projectionAssessment).toBeNull()
    // The recorder saw exactly B's outcome (one publication).
    expect(ce2ReadStateLog).toEqual(['ok'])
    // Only B's pull exists (the late cold scope pulled nothing).
    expect(ce2Pull.calls).toEqual(['root-ce2'])
    // Both probes ran (A + B) — the coordinator refused to publish A's
    // late result, it did not swallow the probe.
    expect(ce2Gate.calls).toBe(2)
    // E2's timer is intact (the late cold settlement neither disarmed
    // nor re-armed it; exactly one tick armed, the same handle).
    expect(ce2TimerAfterB.length).toBe(1)
    expect(ce2TimerAfterA).toEqual(ce2TimerAfterB)
  })

  it('COLD-E3: a permanent detach after the cold trigger — the late cold settlement publishes nothing, pulls nothing, and the session is no longer attached', async () => {
    // The cold round's result still reaches its own caller (nothing
    // hangs) — but the closed cold scope made no side effects at all.
    expect(ce3ResultA.readState.status).toBe('ok')
    if (ce3ResultA.readState.status !== 'ok') throw new Error('COLD-E3 guard')
    expect(ce3ResultA.projectionAssessment).toBeNull()
    expect(ce3ReadStateLog).toEqual([])
    expect(ce3Pull.calls).toEqual([])
    expect(ce3Attached).toEqual([])
  })

  it('COLD-E4: trigger → attach → tick stay in the SAME SessionEntry (closeout guide §3/§10) — the attach starts no second refresh lane, the in-flight tick coalesces, and the cold round still PUBLISHES on settle (reuse, not replace)', async () => {
    // The cold trigger created the transient entry and parked its
    // probe (one call — nothing else started a probe).
    expect(ce4ProbesAfterTrigger).toBe(1)
    // The attach saw the transient entry and flipped it: it started NO
    // second probe (no second refresh lane — the guide §2.2 forbidden
    // delete + recreate is excluded behaviorally) and armed exactly
    // one tick on that same entry.
    expect(ce4ProbesAfterAttach).toBe(1)
    expect(ce4AttachedAfterAttach).toEqual(['s'])
    expect(ce4TickArmedAfterAttach.length).toBe(1)
    // The tick firing while the cold round is still in flight
    // dirty-coalesced: no concurrent probe (single-flight maintained
    // over the same entry).
    expect(ce4ProbesAfterTick).toBe(1)
    // The cold round settled in the CURRENT scope: it PUBLISHED its
    // read-state authority (the same-SessionEntry proof — a replaced
    // entry would have made this settlement silent, the COLD-E2
    // semantics) and made its conditional pull.
    expect(ce4ColdResult.readState.status).toBe('ok')
    if (ce4ColdResult.readState.status !== 'ok') throw new Error('COLD-E4 guard')
    expect(ce4ColdResult.readState.relation.kind).toBe('team-root')
    expect(ce4ColdResult.projectionAssessment).toEqual(APPLY)
    // Exactly one dirty follow-up started after the settle (the
    // coalesced tick's owed forced round) — no second lane.
    expect(ce4FollowUpStarted).toBe(2)
    // The coalesced tick caller received the FOLLOW-UP round's result
    // (the follow-up's probe = none → the authoritative no-team round,
    // no second pull).
    expect(ce4TickResult.readState.status).toBe('ok')
    if (ce4TickResult.readState.status !== 'ok') throw new Error('COLD-E4 guard')
    expect(ce4TickResult.readState.relation.kind).toBe('none')
    expect(ce4TickResult.projectionAssessment).toBeNull()
    // Final: the cold round + exactly ONE follow-up = two probes;
    // one pull (the cold round's); one timer armed; the recorder saw
    // both publications (the cold round's team authority + the
    // follow-up's none) in order.
    expect(ce4ProbesFinal).toBe(2)
    expect(ce4Pull.calls).toEqual(['root-ce4'])
    expect(ce4ArmedFinal).toBe(1)
    expect(ce4ReadStateLog).toEqual(['ok', 'ok'])
  })
})
