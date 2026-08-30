/**
 * P3-T2 — immutability: parsed blueprints, snapshot refs, and catalogs are
 * frozen; mutations throw in strict mode; the freeze boundary sits in
 * `parseBlueprint` (the normalized core is not frozen).
 *
 * @module @dsh-agent-team/domain/test/t2-blueprint-immutability
 */

import { describe, expect, it } from 'vitest'

import {
  createBlueprintCatalog,
  parseBlueprint,
  toBlueprintSnapshotRef,
  validateBlueprintDocument,
} from '../blueprint/src/index.js'
import {
  FULL_BLUEPRINT_SOURCE,
  MINIMAL_BLUEPRINT_SOURCE,
  revisionSource,
} from '../blueprint/testdata/fixtures.js'
import { isDeepFrozen } from './t2-helpers.js'

describe('t2 immutability: parsed blueprint', () => {
  const bp = parseBlueprint(FULL_BLUEPRINT_SOURCE)

  it('is deeply frozen', () => {
    expect(Object.isFrozen(bp)).toBe(true)
    expect(isDeepFrozen(bp)).toBe(true)
  })

  it('rejects top-level mutation in strict mode', () => {
    const target = bp as unknown as Record<string, unknown>
    expect(() => {
      target['displayName'] = 'x'
    }).toThrow()
  })

  it('rejects nested template mutation', () => {
    const target = bp.leader as unknown as Record<string, unknown>
    expect(() => {
      target['persona'] = 'x'
    }).toThrow()
  })

  it('rejects nested record mutation (quotas)', () => {
    const team = bp.quotas?.team as unknown as Record<string, unknown> | undefined
    expect(team).not.toBe(undefined)
    expect(() => {
      if (team !== undefined) team['maxInstances'] = 100
    }).toThrow()
  })

  it('rejects array mutation (members)', () => {
    const arr = bp.members as unknown as Array<unknown>
    expect(() => {
      arr.push('x')
    }).toThrow()
  })

  it('each parse yields a fresh object with the same content identity', () => {
    const again = parseBlueprint(FULL_BLUEPRINT_SOURCE)
    expect(again).not.toBe(bp)
    expect(again.contentHash).toBe(bp.contentHash)
  })

  it('the validated core is not frozen (the freeze happens in parseBlueprint)', () => {
    const core = validateBlueprintDocument({
      schemaVersion: 1,
      blueprintId: 'team.min',
      revision: '1',
      leader: { templateId: 'leader', persona: 'Lead.' },
      members: [],
      requirements: [],
      memberEnvelopes: [],
      policyStates: [],
      metadata: {},
    })
    expect(Object.isFrozen(core)).toBe(false)
  })
})

describe('t2 immutability: snapshot ref and catalog', () => {
  it('the snapshot ref is deep-frozen and mutation throws', () => {
    const bp = parseBlueprint(MINIMAL_BLUEPRINT_SOURCE)
    const ref = toBlueprintSnapshotRef(bp)
    expect(Object.isFrozen(ref)).toBe(true)
    expect(isDeepFrozen(ref)).toBe(true)
    const target = ref as unknown as Record<string, unknown>
    expect(() => {
      target['contentHash'] = 'sha256:0000'
    }).toThrow()
  })

  it('the catalog object and its id list are frozen', () => {
    const catalog = createBlueprintCatalog([
      parseBlueprint(revisionSource('team.c', '1', 'A.')),
    ])
    expect(Object.isFrozen(catalog)).toBe(true)
    expect(Object.isFrozen(catalog.blueprintIds)).toBe(true)
    const ids = catalog.blueprintIds as unknown as Array<unknown>
    expect(() => {
      ids.push('nope')
    }).toThrow()
  })

  it('catalog-listed revisions are frozen arrays', () => {
    const catalog = createBlueprintCatalog([
      parseBlueprint(revisionSource('team.c', '1', 'A.')),
      parseBlueprint(revisionSource('team.c', '2', 'B.')),
    ])
    const revisions = catalog.listRevisions('team.c')
    expect(Object.isFrozen(revisions)).toBe(true)
  })
})
