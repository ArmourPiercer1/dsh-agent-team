/**
 * p7t2-escalation — TaskDoc §11.8 P7-T2 must-test: every escalation
 * boundary, with a negative for each:
 *
 * - **member self-escalation** (invariant 37): a member-origin grant
 *   outside its OWN cell envelope (blueprint autonomyEnvelope ∩ its
 *   template mutationEnvelope) is rejected `MEMBER_SELF_ESCALATION` with
 *   the violating items; `deny` (tightening) is always admitted;
 * - **leader out of envelope** (invariant 36): a leader-origin grant must
 *   fit the intersection of EVERY registered member's cell envelope
 *   (the overlay is team-scoped); violations are
 *   `LEADER_OUT_OF_ENVELOPE`; with no member registered the check is
 *   skipped (design decision, recorded in the design note);
 * - **external hard facts** (invariant 35, §19.2/§25.4): checked for
 *   EVERY origin (human included) — `capabilityExists === false`, a hard
 *   `deny`, and a hard allow-list are `EXTERNAL_HARD_REJECTED`
 *   (hardReason: capabilityMissing / hardDeny / outsideHardAllowList);
 * - **human authority** (invariant 34): NOT envelope-bounded (the
 *   positive control against the two agent codes);
 * - **identity boundary** (invariant 18): cross-TeamSession member
 *   identities are `IDENTITY_SCOPE_MISMATCH`;
 * - **malformed intake** (closed sets, exact shapes):
 *   `MALFORMED_MUTATION_INPUT` with the offending `field` in `details`.
 *
 * The effective-state resolution after the admitted mutations pins the
 * resulting layer per cell (the precedence the boundary produced).
 *
 * @module @dsh-agent-team/runtime/test/p7t2-escalation
 */

import { describe, expect, it } from 'vitest'

import type { CapabilityName, MemberIdentity, PolicyEntry } from '../../domain/policy/src/index.js'
import type { StoredMutationRecord } from '../mutation/index.js'
import {
  allow,
  assertMutationCode,
  captureError,
  createP7T2World,
  deny,
  fixtureMember,
  foreignMember,
  P7T2_ALPHA,
  P7T2_BETA,
  P7T2_TEAM,
  type P7T2World,
} from './p7t2-helpers.js'

// ---------------------------------------------------------------------------
// Fixture: the blueprint DENIES every domain value but grants ENVELOPES;
// the two member templates grant different shares of the envelope, so the
// member boundary (own envelope) and the leader boundary (the
// intersection of all members' envelopes) differ per item.
//
// model envelope:  blueprint {m-a, m-c}  · alpha template {m-a, m-b}
//                  → alpha {m-a}        · beta template {m-a, m-c}
//                  → beta {m-a, m-c}    · leader intersection {m-a}
// skills envelope: blueprint {s-a, s-b}  · alpha template {s-a, s-b}
//                  → alpha {s-a, s-b}   · beta template {s-a}
//                  → beta {s-a}         · leader intersection {s-a}
// tools: {t-a} everywhere · permissions: ∅ everywhere · mcp:
//                  blueprint {c-a, c-c} · alpha {c-a} · beta {c-a, c-c}
// ---------------------------------------------------------------------------

const BLUEPRINT_ENVELOPE: Partial<Record<CapabilityName, PolicyEntry>> = {
  model: allow('m-a', 'm-c'),
  tools: allow('t-a'),
  permissions: deny(),
  skills: allow('s-a', 's-b'),
  mcp: allow('c-a', 'c-c'),
}

const ALPHA_TEMPLATE: Partial<Record<CapabilityName, PolicyEntry>> = {
  model: allow('m-a', 'm-b'),
  tools: allow('t-a'),
  permissions: deny(),
  skills: allow('s-a', 's-b'),
  mcp: allow('c-a'),
}

const BETA_TEMPLATE: Partial<Record<CapabilityName, PolicyEntry>> = {
  model: allow('m-a', 'm-c'),
  tools: allow('t-a'),
  permissions: deny(),
  skills: allow('s-a'),
  mcp: allow('c-a', 'c-c'),
}

function allDeny(): Partial<Record<CapabilityName, PolicyEntry>> {
  return {
    model: deny(),
    tools: deny(),
    permissions: deny(),
    skills: deny(),
    mcp: deny(),
  }
}

