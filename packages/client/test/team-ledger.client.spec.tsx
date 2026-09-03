// @vitest-environment jsdom
/**
 * The durable-ledger Events section (P9-T6, plan §8.9 ADAPT): the legacy
 * `team-feed.client.spec.tsx` (20 tests) mapped onto the new surface —
 *
 *  - mixed list / plan marker / five decision labels → the row families
 *    render with the frozen category markers and the THREE frozen decision
 *    values (allow / deny / stale-denied) plus the raw-value fallback
 *    (the legacy five-value wire vocabulary does not exist in vNext);
 *  - pending badge + warning dot → kept (the joined control chain);
 *  - title full text → the `title` detail affordance (kept);
 *  - cap 200 + load earlier / multi-click / append no-wire → kept as the
 *    local window deepening over the loaded set;
 *  - wire page once loaded / chain pages from newest oldest / busy during
 *    flight / transport failure folded into result → DROPPED: the store
 *    pages forward from the ledger head (no anchor paging), and the typed
 *    failure (RPC result OR page-reject, incl. the closed transport-loss
 *    reason) is the loud error + retry (replaces the legacy pageError
 *    fold — the remainder note re-binds to the partial-ledger remainder);
 *  - reset pages on new frame → adapted to the NEW-TEAM reset (frames of
 *    the same team keep the window: arriving events must not jump it);
 *  - inert when the view reports missing messages → the inert row (no
 *    resolved session);
 *  - empty state / message-row + approval-row click (D9) / session-less
 *    approval inert → the D9 navigation over the resolved session, inert
 *    otherwise;
 *  - English dictionary incl. failure notes → the en pairing.
 *
 * NEW coverage: the client-local category / instance-or-template filter
 * (UI §27.4), the safe generic row for unknown fact types (no throw),
 * the retry button, and the loading state.
 */
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import type { RenderResult } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { makeTranslate } from '@deepseek-ai/dsh-client-test-runtime'
import type { LedgerCategory } from '../../contracts/src/index.js'
import type { RemoteLedgerEntryValue } from '../../remote/src/index.js'
import type { TeamLedgerState } from '../src/state/team-ledger-store.js'
import type {
  TeamUiLedgerModel, TeamUiLedgerRow, TeamUiMemberInstance, TeamUiSnapshot,
} from '../src/model/team-ui-snapshot.js'
import { TeamLedger, type TeamLedgerProps } from '../src/ui/TeamLedger.js'
import { en, zh } from '../src/ui/locales.js'

const LEADER = 'team-leader'
const MEMBER = 'team-member'
const T = 1_700_000_000_000

const iso = (ms: number): string => new Date(ms).toISOString()

afterEach(cleanup)
beforeEach(() => {
  Element.prototype.setPointerCapture = vi.fn()
})
afterEach(() => {
  delete (Element.prototype as { setPointerCapture?: unknown }).setPointerCapture
})

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

const MEMBERS: readonly TeamUiMemberInstance[] = [
  { instanceId: 'lead', templateId: 'tpl-lead', label: 'Lead', childSessionId: null } as unknown as TeamUiMemberInstance,
  { instanceId: 'mate', templateId: 'tpl-mate', label: 'Mate', childSessionId: MEMBER } as unknown as TeamUiMemberInstance,
]

function snapshot(
  teamSessionId: string = LEADER,
  overrides: Partial<TeamUiSnapshot> = {},
): TeamUiSnapshot {
  return {
    teamSessionId,
    generation: 1,
    templates: [
      { kind: 'leader', templateId: 'tpl-lead', displayName: 'Lead', contextPolicy: 'persistent' },
      { kind: 'member', templateId: 'tpl-mate', displayName: 'Mate', contextPolicy: 'persistent' },
    ],
    members: MEMBERS,
    ...overrides,
  } as unknown as TeamUiSnapshot
}

