/**
 * mcp-target-materialization.test.ts — Finding F (P1): target-specific MCP
 * materialization/readiness masked by aggregate results.
 *
 * The regression matrix (T1–T5), every world on the REAL production host
 * entry (`hostEntry.apply` — packages/runtime/src/plugin/host.ts) with the
 * REAL production glue (the default `glueUrl` — the agent-bindings.mjs
 * next to the entry — through its own `import`), the REAL bridge agents
 * double (`createAgentsDouble`, the 0.1.7-style `setup(agentCtx, agent)`
 * contract) and the per-server fiber doubles (the F15 public-seam model:
 * `withdrawTools()` = the upstream post-budget-exhaustion supervisor
 * effect). The full chain therefore runs exactly as in production:
 * `performAction` → router → requirement gate → the live provider → the
 * host's mcpServer probe port (the aggregate) + the host's
 * memberMaterialization port (the target boundary) → the 2-state engine
 * feed + the 3-state classifier → the typed block/allow → the effect
 * (work delivery → the boundary reconcile → the slot).
 *
 *  T1 — two live instances of one template: A healthy + mounted, B a
 *       confirmed loss (withdrawn tool surface → the probe retires B's
 *       fiber and stamps its slot `failed`). The follow-up to B MUST be
 *       BLOCKED with ZERO work (no delivery to B's session — the gate
 *       blocks before the effect), while the follow-up to A PASSES (the
 *       TARGET instance's own materialization is the boundary — the
 *       healthy instance is not masked by the failed sibling, and the
 *       failed instance is not masked by the healthy one).
 *  T2 — the scope incident: the `worker` scope's recovery incident (opened
 *       on the recovery-allowed passage) MUST NOT close while B is failed
 *       — the scope's own materialization is not satisfied — even while
 *       the healthy A receives work; it closes (and B unblocks) only
 *       after B's materialization has CONVERGED (the failed slot remounted
 *       at B's next boundary, post-cooldown).
 *  T3 — two team roots, the same templateId: the TARGET root's failed
 *       instance gates the target root's work (no cross-root conflation
 *       through the boot root's member rows); the boot root's healthy
 *       instance keeps working.
 *  T4 — the v2 Leader template: the Leader's own materialization (the
 *       root session's fiber) gates leader-targeted work — the v2 Leader
 *       row (no childSessionId) is observed through the root session,
 *       masked by a healthy sibling fiber (the aggregate stays
 *       `reachable` while the target boundary is `failed`).
 *  T5 — the cold member: the `not-applicable` materialization is
 *       preserved — a cold instance (no live agent) NEVER blocks
 *       (applicability gates before readiness; the seed's truth decides
 *       the never-observed unknown); its follow-up resumes + mounts +
 *       delivers.
 *
 * World style: module-level async world construction (top-level await) +
 * synchronous `it` bodies over the captured constants (the plain-node
 * vitest shim forbids async `it` bodies — the house pattern).
 *
 * @module @dsh-agent-team/runtime/test/mcp-target-materialization
 */

import { describe, expect, it } from 'vitest'
import * as hostEntry from '../src/plugin/host.js'
import {
  FileStorageSeam,
  destroyDir,
  scratchDir,
} from '../../testkit/fault-injection/file-seam.mjs'
import {
  createAgentPresetsDouble,
  createAgentsDouble,
  ensureGlueResolvable,
} from './t12a-live-bridge.mjs'
import { TEAM_RUNTIME_ERROR_CODES, TeamRuntimeError } from '../admission/index.js'
import type { TeamRuntimeActionRequest } from '../admission/index.js'
import { RECOVERY_INCIDENT_OPENED_FACT_TYPE, RECOVERY_INCIDENT_CLOSED_FACT_TYPE } from '../requirements/facts.js'

// --- the production glue resolvability (the t12a symlink marker) --------------

ensureGlueResolvable()

// --- identities -----------------------------------------------------------------

const A_ROOT = 'session-mtm-a'
const A_SERVER = 'mtm_srv_a'
const B_ROOT = 'session-mtm-b1'
const B_ROOT2 = 'session-mtm-b2'
const B_SERVER = 'mtm_srv_b'
const E_ROOT = 'session-mtm-e'
const E_SERVER = 'mtm_srv_e'
const D_ROOT = 'session-mtm-d'
const D_SERVER = 'mtm_srv_d'
// The residual worlds (external review of e45d22fe — the two confirmed
// residual-F rulings: R1 the first-mount PENDING window, R2 the
// initial-work cross-root read).
const R1_ROOT = 'session-mtm-r1'
const R1_SERVER = 'mtm_srv_r1'
const R2_ROOT = 'session-mtm-r2'
const R2_ROOT2 = 'session-mtm-r2b'
const R2_SERVER = 'mtm_srv_r2'
// The requirement-aware final-input-verdict legs (external residual round —
// the three problem classes of the bounded report at 4820ecdb): L1 the
// COLD-RESUME gap (class 1), L2 the MESSAGING consumer (class 2), L3 the
// ROOT consumer (class 2), L4a/L4b/L4c the anti-over-block legs (class 3:
// the no-requirement / optional / reviewed-recovery allow shapes).
const L1_ROOT = 'session-mtm-l1'
const L1_SERVER = 'mtm_srv_l1'
const L2_ROOT = 'session-mtm-l2'
const L2_SERVER = 'mtm_srv_l2'
const L3_ROOT = 'session-mtm-l3'
const L3_ROOT2 = 'session-mtm-l3b'
const L3_SERVER = 'mtm_srv_l3'
const L4A_ROOT = 'session-mtm-l4a'
const L4A_SERVER = 'mtm_srv_l4a'
const L4B_ROOT = 'session-mtm-l4b'
const L4B_SERVER = 'mtm_srv_l4b'
const L4C_ROOT = 'session-mtm-l4c'
const L4C_SERVER = 'mtm_srv_l4c'
// The consolidated revision legs (external final bounded re-review of
// 64cd6614 — the three remaining local issues, all within the existing
// frozen matrix): L5 the RENAMED leader template slug (the verdict's
// root classification must use the bound blueprint's ACTUAL leader
// template id, not a literal), L6 the CONTROL-NOTIFICATION liveness
// (the C1 pending-approval channel is the liveness-preserved class —
// never the gated work-input class — while normal root work stays
// gated), L7 the PER-SCOPE recovery identity (a recovery marker exempts
// an occurrence only when it matches BOTH the scope AND the subject of
// that specific occurrence).
const L5_ROOT = 'session-mtm-l5'
const L5_SERVER = 'mtm_srv_l5'
const L6_ROOT = 'session-mtm-l6'
const L6_SERVER = 'mtm_srv_l6'
const L7_ROOT = 'session-mtm-l7'
const L7_SERVER = 'mtm_srv_l7'

// --- the v2 blueprints (template-level required mcpServer) ----------------------

/**
 * One v2 blueprint: the `worker` member template carries the REQUIRED
 * mcpServer subject (the materialization axis under test); `leaderCaps`
 * / `workerCaps` decide which templates' consumption views admit the
 * server (the mount target); `leaderReq` adds the same requirement to
 * the LEADER template (the T4 world).
 */
function mtmBlueprint(
  bpId: string,
  serverName: string,
  opts: {
    workerReq: boolean
    leaderReq: boolean
    leaderCaps: boolean
    workerCaps: boolean
    reqComplete?: boolean
    // Additive revision variants (the consolidated re-review legs):
    // `leaderSlug` renames the LEADER template's templateId (a legal
    // blueprint slug is ANY non-empty string — the L5 P1 leg renames it
    // to `captain`); `teamReq` moves the same required mcpServer into
    // the TEAM scope (the v2 `teamRequirements` block — the L7 P2b leg
    // carries the subject in BOTH scopes); `controlOps` grants the
    // leader envelope the `request-control` op (the L6 P2a leg's direct
    // production control-service trigger).
    leaderSlug?: string
    teamReq?: boolean
    controlOps?: boolean
  },
): string {
  // `indent` = the member-level shift (the leader's template properties sit
  // at 2 spaces; a member item's at 4 — the same block, +2).
  const indent = (lines: string[], by: number): string[] =>
    by === 0 ? lines : lines.map((line) => (line === '' ? line : ' '.repeat(by) + line))
  const capsBlock = (name: string): string[] => [
    'capabilities:',
    '  teamTools:',
    '    kind: allow',
    '    items: []',
    '  builtinToolDeny: []',
    '  skills:',
    '    kind: allow',
    '    items: []',
    '  mcp:',
    '    kind: allow',
    '    items:',
    `      - ${name}`,
  ]
  const reqBlock = (): string[] => [
    'requirements:',
    `  - requirementId: req-mcp-${serverName}`,
    '    type: mcpServer',
    '    subjects:',
    `      - ${serverName}`,
    `    complete: ${opts.reqComplete === false ? 'false' : 'true'}`,
  ]
  const lines: string[] = [
    '---',
    'schemaVersion: 2',
    `blueprintId: ${bpId}`,
    'revision: "1"',
    'leader:',
    `  templateId: ${opts.leaderSlug ?? 'leader'}`,
    `  persona: "You lead the ${bpId} team."`,
    ...(opts.leaderCaps ? indent(capsBlock(serverName), 2) : []),
    ...(opts.leaderReq ? indent(reqBlock(), 2) : []),
    'members:',
    '  - templateId: worker',
    '    displayName: Worker',
    `    persona: "You do the ${bpId} work."`,
    ...(opts.workerCaps ? indent(capsBlock(serverName), 4) : []),
    ...(opts.workerReq ? indent(reqBlock(), 4) : []),
    'requirements: []',
    // The TEAM scope (v2 `teamRequirements` — the L7 P2b leg carries the
    // same required subject in BOTH the team scope and the worker
    // template scope; the distinct requirementId keeps the per-scope
    // occurrences addressable).
    ...(opts.teamReq
      ? [
          'teamRequirements:',
          `  - requirementId: req-team-mcp-${serverName}`,
          '    type: mcpServer',
          '    subjects:',
          `      - ${serverName}`,
          `    complete: ${opts.reqComplete === false ? 'false' : 'true'}`,
        ]
      : ['teamRequirements: []']),
    // The leader's mutation envelope (invariant 36): the work actions'
    // required ops (follow-up → assign-task; create-member → create-member;
    // send-message / report-progress for the member envelopes below).
    'teamEnvelope:',
    '  allow:',
    '    - assign-task',
    '    - create-member',
    '    - send-message',
    '    - report-progress',
    ...(opts.controlOps ? ['    - request-control'] : []),
    '  deny: []',
    'memberEnvelopes:',
    '  - templateId: worker',
    '    envelope:',
    '      allow:',
    '        - send-message',
    '        - report-progress',
    '      deny: []',
    'policyStates:',
    '  - id: default',
    `    description: The ${bpId} default state.`,
    'quotas:',
    '  team:',
    '    maxInstances: 4',
    '    maxConcurrent: 4',
    '  members:',
    '    maxInstances: 4',
    '    maxConcurrent: 4',
    'metadata: {}',
    '---',
    '',
  ]
  return lines.join('\n')
}

const BP_A = mtmBlueprint('mtm.a', A_SERVER, {
  workerReq: true,
  leaderReq: false,
  leaderCaps: true,
  workerCaps: true,
})
const BP_B = mtmBlueprint('mtm.b', B_SERVER, {
  workerReq: true,
  leaderReq: false,
  leaderCaps: true,
  workerCaps: true,
})
const BP_E = mtmBlueprint('mtm.e', E_SERVER, {
  workerReq: false,
  leaderReq: true,
  leaderCaps: true,
  workerCaps: true,
})
const BP_D = mtmBlueprint('mtm.d', D_SERVER, {
  workerReq: true,
  leaderReq: false,
  leaderCaps: true,
  workerCaps: true,
})
// R1 — the first-mount PENDING window: the worker's required mcpServer
// (the member-boundary shape of world A: A mounts healthy, B's own first
// mount fails on its first passage).
const BP_R1 = mtmBlueprint('mtm.r1', R1_SERVER, {
  workerReq: true,
  leaderReq: false,
  leaderCaps: true,
  workerCaps: true,
})
// R2 — the initial-work cross-root read: the LEADER template's required
// mcpServer (the T4 shape — the v2 Leader row's own materialization,
// mounted on the root session), so each root's initial work is gated on
// that root's OWN leader materialization.
const BP_R2 = mtmBlueprint('mtm.r2', R2_SERVER, {
  workerReq: false,
  leaderReq: true,
  leaderCaps: true,
  workerCaps: true,
})
// L1 — the cold-resume gap: the worker's REQUIRED mcpServer (the T1/A
// shape: a live mounted instance whose remount fails after the residency
// drop).
const BP_L1 = mtmBlueprint('mtm.l1', L1_SERVER, {
  workerReq: true,
  leaderReq: false,
  leaderCaps: true,
  workerCaps: true,
})
// L2 — the messaging consumer: the worker's REQUIRED mcpServer (the
// relayed recipient's own materialization gates its first input).
const BP_L2 = mtmBlueprint('mtm.l2', L2_SERVER, {
  workerReq: true,
  leaderReq: false,
  leaderCaps: true,
  workerCaps: true,
})
// L3 — the root consumer: the LEADER template's REQUIRED mcpServer (the
// R2/T4 shape — the root's own leader materialization gates the root's
// initial work).
const BP_L3 = mtmBlueprint('mtm.l3', L3_SERVER, {
  workerReq: false,
  leaderReq: true,
  leaderCaps: true,
  workerCaps: true,
})
// L4a — the anti-over-block (no requirement): the worker consumes the
// server (the mount target) but NO template carries a requirement for it —
// the failed server is OPTIONAL-by-absence (the degraded allow shape).
const BP_L4A = mtmBlueprint('mtm.l4a', L4A_SERVER, {
  workerReq: false,
  leaderReq: false,
  leaderCaps: true,
  workerCaps: true,
})
// L4b — the anti-over-block (optional requirement): the worker carries the
// requirement with `complete: false` (the engine's WARNING verdict — the
// degraded scope, never a block).
const BP_L4B = mtmBlueprint('mtm.l4b', L4B_SERVER, {
  workerReq: true,
  leaderReq: false,
  leaderCaps: true,
  workerCaps: true,
  reqComplete: false,
})
// L4c — the anti-over-block (reviewed recovery): the worker's REQUIRED
// mcpServer (the T2 shape — the human-reviewed recovery re-run must be
// allowed even while the remount keeps failing).
const BP_L4C = mtmBlueprint('mtm.l4c', L4C_SERVER, {
  workerReq: true,
  leaderReq: false,
  leaderCaps: true,
  workerCaps: true,
})
// L5 — P1 (the renamed leader slug): the LEADER template's templateId is
// `captain` (a legal non-`leader` slug) carrying the REQUIRED mcpServer —
// the verdict's root classification must use the bound blueprint's
// ACTUAL leader template id (the same accessor the scope extraction
// uses), never a literal.
const BP_L5 = mtmBlueprint('mtm.l5', L5_SERVER, {
  workerReq: false,
  leaderReq: true,
  leaderCaps: true,
  workerCaps: true,
  leaderSlug: 'captain',
})
// L6 — P2a (the control-notification liveness): the LEADER template's
// REQUIRED mcpServer (the L3/R2 shape) + the leader envelope's
// `request-control` op (the direct production control-service trigger —
// the service fires the leader-approval notification on
// `outcome.created && kind === LEADER_APPROVAL`).
const BP_L6 = mtmBlueprint('mtm.l6', L6_SERVER, {
  workerReq: false,
  leaderReq: true,
  leaderCaps: true,
  workerCaps: true,
  controlOps: true,
})
// L7 — P2b (the per-scope recovery identity): the SAME subject
// REQUIRED in BOTH scopes — the TEAM scope (the v2 `teamRequirements`
// block) and the WORKER template scope — two distinct requirement
// occurrences; a recovery marker covering only ONE scope must not
// exempt the other scope's occurrence.
const BP_L7 = mtmBlueprint('mtm.l7', L7_SERVER, {
  workerReq: true,
  leaderReq: false,
  leaderCaps: true,
  workerCaps: true,
  teamReq: true,
})

