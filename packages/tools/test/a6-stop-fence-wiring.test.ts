/**
 * a6-stop-fence-wiring.test.ts — A6-STOP-FENCE, the TEAM-TOOLS wiring level.
 *
 * WHY THIS FILE EXISTS (review finding on PR #710, 2026-11-11). The fence
 * suite (`packages/runtime/test/a6-stop-fence.test.ts`) calls
 * `service.guardOperation(scope, { signal })` DIRECTLY, so it proves the GUARD
 * but not that the lanes HAND the guard their invocation signal. This file
 * drives the real `team_*` guarded lane end to end — `tools.ts#executeGuarded`
 * -> `guard.ts#consultGuard` -> `controlService.guardOperation` — through the
 * registered tool definition, with a real (faked) runtime behind it.
 *
 * ARMS:
 *   W1 (wired): a durable allow exists and the invocation signal is ALREADY
 *       aborted when the tool runs. `executeGuarded` must forward the signal,
 *       the guard's final probe must trip, and the tool must come back
 *       `blocked` / `invocation-cancelled` with ZERO consumption, exactly one
 *       terminal `control-request-abandoned`, the allow untouched, and the
 *       runtime NEVER asked to execute. If the wiring regressed (no signal
 *       forwarded), the allow would be consumed and the body would run — this
 *       arm is the discriminator.
 *   W2 (S8 extension — the no-signal default path): the same lane with NO
 *       signal on the execution context still consults `consultGuard` with NO
 *       options, consumes exactly once and executes exactly once. Callers that
 *       carry no signal keep the pre-fence behaviour byte-for-byte.
 *
 * "NO EXECUTION" is observed on `runtime.performAction` — a real spy on the
 * plane's execution entry — not inferred from a verdict.
 *
 * Runner constraints (this repo's plain-node shim): the async scenarios run at
 * module level; `it` bodies are synchronous and use toBe/toEqual only.
 *
 * @module @dsh-agent-team/tools/test/a6-stop-fence-wiring
 */
import { describe, expect, it } from 'vitest'
import {
  CONTROL_DECISION_VALUES,
  CONTROL_GUARD_BLOCK_REASONS,
  CONTROL_REQUEST_KINDS,
} from '../../runtime/control/index.js'
import type { ControlService, ControlWaitSignal } from '../../runtime/control/index.js'
import type { TeamRuntime } from '../../runtime/admission/index.js'
import { destroyP6T1World } from '../../runtime/test/p6t1-helpers.js'
import {
  P6T2_ROOT,
  P6T2_SEEDS,
  leaderCaller,
} from '../../runtime/test/p6t2-helpers.js'
import { createTeamTools } from '../src/index.js'
import type {
  ResolvedTeamToolCaller,
  TeamToolDefinition,
  TeamToolsResult,
} from '../src/index.js'
import { createP6T6World, execFor } from './p6t6-helpers.js'
import type { P6T6World } from './p6t6-helpers.js'

const WORKER_ID = String(P6T2_SEEDS.worker.instanceId)
const STOP_ABANDON_REASON = 'invocation-cancelled-before-consumption'

interface WiringOutcome {
  readonly tool: TeamToolDefinition
  /** The guard's optional second argument as the tool layer passed it. */
  readonly seenGuardSignals: (ControlWaitSignal | undefined)[]
  readonly performCalls: number
  readonly consumptions: number
  readonly abandonments: { readonly reason?: string; readonly sequence: number }[]
  readonly decisions: { readonly value: string; readonly sequence: number }[]
}

