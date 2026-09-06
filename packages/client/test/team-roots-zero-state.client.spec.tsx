// @vitest-environment jsdom
/**
 * D1 (Team D1-D6 repair v2, remote contract v3) — the TeamView ZERO STATE
 * persisted-roots share: team-mount-core feeds the persisted roots into
 * the zero state through the `roots` face (`TeamViewRootsFace`), and the
 * zero state renders the durable root rows READ-ONLY (blueprint@revision,
 * default workspace, member count, creation time, root id) WITHOUT open
 * actions (the open action arrives with D2/D3 over this same face).
 *
 * Coverage (D1 task card, client-UI half):
 *  - the one-shot read: `listRoots` is called exactly once per zero-state
 *    entry (gated to the zero state; skipped while the creation panel is
 *    open; re-fires on reopen — the same read-not-command discipline as
 *    the legacy inspection);
 *  - the rows: the closed wire row fields render verbatim (the row's
 *    `data-root-*` cells), including the ABSENT defaultWorkspace → the
 *    localized no-workspace placeholder;
 *  - NO open action in D1: the rows carry no buttons and
 *    `ensureRootLive` is NEVER called (the method is inert until D2);
 *  - an EMPTY roots list renders nothing (no list, no note);
 *  - a TYPED failure renders the ONE verbatim note
 *    (`code: message`, the UI §38 greyed-surface discipline) and no list;
 *  - a MALFORMED success payload (the defensive client-boundary parse
 *    fails) renders the same note lane with `malformed-response` — never
 *    a throw, never a partial list;
 *  - without the `roots` face the zero state is the pre-D1 surface
 *    (no list, no note);
 *  - the gating: a TEAM session (non-zero state) never triggers the
 *    roots read.
 *
 * @module team-roots-zero-state
 */
import { cleanup, fireEvent, render } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { makeTranslate } from '@deepseek-ai/dsh-client-test-runtime'
import type { TeamProjectionMirror } from '../src/state/team-session-resolution.js'
import type { TeamLedgerState } from '../src/state/team-ledger-store.js'
import type { RemoteResponse, RemoteSafeJsonValue } from '../../remote/src/index.js'
import type { TeamPresetRow } from '../src/model/team-intent-model.js'
import {
  TeamView,
  type TeamViewCreationFace,
  type TeamViewProps,
  type TeamViewRootsFace,
} from '../src/ui/TeamView.js'
import { zh } from '../src/ui/locales.js'

afterEach(cleanup)

const OUTSIDER = 'plain-session-d1'
const LEADER = 'team-leader-d1'

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

/** One typed error envelope of contract v3. */
function errV3(code: string, message: string, method: string): RemoteResponse {
  return {
    ok: false,
    error: {
      code,
      message,
      details: {
        method, endpoint: method, contractVersion: 3, requestToken: null,
        reason: 'domain-error',
      },
    },
  }
}

/** One closed v3 root wire row. */
const ROW_A: Record<string, unknown> = {
  rootSessionId: 'root-session-d1a',
  blueprintId: 'BP-D1',
  revision: '17',
  defaultWorkspace: 'C:/agent-team/work/d1',
  createdAt: '2026-09-01T00:00:00Z',
  generation: 1,
  memberCount: 2,
}
/** The ABSENT-defaultWorkspace row (the placeholder scenario). */
const ROW_B: Record<string, unknown> = {
  rootSessionId: 'root-session-d1b',
  blueprintId: 'BP-D1-B',
  revision: '3',
  createdAt: '2026-09-02T00:00:00Z',
  generation: 5,
  memberCount: 1,
}

/** A D1 roots face over a scripted listRoots answer. */
function makeRootsFace(
  answer: () => Promise<RemoteResponse>,
): TeamViewRootsFace & { listRoots: ReturnType<typeof vi.fn>; ensureRootLive: ReturnType<typeof vi.fn> } {
  return {
    listRoots: vi.fn(() => answer()),
    ensureRootLive: vi.fn(() =>
      Promise.resolve(errV3('TEAM_REMOTE_TEAM_ROOT_LIVE_NOT_IMPLEMENTED', 'reserved (D2)', 'team.ensureRootLive')),
    ),
  }
}