function ledgerModel(
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

/** One published store state over the loaded facts (known complete by default). */
function state(
  entries: readonly TeamUiLedgerRow[],
  overrides: Partial<TeamLedgerState> = {},
): TeamLedgerState {
  const entriesBySequence = new Map(entries.map(item => [item.sequence, item]))
  const last = entries[entries.length - 1]
  return {
    teamSessionId: LEADER,
    entriesBySequence: entriesBySequence as unknown as ReadonlyMap<number, RemoteLedgerEntryValue>,
    orderedSequences: entries.map(item => item.sequence),
    total: last === undefined ? 0 : entries.length,
    completeThrough: last?.sequence ?? 0,
    loading: false,
    ...overrides,
  } as unknown as TeamLedgerState
}

function renderLedger(overrides: Partial<TeamLedgerProps> = {}): { view: RenderResult; props: TeamLedgerProps } {
  const props: TeamLedgerProps = {
    snapshot: snapshot(),
    ledger: ledgerModel([]),
    ledgerState: state([]),
    onRetry: vi.fn(() => Promise.resolve()),
    onSelectSession: vi.fn(),
    t: makeTranslate(zh),
    ...overrides,
  }
  const view = render(<TeamLedger {...props} />)
  return { view, props }
}

const rowButtons = (view: RenderResult): HTMLButtonElement[] =>
  Array.from(view.container.querySelectorAll<HTMLButtonElement>('[data-ledger-row]'))

describe('TeamLedger', () => {
  it('renders the row families with the frozen category markers', () => {
    const entries = [
      uiEntry(1, 'team-work-admitted', T, { instanceId: 'lead', subject: 'Admitted' }, 'team'),
      uiEntry(2, 'team-message-delivered', T + 1000, { recipientInstanceId: 'mate', subject: 'go' }, 'message'),
      uiEntry(3, 'control-request-recorded', T + 2000, { requestId: 'r1', targetInstanceId: 'mate', actionName: 'write_file' }, 'control'),
      uiEntry(4, 'activity-progress-recorded', T + 3000, { instanceId: 'mate', subject: 'Wiring', progress: 'in-progress' }, 'progress'),
      uiEntry(5, 'activity-interval-closed', T + 4000, { correlation: 'corr-1', closeNote: 'done' }, 'progress'),
    ]
    const { view } = renderLedger({
      ledger: ledgerModel(entries, {
        controls: [{
          requestId: 'r1', requestSequence: 3, targetInstanceId: 'mate', actionName: 'write_file',
          requestedAt: iso(T + 2000), pending: true,
        }],
        intervals: [{ correlation: 'corr-1', instanceId: 'mate', openedAt: iso(T + 1500), openedSequence: 3, isOpen: false }],
      }),
      ledgerState: state(entries),
    })
    const rows = rowButtons(view)
    expect(rows).toHaveLength(5)
    expect(rows.map(row => row.getAttribute('data-ledger-kind'))).toEqual([
      'work-admitted', 'message', 'control-request', 'progress-recorded', 'interval-closed',
    ])
    expect(rows[0]?.querySelector('[data-ledger-marker]')?.textContent).toBe('工作准入')
    expect(rows[1]?.querySelector('[data-ledger-marker]')?.textContent).toBe('消息')
    expect(rows[2]?.querySelector('[data-ledger-marker]')?.textContent).toBe('控制请求')
    expect(rows[3]?.querySelector('[data-ledger-marker]')?.textContent).toBe('进度')
    expect(rows[4]?.querySelector('[data-ledger-marker]')?.textContent).toBe('活动结束')
    // The interval close joins its actor through the paired interval.
    expect(rows[4]?.querySelector('[data-ledger-actor]')?.textContent).toBe('Mate')
  })

  it('shows the waiting badge (amber dot) on an unpaired control request', () => {
    const entries = [
      uiEntry(1, 'control-request-recorded', T, { requestId: 'r1', targetInstanceId: 'mate', actionName: 'write_file' }, 'control'),
    ]
    const { view } = renderLedger({
      ledger: ledgerModel(entries, {
        controls: [{
          requestId: 'r1', requestSequence: 1, targetInstanceId: 'mate', actionName: 'write_file',
          requestedAt: iso(T), pending: true,
        }],
      }),
      ledgerState: state(entries),
    })
    const row = rowButtons(view)[0]
    expect(row?.querySelector('[data-ledger-state]')?.getAttribute('data-pending')).toBe('true')
    expect(row?.querySelector('[data-ledger-state]')?.textContent).toBe('等待裁决')
  })

  it('renders the three frozen decision labels plus the raw-value fallback', () => {
    const entries = [
      uiEntry(1, 'control-decision-recorded', T, { requestId: 'r1', decision: 'allow', scope: { targetInstanceId: 'mate' } }, 'control'),
      uiEntry(2, 'control-decision-recorded', T + 1000, { requestId: 'r2', decision: 'deny', scope: { targetInstanceId: 'mate' } }, 'control'),
      uiEntry(3, 'control-decision-recorded', T + 2000, { requestId: 'r3', decision: 'stale-denied', scope: { targetInstanceId: 'mate' } }, 'control'),
      uiEntry(4, 'control-decision-recorded', T + 3000, { requestId: 'r4', decision: 'weird-value', scope: { targetInstanceId: 'mate' } }, 'control'),
    ]
    const { view } = renderLedger({ ledger: ledgerModel(entries), ledgerState: state(entries) })
    const badges = view.container.querySelectorAll('[data-ledger-state][data-decision]')
    expect(badges).toHaveLength(4)
    expect(badges[0]?.textContent).toBe('允许')
    expect(badges[1]?.textContent).toBe('拒绝')
    expect(badges[2]?.textContent).toBe('过期拒绝')
    expect(badges[3]?.textContent).toBe('weird-value')
    expect(badges[3]?.getAttribute('data-decision')).toBe('weird-value')
  })

  it('carries the full detail in the title affordance', () => {
    const entries = [
      uiEntry(1, 'team-message-delivered', T, { recipientInstanceId: 'mate', subject: 'go ahead' }, 'message'),
    ]
    const { view } = renderLedger({ ledger: ledgerModel(entries), ledgerState: state(entries) })
    const summary = view.container.querySelector('[data-ledger-summary]')
    expect(summary?.textContent).toBe('go ahead')
    expect(summary?.getAttribute('title')).toContain('→ Mate')
  })

  it('caps the window at 200 rows and offers load earlier', () => {
    const entries = Array.from({ length: 250 }, (_, index) =>
      uiEntry(index + 1, 'team-message-delivered', T + (index + 1) * 1000, {
        recipientInstanceId: 'mate', subject: `m${index + 1}`,
      }, 'message'))
    const { view } = renderLedger({ ledger: ledgerModel(entries), ledgerState: state(entries) })
    expect(rowButtons(view)).toHaveLength(200)
    expect(view.container.querySelector('[data-ledger-load-earlier]')).toBeTruthy()
  })

  it('deepens the window on load-earlier clicks (local axis only)', () => {
    const entries = Array.from({ length: 500 }, (_, index) =>
      uiEntry(index + 1, 'team-message-delivered', T + (index + 1) * 1000, {
        recipientInstanceId: 'mate', subject: `m${index + 1}`,
      }, 'message'))
    const { view } = renderLedger({ ledger: ledgerModel(entries), ledgerState: state(entries) })
    expect(rowButtons(view)).toHaveLength(200)
    let button = view.container.querySelector<HTMLButtonElement>('[data-ledger-load-earlier]')
    if (button === null) throw new Error('the load-earlier button did not render')
    fireEvent.click(button)
    expect(rowButtons(view)).toHaveLength(400)
    button = view.container.querySelector<HTMLButtonElement>('[data-ledger-load-earlier]')
    if (button === null) throw new Error('the load-earlier button did not render')
    fireEvent.click(button)
    expect(rowButtons(view)).toHaveLength(500)
    expect(view.container.querySelector('[data-ledger-load-earlier]')).toBeNull()
  })

  it('shows the partial-ledger remainder note and hides it once complete', () => {
    const entries = Array.from({ length: 50 }, (_, index) =>
      uiEntry(index + 1, 'team-message-delivered', T + (index + 1) * 1000, {
        recipientInstanceId: 'mate', subject: `m${index + 1}`,
      }, 'message'))
    const partial = renderLedger({
      ledger: ledgerModel(entries),
      ledgerState: state(entries, { total: 100, completeThrough: 50 }),
    })
    expect(partial.view.container.querySelector('[data-ledger-remaining]')?.textContent).toBe('还有 50 条事件未加载')
    const complete = renderLedger({
      ledger: ledgerModel(entries, { completeness: 'complete' }),
      ledgerState: state(entries, { total: 50, completeThrough: 50 }),
    })
    expect(complete.view.container.querySelector('[data-ledger-remaining]')).toBeNull()
  })

  it('shows the loud RPC error note and retries through the injected callback', () => {
    const entries = [uiEntry(1, 'team-message-delivered', T, { recipientInstanceId: 'mate', subject: 'm' }, 'message')]
    const { view, props } = renderLedger({
      ledger: ledgerModel(entries),
      ledgerState: state(entries, { error: { ok: false, error: { code: 'remote', message: 'boom', details: { method: 'team.getLedgerPage', endpoint: 'team', contractVersion: 1, requestToken: null } } } }),
    })
    expect(view.container.querySelector('[data-ledger-error]')?.textContent).toBe('事件加载失败：boom')
    const retry = view.container.querySelector<HTMLButtonElement>('[data-ledger-retry]')
    if (retry === null) throw new Error('the retry button did not render')
    expect(retry.textContent).toBe('重试')
    fireEvent.click(retry)
    expect(props.onRetry).toHaveBeenCalledTimes(1)
  })

  it('shows the closed transport-loss reason from a page reject', () => {
    const entries = [uiEntry(1, 'team-message-delivered', T, { recipientInstanceId: 'mate', subject: 'm' }, 'message')]
    const { view } = renderLedger({
      ledger: ledgerModel(entries),
      ledgerState: state(entries, { error: { ok: false, reason: 'transport-loss' } }),
    })
    expect(view.container.querySelector('[data-ledger-error]')?.textContent).toContain('transport-loss')
  })

  it('resets the window and the filters on a NEW team only', () => {
    const teamA = Array.from({ length: 500 }, (_, index) =>
      uiEntry(index + 1, 'team-message-delivered', T + (index + 1) * 1000, {
        recipientInstanceId: 'mate', subject: `m${index + 1}`,
      }, 'message'))
    const teamB = [uiEntry(1, 'team-message-delivered', T, { recipientInstanceId: 'mate', subject: 'b1' }, 'message')]
    const { view, props } = renderLedger({
      snapshot: snapshot('team-a'),
      ledger: ledgerModel(teamA),
      ledgerState: state(teamA, { teamSessionId: 'team-a' }),
    })
    const deepen = view.container.querySelector<HTMLButtonElement>('[data-ledger-load-earlier]')
    if (deepen === null) throw new Error('the load-earlier button did not render')
    fireEvent.click(deepen)
    expect(rowButtons(view)).toHaveLength(400)
    view.rerender(<TeamLedger
      snapshot={snapshot('team-b')}
      ledger={ledgerModel(teamB)}
      ledgerState={state(teamB, { teamSessionId: 'team-b' })}
      onRetry={props.onRetry}
      onSelectSession={props.onSelectSession}
      t={props.t}
    />)
    expect(rowButtons(view)).toHaveLength(1)
    const category = view.container.querySelector<HTMLSelectElement>('[data-ledger-filter-category]')
    const instance = view.container.querySelector<HTMLSelectElement>('[data-ledger-filter-instance]')
    expect(category?.value).toBe('all')
    expect(instance?.value).toBe('')
  })

  it('renders the empty and the loading states', () => {
    const empty = renderLedger()
    expect(empty.view.container.querySelector('[data-ledger-empty]')?.textContent).toBe('暂无团队事件')
    const loading = renderLedger({ ledgerState: state([], { loading: true }) })
    expect(loading.view.container.querySelector('[data-ledger-empty]')?.textContent).toBe('正在加载团队事件…')
  })

  it('switches sessions on row click (D9) and stays inert without a resolved session', () => {
    const entries = [
      uiEntry(1, 'team-message-delivered', T, { recipientInstanceId: 'mate', subject: 'to mate' }, 'message'),
      uiEntry(2, 'team-message-delivered', T + 1000, { recipientInstanceId: 'lead', subject: 'to lead' }, 'message'),
      uiEntry(3, 'team-message-delivered', T + 2000, { recipientInstanceId: 'ghost', subject: 'to ghost' }, 'message'),
    ]
    const { view, props } = renderLedger({ ledger: ledgerModel(entries), ledgerState: state(entries) })
    const rows = rowButtons(view)
    expect(rows).toHaveLength(3)
    const [first, second, third] = rows
    if (first === undefined || second === undefined || third === undefined) {
      throw new Error('the rows did not render')
    }
    expect(third.disabled).toBe(true)
    fireEvent.click(first)
    expect(props.onSelectSession).toHaveBeenCalledWith(MEMBER)
    fireEvent.click(second)
    expect(props.onSelectSession).toHaveBeenCalledTimes(2)
    expect(props.onSelectSession).toHaveBeenLastCalledWith(LEADER)
    fireEvent.click(third)
    expect(props.onSelectSession).toHaveBeenCalledTimes(2)
  })

  it('renders an unknown fact type as the safe generic row without throwing', () => {
    const entries = [
      uiEntry(7, 'future-fact-type', T, { a: 1, b: 'x' }),
    ]
    const { view } = renderLedger({ ledger: ledgerModel(entries), ledgerState: state(entries) })
    const row = rowButtons(view)[0]
    expect(row?.getAttribute('data-ledger-kind')).toBe('unknown')
    expect(row?.getAttribute('data-ledger-fact')).toBe('future-fact-type')
    expect(row?.querySelector('[data-ledger-marker]')?.textContent).toBe('future-fact-type')
    expect(row?.querySelector('[data-ledger-summary]')?.textContent).toBe('future-fact-type')
    expect(row?.querySelector('[data-ledger-actor]')).toBeNull()
    expect(row?.disabled).toBe(true)
  })

  it('filters by the client-local category select', () => {
    const entries = [
      uiEntry(1, 'team-message-delivered', T, { recipientInstanceId: 'mate', subject: 'msg' }, 'message'),
      uiEntry(2, 'control-request-recorded', T + 1000, { requestId: 'r1', targetInstanceId: 'mate', actionName: 'write_file' }, 'control'),
    ]
    const { view } = renderLedger({ ledger: ledgerModel(entries), ledgerState: state(entries) })
    const select = view.container.querySelector<HTMLSelectElement>('[data-ledger-filter-category]')
    if (select === null) throw new Error('the category select did not render')
    expect(select.options).toHaveLength(9)
    fireEvent.change(select, { target: { value: 'message' } })
    const rows = rowButtons(view)
    expect(rows).toHaveLength(1)
    expect(rows[0]?.getAttribute('data-ledger-kind')).toBe('message')
  })

  it('filters by instance id and by template id through the instance select', () => {
    const entries = [
      uiEntry(1, 'team-message-delivered', T, { recipientInstanceId: 'mate', subject: 'to mate' }, 'message'),
      uiEntry(2, 'team-message-delivered', T + 1000, { recipientInstanceId: 'lead', subject: 'to lead' }, 'message'),
    ]
    const { view } = renderLedger({ ledger: ledgerModel(entries), ledgerState: state(entries) })
    const select = view.container.querySelector<HTMLSelectElement>('[data-ledger-filter-instance]')
    if (select === null) throw new Error('the instance select did not render')
    // The options: all + the two members + the two templates.
    expect(select.options).toHaveLength(5)
    fireEvent.change(select, { target: { value: 'mate' } })
    expect(rowButtons(view).map(row => row.getAttribute('data-ledger-fact'))).toEqual(['team-message-delivered'])
    fireEvent.change(select, { target: { value: 'tpl-lead' } })
    expect(rowButtons(view).map(row => row.getAttribute('data-ledger-actor'))).toEqual(['Lead'])
  })

  it('renders the decision reason in the state badge', () => {
    const entries = [
      uiEntry(1, 'control-decision-recorded', T, {
        requestId: 'r1', decision: 'deny', scope: { targetInstanceId: 'mate' }, reason: 'out of policy',
      }, 'control'),
    ]
    const { view } = renderLedger({ ledger: ledgerModel(entries), ledgerState: state(entries) })
    const reason = view.container.querySelector('[data-ledger-state-reason]')
    expect(reason?.textContent).toBe('out of policy')
    expect(reason?.getAttribute('title')).toBe('out of policy')
  })

  it('renders the progress label on progress rows', () => {
    const entries = [
      uiEntry(1, 'activity-progress-recorded', T, {
        instanceId: 'mate', subject: 'Wiring', progress: 'blocked',
      }, 'progress'),
    ]
    const { view } = renderLedger({ ledger: ledgerModel(entries), ledgerState: state(entries) })
    const badge = view.container.querySelector('[data-ledger-state][data-progress="blocked"]')
    expect(badge?.textContent).toBe('受阻')
  })

  it('keeps the en dictionary pairing for the section chrome', () => {
    const entries = [
      uiEntry(1, 'team-message-delivered', T, { recipientInstanceId: 'mate', subject: 'go' }, 'message'),
    ]
    const { view } = renderLedger({
      ledger: ledgerModel(entries),
      ledgerState: state(entries, { error: { ok: false, error: { code: 'remote', message: 'boom', details: { method: 'team.getLedgerPage', endpoint: 'team', contractVersion: 1, requestToken: null } } } }),
      t: makeTranslate(en),
    })
    expect(view.container.querySelector('[data-ledger-marker]')?.textContent).toBe('Message')
    expect(view.container.querySelector('[data-ledger-load-earlier]')).toBeNull()
    expect(view.container.querySelector('[data-ledger-error]')?.textContent).toBe('Loading events failed: boom')
    expect(view.container.querySelector('[data-ledger-retry]')?.textContent).toBe('Retry')
  })

  it('shows the section empty state from the en dictionary', () => {
    const { view } = renderLedger({ t: makeTranslate(en) })
    expect(view.container.querySelector('[data-ledger-empty]')?.textContent).toBe('No team events yet')
  })
})
