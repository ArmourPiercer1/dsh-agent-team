/**
 * P9-T7 (S5-B) — the member command dialogs (UI doc §17/§23):
 * `TeamCreateMemberDialog` (the §17.1 template / label / group /
 * workspace dialog with the `fresh_per_delegation` copy "New delegation
 * creates a new instance.") and `TeamConfirmDialog` (the §23.2 archive
 * confirmation with the RUNNING drain warning, and the §23.5 dispose
 * confirmation — its primary copy is "Dispose", never "Delete member").
 *
 * Both are pure presentation: the field draft state is dialog-local
 * (reset on close — only the TeamIntent draft, UI §5.3, must persist
 * within the page run); the parent (`TeamMembers`) owns the in-flight
 * command, the error note, and the injected command face.
 *
 * @module @dsh-agent-team/client/ui/TeamMemberDialogs
 */
import { useState } from 'react'
import type { PropsLocale } from '@deepseek-ai/dsh-client-ui-slots'
import type { TeamUiTemplate } from '../model/team-ui-snapshot.js'
import type { TeamWorkspaceOption } from '../model/team-intent-model.js'
import styles from './TeamMemberDialogs.module.css'

/** The submitted §17 dialog fields (trimmed, optionals absent when blank). */
export interface MemberCreateDraft {
  readonly label: string
  readonly groupId?: string
  readonly workspace?: string
}

/** The create-member dialog props (UI §17.1). */
export interface TeamCreateMemberDialogProps {
  /** The delegation template the new instance binds to (read-only row). */
  readonly template: TeamUiTemplate
  /** The workspace choices (empty → the workspace field is hidden). */
  readonly workspaces: readonly TeamWorkspaceOption[]
  /** Submit the trimmed draft (the parent runs the command). */
  readonly onSubmit: (draft: MemberCreateDraft) => void
  /** Close without submitting. */
  readonly onCancel: () => void
  /** The team dictionary translate seat. */
  readonly t: PropsLocale<'team'>['t']
}

/**
 * The §17.1 create-member dialog: the read-only template row, the
 * required label, the optional group, the optional workspace (hidden
 * when the feed is absent), and the `fresh_per_delegation` notice.
 * The submit is disabled while the label is blank.
 * @param props - the template, the workspace feed, the callbacks, the dictionary.
 * @returns the dialog.
 */
export function TeamCreateMemberDialog({
  template, workspaces, onSubmit, onCancel, t,
}: TeamCreateMemberDialogProps): React.JSX.Element {
  const [label, setLabel] = useState('')
  const [groupId, setGroupId] = useState('')
  const [workspace, setWorkspace] = useState('')
  const submit = (): void => {
    const trimmedLabel = label.trim()
    if (trimmedLabel === '') return
    const trimmedGroup = groupId.trim()
    onSubmit({
      label: trimmedLabel,
      ...(trimmedGroup !== '' ? { groupId: trimmedGroup } : {}),
      ...(workspace !== '' ? { workspace } : {}),
    })
  }
  return (
    <div className={styles.dialog} data-member-dialog data-member-create-dialog role="dialog" aria-modal="true">
      <h3 className={styles.title} data-member-create-title>{t('member.create.title')}</h3>
      <div className={styles.field} data-member-create-template>
        <span className={styles.fieldLabel}>{t('member.create.template')}</span>
        <span className={styles.templateName} data-member-create-template-name>{template.displayName}</span>
      </div>
      {template.contextPolicy === 'fresh_per_delegation'
        ? <div className={styles.notice} data-member-fresh-notice>{t('member.create.fresh')}</div>
        : null}
      <label className={styles.field} data-member-create-label-field>
        <span className={styles.fieldLabel}>{t('member.create.label')}</span>
        <input
          type="text"
          data-member-create-label
          placeholder={t('member.create.label.placeholder')}
          value={label}
          onChange={event => { setLabel(event.target.value) }}
        />
      </label>
      <label className={styles.field} data-member-create-group-field>
        <span className={styles.fieldLabel}>{t('member.create.group')}</span>
        <input
          type="text"
          data-member-create-group
          value={groupId}
          onChange={event => { setGroupId(event.target.value) }}
        />
      </label>
      {workspaces.length > 0
        ? (
          <label className={styles.field} data-member-create-workspace-field>
            <span className={styles.fieldLabel}>{t('member.create.workspace')}</span>
            <select
              data-member-create-workspace
              value={workspace}
              onChange={event => { setWorkspace(event.target.value) }}
            >
              <option value="">{t('intent.workspace.placeholder')}</option>
              {workspaces.map(option => (
                <option key={option.id} value={option.path}>{option.title}</option>
              ))}
            </select>
          </label>
        )
        : null}
      <div className={styles.actions} data-member-create-actions>
        <button type="button" className={styles.button} data-member-create-cancel onClick={onCancel}>
          {t('member.create.cancel')}
        </button>
        <button
          type="button"
          className={styles.button}
          data-member-create-submit
          disabled={label.trim() === ''}
          onClick={submit}
        >
          {t('member.create.submit')}
        </button>
      </div>
    </div>
  )
}

/** The work-prompt dialog props (follow-up / send work / resume). */
export interface TeamMemberPromptDialogProps {
  /** The dialog title (pre-translated by the caller, member name included). */
  readonly title: string
  /** The input placeholder (pre-translated by the caller). */
  readonly placeholder: string
  /** The primary action label (pre-translated by the caller). */
  readonly submitLabel: string
  /** The cancel action label (pre-translated by the caller). */
  readonly cancelLabel: string
  /** Submit the trimmed prompt text (the parent runs the command). */
  readonly onSubmit: (text: string) => void
  /** Close without submitting. */
  readonly onCancel: () => void
  /** The team dictionary translate seat. */
  readonly t: PropsLocale<'team'>['t']
}

