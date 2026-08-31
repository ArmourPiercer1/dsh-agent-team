/**
 * p7t2-policy-state — TaskDoc §11.8 P7-T2 must-test: PolicyState as a
 * future-boundary mutation with NON-DESTRUCTIVE suppression:
 *
 * - only explicit human / authorized-leader transitions are authorized
 *   (`UNAUTHORIZED_TRANSITION` for a member, `actor.member` rejected);
 * - a transition admitted at step k is effective from step k+1 (the
 *   in-flight capture keeps the previous state's resolution);
 * - a LOCKED cell suppresses an admitted in-envelope allow overlay:
 *   the stored record survives, the cell falls back to the next lower
 *   Team layer (here the template's open allow values — template beats
 *   blueprint in the ascending order), and the suppression is recorded
 *   LAZILY at resolution, deduplicated on (capability, overlayId,
 *   policyStateId) against the store's trail;
 * - a never-locked capability is never suppressed;
 * - unlocking (a state without the lock) REVIVES the stored overlay
 *   (output `suppressed` empty) while the store's suppression TRAIL
 *   keeps the historical records (non-destructive, §19.4);
 * - a state `value` cell resolves at the `policyState` layer (static
 *   origin, no record id);
 * - malformed targets are rejected with the offending `field`.
 *
 * @module @dsh-agent-team/runtime/test/p7t2-policy-state
 */

import { describe, expect, it } from 'vitest'
import type { CapabilityName, PolicyEntry } from '../../domain/policy/src/index.js'
import {
  allow,
  assertMutationCode,
  captureError,
  createP7T2World,
  deny,
  fixtureMember,
  P7T2_ALPHA,
  P7T2_TEAM,
  snapshotConfig,
  type P7T2World,
} from './p7t2-helpers.js'
import type { SuppressionRecord } from '../mutation/index.js'

// ---------------------------------------------------------------------------
// Fixture: the Team baseline is OPEN (blueprint allow values), and alpha's
// template carries the SAME open allow values (so a suppressed overlay
// falls back to the template's allow list — layer 'template', the
// ascending order above the blueprint). Envelopes are open on the three
// exercised capabilities.
// ---------------------------------------------------------------------------

const OPEN_VALUES: Partial<Record<CapabilityName, PolicyEntry>> = {
  model: allow('m-a', 'm-b'),
  tools: allow('t-a'),
  skills: allow('s-a', 's-b'),
  permissions: deny(),
  mcp: deny(),
}

const ENVELOPE: Partial<Record<CapabilityName, PolicyEntry>> = {
  model: allow('m-a', 'm-b'),
  tools: allow('t-a'),
  skills: allow('s-a', 's-b'),
  permissions: deny(),
  mcp: deny(),
}

/**
 * The alpha template carries the SAME open values EXCEPT mcp, which is
 * deliberately OMITTED: the frozen Team layer order is
 * blueprint < policyState < template, so a template mcp value (even a
 * deny) would sit ABOVE a state value cell and shadow the pinned
 * `mcp: allow` cell. With the template silent on mcp, the pinned state
 * value wins over the blueprint deny at the policyState layer.
 */
const ALPHA_TEMPLATE_VALUES: Partial<Record<CapabilityName, PolicyEntry>> = {
  model: allow('m-a', 'm-b'),
  tools: allow('t-a'),
  skills: allow('s-a', 's-b'),
  permissions: deny(),
}

const alpha = () => fixtureMember(P7T2_ALPHA)

interface CellSnapshot {
  effective: PolicyEntry
  layer: string
  origin: string
  recordId: string | null
  note: string
}

interface ResolutionSnapshot {
  policyStateId: string
  cells: Record<string, CellSnapshot>
  suppressed: Array<{
    capability: string
    overlayId: string
    layer: string
    origin: string
    value: PolicyEntry
    reason: string
    policyStateId: string
  }>
}

function resolveSnap(world: P7T2World, atStep: number): ResolutionSnapshot {
  const config = world.service.resolveEffective(P7T2_TEAM, alpha(), atStep)
  return snapshotConfig({
    step: config.step,
    policy: config.policy,
    contributions: config.contributions,
    suppressed: config.suppressed,
  }) as unknown as ResolutionSnapshot
}

