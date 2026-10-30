/**
 * Alpha.6 PR0 (Lane 2) — the case-scoped review admission law, as negative
 * controls.
 *
 * THE SHAPE OF THIS FILE is deliberate. Alpha.6 hands a Member instance a
 * limited reviewing power inside a governance law whose whole value is that
 * Members decide nothing. So the tests are ordered as the law is ordered, and
 * the majority of them are NEGATIONS: each one plants exactly one widening
 * (a human rung, a leg-less row, a cross-team plan, a reviewer who is also the
 * requester, a grant that outlived its epoch) and requires the closed refusal
 * code for it. The positives are few and narrow on purpose: they say the
 * delegation works for one bound reviewer on one bound case, and the
 * negations are what keep it there.
 *
 * TWO REGRESSION PINS are load-bearing beyond this lane's own logic:
 *  - the Alpha.4 role closure must answer EXACTLY as `CONTROL_RESOLVER_ROLES`
 *    does today, read out of the protected source at test time. This lane
 *    mirrors a 3-key table only to order its own branch; if the center's table
 *    ever moves, this test goes red before the mirror can silently diverge.
 *  - `member` must appear in NO role list. That is invariant 37, and it is the
 *    one fact that proves this phase is a case-scoped exception and not a
 *    rung: if anyone "simplifies" Alpha.6 by adding 'member' to
 *    `leader-approval`, this test fails on the center's own text.
 */

import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

import { LEADER_INSTANCE_ID } from '../../contracts/src/index.js'
import {
  CONTROL_ROLE_CLOSURE_MIRROR,
  REVIEW_REQUEST_KINDS,
  delegationApplicable,
  evaluateReviewAdmission,
  parseReviewPlan,
  roleTableAdmits,
  type ReviewAdmissionInput,
  type ReviewCaseView,
  type ReviewMandate,
  type ReviewPlan,
  type ReviewerIdentity,
} from '../review-mandate/index.js'

const RUNTIME_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')

const DIGEST_64 = 'd4e5f6a7b8c90123456789abcdef0123456789abcdef0123456789abcdef0123'
const FINGERPRINT = 'ab12cd34ef560718293a4b5c6d7e8f90'
const OTHER_FINGERPRINT = '0f9e8d7c6b5a43210fedcba987654321'
const CASE_ID = 'case-1f2e3d4c'

function officerPlan(overrides: Partial<ReviewPlan> = {}): ReviewPlan {
  const result = parseReviewPlan({
    rootSessionId: 'team-root-01',
    blueprintDigest: DIGEST_64,
    epoch: 7,
    reviewerInstanceId: 'inst-officer-1',
    delegatedRung: 'leader',
    actions: [{ actionName: 'fs:write', decisions: ['allow', 'deny'] }],
    effectScopes: [{ form: 'exact-fingerprint', value: FINGERPRINT }],
    expiresAtIso: null,
  })
  if (!result.ok) throw new Error(`fixture plan refused: ${result.failure.code}`)
  return { ...result.plan, ...overrides }
}

function officerCaller(overrides: Partial<ReviewerIdentity> = {}): ReviewerIdentity {
  return {
    role: 'member',
    instanceId: 'inst-officer-1',
    callerRef: 'instance:inst-officer-1',
    rootSessionId: 'team-root-01',
    isLeaderInstance: false,
    ...overrides,
  }
}

function leaderCase(overrides: Partial<ReviewCaseView> = {}): ReviewCaseView {
  return {
    approvalCaseId: CASE_ID,
    requestKind: 'leader-approval',
    legReviewAuthority: 'leader',
    legOrdinal: 1,
    currentLegOrdinal: 1,
    actedCallerRefs: [],
    requesterCallerRef: 'instance:inst-worker-9',
    beneficiaryCallerRef: null,
    subjectCallerRef: null,
    actionName: 'fs:write',
    effectScopeFingerprint: FINGERPRINT,
    ...overrides,
  }
}

