/**
 * P9-T8 (S5-C) — the config/policy/compatibility governance section
 * (plan P9-S5 S5-C; UI doc §10/§18/§19/§21; Gate P9-G5).
 *
 * Rendered as the team section between Members and Activity, and ONLY when
 * the injected `governance` face is present (absent → the T7 rendering is
 * unchanged; the T9 mount supplies the real face).
 *
 * G5 discipline (plan §10.3 mutation rule: remote command → typed result
 * → projection re-pull → render):
 * - NO optimistic authority patch: the pending mark and the local "will
 *   commit" preview are UI state only; nothing rendered as durable state
 *   changes before the typed result lands and the projection pull settles.
 * - Every command (recheck / policy-state set / override set / override
 *   reset) runs through `dispatch`, which reuses the shared
 *   `parseMemberCommandOutcome`: the remote typed result is preserved
 *   verbatim (`code`, `message`, `requestToken` echo) and rendered
 *   unrewritten; the projection is pulled EXACTLY ONCE on success and
 *   NEVER on a typed failure; a transport loss records a local
 *   `transport-loss` note only (no projection pull).
 * - The READS (`compatibility.get`, `policyState.get`, `override.get`)
 *   are not command flows: they never pull the projection (the T7 catalog
 *   precedent) and their typed failures render verbatim as local notes.
 * - The rendered durable state (the compatibility badge + counts, the
 *   policy-state id) comes from the PROJECTION snapshot, never from a
 *   wire read; the fresh reads are displayed as labeled detail.
 *
 * Wire gap (recorded divergence): `compatibility.ack` requires a
 * `requirementId`, but the frozen `compatibility.get` exposes aggregate
 * counts only — the ack control is rendered DISABLED with the explicit
 * reason (UI §38: no grey button without a reason).
 */
import { useMemo, useState } from 'react'
import type { PropsLocale } from '@deepseek-ai/dsh-client-ui-slots'
import {
  REMOTE_CAPABILITY_VALUES,
  type RemoteCapability,
  type RemoteCompatibilityAckParams,
  type RemoteCompatibilityGetParams,
  type RemoteCompatibilityReprobeParams,
  type RemoteOverrideGetParams,
  type RemoteOverrideResetParams,
  type RemoteOverrideSetParams,
  type RemotePolicyEntry,
  type RemotePolicyStateGetParams,
  type RemotePolicyStateSetParams,
  type RemoteResponse,
} from '../../../remote/src/index.js'
import type { TeamUiMemberInstance, TeamUiSnapshot } from '../model/team-ui-snapshot.js'
import {
  createRequestTokenGenerator,
  parseMemberCommandOutcome,
  type MemberCommandOutcome,
} from '../model/team-member-commands.js'
import {
  HUMAN_RECHECK_TRIGGER,
  compatibilityBadge,
  compatibilityGetParams,
  compatibilityReprobeParams,
  effectiveConfigLanes,
  hardPolicyDisplay,
  overrideGetParams,
  overrideResetParams,
  overrideSetParams,
  parseCompatibilityStateValue,
  parseOverrideValue,
  parsePolicyStateValue,
  policyStateGetParams,
  policyStateLabel,
  policyStateSetParams,
  type CompatibilityStateWire,
  type OverrideWire,
  type PolicyStateCellWire,
  type PolicyStateViewWire,
} from '../model/team-governance.js'
import styles from './TeamGovernance.module.css'

/** The S5-C governance command face (Gate P9-G5): the frozen Remote
 * wrappers (raw `RemoteResponse`, typed error intact) plus the
 * post-success projection pull. */
export interface TeamGovernanceFace {
  /** `compatibility.get` (read: the durable aggregate state). */
  compatibilityGet: (params: RemoteCompatibilityGetParams) => Promise<RemoteResponse>
  /** `compatibility.ack` (wired but UI-disabled: the wire gap). */
  compatibilityAck: (params: RemoteCompatibilityAckParams) => Promise<RemoteResponse>
  /** `compatibility.reprobe` (command: a new probe generation). */
  compatibilityReprobe: (params: RemoteCompatibilityReprobeParams) => Promise<RemoteResponse>
  /** `policyState.get` (read: the state view). */
  policyStateGet: (params: RemotePolicyStateGetParams) => Promise<RemoteResponse>
  /** `policyState.set` (command: commit the cell map). */
  policyStateSet: (params: RemotePolicyStateSetParams) => Promise<RemoteResponse>
  /** `override.get` (read: the Explicit Human Override record). */
  overrideGet: (params: RemoteOverrideGetParams) => Promise<RemoteResponse>
  /** `override.set` (command: set the override — it edits ONLY the
   * Explicit Human Override layer, never the Blueprint). */
  overrideSet: (params: RemoteOverrideSetParams) => Promise<RemoteResponse>
  /** `override.reset` (command: remove the override). */
  overrideReset: (params: RemoteOverrideResetParams) => Promise<RemoteResponse>
  /** The post-success projection pull (the final-state authority). */
  pullProjection: (teamSessionId: string) => Promise<unknown>
}

