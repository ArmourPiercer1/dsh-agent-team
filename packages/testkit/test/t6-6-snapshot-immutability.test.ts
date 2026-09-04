/**
 * P3-T6 (G3-6) — Blueprint snapshot immutability: cross-module property
 * evidence.
 *
 * The domain parse pipeline must hand back a deep-frozen, content-identical
 * snapshot: the same logical document yields the same content hash across
 * textual normalizations (BOM/CRLF) and key order, revisions yield distinct
 * hashes, `contentHash` is derived (never a source field), and the snapshot
 * ref bound into a TeamSession record stays frozen and addressable by its
 * `blueprintId@revision` key.
 *
 * Authority: Architecture §5.6/§8.4 (one TeamSession binds exactly one
 * immutable Blueprint snapshot, invariant 10), §6 (content-hash derivation);
 * Development Plan §16.4 G3-6.
 */

import { describe, expect, it } from 'vitest'

import {
  blueprintSnapshotKey,
  parseBlueprintSnapshotKey,
} from '../../contracts/src/index.js'
import {
  blueprintSnapshotKeyOf,
  parseBlueprint,
  toBlueprintSnapshotRef,
} from '../../domain/blueprint/src/index.js'
import {
  CRLF_BOM_SOURCE,
  FULL_BLUEPRINT_SOURCE,
  FULL_BLUEPRINT_SOURCE_OTHER_PERSONA,
  FULL_BLUEPRINT_SOURCE_SHUFFLED,
  MINIMAL_BLUEPRINT_SOURCE,
  NEG_CONTENT_HASH_IN_SOURCE,
  revisionSeriesSources,
} from '../../domain/blueprint/testdata/fixtures.js'
import { buildTeamComposition } from '../domain/src/index.js'
import { capture, describeError, expectCode, isDeepFrozen } from './t6-helpers.js'

/** Run `fn` and assert it throws specifically a TypeError. */
function expectTypeError(fn: () => void, label: string): void {
  const result = capture(fn)
  const error = result.error
  if (error === undefined) {
    throw new Error(`${label}: expected a TypeError, but nothing was thrown`)
  }
  if (!(error instanceof TypeError)) {
    throw new Error(`${label}: expected a TypeError, got ${describeError(error)}`)
  }
}

