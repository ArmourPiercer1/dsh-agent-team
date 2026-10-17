/**
 * a5p7-vnext-field-mapping.test.ts — the C-VNEXT consumption surface:
 * default deny, no implicit defaults, no target collisions, frozen output.
 * The v3 production document format is untouched by this lane; what is
 * pinned here is how a CONSUMER must behave toward fields it was not told.
 *
 * @module test/a5p7-vnext-field-mapping
 */
import { describe, expect, it } from 'vitest'
import { declareFieldMapping, projectThroughMap } from '../vnext-field-mapping/src/index.js'

describe('a5p7 C-VNEXT field mapping — default deny', () => {
  const spec = declareFieldMapping([
    { sourcePath: 'id', targetKey: 'jobId' },
    { sourcePath: 'meta.owner.member', targetKey: 'owner' },
    { sourcePath: 'tags', targetKey: 'tags' },
  ])

  it('a declared map builds; empty maps and target collisions are declaration-time refusals', () => {
    expect(spec.ok).toBe(true)
    expect(declareFieldMapping([]).ok).toBe(false)
    const clash = declareFieldMapping([
      { sourcePath: 'a', targetKey: 'x' },
      { sourcePath: 'b', targetKey: 'x' },
    ])
    expect(clash.ok).toBe(false)
    if (!clash.ok) expect(clash.code).toBe('duplicate-target')
    const bad = declareFieldMapping([{ sourcePath: 'a..b', targetKey: 'x' }])
    expect(bad.ok).toBe(false)
    if (!bad.ok) expect(bad.code).toBe('invalid-path')
  })

  it('a fully covered document projects with the declared targets and nothing else', () => {
    if (!spec.ok) throw new Error('map should build')
    const res = projectThroughMap(spec.map, {
      id: 'j-1',
      meta: { owner: { member: 'inst-1' } },
      tags: ['a', 'b'],
    })
    expect(res.ok).toBe(true)
    if (res.ok) {
      expect(res.value).toEqual({ jobId: 'j-1', owner: 'inst-1', tags: ['a', 'b'] })
      expect(Object.isFrozen(res.value)).toBe(true)
      expect(() => {
        ;(res.value as { jobId: string }).jobId = 'tampered'
      }).toThrow(TypeError)
    }
  })

  it('DEFAULT DENY: one unmapped source field refuses the WHOLE projection, naming it', () => {
    if (!spec.ok) throw new Error('map should build')
    const res = projectThroughMap(spec.map, {
      id: 'j-1',
      meta: { owner: { member: 'inst-1' } },
      tags: [],
      smuggledInV4: { surprise: true },
    })
    expect(res.ok).toBe(false)
    if (!res.ok) {
      expect(res.code).toBe('unmapped-source-field')
      expect(res.fields).toEqual(['smuggledInV4.surprise'])
    }
  })

  it('NO IMPLICIT DEFAULTS: a missing declared source is a refusal, not an undefined', () => {
    if (!spec.ok) throw new Error('map should build')
    const res = projectThroughMap(spec.map, {
      id: 'j-1',
      // meta.owner.member absent; tags present
      tags: [],
    })
    expect(res.ok).toBe(false)
    if (!res.ok) {
      expect(res.code).toBe('missing-source-field')
      expect(res.fields).toEqual(['meta.owner.member'])
    }
  })

  it('a null-valued declared field is PRESENT (absent means absent, null means null)', () => {
    if (!spec.ok) throw new Error('map should build')
    const res = projectThroughMap(spec.map, {
      id: null,
      meta: { owner: { member: 'inst-1' } },
      tags: [],
    })
    expect(res.ok).toBe(true)
    if (res.ok) expect(res.value.jobId).toBe(null)
  })

  it('arrays are LEAVES: an array field maps as a whole, never per element, and is cloned out', () => {
    if (!spec.ok) throw new Error('map should build')
    const source = { id: 'j-1', meta: { owner: { member: 'm' } }, tags: ['x'] }
    const res = projectThroughMap(spec.map, source)
    expect(res.ok).toBe(true)
    if (res.ok) {
      source.tags.push('mutated-after-projection')
      expect(res.value.tags).toEqual(['x']) // structuredClone: no aliasing
    }
  })
})