/**
 * The work-prompt dialog (UI §23.1 "Send work…" / the follow-up
 * interaction; the SETTLED "Resume…" opens the same dialog): one
 * non-empty prompt field; the submit is disabled while blank.
 * @param props - the copy, the callbacks, the dictionary.
 * @returns the dialog.
 */
export function TeamMemberPromptDialog({
  title, placeholder, submitLabel, cancelLabel, onSubmit, onCancel, t,
}: TeamMemberPromptDialogProps): React.JSX.Element {
  const [text, setText] = useState('')
  return (
    <div className={styles.dialog} data-member-dialog data-member-prompt-dialog role="dialog" aria-modal="true">
      <h3 className={styles.title} data-member-prompt-title>{title}</h3>
      <label className={styles.field} data-member-prompt-field>
        <span className={styles.fieldLabel}>{t('member.send.prompt')}</span>
        <input
          type="text"
          data-member-prompt-input
          placeholder={placeholder}
          value={text}
          onChange={event => { setText(event.target.value) }}
        />
      </label>
      <div className={styles.actions} data-member-prompt-actions>
        <button type="button" className={styles.button} data-member-prompt-cancel onClick={onCancel}>
          {cancelLabel}
        </button>
        <button
          type="button"
          className={styles.button}
          data-member-prompt-submit
          disabled={text.trim() === ''}
          onClick={() => { onSubmit(text.trim()) }}
        >
          {submitLabel}
        </button>
      </div>
    </div>
  )
}

/** The member-message dialog props (UI §28: relays in the Member Chat). */
export interface TeamMemberMessageDialogProps {
  /** The dialog title (pre-translated by the caller, member name included). */
  readonly title: string
  /** Submit the trimmed body (the optional subject, absent when blank). */
  readonly onSubmit: (body: string, subject: string | undefined) => void
  /** Close without submitting. */
  readonly onCancel: () => void
  /** The team dictionary translate seat. */
  readonly t: PropsLocale<'team'>['t']
}

/**
 * The `member.send` message dialog: an optional subject line plus the
 * required body (the frozen 1..200000 bound is enforced host-side; a
 * violation surfaces as the verbatim typed error note).
 * @param props - the copy, the callbacks, the dictionary.
 * @returns the dialog.
 */
export function TeamMemberMessageDialog({
  title, onSubmit, onCancel, t,
}: TeamMemberMessageDialogProps): React.JSX.Element {
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  return (
    <div className={styles.dialog} data-member-dialog data-member-message-dialog role="dialog" aria-modal="true">
      <h3 className={styles.title} data-member-message-title>{title}</h3>
      <label className={styles.field} data-member-message-subject-field>
        <span className={styles.fieldLabel}>{t('member.message.subject')}</span>
        <input
          type="text"
          data-member-message-subject
          value={subject}
          onChange={event => { setSubject(event.target.value) }}
        />
      </label>
      <label className={styles.field} data-member-message-body-field>
        <span className={styles.fieldLabel}>{t('member.message.body')}</span>
        <textarea
          data-member-message-body
          placeholder={t('member.message.body.placeholder')}
          rows={3}
          value={body}
          onChange={event => { setBody(event.target.value) }}
        />
      </label>
      <div className={styles.actions} data-member-message-actions>
        <button type="button" className={styles.button} data-member-message-cancel onClick={onCancel}>
          {t('member.message.cancel')}
        </button>
        <button
          type="button"
          className={styles.button}
          data-member-message-submit
          disabled={body.trim() === ''}
          onClick={() => {
            const trimmedBody = body.trim()
            const trimmedSubject = subject.trim()
            onSubmit(trimmedBody, trimmedSubject === '' ? undefined : trimmedSubject)
          }}
        >
          {t('member.message.submit')}
        </button>
      </div>
    </div>
  )
}

/** The confirmation dialog props (§23.2 archive / §23.5 dispose). */
export interface TeamConfirmDialogProps {
  /** The dialog title (pre-translated by the caller). */
  readonly title: string
  /** The confirmation body (pre-translated by the caller). */
  readonly body: string
  /** The §23.2 drain warning (archive on a RUNNING member), when present. */
  readonly warning?: string | undefined
  /** The primary action label (pre-translated by the caller). */
  readonly confirmLabel: string
  /** The cancel action label (pre-translated by the caller). */
  readonly cancelLabel: string
  /** Confirm the action (the parent runs the command). */
  readonly onConfirm: () => void
  /** Close without confirming. */
  readonly onCancel: () => void
}

/**
 * The §23 lifecycle confirmation: title, body, the optional drain
 * warning, and the two actions (the primary is the lifecycle verb —
 * "Archive" / "Dispose" — never a delete framing).
 * @param props - the copy, the callbacks.
 * @returns the dialog.
 */
export function TeamConfirmDialog({
  title, body, warning, confirmLabel, cancelLabel, onConfirm, onCancel,
}: TeamConfirmDialogProps): React.JSX.Element {
  return (
    <div className={styles.dialog} data-member-dialog data-member-confirm-dialog role="dialog" aria-modal="true">
      <h3 className={styles.title} data-member-confirm-title>{title}</h3>
      <div className={styles.body} data-member-confirm-body>{body}</div>
      {warning !== undefined
        ? <div className={styles.warning} data-member-confirm-warning>{warning}</div>
        : null}
      <div className={styles.actions} data-member-confirm-actions>
        <button type="button" className={styles.button} data-member-confirm-cancel onClick={onCancel}>
          {cancelLabel}
        </button>
        <button type="button" className={styles.button} data-member-confirm-ok onClick={onConfirm}>
          {confirmLabel}
        </button>
      </div>
    </div>
  )
}