function grant(overrides: Partial<ReviewMandate> = {}): ReviewMandate {
  return {
    approvalCaseId: CASE_ID,
    legOrdinal: 1,
    reviewerInstanceId: 'inst-officer-1',
    planEpoch: 7,
    actionName: 'fs:write',
    decisions: ['allow', 'deny'],
    effectScopeFingerprint: FINGERPRINT,
    revoked: false,
    generation: 1,
    ...overrides,
  }
}

function admissionInput(overrides: Partial<ReviewAdmissionInput> = {}): ReviewAdmissionInput {
  return {
    caller: officerCaller(),
    attempt: { decision: 'allow', actionName: 'fs:write', effectScopeFingerprint: FINGERPRINT },
    caseView: leaderCase(),
    plan: officerPlan(),
    mandate: grant(),
    currentEpoch: 7,
    nowIso: '2026-10-30T12:00:00Z',
    planRevoked: false,
    ...overrides,
  }
}

describe('a6-pr0 the Alpha.4 role closure is untouched (L-6 default-off)', () => {
  it('mirrors CONTROL_RESOLVER_ROLES exactly, read from the protected source', () => {
    const source = readFileSync(join(RUNTIME_ROOT, 'control', 'types.ts'), 'utf8')
    const block = /export const CONTROL_RESOLVER_ROLES[^=]*=\s*\{([\s\S]*?)\n\}/.exec(source)
    expect(block, 'CONTROL_RESOLVER_ROLES moved or renamed — re-read the center').not.toBeNull()
    const body = block?.[1] ?? ''
    for (const kind of REVIEW_REQUEST_KINDS) {
      const entry = new RegExp(`'${kind}':\\s*\\[([^\\]]*)\\]`).exec(body)
      expect(entry, `role list for ${kind} not found in the center`).not.toBeNull()
      const roles = (entry?.[1] ?? '')
        .split(',')
        .map((part) => part.trim().replace(/^'|'$/g, ''))
        .filter((part) => part.length > 0)
      expect([...CONTROL_ROLE_CLOSURE_MIRROR[kind]].sort()).toEqual([...roles].sort())
    }
  })

  it('invariant 37 still holds in the center: no member is a resolver for any kind', () => {
    const source = readFileSync(join(RUNTIME_ROOT, 'control', 'types.ts'), 'utf8')
    const block = /export const CONTROL_RESOLVER_ROLES[^=]*=\s*\{([\s\S]*?)\n\}/.exec(source)
    expect(block?.[1] ?? '').not.toMatch(/'member'/)
    for (const kind of REVIEW_REQUEST_KINDS) {
      expect(CONTROL_ROLE_CLOSURE_MIRROR[kind]).not.toContain('member')
    }
  })

  it('a Leader and a Human are admitted exactly as today, with no plan anywhere', () => {
    for (const caller of [
      officerCaller({ role: 'leader', instanceId: LEADER_INSTANCE_ID, callerRef: `instance:${LEADER_INSTANCE_ID}`, isLeaderInstance: true }),
      officerCaller({ role: 'human', instanceId: null, callerRef: 'user:operator' }),
    ]) {
      const answer = evaluateReviewAdmission(admissionInput({ caller, plan: undefined, mandate: undefined }))
      expect(answer).toEqual({ admitted: true, basis: 'role-table', refusal: null })
    }
  })

  it('a Leader is STILL refused on user-approval — the mirror did not soften the kind', () => {
    expect(roleTableAdmits('leader', 'user-approval')).toBe(false)
    const answer = evaluateReviewAdmission(
      admissionInput({
        caller: officerCaller({ role: 'leader', instanceId: LEADER_INSTANCE_ID, callerRef: `instance:${LEADER_INSTANCE_ID}`, isLeaderInstance: true }),
        caseView: leaderCase({ requestKind: 'user-approval' }),
      }),
    )
    expect(answer.admitted).toBe(false)
    // The kind is not delegable and the caller is not a Member candidate: the
    // refusal names the caller, never the kind, because nothing about the
    // Leader path changed.
    expect(answer.refusal).toBe('REVIEW_NOT_A_MEMBER_CALLER')
  })

  it('an un-migrated Team (no plan) sees the old answer for a Member: refused', () => {
    const answer = evaluateReviewAdmission(admissionInput({ plan: undefined, mandate: undefined }))
    expect(answer).toEqual({ admitted: false, basis: null, refusal: 'REVIEW_PLAN_ABSENT' })
  })
})

