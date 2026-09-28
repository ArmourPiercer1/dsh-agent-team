/**
 * pre-alpha3 PR-C §C.2 — the RuntimeSubstrateResolver (plan §C.2): the
 * SINGLE authority for what the runtime WILL mount + the observed persona
 * kind.
 *
 * Locks the collapse of the four historical fact sources into ONE plan:
 * - the actual mount authority (`config.rootPresetId ?? deployment default`);
 * - the member preset (`config.memberPresetId ?? deployment default ?? root`);
 * - the OBSERVED persona kind of the mounted ROOT preset (members inherit it);
 * - the observation provenance (source + optional reason).
 *
 * The C.8 regression-donor cases (PR #22, reference-only — NOT cherry-picked)
 * are the characterization set: ptc → standard, minimal (web bundle) →
 * complete, bare (no persona) → absent, a dynamic conditional that cannot be
 * evaluated → unresolved (typed fail-closed, never a kind guess).
 *
 * Pure test: the mount authority + the persona-kind probe are injected ports.
 */
import { describe, expect, it } from 'vitest'
import {
  resolveRuntimeSubstrate,
  PERSONA_OBSERVATION_SOURCES,
  type PersonaKindObservation,
  type ResolveRuntimeSubstrateArgs,
} from '../agent-setup/preset/index.js'

const DEPLOYMENT_DEFAULT = 'dsh-agent-team'

function observeFromTable(table: Record<string, PersonaKindObservation>): ResolveRuntimeSubstrateArgs['observePersonaKind'] {
  return (presetId: string): PersonaKindObservation => {
    const observation = table[presetId]
    if (observation === undefined) {
      // A preset the table does not know about is a typed observation failure
      // (fail-closed, never a kind guess).
      return { kind: 'unresolved', source: PERSONA_OBSERVATION_SOURCES.none, reason: `no observation for preset '${presetId}'` }
    }
    return observation
  }
}

describe('PR-C C.2 — the runtime substrate resolver', () => {
  it('with no config id and a deployment default, the plan mounts the deployment default (the shipped state)', () => {
    const plan = resolveRuntimeSubstrate({
      rootPresetId: undefined,
      memberPresetId: undefined,
      deploymentDefaultPresetId: DEPLOYMENT_DEFAULT,
      observePersonaKind: observeFromTable({
        [DEPLOYMENT_DEFAULT]: { kind: 'standard', source: PERSONA_OBSERVATION_SOURCES.effectiveComposition },
      }),
    })
    expect(plan.rootPresetId).toBe(DEPLOYMENT_DEFAULT)
    expect(plan.memberPresetId).toBe(DEPLOYMENT_DEFAULT)
    expect(plan.personaKind).toBe('standard')
    expect(plan.personaObservation.source).toBe('effective-composition')
    expect(Object.isFrozen(plan)).toBe(true)
  })

  it('a config rootPresetId OVERRIDES the deployment default (the actual mount authority)', () => {
    const plan = resolveRuntimeSubstrate({
      rootPresetId: 'custom-root',
      memberPresetId: undefined,
      deploymentDefaultPresetId: DEPLOYMENT_DEFAULT,
      observePersonaKind: observeFromTable({
        'custom-root': { kind: 'standard', source: PERSONA_OBSERVATION_SOURCES.effectiveComposition },
      }),
    })
    expect(plan.rootPresetId).toBe('custom-root')
    // The member id defaults to the deployment default (NOT the root id).
    expect(plan.memberPresetId).toBe(DEPLOYMENT_DEFAULT)
  })

  it('a config memberPresetId is honored; absent it defaults to the deployment default, then the root id', () => {
    const explicit = resolveRuntimeSubstrate({
      rootPresetId: 'custom-root',
      memberPresetId: 'custom-member',
      deploymentDefaultPresetId: DEPLOYMENT_DEFAULT,
      observePersonaKind: observeFromTable({
        'custom-root': { kind: 'standard', source: PERSONA_OBSERVATION_SOURCES.effectiveComposition },
      }),
    })
    expect(explicit.memberPresetId).toBe('custom-member')
    const fallback = resolveRuntimeSubstrate({
      rootPresetId: 'custom-root',
      memberPresetId: undefined,
      deploymentDefaultPresetId: undefined,
      observePersonaKind: observeFromTable({
        'custom-root': { kind: 'standard', source: PERSONA_OBSERVATION_SOURCES.effectiveComposition },
      }),
    })
    // No deployment default → the member id falls back to the root id.
    expect(fallback.memberPresetId).toBe('custom-root')
  })

  it('NO root preset authority (config id absent + no deployment default) fails closed (MALFORMED_DTO)', () => {
    expect(() =>
      resolveRuntimeSubstrate({
        rootPresetId: undefined,
        memberPresetId: undefined,
        deploymentDefaultPresetId: undefined,
        observePersonaKind: observeFromTable({}),
      }),
    ).toThrowError(/no root preset authority/)
  })

  it('the observed kind is the ROOT preset\'s kind (members inherit it — the observation is of the mounted root)', () => {
    const plan = resolveRuntimeSubstrate({
      rootPresetId: 'custom-root',
      memberPresetId: 'custom-member',
      deploymentDefaultPresetId: DEPLOYMENT_DEFAULT,
      observePersonaKind: (presetId: string) =>
        presetId === 'custom-root'
          ? { kind: 'complete', source: PERSONA_OBSERVATION_SOURCES.effectiveComposition }
          : { kind: 'absent', source: PERSONA_OBSERVATION_SOURCES.none },
    })
    // The observation is of the ROOT preset (custom-root = complete), NOT the
    // member preset — even though the member preset would be absent.
    expect(plan.personaKind).toBe('complete')
  })
})

