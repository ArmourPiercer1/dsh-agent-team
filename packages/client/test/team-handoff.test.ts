/**
 * Handoff model (P9-T8, S5-D; plan S5-D + Gate P9-G5; UI doc §32;
 * Architecture §34): the `handoff.prepare` one-shot summary value parser
 * (read-only preview — no durable write), the `handoff.create` state
 * narrowing over the frozen `HandoffOperationState` wire mirror (all
 * five kinds + the fail-safe `unknown` arm), and the §32.4 triad mapping
 * per plan §10.5 (retry idempotent by `(sourceSessionId, requestToken)`
 * — SAME token for `creation-failed`, FRESH token for
 * `awaiting-decision`; continue/cancel are client-local decisions, no
 * backend method).
 *
 * Legacy spec evidence: NEW module (the handoff flow is vNext-only —
 * the frozen Remote wire carries it; the legacy fork has no Start-Team-
 * From-Here object model); no legacy test to migrate or drop.
 */
import { describe, expect, it } from 'vitest'
import type { RemoteSafeRecord } from '../../remote/src/index.js'
import {
  HANDOFF_DECISION_OPTIONS,
  handoffDecisionActions,
  handoffRetryPlan,
  isHandoffDecisionOption,
  parseHandoffCreateState,
  parseHandoffPrepareValue,
} from '../src/model/team-handoff.js'

describe('handoffDecisionOptions closed set', () => {
  it('exposes the frozen triad in canonical order', () => {
    expect([...HANDOFF_DECISION_OPTIONS]).toEqual([
      'retry',
      'continue-without-handoff',
      'cancel',
    ])
  })

  it('accepts the triad and rejects everything else', () => {
    for (const option of HANDOFF_DECISION_OPTIONS) {
      expect(isHandoffDecisionOption(option)).toBe(true)
    }
    expect(isHandoffDecisionOption('abort')).toBe(false)
    expect(isHandoffDecisionOption('')).toBe(false)
  })
})

describe('parseHandoffPrepareValue', () => {
  it('parses the one-shot summary (title + compressed bullets)', () => {
    const wire: RemoteSafeRecord = {
      sourceSessionId: 'session-a',
      summary: {
        title: 'Migrate the ledger export',
        bullets: ['Step 1: schema', 'Step 2: backfill'],
      },
    }
    expect(parseHandoffPrepareValue(wire)).toEqual({
      sourceSessionId: 'session-a',
      title: 'Migrate the ledger export',
      bullets: ['Step 1: schema', 'Step 2: backfill'],
    })
  })

  it('empty bullets are valid (a title-only summary)', () => {
    const wire: RemoteSafeRecord = {
      sourceSessionId: 'session-a',
      summary: { title: 'Only a title', bullets: [] },
    }
    expect(parseHandoffPrepareValue(wire).bullets).toEqual([])
  })

  it('throws the stable malformed prefix for a missing title', () => {
    expect(() =>
      parseHandoffPrepareValue({
        sourceSessionId: 'session-a',
        summary: { bullets: [] },
      }),
    ).toThrow('HANDOFF_MALFORMED: title must be a string')
  })

  it('throws on non-string bullets', () => {
    expect(() =>
      parseHandoffPrepareValue({
        sourceSessionId: 'session-a',
        summary: { title: 't', bullets: [42] },
      }),
    ).toThrow('HANDOFF_MALFORMED: summary.bullets must be a string array')
  })

  it('throws when the top-level value is not an object', () => {
    expect(() => parseHandoffPrepareValue('nope')).toThrow(
      'HANDOFF_MALFORMED: value must be an object',
    )
  })
})

