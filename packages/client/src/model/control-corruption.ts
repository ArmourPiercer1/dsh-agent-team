/**
 * A4-PR7 W1 — the corrupt-control-leg visibility model (warning-first,
 * RULING 5-B): the client-side parse of the v9-only
 * `team.listCorruptControlLegs` response (`{ corruption }`) into the
 * Team-page warning-bar view model.
 *
 * WARNING-FIRST, VISIBILITY ONLY: this module READS the server's
 * corrupt-leg disclosure and shapes it for display. It derives NO
 * execution semantics, NO authority, NO legality — the execution
 * plane is untouched (RULING 5-B). The strict ledger reader is NOT
 * re-implemented here (严禁在客户端复刻严格读者): the server
 * (`runtime/control`) is the SOLE authority on which records are
 * corrupt; the client never re-scans, re-sorts, or re-judges a leg —
 * rows arrive in the service's own order and stay in it.
 *
 * TEAM-LEVEL WORDING LAW: a corrupt record is a ledger fact keyed by
 * its Ledger `sequence`. The `disclosesMember` cell is the service's
 * own disclosure flag; when it is false the row is UNATTRIBUTABLE and
 * the UI must never claim a Member identity for it. This model carries
 * the flag verbatim and adds nothing.
 *
 * FAIL-SAFE: a malformed payload parses to `null` (hide the bar) and
 * `corruptCount === 0` yields `visible: false` (no bar) — the bar is
 * an ADDITIVE warning; a read failure never blocks or alters the
 * ledger surface itself. Pure module: no React, no I/O, erasable TS.
 * @module @dsh-agent-team/client/model/control-corruption
 */

/** One corrupt-leg row as the warning bar consumes it (closed cells). */
export interface CorruptControlLegRow {
  /** The durable Ledger sequence of the corrupt record (service order). */
  readonly sequence: number
  /**
   * The service's own disclosure flag (`disclosesMember`). MEASURED truth
   * (the disclosure predicate in `runtime/control/service.ts`: the four
   * scalar operation members at :1210-1215, a parseable `subject` alone at
   * :1218, a non-empty legacy `targetInstanceId` alone at :1221): `true`
   * means the row disclosed COMPARABLE ATTRIBUTION INFORMATION — an
   * identity (`subject` / legacy `targetInstanceId`) OR an operation
   * member (one of the four scalars). A row naming ONLY an operation (say
   * `actionName`, no identity at all) is `true` too, so this flag is
   * explicitly NOT a conclusion that "that member caused the corruption";
   * the warning wording must not claim one. `false` = unattributable —
   * Team-level wording only, never a name.
   */
  readonly disclosesMember: boolean
  /** The recorded identity echo when the row carries one (`requestId`). */
  readonly requestId: string | null
  /** The recorded identity echo when the row carries one (`approvalCaseId`). */
  readonly approvalCaseId: string | null
}

/** The warning-bar view model (one per Team session). */
export interface ControlCorruptionView {
  /** EXACT corrupt-record count (the server counts; the client never does). */
  readonly corruptCount: number
  /** Whether the closed `legs` list below is capped/truncated. */
  readonly truncated: boolean
  /** The listed rows, in the service's own order (never re-sorted). */
  readonly legs: readonly CorruptControlLegRow[]
}

/**
 * The CLOSED v9 read-params builder (the intervention-params precedent):
 * `team.listCorruptControlLegs` carries exactly `{ teamSessionId }` —
 * no caller, no authority claim, no page/limit smuggle.
 * @param teamSessionId - the resolved Team session id.
 * @returns the frozen closed param object.
 */
export function corruptControlLegsParams(teamSessionId: string): { teamSessionId: string } {
  return { teamSessionId }
}

/**
 * Parse the `team.listCorruptControlLegs` success `value.data`
 * (`{ corruption: { teamSessionId, corruptCount, truncated, legs } }`)
 * into the view model. Defensive client-boundary parse: EVERY leaf read
 * is fail-safe; any malformed shape (missing/wrong-typed cell, a row
 * missing its sequence) returns `null` — the bar hides, nothing throws,
 * nothing is patched with an invented value.
 * @param data - the success `value.data` payload.
 * @returns the view model, or `null` when the payload is malformed.
 */
export function parseControlCorruption(data: unknown): ControlCorruptionView | null {
  if (typeof data !== 'object' || data === null) return null
  const corruption = (data as Record<string, unknown>)['corruption']
  if (typeof corruption !== 'object' || corruption === null) return null
  const cell = corruption as Record<string, unknown>
  if (typeof cell['teamSessionId'] !== 'string') return null
  const corruptCount = cell['corruptCount']
  if (typeof corruptCount !== 'number' || !Number.isSafeInteger(corruptCount) || corruptCount < 0) {
    return null
  }
  if (typeof cell['truncated'] !== 'boolean') return null
  const rawLegs = cell['legs']
  if (!Array.isArray(rawLegs)) return null
  const legs: CorruptControlLegRow[] = []
  for (const raw of rawLegs) {
    if (typeof raw !== 'object' || raw === null) return null
    const row = raw as Record<string, unknown>
    if (typeof row['sequence'] !== 'number' || !Number.isSafeInteger(row['sequence']) || row['sequence'] < 1) {
      return null
    }
    if (typeof row['disclosesMember'] !== 'boolean') return null
    const requestId = row['requestId']
    const approvalCaseId = row['approvalCaseId']
    if (requestId !== undefined && (typeof requestId !== 'string' || requestId === '')) return null
    if (approvalCaseId !== undefined && (typeof approvalCaseId !== 'string' || approvalCaseId === '')) {
      return null
    }
    legs.push({
      sequence: row['sequence'],
      disclosesMember: row['disclosesMember'],
      requestId: requestId === undefined ? null : (requestId as string),
      approvalCaseId: approvalCaseId === undefined ? null : (approvalCaseId as string),
    })
  }
  return { corruptCount, truncated: cell['truncated'], legs }
}

/**
 * Whether a parsed view justifies rendering the warning bar: a
 * well-formed read that reports zero corrupt records shows no bar.
 * @param view - the parsed view model (`null` = malformed read).
 * @returns `true` only for a well-formed, non-zero corruption.
 */
export function controlCorruptionVisible(view: ControlCorruptionView | null): boolean {
  return view !== null && view.corruptCount > 0
}
