/**
 * a5sf-trust-registry — Alpha.5 P1-04 (Gate G1.4, part 2/2).
 *
 * The Trusted Tool Registry verifies IDENTITY and LOAD GENERATION only: the
 * deployer registers a tool binding with its source/dependency digests at load
 * time, and every call re-checks the tuple `(packageDigest, dependencyDigest,
 * scope, definitionGeneration, toolName)`. It is NOT a sandbox: nothing here
 * proves a trusted in-process JS module cannot bypass its Provider.
 *
 * RED-first: every case here fails before `trust-registry.ts` exists.
 *
 * @module test/a5sf-trust-registry
 */
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import {
  createTrustRegistry,
  registerTrustedBinding,
  verifyTrustedBinding,
} from '../member-io-policy/src/trust-registry.js'
import type { TrustedBindingRegistration, TrustRegistry } from '../member-io-policy/src/types.js'

// --- fixtures ----------------------------------------------------------------

const PACKAGE_A = 'sha256:' + 'a'.repeat(64)
const PACKAGE_B = 'sha256:' + 'b'.repeat(64)
const DEPENDENCY_A = 'sha256:' + 'c'.repeat(64)
const DEPENDENCY_B = 'sha256:' + 'd'.repeat(64)

function registration(over: Partial<TrustedBindingRegistration> = {}): TrustedBindingRegistration {
  return {
    packageDigest: PACKAGE_A,
    dependencyDigest: DEPENDENCY_A,
    scope: 'member:alpha',
    definitionGeneration: 1,
    toolName: 'read',
    ...over,
  }
}

function registered(registry: TrustRegistry, over: Partial<TrustedBindingRegistration> = {}): void {
  const result = registry.register(registration(over))
  if (!result.ok) throw new Error(`expected a registered binding, got ${result.code}: ${result.detail}`)
}

function expectRefusal(result: { ok: true } | { ok: false; code: string }, code: string): void {
  if (result.ok) throw new Error(`expected refusal ${code}, got an accepted result`)
  expect(result.code).toBe(code)
}

// --- P1-04 RED laws: registration + identity ---------------------------------

describe('P1-04 · explicit registration, matching identity verifies', () => {
  it('a binding registered at load time with matching digests/scope/generation verifies', () => {
    const registry = createTrustRegistry()
    const result = registry.register(registration())
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value).toEqual({
      packageDigest: PACKAGE_A,
      dependencyDigest: DEPENDENCY_A,
      scope: 'member:alpha',
      definitionGeneration: 1,
      toolName: 'read',
    })
    expect(Object.isFrozen(result.value)).toBe(true)

    const verified = registry.verify(registration())
    expect(verified.ok).toBe(true)
    if (!verified.ok) return
    expect(verified.value.toolName).toBe('read')
    expect(Object.isFrozen(verified.value)).toBe(true)
    expect(registry.inspect('member:alpha', 'read')).not.toBeNull()
    expect(registry.inspect('member:alpha', 'write')).toBeNull()
    expect(registry.size()).toBe(1)
  })

  it('an unknown tool/scope is refused — never trust by default', () => {
    const registry = createTrustRegistry()
    expectRefusal(registry.verify(registration()), 'TRUST_BINDING_UNKNOWN')

    registered(registry)
    expectRefusal(registry.verify(registration({ toolName: 'write' })), 'TRUST_BINDING_UNKNOWN')
    expectRefusal(registry.verify(registration({ scope: 'member:beta' })), 'TRUST_BINDING_UNKNOWN')
  })

  it('refuses a package digest mismatch and a dependency digest mismatch', () => {
    const registry = createTrustRegistry()
    registered(registry)
    expectRefusal(registry.verify(registration({ packageDigest: PACKAGE_B })), 'TRUST_PACKAGE_DIGEST_MISMATCH')
    expectRefusal(registry.verify(registration({ dependencyDigest: DEPENDENCY_B })), 'TRUST_DEPENDENCY_DIGEST_MISMATCH')
    expect(registry.verify(registration()).ok).toBe(true)
  })

  it('refuses a malformed registration/verification input', () => {
    const registry = createTrustRegistry()
    expectRefusal(registry.register(registration({ toolName: '  ' })), 'TRUST_INPUT_INVALID')
    expectRefusal(registry.register(registration({ scope: '' })), 'TRUST_INPUT_INVALID')
    expectRefusal(registry.register(registration({ packageDigest: '' })), 'TRUST_INPUT_INVALID')
    expectRefusal(registry.register(registration({ definitionGeneration: -1 })), 'TRUST_INPUT_INVALID')
    expectRefusal(registry.register(registration({ definitionGeneration: 1.5 })), 'TRUST_INPUT_INVALID')
    registered(registry)
    expectRefusal(registry.verify(registration({ definitionGeneration: Number.NaN })), 'TRUST_INPUT_INVALID')
  })
})

// --- P1-04 RED laws: HMR / generation ----------------------------------------

