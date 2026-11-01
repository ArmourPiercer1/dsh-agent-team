/**
 * Alpha.6 PR0 (Lane 2) — the trusted ReviewPlan parser: what it accepts, and
 * the closed list of things it must NEVER accept.
 *
 * The parser is the boundary where delegated authority gets its shape
 * (review-mandate/plan.ts L-3), so the negative legs are the substance of this
 * file: a plan that parses too generously makes every later check irrelevant.
 * Positive legs exist only to prove the negatives are refusals and not a
 * parser that accepts nothing.
 *
 * DORMANT LANE, declared: nothing in production imports this yet
 * (execution-plan G-5); these tests are the lane's whole runtime today.
 */

import { describe, expect, it } from 'vitest'

import { parseReviewPlan, planActionScope, planCoversEffectScope, reviewPlanDigest } from '../review-mandate/index.js'
import type { ReviewPlanFailureCode } from '../review-mandate/index.js'

const DIGEST_64 = 'd4e5f6a7b8c90123456789abcdef0123456789abcdef0123456789abcdef0123'
const FINGERPRINT = 'ab12cd34ef560718293a4b5c6d7e8f90'

function legalPlan(): Record<string, unknown> {
  return {
    rootSessionId: 'team-root-01',
    blueprintDigest: DIGEST_64,
    epoch: 7,
    reviewerInstanceId: 'inst-officer-1',
    delegatedRung: 'leader',
    actions: [{ actionName: 'fs:write', decisions: ['allow', 'deny'] }],
    effectScopes: [{ form: 'exact-fingerprint', value: FINGERPRINT }],
    expiresAtIso: null,
  }
}

function failureOf(raw: unknown): ReviewPlanFailureCode {
  const result = parseReviewPlan(raw)
  if (result.ok) throw new Error('expected a refusal, got a plan')
  return result.failure.code
}

describe('a6-pr0 review plan: the legal shape', () => {
  it('accepts a legal plan and freezes it', () => {
    const result = parseReviewPlan(legalPlan())
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.plan.reviewerInstanceId).toBe('inst-officer-1')
    expect(result.plan.actions[0]?.decisions).toEqual(['allow', 'deny'])
    expect(Object.isFrozen(result.plan)).toBe(true)
    expect(Object.isFrozen(result.plan.actions)).toBe(true)
    expect(() => {
      // A parsed plan is the authority input; a later mutation would be a
      // silent widening, so the object graph is frozen, not just typed.
      ;(result.plan as { epoch: number }).epoch = 999
    }).toThrow(TypeError)
  })

  it('binds a content digest that is stable and content-sensitive', () => {
    const first = parseReviewPlan(legalPlan())
    const second = parseReviewPlan(legalPlan())
    const widened = parseReviewPlan({
      ...legalPlan(),
      effectScopes: [{ form: 'by-action-name', value: 'fs:write' }],
    })
    expect(first.ok && second.ok && widened.ok).toBe(true)
    if (!first.ok || !second.ok || !widened.ok) return
    expect(reviewPlanDigest(first.plan)).toMatch(/^[0-9a-f]{64}$/)
    expect(reviewPlanDigest(first.plan)).toBe(reviewPlanDigest(second.plan))
    expect(reviewPlanDigest(widened.plan)).not.toBe(reviewPlanDigest(first.plan))
  })

  it('answers the two coverage questions the admission check asks', () => {
    const result = parseReviewPlan(legalPlan())
    if (!result.ok) throw new Error('legal plan refused')
    expect(planActionScope(result.plan, 'fs:write')?.decisions).toContain('allow')
    expect(planActionScope(result.plan, 'fs:read')).toBeUndefined()
    expect(planCoversEffectScope(result.plan, 'fs:write', FINGERPRINT)).toBe(true)
    // A fingerprint is exact: one hex digit off is a different effect set.
    expect(planCoversEffectScope(result.plan, 'fs:write', '0f9e8d7c6b5a43210fedcba987654321')).toBe(false)
    // Listing an action is not the same as covering its effect set.
    expect(planCoversEffectScope(result.plan, 'fs:read', FINGERPRINT)).toBe(false)
  })

  it('accepts an explicit future expiry', () => {
    const result = parseReviewPlan({ ...legalPlan(), expiresAtIso: '2026-11-01T00:00:00Z' })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.plan.expiresAtIso).toBe('2026-11-01T00:00:00Z')
  })

  it('accepts a by-action-name scope that names a listed action', () => {
    const result = parseReviewPlan({
      ...legalPlan(),
      effectScopes: [{ form: 'by-action-name', value: 'fs:write' }],
    })
    expect(result.ok).toBe(true)
  })
})

