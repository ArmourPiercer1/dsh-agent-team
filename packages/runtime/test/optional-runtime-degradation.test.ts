/**
 * pre-alpha3 PR-E (plan §E.8 "Optional runtime down") — an OPTIONAL
 * requirement that goes down at runtime:
 *
 * ```text
 * auto degraded
 * normal work continues
 * telemetry writes
 * ```
 *
 * plus authority negative #1 (cold member required MCP + mounted:false ≠
 * blocked — a COLD member's capability is `not-applicable`, derived from
 * liveness, never a fabricated failure, so it does not block).
 *
 * @module @dsh-agent-team/runtime/test/optional-runtime-degradation
 */

import { describe, expect, it } from 'vitest'

import {
  classifyScope,
  GATE_REASONS,
  gateAction,
  normalWorkImpact,
  scopeKey,
  teamScope,
  templateScope,
  SCOPE_STATES,
  type EvaluationInput,
  type RequirementVerdict,
} from '../requirements/index.js'

// The readiness layer's materialization derivation (PR-C §C.5) — imported to
// assert authority negative #1 at the boundary the evaluator consumes.
import { deriveMaterializationStatus, MATERIALIZATION_STATES } from '../readiness/index.js'

function v(requirementId: string, outcome: RequirementVerdict['outcome'], complete = false): RequirementVerdict {
  return { requirementId, complete, outcome, unavailableSubjects: outcome === 'pass' ? [] : [requirementId] }
}

describe('E.8 optional runtime down: auto-degraded, normal continues', () => {
  it('classifies an optional-unmet scope as `degraded` (not blocked)', () => {
    const scope = templateScope('worker')
    const verdicts = [v('work.optional-mcp', 'warning', false)]
    const scopeVerdict = classifyScope(scope, verdicts)
    expect(scopeVerdict.state).toBe(SCOPE_STATES.degraded)
  })

  it('does NOT block normal work on a degraded (optional-unmet) scope', () => {
    const input: EvaluationInput = {
      scopeVerdicts: {
        [scopeKey(teamScope())]: [v('team.a', 'pass')],
        [scopeKey(templateScope('worker'))]: [v('work.optional-mcp', 'warning', false)],
      },
    }
    const decision = gateAction(normalWorkImpact([teamScope(), templateScope('worker')]), input)
    expect(decision.allowed).toBe(true)
    expect(decision.reason).toBe(GATE_REASONS.allowed)
  })
})

describe('authority negative #1: cold member required MCP + mounted:false ≠ blocked', () => {
  it('a cold member capability is not-applicable (never a fabricated failure)', () => {
    // The readiness derivation: a cold member (no live agent) has no mounted
    // fiber — its materialization is `not-applicable`, derived from liveness.
    const materialization = deriveMaterializationStatus({ liveness: 'cold' })
    expect(materialization).toBe(MATERIALIZATION_STATES.notApplicable)
  })

  it('a cold member therefore is NOT a blocked scope (its requirement is not "down")', () => {
    // Because the cold member's required MCP is `not-applicable` (not
    // `unreachable`/`failed`), the readiness layer does NOT feed a FATAL
    // verdict — the scope is `ready`, and normal work is not blocked.
    const scope = templateScope('cold-member')
    // The cold member has no live observation: its required requirement is
    // not probed-unreachable, so the verdict is absent / pass (not fatal).
    const verdicts: RequirementVerdict[] = [] // nothing observed-down for a cold member
    const scopeVerdict = classifyScope(scope, verdicts)
    expect(scopeVerdict.state).toBe(SCOPE_STATES.ready)

    const input: EvaluationInput = {
      scopeVerdicts: {
        [scopeKey(scope)]: verdicts,
      },
    }
    const decision = gateAction(normalWorkImpact([scope]), input)
    expect(decision.allowed).toBe(true)
  })

  it('a RESIDENT member whose required MCP mount FAILED IS a blocked scope (the contrast)', () => {
    // The contrast: a resident member with a failed mount (not cold) is a
    // genuine required-down → blocked.
    const materialization = deriveMaterializationStatus({ liveness: 'resident', slot: { status: 'failed' } })
    expect(materialization).toBe(MATERIALIZATION_STATES.failed)
    const scope = templateScope('worker')
    const verdicts = [v('work.required-mcp', 'fatal', true)]
    const scopeVerdict = classifyScope(scope, verdicts)
    expect(scopeVerdict.state).toBe(SCOPE_STATES.blocked)
  })
})