/** The preserved typed error of one command (G5: verbatim wire values). */
export type GovernanceCommandError = Extract<MemberCommandOutcome, { readonly ok: false }>

/** The command kinds that run through the G5 dispatch (the pending-mark identity). */
type GovernanceCommandKind = 'recheck' | 'policy-set' | 'override-set' | 'override-reset'

/** The governance section props. */
export interface TeamGovernanceProps {
  /** The normalized team snapshot (the projection side of the pair). */
  snapshot: TeamUiSnapshot
  /** The S5-C command face (the section renders only when present). */
  governance: TeamGovernanceFace
  /** The team dictionary translate seat. */
  t: PropsLocale<'team'>['t']
}

/** A thrown error (channel loss / malformed read) rendered to a string. */
function throwableMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

/** One settled `compatibility.get` read (fresh-read detail, not authority). */
type CompatReadState =
  | { readonly ok: true; readonly state: CompatibilityStateWire }
  | { readonly ok: false; readonly message: string }

/** One settled `policyState.get` read. */
type PolicyReadState =
  | { readonly ok: true; readonly view: PolicyStateViewWire }
  | { readonly ok: false; readonly message: string }

/** One settled `override.get` read (keyed by `instanceId:capability`). */
type OverrideReadState =
  | { readonly ok: true; readonly wire: OverrideWire }
  | { readonly ok: false; readonly message: string }

/** The per-capability policy cell editor draft (UI state, never authority). */
interface PolicyCellDraft {
  readonly kind: 'allow' | 'deny' | 'none'
  readonly items: string
}

/** The per-member override editor draft (UI state, never authority). */
interface OverrideDraft {
  readonly capability: RemoteCapability
  readonly kind: 'allow' | 'deny' | 'none'
  readonly items: string
}

/** Parse a comma-separated allow-items field (trimmed, empties dropped). */
function parseItemsField(raw: string): string[] {
  return raw
    .split(',')
    .map(part => part.trim())
    .filter(part => part !== '')
}

const EMPTY_POLICY_CELLS: Record<string, PolicyCellDraft> = {}

/**
 * The governance section (UI §10/§18/§19/§21): the compatibility card
 * (the Projection badge + counts, the fresh-read detail, the Recheck
 * command, the disabled ack with its explicit reason), the policy-state
 * row (the Projection state id, the §21 help copy, the cell view +
 * editor + commit), and the per-member effective-config lanes (the
 * §18.3 distinct state words, the §19 hard-policy display, the §19
 * override editor).
 */
