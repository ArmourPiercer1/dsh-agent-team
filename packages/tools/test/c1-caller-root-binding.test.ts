/**
 * P0 (caller-root binding, PR #20 final closure) — the tool-layer
 * caller-root binding suite (plan §3 / §14 R1–R6):
 *
 * Every team tool takes the team root from a MODEL-SUPPLIED argument
 * (`rootSessionId`), while every Team's Leader resolves to the SAME
 * shared identity (`inst-leader`). Without a binding between the
 * calling session and its OWNING root, a Leader of Team A could
 * address Team B's ledger as Team B's leader (list B's pending,
 * resolve B's requests, request on B's behalf). The tool layer now
 * resolves the caller to `{caller, rootSessionId}` (the owning root,
 * from the durable domain — never from the arguments) and enforces
 * owning-root == requested root at the ONE common entry
 * (`makeDefinition`), BEFORE any downstream effect — a cross-root
 * caller is rejected with `TEAM_TOOL_CALLER_ROOT_MISMATCH`.
 *
 * R1  Leader A lists Team B's pending      -> rejected, NO pending data
 *     returned (the rejection result carries no request payload)
 * R2  Leader A resolves Team B's request   -> rejected; Team B's request
 *     stays pending with ZERO decisions/consumptions; Team B's OWN
 *     leader can still resolve it (same-root positive)
 * R3  Member A reads Team B's members      -> rejected (the gate fires
 *     before the runtime is touched)
 * R4  Leader A lists Team A's pending      -> `pending-control-listed`
 *     (empty — Team A cannot see Team B's pending either)
 * R5  same-root member tools work          -> member B requests control
 *     on Team B; member A reports progress on Team A
 * R6  ledger invariants                    -> Team A's control state is
 *     untouched (0/0/0); Team B ends with exactly the one request +
 *     the one decision its own leader recorded
 *
 * World: the full C1 tool-suite world over the P6-T4 durable world
 * (real TeamDomain over a scratch dir — the P6-T4 blueprint, whose
 * member envelope admits `request-control`), with a SECOND team root
 * N added to the SAME durable domain (team session + team-root
 * binding + a leader row + a worker row), so ONE control service
 * serves both teams. The caller resolver is the PRODUCTION-SHAPED
 * mapping over the real domain rows (the glue's
 * session-owns-root -> leader / membership -> instance mapping,
 * `agent-bindings.mjs` SD-CALLER), so the gate is exercised exactly
 * the way production wires it.
 */

import { describe, expect, it } from 'vitest'

import {
  createBlueprintSnapshotRef,
  parseBlueprintContentHash,
  parseBlueprintId,
  parseBlueprintRevision,
  parseChildSessionId,
  parseInstanceId,
  parseRootSessionId,
  parseTemplateId,
} from '../../contracts/src/index.js'
import { createActivityLedger } from '../../runtime/activity/index.js'
import { createControlService } from '../../runtime/control/index.js'
import type { ControlService } from '../../runtime/control/index.js'
import { createMessagingCoordinator } from '../../runtime/messaging/index.js'
import { createP6T2Runtime } from '../../runtime/test/p6t2-helpers.js'
import {
  P6T4_NOW,
  P6T4_ROOT,
  P6T4_SEEDS,
  createP6T4World,
} from '../../runtime/test/p6t4-helpers.js'
import type { P6T1World } from '../../runtime/test/p6t1-helpers.js'
import { destroyP6T1World } from '../../runtime/test/p6t1-helpers.js'
import { createTeamTools } from '../src/index.js'
import type {
  ResolvedTeamToolCaller,
  TeamToolDefinition,
  TeamToolsResult,
} from '../src/index.js'

const WORKER_A_ID = String(P6T4_SEEDS.worker.instanceId)
const WORKER_A_SESSION = String(P6T4_SEEDS.worker.childSessionId)
const LEADER_ID = 'inst-leader'

/** The second team root (Team B) — added to the SAME durable domain. */
const ROOT_N_ID = parseRootSessionId('session-c1rb-root-n')
const ROOT_N = String(ROOT_N_ID)
const LEADER_N_SESSION = 'session-c1rb-leader-n'
const MEMBER_B_ID = 'inst-c1rbmb'
const MEMBER_B_SESSION = 'session-c1rb-mb'

/** The P0 rejection code (closed tool-layer vocabulary). */
const CODE_MISMATCH = 'TEAM_TOOL_CALLER_ROOT_MISMATCH'

