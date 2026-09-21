/**
 * multi-mcp-wiring.test.ts — multi-MCP quick-fix, Task C (RED-first).
 *
 * The multi-MCP cardinality completion (plan §2: production supply
 * `mcpServer: 0|1` → `mcpServers: 0..N`) pinned at the REAL live-glue
 * boundary (agent-bindings.mjs over the t12a-live-bridge doubles). Every
 * world drives the REAL glue (createAgentBindings) with the bridge's
 * double service surface; the MCP client fibers are doubles (per-server
 * activation via `agentCtx.plugin(mcpClient, { serverName, ... })`), so no
 * real ports are involved.
 *
 * The matrix is plan §6.1–§6.11 (P0 + P1):
 *
 *   6.1  P0 role split: configured {A,B,C}; leader allow [A,B]; expert-1
 *        allow [A]; expert-2 allow [B]; expert-3 deny; durable team
 *        override allow [A,B,C] → mounted: leader {A,B} / e1 {A} /
 *        e2 {B} / e3 {}.
 *   6.2  P0 legacy single-server compatibility: the old `mcpServer:
 *        { name, port }` form still yields configured {A} with the
 *        original single-MCP behavior (no regression).
 *   6.3  P0 zero-MCP: `mcpServers: []` (and the legacy `mcpServer: null`,
 *        pinned in t12a-h1-nullable-mcp.test.ts) → mcpViews = {}, empty
 *        mcpFibers, ZERO agentCtx.plugin(mcpClient, ...) calls — even when
 *        the template AND the durable policy both allow servers.
 *   6.4  P0 duplicate identity: the host-config validation rejects
 *        duplicate names (A's test surface — asserted here against A's
 *        helper per the boundary ruling); the read helper passes
 *        caller-validated input through as-is.
 *   6.5  P0 static template isolation: configured {A,B}, durable allow
 *        {A,B}, member template allow {A} → A mounted, B NOT mounted
 *        (guards against the "mcp cell allowed ⇒ mount ALL configured"
 *        regression).
 *   6.6  P0 durable instance-override isolation: initial member {A,B}; a
 *        durable INSTANCE override narrowing to allow {B} takes effect at
 *        the member's next boundary (A disposed, B remains — the SAME
 *        fiber, not a re-mount); a sibling member is untouched.
 *   6.7  P0 activation-failure rollback: target {A,B}, A starts, B's
 *        activation throws → setup/boundary fails, A's round fiber is
 *        rolled back, B leaves nothing, no partial newly-mounted set;
 *        + the safe ordering: old {A}, new target {B}, B fails → A was
 *        already deny-disposed (deny first), B left no partial fiber, the
 *        request does not proceed.
 *   6.8  P1 port=null: A valid port, B port=null. Case 1: only A allowed →
 *        A mounts, B's null port does NOT fail setup (an unused broken
 *        server blocks nothing). Case 2: B allowed → fail closed, the
 *        error names B.
 *   6.9  P1 cold resume: member-1 {A} / member-2 {B} → the effective sets
 *        survive the host restart (new fibers, same sets).
 *   6.10 P1 close/dispose: one agent with A+B → close() → A and B each
 *        disposed EXACTLY ONCE.
 *   6.11 P1 Permission Coverage Gate: a strict-permissions agent mounting
 *        A+B (each with one MCP tool) → the final-surface delta classifies
 *        both tools OTHER_MANAGED_MCP (never UNKNOWN_UNMANAGED) and the
 *        setup does not fail on the second MCP tool.
 *
 * RED-first (contract I7): on the int tip WITHOUT Task B the multi-server
 * worlds fail because the old glue reads only `config.mcpServer` (ignores
 * `mcpServers` — mounts nothing) and carries the old single-value state
 * shape (`mcpView`/`mcpFiber` singular); the legacy (6.2) and zero-MCP
 * (6.3) controls pass on both RED and GREEN. The per-case RED failure
 * shapes are recorded in
 * `dev/agent-workflow/evidence/multi-mcp/c-tests/red-*.log`.
 */
import { describe, expect, it } from 'vitest'
import { parseGovernanceOverride, type GovernanceOverrideRecord } from '../../storage/schema/index.js'
import {
  WORKTREE_ROOT,
  createAgentPresetsDouble,
  createLiveWorld,
  removeFixtureHome,
  withDshHome,
  writeDurableFixture,
  type AgentCtxDouble,
} from './t12a-live-bridge.mjs'
import { createP6T6World } from '../../tools/test/p6t6-helpers.js'
import { destroyP6T1World } from './p6t1-helpers.js'
import { configuredMcpServers, mcpSupplyValidationIssue } from '../src/plugin/mcp-supply.js'
import {
  evaluatePermissionCoverage,
  mcpIntroducedToolNames,
} from '../operation-permission/index.js'
import { PERMISSION_TOOL_NAMES } from '../../domain/blueprint/src/index.js'

// ── server identities (doubles — no real ports) ───────────────────────────
const A = 'mcp-alpha'
const B = 'mcp-beta'
const C = 'mcp-gamma'
const A_PORT = 3991
const B_PORT = 3992
const C_PORT = 3993
const LEGACY_SERVER = 't12a-mini-mcp' // the bridge's default configured mcpServer.name

const NOW_GEN1 = '2026-08-31T00:00:00.000Z'
const NOW_GEN2 = '2026-09-01T00:00:00.000Z'

// ── blueprint helpers (the closed-v1 capability block, all four sub-fields) ─
// `pad` = the template's KEY indentation ('  ' under `leader:`; '    ' after
// a `members:` sequence dash — the continuation keys of a block sequence
// mapping align with the first key after the dash).
function mcpAllowLines(pad: string, items: string[]): string[] {
  const sub = `${pad}  `
  const subsub = `${pad}    `
  if (items.length === 0) return [`${pad}mcp:`, `${sub}kind: allow`, `${sub}items: []`]
  return [`${pad}mcp:`, `${sub}kind: allow`, `${sub}items:`, ...items.map((i) => `${subsub}- ${i}`)]
}
function mcpDenyLines(pad: string): string[] {
  return [`${pad}mcp:`, `${pad}  kind: deny`]
}
function strictPermsLines(pad: string): string[] {
  const sub = `${pad}  `
  const subsub = `${pad}    `
  const subsubsub = `${pad}      `
  const lane = (name: string, tool: string): string[] => [
    `${sub}${name}:`,
    `${subsub}- tool: ${tool}`,
    `${subsubsub}resource:`,
    `${subsubsub}  kind: any`,
  ]
  return [`${pad}permissions:`, `${sub}default: ask`, ...lane('allow', 'read'), ...lane('ask', 'write'), ...lane('deny', 'lsp')]
}

