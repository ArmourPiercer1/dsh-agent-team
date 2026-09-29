/**
 * pre-alpha3 PR-E (plan §E.3) — E.11 suite
 * `persona-runtime-substrate-equality`: the RuntimeSubstrateResolver is the
 * SINGLE authority for the observed persona kind (plan §C.2), and the
 * shipped-state observation adapter ({@link shippedStatePersonaObserver})
 * is the TYPED, NAMED `observePersonaKind` port wired for this increment
 * (the live production probe is a documented FOLLOW-UP — known_debt). This
 * suite pins the EQUALITY between the resolver plan and the adapter:
 *   - the resolver, wired with the shipped-state observer, reports
 *     `personaKind: 'standard'` (the deployment default's composable
 *     persona) with honest provenance `personaObservation.source: 'none'`
 *     (no live composition read was performed);
 *   - the resolver's `personaKind` EQUALS the adapter's direct observation
 *     kind for the mounted root preset (the single authority and the port
 *     agree — never a divergence);
 *   - the observed shipped-state kind satisfies the REQUIRED kind
 *     (`standard` is in the closed `RequiredPersonaKind` set), so the
 *     shipped state satisfies a required-`standard` persona requirement.
 *
 * @module @dsh-agent-team/runtime/test/persona-runtime-substrate-equality
 */

import { describe, expect, it } from 'vitest'

import { resolveRuntimeSubstrate } from '../agent-setup/preset/substrate-resolver.js'
import {
  SHIPPED_STATE_DEPLOYMENT_DEFAULT_PRESET_ID,
  shippedStatePersonaObserver,
  isRequiredPersonaKind,
  REQUIRED_PERSONA_KIND_VALUES,
} from '../requirements/observed-persona.js'

describe('E.11 persona-runtime-substrate-equality: resolver plan == adapter observation', () => {
  it('the resolver (wired with the shipped-state observer) reports personaKind `standard` with source `none`', () => {
    const plan = resolveRuntimeSubstrate({
      rootPresetId: undefined,
      memberPresetId: undefined,
      deploymentDefaultPresetId: SHIPPED_STATE_DEPLOYMENT_DEFAULT_PRESET_ID,
      observePersonaKind: shippedStatePersonaObserver,
    })
    expect(plan.rootPresetId).toBe(SHIPPED_STATE_DEPLOYMENT_DEFAULT_PRESET_ID)
    expect(plan.personaKind).toBe('standard')
    expect(plan.personaObservation.source).toBe('none')
    // The known_debt follow-up marker is carried for diagnostics.
    expect(plan.personaObservation.reason).toMatch(/live production persona probe/)
  })

  it('the resolver personaKind EQUALS the adapter direct observation for the mounted root preset (the single authority == the port)', () => {
    const rootPresetId = 'standard'
    const plan = resolveRuntimeSubstrate({
      rootPresetId,
      memberPresetId: undefined,
      deploymentDefaultPresetId: SHIPPED_STATE_DEPLOYMENT_DEFAULT_PRESET_ID,
      observePersonaKind: shippedStatePersonaObserver,
    })
    const direct = shippedStatePersonaObserver(rootPresetId)
    expect(plan.personaKind).toBe(direct.kind)
    expect(plan.personaObservation.source).toBe(direct.source)
  })

  it('members inherit the root observed kind (no per-member divergence)', () => {
    const plan = resolveRuntimeSubstrate({
      rootPresetId: 'standard',
      memberPresetId: 'ptc',
      deploymentDefaultPresetId: SHIPPED_STATE_DEPLOYMENT_DEFAULT_PRESET_ID,
      observePersonaKind: shippedStatePersonaObserver,
    })
    // The member id differs but the OBSERVED kind is the root's (the
    // shipped state observes `standard` for every id — the adapter is a
    // deployment-knowledge observation, not a per-preset composition read).
    expect(plan.personaKind).toBe(shippedStatePersonaObserver('ptc').kind)
  })

  it('the observed shipped-state kind is a closed RequiredPersonaKind (the shipped state satisfies a required-`standard`)', () => {
    const observation = shippedStatePersonaObserver(SHIPPED_STATE_DEPLOYMENT_DEFAULT_PRESET_ID)
    expect(isRequiredPersonaKind(observation.kind)).toBe(true)
    expect(REQUIRED_PERSONA_KIND_VALUES).toContain(observation.kind)
  })
})
