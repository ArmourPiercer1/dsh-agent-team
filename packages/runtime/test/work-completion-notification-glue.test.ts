/**
 * Work-completion wake-up — the live-glue
 * `deliverRootWorkCompletionNotification` tests (plan §24, G1–G6):
 *
 *   G1. idle Leader — `status === 'idle'` → followup called exactly once,
 *       steer 0, and NO whenIdle await (the success boundary is the
 *       followup/steer ACCEPTANCE, plan §16);
 *   G2. busy Leader — `status === 'running'` → steer called exactly once
 *       (the current turn's next step boundary), followup 0;
 *   G3. message source — the delivered input carries the upstream
 *       plugin attribution (`source.kind === 'plugin'`,
 *       `source.plugin === 'dsh-agent-team'`) and the rendered text
 *       verbatim (a runtime event, not a human message);
 *   G4. missing root id — clear rejection (no agent touched);
 *   G5. missing text — clear rejection (no agent touched);
 *   G6. delivery throw propagates to the notifier (followup / steer
 *       throwing rejects the glue promise — the router observer is the
 *       layer that swallows it; the glue never swallows).
 *
 * Harness: the t12a-live-bridge doubles driving the REAL
 * agent-bindings.mjs (the same boundary the C1 glue suite asserts on;
 * the double's agent `status` is a mutable plain property modeling the
 * real Agent's `status` getter, default 'idle').
 */

import { describe, expect, it } from 'vitest'

import { createLiveWorld } from './t12a-live-bridge.mjs'

const ROOT = 'session-wcn-glue-root'
const NOTIFICATION_TEXT = [
  '[team-work-settled requestToken=wcn-glue-1]',
  '',
  'An asynchronous Team work unit has settled.',
  'instanceId: inst-wcnworker',
  'taskSummary: probe the deployment',
  'requestToken: wcn-glue-1',
  '',
  'Use team_collect with this requestToken to read the durable result.',
].join('\n')

const S = await (async () => {
  // Count the whenIdle invocations (G1/G2: the glue must NOT await
  // whenIdle — plan §16's acceptance-boundary).
  let whenIdleCalls = 0
  const world = await createLiveWorld({
    rootSessionId: ROOT,
    agents: {
      whenIdleBehavior: async () => {
        whenIdleCalls += 1
      },
    },
  })
  await world.binding.boot()
  const leaderHandle = await world.binding.ensureLiveAgent(ROOT)

  // (G1) idle Leader (the double default): followup only.
  const followupsBefore = world.records.followups.length
  const steersBefore = world.records.steers.length
  const whenIdleBefore = whenIdleCalls
  await world.binding.deliverRootWorkCompletionNotification({
    rootSessionId: ROOT,
    text: NOTIFICATION_TEXT,
  })
  const g1AddedFollowups = world.records.followups.slice(followupsBefore)
  const g1AddedSteers = world.records.steers.slice(steersBefore)
  const g1WhenIdleDelta = whenIdleCalls - whenIdleBefore

  // (G2) busy Leader: steer only.
  leaderHandle.agent.status = 'running'
  const followupsBeforeBusy = world.records.followups.length
  const steersBeforeBusy = world.records.steers.length
  const whenIdleBeforeBusy = whenIdleCalls
  await world.binding.deliverRootWorkCompletionNotification({
    rootSessionId: ROOT,
    text: NOTIFICATION_TEXT,
  })
  const g2AddedFollowups = world.records.followups.slice(followupsBeforeBusy)
  const g2AddedSteers = world.records.steers.slice(steersBeforeBusy)
  const g2WhenIdleDelta = whenIdleCalls - whenIdleBeforeBusy
  leaderHandle.agent.status = 'idle'

  // (G4) missing root id.
  async function captureReject(fn: () => Promise<void>): Promise<unknown> {
    try {
      await fn()
      return undefined
    } catch (error) {
      return error
    }
  }
  const rejectEmptyRoot = await captureReject(() =>
    world.binding.deliverRootWorkCompletionNotification({
      rootSessionId: '',
      text: NOTIFICATION_TEXT,
    }),
  )
  // (G5) missing text.
  const rejectEmptyText = await captureReject(() =>
    world.binding.deliverRootWorkCompletionNotification({
      rootSessionId: ROOT,
      text: '',
    }),
  )
  // Neither rejection may have touched the agent:
  const recordsAfterRejections = {
    followups: world.records.followups.length,
    steers: world.records.steers.length,
  }

  // (G6a) followup throwing propagates (idle path).
  const originalFollowup = leaderHandle.agent.followup
  leaderHandle.agent.followup = () => {
    throw new Error('glue: agent followup unavailable (injected)')
  }
  const rejectFollowupThrow = await captureReject(() =>
    world.binding.deliverRootWorkCompletionNotification({
      rootSessionId: ROOT,
      text: NOTIFICATION_TEXT,
    }),
  )
  leaderHandle.agent.followup = originalFollowup
  // (G6b) steer throwing propagates (busy path).
  const originalSteer = leaderHandle.agent.steer
  leaderHandle.agent.status = 'running'
  leaderHandle.agent.steer = () => {
    throw new Error('glue: agent steer unavailable (injected)')
  }
  const rejectSteerThrow = await captureReject(() =>
    world.binding.deliverRootWorkCompletionNotification({
      rootSessionId: ROOT,
      text: NOTIFICATION_TEXT,
    }),
  )
  leaderHandle.agent.steer = originalSteer
  leaderHandle.agent.status = 'idle'

  await world.binding.close()

  return {
    g1AddedFollowups,
    g1AddedSteers,
    g1WhenIdleDelta,
    g2AddedFollowups,
    g2AddedSteers,
    g2WhenIdleDelta,
    rejectEmptyRoot,
    rejectEmptyText,
    recordsAfterRejections,
    rejectFollowupThrow,
    rejectSteerThrow,
    totalFollowups: world.records.followups.length,
    totalSteers: world.records.steers.length,
  }
})()

