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
 * THIS ROUND COVERS THE FIVE NATIVE FS MUTATIONS, one operation kind each:
 * `write`→`writeText`, `edit`→`editText`, `patch_text`→`patchText`,
 * `delete_file`→`deleteFile`, `move_file`→`moveFile` (BOTH paths). The kind is
 * part of the operation identity, so a receipt for one method can never satisfy
 * another. Every other tool/method keeps the R4 fail-closed
 * `IO_ASK_REQUIRES_APPROVAL` refusal (the subprocess face is explicitly NOT
 * covered by this extension; see the ADR).
 *
 * @module @dsh-agent-team/runtime/member-io-policy/approved-ask-receipt
 */
import { type PathIdentityResolver } from './provider-capabilities.js';
import type { PathRuleSet } from './types.js';
/** The one record schema. A reader that does not know it must fail loud. */
export declare const APPROVED_ASK_RECEIPT_SCHEMA: "a5sf-approved-ask-receipt/2";
/**
 * Closed refusal vocabulary. NONE of these starts with `ADMISSION_`: a
 * Provider refusal happens AFTER the body started, and the execution-fact
 * classifier must settle it as the real phase (FAILED / body-started), never
 * as a pre-execution `REFUSED / not-started`.
 */
export declare const APPROVED_ASK_RECEIPT_REFUSAL_CODES: readonly ["RECEIPT_NOT_IN_SCOPE", "RECEIPT_UNKNOWN", "RECEIPT_CLOSED", "RECEIPT_REUSED", "RECEIPT_MEMBER_MISMATCH", "RECEIPT_TOOL_MISMATCH", "RECEIPT_POLICY_GENERATION_MISMATCH", "RECEIPT_AUTHORITY_UNAVAILABLE", "RECEIPT_REVOKED", "RECEIPT_OPERATION_MISMATCH", "RECEIPT_CONTENT_MISMATCH", "RECEIPT_CONTENT_UNAVAILABLE", "RECEIPT_PATH_UNRESOLVED", "RECEIPT_DENIED", "RECEIPT_BOUNDS_VIOLATION", "RECEIPT_INPUT_INVALID", "RECEIPT_PROCESS_CLASS_MISMATCH", "RECEIPT_COMMAND_MISMATCH"];
export type ApprovedAskReceiptRefusalCode = (typeof APPROVED_ASK_RECEIPT_REFUSAL_CODES)[number];
/** The trusted member identity a receipt is bound to (the grant's own tuple). */
export interface ApprovedAskMemberIdentity {
    readonly teamId: string;
    readonly memberInstanceId: string;
    readonly templateId: string;
    readonly instanceGeneration: number;
}
/** The authored + Provider-resolved identity of ONE path in an approved operation. */
export interface ApprovedAskPath {
    /** The authored locator the approval named. */
    readonly locator: string;
    /** The Provider-resolved canonical path the approval covers. */
    readonly canonicalPath: string;
}
/**
 * The ONE operation a receipt can authorize. Round 96 (owner ruling 20261124-0151 §2, extension):
 * the same shape now covers the five native FS mutations, each with its OWN scope binding.
 *
 * WHAT THE PAYLOAD DIGESTS COVER, and what they cannot (see the ADR's per-method table):
 *  - `fs-write`  (`write` → `writeText`): the exact bytes. Nothing about the prior file.
 *  - `fs-edit`   (`edit` → `editText`): the requested literal transformation
 *                (oldString, newString, replaceAll). NOT the file's prior content, so not the
 *                resulting bytes — the Provider's own literal-match / version guard decides those.
 *  - `fs-patch`  (`patch_text` → `patchText`): the exact hunk payload handed to the Provider.
 *                NOT the prior content, so not the resulting bytes.
 *  - `fs-delete` (`delete_file` → `deleteFile`): the target path only. No bytes are read back.
 *  - `fs-move`   (`move_file` → `moveFile`): BOTH paths. A receipt for (a→b) cannot authorize (a→c).
 */
