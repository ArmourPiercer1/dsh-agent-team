/**
 * C1 (leader-approval reachability) — the production-wiring integration
 * (plan §9.4): the real composition path, end to end, over the REAL live
 * glue bundle (the t12a-live-bridge doubles driving
 * agent-bindings.mjs) with the control service wired EXACTLY the way
 * `root.ts` wires it (the `live.deliverRootControlNotification` port
 * bound through `createLeaderControlNotifier` — no MessagingCoordinator,
 * one ControlService instance consumed by the tool layer):
 *
 *   member permission ask (the adapter's `requestControl` authority)
 *       ↓ durable leader-approval request
 *   Leader liveness notification port invoked
 *       ↓ the REAL glue delivers a model-visible root input turn
 *   the Leader discovers the EXACT requestId with
 *   `team_list_pending_control` (the new tool over the same service)
 *       ↓
 *   the Leader resolves through `team_resolve_control` (the SAME
 *   model-facing tool — NO test-only decision injection)
 *       ↓ durable decision
 *   the member pre-execute waiter (`awaitControlDecision`) observes the
 *   allow
 *       ↓
 *   the last-mile guard consumes the allow EXACTLY ONCE (a second
 *   identical guard call is blocked allow-consumed)
 *
 * The durable evidence channel: the world's domain double rows + the
 * agents double's followup record (the delivered notification) + the
 * fresh `listControlState` reads.
 */

import { describe, expect, it } from 'vitest'

import {
  CONTROL_REQUEST_KINDS,
  createControlService,
  createLeaderControlNotifier,
} from '../control/index.js'
import type { ControlService } from '../control/index.js'
import { createActivityLedger } from '../activity/index.js'
import { createMessagingCoordinator } from '../messaging/index.js'
import { createP6T2Runtime } from './p6t2-helpers.js'
import {
  P6T4_NOW,
  P6T4_ROOT,
  P6T4_SEEDS,
  createP6T4World,
} from './p6t4-helpers.js'
import type { P6T1World } from './p6t1-helpers.js'
import { destroyP6T1World } from './p6t1-helpers.js'
import { createLiveWorld } from './t12a-live-bridge.mjs'
import { createTeamTools } from '../../tools/src/index.js'
import type { ActionCaller } from '../admission/index.js'
import type { TeamToolExecContext, TeamToolsResult } from '../../tools/src/index.js'

const WORKER_ID = String(P6T4_SEEDS.worker.instanceId)
const WORKER_SESSION = String(P6T4_SEEDS.worker.childSessionId)
const LEADER_ID = 'inst-leader'