/** The plan §8.1 message contract. */
function mismatchMessage(callerRoot: string, requestedRoot: string): string {
  return `team-tools: caller session belongs to Team root '${callerRoot}', but the tool request targets root '${requestedRoot}'`
}

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

/**
 * The PRODUCTION-SHAPED caller map (agent-bindings.mjs SD-CALLER):
 * the session's OWNING root from the durable domain — the session is
 * a team root (that team's Leader), or a bound member child (that
 * team's instance) — plus the caller identity. Unknown sessions fail
 * closed (no boot-root fallback).
 */
function makeProductionShapeResolver(world: P6T1World) {
  return async (sessionId: string): Promise<ResolvedTeamToolCaller> => {
    const sid = String(sessionId)
    const isMemberOf = (teamRoot: string): string | undefined => {
      for (const member of world.domain.repositories.memberInstances.list(teamRoot)) {
        if (String(member.childSessionId) === sid) return teamRoot
      }
      return undefined
    }
    let teamRoot: string | undefined
    if (world.domain.repositories.teamSessions.get(sid) !== undefined) {
      teamRoot = sid
    }
    if (teamRoot === undefined) {
      for (const row of world.domain.repositories.teamSessions.list()) {
        const root = String(row.rootSessionId)
        if (root === sid) continue
        teamRoot = isMemberOf(root)
        if (teamRoot !== undefined) break
      }
    }
    if (teamRoot === undefined) {
      throw new Error(`c1rb caller map: no caller for session ${sid}`)
    }
    if (teamRoot === sid) {
      return { caller: { kind: 'instance', instanceId: LEADER_ID }, rootSessionId: teamRoot }
    }
    const member = world.domain.repositories
      .memberInstances.list(teamRoot)
      .find((row) => String(row.childSessionId) === sid)
    if (member === undefined) {
      throw new Error(`c1rb caller map: no caller for session ${sid}`)
    }
    return {
      caller: { kind: 'instance', instanceId: String(member.instanceId) },
      rootSessionId: teamRoot,
    }
  }
}

/** Assert a P0 cross-root rejection with the exact plan contract. */
function assertMismatch(
  result: TeamToolsResult,
  what: string,
  callerRoot: string,
  requestedRoot: string,
): void {
  expect(result.status, what).toBe('rejected')
  if (result.status !== 'rejected') return
  expect(result.code, what).toBe(CODE_MISMATCH)
  expect(result.message, what).toBe(mismatchMessage(callerRoot, requestedRoot))
  expect(result.details, what).toEqual({
    callerRootSessionId: callerRoot,
    requestedRootSessionId: requestedRoot,
  })
}

