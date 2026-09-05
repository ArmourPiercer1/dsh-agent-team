/**
 * P6-T5 — the closed ActivityError vocabulary.
 *
 * The activity ledger has its OWN closed error family (separate from the
 * TeamRuntimeError family): input-shape and TOTAL-ORDER/INTERVAL-guard
 * failures are the ledger's own judgments and fail with these typed codes
 * BEFORE (pre-check) or AFTER (post-facade, under the per-team lock) the
 * facade call, while every FACADE rejection (addressing, caller
 * identity/role, envelope, live target) propagates unchanged as a
 * `TeamRuntimeError` from `admission/errors.ts`. The two families never
 * overlap: a caller that sees `isActivityError(e) === false` holds a
 * TeamRuntimeError (or a programming error).
 *
 * The closed vocabulary:
 *
 * - `ACTIVITY_INPUT_INVALID`         — the input failed shape validation
 *                                      (zero side effects, pre-facade).
 * - `ACTIVITY_UNAUTHORIZED_REPORTER` — the reporter rule rejected the
 *                                      caller (zero side effects, pre-facade):
 *                                      a human cannot report activity; a
 *                                      member cannot report for another
 *                                      instance (the leader may).
 * - `ACTIVITY_SEQUENCE_STALE`        — the out-of-order guard: the claimed
 *                                      per-subject sequence is not exactly
 *                                      head + 1 (`details.kind` = `'stale'`
 *                                      when claimed ≤ head, `'gap'` when
 *                                      claimed > head + 1). The durable
 *                                      state is unchanged.
 * - `ACTIVITY_INTERVAL_NOT_OPEN`     — close-without-open (FAILS CLOSED).
 * - `ACTIVITY_INTERVAL_ALREADY_OPEN` — open-while-open for the same
 *                                      `(instanceId, subject, correlation)`
 *                                      triple.
 * - `ACTIVITY_DURABLE_WRITE_FAILED`  — the TeamLedger write itself failed
 *                                      (storage-level error, re-typed).
 */
/** The closed activity error codes. */
export declare const ACTIVITY_ERROR_CODES: {
    /** The input failed shape validation (pre-facade, zero side effects). */
    readonly ACTIVITY_INPUT_INVALID: "ACTIVITY_INPUT_INVALID";
    /** The reporter rule rejected the caller (pre-facade, zero side effects). */
    readonly ACTIVITY_UNAUTHORIZED_REPORTER: "ACTIVITY_UNAUTHORIZED_REPORTER";
    /** The claimed per-subject sequence is not head + 1 (state unchanged). */
    readonly ACTIVITY_SEQUENCE_STALE: "ACTIVITY_SEQUENCE_STALE";
    /** Close requested for a correlation with no open interval. */
    readonly ACTIVITY_INTERVAL_NOT_OPEN: "ACTIVITY_INTERVAL_NOT_OPEN";
    /** Open requested while the triple already has an open interval. */
    readonly ACTIVITY_INTERVAL_ALREADY_OPEN: "ACTIVITY_INTERVAL_ALREADY_OPEN";
    /** The TeamLedger durable write failed (storage-level, re-typed). */
    readonly ACTIVITY_DURABLE_WRITE_FAILED: "ACTIVITY_DURABLE_WRITE_FAILED";
};
/** One of the closed activity error codes. */
export type ActivityErrorCode = (typeof ACTIVITY_ERROR_CODES)[keyof typeof ACTIVITY_ERROR_CODES];
/**
 * The typed activity error (the `code` is always one of the closed
 * `ACTIVITY_ERROR_CODES`; `details` carries the deterministic context the
 * caller needs to recover — e.g. the durable head and the expected next
 * sequence after `ACTIVITY_SEQUENCE_STALE`).
 */
export declare class ActivityError extends Error {
    /** The closed error code. */
    readonly code: ActivityErrorCode;
    /** The deterministic failure context (lossless JSON). */
    readonly details?: Record<string, unknown>;
    constructor(code: ActivityErrorCode, message: string, details?: Record<string, unknown>);
}
/** Type guard: `error` is a typed activity error (not a TeamRuntimeError). */
export declare function isActivityError(error: unknown): error is ActivityError;
//# sourceMappingURL=errors.d.ts.map