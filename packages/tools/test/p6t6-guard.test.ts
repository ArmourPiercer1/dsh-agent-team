/**
 * P6-T6 MUST-TEST — the last-mile guard wiring (brief §6a, SD-GUARD /
 * SD-GUARD-NS): the tool layer consults the T4 control service's
 * `guardOperation` for EVERY guarded work operation, IMMEDIATELY before
 * execution (no tool-layer caching — the verdict is always a fresh
 * durable read under the service's per-team lock); the verdict is FINAL:
 * a block returns the closed reason with zero side effects and the
 * runtime is never called; an allow is CONSUMED exactly once (check-and-
 * reserve), so a retry of the same logical operation is blocked
 * allow-consumed. Unguarded operations (the reads, the control-plane
 * entry points) never consult.
 *
 * Method: a SECOND `createTeamTools` over the same P6-T2 durable world
 * with recording spies on `guardOperation` and `performAction`. The
 * shared `order` array proves, per call, that the guard consult
 * immediately precedes the execution — and that blocked calls never
 * reach the runtime.
 *
 * The control-plane setup (requesting/resolving gates) calls the control
 * service directly: the test constructs the durable gate state; the TOOL
 * under test only ever observes it through its guarded execution.
 *
 * Test pattern of this repo (the plain-node shim's `it` is synchronous):
 * every async scenario runs at MODULE level (top-level await) and
 * captures its results; the `it` bodies are pure synchronous assertions.
 */

import { describe, expect, it } from 'vitest'
import {
  CONTROL_DECISION_VALUES,
  CONTROL_GUARD_BLOCK_REASONS,
  CONTROL_REQUEST_KINDS,
} from '../../runtime/control/index.js'
import type {
  ControlConsumptionRecord,
  ControlService,
} from '../../runtime/control/index.js'
import type { ActionCaller, TeamRuntime } from '../../runtime/admission/index.js'
import { flipLifecycle } from '../../runtime/test/p6t4-helpers.js'
import { destroyP6T1World } from '../../runtime/test/p6t1-helpers.js'
import {
  P6T2_ROOT,
  P6T2_SEEDS,
  leaderCaller,
} from '../../runtime/test/p6t2-helpers.js'
import {
  createTeamTools,
} from '../src/index.js'
import type { TeamToolDefinition, TeamToolsResult } from '../src/index.js'
import {
  createP6T6World,
  execFor,
} from './p6t6-helpers.js'
import type { P6T6World } from './p6t6-helpers.js'

const WORKER_ID = String(P6T2_SEEDS.worker.instanceId)

interface GuardScenario {
  readonly executedA: TeamToolsResult
  readonly blockedB: TeamToolsResult
  readonly blockedC: TeamToolsResult
  readonly executedD: TeamToolsResult
  readonly blockedRetry: TeamToolsResult
  readonly listedG: TeamToolsResult
  readonly requestedG1: TeamToolsResult
  readonly requestedG2: TeamToolsResult
  readonly blockedE: TeamToolsResult
  readonly order: readonly string[]
  readonly guardCountAfterA: number
  readonly guardCountAfterB: number
  readonly guardCountAfterC: number
  readonly guardCountAfterD: number
  readonly guardCountAfterRetry: number
  readonly guardCountAfterG: number
  readonly guardCountAfterE: number
  readonly performCountAfterA: number
  readonly performCountAfterB: number
  readonly performCountAfterC: number
  readonly performCountAfterD: number
  readonly performCountAfterRetry: number
  readonly performCountAfterG: number
  readonly performCountAfterE: number
  readonly consumptionsAfterA: number
  readonly finalRequests: number
  readonly finalDecisions: number
  readonly finalConsumptions: number
  readonly consumption: ControlConsumptionRecord | null
  readonly requestIdB: string
  readonly requestIdD: string
  readonly requestIdG1: string
  readonly requestIdG2: string
}

function followUpArgs(requestToken: string): Record<string, unknown> {
  return {
    rootSessionId: P6T2_ROOT,
    requestToken,
    targetInstanceId: WORKER_ID,
    taskSummary: 'p6t6-guard scenario follow-up',
  }
}