/** A happy-path creation face (the S5-A entry; the panel can be opened to pin the gating). */
function makeCreationFace(): TeamViewCreationFace {
  return {
    listCatalog: vi.fn(() => Promise.resolve(
      okV3({ blueprints: [{ blueprintId: 'bp-1', revisions: [1] }] }, 'catalog.list'),
    )),
    getCatalog: vi.fn(() => Promise.resolve(
      okV3({
        blueprint: {
          blueprintId: 'bp-1', revision: 1,
          displayName: 'Atlas', metadata: { source: 'builtin' },
          members: [{ templateId: 'tpl-lead' }],
        },
      }, 'catalog.get'),
    )),
    probeCompatibility: vi.fn(() => Promise.resolve(
      okV3({ compatibility: { status: 'OPEN', requirements: [] } }, 'intent.probe'),
    )),
    teamCreateV2: vi.fn(() => Promise.resolve(okV3({ path: 'root', durable: true, bind: {} }, 'team.create'))),
    teamAdmitInitialWorkV2: vi.fn(() => Promise.resolve(okV3({ workOutcome: 'delivered' }, 'team.admitInitialWork'))),
    openCreatedSession: vi.fn(async () => undefined),
    listAgentPresets: vi.fn(() => Promise.resolve([
      { id: 'team', name: 'Team', isDefault: false },
    ] satisfies readonly TeamPresetRow[])),
  }
}

