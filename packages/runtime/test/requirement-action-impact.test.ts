/**
 * pre-alpha3 PR-E (plan §E.7) — the action → requirement-impact-class
 * metadata: every named action has a closed impact class, and the mapping is
 * the FINE-GRAINED axis (NOT a copy of the coarse ActionCategory).
 *
 * @module @dsh-agent-team/runtime/test/requirement-action-impact
 */

import { describe, expect, it } from 'vitest'

import {
  ACTION_NAME_VALUES,
  ACTION_NAMES,
  ACTION_REQUIREMENT_IMPACT,
  actionImpactClassOf,
  actionSpecOf,
} from '../admission/actions.js'
import { gateAction, GATE_REASONS, normalWorkImpact, scopeKey, teamScope } from '../requirements/index.js'
import type { EvaluationInput, RequirementVerdict } from '../requirements/index.js'

function v(requirementId: string, outcome: RequirementVerdict['outcome'], complete = false): RequirementVerdict {
  return { requirementId, complete, outcome, unavailableSubjects: outcome === 'pass' ? [] : [requirementId] }
}

describe('E.7 the action → impact map is complete and closed', () => {
  it('covers every named action exactly once', () => {
    expect(Object.keys(ACTION_REQUIREMENT_IMPACT).sort()).toEqual(ACTION_NAME_VALUES.slice().sort())
  })

  it('every value is a closed impact class (recoveryWork/control are NOT a default)', () => {
    const values = new Set(Object.values(ACTION_REQUIREMENT_IMPACT))
    // The static map only ever assigns the DEFAULT classes; recoveryWork
    // and control are caller-context (built explicitly at the recovery /
    // control call sites), never a static default.
    for (const v of values) {
      expect([
        'diagnostic',
        'normalWork',
        'coordination',
        'lifecycle',
        'crossAgentTrigger',
      ]).toContain(v)
    }
    expect(values.has('recoveryWork')).toBe(false)
    expect(values.has('control')).toBe(false)
  })
})

describe('E.7 the impact is NOT a copy of the coarse ActionCategory', () => {
  it('read actions are `diagnostic` (not a "read" impact class)', () => {
    for (const name of [
      ACTION_NAMES.LIST_MEMBERS,
      ACTION_NAMES.LIST_TEMPLATES,
      ACTION_NAMES.INSPECT_CONFIG,
      ACTION_NAMES.WORK_STATUS,
    ]) {
      expect(ACTION_REQUIREMENT_IMPACT[name]).toBe('diagnostic')
    }
  })

  it('work AND creation both map to `normalWork` (the category is NOT the axis)', () => {
    expect(ACTION_REQUIREMENT_IMPACT[ACTION_NAMES.FOLLOW_UP]).toBe('normalWork')
    expect(ACTION_REQUIREMENT_IMPACT[ACTION_NAMES.DELEGATE]).toBe('normalWork')
    expect(ACTION_REQUIREMENT_IMPACT[ACTION_NAMES.CREATE_MEMBER]).toBe('normalWork')
    // ... yet they are DIFFERENT categories (work vs creation).
    expect(actionSpecOf(ACTION_NAMES.FOLLOW_UP)?.category).toBe('work')
    expect(actionSpecOf(ACTION_NAMES.CREATE_MEMBER)?.category).toBe('creation')
  })

  it('coordination actions are `coordination` (always allowed)', () => {
    // pre-alpha3 W3-D (review fix F9, guide §8): send-message is NO LONGER
    // pure coordination — it is the cross-agent execution trigger (it wakes
    // the recipient). Only report-progress / request-control /
    // resolve-control remain pure coordination.
    for (const name of [
      ACTION_NAMES.REPORT_PROGRESS,
      ACTION_NAMES.REQUEST_CONTROL,
      ACTION_NAMES.RESOLVE_CONTROL,
    ]) {
      expect(ACTION_REQUIREMENT_IMPACT[name]).toBe('coordination')
    }
  })

  it('send-message is the cross-agent execution trigger (W3-D F9, by effect not name)', () => {
    expect(ACTION_REQUIREMENT_IMPACT[ACTION_NAMES.SEND_MESSAGE]).toBe('crossAgentTrigger')
  })

  it('lifecycle actions are `lifecycle` (always allowed)', () => {
    for (const name of [ACTION_NAMES.ARCHIVE_MEMBER, ACTION_NAMES.RESTORE_MEMBER, ACTION_NAMES.DISPOSE_MEMBER]) {
      expect(ACTION_REQUIREMENT_IMPACT[name]).toBe('lifecycle')
    }
  })
})

describe('E.7 a work action gated by its impact class is blocked while a scope is down', () => {
  it('`delegate` (normalWork) is blocked when a Team-level required requirement is down', () => {
    const impact = ACTION_REQUIREMENT_IMPACT[ACTION_NAMES.DELEGATE]
    expect(impact).toBe('normalWork')
    const input: EvaluationInput = {
      scopeVerdicts: {
        [scopeKey(teamScope())]: [v('team.required-mcp', 'fatal', true)],
      },
    }
    const decision = gateAction(normalWorkImpact([teamScope()]), input)
    expect(decision.allowed).toBe(false)
    expect(decision.reason).toBe(GATE_REASONS.requiredScopeDown)
  })
})

describe('E.7 actionImpactClassOf is fail-safe', () => {
  it('resolves a known name to its impact class', () => {
    expect(actionImpactClassOf(ACTION_NAMES.DELEGATE)).toBe('normalWork')
    expect(actionImpactClassOf(ACTION_NAMES.LIST_MEMBERS)).toBe('diagnostic')
  })

  it('returns undefined for an unknown name (never a default)', () => {
    expect(actionImpactClassOf('not-an-action')).toBeUndefined()
  })
})