// --- the world boot (production host entry + production glue) --------------------

interface MtMWorld {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- the root facade (dynamic surface)
  readonly root: any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- the bridge agents double
  readonly agents: any
  readonly rootSessionId: string
}

async function bootMtmWorld(
  label: string,
  rootSessionId: string,
  blueprintSource: string,
  serverName: string,
  port: number,
  // The bootstrap SEED (the PF-2 never-observed window of the fresh world:
  // no live fiber yet → the seed's truth decides the creation preflight —
  // the canonical v1→v2 first-create shape; the post-boot mask window is
  // live-observed and seed-independent).
  environmentFacts: unknown[] = [
    { domain: 'mcpServer', subject: serverName, available: true, generation: 1 },
  ],
  // The MUTABLE per-server mount-failure map (the world's fault seam — the
  // bridge agents double's `mcpFailures`: a recorded fiber whose
  // `serverName` has an entry REJECTS on await, modeling the real
  // mcpClient fiber's `failOnStartupError` rejection). The map reference
  // is shared: entries added AFTER boot fail only the mounts attempted
  // AFTER the addition (already-mounted fibers are never re-attempted).
  mcpFailures?: Record<string, string>,
): Promise<MtMWorld> {
  const provided: Record<string, unknown> = {}
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- the test Cordis context double
  const ctx: any = {
    get: (name: string) => provided[name],
    provide: (name: string, value: unknown) => {
      provided[name] = value
    },
    effect: (factory: () => () => void, _label?: string) => {
      void factory()
    },
  }
  provided.agents = createAgentsDouble({
    passExplicitAgent: true,
    mcpToolNames: { [serverName]: [`mcp__${serverName}__ping`] },
    ...(mcpFailures !== undefined ? { mcpFailures } : {}),
  })
  // The durable-session truth (the upstream `SessionPersistence.stat`
  // contract, synthesized by the host's sessionPersistence wrapper into
  // the glue's cold-resume `exists` seam): a session is durable from the
  // first `sessions.flush` (the host wrapper's ensureMaterialized) on.
  const persistedSessions = new Set<string>()
  provided.sessions = {
    flush: async (session: unknown) => {
      const record = session as { id?: unknown }
      if (typeof record?.id === 'string') persistedSessions.add(record.id)
      return session
    },
  }
  provided.sessionPersistence = {
    stat: async (id: unknown) => (persistedSessions.has(String(id)) ? { id: String(id) } : undefined),
  }
  provided.agentPresets = createAgentPresetsDouble()
  provided.workspaceRegistry = {
    list: () => [],
    resolveByPath: async () => undefined,
  }
  provided.teamStorageSeam = new FileStorageSeam(scratchDir(`mtm-${label}`))
  // The row's strict `ctx.get('fs')` (the host entry's fail-closed read):
  // the minimal double (no permission rules in these blueprints — the
  // adapter never runs; the service presence is the contract).
  provided.fs = {
    resolve: async (path: unknown) => {
      const key = String(path)
      return { targetKey: `file://${key}`, displayPath: key }
    },
    contains: () => true,
  }
  await hostEntry.apply(
    ctx,
    {
      bootPhase: 'create',
      rootSessionId,
      blueprintSource,
      generation: 1,
      defaultWorkspace: '/data',
      seedMembers: [],
      staticModel: { provider: 'mtm', model: 'mtm-model' },
      deniedSelection: null,
      mcpServer: null,
      mcpServers: [{ name: serverName, port }],
      environmentFacts,
      externalPolicyFacts: { hard: {}, capabilityExists: {} },
    },
  )
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- the root facade
  const root: any = await (provided.teamRoot as { ready: Promise<unknown> }).ready
  return { root, agents: provided.agents, rootSessionId }
}

// --- the action requests ---------------------------------------------------------

let tokenSeq = 0
function tok(): string {
  tokenSeq += 1
  return `mtm-tok-${tokenSeq}`
}

const LEADER_CALLER = { kind: 'instance', instanceId: 'inst-leader' } as const

function followUpRequest(
  rootSessionId: string,
  targetInstanceId: string,
  extra: Partial<TeamRuntimeActionRequest> = {},
): TeamRuntimeActionRequest {
  return {
    rootSessionId,
    action: 'follow-up',
    caller: LEADER_CALLER,
    targetInstanceId,
    requestToken: tok(),
    payload: { prompt: 'mtm work prompt' },
    ...extra,
  }
}

function createMemberRequest(rootSessionId: string, label: string): TeamRuntimeActionRequest {
  return {
    rootSessionId,
    action: 'create-member',
    caller: LEADER_CALLER,
    delegationTemplateId: 'worker',
    payload: { label },
    requestToken: tok(),
  }
}

// --- the outcome / error helpers --------------------------------------------------

interface MemberEffect {
  readonly kind: 'member-activated'
  readonly instanceId: string
  readonly childSessionId: string
}

async function activateMember(world: MtMWorld, label: string): Promise<MemberEffect> {
  const outcome = await world.root.runtime.performAction(createMemberRequest(world.rootSessionId, label))
  const effect = outcome.effect as MemberEffect
  if (effect.kind !== 'member-activated') {
    throw new Error(`mtm: create-member did not activate (effect ${String(effect.kind)})`)
  }
  return effect
}

interface BlockedDetails {
  readonly status: string
  readonly gateReason: string
  readonly blockedScopes: readonly string[]
  readonly unavailableSubjects: readonly string[]
  readonly recoveryDispatchAvailable: boolean
}

/** Assert the typed COMPATIBILITY_BLOCKED throw and return its details. */
async function expectBlocked(
  world: MtMWorld,
  request: TeamRuntimeActionRequest,
  label: string,
): Promise<BlockedDetails> {
  let thrown: unknown
  try {
    await world.root.runtime.performAction(request)
  } catch (error) {
    thrown = error
  }
  if (thrown === undefined) {
    throw new Error(`mtm ${label}: the action was ALLOWED — the target-specific block is missing (the Finding F false OPEN)`)
  }
  expect(thrown).toBeInstanceOf(TeamRuntimeError)
  const typed = thrown as TeamRuntimeError
  expect(typed.code).toBe(TEAM_RUNTIME_ERROR_CODES.COMPATIBILITY_BLOCKED)
  const details = (typed.details ?? {}) as Record<string, unknown>
  return {
    status: String(details['status'] ?? ''),
    gateReason: String(details['gateReason'] ?? ''),
    blockedScopes: Array.isArray(details['blockedScopes']) ? details['blockedScopes'].map(String) : [],
    unavailableSubjects: Array.isArray(details['unavailableSubjects']) ? details['unavailableSubjects'].map(String) : [],
    recoveryDispatchAvailable: details['recoveryDispatchAvailable'] === true,
  }
}

/** Assert the allowed outcome (work admitted) and return the effect. */
async function expectWorkAdmitted(world: MtMWorld, request: TeamRuntimeActionRequest, label: string): Promise<{ instanceId?: string }> {
  const outcome = await world.root.runtime.performAction(request)
  const effect = outcome.effect as { kind: string; instanceId?: string }
  if (effect.kind !== 'work-admitted') {
    throw new Error(`mtm ${label}: the action was not admitted as work (effect ${effect.kind})`)
  }
  return effect
}

// --- state access (the glue's ephemeral consumption state) -----------------------

interface MtMSlot {
  status: string
  attempts?: number
  lastAttemptAt?: number
  reason?: string
}
interface MtMFiber {
  disposed: boolean
  disposeCount: number
  withdrawTools?: () => void
}

function mtmState(world: MtMWorld, sessionId: string): {
  mcpFibers?: Map<string, MtMFiber>
  mcpMaterialization?: Map<string, MtMSlot>
} {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- the glue bundle (dynamic surface)
  const live: any = world.root.live
  const get = live?.getConsumptionState
  if (typeof get !== 'function') throw new Error('mtm: the root surface exposes no live.getConsumptionState')
  return (get.call(live, sessionId) ?? {}) as {
    mcpFibers?: Map<string, MtMFiber>
    mcpMaterialization?: Map<string, MtMSlot>
  }
}

function slotOf(world: MtMWorld, sessionId: string, serverName: string): MtMSlot | undefined {
  return mtmState(world, sessionId).mcpMaterialization?.get(serverName)
}

function fiberOf(world: MtMWorld, sessionId: string, serverName: string): MtMFiber | undefined {
  return mtmState(world, sessionId).mcpFibers?.get(serverName)
}

/** The follow-up deliveries recorded for one session (the zero-work witness). */
function followupsOf(world: MtMWorld, sessionId: string): number {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- the bridge agents double
  const followups: Array<{ sessionId: string }> = (world.agents as any).followups
  return followups.filter((entry) => entry.sessionId === sessionId).length
}

/** The recovery-incident facts of one root (the durable audit line). */
function incidentsOf(world: MtMWorld, rootSessionId: string): Array<{ type: string; scope: string }> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- the domain (dynamic surface)
  const domain: any = world.root.domain
  const out: Array<{ type: string; scope: string }> = []
  for (const entry of domain.repositories.ledger.list()) {
    const record = entry as { rootSessionId?: unknown; factType?: unknown; payload?: { scope?: unknown } }
    if (record.rootSessionId !== rootSessionId) continue
    if (record.factType === RECOVERY_INCIDENT_OPENED_FACT_TYPE || record.factType === RECOVERY_INCIDENT_CLOSED_FACT_TYPE) {
      out.push({ type: String(record.factType), scope: String(record.payload?.scope ?? '') })
    }
  }
  return out
}

function openIncidentOf(world: MtMWorld, rootSessionId: string, scopeKey: string): boolean {
  const rows = incidentsOf(world, rootSessionId)
  const opened = rows.filter((row) => row.type === RECOVERY_INCIDENT_OPENED_FACT_TYPE && row.scope === scopeKey).length
  const closed = rows.filter((row) => row.type === RECOVERY_INCIDENT_CLOSED_FACT_TYPE && row.scope === scopeKey).length
  return opened > closed
}

/**
 * The durable `workOutcome` of one member work token (the fail-closed
 * settlement record: a delivery fault settles `delivery-failed` — the
 * R1 leg asserts the same-passage gate leaves NO fake success and NO
 * fake settlement success behind).
 */
function workOutcomeOf(world: MtMWorld, rootSessionId: string, requestToken: string): string | undefined {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- the domain (dynamic surface)
  const domain: any = world.root.domain
  for (const entry of domain.repositories.ledger.list()) {
    const record = entry as {
      rootSessionId?: unknown
      factType?: unknown
      payload?: { requestToken?: unknown; workOutcome?: unknown }
    }
    if (record.rootSessionId !== rootSessionId) continue
    if (record.factType !== 'member-lifecycle-changed') continue
    if (record.payload?.requestToken !== requestToken) continue
    if (record.payload?.workOutcome !== undefined) return String(record.payload.workOutcome)
  }
  return undefined
}

/**
 * The terminal ROOT-work fact of one token (the delivered record — the
 * R2 leg asserts B's initial work leaves NO root input and NO terminal
 * root-work fact).
 */
function rootWorkDeliveredOf(world: MtMWorld, rootSessionId: string, requestToken: string): { workOutcome: string } | undefined {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- the domain (dynamic surface)
  const domain: any = world.root.domain
  for (const entry of domain.repositories.ledger.list()) {
    const record = entry as {
      rootSessionId?: unknown
      factType?: unknown
      payload?: { requestToken?: unknown; workOutcome?: unknown }
    }
    if (record.rootSessionId !== rootSessionId) continue
    if (record.factType !== 'team-root-work-delivered') continue
    if (record.payload?.requestToken !== requestToken) continue
    return { workOutcome: String(record.payload?.workOutcome ?? '') }
  }
  return undefined
}

/**
 * Whether one durable fact of the given type carrying the given request
 * token exists under the root (the L2/L3 legs: the intent fact / the
 * admission fact / the absence of a confirmation fact).
 */
function factWithToken(
  world: MtMWorld,
  rootSessionId: string,
  factType: string,
  requestToken: string,
): boolean {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- the domain (dynamic surface)
  const domain: any = world.root.domain
  for (const entry of domain.repositories.ledger.list()) {
    const record = entry as {
      rootSessionId?: unknown
      factType?: unknown
      payload?: { requestToken?: unknown }
    }
    if (record.rootSessionId !== rootSessionId) continue
    if (record.factType !== factType) continue
    if (record.payload?.requestToken !== requestToken) continue
    return true
  }
  return false
}

/**
 * Capture the PRODUCTION v2 remote dispatcher through the host's own
 * registration seam (the T8 shape — the exact production wiring: the
 * bound-root guard, the host-derived caller, the per-root bound
 * blueprint). The returned dispatcher drives the v2 commands by name
 * (`team.admitInitialWork`, `member.send`, ...).
 */
function captureRemoteDispatcher(
  world: MtMWorld,
): (endpoint: string, payload: unknown) => Promise<Record<string, unknown>> {
  let dispatcher:
    | ((endpoint: string, payload: unknown) => Promise<Record<string, unknown>>)
    | undefined
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- dynamic seam surface (untyped by design)
  ;(world.root.seams.remoteHandlerRegistration as any).current()({
    rpc: {
      handle: (_channel: string, next: unknown) => {
        dispatcher = next as (endpoint: string, payload: unknown) => Promise<Record<string, unknown>>
        return () => {}
      },
    },
  })
  if (dispatcher === undefined) {
    throw new Error('mtm: the registration never installed a dispatcher')
  }
  return dispatcher
}

// --- the L6 control-notification observation (the fire-and-forget C1 channel) ---

/**
 * The rendered text of every recorded follow-up on one session (the
 * bridge double records the `createUserMessage` object verbatim —
 * `content: [{ type: 'text', text }]`).
 */
function followupTextsOf(world: MtMWorld, sessionId: string): string[] {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- the bridge agents double (dynamic surface)
  const followups: Array<{ sessionId: string; message: unknown }> = (world.agents as any).followups
  return followups
    .filter((entry) => entry.sessionId === sessionId)
    .map((entry) => {
      const message = entry.message as { content?: unknown }
      if (Array.isArray(message?.content)) {
        return (message.content as Array<{ type?: unknown; text?: unknown }>)
          .map((part) => (part?.type === 'text' && typeof part.text === 'string' ? part.text : ''))
          .join('')
      }
      return typeof message === 'string' ? message : ''
    })
}

/**
 * Bounded await over the FIRE-AND-FORGET leader-approval notification
 * (the control service fires `notifyLeaderRequest` without awaiting — a
 * delivery failure is a LIVENESS failure only, swallowed by the
 * service's liveness-failure sink). The L6 leg polls the recorded
 * follow-ups for the rendered `[team-control requestId=...]`
 * notification on the root session; the RED shape is the ABSENCE after
 * the window (the pre-fix gated delivery threw before the first
 * model-visible input and the swallow left the pending-approval leader
 * never notified).
 */
