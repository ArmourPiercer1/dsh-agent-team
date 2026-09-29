/**
 * pre-alpha3 PR-E / review fix F4 — the `RuntimeSubstratePlan` root/member
 * persona structure (guide §5 A: the plan is `root:{presetId, persona}` +
 * `member:{presetId, persona}` — NOT a single `personaKind`).
 *
 * The cases (guide §5):
 *
 * - standard + standard (the shipped composable state);
 * - minimal + minimal (both roles the web-bundle complete preset — the §13.5
 *   structural conflict on BOTH roles);
 * - standard + minimal (the mixed case — root composable, member in
 *   conflict);
 * - minimal + standard (the inverse mixed case);
 * - ptc composable (the plain team composition);
 * - dynamic disabled → unresolved (a typed conditional — never guessed);
 * - a host preset service failure → a typed host failure (propagated, never
 *   swallowed into a kind);
 * - cold resume: the OBSERVED plan equals the ACTUAL preset (the config
 *   id is the authority — the legacy hardcoded `standard` seam guess is
 *   gone; guide §17 R7: `rootPresetId=minimal` must observe as complete,
 *   NOT as standard).
 * @module @dsh-agent-team/runtime/test/runtime-substrate-root-member-persona.test
 */

import { describe, expect, it } from 'vitest'
import {
  PERSONA_OBSERVATION_SOURCES,
  resolveRuntimeSubstrate,
  type PersonaKindObservation,
} from '../agent-setup/preset/index.js'

const STANDARD: PersonaKindObservation = { kind: 'standard', source: PERSONA_OBSERVATION_SOURCES.effectiveComposition }
const COMPLETE: PersonaKindObservation = { kind: 'complete', source: PERSONA_OBSERVATION_SOURCES.compositionText }
const ABSENT: PersonaKindObservation = { kind: 'absent', source: PERSONA_OBSERVATION_SOURCES.effectiveComposition }
const UNRESOLVED: PersonaKindObservation = {
  kind: 'unresolved',
  source: PERSONA_OBSERVATION_SOURCES.none,
  reason: 'host preset service failure: compositionInventory rejected (service down)',
}

/** A probe from a (presetId → observation) table. */
function fromTable(table: Record<string, PersonaKindObservation>): (presetId: string) => PersonaKindObservation {
  return (presetId: string) =>
    table[presetId] ?? { kind: 'unresolved', source: PERSONA_OBSERVATION_SOURCES.none, reason: `unobserved preset '${presetId}'` }
}

describe('guide §5 A — the root/member plan structure', () => {
  it('standard + standard (the shipped composable state)', async () => {
    const plan = await resolveRuntimeSubstrate({
      rootPresetId: 'standard',
      memberPresetId: undefined,
      deploymentDefaultPresetId: 'standard',
      observePersonaKind: fromTable({ standard: STANDARD }),
    })
    expect(plan.root.presetId).toBe('standard')
    expect(plan.root.persona.kind).toBe('standard')
    expect(plan.member.presetId).toBe('standard')
    expect(plan.member.persona.kind).toBe('standard')
  })

  it('minimal + minimal (both roles the web-bundle complete preset — the §13.5 conflict on BOTH)', async () => {
    const plan = await resolveRuntimeSubstrate({
      rootPresetId: 'minimal',
      memberPresetId: 'minimal',
      deploymentDefaultPresetId: 'minimal',
      observePersonaKind: fromTable({ minimal: COMPLETE }),
    })
    expect(plan.root.presetId).toBe('minimal')
    expect(plan.root.persona.kind).toBe('complete')
    expect(plan.member.presetId).toBe('minimal')
    expect(plan.member.persona.kind).toBe('complete')
  })

  it('standard + minimal (root composable, member in conflict)', async () => {
    const plan = await resolveRuntimeSubstrate({
      rootPresetId: 'standard',
      memberPresetId: 'minimal',
      deploymentDefaultPresetId: 'standard',
      observePersonaKind: fromTable({ standard: STANDARD, minimal: COMPLETE }),
    })
    expect(plan.root.persona.kind).toBe('standard')
    expect(plan.member.persona.kind).toBe('complete')
    // Distinct roles carry distinct observations (no shared single kind).
    expect(plan.member.persona).not.toBe(plan.root.persona)
  })

  it('minimal + standard (the inverse mixed case)', async () => {
    const plan = await resolveRuntimeSubstrate({
      rootPresetId: 'minimal',
      memberPresetId: 'standard',
      deploymentDefaultPresetId: 'minimal',
      observePersonaKind: fromTable({ standard: STANDARD, minimal: COMPLETE }),
    })
    expect(plan.root.persona.kind).toBe('complete')
    expect(plan.member.persona.kind).toBe('standard')
  })

  it('ptc composable (the plain team composition)', async () => {
    const plan = await resolveRuntimeSubstrate({
      rootPresetId: 'ptc',
      memberPresetId: 'ptc',
      deploymentDefaultPresetId: 'ptc',
      observePersonaKind: fromTable({ ptc: STANDARD }),
    })
    expect(plan.root.persona.kind).toBe('standard')
    expect(plan.member.persona.kind).toBe('standard')
  })
})

