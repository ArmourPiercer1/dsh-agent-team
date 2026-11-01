/**
 * Alpha.6 PR0 (Lane 2), review round 1 — the laws the first review PROVED were
 * missing, each pinned by the mutation that used to slip past.
 *
 * WHY THIS FILE EXISTS SEPARATELY. An independent reviewer executed three
 * over-admission / contract breaches against the shipped lane: a hand-built
 * plan object that never met the parser (an unparseable expiry then silently
 * stops expiring, a wildcard effect scope walks in), a routing predicate
 * duplicated from the admission gate and unpinned, and a malformed case view
 * that threw a TypeError inside what will be the one decision write path. Each
 * is now closed in code. A fix without its own negative control is a claim, so
 * every leg here names the input that used to get through.
 */

import { describe, expect, it } from 'vitest'

import {
  evaluateReviewAdmission,
  planCoversEffectScope,
  delegationApplicable,
  isParsedReviewPlan,
  parseReviewPlan,
  type ReviewAdmissionInput,
  type ReviewCaseView,
  type ReviewMandate,
  type ReviewPlan,
  type ReviewerIdentity,
} from '../review-mandate/index.js'

const DIGEST_64 = 'd4e5f6a7b8c90123456789abcdef0123456789abcdef0123456789abcdef0123'
const FINGERPRINT = 'ab12cd34ef560718293a4b5c6d7e8f90'
const CASE_ID = 'case-1f2e3d4c'

function parsedPlan(overrides: Partial<ReviewPlan> = {}): ReviewPlan {
  // OVERRIDES ARE APPLIED TO THE RAW DOCUMENT AND RE-PARSED, never spread onto
  // the parsed object: spreading produces a structurally identical object that
  // never went through the parser, which is precisely the M-1 input. A fixture
  // that spread would silently test the unbranded path in every leg.
  const result = parseReviewPlan({
    rootSessionId: 'team-root-01',
    blueprintDigest: DIGEST_64,
    epoch: 7,
    reviewerInstanceId: 'inst-officer-1',
    delegatedRung: 'leader',
    actions: [{ actionName: 'fs:write', decisions: ['allow', 'deny'] }],
    effectScopes: [{ form: 'exact-fingerprint', value: FINGERPRINT }],
    expiresAtIso: null,
    ...overrides,
  })
  if (!result.ok) throw new Error(`fixture plan refused: ${result.failure.code}`)
  return result.plan
}

/** A structurally identical plan that NEVER went through the parser — the M-1 input. */
function handcraftedPlan(overrides: Record<string, unknown> = {}): ReviewPlan {
  return {
    rootSessionId: 'team-root-01',
    blueprintDigest: DIGEST_64,
    epoch: 7,
    reviewerInstanceId: 'inst-officer-1',
    delegatedRung: 'leader',
    actions: [{ actionName: 'fs:write', decisions: ['allow', 'deny'] }],
    effectScopes: [{ form: 'exact-fingerprint', value: FINGERPRINT }],
    expiresAtIso: null,
    ...overrides,
  } as unknown as ReviewPlan
}

function officerCaller(overrides: Partial<ReviewerIdentity> = {}): ReviewerIdentity {
  return { role: 'member', instanceId: 'inst-officer-1', callerRef: 'instance:inst-officer-1', rootSessionId: 'team-root-01', isLeaderInstance: false, ...overrides }
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
  return { approvalCaseId: CASE_ID, legOrdinal: 1, reviewerInstanceId: 'inst-officer-1', planEpoch: 7, actionName: 'fs:write', decisions: ['allow', 'deny'], effectScopeFingerprint: FINGERPRINT, revoked: false, generation: 1, ...overrides }
}

function input(overrides: Partial<ReviewAdmissionInput> = {}): ReviewAdmissionInput {
  return { caller: officerCaller(), attempt: { decision: 'allow', actionName: 'fs:write', effectScopeFingerprint: FINGERPRINT }, caseView: leaderCase(), plan: parsedPlan(), mandate: grant(), currentEpoch: 7, nowIso: '2026-10-30T12:00:00Z', planRevoked: false, ...overrides }
}

