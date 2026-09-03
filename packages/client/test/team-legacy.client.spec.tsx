// @vitest-environment jsdom
/**
 * P9-T8 (S5-D) — TeamView legacy Team zero-state spec (plan P9-S5 S5-D
 * "legacy.inspect banner/zero-state"; plan §10.6; UI doc §34).
 *
 * Coverage:
 *  - `legacy-team` inspection → the Team-tab zero state is REPLACED by
 *    the persistent read-only banner (UI §34.1 verbatim copy) plus the
 *    decoded legacy summary (best-effort: team-id / leader-session rows
 *    only when the wire carries them, roster + session counts, roster
 *    warnings, roster rows `name ?? id ?? fileName` + ` (role)`).
 *    NO Start-Team entry (UI §34.3 forbidden executable list).
 *  - `native-fallback` inspection → the ordinary zero state (the session
 *    is NOT a legacy team; the inspection degraded to native data).
 *  - typed inspection failure → the ordinary zero state + ONE verbatim
 *    note (UI §38: a greyed surface must state its reason).
 *  - transport loss → the ordinary zero state + a local `native-error`
 *    note (the closed error vocabulary never gains transport codes).
 *  - unrecognized future status → the ordinary zero state + a verbatim
 *    note with the raw record (loud, never silently dropped).
 *  - seam absent → the T7 zero state is unchanged (no legacy surface).
 *  - the inspection is a one-shot READ: called exactly once, no
 *    arguments, and it never pulls the projection.
 *
 * Gate P9-G5 (the inspection is a READ, not a command flow):
 *  (a) NO optimistic authority patch — the inspection result lives in
 *      view-local state only; the projection mirror is untouched.
 *  (b) the typed result is preserved verbatim — the note renders
 *      `code: message` exactly as the wire envelope carried it.
 *  (c) projection pull exactly 0× from the inspection — the only pull
 *      in these renders is the T7 cold-pull `ensureProjection` (once,
 *      for the zero state itself); the banner renders without any
 *      further pull.
 *  (d) the rendered durable state comes from the Projection — the
 *      inspection decides WHICH zero state renders; the durable team
 *      state still comes from the projection (absent here → the zero
 *      state), never from the inspection's own copy.
 *
 * The inspection face is parameterless (`() => Promise<RemoteResponse>`;
 * the dshHome closure is bound at the T9 mount). The specs assert the
 * en copy; the final test pins the verbatim zh banner (UI §34.1).
 */
