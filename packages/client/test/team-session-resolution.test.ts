/**
 * P9-T4 (S3-A) — the team projection mirror resolution.
 *
 * Coverage (the §8.10 perspective input, carried as data — no DOM, no
 * session-log scan): own-key hit wins with the `team-root` perspective;
 * a member's bound child session resolves to `member-child` with the
 * live instance id; a disposed history row's child session resolves the
 * same way (history only when no live member claims the session);
 * the live member beats a history row claiming the same child session;
 * the own-key hit beats the member scan (a session that is both a
 * mirror key and another frame's member child is its own team root);
 * an outsider session (or an empty mirror) resolves `undefined`; the
 * member scan is deterministic in `Object.keys` order (first match
 * wins); the resolved frame is the stored reference (identity-stable).
 *
 * Shim-constrained spec (run-tests.mjs): the resolution is synchronous,
 * so every scenario runs inside the `it()` bodies. Matchers used:
 * toBe / toEqual (+ .not) only.
 */
import { describe, expect, it } from 'vitest'
import { resolveTeamProjection, type TeamProjectionMirror } from '../src/state/team-session-resolution.js'
import type { TeamProjectionDto } from '../../contracts/src/index.js'

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

/** One minimal projection frame (plain object; the branded ids are wire-level here). */
function frame(
  teamSessionId: string,
  members: readonly Record<string, unknown>[],
  disposedHistory?: readonly Record<string, unknown>[],
): TeamProjectionDto {
  return {
    schemaVersion: 1,
    teamSessionId,
    blueprint: { blueprintId: 'bp-1', revision: 1, contentHash: 'h-1' },
    generation: 1,
    generatedAt: '2026-08-29T00:00:00.000Z',
    root: { teamSessionId, createdAt: '2026-08-29T00:00:00.000Z', policyState: 'open' },
    templates: [],
    members,
    ledger: { latestSequence: 0, totalEntries: 0, byCategory: {}, pendingControlCount: 0 },
    ...(disposedHistory === undefined ? {} : { disposedHistory }),
  } as unknown as TeamProjectionDto
}

/** One minimal member DTO row. */
function member(instanceId: string, childSessionId: string): Record<string, unknown> {
  return {
    instanceId,
    templateId: 'tpl-1',
    label: `member ${instanceId}`,
    childSessionId,
    workspace: 'wsp',
    createdAt: '2026-08-29T00:00:00.000Z',
    lifecycle: 'RUNNING',
    contextPolicy: 'persistent',
    effectiveConfig: { model: 'm', workspace: 'wsp', permissions: {}, autonomy: 'full' },
    liveActivity: null,
  }
}

/** One minimal disposed-history DTO row. */
function history(instanceId: string, childSessionId: string): Record<string, unknown> {
  return {
    instanceId,
    templateId: 'tpl-1',
    label: `history ${instanceId}`,
    childSessionId,
    createdAt: '2026-08-29T00:00:00.000Z',
    factCount: 1,
    byCategory: { team: 1 },
  }
}

function mirrorOf(...frames: Array<[string, TeamProjectionDto]>): TeamProjectionMirror {
  const plain: Record<string, TeamProjectionDto> = {}
  for (const [key, value] of frames) plain[key] = value
  return plain as unknown as TeamProjectionMirror
}

// ---------------------------------------------------------------------------
// Scenarios
// ---------------------------------------------------------------------------

describe('resolveTeamProjection — own key', () => {
  const teamFrame = frame('team-1', [])
  const otherFrame = frame('team-2', [])

  it('resolves the frame under its own key with the team-root perspective', () => {
    const res = resolveTeamProjection(mirrorOf(['team-1', teamFrame], ['team-2', otherFrame]), 'team-1')
    expect(res).not.toBe(undefined)
    if (res === undefined) throw new Error('unreachable')
    expect(res.team).toBe(teamFrame)
    expect(res.perspective).toEqual({ kind: 'team-root' })
  })

  it('the own-key hit beats the member scan of another frame', () => {
    // 'team-2' is a mirror key AND a member child of team-1's frame: it is
    // its own team root, never the other team's member.
    const res = resolveTeamProjection(
      mirrorOf(
        ['team-1', frame('team-1', [member('i1', 'team-2')])],
        ['team-2', otherFrame],
      ),
      'team-2',
    )
    expect(res).not.toBe(undefined)
    if (res === undefined) throw new Error('unreachable')
    expect(res.team).toBe(otherFrame)
    expect(res.perspective).toEqual({ kind: 'team-root' })
  })
})

describe('resolveTeamProjection — member child', () => {
  const teamFrame = frame('team-1', [member('i1', 'child-1'), member('i2', 'child-2')])

  it('resolves a bound member child to the member-child perspective', () => {
    const res = resolveTeamProjection(mirrorOf(['team-1', teamFrame]), 'child-2')
    expect(res).not.toBe(undefined)
    if (res === undefined) throw new Error('unreachable')
    expect(res.team).toBe(teamFrame)
    expect(res.perspective).toEqual({ kind: 'member-child', memberInstanceId: 'i2' })
  })
})

describe('resolveTeamProjection — disposed history', () => {
  it('resolves a disposed child session through the history row', () => {
    const teamFrame = frame('team-1', [member('i1', 'child-live')], [history('i9', 'child-gone')])
    const res = resolveTeamProjection(mirrorOf(['team-1', teamFrame]), 'child-gone')
    expect(res).not.toBe(undefined)
    if (res === undefined) throw new Error('unreachable')
    expect(res.team).toBe(teamFrame)
    expect(res.perspective).toEqual({ kind: 'member-child', memberInstanceId: 'i9' })
  })

  it('a live member claiming the same child session beats the history row', () => {
    const teamFrame = frame(
      'team-1',
      [member('i1', 'child-shared')],
      [history('i9', 'child-shared')],
    )
    const res = resolveTeamProjection(mirrorOf(['team-1', teamFrame]), 'child-shared')
    expect(res).not.toBe(undefined)
    if (res === undefined) throw new Error('unreachable')
    expect(res.perspective).toEqual({ kind: 'member-child', memberInstanceId: 'i1' })
  })
})

describe('resolveTeamProjection — outsiders and order', () => {
  it('an outsider session resolves undefined', () => {
    const teamFrame = frame('team-1', [member('i1', 'child-1')])
    expect(resolveTeamProjection(mirrorOf(['team-1', teamFrame]), 'outsider')).toBe(undefined)
  })

  it('an empty mirror resolves undefined', () => {
    expect(resolveTeamProjection(mirrorOf(), 'team-1')).toBe(undefined)
  })

  it('a session matching no frame and no member resolves undefined', () => {
    const teamFrame = frame('team-1', [member('i1', 'child-1')])
    expect(resolveTeamProjection(mirrorOf(['team-1', teamFrame]), 'team-1-nope')).toBe(undefined)
  })

  it('the member scan is deterministic in Object.keys order (first match wins)', () => {
    // Both frames claim child 'x'; the mirror is built with team-b first,
    // so team-b's member must win regardless of insertion in the frames.
    const frameA = frame('team-a', [member('ia', 'x')])
    const frameB = frame('team-b', [member('ib', 'x')])
    const res = resolveTeamProjection(mirrorOf(['team-b', frameB], ['team-a', frameA]), 'x')
    expect(res).not.toBe(undefined)
    if (res === undefined) throw new Error('unreachable')
    expect(res.team).toBe(frameB)
    expect(res.perspective).toEqual({ kind: 'member-child', memberInstanceId: 'ib' })
  })
})
