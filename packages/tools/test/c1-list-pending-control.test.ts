/**
 * C1 (leader-approval reachability) — the `team_list_pending_control`
 * tool unit tests (plan §9.1, nine cases):
 *
 *   1. Leader + zero pending        -> empty list
 *   2. Leader + one pending         -> the exact request record is returned
 *   3. a decided request            -> excluded
 *   4. a pending user-approval      -> excluded (narrow surface)
 *   5. a pending envelope-mutation  -> excluded (first narrow version)
 *   6. multiple requests            -> sorted by durable requestSequence
 *   7. `limit`                      -> deterministic truncation (+ flag)
 *   8. a member caller              -> rejected BEFORE any read
 *   9. the read                     -> zero ledger writes, zero decisions,
 *                                      zero consumption (durable evidence)
 *
 * World: the full tool-suite world over the P6-T4 durable world (real
 * TeamDomain over a scratch dir + real control service + the sanctioned
 * satellite set + `createTeamTools`), the P6-T6 pattern re-seeded on the
 * P6-T4 blueprint (whose member envelope admits `request-control` — the
 * P6-T6 member envelope does not). Requests are seeded through the SAME
 * durable `controlService.requestControl` authority the production
 * pre-execute path uses (the tool under test is never asked to create
 * requests).
 */

import { describe, expect, it } from 'vitest'

import { createActivityLedger } from '../../runtime/activity/index.js'
import type { ActivityLedger } from '../../runtime/activity/index.js'
import type { ActionCaller, TeamRuntime } from '../../runtime/admission/index.js'
import {
  CONTROL_REQUEST_KINDS,
  createControlService,
} from '../../runtime/control/index.js'
import type { ControlService } from '../../runtime/control/index.js'
import { createMessagingCoordinator } from '../../runtime/messaging/index.js'
import type { MessagingCoordinator } from '../../runtime/messaging/index.js'
import type { P6T1World } from '../../runtime/test/p6t1-helpers.js'
import { destroyP6T1World } from '../../runtime/test/p6t1-helpers.js'
import { createP6T2Runtime } from '../../runtime/test/p6t2-helpers.js'
import {
  P6T4_NOW,
  P6T4_ROOT,
  P6T4_SEEDS,
  createP6T4World,
} from '../../runtime/test/p6t4-helpers.js'
import { createTeamTools } from '../src/index.js'
import type {
  ResolvedTeamToolCaller,
  TeamToolDefinition,
  TeamToolsResult,
} from '../src/index.js'

const WORKER_ID = String(P6T4_SEEDS.worker.instanceId)
const WORKER_SESSION = String(P6T4_SEEDS.worker.childSessionId)
const LEADER_ID = 'inst-leader'

/** A recording fake session-input port (the P6-T6 pattern; the
 *  messaging coordinator needs it, this suite does not drive it). */
function createFakeSessionInput() {
  return {
    calls: [] as Array<{ sessionId: string; text: string }>,
    failNext: 0,
    async submitAttributedInput(input: {
      sessionId: string
      text: string
      attribution: unknown
    }): Promise<void> {
      if (this.failNext > 0) {
        this.failNext -= 1
        throw new Error('fake session input: injected fault')
      }
      this.calls.push({ sessionId: input.sessionId, text: input.text })
    },
  }
}

/** The C1 tool world (P6-T4 durable world + satellite set + tools). */
interface C1ToolWorld {
  readonly world: P6T1World
  readonly runtime: TeamRuntime
  readonly control: ControlService
  readonly messaging: MessagingCoordinator
  readonly activity: ActivityLedger
  readonly tools: readonly TeamToolDefinition[]
  findTool(name: string): TeamToolDefinition
}

