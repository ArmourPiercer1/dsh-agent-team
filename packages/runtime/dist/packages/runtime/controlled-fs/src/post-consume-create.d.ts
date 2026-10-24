/**
 * A5-M2 B-WRITE family — THE NEW-FILE (create-if-absent) execution closure.
 *
 * The reviewed `post-consume-write.ts` owns the EXISTING-target law
 * (verify-before-truncate, no O_CREAT). Its absent-target branch held the
 * new-file path with the EXACT reason: "no openat2/parent-FD keeps the
 * parent bound across creation on this platform". This module closes that
 * named gap — nothing else. Backlog: `write（新建文件） 未开发 … 待派`
 * (ALPHA5-EFFECTIVE-BACKLOG.md:52); this is its governance implementation.
 *
 * THE CREATION LAW (every clause mirrored from the reviewed family law):
 *  - construction is pure validation (the same typed plan the write lane
 *    froze at classify; a violation is a TypeError, zero FS);
 *  - single flight (P3): the closure runs at most once; in-flight AND
 *    settled repeats are refused with zero FS;
 *  - ANCHOR before anything: the instance root must still resolve at the
 *    FROZEN approved real identity (a root/ancestor swap refuses, zero
 *    creation — the same check, before any open);
 *  - THE PARENT CHAIN IS FD-BOUND, not path-bound: the walk opens the root
 *    once, then each parent component RELATIVE to its parent FileHandle
 *    with `O_DIRECTORY | O_NOFOLLOW` (Node >= 20 FileHandle-relative open).
 *    A symlinked component answers ELOOP -> `symlink-alias` (denied); an
 *    absent component answers `not-a-directory` — NO directory is ever
 *    created: the row's approved effect set is EXACTLY
 *    `I:tool-invoke + F(write exact file)` (matrix M-02: "无新 kind"), so
 *    `mkdir` — including the native `writeFileAtomic`'s
 *    `mkdir(recursive)` (fsio.ts:598 @639ed01539) — is OUTSIDE the grant.
 *    This deviation from native is DISCLOSED, never silent;
 *  - the final open is `O_WRONLY | O_CREAT | O_EXCL | O_NOFOLLOW` on the
 *    PARENT FD: O_EXCL makes create-if-absent atomic (no truncate window,
 *    no content substitution — an existing target races LOST: EEXIST,
 *    zero bytes, the CALLER re-classifies under the existing-file law);
 *  - after creation, the fd is verified INSIDE the anchor
 *    (`verifyOpenedHandle`, snapshot null — the fresh inode is its own
 *    identity) and must be a regular file with `nlink === 1` (a hardlink
 *    alias at the fresh name refuses as `denied-inode`; the empty
 *    in-root file that was legitimately created stays — the honest
 *    partial-effect statement rides `write-side-effect-unconfirmed` with
 *    sideEffectPossible true);
 *  - the write loop is the reviewed law verbatim: chunk loop until the
 *    full UTF-8 length landed, cancellation checked BEFORE every chunk,
 *    any failure or stall after the first byte-changing step is
 *    `write-side-effect-unconfirmed` with sideEffectPossible true — never
 *    a success report, never a "zero side effect";
 *  - the receipt is D-C2-1: `{ canonicalLocator, writtenFingerprint }`
 *    ONLY.
 *
 * @module packages/runtime/controlled-fs/src/post-consume-create
 */
import type { PostConsumeWriteCallContext, PostConsumeWriteClosure, PostConsumeWriteConfig, PostConsumeWritePlan } from './post-consume-write.js';
export type { PostConsumeWritePlan as PostConsumeCreatePlan } from './post-consume-write.js';
/**
 * Build the ONE-SHOT creation closure for one frozen, already-approved
 * write plan whose target was absent at classification time. Same plan
 * shape, same pairing facts, same zero-argument call as the existing-file
 * closure — the closure is the private executor: nothing post-approval can
 * be substituted into it (P1), it runs at most once (P3).
 */
export declare function createPostConsumeCreateClosure(frozenPlan: PostConsumeWritePlan, ctx?: PostConsumeWriteCallContext, cfg?: PostConsumeWriteConfig): PostConsumeWriteClosure;
//# sourceMappingURL=post-consume-create.d.ts.map