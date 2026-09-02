/**
 * t12a-h1-nullable-mcp.test.ts — T12-H1: the nullable MCP server contract.
 *
 * `config.mcpServer === null` means NO Team MCP server is configured. The
 * old glue dereferenced `config.mcpServer.name` unconditionally in
 * resolveConsumptionViews (and every downstream consumer assumed a facet
 * existed): a null server threw at the very first consumption view
 * derivation — boot and member setup could not run at all.
 *
 * Contract (asserted at the boundary):
 *   H1-1 boot + member setup with mcpServer: null must not throw — both
 *        the root and the seeded member settle live;
 *   H1-2 the consumption view stays valid with NO MCP facet:
 *        `mcpView === null` (member and root);
 *   H1-3 no reconcile/create attempt: no MCP plugin fiber is mounted on
 *        any agent (agentCtx.plugin never called);
 *   H1-4 control: with a CONFIGURED server the mcp facet exists
 *        (non-null view) — null is specific to the null-server case.
 *
 * The real glue + real resolvers run (bridge doubles); the agents double
 * settles the real agentSetup at the create boundary, which is exactly
 * where the old code dereferenced the null server.
 */
import { describe, expect, it } from 'vitest'
import { createLiveWorld } from './t12a-live-bridge.mjs'

const ROOT = 'session-t12a-h1-root'
const INSTANCE = 'inst-t12ah1member'
const CHILD = 'session-team-child-h1seed'

const memberRow = { childSessionId: CHILD, instanceId: INSTANCE }

// Acceptance world: no MCP server configured at all.
const world = await createLiveWorld({
  rootSessionId: ROOT,
  members: [memberRow],
  configOverrides: {
    mcpServer: null,
    seedMembers: [
      { instanceId: INSTANCE, templateId: 'tpl-t12a', label: 'member H1', childSessionId: CHILD },
    ],
  },
})
await world.binding.boot()

const rootHandle = world.agents.handles.get(ROOT)
const memberHandle = world.agents.handles.get(CHILD)

const memberView = world.binding.resolveConsumptionViews(CHILD) as {
  instanceId: string
  modelView: object
  mcpView: { allowed: boolean } | null
}
const rootView = world.binding.resolveConsumptionViews(ROOT) as {
  mcpView: { allowed: boolean } | null
}

// Control: a configured server (the bridge default) -> the mcp facet
// exists (the view is a facet object, not null).
const control = await createLiveWorld({ rootSessionId: 'session-t12a-h1-control' })
const controlView = control.binding.resolveConsumptionViews(control.rootSessionId) as {
  mcpView: { allowed: boolean } | null
}

describe('T12-H1 nullable MCP server config', () => {
  it('H1-1 boot + member setup with mcpServer: null must not throw (both agents settle live)', () => {
    expect(world.records.creates.length).toBe(2)
    expect(rootHandle !== undefined).toBe(true)
    expect(memberHandle !== undefined).toBe(true)
  })

  it('H1-2 the consumption view stays valid with no MCP facet (mcpView === null)', () => {
    expect(memberView.instanceId).toBe(INSTANCE)
    expect(memberView.mcpView).toBe(null)
    expect(rootView.mcpView).toBe(null)
  })

  it('H1-3 no reconcile/create attempt: no MCP plugin fiber mounted on any agent', () => {
    expect(rootHandle!.agent.ctx.plugins.length).toBe(0)
    expect(memberHandle!.agent.ctx.plugins.length).toBe(0)
  })

  it('H1-4 control: with a configured server the mcp facet exists (non-null)', () => {
    expect(controlView.mcpView !== null).toBe(true)
  })
})
