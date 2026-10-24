/**
 * A5M2-G1-PLUGIN-C1 — the B-PLUGIN vertical slice on REAL bytes (record 52
 * plugin_manager; CENTER whole-family order 2026-10-25: the old zero-code-
 * closed reading is WITHDRAWN — the 639 face was re-read from source and the
 * family takes its closed table, mint, and supply loop for real).
 *
 * Tier: 接线未测 (wired, NOT tested against a live Host; vitest counts are
 * log counts only). The author-side spec controls the REAL SHAPE: the closed
 * 8-action enum is byte-pinned against the 639 face literal, every target
 * leaf is compared at FULL VALUE, and the durable table validates the REAL
 * classify output (never a hand-written fixture alone).
 *
 * Governance semantics mirror the signed Control-family law: the closed
 * table is an approval FLOOR (never an enablement), the captured native
 * keeps its own caller/leader/escalation ceiling (bindBody), and the
 * install_bundle manager entry stays refused with zero manager entry until
 * a deployer mounts the Host gate seams (the wiring refuses those arms in
 * EVERY world).
 */
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { PA_FAMILY_TARGET_RULES, validatePaFamilyTarget } from '../control/types.js'
import type { PaFamilyTargetRule } from '../control/types.js'

interface G1Row {
  classify: (args: Record<string, unknown> | undefined, callId?: string) => {
    ok?: boolean
    code?: string
    detail?: string
    targetManifest?: Record<string, unknown>
    reviewPayload?: { familyId?: string; adapterRevision?: number }
  }
}
interface G1Module {
  A5_G1_ADAPTER_REVISION: number
  A5_G1_CONTROL_ADAPTER_REVISION: number
  A5_G1_PLUGIN_ADAPTER_REVISION: number
  A5_G1_PLUGIN_ACTIONS: string[]
  A5_G1_RECORD_SPECS: Record<string, { recordIndex: number; family: string; capture: string; parameters?: Record<string, unknown> }>
  mountG1SurfaceAdapter: (name: string, deps: Record<string, unknown>) => G1Row
}
const G1 = (await import(new URL('../src/plugin/live/governed-families/g1-surface-adapters.mjs', import.meta.url).href)) as unknown as G1Module

const TRUSTED = Object.freeze({
  memberAgentId: 'agent-a5m2',
  sessionHeaderId: 'sess-a5m2',
  realmId: 'realm-a5m2',
  owner: 'owner-a5m2',
  profileId: 'profile-a5m2',
})
const TRUSTED_LEAVES = Object.freeze({
  trustedMemberAgentId: TRUSTED.memberAgentId,
  trustedSessionHeaderId: TRUSTED.sessionHeaderId,
  trustedRealmId: TRUSTED.realmId,
  trustedOwner: TRUSTED.owner,
  trustedProfileId: TRUSTED.profileId,
})

// The trusted profile facts the classify law enumerates the write envelope
// from — the SAME shape the binding gate requires under plugin=true.
const FACTS = Object.freeze({
  profileConfigLocator: '/home/a5/.dsh/profiles/live/package.json',
  installRootLocator: '/home/a5/.dsh/profiles/live/bundles',
  cacheRootLocator: '/home/a5/.npm/_cacache',
  exemptionsLocator: '/home/a5/.dsh/profiles/live/exemptions.json',
  allowedRegistries: ['https://registry.npmjs.org'],
  fallbackRegistries: ['https://registry.npmmirror.com'],
})

function mountPlugin(native: boolean): G1Row {
  return G1.mountG1SurfaceAdapter('plugin_manager', {
    ...(native ? { native: { name: 'plugin_manager', description: 'captured 639 face', execute: async () => ('{"entries":[],"total":0,"nextOffset":null}') } } : {}),
    definitionIdentity: 'provider@sha#entry#hash',
    trusted: TRUSTED,
    ports: { pluginFacts: { current: () => FACTS } },
    bindingFacts: () => ({ bindingId: 'b1', bindingRevision: 1, policyGeneration: 1, authorityGeneration: 1 }),
  })
}

