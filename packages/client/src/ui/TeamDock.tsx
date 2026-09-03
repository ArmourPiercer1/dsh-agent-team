/**
 * The resident team dock bar above the input (D11–D13): the thin collapsed
 * readout `团队 · N 运行中 · M 待裁决` (zero-count segments omitted, D12/D23)
 * plus the expandable compact member status rows (name + state dot) and
 * current-work activity rows, all read straight from the team projection
 * (D20). The entry renders only for a team session — the frozen
 * resolveTeamProjection test, the tab's same criterion — and cold-fills a
 * projection-mirror gap through `ensureProjection` like the tab. The jump
 * entry activates the "团队" view tab (D13) and the chevron toggles the
 * expansion.
 *
 * P9-T5 (S3-C) mechanical adaptation (plan §8.6): the dock reads the vNext
 * projection mirror + normalized snapshot instead of the leader-keyed view
 * mirror; N comes from the projection lifecycle (never the session log), M
 * from the frozen team-wide ledger summary (never a per-row sum), and the
 * compact task rows become the snapshot's current-work activity rows.
 */
import { useEffect, useId, useMemo, useState } from 'react'
import type { ObservableSnapshot } from '@deepseek-ai/dsh-client-store'
import type { InjectFace, PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
// Type-only: the conversation.input.dock slot declaration (declared by
// ui-conversation's root entry) must be in the program for this props type.
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
import {
  resolveTeamProjection, sameTeamProjectionResolution,
  type TeamProjectionMirror,
} from '../state/team-session-resolution.js'
import { adaptTeamProjection } from '../model/projection-adapter.js'
import type { TeamUiSnapshot } from '../model/team-ui-snapshot.js'
import {
  IconChevronDownOutline14, IconChevronUpOutline14, StateDot, type StateDotState,
} from '@deepseek-ai/dsh-client-ui-primitives'
import {
  deriveTeamDockContent, deriveTeamDockCounts,
  type TeamDockActivityRow, type TeamDockMemberRow,
} from '../model/team-dock-model.js'
import type { TeamKey } from './locales.js'
import styles from './TeamDock.module.css'

/** Injected share of the team dock entry. */
export interface TeamDockInjected {
  /** Bare projection-mirror source; the renderer binds it to the `useProjectionMirror` selector hook. */
  hooks: { projectionMirror: ObservableSnapshot<TeamProjectionMirror> }
  /** Cold-read the named session's team projection when the mirror lacks it (single-flight; the host resolves the session to its team). */
  ensureProjection: (sessionId: string) => Promise<void>
  /** Activate the current session's "团队" view tab (D13). */
  openTeamTab: () => void
}

/** Full team-dock props: the input-dock runtime share, injected face, and locale seat. */
export type TeamDockProps =
  & PropsRuntime<'conversation.input.dock'>
  & InjectFace<TeamDockInjected>
  & PropsLocale<'team'>

/** Presentational dock props: the normalized snapshot, the tab-jump callback, and the team dictionary. */
export interface TeamDockPanelProps {
  /** The normalized team snapshot (the projection side of the §7.1 pair). */
  snapshot: TeamUiSnapshot
  /** Activate the current session's "团队" view tab (D13). */
  openTeamTab: () => void
  /** The team dictionary translate seat. */
  t: PropsLocale<'team'>['t']
}

const MEMBER_STATUS_KEYS = {
  created: 'view.members.created',
  running: 'view.members.running',
  settled: 'view.members.settled',
  archived: 'view.members.archived',
  disposed: 'view.members.disposed',
} as const satisfies Record<TeamDockMemberRow['status'], TeamKey>

/**
 * The activity status reuses the Activity section's progress vocabulary
 * keys (the values are the same frozen ProgressValues the Activity rows
 * render; the hyphenated wire value maps onto the underscore key).
 */
const ACTIVITY_STATUS_KEYS = {
  'in-progress': 'view.activity.in_progress',
  completed: 'view.activity.completed',
  blocked: 'view.activity.blocked',
} as const satisfies Record<NonNullable<TeamDockActivityRow['status']>, TeamKey>

/**
 * Map a member display status onto the StateDot states.
 * Provisional T5 mapping (T6 may refine lifecycle colors): created: amber,
 * running: blue, settled/archived/disposed: green (terminal states).
 * @param status - the member row's display status.
 * @returns the dot state.
 */
function memberDot(status: TeamDockMemberRow['status']): StateDotState {
  switch (status) {
    case 'created': return 'warning'
    case 'running': return 'ongoing'
    case 'settled': return 'done'
    case 'archived': return 'done'
    case 'disposed': return 'done'
  }
}

/**
 * Map an activity status onto the StateDot states.
 * @param status - the activity row's progress status.
 * @returns the dot state (in progress: blue, completed: green, blocked: red).
 */
function activityDot(status: NonNullable<TeamDockActivityRow['status']>): StateDotState {
  switch (status) {
    case 'in-progress': return 'ongoing'
    case 'completed': return 'done'
    case 'blocked': return 'error'
  }
}

/**
 * The presentational dock bar (D11/D12): the collapsed one-line readout
 * (zero-count segments omitted) and the expandable compact member status and
 * activity rows. The jump entry activates the team tab (D13); the chevron
 * toggles the expansion.
 * @param props - the normalized snapshot, the tab-jump callback, and the team dictionary.
 * @returns the dock bar.
 */
export function TeamDockPanel({ snapshot, openTeamTab, t }: TeamDockPanelProps): React.JSX.Element {
  const [collapsed, setCollapsed] = useState(true)
  const bodyId = useId()
  const counts = deriveTeamDockCounts(snapshot)
  const content = deriveTeamDockContent(snapshot)
  // En spaces (U+2002): HTML collapses runs of ASCII spaces, so widening the
  // separator breathing room needs a literal wide space (the todo strip's
  // same pattern). D12 format `团队 · N 运行中 · M 待裁决`: zero-count
  // segments are omitted with the separator that would dangle; the leading
  // separator after the title renders only while some segment remains.
  const readout = [
    ...counts.runningSessions > 0 ? [t('dock.running', { count: counts.runningSessions })] : [],
    ...counts.pendingControls > 0 ? [t('dock.pending', { count: counts.pendingControls })] : [],
  ].join('\u2002·\u2002')
  return (
    <section className={styles.root} data-team-dock aria-label={t('dock.title')}>
      <div className={styles.row}>
        {/* No aria-label: the accessible name derives from the content, so
            the D12 resident readout stays exposed to assistive tech (the
            todo-strip header's same posture); the title carries the jump
            intent for mouse users. */}
        <button
          type="button"
          className={styles.jump}
          data-team-dock-jump
          title={t('dock.jump')}
          onClick={() => { openTeamTab() }}
        >
          <span className={styles.title} data-dock-title>{t('dock.title')}</span>
          {readout !== '' && (
            <>
              <span className={styles.sep} data-dock-sep aria-hidden="true">{'\u2002·\u2002'}</span>
              <span className={styles.readout} data-dock-readout>{readout}</span>
            </>
          )}
        </button>
        <button
          type="button"
          className={styles.chevron}
          data-team-dock-toggle
          aria-expanded={!collapsed}
          aria-controls={collapsed ? undefined : bodyId}
          aria-label={collapsed ? t('dock.expand') : t('dock.collapse')}
          onClick={() => { setCollapsed(value => !value) }}
        >
          {collapsed ? <IconChevronUpOutline14 /> : <IconChevronDownOutline14 />}
        </button>
      </div>
      {!collapsed && (
        <div id={bodyId} className={styles.expanded} data-team-dock-expanded>
          <ul className={styles.members}>
            {content.members.length === 0
              ? <li className={styles.empty} data-dock-members-empty>{t('dock.members.empty')}</li>
              : content.members.map(member => (
                <li
                  key={member.key}
                  className={styles.member}
                  data-dock-member
                  data-member-status={member.status}
                  aria-label={`${member.name} ${t(MEMBER_STATUS_KEYS[member.status])}`}
                >
                  <span className={styles.dotSlot} aria-hidden="true">
                    <StateDot state={memberDot(member.status)} />
                  </span>
                  <span className={styles.name}>{member.name}</span>
                </li>
              ))}
          </ul>
          <ul className={styles.tasks}>
            {content.activities.length === 0
              ? <li className={styles.empty} data-dock-activities-empty>{t('dock.activities.empty')}</li>
              : content.activities.map(activity => (
                <li
                  key={activity.key}
                  className={styles.task}
                  data-dock-activity
                  data-activity-status={activity.status ?? 'none'}
                  aria-label={`${activity.label}${activity.status !== undefined ? ` ${t(ACTIVITY_STATUS_KEYS[activity.status])}` : ''}`}
                >
                  {activity.status !== undefined && (
                    <span className={styles.dotSlot} aria-hidden="true">
                      <StateDot state={activityDot(activity.status)} />
                    </span>
                  )}
                  {activity.subject !== undefined && <span className={styles.subject}>{activity.subject}</span>}
                  {activity.status !== undefined && (
                    <span className={styles.taskStatus}>{t(ACTIVITY_STATUS_KEYS[activity.status])}</span>
                  )}
                </li>
              ))}
          </ul>
        </div>
      )}
    </section>
  )
}

/**
 * The dock entry adapter: resolves the current session's team projection
 * through the frozen team-ness test (the tab's same criterion — the
 * mirror's presence), cold-fills a mirror gap through `ensureProjection`,
 * renders nothing for a non-team session, and hands the normalized
 * snapshot to the presentational panel.
 * @param props - the framework session kit, the injected mirror hook and
 *   cold-pull/jump callbacks, and the team dictionary.
 * @returns the dock bar, or nothing for a non-team session.
 */
export function TeamDock({
  sessionId, useProjectionMirror, ensureProjection, openTeamTab, t,
}: TeamDockProps): React.JSX.Element | null {
  const resolution = useProjectionMirror(
    mirror => resolveTeamProjection(mirror, sessionId),
    sameTeamProjectionResolution,
  )
  useEffect(() => {
    // The dock mounts with every session, so a resolution gap means the
    // team projection is still unknown for this session: fill it once,
    // then let frames win.
    if (resolution === undefined) void ensureProjection(sessionId)
  }, [sessionId, resolution, ensureProjection])
  const snapshot = useMemo(
    () => (resolution === undefined ? null : adaptTeamProjection(resolution.team, resolution.perspective)),
    [resolution],
  )
  if (snapshot === null) return null
  return <TeamDockPanel snapshot={snapshot} openTeamTab={openTeamTab} t={t} />
}
