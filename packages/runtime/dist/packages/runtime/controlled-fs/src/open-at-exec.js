/**
 * Open-at-exec — the exec-time RE-READ seam (INTERFACES-v1 C-FS, plan §6).
 *
 * Two independent laws run at the moment of the real open:
 *
 *  1. POLICY RE-READ (this module's seam, `AdmissionRecheck`): the decision
 *     taken at check time is re-confirmed at exec time. INTEGRATION NOTE
 *     (C-ADM freeze, do not live-wire before PR2 merges): this is exactly
 *     where the PR1 fingerprint law re-attaches — the recheck must present
 *     the SAME `parametersFingerprint` the Guard saw pre-call, so a
 *     re-resolved definition cannot exec under another call's fingerprint.
 *     Until the integration owner wires it, the seam runs with the honest
 *     `noRecheck` default, and README §2 records this as a pre-freeze
 *     deviation, NOT as if the recheck existed.
 *
 *  2. OBJECT RE-READ (implemented here, real syscalls): the opened FD is
 *     matched against the check-time snapshot —
 *       - `readlink /proc/self/fd/<n>` must resolve at-or-below the instance
 *         anchor (a directory swapped to an outside symlink mid-flight is
 *         caught here, AFTER the OS open and BEFORE any byte is read);
 *       - `fstat` (dev, ino) must equal the pre-open `lstat` snapshot; any
 *         drift is `undetermined` (identity cannot be established) — never
 *         silently "close enough".
 *
 * The kernel-grade guarantee (openat2 + RESOLVE_BENEATH/RESOLVE_IN_ROOT on
 * a trusted directory FD) is declared as the `OpenAtPort` seam below: a
 * native helper lands it at integration time; this file keeps the honest
 * node:fs fallback and its documented residual windows (README §3).
 *
 * @module packages/runtime/controlled-fs/src/open-at-exec
 */
import { readlinkSync, realpathSync } from 'node:fs';
import * as path from 'node:path';
/** Is `candidate` at-or-below `anchor` (both real, canonical paths)? */
export function isBeneath(anchor, candidate) {
    const rel = path.relative(anchor, candidate);
    return rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel));
}
function snapshotOf(stats) {
    return { dev: Number(stats.dev), ino: Number(stats.ino), size: stats.size, mtimeMs: stats.mtimeMs };
}
/**
 * Re-read the ACTUAL opened object. Order matters: escape first (active
 * knowledge of a foreign object → denied), drift second (identity cannot be
 * established → undetermined).
 */
export async function verifyOpenedHandle(handle, anchorReal, snapshot) {
    let resolved;
    try {
        resolved = readlinkSync(`/proc/self/fd/${handle.fd}`);
    }
    catch {
        return { verdict: 'undeterminable', detail: 'no /proc view for the opened fd' };
    }
    let canonical;
    try {
        canonical = realpathSync(resolved);
    }
    catch {
        canonical = resolved;
    }
    if (!isBeneath(anchorReal, canonical)) {
        return { verdict: 'escape', resolvedPath: canonical };
    }
    const stats = await handle.stat({ bigint: false });
    const actual = snapshotOf(stats);
    if (snapshot !== null && (actual.dev !== snapshot.dev || actual.ino !== snapshot.ino)) {
        return { verdict: 'drift', snapshot, actual };
    }
    return { verdict: 'confirmed', identity: actual };
}
/** Pre-freeze default: no external recheck (recorded deviation, README §2). */
export const NO_RECHECK = Object.freeze({
    recheck: async () => ({ ok: true }),
});
//# sourceMappingURL=open-at-exec.js.map