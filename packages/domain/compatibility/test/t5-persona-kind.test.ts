/**
 * Persona KIND convention (the P5-T2 subject decision, revised by the
 * team-persona-requirement-preset-id bug report, direction B): persona
 * requirement subjects are persona KINDS (absent|standard|complete), never
 * preset ids, and the unmet-persona reason code is WORLD-driven:
 *
 * - a probe world providing a `complete` persona kind => the frozen
 *   contracts-v1 code TEAM_PERSONA_COMPLETE_PRESET_CONFLICT (the code
 *   names a fact about the environment; it is reported only when the
 *   world says so) — for complete:true AND non-complete persona
 *   requirements alike (a complete world cannot satisfy ANY persona
 *   requirement);
 * - any other unmet persona world (an unavailable `standard`, an
 *   `absent` kind, or no persona fact at all) => PERSONA_INCOMPATIBLE
 *   (Architecture §27.2: persona identity cannot be installed safely);
 * - the detail always states the required kind(s) AND the probe-world
 *   persona kind(s), so the diagnosis is self-contained (the user can
 *   read the mismatch without the source).
 *
 * Authority: Architecture §13.5, §27.1, §27.2; contracts v1 (frozen code
 * vocabulary); bug report docs/issues/team-persona-requirement-preset-id-
 * bug-report.md.
 */

import { describe, expect, it } from 'vitest'

import { TeamContractErrorCode } from '../../../contracts/src/index.js'
import {
  COMPATIBILITY_REASON_CODES,
  COMPATIBILITY_STATUS,
  PERSONA_KINDS,
  evaluateCompatibility,
  isPersonaKind,
} from '../src/index.js'
import type { CompatibilityResult, EnvironmentFact } from '../src/index.js'

function requirePersona(result: CompatibilityResult): {
  outcome: string
  reasonCode: string
  detail: string
  unavailableSubjects: readonly string[]
} {
  const row = result.requirements.find((entry) => entry.requirementId === 'req-persona')
  if (row === undefined) throw new Error('persona requirement missing from result')
  return {
    outcome: row.outcome,
    reasonCode: row.reasonCode,
    detail: row.detail,
    unavailableSubjects: row.unavailableSubjects,
  }
}

const STANDARD_REQ = { requirementId: 'req-persona', type: 'persona' as const, subjects: ['standard'] }
const STANDARD_REQ_COMPLETE = { ...STANDARD_REQ, complete: true }

describe('persona kind convention: closed vocabulary', () => {
  it('PERSONA_KINDS is the closed three-state (§13.5)', () => {
    expect(PERSONA_KINDS.absent).toBe('absent')
    expect(PERSONA_KINDS.standard).toBe('standard')
    expect(PERSONA_KINDS.complete).toBe('complete')
    expect(Object.values(PERSONA_KINDS)).toHaveLength(3)
  })

  it('isPersonaKind accepts exactly the three kinds (rejects preset ids and lookalikes)', () => {
    expect(isPersonaKind('absent')).toBe(true)
    expect(isPersonaKind('standard')).toBe(true)
    expect(isPersonaKind('complete')).toBe(true)
    // Preset ids (the pre-fix subject convention) and lookalikes are not kinds.
    expect(isPersonaKind('team-small-ctx')).toBe(false)
    expect(isPersonaKind('cordis-preset')).toBe(false)
    expect(isPersonaKind('Standard')).toBe(false)
    expect(isPersonaKind('complete:true')).toBe(false)
    expect(isPersonaKind('')).toBe(false)
    expect(isPersonaKind(42)).toBe(false)
    expect(isPersonaKind(null)).toBe(false)
  })
})

