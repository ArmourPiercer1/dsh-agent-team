// @vitest-environment jsdom
/**
 * D2 (Team D1-D6 repair v2, D6) — the Team UI dedicated open-in-Team-mode
 * entry (the explicit "以 Team 模式打开 / 回到 Leader" entry of v2 plan
 * §1.1.1) on the two D6 surfaces:
 *
 *  - the TeamView ZERO STATE persisted-roots picker rows (the D1 root
 *    rows gain the explicit entry over the same `roots` face);
 *  - the members section ROOT/LEADER row (the leader-kind group row —
 *    the member row with `childSessionId === null`, team-ui-snapshot
 *    §7.2) gains the entry + the current open-mode badge.
 *
 * Coverage (D2 task card, client-UI half):
 *  - the entry RENDERS on the picker rows and on the leader row, with
 *    the locale copy (zh) and triggers the injected `openTeamMode` with
 *    the row's root id;
 *  - the TYPED failure of a picker-row open renders ONE verbatim error
 *    note (code + message, UI §38 greyed-surface discipline) on that
 *    row;
 *  - the mode badge renders for the leader row when `teamOpenMode(root)`
 *    reads `'team'` (the current open mode of the root) and NOT when it
 *    reads `null`;
 *  - WITHOUT the `openTeamMode` face the D1 surface is unchanged: no
 *    entry on the picker rows, no entry/badge on the leader row.
 *
 * @module d2-team-mode-entry
 */
import { cleanup, fireEvent, render } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { makeTranslate } from '@deepseek-ai/dsh-client-test-runtime'
import type { TeamProjectionMirror } from '../src/state/team-session-resolution.js'
import type { TeamLedgerState } from '../src/state/team-ledger-store.js'
import type { RemoteResponse, RemoteSafeJsonValue } from '../../remote/src/index.js'
import {
  TeamView,
  type TeamViewProps,
  type TeamViewRootsFace,
} from '../src/ui/TeamView.js'
import type { TeamOpenModeOutcome } from '../src/plugin/team-mount-core.js'
import { zh } from '../src/ui/locales.js'

afterEach(cleanup)

const OUTSIDER = 'plain-session-d2'
const LEADER_ROOT = 'team-leader-d2'
const PICKER_ROOT = 'root-session-d2a'

/** One provenance-bearing success envelope of contract v3 (the wire shape, verbatim). */
function okV3(data: unknown, method: string): RemoteResponse {
  return {
    ok: true,
    value: {
      data: data as RemoteSafeJsonValue,
      provenance: {
        origin: 'team-remote', method, endpoint: method, contractVersion: 3,
        requestToken: null, projectionGeneration: null, effectSequence: null,
      },
    },
  }
}

/** One closed v3 root wire row (the D1 picker row). */
const ROW_A: Record<string, unknown> = {
  rootSessionId: PICKER_ROOT,
  blueprintId: 'BP-D2',
  revision: '17',
  defaultWorkspace: 'C:/agent-team/work/d2',
  createdAt: '2026-09-01T00:00:00Z',
  generation: 1,
  memberCount: 2,
}

/** A roots face over a scripted listRoots answer (the D1 face, verbatim). */
function makeRootsFace(answer: () => Promise<RemoteResponse>): TeamViewRootsFace {
  return {
    listRoots: vi.fn(() => answer()),
    ensureRootLive: vi.fn(() =>
      Promise.resolve(okV3({ rootSessionId: PICKER_ROOT, mode: 'team', live: true }, 'team.ensureRootLive')),
    ),
  }
}

/**
 * One minimal team projection frame WITH the leader member (the row with
 * the ABSENT childSessionId key — team-ui-snapshot §7.2: the leader's
 * navigation target is the root session).
 */
function leaderFrame(teamSessionId: string): TeamProjectionMirror {
  return {
    [teamSessionId]: {
      schemaVersion: 1,
      teamSessionId,
      blueprint: { blueprintId: 'bp-d2', revision: 1, contentHash: 'h-d2' },
      generation: 1,
      generatedAt: '2026-09-01T00:00:00.000Z',
      root: { teamSessionId, createdAt: '2026-09-01T00:00:00.000Z', policyState: 'open' },
      templates: [],
      members: [
        {
          instanceId: 'inst-leader',
          templateId: 'tpl-leader',
          label: 'Leader',
          workspace: 'C:/agent-team/work/d2',
          createdAt: '2026-09-01T00:00:00.000Z',
          lifecycle: 'CREATED',
          contextPolicy: 'fresh_per_delegation',
          effectiveConfig: {
            model: { value: null, source: 'blueprint', state: 'unavailable' },
            tools: { value: null, source: 'blueprint', state: 'unavailable' },
            permissions: {},
            skills: { value: null, source: 'blueprint', state: 'unavailable' },
            mcp: { value: null, source: 'blueprint', state: 'unavailable' },
          },
          liveActivity: null,
        },
      ],
      ledger: { latestSequence: 0, totalEntries: 0, byCategory: {}, pendingControlCount: 0 },
    },
  } as unknown as TeamProjectionMirror
}

