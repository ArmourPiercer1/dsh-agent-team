// @vitest-environment jsdom
/**
 * Team conversation view entry — projection-only (P9-T6 collapse): the
 * per-session projection mirror drives every section (zero state,
 * timeline, member groups, activity, and the durable-ledger Events
 * surface); the compat mirror path (TeamMirror / `resolveTeamView` /
 * `ensureTeam` / `pageTeamMessages`) is gone. Coverage: the one-line
 * zero state for a non-team session (the single projection cold pull),
 * the four UI §12.1 sections live from ONE input for a leader session
 * and a member session, the D9 member-row session switch, the D10
 * leader-row return, the activity rows from the snapshot's current-work
 * face, the ledger rows from the per-team ledger store (with the D9
 * ledger-row navigation), and the landing-frames-win cold pull.
 *
 * Legacy spec evidence (T5 commit, 8 tests -> 8 tests):
 *  - "resolveTeamView (frozen team-ness derivation)" DROPPED: the compat
 *    module is folded away in T6; team-ness is now the projection
 *    resolution alone (the zero-state and landing tests cover the view's
 *    half; the T5 projection-mirror spec covers `resolveTeamProjection`).
 *  - "zero state + cold-pull both paths once" MIGRATED: the dual cold
 *    pull (`ensureTeam` + `ensureProjection`) becomes the single
 *    `ensureProjection` pull; the zero state is unchanged.
 *  - "four sections live for a team session" MIGRATED: the mirror-fed
 *    tasks/events sections become the snapshot-fed activity section and
 *    the ledger-store-fed ledger section; the four UI §12.1 sections
 *    (timeline/members/activity/ledger) render from ONE input for both
 *    the leader and the member session (plus the member-session
 *    current-instance highlight).
 *  - "timeline bar click (D9)" DROPPED: the bar click wiring is covered
 *    by the T5 team-timeline spec at component level; the view-level D9
 *    wiring is proven here by the member-row and ledger-row clicks.
 *  - "member instance row click (D9)" MIGRATED as-is (the instance row
 *    still switches to the child session).
 *  - "leading leader row click (D10)" MIGRATED as-is.
 *  - "task board + event stream from the view, feed-row click (D9)"
 *    REPLACED by three tests: the activity rows from `snapshot.activity`
 *    (the task board's row layout reused by TeamActivity), the ledger
 *    rows from the per-team ledger store (the feed's row layout reused
 *    by TeamLedger), and the ledger-row click navigation (the legacy
 *    approval/message session switches become the ledger rows' D9
 *    navigation).
 *  - "landing frames win" MIGRATED: the dual mirror gains become the
 *    single projection mirror; no re-fire.
  *
  * T7 note (P9): the zero state now carries the S5-A "Start Team from
  * Here" entry and the New Team panel when the injected `creation` face
  * is present (UI §3); without it the one-line T6 zero state is
  * unchanged (the zero-state entry tests below cover both faces). The
  * D9 member-row click target MIGRATES from the row to the
  * `button[data-member-instance-nav]` inside the new row wrapper (the
  * S5-B action cluster sits beside the nav button). The `useWorkspaces`
  * framework seat is now READ by the view (the creation panel's
  * workspace options; the fixtures return an undefined feed → empty
  * options).
 */
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { makeTranslate } from '@deepseek-ai/dsh-client-test-runtime'
import type { TeamProjectionMirror } from '../src/state/team-session-resolution.js'
import type { TeamLedgerState } from '../src/state/team-ledger-store.js'
import type { RemoteLedgerEntryValue } from '../../remote/src/index.js'
import type { TeamProjectionDto } from '../../contracts/src/index.js'
import type {
  RemoteCatalogGetParams, RemoteResponse, RemoteSafeJsonValue,
} from '../../remote/src/index.js'
import type { TeamPresetRow } from '../src/model/team-intent-model.js'
import { TeamView, type TeamViewCreationFace, type TeamViewProps } from '../src/ui/TeamView.js'
import { zh } from '../src/ui/locales.js'

afterEach(cleanup)

const LEADER = 'team-leader'
const MEMBER = 'team-member'
const OUTSIDER = 'plain-session'

/** One provenance-bearing success envelope (the wire shape, verbatim). */
function okResponse(data: unknown, method: string): RemoteResponse {
  return {
    ok: true,
    value: {
      data: data as RemoteSafeJsonValue,
      provenance: {
        origin: 'team-remote', method, endpoint: method, contractVersion: 1,
        requestToken: null, projectionGeneration: null, effectSequence: null,
      },
    },
  }
}

