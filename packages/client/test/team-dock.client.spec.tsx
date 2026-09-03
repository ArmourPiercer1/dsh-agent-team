// @vitest-environment jsdom
/**
 * Resident team dock (D11–D13, P9-T5 plan §8.6): the collapsed D23 readout
 * (zero-count segments omitted — N from the projection lifecycle, never the
 * session log; M from the frozen team-wide ledger summary, never a
 * per-row sum), the expandable compact member status and current-work
 * activity rows (the legacy compact task rows), the jump-entry tab
 * activation, the non-team-session absence with the projection-mirror-gap
 * cold pull, and the en/zh dictionary pairing.
 */
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { makeTranslate } from '@deepseek-ai/dsh-client-test-runtime'
import type { TeamProjectionDto } from '../../contracts/src/index.js'
import type {
  TeamProjectionMirror, TeamProjectionResolution,
} from '../src/state/team-session-resolution.js'
import type {
  TeamUiDisplayStatus, TeamUiMemberInstance, TeamUiSnapshot,
} from '../src/model/team-ui-snapshot.js'
import { TeamDock, TeamDockPanel, type TeamDockProps } from '../src/ui/TeamDock.js'
import { en, zh } from '../src/ui/locales.js'

const LEADER = 'leader-s'
const MEMBER = 'mate-s'
const OUTSIDER = 'plain-s'

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
    createdAt: '2026-08-29T00:00:00.000Z',
    ...overrides,
  } as unknown as TeamUiMemberInstance
}

/** The default team: a created leader bound to the team session, one running
 * instance, and one created instance without a session; two current-work
 * activity rows; the team-wide summary carries two pending controls. */
function snapshot(overrides: Partial<TeamUiSnapshot> = {}): TeamUiSnapshot {
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
    members: [
      instance({ instanceId: 'lead', templateId: 'tpl-lead', label: 'Lead', childSessionId: LEADER }),
      instance({
        instanceId: 'a', templateId: 'tpl-a', label: 'Alpha', childSessionId: MEMBER,
        lifecycle: LIFECYCLE.running, displayStatus: 'running',
      }),
      instance({ instanceId: 'b', templateId: 'tpl-b', label: 'Beta' }),
    ],
    compatibility: {
      status: 'OPEN', probeGeneration: 1, requirementFingerprint: 'rf-1', environmentFingerprint: 'ef-1',
      warningCount: 0, fatalCount: 0, acknowledgedWarningCount: 0,
    },
    policyState: 'open',
    ledgerSummary: { latestSequence: 0, totalEntries: 0, byCategory: { ...ZERO_CATEGORIES }, pendingControlCount: 2 },
    activity: [
      { instanceId: 'a', label: 'Alpha', status: 'in-progress', subject: 'Wire the mirror', openIntervals: [] },
      { instanceId: 'lead', label: 'Lead', status: 'completed', subject: 'Ship the dock', openIntervals: [] },
    ],
    disposedHistory: [],
    ...overrides,
  } as unknown as TeamUiSnapshot
}

function panelProps(
  team: TeamUiSnapshot = snapshot(),
  openTeamTab: () => void = vi.fn(),
  dict: Record<string, string> = zh,
): Parameters<typeof TeamDockPanel>[0] {
  return { snapshot: team, openTeamTab, t: makeTranslate(dict) }
}

/** One minimal projection frame (plain object; the branded ids are wire-level here). */
function frame(
  teamSessionId: string,
  members: readonly Record<string, unknown>[],
  pendingControlCount: number = 2,
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
    ledger: { latestSequence: 0, totalEntries: 0, byCategory: {}, pendingControlCount },
  } as unknown as TeamProjectionDto
}

/** One minimal wire member row; the leader omits its child session. */
function wireMember(
  instanceId: string,
  childSessionId: string | null,
  lifecycle: string,
): Record<string, unknown> {
  return {
    instanceId,
    templateId: 'tpl-1',
    label: `member ${instanceId}`,
    ...(childSessionId === null ? {} : { childSessionId }),
    workspace: 'wsp',
    createdAt: '2026-08-29T00:00:00.000Z',
    lifecycle,
    contextPolicy: 'persistent',
    effectiveConfig: { model: 'm', workspace: 'wsp', permissions: {}, autonomy: 'full' },
    liveActivity: null,
  }
}

