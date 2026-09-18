/**
 * C1 (leader-approval reachability) — the restart-recovery test
 * (plan §9.5): a pending `leader-approval` request created before a
 * durable TeamDomain close/reopen (the host-restart window) must STILL
 * be returned by `team_list_pending_control` after the restart — the
 * pending-list tool is THE recovery mechanism. No notification replay
 * is required (and none is attempted: the restart creates no notifier;
 * the pre-restart notification attempt is at-most-once liveness).
 *
 * The restart is the REAL durable primitive (`restartP6T1World`:
 * `domain.close()` + `openTeamDomain` over the SAME scratch dir) — the
 * same window the p6t3/p6t4 restart suites exercise.
 */

import { describe, expect, it } from 'vitest'

import {
  CONTROL_REQUEST_KINDS,
  createControlService,
} from '../control/index.js'
import { createActivityLedger } from '../activity/index.js'
import { createMessagingCoordinator } from '../messaging/index.js'
import { createP6T2Runtime } from './p6t2-helpers.js'
import {
  P6T4_NOW,
  P6T4_ROOT,
  P6T4_SEEDS,
  createP6T4World,
} from './p6t4-helpers.js'
import { destroyP6T1World, restartP6T1World } from './p6t1-helpers.js'
import { createTeamTools } from '../../tools/src/index.js'
import type { ActionCaller } from '../admission/index.js'
import type { TeamToolExecContext, TeamToolsResult } from '../../tools/src/index.js'

const WORKER_ID = String(P6T4_SEEDS.worker.instanceId)
const WORKER_SESSION = String(P6T4_SEEDS.worker.childSessionId)
const LEADER_ID = 'inst-leader'

const S = await (async () => {
  const world = await createP6T4World('c1-restart', ['leader', 'worker'])
  const runtime = createP6T2Runtime(world)
  const control = createControlService({
    teamDomain: world.domain,
    blueprintCatalog: world.catalog,
    externalPolicyFacts: world.ports.externalPolicyFacts,
    now: () => P6T4_NOW,
  })

  // the durable pending request (pre-restart) — seeded through the same
  // authority the pre-execute adapter uses.
  const request = await control.requestControl({
    rootSessionId: P6T4_ROOT,
    caller: { kind: 'instance', instanceId: WORKER_ID },
    kind: CONTROL_REQUEST_KINDS.LEADER_APPROVAL,
    targetInstanceId: WORKER_ID,
    actionName: 'write-file',
    toolName: 'fs.write',
    correlation: 'corr-c1-restart-1',
    summary: 'fs.write [path=/workspace/out.txt] <preview>',
  })

  // RESTART — close the durable domain, reopen the SAME scratch dir.
  const world2 = await restartP6T1World(world)
  const runtime2 = createP6T2Runtime(world2)
  const control2 = createControlService({
    teamDomain: world2.domain,
    blueprintCatalog: world2.catalog,
    externalPolicyFacts: world2.ports.externalPolicyFacts,
    now: () => P6T4_NOW,
  })
  const sessionInput = {
    calls: [] as unknown[],
    failNext: 0,
    async submitAttributedInput(input: unknown): Promise<void> {
      this.calls.push(input)
    },
  }
  const messaging2 = createMessagingCoordinator({
    teamRuntime: runtime2,
    teamDomain: world2.domain,
    sessionInput,
    now: () => P6T4_NOW,
  })
  const activity2 = createActivityLedger({
    teamDomain: world2.domain,
    runtime: runtime2,
    now: () => P6T4_NOW,
  })
  const bySession = new Map<string, ActionCaller>()
  bySession.set(P6T4_ROOT, { kind: 'instance', instanceId: LEADER_ID })
  bySession.set(WORKER_SESSION, { kind: 'instance', instanceId: WORKER_ID })
  const { tools } = createTeamTools({
    teamRuntime: runtime2,
    controlService: control2,
    messaging: messaging2,
    activity: activity2,
    async resolveCaller(sessionId: string): Promise<ActionCaller> {
      const caller = bySession.get(sessionId)
      if (caller === undefined) {
        throw new Error(`c1 restart: no caller for session ${sessionId}`)
      }
      return caller
    },
  })
  async function runTool(
    name: string,
    args: Record<string, unknown>,
    sessionId: string,
  ): Promise<TeamToolsResult> {
    const tool = tools.find((t) => t.name === name)
    if (tool === undefined) throw new Error(`c1 restart: no tool ${name}`)
    const ctx = { callId: 'call-1', name: '', arguments: {}, agent: { id: sessionId } } as TeamToolExecContext
    return await tool.execute(args, ctx)
  }

  // the Leader lists the pending requests AFTER the restart.
  const pendingAfterRestart = await runTool(
    'team_list_pending_control',
    { rootSessionId: P6T4_ROOT, requestToken: 'c1-r-lpc' },
    P6T4_ROOT,
  )
  // and can still resolve through the same model-facing tool.
  const resolvedAfterRestart = await runTool(
    'team_resolve_control',
    {
      rootSessionId: P6T4_ROOT,
      requestToken: 'c1-r-res',
      requestId: request.requestId,
      decision: 'allow',
    },
    P6T4_ROOT,
  )
  const stateAfterResolve = await control2.listControlState(P6T4_ROOT)

  await destroyP6T1World(world2)

  return {
    request,
    pendingAfterRestart,
    resolvedAfterRestart,
    stateAfterResolve,
  }
})()

describe('C1 restart recovery — the pending list survives the durable restart', () => {
  it('a pre-restart pending leader-approval request is returned by team_list_pending_control after the restart', () => {
    expect(S.request.status).toBe('pending')
    expect(S.pendingAfterRestart.status).toBe('pending-control-listed')
    if (S.pendingAfterRestart.status !== 'pending-control-listed') return
    const ids = S.pendingAfterRestart.pending.map((p) => p.requestId)
    expect(ids).toContain(S.request.requestId)
    // the same record identity (durable, not reconstructed)
    const record = S.pendingAfterRestart.pending.find((p) => p.requestId === S.request.requestId)
    expect(record!.requestSequence).toBe(S.request.requestSequence)
  })

  it('the restarted Leader can still resolve the recovered request through team_resolve_control', () => {
    expect(S.resolvedAfterRestart.status).toBe('control-resolved')
    if (S.resolvedAfterRestart.status !== 'control-resolved') return
    expect(S.resolvedAfterRestart.decision.requestId).toBe(S.request.requestId)
    expect(S.resolvedAfterRestart.decision.decision).toBe('allow')
    // the decision is durable in the REOPENED domain
    const decisions = S.stateAfterResolve.decisions.filter(
      (d) => d.requestId === S.request.requestId,
    )
    expect(decisions).toHaveLength(1)
  })
})
