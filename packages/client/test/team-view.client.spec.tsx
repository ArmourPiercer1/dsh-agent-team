// @vitest-environment jsdom
/**
 * Team conversation view entry — the transitional dual path (T5/T6 split):
 * the frozen team-ness derivation over the leader-keyed mirror still drives
 * the zero state, the task board, and the event stream, while the interval
 * timeline and the member groups read the vNext projection path (the
 * per-session projection mirror plus the per-team ledger store) and appear
 * once the snapshot lands. Coverage: the zero state for a non-team session
 * (both cold pulls fire once), the complete four-section body for a team
 * session (all live), the D9 bar-click / member-row / feed-row session
 * switch wiring, the D10 leader-row return, and the mirror/projection-gap
 * cold pull (landing frames win, no re-fire).
 */
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { makeTranslate } from '@deepseek-ai/dsh-client-test-runtime'
import type {
  RpcResult, SessionId, TeamMessagePage, TeamMirror, TeamView as TeamWireView,
} from '../src/model/team-view-compat.js'
import { resolveTeamView } from '../src/model/team-view-compat.js'
import type { TeamProjectionMirror } from '../src/state/team-session-resolution.js'
import type { TeamLedgerState } from '../src/state/team-ledger-store.js'
import type { RemoteLedgerEntryValue } from '../../remote/src/index.js'
import type { TeamProjectionDto } from '../../contracts/src/index.js'
import { TeamView, type TeamViewProps } from '../src/ui/TeamView.js'
import { zh } from '../src/ui/locales.js'

afterEach(cleanup)
beforeEach(() => {
  Element.prototype.setPointerCapture = vi.fn()
})
afterEach(() => {
  delete (Element.prototype as { setPointerCapture?: unknown }).setPointerCapture
})

const LEADER = 'team-leader' as SessionId
const MEMBER = 'team-member' as SessionId
const OUTSIDER = 'plain-session' as SessionId

const T = 1_700_000_000_000
function iso(ms: number): string {
  return new Date(ms).toISOString()
}

function wireView(leader: string, delegations: TeamWireView['delegations'] = []): TeamWireView {
  return {
    teamId: leader,
    leaderSessionId: leader,
    rosterMemberCount: 2,
    members: [
      {
        memberId: 'leader', name: 'leader', role: 'leader', sessionIds: [leader],
        status: 'bound', pendingControlCount: 0,
      },
      {
        memberId: 'mate', name: 'mate', role: 'teammate', sessionIds: [MEMBER],
        status: 'running', pendingControlCount: 0,
      },
    ],
    delegations,
    tasks: [],
    approvals: [],
    messages: [],
    messageCount: 0,
  }
}

const LEADER_MIRROR: TeamMirror = { [LEADER]: wireView(LEADER) }

/** One wire member DTO row (plain object; `childSessionId` null = the leader, field omitted). */
function wireMember(
  instanceId: string,
  childSessionId: string | null,
  lifecycle: 'CREATED' | 'RUNNING' | 'SETTLED' | 'ARCHIVED' | 'DISPOSED' = 'CREATED',
): Record<string, unknown> {
  return {
    instanceId,
    templateId: instanceId === 'lead' ? 'tpl-lead' : 'tpl-mate',
    label: instanceId,
    ...(childSessionId === null ? {} : { childSessionId }),
    workspace: 'wsp',
    createdAt: '2026-08-29T00:00:00.000Z',
    lifecycle,
    contextPolicy: 'persistent',
    effectiveConfig: { model: 'm', workspace: 'wsp', permissions: {}, autonomy: 'full' },
    liveActivity: null,
  }
}

/** One minimal projection frame (plain object; the ONE boundary cast). */
function frame(
  teamSessionId: string,
  members: readonly Record<string, unknown>[],
  templates: readonly Record<string, unknown>[] = [],
): TeamProjectionDto {
  return {
    schemaVersion: 1,
    teamSessionId,
    blueprint: { blueprintId: 'bp-1', revision: 1, contentHash: 'h-1' },
    generation: 1,
    generatedAt: '2026-08-29T00:00:00.000Z',
    root: { teamSessionId, createdAt: '2026-08-29T00:00:00.000Z', policyState: 'open' },
    templates,
    members,
    ledger: { latestSequence: 0, totalEntries: 0, byCategory: {}, pendingControlCount: 0 },
  } as unknown as TeamProjectionDto
}

