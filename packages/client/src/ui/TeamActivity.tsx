/**
 * The "团队" tab's Activity / Progress section (P9-T6, plan §8.11 ADAPT,
 * UI §25): one row per snapshot current-work row — the state dot plus
 * subject, status label, assignee label, and optional summary. The legacy
 * task-board row layout is reused verbatim (the `TeamActivity.module.css`
 * ex `TeamTasks.module.css`, the row anatomy, the non-interactive rows —
 * D9 names no click-to-switch for activity rows, so there is no session
 * target to open) while the input model is rewritten from the compat
 * `TeamView['tasks']` (the projection's folded tasks) to the vNext
 * snapshot's `activity` face (the §7.4 current-work rows: per-instance
 * status / subject / summary / currentAction, the adapter's resolution).
 * Display only — NOT workflow authority (UI §25).
 */
import type { PropsLocale } from '@deepseek-ai/dsh-client-ui-slots'
import { StateDot, type StateDotState } from '@deepseek-ai/dsh-client-ui-primitives'
import type { ProgressValue } from '../../../contracts/src/index.js'
import type { TeamUiCurrentWorkRow } from '../model/team-ui-snapshot.js'
import type { TeamKey } from './locales.js'
import styles from './TeamActivity.module.css'

/** The Activity section props: the snapshot's current-work rows and the team dictionary. */
export interface TeamActivityProps {
  /** The snapshot's current-work rows (the §7.4 activity face; empty when no member reports one). */
  readonly activity: readonly TeamUiCurrentWorkRow[]
  /** The team dictionary translate seat. */
  readonly t: PropsLocale<'team'>['t']
}

/** The frozen progress-value label keys (the contracts `ProgressValue` closed set). */
const STATUS_KEYS: Readonly<Record<ProgressValue, TeamKey>> = {
  'in-progress': 'view.activity.in_progress',
  'completed': 'view.activity.completed',
  'blocked': 'view.activity.blocked',
}

/**
 * Map a current-work status onto the StateDot states (UI §25 status dot):
 * in-progress blue, completed green, blocked red, and an ABSENT status
 * reads as ongoing (the row exists only because some work fact named the
 * instance — no status is never an error).
 * @param status - the frozen progress value, or `undefined` when the row carries none.
 * @returns the dot state.
 */
function rowDot(status: ProgressValue | undefined): StateDotState {
  switch (status) {
    case 'completed': return 'done'
    case 'blocked': return 'error'
    case 'in-progress': return 'ongoing'
    case undefined: return 'ongoing'
  }
}

/**
 * The Activity / Progress section: the snapshot's current-work rows in
 * roster order, one non-interactive row each.
 * @param props - the current-work rows and the team dictionary.
 * @returns the Activity section.
 */
export function TeamActivity({ activity, t }: TeamActivityProps): React.JSX.Element {
  return (
    <div className={styles.root} data-team-activity>
      {activity.length === 0
        ? <span className={styles.empty} data-activity-empty>{t('view.activity.empty')}</span>
        : activity.map(row => {
          // The row's subject line: the durable subject, falling back
          // through the adapter's presentation fields to the instance label.
          const subject = row.subject ?? row.currentAction ?? row.summary ?? row.label
          return (
            <div key={row.instanceId} className={styles.taskRow} data-activity-row data-activity-status={row.status}>
              <span className={styles.dotSlot} aria-hidden="true">
                <StateDot state={rowDot(row.status)} />
              </span>
              <div className={styles.taskMain}>
                <div className={styles.taskLine}>
                  <span className={styles.taskSubject} data-activity-subject>{subject}</span>
                  {row.status !== undefined
                    ? <span className={styles.taskStatus} data-activity-status-text>{t(STATUS_KEYS[row.status])}</span>
                    : null}
                </div>
                <div className={styles.taskAssignee} data-activity-member>
                  {t('view.activity.member', { member: row.label })}
                </div>
                {row.summary !== undefined
                  ? <div className={styles.taskSummary} data-activity-summary>{row.summary}</div>
                  : null}
              </div>
            </div>
          )
        })}
    </div>
  )
}
