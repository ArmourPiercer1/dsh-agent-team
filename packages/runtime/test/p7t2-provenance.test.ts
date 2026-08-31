/**
 * p7t2-provenance — TaskDoc §11.8 P7-T2 card acceptance: "Effective
 * Configuration 每项有来源" — every effective configuration item resolves
 * to an explainable source chain:
 *
 * - the per-cell provenance (`layer` / `origin` / `recordId` /
 *   `overriddenLower` / `explanation`) from the frozen resolver;
 * - the append-only provenance ledger (`contributions`): every admitted
 *   mutation, state transition and creation-field change with its full
 *   source, effective from the next step, in admission order;
 * - the cell's `recordId` (the assembled overlay/override slot id)
 *   chains to exactly one ledger entry per capability — the slot id is
 *   shared across the capabilities of one slot (the LATEST contributing
 *   durable record overall), so the per-capability identity is the
 *   ledger entry's `capability` key;
 * - a cell no Team layer specifies is `unspecified` (fail-closed deny,
 *   static origin, no record);
 * - the whole configuration is DEEP-FROZEN (config, policy, cells,
 *   contributions array, entries, member identity);
 * - resolution is deterministic: a re-resolution at the same step
 *   produces an equal configuration.
 *
 * @module @dsh-agent-team/runtime/test/p7t2-provenance
 */

import { describe, expect, it } from 'vitest'
import type { CapabilityName, PolicyEntry } from '../../domain/policy/src/index.js'
import type { EffectiveConfiguration, MutationLedgerEntry } from '../mutation/index.js'
import {
  allow,
  createP7T2World,
  deny,
  fixtureMember,
  P7T2_ALPHA,
  P7T2_TEAM,
  type P7T2World,
} from './p7t2-helpers.js'

// ---------------------------------------------------------------------------
// Fixture: the blueprint grants ONLY the model cell (the other values are
// OMITTED — so a capability with no Team layer at all can be
// `unspecified`). The alpha template DENIES model (a static value) and
// omits the rest. Envelopes are open on model/tools/permissions.
// ---------------------------------------------------------------------------

const BLUEPRINT_VALUES: Partial<Record<CapabilityName, PolicyEntry>> = {
  model: allow('m-a'),
}

const ENVELOPE: Partial<Record<CapabilityName, PolicyEntry>> = {
  model: allow('m-a', 'm-b'),
  tools: allow('t-a'),
  permissions: allow('p-a'),
  skills: deny(),
  mcp: deny(),
}

const ALPHA_TEMPLATE_VALUES: Partial<Record<CapabilityName, PolicyEntry>> = {
  model: deny(),
}

const alpha = () => fixtureMember(P7T2_ALPHA)

interface ProvenanceSnapshot {
  readonly config: EffectiveConfiguration
  readonly configAtStep2: EffectiveConfiguration
  readonly reResolved: EffectiveConfiguration
  readonly recordIds: { leaderModel: string; memberTools: string; humanPermissions: string }
  readonly storeSuppressions: number
  readonly contributions: MutationLedgerEntry[]
}