interface TemplateSpec {
  readonly templateId: string
  readonly persona: string
  /** undefined = NO capabilities block (the legacy template); null/[] = deny; else allow items. */
  readonly mcpItems?: string[] | null
  readonly strictPermissions?: boolean
}

/** One template's body lines (persona + the optional capability block). */
function tplBodyLines(t: TemplateSpec, pad: string): string[] {
  const out = [`${pad}persona: "${t.persona}"`]
  if (t.mcpItems !== undefined) {
    const sub = `${pad}  `
    const subsub = `${pad}    `
    out.push(
      `${pad}capabilities:`,
      `${sub}teamTools:`,
      `${subsub}kind: deny`,
      `${sub}builtinToolDeny: []`,
      `${sub}skills:`,
      `${subsub}kind: allow`,
      `${subsub}items: []`,
      // The mcp / permissions entries are CAPABILITIES sub-fields (one
      // indent below the template keys, level with teamTools/skills).
      ...(t.mcpItems === null ? mcpDenyLines(sub) : mcpAllowLines(sub, t.mcpItems)),
      ...(t.strictPermissions ? strictPermsLines(sub) : []),
    )
  }
  return out
}

/** One blueprint (leader + member templates) as the row-config source. */
function buildBlueprint(blueprintId: string, leader: TemplateSpec, members: TemplateSpec[]): string {
  const lines = [
    '---',
    'schemaVersion: 1',
    `blueprintId: ${blueprintId}`,
    'revision: "1"',
    'leader:',
    `  templateId: ${leader.templateId}`,
    ...tplBodyLines(leader, '  '),
  ]
  if (members.length === 0) {
    // The memberless leader-only worlds: an explicit empty array (a bare
    // `members:` key would parse to null and fail the closed-v1 check).
    lines.push('members: []')
  } else {
    lines.push('members:')
    for (const m of members) {
      lines.push(`  - templateId: ${m.templateId}`, ...tplBodyLines(m, '    '))
    }
  }
  lines.push('requirements: []', 'memberEnvelopes: []', 'policyStates: []', 'metadata: {}', '---', '')
  return lines.join('\n')
}

// ── durable governance overrides (team / instance human-override, mcp cell) ─
function teamMcpAllow(
  rootSessionId: string,
  recordId: string,
  items: string[],
  generation = 1,
  updatedAt = NOW_GEN1,
): GovernanceOverrideRecord {
  return parseGovernanceOverride({
    schemaVersion: 2,
    kind: 'human-override',
    recordId,
    scope: 'team',
    rootSessionId,
    values: { mcp: { kind: 'allow', items } },
    generation,
    updatedAt,
  })
}
function instanceMcpAllow(
  rootSessionId: string,
  instanceId: string,
  recordId: string,
  items: string[],
): GovernanceOverrideRecord {
  return parseGovernanceOverride({
    schemaVersion: 2,
    kind: 'human-override',
    recordId,
    scope: 'instance',
    instanceId,
    rootSessionId,
    values: { mcp: { kind: 'allow', items } },
    generation: 2,
    updatedAt: NOW_GEN2,
  })
}

// ── the REAL thirteen-tool team stack (the shared teamToolsRef substrate; C1 adds the pending-list tool; the archive-member round adds team_archive_member) ─────
const p6t6 = await createP6T6World('multi-mcp-wiring')

// ── assertion helpers (the ctx doubles are separate scopes per agent) ──────
interface FiberRecord {
  readonly pluginSpec: unknown
  readonly options?: { serverName?: unknown; port?: unknown }
  disposed: boolean
  disposeCount: number
}
/** The recorded MCP world-mount fibers (scope plumbing is never recorded). */
function mcpFibers(ctx: AgentCtxDouble, serverName?: string): FiberRecord[] {
  return (ctx.plugins as unknown[]).filter((f): f is FiberRecord => {
    if (f === null || typeof f !== 'object') return false
    const name = (f as { options?: { serverName?: unknown } }).options?.serverName
    if (typeof name !== 'string') return false
    return serverName === undefined || name === serverName
  })
}
/** The distinct server names with a LIVE (not disposed) fiber, sorted. */
function liveServers(ctx: AgentCtxDouble): string[] {
  return [...new Set(mcpFibers(ctx).filter((f) => !f.disposed).map((f) => String(f.options?.serverName)))].sort()
}

/** The per-server consumption state (GREEN shape — contract I4/C5). */
interface McpStateShape {
  readonly mcpViews?: Record<string, { allowed: boolean; deniedBy?: { by: string; reason: string } }>
  readonly mcpFibers?: Map<string, unknown>
  readonly mcpActivationErrors?: Map<string, string>
  readonly a2c2PreMcpSurface?: readonly string[]
}
function mcpState(binding: object, sessionId: string): McpStateShape | undefined {
  const get = (binding as { getConsumptionState?: (sid: string) => unknown }).getConsumptionState
  return get === undefined ? undefined : (get.call(binding, sessionId) as McpStateShape | undefined)
}
function stateFiberKeys(state: McpStateShape | undefined): string[] {
  return state?.mcpFibers !== undefined ? [...state.mcpFibers.keys()].sort() : []
}
function stateViewKeys(state: McpStateShape | undefined): string[] {
  return state?.mcpViews !== undefined ? Object.keys(state.mcpViews).sort() : []
}

