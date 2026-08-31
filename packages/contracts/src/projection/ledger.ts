/**
 * LedgerSummaryDto — the TeamLedger summary carried by the projection
 * (UI §27: the projection shows the ledger summary; the entries themselves
 * are TeamDomain facts, invariant 41, and never projection fields).
 *
 * Design facts (frozen 20260829 plan docs):
 *
 * - `byCategory` is the per-category count over the EIGHT frozen ledger
 *   categories (states.ts, UI §27.4): every category key is REQUIRED (zero
 *   counts are carried as explicit zeros), and no other key is allowed —
 *   a closed shape, so the UI filter row is fully described by the
 *   contract.
 * - `totalEntries` must equal the sum of `byCategory` (validated at parse:
 *   a summary that disagrees with itself is malformed).
 * - `latestSequence` is the highest durable ledger sequence so far (0 for
 *   an empty ledger); it is a lower-bound hint for the client's ledger
 *   view, not a completeness proof (completeness is the TeamDomain's
 *   durable journal, invariant 41).
 * - `pendingControlCount` is the number of control requests awaiting a
 *   decision (the UI §27 pending badge).
 *
 * The summary is an embedded value: the enclosing versioned record owns
 * the schema version, so the summary carries none of its own.
 *
 * Pure module: no I/O, no runtime environment assumptions.
 * @module @dsh-agent-team/contracts/projection/ledger
 */

import {
  assertFieldPresent,
  assertNoUnknownFields,
  assertPlainRecord,
} from '../dto/common.js'
import { assertNoLegacyFields } from '../legacy-vocabulary.js'
import { teamContractError } from '../errors.js'
import { deepFreeze } from '../remote-safe.js'
import type { RemoteSafeRecord } from '../remote-safe.js'
import { assertNonNegativeInteger } from './common.js'
import { LEDGER_CATEGORY_VALUES } from './states.js'
import type { LedgerCategory } from './states.js'

/** The exact frozen fields of a LedgerSummaryDto. */
export const LEDGER_SUMMARY_FIELDS: readonly string[] = [
  'latestSequence',
  'totalEntries',
  'byCategory',
  'pendingControlCount',
]

/**
 * The per-category entry counts over the eight frozen ledger categories:
 * every category is a key (zero counts explicit).
 */
export type LedgerCategoryCounts = { readonly [K in LedgerCategory]: number }

/**
 * The TeamLedger summary of one TeamSession (v1).
 */
export interface LedgerSummaryDto {
  /** Highest durable ledger sequence so far (0 for an empty ledger). */
  readonly latestSequence: number
  /** Total entry count; equals the sum of `byCategory`. */
  readonly totalEntries: number
  /** Per-category counts over the eight frozen categories (all keys). */
  readonly byCategory: LedgerCategoryCounts
  /** Control requests awaiting a decision (UI §27 pending badge). */
  readonly pendingControlCount: number
}

/**
 * Producer input for {@link createLedgerSummary}.
 */
export interface LedgerSummaryInput {
  /** Highest durable ledger sequence so far (0 for an empty ledger). */
  latestSequence: number
  /** Total entry count; must equal the sum of `byCategory`. */
  totalEntries: number
  /** Per-category counts over the eight frozen categories (all keys). */
  byCategory: LedgerCategoryCounts
  /** Control requests awaiting a decision. */
  pendingControlCount: number
}

function validateLedgerSummary(record: RemoteSafeRecord): LedgerSummaryDto {
  assertNoLegacyFields(record, 'LedgerSummary')
  assertNoUnknownFields(record, LEDGER_SUMMARY_FIELDS, 'LedgerSummary')
  for (const field of LEDGER_SUMMARY_FIELDS) {
    assertFieldPresent(record, field, 'LedgerSummary')
  }
  const latestSequence = assertNonNegativeInteger(record['latestSequence'], 'latestSequence')
  const totalEntries = assertNonNegativeInteger(record['totalEntries'], 'totalEntries')
  const pendingControlCount = assertNonNegativeInteger(
    record['pendingControlCount'],
    'pendingControlCount',
  )
  const byCategoryRecord = assertPlainRecord(record['byCategory'], 'LedgerSummary.byCategory')
  assertNoUnknownFields(byCategoryRecord, LEDGER_CATEGORY_VALUES, 'LedgerSummary.byCategory')
  const byCategory: { [K in LedgerCategory]: number } = {} as { [K in LedgerCategory]: number }
  let sum = 0
  for (const category of LEDGER_CATEGORY_VALUES) {
    assertFieldPresent(byCategoryRecord, category, 'LedgerSummary.byCategory')
    const count = assertNonNegativeInteger(byCategoryRecord[category], `byCategory.${category}`)
    byCategory[category as LedgerCategory] = count
    sum += count
  }
  if (sum !== totalEntries) {
    throw teamContractError(
      'MALFORMED_DTO',
      `totalEntries (${totalEntries}) must equal the sum of byCategory (${sum})`,
      { reason: 'TOTAL_ENTRIES_MISMATCH' },
    )
  }
  return deepFreeze({
    latestSequence,
    totalEntries,
    byCategory,
    pendingControlCount,
  })
}

/**
 * Parse and validate a LedgerSummaryDto from an untrusted value.
 * @param value - the unknown input.
 * @returns the frozen summary.
 * @throws `MALFORMED_DTO` for a malformed container, field set, field value,
 *   category key set, or a `totalEntries` / sum-of-categories mismatch.
 */
export function parseLedgerSummary(value: unknown): LedgerSummaryDto {
  return validateLedgerSummary(assertPlainRecord(value, 'LedgerSummary'))
}

/**
 * Build a fresh LedgerSummaryDto from producer input (the input must not
 * carry own `undefined` keys).
 * @param input - the summary fields.
 * @returns the frozen summary, validated through the same pipeline as
 *   `parseLedgerSummary`.
 */
export function createLedgerSummary(input: LedgerSummaryInput): LedgerSummaryDto {
  const record: RemoteSafeRecord = {
    latestSequence: input.latestSequence,
    totalEntries: input.totalEntries,
    byCategory: { ...input.byCategory },
    pendingControlCount: input.pendingControlCount,
  }
  return validateLedgerSummary(record)
}
