// @vitest-environment jsdom
/**
 * The Activity / Progress section (P9-T6, plan §8.11 ADAPT): the legacy
 * `team-tasks.client.spec.tsx` (7 tests) mapped onto the new input —
 *
 *  - row anatomy → kept (the legacy task-row layout, reused verbatim);
 *  - four status labels → the THREE frozen ProgressValue labels
 *    (in-progress / completed / blocked) plus the ABSENT-status arm
 *    (the legacy `pending` state does not exist in the vNext
 *    current-work face: a row without a status shows no status text and
 *    reads as ongoing);
 *  - absent summary → kept;
 *  - raw-id fallback (D19) → DROPPED: the label resolution moved into the
 *    adapter (the snapshot member rows carry the display label; the section
 *    renders `row.label` as-is — the model spec covers the fallback);
 *  - empty state / non-interactive rows (D9) → kept;
 *  - English pairing → kept.
 */
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { makeTranslate } from '@deepseek-ai/dsh-client-test-runtime'
import type { TeamUiCurrentWorkRow } from '../src/model/team-ui-snapshot.js'
import { TeamActivity } from '../src/ui/TeamActivity.js'
import { en, zh } from '../src/ui/locales.js'

afterEach(cleanup)

/** One current-work row (the adapter's face; the ONE boundary cast). */
function workRow(overrides: Partial<TeamUiCurrentWorkRow> & { instanceId: string; label: string }): TeamUiCurrentWorkRow {
  return {
    openIntervals: [],
    ...overrides,
  } as unknown as TeamUiCurrentWorkRow
}

const ROWS: readonly TeamUiCurrentWorkRow[] = [
  workRow({
    instanceId: 'mate', label: 'Mate',
    status: 'in-progress', subject: 'Wiring the mirror', summary: 'Half done',
  }),
  workRow({
    instanceId: 'lead', label: 'Lead',
    status: 'completed', subject: 'Blueprint', summary: 'Frozen',
  }),
  workRow({
    instanceId: 'sage', label: 'Sage',
    status: 'blocked', subject: 'Storage seam',
  }),
  workRow({
    instanceId: 'fresh', label: 'Fresh',
    currentAction: 'typing',
  }),
]

describe('TeamActivity', () => {
  it('renders the row anatomy: dot, subject, status label, member, summary', () => {
    const { container } = render(<TeamActivity activity={ROWS} t={makeTranslate(zh)} />)
    const rows = container.querySelectorAll('[data-activity-row]')
    expect(rows).toHaveLength(4)
    const first = rows[0]
    expect(first?.getAttribute('data-activity-status')).toBe('in-progress')
    expect(first?.querySelector('[data-activity-subject]')?.textContent).toBe('Wiring the mirror')
    expect(first?.querySelector('[data-activity-status-text]')?.textContent).toBe('进行中')
    expect(first?.querySelector('[data-activity-member]')?.textContent).toBe('负责人 Mate')
    expect(first?.querySelector('[data-activity-summary]')?.textContent).toBe('Half done')
  })

  it('renders the three frozen status labels and the absent-status arm', () => {
    const { container } = render(<TeamActivity activity={ROWS} t={makeTranslate(zh)} />)
    const rows = container.querySelectorAll('[data-activity-row]')
    expect(rows[1]?.querySelector('[data-activity-status-text]')?.textContent).toBe('已完成')
    expect(rows[2]?.querySelector('[data-activity-status-text]')?.textContent).toBe('受阻')
    // The absent-status row: no status text, the subject falls back
    // through currentAction, and the row still renders (no status is never
    // an error).
    const fresh = rows[3]
    expect(fresh?.hasAttribute('data-activity-status')).toBe(false)
    expect(fresh?.querySelector('[data-activity-status-text]')).toBeNull()
    expect(fresh?.querySelector('[data-activity-subject]')?.textContent).toBe('typing')
  })

  it('omits the summary node when the row carries no summary', () => {
    const { container } = render(<TeamActivity activity={[ROWS[2]!]} t={makeTranslate(zh)} />)
    const row = container.querySelector('[data-activity-row]')
    expect(row?.querySelector('[data-activity-summary]')).toBeNull()
  })

  it('renders the instance label as-is (the resolution lives in the adapter)', () => {
    const { container } = render(<TeamActivity activity={ROWS} t={makeTranslate(zh)} />)
    const rows = container.querySelectorAll('[data-activity-row]')
    expect([...rows].map(row => row.querySelector('[data-activity-member]')?.textContent)).toEqual([
      '负责人 Mate', '负责人 Lead', '负责人 Sage', '负责人 Fresh',
    ])
  })

  it('renders the one-line empty state', () => {
    render(<TeamActivity activity={[]} t={makeTranslate(zh)} />)
    expect(screen.getByText('暂无活动进度')).toBeTruthy()
  })

  it('keeps the rows non-interactive (no buttons, no navigation)', () => {
    const { container } = render(<TeamActivity activity={ROWS} t={makeTranslate(zh)} />)
    expect(container.querySelectorAll('button')).toHaveLength(0)
    const row = container.querySelector('[data-activity-row]')
    if (row === null) throw new Error('the row did not render')
    fireEvent.click(row)
    // No handler, no navigation side effect: the click is a no-op.
    expect(row).toBeTruthy()
  })

  it('keeps the en dictionary pairing', () => {
    const { container } = render(<TeamActivity activity={ROWS} t={makeTranslate(en)} />)
    const rows = container.querySelectorAll('[data-activity-row]')
    expect(rows[0]?.querySelector('[data-activity-status-text]')?.textContent).toBe('In progress')
    expect(rows[1]?.querySelector('[data-activity-status-text]')?.textContent).toBe('Completed')
    expect(rows[2]?.querySelector('[data-activity-status-text]')?.textContent).toBe('Blocked')
    expect(rows[0]?.querySelector('[data-activity-member]')?.textContent).toBe('Assignee Mate')
  })
})
