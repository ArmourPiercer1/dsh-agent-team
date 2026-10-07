/**
 * P9-T6 — pure projection of the durable ledger onto the "团队" tab's
 * Events section (plan §8.8 ADAPT, UI §27): the loaded ledger facts become
 * compact single-line rows in one ascending order (oldest first), rendered
 * capped to the most recent `loadedCount` rows (default 200) with the
 * "load earlier" depth carried as a plain count, plus the client-local
 * category / instance filter (UI §27.4) applied before the window.
 *
 * ADAPT per plan §8.8: the algorithm parts of the legacy
 * `team-feed-model` are reused — the frozen 200/200 depth constants, the
 * ascending view semantics, the stable row-key idea, the visible-window
 * logic, the filter/window UI model, and the error + remainder concept —
 * while the data source is rewritten. The legacy input (snapshot
 * `approvals` / `messages` / wire `olderMessages` / `messagesBefore`
 * anchor) becomes `TeamUiLedgerModel.entries` (+ the store's completeness
 * facts). The sort identity is the durable `sequence` — never
 * timestamp-only (plan §8.8). The ledger store pages FORWARD from the
 * ledger head, so there is no "older than loaded" state: the depth append
 * over the loaded set covers everything displayable, and the legacy
 * counted-remainder fact re-binds to the partial-ledger remainder
 * (`total` minus the LOADED UNIQUE ENTRY COUNT — a count-domain rule per
 * INV-9.2; the sequence frontier never subtracts from the total).
 *
 * Row families (plan §8.9): one family per frozen fact type, plus the
 * safe GENERIC row for unknown / future fact types (factType + sequence +
 * createdAt + a lossless-safe serialized payload summary; no actor or
 * session-link guessing; the panel never throws on an unknown type).
 *
 * Every payload leaf read is FAIL-SAFE (`typeof` guards, the
 * `ledger-adapter` discipline): a leaf the row needs but lacks means the
 * row shows less, never an invented value. Instance labels and session
 * navigation targets resolve through the snapshot member rows — the raw
 * id is the display fallback, and a row whose instance resolves to no
 * snapshot member carries no navigation (inert row, no guessing).
 */
import type { LedgerCategory, ProgressValue } from '../../../contracts/src/index.js'
import type {
  TeamUiLedgerModel, TeamUiLedgerRow, TeamUiSnapshot,
} from './team-ui-snapshot.js'

/** The first-render depth (plan §8.8: the legacy TEAM_FEED_INITIAL_LIMIT = 200). */
export const TEAM_LEDGER_INITIAL_LIMIT = 200

/** The "load earlier" depth step (plan §8.8: the legacy TEAM_FEED_STEP = 200). */
export const TEAM_LEDGER_STEP = 200

/**
 * The row families of the Events section: one per frozen fact type, plus
 * the generic family for a fact type unknown to the frozen vocabulary.
 */
export type TeamLedgerRowKind =
  | 'work-admitted'
  | 'member-created'
  | 'lifecycle-changed'
  | 'message'
  | 'control-request'
  | 'control-decision'
  | 'control-consumed'
  | 'progress-recorded'
  | 'interval-opened'
  | 'interval-closed'
  | 'policy-transitioned'
  // A4-PR6 §6.C — the governance families. These rows render STRUCTURED:
  // the §6.C renderer law says a governance row never lands in the generic
  // JSON-dumped Event row, so each fact type the PR introduces either joins
  // INTERNAL_FACT_TYPES (the warning family: audit rows whose surface is
  // TeamInterventions) or gets a structured family here. A row WITHOUT a
  // family falls to `unknown`, and the unknown family serializes the whole
  // payload — the exact failure mode the renderer test must keep impossible.
  | 'governance-proposal'
  | 'control-escalation'
  | 'unknown'

/** The closed fact-type → family map (the client-local frozen vocabulary). */
const FACT_ROW_KIND: Readonly<Record<string, TeamLedgerRowKind>> = {
  'team-work-admitted': 'work-admitted',
  'provision-member-instance': 'member-created',
  'member-lifecycle-changed': 'lifecycle-changed',
  'team-message-delivered': 'message',
  'team-coordination-recorded': 'message',
  'control-request-recorded': 'control-request',
  'control-decision-recorded': 'control-decision',
  'control-allow-consumed': 'control-consumed',
  'activity-progress-recorded': 'progress-recorded',
  'activity-interval-opened': 'interval-opened',
  'activity-interval-closed': 'interval-closed',
  'policy-state-transitioned': 'policy-transitioned',
  // A4-PR6 §6.C: structured families, never the `unknown` serializer.
  'governance-proposal-recorded': 'governance-proposal',
  'control-escalation-recorded': 'control-escalation',
}

