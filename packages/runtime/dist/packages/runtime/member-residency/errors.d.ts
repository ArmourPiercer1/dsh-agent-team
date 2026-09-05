/**
 * MemberResidency error channel (P5-T6).
 *
 * `MemberResidencyErrorCode` is a CLOSED vocabulary as of P5-T6 (same
 * discipline as the P5-T5 root-binding codes, the P5-T1 binder codes, and
 * the frozen contracts v1 error codes — Development Plan §9.1). Consumers
 * MUST branch on `code`, never on message text.
 *
 * Semantics of each code (fail-closed; no effect before the throw):
 *
 * - `MEMBER_RESIDENCY_INVALID_INPUT` — the request is structurally
 *   invalid (a malformed session/instance id, an empty or control-bearing
 *   label/groupId, an over-long label or workspace). The call performs NO
 *   durable write and NO agent-setup step.
 * - `MEMBER_RESIDENCY_ROOT_NOT_BOUND` — the fresh-create root does not
 *   carry a `team-root` session binding (absent, `ordinary`, or
 *   `team-member`): a Member can only be created under a bound Team root
 *   (invariant 8: one Root Session owns 0/1 TeamSession; the member
 *   hierarchy hangs off the TeamSession, not off an ordinary session).
 *   No effect.
 * - `MEMBER_RESIDENCY_RECORD_CONFLICT` — the durable TeamDomain state
 *   contradicts the request (invariant 41 authority, fail-closed): a
 *   `team-root` binding without its TeamSession record; an existing
 *   MemberInstance record at the derived identity whose creation spec
 *   does not match; a session binding for the derived child session that
 *   is not the member's `team-member` row (wrong kind, wrong root, or
 *   wrong instance); a member record without its session binding on the
 *   cold/evict paths. No effect.
 * - `MEMBER_RESIDENCY_LIFECYCLE_CONFLICT` — the durable lifecycle state
 *   forbids the operation: a fresh create on a terminal `DISPOSED`
 *   identity (a disposed Member can never be re-created under the same
 *   stable identity, DevPlan §18.5), or a settled-eviction requested for
 *   a non-`SETTLED` lifecycle (Architecture §31: eviction is the
 *   SETTLED-residency operation; RUNNING work is in flight, CREATED has
 *   no work yet, ARCHIVED/DISPOSED are out of the eviction path). No
 *   effect.
 * - `MEMBER_RESIDENCY_MEMBER_NOT_FOUND` — the addressed member identity
 *   `(rootSessionId, instanceId)` has no durable MemberInstance record
 *   (the evict path only; the cold path treats the same state as its
 *   zero-effect `absent` no-op, the member analogue of the ordinary-root
 *   no-op). No effect.
 *
 * Durable-write failures (the seam/repositories rejecting a put) and
 * binder failures (the P5-T1 `TeamAgentBinderError` channel) are NOT
 * wrapped: the repository/seam/binder error is the source of truth and
 * carries the stable code; the module only guarantees the ORDERING
 * (binder not run when a write failed) and the crash-safe re-drive
 * semantics of the fresh path.
 *
 * @module @dsh-agent-team/runtime/member-residency/errors
 */
/** The closed member-residency error-code vocabulary (P5-T6). */
export declare const MEMBER_RESIDENCY_ERROR_CODES: {
    /** Structurally invalid request (ids, label, groupId, workspace). No effect. */
    readonly MEMBER_RESIDENCY_INVALID_INPUT: "MEMBER_RESIDENCY_INVALID_INPUT";
    /** The root session is not a bound Team root. No effect. */
    readonly MEMBER_RESIDENCY_ROOT_NOT_BOUND: "MEMBER_RESIDENCY_ROOT_NOT_BOUND";
    /** The durable TeamDomain state contradicts the request. No effect. */
    readonly MEMBER_RESIDENCY_RECORD_CONFLICT: "MEMBER_RESIDENCY_RECORD_CONFLICT";
    /** The durable lifecycle state forbids the operation. No effect. */
    readonly MEMBER_RESIDENCY_LIFECYCLE_CONFLICT: "MEMBER_RESIDENCY_LIFECYCLE_CONFLICT";
    /** The addressed member identity has no durable record (evict path). No effect. */
    readonly MEMBER_RESIDENCY_MEMBER_NOT_FOUND: "MEMBER_RESIDENCY_MEMBER_NOT_FOUND";
};
/** One closed member-residency error code. */
export type MemberResidencyErrorCode = (typeof MEMBER_RESIDENCY_ERROR_CODES)[keyof typeof MEMBER_RESIDENCY_ERROR_CODES];
/** The flat value list (for the `isMemberResidencyError` check). */
export declare const MEMBER_RESIDENCY_ERROR_CODE_VALUES: readonly string[];
/**
 * The member-residency typed error. Carries a closed `code` and a
 * lossless-JSON `details` record.
 */
export declare class MemberResidencyError extends Error {
    /** The closed error code (branch on this, never on the message). */
    readonly code: MemberResidencyErrorCode;
    /** A lossless-JSON details record (no live references). */
    readonly details: Record<string, unknown>;
    /**
     * @param code - the closed error code.
     * @param message - the human-readable message (not an API).
     * @param details - the lossless-JSON details record.
     */
    constructor(code: MemberResidencyErrorCode, message: string, details?: Record<string, unknown>);
}
/**
 * Type guard: `true` iff `value` is an `Error` carrying one of the closed
 * member-residency codes.
 * @param value - the value to check.
 */
export declare function isMemberResidencyError(value: unknown): value is MemberResidencyError;
//# sourceMappingURL=errors.d.ts.map