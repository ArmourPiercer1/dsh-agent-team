/**
 * P8-T1 projection contract: the nullable live overlay (must-test).
 *
 * `liveActivity` is ALWAYS a present key on every member projection row:
 * its value is `null` when the live source has no facts, otherwise a
 * `MemberLiveActivityDto` (residency required). The durable facts live in
 * `activity` (absent-key discipline) — the durable bytes of a projection
 * must be independent of the overlay (DevPlan §21.2: the projection source
 * is TeamDomain + an optional live overlay, never the session logs).
 */
import { describe, expect, it } from 'vitest'
import {
  canonicalJsonStringify,
  parseTeamProjection,
  serializeTeamProjection,
  RESIDENCY_STATE_VALUES,
} from '../src/index.js'
import {
  rawLeaderMember,
  rawMember,
  rawProjection,
} from './p8t1-projection-fixtures.js'
import { expectCode } from './helpers.js'

/** Re-canonicalize the projection JSON with every member liveActivity key removed. */
function durableBytesOf(json: string): string {
  const parsed = JSON.parse(json) as { members: Array<Record<string, unknown>> }
  for (const member of parsed.members) delete member.liveActivity
  return canonicalJsonStringify(parsed)
}

function noOverlayProjection(): Record<string, unknown> {
  return rawProjection({
    members: [rawLeaderMember({ liveActivity: null }), rawMember({ liveActivity: null })],
  })
}

describe('p8t1 projection nullable live overlay (DevPlan §21.2)', () => {
  it('the liveActivity key is always present on every member row', () => {
    const withOverlay = parseTeamProjection(rawProjection())
    const withoutOverlay = parseTeamProjection(noOverlayProjection())
    for (const dto of [withOverlay, withoutOverlay]) {
      for (const member of dto.members) {
        expect(Object.hasOwn(member, 'liveActivity')).toBe(true)
      }
    }
  })

  it('the no-overlay value is exactly null (never absent, never undefined)', () => {
    const dto = parseTeamProjection(noOverlayProjection())
    for (const member of dto.members) {
      expect(member.liveActivity).toBe(null)
    }
  })

  it('a present overlay parses with its residency fact', () => {
    const dto = parseTeamProjection(rawProjection())
    expect(dto.members[0]!.liveActivity!.residency).toBe('resident')
    expect(dto.members[1]!.liveActivity!.residency).toBe('resuming')
  })

  it('a present overlay without residency is rejected (residency is required)', () => {
    expectCode(
      () =>
        parseTeamProjection(
          rawProjection({
            members: [rawLeaderMember({ liveActivity: { currentAction: 'typing' } }), rawMember()],
          }),
        ),
      'MALFORMED_DTO',
    )
  })

  it('an unknown live overlay field is rejected (closed shape)', () => {
    expectCode(
      () =>
        parseTeamProjection(
          rawProjection({
            members: [
              rawLeaderMember({ liveActivity: { residency: 'resident', extra: 1 } }),
              rawMember(),
            ],
          }),
        ),
      'MALFORMED_DTO',
    )
  })

  it('residency is the closed three-state set (UI §24)', () => {
    expect([...RESIDENCY_STATE_VALUES].sort()).toEqual(['cold', 'resident', 'resuming'])
    expectCode(
      () =>
        parseTeamProjection(
          rawProjection({
            members: [rawLeaderMember({ liveActivity: { residency: 'offline' } }), rawMember()],
          }),
        ),
      'MALFORMED_DTO',
    )
  })

  it('the durable bytes are independent of the overlay', () => {
    const withOverlay = serializeTeamProjection(parseTeamProjection(rawProjection()))
    const withoutOverlay = serializeTeamProjection(parseTeamProjection(noOverlayProjection()))
    expect(durableBytesOf(withOverlay)).toBe(durableBytesOf(withoutOverlay))
    // The raw bytes differ exactly because the overlay is present: the
    // no-overlay serialization carries JSON null at the liveActivity key.
    expect(withoutOverlay.includes('"liveActivity":null')).toBe(true)
    expect(withOverlay.includes('"liveActivity":null')).toBe(false)
  })

  it('the durable activity key is absent when not carried (absent-key discipline)', () => {
    const dto = parseTeamProjection(
      rawProjection({ members: [rawLeaderMember(), rawMember({ activity: undefined })] }),
    )
    for (const member of dto.members) {
      expect(Object.hasOwn(member, 'activity')).toBe(false)
    }
    const withActivity = parseTeamProjection(rawProjection())
    expect(Object.hasOwn(withActivity.members[1]!, 'activity')).toBe(true)
  })
})
