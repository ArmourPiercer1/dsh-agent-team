// @vitest-environment jsdom
/**
 * Team member-group section (P9-T5, plan §8.4): the `Name · N 活跃` container
 * rows, the fixed leading leader row (anchored to the first leader-kind
 * instance, synthesized from the team session when the rows carry none), the
 * five-state instance rows with the action placeholder and the
 * completeness-aware waiting badge (plan §7.3), the D9 click-to-switch
 * (leader row and per instance, child sessions), the D7 current-session
 * highlight, the non-interactive non-leader rows, and the en/zh dictionary
 * pairing. The legacy "unbound" vocabulary is abolished: every snapshot
 * instance is a real row (the CREATED lifecycle replaces the absent bound
 * session).
 * T7 note (P9): the instance row is now a `div[data-member-instance]`
 * wrapper holding the `button[data-member-instance-nav]` (the D9 click
 * target, disabled when the row binds no session) plus the S5-B action
 * cluster; the D9 click-to-switch assertions below MIGRATE from clicking
 * the row itself to clicking the nav button. The S5-B command behaviors
 * live in `team-members-actions.client.spec.tsx`.
 */
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { makeTranslate } from '@deepseek-ai/dsh-client-test-runtime'
import type {
  TeamUiDisplayStatus, TeamUiLedgerModel, TeamUiMemberInstance, TeamUiSnapshot,
} from '../src/model/team-ui-snapshot.js'
import { TeamMembers } from '../src/ui/TeamMembers.js'
import { en, zh } from '../src/ui/locales.js'

const LEADER = 'leader-s'
const SA = 'sa'
const SB = 'sb'

const iso = (ms: number): string => new Date(ms).toISOString()

const ZERO_CATEGORIES = {
  team: 0, member: 0, lifecycle: 0, message: 0, control: 0, policy: 0, compatibility: 0, progress: 0,
} as const

/** The §7.2 display → raw lifecycle pairing for fixture rows. */
const LIFECYCLE: Record<TeamUiDisplayStatus, TeamUiMemberInstance['lifecycle']> = {
  created: 'CREATED',
  running: 'RUNNING',
  settled: 'SETTLED',
  archived: 'ARCHIVED',
  disposed: 'DISPOSED',
}

function instance(
  overrides: Partial<TeamUiMemberInstance> & Pick<TeamUiMemberInstance, 'instanceId' | 'templateId' | 'label'>,
): TeamUiMemberInstance {
  return {
    childSessionId: null,
    lifecycle: 'CREATED',
    displayStatus: 'created',
    liveActivity: null,
    pendingControlCount: null,
    fromHistory: false,
    createdAt: iso(1_700_000_000_000),
    ...overrides,
  } as unknown as TeamUiMemberInstance
}

function snapshot(
  members: readonly TeamUiMemberInstance[],
  overrides: Partial<TeamUiSnapshot> = {},
): TeamUiSnapshot {
  return {
    teamSessionId: LEADER,
    generation: 1,
    blueprint: { blueprintId: 'bp-1', revision: '1', contentHash: 'h-1' },
    perspective: { kind: 'team-root' },
    templates: [
      { kind: 'leader', templateId: 'tpl-lead', displayName: 'Lead', contextPolicy: 'persistent' },
      { kind: 'member', templateId: 'tpl-a', displayName: 'Alpha', contextPolicy: 'persistent' },
      { kind: 'member', templateId: 'tpl-b', displayName: 'Beta', contextPolicy: 'persistent' },
    ],
    members,
    compatibility: {
      status: 'OPEN', probeGeneration: 1, requirementFingerprint: 'rf-1', environmentFingerprint: 'ef-1',
      warningCount: 0, fatalCount: 0, acknowledgedWarningCount: 0,
    },
    policyState: 'open',
    ledgerSummary: { latestSequence: 0, totalEntries: 0, byCategory: { ...ZERO_CATEGORIES }, pendingControlCount: 0 },
    activity: [],
    disposedHistory: [],
    ...overrides,
  } as unknown as TeamUiSnapshot
}

function ledger(overrides: Partial<TeamUiLedgerModel> = {}): TeamUiLedgerModel {
  return {
    completeness: 'partial',
    entries: [],
    controls: [],
    messages: [],
    intervals: [],
    progress: [],
    pendingControlByInstance: {},
    ...overrides,
  } as unknown as TeamUiLedgerModel
}