const G = await (async (): Promise<GuardScenario> => {
  const env: P6T6World = await createP6T6World('p6t6-guard', ['leader', 'worker'])
  try {
    // --- the recording spies: guard consults and runtime executions ----
    const order: string[] = []
    const controlSpy: ControlService = {
      ...env.control,
      guardOperation: (scope) => {
        order.push(`guard:${scope.actionName}`)
        return env.control.guardOperation(scope)
      },
    }
    const runtimeSpy: TeamRuntime = {
      ...env.runtime,
      performAction: (request) => {
        order.push(`perform:${request.action}`)
        return env.runtime.performAction(request)
      },
    }
    const { tools: spied } = createTeamTools({
      teamRuntime: runtimeSpy,
      controlService: controlSpy,
      messaging: env.messaging,
      activity: env.activity,
      resolveCaller: (sessionId: string): Promise<ActionCaller> => {
        const caller = env.callerMap.bySession.get(sessionId)
        if (caller === undefined) {
          return Promise.reject(new Error(`p6t6-guard: no caller for '${sessionId}'`))
        }
        return Promise.resolve(caller)
      },
    })
    function spiedTool(name: string): TeamToolDefinition {
      const found = spied.find((tool) => tool.name === name)
      if (found === undefined) {
        throw new Error(`p6t6-guard: tool '${name}' missing from the spied set`)
      }
      return found
    }
    const runSpied = (
      name: string,
      args: Record<string, unknown>,
      sessionId: string,
    ): Promise<TeamToolsResult> => spiedTool(name).execute(args, execFor(sessionId))
    const guardCount = (): number => order.filter((entry) => entry.startsWith('guard:')).length
    // Only the guarded work action this scenario executes is `follow-up`.
    // The phase-(g) `team_list_members` read also reaches `performAction`
    // but is unguarded (SD-GUARD: reads never consult), so it must not
    // count as a "the runtime was called by a guarded operation" event.
    const performCount = (): number => order.filter((entry) => entry === 'perform:follow-up').length

    // (a) no-request pass-through: no durable gate exists for this exact
    // scope, so the guard proceeds (SD-GUARD) and the operation executes
    // — the runtime re-validates everything else (envelope, authority).
    const executedA = await runSpied('team_follow_up', followUpArgs('tok-g-a1'), P6T2_ROOT)
    const guardCountAfterA = guardCount()
    const performCountAfterA = performCount()
    const stateAfterA = await env.control.listControlState(P6T2_ROOT)
    const consumptionsAfterA = stateAfterA.consumptions.length

    // (b) request-pending: a durable gate exists for the exact scope
    // (correlation = the tool's requestToken) but carries no decision yet
    // -> blocked, the runtime is never called.
    const requestB = await env.control.requestControl({
      rootSessionId: P6T2_ROOT,
      caller: leaderCaller(),
      kind: CONTROL_REQUEST_KINDS.LEADER_APPROVAL,
      targetInstanceId: WORKER_ID,
      actionName: 'follow-up',
      toolName: 'team_follow_up',
      correlation: 'tok-g-b1',
      summary: 'gate: pending approval',
    })
    const blockedB = await runSpied('team_follow_up', followUpArgs('tok-g-b1'), P6T2_ROOT)
    const guardCountAfterB = guardCount()
    const performCountAfterB = performCount()

    // (c) decision-deny: the leader denies the pending gate -> the same
    // logical operation (same token/correlation) is still blocked.
    await env.control.resolveControl({
      rootSessionId: P6T2_ROOT,
      caller: leaderCaller(),
      requestId: requestB.requestId,
      decision: CONTROL_DECISION_VALUES.DENY,
      note: 'denied for the scenario',
    })
    const blockedC = await runSpied('team_follow_up', followUpArgs('tok-g-b1'), P6T2_ROOT)
    const guardCountAfterC = guardCount()
    const performCountAfterC = performCount()

    // (d) allow: the gate is allowed, the FIRST execution runs (the guard
    // consumes the allow), and the RETRY of the same logical operation is
    // blocked allow-consumed — the allow authorizes exactly once.
    const requestD = await env.control.requestControl({
      rootSessionId: P6T2_ROOT,
      caller: leaderCaller(),
      kind: CONTROL_REQUEST_KINDS.LEADER_APPROVAL,
      targetInstanceId: WORKER_ID,
      actionName: 'follow-up',
      toolName: 'team_follow_up',
      correlation: 'tok-g-d1',
      summary: 'gate: will be allowed',
    })
    await env.control.resolveControl({
      rootSessionId: P6T2_ROOT,
      caller: leaderCaller(),
      requestId: requestD.requestId,
      decision: CONTROL_DECISION_VALUES.ALLOW,
      note: 'allowed for the scenario',
    })
    const executedD = await runSpied('team_follow_up', followUpArgs('tok-g-d1'), P6T2_ROOT)
    const guardCountAfterD = guardCount()
    const performCountAfterD = performCount()
    const blockedRetry = await runSpied('team_follow_up', followUpArgs('tok-g-d1'), P6T2_ROOT)
    const guardCountAfterRetry = guardCount()
    const performCountAfterRetry = performCount()

    // (g) unguarded operations never consult the guard: the read
    // (list-members) and the control-plane entry point (request-control,
    // idempotent over the scope identity — the second call with the same
    // token returns the SAME durable request while it is still pending).
    const listedG = await runSpied(
      'team_list_members',
      { rootSessionId: P6T2_ROOT, requestToken: 'tok-g-g0' },
      P6T2_ROOT,
    )
    const requestControlArgs = {
      rootSessionId: P6T2_ROOT,
      requestToken: 'tok-g-g1',
      kind: 'leader-approval',
      targetInstanceId: WORKER_ID,
      actionName: 'follow-up',
      toolName: 'team_follow_up',
      summary: 'idempotency probe',
    }
    const requestedG1 = await runSpied('team_request_control', requestControlArgs, P6T2_ROOT)
    const requestedG2 = await runSpied('team_request_control', requestControlArgs, P6T2_ROOT)
    const guardCountAfterG = guardCount()
    const performCountAfterG = performCount()

    // (e) target-stale: the worker is durably DISPOSED — the guard's
    // liveness verdict is final for a well-formed target (SD-GUARD):
    // blocked, zero side effects, the runtime is never called.
    await flipLifecycle(env.world, WORKER_ID, 'DISPOSED')
    const blockedE = await runSpied('team_follow_up', followUpArgs('tok-g-e1'), P6T2_ROOT)
    const guardCountAfterE = guardCount()
    const performCountAfterE = performCount()

    // (f) the durable consumption of the (d) allow: exactly one row,
    // carrying the EXACT scope (toolName + correlation) and the decision
    // sequence that authorized it.
    const stateFinal = await env.control.listControlState(P6T2_ROOT)
    const consumptionRow =
      stateFinal.consumptions.length === 1 ? stateFinal.consumptions[0] : undefined
    const consumption: ControlConsumptionRecord | null =
      consumptionRow === undefined ? null : consumptionRow

    return {
      executedA,
      blockedB,
      blockedC,
      executedD,
      blockedRetry,
      listedG,
      requestedG1,
      requestedG2,
      blockedE,
      order,
      guardCountAfterA,
      guardCountAfterB,
      guardCountAfterC,
      guardCountAfterD,
      guardCountAfterRetry,
      guardCountAfterG,
      guardCountAfterE,
      performCountAfterA,
      performCountAfterB,
      performCountAfterC,
      performCountAfterD,
      performCountAfterRetry,
      performCountAfterG,
      performCountAfterE,
      consumptionsAfterA,
      finalRequests: stateFinal.requests.length,
      finalDecisions: stateFinal.decisions.length,
      finalConsumptions: stateFinal.consumptions.length,
      consumption,
      requestIdB: requestB.requestId,
      requestIdD: requestD.requestId,
      requestIdG1: requestedG1.status === 'control-requested' ? requestedG1.request.requestId : '',
      requestIdG2: requestedG2.status === 'control-requested' ? requestedG2.request.requestId : '',
    }
  } finally {
    await destroyP6T1World(env.world)
  }
})()