import { act, cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { makeTranslate } from '@deepseek-ai/dsh-client-test-runtime'
import type { TeamProjectionMirror } from '../src/state/team-session-resolution.js'
import type { TeamLedgerState } from '../src/state/team-ledger-store.js'
import type {
  RemoteCatalogGetParams, RemoteResponse, RemoteSafeJsonValue,
} from '../../remote/src/index.js'
import type { TeamPresetRow } from '../src/model/team-intent-model.js'
import { TeamView, type TeamViewCreationFace, type TeamViewProps } from '../src/ui/TeamView.js'
import { en, zh } from '../src/ui/locales.js'

afterEach(cleanup)

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

/** One typed failure envelope (the closed code + wire message kept verbatim). */
function errorResponse(code: string, message: string, method: string): RemoteResponse {
  return {
    ok: false,
    error: {
      code, message,
      details: { method, endpoint: method, contractVersion: 1, requestToken: null },
    },
  }
}

/** A happy-path creation face (the T7 shape; this spec never creates). */
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

/** The wire value of a full legacy-team inspection (roster + sessions). */
const LEGACY_TEAM_DATA = {
  inspection: {
    status: 'legacy-team',
    team: {
      teamId: 'legacy-team-9',
      leaderSessionId: 'legacy-leader-s',
      leaderSelection: 'team-events',
      roster: [
        { source: 'home', fileName: 'leader.md', id: 'legacy-leader-s', role: 'leader', name: 'Atlas', description: 'the leader' },
        { source: 'workspace', fileName: 'scout.md', id: 'member-s-1', role: 'teammate', name: 'Scout' },
        { source: 'workspace', fileName: 'anon.md' },
      ],
      rosterWarnings: ['orphan roster row without an id'],
      sessions: ['legacy-leader-s', 'member-s-1'],
      memberChildSessionIds: ['member-s-1'],
    },
  },
}

/** A roster-only legacy team (no teamId / leaderSessionId on the wire). */
const ROSTER_ONLY_DATA = {
  inspection: {
    status: 'legacy-team',
    team: {
      leaderSelection: 'roster-only',
      roster: [
        { source: 'home', fileName: 'crew.md', id: 'crew-s-1', role: 'teammate', name: 'Crew' },
      ],
    },
  },
}

/** The degraded inspection (the session is NOT a legacy team). */
const NATIVE_FALLBACK_DATA = {
  inspection: { status: 'native-fallback', native: ['session-x', 'session-y'] },
}

/** A future status tag (the fail-safe arm; rendered verbatim, never dropped). */
const UNKNOWN_STATUS_DATA = {
  inspection: { status: 'future-legacy', source: 'roster-v2' },
}

/**
 * The T7 TeamView harness, narrowed to the zero state (an empty
 * projection mirror + the OUTSIDER session). `overrides` carries the
 * T8 seams under test (the optional creation / legacyInspect faces and
 * the translate seat).
 */
function viewProps(
  projectionMirror: TeamProjectionMirror = {},
  overrides: {
    readonly creation?: TeamViewCreationFace
    readonly legacyInspect?: () => Promise<RemoteResponse>
    readonly t?: TeamViewProps['t']
  } = {},
): TeamViewProps {
  const teamLedgers: Readonly<Record<string, TeamLedgerState>> = {}
  return {
    // PropsRuntime<'conversation.view'> carries the framework branded
    // SessionId; the fixture is a bare string, so the boundary cast is
    // the single fixture-to-framework narrowing in this helper.
    sessionId: OUTSIDER as TeamViewProps['sessionId'],
    useSession: (() => undefined) as TeamViewProps['useSession'],
    useProjection: () => undefined,
    useInput: () => { throw new Error('unused') },
    inputActions: { setDraft: () => {}, submit: () => {} } as unknown as TeamViewProps['inputActions'],
    useSessions: () => { throw new Error('unused') },
    useWorkspaces: (() => undefined) as TeamViewProps['useWorkspaces'],
    useProjectionMirror: selector => selector(projectionMirror),
    useTeamLedgers: selector => selector(teamLedgers),
    ensureProjection: vi.fn(() => Promise.resolve()),
    refreshTeamLedger: vi.fn(() => Promise.resolve()),
    openSession: vi.fn(),
    t: overrides.t ?? makeTranslate(en),
    // Current DSH requires the conversation.view owner props
    // (viewRequest/openView/completeViewRequest); TeamView renders them
    // as a degraded jump surface (Seam 4), so no-op stubs.
    viewRequest: null,
    openView: () => {},
    completeViewRequest: () => {},
    useConversation: (() => undefined) as TeamViewProps['useConversation'],
    useChat: (() => undefined) as TeamViewProps['useChat'],
    useSessionPendingInteraction: (() => undefined) as TeamViewProps['useSessionPendingInteraction'],
    creation: overrides.creation,
    legacyInspect: overrides.legacyInspect,
  }
}

/**
 * Flush the immediate-resolve inspection promise through a macrotask
 * (the spies resolve synchronously; the `.then` set-state is a queued
 * microtask that one timer tick deterministically settles).
 */
async function settle(): Promise<void> {
  await act(async () => {
    await new Promise(resolve => { setTimeout(resolve, 0) })
  })
}

describe('TeamView legacy zero state', () => {
  it('replaces the zero state with the read-only legacy banner when the inspection reports a legacy team (UI §34.1)', async () => {
    const legacyInspect = vi.fn(() => Promise.resolve(okResponse(LEGACY_TEAM_DATA, 'legacy.inspect')))
    const props = viewProps({}, { creation: makeCreationFace(), legacyInspect })
    const view = render(<TeamView {...props} />)
    await vi.waitFor(() => {
      expect(view.container.querySelector('[data-legacy-banner]')).toBeTruthy()
    })
    expect(view.container.querySelector('[data-team-zero][data-legacy-zero="legacy-team"]')).toBeTruthy()
    expect(screen.getByText('This Session was created by the previous Team implementation.')).toBeTruthy()
    expect(screen.getByText('Team vNext will not resume or mutate it as a vNext Team.')).toBeTruthy()
    expect(screen.getByText('Historical Chat and Trajectory remain available.')).toBeTruthy()
    expect(view.container.querySelector('[data-legacy-summary]')?.textContent).toContain('Decoded legacy team summary (read-only)')
    expect(view.container.querySelector('[data-legacy-team-id]')?.textContent).toBe('legacy-team-9')
    expect(view.container.querySelector('[data-legacy-leader-session]')?.textContent).toBe('legacy-leader-s')
    expect(view.container.querySelector('[data-legacy-counts]')?.textContent).toBe('3 roster members · 2 scanned sessions')
    expect(view.container.querySelector('[data-legacy-roster-warning]')?.textContent).toBe('1')
    const rows = view.container.querySelectorAll('[data-legacy-roster-row]')
    expect(Array.from(rows).map(row => row.textContent)).toEqual(['Atlas (leader)', 'Scout (teammate)', 'anon.md'])
    // UI §34.3: NO executable entry in the legacy zero state.
    expect(view.container.querySelector('[data-intent-start-here]')).toBeNull()
    expect(view.container.querySelector('[data-team-creation-panel]')).toBeNull()
    // One-shot READ: no arguments; the only pull is the T7 cold-pull.
    expect(legacyInspect).toHaveBeenCalledTimes(1)
    expect(legacyInspect).toHaveBeenCalledWith()
    expect(props.ensureProjection).toHaveBeenCalledTimes(1)
    expect(props.ensureProjection).toHaveBeenCalledWith(OUTSIDER)
  })

  it('hides the team-id and leader-session rows for a roster-only legacy team (best-effort decode)', async () => {
    const legacyInspect = vi.fn(() => Promise.resolve(okResponse(ROSTER_ONLY_DATA, 'legacy.inspect')))
    const view = render(<TeamView {...viewProps({}, { creation: makeCreationFace(), legacyInspect })} />)
    await vi.waitFor(() => {
      expect(view.container.querySelector('[data-legacy-banner]')).toBeTruthy()
    })
    expect(view.container.querySelector('[data-legacy-zero="legacy-team"]')).toBeTruthy()
    expect(view.container.querySelector('[data-legacy-team-id]')).toBeNull()
    expect(view.container.querySelector('[data-legacy-leader-session]')).toBeNull()
    expect(view.container.querySelector('[data-legacy-counts]')?.textContent).toBe('1 roster members · 0 scanned sessions')
    expect(view.container.querySelector('[data-legacy-roster-warning]')).toBeNull()
    const rows = view.container.querySelectorAll('[data-legacy-roster-row]')
    expect(Array.from(rows).map(row => row.textContent)).toEqual(['Crew (teammate)'])
    expect(view.container.querySelector('[data-intent-start-here]')).toBeNull()
  })

  it('keeps the ordinary zero state for a native-fallback inspection (the session is not a legacy team)', async () => {
    const legacyInspect = vi.fn(() => Promise.resolve(okResponse(NATIVE_FALLBACK_DATA, 'legacy.inspect')))
    const props = viewProps({}, { creation: makeCreationFace(), legacyInspect })
    const view = render(<TeamView {...props} />)
    await settle()
    expect(view.container.querySelector('[data-team-zero]')).toBeTruthy()
    expect(view.container.querySelector('[data-legacy-zero]')).toBeNull()
    expect(view.container.querySelector('[data-legacy-note]')).toBeNull()
    expect(view.container.querySelector('[data-legacy-banner]')).toBeNull()
    expect(screen.getByText('This session is not part of a team')).toBeTruthy()
    expect(view.container.querySelector('[data-intent-start-here]')?.textContent).toBe('Start Team from Here')
    expect(props.ensureProjection).toHaveBeenCalledTimes(1)
  })

  it('keeps the ordinary zero state plus ONE verbatim note for a typed inspection failure (UI §38)', async () => {
    const legacyInspect = vi.fn(() => Promise.resolve(errorResponse('LEGACY_STORE_DOWN', 'legacy store down', 'legacy.inspect')))
    const view = render(<TeamView {...viewProps({}, { creation: makeCreationFace(), legacyInspect })} />)
    await settle()
    expect(view.container.querySelector('[data-team-zero]')).toBeTruthy()
    expect(view.container.querySelector('[data-legacy-zero]')).toBeNull()
    const notes = view.container.querySelectorAll('[data-legacy-note]')
    expect(notes.length).toBe(1)
    expect(notes[0]?.textContent).toBe('Legacy inspection failed: LEGACY_STORE_DOWN: legacy store down')
    expect(view.container.querySelector('[data-intent-start-here]')?.textContent).toBe('Start Team from Here')
  })

  it('keeps the ordinary zero state plus a local native-error note when the inspection channel is lost', async () => {
    const legacyInspect = vi.fn(() => Promise.reject(new Error('channel lost')))
    const view = render(<TeamView {...viewProps({}, { creation: makeCreationFace(), legacyInspect })} />)
    await settle()
    expect(view.container.querySelector('[data-team-zero]')).toBeTruthy()
    expect(view.container.querySelector('[data-legacy-zero]')).toBeNull()
    const notes = view.container.querySelectorAll('[data-legacy-note]')
    expect(notes.length).toBe(1)
    expect(notes[0]?.textContent).toBe('Legacy inspection failed: native-error: channel lost')
  })

  it('keeps the ordinary zero state plus a verbatim note for an unrecognized future status (never silently dropped)', async () => {
    const legacyInspect = vi.fn(() => Promise.resolve(okResponse(UNKNOWN_STATUS_DATA, 'legacy.inspect')))
    const view = render(<TeamView {...viewProps({}, { creation: makeCreationFace(), legacyInspect })} />)
    await settle()
    expect(view.container.querySelector('[data-team-zero]')).toBeTruthy()
    expect(view.container.querySelector('[data-legacy-zero]')).toBeNull()
    const notes = view.container.querySelectorAll('[data-legacy-note]')
    expect(notes.length).toBe(1)
    expect(notes[0]?.textContent).toBe('Legacy inspection failed: unrecognized status: {"status":"future-legacy","source":"roster-v2"}')
  })

  it('leaves the T7 zero state unchanged when the legacyInspect seam is absent (no legacy surface at all)', async () => {
    const props = viewProps({}, { creation: makeCreationFace() })
    const view = render(<TeamView {...props} />)
    await settle()
    expect(view.container.querySelector('[data-team-zero]')).toBeTruthy()
    expect(view.container.querySelector('[data-legacy-zero]')).toBeNull()
    expect(view.container.querySelector('[data-legacy-note]')).toBeNull()
    expect(view.container.querySelector('[data-legacy-banner]')).toBeNull()
    expect(screen.getByText('This session is not part of a team')).toBeTruthy()
    expect(view.container.querySelector('[data-intent-start-here]')?.textContent).toBe('Start Team from Here')
    expect(props.ensureProjection).toHaveBeenCalledTimes(1)
    expect(props.ensureProjection).toHaveBeenCalledWith(OUTSIDER)
  })

  it('renders the verbatim Chinese banner copy (UI §34.1)', async () => {
    const legacyInspect = vi.fn(() => Promise.resolve(okResponse(LEGACY_TEAM_DATA, 'legacy.inspect')))
    const view = render(<TeamView {...viewProps({}, { creation: makeCreationFace(), legacyInspect, t: makeTranslate(zh) })} />)
    await vi.waitFor(() => {
      expect(view.container.querySelector('[data-legacy-banner]')).toBeTruthy()
    })
    expect(screen.getByText('本会话由旧版 Team 实现创建。')).toBeTruthy()
    expect(screen.getByText('Team vNext 不会将其作为 vNext 团队恢复或变更。')).toBeTruthy()
    expect(screen.getByText('历史 Chat 与 Trajectory 仍可访问。')).toBeTruthy()
    expect(view.container.querySelector('[data-legacy-summary]')?.textContent).toContain('已解码的旧版团队摘要（只读）')
    expect(view.container.querySelector('[data-legacy-counts]')?.textContent).toBe('3 名花名册成员 · 2 个扫描会话')
  })
})
