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
 * MAINTAINED SCOPE (root review, do not overclaim): (a) the new-file path
 * stays HELD pending the root ruling on the limitation report above; (b)
 * this module is NOT yet created by any production path — the real
 * final-edge assembly (paAdmitEdge → closure construction) is unwired in
 * this commit and its proof belongs to the integration owner; (c) the
 * helper-verified windows (root realpath, fd identity) ride a RESTRICTED
 * deployment under the governed root — this is NOT physical safety for an
 * arbitrary mutable directory tree (no openat2 today, law 4).
 *
 * @module packages/runtime/controlled-fs/src/post-consume-write
 */
import { constants as fsConstants, lstatSync, realpathSync } from 'node:fs';
import { open as fsOpen } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { cfsDenial, cfsUndetermined } from './cf-errors.js';
import { isBeneath, verifyOpenedHandle } from './open-at-exec.js';
function isNonEmptyString(value) {
    return typeof value === 'string' && value.length > 0;
}
function sha256Hex(text) {
    return `sha256:${createHash('sha256').update(text, 'utf8').digest('hex')}`;
}
/** Recomputed on every read: an AbortSignal flips OUTSIDE this module view. */
function isAborted(signal) {
    return signal?.aborted === true;
}
/**
 * Create the post-consume write closure for ONE consumed plan. Every
 * construction violation is a TypeError (the lane's constructor-invariant
 * style — a closure built on a mismatched plan is a broken fact, so it is
 * never built). The factory handle itself is not a permission: minting
 * anything requires the exact consumed plan + fingerprint.
 */