async function waitForControlNotification(
  world: MtMWorld,
  rootSessionId: string,
  timeoutMs = 5000,
): Promise<string | undefined> {
  const t0 = Date.now()
  for (;;) {
    const hit = followupTextsOf(world, rootSessionId).find((text) =>
      text.startsWith('[team-control requestId='),
    )
    if (hit !== undefined) return hit
    if (Date.now() - t0 >= timeoutMs) return undefined
    await new Promise((resolve) => setTimeout(resolve, 20))
  }
}

// ══════════════════════════════════════════════════════════════════════════
// WORLD A — T1 (target-specific gating) + T2 (the scope incident)
// ══════════════════════════════════════════════════════════════════════════

const A = await (async () => {
  destroyDir(scratchDir('mtm-a'))
  const world = await bootMtmWorld('a', A_ROOT, BP_A, A_SERVER, 3991)

  // The two live instances of `worker` (A healthy, B the future loss).
  const instA = await activateMember(world, 'mtm-a-A')
  const instB = await activateMember(world, 'mtm-a-B')

  // THE LIVENESS GUARD (pre-existing semantics, preserved by the fix): a
  // fresh member's FIRST delivery is NOT PENDING-blocked — the leader's
  // own fiber keeps the aggregate `reachable` (the in-flight window is
  // masked, exactly as the B5/PF-2 liveness adjudication requires: PENDING
  // must never be a state only the blocked action itself can settle). The
  // delivery runs the member's own boundary, where the reconcile mounts
  // the server (the materialization axis settles at the target boundary).
  const firstDeliveryA = await expectWorkAdmitted(world, followUpRequest(A_ROOT, instA.instanceId), 'A first delivery (fresh member)')
  const firstDeliveryB = await expectWorkAdmitted(world, followUpRequest(A_ROOT, instB.instanceId), 'B first delivery (fresh member)')

  // Both mounted at their first boundary (the slot is the durable truth
  // of the ephemeral mount — the materialization axis).
  const slotAAtBoot = slotOf(world, instA.childSessionId, A_SERVER)
  const slotBAtBoot = slotOf(world, instB.childSessionId, A_SERVER)

  // The confirmed loss on B (the public-seam withdrawal — the upstream
  // post-budget-exhaustion supervisor effect at the seam level): the
  // tools leave B's scope; the fiber handle stays (F15 L2).
  const fiberB = fiberOf(world, instB.childSessionId, A_SERVER)
  if (fiberB?.withdrawTools === undefined) throw new Error('mtm A: B carries no withdrawable fiber')
  fiberB.withdrawTools()

  // The gate's FRESH probe (this passage) classifies B's loss: the
  // witness retires B's exhausted fiber (slot stamped `failed`) while A's
  // healthy fiber keeps the aggregate `reachable` — the mask.
  const lossProbePassage = await expectWorkAdmitted(
    world,
    followUpRequest(A_ROOT, instA.instanceId),
    'A1 probe passage (follow-up A)',
  )
  const slotBAfterProbe = slotOf(world, instB.childSessionId, A_SERVER)

  // T1 — the follow-up to B: BLOCKED, zero work (no delivery to B's
  // session — the gate blocks before the effect).
  const bFollowupsBefore = followupsOf(world, instB.childSessionId)
  const bBlock = await expectBlocked(world, followUpRequest(A_ROOT, instB.instanceId), 'T1 follow-up B')
  const bFollowupsAfter = followupsOf(world, instB.childSessionId)

  // T1 — the follow-up to A: PASSES (the target's own materialization is
  // mounted — the healthy instance is not masked by the failed sibling).
  const aFollowup = await expectWorkAdmitted(world, followUpRequest(A_ROOT, instA.instanceId), 'T1 follow-up A')

  // T2 — the scope incident: opened on the recovery-allowed passage (the
  // human-reviewed recovery re-run of the blocked follow-up to B — the
  // durable audit record of the scope's down state).
  const recoveryMarker = {
    scopeKeys: ['template:worker'],
    unavailableSubjects: [A_SERVER],
  }
  const recoveryPassage = await expectWorkAdmitted(
    world,
    followUpRequest(A_ROOT, instB.instanceId, { recovery: recoveryMarker }),
    'T2 recovery passage (follow-up B, marker)',
  )
  const incidentOpened = openIncidentOf(world, A_ROOT, 'template:worker')

  // T2 — "fix A only": A keeps working; the scope's own materialization is
  // STILL not satisfied (B failed) → the incident MUST stay open and B
  // MUST stay blocked.
  const aFollowup2 = await expectWorkAdmitted(world, followUpRequest(A_ROOT, instA.instanceId), 'T2 follow-up A (fix A only)')
  const incidentStillOpen = openIncidentOf(world, A_ROOT, 'template:worker')
  const bBlock2 = await expectBlocked(world, followUpRequest(A_ROOT, instB.instanceId), 'T2 follow-up B (still failed)')

  // T2 — "fix B": the server is back; the cooldown is rewound (the test
  // stand-in for the 30 s elapse — the boundary retry is the ADR-15
  // recovery); the recovery passage delivers to B's next boundary, where
  // the reconcile remounts a FRESH fiber (healthy double) → mounted.
  const slotBBeforeFix = slotOf(world, instB.childSessionId, A_SERVER)
  if (slotBBeforeFix === undefined || typeof slotBBeforeFix.lastAttemptAt !== 'number') {
    throw new Error('mtm A: B carries no failed slot to rewind')
  }
  slotBBeforeFix.lastAttemptAt = Date.now() - 61_000
  const recoveryPassage2 = await expectWorkAdmitted(
    world,
    followUpRequest(A_ROOT, instB.instanceId, { recovery: recoveryMarker }),
    'T2 recovery passage 2 (fix B)',
  )
  const slotBAfterFix = slotOf(world, instB.childSessionId, A_SERVER)

  // T2 — the normal follow-up to B now PASSES on the fresh evaluation
  // (mounted) and CLOSES the scope incident (the scope's own
  // materialization is satisfied — all live instances converged).
  const bFollowup = await expectWorkAdmitted(world, followUpRequest(A_ROOT, instB.instanceId), 'T2 follow-up B (converged)')
  const incidentClosed = !openIncidentOf(world, A_ROOT, 'template:worker')
  const closeRows = incidentsOf(world, A_ROOT)
    .filter((row) => row.scope === 'template:worker')
    .filter((row) => row.type === RECOVERY_INCIDENT_CLOSED_FACT_TYPE)

  return {
    world,
    instA,
    instB,
    firstDeliveryA,
    firstDeliveryB,
    slotAAtBoot,
    slotBAtBoot,
    lossProbePassage,
    slotBAfterProbe,
    bBlock,
    bFollowupsBefore,
    bFollowupsAfter,
    aFollowup,
    recoveryPassage,
    incidentOpened,
    aFollowup2,
    incidentStillOpen,
    bBlock2,
    slotBAfterFix,
    recoveryPassage2,
    bFollowup,
    incidentClosed,
    closeRows,
  }
})()

// ══════════════════════════════════════════════════════════════════════════
// WORLD B — T3 (two roots, same templateId — no cross-root conflation)
// ══════════════════════════════════════════════════════════════════════════

const B = await (async () => {
  destroyDir(scratchDir('mtm-b'))
  const world = await bootMtmWorld('b', B_ROOT, BP_B, B_SERVER, 3992)

  // The second team root on the SAME durable domain, bound to the SAME
  // blueprint snapshot (the multi-root host shape — the boot root's row
  // stays the entry's row; the router resolves ANY root in the domain).
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- the domain (dynamic surface)
  const repos: any = world.root.domain.repositories
  const nowIso = new Date().toISOString()
  const ref = repos.teamSessions.get(B_ROOT).blueprint
  await repos.teamSessions.put({
    blueprint: ref,
    createdAt: nowIso,
    defaultWorkspace: '/data',
    generation: 1,
    rootSessionId: B_ROOT2,
  })
  await repos.sessionBindings.put({ kind: 'team-root', schemaVersion: 1, sessionId: B_ROOT2 })
  await repos.memberInstances.put({
    rootSessionId: B_ROOT2,
    instanceId: 'inst-leader',
    templateId: 'leader',
    label: 'mtm-b leader (root 2)',
    createdAt: nowIso,
    activityVersion: 1,
  })

  // A1: the boot root's healthy instance; B2: the second root's instance.
  const instA1 = await activateMember(world, 'mtm-b-A1')
  const b2Outcome = await world.root.runtime.performAction(createMemberRequest(B_ROOT2, 'mtm-b-B2'))
  const instB2 = b2Outcome.effect as MemberEffect
  if (instB2.kind !== 'member-activated') {
    throw new Error(`mtm B: the second-root create-member did not activate (effect ${String(instB2.kind)})`)
  }

  // Both instances mount at their first delivery (the liveness guard: the
  // leader's fiber masks the aggregate `reachable`; no spurious PENDING).
  await expectWorkAdmitted(world, followUpRequest(B_ROOT, instA1.instanceId), 'B1 first delivery (follow-up A1)')
  await expectWorkAdmitted(world, followUpRequest(B_ROOT2, instB2.instanceId), 'B2 first delivery (follow-up B2)')
  const slotA1AtMount = slotOf(world, instA1.childSessionId, B_SERVER)
  const slotB2AtMount = slotOf(world, instB2.childSessionId, B_SERVER)

  // The confirmed loss on B2 (root 2) — the probe (this passage, a
  // follow-up to A1) retires B2's fiber; A1's healthy fiber keeps the
  // aggregate `reachable`.
  const fiberB2 = fiberOf(world, instB2.childSessionId, B_SERVER)
  if (fiberB2?.withdrawTools === undefined) throw new Error('mtm B: B2 carries no withdrawable fiber')
  fiberB2.withdrawTools()
  await expectWorkAdmitted(world, followUpRequest(B_ROOT, instA1.instanceId), 'B1 probe passage (follow-up A1)')
  const slotB2AfterProbe = slotOf(world, instB2.childSessionId, B_SERVER)

  // T3 — the follow-up to B2 (TARGET root 2): BLOCKED on root 2's own
  // failed instance (the boot root's healthy A1 must NOT open it).
  const b2FollowupsBefore = followupsOf(world, instB2.childSessionId)
  const b2Block = await expectBlocked(world, followUpRequest(B_ROOT2, instB2.instanceId), 'T3 follow-up B2')
  const b2FollowupsAfter = followupsOf(world, instB2.childSessionId)

  // T3 — the control: the boot root's A1 keeps working.
  const a1Followup = await expectWorkAdmitted(world, followUpRequest(B_ROOT, instA1.instanceId), 'T3 follow-up A1')

  return { world, instA1, instB2, slotA1AtMount, slotB2AtMount, slotB2AfterProbe, b2Block, b2FollowupsBefore, b2FollowupsAfter, a1Followup }
})()

// ══════════════════════════════════════════════════════════════════════════
// WORLD E — T4 (the v2 Leader template's own materialization)
// ══════════════════════════════════════════════════════════════════════════

const E = await (async () => {
  destroyDir(scratchDir('mtm-e'))
  const world = await bootMtmWorld('e', E_ROOT, BP_E, E_SERVER, 3994)

  // The worker instance mounts the server too (its view admits it) — its
  // healthy fiber keeps the aggregate `reachable` after the Leader's loss
  // (the mask: the aggregate says up, the target boundary says down). The
  // mount happens at the worker's first delivery (the liveness guard).
  const instW = await activateMember(world, 'mtm-e-w')
  await expectWorkAdmitted(world, followUpRequest(E_ROOT, instW.instanceId), 'E first delivery (follow-up worker)')
  const slotWAtMount = slotOf(world, instW.childSessionId, E_SERVER)

  // The Leader IS the root session (the v2 Leader row: no childSessionId)
  // — its fiber lives on the root session (mounted at boot: the leader
  // row is minted before the root agent's setup).
  const slotLeaderAtBoot = slotOf(world, E_ROOT, E_SERVER)
  const fiberLeader = fiberOf(world, E_ROOT, E_SERVER)
  if (fiberLeader?.withdrawTools === undefined) throw new Error('mtm E: the Leader carries no withdrawable fiber')
  fiberLeader.withdrawTools()

  // T4 — the follow-up to the Leader (target instance `inst-leader`):
  // BLOCKED on the Leader's OWN failed materialization (the v2 Leader row
  // resolved through the root session — zero work on the root session).
  const rootFollowupsBefore = followupsOf(world, E_ROOT)
  const leaderBlock = await expectBlocked(world, followUpRequest(E_ROOT, 'inst-leader'), 'T4 follow-up leader')
  const rootFollowupsAfter = followupsOf(world, E_ROOT)

  // T4 — the control: the worker (no requirement on its template) keeps
  // working — the Leader scope does not mask the worker's work.
  const wFollowup = await expectWorkAdmitted(world, followUpRequest(E_ROOT, instW.instanceId), 'T4 follow-up worker')

  return { world, instW, slotWAtMount, slotLeaderAtBoot, leaderBlock, rootFollowupsBefore, rootFollowupsAfter, wFollowup }
})()

// ══════════════════════════════════════════════════════════════════════════
// WORLD D — T5 (the cold member: not-applicable never blocks)
// ══════════════════════════════════════════════════════════════════════════

const D = await (async () => {
  destroyDir(scratchDir('mtm-d'))
  // The bootstrap SEED (available true) — the only pre-observation source:
  // with the single instance COLD (never a live fiber), the probe reads
  // `unknown` + `never-observed` (the PF-2 bootstrap window) and the seed's
  // truth decides — the E.11 negative #1 guard.
  const world = await bootMtmWorld('d', D_ROOT, BP_D, D_SERVER, 3995, [
    { domain: 'mcpServer', subject: D_SERVER, available: true, generation: 1 },
  ])
  const instC = await activateMember(world, 'mtm-d-C')
  // C was never delivered work: the fresh-member window (no slot — the
  // materialization settles only at the first boundary).
  const slotCAtBoot = slotOf(world, instC.childSessionId, D_SERVER)

  // Cold C: drop its RESIDENCY through the glue's own seam (the
  // production cold path — the host-restart-style removal: the live
  // handle leaves the glue's registry, so the materialization port
  // sees the member COLD (`hasLive` false → `not-applicable`) while
  // the session stays durable from the activation barrier — the later
  // delivery RESUMES C through agents.resume, it does not re-create it).
  // A direct double-handle dispose would BYPASS the glue's registry (a
  // stale resident handle would stay "live" — the wrong state for this
  // guard: that is a plugin-internal fault, not the cold member).
  const dropResult: { dropped?: boolean } = await world.root.live.dropResidency(instC.childSessionId)
  if (dropResult.dropped !== true) throw new Error('mtm D: C residency did not drop')

  // T5 — the follow-up to the COLD instance: NOT blocked (the
  // `not-applicable` materialization never blocks — applicability gates
  // before readiness); the delivery resumes C, mounts at the boundary and
  // delivers.
  const cFollowup = await expectWorkAdmitted(world, followUpRequest(D_ROOT, instC.instanceId), 'T5 follow-up cold C')
  const slotCAfterResume = slotOf(world, instC.childSessionId, D_SERVER)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- the bridge agents double
  const cResumes: Array<{ sessionId: string }> = (world.agents as any).resumes
  const cResumed = cResumes.some((entry) => entry.sessionId === instC.childSessionId)

  return { world, instC, slotCAtBoot, cFollowup, slotCAfterResume, cResumed }
})()

