/**
 * pre-alpha3 PR-E (plan §E.3) — E.11 suite `persona-requirement-v2`:
 * the v2 persona-TYPE requirement is the §E.3 required-persona carrier. Its
 * subjects name the REQUIRED persona KIND (the persona KIND convention —
 * this increment: `standard`), and the world facts report the OBSERVED kind.
 * This suite pins the engine's persona-lane behavior over the re-keyed
 * convention:
 *   - required `standard` observed (a `persona/standard` available fact) →
 *     PASS;
 *   - `complete:true` + the world provides a `complete` persona fact (but
 *     not the required `standard`) → FATAL with the FROZEN CONFLICT code
 *     (TEAM_PERSONA_COMPLETE_PRESET_CONFLICT — the structural §13.5
 *     conflict: the mounted preset's effective persona IS a complete
 *     section);
 *   - `complete:true` + a BARE world (no persona fact) → FATAL with the
 *     honest PERSONA_INCOMPATIBLE (the required kind is simply absent);
 *   - a `standard` fact present but UNAVAILABLE → FATAL PERSONA_INCOMPATIBLE.
 * The CONFLICT key is a TYPED subject comparison (the world fact's subject
 * is the observed kind), never a free-text detail parse.
 *
 * @module @dsh-agent-team/runtime/test/persona-requirement-v2
 */

import { describe, expect, it } from 'vitest'

import {
  COMPATIBILITY_REASON_CODES,
  evaluateCompatibility,
  type EnvironmentFact,
  type RequirementInput,
} from '../../domain/compatibility/src/index.js'

function personaStd(complete: boolean): RequirementInput {
  return { requirementId: 'req-persona', type: 'persona', subjects: ['standard'], ...(complete ? { complete: true } : {}) }
}

const fact = (subject: string, available: boolean): EnvironmentFact => ({
  domain: 'persona',
  subject,
  available,
  generation: 0,
})

describe('E.11 persona-requirement-v2: the engine persona lane (KIND convention)', () => {
  it('PASSES when the required `standard` kind is observed (available)', () => {
    const result = evaluateCompatibility({
      requirements: [personaStd(false)],
      environmentFacts: [fact('standard', true)],
    })
    expect(result.requirements[0]?.outcome).toBe('PASS')
    expect(result.requirements[0]?.reasonCode).toBe(COMPATIBILITY_REASON_CODES.SATISFIED)
  })

  it('FATALs with the FROZEN CONFLICT code when complete:true and the world provides a `complete` persona fact', () => {
    const result = evaluateCompatibility({
      requirements: [personaStd(true)],
      // The mounted preset's effective persona IS a complete section (the
      // world reports the OBSERVED kind `complete`), but the required
      // `standard` kind is not observed → the structural §13.5 conflict.
      environmentFacts: [fact('complete', true)],
    })
    expect(result.requirements[0]?.outcome).toBe('FATAL')
    expect(result.requirements[0]?.reasonCode).toBe(COMPATIBILITY_REASON_CODES.TEAM_PERSONA_COMPLETE_PRESET_CONFLICT)
    expect(result.requirements[0]?.unavailableSubjects).toEqual(['standard'])
  })

  it('FATALs with the honest PERSONA_INCOMPATIBLE when complete:true and the world is BARE (no persona fact)', () => {
    const result = evaluateCompatibility({
      requirements: [personaStd(true)],
      environmentFacts: [],
    })
    expect(result.requirements[0]?.outcome).toBe('FATAL')
    expect(result.requirements[0]?.reasonCode).toBe(COMPATIBILITY_REASON_CODES.PERSONA_INCOMPATIBLE)
    expect(result.requirements[0]?.unavailableSubjects).toEqual(['standard'])
  })

  it('FATALs PERSONA_INCOMPATIBLE when the `standard` fact is present but UNAVAILABLE', () => {
    const result = evaluateCompatibility({
      requirements: [personaStd(false)],
      environmentFacts: [fact('standard', false)],
    })
    expect(result.requirements[0]?.outcome).toBe('FATAL')
    expect(result.requirements[0]?.reasonCode).toBe(COMPATIBILITY_REASON_CODES.PERSONA_INCOMPATIBLE)
  })

  it('PASSES with no world facts for a NON-persona optional requirement (the WARNING lane is untouched)', () => {
    const result = evaluateCompatibility({
      requirements: [{ requirementId: 'req-mcp', type: 'mcpServer', subjects: ['srv-x'] }],
      environmentFacts: [],
    })
    expect(result.requirements[0]?.outcome).toBe('WARNING')
    expect(result.requirements[0]?.reasonCode).toBe(COMPATIBILITY_REASON_CODES.CAPABILITY_UNAVAILABLE)
  })
})