// ---------------------------------------------------------------------------
// Scenario 1: the lock / suppress / revive / pin timeline
// ---------------------------------------------------------------------------

interface PolicyStateSnapshot {
  readonly memberTransition: { thrown: boolean; code?: string; allowedActors?: unknown }
  readonly storeSuppressionsAfterFirst: number
  readonly storeSuppressionsAfterReResolve: number
  readonly storeSuppressionsAfterSkillsLock: number
  readonly storeSuppressionsAfterUnlock: number
  readonly suppressionTrail: SuppressionRecord[]
  readonly r0: ResolutionSnapshot
  readonly r1: ResolutionSnapshot
  readonly r2: ResolutionSnapshot
  readonly r3: ResolutionSnapshot
  readonly r5: ResolutionSnapshot
  readonly r6: ResolutionSnapshot
  readonly r7: ResolutionSnapshot
  readonly recordIds: { memberModel: string; memberTools: string; memberSkills: string }
  readonly lenientState: { stateId: string; modelCell: Record<string, unknown> }
  readonly malformed: Record<string, { thrown: boolean; code?: string; field?: string }>
}

const s1: PolicyStateSnapshot = (() => {
  const world: P7T2World = createP7T2World({
    blueprint: { values: OPEN_VALUES, autonomyEnvelope: ENVELOPE },
    templates: {
      [P7T2_ALPHA]: { values: ALPHA_TEMPLATE_VALUES, mutationEnvelope: ENVELOPE },
    },
  })
  const { service, store, clock } = world
  service.registerInstance(P7T2_TEAM, alpha(), { workspace: 'ws-alpha', contextPolicy: 'ctx-alpha' })

  // Step 0: the member's model grant (admitted, effective from step 1).
  const recMemberModel = service.requestMutation({
    teamSessionId: P7T2_TEAM,
    capability: 'model',
    value: allow('m-b'),
    actor: { kind: 'member', member: alpha() },
  })

  // A member may NOT transition the PolicyState (invariant 40).
  const memberTransitionErr = captureError(() =>
    service.switchPolicyState({
      teamSessionId: P7T2_TEAM,
      target: { stateId: 'member-try' },
      actor: { kind: 'member', member: alpha() },
    }),
  )
  const memberTransition = memberTransitionErr.thrown
    ? (() => {
        const checked = assertMutationCode(memberTransitionErr.error, 'UNAUTHORIZED_TRANSITION')
        return { thrown: true, code: checked.code, allowedActors: checked.details?.allowedActors }
      })()
    : { thrown: false }

  // The leader locks model (effective from step 1).
  service.switchPolicyState({
    teamSessionId: P7T2_TEAM,
    target: { stateId: 'locked-model', cells: { model: { locked: true } } },
    actor: { kind: 'leader' },
  })

  const r0 = resolveSnap(world, 0)
  const r1 = resolveSnap(world, 1)
  const storeSuppressionsAfterFirst = store.listSuppressions(P7T2_TEAM).length
  resolveSnap(world, 1) // re-resolution: no duplicate suppression record
  const storeSuppressionsAfterReResolve = store.listSuppressions(P7T2_TEAM).length

  // Step 1: the member denies tools (a capability the state never locks).
  clock.advance()
  const recMemberTools = service.requestMutation({
    teamSessionId: P7T2_TEAM,
    capability: 'tools',
    value: deny(),
    actor: { kind: 'member', member: alpha() },
  })
  const r2 = resolveSnap(world, 2)

  // Step 2: the human model override (not suppressed — human layer).
  clock.advance()
  service.requestMutation({
    teamSessionId: P7T2_TEAM,
    capability: 'model',
    value: allow('m-z'),
    actor: { kind: 'human' },
  })
  const r3 = resolveSnap(world, 3)

  // Step 3: the member's skills grant; step 4: the leader locks skills.
  clock.advance()
  const recMemberSkills = service.requestMutation({
    teamSessionId: P7T2_TEAM,
    capability: 'skills',
    value: allow('s-b'),
    actor: { kind: 'member', member: alpha() },
  })
  clock.advance()
  service.switchPolicyState({
    teamSessionId: P7T2_TEAM,
    target: { stateId: 'locked-skills', cells: { skills: { locked: true } } },
    actor: { kind: 'leader' },
  })
  const r5 = resolveSnap(world, 5)
  const storeSuppressionsAfterSkillsLock = store.listSuppressions(P7T2_TEAM).length

  // Step 5: the leader UNLOCKS (an empty state).
  clock.advance()
  service.switchPolicyState({
    teamSessionId: P7T2_TEAM,
    target: { stateId: 'unlocked' },
    actor: { kind: 'leader' },
  })
  const r6 = resolveSnap(world, 6)
  const storeSuppressionsAfterUnlock = store.listSuppressions(P7T2_TEAM).length

  // Step 6: a state VALUE cell (pinned mcp allow).
  clock.advance()
  service.switchPolicyState({
    teamSessionId: P7T2_TEAM,
    target: { stateId: 'pinned', cells: { mcp: { value: allow('c-a') } } },
    actor: { kind: 'leader' },
  })
  const r7 = resolveSnap(world, 7)

  // Lenient: a cell with `locked` not exactly `true` normalizes to no
  // lock (mirrors the frozen domain's PolicyStateCellView).
  clock.advance()
  service.switchPolicyState({
    teamSessionId: P7T2_TEAM,
    // A non-boolean locked is deliberately outside the view type but
    // admissible at intake (it normalizes to no lock); the `as never` cast
    // mirrors the runCase cast below for the same reason.
    target: { stateId: 'lenient', cells: { model: { locked: 'yes' } } } as never,
    actor: { kind: 'leader' },
  })
  const transitions = store.listTransitions(P7T2_TEAM)
  const lenient = transitions[transitions.length - 1]
  if (lenient === undefined) throw new Error('p7t2 fixture: lenient transition missing')
  const lenientModelCell = lenient.state.cells?.model
  const lenientState = {
    stateId: lenient.state.stateId,
    modelCell: lenientModelCell === undefined ? {} : (lenientModelCell as Record<string, unknown>),
  }

  // Malformed targets (the intake rejects before anything is stored).
  const malformed: Record<string, { thrown: boolean; code?: string; field?: string }> = {}
  const runCase = (name: string, target: unknown, field: string) => {
    const err = captureError(() =>
      service.switchPolicyState({ teamSessionId: P7T2_TEAM, target: target as never, actor: { kind: 'leader' } }),
    )
    if (err.thrown) {
      const checked = assertMutationCode(err.error, 'MALFORMED_MUTATION_INPUT')
      malformed[name] = {
        thrown: true,
        code: checked.code,
        field: (checked.details?.field as string | undefined) ?? undefined,
      }
      expect((checked.details?.field as string | undefined) ?? undefined).toBe(field)
    } else {
      malformed[name] = { thrown: false }
    }
  }
  runCase('stateIdEmpty', { stateId: '' }, 'target.stateId')
  runCase('stateIdWhitespace', { stateId: 'a b' }, 'target.stateId')
  runCase('stateIdMissing', { cells: { model: { locked: true } } }, 'target.stateId')
  runCase('unknownCapability', { stateId: 'x', cells: { web: {} } }, 'target.cells')
  runCase('stateCellExtraField', { stateId: 'x', cells: { model: { extra: 1 } } }, 'target.cells.model')
  runCase('stateCellValueEmptyItems', { stateId: 'x', cells: { model: { value: { kind: 'allow', items: [] } } } }, 'target.cells.model.value')
  const actorMemberErr = captureError(() =>
    service.switchPolicyState({
      teamSessionId: P7T2_TEAM,
      target: { stateId: 'x' },
      actor: { kind: 'leader', member: alpha() },
    }),
  )
  if (actorMemberErr.thrown) {
    const checked = assertMutationCode(actorMemberErr.error, 'MALFORMED_MUTATION_INPUT')
    malformed.actorMember = {
      thrown: true,
      code: checked.code,
      field: (checked.details?.field as string | undefined) ?? undefined,
    }
    expect((checked.details?.field as string | undefined) ?? undefined).toBe('actor.member')
  } else {
    malformed.actorMember = { thrown: false }
  }

  const suppressionTrail = [...store.listSuppressions(P7T2_TEAM)]

  return {
    memberTransition,
    storeSuppressionsAfterFirst,
    storeSuppressionsAfterReResolve,
    storeSuppressionsAfterSkillsLock,
    storeSuppressionsAfterUnlock,
    suppressionTrail,
    r0,
    r1,
    r2,
    r3,
    r5,
    r6,
    r7,
    recordIds: {
      memberModel: recMemberModel.recordId,
      memberTools: recMemberTools.recordId,
      memberSkills: recMemberSkills.recordId,
    },
    lenientState,
    malformed,
  }
})()