async function build(
  basename: string,
): Promise<{
  env: P6T6World
  tool: TeamToolDefinition
  seenGuardSignals: (ControlWaitSignal | undefined)[]
  performCalls: () => number
}> {
  const env = await createP6T6World(basename, ['leader', 'worker', 'scout'])
  const seenGuardSignals: (ControlWaitSignal | undefined)[] = []
  let performCalls = 0
  // The wiring assertions need to SEE what the tool layer handed the guard
  // (the optional second argument). The spy forwards verbatim, so the durable
  // behaviour under test is still the real service's.
  const controlSpy: ControlService = {
    ...env.control,
    guardOperation: (scope, options) => {
      seenGuardSignals.push(options?.signal)
      return env.control.guardOperation(scope, options)
    },
  }
  const runtimeSpy: TeamRuntime = {
    ...env.runtime,
    performAction: (request) => {
      if (request.action === 'follow-up') performCalls += 1
      return env.runtime.performAction(request)
    },
  }
  const { tools } = createTeamTools({
    teamRuntime: runtimeSpy,
    controlService: controlSpy,
    messaging: env.messaging,
    activity: env.activity,
    resolveCaller: (sessionId: string): Promise<ResolvedTeamToolCaller> => {
      const caller = env.callerMap.bySession.get(sessionId)
      if (caller === undefined) {
        return Promise.reject(new Error(`a6-wiring: no caller for '${sessionId}'`))
      }
      return Promise.resolve({ caller, rootSessionId: String(P6T2_ROOT) })
    },
  })
  const tool = tools.find((candidate) => candidate.name === 'team_follow_up')
  if (tool === undefined) throw new Error('a6-wiring: team_follow_up is not registered')
  return { env, tool, seenGuardSignals, performCalls: () => performCalls }
}

function followUpArgs(requestToken: string): Record<string, unknown> {
  return {
    rootSessionId: P6T2_ROOT,
    requestToken,
    targetInstanceId: WORKER_ID,
    prompt: 'a6-stop-fence wiring follow-up prompt',
    taskSummary: 'a6-stop-fence wiring scenario follow-up',
  }
}

/** Grant an allow for the exact tool scope the tools lane will guard. */
async function grant(
  env: P6T6World,
  requestToken: string,
): Promise<{ requestId: string; decisionSequence: number }> {
  const request = await env.control.requestControl({
    rootSessionId: P6T2_ROOT,
    caller: leaderCaller(),
    kind: CONTROL_REQUEST_KINDS.LEADER_APPROVAL,
    targetInstanceId: WORKER_ID,
    actionName: 'follow-up',
    toolName: 'team_follow_up',
    correlation: requestToken,
    summary: 'a6-stop-fence wiring gate',
  })
  const decision = await env.control.resolveControl({
    rootSessionId: P6T2_ROOT,
    caller: leaderCaller(),
    requestId: request.requestId,
    decision: CONTROL_DECISION_VALUES.ALLOW,
    note: 'a6-stop-fence wiring allow',
  })
  return { requestId: request.requestId, decisionSequence: decision.decisionSequence }
}

async function outcomeOf(
  env: P6T6World,
  tool: TeamToolDefinition,
  seenGuardSignals: (ControlWaitSignal | undefined)[],
  performCalls: () => number,
  requestId: string,
): Promise<WiringOutcome> {
  const state = await env.control.listControlState(P6T2_ROOT)
  return {
    tool,
    seenGuardSignals,
    performCalls: performCalls(),
    consumptions: state.consumptions.filter((c) => c.requestId === requestId).length,
    abandonments: state.abandonments
      .filter((a) => a.requestId === requestId)
      .map((a) => ({
        ...(typeof a.reason === 'string' ? { reason: a.reason } : {}),
        sequence: a.abandonmentSequence,
      })),
    decisions: state.decisions
      .filter((d) => d.requestId === requestId)
      .map((d) => ({ value: String(d.decision), sequence: d.decisionSequence })),
  }
}

// ---------------------------------------------------------------------------
// W1 — the wired lane: a pre-aborted invocation signal fences consumption
// ---------------------------------------------------------------------------