const s1: ProvenanceSnapshot = (() => {
  const world: P7T2World = createP7T2World({
    blueprint: { values: BLUEPRINT_VALUES, autonomyEnvelope: ENVELOPE },
    templates: {
      [P7T2_ALPHA]: { values: ALPHA_TEMPLATE_VALUES, mutationEnvelope: ENVELOPE },
    },
  })
  const { service, store, clock } = world

  // Step 0: registration (two creationField ledger entries).
  service.registerInstance(P7T2_TEAM, alpha(), { workspace: 'ws-alpha', contextPolicy: 'ctx-alpha' })

  // Step 0: the leader's model overlay + an explicit state.
  const recLeaderModel = service.requestMutation({
    teamSessionId: P7T2_TEAM,
    capability: 'model',
    value: allow('m-b'),
    actor: { kind: 'leader' },
  })
  service.switchPolicyState({
    teamSessionId: P7T2_TEAM,
    target: { stateId: 's2' },
    actor: { kind: 'leader' },
  })

  // Step 1: the member's tools overlay.
  clock.advance()
  const recMemberTools = service.requestMutation({
    teamSessionId: P7T2_TEAM,
    capability: 'tools',
    value: allow('t-a'),
    actor: { kind: 'member', member: alpha() },
  })

  // Step 2: the human team permissions override.
  clock.advance()
  const recHumanPermissions = service.requestMutation({
    teamSessionId: P7T2_TEAM,
    capability: 'permissions',
    value: allow('p-a'),
    actor: { kind: 'human' },
  })

  // Step 3: the full resolution.
  clock.advance()
  const config = service.resolveEffective(P7T2_TEAM, alpha(), 3)
  const configAtStep2 = service.resolveEffective(P7T2_TEAM, alpha(), 2)
  const reResolved = service.resolveEffective(P7T2_TEAM, alpha(), 3)

  return {
    config,
    configAtStep2,
    reResolved,
    recordIds: {
      leaderModel: recLeaderModel.recordId,
      memberTools: recMemberTools.recordId,
      humanPermissions: recHumanPermissions.recordId,
    },
    storeSuppressions: store.listSuppressions(P7T2_TEAM).length,
    contributions: [...config.contributions],
  }
})()