describe('p7t2 policy state: authorization and future boundary', () => {
  it('a member transition is UNAUTHORIZED_TRANSITION (allowedActors named)', () => {
    expect(s1.memberTransition.thrown).toBe(true)
    expect(s1.memberTransition.code).toBe('UNAUTHORIZED_TRANSITION')
    expect(s1.memberTransition.allowedActors).toEqual(['human', 'leader'])
  })

  it('atStep 0: the default state, the template allow baseline (template beats blueprint)', () => {
    expect(s1.r0.policyStateId).toBe('default')
    const model = s1.r0.cells.model
    if (model === undefined) throw new Error('p7t2 snapshot: missing model cell')
    expect(model.effective).toEqual({ kind: 'allow', items: ['m-a', 'm-b'] })
    expect(model.layer).toBe('template')
    expect(model.origin).toBe('static')
  })

  it('atStep 1: the locked state suppresses the stored allow overlay (non-destructive)', () => {
    expect(s1.r1.policyStateId).toBe('locked-model')
    const model = s1.r1.cells.model
    if (model === undefined) throw new Error('p7t2 snapshot: missing model cell')
    expect(model.effective).toEqual({ kind: 'allow', items: ['m-a', 'm-b'] })
    expect(model.layer).toBe('template')
    const suppressed = s1.r1.suppressed
    expect(suppressed.length).toBe(1)
    const record = suppressed[0]
    if (record === undefined) throw new Error('p7t2 snapshot: missing suppression record')
    expect(record.capability).toBe('model')
    expect(record.overlayId).toBe(s1.recordIds.memberModel)
    expect(record.layer).toBe('instanceOverlay')
    expect(record.origin).toBe('member')
    expect(record.value).toEqual({ kind: 'allow', items: ['m-b'] })
    expect(record.reason).toBe('policyStateLocked')
    expect(record.policyStateId).toBe('locked-model')
  })

  it('suppressions are recorded lazily and deduplicated on re-resolution', () => {
    expect(s1.storeSuppressionsAfterFirst).toBe(1)
    expect(s1.storeSuppressionsAfterReResolve).toBe(1)
  })

  it('a never-locked capability is never suppressed (tools deny stays active)', () => {
    const tools = s1.r2.cells.tools
    if (tools === undefined) throw new Error('p7t2 snapshot: missing tools cell')
    expect(tools.effective).toEqual({ kind: 'deny' })
    expect(tools.layer).toBe('instanceOverlay')
    expect(tools.origin).toBe('member')
    // The locked MODEL overlay is still suppressed at this step — but
    // no suppression record ever targets tools.
    expect(s1.r2.suppressed.every((record) => record.capability !== 'tools')).toBe(true)
    expect(s1.r2.suppressed.length).toBe(1)
    expect(s1.r2.suppressed[0]?.capability).toBe('model')
  })

  it('a human override is never suppressed (it is not an autonomy overlay)', () => {
    const model = s1.r3.cells.model
    if (model === undefined) throw new Error('p7t2 snapshot: missing model cell')
    expect(model.effective).toEqual({ kind: 'allow', items: ['m-z'] })
    expect(model.layer).toBe('humanOverride')
    // The member's stored overlay is still suppressed by the locked model.
    // The suppression carries the INSTANCE-SLOT id — the latest
    // contributing durable record overall at this step (the member's tools
    // deny, admitted at step 1); the per-capability contributor (the model
    // grant) is identified through the provenance ledger.
    expect(s1.r3.suppressed.length).toBe(1)
    expect(s1.r3.suppressed[0]?.overlayId).toBe(s1.recordIds.memberTools)
  })
})

