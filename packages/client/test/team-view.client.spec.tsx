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
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { makeTranslate } from '@deepseek-ai/dsh-client-test-runtime'
import type { TeamProjectionMirror } from '../src/state/team-session-resolution.js'
import type { TeamLedgerState } from '../src/state/team-ledger-store.js'
import type { TeamProjectionState } from '../src/state/team-projection-store.js'
import type { TeamReadStateOutcome } from '../src/state/team-read-state.js'
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
    teamCreate: vi.fn(() => Promise.resolve(okResponse({ path: 'root', durable: true, bind: {} }, 'team.create'))),
    teamAdmitInitialWork: vi.fn(() => Promise.resolve(okResponse({ workOutcome: 'delivered' }, 'team.admitInitialWork'))),
    openCreatedSession: vi.fn(async () => undefined),
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
  projectionStates: Readonly<Record<string, TeamProjectionState>> = {},
  sessionReadStates: Readonly<Record<string, TeamReadStateOutcome>> = {},
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
    // 0.1.7: the ui-session GlobalStandardProps merge now carries
    // useSessionStatus/useSessionRetainInfo (0.1.5's useSessionPendingInteraction
    // was removed upstream) — never read by the Team components.
    useSessionStatus: (() => undefined) as TeamViewProps['useSessionStatus'],
    useSessionRetainInfo: (() => undefined) as TeamViewProps['useSessionRetainInfo'],
    useWorkspaces: (() => undefined) as TeamViewProps['useWorkspaces'],
    // 0.1.7 full peer instantiation (F1 lockfile): the ui-layout
    // GlobalStandardProps augmentation requires usePanelInfo — a constant
    // snapshot selector, never read by the Team components.
    usePanelInfo: (sel) => sel({ activePanelId: null }),
    // The injected face (projection-only after the T6 collapse).
    useProjectionMirror: selector => selector(projectionMirror),
    useTeamLedgers: selector => selector(teamLedgers),
    useProjectionStates: selector => selector(projectionStates),
    useSessionReadStates: selector => selector(sessionReadStates),
    ensureProjection: vi.fn(() => Promise.resolve()),
    // D4-A1: the post-mutation pull (the zero-state creation panel's
    // success-lane refresh; unused by the projection-only fixtures here).
    pullProjection: vi.fn(() => Promise.resolve({ status: 'duplicate', receivedGeneration: 1 } as const)),
    refreshTeamLedger: vi.fn(() => Promise.resolve()),
    openSession: vi.fn(),
    t: makeTranslate(zh),
    // Current DSH requires the conversation.view owner props
    // (viewRequest/openView/completeViewRequest); TeamView renders them
    // as a degraded jump surface (Seam 4), so no-op stubs.
    viewRequest: null,
    openView: () => {},
    completeViewRequest: () => {},
    // 0.1.7: ConvViewOwnerProps gained the tool-call inspector opener.
    inspectCall: undefined,
    // SessionStandardProps merges (ui-conversation: useConversation;
    // ui-chat: useChat) are absent from these fixtures;
    // 0.1.7: the GlobalStandardProps merge no longer carries
    // useSessionPendingInteraction (removed upstream) — no stub.
    // TeamView never reads them, so empty stubs.
    useConversation: (() => undefined) as TeamViewProps['useConversation'],
    useChat: (() => undefined) as TeamViewProps['useChat'],
  }
}

