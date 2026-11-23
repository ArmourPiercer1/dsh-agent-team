/**
 * Alpha.5 P1-09 — the ApprovedAskReceipt (R3 of owner ruling 20261124-0151 §2).
 *
 * WHAT IT IS: the ONE object a confined Provider may read to satisfy a compiled
 * `ask` disposition. It is minted by the CENTRE at the exact moment the host
 * Tool Guard consumes the one-shot Grant, bound to the execution that was
 * approved, and available ONLY inside that execution's own tool body.
 *
 * WHAT IT IS NOT: it is not a second approval authority, not a second grant,
 * not a global callId map, and not a reusable token. It mints nothing on its
 * own: the durable Control decision and the one-shot grant consumption are the
 * authority, and the receipt is their non-model-forgeable projection for the
 * Provider plane.
 *
 * LAWS (machine-checked by the R3 arms in `vnext-admission.test.mjs`):
 *  - EXECUTION-SCOPED: `mintApprovedAskReceipt` is registered against the HOST
 *    EXECUTION OBJECT (a module-private WeakMap key), never against a callId
 *    string. A different execution with the same callId finds nothing.
 *  - DELIVERED ONCE, INSIDE THE BODY: the receipt is only readable through the
 *    `AsyncLocalStorage` scope opened by the centre's `tools/execute` listener
 *    for that exact execution and closed when the body returns. A closed
 *    receipt is `RECEIPT_CLOSED` even if its object was captured.
 *  - CANONICAL OPERATION: the receipt names the Provider-resolved path and a
 *    content digest. The Provider re-resolves the real access path and refuses
 *    if the receipt does not cover THAT operation; a symlink retarget between
 *    approval and the effect is therefore a mismatch, not an alias.
 *  - BOUNDS: the receipt carries the lane snapshot it was approved under. The
 *    Provider checks the operation against BOTH the live lane and that
 *    snapshot; `deny` always wins and is checked before any receipt.
 *  - REVOCATION: the receipt carries the invocation binder's `binderEpoch` and
 *    `memberEpoch` at consumption. A later `bumpEpoch()`/`revoke(member)` makes
 *    it dead without a second revocation ledger.
 *  - NOT MODEL-FORGEABLE: the object is branded in a module-private WeakSet,
 *    frozen, and never returned to the model, the tool arguments or the durable
 *    log; a structural copy is refused (`RECEIPT_UNKNOWN`). The only writer of
 *    the scope is the centre's own port.
 *
 * THIS ROUND COVERS EXACTLY ONE OPERATION: the native `write` tool's
 * `writeText` effect. Every other method/tool keeps the R4 fail-closed
 * `IO_ASK_REQUIRES_APPROVAL` refusal; generalising is a later ruling.
 *
 * @module @dsh-agent-team/runtime/member-io-policy/approved-ask-receipt
 */
import { type PathIdentityResolver } from './provider-capabilities.js';
import type { PathRuleSet } from './types.js';
/** The one record schema. A reader that does not know it must fail loud. */
export declare const APPROVED_ASK_RECEIPT_SCHEMA: "a5sf-approved-ask-receipt/1";
/**
 * Closed refusal vocabulary. NONE of these starts with `ADMISSION_`: a
 * Provider refusal happens AFTER the body started, and the execution-fact
 * classifier must settle it as the real phase (FAILED / body-started), never
 * as a pre-execution `REFUSED / not-started`.
 */
