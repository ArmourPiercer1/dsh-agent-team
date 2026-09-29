/**
 * pre-alpha3 PR-E (plan §E.7) — E.11 suite `requirement-applicability`:
 * the gate keys on the action's REQUIREMENT IMPACT (the closed impact class
 * + the scopes the action's work depends on), NEVER the coarse action
 * category. This suite pins the applicability rules:
 *   - control / diagnostic / lifecycle / coordination → always allowed
 *     (even with a blocked scope in scope);
 *   - normalWork with a BLOCKED scope in its scopeRefs → blocked
 *     (requiredScopeDown);
 *   - normalWork with a DISABLED target template → blocked (templateDisabled);
 *   - normalWork with NO blocked scopeRef → allowed;
 *   - a blocked scope NOT in the impact's scopeRefs does NOT block the
 *     action (scope scoping);
 *   - recoveryWork with a blocked scopeRef → allowed on the blocked scopes
 *     (recoveryAllowed, the §E.9 reduced authority).
 *
 * @module @dsh-agent-team/runtime/test/requirement-applicability
 */

import { describe, expect, it } from 'vitest'

import {
  ACTION_IMPACT_CLASSES,
  GATE_REASONS,
  gateAction,
  normalWorkImpact,
  recoveryWorkImpact,
  controlImpact,
  diagnosticImpact,
  lifecycleImpact,
  coordinationImpact,
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

const TEAM_DOWN: EvaluationInput = {
  scopeVerdicts: {
    [scopeKey(teamScope())]: [v('team.required', 'fatal', true)],
  },
}
const TEMPLATE_DOWN: EvaluationInput = {
  scopeVerdicts: {
    [scopeKey(teamScope())]: [v('team.a', 'pass')],
    [scopeKey(templateScope('worker'))]: [v('work.required', 'fatal', true)],
  },
}
const TEMPLATE_DOWN_DISABLED: EvaluationInput = {
  ...TEMPLATE_DOWN,
  availability: [{ templateId: 'worker', available: false }],
}

describe('E.11 requirement-applicability: impact class decides the gate', () => {
  it('control / diagnostic / lifecycle / coordination are always allowed (even with a blocked team scope)', () => {
    for (const impact of [
      controlImpact(),
      diagnosticImpact(),
      lifecycleImpact([teamScope()]),
      coordinationImpact([teamScope()]),
    ]) {
      const decision = gateAction(impact, TEAM_DOWN)
      expect(decision.allowed).toBe(true)
      expect(decision.reason).toBe(GATE_REASONS.alwaysAllowed)
    }
  })

  it('normalWork with a BLOCKED team scope in its scopeRefs is blocked (requiredScopeDown)', () => {
    const decision = gateAction(normalWorkImpact([teamScope()]), TEAM_DOWN)
    expect(decision.allowed).toBe(false)
    expect(decision.reason).toBe(GATE_REASONS.requiredScopeDown)
    expect(decision.blockedScopes?.map((s) => scopeKey(s))).toEqual([scopeKey(teamScope())])
  })

  it('normalWork targeting a DISABLED template is blocked (templateDisabled — availability, not policy)', () => {
    const decision = gateAction(normalWorkImpact([teamScope(), templateScope('worker')]), TEMPLATE_DOWN_DISABLED)
    expect(decision.allowed).toBe(false)
    expect(decision.reason).toBe(GATE_REASONS.templateDisabled)
  })

  it('normalWork with NO blocked scopeRef is allowed', () => {
    const input: EvaluationInput = {
      scopeVerdicts: {
        [scopeKey(teamScope())]: [v('team.a', 'pass')],
      },
    }
    const decision = gateAction(normalWorkImpact([teamScope()]), input)
    expect(decision.allowed).toBe(true)
    expect(decision.reason).toBe(GATE_REASONS.allowed)
  })

  it('a blocked scope NOT in the impact scopeRefs does NOT block the action (scope scoping)', () => {
    // The action depends ONLY on the Team scope (ready); the worker template
    // is down but is NOT in the scopeRefs → the action is allowed.
    const decision = gateAction(normalWorkImpact([teamScope()]), TEMPLATE_DOWN)
    expect(decision.allowed).toBe(true)
    expect(decision.reason).toBe(GATE_REASONS.allowed)
  })

  it('recoveryWork with a BLOCKED scopeRef is allowed on the blocked scopes (recoveryAllowed, §E.9 reduced authority)', () => {
    const decision = gateAction(recoveryWorkImpact([teamScope()]), TEAM_DOWN)
    expect(decision.allowed).toBe(true)
    expect(decision.reason).toBe(GATE_REASONS.recoveryAllowed)
    expect(decision.recoveryScopes?.map((s) => scopeKey(s))).toEqual([scopeKey(teamScope())])
  })
})