export function TeamGovernance({
  snapshot, governance, t,
}: TeamGovernanceProps): React.JSX.Element {
  const teamSessionId = snapshot.teamSessionId

  // -- the G5 command channel state ----------------------------------------
  const [pending, setPending] = useState<Readonly<Record<string, GovernanceCommandKind>>>({})
  const [errors, setErrors] = useState<Readonly<Record<string, GovernanceCommandError>>>({})
  const nextToken = useMemo(() => createRequestTokenGenerator('governance'), [])

  // -- the read state (reads never pull the projection) ---------------------
  const [compatRead, setCompatRead] = useState<CompatReadState | undefined>(undefined)
  const [compatReading, setCompatReading] = useState(false)
  const [policyRead, setPolicyRead] = useState<PolicyReadState | undefined>(undefined)
  const [policyReading, setPolicyReading] = useState(false)
  const [policyCells, setPolicyCells] = useState<Readonly<Record<string, PolicyCellDraft>>>(EMPTY_POLICY_CELLS)
  const [overrideReads, setOverrideReads] = useState<Readonly<Record<string, OverrideReadState>>>({})
  const [overrideDrafts, setOverrideDrafts] = useState<Readonly<Record<string, OverrideDraft>>>({})

  /**
   * Run one command to settlement (Gate P9-G5, the T7 pattern verbatim):
   * mark the key pending, clear its stale error, run the request, on
   * success pull the projection EXACTLY ONCE (the final-state authority),
   * on a typed failure keep the verbatim error on the key, on a transport
   * loss record the loss note; always clear the pending mark when it
   * still belongs to this command.
   * @param kind - the command kind (the pending-mark identity).
   * @param key - the command slot (e.g. `compat-recheck`, `policy-set`).
   * @param token - the local request token (the loss-note echo).
   * @param request - the settled request thunk.
   */
  const dispatch = (
    kind: GovernanceCommandKind,
    key: string,
    token: string,
    request: () => Promise<RemoteResponse>,
  ): void => {
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
          void governance.pullProjection(teamSessionId)
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

  // -- the reads (no projection pull — the T7 catalog precedent) ------------

  /** `compatibility.get`: the fresh-read detail (the badge stays Projection-driven). */
  const runCompatRead = (): void => {
    if (compatReading) return
    setCompatReading(true)
    void governance.compatibilityGet(compatibilityGetParams(teamSessionId))
      .then(response => {
        if (!response.ok) {
          setCompatRead({ ok: false, message: `${response.error.code}: ${response.error.message}` })
          return
        }
        try {
          setCompatRead({ ok: true, state: parseCompatibilityStateValue(response.value.data) })
        } catch (error) {
          setCompatRead({ ok: false, message: throwableMessage(error) })
        }
      })
      .catch(error => {
        setCompatRead({ ok: false, message: throwableMessage(error) })
      })
      .finally(() => {
        setCompatReading(false)
      })
  }

  /** `policyState.get`: the cell view; the editor drafts initialize from it. */
  const runPolicyRead = (): void => {
    if (policyReading) return
    setPolicyReading(true)
    void governance.policyStateGet(policyStateGetParams(teamSessionId))
      .then(response => {
        if (!response.ok) {
          setPolicyRead({ ok: false, message: `${response.error.code}: ${response.error.message}` })
          return
        }
        try {
          const view = parsePolicyStateValue(response.value.data)
          const drafts: Record<string, PolicyCellDraft> = { ...policyCells }
          for (const cell of view.cells) {
            drafts[cell.capability] = cellToDraft(cell)
          }
          setPolicyCells(drafts)
          setPolicyRead({ ok: true, view })
        } catch (error) {
          setPolicyRead({ ok: false, message: throwableMessage(error) })
        }
      })
      .catch(error => {
        setPolicyRead({ ok: false, message: throwableMessage(error) })
      })
      .finally(() => {
        setPolicyReading(false)
      })
  }

  /** `override.get` for one member/capability (the current override layer). */
  const runOverrideRead = (instanceId: string, capability: RemoteCapability): void => {
    const key = `${instanceId}:${capability}`
    if (overrideReads[key] !== undefined) return
    setOverrideReads(prev => ({ ...prev, [key]: { ok: false, message: t('governance.override.reading') } }))
    void governance.overrideGet(overrideGetParams(teamSessionId, capability, 'instance', instanceId))
      .then(response => {
        if (!response.ok) {
          setOverrideReads(prev => ({ ...prev, [key]: { ok: false, message: `${response.error.code}: ${response.error.message}` } }))
          return
        }
        try {
          setOverrideReads(prev => ({ ...prev, [key]: { ok: true, wire: parseOverrideValue(response.value.data) } }))
        } catch (error) {
          setOverrideReads(prev => ({ ...prev, [key]: { ok: false, message: throwableMessage(error) } }))
        }
      })
      .catch(error => {
        setOverrideReads(prev => ({ ...prev, [key]: { ok: false, message: throwableMessage(error) } }))
      })
  }

  // -- the commands (the G5 dispatch) ---------------------------------------

  /** The human Recheck (UI §10.4): a new probe generation; the closed
   * frozen trigger is `CAPABILITY_GENERATION_CHANGE`. */
  const runRecheck = (): void => {
    const token = nextToken()
    dispatch('recheck', 'compat-recheck', token, () =>
      governance.compatibilityReprobe(
        compatibilityReprobeParams(teamSessionId, HUMAN_RECHECK_TRIGGER),
      ),
    )
  }

  /** The policy-state commit: the current stateId (from the PROJECTION —
   * never invented locally) + the edited cell map (partial maps are
   * wire-legal; only the capabilities the editor touched are sent). */
  const runPolicyCommit = (): void => {
    const cells: Record<string, { readonly locked?: boolean; readonly value?: RemotePolicyEntry }> = {}
    for (const capability of REMOTE_CAPABILITY_VALUES) {
      const draft = policyCells[capability]
      if (draft === undefined || draft.kind === 'none') continue
      const items = parseItemsField(draft.items)
      if (draft.kind === 'deny') {
        cells[capability] = { value: { kind: 'deny' } }
      } else if (items.length > 0) {
        cells[capability] = { value: { kind: 'allow', items } }
      }
    }
    if (Object.keys(cells).length === 0) return
    const token = nextToken()
    dispatch('policy-set', 'policy-set', token, () =>
      governance.policyStateSet(
        policyStateSetParams(teamSessionId, snapshot.policyState, cells),
      ),
    )
  }

  /** The per-member override set (scope `instance`, targeting the member). */
  const runOverrideSet = (instance: TeamUiMemberInstance, instanceId: string): void => {
    const draft = overrideDrafts[instanceId] ?? { capability: 'model', kind: 'allow', items: '' }
    const items = parseItemsField(draft.items)
    if (draft.kind === 'allow' && items.length === 0) return
    const value: RemotePolicyEntry = draft.kind === 'deny'
      ? { kind: 'deny' }
      : { kind: 'allow', items }
    const token = nextToken()
    dispatch('override-set', `override-set:${instanceId}`, token, () =>
      governance.overrideSet(
        overrideSetParams(teamSessionId, draft.capability, value, 'instance', instanceId),
      ),
    )
  }

  /** The per-member override reset (the value is recomputed from the lower layers). */
  const runOverrideReset = (instanceId: string, capability: RemoteCapability): void => {
    const token = nextToken()
    dispatch('override-reset', `override-reset:${instanceId}`, token, () =>
      governance.overrideReset(
        overrideResetParams(teamSessionId, capability, 'instance', instanceId),
      ),
    )
  }

  // -- the derived display values -------------------------------------------

  const compat = snapshot.compatibility
  const badge = compatibilityBadge(compat.status)
  const policyLabel = policyStateLabel(snapshot.policyState)

  const badgeKey = badge === null
    ? null
    : badge.mark === 'pass'
      ? 'governance.compatibility.badge.pass'
      : badge.mark === 'fatal'
        ? 'governance.compatibility.badge.fatal'
        : badge.state === 'DEGRADED_ACKNOWLEDGED'
          ? 'governance.compatibility.badge.degraded'
          : 'governance.compatibility.badge.actionRequired'

  const recheckPending = pending['compat-recheck'] !== undefined
  const policyPending = pending['policy-set'] !== undefined
  const recheckError = errors['compat-recheck']
  const policyError = errors['policy-set']

  const commitPreview = useMemo(() => {
    const parts: string[] = []
    for (const capability of REMOTE_CAPABILITY_VALUES) {
      const draft = policyCells[capability]
      if (draft === undefined || draft.kind === 'none') continue
      const items = parseItemsField(draft.items)
      if (draft.kind === 'deny') parts.push(`${capability} → deny`)
      else if (items.length > 0) parts.push(`${capability} → allow [${items.join(', ')}]`)
    }
    return parts
  }, [policyCells])

  const setPolicyCell = (capability: string, patch: Partial<PolicyCellDraft>): void => {
    setPolicyCells(prev => ({
      ...prev,
      [capability]: {
        kind: 'none',
        items: '',
        ...prev[capability],
        ...patch,
      },
    }))
  }

  const setOverrideDraft = (instanceId: string, patch: Partial<OverrideDraft>): void => {
    setOverrideDrafts(prev => ({
      ...prev,
      [instanceId]: {
        capability: 'model',
        kind: 'allow',
        items: '',
        ...prev[instanceId],
        ...patch,
      },
    }))
  }

  return (
    <div className={styles.section} data-governance>
      {/* ── the compatibility card (UI §10) ─────────────────────────────── */}
      <div className={styles.card} data-governance-compat>
        <div className={styles.cardHead}>
          <span className={styles.cardTitle}>{t('governance.compatibility')}</span>
          {badge !== null && badgeKey !== null ? (
            <span
              className={styles.badge}
              data-governance-compat-badge
              data-governance-compat-mark={badge.mark}
            >
              {t(badgeKey)}
            </span>
          ) : (
            <span className={styles.badgeUnknown} data-governance-compat-badge>
              {compat.status}
            </span>
          )}
        </div>
        <div className={styles.counts} data-governance-compat-counts>
          {t('governance.compatibility.counts', {
            warning: compat.warningCount,
            fatal: compat.fatalCount,
            acknowledged: compat.acknowledgedWarningCount,
          })}
          <span className={styles.meta} data-governance-compat-generation>
            {t('governance.compatibility.generation', { generation: compat.probeGeneration })}
          </span>
          {compat.lastProbedAt !== undefined && (
            <span className={styles.meta}>
              {t('governance.compatibility.probed', { at: compat.lastProbedAt })}
            </span>
          )}
        </div>
        {compatRead !== undefined && compatRead.ok && (
          <div className={styles.freshRead} data-governance-compat-read>
            <p className={styles.freshReadTitle}>{t('governance.compatibility.freshRead')}</p>
            <p>
              {compatRead.state.status} · {t('governance.compatibility.generation', { generation: compatRead.state.generation })} · {compatRead.state.environmentFingerprint} · {compatRead.state.recordedAt}
            </p>
            <p>
              {t('governance.compatibility.readCounts', {
                pass: compatRead.state.pass,
                warning: compatRead.state.warning,
                fatal: compatRead.state.fatal,
                unacked: compatRead.state.unackedWarning,
                stale: compatRead.state.staleAcknowledgement,
              })}
            </p>
          </div>
        )}
        {compatRead !== undefined && !compatRead.ok && (
          <p className={styles.noteError} data-governance-compat-read-error>
            {t('governance.error', { message: compatRead.message })}
          </p>
        )}
        {recheckError !== undefined && (
          <p className={styles.noteError} data-governance-recheck-error>
            {t('governance.error', {
              message: `${recheckError.code}: ${recheckError.message}${recheckError.requestToken !== null ? ` [${recheckError.requestToken}]` : ''}`,
            })}
          </p>
        )}
        <div className={styles.actions}>
          <button
            type="button"
            className={styles.secondary}
            data-governance-compat-review
            disabled={compatReading}
            onClick={runCompatRead}
          >
            {compatReading ? t('governance.reading') : t('governance.compatibility.review')}
          </button>
          <button
            type="button"
            className={styles.secondary}
            data-governance-recheck
            disabled={recheckPending}
            onClick={runRecheck}
          >
            {recheckPending ? t('governance.pending') : t('governance.compatibility.recheck')}
          </button>
          <button
            type="button"
            className={styles.secondary}
            data-governance-ack
            disabled
            title={t('governance.compatibility.ackDisabled')}
          >
            {t('governance.compatibility.ack')}
          </button>
        </div>
        <p className={styles.help}>{t('governance.compatibility.recheckHelp')}</p>
      </div>

      {/* ── the policy-state row (UI §21) ───────────────────────────────── */}
      <div className={styles.card} data-governance-policy>
        <span className={styles.cardTitle} data-governance-policy-label>
          {t('governance.policy.header', { state: policyLabel })}
        </span>
        <p className={styles.help}>{t('governance.policy.help')}</p>
        {policyError !== undefined && (
          <p className={styles.noteError} data-governance-policy-error>
            {t('governance.error', {
              message: `${policyError.code}: ${policyError.message}${policyError.requestToken !== null ? ` [${policyError.requestToken}]` : ''}`,
            })}
          </p>
        )}
        <div className={styles.actions}>
          <button
            type="button"
            className={styles.secondary}
            data-governance-policy-review
            disabled={policyReading}
            onClick={runPolicyRead}
          >
            {policyReading ? t('governance.reading') : t('governance.policy.review')}
          </button>
          <button
            type="button"
            className={styles.primary}
            data-governance-policy-commit
            disabled={policyPending || commitPreview.length === 0}
            onClick={runPolicyCommit}
          >
            {policyPending ? t('governance.pending') : t('governance.policy.commit')}
          </button>
        </div>
        {policyRead !== undefined && policyRead.ok && (
          <div className={styles.cells} data-governance-policy-cells>
            {policyRead.view.cells.map(cell => (
              <div key={cell.capability} className={styles.cell} data-governance-policy-cell={cell.capability}>
                <span className={styles.cellName}>
                  {cell.capability}
                  {cell.locked && <span className={styles.cellLocked}> {t('governance.policy.cell.locked')}</span>}
                </span>
                <span className={styles.cellCurrent}>
                  {cell.entry === null
                    ? t('governance.policy.entry.none')
                    : cell.entry.kind === 'deny'
                      ? t('governance.policy.entry.deny')
                      : `${t('governance.policy.entry.allow')} [${cell.entry.items.join(', ')}]`}
                </span>
                {cell.locked ? null : (
                  <div className={styles.cellEditor}>
                    <select
                      className={styles.select}
                      data-governance-policy-cell-kind
                      value={policyCells[cell.capability]?.kind ?? 'none'}
                      onChange={event => setPolicyCell(cell.capability, { kind: event.target.value as PolicyCellDraft['kind'], items: event.target.value === 'deny' || event.target.value === 'none' ? '' : (policyCells[cell.capability]?.items ?? '') })}
                    >
                      <option value="none">{t('governance.policy.entry.none')}</option>
                      <option value="allow">{t('governance.policy.entry.allow')}</option>
                      <option value="deny">{t('governance.policy.entry.deny')}</option>
                    </select>
                    {policyCells[cell.capability]?.kind === 'allow' && (
                      <input
                        className={styles.input}
                        type="text"
                        data-governance-policy-cell-items
                        value={policyCells[cell.capability]?.items ?? ''}
                        placeholder={t('governance.policy.items')}
                        onChange={event => setPolicyCell(cell.capability, { items: event.target.value })}
                      />
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
        {policyRead !== undefined && !policyRead.ok && (
          <p className={styles.noteError} data-governance-policy-read-error>
            {t('governance.error', { message: policyRead.message })}
          </p>
        )}
        {commitPreview.length > 0 && (
          <p className={styles.preview} data-governance-policy-preview>
            {t('governance.policy.preview', { capabilities: commitPreview.join(' · ') })}
          </p>
        )}
      </div>

      {/* ── the per-member effective config + overrides (UI §18/§19) ────── */}
      <div className={styles.card} data-governance-effective-config>
        <span className={styles.cardTitle}>{t('governance.effectiveConfig')}</span>
        {snapshot.members.filter(member => member.effectiveConfig !== undefined).length === 0 && (
          <p className={styles.help}>{t('governance.effectiveConfig.empty')}</p>
        )}
        {snapshot.members.map(member => {
          const dto = member.effectiveConfig
          if (dto === undefined) return null
          const rows = effectiveConfigLanes(dto)
          const draft = overrideDrafts[member.instanceId]
          const setPendingMark = pending[`override-set:${member.instanceId}`] !== undefined
          const resetPendingMark = pending[`override-reset:${member.instanceId}`] !== undefined
          const setError = errors[`override-set:${member.instanceId}`]
          const resetError = errors[`override-reset:${member.instanceId}`]
          const readKey = `${member.instanceId}:${draft?.capability ?? 'model'}`
          const overrideRead = overrideReads[readKey]
          return (
            <div key={member.instanceId} className={styles.memberBlock} data-governance-member={member.instanceId}>
              <span className={styles.memberName}>{member.label}</span>
              <div className={styles.lanes} data-governance-lanes>
                {rows.map(row => {
                  const hard = hardPolicyDisplay(row)
                  return (
                    <div key={row.lane} className={styles.lane} data-governance-lane={row.lane}>
                      <span className={styles.laneName}>{row.lane}</span>
                      <span className={styles.laneValue}>{row.value ?? '—'}</span>
                      <span className={styles.laneSource}>{row.source}</span>
                      <span className={styles.laneState} data-governance-lane-state={row.state}>{row.stateWord}</span>
                      {row.suppressed === true && <span className={styles.laneFlag}>{t('governance.lane.suppressed')}</span>}
                      {row.unavailable === true && <span className={styles.laneFlag}>{t('governance.lane.unavailable')}</span>}
                      {row.effectiveFrom !== null && (
                        <span className={styles.laneFlag}>{t('governance.lane.effectiveFrom', { step: row.effectiveFrom })}</span>
                      )}
                      {hard !== null && (
                        <span className={styles.hardPolicy} data-governance-hard-policy>
                          {t('governance.hardPolicy', {
                            requested: hard.requested,
                            effective: hard.effective,
                            reason: hard.reason,
                          })}
                        </span>
                      )}
                    </div>
                  )
                })}
              </div>
              <div className={styles.override} data-governance-override>
                <div className={styles.overrideEditor}>
                  <select
                    className={styles.select}
                    data-governance-override-capability
                    value={draft?.capability ?? 'model'}
                    onChange={event => setOverrideDraft(member.instanceId, { capability: event.target.value as RemoteCapability })}
                  >
                    {REMOTE_CAPABILITY_VALUES.map(capability => (
                      <option key={capability} value={capability}>{capability}</option>
                    ))}
                  </select>
                  <select
                    className={styles.select}
                    data-governance-override-kind
                    value={draft?.kind ?? 'allow'}
                    onChange={event => setOverrideDraft(member.instanceId, { kind: event.target.value as OverrideDraft['kind'], items: event.target.value === 'allow' ? (draft?.items ?? '') : '' })}
                  >
                    <option value="allow">{t('governance.policy.entry.allow')}</option>
                    <option value="deny">{t('governance.policy.entry.deny')}</option>
                  </select>
                  {draft?.kind === 'allow' && (
                    <input
                      className={styles.input}
                      type="text"
                      data-governance-override-items
                      value={draft?.items ?? ''}
                      placeholder={t('governance.policy.items')}
                      onChange={event => setOverrideDraft(member.instanceId, { items: event.target.value })}
                    />
                  )}
                  <button
                    type="button"
                    className={styles.secondary}
                    data-governance-override-show
                    onClick={() => {
                      const capability = draft?.capability ?? 'model'
                      runOverrideRead(member.instanceId, capability)
                    }}
                  >
                    {t('governance.override.show')}
                  </button>
                  <button
                    type="button"
                    className={styles.primary}
                    data-governance-override-set
                    disabled={setPendingMark || (draft?.kind === 'allow' && parseItemsField(draft?.items ?? '').length === 0)}
                    onClick={() => runOverrideSet(member, member.instanceId)}
                  >
                    {setPendingMark ? t('governance.pending') : t('governance.override.set')}
                  </button>
                  <button
                    type="button"
                    className={styles.secondary}
                    data-governance-override-reset
                    disabled={resetPendingMark}
                    onClick={() => runOverrideReset(member.instanceId, draft?.capability ?? 'model')}
                  >
                    {resetPendingMark ? t('governance.pending') : t('governance.override.reset')}
                  </button>
                </div>
                {overrideRead !== undefined && (
                  <p className={overrideRead.ok ? styles.note : styles.noteError} data-governance-override-read>
                    {overrideRead.ok
                      ? (overrideRead.wire.override === null
                        ? t('governance.override.none')
                        : `${overrideRead.wire.override['kind'] ?? ''} ${Array.isArray(overrideRead.wire.override['items']) ? `[${(overrideRead.wire.override['items'] as string[]).join(', ')}]` : ''}`.trim())
                      : t('governance.error', { message: overrideRead.message })}
                  </p>
                )}
                {setError !== undefined && (
                  <p className={styles.noteError} data-governance-override-set-error>
                    {t('governance.error', {
                      message: `${setError.code}: ${setError.message}${setError.requestToken !== null ? ` [${setError.requestToken}]` : ''}`,
                    })}
                  </p>
                )}
                {resetError !== undefined && (
                  <p className={styles.noteError} data-governance-override-reset-error>
                    {t('governance.error', {
                      message: `${resetError.code}: ${resetError.message}${resetError.requestToken !== null ? ` [${resetError.requestToken}]` : ''}`,
                    })}
                  </p>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

/**
 * Initialize one policy cell editor draft from the wire cell: a deny
 * entry → `deny`; an allow entry → `allow` + the items joined; no entry
 * → `none`. A locked cell keeps `none` (locked cells are not edited —
 * they render with the locked marker only).
 */
function cellToDraft(cell: PolicyStateCellWire): PolicyCellDraft {
  if (cell.locked) return { kind: 'none', items: '' }
  if (cell.entry === null) return { kind: 'none', items: '' }
  if (cell.entry.kind === 'deny') return { kind: 'deny', items: '' }
  return { kind: 'allow', items: cell.entry.items.join(', ') }
}
