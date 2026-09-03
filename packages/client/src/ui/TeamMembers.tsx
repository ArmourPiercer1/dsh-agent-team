/**
 * The "团队" tab's member-group section (the second of the four sections):
 * the fixed leading leader row (the "回到 leader" entry, anchored to the
 * first leader-kind instance — synthesized from the team session when the
 * rows carry none, rendered even then) plus one group per member template.
 * A group's container row reads `Name · N 活跃`; its expansion lists the
 * member's instance rows — the five-state display status
 * (created/running/settled/archived/disposed, read straight from the
 * snapshot per plan §7.2), the latest tool call or the action placeholder,
 * and a waiting badge while control requests are unresolved (the badge is
 * completeness-aware per plan §7.3: hidden under a partial ledger).
 * Clicking the leading row or an instance row switches the current session
 * to the child session (D9); the group and instance rows whose session is
 * the current one highlight (D7).
 *
 * P9-T5 (S3-C) mechanical adaptation (plan §8.4): the section reads the
 * vNext snapshot + durable-ledger model instead of the leader-keyed view;
 * the three-state status vocabulary becomes the five-state §7.2 display
 * status (the "bound" state is superseded by "created").
 */
import type { PropsLocale } from '@deepseek-ai/dsh-client-ui-slots'
import { StateDot, type StateDotState } from '@deepseek-ai/dsh-client-ui-primitives'
import type { TeamUiLedgerModel, TeamUiSnapshot } from '../model/team-ui-snapshot.js'
import {
  deriveTeamMembers,
  type TeamMemberGroupRow, type TeamMemberInstanceRow,
} from '../model/team-members-model.js'
import type { TeamKey } from './locales.js'
import styles from './TeamMembers.module.css'

/** The members section props: the vNext snapshot pair, the current session, the D9 navigation callback, and the team dictionary. */
export interface TeamMembersProps {
  /** The normalized team snapshot (the projection side of the §7.1 pair). */
  snapshot: TeamUiSnapshot
  /** The durable ledger model (the completeness-aware badge authority). */
  ledger: TeamUiLedgerModel
  /** The current session id (the framework session kit); its group and instance rows highlight. */
  currentSessionId: string
  /** Switch the current session to the clicked row's child session. */
  onSelectSession: (sessionId: string) => void
  /** The team dictionary translate seat. */
  t: PropsLocale<'team'>['t']
}

const INSTANCE_STATUS_KEYS = {
  created: 'view.members.created',
  running: 'view.members.running',
  settled: 'view.members.settled',
  archived: 'view.members.archived',
  disposed: 'view.members.disposed',
} as const satisfies Record<TeamMemberInstanceRow['status'], TeamKey>

/**
 * Map an instance display status onto the four StateDot states.
 * Provisional T5 mapping (T6 may refine lifecycle colors): created: amber,
 * running: blue, settled/archived/disposed: green (terminal states).
 * @param status - the instance row's display status.
 * @returns the dot state.
 */
function memberDot(status: TeamMemberInstanceRow['status']): StateDotState {
  switch (status) {
    case 'created': return 'warning'
    case 'running': return 'ongoing'
    case 'settled': return 'done'
    case 'archived': return 'done'
    case 'disposed': return 'done'
  }
}

/** The instance-row props: the projection row, the highlight, the switch callback, and the dictionary. */
interface InstanceRowProps {
  readonly instance: TeamMemberInstanceRow
  /** True when the instance's session is the current session. */
  readonly current: boolean
  /** Switch to the instance's session; absent when the row binds none. */
  readonly onSelect?: (() => void) | undefined
  readonly t: PropsLocale<'team'>['t']
}

/** One instance row: status dot and label, latest tool call, waiting badge. */
function InstanceRow({ instance, current, onSelect, t }: InstanceRowProps): React.JSX.Element {
  const pending = instance.pendingControlCount
  return (
    <button
      type="button"
      className={styles.instanceRow}
      data-member-instance
      data-status={instance.status}
      data-current={current || undefined}
      disabled={onSelect === undefined}
      onClick={onSelect}
    >
      <span className={styles.dotSlot} aria-hidden="true">
        <StateDot state={memberDot(instance.status)} />
      </span>
      <span className={styles.instanceStatus} data-member-status-text>{t(INSTANCE_STATUS_KEYS[instance.status])}</span>
      <span className={styles.instanceAction} data-member-action>
        {instance.currentAction ?? t('view.members.action.empty')}
      </span>
      {pending !== null && pending > 0
        ? <span className={styles.waitingBadge} data-member-waiting>{t('view.members.waiting', { count: pending })}</span>
        : null}
    </button>
  )
}

/** The group props: the model group, the resolved highlight, the current session, the switch callback, and the dictionary. */
interface MemberGroupProps {
  readonly group: TeamMemberGroupRow
  /** The group-row highlight (the caller resolves the leader against the team session). */
  readonly current: boolean
  /** The current session id (the per-instance highlight). */
  readonly currentSessionId: string
  /** Switch the current session to the named child session. */
  readonly onSelectSession: (sessionId: string) => void
  /** Switch to the team session (D10); present only on the leading row. */
  readonly onSelectLeader?: () => void
  readonly t: PropsLocale<'team'>['t']
}

/** One member group: the container row plus the instance expansion. */
function MemberGroup({
  group, current, currentSessionId, onSelectSession, onSelectLeader, t,
}: MemberGroupProps): React.JSX.Element {
  const name = group.name ?? t('member.leader')
  const label = `${name} · ${t('view.members.active', { count: group.activeCount })}`
  return (
    <div className={styles.group} data-member-group data-current={current || undefined}>
      {onSelectLeader === undefined
        ? (
          <div className={styles.groupRow} data-member-group-row>
            <span className={styles.groupName} data-member-group-name>{label}</span>
          </div>
        )
        : (
          <button
            type="button"
            className={styles.groupRow}
            data-member-group-row
            data-leader="true"
            onClick={onSelectLeader}
          >
            <span className={styles.groupName} data-member-group-name>{label}</span>
          </button>
        )}
      <div className={styles.instances} data-member-instances>
        {group.instances.length === 0
          ? <span className={styles.noInstances} data-member-no-instances>{t('view.members.noInstances')}</span>
          : group.instances.map(instance => (
            <InstanceRow
              key={instance.key}
              instance={instance}
              current={instance.childSessionId !== '' && instance.childSessionId === currentSessionId}
              onSelect={instance.childSessionId === '' ? undefined : () => { onSelectSession(instance.childSessionId) }}
              t={t}
            />
          ))}
      </div>
    </div>
  )
}

/**
 * The team member-group section (D8e, D8f, D9, D10) with the D7 highlight.
 * @param props - the vNext snapshot pair, the current session, the session-switch callback, and the dictionary.
 * @returns the members section.
 */
export function TeamMembers({
  snapshot, ledger, currentSessionId, onSelectSession, t,
}: TeamMembersProps): React.JSX.Element {
  const model = deriveTeamMembers(snapshot, ledger)
  return (
    <div className={styles.root} data-team-members>
      <MemberGroup
        group={model.leader}
        current={snapshot.teamSessionId === currentSessionId}
        currentSessionId={currentSessionId}
        onSelectSession={onSelectSession}
        onSelectLeader={() => { onSelectSession(snapshot.teamSessionId) }}
        t={t}
      />
      {model.groups.map(group => (
        <MemberGroup
          key={group.templateId}
          group={group}
          current={group.instances.some(instance => instance.childSessionId === currentSessionId)}
          currentSessionId={currentSessionId}
          onSelectSession={onSelectSession}
          t={t}
        />
      ))}
    </div>
  )
}