describe('TeamView', () => {
  it('renders the ownership-loading zero state for a non-team session with no settled probe and cold-pulls the projection once (PR #35 second follow-up P1-A: the no-probe-yet face announces the ownership read; it still NEVER asserts a definitive "no team")', () => {
    const props = viewProps({}, OUTSIDER)
    const view = render(<TeamView {...props} />)
    expect(view.container.querySelector('[data-team-zero]')).toBeTruthy()
    // No settled probe + no concrete store state: the ownership read is
    // in flight (guide §4.2 null row) — NOT the old "正在加载团队信息…"
    // (which an ordinary session would show FOREVER: the read-state
    // probe is the authority, and it made no projection request).
    const statusLine = view.container.querySelector<HTMLElement>('[data-team-zero] [data-team-projection-status]')
    expect(statusLine).toBeTruthy()
    expect(statusLine?.getAttribute('data-team-projection-status')).toBe('ownership-loading')
    expect(statusLine?.textContent).toBe('正在读取团队归属…')
    expect(screen.queryByText('当前会话未加入任何团队')).toBeNull()
    // The manual refresh entry is present in the zero state.
    expect(view.container.querySelector('[data-team-refresh]')).toBeTruthy()
    expect(props.ensureProjection).toHaveBeenCalledTimes(1)
    expect(props.ensureProjection).toHaveBeenCalledWith(OUTSIDER)
  })

  // ------------------------------------------------------------------
  // repair 20260927 (S1-C1 / S1-C2): the projection-store-driven view
  // states — the zero-state failure / foreign lines, the with-frame
  // "update failed — showing the last good data" banner, the manual
  // refresh in BOTH views (pull → ledger), the double-click guard, and
  // the recovery that clears a failed state.
  // ------------------------------------------------------------------
  /** One full store-state fixture (the closed shape, verbatim). */
  function stateOf(
    overrides: Partial<TeamProjectionState> & { readonly status: TeamProjectionState['status'] },
  ): TeamProjectionState {
    return {
      teamSessionId: null,
      appliedGeneration: null,
      appliedLiveToken: null,
      frame: null,
      lastAssessment: null,
      retryAttempt: 0,
      nextRetryDelayMs: null,
      ...overrides,
    }
  }
  /** One frozen remote error block (the full closed shape). */
  function err(code: string, message: string) {
    return {
      code,
      message,
      details: {
        method: 'team.getProjection', endpoint: 'team.getProjection',
        contractVersion: 1, requestToken: null,
      },
    }
  }

  it('renders the no-frame RPC error as "加载失败" + code/message + retry — NEVER "未加入团队" (S1-C1)', () => {
    const props = viewProps({}, OUTSIDER, {}, {
      [OUTSIDER]: stateOf({
        status: 'error',
        teamSessionId: OUTSIDER,
        lastError: err('TEAM_REMOTE_INTERNAL_ERROR', 'boom'),
        lastAssessment: { status: 'rpc-error', receivedGeneration: null },
      }),
    })
    const view = render(<TeamView {...props} />)
    expect(view.container.querySelector('[data-team-zero]')).toBeTruthy()
    const line = view.container.querySelector<HTMLElement>('[data-team-projection-status]')
    expect(line?.getAttribute('data-team-projection-status')).toBe('error')
    expect(line?.textContent).toContain('团队信息加载失败')
    expect(line?.textContent).toContain('TEAM_REMOTE_INTERNAL_ERROR')
    expect(line?.textContent).toContain('boom')
    // The failed cold open must NOT assert a definitive "no team".
    expect(screen.queryByText('当前会话未加入任何团队')).toBeNull()
    // The retry entry is present and enabled.
    const refresh = view.container.querySelector<HTMLButtonElement>('[data-team-refresh]')
    expect(refresh).toBeTruthy()
    expect(refresh?.disabled).toBe(false)
  })

  it('renders the no-frame transport loss (reconnecting) as "尚未成功加载" (S1-C1)', () => {
    const view = render(<TeamView {...viewProps({}, OUTSIDER, {}, {
      [OUTSIDER]: stateOf({
        status: 'reconnecting',
        teamSessionId: OUTSIDER,
        lastAssessment: { status: 'transport-loss', receivedGeneration: null },
        retryAttempt: 1,
        nextRetryDelayMs: 500,
      }),
    })} />)
    const line = view.container.querySelector<HTMLElement>('[data-team-projection-status]')
    expect(line?.getAttribute('data-team-projection-status')).toBe('reconnecting')
    expect(line?.textContent).toBe('团队信息尚未成功加载，正在重试')
    expect(screen.queryByText('当前会话未加入任何团队')).toBeNull()
  })

  it('renders the no-frame FOREIGN_TEAM state with NEUTRAL wording and keeps the creation entry (S1-C1)', () => {
    const view = render(<TeamView {...{
      ...viewProps({}, OUTSIDER, {}, {
        [OUTSIDER]: stateOf({
          status: 'error',
          teamSessionId: OUTSIDER,
          lastError: err('TEAM_REMOTE_FOREIGN_TEAM', 'not a root'),
          lastAssessment: { status: 'foreign', receivedGeneration: 3 },
        }),
      }),
      creation: makeCreationFace(),
    }} />)
    const line = view.container.querySelector<HTMLElement>('[data-team-projection-status]')
    expect(line?.textContent).toBe('当前会话未能关联到团队（可能是普通会话）')
    // Neutral (not the failed-load line), and the creation entry stays.
    expect(line?.textContent).not.toContain('团队信息加载失败')
    expect(screen.queryByText('当前会话未加入任何团队')).toBeNull()
    expect(view.container.querySelector('[data-intent-start-here]')).toBeTruthy()
  })

  it('keeps the content and shows "更新失败，当前显示上次成功的数据" when a with-frame refresh fails (S1-C1)', () => {
    const view = render(<TeamView {...viewProps(TEAM_PROJECTION_MIRROR, LEADER, {}, {
      [LEADER]: stateOf({
        status: 'error',
        teamSessionId: LEADER,
        appliedGeneration: 7,
        lastError: err('TEAM_REMOTE_INTERNAL_ERROR', 'boom'),
        lastAssessment: { status: 'rpc-error', receivedGeneration: 8 },
      }),
    })} />)
    // The with-frame view renders (content kept).
    expect(view.container.querySelector('[data-team-view]')).toBeTruthy()
    expect(view.container.querySelector('[data-team-section="members"]')).toBeTruthy()
    // The failed-refresh banner, judged by the CURRENT status (not by a
    // bare lastError presence).
    const banner = view.container.querySelector<HTMLElement>('[data-team-view-error]')
    expect(banner?.textContent).toContain('更新失败，当前显示上次成功的数据')
    expect(banner?.textContent).toContain('TEAM_REMOTE_INTERNAL_ERROR')
    expect(view.container.querySelector('[data-team-view-status]')?.getAttribute('data-team-view-status')).toBe('error')
    // The refresh entry is present in the with-frame view too.
    expect(view.container.querySelector('[data-team-refresh]')).toBeTruthy()
  })

  it('clears the failed-refresh banner when the store state recovers (same generation included) (S1-C1)', () => {
    const errorState = stateOf({
      status: 'error',
      teamSessionId: LEADER,
      appliedGeneration: 7,
      lastError: err('TEAM_REMOTE_INTERNAL_ERROR', 'boom'),
      lastAssessment: { status: 'rpc-error', receivedGeneration: 8 },
    })
    const view = render(<TeamView {...viewProps(TEAM_PROJECTION_MIRROR, LEADER, {}, { [LEADER]: errorState })} />)
    expect(view.container.querySelector('[data-team-view-error]')).toBeTruthy()
    // Recovery: a successful duplicate (same generation) publishes a
    // ready state WITHOUT the stale error.
    const readyState = stateOf({
      status: 'ready',
      teamSessionId: LEADER,
      appliedGeneration: 8,
      lastAssessment: { status: 'duplicate', receivedGeneration: 8 },
    })
    view.unmount()
    const recovered = render(<TeamView {...viewProps(TEAM_PROJECTION_MIRROR, LEADER, {}, { [LEADER]: readyState })} />)
    expect(recovered.container.querySelector('[data-team-view-error]')).toBeNull()
    expect(recovered.container.querySelector('[data-team-view-status]')?.getAttribute('data-team-view-status')).toBe('ready')
  })

  it('refreshes from BOTH views — the pull targets the resolved team id, the manual refresh FORCES ONE explicit ledger retry when the team is confirmed (P1-4), and the double-click is guarded (S1-C2 + team-view-sync-complete decision 4 + PR #35 follow-up)', async () => {
    // (a) the with-frame view (no coordinator face — the Phase 1
    // fallback path): the pull targets the TEAM id (not the session
    // id). PR #35 follow-up (P1-4): the manual refresh FORCES ONE
    // explicit ledger retry — the user's "refresh" re-reads the durable
    // ledger even when the generation did not advance (a failed earlier
    // ledger read gets its retry here). The AUTOMATIC ledger refresh
    // stays owned by the applied durable-generation advance (frozen
    // decision 4 — the mount's store subscription, not this call).
    const pullProjection = vi.fn(() => new Promise<{ status: 'apply'; receivedGeneration: number }>(resolve => {
      setTimeout(() => resolve({ status: 'apply', receivedGeneration: 9 }), 10)
    }))
    const refreshTeamLedger = vi.fn(() => new Promise<void>(resolve => {
      setTimeout(resolve, 20)
    }))
    const propsA = {
      ...viewProps(TEAM_PROJECTION_MIRROR, LEADER, {}, {
        [LEADER]: stateOf({ status: 'ready', teamSessionId: LEADER, appliedGeneration: 8 }),
      }),
      pullProjection,
      refreshTeamLedger,
    }
    const viewA = render(<TeamView {...propsA} />)
    const buttonA = viewA.container.querySelector<HTMLButtonElement>('[data-team-refresh]')
    if (buttonA === null) throw new Error('the with-frame refresh button did not render')
    fireEvent.click(buttonA)
    // The double-click while pending is guarded (no second pull).
    fireEvent.click(buttonA)
    expect(pullProjection).toHaveBeenCalledTimes(1)
    expect(pullProjection).toHaveBeenCalledWith(LEADER)
    // The round settles; the pending flag clears; the EXPLICIT ledger
    // retry runs exactly once (P1-4 — the team is confirmed by the
    // frame at call time).
    await vi.waitFor(() => {
      expect(buttonA.disabled).toBe(false)
    })
    await vi.waitFor(() => {
      expect(refreshTeamLedger).toHaveBeenCalledTimes(1)
    })
    viewA.unmount()
    // (b) the zero state: the pull targets the SESSION id (no frame →
    // the candidate root IS the session), and the ledger is NOT
    // attempted (no team confirmed — there is no ledger to re-read).
    const pullProjectionB = vi.fn(() => Promise.resolve(
      { status: 'transport-loss', receivedGeneration: null } as const,
    ))
    const refreshTeamLedgerB = vi.fn(() => Promise.resolve())
    const propsB = {
      ...viewProps({}, OUTSIDER, {}, {
        [OUTSIDER]: stateOf({ status: 'error', teamSessionId: OUTSIDER }),
      }),
      pullProjection: pullProjectionB,
      refreshTeamLedger: refreshTeamLedgerB,
    }
    const viewB = render(<TeamView {...propsB} />)
    const buttonB = viewB.container.querySelector<HTMLButtonElement>('[data-team-refresh]')
    if (buttonB === null) throw new Error('the zero-state refresh button did not render')
    fireEvent.click(buttonB)
    expect(pullProjectionB).toHaveBeenCalledTimes(1)
    expect(pullProjectionB).toHaveBeenCalledWith(OUTSIDER)
    await vi.waitFor(() => {
      expect(refreshTeamLedgerB).not.toHaveBeenCalled()
      expect(buttonB.disabled).toBe(false)
    })
  })

  it('manual refresh through the COORDINATOR face: the probe confirms the team → the explicit ledger retry fires; the authoritative NONE probe → no ledger (PR #35 follow-up, P1-4)', async () => {
    // (a) the probe answers a team relation: the manual round triggers
    // the FORCED coordinator round for the SESSION (not the root id)
    // and the explicit ledger retry runs once.
    const roundTeam = {
      readState: {
        status: 'ok' as const,
        relation: {
          kind: 'team-root' as const,
          teamSessionId: LEADER,
          memberInstanceId: null,
          disposed: false as const,
          durableGeneration: 8,
          liveToken: 'lt-v1-fake:leader:g8',
        },
      },
      projectionAssessment: { status: 'duplicate', receivedGeneration: 8 } as const,
    }
    const triggerA = vi.fn(() => Promise.resolve(roundTeam))
    const refreshLedgerA = vi.fn(() => Promise.resolve())
    const propsA = {
      ...viewProps(TEAM_PROJECTION_MIRROR, LEADER, {}, {
        [LEADER]: stateOf({ status: 'ready', teamSessionId: LEADER, appliedGeneration: 8 }),
      }),
      refreshCoordinator: { attach: vi.fn(), detach: vi.fn(), trigger: triggerA },
      refreshTeamLedger: refreshLedgerA,
    }
    const viewA = render(<TeamView {...propsA} />)
    const buttonA = viewA.container.querySelector<HTMLButtonElement>('[data-team-refresh]')
    if (buttonA === null) throw new Error('the with-frame refresh button did not render')
    fireEvent.click(buttonA)
    await vi.waitFor(() => {
      expect(buttonA.disabled).toBe(false)
    })
    // The forced round targets the SESSION id with the 'manual' reason
    // (P0-1: the probe input is the current sessionId).
    expect(triggerA).toHaveBeenCalledTimes(1)
    expect(triggerA).toHaveBeenCalledWith(LEADER, 'manual')
    expect(refreshLedgerA).toHaveBeenCalledTimes(1)
    viewA.unmount()
    // (b) the probe answers the authoritative NONE (an ordinary
    // session): the round still runs, but the explicit ledger retry
    // NEVER fires (there is no ledger — and a failed probe would be
    // the same: no ownership conclusion, no ledger re-read).
    const roundNone = {
      readState: {
        status: 'ok' as const,
        relation: {
          kind: 'none' as const,
          teamSessionId: null,
          memberInstanceId: null,
          disposed: false as const,
          durableGeneration: null,
          liveToken: null,
        },
      },
      projectionAssessment: null,
    }
    const triggerB = vi.fn(() => Promise.resolve(roundNone))
    const refreshLedgerB = vi.fn(() => Promise.resolve())
    const propsB = {
      ...viewProps({}, OUTSIDER, {}, {}),
      refreshCoordinator: { attach: vi.fn(), detach: vi.fn(), trigger: triggerB },
      refreshTeamLedger: refreshLedgerB,
    }
    const viewB = render(<TeamView {...propsB} />)
    const buttonB = viewB.container.querySelector<HTMLButtonElement>('[data-team-refresh]')
    if (buttonB === null) throw new Error('the zero-state refresh button did not render')
    fireEvent.click(buttonB)
    await vi.waitFor(() => {
      expect(buttonB.disabled).toBe(false)
    })
    expect(triggerB).toHaveBeenCalledTimes(1)
    expect(triggerB).toHaveBeenCalledWith(OUTSIDER, 'manual')
    expect(refreshLedgerB).not.toHaveBeenCalled()
    viewB.unmount()
  })

  // ------------------------------------------------------------------
  // PR #34 review follow-up (F2): the manual refresh lifetime is bound
  // to the current session scope — a session switch or unmount
  // invalidates the in-flight refresh BEFORE the ledger continuation
  // runs and before the pending flag settles.
  // ------------------------------------------------------------------

  it('session switch invalidates the in-flight manual refresh: no old ledger continuation, the new session\'s button is not left pending (F2-T1)', async () => {
    // Two teams, two sessions, two frames: the view can re-render as
    // session B while A's refresh pull is still in flight.
    const MATE_FRAME = frame(
      MEMBER,
      [wireMember('lead-b', null)],
      TEMPLATES,
    )
    const BOTH_MIRROR = mirrorOf([LEADER, TEAM_FRAME], [MEMBER, MATE_FRAME])

    // A's pull is deferred behind a gate; A's ledger refresh is slow so
    // the continuation would be observable if it ran.
    let resolvePull!: (r: { status: 'apply'; receivedGeneration: number }) => void
    const pullGate = new Promise<{ status: 'apply'; receivedGeneration: number }>(resolve => {
      resolvePull = resolve
    })
    const pullProjection = vi.fn(() => pullGate)
    const refreshLedgerA = vi.fn(() => new Promise<void>(resolve => {
      setTimeout(resolve, 20)
    }))
    const refreshLedgerB = vi.fn(() => Promise.resolve())

    const propsA = {
      ...viewProps(BOTH_MIRROR, LEADER, {}, {
        [LEADER]: stateOf({ status: 'ready', teamSessionId: LEADER, appliedGeneration: 8 }),
      }),
      pullProjection,
      refreshTeamLedger: refreshLedgerA,
    }
    const view = render(<TeamView {...propsA} />)
    const buttonA = view.container.querySelector<HTMLButtonElement>('[data-team-refresh]')
    if (buttonA === null) throw new Error('the with-frame refresh button did not render')
    fireEvent.click(buttonA)
    expect(pullProjection).toHaveBeenCalledTimes(1)
    expect(pullProjection).toHaveBeenCalledWith(LEADER)
    expect(buttonA.disabled).toBe(true) // pending while the pull is in flight

    // The session switches to B (same view instance, new sessionId).
    const propsB = {
      ...viewProps(BOTH_MIRROR, MEMBER, {}, {
        [MEMBER]: stateOf({ status: 'ready', teamSessionId: MEMBER, appliedGeneration: 3 }),
      }),
      pullProjection,
      refreshTeamLedger: refreshLedgerB,
    }
    view.rerender(<TeamView {...propsB} />)

    // The old continuation settles NOW — it must be dead: A's ledger
    // refresh is never called, and neither is B's (B never started a
    // refresh; A's settle must not bleed into B's scope).
    resolvePull({ status: 'apply', receivedGeneration: 9 })
    await new Promise(resolve => setTimeout(resolve, 30))
    expect(refreshLedgerA).not.toHaveBeenCalled()
    expect(refreshLedgerB).not.toHaveBeenCalled()
    // B's refresh button is not left pending by A's stale settle.
    const buttonB = view.container.querySelector<HTMLButtonElement>('[data-team-refresh]')
    expect(buttonB).not.toBeNull()
    expect(buttonB?.disabled).toBe(false)
    view.unmount()
  })

  it('unmount invalidates the in-flight manual refresh: no ledger continuation, no unhandled rejection (F2-T2)', async () => {
    let resolvePull!: (r: { status: 'apply'; receivedGeneration: number }) => void
    const pullGate = new Promise<{ status: 'apply'; receivedGeneration: number }>(resolve => {
      resolvePull = resolve
    })
    const pullProjection = vi.fn(() => pullGate)
    const refreshTeamLedger = vi.fn(() => new Promise<void>(resolve => {
      setTimeout(resolve, 20)
    }))
    const props = {
      ...viewProps(TEAM_PROJECTION_MIRROR, LEADER, {}, {
        [LEADER]: stateOf({ status: 'ready', teamSessionId: LEADER, appliedGeneration: 8 }),
      }),
      pullProjection,
      refreshTeamLedger,
    }
    // Node's process event is 'unhandledRejection' (capital R); the
    // listener is try/finally-guarded so a failing assertion cannot
    // leak it into the rest of the run. (The stronger assertion is
    // still the direct one below: the old continuation never reaches
    // the ledger refresh at all.)
    const unhandled: unknown[] = []
    const onRejection = (reason: unknown) => { unhandled.push(reason) }
    process.on('unhandledRejection', onRejection)
    try {
      const view = render(<TeamView {...props} />)
      const button = view.container.querySelector<HTMLButtonElement>('[data-team-refresh]')
      if (button === null) throw new Error('the with-frame refresh button did not render')
      fireEvent.click(button)
      expect(pullProjection).toHaveBeenCalledTimes(1)
      view.unmount()
      // The deferred pull settles AFTER the unmount.
      resolvePull({ status: 'apply', receivedGeneration: 9 })
      await new Promise(resolve => setTimeout(resolve, 30))
      expect(refreshTeamLedger).not.toHaveBeenCalled()
      expect(unhandled).toEqual([])
    } finally {
      process.off('unhandledRejection', onRejection)
    }
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

/**
 * PR #35 second follow-up (P1-A) — the AUTHORITATIVE read-state view
 * mode (guide §4.2 state machine + §4.4 UI-T1..T6): the settled
 * `team.getReadState` outcome (not the projection store) decides which
 * face renders. A settled `ok/none` is DEFINITIVE and WINS over any
 * stale mirror frame; a failed probe renders its exact line (never a
 * permanent loading); a failed probe over a LAST GOOD frame keeps the
 * team body + the stale banner.
 */
describe('TeamView — the authoritative read-state view mode (PR #35 second follow-up P1-A)', () => {
  const okNoneOutcome: TeamReadStateOutcome = {
    status: 'ok',
    relation: {
      kind: 'none', teamSessionId: null, memberInstanceId: null,
      disposed: false, durableGeneration: null, liveToken: null,
    },
  }
  const remoteErrorOutcome: TeamReadStateOutcome = {
    status: 'remote-error', code: 'TEAM_REMOTE_INTERNAL_ERROR', message: 'boom',
  }
  const malformedOutcome: TeamReadStateOutcome = {
    status: 'malformed', reason: 'relation must be one of team-root | team-member | none (got x)',
  }
  const transportLossOutcome: TeamReadStateOutcome = {
    status: 'transport-loss', message: 'seam channel lost',
  }

  it('UI-T1: readState = ok/none, empty mirror → the DEFINITIVE ordinary zero state (NEVER "正在加载团队信息…")', () => {
    const view = render(<TeamView {...viewProps({}, OUTSIDER, {}, {}, { [OUTSIDER]: okNoneOutcome })} />)
    const zero = view.container.querySelector<HTMLElement>('[data-team-zero]')
    expect(zero).toBeTruthy()
    const line = zero?.querySelector<HTMLElement>('[data-team-projection-status]')
    expect(line?.getAttribute('data-team-projection-status')).toBe('none')
    expect(line?.textContent).toBe('已确认当前会话未加入团队')
    expect(line?.textContent).not.toContain('正在加载团队信息…')
    expect(view.container.querySelector('[data-team-view]')).toBeNull()
  })

  it('UI-T2: readState = remote-error, empty mirror → the code/message line (NOT ordinary/no-team, NOT a permanent loading)', () => {
    const view = render(<TeamView {...viewProps({}, OUTSIDER, {}, {}, { [OUTSIDER]: remoteErrorOutcome })} />)
    const line = view.container.querySelector<HTMLElement>('[data-team-projection-status]')
    expect(line?.getAttribute('data-team-projection-status')).toBe('ownership-error')
    expect(line?.textContent).toBe('团队归属读取失败 — TEAM_REMOTE_INTERNAL_ERROR: boom')
    expect(line?.textContent).not.toContain('未加入团队')
    expect(line?.textContent).not.toContain('正在加载团队信息…')
    expect(view.container.querySelector('[data-team-view]')).toBeNull()
    // The retry entry is present (the failure is a concluded read
    // failure, not a dead end).
    expect(view.container.querySelector('[data-team-refresh]')).toBeTruthy()
  })

  it('UI-T3: readState = malformed, empty mirror → the malformed reason line', () => {
    const view = render(<TeamView {...viewProps({}, OUTSIDER, {}, {}, { [OUTSIDER]: malformedOutcome })} />)
    const line = view.container.querySelector<HTMLElement>('[data-team-projection-status]')
    expect(line?.getAttribute('data-team-projection-status')).toBe('ownership-error')
    expect(line?.textContent).toContain('团队归属响应异常')
    expect(line?.textContent).toContain('relation must be one of team-root | team-member | none (got x)')
    expect(view.container.querySelector('[data-team-view]')).toBeNull()
  })

  it('UI-T4: readState = transport-loss, empty mirror → the reconnect/read-failure line', () => {
    const view = render(<TeamView {...viewProps({}, OUTSIDER, {}, {}, { [OUTSIDER]: transportLossOutcome })} />)
    const line = view.container.querySelector<HTMLElement>('[data-team-projection-status]')
    expect(line?.getAttribute('data-team-projection-status')).toBe('ownership-error')
    expect(line?.textContent).toBe('无法读取团队归属，等待连接恢复')
    expect(view.container.querySelector('[data-team-view]')).toBeNull()
  })

  it('UI-T5: stale mirror has Team A, readState = ok/none → the ordinary zero state WINS (the stale Team A body never renders)', () => {
    const view = render(<TeamView {...viewProps(TEAM_PROJECTION_MIRROR, LEADER, {}, {}, { [LEADER]: okNoneOutcome })} />)
    const zero = view.container.querySelector<HTMLElement>('[data-team-zero]')
    expect(zero).toBeTruthy()
    const line = zero?.querySelector<HTMLElement>('[data-team-projection-status]')
    expect(line?.getAttribute('data-team-projection-status')).toBe('none')
    expect(line?.textContent).toBe('已确认当前会话未加入团队')
    // The authoritative none beats the stale mirror: no team body.
    expect(view.container.querySelector('[data-team-view]')).toBeNull()
  })

  it('UI-T6: stale mirror has Team A, readState = error → the Team A body is KEPT + the ownership stale/error banner', () => {
    const view = render(<TeamView {...viewProps(TEAM_PROJECTION_MIRROR, LEADER, {}, {}, { [LEADER]: remoteErrorOutcome })} />)
    // The last good team face stays (never dropped, never degraded to none).
    expect(view.container.querySelector('[data-team-view]')).toBeTruthy()
    expect(view.container.querySelector('[data-team-zero]')).toBeNull()
    const banner = view.container.querySelector<HTMLElement>('[data-team-ownership-stale]')
    expect(banner).toBeTruthy()
    expect(banner?.textContent).toBe('团队归属刷新失败，当前显示上次成功的数据')
  })
})

/**
 * 2026-09-21 supplemental review — the host-width column geometry
 * contract (PR #27). A source-level guard over the `.body` / `.zero`
 * column rules: border-box sizing with a cap of W + 48px (48px = the
 * horizontal padding) guarantees the padded column can never overflow a
 * narrow container while its content stays exactly the host's
 * `--dsh-chat-content-width` on wide hosts. The regression this pins:
 * `width: 100%` + padding under the default content-box sizing overflows
 * the container by 48px at narrow widths (the 2026-09-21 review finding
 * on the first round of this PR). Targeted declaration checks — not a
 * whole-file string match, so unrelated style edits do not break it.
 */
describe('TeamView.module.css host-width column geometry contract', () => {
  // The package test script runs vitest with cwd = packages/client; the
  // root-level fallback covers a root-launched `vitest run`.
  const cssPath = [
    resolve(process.cwd(), 'src/ui/TeamView.module.css'),
    resolve(process.cwd(), 'packages/client/src/ui/TeamView.module.css'),
  ].find((p) => existsSync(p))
  if (cssPath === undefined) throw new Error('TeamView.module.css not found (cwd=' + process.cwd() + ')')
  const css = readFileSync(cssPath, 'utf8')

  function rule(selector: string): string {
    const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const m = new RegExp(`(^|\\n)\\s*${escaped}(?:\\s*,\\s*[^{]+)?\\s*\\{([^}]*)\\}`).exec(css)
    if (m === null) throw new Error(`CSS rule not found in TeamView.module.css: ${selector}`)
    const body = m[2]
    if (body === undefined) throw new Error(`CSS rule body not captured: ${selector}`)
    return body
  }

  it('pins .body to the border-box column capped at W + 48px', () => {
    const body = rule('.body')
    expect(body).toContain('box-sizing: border-box')
    expect(body).toContain('width: 100%')
    expect(body).toContain('max-width: calc(var(--dsh-chat-content-width, 100%) + 48px)')
    expect(body).toContain('margin: 0 auto')
  })

  it('pins .zero to the same column geometry', () => {
    const zero = rule('.zero')
    expect(zero).toContain('box-sizing: border-box')
    expect(zero).toContain('width: 100%')
    expect(zero).toContain('max-width: calc(var(--dsh-chat-content-width, 100%) + 48px)')
    expect(zero).toContain('margin: 0 auto')
  })
})
