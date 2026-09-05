/**
 * P8-T2 Projection Service — the ledger-summary fold (a SEPARATE concern,
 * per the P8-T2 card "ledger pagination 单独处理"; DevPlan §21).
 *
 * The projection carries the TeamLedger SUMMARY only (UI §27; invariant 41):
 * the per-category counts over the eight frozen categories, the total entry
 * count, the highest durable sequence (`latestSequence`), and the
 * pending-control count. The ledger ENTRIES themselves are TeamDomain facts
 * and are NEVER projection fields.
 *
 * Pagination is deliberately OUTSIDE this fold: the client's ledger view
 * pages against the durable journal, and `latestSequence` is the
 * lower-bound hint that starts that paging (a lower-bound hint, not a
 * completeness proof — completeness is the durable journal, invariant 41).
 * Keeping the entries out of the fold is what makes the projection's
 * complexity independent of the ledger's size — and, jointly with the
 * no-session-log source port, independent of any child Session log volume.
 *
 * The fold delegates the self-consistency check (`totalEntries` ==
 * `sum(byCategory)`, all eight category keys present, non-negative counts)
 * to the frozen `createLedgerSummary` pipeline: a summary that disagrees
 * with itself is a MALFORMED_DTO.
 *
 * Pure module: no I/O, no `node:` builtins.
 * @module @dsh-agent-team/runtime/projection/ledger
 */
import { createLedgerSummary } from '../../contracts/src/index.js';
/**
 * Fold the durable ledger summary into the frozen projection summary.
 *
 * @param durable - the TeamDomain's ledger summary (invariant 41).
 * @returns the frozen `LedgerSummaryDto` (summary only, never the entries).
 * @throws `MALFORMED_DTO` when the summary is self-inconsistent (the frozen
 *   `createLedgerSummary` pipeline rejects it).
 */
export function projectLedgerSummary(durable) {
    return createLedgerSummary({
        latestSequence: durable.latestSequence,
        totalEntries: durable.totalEntries,
        byCategory: durable.byCategory,
        pendingControlCount: durable.pendingControlCount,
    });
}
//# sourceMappingURL=ledger.js.map