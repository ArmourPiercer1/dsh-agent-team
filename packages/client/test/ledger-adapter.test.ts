/**
 * P9-T4 (S3-B / §7.3-§7.4) — the pure ledger-entries → UI ledger model
 * adapter, and the combined `adaptTeamUi` output.
 *
 * Coverage (G3 gates + the §7 frozen rules): entries keep their frozen
 * wire values with the category attached only from the client-local
 * 12-fact mirror (unknown fact type → `category` OMITTED, never guessed;
 * broken identity leaves — non-integer sequence / non-string factType —
 * skip the row); the control chains pair request→decision by the frozen
 * `requestId` (pending flips to false, the decision block carries the
 * decision entry's sequence); an orphan decision is emitted only when the
 * writer's own `scope` names target + action + request sequence (no
 * invented values, otherwise skipped); duplicate requests keep the first;
 * delivered messages carry the recipient pair and NO invented sender
 * (`from` absent); coordination messages are `send-message` only; the
 * activity intervals pair open→close by `correlation` (close without open
 * skipped, second close ignored — the first stands); the §7.4 gate —
 * `progress` rows and `pendingControlByInstance` exist ONLY over a
 * known-complete ledger (partial → `[]` / `{}`); the §7.3 badge overlay —
 * under complete, member rows get `pendingControlCount =
 * pendingControlByInstance[instanceId] ?? 0` (a clean instance is a known
 * zero), under partial they stay `null`; the input is re-sorted by
 * sequence defensively and never mutated.
 *
 * Shim-constrained spec (run-tests.mjs): the adapter is pure and
 * synchronous, so every scenario runs inside the `it()` bodies.
 * Matchers used: toBe / toEqual (+ .not) only.
 */
import { describe, expect, it } from 'vitest'
import { adaptTeamLedger, adaptTeamUi } from '../src/model/ledger-adapter.js'
import { projectionFromWire } from '../src/model/projection-adapter.js'
import type { TeamPerspective } from '../src/state/team-session-resolution.js'
import type { RemoteLedgerEntryValue, RemoteProjectionValue } from '../../remote/src/index.js'

/**
 * Test-only narrowing: a missing row means the fixture or the adapter
 * contract broke, so throw (the shim exposes no toBeDefined matcher, and a
 * silently `undefined` row would mask the assertions that follow).
 */
function must<T>(value: T | undefined, label: string): T {
  if (value === undefined) throw new Error(`missing: ${label}`)
  return value
}

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

/** One frozen ledger entry (plain object; `overrides` allows broken leaves). */
function entry(
  sequence: number,
  factType: string,
  payload: Record<string, unknown>,
  overrides: Record<string, unknown> = {},
): RemoteLedgerEntryValue {
  return {
    schemaVersion: 1,
    sequence,
    rootSessionId: 'root-1',
    factType,
    payload,
    operationId: null,
    createdAt: '2026-08-29T00:00:00.000Z',
    ...overrides,
  } as RemoteLedgerEntryValue
}

const T = '2026-08-29T00:00:00.000Z'

function wireMember(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    instanceId: 'i1',
    templateId: 'tpl-1',
    label: 'Alpha',
    childSessionId: 'child-1',
    workspace: 'wsp',
    createdAt: T,
    lifecycle: 'RUNNING',
    contextPolicy: 'persistent',
    effectiveConfig: { model: 'm', workspace: 'wsp', permissions: {}, autonomy: 'full' },
    liveActivity: null,
    ...overrides,
  }
}

/** One minimal 9-field D-4 wire projection (the `RemoteProjectionValue` shape). */
function wireFrame(overrides: Record<string, unknown> = {}): RemoteProjectionValue {
  return {
    schemaVersion: 1,
    teamSessionId: 'team-1',
    blueprint: { blueprintId: 'bp-1', revision: 1, contentHash: 'h-1' },
    generation: 1,
    generatedAt: T,
    root: { teamSessionId: 'team-1', createdAt: T, policyState: 'open' },
    templates: [],
    members: [],
    ledger: { latestSequence: 0, totalEntries: 0, byCategory: {}, pendingControlCount: 0 },
    ...overrides,
  } as unknown as RemoteProjectionValue
}