async function createC1ToolWorld(basename: string): Promise<C1ToolWorld> {
  const world = await createP6T4World(basename, ['leader', 'worker'])
  const runtime = createP6T2Runtime(world)
  const control = createControlService({
    teamDomain: world.domain,
    blueprintCatalog: world.catalog,
    externalPolicyFacts: world.ports.externalPolicyFacts,
    now: () => P6T4_NOW,
  })
  const sessionInput = createFakeSessionInput()
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
  const bySession = new Map<string, ActionCaller>()
  bySession.set(P6T4_ROOT, { kind: 'instance', instanceId: LEADER_ID })
  bySession.set(WORKER_SESSION, { kind: 'instance', instanceId: WORKER_ID })
  const { tools } = createTeamTools({
    teamRuntime: runtime,
    controlService: control,
    messaging,
    activity,
    async resolveCaller(sessionId: string): Promise<ResolvedTeamToolCaller> {
      const caller = bySession.get(sessionId)
      if (caller === undefined) {
        throw new Error(`c1 tool world: no caller for session ${sessionId}`)
      }
      // P0: the single-root fixture world — every seeded session owns the
      // fixture root.
      return { caller, rootSessionId: String(P6T4_ROOT) }
    },
  })
  return {
    world,
    runtime,
    control,
    messaging,
    activity,
    tools,
    findTool(name: string): TeamToolDefinition {
      const tool = tools.find((candidate) => candidate.name === name)
      if (tool === undefined) {
        throw new Error(`c1 tool world: no registered tool named ${name}`)
      }
      return tool
    },
  }
}

function execFor(sessionId: string, callId = 'call-1') {
  return { callId, name: '', arguments: {}, agent: { id: sessionId } }
}

async function runTool(
  env: C1ToolWorld,
  name: string,
  args: Record<string, unknown>,
  sessionId: string,
): Promise<TeamToolsResult> {
  return await env.findTool(name).execute(args, execFor(sessionId))
}

