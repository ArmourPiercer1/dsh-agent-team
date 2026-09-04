/**
 * Legacy inspection model (P9-T8, S5-D; plan S5-D "legacy.inspect
 * banner/zero-state" + Gate P9-G5; UI doc §34; DevPlan §20.6):
 * the `legacy.inspect` wire value narrowing over the closed
 * `LegacyTeamInspection` union (the P7-T7 legacy reader's lossless-JSON
 * mirror) and the §34 zero-state selection.
 *
 * Wire authority: the frozen 23-method catalog — `legacy.inspect` returns
 * `{ inspection }` where `inspection` is the closed union
 * `LegacyTeamView | LegacyFallbackView` (packages/legacy/session-reader
 * types; the port doc ports.ts mirror). The narrowing here is defensive
 * by contract: malformed NESTED fields degrade to null/empty (the
 * reader is best-effort evidence, never vNext authority) while a missing
 * or non-object `inspection` top-level value is a wire violation and
 * throws `LEGACY_MALFORMED`.
 *
 * Legacy spec evidence: this is NEW vNext client surface (the legacy
 * fork has no vNext Team tab to degrade); there is no legacy test to
 * migrate or drop — the legacy reader's own spec (P7-T7) already covers
 * the wire producer side.
 */
import { describe, expect, it } from 'vitest'
import {
  legacyZeroStateKind,
  parseLegacyInspection,
} from '../src/model/team-legacy.js'

describe('parseLegacyInspection — legacy-team view', () => {
  it('decodes the full view verbatim: identity, roster rows, warnings, sessions, member children', () => {
    const value = {
      inspection: {
        status: 'legacy-team',
        team: {
          teamId: 'legacy-team-001',
          leaderSessionId: 'sess-leader-1',
          leaderSelection: 'team-events',
          roster: [
            {
              source: 'home',
              fileName: 'leader.yaml',
              id: 'member-a',
              role: 'leader',
              name: 'Atlas',
              description: 'the coordinator',
            },
            {
              source: 'workspace',
              fileName: 'teammate-1.yaml',
              id: 'member-b',
              role: 'teammate',
              name: 'Bee',
            },
          ],
          rosterWarnings: [{ kind: 'orphan-roster-entry', file: 'x.yaml' }],
          sessions: [{ sessionId: 'sess-1' }, { sessionId: 'sess-2' }],
          memberChildSessionIds: ['child-1', 'child-2'],
        },
      },
    }
    const wire = parseLegacyInspection(value)
    expect(wire).toEqual({
      status: 'legacy-team',
      teamId: 'legacy-team-001',
      leaderSessionId: 'sess-leader-1',
      leaderSelection: 'team-events',
      roster: [
        {
          source: 'home',
          fileName: 'leader.yaml',
          id: 'member-a',
          role: 'leader',
          name: 'Atlas',
          description: 'the coordinator',
        },
        {
          source: 'workspace',
          fileName: 'teammate-1.yaml',
          id: 'member-b',
          role: 'teammate',
          name: 'Bee',
          description: null,
        },
      ],
      rosterWarningCount: 1,
      sessionCount: 2,
      memberChildSessionIds: ['child-1', 'child-2'],
    })
    expect(legacyZeroStateKind(wire)).toBe('legacy-team')
  })

  it('degrades absent roster fields to null/empty instead of throwing', () => {
    const value = {
      inspection: {
        status: 'legacy-team',
        team: {
          roster: [
            { source: 'home', fileName: 'bare.yaml' },
            { source: 'workspace', fileName: 'nonsense-role.yaml', role: 'supervisor' },
          ],
        },
      },
    }
    const wire = parseLegacyInspection(value)
    if (wire.status !== 'legacy-team') throw new Error('unreachable')
    expect(wire.roster[0]!.id).toBe(null)
    expect(wire.roster[0]!.role).toBe(null)
    expect(wire.roster[0]!.name).toBe(null)
    expect(wire.roster[0]!.description).toBe(null)
    // A role outside the closed 'leader' | 'teammate' set degrades to null.
    expect(wire.roster[1]!.role).toBe(null)
    expect(wire.rosterWarningCount).toBe(0)
    expect(wire.sessionCount).toBe(0)
    expect(wire.memberChildSessionIds).toEqual([])
    expect(wire.teamId).toBe(null)
    expect(wire.leaderSessionId).toBe(null)
    expect(wire.leaderSelection).toBe(null)
  })

  it('skips non-object roster rows and degrades non-array collections', () => {
    const value = {
      inspection: {
        status: 'legacy-team',
        team: {
          teamId: 'legacy-team-002',
          roster: [42, null, { source: 'home', fileName: 'ok.yaml', id: 'm1' }],
          rosterWarnings: 'not-an-array',
          sessions: { not: 'an-array' },
          memberChildSessionIds: ['keep', 7, 'drop-non-string'],
        },
      },
    }
    const wire = parseLegacyInspection(value)
    if (wire.status !== 'legacy-team') throw new Error('unreachable')
    expect(wire.roster).toEqual([
      { source: 'home', fileName: 'ok.yaml', id: 'm1', role: null, name: null, description: null },
    ])
    expect(wire.rosterWarningCount).toBe(0)
    expect(wire.sessionCount).toBe(0)
    expect(wire.memberChildSessionIds).toEqual(['keep', 'drop-non-string'])
    expect(wire.leaderSelection).toBe(null)
  })

  it('treats a missing or malformed team object as an empty legacy-team view', () => {
    for (const team of [undefined, null, 42, ['not', 'a', 'record']]) {
      const value = team === undefined ? { inspection: { status: 'legacy-team' } } : { inspection: { status: 'legacy-team', team } }
      const wire = parseLegacyInspection(value)
      if (wire.status !== 'legacy-team') throw new Error('unreachable')
      expect(wire.teamId).toBe(null)
      expect(wire.roster).toEqual([])
      expect(wire.rosterWarningCount).toBe(0)
      expect(wire.sessionCount).toBe(0)
      expect(wire.memberChildSessionIds).toEqual([])
    }
  })
})