function mirrorOf(...frames: Array<[string, TeamProjectionDto]>): TeamProjectionMirror {
  const plain: Record<string, TeamProjectionDto> = {}
  for (const [key, value] of frames) plain[key] = value
  return plain as unknown as TeamProjectionMirror
}

/**
 * The team frame: a leader-kind lead (child session absent) plus a running
 * mate bound to the member session, with the two template kinds the
 * sections key on.
 */
const TEAM_FRAME = frame(
  LEADER,
  [wireMember('lead', null), wireMember('mate', MEMBER, 'RUNNING')],
  [
    { kind: 'leader', templateId: 'tpl-lead', displayName: 'Lead', contextPolicy: 'persistent' },
    { kind: 'member', templateId: 'tpl-mate', displayName: 'Mate', contextPolicy: 'persistent' },
  ],
)
const TEAM_PROJECTION_MIRROR = mirrorOf([LEADER, TEAM_FRAME])

/** One frozen ledger entry (plain object; the closed wire shape). */
function entry(
  sequence: number,
  factType: string,
  createdAt: string,
  payload: Record<string, unknown>,
): RemoteLedgerEntryValue {
  return {
    schemaVersion: 1,
    sequence,
    rootSessionId: LEADER,
    factType,
    payload,
    operationId: null,
    createdAt,
  } as RemoteLedgerEntryValue
}

/** One settled interval over the mate instance (open then close, correlation-joined). */
const MATE_INTERVAL: RemoteLedgerEntryValue[] = [
  entry(1, 'activity-interval-opened', iso(T), { correlation: 'corr-1', instanceId: 'mate', subject: 'First span' }),
  entry(2, 'activity-interval-closed', iso(T + 90_000), { correlation: 'corr-1', closeNote: 'done' }),
]

/** One published ledger-store state over the loaded facts (known complete). */
function ledgerState(entries: readonly RemoteLedgerEntryValue[]): TeamLedgerState {
  const entriesBySequence = new Map<number, RemoteLedgerEntryValue>()
  for (const item of entries) entriesBySequence.set(item.sequence, item)
  const last = entries[entries.length - 1]
  return {
    teamSessionId: LEADER,
    entriesBySequence,
    orderedSequences: entries.map(item => item.sequence),
    total: entries.length,
    completeThrough: last === undefined ? 0 : last.sequence,
    loading: false,
  }
}

describe('resolveTeamView (frozen team-ness derivation)', () => {
  it('resolves a session by its own leader key or any binding member row, and nothing otherwise', () => {
    expect(resolveTeamView(LEADER_MIRROR, LEADER)).toBe(LEADER_MIRROR[LEADER])
    expect(resolveTeamView(LEADER_MIRROR, MEMBER)).toBe(LEADER_MIRROR[LEADER])
    expect(resolveTeamView(LEADER_MIRROR, OUTSIDER)).toBeUndefined()
    expect(resolveTeamView({}, OUTSIDER)).toBeUndefined()
  })
})

/** An unprogrammed pagination stub fails loud so an accidental page call is visible. */
function unprogrammedPage(): TeamViewProps['pageTeamMessages'] {
  return vi.fn(async (): Promise<RpcResult<TeamMessagePage>> => ({
    ok: false,
    error: { code: 'internal', message: 'page not programmed', details: {} },
  }))
}

function viewProps(
  mirror: TeamMirror,
  sessionId: SessionId = LEADER,
  projectionMirror: TeamProjectionMirror = {},
  teamLedgers: Readonly<Record<string, TeamLedgerState>> = {},
): TeamViewProps {
  return {
    // PropsRuntime<'conversation.view'> carries the framework branded
    // SessionId; the bridge SessionId is a bare string, so the boundary
    // cast is the single bridge-to-framework narrowing in this helper.
    sessionId: sessionId as TeamViewProps['sessionId'],
    useSession: (() => undefined) as TeamViewProps['useSession'],
    useProjection: () => undefined,
    useInput: () => { throw new Error('unused') },
    inputActions: { setDraft: () => {}, submit: () => {} } as unknown as TeamViewProps['inputActions'],
    useSessions: () => { throw new Error('unused') },
    useWorkspaces: () => { throw new Error('unused') },
    useTeamMirror: selector => selector(mirror),
    useProjectionMirror: selector => selector(projectionMirror),
    useTeamLedgers: selector => selector(teamLedgers),
    ensureTeam: vi.fn(() => Promise.resolve()),
    ensureProjection: vi.fn(() => Promise.resolve()),
    pageTeamMessages: unprogrammedPage(),
    openSession: vi.fn(),
    t: makeTranslate(zh),
    // Current DSH requires the conversation.view owner props (viewRequest/openView/completeViewRequest);
    // legacy fixtures predate them. TeamView renders them as a degraded jump surface (Seam 4), so no-op stubs.
    viewRequest: null,
    openView: () => {},
    completeViewRequest: () => {},
    // SessionStandardProps merges (ui-conversation: useConversation; ui-chat: useChat) and the
    // GlobalStandardProps merge (ui-session: useSessionPendingInteraction) are absent from legacy
    // fixtures; TeamView never reads them in these specs, so empty stubs.
    useConversation: (() => undefined) as TeamViewProps['useConversation'],
    useChat: (() => undefined) as TeamViewProps['useChat'],
    useSessionPendingInteraction: (() => undefined) as TeamViewProps['useSessionPendingInteraction'],
  }
}