const ROOT_PERSPECTIVE: TeamPerspective = { kind: 'team-root' }

// ---------------------------------------------------------------------------
// Entry rows — identity + category
// ---------------------------------------------------------------------------

describe('adaptTeamLedger — entry rows', () => {
  it('keeps the frozen wire values and attaches the category from the 12-fact mirror', () => {
    const model = adaptTeamLedger(
      [entry(1, 'control-request-recorded', { requestId: 'r1' }), entry(2, 'policy-state-transitioned', {})],
      true,
    )
    expect(model.entries.length).toBe(2)
    const first = must(model.entries[0], 'entry 0')
    expect(first.sequence).toBe(1)
    expect(first.category).toBe('control')
    expect(first.factType).toBe('control-request-recorded')
    expect(first.rootSessionId).toBe('root-1')
    expect(first.operationId).toBe(null)
    expect(must(model.entries[1], 'entry 1').category).toBe('policy')
  })

  it('an unknown fact type omits the category (never guessed)', () => {
    const model = adaptTeamLedger([entry(1, 'mystery-fact', {})], true)
    const row = must(model.entries[0], 'entry 0')
    expect(row.factType).toBe('mystery-fact')
    expect('category' in row).toBe(false)
  })

  it('a non-integer sequence or non-string factType skips the row (fail-safe)', () => {
    const model = adaptTeamLedger(
      [
        entry(1.5 as number, 'team-work-admitted', {}),
        entry(2, 42 as unknown as string, {}),
        entry(3, 'team-work-admitted', {}),
      ],
      true,
    )
    expect(model.entries.length).toBe(1)
    expect(must(model.entries[0], 'entry 0').sequence).toBe(3)
  })

  it('a null payload passes through as an empty record', () => {
    const model = adaptTeamLedger([entry(1, 'team-work-admitted', {}, { payload: null })], true)
    expect(must(model.entries[0], 'entry 0').payload).toEqual({})
  })

  it('the input is re-sorted by sequence defensively and never mutated', () => {
    const shuffled = [entry(3, 'team-work-admitted', {}), entry(1, 'member-lifecycle-changed', {}), entry(2, 'lifecycle-fact', {})]
    const before = JSON.stringify(shuffled)
    const model = adaptTeamLedger(shuffled, true)
    expect(model.entries.map(r => r.sequence)).toEqual([1, 2, 3])
    expect(JSON.stringify(shuffled)).toBe(before)
  })
})

// ---------------------------------------------------------------------------
// Control chains — pairing + orphan rule
// ---------------------------------------------------------------------------

