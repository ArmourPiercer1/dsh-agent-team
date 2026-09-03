/**
 * The durable-ledger Events-section model (P9-T6, plan §8.8 ADAPT): the
 * legacy `team-feed-model` test inventory mapped onto the new input —
 *
 *  - constants → the frozen 200/200 depth constants (kept);
 *  - ascending order / equal-time fold order → the durable SEQUENCE order
 *    (timestamp is display only — the sort identity the plan re-binds);
 *  - cap 200 / whole stream / hasMore at total / clamp → the same window
 *    axis over the loaded set;
 *  - splice older ahead / wire pages / oldest anchor / messagesBefore →
 *    DROPPED: the store pages FORWARD from the ledger head, so there is no
 *    "older than loaded" state; the depth append covers the loaded set
 *    (plan §8.8; the store is the paging authority);
 *  - counted remainder → re-bound to the partial-ledger remainder
 *    (`total - completeThrough`, 0 before the total is known);
 *  - name resolution + session bind (D19) / unbound member → empty session
 *    / first row wins → the snapshot member resolution (label + navigation
 *    target, '' for inert rows);
 *  - stable keys → `ledger:<sequence>`;
 *  - empty model / re-derive at same depth → kept as the pure-model axis.
 *
 * NEW coverage for the rewritten input: the client-local category /
 * instance-or-template filter (UI §27.4), the row-family leaf extraction
 * (control pending join, message from/to, interval-close correlation join,
 * progress value), and the safe generic row for unknown fact types
 * (plan §8.9: no throw, no guessed actor/session).
 */
import { describe, expect, it } from 'vitest'
import type { LedgerCategory } from '../../contracts/src/index.js'
import type {
  TeamUiLedgerModel, TeamUiLedgerRow, TeamUiMemberInstance, TeamUiSnapshot,
} from '../src/model/team-ui-snapshot.js'
import {
  TEAM_LEDGER_INITIAL_LIMIT, TEAM_LEDGER_STEP,
  deriveTeamLedgerSection,
  type TeamLedgerFilter, type TeamLedgerSectionModel,
} from '../src/model/team-ledger-model.js'

const LEADER = 'team-leader'
const MEMBER = 'team-member'
const T = 1_700_000_000_000

const iso = (ms: number): string => new Date(ms).toISOString()

/** One UI ledger row (the adapter's face; the ONE boundary cast). */
function uiEntry(
  sequence: number,
  factType: string,
  createdAt: number,
  payload: Record<string, unknown>,
  category?: LedgerCategory,
): TeamUiLedgerRow {
  return {
    sequence,
    factType,
    ...(category === undefined ? {} : { category }),
    rootSessionId: LEADER,
    operationId: null,
    createdAt: iso(createdAt),
    payload,
  } as unknown as TeamUiLedgerRow
}

/** One snapshot member row (the ONE boundary cast). */
function uiMember(
  instanceId: string,
  childSessionId: string | null,
  label: string,
  templateId: string,
): TeamUiMemberInstance {
  return {
    instanceId,
    templateId,
    label,
    childSessionId,
  } as unknown as TeamUiMemberInstance
}

const DEFAULT_MEMBERS: readonly TeamUiMemberInstance[] = [
  uiMember('lead', null, 'Lead', 'tpl-lead'),
  uiMember('mate', MEMBER, 'Mate', 'tpl-mate'),
]

/** One minimal snapshot (labels + navigation resolution). */
function snapshot(
  members: readonly TeamUiMemberInstance[] = DEFAULT_MEMBERS,
  overrides: Partial<TeamUiSnapshot> = {},
): TeamUiSnapshot {
  return {
    teamSessionId: LEADER,
    generation: 1,
    members,
    ...overrides,
  } as unknown as TeamUiSnapshot
}

/** One ledger model (the default: partial, no auxiliary facts). */
function ledger(
  entries: readonly TeamUiLedgerRow[],
  overrides: Partial<TeamUiLedgerModel> = {},
): TeamUiLedgerModel {
  return {
    completeness: 'partial',
    entries,
    controls: [],
    messages: [],
    intervals: [],
    progress: [],
    pendingControlByInstance: {},
    ...overrides,
  } as unknown as TeamUiLedgerModel
}

interface DeriveArgs {
  readonly ledger?: TeamUiLedgerModel
  readonly snapshot?: TeamUiSnapshot
  readonly loadedCount?: number
  readonly filter?: TeamLedgerFilter
  readonly total?: number | null
  readonly completeThrough?: number
}

