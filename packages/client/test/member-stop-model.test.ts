/**
 * PD-34 (MEMBER-STOP) — the per-Member stop sequence, host-free.
 *
 * These tests pin the ONE thing the UI is allowed to do when a human presses
 * "stop this Member": the exact public RPCs, in the exact order, with the
 * exact arguments, and an outcome that reports what the goal service said on
 * a SECOND read. They are the host-free half of the live evidence: the live
 * arm drives the same wire calls through the same public namespaces.
 *
 * The negative controls live here too: a pause the service refuses must NOT
 * be reported as a stop, a read the service refuses must NOT fall through to
 * a cancel-only path that would let the goal keep running, and a re-read that
 * comes back `active` must be reported as `active` (no smoothing).
 *
 * Plain-node test (the sanctioned runner executes `.test.ts` only): the model
 * is pure — no React, no I/O, no timers.
 */
import { describe, expect, it } from 'vitest'
import {
  stopLeaderTurn,
  stopMember,
  type MemberGoalView,
  type MemberStopGoalSeam,
  type MemberStopSessionSeam,
} from '../src/model/member-stop.js'

/** One recorded wire call (namespace + method + args). */
interface Call {
  readonly seam: 'goals' | 'session'
  readonly method: string
  readonly args: readonly unknown[]
}

/**
 * A recording goal seam. `views` is consumed one entry per `get`; `pauseView`
 * is what `pause` answers. `refusal` forces one method to answer a typed
 * failure.
 */
function goalSeam(options: {
  readonly views?: readonly (MemberGoalView | undefined)[]
  readonly pauseView?: MemberGoalView
  readonly refusal?: { readonly method: 'get' | 'pause'; readonly code: string; readonly message: string }
  readonly throwOn?: 'get' | 'pause'
  readonly calls: Call[]
}): MemberStopGoalSeam {
  let read = 0
  return {
    async get(memberSessionId: string) {
      options.calls.push({ seam: 'goals', method: 'get', args: [memberSessionId] })
      if (options.throwOn === 'get') throw new Error('socket closed')
      if (options.refusal?.method === 'get') {
        return { ok: false, error: { code: options.refusal.code, message: options.refusal.message } }
      }
      const views = options.views ?? []
      const value = views[Math.min(read, views.length - 1)]
      read += 1
      return { ok: true, value }
    },
    async pause(memberSessionId: string, ref: { id: string; revision: number }) {
      options.calls.push({ seam: 'goals', method: 'pause', args: [memberSessionId, ref] })
      if (options.throwOn === 'pause') throw new Error('socket closed')
      if (options.refusal?.method === 'pause') {
        return { ok: false, error: { code: options.refusal.code, message: options.refusal.message } }
      }
      return { ok: true, value: options.pauseView ?? { id: ref.id, revision: ref.revision + 1, phase: 'paused' } }
    },
  }
}

/** A recording session seam. */
function sessionSeam(options: {
  readonly answer?: 'accepted' | 'not-found' | 'refused'
  readonly throws?: boolean
  readonly calls: Call[]
}): MemberStopSessionSeam {
  return {
    async cancel(request: { readonly sessionId: string }) {
      options.calls.push({ seam: 'session', method: 'cancel', args: [request] })
      if (options.throws === true) throw new Error('connection lost')
      if (options.answer === 'not-found') {
        return { ok: false, error: { code: 'session/not-found', message: 'not attached' } }
      }
      if (options.answer === 'refused') {
        return { ok: false, error: { code: 'session/subagent-owned', message: 'owned by a subagent' } }
      }
      return { ok: true, value: { accepted: true } }
    },
  }
}

const ACTIVE: MemberGoalView = { id: 'goal-1', revision: 2, phase: 'active' }
const PAUSED: MemberGoalView = { id: 'goal-1', revision: 3, phase: 'paused' }

