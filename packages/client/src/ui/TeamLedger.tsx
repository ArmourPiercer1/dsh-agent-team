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
 * remainder (`total` minus the loaded entry count — count domain per
 * INV-9.2; the sequence frontier never subtracts from the total). The
 * loud error note + retry also renders in the zero-rows branch, where a
 * typed failure is no longer swallowed by the plain empty note (F11
 * companion; NOTES L208 OBS(1)).
 *
 * Row families (plan §8.9): one family per frozen fact type, plus the safe
 * generic row for an unknown / future fact type (no throw, no actor or
 * session-link guessing — see `team-ledger-model`).
 */
import { Fragment, useEffect, useMemo, useState } from 'react'
import type { PropsLocale } from '@deepseek-ai/dsh-client-ui-slots'
import { StateDot, type StateDotState } from '@deepseek-ai/dsh-client-ui-primitives'
import type { LedgerCategory, ProgressValue } from '../../../contracts/src/index.js'
import type { RemoteResponse } from '../../../remote/src/index.js'
import type { TeamLedgerState } from '../state/team-ledger-store.js'
import type {
  TeamUiControlChain, TeamUiControlRenderMode, TeamUiLedgerModel, TeamUiSnapshot,
} from '../model/team-ui-snapshot.js'
import {
  TEAM_LEDGER_INITIAL_LIMIT, TEAM_LEDGER_STEP,
  deriveTeamLedgerSection,
  type TeamLedgerEventRow, type TeamLedgerFilter, type TeamLedgerRowKind,
} from '../model/team-ledger-model.js'
import {
  humanMayResolveControlKind,
  requestedAuthorityForKind,
  type ControlSurfaceMode,
} from '../model/control-surface.js'
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
  /**
   * F9 (F3/F11/F9/T1.4 repair round r1, remote contract v4) — the human
   * control-resolution command (`team.resolveControl`): resolve ONE
   * pending control-request row (allow / deny) as the trusted
   * authenticated operator. The HOST derives the human principal (the
   * closed v4 wire carries no caller/role fields — adjudication U3);
   * the frozen resolver-role closure + the durable exactly-once
   * semantics stay the only authority — a typed failure (already-
   * decided / not-found / resolver-not-authorized / stale / external-
   * policy) is rendered as the row's typed error note, never
   * swallowed. ABSENT → the surface renders no commands (the legacy
   * surface is unchanged).
   * @param teamSessionId - the team (root) session id of the addressed row.
   * @param requestId - the row's durable control request id.
   * @param decision - the frozen decision the human makes.
   * @returns the typed `RemoteResponse` (never exception-ified); the
   *   promise rejects ONLY on transport-level channel loss (the frozen
   *   `PushTransportLossError`).
   */
  readonly onResolveControl?: (
    teamSessionId: string,
    requestId: string,
    decision: 'allow' | 'deny',
  ) => Promise<RemoteResponse>
  /**
   * F9U (gate-review supplement, served-version gating) — the mode the
   * view's side-effect-free v4 probe resolved for the SERVED host
   * (remote contract v4 vs a pre-v4 build):
   *
   * - `'enabled'` — the served host serves the v4-only
   *   `team.resolveControl`; the Allow / Deny commands are LIVE (subject
   *   to the kind-aware closed human resolver-role map);
   * - `'read-only'` — the served host is pre-v4 (the probe answered a
   *   typed `unknown-method` / version-unsupported error); the UI §26.2
   *   detail panel stays visible for the pending state, the commands do
   *   NOT render (the v3 surface is read-only — never a silent allow);
   * - ABSENT — the probe has not settled (in flight / a transport
   *   rejection left it unresolved): FAIL-CLOSED — no command affordance
   *   yet (the detail panel renders, the commands wait for the v4 proof).
   *
   * The probe is exclusive to the view (it names the `/team-remote`
   * channel through the face); this prop is the mode's display input
   * only.
   */
  readonly controlSurfaceMode?: ControlSurfaceMode
  /**
   * A4-W6 (owner ruling 2026-10-09) — the ledger SEQUENCES the v9
   * corrupt-leg read (`team.listCorruptControlLegs`, fetched by the view)
   * names as refused by the strict control reader. The join key is the
   * durable LEDGER SEQUENCE, never the requestId: a corrupt row may not
   * even disclose one. Rows in this set render the client-owned
   * `corrupt-record` presentation — honest marker, BOTH commands
   * disabled, entry STAYS visible. ABSENT (pre-v9 host, or the read not
   * yet settled / failed) → no corruption marking, exactly the previous
   * behaviour; the strict reader is never re-implemented here.
   */
  readonly corruptControlSequences?: ReadonlySet<number>
  /** The team dictionary translate seat. */
  readonly t: PropsLocale<'team'>['t']
}