function viewProps(
  projectionMirror: TeamProjectionMirror = {},
  sessionId: string = OUTSIDER,
  teamLedgers: Readonly<Record<string, TeamLedgerState>> = {},
): TeamViewProps {
  return {
    sessionId: sessionId as TeamViewProps['sessionId'],
    useSession: (() => undefined) as TeamViewProps['useSession'],
    useProjection: () => undefined,
    useInput: () => { throw new Error('unused') },
    inputActions: { setDraft: () => {}, submit: () => {} } as unknown as TeamViewProps['inputActions'],
    useSessions: () => { throw new Error('unused') },
    useWorkspaces: (() => undefined) as TeamViewProps['useWorkspaces'],
    useProjectionMirror: selector => selector(projectionMirror),
    useTeamLedgers: selector => selector(teamLedgers),
    ensureProjection: vi.fn(() => Promise.resolve()),
    pullProjection: vi.fn(() => Promise.resolve()),
    refreshTeamLedger: vi.fn(() => Promise.resolve()),
    openSession: vi.fn(),
    t: makeTranslate(zh),
    viewRequest: null,
    openView: () => {},
    completeViewRequest: () => {},
    useConversation: (() => undefined) as TeamViewProps['useConversation'],
    useChat: (() => undefined) as TeamViewProps['useChat'],
    useSessionPendingInteraction: (() => undefined) as TeamViewProps['useSessionPendingInteraction'],
  }
}

describe('TeamView: the D2 open-in-Team-mode entry (zero-state picker rows)', () => {
  it('renders the explicit entry on each persisted-roots row and triggers openTeamMode with the row root id', async () => {
    const roots = makeRootsFace(() => Promise.resolve(okV3({ roots: [ROW_A] }, 'team.listRoots')))
    const openTeamMode = vi.fn(async (): Promise<TeamOpenModeOutcome> => ({ ok: true }))
    const teamOpenMode = vi.fn(() => null as 'team' | null)
    const base = viewProps()
    const view = render(<TeamView {...{ ...base, roots, openTeamMode, teamOpenMode }} />)
    await vi.waitFor(() => {
      expect(view.container.querySelector('[data-team-roots-list]')).not.toBeNull()
    })
    const row = view.container.querySelector('[data-team-root-row][data-root-session-id="root-session-d2a"]')
    expect(row).not.toBeNull()
    const entry = row?.querySelector<HTMLButtonElement>('[data-team-mode-open-root]')
    expect(entry).not.toBeNull()
    expect(entry?.textContent).toBe('以 Team 模式打开 / 回到 Leader')
    fireEvent.click(entry as unknown as HTMLElement)
    await vi.waitFor(() => {
      expect(openTeamMode).toHaveBeenCalledTimes(1)
    })
    expect(openTeamMode).toHaveBeenCalledWith(PICKER_ROOT)
    // the entry triggers the FACE only — the native open belongs to the
    // mount's two-phase sequence (pinned in d2-open-team-mode.test.ts)
    expect(base.openSession).not.toHaveBeenCalledWith(PICKER_ROOT)
  })

  it('a typed openTeamMode failure renders ONE verbatim error note on that row', async () => {
    const roots = makeRootsFace(() => Promise.resolve(okV3({ roots: [ROW_A] }, 'team.listRoots')))
    const openTeamMode = vi.fn(async (): Promise<TeamOpenModeOutcome> => ({
      ok: false,
      code: 'TEAM_REMOTE_TEAM_ROOT_LIVE_PORT_UNAVAILABLE',
      message: 'the host wiring does not provide the ensureRootLive port',
    }))
    const teamOpenMode = vi.fn(() => null as 'team' | null)
    const view = render(
      <TeamView {...{ ...viewProps(), roots, openTeamMode, teamOpenMode }} />,
    )
    await vi.waitFor(() => {
      expect(view.container.querySelector('[data-team-roots-list]')).not.toBeNull()
    })
    const entry = view.container
      .querySelector('[data-team-root-row][data-root-session-id="root-session-d2a"]')
      ?.querySelector('[data-team-mode-open-root]')
    if (entry == null) throw new Error('the picker-row entry did not render')
    fireEvent.click(entry)
    const note = await vi.waitFor(() => {
      const found = view.container.querySelector(
        '[data-team-root-row][data-root-session-id="root-session-d2a"] [data-team-mode-open-error]',
      )
      if (found === null) throw new Error('the typed error note did not render yet')
      return found
    })
    expect(note.textContent).toContain('TEAM_REMOTE_TEAM_ROOT_LIVE_PORT_UNAVAILABLE')
    expect(note.textContent).toContain('the host wiring does not provide the ensureRootLive port')
  })

  it('WITHOUT the openTeamMode face the picker rows stay the D1 read-only surface (no entry)', async () => {
    const roots = makeRootsFace(() => Promise.resolve(okV3({ roots: [ROW_A] }, 'team.listRoots')))
    const view = render(<TeamView {...{ ...viewProps(), roots }} />)
    await vi.waitFor(() => {
      expect(view.container.querySelector('[data-team-roots-list]')).not.toBeNull()
    })
    expect(view.container.querySelector('[data-team-mode-open-root]')).toBeNull()
  })
})

