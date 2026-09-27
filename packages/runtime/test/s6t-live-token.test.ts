/**
 * team-view-sync-complete (frozen decisions 3 + 7) — the deterministic
 * semantic-live-state token of one team.
 *
 * Coverage: the token is a DETERMINISTIC OPAQUE string — the same
 * durable rows + snapshot ALWAYS produce the same token (re-runs,
 * host restarts: no bare numeric counter that would zero); a
 * RESIDENCY change, a member CREATION or DISPOSAL moves the token
 * (a DISPOSED member contributes the frozen `absent` marker — the
 * overlay's exclusion of the row IS the live state change); the
 * encoding is ORDER-INDEPENDENT over the durable rows (the pairs are
 * sorted by instance id — the same set, any row order → the same
 * token); NO clock facts enter the token (a snapshot differing only in
 * `lastActivityAt`-style cells is invisible to the token — only
 * `residency` is read); the format is the closed `lt-v1-<sha256 hex>`
 * (the prefix carries the format version); the empty team has a stable
 * well-defined token.
 *
 * Pure spec: plain doubles, no repositories, no I/O.
 */
import { describe, expect, it } from 'vitest'
import {
  computeTeamLiveToken,
  liveTokenFromPairs,
  LIVE_TOKEN_PREFIX,
  LIVE_TOKEN_RESIDENCY_ABSENT,
  teamLiveStatePairs,
  type TeamLiveStatePair,
} from '../src/plugin/live-token.js'

// ---------------------------------------------------------------------------
// Doubles
// ---------------------------------------------------------------------------

interface Row {
  readonly instanceId: string
}

function snapshotOf(entries: Record<string, string | undefined>): {
  get(instanceId: string): { readonly residency: string } | undefined
} {
  return {
    get(instanceId: string) {
      const residency = entries[instanceId]
      return residency === undefined ? undefined : { residency }
    },
  }
}

const EMPTY_SNAPSHOT = snapshotOf({})

// ---------------------------------------------------------------------------
// Determinism + opacity
// ---------------------------------------------------------------------------

