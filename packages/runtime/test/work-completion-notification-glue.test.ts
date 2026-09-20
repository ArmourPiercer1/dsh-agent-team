/**
 * Work-completion wake-up — the live-glue
 * `deliverRootWorkCompletionNotification` tests (plan §24, G1–G8):
 *
 *   G1. idle Leader — `status === 'idle'` → followup called exactly once,
 *       steer/inject 0, and NO whenIdle await (the success boundary is the
 *       followup/inject ACCEPTANCE, plan §16);
 *   G2. busy Leader — `status === 'running'` → inject called exactly once
 *       (Stop-priority: the NON-WAKING next-step send), followup 0,
 *       steer 0, no whenIdle await;
 *   G3. message source — the delivered input carries the upstream
 *       plugin attribution (`source.kind === 'plugin'`,
 *       `source.plugin === 'dsh-agent-team'`) and the rendered text
 *       verbatim (a runtime event, not a human message);
 *   G4. missing root id — clear rejection (no agent touched);
 *   G5. missing text — clear rejection (no agent touched);
 *   G6. delivery throw propagates to the notifier (followup / inject
 *       throwing rejects the glue promise — the router observer is the
 *       layer that swallows it; the glue never swallows);
 *   G7. Stop-priority (interface pin) — a cancelled-converging Leader is
 *       OBSERVED as `status === 'running'` (the public Agent `status`
 *       getter has no separate aborting value — the abort signal is
 *       phase-internal), and the completion wake uses `inject`, never
 *       `steer`: DSH v0.1.5-rc.2 agent-loop `agent.ts` @ fb2c4b9e69
 *       defines `inject(input) = send(input, 'next-step', false)` while
 *       `steer(input) = send(input, 'next-step', true`), and
 *       `wakingAfterAbort` re-routes to next-turn (re-waking the driver)
 *       ONLY for WAKING sends on an aborted non-idle phase — a non-waking
 *       inject therefore never re-opens a turn the user Stopped. The
 *       double records which primitive the glue picked (the honest
 *       interface-level scope: the redirect/wake semantics live in the
 *       DSH core, not in this boundary); the known retirement
 *       microtask race (status read `running`; the driver finishes its
 *       last inbox check; the inject waits in the inbox until the next
 *       input) is ACCEPTED by design — the notification is an
 *       at-most-once best-effort wake attempt, and the durable
 *       settlement fact + `team_collect` are the recovery authority.
 *   G8. close race must NOT resurrect the Leader:
 *       (a) once `close()` has started, a completion delivery REJECTS
 *           (no followup/inject/steer reaches the agent); after close
 *           completes the root carries no live handle;
 *       (b) the strong race — an in-flight `agents.resume()` suspended
 *           in the agents seam while `close()` runs to completion: the
 *           late-resumed handle is disposed by `ensureLiveAgent` and
 *           NEVER written into `liveAgents` (`hasLive(root) === false`
 *           after close; exactly one dispose of the late handle).
 *
 * Harness: the t12a-live-bridge doubles driving the REAL
 * agent-bindings.mjs (the same boundary the C1 glue suite asserts on;
 * the double's agent `status` is a mutable plain property modeling the
 * real Agent's `status` getter, default 'idle'; `inject` is recorded
 * alongside `followup`/`steer`; `resumeGate` suspends a resume for the
 * G8(b) interleaving).
 */

import { describe, expect, it } from 'vitest'

import {
  WORKTREE_ROOT,
  createLiveWorld,
  removeFixtureHome,
  withDshHome,
  writeDurableFixture,
} from './t12a-live-bridge.mjs'

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