/**
 * F9 — the per-request state of one human control-resolution command
 * flight (Allow / Deny on a pending control-request row): `busy` while
 * the v4 `team.resolveControl` round trip is in flight, `error` for the
 * typed failure (the frozen control vocabulary code + message) or the
 * transport-level loss. No other state exists: a successful resolution
 * CLEARS the entry (the catch-up re-pull then settles the row's badge
 * through the ordinary ledger flow).
 */
type ResolveControlState =
  | { readonly phase: 'busy' }
  | { readonly phase: 'error'; readonly code: string; readonly message: string }

/**
 * PR #56 — the fixed wire-style label of one control-chain rendering
 * mode (the explicit compat-class label in the detail panel; wire
 * tokens — deliberately identical across dictionaries, never
 * translated).
 */
function controlRenderModeLabel(
  mode: TeamUiControlRenderMode,
  t: PropsLocale<'team'>['t'],
): string {
  switch (mode) {
    case 'recovery-v1':
      return 'recovery-dispatch/v1'
    case 'legacy-compat':
      return 'legacy-compatible'
    case 'unsupported-subject':
      return 'unsupported-subject'
    case 'corrupt-record':
      // A4-W6 — the deliberate departure from the wire-token rule: this
      // label is not protocol, it is the truth a human must read in place
      // ("this record cannot be adjudicated"), and it is the ONLY mode the
      // client derives itself (from the v9 corrupt-leg read), so it is
      // locale copy (owner-ruled wording 2026-10-09).
      return t('view.corruption.entryCorrupt')
    case 'standard':
      return 'standard'
  }
}

/**
 * PR #56 — the SAFE TEXT presentation of the full review payload: a
 * React TEXT NODE (rendered inside <pre> — absolutely no
 * dangerouslySetInnerHTML / no HTML interpretation; a hostile payload
 * value stays inert text). The FULL value is serialized (never
 * sampled, never truncated; the block scrolls — see
 * `.controlPayload`); an unexpected serializer failure falls back to
 * `String(value)` text (never a throw, never an invented value). This
 * is presentation formatting ONLY — NOT canonicalization and NOT
 * verification (the client ships no canonicalizer / hash; the digest
 * renders as wire-sourced evidence).
 */
