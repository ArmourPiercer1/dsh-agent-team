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
 * A4-PR7 W4 (external review of the merged W1) APPENDS a second describe for
 * the Team-key-bound read state and the render plan — the pure half of the
 * two P2 UI fixes (F1: a failed integrity read must be visible; F2: a state
 * row belongs to exactly one `teamSessionId`). The W1 expectations above are
 * untouched: same-key failure keeping the last good view is W1 behaviour and
 * is re-pinned, not rewritten.
 *
 * @module @dsh-agent-team/client/test/control-corruption-model
 */
import { describe, expect, it } from 'vitest'
import {
  controlCorruptionVisible,
  corruptControlLegsParams,
  corruptionReadFailed,
  corruptionReadSucceeded,
  corruptionStateCleared,
  corruptionStateForKey,
  EMPTY_CONTROL_CORRUPTION_READ_STATE,
  parseControlCorruption,
  planControlCorruptionRender,
  type ControlCorruptionReadState,
  type ControlCorruptionView,
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

// ---------------------------------------------------------------------------
// A4-PR7 W4 (external review of the merged W1) — the Team-key-bound READ STATE
// and the render plan. W1 shipped `{ view, error }` with no owner and rendered
// only `view`; the two P2 findings are the invisibility of a failed read (F1)
// and the possibility of a warning being attributed to the wrong Team (F2).
// The behaviour-preservation legs are pinned HERE, not just the new ones.
// ---------------------------------------------------------------------------

const VIEW_A: ControlCorruptionView = {
  corruptCount: 2,
  truncated: false,
  legs: [{ sequence: 41, disclosesMember: false, requestId: null, approvalCaseId: null }],
}
const VIEW_CLEAN: ControlCorruptionView = { corruptCount: 0, truncated: false, legs: [] }
const ERR = { code: 'method-version-unsupported', message: 'host predates v9' }

describe('A4-PR7 W4 control-corruption read state (team-key ownership)', () => {
  const ownedByA: ControlCorruptionReadState = { key: 'team-a', view: VIEW_A, error: null }

  it('a key change invalidates the previous round immediately (F2)', () => {
    const next = corruptionStateForKey(ownedByA, 'team-b')
    expect(next).toEqual({ key: 'team-b', view: null, error: null })
    // Nothing survives the switch — not the disclosure, not the failure.
    const withError: ControlCorruptionReadState = { ...ownedByA, error: ERR }
    expect(corruptionStateForKey(withError, 'team-b')).toEqual({ key: 'team-b', view: null, error: null })
    // Same key: the state (and its identity) stands — no churn per effect run.
    expect(corruptionStateForKey(ownedByA, 'team-a')).toBe(ownedByA)
    // Switching to "no resolved Team" clears too.
    expect(corruptionStateForKey(ownedByA, null)).toEqual({ key: null, view: null, error: null })
  })

  it('a settle only writes the key it was issued for (a late answer never re-attributes)', () => {
    const nowB: ControlCorruptionReadState = { key: 'team-b', view: null, error: null }
    // A's answers land after the view has moved to B: both are dropped.
    expect(corruptionReadSucceeded(nowB, 'team-a', VIEW_A)).toBe(nowB)
    expect(corruptionReadFailed(nowB, 'team-a', ERR)).toBe(nowB)
    // B's own answers land.
    expect(corruptionReadSucceeded(nowB, 'team-b', VIEW_A)).toEqual({ key: 'team-b', view: VIEW_A, error: null })
    expect(corruptionReadFailed(nowB, 'team-b', ERR)).toEqual({ key: 'team-b', view: null, error: ERR })
  })

  it('a SAME-key failure keeps the last good view (W1 behaviour, unchanged)', () => {
    const failed = corruptionReadFailed(ownedByA, 'team-a', ERR)
    expect(failed).toEqual({ key: 'team-a', view: VIEW_A, error: ERR })
    expect(failed.view).toBe(VIEW_A)
    // A same-key success clears a previous failure and re-owns the row.
    expect(corruptionReadSucceeded(failed, 'team-a', VIEW_CLEAN)).toEqual({
      key: 'team-a',
      view: VIEW_CLEAN,
      error: null,
    })
    // A success is a full replacement, never a merge with an older view.
    expect(corruptionReadSucceeded(ownedByA, 'team-a', VIEW_CLEAN).view).toBe(VIEW_CLEAN)
  })

  it('clear is identity when already empty and drops any inherited row', () => {
    expect(corruptionStateCleared(EMPTY_CONTROL_CORRUPTION_READ_STATE)).toBe(EMPTY_CONTROL_CORRUPTION_READ_STATE)
    expect(corruptionStateCleared(ownedByA)).toBe(EMPTY_CONTROL_CORRUPTION_READ_STATE)
    expect(corruptionStateCleared({ key: null, view: VIEW_A, error: ERR }))
      .toBe(EMPTY_CONTROL_CORRUPTION_READ_STATE)
  })

  it('the render plan separates disclosure / unavailable / clean, and never shows both', () => {
    // Disclosure for the current Team: bar only.
    expect(planControlCorruptionRender(ownedByA, 'team-a')).toEqual({ bar: VIEW_A, unavailableNotice: null })
    // A failed read with nothing to show: the neutral notice (F1) and NO bar.
    const failedOnly: ControlCorruptionReadState = { key: 'team-a', view: null, error: ERR }
    expect(planControlCorruptionRender(failedOnly, 'team-a')).toEqual({ bar: null, unavailableNotice: ERR })
    // A clean read: NEITHER surface — distinguishable from the notice.
    const clean: ControlCorruptionReadState = { key: 'team-a', view: VIEW_CLEAN, error: null }
    expect(planControlCorruptionRender(clean, 'team-a')).toEqual({ bar: null, unavailableNotice: null })
    // A same-key failure over a disclosure keeps the BAR (no notice, W1 rule).
    expect(planControlCorruptionRender(corruptionReadFailed(ownedByA, 'team-a', ERR), 'team-a'))
      .toEqual({ bar: VIEW_A, unavailableNotice: null })
    // F2: a row owned by another Team, or no resolved Team, renders nothing.
    expect(planControlCorruptionRender(ownedByA, 'team-b')).toEqual({ bar: null, unavailableNotice: null })
    expect(planControlCorruptionRender(failedOnly, 'team-b')).toEqual({ bar: null, unavailableNotice: null })
    expect(planControlCorruptionRender(ownedByA, null)).toEqual({ bar: null, unavailableNotice: null })
    expect(planControlCorruptionRender(EMPTY_CONTROL_CORRUPTION_READ_STATE, 'team-a'))
      .toEqual({ bar: null, unavailableNotice: null })
    // The two surfaces are mutually exclusive on every row shape above.
    for (const state of [ownedByA, failedOnly, clean, EMPTY_CONTROL_CORRUPTION_READ_STATE]) {
      for (const key of ['team-a', 'team-b', null]) {
        const plan = planControlCorruptionRender(state, key)
        expect(plan.bar === null || plan.unavailableNotice === null).toBe(true)
      }
    }
  })
})
