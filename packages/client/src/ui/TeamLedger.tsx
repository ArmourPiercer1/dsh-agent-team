/**
 * The "团队" tab's durable-ledger Events section (P9-T6, plan §8.9 ADAPT,
 * UI §27): the loaded ledger facts as compact single-line rows in durable
 * sequence order (oldest first), capped to the most recent 200 filtered
 * rows with a client-local "load earlier" depth append, the client-local
 * category / instance-or-template filter (UI §27.4), a loud retryable
 * error note for the last typed store failure, and the partial-ledger
 * counted remainder while the catch-up frontier is behind the total.
 *
 * ADAPT (plan §8.9): the legacy `TeamFeed` list-section structure is kept
 * — the same `TeamLedger.module.css` (ex `TeamFeed.module.css`) classes,
 * the compact single-line row with dot / time / type marker / actor /
 * summary, the `title` full-detail affordance, the load-earlier button,
 * the loud error note, the row-click session navigation (D9), and the
 * local window state — while the input is rewritten from the compat
 * `TeamView` (snapshot approvals/messages + wire `olderMessages` +
 * `messagesBefore` anchor paging) to the vNext durable surface: the
 * `TeamUiLedgerModel` over the ledger store's loaded entries. The store
 * pages FORWARD from the ledger head, so the legacy anchor wire-paging arm
 * is gone: "load earlier" is a pure local window deepening over the loaded
 * set, and the legacy counted remainder re-binds to the partial-ledger
 * remainder (`total - completeThrough`).
 *
 * Row families (plan §8.9): one family per frozen fact type, plus the safe
 * generic row for an unknown / future fact type (no throw, no actor or
 * session-link guessing — see `team-ledger-model`).
 */
import { useEffect, useState } from 'react'
import type { PropsLocale } from '@deepseek-ai/dsh-client-ui-slots'
import { StateDot, type StateDotState } from '@deepseek-ai/dsh-client-ui-primitives'
import type { LedgerCategory, ProgressValue } from '../../../contracts/src/index.js'
import type { TeamLedgerState } from '../state/team-ledger-store.js'
import type { TeamUiLedgerModel, TeamUiSnapshot } from '../model/team-ui-snapshot.js'
import {
  TEAM_LEDGER_INITIAL_LIMIT, TEAM_LEDGER_STEP,
  deriveTeamLedgerSection,
  type TeamLedgerEventRow, type TeamLedgerFilter, type TeamLedgerRowKind,
} from '../model/team-ledger-model.js'
import { formatTeamClock } from '../model/team-timeline-model.js'
import type { TeamKey } from './locales.js'
import styles from './TeamLedger.module.css'

/** The Events-section props: the vNext snapshot, the ledger model, the store state, the retry and D9 callbacks, and the dictionary. */
export interface TeamLedgerProps {
  /** The vNext team snapshot (labels + navigation resolution; the team key). */
  readonly snapshot: TeamUiSnapshot
  /** The durable-ledger model over the loaded entries (the adapter's face). */
  readonly ledger: TeamUiLedgerModel
  /** The team's ledger-store state (total / frontier / loading / typed error); `undefined` pre-binding. */
  readonly ledgerState: TeamLedgerState | undefined
  /** Re-request the catch-up episode after a typed failure (the store's `refresh`). */
  readonly onRetry: () => Promise<void>
  /** Switch the current session to the clicked row's session (D9 navigation). */
  readonly onSelectSession: (sessionId: string) => void
  /** The team dictionary translate seat. */
  readonly t: PropsLocale<'team'>['t']
}

/** The closed frozen category filter options (the contracts `LedgerCategory` set). */
const CATEGORY_FILTER_OPTIONS: readonly (readonly [LedgerCategory, TeamKey])[] = [
  ['team', 'view.ledger.filter.team'],
  ['member', 'view.ledger.filter.members'],
  ['lifecycle', 'view.ledger.filter.lifecycle'],
  ['message', 'view.ledger.filter.messages'],
  ['control', 'view.ledger.filter.controls'],
  ['policy', 'view.ledger.filter.policy'],
  ['compatibility', 'view.ledger.filter.compatibility'],
  ['progress', 'view.ledger.filter.progress'],
]