/**
 * The INTERNAL authority fact types that never become Events rows
 * (PR #26 P2 — the client Team Events hygiene): they are Team
 * authority/audit state, not user activity. They stay in the loaded
 * ledger model (`entries` — the raw projection / TeamLedger) and only
 * the Events section skips them: without the skip, `artifact-read-granted`
 * lands in the `unknown` family and the generic row `JSON.stringify`s
 * the whole payload — exposing the spill locator and the opaque
 * target/version digests in the activity feed.
 */
const INTERNAL_FACT_TYPES: ReadonlySet<string> = new Set([
  'artifact-read-granted',
  // A4-PR6 §6.C (first half): the governance-warning family. These are
  // authority-consistency audit rows, not user activity; the Events section
  // would otherwise drop them into the `unknown` family and the generic row
  // would JSON.stringify a whole envelope-consistency verdict (the exact
  // shape §6.C's renderer law forbids). The warning's surface is
  // TeamInterventions (v8 `intervention.list`), fed by the same durable
  // fold the host reads.
  'governance-warning-observed',
  'governance-warning-acknowledged',
  // A4-PR6 review round 1 (fix 4/6) — the plan:1031 rendering decision for
  // the PRE-ALPHA3 PR-D close fact. Its category registration landed in
  // PR0 (`control`), but the RENDERING layer was PR6's explicit check, and
  // the fact was in NEITHER `FACT_ROW_KIND` NOR this set: `?? 'unknown'`
  // made it a generic row that JSON.stringify'd the whole abandonment
  // payload — the exact shape §6.C's renderer law forbids. The DECISION is
  // the skip, not a structured family: `control-request-abandoned` is the
  // TERMINAL audit close of a control request, and its surface already
  // exists — `ledger-adapter.adaptControlAbandonDraft` pairs it onto its
  // request chain by the frozen `requestId` (the chain never displays
  // pending, never offers Allow; the coordinator-ruled PR #56 uniformity).
  // A second Events row would double-surface one close with a payload that
  // carries no subject leaf to render.
  'control-request-abandoned',
  // pre-alpha3 PR-C §C.7: the durable capability readiness telemetry — an
  // operational compatibility-category fact, not user activity. Skipped by
  // the Events section (otherwise it would land in the `unknown` family and
  // the generic row would JSON.stringify the whole telemetry payload).
  'capability-runtime-event',
  // pre-alpha3 PR-E §E.5: the requirement / recovery durable facts —
  // compatibility-category authority/audit state (the DegradationConsent,
  // the template disable/enable, and the recovery-incident open/close
  // records). A dedicated UI row kind for these is separate work; until
  // then they stay in the loaded ledger model and are skipped by the Events
  // section (otherwise each would land in the `unknown` family and the
  // generic row would JSON.stringify the whole payload).
  'optional-requirement-accepted',
  'template-availability-set',
  'recovery-incident-opened',
  'recovery-incident-closed',
])

/** One rendered Events-section row (one loaded ledger fact). */
export interface TeamLedgerEventRow {
  readonly kind: TeamLedgerRowKind
  /** The stable React key across frames: the durable sequence. */
  readonly key: string
  /** The durable ledger sequence (the row's position in the order). */
  readonly sequence: number
  /** The event time in epoch ms (display only; the identity is the sequence). */
  readonly at: number
  readonly factType: string
  /** The frozen category; ABSENT for an unknown fact type (never guessed). */
  readonly category?: LedgerCategory
  /** The instance the fact names (fail-safe leaf); '' when the fact names none. */
  readonly actorInstanceId: string
  /** The actor's resolved label; the raw id when no member row matches; '' when no actor. */
  readonly actorLabel: string
  /** The one-line summary rendered in the row. */
  readonly summary: string
  /** The full detail text (the row's `title` affordance, UI §27.3 expand). */
  readonly detail: string
  /** Control request rows only: no paired decision in the loaded facts. */
  readonly pending: boolean
  /**
   * Governance-proposal rows only (§6.C): the COMPLETENESS verdict against
   * the host strict reader's closed record set. `corrupt` renders the
   * incomplete marker (error dot, naming summary) — never an awaiting row.
   */
  readonly governanceRecordStatus?: 'sound' | 'corrupt'
  /**
   * Control request rows only: the durable control request id (the
   * command identity of the F9 v4 `team.resolveControl` surface — the
   * row's Allow/Deny commands address this id; ABSENT for every other
   * family and for a control-request fact whose payload names no id).
   */
  readonly requestId?: string
  /** Control decision rows only: the frozen decision value (open string on the wire). */
  readonly decisionValue?: string
  /** Control decision rows only: the decision reason (leaf `reason`, else `note`). */
  readonly decisionReason?: string
  /** Progress rows only: the frozen progress value. */
  readonly progressValue?: ProgressValue
  /**
   * The session the row opens on click (D9 navigation): the actor
   * instance's child session, or the team root for the leader; '' when
   * nothing resolves (the row is inert).
   */
  readonly navigationSessionId: string
}