async function captureReject(fn: () => Promise<unknown>): Promise<unknown> {
  try {
    await fn()
    return undefined
  } catch (error) {
    return error
  }
}

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
  const injectsBefore = world.records.injects.length
  const whenIdleBefore = whenIdleCalls
  await world.binding.deliverRootWorkCompletionNotification({
    rootSessionId: ROOT,
    text: NOTIFICATION_TEXT,
  })
  const g1AddedFollowups = world.records.followups.slice(followupsBefore)
  const g1AddedSteers = world.records.steers.slice(steersBefore)
  const g1AddedInjects = world.records.injects.slice(injectsBefore)
  const g1WhenIdleDelta = whenIdleCalls - whenIdleBefore

  // (G2) busy Leader: inject only (Stop-priority — the non-waking
  // next-step send; no steer, no followup).
  leaderHandle.agent.status = 'running'
  const followupsBeforeBusy = world.records.followups.length
  const steersBeforeBusy = world.records.steers.length
  const injectsBeforeBusy = world.records.injects.length
  const whenIdleBeforeBusy = whenIdleCalls
  await world.binding.deliverRootWorkCompletionNotification({
    rootSessionId: ROOT,
    text: NOTIFICATION_TEXT,
  })
  const g2AddedFollowups = world.records.followups.slice(followupsBeforeBusy)
  const g2AddedSteers = world.records.steers.slice(steersBeforeBusy)
  const g2AddedInjects = world.records.injects.slice(injectsBeforeBusy)
  const g2WhenIdleDelta = whenIdleCalls - whenIdleBeforeBusy

  // (G7) Stop-priority interface pin — a cancelled-converging turn is
  // observed as `status === 'running'` (the public getter has no abort
  // value; the abort signal is phase-internal to the DSH core). The
  // completion wake must pick inject (non-waking next-step), never
  // steer (waking next-step — the one primitive DSH re-routes to
  // next-turn after an abort, re-opening the Stopped turn).
  const followupsBeforeStop = world.records.followups.length
  const steersBeforeStop = world.records.steers.length
  const injectsBeforeStop = world.records.injects.length
  await world.binding.deliverRootWorkCompletionNotification({
    rootSessionId: ROOT,
    text: NOTIFICATION_TEXT,
  })
  const g7AddedFollowups = world.records.followups.slice(followupsBeforeStop)
  const g7AddedSteers = world.records.steers.slice(steersBeforeStop)
  const g7AddedInjects = world.records.injects.slice(injectsBeforeStop)
  leaderHandle.agent.status = 'idle'

  // (G4) missing root id.
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
    injects: world.records.injects.length,
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
  // (G6b) inject throwing propagates (busy path).
  const originalInject = leaderHandle.agent.inject
  leaderHandle.agent.status = 'running'
  leaderHandle.agent.inject = () => {
    throw new Error('glue: agent inject unavailable (injected)')
  }
  const rejectInjectThrow = await captureReject(() =>
    world.binding.deliverRootWorkCompletionNotification({
      rootSessionId: ROOT,
      text: NOTIFICATION_TEXT,
    }),
  )
  leaderHandle.agent.inject = originalInject
  leaderHandle.agent.status = 'idle'

  // (G8a) close race — a delivery that starts AFTER close() has begun
  // must REJECT (best-effort liveness failure; the router observer
  // swallows it) and must not append model-visible input to an agent
  // whose teardown has started. close() marks its lifecycle state
  // synchronously before the first await, so an un-awaited call has
  // already entered the closing state.
  const injectsBeforeClose = world.records.injects.length
  const followupsBeforeClose = world.records.followups.length
  const steersBeforeClose = world.records.steers.length
  const disposalsBeforeClose = world.records.disposals.length
  const closePromise = world.binding.close()
  const rejectClosing = await captureReject(() =>
    world.binding.deliverRootWorkCompletionNotification({
      rootSessionId: ROOT,
      text: NOTIFICATION_TEXT,
    }),
  )
  await closePromise
  const hasLiveAfterClose = world.binding.hasLive(ROOT)
  const disposalsAfterClose = world.records.disposals.slice(disposalsBeforeClose)

  return {
    g1AddedFollowups,
    g1AddedSteers,
    g1AddedInjects,
    g1WhenIdleDelta,
    g2AddedFollowups,
    g2AddedSteers,
    g2AddedInjects,
    g2WhenIdleDelta,
    g7AddedFollowups,
    g7AddedSteers,
    g7AddedInjects,
    rejectEmptyRoot,
    rejectEmptyText,
    recordsAfterRejections,
    rejectFollowupThrow,
    rejectInjectThrow,
    totalFollowups: world.records.followups.length,
    totalSteers: world.records.steers.length,
    totalInjects: world.records.injects.length,
    rejectClosing,
    hasLiveAfterClose,
    g8aNoWakeCalls:
      world.records.followups.length === followupsBeforeClose &&
      world.records.steers.length === steersBeforeClose &&
      world.records.injects.length === injectsBeforeClose,
    g8aDisposalsDuringClose: disposalsAfterClose,
  }
})()