// ===========================================================================
// World W1 (6.1 role split + 6.10 close/dispose)
// ===========================================================================
const W1_ROOT = 'mm-w1-root'
const W1_E1 = 'mm-w1-child-e1'
const W1_E1I = 'inst-mmw1e1'
const W1_E2 = 'mm-w1-child-e2'
const W1_E2I = 'inst-mmw1e2'
const W1_E3 = 'mm-w1-child-e3'
const W1_E3I = 'inst-mmw1e3'
const W1_BLUEPRINT = buildBlueprint(
  'team.mm-w1',
  { templateId: 'leader', persona: 'You are the leader of the mm-w1 team.', mcpItems: [A, B] },
  [
    { templateId: 'tpl-e1', persona: 'You are expert-1.', mcpItems: [A] },
    { templateId: 'tpl-e2', persona: 'You are expert-2.', mcpItems: [B] },
    { templateId: 'tpl-e3', persona: 'You are expert-3.', mcpItems: null },
  ],
)
const w1 = await createLiveWorld({
  rootSessionId: W1_ROOT,
  teamTools: { tools: p6t6.tools },
  agentPresets: createAgentPresetsDouble(),
  members: [
    { childSessionId: W1_E1, instanceId: W1_E1I, templateId: 'tpl-e1' },
    { childSessionId: W1_E2, instanceId: W1_E2I, templateId: 'tpl-e2' },
    { childSessionId: W1_E3, instanceId: W1_E3I, templateId: 'tpl-e3' },
  ],
  overrides: [teamMcpAllow(W1_ROOT, 'mm-w1-allow-abc', [A, B, C])],
  configOverrides: {
    mcpServer: null,
    mcpServers: [
      { name: A, port: A_PORT },
      { name: B, port: B_PORT },
      { name: C, port: C_PORT },
    ],
    blueprintSource: W1_BLUEPRINT,
    seedMembers: [
      { instanceId: W1_E1I, templateId: 'tpl-e1', label: 'expert-1', childSessionId: W1_E1 },
      { instanceId: W1_E2I, templateId: 'tpl-e2', label: 'expert-2', childSessionId: W1_E2 },
      { instanceId: W1_E3I, templateId: 'tpl-e3', label: 'expert-3', childSessionId: W1_E3 },
    ],
  },
})
await w1.binding.boot()
const w1Leader = w1.agents.handles.get(W1_ROOT)!.agent.ctx
const w1E1 = w1.agents.handles.get(W1_E1)!.agent.ctx
const w1E2 = w1.agents.handles.get(W1_E2)!.agent.ctx
const w1E3 = w1.agents.handles.get(W1_E3)!.agent.ctx
const w1LeaderLive = liveServers(w1Leader)
const w1E1Live = liveServers(w1E1)
const w1E2Live = liveServers(w1E2)
const w1E3Live = liveServers(w1E3)
const w1LeaderState = mcpState(w1.binding, W1_ROOT)
const w1E3State = mcpState(w1.binding, W1_E3)
// Snapshot of the leader's live fiber keys BEFORE the 6.10 close() runs
// (close() disposes AND clears state.mcpFibers — the 6.1 state pin asserts
// against the pre-close snapshot; 6.10 pins the close itself).
const w1LeaderFiberKeysBeforeClose = stateFiberKeys(w1LeaderState)
// The leader's fiber OBJECTS (6.10 reads their dispose counts after close).
const w1LeaderFiberA = mcpFibers(w1Leader, A)[0]
const w1LeaderFiberB = mcpFibers(w1Leader, B)[0]

// ===========================================================================
// World W2 (6.2 legacy single-server compatibility — RED+GREEN control)
// ===========================================================================
const W2_ROOT = 'mm-w2-root'
const W2_M = 'mm-w2-child-m'
const W2_MI = 'inst-mmw2m'
const w2 = await createLiveWorld({
  rootSessionId: W2_ROOT,
  teamTools: { tools: p6t6.tools },
  agentPresets: createAgentPresetsDouble(),
  members: [{ childSessionId: W2_M, instanceId: W2_MI, templateId: 'tpl-t12a' }],
  overrides: [teamMcpAllow(W2_ROOT, 'mm-w2-allow-legacy', [LEGACY_SERVER])],
  configOverrides: {
    // NO mcpServers key and NO mcpServer override: the bridge's default
    // legacy single value ({ name: 't12a-mini-mcp', port: 3999 }) and the
    // default legacy blueprint (no capabilities) stay in force — the C7
    // path is exercised byte-for-byte.
    seedMembers: [{ instanceId: W2_MI, templateId: 'tpl-t12a', label: 'legacy member', childSessionId: W2_M }],
  },
})
await w2.binding.boot()
const w2Leader = w2.agents.handles.get(W2_ROOT)!.agent.ctx
const w2Member = w2.agents.handles.get(W2_M)!.agent.ctx
const w2LeaderLive = liveServers(w2Leader)
const w2MemberLive = liveServers(w2Member)
const w2LeaderState = mcpState(w2.binding, W2_ROOT)

// ===========================================================================
// World W3 (6.3 zero-MCP canonical form: mcpServers: [])
// ===========================================================================
const W3_ROOT = 'mm-w3-root'
const W3_M = 'mm-w3-child-m'
const W3_MI = 'inst-mmw3m'
const W3_BLUEPRINT = buildBlueprint(
  'team.mm-w3',
  // The policy side SAYS mount (template + durable allow) — the supply
  // side is empty, so nothing may mount: configured ∩ allowed = ∅.
  { templateId: 'leader', persona: 'You are the leader of the mm-w3 team.', mcpItems: [A] },
  [{ templateId: 'tpl-t12a', persona: 'You are member W3.', mcpItems: [A] }],
)
const w3 = await createLiveWorld({
  rootSessionId: W3_ROOT,
  teamTools: { tools: p6t6.tools },
  agentPresets: createAgentPresetsDouble(),
  members: [{ childSessionId: W3_M, instanceId: W3_MI, templateId: 'tpl-t12a' }],
  overrides: [teamMcpAllow(W3_ROOT, 'mm-w3-allow', [A, B, C])],
  configOverrides: {
    mcpServer: null,
    mcpServers: [],
    blueprintSource: W3_BLUEPRINT,
    seedMembers: [{ instanceId: W3_MI, templateId: 'tpl-t12a', label: 'zero member', childSessionId: W3_M }],
  },
})
await w3.binding.boot()
const w3Leader = w3.agents.handles.get(W3_ROOT)!.agent.ctx
const w3Member = w3.agents.handles.get(W3_M)!.agent.ctx
const w3LeaderState = mcpState(w3.binding, W3_ROOT)