/**
 * A happy-path creation face (S5-A): the catalog / detail / probe / create
 * spies all resolve to the frozen wire shapes; the panel mounts and
 * settles without failure so the entry/open/close behavior is testable.
 */
function makeCreationFace(): TeamViewCreationFace {
  return {
    listCatalog: vi.fn(() => Promise.resolve(
      okResponse({ blueprints: [{ blueprintId: 'bp-1', revisions: [1, 2] }] }, 'catalog.list'),
    )),
    getCatalog: vi.fn((params: RemoteCatalogGetParams) => Promise.resolve(
      okResponse({
        blueprint: {
          blueprintId: params.blueprintId, revision: params.blueprintRevision ?? 2,
          displayName: 'Atlas', metadata: { source: 'builtin' },
          members: [{ templateId: 'tpl-lead' }],
        },
      }, 'catalog.get'),
    )),
    probeCompatibility: vi.fn(() => Promise.resolve(
      okResponse({ compatibility: { status: 'OPEN', requirements: [] } }, 'intent.probe'),
    )),
    teamCreate: vi.fn(() => Promise.resolve(okResponse({ teamSessionId: 'root' }, 'team.create'))),
    createRootSession: vi.fn(() => Promise.resolve('root')),
    listAgentPresets: vi.fn(() => Promise.resolve([
      { id: 'team', name: 'Team', isDefault: false },
    ] satisfies readonly TeamPresetRow[])),
  }
}

const T = 1_700_000_000_000
function iso(ms: number): string {
  return new Date(ms).toISOString()
}

/** One wire member DTO row (plain object; `childSessionId` null = the leader, field omitted). */
function wireMember(
  instanceId: string,
  childSessionId: string | null,
  lifecycle: 'CREATED' | 'RUNNING' | 'SETTLED' | 'ARCHIVED' | 'DISPOSED' = 'CREATED',
  overrides: Record<string, unknown> = {},
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
    ...overrides,
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

/** The two template kinds the member-group section keys on. */
const TEMPLATES: readonly Record<string, unknown>[] = [
  { kind: 'leader', templateId: 'tpl-lead', displayName: 'Lead', contextPolicy: 'persistent' },
  { kind: 'member', templateId: 'tpl-mate', displayName: 'Mate', contextPolicy: 'persistent' },
]

/** The team frame: a leader-kind lead (child session absent) plus a running mate bound to the member session. */
const TEAM_FRAME = frame(
  LEADER,
  [wireMember('lead', null), wireMember('mate', MEMBER, 'RUNNING')],
  TEMPLATES,
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
  } as unknown as RemoteLedgerEntryValue
}

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

/**
 * The projection-only view props: the framework session kit plus the
 * injected face — the two ObservableSnapshot hooks and the cold-pull /
 * ledger-refresh / navigation callbacks. TeamView reads only
 * `useWorkspaces` from the kit (the creation panel's workspace options);
 * the fixture feed is undefined → empty options.
 */
function viewProps(
  projectionMirror: TeamProjectionMirror = {},
  sessionId: string = LEADER,
  teamLedgers: Readonly<Record<string, TeamLedgerState>> = {},
): TeamViewProps {
  return {
    // PropsRuntime<'conversation.view'> carries the framework branded
    // SessionId; the fixtures are bare strings, so the boundary cast is
    // the single fixture-to-framework narrowing in this helper.
    sessionId: sessionId as TeamViewProps['sessionId'],
    useSession: (() => undefined) as TeamViewProps['useSession'],
    useProjection: () => undefined,
    useInput: () => { throw new Error('unused') },
    inputActions: { setDraft: () => {}, submit: () => {} } as unknown as TeamViewProps['inputActions'],
    useSessions: () => { throw new Error('unused') },
    useWorkspaces: (() => undefined) as TeamViewProps['useWorkspaces'],
    // The injected face (projection-only after the T6 collapse).
    useProjectionMirror: selector => selector(projectionMirror),
    useTeamLedgers: selector => selector(teamLedgers),
    ensureProjection: vi.fn(() => Promise.resolve()),
    refreshTeamLedger: vi.fn(() => Promise.resolve()),
    openSession: vi.fn(),
    t: makeTranslate(zh),
    // Current DSH requires the conversation.view owner props
    // (viewRequest/openView/completeViewRequest); TeamView renders them
    // as a degraded jump surface (Seam 4), so no-op stubs.
    viewRequest: null,
    openView: () => {},
    completeViewRequest: () => {},
    // SessionStandardProps merges (ui-conversation: useConversation;
    // ui-chat: useChat) and the GlobalStandardProps merge (ui-session:
    // useSessionPendingInteraction) are absent from these fixtures;
    // TeamView never reads them, so empty stubs.
    useConversation: (() => undefined) as TeamViewProps['useConversation'],
    useChat: (() => undefined) as TeamViewProps['useChat'],
    useSessionPendingInteraction: (() => undefined) as TeamViewProps['useSessionPendingInteraction'],
  }
}

