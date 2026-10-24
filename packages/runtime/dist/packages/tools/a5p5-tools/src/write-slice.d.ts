/**
 * `a5p5-tools` M2-WRITE-01 — the GOVERNED WRITE SLICE: the write-face row body
 * a future plane write-takeover row mounts (the `write` native spelling at the
 * pin), expressed as a pure module the assembly injects its faces into.
 *
 * REVISION (root security ruling 07:13, fix round 1). The first revision
 * froze the plan as the EFFECT-SET fingerprint and left `call.member` unused
 * — reproduced defects: (1) cross member/call authorization, (2) two
 * concurrent writes over one grant, (3) a root swapped to a symlink during
 * the PA wait overwrote OUTSIDE the anchor. This revision closes all three
 * by REUSING the M1-VERIFIED fact objects — no new ledger, no second
 * fingerprint system:
 *
 *  - THE FULL PLAN (law 5): the call freezes through the pinned canonicalizer
 *    (`operation-permission/canonical-operation.ts` — the M1 fact: the write
 *    projection carries the CONTENT digest plus the resolved target key;
 *    A2C-5: distinct contents mint DISTINCT fingerprints). The canonical
 *    fingerprint — NOT the effect-set fingerprint — is what the PA edge and
 *    the exec-time recheck bind. A content swap under a frozen approval is a
 *    different plan and never answers the old approval.
 *  - THE FIVE TRUSTED BINDINGS (law 2): every call carries its REAL identity
 *    — exec token (object|symbol, never a string), member, callId, and the
 *    definition/provider binding facts. The approved `request`/`grant` handed
 *    back by the PA edge must agree with them FIELD-FOR-FIELD
 *    (`admission-identity-mismatch:*` refuses otherwise): a grant minted for
 *    member A / call X never authorizes member B / call Y.
 *  - ONE CONSUMPTION POINT (law 12/13): the PA edge here is the OPEN half
 *    (admit / ask / durable Control lane — it consumes NOTHING). The single
 *    consumption point is the admission-GATED lane's exec-time recheck
 *    through the injected `makePort` (production: `createFsAdmissionPort` =
 *    the kernel's one-shot `consumeForExecution`). The slice never consumes
 *    and never re-consumes; `onWriteCommitted` RECORDS the committed fact
 *    only — it never authorizes anything and is never a consumption. A
 *    concurrent or sequential replay over the same grant answers
 *    `grant-consumed` (`APPROVAL_STALE`) from the REAL ledger view.
 *  - THE ANCHOR DRIFTS = STALE (law 11): after approval and before the open,
 *    the injected drift seam re-runs the READ side's law — approved-target
 *    agreement incl. the root itself and its ancestors (the read row's
 *    `ANCHOR-DRIFT`). Any drift is a stale refusal with zero write and zero
 *    re-approval. The final FD check (O_NOFOLLOW open + exec-time re-read)
 *    remains the gated C-FS lane's own law and still runs after this.
 *  - CANCELLATION IS NOT A WRITE AND NOT A REFUSAL (law 8/9): an aborted
 *    signal before the edge, an `allow + cancelled` verdict, or an abort
 *    landing during the wait all answer `{ kind: 'cancelled' }` — never the
 *    allow branch, never a re-approval, zero bytes.
 *  - `undetermined` STAYS HONEST (`mapLaneError`): an `undetermined` lane
 *    error keeps its `sideEffectPossible` fact (mirroring the frozen
 *    `sideEffectUnknown` spelling; unstated = conservative TRUE).
 *    `edit`/`replace`-family faces additionally need a READ effect — a
 *    write-only grant never covers them (this face is `write`:
 *    create-or-replace, no read of the old text).
 *
 * The host argument law at the pin stands: `file_path` (required string),
 * `content` (required string; EMPTY is legitimate) — host
 * `packages/fs/tool-fs/src/write.ts:24-27,75-79`; the escalation pair
 * (`sandbox_permissions`/`justification`, host `sandbox.ts:59-72`) has NO
 * governed lane here and is REFUSED typed, never silently dropped.
 *
 * The success result carries the write receipt ONLY
 * (`canonicalLocator` + `writtenFingerprint`): prior content NEVER travels
 * back (ruling D-C2-1; the host `before`/`after` echo is the C2-full
 * increment riding a PAIRED read effect through the governed read arm).
 *
 * Purity: no `node:*`, no I/O, no clock — external faces are injected (the
 * `backend-contract.ts` structural-view precedent). The injected
 * `canonicalize`/`resolveTarget`/`checkDrift`/`makePort` arms ARE the M1
 * fact objects; the slice consumes them, never re-implements them.
 *
 * @module @dsh-agent-team/tools/a5p5-tools/write-slice
 */
