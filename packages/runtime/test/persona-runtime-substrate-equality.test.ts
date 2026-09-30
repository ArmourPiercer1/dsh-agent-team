/**
 * pre-alpha3 PR-E (plan §E.3) / W3-A (review fix F1, guide §2.3) — E.11
 * suite `persona-runtime-substrate-equality`: the RuntimeSubstrateResolver
 * is the SINGLE authority for the observed persona kind of EACH mounted
 * preset (plan §C.2 — the review fix F5: the root's AND the member's), and
 * the shipped-state observation adapter ({@link shippedStatePersonaObserver})
 * is the TYPED, NAMED `observePersonaKind` port of FACTORY worlds (the
 * production path observes live through the DSH public `agentPresets` seam
 * — pre-alpha3 W2-A, review fix F14 — never through this adapter).
 *
 * This suite pins the EQUALITY between the resolver plan and the adapter:
 *   - the resolver, wired with the shipped-state observer, reports
 *     `persona.kind: 'standard'` (the deployment default's composable
 *     persona) with honest provenance `persona.source: 'none'` (no live
 *     composition read was performed);
 *   - the resolver's root `persona.kind` EQUALS the adapter's direct
 *     observation kind for the mounted root preset (the single authority
 *     and the port agree — never a divergence);
 *   - the member entry carries the MEMBER preset's own observation (F5 —
 *     observed, not inherited; same id → the identical frozen observation),
 *     while the BIND-TIME persona slot reads the ROOT entry (Architecture
 *     §13.1 — members inherit the root's bind substrate);
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
  it('the resolver (wired with the shipped-state observer) reports root persona kind `standard` with source `none`', async () => {
    const plan = await resolveRuntimeSubstrate({
      rootPresetId: undefined,
      memberPresetId: undefined,
      deploymentDefaultPresetId: SHIPPED_STATE_DEPLOYMENT_DEFAULT_PRESET_ID,
      observePersonaKind: shippedStatePersonaObserver,
    })
    expect(plan.root.presetId).toBe(SHIPPED_STATE_DEPLOYMENT_DEFAULT_PRESET_ID)
    expect(plan.root.persona.kind).toBe('standard')
    expect(plan.root.persona.source).toBe('none')
    // The shipped-state provenance carries the deployment-knowledge marker.
    expect(plan.root.persona.reason).toMatch(/shipped-state observation/)
  })

  it('the resolver root persona kind EQUALS the adapter direct observation for the mounted root preset (the single authority == the port)', async () => {
    const rootPresetId = 'standard'
    const plan = await resolveRuntimeSubstrate({
      rootPresetId,
      memberPresetId: undefined,
      deploymentDefaultPresetId: SHIPPED_STATE_DEPLOYMENT_DEFAULT_PRESET_ID,
      observePersonaKind: shippedStatePersonaObserver,
    })
    const direct = shippedStatePersonaObserver(rootPresetId)
    expect(plan.root.persona.kind).toBe(direct.kind)
    expect(plan.root.persona.source).toBe(direct.source)
  })

  it('the member entry carries the MEMBER preset observation (F5 — observed, not inherited); same id → the identical frozen observation', async () => {
    // Different ids: the member is probed under its OWN preset id.
    const plan = await resolveRuntimeSubstrate({
      rootPresetId: 'standard',
      memberPresetId: 'ptc',
      deploymentDefaultPresetId: SHIPPED_STATE_DEPLOYMENT_DEFAULT_PRESET_ID,
      observePersonaKind: shippedStatePersonaObserver,
    })
    // The shipped state observes `standard` for every id — the adapter is a
    // deployment-knowledge observation, not a per-preset composition read —
    // but the probe ran under the MEMBER id (the authority == the port, per
    // role; the resolver does not inherit the root's observation).
    expect(plan.member.presetId).toBe('ptc')
    expect(plan.member.persona.kind).toBe(shippedStatePersonaObserver('ptc').kind)
    expect(plan.root.persona.kind).toBe(shippedStatePersonaObserver('standard').kind)

    // Same id: the probe runs exactly ONCE and both entries carry the
    // identical observation (the same frozen object, not a copy).
    const same = await resolveRuntimeSubstrate({
      rootPresetId: 'standard',
      memberPresetId: 'standard',
      deploymentDefaultPresetId: SHIPPED_STATE_DEPLOYMENT_DEFAULT_PRESET_ID,
      observePersonaKind: shippedStatePersonaObserver,
    })
    expect(same.member.persona).toBe(same.root.persona)
  })

  it('the observed shipped-state kind is a closed RequiredPersonaKind (the shipped state satisfies a required-`standard`)', () => {
    const observation = shippedStatePersonaObserver(SHIPPED_STATE_DEPLOYMENT_DEFAULT_PRESET_ID)
    expect(isRequiredPersonaKind(observation.kind)).toBe(true)
    expect(REQUIRED_PERSONA_KIND_VALUES).toContain(observation.kind)
  })
})