/** One minimal team projection frame (the non-zero-state scenario). */
function teamFrame(teamSessionId: string): TeamProjectionMirror {
  return {
    [teamSessionId]: {
      schemaVersion: 1,
      teamSessionId,
      blueprint: { blueprintId: 'bp-1', revision: 1, contentHash: 'h-1' },
      generation: 1,
      generatedAt: '2026-08-29T00:00:00.000Z',
      root: { teamSessionId, createdAt: '2026-08-29T00:00:00.000Z', policyState: 'open' },
      templates: [],
      members: [],
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

describe('TeamView zero state: the D1 persisted-roots share (remote contract v3)', () => {
  it('renders the durable root rows read-only (blueprint@revision, workspace, member count, created) and reads exactly once', async () => {
    const roots = makeRootsFace(() => Promise.resolve(okV3({ roots: [ROW_A, ROW_B] }, 'team.listRoots')))
    const view = render(<TeamView {...{ ...viewProps(), roots }} />)
    await vi.waitFor(() => {
      expect(view.container.querySelector('[data-team-roots-list]')).not.toBeNull()
    })
    // exactly ONE verbatim read (the read-not-command discipline)
    expect(roots.listRoots).toHaveBeenCalledTimes(1)
    // the section title (zh)
    expect(view.container.querySelector('[data-team-roots] h3')?.textContent).toBe('已持久化的团队')
    // row A — all five cells verbatim
    const rowA = view.container.querySelector('[data-team-root-row][data-root-session-id="root-session-d1a"]')
    expect(rowA).not.toBeNull()
    expect(rowA?.querySelector('[data-root-id]')?.textContent).toBe('root-session-d1a')
    expect(rowA?.querySelector('[data-root-blueprint]')?.textContent).toBe('BP-D1@17')
    expect(rowA?.querySelector('[data-root-workspace]')?.textContent).toBe('C:/agent-team/work/d1')
    expect(rowA?.querySelector('[data-root-members]')?.textContent).toBe('2 名成员')
    const createdA = rowA?.querySelector('[data-root-created]')
    expect(createdA?.textContent).toBe('2026-09-01T00:00:00Z')
    expect(createdA?.getAttribute('title')).toBe('2026-09-01T00:00:00Z')
    // row B — the ABSENT defaultWorkspace renders the localized placeholder
    const rowB = view.container.querySelector('[data-team-root-row][data-root-session-id="root-session-d1b"]')
    expect(rowB).not.toBeNull()
    expect(rowB?.querySelector('[data-root-blueprint]')?.textContent).toBe('BP-D1-B@3')
    expect(rowB?.querySelector('[data-root-workspace]')?.textContent).toBe('（无默认工作区）')
    expect(rowB?.querySelector('[data-root-members]')?.textContent).toBe('1 名成员')
  })

  it('renders NO open action in D1: no buttons in the rows and ensureRootLive is never called (inert until D2)', async () => {
    const roots = makeRootsFace(() => Promise.resolve(okV3({ roots: [ROW_A] }, 'team.listRoots')))
    const view = render(<TeamView {...{ ...viewProps(), roots }} />)
    await vi.waitFor(() => {
      expect(view.container.querySelector('[data-team-roots-list]')).not.toBeNull()
    })
    const list = view.container.querySelector('[data-team-roots-list]')
    if (list === null) throw new Error('the roots list did not render')
    expect(list.querySelectorAll('button').length).toBe(0)
    expect(list.querySelectorAll('a').length).toBe(0)
    // the ensureRootLive face was injected but NEVER invoked (no open
    // action exists yet — the D2/D3 addition)
    expect(roots.ensureRootLive).not.toHaveBeenCalled()
  })

  it('an empty roots list renders nothing (no list, no note)', async () => {
    const roots = makeRootsFace(() => Promise.resolve(okV3({ roots: [] }, 'team.listRoots')))
    const view = render(<TeamView {...{ ...viewProps(), roots }} />)
    await vi.waitFor(() => {
      expect(roots.listRoots).toHaveBeenCalledTimes(1)
    })
    expect(view.container.querySelector('[data-team-zero]')).not.toBeNull()
    expect(view.container.querySelector('[data-team-roots]')).toBeNull()
    expect(view.container.querySelector('[data-roots-note]')).toBeNull()
  })

  it('a typed failure renders the ONE verbatim note (code: message) and no list', async () => {
    const roots = makeRootsFace(() =>
      Promise.resolve(errV3('TEAM_REMOTE_TEAM_ROOTS_UNAVAILABLE', 'the host wiring does not provide the listRoots port', 'team.listRoots')))
    const view = render(<TeamView {...{ ...viewProps(), roots }} />)
    await vi.waitFor(() => {
      expect(view.container.querySelector('[data-roots-note]')).not.toBeNull()
    })
    const note = view.container.querySelector('[data-roots-note]')
    expect(note?.textContent).toBe(
      '读取持久化团队失败：TEAM_REMOTE_TEAM_ROOTS_UNAVAILABLE: the host wiring does not provide the listRoots port',
    )
    expect(view.container.querySelector('[data-team-roots-list]')).toBeNull()
  })

  it('a malformed success payload renders the malformed-response note lane (defensive parse, never a throw)', async () => {
    const roots = makeRootsFace(() =>
      Promise.resolve(okV3({ roots: [{ rootSessionId: 'root-x', blueprintId: 'BP-X' }] }, 'team.listRoots')))
    const view = render(<TeamView {...{ ...viewProps(), roots }} />)
    await vi.waitFor(() => {
      expect(view.container.querySelector('[data-roots-note]')).not.toBeNull()
    })
    const note = view.container.querySelector('[data-roots-note]')
    expect(note?.textContent).toContain('malformed-response')
    expect(view.container.querySelector('[data-team-roots-list]')).toBeNull()
    // the zero state itself is intact (the note rides the greyed-surface lane)
    expect(view.container.querySelector('[data-team-zero]')).not.toBeNull()
  })

  it('without the roots face the zero state is the pre-D1 surface (no list, no note)', async () => {
    const view = render(<TeamView {...viewProps()} />)
    await new Promise(resolve => setTimeout(resolve, 0))
    expect(view.container.querySelector('[data-team-zero]')).not.toBeNull()
    expect(view.container.querySelector('[data-team-roots]')).toBeNull()
    expect(view.container.querySelector('[data-roots-note]')).toBeNull()
  })

  it('the read is gated to the zero state: a team session never triggers the roots read', async () => {
    const roots = makeRootsFace(() => Promise.resolve(okV3({ roots: [ROW_A] }, 'team.listRoots')))
    const view = render(<TeamView {...{ ...viewProps(teamFrame(LEADER), LEADER), roots }} />)
    await new Promise(resolve => setTimeout(resolve, 0))
    expect(roots.listRoots).not.toHaveBeenCalled()
    expect(view.container.querySelector('[data-team-roots-list]')).toBeNull()
  })

  it('the read is skipped while the creation panel is open and re-fires on return to the entry (zero state, S5-A coexistence)', async () => {
    const roots = makeRootsFace(() => Promise.resolve(okV3({ roots: [ROW_A] }, 'team.listRoots')))
    const creation = makeCreationFace()
    const view = render(<TeamView {...{ ...viewProps(), creation, roots }} />)
    // the initial zero-state read fires
    await vi.waitFor(() => {
      expect(roots.listRoots).toHaveBeenCalledTimes(1)
    })
    const start = view.container.querySelector<HTMLButtonElement>('[data-intent-start-here]')
    if (start === null) throw new Error('the Start Team from Here entry did not render')
    fireEvent.click(start)
    await vi.waitFor(() => {
      expect(view.container.querySelector('[data-team-creation-panel]')).not.toBeNull()
    })
    // while the panel is open the read is NOT re-fired
    expect(roots.listRoots).toHaveBeenCalledTimes(1)
    const cancel = view.container.querySelector<HTMLButtonElement>('[data-intent-cancel]')
    if (cancel === null) throw new Error('the panel cancel button did not render')
    fireEvent.click(cancel)
    // back on the entry: the read re-fires exactly once
    await vi.waitFor(() => {
      expect(roots.listRoots).toHaveBeenCalledTimes(2)
    })
  })
})