const alpha = () => fixtureMember(P7T2_ALPHA)
const beta = () => fixtureMember(P7T2_BETA)

// ---------------------------------------------------------------------------
// Scenario 1: the agent-escalation boundary (invariants 36/37)
// ---------------------------------------------------------------------------

interface Admitted {
  readonly ok: true
  readonly record: StoredMutationRecord
}

interface Rejected {
  readonly ok: false
  readonly code: string
  readonly details?: Record<string, unknown>
}

type Outcome = Admitted | Rejected

interface ExternalCaseResult {
  readonly ok: boolean
  readonly code?: string
  readonly hardReason?: string
  readonly items?: string[]
}

/** Narrow an admitted outcome (the `it` bodies branch on these). */
function admitted(out: Outcome | undefined): Admitted {
  expect(out?.ok).toBe(true)
  if (out === undefined || out.ok !== true) throw new Error('expected an admitted outcome')
  return out
}

/** Narrow a rejected outcome and assert its code. */
function rejected(out: Outcome | undefined, code: string): { code: string; details?: Record<string, unknown> } {
  expect(out?.ok).toBe(false)
  if (out === undefined || out.ok !== false) throw new Error('expected a rejected outcome')
  expect(out.code).toBe(code)
  return { code: out.code, details: out.details }
}

/** Run one admission and record the outcome (scenario-level). */
function admit(
  world: P7T2World,
  capability: CapabilityName,
  value: PolicyEntry,
  actor: { kind: 'human' | 'leader' | 'member'; member?: unknown },
  extra?: { scope?: 'team' | 'instance'; targetMember?: unknown },
): Outcome {
  const err = captureError(() => {
    world.service.requestMutation({
      teamSessionId: P7T2_TEAM,
      capability,
      value,
      actor: actor as never,
      ...(extra?.scope !== undefined ? { scope: extra.scope } : {}),
      ...(extra?.targetMember !== undefined ? { targetMember: extra.targetMember as never } : {}),
    })
  })
  if (err.thrown) {
    const expected =
      actor.kind === 'member'
        ? 'MEMBER_SELF_ESCALATION'
        : actor.kind === 'leader'
          ? 'LEADER_OUT_OF_ENVELOPE'
          : 'UNREACHABLE_HUMAN_ORIGIN'
    const checked = assertMutationCode(err.error, expected)
    return { ok: false, code: checked.code, details: checked.details }
  }
  const records = world.store.listRecords(P7T2_TEAM)
  const last = records[records.length - 1]
  if (last === undefined) throw new Error('admit: expected a durable record after admission')
  return { ok: true, record: last }
}

interface EscalationSnapshot {
  readonly cases: Record<string, Outcome>
  readonly resolveAlpha: {
    model: { effective: PolicyEntry; layer: string; origin: string }
    skills: { effective: PolicyEntry; layer: string }
    permissions: { effective: PolicyEntry; layer: string }
  }
  readonly resolveBeta: {
    model: { effective: PolicyEntry; layer: string; origin: string }
  }
}

