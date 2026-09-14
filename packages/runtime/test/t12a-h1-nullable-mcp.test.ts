/**
 * t12a-h1-nullable-mcp.test.ts — T12-H1 → the multi-MCP zero-MCP contract.
 *
 * Original T12-H1: `config.mcpServer === null` means NO Team MCP server is
 * configured; the old glue dereferenced `config.mcpServer.name`
 * unconditionally and threw at the very first consumption view derivation.
 *
 * Multi-MCP migration (plan §6.3, contract I3): the zero-MCP condition is
 * now "no CONFIGURED server" — BOTH spellings of the config:
 *
 *   - legacy:    `mcpServer: null`            (the pre-multi-mcp spelling,
 *                 still accepted — C7; the original H1 case is preserved);
 *   - canonical: `mcpServers: []`             (the multi-MCP zero form).
 *
 * Contract (asserted at the boundary, per server):
 *   H1-1 boot + member setup with a zero-MCP config must not throw — both
 *        the root and the seeded member settle live (both spellings);
 *   H1-2 the consumption view stays valid with NO per-server MCP state:
 *        `mcpViews = {}` (zero views) for both spellings;
 *   H1-3 no reconcile/create attempt: no MCP plugin fiber is mounted on
 *        any agent (agentCtx.plugin(mcpClient, ...) never called) — even
 *        when the template AND the durable policy both ALLOW a server
 *        (configured ∩ allowed = ∅);
 *   H1-4 control: with a CONFIGURED server the per-server view EXISTS
 *        (a view object is derived for every configured server) — the
 *        zero state is specific to the zero-MCP config.
 *
 * The real glue + real resolvers run (bridge doubles); the agents double
 * settles the real agentSetup at the create boundary, which is exactly
 * where the pre-H1 code dereferenced the null server.
 *
 * RED note (contract I7): on the int tip WITHOUT Task B the per-server
 * state reads below degrade through the `?? {}` control fallbacks
 * (zero-MCP worlds behave identically on the old single-value runtime —
 * they mount nothing either way); the H1-4 control fails there because
 * the old views carry the singular `mcpView`, not `mcpViews` (recorded in
 * the RED evidence as the old-state-shape class).
 */
import { describe, expect, it } from 'vitest'
import { parseGovernanceOverride, type GovernanceOverrideRecord } from '../../storage/schema/index.js'
import { createAgentPresetsDouble, createLiveWorld } from './t12a-live-bridge.mjs'

const A = 'mcp-alpha'
const LEGACY_SERVER = 't12a-mini-mcp' // the bridge's default configured mcpServer.name

// ── the legacy-spelling world (the original T12-H1 case) ──────────────────
const ROOT_L = 'session-t12a-h1-root'
const INSTANCE_L = 'inst-t12ah1member'
const CHILD_L = 'session-team-child-h1seed'

const memberRowL = { childSessionId: CHILD_L, instanceId: INSTANCE_L, templateId: 'tpl-t12a' }

// Acceptance world: no MCP server configured at all (legacy spelling).
const worldL = await createLiveWorld({
  rootSessionId: ROOT_L,
  // D1 (v2): the member base-tool substrate (member paths fail closed
  // without it — this world drives a seeded member).
  agentPresets: createAgentPresetsDouble(),
  members: [memberRowL],
  configOverrides: {
    mcpServer: null,
    seedMembers: [
      { instanceId: INSTANCE_L, templateId: 'tpl-t12a', label: 'member H1', childSessionId: CHILD_L },
    ],
  },
})
await worldL.binding.boot()

// ── the canonical-spelling world (mcpServers: [] + policy says "allow") ──
const ROOT_C = 'session-t12a-h1c-root'
const INSTANCE_C = 'inst-t12ah1cmember'
const CHILD_C = 'session-team-child-h1cseed'

const memberRowC = { childSessionId: CHILD_C, instanceId: INSTANCE_C, templateId: 'tpl-t12a' }

// The zero-MCP blueprint: the policy side SAYS mount (both the template
// and the durable override allow server A) — the supply side is the empty
// `mcpServers: []`, so nothing may mount.
const ZERO_BP = [
  '---',
  'schemaVersion: 1',
  'blueprintId: team.t12a-h1c',
  'revision: "1"',
  'leader:',
  '  templateId: leader',
  '  persona: "You are the leader of the h1c test team."',
  '  capabilities:',
  '    teamTools:',
  '      kind: deny',
  '    builtinToolDeny: []',
  '    skills:',
  '      kind: allow',
  '      items: []',
  '    mcp:',
  '      kind: allow',
  '      items:',
  `        - ${A}`,
  'members:',
  '  - templateId: tpl-t12a',
  '    persona: "You are member H1C of the h1c test team."',
  '    capabilities:',
  '      teamTools:',
  '        kind: deny',
  '      builtinToolDeny: []',
  '      skills:',
  '        kind: allow',
  '        items: []',
  '      mcp:',
  '        kind: allow',
  '        items:',
  `          - ${A}`,
  'requirements: []',
  'memberEnvelopes: []',
  'policyStates: []',
  'metadata: {}',
  '---',
  '',
].join('\n')

