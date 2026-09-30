/**
 * pre-alpha3 PR-C §C.2 — the RuntimeSubstrateResolver (plan §C.2): the
 * SINGLE authority for what the runtime WILL mount + the observed persona
 * kind of EACH mounted preset (review fix F5: the root's AND the member's).
 *
 * Locks the collapse of the four historical fact sources into ONE plan:
 * - the actual mount authority (`config.rootPresetId ?? deployment default`);
 * - the member preset (`config.memberPresetId ?? deployment default ?? root`);
 * - the OBSERVED persona kind of the mounted ROOT preset (the bind-time
 *   persona reads this entry; members inherit the root's bind substrate,
 *   Architecture §13.1);
 * - the OBSERVED persona kind of the mounted MEMBER preset (the requirement
 *   authority checks member-template persona requirements against this
 *   entry — R8);
 * - the observation provenance (source + optional reason) per entry.
 *
 * The C.8 regression-donor cases (PR #22, reference-only — NOT cherry-picked)
 * are the characterization set: ptc → standard, minimal (web bundle) →
 * complete, bare (no persona) → absent, a dynamic conditional that cannot be
 * evaluated → unresolved (typed fail-closed, never a kind guess).
 *
 * Pure test: the mount authority + the persona-kind probe are injected ports
 * (the probe is async — the production observer reads the DSH public preset
 * seam, review fix F14).
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
  it('with no config id and a deployment default, the plan mounts the deployment default for BOTH roles (the shipped state)', async () => {
    const plan = await resolveRuntimeSubstrate({
      rootPresetId: undefined,
      memberPresetId: undefined,
      deploymentDefaultPresetId: DEPLOYMENT_DEFAULT,
      observePersonaKind: observeFromTable({
        [DEPLOYMENT_DEFAULT]: { kind: 'standard', source: PERSONA_OBSERVATION_SOURCES.effectiveComposition },
      }),
    })
    expect(plan.root.presetId).toBe(DEPLOYMENT_DEFAULT)
    expect(plan.member.presetId).toBe(DEPLOYMENT_DEFAULT)
    expect(plan.root.persona.kind).toBe('standard')
    expect(plan.member.persona.kind).toBe('standard')
    expect(plan.root.persona.source).toBe('effective-composition')
    // The shared id probes once: both entries carry the SAME frozen object.
    expect(plan.member.persona).toBe(plan.root.persona)
    expect(Object.isFrozen(plan)).toBe(true)
  })

  it('a config rootPresetId OVERRIDES the deployment default (the actual mount authority)', async () => {
    const plan = await resolveRuntimeSubstrate({
      rootPresetId: 'custom-root',
      memberPresetId: undefined,
      deploymentDefaultPresetId: DEPLOYMENT_DEFAULT,
      observePersonaKind: observeFromTable({
        'custom-root': { kind: 'standard', source: PERSONA_OBSERVATION_SOURCES.effectiveComposition },
      }),
    })
    expect(plan.root.presetId).toBe('custom-root')
    // The member id defaults to the deployment default (NOT the root id).
    expect(plan.member.presetId).toBe(DEPLOYMENT_DEFAULT)
  })

  it('a config memberPresetId is honored; absent it defaults to the deployment default, then the root id', async () => {
    const explicit = await resolveRuntimeSubstrate({
      rootPresetId: 'custom-root',
      memberPresetId: 'custom-member',
      deploymentDefaultPresetId: DEPLOYMENT_DEFAULT,
      observePersonaKind: observeFromTable({
        'custom-root': { kind: 'standard', source: PERSONA_OBSERVATION_SOURCES.effectiveComposition },
        'custom-member': { kind: 'standard', source: PERSONA_OBSERVATION_SOURCES.effectiveComposition },
      }),
    })
    expect(explicit.member.presetId).toBe('custom-member')
    const fallback = await resolveRuntimeSubstrate({
      rootPresetId: 'custom-root',
      memberPresetId: undefined,
      deploymentDefaultPresetId: undefined,
      observePersonaKind: observeFromTable({
        'custom-root': { kind: 'standard', source: PERSONA_OBSERVATION_SOURCES.effectiveComposition },
      }),
    })
    // No deployment default → the member id falls back to the root id.
    expect(fallback.member.presetId).toBe('custom-root')
  })

  it('NO root preset authority (config id absent + no deployment default) fails closed (MALFORMED_DTO)', async () => {
    await expect(
      resolveRuntimeSubstrate({
        rootPresetId: undefined,
        memberPresetId: undefined,
        deploymentDefaultPresetId: undefined,
        observePersonaKind: observeFromTable({}),
      }),
    ).rejects.toThrowError(/no root preset authority/)
  })

  it('each role is observed with ITS OWN preset (F5): root complete + member absent are both reported', async () => {
    const plan = await resolveRuntimeSubstrate({
      rootPresetId: 'custom-root',
      memberPresetId: 'custom-member',
      deploymentDefaultPresetId: DEPLOYMENT_DEFAULT,
      observePersonaKind: (presetId: string) =>
        presetId === 'custom-root'
          ? { kind: 'complete', source: PERSONA_OBSERVATION_SOURCES.effectiveComposition }
          : { kind: 'absent', source: PERSONA_OBSERVATION_SOURCES.none },
    })
    // The root entry is the ROOT preset's observation (custom-root = complete)…
    expect(plan.root.persona.kind).toBe('complete')
    // …and the member entry is the MEMBER preset's OWN observation
    // (custom-member = absent) — NOT the root's, and NOT a guess.
    expect(plan.member.persona.kind).toBe('absent')
    expect(plan.member.persona).not.toBe(plan.root.persona)
  })

  it('the probe is memoized per preset id: a shared root/member id observes ONCE', async () => {
    let probes = 0
    const plan = await resolveRuntimeSubstrate({
      rootPresetId: 'shared',
      memberPresetId: undefined,
      // No deployment default: the member id falls back to the ROOT id, so
      // both roles share one preset id.
      deploymentDefaultPresetId: undefined,
      observePersonaKind: (presetId: string) => {
        probes += 1
        expect(presetId).toBe('shared')
        return { kind: 'standard', source: PERSONA_OBSERVATION_SOURCES.effectiveComposition }
      },
    })
    expect(probes).toBe(1)
    expect(plan.root.persona).toBe(plan.member.persona)
  })
})

describe('PR-C C.8 — the persona-kind regression-donor cases (PR #22, reference-only)', () => {
  it('ptc (the plain team composition) observes standard (the compatible case)', async () => {
    const plan = await resolveRuntimeSubstrate({
      rootPresetId: 'ptc',
      memberPresetId: undefined,
      deploymentDefaultPresetId: DEPLOYMENT_DEFAULT,
      observePersonaKind: observeFromTable({
        ptc: { kind: 'standard', source: PERSONA_OBSERVATION_SOURCES.effectiveComposition },
        // The member defaults to the deployment default preset.
        [DEPLOYMENT_DEFAULT]: { kind: 'standard', source: PERSONA_OBSERVATION_SOURCES.effectiveComposition },
      }),
    })
    expect(plan.root.persona.kind).toBe('standard')
    expect(plan.member.persona.kind).toBe('standard')
  })

  it('minimal (the web-bundle complete preset) observes complete (structural FATAL for Team, §13.5)', async () => {
    const plan = await resolveRuntimeSubstrate({
      rootPresetId: 'minimal',
      memberPresetId: undefined,
      deploymentDefaultPresetId: DEPLOYMENT_DEFAULT,
      observePersonaKind: observeFromTable({
        minimal: { kind: 'complete', source: PERSONA_OBSERVATION_SOURCES.effectiveComposition },
      }),
    })
    expect(plan.root.persona.kind).toBe('complete')
  })

  it('bare (no persona row) observes absent', async () => {
    const plan = await resolveRuntimeSubstrate({
      rootPresetId: 'bare',
      memberPresetId: undefined,
      deploymentDefaultPresetId: DEPLOYMENT_DEFAULT,
      observePersonaKind: observeFromTable({
        bare: { kind: 'absent', source: PERSONA_OBSERVATION_SOURCES.effectiveComposition },
      }),
    })
    expect(plan.root.persona.kind).toBe('absent')
  })

  it('a dynamic conditional that cannot be evaluated observes unresolved (typed fail-closed, never a kind guess)', async () => {
    const plan = await resolveRuntimeSubstrate({
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
    expect(plan.root.persona.kind).toBe('unresolved')
    expect(plan.root.persona.reason).toContain('not evaluatable')
  })

  it('an unknown preset (the probe cannot observe it) is unresolved, NOT a kind guess (the false-OPEN is closed)', async () => {
    const plan = await resolveRuntimeSubstrate({
      rootPresetId: 'mystery',
      memberPresetId: undefined,
      deploymentDefaultPresetId: DEPLOYMENT_DEFAULT,
      observePersonaKind: observeFromTable({}),
    })
    expect(plan.root.persona.kind).toBe('unresolved')
    expect(plan.root.persona.source).toBe('none')
  })
})