describe('team-view-sync-complete — the deterministic live token (frozen decisions 3 + 7)', () => {
  it('is the closed lt-v1-<sha256 hex> format', () => {
    const token = computeTeamLiveToken(
      [{ instanceId: 'inst-1' }],
      snapshotOf({ 'inst-1': 'resident' }),
    )
    expect(token.startsWith(LIVE_TOKEN_PREFIX)).toBe(true)
    const hex = token.slice(LIVE_TOKEN_PREFIX.length)
    expect(hex.length).toBe(64)
    expect(/^[0-9a-f]{64}$/.test(hex)).toBe(true)
  })

  it('is DETERMINISTIC: the same inputs always produce the same token (re-run / restart stable — no zeroing counter)', () => {
    const rows: Row[] = [
      { instanceId: 'inst-b' },
      { instanceId: 'inst-a' },
      { instanceId: 'inst-c' },
    ]
    const snap = snapshotOf({
      'inst-a': 'resident',
      'inst-b': 'cold',
      'inst-c': 'resuming',
    })
    const first = computeTeamLiveToken(rows, snap)
    for (let i = 0; i < 5; i += 1) {
      expect(computeTeamLiveToken(rows, snap)).toBe(first)
    }
    // A fresh snapshot equal in residency (but a fresh object) is the same.
    expect(computeTeamLiveToken(rows, snapshotOf({ 'inst-a': 'resident', 'inst-b': 'cold', 'inst-c': 'resuming' }))).toBe(first)
  })

  it('is ORDER-INDEPENDENT over the durable rows (the pairs are sorted by instance id)', () => {
    const snap = snapshotOf({ 'inst-a': 'resident', 'inst-b': 'cold' })
    const tokenA = computeTeamLiveToken([{ instanceId: 'inst-a' }, { instanceId: 'inst-b' }], snap)
    const tokenB = computeTeamLiveToken([{ instanceId: 'inst-b' }, { instanceId: 'inst-a' }], snap)
    expect(tokenB).toBe(tokenA)
    // Byte order, not locale order: the sorted pairs are the same either way.
    const pairs = teamLiveStatePairs([{ instanceId: 'inst-b' }, { instanceId: 'inst-a' }], snap)
    expect(pairs.map((pair) => pair.instanceId)).toEqual(['inst-a', 'inst-b'])
  })

  it('MOVES on a residency change (the authoritative live state changed)', () => {
    const rows: Row[] = [{ instanceId: 'inst-1' }, { instanceId: 'inst-2' }]
    const before = computeTeamLiveToken(rows, snapshotOf({ 'inst-1': 'resident', 'inst-2': 'cold' }))
    const after = computeTeamLiveToken(rows, snapshotOf({ 'inst-1': 'resident', 'inst-2': 'resuming' }))
    expect(after).not.toBe(before)
  })

  it('MOVES when a member is created (a new pair enters the set)', () => {
    const before = computeTeamLiveToken([{ instanceId: 'inst-1' }], snapshotOf({ 'inst-1': 'resident' }))
    const after = computeTeamLiveToken(
      [{ instanceId: 'inst-1' }, { instanceId: 'inst-2' }],
      snapshotOf({ 'inst-1': 'resident', 'inst-2': 'resident' }),
    )
    expect(after).not.toBe(before)
  })

  it('MOVES on disposal (the DISPOSED member contributes the frozen `absent` marker — the exclusion IS the live state change)', () => {
    const rows: Row[] = [{ instanceId: 'inst-1' }, { instanceId: 'inst-2' }]
    const before = computeTeamLiveToken(rows, snapshotOf({ 'inst-1': 'resident', 'inst-2': 'resident' }))
    // The overlay skips the DISPOSED row: no live facts for inst-2.
    const after = computeTeamLiveToken(rows, snapshotOf({ 'inst-1': 'resident' }))
    expect(after).not.toBe(before)
    // And the pairs say it explicitly: the disposed member is `absent`.
    const pairs = teamLiveStatePairs(rows, snapshotOf({ 'inst-1': 'resident' }))
    const disposedPair = pairs.find((pair) => pair.instanceId === 'inst-2')
    if (disposedPair === undefined) throw new Error('the disposed member pair is missing')
    expect(disposedPair.residency).toBe(LIVE_TOKEN_RESIDENCY_ABSENT)
  })

  it('MOVES on re-adoption (a previously-absent member becomes live again — a new token, never stale)', () => {
    const rows: Row[] = [{ instanceId: 'inst-1' }]
    const absent = computeTeamLiveToken(rows, EMPTY_SNAPSHOT)
    const live = computeTeamLiveToken(rows, snapshotOf({ 'inst-1': 'resident' }))
    expect(live).not.toBe(absent)
  })

  // ------------------------------------------------------------------
  // NO clock facts (frozen decision 3)
  // ------------------------------------------------------------------

  it('reads ONLY the residency cell: clock facts (lastActivityAt-style cells) are invisible to the token', () => {
    const rows: Row[] = [{ instanceId: 'inst-1' }]
    const withClockA = {
      get(instanceId: string) {
        return { residency: 'resident', lastActivityAt: '2026-09-27T00:00:00.000Z' }
      },
    }
    const withClockB = {
      get(instanceId: string) {
        return { residency: 'resident', lastActivityAt: '2026-12-25T23:59:59.999Z' }
      },
    }
    void rows
    expect(computeTeamLiveToken([{ instanceId: 'inst-1' }], withClockA)).toBe(
      computeTeamLiveToken([{ instanceId: 'inst-1' }], withClockB),
    )
  })

  // ------------------------------------------------------------------
  // Edge shapes
  // ------------------------------------------------------------------

  it('the empty team has a stable well-defined token', () => {
    const a = computeTeamLiveToken([], EMPTY_SNAPSHOT)
    const b = computeTeamLiveToken([], EMPTY_SNAPSHOT)
    expect(a).toBe(b)
    expect(a.startsWith(LIVE_TOKEN_PREFIX)).toBe(true)
    // And it is a DIFFERENT token than a one-member team (no collision
    // of the empty set with any populated set of this shape).
    expect(computeTeamLiveToken([{ instanceId: 'inst-1' }], EMPTY_SNAPSHOT)).not.toBe(a)
  })

  it('liveTokenFromPairs encodes the PAIR LIST (order-sensitive — the caller sorts)', () => {
    const pairA: TeamLiveStatePair[] = [
      { instanceId: 'inst-a', residency: 'resident' },
      { instanceId: 'inst-b', residency: 'cold' },
    ]
    const pairB: TeamLiveStatePair[] = [
      { instanceId: 'inst-b', residency: 'cold' },
      { instanceId: 'inst-a', residency: 'resident' },
    ]
    expect(liveTokenFromPairs(pairB)).not.toBe(liveTokenFromPairs(pairA))
  })
})
