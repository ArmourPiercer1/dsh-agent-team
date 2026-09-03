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
 *
 * P9-T7 (S5-B) extension (UI §17/§23/§40, Gate P9-G5): an instance row is
 * now a container `div` wrapping the session-navigation button and a
 * lifecycle-gated action cluster — send work / follow-up / message /
 * archive / restore / dispose (the §40 matrix; `Yes` = lifecycle-allowed,
 * policy may still block at admission). Each command runs through the
 * injected command face with a fresh local request token; NO optimistic
 * authority patch is applied (the post-success projection pull is the
 * state authority), and a typed failure lands verbatim (code + message +
 * token echo) in the row's error note. Teammate group rows carry the §17
 * "+" create-instance entry (never the leader row) opening the §17.1
 * template / label / group / workspace dialog (with the
 * `fresh_per_delegation` copy). When the command face is absent the
 * section stays display-only (T5 behavior).
 */
import { useMemo, useState } from 'react'
import type { PropsLocale } from '@deepseek-ai/dsh-client-ui-slots'
import { StateDot, type StateDotState } from '@deepseek-ai/dsh-client-ui-primitives'
import type {
  RemoteMemberCreateParams,
  RemoteMemberFollowupParams,
  RemoteMemberLifecycleParams,
  RemoteMemberSendParams,
  RemoteResponse,
} from '../../../remote/src/index.js'
import type {
  TeamUiLedgerModel, TeamUiSnapshot,
} from '../model/team-ui-snapshot.js'
import {
  deriveTeamMembers,
  type TeamMemberGroupRow, type TeamMemberInstanceRow,
} from '../model/team-members-model.js'
import {
  buildMemberCreateParams,
  buildMemberFollowupParams,
  buildMemberLifecycleParams,
  buildMemberSendParams,
  createRequestTokenGenerator,
  memberActionLabel,
  memberActionsForLifecycle,
  parseMemberCommandOutcome,
  type MemberActionLabel,
  type MemberCommandKind,
  type MemberCommandOutcome,
  type MemberInstanceCommand,
} from '../model/team-member-commands.js'
import type { TeamWorkspaceOption } from '../model/team-intent-model.js'
import {
  TeamConfirmDialog,
  TeamCreateMemberDialog,
  TeamMemberMessageDialog,
  TeamMemberPromptDialog,
  type MemberCreateDraft,
} from './TeamMemberDialogs.js'
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
  /** The S5-B command face; absent → the section stays display-only. */
  memberCommands?: TeamMembersCommandFace
  /** The workspace choices for the create dialog (absent/empty → hidden field). */
  workspaces?: readonly TeamWorkspaceOption[]
  /** The team dictionary translate seat. */
  t: PropsLocale<'team'>['t']
}

/**
 * The S5-B member command face (Gate P9-G5): the frozen Remote command
 * wrappers (raw `RemoteResponse`, typed error intact) plus the
 * post-success projection pull.
 */
export interface TeamMembersCommandFace {
  /** `member.create` — admit one member instance. */
  memberCreate: (params: RemoteMemberCreateParams) => Promise<RemoteResponse>
  /** `member.send` — a coordination message to the member's Chat. */
  memberSend: (params: RemoteMemberSendParams) => Promise<RemoteResponse>
  /** `member.followup` — send work / follow-up / resume (new-work admission). */
  memberFollowup: (params: RemoteMemberFollowupParams) => Promise<RemoteResponse>
  /** `member.archive`. */
  memberArchive: (params: RemoteMemberLifecycleParams) => Promise<RemoteResponse>
  /** `member.restore` (ARCHIVED → SETTLED, no model call). */
  memberRestore: (params: RemoteMemberLifecycleParams) => Promise<RemoteResponse>
  /** `member.dispose`. */
  memberDispose: (params: RemoteMemberLifecycleParams) => Promise<RemoteResponse>
  /** The post-success projection pull (the final-state authority). */
  pullProjection: (teamSessionId: string) => Promise<unknown>
}

