/**
 * t12a-b3-external-deny.test.ts — T12-B3: the injected external hard facts
 * are honored at the REAL consumption/creation boundary.
 *
 * The old glue hardcoded `external = { hard: {}, capabilityExists: {} }`
 * inside resolveConsumptionViews: the host-injected ceiling
 * (config.externalPolicyFacts) was never consulted, so an external hard
 * DENY could be overridden by a team/member ALLOW in the ACTUAL agent
 * boundary (the selection installed through DSH's public
 * installModelSelection seam) even though the governance model says
 * external hard facts win over everything (invariant 34).
 *
 * Acceptance (asserted at the boundary — NOT the projection display):
 *   B3-1 external hard DENY + a human-override ALLOW for the SAME
 *        capability -> no selection in the consumption view
 *        (deniedBy: external / externalHardDeny);
 *   B3-2 the ACTUAL agent boundary (the real system-prompt/assemble
 *        waterfall listener installed by the glue's agentSetup at the
 *        member-creation boundary) carries the denied selection —
 *        neither the override-allowed model nor the baseline;
 *   B3-3 control: with EMPTY external facts the same human-override
 *        ALLOW resolves the allowed model — proving the override is
 *        genuinely in force and that the external deny (not anything
 *        else) is what denies the cell;
 *   B3-4 the external hard deny is capability-scoped: a model-only hard
 *        deny never denies the mcp facet by external.
 *
 * The real durable-consumption resolvers run (the bridge domain double
 * wires the production resolveDurableModelSelection /
 * resolveDurableMcpFacet); the agents double settles the real agentSetup
 * at the create boundary.
 */
import { describe, expect, it } from 'vitest'
import { parseGovernanceOverride, type GovernanceOverrideRecord } from '../../storage/schema/index.js'
import { createLiveWorld, observeAssembly } from './t12a-live-bridge.mjs'

const ROOT = 'session-t12a-b3-root'
const INSTANCE = 'inst-t12ab3member'
const CHILD = 'session-team-child-b3seed'
const ALLOWED_ITEM = 'prov-t12a/model-b3'

function humanAllow(recordId: string, items: string[]): GovernanceOverrideRecord {
  return parseGovernanceOverride({
    schemaVersion: 1,
    kind: 'human-override',
    recordId,
    scope: 'team',
    rootSessionId: ROOT,
    values: { model: { kind: 'allow', items } },
    generation: 1,
    updatedAt: '2026-08-31T00:00:00.000Z',
  })
}

const rAllow = humanAllow('t12a-b3-allow', [ALLOWED_ITEM])
const memberRow = { childSessionId: CHILD, instanceId: INSTANCE }

async function buildWorld(externalPolicyFacts: Record<string, unknown>) {
  const world = await createLiveWorld({
    rootSessionId: ROOT,
    members: [memberRow],
    overrides: [rAllow],
    configOverrides: {
      externalPolicyFacts,
      seedMembers: [
        { instanceId: INSTANCE, templateId: 'tpl-t12a', label: 'member B3', childSessionId: CHILD },
      ],
    },
  })
  await world.binding.boot()
  return world
}

// The acceptance world: external hard DENY on the model capability,
// capability present, plus the team-scope human-override ALLOW.
const denied = await buildWorld({
  hard: { model: { kind: 'deny' } },
  capabilityExists: { model: true },
})
// The control world: identical, but EMPTY external facts (the pre-B3
// hardcoded shape) — the override alone must ALLOW the model.
const control = await buildWorld({ hard: {}, capabilityExists: {} })

const deniedHandle = denied.agents.handles.get(CHILD)
const controlHandle = control.agents.handles.get(CHILD)
const deniedView = denied.binding.resolveConsumptionViews(CHILD) as {
  instanceId: string
  modelView: {
    selection: { provider: string; model: string } | undefined
    unavailable: boolean
    deniedBy: { by: string; reason: string } | undefined
  }
  mcpView: { allowed: boolean; deniedBy: { by: string; reason: string } | undefined }
}
const controlView = control.binding.resolveConsumptionViews(CHILD) as {
  modelView: { selection: { provider: string; model: string } | undefined }
}

// The ACTUAL agent boundary at the creation point: the real
// system-prompt/assemble listener the glue installed via DSH's public
// installModelSelection seam, invoked with the minimal assembled payload.
const deniedAssembly = (await observeAssembly(deniedHandle!.agent.ctx)) as {
  variables: Record<string, unknown>
}
const controlAssembly = (await observeAssembly(controlHandle!.agent.ctx)) as {
  variables: Record<string, unknown>
}

describe('T12-B3 external hard facts at the consumption boundary', () => {
  it('B3-1 external hard DENY + override ALLOW for the same capability -> no selection in the consumption view', () => {
    expect(deniedView.instanceId).toBe(INSTANCE)
    expect(deniedView.modelView.selection).toBe(undefined)
    // `unavailable` is the capabilityMissing flag; an external hard DENY is
    // carried by `deniedBy` (a deny is never silently allowed, and it is a
    // different provenance than a missing capability).
    expect(deniedView.modelView.unavailable).toBe(false)
    expect(deniedView.modelView.deniedBy!.by).toBe('external')
    expect(deniedView.modelView.deniedBy!.reason).toBe('externalHardDeny')
  })

  it('B3-2 the ACTUAL agent boundary installs the denied selection (not the allowed model, not the baseline)', () => {
    expect(deniedAssembly.variables.provider).toBe('t12a-denied')
    expect(deniedAssembly.variables.model).toBe('t12a-denied-model')
    expect(deniedAssembly.variables.provider).not.toBe('prov-t12a')
    expect(deniedAssembly.variables.model).not.toBe('t12a-baseline-model')
  })

  it('B3-3 control: with empty external facts the same override ALLOWs the model (the override is genuinely in force)', () => {
    expect(controlView.modelView.selection).toEqual({ provider: 'prov-t12a', model: 'model-b3' })
    expect(controlAssembly.variables.provider).toBe('prov-t12a')
    expect(controlAssembly.variables.model).toBe('model-b3')
  })

  it('B3-4 the external hard deny is capability-scoped: the model-only deny never denies the mcp facet by external', () => {
    const mcpDeniedBy = deniedView.mcpView.deniedBy
    const deniedByExternal = mcpDeniedBy !== undefined && mcpDeniedBy.by === 'external'
    expect(deniedByExternal).toBe(false)
  })
})
