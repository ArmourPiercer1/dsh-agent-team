/**
 * mcp-blueprint-initial-grant.test.ts — the MCP INITIAL STATIC GRANT
 * regression over the REAL live glue (agent-bindings.mjs via the
 * t12a-live-bridge doubles). Plan:
 * docs/plans/active/MCP_BLUEPRINT_INITIAL_GRANT_FIX_PLAN.md §6 Gate B + C
 * (the glue-level half of the matrix; Gate D — the real-host
 * `team.create v2 -> open Root -> admitInitialWork` arc — lives in
 * tests/kits/mcp-initial-grant-smoke/).
 *
 * THE DEFECT (PR #16 evidence, plan §1): the bound Blueprint template's
 * `capabilities.mcp` (kind === 'allow') is the role's INITIAL governance
 * grant, but the production MCP facet resolution never fed it to the
 * governance resolver (`resolveActivationPolicy` resolved with
 * `template: {}`), so a fresh team with ZERO governance overrides resolved
 * the mcp cell `unspecified` -> `unspecifiedFailClosed` -> no mount. The
 * only way to mount an MCP was a manual `override.set` (the durable seed
 * that masked the bug in the PR #16 smoke).
 *
 * THE FIX UNDER TEST: the per-server `resolveDurableMcpFacet` call in
 * `resolveConsumptionViews` carries the optional `initialTemplateMcp`
 * (derived from the bound template's `capabilities.mcp` ONLY when
 * `kind === 'allow'`), placed at the policy resolver's `template` static
 * layer (provenance template/static). Fresh setup / cold resume / every
 * request boundary share the ONE derivation (plan §4.3). The record-backed
 * layers and the external hard facts keep their precedence; NO synthetic
 * durable override is created.
 *
 * Matrix (zero governance overrides on the initial paths — the RED shape
 * on the unfixed glue is `mcpViews[name].allowed = false` with
 * `deniedBy.reason = 'unspecifiedFailClosed'` and empty fiber sets):
 *
 *   B1 — fresh team, per-template role split (leader allow [A,B];
 *        worker-1 allow [A]; worker-2 allow [B]; worker-3 deny):
 *        mounted leader {A,B} / w1 {A} / w2 {B} / w3 {} — with NO
 *        governance override seed.
 *   B3 — the next REQUEST BOUNDARY re-resolution keeps the initial grant
 *        (it does not drop it: the leader stays {A,B}).
 *   B4 — a durable human `mcp deny` after creation: the NEXT boundary
 *        unmounts every server (the record-backed layer beats the static
 *        initial layer; the initial grant does not shield the mount).
 *   B5 — cross-root isolation (post-#18 bound-blueprint regression): two
 *        roots on ONE row, each bound to its OWN blueprint snapshot
 *        (Team-X leader allow [A] / Team-Y leader allow [B]) — each root
 *        initializes from its own bound template, never the row anchor or
 *        the other root's snapshot.
 *   C1 — cold resume with ZERO overrides: the initial grant is re-derived
 *        from the immutable bound Blueprint (not from any synthetic
 *        override) — the sets survive the host restart.
 *   L  — legacy control: a template WITHOUT `capabilities` + no overrides
 *        stays fail-closed (no silent MCP grant for legacy blueprints).
 *
 * @module @dsh-agent-team/runtime/test/mcp-blueprint-initial-grant
 */
import { describe, expect, it } from 'vitest'
import { scopeOf } from '@deepseek-ai/dsh-scope'
import { parseGovernanceOverride, type GovernanceOverrideRecord } from '../../storage/schema/index.js'
import { parseBlueprint, toBlueprintSnapshotRef } from '../../domain/blueprint/src/index.js'
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
import { destroyDir, scratchDir } from '../../testkit/fault-injection/file-seam.mjs'

// ── server identities (doubles — no real ports) ───────────────────────────
const A = 'mcp-alpha'
const B = 'mcp-beta'
const C = 'mcp-gamma'
const A_PORT = 3991
const B_PORT = 3992
const C_PORT = 3993

// ── blueprint helpers (the closed-v1 capability block, all four sub-fields) ─
function mcpAllowLines(pad: string, items: string[]): string[] {
  const sub = `${pad}  `
  const subsub = `${pad}    `
  if (items.length === 0) return [`${pad}mcp:`, `${sub}kind: allow`, `${sub}items: []`]
  return [`${pad}mcp:`, `${sub}kind: allow`, `${sub}items:`, ...items.map((i) => `${subsub}- ${i}`)]
}
function mcpDenyLines(pad: string): string[] {
  return [`${pad}mcp:`, `${pad}  kind: deny`]
}