export function createPostConsumeWriteClosure(plan, context, config) {
    if (plan === null || typeof plan !== 'object') {
        throw new TypeError('post-consume-write: the plan must be the frozen typed plan object');
    }
    if (!isNonEmptyString(plan.approvedRootLexical) || !path.isAbsolute(plan.approvedRootLexical)) {
        throw new TypeError('post-consume-write: approvedRootLexical must be a non-empty absolute path');
    }
    if (!isNonEmptyString(plan.approvedRootReal) || !path.isAbsolute(plan.approvedRootReal)) {
        throw new TypeError('post-consume-write: approvedRootReal must be a non-empty absolute path');
    }
    if (!isNonEmptyString(plan.approvedLocator) || !path.isAbsolute(plan.approvedLocator)) {
        throw new TypeError('post-consume-write: approvedLocator must be a non-empty absolute path');
    }
    if (typeof plan.content !== 'string') {
        throw new TypeError('post-consume-write: content must be a string (the empty string is legal)');
    }
    if (!isNonEmptyString(plan.planFingerprint)) {
        throw new TypeError('post-consume-write: planFingerprint must be a non-empty string');
    }
    if (context.parametersFingerprint !== plan.planFingerprint) {
        throw new TypeError('post-consume-write: the consumed parametersFingerprint is not this plan\'s fingerprint — one plan, one spend; a closure is never minted across plan facts (law P1)');
    }
    // The approved locator must be the lexical root's STRICT descendant by
    // pure lexical law (zero FS): re-derived here, never trusted from the
    // caller's arithmetic.
    const rel = path.relative(plan.approvedRootLexical, plan.approvedLocator);
    if (rel.length === 0 || rel === '..' || rel.startsWith(`..${path.sep}`) || path.isAbsolute(rel)) {
        throw new TypeError('post-consume-write: approvedLocator is not strictly beneath approvedRootLexical (pure-lexical law)');
    }
    if (!isNonEmptyString(config.instanceRootDir)) {
        throw new TypeError('post-consume-write: instanceRootDir must be a non-empty string');
    }
    const absPath = path.join(plan.approvedRootReal, rel);
    if (!isBeneath(plan.approvedRootReal, absPath) || absPath === plan.approvedRootReal) {
        throw new TypeError('post-consume-write: the approved locator does not resolve beneath the approved root real identity');
    }
    const frozenPlan = Object.freeze({ ...plan });
    const signal = context.signal;
    let state = 'armed';
    const closure = Object.freeze({
        claimed: () => state !== 'armed',
        write: async () => {
            // ── P3: the claim is SYNCHRONOUS, before the first await ──────────
            // in-flight AND settled repeats are both refused, zero FS touched.
            // A failed attempt still settles the claim: a repeat could touch FS
            // again, and a write attempt is one-shot by construction.
            if (state !== 'armed') {
                return cfsDenial('effect-outside-grant', `post-consume write refused: this write closure was already claimed (state ${state}) — the consumed call gets ONE execution attempt; a repeat is effect-outside-grant with zero FS (P3)`);
            }
            state = 'claimed';
            const settle = (r) => {
                state = 'settled';
                return r;
            };
            // ── cancellation BEFORE anything: the call stopped existing ───────
            if (isAborted(signal)) {
                return settle(cfsDenial('effect-outside-grant', 'post-consume write refused: the call was cancelled before the write ran — a cancelled call produces no effect (zero FS)'));
            }
            // ── approved-root agreement (the NEW baseline, zero-trust swap) ───
            // The instance root's CURRENT real identity must equal the approved
            // root real identity. A root OR ancestor swap moves the instance's
            // standpoint: the approved identity is no longer where the instance
            // stands, and standing there would land OUTSIDE the approved root —
            // refused before any open, zero side effect.
            let currentRootReal;
            try {
                currentRootReal = realpathSync(config.instanceRootDir);
            }
            catch (err) {
                return settle(cfsDenial('path-rejected', `post-consume write refused: the instance root could not be resolved (${String(err.code)}) — the approved agreement cannot be answered`));
            }
            if (currentRootReal !== frozenPlan.approvedRootReal) {
                return settle(cfsDenial('outside-anchor', `post-consume write refused: the instance root stands at '${currentRootReal}', not at the approved root real identity '${frozenPlan.approvedRootReal}' — a root/ancestor swap makes the approved identity unreachable; zero bytes (ANCHOR law, before any open)`));
            }
            // ── pre-CREATION parent-directory identity (state ① law) ────────
            // Creation must NOT precede this check: O_CREAT would follow a
            // swapped PARENT directory (O_NOFOLLOW guards only the final
            // segment). The parent's real identity must equal its approved
            // lexical path exactly — a realpath match is only possible when
            // every ancestor component is real — so a parent or ancestor swap
            // is refused here, BEFORE anything is created, zero side effect.
            const targetDirLex = path.dirname(absPath);
            let dirStats;
            try {
                dirStats = lstatSync(targetDirLex);
            }
            catch (err) {
                const code = err.code;
                return settle(cfsDenial(code === 'ENOENT' ? 'not-a-directory' : 'path-rejected', `post-consume write refused before creation: the parent directory could not be examined (${String(code)}) — nothing was created`));
            }
            if (dirStats.isSymbolicLink()) {
                return settle(cfsDenial('symlink-alias', 'post-consume write refused before creation: the parent directory is a symlink alias — nothing was created'));
            }
            if (!dirStats.isDirectory()) {
                return settle(cfsDenial('not-a-directory', 'post-consume write refused before creation: the parent path is not a directory — nothing was created'));
            }
            let parentReal;
            try {
                parentReal = realpathSync(targetDirLex);
            }
            catch (err) {
                return settle(cfsDenial('path-rejected', `post-consume write refused before creation: the parent identity could not be resolved (${String(err.code)}) — nothing was created`));
            }
            if (parentReal !== targetDirLex || !isBeneath(frozenPlan.approvedRootReal, parentReal)) {
                return settle(cfsDenial('outside-anchor', `post-consume write refused before creation: the parent directory stands at '${parentReal}', not at the approved '${targetDirLex}' — a parent/ancestor swap would land the creation outside the approved identity; nothing was created`));
            }
            // ── pre-open target law (alias before open; snapshot for fstat) ──
            // An ABSENT target is refused here, state A: the new-file path is
            // HELD for root ruling (see module header) and the open below has
            // no O_CREAT, so zero creation holds by construction, not by luck.
            let snapshot;
            try {
                const st = lstatSync(absPath);
                if (st.isSymbolicLink()) {
                    return settle(cfsDenial('symlink-alias', 'post-consume write refused before open: the target itself is a symlink alias'));
                }
                if (!st.isFile()) {
                    return settle(cfsDenial('not-a-file', 'post-consume write refused: the write target is not a regular file'));
                }
                snapshot = { dev: Number(st.dev), ino: Number(st.ino), size: st.size, mtimeMs: st.mtimeMs };
            }
            catch (err) {
                const code = err.code;
                if (code === 'ENOENT') {
                    return settle(cfsDenial('not-a-file', 'post-consume write refused before creation: the target does not exist — the new-file path is HELD pending root ruling (no openat2/parent-FD keeps the parent bound across creation on this platform); this closure never creates, zero creation'));
                }
                return settle(cfsDenial('path-rejected', `post-consume write refused: the target could not be examined before open (${String(code)})`));
            }
            // ── P2: open WITHOUT O_TRUNC (and without O_CREAT); verification
            // precedes truncation ─────────────────────────────────────────────
            let handle;
            try {
                handle = await fsOpen(absPath, fsConstants.O_WRONLY | fsConstants.O_NOFOLLOW);
            }
            catch (err) {
                const code = err.code;
                if (code === 'ELOOP') {
                    return settle(cfsDenial('symlink-alias', 'the OS refused the open (ELOOP): symlink alias'));
                }
                if (code === 'EISDIR') {
                    return settle(cfsDenial('not-a-directory', 'target is a directory'));
                }
                if (code === 'ENOTDIR') {
                    return settle(cfsDenial('not-a-directory', 'a path component is not a directory'));
                }
                if (code === 'ENOENT') {
                    // state B by construction: the target raced away between the
                    // check and the open — with no O_CREAT this open created
                    // NOTHING, it simply found nothing.
                    return settle(cfsDenial('not-a-file', 'post-consume write refused: the target vanished between the pre-open check and the open (raced) — refused with zero creation (no O_CREAT) and nothing truncated or written'));
                }
                return settle(cfsDenial('path-rejected', `open failed (${String(code)})`));
            }
            try {
                const verdict = await verifyOpenedHandle(handle, frozenPlan.approvedRootReal, snapshot);
                if (verdict.verdict === 'escape') {
                    return settle(cfsDenial('exec-time-escape', `post-consume write refused: the open landed OUTSIDE the approved root anchor (fd resolved to ${verdict.resolvedPath}); nothing was truncated or written`));
                }
                if (verdict.verdict !== 'confirmed') {
                    // drift / undeterminable: identity cannot be established BEFORE
                    // truncation — the EXISTING lane law verbatim (no bytes claimed,
                    // sideEffectPossible false).
                    const detail = verdict.verdict === 'drift'
                        ? `snapshot ${verdict.snapshot.dev}:${verdict.snapshot.ino} != actual ${verdict.actual.dev}:${verdict.actual.ino}`
                        : verdict.detail;
                    return settle(cfsUndetermined('exec-time-identity-drift', `post-consume write refused: exec-time re-read BEFORE truncation — ${detail}; identity undetermined; nothing truncated, nothing written`, { sideEffectPossible: false }));
                }
                // Cancellation re-check immediately BEFORE the first byte-changing
                // step: after this line, bytes may land.
                if (isAborted(signal)) {
                    return settle(cfsDenial('effect-outside-grant', 'post-consume write refused: the call was cancelled after verification but before truncation — a cancelled call produces no effect; nothing was truncated or written'));
                }
                // ── verified: SAME FD truncation, then SAME FD write ──────────
                try {
                    await handle.truncate(0);
                }
                catch (err) {
                    return settle(cfsUndetermined('write-side-effect-unconfirmed', `truncation may have partially landed (${String(err.code)})`, { sideEffectPossible: true }));
                }
                // The write LOOPS until the full UTF-8 length has landed: a short
                // write (bytesWritten < requested) is NOT completion. Once
                // truncation has run, any failure or stall in this loop means
                // PARTIAL BYTES MAY HAVE LANDED — undetermined, sideEffectPossible
                // true, never a success report and never a "zero side effect".
                try {
                    const payload = Buffer.from(frozenPlan.content, 'utf8');
                    let offset = 0;
                    while (offset < payload.length) {
                        const { bytesWritten } = await handle.write(payload, offset, payload.length - offset);
                        if (typeof bytesWritten !== 'number' || bytesWritten <= 0) {
                            throw Object.assign(new Error('the write made no progress'), { code: 'EIO' });
                        }
                        offset += bytesWritten;
                    }
                }
                catch (err) {
                    return settle(cfsUndetermined('write-side-effect-unconfirmed', `write may have partially landed (${String(err.code)})`, { sideEffectPossible: true }));
                }
                return settle({
                    ok: true,
                    // D-C2-1: the receipt is {canonicalLocator, writtenFingerprint}
                    // ONLY — old content never travels back.
                    value: Object.freeze({
                        canonicalLocator: frozenPlan.approvedLocator,
                        writtenFingerprint: sha256Hex(frozenPlan.content),
                    }),
                });
            }
            finally {
                await handle.close().catch(() => undefined);
            }
        },
    });
    return closure;
}
//# sourceMappingURL=post-consume-write.js.map