export declare const APPROVED_ASK_RECEIPT_REFUSAL_CODES: readonly ["RECEIPT_NOT_IN_SCOPE", "RECEIPT_UNKNOWN", "RECEIPT_CLOSED", "RECEIPT_REUSED", "RECEIPT_MEMBER_MISMATCH", "RECEIPT_TOOL_MISMATCH", "RECEIPT_POLICY_GENERATION_MISMATCH", "RECEIPT_AUTHORITY_UNAVAILABLE", "RECEIPT_REVOKED", "RECEIPT_OPERATION_MISMATCH", "RECEIPT_CONTENT_MISMATCH", "RECEIPT_CONTENT_UNAVAILABLE", "RECEIPT_PATH_UNRESOLVED", "RECEIPT_DENIED", "RECEIPT_BOUNDS_VIOLATION", "RECEIPT_INPUT_INVALID"];
export type ApprovedAskReceiptRefusalCode = (typeof APPROVED_ASK_RECEIPT_REFUSAL_CODES)[number];
/** The trusted member identity a receipt is bound to (the grant's own tuple). */
export interface ApprovedAskMemberIdentity {
    readonly teamId: string;
    readonly memberInstanceId: string;
    readonly templateId: string;
    readonly instanceGeneration: number;
}
/** The ONE operation this round can authorize: a native `write` of known bytes. */
export interface ApprovedAskOperation {
    readonly toolName: 'write';
    /** The authored locator the approval named. */
    readonly locator: string;
    /** The Provider-resolved canonical path the approval covers. */
    readonly canonicalPath: string;
    /** Digest of the approved bytes; the Provider re-hashes what it is about to write. */
    readonly contentSha256: string;
    /** Deterministic digest of the three fields above, carried for auditability. */
    readonly fingerprint: string;
}
/** The frozen projection of `(Member, Tool, operation, approval, grant)`. */
export interface ApprovedAskReceipt {
    readonly schema: typeof APPROVED_ASK_RECEIPT_SCHEMA;
    readonly receiptId: string;
    readonly executionId: string;
    readonly callId: string;
    readonly member: ApprovedAskMemberIdentity;
    readonly toolName: string;
    /** The compiled ToolBinding identity when the declaration carried one, else ''. */
    readonly toolBindingIdentity: string;
    readonly operation: ApprovedAskOperation;
    /** The policy generation the REVIEWER's decision named (== binding.policyGeneration). */
    readonly policyGeneration: string;
    readonly approval: {
        readonly requestId: string;
        readonly decisionId: string;
        readonly caseId: string | null;
        readonly legOrdinal: number | null;
    };
    /**
     * The one-shot grant's consumption facts. `consumed: true` is literal: a
     * receipt is only minted after `binder.consume` returned ok.
     */
    readonly grant: {
        readonly consumed: true;
        readonly memberEpoch: number;
        readonly binderEpoch: number;
    };
    /** The lane snapshot the receipt was approved under (the original hard bounds). */
    readonly bounds: {
        readonly read: PathRuleSet;
        readonly write: PathRuleSet;
    };
}
/** What the centre's approval port hands the minter (already trusted values). */
export interface MintApprovedAskReceiptInput {
    readonly executionId: string;
    readonly callId: string;
    readonly member: ApprovedAskMemberIdentity;
    readonly toolName: string;
    readonly toolBindingIdentity: string;
    readonly operation: ApprovedAskOperation;
    readonly policyGeneration: string;
    readonly approval: ApprovedAskReceipt['approval'];
    readonly grant: ApprovedAskReceipt['grant'];
    readonly bounds: ApprovedAskReceipt['bounds'];
}
export type MintApprovedAskReceiptResult = {
    readonly ok: true;
    readonly value: ApprovedAskReceipt;
} | {
    readonly ok: false;
    readonly code: ApprovedAskReceiptRefusalCode;
    readonly detail: string;
};
/** One Provider-side authorization request, over the LIVE lane. */
export interface AuthorizeAskWithReceiptInput {
    readonly memberIdentity: string;
    /** The policy revision the Provider is enforcing (`member.revision` / `policy.policyRevision`). */
    readonly policyRevision: string;
    /** The compiled binding identity of the realm, when it has one (`toolBindingIdentity`). */
    readonly toolBindingIdentity?: string;
    readonly lane: PathRuleSet;
    readonly method: string;
    readonly locator: string;
    readonly access: 'read' | 'write';
    readonly content?: string;
    readonly resolver?: PathIdentityResolver;
    /**
     * The invocation binder's read-only epoch surface. REQUIRED: without it a
     * receipt could not be proven live, so the ask is refused (fail-closed).
     */
    readonly authority?: {
        readonly binder?: {
            currentEpoch(): number;
            currentMemberEpoch(memberIdentity: string): number;
        };
    };
}
export type AuthorizeAskWithReceiptResult = {
    readonly ok: true;
    readonly resolved: string;
    readonly receipt: ApprovedAskReceipt;
} | {
    readonly ok: false;
    readonly code: ApprovedAskReceiptRefusalCode;
    readonly detail: string;
};
/** The per-execution authorization scope the Provider can read from a body. */
export interface ApprovedAskExecutionScope {
    readonly schema: typeof APPROVED_ASK_RECEIPT_SCHEMA;
    readonly executionId: string;
    readonly callId: string;
    readonly memberIdentity: string;
    readonly toolName: string;
    readonly receipt: ApprovedAskReceipt;
}
/** The operation fingerprint: one deterministic digest of the approved effect. */
export declare function approvedAskOperationFingerprint(operation: Pick<ApprovedAskOperation, 'toolName' | 'canonicalPath' | 'contentSha256'>): string;
/**
 * Prepare the operation a native `write` approval would cover — the ONE
 * canonicalization the receipt binds. Async because the Provider resolution is
 * async; the caller (the centre) does this BEFORE the wait so the receipt can
 * be minted synchronously at grant consumption.
 */
