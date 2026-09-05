/**
 * Remote-safe (lossless-JSON) value discipline for the contracts package.
 *
 * Everything this package exports across a package, wire, or storage
 * boundary must be a lossless-JSON value: `null`, boolean, finite number,
 * string, plain array, or plain object (prototype `Object.prototype` or
 * `null`). Class instances, `Date`, `Map`/`Set`, `undefined`, `NaN`,
 * `Infinity`, functions, and symbol-keyed properties are NOT lossless JSON
 * and are rejected (error code `REMOTE_VALUE_NOT_JSON`).
 *
 * Authority: Development Plan §9.1 (contracts hold "stable serializable
 * contracts" / "remote-safe values"); Architecture §14.2 (Team control-plane
 * facts live in TeamDomain, never in session events, so cross-boundary
 * values must be plain serializable records).
 *
 * Pure module: no I/O, no runtime environment assumptions.
 * @module @dsh-agent-team/contracts/remote-safe
 */
/** A record whose keys are strings and whose values are lossless-JSON. */
export type RemoteSafeRecord = {
    [key: string]: RemoteSafeJsonValue;
};
/** A value that survives `JSON.stringify` / `JSON.parse` losslessly. */
export type RemoteSafeJsonValue = null | boolean | number | string | RemoteSafeJsonValue[] | RemoteSafeRecord;
/**
 * Deep-check whether `value` is a lossless-JSON value.
 * @param value - the value to check.
 * @returns `true` iff `value` round-trips through `JSON.stringify`/`JSON.parse` unchanged.
 */
export declare function isRemoteSafeJsonValue(value: unknown): boolean;
/**
 * Assert that `value` is a lossless-JSON value.
 * @param value - the value to check.
 * @param path - optional pointer into the value, used in the error message.
 * @throws `REMOTE_VALUE_NOT_JSON` when the value (or a nested member) is not lossless JSON.
 */
export declare function assertRemoteSafeJsonValue(value: unknown, path?: string): void;
/**
 * Coerce an arbitrary unknown into a lossless-JSON value for error
 * `details` records: primitives pass through (non-finite numbers become
 * their string tag), arrays/records are deep-coerced, and anything else
 * (functions, undefined, class instances) becomes a `<type>` tag string.
 * Never throws.
 * @param value - the unknown value to coerce.
 * @returns a lossless-JSON representation of it.
 */
export declare function toRemoteSafeDetail(value: unknown): RemoteSafeJsonValue;
/**
 * Deterministic JSON encoding: objects are emitted with keys in ascending
 * (code-unit) order, arrays keep their order. Two calls with deeply-equal
 * lossless-JSON input always return the same string, independent of the
 * property-insertion order in which the object was constructed.
 * @param value - a lossless-JSON value (interfaces without an index
 *   signature are accepted; the runtime check is authoritative).
 * @returns the canonical JSON text.
 * @throws `REMOTE_VALUE_NOT_JSON` when the value is not lossless JSON.
 */
export declare function canonicalJsonStringify(value: unknown): string;
/**
 * Recursively freeze a lossless-JSON value and return it. Used to make
 * parsed contract values immutable snapshots (Architecture §5.6/§8.4:
 * blueprint snapshots and records are immutable).
 * @param value - a lossless-JSON value (interfaces without an index
 *   signature are accepted; the runtime check is authoritative).
 * @returns the same value, deeply frozen.
 * @throws `REMOTE_VALUE_NOT_JSON` when the value is not lossless JSON.
 */
export declare function deepFreeze<T>(value: T): T;
//# sourceMappingURL=remote-safe.d.ts.map