function renderReviewPayloadText(value: TeamUiControlChain['reviewPayload']): string {
  try {
    const text = JSON.stringify(value, null, 2)
    return typeof text === 'string' ? text : String(value)
  } catch {
    return String(value)
  }
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
    'governance-proposal': 'view.ledger.fact.governance_proposal',
    'control-escalation': 'view.ledger.fact.control_escalation',
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
 * else reads as ongoing. A4-W6: a control request the corrupt-leg read
 * names reads as ERROR (the governance §6.C precedent: a corrupt record
 * is never a quiet wait).
 * @param row - the ledger row.
 * @param corrupt - A4-W6: the corrupt-leg read names this row's sequence.
 * @returns the dot state.
 */
function rowDot(row: TeamLedgerEventRow, corrupt: boolean): StateDotState {
  switch (row.kind) {
    case 'control-request':
      return corrupt ? 'error' : row.pending ? 'warning' : 'done'
    case 'control-decision':
    case 'control-consumed':
    case 'interval-closed':
    case 'control-escalation':
      return 'done'
    case 'governance-proposal':
      // §6.C: an incomplete durable proposal set is an ERROR state on the
      // row, never the neutral dot — the UI cannot show a quiet wait for a
      // record that cannot be a proposal.
      return row.governanceRecordStatus === 'corrupt' ? 'error' : 'ongoing'
    case 'progress-recorded':
      switch (row.progressValue) {
        case 'completed': return 'done'
        case 'blocked': return 'error'
        case 'in-progress': return 'ongoing'
        case undefined: return 'ongoing'
      }
      // falls through
    default:
      return 'ongoing'
  }
}

/**
 * The row's trailing state badge: the waiting badge on a pending control
 * request, the decision label (+ optional reason) on a control decision,
 * the progress label on a progress row; no badge otherwise. A4-W6: a
 * control request the corrupt-leg read names carries the HONEST marker
 * INSTEAD of the waiting badge — whatever its client-side `pending` read
 * is (a corrupt row with an unreadable requestId never reads pending in
 * the row model, yet it is exactly the class that must disclose itself).
 * @param row - the ledger row.
 * @param t - the team dictionary translate seat.
 * @param corrupt - A4-W6: the corrupt-leg read names this row's sequence.
 * @returns the badge element, or null.
 */
function stateBadge(
  row: TeamLedgerEventRow,
  t: PropsLocale<'team'>['t'],
  corrupt: boolean,
): React.JSX.Element | null {
  if (row.kind === 'control-request') {
    if (corrupt) {
      return (
        <span className={styles.state} data-ledger-state data-corrupt-record="true">
          {t('view.corruption.entryCorrupt')}
        </span>
      )
    }
    if (row.pending === false) return null
    return <span className={styles.state} data-ledger-state data-pending="true">{t('view.ledger.pending')}</span>
  }
  if (row.kind === 'control-decision') {
    const value = row.decisionValue
    if (value === undefined) return null
    // F9U (UI §26.4): the frozen two-line display for the closed
    // combination where the team (human) decision was ALLOW but the
    // external DSH hard policy blocked the execution — the durable row
    // records it as a `deny` decision with the frozen `external-policy`
    // reason. The badge renders the frozen "Team decision: Allowed /
    // Execution: Blocked by managed policy" block and NEVER the plain
    // "denied" label (UI §26.4: it must not be displayed as an approval
    // failure).
    if (row.decisionReason === 'external-policy') {
      return (
        <span className={styles.state} data-ledger-state data-decision={value} data-external-policy="true">
          <span className={styles.externalPolicyLine} data-external-policy-team-decision>{t('view.ledger.externalPolicy.teamDecision')}</span>
          <span className={styles.externalPolicyLine} data-external-policy-execution>{t('view.ledger.externalPolicy.execution')}</span>
        </span>
      )
    }
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
  /** A4-W6: the corrupt-leg read names this row's ledger sequence. */
  readonly corrupt?: boolean
  readonly t: PropsLocale<'team'>['t']
}

/** One durable-ledger row: time, type marker, actor, one-line summary, and the family's state badge. */
function LedgerRow({ row, onSelect, corrupt = false, t }: LedgerRowProps): React.JSX.Element {
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
        <StateDot state={rowDot(row, corrupt)} />
      </span>
      <span className={styles.time} data-ledger-time>{formatTeamClock(row.at)}</span>
      <span className={styles.marker} data-ledger-marker>{marker}</span>
      {row.actorLabel !== ''
        ? <span className={styles.actor} data-ledger-actor>{row.actorLabel}</span>
        : null}
      <span className={styles.summary} data-ledger-summary title={row.detail}>{row.summary}</span>
      {stateBadge(row, t, corrupt)}
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
    setResolveStates(new Map())
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
  // F9 — the per-request command flights (keyed by the durable control
  // request id): the Allow/Deny busy state + the typed error note.
  const [resolveStates, setResolveStates] = useState<ReadonlyMap<string, ResolveControlState>>(new Map())
  const runResolve = (requestId: string, decision: 'allow' | 'deny'): void => {
    const resolve = props.onResolveControl
    if (resolve === undefined) return
    const teamSessionId = snapshot.teamSessionId
    setResolveStates(prev => new Map(prev).set(requestId, { phase: 'busy' }))
    resolve(teamSessionId, requestId, decision).then(
      response => {
        setResolveStates(prev => {
          const next = new Map(prev)
          next.delete(requestId)
          if (response.ok === false) {
            // The typed failure (the frozen control vocabulary, invariant
            // 4b pass-through): rendered as the row's typed error note —
            // never swallowed, never exception-ified.
            next.set(requestId, {
              phase: 'error',
              code: response.error.code,
              message: response.error.message,
            })
          }
          return next
        })
        // The catch-up re-pull (the same discipline as a typed store
        // failure): the decision fact settles the row's pending badge —
        // including the typed failures that record a durable decision
        // FIRST (stale / external-policy close the request durably).
        void onRetry()
      },
      (fail: unknown) => {
        // Transport-level channel loss (the ONLY rejection kind): the
        // row stays pending with the loud loss note.
        setResolveStates(prev => new Map(prev).set(requestId, {
          phase: 'error',
          code: 'transport-loss',
          message: fail instanceof Error ? fail.message : String(fail),
        }))
      },
    )
  }
  // F9U (UI §26.2) — the §26.2 detail-panel join: the loaded control
  // chain per durable request id. The detail fields ride the PAIRED
  // chain (the S3-B control-chain model) — fail-safe: a pending row
  // whose chain is absent (broken identity leaves) renders the
  // row-derived fields only, never an invented value.
  const chainByRequest = useMemo(() => {
    const map = new Map<string, TeamUiControlChain>()
    for (const chain of ledger.controls) {
      if (chain.requestId !== '' && map.has(chain.requestId) === false) map.set(chain.requestId, chain)
    }
    return map
  }, [ledger.controls])
  /**
   * A4-W6 — the SEQUENCE join (the whole point of the join, stated once):
   * a corrupt row may not disclose a readable requestId, so the id is
   * useless as the join key; the durable LEDGER SEQUENCE is the identity
   * both the ledger read and the v9 corrupt-leg read carry. This is the
   * ONLY corruption predicate in this component: the strict reader is
   * never re-implemented client-side (a client mirror of it would be a
   * second authority over governability), and no ledger field is
   * re-interpreted here.
   * @param row - the ledger row.
   * @returns true when the corrupt-leg read names this row's sequence.
   */
  const isCorruptRow = (row: TeamLedgerEventRow): boolean =>
    props.corruptControlSequences?.has(row.sequence) === true
  /**
   * F9 / F9U — the contextual decision panel under one row: rendered
   * ONLY for a pending control-request row that carries a durable
   * request id, while the `onResolveControl` face is present (absent
   * face → no panel, the legacy surface unchanged). The panel is a
   * SIBLING of the row button (the row is a `<button>` — nested
   * buttons are invalid HTML).
   *
   * F9U (gate-review supplements):
   *  - the UI §26.2 control-request DETAIL fields (requester / request
   *    kind / requested operation / tool / reason / creation time /
   *    current status / requested authority) always render for the
   *    pending state;
   *  - the Allow / Deny affordance is KIND-AWARE (the closed human
   *    resolver-role map: a closed kind whose role set includes
   *    'human' → the commands render; an unknown / absent kind → the
   *    panel shows, the command does NOT — fail-closed) AND gated by
   *    the SERVED version (the view's v4 probe: 'enabled' → live,
   *    'read-only' → the v3 surface is read-only with the note,
   *    absent / unresolved → fail-closed: no command affordance yet).
   */
  const renderControlPanel = (row: TeamLedgerEventRow): React.JSX.Element | null => {
    if (
      props.onResolveControl === undefined
      || row.kind !== 'control-request'
      || row.pending === false
      || row.requestId === undefined
    ) {
      return null
    }
    const requestId = row.requestId
    const chain = chainByRequest.get(requestId)
    // A4-W6 — sequence join (see `isCorruptRow`); the chain's own
    // `requestSequence` is the same durable fact, asserted equal by the
    // adapter's construction, so the row's sequence is the key used.
    const corrupt = isCorruptRow(row)
    const state = resolveStates.get(requestId)
    const busy = state !== undefined && state.phase === 'busy'
    // F9U — the kind-aware affordance (supplement 3): the closed human
    // resolver-role map is the ONLY authority for the command
    // affordance — a kind absent from the map (unknown / future wire
    // value, or an absent leaf) grants NO human resolution.
    const humanMayResolve = humanMayResolveControlKind(chain?.kind)
    // F9U — the served-version gate (supplement 4): the commands render
    // ONLY when the probe proved the SERVED host serves v4 (absent /
    // unresolved mode → fail-closed: the detail panel stays, the
    // commands do not).
    const surfaceEnabled = props.controlSurfaceMode === 'enabled'
    const showCommands = surfaceEnabled && humanMayResolve
    // UI §26.2 "requester": the durable ControlCallerRef — an instance
    // ref resolves through the snapshot member rows (the raw id is the
    // display fallback), a human ref renders the fixed human label.
    const requesterId = chain?.requesterId
    const requesterLabel =
      requesterId === undefined
        ? undefined
        : chain?.requesterRefKind === 'human'
          ? t('view.ledger.control.human')
          : snapshot.members.find(member => member.instanceId === requesterId)?.label ?? requesterId
    // UI §26.2 "requested authority": the closed resolver role set for
    // the closed kind; ABSENT for an unknown kind (never invented).
    const authority = requestedAuthorityForKind(chain?.kind)
    // PR #56 (3) — the DISPLAY-SIDE recovery-integrity gate (client only;
    // the backend authority is untouched): an integrity verdict of
    // `incomplete` (a v1 request whose reviewPayload is missing /
    // corrupted or whose digest is absent / shape-invalid — SHAPE
    // validation only; or the DEFENSIVE digest-without-payload guard,
    // a shape the current backend cannot produce) → an explicit banner +
    // ALLOW DISABLED (deny keeps its existing safe semantics; never a
    // silent omit-then-approve). The client ships no canonicalization /
    // hash: display ≠ verification.
    const cannotFullyReview = chain?.reviewIntegrity === 'incomplete'
    // PR #56 (1) — an unsupported subject is non-decidable too (the
    // request stays VISIBLE, Allow disabled).
    // A4-W6 (owner ruling 2026-10-09) closes the remaining half: an
    // unsupported-subject row is NOT GOVERNABLE AT ALL — the server
    // refuses any resolution of it (`CONTROL_REQUEST_NOT_FOUND` before
    // any write) — so DENY is disabled too, and a corrupt row (named by
    // the sequence join) disables both. The rows stay VISIBLE: truth
    // shown, invalid entry point removed. The `unsupported-subject` arm
    // needs NO corruption read, so a pre-v9 host without the corrupt-leg
    // read plane stays consistent.
    const allowBlocked =
      cannotFullyReview || chain?.renderMode === 'unsupported-subject' || corrupt
    const denyBlocked = corrupt || chain?.renderMode === 'unsupported-subject'
    return (
      <div
        className={styles.resolveBar}
        data-ledger-resolve-bar
        data-request-id={requestId}
        data-control-surface={props.controlSurfaceMode ?? 'unresolved'}
        data-corrupt-record={corrupt ? 'true' : undefined}
      >
        <dl className={styles.controlDetail} data-control-detail>
          {requesterLabel !== undefined
            ? (
              <div className={styles.controlField} data-control-detail-requester>
                <dt>{t('view.ledger.control.requester')}</dt>
                <dd>{requesterLabel}</dd>
              </div>
            )
            : null}
          {chain?.kind !== undefined
            ? (
              <div className={styles.controlField} data-control-detail-kind>
                <dt>{t('view.ledger.control.kind')}</dt>
                <dd>{chain.kind}</dd>
              </div>
            )
            : null}
          {chain?.actionName !== undefined
            ? (
              <div className={styles.controlField} data-control-detail-action>
                <dt>{t('view.ledger.control.action')}</dt>
                <dd>{chain.actionName}</dd>
              </div>
            )
            : null}
          {chain?.toolName !== undefined
            ? (
              <div className={styles.controlField} data-control-detail-tool>
                <dt>{t('view.ledger.control.tool')}</dt>
                <dd>{chain.toolName}</dd>
              </div>
            )
            : null}
          {chain?.summary !== undefined
            ? (
              <div className={styles.controlField} data-control-detail-reason>
                <dt>{t('view.ledger.control.reason')}</dt>
                <dd>{chain.summary}</dd>
              </div>
            )
            : null}
          <div className={styles.controlField} data-control-detail-time>
            <dt>{t('view.ledger.control.time')}</dt>
            <dd>{formatTeamClock(row.at)}</dd>
          </div>
          <div className={styles.controlField} data-control-detail-status>
            <dt>{t('view.ledger.control.status')}</dt>
            {/* A4-W6: a corrupt record is NOT awaiting adjudication — the
                waiting label would restart the ghost invitation inside the
                panel the row badge just made honest. */}
            <dd data-status-corrupt={corrupt ? 'true' : undefined}>
              {corrupt ? t('view.corruption.entryCorrupt') : t('view.ledger.control.status.pending')}
            </dd>
          </div>
          {authority !== undefined
            ? (
              <div className={styles.controlField} data-control-detail-authority>
                <dt>{t('view.ledger.control.authority')}</dt>
                <dd>{authority.join(' / ')}</dd>
              </div>
            )
            : null}
          {/* PR #56 (1) — the durable control subject verbatim (closed
              canonical map; ABSENT never invented). An unsupported
              subject renders the RAW kind leaf (never a guessed id). */}
          {chain?.subject !== undefined
            ? (
              <div
                className={styles.controlField}
                data-control-detail-subject
                data-subject-kind={chain.subject.kind}
                data-subject-id={chain.subject.id}
              >
                <dt>{t('view.ledger.control.subject')}</dt>
                <dd>{`${chain.subject.kind}:${chain.subject.id}`}</dd>
              </div>
            )
            : chain?.subjectKindRaw !== undefined
              ? (
                <div
                  className={styles.controlField}
                  data-control-detail-subject
                  data-subject-kind="unsupported"
                >
                  <dt>{t('view.ledger.control.subject')}</dt>
                  <dd>{`unsupported (${chain.subjectKindRaw})`}</dd>
                </div>
              )
              : null}
          {/* PR #56 (2) — the requestId as a VISIBLE field (screenshots
              must carry the binding; the data-request-id attribute is
              insufficient). */}
          <div className={styles.controlField} data-control-detail-request-id>
            <dt>{t('view.ledger.control.requestId')}</dt>
            <dd>{requestId}</dd>
          </div>
          {/* PR #56 — the explicit rendering mode label (compat classes
              stay distinguishable on screen and in evidence). A4-W6: a
              corrupt row's EFFECTIVE mode is the client-owned
              `corrupt-record` — it outranks the adapter's chain-level
              class (the strict reader refused the whole row, whatever
              fragment the tolerant adapter could still read). */}
          {(corrupt ? true : chain?.renderMode !== undefined)
            ? (
              <div
                className={styles.controlField}
                data-control-detail-render-mode
                data-render-mode={corrupt ? 'corrupt-record' : chain?.renderMode}
              >
                <dt>{t('view.ledger.control.renderMode')}</dt>
                <dd>{controlRenderModeLabel(corrupt ? 'corrupt-record' : chain?.renderMode ?? 'standard', t)}</dd>
              </div>
            )
            : null}
          {/* PR #56 (2) — the FULL wire digest verbatim, labeled
              wire-sourced (SHAPE is not re-verified client-side: no
              product-side hash — display ≠ verification). */}
          {chain?.reviewPayloadDigest !== undefined
            ? (
              <div className={styles.controlField} data-control-detail-digest data-digest-source="ledger-wire">
                <dt>{t('view.ledger.control.digest')}</dt>
                <dd className={styles.controlDigestValue}>{chain.reviewPayloadDigest}</dd>
              </div>
            )
            : null}
          {/* PR #56 (2) — the FULL reviewPayload as SAFE TEXT: a React
              text node inside <pre> (absolutely no
              dangerouslySetInnerHTML / HTML interpretation); full
              content, scrollable, NEVER truncated; an absent payload
              OMITS the block entirely (no 'null' invention). */}
          {chain?.reviewPayload !== undefined
            ? (
              <div className={`${styles.controlField} ${styles.controlFieldWide}`} data-control-detail-payload>
                <dt>{t('view.ledger.control.payload')}</dt>
                <dd>
                  <pre className={styles.controlPayload}>{renderReviewPayloadText(chain.reviewPayload)}</pre>
                </dd>
              </div>
            )
            : null}
        </dl>
        {cannotFullyReview
          ? (
            <span className={styles.cannotReview} data-control-detail-cannot-review role="alert">
              {t('view.ledger.control.cannotReview')}
            </span>
          )
          : null}
        {showCommands
          ? (
            <>
              <button
                type="button"
                className={styles.resolveBtn}
                data-ledger-resolve-allow
                data-allow-blocked={allowBlocked ? 'true' : undefined}
                disabled={busy || allowBlocked}
                onClick={() => { runResolve(requestId, 'allow') }}
              >
                {t('view.ledger.resolve.allow')}
              </button>
              <button
                type="button"
                className={styles.resolveBtn}
                data-ledger-resolve-deny
                data-deny-blocked={denyBlocked ? 'true' : undefined}
                disabled={busy || denyBlocked}
                onClick={() => { runResolve(requestId, 'deny') }}
              >
                {t('view.ledger.resolve.deny')}
              </button>
              {busy
                ? <span className={styles.resolveBusy} data-ledger-resolve-busy>{t('view.ledger.resolve.busy')}</span>
                : null}
            </>
          )
          : null}
        {props.controlSurfaceMode === 'read-only'
          ? (
            <span className={styles.readOnlyNote} data-control-surface-read-only>
              {t('view.ledger.control.readOnly')}
            </span>
          )
          : null}
        {state !== undefined && state.phase === 'error'
          ? (
            <span
              className={styles.resolveError}
              data-ledger-resolve-error
              data-resolve-error-code={state.code}
              title={state.message}
            >
              {t('view.ledger.resolve.error', { code: state.code, message: state.message })}
            </span>
          )
          : null}
      </div>
    )
  }
  const loadEarlier = (): void => {
    setLoadedCount(count => Math.min(count + TEAM_LEDGER_STEP, section.total))
  }
  return (
    <div className={styles.root} data-team-ledger>
      {section.total === 0
        ? (
          // F11 companion: a typed failure in the zero-rows state is the
          // LOUD error + retry, never the plain empty/loading note (the
          // pre-fix empty span swallowed the tracker reject / RPC error).
          error !== undefined
            ? (
              <div className={styles.top} data-ledger-top>
                <span className={styles.loadFailed} data-ledger-error>{t('view.ledger.loadFailed', { message: errorMessage })}</span>
                <button
                  type="button"
                  className={styles.loadEarlier}
                  data-ledger-retry
                  onClick={() => { void onRetry() }}
                >
                  {t('view.ledger.retry')}
                </button>
              </div>
            )
            : (
              <span className={styles.empty} data-ledger-empty>
                {loading ? t('view.ledger.loading') : t('view.ledger.empty')}
              </span>
            )
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
                <Fragment key={row.key}>
                  <LedgerRow
                    row={row}
                    onSelect={row.navigationSessionId === '' ? undefined : () => { onSelectSession(row.navigationSessionId) }}
                    corrupt={isCorruptRow(row)}
                    t={t}
                  />
                  {renderControlPanel(row)}
                </Fragment>
              ))}
            </div>
          </>
        )}
    </div>
  )
}