describe('TeamView: the D2 open-in-Team-mode entry (the members section leader row)', () => {
  it('renders the entry on the root/leader row and triggers openTeamMode with the team session id', async () => {
    const openTeamMode = vi.fn(async (): Promise<TeamOpenModeOutcome> => ({ ok: true }))
    const teamOpenMode = vi.fn(() => null as 'team' | null)
    const view = render(
      <TeamView
        {...{
          ...viewProps(leaderFrame(LEADER_ROOT), LEADER_ROOT),
          openTeamMode,
          teamOpenMode,
        }}
      />,
    )
    await vi.waitFor(() => {
      expect(view.container.querySelector('[data-member-group-row][data-leader="true"]')).not.toBeNull()
    })
    // the D1 leader row itself stays the plain navigation button (the
    // "回到 leader" entry) — the D2 entry is a separate explicit button
    const leaderRow = view.container.querySelector('[data-member-group-row][data-leader="true"]')
    expect(leaderRow).not.toBeNull()
    const leaderGroup = leaderRow?.closest('[data-member-group]')
    expect(leaderGroup).not.toBeNull()
    const entry = leaderGroup?.querySelector<HTMLButtonElement>('[data-team-mode-open]')
    expect(entry).not.toBeNull()
    expect(entry?.textContent).toBe('以 Team 模式打开 / 回到 Leader')
    fireEvent.click(entry as unknown as HTMLElement)
    await vi.waitFor(() => {
      expect(openTeamMode).toHaveBeenCalledTimes(1)
    })
    expect(openTeamMode).toHaveBeenCalledWith(LEADER_ROOT)
  })

  it('renders the current open-mode badge (team) for the leader row when teamOpenMode reads team', async () => {
    const openTeamMode = vi.fn(async (): Promise<TeamOpenModeOutcome> => ({ ok: true }))
    const teamOpenMode = vi.fn(() => 'team' as const)
    const view = render(
      <TeamView
        {...{
          ...viewProps(leaderFrame(LEADER_ROOT), LEADER_ROOT),
          openTeamMode,
          teamOpenMode,
        }}
      />,
    )
    await vi.waitFor(() => {
      expect(view.container.querySelector('[data-member-group-row][data-leader="true"]')).not.toBeNull()
    })
    const badge = view.container.querySelector('[data-team-mode-badge]')
    expect(badge).not.toBeNull()
    expect(badge?.textContent).toBe('Team 模式')
  })

  it('renders NO badge when teamOpenMode reads null (the root was not opened in Team mode here)', async () => {
    const openTeamMode = vi.fn(async (): Promise<TeamOpenModeOutcome> => ({ ok: true }))
    const teamOpenMode = vi.fn(() => null as 'team' | null)
    const view = render(
      <TeamView
        {...{
          ...viewProps(leaderFrame(LEADER_ROOT), LEADER_ROOT),
          openTeamMode,
          teamOpenMode,
        }}
      />,
    )
    await vi.waitFor(() => {
      expect(view.container.querySelector('[data-member-group-row][data-leader="true"]')).not.toBeNull()
    })
    expect(view.container.querySelector('[data-team-mode-badge]')).toBeNull()
  })

  it('WITHOUT the openTeamMode face the leader row stays the D1 surface (no entry, no badge)', async () => {
    const view = render(<TeamView {...viewProps(leaderFrame(LEADER_ROOT), LEADER_ROOT)} />)
    await vi.waitFor(() => {
      expect(view.container.querySelector('[data-member-group]')).not.toBeNull()
    })
    expect(view.container.querySelector('[data-team-mode-open]')).toBeNull()
    expect(view.container.querySelector('[data-team-mode-badge]')).toBeNull()
  })
})