describe('parseHandoffCreateState (the HandoffOperationState wire mirror)', () => {
  it('narrowed kind: completed (team identity extracted)', () => {
    const wire: RemoteSafeRecord = {
      state: {
        kind: 'completed',
        replayed: false,
        team: { teamSessionId: 'team-1', rootSessionId: 'root-1' },
      },
    }
    expect(parseHandoffCreateState(wire)).toEqual({
      kind: 'completed',
      replayed: false,
      teamSessionId: 'team-1',
      rootSessionId: 'root-1',
    })
  })

  it('narrowed kind: completed-without-handoff (replayed)', () => {
    const wire: RemoteSafeRecord = {
      state: {
        kind: 'completed-without-handoff',
        replayed: true,
        team: { teamSessionId: 'team-1', rootSessionId: 'root-1' },
      },
    }
    expect(parseHandoffCreateState(wire)).toEqual({
      kind: 'completed-without-handoff',
      replayed: true,
      teamSessionId: 'team-1',
      rootSessionId: 'root-1',
    })
  })

  it('narrowed kind: canceled (no team)', () => {
    const wire: RemoteSafeRecord = {
      state: { kind: 'canceled', replayed: true },
    }
    expect(parseHandoffCreateState(wire)).toEqual({ kind: 'canceled', replayed: true })
  })

  it('narrowed kind: awaiting-decision (failure verbatim + host options filtered to the closed set)', () => {
    const wire: RemoteSafeRecord = {
      state: {
        kind: 'awaiting-decision',
        replayed: false,
        failure: { code: 'SUMMARIZE_FAILED', message: 'model timeout' },
        options: ['retry', 'bogus-option', 'continue-without-handoff', 'cancel'],
      },
    }
    expect(parseHandoffCreateState(wire)).toEqual({
      kind: 'awaiting-decision',
      replayed: false,
      failureCode: 'SUMMARIZE_FAILED',
      failureMessage: 'model timeout',
      options: ['retry', 'continue-without-handoff', 'cancel'],
    })
  })

  it('narrowed kind: creation-failed (failure verbatim)', () => {
    const wire: RemoteSafeRecord = {
      state: {
        kind: 'creation-failed',
        replayed: false,
        failure: { code: 'TEAM_CREATE_REJECTED', message: 'blocked' },
      },
    }
    expect(parseHandoffCreateState(wire)).toEqual({
      kind: 'creation-failed',
      replayed: false,
      failureCode: 'TEAM_CREATE_REJECTED',
      failureMessage: 'blocked',
    })
  })

  it('a future kind lands in the fail-safe unknown arm (never a crash)', () => {
    const rawState: RemoteSafeRecord = {
      kind: 'brand-new-kind',
      replayed: false,
      mystery: 1,
    }
    expect(parseHandoffCreateState({ state: rawState })).toEqual({
      kind: 'unknown',
      raw: rawState,
    })
  })

  it('throws the stable malformed prefix when the state is absent', () => {
    expect(() => parseHandoffCreateState({})).toThrow(
      'HANDOFF_MALFORMED: state must be an object',
    )
  })

  it('throws when the team identity is missing on a completed state', () => {
    expect(() =>
      parseHandoffCreateState({
        state: { kind: 'completed', replayed: false },
      }),
    ).toThrow('HANDOFF_MALFORMED: team must be an object')
  })

  it('throws when the top-level value is not an object', () => {
    expect(() => parseHandoffCreateState(null)).toThrow(
      'HANDOFF_MALFORMED: value must be an object',
    )
  })
})

describe('handoffDecisionActions (the §32.4 triad mapping)', () => {
  const awaiting = (options: readonly string[]) =>
    parseHandoffCreateState({
      state: {
        kind: 'awaiting-decision',
        replayed: false,
        failure: { code: 'C', message: 'm' },
        options: [...options],
      },
    })

  it('awaiting-decision → the host-surfaced options', () => {
    expect(handoffDecisionActions(awaiting(['cancel']))).toEqual(['cancel'])
  })

  it('awaiting-decision with an empty/absent options array → the full frozen triad', () => {
    expect(handoffDecisionActions(awaiting([]))).toEqual([
      'retry',
      'continue-without-handoff',
      'cancel',
    ])
    expect(handoffDecisionActions(
      parseHandoffCreateState({
        state: {
          kind: 'awaiting-decision',
          replayed: false,
          failure: { code: 'C', message: 'm' },
        },
      }),
    )).toEqual(['retry', 'continue-without-handoff', 'cancel'])
  })

  it('creation-failed → RETRY only (host re-drives creation; no wire decision channel)', () => {
    const failed = parseHandoffCreateState({
      state: {
        kind: 'creation-failed',
        replayed: false,
        failure: { code: 'C', message: 'm' },
      },
    })
    expect(handoffDecisionActions(failed)).toEqual(['retry'])
  })

  it('terminal states and unknown → no actions', () => {
    for (const wire of [
      { state: { kind: 'completed', replayed: false, team: { teamSessionId: 't', rootSessionId: 'r' } } },
      { state: { kind: 'completed-without-handoff', replayed: false, team: { teamSessionId: 't', rootSessionId: 'r' } } },
      { state: { kind: 'canceled', replayed: false } },
      { state: { kind: 'mystery', replayed: false } },
    ]) {
      expect(handoffDecisionActions(parseHandoffCreateState(wire))).toEqual([])
    }
  })
})

describe('handoffRetryPlan (plan §10.5 idempotency rule)', () => {
  it('creation-failed → SAME token (host re-drives creation idempotently)', () => {
    const failed = parseHandoffCreateState({
      state: {
        kind: 'creation-failed',
        replayed: false,
        failure: { code: 'C', message: 'm' },
      },
    })
    expect(handoffRetryPlan(failed, 'session-a', 'handoff-create-1', 'handoff-create-2')).toEqual({
      sourceSessionId: 'session-a',
      requestToken: 'handoff-create-1',
      freshToken: false,
    })
  })

  it('awaiting-decision → FRESH token (a same-token re-invocation would only replay the stored failure)', () => {
    const awaiting = parseHandoffCreateState({
      state: {
        kind: 'awaiting-decision',
        replayed: false,
        failure: { code: 'C', message: 'm' },
        options: ['retry', 'continue-without-handoff', 'cancel'],
      },
    })
    expect(handoffRetryPlan(awaiting, 'session-a', 'handoff-create-1', 'handoff-create-2')).toEqual({
      sourceSessionId: 'session-a',
      requestToken: 'handoff-create-2',
      freshToken: true,
    })
  })

  it('no retry plan for terminal states', () => {
    const completed = parseHandoffCreateState({
      state: {
        kind: 'completed',
        replayed: false,
        team: { teamSessionId: 't', rootSessionId: 'r' },
      },
    })
    expect(
      handoffRetryPlan(completed, 'session-a', 'handoff-create-1', 'handoff-create-2'),
    ).toBe(null)
  })
})