/** The default team: the leader bound to the team session, one running
 * instance with the current tool call and one pending control request, and
 * one created instance without a session. */
function defaultTeam(): TeamUiSnapshot {
  return snapshot([
    instance({ instanceId: 'lead', templateId: 'tpl-lead', label: 'Lead', childSessionId: LEADER }),
    instance({
      instanceId: 'a', templateId: 'tpl-a', label: 'Alpha', childSessionId: SA,
      lifecycle: LIFECYCLE.running, displayStatus: 'running', currentAction: 'Bash',
    }),
    instance({ instanceId: 'b', templateId: 'tpl-b', label: 'Beta' }),
  ])
}

function makeProps(
  team: TeamUiSnapshot = defaultTeam(),
  ledgerModel: TeamUiLedgerModel = ledger(),
  currentSessionId: string = LEADER,
  onSelectSession: (sessionId: string) => void = vi.fn(),
  dict: Record<string, string> = zh,
): Parameters<typeof TeamMembers>[0] {
  return { snapshot: team, ledger: ledgerModel, currentSessionId, onSelectSession, t: makeTranslate(dict) }
}

function groupRows(container: HTMLElement): HTMLElement[] {
  return [...container.querySelectorAll<HTMLElement>('[data-member-group-row]')]
}

function leaderRow(container: HTMLElement): HTMLButtonElement {
  const button = container.querySelector<HTMLButtonElement>('[data-member-group-row][data-leader]')
  if (button === null) throw new Error('the leading leader row did not render')
  return button
}

afterEach(cleanup)

