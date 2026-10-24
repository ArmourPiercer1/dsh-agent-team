/**
 * A5-M2 (root ruling, post-consume write closure) — THE internal write
 * execution closure: created by the assembly AFTER the final edge consumed
 * the one-shot grant, and it does exactly ONE thing: land the frozen plan's
 * bytes at the plan's approved identity, once, verified-before-truncation.
 *
 * NOT exported through the lane barrel (the integration owner adds exports
 * deliberately — a barrel import must never reach this face by accident),
 * NOT reachable from any tool argument surface, NOT a grant-facing method.
 *
 * Trust boundary (P1): the permission is the ASSEMBLY-CONSTRUCTION fact —
 * this factory is called only after `paAdmitEdge` answered allow with a
 * consumed call. The closure takes NO post-approval parameters: root real
 * identity, approved locator and content are read from the frozen typed
 * plan alone. A stolen factory or closure can do nothing else: the factory
 * needs the exact consumed plan to mint one closure, and each closure
 * single-flights (P3): the claim is taken SYNCHRONOUSLY before the first
 * await; in-flight AND settled repeat claims are refused with zero FS.
 *
 * Write law (P2): the open is `O_WRONLY | O_NOFOLLOW` — NO `O_TRUNC`,
 * NO `O_CREAT` (name follows the code: the root review caught this early
 * wording drift; the code shape below is the truth). The
 * approved-root agreement (a comparison baseline this file NEWLY owns: the
 * instance root's CURRENT realpath must equal the plan's approved root real
 * identity — a root/ancestor swap makes the instance stand elsewhere, which
 * is exactly the approved identity no longer being reachable) and the
 * exec-time handle verification (the SAME `verifyOpenedHandle` the read
 * side uses: fd escape check + same-fd `fstat` dev/ino identity) run
 * BEFORE any truncation. Only after both agree does the same FD get
 * `truncate(0)` then `write(content)`.
 *
 * Honesty law (P4, root corrections — creation IS a side effect). THREE
 * states, separated BY CODE (not by comments), never a "0 bytes written"
 * claim:
 *   A — authorization/boundary checks failing BEFORE creation ⇒ refused,
 *       ZERO CREATION. This round the separation is structural: the open
 *       carries NO `O_CREAT` AT ALL, so no window, no race and no error
 *       path can create anything; a target that is absent at the check is
 *       a typed refusal (`not-a-file`) and the NEW-FILE path is HELD for
 *       root ruling (see NEW-FILE LIMITATION below).
 *   B — creation-time drift (the target appears/swaps mid-flight) cannot
 *       produce a created file from this closure because it never creates
 *       (no `O_CREAT`); a raced-away target answers `ENOENT` at open —
 *       refused, still zero creation.
 *   C — once `truncate` has run, existence AND content are changed: any
 *       later failure is `cfsUndetermined('write-side-effect-unconfirmed',
 *       { sideEffectPossible: true })` — the existing lane law verbatim.
 * Drift of a verified-then-swapped PRE-EXISTING target before truncation
 * rides the existing lane mapping `exec-time-identity-drift
 * { sideEffectPossible: false }` — nothing was truncated or written, the
 * content is provably untouched. No lane-invented codes: refusals ride
 * the closed C-FS reason set; the repeat-claim and cancellation refusals
 * use `effect-outside-grant` (a claimed one-shot is no longer an effect
 * this call may produce) with the fact stated in the message — never a
 * beautified mapping of an existing refusal, which is passed through
 * verbatim (P5).
 *
 * NEW-FILE LIMITATION (concrete finding, path HELD pending root ruling):
 * creating a NOT-yet-existing target while keeping the parent bound BEFORE
 * creation needs `openat2(RESOLVE_BENEATH|RESOLVE_NO_SYMLINKS)` or a
 * pinned parent-FD `openat`. Neither exists on this platform today:
 * `OpenAtPort` is unlanded (`ARBITRARY_TREE_PROFILE_PUBLISHED = false`,
 * admission-binding.ts law 4), Node exposes no `openat`/`openat2` binding,
 * and lstat/realpath pre-checks are inherently racy against a parent-dir
 * swap (O_NOFOLLOW guards only the FINAL segment — O_CREAT would follow a
 * swapped parent). Pre-checking the parent and then creating is the
 * drift-then-discover pattern the ruling forbids, so this module REFUSES
 * absent targets outright instead of approximating. The pre-creation
 * parent-identity checks below are retained as defense-in-depth for the
 * EXISTING-target path (they refuse swapped parents before any open), not
 * as a creation license.
 *
 * MAINTAINED SCOPE (root reviews, do not overclaim): this wiring covers
 * EXISTING files ONLY; (a) the new-file path stays HELD pending the root
 * ruling on the limitation report above; (b) the production creation site
 * LANDED with the B-WRITE row (governed-families/write.mjs): the closure is
 * minted ONLY below the real final edge — after the arm's pairing law and
 * the one-shot consumed proof — and called with ZERO arguments; its proof
 * lives in a5m2-write-existing-c1 (bytes landed, HELD new-file, replay and
 * drain legs) on kernel AND int; (c) the helper-verified windows (root
 * realpath, fd identity) ride a RESTRICTED deployment under the governed
 * root — this is NOT physical safety for an arbitrary mutable directory
 * tree (no openat2 today, law 4); the approved root REAL the arm supplies
 * is the arm's FROZEN BIND-TIME resolution of the trusted governed root
 * (root review @1a399: an execution-time realpath re-read would make the
 * comparison below SELF-ASSERTING — verification expects a frozen fact,
 * not a fresh discovery); (d) THE LINE NEITHER OWNER CROSSES: fingerprint
 * equality AT THE FACTORY IS NOT AUTHORIZATION — it only binds one plan to
 * one consumed context. Authorization exists exactly once: the private
 * closure call made AFTER the real M1 complete final edge (`paAdmitEdge`:
 * PartA full verification → fresh-facts recheck → one-shot consume)
 * answered allow. Nothing minted, mirrored, or fingerprint-matched here
 * substitutes for that edge.
 *
 * Multi-chunk cancellation (root ruling, existing-file wiring round):
 * cancellation is checked BEFORE EVERY chunk; a cancelled call stops all
 * further writes immediately, never reports success, and never claims
 * "zero written" — truncation and the earlier chunks' bytes are real
 * effects. The refusal carries the OBSERVED byte count in the message and
 * rides the existing law verbatim (`write-side-effect-unconfirmed`,
 * `sideEffectPossible: true`, code EXECUTION_TERMINATION_UNCONFIRMED).
 *
 * @module packages/runtime/controlled-fs/src/post-consume-write
 */
