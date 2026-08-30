/**
 * P6-T5 — the deterministic fact machinery: op ↔ factType mapping, the
 * durable-entry builder (writer side) and the strict parser (reader side).
 *
 * Both directions are PURE and DETERMINISTIC: the same durable entry
 * always parses to the same `ActivityFactRow` (or `undefined` when the
 * entry is not a well-formed activity fact — foreign fact types and
 * malformed payloads are skipped, never guessed), and the builder always
 * emits the closed payload shape. No timestamps are generated here: the
 * `createdAt` display label is supplied by the caller (the ledger's
 * injected clock) — ordering identity stays with the TeamLedger sequence
 * (invariant 44).
 */

import { PROGRESS_VALUES } from '../admission/index.js'
import type { ProgressValue } from '../admission/index.js'
import type { LedgerEntry } from '../../storage/schema/index.js'
import type { RemoteSafeRecord, RootSessionId } from '../../contracts/src/index.js'
import {
  ACTIVITY_CORRELATION_MAX_LENGTH,
  ACTIVITY_LAST_ACTION_MAX_LENGTH,
  ACTIVITY_NOTE_MAX_LENGTH,
  ACTIVITY_REQUEST_TOKEN_MAX_LENGTH,
  ACTIVITY_SUBJECT_MAX_LENGTH,
  ACTIVITY_SUMMARY_MAX_LENGTH,
} from './types.js'
import type { ActivityFactRow, ActivityFactType, ActivityOp } from './types.js'

/** The closed op → factType mapping. */
export const OP_TO_FACT_TYPE: Record<ActivityOp, ActivityFactType> = {
  'progress': 'activity-progress-recorded',
  'interval-open': 'activity-interval-opened',
  'interval-close': 'activity-interval-closed',
}

/** The closed factType → op mapping. */
export const FACT_TYPE_TO_OP: Record<ActivityFactType, ActivityOp> = {
  'activity-progress-recorded': 'progress',
  'activity-interval-opened': 'interval-open',
  'activity-interval-closed': 'interval-close',
}

/** Type guard: `factType` is one of the closed activity fact types. */
export function isActivityFactType(factType: string): factType is ActivityFactType {
  return factType in FACT_TYPE_TO_OP
}

// --- strict field predicates (shared by the parser) ----------------------------

function isBoundedString(value: unknown, max: number): value is string {
  return typeof value === 'string' && value.length >= 1 && value.length <= max
}

function isProgressValue(value: unknown): value is ProgressValue {
  return typeof value === 'string' && (PROGRESS_VALUES as readonly string[]).includes(value)
}

function isSequence(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 1
}

/**
 * Parse ONE durable ledger entry into an activity row (or `undefined`
 * when the entry is not a well-formed activity fact).
 *
 * The parse is fail-safe: every field is re-validated against the SAME
 * bounds the writer enforced, so a corrupted or foreign row can never
 * poison a projection — it is simply skipped. The `op` MUST agree with
 * the factType (a mismatch is a corrupted fact, not a variant).
 *
 * @param entry - the durable ledger entry.
 * @returns the parsed row, or `undefined` for non-activity/corrupt rows.
 */