/** The type-marker labels for the eleven known row families (unknown: the raw fact type). */
const FACT_MARKER_KEYS: Readonly<Record<Exclude<TeamLedgerRowKind, 'unknown'>, TeamKey>> = {
  'work-admitted': 'view.ledger.fact.work_admitted',
  'member-created': 'view.ledger.fact.member_created',
  'lifecycle-changed': 'view.ledger.fact.lifecycle',
  'message': 'view.ledger.fact.message',
  'control-request': 'view.ledger.fact.control_request',
  'control-decision': 'view.ledger.fact.control_decision',
  'control-consumed': 'view.ledger.fact.control_consumed',
  'progress-recorded': 'view.ledger.fact.progress',
  'interval-opened': 'view.ledger.fact.interval_opened',
  'interval-closed': 'view.ledger.fact.interval_closed',
  'policy-transitioned': 'view.ledger.fact.policy',
}

/** The frozen decision-value labels; an unknown wire value renders raw (fail-open display). */
const DECISION_KEYS: Readonly<Record<string, TeamKey>> = {
  allow: 'view.ledger.decision.allow',
  deny: 'view.ledger.decision.deny',
  'stale-denied': 'view.ledger.decision.stale_denied',
}

/** The frozen progress-value labels (shared with the Activity section). */
const STATUS_KEYS: Readonly<Record<ProgressValue, TeamKey>> = {
  'in-progress': 'view.activity.in_progress',
  'completed': 'view.activity.completed',
  'blocked': 'view.activity.blocked',
}

/**
 * Map one ledger row onto the StateDot state: a control request is amber
 * while unpaired (no loaded decision) and green once the chain settles;
 * the settled control facts and the interval close read as done; a
 * progress row reads by its frozen value (absent: ongoing); everything
 * else reads as ongoing.
 * @param row - the ledger row.
 * @returns the dot state.
 */
function rowDot(row: TeamLedgerEventRow): StateDotState {
  switch (row.kind) {
    case 'control-request':
      return row.pending ? 'warning' : 'done'
    case 'control-decision':
    case 'control-consumed':
    case 'interval-closed':
      return 'done'
    case 'progress-recorded':
      switch (row.progressValue) {
        case 'completed': return 'done'
        case 'blocked': return 'error'
        case 'in-progress': return 'ongoing'
        case undefined: return 'ongoing'
      }
    default:
      return 'ongoing'
  }
}

/**
 * The row's trailing state badge: the waiting badge on a pending control
 * request, the decision label (+ optional reason) on a control decision,
 * the progress label on a progress row; no badge otherwise.
 * @param row - the ledger row.
 * @param t - the team dictionary translate seat.
 * @returns the badge element, or null.
 */
function stateBadge(row: TeamLedgerEventRow, t: PropsLocale<'team'>['t']): React.JSX.Element | null {
  if (row.kind === 'control-request') {
    if (row.pending === false) return null
    return <span className={styles.state} data-ledger-state data-pending="true">{t('view.ledger.pending')}</span>
  }
  if (row.kind === 'control-decision') {
    const value = row.decisionValue
    if (value === undefined) return null
    const key = DECISION_KEYS[value]
    return (
      <span className={styles.state} data-ledger-state data-decision={value}>
        {key === undefined ? value : t(key)}
        {row.decisionReason !== undefined
          ? <span className={styles.stateReason} data-ledger-state-reason title={row.decisionReason}>{row.decisionReason}</span>
          : null}
      </span>
    )
  }
  if (row.kind === 'progress-recorded') {
    if (row.progressValue === undefined) return null
    return <span className={styles.state} data-ledger-state data-progress={row.progressValue}>{t(STATUS_KEYS[row.progressValue])}</span>
  }
  return null
}

/** The single-row props: the ledger row, the switch callback (absent when the row binds no session), and the dictionary. */
interface LedgerRowProps {
  readonly row: TeamLedgerEventRow
  /** Switch to the row's session; absent when the row binds none. */
  readonly onSelect?: (() => void) | undefined
  readonly t: PropsLocale<'team'>['t']
}

/** One durable-ledger row: time, type marker, actor, one-line summary, and the family's state badge. */
function LedgerRow({ row, onSelect, t }: LedgerRowProps): React.JSX.Element {
  const marker = row.kind === 'unknown'
    ? row.factType
    : t(FACT_MARKER_KEYS[row.kind])
  return (
    <button
      type="button"
      className={styles.row}
      data-ledger-row
      data-ledger-kind={row.kind}
      data-ledger-fact={row.factType}
      disabled={onSelect === undefined}
      onClick={onSelect}
    >
      <span className={styles.dotSlot} aria-hidden="true">
        <StateDot state={rowDot(row)} />
      </span>
      <span className={styles.time} data-ledger-time>{formatTeamClock(row.at)}</span>
      <span className={styles.marker} data-ledger-marker>{marker}</span>
      {row.actorLabel !== ''
        ? <span className={styles.actor} data-ledger-actor>{row.actorLabel}</span>
        : null}
      <span className={styles.summary} data-ledger-summary title={row.detail}>{row.summary}</span>
      {stateBadge(row, t)}
    </button>
  )
}