describe('a6-pr0 review plan: closed-world refusals', () => {
  it.each<[string, () => unknown, ReviewPlanFailureCode]>([
    ['a non-object document', () => 'review-plan', 'PLAN_NOT_OBJECT'],
    ['an array document', () => [legalPlan()], 'PLAN_NOT_OBJECT'],
    ['an unlisted top-level key', () => ({ ...legalPlan(), autoApprove: true }), 'UNKNOWN_FIELD'],
    ['an unlisted key inside an action', () => ({
      ...legalPlan(),
      actions: [{ actionName: 'fs:write', decisions: ['allow'], wildcard: true }],
    }), 'UNKNOWN_FIELD'],
    ['a missing field', () => {
      const raw = legalPlan()
      delete raw.epoch
      return raw
    }, 'MISSING_FIELD'],
    ['a non-hex blueprint digest', () => ({ ...legalPlan(), blueprintDigest: 'not-a-digest' }), 'BAD_DIGEST'],
    ['an uppercase blueprint digest', () => ({ ...legalPlan(), blueprintDigest: DIGEST_64.toUpperCase() }), 'BAD_DIGEST'],
    ['a zero epoch', () => ({ ...legalPlan(), epoch: 0 }), 'BAD_VALUE'],
    ['a non-integer epoch', () => ({ ...legalPlan(), epoch: 1.5 }), 'BAD_VALUE'],
    ['an instance id that names the Leader', () => ({ ...legalPlan(), reviewerInstanceId: 'inst-leader' }), 'REVIEWER_IS_LEADER_INSTANCE'],
    ['a member rung as the delegated rung', () => ({ ...legalPlan(), delegatedRung: 'member' }), 'RUNG_NOT_DELEGABLE'],
    ['a human-user rung as the delegated rung', () => ({ ...legalPlan(), delegatedRung: 'human-user' }), 'RUNG_NOT_DELEGABLE'],
    ['a human-admin rung as the delegated rung', () => ({ ...legalPlan(), delegatedRung: 'human-admin' }), 'RUNG_NOT_DELEGABLE'],
    ['an unknown delegated rung', () => ({ ...legalPlan(), delegatedRung: 'officer' }), 'BAD_VALUE'],
    ['no delegated action', () => ({ ...legalPlan(), actions: [] }), 'EMPTY_LIST'],
    ['no delegated effect scope', () => ({ ...legalPlan(), effectScopes: [] }), 'EMPTY_LIST'],
    ['an action delegating no decision value', () => ({ ...legalPlan(), actions: [{ actionName: 'fs:write', decisions: [] }] }), 'EMPTY_LIST'],
    ['a duplicate action', () => ({
      ...legalPlan(),
      actions: [
        { actionName: 'fs:write', decisions: ['allow'] },
        { actionName: 'fs:write', decisions: ['deny'] },
      ],
    }), 'DUPLICATE_ACTION'],
    ['an unknown decision value', () => ({ ...legalPlan(), actions: [{ actionName: 'fs:write', decisions: ['escalate'] }] }), 'BAD_VALUE'],
    ['a wildcard effect scope', () => ({ ...legalPlan(), effectScopes: [{ form: 'wildcard', value: '*' }] }), 'SCOPE_FORM_UNKNOWN'],
    ['a prefix fingerprint', () => ({ ...legalPlan(), effectScopes: [{ form: 'exact-fingerprint', value: 'ab12cd*' }] }), 'BAD_VALUE'],
    ['a by-action-name scope for an unlisted action', () => ({ ...legalPlan(), effectScopes: [{ form: 'by-action-name', value: 'net:fetch' }] }), 'SCOPE_NAMES_UNLISTED_ACTION'],
    ['an expiry that is not a timestamp', () => ({ ...legalPlan(), expiresAtIso: 'tomorrow' }), 'BAD_TIMESTAMP'],
    ['an expiry with no timezone offset', () => ({ ...legalPlan(), expiresAtIso: '2026-11-01T00:00:00' }), 'BAD_TIMESTAMP'],
    ['an expiry that is a number, not an instant', () => ({ ...legalPlan(), expiresAtIso: 1793520000 }), 'BAD_TIMESTAMP'],
    ['an action name carrying a glob', () => ({ ...legalPlan(), actions: [{ actionName: 'fs:*', decisions: ['allow'] }] }), 'BAD_ID'],
    ['an empty-string team id', () => ({ ...legalPlan(), rootSessionId: '' }), 'BAD_ID'],
  ])('refuses %s', (_label, build, code) => {
    expect(failureOf(build())).toBe(code)
  })

  it('names the field it refused, so an operator can fix config without guessing', () => {
    const result = parseReviewPlan({ ...legalPlan(), delegatedRung: 'human-user' })
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.failure.field).toBe('delegatedRung')
    expect(result.failure.detail.length).toBeGreaterThan(10)
  })

  it('refuses rather than defaulting: a plan missing expiresAtIso is not "no expiry"', () => {
    // The field set is closed and every field is required. `expiresAtEpoch:
    // null` is the explicit "no expiry" statement; dropping the key is a
    // malformed document, because a silently-defaulted field is how a scope
    // outlives its epoch.
    const raw = legalPlan()
    delete raw.expiresAtIso
    expect(failureOf(raw)).toBe('MISSING_FIELD')
  })
})