const s1: EscalationSnapshot = (() => {
  const world: P7T2World = createP7T2World({
    blueprint: { values: allDeny(), autonomyEnvelope: BLUEPRINT_ENVELOPE },
    templates: {
      [P7T2_ALPHA]: { values: allDeny(), mutationEnvelope: ALPHA_TEMPLATE },
      [P7T2_BETA]: { values: allDeny(), mutationEnvelope: BETA_TEMPLATE },
    },
  })
  const { service, clock } = world
  service.registerInstance(P7T2_TEAM, alpha(), { workspace: 'ws-alpha', contextPolicy: 'ctx-alpha' })
  service.registerInstance(P7T2_TEAM, beta(), { workspace: 'ws-beta', contextPolicy: 'ctx-beta' })

  const cases: Record<string, Outcome> = {}
  // Member boundary (own envelope: model {m-a}, skills {s-a,s-b}, ∅ for
  // permissions).
  cases.memberInEnvelopeModel = admit(world, 'model', allow('m-a'), { kind: 'member', member: alpha() })
  cases.memberOutOfEnvelopeTemplateShare = admit(world, 'model', allow('m-b'), { kind: 'member', member: alpha() })
  cases.memberOutOfEnvelopeBlueprintShare = admit(world, 'model', allow('m-c'), { kind: 'member', member: alpha() })
  cases.memberOutOfEnvelopeNone = admit(world, 'model', allow('m-z'), { kind: 'member', member: alpha() })
  cases.memberPartialViolation = admit(world, 'model', allow('m-a', 'm-z'), { kind: 'member', member: alpha() })
  cases.memberEmptyEnvelope = admit(world, 'permissions', allow('p-a'), { kind: 'member', member: alpha() })
  cases.memberDenyAlwaysAdmitted = admit(world, 'permissions', deny(), { kind: 'member', member: alpha() })
  cases.memberAlphaSkillsInEnvelope = admit(world, 'skills', allow('s-b'), { kind: 'member', member: alpha() })
  // The same items for beta (its own envelope differs).
  cases.memberBetaModelInEnvelope = admit(world, 'model', allow('m-c'), { kind: 'member', member: beta() })
  cases.memberBetaSkillsOutOfEnvelope = admit(world, 'skills', allow('s-b'), { kind: 'member', member: beta() })
  // Leader boundary (intersection over all registered members: model
  // {m-a}, skills {s-a}).
  cases.leaderInIntersection = admit(world, 'model', allow('m-a'), { kind: 'leader' })
  cases.leaderOutOfIntersectionModel = admit(world, 'model', allow('m-c'), { kind: 'leader' })
  cases.leaderOutOfIntersectionSkills = admit(world, 'skills', allow('s-b'), { kind: 'leader' })
  cases.leaderPartialViolation = admit(world, 'model', allow('m-a', 'm-c'), { kind: 'leader' })
  cases.leaderDenyAlwaysAdmitted = admit(world, 'mcp', deny(), { kind: 'leader' })
  // Human authority (invariant 34: not envelope-bounded; external open).
  // Instance-scoped for alpha: a TEAM-scoped human override would sit
  // above beta's instanceOverlay too (frozen layer order), masking the
  // leader-overlay-vs-member-overlay check on beta's model cell below.
  cases.humanBeyondEnvelope = admit(world, 'model', allow('m-z'), { kind: 'human' }, { scope: 'instance', targetMember: alpha() })
  cases.humanTeamScoped = admit(world, 'mcp', allow('c-c'), { kind: 'human' })

  // Resolve both members at step 1 (all admissions effective now).
  clock.advance()
  const ra = service.resolveEffective(P7T2_TEAM, alpha(), 1)
  const rb = service.resolveEffective(P7T2_TEAM, beta(), 1)
  return {
    cases,
    resolveAlpha: {
      model: {
        effective: ra.policy.cells.model.effective,
        layer: ra.policy.cells.model.team.layer,
        origin: ra.policy.cells.model.team.origin,
      },
      skills: {
        effective: ra.policy.cells.skills.effective,
        layer: ra.policy.cells.skills.team.layer,
      },
      permissions: {
        effective: ra.policy.cells.permissions.effective,
        layer: ra.policy.cells.permissions.team.layer,
      },
    },
    resolveBeta: {
      model: {
        effective: rb.policy.cells.model.effective,
        layer: rb.policy.cells.model.team.layer,
        origin: rb.policy.cells.model.team.origin,
      },
    },
  }
})()

