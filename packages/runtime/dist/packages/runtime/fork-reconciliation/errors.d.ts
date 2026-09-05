/**
 * ForkReconciliation error channel (P7-T4).
 *
 * `ForkReconciliationErrorCode` is a CLOSED vocabulary as of P7-T4 (same
 * discipline as the P5-T5 root-binding codes and the frozen contracts v1
 * error codes, Development Plan §9.1). Consumers MUST branch on `code`,
 * never on message text.
 *
 * Semantics of each code (fail-closed; NO durable write happens before the
 * throw — the read-only recognition phase completes before any effect):
 *
 * - `FORK_INVALID_INPUT` — the observed native-fork fact is structurally
 *   invalid (a malformed parent or child session id, or parent === child:
 *   a native fork always mints a NEW child session). The call performs no
 *   TeamDomain read or write.
 * - `FORK_STATE_CONFLICT` — the durable TeamDomain state contradicts the
 *   fork fact (invariant 41: TeamDomain is the sole durable authority; the
 *   reconciler never guesses which side is right — Architecture §15.3):
 *   a root-fork child session that already carries any binding row or a
 *   TeamSession record whose immutable Blueprint snapshot differs from the
 *   parent team's snapshot (invariant 10); a root-fork child with a
 *   `team-root` binding but no TeamSession record (a binding without a
 *   record is never produced by this module's crash-safe ordering and is
 *   corruption); an ordinary/member-fork child session that already
 *   carries any binding row (the durable child binding is never
 *   re-pointed, invariant 24; no Team membership is ever inferred for a
 *   fork child, invariant 62); or a root-fork parent whose `team-root`
 *   binding has no TeamSession record to copy the snapshot from
 *   (invariant 9/10 cannot be honored without the record).
 *
 * Durable-write failures (the seam/repositories rejecting a put) are NOT
 * wrapped: the repository/seam error is the source of truth and carries
 * the stable code; the module only guarantees the ORDERING (record before
 * binding) and that no second write is attempted after the first fails.
 *
 * @module @dsh-agent-team/runtime/fork-reconciliation/errors
 */
/** The closed fork-reconciliation error-code vocabulary (P7-T4). */
export declare const FORK_RECONCILIATION_ERROR_CODES: {
    /** Structurally invalid fork fact (malformed ids, parent === child). No effect. */
    readonly FORK_INVALID_INPUT: "FORK_INVALID_INPUT";
    /** Durable TeamDomain state contradicts the fork fact. No effect. */
    readonly FORK_STATE_CONFLICT: "FORK_STATE_CONFLICT";
};
/** One closed fork-reconciliation error code. */
export type ForkReconciliationErrorCode = (typeof FORK_RECONCILIATION_ERROR_CODES)[keyof typeof FORK_RECONCILIATION_ERROR_CODES];
/** The flat value list (for the `isForkReconciliationError` check). */
export declare const FORK_RECONCILIATION_ERROR_CODE_VALUES: readonly string[];
/**
 * The fork-reconciliation typed error. Carries a closed `code` and a
 * lossless-JSON `details` record.
 */
export declare class ForkReconciliationError extends Error {
    /** The closed error code (branch on this, never on the message). */
    readonly code: ForkReconciliationErrorCode;
    /** A lossless-JSON details record (no live references). */
    readonly details: Record<string, unknown>;
    /**
     * @param code - the closed error code.
     * @param message - the human-readable message (not an API).
     * @param details - the lossless-JSON details record.
     */
    constructor(code: ForkReconciliationErrorCode, message: string, details?: Record<string, unknown>);
}
/**
 * Type guard: `true` iff `value` is an `Error` carrying one of the closed
 * fork-reconciliation codes.
 * @param value - the value to check.
 */
export declare function isForkReconciliationError(value: unknown): value is ForkReconciliationError;
//# sourceMappingURL=errors.d.ts.map