// The durable override that ALLOWs the (unconfigured) server A.
const allowA: GovernanceOverrideRecord = parseGovernanceOverride({
  schemaVersion: 2,
  kind: 'human-override',
  recordId: 't12a-h1c-allow',
  scope: 'team',
  rootSessionId: ROOT_C,
  values: { mcp: { kind: 'allow', items: [A] } },
  generation: 1,
  updatedAt: '2026-08-31T00:00:00.000Z',
})

const worldC = await createLiveWorld({
  rootSessionId: ROOT_C,
  agentPresets: createAgentPresetsDouble(),
  members: [memberRowC],
  overrides: [allowA],
  configOverrides: {
    mcpServer: null,
    mcpServers: [],
    blueprintSource: ZERO_BP,
    seedMembers: [
      { instanceId: INSTANCE_C, templateId: 'tpl-t12a', label: 'member H1C', childSessionId: CHILD_C },
    ],
  },
})
await worldC.binding.boot()

// Control: a CONFIGURED server (the bridge default) -> the per-server
// view exists (a view object is derived for the configured server).
const control = await createLiveWorld({ rootSessionId: 'session-t12a-h1-control' })
await control.binding.boot()

// ── per-server view reads (GREEN shape; `?? {}` = the zero-control) ──────
type ViewsShape = { mcpViews?: Record<string, { allowed: boolean }> }
function viewsOf(binding: object, sessionId: string): Record<string, { allowed: boolean }> {
  const get = (binding as { resolveConsumptionViews?: (sid: string) => ViewsShape }).resolveConsumptionViews
  const views = get === undefined ? undefined : get.call(binding, sessionId)
  return views?.mcpViews ?? {}
}

const rootLViews = viewsOf(worldL.binding, ROOT_L)
const memberLViews = viewsOf(worldL.binding, CHILD_L)
const rootCViews = viewsOf(worldC.binding, ROOT_C)
const memberCViews = viewsOf(worldC.binding, CHILD_C)
const controlViews = viewsOf(control.binding, 'session-t12a-h1-control')

const rootL = worldL.agents.handles.get(ROOT_L)
const memberL = worldL.agents.handles.get(CHILD_L)
const rootC = worldC.agents.handles.get(ROOT_C)
const memberC = worldC.agents.handles.get(CHILD_C)

describe('the zero-MCP contract (multi-MCP migration of T12-H1)', () => {
  describe('legacy spelling: mcpServer: null (the original T12-H1 case)', () => {
    it('H1-1 boot + member setup must not throw (both agents settle live)', () => {
      expect(worldL.records.creates.length).toBe(2)
      expect(rootL !== undefined).toBe(true)
      expect(memberL !== undefined).toBe(true)
    })
    it('H1-2 the consumption view stays valid with no per-server MCP state (mcpViews = {})', () => {
      expect(rootLViews).toEqual({})
      expect(memberLViews).toEqual({})
    })
    it('H1-3 no reconcile/create attempt: no MCP plugin fiber mounted on any agent', () => {
      expect((rootL!.agent.ctx.plugins as unknown[]).length).toBe(0)
      expect((memberL!.agent.ctx.plugins as unknown[]).length).toBe(0)
    })
  })

  describe('canonical spelling: mcpServers: [] (the policy side still allows A)', () => {
    it('H1-1 boot + member setup must not throw (both agents settle live)', () => {
      expect(worldC.records.creates.length).toBe(2)
      expect(rootC !== undefined).toBe(true)
      expect(memberC !== undefined).toBe(true)
    })
    it('H1-2 the consumption view stays valid with no per-server MCP state (mcpViews = {})', () => {
      expect(rootCViews).toEqual({})
      expect(memberCViews).toEqual({})
    })
    it('H1-3 configured ∩ allowed = ∅: the template AND the durable allow name A, yet zero fibers', () => {
      expect((rootC!.agent.ctx.plugins as unknown[]).length).toBe(0)
      expect((memberC!.agent.ctx.plugins as unknown[]).length).toBe(0)
    })
  })

  it('H1-4 control: with a configured server the per-server view EXISTS (the zero state is config-specific)', () => {
    expect(Object.keys(controlViews)).toEqual([LEGACY_SERVER])
  })
})