describe('P1-04 · HMR / Definition replacement is a generation law', () => {
  it('a newer generation refuses the older caller even when the tool name is identical', () => {
    const registry = createTrustRegistry()
    registered(registry, { packageDigest: PACKAGE_A, definitionGeneration: 1 })
    expect(registry.verify(registration({ packageDigest: PACKAGE_A, definitionGeneration: 1 })).ok).toBe(true)

    // HMR replaces the Definition: the registry registers the new generation.
    const replaced = registry.register(registration({ packageDigest: PACKAGE_B, dependencyDigest: DEPENDENCY_B, definitionGeneration: 2 }))
    expect(replaced.ok).toBe(true)
    if (!replaced.ok) return
    expect(replaced.value.definitionGeneration).toBe(2)

    // The old caller presents the CURRENT digests but its OLD generation.
    expectRefusal(
      registry.verify(registration({ packageDigest: PACKAGE_B, dependencyDigest: DEPENDENCY_B, definitionGeneration: 1 })),
      'TRUST_GENERATION_STALE',
    )
    // The old caller still presenting its old digests is STILL refused as stale:
    // generation names the load, and a replaced Definition never re-verifies.
    expectRefusal(
      registry.verify(registration({ packageDigest: PACKAGE_A, dependencyDigest: DEPENDENCY_A, definitionGeneration: 1 })),
      'TRUST_GENERATION_STALE',
    )
    expect(registry.verify(registration({ packageDigest: PACKAGE_B, dependencyDigest: DEPENDENCY_B, definitionGeneration: 2 })).ok).toBe(true)
  })

  it('a caller generation the registry never registered is refused (both directions)', () => {
    const registry = createTrustRegistry()
    registered(registry, { definitionGeneration: 2 })
    expectRefusal(
      registry.verify(registration({ definitionGeneration: 3 })),
      'TRUST_GENERATION_MISMATCH',
    )
    expectRefusal(
      registry.verify(registration({ definitionGeneration: 1 })),
      'TRUST_GENERATION_STALE',
    )
  })

  it('a registration may not be downgraded nor redefined within one generation', () => {
    const registry = createTrustRegistry()
    registered(registry, { definitionGeneration: 2 })

    expectRefusal(registry.register(registration({ definitionGeneration: 1 })), 'TRUST_GENERATION_STALE')
    expectRefusal(
      registry.register(registration({ packageDigest: PACKAGE_B, definitionGeneration: 2 })),
      'TRUST_REGISTRATION_CONFLICT',
    )
    // Idempotent re-registration of the SAME load is accepted.
    expect(registry.register(registration({ definitionGeneration: 2 })).ok).toBe(true)
    // The failed attempts left the original registration intact.
    expect(registry.verify(registration({ definitionGeneration: 2 })).ok).toBe(true)
  })
})

// --- P1-04 RED laws: scope separation ----------------------------------------

describe('P1-04 · same tool name in a different scope never shares trust', () => {
  it('scope is part of the registration key', () => {
    const registry = createTrustRegistry()
    registered(registry, { scope: 'member:alpha' })
    expectRefusal(registry.verify(registration({ scope: 'member:beta' })), 'TRUST_BINDING_UNKNOWN')

    // A second registration under a different scope with different digests.
    registered(registry, { scope: 'member:beta', packageDigest: PACKAGE_B, dependencyDigest: DEPENDENCY_B })
    expect(registry.size()).toBe(2)

    // Cross-feeding alpha's digests to beta's scope is a mismatch, not trust.
    expectRefusal(registry.verify(registration({ scope: 'member:beta' })), 'TRUST_PACKAGE_DIGEST_MISMATCH')
    // And alpha's own trust is untouched.
    expect(registry.verify(registration({ scope: 'member:alpha' })).ok).toBe(true)
    expect(registry.inspect('member:alpha', 'read')).not.toEqual(registry.inspect('member:beta', 'read'))
  })

  it('module-level helpers use the process registry (same law)', () => {
    const first = registerTrustedBinding(registration({ scope: 'member:module', toolName: 'grep' }))
    expect(first.ok).toBe(true)
    expect(verifyTrustedBinding(registration({ scope: 'member:module', toolName: 'grep' })).ok).toBe(true)
    expectRefusal(
      verifyTrustedBinding(registration({ scope: 'member:module', toolName: 'glob' })),
      'TRUST_BINDING_UNKNOWN',
    )
  })
})

// --- P1-04 RED laws: no per-call filesystem hashing --------------------------

describe('P1-04 · the registry compares supplied digests; it never walks the tree', () => {
  it('the module source has no filesystem or hashing dependency, and says it is not a sandbox', () => {
    // Resolve the module file portably without depending on a specific URL
    // type declaration (the global and node:url URL types can differ).
    const sourceUrl = String(new URL('../member-io-policy/src/trust-registry.ts', import.meta.url))
    const sourcePath = decodeURIComponent(sourceUrl.replace(/^file:\/\//, ''))
    const source = readFileSync(sourcePath, 'utf8')
    expect(source).not.toMatch(/from ['"]node:fs['"]/)
    expect(source).not.toMatch(/readFileSync|readdirSync|statSync|lstatSync/)
    expect(source).not.toMatch(/from ['"]node:crypto['"]/)
    expect(source).toMatch(/not a sandbox/i)
  })
})