// ===========================================================================
// World W4 (6.5 static template isolation: selective member vs legacy leader)
// ===========================================================================
const W4_ROOT = 'mm-w4-root'
const W4_M = 'mm-w4-child-m'
const W4_MI = 'inst-mmw4m'
const W4_BLUEPRINT = buildBlueprint(
  'team.mm-w4',
  // The LEADER is legacy (no capabilities): the durable decision alone →
  // BOTH configured+allowed servers mount (the 0.1.0-rc.1 behavior).
  { templateId: 'leader', persona: 'You are the leader of the mm-w4 team.' },
  // The MEMBER template allow-selects [A] only.
  [{ templateId: 'tpl-m', persona: 'You are member W4.', mcpItems: [A] }],
)
const w4 = await createLiveWorld({
  rootSessionId: W4_ROOT,
  teamTools: { tools: p6t6.tools },
  agentPresets: createAgentPresetsDouble(),
  members: [{ childSessionId: W4_M, instanceId: W4_MI, templateId: 'tpl-m' }],
  overrides: [teamMcpAllow(W4_ROOT, 'mm-w4-allow-ab', [A, B])],
  configOverrides: {
    mcpServer: null,
    mcpServers: [
      { name: A, port: A_PORT },
      { name: B, port: B_PORT },
    ],
    blueprintSource: W4_BLUEPRINT,
    seedMembers: [{ instanceId: W4_MI, templateId: 'tpl-m', label: 'member W4', childSessionId: W4_M }],
  },
})
await w4.binding.boot()
const w4Leader = w4.agents.handles.get(W4_ROOT)!.agent.ctx
const w4Member = w4.agents.handles.get(W4_M)!.agent.ctx
const w4MemberLive = liveServers(w4Member)
const w4MemberFiberB = mcpFibers(w4Member, B)
const w4MemberState = mcpState(w4.binding, W4_M)

// ===========================================================================
// World W5 (6.6 durable instance-override isolation at the next boundary)
// ===========================================================================
const W5_ROOT = 'mm-w5-root'
const W5_E1 = 'mm-w5-child-e1'
const W5_E1I = 'inst-mmw5e1'
const W5_E2 = 'mm-w5-child-e2'
const W5_E2I = 'inst-mmw5e2'
const W5_BLUEPRINT = buildBlueprint(
  'team.mm-w5',
  { templateId: 'leader', persona: 'You are the leader of the mm-w5 team.', mcpItems: [A, B] },
  [
    { templateId: 'tpl-e1', persona: 'You are expert-1 (W5).', mcpItems: [A, B] },
    { templateId: 'tpl-e2', persona: 'You are expert-2 (W5).', mcpItems: [A, B] },
  ],
)
// The shared override array: the bridge's domain double returns THIS
// reference on every overrides.list() read, so the next-boundary durable
// mutation is a push onto it (the backend-truth mutation the resolver
// re-reads — the T12 durable-mutation → actual-Agent-behavior edge).
const w5Overrides: GovernanceOverrideRecord[] = [teamMcpAllow(W5_ROOT, 'mm-w5-allow-ab', [A, B])]
const w5 = await createLiveWorld({
  rootSessionId: W5_ROOT,
  teamTools: { tools: p6t6.tools },
  agentPresets: createAgentPresetsDouble(),
  members: [
    { childSessionId: W5_E1, instanceId: W5_E1I, templateId: 'tpl-e1' },
    { childSessionId: W5_E2, instanceId: W5_E2I, templateId: 'tpl-e2' },
  ],
  overrides: w5Overrides,
  configOverrides: {
    mcpServer: null,
    mcpServers: [
      { name: A, port: A_PORT },
      { name: B, port: B_PORT },
    ],
    blueprintSource: W5_BLUEPRINT,
    seedMembers: [
      { instanceId: W5_E1I, templateId: 'tpl-e1', label: 'expert-1 (W5)', childSessionId: W5_E1 },
      { instanceId: W5_E2I, templateId: 'tpl-e2', label: 'expert-2 (W5)', childSessionId: W5_E2 },
    ],
  },
})
await w5.binding.boot()
const w5E1 = w5.agents.handles.get(W5_E1)!.agent.ctx
const w5E2 = w5.agents.handles.get(W5_E2)!.agent.ctx
const w5E1LiveBefore = liveServers(w5E1)
const w5E2LiveBefore = liveServers(w5E2)
const w5E1FiberA = mcpFibers(w5E1, A)[0]
const w5E1FiberB = mcpFibers(w5E1, B)[0]
const w5E2FiberA = mcpFibers(w5E2, A)[0]
const w5E2FiberB = mcpFibers(w5E2, B)[0]
// The durable next-boundary mutation: an INSTANCE-scope human-override
// narrowing member-1's mcp cell to allow [B] (instance records beat the
// team record — selectPolicyOverrides).
w5Overrides.push(instanceMcpAllow(W5_ROOT, W5_E1I, 'mm-w5-narrow-b', [B]))
await w5.binding.prepareAgentForRequest(W5_E1, W5_ROOT)
const w5E1LiveAfter = liveServers(w5E1)
const w5E2LiveAfter = liveServers(w5E2)
const w5E1StateAfter = mcpState(w5.binding, W5_E1)
const w5E2StateAfter = mcpState(w5.binding, W5_E2)

