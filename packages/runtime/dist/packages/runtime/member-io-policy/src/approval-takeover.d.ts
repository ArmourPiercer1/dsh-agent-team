/**
 * Alpha.5 Sandbox-First — R1 (BL-09), the approval takeover bridge.
 *
 * WHAT THIS MODULE IS. The ONE seam between the new execution lane and the
 * EXISTING Alpha.4 approval authority. The new lane computes its hard ceiling
 * with `compileEffectiveIo` (P1-02). When that compiled intersection classifies
 * an authored locator as `ask`, this adapter:
 *
 *   1. refuses immediately if the locator is NOT an exact authored `ask`
 *      locator (a hard-ceiling `deny` can never be unlocked by an approval,
 *      and an ask SUBTREE is never widened);
 *   2. consults the existing public last-mile approval guard
 *      (`ControlService.guardOperation`, the same seam P6-T6 wires into the
 *      tool pipeline) with the EXACT `ControlOperationScope` the caller built;
 *   3. on `allowed: true`, returns the compiler's `EffectiveIoPolicy` with
 *      exactly that one ask locator moved to `allow` and removed from `ask`.
 *
 * WHAT IT IS NOT.
 *  - NOT a second permission computation: it never re-reads a blueprint, an
 *    overlay or an authoring map. Its only lane input is the already-compiled
 *    `MemberPolicy` + `ToolIoRestriction`; its only lane operation is one
 *    `ask → allow` move on the COMPILED lane. A source-fence test
 *    (`a5sf-approval-takeover.test.ts`) fails if a second compiler is imported.
 *  - NOT a second approval store / grant table: it owns no state at all. The
 *    durable allow and its exactly-once consumption stay in the Alpha.4
 *    `ControlService`; the adapter merely observes `ControlGuardVerdict` and
 *    maps the existing `allow-consumed` block reason to a typed refusal. A
 *    replay therefore reaches the SAME durable guard and is refused by it.
 *  - NOT an approval REQUESTER: requesting and resolving the `ApprovalCase` is
 *    the existing Alpha.4 pre-execute pipeline's job. This adapter only
 *    CONSUMES a decision that already exists, at execution time.
 *
 * THE INVARIANT. `EffectiveIo ⊆ MemberCeiling ∩ ToolRestriction` is unchanged:
 * the narrowed result is a strict subset of the compiled intersection (the
 * asked locator was inside the surviving `ask` lane, which the compiler only
 * retains when BOTH axes permit it). Approval changes disposition, never the
 * ceiling. An approval can only ever select one already-`ask` locator.
 *
 * NAMED LIMIT (disclosed, not worked around): a request for a locator that is
 * merely a CHILD of an authored `ask` locator is refused with
 * `APPROVAL_SCOPE_UNBOUND`. Allowing it would require turning the whole ask
 * subtree into allow (a widening) or inventing a per-call exception lane that
 * the provider algebra does not have. The caller must ask for the authored
 * locator itself.
 *
 * @module @dsh-agent-team/runtime/member-io-policy/approval-takeover
 */
import type { ControlGuardVerdict, ControlOperationScope } from '../../control/index.js';
import type { EffectiveIoPolicy, InvocationAuthority, MemberPolicy, PathAxes, PolicyRefusal, ToolIoRestriction } from './types.js';
/**
 * The EXISTING public approval decision seam, structurally identical to
 * `ControlService['guardOperation']` (the durable last-mile guard). Passing the
 * real service's bound method is the production wiring; a structural stand-in
 * that skips the durable row does NOT satisfy the law this adapter documents.
 */