/** The preserved typed error of one command (G5: verbatim wire values). */
export type MemberCommandError = Extract<MemberCommandOutcome, { readonly ok: false }>

const INSTANCE_STATUS_KEYS = {
  created: 'view.members.created',
  running: 'view.members.running',
  settled: 'view.members.settled',
  archived: 'view.members.archived',
  disposed: 'view.members.disposed',
} as const satisfies Record<TeamMemberInstanceRow['status'], TeamKey>

const ACTION_LABEL_KEYS = {
  sendWork: 'member.action.sendWork',
  followup: 'member.action.followup',
  resume: 'member.action.resume',
  message: 'member.action.message',
  archive: 'member.action.archive',
  restore: 'member.action.restore',
  dispose: 'member.action.dispose',
} as const satisfies Record<MemberActionLabel, TeamKey>

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

/**
 * The instance id carried by the row key
 * (`instanceId:childSessionId:index`, team-members-model).
 * @param instance - the row.
 * @returns the instance id.
 */
function instanceInstanceKey(instance: TeamMemberInstanceRow): string {
  return instance.key.split(':')[0]!
}

/** The one-open-dialog state (exactly one dialog at a time). */
type OpenMemberDialog =
  | { readonly kind: 'create'; readonly group: TeamMemberGroupRow }
  | { readonly kind: 'followup'; readonly instance: TeamMemberInstanceRow }
  | { readonly kind: 'send'; readonly instance: TeamMemberInstanceRow }
  | { readonly kind: 'archive'; readonly instance: TeamMemberInstanceRow }
  | { readonly kind: 'dispose'; readonly instance: TeamMemberInstanceRow }

/** The instance-row props: the projection row, the highlight, the switch callback, the command state, and the dictionary. */
interface InstanceRowProps {
  readonly instance: TeamMemberInstanceRow
  /** True when the instance's session is the current session. */
  readonly current: boolean
  /** Switch to the instance's session; absent when the row binds none. */
  readonly onSelect?: (() => void) | undefined
  /** Start one allowed command for the row; absent → display-only. */
  readonly onCommand?: ((kind: MemberInstanceCommand) => void) | undefined
  /** The in-flight command kind for the row (disables the cluster). */
  readonly pendingKind?: MemberInstanceCommand | undefined
  /** The last typed failure for the row (the error note). */
  readonly error?: MemberCommandError | undefined
  readonly t: PropsLocale<'team'>['t']
}

/** One instance row: the navigation button, the lifecycle-gated action cluster, the error note. */
function InstanceRow({
  instance, current, onSelect, onCommand, pendingKind, error, t,
}: InstanceRowProps): React.JSX.Element {
  const pending = instance.pendingControlCount
  const actions = onCommand === undefined
    ? []
    : memberActionsForLifecycle(instance.lifecycle)
  return (
    <div
      className={styles.instanceRow}
      data-member-instance
      data-status={instance.status}
      data-current={current || undefined}
      data-member-command-pending={pendingKind}
    >
      <button
        type="button"
        className={styles.instanceNav}
        data-member-instance-nav
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
      {actions.length > 0
        ? (
          <div className={styles.actions} data-member-actions>
            {actions.map(kind => (
              <button
                key={kind}
                type="button"
                className={styles.actionButton}
                data-member-action-button={kind}
                disabled={pendingKind !== undefined}
                onClick={() => {
                  if (onCommand !== undefined) onCommand(kind)
                }}
              >
                {t(ACTION_LABEL_KEYS[memberActionLabel(kind, instance.lifecycle)])}
              </button>
            ))}
          </div>
        )
        : null}
      {error !== undefined
        ? (
          <div className={styles.commandError} data-member-command-error>
            {t('member.command.error', { code: error.code, message: error.message })}
            {error.requestToken !== null ? ` [${error.requestToken}]` : ''}
          </div>
        )
        : null}
    </div>
  )
}

