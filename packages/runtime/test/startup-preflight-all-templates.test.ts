/**
 * pre-alpha3 PR-E (plan §E.6) — startup preflight: evaluate ALL Team +
 * Leader + MemberTemplate requirements before Team creation and classify the
 * outcome (proceed / consentRequired / fixOrDisable / fatal).
 *
 * @module @dsh-agent-team/runtime/test/startup-preflight-all-templates
 */

import { describe, expect, it } from 'vitest'

import {
  PREFLIGHT_OUTCOMES,
  scopeKey,
  startupPreflight,
  teamScope,
  templateScope,
  type EvaluationInput,
  type RequirementVerdict,
} from '../requirements/index.js'

/** Build a verdict quickly. */
function v(requirementId: string, outcome: RequirementVerdict['outcome'], complete = false): RequirementVerdict {
  return {
    requirementId,
    complete,
    outcome,
    unavailableSubjects: outcome === 'pass' ? [] : [requirementId],
  }
}

/** A fully-satisfied scope set (team + two templates, all PASS). */
function allReady(): EvaluationInput {
  return {
    scopeVerdicts: {
      [scopeKey(teamScope())]: [v('team.a', 'pass')],
      [scopeKey(templateScope('leader'))]: [v('lead.a', 'pass')],
      [scopeKey(templateScope('worker'))]: [v('work.a', 'pass')],
    },
  }
}

describe('E.6 startup preflight: proceed', () => {
  it('proceeds when every requirement (team + all templates) is satisfied', () => {
    const result = startupPreflight(allReady())
    expect(result.outcome).toBe(PREFLIGHT_OUTCOMES.proceed)
    expect(result.fatalRequirementIds).toEqual([])
    expect(result.fixOrDisableRequirementIds).toEqual([])
    expect(result.consentRequiredRequirementIds).toEqual([])
  })
})

describe('E.6 startup preflight: consentRequired (optional missing)', () => {
  it('requires consent when an OPTIONAL requirement is unmet and unconsented', () => {
    const input: EvaluationInput = {
      scopeVerdicts: {
        [scopeKey(teamScope())]: [v('team.a', 'pass')],
        [scopeKey(templateScope('worker'))]: [v('work.optional-mcp', 'warning', false)],
      },
    }
    const result = startupPreflight(input)
    expect(result.outcome).toBe(PREFLIGHT_OUTCOMES.consentRequired)
    expect(result.consentRequiredRequirementIds).toEqual(['work.optional-mcp'])
  })

  it('proceeds when the unmet OPTIONAL requirement is consented', () => {
    const input: EvaluationInput = {
      scopeVerdicts: {
        [scopeKey(templateScope('worker'))]: [v('work.optional-mcp', 'warning', false)],
      },
      consents: [
        {
          requirementId: 'work.optional-mcp',
          generation: 1,
          consentedAt: 1000,
          consentedBy: 'human',
        },
      ],
    }
    const result = startupPreflight(input)
    expect(result.outcome).toBe(PREFLIGHT_OUTCOMES.proceed)
  })
})

describe('E.6 startup preflight: fixOrDisable (required template missing)', () => {
  it('asks fix-or-disable when a REQUIRED template requirement is unmet', () => {
    const input: EvaluationInput = {
      scopeVerdicts: {
        [scopeKey(templateScope('worker'))]: [v('work.required-mcp', 'fatal', true)],
      },
    }
    const result = startupPreflight(input)
    expect(result.outcome).toBe(PREFLIGHT_OUTCOMES.fixOrDisable)
    expect(result.fixOrDisableRequirementIds).toEqual(['work.required-mcp'])
  })

  it('treats an ALREADY-DISABLED required template as resolved (proceed)', () => {
    const input: EvaluationInput = {
      scopeVerdicts: {
        [scopeKey(templateScope('worker'))]: [v('work.required-mcp', 'fatal', true)],
      },
      availability: [{ templateId: 'worker', available: false }],
    }
    const result = startupPreflight(input)
    // the disable is the §E.6 resolution: a disabled template's required work
    // will not start, so it does not trigger fixOrDisable.
    expect(result.outcome).toBe(PREFLIGHT_OUTCOMES.proceed)
  })
})

describe('E.6 startup preflight: fatal (Team-level required missing)', () => {
  it('is FATAL when a TEAM-level required requirement is unmet', () => {
    const input: EvaluationInput = {
      scopeVerdicts: {
        [scopeKey(teamScope())]: [v('team.required', 'fatal', true)],
      },
    }
    const result = startupPreflight(input)
    expect(result.outcome).toBe(PREFLIGHT_OUTCOMES.fatal)
    expect(result.fatalRequirementIds).toEqual(['team.required'])
  })

  it('CANNOT be bypassed by disabling a template (authority: team-level 不允许 disable 绕过)', () => {
    // Even if the affected template is disabled, a TEAM-level required
    // requirement down is fatal (disabling a template does not fix the Team).
    const input: EvaluationInput = {
      scopeVerdicts: {
        [scopeKey(teamScope())]: [v('team.required', 'fatal', true)],
        [scopeKey(templateScope('worker'))]: [v('work.required-mcp', 'fatal', true)],
      },
      availability: [{ templateId: 'worker', available: false }],
    }
    const result = startupPreflight(input)
    expect(result.outcome).toBe(PREFLIGHT_OUTCOMES.fatal)
    expect(result.fatalRequirementIds).toEqual(['team.required'])
  })

  it('takes priority over fixOrDisable when both are present', () => {
    const input: EvaluationInput = {
      scopeVerdicts: {
        [scopeKey(teamScope())]: [v('team.required', 'fatal', true)],
        [scopeKey(templateScope('worker'))]: [v('work.required-mcp', 'fatal', true)],
      },
    }
    const result = startupPreflight(input)
    expect(result.outcome).toBe(PREFLIGHT_OUTCOMES.fatal)
    expect(result.fixOrDisableRequirementIds).toEqual([])
  })
})
