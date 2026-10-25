/**
 * U6 PR1 C1 — the GovernedFamilyRegistry law (U6-SLICE-PLAN PR1 "collision/
 * generation units"; sup-b `g1fb-registry.mjs` law: closed schema +
 * collision + generation checks, NON-AUTHORIZING; §10.3 collision/quarantine,
 * condition 9 dynamic-source NOT_VERIFIED).
 */
import { describe, expect, it } from 'vitest'
import {
  CONTRIBUTION_SCHEMA_MAJOR,
  createGovernedFamilyRegistry,
  type KernelCapabilityManifest,
} from '../governance-center/index.js'

const HEX64 = 'a'.repeat(64)
const MANIFEST: KernelCapabilityManifest = { capabilities: { 'schema.closed-io': {} } }

function contribution(name: string, aliases: readonly string[] = []): Record<string, unknown> {
  return {
    schemaVersion: { major: CONTRIBUTION_SCHEMA_MAJOR, minor: 0, patch: 0 },
    familyId: `u6.family.${name}`,
    familyVersion: '0.0.1',
    source: { kind: 'family-owned', selector: `lane:${name}`, digest: HEX64 },
    provider: { id: `provider.${name}`, digest: HEX64 },
    requiredCapabilities: [],
    optionalCapabilities: [],
    visibility: { owner: 'family', nativeNames: [name], aliases, profileRequirements: [] },
    definition: { owner: 'family', inputContractDigest: HEX64, outputContractDigest: HEX64, normalization: 'pure' },
    effects: { declared: false, kinds: [], targets: [] },
    execution: { declared: false, via: 'family-body' },
    lifecycle: { owner: 'kernel', drain: 'kernel-owned', cancelBoundary: 'host-signal' },
    result: { envelope: 'host', correlation: 'kernel' },
    obligations: { admission: 'kernel', grantMint: 'kernel', grantConsume: 'kernel' },
  }
}