/** The closed refusal classes of this face: before admission, at admission, at the fs edge. */
export declare const WRITE_SLICE_REFUSAL_CLASSES: readonly ["schema", "admission", "fs"];
export type WriteSliceRefusalClass = (typeof WRITE_SLICE_REFUSAL_CLASSES)[number];
/** One typed refusal. `text` carries code + reason ONLY — never file content. */
export interface WriteSliceRefusal {
    readonly kind: 'refused';
    /** Discriminant shared with the helpers' `{ ok: true }` arms. */
    readonly ok: false;
    readonly refusalClass: WriteSliceRefusalClass;
    readonly code: string;
    readonly text: string;
    readonly cfClass?: string;
    readonly cfReason?: string;
    /** An `undetermined` fs outcome STAYS honest: the side effect may have landed. */
    readonly sideEffectPossible?: boolean;
}
/** One success: the C-FS receipt ONLY (no old content, no diff payload). */
export interface WriteSliceWritten {
    readonly kind: 'written';
    readonly canonicalLocator: string;
    readonly writtenFingerprint: string;
    /** The gated lane's decision ledger for THIS call (append-only). */
    readonly laneLedger: readonly unknown[];
}
/** A cancelled invocation: a PRESENTED fact, never a refusal, never a write. */
export interface WriteSliceCancelled {
    readonly kind: 'cancelled';
}
export type WriteSliceOutcome = WriteSliceWritten | WriteSliceRefusal | WriteSliceCancelled;
/** The host `write` argument view. */
export interface WriteToolArgsView {
    readonly file_path?: unknown;
    readonly content?: unknown;
    readonly sandbox_permissions?: unknown;
    readonly justification?: unknown;
}
/**
 * The host value law plus this face's escalation refusal. Mirrors the pinned
 * host check (blank `file_path` is the only shape the schema cannot express;
 * empty `content` is legitimate) and adds the governed-face rule: the
 * escalation pair has NO meaning here and is refused, not ignored.
 */
export declare function parseWriteSliceArgs(args: WriteToolArgsView | null): {
    ok: true;
    filePath: string;
    content: string;
} | WriteSliceRefusal;
/**
 * PURE-LEXICAL anchor projection (zero fs access — the read row's fix-5
 * pre-gate law restated for the write side): every lexical target that
 * escapes the governed root is refused BEFORE anything else runs.
 */
