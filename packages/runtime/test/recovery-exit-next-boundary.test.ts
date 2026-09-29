/**
 * pre-alpha3 PR-E (plan §E.10 "Recovery exit") — recovery exits when:
 *
 * ```text
 * fresh requirement evaluation PASS;
 * 需要 materialization 的 applicable capability 成功;
 * 从下一 boundary 恢复 normal.
 * 不写 durable Recovery flag.
 * ```
 *
 * @module @dsh-agent-team/runtime/test/recovery-exit-next-boundary
 */

import { describe, expect, it } from 'vitest'

import {
  classifyScope,
  recoveryExitReady,
  scopeKey,
  templateScope,
  SCOPE_STATES,
  type RequirementVerdict,
} from '../requirements/index.js'

function v(requirementId: string, outcome: RequirementVerdict['outcome'], complete = false): RequirementVerdict {
  return { requirementId, complete, outcome, unavailableSubjects: outcome === 'pass' ? [] : [requirementId] }
}

function scopeVerdictsFrom(verdicts: RequirementVerdict[]) {
  const scope = templateScope('worker')
  return [classifyScope(scope, verdicts)]
}

describe('E.10 recovery exit', () => {
  it('does NOT exit while a required requirement is still down (FRESH eval not PASS)', () => {
    const scopeVerdicts = scopeVerdictsFrom([v('work.required-mcp', 'fatal', true)])
    const result = recoveryExitReady({ scopeVerdicts, materializationSatisfied: true })
    expect(result.canExit).toBe(false)
    expect(result.resumeAt).toBe('next-boundary')
  })

  it('does NOT exit when a required materialization is not satisfied', () => {
    const scopeVerdicts = scopeVerdictsFrom([v('work.required-mcp', 'pass')])
    const result = recoveryExitReady({ scopeVerdicts, materializationSatisfied: false })
    expect(result.canExit).toBe(false)
    expect(result.resumeAt).toBe('next-boundary')
  })

  it('exits when the fresh evaluation PASSES and materialization is satisfied', () => {
    const scopeVerdicts = scopeVerdictsFrom([v('work.required-mcp', 'pass')])
    const result = recoveryExitReady({ scopeVerdicts, materializationSatisfied: true })
    expect(result.canExit).toBe(true)
    expect(result.resumeAt).toBe('next-boundary')
  })

  it('always resumes normal at the NEXT boundary (never mid-turn)', () => {
    const scopeVerdicts = scopeVerdictsFrom([v('work.required-mcp', 'pass')])
    const result = recoveryExitReady({ scopeVerdicts, materializationSatisfied: true })
    expect(result.resumeAt).toBe('next-boundary')
  })

  it('does not require a durable recovery flag (the state is DERIVED from the fresh evaluation)', () => {
    // The exit is the derived state flipping to "no blocked scope" — there is
    // no stored `recovery` flag to clear. A scope that was blocked and is now
    // ready (fresh eval PASS) exits with nothing persisted.
    const blockedScope = classifyScope(templateScope('worker'), [v('work.required-mcp', 'fatal', true)])
    const readyScope = classifyScope(templateScope('worker'), [v('work.required-mcp', 'pass')])
    expect(blockedScope.state).toBe(SCOPE_STATES.blocked)
    expect(readyScope.state).toBe(SCOPE_STATES.ready)
    expect(scopeKey(readyScope.scope)).toBe(scopeKey(blockedScope.scope))
    const result = recoveryExitReady({ scopeVerdicts: [readyScope], materializationSatisfied: true })
    expect(result.canExit).toBe(true)
  })
})
