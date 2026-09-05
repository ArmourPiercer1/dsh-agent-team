/**
 * Typed errors for the member domain (P3-T3): Template→Instance creation,
 * contextPolicy / delegation resolution, workspace creation semantics.
 *
 * Error vocabulary split (contract v1 rule, `packages/contracts/src/errors.ts`
 * header): the frozen 20-code `TeamContractError` vocabulary covers *contract*
 * rules (identity format, binding cardinality, roster lookup, DTO shape,
 * legacy vocabulary). The rules below are *domain* rules (Architecture
 * §10–§12, §21.2, §21.6, §11.2–§11.3), so they carry their own typed error.
 * The codes are deliberately disjoint from the contract code set:
 * `isTeamContractError` branches on `code`, so a member-domain error must
 * never be mistaken for a contract error, and vice versa.
 *
 * Pure module: no I/O, no live Agent, no runtime environment assumptions.
 * @module @dsh-agent-team/domain/member/errors
 */
/** Closed set of member-domain error codes (P3-T3). */
export declare const MEMBER_DOMAIN_ERROR_CODES: {
    /** A `contextPolicy` value is not one of the frozen vocabulary ({@link CONTEXT_POLICIES}); the policy freezes at creation (§21.6) and unknown values are rejected. */
    readonly CONTEXT_POLICY_UNKNOWN: "CONTEXT_POLICY_UNKNOWN";
    /** A delegation request must be instance-first (explicitInstanceId) OR template-level (templateId) — exactly one (§24.1, §11.3). */
    readonly DELEGATION_TARGET_INVALID: "DELEGATION_TARGET_INVALID";
    /** A persistent template-level delegation matched more than one work-accepting instance of the template in the team; the caller must address an instance explicitly (Architecture §11.2; invariant 19 — label/template are not runtime identities). */
    readonly DELEGATION_TARGET_AMBIGUOUS: "DELEGATION_TARGET_AMBIGUOUS";
    /** An explicitly addressed instance is DISPOSED and cannot receive new Team work (Architecture §29.5). */
    readonly DELEGATION_TARGET_DISPOSED: "DELEGATION_TARGET_DISPOSED";
    /** The reserved LeaderInstance id (`inst-leader`, invariants 13/14) may not be minted by the member creation path; the leader's row is owned by the runtime. */
    readonly INSTANCE_ID_RESERVED: "INSTANCE_ID_RESERVED";
    /** A workspace mutation was requested after the instance first entered RUNNING: workspace is creation-mutable, immutable after first RUNNING (§21.2); a new route means a new MemberInstance. */
    readonly WORKSPACE_MUTATION_FORBIDDEN: "WORKSPACE_MUTATION_FORBIDDEN";
};
/** A member-domain error code. */
export type MemberDomainErrorCode = (typeof MEMBER_DOMAIN_ERROR_CODES)[keyof typeof MEMBER_DOMAIN_ERROR_CODES];
/**
 * Thrown when a member-domain rule is violated.
 *
 * `details` is a closed, remote-safe diagnostic object (strings / numbers /
 * arrays of strings) — no live data, no Host references.
 */
export declare class MemberDomainError extends Error {
    /** Disjoint-from-contracts error code ({@link MEMBER_DOMAIN_ERROR_CODES}). */
    readonly code: MemberDomainErrorCode;
    /** Structured, remote-safe diagnostic fields for this violation. */
    readonly details: Readonly<Record<string, string | number | readonly string[]>>;
    constructor(code: MemberDomainErrorCode, message: string, details?: Readonly<Record<string, string | number | readonly string[]>>);
}
/** Type guard for {@link MemberDomainError}. */
export declare function isMemberDomainError(value: unknown): value is MemberDomainError;
//# sourceMappingURL=errors.d.ts.map