describe('PR-C C.8 — the persona-kind regression-donor cases (PR #22, reference-only)', () => {
  it('ptc (the plain team composition) observes standard (the compatible case)', () => {
    const plan = resolveRuntimeSubstrate({
      rootPresetId: 'ptc',
      memberPresetId: undefined,
      deploymentDefaultPresetId: DEPLOYMENT_DEFAULT,
      observePersonaKind: observeFromTable({
        ptc: { kind: 'standard', source: PERSONA_OBSERVATION_SOURCES.effectiveComposition },
      }),
    })
    expect(plan.personaKind).toBe('standard')
  })

  it('minimal (the web-bundle complete preset) observes complete (structural FATAL for Team, §13.5)', () => {
    const plan = resolveRuntimeSubstrate({
      rootPresetId: 'minimal',
      memberPresetId: undefined,
      deploymentDefaultPresetId: DEPLOYMENT_DEFAULT,
      observePersonaKind: observeFromTable({
        minimal: { kind: 'complete', source: PERSONA_OBSERVATION_SOURCES.effectiveComposition },
      }),
    })
    expect(plan.personaKind).toBe('complete')
  })

  it('bare (no persona row) observes absent', () => {
    const plan = resolveRuntimeSubstrate({
      rootPresetId: 'bare',
      memberPresetId: undefined,
      deploymentDefaultPresetId: DEPLOYMENT_DEFAULT,
      observePersonaKind: observeFromTable({
        bare: { kind: 'absent', source: PERSONA_OBSERVATION_SOURCES.effectiveComposition },
      }),
    })
    expect(plan.personaKind).toBe('absent')
  })

  it('a dynamic conditional that cannot be evaluated observes unresolved (typed fail-closed, never a kind guess)', () => {
    const plan = resolveRuntimeSubstrate({
      rootPresetId: 'dynamic',
      memberPresetId: undefined,
      deploymentDefaultPresetId: DEPLOYMENT_DEFAULT,
      observePersonaKind: observeFromTable({
        dynamic: {
          kind: 'unresolved',
          source: PERSONA_OBSERVATION_SOURCES.none,
          reason: 'conditional disable not evaluatable from the effective composition',
        },
      }),
    })
    expect(plan.personaKind).toBe('unresolved')
    expect(plan.personaObservation.reason).toContain('not evaluatable')
  })

  it('an unknown preset (the probe cannot observe it) is unresolved, NOT a kind guess (the false-OPEN is closed)', () => {
    const plan = resolveRuntimeSubstrate({
      rootPresetId: 'mystery',
      memberPresetId: undefined,
      deploymentDefaultPresetId: DEPLOYMENT_DEFAULT,
      observePersonaKind: observeFromTable({}),
    })
    expect(plan.personaKind).toBe('unresolved')
    expect(plan.personaObservation.source).toBe('none')
  })
})