const w1 = await (async () => {
  const { env, tool, seenGuardSignals, performCalls } = await build('a6-stop-wiring-w1')
  try {
    const requestToken = 'tok-a6w-1'
    const granted = await grant(env, requestToken)
    const controller = new AbortController()
    controller.abort()
    // Discriminating arm: if the tool layer did NOT forward the signal, the
    // allow is consumed and the plane proceeds toward execution — where the
    // pre-existing execution-edge cancel check rethrows. Capture either
    // outcome so the failure is an assertion, not a suite-load crash.
    const settled = await tool
      .execute(followUpArgs(requestToken), {
        ...execFor(P6T2_ROOT, 'call-a6w-1'),
        signal: controller.signal,
      })
      .then(
        (value) => ({ ok: true as const, value }),
        (error: unknown) => ({ ok: false as const, value: String(error) }),
      )
    return {
      settled,
      ...(await outcomeOf(env, tool, seenGuardSignals, performCalls, granted.requestId)),
      decisionSequence: granted.decisionSequence,
    }
  } finally {
    await destroyP6T1World(env.world)
  }
})()

// ---------------------------------------------------------------------------
// W2 — the no-signal default path (S8 extension at the wiring level)
// ---------------------------------------------------------------------------

const w2 = await (async () => {
  const { env, tool, seenGuardSignals, performCalls } = await build('a6-stop-wiring-w2')
  try {
    const requestToken = 'tok-a6w-2'
    const granted = await grant(env, requestToken)
    const result: TeamToolsResult = await tool.execute(
      followUpArgs(requestToken),
      execFor(P6T2_ROOT, 'call-a6w-2'),
    )
    return {
      result,
      ...(await outcomeOf(env, tool, seenGuardSignals, performCalls, granted.requestId)),
    }
  } finally {
    await destroyP6T1World(env.world)
  }
})()

// ---------------------------------------------------------------------------
// Assertions
// ---------------------------------------------------------------------------

describe('A6-STOP-FENCE — the team-tools lane hands its invocation signal to the guard', () => {
  it('W1 pre-aborted signal: blocked `invocation-cancelled`, zero consumption, one abandonment, body never reached', () => {
    // The tool layer passed the OPTIONAL second argument (the wiring itself).
    expect(w1.seenGuardSignals.length).toBe(1)
    expect(w1.seenGuardSignals[0]?.aborted).toBe(true)
    // The tool comes back blocked by the fence, not executed (nor thrown
    // into the execution edge).
    expect(w1.settled.ok).toBe(true)
    if (!w1.settled.ok) {
      throw new Error(`W1: the tool threw instead of returning a blocked result (${w1.settled.value})`)
    }
    const result = w1.settled.value
    expect(result.status).toBe('blocked')
    if (result.status !== 'blocked') throw new Error('W1: the tool was not blocked')
    expect(result.reason).toBe(CONTROL_GUARD_BLOCK_REASONS.INVOCATION_CANCELLED)
    // The runtime — the plane's execution entry — was never asked to execute.
    expect(w1.performCalls).toBe(0)
    // Durable: no consumption, exactly one terminal abandonment, allow intact.
    expect(w1.consumptions).toBe(0)
    expect(w1.abandonments.length).toBe(1)
    expect(w1.abandonments[0]?.reason).toBe(STOP_ABANDON_REASON)
    // The trip burns the prepared sequence (gap at decisionSequence+1).
    expect(w1.abandonments[0]?.sequence).toBe(w1.decisionSequence + 2)
    expect(w1.decisions.length).toBe(1)
    expect(w1.decisions[0]?.value).toBe(CONTROL_DECISION_VALUES.ALLOW)
    expect(w1.decisions[0]?.sequence).toBe(w1.decisionSequence)
  })

  it('W2 no signal on the context: the guard is consulted with NO options, consumes once and executes once', () => {
    expect(w2.seenGuardSignals.length).toBe(1)
    expect(w2.seenGuardSignals[0]).toBe(undefined)
    expect(w2.result.status).toBe('executed')
    expect(w2.performCalls).toBe(1)
    expect(w2.consumptions).toBe(1)
    expect(w2.abandonments.length).toBe(0)
    expect(w2.decisions.length).toBe(1)
    expect(w2.decisions[0]?.value).toBe(CONTROL_DECISION_VALUES.ALLOW)
  })
})
