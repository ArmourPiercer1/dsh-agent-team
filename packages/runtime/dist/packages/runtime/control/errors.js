/**
 * P6-T4 — the control/approval error vocabulary (the closed error contract
 * of the durable control plane).
 *
 * Every rejection produced by the control SERVICE layer (the request/
 * decision/guard operations that the P6-T2 facade's exported authority
 * steps do not cover) is a {@link ControlError} with a stable closed
 * `code` and optional lossless-JSON `details`. Branch on `code` (and
 * `details`), never on the message text.
 *
 * Authority-phase rejections (team/target resolution, caller identity/
 * role, envelope bounds) are raised by the REUSED P6-T2 facade steps
 * (`resolveTeamAndTarget` / `resolveCaller` / `enforceEnvelope`) and
 * surface as the facade's own {@link TeamRuntimeError} codes — this
 * module never re-raises or re-wraps them (integration, not a second
 * authority path).
 *
 * Fail-closed contract: every code below is thrown with ZERO durable side
 * effects EXCEPT where the durable write IS the rejection's evidence —
 * {@link CONTROL_ERROR_CODES.CONTROL_REQUEST_STALE} and
 * {@link CONTROL_ERROR_CODES.CONTROL_EXTERNAL_POLICY_DENIED} first record
 * the durable decision row (stale-denied / deny-with-external-policy)
 * and THEN throw, so the closed request state survives restart (the
 * documented recovery semantics; see `index.ts`).
 *
 * Code families (documented order of the pipeline that raises them):
 * - request validation: CONTROL_REQUEST_MALFORMED;
 * - request-time staleness (a request whose target can never act again):
 *   CONTROL_TARGET_STALE;
 * - decision lookup/state: CONTROL_REQUEST_NOT_FOUND,
 *   CONTROL_REQUEST_DECIDED, CONTROL_RESOLVER_NOT_AUTHORIZED;
 * - resolve-time staleness (the target became terminal after the request
 *   was durable): CONTROL_REQUEST_STALE;
 * - external hard policy: CONTROL_EXTERNAL_POLICY_DENIED;
 * - last-mile guard: CONTROL_GUARD_MALFORMED, CONTROL_GUARD_AMBIGUOUS.
 *
 * @module @dsh-agent-team/runtime/control/errors
 */
/** The closed control-service error codes. */
export const CONTROL_ERROR_CODES = {
    /** The control request/decision/guard input is malformed (bad ids, missing/unknown fields,
     *  non-closed kind/decision values). */
    CONTROL_REQUEST_MALFORMED: 'CONTROL_REQUEST_MALFORMED',
    /**
     * The requested operation targets a member instance that is already
     * terminal (DISPOSED — invariant 56) at REQUEST time: the request can
     * never become valid, so no durable request row is written (typed
     * request-time staleness, zero side effects). A missing target is the
     * facade's own INSTANCE_NOT_FOUND (typed addressing error), not this
     * code.
     */
    CONTROL_TARGET_STALE: 'CONTROL_TARGET_STALE',
    /** No durable control request exists for the given requestId (a decision
     *  without a request). */
    CONTROL_REQUEST_NOT_FOUND: 'CONTROL_REQUEST_NOT_FOUND',
    /** The durable control request already carries a decision (double
     *  resolution; fail closed — the first decision is authoritative). */
    CONTROL_REQUEST_DECIDED: 'CONTROL_REQUEST_DECIDED',
    /**
     * The caller's role is outside the request kind's closed resolver role
     * set (e.g. a member resolving its own request — no self-approval,
     * invariant 37 — even when the template envelope allows the
     * `resolve-control` op: the role closure is checked FIRST).
     */
    CONTROL_RESOLVER_NOT_AUTHORIZED: 'CONTROL_RESOLVER_NOT_AUTHORIZED',
    /**
     * Resolve-time staleness: when the decision was being recorded, the
     * request's target instance was terminal (DISPOSED) or the team session
     * record had vanished. The durable decision row is recorded as
     * `stale-denied` FIRST (the request is closed and can never become an
     * allow — fail closed), and this typed error is thrown second. No other
     * side effect occurs.
     */
    CONTROL_REQUEST_STALE: 'CONTROL_REQUEST_STALE',
    /**
     * The requested decision was `allow` but the external hard policy
     * denies the operation's capability cell (a hard `deny`, an allow-list
     * that excludes the named item, or an explicit
     * `capabilityExists:false`). A durable decision row is recorded as
     * `deny` with `reason: 'external-policy'` FIRST (even a human/leader
     * allow fails closed — Architecture 25.4, invariant 34), and this typed
     * error is thrown second.
     */
    CONTROL_EXTERNAL_POLICY_DENIED: 'CONTROL_EXTERNAL_POLICY_DENIED',
    /** The guard input is malformed (bad ids, missing scope fields). */
    CONTROL_GUARD_MALFORMED: 'CONTROL_GUARD_MALFORMED',
    /**
     * The guard found two or more DISTINCT unconsumed durable allow
     * decisions for the exact same operation scope (an authorization
     * conflict that must be adjudicated by a human, never guessed — fail
     * closed).
     */
    CONTROL_GUARD_AMBIGUOUS: 'CONTROL_GUARD_AMBIGUOUS',
};
/** Every control-service error code value, for membership checks. */
export const CONTROL_ERROR_CODE_VALUES = Object.values(CONTROL_ERROR_CODES);
/**
 * One rejection of the durable control plane.
 */
export class ControlError extends Error {
    /** The stable closed error code (branch on this, never the message). */
    code;
    /** Optional lossless-JSON details (no live objects cross the boundary). */
    details;
    constructor(code, message, details) {
        super(message);
        this.name = 'ControlError';
        this.code = code;
        if (details !== undefined) {
            this.details = details;
        }
    }
}
/** Type guard: is `value` a {@link ControlError}? */
export function isControlError(value) {
    return value instanceof ControlError;
}
//# sourceMappingURL=errors.js.map