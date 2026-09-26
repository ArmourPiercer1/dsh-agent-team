/**
 * Gate D — activation step-8 composition contract (the model-preference
 * routing fix).
 *
 * The target is NOT the Agent request (that is Gate E over the live glue) —
 * it is the effective policy resolved at MEMBER CREATION: the step-8
 * `resolveActivationPolicy` must already see the template's static model
 * grant, so the policy is correct from the very first moment of the
 * member's life — and NO synthetic durable record is ever created to fake
 * it (the bound Blueprint snapshot is the sole source).
 *
 * SCOPE (review-supplement P2-4 §5): this leg is a COMPOSITION CONTRACT —
 * the step-8 composition of
 * `initialTemplateModelGrantOf(template, ports.staticModel)` +
 * `initialMcpGrantOf(staticCapabilitiesOf(blueprint, template))` + the
 * generic `templateValues`, run through the SAME `resolveActivationPolicy`
 * the provider calls. Each case activates a real member through the real
 * provider over a real durable world (so `activate` does not crash and no
 * override row is generated), and then RE-RUNS that composition to pin the
 * step-8 policy layer. This is NOT a direct read of the ActivationProvider's
 * internal frozen policy (the frozen result no longer re-exposes it), and it
 * does not alone prove that `provider.ts` calls
 * `initialTemplateModelGrantOf` at step 8.
 *
 * The PROVIDER WIRING's FINAL BEHAVIOR (the real provider actually feeding
 * the template grant into the frozen policy, and the real live request
 * boundary consuming it) is CLOSED BY Gate E (the live glue over the real
 * world) + real-host R1/R2 (the actual provider request `body.model`).
 *
 * @module @dsh-agent-team/runtime/test/model-activation-step8
 */

import { describe, expect, it } from 'vitest'

import {
  initialMcpGrantOf,
  staticCapabilitiesOf,
} from '../../domain/policy/src/index.js'
import { resolveActivationPolicy } from '../activation/index.js'
import {
  initialTemplateModelGrantOf,
} from '../agent-setup/model/index.js'
import {
  P6T1_FIXTURE,
  P6T1_FIXTURE_STATIC_MODEL,
  createP6T1World,
  destroyP6T1World,
  makeEnvironmentFacts,
  makeRequest,
} from './p6t1-helpers.js'

// ── blueprint fixtures (worker template modelPreference variants) ────────────

function blueprintSource(
  workerModelPreference: string | undefined,
  workerMcpAllow: string[] | null | undefined,
): string {
  const mcpEntry =
    workerMcpAllow === null
      ? ['      mcp:', '        kind: deny']
      : workerMcpAllow === undefined
        ? ['      mcp:', '        kind: allow', '        items: []']
        : [
            '      mcp:',
            '        kind: allow',
            ...(workerMcpAllow.length > 0
              ? ['        items:', ...workerMcpAllow.map((s) => `          - ${s}`)]
              : ['        items: []']),
          ]
  const workerMcp =
    workerMcpAllow === undefined
      ? []
      : [
          '    capabilities:',
          '      teamTools:',
          '        kind: allow',
          '        items:',
          '          - create-member',
          '          - assign-task',
          '      builtinToolDeny: []',
          '      skills:',
          '        kind: allow',
          '        items: []',
          ...mcpEntry,
        ]
  return [
    '---',
    'schemaVersion: 1',
    'blueprintId: P6T1-BP',
    'revision: "1"',
    'leader:',
    '  templateId: leader',
    '  persona: You lead the P6T1 team.',
    'members:',
    '  - templateId: worker',
    '    displayName: Worker',
    '    persona: You do the P6T1 work.',
    ...(workerModelPreference !== undefined
      ? [`    modelPreference: ${workerModelPreference}`]
      : []),
    ...workerMcp,
    'requirements:',
    '  - domain: tool',
    '    name: web',
    '    optional: true',
    '  - domain: skill',
    '    name: base',
    'teamEnvelope:',
    '  allow:',
    '    - create-member',
    '    - assign-task',
    '  deny:',
    '    - delete-team',
    'memberEnvelopes:',
    '  - templateId: worker',
    '    envelope:',
    '      allow:',
    '        - web.search',
    '      deny: []',
    'policyStates:',
    '  - id: default',
    '    description: The P6T1 default state.',
    'quotas:',
    '  team:',
    '    maxInstances: 4',
    '    maxConcurrent: 3',
    '  members:',
    '    maxInstances: 2',
    'metadata: {}',
    '---',
    '',
  ].join('\n')
}

/**
 * The step-8 COMPOSITION CONTRACT, run through the SAME
 * `resolveActivationPolicy` the provider calls — for the template the
 * provider resolves at step 3 of the activation (the world's bound
 * snapshot's member template). (This re-runs the composition; it is not a
 * read of the provider's internal frozen policy — see the module docs.)
 */
