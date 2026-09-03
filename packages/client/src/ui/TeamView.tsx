/**
 * Team conversation view entry: the "团队" tab. Transitional dual path (the
 * T5/T6 split): the zero state, the task board, and the event stream resolve
 * the current session through the frozen team-ness derivation (leader key or
 * member binding in the leader-keyed mirror), cold-pulled when the mirror
 * lacks the session, and render the one-line zero state for every non-team
 * session; the interval timeline and the member groups read the vNext
 * projection path (the per-session projection mirror plus the per-team
 * ledger store), cold-pulled the same way, and appear once the snapshot is
 * ready. T6 folds the compat path away and the sections onto one input.
 */
import { useEffect, useMemo } from 'react'
import type { InjectFace, PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
// Type-only: the conversation.view slot declaration (declared by
// ui-conversation's session body) must be in the program for this props type.
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
import type {
  MessageAnchor, ObservableSnapshot, RpcResult, SessionId, TeamMessagePage, TeamMirror,
} from '../model/team-view-compat.js'
import { resolveTeamView } from '../model/team-view-compat.js'
import type { TeamProjectionMirror } from '../state/team-session-resolution.js'
import {
  resolveTeamProjection, sameTeamProjectionResolution,
} from '../state/team-session-resolution.js'
import type { TeamLedgerState } from '../state/team-ledger-store.js'
import { adaptTeamProjection } from '../model/projection-adapter.js'
import { ledgerModelFromStoreState } from '../model/ledger-adapter.js'
import { TeamTimeline } from './TeamTimeline.js'
import { TeamMembers } from './TeamMembers.js'
import { TeamTasks } from './TeamTasks.js'
import { TeamFeed } from './TeamFeed.js'
import styles from './TeamView.module.css'

/**
 * Injected share of the team view entry. `useTeamMirror` (bound from the
 * hooks compartment) selects over the leader-keyed mirror record,
 * `useProjectionMirror` over the per-session projection mirror, and
 * `useTeamLedgers` over the per-team ledger-store record — all read-only by
 * construction; the legacy cold pull rides the `ensureTeam` callback, the
 * vNext cold pull rides `ensureProjection`, the event-stream wire page rides
 * `pageTeamMessages`, and the D9 session switch rides `openSession`. Until
 * T6 folds the compat path, the zero state, the task board, and the event
 * stream read the mirror path while the timeline and member sections read
 * the projection path.
 */
export interface TeamViewInjected {
  /** Bare mirror sources; the renderer binds them to the `use*` selector hooks. */
  hooks: {
    teamMirror: ObservableSnapshot<TeamMirror>
    projectionMirror: ObservableSnapshot<TeamProjectionMirror>
    teamLedgers: ObservableSnapshot<Readonly<Record<string, TeamLedgerState>>>
  }
  /** Cold-read the named session's team view when the mirror lacks it (single-flight). */
  ensureTeam: (sessionId: SessionId) => Promise<void>
  /** Cold-read the named session's team projection when the mirror lacks it (single-flight). */
  ensureProjection: (sessionId: string) => Promise<void>
  /**
   * Page-read the leader's member messages strictly earlier than the anchor
   * (the sessions team face's pagination entry; the page never enters the
   * mirror).
   */
  pageTeamMessages: (
    leaderSessionId: string,
    anchor: MessageAnchor,
    limit?: number,
  ) => Promise<RpcResult<TeamMessagePage>>
  /** Switch the current session to the named member session (D9 navigation). */
  openSession: (sessionId: string) => void
}

/** Full team-view props: the view-slot runtime share, injected face, and locale seat. */
export type TeamViewProps =
  & PropsRuntime<'conversation.view'>
  & InjectFace<TeamViewInjected>
  & PropsLocale<'team'>

/**
 * The team tab body: zero state for a non-team session; otherwise the task
 * board and the event stream from the mirror path, plus the interval
 * timeline and the member groups from the projection path once the snapshot
 * is ready (transitional dual path — T6 folds the sections onto one input),
 * with the current session's member lane and member group highlighted when
 * the session is a member's.
 * @param props - the framework session kit, the injected mirror hooks and
 *   cold-pull/navigation callbacks, and the team dictionary.
 * @returns the view body.
 */
export function TeamView(props: TeamViewProps): React.JSX.Element {
  const {
    sessionId, useTeamMirror, useProjectionMirror, useTeamLedgers,
    ensureTeam, ensureProjection, pageTeamMessages, openSession, t,
  } = props
  const team = useTeamMirror(mirror => resolveTeamView(mirror, sessionId))
  useEffect(() => {
    // The tab mounts per session and one-at-a-time, so "mounted" IS "the
    // team UI needs the view": fill a mirror gap once, then let frames win.
    if (team === undefined) void ensureTeam(sessionId)
  }, [sessionId, team, ensureTeam])
  const resolution = useProjectionMirror(
    mirror => resolveTeamProjection(mirror, sessionId),
    sameTeamProjectionResolution,
  )
  useEffect(() => {
    // Same one-at-a-time mount rule on the projection path: fill a gap once,
    // then let frames win (the sections appear when the snapshot lands).
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
  if (team === undefined) {
    return <div className={styles.zero} data-team-zero>{t('view.zero')}</div>
  }
  const currentInstanceId = resolution?.perspective.kind === 'member-child'
    ? resolution.perspective.memberInstanceId
    : undefined
  return (
    <div className={styles.body} data-team-view>
      {snapshot !== null && (
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
      )}
      {snapshot !== null && (
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
      )}
      <section className={styles.section} data-team-section="tasks">
        <h3 className={styles.sectionTitle}>{t('view.tasks.title')}</h3>
        <TeamTasks view={team} t={t} />
      </section>
      <section className={styles.section} data-team-section="events">
        <h3 className={styles.sectionTitle}>{t('view.events.title')}</h3>
        <TeamFeed
          view={team}
          pageMessages={pageTeamMessages}
          onSelectSession={openSession}
          t={t}
        />
      </section>
    </div>
  )
}