describe('P3-T6 G3-6 Blueprint snapshot immutability (cross-module)', () => {
  it('parseBlueprint returns a deep-frozen blueprint', () => {
    const bp = parseBlueprint(MINIMAL_BLUEPRINT_SOURCE)
    expect(isDeepFrozen(bp)).toBe(true)
    expect(Object.isFrozen(bp)).toBe(true)
    expect(Object.isFrozen(bp.members)).toBe(true)
    expect(Object.isFrozen(bp.metadata)).toBe(true)
    expect(Object.isFrozen(bp.leader)).toBe(true)
  })

  it('mutation attempts on a parsed blueprint all throw TypeError', () => {
    const bp = parseBlueprint(MINIMAL_BLUEPRINT_SOURCE)
    const asRecord = bp as unknown as Record<string, unknown>
    expectTypeError(() => {
      asRecord.blueprintId = 'team.other'
    }, 'top-level field assignment')
    expectTypeError(() => {
      ;(bp.members as unknown as { push(item: unknown): number }).push({
        templateId: 'sneaky',
        persona: 'Sneak.',
      })
    }, 'members array push')
    expectTypeError(() => {
      ;(bp.metadata as Record<string, unknown>).injected = 'x'
    }, 'metadata key addition')
    expectTypeError(() => {
      ;(bp.leader as { persona?: string }).persona = 'Hacked.'
    }, 'leader persona assignment')
    // The object is unchanged: frozen writes are no-ops or throws, never silent.
    expect(bp.blueprintId).toBe('team.min')
    expect(bp.members.length).toBe(0)
    expect(bp.metadata).toEqual({})
    expect(bp.leader.persona).toBe('Lead.')
  })

  it('the snapshot ref is frozen, keyed blueprintId@revision, and round-trips through the contracts key parser', () => {
    const bp = parseBlueprint(MINIMAL_BLUEPRINT_SOURCE)
    const ref = toBlueprintSnapshotRef(bp)
    expect(isDeepFrozen(ref)).toBe(true)
    expect(ref.blueprintId).toBe('team.min')
    expect(ref.revision).toBe('1')
    if (!/^sha256:[0-9a-f]{64}$/.test(ref.contentHash)) {
      throw new Error(`unexpected content hash shape: ${ref.contentHash}`)
    }
    expect(blueprintSnapshotKey(ref)).toBe('team.min@1')
    expect(blueprintSnapshotKeyOf(bp)).toBe(blueprintSnapshotKey(ref))
    const parsedKey = parseBlueprintSnapshotKey(blueprintSnapshotKey(ref))
    expect(parsedKey).toEqual({ blueprintId: 'team.min', revision: '1' })
  })

  it('BOM + CRLF text normalizes to the identical parsed document and content hash', () => {
    const plain = parseBlueprint(MINIMAL_BLUEPRINT_SOURCE)
    const crlf = parseBlueprint(CRLF_BOM_SOURCE)
    expect(crlf.contentHash).toBe(plain.contentHash)
    expect(crlf).toEqual(plain)
  })

  it('a revision series yields distinct content hashes; content changes change the hash', () => {
    const sources = revisionSeriesSources('team.series', ['1', '2', '3'])
    expect(sources.length).toBe(3)
    const parsed = sources.map((source) => parseBlueprint(source))
    const hashes = parsed.map((entry) => entry.contentHash)
    const distinct = new Set(hashes)
    expect(distinct.size).toBe(3)
    for (const entry of parsed) {
      expect(entry.blueprintId).toBe('team.series')
    }
    const first = parsed[0]
    if (first === undefined) throw new Error('revision series lost its first entry')
    expect(blueprintSnapshotKey(toBlueprintSnapshotRef(first))).toBe('team.series@1')
    // Different persona -> different content -> different hash.
    const base = parseBlueprint(FULL_BLUEPRINT_SOURCE)
    const other = parseBlueprint(FULL_BLUEPRINT_SOURCE_OTHER_PERSONA)
    expect(other.contentHash).not.toBe(base.contentHash)
  })

  it('shuffled top-level key order yields the identical content hash', () => {
    const ordered = parseBlueprint(FULL_BLUEPRINT_SOURCE)
    const shuffled = parseBlueprint(FULL_BLUEPRINT_SOURCE_SHUFFLED)
    expect(shuffled.contentHash).toBe(ordered.contentHash)
    expect(shuffled).toEqual(ordered)
    expect(blueprintSnapshotKey(toBlueprintSnapshotRef(shuffled))).toBe(
      blueprintSnapshotKey(toBlueprintSnapshotRef(ordered)),
    )
  })

  it('contentHash is derived, never a source field (NEG fixture fails with its typed code)', () => {
    expectCode(() => parseBlueprint(NEG_CONTENT_HASH_IN_SOURCE.source), NEG_CONTENT_HASH_IN_SOURCE.code, NEG_CONTENT_HASH_IN_SOURCE.name)
    const result = capture(() => parseBlueprint(NEG_CONTENT_HASH_IN_SOURCE.source))
    if (result.error === undefined) throw new Error('expected the NEG fixture to throw')
    const details = (result.error as { details?: Record<string, unknown> }).details
    if (details === undefined) throw new Error('missing error details')
    expect(details['unknownFields']).toEqual(['contentHash'])
  })

  it('the composition binds a deep-frozen snapshot ref into the TeamSession record', () => {
    const comp = buildTeamComposition({ blueprintSource: MINIMAL_BLUEPRINT_SOURCE, memberCount: 2 })
    const bound = comp.teamSession.blueprint
    expect(isDeepFrozen(bound)).toBe(true)
    expect(bound).toEqual(toBlueprintSnapshotRef(parseBlueprint(MINIMAL_BLUEPRINT_SOURCE)))
    expect(bound.contentHash).toBe(comp.snapshotRef.contentHash)
    expect(comp.blueprint.contentHash).toBe(comp.snapshotRef.contentHash)
    expectTypeError(() => {
      ;(bound as unknown as Record<string, unknown>).contentHash = 'sha256:' + '0'.repeat(64)
    }, 'bound snapshot ref mutation')
    expect(bound.contentHash).toBe(comp.snapshotRef.contentHash)
  })
})