export type AskApprovalAuthority = (scope: ControlOperationScope) => Promise<ControlGuardVerdict>;
/** Closed refusal vocabulary of the takeover bridge. */
export declare const APPROVAL_TAKEOVER_REFUSAL_CODES: {
    /** The compiled policy belongs to an older Member generation. */
    readonly MEMBER_POLICY_STALE: "MEMBER_POLICY_STALE";
    /** The asked locator is not an authored `ask` locator of the compiled lane. */
    readonly APPROVAL_SCOPE_UNBOUND: "APPROVAL_SCOPE_UNBOUND";
    /** The compiled hard ceiling denies the locator: an approval can never widen. */
    readonly APPROVAL_CANNOT_WIDEN: "APPROVAL_CANNOT_WIDEN";
    /** The locator is already allowed; there is nothing for an approval to do. */
    readonly APPROVAL_NOT_ASKED: "APPROVAL_NOT_ASKED";
    /** The exact Control scope does not name this member/tool. */
    readonly APPROVAL_SCOPE_MISMATCH: "APPROVAL_SCOPE_MISMATCH";
    /** The existing authority refused (deny / pending / stale / no request). */
    readonly APPROVAL_DENIED: "APPROVAL_DENIED";
    /** The existing authority reports the durable allow was already consumed. */
    readonly APPROVAL_ALREADY_CONSUMED: "APPROVAL_ALREADY_CONSUMED";
    /** The existing authority threw or was unavailable (fail closed). */
    readonly APPROVAL_AUTHORITY_FAILED: "APPROVAL_AUTHORITY_FAILED";
};
export type ApprovalTakeoverRefusalCode = (typeof APPROVAL_TAKEOVER_REFUSAL_CODES)[keyof typeof APPROVAL_TAKEOVER_REFUSAL_CODES];
/** Every refusal code, for membership checks. */
export declare const APPROVAL_TAKEOVER_REFUSAL_CODE_VALUES: readonly string[];
export interface ApprovalTakeoverRefusal {
    readonly ok: false;
    readonly code: ApprovalTakeoverRefusalCode;
    readonly detail: string;
    readonly path: string;
}
/** Accepted = the compiler output narrowed by exactly one ask→allow move. */
export type ApprovalTakeoverResult = {
    readonly ok: true;
    readonly value: EffectiveIoPolicy;
} | PolicyRefusal | ApprovalTakeoverRefusal;
export interface ResolveAskClassCallInput {
    /** The P1-02 compiled Member half (NOT re-derived from a blueprint). */
    readonly memberPolicy: MemberPolicy;
    /** The P1-02 projected tool half (the RIGHT factor). */
    readonly tool: ToolIoRestriction;
    /** The P1-04 projected invocation tuple (call id / revision / binding). */
    readonly invocation: InvocationAuthority;
    /**
     * The generation the TeamDomain currently trusts for this Member. A policy
     * compiled for a different generation is stale and never authorizes a call.
     */
    readonly currentInstanceGeneration: number;
    /**
     * The TeamSession root that OWNS the compiled MemberPolicy. REQUIRED: an
     * instance id is unique only WITHIN one team, so a durable allow minted for
     * `team.other` can carry the same `targetInstanceId` as this member. The
     * adapter refuses unless this equals `scope.rootSessionId`. The value must be
     * sourced from the trusted TeamDomain the policy was compiled under, NEVER
     * copied from `scope` — copying it would make the comparison vacuous.
     */
    readonly expectedRootSessionId: string;
    /** The axis and the EXACT authored ask locator this call targets. */
    readonly ask: {
        readonly axis: PathAxes;
        readonly locator: string;
        /**
         * The canonical operation fingerprint of that locator, as produced by the
         * EXISTING Alpha.4 canonicalizer (`operation-permission/canonical-operation`).
         * Required whenever the Control scope carries an `operationFingerprint`
         * (an exact-scope approval): the adapter compares the two strings and never
         * derives a fingerprint itself (that would be a second canonicalizer).
         */
        readonly operationFingerprint?: string;
    };
    /** The exact durable Control scope the existing approval covers. */
    readonly scope: ControlOperationScope;
    /** The existing Alpha.4 last-mile approval guard (`guardOperation`). */
    readonly approvalAuthority: AskApprovalAuthority;
}
/**
 * Resolve ONE `ask`-class call against the EXISTING approval authority.
 *
 * Fail-closed order: generation → single compiler → hard-ceiling disposition →
 * exact scope binding → existing guard. Every earlier refusal happens BEFORE
 * the guard is consulted, so a denied/unbound call never burns an allow.
 */
export declare function resolveAskClassCall(input: ResolveAskClassCallInput): Promise<ApprovalTakeoverResult>;
//# sourceMappingURL=approval-takeover.d.ts.map