const S = await (async () => {
  // --- the durable world (Team A = the P6-T4 fixture root) --------------
  const world = await createP6T4World('c1-caller-root', ['leader', 'worker'])

  // --- Team B (root N): second team root in the SAME durable domain -----
  const blueprint = world.blueprint
  await world.domain.repositories.teamSessions.put({
    rootSessionId: ROOT_N_ID,
    blueprint: createBlueprintSnapshotRef({
      blueprintId: parseBlueprintId(String(blueprint.blueprintId)),
      revision: parseBlueprintRevision(String(blueprint.revision)),
      contentHash: parseBlueprintContentHash(String(blueprint.contentHash)),
    }),
    defaultWorkspace: 'C:/agent-team/work/c1rb-n',
    createdAt: P6T4_NOW,
    generation: 1,
  })
  await world.domain.repositories.sessionBindings.put({
    kind: 'team-root',
    schemaVersion: 1,
    sessionId: ROOT_N,
  })
  // Team B's Leader row (the same leader-as-member-row shape the P6-T4
  // world seeds for Team A) + one worker.
  await world.domain.repositories.memberInstances.put({
    rootSessionId: ROOT_N_ID,
    instanceId: parseInstanceId(LEADER_ID),
    templateId: parseTemplateId('leader'),
    label: 'c1rb-leader-n',
    childSessionId: parseChildSessionId(LEADER_N_SESSION),
    lifecycle: 'CREATED',
    createdAt: P6T4_NOW,
    activityVersion: 1,
  })
  await world.domain.repositories.memberInstances.put({
    rootSessionId: ROOT_N_ID,
    instanceId: parseInstanceId(MEMBER_B_ID),
    templateId: parseTemplateId('worker'),
    label: 'c1rb-member-b',
    childSessionId: parseChildSessionId(MEMBER_B_SESSION),
    lifecycle: 'CREATED',
    createdAt: P6T4_NOW,
    activityVersion: 1,
  })

  // --- the real satellite wiring (one control service serves BOTH) ------
  const runtime = createP6T2Runtime(world)
  const control: ControlService = createControlService({
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
  const { tools } = createTeamTools({
    teamRuntime: runtime,
    controlService: control,
    messaging,
    activity,
    resolveCaller: makeProductionShapeResolver(world),
  })
  const findTool = (name: string): TeamToolDefinition => {
    const tool = tools.find((candidate) => candidate.name === name)
    if (tool === undefined) {
      throw new Error(`c1rb: no registered tool named ${name}`)
    }
    return tool
  }
  const run = (
    name: string,
    args: Record<string, unknown>,
    sessionId: string,
    callId: string,
  ): Promise<TeamToolsResult> =>
    findTool(name).execute(args, {
      callId,
      name: '',
      arguments: {},
      agent: { id: sessionId },
    })

  // --- R5a: member B (Team B) requests control on Team B (same-root
  // --- member positive — and seeds the cross-root victim request).
  const requestB = await run(
    'team_request_control',
    {
      rootSessionId: ROOT_N,
      requestToken: 'tok-c1rb-z-req',
      kind: 'leader-approval',
      targetInstanceId: MEMBER_B_ID,
      actionName: 'bash',
      toolName: 'bash',
      summary: 'c1rb member B asks for a bash scope on Team B',
    },
    MEMBER_B_SESSION,
    'call-c1rb-z-req',
  )
  const zReq =
    requestB.status === 'control-requested'
      ? requestB.request
      : (() => {
          throw new Error(`R5a: expected control-requested, got '${requestB.status}'`)
        })()

  // --- R4: Leader A lists Team A's pending -> empty (Team A cannot see
  // --- Team B's pending request either).
  const listA = await run(
    'team_list_pending_control',
    { rootSessionId: P6T4_ROOT, requestToken: 'tok-c1rb-list-a' },
    P6T4_ROOT,
    'call-c1rb-list-a',
  )

  // --- R1: Leader A lists Team B's pending -> cross-root rejection, no
  // --- pending data returned.
  const listBAsA = await run(
    'team_list_pending_control',
    { rootSessionId: ROOT_N, requestToken: 'tok-c1rb-list-b' },
    P6T4_ROOT,
    'call-c1rb-list-b',
  )

  // --- R3: member A reads Team B's members -> cross-root rejection before
  // --- the runtime is touched.
  const membersBAsA = await run(
    'team_list_members',
    { rootSessionId: ROOT_N, requestToken: 'tok-c1rb-lm-b' },
    WORKER_A_SESSION,
    'call-c1rb-lm-b',
  )

  // --- R2: Leader A resolves Team B's request -> cross-root rejection.
  const resolveBAsA = await run(
    'team_resolve_control',
    {
      rootSessionId: ROOT_N,
      requestToken: 'tok-c1rb-res-b',
      requestId: zReq.requestId,
      decision: 'allow',
    },
    P6T4_ROOT,
    'call-c1rb-res-b',
  )
  // R2 (still pending): Team B's ledger is untouched by the rejection.
  const stateBAfterReject = await control.listControlState(ROOT_N)

  // --- R2 (same-root positive): Team B's OWN leader resolves its request.
  const resolveBAsN = await run(
    'team_resolve_control',
    {
      rootSessionId: ROOT_N,
      requestToken: 'tok-c1rb-res-b2',
      requestId: zReq.requestId,
      decision: 'deny',
      note: 'Team B leader denies its own member request',
    },
    LEADER_N_SESSION,
    'call-c1rb-res-b2',
  )

  // --- R5b: member A reports progress on Team A (same-root member
  // --- positive over the real runtime + activity ledger).
  const progressA = await run(
    'team_report_progress',
    {
      rootSessionId: P6T4_ROOT,
      requestToken: 'tok-c1rb-prog-a',
      instanceId: WORKER_A_ID,
      subject: 'c1rb-subject',
      progress: 'in-progress',
    },
    WORKER_A_SESSION,
    'call-c1rb-prog-a',
  )

  // --- R6: the final ledger invariants.
  const stateAFinal = await control.listControlState(P6T4_ROOT)
  const stateBFinal = await control.listControlState(ROOT_N)

  await destroyP6T1World(world)

  return {
    requestB,
    zReq,
    listA,
    listBAsA,
    membersBAsA,
    resolveBAsA,
    stateBAfterReject,
    resolveBAsN,
    progressA,
    stateAFinal,
    stateBFinal,
  }
})()

describe('P0 caller-root binding (R1–R6)', () => {
  it('R1: Leader A listing Team B pending is rejected with the P0 code and returns NO pending data', () => {
    const r = S.listBAsA
    assertMismatch(r, 'R1', P6T4_ROOT, ROOT_N)
    if (r.status !== 'rejected') throw new Error('unreachable: R1 must reject')
    // no request payload in the rejection (the cross-root caller never
    // sees Team B's pending list)
    expect('pending' in r).toBe(false)
    expect('requests' in r).toBe(false)
    expect(r.details).toEqual({
      callerRootSessionId: P6T4_ROOT,
      requestedRootSessionId: ROOT_N,
    })
  })

  it('R2: Leader A resolving Team B request is rejected; Team B stays pending with 0 decisions/consumptions; Team B own leader still resolves it', () => {
    assertMismatch(S.resolveBAsA, 'R2-reject', P6T4_ROOT, ROOT_N)
    // the rejection changed NOTHING in Team B's ledger:
    expect(S.stateBAfterReject.requests.length).toBe(1)
    expect(S.stateBAfterReject.requests[0]?.status).toBe('pending')
    expect(S.stateBAfterReject.requests[0]?.requestId).toBe(S.zReq.requestId)
    expect(S.stateBAfterReject.decisions.length).toBe(0)
    expect(S.stateBAfterReject.consumptions.length).toBe(0)
    // the same-root positive: Team B's own leader resolves the SAME
    // request (the gate does not over-block the legitimate owner).
    expect(S.resolveBAsN.status).toBe('control-resolved')
    if (S.resolveBAsN.status === 'control-resolved') {
      expect(S.resolveBAsN.decision.decision).toBe('deny')
      expect(S.resolveBAsN.decision.requestId).toBe(S.zReq.requestId)
      expect(S.resolveBAsN.decision.decider).toEqual({
        kind: 'instance',
        instanceId: LEADER_ID,
        role: 'leader',
      })
    }
  })

  it('R3: member A reading Team B members is rejected at the gate (before any runtime effect)', () => {
    assertMismatch(S.membersBAsA, 'R3', P6T4_ROOT, ROOT_N)
  })

  it('R4: Leader A listing Team A pending returns the empty list (root-scoped read works; Team B pending is not visible)', () => {
    expect(S.listA.status).toBe('pending-control-listed')
    if (S.listA.status !== 'pending-control-listed') return
    expect(S.listA.rootSessionId).toBe(P6T4_ROOT)
    expect(S.listA.count).toBe(0)
    expect(S.listA.pending).toEqual([])
    expect(S.listA.truncated).toBe(false)
  })

  it('R5: same-root member tools work — member B requests control on Team B (control-requested); member A reports progress on Team A (progress-recorded)', () => {
    expect(S.requestB.status).toBe('control-requested')
    if (S.requestB.status === 'control-requested') {
      expect(S.zReq.rootSessionId).toBe(ROOT_N)
      expect(S.zReq.requester).toEqual({ kind: 'instance', instanceId: MEMBER_B_ID, role: 'member' })
      expect(S.zReq.targetInstanceId).toBe(MEMBER_B_ID)
      expect(S.zReq.kind).toBe('leader-approval')
      expect(S.zReq.status).toBe('pending')
    }
    expect(S.progressA.status).toBe('progress-recorded')
    if (S.progressA.status === 'progress-recorded') {
      expect(S.progressA.rootSessionId).toBe(P6T4_ROOT)
      expect(S.progressA.instanceId).toBe(WORKER_A_ID)
    }
  })

  it('R6: ledger invariants — Team A control state untouched (0/0/0); Team B holds exactly its one request + its own leader decision; zero consumptions anywhere', () => {
    expect(S.stateAFinal.requests.length).toBe(0)
    expect(S.stateAFinal.decisions.length).toBe(0)
    expect(S.stateAFinal.consumptions.length).toBe(0)
    expect(S.stateBFinal.requests.length).toBe(1)
    expect(S.stateBFinal.requests[0]?.requestId).toBe(S.zReq.requestId)
    expect(S.stateBFinal.requests[0]?.status).toBe('decided')
    expect(S.stateBFinal.decisions.length).toBe(1)
    expect(S.stateBFinal.decisions[0]?.requestId).toBe(S.zReq.requestId)
    expect(S.stateBFinal.consumptions.length).toBe(0)
  })
})