/** The client-local filter (UI §27.4: a category plus an instance or template). */
export interface TeamLedgerFilter {
  /** 'all' = no category filter. */
  readonly category: LedgerCategory | 'all'
  /** The selected instance or template id; null = no instance filter. */
  readonly instanceId: string | null
}

/** The rendered Events section: the loaded window plus its pagination facts. */
export interface TeamLedgerSectionModel {
  /** The most recent `loadedCount` filtered rows, oldest first. */
  readonly rows: readonly TeamLedgerEventRow[]
  /** The filtered loaded length (the depth axis). */
  readonly total: number
  /** True while the loaded set still has rows beyond the window (the depth axis). */
  readonly hasMore: boolean
  /** The loaded completeness (the adapter's authority marker). */
  readonly complete: boolean
  /**
   * Entries beyond the loaded set (the partial ledger's counted
   * remainder: the server total minus the loaded unique entry count —
   * count domain per INV-9.2; 0 when the total is unknown or fully
   * loaded).
   */
  readonly remainingCount: number
}

/** The section input: the loaded model, the snapshot, the depth, the filter, and the store's completeness facts. */
export interface TeamLedgerSectionInput {
  readonly ledger: TeamUiLedgerModel
  readonly snapshot: TeamUiSnapshot
  /** How many of the most recent filtered rows the section currently renders. */
  readonly loadedCount: number
  readonly filter: TeamLedgerFilter
  /** The store's ledger total (null before the first page; a per-team COUNT). */
  readonly total: number | null
  /**
   * The store's loaded frontier (the highest loaded SEQUENCE — a
   * SEQUENCE-domain fact; the remainder derives from the loaded entry
   * count, never from this value — INV-9.2).
   */
  readonly completeThrough: number
}

/** One sorted-stream entry before the window cut. */
interface LedgerItem {
  readonly sequence: number
  readonly row: TeamLedgerEventRow
}

/** Fail-safe string leaf read (the ledger-adapter discipline). */
function str(payload: Readonly<Record<string, unknown>>, key: string): string | undefined {
  const value = payload[key]
  return typeof value === 'string' ? value : undefined
}

/** Fail-safe progress-value leaf read (the frozen closed set). */
function progress(payload: Readonly<Record<string, unknown>>): ProgressValue | undefined {
  const value = payload['progress']
  return value === 'in-progress' || value === 'completed' || value === 'blocked' ? value : undefined
}

/**
 * A4-PR6 §6.C — the COMPLETENESS mirror of the host strict reader's closed
 * record set (`RECORD_FIELDS` in `runtime/governance/proposal-store.ts`).
 * This checks PRESENCE only — the host reader owns semantic validity; this
 * mirror exists so the rendered row can say INCOMPLETE (a partial durable
 * proposal set renders as corrupt/incomplete, never as a proposal awaiting
 * review — §6.C's first PR5 leftover: no UI may show a wait nothing is
 * waiting on). The mirror is pinned against drift by the 6.C renderer spec
 * (text-compared against the host source — a TEXT mirror, load-bearing and
 * disclosed, same class as the fact-category mirrors).
 */
export const GOVERNANCE_PROPOSAL_RECORD_FIELDS: readonly string[] = [
  'targetMemberInstanceId',
  'baseGeneration',
  'baseSnapshotId',
  'desiredEffect',
  'authorityEnvelopeAst',
  'requiredAuthority',
  'caseFingerprint',
  'status',
  'recordedAt',
]

