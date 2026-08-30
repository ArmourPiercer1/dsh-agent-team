/**
 * P3-T5 —engine outcome classification: PASS / WARNING / FATAL.
 *
 * Authority: Architecture §27.2 (three outcomes; FATAL = structural Team
 * contract cannot hold; WARNING = ordinary capability mismatch), §19.1
 * (Requirement != Policy), §28 (admission states); T5 ruling (missing
 * capability -> FATAL with typed detail for structural domains; ordinary
 * missing capability -> WARNING).
 */

import { describe, expect, it } from 'vitest'

import { TEAM_CONTRACT_SCHEMA_VERSION, isRemoteSafeJsonValue } from '../../../contracts/src/index.js'
import {
  COMPATIBILITY_STATUS,
  COMPATIBILITY_REASON_CODES,
  evaluateCompatibility,
} from '../src/index.js'
import type { CompatibilityResult } from '../src/index.js'
import { BLUEPRINT_REQUIREMENTS, MULTI_SUBJECT_TOOL_REQUIREMENT } from '../fixtures/requirements.js'
import {
  FULLY_COMPATIBLE_FACTS,
  MCP_UNAVAILABLE_FACTS,
  MULTI_SUBJECT_PARTIAL_FACTS,
  PERSONA_INCOMPATIBLE_FACTS,
  SKILL_NO_PROBE_FACTS,
  STRUCTURE_MISSING_FACTS,
} from '../fixtures/environment-facts.js'

function requireResult(requirements: CompatibilityResult['requirements'], requirementId: string) {
  const found = requirements.find((entry) => entry.requirementId === requirementId)
  if (found === undefined) throw new Error(`requirement '${requirementId}' missing from result`)
  return found
}

describe('P3-T5 engine outcomes (PASS / WARNING / FATAL)', () => {
  it('fully compatible environment: every requirement PASS, status OPEN', () => {
    const result = evaluateCompatibility({
      requirements: BLUEPRINT_REQUIREMENTS,
      environmentFacts: FULLY_COMPATIBLE_FACTS,
    })
    expect(result.status).toBe(COMPATIBILITY_STATUS.OPEN)
    expect(result.counts).toEqual({ pass: 6, warning: 0, fatal: 0, unackedWarning: 0, staleAcknowledgement: 0 })
    for (const entry of result.requirements) {
      expect(entry.outcome).toBe('PASS')
      expect(entry.reasonCode).toBe(COMPATIBILITY_REASON_CODES.SATISFIED)
      expect(entry.mismatchFingerprint).toBe(null)
      expect(entry.unavailableSubjects).toEqual([])
    }
    expect(result.schemaVersion).toBe(TEAM_CONTRACT_SCHEMA_VERSION)
  })

  it('missing ordinary capability -> WARNING with typed detail (missing capability, ack-able)', () => {
    const result = evaluateCompatibility({
      requirements: BLUEPRINT_REQUIREMENTS,
      environmentFacts: MCP_UNAVAILABLE_FACTS,
    })
    expect(result.status).toBe(COMPATIBILITY_STATUS.BLOCKED_WARNING)
    const mcp = requireResult(result.requirements, 'req-mcp-abtem')
    expect(mcp.outcome).toBe('WARNING')
    expect(mcp.reasonCode).toBe(COMPATIBILITY_REASON_CODES.CAPABILITY_UNAVAILABLE)
    expect(mcp.unavailableSubjects).toEqual(['abtem'])
    expect(mcp.detail).toBe('ordinary capability unavailable: abtem')
    expect(result.counts.warning).toBe(1)
    expect(result.counts.fatal).toBe(0)
  })

  it('missing structural team capability -> FATAL with typed detail', () => {
    const result = evaluateCompatibility({
      requirements: BLUEPRINT_REQUIREMENTS,
      environmentFacts: STRUCTURE_MISSING_FACTS,
    })
    expect(result.status).toBe(COMPATIBILITY_STATUS.BLOCKED_FATAL)
    const structure = requireResult(result.requirements, 'req-team-structure')
    expect(structure.outcome).toBe('FATAL')
    expect(structure.reasonCode).toBe(COMPATIBILITY_REASON_CODES.STRUCTURAL_CAPABILITY_MISSING)
    expect(structure.unavailableSubjects).toEqual(['durable-persistence'])
    expect(structure.detail).toBe('structural team capability missing: durable-persistence')
    expect(result.counts.fatal).toBe(1)
  })

  it('missing persona compatibility -> FATAL (structural), not ack-able WARNING', () => {
    const result = evaluateCompatibility({
      requirements: BLUEPRINT_REQUIREMENTS,
      environmentFacts: PERSONA_INCOMPATIBLE_FACTS,
    })
    expect(result.status).toBe(COMPATIBILITY_STATUS.BLOCKED_FATAL)
    const persona = requireResult(result.requirements, 'req-persona')
    expect(persona.outcome).toBe('FATAL')
    expect(persona.reasonCode).toBe(COMPATIBILITY_REASON_CODES.PERSONA_INCOMPATIBLE)
    expect(persona.unavailableSubjects).toEqual(['team-preset-cordis'])
    expect(persona.acknowledgement).toBe(null)
  })

  it('absent probe (no fact for a subject) counts as unavailable', () => {
    const result = evaluateCompatibility({
      requirements: BLUEPRINT_REQUIREMENTS,
      environmentFacts: SKILL_NO_PROBE_FACTS,
    })
    const skill = requireResult(result.requirements, 'req-skill-review')
    expect(skill.outcome).toBe('WARNING')
    expect(skill.unavailableSubjects).toEqual(['code-review'])
    expect(result.status).toBe(COMPATIBILITY_STATUS.BLOCKED_WARNING)
  })

  it('partial availability: only the missing subjects are listed', () => {
    const result = evaluateCompatibility({
      requirements: [MULTI_SUBJECT_TOOL_REQUIREMENT],
      environmentFacts: MULTI_SUBJECT_PARTIAL_FACTS,
    })
    const multi = requireResult(result.requirements, 'req-tools-multi')
    expect(multi.outcome).toBe('WARNING')
    expect(multi.unavailableSubjects).toEqual(['spawn-member'])
  })

  it('aggregates multiple failures; FATAL dominates WARNING in the status', () => {
    const facts = STRUCTURE_MISSING_FACTS.map((fact) =>
      fact.domain === 'mcpServer' && fact.subject === 'abtem' ? { ...fact, available: false } : fact,
    )
    const result = evaluateCompatibility({
      requirements: BLUEPRINT_REQUIREMENTS,
      environmentFacts: facts,
    })
    expect(result.status).toBe(COMPATIBILITY_STATUS.BLOCKED_FATAL)
    expect(result.counts).toEqual({ pass: 4, warning: 1, fatal: 1, unackedWarning: 1, staleAcknowledgement: 0 })
  })

  it('an empty requirement list is trivially OPEN', () => {
    const result = evaluateCompatibility({
      requirements: [],
      environmentFacts: FULLY_COMPATIBLE_FACTS,
    })
    expect(result.status).toBe(COMPATIBILITY_STATUS.OPEN)
    expect(result.requirements.length).toBe(0)
  })

  it('the result is a plain lossless-JSON (remote-safe) value', () => {
    const result = evaluateCompatibility({
      requirements: BLUEPRINT_REQUIREMENTS,
      environmentFacts: MCP_UNAVAILABLE_FACTS,
    })
    const safe = isRemoteSafeJsonValue(result)
    expect(safe).toBe(true)
  })
})
