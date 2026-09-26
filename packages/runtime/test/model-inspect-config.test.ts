/**
 * Gate F (supplement) — `team_inspect_config` effective-POLICY regression for
 * the `modelPreference` routing fix (review-supplement P2-4 §4, the I1–I4
 * matrix).
 *
 * PR #30 wired the bound template's INITIAL static model grant into the
 * `inspect-config` effect (`action-router/effects.ts`), so `team_inspect_config`
 * reports the SAME effective model cell the agent actually runs with. Gate F
 * previously covered only the projection / `effectiveConfig` + `modelState`
 * surfaces; this leg drives the SHIPPED `team_inspect_config` Runtime action
 * path (`createTeamRuntime().performAction({ action: 'inspect-config' })`) and
 * asserts the effective `model` cell for the four required cases:
 *
 *   I1 — a QUALIFIED `modelPreference` (`openai/gpt-6-astra`) resolves the
 *        model cell to the exact route at the TEMPLATE/static surface — NOT
 *        the `staticModel` baseline, NOT `unspecified` (fail-closed deny).
 *   I2 — a MODEL-ONLY shorthand (`qwen3.8-27b`) inherits the injected
 *        `staticModel` provider (`qiyuan-self`) → `qiyuan-self/qwen3.8-27b`.
 *   I3 — NO `modelPreference` keeps the pre-fix behavior: the model cell is
 *        `unspecified` (fail-closed deny in the policy) → the `staticModel`
 *        baseline applies at the consumer (E9 locks the consumer leg).
 *   I4 — a durable HUMAN override (`openai/gpt-6-pro`) beats the template
 *        (`openai/gpt-6-astra`): the override item wins the model cell
 *        (the action-router precedence contract).
 *
 * House pattern: one durable P6-T1 world per scenario (custom blueprint + an
 * explicit `staticModel` baseline + a seeded leader/worker), a `TeamRuntime`
 * built over it, the `inspect-config` action driven at TOP LEVEL (the plain
 * shim supports no async `it`), and the `it` bodies assert the captured
 * plain-data effect.
 *
 * @module @dsh-agent-team/runtime/test/model-inspect-config
 */

import { describe, expect, it } from 'vitest'

import { parseChildSessionId, parseInstanceId, parseTemplateId } from '../../contracts/src/index.js'
import type { ModelSelection } from '../agent-setup/model/index.js'
import { createTeamRuntime } from '../action-router/index.js'
import type { TeamRuntimeActionOutcome } from '../admission/index.js'
import { P6T1_FIXTURE, createP6T1World, destroyP6T1World, type P6T1World } from './p6t1-helpers.js'