describe('a6-pr0 the happy path is exactly one narrow door', () => {
  it('admits the bound officer on its own case, and records the basis only as a diagnostic', () => {
    const answer = evaluateReviewAdmission(admissionInput())
    expect(answer).toEqual({ admitted: true, basis: 'case-mandate', refusal: null })
  })

  it('admits a deny decision too (delegating review is not delegating approval)', () => {
    const answer = evaluateReviewAdmission(admissionInput({ attempt: { decision: 'deny', actionName: 'fs:write', effectScopeFingerprint: FINGERPRINT } }))
    expect(answer.admitted).toBe(true)
  })

  it('delegationApplicable agrees with the door for the three delegable-row shapes', () => {
    expect(delegationApplicable(leaderCase())).toBe(true)
    expect(delegationApplicable(leaderCase({ approvalCaseId: undefined }))).toBe(false)
    expect(delegationApplicable(leaderCase({ requestKind: 'user-approval' }))).toBe(false)
    expect(delegationApplicable(leaderCase({ legReviewAuthority: 'human-user' }))).toBe(false)
  })
})

describe('a6-pr0 the plan must be live (L-3, L-5)', () => {
  it.each<[string, Partial<ReviewAdmissionInput>, string]>([
    ['a revoked plan', { planRevoked: true }, 'REVIEW_PLAN_REVOKED'],
    ['a plan from another team', { plan: officerPlan({ rootSessionId: 'team-root-OTHER' }) }, 'REVIEW_PLAN_TEAM_MISMATCH'],
    ['a plan one epoch behind', { plan: officerPlan({ epoch: 6 }) }, 'REVIEW_PLAN_EPOCH_STALE'],
    ['a plan one epoch ahead', { plan: officerPlan({ epoch: 8 }) }, 'REVIEW_PLAN_EPOCH_STALE'],
    ['an expired plan (same epoch, window closed)', { plan: officerPlan({ expiresAtIso: '2026-10-30T11:00:00Z' }) }, 'REVIEW_PLAN_EXPIRED'],
    ['a caller whose clock is not an instant', { nowIso: 'not-a-time', plan: officerPlan({ expiresAtIso: '2026-11-30T11:00:00Z' }) }, 'REVIEW_CLOCK_INVALID'],
    ['a member caller with no resolved instance', { caller: officerCaller({ instanceId: null }) }, 'REVIEW_NOT_A_MEMBER_CALLER'],
  ])('refuses %s', (_label, override, refusal) => {
    const answer = evaluateReviewAdmission(admissionInput(override))
    expect(answer.admitted).toBe(false)
    expect(answer.refusal).toBe(refusal)
  })

  it('refuses a caller who is not the bound reviewer, even holding a valid grant', () => {
    const answer = evaluateReviewAdmission(
      admissionInput({ caller: officerCaller({ instanceId: 'inst-officer-2', callerRef: 'instance:inst-officer-2' }) }),
    )
    expect(answer.refusal).toBe('REVIEW_IDENTITY_FOREIGN')
  })

  it('refuses a grant that names a different instance than the live plan binds', () => {
    const answer = evaluateReviewAdmission(admissionInput({ mandate: grant({ reviewerInstanceId: 'inst-officer-3' }) }))
    expect(answer.refusal).toBe('REVIEW_IDENTITY_FOREIGN')
  })

  it('refuses a plan whose reviewer is the Leader instance (the Officer is not a second Leader)', () => {
    const answer = evaluateReviewAdmission(
      admissionInput({ caller: officerCaller({ isLeaderInstance: true }), plan: officerPlan({ reviewerInstanceId: LEADER_INSTANCE_ID }) }),
    )
    expect(answer.refusal).toBe('REVIEW_PLAN_REVIEWER_IS_LEADER')
  })
})

