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
/** A JSON value that round-trips losslessly (contracts v1 mirror). */
export type RemoteSafeJsonValue = null | boolean | number | string | RemoteSafeJsonValue[] | {
    readonly [key: string]: RemoteSafeJsonValue;
};
/** A plain object of lossless-JSON values (contracts v1 mirror). */
export type RemoteSafeRecord = {
    readonly [key: string]: RemoteSafeJsonValue;
};
/**
 * Is `value` a lossless-JSON value (see module doc)?
 * @param value - the unknown input.
 * @returns `true` when a `JSON.stringify`/`JSON.parse` round-trip preserves it.
 */
export declare function isRemoteSafeJsonValue(value: unknown): boolean;
/**
 * Assert `value` is a lossless-JSON value.
 * @param value - the unknown input.
 * @param path - the JSON-path label used in the error detail.
 * @returns the input typed as a safe JSON value.
 * @throws {RemoteContractError} `internal-error` (boundary integrity failure)
 *   when the value is not lossless-JSON safe.
 */
export declare function assertRemoteSafeJsonValue(value: unknown, path?: string): RemoteSafeJsonValue;
/**
 * Reduce an unknown value to a lossless-JSON-safe detail representation for
 * inclusion in wire error details (never a raw object reference, never a
 * cycle).
 * @param value - the unknown input (typically an error `details` payload).
 * @returns the safe value when the input is already lossless-JSON safe;
 *   otherwise a short `[non-lossless-<kind>]` marker string.
 */
export declare function toRemoteSafeDetail(value: unknown): RemoteSafeJsonValue;
//# sourceMappingURL=remote-safe.d.ts.map