/**
 * p7t2-override-precedence — TaskDoc §11.8 P7-T2: the frozen Team layer
 * order (blueprint < policyState < template < templateOverlay <
 * instanceOverlay < humanOverride) observed through admitted mutations,
 * plus the STAGE-2 external facts as a post-admission safety net:
 *
 * - instanceOverlay beats templateOverlay for the SAME capability (a
 *   member's own grant wins over the leader's team overlay);
 * - humanOverride beats instanceOverlay (explicit human authority is the
 *   highest Team layer, invariant 34);
 * - a human override may GRANT a cell no Team layer grants (invariant 34:
 *   the Team deny is relaxed);
 * - a template DENY value beats a blueprint DENY value for the same cell
 *   (ascending layers: the cell is 'template', never 'unspecified',
 *   because the template layer specifies it);
 * - a team-scoped human override applies to every member; an
 *   instance-scoped one wins over the team-scoped one for its own member;
 * - external hard facts drift AFTER admission still clips the effective
 *   policy at resolution (stage 2): `externalHardRemovedAll`,
 *   `capabilityMissing`, `externalHardDeny`.
 *
 * @module @dsh-agent-team/runtime/test/p7t2-override-precedence
 */

import { describe, expect, it } from 'vitest'
import type { CapabilityName, PolicyEntry } from '../../domain/policy/src/index.js'
import {
  allow,
  createP7T2World,
  deny,
  fixtureMember,
  P7T2_ALPHA,
  P7T2_BETA,
  P7T2_TEAM,
  snapshotConfig,
  type P7T2World,
} from './p7t2-helpers.js'

// ---------------------------------------------------------------------------
// Fixture: blueprint VALUES deny everywhere (no cell granted by the Team
// baseline); the envelope opens model/tools/permissions. The alpha
// template mirrors the blueprint (deny values, same envelope), so every
// grant in this scenario comes from an overlay/override layer.
// ---------------------------------------------------------------------------

const ENVELOPE: Partial<Record<CapabilityName, PolicyEntry>> = {
  model: allow('m-a', 'm-b'),
  tools: allow('t-a'),
  permissions: allow('p-a'),
  skills: deny(),
  mcp: deny(),
}

function allDeny(): Partial<Record<CapabilityName, PolicyEntry>> {
  return { model: deny(), tools: deny(), permissions: deny(), skills: deny(), mcp: deny() }
}

const alpha = () => fixtureMember(P7T2_ALPHA)
const beta = () => fixtureMember(P7T2_BETA)

interface CellSnapshot {
  effective: PolicyEntry
  layer: string
  origin: string
  recordId: string | null
  overriddenLower: Array<{ layer: string; origin: string; value: PolicyEntry }>
  note: string
  removedItems: string[]
}

interface ResolutionSnapshot {
  policyStateId: string
  cells: Record<string, CellSnapshot>
  suppressed: unknown[]
}

function resolveSnap(world: P7T2World, member: ReturnType<typeof alpha>, atStep: number): ResolutionSnapshot {
  const config = world.service.resolveEffective(P7T2_TEAM, member, atStep)
  return snapshotConfig({
    step: config.step,
    policy: config.policy,
    contributions: config.contributions,
    suppressed: config.suppressed,
  }) as unknown as ResolutionSnapshot
}

// ---------------------------------------------------------------------------
// Scenario 1: the layer order, one admitted grant per layer
// ---------------------------------------------------------------------------

interface PrecedenceSnapshot {
  readonly rStep1: ResolutionSnapshot
  readonly rStep2: ResolutionSnapshot
  readonly rStep3Alpha: ResolutionSnapshot
  readonly rStep3Beta: ResolutionSnapshot
  readonly rStep4: ResolutionSnapshot
  readonly rStep5Alpha: ResolutionSnapshot
  readonly rStep5Beta: ResolutionSnapshot
  readonly rToolsOpen: ResolutionSnapshot
  readonly rToolsRemovedAll: ResolutionSnapshot
  readonly rModelMissing: ResolutionSnapshot
  readonly rPermissionsHardDeny: ResolutionSnapshot
  readonly recordIds: {
    memberModel: string
    leaderModel: string
    humanModel: string
    humanPermissions: string
  }
}

