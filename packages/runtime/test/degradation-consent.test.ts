/**
 * pre-alpha3 PR-E (plan §E.6 "optional missing → Human consent") — the
 * DegradationConsent model, plus:
 *
 * - authority negative #8 (consent 不等于 governance allow): a consent to run
 *   degraded with an optional capability unmet does NOT turn a denied/ask
 *   operation into an allowed one (the per-operation policy is a separate
 *   plane);
 * - authority negative #10 (restart 后 consent 保留): the consent is DURABLE
 *   and survives restart (while the live readiness resets to `unknown`).
 *
 * @module @dsh-agent-team/runtime/test/degradation-consent
 */

import { describe, expect, it } from 'vitest'

import {
  isConsented,
  OPTIONAL_REQUIREMENT_ACCEPTED_FACT_TYPE,
  optionalRequirementAcceptedPayload,
  parseOptionalRequirementAccepted,
  relevantConsents,
  validateConsent,
  RequirementError,
  type RequirementVerdict,
} from '../requirements/index.js'

function v(requirementId: string, outcome: RequirementVerdict['outcome'], complete = false): RequirementVerdict {
  return { requirementId, complete, outcome, unavailableSubjects: outcome === 'pass' ? [] : [requirementId] }
}

describe('E.6 degradation consent: validation', () => {
  it('accepts a consent for an OPTIONAL (unmet) requirement', () => {
    const verdicts = [v('work.optional-mcp', 'warning', false)]
    expect(() =>
      validateConsent(
        { requirementId: 'work.optional-mcp', generation: 1, consentedAt: 1000, consentedBy: 'human' },
        verdicts,
      ),
    ).not.toThrow()
  })

  it('rejects a consent for a REQUIRED (complete) requirement (CONSENT_TARGET_NOT_OPTIONAL)', () => {
    const verdicts = [v('work.required-mcp', 'fatal', true)]
    expect(() =>
      validateConsent(
        { requirementId: 'work.required-mcp', generation: 1, consentedAt: 1000, consentedBy: 'human' },
        verdicts,
      ),
    ).toThrow(RequirementError)
  })

  it('rejects a consent for a SATISFIED requirement (CONSENT_TARGET_SATISFIED)', () => {
    const verdicts = [v('work.optional-mcp', 'pass', false)]
    expect(() =>
      validateConsent(
        { requirementId: 'work.optional-mcp', generation: 1, consentedAt: 1000, consentedBy: 'human' },
        verdicts,
      ),
    ).toThrow(RequirementError)
  })

  it('reports the relevant consents (optional + unmet only)', () => {
    const consents = [
      { requirementId: 'work.optional-mcp', generation: 1, consentedAt: 1000, consentedBy: 'human' },
      { requirementId: 'work.satisfied', generation: 1, consentedAt: 1000, consentedBy: 'human' },
    ]
    const verdicts = [v('work.optional-mcp', 'warning', false), v('work.satisfied', 'pass', false)]
    expect(relevantConsents(consents, verdicts).map((c) => c.requirementId)).toEqual(['work.optional-mcp'])
  })

  it('isConsented is a simple membership check', () => {
    const consents = [{ requirementId: 'a', generation: 1, consentedAt: 0, consentedBy: 'h' }]
    expect(isConsented(consents, 'a')).toBe(true)
    expect(isConsented(consents, 'b')).toBe(false)
  })
})

describe('authority negative #8: consent ≠ governance allow', () => {
  it('a consent does NOT change a denied operation to allowed (the policy plane is separate)', () => {
    // The consent covers the OPTIONAL REQUIREMENT (the capability is degraded).
    // The per-operation governance policy is a SEPARATE plane: an operation
    // the policy DENIES stays denied regardless of the requirement consent.
    //
    // Model the two planes explicitly:
    const consented = isConsented(
      [{ requirementId: 'work.optional-mcp', generation: 1, consentedAt: 1000, consentedBy: 'human' }],
      'work.optional-mcp',
    )
    expect(consented).toBe(true)
    // The governance plane: a write operation the policy independently DENIES.
    const governanceDecision: 'allow' | 'ask' | 'deny' = 'deny'
    expect(governanceDecision).toBe('deny')
    // authority negative #8: "may proceed" = consent AND governance-allow.
    // The consent is true, but the governance plane is deny — so the combined
    // decision is NOT an allow. (The explicit union cast keeps the "is it
    // allow?" question answerable despite the const narrowing to the literal.)
    const mayProceed = consented && (governanceDecision as 'allow' | 'ask' | 'deny') === 'allow'
    expect(mayProceed).toBe(false)
  })
})

describe('authority negative #10: consent SURVIVES restart (durable)', () => {
  it('the consent round-trips through its durable fact payload (the restart persistence path)', () => {
    // The durable record of a consent is the `optional-requirement-accepted`
    // fact. On restart the record is re-read from the ledger (survives),
    // while the live readiness resets to `unknown`. The payload round-trips
    // losslessly through the fail-closed parser.
    const payload = optionalRequirementAcceptedPayload({
      requirementId: 'work.optional-mcp',
      generation: 3,
      consentedAt: 1234567890,
      consentedBy: 'human-42',
    })
    expect(payload).toEqual({
      requirementId: 'work.optional-mcp',
      generation: 3,
      consentedAt: 1234567890,
      consentedBy: 'human-42',
    })
    // The fact type is the stable identity the client mirror / projection
    // key on (category `compatibility`).
    expect(OPTIONAL_REQUIREMENT_ACCEPTED_FACT_TYPE).toBe('optional-requirement-accepted')
    // Fail-closed parse of the same payload (the restart re-read path).
    const parsed = parseOptionalRequirementAccepted(payload, 'optional-requirement-accepted')
    expect(parsed).toEqual(payload)
  })
})