interface TemplateSpec {
  readonly templateId: string
  readonly persona: string
  /** undefined = NO capabilities block (the legacy template); null = deny; else allow items. */
  readonly mcpItems?: string[] | null
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
      ...(t.mcpItems === null ? mcpDenyLines(sub) : mcpAllowLines(sub, t.mcpItems)),
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

// ── durable governance overrides (B4 tighten only — never an initial seed) ──
function teamMcpDeny(rootSessionId: string, recordId: string): GovernanceOverrideRecord {
  return parseGovernanceOverride({
    schemaVersion: 2,
    kind: 'human-override',
    recordId,
    scope: 'team',
    rootSessionId,
    values: { mcp: { kind: 'deny' } },
    generation: 1,
    updatedAt: '2026-09-20T00:00:00.000Z',
  })
}

// ── the REAL thirteen-tool team stack (the shared teamToolsRef substrate) ─────
// Pre-create cleanup: a leftover world dir (a crashed previous run) would
// break createTeamDomain with TEAM_DOMAIN_EXISTS (the p7t7 pattern).
destroyDir(scratchDir('mcp-initial-grant'))
const p6t6 = await createP6T6World('mcp-initial-grant')

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

/** The per-server consumption state (the GREEN shape — contract I4/C5). */
interface McpStateShape {
  readonly mcpViews?: Record<string, { allowed: boolean; source?: { layer?: string; origin?: string; recordId?: unknown }; deniedBy?: { by: string; reason: string } }>
  readonly mcpFibers?: Map<string, unknown>
}
function mcpState(binding: object, sessionId: string): McpStateShape | undefined {
  const get = (binding as { getConsumptionState?: (sid: string) => unknown }).getConsumptionState
  return get === undefined ? undefined : (get.call(binding, sessionId) as McpStateShape | undefined)
}

/**
 * A FROZEN snapshot of the per-server facet views (a JSON round-trip of
 * the plain view objects ONLY — the full live state is NOT structured-
 * cloneable: the mounted fibers can carry Module references in the
 * threads-pool context, and the boundary below re-writes state.mcpViews
 * in place, so the B1/B4 assertions must read frozen copies).
 */
type ViewSnapshot = Record<string, {
  allowed: boolean
  source?: { layer?: string; origin?: string; recordId?: unknown }
  deniedBy?: { by: string; reason: string } & Record<string, unknown>
}> | null
function snapshotViews(binding: object, sessionId: string): ViewSnapshot {
  const state = mcpState(binding, sessionId)
  if (state?.mcpViews === undefined) return null
  return JSON.parse(JSON.stringify(state.mcpViews)) as ViewSnapshot
}

// ===========================================================================
// World G1 (B1 role split + B3 boundary survival + B4 durable tighten)
// — ZERO governance overrides on the initial path (no override.set seed).
// ===========================================================================
const G1_ROOT = 'mg-g1-root'
const G1_W1 = 'mg-g1-child-w1'
const G1_W1I = 'inst-mgg1w1'
const G1_W2 = 'mg-g1-child-w2'
const G1_W2I = 'inst-mgg1w2'
const G1_W3 = 'mg-g1-child-w3'
const G1_W3I = 'inst-mgg1w3'
const G1_BLUEPRINT = buildBlueprint(
  'team.mg-g1',
  { templateId: 'leader', persona: 'You are the leader of the mg-g1 team.', mcpItems: [A, B] },
  [
    { templateId: 'tpl-w1', persona: 'You are worker-1.', mcpItems: [A] },
    { templateId: 'tpl-w2', persona: 'You are worker-2.', mcpItems: [B] },
    { templateId: 'tpl-w3', persona: 'You are worker-3.', mcpItems: null },
  ],
)
// The shared override array: EMPTY at the initial path. The bridge's domain
// double returns THIS reference on every overrides.list() read, so the B4
// durable tighten is a push onto it (the backend-truth mutation the
// resolver re-reads at the next boundary).
const g1Overrides: GovernanceOverrideRecord[] = []
const g1 = await createLiveWorld({
  rootSessionId: G1_ROOT,
  teamTools: { tools: p6t6.tools },
  agentPresets: createAgentPresetsDouble(),
  members: [
    { childSessionId: G1_W1, instanceId: G1_W1I, templateId: 'tpl-w1' },
    { childSessionId: G1_W2, instanceId: G1_W2I, templateId: 'tpl-w2' },
    { childSessionId: G1_W3, instanceId: G1_W3I, templateId: 'tpl-w3' },
  ],
  overrides: g1Overrides,
  configOverrides: {
    mcpServer: null,
    mcpServers: [
      { name: A, port: A_PORT },
      { name: B, port: B_PORT },
      { name: C, port: C_PORT },
    ],
    blueprintSource: G1_BLUEPRINT,
    seedMembers: [
      { instanceId: G1_W1I, templateId: 'tpl-w1', label: 'worker-1', childSessionId: G1_W1 },
      { instanceId: G1_W2I, templateId: 'tpl-w2', label: 'worker-2', childSessionId: G1_W2 },
      { instanceId: G1_W3I, templateId: 'tpl-w3', label: 'worker-3', childSessionId: G1_W3 },
    ],
  },
})
await g1.binding.boot()
const g1Leader = g1.agents.handles.get(G1_ROOT)!.agent.ctx
const g1W1 = g1.agents.handles.get(G1_W1)!.agent.ctx
const g1W2 = g1.agents.handles.get(G1_W2)!.agent.ctx
const g1W3 = g1.agents.handles.get(G1_W3)!.agent.ctx

// The PRE-TIGHTEN SNAPSHOTS (captured NOW — the B4 durable deny below
// mutates the shared override array, and the next leader boundary re-
// resolves + re-writes the LIVE consumption state object, so the B1
// assertions must read frozen copies of the initial-grant resolution —
// liveServers too: the B4 boundary disposes the leader's round fibers).
const g1OverridesAtBoot = g1Overrides.length
const g1LeaderLiveAtBoot = liveServers(g1Leader)
const g1LeaderViewsAtBoot = snapshotViews(g1.binding, G1_ROOT)
const g1W3ViewsAtBoot = snapshotViews(g1.binding, G1_W3)

// B3 — the next request boundary: re-resolution must keep the grant.
await g1.binding.prepareAgentForRequest(G1_ROOT, G1_ROOT)
await g1.binding.prepareAgentForRequest(G1_W1, G1_ROOT)
const g1LeaderLiveAfterBoundary = liveServers(g1Leader)
const g1W1LiveAfterBoundary = liveServers(g1W1)

// B4 — the durable tighten (team-scope human mcp deny) takes effect at the
// NEXT boundary: every server unmounts (the record-backed layer beats the
// static initial layer).
g1Overrides.push(teamMcpDeny(G1_ROOT, 'mg-g1-deny'))
await g1.binding.prepareAgentForRequest(G1_ROOT, G1_ROOT)
const g1LeaderLiveAfterDeny = liveServers(g1Leader)
const g1LeaderStateAfterDeny = mcpState(g1.binding, G1_ROOT)

// ===========================================================================
// World G2 (B5 cross-root isolation) — two roots, two bound blueprints,
// ONE row, ZERO overrides. Team-X leader allow [A]; Team-Y leader allow [B].
// Each root must initialize from its OWN bound snapshot (the row anchor is
// Team-X's blueprint — a row-anchor or cross-root leak would give Team-Y
// A instead of B).
// ===========================================================================
const G2_X_ROOT = 'mg-g2-x-root'
const G2_Y_ROOT = 'mg-g2-y-root'
const G2_X_BLUEPRINT = buildBlueprint(
  'team.mg-g2-x',
  { templateId: 'leader', persona: 'You are the leader of the mg-g2-x team.', mcpItems: [A] },
  [],
)
const G2_Y_BLUEPRINT = buildBlueprint(
  'team.mg-g2-y',
  { templateId: 'leader', persona: 'You are the leader of the mg-g2-y team.', mcpItems: [B] },
  [],
)
const G2_X_REF = toBlueprintSnapshotRef(parseBlueprint(G2_X_BLUEPRINT))
const G2_Y_REF = toBlueprintSnapshotRef(parseBlueprint(G2_Y_BLUEPRINT))
const g2 = await createLiveWorld({
  rootSessionId: G2_X_ROOT,
  teamTools: { tools: p6t6.tools },
  agentPresets: createAgentPresetsDouble(),
  teamSessions: [
    { rootSessionId: G2_X_ROOT, sessionId: G2_X_ROOT, blueprintId: G2_X_REF.blueprintId, generation: 1, blueprint: G2_X_REF },
    { rootSessionId: G2_Y_ROOT, sessionId: G2_Y_ROOT, blueprintId: G2_Y_REF.blueprintId, generation: 1, blueprint: G2_Y_REF },
  ],
  blueprintSources: [
    { blueprintId: G2_X_REF.blueprintId, revision: G2_X_REF.revision, source: G2_X_BLUEPRINT },
    { blueprintId: G2_Y_REF.blueprintId, revision: G2_Y_REF.revision, source: G2_Y_BLUEPRINT },
  ],
  overrides: [],
  configOverrides: {
    mcpServer: null,
    mcpServers: [
      { name: A, port: A_PORT },
      { name: B, port: B_PORT },
    ],
    // The row anchor is Team-X's blueprint — a resolver that fell back to
    // it for Team-Y would mount A on the wrong root (B5's exact leak).
    blueprintSource: G2_X_BLUEPRINT,
  },
})
await g2.binding.boot()
await g2.binding.createRootAgent(G2_Y_ROOT)
const g2XLeader = g2.agents.handles.get(G2_X_ROOT)!.agent.ctx
const g2YLeader = g2.agents.handles.get(G2_Y_ROOT)!.agent.ctx

// ===========================================================================
// World G3 (C1 cold resume) — ZERO overrides: create phase -> host restart
// -> resume phase. The initial grant is re-derived from the immutable bound
// Blueprint on resume (no synthetic override exists to lean on).
// ===========================================================================
const G3_ROOT = 'mg-g3-root'
const G3_W1 = 'mg-g3-child-w1'
const G3_W1I = 'inst-mgg3w1'
const G3_BLUEPRINT = buildBlueprint(
  'team.mg-g3',
  { templateId: 'leader', persona: 'You are the leader of the mg-g3 team.', mcpItems: [A, B] },
  [{ templateId: 'tpl-w1', persona: 'You are worker-1 (G3).', mcpItems: [A] }],
)
const G3_ROWS = [{ childSessionId: G3_W1, instanceId: G3_W1I, templateId: 'tpl-w1' }]
const G3_SEEDS = [{ instanceId: G3_W1I, templateId: 'tpl-w1', label: 'worker-1 (G3)', childSessionId: G3_W1 }]
async function buildG3World(bootPhase: 'create' | 'resume') {
  const world = await createLiveWorld({
    rootSessionId: G3_ROOT,
    teamTools: { tools: p6t6.tools },
    agentPresets: createAgentPresetsDouble(),
    members: G3_ROWS,
    overrides: [],
    configOverrides: {
      bootPhase,
      mcpServer: null,
      mcpServers: [
        { name: A, port: A_PORT },
        { name: B, port: B_PORT },
      ],
      blueprintSource: G3_BLUEPRINT,
      seedMembers: bootPhase === 'create' ? G3_SEEDS : [],
    },
  })
  if (bootPhase === 'resume') {
    // The cold-resume restart: every bound session is durable on disk under
    // the fake DSH_HOME (the glue's sessionIsDurable gate sees them).
    const home = `${WORKTREE_ROOT}/.tmp-mg-g3-resume-home`
    await withDshHome(home, async () => {
      writeDurableFixture(home, G3_ROOT)
      writeDurableFixture(home, G3_W1)
      await world.binding.boot()
    })
    removeFixtureHome(home)
  } else {
    await world.binding.boot()
  }
  return world
}
const g3Create = await buildG3World('create')
const g3cLeader = g3Create.agents.handles.get(G3_ROOT)!.agent.ctx
const g3cW1 = g3Create.agents.handles.get(G3_W1)!.agent.ctx
const g3Resume = await buildG3World('resume')
const g3rLeader = g3Resume.agents.handles.get(G3_ROOT)!.agent.ctx
const g3rW1 = g3Resume.agents.handles.get(G3_W1)!.agent.ctx

// ===========================================================================
// World G3V (C1 cold resume, versioned generation root) — the same cold
// resume as G3, but the durable logs on disk are VERSIONED generation roots
// (`session.v3.jsonl.zstd`) — the shape 0.1.5-rc.2's session persistence
// publishes after a resumed session has continued (real-host Gate D probe,
// run mgis-2026-09-20T09-58-57: all three sessions on disk as
// `session.v3.jsonl.zstd` while the v0-only sessionIsDurable match reported
// every one of them "neither live nor durable" and the created roots could
// never re-attach after a host restart). The eligibility gate must accept
// any canonical generation root, and the initial grant must be re-derived
// exactly as in G3.
// ===========================================================================
const G3V_ROOT = 'mg-g3v-root'
const G3V_W1 = 'mg-g3v-child-w1'
const G3V_W1I = 'inst-mgg3vw1'
const G3V_BLUEPRINT = buildBlueprint(
  'team.mg-g3v',
  { templateId: 'leader', persona: 'You are the leader of the mg-g3v team.', mcpItems: [A, B] },
  [{ templateId: 'tpl-w1', persona: 'You are worker-1 (G3V).', mcpItems: [A] }],
)
const G3V_ROWS = [{ childSessionId: G3V_W1, instanceId: G3V_W1I, templateId: 'tpl-w1' }]
{
  const world = await createLiveWorld({
    rootSessionId: G3V_ROOT,
    teamTools: { tools: p6t6.tools },
    agentPresets: createAgentPresetsDouble(),
    members: G3V_ROWS,
    overrides: [],
    configOverrides: {
      bootPhase: 'resume',
      mcpServer: null,
      mcpServers: [
        { name: A, port: A_PORT },
        { name: B, port: B_PORT },
      ],
      blueprintSource: G3V_BLUEPRINT,
      seedMembers: [],
    },
  })
  const homeV = `${WORKTREE_ROOT}/.tmp-mg-g3v-resume-home`
  await withDshHome(homeV, async () => {
    writeDurableFixture(homeV, G3V_ROOT, 'test-profile', 'session.v3.jsonl.zstd')
    writeDurableFixture(homeV, G3V_W1, 'test-profile', 'session.v3.jsonl.zstd')
    await world.binding.boot()
  })
  removeFixtureHome(homeV)
  const g3vLeader = world.agents.handles.get(G3V_ROOT)!.agent.ctx
  const g3vW1 = world.agents.handles.get(G3V_W1)!.agent.ctx
  it('G3V — cold resume with VERSIONED generation roots (session.v3.jsonl.zstd): the initial grant is re-derived exactly as with the v0 root', () => {
    expect(liveServers(g3vLeader)).toEqual([A, B])
    expect(liveServers(g3vW1)).toEqual([A])
  })
}

// ===========================================================================
// World L (the legacy control) — NO capabilities block + no overrides:
// fail-closed, nothing mounted (no silent grant for legacy templates).
// ===========================================================================
const L_ROOT = 'mg-l-root'
const L_BLUEPRINT = buildBlueprint(
  'team.mg-l',
  { templateId: 'leader', persona: 'You are the leader of the legacy team.', mcpItems: undefined },
  [],
)
const l = await createLiveWorld({
  rootSessionId: L_ROOT,
  teamTools: { tools: p6t6.tools },
  agentPresets: createAgentPresetsDouble(),
  overrides: [],
  configOverrides: {
    mcpServer: null,
    mcpServers: [
      { name: A, port: A_PORT },
      { name: B, port: B_PORT },
    ],
    blueprintSource: L_BLUEPRINT,
  },
})
await l.binding.boot()
const lLeader = l.agents.handles.get(L_ROOT)!.agent.ctx
const lLeaderState = mcpState(l.binding, L_ROOT)

// ===========================================================================
// World G4 (A4 glue half — empty allow normalization) — the template
// declares mcp allow with an EMPTY items list (a legal blueprint value, an
// ILLEGAL policy value). The glue normalizes it to "no initial grant":
// nothing mounts, NOTHING crashes (the agent is never broken by a
// blueprint-legal capability declaration).
// ===========================================================================
const G4_ROOT = 'mg-g4-root'
const G4_BLUEPRINT = buildBlueprint(
  'team.mg-g4',
  { templateId: 'leader', persona: 'You are the leader of the mg-g4 team.', mcpItems: [] },
  [],
)
const g4 = await createLiveWorld({
  rootSessionId: G4_ROOT,
  teamTools: { tools: p6t6.tools },
  agentPresets: createAgentPresetsDouble(),
  overrides: [],
  configOverrides: {
    mcpServer: null,
    mcpServers: [
      { name: A, port: A_PORT },
      { name: B, port: B_PORT },
    ],
    blueprintSource: G4_BLUEPRINT,
  },
})
await g4.binding.boot()
const g4Leader = g4.agents.handles.get(G4_ROOT)!.agent.ctx
const g4LeaderState = mcpState(g4.binding, G4_ROOT)
await g4.binding.prepareAgentForRequest(G4_ROOT, G4_ROOT) // the boundary must not break either
const g4LeaderLiveAfterBoundary = liveServers(g4Leader)

// ===========================================================================
// World D (PR #23 review fix P1-A — the state route's ROOTLESS re-
// resolution) — the exact production shape: two roots on ONE row, each
// bound to its OWN blueprint (Team-X allow [A]; Team-Y allow [B]), and
// the harness `__p6t6/state` route's rootless `resolveConsumptionViews(sid)`.
// Before the fix this path defaulted an absent teamRootSid to the BOOT
// root: the created root's session resolved under the boot root's
// blueprint + overrides -> the typed locate failure was swallowed by the
// broad catch -> state showed mounted=true / allowed=false /
// source=unspecified / deniedBy=unspecifiedFailClosed while the MCP was
// actually mounted, with only the `capability-template-unresolved`
// observation leaking. After the fix the owning root comes from the
// session's persisted `teamRootSessionId` (set at setup) / the durable
// domain ownership — never the boot root.
// ===========================================================================
const D_X_ROOT = 'mg-d-x-root'
const D_Y_ROOT = 'mg-d-y-root'
const D_X_BLUEPRINT = buildBlueprint(
  'team.mg-d-x',
  { templateId: 'leader', persona: 'You are the leader of the mg-d-x team.', mcpItems: [A] },
  [],
)
const D_Y_BLUEPRINT = buildBlueprint(
  'team.mg-d-y',
  { templateId: 'leader', persona: 'You are the leader of the mg-d-y team.', mcpItems: [B] },
  [],
)
const D_X_REF = toBlueprintSnapshotRef(parseBlueprint(D_X_BLUEPRINT))
const D_Y_REF = toBlueprintSnapshotRef(parseBlueprint(D_Y_BLUEPRINT))
// Per-root override arrays — the D-tighten push below is the backend-truth
// mutation the rootless re-resolution must re-read UNDER THE OWNING ROOT
// (a boot-root default would never see this array).
const dYOverrides: GovernanceOverrideRecord[] = []
const d = await createLiveWorld({
  rootSessionId: D_X_ROOT,
  teamTools: { tools: p6t6.tools },
  agentPresets: createAgentPresetsDouble(),
  teamSessions: [
    { rootSessionId: D_X_ROOT, sessionId: D_X_ROOT, blueprintId: D_X_REF.blueprintId, generation: 1, blueprint: D_X_REF },
    { rootSessionId: D_Y_ROOT, sessionId: D_Y_ROOT, blueprintId: D_Y_REF.blueprintId, generation: 1, blueprint: D_Y_REF },
  ],
  blueprintSources: [
    { blueprintId: D_X_REF.blueprintId, revision: D_X_REF.revision, source: D_X_BLUEPRINT },
    { blueprintId: D_Y_REF.blueprintId, revision: D_Y_REF.revision, source: D_Y_BLUEPRINT },
  ],
  overrides: [],
  overridesByRoot: { [D_Y_ROOT]: dYOverrides },
  configOverrides: {
    mcpServer: null,
    mcpServers: [
      { name: A, port: A_PORT },
      { name: B, port: B_PORT },
    ],
    // The row anchor is Team-X's blueprint — a boot-root default on the
    // rootless path would serve Team-Y from it (B5's leak, state-route form).
    blueprintSource: D_X_BLUEPRINT,
  },
})
await d.binding.boot()
await d.binding.createRootAgent(D_Y_ROOT)
// The STATE ROUTE path: rootless re-resolution (the harness contract —
// exactly the P1-A trigger).
const dYRootlessViews = d.binding.resolveConsumptionViews(D_Y_ROOT) as {
  instanceId: string
  teamRoot: string
  mcpViews: Record<string, { allowed: boolean; source?: { layer?: string; origin?: string; recordId?: unknown }; deniedBy?: { by: string; reason: string; recordId?: string } }>
}
const dXRootlessViews = d.binding.resolveConsumptionViews(D_X_ROOT) as typeof dYRootlessViews
const dYState = d.binding.getConsumptionState(D_Y_ROOT) as { teamRootSessionId?: string } | undefined
// The durable tighten ON THE CREATED ROOT's own override array (a
// team-scope human mcp deny) — the next rootless re-resolution must see it.
dYOverrides.push(teamMcpDeny(D_Y_ROOT, 'mg-d-y-deny'))
const dYRootlessViewsAfterDeny = d.binding.resolveConsumptionViews(D_Y_ROOT) as typeof dYRootlessViews
const dXRootlessViewsAfterDeny = d.binding.resolveConsumptionViews(D_X_ROOT) as typeof dYRootlessViews

// ===========================================================================
// World D2 (PR #23 review fix P1-B — a bound-blueprint RESOLUTION fault
// fails loud) — a created root whose bound blueprint is UNAVAILABLE
// (the resolver returns null: the snapshot is gone / unparseable). The
// rootless re-resolution MUST reject with the typed
// `capability-template-unresolved` error — the pre-fix broad catch
// swallowed it into "no initial grant" (an unspecified view for a broken
// identity, the exact P1-A leak channel).
// ===========================================================================
const D2_X_ROOT = 'mg-d2-x-root'
const D2_Y_ROOT = 'mg-d2-y-root'
const D2_X_BLUEPRINT = buildBlueprint(
  'team.mg-d2-x',
  { templateId: 'leader', persona: 'You are the leader of the mg-d2-x team.', mcpItems: [A] },
  [],
)
const D2_X_REF = toBlueprintSnapshotRef(parseBlueprint(D2_X_BLUEPRINT))
const d2 = await createLiveWorld({
  rootSessionId: D2_X_ROOT,
  teamTools: { tools: p6t6.tools },
  agentPresets: createAgentPresetsDouble(),
  teamSessions: [
    { rootSessionId: D2_X_ROOT, sessionId: D2_X_ROOT, blueprintId: D2_X_REF.blueprintId, generation: 1, blueprint: D2_X_REF },
    { rootSessionId: D2_Y_ROOT, sessionId: D2_Y_ROOT, blueprintId: D2_X_REF.blueprintId, generation: 1, blueprint: D2_X_REF },
  ],
  blueprintSources: [
    { blueprintId: D2_X_REF.blueprintId, revision: D2_X_REF.revision, source: D2_X_BLUEPRINT },
  ],
  overrides: [],
  resolveBoundBlueprint: (root: string) => {
    // The production-shaped fault: the created root's bound snapshot is
    // UNAVAILABLE (null) — the boot root's stays resolvable.
    return root === D2_X_ROOT ? parseBlueprint(D2_X_BLUEPRINT) : null
  },
  configOverrides: {
    mcpServer: null,
    mcpServers: [{ name: A, port: A_PORT }],
    blueprintSource: D2_X_BLUEPRINT,
  },
})
await d2.binding.boot()
let d2SetupError: unknown
try {
  await d2.binding.createRootAgent(D2_Y_ROOT)
} catch (error) {
  d2SetupError = error
}
let d2RootlessError: unknown
try {
  d2.binding.resolveConsumptionViews(D2_Y_ROOT)
} catch (error) {
  d2RootlessError = error
}

// ===========================================================================
// World S (PR #23 review fix, Finding 1 — the Agent-keyed MCP scope
// bridge) — the 0.1.5 host shape across DUPLICATE dsh-scope package
// instances: the setup ctx carries NO plugin-readable scope tag
// (mintScope: false) and no ctx.agent back-reference (legacyCtxAgent:
// false) — only the explicit AgentSetup agent. Two roots on ONE row,
// each bound to a template that allows the SAME mini-MCP serverName
// (`mcp-same`). Upstream mcp-client registers its per-serverName registry
// under `scopeOf(ctx) ?? ctx.root`: pre-fix both roots registered at the
// GLOBAL root -> the second mount rejected with "serverName ... is already
// in use". The bridge mints a PER-AGENT scope (keyed by the canonical
// runtime Agent) when the agent's own tag is unreadable, so each root's
// mounts live under their OWN scope — no cross-agent collision, no
// serverName rename, no shared cross-agent fiber scope.
// ===========================================================================
const S_A_ROOT = 'mg-s-a-root'
const S_B_ROOT = 'mg-s-b-root'
const S_SERVER = 'mcp-same'
const S_PORT = 3994
const S_A_BLUEPRINT = buildBlueprint(
  'team.mg-s-a',
  { templateId: 'leader', persona: 'You are the leader of the mg-s-a team.', mcpItems: [S_SERVER] },
  [],
)
const S_B_BLUEPRINT = buildBlueprint(
  'team.mg-s-b',
  { templateId: 'leader', persona: 'You are the leader of the mg-s-b team.', mcpItems: [S_SERVER] },
  [],
)
const S_A_REF = toBlueprintSnapshotRef(parseBlueprint(S_A_BLUEPRINT))
const S_B_REF = toBlueprintSnapshotRef(parseBlueprint(S_B_BLUEPRINT))
const s = await createLiveWorld({
  rootSessionId: S_A_ROOT,
  teamTools: { tools: p6t6.tools },
  agentPresets: createAgentPresetsDouble(),
  teamSessions: [
    { rootSessionId: S_A_ROOT, sessionId: S_A_ROOT, blueprintId: S_A_REF.blueprintId, generation: 1, blueprint: S_A_REF },
    { rootSessionId: S_B_ROOT, sessionId: S_B_ROOT, blueprintId: S_B_REF.blueprintId, generation: 1, blueprint: S_B_REF },
  ],
  blueprintSources: [
    { blueprintId: S_A_REF.blueprintId, revision: S_A_REF.revision, source: S_A_BLUEPRINT },
    { blueprintId: S_B_REF.blueprintId, revision: S_B_REF.revision, source: S_B_BLUEPRINT },
  ],
  overrides: [],
  // The 0.1.5 / duplicate-package-instance shape: the explicit agent is
  // passed, the ctx.agent back-reference is gone, and the scope tag is
  // UNREADABLE by the plugin (a second dsh-scope module instance).
  agents: { passExplicitAgent: true, legacyCtxAgent: false, mintScope: false },
  mcpToolNames: { [S_SERVER]: ['mcp__mcp-same__ping'] },
  configOverrides: {
    mcpServer: null,
    mcpServers: [{ name: S_SERVER, port: S_PORT }],
    blueprintSource: S_A_BLUEPRINT,
  },
})
await s.binding.boot()
await s.binding.createRootAgent(S_B_ROOT)
const sA = s.agents.handles.get(S_A_ROOT)!
const sB = s.agents.handles.get(S_B_ROOT)!
const sAState = s.binding.getConsumptionState(S_A_ROOT) as {
  mcpMountCtx?: object
  mcpMountScope?: { dispose(): Promise<void> }
} | undefined
const sBState = s.binding.getConsumptionState(S_B_ROOT) as typeof sAState

// ===========================================================================
// the matrix
// ===========================================================================

describe('B1 — fresh team role split from the Blueprint initial grant (ZERO overrides)', () => {
  it('the leader mounts exactly its template allow set {A,B}', () => {
    expect(g1OverridesAtBoot).toBe(0) // no initial seed (anti-cheat)
    expect(g1LeaderLiveAtBoot).toEqual([A, B])
  })
  it('worker-1 mounts exactly {A} (its own template, no cross-role leak)', () => {
    expect(liveServers(g1W1)).toEqual([A])
  })
  it('worker-2 mounts exactly {B} (its own template, no cross-role leak)', () => {
    expect(liveServers(g1W2)).toEqual([B])
  })
  it('worker-3 (template mcp deny) mounts nothing', () => {
    expect(liveServers(g1W3)).toEqual([])
  })
  it('the leader facet provenance is the STATIC template layer (no durable record)', () => {
    expect(g1LeaderViewsAtBoot?.[A]?.allowed).toBe(true)
    expect(g1LeaderViewsAtBoot?.[A]?.source).toEqual({ layer: 'template', origin: 'static', recordId: null })
    expect(g1LeaderViewsAtBoot?.[B]?.allowed).toBe(true)
    // C is configured but outside the leader allow list: never granted.
    expect(g1LeaderViewsAtBoot?.[C]?.allowed).toBe(false)
  })
  it('worker-3 facet: a template mcp DENY contributes no initial grant (unspecified cell; the static template gate blocks the mount)', () => {
    // Frozen semantics (plan §0.4/§4.1): only an explicit ALLOW enters the
    // governance cell as the initial static layer. A deny keeps the cell
    // at the unchanged unspecified baseline — the mount is still blocked,
    // by the static template gate (the second intersection layer).
    expect(g1W3ViewsAtBoot?.[A]?.allowed).toBe(false)
    expect(g1W3ViewsAtBoot?.[A]?.source?.layer).toBe('unspecified')
    expect(g1W3ViewsAtBoot?.[A]?.deniedBy?.['reason']).toBe('unspecifiedFailClosed')
  })
})

describe('B3 — the request-boundary re-resolution keeps the initial grant', () => {
  it('the leader still mounts {A,B} after its next boundary', () => {
    expect(g1LeaderLiveAfterBoundary).toEqual([A, B])
  })
  it('worker-1 still mounts exactly {A} after its next boundary', () => {
    expect(g1W1LiveAfterBoundary).toEqual([A])
  })
})

describe('B4 — a durable mcp deny beats the initial grant at the next boundary', () => {
  it('the leader unmounts everything after the deny + boundary', () => {
    expect(g1LeaderLiveAfterDeny).toEqual([])
  })
  it('the post-deny facet view is denied by the humanOverride record', () => {
    const view = g1LeaderStateAfterDeny?.mcpViews?.[A]
    expect(view?.allowed).toBe(false)
    expect(view?.deniedBy?.['by']).toBe('team')
    expect(view?.deniedBy?.['reason']).toBe('teamDeny')
    const deniedBy = view?.deniedBy as { recordId?: string } | undefined
    expect(deniedBy?.recordId).toBe('mg-g1-deny')
  })
})

describe('B5 — cross-root isolation (each root uses its OWN bound blueprint)', () => {
  it('Team-X leader mounts exactly {A} (its bound allow)', () => {
    expect(liveServers(g2XLeader)).toEqual([A])
  })
  it('Team-Y leader mounts exactly {B} (its bound allow — never the row anchor / Team-X snapshot)', () => {
    expect(liveServers(g2YLeader)).toEqual([B])
  })
})

describe('C1 — cold resume with zero overrides (the bound Blueprint re-derives the grant)', () => {
  it('create phase: leader {A,B}, worker {A} (initial grant)', () => {
    expect(liveServers(g3cLeader)).toEqual([A, B])
    expect(liveServers(g3cW1)).toEqual([A])
  })
  it('resume phase: the SAME sets survive the host restart (no override to lean on)', () => {
    expect(liveServers(g3rLeader)).toEqual([A, B])
    expect(liveServers(g3rW1)).toEqual([A])
  })
})

describe('L — legacy control: no capabilities + no overrides stays fail-closed', () => {
  it('nothing is mounted and the facet is the unchanged unspecified baseline', () => {
    expect(liveServers(lLeader)).toEqual([])
    expect(lLeaderState?.mcpViews?.[A]?.allowed).toBe(false)
    expect(lLeaderState?.mcpViews?.[A]?.source?.layer).toBe('unspecified')
    expect(lLeaderState?.mcpViews?.[A]?.deniedBy?.['reason']).toBe('unspecifiedFailClosed')
  })
})

describe('G4 — an empty template allow (allow[]) normalizes to "no grant" without breaking', () => {
  it('nothing mounts at setup and the facet stays the unspecified baseline (no malformed-input crash)', () => {
    expect(liveServers(g4Leader)).toEqual([])
    expect(g4LeaderState?.mcpViews?.[A]?.allowed).toBe(false)
    expect(g4LeaderState?.mcpViews?.[A]?.source?.layer).toBe('unspecified')
  })
  it('the next boundary re-resolution does not break either', () => {
    expect(g4LeaderLiveAfterBoundary).toEqual([])
  })
})

describe('D — the state route ROOTLESS re-resolution runs under the OWNING root (P1-A)', () => {
  it('the created root Y resolves under its OWN root: the template allow [B] is the effective grant', () => {
    expect(dYRootlessViews.teamRoot).toBe(D_Y_ROOT)
    expect(dYRootlessViews.mcpViews?.[B]?.allowed).toBe(true)
    expect(dYRootlessViews.mcpViews?.[B]?.source).toEqual({ layer: 'template', origin: 'static', recordId: null })
    expect(dYRootlessViews.mcpViews?.[B]?.deniedBy).toBeUndefined()
    // A is configured but outside Y's own template allow: never granted
    // (no boot-root / row-anchor / cross-root leak into the view).
    expect(dYRootlessViews.mcpViews?.[A]?.allowed).toBe(false)
  })
  it('the boot root X still resolves under its own root on the SAME rootless path', () => {
    expect(dXRootlessViews.teamRoot).toBe(D_X_ROOT)
    expect(dXRootlessViews.mcpViews?.[A]?.allowed).toBe(true)
    expect(dXRootlessViews.mcpViews?.[A]?.source).toEqual({ layer: 'template', origin: 'static', recordId: null })
  })
  it('the consumption state persists the owning root (teamRootSessionId)', () => {
    expect(dYState?.teamRootSessionId).toBe(D_Y_ROOT)
  })
  it('no capability-template-unresolved observation leaked (the P1-A swallowed-error channel is closed)', () => {
    for (const observation of d.binding.observations) {
      expect(observation).not.toContain('capability-template-unresolved')
    }
  })
  it('a durable mcp deny on the CREATED root is seen by the rootless re-resolution (overrides read under the owning root)', () => {
    const view = dYRootlessViewsAfterDeny.mcpViews?.[B]
    expect(view?.allowed).toBe(false)
    expect(view?.deniedBy?.by).toBe('team')
    expect(view?.deniedBy?.reason).toBe('teamDeny')
    expect(view?.deniedBy?.recordId).toBe('mg-d-y-deny')
  })
  it('the deny does NOT leak across roots: boot root X keeps its grant', () => {
    expect(dXRootlessViewsAfterDeny.mcpViews?.[A]?.allowed).toBe(true)
  })
})

describe('D2 — a bound-blueprint resolution fault FAILS LOUD (P1-B)', () => {
  it('the created root setup rejects with the typed capability-template-unresolved error (no half-state)', () => {
    expect(d2SetupError).toBeInstanceOf(Error)
    expect(d2SetupError).toMatchObject({
      code: 'capability-template-unresolved',
      reason: 'blueprint-unavailable',
    })
  })
  it('the rootless re-resolution rejects with the SAME typed error (never a swallowed unspecified view)', () => {
    expect(d2RootlessError).toBeInstanceOf(Error)
    expect(d2RootlessError).toMatchObject({
      code: 'capability-template-unresolved',
      reason: 'blueprint-unavailable',
    })
  })
  it('the boot root is unaffected (its own bound snapshot is resolvable)', () => {
    const views = d2.binding.resolveConsumptionViews(D2_X_ROOT) as { mcpViews?: Record<string, { allowed: boolean }> }
    expect(views.mcpViews?.[A]?.allowed).toBe(true)
  })
})

describe('S — the Agent-keyed MCP scope bridge (Finding 1: same serverName across agents)', () => {
  it('both agents mount the SAME serverName (no cross-agent duplicate collision)', () => {
    expect(liveServers(sAState!.mcpMountCtx as AgentCtxDouble)).toEqual([S_SERVER])
    expect(liveServers(sBState!.mcpMountCtx as AgentCtxDouble)).toEqual([S_SERVER])
  })
  it('each mount is registered under its OWN per-agent scope context (never a shared scope)', () => {
    expect(sAState?.mcpMountScope).toBeDefined()
    expect(sBState?.mcpMountScope).toBeDefined()
    expect(sAState?.mcpMountCtx).toBeDefined()
    expect(sBState?.mcpMountCtx).toBeDefined()
    // 0.1.5 shape: the agent's own ctx carries no readable tag — the
    // bridge minted a distinct per-agent context for the mounts.
    expect(sAState?.mcpMountCtx).not.toBe(sA.agent.ctx)
    expect(sBState?.mcpMountCtx).not.toBe(sB.agent.ctx)
    expect(sAState?.mcpMountCtx).not.toBe(sBState?.mcpMountCtx)
  })
  it('the per-agent scope is tagged with the canonical runtime Agent (the owner the co-located mcp-client registry reads)', () => {
    expect(scopeOf(sAState!.mcpMountCtx as never)).toBe(sA.agent)
    expect(scopeOf(sBState!.mcpMountCtx as never)).toBe(sB.agent)
  })
  it('both agents expose the SAME stable model-visible tool name (no root suffix, no rename)', () => {
    const namesOf = (ctx: AgentCtxDouble, agent: object) =>
      (ctx.tools.schemas(agent) as { name: string }[]).map((schema) => schema.name)
    expect(namesOf(sA.agent.ctx, sA.agent)).toContain('mcp__mcp-same__ping')
    expect(namesOf(sB.agent.ctx, sB.agent)).toContain('mcp__mcp-same__ping')
  })
})

describe('S0 — the common case: a readable agent scope tag keeps the zero-overhead passthrough', () => {
  it('no bridge scope is minted (mcpMountCtx IS the agent ctx itself)', () => {
    const state = mcpState(g1.binding, G1_ROOT) as { mcpMountCtx?: object; mcpMountScope?: object } | undefined
    expect(state?.mcpMountScope).toBeUndefined()
    expect(state?.mcpMountCtx).toBe(g1Leader)
  })
})

// The shared P6-T6 world's scratch dir is torn down with the file
// (the multi-mcp-wiring convention — a leftover world dir breaks the
// next run's createTeamDomain with TEAM_DOMAIN_EXISTS).
await destroyP6T1World(p6t6.world)