export declare function prepareApprovedWriteOperation(input: {
    readonly locator: string;
    readonly content: string;
    readonly resolver?: PathIdentityResolver;
}): Promise<{
    readonly ok: true;
    readonly value: ApprovedAskOperation;
} | {
    readonly ok: false;
    readonly code: string;
    readonly detail: string;
}>;
/**
 * Mint the receipt. Called by the centre AFTER `binder.consume` returned ok —
 * there is no code path that mints a receipt for an unconsumed grant.
 */
export declare function mintApprovedAskReceipt(input: MintApprovedAskReceiptInput): MintApprovedAskReceiptResult;
/**
 * Register a minted receipt against the HOST EXECUTION OBJECT that spent the
 * grant. The `tools/execute` listener takes it back by object identity.
 */
export declare function registerPendingApprovedAskReceipt(execution: object, receipt: ApprovedAskReceipt): void;
/** Take (and forget) the receipt registered for exactly this execution object. */
export declare function takePendingApprovedAskReceipt(execution: object): ApprovedAskReceipt | undefined;
/** The receipt is no longer available to any execution, ever. Idempotent. */
export declare function closeApprovedAskReceipt(receipt: ApprovedAskReceipt): void;
/**
 * Run ONE tool body inside the receipt's authorization scope. The scope is
 * opened only here, only for the receipt's own execution object, and closed in
 * `finally` — so completion, Stop or a throw all end availability.
 */
export declare function runWithApprovedAskExecutionScope<T>(receipt: ApprovedAskReceipt, run: () => Promise<T>): Promise<T>;
/** The receipt scope of the body this async context is inside, if any. */
export declare function currentApprovedAskExecutionScope(): ApprovedAskExecutionScope | undefined;
/**
 * The Provider-side check. It NEVER decides `allow` beyond what the receipt
 * covers: `deny` is checked first by the caller, the receipt must still be
 * live, the current lane must still ask for the target, the canonical path and
 * the content digest must match, and the operation must lie inside the lane
 * snapshot approved. A receipt that fails any clause is a refusal.
 */
export declare function authorizeAskWithReceipt(input: AuthorizeAskWithReceiptInput): Promise<AuthorizeAskWithReceiptResult>;
//# sourceMappingURL=approved-ask-receipt.d.ts.map