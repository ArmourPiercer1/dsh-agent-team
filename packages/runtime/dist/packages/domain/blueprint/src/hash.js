/**
 * Machine content identity for a TeamBlueprint.
 *
 * The domain is **closed**: no `node:` builtins are importable from `.ts`
 * (there is no `@types/node` in this workspace), so the content hash cannot
 * be taken from `node:crypto`. Instead this module provides a self-contained,
 * deterministic SHA-256 over the UTF-8 bytes of the blueprint's canonical
 * JSON string (the canonical encoding from contracts v1, which sorts object
 * keys so the digest is independent of property-insertion order).
 *
 * Authority:
 * - Architecture §5.2 — a blueprint's identity is `blueprintId` (stable
 *   logical identity) + `revision` (human-readable) + `contentHash`
 *   (machine content identity). Filesystem path, workspace path, cwd,
 *   displayName and AgentPreset id must NOT define the identity.
 * - Architecture §5.6 — the immutable snapshot freezes Blueprint-owned
 *   semantics; the snapshot is identified by the triple above.
 *
 * The digest is a plain lowercase hex string; the published
 * `BlueprintContentHash` is prefixed `sha256:` so the algorithm is
 * self-describing on the wire. Both the bare hex and the prefixed form
 * satisfy the contracts `contentHash` string rule (non-empty, ≤256 chars,
 * no whitespace/control chars).
 *
 * Verified in tests against the NIST vector SHA-256("abc").
 *
 * Pure module: no I/O, no live Agent, no runtime environment assumptions.
 * @module @dsh-agent-team/domain/blueprint/hash
 */
import { parseBlueprintContentHash, canonicalJsonStringify, } from '../../../contracts/src/index.js';
/** First 32 bits of the fractional parts of the cube roots of the first 64 primes. */
const K = [
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
];
/** First 32 bits of the fractional parts of the square roots of the first 8 primes. */
const H_INITIAL = [
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
];
/** Right-rotate a 32-bit word. */
function rotr(x, n) {
    return ((x >>> n) | (x << (32 - n))) >>> 0;
}
/** Read a byte from a Uint8Array, treating out-of-range/undefined as 0. */
function byteAt(bytes, index) {
    const value = bytes[index];
    return value === undefined ? 0 : value;
}
/** Encode a UTF-8 string to a byte array. */
function utf8Bytes(input) {
    const out = [];
    for (const ch of input) {
        const code = ch.codePointAt(0) ?? 0;
        if (code < 0x80) {
            out.push(code);
        }
        else if (code < 0x800) {
            out.push(0xc0 | (code >> 6), 0x80 | (code & 0x3f));
        }
        else if (code < 0x10000) {
            out.push(0xe0 | (code >> 12), 0x80 | ((code >> 6) & 0x3f), 0x80 | (code & 0x3f));
        }
        else {
            out.push(0xf0 | (code >> 18), 0x80 | ((code >> 12) & 0x3f), 0x80 | ((code >> 6) & 0x3f), 0x80 | (code & 0x3f));
        }
    }
    return new Uint8Array(out);
}
/**
 * Compute the SHA-256 digest of a UTF-8 string as a 64-char lowercase hex
 * string.
 * @param message - the input string.
 * @returns the hex digest.
 */
export function sha256Hex(message) {
    const bytes = Array.from(utf8Bytes(message));
    // Pre-processing: append the bit '1' (0x80) then zero-pad to 56 mod 64,
    // then append the original length as a 64-bit big-endian integer.
    const bitLength = bytes.length * 8;
    bytes.push(0x80);
    while (bytes.length % 64 !== 56)
        bytes.push(0);
    const lengthHi = Math.floor(bitLength / 0x100000000);
    const lengthLo = bitLength >>> 0;
    for (const part of [lengthHi, lengthLo]) {
        bytes.push((part >>> 24) & 0xff, (part >>> 16) & 0xff, (part >>> 8) & 0xff, part & 0xff);
    }
    const buf = new Uint8Array(bytes);
    const h = [...H_INITIAL];
    const w = new Array(64);
    for (let offset = 0; offset < buf.length; offset += 64) {
        for (let t = 0; t < 16; t++) {
            w[t] =
                ((byteAt(buf, offset + t * 4) << 24) |
                    (byteAt(buf, offset + t * 4 + 1) << 16) |
                    (byteAt(buf, offset + t * 4 + 2) << 8) |
                    byteAt(buf, offset + t * 4 + 3)) >>>
                    0;
        }
        for (let t = 16; t < 64; t++) {
            const s0 = rotr(w[t - 15] ?? 0, 7) ^ rotr(w[t - 15] ?? 0, 18) ^ ((w[t - 15] ?? 0) >>> 3);
            const s1 = rotr(w[t - 2] ?? 0, 17) ^ rotr(w[t - 2] ?? 0, 19) ^ ((w[t - 2] ?? 0) >>> 10);
            w[t] = (w[t - 16] ?? 0) + s0 + (w[t - 7] ?? 0) + s1 >>> 0;
        }
        let a = h[0] ?? 0;
        let b = h[1] ?? 0;
        let c = h[2] ?? 0;
        let d = h[3] ?? 0;
        let e = h[4] ?? 0;
        let f = h[5] ?? 0;
        let g = h[6] ?? 0;
        let hh = h[7] ?? 0;
        for (let t = 0; t < 64; t++) {
            const bigS1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
            const choice = (e & f) ^ (~e & g);
            const temp1 = (hh + bigS1 + choice + (K[t] ?? 0) + (w[t] ?? 0)) >>> 0;
            const bigS0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
            const majority = (a & b) ^ (a & c) ^ (b & c);
            const temp2 = (bigS0 + majority) >>> 0;
            hh = g;
            g = f;
            f = e;
            e = (d + temp1) >>> 0;
            d = c;
            c = b;
            b = a;
            a = (temp1 + temp2) >>> 0;
        }
        h[0] = (h[0] ?? 0) + a >>> 0;
        h[1] = (h[1] ?? 0) + b >>> 0;
        h[2] = (h[2] ?? 0) + c >>> 0;
        h[3] = (h[3] ?? 0) + d >>> 0;
        h[4] = (h[4] ?? 0) + e >>> 0;
        h[5] = (h[5] ?? 0) + f >>> 0;
        h[6] = (h[6] ?? 0) + g >>> 0;
        h[7] = (h[7] ?? 0) + hh >>> 0;
    }
    return h.map((value) => (value >>> 0).toString(16).padStart(8, '0')).join('');
}
/**
 * Derive the `BlueprintContentHash` for a validated blueprint.
 *
 * The hash is computed over the blueprint's **canonical** serialization
 * (contracts `canonicalJsonStringify`: keys sorted, arrays ordered) of the
 * hashable projection — the full semantic content with the derived
 * `contentHash` field itself excluded, so identity never depends on itself.
 *
 * @param hashable - a lossless-JSON projection of the blueprint content.
 * @returns the `sha256:<hex>` content hash, validated against contracts.
 */
export function deriveContentHash(hashable) {
    const canonical = canonicalJsonStringify(hashable);
    return parseBlueprintContentHash(`sha256:${sha256Hex(canonical)}`);
}
//# sourceMappingURL=hash.js.map