/**
 * THE production readBounded port for the governed B-IMAGE arm (root ruling:
 * a CENTER-owned FS-PROC port, built on the M1-verified read binary boundary
 * — this module is the production leg the arm's header disclosed as
 * NOT_VERIFIED-in-lane).
 *
 * Law carried (each clause VERBATIM from the M1-verified governed read row,
 * plane-effect-backends.mjs — the recipe is copied, not re-invented):
 *  - the approved fact is a REALPATH AGREEMENT: the resolved real target
 *    must equal the approved lexical target or the call is STALE
 *    (`ANCHOR-DRIFT`, zero bytes);
 *  - the check-time path string NEVER carries the open: O_RDONLY|O_NOFOLLOW
 *    (ELOOP = symlink-alias refusal) and the ACTUAL fd is re-read by
 *    `verifyOpenedHandle` (/proc/self/fd containment + fstat-vs-snapshot
 *    drift) BEFORE any byte is read — bytes come from the verified handle,
 *    never from the path;
 *  - ONE close owner: every post-open outcome exits through the same finally;
 *  - the cap lives on the READ itself (bounded-bytes-read.ts, cap+1 stop on
 *    the SAME fd): the port passes the byteLength FACT through (it may
 *    answer maxBytes+1) — the ARM refuses over-cap with the measured fact;
 *  - cancellation is answered inside the read by THROWING an AbortError (the
 *    arm's documented CANCELLED edge: commit never started, zero writes).
 *
 * Port protocol (the arm's contract, image.mjs):
 *   port({ grant, realmId, canonicalLocator }, { maxBytes, signal? })
 *     -> { ok: true, value: { observedKind, byteLength, bytes } }
 *     -> { ok: false, code, detail }            (refusals, passed verbatim)
 *     -> throws AbortError on cancellation.
 * The `grant` is the REAL execution credential of the call (minted durable
 * grant, or the trusted face's policy-admitted grant): its PRESENCE is
 * required at the boundary (arm law "there is NO third shape" is enforced
 * where the bytes are fetched, not only where they were promised); the port
 * never interprets its contents — the durable ledger owns that check.
 *
 * @module packages/runtime/controlled-fs/src/governed-image-read-port
 */
import { readlinkSync } from 'node:fs';
import { isBeneath } from './open-at-exec.js';
export interface GovernedImageReadInput {
    readonly grant: unknown;
    readonly realmId?: string;
    readonly canonicalLocator: string;
}
export interface GovernedImageReadPort {
    (input: GovernedImageReadInput, opts: {
        readonly maxBytes: number;
        readonly signal?: {
            readonly aborted?: boolean;
        };
    }): Promise<{
        ok: true;
        value: {
            observedKind: 'file';
            byteLength: number;
            bytes: Uint8Array;
        };
    } | {
        ok: false;
        code: string;
        detail: string;
    }>;
}
/**
 * Bind a port to ONE governed namespace root (the same root the arm anchors
 * against — the port re-anchors independently; a port without a root cannot
 * be constructed).
 */
export declare function createGovernedImageReadPort(deps: {
    readonly namespaceRoot: string;
}): GovernedImageReadPort;
/** Visible for tests that need the containment helper without duplicating it. */
export declare const __testing: {
    isBeneath: typeof isBeneath;
    readlinkSync: typeof readlinkSync;
};
//# sourceMappingURL=governed-image-read-port.d.ts.map