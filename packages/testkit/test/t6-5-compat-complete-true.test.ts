/**
 * P3-T6 (G3-5) — complete:true compatibility is mandatory FATAL: cross-module
 * exhaustive property evidence at the domain-integration level.
 *
 * Unlike the P3-T5 unit suite (single-codepoint cases inside
 * packages/domain/compatibility), this file pins the closed
 * requirement-type × complete-mode × availability cube as one property,
 * proves the `complete` key is an optional default (absent ≡ explicit false,
 * byte-identical canonical results), and verifies the FATAL reason codes
 * against the frozen contracts-v1 vocabulary across module boundaries
 * (compatibility engine ⇄ contracts).
 *
 * Authority: Architecture §13.5 (complete:true persona ⇒
 * TEAM_PERSONA_COMPLETE_PRESET_CONFLICT, structural FATAL), §27.1 (closed
 * requirement-type vocabulary), §27.2 (complete:true unmet ⇒ mandatory FATAL,
 * no downgrade, no Continue Anyway), §28 (admission states); contracts v1
 * (reason codes frozen); Development Plan §16.4 G3-5.
 */

import { describe, expect, it } from 'vitest'

import { TeamContractErrorCode } from '../../contracts/src/index.js'
import {
  ACK_STATUSES,
  COMPATIBILITY_REASON_CODES,
  COMPATIBILITY_STATUS,
  REQUIREMENT_TYPES,
  evaluateCompatibility,
  serializeCompatibilityResult,
} from '../../domain/compatibility/src/index.js'
import type {
  CompatibilityResult,
  EnvironmentFact,
  RequirementInput,
  RequirementType,
  WarningAcknowledgement,
} from '../../domain/compatibility/src/index.js'
import {
  COMPLETE_PERSONA_REQUIREMENT,
  COMPLETE_TOOL_REQUIREMENT,
} from '../../domain/compatibility/fixtures/requirements.js'
import { COMPLETE_PERSONA_CONFLICT_FACTS } from '../../domain/compatibility/fixtures/environment-facts.js'

const OPERATOR = 't6-operator'
const ACKED_AT = '2026-08-29T12:00:00.000Z'

/** Build an ack bound to the exact mismatch/environment generation of `result`. */
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

/** The complete:true tool requirement's subject unavailable (t5 uses the same inline shape). */
const DELEGATE_TOOL_UNAVAILABLE_FACTS: readonly EnvironmentFact[] = [
  { domain: 'tool', subject: 'delegate', available: false, generation: 1 },
]

/** The three textual forms of the optional `complete` key. */
type CompleteMode = 'absent' | 'false' | 'true'
const COMPLETE_MODES: readonly CompleteMode[] = ['absent', 'false', 'true']

interface CellExpectation {
  outcome: string
  reasonCode: string
  status: string
}

/**
 * The fixed classification matrix (engine order: complete dominates, then
 * structural types, then ordinary capability mismatch):
 *
 * - available            => PASS / SATISFIED / OPEN
 * - !available & complete => FATAL / (persona ? TEAM_PERSONA_COMPLETE_PRESET_CONFLICT
 *                                       : COMPLETE_REQUIREMENT_NOT_MET) / BLOCKED_FATAL
 * - !available & teamStructure => FATAL / STRUCTURAL_CAPABILITY_MISSING / BLOCKED_FATAL
 * - !available & persona    => FATAL / PERSONA_INCOMPATIBLE / BLOCKED_FATAL
 * - !available & ordinary   => WARNING / CAPABILITY_UNAVAILABLE / BLOCKED_WARNING
 */
function expectedCell(type: RequirementType, complete: boolean, available: boolean): CellExpectation {
  if (available) {
    return {
      outcome: 'PASS',
      reasonCode: COMPATIBILITY_REASON_CODES.SATISFIED,
      status: COMPATIBILITY_STATUS.OPEN,
    }
  }
  if (complete) {
    return {
      outcome: 'FATAL',
      reasonCode:
        type === 'persona'
          ? COMPATIBILITY_REASON_CODES.TEAM_PERSONA_COMPLETE_PRESET_CONFLICT
          : COMPATIBILITY_REASON_CODES.COMPLETE_REQUIREMENT_NOT_MET,
      status: COMPATIBILITY_STATUS.BLOCKED_FATAL,
    }
  }
  if (type === 'teamStructure') {
    return {
      outcome: 'FATAL',
      reasonCode: COMPATIBILITY_REASON_CODES.STRUCTURAL_CAPABILITY_MISSING,
      status: COMPATIBILITY_STATUS.BLOCKED_FATAL,
    }
  }
  if (type === 'persona') {
    return {
      outcome: 'FATAL',
      reasonCode: COMPATIBILITY_REASON_CODES.PERSONA_INCOMPATIBLE,
      status: COMPATIBILITY_STATUS.BLOCKED_FATAL,
    }
  }
  return {
    outcome: 'WARNING',
    reasonCode: COMPATIBILITY_REASON_CODES.CAPABILITY_UNAVAILABLE,
    status: COMPATIBILITY_STATUS.BLOCKED_WARNING,
  }
}