export interface ApprovedAskWriteOperation extends ApprovedAskPath {
    readonly kind: 'fs-write';
    readonly toolName: 'write';
    /** Digest of the approved bytes; the Provider re-hashes what it is about to write. */
    readonly contentSha256: string;
    readonly fingerprint: string;
}
export interface ApprovedAskEditOperation extends ApprovedAskPath {
    readonly kind: 'fs-edit';
    readonly toolName: 'edit';
    readonly oldStringSha256: string;
    readonly newStringSha256: string;
    readonly replaceAll: boolean;
    /** Digest of the exact `{oldString,newString,replaceAll}` triple the Provider must receive. */
    readonly editSha256: string;
    readonly fingerprint: string;
}
export interface ApprovedAskPatchOperation extends ApprovedAskPath {
    readonly kind: 'fs-patch';
    /** The declared native tool shape for a single-file hunk list. */
    readonly toolName: 'patch_text';
    /** Digest of the canonical hunk payload the Provider must receive. */
    readonly hunksSha256: string;
    readonly fingerprint: string;
}
export interface ApprovedAskDeleteOperation extends ApprovedAskPath {
    readonly kind: 'fs-delete';
    readonly toolName: 'delete_file';
    /**
     * Literal `false`: a delete reads no bytes back, so there is nothing about the removed file's
     * content that this receipt could or does bind. Scope is the path, and only the path.
     */
    readonly bytesReadBack: false;
    readonly fingerprint: string;
}
export interface ApprovedAskMoveOperation {
    readonly kind: 'fs-move';
    readonly toolName: 'move_file';
    /** The path being removed. */
    readonly source: ApprovedAskPath;
    /** The path being published. */
    readonly destination: ApprovedAskPath;
    readonly fingerprint: string;
}
/**
 * THE PRODUCT'S FIXED SHELL CLASS, as the composition declares it. The receipt binds it so a
 * receipt minted under one process face cannot satisfy a different one (a different program, or a
 * different admitted shell-class set, is a different operation).
 */
export interface ApprovedAskProcessClass {
    /** The absolute shell program the face runs; '' when the face does not pin one. */
    readonly program: string;
    /** The admitted shell-class program basenames, sorted (closed, composition-owned). */
    readonly programs: readonly string[];
}
/**
 * ROUND 99 — the PROCESS face (owner ruling 20261124-0151 §2: extend the receipt to Subprocess,
 * with the added condition that an OS-sandbox approval must be proven separately and must NEVER
 * widen the process's kernel permissions).
 *
 * WHAT IT BINDS: the tool, the DECLARED `executionBoundary`, the composition's fixed shell class,
 * and — when the call carried a command string — the exact command text's digest. The OS profile is
 * NOT part of the receipt and is never read from it: the spawn point compiles it from the Member's
 * three lanes exactly as it did before, so a receipt cannot add a writable/executable/kernel bit.
 *
 * WHAT IT CANNOT SAY: (a) for a PERSISTENT shell the process is created before any command text
 * exists, so the spawn-point verifier cannot compare `commandSha256` — the field records the command
 * the approval was requested for and the ADR states the limit; (b) nothing about a command body's
 * dynamic reads (`$(...)`, `$VAR` paths) — those are the OS profile's remit; (c) nothing about prior
 * shell state (`cd`/`export` from an earlier command) in a persistent session.
 */