import type { FsWriteReceipt, GovernanceResult } from '../../../domain/tool-governance/src/index.js';
/**
 * The frozen typed plan the closure executes. Built by the ASSEMBLY from
 * the exact facts the final edge consumed (the canonical plan fingerprint
 * is presented alongside and must agree — law below).
 */
export interface PostConsumeWritePlan {
    /** The approved lexical root (pure-lexical, zero FS). */
    readonly approvedRootLexical: string;
    /** The approved root's REAL identity as recorded when the question was
     *  approved — the comparison baseline. Post-approval fact, never a
     *  pre-approval filesystem read by the slice. */
    readonly approvedRootReal: string;
    /** The approved target: an absolute lexical path strictly beneath
     *  `approvedRootLexical` (the pure-lexical anchor's output). */
    readonly approvedLocator: string;
    /** The exact bytes to land. */
    readonly content: string;
    /** The canonical plan fingerprint the final edge consumed. */
    readonly planFingerprint: string;
}
/** The consumed call context: presentation facts, never parameters. */
export interface PostConsumeWriteCallContext {
    /** The canonical `parametersFingerprint` the final edge consumed for
     *  THIS call — must be the plan's fingerprint (one plan, one spend). */
    readonly parametersFingerprint: string;
    /** The call's abort signal, presented at closure creation. */
    readonly signal?: {
        readonly aborted?: boolean;
    };
}
/** Assembly-time configuration: where the governed instance root STANDS. */
export interface PostConsumeWriteConfig {
    /** The instance root's current lexical directory (the host's instance
     *  registration; its realpath is the current standpoint). */
    readonly instanceRootDir: string;
}
/** The minted closure: one zero-argument attempt, always at most once. */
export interface PostConsumeWriteClosure {
    /** ZERO parameters — nothing may be substituted post-approval (P1). */
    readonly write: () => Promise<GovernanceResult<FsWriteReceipt>>;
    /** The claim state (diagnostic only, never authority). */
    readonly claimed: () => boolean;
}
/**
 * Create the post-consume write closure for ONE consumed plan. Every
 * construction violation is a TypeError (the lane's constructor-invariant
 * style — a closure built on a mismatched plan is a broken fact, so it is
 * never built). The factory handle itself is not a permission: minting
 * anything requires the exact consumed plan + fingerprint.
 */
export declare function createPostConsumeWriteClosure(plan: PostConsumeWritePlan, context: PostConsumeWriteCallContext, config: PostConsumeWriteConfig): PostConsumeWriteClosure;
//# sourceMappingURL=post-consume-write.d.ts.map