/**
 * The durable-ledger Events section with the top control bar (the client
 * local filters, the loud typed error + retry, the load-earlier depth
 * append, and the partial-ledger remainder note).
 * @param props - the snapshot, the ledger model, the store state, the
 *   retry and D9 callbacks, and the dictionary.
 * @returns the Events section.
 */
export function TeamLedger(props: TeamLedgerProps): React.JSX.Element {
  const { snapshot, ledger, ledgerState, onRetry, onSelectSession, t } = props
  const [loadedCount, setLoadedCount] = useState(TEAM_LEDGER_INITIAL_LIMIT)
  const [filter, setFilter] = useState<TeamLedgerFilter>({ category: 'all', instanceId: null })
  // A NEW TEAM rebinds the window: the depth and the client-local filter
  // reset, because the loaded set is that team's ledger. Frames of the same
  // team keep the window: arriving events must not jump the viewed window.
  useEffect(() => {
    setLoadedCount(TEAM_LEDGER_INITIAL_LIMIT)
    setFilter({ category: 'all', instanceId: null })
  }, [snapshot.teamSessionId])
  const section = deriveTeamLedgerSection({
    ledger,
    snapshot,
    loadedCount,
    filter,
    total: ledgerState?.total ?? null,
    completeThrough: ledgerState?.completeThrough ?? 0,
  })
  const error = ledgerState?.error
  const errorMessage = error === undefined ? '' : ('reason' in error ? error.reason : error.error.message)
  const loading = ledgerState?.loading ?? false
  const loadEarlier = (): void => {
    setLoadedCount(count => Math.min(count + TEAM_LEDGER_STEP, section.total))
  }
  return (
    <div className={styles.root} data-team-ledger>
      {section.total === 0
        ? (
          <span className={styles.empty} data-ledger-empty>
            {loading ? t('view.ledger.loading') : t('view.ledger.empty')}
          </span>
        )
        : (
          <>
            <div className={styles.top} data-ledger-top>
              <select
                className={styles.filter}
                data-ledger-filter-category
                value={filter.category}
                onChange={event => {
                  const value = event.target.value
                  setFilter(current => ({ ...current, category: value === 'all' ? 'all' : (value as LedgerCategory) }))
                }}
              >
                <option value="all">{t('view.ledger.filter.all')}</option>
                {CATEGORY_FILTER_OPTIONS.map(([category, key]) => (
                  <option key={category} value={category}>{t(key)}</option>
                ))}
              </select>
              <select
                className={styles.filter}
                data-ledger-filter-instance
                value={filter.instanceId ?? ''}
                onChange={event => {
                  const value = event.target.value
                  setFilter(current => ({ ...current, instanceId: value === '' ? null : value }))
                }}
              >
                <option value="">{t('view.ledger.filter.all')}</option>
                {snapshot.members.map(member => (
                  <option key={member.instanceId} value={member.instanceId}>{member.label}</option>
                ))}
                {snapshot.templates.map(template => (
                  <option key={template.templateId} value={template.templateId}>{template.displayName}</option>
                ))}
              </select>
              {error !== undefined
                ? <span className={styles.loadFailed} data-ledger-error>{t('view.ledger.loadFailed', { message: errorMessage })}</span>
                : null}
              {error !== undefined
                ? (
                  <button
                    type="button"
                    className={styles.loadEarlier}
                    data-ledger-retry
                    onClick={() => { void onRetry() }}
                  >
                    {t('view.ledger.retry')}
                  </button>
                )
                : null}
              {section.hasMore
                ? (
                  <button
                    type="button"
                    className={styles.loadEarlier}
                    data-ledger-load-earlier
                    disabled={loading}
                    onClick={loadEarlier}
                  >
                    {t('view.ledger.loadEarlier')}
                  </button>
                )
                : null}
              {section.complete === false && section.remainingCount > 0
                ? <span className={styles.truncated} data-ledger-remaining>{t('view.ledger.remaining', { count: section.remainingCount })}</span>
                : null}
            </div>
            <div className={styles.rows}>
              {section.rows.map(row => (
                <LedgerRow
                  key={row.key}
                  row={row}
                  onSelect={row.navigationSessionId === '' ? undefined : () => { onSelectSession(row.navigationSessionId) }}
                  t={t}
                />
              ))}
            </div>
          </>
        )}
    </div>
  )
}