// ══════════════════════════════════════════════════════════════════════════
// WORLD R1 — T7 (external residual-1: the first-mount PENDING window —
// the mount attempt is admissible; a same-passage failed first mount
// must deliver ZERO work on THAT passage)
// ══════════════════════════════════════════════════════════════════════════

const R1 = await (async () => {
  destroyDir(scratchDir('mtm-r1'))
  // The MUTABLE per-server failure map (the world's fault seam — the
  // bridge double's `mcpFailures`, keyed by serverName: a recorded fiber
  // whose server has an entry REJECTS on await — the real mcpClient
  // fiber's `failOnStartupError` shape). EMPTY at boot: A mounts healthy
  // at its first boundary; the entry is added AFTER A's mount and BEFORE
  // B's first follow-up (B's own first mount then fails on that passage).
  const mcpFailures: Record<string, string> = {}
  const world = await bootMtmWorld('r1', R1_ROOT, BP_R1, R1_SERVER, 3997, undefined, mcpFailures)

  const instA = await activateMember(world, 'mtm-r1-A')
  const instB = await activateMember(world, 'mtm-r1-B')

  // A healthy + MOUNTED (its first delivery runs the boundary reconcile;
  // the failure map is still empty → the mount succeeds).
  await expectWorkAdmitted(world, followUpRequest(R1_ROOT, instA.instanceId), 'R1 A first delivery (mount)')
  const slotAAtMount = slotOf(world, instA.childSessionId, R1_SERVER)
  // B FRESH: no slot yet — the first-mount PENDING window (B's
  // materialization settles only at B's own first boundary; the U4
  // liveness shape: masked `pending` → admissible, never a blanket
  // block).
  const slotBAtBoot = slotOf(world, instB.childSessionId, R1_SERVER)

  // THE FAULT: B's own first mount will fail on its first passage (set
  // AFTER A's mount — the shared map reference is read at MOUNT time, so
  // the already-mounted A is never re-attempted; B's first attempt hits
  // the failure).
  mcpFailures[R1_SERVER] = 'mtm-r1: B first-mount failure (the external residual-1 fault)'

  // THE RESIDUAL LEG: B's first follow-up. Admission consults the
  // PRE-attempt `pending` (A's healthy mount keeps the aggregate
  // `reachable` — the admissible bootstrap shape). The delivery's prepare
  // runs B's own boundary reconcile, where B's OWN mount attempt fails
  // and stamps the slot `failed`. Contract (the applicable
  // materialization must succeed BEFORE real work): the SAME passage
  // must deliver ZERO model-visible input (the pre-fix window delivered
  // the follow-up on the very passage that failed the first mount).
  const bRequest = followUpRequest(R1_ROOT, instB.instanceId)
  const bFollowupsBefore = followupsOf(world, instB.childSessionId)
  let bThrown: unknown
  try {
    await world.root.runtime.performAction(bRequest)
  } catch (error) {
    bThrown = error
  }
  const bFollowupsAfter = followupsOf(world, instB.childSessionId)
  const slotBAfterPassage = slotOf(world, instB.childSessionId, R1_SERVER)
  const bWorkOutcome = workOutcomeOf(world, R1_ROOT, String(bRequest.requestToken))

  // THE NEXT PASSAGE: B is now gated as `failed` at ADMISSION (the feed's
  // failed → DOWN — the T1 shape on the passage after the window).
  const bBlockNext = await expectBlocked(world, followUpRequest(R1_ROOT, instB.instanceId), 'R1 next-passage follow-up B (gated as failed)')

  // THE CONTROL: A keeps working (the healthy sibling is not masked; the
  // already-mounted fiber is never re-attempted against the failure map).
  const aFollowup = await expectWorkAdmitted(world, followUpRequest(R1_ROOT, instA.instanceId), 'R1 control follow-up A')

  return {
    world,
    instA,
    instB,
    slotAAtMount,
    slotBAtBoot,
    bRequest,
    bThrown,
    bFollowupsBefore,
    bFollowupsAfter,
    slotBAfterPassage,
    bWorkOutcome,
    bBlockNext,
    aFollowup,
  }
})()

// ══════════════════════════════════════════════════════════════════════════
// WORLD R2 — T8 (external residual-2: the initial-work cross-root read —
// root B's initial work must be gated on B OWN failed leader
// materialization, never the boot root A's healthy one)
// ══════════════════════════════════════════════════════════════════════════

const R2 = await (async () => {
  destroyDir(scratchDir('mtm-r2'))
  const mcpFailures: Record<string, string> = {}
  const world = await bootMtmWorld('r2', R2_ROOT, BP_R2, R2_SERVER, 3998, undefined, mcpFailures)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- the domain (dynamic surface)
  const repos: any = world.root.domain.repositories

  // Root A (the boot root): the v2 Leader's fiber is mounted on the ROOT
  // session at boot (the leader mounts config.rootPresetId — the T4
  // shape; A = healthy/mounted throughout this world).
  const slotLeaderAAtBoot = slotOf(world, R2_ROOT, R2_SERVER)

  // Root B (the second OWNED root — the T3 multi-root host shape): the
  // durable rows with the SAME blueprint snapshot (same leader template)
  // + the production leader-row shape (childSessionId = the root session:
  // the v2 Leader IS the root session).
  const nowIso = new Date().toISOString()
  const blueprint = repos.teamSessions.get(R2_ROOT).blueprint
  await repos.teamSessions.put({
    blueprint,
    createdAt: nowIso,
    defaultWorkspace: '/data',
    generation: 1,
    rootSessionId: R2_ROOT2,
  })
  await repos.sessionBindings.put({ kind: 'team-root', schemaVersion: 1, sessionId: R2_ROOT2 })
  await repos.memberInstances.put({
    rootSessionId: R2_ROOT2,
    instanceId: 'inst-leader',
    templateId: 'leader',
    label: 'mtm-r2 leader (root B)',
    childSessionId: R2_ROOT2,
    lifecycle: 'RUNNING',
    createdAt: nowIso,
    activityVersion: 1,
  })

  // THE FAULT: B's Leader mount (the root agent's setup reconcile) will
  // fail — set BEFORE B's root agent is created, so the first mount on
  // B's root session hits the failure.
  mcpFailures[R2_SERVER] = 'mtm-r2: root-B leader first-mount failure (the external residual-2 fault)'
  await world.root.live.createRootAgent(R2_ROOT2)
  const slotLeaderBAfterCreate = slotOf(world, R2_ROOT2, R2_SERVER)

  // THE RESIDUAL LEG: B's INITIAL WORK — driven through the PRODUCTION
  // v2 remote command (`team.admitInitialWork`): the captured S6
  // dispatcher is the exact production wiring — the bound-root guard
  // (B is durably owned, asserted above), the host-derived caller, the
  // TARGET team's bound blueprint, and the plan §15.8 closure (the
  // Phase A gate with the read-seam wrappers + the two-fact scanner +
  // the live Root input seam). Contract (the applicable
  // materialization before work + affected scopes only): B's delivery
  // decision uses B's OWN leader materialization; nothing from root
  // A's healthy state may permit B's work (the pre-fix wrapper read
  // the BOOT root's leader materialization and permitted B's initial
  // work — the cross-root false OPEN).
  let remoteDispatcher:
    | ((endpoint: string, payload: unknown) => Promise<Record<string, unknown>>)
    | undefined
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- dynamic seam surface (untyped by design)
  ;(world.root.seams.remoteHandlerRegistration as any).current()({
    rpc: {
      handle: (_channel: string, dispatcher: unknown) => {
        remoteDispatcher = dispatcher as (
          endpoint: string,
          payload: unknown,
        ) => Promise<Record<string, unknown>>
        return () => {}
      },
    },
  })
  if (remoteDispatcher === undefined) {
    throw new Error('mtm R2: the registration never installed a dispatcher')
  }
  const rootBFollowupsBefore = followupsOf(world, R2_ROOT2)
  const bInitialWorkToken = tok()
  const bInitialWorkResponse: Record<string, unknown> = await remoteDispatcher(
    'team.admitInitialWork',
    {
      version: 2,
      params: { rootSessionId: R2_ROOT2, requestToken: bInitialWorkToken, prompt: 'mtm-r2 initial work' },
    },
  )
  const rootBFollowupsAfter = followupsOf(world, R2_ROOT2)
  const bRootWorkDelivered = rootWorkDeliveredOf(world, R2_ROOT2, bInitialWorkToken)
  const slotLeaderAAfter = slotOf(world, R2_ROOT, R2_SERVER)

  // THE RECOVERY STAYS TYPED/OPEN FOR B: no incident closure under B's
  // root for the leader scope (A's health settled nothing on B) and no
  // incident rows under A at all (A is not involved).
  const incidentB = incidentsOf(world, R2_ROOT2).filter((row) => row.scope === 'template:leader')
  const incidentA = incidentsOf(world, R2_ROOT).filter((row) => row.scope === 'template:leader')

  return {
    world,
    slotLeaderAAtBoot,
    slotLeaderBAfterCreate,
    bInitialWorkToken,
    bInitialWorkResponse,
    rootBFollowupsBefore,
    rootBFollowupsAfter,
    bRootWorkDelivered,
    slotLeaderAAfter,
    incidentB,
    incidentA,
  }
})()

// ══════════════════════════════════════════════════════════════════════════
// WORLD L1 — L1 (residual class 1: the COLD-RESUME gap — the verdict must
// read the FINAL required-truth AFTER the full ensure/resume/prepare
// sequence, never an attempt-clock delta)
// ══════════════════════════════════════════════════════════════════════════

const L1 = await (async () => {
  destroyDir(scratchDir('mtm-l1'))
  const mcpFailures: Record<string, string> = {}
  const world = await bootMtmWorld('l1', L1_ROOT, BP_L1, L1_SERVER, 3999, undefined, mcpFailures)

  const instA = await activateMember(world, 'mtm-l1-A')
  const instB = await activateMember(world, 'mtm-l1-B')

  // Both healthy + mounted at their first boundary (the failure map is
  // still empty — the mounts succeed).
  await expectWorkAdmitted(world, followUpRequest(L1_ROOT, instA.instanceId), 'L1 A first delivery (mount)')
  const slotAAtMount = slotOf(world, instA.childSessionId, L1_SERVER)
  await expectWorkAdmitted(world, followUpRequest(L1_ROOT, instB.instanceId), 'L1 B first delivery (mount)')
  const slotBAtMount = slotOf(world, instB.childSessionId, L1_SERVER)

  // THE COLD SEAM: B's residency is dropped (the liveness-only removal —
  // the durable row survives; the materialization port then sees the
  // member COLD (`hasLive` false → `not-applicable` — the T5 shape), so
  // the admission gate ADMIPTS the next passage (the stale truth carries
  // no fresh failure).
  const drop = await world.root.live.dropResidency(instB.childSessionId)
  const slotBAfterDrop = slotOf(world, instB.childSessionId, L1_SERVER)

  // THE FAULT: B's REMOUNT (the cold-resume setup reconcile) will fail.
  mcpFailures[L1_SERVER] = 'mtm-l1: B cold-resume remount failure (the external class-1 fault)'

  // THE RESIDUAL LEG: B's follow-up. The admission sees the cold / stale
  // truth (no fresh failure yet — the remount has not run) and admits.
  // The resume runs the setup reconcile on a FRESH consumption state,
  // where the remount attempt FAILS and stamps the slot `failed`; the
  // prepare's cooldown SKIP leaves the attempt clock untouched, so the
  // pre-fix SAME-PASSAGE gate (the attempt-clock delta) reports nothing —
  // the pre-fix delivery reaches B. The requirement-aware final-input
  // verdict must read the FINAL failed slot (the required server's
  // materialization is failed after the full ensure/resume/prepare
  // sequence) and block BEFORE the first model-visible input.
  const bRequest = followUpRequest(L1_ROOT, instB.instanceId)
  const bFollowupsBefore = followupsOf(world, instB.childSessionId)
  let bThrown: unknown
  try {
    await world.root.runtime.performAction(bRequest)
  } catch (error) {
    bThrown = error
  }
  const bFollowupsAfter = followupsOf(world, instB.childSessionId)
  const slotBAfterPassage = slotOf(world, instB.childSessionId, L1_SERVER)
  const bWorkOutcome = workOutcomeOf(world, L1_ROOT, String(bRequest.requestToken))

  // THE NEXT PASSAGE: B is gated as `failed` at admission (the feed's
  // failed → DOWN — the T1 shape on the passage after the window).
  const bBlockNext = await expectBlocked(world, followUpRequest(L1_ROOT, instB.instanceId), 'L1 next-passage follow-up B (gated as failed)')

  // THE CONTROL: A keeps working (the healthy sibling is not masked).
  const aFollowup = await expectWorkAdmitted(world, followUpRequest(L1_ROOT, instA.instanceId), 'L1 control follow-up A')

  return {
    world,
    instA,
    instB,
    drop,
    slotAAtMount,
    slotBAtMount,
    slotBAfterDrop,
    bRequest,
    bThrown,
    bFollowupsBefore,
    bFollowupsAfter,
    slotBAfterPassage,
    bWorkOutcome,
    bBlockNext,
    aFollowup,
  }
})()

// ══════════════════════════════════════════════════════════════════════════
// WORLD L2 — L2 (residual class 2: the MESSAGING consumer — the
// coordinator's attributed-input path must consume the final-input verdict)
// ══════════════════════════════════════════════════════════════════════════

const L2 = await (async () => {
  destroyDir(scratchDir('mtm-l2'))
  const mcpFailures: Record<string, string> = {}
  const world = await bootMtmWorld('l2', L2_ROOT, BP_L2, L2_SERVER, 4000, undefined, mcpFailures)

  const instA = await activateMember(world, 'mtm-l2-A')
  const instB = await activateMember(world, 'mtm-l2-B')

  // A healthy + mounted (the mask shape: the aggregate `reachable` keeps
  // the fresh B admissible — the T7 admission shape).
  await expectWorkAdmitted(world, followUpRequest(L2_ROOT, instA.instanceId), 'L2 A first delivery (mount)')
  const slotAAtMount = slotOf(world, instA.childSessionId, L2_SERVER)
  // B FRESH: never mounted (no slot — the masked pending shape).
  const slotBAtBoot = slotOf(world, instB.childSessionId, L2_SERVER)

  // THE FAULT: B's first mount (the delivery's boundary reconcile) will
  // fail.
  mcpFailures[L2_SERVER] = 'mtm-l2: B first-mount failure on the messaging passage (the external class-2 fault)'

  // THE RESIDUAL LEG: the leader RELAYS a message to B through the
  // PRODUCTION v2 remote command (`member.send` — the coordinator's
  // facade admission + durable intent fact + LIVE attributed-input
  // delivery + confirmation fact). The admission gates the fresh (masked
  // pending) target and ADMIPTS; the coordinator commits the durable
  // `team-coordination-recorded` intent and delivers — whose prepare runs
  // B's own boundary reconcile (the first mount, FAILED). The pre-fix
  // submitAttributedInput IGNORES the prepare result and hands the input
  // to B's inbox. The requirement-aware final-input verdict must block
  // (the required server's materialization is failed BEFORE the first
  // model-visible input): the coordinator maps the rejection to
  // MESSAGING_DELIVERY_FAILED and the intent stays pending (R2/R3: the
  // coordination is recoverable — NO confirmation fact).
  const dispatcher = captureRemoteDispatcher(world)
  const sendToken = tok()
  const bFollowupsBefore = followupsOf(world, instB.childSessionId)
  const sendResponse: Record<string, unknown> = await dispatcher('member.send', {
    version: 2,
    params: {
      teamSessionId: L2_ROOT,
      caller: { kind: 'instance', instanceId: 'inst-leader' },
      recipientInstanceId: instB.instanceId,
      body: 'mtm-l2 relay body (the class-2 messaging leg)',
      subject: 'mtm-l2',
      requestToken: sendToken,
    },
  })
  const bFollowupsAfter = followupsOf(world, instB.childSessionId)
  const slotBAfter = slotOf(world, instB.childSessionId, L2_SERVER)
  const intentRecorded = factWithToken(world, L2_ROOT, 'team-coordination-recorded', sendToken)
  const confirmationRecorded = factWithToken(world, L2_ROOT, 'team-message-delivered', sendToken)

  // THE CONTROL: A keeps working (the healthy sibling is not masked).
  const aFollowup = await expectWorkAdmitted(world, followUpRequest(L2_ROOT, instA.instanceId), 'L2 control follow-up A')

  return {
    world,
    instA,
    instB,
    slotAAtMount,
    slotBAtBoot,
    sendToken,
    sendResponse,
    bFollowupsBefore,
    bFollowupsAfter,
    slotBAfter,
    intentRecorded,
    confirmationRecorded,
    aFollowup,
  }
})()

