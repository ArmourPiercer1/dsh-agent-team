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
import { useEffect, useMemo } from 'react'
import type { InjectFace, PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
// Type-only: the conversation.view slot declaration (declared by
// ui-conversation's session body) must be in the program for this props type.
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
import type { ObservableSnapshot } from '@deepseek-ai/dsh-client-store'
import type { TeamProjectionMirror } from '../state/team-session-resolution.js'
import {
  resolveTeamProjection, sameTeamProjectionResolution,
} from '../state/team-session-resolution.js'
import type { TeamLedgerState } from '../state/team-ledger-store.js'
import { adaptTeamProjection } from '../model/projection-adapter.js'
import { ledgerModelFromStoreState } from '../model/ledger-adapter.js'
import { TeamTimeline } from './TeamTimeline.js'
import { TeamMembers } from './TeamMembers.js'
import { TeamActivity } from './TeamActivity.js'
import { TeamLedger } from './TeamLedger.js'
import styles from './TeamView.module.css'

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
}

/** Full team-view props: the view-slot runtime share, injected face, and locale seat. */
export type TeamViewProps =
  & PropsRuntime<'conversation.view'>
  & InjectFace<TeamViewInjected>
  & PropsLocale<'team'>

/**
 * The team tab body: the one-line zero state for a non-team session (or a
 * team session whose frame has not landed yet); otherwise the UI §12.1
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
    ensureProjection, refreshTeamLedger, openSession, t,
  } = props
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
  const ledgerState = useTeamLedgers(map => map[snapshot?.teamSessionId ?? ''])
  const ledger = useMemo(() => ledgerModelFromStoreState(ledgerState), [ledgerState])
  if (resolution === undefined || snapshot === null) {
    return <div className={styles.zero} data-team-zero>{t('view.zero')}</div>
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
          t={t}
        />
      </section>
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
