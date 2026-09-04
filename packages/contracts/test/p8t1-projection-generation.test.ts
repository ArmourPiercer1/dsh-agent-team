/**
 * P8-T1 projection contract: generation monotonicity (must-test).
 *
 * `generation` is the WHOLE-projection monotonic generation (Development
 * Plan §21.4): it starts at 1 and only increases; a client applying an
 * incoming projection MUST reject a stale overwrite. The frozen guard is
 * `isStaleTeamProjection` (per-team: a projection is only comparable with
 * the projection of the SAME teamSessionId).
 */
import { describe, expect, it } from 'vitest'
import { isStaleTeamProjection, parseTeamProjection } from '../src/index.js'
import { rawProjection, rawRoot } from './p8t1-projection-fixtures.js'
import { expectCode } from './helpers.js'

function at(generation: number) {
  return parseTeamProjection(rawProjection({ generation }))
}

describe('p8t1 projection generation (DevPlan §21.4)', () => {
  it('accepts generation 1 as the first stamp', () => {
    expect(at(1).generation).toBe(1)
  })

  it('rejects generation 0 (the stamp starts at 1)', () => {
    expectCode(() => at(0), 'MALFORMED_DTO')
  })

  it('rejects negative, fractional, and non-numeric generations', () => {
    expectCode(() => at(-1), 'MALFORMED_DTO')
    expectCode(() => at(1.5), 'MALFORMED_DTO')
    expectCode(() => parseTeamProjection(rawProjection({ generation: '1' })), 'MALFORMED_DTO')
    expectCode(() => parseTeamProjection(rawProjection({ generation: null })), 'MALFORMED_DTO')
  })

  it('a monotonic sequence parses and is strictly ordered', () => {
    const g1 = at(1)
    const g2 = at(2)
    const g9 = at(9)
    expect(g2.generation).toBeGreaterThan(g1.generation)
    expect(g9.generation).toBeGreaterThan(g2.generation)
  })

  it('stale guard: same team, incoming generation lower than current is stale', () => {
    expect(isStaleTeamProjection(at(5), at(3))).toBe(true)
  })

  it('stale guard: same team, equal generation is stale (no re-apply of the same stamp)', () => {
    expect(isStaleTeamProjection(at(4), at(4))).toBe(true)
  })

  it('stale guard: same team, strictly higher generation is fresh', () => {
    expect(isStaleTeamProjection(at(3), at(7))).toBe(false)
  })

  it('stale guard: a different teamSessionId is never comparable (per-team guard)', () => {
    const other = parseTeamProjection(
      rawProjection({
        teamSessionId: 'session-9',
        root: rawRoot({ teamSessionId: 'session-9' }),
      }),
    )
    expect(isStaleTeamProjection(at(50), other)).toBe(false)
    expect(isStaleTeamProjection(other, at(1))).toBe(false)
  })
})