// ===========================================================================
// World W6 (6.7a activation failure at SETUP: A ok, B throws)
// ===========================================================================
const W6_ROOT = 'mm-w6-root'
const W6_BLUEPRINT = buildBlueprint(
  'team.mm-w6',
  { templateId: 'leader', persona: 'You are the leader of the mm-w6 team.', mcpItems: [A, B] },
  [],
)
const w6 = await createLiveWorld({
  rootSessionId: W6_ROOT,
  teamTools: { tools: p6t6.tools },
  agentPresets: createAgentPresetsDouble(),
  overrides: [teamMcpAllow(W6_ROOT, 'mm-w6-allow-ab', [A, B])],
  mcpFailures: { [B]: 'beta down (injected startup failure)' },
  configOverrides: {
    mcpServer: null,
    mcpServers: [
      { name: A, port: A_PORT },
      { name: B, port: B_PORT },
    ],
    blueprintSource: W6_BLUEPRINT,
  },
})
let w6BootError: unknown
try {
  await w6.binding.boot()
} catch (error) {
  w6BootError = error
}
const w6Leader = w6.agents.handles.get(W6_ROOT)!.agent.ctx
const w6LeaderState = mcpState(w6.binding, W6_ROOT)
const w6FiberA = mcpFibers(w6Leader, A)[0]
const w6FiberB = mcpFibers(w6Leader, B)[0]

// ===========================================================================
// World W6b (6.7b safe ordering: old {A}, new target {B}, B fails →
// A already deny-disposed, no partial B, the request does not proceed)
// ===========================================================================
const W6B_ROOT = 'mm-w6b-root'
const W6B_BLUEPRINT = buildBlueprint(
  'team.mm-w6b',
  { templateId: 'leader', persona: 'You are the leader of the mm-w6b team.', mcpItems: [A, B] },
  [],
)
const w6bOverrides: GovernanceOverrideRecord[] = [teamMcpAllow(W6B_ROOT, 'mm-w6b-allow-a', [A])]
const w6b = await createLiveWorld({
  rootSessionId: W6B_ROOT,
  teamTools: { tools: p6t6.tools },
  agentPresets: createAgentPresetsDouble(),
  overrides: w6bOverrides,
  mcpFailures: { [B]: 'beta down (boundary)' },
  configOverrides: {
    mcpServer: null,
    mcpServers: [
      { name: A, port: A_PORT },
      { name: B, port: B_PORT },
    ],
    blueprintSource: W6B_BLUEPRINT,
  },
})
await w6b.binding.boot()
const w6bLeader = w6b.agents.handles.get(W6B_ROOT)!.agent.ctx
const w6bLiveBefore = liveServers(w6bLeader)
const w6bFiberA = mcpFibers(w6bLeader, A)[0]
// The durable mutation flips the effective cell to allow [B] (gen 2 wins).
w6bOverrides.push(teamMcpAllow(W6B_ROOT, 'mm-w6b-narrow-b', [B], 2, NOW_GEN2))
let w6bBoundaryError: unknown
try {
  await w6b.binding.prepareAgentForRequest(W6B_ROOT, W6B_ROOT)
} catch (error) {
  w6bBoundaryError = error
}
const w6bLeaderStateAfter = mcpState(w6b.binding, W6B_ROOT)

// ===========================================================================
// World W7a/W7b (6.8 port=null: B is configured with port: null)
// ===========================================================================
const W7A_ROOT = 'mm-w7a-root'
const W7A_BLUEPRINT = buildBlueprint(
  'team.mm-w7a',
  // Only A is selected: B's null port must not matter (unused server).
  { templateId: 'leader', persona: 'You are the leader of the mm-w7a team.', mcpItems: [A] },
  [],
)
const w7a = await createLiveWorld({
  rootSessionId: W7A_ROOT,
  teamTools: { tools: p6t6.tools },
  agentPresets: createAgentPresetsDouble(),
  overrides: [teamMcpAllow(W7A_ROOT, 'mm-w7a-allow-ab', [A, B])],
  configOverrides: {
    mcpServer: null,
    mcpServers: [
      { name: A, port: A_PORT },
      { name: B, port: null },
    ],
    blueprintSource: W7A_BLUEPRINT,
  },
})
let w7aBootError: unknown
try {
  await w7a.binding.boot()
} catch (error) {
  w7aBootError = error
}
const w7aLeader = w7a.agents.handles.get(W7A_ROOT)!.agent.ctx
const w7aLive = liveServers(w7aLeader)

const W7B_ROOT = 'mm-w7b-root'
const W7B_BLUEPRINT = buildBlueprint(
  'team.mm-w7b',
  // B IS selected: the null port must fail closed and NAME B.
  { templateId: 'leader', persona: 'You are the leader of the mm-w7b team.', mcpItems: [A, B] },
  [],
)
const w7b = await createLiveWorld({
  rootSessionId: W7B_ROOT,
  teamTools: { tools: p6t6.tools },
  agentPresets: createAgentPresetsDouble(),
  overrides: [teamMcpAllow(W7B_ROOT, 'mm-w7b-allow-ab', [A, B])],
  configOverrides: {
    mcpServer: null,
    mcpServers: [
      { name: A, port: A_PORT },
      { name: B, port: null },
    ],
    blueprintSource: W7B_BLUEPRINT,
  },
})
let w7bBootError: unknown
try {
  await w7b.binding.boot()
} catch (error) {
  w7bBootError = error
}
const w7bLeader = w7b.agents.handles.get(W7B_ROOT)!.agent.ctx
const w7bLeaderState = mcpState(w7b.binding, W7B_ROOT)
const w7bFiberA = mcpFibers(w7bLeader, A)[0]