describe('adaptTeamLedger — control chains', () => {
  const request = (seq: number, requestId: string, target: string, action: string, extra: Record<string, unknown> = {}) =>
    entry(seq, 'control-request-recorded', { requestId, targetInstanceId: target, actionName: action, correlation: `c-${requestId}`, ...extra })
  const decision = (
    seq: number,
    requestId: string,
    value: string,
    scope: Record<string, unknown>,
    extra: Record<string, unknown> = {},
    withSequence: boolean = true,
  ) =>
    entry(
      seq,
      'control-decision-recorded',
      {
        requestId,
        decision: value,
        decider: 'user',
        scope,
        ...(withSequence ? { requestSequence: seq } : {}),
        ...extra,
      },
    )

  it('pairs the decision onto its request by requestId (pending flips, decision block set)', () => {
    const model = adaptTeamLedger(
      [
        request(1, 'r1', 'i1', 'tool.execute', { kind: 'tool', toolName: 'run', summary: 'run it' }),
        decision(3, 'r1', 'allow_once', { rootSessionId: 'root-1' }, { reason: 'ok' }),
      ],
      true,
    )
    expect(model.controls.length).toBe(1)
    const chain = must(model.controls[0], 'control chain 0')
    expect(chain.requestId).toBe('r1')
    expect(chain.requestSequence).toBe(1)
    expect(chain.targetInstanceId).toBe('i1')
    expect(chain.actionName).toBe('tool.execute')
    expect(chain.requestedAt).toBe(T)
    expect(chain.kind).toBe('tool')
    expect(chain.toolName).toBe('run')
    expect(chain.summary).toBe('run it')
    expect(chain.pending).toBe(false)
    expect(chain.decision).toEqual({ value: 'allow_once', sequence: 3, decidedAt: T, reason: 'ok' })
  })

  it('a duplicate request keeps the first draft (requestSequence = first entry)', () => {
    const model = adaptTeamLedger(
      [request(1, 'r1', 'i1', 'a'), request(2, 'r1', 'i1', 'a'), decision(3, 'r1', 'deny', {})],
      true,
    )
    expect(model.controls.length).toBe(1)
    expect(must(model.controls[0], 'control chain 0').requestSequence).toBe(1)
    expect(must(model.controls[0], 'control chain 0').pending).toBe(false)
  })

  it('an orphan decision is emitted only from the writer scope (no invented values)', () => {
    const model = adaptTeamLedger(
      [decision(5, 'r-x', 'deny', { targetInstanceId: 'i2', actionName: 'tool.execute', toolName: 'run' }, { note: 'late' })],
      true,
    )
    expect(model.controls.length).toBe(1)
    const orphan = must(model.controls[0], 'control chain 0')
    expect(orphan.requestId).toBe('r-x')
    expect(orphan.requestSequence).toBe(5)
    expect(orphan.targetInstanceId).toBe('i2')
    expect(orphan.actionName).toBe('tool.execute')
    expect(orphan.toolName).toBe('run')
    expect(orphan.pending).toBe(false)
    expect(orphan.decision?.value).toBe('deny')
    expect('kind' in orphan).toBe(false)
    expect(orphan.decision?.note).toBe('late')
  })

  it('an orphan decision without a full writer scope is skipped (nothing invented)', () => {
    const noScope = adaptTeamLedger([decision(5, 'r-x', 'deny', {})], true)
    expect(noScope.controls.length).toBe(0)
    const missingSequence = adaptTeamLedger(
      [decision(5, 'r-x', 'deny', { targetInstanceId: 'i2', actionName: 'a' }, {}, false)],
      true,
    )
    expect(missingSequence.controls.length).toBe(0)
    const missingAction = adaptTeamLedger(
      [decision(5, 'r-x', 'deny', { targetInstanceId: 'i2' }, { requestSequence: 5 })],
      true,
    )
    expect(missingAction.controls.length).toBe(0)
  })

  it('a request with broken identity leaves is skipped from the chains (rows keep it)', () => {
    const model = adaptTeamLedger([entry(1, 'control-request-recorded', { targetInstanceId: 'i1', actionName: 'a' })], true)
    expect(model.entries.length).toBe(1)
    expect(model.controls.length).toBe(0)
  })

  it('chains sort by requestSequence (requests first, then orphans by their sequence)', () => {
    const model = adaptTeamLedger(
      [
        request(10, 'r-late', 'i1', 'a'),
        request(2, 'r-early', 'i2', 'b'),
        decision(20, 'r-orphan', 'deny', { targetInstanceId: 'i3', actionName: 'c' }, { requestSequence: 20 }),
      ],
      true,
    )
    expect(model.controls.map(c => c.requestId)).toEqual(['r-early', 'r-late', 'r-orphan'])
  })
})

// ---------------------------------------------------------------------------
// Messages — recipient pair, no invented sender, send-message only
// ---------------------------------------------------------------------------