describe('p7t2 escalation: the member self-escalation boundary (invariant 37)', () => {
  it('an in-envelope member grant is admitted (instance overlay record)', () => {
    const out = admitted(s1.cases.memberInEnvelopeModel)
    expect(out.record.kind).toBe('instanceOverlay')
    expect(out.record.scope).toBe('instance')
    expect(out.record.origin).toBe('member')
    expect(out.record.effectiveFromStep).toBe(out.record.requestedAtStep + 1)
  })

  it('a grant outside the member envelope is MEMBER_SELF_ESCALATION (with the violating items)', () => {
    for (const name of [
      'memberOutOfEnvelopeTemplateShare',
      'memberOutOfEnvelopeBlueprintShare',
      'memberOutOfEnvelopeNone',
      'memberPartialViolation',
      'memberEmptyEnvelope',
      'memberBetaSkillsOutOfEnvelope',
    ]) {
      rejected(s1.cases[name], 'MEMBER_SELF_ESCALATION')
    }
    expect(rejected(s1.cases.memberOutOfEnvelopeTemplateShare, 'MEMBER_SELF_ESCALATION').details?.items).toEqual(['m-b'])
    expect(rejected(s1.cases.memberOutOfEnvelopeBlueprintShare, 'MEMBER_SELF_ESCALATION').details?.items).toEqual(['m-c'])
    expect(rejected(s1.cases.memberPartialViolation, 'MEMBER_SELF_ESCALATION').details?.items).toEqual(['m-z'])
    expect(rejected(s1.cases.memberEmptyEnvelope, 'MEMBER_SELF_ESCALATION').details?.items).toEqual(['p-a'])
  })

  it('a member DENY is always admitted (tightening never escalates)', () => {
    admitted(s1.cases.memberDenyAlwaysAdmitted)
  })

  it('the same item can be in-envelope for one member and not for another', () => {
    admitted(s1.cases.memberAlphaSkillsInEnvelope)
    rejected(s1.cases.memberBetaSkillsOutOfEnvelope, 'MEMBER_SELF_ESCALATION')
  })
})

describe('p7t2 escalation: the leader out-of-envelope boundary (invariant 36)', () => {
  it('a leader grant inside every member envelope is admitted (template overlay record)', () => {
    const out = admitted(s1.cases.leaderInIntersection)
    expect(out.record.kind).toBe('templateOverlay')
    expect(out.record.scope).toBe('team')
    expect(out.record.origin).toBe('leader')
  })

  it('a leader grant outside ANY member envelope is LEADER_OUT_OF_ENVELOPE', () => {
    for (const name of ['leaderOutOfIntersectionModel', 'leaderOutOfIntersectionSkills', 'leaderPartialViolation']) {
      rejected(s1.cases[name], 'LEADER_OUT_OF_ENVELOPE')
    }
    expect(rejected(s1.cases.leaderOutOfIntersectionModel, 'LEADER_OUT_OF_ENVELOPE').details?.items).toEqual(['m-c'])
  })

  it('a leader DENY is always admitted', () => {
    admitted(s1.cases.leaderDenyAlwaysAdmitted)
  })
})

describe('p7t2 escalation: human authority is not envelope-bounded (invariant 34)', () => {
  it('a human grant beyond the Team autonomy envelope is admitted', () => {
    const out = admitted(s1.cases.humanBeyondEnvelope)
    expect(out.record.kind).toBe('humanOverride')
    expect(out.record.scope).toBe('instance')
    expect(out.record.origin).toBe('human')
  })

  it('a human grant defaults to the team scope', () => {
    const out = admitted(s1.cases.humanTeamScoped)
    expect(out.record.scope).toBe('team')
  })
})

describe('p7t2 escalation: the effective layers after the boundary run', () => {
  it('alpha model resolves to the human override (highest Team layer)', () => {
    expect(s1.resolveAlpha.model.effective).toEqual({ kind: 'allow', items: ['m-z'] })
    expect(s1.resolveAlpha.model.layer).toBe('humanOverride')
    expect(s1.resolveAlpha.model.origin).toBe('human')
  })

  it('alpha skills resolves to the member overlay; alpha permissions to the member deny', () => {
    expect(s1.resolveAlpha.skills.effective).toEqual({ kind: 'allow', items: ['s-b'] })
    expect(s1.resolveAlpha.skills.layer).toBe('instanceOverlay')
    expect(s1.resolveAlpha.permissions.effective).toEqual({ kind: 'deny' })
    expect(s1.resolveAlpha.permissions.layer).toBe('instanceOverlay')
  })

  it('beta model resolves to the member overlay (the leader overlay is overridden)', () => {
    expect(s1.resolveBeta.model.effective).toEqual({ kind: 'allow', items: ['m-c'] })
    expect(s1.resolveBeta.model.layer).toBe('instanceOverlay')
    expect(s1.resolveBeta.model.origin).toBe('member')
  })
})

// ---------------------------------------------------------------------------
// Scenario 2: the external hard facts (invariant 35) — every origin
// ---------------------------------------------------------------------------