function mirrorOf(...frames: Array<[string, TeamProjectionDto]>): TeamProjectionMirror {
  const plain: Record<string, TeamProjectionDto> = {}
  for (const [key, value] of frames) plain[key] = value
  return plain as unknown as TeamProjectionMirror
}

const MIRROR = mirrorOf([
  LEADER,
  frame(LEADER, [
    wireMember('lead', null, 'CREATED'),
    wireMember('a', MEMBER, 'RUNNING'),
    wireMember('b', null, 'CREATED'),
  ]),
])

function dockProps(
  mirror: TeamProjectionMirror,
  sessionId: string,
  overrides: {
    openTeamTab?: () => void
    ensureProjection?: (id: string) => Promise<void>
    dict?: Record<string, string>
  } = {},
): TeamDockProps {
  return {
    sessionId,
    useProjectionMirror: (
      selector: (mirror: TeamProjectionMirror) => TeamProjectionResolution | undefined,
    ) => selector(mirror),
    ensureProjection: overrides.ensureProjection ?? vi.fn(() => Promise.resolve()),
    openTeamTab: overrides.openTeamTab ?? vi.fn(),
    t: makeTranslate(overrides.dict ?? zh),
  } as unknown as TeamDockProps
}

afterEach(cleanup)

describe('TeamDockPanel', () => {
  it('renders the collapsed D23 readout with both counts on one line', () => {
    const { container } = render(<TeamDockPanel {...panelProps()} />)
    const root = container.querySelector('[data-team-dock]')
    expect(root).toBeTruthy()
    // Collapsed by default: the expanded body is absent.
    expect(container.querySelector('[data-team-dock-expanded]')).toBeNull()
    expect(screen.getByText('团队')).toBeTruthy()
    // N = the running projection-lifecycle instances (1), M = the frozen
    // team-wide summary count (2); the D12 leading separator after the title
    // renders with the readout.
    expect(container.querySelector('[data-dock-readout]')?.textContent)
      .toBe('1 运行中\u2002·\u20022 待裁决')
    expect(container.querySelector('[data-dock-sep]')?.textContent).toBe('\u2002·\u2002')
    // The jump entry's accessible name derives from its content, keeping the
    // D12 resident readout exposed to assistive tech (no aria-label override).
    expect(screen.getByRole('button', { name: /团队.*1 运行中.*2 待裁决/ })).toBeTruthy()
  })

  it('omits the zero-count readout segments and keeps a bare title when both are zero', () => {
    const idle = snapshot({
      members: [instance({ instanceId: 'lead', templateId: 'tpl-lead', label: 'Lead', childSessionId: LEADER })],
      activity: [],
      ledgerSummary: { latestSequence: 0, totalEntries: 0, byCategory: { ...ZERO_CATEGORIES }, pendingControlCount: 0 },
    })
    const { container } = render(<TeamDockPanel {...panelProps(idle)} />)
    expect(container.querySelector('[data-dock-readout]')).toBeNull()
    // No surviving segment: the leading separator is omitted with it.
    expect(container.querySelector('[data-dock-sep]')).toBeNull()
    expect(container.querySelector('[data-dock-title]')?.textContent).toBe('团队')

    const pendingOnly = snapshot({
      members: [instance({ instanceId: 'lead', templateId: 'tpl-lead', label: 'Lead', childSessionId: LEADER })],
      activity: [],
      ledgerSummary: { latestSequence: 0, totalEntries: 0, byCategory: { ...ZERO_CATEGORIES }, pendingControlCount: 3 },
    })
    const pendingRender = render(<TeamDockPanel {...panelProps(pendingOnly)} />)
    expect(pendingRender.container.querySelector('[data-dock-readout]')?.textContent).toBe('3 待裁决')
    expect(pendingRender.container.querySelector('[data-dock-sep]')?.textContent).toBe('\u2002·\u2002')
    pendingRender.unmount()

    const runningOnly = snapshot({
      members: [instance({
        instanceId: 'a', templateId: 'tpl-a', label: 'Alpha', childSessionId: MEMBER,
        lifecycle: LIFECYCLE.running, displayStatus: 'running',
      })],
      activity: [],
      ledgerSummary: { latestSequence: 0, totalEntries: 0, byCategory: { ...ZERO_CATEGORIES }, pendingControlCount: 0 },
    })
    const runningRender = render(<TeamDockPanel {...panelProps(runningOnly)} />)
    expect(runningRender.container.querySelector('[data-dock-readout]')?.textContent).toBe('1 运行中')
    expect(runningRender.container.querySelector('[data-dock-sep]')?.textContent).toBe('\u2002·\u2002')
    runningRender.unmount()
  })

  it('toggles the expanded body on the chevron and flips aria-expanded', () => {
    const { container } = render(<TeamDockPanel {...panelProps()} />)
    const toggle = container.querySelector<HTMLButtonElement>('[data-team-dock-toggle]')
    if (toggle === null) throw new Error('the chevron did not render')
    expect(toggle.getAttribute('aria-expanded')).toBe('false')
    fireEvent.click(toggle)
    expect(toggle.getAttribute('aria-expanded')).toBe('true')
    expect(container.querySelector('[data-team-dock-expanded]')).toBeTruthy()
    fireEvent.click(toggle)
    expect(toggle.getAttribute('aria-expanded')).toBe('false')
    expect(container.querySelector('[data-team-dock-expanded]')).toBeNull()
  })

  it('lists the member status rows (name + dot) and the activity rows when expanded', () => {
    const { container } = render(<TeamDockPanel {...panelProps()} />)
    fireEvent.click(container.querySelector<HTMLElement>('[data-team-dock-toggle]')!)
    // Member rows: every current-roster instance in members order (the
    // unbound-skip is abolished with the unbound vocabulary).
    const members = container.querySelectorAll<HTMLElement>('[data-dock-member]')
    expect(members).toHaveLength(3)
    expect(members[0]?.textContent).toBe('Lead')
    expect(members[0]?.dataset.memberStatus).toBe('created')
    expect(members[1]?.textContent).toBe('Alpha')
    expect(members[1]?.dataset.memberStatus).toBe('running')
    expect(members[2]?.textContent).toBe('Beta')
    expect(members[2]?.dataset.memberStatus).toBe('created')
    // The state dot is aria-hidden and paired with the status in the row label.
    expect(members[0]?.getAttribute('aria-label')).toBe('Lead 已创建')
    expect(members[1]?.getAttribute('aria-label')).toBe('Alpha 运行中')
    // Activity rows: subject plus the status label, in snapshot order.
    const activities = container.querySelectorAll<HTMLElement>('[data-dock-activity]')
    expect(activities).toHaveLength(2)
    expect(activities[0]?.textContent).toBe('Wire the mirror进行中')
    expect(activities[0]?.dataset.activityStatus).toBe('in-progress')
    expect(activities[1]?.textContent).toBe('Ship the dock已完成')
    expect(activities[1]?.dataset.activityStatus).toBe('completed')
  })

  it('covers the remaining dot states: an archived member and a blocked activity', () => {
    const team = snapshot({
      members: [instance({
        instanceId: 'lead', templateId: 'tpl-lead', label: 'Lead', childSessionId: LEADER,
        lifecycle: LIFECYCLE.archived, displayStatus: 'archived',
      })],
      activity: [
        { instanceId: 'lead', label: 'Lead', status: 'blocked', subject: 'Stuck step', openIntervals: [] },
      ],
      ledgerSummary: { latestSequence: 0, totalEntries: 0, byCategory: { ...ZERO_CATEGORIES }, pendingControlCount: 0 },
    })
    const { container } = render(<TeamDockPanel {...panelProps(team)} />)
    expect(container.querySelector('[data-dock-readout]')).toBeNull()
    fireEvent.click(container.querySelector<HTMLElement>('[data-team-dock-toggle]')!)
    const member = container.querySelector<HTMLElement>('[data-dock-member]')
    expect(member?.dataset.memberStatus).toBe('archived')
    expect(member?.getAttribute('aria-label')).toBe('Lead 已归档')
    const activities = container.querySelectorAll<HTMLElement>('[data-dock-activity]')
    expect(activities[0]?.textContent).toBe('Stuck step受阻')
    expect(activities[0]?.dataset.activityStatus).toBe('blocked')
  })

  it('shows the one-line empty notes while the team carries no member status or activity', () => {
    const empty = snapshot({
      members: [],
      activity: [],
      ledgerSummary: { latestSequence: 0, totalEntries: 0, byCategory: { ...ZERO_CATEGORIES }, pendingControlCount: 0 },
    })
    const { container } = render(<TeamDockPanel {...panelProps(empty)} />)
    expect(container.querySelector('[data-dock-readout]')).toBeNull()
    fireEvent.click(container.querySelector<HTMLElement>('[data-team-dock-toggle]')!)
    expect(screen.getByText('暂无成员状态')).toBeTruthy()
    expect(screen.getByText('暂无活动进度')).toBeTruthy()
  })

  it('activates the team tab when the jump entry is clicked, without toggling the expansion (D13)', () => {
    const openTeamTab = vi.fn()
    const { container } = render(<TeamDockPanel {...panelProps(snapshot(), openTeamTab)} />)
    const jump = container.querySelector<HTMLElement>('[data-team-dock-jump]')
    if (jump === null) throw new Error('the jump entry did not render')
    // The jump intent rides the title tooltip; the accessible name stays the
    // readout content (no aria-label override).
    expect(jump.getAttribute('title')).toBe('打开团队标签页')
    expect(jump.getAttribute('aria-label')).toBeNull()
    fireEvent.click(jump)
    expect(openTeamTab).toHaveBeenCalledTimes(1)
    // The jump entry is the anchor, not the collapse control.
    expect(container.querySelector('[data-team-dock-expanded]')).toBeNull()
  })

  it('renders the English dictionary pairing', () => {
    const { container } = render(<TeamDockPanel {...panelProps(snapshot(), vi.fn(), en)} />)
    expect(container.querySelector('[data-dock-title]')?.textContent).toBe('Team')
    expect(container.querySelector('[data-dock-readout]')?.textContent)
      .toBe('1 running\u2002·\u20022 pending')
    fireEvent.click(container.querySelector<HTMLElement>('[data-team-dock-toggle]')!)
    expect(container.querySelectorAll('[data-dock-member]')).toHaveLength(3)
    expect(screen.queryByText('No activity progress yet')).toBeNull()
    expect(screen.getByText('In progress')).toBeTruthy()
  })
})

