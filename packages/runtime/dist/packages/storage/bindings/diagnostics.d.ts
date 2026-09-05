/**
 * Binding diagnostics — the closed v1 diagnostic vocabulary of the
 * SessionBinding integrity layer (TaskDoc §11.5 P4-T3).
 *
 * Diagnostics are RESULTS, not errors: the reconciler reads stored
 * records and reports every integrity violation it finds (Architecture
 * §15.3 bidirectional integrity). A self-contradictory TeamDomain must
 * **fail closed for new Team work** and MUST NOT guess which side of a
 * mismatch is right (Architecture §15.3) — so this layer never rewrites
 * records; it only names the exact inconsistency with a stable code.
 *
 * Consumers branch on `code`, never on `message` (the same discipline as
 * `TeamDomainError` and `TeamContractError`). Every field is remote-safe
 * (lossless JSON), asserted at construction.
 *
 * Pure module: no I/O, no repository access.
 * @module @dsh-agent-team/storage/bindings/diagnostics
 */
import type { RemoteSafeRecord } from '../../contracts/src/index.js';
/**
 * The closed set of v1 binding-integrity diagnostic codes.
 *
 * Direction naming: "member binding" = a `team-member` SessionBinding row
 * (child session → (rootSessionId, instanceId)); "member record" = a
 * MemberInstanceRecord; "root binding" = a `team-root` SessionBinding row.
 */
export declare const BINDING_DIAGNOSTIC_CODES: {
    /**
     * The scope root has team artifacts (a root binding, member records, and/or
     * member bindings) but no TeamSession record: the binding's rootSessionId
     * does not match any TeamSession ("wrong root" at the team level).
     */
    readonly TEAM_SESSION_MISSING: "team-session-missing";
    /** A TeamSession record exists, but its root session has no `team-root` binding row. */
    readonly MISSING_ROOT_BINDING: "missing-root-binding";
    /** The team root session id is bound, but with a non-`team-root` kind (`ordinary` or `team-member`). */
    readonly ROOT_BINDING_KIND_CONFLICT: "root-binding-kind-conflict";
    /**
     * A MemberInstanceRecord's child session has NO binding row (backward
     * direction of §15.3 broken; the "missing child" crash-window case,
     * Development Plan §17.4 "before SessionBinding").
     */
    readonly MISSING_MEMBER_BINDING: "missing-member-binding";
    /**
     * A `team-member` binding row has NO MemberInstanceRecord for its
     * (rootSessionId, instanceId) (forward direction of §15.3 broken; the
     * "diagnosable orphan" of Development Plan §17.4).
     */
    readonly ORPHAN_MEMBER_BINDING: "orphan-member-binding";
    /**
     * A `team-member` binding (child C, R, i) and a MemberInstanceRecord
     * (R, i) both exist, but the record's childSessionId ≠ C: the binding and
     * the record disagree on the durable child session (invariant 23/24).
     */
    readonly MEMBER_CHILD_MISMATCH: "member-child-mismatch";
    /**
     * A MemberInstanceRecord (R, i, child C) of the scope team exists, but C
     * is bound as a `team-member` of a DIFFERENT root R′: the child is bound
     * to the wrong root (bidirectional integrity violation).
     */
    readonly CHILD_BOUND_TO_OTHER_ROOT: "child-bound-to-other-root";
    /**
     * A MemberInstanceRecord (R, i, child C) of the scope team exists, but C
     * is bound as a `team-member` of the SAME root under a DIFFERENT
     * instance i′: the child is bound to the wrong instance.
     */
    readonly CHILD_BOUND_TO_OTHER_INSTANCE: "child-bound-to-other-instance";
    /**
     * A MemberInstanceRecord (R, i, child C) of the scope team exists, but C
     * is bound with a non-`team-member` kind (`ordinary` or `team-root`):
     * the binding kind contradicts the membership claim.
     */
    readonly BINDING_KIND_CONFLICT: "binding-kind-conflict";
    /**
     * Two or more MemberInstanceRecords of the scope team claim the SAME
     * child session (invariant 23: every MemberInstance binds exactly one
     * durable child Session; a child is never shared between members).
     */
    readonly DUPLICATE_CHILD_CLAIM: "duplicate-child-claim";
};
/** The frozen v1 diagnostic-code type. */
export type BindingDiagnosticCode = (typeof BINDING_DIAGNOSTIC_CODES)[keyof typeof BINDING_DIAGNOSTIC_CODES];
/** Every v1 diagnostic-code value, for membership checks and closed-set tests. */
export declare const BINDING_DIAGNOSTIC_CODE_VALUES: readonly string[];
/** Is `value` one of the closed v1 diagnostic codes? */
export declare function isBindingDiagnosticCode(value: unknown): value is BindingDiagnosticCode;
/**
 * One integrity violation found by the reconciler.
 *
 * `rootSessionId` is always the scope root of the reconciliation run.
 * `sessionId` is the session the diagnostic is about (a member's child
 * session, or the team root session for root-level diagnostics);
 * `instanceId` the member instance, when applicable. `context` carries
 * optional structured extra values (remote-safe).
 */
export interface BindingDiagnostic {
    /** The stable v1 diagnostic code. */
    readonly code: BindingDiagnosticCode;
    /** The reconciliation scope root (team root session id). */
    readonly rootSessionId: string;
    /** The session the diagnostic is about, when applicable. */
    readonly sessionId?: string;
    /** The member instance the diagnostic is about, when applicable. */
    readonly instanceId?: string;
    /** Optional structured context (remote-safe; sorted keys). */
    readonly context?: RemoteSafeRecord;
    /** Human-readable summary (never branch on it). */
    readonly message: string;
}
/**
 * Build one frozen `BindingDiagnostic`.
 *
 * @param code - the closed v1 diagnostic code.
 * @param rootSessionId - the reconciliation scope root.
 * @param message - the human-readable summary.
 * @param extra - optional `sessionId` / `instanceId` / `context` fields.
 * @returns the frozen diagnostic.
 * @throws when `code` is not in the closed v1 set or a field is not
 *   remote-safe.
 */
export declare function createBindingDiagnostic(code: BindingDiagnosticCode, rootSessionId: string, message: string, extra?: {
    sessionId?: string;
    instanceId?: string;
    context?: RemoteSafeRecord;
}): BindingDiagnostic;
//# sourceMappingURL=diagnostics.d.ts.map