describe('a6-pr0 review round 1 / M-1 — only a parser-produced plan is a plan', () => {
  it('the brand is carried by parser output and by nothing that merely looks like it', () => {
    const parsed = parsedPlan()
    expect(isParsedReviewPlan(parsed)).toBe(true)
    // Structurally identical, field-for-field: structure cannot carry this fact.
    expect(isParsedReviewPlan({ ...parsed })).toBe(false)
    expect(isParsedReviewPlan(handcraftedPlan())).toBe(false)
  })

  it('refuses an unbranded plan that satisfies every field check', () => {
    const answer = evaluateReviewAdmission(input({ plan: handcraftedPlan() }))
    expect(answer).toEqual({ admitted: false, basis: null, refusal: 'REVIEW_PLAN_UNBRANDED' })
  })

  it('refuses the exact hand-built plan whose expiry the parser would never accept', () => {
    // Pre-fix behaviour: `now > Date.parse('expired-yesterday-probably')` is
    // `now > NaN` = false, so the expiry law stopped firing and the reviewer
    // was ADMITTED. parseReviewPlan refuses this string with BAD_TIMESTAMP —
    // the point of the brand is that the admission door cannot be softer than
    // the parser.
    expect(parseReviewPlan({ ...handcraftedPlan(), expiresAtIso: 'expired-yesterday-probably' }).ok).toBe(false)
    const answer = evaluateReviewAdmission(input({ plan: handcraftedPlan({ expiresAtIso: 'expired-yesterday-probably' }) }))
    expect(answer.admitted).toBe(false)
    expect(answer.refusal).toBe('REVIEW_PLAN_UNBRANDED')
  })

  it('refuses the exact hand-built wildcard scope the parser refuses', () => {
    const wildcard = handcraftedPlan({ effectScopes: [{ form: 'exact-fingerprint', value: '*' }] })
    expect(parseReviewPlan({ ...handcraftedPlan(), effectScopes: [{ form: 'exact-fingerprint', value: '*' }] }).ok).toBe(false)
    const answer = evaluateReviewAdmission(input({ plan: wildcard }))
    expect(answer.admitted).toBe(false)
    expect(answer.refusal).toBe('REVIEW_PLAN_UNBRANDED')
  })

  it('refuses an unreadable expiry even on a branded plan (no silent no-expiry)', () => {
    const parsed = parsedPlan()
    // Reachable only by mutating a parsed plan's field in place (the plan is
    // frozen, so in practice by a future refactor that drops the freeze); the
    // guard is here so the comparison can never degrade to `false`.
    const tampered = { ...parsed, expiresAtIso: 'not-an-instant' } as ReviewPlan
    const answer = evaluateReviewAdmission(input({ plan: tampered }))
    expect(answer.admitted).toBe(false)
    expect(answer.refusal).toBe('REVIEW_PLAN_UNBRANDED')
  })
})

describe('a6-pr0 review round 1 / M-2 — routing predicate and admission are one rule', () => {
  const ROUTING_REFUSALS = ['REVIEW_KIND_NOT_DELEGABLE', 'REVIEW_RUNG_NOT_DELEGABLE', 'REVIEW_CASE_UNBOUND'] as const

  const shapes: Array<[string, ReviewCaseView]> = [
    ['a delegable leader-rung case', leaderCase()],
    ['a leg-less row', leaderCase({ approvalCaseId: undefined })],
    ['a whitespace case id', leaderCase({ approvalCaseId: '   ' })],
    ['an empty case id', leaderCase({ approvalCaseId: '' })],
    ['a user-approval case', leaderCase({ requestKind: 'user-approval' })],
    ['an envelope-mutation case', leaderCase({ requestKind: 'envelope-mutation' })],
    ['a human-user rung leg', leaderCase({ legReviewAuthority: 'human-user' })],
    ['a human-admin rung leg', leaderCase({ legReviewAuthority: 'human-admin' })],
    ['a member rung leg', leaderCase({ legReviewAuthority: 'member' })],
  ]

  it('the two predicates agree on every shape the row vocabulary can take', () => {
    for (const [label, view] of shapes) {
      const answer = evaluateReviewAdmission(input({ caseView: view }))
      const applicable = delegationApplicable(view)
      if (applicable) {
        expect(answer.admitted, `${label}: a delegable shape must reach the grant check`).toBe(true)
        expect(ROUTING_REFUSALS).not.toContain(answer.refusal ?? '')
      } else {
        expect(ROUTING_REFUSALS, `${label}: a non-delegable shape must refuse with a routing code, got ${String(answer.refusal)}`).toContain(answer.refusal ?? '')
      }
    }
  })

  it('the two shapes the first review found unpinned stay non-delegable', () => {
    // Widening ONLY the routing predicate used to leave all 84 original legs
    // green while sending envelope-mutation cases to a reviewer the center will
    // always refuse.
    expect(delegationApplicable(leaderCase({ requestKind: 'envelope-mutation' }))).toBe(false)
    expect(delegationApplicable(leaderCase({ legReviewAuthority: 'member' }))).toBe(false)
  })

  it('whitespace is not a case id (L-2)', () => {
    const answer = evaluateReviewAdmission(input({ caseView: leaderCase({ approvalCaseId: '   ' }) }))
    expect(answer.refusal).toBe('REVIEW_CASE_UNBOUND')
  })
})