describe('a6-pr0 the row must be a delegable case (L-1, L-2)', () => {
  it.each<[string, Partial<ReviewCaseView>, string]>([
    ['a user-approval case (a Member may not stand in for the user)', { requestKind: 'user-approval' }, 'REVIEW_KIND_NOT_DELEGABLE'],
    ['an envelope-mutation case', { requestKind: 'envelope-mutation' }, 'REVIEW_KIND_NOT_DELEGABLE'],
    ['a leg whose rung is human-user', { legReviewAuthority: 'human-user' }, 'REVIEW_RUNG_NOT_DELEGABLE'],
    ['a leg whose rung is human-admin', { legReviewAuthority: 'human-admin' }, 'REVIEW_RUNG_NOT_DELEGABLE'],
    ['a leg whose rung is already member-level', { legReviewAuthority: 'member' }, 'REVIEW_RUNG_NOT_DELEGABLE'],
    ['a leg-less row: no approvalCaseId to scope a mandate to', { approvalCaseId: undefined }, 'REVIEW_CASE_UNBOUND'],
    ['an empty-string approvalCaseId', { approvalCaseId: '' }, 'REVIEW_CASE_UNBOUND'],
  ])('refuses %s', (_label, override, refusal) => {
    const answer = evaluateReviewAdmission(admissionInput({ caseView: leaderCase(override) }))
    expect(answer.admitted).toBe(false)
    expect(answer.refusal).toBe(refusal)
  })

  it('the leg-less-row refusal is the case-keyed law, not a role widening', () => {
    // Pre-v3 adapter rows, PA-bridge rows and raw `team_request_control` rows
    // carry no approvalCaseId. A role-table widening would hand a Member the
    // decision on exactly those rows; the case gate is what makes Alpha.6 an
    // exception inside the existing law instead of a new rung.
    for (const legless of [
      leaderCase({ approvalCaseId: undefined }),
      leaderCase({ approvalCaseId: undefined, requestKind: 'user-approval' }),
    ]) {
      const answer = evaluateReviewAdmission(admissionInput({ caseView: legless }))
      expect(answer.admitted).toBe(false)
    }
  })
})

describe('a6-pr0 case law and self-interest (L-4)', () => {
  it.each<[string, Partial<ReviewCaseView>, string]>([
    ['a stale leg', { legOrdinal: 1, currentLegOrdinal: 2 }, 'REVIEW_LEG_STALE'],
    ['an actor who already decided on an earlier leg', { actedCallerRefs: ['instance:inst-officer-1'] }, 'REVIEW_ALREADY_ACTED_ON_THIS_CASE'],
    ['the officer reviewing its own request', { requesterCallerRef: 'instance:inst-officer-1' }, 'REVIEW_SELF_REQUESTER'],
    ['the officer as the named beneficiary', { beneficiaryCallerRef: 'instance:inst-officer-1' }, 'REVIEW_SELF_BENEFICIARY'],
    ['the officer as the subject of the case', { subjectCallerRef: 'instance:inst-officer-1' }, 'REVIEW_SELF_SUBJECT'],
  ])('refuses %s', (_label, override, refusal) => {
    const answer = evaluateReviewAdmission(admissionInput({ caseView: leaderCase(override) }))
    expect(answer.admitted).toBe(false)
    expect(answer.refusal).toBe(refusal)
  })

  it('a different actor having acted does not disqualify the officer', () => {
    const answer = evaluateReviewAdmission(
      admissionInput({ caseView: leaderCase({ actedCallerRefs: ['instance:inst-worker-9'] }) }),
    )
    expect(answer.admitted).toBe(true)
  })
})