const S = await (async () => {
  // --- the durable world (the control authority) --------------------------
  const world: P6T1World = await createP6T4World('c1-wiring', ['leader', 'worker'])
  const runtime = createP6T2Runtime(world)

  // --- the LIVE glue bundle (the real agent-bindings.mjs) -----------------
  const liveWorld = await createLiveWorld({ rootSessionId: P6T4_ROOT })
  await liveWorld.binding.boot()

  // --- the production wiring (root.ts A25 shape): ONE control service,
  // --- the notifier bound to the live bundle's root-control port.
  const control: ControlService = createControlService({
    teamDomain: world.domain,
    blueprintCatalog: world.catalog,
    externalPolicyFacts: world.ports.externalPolicyFacts,
    now: () => P6T4_NOW,
    waitPollIntervalMs: 5,
    requestNotification: createLeaderControlNotifier({
      deliver: liveWorld.binding.deliverRootControlNotification,
    }),
  })

  // --- the model-facing tool layer over the SAME service ------------------
  const bySession = new Map<string, ActionCaller>()
  bySession.set(P6T4_ROOT, { kind: 'instance', instanceId: LEADER_ID })
  bySession.set(WORKER_SESSION, { kind: 'instance', instanceId: WORKER_ID })
  const sessionInput = {
    calls: [] as unknown[],
    failNext: 0,
    async submitAttributedInput(input: unknown): Promise<void> {
      this.calls.push(input)
    },
  }
  const messaging = createMessagingCoordinator({
    teamRuntime: runtime,
    teamDomain: world.domain,
    sessionInput,
    now: () => P6T4_NOW,
  })
  const activity = createActivityLedger({
    teamDomain: world.domain,
    runtime,
    now: () => P6T4_NOW,
  })
  const { tools } = createTeamTools({
    teamRuntime: runtime,
    controlService: control,
    messaging,
    activity,
    async resolveCaller(sessionId: string): Promise<{ caller: ActionCaller; rootSessionId: string }> {
      const caller = bySession.get(sessionId)
      if (caller === undefined) {
        throw new Error(`c1 wiring: no caller for session ${sessionId}`)
      }
      // P0: the single-root fixture world — every seeded session owns the
      // fixture root.
      return { caller, rootSessionId: String(P6T4_ROOT) }
    },
  })
  function execFor(sessionId: string, callId: string): TeamToolExecContext {
    return { callId, name: '', arguments: {}, agent: { id: sessionId } } as TeamToolExecContext
  }
  async function runTool(
    name: string,
    args: Record<string, unknown>,
    sessionId: string,
  ): Promise<TeamToolsResult> {
    const tool = tools.find((t) => t.name === name)
    if (tool === undefined) throw new Error(`c1 wiring: no tool ${name}`)
    return await tool.execute(args, execFor(sessionId, `call-${name}`))
  }

  // (1) the MEMBER permission ask — the pre-execute adapter's own
  //     authority call (the adapter is the only other caller; this IS
  //     the same requestControl it drives).
  const scope = {
    rootSessionId: P6T4_ROOT,
    targetInstanceId: WORKER_ID,
    actionName: 'write-file',
    toolName: 'fs.write',
    correlation: 'corr-c1-wiring-1',
  }
  const followsBefore = liveWorld.records.followups.length
  const request = await control.requestControl({
    rootSessionId: P6T4_ROOT,
    caller: { kind: 'instance', instanceId: WORKER_ID },
    kind: CONTROL_REQUEST_KINDS.LEADER_APPROVAL,
    targetInstanceId: WORKER_ID,
    actionName: scope.actionName,
    toolName: scope.toolName,
    correlation: scope.correlation,
    summary: 'fs.write [path=/workspace/out.txt] <preview>',
  })

  // the member pre-execute waiter starts polling for the decision
  // (alpha.2 §9.4 — liveness only, no authority).
  const waiter = control
    .awaitControlDecision({ rootSessionId: P6T4_ROOT, requestId: request.requestId })
    .then(
      (decision) => ({ ok: true as const, decision }),
      (error: unknown) => ({ ok: false as const, error: String(error) }),
    )

  // (2) the notification port fired through the REAL glue seam:
  //     one model-visible root input turn on the Leader root.
  await new Promise((r) => setTimeout(r, 50))
  const notificationFollowups = liveWorld.records.followups.slice(followsBefore)
  const notificationText = (() => {
    const first = notificationFollowups[0]
    if (first === undefined) return undefined
    const msg = first.message as unknown as { content?: Array<{ text?: string }> }
    return msg.content?.[0]?.text
  })()

  // (3) the LEADER discovers the EXACT requestId through the new tool.
  const pending = await runTool(
    'team_list_pending_control',
    { rootSessionId: P6T4_ROOT, requestToken: 'c1-w-lpc' },
    P6T4_ROOT,
  )

  // (4) the LEADER resolves through the SAME model-facing tool (no
  //     test-only decision injection).
  const resolveResult = await runTool(
    'team_resolve_control',
    {
      rootSessionId: P6T4_ROOT,
      requestToken: 'c1-w-res',
      requestId: request.requestId,
      decision: 'allow',
    },
    P6T4_ROOT,
  )

  // (5) the member waiter observes the allow.
  const waited = await waiter

  // (6) the last-mile guard consumes the allow EXACTLY ONCE.
  const guardOnce = await control.guardOperation(scope)
  const guardAgain = await control.guardOperation(scope)

  const finalState = await control.listControlState(P6T4_ROOT)

  await liveWorld.binding.close()
  await destroyP6T1World(world)

  return {
    request,
    notificationFollowups,
    notificationText,
    pending,
    resolveResult,
    waited,
    guardOnce,
    guardAgain,
    finalState,
  }
})()

describe('C1 production wiring — member ask → notification → Leader discover → resolve → waiter → guard', () => {
  it('the durable request exists and the notification landed on the Leader root (real glue seam)', () => {
    expect(S.request.status).toBe('pending')
    expect(S.request.kind).toBe(CONTROL_REQUEST_KINDS.LEADER_APPROVAL)
    expect(S.notificationFollowups).toHaveLength(1)
    expect(S.notificationFollowups[0]!.sessionId).toBe(P6T4_ROOT)
    expect(S.notificationText).toContain(`[team-control requestId=${S.request.requestId}]`)
    expect(S.notificationText).toContain('team_resolve_control')
    expect(S.notificationText).toContain('team_list_pending_control')
  })

  it('the Leader discovers the EXACT pending requestId through team_list_pending_control', () => {
    expect(S.pending.status).toBe('pending-control-listed')
    if (S.pending.status !== 'pending-control-listed') return
    const ids = S.pending.pending.map((p) => p.requestId)
    expect(ids).toContain(S.request.requestId)
    expect(S.pending.count).toBeGreaterThanOrEqual(1)
  })

  it('the Leader resolves through team_resolve_control (the same model-facing authority)', () => {
    expect(S.resolveResult.status).toBe('control-resolved')
    if (S.resolveResult.status !== 'control-resolved') return
    expect(S.resolveResult.decision.requestId).toBe(S.request.requestId)
    expect(S.resolveResult.decision.decision).toBe('allow')
  })

  it('the member pre-execute waiter observes the durable allow', () => {
    expect(S.waited.ok).toBe(true)
    if (S.waited.ok === true) {
      expect(S.waited.decision.requestId).toBe(S.request.requestId)
      expect(S.waited.decision.decision).toBe('allow')
    }
  })

  it('the last-mile guard consumes the allow EXACTLY ONCE (the second attempt is blocked)', () => {
    expect(S.guardOnce.allowed).toBe(true)
    expect(S.guardAgain.allowed).toBe(false)
    if (S.guardAgain.allowed !== true) {
      expect(S.guardAgain.reason).toBe('allow-consumed')
    }
    // exactly ONE consumption fact for the request
    const consumptions = S.finalState.consumptions.filter(
      (c) => c.requestId === S.request.requestId,
    )
    expect(consumptions).toHaveLength(1)
  })
})