describe('deliverRootWorkCompletionNotification (work-completion wake-up) — the live Leader wake delivery', () => {
  it('G1: an idle Leader gets ONE followup — no steer, and NO whenIdle await (acceptance boundary)', () => {
    expect(S.g1AddedFollowups).toHaveLength(1)
    expect(S.g1AddedSteers).toHaveLength(0)
    expect(S.g1WhenIdleDelta).toBe(0)
    expect(S.g1AddedFollowups[0]!.sessionId).toBe(ROOT)
  })

  it('G2: a busy (running) Leader gets ONE steer — no followup, no whenIdle await', () => {
    expect(S.g2AddedSteers).toHaveLength(1)
    expect(S.g2AddedFollowups).toHaveLength(0)
    expect(S.g2WhenIdleDelta).toBe(0)
    expect(S.g2AddedSteers[0]!.sessionId).toBe(ROOT)
  })

  it('G3: the delivered input carries the plugin attribution and the text verbatim', () => {
    // the G1 followup is the first recorded input on the root
    const delivered = S.g1AddedFollowups[0]!.message as unknown as {
      role: string
      content: Array<{ type: string; text: string }>
      source: { kind: string; plugin?: string }
    }
    expect(delivered.role).toBe('user')
    expect(delivered.source.kind).toBe('plugin')
    expect(delivered.source.plugin).toBe('dsh-agent-team')
    expect(delivered.content).toHaveLength(1)
    expect(delivered.content[0]!.text).toBe(NOTIFICATION_TEXT)
  })

  it('G4: an empty root id REJECTS with a clear error (no agent touched)', () => {
    expect(S.rejectEmptyRoot).toBeInstanceOf(Error)
    expect(String(S.rejectEmptyRoot)).toContain('non-empty rootSessionId')
  })

  it('G5: an empty text REJECTS with a clear error (no agent touched)', () => {
    expect(S.rejectEmptyText).toBeInstanceOf(Error)
    expect(String(S.rejectEmptyText)).toContain('non-empty text')
    // neither rejection path reached the agent (no followup, no steer)
    expect(S.recordsAfterRejections.followups).toBe(1) // only the G1 delivery
    expect(S.recordsAfterRejections.steers).toBe(1) // only the G2 delivery
  })

  it('G6: a followup/steer throw REJECTS the glue promise (the router observer swallows, not the glue)', () => {
    expect(S.rejectFollowupThrow).toBeInstanceOf(Error)
    expect(String(S.rejectFollowupThrow)).toContain('agent followup unavailable')
    expect(S.rejectSteerThrow).toBeInstanceOf(Error)
    expect(String(S.rejectSteerThrow)).toContain('agent steer unavailable')
  })
})