function step8Policy(world: Awaited<ReturnType<typeof createP6T1World>>, templateId: string) {
  const template =
    templateId === String(P6T1_FIXTURE.leaderTemplateId)
      ? world.blueprint.leader
      : world.blueprint.members.find((m) => String(m.templateId) === templateId)
  if (template === undefined) throw new Error(`no template '${templateId}' in the fixture`)
  const initialModelGrant = initialTemplateModelGrantOf(template, P6T1_FIXTURE_STATIC_MODEL)
  const initialMcpGrant = initialMcpGrantOf(staticCapabilitiesOf(world.blueprint, template))
  const templateValues = {
    ...(initialModelGrant !== undefined ? { model: initialModelGrant } : {}),
    ...(initialMcpGrant !== undefined ? { mcp: initialMcpGrant } : {}),
  }
  return resolveActivationPolicy({
    rootSessionId: String(P6T1_FIXTURE.rootSessionId),
    instanceId: 'inst-p6t1step8probe',
    overrides: world.domain.repositories.overrides.list(String(P6T1_FIXTURE.rootSessionId)),
    external: { hard: {}, capabilityExists: {} },
    ...(Object.keys(templateValues).length > 0 ? { templateValues } : {}),
  })
}

describe('Gate D — activation step-8 composition contract (the template/static model grant)', () => {
  it('D1 member template model -> model effective allow at the template/static layer', async () => {
    const world = await createP6T1World('mp-step8-d1', {
      blueprintSource: blueprintSource('provider-worker/model-worker', undefined),
      environmentFacts: async () => makeEnvironmentFacts(),
    })
    try {
      const result = await world.provider.activate(
        makeRequest({ requestToken: 'tok-mp-step8-d1' }),
      )
      expect(result.kind).toBe('activated')
      // The step-8 composition resolves the model cell at the TEMPLATE
      // layer (provenance template/static, no record id) — NOT the
      // unspecified -> baseline consumer rule.
      const policy = step8Policy(world, 'worker')
      expect(policy.cells['model'].effective).toEqual({
        kind: 'allow',
        items: ['provider-worker/model-worker'],
      })
      expect(policy.cells['model'].team.layer).toBe('template')
      expect(policy.cells['model'].team.origin).toBe('static')
      expect(policy.cells['model'].team.recordId).toBe(null)
      // NO synthetic durable record was created to fake the grant: the
      // bound Blueprint snapshot itself is the durable source.
      expect(
        world.domain.repositories.overrides.list(String(P6T1_FIXTURE.rootSessionId)),
      ).toEqual([])
    } finally {
      await destroyP6T1World(world)
    }
  })

  it('D1 model-only shorthand inherits the injected staticModel provider', async () => {
    const world = await createP6T1World('mp-step8-d1b', {
      blueprintSource: blueprintSource('model-worker-bare', undefined),
      environmentFacts: async () => makeEnvironmentFacts(),
    })
    try {
      const result = await world.provider.activate(
        makeRequest({ requestToken: 'tok-mp-step8-d1b' }),
      )
      expect(result.kind).toBe('activated')
      const policy = step8Policy(world, 'worker')
      expect(policy.cells['model'].effective).toEqual({
        kind: 'allow',
        items: [`${P6T1_FIXTURE_STATIC_MODEL.provider}/model-worker-bare`],
      })
      expect(policy.cells['model'].team.layer).toBe('template')
    } finally {
      await destroyP6T1World(world)
    }
  })

  it('D2 no modelPreference -> the model cell stays unspecified (old behavior)', async () => {
    const world = await createP6T1World('mp-step8-d2', {
      blueprintSource: blueprintSource(undefined, undefined),
      environmentFacts: async () => makeEnvironmentFacts(),
    })
    try {
      const result = await world.provider.activate(
        makeRequest({ requestToken: 'tok-mp-step8-d2' }),
      )
      expect(result.kind).toBe('activated')
      const policy = step8Policy(world, 'worker')
      expect(policy.cells['model'].team.layer).toBe('unspecified')
      expect(policy.cells['model'].team.origin).toBe('static')
      expect(policy.cells['model'].team.recordId).toBe(null)
    } finally {
      await destroyP6T1World(world)
    }
  })

  it('D3 modelPreference + capabilities.mcp allow -> BOTH grants survive (no MCP regression)', async () => {
    const world = await createP6T1World('mp-step8-d3', {
      blueprintSource: blueprintSource('provider-worker/model-worker', ['srv-a', 'srv-b']),
      environmentFacts: async () => makeEnvironmentFacts(),
    })
    try {
      const result = await world.provider.activate(
        makeRequest({ requestToken: 'tok-mp-step8-d3' }),
      )
      expect(result.kind).toBe('activated')
      const policy = step8Policy(world, 'worker')
      expect(policy.cells['model'].effective).toEqual({
        kind: 'allow',
        items: ['provider-worker/model-worker'],
      })
      expect(policy.cells['model'].team.layer).toBe('template')
      // The generic templateValues generalization did not drop the MCP
      // initial grant (the PR #23 contract stays intact).
      expect(policy.cells['mcp'].effective).toEqual({
        kind: 'allow',
        items: ['srv-a', 'srv-b'],
      })
      expect(policy.cells['mcp'].team.layer).toBe('template')
      expect(policy.cells['mcp'].team.origin).toBe('static')
    } finally {
      await destroyP6T1World(world)
    }
  })
})
