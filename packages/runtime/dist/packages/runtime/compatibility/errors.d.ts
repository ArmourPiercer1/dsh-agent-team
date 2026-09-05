/**
 * P7-T1 — the closed error vocabulary of the runtime compatibility
 * module.
 *
 * Every failure of the module is a {@link CompatibilityError} with a
 * stable `code` and plain-JSON `details` (the consumer contract follows
 * the established runtime pattern of the P6 activation/admission error
 * classes; TeamDomain/contracts errors raised by the injected
 * repositories pass through unchanged — this module never rewraps
 * durable-write failures).
 * @module @dsh-agent-team/runtime/compatibility/errors
 */
/** The closed compatibility error-code vocabulary. */
export declare const COMPATIBILITY_ERROR_CODES: {
    /** §28.1/§41.7: an unhandled warning/fatal blocks NEW WORK admission
     *  (the in-flight work is unaffected — §28.2). */
    readonly NEW_WORK_BLOCKED: "COMPATIBILITY_NEW_WORK_BLOCKED";
    /** §27.2: FATAL is never ack-able (no Continue Anyway for structural
     *  contract failures). */
    readonly FATAL_NOT_ACKNOWLEDGABLE: "COMPATIBILITY_FATAL_NOT_ACKNOWLEDGABLE";
    /** §27.3: the acknowledgement targets a requirement that is not a
     *  WARNING in the current evaluation (PASS has nothing to bind to;
     *  FATAL is not ack-able at all). */
    readonly ACK_TARGET_NOT_WARNING: "COMPATIBILITY_ACK_TARGET_NOT_WARNING";
    /** settleWork was called for a workId this prober never admitted. */
    readonly WORK_UNKNOWN: "COMPATIBILITY_WORK_UNKNOWN";
    /** settleWork was called twice for the same workId. */
    readonly WORK_ALREADY_SETTLED: "COMPATIBILITY_WORK_ALREADY_SETTLED";
    /** The bound blueprint carries a capability-requirement domain outside
     *  the closed bridge vocabulary (Architecture §27.1: unknown
     *  requirement domain is a validation error, surfaced here at probe
     *  time). */
    readonly UNBRIDGEABLE_REQUIREMENT: "COMPATIBILITY_UNBRIDGEABLE_REQUIREMENT";
};
/** One of the closed compatibility error codes. */
export type CompatibilityErrorCode = (typeof COMPATIBILITY_ERROR_CODES)[keyof typeof COMPATIBILITY_ERROR_CODES];
/** Every code value, for closed-set membership tests. */
export declare const COMPATIBILITY_ERROR_CODE_VALUES: readonly string[];
/**
 * One compatibility-module failure (stable code + plain-JSON details).
 */
export declare class CompatibilityError extends Error {
    /** The stable closed code. */
    readonly code: CompatibilityErrorCode;
    /** Plain-JSON failure details (never a live object). */
    readonly details?: Record<string, unknown>;
    constructor(code: CompatibilityErrorCode, message: string, details?: Record<string, unknown>);
}
/** Type guard: is `value` a {@link CompatibilityError}? */
export declare function isCompatibilityError(value: unknown): value is CompatibilityError;
//# sourceMappingURL=errors.d.ts.map