const S = await (async () => {
  const env = await createC1ToolWorld('c1-list-pending')

  // (case 1) zero pending -> empty list, no truncation.
  const empty = await runTool(
    env,
    'team_list_pending_control',
    { rootSessionId: P6T4_ROOT, requestToken: 'c1-l-1' },
    P6T4_ROOT,
  )

  const workerCaller: ActionCaller = { kind: 'instance', instanceId: WORKER_ID }
  async function seedLeaderApproval(correlation: string, summary?: string) {
    return env.control.requestControl({
      rootSessionId: P6T4_ROOT,
      caller: workerCaller,
      kind: CONTROL_REQUEST_KINDS.LEADER_APPROVAL,
      targetInstanceId: WORKER_ID,
      actionName: 'write-file',
      toolName: 'fs.write',
      correlation,
      ...(summary !== undefined ? { summary } : {}),
    })
  }

  // (case 2) one pending leader-approval -> the EXACT record surfaces.
  const one = await seedLeaderApproval('c1-corr-one')
  const single = await runTool(
    env,
    'team_list_pending_control',
    { rootSessionId: P6T4_ROOT, requestToken: 'c1-l-2' },
    P6T4_ROOT,
  )

  // (case 3) a decided request is excluded.
  const decided = await seedLeaderApproval('c1-corr-decided')
  await env.control.resolveControl({
    rootSessionId: P6T4_ROOT,
    caller: { kind: 'instance', instanceId: LEADER_ID },
    requestId: decided.requestId,
    decision: 'allow',
  })
  const afterDecide = await runTool(
    env,
    'team_list_pending_control',
    { rootSessionId: P6T4_ROOT, requestToken: 'c1-l-3' },
    P6T4_ROOT,
  )

  // (case 4) a pending USER approval is excluded (human-only resolvers —
  // the narrow leader-approval list never shows it).
  await env.control.requestControl({
    rootSessionId: P6T4_ROOT,
    caller: workerCaller,
    kind: CONTROL_REQUEST_KINDS.USER_APPROVAL,
    targetInstanceId: WORKER_ID,
    actionName: 'write-file',
    toolName: 'fs.write',
    correlation: 'c1-corr-user',
  })
  const userExcluded = await runTool(
    env,
    'team_list_pending_control',
    { rootSessionId: P6T4_ROOT, requestToken: 'c1-l-4' },
    P6T4_ROOT,
  )

  // (case 5) a pending ENVELOPE-MUTATION is excluded in this first narrow
  // tool (no query language: leader-approval only).
  await env.control.requestControl({
    rootSessionId: P6T4_ROOT,
    caller: workerCaller,
    kind: CONTROL_REQUEST_KINDS.ENVELOPE_MUTATION,
    targetInstanceId: WORKER_ID,
    actionName: 'update-envelope',
    correlation: 'c1-corr-envelope',
  })
  const envelopeExcluded = await runTool(
    env,
    'team_list_pending_control',
    { rootSessionId: P6T4_ROOT, requestToken: 'c1-l-5' },
    P6T4_ROOT,
  )

  // (case 6) multiple pending requests are sorted by durable
  // requestSequence ascending — created in correlation order m-c, m-a,
  // m-b on purpose, so a correlation-order sort would fail.
  const m1 = await seedLeaderApproval('c1-corr-m-c')
  const m2 = await seedLeaderApproval('c1-corr-m-a')
  const m3 = await seedLeaderApproval('c1-corr-m-b')
  const multi = await runTool(
    env,
    'team_list_pending_control',
    { rootSessionId: P6T4_ROOT, requestToken: 'c1-l-6', limit: 100 },
    P6T4_ROOT,
  )

  // (case 7) limit truncates deterministically (the oldest sequences
  // first, the `truncated` flag says so).
  const page = await runTool(
    env,
    'team_list_pending_control',
    { rootSessionId: P6T4_ROOT, requestToken: 'c1-l-7', limit: 2 },
    P6T4_ROOT,
  )

  // (case 8) a MEMBER caller is rejected — before any read (the durable
  // ledger is root-scoped; the model-facing discovery surface is the
  // Leader's).
  const memberAttempt = await runTool(
    env,
    'team_list_pending_control',
    { rootSessionId: P6T4_ROOT, requestToken: 'c1-l-8' },
    WORKER_SESSION,
  )

  // (case 9) zero durable side effects: the ledger fact count, the
  // decision count and the consumption count are IDENTICAL before and
  // after a list read (the read is a fresh ledger scan — invariant 45).
  const ledger = env.world.domain.repositories.ledger
  const before = ledger.list().length
  const stateBefore = await env.control.listControlState(P6T4_ROOT)
  const audit = await runTool(
    env,
    'team_list_pending_control',
    { rootSessionId: P6T4_ROOT, requestToken: 'c1-l-9' },
    P6T4_ROOT,
  )
  const after = ledger.list().length
  const stateAfter = await env.control.listControlState(P6T4_ROOT)

  await destroyP6T1World(env.world)

  return {
    env,
    empty,
    one,
    single,
    decided,
    afterDecide,
    userExcluded,
    envelopeExcluded,
    m1,
    m2,
    m3,
    multi,
    page,
    memberAttempt,
    before,
    after,
    stateBefore,
    stateAfter,
    audit,
  }
})()