describe('adaptTeamLedger — messages', () => {
  it('a delivered message carries the recipient pair and NO from (the fact names no sender)', () => {
    const model = adaptTeamLedger(
      [entry(1, 'team-message-delivered', { deliveredToInstanceId: 'i1', recipientInstanceId: 'i2', subject: 'hi', at: T, requestToken: 'tok' })],
      true,
    )
    expect(model.messages.length).toBe(1)
    const row = must(model.messages[0], 'message row 0')
    expect(row.kind).toBe('delivered')
    expect(row.to).toBe('i2')
    expect(row.subject).toBe('hi')
    expect('from' in row).toBe(false)
  })

  it('the delivered fallback is deliveredToInstanceId when recipientInstanceId is absent', () => {
    const model = adaptTeamLedger(
      [entry(1, 'team-message-delivered', { deliveredToInstanceId: 'i9', subject: 'hi' })],
      true,
    )
    expect(must(model.messages[0], 'message row 0').to).toBe('i9')
  })

  it('a delivered message without subject or recipient is skipped', () => {
    const model = adaptTeamLedger(
      [entry(1, 'team-message-delivered', { deliveredToInstanceId: 'i1' }), entry(2, 'team-message-delivered', { subject: 's' })],
      true,
    )
    expect(model.messages.length).toBe(0)
  })

  it('a coordination message is emitted only for the send-message action (from = caller)', () => {
    const model = adaptTeamLedger(
      [
        entry(1, 'team-coordination-recorded', { action: 'send-message', caller: 'i1', targetInstanceId: 'i2', recipientInstanceId: 'i2', subject: 'go', at: T }),
        entry(2, 'team-coordination-recorded', { action: 'record-note', caller: 'i1', targetInstanceId: 'i2', subject: 'note' }),
      ],
      true,
    )
    expect(model.messages.length).toBe(1)
    const row = must(model.messages[0], 'message row 0')
    expect(row.kind).toBe('coordination')
    expect(row.from).toBe('i1')
    expect(row.to).toBe('i2')
  })
})

// ---------------------------------------------------------------------------
// Activity intervals — pairing by correlation
// ---------------------------------------------------------------------------

describe('adaptTeamLedger — activity intervals', () => {
  it('pairs the close onto its open by correlation (first close stands)', () => {
    const model = adaptTeamLedger(
      [
        entry(1, 'activity-interval-opened', { op: 'interval-open', instanceId: 'i1', subject: 'work', correlation: 'c1', note: 'started' }),
        entry(4, 'activity-interval-closed', { op: 'interval-close', instanceId: 'i1', correlation: 'c1', closeNote: 'done' }),
        entry(5, 'activity-interval-closed', { op: 'interval-close', instanceId: 'i1', correlation: 'c1', closeNote: 'again' }),
      ],
      true,
    )
    expect(model.intervals.length).toBe(1)
    const row = must(model.intervals[0], 'interval row 0')
    expect(row.correlation).toBe('c1')
    expect(row.instanceId).toBe('i1')
    expect(row.subject).toBe('work')
    expect(row.note).toBe('started')
    expect(row.openedAt).toBe(T)
    expect(row.openedSequence).toBe(1)
    expect(row.isOpen).toBe(false)
    expect(row.closedSequence).toBe(4)
    expect(row.closeNote).toBe('done')
  })

  it('a close without a loaded open is skipped (no invented interval)', () => {
    const model = adaptTeamLedger(
      [entry(1, 'activity-interval-closed', { op: 'interval-close', instanceId: 'i1', correlation: 'c-none', closeNote: 'x' })],
      true,
    )
    expect(model.intervals.length).toBe(0)
  })

  it('an open without correlation or instance is skipped', () => {
    const model = adaptTeamLedger(
      [
        entry(1, 'activity-interval-opened', { op: 'interval-open', instanceId: 'i1' }),
        entry(2, 'activity-interval-opened', { op: 'interval-open', correlation: 'c1' }),
      ],
      true,
    )
    expect(model.intervals.length).toBe(0)
  })
})

// ---------------------------------------------------------------------------
// §7.4 gate — progress rows + pendingControlByInstance only when complete
// ---------------------------------------------------------------------------