describe('pd34 stopMember — the sequence the UI emits', () => {
  it('pauses the durable goal FIRST, then cancels the turn, then re-reads the phase', async () => {
    const calls: Call[] = []
    const outcome = await stopMember({
      goals: goalSeam({ views: [ACTIVE, PAUSED], pauseView: PAUSED, calls }),
      session: sessionSeam({ calls }),
    }, 'session-member-a')

    expect(outcome.kind).toBe('stopped')
    expect(calls.map(call => `${call.seam}.${call.method}`)).toEqual([
      'goals.get', 'goals.pause', 'session.cancel', 'goals.get',
    ])
    // The CAS reference is the revision the FIRST read observed.
    expect(calls[1]?.args).toEqual(['session-member-a', { id: 'goal-1', revision: 2 }])
    expect(calls[2]?.args).toEqual([{ sessionId: 'session-member-a' }])
    if (outcome.kind !== 'stopped') throw new Error('expected stopped')
    expect(outcome.revision).toBe(3)
    expect(outcome.phase).toBe('paused')
    // The reported phase is the SECOND read (the durable observation).
    expect(outcome.observedPhase).toBe('paused')
    expect(outcome.cancel.kind).toBe('accepted')
  })

  it('still aborts the turn when the Member has no goal, and says so', async () => {
    const calls: Call[] = []
    const outcome = await stopMember({
      goals: goalSeam({ views: [undefined], calls }),
      session: sessionSeam({ calls }),
    }, 'session-member-b')

    expect(outcome.kind).toBe('no-goal')
    expect(calls.map(call => `${call.seam}.${call.method}`)).toEqual(['goals.get', 'session.cancel'])
  })

  it('never issues a second pause for an already-inactive goal', async () => {
    const calls: Call[] = []
    const outcome = await stopMember({
      goals: goalSeam({ views: [PAUSED], calls }),
      session: sessionSeam({ calls }),
    }, 'session-member-c')

    expect(outcome.kind).toBe('already-inactive')
    if (outcome.kind !== 'already-inactive') throw new Error('expected already-inactive')
    expect(outcome.phase).toBe('paused')
    expect(calls.map(call => `${call.seam}.${call.method}`)).toEqual(['goals.get', 'session.cancel'])
  })

  it('reports a refused pause as a refusal and does NOT claim a stop', async () => {
    const calls: Call[] = []
    const outcome = await stopMember({
      goals: goalSeam({
        views: [ACTIVE],
        refusal: { method: 'pause', code: 'goal/stale-revision', message: 'revision moved' },
        calls,
      }),
      session: sessionSeam({ calls }),
    }, 'session-member-d')

    expect(outcome.kind).toBe('pause-refused')
    if (outcome.kind !== 'pause-refused') throw new Error('expected pause-refused')
    expect(outcome.code).toBe('goal/stale-revision')
    // No cancel after a failed pause: a cancel would let a still-active goal
    // start its next round, which is the failure this entry exists to prevent.
    expect(calls.map(call => `${call.seam}.${call.method}`)).toEqual(['goals.get', 'goals.pause'])
  })

  it('reports a refused read as a refusal and issues no cancel', async () => {
    const calls: Call[] = []
    const outcome = await stopMember({
      goals: goalSeam({ refusal: { method: 'get', code: 'goal/not-live', message: 'no live agent' }, calls }),
      session: sessionSeam({ calls }),
    }, 'session-member-e')

    expect(outcome.kind).toBe('read-refused')
    expect(calls.map(call => `${call.seam}.${call.method}`)).toEqual(['goals.get'])
  })

  it('reports the phase it actually observed on the second read (never smooths "active")', async () => {
    const calls: Call[] = []
    const outcome = await stopMember({
      goals: goalSeam({ views: [ACTIVE, { ...ACTIVE, revision: 3 }], pauseView: PAUSED, calls }),
      session: sessionSeam({ calls }),
    }, 'session-member-f')

    if (outcome.kind !== 'stopped') throw new Error('expected stopped')
    expect(outcome.observedPhase).toBe('active')
  })

  it('keeps the durable stop when the cancel is refused (a detach is not a failed stop)', async () => {
    const calls: Call[] = []
    const detached = await stopMember({
      goals: goalSeam({ views: [ACTIVE, PAUSED], pauseView: PAUSED, calls }),
      session: sessionSeam({ answer: 'not-found', calls }),
    }, 'session-member-g')
    if (detached.kind !== 'stopped') throw new Error('expected stopped')
    expect(detached.cancel.kind).toBe('not-attached')

    const refused = await stopMember({
      goals: goalSeam({ views: [ACTIVE, PAUSED], pauseView: PAUSED, calls }),
      session: sessionSeam({ answer: 'refused', calls }),
    }, 'session-member-h')
    if (refused.kind !== 'stopped') throw new Error('expected stopped')
    expect(refused.cancel.kind).toBe('refused')
    if (refused.cancel.kind !== 'refused') throw new Error('expected refused')
    expect(refused.cancel.code).toBe('session/subagent-owned')

    const thrown = await stopMember({
      goals: goalSeam({ views: [ACTIVE, PAUSED], pauseView: PAUSED, calls }),
      session: sessionSeam({ throws: true, calls }),
    }, 'session-member-i')
    if (thrown.kind !== 'stopped') throw new Error('expected stopped')
    expect(thrown.cancel.kind).toBe('refused')
    if (thrown.cancel.kind !== 'refused') throw new Error('expected refused')
    expect(thrown.cancel.code).toBe('transport-loss')
  })

  it('reports "unavailable" when the host serves no goal namespace, and cancels nothing', async () => {
    const calls: Call[] = []
    const outcome = await stopMember({ session: sessionSeam({ calls }) }, 'session-member-j')
    expect(outcome.kind).toBe('unavailable')
    expect(calls).toEqual([])
  })

  it('reports a throwing read as a transport-loss refusal (not a stop)', async () => {
    const calls: Call[] = []
    const outcome = await stopMember({
      goals: goalSeam({ throwOn: 'get', calls }),
      session: sessionSeam({ calls }),
    }, 'session-member-k')
    expect(outcome.kind).toBe('read-refused')
    if (outcome.kind !== 'read-refused') throw new Error('expected read-refused')
    expect(outcome.code).toBe('transport-loss')
  })
})

describe('pd34 stopLeaderTurn — a DIFFERENT action', () => {
  it('cancels the Leader turn only: no goal read, no goal pause, no Member touched', async () => {
    const calls: Call[] = []
    const outcome = await stopLeaderTurn({ goals: goalSeam({ calls }), session: sessionSeam({ calls }) }, 'team-root-s')

    expect(outcome.kind).toBe('accepted')
    expect(calls.map(call => `${call.seam}.${call.method}`)).toEqual(['session.cancel'])
    expect(calls[0]?.args).toEqual([{ sessionId: 'team-root-s' }])
  })
})