export interface ApprovedAskProcessOperation {
    readonly kind: 'process-exec';
    readonly toolName: 'bash';
    readonly executionBoundary: string;
    readonly implementationOrigin: string;
    readonly processClass: ApprovedAskProcessClass;
    /** `sha256:` of the exact declared command text; `null` when the call carried none. */
    readonly commandSha256: string | null;
    /** The AUTHORED working directory (context, never an authority). */
    readonly cwd: string;
    readonly fingerprint: string;
}
export type ApprovedAskOperation = ApprovedAskWriteOperation | ApprovedAskEditOperation | ApprovedAskPatchOperation | ApprovedAskDeleteOperation | ApprovedAskMoveOperation | ApprovedAskProcessOperation;
/** The Provider method each operation kind authorizes, exactly. */
export declare const APPROVED_ASK_METHOD_OF_KIND: Readonly<{
    readonly 'fs-write': "writeText";
    readonly 'fs-edit': "editText";
    readonly 'fs-patch': "patchText";
    readonly 'fs-delete': "deleteFile";
    readonly 'fs-move': "moveFile";
}>;
export type ApprovedAskFsMethod = (typeof APPROVED_ASK_METHOD_OF_KIND)[keyof typeof APPROVED_ASK_METHOD_OF_KIND];
/** The evidence a Provider must supply for the method it is about to run. */
export interface ApprovedAskOperationEvidence {
    /** `writeText`: the bytes about to be written. */
    readonly content?: string;
    /** `editText`: the literal transformation about to be applied. */
    readonly edit?: {
        readonly oldString: string;
        readonly newString: string;
        readonly replaceAll: boolean;
    };
    /** `patchText`: the hunk payload about to be applied. */
    readonly hunks?: unknown;
    /** `moveFile`: the destination path (the source is the main `locator`). */
    readonly destinationPath?: string;
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
    /** `writeText`: the bytes about to be written. */
    readonly content?: string;
    /** `editText`: the exact literal transformation about to be applied. */
    readonly edit?: ApprovedAskOperationEvidence['edit'];
    /** `patchText`: the exact hunk payload about to be applied. */
    readonly hunks?: unknown;
    /** `moveFile`: the destination path; `locator` is the source. */
    readonly destinationPath?: string;
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
    readonly resolvedDestination?: string;
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
/**
 * The operation fingerprint: one deterministic digest of the approved effect.
 *
 * It is recomputed by `mintApprovedAskReceipt` from the operation's own fields, so a caller cannot
 * smuggle a fingerprint that disagrees with the paths/payload it carries. Kept for auditability and
 * for the receipt's own self-consistency check.
 */
export declare function approvedAskOperationFingerprint(operation: ApprovedAskOperation): string;
/** Digest of the exact declared command text a process approval names. */
export declare function approvedAskCommandSha256(command: string): string;
/** Digest of the exact literal transformation an `editText` call receives. */
export declare function approvedAskEditSha256(edit: {
    readonly oldString: string;
    readonly newString: string;
    readonly replaceAll: boolean;
}): string;
/** Digest of the exact hunk payload a `patchText` call receives. */
export declare function approvedAskHunksSha256(hunks: unknown): string;
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
    readonly value: ApprovedAskWriteOperation;
} | {
    readonly ok: false;
    readonly code: string;
    readonly detail: string;
}>;
/**
 * THE DECLARED NATIVE TOOL SHAPES this round can prepare a receipt for. It is closed: a tool name
 * that is not here prepares nothing, so its `ask` keeps the R4 fail-closed refusal.
 *
 * `write` and `edit` are SHIPPED native tools of the pinned baseline. `patch_text`, `delete_file`
 * and `move_file` are the declared argument shapes for the three rc.5 Provider methods that have no
 * shipped native tool in this product's preset today; a call carrying one of these names exercises
 * the same admission port, binder, Control and Provider, but the native-tool wiring is NOT claimed
 * (see the ADR's "not proven" section — a multi-file `apply_patch` prepares nothing and stays R4).
 */
export declare const APPROVED_ASK_TOOL_SHAPES: readonly ["write", "edit", "patch_text", "delete_file", "move_file"];
export type ApprovedAskPreparedOperation = {
    readonly ok: true;
    readonly value: ApprovedAskOperation;
} | {
    readonly ok: false;
    readonly code: 'IO_ASK_RECEIPT_TOOL_UNSUPPORTED';
    readonly detail: string;
} | {
    readonly ok: false;
    readonly code: string;
    readonly detail: string;
};
/**
 * Prepare the operation an approval for `toolName` would cover, from the tool's OWN arguments.
 *
 * A recognised tool that cannot be canonicalised is `IO_ASK_RECEIPT_UNPREPARABLE` (the centre
 * refuses the call); an unrecognised tool is `IO_ASK_RECEIPT_TOOL_UNSUPPORTED` (the centre mints no
 * receipt, so the Provider keeps R4). No shape is guessed from a substring: the dispatch is exact.
 */
