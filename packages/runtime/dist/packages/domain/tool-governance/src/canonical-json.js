/**
 * Canonical JSON and fingerprinting for the tool-governance lane.
 *
 * MIRROR, NOT A NEW FACT: the canonical encoding is the Alpha.2/Alpha.4 one —
 * `packages/contracts/src/remote-safe.ts` `canonicalJsonStringify` (objects
 * emit keys in ascending CODE-UNIT order, arrays keep order, non-lossless JSON
 * is refused). `packages/domain` cannot import the contracts package (its
 * build rootDir owns `src` only — the precedent and the reason are stated in
 * `packages/domain/policy/src/contracts-mirror.ts`), so the encoding is
 * re-declared HERE and PINNED against the contracts original by
 * `a5p0-fingerprint-stability` behaviour (key-order independence, ABSENCE
 * carried not substituted, refusal of NaN/Infinity/functions). The fingerprint
 * HASH is the lane's existing pure implementation, `blueprint/src/hash.ts`
 * `sha256Hex` — the same function `runtime/operation-permission/canonical-operation.ts`
 * already imports across the package line.
 *
 * Why fingerprints exist: `RequestedEffectSet` and parameter identities must
 * be STABLE (same security semantics → same digest, regardless of key
 * construction order) and COLLISION-DETECTING at the contract level (two
 * different requests must never share one digest — the A2C-5 lesson: a
 * substituted default minted one identity for two distinct reads).
 *
 * Purity: no `node:*`.
 *
 * @module @dsh-agent-team/domain/tool-governance/canonical-json
 */
import { sha256Hex } from '../../blueprint/src/hash.js';
function assertLosslessJson(value, path) {
    if (value === null || typeof value === 'boolean' || typeof value === 'string')
        return;
    if (typeof value === 'number') {
        if (Number.isFinite(value))
            return;
        throw new TypeError(`canonical-value-not-json: ${path} holds a non-finite number`);
    }
    if (Array.isArray(value)) {
        value.forEach((item, index) => assertLosslessJson(item, `${path}[${index}]`));
        return;
    }
    if (typeof value === 'object' && value !== null) {
        for (const [key, item] of Object.entries(value)) {
            assertLosslessJson(item, `${path}.${key}`);
        }
        return;
    }
    throw new TypeError(`canonical-value-not-json: ${path} holds a value of type ${typeof value}`);
}
function canonical(value) {
    if (value === null || typeof value === 'string' || typeof value === 'boolean' || typeof value === 'number') {
        return JSON.stringify(value);
    }
    if (Array.isArray(value)) {
        return `[${value.map((item) => canonical(item)).join(',')}]`;
    }
    const entries = Object.entries(value).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    return `{${entries.map(([key, item]) => `${JSON.stringify(key)}:${canonical(item)}`).join(',')}}`;
}
/**
 * Deterministic JSON text: key-insertion order never changes the output;
 * arrays keep their order; `null` (explicit absence) is distinct from a
 * missing key. Throws on non-lossless JSON (`canonical-value-not-json`).
 */
export function canonicalJsonStringify(value) {
    assertLosslessJson(value, '$');
    return canonical(value);
}
/** `'sha256:' + sha256Hex(canonicalJsonStringify(value))` — the lane's digest tag. */
export function canonicalJsonFingerprint(value) {
    return `sha256:${sha256Hex(canonicalJsonStringify(value))}`;
}
//# sourceMappingURL=canonical-json.js.map