const s2: { readonly cases: Record<string, ExternalCaseResult> } = (() => {
  const world: P7T2World = createP7T2World({
    blueprint: { values: allDeny(), autonomyEnvelope: BLUEPRINT_ENVELOPE },
    templates: {
      [P7T2_ALPHA]: { values: allDeny(), mutationEnvelope: ALPHA_TEMPLATE },
      [P7T2_BETA]: { values: allDeny(), mutationEnvelope: BETA_TEMPLATE },
    },
  })
  const { service } = world
  service.registerInstance(P7T2_TEAM, alpha(), { workspace: 'ws-alpha', contextPolicy: 'ctx-alpha' })
  service.registerInstance(P7T2_TEAM, beta(), { workspace: 'ws-beta', contextPolicy: 'ctx-beta' })

  const run = (
    origin: 'human' | 'leader' | 'member',
    capability: CapabilityName,
    value: PolicyEntry,
    hard: Partial<Record<CapabilityName, PolicyEntry>>,
    capabilityExists: Partial<Record<CapabilityName, boolean>>,
  ): ExternalCaseResult => {
    world.reader.external = { hard, capabilityExists }
    const member = origin === 'member' ? alpha() : undefined
    const err = captureError(() => {
      service.requestMutation({
        teamSessionId: P7T2_TEAM,
        capability,
        value,
        actor:
          origin === 'human'
            ? { kind: 'human' }
            : origin === 'leader'
              ? { kind: 'leader' }
              : { kind: 'member', member: member as MemberIdentity },
      })
    })
    if (err.thrown) {
      const checked = assertMutationCode(err.error, 'EXTERNAL_HARD_REJECTED')
      const details = (checked.details ?? {}) as Record<string, unknown>
      return {
        ok: false,
        code: checked.code,
        hardReason: details.hardReason as string,
        items: details.items as string[],
      }
    }
    return { ok: true }
  }

  const cases: Record<string, ExternalCaseResult> = {}
  // Hard DENY: no origin may grant the cell (the envelopes allow m-a).
  cases.memberHardDeny = run('member', 'model', allow('m-a'), { model: deny() }, {})
  cases.humanHardDeny = run('human', 'model', allow('m-a'), { model: deny() }, {})
  cases.leaderHardDeny = run('leader', 'model', allow('m-a'), { model: deny() }, {})
  cases.denyStillAdmittedUnderHardDeny = run('member', 'model', deny(), { model: deny() }, {})
  // Capability MISSING: no origin may grant the cell.
  cases.memberCapabilityMissing = run('member', 'model', allow('m-a'), {}, { model: false })
  cases.humanCapabilityMissing = run('human', 'model', allow('m-a'), {}, { model: false })
  cases.denyStillAdmittedUnderMissing = run('human', 'model', deny(), {}, { model: false })
  // Hard ALLOW-LIST: grants must fit the host list.
  cases.memberWithinHardAllowList = run('member', 'tools', allow('t-a'), { tools: allow('t-a') }, {})
  cases.humanOutsideHardAllowList = run('human', 'tools', allow('t-a', 't-z'), { tools: allow('t-a') }, {})
  cases.leaderOutsideHardAllowList = run('leader', 'tools', allow('t-z'), { tools: allow('t-a') }, {})
  // Control: no facts → admitted.
  cases.openFactsControl = run('member', 'model', allow('m-a'), {}, {})
  return { cases }
})()