describe('a6-pr0 the grant must exist and still agree with the live plan', () => {
  it.each<[string, ReviewMandate | undefined, string]>([
    ['no grant fact at all', undefined, 'REVIEW_MANDATE_ABSENT'],
    ['a revoked grant', grant({ revoked: true }), 'REVIEW_MANDATE_REVOKED'],
    ['a grant with a malformed generation', grant({ generation: 0 }), 'REVIEW_MANDATE_GENERATION_INVALID'],
    ['a grant bound to a different case', grant({ approvalCaseId: 'case-OTHER' }), 'REVIEW_MANDATE_CASE_MISMATCH'],
    ['a grant bound to a different leg', grant({ legOrdinal: 2 }), 'REVIEW_MANDATE_LEG_MISMATCH'],
    ['a grant from a previous plan epoch', grant({ planEpoch: 6 }), 'REVIEW_MANDATE_EPOCH_MISMATCH'],
    ['a grant for an action the case is not about', grant({ actionName: 'net:fetch' }), 'REVIEW_MANDATE_ACTION_NOT_DELEGATED'],
    ['a grant for an effect set the case is not about', grant({ effectScopeFingerprint: OTHER_FINGERPRINT }), 'REVIEW_MANDATE_SCOPE_NOT_DELEGATED'],
  ])('refuses %s', (_label, mandate, refusal) => {
    const answer = evaluateReviewAdmission(admissionInput({ mandate }))
    expect(answer.admitted).toBe(false)
    expect(answer.refusal).toBe(refusal)
  })

  it('refuses a decision value the plan never delegated', () => {
    const answer = evaluateReviewAdmission(admissionInput({ mandate: grant({ decisions: ['deny'] }) }))
    expect(answer.refusal).toBe('REVIEW_MANDATE_DECISION_NOT_DELEGATED')
  })

  it('refuses an attempt whose fingerprint drifted from the case it claims to decide', () => {
    const answer = evaluateReviewAdmission(
      admissionInput({ attempt: { decision: 'allow', actionName: 'fs:write', effectScopeFingerprint: OTHER_FINGERPRINT } }),
    )
    expect(answer.refusal).toBe('REVIEW_MANDATE_SCOPE_NOT_DELEGATED')
  })

  it('refuses when the live plan stopped covering the effect scope, grant still present', () => {
    const answer = evaluateReviewAdmission(
      admissionInput({ plan: officerPlan({ effectScopes: [{ form: 'exact-fingerprint', value: OTHER_FINGERPRINT }] }) }),
    )
    expect(answer.refusal).toBe('REVIEW_MANDATE_SCOPE_NOT_DELEGATED')
  })

  it('refuses when the live plan stopped covering the action, grant still present', () => {
    const answer = evaluateReviewAdmission(
      admissionInput({
        plan: officerPlan({
          actions: [{ actionName: 'net:fetch', decisions: ['allow', 'deny'] }],
          effectScopes: [{ form: 'by-action-name', value: 'net:fetch' }],
        }),
      }),
    )
    expect(answer.refusal).toBe('REVIEW_MANDATE_ACTION_NOT_DELEGATED')
  })
})

describe('a6-pr0 every refusal is a closed code with no side channel', () => {
  it('an answer never carries both an admission and a refusal, and never a free-form reason', () => {
    const answers = [
      evaluateReviewAdmission(admissionInput()),
      evaluateReviewAdmission(admissionInput({ mandate: undefined })),
      evaluateReviewAdmission(admissionInput({ caller: officerCaller({ role: 'leader', instanceId: LEADER_INSTANCE_ID, callerRef: 'leader', isLeaderInstance: true }) })),
    ]
    for (const answer of answers) {
      expect(Object.keys(answer).sort()).toEqual(['admitted', 'basis', 'refusal'])
      expect(answer.admitted ? answer.refusal === null : answer.refusal !== null).toBe(true)
      expect(answer.admitted ? answer.basis !== null : answer.basis === null).toBe(true)
    }
  })
})