describe('TeamMembers', () => {
  it('renders one group per member with the container row label, leader first', () => {
    const { container } = render(<TeamMembers {...makeProps()} />)
    expect(container.querySelector('[data-team-members]')).toBeTruthy()
    expect(groupRows(container).map(row => row.textContent)).toEqual([
      'Lead · 0 活跃',
      'Alpha · 1 活跃',
      'Beta · 0 活跃',
    ])
    expect(groupRows(container)[0]?.tagName).toBe('BUTTON')
  })

  it('switches back to the team session when the leading row is clicked (D10)', () => {
    const openSession = vi.fn()
    const { container } = render(<TeamMembers {...makeProps(defaultTeam(), ledger(), SA, openSession)} />)
    fireEvent.click(leaderRow(container))
    expect(openSession).toHaveBeenCalledTimes(1)
    expect(openSession).toHaveBeenCalledWith(LEADER)
  })

  it('keeps the leading row when the instances lack a leader-kind row (roster-absent fallback)', () => {
    const openSession = vi.fn()
    const team = snapshot([
      instance({
        instanceId: 'a', templateId: 'tpl-a', label: 'Alpha', childSessionId: SA,
        lifecycle: LIFECYCLE.running, displayStatus: 'running',
      }),
    ])
    const { container } = render(<TeamMembers {...makeProps(team, ledger(), LEADER, openSession)} />)
    expect(leaderRow(container).textContent).toBe('领导者 · 0 活跃')
    // UI §16.1/§17.1 (P9 bug #5): the other zero-instance template groups
    // render their own no-instances note — scope the assertion to the
    // synthesized leader group.
    const leaderGroup = leaderRow(container).closest('[data-member-group]')
    expect(leaderGroup?.querySelector('[data-member-no-instances]')?.textContent).toBe('尚无实例')
    fireEvent.click(leaderRow(container))
    expect(openSession).toHaveBeenCalledWith(LEADER)
  })

  it('shows the five-state instance labels and the state dots', () => {
    const team = snapshot([
      instance({
        instanceId: 'lead', templateId: 'tpl-lead', label: 'Lead', childSessionId: LEADER,
        lifecycle: LIFECYCLE.settled, displayStatus: 'settled',
      }),
      instance({ instanceId: 'a', templateId: 'tpl-a', label: 'Alpha', childSessionId: SA }),
      instance({
        instanceId: 'b', templateId: 'tpl-b', label: 'Beta', childSessionId: SB,
        lifecycle: LIFECYCLE.running, displayStatus: 'running',
      }),
    ])
    const { container } = render(<TeamMembers {...makeProps(team)} />)
    expect(screen.getByText('已结算')).toBeTruthy()
    expect(screen.getByText('已创建')).toBeTruthy()
    expect(screen.getByText('运行中')).toBeTruthy()
    const byStatus = (status: string): HTMLElement | null =>
      container.querySelector(`[data-member-instance][data-status="${status}"]`)
    expect(byStatus('created')?.querySelector('[data-member-status-text]')?.textContent).toBe('已创建')
    expect(byStatus('running')?.querySelector('[data-member-status-text]')?.textContent).toBe('运行中')
    expect(byStatus('settled')?.querySelector('[data-member-status-text]')?.textContent).toBe('已结算')
  })

  it('lists a created instance as a real row in its group (the unbound vocabulary is abolished)', () => {
    const { container } = render(<TeamMembers {...makeProps()} />)
    expect(screen.getByText('Beta · 0 活跃')).toBeTruthy()
    const beta = container.querySelectorAll<HTMLElement>('[data-member-group]')[2]
    const betaInstance = beta?.querySelector<HTMLElement>('[data-member-instance]')
    expect(betaInstance?.dataset.status).toBe('created')
    expect(betaInstance?.querySelector('[data-member-status-text]')?.textContent).toBe('已创建')
  })

  it('shows the current action and falls back to the action placeholder', () => {
    const team = snapshot([
      instance({ instanceId: 'lead', templateId: 'tpl-lead', label: 'Lead', childSessionId: LEADER }),
      instance({
        instanceId: 'a', templateId: 'tpl-a', label: 'Alpha', childSessionId: SA,
        currentAction: 'Bash',
      }),
    ])
    const { container } = render(<TeamMembers {...makeProps(team)} />)
    expect(screen.getByText('Bash')).toBeTruthy()
    expect(screen.getByText('暂无动作')).toBeTruthy()
    const leaderInstance = container.querySelector<HTMLElement>('[data-member-group] [data-member-instance]')
    expect(leaderInstance?.querySelector('[data-member-action]')?.textContent).toBe('暂无动作')
  })

  it('badges the waiting instances with the pending control-request count, completeness-aware (plan §7.3)', () => {
    const team = snapshot([
      instance({ instanceId: 'lead', templateId: 'tpl-lead', label: 'Lead', childSessionId: LEADER }),
      instance({
        instanceId: 'a', templateId: 'tpl-a', label: 'Alpha', childSessionId: SA,
        lifecycle: LIFECYCLE.running, displayStatus: 'running',
      }),
    ])
    const complete = ledger({ completeness: 'complete', pendingControlByInstance: { a: 2 } })
    const { container } = render(<TeamMembers {...makeProps(team, complete)} />)
    expect(screen.getByText('2 项待裁决')).toBeTruthy()
    expect(container.querySelectorAll('[data-member-waiting]')).toHaveLength(1)
    const partialRender = render(<TeamMembers {...makeProps(team, ledger())} />)
    expect(partialRender.container.querySelectorAll('[data-member-waiting]')).toHaveLength(0)
    const zeroRender = render(<TeamMembers {...makeProps(team, ledger({ completeness: 'complete' }))} />)
    expect(zeroRender.container.querySelectorAll('[data-member-waiting]')).toHaveLength(0)
    partialRender.unmount()
    zeroRender.unmount()
  })

  it('switches to the instance session on click, per instance for a multi-instance member (D9)', () => {
    const openSession = vi.fn()
    const team = snapshot([
      instance({ instanceId: 'lead', templateId: 'tpl-lead', label: 'Lead', childSessionId: LEADER }),
      instance({
        instanceId: 'a1', templateId: 'tpl-a', label: 'Alpha', childSessionId: 'sa1',
        lifecycle: LIFECYCLE.running, displayStatus: 'running',
      }),
      instance({
        instanceId: 'a2', templateId: 'tpl-a', label: 'Alpha', childSessionId: 'sa2',
        lifecycle: LIFECYCLE.running, displayStatus: 'running',
      }),
    ])
    const { container } = render(<TeamMembers {...makeProps(team, ledger(), LEADER, openSession)} />)
    const instances = container.querySelectorAll<HTMLButtonElement>('[data-member-instance-nav]')
    expect(instances).toHaveLength(3)
    fireEvent.click(instances[0]!)
    expect(openSession).toHaveBeenLastCalledWith(LEADER)
    fireEvent.click(instances[1]!)
    expect(openSession).toHaveBeenLastCalledWith('sa1')
    fireEvent.click(instances[2]!)
    expect(openSession).toHaveBeenLastCalledWith('sa2')
    expect(container.querySelector('[data-member-group-row]')?.textContent).toBe('Lead · 0 活跃')
    const alphaGroup = container.querySelectorAll<HTMLElement>('[data-member-group]')[1]
    expect(alphaGroup?.querySelector('[data-member-group-row]')?.textContent).toBe('Alpha · 2 活跃')
  })

  it('highlights the current session\'s group and instance rows only (D7)', () => {
    const { container } = render(<TeamMembers {...makeProps(defaultTeam(), ledger(), SA)} />)
    const groups = container.querySelectorAll<HTMLElement>('[data-member-group]')
    expect(groups[1]?.dataset.current).toBe('true')
    expect(groups[0]?.dataset.current).toBeUndefined()
    expect(groups[2]?.dataset.current).toBeUndefined()
    const rows = container.querySelectorAll<HTMLElement>('[data-member-instance]')
    expect(rows[0]?.dataset.current).toBeUndefined()
    expect(rows[1]?.dataset.current).toBe('true')

    const leaderView = render(<TeamMembers {...makeProps(defaultTeam(), ledger(), LEADER)} />)
    const leaderGroups = leaderView.container.querySelectorAll<HTMLElement>('[data-member-group]')
    expect(leaderGroups[0]?.dataset.current).toBe('true')
    expect(leaderGroups[1]?.dataset.current).toBeUndefined()
    const leaderRows = leaderView.container.querySelectorAll<HTMLElement>('[data-member-instance]')
    expect(leaderRows[0]?.dataset.current).toBe('true')
    expect(leaderRows[1]?.dataset.current).toBeUndefined()
    leaderView.unmount()
  })

  it('keeps the non-leader container rows non-interactive', () => {
    const openSession = vi.fn()
    const { container } = render(<TeamMembers {...makeProps(defaultTeam(), ledger(), SA, openSession)} />)
    const rows = groupRows(container)
    expect(rows[1]?.tagName).toBe('DIV')
    expect(rows[2]?.tagName).toBe('DIV')
    fireEvent.click(rows[1]!)
    expect(openSession).not.toHaveBeenCalled()
  })

  it('renders a session-less instance row as a disabled, inert row', () => {
    const openSession = vi.fn()
    const team = snapshot([
      instance({ instanceId: 'lead', templateId: 'tpl-lead', label: 'Lead', childSessionId: LEADER }),
      instance({ instanceId: 'a', templateId: 'tpl-a', label: 'Alpha' }),
    ])
    const { container } = render(<TeamMembers {...makeProps(team, ledger(), LEADER, openSession)} />)
    const instances = container.querySelectorAll<HTMLButtonElement>('[data-member-instance-nav]')
    expect(instances).toHaveLength(2)
    expect(instances[0]?.disabled).toBe(false)
    const sessionless = instances[1]!
    expect(sessionless.disabled).toBe(true)
    fireEvent.click(sessionless)
    expect(openSession).not.toHaveBeenCalled()
  })

  it('renders the English dictionary pairing (with the synthesized leader note)', () => {
    const complete = ledger({ completeness: 'complete', pendingControlByInstance: { a: 1 } })
    const team = snapshot([
      instance({
        instanceId: 'a', templateId: 'tpl-a', label: 'Alpha', childSessionId: SA,
        lifecycle: LIFECYCLE.running, displayStatus: 'running', currentAction: 'Bash',
      }),
      instance({ instanceId: 'b', templateId: 'tpl-b', label: 'Beta' }),
    ])
    const { container } = render(<TeamMembers {...makeProps(team, complete, LEADER, vi.fn(), en)} />)
    expect(groupRows(container).map(row => row.textContent)).toEqual([
      'Leader · 0 active',
      'Alpha · 1 active',
      'Beta · 0 active',
    ])
    expect(screen.getByText('Running')).toBeTruthy()
    expect(screen.getByText('Bash')).toBeTruthy()
    expect(screen.getByText('1 pending')).toBeTruthy()
    expect(screen.getByText('No instances yet')).toBeTruthy()
    expect(container.querySelector('[data-member-instance][data-status="settled"]')).toBeNull()
  })
})
