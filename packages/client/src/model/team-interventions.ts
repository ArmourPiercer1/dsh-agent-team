/**
 * A4-PR6 §6.D — the intervention panel model (frozen location).
 *
 * THE server-derived-legality law (spec §18, ADR A1-2): every action
 * affordance this module renders comes from the wire item's `legalActions`
 * cell and NOTHING else. This module imports no authority kernel, no
 * ladder, no ceiling — the client never derives authority or legality
 * locally; a payload with empty `legalActions` is terminal, full stop.
 * The renderer test rejects a payload that asks the client to fill the
 * set in itself.
 *
 * The param builders below are the client-side closed-set constructors
 * (the team-governance precedent): they shape the frozen v8 bodies and
 * cannot add a field — `intervention.act` carries exactly
 * `{ teamSessionId, interventionId, action, note? }` (never a caller,
 * never an authority claim).
 */

/** The frozen wire `source` cell (mirror of the remote contract type). */
export interface InterventionSourceView {
  readonly kind: string
  readonly id: string
  readonly requestId?: string
  readonly legOrdinal?: number
  readonly carrierKind?: string
}

/** One wire intervention item as the panel consumes it (closed cells). */
export interface InterventionItemView {
  readonly interventionId: string
  readonly kind: string
  readonly responseBehavior: string
  readonly blockScope: Readonly<Record<string, unknown>> | null
  readonly source: InterventionSourceView
  readonly status: string
  readonly requiredAuthority?: string
  readonly currentReviewAuthority?: string
  readonly legalActions: readonly string[]
  readonly derivationReasons: readonly string[]
  readonly fingerprint?: string
  readonly createdAt: string
  readonly updatedAt?: string
  readonly lastObservedAt?: string
  readonly observationCount?: number
}

/**
 * The CLOSED v8 act vocabulary (the wire union mirroring
 * `REMOTE_INTERVENTION_ACTION_VALUES` — the value selects an ENTRY on the
 * server, never a permission). The client mirrors the closed set so an
 * out-of-vocabulary value can never become an affordance; the host
 * param parse is the enforcement, this mirror is the display fail-safe.
 */
export type InterventionActVerb = 'allow' | 'deny' | 'escalate' | 'acknowledge'

const ACT_VERB_VALUES: readonly string[] = ['allow', 'deny', 'escalate', 'acknowledge']

function isActVerb(value: string): value is InterventionActVerb {
  return ACT_VERB_VALUES.includes(value)
}

/** The panel row: the item plus the DISPLAY verdicts (never legality). */
export interface InterventionRow {
  readonly item: InterventionItemView
  /** The server-given actions, verbatim (the closed v8 vocabulary — the
   *  mirror type above; for a host-validated payload the filter is the
   *  identity). The panel renders one affordance per entry and never
   *  invents, reorders, or adds to this list. */
  readonly actions: readonly InterventionActVerb[]
  /** Terminal = the server offered no action (escalated-away, decided,
   *  acknowledged, stale). A terminal row carries NO affordance. */
  readonly terminal: boolean
  /** The closed act verbs (the wire vocabulary — display grouping only,
   *  never a permission decision). */
  readonly isWarning: boolean
}

function str(value: Readonly<Record<string, unknown>>, key: string): string | undefined {
  const leaf = value[key]
  return typeof leaf === 'string' ? leaf : undefined
}

function strArray(value: Readonly<Record<string, unknown>>, key: string): readonly string[] {
  const leaf = value[key]
  return Array.isArray(leaf) ? leaf.filter((entry): entry is string => typeof entry === 'string') : []
}

/** Fail-safe parse of one wire item (the boundary read; the host already
 *  validated the closed shape — a structurally unreadable item is DROPPED
 *  here rather than rendered as a half-row: a visible-but-wrong row would
 *  misrepresent governance; the list stays consistent or the row is absent).
 *  @returns the view, or undefined for an unreadable item. */