// ── the worker template's declared modelPreference (per scenario) ─────────────
function blueprintSource(workerModelPreference: string | undefined): string {
  return [
    '---',
    'schemaVersion: 1',
    'blueprintId: MP-IC-BP',
    'revision: "1"',
    'leader:',
    '  templateId: leader',
    '  persona: You lead the model-inspect team.',
    'members:',
    '  - templateId: worker',
    '    displayName: Worker',
    '    persona: You do the model-inspect work.',
    ...(workerModelPreference !== undefined
      ? [`    modelPreference: ${workerModelPreference}`]
      : []),
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
    '    description: The model-inspect default state.',
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

const LEADER_CALLER = { kind: 'instance', instanceId: 'inst-leader' } as const
const WORKER_ID = 'inst-worker'
const ROOT = String(P6T1_FIXTURE.rootSessionId)

/** Build one world + runtime and drive the SHIPPED inspect-config action. */
async function inspectWorker(
  basename: string,
  workerModelPreference: string | undefined,
  staticModel: ModelSelection,
  plantHumanOverride: string | null = null,
): Promise<TeamRuntimeActionOutcome> {
  const world: P6T1World = await createP6T1World(basename, {
    blueprintSource: blueprintSource(workerModelPreference),
    staticModel,
    seedMembers: [
      {
        instanceId: parseInstanceId('inst-leader'),
        templateId: parseTemplateId('leader'),
        childSessionId: parseChildSessionId('session-child-mpic-leader'),
      },
      {
        instanceId: parseInstanceId(WORKER_ID),
        templateId: parseTemplateId('worker'),
        childSessionId: parseChildSessionId('session-child-mpic-worker'),
      },
    ],
  })
  try {
    if (plantHumanOverride !== null) {
      await world.domain.repositories.overrides.put({
        schemaVersion: 2,
        kind: 'human-override',
        recordId: 'ovr-mpic-model',
        scope: 'team',
        rootSessionId: ROOT,
        values: { model: { kind: 'allow', items: [plantHumanOverride] } },
        generation: 1,
        updatedAt: P6T1_FIXTURE.createdAt,
      })
    }
    const runtime = createTeamRuntime({
      teamDomain: world.domain,
      activationProvider: world.provider,
      blueprintCatalog: world.catalog,
      environmentFacts: world.ports.environmentFacts,
      externalPolicyFacts: world.ports.externalPolicyFacts,
      now: () => P6T1_FIXTURE.createdAt,
      staticModel,
    })
    return await runtime.performAction({
      rootSessionId: ROOT,
      action: 'inspect-config',
      caller: LEADER_CALLER,
      targetInstanceId: WORKER_ID,
      requestToken: `tok-mpic-${basename}`,
    })
  } finally {
    await destroyP6T1World(world)
  }
}

/** The effective `model` cell of a config-inspected outcome (the assertion surface). */
function modelCell(outcome: TeamRuntimeActionOutcome): { kind: string; items?: string[] } {
  if (outcome.effect.kind !== 'config-inspected') {
    throw new Error(`expected a config-inspected effect, got '${outcome.effect.kind}'`)
  }
  const cell = outcome.effect.effective['model'] as { kind: string; items?: string[] } | undefined
  if (cell === undefined) throw new Error('no model cell in the inspect-config effective view')
  return cell
}

// ── the four required scenarios (driven at top level) ─────────────────────────
const I1_BASELINE: ModelSelection = { provider: 'baseline-prov', model: 'baseline-model' }
const I2_BASELINE: ModelSelection = { provider: 'qiyuan-self', model: 'qiyuan-default' }
const I3_BASELINE: ModelSelection = { provider: 'qiyuan-self', model: 'qiyuan-default' }

const I1 = await inspectWorker('mp-ic-i1', 'openai/gpt-6-astra', I1_BASELINE)
const I2 = await inspectWorker('mp-ic-i2', 'qwen3.8-27b', I2_BASELINE)
const I3 = await inspectWorker('mp-ic-i3', undefined, I3_BASELINE)
const I4 = await inspectWorker('mp-ic-i4', 'openai/gpt-6-astra', I1_BASELINE, 'openai/gpt-6-pro')

describe('I1 — qualified modelPreference -> the exact route at the template/static surface', () => {
  it('the effective model cell is the exact qualified route (allow)', () => {
    expect(modelCell(I1)).toEqual({ kind: 'allow', items: ['openai/gpt-6-astra'] })
  })
  it('the cell is NOT the staticModel baseline and NOT unspecified (fail-closed deny)', () => {
    const cell = modelCell(I1)
    expect(cell.kind).toBe('allow')
    expect(cell.items).not.toContain(`${I1_BASELINE.provider}/${I1_BASELINE.model}`)
    expect(cell).not.toEqual({ kind: 'deny' })
  })
})

describe('I2 — model-only shorthand inherits the injected staticModel provider', () => {
  it('the effective model cell is <baseline.provider>/<bare model>', () => {
    expect(modelCell(I2)).toEqual({ kind: 'allow', items: ['qiyuan-self/qwen3.8-27b'] })
  })
})

describe('I3 — no modelPreference keeps the unspecified -> staticModel consumer behavior', () => {
  it('the effective model cell is unspecified (fail-closed deny in the policy; staticModel applies at the consumer — E9)', () => {
    expect(modelCell(I3)).toEqual({ kind: 'deny' })
  })
  it('the no-preference behavior is unchanged (not a template grant, not the baseline as a policy value)', () => {
    const cell = modelCell(I3)
    expect(cell).not.toEqual({ kind: 'allow', items: [`${I3_BASELINE.provider}/${I3_BASELINE.model}`] })
  })
})

describe('I4 — a durable human override beats the template model', () => {
  it('the effective model cell is the human override item (openai/gpt-6-pro), not the template', () => {
    expect(modelCell(I4)).toEqual({ kind: 'allow', items: ['openai/gpt-6-pro'] })
  })
  it('the template route is not the winner', () => {
    expect(modelCell(I4).items).not.toContain('openai/gpt-6-astra')
  })
})