/** The lossless-safe serialized payload summary (lossless JSON in, JSON text out). */
function safePayloadSummary(payload: Readonly<Record<string, unknown>>): string {
  try {
    return JSON.stringify(payload)
  } catch {
    return '{}'
  }
}

/**
 * Build one Events-section row from one loaded fact (the fail-safe leaf
 * reads per family; the generic family for an unknown fact type).
 * @param row - the loaded ledger fact row.
 * @param labels - instanceId → display label (the snapshot member rows).
 * @param navSessions - instanceId → session target ('' = none).
 * @param templates - instanceId → templateId (the snapshot member rows).
 * @param pendingRequestIds - the request ids with no paired decision in the loaded facts.
 * @param intervalInstance - correlation → instanceId (the loaded paired intervals; the close facts name only the correlation).
 * @returns the rendered row.
 */
function buildRow(
  row: TeamUiLedgerRow,
  labels: ReadonlyMap<string, string>,
  navSessions: ReadonlyMap<string, string>,
  templates: ReadonlyMap<string, string>,
  pendingRequestIds: ReadonlySet<string>,
  intervalInstance: ReadonlyMap<string, string>,
): TeamLedgerEventRow {
  const kind = FACT_ROW_KIND[row.factType] ?? 'unknown'
  const payload = row.payload
  let actorInstanceId = ''
  let summary = ''
  let detail = ''
  let pending = false
  let governanceRecordStatus: 'sound' | 'corrupt' | undefined
  let requestId: string | undefined
  let decisionValue: string | undefined
  let decisionReason: string | undefined
  let progressValue: ProgressValue | undefined

  switch (kind) {
    case 'message': {
      // Per-fact leaf reads (mirroring the adapter's frozen leaf order):
      // the delivered fact names only the recipient
      // (`recipientInstanceId` ?? `deliveredToInstanceId`); the
      // coordination fact names the target (`targetInstanceId` ??
      // `recipientInstanceId`) and MAY name the caller. Each fact carries
      // at most one of the aliases, so one ?? chain covers both orders.
      const from = str(payload, 'caller')
      const to = str(payload, 'targetInstanceId') ?? str(payload, 'recipientInstanceId') ?? str(payload, 'deliveredToInstanceId')
      const subject = str(payload, 'subject')
      if (from !== undefined) actorInstanceId = from
      if (to !== undefined && from === undefined) actorInstanceId = to
      const fromLabel = from === undefined ? '' : (labels.get(from) ?? from)
      const toLabel = to === undefined ? '' : (labels.get(to) ?? to)
      summary = subject ?? safePayloadSummary(payload)
      detail = [from === undefined ? '' : fromLabel, to === undefined ? '' : `→ ${toLabel}`, subject]
        .filter(part => part !== '')
        .join(' ')
      if (detail === '') detail = safePayloadSummary(payload)
      break
    }
    case 'control-request': {
      actorInstanceId = str(payload, 'targetInstanceId') ?? ''
      const actionName = str(payload, 'actionName')
      const toolName = str(payload, 'toolName')
      summary = actionName ?? safePayloadSummary(payload)
      detail = [actionName, toolName, str(payload, 'summary')]
        .filter(part => part !== undefined && part !== '')
        .join(' · ')
      if (detail === '') detail = safePayloadSummary(payload)
      const rowRequestId = str(payload, 'requestId')
      requestId = rowRequestId
      pending = rowRequestId === undefined ? false : pendingRequestIds.has(rowRequestId)
      break
    }
    case 'control-decision': {
      decisionValue = str(payload, 'decision')
      decisionReason = str(payload, 'reason') ?? str(payload, 'note')
      const scope = payload['scope']
      if (typeof scope === 'object' && scope !== null) {
        actorInstanceId = str(scope as Readonly<Record<string, unknown>>, 'targetInstanceId') ?? ''
      }
      summary = [decisionValue, decisionReason].filter(part => part !== undefined && part !== '').join(' · ')
      if (summary === '') summary = safePayloadSummary(payload)
      detail = [str(payload, 'requestId'), decisionValue, decisionReason]
        .filter(part => part !== undefined && part !== '')
        .join(' · ')
      if (detail === '') detail = safePayloadSummary(payload)
      break
    }
    case 'interval-opened': {
      actorInstanceId = str(payload, 'instanceId') ?? ''
      summary = str(payload, 'subject') ?? str(payload, 'note') ?? safePayloadSummary(payload)
      detail = [str(payload, 'correlation'), summary].filter(part => part !== undefined && part !== '').join(' · ')
      break
    }
    case 'interval-closed': {
      // The close fact names only the correlation: the actor joins through
      // the loaded paired interval (no pairing, no actor — no guessing).
      const correlation = str(payload, 'correlation')
      if (correlation !== undefined) actorInstanceId = intervalInstance.get(correlation) ?? ''
      summary = str(payload, 'closeNote') ?? str(payload, 'note') ?? safePayloadSummary(payload)
      detail = [correlation, summary].filter(part => part !== undefined && part !== '').join(' · ')
      break
    }
    case 'progress-recorded': {
      actorInstanceId = str(payload, 'instanceId') ?? ''
      progressValue = progress(payload)
      const subject = str(payload, 'subject')
      summary = subject ?? safePayloadSummary(payload)
      detail = [subject, progressValue, str(payload, 'lastAction')]
        .filter(part => part !== undefined && part !== '')
        .join(' · ')
      if (detail === '') detail = safePayloadSummary(payload)
      break
    }
    case 'control-escalation': {
      // The FROZEN five members of ADR A3-12(ii): the row names the case,
      // the leg and the previous request — structured leaves, and the
      // summary NEVER falls back to the payload serializer.
      const approvalCaseId = str(payload, 'approvalCaseId')
      const legOrdinal = payload['legOrdinal']
      const previousRequestId = str(payload, 'previousRequestId')
      const reason = str(payload, 'reason')
      const legText =
        typeof legOrdinal === 'number' && Number.isInteger(legOrdinal)
          ? `escalation \u00b7 leg ${String(legOrdinal)}`
          : 'escalation'
      summary = [legText, reason].filter(part => part !== undefined && part !== '').join(' \u00b7 ')
      detail = [approvalCaseId, previousRequestId === undefined ? undefined : `previous ${previousRequestId}`, reason]
        .filter(part => part !== undefined && part !== '')
        .join(' \u00b7 ')
      break
    }
    case 'governance-proposal': {
      // §6.C leftover A: the durable proposal row renders INCOMPLETE when
      // the record set is partial — the marker is carried in the row
      // (status field + the naming summary), so no renderer can show this
      // row as a proposal awaiting review. A sound row shows its leaves.
      const missing = GOVERNANCE_PROPOSAL_RECORD_FIELDS.filter(field => !(field in payload))
      const extra = Object.keys(payload).filter(field => !GOVERNANCE_PROPOSAL_RECORD_FIELDS.includes(field))
      governanceRecordStatus = missing.length === 0 && extra.length === 0 ? 'sound' : 'corrupt'
      const target = str(payload, 'targetMemberInstanceId')
      if (target !== undefined) actorInstanceId = target
      if (governanceRecordStatus === 'corrupt') {
        const parts = [
          ...missing.map(field => `missing ${field}`),
          ...extra.map(field => `unexpected ${field}`),
        ]
        summary = 'governance proposal record INCOMPLETE - nothing is waiting on it'
        detail = parts.join(' \u00b7 ')
        break
      }
      const effect = str(payload, 'desiredEffect')
      const status = str(payload, 'status')
      const generation = payload['baseGeneration']
      summary = ['governance proposal', target, effect].filter(part => part !== undefined && part !== '').join(' \u00b7 ')
      if (summary === '') summary = 'governance proposal recorded'
      detail = [target, effect, status, typeof generation === 'number' ? `generation ${String(generation)}` : undefined]
        .filter(part => part !== undefined && part !== '')
        .join(' \u00b7 ')
      break
    }
    case 'work-admitted':
    case 'member-created':
    case 'lifecycle-changed':
    case 'policy-transitioned':
    case 'control-consumed':
    case 'unknown': {
      // The generic display: the first instance leaf the fact names
      // (fail-safe, in the frozen leaf order), else none — never guessed.
      actorInstanceId =
        str(payload, 'instanceId')
        ?? str(payload, 'targetInstanceId')
        ?? str(payload, 'memberInstanceId')
        ?? ''
      summary =
        str(payload, 'subject')
        ?? str(payload, 'summary')
        ?? str(payload, 'note')
        ?? (kind === 'unknown' ? row.factType : safePayloadSummary(payload))
      detail = `${row.factType} · #${row.sequence} · ${row.createdAt}`
      const serialized = safePayloadSummary(payload)
      if (serialized !== '{}') detail = `${detail}\n${serialized}`
      break
    }
  }

  const actorLabel = actorInstanceId === '' ? '' : (labels.get(actorInstanceId) ?? actorInstanceId)
  const navigationSessionId = actorInstanceId === '' ? '' : (navSessions.get(actorInstanceId) ?? '')
  const at = Date.parse(row.createdAt)
  return {
    ...(governanceRecordStatus === undefined ? {} : { governanceRecordStatus }),
    kind,
    key: `ledger:${row.sequence}`,
    sequence: row.sequence,
    at: Number.isFinite(at) ? at : 0,
    factType: row.factType,
    ...(row.category === undefined ? {} : { category: row.category }),
    actorInstanceId,
    actorLabel,
    summary,
    detail,
    pending,
    ...(requestId === undefined ? {} : { requestId }),
    ...(decisionValue === undefined ? {} : { decisionValue }),
    ...(decisionReason === undefined ? {} : { decisionReason }),
    ...(progressValue === undefined ? {} : { progressValue }),
    navigationSessionId,
  }
}