// ===========================================================================
// World W8 (6.9 cold resume: create phase → restart → resume phase)
// ===========================================================================
const W8_ROOT = 'mm-w8-root'
const W8_E1 = 'mm-w8-child-e1'
const W8_E1I = 'inst-mmw8e1'
const W8_E2 = 'mm-w8-child-e2'
const W8_E2I = 'inst-mmw8e2'
const W8_BLUEPRINT = buildBlueprint(
  'team.mm-w8',
  { templateId: 'leader', persona: 'You are the leader of the mm-w8 team.', mcpItems: [A, B] },
  [
    { templateId: 'tpl-e1', persona: 'You are expert-1 (W8).', mcpItems: [A] },
    { templateId: 'tpl-e2', persona: 'You are expert-2 (W8).', mcpItems: [B] },
  ],
)
const W8_ROWS = [
  { childSessionId: W8_E1, instanceId: W8_E1I, templateId: 'tpl-e1' },
  { childSessionId: W8_E2, instanceId: W8_E2I, templateId: 'tpl-e2' },
]
const W8_SEEDS = [
  { instanceId: W8_E1I, templateId: 'tpl-e1', label: 'expert-1 (W8)', childSessionId: W8_E1 },
  { instanceId: W8_E2I, templateId: 'tpl-e2', label: 'expert-2 (W8)', childSessionId: W8_E2 },
]
async function buildW8World(bootPhase: 'create' | 'resume') {
  const world = await createLiveWorld({
    rootSessionId: W8_ROOT,
    teamTools: { tools: p6t6.tools },
    agentPresets: createAgentPresetsDouble(),
    members: W8_ROWS,
    overrides: [teamMcpAllow(W8_ROOT, 'mm-w8-allow-ab', [A, B])],
    configOverrides: {
      bootPhase,
      mcpServer: null,
      mcpServers: [
        { name: A, port: A_PORT },
        { name: B, port: B_PORT },
      ],
      blueprintSource: W8_BLUEPRINT,
      seedMembers: bootPhase === 'create' ? W8_SEEDS : [],
    },
  })
  if (bootPhase === 'resume') {
    // The cold-resume restart: every bound session is durable on disk under
    // the fake DSH_HOME (the glue's sessionIsDurable gate sees them).
    const home = `${WORKTREE_ROOT}/.tmp-mm-w8-resume-home`
    await withDshHome(home, async () => {
      writeDurableFixture(home, W8_ROOT)
      writeDurableFixture(home, W8_E1)
      writeDurableFixture(home, W8_E2)
      await world.binding.boot()
    })
    removeFixtureHome(home)
  } else {
    await world.binding.boot()
  }
  return world
}
const w8Create = await buildW8World('create')
const w8cE1 = w8Create.agents.handles.get(W8_E1)!.agent.ctx
const w8cE2 = w8Create.agents.handles.get(W8_E2)!.agent.ctx
const w8cE1Live = liveServers(w8cE1)
const w8cE2Live = liveServers(w8cE2)
const w8Resume = await buildW8World('resume')
const w8rE1 = w8Resume.agents.handles.get(W8_E1)!.agent.ctx
const w8rE2 = w8Resume.agents.handles.get(W8_E2)!.agent.ctx
const w8rE1Live = liveServers(w8rE1)
const w8rE2Live = liveServers(w8rE2)

// ===========================================================================
// World W10 (6.11 Permission Coverage Gate over a dual-MCP strict agent)
// ===========================================================================
const W10_ROOT = 'mm-w10-root'
const W10_BLUEPRINT = buildBlueprint(
  'team.mm-w10',
  {
    templateId: 'leader',
    persona: 'You are the leader of the mm-w10 team.',
    mcpItems: [A, B],
    strictPermissions: true,
  },
  [],
)
/** The minimal permissive control service (the a6a spy shape, setup path). */
function makeStubControlService() {
  return {
    async requestControl(args: { kind: string }) {
      return { requestId: 'mm-w10-req-1', kind: String(args.kind) }
    },
    async awaitControlDecision(input: { requestId: string }) {
      return { requestId: input.requestId, decision: 'allow' as const, decisionSequence: 1 }
    },
    async guardOperation(): Promise<{ allowed: boolean; requestId: string; decisionSequence: number }> {
      return { allowed: true, requestId: 'mm-w10-req-1', decisionSequence: 1 }
    },
    async checkExternalOperation(): Promise<{ allowed: boolean }> {
      return { allowed: true }
    },
  }
}
const w10 = await createLiveWorld({
  rootSessionId: W10_ROOT,
  teamTools: { tools: p6t6.tools },
  agentPresets: createAgentPresetsDouble(),
  overrides: [teamMcpAllow(W10_ROOT, 'mm-w10-allow-ab', [A, B])],
  mcpToolNames: { [A]: ['mcp_alpha_probe'], [B]: ['mcp_beta_probe'] },
  controlServiceRef: { current: makeStubControlService() },
  configOverrides: {
    mcpServer: null,
    mcpServers: [
      { name: A, port: A_PORT },
      { name: B, port: B_PORT },
    ],
    blueprintSource: W10_BLUEPRINT,
  },
})
let w10BootError: unknown
try {
  await w10.binding.boot()
} catch (error) {
  w10BootError = error
}
const w10Leader = w10.agents.handles.get(W10_ROOT)!.agent.ctx
const w10FinalSurface = w10Leader.tools.schemas().map((s) => String(s.name)).sort()
const w10State = mcpState(w10.binding, W10_ROOT)
const w10PreSurface = w10State?.a2c2PreMcpSurface
const w10Delta =
  w10PreSurface !== undefined ? mcpIntroducedToolNames(w10PreSurface, w10FinalSurface) : undefined
const w10Verdict =
  w10Delta !== undefined
    ? evaluatePermissionCoverage(w10FinalSurface, {
        managedToolNames: PERMISSION_TOOL_NAMES,
        teamToolNames: [],
        mcpToolNames: w10Delta,
      })
    : undefined

// ===========================================================================
// 6.10 — the W1 close() (the leader's A+B fibers, disposed exactly once)
// ===========================================================================
await w1.binding.close()
const w1CloseA = w1LeaderFiberA?.disposeCount ?? 0
const w1CloseB = w1LeaderFiberB?.disposeCount ?? 0

// Tear down the shared p6t6 stack (the file's only non-bridge resource).
await destroyP6T1World(p6t6.world)

// ===========================================================================
// Assertions
// ===========================================================================

