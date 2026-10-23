/**
 * A5-M2 (FS-PROC) — the bounded raw-bytes read kernel of the controlled-fs
 * lane: `readBoundedBytes`, the ONLY export this module makes.
 *
 * Contract (root ruling, Alpha.5 M2) — the kernel owns the RING and NOTHING
 * ELSE:
 *
 *  - The CALLER has already completed the exec-time verification of this very
 *    FileHandle (`verifyOpenedHandle`, `./open-at-exec.ts`): same-FD
 *    re-anchor, O_NOFOLLOW and the final-FD check live there, before this
 *    call. The kernel NEVER opens, never touches a path, never realpath/stats
 *    — `handle` IS the verified boundary, and re-checking here would be a
 *    second, divergent boundary law.
 *  - Cap semantics are FACT, not refusal: the ring stops AT `maxBytes + 1`
 *    and reports the observed `byteLength` verbatim (`byteLength ≤
 *    maxBytes + 1`). Over-cap refusal wording belongs to the call-site (the
 *    governed read row keeps `read-too-large`, the image arm keeps
 *    `READ_TOO_LARGE`); this kernel owns no wording of its own — it cannot
 *    even express a refusal, only the observed size.
 *  - The ring law is copied item-for-item from the M1-proven read-row loop
 *    (`src/plugin/live/plane-effect-backends.mjs` READ_ROW ring,
 *    `:1466-1475`, read-only reference): `while (total < maxBytes + 1)`;
 *    per-chunk request `want = Math.min(chunkBytes, maxBytes + 1 - total)`;
 *    `bytesRead === 0` breaks; the cumulative judgement uses ACTUAL
 *    `bytesRead` — legitimate short reads / EOF probes are probes, never an
 *    over-cap trigger, and the buffer stays ≤ `maxBytes + 1` bytes.
 *  - NEW law (this kernel): `FileHandle.read` accepts no AbortSignal, so
 *    cancellation is a cooperative check taken BEFORE EVERY chunk read:
 *    `signal?.aborted === true` answers
 *    `{ ok: false, kind: 'cancelled', byteLength }` where `byteLength`
 *    states the bytes ACTUALLY observed up to the check boundary — nothing
 *    is fabricated and nothing already read is hidden.
 *  - Consumption law (root ruling): consumption happens ONLY at the existing
 *    PA final edge; the read port/kernel consumes NOTHING. This module
 *    imports no ledger, reads no `consumed` flag, answers no `consumed`
 *    boolean, takes no grantRef, and holds no global state. It returns raw
 *    `Uint8Array` bytes — zero utf8 decoding anywhere (bytes are copied out
 *    of the reused scratch window, so `bytes` carries EXACTLY the observed
 *    bytes, never a preallocated buffer's trailing zeros).
 *
 * Caller obligations (unchecked here, by law — the kernel owns no validation
 * wording either): `maxBytes` is a non-negative safe integer; `chunkBytes`,
 * when provided, is a positive integer (default `65536` — the same numeric
 * value as READ_ROW_CHUNK_BYTES, deliberately NOT imported from that module).
 *
 * @module packages/runtime/controlled-fs/src/bounded-bytes-read
 */
import type { FileHandle } from 'node:fs/promises';
export declare function readBoundedBytes(handle: FileHandle, opts: {
    maxBytes: number;
    signal?: {
        readonly aborted?: boolean;
    };
    chunkBytes?: number;
}): Promise<{
    ok: true;
    bytes: Uint8Array;
    byteLength: number;
} | {
    ok: false;
    kind: 'cancelled';
    byteLength: number;
}>;
//# sourceMappingURL=bounded-bytes-read.d.ts.map