describe('TeamView', () => {
  it('renders the one-line zero state for a non-team session and cold-pulls both paths once', () => {
    const props = viewProps({}, OUTSIDER)
    render(<TeamView {...props} />)
    expect(screen.getByText('当前会话未加入任何团队')).toBeTruthy()
    expect(props.ensureTeam).toHaveBeenCalledTimes(1)
    expect(props.ensureTeam).toHaveBeenCalledWith(OUTSIDER)
    expect(props.ensureProjection).toHaveBeenCalledTimes(1)
    expect(props.ensureProjection).toHaveBeenCalledWith(OUTSIDER)
  })

  it('renders all four sections live for a team session', () => {
    const leader = render(<TeamView {...viewProps(LEADER_MIRROR, LEADER, TEAM_PROJECTION_MIRROR)} />)
    expect(leader.container.querySelector('[data-team-view]')).toBeTruthy()
    expect(screen.queryByText('当前会话未加入任何团队')).toBeNull()
    expect(leader.container.querySelectorAll('[data-team-section]')).toHaveLength(4)
    // The timeline section is live from the projection path: its heading and,
    // with no loaded ledger facts, the one-line cold state (no lane matrix).
    expect(screen.getByText('时间线')).toBeTruthy()
    expect(screen.getByText('暂无委派记录')).toBeTruthy()
    expect(leader.container.querySelector('[data-team-section="timeline"] [data-team-timeline]')).toBeTruthy()
    // The member-group section is live from the projection path: its heading
    // and the group container rows (the leading leader group + the mate group).
    expect(screen.getByText('成员组')).toBeTruthy()
    expect(leader.container.querySelector('[data-team-section="members"] [data-team-members]')).toBeTruthy()
    expect(leader.container.querySelectorAll('[data-member-group-row]')).toHaveLength(2)
    // The task-board section is live from the mirror path: its heading and the
    // one-line empty state.
    expect(screen.getByText('任务板')).toBeTruthy()
    expect(leader.container.querySelector('[data-team-section="tasks"] [data-tasks-empty]')).toBeTruthy()
    // The event-stream section is live from the mirror path: its heading and the
    // one-line empty state.
    expect(screen.getByText('事件流')).toBeTruthy()
    expect(leader.container.querySelector('[data-team-section="events"] [data-feed-empty]')).toBeTruthy()
    leader.unmount()

    const member = render(<TeamView {...viewProps(LEADER_MIRROR, MEMBER, TEAM_PROJECTION_MIRROR)} />)
    expect(member.container.querySelector('[data-team-view]')).toBeTruthy()
    expect(member.container.querySelector('[data-team-section="timeline"]')).toBeTruthy()
    expect(member.container.querySelector('[data-team-section="members"] [data-team-members]')).toBeTruthy()
    expect(member.container.querySelector('[data-team-section="tasks"] [data-team-tasks]')).toBeTruthy()
    expect(member.container.querySelector('[data-team-section="events"] [data-team-feed]')).toBeTruthy()
  })

  it('switches to the member session when a timeline bar is clicked (D9)', () => {
    const openSession = vi.fn()
    const props = {
      ...viewProps(LEADER_MIRROR, LEADER, TEAM_PROJECTION_MIRROR, { [LEADER]: ledgerState(MATE_INTERVAL) }),
      openSession,
    }
    const view = render(<TeamView {...props} />)
    const bar = view.container.querySelector<HTMLElement>('[data-team-timeline-bar]')
    if (bar === null) throw new Error('the interval bar did not render')
    fireEvent.pointerDown(bar, { button: 0, clientX: 5, pointerId: 1 })
    fireEvent.pointerUp(bar, { clientX: 5, pointerId: 1 })
    expect(openSession).toHaveBeenCalledTimes(1)
    expect(openSession).toHaveBeenCalledWith(MEMBER)
  })

  it('switches to the member session when a member instance row is clicked (D9)', () => {
    const openSession = vi.fn()
    const props = { ...viewProps(LEADER_MIRROR, LEADER, TEAM_PROJECTION_MIRROR), openSession }
    const view = render(<TeamView {...props} />)
    const instance = view.container.querySelector<HTMLButtonElement>('[data-member-instance][data-status="running"]')
    if (instance === null) throw new Error('the running member instance row did not render')
    fireEvent.click(instance)
    expect(openSession).toHaveBeenCalledTimes(1)
    expect(openSession).toHaveBeenCalledWith(MEMBER)
  })

  it('switches back to the leader session when the leading leader row is clicked (D10)', () => {
    const openSession = vi.fn()
    const props = { ...viewProps(LEADER_MIRROR, MEMBER, TEAM_PROJECTION_MIRROR), openSession }
    const view = render(<TeamView {...props} />)
    const leader = view.container.querySelector<HTMLButtonElement>('[data-member-group-row][data-leader]')
    if (leader === null) throw new Error('the leading leader row did not render')
    fireEvent.click(leader)
    expect(openSession).toHaveBeenCalledTimes(1)
    expect(openSession).toHaveBeenCalledWith(LEADER)
  })

  it('renders the task board and event stream from the view and switches sessions on feed-row click (D9)', () => {
    const openSession = vi.fn()
    const dataView = {
      ...wireView(LEADER),
      tasks: [{
        taskId: 't1', subject: 'Wire the mirror', status: 'in_progress' as const,
        summary: 'Half done', memberId: 'mate', seq: 1, at: 1000,
      }],
      approvals: [{
        requestId: 'r1', memberId: 'mate', toolName: 'write_file', reason: 'need write',
        requestedAt: 2000,
      }],
      messages: [{
        from: 'leader', to: 'mate', message: 'go ahead', at: 3000, seq: 1, sessionId: LEADER,
      }],
      messageCount: 1,
    }
    const props = { ...viewProps({ [LEADER]: dataView }, LEADER), openSession }
    const view = render(<TeamView {...props} />)
    // The task board renders the projection row: subject, status, assignee, summary.
    const taskSection = view.container.querySelector('[data-team-section="tasks"]')
    expect(taskSection?.querySelector('[data-task-subject]')?.textContent).toBe('Wire the mirror')
    expect(taskSection?.querySelector('[data-task-status-text]')?.textContent).toBe('进行中')
    expect(taskSection?.querySelector('[data-task-assignee]')?.textContent).toBe('负责人 mate')
    expect(taskSection?.querySelector('[data-task-summary]')?.textContent).toBe('Half done')
    // The event stream mixes both rows in ascending order: the approval at
    // 2000 ahead of the message at 3000.
    const feedRows = view.container.querySelectorAll<HTMLElement>('[data-feed-row]')
    expect(feedRows).toHaveLength(2)
    expect(feedRows[0]?.dataset.feedKind).toBe('approval')
    expect(feedRows[1]?.dataset.feedKind).toBe('message')
    expect(screen.getByText('等待裁决')).toBeTruthy()
    // The approval row opens the requesting member's session; the message
    // row opens the recording session.
    fireEvent.click(feedRows[0]!)
    expect(openSession).toHaveBeenLastCalledWith(MEMBER)
    fireEvent.click(feedRows[1]!)
    expect(openSession).toHaveBeenLastCalledWith(LEADER)
    expect(openSession).toHaveBeenCalledTimes(2)
  })

  it('stops cold-pulling once the mirrors gain the session (landing frames win)', () => {
    const ensureTeam = vi.fn(() => Promise.resolve())
    const ensureProjection = vi.fn(() => Promise.resolve())
    const view = render(<TeamView {...{ ...viewProps({}, LEADER), ensureTeam, ensureProjection }} />)
    expect(ensureTeam).toHaveBeenCalledTimes(1)
    expect(ensureProjection).toHaveBeenCalledTimes(1)
    view.rerender(<TeamView {...{ ...viewProps(LEADER_MIRROR, LEADER, TEAM_PROJECTION_MIRROR), ensureTeam, ensureProjection }} />)
    expect(view.container.querySelector('[data-team-view]')).toBeTruthy()
    expect(ensureTeam).toHaveBeenCalledTimes(1)
    expect(ensureProjection).toHaveBeenCalledTimes(1)
  })
})
