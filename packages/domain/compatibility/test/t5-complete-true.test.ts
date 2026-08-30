/**
 * P3-T5 —complete:true mandatory FATAL (required test; G3 gate criterion
 * "complete:true compatibility fatal test").
 *
 * Authority: Architecture §13.5 (AgentPreset effective persona complete:true
 * => TEAM_PERSONA_COMPLETE_PRESET_CONFLICT => Structural FATAL; user cannot
 * Continue Anyway), §27.2 (FATAL 不允许Continue Anyway); contracts v1
 * (TEAM_PERSONA_COMPLETE_PRESET_CONFLICT frozen for exactly this engine);
 * T5 ruling ("complete:true on a requirement means FATAL is mandatory
 * (no downgrade)").
 */

import { describe, expect, it } from 'vitest'

import { TeamContractErrorCode } from '../../../contracts/src/index.js'
import {
  COMPATIBILITY_REASON_CODES,
  COMPATIBILITY_STATUS,
  evaluateCompatibility,
} from '../src/index.js'
import type {
  CompatibilityResult,
  EnvironmentFact,
  WarningAcknowledgement,
} from '../src/index.js'
import {
  COMPLETE_PERSONA_REQUIREMENT,
  COMPLETE_TOOL_REQUIREMENT,
} from '../fixtures/requirements.js'
import { COMPLETE_PERSONA_CONFLICT_FACTS } from '../fixtures/environment-facts.js'

const OPERATOR = 'test-operator'
const ACKED_AT = '2026-08-29T12:00:00.000Z'

function ackFor(result: CompatibilityResult, requirementId: string): WarningAcknowledgement {
  const entry = result.requirements.find((item) => item.requirementId === requirementId)
  if (entry === undefined) throw new Error(`requirement '${requirementId}' missing from result`)
  if (entry.mismatchFingerprint === null) throw new Error('no mismatch fingerprint to bind an ack to')
  return {
    requirementId,
    mismatchFingerprint: entry.mismatchFingerprint,
    environmentFingerprint: result.environmentFingerprint,
    acknowledgedBy: OPERATOR,
    acknowledgedAt: ACKED_AT,
  }
}

