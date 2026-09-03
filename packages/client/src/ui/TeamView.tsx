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
  RemoteTeamCreateParams,
} from '../../../remote/src/index.js'
import type { TeamProjectionMirror } from '../state/team-session-resolution.js'
import {
  resolveTeamProjection, sameTeamProjectionResolution,
} from '../state/team-session-resolution.js'
import type { TeamLedgerState } from '../state/team-ledger-store.js'
import { adaptTeamProjection } from '../model/projection-adapter.js'
import { ledgerModelFromStoreState } from '../model/ledger-adapter.js'
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
  type TeamCreationHandoffSource,
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
  /** `team.create` (binds the TeamSession on the named root). */
  readonly teamCreate: (params: RemoteTeamCreateParams) => Promise<RemoteResponse>
  /** Native root-session creation (the public `ISessions.create`). */
  readonly createRootSession: (opts?: { readonly workspaceId?: string }) => Promise<string>
  /** The runtime preset rows (the S0 seam-6 mapping; broken rows filtered). */
  readonly listAgentPresets: () => Promise<readonly TeamPresetRow[]>
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
    ensureProjection, refreshTeamLedger, openSession,
    creation, memberCommands, governance, legacyInspect, handoff,
    useWorkspaces, t,
  } = props
  const [creationOpen, setCreationOpen] = useState(false)
  // UI §5.3: the intent draft is page-run UI state only (never authority) —
  // held here so the panel can open and close in the zero state without
  // losing the in-flight selection.
  const [intentDraft, setIntentDraft] = useState<TeamIntentDraft>(emptyTeamIntentDraft)
  const workspaceViews = useWorkspaces(s => s.items)
  const workspaceOptions = useMemo(() => teamWorkspaceOptions(workspaceViews), [workspaceViews])
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
  const ledgerState = useTeamLedgers(map => map[snapshot?.teamSessionId ?? ''])
  const ledger = useMemo(() => ledgerModelFromStoreState(ledgerState), [ledgerState])
  if (resolution === undefined || snapshot === null) {
    if (creation === undefined) {
      return <div className={styles.zero} data-team-zero>{t('view.zero')}</div>
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
          {creationOpen
            ? <TeamCreationPanel
                listCatalog={creation.listCatalog}
                getCatalog={creation.getCatalog}
                probeCompatibility={creation.probeCompatibility}
                teamCreate={creation.teamCreate}
                createRootSession={creation.createRootSession}
                listAgentPresets={creation.listAgentPresets}
                openSession={openSession}
                workspaces={workspaceOptions}
                handoffSource={{
                  sourceSessionId: sessionId,
                  sourceWorkspaceId: workspaceViews.find(
                    item => item.sessionIds.includes(sessionId),
                  )?.workspaceId ?? null,
                }}
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