/** The group props: the model group, the resolved highlight, the current session, the switch callback, the command state, and the dictionary. */
interface MemberGroupProps {
  readonly group: TeamMemberGroupRow
  /** The group-row highlight (the caller resolves the leader against the team session). */
  readonly current: boolean
  /** The current session id (the per-instance highlight). */
  readonly currentSessionId: string
  /** Switch the current session to the named child session. */
  readonly onSelectSession: (sessionId: string) => void
  /** Switch to the team session (D10); present only on the leading row. */
  readonly onSelectLeader?: (() => void) | undefined
  /** Start one allowed command for a row; absent → display-only rows. */
  readonly onCommand?: ((kind: MemberInstanceCommand, instance: TeamMemberInstanceRow) => void) | undefined
  /** The in-flight command kind per instance key (the row cluster disable). */
  readonly pendingByInstance?: Readonly<Record<string, MemberCommandKind>>
  /** The last typed failure per instance key (the row error note). */
  readonly errorsByInstance?: Readonly<Record<string, MemberCommandError>>
  /** The §17 "+" entry; present only on teammate groups with a command face. */
  readonly onCreateInstance?: (() => void) | undefined
  /** The in-flight create for the group's template (disables the "+" entry). */
  readonly createPending?: boolean
  /** The last typed create failure for the group's template (the group note). */
  readonly createError?: MemberCommandError | undefined
  readonly t: PropsLocale<'team'>['t']
}

