/**
 * Strict-read + Core-spill — the process-local PENDING SHELL-GRANT
 * ISSUANCE table (PR #26 P1: the pending grant barrier).
 *
 * Why it exists (the race, PR #26 fix guide §1.1): the DSH `tools/result`
 * emitter does NOT await its observation listeners (the pinned
 * `notifyResult` runs `void Promise.resolve(returned).catch(…)`), so the
 * shell-spill grant RECORD (resolve → stat → digests → durable put →
 * registry install) is still in flight when the committed tool result
 * reaches the model and the model's IMMEDIATE `read(spillPath)` lands in
 * the permission pipeline. Without the barrier that read finds no durable
 * candidate and falls into the unchanged pipeline (default deny / ask) —
 * a spurious denial of the core use case, timed only by "the model's next
 * request is usually slow" (the pre-fix R5 assumption, now withdrawn).
 *
 * Semantics (fix guide §1.2):
 *
 * - the record path REGISTERS the pending entry BEFORE the record is
 *   allowed to settle (the entry holds the record's own promise);
 * - a read that finds NO durable candidate for its (identity, target)
 *   pair and EXACTLY the pending (same composite identity, same locator)
 *   AWAITs it, then re-runs the durable-grant verification;
 * - the pending entry itself NEVER authorizes: it is only a
 *   synchronization point — authority comes exclusively from the durable
 *   grant the record produces (or from nothing, on failure);
 * - a pending for ANOTHER identity or ANOTHER locator is never awaited
 *   (cross-instance / wrong-locator reads take the ordinary pipeline
 *   immediately — no waiting, no grant);
 * - the entry is removed in `finally` (success OR failure), and a
 *   late-settling OLDER record for the same (identity, locator) can only
 *   remove ITS OWN entry (re-issuance replaces; the newer entry survives).
 *
 * PROCESS-LOCAL by design: the barrier bridges the gap between a shell
 * result commit and the first read IN THIS PROCESS. It is not durable and
 * never spans a restart — after a restart the grant is already durable
 * (the ledger rebuild installs it at boot), so no pending can be in
 * flight for a pre-restart spill.
 *
 * Pure module: no I/O, no clocks, no DSH imports.
 * @module @dsh-agent-team/runtime/artifact-read/pending
 */
/**
 * One in-flight shell-grant issuance.
 */
export interface PendingShellGrant {
    /** The model-visible spill path the record is issuing for. */
    readonly locator: string;
    /** The record's own promise (the authority's `recordShellArtifact`). */
    readonly promise: Promise<unknown>;
}
/**
 * The composite table key: the canonical composite identity key (the
 * `memberIdentityKey` canonical JSON — which can never contain a raw NUL:
 * JSON encoding escapes it) + one NUL + the exact locator string.
 */
export declare function pendingGrantKey(identityKey: string, locator: string): string;
/**
 * The process-local pending issuance table (module docs for the contract).
 */
export declare class PendingShellGrantTable {
    private readonly byKey;
    /**
     * Register (or REPLACE) the in-flight issuance for one
     * (identity, locator). Re-registering replaces the previous entry — a
     * re-spill of the same locator supersedes its in-flight record the same
     * way a re-install supersedes a durable candidate.
     */
    register(identityKey: string, locator: string, promise: Promise<unknown>): void;
    /**
     * The in-flight issuance for EXACTLY this (identity, locator) —
     * `undefined` when nothing is in flight for it (another identity or
     * another locator never matches: the table key carries both).
     */
    lookup(identityKey: string, locator: string): PendingShellGrant | undefined;
    /**
     * Remove the entry IF AND ONLY IF it still holds THIS record's promise
     * (a late-settling older record must not remove the newer entry that a
     * re-issuance installed in the meantime).
     */
    removeIfSame(identityKey: string, locator: string, promise: Promise<unknown>): void;
    /** The number of in-flight issuances (diagnostics). */
    get size(): number;
    /** Drop every entry (domain close — the records themselves are the
     *  authority's responsibility; this is the projection's reset). */
    clear(): void;
}
//# sourceMappingURL=pending.d.ts.map