describe('persona kind convention: world-driven FATAL classification', () => {
  it('complete world + complete:true requirement -> FATAL with the frozen contracts-v1 code', () => {
    const result = evaluateCompatibility({
      requirements: [STANDARD_REQ_COMPLETE],
      environmentFacts: [{ domain: 'persona', subject: 'complete', available: false, generation: 1 }],
    })
    expect(result.status).toBe(COMPATIBILITY_STATUS.BLOCKED_FATAL)
    const persona = requirePersona(result)
    expect(persona.outcome).toBe('FATAL')
    expect(persona.reasonCode).toBe(COMPATIBILITY_REASON_CODES.TEAM_PERSONA_COMPLETE_PRESET_CONFLICT)
    expect(persona.reasonCode).toBe(TeamContractErrorCode.TEAM_PERSONA_COMPLETE_PRESET_CONFLICT)
    expect(persona.unavailableSubjects).toEqual(['standard'])
    expect(persona.detail).toBe(
      'complete:true persona requirement unmet: standard; probe world persona kind(s): complete (unavailable) (structural FATAL, not downgradeable)',
    )
  })

  it('complete world + NON-complete requirement -> the same frozen code (a complete world cannot satisfy ANY persona requirement)', () => {
    const result = evaluateCompatibility({
      requirements: [STANDARD_REQ],
      environmentFacts: [{ domain: 'persona', subject: 'complete', available: false, generation: 1 }],
    })
    expect(result.status).toBe(COMPATIBILITY_STATUS.BLOCKED_FATAL)
    const persona = requirePersona(result)
    expect(persona.outcome).toBe('FATAL')
    expect(persona.reasonCode).toBe(COMPATIBILITY_REASON_CODES.TEAM_PERSONA_COMPLETE_PRESET_CONFLICT)
    expect(persona.detail).toBe(
      'persona requirement unmet: standard; probe world persona kind(s): complete (unavailable) (structural FATAL, not downgradeable)',
    )
  })

  it('unavailable standard world + complete:true requirement -> PERSONA_INCOMPATIBLE (the world does not say complete)', () => {
    const result = evaluateCompatibility({
      requirements: [STANDARD_REQ_COMPLETE],
      environmentFacts: [{ domain: 'persona', subject: 'standard', available: false, generation: 1 }],
    })
    expect(result.status).toBe(COMPATIBILITY_STATUS.BLOCKED_FATAL)
    const persona = requirePersona(result)
    expect(persona.outcome).toBe('FATAL')
    expect(persona.reasonCode).toBe(COMPATIBILITY_REASON_CODES.PERSONA_INCOMPATIBLE)
    expect(persona.detail).toBe(
      'complete:true persona requirement unmet: standard; probe world persona kind(s): standard (unavailable) (structural FATAL, not downgradeable)',
    )
  })

  it('absent-kind world -> PERSONA_INCOMPATIBLE with the absent kind in the detail', () => {
    const result = evaluateCompatibility({
      requirements: [STANDARD_REQ],
      environmentFacts: [{ domain: 'persona', subject: 'absent', available: false, generation: 1 }],
    })
    const persona = requirePersona(result)
    expect(persona.outcome).toBe('FATAL')
    expect(persona.reasonCode).toBe(COMPATIBILITY_REASON_CODES.PERSONA_INCOMPATIBLE)
    expect(persona.detail).toBe(
      'persona requirement unmet: standard; probe world persona kind(s): absent (unavailable) (structural FATAL, not downgradeable)',
    )
  })

  it('no persona fact at all -> PERSONA_INCOMPATIBLE naming the missing fact', () => {
    const result = evaluateCompatibility({
      requirements: [STANDARD_REQ_COMPLETE],
      environmentFacts: [],
    })
    expect(result.status).toBe(COMPATIBILITY_STATUS.BLOCKED_FATAL)
    const persona = requirePersona(result)
    expect(persona.outcome).toBe('FATAL')
    expect(persona.reasonCode).toBe(COMPATIBILITY_REASON_CODES.PERSONA_INCOMPATIBLE)
    expect(persona.detail).toBe(
      'complete:true persona requirement unmet: standard; no persona fact in the probe world (structural FATAL, not downgradeable)',
    )
  })

  it('multiple world kinds are all listed, sorted, in the detail', () => {
    const result = evaluateCompatibility({
      requirements: [STANDARD_REQ],
      environmentFacts: [
        { domain: 'persona', subject: 'complete', available: false, generation: 1 },
        { domain: 'persona', subject: 'standard', available: true, generation: 1 },
      ],
    })
    // The required `standard` kind IS available -> PASS; the world's extra
    // complete kind is irrelevant to a satisfied requirement.
    const persona = requirePersona(result)
    expect(persona.outcome).toBe('PASS')
    const unmet = evaluateCompatibility({
      requirements: [{ requirementId: 'req-persona', type: 'persona', subjects: ['complete'] }],
      environmentFacts: [
        { domain: 'persona', subject: 'complete', available: false, generation: 1 },
        { domain: 'persona', subject: 'standard', available: true, generation: 1 },
      ],
    })
    expect(unmet.requirements[0]?.detail).toBe(
      'persona requirement unmet: complete; probe world persona kind(s): complete (unavailable), standard (available) (structural FATAL, not downgradeable)',
    )
  })

  it('available standard world + standard requirement -> PASS (the composable case, any preset id)', () => {
    const result = evaluateCompatibility({
      requirements: [STANDARD_REQ_COMPLETE],
      environmentFacts: [{ domain: 'persona', subject: 'standard', available: true, generation: 2 }],
    })
    expect(result.status).toBe(COMPATIBILITY_STATUS.OPEN)
    const persona = requirePersona(result)
    expect(persona.outcome).toBe('PASS')
    expect(persona.reasonCode).toBe(COMPATIBILITY_REASON_CODES.SATISFIED)
    expect(persona.unavailableSubjects).toEqual([])
  })

  it('the engine stays subject-generic: an id-shaped subject that the world provides still passes (convention enforcement lives in the blueprint layer, not here)', () => {
    const result = evaluateCompatibility({
      requirements: [{ requirementId: 'req-persona', type: 'persona', subjects: ['team-small-ctx'] }],
      environmentFacts: [{ domain: 'persona', subject: 'team-small-ctx', available: true, generation: 1 }],
    })
    expect(result.status).toBe(COMPATIBILITY_STATUS.OPEN)
    expect(requirePersona(result).outcome).toBe('PASS')
  })
})
