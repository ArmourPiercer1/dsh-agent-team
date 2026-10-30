/**
 * Alpha.6 PR0 (Lane 2), review round 2 — the closures the second review asked for.
 *
 * Round 1 found doors that opened; round 2 verified they were welded shut and then found the residue:
 * the module promised "no exception path" absolutely, while an ABSENT container (`caseView: null`) still
 * threw a TypeError, because the presence check cannot live below the destructure that reads it; the
 * 32-code refusal vocabulary was closed at the type level and nowhere at runtime; and the brand
 * negative controls only ever produced a refusal-code mismatch, never the thing that would actually
 * matter — an input that flips to `admitted: true` when the brand is deleted. All three are closed here.
 */

import { describe, expect, it } from 'vitest'

import {
  REVIEW_ADMISSION_REFUSALS,
  delegationApplicable,
  evaluateReviewAdmission,
  parseReviewPlan,
  reviewPlanDigest,
  type ReviewAdmissionInput,
  type ReviewCaseView,
  type ReviewMandate,
  type ReviewPlan,
  type ReviewerIdentity,
} from '../review-mandate/index.js'

const DIGEST_64 = 'd4e5f6a7b8c90123456789abcdef0123456789abcdef0123456789abcdef0123'
const FINGERPRINT = 'ab12cd34ef560718293a4b5c6d7e8f90'
const CASE_ID = 'case-1f2e3d4c'

function parsedPlan(): ReviewPlan {
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
  return result.plan
}

function parsedPlanExpiring(expiresAtIso: string): ReviewPlan {
  const result = parseReviewPlan({
    rootSessionId: 'team-root-01',
    blueprintDigest: DIGEST_64,
    epoch: 7,
    reviewerInstanceId: 'inst-officer-1',
    delegatedRung: 'leader',
    actions: [{ actionName: 'fs:write', decisions: ['allow', 'deny'] }],
    effectScopes: [{ form: 'exact-fingerprint', value: FINGERPRINT }],
    expiresAtIso,
  })
  if (!result.ok) throw new Error(`fixture plan refused: ${result.failure.code}`)
  return result.plan
}