export function parseInterventionItem(raw: unknown): InterventionItemView | undefined {
  if (typeof raw !== 'object' || raw === null) return undefined
  const item = raw as Record<string, unknown>
  const interventionId = str(item, 'interventionId')
  const kind = str(item, 'kind')
  const status = str(item, 'status')
  const responseBehavior = str(item, 'responseBehavior')
  const createdAt = str(item, 'createdAt')
  const sourceRaw = item['source']
  if (
    interventionId === undefined
    || kind === undefined
    || status === undefined
    || responseBehavior === undefined
    || createdAt === undefined
    || typeof sourceRaw !== 'object'
    || sourceRaw === null
  ) {
    return undefined
  }
  const source = sourceRaw as Record<string, unknown>
  const sourceKind = str(source, 'kind')
  const sourceId = str(source, 'id')
  if (sourceKind === undefined || sourceId === undefined) return undefined
  const legOrdinal = source['legOrdinal']
  const blockScopeRaw = item['blockScope']
  const requiredAuthority = str(item, 'requiredAuthority')
  const currentReviewAuthority = str(item, 'currentReviewAuthority')
  const fingerprint = str(item, 'fingerprint')
  const updatedAt = str(item, 'updatedAt')
  const lastObservedAt = str(item, 'lastObservedAt')
  const observationCount = item['observationCount']
  const requestId = str(source, 'requestId')
  const carrierKind = str(source, 'carrierKind')
  return {
    interventionId,
    kind,
    responseBehavior,
    blockScope: typeof blockScopeRaw === 'object' && blockScopeRaw !== null
      ? (blockScopeRaw as Readonly<Record<string, unknown>>)
      : null,
    source: {
      kind: sourceKind,
      id: sourceId,
      ...(requestId !== undefined ? { requestId } : {}),
      ...(typeof legOrdinal === 'number' ? { legOrdinal } : {}),
      ...(carrierKind !== undefined ? { carrierKind } : {}),
    },
    status,
    ...(requiredAuthority !== undefined ? { requiredAuthority } : {}),
    ...(currentReviewAuthority !== undefined ? { currentReviewAuthority } : {}),
    legalActions: strArray(item, 'legalActions'),
    derivationReasons: strArray(item, 'derivationReasons'),
    ...(fingerprint !== undefined ? { fingerprint } : {}),
    createdAt,
    ...(updatedAt !== undefined ? { updatedAt } : {}),
    ...(lastObservedAt !== undefined ? { lastObservedAt } : {}),
    ...(typeof observationCount === 'number' ? { observationCount } : {}),
  }
}

/** The list payload (`{ items }`) of `intervention.list` → panel rows. */
export function interventionRows(data: unknown): readonly InterventionRow[] {
  const items = (data as Record<string, unknown> | undefined)?.['items']
  if (!Array.isArray(items)) return []
  const rows: InterventionRow[] = []
  for (const raw of items) {
    const item = parseInterventionItem(raw)
    if (item === undefined) continue
    rows.push({
      item,
      // THE server-derived law: verbatim. No sorting, no filtering, no
      // ladder consultation.
      actions: item.legalActions.filter(isActVerb),
      terminal: item.legalActions.length === 0,
      isWarning: item.source.kind === 'governance-warning',
    })
  }
  return rows
}

/** A terminal row's evidence line: the structured leaves the wire names
 *  (never a serialized payload — §6.C's renderer law). */
export function terminalEvidence(row: InterventionRow): string {
  const parts = [row.item.status]
  if (row.item.source.legOrdinal !== undefined) parts.push(`leg ${String(row.item.source.legOrdinal)}`)
  if (row.item.source.requestId !== undefined) parts.push(`request ${row.item.source.requestId}`)
  return parts.join(' \u00b7 ')
}

// -- the closed v8 param builders (the ONLY client shapes for the plane) --

/** `intervention.list` params: exactly `{ teamSessionId }`. */
export function interventionListParams(teamSessionId: string): { teamSessionId: string } {
  return { teamSessionId }
}

/** `intervention.get` params: exactly `{ teamSessionId, interventionId }`. */
export function interventionGetParams(
  teamSessionId: string,
  interventionId: string,
): { teamSessionId: string; interventionId: string } {
  return { teamSessionId, interventionId }
}

/**
 * `intervention.act` params: THE CLOSED BODY — `note` is spread only when
 * present (an absent note never rides as `undefined`; the wire closed-set
 * parse distinguishes the two).
 */
export function interventionActParams(
  teamSessionId: string,
  interventionId: string,
  action: InterventionActVerb,
  note?: string,
): { teamSessionId: string; interventionId: string; action: InterventionActVerb; note?: string } {
  return {
    teamSessionId,
    interventionId,
    action,
    ...(note !== undefined ? { note } : {}),
  }
}

/** `override.getPermissionAdministration` params (memberInstanceId optional). */
export function permissionAdministrationParams(
  teamSessionId: string,
  memberInstanceId?: string,
): { teamSessionId: string; memberInstanceId?: string } {
  return {
    teamSessionId,
    ...(memberInstanceId !== undefined ? { memberInstanceId } : {}),
  }
}