describe('team_list_pending_control (C1) — the Leader pending-approval discovery read', () => {
  it('is registered as the 12th closed team tool', () => {
    const names = S.env.tools.map((t) => t.name)
    expect(names).toContain('team_list_pending_control')
    expect(names).toHaveLength(12)
  })

  it('case 1: Leader + zero pending -> the empty list (count 0, not truncated)', () => {
    const r = S.empty
    expect(r.status).toBe('pending-control-listed')
    if (r.status !== 'pending-control-listed') return
    expect(r.rootSessionId).toBe(P6T4_ROOT)
    expect(r.pending).toEqual([])
    expect(r.count).toBe(0)
    expect(r.truncated).toBe(false)
  })

  it('case 2: Leader + one pending leader-approval -> the EXACT request record', () => {
    const r = S.single
    expect(r.status).toBe('pending-control-listed')
    if (r.status !== 'pending-control-listed') return
    expect(r.count).toBe(1)
    expect(r.truncated).toBe(false)
    expect(r.pending).toHaveLength(1)
    const record = r.pending[0]!
    expect(record.requestId).toBe(S.one.requestId)
    expect(record.kind).toBe(CONTROL_REQUEST_KINDS.LEADER_APPROVAL)
    expect(record.targetInstanceId).toBe(WORKER_ID)
    expect(record.status).toBe('pending')
    expect(record.requestSequence).toBe(S.one.requestSequence)
    expect(record.toolName).toBe('fs.write')
  })

  it('case 3: a decided request is excluded from the pending list', () => {
    const r = S.afterDecide
    expect(r.status).toBe('pending-control-listed')
    if (r.status !== 'pending-control-listed') return
    const ids = r.pending.map((p) => p.requestId)
    expect(ids).not.toContain(S.decided.requestId)
    expect(ids).toContain(S.one.requestId)
    expect(r.count).toBe(1)
  })

  it('case 4: a pending user-approval is excluded (narrow leader-approval surface)', () => {
    const r = S.userExcluded
    expect(r.status).toBe('pending-control-listed')
    if (r.status !== 'pending-control-listed') return
    const kinds = r.pending.map((p) => p.kind)
    expect(kinds).not.toContain(CONTROL_REQUEST_KINDS.USER_APPROVAL)
    expect(kinds).toContain(CONTROL_REQUEST_KINDS.LEADER_APPROVAL)
  })

  it('case 5: a pending envelope-mutation is excluded in this first narrow tool', () => {
    const r = S.envelopeExcluded
    expect(r.status).toBe('pending-control-listed')
    if (r.status !== 'pending-control-listed') return
    const kinds = r.pending.map((p) => p.kind)
    expect(kinds).not.toContain(CONTROL_REQUEST_KINDS.ENVELOPE_MUTATION)
    expect(kinds).toContain(CONTROL_REQUEST_KINDS.LEADER_APPROVAL)
  })

  it('case 6: multiple requests are sorted by durable requestSequence ascending', () => {
    const r = S.multi
    expect(r.status).toBe('pending-control-listed')
    if (r.status !== 'pending-control-listed') return
    const seqs = r.pending.map((p) => p.requestSequence)
    const sorted = [...seqs].sort((a, b) => a - b)
    expect(seqs).toEqual(sorted)
    const ids = r.pending.map((p) => p.requestId)
    expect(ids).toContain(S.m1.requestId)
    expect(ids).toContain(S.m2.requestId)
    expect(ids).toContain(S.m3.requestId)
    // creation order was m1, m2, m3 — the durable sequence order must be
    // m1 < m2 < m3 and the returned list must match it exactly (the
    // correlations were deliberately out of order: c, a, b).
    expect(ids.indexOf(S.m1.requestId)).toBeLessThan(ids.indexOf(S.m2.requestId))
    expect(ids.indexOf(S.m2.requestId)).toBeLessThan(ids.indexOf(S.m3.requestId))
  })

  it('case 7: limit truncates deterministically and sets the truncated flag', () => {
    const r = S.page
    expect(r.status).toBe('pending-control-listed')
    if (r.status !== 'pending-control-listed') return
    expect(r.count).toBe(2)
    expect(r.truncated).toBe(true)
    // the first page carries the OLDEST sequence (the list is
    // sequence-sorted before the clamp is applied).
    const all = S.multi
    expect(all.status).toBe('pending-control-listed')
    if (all.status === 'pending-control-listed') {
      expect(r.pending[0]!.requestSequence).toBe(all.pending[0]!.requestSequence)
    }
  })

  it('case 8: a member caller is rejected before any read (Leader-only surface)', () => {
    const r = S.memberAttempt
    expect(r.status).toBe('rejected')
    if (r.status !== 'rejected') return
    expect(r.code).toBe('TEAM_TOOL_PENDING_LIST_NOT_LEADER')
  })

  it('case 9: the list read causes zero ledger writes / zero decisions / zero consumption', () => {
    expect(S.after).toBe(S.before)
    expect(S.stateAfter.decisions.length).toBe(S.stateBefore.decisions.length)
    expect(S.stateAfter.consumptions.length).toBe(S.stateBefore.consumptions.length)
    // the read itself still returned the live pending set (it read, it
    // wrote nothing)
    expect(S.audit.status).toBe('pending-control-listed')
    if (S.audit.status === 'pending-control-listed') {
      expect(S.audit.pending.length).toBeGreaterThan(0)
    }
  })
})