describe('adaptTeamLedger — §7.4 completeness gate', () => {
  it('under partial: progress is [] and pendingControlByInstance is {} even with real facts', () => {
    const model = adaptTeamLedger(
      [
        entry(1, 'activity-progress-recorded', { instanceId: 'i1', subject: 's', progress: 'in-progress' }),
        entry(2, 'control-request-recorded', { requestId: 'r1', targetInstanceId: 'i1', actionName: 'a', correlation: 'c' }),
      ],
      false,
    )
    expect(model.completeness).toBe('partial')
    expect(model.progress).toEqual([])
    expect(model.pendingControlByInstance).toEqual({})
    // The facts still appear as rows / chains — only the gated views shrink.
    expect(model.entries.length).toBe(2)
    expect(model.controls.length).toBe(1)
  })

  it('under complete: progress rows are emitted (broken facts skipped)', () => {
    const model = adaptTeamLedger(
      [
        entry(1, 'activity-progress-recorded', { instanceId: 'i1', subject: 's', progress: 'in-progress', summary: 'sum' }),
        entry(2, 'activity-progress-recorded', { instanceId: 'i1', subject: 's', progress: 'bogus' }),
        entry(3, 'activity-progress-recorded', { instanceId: 'i1', progress: 'completed' }),
        entry(4, 'activity-progress-recorded', { subject: 's', progress: 'blocked' }),
      ],
      true,
    )
    expect(model.completeness).toBe('complete')
    expect(model.progress.length).toBe(1)
    const row = must(model.progress[0], 'progress row 0')
    expect(row.sequence).toBe(1)
    expect(row.progress).toBe('in-progress')
    expect(row.summary).toBe('sum')
  })

  it('under complete: pendingControlByInstance counts only the unpaired requests, per target instance', () => {
    const model = adaptTeamLedger(
      [
        entry(1, 'control-request-recorded', { requestId: 'r1', targetInstanceId: 'i1', actionName: 'a', correlation: 'c1' }),
        entry(2, 'control-request-recorded', { requestId: 'r2', targetInstanceId: 'i2', actionName: 'b', correlation: 'c2' }),
        entry(3, 'control-request-recorded', { requestId: 'r3', targetInstanceId: 'i1', actionName: 'c', correlation: 'c3' }),
        entry(4, 'control-decision-recorded', { requestId: 'r1', decision: 'deny', decider: 'u', scope: {}, requestSequence: 1 }),
      ],
      true,
    )
    expect(model.pendingControlByInstance).toEqual({ i1: 1, i2: 1 })
    const paired = model.controls.find(c => c.requestId === 'r1')
    expect(paired?.pending).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// adaptTeamUi — the combined output + §7.3 badge overlay
// ---------------------------------------------------------------------------

describe('adaptTeamUi — the combined output', () => {
  it('under complete: member rows get the per-instance badge (clean instance = known zero)', () => {
    const state = adaptTeamUi(
      projectionFromWire(wireFrame({ members: [wireMember({ instanceId: 'i1' }), wireMember({ instanceId: 'i2', childSessionId: undefined })] })),
      ROOT_PERSPECTIVE,
      [entry(1, 'control-request-recorded', { requestId: 'r1', targetInstanceId: 'i1', actionName: 'a', correlation: 'c1' })],
      true,
    )
    expect(state.ledger.completeness).toBe('complete')
    const i1 = state.snapshot.members.find(m => m.instanceId === 'i1')
    const i2 = state.snapshot.members.find(m => m.instanceId === 'i2')
    expect(i1?.pendingControlCount).toBe(1)
    expect(i2?.pendingControlCount).toBe(0)
    expect(state.ledger.pendingControlByInstance).toEqual({ i1: 1 })
  })

  it('under partial: the badges stay null (unknown, never a guess)', () => {
    const state = adaptTeamUi(
      projectionFromWire(wireFrame({ members: [wireMember({ instanceId: 'i1' })] })),
      ROOT_PERSPECTIVE,
      [entry(1, 'control-request-recorded', { requestId: 'r1', targetInstanceId: 'i1', actionName: 'a', correlation: 'c1' })],
      false,
    )
    expect(must(state.snapshot.members[0], 'member row 0').pendingControlCount).toBe(null)
    expect(state.ledger.pendingControlByInstance).toEqual({})
  })
})