describe('A5M2-G1-PLUGIN-C1 — the 639 face, the closed table, and the mint at full value (tier 接线未测)', () => {
  it('the closed 8-action enum is BYTE-EQUAL to the 639 face literal (packages/boot/plugin-manager/src/tools.ts @ 639ed01539 :41)', () => {
    // verbatim from the face (action enum, tools.ts:41) — a moved face or a
    // moved mint side fails here before any policy can drift:
    const FACE_ACTIONS = Object.freeze(['list_plugins', 'list_bundles', 'set_plugin', 'set_bundle', 'install_bundle', 'remove_bundle', 'list_version_exemptions', 'set_version_exemption'])
    expect([...G1.A5_G1_PLUGIN_ACTIONS]).toEqual([...FACE_ACTIONS])
    const spec = G1.A5_G1_RECORD_SPECS.plugin_manager as unknown as { recordIndex: number; family: string; parameters: { properties: Record<string, unknown> } }
    expect(spec.recordIndex).toBe(52)
    expect(spec.family).toBe('B-PLUGIN')
    // the params() helper wraps them; the FACE parameter names are the keys
    // (tools.ts:42-50): action,target,enabled,runtimeVersion,acceptRisk,
    // approvedBuilds,registry,offset,limit — nine, exactly, no drift
    expect(Object.keys(spec.parameters.properties).sort()).toEqual(
      ['acceptRisk', 'action', 'approvedBuilds', 'enabled', 'limit', 'offset', 'registry', 'runtimeVersion', 'target'],
    )
  })

  it('the table carries B-PLUGIN with the action discriminant and one variant per FACE action (no extras, none missing)', () => {
    const rule = PA_FAMILY_TARGET_RULES['B-PLUGIN'] as PaFamilyTargetRule
    expect(rule.variant?.leaf).toBe('action')
    expect(Object.keys(rule.variant?.by ?? {}).sort()).toEqual([
      'install_bundle', 'list_bundles', 'list_plugins', 'list_version_exemptions',
      'remove_bundle', 'set_bundle', 'set_plugin', 'set_version_exemption',
    ].sort())
    expect(Object.keys(rule.required ?? {}).sort()).toEqual(['action', 'trustedMemberAgentId', 'trustedOwner', 'trustedProfileId', 'trustedRealmId', 'trustedSessionHeaderId'].sort())
    expect(G1.A5_G1_PLUGIN_ADAPTER_REVISION).toBe(8)
  })

  it('the READ lanes mint the post-default page at real values and validate; the reviewPayload answers the family revision 8', () => {
    const row = mountPlugin(true)
    const listed = row.classify({ action: 'list_plugins' }, 'call-p1')
    expect(listed.ok, `${listed.code} ${listed.detail}`).toBe(true)
    expect(listed.targetManifest).toEqual({ action: 'list_plugins', offsetClaim: 0, limitClaim: 25, ...TRUSTED_LEAVES })
    expect(validatePaFamilyTarget('B-PLUGIN', listed.targetManifest)).toBeUndefined()
    expect(listed.reviewPayload).toMatchObject({ familyId: 'B-PLUGIN', adapterRevision: 8 })
    const paged = row.classify({ action: 'list_bundles', offset: 10, limit: 50 }, 'call-p2')
    expect(paged.ok).toBe(true)
    expect(paged.targetManifest).toMatchObject({ action: 'list_bundles', offsetClaim: 10, limitClaim: 50 })
    const exemptions = row.classify({ action: 'list_version_exemptions' }, 'call-p3')
    expect(exemptions.ok, `${exemptions.code} ${exemptions.detail}`).toBe(true)
    expect(validatePaFamilyTarget('B-PLUGIN', exemptions.targetManifest)).toBeUndefined()
  })

  it('the enable lanes mint the entry-name target at full value; an omitted enabled rides the reviewed absent encoding; a version-qualified entry target is refused by the mint', () => {
    const row = mountPlugin(true)
    const on = row.classify({ action: 'set_plugin', target: '@scope/pkg', enabled: true }, 'call-p4')
    expect(on.ok, `${on.code} ${on.detail}`).toBe(true)
    expect(on.targetManifest).toEqual({ action: 'set_plugin', targetClaim: '@scope/pkg', enabledClaim: 'true', profileConfigLocator: FACTS.profileConfigLocator, ...TRUSTED_LEAVES })
    expect(validatePaFamilyTarget('B-PLUGIN', on.targetManifest)).toBeUndefined()
    const omitted = row.classify({ action: 'set_bundle', target: 'plain-pkg' }, 'call-p5')
    expect(omitted.ok).toBe(true)
    expect(omitted.targetManifest?.enabledClaim).toBe('absent')
    expect(validatePaFamilyTarget('B-PLUGIN', omitted.targetManifest)).toBeUndefined()
    const qualified = row.classify({ action: 'set_plugin', target: 'plain-pkg@1.0.0', enabled: true }, 'call-p6')
    expect(qualified.ok).toBe(false)
    expect(qualified.code).toBe('P_G1_PLUGIN_TARGET_NOT_ENVELOPED')
  })

  it('install_bundle mints the FULL pairing (parsed spec canonical JSON at full value, claimed registry, the REAL three-way registry plan, all three write locators) and it validates', () => {
    const row = mountPlugin(true)
    const install = row.classify({ action: 'install_bundle', target: '@scope/pkg@2.1.0', registry: 'https://registry.npmjs.org' }, 'call-p7')
    expect(install.ok, `${install.code} ${install.detail}`).toBe(true)
    const t = install.targetManifest
    expect(t?.action).toBe('install_bundle')
    expect(JSON.parse(String(t?.installSpecClaim))).toEqual({ kind: 'npm-name', name: '@scope/pkg', version: '2.1.0' })
    expect(t?.claimedRegistryCanonical).toBe('https://registry.npmjs.org')
    expect(t?.allowedRegistries).toEqual(FACTS.allowedRegistries)
    expect(t?.fallbackRegistries).toEqual(FACTS.fallbackRegistries)
    expect(t?.profileConfigLocator).toBe(FACTS.profileConfigLocator)
    expect(t?.installRootLocator).toBe(FACTS.installRootLocator)
    expect(t?.cacheRootLocator).toBe(FACTS.cacheRootLocator)
    expect(t?.versionExemptionDerived).toBe(false)
    expect(validatePaFamilyTarget('B-PLUGIN', t)).toBeUndefined()
    // the claimed registry outside the trusted envelope refuses BEFORE any plan
    const rogue = row.classify({ action: 'install_bundle', target: 'pkg-a', registry: 'https://evil.example' }, 'call-p8')
    expect(rogue.ok).toBe(false)
    expect(rogue.code).toBe('P_G1_PLUGIN_REGISTRY_NOT_TRUSTED')
  })

  it('set_version_exemption is the SEPARATE exact-pair lane (never derivable from install) and remove_bundle carries both install locators', () => {
    const row = mountPlugin(true)
    const exemption = row.classify({ action: 'set_version_exemption', target: '@scope/pkg@2.1.0', runtimeVersion: '0.1.7-rc.1', enabled: true, acceptRisk: true }, 'call-p9')
    expect(exemption.ok, `${exemption.code} ${exemption.detail}`).toBe(true)
    const t = exemption.targetManifest
    expect(t).toMatchObject({
      action: 'set_version_exemption',
      exemptionLocator: FACTS.exemptionsLocator,
      targetClaim: '@scope/pkg@2.1.0',
      exemptionTargetName: '@scope/pkg',
      exemptionTargetVersion: '2.1.0',
      runtimeVersionClaim: '0.1.7-rc.1',
      acceptRiskClaim: true,
      derivableFromInstall: false,
    })
    expect(validatePaFamilyTarget('B-PLUGIN', t)).toBeUndefined()
    const noVersion = row.classify({ action: 'set_version_exemption', target: '@scope/pkg', runtimeVersion: '0.1.7-rc.1', enabled: true }, 'call-p10')
    expect(noVersion.ok).toBe(false)
    expect(noVersion.code).toBe('P_G1_CLASSIFY_INVALID_ARGUMENTS')
    const remove = row.classify({ action: 'remove_bundle', target: 'plain-pkg' }, 'call-p11')
    expect(remove.ok).toBe(true)
    expect(remove.targetManifest).toMatchObject({ action: 'remove_bundle', targetClaim: 'plain-pkg', installRootLocator: FACTS.installRootLocator, versionExemptionDerived: false })
    expect(validatePaFamilyTarget('B-PLUGIN', remove.targetManifest)).toBeUndefined()
  })

  it('the closed table denies the retired flat/nested hybrids, cross-variant leaves, and unknown actions — an approval floor with no fallback', () => {
    const good = mountPlugin(true).classify({ action: 'set_plugin', target: 'plain-pkg', enabled: false }, 'call-p12')
    expect(good.ok).toBe(true)
    const base = good.targetManifest as Record<string, unknown>
    const { action: _drop, ...missing } = base
    expect(validatePaFamilyTarget('B-PLUGIN', missing)).toContain('action: required by the B-PLUGIN typed plan, absent')
    expect(validatePaFamilyTarget('B-PLUGIN', { ...base, action: 'nuke_profile' })).toContain("action: 'nuke_profile' selects no B-PLUGIN")
    expect(validatePaFamilyTarget('B-PLUGIN', { ...base, runtimeVersionClaim: '0.1.7-rc.1' })).toContain('runtimeVersionClaim: not part of the B-PLUGIN typed plan')
    // the retired nested forms (the shape this slice replaced) never validate
    expect(validatePaFamilyTarget('B-PLUGIN', {
      action: 'install_bundle',
      specFacts: { kind: 'npm-name', name: 'pkg-a', version: null },
      registryPlan: { claimedRegistry: null },
      trustedMemberAgentId: TRUSTED.memberAgentId,
      trustedSessionHeaderId: TRUSTED.sessionHeaderId,
      trustedRealmId: TRUSTED.realmId,
      trustedOwner: TRUSTED.owner,
      trustedProfileId: TRUSTED.profileId,
    })).toContain('installSpecClaim: required by the B-PLUGIN typed plan, absent')
  })

  it('an out-of-enum action and a facts-less mount both refuse at the mint (zero plan, no manager-shaped target exists)', () => {
    const row = mountPlugin(true)
    const unknown = row.classify({ action: 'list_everything' }, 'call-p13')
    expect(unknown.ok).toBe(false)
    expect(unknown.code).toBe('P_G1_CLASSIFY_UNKNOWN_ACTION')
    const bare = G1.mountG1SurfaceAdapter('plugin_manager', {
      native: { name: 'plugin_manager', description: 'x', execute: async () => ('{}') },
      definitionIdentity: 'provider@sha#entry#hash',
      trusted: TRUSTED,
      ports: {},
      bindingFacts: () => ({ bindingId: 'b1', bindingRevision: 1, policyGeneration: 1, authorityGeneration: 1 }),
    })
    const noFacts = bare.classify({ action: 'list_plugins' }, 'call-p14')
    expect(noFacts.ok).toBe(false)
    expect(noFacts.code).toBe('P_G1_PLUGIN_TARGETS_ABSENT')
  })

  it('the supply law at source level: closed plugin grammar, DARK by default, armed only by the deployer key with pluginFacts, the wiring whitelist stays armed-set-gated', () => {
    const src = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '../src/plugin/live/agent-bindings.mjs'), 'utf8')
    expect(src).toContain('g1Cfg.plugin !== undefined && g1Cfg.plugin !== true')
    expect(src).toContain("plugin supply DARK for ${sessionId}")
    expect(src).toContain('plugin supply ARMED')
    expect(src).toContain('subset: g1PluginSupplySubset(),')
    expect(src).toContain('pluginFacts: { current: () => g1PluginFactsCfg },')
    expect(src).toContain('governed B-PLUGIN row PLACED')
    // the attribution hoist answers the UNION of armed derived names, null dark
    expect(src).toContain('if (g1SupplyCfg.plugin === true) armedNames.push(...g1PluginSupplySubset().map((row) => row.name))')
    const wiring = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '../src/plugin/live/governed-families/g1-query-wiring.mjs'), 'utf8')
    expect(wiring).toContain("const subsetIsPluginOnly = subset.every((entry) => entry.familyId === 'B-PLUGIN')")
    expect(wiring).toContain("subsetIsPluginOnly ? [...ALLOWED_PORTS, 'pluginFacts'] : ALLOWED_PORTS")
    // the three resource arms stay refused in EVERY world — install enters
    // only through the adapter L5 edge, which today refuses zero-manager-entry
    expect(wiring).toContain("FORBIDDEN_ARMS = Object.freeze(['controlledInstall', 'installFace', 'hostEscalation'])")
    const plane = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '../src/plugin/live/team-tool-plane.mjs'), 'utf8')
    expect(plane).toContain('(g1ArmInject.names !== undefined && g1ArmInject.names.includes(spelling))')
  })
})