describe('P3-T6 G3-5 complete:true compatibility fatal (cross-module)', () => {
  it('complete:true persona unmet -> FATAL with the exact frozen contracts-v1 code', () => {
    const result = evaluateCompatibility({
      requirements: [COMPLETE_PERSONA_REQUIREMENT],
      environmentFacts: COMPLETE_PERSONA_CONFLICT_FACTS,
    })
    expect(result.status).toBe(COMPATIBILITY_STATUS.BLOCKED_FATAL)
    const persona = result.requirements.find((entry) => entry.requirementId === 'req-persona-complete')
    if (persona === undefined) throw new Error('persona requirement missing from result')
    expect(persona.outcome).toBe('FATAL')
    expect(persona.complete).toBe(true)
    expect(persona.reasonCode).toBe(COMPATIBILITY_REASON_CODES.TEAM_PERSONA_COMPLETE_PRESET_CONFLICT)
    expect(persona.reasonCode).toBe(TeamContractErrorCode.TEAM_PERSONA_COMPLETE_PRESET_CONFLICT)
    expect(persona.unavailableSubjects).toEqual(['cordis-preset'])
    expect(persona.detail).toBe(
      'complete:true persona requirement unmet: cordis-preset (structural FATAL, not downgradeable)',
    )
    expect(result.counts.fatal).toBe(1)
    expect(result.counts.pass).toBe(0)
    expect(result.counts.warning).toBe(0)
  })

  it('complete:true on an ordinary (tool) requirement -> FATAL COMPLETE_REQUIREMENT_NOT_MET (complete dominates type)', () => {
    const result = evaluateCompatibility({
      requirements: [COMPLETE_TOOL_REQUIREMENT],
      environmentFacts: DELEGATE_TOOL_UNAVAILABLE_FACTS,
    })
    expect(result.status).toBe(COMPATIBILITY_STATUS.BLOCKED_FATAL)
    const tool = result.requirements.find((entry) => entry.requirementId === 'req-tool-delegate-complete')
    if (tool === undefined) throw new Error('tool requirement missing from result')
    expect(tool.outcome).toBe('FATAL')
    expect(tool.complete).toBe(true)
    expect(tool.reasonCode).toBe(COMPATIBILITY_REASON_CODES.COMPLETE_REQUIREMENT_NOT_MET)
    expect(tool.unavailableSubjects).toEqual(['delegate'])
    expect(tool.detail.indexOf('complete:true requirement unmet')).toBeGreaterThan(-1)
    expect(result.counts.fatal).toBe(1)
  })

  it('an ack bound to a complete:true FATAL cannot downgrade it (no Continue Anyway)', () => {
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
    const unapplied = second.unappliedAcknowledgements[0]
    if (unapplied === undefined) throw new Error('unapplied ack list empty')
    expect(unapplied.requirementId).toBe('req-persona-complete')
    // The engine refuses the ack by classification, not by shape: the FATAL
    // row and every count are identical to the ack-free evaluation, and the
    // rejected ack is preserved verbatim in unappliedAcknowledgements.
    const firstPersona = first.requirements.find((entry) => entry.requirementId === 'req-persona-complete')
    if (firstPersona === undefined) throw new Error('persona requirement missing from first result')
    expect(persona).toEqual(firstPersona)
    expect(second.counts).toEqual(first.counts)
    expect(unapplied).toEqual(ack)
  })

  it('a satisfied complete:true requirement is PASS/SATISFIED and admits (OPEN)', () => {
    const result = evaluateCompatibility({
      requirements: [COMPLETE_PERSONA_REQUIREMENT],
      environmentFacts: [{ domain: 'persona', subject: 'cordis-preset', available: true, generation: 2 }],
    })
    expect(result.status).toBe(COMPATIBILITY_STATUS.OPEN)
    const persona = result.requirements.find((entry) => entry.requirementId === 'req-persona-complete')
    if (persona === undefined) throw new Error('persona requirement missing from result')
    expect(persona.outcome).toBe('PASS')
    expect(persona.complete).toBe(true)
    expect(persona.reasonCode).toBe(COMPATIBILITY_REASON_CODES.SATISFIED)
    expect(persona.mismatchFingerprint).toBe(null)
    expect(persona.acknowledgement).toBe(null)
    expect(result.counts.pass).toBe(1)
    expect(result.counts.fatal).toBe(0)
  })

  it('exhaustive 36-cell cube: type x complete-mode x available -> fixed outcome/reason/status, absent==false byte-equal', () => {
    const types = Object.values(REQUIREMENT_TYPES)
    expect(types.length).toBe(6)
    expect(REQUIREMENT_TYPES.tool).toBe('tool')
    expect(REQUIREMENT_TYPES.mcpServer).toBe('mcpServer')
    expect(REQUIREMENT_TYPES.teamStructure).toBe('teamStructure')
    // Canonical results of the `absent` mode, keyed by (type, available), to
    // assert the optional-key default is byte-identical to explicit false.
    const absentCanonical = new Map<string, string>()
    let cells = 0
    let passCount = 0
    let warningCount = 0
    let fatalCount = 0
    for (const type of types) {
      for (const mode of COMPLETE_MODES) {
        for (const available of [false, true]) {
          cells += 1
          const requirement: RequirementInput =
            mode === 'true'
              ? { requirementId: `req-${type}-t-${available ? 'a' : 'n'}`, type, subjects: ['subj-x'], complete: true }
              : mode === 'false'
                ? { requirementId: `req-${type}-${available ? 'a' : 'n'}`, type, subjects: ['subj-x'], complete: false }
                : { requirementId: `req-${type}-${available ? 'a' : 'n'}`, type, subjects: ['subj-x'] }
          const fact: EnvironmentFact = { domain: type, subject: 'subj-x', available, generation: 1 }
          const result = evaluateCompatibility({ requirements: [requirement], environmentFacts: [fact] })
          const expected = expectedCell(type, mode === 'true', available)
          expect(result.status).toBe(expected.status)
          const entry = result.requirements[0]
          if (entry === undefined) throw new Error('single-requirement result lost its row')
          expect(entry.requirementId).toBe(requirement.requirementId)
          expect(entry.type).toBe(type)
          expect(entry.complete).toBe(mode === 'true')
          expect(entry.outcome).toBe(expected.outcome)
          expect(entry.reasonCode).toBe(expected.reasonCode)
          expect(entry.unavailableSubjects).toEqual(available ? [] : ['subj-x'])
          expect(result.counts.pass + result.counts.warning + result.counts.fatal).toBe(
            result.requirements.length,
          )
          if (available) {
            expect(entry.mismatchFingerprint).toBe(null)
            expect(entry.acknowledgement).toBe(null)
          } else {
            expect(typeof entry.mismatchFingerprint).toBe('string')
            if (expected.outcome === 'WARNING') {
              if (entry.acknowledgement === null) throw new Error('WARNING row missing ack ref')
              expect(entry.acknowledgement.status).toBe(ACK_STATUSES.MISSING)
              expect(entry.acknowledgement.acknowledgement).toBe(null)
            } else {
              expect(entry.acknowledgement).toBe(null)
            }
          }
          if (expected.outcome === 'PASS') passCount += 1
          else if (expected.outcome === 'WARNING') warningCount += 1
          else fatalCount += 1
          const key = `${type}|${available ? 'a' : 'n'}`
          const canonical = serializeCompatibilityResult(result)
          if (mode === 'absent') {
            absentCanonical.set(key, canonical)
          } else if (mode === 'false') {
            const baseline = absentCanonical.get(key)
            if (baseline === undefined) throw new Error('absent-mode baseline missing for cube cell')
            expect(canonical).toBe(baseline)
          }
        }
      }
    }
    expect(cells).toBe(36)
    // 6 types × 3 modes available=TRUE      -> 18 PASS
    // 6 types × mode=true available=FALSE   ->  6 FATAL (1 persona-conflict, 5 complete-not-met)
    // {teamStructure,persona} × 2 modes FALSE -> 4 FATAL
    // 4 ordinary types × 2 modes FALSE       ->  8 WARNING
    expect(passCount).toBe(18)
    expect(fatalCount).toBe(10)
    expect(warningCount).toBe(8)
    expect(absentCanonical.size).toBe(12)
  })

  it('the complete-true conflict result is deterministic and canonical-JSON round-trips', () => {
    const first = evaluateCompatibility({
      requirements: [COMPLETE_PERSONA_REQUIREMENT],
      environmentFacts: COMPLETE_PERSONA_CONFLICT_FACTS,
    })
    const second = evaluateCompatibility({
      requirements: [COMPLETE_PERSONA_REQUIREMENT],
      environmentFacts: COMPLETE_PERSONA_CONFLICT_FACTS,
    })
    const firstJson = serializeCompatibilityResult(first)
    const secondJson = serializeCompatibilityResult(second)
    expect(firstJson).toBe(secondJson)
    const parsed = JSON.parse(firstJson)
    expect(parsed).toEqual(first)
    expect(first.environmentFingerprint).toEqual(second.environmentFingerprint)
    expect(typeof first.environmentFingerprint).toBe('string')
    expect(first.counts).toEqual({
      pass: 0,
      warning: 0,
      fatal: 1,
      unackedWarning: 0,
      staleAcknowledgement: 0,
    })
  })
})