export function parseActivityFact(entry: LedgerEntry): ActivityFactRow | undefined {
  if (!isActivityFactType(entry.factType)) return undefined
  const op = FACT_TYPE_TO_OP[entry.factType]
  const p = entry.payload
  if (p === null || typeof p !== 'object' || Array.isArray(p)) return undefined
  const rec = p as Record<string, unknown>
  if (rec['op'] !== op) return undefined
  if (!isBoundedString(rec['instanceId'], 256)) return undefined
  if (!isBoundedString(rec['subject'], ACTIVITY_SUBJECT_MAX_LENGTH)) return undefined
  if (!isSequence(rec['sequence'])) return undefined
  if (!isProgressValue(rec['progress'])) return undefined
  if (!isBoundedString(rec['requestToken'], ACTIVITY_REQUEST_TOKEN_MAX_LENGTH)) return undefined
  if (!isBoundedString(rec['reportedByInstanceId'], 256)) return undefined

  const summary = rec['summary']
  if (summary !== undefined && !isBoundedString(summary, ACTIVITY_SUMMARY_MAX_LENGTH)) {
    return undefined
  }
  const lastAction = rec['lastAction']
  if (
    lastAction !== undefined &&
    !isBoundedString(lastAction, ACTIVITY_LAST_ACTION_MAX_LENGTH)
  ) {
    return undefined
  }
  const correlation = rec['correlation']
  if (
    correlation !== undefined &&
    !isBoundedString(correlation, ACTIVITY_CORRELATION_MAX_LENGTH)
  ) {
    return undefined
  }
  // interval facts REQUIRE the correlation (the work-unit tag)
  if (op !== 'progress' && !isBoundedString(correlation, ACTIVITY_CORRELATION_MAX_LENGTH)) {
    return undefined
  }
  const note = rec['note']
  if (note !== undefined && !isBoundedString(note, ACTIVITY_NOTE_MAX_LENGTH)) {
    return undefined
  }
  const closeNote = rec['closeNote']
  if (closeNote !== undefined && !isBoundedString(closeNote, ACTIVITY_NOTE_MAX_LENGTH)) {
    return undefined
  }

  const row: ActivityFactRow = {
    globalSequence: entry.sequence,
    factType: entry.factType,
    rootSessionId: entry.rootSessionId,
    instanceId: rec['instanceId'] as string,
    subject: rec['subject'] as string,
    sequence: rec['sequence'] as number,
    op,
    progress: rec['progress'] as ProgressValue,
    requestToken: rec['requestToken'] as string,
    reportedByInstanceId: rec['reportedByInstanceId'] as string,
    createdAt: entry.createdAt,
    ...(summary !== undefined ? { summary } : {}),
    ...(lastAction !== undefined ? { lastAction } : {}),
    ...(correlation !== undefined ? { correlation } : {}),
    ...(note !== undefined ? { note } : {}),
    ...(closeNote !== undefined ? { closeNote } : {}),
  }
  return row
}

// --- the durable-entry builder (writer side) -----------------------------------

/** The closed builder input (every field already writer-validated). */
export interface ActivityFactBuildInput {
  readonly rootSessionId: RootSessionId
  readonly globalSequence: number
  readonly op: ActivityOp
  readonly instanceId: string
  readonly subject: string
  readonly sequence: number
  readonly progress: ProgressValue
  readonly summary?: string
  readonly lastAction?: string
  readonly correlation?: string
  readonly note?: string
  readonly closeNote?: string
  readonly requestToken: string
  readonly reportedByInstanceId: string
  readonly createdAt: string
}

/**
 * Build the durable ledger entry for one activity fact (closed payload
 * shape — lossless JSON).
 *
 * @param input - the validated build input.
 * @returns the entry ready for `LedgerRepository.put`.
 */
export function buildActivityEntry(input: ActivityFactBuildInput): LedgerEntry {
  const payload: RemoteSafeRecord = {
    op: input.op,
    instanceId: input.instanceId,
    subject: input.subject,
    sequence: input.sequence,
    progress: input.progress,
    requestToken: input.requestToken,
    reportedByInstanceId: input.reportedByInstanceId,
  }
  if (input.summary !== undefined) payload['summary'] = input.summary
  if (input.lastAction !== undefined) payload['lastAction'] = input.lastAction
  if (input.correlation !== undefined) payload['correlation'] = input.correlation
  if (input.note !== undefined) payload['note'] = input.note
  if (input.closeNote !== undefined) payload['closeNote'] = input.closeNote
  return {
    schemaVersion: 1,
    sequence: input.globalSequence,
    rootSessionId: input.rootSessionId,
    factType: OP_TO_FACT_TYPE[input.op],
    payload,
    createdAt: input.createdAt,
  }
}
