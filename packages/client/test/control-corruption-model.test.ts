/**
 * control-corruption-model.test.ts — A4-PR7 W1: the pure client model for
 * the corrupt-leg warning bar (`model/control-corruption.ts`).
 *
 * Pinned laws (RULING 5-B, warning-first; 严禁客户端复刻严格读者):
 *  - the parse is DEFENSIVE and FAIL-SAFE: every malformed shape returns
 *    `null` (the bar hides) and nothing throws — the client never patches
 *    an invented value into a corrupt disclosure;
 *  - the model CARRIES the server's cells verbatim: exact `corruptCount`,
 *    the service's row ORDER (never re-sorted), the real
 *    `disclosesMember` flag (an unattributable row stays unattributable —
 *    Team-level wording is the renderer's law over this flag, and the
 *    model never upgrades it);
 *  - `controlCorruptionVisible` is the ONLY visibility decision: a clean
 *    read (count 0) shows no bar; a malformed read (`null`) shows no bar.
 *
 * @module @dsh-agent-team/client/test/control-corruption-model
 */
import { describe, expect, it } from 'vitest'
import {
  controlCorruptionVisible,
  corruptControlLegsParams,
  parseControlCorruption,
} from '../src/model/control-corruption.js'

describe('A4-PR7 W1 control-corruption model', () => {
  it('builds the closed v9 params: exactly { teamSessionId }', () => {
    expect(corruptControlLegsParams('team-1')).toEqual({ teamSessionId: 'team-1' })
    expect(Object.keys(corruptControlLegsParams('team-1'))).toEqual(['teamSessionId'])
  })

  it('parses the closed corruption wire verbatim (order, count, flags, echoes)', () => {
    const view = parseControlCorruption({
      corruption: {
        teamSessionId: 'team-1',
        corruptCount: 3,
        truncated: true,
        legs: [
          { sequence: 41, disclosesMember: false },
          { sequence: 12, disclosesMember: true, requestId: 'req-1' },
          { sequence: 30, disclosesMember: true, approvalCaseId: 'case-1' },
        ],
      },
    })
    expect(view).not.toBe(null)
    const v = view!
    expect(v.corruptCount).toBe(3)
    expect(v.truncated).toBe(true)
    // the service's order stands (41 before 12): the client never re-sorts.
    expect(v.legs.map(leg => leg.sequence)).toEqual([41, 12, 30])
    expect(v.legs[0]).toEqual({
      sequence: 41,
      disclosesMember: false,
      requestId: null,
      approvalCaseId: null,
    })
    expect(v.legs[1]?.requestId).toBe('req-1')
    expect(v.legs[2]?.approvalCaseId).toBe('case-1')
  })

  it('a clean report (count 0) parses but shows no bar', () => {
    const view = parseControlCorruption({
      corruption: { teamSessionId: 'team-1', corruptCount: 0, truncated: false, legs: [] },
    })
    expect(view).not.toBe(null)
    expect(view!.corruptCount).toBe(0)
    expect(controlCorruptionVisible(view)).toBe(false)
  })

  it('every malformed shape is null (hide the bar), never a throw, never a patch', () => {
    const malformed: unknown[] = [
      undefined,
      null,
      'corruption',
      {},
      { corruption: null },
      { corruption: [] },
      { corruption: { teamSessionId: 't', corruptCount: -1, truncated: false, legs: [] } },
      { corruption: { teamSessionId: 't', corruptCount: 1.5, truncated: false, legs: [] } },
      { corruption: { teamSessionId: 't', corruptCount: 1, truncated: 'no', legs: [] } },
      { corruption: { teamSessionId: 't', corruptCount: 1, truncated: false } },
      { corruption: { teamSessionId: 't', corruptCount: 1, truncated: false, legs: 'all' } },
      // a row without its sequence: refused, not invented.
      { corruption: { teamSessionId: 't', corruptCount: 1, truncated: false, legs: [{ disclosesMember: false }] } },
      // a row with a sequence the wire never carries (0).
      { corruption: { teamSessionId: 't', corruptCount: 1, truncated: false, legs: [{ sequence: 0, disclosesMember: false }] } },
      // the attribution flag is the service's — a missing one is malformed.
      { corruption: { teamSessionId: 't', corruptCount: 1, truncated: false, legs: [{ sequence: 7 }] } },
      // an empty echo cell is malformed, not "absent".
      { corruption: { teamSessionId: 't', corruptCount: 1, truncated: false, legs: [{ sequence: 7, disclosesMember: false, requestId: '' }] } },
    ]
    for (const data of malformed) {
      expect(parseControlCorruption(data), JSON.stringify(data)).toBe(null)
    }
  })

  it('visibility: null (failed read) and count 0 hide the bar; count > 0 shows it', () => {
    expect(controlCorruptionVisible(null)).toBe(false)
    expect(
      controlCorruptionVisible({ corruptCount: 1, truncated: false, legs: [] }),
    ).toBe(true)
  })
})