describe('p7t2 escalation: the external hard facts (invariant 35, every origin)', () => {
  it('a hard-deny cell rejects EVERY origin (human included)', () => {
    for (const name of ['memberHardDeny', 'humanHardDeny', 'leaderHardDeny']) {
      const out = s2.cases[name]
      expect(out?.ok).toBe(false)
      if (out?.ok === false) {
        expect(out.code).toBe('EXTERNAL_HARD_REJECTED')
        expect(out.hardReason).toBe('hardDeny')
      }
    }
  })

  it('a deny is still admitted under a hard deny (tightening)', () => {
    expect(s2.cases.denyStillAdmittedUnderHardDeny?.ok).toBe(true)
  })

  it('a missing capability rejects every grant (human included)', () => {
    for (const name of ['memberCapabilityMissing', 'humanCapabilityMissing']) {
      const out = s2.cases[name]
      expect(out?.ok).toBe(false)
      if (out?.ok === false) {
        expect(out.code).toBe('EXTERNAL_HARD_REJECTED')
        expect(out.hardReason).toBe('capabilityMissing')
      }
    }
  })

  it('a deny is still admitted for a missing capability', () => {
    expect(s2.cases.denyStillAdmittedUnderMissing?.ok).toBe(true)
  })

  it('a hard allow-list restricts the grantable items (every origin)', () => {
    expect(s2.cases.memberWithinHardAllowList?.ok).toBe(true)
    const human = s2.cases.humanOutsideHardAllowList
    expect(human?.ok).toBe(false)
    if (human?.ok === false) {
      expect(human.hardReason).toBe('outsideHardAllowList')
      expect(human.items).toEqual(['t-z'])
    }
    const leader = s2.cases.leaderOutsideHardAllowList
    expect(leader?.ok).toBe(false)
    if (leader?.ok === false) expect(leader.items).toEqual(['t-z'])
  })

  it('with no external facts the same grant is admitted (control)', () => {
    expect(s2.cases.openFactsControl?.ok).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// Scenario 3: no registered members → the leader envelope check is skipped
// (design decision: the first registration cannot violate a boundary with
// no members to bind)
// ---------------------------------------------------------------------------

const s3: { readonly leaderNoMembers: { readonly ok: boolean; readonly code?: string } } = (() => {
  const world: P7T2World = createP7T2World({
    blueprint: { values: allDeny(), autonomyEnvelope: BLUEPRINT_ENVELOPE },
  })
  const err = captureError(() => {
    world.service.requestMutation({
      teamSessionId: P7T2_TEAM,
      capability: 'model',
      value: allow('m-z'),
      actor: { kind: 'leader' },
    })
  })
  return {
    leaderNoMembers: err.thrown
      ? { ok: false, code: assertMutationCode(err.error, 'UNREACHABLE_LEADER_NO_MEMBERS').code }
      : { ok: true },
  }
})()

describe('p7t2 escalation: the no-registered-members leader case (skipped check)', () => {
  it('a leader grant is admitted when no member is registered (skip; envelope re-checked per-member later)', () => {
    expect(s3.leaderNoMembers.ok).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// Scenario 4: the malformed intake (closed sets + exact shapes) + the
// identity boundary (cross-TeamSession members)
// ---------------------------------------------------------------------------

const s4: Record<string, { thrown: boolean; code?: string; field?: string }> = (() => {
  const world: P7T2World = createP7T2World({
    blueprint: { values: allDeny(), autonomyEnvelope: BLUEPRINT_ENVELOPE },
    templates: {
      [P7T2_ALPHA]: { values: allDeny(), mutationEnvelope: ALPHA_TEMPLATE },
    },
  })
  const { service } = world
  service.registerInstance(P7T2_TEAM, alpha(), { workspace: 'ws-alpha', contextPolicy: 'ctx-alpha' })

  const results: Record<string, { thrown: boolean; code?: string; field?: string }> = {}
  const runCase = (name: string, expectedCode: string, fn: () => void, expectField?: string) => {
    const err = captureError(fn)
    if (err.thrown) {
      const checked = assertMutationCode(err.error, expectedCode)
      const details = (checked.details ?? {}) as Record<string, unknown>
      results[name] = {
        thrown: true,
        code: checked.code,
        ...(expectField !== undefined ? { field: details.field as string } : {}),
      }
      if (expectField !== undefined) expect(details.field).toBe(expectField)
    } else {
      results[name] = { thrown: false }
    }
  }

  runCase('unknownCapability', 'MALFORMED_MUTATION_INPUT', () => {
    service.requestMutation({
      teamSessionId: P7T2_TEAM,
      capability: 'web' as never,
      value: deny(),
      actor: { kind: 'leader' },
    })
  }, 'capability')
  runCase('badTeamSessionId', 'MALFORMED_MUTATION_INPUT', () => {
    service.requestMutation({
      teamSessionId: 42 as never,
      capability: 'model',
      value: deny(),
      actor: { kind: 'leader' },
    })
  }, 'teamSessionId')
  runCase('badActorKind', 'MALFORMED_MUTATION_INPUT', () => {
    service.requestMutation({
      teamSessionId: P7T2_TEAM,
      capability: 'model',
      value: deny(),
      actor: { kind: 'wizard' as never },
    })
  }, 'actor.kind')
  runCase('memberWithoutIdentity', 'MALFORMED_MUTATION_INPUT', () => {
    service.requestMutation({
      teamSessionId: P7T2_TEAM,
      capability: 'model',
      value: deny(),
      actor: { kind: 'member' },
    })
  }, 'actor.member')
  runCase('memberWithNonRecordIdentity', 'MALFORMED_MUTATION_INPUT', () => {
    service.requestMutation({
      teamSessionId: P7T2_TEAM,
      capability: 'model',
      value: deny(),
      actor: { kind: 'member', member: 'nope' as unknown as MemberIdentity },
    })
  }, 'actor.member')
  // Cross-team identities are an identity-boundary violation (invariant
  // 18), NOT a shape violation — the frozen code is preserved verbatim.
  runCase('crossTeamMember', 'IDENTITY_SCOPE_MISMATCH', () => {
    service.requestMutation({
      teamSessionId: P7T2_TEAM,
      capability: 'model',
      value: deny(),
      actor: { kind: 'member', member: foreignMember(P7T2_ALPHA) },
    })
  })
  runCase('agentWithScope', 'MALFORMED_MUTATION_INPUT', () => {
    service.requestMutation({
      teamSessionId: P7T2_TEAM,
      capability: 'model',
      value: deny(),
      actor: { kind: 'leader' },
      scope: 'team',
    })
  }, 'actor.scope')
  runCase('agentWithTarget', 'MALFORMED_MUTATION_INPUT', () => {
    service.requestMutation({
      teamSessionId: P7T2_TEAM,
      capability: 'model',
      value: deny(),
      actor: { kind: 'leader' },
      targetMember: alpha(),
    })
  }, 'targetMember')
  runCase('humanTeamWithTarget', 'MALFORMED_MUTATION_INPUT', () => {
    service.requestMutation({
      teamSessionId: P7T2_TEAM,
      capability: 'model',
      value: deny(),
      actor: { kind: 'human' },
      scope: 'team',
      targetMember: alpha(),
    })
  }, 'targetMember')
  runCase('humanInstanceWithoutTarget', 'MALFORMED_MUTATION_INPUT', () => {
    service.requestMutation({
      teamSessionId: P7T2_TEAM,
      capability: 'model',
      value: deny(),
      actor: { kind: 'human' },
      scope: 'instance',
    })
  }, 'targetMember')
  runCase('crossTeamTarget', 'IDENTITY_SCOPE_MISMATCH', () => {
    service.requestMutation({
      teamSessionId: P7T2_TEAM,
      capability: 'model',
      value: deny(),
      actor: { kind: 'human' },
      scope: 'instance',
      targetMember: foreignMember(P7T2_ALPHA),
    })
  })
  runCase('emptyAllowItems', 'MALFORMED_MUTATION_INPUT', () => {
    service.requestMutation({
      teamSessionId: P7T2_TEAM,
      capability: 'model',
      value: { kind: 'allow', items: [] },
      actor: { kind: 'leader' },
    })
  }, 'value')
  runCase('duplicateAllowItems', 'MALFORMED_MUTATION_INPUT', () => {
    service.requestMutation({
      teamSessionId: P7T2_TEAM,
      capability: 'model',
      value: { kind: 'allow', items: ['m-a', 'm-a'] },
      actor: { kind: 'leader' },
    })
  }, 'value.items')
  runCase('allowWithoutItems', 'MALFORMED_MUTATION_INPUT', () => {
    service.requestMutation({
      teamSessionId: P7T2_TEAM,
      capability: 'model',
      value: { kind: 'allow' } as unknown as PolicyEntry,
      actor: { kind: 'leader' },
    })
  }, 'value')
  runCase('nonStringItem', 'MALFORMED_MUTATION_INPUT', () => {
    service.requestMutation({
      teamSessionId: P7T2_TEAM,
      capability: 'model',
      value: { kind: 'allow', items: [1] } as unknown as PolicyEntry,
      actor: { kind: 'leader' },
    })
  }, 'value.items')
  runCase('emptyStringItem', 'MALFORMED_MUTATION_INPUT', () => {
    service.requestMutation({
      teamSessionId: P7T2_TEAM,
      capability: 'model',
      value: { kind: 'allow', items: [''] },
      actor: { kind: 'leader' },
    })
  }, 'value.items')
  runCase('allowExtraField', 'MALFORMED_MUTATION_INPUT', () => {
    service.requestMutation({
      teamSessionId: P7T2_TEAM,
      capability: 'model',
      value: { kind: 'allow', items: ['m-a'], extra: 1 } as unknown as PolicyEntry,
      actor: { kind: 'leader' },
    })
  }, 'value')
  runCase('denyExtraField', 'MALFORMED_MUTATION_INPUT', () => {
    service.requestMutation({
      teamSessionId: P7T2_TEAM,
      capability: 'model',
      value: { kind: 'deny', extra: 1 } as unknown as PolicyEntry,
      actor: { kind: 'leader' },
    })
  }, 'value')
  runCase('unknownKind', 'MALFORMED_MUTATION_INPUT', () => {
    service.requestMutation({
      teamSessionId: P7T2_TEAM,
      capability: 'model',
      value: { kind: 'maybe', items: ['m-a'] } as unknown as PolicyEntry,
      actor: { kind: 'leader' },
    })
  }, 'value')
  runCase('valueNotARecord', 'MALFORMED_MUTATION_INPUT', () => {
    service.requestMutation({
      teamSessionId: P7T2_TEAM,
      capability: 'model',
      value: 'deny' as never,
      actor: { kind: 'leader' },
    })
  }, 'value')
  return results
})()

describe('p7t2 escalation: the malformed intake (MALFORMED_MUTATION_INPUT)', () => {
  const MALFORMED_FIELDS: Record<string, string> = {
    unknownCapability: 'capability',
    badTeamSessionId: 'teamSessionId',
    badActorKind: 'actor.kind',
    memberWithoutIdentity: 'actor.member',
    memberWithNonRecordIdentity: 'actor.member',
    agentWithScope: 'actor.scope',
    agentWithTarget: 'targetMember',
    humanTeamWithTarget: 'targetMember',
    humanInstanceWithoutTarget: 'targetMember',
    // The frozen domain reports item-level problems on `value.items`
    // (entry-level shape problems stay on `value`).
    emptyAllowItems: 'value',
    duplicateAllowItems: 'value.items',
    allowWithoutItems: 'value',
    nonStringItem: 'value.items',
    emptyStringItem: 'value.items',
    allowExtraField: 'value',
    denyExtraField: 'value',
    unknownKind: 'value',
    valueNotARecord: 'value',
  }

  it('every malformed case throws MALFORMED_MUTATION_INPUT with the offending field', () => {
    for (const [name, expectedField] of Object.entries(MALFORMED_FIELDS)) {
      const result = s4[name]
      expect(result?.thrown).toBe(true)
      if (result?.thrown) {
        expect(result.code).toBe('MALFORMED_MUTATION_INPUT')
        expect(result.field).toBe(expectedField)
      }
    }
  })

  it('cross-team member identities are IDENTITY_SCOPE_MISMATCH (not malformed)', () => {
    for (const name of ['crossTeamMember', 'crossTeamTarget']) {
      const result = s4[name]
      expect(result?.thrown).toBe(true)
      if (result?.thrown) expect(result.code).toBe('IDENTITY_SCOPE_MISMATCH')
    }
  })

  it('a cross-team member identity in a fresh world is IDENTITY_SCOPE_MISMATCH (not malformed)', () => {
    const world: P7T2World = createP7T2World({
      blueprint: { values: allDeny(), autonomyEnvelope: BLUEPRINT_ENVELOPE },
    })
    const err = captureError(() =>
      world.service.requestMutation({
        teamSessionId: P7T2_TEAM,
        capability: 'model',
        value: deny(),
        actor: { kind: 'member', member: foreignMember(P7T2_ALPHA) },
      }),
    )
    expect(err.thrown).toBe(true)
    if (err.thrown) {
      expect(assertMutationCode(err.error, 'IDENTITY_SCOPE_MISMATCH').code).toBe('IDENTITY_SCOPE_MISMATCH')
    }
  })
})
