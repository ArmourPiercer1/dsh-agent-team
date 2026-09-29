/**
 * pre-alpha3 PR-E (plan §E.6) — E.11 suite `startup-required-team-fatal`:
 * a TEAM-LEVEL required requirement that is unmet makes the startup
 * preflight FATAL — it CANNOT be bypassed by disabling a template or by a
 * consent (the Team itself cannot run; the authority negative: "Team-level
 * required missing 不允许通过 disable 某 template 绕过"). This is the
 * priority-1 outcome, above fixOrDisable and consentRequired.
 *
 * @module @dsh-agent-team/runtime/test/startup-required-team-fatal
 */

import { describe, expect, it } from 'vitest'

import {
  PREFLIGHT_OUTCOMES,
  startupPreflight,
  teamScope,
  templateScope,
  scopeKey,
  type EvaluationInput,
  type RequirementVerdict,
} from '../requirements/index.js'

function v(requirementId: string, outcome: RequirementVerdict['outcome'], complete = false): RequirementVerdict {
  return {
    requirementId,
    complete,
    outcome,
    unavailableSubjects: outcome === 'pass' ? [] : [requirementId],
  }
}

describe('E.11 startup-required-team-fatal: Team-level required down is FATAL', () => {
  it('is fatal when a TEAM-level required requirement is unmet', () => {
    const input: EvaluationInput = {
      scopeVerdicts: {
        [scopeKey(teamScope())]: [v('team.required', 'fatal', true)],
      },
    }
    const result = startupPreflight(input)
    expect(result.outcome).toBe(PREFLIGHT_OUTCOMES.fatal)
    expect(result.fatalRequirementIds).toEqual(['team.required'])
    expect(result.fixOrDisableRequirementIds).toEqual([])
    expect(result.consentRequiredRequirementIds).toEqual([])
  })

  it('cannot be bypassed by DISABLING the templates that are also down (the authority negative)', () => {
    // The team scope is blocked AND a template scope is also blocked +
    // disabled — the Team-level FATAL still wins (disable is a template
    // resolution, never a team-level resolution).
    const input: EvaluationInput = {
      scopeVerdicts: {
        [scopeKey(teamScope())]: [v('team.required', 'fatal', true)],
        [scopeKey(templateScope('worker'))]: [v('work.required', 'fatal', true)],
      },
      availability: [{ templateId: 'worker', available: false }],
    }
    const result = startupPreflight(input)
    expect(result.outcome).toBe(PREFLIGHT_OUTCOMES.fatal)
    expect(result.fatalRequirementIds).toEqual(['team.required'])
  })

  it('cannot be bypassed by a CONSENT (consent resolves optional warnings, never a team-level fatal)', () => {
    const input: EvaluationInput = {
      scopeVerdicts: {
        [scopeKey(teamScope())]: [v('team.required', 'fatal', true), v('team.optional', 'warning', false)],
      },
      consents: [{ requirementId: 'team.optional', generation: 1, consentedAt: 1000, consentedBy: 'human' }],
    }
    const result = startupPreflight(input)
    expect(result.outcome).toBe(PREFLIGHT_OUTCOMES.fatal)
    expect(result.fatalRequirementIds).toEqual(['team.required'])
  })

  it('is NOT fatal when the team scope is ready (even if a template is down) — the fixOrDisable lane', () => {
    // Team ready + a required template down (not disabled) → fixOrDisable
    // (NOT fatal): the Team itself can run, only the template needs a
    // fix-or-disable decision.
    const input: EvaluationInput = {
      scopeVerdicts: {
        [scopeKey(teamScope())]: [v('team.required', 'pass')],
        [scopeKey(templateScope('worker'))]: [v('work.required', 'fatal', true)],
      },
    }
    const result = startupPreflight(input)
    expect(result.outcome).toBe(PREFLIGHT_OUTCOMES.fixOrDisable)
  })
})
