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
  opts: { workerReq: boolean; leaderReq: boolean; leaderCaps: boolean; workerCaps: boolean },
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
    '    complete: true',
  ]
  const lines: string[] = [
    '---',
    'schemaVersion: 2',
    `blueprintId: ${bpId}`,
    'revision: "1"',
    'leader:',
    '  templateId: leader',
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
    'teamRequirements: []',
    // The leader's mutation envelope (invariant 36): the work actions'
    // required ops (follow-up → assign-task; create-member → create-member;
    // send-message / report-progress for the member envelopes below).
    'teamEnvelope:',
    '  allow:',
    '    - assign-task',
    '    - create-member',
    '    - send-message',
    '    - report-progress',
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
})