describe('parseLegacyInspection — native-fallback view', () => {
  it('fixes reason/degradedTo and counts the native session evidence', () => {
    const value = {
      inspection: {
        status: 'native-fallback',
        reason: 'no-legacy-metadata',
        degradedTo: 'native-chat-trajectory',
        native: [{ sessionId: 'n1' }, { sessionId: 'n2' }, { sessionId: 'n3' }],
      },
    }
    const wire = parseLegacyInspection(value)
    expect(wire).toEqual({
      status: 'native-fallback',
      reason: 'no-legacy-metadata',
      degradedTo: 'native-chat-trajectory',
      nativeSessionCount: 3,
    })
    expect(legacyZeroStateKind(wire)).toBe('ordinary')
  })

  it('degrades a missing/non-array native list to zero sessions', () => {
    const wire = parseLegacyInspection({
      inspection: { status: 'native-fallback' },
    })
    if (wire.status !== 'native-fallback') throw new Error('unreachable')
    expect(wire.nativeSessionCount).toBe(0)
  })
})

describe('parseLegacyInspection — unknown arm and wire violations', () => {
  it('keeps a future status tag verbatim in the fail-safe arm (never dropped)', () => {
    const raw = { status: 'legacy-team-v2-preview', marker: 'future', count: 2 }
    const wire = parseLegacyInspection({ inspection: raw })
    if (wire.status !== 'unknown') throw new Error('unreachable')
    expect(wire.raw).toBe(raw)
    expect(legacyZeroStateKind(wire)).toBe('unknown')
  })

  it('throws LEGACY_MALFORMED when inspection is absent', () => {
    expect(() => parseLegacyInspection({})).toThrow(
      'LEGACY_MALFORMED: inspection must be an object',
    )
  })

  it('throws LEGACY_MALFORMED when inspection is null', () => {
    expect(() => parseLegacyInspection({ inspection: null })).toThrow(
      'LEGACY_MALFORMED: inspection must be an object',
    )
  })

  it('throws LEGACY_MALFORMED when inspection is an array', () => {
    expect(() => parseLegacyInspection({ inspection: ['x'] })).toThrow(
      'LEGACY_MALFORMED: inspection must be an object',
    )
  })

  it('throws LEGACY_MALFORMED when inspection is a bare string', () => {
    expect(() => parseLegacyInspection({ inspection: 'legacy-team' })).toThrow(
      'LEGACY_MALFORMED: inspection must be an object',
    )
  })

  it('throws LEGACY_MALFORMED when the top-level value is not an object', () => {
    expect(() => parseLegacyInspection('nope')).toThrow(
      'LEGACY_MALFORMED: value must be an object',
    )
  })
})