// ══════════════════════════════════════════════════════════════════════════
// WORLD L3 — L3 (residual class 2: the ROOT consumer — the root initial
// work's input path must consume the final-input verdict; the admission
// reads the stale cold truth and admits, the failure stands at the
// boundary)
// ══════════════════════════════════════════════════════════════════════════

const L3 = await (async () => {
  destroyDir(scratchDir('mtm-l3'))
  const mcpFailures: Record<string, string> = {}
  const world = await bootMtmWorld('l3', L3_ROOT, BP_L3, L3_SERVER, 4001, undefined, mcpFailures)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- the domain (dynamic surface)
  const repos: any = world.root.domain.repositories

  // Root A (the boot root): the v2 Leader's fiber is mounted on the ROOT
  // session at boot (the T4 shape; A = healthy/mounted throughout).
  const slotLeaderAAtBoot = slotOf(world, L3_ROOT, L3_SERVER)

  // Root B (the second OWNED root — the R2 multi-root host shape): the
  // durable rows with the SAME blueprint snapshot (same leader template)
  // + the production leader-row shape (childSessionId = the root session:
  // the v2 Leader IS the root session).
  const nowIso = new Date().toISOString()
  const blueprint = repos.teamSessions.get(L3_ROOT).blueprint
  await repos.teamSessions.put({
    blueprint,
    createdAt: nowIso,
    defaultWorkspace: '/data',
    generation: 1,
    rootSessionId: L3_ROOT2,
  })
  await repos.sessionBindings.put({ kind: 'team-root', schemaVersion: 1, sessionId: L3_ROOT2 })
  await repos.memberInstances.put({
    rootSessionId: L3_ROOT2,
    instanceId: 'inst-leader',
    templateId: 'leader',
    label: 'mtm-l3 leader (root B)',
    childSessionId: L3_ROOT2,
    lifecycle: 'RUNNING',
    createdAt: nowIso,
    activityVersion: 1,
  })

  // B's root agent starts HEALTHY (the failure map is still empty — the
  // first mount succeeds).
  await world.root.live.createRootAgent(L3_ROOT2)
  const slotLeaderBAtCreate = slotOf(world, L3_ROOT2, L3_SERVER)

  // THE COLD SEAM: B's residency is dropped (the liveness-only removal —
  // the materialization port then sees the root COLD: `hasLive` false →
  // `not-applicable`; the admission gate ADMIPTS — the "cleared by
  // recheck" shape: the stale truth carries no fresh failure).
  const drop = await world.root.live.dropResidency(L3_ROOT2)
  const slotLeaderBAfterDrop = slotOf(world, L3_ROOT2, L3_SERVER)

  // THE FAULT: B's remount (the cold-resume setup reconcile) will fail.
  mcpFailures[L3_SERVER] = 'mtm-l3: root-B leader remount failure (the external class-1/class-2 root fault)'

  // THE RESIDUAL LEG: B's INITIAL WORK through the PRODUCTION v2 remote
  // command (`team.admitInitialWork`). Phase A's gate reads the cold /
  // stale truth and ADMIPTS (the durable `team-work-admitted` fact);
  // Phase B's delivery resumes B's root agent (the FRESH consumption
  // state), whose setup reconcile stamps the remount failure; the
  // prepare's cooldown SKIP leaves the attempt clock untouched; the
  // pre-fix deliverRootInput IGNORES the prepare result and delivers the
  // root input. The requirement-aware final-input verdict must block
  // BEFORE the first model-visible input: the strategy maps the
  // rejection to WORK_DELIVERY_FAILED (the remote code
  // TEAM_CREATE_ROOT_WORK_DELIVERY_FAILED) and KEEPS the durable
  // admission for the same-token retry (NO terminal
  // `team-root-work-delivered` fact).
  const dispatcher = captureRemoteDispatcher(world)
  const bInitialWorkToken = tok()
  const rootBFollowupsBefore = followupsOf(world, L3_ROOT2)
  const bInitialWorkResponse: Record<string, unknown> = await dispatcher('team.admitInitialWork', {
    version: 2,
    params: { rootSessionId: L3_ROOT2, requestToken: bInitialWorkToken, prompt: 'mtm-l3 initial work' },
  })
  const rootBFollowupsAfter = followupsOf(world, L3_ROOT2)
  const bWorkAdmitted = factWithToken(world, L3_ROOT2, 'team-work-admitted', bInitialWorkToken)
  const bRootWorkDelivered = rootWorkDeliveredOf(world, L3_ROOT2, bInitialWorkToken)
  const slotLeaderBAfter = slotOf(world, L3_ROOT2, L3_SERVER)
  const slotLeaderAAfter = slotOf(world, L3_ROOT, L3_SERVER)

  return {
    world,
    slotLeaderAAtBoot,
    slotLeaderBAtCreate,
    drop,
    slotLeaderBAfterDrop,
    bInitialWorkToken,
    bInitialWorkResponse,
    rootBFollowupsBefore,
    rootBFollowupsAfter,
    bWorkAdmitted,
    bRootWorkDelivered,
    slotLeaderBAfter,
    slotLeaderAAfter,
  }
})()

// ══════════════════════════════════════════════════════════════════════════
// WORLD L4A — L4a (residual class 3: the anti-over-block — the NO-
// REQUIREMENT allow shape: a failed policy-allowed server with no
// requirement degrades, never blocks)
// ══════════════════════════════════════════════════════════════════════════

const L4A = await (async () => {
  destroyDir(scratchDir('mtm-l4a'))
  const mcpFailures: Record<string, string> = {}
  const world = await bootMtmWorld('l4a', L4A_ROOT, BP_L4A, L4A_SERVER, 4002, undefined, mcpFailures)

  const instA = await activateMember(world, 'mtm-l4a-A')
  const instB = await activateMember(world, 'mtm-l4a-B')

  // A healthy + mounted (the mask shape).
  await expectWorkAdmitted(world, followUpRequest(L4A_ROOT, instA.instanceId), 'L4a A first delivery (mount)')
  const slotAAtMount = slotOf(world, instA.childSessionId, L4A_SERVER)

  // THE FAULT: B's first mount (its own first passage) will fail.
  mcpFailures[L4A_SERVER] = 'mtm-l4a: B first-mount failure (the over-block fault — the server carries NO requirement)'

  // THE ANTI-OVER-BLOCK LEG: the failed server carries NO requirement
  // (the blueprint declares none anywhere — the worker template's scope
  // has an empty requirement set; the team scope is empty too). The
  // pre-fix SAME-PASSAGE gate blocks EVERY policy-allowed target's
  // same-passage failure (requirement-blind); the requirement-aware
  // final-input verdict must DEGRADE (allow): the optional / no-
  // requirement outage never blocks — the work is delivered WITH the
  // server down (the slot is the failed truth; the degradation is real).
  const bRequest = followUpRequest(L4A_ROOT, instB.instanceId)
  const bFollowupsBefore = followupsOf(world, instB.childSessionId)
  let bOutcome: { instanceId?: string } | undefined
  let bThrown: unknown
  try {
    bOutcome = await expectWorkAdmitted(world, bRequest, 'L4a B follow-up (no requirement — must degrade, never block)')
  } catch (error) {
    bThrown = error
  }
  const bFollowupsAfter = followupsOf(world, instB.childSessionId)
  const slotBAfter = slotOf(world, instB.childSessionId, L4A_SERVER)

  return {
    world,
    instA,
    instB,
    slotAAtMount,
    bRequest,
    bOutcome,
    bThrown,
    bFollowupsBefore,
    bFollowupsAfter,
    slotBAfter,
  }
})()

// ══════════════════════════════════════════════════════════════════════════
// WORLD L4B — L4b (residual class 3: the anti-over-block — the OPTIONAL
// requirement (`complete: false`) allow shape: the engine's WARNING
// verdict degrades, never blocks)
// ══════════════════════════════════════════════════════════════════════════

const L4B = await (async () => {
  destroyDir(scratchDir('mtm-l4b'))
  const mcpFailures: Record<string, string> = {}
  const world = await bootMtmWorld('l4b', L4B_ROOT, BP_L4B, L4B_SERVER, 4003, undefined, mcpFailures)

  const instA = await activateMember(world, 'mtm-l4b-A')
  const instB = await activateMember(world, 'mtm-l4b-B')

  // A healthy + mounted (the mask shape).
  await expectWorkAdmitted(world, followUpRequest(L4B_ROOT, instA.instanceId), 'L4b A first delivery (mount)')
  const slotAAtMount = slotOf(world, instA.childSessionId, L4B_SERVER)

  // THE FAULT: B's first mount (its own first passage) will fail.
  mcpFailures[L4B_SERVER] = 'mtm-l4b: B first-mount failure (the over-block fault — the requirement is OPTIONAL)'

  // THE ANTI-OVER-BLOCK LEG: the failed server carries an OPTIONAL
  // requirement (`complete: false` — the engine's WARNING verdict, the
  // degraded scope). The pre-fix SAME-PASSAGE gate blocks EVERY
  // policy-allowed target's same-passage failure (requirement-blind);
  // the requirement-aware final-input verdict must DEGRADE (allow): an
  // optional outage degrades, never blocks — the work is delivered WITH
  // the server down.
  const bRequest = followUpRequest(L4B_ROOT, instB.instanceId)
  const bFollowupsBefore = followupsOf(world, instB.childSessionId)
  let bOutcome: { instanceId?: string } | undefined
  let bThrown: unknown
  try {
    bOutcome = await expectWorkAdmitted(world, bRequest, 'L4b B follow-up (optional requirement — must degrade, never block)')
  } catch (error) {
    bThrown = error
  }
  const bFollowupsAfter = followupsOf(world, instB.childSessionId)
  const slotBAfter = slotOf(world, instB.childSessionId, L4B_SERVER)

  return {
    world,
    instA,
    instB,
    slotAAtMount,
    bRequest,
    bOutcome,
    bThrown,
    bFollowupsBefore,
    bFollowupsAfter,
    slotBAfter,
  }
})()

// ══════════════════════════════════════════════════════════════════════════
// WORLD L4C — L4c (residual class 3: the anti-over-block — the REVIEWED
// RECOVERY allow shape: the human-reviewed recovery re-run (the `recovery`
// marker) must be allowed even while the remount keeps failing)
// ══════════════════════════════════════════════════════════════════════════

const L4C = await (async () => {
  destroyDir(scratchDir('mtm-l4c'))
  const mcpFailures: Record<string, string> = {}
  const world = await bootMtmWorld('l4c', L4C_ROOT, BP_L4C, L4C_SERVER, 4004, undefined, mcpFailures)

  const instA = await activateMember(world, 'mtm-l4c-A')
  const instB = await activateMember(world, 'mtm-l4c-B')

  // Both healthy + mounted at their first boundary (the failure map is
  // still empty — the mounts succeed).
  await expectWorkAdmitted(world, followUpRequest(L4C_ROOT, instA.instanceId), 'L4c A first delivery (mount)')
  await expectWorkAdmitted(world, followUpRequest(L4C_ROOT, instB.instanceId), 'L4c B first delivery (mount)')
  const slotBAtMount = slotOf(world, instB.childSessionId, L4C_SERVER)

  // THE FAULT: B's remount will keep failing (the PERSISTENT outage —
  // unlike T2, the server never comes back in this world).
  mcpFailures[L4C_SERVER] = 'mtm-l4c: B remount failure (the persistent reviewed-recovery fault)'
  // The confirmed loss on B (the T1 shape — the public-seam withdrawal:
  // the tools leave B's scope; the fiber handle stays).
  const fiberB = fiberOf(world, instB.childSessionId, L4C_SERVER)
  if (fiberB?.withdrawTools === undefined) throw new Error('mtm L4c: B carries no withdrawable fiber')
  fiberB.withdrawTools()

  // The gate's FRESH probe (this passage) classifies B's loss: the
  // witness retires B's exhausted fiber (slot stamped `failed`) while A's
  // healthy fiber keeps the aggregate `reachable` — the mask.
  await expectWorkAdmitted(world, followUpRequest(L4C_ROOT, instA.instanceId), 'L4c probe passage (follow-up A)')
  const slotBAfterProbe = slotOf(world, instB.childSessionId, L4C_SERVER)

  // The cooldown rewind (the test stand-in for the 30 s elapse — the
  // boundary retry is admissible at the next passage).
  if (slotBAfterProbe === undefined || typeof slotBAfterProbe.lastAttemptAt !== 'number') {
    throw new Error('mtm L4c: B carries no failed slot to rewind')
  }
  slotBAfterProbe.lastAttemptAt = Date.now() - 61_000

  // THE ANTI-OVER-BLOCK LEG: the HUMAN-REVIEWED recovery re-run of the
  // blocked follow-up to B (the `recovery` marker — the router's recovery
  // dispatch shape, T2). The gate allows the recovery work (the reviewed
  // scope — the durable `recovery-incident-opened` record); the delivery's
  // prepare re-attempts the remount (past cooldown) and it FAILS AGAIN
  // (the persistent fault — the slot stays `failed`, the attempt clock
  // advances on this passage). The pre-fix SAME-PASSAGE gate blocks the
  // reviewed recovery (the over-block: it fires on EVERY policy-allowed
  // target's same-passage failure — requirement-blind AND recovery-
  // blind); the requirement-aware final-input verdict must EXEMPT the
  // reviewed scope (the marker names the unavailable subject) and
  // deliver — the recovery re-run is the human's decision, not the gate's.
  const recoveryMarker = {
    scopeKeys: ['template:worker'],
    unavailableSubjects: [L4C_SERVER],
  }
  const bRequest = followUpRequest(L4C_ROOT, instB.instanceId, { recovery: recoveryMarker })
  const bFollowupsBefore = followupsOf(world, instB.childSessionId)
  let bOutcome: { instanceId?: string } | undefined
  let bThrown: unknown
  try {
    bOutcome = await expectWorkAdmitted(world, bRequest, 'L4c recovery passage (reviewed scope — must be allowed)')
  } catch (error) {
    bThrown = error
  }
  const bFollowupsAfter = followupsOf(world, instB.childSessionId)
  const slotBAfterRecovery = slotOf(world, instB.childSessionId, L4C_SERVER)
  const incidentOpened = openIncidentOf(world, L4C_ROOT, 'template:worker')

  return {
    world,
    instA,
    instB,
    slotBAtMount,
    slotBAfterProbe,
    bRequest,
    bOutcome,
    bThrown,
    bFollowupsBefore,
    bFollowupsAfter,
    slotBAfterRecovery,
    incidentOpened,
  }
})()

