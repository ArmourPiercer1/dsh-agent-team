/**
 * P3-T5 —output stability + engine purity (acceptance: "stable typed
 * result, never starts any work").
 *
 * The engine is a pure classifier over plain data: deterministic (byte-
 * identical canonical JSON for equal inputs), remote-safe (lossless JSON),
 * immutable output (deep-frozen), and side-effect-free (inputs unmutated,
 * no shared state, nothing started/admitted/cancelled).
 */

import { describe, expect, it } from 'vitest'

import { canonicalJsonStringify, isRemoteSafeJsonValue } from '../../../contracts/src/index.js'
import {
  COMPATIBILITY_STATUS,
  evaluateCompatibility,
  serializeCompatibilityResult,
} from '../src/index.js'
import type { CompatibilityEvaluationInput } from '../src/index.js'
import { BLUEPRINT_REQUIREMENTS, COMPLETE_TOOL_REQUIREMENT } from '../fixtures/requirements.js'
import {
  FULLY_COMPATIBLE_FACTS,
  MCP_UNAVAILABLE_FACTS,
} from '../fixtures/environment-facts.js'

describe('P3-T5 stable typed result', () => {
  const baseInput: CompatibilityEvaluationInput = {
    requirements: BLUEPRINT_REQUIREMENTS,
    environmentFacts: MCP_UNAVAILABLE_FACTS,
  }

  it('the result is a lossless-JSON (remote-safe) value', () => {
    const result = evaluateCompatibility(baseInput)
    expect(isRemoteSafeJsonValue(result)).toBe(true)
  })

  it('the result is deeply frozen (top level, requirements, outcomes, counts)', () => {
    const result = evaluateCompatibility(baseInput)
    expect(Object.isFrozen(result)).toBe(true)
    expect(Object.isFrozen(result.requirements)).toBe(true)
    expect(Object.isFrozen(result.counts)).toBe(true)
    const first = result.requirements[0]
    if (first === undefined) throw new Error('expected at least one requirement outcome')
    expect(Object.isFrozen(first)).toBe(true)
    expect(Object.isFrozen(first.unavailableSubjects)).toBe(true)
  })

  it('serialization is deterministic (two evaluations, byte-identical)', () => {
    const a = evaluateCompatibility(baseInput)
    const b = evaluateCompatibility(baseInput)
    expect(serializeCompatibilityResult(a)).toBe(serializeCompatibilityResult(b))
  })

  it('serialization is independent of input key-insertion order', () => {
    const reorderedInput: CompatibilityEvaluationInput = {
      environmentFacts: MCP_UNAVAILABLE_FACTS,
      requirements: BLUEPRINT_REQUIREMENTS,
    }
    const a = serializeCompatibilityResult(evaluateCompatibility(baseInput))
    const b = serializeCompatibilityResult(evaluateCompatibility(reorderedInput))
    expect(a).toBe(b)
  })

  it('JSON.parse(serialize(result)) round-trips to a deep-equal value', () => {
    const result = evaluateCompatibility(baseInput)
    const roundTripped = JSON.parse(serializeCompatibilityResult(result))
    expect(roundTripped).toEqual(result)
  })
})

describe('P3-T5 engine purity (no side effects, no work started)', () => {
  it('does not mutate its input', () => {
    const input: CompatibilityEvaluationInput = {
      requirements: [
        { requirementId: 'req-a', type: 'tool', subjects: ['x', 'y'] },
        { requirementId: 'req-b', type: 'mcpServer', subjects: ['srv'], complete: false },
      ],
      environmentFacts: [
        { domain: 'tool', subject: 'x', available: true, generation: 1 },
        { domain: 'mcpServer', subject: 'srv', available: false, generation: 2 },
      ],
      acknowledgements: [],
    }
    const before = canonicalJsonStringify(input)
    const result = evaluateCompatibility(input)
    const after = canonicalJsonStringify(input)
    expect(after).toBe(before)
    expect(result.status).toBe(COMPATIBILITY_STATUS.BLOCKED_WARNING)
  })

  it('has no shared state: alternating inputs give independent, repeatable results', () => {
    const a1 = evaluateCompatibility({
      requirements: BLUEPRINT_REQUIREMENTS,
      environmentFacts: FULLY_COMPATIBLE_FACTS,
    })
    const b1 = evaluateCompatibility({
      requirements: [COMPLETE_TOOL_REQUIREMENT],
      environmentFacts: [{ domain: 'tool', subject: 'delegate', available: false, generation: 1 }],
    })
    const a2 = evaluateCompatibility({
      requirements: BLUEPRINT_REQUIREMENTS,
      environmentFacts: FULLY_COMPATIBLE_FACTS,
    })
    expect(serializeCompatibilityResult(a1)).toBe(serializeCompatibilityResult(a2))
    const aIsNotB = a1.environmentFingerprint !== b1.environmentFingerprint
    expect(aIsNotB).toBe(true)
    expect(a1.status).toBe(COMPATIBILITY_STATUS.OPEN)
    expect(b1.status).toBe(COMPATIBILITY_STATUS.BLOCKED_FATAL)
  })

  it('every evaluation returns a fresh object (no result reuse/caching)', () => {
    const input: CompatibilityEvaluationInput = {
      requirements: [COMPLETE_TOOL_REQUIREMENT],
      environmentFacts: [{ domain: 'tool', subject: 'delegate', available: false, generation: 1 }],
    }
    const a = evaluateCompatibility(input)
    const b = evaluateCompatibility(input)
    expect(a !== b).toBe(true)
    expect(a.requirements).not.toBe(b.requirements)
    expect(serializeCompatibilityResult(a)).toBe(serializeCompatibilityResult(b))
  })
})