describe('p7t2 policy state: lock, unlock, revive, pin', () => {
  it('atStep 5: the locked skills overlay is suppressed (second trail record)', () => {
    expect(s1.r5.policyStateId).toBe('locked-skills')
    const skills = s1.r5.cells.skills
    if (skills === undefined) throw new Error('p7t2 snapshot: missing skills cell')
    expect(skills.effective).toEqual({ kind: 'allow', items: ['s-a', 's-b'] })
    expect(skills.layer).toBe('template')
    expect(s1.r5.suppressed.length).toBe(1)
    expect(s1.r5.suppressed[0]?.capability).toBe('skills')
    expect(s1.r5.suppressed[0]?.overlayId).toBe(s1.recordIds.memberSkills)
    expect(s1.r5.suppressed[0]?.policyStateId).toBe('locked-skills')
    expect(s1.storeSuppressionsAfterSkillsLock).toBe(2)
  })

  it('atStep 6: unlocking REVIVES the stored overlay; the trail is preserved', () => {
    expect(s1.r6.policyStateId).toBe('unlocked')
    const skills = s1.r6.cells.skills
    if (skills === undefined) throw new Error('p7t2 snapshot: missing skills cell')
    expect(skills.effective).toEqual({ kind: 'allow', items: ['s-b'] })
    expect(skills.layer).toBe('instanceOverlay')
    expect(skills.recordId).toBe(s1.recordIds.memberSkills)
    expect(s1.r6.suppressed).toEqual([])
    // Non-destructive: the two historical suppression records survive.
    expect(s1.storeSuppressionsAfterUnlock).toBe(2)
    expect(s1.suppressionTrail.length).toBe(2)
    expect(s1.suppressionTrail.map((record) => record.policyStateId).sort()).toEqual([
      'locked-model',
      'locked-skills',
    ])
  })

  it('atStep 7: a state VALUE cell resolves at the policyState layer', () => {
    expect(s1.r7.policyStateId).toBe('pinned')
    const mcp = s1.r7.cells.mcp
    if (mcp === undefined) throw new Error('p7t2 snapshot: missing mcp cell')
    expect(mcp.effective).toEqual({ kind: 'allow', items: ['c-a'] })
    expect(mcp.layer).toBe('policyState')
    expect(mcp.origin).toBe('static')
    expect(mcp.recordId).toBe(null)
  })

  it('a cell with `locked` not exactly `true` normalizes to no lock', () => {
    expect(s1.lenientState.stateId).toBe('lenient')
    expect(s1.lenientState.modelCell).toEqual({})
  })
})

describe('p7t2 policy state: the malformed targets', () => {
  it('every malformed target is MALFORMED_MUTATION_INPUT with the offending field', () => {
    const cases: Array<[string, string]> = [
      ['stateIdEmpty', 'target.stateId'],
      ['stateIdWhitespace', 'target.stateId'],
      ['stateIdMissing', 'target.stateId'],
      ['unknownCapability', 'target.cells'],
      ['stateCellExtraField', 'target.cells.model'],
      ['stateCellValueEmptyItems', 'target.cells.model.value'],
      ['actorMember', 'actor.member'],
    ]
    for (const [name, field] of cases) {
      const result = s1.malformed[name]
      if (result === undefined) throw new Error(`p7t2 snapshot: missing case '${name}'`)
      expect(result.thrown).toBe(true)
      expect(result.code).toBe('MALFORMED_MUTATION_INPUT')
      expect(result.field).toBe(field)
    }
  })
})