const s1: PrecedenceSnapshot = (() => {
  const world: P7T2World = createP7T2World({
    blueprint: { values: allDeny(), autonomyEnvelope: ENVELOPE },
    templates: {
      [P7T2_ALPHA]: { values: allDeny(), mutationEnvelope: ENVELOPE },
      [P7T2_BETA]: { values: allDeny(), mutationEnvelope: ENVELOPE },
    },
  })
  const { service, clock } = world

  // Step 0: the member's own grant (instanceOverlay) and the leader's
  // team grant (templateOverlay) for the SAME capability.
  const recMemberModel = service.requestMutation({
    teamSessionId: P7T2_TEAM,
    capability: 'model',
    value: allow('m-a'),
    actor: { kind: 'member', member: alpha() },
  })
  const recLeaderModel = service.requestMutation({
    teamSessionId: P7T2_TEAM,
    capability: 'model',
    value: allow('m-b'),
    actor: { kind: 'leader' },
  })

  // Step 1: the human team override for the same capability (invariant 34:
  // not envelope-bounded) — admitted at step 1, effective from step 2.
  clock.advance()
  const recHumanModel = service.requestMutation({
    teamSessionId: P7T2_TEAM,
    capability: 'model',
    value: allow('m-b'),
    actor: { kind: 'human' },
  })

  // Step 2: a human INSTANCE-scoped override for alpha's permissions.
  clock.advance()
  const recHumanPermissions = service.requestMutation({
    teamSessionId: P7T2_TEAM,
    capability: 'permissions',
    value: allow('p-a'),
    actor: { kind: 'human' },
    scope: 'instance',
    targetMember: alpha(),
  })

  // Step 3: the human grants that no Team layer may grant (skills are
  // Team-deny everywhere): one team-scoped, one instance-scoped for alpha.
  clock.advance()
  service.requestMutation({
    teamSessionId: P7T2_TEAM,
    capability: 'mcp',
    value: allow('c-a'),
    actor: { kind: 'human' },
  })
  service.requestMutation({
    teamSessionId: P7T2_TEAM,
    capability: 'skills',
    value: allow('s-a'),
    actor: { kind: 'human' },
  })
  service.requestMutation({
    teamSessionId: P7T2_TEAM,
    capability: 'skills',
    value: allow('s-b'),
    actor: { kind: 'human' },
    scope: 'instance',
    targetMember: alpha(),
  })

  // Step 4: the human tools grant (stage-2 drift comes next).
  clock.advance()
  service.requestMutation({
    teamSessionId: P7T2_TEAM,
    capability: 'tools',
    value: allow('t-a'),
    actor: { kind: 'human' },
  })

  const rStep1 = resolveSnap(world, alpha(), 1)
  const rStep2 = resolveSnap(world, alpha(), 2)
  const rStep3Alpha = resolveSnap(world, alpha(), 3)
  const rStep3Beta = resolveSnap(world, beta(), 3)
  const rStep4 = resolveSnap(world, alpha(), 4)
  const rToolsOpen = resolveSnap(world, alpha(), 5)

  // Stage-2 drift: the external facts change AFTER the tools grant was
  // admitted (the resolver's intersection is re-applied at every step).
  world.reader.external = { hard: { tools: allow('t-x') }, capabilityExists: {} }
  const rToolsRemovedAll = resolveSnap(world, alpha(), 5)
  world.reader.external = { hard: {}, capabilityExists: { model: false } }
  const rModelMissing = resolveSnap(world, alpha(), 5)
  world.reader.external = { hard: { permissions: deny() }, capabilityExists: {} }
  const rPermissionsHardDeny = resolveSnap(world, alpha(), 5)
  // Reset for the beta step-5 resolution below.
  world.reader.external = { hard: {}, capabilityExists: {} }
  const rStep5Alpha = resolveSnap(world, alpha(), 5)
  const rStep5Beta = resolveSnap(world, beta(), 5)

  return {
    rStep1,
    rStep2,
    rStep3Alpha,
    rStep3Beta,
    rStep4,
    rStep5Alpha,
    rStep5Beta,
    rToolsOpen,
    rToolsRemovedAll,
    rModelMissing,
    rPermissionsHardDeny,
    recordIds: {
      memberModel: recMemberModel.recordId,
      leaderModel: recLeaderModel.recordId,
      humanModel: recHumanModel.recordId,
      humanPermissions: recHumanPermissions.recordId,
    },
  }
})()

