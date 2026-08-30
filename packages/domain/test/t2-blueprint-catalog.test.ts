/**
 * P3-T2 — catalog: read-only queries over parsed blueprints, loud failure
 * on missing/duplicate keys, and the `BlueprintCatalogSource` seam
 * (in-memory sources only — the domain package performs no I/O).
 *
 * @module @dsh-agent-team/domain/test/t2-blueprint-catalog
 */

import { describe, expect, it } from 'vitest'

import {
  blueprintSnapshotKeyOf,
  createBlueprintCatalog,
  createBlueprintCatalogFromSource,
  parseBlueprint,
} from '../blueprint/src/index.js'
import type { BlueprintCatalogSource, TeamBlueprint } from '../blueprint/src/index.js'
import { revisionSource } from '../blueprint/testdata/fixtures.js'
import { expectCode, expectErrorDetails } from './t2-helpers.js'

/** An in-memory catalog source (no I/O anywhere). */
function inMemorySource(docs: Record<string, string>): BlueprintCatalogSource {
  const names = Object.keys(docs)
  return {
    listSources: () => names,
    readSource: (name: string) => {
      const doc = docs[name]
      if (doc === undefined) throw new Error(`no such source: ${name}`)
      return doc
    },
  }
}

const alphaEntries: TeamBlueprint[] = ['1', '2', '10', 'beta'].map((r) =>
  parseBlueprint(revisionSource('team.alpha', r, `Lead of revision ${r}.`)),
)
const minEntries: TeamBlueprint[] = ['3'].map((r) =>
  parseBlueprint(revisionSource('team.min', r, `Lead of revision ${r}.`)),
)
const catalog = createBlueprintCatalog([...alphaEntries, ...minEntries])

describe('t2 catalog: basic queries', () => {
  it('lists blueprint ids sorted lexicographically', () => {
    expect(catalog.blueprintIds).toEqual(['team.alpha', 'team.min'])
  })

  it('hasBlueprint reports presence', () => {
    expect(catalog.hasBlueprint('team.alpha')).toBe(true)
    expect(catalog.hasBlueprint('team.ghost')).toBe(false)
  })

  it('rejects malformed ids loudly', () => {
    expectCode(() => catalog.hasBlueprint('bad id'), 'INVALID_BLUEPRINT_ID')
  })

  it('resolves the exact pair to the same stored instance', () => {
    expect(catalog.resolve('team.alpha', '1')).toBe(alphaEntries[0])
    expect(catalog.resolve('team.min', '3')).toBe(minEntries[0])
  })

  it('resolves latest under the documented order', () => {
    expect(catalog.resolveLatest('team.alpha').revision).toBe('beta')
    expect(catalog.resolveLatest('team.min').revision).toBe('3')
  })

  it('fails loud on a missing blueprint id', () => {
    expectErrorDetails(
      () => catalog.resolve('team.ghost', '1'),
      'MALFORMED_DTO',
      { reason: 'blueprint-not-found', blueprintId: 'team.ghost' },
    )
    expectErrorDetails(
      () => catalog.resolveLatest('team.ghost'),
      'MALFORMED_DTO',
      { reason: 'blueprint-not-found' },
    )
    expectErrorDetails(
      () => catalog.listRevisions('team.ghost'),
      'MALFORMED_DTO',
      { reason: 'blueprint-not-found' },
    )
  })

  it('fails loud on a revision that does not exist', () => {
    expectErrorDetails(
      () => catalog.resolve('team.alpha', '999'),
      'MALFORMED_DTO',
      { reason: 'blueprint-not-found', blueprintId: 'team.alpha' },
    )
  })

  it('fails loud on malformed revision strings', () => {
    expectCode(() => catalog.resolve('team.alpha', 'bad rev'), 'INVALID_BLUEPRINT_REVISION')
  })

  it('snapshotOf builds the identity triple and the display key agrees', () => {
    const resolved = catalog.resolve('team.alpha', '1')
    const ref = catalog.snapshotOf('team.alpha', '1')
    expect(ref.blueprintId).toBe('team.alpha')
    expect(ref.revision).toBe('1')
    expect(ref.contentHash).toBe(resolved.contentHash)
    expect(blueprintSnapshotKeyOf(resolved)).toBe('team.alpha@1')
  })
})

describe('t2 catalog: duplicate handling', () => {
  it('rejects a duplicate (blueprintId, revision) pair at construction', () => {
    const a = parseBlueprint(revisionSource('team.dup', '1', 'A.'))
    const b = parseBlueprint(revisionSource('team.dup', '1', 'B.'))
    expectErrorDetails(() => createBlueprintCatalog([a, b]), 'MALFORMED_DTO', {
      reason: 'duplicate-blueprint-revision',
      blueprintId: 'team.dup',
      revision: '1',
    })
  })

  it('accepts the same id at different revisions', () => {
    const a = parseBlueprint(revisionSource('team.dup', '1', 'A.'))
    const b = parseBlueprint(revisionSource('team.dup', '2', 'B.'))
    const built = createBlueprintCatalog([a, b])
    expect(built.listRevisions('team.dup')).toEqual(['1', '2'])
  })

  it('an empty catalog is legal', () => {
    const empty = createBlueprintCatalog([])
    expect(empty.blueprintIds).toEqual([])
    expect(empty.hasBlueprint('team.min')).toBe(false)
    expectErrorDetails(
      () => empty.resolveLatest('team.min'),
      'MALFORMED_DTO',
      { reason: 'blueprint-not-found' },
    )
  })
})

describe('t2 catalog: source seam', () => {
  it('builds a catalog from an in-memory source', () => {
    const source = inMemorySource({
      'alpha-1.md': revisionSource('team.alpha', '1', 'A.'),
      'alpha-2.md': revisionSource('team.alpha', '2', 'B.'),
      'min-1.md': revisionSource('team.min', '1', 'C.'),
    })
    const built = createBlueprintCatalogFromSource(source)
    expect(built.blueprintIds).toEqual(['team.alpha', 'team.min'])
    expect(built.resolveLatest('team.alpha').revision).toBe('2')
    expect(built.resolve('team.min', '1').leader.persona).toBe('C.')
  })

  it('annotates parse failures with the source name', () => {
    const source = inMemorySource({
      'good.md': revisionSource('team.alpha', '1', 'A.'),
      'bad.md': '---\nschemaVersion: 9\n---\n',
    })
    expectErrorDetails(
      () => createBlueprintCatalogFromSource(source),
      'SCHEMA_VERSION_MISMATCH',
      { sourceName: 'bad.md', schemaVersion: 9 },
    )
  })

  it('fails loud on a duplicate pair across two sources', () => {
    const source = inMemorySource({
      'a.md': revisionSource('team.dup', '1', 'A.'),
      'b.md': revisionSource('team.dup', '1', 'B.'),
    })
    expectErrorDetails(
      () => createBlueprintCatalogFromSource(source),
      'MALFORMED_DTO',
      { reason: 'duplicate-blueprint-revision' },
    )
  })
})
