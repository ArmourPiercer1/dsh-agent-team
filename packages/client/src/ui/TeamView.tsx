/**
 * Team conversation view entry: the "团队" tab (P9-T6 collapse). Every
 * section — zero state, timeline, members, activity, and the durable
 * ledger Events surface — resolves the current session through the vNext
 * projection path (the per-session projection mirror plus the per-team
 * ledger store), cold-pulled once when the mirror lacks the session (the
 * frames win), and renders the one-line zero state for every non-team
 * session. The compat mirror path (TeamMirror / `resolveTeamView` /
 * `ensureTeam` / `pageTeamMessages`) is folded away: the durable ledger is
 * the only event authority (plan §8.10 ADAPT), and the four sections are
 * the UI §12.1 fixed order — Timeline → Members → Activity → Events —
 * from ONE input.
 */
import { useEffect, useMemo, useState } from 'react'
import type { InjectFace, PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
// Type-only: the conversation.view slot declaration (declared by
// ui-conversation's session body) must be in the program for this props type.
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
import type { ObservableSnapshot } from '@deepseek-ai/dsh-client-store'
import type {
  RemoteCatalogGetParams,
  RemoteIntentProbeParams,
  RemoteResponse,
  RemoteTeamAdmitInitialWorkParams,
  RemoteTeamCreateParamsV2,
} from '../../../remote/src/index.js'
import type { TeamProjectionMirror } from '../state/team-session-resolution.js'
import {
  resolveTeamProjection, sameTeamProjectionResolution,
} from '../state/team-session-resolution.js'
import type { TeamLedgerState } from '../state/team-ledger-store.js'
import { adaptTeamProjection } from '../model/projection-adapter.js'
import { ledgerModelFromStoreState } from '../model/ledger-adapter.js'
import type { TeamOpenModeOutcome } from '../plugin/team-mount-core.js'
import type { TeamIntentDraft, TeamPresetRow } from '../model/team-intent-model.js'
import {
  emptyTeamIntentDraft, teamWorkspaceOptions,
} from '../model/team-intent-model.js'
import { TeamTimeline } from './TeamTimeline.js'
import { TeamMembers, type TeamMembersCommandFace } from './TeamMembers.js'
import { TeamActivity } from './TeamActivity.js'
import { TeamLedger } from './TeamLedger.js'
import {
  TeamCreationPanel,
  type TeamCreationHandoffFace,
} from './TeamCreationPanel.js'
import { TeamGovernance, type TeamGovernanceFace } from './TeamGovernance.js'
import {
  parseLegacyInspection,
  type LegacyInspectionWire,
} from '../model/team-legacy.js'
import styles from './TeamView.module.css'

/**
 * The S5-A New Team creation face (UI §3–§9): the frozen Remote catalog /
 * probe / create wrappers (raw RemoteResponse; parsing stays in the model
 * layer) plus the native seam members. Absent → the zero-state "Start
 * Team from Here" entry hides (the T6 projection-only view is unchanged).
 */
export interface TeamViewCreationFace {
  /** `catalog.list` (raw RemoteResponse). */
  readonly listCatalog: () => Promise<RemoteResponse>
  /** `catalog.get` (one blueprint at one revision). */
  readonly getCatalog: (params: RemoteCatalogGetParams) => Promise<RemoteResponse>
  /** `intent.probe` (the pre-creation compatibility probe). */
  readonly probeCompatibility: (params: RemoteIntentProbeParams) => Promise<RemoteResponse>
  /**
   * `team.create` (contract v2, TCM M4 / plan §15.6) — the workspace-
   * aware CREATE-ONLY creation (stamps contract version 2; the only
   * creation wrapper the new UI uses).
   */
  readonly teamCreateV2: (params: RemoteTeamCreateParamsV2) => Promise<RemoteResponse>
  /**
   * `team.admitInitialWork` (contract v2, v2-only method, TCM M4 / plan
   * §15.6) — the deferred creation-time initial work (stamps contract
   * version 2).
   */
  readonly teamAdmitInitialWorkV2: (params: RemoteTeamAdmitInitialWorkParams) => Promise<RemoteResponse>
  /**
   * The creation-path session open (D-3): opens the host-created root
   * session, re-pulling the host list once when the stream increment
   * lags the RPC (a bare `open` of an unknown id throws). Rejects when
   * the session is unknown even after the re-pull (the panel's typed
   * error lane).
   */
  readonly openCreatedSession: (sessionId: string) => Promise<void>
  /** The runtime preset rows (the S0 seam-6 mapping; broken rows filtered). */
  readonly listAgentPresets: () => Promise<readonly TeamPresetRow[]>
}

/**
 * One remote-safe row of the v3 `team.listRoots` response — the frozen
 * D1 wire shape (mirror of `packages/runtime/src/team-ownership-index.ts`
 * `TeamRootWireRow`; the client must not value-import the runtime
 * package, so the shape is mirrored locally):
 * `{ rootSessionId, blueprintId, revision, defaultWorkspace?, createdAt,
 * generation, memberCount }`.
 */
export interface TeamRootRowWire {
  readonly rootSessionId: string
  readonly blueprintId: string
  /** The blueprint revision of the snapshot binding (human-readable string). */
  readonly revision: string
  readonly defaultWorkspace?: string
  readonly createdAt: string
  readonly generation: number
  readonly memberCount: number
}

/**
 * D1 (Team D1-D6 repair v2, remote contract v3) — the persisted
 * root-identity face of the zero state: the durable roots query
 * (`team.listRoots`, contract v3) and the explicit Team-mode open
 * guarantee (`team.ensureRootLive`, contract v3 — INERT until D2: the
 * host handler is wired by D2, until then the call resolves to the typed
 * `TEAM_REMOTE_TEAM_ROOT_LIVE_NOT_IMPLEMENTED` failure, never a silent
 * success). Absent → the zero state shows no persisted-roots rows.
 * D1 renders the rows WITHOUT open actions (the open action is added by
 * D2/D3 over this same face).
 */
export interface TeamViewRootsFace {
  /** `team.listRoots` (contract v3; raw RemoteResponse). */
  readonly listRoots: () => Promise<RemoteResponse>
  /**
   * `team.ensureRootLive` (contract v3; raw RemoteResponse; INERT until
   * D2 — see the face doc).
   */
  readonly ensureRootLive: (teamSessionId: string) => Promise<RemoteResponse>
}

/**
 * Parse the v3 `team.listRoots` success value (`data.roots`) into the
 * frozen wire rows (defensive client-boundary parse — a malformed row
 * keeps the zero state with the typed-error note lane, never a throw).
 * @param data - the success `value.data` (`{ roots: [...] }`).
 * @returns the wire rows, or `null` when the value is malformed.
 */
export function parseTeamRootsList(data: unknown): readonly TeamRootRowWire[] | null {
  if (typeof data !== 'object' || data === null) return null
  const roots = (data as Record<string, unknown>)['roots']
  if (!Array.isArray(roots)) return null
  const rows: TeamRootRowWire[] = []
  for (const raw of roots) {
    if (typeof raw !== 'object' || raw === null) return null
    const row = raw as Record<string, unknown>
    if (
      typeof row['rootSessionId'] !== 'string' ||
      row['rootSessionId'] === '' ||
      typeof row['blueprintId'] !== 'string' ||
      row['blueprintId'] === '' ||
      typeof row['revision'] !== 'string' ||
      row['revision'] === '' ||
      typeof row['createdAt'] !== 'string' ||
      typeof row['generation'] !== 'number' ||
      typeof row['memberCount'] !== 'number' ||
      (row['defaultWorkspace'] !== undefined && typeof row['defaultWorkspace'] !== 'string')
    ) {
      return null
    }
    rows.push({
      rootSessionId: row['rootSessionId'],
      blueprintId: row['blueprintId'],
      revision: row['revision'],
      defaultWorkspace: row['defaultWorkspace'],
      createdAt: row['createdAt'],
      generation: row['generation'],
      memberCount: row['memberCount'],
    })
  }
  return rows
}

export interface TeamViewInjected {
  /** Bare mirror sources; the renderer binds them to the `use*` selector hooks. */
  hooks: {
    /** The per-session projection mirror (frame pushes + the cold-read landing). */
    projectionMirror: ObservableSnapshot<TeamProjectionMirror>
    /** The per-team durable-ledger store states (keyed by the TeamSession id). */
    teamLedgers: ObservableSnapshot<Readonly<Record<string, TeamLedgerState>>>
  }
  /** Cold-read the named session's team projection when the mirror lacks it (single-flight). */
  ensureProjection: (sessionId: string) => Promise<void>
  /**
   * D4-A1 (Team D1-D6 repair v2): the post-mutation projection refresh —
   * the existing generation-safe pull. The zero-state creation panel calls
   * it exactly once per terminal create/handoff success, targeting the
   * NEW team's id, so a UI-initiated team creation updates without F5.
   */
  pullProjection: (teamSessionId: string) => Promise<unknown>
  /** Re-request the team ledger's catch-up episode after a typed failure. */
  refreshTeamLedger: () => Promise<void>
  /** Switch the current session to the named member session (D9 navigation). */
  openSession: (sessionId: string) => void
  /** S5-A: the New Team creation face (absent → the zero-state entry hides). */
  creation?: TeamViewCreationFace
  /** S5-B: the member command face (absent → the members section stays display-only). */
  memberCommands?: TeamMembersCommandFace
  /** P9-T8 (S5-C): the governance face (absent → the governance section hides). */
  governance?: TeamGovernanceFace
  /**
   * P9-T8 (S5-D): the legacy Team inspection (the parameterless seam — the
   * `dshHome` closure is bound at the T9 mount; raw `RemoteResponse`).
   * Absent → the zero state is exactly the T7 surface.
   */
  legacyInspect?: () => Promise<RemoteResponse>
  /** P9-T8 (S5-D): the handoff face (absent → the panel has no handoff block). */
  handoff?: TeamCreationHandoffFace
  /**
   * D1 (Team D1-D6 repair v2, remote contract v3): the persisted
   * root-identity face (absent → the zero state shows no persisted-roots
   * rows; the T7/T8 zero state is unchanged).
   */
  roots?: TeamViewRootsFace
  /**
   * D2 (Team D1-D6 repair v2, D6): the explicit open-in-Team-mode entry
   * (the dedicated "以 Team 模式打开 / 回到 Leader" entry): the AWAITED
   * two-phase sequence — the v3 `team.ensureRootLive` guarantee (over the
   * `roots` face) MUST complete before the native session switch; a typed
   * ensure failure returns `{ ok: false, code, message }` WITHOUT opening
   * the session (never a silent open / adoption). Absent → the D1 surface
   * (no entry on the picker rows, no entry/badge on the leader row).
   */
  openTeamMode?: (rootSessionId: string) => Promise<TeamOpenModeOutcome>
  /**
   * D2 (D6): the per-root client-local open-mode read — `'team'` when this
   * client completed an openTeamMode for the root and still sits on it
   * (reset on every session switch away); `null` otherwise. The mode
   * badge source. Absent → no badge.
   */
  teamOpenMode?: (rootSessionId: string) => 'team' | null
}

/** Full team-view props: the view-slot runtime share, injected face, and locale seat. */
export type TeamViewProps =
  & PropsRuntime<'conversation.view'>
  & InjectFace<TeamViewInjected>
  & PropsLocale<'team'>

/**
 * The team tab body: the one-line zero state for a non-team session (or a
 * team session whose frame has not landed yet) — carrying the S5-A "Start
 * Team from Here" entry and New Team panel when the injected creation face
 * is present; otherwise the UI §12.1
 * four sections from one input — the timeline and the member groups, the
 * activity / progress rows from the snapshot's current-work face, and the
 * durable-ledger Events surface from the per-team ledger store — with the
 * current session's member lane and member group highlighted when the
 * session is a member's.
 * @param props - the framework session kit, the injected mirror hooks and
 *   cold-pull / retry / navigation callbacks, and the team dictionary.
 * @returns the view body.
 */
export function TeamView(props: TeamViewProps): React.JSX.Element {
  const {
    sessionId, useProjectionMirror, useTeamLedgers,
    ensureProjection, pullProjection, refreshTeamLedger, openSession,
    creation, memberCommands, governance, legacyInspect, handoff, roots,
    openTeamMode, teamOpenMode,
    useWorkspaces, t,
  } = props
  const [creationOpen, setCreationOpen] = useState(false)
  // UI §5.3: the intent draft is page-run UI state only (never authority) —
  // held here so the panel can open and close in the zero state without
  // losing the in-flight selection.
  const [intentDraft, setIntentDraft] = useState<TeamIntentDraft>(emptyTeamIntentDraft)
  const workspaceViews = useWorkspaces(s => s.items)
  const workspaceOptions = useMemo(() => teamWorkspaceOptions(workspaceViews), [workspaceViews])
  // R119 trial fix: the creation panel's handoff-prepare effect keys off the
  // `handoffSource` prop identity. An inline object literal here re-fired
  // `handoff.prepare` on EVERY TeamView re-render — including every
  // initial-work keystroke (draft update -> re-render) — clearing and
  // re-fetching the one-shot summary, which is what the trial surfaced as
  // the creation panel flickering/jumping while typing (plus a prepare-RPC
  // per keystroke). The memo keeps the identity stable across re-renders;
  // it still changes on the real inputs (session switch / workspace feed).
  const handoffSource = useMemo(
    () => ({
      sourceSessionId: sessionId,
      sourceWorkspaceId: workspaceViews?.find(
        item => item.sessionIds.includes(sessionId),
      )?.workspaceId ?? null,
    }),
    [sessionId, workspaceViews],
  )
  const resolution = useProjectionMirror(
    mirror => resolveTeamProjection(mirror, sessionId),
    sameTeamProjectionResolution,
  )
  useEffect(() => {
    // The tab mounts per session and one-at-a-time, so "mounted" IS "the
    // team UI needs the view": fill a mirror gap once, then let frames win.
    if (resolution === undefined) void ensureProjection(sessionId)
  }, [sessionId, resolution, ensureProjection])
  const snapshot = useMemo(
    () => (resolution === undefined
      ? null
      : adaptTeamProjection(resolution.team, resolution.perspective)),
    [resolution],
  )
  // P9-T8 (S5-D): the one-shot legacy inspection for the ZERO state (plan
  // §10.6, UI §34). It is a read, not a command flow — no projection pull;
  // it only decides WHICH zero state renders. Gated to the zero state and
  // skipped while the creation panel is open (the result is irrelevant
  // there). A typed failure keeps the ordinary zero state + ONE verbatim
  // note; `legacy-team` REPLACES the zero state with the read-only banner.
  const [legacy, setLegacy] = useState<
    | { readonly status: 'pending' }
    | { readonly status: 'ok'; readonly inspection: LegacyInspectionWire }
    | { readonly status: 'error'; readonly code: string; readonly message: string }
    | null
  >(null)
  const inZeroState = resolution === undefined || snapshot === null
  useEffect(() => {
    if (!inZeroState || legacyInspect === undefined || creationOpen) return
    let live = true
    setLegacy({ status: 'pending' })
    void legacyInspect().then(response => {
      if (!live) return
      if (!response.ok) {
        setLegacy({ status: 'error', code: response.error.code, message: response.error.message })
        return
      }
      setLegacy({ status: 'ok', inspection: parseLegacyInspection(response.value.data) })
    }).catch(error => {
      if (!live) return
      setLegacy({
        status: 'error',
        code: 'native-error',
        message: error instanceof Error ? error.message : String(error),
      })
    })
    return () => { live = false }
  }, [inZeroState, legacyInspect, creationOpen, sessionId])
  // D1 (Team D1-D6 repair v2, remote contract v3): the one-shot persisted
  // roots read for the ZERO state — the same read-not-command discipline
  // as the legacy inspection above (gated to the zero state, skipped while
  // the creation panel is open, one verbatim note on a typed failure).
  // The rows render WITHOUT open actions in D1 (D2/D3 add the open action
  // over this same face); the list is read-only here.
  const [teamRoots, setTeamRoots] = useState<
    | { readonly status: 'pending' }
    | { readonly status: 'ok'; readonly rows: readonly TeamRootRowWire[] }
    | { readonly status: 'error'; readonly code: string; readonly message: string }
    | null
  >(null)
  useEffect(() => {
    if (!inZeroState || roots === undefined || creationOpen) return
    let live = true
    setTeamRoots({ status: 'pending' })
    void roots.listRoots().then(response => {
      if (!live) return
      if (!response.ok) {
        setTeamRoots({ status: 'error', code: response.error.code, message: response.error.message })
        return
      }
      const rows = parseTeamRootsList(response.value.data)
      if (rows === null) {
        setTeamRoots({
          status: 'error',
          code: 'malformed-response',
          message: 'the team.listRoots response did not carry the closed roots list',
        })
        return
      }
      setTeamRoots({ status: 'ok', rows })
    }).catch(error => {
      if (!live) return
      setTeamRoots({
        status: 'error',
        code: 'native-error',
        message: error instanceof Error ? error.message : String(error),
      })
    })
    return () => { live = false }
  }, [inZeroState, roots, creationOpen, sessionId])
  // D2 (Team D1-D6 repair v2, D6): the in-flight explicit open per picker
  // row (root id → pending) and the last typed failure per row (ONE
  // verbatim note, the UI §38 greyed-surface discipline). Page-run UI
  // state only — the open-mode FACT stays in the mount (client-local).
  const [rootOpenTeamPending, setRootOpenTeamPending] = useState<Readonly<Record<string, boolean>>>({})
  const [rootOpenTeamErrors, setRootOpenTeamErrors] = useState<
    Readonly<Record<string, { readonly code: string; readonly message: string }>>
  >({})
  /** Run the row's explicit open-in-Team-mode entry through the face (the two-phase
   *  sequence lives in the mount; the row only triggers it and renders the
   *  settled typed failure when it comes back). */
  const runPickerOpenTeamMode = (rootSessionId: string): void => {
    const face = openTeamMode
    if (face === undefined) return
    setRootOpenTeamPending(prev => ({ ...prev, [rootSessionId]: true }))
    setRootOpenTeamErrors(prev => {
      const next = { ...prev }
      delete next[rootSessionId]
      return next
    })
    void face(rootSessionId).then(outcome => {
      if (!outcome.ok) {
        setRootOpenTeamErrors(prev => ({
          ...prev,
          [rootSessionId]: { code: outcome.code, message: outcome.message },
        }))
      }
    }).finally(() => {
      setRootOpenTeamPending(prev => {
        if (prev[rootSessionId] !== true) return prev
        const next = { ...prev }
        delete next[rootSessionId]
        return next
      })
    })
  }
  const ledgerState = useTeamLedgers(map => map[snapshot?.teamSessionId ?? ''])
  const ledger = useMemo(() => ledgerModelFromStoreState(ledgerState), [ledgerState])
  // D1 (Team D1-D6 repair v2, remote contract v3): the persisted-roots
  // zero-state share — the typed-failure note (ONE verbatim line, UI §38
  // greyed-surface discipline) + the read-only rows (blueprint@revision,
  // default workspace, member count, creation time, root id). D2 (D6)
  // adds the dedicated open-in-Team-mode entry over the SAME face: each
  // row gains the explicit "以 Team 模式打开 / 回到 Leader" button
  // (absent without the `openTeamMode` face — the D1 surface unchanged),
  // with a per-row pending mark + ONE verbatim typed error note. An empty
  // list renders nothing (the host has no persisted teams yet).
  const rootsNote =
    teamRoots !== null && teamRoots.status === 'error'
      ? t('view.roots.note', { message: `${teamRoots.code}: ${teamRoots.message}` })
      : null
  const rootsList =
    teamRoots !== null && teamRoots.status === 'ok' && teamRoots.rows.length > 0
      ? (
        <div className={styles.roots} data-team-roots>
          <h3 className={styles.rootsTitle}>{t('view.roots.title')}</h3>
          <ul className={styles.rootsList} data-team-roots-list>
            {teamRoots.rows.map(row => {
              const rowError = rootOpenTeamErrors[row.rootSessionId]
              return (
                <li
                  key={row.rootSessionId}
                  className={styles.rootRow}
                  data-team-root-row
                  data-root-session-id={row.rootSessionId}
                >
                  <span className={styles.rootId} data-root-id>{row.rootSessionId}</span>
                  <span data-root-blueprint>{`${row.blueprintId}@${row.revision}`}</span>
                  <span data-root-workspace>
                    {row.defaultWorkspace ?? t('view.roots.noWorkspace')}
                  </span>
                  <span data-root-members>
                    {t('view.roots.members', { count: String(row.memberCount) })}
                  </span>
                  <span data-root-created title={row.createdAt}>{row.createdAt}</span>
                  {/* D2 (D6): the dedicated open-in-Team-mode entry — the
                      face-only trigger (the AWAITED two-phase sequence lives
                      in the mount); ABSENT without the face (the D1 surface
                      is unchanged). */}
                  {openTeamMode !== undefined
                    ? (
                      <button
                        type="button"
                        className={styles.rootRowOpen}
                        data-team-mode-open-root={row.rootSessionId}
                        disabled={rootOpenTeamPending[row.rootSessionId] === true || undefined}
                        onClick={() => { runPickerOpenTeamMode(row.rootSessionId) }}
                      >
                        {t('view.members.openTeamMode')}
                      </button>
                    )
                    : null}
                  {rowError !== undefined
                    ? (
                      <div className={styles.legacyNote} data-team-mode-open-error>
                        {t('view.members.openMode.error', {
                          code: rowError.code,
                          message: rowError.message,
                        })}
                      </div>
                    )
                    : null}
                </li>
              )
            })}
          </ul>
        </div>
      )
      : null
  if (resolution === undefined || snapshot === null) {
    if (creation === undefined) {
      return (
        <div className={styles.zero} data-team-zero>
          <div className={styles.zeroInner}>
            <p className={styles.zeroText}>{t('view.zero')}</p>
            {rootsNote !== null && (
              <p className={styles.legacyNote} data-roots-note>{rootsNote}</p>
            )}
            {rootsList}
          </div>
        </div>
      )
    }
    // P9-T8 (S5-D, UI §34.1): a decoded `legacy-team` inspection REPLACES
    // the ordinary zero state with the persistent read-only banner — NO
    // Start-Team entry (§34.3 forbidden executable list: no Resume Team /
    // Restore Member / Create Member / Change PolicyState / Edit Team
    // override / Continue legacy Team mutation / Upgrade in place).
    if (legacy !== null && legacy.status === 'ok' && legacy.inspection.status === 'legacy-team') {
      const inspection = legacy.inspection
      return (
        <div className={styles.zero} data-team-zero data-legacy-zero="legacy-team">
          <div className={styles.legacyBanner} data-legacy-banner>
            <p>{t('legacy.banner.line1')}</p>
            <p>{t('legacy.banner.line2')}</p>
            <p>{t('legacy.banner.line3')}</p>
          </div>
          <div className={styles.legacySummary} data-legacy-summary>
            <h3 className={styles.legacySummaryTitle}>{t('legacy.summary')}</h3>
            {inspection.teamId !== null && (
              <p data-legacy-team-id>{inspection.teamId}</p>
            )}
            {inspection.leaderSessionId !== null && (
              <p data-legacy-leader-session>{inspection.leaderSessionId}</p>
            )}
            <p data-legacy-counts>
              {t('legacy.counts', {
                roster: String(inspection.roster.length),
                sessions: String(inspection.sessionCount),
              })}
            </p>
            {inspection.rosterWarningCount > 0 && (
              <p data-legacy-roster-warning>{String(inspection.rosterWarningCount)}</p>
            )}
            {inspection.roster.length > 0 && (
              <ul data-legacy-roster>
                {inspection.roster.map((row, index) => (
                  <li
                    key={`${row.source}:${row.fileName}:${String(index)}`}
                    data-legacy-roster-row
                  >
                    {row.name ?? row.id ?? row.fileName}
                    {row.role !== null ? ` (${row.role})` : ''}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )
    }
    // UI §3: a non-team session (or an unlanded team frame) offers the New
    // Team entry; the panel replaces the entry while open, and the intent
    // draft persists in view state across open/close. The inspection
    // failure / unrecognized status keeps this zero state + ONE verbatim
    // note (UI §38: a greyed surface must state its reason).
    const legacyNote =
      legacy !== null && legacy.status === 'error'
        ? t('legacy.inspectError', { message: `${legacy.code}: ${legacy.message}` })
        : legacy !== null && legacy.status === 'ok' &&
            legacy.inspection.status === 'unknown'
          ? t('legacy.inspectError', {
              message: `unrecognized status: ${JSON.stringify(legacy.inspection.raw)}`,
            })
          : null
    return (
      <div className={styles.zero} data-team-zero>
        <div className={styles.zeroInner}>
          <p className={styles.zeroText}>{t('view.zero')}</p>
          {legacyNote !== null && (
            <p className={styles.legacyNote} data-legacy-note>{legacyNote}</p>
          )}
          {rootsNote !== null && (
            <p className={styles.legacyNote} data-roots-note>{rootsNote}</p>
          )}
          {rootsList}
          {creationOpen
            ? <TeamCreationPanel
                listCatalog={creation.listCatalog}
                getCatalog={creation.getCatalog}
                probeCompatibility={creation.probeCompatibility}
                teamCreateV2={creation.teamCreateV2}
                teamAdmitInitialWorkV2={creation.teamAdmitInitialWorkV2}
                openCreatedSession={creation.openCreatedSession}
                onCreated={() => setCreationOpen(false)}
                pullProjection={pullProjection}
                listAgentPresets={creation.listAgentPresets}
                workspaces={workspaceOptions}
                handoffSource={handoffSource}
                handoffFace={handoff}
                draft={intentDraft}
                onDraftChange={setIntentDraft}
                onCancel={() => setCreationOpen(false)}
                t={t}
              />
            : (
              <button
                type="button"
                className={styles.zeroStart}
                data-intent-start-here
                onClick={() => setCreationOpen(true)}
              >
                {t('intent.startHere')}
              </button>
            )}
        </div>
      </div>
    )
  }
  const currentInstanceId = resolution.perspective.kind === 'member-child'
    ? resolution.perspective.memberInstanceId
    : undefined
  return (
    <div className={styles.body} data-team-view>
      <section className={styles.section} data-team-section="timeline">
        <h3 className={styles.sectionTitle}>{t('view.timeline.title')}</h3>
        <TeamTimeline
          snapshot={snapshot}
          ledger={ledger}
          currentInstanceId={currentInstanceId}
          onSelectSession={openSession}
          t={t}
        />
      </section>
      <section className={styles.section} data-team-section="members">
        <h3 className={styles.sectionTitle}>{t('view.members.title')}</h3>
        <TeamMembers
          snapshot={snapshot}
          ledger={ledger}
          currentSessionId={sessionId}
          onSelectSession={openSession}
          memberCommands={memberCommands}
          openTeamMode={openTeamMode}
          teamOpenMode={teamOpenMode}
          workspaces={workspaceOptions}
          t={t}
        />
      </section>
      {governance !== undefined && (
        <section className={styles.section} data-team-section="governance">
          <h3 className={styles.sectionTitle}>{t('governance.title')}</h3>
          <TeamGovernance snapshot={snapshot} governance={governance} t={t} />
        </section>
      )}
      <section className={styles.section} data-team-section="activity">
        <h3 className={styles.sectionTitle}>{t('view.activity.title')}</h3>
        <TeamActivity activity={snapshot.activity} t={t} />
      </section>
      <section className={styles.section} data-team-section="ledger">
        <h3 className={styles.sectionTitle}>{t('view.ledger.title')}</h3>
        <TeamLedger
          snapshot={snapshot}
          ledger={ledger}
          ledgerState={ledgerState}
          onRetry={refreshTeamLedger}
          onSelectSession={openSession}
          t={t}
        />
      </section>
    </div>
  )
}