describe('a6-pr0 review round 1 / M-3 — malformed input is a closed code, never an exception', () => {
  it('answers a requestKind outside the vocabulary with a code instead of throwing', () => {
    const view = { ...leaderCase(), requestKind: 'banana' } as unknown as ReviewCaseView
    let answer = null as ReturnType<typeof evaluateReviewAdmission> | null
    expect(() => {
      answer = evaluateReviewAdmission(input({ caseView: view }))
    }).not.toThrow()
    expect(answer).toEqual({ admitted: false, basis: null, refusal: 'REVIEW_CASE_MALFORMED' })
  })

  it.each<[string, Partial<ReviewCaseView>]>([
    ['a rung outside the ladder', { legReviewAuthority: 'officer' as never }],
    ['a non-integer leg ordinal', { legOrdinal: 1.5 }],
    ['an already-acted list that is not an array', { actedCallerRefs: 'instance:inst-officer-1' as never }],
    ['an already-acted list holding a non-string', { actedCallerRefs: [42 as never] }],
    ['an empty requester ref', { requesterCallerRef: '' }],
    ['an empty action name', { actionName: '' }],
    ['an empty effect-set fingerprint', { effectScopeFingerprint: '' }],
  ])('refuses %s with REVIEW_CASE_MALFORMED', (_label, override) => {
    const view = { ...leaderCase(), ...override } as ReviewCaseView
    expect(() => evaluateReviewAdmission(input({ caseView: view }))).not.toThrow()
    expect(evaluateReviewAdmission(input({ caseView: view })).refusal).toBe('REVIEW_CASE_MALFORMED')
  })

  it('refuses a caller identity outside its vocabulary with its own code', () => {
    const caller = { ...officerCaller(), role: 'officer' } as unknown as ReviewerIdentity
    expect(evaluateReviewAdmission(input({ caller })).refusal).toBe('REVIEW_CALLER_MALFORMED')
  })

  it('a malformed row is refused even for a Leader — malformed never becomes "the old path"', () => {
    const view = { ...leaderCase(), requestKind: 'banana' } as unknown as ReviewCaseView
    const leader = officerCaller({ role: 'leader', instanceId: 'inst-leader', callerRef: 'instance:inst-leader', isLeaderInstance: true })
    const answer = evaluateReviewAdmission(input({ caller: leader, caseView: view }))
    expect(answer.admitted).toBe(false)
    expect(answer.refusal).toBe('REVIEW_CASE_MALFORMED')
  })

  it('the action-scope guard is pinned here because admission cannot reach it', () => {
    // A reviewer noted the action-name guard inside `planCoversEffectScope` was
    // mutation-visible only in the plan spec. That is structural, not a gap:
    // an action the plan does not list is refused earlier by ACTION_NOT_DELEGATED,
    // so no admission input can observe the guard. This leg is therefore the
    // direct pin — deleting the guard turns THIS leg red as well as the plan spec.
    const plan = parsedPlan()
    expect(planCoversEffectScope(plan, 'fs:write', FINGERPRINT)).toBe(true)
    expect(planCoversEffectScope(plan, 'net:fetch', FINGERPRINT)).toBe(false)
  })

  it('refuses a caller wearing Member clothing and the Leader flag', () => {
    // The guard used to be named as if it read the plan and was pinned by a leg
    // that no longer reaches it. Named for what it tests and pinned here.
    const answer = evaluateReviewAdmission(input({ caller: officerCaller({ isLeaderInstance: true }) }))
    expect(answer.admitted).toBe(false)
    expect(answer.refusal).toBe('REVIEW_CALLER_IS_LEADER_INSTANCE')
  })

  it('the role-table answer handed to every admitted caller is frozen', () => {
    const answer = evaluateReviewAdmission(input({ caller: officerCaller({ role: 'leader', instanceId: 'inst-leader', callerRef: 'instance:inst-leader', isLeaderInstance: true }) }))
    expect(Object.isFrozen(answer)).toBe(true)
  })
})