const G8B_ROOT = 'session-wcn-g8b-root'
const G8B_STATE: {
  rejectLateResume: unknown
  hasLiveAfterClose: boolean
  resumingAfterSettle: boolean
  resumesCount: number
  lateHandleDisposals: number
  noWakeCalls: boolean
} = {
  rejectLateResume: undefined,
  hasLiveAfterClose: false,
  resumingAfterSettle: false,
  resumesCount: 0,
  lateHandleDisposals: 0,
  noWakeCalls: false,
}
const G8B = await (async () => {
  // The strong close race: the root is DURABLE (on disk) but NOT live,
  // and the binding is still OPEN. A cold resume is started and
  // suspended INSIDE the agents seam; close() then runs to completion;
  // only after that does the resume settle. The glue must see the
  // closing state on the way back, dispose the late handle, and never
  // write it into liveAgents (the handle would otherwise outlive the
  // close snapshot).
  const home = `${WORKTREE_ROOT}/.tmp-wcn-g8b-home`
  // Two-stage gate: `entered` resolves the moment the resume has
  // ENTERED the seam (in flight, unsettled); the test then holds
  // `releaseResume` until close() has completed.
  let releaseEntered: () => void = () => {}
  let releaseResume: () => void = () => {}
  const entered = new Promise<void>((resolve) => {
    releaseEntered = resolve
  })
  const world = await createLiveWorld({
    rootSessionId: G8B_ROOT,
    // NO boot(): the root stays not-live (the resume path is the one
    // under test). resumeGate suspends the resume after it is recorded.
    agents: {
      resumeGate: async () => {
        releaseEntered()
        await new Promise<void>((resolve) => {
          releaseResume = resolve
        })
      },
    },
  })
  try {
    await withDshHome(home, async () => {
      writeDurableFixture(home, G8B_ROOT)
      const ensurePromise = world.binding.ensureLiveAgent(G8B_ROOT)
      // the resume has entered the seam gate (in flight, suspended)
      await entered
      // close() runs to completion while the resume is suspended
      await world.binding.close()
      // release the resume: the glue must now see the closing state
      releaseResume()
      const rejectLateResume = await captureReject(() => ensurePromise)
      G8B_STATE.rejectLateResume = rejectLateResume
      G8B_STATE.hasLiveAfterClose = world.binding.hasLive(G8B_ROOT)
      G8B_STATE.resumingAfterSettle = world.binding.isResuming(G8B_ROOT)
      G8B_STATE.resumesCount = world.agents.resumes.length
      G8B_STATE.lateHandleDisposals = world.agents.disposals.filter(
        (sid) => sid === G8B_ROOT,
      ).length
      G8B_STATE.noWakeCalls =
        world.records.followups.length === 0 &&
        world.records.steers.length === 0 &&
        world.records.injects.length === 0
    })
  } finally {
    removeFixtureHome(home)
  }
  return G8B_STATE
})()

describe('deliverRootWorkCompletionNotification (work-completion wake-up) — the live Leader wake delivery', () => {
  it('G1: an idle Leader gets ONE followup — no steer/inject, and NO whenIdle await (acceptance boundary)', () => {
    expect(S.g1AddedFollowups).toHaveLength(1)
    expect(S.g1AddedSteers).toHaveLength(0)
    expect(S.g1AddedInjects).toHaveLength(0)
    expect(S.g1WhenIdleDelta).toBe(0)
    expect(S.g1AddedFollowups[0]!.sessionId).toBe(ROOT)
  })

  it('G2: a busy Leader gets ONE inject — no followup/steer and no whenIdle await', () => {
    expect(S.g2AddedInjects).toHaveLength(1)
    expect(S.g2AddedFollowups).toHaveLength(0)
    expect(S.g2AddedSteers).toHaveLength(0)
    expect(S.g2WhenIdleDelta).toBe(0)
    expect(S.g2AddedInjects[0]!.sessionId).toBe(ROOT)
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
    // neither rejection path reached the agent (G1 followup, G2+G7 injects)
    expect(S.recordsAfterRejections.followups).toBe(1) // only the G1 delivery
    expect(S.recordsAfterRejections.steers).toBe(0) // steer is gone (Stop-priority)
    expect(S.recordsAfterRejections.injects).toBe(2) // G2 + G7 deliveries
  })

  it('G6: a followup/inject throw REJECTS the glue promise (the router observer swallows, not the glue)', () => {
    expect(S.rejectFollowupThrow).toBeInstanceOf(Error)
    expect(String(S.rejectFollowupThrow)).toContain('agent followup unavailable')
    expect(S.rejectInjectThrow).toBeInstanceOf(Error)
    expect(String(S.rejectInjectThrow)).toContain('agent inject unavailable')
  })

  it('G7: a cancelled-converging (running) Leader gets ONE inject, never steer — Stop wins (rc.2: inject = next-step + wakeup:false)', () => {
    expect(S.g7AddedInjects).toHaveLength(1)
    expect(S.g7AddedFollowups).toHaveLength(0)
    expect(S.g7AddedSteers).toHaveLength(0)
    expect(S.g7AddedInjects[0]!.sessionId).toBe(ROOT)
  })

  it('G8a: a completion delivery that starts after close() REJECTS — no wake call, no live handle after close', () => {
    expect(S.rejectClosing).toBeInstanceOf(Error)
    expect(String(S.rejectClosing)).toContain('closing')
    expect(S.g8aNoWakeCalls).toBe(true)
    expect(S.hasLiveAfterClose).toBe(false)
    // the leader handle itself was disposed by close
    expect(S.g8aDisposalsDuringClose).toContain(ROOT)
  })
})

describe('ensureLiveAgent × close() — the teardown late-resume race (G8b)', () => {
  it('G8b: a resume suspended while close() completes is disposed on arrival — never written into liveAgents', () => {
    expect(G8B.rejectLateResume).toBeInstanceOf(Error)
    expect(String(G8B.rejectLateResume)).toContain('closing')
    expect(G8B.hasLiveAfterClose).toBe(false)
    expect(G8B.resumingAfterSettle).toBe(false) // the resume marker was cleaned up
    expect(G8B.resumesCount).toBe(1)
    expect(G8B.lateHandleDisposals).toBe(1)
    expect(G8B.noWakeCalls).toBe(true)
  })
})
