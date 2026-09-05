/**
 * P7-T3 — the lifecycle runtime's closed error channel
 * (TaskDoc §11.5 P7-T3 card; ruling R34 owned surface
 * `packages/runtime/lifecycle/**`).
 *
 * Every rejection of the Archive / Restore / Dispose procedures is one of
 * these seven codes. The codes are deliberately DISJOINT from the P5-T6
 * member-residency codes and from the P3-T3 domain lifecycle codes:
 *
 * - a *domain* `LifecycleTransitionError` (the pure FSM rejection) is
 *   mapped into `LIFECYCLE_ILLEGAL_STATE` here — the runtime never leaks
 *   the domain error type to its callers;
 * - a P5-T6 `MemberResidencyError` from the identity gate is mapped into
 *   `LIFECYCLE_INVALID_INPUT` — the runtime's input contract is its own.
 *
 * No-effect guarantees (asserted by the tests): `LIFECYCLE_INVALID_INPUT`,
 * `LIFECYCLE_LEADER_NOT_OPERABLE`, `LIFECYCLE_MEMBER_NOT_FOUND`,
 * `LIFECYCLE_ILLEGAL_STATE` and `LIFECYCLE_NOT_QUIESCENT` are all thrown
 * BEFORE any live effect and with ZERO durable writes;
 * `LIFECYCLE_LIVE_EFFECT_FAILED` is thrown before the
 * remaining live steps and the durable commit; `LIFECYCLE_DURABLE_STATE_
 * FAILED` carries the durable phase (`read` | `write`) and, for a write,
 * the failing commit step.
 *
 * Pure error vocabulary: no I/O, no live Agent.
 * @module @dsh-agent-team/runtime/lifecycle/errors
 */
/** Closed set of lifecycle runtime error codes (P7-T3). */
export const LIFECYCLE_RUNTIME_ERROR_CODES = {
    /** The target identity failed the P5-T6 identity gate (fail-closed). No effect. */
    LIFECYCLE_INVALID_INPUT: 'LIFECYCLE_INVALID_INPUT',
    /** The addressed member has no durable record. No effect. */
    LIFECYCLE_MEMBER_NOT_FOUND: 'LIFECYCLE_MEMBER_NOT_FOUND',
    /**
     * The addressed instance is the reserved LeaderInstance (P8-S2,
     * Architecture §9.2, invariant 15): the Leader IS the Root Agent + the
     * Root Session, so it cannot be independently archived, restored, or
     * disposed. Thrown before the durable read; no effect. The rejection is
     * shape-agnostic — a missing row and a legacy v1 hack row are rejected
     * identically (never defaulted, never made operable).
     */
    LIFECYCLE_LEADER_NOT_OPERABLE: 'LIFECYCLE_LEADER_NOT_OPERABLE',
    /** The durable lifecycle state forbids the operation (the §29 FSM; the domain error is mapped, never leaked). No effect. */
    LIFECYCLE_ILLEGAL_STATE: 'LIFECYCLE_ILLEGAL_STATE',
    /** The descendant drain reported residual activity (quiescence negative). Zero durable writes; the residency is NOT released (the §30.1 order is structural). */
    LIFECYCLE_NOT_QUIESCENT: 'LIFECYCLE_NOT_QUIESCENT',
    /** A live port (admission-close / interrupt / descendant-drain / residency-release) faulted mid-procedure. The later steps do not run; zero durable writes. */
    LIFECYCLE_LIVE_EFFECT_FAILED: 'LIFECYCLE_LIVE_EFFECT_FAILED',
    /** A durable TeamDomain read or write failed. `details.phase` is `'read'` or `'write'`; a write fault additionally carries `details.step` (the failing commit). */
    LIFECYCLE_DURABLE_STATE_FAILED: 'LIFECYCLE_DURABLE_STATE_FAILED',
};
/** The flat value list (for the `isLifecycleRuntimeError` check). */
export const LIFECYCLE_RUNTIME_ERROR_CODE_VALUES = Object.freeze(Object.values(LIFECYCLE_RUNTIME_ERROR_CODES));
/**
 * The lifecycle runtime typed error. Carries a closed `code` and a
 * lossless-JSON `details` record (no live references).
 */
export class LifecycleRuntimeError extends Error {
    /** The closed error code (branch on this, never on the message). */
    code;
    /** A lossless-JSON details record (no live references). */
    details;
    /**
     * @param code - the closed error code.
     * @param message - the human-readable message.
     * @param details - the lossless-JSON details (defaults to `{}`).
     */
    constructor(code, message, details = {}) {
        super(message);
        this.name = 'LifecycleRuntimeError';
        this.code = code;
        this.details = details;
    }
}
/** Type guard for {@link LifecycleRuntimeError}. */
export function isLifecycleRuntimeError(value) {
    if (!(value instanceof Error))
        return false;
    const code = value.code;
    return typeof code === 'string' && LIFECYCLE_RUNTIME_ERROR_CODE_VALUES.includes(code);
}
/**
 * Render an unknown thrown value into a stable message fragment.
 * @param error - the unknown thrown value.
 * @returns the `Error.message`, or a JSON rendering for non-Errors.
 */
export function errorMessage(error) {
    if (error instanceof Error)
        return error.message;
    try {
        return JSON.stringify(error);
    }
    catch {
        return String(error);
    }
}
//# sourceMappingURL=errors.js.map