function derive(args: DeriveArgs = {}): TeamLedgerSectionModel {
  return deriveTeamLedgerSection({
    ledger: args.ledger ?? ledger([]),
    snapshot: args.snapshot ?? snapshot(),
    loadedCount: args.loadedCount ?? TEAM_LEDGER_INITIAL_LIMIT,
    filter: args.filter ?? { category: 'all', instanceId: null },
    total: args.total ?? 0,
    completeThrough: args.completeThrough ?? 0,
  })
}

describe('deriveTeamLedgerSection', () => {
  it('keeps the frozen depth constants from the legacy feed model', () => {
    expect(TEAM_LEDGER_INITIAL_LIMIT).toBe(200)
    expect(TEAM_LEDGER_STEP).toBe(200)
  })

  it('orders rows by the durable sequence, never by the timestamp', () => {
    // The seq-2 fact carries the EARLIER timestamp: the order must still
    // follow the sequence.
    const entries = [
      uiEntry(2, 'team-message-delivered', T + 1000, { recipientInstanceId: 'mate', subject: 'second' }, 'message'),
      uiEntry(1, 'team-message-delivered', T + 5000, { recipientInstanceId: 'mate', subject: 'first' }, 'message'),
    ]
    const model = derive({ ledger: ledger(entries) })
    expect(model.rows.map(row => row.sequence)).toEqual([1, 2])
    expect(model.rows.map(row => row.summary)).toEqual(['first', 'second'])
  })

  it('caps the window at the most recent 200 filtered rows, oldest first', () => {
    const entries = Array.from({ length: 250 }, (_, index) =>
      uiEntry(index + 1, 'team-message-delivered', T + (index + 1) * 1000, {
        recipientInstanceId: 'mate', subject: `m${index + 1}`,
      }, 'message'))
    const model = derive({ ledger: ledger(entries) })
    expect(model.rows).toHaveLength(200)
    expect(model.rows[0]?.sequence).toBe(51)
    expect(model.rows[199]?.sequence).toBe(250)
    expect(model.total).toBe(250)
    expect(model.hasMore).toBe(true)
  })

  it('shows the whole loaded stream when it fits the window', () => {
    const entries = Array.from({ length: 100 }, (_, index) =>
      uiEntry(index + 1, 'team-message-delivered', T + (index + 1) * 1000, {
        recipientInstanceId: 'mate', subject: `m${index + 1}`,
      }, 'message'))
    const model = derive({ ledger: ledger(entries) })
    expect(model.rows).toHaveLength(100)
    expect(model.hasMore).toBe(false)
  })

  it('deepens from a smaller depth over the loaded set (the depth axis)', () => {
    const entries = Array.from({ length: 10 }, (_, index) =>
      uiEntry(index + 1, 'team-message-delivered', T + (index + 1) * 1000, {
        recipientInstanceId: 'mate', subject: `m${index + 1}`,
      }, 'message'))
    const model = derive({ ledger: ledger(entries), loadedCount: 5 })
    expect(model.rows.map(row => row.sequence)).toEqual([6, 7, 8, 9, 10])
    expect(model.hasMore).toBe(true)
  })

  it('clamps the depth to the filtered total', () => {
    const entries = Array.from({ length: 10 }, (_, index) =>
      uiEntry(index + 1, 'team-message-delivered', T + (index + 1) * 1000, {
        recipientInstanceId: 'mate', subject: `m${index + 1}`,
      }, 'message'))
    const model = derive({ ledger: ledger(entries), loadedCount: 500 })
    expect(model.rows).toHaveLength(10)
    expect(model.hasMore).toBe(false)
  })

  it('filters by category and skips rows without the category', () => {
    const entries = [
      uiEntry(1, 'team-message-delivered', T, { recipientInstanceId: 'mate', subject: 'msg' }, 'message'),
      uiEntry(2, 'control-request-recorded', T + 1000, { targetInstanceId: 'mate', actionName: 'write_file' }, 'control'),
      uiEntry(3, 'future-fact-type', T + 2000, { a: 1 }),
    ]
    const model = derive({ ledger: ledger(entries), filter: { category: 'message', instanceId: null } })
    expect(model.rows.map(row => row.sequence)).toEqual([1])
    expect(model.total).toBe(1)
  })

  it('filters by instance id on the row actor', () => {
    const entries = [
      uiEntry(1, 'team-message-delivered', T, { recipientInstanceId: 'mate', subject: 'to mate' }, 'message'),
      uiEntry(2, 'team-message-delivered', T + 1000, { recipientInstanceId: 'lead', subject: 'to lead' }, 'message'),
    ]
    const model = derive({ ledger: ledger(entries), filter: { category: 'all', instanceId: 'mate' } })
    expect(model.rows.map(row => row.sequence)).toEqual([1])
    expect(model.rows[0]?.actorLabel).toBe('Mate')
  })

  it('filters by template id through the actor template', () => {
    const entries = [
      uiEntry(1, 'team-message-delivered', T, { recipientInstanceId: 'mate', subject: 'to mate' }, 'message'),
      uiEntry(2, 'team-message-delivered', T + 1000, { recipientInstanceId: 'lead', subject: 'to lead' }, 'message'),
    ]
    const model = derive({ ledger: ledger(entries), filter: { category: 'all', instanceId: 'tpl-mate' } })
    expect(model.rows.map(row => row.sequence)).toEqual([1])
  })

  it('excludes actor-less rows under an active instance filter', () => {
    const entries = [
      uiEntry(1, 'team-work-admitted', T, { correlation: 'c-1' }, 'team'),
      uiEntry(2, 'team-message-delivered', T + 1000, { recipientInstanceId: 'mate', subject: 'to mate' }, 'message'),
    ]
    const model = derive({ ledger: ledger(entries), filter: { category: 'all', instanceId: 'mate' } })
    expect(model.rows.map(row => row.sequence)).toEqual([2])
  })

  it('reports the partial-ledger remainder and zero before the total is known', () => {
    const entries = [uiEntry(1, 'team-message-delivered', T, { recipientInstanceId: 'mate', subject: 'm' }, 'message')]
    expect(derive({ ledger: ledger(entries), total: 100, completeThrough: 60 }).remainingCount).toBe(40)
    expect(derive({ ledger: ledger(entries), total: null, completeThrough: 0 }).remainingCount).toBe(0)
    const complete = derive({
      ledger: ledger(entries, { completeness: 'complete' }),
      total: 1,
      completeThrough: 1,
    })
    expect(complete.complete).toBe(true)
    expect(complete.remainingCount).toBe(0)
  })

  it('resolves actor labels from the snapshot and falls back to the raw id', () => {
    const entries = [
      uiEntry(1, 'team-message-delivered', T, { recipientInstanceId: 'mate', subject: 'to mate' }, 'message'),
      uiEntry(2, 'team-message-delivered', T + 1000, { recipientInstanceId: 'ghost', subject: 'to ghost' }, 'message'),
    ]
    const model = derive({ ledger: ledger(entries) })
    expect(model.rows[0]?.actorLabel).toBe('Mate')
    expect(model.rows[1]?.actorLabel).toBe('ghost')
  })

  it('resolves navigation to the member child session and the team root', () => {
    const entries = [
      uiEntry(1, 'team-message-delivered', T, { recipientInstanceId: 'mate', subject: 'to mate' }, 'message'),
      uiEntry(2, 'team-message-delivered', T + 1000, { recipientInstanceId: 'lead', subject: 'to lead' }, 'message'),
      uiEntry(3, 'team-message-delivered', T + 2000, { recipientInstanceId: 'ghost', subject: 'to ghost' }, 'message'),
    ]
    const model = derive({ ledger: ledger(entries) })
    expect(model.rows[0]?.navigationSessionId).toBe(MEMBER)
    expect(model.rows[1]?.navigationSessionId).toBe(LEADER)
    expect(model.rows[2]?.navigationSessionId).toBe('')
  })

  it('joins control requests to their pending state from the loaded chains', () => {
    const entries = [
      uiEntry(1, 'control-request-recorded', T, {
        requestId: 'r1', targetInstanceId: 'mate', actionName: 'write_file',
      }, 'control'),
      uiEntry(2, 'control-request-recorded', T + 1000, {
        requestId: 'r2', targetInstanceId: 'mate', actionName: 'read_file',
      }, 'control'),
    ]
    const model = derive({
      ledger: ledger(entries, {
        controls: [
          {
            requestId: 'r1', requestSequence: 1, targetInstanceId: 'mate', actionName: 'write_file',
            requestedAt: iso(T), pending: true,
          },
          {
            requestId: 'r2', requestSequence: 2, targetInstanceId: 'mate', actionName: 'read_file',
            requestedAt: iso(T + 1000), pending: false,
          },
        ],
      }),
    })
    expect(model.rows[0]?.pending).toBe(true)
    expect(model.rows[0]?.summary).toBe('write_file')
    expect(model.rows[0]?.actorLabel).toBe('Mate')
    expect(model.rows[1]?.pending).toBe(false)
  })

  it('renders control decisions with the value, the reason, and the scope actor', () => {
    const entries = [
      uiEntry(1, 'control-decision-recorded', T, {
        requestId: 'r1',
        decision: 'deny',
        scope: { targetInstanceId: 'mate' },
        reason: 'out of policy',
      }, 'control'),
    ]
    const model = derive({ ledger: ledger(entries) })
    const row = model.rows[0]
    expect(row?.decisionValue).toBe('deny')
    expect(row?.decisionReason).toBe('out of policy')
    expect(row?.actorInstanceId).toBe('mate')
    expect(row?.summary).toContain('deny')
  })

  it('reads the frozen message from/to leaves per fact type', () => {
    const entries = [
      uiEntry(1, 'team-message-delivered', T, { recipientInstanceId: 'mate', subject: 'go' }, 'message'),
      uiEntry(2, 'team-coordination-recorded', T + 1000, {
        action: 'send-message', caller: 'lead', targetInstanceId: 'mate', subject: 'check in',
      }, 'message'),
    ]
    const model = derive({ ledger: ledger(entries) })
    expect(model.rows[0]?.actorInstanceId).toBe('mate')
    expect(model.rows[0]?.summary).toBe('go')
    expect(model.rows[0]?.detail).toContain('→ Mate')
    expect(model.rows[1]?.actorInstanceId).toBe('lead')
    expect(model.rows[1]?.summary).toBe('check in')
  })

  it('joins interval closes to the paired interval instance without guessing', () => {
    const entries = [
      uiEntry(1, 'activity-interval-opened', T, { correlation: 'corr-1', instanceId: 'mate', subject: 'span' }, 'progress'),
      uiEntry(2, 'activity-interval-closed', T + 90_000, { correlation: 'corr-1', closeNote: 'done' }, 'progress'),
      uiEntry(3, 'activity-interval-closed', T + 180_000, { correlation: 'corr-404', closeNote: 'orphan' }, 'progress'),
    ]
    const model = derive({
      ledger: ledger(entries, {
        intervals: [
          { correlation: 'corr-1', instanceId: 'mate', openedAt: iso(T), openedSequence: 1, isOpen: false },
        ],
      }),
    })
    expect(model.rows[1]?.actorInstanceId).toBe('mate')
    expect(model.rows[1]?.summary).toBe('done')
    expect(model.rows[2]?.actorInstanceId).toBe('')
    expect(model.rows[2]?.navigationSessionId).toBe('')
  })

  it('renders progress rows with the frozen progress value', () => {
    const entries = [
      uiEntry(1, 'activity-progress-recorded', T, {
        instanceId: 'mate', subject: 'Wiring the mirror', progress: 'in-progress', lastAction: 'typing',
      }, 'progress'),
    ]
    const model = derive({ ledger: ledger(entries) })
    const row = model.rows[0]
    expect(row?.kind).toBe('progress-recorded')
    expect(row?.progressValue).toBe('in-progress')
    expect(row?.summary).toBe('Wiring the mirror')
    expect(row?.detail).toContain('typing')
  })

  it('renders unknown fact types as the safe generic row without throwing', () => {
    const entries = [
      uiEntry(7, 'future-fact-type', T, { a: 1, b: 'x' }),
    ]
    const model = derive({ ledger: ledger(entries) })
    const row = model.rows[0]
    expect(row?.kind).toBe('unknown')
    expect(row?.category).toBeUndefined()
    expect(row?.summary).toBe('future-fact-type')
    expect(row?.detail).toContain('future-fact-type')
    expect(row?.detail).toContain('#7')
    expect(row?.detail).toContain(iso(T))
    expect(row?.detail).toContain('{"a":1,"b":"x"}')
    expect(row?.actorInstanceId).toBe('')
    expect(row?.actorLabel).toBe('')
    expect(row?.navigationSessionId).toBe('')
  })

  it('uses the stable ledger key and the empty model', () => {
    const entries = [uiEntry(7, 'team-message-delivered', T, { recipientInstanceId: 'mate', subject: 'm' }, 'message')]
    const model = derive({ ledger: ledger(entries) })
    expect(model.rows[0]?.key).toBe('ledger:7')
    const empty = derive()
    expect(empty.rows).toEqual([])
    expect(empty.total).toBe(0)
    expect(empty.hasMore).toBe(false)
  })
})
