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
 *  - the parent rides the REVIEWED path law (lstat symlink refuses
 *    `symlink-alias`, absent answers `not-a-directory`, realpath must equal
 *    the MAPPED real spelling) and NO directory is ever created: the row's
 *    approved effect set is EXACTLY `I:tool-invoke + F(write exact file)`
 *    (matrix M-02: "无新 kind"), so `mkdir` — including the native
 *    `writeFileAtomic`'s `mkdir(recursive)` (fsio.ts:598 @639ed01539) — is
 *    OUTSIDE the grant. This deviation from native is DISCLOSED, never
 *    silent;
 *  - THE FINAL PARENT IS FD-BOUND AT THE CREATE INSTANT: the verified
 *    parent directory is opened `O_DIRECTORY | O_NOFOLLOW`, its
 *    `/proc/self/fd/<n>` link is re-read to confirm the bind, and the
 *    exclusive create is issued through THAT fd — a parent-name swap after
 *    the bind cannot steer the create. Intermediate components ride the
 *    reviewed path law with the SAME residual as the existing-file
 *    closure; no per-component fd chain and no whole-tree rename immunity
 *    is claimed (root P2 wording ruling 2026-10-25);
 *  - the final open is `O_WRONLY | O_CREAT | O_EXCL | O_NOFOLLOW` on the
 *    PARENT FD: O_EXCL makes create-if-absent atomic (no truncate window,
 *    no content substitution — an existing target races LOST: EEXIST,
 *    zero bytes, the CALLER re-classifies under the existing-file law);
 *  - after creation, the fd is verified INSIDE the anchor
 *    (`verifyOpenedHandle`, snapshot null — the fresh inode is its own
 *    identity) and must be a regular file with `nlink === 1` (a hardlink
 *    alias at the fresh name answers `write-side-effect-unconfirmed` with
 *    sideEffectPossible true — the fresh file was legitimately created and
 *    STANDS; a failed identity re-read settles the SAME way, never a bare
 *    throw; the empty
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
function isAborted(signal) {
    return signal?.aborted === true;
}
/**
 * Build the ONE-SHOT creation closure for one frozen, already-approved
 * write plan whose target was absent at classification time. Same plan
 * shape, same pairing facts, same zero-argument call as the existing-file
 * closure — the closure is the private executor: nothing post-approval can
 * be substituted into it (P1), it runs at most once (P3).
 */
export function createPostConsumeCreateClosure(frozenPlan, ctx, cfg) {
    if (frozenPlan === null || typeof frozenPlan !== 'object') {
        throw new TypeError('post-consume-create: the plan must be the frozen typed plan object');
    }
    if (!isNonEmptyString(frozenPlan.approvedRootLexical) || !path.isAbsolute(frozenPlan.approvedRootLexical)) {
        throw new TypeError('post-consume-create: approvedRootLexical must be a non-empty absolute path');
    }
    if (!isNonEmptyString(frozenPlan.approvedRootReal) || !path.isAbsolute(frozenPlan.approvedRootReal)) {
        throw new TypeError('post-consume-create: approvedRootReal must be a non-empty absolute path');
    }
    if (!isNonEmptyString(frozenPlan.approvedLocator) || !path.isAbsolute(frozenPlan.approvedLocator)) {
        throw new TypeError('post-consume-create: approvedLocator must be a non-empty absolute path');
    }
    if (typeof frozenPlan.content !== 'string') {
        throw new TypeError('post-consume-create: content must be a string (the empty string is legal)');
    }
    if (!isNonEmptyString(frozenPlan.planFingerprint)) {
        throw new TypeError('post-consume-create: planFingerprint must be a non-empty string');
    }
    const relTarget = path.relative(frozenPlan.approvedRootLexical, frozenPlan.approvedLocator);
    if (relTarget.length === 0 || relTarget === '..' || relTarget.startsWith(`..${path.sep}`) || path.isAbsolute(relTarget)) {
        throw new TypeError('post-consume-create: approvedLocator is not strictly beneath approvedRootLexical (pure-lexical law)');
    }
    const instanceRootDir = cfg?.instanceRootDir;
    if (!isNonEmptyString(instanceRootDir)) {
        throw new TypeError('post-consume-create: instanceRootDir must be a non-empty string');
    }
    // The reviewed existing-file closure's MAPPING law (post-consume-write.ts
    // :213-221), verbatim: the lexical locator's RELATIVE path is mapped onto
    // the FROZEN real root. A stable trusted root symlink (/alias -> /real/
    // root) then answers normally — the real spelling is the working spelling
    // from here on. This mapping does NOT relax child-path symlinks: every
    // child component is still required to resolve at its mapped real
    // spelling below (root P2 ruling 2026-10-25).
    const absPath = path.join(frozenPlan.approvedRootReal, relTarget);
    if (!isBeneath(frozenPlan.approvedRootReal, absPath) || absPath === frozenPlan.approvedRootReal) {
        throw new TypeError('post-consume-create: the approved locator does not resolve beneath the approved root real identity');
    }
    const signal = ctx?.signal;
    let state = 'open';
    const closure = Object.freeze({
        claimed: () => state !== 'open',
        async write() {
            if (state !== 'open') {
                return cfsDenial('grant-consumed', `post-consume create refused: this closure was already claimed (state ${state}) — the consumed call gets ONE execution attempt; a repeat is effect-outside-grant with zero FS (P3)`);
            }
            state = 'claimed';
            const settle = (r) => {
                state = 'settled';
                return r;
            };
            // ── cancellation BEFORE anything: the call stopped existing ──────
            if (isAborted(signal)) {
                return settle(cfsDenial('effect-outside-grant', 'post-consume create refused: the call was cancelled before anything was created — a cancelled call produces no effect (zero FS)'));
            }
            // ── ANCHOR law, verbatim: the frozen real root must still stand ──
            let currentRootReal;
            try {
                currentRootReal = realpathSync(instanceRootDir);
            }
            catch (err) {
                return settle(cfsDenial('path-rejected', `post-consume create refused: the instance root could not be resolved (${String(err.code)}) — the approved agreement cannot be answered`));
            }
            if (currentRootReal !== frozenPlan.approvedRootReal) {
                return settle(cfsDenial('outside-anchor', `post-consume create refused: the instance root stands at '${currentRootReal}', not at the approved root real identity '${frozenPlan.approvedRootReal}' — a root/ancestor swap makes the approved identity unreachable; zero bytes (ANCHOR law, before any open)`));
            }
            // ── THE PARENT LAW (the reviewed module's law verbatim), THEN THE
            //    FD-BOUND EXCLUSIVE CREATE (the gap this module exists for) ────
            // The reviewed existing-file closure froze the parent law: lstat the
            // parent (symlink refuses BEFORE anything else), its realpath must
            // stand at the purely-lexical spelling AND beneath the approved root
            // real identity. What that law could not answer was the CREATION
            // instant — no openat2 on this platform. The answer is the kernel's
            // own fd-binding: the parent directory is opened O_DIRECTORY|
            // O_NOFOLLOW, its /proc/self/fd link is re-read to CONFIRM the fd is
            // still bound where the law verified it, and the exclusive create is
            // issued THROUGH THAT FD (`/proc/self/fd/<n>/<base>` resolves against
            // the bound INODE, not a name — a parent-name swap after the bind
            // cannot steer the create). O_EXCL makes create-if-absent atomic,
            // O_NOFOLLOW on the final component refuses a symlink at the name.
            const base = path.basename(absPath);
            const parentDirLex = path.dirname(absPath);
            const openedDirs = [];
            let fileHandle = null;
            try {
                let parentStats;
                try {
                    parentStats = lstatSync(parentDirLex);
                }
                catch (err) {
                    const code = err.code;
                    if (code === 'ENOENT') {
                        return settle(cfsDenial('not-a-directory', `post-consume create refused before creation: the parent directory '${parentDirLex}' does not exist — the governed write NEVER creates directories: the approved effect set is exactly I:tool-invoke + F(write exact file), directory creation is outside it (disclosed deviation from the native mkdir-recursive spelling); nothing was created`));
                    }
                    return settle(cfsDenial('path-rejected', `post-consume create refused before creation: the parent directory could not be examined (${String(code)}); nothing was created`));
                }
                if (parentStats.isSymbolicLink()) {
                    return settle(cfsDenial('symlink-alias', `post-consume create refused before creation: the parent directory '${parentDirLex}' is a symlink alias — the reviewed parent law refuses before anything is created`));
                }
                if (!parentStats.isDirectory()) {
                    return settle(cfsDenial('not-a-directory', `post-consume create refused before creation: the parent '${parentDirLex}' is not a directory; nothing was created`));
                }
                let parentReal;
                try {
                    parentReal = realpathSync(parentDirLex);
                }
                catch (err) {
                    return settle(cfsDenial('path-rejected', `post-consume create refused before creation: the parent directory could not be resolved (${String(err.code)}); nothing was created`));
                }
                if (parentReal !== parentDirLex || !isBeneath(frozenPlan.approvedRootReal, parentReal)) {
                    return settle(cfsDenial('outside-anchor', `post-consume create refused before creation: the parent directory resolves to '${parentReal}', not the purely-lexical spelling beneath the approved root real identity (anchor drift); nothing was created`));
                }
                // Cancellation re-check immediately BEFORE the first byte-changing
                // step (creation IS the byte-changing step's gate): after this line,
                // a file may exist.
                if (isAborted(signal)) {
                    return settle(cfsDenial('effect-outside-grant', 'post-consume create refused: the call was cancelled before creation — a cancelled call produces no effect; nothing was created or written'));
                }
                // ── BIND the parent, CONFIRM the bind, CREATE through the fd ───
                let dirHandle;
                try {
                    // Node/libuv opens CLOEXEC by default (no O_CLOEXEC constant on
                    // this platform's types — the lane's own recorded line).
                    dirHandle = await fsOpen(parentReal, fsConstants.O_RDONLY | fsConstants.O_DIRECTORY | fsConstants.O_NOFOLLOW);
                }
                catch (err) {
                    return settle(cfsDenial('path-rejected', `post-consume create refused: the parent directory could not be opened as a bound fd (${String(err.code)}); zero creation`));
                }
                openedDirs.push(dirHandle);
                let bindPath;
                try {
                    bindPath = realpathSync(`/proc/self/fd/${dirHandle.fd}`);
                }
                catch {
                    return settle(cfsUndetermined('exec-time-identity-drift', 'post-consume create refused: the bound parent fd cannot be re-read through /proc (no fd view); nothing was created', { sideEffectPossible: false }));
                }
                if (bindPath !== parentReal || !isBeneath(frozenPlan.approvedRootReal, bindPath)) {
                    return settle(cfsDenial('outside-anchor', `post-consume create refused: the bound parent fd resolves to '${bindPath}', not the verified parent identity '${parentReal}' (bind-time drift — the final-parent bind check closes the swap window between the verify and the create); nothing was created`));
                }
                // Cancellation re-check AFTER the parent bind and IMMEDIATELY
                // BEFORE the exclusive create (root P2 ruling 2026-10-25: the bind
                // await is a real await point — a cancellation that lands during it
                // must NOT create; zero FS beyond the read-only bind).
                if (isAborted(signal)) {
                    return settle(cfsDenial('effect-outside-grant', 'post-consume create refused: the call was cancelled after the parent bind but before the create — a cancelled call produces no effect; nothing was created or written'));
                }
                // ── THE EXCLUSIVE CREATE, THROUGH THE BOUND PARENT FD ──────────
                try {
                    fileHandle = await fsOpen(`/proc/self/fd/${dirHandle.fd}/${base}`, fsConstants.O_WRONLY | fsConstants.O_CREAT | fsConstants.O_EXCL | fsConstants.O_NOFOLLOW, 0o600);
                }
                catch (err) {
                    const code = err.code;
                    if (code === 'EEXIST' || code === 'ELOOP') {
                        // MEASURED on this Node (v24, Linux): O_CREAT|O_EXCL|O_NOFOLLOW
                        // answers EEXIST — not ELOOP — when an existing SYMLINK sits at
                        // the name; either way the exclusive open created nothing and
                        // wrote ZERO bytes. The precise name is lstat'ed THROUGH THE
                        // BOUND FD (resolution rides the same kernel bind that made
                        // the create safe): a symlink earns the stronger symlink-alias
                        // refusal; anything else is the existing-file race, which the
                        // caller re-answers under the existing-file law.
                        let racedIsSymlink = code === 'ELOOP';
                        try {
                            racedIsSymlink = lstatSync(`/proc/self/fd/${dirHandle.fd}/${base}`).isSymbolicLink();
                        }
                        catch { /* raced away again or unreadable: the honest fallback below */ }
                        if (racedIsSymlink) {
                            return settle(cfsDenial('symlink-alias', 'post-consume create refused: a symlink alias stands at the final name at the create instant — refused, zero creation, the linked object untouched'));
                        }
                        return settle(cfsDenial('path-rejected', 'post-consume create refused: the target already exists at the exclusive-create instant (raced) — O_EXCL wrote ZERO bytes and truncated NOTHING; recall the call and the existing-file law answers it'));
                    }
                    if (code === 'ENOENT') {
                        return settle(cfsDenial('not-a-directory', 'post-consume create refused: the bound parent vanished before the create (raced) — zero creation'));
                    }
                    return settle(cfsDenial('path-rejected', `post-consume create refused: the exclusive create failed (${String(code)}: ${String(err.message ?? err).slice(0, 160)}) — nothing was written`));
                }
                // Cancellation that lands AT/AFTER the create is NOT zero: the
                // exclusive create IS a real effect — the file at the exact target
                // STANDS (root P2 ruling: cancel-after-create is a real side
                // effect). Never success, never "nothing was created"; the observed
                // content bytes are 0.
                if (isAborted(signal)) {
                    return settle(cfsUndetermined('write-side-effect-unconfirmed', 'the call was cancelled at/after the exclusive create: the created file STANDS at the exact target as a real side effect (0 content bytes written)', { sideEffectPossible: true }));
                }
                // ── post-create identity: regular, single-linked, INSIDE anchor ─
                // The identity re-reads run AFTER a real effect already landed, so
                // ANY failure of them (a bare throw included) settles through the
                // EXISTING undetermined protocol with sideEffectPossible true
                // (root P2 ruling: no new error system; the created file stands).
                let fresh;
                try {
                    const verdict = await verifyOpenedHandle(fileHandle, frozenPlan.approvedRootReal, null);
                    if (verdict.verdict === 'escape') {
                        return settle(cfsDenial('exec-time-escape', `post-consume create refused: the created fd resolves OUTSIDE the approved anchor (${verdict.resolvedPath}); the empty in-root file that was created stands — no content was written`));
                    }
                    if (verdict.verdict !== 'confirmed') {
                        return settle(cfsUndetermined('exec-time-identity-drift', `post-consume create refused after creation: the fresh identity is ${verdict.verdict}; no content was written; the empty file at the exact target may stand`, { sideEffectPossible: true }));
                    }
                    fresh = await fileHandle.stat({ bigint: false });
                }
                catch (err) {
                    return settle(cfsUndetermined('write-side-effect-unconfirmed', `post-consume create: the post-create identity re-read failed (${String(err.message ?? err).slice(0, 160)}) — the created file STANDS at the exact target; no content was written`, { sideEffectPossible: true }));
                }
                if (!fresh.isFile()) {
                    return settle(cfsDenial('not-a-file', 'post-consume create refused: the freshly created object is not a regular file — no content was written'));
                }
                if (fresh.nlink !== 1) {
                    // BELT-AND-BRACES (post-merge #405 review HIGH): the shared law in
                    // `verifyOpenedHandle` now refuses `nlink !== 1` itself, so this
                    // arm is unreachable while that law holds — the generic
                    // not-confirmed branch above settles it as an undetermined
                    // (sideEffectPossible true: the fresh file legitimately stands).
                    // Kept as the create path's OWN statement of the clause so the
                    // law does not rest on a shared default alone.
                    return settle(cfsUndetermined('write-side-effect-unconfirmed', `post-consume create refused: the fresh name carries ${String(fresh.nlink)} links (hardlink alias at the fresh inode) — no content was written; the empty in-root file stands`, { sideEffectPossible: true }));
                }
                // ── THE WRITE LOOP (the reviewed law verbatim) ─────────────────
                try {
                    const payload = Buffer.from(frozenPlan.content, 'utf8');
                    let offset = 0;
                    while (offset < payload.length) {
                        if (isAborted(signal)) {
                            return settle(cfsUndetermined('write-side-effect-unconfirmed', `the call was cancelled mid-write: ${String(offset)} observed bytes may have landed, subsequent chunks were NOT written`, { sideEffectPossible: true }));
                        }
                        const { bytesWritten } = await fileHandle.write(payload, offset, payload.length - offset);
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
                    // ONLY — nothing else travels back.
                    value: Object.freeze({
                        canonicalLocator: frozenPlan.approvedLocator,
                        writtenFingerprint: sha256Hex(frozenPlan.content),
                    }),
                });
            }
            finally {
                if (fileHandle !== null)
                    await fileHandle.close().catch(() => undefined);
                for (const handle of openedDirs)
                    await handle.close().catch(() => undefined);
            }
        },
    });
    return closure;
}
//# sourceMappingURL=post-consume-create.js.map