describe('TeamView', () => {
  it('renders the one-line zero state for a non-team session and cold-pulls the projection once', () => {
    const props = viewProps({}, OUTSIDER)
    const view = render(<TeamView {...props} />)
    expect(view.container.querySelector('[data-team-zero]')).toBeTruthy()
    expect(screen.getByText('当前会话未加入任何团队')).toBeTruthy()
    expect(props.ensureProjection).toHaveBeenCalledTimes(1)
    expect(props.ensureProjection).toHaveBeenCalledWith(OUTSIDER)
  })

  it('keeps the plain zero state without the creation face (S5-A: entry hidden, T6 view unchanged)', () => {
    const view = render(<TeamView {...viewProps({}, OUTSIDER)} />)
    expect(view.container.querySelector('[data-team-zero]')).toBeTruthy()
    expect(view.container.querySelector('[data-intent-start-here]')).toBeNull()
    expect(view.container.querySelector('[data-team-creation-panel]')).toBeNull()
  })

  it('offers the New Team entry in the zero state when the creation face is present (S5-A, UI §3)', () => {
    const view = render(<TeamView {...{ ...viewProps({}, OUTSIDER), creation: makeCreationFace() }} />)
    expect(view.container.querySelector('[data-team-zero]')).toBeTruthy()
    const start = view.container.querySelector<HTMLButtonElement>('[data-intent-start-here]')
    if (start === null) throw new Error('the Start Team from Here entry did not render')
    expect(start.textContent).toBe('从此处开始团队')
    expect(view.container.querySelector('[data-team-creation-panel]')).toBeNull()
  })

  it('opens the New Team panel from the entry and returns to the entry on cancel (S5-A, UI §3/§5.3)', async () => {
    const view = render(<TeamView {...{ ...viewProps({}, OUTSIDER), creation: makeCreationFace() }} />)
    const start = view.container.querySelector<HTMLButtonElement>('[data-intent-start-here]')
    if (start === null) throw new Error('the Start Team from Here entry did not render')
    fireEvent.click(start)
    await vi.waitFor(() => {
      expect(view.container.querySelector('[data-team-creation-panel]')).not.toBeNull()
    })
    const cancel = view.container.querySelector<HTMLButtonElement>('[data-intent-cancel]')
    if (cancel === null) throw new Error('the panel cancel button did not render')
    fireEvent.click(cancel)
    expect(view.container.querySelector('[data-team-creation-panel]')).toBeNull()
    expect(view.container.querySelector('[data-intent-start-here]')).not.toBeNull()
  })

  it('persists the intent draft in view state across panel close/reopen (S5-A, UI §5.3)', async () => {
    const view = render(<TeamView {...{ ...viewProps({}, OUTSIDER), creation: makeCreationFace() }} />)
    const start = view.container.querySelector<HTMLButtonElement>('[data-intent-start-here]')
    if (start === null) throw new Error('the Start Team from Here entry did not render')
    fireEvent.click(start)
    await vi.waitFor(() => {
      const select = view.container.querySelector<HTMLSelectElement>('[data-intent-blueprint]')
      expect(select).not.toBeNull()
      expect(select?.disabled).toBe(false)
    })
    const select = view.container.querySelector<HTMLSelectElement>('[data-intent-blueprint]')
    if (select === null) throw new Error('the blueprint select did not render')
    fireEvent.change(select, { target: { value: 'bp-1' } })
    const cancel = view.container.querySelector<HTMLButtonElement>('[data-intent-cancel]')
    if (cancel === null) throw new Error('the panel cancel button did not render')
    fireEvent.click(cancel)
    expect(view.container.querySelector('[data-team-creation-panel]')).toBeNull()
    const reopen = view.container.querySelector<HTMLButtonElement>('[data-intent-start-here]')
    if (reopen === null) throw new Error('the entry did not return after cancel')
    fireEvent.click(reopen)
    await vi.waitFor(() => {
      const reopened = view.container.querySelector<HTMLSelectElement>('[data-intent-blueprint]')
      expect(reopened).not.toBeNull()
      expect(reopened?.disabled).toBe(false)
    })
    const reopened = view.container.querySelector<HTMLSelectElement>('[data-intent-blueprint]')
    if (reopened === null) throw new Error('the blueprint select did not re-render')
    expect(reopened.value).toBe('bp-1')
  })

  it('renders all four UI §12.1 sections live from one input for a leader session', () => {
    const view = render(<TeamView {...viewProps(TEAM_PROJECTION_MIRROR, LEADER)} />)
    expect(view.container.querySelector('[data-team-view]')).toBeTruthy()
    expect(screen.queryByText('当前会话未加入任何团队')).toBeNull()
    // The fixed UI §12.1 order from one input.
    const sections = [...view.container.querySelectorAll<HTMLElement>('[data-team-section]')]
      .map(el => el.dataset.teamSection)
    expect(sections).toEqual(['timeline', 'members', 'activity', 'ledger'])
    // Timeline: heading + the one-line cold state (no loaded ledger facts).
    expect(screen.getByText('时间线')).toBeTruthy()
    expect(screen.getByText('暂无委派记录')).toBeTruthy()
    expect(view.container.querySelector('[data-team-section="timeline"] [data-team-timeline]')).toBeTruthy()
    // Members: heading + the two group rows (the leading leader group + the mate group).
    expect(screen.getByText('成员组')).toBeTruthy()
    expect(view.container.querySelectorAll('[data-team-section="members"] [data-member-group-row]')).toHaveLength(2)
    // Activity: heading + the one-line empty state (no current-work facts).
    expect(screen.getByText('活动与进度')).toBeTruthy()
    expect(view.container.querySelector('[data-team-section="activity"] [data-activity-empty]')).toBeTruthy()
    // Ledger: heading + the one-line empty state (no loaded ledger facts).
    expect(screen.getByText('团队事件')).toBeTruthy()
    expect(view.container.querySelector('[data-team-section="ledger"] [data-ledger-empty]')).toBeTruthy()
    view.unmount()

    // The member session resolves to the same frame (the member-child
    // perspective) and highlights the current instance row.
    const member = render(<TeamView {...viewProps(TEAM_PROJECTION_MIRROR, MEMBER)} />)
    expect(member.container.querySelector('[data-team-view]')).toBeTruthy()
    for (const value of ['timeline', 'members', 'activity', 'ledger']) {
      expect(member.container.querySelector(`[data-team-section="${value}"]`)).toBeTruthy()
    }
    expect(member.container.querySelector('[data-team-section="members"] [data-member-instance][data-current]')).toBeTruthy()
    member.unmount()
  })

  it('switches to the member session when a member instance row is clicked (D9)', () => {
    const openSession = vi.fn()
    const view = render(<TeamView {...{ ...viewProps(TEAM_PROJECTION_MIRROR, LEADER), openSession }} />)
    // T7: the row itself is no longer the click target; the nav button
    // inside the row wrapper switches the session (S5-B actions sit
    // beside it).
    const instance = view.container.querySelector<HTMLButtonElement>('[data-member-instance][data-status="running"] [data-member-instance-nav]')
    if (instance === null) throw new Error('the running member instance row did not render')
    fireEvent.click(instance)
    expect(openSession).toHaveBeenCalledTimes(1)
    expect(openSession).toHaveBeenCalledWith(MEMBER)
  })

  it('switches back to the leader session when the leading leader row is clicked (D10)', () => {
    const openSession = vi.fn()
    const view = render(<TeamView {...{ ...viewProps(TEAM_PROJECTION_MIRROR, MEMBER), openSession }} />)
    const leader = view.container.querySelector<HTMLButtonElement>('[data-member-group-row][data-leader]')
    if (leader === null) throw new Error('the leading leader row did not render')
    fireEvent.click(leader)
    expect(openSession).toHaveBeenCalledTimes(1)
    expect(openSession).toHaveBeenCalledWith(LEADER)
  })

  it('renders the activity section from the snapshot current-work face', () => {
    const frameWithActivity = frame(
      LEADER,
      [
        wireMember('lead', null),
        wireMember('mate', MEMBER, 'RUNNING', {
          activity: {
            status: 'in-progress',
            subject: 'Wiring the mirror',
            summary: 'Half done',
            lastAction: 'typing',
          },
        }),
      ],
      TEMPLATES,
    )
    const view = render(<TeamView {...viewProps(mirrorOf([LEADER, frameWithActivity]), LEADER)} />)
    const section = view.container.querySelector('[data-team-section="activity"]')
    expect(section?.querySelector('[data-activity-row][data-activity-status="in-progress"]')).toBeTruthy()
    expect(section?.querySelector('[data-activity-subject]')?.textContent).toBe('Wiring the mirror')
    expect(section?.querySelector('[data-activity-status-text]')?.textContent).toBe('进行中')
    expect(section?.querySelector('[data-activity-member]')?.textContent).toBe('负责人 mate')
    expect(section?.querySelector('[data-activity-summary]')?.textContent).toBe('Half done')
  })

  it('renders the ledger section from the per-team ledger store', () => {
    const messageEntry = entry(1, 'team-message-delivered', iso(T), {
      recipientInstanceId: 'mate',
      subject: 'go ahead',
    })
    const view = render(
      <TeamView {...viewProps(TEAM_PROJECTION_MIRROR, LEADER, { [LEADER]: ledgerState([messageEntry]) })} />,
    )
    const section = view.container.querySelector('[data-team-section="ledger"]')
    expect(section?.querySelector('[data-ledger-row][data-ledger-kind="message"]')).toBeTruthy()
    // The marker text (scoped to the section: the category filter option
    // carries the same label).
    expect(section?.querySelector('[data-ledger-marker]')?.textContent).toBe('消息')
    expect(section?.querySelector('[data-ledger-summary]')?.textContent).toBe('go ahead')
    expect(section?.querySelector('[data-ledger-actor]')?.textContent).toBe('mate')
  })

  it('switches to the actor session when a ledger row is clicked (D9)', () => {
    const openSession = vi.fn()
    const messageEntry = entry(1, 'team-message-delivered', iso(T), {
      recipientInstanceId: 'mate',
      subject: 'go ahead',
    })
    const view = render(
      <TeamView {...{
        ...viewProps(TEAM_PROJECTION_MIRROR, LEADER, { [LEADER]: ledgerState([messageEntry]) }),
        openSession,
      }} />,
    )
    const row = view.container.querySelector<HTMLButtonElement>('[data-ledger-row]')
    if (row === null) throw new Error('the ledger row did not render')
    fireEvent.click(row)
    expect(openSession).toHaveBeenCalledTimes(1)
    expect(openSession).toHaveBeenCalledWith(MEMBER)
  })

  it('stops cold-pulling once the projection mirror gains the session (landing frames win)', () => {
    const ensureProjection = vi.fn(() => Promise.resolve())
    const view = render(<TeamView {...{ ...viewProps({}, LEADER), ensureProjection }} />)
    expect(view.container.querySelector('[data-team-zero]')).toBeTruthy()
    expect(ensureProjection).toHaveBeenCalledTimes(1)
    view.rerender(<TeamView {...{ ...viewProps(TEAM_PROJECTION_MIRROR, LEADER), ensureProjection }} />)
    expect(view.container.querySelector('[data-team-view]')).toBeTruthy()
    expect(ensureProjection).toHaveBeenCalledTimes(1)
  })

  it('R119: the handoffSource identity is stable across panel re-renders — initial-work keystrokes never re-fire the one-shot handoff.prepare (the trial flicker/jump)', async () => {
    const prepare = vi.fn(() => Promise.resolve(okResponse(
      { sourceSessionId: OUTSIDER, summary: { title: 't', bullets: ['b'] } },
      'handoff.prepare',
    )))
    const create = vi.fn(() => Promise.resolve(okResponse(
      { state: { kind: 'completed', replayed: false, teamSessionId: 'root' } },
      'handoff.create',
    )))
    const view = render(
      <TeamView {...{ ...viewProps({}, OUTSIDER), creation: makeCreationFace(), handoff: { prepare, create } }} />,
    )
    const start = view.container.querySelector<HTMLButtonElement>('[data-intent-start-here]')
    if (start === null) throw new Error('the Start Team from Here entry did not render')
    fireEvent.click(start)
    await vi.waitFor(() => {
      expect(view.container.querySelector('[data-team-creation-panel]')).not.toBeNull()
    })
    // The one-shot summary preview fired exactly once on open (§32.3)…
    await vi.waitFor(() => {
      expect(prepare).toHaveBeenCalledTimes(1)
    })
    // …and its identity survives every draft update: each initial-work
    // keystroke re-renders TeamView (draft update -> re-render). Pre-fix,
    // the inline handoffSource object literal changed identity on every
    // render, so the panel's prepare effect re-fired — clearing and
    // re-fetching the one-shot summary on every keystroke (the flicker/
    // jump the trial surfaced, plus a prepare-RPC per keystroke).
    const initialWork = view.container.querySelector<HTMLTextAreaElement>('[data-intent-initial-work]')
    if (initialWork === null) throw new Error('the initial-work input did not render')
    fireEvent.change(initialWork, { target: { value: 'a' } })
    fireEvent.change(initialWork, { target: { value: 'ab' } })
    expect(prepare).toHaveBeenCalledTimes(1)
    expect(initialWork.value).toBe('ab')
  })
})