describe('u6-pr1 governed family registry — collision, generation, non-authorizing', () => {
  it('a valid registration lands a candidate and bumps exactly one generation', () => {
    const registry = createGovernedFamilyRegistry({ kernelManifest: MANIFEST })
    expect(registry.generation()).toBe(0)
    const result = registry.register(contribution('tool_alpha'))
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value.state).toBe('candidate')
      expect(result.value.generation).toBe(1)
    }
    expect(registry.view().candidates).toHaveLength(1)
    expect(registry.candidateFor('tool_alpha')?.familyId).toBe('u6.family.tool_alpha')
  })

  it('a refused registration changes NOTHING — not the candidates, not the generation', () => {
    const registry = createGovernedFamilyRegistry({ kernelManifest: MANIFEST })
    registry.register(contribution('tool_alpha'))
    const before = registry.view()
    const dup = registry.register(contribution('tool_alpha'))
    expect(dup.ok).toBe(false)
    if (dup.ok === false) expect(dup.code).toBe('DUP_FAMILY_ID')
    const invalid = registry.register({ not: 'a contribution' })
    expect(invalid.ok).toBe(false)
    if (invalid.ok === false) expect(invalid.code).toBe('INVALID_CONTRIBUTION')
    const after = registry.view()
    expect(after.generation).toBe(before.generation)
    expect(after.candidates).toHaveLength(1)
  })

  it('collision law (sup-b): a FOREIGN claim of a held native name is refused, the owner is kept', () => {
    const registry = createGovernedFamilyRegistry({ kernelManifest: MANIFEST })
    registry.register(contribution('tool_alpha'))
    const claim = contribution('tool_beta')
    const visibility = claim['visibility'] as Record<string, unknown>
    visibility.nativeNames = ['tool_alpha'] // foreign claim of the held name
    const result = registry.register(claim)
    expect(result.ok).toBe(false)
    if (result.ok === false) expect(result.code).toBe('NAME_COLLISION')
    // the OWNER stands; the colliding candidate was never landed
    expect(registry.candidateFor('tool_alpha')?.familyId).toBe('u6.family.tool_alpha')
    expect(registry.view().candidates.filter((c) => c.state !== 'tombstoned')).toHaveLength(1)
  })

  it('collision law covers ALIASES too (an alias claim is a name claim)', () => {
    const registry = createGovernedFamilyRegistry({ kernelManifest: MANIFEST })
    registry.register(contribution('tool_alpha', ['tool_alias']))
    const steal = contribution('tool_gamma')
    const visibility = steal['visibility'] as Record<string, unknown>
    visibility.nativeNames = ['tool_alias'] // step on the held alias
    const result = registry.register(steal)
    expect(result.ok).toBe(false)
    if (result.ok === false) expect(result.code).toBe('NAME_COLLISION')
  })

  it('a freed name (revoke → tombstone) may be claimed by another family, on a NEW generation', () => {
    const registry = createGovernedFamilyRegistry({ kernelManifest: MANIFEST })
    registry.register(contribution('tool_alpha'))
    const revoked = registry.revoke('u6.family.tool_alpha', 'test: replacement')
    expect(revoked.ok).toBe(true)
    expect(registry.candidateFor('tool_alpha')).toBeUndefined()
    const claim = contribution('tool_delta')
    const visibility = claim['visibility'] as Record<string, unknown>
    visibility.nativeNames = ['tool_alpha']
    const result = registry.register(claim)
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.value.generation).toBeGreaterThan(2)
    expect(registry.candidateFor('tool_alpha')?.familyId).toBe('u6.family.tool_delta')
  })

  it('condition 9 / CI-11: a DYNAMIC-SOURCE registration lands not_verified, never candidate', () => {
    const registry = createGovernedFamilyRegistry({ kernelManifest: MANIFEST })
    const result = registry.register(contribution('tool_dynamic'), { origin: 'dynamic-source' })
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.value.state).toBe('not_verified')
    const view = registry.view()
    expect(view.candidates[0]?.state).toBe('not_verified')
  })

  it('revoke is first-class (CI-08): unknown id and empty reason are typed refusals; tombstones stay in the view for audit', () => {
    const registry = createGovernedFamilyRegistry({ kernelManifest: MANIFEST })
    const missing = registry.revoke('u6.family.ghost', 'test')
    expect(missing.ok).toBe(false)
    if (missing.ok === false) expect(missing.code).toBe('NOT_FOUND')
    const noReason = registry.revoke('u6.family.tool_alpha', '')
    expect(noReason.ok).toBe(false)
    if (noReason.ok === false) expect(noReason.code).toBe('BAD_REASON')
    registry.register(contribution('tool_alpha'))
    expect(registry.revoke('u6.family.tool_alpha', 'test: retire').ok).toBe(true)
    expect(registry.view().candidates.some((c) => c.state === 'tombstoned')).toBe(true)
  })

  it('the view is a READ-ONLY candidate view (§3): frozen snapshot, mutation throws, later growth does not leak into an old snapshot', () => {
    const registry = createGovernedFamilyRegistry({ kernelManifest: MANIFEST })
    registry.register(contribution('tool_alpha'))
    const view = registry.view()
    expect(Object.isFrozen(view)).toBe(true)
    expect(Object.isFrozen(view.candidates)).toBe(true)
    expect(() => {
      ;(view.candidates as unknown as unknown[]).push('forged')
    }).toThrow()
    registry.register(contribution('tool_beta'))
    expect(view.candidates).toHaveLength(1) // the old snapshot did not move
    expect(registry.view().candidates).toHaveLength(2)
  })

  it('NON-AUTHORIZING (§3, §10.2): the registry surface is exactly register/revoke/view/candidateFor/generation — no approve/admit/grant/consume exists', () => {
    const registry = createGovernedFamilyRegistry({ kernelManifest: MANIFEST })
    const surface = Object.keys(registry).sort()
    expect(surface).toEqual(['candidateFor', 'generation', 'register', 'revoke', 'view'])
    for (const forbidden of ['approve', 'admit', 'grant', 'consume', 'allow', 'decide', 'mint'] as const) {
      expect(registry[forbidden as keyof typeof registry]).toBeUndefined()
    }
  })
})
