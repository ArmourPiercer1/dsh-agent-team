/**
 * P8-T4 push model — the ledger page anchor rule (pure).
 *
 * The server side is the frozen D-5 slicer (P8-T3): `team.getLedgerPage`
 * returns the entries with `sequence > afterSequence`, sliced to `limit`,
 * and sets `nextAfterSequence` to the last included sequence IFF more
 * entries remain. This module is the client-side mirror of that contract
 * — the "page anchor" of the card:
 *
 *   1. every entry sits strictly after the anchor;
 *   2. entry sequences are strictly ascending;
 *   3. the page never exceeds `limit`;
 *   4. a page carrying a cursor is a full page (`limit` entries) and the
 *      cursor equals the last included sequence; an empty page has no
 *      cursor;
 *   5. `total` is non-negative and never decreases (the ledger is
 *      append-only) — this is what makes paging stable under growth:
 *      re-reading an anchor yields the same page, and the total only
 *      moves up.
 *
 * The tracker enforces the correlation guard on top of the shape checks:
 * only the tracker's CURRENT anchor may advance the cursor, so a stale
 * or duplicate in-flight page response (one answering an older anchor)
 * can never move the cursor backward or double-apply.
 *
 * Pure module: no I/O, no node: builtins, no runtime environment
 * assumptions. Erasable TS only.
 * @module @dsh-agent-team/remote/push/ledger-page
 */
import type { PageAnchorRequest, PageCheckResult } from './types.js';
import type { RemoteLedgerPageValue } from '../contracts/types.js';
/**
 * Check one page against its anchor request (pure shape checks 1–5 from
 * the module doc; no correlation — the tracker adds that).
 * @param request - the anchored request the page answers.
 * @param page - the frozen `RemoteLedgerPageValue` page.
 * @param lastTotal - the total seen by the caller so far, or `null`.
 * @returns the closed deterministic check result.
 */
export declare function verifyLedgerPageAnchor(request: PageAnchorRequest, page: RemoteLedgerPageValue, lastTotal: number | null): PageCheckResult;
/** The tracker state as reported to the client surface. */
export interface LedgerPageTrackerState {
    /** The current cursor (the anchor of the next page request). */
    readonly anchor: number;
    /** The last accepted `total` (append-only monotone), or `null`. */
    readonly lastTotal: number | null;
    /** How many pages were accepted into the cursor. */
    readonly pagesApplied: number;
    /** How many pages were rejected (shape or correlation). */
    readonly pagesRejected: number;
}
/**
 * The ledger page tracker: owns the cursor and applies the anchor rule
 * (shape checks + the correlation guard).
 */
export interface LedgerPageTracker {
    /** The tracker state (a fresh snapshot on every call). */
    readonly state: () => LedgerPageTrackerState;
    /**
     * Apply one page that answers `request`. Accepts it (advancing the
     * cursor to the page's next anchor) only when the request matches the
     * current anchor AND the page passes the shape checks.
     * @param request - the anchored request the page answers.
     * @param page - the frozen page value.
     * @returns the closed check result (correlation failures report
     *   `anchor-mismatch` before the shape checks).
     */
    applyPage(request: PageAnchorRequest, page: RemoteLedgerPageValue): PageCheckResult;
}
/**
 * Create a ledger page tracker starting at `afterSequence` (default 0:
 * the ledger head).
 * @param afterSequence - the initial cursor.
 * @returns the tracker.
 */
export declare function createLedgerPageTracker(afterSequence?: number): LedgerPageTracker;
//# sourceMappingURL=ledger-page.d.ts.map