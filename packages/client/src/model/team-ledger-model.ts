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
 * (`total - completeThrough`).
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
}

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
  /** Entries beyond the loaded frontier (the partial ledger's counted remainder). */
  readonly remainingCount: number
}

/** The section input: the loaded model, the snapshot, the depth, the filter, and the store's completeness facts. */
export interface TeamLedgerSectionInput {
  readonly ledger: TeamUiLedgerModel
  readonly snapshot: TeamUiSnapshot
  /** How many of the most recent filtered rows the section currently renders. */
  readonly loadedCount: number
  readonly filter: TeamLedgerFilter
  /** The store's ledger total (null before the first page). */
  readonly total: number | null
  /** The store's loaded frontier (the highest loaded sequence). */
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
      const requestId = str(payload, 'requestId')
      pending = requestId === undefined ? false : pendingRequestIds.has(requestId)
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
  const { ledger, snapshot, loadedCount, filter, total, completeThrough } = input

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
  const remainingCount = total === null ? 0 : Math.max(0, total - completeThrough)
  return {
    rows,
    total: filteredTotal,
    hasMore: limit < filteredTotal,
    complete: ledger.completeness === 'complete',
    remainingCount,
  }
}