/**
 * Project the loaded ledger onto the Events-section model at one depth and
 * one filter.
 * @param input - the loaded ledger model, the snapshot (labels + navigation
 *   targets), the render depth, the client-local filter, and the store's
 *   completeness facts (total + frontier).
 * @returns the loaded window (oldest first) plus the filtered loaded total,
 *   the depth-axis hasMore flag, the completeness marker, and the partial
 *   ledger's counted remainder.
 */
export function deriveTeamLedgerSection(input: TeamLedgerSectionInput): TeamLedgerSectionModel {
  // `completeThrough` (the SEQUENCE-domain frontier) is NOT read: the
  // remainder is a count-domain subtraction (INV-9.2, F11) — it derives
  // from the loaded unique entry count, never from the frontier.
  const { ledger, snapshot, loadedCount, filter, total } = input

  const labels = new Map<string, string>()
  const navSessions = new Map<string, string>()
  const templates = new Map<string, string>()
  for (const member of snapshot.members) {
    labels.set(member.instanceId, member.label)
    navSessions.set(member.instanceId, member.childSessionId ?? snapshot.teamSessionId)
    templates.set(member.instanceId, member.templateId)
  }

  const pendingRequestIds = new Set<string>()
  for (const chain of ledger.controls) {
    if (chain.pending === false) continue
    pendingRequestIds.add(chain.requestId)
  }

  const intervalInstance = new Map<string, string>()
  for (const interval of ledger.intervals) {
    if (intervalInstance.has(interval.correlation) === false) intervalInstance.set(interval.correlation, interval.instanceId)
  }

  const items: LedgerItem[] = []
  for (const row of ledger.entries) {
    // Internal authority facts (PR #26 P2): kept in the raw model, never
    // rendered as Events rows (a generic row would serialize the grant
    // payload — locator + opaque digests — into the activity feed).
    if (INTERNAL_FACT_TYPES.has(row.factType)) continue
    if (filter.category !== 'all' && (row.category === undefined || row.category !== filter.category)) continue
    const built = buildRow(row, labels, navSessions, templates, pendingRequestIds, intervalInstance)
    if (filter.instanceId !== null) {
      // Instance OR template filter (UI §27.4): a row matches its actor's
      // own id or its actor's template; a row without an actor never matches.
      const matches =
        built.actorInstanceId !== ''
        && (built.actorInstanceId === filter.instanceId || templates.get(built.actorInstanceId) === filter.instanceId)
      if (matches === false) continue
    }
    items.push({ sequence: row.sequence, row: built })
  }
  // The loaded entries arrive in durable sequence order; re-assert it
  // (the sort identity is the SEQUENCE, never the timestamp).
  items.sort((left, right) => left.sequence - right.sequence)

  const filteredTotal = items.length
  const limit = Math.max(0, Math.min(loadedCount, filteredTotal))
  const rows = items.slice(filteredTotal - limit).map(item => item.row)
  // INV-9.2 (F11): the remainder is a COUNT-domain subtraction — the
  // server's per-team total minus the loaded unique entry count. The
  // sequence frontier is never subtracted (a shifted base, e.g. total 68
  // with frontier 118 and 50 loaded, would have under-reported the
  // remainder to 0).
  const remainingCount = total === null ? 0 : Math.max(0, total - ledger.entries.length)
  return {
    rows,
    total: filteredTotal,
    hasMore: limit < filteredTotal,
    complete: ledger.completeness === 'complete',
    remainingCount,
  }
}