describe('p7t2 override precedence: the six Team layers in order', () => {
  it('step 1: instanceOverlay beats templateOverlay (overriddenLower proves it)', () => {
    const model = s1.rStep1.cells.model
    if (model === undefined) throw new Error('p7t2 snapshot: missing model cell')
    expect(model.effective).toEqual({ kind: 'allow', items: ['m-a'] })
    expect(model.layer).toBe('instanceOverlay')
    expect(model.origin).toBe('member')
    // Sole contributing instance record — the slot id is its record id.
    expect(model.recordId).toBe(s1.recordIds.memberModel)
    // The leader's templateOverlay (and the static denies) lost below.
    const lostTemplate = model.overriddenLower.find((layer) => layer.layer === 'templateOverlay')
    if (lostTemplate === undefined) throw new Error('p7t2 snapshot: templateOverlay not overridden')
    expect(lostTemplate.origin).toBe('leader')
    expect(lostTemplate.value).toEqual({ kind: 'allow', items: ['m-b'] })
    const lostTemplateValue = model.overriddenLower.find((layer) => layer.layer === 'template')
    if (lostTemplateValue === undefined) throw new Error('p7t2 snapshot: template not overridden')
    expect(lostTemplateValue.value).toEqual({ kind: 'deny' })
  })

  it('step 2: humanOverride beats instanceOverlay (highest Team layer)', () => {
    const model = s1.rStep2.cells.model
    if (model === undefined) throw new Error('p7t2 snapshot: missing model cell')
    expect(model.effective).toEqual({ kind: 'allow', items: ['m-b'] })
    expect(model.layer).toBe('humanOverride')
    expect(model.origin).toBe('human')
    expect(model.recordId).toBe(s1.recordIds.humanModel)
  })

  it('step 3: alpha permissions resolve to the human INSTANCE override', () => {
    const permissions = s1.rStep3Alpha.cells.permissions
    if (permissions === undefined) throw new Error('p7t2 snapshot: missing permissions cell')
    expect(permissions.effective).toEqual({ kind: 'allow', items: ['p-a'] })
    expect(permissions.layer).toBe('humanOverride')
    expect(permissions.origin).toBe('human')
    expect(permissions.recordId).toBe(s1.recordIds.humanPermissions)
  })

  it('step 3: beta permissions stay the template DENY (never unspecified)', () => {
    const permissions = s1.rStep3Beta.cells.permissions
    if (permissions === undefined) throw new Error('p7t2 snapshot: missing permissions cell')
    expect(permissions.effective).toEqual({ kind: 'deny' })
    // The template layer SPECIFIES the cell (deny values) — the ascending
    // order makes the cell 'template', not 'unspecified'.
    expect(permissions.layer).toBe('template')
    expect(permissions.origin).toBe('static')
    expect(permissions.recordId).toBe(null)
  })

  it('step 4: a human override GRANTS a Team-deny cell (invariant 34)', () => {
    const mcp = s1.rStep4.cells.mcp
    if (mcp === undefined) throw new Error('p7t2 snapshot: missing mcp cell')
    expect(mcp.effective).toEqual({ kind: 'allow', items: ['c-a'] })
    expect(mcp.layer).toBe('humanOverride')
    expect(mcp.origin).toBe('human')
  })

  it('step 5: alpha skills — the instance human override beats the team one', () => {
    const skills = s1.rStep5Alpha.cells.skills
    if (skills === undefined) throw new Error('p7t2 snapshot: missing skills cell')
    expect(skills.effective).toEqual({ kind: 'allow', items: ['s-b'] })
    expect(skills.layer).toBe('humanOverride')
    expect(skills.origin).toBe('human')
  })

  it('step 5: beta skills — the team human override applies (no instance one)', () => {
    const skills = s1.rStep5Beta.cells.skills
    if (skills === undefined) throw new Error('p7t2 snapshot: missing skills cell')
    expect(skills.effective).toEqual({ kind: 'allow', items: ['s-a'] })
    expect(skills.layer).toBe('humanOverride')
    expect(skills.origin).toBe('human')
  })

  it('no PolicyState is active and nothing is suppressed (no locks anywhere)', () => {
    for (const snapshot of [
      s1.rStep1,
      s1.rStep2,
      s1.rStep3Alpha,
      s1.rStep3Beta,
      s1.rStep4,
      s1.rStep5Alpha,
      s1.rStep5Beta,
    ]) {
      expect(snapshot.policyStateId).toBe('default')
      expect(snapshot.suppressed).toEqual([])
    }
  })
})

describe('p7t2 override precedence: stage-2 external facts clip after admission', () => {
  it('an admitted tools grant is visible while the external facts are open', () => {
    const tools = s1.rToolsOpen.cells.tools
    if (tools === undefined) throw new Error('p7t2 snapshot: missing tools cell')
    expect(tools.effective).toEqual({ kind: 'allow', items: ['t-a'] })
    expect(tools.layer).toBe('humanOverride')
    expect(tools.note).toBe('none')
  })

  it('a hard allow-list that shares no items removes ALL (externalHardRemovedAll)', () => {
    const tools = s1.rToolsRemovedAll.cells.tools
    if (tools === undefined) throw new Error('p7t2 snapshot: missing tools cell')
    expect(tools.effective).toEqual({ kind: 'deny' })
    expect(tools.layer).toBe('humanOverride') // the Team layer is unchanged
    expect(tools.note).toBe('externalHardRemovedAll')
    expect(tools.removedItems).toEqual(['t-a'])
  })

  it('a missing capability denies even a human override (capabilityMissing)', () => {
    const model = s1.rModelMissing.cells.model
    if (model === undefined) throw new Error('p7t2 snapshot: missing model cell')
    expect(model.effective).toEqual({ kind: 'deny' })
    expect(model.layer).toBe('humanOverride') // invariant 35: no layer survives
    expect(model.note).toBe('capabilityMissing')
    expect(model.removedItems).toEqual(['m-b'])
  })

  it('a hard deny denies the cell for everyone (externalHardDeny)', () => {
    const permissions = s1.rPermissionsHardDeny.cells.permissions
    if (permissions === undefined) throw new Error('p7t2 snapshot: missing permissions cell')
    expect(permissions.effective).toEqual({ kind: 'deny' })
    expect(permissions.layer).toBe('humanOverride')
    expect(permissions.note).toBe('externalHardDeny')
    expect(permissions.removedItems).toEqual(['p-a'])
  })
})