describe('P3-T5 complete:true (mandatory FATAL, no downgrade)', () => {
  it('complete:true persona conflict -> FATAL with the exact frozen contracts-v1 code', () => {
    const result = evaluateCompatibility({
      requirements: [COMPLETE_PERSONA_REQUIREMENT],
      environmentFacts: COMPLETE_PERSONA_CONFLICT_FACTS,
    })
    expect(result.status).toBe(COMPATIBILITY_STATUS.BLOCKED_FATAL)
    const persona = result.requirements.find((entry) => entry.requirementId === 'req-persona-complete')
    if (persona === undefined) throw new Error('persona requirement missing from result')
    expect(persona.outcome).toBe('FATAL')
    expect(persona.complete).toBe(true)
    expect(persona.reasonCode).toBe('TEAM_PERSONA_COMPLETE_PRESET_CONFLICT')
    expect(persona.reasonCode).toBe(TeamContractErrorCode.TEAM_PERSONA_COMPLETE_PRESET_CONFLICT)
    expect(persona.unavailableSubjects).toEqual(['cordis-preset'])
    expect(persona.detail).toBe(
      'complete:true persona requirement unmet: cordis-preset (structural FATAL, not downgradeable)',
    )
    expect(result.counts.fatal).toBe(1)
  })

  it('an ack cannot downgrade a complete:true FATAL (no Continue Anyway)', () => {
    const first = evaluateCompatibility({
      requirements: [COMPLETE_PERSONA_REQUIREMENT],
      environmentFacts: COMPLETE_PERSONA_CONFLICT_FACTS,
    })
    const ack = ackFor(first, 'req-persona-complete')
    const second = evaluateCompatibility({
      requirements: [COMPLETE_PERSONA_REQUIREMENT],
      environmentFacts: COMPLETE_PERSONA_CONFLICT_FACTS,
      acknowledgements: [ack],
    })
    expect(second.status).toBe(COMPATIBILITY_STATUS.BLOCKED_FATAL)
    const persona = second.requirements.find((entry) => entry.requirementId === 'req-persona-complete')
    if (persona === undefined) throw new Error('persona requirement missing from result')
    expect(persona.outcome).toBe('FATAL')
    expect(persona.acknowledgement).toBe(null)
    expect(second.unappliedAcknowledgements.length).toBe(1)
  })

  it('complete:true on an ordinary (tool) requirement -> FATAL COMPLETE_REQUIREMENT_NOT_MET', () => {
    const result = evaluateCompatibility({
      requirements: [COMPLETE_TOOL_REQUIREMENT],
      environmentFacts: [{ domain: 'tool', subject: 'delegate', available: false, generation: 1 }],
    })
    expect(result.status).toBe(COMPATIBILITY_STATUS.BLOCKED_FATAL)
    const tool = result.requirements.find((entry) => entry.requirementId === 'req-tool-delegate-complete')
    if (tool === undefined) throw new Error('tool requirement missing from result')
    expect(tool.outcome).toBe('FATAL')
    expect(tool.reasonCode).toBe(COMPATIBILITY_REASON_CODES.COMPLETE_REQUIREMENT_NOT_MET)
    expect(tool.unavailableSubjects).toEqual(['delegate'])
  })

  it('an ack cannot downgrade a complete:true ordinary FATAL either', () => {
    const first = evaluateCompatibility({
      requirements: [COMPLETE_TOOL_REQUIREMENT],
      environmentFacts: [{ domain: 'tool', subject: 'delegate', available: false, generation: 1 }],
    })
    const ack = ackFor(first, 'req-tool-delegate-complete')
    const second = evaluateCompatibility({
      requirements: [COMPLETE_TOOL_REQUIREMENT],
      environmentFacts: [{ domain: 'tool', subject: 'delegate', available: false, generation: 1 }],
      acknowledgements: [ack],
    })
    expect(second.status).toBe(COMPATIBILITY_STATUS.BLOCKED_FATAL)
    expect(second.counts.fatal).toBe(1)
    expect(second.unappliedAcknowledgements.length).toBe(1)
  })

  it('complete:false counterpart stays a downgradable WARNING (the downgrade boundary)', () => {
    const ordinary = { ...COMPLETE_TOOL_REQUIREMENT, complete: false }
    const facts: EnvironmentFact[] = [{ domain: 'tool', subject: 'delegate', available: false, generation: 1 }]
    const first = evaluateCompatibility({ requirements: [ordinary], environmentFacts: facts })
    const warning = first.requirements.find((entry) => entry.requirementId === 'req-tool-delegate-complete')
    if (warning === undefined) throw new Error('tool requirement missing from result')
    expect(warning.outcome).toBe('WARNING')
    const ack = ackFor(first, 'req-tool-delegate-complete')
    const second = evaluateCompatibility({
      requirements: [ordinary],
      environmentFacts: facts,
      acknowledgements: [ack],
    })
    expect(second.status).toBe(COMPATIBILITY_STATUS.DEGRADED_ACKNOWLEDGED)
  })

  it('a satisfied complete:true requirement is PASS (complete only binds the unmet case)', () => {
    const result = evaluateCompatibility({
      requirements: [COMPLETE_PERSONA_REQUIREMENT],
      environmentFacts: [{ domain: 'persona', subject: 'cordis-preset', available: true, generation: 2 }],
    })
    expect(result.status).toBe(COMPATIBILITY_STATUS.OPEN)
    const persona = result.requirements.find((entry) => entry.requirementId === 'req-persona-complete')
    if (persona === undefined) throw new Error('persona requirement missing from result')
    expect(persona.outcome).toBe('PASS')
    expect(persona.reasonCode).toBe(COMPATIBILITY_REASON_CODES.SATISFIED)
    expect(persona.mismatchFingerprint).toBe(null)
  })
})