// ══════════════════════════════════════════════════════════════════════════
// WORLD L5 — the consolidated re-review, P1 (the renamed leader slug —
// the verdict's root classification must use the bound blueprint's
// ACTUAL leader template id, not a hardcoded literal)
// ══════════════════════════════════════════════════════════════════════════

const L5 = await (async () => {
  destroyDir(scratchDir('mtm-l5'))
  const mcpFailures: Record<string, string> = {}
  const world = await bootMtmWorld('l5', L5_ROOT, BP_L5, L5_SERVER, 4005, undefined, mcpFailures)

  // The boot root's leader (the RENAMED template — templateId
  // `captain`) is mounted (healthy) on the root session at boot.
  const slotLeaderAtBoot = slotOf(world, L5_ROOT, L5_SERVER)

  // THE COLD SEAM: the leader's residency is dropped (the liveness-only
  // removal — the materialization port then sees the root COLD: the
  // stale truth carries no fresh failure → the admission gate ADMIPTS).
  const drop = await world.root.live.dropResidency(L5_ROOT)
  const slotLeaderAfterDrop = slotOf(world, L5_ROOT, L5_SERVER)

  // THE FAULT: the remount (the cold-resume setup reconcile) will fail.
  mcpFailures[L5_SERVER] = 'mtm-l5: leader remount failure (the renamed-slug fault)'

  // THE LEG: the root's INITIAL WORK through the PRODUCTION v2 remote
  // command (`team.admitInitialWork`) — the L3 choreography with the
  // leader template RENAMED to `captain`. Phase A's gate reads the cold
  // / stale truth and ADMIPTS (the durable `team-work-admitted` fact);
  // the delivery resumes the root agent, whose setup reconcile stamps
  // the remount failure; the prepare's cooldown SKIP leaves the attempt
  // clock untouched. The pre-fix verdict classifies the root through
  // the HARDCODED `leader` template id (the requirement sits under
  // `captain` — invisible to `templates['leader']`) → the failed
  // required mount is treated as OPTIONAL → degraded → the root input
  // is DELIVERED (the P1 defect: a legal blueprint's required outage
  // degrades and the work ships). The fix derives the bound
  // blueprint's ACTUAL leader template id → the required occurrence is
  // visible → BLOCKED before the first model-visible input (the
  // strategy maps the rejection to WORK_DELIVERY_FAILED → the remote
  // TEAM_CREATE_ROOT_WORK_DELIVERY_FAILED; the admission stays for the
  // same-token retry; NO terminal root-work fact).
  const dispatcher = captureRemoteDispatcher(world)
  const initialWorkToken = tok()
  const rootFollowupsBefore = followupsOf(world, L5_ROOT)
  const initialWorkResponse: Record<string, unknown> = await dispatcher('team.admitInitialWork', {
    version: 2,
    params: { rootSessionId: L5_ROOT, requestToken: initialWorkToken, prompt: 'mtm-l5 initial work' },
  })
  const rootFollowupsAfter = followupsOf(world, L5_ROOT)
  const workAdmitted = factWithToken(world, L5_ROOT, 'team-work-admitted', initialWorkToken)
  const rootWorkDelivered = rootWorkDeliveredOf(world, L5_ROOT, initialWorkToken)
  const slotLeaderAfter = slotOf(world, L5_ROOT, L5_SERVER)

  return {
    world,
    slotLeaderAtBoot,
    drop,
    slotLeaderAfterDrop,
    initialWorkToken,
    initialWorkResponse,
    rootFollowupsBefore,
    rootFollowupsAfter,
    workAdmitted,
    rootWorkDelivered,
    slotLeaderAfter,
  }
})()

// ══════════════════════════════════════════════════════════════════════════
// WORLD L6 — the consolidated re-review, P2a (the control-notification
// liveness vs normal root work — the C1 pending-approval channel must
// keep liveness under the failed required MCP while NORMAL root work
// stays gated; no liveness exemption for work input)
// ══════════════════════════════════════════════════════════════════════════

const L6 = await (async () => {
  destroyDir(scratchDir('mtm-l6'))
  const mcpFailures: Record<string, string> = {}
  const world = await bootMtmWorld('l6', L6_ROOT, BP_L6, L6_SERVER, 4006, undefined, mcpFailures)

  // The boot root's leader (REQUIRED mcpServer — the L3/R2 shape) is
  // mounted (healthy) on the root session at boot.
  const slotLeaderAtBoot = slotOf(world, L6_ROOT, L6_SERVER)

  // THE COLD SEAM: the leader's residency is dropped (the stale truth).
  const drop = await world.root.live.dropResidency(L6_ROOT)
  const slotLeaderAfterDrop = slotOf(world, L6_ROOT, L6_SERVER)

  // THE FAULT: the remount (the cold-resume setup reconcile) will fail.
  mcpFailures[L6_SERVER] = 'mtm-l6: leader remount failure (the control-notification fault)'

  // (1) NORMAL ROOT WORK first (the leader is still COLD — Phase A
  // reads the stale truth and ADMIPTS; the delivery boundary must
  // block): the L3 shape — the admission is durable, the delivery
  // resumes the root agent (the setup reconcile stamps the remount
  // failure), the verdict blocks BEFORE the first model-visible input
  // → the remote TEAM_CREATE_ROOT_WORK_DELIVERY_FAILED, zero root
  // input, no terminal fact. (Normal root work stays gated — NO
  // liveness exemption for model-visible work input.)
  const dispatcher = captureRemoteDispatcher(world)
  const workToken = tok()
  const rootFollowupsBeforeWork = followupsOf(world, L6_ROOT)
  const workResponse: Record<string, unknown> = await dispatcher('team.admitInitialWork', {
    version: 2,
    params: { rootSessionId: L6_ROOT, requestToken: workToken, prompt: 'mtm-l6 normal root work' },
  })
  const rootFollowupsAfterWork = followupsOf(world, L6_ROOT)
  const workAdmitted = factWithToken(world, L6_ROOT, 'team-work-admitted', workToken)
  const rootWorkDelivered = rootWorkDeliveredOf(world, L6_ROOT, workToken)

  // (2) THE CONTROL NOTIFICATION (the C1 pending-approval liveness
  // channel): a fresh durable LEADER_APPROVAL control request through
  // the PRODUCTION control service (the pre-execute adapter's ask-lane
  // kind derivation is orthogonal — the service fires the notification
  // on `outcome.created && kind === LEADER_APPROVAL` for ANY derived
  // path; the team subject resolves the team without a target). The
  // service fires the leader-approval notification FIRE-AND-FORGET (a
  // delivery failure is a LIVENESS failure only — the durable row
  // stands; the swallow is the service's liveness-failure sink). The
  // notification path (deliverRootControlNotification) must KEEP
  // LIVENESS under the failed required MCP — it is NOT model-visible
  // work input (the frozen matrix's liveness-preserved class, same
  // family as the completion notification). (RED shape at a0918b90:
  // the control notification routes through the now-gated
  // deliverRootInput → the verdict's throw is swallowed → the
  // pending-approval leader is NEVER notified — the liveness hole.)
  const controlRequest = await world.root.control.requestControl({
    rootSessionId: L6_ROOT,
    caller: LEADER_CALLER,
    kind: 'leader-approval',
    subject: { kind: 'team', rootSessionId: L6_ROOT },
    actionName: 'mtm-l6',
    correlation: `mtm-l6-ctrl-${tokenSeq}`,
    summary: 'mtm-l6 pending approval (the control-notification liveness leg)',
  })
  const controlNotifiedText = await waitForControlNotification(world, L6_ROOT)
  const rootFollowupsAfter = followupsOf(world, L6_ROOT)
  const slotLeaderAfter = slotOf(world, L6_ROOT, L6_SERVER)

  return {
    world,
    slotLeaderAtBoot,
    drop,
    slotLeaderAfterDrop,
    workToken,
    workResponse,
    rootFollowupsBeforeWork,
    rootFollowupsAfterWork,
    rootFollowupsAfter,
    workAdmitted,
    rootWorkDelivered,
    controlRequestId: String(controlRequest.requestId),
    controlNotifiedText,
    slotLeaderAfter,
  }
})()

// ══════════════════════════════════════════════════════════════════════════
// WORLD L7 — the consolidated re-review, P2b (the per-scope recovery
// identity — the SAME subject required in BOTH the team scope and the
// worker template scope; a recovery marker covering only ONE scope
// must not exempt the other scope's occurrence)
// ══════════════════════════════════════════════════════════════════════════

const L7 = await (async () => {
  destroyDir(scratchDir('mtm-l7'))
  const mcpFailures: Record<string, string> = {}
  const world = await bootMtmWorld('l7', L7_ROOT, BP_L7, L7_SERVER, 4007, undefined, mcpFailures)

  const instA = await activateMember(world, 'mtm-l7-A')
  const instB = await activateMember(world, 'mtm-l7-B')

  // Both healthy + mounted at their first boundary (the failure map is
  // still empty — the mounts succeed).
  await expectWorkAdmitted(world, followUpRequest(L7_ROOT, instA.instanceId), 'L7 A first delivery (mount)')
  await expectWorkAdmitted(world, followUpRequest(L7_ROOT, instB.instanceId), 'L7 B first delivery (mount)')
  const slotBAtMount = slotOf(world, instB.childSessionId, L7_SERVER)

  // THE FAULT: B's remount will keep failing (the PERSISTENT outage).
  mcpFailures[L7_SERVER] = 'mtm-l7: B remount failure (the persistent per-scope-recovery fault)'
  // The confirmed loss on B (the T1 shape — the public-seam withdrawal:
  // the tools leave B's scope; the fiber handle stays).
  const fiberB = fiberOf(world, instB.childSessionId, L7_SERVER)
  if (fiberB?.withdrawTools === undefined) throw new Error('mtm L7: B carries no withdrawable fiber')
  fiberB.withdrawTools()

  // The gate's FRESH probe (this passage) classifies B's loss: the
  // witness retires B's exhausted fiber (slot stamped `failed`).
  await expectWorkAdmitted(world, followUpRequest(L7_ROOT, instA.instanceId), 'L7 probe passage (follow-up A)')
  const slotBAfterProbe = slotOf(world, instB.childSessionId, L7_SERVER)

  // The cooldown rewind (the test stand-in for the 30 s elapse — the
  // boundary retry is admissible at the next passage).
  if (slotBAfterProbe === undefined || typeof slotBAfterProbe.lastAttemptAt !== 'number') {
    throw new Error('mtm L7: B carries no failed slot to rewind')
  }
  slotBAfterProbe.lastAttemptAt = Date.now() - 61_000

  // THE LEG: the SAME subject is REQUIRED in BOTH scopes (the team
  // scope — the v2 `teamRequirements` block — and the worker template
  // scope) — two distinct requirement occurrences with distinct scope
  // identities. The recovery marker covers ONLY the TEAM scope
  // (`scopeKeys: ['team']` + the subject). The pre-fix verdict
  // FLATTENS team + template into one subject set → the subject ∈
  // unavailableSubjects → EVERY occurrence is exempt → the recovery
  // re-run is DELIVERED (the P2b defect: the worker-scope occurrence
  // is uncovered yet exempted). The fix preserves the PER-SCOPE
  // occurrence identity: a required occurrence is exempt ONLY when the
  // marker matches BOTH the scope AND the subject of that specific
  // occurrence (the scopeKeys are actually read) → the covered team
  // occurrence stays exempt but the uncovered WORKER-scope occurrence
  // BLOCKS the delivery (zero input; the typed delivery failure).
  const recoveryMarker = {
    scopeKeys: ['team'],
    unavailableSubjects: [L7_SERVER],
  }
  const bRequest = followUpRequest(L7_ROOT, instB.instanceId, { recovery: recoveryMarker })
  const bFollowupsBefore = followupsOf(world, instB.childSessionId)
  let bOutcome: { instanceId?: string } | undefined
  let bThrown: unknown
  try {
    bOutcome = await expectWorkAdmitted(
      world,
      bRequest,
      'L7 recovery passage (team-scope-only marker — the worker-scope occurrence must still block)',
    )
  } catch (error) {
    bThrown = error
  }
  const bFollowupsAfter = followupsOf(world, instB.childSessionId)
  const slotBAfterRecovery = slotOf(world, instB.childSessionId, L7_SERVER)

  return {
    world,
    instA,
    instB,
    slotBAtMount,
    slotBAfterProbe,
    bOutcome,
    bThrown,
    bFollowupsBefore,
    bFollowupsAfter,
    slotBAfterRecovery,
  }
})()

// ══════════════════════════════════════════════════════════════════════════
// the assertions (synchronous `it` bodies over the captured worlds)
// ══════════════════════════════════════════════════════════════════════════

