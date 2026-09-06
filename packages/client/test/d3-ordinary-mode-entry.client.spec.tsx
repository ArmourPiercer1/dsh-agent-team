// @vitest-environment jsdom
/**
 * D3 (Team D1-D6 repair v2, D6) — the Team UI EXPLICIT ordinary-mode
 * fallback entry (the dedicated "以普通模式打开" entry of v2 plan
 * §1.1.3) on the SAME two surfaces as the D2 Team-mode entry:
 *
 *  - the TeamView ZERO STATE persisted-roots picker rows;
 *  - the members section ROOT/LEADER row (the leader-kind group row).
 *
 * Coverage (D3 task card, client-UI half):
 *  - the entry RENDERS on the picker rows and on the leader row, with
 *    the locale copy (zh + en) and triggers the injected
 *    `openOrdinaryMode` with the row's root id (the face-only trigger —
 *    the pure native open belongs to the mount, pinned in
 *    d3-open-ordinary-mode.test.ts);
 *  - the entry copy carries the SEMANTIC promise (A3 Q1 caveat 2):
 *    "no Team ensure is performed / team_* tools are NOT guaranteed"
 *    (the title hint, zh + en) and claims NO tool removal (the copy must
 *    not say the tools are removed — a live Team agent is adopted as-is);
 *  - the mode badge shows WHICH entry was used (v2 plan §1.1.5):
 *    'ordinary' ('普通模式' / 'Ordinary mode') for this entry, 'team'
 *    ('Team 模式' / 'Team mode') for openTeamMode (D2 state), absent for
 *    null;
 *  - WITHOUT the `openOrdinaryMode` face the D2 surface is unchanged
 *    (no ordinary entry on the picker rows or the leader row);
 *    WITHOUT either face there is no entry and no badge.
 *
 * @module d3-ordinary-mode-entry
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
import { en, zh } from '../src/ui/locales.js'

afterEach(cleanup)

const OUTSIDER = 'plain-session-d3'
const LEADER_ROOT = 'team-leader-d3'
const PICKER_ROOT = 'root-session-d3a'

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
  blueprintId: 'BP-D3',
  revision: '19',
  defaultWorkspace: 'C:/agent-team/work/d3',
  createdAt: '2026-09-02T00:00:00Z',
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
      blueprint: { blueprintId: 'bp-d3', revision: 1, contentHash: 'h-d3' },
      generation: 1,
      generatedAt: '2026-09-02T00:00:00.000Z',
      root: { teamSessionId, createdAt: '2026-09-02T00:00:00.000Z', policyState: 'open' },
      templates: [],
      members: [
        {
          instanceId: 'inst-leader',
          templateId: 'tpl-leader',
          label: 'Leader',
          workspace: 'C:/agent-team/work/d3',
          createdAt: '2026-09-02T00:00:00.000Z',
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
  dictionary: typeof zh = zh,
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
    t: makeTranslate(dictionary),
    viewRequest: null,
    openView: () => {},
    completeViewRequest: () => {},
    useConversation: (() => undefined) as TeamViewProps['useConversation'],
    useChat: (() => undefined) as TeamViewProps['useChat'],
    useSessionPendingInteraction: (() => undefined) as TeamViewProps['useSessionPendingInteraction'],
  }
}

describe('TeamView: the D3 ordinary-mode entry (zero-state picker rows)', () => {
  it('renders the explicit ordinary entry on each persisted-roots row (zh) and triggers openOrdinaryMode with the row root id', async () => {
    const roots = makeRootsFace(() => Promise.resolve(okV3({ roots: [ROW_A] }, 'team.listRoots')))
    const openTeamMode = vi.fn(async (): Promise<TeamOpenModeOutcome> => ({ ok: true }))
    const openOrdinaryMode = vi.fn()
    const teamOpenMode = vi.fn(() => null as 'team' | 'ordinary' | null)
    const base = viewProps()
    const view = render(<TeamView {...{ ...base, roots, openTeamMode, openOrdinaryMode, teamOpenMode }} />)
    await vi.waitFor(() => {
      expect(view.container.querySelector('[data-team-roots-list]')).not.toBeNull()
    })
    const row = view.container.querySelector('[data-team-root-row][data-root-session-id="root-session-d3a"]')
    expect(row).not.toBeNull()
    // the SAME row carries the D2 Team-mode entry AND the D3 ordinary
    // entry (v2 plan §1.1.3: the fallback sits next to the Team entry)
    const teamEntry = row?.querySelector<HTMLButtonElement>('[data-team-mode-open-root]')
    expect(teamEntry?.textContent).toBe('以 Team 模式打开 / 回到 Leader')
    const entry = row?.querySelector<HTMLButtonElement>('[data-team-ordinary-open-root]')
    expect(entry).not.toBeNull()
    expect(entry?.textContent).toBe('以普通模式打开')
    fireEvent.click(entry as unknown as HTMLElement)
    await vi.waitFor(() => {
      expect(openOrdinaryMode).toHaveBeenCalledTimes(1)
    })
    expect(openOrdinaryMode).toHaveBeenCalledWith(PICKER_ROOT)
    // the Team-mode face is NOT triggered by the ordinary entry (and the
    // native open belongs to the mount — pinned in d3-open-ordinary-mode)
    expect(openTeamMode).not.toHaveBeenCalled()
    expect(base.openSession).not.toHaveBeenCalledWith(PICKER_ROOT)
  })

  it('the ordinary entry copy carries the semantic promise (zh) and claims NO tool removal', async () => {
    const roots = makeRootsFace(() => Promise.resolve(okV3({ roots: [ROW_A] }, 'team.listRoots')))
    const openOrdinaryMode = vi.fn()
    const view = render(
      <TeamView {...{ ...viewProps(), roots, openOrdinaryMode }} />,
    )
    await vi.waitFor(() => {
      expect(view.container.querySelector('[data-team-roots-list]')).not.toBeNull()
    })
    const entry = view.container
      .querySelector<HTMLButtonElement>('[data-team-root-row][data-root-session-id="root-session-d3a"] [data-team-ordinary-open-root]')
    if (entry == null) throw new Error('the picker-row ordinary entry did not render')
    // the promise: no Team ensure is performed / team_* tools NOT guaranteed
    expect(entry.title).toBe('不执行 Team ensure，不保证 team_* 工具')
    // the copy must NOT claim a tool removal (A3 Q1 caveat 2: a live Team
    // agent is adopted as-is — the entry is a guarantee, not a removal)
    expect(entry.textContent ?? '').not.toContain('移除')
    expect(entry.title).not.toContain('移除')
  })
})

describe('TeamView: the D3 ordinary-mode entry (the members section leader row)', () => {
  it('renders the ordinary entry on the root/leader row (zh) and triggers openOrdinaryMode with the team session id', async () => {
    const openTeamMode = vi.fn(async (): Promise<TeamOpenModeOutcome> => ({ ok: true }))
    const openOrdinaryMode = vi.fn()
    const teamOpenMode = vi.fn(() => null as 'team' | 'ordinary' | null)
    const view = render(
      <TeamView
        {...{
          ...viewProps(leaderFrame(LEADER_ROOT), LEADER_ROOT),
          openTeamMode,
          openOrdinaryMode,
          teamOpenMode,
        }}
      />,
    )
    await vi.waitFor(() => {
      expect(view.container.querySelector('[data-member-group-row][data-leader="true"]')).not.toBeNull()
    })
    const leaderRow = view.container.querySelector('[data-member-group-row][data-leader="true"]')
    const leaderGroup = leaderRow?.closest('[data-member-group]')
    expect(leaderGroup).not.toBeNull()
    // the D2 Team-mode entry and the D3 ordinary entry share the leader row
    expect(leaderGroup?.querySelector('[data-team-mode-open]')?.textContent).toBe('以 Team 模式打开 / 回到 Leader')
    const entry = leaderGroup?.querySelector<HTMLButtonElement>('[data-team-ordinary-open]')
    expect(entry).not.toBeNull()
    expect(entry?.textContent).toBe('以普通模式打开')
    expect(entry?.title).toBe('不执行 Team ensure，不保证 team_* 工具')
    fireEvent.click(entry as unknown as HTMLElement)
    await vi.waitFor(() => {
      expect(openOrdinaryMode).toHaveBeenCalledTimes(1)
    })
    expect(openOrdinaryMode).toHaveBeenCalledWith(LEADER_ROOT)
    expect(openTeamMode).not.toHaveBeenCalled()
  })

  it('renders the mode badge for the entry USED (zh): ordinary → 普通模式', async () => {
    const openTeamMode = vi.fn(async (): Promise<TeamOpenModeOutcome> => ({ ok: true }))
    const openOrdinaryMode = vi.fn()
    const teamOpenMode = vi.fn(() => 'ordinary' as const)
    const view = render(
      <TeamView
        {...{
          ...viewProps(leaderFrame(LEADER_ROOT), LEADER_ROOT),
          openTeamMode,
          openOrdinaryMode,
          teamOpenMode,
        }}
      />,
    )
    await vi.waitFor(() => {
      expect(view.container.querySelector('[data-member-group-row][data-leader="true"]')).not.toBeNull()
    })
    const badge = view.container.querySelector('[data-team-mode-badge]')
    expect(badge).not.toBeNull()
    expect(badge?.textContent).toBe('普通模式')
    expect(badge?.getAttribute('data-open-mode')).toBe('ordinary')
  })

  it('renders the mode badge for the D2 team entry (regression): team → Team 模式', async () => {
    const openTeamMode = vi.fn(async (): Promise<TeamOpenModeOutcome> => ({ ok: true }))
    const openOrdinaryMode = vi.fn()
    const teamOpenMode = vi.fn(() => 'team' as const)
    const view = render(
      <TeamView
        {...{
          ...viewProps(leaderFrame(LEADER_ROOT), LEADER_ROOT),
          openTeamMode,
          openOrdinaryMode,
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
    expect(badge?.getAttribute('data-open-mode')).toBe('team')
  })

  it('renders NO badge when teamOpenMode reads null (the root was not explicitly opened here)', async () => {
    const openTeamMode = vi.fn(async (): Promise<TeamOpenModeOutcome> => ({ ok: true }))
    const openOrdinaryMode = vi.fn()
    const teamOpenMode = vi.fn(() => null as 'team' | 'ordinary' | null)
    const view = render(
      <TeamView
        {...{
          ...viewProps(leaderFrame(LEADER_ROOT), LEADER_ROOT),
          openTeamMode,
          openOrdinaryMode,
          teamOpenMode,
        }}
      />,
    )
    await vi.waitFor(() => {
      expect(view.container.querySelector('[data-member-group-row][data-leader="true"]')).not.toBeNull()
    })
    expect(view.container.querySelector('[data-team-mode-badge]')).toBeNull()
  })
})

describe('TeamView: the D3 ordinary-mode entry copy (en)', () => {
  it('renders the en entry copy on the picker row + leader row and the en badge for the ordinary entry', async () => {
    const roots = makeRootsFace(() => Promise.resolve(okV3({ roots: [ROW_A] }, 'team.listRoots')))
    const openTeamMode = vi.fn(async (): Promise<TeamOpenModeOutcome> => ({ ok: true }))
    const openOrdinaryMode = vi.fn()
    const teamOpenMode = vi.fn(() => 'ordinary' as const)
    const base = viewProps(leaderFrame(LEADER_ROOT), LEADER_ROOT, {}, en)
    const view = render(<TeamView {...{ ...base, roots, openTeamMode, openOrdinaryMode, teamOpenMode }} />)
    await vi.waitFor(() => {
      expect(view.container.querySelector('[data-member-group-row][data-leader="true"]')).not.toBeNull()
    })
    // leader row (the current session IS the team root here)
    const leaderGroup = view.container
      .querySelector('[data-member-group-row][data-leader="true"]')
      ?.closest('[data-member-group]')
    const leaderEntry = leaderGroup?.querySelector<HTMLButtonElement>('[data-team-ordinary-open]')
    expect(leaderEntry?.textContent).toBe('Open in ordinary mode')
    expect(leaderEntry?.title).toBe('No Team ensure is performed; team_* tools are not guaranteed')
    // the copy must not claim tool removal (en)
    expect((leaderEntry?.textContent ?? '') + (leaderEntry?.title ?? '')).not.toContain('remov')
    const badge = view.container.querySelector('[data-team-mode-badge]')
    expect(badge?.textContent).toBe('Ordinary mode')
    expect(badge?.getAttribute('data-open-mode')).toBe('ordinary')
  })

  it('renders the en picker-row entry with the en semantic promise (the en zero state carries the picker list)', async () => {
    const roots = makeRootsFace(() => Promise.resolve(okV3({ roots: [ROW_A] }, 'team.listRoots')))
    const openOrdinaryMode = vi.fn()
    // non-team current session (OUTSIDER) → the zero state renders the
    // persisted-roots picker list
    const view = render(
      <TeamView {...{ ...viewProps(undefined, OUTSIDER, {}, en), roots, openOrdinaryMode }} />,
    )
    await vi.waitFor(() => {
      expect(view.container.querySelector('[data-team-roots-list]')).not.toBeNull()
    })
    const entry = view.container
      .querySelector<HTMLButtonElement>('[data-team-root-row][data-root-session-id="root-session-d3a"] [data-team-ordinary-open-root]')
    expect(entry?.textContent).toBe('Open in ordinary mode')
    expect(entry?.title).toBe('No Team ensure is performed; team_* tools are not guaranteed')
  })
})

describe('TeamView: the D3 face-absence worlds (the D2 surface stays unchanged)', () => {
  it('WITHOUT the openOrdinaryMode face the picker rows carry ONLY the D2 Team-mode entry', async () => {
    const roots = makeRootsFace(() => Promise.resolve(okV3({ roots: [ROW_A] }, 'team.listRoots')))
    const openTeamMode = vi.fn(async (): Promise<TeamOpenModeOutcome> => ({ ok: true }))
    const view = render(<TeamView {...{ ...viewProps(), roots, openTeamMode }} />)
    await vi.waitFor(() => {
      expect(view.container.querySelector('[data-team-roots-list]')).not.toBeNull()
    })
    expect(view.container.querySelector('[data-team-mode-open-root]')).not.toBeNull()
    expect(view.container.querySelector('[data-team-ordinary-open-root]')).toBeNull()
  })

  it('WITHOUT the openOrdinaryMode face the leader row stays the D2 surface (no ordinary entry, no badge)', async () => {
    const openTeamMode = vi.fn(async (): Promise<TeamOpenModeOutcome> => ({ ok: true }))
    const view = render(
      <TeamView
        {...{
          ...viewProps(leaderFrame(LEADER_ROOT), LEADER_ROOT),
          openTeamMode,
        }}
      />,
    )
    await vi.waitFor(() => {
      expect(view.container.querySelector('[data-member-group]')).not.toBeNull()
    })
    expect(view.container.querySelector('[data-team-mode-open]')).not.toBeNull()
    expect(view.container.querySelector('[data-team-ordinary-open]')).toBeNull()
    expect(view.container.querySelector('[data-team-mode-badge]')).toBeNull()
  })

  it('WITHOUT either open face there is no entry and no badge (the D1 surface)', async () => {
    const view = render(<TeamView {...viewProps(leaderFrame(LEADER_ROOT), LEADER_ROOT)} />)
    await vi.waitFor(() => {
      expect(view.container.querySelector('[data-member-group]')).not.toBeNull()
    })
    expect(view.container.querySelector('[data-team-mode-open]')).toBeNull()
    expect(view.container.querySelector('[data-team-ordinary-open]')).toBeNull()
    expect(view.container.querySelector('[data-team-mode-badge]')).toBeNull()
  })
})