describe('multi-MCP 6.1 — the role split (the core regression): configured {A,B,C} × per-template mcp', () => {
  it('leader (allow [A,B]) mounts exactly {A, B}', () => {
    expect(w1LeaderLive).toEqual([A, B])
  })
  it('expert-1 (allow [A]) mounts exactly {A}', () => {
    expect(w1E1Live).toEqual([A])
  })
  it('expert-2 (allow [B]) mounts exactly {B}', () => {
    expect(w1E2Live).toEqual([B])
  })
  it('expert-3 (deny) mounts NOTHING (the template deny wins over the durable allow)', () => {
    expect(w1E3Live).toEqual([])
  })
  it('expert-3: configured ∩ durable-allow is non-empty yet zero fibers (the static gate is per-template)', () => {
    // C itself is configured + durably allowed, and A/B too — the deny
    // lane alone produces the zero set.
    expect(mcpFibers(w1E3).length).toBe(0)
  })
  it('per-server live state: the leader mcpFibers keys are exactly [A, B] (contract I4/C5)', () => {
    expect(w1LeaderState !== undefined).toBe(true)
    expect(w1LeaderState?.mcpFibers !== undefined).toBe(true)
    // The keys are read from the PRE-CLOSE snapshot: the 6.10 close() below
    // disposes and clears state.mcpFibers, so the live Map is empty by the
    // time this assertion runs. The snapshot is the live-set evidence.
    expect(w1LeaderFiberKeysBeforeClose).toEqual([A, B])
  })
  it('per-server views: every CONFIGURED server carries a view (leader mcpViews keys = [A, B, C])', () => {
    expect(stateViewKeys(w1LeaderState)).toEqual([A, B, C])
  })
  it('per-server views: expert-3 has all three views but ZERO fibers (views ≠ mounts)', () => {
    expect(stateViewKeys(w1E3State)).toEqual([A, B, C])
    expect(stateFiberKeys(w1E3State)).toEqual([])
  })
})

describe('multi-MCP 6.2 — legacy single-server compatibility (the C7 control)', () => {
  it('the legacy mcpServer {name, port} config still mounts the single configured server (leader)', () => {
    expect(w2LeaderLive).toEqual([LEGACY_SERVER])
  })
  it('the legacy member (no capabilities: the durable decision alone) mounts the same server', () => {
    expect(w2MemberLive).toEqual([LEGACY_SERVER])
  })
  it('per-server state: the legacy form yields exactly one configured server (mcpViews/mcpFibers keys)', () => {
    expect(stateViewKeys(w2LeaderState)).toEqual([LEGACY_SERVER])
    expect(stateFiberKeys(w2LeaderState)).toEqual([LEGACY_SERVER])
  })
})

describe('multi-MCP 6.3 — the zero-MCP contract (mcpServers: [])', () => {
  it('no MCP plugin fiber is mounted on any agent (zero agentCtx.plugin(mcpClient, ...) calls)', () => {
    expect(mcpFibers(w3Leader).length).toBe(0)
    expect(mcpFibers(w3Member).length).toBe(0)
    // Scope plumbing is never recorded, so plugins.length is the world-mount count.
    expect((w3Leader.plugins as unknown[]).length).toBe(0)
    expect((w3Member.plugins as unknown[]).length).toBe(0)
  })
  it('the per-server views are the empty object (even though template AND durable allow A)', () => {
    expect(w3LeaderState?.mcpViews ?? {}).toEqual({})
  })
  it('the per-server fibers are empty', () => {
    expect(stateFiberKeys(w3LeaderState)).toEqual([])
  })
})

describe('multi-MCP 6.4 — duplicate identity (the boundary with A)', () => {
  it('the host-config validation rejects the duplicate name (A mcpSupplyValidationIssue)', () => {
    const dup = {
      mcpServer: null,
      mcpServers: [
        { name: 'dup', port: 3991 },
        { name: 'dup', port: 3992 },
      ],
    }
    expect(mcpSupplyValidationIssue(dup as never)).toBe("duplicate mcpServers name 'dup'")
  })
  it('the read helper passes caller-validated input through as-is (the uniqueness guard lives in validation, not the read path)', () => {
    // Boundary ruling (recorded in the I12 report): configuredMcpServers
    // is the canonical READ path over a caller-VALIDATED config (I1:
    // "mcpServers present → 原样返回"). A duplicate-name config that
    // bypassed host validation (direct bridge construction) therefore
    // returns BOTH entries as-is — the host is the only place duplicates
    // can exist, and it fail-closes them (the case above). Asserting the
    // helper's actual behavior here pins the boundary instead of
    // re-implementing validation in the read path.
    const dup = {
      mcpServer: null,
      mcpServers: [
        { name: 'dup', port: 3991 },
        { name: 'dup', port: 3992 },
      ],
    }
    const names = [...configuredMcpServers(dup as never)].map((s) => s.name)
    expect(names).toEqual(['dup', 'dup'])
  })
})

describe('multi-MCP 6.5 — static template isolation (selective member vs legacy leader)', () => {
  it('the member (template allow [A]) mounts A', () => {
    expect(w4MemberLive).toContain(A)
  })
  it('the member does NOT mount B (template allow [A] ∩ configured {A,B} = {A})', () => {
    expect(w4MemberLive).not.toContain(B)
    expect(w4MemberLive).toEqual([A])
  })
  it('no B fiber object exists on the member ctx at all (not mounted-then-disposed)', () => {
    expect(w4MemberFiberB.length).toBe(0)
  })
  it('the per-server state: the member mcpFibers keys are exactly [A] while mcpViews carry both configured servers', () => {
    expect(stateFiberKeys(w4MemberState)).toEqual([A])
    expect(stateViewKeys(w4MemberState)).toEqual([A, B])
  })
  it('the legacy leader (no capabilities) mounts both durable-allowed servers (the durable-only baseline)', () => {
    const leaderLive = liveServers(w4Leader)
    expect(leaderLive).toEqual([A, B])
  })
})

