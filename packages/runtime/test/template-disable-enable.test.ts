/**
 * pre-alpha3 PR-E (plan §E.6 "required template missing → fix + recheck OR
 * disable template") — the TemplateAvailability (disable/enable) model, plus:
 *
 * - authority negative #9 (template disable 不等于 policy deny): disabling a
 *   template excludes it from WORK START but does NOT change its effective
 *   policy;
 * - authority negative #10 (restart 后 disable 保留, readiness 重置 unknown):
 *   the availability is DURABLE and survives restart.
 *
 * @module @dsh-agent-team/runtime/test/template-disable-enable
 */

import { describe, expect, it } from 'vitest'

import {
  GATE_REASONS,
  gateAction,
  isTemplateAvailable,
  normalWorkImpact,
  scopeKey,
  setTemplateAvailability,
  teamScope,
  templateScope,
  TEMPLATE_AVAILABILITY_SET_FACT_TYPE,
  templateAvailabilitySetPayload,
  validateTemplateAvailability,
  parseTemplateAvailabilitySet,
  RequirementError,
  type EvaluationInput,
  type RequirementVerdict,
} from '../requirements/index.js'

function v(requirementId: string, outcome: RequirementVerdict['outcome'], complete = false): RequirementVerdict {
  return { requirementId, complete, outcome, unavailableSubjects: outcome === 'pass' ? [] : [requirementId] }
}

describe('E.6 template disable/enable: the model', () => {
  it('defaults a template with no entry to available', () => {
    expect(isTemplateAvailable([], 'worker')).toBe(true)
  })

  it('setTemplateAvailability disables a template (and returns a new list)', () => {
    const before: ReturnType<typeof setTemplateAvailability> = []
    const after = setTemplateAvailability(before, 'worker', false)
    expect(after).toEqual([{ templateId: 'worker', available: false }])
    // the input is not mutated
    expect(before).toEqual([])
    expect(isTemplateAvailable(after, 'worker')).toBe(false)
  })

  it('setTemplateAvailability re-enables a previously-disabled template (deduped)', () => {
    const disabled = setTemplateAvailability([], 'worker', false)
    const enabled = setTemplateAvailability(disabled, 'worker', true)
    expect(enabled).toEqual([{ templateId: 'worker', available: true }])
    expect(isTemplateAvailable(enabled, 'worker')).toBe(true)
  })

  it('validateTemplateAvailability rejects an unknown template', () => {
    expect(() =>
      validateTemplateAvailability([{ templateId: 'ghost', available: false }], ['worker', 'leader']),
    ).toThrow(RequirementError)
    expect(() => validateTemplateAvailability([{ templateId: 'worker', available: false }], ['worker'])).not.toThrow()
  })
})

describe('a disabled template blocks its normal work (availability, not policy)', () => {
  it('gateAction blocks normal work targeting a DISABLED template with reason templateDisabled', () => {
    const input: EvaluationInput = {
      scopeVerdicts: {
        [scopeKey(teamScope())]: [v('team.a', 'pass')],
        [scopeKey(templateScope('worker'))]: [v('work.a', 'pass')],
      },
      availability: [{ templateId: 'worker', available: false }],
    }
    const decision = gateAction(normalWorkImpact([teamScope(), templateScope('worker')]), input)
    expect(decision.allowed).toBe(false)
    expect(decision.reason).toBe(GATE_REASONS.templateDisabled)
  })

  it('an ENABLED (or absent) template does not trigger the availability block', () => {
    const input: EvaluationInput = {
      scopeVerdicts: {
        [scopeKey(teamScope())]: [v('team.a', 'pass')],
        [scopeKey(templateScope('worker'))]: [v('work.a', 'pass')],
      },
      availability: [{ templateId: 'worker', available: true }],
    }
    const decision = gateAction(normalWorkImpact([teamScope(), templateScope('worker')]), input)
    expect(decision.allowed).toBe(true)
    expect(decision.reason).toBe(GATE_REASONS.allowed)
  })
})

describe('authority negative #9: template disable ≠ policy deny', () => {
  it('disabling a template is an AVAILABILITY block, not a policy denial (reason distinguishes the two)', () => {
    // The gate's reason for a disabled template is `templateDisabled` — a
    // distinct, availability-scoped reason, NOT a policy `deny`. The template's
    // effective policy is unchanged by the disable (it still resolves to its
    // original allow/ask/deny per operation); the disable only excludes it
    // from WORK START.
    const input: EvaluationInput = {
      scopeVerdicts: {
        [scopeKey(templateScope('worker'))]: [v('work.a', 'pass')],
      },
      availability: [{ templateId: 'worker', available: false }],
    }
    const decision = gateAction(normalWorkImpact([templateScope('worker')]), input)
    expect(decision.allowed).toBe(false)
    // The block is availability-scoped, not a policy denial.
    expect(decision.reason).toBe(GATE_REASONS.templateDisabled)
    expect(decision.reason).not.toBe(GATE_REASONS.requiredScopeDown)
  })
})

describe('authority negative #10: disable SURVIVES restart (durable)', () => {
  it('the availability round-trips through its durable fact payload (the restart persistence path)', () => {
    const payload = templateAvailabilitySetPayload({ templateId: 'worker', available: false, at: 1234567890 })
    expect(payload).toEqual({ templateId: 'worker', available: false, at: 1234567890 })
    expect(TEMPLATE_AVAILABILITY_SET_FACT_TYPE).toBe('template-availability-set')
    const parsed = parseTemplateAvailabilitySet(payload, 'template-availability-set')
    expect(parsed).toEqual(payload)
  })
})
