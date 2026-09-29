/**
 * pre-alpha3 PR-E (plan §E.8 "Template-level required down") — a template's
 * required requirement that is down:
 *
 * ```text
 * affected normal work    = block
 * affected recovery turn  = allow on reduced original authority
 * unaffected template     = normal
 * ```
 *
 * @module @dsh-agent-team/runtime/test/template-required-recovery
 */

import { describe, expect, it } from 'vitest'

import {
  GATE_REASONS,
  gateAction,
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

/** The `worker` template's required MCP is down; the `leader` is healthy. */
function templateRequiredDown(): EvaluationInput {
  return {
    scopeVerdicts: {
      [scopeKey(teamScope())]: [v('team.a', 'pass')],
      [scopeKey(templateScope('leader'))]: [v('lead.a', 'pass')],
      [scopeKey(templateScope('worker'))]: [v('work.required-mcp', 'fatal', true)],
    },
  }
}

describe('E.8 template-level required down: the gate', () => {
  const input = templateRequiredDown()

  it('BLOCKS normal work that targets the AFFECTED template', () => {
    const decision = gateAction(normalWorkImpact([teamScope(), templateScope('worker')]), input)
    expect(decision.allowed).toBe(false)
    expect(decision.reason).toBe(GATE_REASONS.requiredScopeDown)
    expect(decision.blockedScopes?.map((s) => scopeKey(s))).toEqual([scopeKey(templateScope('worker'))])
  })

  it('does NOT block normal work that targets an UNAFFECTED template', () => {
    const decision = gateAction(normalWorkImpact([teamScope(), templateScope('leader')]), input)
    expect(decision.allowed).toBe(true)
    expect(decision.reason).toBe(GATE_REASONS.allowed)
  })

  it('ALLOWS a recovery turn on the AFFECTED template (reduced original authority)', () => {
    const decision = gateAction(recoveryWorkImpact([teamScope(), templateScope('worker')]), input)
    expect(decision.allowed).toBe(true)
    expect(decision.reason).toBe(GATE_REASONS.recoveryAllowed)
    expect(decision.recoveryScopes?.map((s) => scopeKey(s))).toEqual([scopeKey(templateScope('worker'))])
  })

  it('ALLOWS a recovery turn on an UNAFFECTED template as ordinary work', () => {
    const decision = gateAction(recoveryWorkImpact([teamScope(), templateScope('leader')]), input)
    expect(decision.allowed).toBe(true)
    // nothing is down for this scope, so it is ordinary work (no recovery scope).
    expect(decision.reason).toBe(GATE_REASONS.allowed)
    expect(decision.recoveryScopes).toBeUndefined()
  })
})