describe('guide §5 B — the fail-closed observations', () => {
  it('a dynamic disabled persona observes unresolved (typed — never a kind guess)', async () => {
    const plan = await resolveRuntimeSubstrate({
      rootPresetId: 'dynamic',
      memberPresetId: 'dynamic',
      deploymentDefaultPresetId: 'dynamic',
      observePersonaKind: fromTable({
        dynamic: {
          kind: 'unresolved',
          source: PERSONA_OBSERVATION_SOURCES.compositionText,
          reason: 'the persona row (or an ancestor group) carries a !!js conditional disable — not evaluatable offline',
        },
      }),
    })
    expect(plan.root.persona.kind).toBe('unresolved')
    expect(plan.root.persona.reason).toContain('!!js')
    expect(plan.member.persona.kind).toBe('unresolved')
  })

  it('a host preset service failure is a typed host failure (propagated, never swallowed)', async () => {
    await expect(
      resolveRuntimeSubstrate({
        rootPresetId: 'any',
        memberPresetId: undefined,
        deploymentDefaultPresetId: 'any',
        observePersonaKind: async () => {
          throw new Error('host preset service failure: agentPresets unavailable')
        },
      }),
    ).rejects.toThrowError(/host preset service failure/)
  })

  it('an unobserved preset is typed unresolved (the false-OPEN is closed)', async () => {
    const plan = await resolveRuntimeSubstrate({
      rootPresetId: 'unknown-preset',
      memberPresetId: undefined,
      deploymentDefaultPresetId: 'unknown-preset',
      observePersonaKind: fromTable({}),
    })
    expect(plan.root.persona.kind).toBe('unresolved')
    expect(plan.root.persona.reason).toContain('unknown-preset')
    expect(plan.member.persona.kind).toBe('unresolved')
  })
})

describe('guide §17 R7 — cold resume: the observed plan equals the ACTUAL preset', () => {
  it('rootPresetId=minimal observes COMPLETE (not the legacy hardcoded standard seam guess)', async () => {
    // The legacy seam hardcoded {presetId: 'dsh-agent-team', personaKind:
    // 'standard'} for BOTH roles — the shipped-state guess F4 closes. The
    // plan must reflect the PRESET ACTUALLY NAMED: minimal's effective
    // persona is complete (the §13.5 structural conflict), so a minimal
    // root MUST observe as complete.
    const plan = await resolveRuntimeSubstrate({
      rootPresetId: 'minimal',
      memberPresetId: undefined,
      deploymentDefaultPresetId: 'minimal',
      observePersonaKind: fromTable({ minimal: COMPLETE }),
    })
    expect(plan.root.presetId).toBe('minimal')
    expect(plan.root.persona.kind).toBe('complete')
    expect(plan.member.presetId).toBe('minimal')
    expect(plan.member.persona.kind).toBe('complete')
  })

  it('guide §17 R8: the member observation follows the member preset (not the root)', async () => {
    const plan = await resolveRuntimeSubstrate({
      rootPresetId: 'standard',
      memberPresetId: 'minimal',
      deploymentDefaultPresetId: 'standard',
      observePersonaKind: fromTable({ standard: STANDARD, minimal: COMPLETE }),
    })
    // The member requirement must be checked against the member observation.
    expect(plan.member.persona.kind).toBe('complete')
    expect(plan.root.persona.kind).toBe('standard')
  })
})