export declare function lexicalWriteAnchor(rootDir: string, rawPath: string): {
    ok: true;
    path: string;
} | WriteSliceRefusal;
/** One resource of the frozen effect grammar (view). */
export interface SliceResourceRefView {
    readonly realmId: string;
    readonly kind: string;
    readonly canonicalLocator: string;
    readonly rights: readonly string[];
}
/** The frozen canonical effect set (view). */
export interface SliceEffectSetView {
    readonly effects: readonly {
        readonly kind: string;
        readonly resource: SliceResourceRefView | null;
    }[];
    readonly fingerprint: string;
}
/** The frozen parser face this slice consumes (only the effect-set parse). */
export interface SliceEffectParser {
    parseRequestedEffectSet(raw: unknown): {
        readonly ok: true;
        readonly value: SliceEffectSetView;
    } | {
        readonly ok: false;
        readonly problems: readonly unknown[];
    };
}
/** The M1 canonical fact: one canonicalized operation (view of `CanonicalOperation`). */
export interface SliceCanonicalOperationView {
    readonly tool: string;
    readonly resource: {
        readonly kind: string;
        readonly key: string;
    };
    /** THE plan fingerprint: content digest + resolved target key (A2C-5). */
    readonly fingerprint: string;
}
/** The pinned canonicalizer fact (view of `canonicalizeOperation`). */
export type SliceCanonicalize = (input: {
    readonly name: 'write';
    readonly arguments: {
        readonly file_path: string;
        readonly content: string;
    };
    readonly resolveTarget: (path: string) => Promise<{
        readonly key: string;
        readonly display: string;
    }>;
}) => Promise<SliceCanonicalOperationView>;
/** One gated-lane write outcome (view of the frozen GovernanceResult). */
export type SliceGatedWriteResult = {
    readonly ok: true;
    readonly value: {
        readonly canonicalLocator: string;
        readonly writtenFingerprint: string;
    };
} | {
    readonly ok: false;
    readonly error: {
        readonly code: string;
        readonly message: string;
        readonly details?: Readonly<Record<string, string | number | boolean | null>>;
    };
};
/** The exec-time admission port the gated lane re-ASKS (view). */
export interface SliceAdmissionPort {
    recheckCall(intent: {
        readonly op: string;
        readonly canonicalLocator: string;
        readonly parametersFingerprint: string;
    }): Promise<{
        readonly ok: true;
    } | {
        readonly ok: false;
        readonly reason: string;
    }>;
}
/** The gated-lane config this slice assembles per call (view). */
export interface SliceGatedLaneConfig {
    readonly instances: readonly {
        readonly fs: string;
        readonly rootDir: string;
        readonly realmId: string;
        readonly kind: 'absolute-path';
    }[];
    readonly now: () => number;
    readonly currentAuthorityGeneration: number;
    readonly consumed: (grantId: string) => boolean;
    readonly visibility?: (member: unknown, desc: {
        readonly fs: string;
        readonly path: string;
    }) => 'visible' | 'hidden';
    readonly admission: {
        readonly admission: SliceAdmissionPort;
        readonly parametersFingerprint: string;
    };
}
/** The admission-GATED controlled-fs face (view of `createAdmissionGatedControlledFs`). */
export interface SliceGatedControlledFs {
    createAdmissionGatedControlledFs(config: SliceGatedLaneConfig): {
        readonly fs: {
            writeText(grant: unknown, ref: SliceResourceRefView, content: string): Promise<SliceGatedWriteResult>;
        };
        readonly ledger: readonly unknown[];
    };
}
/** The trusted member identity (view of the frozen MemberRef). */
export interface SliceMemberView {
    readonly teamSessionId: string;
    readonly instanceId: string;
}
/** The definition/provider binding facts (view of the ToolBinding identity fields). */
export interface SliceBindingFactsView {
    readonly bindingId: string;
    readonly revision: number;
    readonly definitionIdentity: string;
    readonly providerId: string;
}
/**
 * The PA OPEN half's approved shape: a grant + the exact AdmissionRequest it
 * was minted for. The slice FIELD-FOR-FIELD re-verifies this against the
 * call's trusted identity before one byte may move — this seam is what the
 * first revision was missing (defect 1: cross member/call authorization).
 */