describe('p7t2 provenance: the effective configuration source chain', () => {
  it('the policy state and the active state id', () => {
    expect(s1.config.step).toBe(3)
    expect(s1.config.policy.policyStateId).toBe('s2')
  })

  it('model: the leader templateOverlay with its full provenance', () => {
    const cell = s1.config.policy.cells.model
    expect(cell.effective).toEqual({ kind: 'allow', items: ['m-b'] })
    expect(cell.team.layer).toBe('templateOverlay')
    expect(cell.team.origin).toBe('leader')
    // Sole contributing template record — the slot id is its record id.
    expect(cell.team.recordId).toBe(s1.recordIds.leaderModel)
    const lostTemplate = cell.team.overriddenLower.find((layer) => layer.layer === 'template')
    if (lostTemplate === undefined) throw new Error('p7t2 snapshot: template layer not overridden')
    expect(lostTemplate.origin).toBe('static')
    expect(lostTemplate.recordId).toBe(null)
    expect(lostTemplate.value).toEqual({ kind: 'deny' })
    const lostBlueprint = cell.team.overriddenLower.find((layer) => layer.layer === 'blueprint')
    if (lostBlueprint === undefined) throw new Error('p7t2 snapshot: blueprint layer not overridden')
    expect(lostBlueprint.value).toEqual({ kind: 'allow', items: ['m-a'] })
  })

  it('tools: the member instanceOverlay', () => {
    const cell = s1.config.policy.cells.tools
    expect(cell.effective).toEqual({ kind: 'allow', items: ['t-a'] })
    expect(cell.team.layer).toBe('instanceOverlay')
    expect(cell.team.origin).toBe('member')
    expect(cell.team.recordId).toBe(s1.recordIds.memberTools)
  })

  it('permissions: the human team override', () => {
    const cell = s1.config.policy.cells.permissions
    expect(cell.effective).toEqual({ kind: 'allow', items: ['p-a'] })
    expect(cell.team.layer).toBe('humanOverride')
    expect(cell.team.origin).toBe('human')
    expect(cell.team.recordId).toBe(s1.recordIds.humanPermissions)
  })

  it('skills and mcp: unspecified (no Team layer specifies them — fail-closed deny)', () => {
    for (const capability of ['skills', 'mcp'] as CapabilityName[]) {
      const cell = s1.config.policy.cells[capability]
      expect(cell.effective).toEqual({ kind: 'deny' })
      expect(cell.team.layer).toBe('unspecified')
      expect(cell.team.origin).toBe('static')
      expect(cell.team.recordId).toBe(null)
    }
  })

  it('contributions: the six ledger entries in admission order', () => {
    const entries = s1.contributions
    expect(entries.length).toBe(6)
    const [ws, ctx, model, state, tools, permissions] = entries
    if (ws === undefined || ctx === undefined || model === undefined) throw new Error('p7t2 snapshot: missing entries')
    if (state === undefined || tools === undefined || permissions === undefined) throw new Error('p7t2 snapshot: missing entries')
    expect(ws.recordKind).toBe('creationField')
    expect(ws.field).toBe('workspace')
    expect(ws.origin).toBe('static')
    expect(ctx.recordKind).toBe('creationField')
    expect(ctx.field).toBe('contextPolicy')
    expect(model.recordKind).toBe('templateOverlay')
    expect(model.capability).toBe('model')
    expect(model.origin).toBe('leader')
    expect(model.recordId).toBe(s1.recordIds.leaderModel)
    expect(state.recordKind).toBe('policyStateTransition')
    expect(state.stateId).toBe('s2')
    expect(state.origin).toBe('leader')
    expect(tools.recordKind).toBe('instanceOverlay')
    expect(tools.capability).toBe('tools')
    expect(tools.origin).toBe('member')
    expect(tools.recordId).toBe(s1.recordIds.memberTools)
    expect(permissions.recordKind).toBe('humanOverride')
    expect(permissions.capability).toBe('permissions')
    expect(permissions.origin).toBe('human')
    expect(permissions.recordId).toBe(s1.recordIds.humanPermissions)
  })

  it('contributions respect the future boundary (atStep 2 excludes the step-3 entry)', () => {
    expect(s1.configAtStep2.contributions.length).toBe(5)
    expect(s1.configAtStep2.contributions.every((entry) => entry.recordId !== s1.recordIds.humanPermissions)).toBe(true)
  })

  it('every granted cell chains to exactly one ledger entry (capability key)', () => {
    const chain: Array<[CapabilityName, string, string]> = [
      ['model', 'templateOverlay', s1.recordIds.leaderModel],
      ['tools', 'instanceOverlay', s1.recordIds.memberTools],
      ['permissions', 'humanOverride', s1.recordIds.humanPermissions],
    ]
    for (const [capability, recordKind, recordId] of chain) {
      const matching = s1.contributions.filter(
        (entry) => entry.capability === capability && entry.recordKind === recordKind && entry.recordId === recordId,
      )
      expect(matching.length).toBe(1)
      const cell = s1.config.policy.cells[capability]
      expect(cell.team.recordId).toBe(recordId)
    }
  })

  it('every cell carries a non-empty explanation', () => {
    for (const capability of ['model', 'tools', 'permissions', 'skills', 'mcp'] as CapabilityName[]) {
      const explanation = s1.config.policy.cells[capability].explanation
      expect(typeof explanation).toBe('string')
      expect(explanation.length).toBeGreaterThan(0)
    }
  })

  it('nothing is suppressed (no PolicyState locks in this scenario)', () => {
    expect(s1.config.policy.suppressed).toEqual([])
    expect(s1.storeSuppressions).toBe(0)
  })
})

describe('p7t2 provenance: the configuration is deep-frozen and deterministic', () => {
  it('config, policy, cells, contributions, entries and member are frozen', () => {
    expect(Object.isFrozen(s1.config)).toBe(true)
    expect(Object.isFrozen(s1.config.policy)).toBe(true)
    expect(Object.isFrozen(s1.config.policy.cells)).toBe(true)
    expect(Object.isFrozen(s1.config.policy.cells.model)).toBe(true)
    expect(Object.isFrozen(s1.config.contributions)).toBe(true)
    const first = s1.config.contributions[0]
    if (first === undefined) throw new Error('p7t2 snapshot: no contributions')
    expect(Object.isFrozen(first)).toBe(true)
    expect(Object.isFrozen(s1.config.member)).toBe(true)
  })

  it('a re-resolution at the same step produces an equal configuration', () => {
    expect(s1.reResolved).toEqual(s1.config)
  })
})