describe('multi-MCP 6.6 — durable instance-override isolation at the next boundary', () => {
  it('initial: the member mounts {A, B} at boot (the durable team allow)', () => {
    expect(w5E1LiveBefore).toEqual([A, B])
  })
  it('after the durable instance narrowing to allow [B]: A is disposed, B REMAINS (the same fiber, not a re-mount)', () => {
    expect(w5E1LiveAfter).toEqual([B])
    expect(w5E1FiberA?.disposed).toBe(true)
    expect(w5E1FiberB?.disposed).toBe(false)
    // Same fiber object from boot (the mount set kept B; deny-first only
    // disposed the dropped A).
    expect(w5E1FiberB !== undefined).toBe(true)
  })
  it('the per-server state reflects the narrowing: the member mcpFibers keys are [B]', () => {
    expect(stateFiberKeys(w5E1StateAfter)).toEqual([B])
  })
  it('the sibling member (no boundary ran, no instance record) is untouched: {A, B} still live', () => {
    expect(w5E2LiveAfter).toEqual([A, B])
    expect(w5E2FiberA?.disposed).toBe(false)
    expect(w5E2FiberB?.disposed).toBe(false)
    expect(stateFiberKeys(w5E2StateAfter)).toEqual([A, B])
  })
})

describe('multi-MCP 6.7a — activation failure at setup (A ok, B throws) rolls back the round', () => {
  it('the boot fails (the setup is fail closed)', () => {
    expect(w6BootError).not.toBe(undefined)
    expect(String((w6BootError as Error)?.message ?? w6BootError)).toContain('beta down')
  })
  it('A round fiber was created and is ROLLED BACK (disposed) — no partial newly-mounted set', () => {
    expect(w6FiberA?.disposed).toBe(true)
    expect(stateFiberKeys(w6LeaderState)).toEqual([])
  })
  it('B left nothing in the live state (no partial fiber committed)', () => {
    expect(w6FiberB !== undefined).toBe(true) // the fiber object exists (plugin() ran)
    expect(stateFiberKeys(w6LeaderState)).not.toContain(B)
  })
  it('the activation error is recorded on the failing server (contract I4 step 6)', () => {
    expect(w6LeaderState?.mcpActivationErrors?.get(B)).toBe('beta down (injected startup failure)')
  })
})

describe('multi-MCP 6.7b — the safe ordering (old {A}, new target {B}, B fails at the boundary)', () => {
  it('boot mounted exactly {A} (the durable allow [A] at gen 1)', () => {
    expect(w6bLiveBefore).toEqual([A])
  })
  it('the next boundary fails (the request does not proceed)', () => {
    expect(w6bBoundaryError).not.toBe(undefined)
    expect(String((w6bBoundaryError as Error)?.message ?? w6bBoundaryError)).toContain('beta down')
  })
  it('A was already removed (deny FIRST — the new policy denies A before B is mounted)', () => {
    expect(w6bFiberA?.disposed).toBe(true)
  })
  it('B left no partial fiber and the live state is empty', () => {
    expect(stateFiberKeys(w6bLeaderStateAfter)).toEqual([])
  })
  it('the activation error is recorded on the failing server', () => {
    expect(w6bLeaderStateAfter?.mcpActivationErrors?.get(B)).toBe('beta down (boundary)')
  })
})

describe('multi-MCP 6.8 — port=null exact behavior', () => {
  it('case 1: only A selected → setup SUCCEEDS, A mounts, B (port=null) is not selected and blocks nothing', () => {
    expect(w7aBootError).toBe(undefined)
    expect(w7aLive).toEqual([A])
    expect(mcpFibers(w7aLeader, B).length).toBe(0)
  })
  it('case 2: B selected → the boot fails closed and the error NAMES B', () => {
    expect(w7bBootError).not.toBe(undefined)
    expect(String((w7bBootError as Error)?.message ?? w7bBootError)).toContain(B)
  })
  it('case 2: no partial newly-mounted set (A was rolled back with the failed round)', () => {
    expect(stateFiberKeys(w7bLeaderState)).toEqual([])
  })
  it('case 2: A fiber was created but ROLLED BACK (the port-null round fails closed, nothing committed)', () => {
    expect(w7bFiberA?.disposed).toBe(true)
  })
})

describe('multi-MCP 6.9 — cold resume re-derives the same effective sets', () => {
  it('create phase: member-1 {A}, member-2 {B}', () => {
    expect(w8cE1Live).toEqual([A])
    expect(w8cE2Live).toEqual([B])
  })
  it('cold resume: the SAME effective sets (member-1 {A}, member-2 {B})', () => {
    expect(w8rE1Live).toEqual([A])
    expect(w8rE2Live).toEqual([B])
  })
  it('the resume re-bound every session (resumes, never re-creates)', () => {
    expect(w8Resume.records.creates.length).toBe(0)
    expect(w8Resume.records.resumes.length).toBe(3) // root + member-1 + member-2
  })
})

describe('multi-MCP 6.10 — close() disposes each server fiber exactly once', () => {
  it('the leader A fiber was disposed exactly once by close()', () => {
    expect(w1CloseA).toBe(1)
  })
  it('the leader B fiber was disposed exactly once by close()', () => {
    expect(w1CloseB).toBe(1)
  })
})

describe('multi-MCP 6.11 — the Permission Coverage Gate over a dual-MCP strict agent', () => {
  it('the setup succeeds (no coverage failure on the SECOND mcp tool)', () => {
    expect(w10BootError).toBe(undefined)
  })
  it('the final surface carries BOTH servers mcp tools (the proven mount additions)', () => {
    expect(w10FinalSurface).toContain('mcp_alpha_probe')
    expect(w10FinalSurface).toContain('mcp_beta_probe')
  })
  it('the proven delta across the MCP reconcile is exactly the two probe tools', () => {
    expect(w10PreSurface).not.toBe(undefined)
    expect(w10Delta).toEqual(['mcp_alpha_probe', 'mcp_beta_probe'])
  })
  it('both probe tools classify OTHER_MANAGED_MCP (never UNKNOWN_UNMANAGED) and the verdict passes', () => {
    expect(w10Verdict !== undefined).toBe(true)
    expect(w10Verdict!.ok).toBe(true)
    const byName = new Map(w10Verdict!.tools.map((t) => [t.name, t.classification]))
    expect(byName.get('mcp_alpha_probe')).toBe('other-managed-mcp')
    expect(byName.get('mcp_beta_probe')).toBe('other-managed-mcp')
  })
})
