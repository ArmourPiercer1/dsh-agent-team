/**
 * Lossless-JSON value discipline for the Remote contract v1 boundary.
 *
 * Value-level mirror of `packages/contracts/src/remote-safe.ts` (contracts
 * v1, P3-T1) — the frozen module remains the authority for the shape of
 * `RemoteSafeJsonValue`; this mirror exists because `packages/remote` is
 * deliberately self-contained (no cross-package `.ts` imports; see the P8-T3
 * design note, deviation D-1) while carrying an identical wire vocabulary.
 *
 * A value is *lossless-JSON-safe* when it survives a
 * `JSON.stringify` / `JSON.parse` round-trip without losing information:
 * `null`, booleans, FINITE numbers (not `NaN`, not `±Infinity`, not `-0` —
 * `-0` serializes to `0`), strings, arrays of safe values, and PLAIN objects
 * (prototype `Object.prototype` or `null`) of safe values. `undefined`,
 * functions, symbols, `Date`s, `BigInt`s, class instances, and circular
 * structures are rejected.
 *
 * Pure module: no I/O, no node: builtins, no runtime environment assumptions.
 * @module @dsh-agent-team/remote/contracts/remote-safe
 */
import { RemoteContractError } from './errors.js';
/** The JSON value kinds, in deterministic report order. */
function kindOf(value) {
    if (value === null)
        return 'null';
    if (Array.isArray(value))
        return 'array';
    return typeof value;
}
/**
 * Is `value` a lossless-JSON value (see module doc)?
 * @param value - the unknown input.
 * @returns `true` when a `JSON.stringify`/`JSON.parse` round-trip preserves it.
 */
export function isRemoteSafeJsonValue(value) {
    if (value === null)
        return true;
    switch (typeof value) {
        case 'boolean':
            return true;
        case 'number':
            return Number.isFinite(value) && !Object.is(value, -0);
        case 'string':
            return true;
        case 'object': {
            if (Array.isArray(value)) {
                for (const item of value) {
                    if (!isRemoteSafeJsonValue(item))
                        return false;
                }
                return true;
            }
            const proto = Object.getPrototypeOf(value);
            if (proto !== null && proto !== Object.prototype)
                return false;
            for (const key of Object.keys(value)) {
                if (!isRemoteSafeJsonValue(value[key])) {
                    return false;
                }
            }
            return true;
        }
        default:
            return false;
    }
}
/**
 * Assert `value` is a lossless-JSON value.
 * @param value - the unknown input.
 * @param path - the JSON-path label used in the error detail.
 * @returns the input typed as a safe JSON value.
 * @throws {RemoteContractError} `internal-error` (boundary integrity failure)
 *   when the value is not lossless-JSON safe.
 */
export function assertRemoteSafeJsonValue(value, path = '$') {
    if (!isRemoteSafeJsonValue(value)) {
        throw new RemoteContractError('internal-error', `remote boundary integrity failure: value at ${path} is not lossless-JSON safe (kind: ${kindOf(value)})`, { path, kind: kindOf(value) });
    }
    return value;
}
/**
 * Reduce an unknown value to a lossless-JSON-safe detail representation for
 * inclusion in wire error details (never a raw object reference, never a
 * cycle).
 * @param value - the unknown input (typically an error `details` payload).
 * @returns the safe value when the input is already lossless-JSON safe;
 *   otherwise a short `[non-lossless-<kind>]` marker string.
 */
export function toRemoteSafeDetail(value) {
    if (isRemoteSafeJsonValue(value)) {
        // A JSON round-trip yields a detached, plain, lossless copy (the input
        // may be a frozen or class-shaped record; the copy is wire-ready).
        return JSON.parse(JSON.stringify(value));
    }
    const kind = kindOf(value);
    return `[non-lossless-${kind}]`;
}
//# sourceMappingURL=remote-safe.js.map