describe('Finding F — target-specific MCP materialization (real chain: host entry + production glue)', () => {
  it('T1 — the failed target instance is gated with ZERO work; the healthy sibling passes (no masking in either direction)', () => {
    // The liveness guard: the fresh members' first deliveries were admitted
    // (no spurious PENDING on the in-flight window — the leader's fiber
    // masks the aggregate `reachable`).
    expect(A.firstDeliveryA.instanceId).toBe(A.instA.instanceId)
    expect(A.firstDeliveryB.instanceId).toBe(A.instB.instanceId)
    // The setup truth: both instances mounted at their first boundary;
    // the probe passage (the follow-up to A) classified B's loss — B's
    // slot is the failed truth (the fiber retired, the cooldown armed).
    expect(A.slotAAtBoot?.status).toBe('mounted')
    expect(A.slotBAtBoot?.status).toBe('mounted')
    expect(A.slotBAfterProbe?.status).toBe('failed')
    expect(typeof A.slotBAfterProbe?.attempts).toBe('number')
    // The probe passage itself was admitted (A healthy) and delivered.
    expect(A.lossProbePassage.instanceId).toBe(A.instA.instanceId)

    // THE TARGET GATE: the follow-up to B is the typed FATAL block (the
    // scope is down for the target — the recovery dispatch is offered).
    expect(A.bBlock.status).toBe('BLOCKED_FATAL')
    expect(A.bBlock.gateReason).toBe('requiredScopeDown')
    expect(A.bBlock.blockedScopes).toEqual(['template:worker'])
    expect(A.bBlock.unavailableSubjects).toEqual([A_SERVER])
    expect(A.bBlock.recoveryDispatchAvailable).toBe(true)

    // ZERO WORK on the failed target: no delivery reached B's session.
    expect(A.bFollowupsAfter - A.bFollowupsBefore).toBe(0)

    // The healthy sibling is NOT masked: the follow-up to A was admitted
    // and delivered to A's session.
    expect(A.aFollowup.instanceId).toBe(A.instA.instanceId)
  })

  it('T2 — the scope incident stays open until the scope OWN materialization converges (fixing A alone does not close it; fixing B does)', () => {
    // The recovery-allowed passage opened the durable incident for the
    // `worker` scope (the audit record of the down state).
    expect(A.incidentOpened).toBe(true)

    // Fixing A alone: A keeps working, but the scope's own materialization
    // is still not satisfied (B failed) — the incident STAYS OPEN and B
    // stays blocked (the healthy sibling's fresh verdict must not close
    // the scope's incident).
    expect(A.aFollowup2.instanceId).toBe(A.instA.instanceId)
    expect(A.incidentStillOpen, 'the incident must NOT close while B is failed').toBe(true)
    expect(A.bBlock2.status).toBe('BLOCKED_FATAL')
    expect(A.bBlock2.blockedScopes).toEqual(['template:worker'])

    // Fixing B (the cooldown rewound + the recovery passage delivering to
    // B's next boundary): the reconcile remounts a FRESH healthy fiber —
    // B's slot converges to `mounted`.
    expect(A.slotBAfterFix?.status, 'B must remount at its next boundary post-cooldown').toBe('mounted')

    // The converged scope: the normal follow-up to B PASSES and the
    // incident CLOSES (the durable exit record — the scope's own
    // materialization is satisfied: every live instance mounted).
    expect(A.bFollowup.instanceId).toBe(A.instB.instanceId)
    expect(A.incidentClosed, 'the incident must close once B converged').toBe(true)
    expect(A.closeRows.length).toBeGreaterThanOrEqual(1)
    const firstClose = A.closeRows[0]
    expect(firstClose).toBeDefined()
    expect(firstClose?.scope).toBe('template:worker')
  })

  it('T3 — two roots, same templateId: the target root OWN failed instance gates the target root (no cross-root conflation)', () => {
    // The setup truth: both instances mounted at their first delivery
    // (one on each root — the multi-root host shape).
    expect(B.slotA1AtMount?.status).toBe('mounted')
    expect(B.slotB2AtMount?.status).toBe('mounted')
    // The probe passage classified B2's loss on root 2.
    expect(B.slotB2AfterProbe?.status).toBe('failed')

    // THE TARGET GATE (root 2): the follow-up to B2 is blocked on root 2's
    // own failed instance — the boot root's healthy A1 does not open it.
    expect(B.b2Block.status).toBe('BLOCKED_FATAL')
    expect(B.b2Block.blockedScopes).toEqual(['template:worker'])
    expect(B.b2Block.unavailableSubjects).toEqual([B_SERVER])
    expect(B.b2FollowupsAfter - B.b2FollowupsBefore, 'zero work on the failed target').toBe(0)

    // The control: the boot root's healthy instance keeps working.
    expect(B.a1Followup.instanceId).toBe(B.instA1.instanceId)
  })

  it('T4 — the v2 Leader template: the Leader OWN (root session) materialization gates leader-targeted work, masked by a healthy sibling', () => {
    // The setup truth: the worker's healthy fiber (the mask) is mounted at
    // its first delivery; the Leader's fiber was mounted on the ROOT
    // session at boot (the v2 Leader row binds no child — the Leader IS
    // the root session).
    expect(E.slotWAtMount?.status).toBe('mounted')
    expect(E.slotLeaderAtBoot?.status).toBe('mounted')

    // THE TARGET GATE: the follow-up to the Leader is blocked on the
    // Leader's own failed materialization — even though the aggregate
    // readiness is `reachable` (the worker's healthy fiber masks it) and
    // even though the pre-fix lookup excluded the v2 Leader row entirely
    // (not-applicable → the false OPEN).
    expect(E.leaderBlock.status).toBe('BLOCKED_FATAL')
    expect(E.leaderBlock.blockedScopes).toEqual(['template:leader'])
    expect(E.leaderBlock.unavailableSubjects).toEqual([E_SERVER])
    expect(E.rootFollowupsAfter - E.rootFollowupsBefore, 'zero work on the Leader (root session)').toBe(0)

    // The control: the worker (a template without the requirement) keeps
    // working — the Leader scope does not mask unrelated work.
    expect(E.wFollowup.instanceId).toBe(E.instW.instanceId)
  })

  it('T5 — the cold member: the not-applicable materialization is preserved (no spurious block; resume + mount + delivery)', () => {
    // The fresh-member window: C was never delivered work, so it carries
    // NO materialization slot yet (nothing mounted, nothing failed) — the
    // not-yet-materialized state, distinct from a confirmed failure.
    expect(D.slotCAtBoot).toBeUndefined()

    // THE GUARD: the follow-up to the cold instance is NOT blocked — the
    // `not-applicable` materialization (the cold member MUST NOT block,
    // guide §2.5.4) is preserved through the fix; the leader's healthy
    // fiber keeps the aggregate `reachable` (the liveness-correct seed/
    // 2-state decides, never a deadlock PENDING).
    expect(D.cFollowup.instanceId).toBe(D.instC.instanceId)
    expect(D.cResumed, 'the delivery resumes the cold agent').toBe(true)
    // The boundary re-materialized the server (fresh mount on resume).
    expect(D.slotCAfterResume?.status).toBe('mounted')
  })
})

// ══════════════════════════════════════════════════════════════════════════
// the residual legs (external review of e45d22fe — the two confirmed
// residual-F rulings; the ordinary follow-up path's exact-scope fix
// already landed in this branch's earlier increment)
// ══════════════════════════════════════════════════════════════════════════

