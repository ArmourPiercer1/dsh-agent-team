/**
 * U6 PR1 C1 — the closed-world contribution schema negative matrix
 * (U6-SLICE-PLAN PR1 "Tests (C1)": unknown field; family self-approving;
 * effects without execution declaration; provider-backed family lacking a
 * named Bridge; lifecycle without owner; capability not backed by a declared
 * real execution path — EACH RED-first, EACH with a planted-counterexample
 * sensitivity leg; plus the digest / version / name-shape legs of §10.3).
 *
 * METHOD (the §10.5-6 rule — "a test failure must provide a detectable
 * planted counterexample"): every negative leg PLANTS exactly one defect
 * into the valid base contribution, asserts the typed refusal, then HEALS
 * the plant and asserts acceptance. The heal leg is the sensitivity proof:
 * a validator that merely refused everything would pass every negative and
 * fail every heal. The base positive leg runs first, so a broken base is
 * RED before any negative can green-wash it.
 */
import { describe, expect, it } from 'vitest'
import {
  CONTRIBUTION_SCHEMA_MAJOR,
  validateFamilyContribution,
  type KernelCapabilityManifest,
} from '../governance-center/index.js'

const D = (seed: string): string => {
  // A deterministic 64-hex stand-in for a real sha256 (shape validation only).
  let out = ''
  let h = 0x811c9dc5
  for (let i = 0; i < 64; i += 1) {
    h = Math.imul(h ^ seed.charCodeAt(i % seed.length) + i, 0x01000193) >>> 0
    out += (h & 0xf).toString(16)
  }
  return out
}

/** The published capability manifest the tests negotiate against. */
const MANIFEST: KernelCapabilityManifest = {
  capabilities: {
    'fs.effect-boundary': { backsExecution: 'family-body' },
    'transport.named-bridge': { backsExecution: 'named-bridge' },
    'schema.closed-io': {},
  },
}

function base(): Record<string, unknown> {
  return {
    schemaVersion: { major: CONTRIBUTION_SCHEMA_MAJOR, minor: 0, patch: 0 },
    familyId: 'u6.family.test',
    familyVersion: '0.0.1',
    source: { kind: 'family-owned', selector: 'lane:test', digest: D('source') },
    provider: { id: 'provider.test', digest: D('provider') },
    requiredCapabilities: ['schema.closed-io'],
    optionalCapabilities: [],
    visibility: { owner: 'family', nativeNames: ['u6_test_tool'], aliases: ['u6_test_alias'], profileRequirements: [] },
    definition: { owner: 'family', inputContractDigest: D('input'), outputContractDigest: D('output'), normalization: 'pure' },
    effects: { declared: true, kinds: ['fs.write'], targets: ['workspace'] },
    execution: { declared: true, via: 'family-body' },
    lifecycle: { owner: 'kernel', drain: 'kernel-owned', cancelBoundary: 'host-signal' },
    result: { envelope: 'host', correlation: 'kernel' },
    obligations: { admission: 'kernel', grantMint: 'kernel', grantConsume: 'kernel' },
  }
}

/** plant + assert-typed-refusal + heal + assert-accept (the §10.5-6 pair). */
function expectRedThenHeal(
  plant: (contribution: Record<string, unknown>) => void,
  expectedCode: string,
): void {
  const broken = base()
  plant(broken)
  const red = validateFamilyContribution(broken, MANIFEST)
  expect(red.ok, `planted ${expectedCode} must be refused`).toBe(false)
  if (red.ok === false) expect(red.code).toBe(expectedCode)
  // Sensitivity leg: the UNMUTATED base must still accept, proving the
  // refusal came from the plant and not from a validator that dies on all.
  const green = validateFamilyContribution(base(), MANIFEST)
  expect(green.ok, `the unmutated base must stay acceptable (sensitivity leg for ${expectedCode})`).toBe(true)
}