describe('TeamDock', () => {
  it('renders nothing for a non-team session and cold-pulls the projection-mirror gap once per mount', () => {
    const ensureProjection = vi.fn(() => Promise.resolve())
    const view = render(<TeamDock {...dockProps(mirrorOf(), OUTSIDER, { ensureProjection })} />)
    expect(view.container.querySelector('[data-team-dock]')).toBeNull()
    expect(ensureProjection).toHaveBeenCalledTimes(1)
    expect(ensureProjection).toHaveBeenCalledWith(OUTSIDER)
    // While the mirror stays empty, re-renders must not re-fire the pull
    // (the single-flight cold read is per mount, not per render).
    view.rerender(<TeamDock {...dockProps(mirrorOf(), OUTSIDER, { ensureProjection })} />)
    expect(ensureProjection).toHaveBeenCalledTimes(1)
    view.unmount()
  })

  it('renders the panel for the member session resolved through the binding (no cold pull)', () => {
    const ensureProjection = vi.fn(() => Promise.resolve())
    const { container } = render(<TeamDock {...dockProps(MIRROR, MEMBER, { ensureProjection })} />)
    expect(container.querySelector('[data-team-dock]')).toBeTruthy()
    expect(container.querySelector('[data-dock-readout]')?.textContent)
      .toBe('1 运行中\u2002·\u20022 待裁决')
    expect(ensureProjection).not.toHaveBeenCalled()
  })

  it('appears when the cold pull lands and stops pulling once the mirror gains the session', () => {
    const ensureProjection = vi.fn(() => Promise.resolve())
    const view0 = render(<TeamDock {...dockProps(mirrorOf(), LEADER, { ensureProjection })} />)
    expect(ensureProjection).toHaveBeenCalledTimes(1)
    view0.rerender(<TeamDock {...dockProps(MIRROR, LEADER, { ensureProjection })} />)
    expect(view0.container.querySelector('[data-team-dock]')).toBeTruthy()
    expect(ensureProjection).toHaveBeenCalledTimes(1)
    view0.unmount()
  })

  it('threads the jump callback through the adapter to the jump entry (D13)', () => {
    const openTeamTab = vi.fn()
    const { container } = render(<TeamDock {...dockProps(MIRROR, LEADER, { openTeamTab })} />)
    fireEvent.click(container.querySelector<HTMLElement>('[data-team-dock-jump]')!)
    expect(openTeamTab).toHaveBeenCalledTimes(1)
  })
})