function officerCaller(): ReviewerIdentity {
  return { role: 'member', instanceId: 'inst-officer-1', callerRef: 'instance:inst-officer-1', rootSessionId: 'team-root-01', isLeaderInstance: false }
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

function grant(fingerprint: string = FINGERPRINT): ReviewMandate {
  return { approvalCaseId: CASE_ID, legOrdinal: 1, reviewerInstanceId: 'inst-officer-1', planEpoch: 7, actionName: 'fs:write', decisions: ['allow', 'deny'], effectScopeFingerprint: fingerprint, revoked: false, generation: 1 }
}

function input(overrides: Partial<ReviewAdmissionInput> = {}): ReviewAdmissionInput {
  return { caller: officerCaller(), attempt: { decision: 'allow', actionName: 'fs:write', effectScopeFingerprint: FINGERPRINT }, caseView: leaderCase(), plan: parsedPlan(), mandate: grant(), currentEpoch: 7, nowIso: '2026-10-30T12:00:00Z', planRevoked: false, ...overrides }
}

describe('a6-pr0 review round 2 / NEW-1 — absent containers answer a code, they do not throw', () => {
  it.each<[string, () => unknown]>([
    ['a null input object', () => evaluateReviewAdmission(null as unknown as ReviewAdmissionInput)],
    ['an undefined input object', () => evaluateReviewAdmission(undefined as unknown as ReviewAdmissionInput)],
    ['a null case view', () => evaluateReviewAdmission(input({ caseView: null as unknown as ReviewCaseView }))],
    ['an undefined case view', () => evaluateReviewAdmission(input({ caseView: undefined as unknown as ReviewCaseView }))],
    ['a case view that is a string', () => evaluateReviewAdmission(input({ caseView: 'case-1f2e3d4c' as unknown as ReviewCaseView }))],
    ['a null caller', () => evaluateReviewAdmission(input({ caller: null as unknown as ReviewerIdentity }))],
    ['an undefined caller', () => evaluateReviewAdmission(input({ caller: undefined as unknown as ReviewerIdentity }))],
    ['a caller that is an array', () => evaluateReviewAdmission(input({ caller: [] as unknown as ReviewerIdentity }))],
  ])('%s is refused without an exception', (_label, run) => {
    expect(run).not.toThrow()
  })

  it('names the absent container it refused, so the caller learns which hole to close', () => {
    expect(evaluateReviewAdmission(null as unknown as ReviewAdmissionInput).refusal).toBe('REVIEW_INPUT_MALFORMED')
    expect(evaluateReviewAdmission(input({ caseView: null as unknown as ReviewCaseView })).refusal).toBe('REVIEW_CASE_MALFORMED')
    expect(evaluateReviewAdmission(input({ caller: null as unknown as ReviewerIdentity })).refusal).toBe('REVIEW_CALLER_MALFORMED')
  })

  it('a malformed row is still refused for a role the table admits (ordering is by construction, not by luck)', () => {
    // Round 2 noted the placement of the value guards changed an observable: a
    // Leader on a malformed row used to reach the role table first. The answer
    // is the one the lane wants — malformed is not a row anyone decides — but
    // it must be a pinned behaviour and not an accident of statement order.
    const leader: ReviewerIdentity = { role: 'leader', instanceId: 'inst-leader', callerRef: 'instance:inst-leader', rootSessionId: 'team-root-01', isLeaderInstance: true }
    const malformed = { ...leaderCase(), legReviewAuthority: 'officer' } as unknown as ReviewCaseView
    const answer = evaluateReviewAdmission(input({ caller: leader, caseView: malformed }))
    expect(answer).toEqual({ admitted: false, basis: null, refusal: 'REVIEW_CASE_MALFORMED' })
    // And the same Leader on a WELL-FORMED row still gets the role-table answer,
    // unchanged: the delegation lane takes nothing away from the closure.
    const fine = evaluateReviewAdmission(input({ caller: leader, caseView: leaderCase() }))
    expect(fine).toEqual({ admitted: true, basis: 'role-table', refusal: null })
  })
})

describe('a6-pr0 review round 2 / NEW-5 — the refusal vocabulary is closed at runtime, not only in types', () => {
  it('is exactly the published list, in order, with no duplicates and no extras', () => {
    // The type-level closure is real but invisible to a runtime caller: a JS
    // glue layer can hand back any string. The list is the contract PR-I1 logs
    // against, so the list itself is what gets pinned.
    expect(REVIEW_ADMISSION_REFUSALS).toEqual([
      'REVIEW_INPUT_MALFORMED',
      'REVIEW_ROLE_ADMITS_ALREADY',
      'REVIEW_NOT_A_MEMBER_CALLER',
      'REVIEW_PLAN_ABSENT',
      'REVIEW_PLAN_UNBRANDED',
      'REVIEW_CASE_MALFORMED',
      'REVIEW_CALLER_MALFORMED',
      'REVIEW_PLAN_EPOCH_STALE',
      'REVIEW_PLAN_EXPIRED',
      'REVIEW_CLOCK_INVALID',
      'REVIEW_PLAN_TEAM_MISMATCH',
      'REVIEW_PLAN_RUNG_NOT_DELEGABLE',
      'REVIEW_PLAN_REVOKED',
      'REVIEW_IDENTITY_FOREIGN',
      'REVIEW_CALLER_IS_LEADER_INSTANCE',
      'REVIEW_KIND_NOT_DELEGABLE',
      'REVIEW_RUNG_NOT_DELEGABLE',
      'REVIEW_CASE_UNBOUND',
      'REVIEW_LEG_STALE',
      'REVIEW_ALREADY_ACTED_ON_THIS_CASE',
      'REVIEW_SELF_REQUESTER',
      'REVIEW_SELF_BENEFICIARY',
      'REVIEW_SELF_SUBJECT',
      'REVIEW_MANDATE_ABSENT',
      'REVIEW_MANDATE_REVOKED',
      'REVIEW_MANDATE_CASE_MISMATCH',
      'REVIEW_MANDATE_LEG_MISMATCH',
      'REVIEW_MANDATE_EPOCH_MISMATCH',
      'REVIEW_MANDATE_ACTION_NOT_DELEGATED',
      'REVIEW_MANDATE_DECISION_NOT_DELEGATED',
      'REVIEW_MANDATE_SCOPE_NOT_DELEGATED',
      'REVIEW_MANDATE_GENERATION_INVALID',
    ])
    expect(new Set(REVIEW_ADMISSION_REFUSALS).size).toBe(REVIEW_ADMISSION_REFUSALS.length)
  })

  it('every code this module can answer is in the published list', () => {
    // A refusal constructed in code but missing from the list is the drift this
    // leg exists for: the caller's switch statement would meet an unknown code.
    const answers = [
      evaluateReviewAdmission(null as unknown as ReviewAdmissionInput),
      evaluateReviewAdmission(input({ caseView: null as unknown as ReviewCaseView })),
      evaluateReviewAdmission(input({ caller: null as unknown as ReviewerIdentity })),
      evaluateReviewAdmission(input({ caller: { ...officerCaller(), role: 'human-user' as never } })),
      evaluateReviewAdmission(input({ caller: { ...officerCaller(), isLeaderInstance: true } })),
      evaluateReviewAdmission(input({ caller: { ...officerCaller(), role: 'human-user' as never }, caseView: leaderCase({ requestKind: 'envelope-mutation' }) })),
      evaluateReviewAdmission(input({ plan: undefined })),
      evaluateReviewAdmission(input({ plan: { ...parsedPlan() } })),
      evaluateReviewAdmission(input({ planRevoked: true })),
      evaluateReviewAdmission(input({ currentEpoch: 8 })),
      evaluateReviewAdmission(input({ nowIso: '2030-01-01T00:00:00Z', plan: parsedPlanExpiring('2026-10-30T11:00:00Z') })),
      // An unreadable clock only matters when a plan can expire — with no expiry
      // in play the clock is not consulted, so this probe carries a live window.
      evaluateReviewAdmission(input({ nowIso: 'not-an-instant', plan: parsedPlanExpiring('2026-11-30T00:00:00Z') })),
      evaluateReviewAdmission(input({ caller: { ...officerCaller(), instanceId: 'inst-other' } })),
      evaluateReviewAdmission(input({ caller: { ...officerCaller(), instanceId: null } })),
      evaluateReviewAdmission(input({ caseView: leaderCase({ requestKind: 'user-approval' }) })),
      evaluateReviewAdmission(input({ caseView: leaderCase({ legReviewAuthority: 'human-admin' }) })),
      evaluateReviewAdmission(input({ caseView: leaderCase({ approvalCaseId: undefined }) })),
      evaluateReviewAdmission(input({ caseView: leaderCase({ currentLegOrdinal: 2 }) })),
      evaluateReviewAdmission(input({ caseView: leaderCase({ actedCallerRefs: ['instance:inst-officer-1'] }) })),
      evaluateReviewAdmission(input({ caseView: leaderCase({ requesterCallerRef: 'instance:inst-officer-1' }) })),
      evaluateReviewAdmission(input({ mandate: undefined })),
      evaluateReviewAdmission(input({ mandate: { ...grant(), revoked: true } })),
      evaluateReviewAdmission(input({ mandate: { ...grant(), approvalCaseId: 'case-other' } })),
      evaluateReviewAdmission(input({ mandate: { ...grant(), legOrdinal: 2 } })),
      evaluateReviewAdmission(input({ mandate: { ...grant(), planEpoch: 3 } })),
      evaluateReviewAdmission(input({ mandate: { ...grant(), actionName: 'net:fetch' } })),
      evaluateReviewAdmission(input({ attempt: { decision: 'deny', actionName: 'fs:write', effectScopeFingerprint: FINGERPRINT }, mandate: { ...grant(), decisions: ['allow'] } })),
      evaluateReviewAdmission(input({ mandate: { ...grant(), effectScopeFingerprint: 'ff'.repeat(32) } })),
      evaluateReviewAdmission(input({ caseView: leaderCase({ legReviewAuthority: 'officer' as never }) })),
      evaluateReviewAdmission(input({ caller: [] as unknown as ReviewerIdentity })),
    ]
    for (const answer of answers) {
      expect(answer.refusal, `refusal ${String(answer.refusal)} is outside the published vocabulary`).not.toBeNull()
      expect(REVIEW_ADMISSION_REFUSALS as readonly string[]).toContain(answer.refusal ?? '')
    }
  })
})

describe('a6-pr0 review round 2 / NEW-8 — the brand pin is semantic, not just a code mismatch', () => {
  /** A hand-built plan whose scope is the wildcard the parser refuses, matched all the way through. */
  function wildcardEverything(): ReviewAdmissionInput {
    const handBuilt = {
      rootSessionId: 'team-root-01',
      blueprintDigest: DIGEST_64,
      epoch: 7,
      reviewerInstanceId: 'inst-officer-1',
      delegatedRung: 'leader',
      actions: [{ actionName: 'fs:write', decisions: ['allow', 'deny'] }],
      effectScopes: [{ form: 'exact-fingerprint', value: '*' }],
      expiresAtIso: null,
    } as unknown as ReviewPlan
    return input({
      plan: handBuilt,
      attempt: { decision: 'allow', actionName: 'fs:write', effectScopeFingerprint: '*' },
      caseView: leaderCase({ effectScopeFingerprint: '*' }),
      mandate: grant('*'),
    })
  }

  it('the parser will not produce a wildcard scope at all', () => {
    const parsed = parseReviewPlan({
      rootSessionId: 'team-root-01',
      blueprintDigest: DIGEST_64,
      epoch: 7,
      reviewerInstanceId: 'inst-officer-1',
      delegatedRung: 'leader',
      actions: [{ actionName: 'fs:write', decisions: ['allow', 'deny'] }],
      effectScopes: [{ form: 'exact-fingerprint', value: '*' }],
      expiresAtIso: null,
    })
    expect(parsed.ok).toBe(false)
  })

  it('and admission refuses the hand-built one that would otherwise ADMIT a wildcard reviewer', () => {
    // The semantic half of the control. Every other field lines up and the
    // wildcard fingerprint matches the case's, so if the brand check were
    // deleted this input does not merely change refusal codes — it returns
    // `admitted: true`, i.e. a Member authorised over an unbounded effect scope.
    // Round 1's controls could only show a code mismatch; this one can show a
    // widening.
    const answer = evaluateReviewAdmission(wildcardEverything())
    expect(answer.admitted).toBe(false)
    expect(answer.refusal).toBe('REVIEW_PLAN_UNBRANDED')
    // And the shape of the near-miss: with a legitimate plan the same case would
    // have been admitted, proving this input reaches the admit door.
    const legitimate = input({
      attempt: { decision: 'allow', actionName: 'fs:write', effectScopeFingerprint: FINGERPRINT },
      caseView: leaderCase({ effectScopeFingerprint: FINGERPRINT }),
      mandate: grant(FINGERPRINT),
    })
    expect(evaluateReviewAdmission(legitimate).admitted).toBe(true)
    expect(delegationApplicable(wildcardEverything().caseView)).toBe(true)
  })

  it('a branded plan still digests identically after a freeze, so the brand is identity and not metadata', () => {
    const plan = parsedPlan()
    expect(reviewPlanDigest(plan)).toBe(reviewPlanDigest(Object.freeze({ ...plan })))
    expect(reviewPlanDigest(plan)).toMatch(/^[0-9a-f]{64}$/)
  })
})