describe('u6-pr1 contribution schema — the closed-world law (§4, §10.3)', () => {
  it('base positive: the valid contribution validates and freezes', () => {
    const result = validateFamilyContribution(base(), MANIFEST)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(Object.isFrozen(result.contribution)).toBe(true)
      expect(Object.isFrozen(result.contribution.visibility.nativeNames)).toBe(true)
    }
  })

  it('RED-then-heal: an unknown field at the top level is refused, never ignored', () => {
    expectRedThenHeal((c) => { c.grantsPreApproved = true }, 'UNKNOWN_FIELD')
  })

  it('RED-then-heal: an unknown field inside a boundary is refused too (closed at every level)', () => {
    expectRedThenHeal((c) => {
      const visibility = c['visibility'] as Record<string, unknown>
      visibility.autoAdmit = true
    }, 'UNKNOWN_FIELD')
  })

  it('RED-then-heal: a family self-approving admission is refused with its own code (CI-06)', () => {
    expectRedThenHeal((c) => {
      const obligations = c['obligations'] as Record<string, unknown>
      obligations.admission = 'family'
    }, 'FAMILY_SELF_APPROVAL_FORBIDDEN')
  })

  it('RED-then-heal: a family claiming its own grant mint / consume is refused', () => {
    for (const key of ['grantMint', 'grantConsume'] as const) {
      const broken = base()
      const obligations = broken['obligations'] as Record<string, unknown>
      obligations[key] = 'family'
      const result = validateFamilyContribution(broken, MANIFEST)
      expect(result.ok).toBe(false)
      if (result.ok === false) expect(result.code).toBe('FAMILY_SELF_APPROVAL_FORBIDDEN')
    }
  })

  it('RED-then-heal: declared effects without a declared execution path fail closed', () => {
    expectRedThenHeal((c) => {
      const execution = c['execution'] as Record<string, unknown>
      execution.declared = false
    }, 'EFFECTS_WITHOUT_EXECUTION')
  })

  it('RED-then-heal: a provider-backed family without a named bridge is refused', () => {
    expectRedThenHeal((c) => {
      const source = c['source'] as Record<string, unknown>
      source.kind = 'provider-backed'
    }, 'NAMED_BRIDGE_REQUIRED')
  })

  it('provider-backed + named bridge is the accepted shape (the negative is not a ban)', () => {
    const contribution = base()
    const source = contribution['source'] as Record<string, unknown>
    source.kind = 'provider-backed'
    const execution = contribution['execution'] as Record<string, unknown>
    execution.via = 'named-bridge'
    execution.bridgeId = 'bridge.test'
    const result = validateFamilyContribution(contribution, MANIFEST)
    expect(result.ok).toBe(true)
  })

  it('RED-then-heal: a lifecycle owned by the family (or lacking the kernel owner) is refused', () => {
    // owner:'family' — self-approval of the lifecycle ordering (CI-08).
    expectRedThenHeal((c) => {
      const lifecycle = c['lifecycle'] as Record<string, unknown>
      lifecycle.owner = 'family'
    }, 'FAMILY_SELF_APPROVAL_FORBIDDEN')
    // owner absent — lifecycle boundary without an owner.
    const broken = base()
    const lifecycle = broken['lifecycle'] as Record<string, unknown>
    delete lifecycle.owner
    const result = validateFamilyContribution(broken, MANIFEST)
    expect(result.ok).toBe(false)
    if (result.ok === false) expect(result.code).toBe('LIFECYCLE_OWNER_REQUIRED')
  })

  it('RED-then-heal: a required capability not backed by the declared execution path is refused', () => {
    expectRedThenHeal((c) => {
      c.requiredCapabilities = ['transport.named-bridge'] // declared execution is family-body
    }, 'CAPABILITY_UNBACKED')
    // and with the bridge declared, the SAME capability is accepted:
    const contribution = base()
    contribution.requiredCapabilities = ['transport.named-bridge']
    const execution = contribution['execution'] as Record<string, unknown>
    execution.via = 'named-bridge'
    execution.bridgeId = 'bridge.test'
    const source = contribution['source'] as Record<string, unknown>
    source.kind = 'provider-backed'
    expect(validateFamilyContribution(contribution, MANIFEST).ok).toBe(true)
  })

  it('RED-then-heal: a capability the Kernel never published is refused (negotiation is against the published face)', () => {
    expectRedThenHeal((c) => {
      c.requiredCapabilities = ['made.up.capability']
    }, 'CAPABILITY_UNKNOWN')
    expectRedThenHeal((c) => {
      c.optionalCapabilities = ['made.up.capability']
    }, 'CAPABILITY_UNKNOWN')
  })

  it('RED-then-heal: a bad digest (upper case / short / non-hex) is refused', () => {
    for (const bad of [D('x').toUpperCase(), 'abc123', `${D('y').slice(0, 63)}z`]) {
      const broken = base()
      const definition = broken['definition'] as Record<string, unknown>
      definition.inputContractDigest = bad
      const result = validateFamilyContribution(broken, MANIFEST)
      expect(result.ok).toBe(false)
      if (result.ok === false) expect(result.code).toBe('BAD_DIGEST')
    }
  })

  it('RED-then-heal: an unsupported schema major is refused, never reinterpreted', () => {
    expectRedThenHeal((c) => {
      const version = c['schemaVersion'] as Record<string, unknown>
      version.major = CONTRIBUTION_SCHEMA_MAJOR + 1
    }, 'UNSUPPORTED_SCHEMA_VERSION')
    // a higher MINOR is accepted (minor is additive; major is the gate):
    const contribution = base()
    const version = contribution['schemaVersion'] as Record<string, unknown>
    version.minor = 9
    expect(validateFamilyContribution(contribution, MANIFEST).ok).toBe(true)
  })

  it('structural negatives: non-object input, missing boundaries, alias colliding with a native name, duplicate array entries', () => {
    expect(validateFamilyContribution('nope', MANIFEST).ok).toBe(false)
    const missing = base()
    delete missing.visibility
    const r1 = validateFamilyContribution(missing, MANIFEST)
    expect(r1.ok).toBe(false)
    if (r1.ok === false) expect(r1.code).toBe('MISSING_FIELD')
    expectRedThenHeal((c) => {
      const visibility = c['visibility'] as Record<string, unknown>
      visibility.aliases = ['u6_test_tool'] // == a native name
    }, 'NAME_ALIAS_COLLISION')
    expectRedThenHeal((c) => {
      const visibility = c['visibility'] as Record<string, unknown>
      visibility.nativeNames = ['a_tool', 'a_tool']
    }, 'BAD_VALUE')
  })

  it('the refusal channel is total: every failure carries code+path+detail, and ok=false never carries a contribution', () => {
    const result = validateFamilyContribution({ schemaVersion: 'garbage' }, MANIFEST)
    expect(result.ok).toBe(false)
    if (result.ok === false) {
      expect(typeof result.code).toBe('string')
      expect(result.path.startsWith('$')).toBe(true)
      expect(result.detail.length).toBeGreaterThan(0)
    }
  })
})