/** One member group: the container row (plus the §17 "+" on teammate rows) and the instance expansion. */
function MemberGroup({
  group, current, currentSessionId, onSelectSession, onSelectLeader,
  onCommand, pendingByInstance, errorsByInstance, onCreateInstance,
  createPending, createError, t,
}: MemberGroupProps): React.JSX.Element {
  const name = group.name ?? t('member.leader')
  const label = `${name} · ${t('view.members.active', { count: group.activeCount })}`
  return (
    <div className={styles.group} data-member-group data-current={current || undefined}>
      {onSelectLeader === undefined
        ? (
          <div className={styles.groupRow} data-member-group-row>
            <span className={styles.groupName} data-member-group-name>{label}</span>
            {onCreateInstance !== undefined
              ? (
                <button
                  type="button"
                  className={styles.createButton}
                  data-member-create-instance
                  aria-label={t('member.action.create')}
                  disabled={createPending || undefined}
                  onClick={onCreateInstance}
                >
                  +
                </button>
              )
              : null}
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
      {createError !== undefined
        ? (
          <div className={styles.commandError} data-member-command-error data-member-create-error>
            {t('member.command.error', { code: createError.code, message: createError.message })}
            {createError.requestToken !== null ? ` [${createError.requestToken}]` : ''}
          </div>
        )
        : null}
      <div className={styles.instances} data-member-instances>
        {group.instances.length === 0
          ? <span className={styles.noInstances} data-member-no-instances>{t('view.members.noInstances')}</span>
          : group.instances.map(instance => {
            const instanceId = instanceInstanceKey(instance)
            // Instance keys only ever hold instance commands; the group-row
            // 'create' lives under the separate `template:*` key space.
            const instancePending = pendingByInstance?.[instanceId]
            return (
              <InstanceRow
                key={instance.key}
                instance={instance}
                current={instance.childSessionId !== '' && instance.childSessionId === currentSessionId}
                onSelect={instance.childSessionId === '' ? undefined : () => { onSelectSession(instance.childSessionId) }}
                onCommand={onCommand === undefined ? undefined : kind => { onCommand(kind, instance) }}
                pendingKind={instancePending === 'create' ? undefined : instancePending}
                error={errorsByInstance?.[instanceId]}
                t={t}
              />
            )
          })}
      </div>
    </div>
  )
}

/**
 * The team member-group section (D8e, D8f, D9, D10) with the D7
 * highlight and the S5-B command flows (the §40 action matrix, the §17
 * create dialog, the §23 confirmations, the G5 typed-result discipline).
 * @param props - the vNext snapshot pair, the current session, the
 *   session-switch callback, the optional command face and workspace
 *   feed, and the dictionary.
 * @returns the members section.
 */
export function TeamMembers({
  snapshot, ledger, currentSessionId, onSelectSession,
  memberCommands, workspaces, t,
}: TeamMembersProps): React.JSX.Element {
  const model = deriveTeamMembers(snapshot, ledger)
  const [open, setOpen] = useState<OpenMemberDialog | null>(null)
  const [pending, setPending] = useState<Readonly<Record<string, MemberCommandKind>>>({})
  const [errors, setErrors] = useState<Readonly<Record<string, MemberCommandError>>>({})
  const nextToken = useMemo(() => createRequestTokenGenerator('ui'), [])
  const teamSessionId = snapshot.teamSessionId
  const workspaceOptions = workspaces ?? []

  /**
   * Run one command to settlement (G5): mark the key pending, run the
   * request, on success pull the projection (the final-state authority),
   * on a typed failure keep the verbatim error on the key, on a transport
   * loss record the loss note; always clear the pending mark when it
   * still belongs to this command.
   * @param kind - the command kind (the pending-mark identity).
   * @param key - the instance id (or `template:<id>` for create).
   * @param token - the local request token (the loss-note echo).
   * @param request - the settled request thunk.
   */
  const dispatch = (
    kind: MemberCommandKind,
    key: string,
    token: string,
    request: () => Promise<RemoteResponse>,
  ): void => {
    const commands = memberCommands
    if (commands === undefined) return
    setOpen(null)
    setPending(prev => ({ ...prev, [key]: kind }))
    setErrors(prev => {
      const next = { ...prev }
      delete next[key]
      return next
    })
    void request()
      .then(parseMemberCommandOutcome)
      .then(outcome => {
        if (outcome.ok) {
          void commands.pullProjection(teamSessionId)
        } else {
          setErrors(prev => ({ ...prev, [key]: outcome }))
        }
      })
      .catch((error: unknown) => {
        setErrors(prev => ({
          ...prev,
          [key]: {
            ok: false,
            code: 'transport-loss',
            message: error instanceof Error ? error.message : String(error),
            requestToken: token,
          },
        }))
      })
      .finally(() => {
        setPending(prev => {
          if (prev[key] !== kind) return prev
          const next = { ...prev }
          delete next[key]
          return next
        })
      })
  }

  /**
   * Run one instance command (send / follow-up / archive / restore /
   * dispose): build the frozen params with a fresh local token, then
   * settle through `dispatch`.
   * @param kind - the command kind.
   * @param instance - the target row.
   * @param text - the prompt text (follow-up) or message body (send).
   * @param subject - the optional message subject (send only).
   */
  const runInstanceCommand = (
    kind: MemberInstanceCommand,
    instance: TeamMemberInstanceRow,
    text?: string,
    subject?: string,
  ): void => {
    const commands = memberCommands
    if (commands === undefined) return
    const instanceId = instanceInstanceKey(instance)
    const token = nextToken()
    if (kind === 'send') {
      dispatch(kind, instanceId, token, () => commands.memberSend(buildMemberSendParams({
        teamSessionId,
        recipientInstanceId: instanceId,
        requestToken: token,
        body: text ?? '',
        ...(subject !== undefined ? { subject } : {}),
      })))
    } else if (kind === 'followup') {
      dispatch(kind, instanceId, token, () => commands.memberFollowup(buildMemberFollowupParams({
        teamSessionId,
        targetInstanceId: instanceId,
        requestToken: token,
        prompt: text ?? '',
      })))
    } else if (kind === 'archive') {
      dispatch(kind, instanceId, token, () => commands.memberArchive(buildMemberLifecycleParams(teamSessionId, instanceId)))
    } else if (kind === 'restore') {
      dispatch(kind, instanceId, token, () => commands.memberRestore(buildMemberLifecycleParams(teamSessionId, instanceId)))
    } else {
      dispatch(kind, instanceId, token, () => commands.memberDispose(buildMemberLifecycleParams(teamSessionId, instanceId)))
    }
  }

  /**
   * Run the §17 create dialog submit: the template delegation plus the
   * host-consumed payload fields (label required; group / workspace when
   * given), settled through `dispatch` on the group's template key.
   * @param group - the teammate group the "+" opened.
   * @param draft - the trimmed dialog fields.
   */
  const runCreateCommand = (group: TeamMemberGroupRow, draft: MemberCreateDraft): void => {
    const commands = memberCommands
    if (commands === undefined) return
    const token = nextToken()
    dispatch('create', `template:${group.templateId}`, token, () => commands.memberCreate(buildMemberCreateParams({
      teamSessionId,
      templateId: group.templateId,
      requestToken: token,
      label: draft.label,
      ...(draft.groupId !== undefined ? { groupId: draft.groupId } : {}),
      ...(draft.workspace !== undefined ? { workspace: draft.workspace } : {}),
    })))
  }

  const createTemplate = open?.kind === 'create'
    ? snapshot.templates.find(template => template.templateId === open.group.templateId)
    : undefined

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
          onCommand={memberCommands === undefined ? undefined : (kind, instance) => {
            if (kind === 'restore') {
              // §23.4: restore is a direct click (no confirmation, no model
              // call — ARCHIVED → SETTLED after the real admission).
              runInstanceCommand('restore', instance)
            } else {
              setOpen({ kind, instance })
            }
          }}
          pendingByInstance={pending}
          errorsByInstance={errors}
          onCreateInstance={memberCommands === undefined
            ? undefined
            : () => { setOpen({ kind: 'create', group }) }}
          createPending={pending[`template:${group.templateId}`] === 'create'}
          createError={errors[`template:${group.templateId}`]}
          t={t}
        />
      ))}
      {open !== null && memberCommands !== undefined && (
        open.kind === 'create'
          ? createTemplate !== undefined
            ? (
              <TeamCreateMemberDialog
                template={createTemplate}
                workspaces={workspaceOptions}
                onSubmit={draft => { runCreateCommand(open.group, draft) }}
                onCancel={() => { setOpen(null) }}
                t={t}
              />
            )
            : null
          : open.kind === 'archive'
            ? (
              <TeamConfirmDialog
                title={t('member.archive.title')}
                body={t('member.archive.plain')}
                warning={open.instance.lifecycle === 'RUNNING' ? t('member.archive.running') : undefined}
                confirmLabel={t('member.archive.confirm')}
                cancelLabel={t('member.archive.cancel')}
                onConfirm={() => { runInstanceCommand('archive', open.instance) }}
                onCancel={() => { setOpen(null) }}
              />
            )
            : open.kind === 'dispose'
              ? (
                <TeamConfirmDialog
                  title={t('member.dispose.title')}
                  body={t('member.dispose.body')}
                  confirmLabel={t('member.dispose.confirm')}
                  cancelLabel={t('member.dispose.cancel')}
                  onConfirm={() => { runInstanceCommand('dispose', open.instance) }}
                  onCancel={() => { setOpen(null) }}
                />
              )
              : open.kind === 'followup'
                ? (
                  <TeamMemberPromptDialog
                    title={t('member.send.title', { member: open.instance.label })}
                    placeholder={t('member.send.prompt.placeholder')}
                    submitLabel={t('member.send.submit')}
                    cancelLabel={t('member.send.cancel')}
                    onSubmit={text => { runInstanceCommand('followup', open.instance, text) }}
                    onCancel={() => { setOpen(null) }}
                    t={t}
                  />
                )
                : (
                  <TeamMemberMessageDialog
                    title={t('member.message.title', { member: open.instance.label })}
                    onSubmit={(body, subject) => { runInstanceCommand('send', open.instance, body, subject) }}
                    onCancel={() => { setOpen(null) }}
                    t={t}
                  />
                )
      )}
    </div>
  )
}