// The idempotent (g) retry must not have added a fourth request row: the
// final state holds exactly (b), (d) and (g).
const finalRequestCount = G.finalRequests

describe('P6-T6 tool set — the last-mile guard (SD-GUARD / SD-GUARD-NS)', () => {
  it('no-request: the guard is consulted, proceeds, the operation executes (zero consumptions)', () => {
    expect(G.executedA.status).toBe('executed')
    // The consult happened exactly once for this call, immediately before
    // the single execution; nothing was consumed (there was no gate).
    expect(G.guardCountAfterA).toBe(1)
    expect(G.performCountAfterA).toBe(1)
    expect(G.consumptionsAfterA).toBe(0)
  })

  it('request-pending: blocked, the runtime is never called', () => {
    expect(G.blockedB.status).toBe('blocked')
    expect(G.blockedB.status === 'blocked' ? G.blockedB.reason : '<not-blocked>').toBe(
      CONTROL_GUARD_BLOCK_REASONS.REQUEST_PENDING,
    )
    expect(G.guardCountAfterB).toBe(2)
    expect(G.performCountAfterB).toBe(G.performCountAfterA)
  })

  it('decision-deny: blocked, the runtime is never called', () => {
    expect(G.blockedC.status).toBe('blocked')
    expect(G.blockedC.status === 'blocked' ? G.blockedC.reason : '<not-blocked>').toBe(
      CONTROL_GUARD_BLOCK_REASONS.DECISION_DENY,
    )
    expect(G.performCountAfterC).toBe(G.performCountAfterA)
  })

  it('allow: consumed exactly once — the first execution runs, the retry is allow-consumed', () => {
    expect(G.executedD.status).toBe('executed')
    expect(G.performCountAfterD).toBe(G.performCountAfterA + 1)
    expect(G.blockedRetry.status).toBe('blocked')
    expect(G.blockedRetry.status === 'blocked' ? G.blockedRetry.reason : '<not-blocked>').toBe(
      CONTROL_GUARD_BLOCK_REASONS.ALLOW_CONSUMED,
    )
    // The retry consulted the guard (fresh durable read — no tool-layer
    // cache) but never reached the runtime, and it names the consumed
    // allow's request.
    expect(G.guardCountAfterRetry).toBe(G.guardCountAfterD + 1)
    expect(G.performCountAfterRetry).toBe(G.performCountAfterD)
    expect(G.blockedRetry.status === 'blocked' ? G.blockedRetry.requestId : undefined).toBe(
      G.requestIdD,
    )
  })

  it('target-stale: a durably DISPOSED target blocks, the runtime is never called', () => {
    expect(G.blockedE.status).toBe('blocked')
    expect(G.blockedE.status === 'blocked' ? G.blockedE.reason : '<not-blocked>').toBe(
      CONTROL_GUARD_BLOCK_REASONS.TARGET_STALE,
    )
    expect(G.guardCountAfterE).toBe(G.guardCountAfterRetry + 1)
    expect(G.performCountAfterE).toBe(G.performCountAfterD)
  })

  it('the durable consumption row carries the EXACT scope (toolName + correlation) and decision sequence', () => {
    expect(G.finalConsumptions).toBe(1)
    const row = G.consumption
    expect(row === null ? '<missing>' : 'present').toBe('present')
    if (row !== null) {
      expect(row.requestId).toBe(G.requestIdD)
      expect(row.scope.rootSessionId).toBe(P6T2_ROOT)
      expect(row.scope.targetInstanceId).toBe(WORKER_ID)
      expect(row.scope.actionName).toBe('follow-up')
      expect(row.scope.toolName).toBe('team_follow_up')
      expect(row.scope.correlation).toBe('tok-g-d1')
      expect(row.decisionSequence).toBeGreaterThan(0)
    }
  })

  it('the durable control state: (b), (d) and (g) requests; (c) deny + (d) allow decisions', () => {
    expect(G.finalRequests).toBe(3)
    expect(G.finalDecisions).toBe(2)
    // The (b) request carried its gate through both the pending and the
    // denied probes.
    expect(G.requestIdB.length).toBeGreaterThan(0)
  })

  it('unguarded operations never consult the guard (list-members, request-control)', () => {
    expect(G.listedG.status).toBe('executed')
    // Neither the read nor the two control-plane calls touched the guard.
    expect(G.guardCountAfterG).toBe(G.guardCountAfterRetry)
    expect(G.performCountAfterG).toBe(G.performCountAfterD)
    // request-control is idempotent over the scope identity: the retry
    // with the same token returns the SAME durable request.
    expect(G.requestedG1.status).toBe('control-requested')
    expect(G.requestedG2.status).toBe('control-requested')
    expect(G.requestIdG1).toBe(G.requestIdG2)
    expect(G.requestIdG1.length).toBeGreaterThan(0)
    // ...and it did not add a row (the final count is still 3).
    expect(finalRequestCount).toBe(3)
  })

  it('ordering: EVERY guarded perform is immediately preceded by its guard consult (SD-GUARD)', () => {
    // `follow-up` is the only guarded work action this scenario executes;
    // the `team_list_members` read (phase g) also flows through
    // `performAction` but is unguarded — it must appear WITHOUT a guard
    // consult, and no guard consult may ever be made for it.
    const unguardedActions = new Set(['list-members'])
    let adjacencyHolds = true
    let unguardedPerforms = 0
    let unguardedConsults = 0
    for (let i = 0; i < G.order.length; i += 1) {
      const entry = G.order[i]
      if (entry === undefined) continue
      if (entry.startsWith('guard:') && unguardedActions.has(entry.slice('guard:'.length))) {
        unguardedConsults += 1
      }
      if (entry.startsWith('perform:')) {
        const action = entry.slice('perform:'.length)
        if (unguardedActions.has(action)) {
          unguardedPerforms += 1
          continue
        }
        const before = i > 0 ? G.order[i - 1] : undefined
        if (before !== `guard:${action}`) {
          adjacencyHolds = false
        }
      }
    }
    expect(adjacencyHolds).toBe(true)
    // Exactly the one (g) read performed unguarded; zero consults for it.
    expect(unguardedPerforms).toBe(1)
    expect(unguardedConsults).toBe(0)
    // The full guarded call log: six consults, exactly two executions
    // ((a) and (d)); every blocked call (b, c, retry, e) consulted but
    // never performed.
    const guards = G.order.filter((entry) => entry === 'guard:follow-up').length
    const performs = G.order.filter((entry) => entry === 'perform:follow-up').length
    expect(guards).toBe(6)
    expect(performs).toBe(2)
  })
})
