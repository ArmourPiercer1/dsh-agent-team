/**
 * P3-T2 — revisions: the catalog revision ordering rule (digit revisions
 * numerically before non-digit lexicographically), `resolveLatest`, and the
 * `blueprintId@revision` display-key round-trip through contracts.
 *
 * @module @dsh-agent-team/domain/test/t2-blueprint-revision
 */

import { describe, expect, it } from 'vitest'

import {
  blueprintSnapshotKey,
  parseBlueprintSnapshotKey,
} from '../../contracts/src/index.js'
import {
  blueprintSnapshotKeyOf,
  createBlueprintCatalog,
  parseBlueprint,
  toBlueprintSnapshotRef,
} from '../blueprint/src/index.js'
import type { BlueprintCatalog } from '../blueprint/src/index.js'
import { revisionSource } from '../blueprint/testdata/fixtures.js'
import { expectCode } from './t2-helpers.js'

function catalogOf(revisions: readonly string[]): BlueprintCatalog {
  return createBlueprintCatalog(
    revisions.map((r) => parseBlueprint(revisionSource('team.rev', r, `Lead ${r}.`))),
  )
}

describe('t2 revision: catalog ordering rule', () => {
  it('orders digit revisions numerically, before non-digit revisions lexicographically', () => {
    const catalog = catalogOf(['beta', '10', 'alpha', '2', '1', '100'])
    expect(catalog.listRevisions('team.rev')).toEqual(['1', '2', '10', '100', 'alpha', 'beta'])
  })

  it('compares long digit revisions without numeric precision loss', () => {
    const a = '9' + '0'.repeat(20) // 21 digits
    const b = '1' + '0'.repeat(21) // 22 digits (larger, though lexically smaller)
    const catalog = catalogOf([b, a])
    expect(catalog.listRevisions('team.rev')).toEqual([a, b])
  })

  it('resolveLatest returns the last revision under the order', () => {
    const mixed = catalogOf(['1', '2', '10', 'beta', 'alpha'])
    expect(mixed.resolveLatest('team.rev').revision).toBe('beta')
    const digitsOnly = catalogOf(['10', '9', '2'])
    expect(digitsOnly.resolveLatest('team.rev').revision).toBe('10')
  })
})

describe('t2 revision: blueprintId@revision key', () => {
  const bp = parseBlueprint(revisionSource('team.min', '7', 'Lead.'))

  it('derives the display key from the parsed blueprint', () => {
    expect(blueprintSnapshotKeyOf(bp)).toBe('team.min@7')
  })

  it('round-trips through the contracts key parser', () => {
    const parsed = parseBlueprintSnapshotKey(blueprintSnapshotKeyOf(bp))
    expect(parsed.blueprintId).toBe('team.min')
    expect(parsed.revision).toBe('7')
  })

  it('agrees with the contracts key function on the snapshot ref', () => {
    expect(blueprintSnapshotKey(toBlueprintSnapshotRef(bp))).toBe(blueprintSnapshotKeyOf(bp))
  })

  it('rejects keys without exactly one @', () => {
    expectCode(() => parseBlueprintSnapshotKey('no-at-sign'), 'MALFORMED_DTO')
    expectCode(() => parseBlueprintSnapshotKey('a@b@c'), 'MALFORMED_DTO')
  })
})

describe('t2 revision: the identity triple distinguishes revisions', () => {
  it('the same id at different revisions carries different content hashes', () => {
    const one = parseBlueprint(revisionSource('team.x', '1', 'Same.'))
    const two = parseBlueprint(revisionSource('team.x', '2', 'Same.'))
    expect(one.blueprintId).toBe(two.blueprintId)
    expect(one.revision).not.toBe(two.revision)
    expect(one.contentHash).not.toBe(two.contentHash)
  })
})
