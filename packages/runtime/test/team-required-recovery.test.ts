/**
 * pre-alpha3 PR-E (plan §E.8 "Team-level required down") — a Team-level
 * required requirement that is down:
 *
 * ```text
 * normal work    = block
 * recovery work  = allow
 * control / diagnostic / lifecycle = allow
 * ```
 *
 * plus authority negative #5 (Team-level required down 不允许普通 delegate)
 * and #6 (recovery delegate must be human-only — the gate signals recovery so
 * the caller routes through the human-reviewed Control coupling).
 *
 * @module @dsh-agent-team/runtime/test/team-required-recovery
 */

import { describe, expect, it } from 'vitest'

import {
  controlImpact,
  coordinationImpact,
  diagnosticImpact,
  GATE_REASONS,
  gateAction,
  lifecycleImpact,
  normalWorkImpact,
  recoveryWorkImpact,
  scopeKey,
  teamScope,
  templateScope,
  type EvaluationInput,
  type RequirementVerdict,
} from '../requirements/index.js'

function v(requirementId: string, outcome: RequirementVerdict['outcome'], complete = false): RequirementVerdict {
  return { requirementId, complete, outcome, unavailableSubjects: outcome === 'pass' ? [] : [requirementId] }
}

/** A Team-level required requirement that is down (FATAL). */
function teamRequiredDown(): EvaluationInput {
  return {
    scopeVerdicts: {
      [scopeKey(teamScope())]: [v('team.required-mcp', 'fatal', true)],
      [scopeKey(templateScope('leader'))]: [v('lead.a', 'pass')],
      [scopeKey(templateScope('worker'))]: [v('work.a', 'pass')],
    },
  }
}

describe('E.8 team-level required down: the gate', () => {
  const input = teamRequiredDown()

  it('BLOCKS normal work (a model turn / delegated task body)', () => {
    const decision = gateAction(normalWorkImpact([teamScope(), templateScope('worker')]), input)
    expect(decision.allowed).toBe(false)
    expect(decision.reason).toBe(GATE_REASONS.requiredScopeDown)
    expect(decision.blockedScopes?.map((s) => scopeKey(s))).toEqual([scopeKey(teamScope())])
  })

  it('BLOCKS a normal delegate (authority negative #5: team-level down 不允许普通 delegate)', () => {
    // `delegate` to a member is normal work that depends on the Team scope.
    const decision = gateAction(normalWorkImpact([teamScope(), templateScope('worker')]), input)
    expect(decision.allowed).toBe(false)
    expect(decision.reason).toBe(GATE_REASONS.requiredScopeDown)
  })

  it('ALLOWS recovery work (on the reduced original authority)', () => {
    const decision = gateAction(recoveryWorkImpact([teamScope(), templateScope('worker')]), input)
    expect(decision.allowed).toBe(true)
    expect(decision.reason).toBe(GATE_REASONS.recoveryAllowed)
    // the blocked scopes are surfaced so the caller runs it on the REDUCED
    // authority and routes the cross-agent effect through Control review.
    expect(decision.recoveryScopes?.map((s) => scopeKey(s))).toEqual([scopeKey(teamScope())])
  })

  it('ALLOWS a recovery delegate (human-only — the caller routes through Control)', () => {
    // authority negative #6: recovery delegate is human-only. The gate allows
    // the recovery work AND surfaces the blocked scope, which is the signal
    // the integration layer uses to force the human-reviewed Control coupling
    // (synchronous wait, full normalized payload, per-attempt approval).
    const decision = gateAction(recoveryWorkImpact([teamScope(), templateScope('worker')]), input)
    expect(decision.allowed).toBe(true)
    expect(decision.recoveryScopes?.length).toBe(1)
  })

  it('ALLOWS control / diagnostic / lifecycle / coordination (always allowed)', () => {
    expect(gateAction(controlImpact(), input).allowed).toBe(true)
    expect(gateAction(controlImpact(), input).reason).toBe(GATE_REASONS.alwaysAllowed)
    expect(gateAction(diagnosticImpact(), input).allowed).toBe(true)
    expect(gateAction(lifecycleImpact(), input).allowed).toBe(true)
    expect(gateAction(coordinationImpact(), input).allowed).toBe(true)
  })
})