export declare function prepareApprovedFsOperation(input: {
    readonly toolName: string;
    readonly arguments?: Record<string, unknown> | undefined;
    readonly resolver?: PathIdentityResolver;
}): Promise<ApprovedAskPreparedOperation>;
/**
 * ROUND 99 — the process face's DECLARED TOOL SHAPES. Closed, like the FS table: a name that is
 * not here prepares nothing, so its `ask` keeps the R4 fail-closed refusal. `bash` is the only
 * shipped process tool whose execution authorization this product compiles.
 */
export declare const APPROVED_ASK_PROCESS_TOOL_SHAPES: readonly ["bash"];
/** The declared execution facts the compiled per-tool answer carries. */
export interface ApprovedAskProcessExecution {
    readonly implementationOrigin?: string;
    readonly executionBoundary?: string;
}
/**
 * Prepare the process operation an approval for `toolName` would cover.
 *
 * The OPERATION binds what the centre can know for THIS execution: the tool, the compiled
 * `executionBoundary`/`implementationOrigin`, the composition's fixed shell class, the declared
 * command text's digest and the authored working directory. It does NOT bind (and must not claim)
 * the OS profile: that is compiled by the spawn point from the Member's three lanes, unchanged.
 *
 * A process ask whose execution facts are missing, or whose composition fixes no shell class, is
 * `IO_ASK_RECEIPT_UNPREPARABLE` — refused, never executed under an approval no receipt can name.
 */
export declare function prepareApprovedProcessOperation(input: {
    readonly toolName: string;
    readonly arguments?: Record<string, unknown> | undefined;
    readonly execution?: ApprovedAskProcessExecution | undefined;
    readonly processClass?: ApprovedAskProcessClass | undefined;
}): {
    readonly ok: true;
    readonly value: ApprovedAskProcessOperation;
} | {
    readonly ok: false;
    readonly code: string;
    readonly detail: string;
};
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
/** What a governed spawn point hands the process verifier. */
export interface AuthorizeProcessAskInput {
    readonly memberIdentity: string;
    readonly policyRevision: string;
    readonly toolBindingIdentity?: string;
    /** The tool the spawn point is executing (`bash`). */
    readonly toolName: string;
    /** The DECLARED execution boundary the composition compiler produced. */
    readonly executionBoundary: string;
    /** The composition's OWN fixed shell class (the verifier's, never the receipt's). */
    readonly processClass: ApprovedAskProcessClass;
    /**
     * The exact command text the spawn is about to run. Omitted = the spawn point cannot see the
     * command (the persistent PTY creates its shell before any command exists); the receipt's
     * `commandSha256` is then recorded but not compared, and that is the honest limit.
     */
    readonly command?: string;
    readonly authority?: {
        readonly binder?: {
            currentEpoch(): number;
            currentMemberEpoch(memberIdentity: string): number;
        };
    };
}
export type AuthorizeProcessAskResult = {
    readonly ok: true;
    readonly receipt: ApprovedAskReceipt;
} | {
    readonly ok: false;
    readonly code: ApprovedAskReceiptRefusalCode;
    readonly detail: string;
};
/**
 * The process-face verifier. It is called at the GOVERNED SPAWN POINT, before any process exists,
 * and only when the compiled process disposition is `ask` (the caller checks `deny` first and never
 * calls this for `allow`). It can authorize a spawn that THIS execution's consumed grant paid for;
 * it can never add a writable, executable or kernel capability, because it returns no policy and
 * the caller's OS profile was compiled from the Member's three lanes before this ran.
 */
export declare function authorizeProcessAskWithReceipt(input: AuthorizeProcessAskInput): AuthorizeProcessAskResult;
//# sourceMappingURL=approved-ask-receipt.d.ts.map