export interface SlicePaOpen {
    readonly kind: 'approved';
    readonly grant: {
        readonly grantId?: string;
        readonly parametersFingerprint?: string;
        readonly bindingId?: string;
        readonly bindingRevision?: number;
    };
    readonly request: {
        readonly member: SliceMemberView;
        readonly callId: string;
        readonly realmId: string;
        readonly parametersFingerprint: string;
        readonly requestedEffects: {
            readonly fingerprint: string;
        };
    };
}
/** The PA edge's verdict union (open half; `pending` is terminal-refusal here). */
export type SlicePaVerdict = SlicePaOpen | {
    readonly kind: 'deny';
    readonly code: string;
    readonly detail?: string;
} | {
    readonly kind: 'pending';
    readonly detail?: string;
} | {
    readonly kind: 'allow';
    readonly cancelled: true;
};
/** The per-call PA request this face states (the open half carries the full identity). */
export interface SlicePaRequest {
    readonly realmId: string;
    readonly callId: string;
    readonly member: SliceMemberView;
    readonly binding: SliceBindingFactsView;
    readonly correlation?: string;
    readonly parametersFingerprint: string;
    readonly requestedEffects: SliceEffectSetView;
    readonly signal?: {
        readonly aborted?: boolean;
    };
}
/** One policy rule (the operation-permission shape the plane rows consume). */
export interface SlicePolicyRule {
    readonly tool?: string;
    readonly resource?: {
        readonly kind?: string;
        readonly path?: string;
    };
}
/** The template policy view (the LAWFUL production grammar: ask | deny only). */
export interface SlicePolicyView {
    readonly default?: 'ask' | 'deny';
    readonly allow?: readonly SlicePolicyRule[];
    readonly ask?: readonly SlicePolicyRule[];
}
/** The lane (template-lane fast path) verdict. */
export type SliceLaneVerdict = {
    readonly kind: 'allow';
} | {
    readonly kind: 'deny';
    readonly code: string;
};
/** The drift seam (the read row's ANCHOR-DRIFT law, injected). */
export type SliceDriftCheck = (approvedLexical: string) => Promise<{
    ok: true;
} | {
    ok: false;
    code: string;
    detail: string;
}>;
/** Construction arms of {@link createGovernedWriteExecutor}. */
export interface GovernedWriteExecutorDeps {
    readonly parser: SliceEffectParser;
    readonly canonicalize: SliceCanonicalize;
    readonly resolveTarget: (path: string) => Promise<{
        readonly key: string;
        readonly display: string;
    }>;
    readonly checkDrift: SliceDriftCheck;
    readonly gatedFs: SliceGatedControlledFs;
    /** THE ONE consumption point's port factory (production: `createFsAdmissionPort`). */
    readonly makePort?: (request: unknown, grant: unknown) => SliceAdmissionPort;
    readonly realmId: string;
    readonly fsId: string;
    readonly rootDir: string;
    readonly clock: () => number;
    readonly authorityGeneration: number;
    /** The grant-consumption VIEW (the durable ledger's read side; never mutated here). */
    readonly consumed: (grantId: string) => boolean;
    readonly policy?: SlicePolicyView;
    readonly decide: (request: {
        readonly effects: readonly unknown[];
    }) => SliceLaneVerdict;
    readonly pa: (request: SlicePaRequest) => Promise<SlicePaVerdict>;
    readonly visibility?: (member: unknown, desc: {
        readonly fs: string;
        readonly path: string;
    }) => 'visible' | 'hidden';
    /** Observation sink for the mount log (same posture as the read row's `observe`). */
    readonly observe?: (line: string) => void;
    /**
     * THE COMMITTED FACT RECORD — the assembly's ledger/log of the committed
     * write. It RECORDS ONLY: it never authorizes anything, is never consulted
     * for admission, and never consumes (the ONE consumption point is the
     * gated lane's exec-time port; consumption is the kernel's one-shot law).
     */
    readonly onWriteCommitted?: (fact: {
        readonly grant: unknown;
        readonly canonicalLocator: string;
        readonly writtenFingerprint: string;
        readonly callId: string;
        readonly member: SliceMemberView;
    }) => void;
}
/** One call identity: the FIVE trusted bindings a governed write must carry. */
export interface GovernedWriteCall {
    /** The REAL execution token (object | symbol); strings are never identities. */
    readonly execToken: unknown;
    readonly member: SliceMemberView;
    readonly callId: string;
    readonly binding: SliceBindingFactsView;
    /** The dispatch-assigned correlation string (`exec.tokenKey`), when any. */
    readonly correlation?: string;
    readonly signal?: {
        readonly aborted?: boolean;
    };
}
/** Pure mapping law: an `undetermined` fs outcome KEEPS its side-effect honesty. */
export declare function mapLaneError(result: Extract<SliceGatedWriteResult, {
    ok: false;
}>): WriteSliceRefusal;
/**
 * The governed write executor — the row body a future plane write-takeover
 * row mounts. `run(raw, call)` walks the closed law order; every exit is a
 * typed outcome and no refusal path has touched the filesystem or spent an
 * approval.
 */
export declare function createGovernedWriteExecutor(deps: GovernedWriteExecutorDeps): {
    run(raw: WriteToolArgsView | unknown, call: GovernedWriteCall): Promise<WriteSliceOutcome>;
};
//# sourceMappingURL=write-slice.d.ts.map