describe('Finding F — residual legs (external review of e45d22fe: R1 first-mount PENDING window + R2 initial-work cross-root read)', () => {
  it('T7 (external residual 1) — the first-mount PENDING window: B is admitted (masked pending), its own first mount fails on the passage, and the SAME-passage delivery is blocked (zero model-visible input; fail-closed settlement; A unaffected; the next passage is gated as failed)', () => {
    // The setup truth: A mounted at its first boundary (the healthy
    // sibling); B FRESH — no slot yet (the pending window: the
    // materialization settles only at B's own first boundary).
    expect(R1.slotAAtMount?.status, 'A mounted at its first delivery').toBe('mounted')
    expect(R1.slotBAtBoot, 'B carries no slot before its first boundary').toBeUndefined()

    // THE SAME-PASSAGE GATE: after B's own mount attempt FAILED on this
    // passage, NO model-visible work reached B — the typed fail-closed
    // fault (the work chain's settle-then-throw) and zero deliveries.
    // (RED shape: the pre-fix window delivered the follow-up on the very
    // passage that failed the first mount — the count grew and nothing
    // threw.)
    expect(
      R1.bThrown,
      'the same-passage delivery was NOT blocked after B\'s own first-mount failure (the external residual-1 window: real work delivered on the failed-mount passage)',
    ).toBeInstanceOf(TeamRuntimeError)
    expect((R1.bThrown as TeamRuntimeError).code).toBe(TEAM_RUNTIME_ERROR_CODES.WORK_DELIVERY_FAILED)
    expect(R1.bFollowupsAfter - R1.bFollowupsBefore, 'zero work on the failed-mount passage').toBe(0)

    // The durable truth: B's own slot is the failed boundary truth (the
    // stamp the gate read) and the work unit settled FAIL-CLOSED (no
    // fake RUNNING success, no fake settlement success).
    expect(R1.slotBAfterPassage?.status, 'B\'s slot is the failed boundary truth').toBe('failed')
    expect(R1.bWorkOutcome, 'the fail-closed settlement is durable').toBe('delivery-failed')

    // The NEXT passage: B is gated as `failed` at admission (the T1
    // shape on the passage after the window — the feed's failed → DOWN).
    expect(R1.bBlockNext.status).toBe('BLOCKED_FATAL')
    expect(R1.bBlockNext.gateReason).toBe('requiredScopeDown')
    expect(R1.bBlockNext.blockedScopes).toEqual(['template:worker'])

    // The control: A keeps working (the healthy sibling is not masked;
    // the already-mounted fiber is never re-attempted against the
    // failure map).
    expect(R1.aFollowup.instanceId).toBe(R1.instA.instanceId)
  })

  it('T8 (external residual 2) — the initial-work cross-root read: root B\'s initial work is gated on B OWN failed leader materialization (zero delivery; the recovery stays typed/open — the healthy root A neither permits B nor settles B)', () => {
    // The setup truth: A's leader mounted at boot (healthy); B's leader
    // RESIDENT + FAILED (its own root agent's first mount failed — the
    // world's fault seam).
    expect(R2.slotLeaderAAtBoot?.status, 'root A leader mounted at boot').toBe('mounted')
    expect(R2.slotLeaderBAfterCreate?.status, 'root B leader failed its own first mount').toBe('failed')

    // THE CROSS-ROOT GATE: B's initial work is the typed FATAL block on
    // B's own leader scope (the v2 command's failure envelope carries the
    // gate's details under `cause.details`). The pre-fix wrapper dropped
    // the feed context: the read resolved under the BOOT root A, whose
    // healthy leader permitted B's initial work — the cross-root false
    // OPEN (the command answered `ok: true` and delivered).
    expect(
      R2.bInitialWorkResponse['ok'],
      'B\'s initial work was PERMITTED via the boot root\'s materialization (the external residual-2 cross-root false OPEN)',
    ).toBe(false)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- the remote failure envelope (dynamic surface)
    const error = R2.bInitialWorkResponse['error'] as Record<string, any>
    expect(String(error?.['code'] ?? '')).toBe('TEAM_RUNTIME_COMPATIBILITY_BLOCKED')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- the remote failure envelope (dynamic surface)
    const details = (((error?.['details'] as Record<string, any>)?.['cause'] as Record<string, any>)?.['details'] ?? {}) as Record<string, unknown>
    expect(String(details['status'] ?? '')).toBe('BLOCKED_FATAL')
    expect(Array.isArray(details['blockedScopes']) ? details['blockedScopes'].map(String) : []).toEqual(['template:leader'])
    expect(Array.isArray(details['unavailableSubjects']) ? details['unavailableSubjects'].map(String) : []).toEqual([R2_SERVER])
    expect(details['recoveryDispatchAvailable'], 'the recovery dispatch stays offered for B\'s own scope').toBe(true)

    // ZERO DELIVERY on B's initial work (no root input, no terminal
    // root-work fact).
    expect(R2.rootBFollowupsAfter - R2.rootBFollowupsBefore, 'zero work on B root').toBe(0)
    expect(R2.bRootWorkDelivered, 'no terminal root-work fact for B').toBeUndefined()

    // THE RECOVERY STAYS TYPED/OPEN FOR B: the healthy root A neither
    // permitted B's work nor settled B's scope (no incident closure
    // under B; A's ledger untouched — A is not involved).
    expect(
      R2.incidentB.filter((row) => row.type === RECOVERY_INCIDENT_CLOSED_FACT_TYPE),
      'no incident closure under B (B\'s recovery is not closed by A\'s health)',
    ).toEqual([])
    expect(R2.incidentA, 'no incident rows under A').toEqual([])
    // A's own state is unchanged (the cross-root read must not touch A).
    expect(R2.slotLeaderAAfter?.status, 'root A leader still mounted').toBe('mounted')
  })

  it('L1 (residual class 1) — the COLD-RESUME gap: the stale cold truth admits, the resume setup reconcile fails the remount, the prepare cooldown SKIPs, and the pre-fix SAME-PASSAGE gate (the attempt-clock delta) is BLIND — the delivery reaches B. The requirement-aware final-input verdict reads the FINAL failed truth and blocks (zero input; fail-closed settlement; the next passage gated as failed)', () => {
    // The setup truth: both mounted at their first boundary; the
    // residency drop is the liveness-only removal (the slot record
    // survives — the stale truth).
    expect(L1.drop.dropped, 'B residency dropped').toBe(true)
    expect(L1.slotAAtMount?.status).toBe('mounted')
    expect(L1.slotBAtMount?.status, 'B mounted at its first boundary').toBe('mounted')
    expect(L1.slotBAfterDrop?.status, 'the stale slot survives the residency drop').toBe('mounted')

    // THE VERDICT: the typed fail-closed fault (the work chain's
    // settle-then-throw) and ZERO deliveries on the cold-resume passage.
    // (RED shape: the pre-fix passage delivered the follow-up to B after
    // the remount failed — the attempt-clock delta gate is blind to the
    // setup-stamped failure: the count grew and nothing threw.)
    expect(
      L1.bThrown,
      'the cold-resume delivery was NOT blocked after the remount failure (the external class-1 gap: a timestamp-delta judgment misses the failure stamped by the resume setup reconcile)',
    ).toBeInstanceOf(TeamRuntimeError)
    expect((L1.bThrown as TeamRuntimeError).code).toBe(TEAM_RUNTIME_ERROR_CODES.WORK_DELIVERY_FAILED)
    expect(L1.bFollowupsAfter - L1.bFollowupsBefore, 'zero work on the cold-resume passage').toBe(0)
    expect(L1.slotBAfterPassage?.status, 'B remount failed on the resume setup reconcile').toBe('failed')
    expect(L1.bWorkOutcome, 'the fail-closed settlement is durable').toBe('delivery-failed')

    // THE NEXT PASSAGE: B is gated as `failed` at admission (the feed's
    // failed → DOWN).
    expect(L1.bBlockNext.status).toBe('BLOCKED_FATAL')
    expect(L1.bBlockNext.gateReason).toBe('requiredScopeDown')
    expect(L1.bBlockNext.blockedScopes).toEqual(['template:worker'])

    // THE CONTROL: A keeps working (the healthy sibling is not masked).
    expect(L1.aFollowup.instanceId).toBe(L1.instA.instanceId)
  })

  it('L2 (residual class 2) — the MESSAGING consumer: the coordinator commits the intent and delivers the attributed input to B whose prepare FAILED the required server — the pre-fix submitAttributedInput IGNORES the prepare result (the input reaches B\'s inbox + the confirmation commits). The requirement-aware final-input verdict blocks (the coordinator maps the rejection to MESSAGING_DELIVERY_FAILED; the intent stays pending — NO confirmation)', () => {
    // The setup truth: A mounted (the mask); B fresh (never mounted — the
    // masked pending admission shape).
    expect(L2.slotAAtMount?.status).toBe('mounted')
    expect(L2.slotBAtBoot, 'B fresh — never mounted').toBeUndefined()

    // THE VERDICT: the typed delivery failure at the INPUT boundary (NOT
    // an admission block — the admission saw the masked pending shape and
    // admitted; the failure stands where the first model-visible input
    // would go). (RED shape: the pre-fix delivery answered ok and the
    // confirmation fact exists — the input reached B's inbox after its
    // first mount failed.)
    expect(
      L2.sendResponse['ok'],
      'the messaging delivery was NOT blocked after B\'s first-mount failure (the external class-2 gap: submitAttributedInput ignores the prepare result)',
    ).toBe(false)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- the remote failure envelope (dynamic surface)
    const error = L2.sendResponse['error'] as Record<string, any>
    expect(String(error?.['code'] ?? '')).toBe('MESSAGING_DELIVERY_FAILED')
    expect(L2.bFollowupsAfter - L2.bFollowupsBefore, 'zero input on the failed passage').toBe(0)
    expect(L2.intentRecorded, 'the intent fact stays durable (R2: the coordination is recoverable)').toBe(true)
    expect(L2.confirmationRecorded, 'no confirmation — the delivery never succeeded').toBe(false)
    expect(L2.slotBAfter?.status, 'B\'s first mount failed on the delivery\'s boundary').toBe('failed')

    // THE CONTROL: A keeps working (the healthy sibling is not masked).
    expect(L2.aFollowup.instanceId).toBe(L2.instA.instanceId)
  })

  it('L3 (residual class 2) — the ROOT consumer: root B\'s initial work — the admission reads the stale cold truth and ADMITS (the durable `team-work-admitted` fact), the cold-resume delivery\'s setup reconcile fails the remount, and the pre-fix deliverRootInput IGNORES the prepare result (the root input reaches B + the terminal fact commits). The requirement-aware final-input verdict blocks (the strategy maps the rejection to WORK_DELIVERY_FAILED → the remote TEAM_CREATE_ROOT_WORK_DELIVERY_FAILED; the admission stays for the same-token retry; NO terminal root-work fact)', () => {
    // The setup truth: A's leader mounted at boot (healthy throughout);
    // B's leader mounted (healthy) at creation; the residency drop is the
    // liveness-only removal (the stale slot survives).
    expect(L3.slotLeaderAAtBoot?.status, 'root A leader mounted at boot').toBe('mounted')
    expect(L3.slotLeaderBAtCreate?.status, 'root B leader mounted (healthy) at creation').toBe('mounted')
    expect(L3.drop.dropped, 'B residency dropped').toBe(true)
    expect(L3.slotLeaderBAfterDrop?.status, 'the stale slot survives the residency drop').toBe('mounted')

    // THE VERDICT: the typed delivery failure on the initial-work
    // boundary. (RED shape: the pre-fix delivery answered ok:true and
    // committed the terminal root-work fact — the root input reached B
    // after the remount failed.)
    expect(
      L3.bInitialWorkResponse['ok'],
      'B\'s initial work was PERMITTED on the failed remount passage (the external class-2 root gap: deliverRootInput ignores the prepare result)',
    ).toBe(false)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- the remote failure envelope (dynamic surface)
    const error = L3.bInitialWorkResponse['error'] as Record<string, any>
    expect(String(error?.['code'] ?? '')).toBe('TEAM_CREATE_ROOT_WORK_DELIVERY_FAILED')
    expect(L3.rootBFollowupsAfter - L3.rootBFollowupsBefore, 'zero root input on the failed passage').toBe(0)
    expect(L3.bWorkAdmitted, 'the Phase A admission stays durable (the same-token retry keeps it)').toBe(true)
    expect(L3.bRootWorkDelivered, 'no terminal root-work fact').toBeUndefined()
    expect(L3.slotLeaderBAfter?.status, 'B\'s remount failed on the resume setup reconcile').toBe('failed')
    expect(L3.slotLeaderAAfter?.status, 'root A leader still mounted').toBe('mounted')
  })

  it('L4a (residual class 3) — the anti-over-block (NO requirement): B\'s first mount fails on its own first passage, but the failed server carries NO requirement — the pre-fix SAME-PASSAGE gate over-blocks (requirement-blind); the requirement-aware final-input verdict DEGRADES (the work delivers with the server down; the slot is the failed truth)', () => {
    // The setup truth: A mounted (the mask); B fresh (its first passage
    // is the first boundary).
    expect(L4A.slotAAtMount?.status).toBe('mounted')

    // THE VERDICT: the no-requirement outage is ADMITTED + DELIVERED
    // (the degraded allow). (RED shape: the pre-fix gate threw
    // WORK_DELIVERY_FAILED on the same-passage failure — the over-block:
    // it fires on EVERY policy-allowed target, required or not.)
    expect(
      L4A.bThrown,
      'the no-requirement outage was NOT allowed (the external class-3 over-block: the pre-fix gate blocks on ALL policy-allowed targets\' same-passage failures)',
    ).toBeUndefined()
    expect(L4A.bOutcome?.instanceId, 'B\'s work is admitted').toBe(L4A.instB.instanceId)
    expect(L4A.bFollowupsAfter - L4A.bFollowupsBefore, 'the work delivered (degraded — the server stays down)').toBe(1)
    expect(L4A.slotBAfter?.status, 'B\'s first mount DID fail (the degradation is real, not a hidden mount)').toBe('failed')
  })

  it('L4b (residual class 3) — the anti-over-block (OPTIONAL requirement): B\'s first mount fails on its own first passage, but the failed server\'s requirement is `complete: false` (the engine\'s WARNING verdict — the degraded scope, never a block) — the pre-fix SAME-PASSAGE gate over-blocks (requirement-blind); the requirement-aware final-input verdict DEGRADES (the work delivers with the server down)', () => {
    // The setup truth: A mounted (the mask); B fresh.
    expect(L4B.slotAAtMount?.status).toBe('mounted')

    // THE VERDICT: the optional-requirement outage is ADMITTED +
    // DELIVERED (the degraded allow — the WARNING scope never blocks).
    // (RED shape: the pre-fix gate threw WORK_DELIVERY_FAILED on the
    // same-passage failure — the over-block: required or optional, it
    // fires on EVERY policy-allowed target.)
    expect(
      L4B.bThrown,
      'the optional-requirement outage was NOT allowed (the external class-3 over-block: the pre-fix gate is requirement-blind)',
    ).toBeUndefined()
    expect(L4B.bOutcome?.instanceId, 'B\'s work is admitted').toBe(L4B.instB.instanceId)
    expect(L4B.bFollowupsAfter - L4B.bFollowupsBefore, 'the work delivered (degraded — the server stays down)').toBe(1)
    expect(L4B.slotBAfter?.status, 'B\'s first mount DID fail (the degradation is real, not a hidden mount)').toBe('failed')
  })

  it('L4c (residual class 3) — the anti-over-block (REVIEWED recovery): the human-reviewed recovery re-run of the blocked follow-up to B (the `recovery` marker, the T2 shape) — the gate allows the recovery work (the reviewed scope; the durable incident record), the prepare re-attempts the remount past cooldown and it FAILS AGAIN (the persistent fault), and the pre-fix SAME-PASSAGE gate over-blocks the reviewed recovery (recovery-blind). The requirement-aware final-input verdict EXEMPTS the reviewed scope (the marker names the unavailable subject) and delivers', () => {
    // The setup truth: both mounted; the probe passage classified B's
    // loss (the slot is the failed boundary truth — the T1 shape); the
    // cooldown is rewound (the boundary retry is admissible).
    expect(L4C.slotBAtMount?.status, 'B mounted at its first boundary').toBe('mounted')
    expect(L4C.slotBAfterProbe?.status, 'B classified failed by the probe passage').toBe('failed')

    // THE VERDICT: the reviewed recovery re-run is ADMITTED + DELIVERED
    // (the reviewed-scope exemption) — even though the remount FAILED
    // AGAIN on this passage (the persistent outage). (RED shape: the
    // pre-fix gate threw WORK_DELIVERY_FAILED on the same-passage
    // failure — the over-block: it fires even on the human-reviewed
    // recovery re-run.)
    expect(
      L4C.bThrown,
      'the reviewed recovery re-run was NOT allowed (the external class-3 over-block: the pre-fix gate blocks even the human-reviewed recovery re-run)',
    ).toBeUndefined()
    expect(L4C.bOutcome?.instanceId, 'the recovery work is admitted').toBe(L4C.instB.instanceId)
    expect(L4C.bFollowupsAfter - L4C.bFollowupsBefore, 'the recovery work delivered (the reviewed scope is allowed)').toBe(1)
    expect(L4C.slotBAfterRecovery?.status, 'the remount failed AGAIN (the exemption is the reviewed scope, not a remount success)').toBe('failed')
    expect(L4C.incidentOpened, 'the reviewed recovery is durably recorded (the scope incident)').toBe(true)
  })

  it('L5 (re-review P1) — the RENAMED leader slug: the bound blueprint\'s leader templateId is `captain` (a legal non-`leader` slug) carrying the REQUIRED mcpServer — the L3 root choreography with the slug renamed. The admission reads the stale cold truth and ADMITS; the cold-resume delivery\'s setup reconcile fails the remount. The pre-fix verdict classifies the root through the HARDCODED `leader` template id (the requirement sits under `captain` — invisible) and DEGRADES: the root input is DELIVERED (the required outage treated as optional — the work ships). The fix derives the bound blueprint\'s ACTUAL leader template id → the required occurrence is visible → BLOCKED (zero root input; the strategy maps the rejection to WORK_DELIVERY_FAILED → the remote TEAM_CREATE_ROOT_WORK_DELIVERY_FAILED; the admission stays for the same-token retry; no terminal root-work fact)', () => {
    // The setup truth: the `captain` leader mounted (healthy) at boot;
    // the residency drop is the liveness-only removal (the stale slot
    // survives).
    expect(L5.slotLeaderAtBoot?.status, 'the renamed-slug leader mounted (healthy) at boot').toBe('mounted')
    expect(L5.drop.dropped, 'residency dropped').toBe(true)
    expect(L5.slotLeaderAfterDrop?.status, 'the stale slot survives the residency drop').toBe('mounted')

    // THE VERDICT (RED shape: the pre-fix hardcoded `leader` id misses
    // the `captain` requirement → the failed required mount degrades
    // → the initial work is PERMITTED and the terminal fact commits).
    expect(
      L5.initialWorkResponse['ok'],
      'the renamed-slug required outage was PERMITTED (the external P1 gap: the verdict hardcodes the `leader` template id)',
    ).toBe(false)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- the remote failure envelope (dynamic surface)
    const error = L5.initialWorkResponse['error'] as Record<string, any>
    expect(String(error?.['code'] ?? '')).toBe('TEAM_CREATE_ROOT_WORK_DELIVERY_FAILED')
    expect(L5.rootFollowupsAfter - L5.rootFollowupsBefore, 'zero root input on the failed passage').toBe(0)
    expect(L5.workAdmitted, 'the Phase A admission stays durable (the same-token retry keeps it)').toBe(true)
    expect(L5.rootWorkDelivered, 'no terminal root-work fact').toBeUndefined()
    expect(L5.slotLeaderAfter?.status, 'the remount failed on the resume setup reconcile').toBe('failed')
  })

  it('L6 (re-review P2a) — the CONTROL NOTIFICATION vs normal root work under the SAME failed required MCP: (1) normal root work — the admission reads the stale cold truth and ADMITS, the cold-resume delivery\'s setup reconcile fails the remount, the verdict BLOCKS (zero root input + TEAM_CREATE_ROOT_WORK_DELIVERY_FAILED; the admission stays; no terminal fact) — normal root work stays gated, NO liveness exemption for model-visible work input; (2) the pending-approval leader notification (the C1 liveness channel — the production control service fires the leader-approval notification fire-and-forget on the created durable row) — the pre-fix deliverRootControlNotification routes through the now-gated deliverRootInput → the verdict\'s throw is SWALLOWED by the service\'s liveness-failure sink → the pending-approval leader is NEVER notified (the liveness hole). The fix keeps the control notification LIVENESS (not model-visible work input — the frozen matrix\'s liveness-preserved class, same family as the completion notification) → DELIVERED', () => {
    // The setup truth: the leader mounted (healthy) at boot; the
    // residency drop is the liveness-only removal (the stale slot
    // survives).
    expect(L6.slotLeaderAtBoot?.status, 'the leader mounted (healthy) at boot').toBe('mounted')
    expect(L6.drop.dropped, 'residency dropped').toBe(true)
    expect(L6.slotLeaderAfterDrop?.status, 'the stale slot survives the residency drop').toBe('mounted')

    // (1) NORMAL ROOT WORK — the gated work-input class (the L3
    // contract): the typed delivery failure, zero root input, the
    // durable admission, no terminal fact — NO liveness exemption.
    expect(
      L6.workResponse['ok'],
      'normal root work was PERMITTED on the failed remount passage (the P2a exemption leak: normal root work must stay gated)',
    ).toBe(false)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- the remote failure envelope (dynamic surface)
    const workError = L6.workResponse['error'] as Record<string, any>
    expect(String(workError?.['code'] ?? '')).toBe('TEAM_CREATE_ROOT_WORK_DELIVERY_FAILED')
    expect(L6.rootFollowupsAfterWork - L6.rootFollowupsBeforeWork, 'zero root input on the normal-work passage').toBe(0)
    expect(L6.workAdmitted, 'the Phase A admission stays durable (the same-token retry keeps it)').toBe(true)
    expect(L6.rootWorkDelivered, 'no terminal root-work fact').toBeUndefined()

    // (2) THE CONTROL NOTIFICATION — DELIVERED to the pending-approval
    // leader (the liveness-preserved class). (RED shape: the pre-fix
    // notification rides the gated deliverRootInput — the verdict\'s
    // throw is swallowed by the service\'s liveness-failure sink: the
    // notification NEVER arrives and no follow-up records it.)
    expect(
      L6.controlNotifiedText,
      'the pending-approval leader was NEVER notified (the external P2a liveness hole: the control notification is swallowed by the gated work-input path)',
    ).toBeDefined()
    expect(
      String(L6.controlNotifiedText).startsWith('[team-control requestId='),
      'the notification is the rendered leader-approval text (the machine-dedup token leads)',
    ).toBe(true)
    expect(
      String(L6.controlNotifiedText).includes(L6.controlRequestId),
      'the notification names the EXACT requestId (the team_resolve_control argument)',
    ).toBe(true)
    expect(
      L6.rootFollowupsAfter - L6.rootFollowupsAfterWork,
      'the control notification is the ONLY root input after the gated work passage',
    ).toBe(1)
    expect(L6.slotLeaderAfter?.status, 'the remount failed (the liveness exemption does not heal the outage)').toBe('failed')
  })

  it('L7 (re-review P2b) — the PER-SCOPE recovery identity: the SAME mcpServer subject is REQUIRED in BOTH scopes (the TEAM scope — the v2 `teamRequirements` block — AND the WORKER template scope) — two distinct requirement occurrences with distinct scope identities. The recovery marker covers ONLY the team scope (`scopeKeys: [\'team\']` + the subject). The pre-fix verdict FLATTENS team + template into one subject set → the subject ∈ unavailableSubjects → EVERY occurrence exempt → the recovery re-run is DELIVERED (the worker-scope occurrence uncovered yet exempted — the defect). The fix preserves the per-scope occurrence identity (a required occurrence is exempt only when the marker matches BOTH the scope AND the subject of that specific occurrence — the scopeKeys are actually read) → the covered team occurrence stays exempt, but the uncovered WORKER-scope occurrence BLOCKS the delivery (zero input; the typed delivery failure)', () => {
    // The setup truth: B mounted at its first boundary; the probe
    // passage classified B's loss (the slot is the failed boundary
    // truth — the T1/L4c shape); the cooldown is rewound (the boundary
    // retry is admissible).
    expect(L7.slotBAtMount?.status, 'B mounted at its first boundary').toBe('mounted')
    expect(L7.slotBAfterProbe?.status, 'B classified failed by the probe passage').toBe('failed')

    // THE VERDICT (RED shape: the flattened subject set exempts EVERY
    // occurrence of the subject — the team-scope-only marker exempts
    // the WORKER-scope occurrence too → the recovery re-run is
    // DELIVERED and nothing throws).
    expect(
      L7.bThrown,
      'the uncovered worker-scope occurrence was NOT blocked (the external P2b gap: the verdict flattens the scopes — a team-scope-only marker exempts every occurrence of the subject)',
    ).toBeInstanceOf(TeamRuntimeError)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- the typed failure (dynamic surface)
    const thrown = L7.bThrown as Record<string, any>
    expect(String(thrown?.['code'] ?? '')).toBe(String(TEAM_RUNTIME_ERROR_CODES.WORK_DELIVERY_FAILED))
    expect(L7.bFollowupsAfter - L7.bFollowupsBefore, 'zero input on the uncovered-scope passage').toBe(0)
    expect(L7.slotBAfterRecovery?.status, 'the remount failed again (the block is the per-scope identity, not a remount success)').toBe('failed')
  })
})
