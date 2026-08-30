/**
 * P3-T2 — content hashing: pure-TS SHA-256 (NIST vectors), the canonical-
 * JSON `deriveContentHash`, and the blueprint content-hash properties
 * (determinism, key-order independence, content sensitivity, projection).
 *
 * @module @dsh-agent-team/domain/test/t2-blueprint-hash
 */

import { describe, expect, it } from 'vitest'

import {
  deriveContentHash,
  parseBlueprint,
  sha256Hex,
  toHashableBlueprint,
} from '../blueprint/src/index.js'
import {
  FULL_BLUEPRINT_SOURCE,
  FULL_BLUEPRINT_SOURCE_OTHER_PERSONA,
  FULL_BLUEPRINT_SOURCE_SHUFFLED,
  MINIMAL_BLUEPRINT_SOURCE,
  revisionSource,
} from '../blueprint/testdata/fixtures.js'

describe('t2 hash: SHA-256 (NIST vectors)', () => {
  it('matches the NIST vector for "abc"', () => {
    expect(sha256Hex('abc')).toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    )
  })

  it('matches the NIST vector for the empty string', () => {
    expect(sha256Hex('')).toBe(
      'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    )
  })

  it('matches the NIST vector for the 448-bit message', () => {
    expect(
      sha256Hex('abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq'),
    ).toBe('248d6a61d20638b8e5c026930c3e6039a33ce45964ff2167f6ecedd419db06c1')
  })

  it('hashes multi-byte UTF-8 deterministically', () => {
    expect(sha256Hex('héllo ☺')).toBe(sha256Hex('héllo ☺'))
    expect(sha256Hex('héllo ☺').length).toBe(64)
    expect(sha256Hex('héllo ☺')).not.toBe(sha256Hex('hello'))
  })
})

describe('t2 hash: deriveContentHash', () => {
  it('is independent of key order (canonical JSON binding)', () => {
    expect(deriveContentHash({ a: 1, b: [1, 2] })).toBe(
      deriveContentHash({ b: [1, 2], a: 1 }),
    )
  })

  it('changes when any value changes', () => {
    expect(deriveContentHash({ a: 1 })).not.toBe(deriveContentHash({ a: 2 }))
  })

  it('returns a sha256-prefixed 64-hex string', () => {
    const h = deriveContentHash({ x: 'y' })
    expect(h.startsWith('sha256:')).toBe(true)
    expect(h.length).toBe(71)
  })
})

describe('t2 hash: blueprint content hash', () => {
  it('is deterministic across parses', () => {
    expect(parseBlueprint(FULL_BLUEPRINT_SOURCE).contentHash).toBe(
      parseBlueprint(FULL_BLUEPRINT_SOURCE).contentHash,
    )
  })

  it('is independent of YAML key order', () => {
    expect(parseBlueprint(FULL_BLUEPRINT_SOURCE).contentHash).toBe(
      parseBlueprint(FULL_BLUEPRINT_SOURCE_SHUFFLED).contentHash,
    )
  })

  it('changes when semantic content changes', () => {
    expect(parseBlueprint(FULL_BLUEPRINT_SOURCE).contentHash).not.toBe(
      parseBlueprint(FULL_BLUEPRINT_SOURCE_OTHER_PERSONA).contentHash,
    )
  })

  it('changes across revisions of the same id', () => {
    const one = parseBlueprint(revisionSource('team.x', '1', 'Same.'))
    const two = parseBlueprint(revisionSource('team.x', '2', 'Same.'))
    expect(one.blueprintId).toBe(two.blueprintId)
    expect(one.contentHash).not.toBe(two.contentHash)
  })

  it('changes across ids with identical content', () => {
    const a = parseBlueprint(revisionSource('team.a', '1', 'Same.'))
    const b = parseBlueprint(revisionSource('team.b', '1', 'Same.'))
    expect(a.contentHash).not.toBe(b.contentHash)
  })

  it('binds exactly to the canonical hashable projection', () => {
    const bp = parseBlueprint(FULL_BLUEPRINT_SOURCE)
    expect(bp.contentHash).toBe(deriveContentHash(toHashableBlueprint(bp)))
  })
})

describe('t2 hash: hashable projection', () => {
  it('projects absent optional singles as explicit null', () => {
    const bp = parseBlueprint(MINIMAL_BLUEPRINT_SOURCE)
    const hashable = toHashableBlueprint(bp)
    expect(hashable.displayName).toBe(null)
    expect(hashable.description).toBe(null)
    expect(hashable.teamEnvelope).toBe(null)
    expect(hashable.quotas).toBe(null)
    expect(hashable.capabilityPolicy).toBe(null)
    expect(hashable.leader).toEqual({
      templateId: 'leader',
      displayName: null,
      description: null,
      persona: 'Lead.',
      modelPreference: null,
      contextPolicy: null,
    })
    expect(hashable.members).toEqual([])
    expect(hashable.requirements).toEqual([])
    expect(hashable.memberEnvelopes).toEqual([])
    expect(hashable.policyStates).toEqual([])
    expect(hashable.metadata).toEqual({})
  })

  it('preserves present optional values (including nested quota nulls)', () => {
    const bp = parseBlueprint(FULL_BLUEPRINT_SOURCE)
    const hashable = toHashableBlueprint(bp)
    expect(hashable.displayName).toBe('Alpha Team')
    expect(hashable.quotas).toEqual({
      team: { maxInstances: 8, maxConcurrent: 3 },
      members: { maxInstances: 2, maxConcurrent: null },
    })
    expect(hashable.teamEnvelope).toEqual({
      allow: ['create-member', 'assign-task'],
      deny: ['delete-team'],
    })
  })
})
