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
import { teamContractError } from './errors.js';
function isPlainObject(value) {
    const proto = Object.getPrototypeOf(value);
    return proto === Object.prototype || proto === null;
}
/**
 * Deep-check whether `value` is a lossless-JSON value.
 * @param value - the value to check.
 * @returns `true` iff `value` round-trips through `JSON.stringify`/`JSON.parse` unchanged.
 */
export function isRemoteSafeJsonValue(value) {
    if (value === null)
        return true;
    switch (typeof value) {
        case 'boolean':
        case 'string':
            return true;
        case 'number':
            return Number.isFinite(value);
        case 'object': {
            if (Array.isArray(value))
                return value.every((item) => isRemoteSafeJsonValue(item));
            if (!isPlainObject(value))
                return false;
            return Object.entries(value).every(([key, item]) => key.length > 0 && isRemoteSafeJsonValue(item));
        }
        default:
            return false;
    }
}
/**
 * Assert that `value` is a lossless-JSON value.
 * @param value - the value to check.
 * @param path - optional pointer into the value, used in the error message.
 * @throws `REMOTE_VALUE_NOT_JSON` when the value (or a nested member) is not lossless JSON.
 */
export function assertRemoteSafeJsonValue(value, path = '$') {
    if (value === null)
        return;
    switch (typeof value) {
        case 'boolean':
        case 'string':
            return;
        case 'number':
            if (Number.isFinite(value))
                return;
            throw teamContractError('REMOTE_VALUE_NOT_JSON', `non-finite number at ${path}`, { path, problem: 'non-finite number' });
        case 'object': {
            if (Array.isArray(value)) {
                value.forEach((item, index) => assertRemoteSafeJsonValue(item, `${path}[${index}]`));
                return;
            }
            if (!isPlainObject(value)) {
                throw teamContractError('REMOTE_VALUE_NOT_JSON', `non-plain object at ${path} (class instances, Date, Map/Set are not lossless JSON)`, { path, problem: 'non-plain object' });
            }
            for (const [key, item] of Object.entries(value)) {
                assertRemoteSafeJsonValue(item, `${path}.${key}`);
            }
            return;
        }
        default:
            throw teamContractError('REMOTE_VALUE_NOT_JSON', `value of type ${typeof value} at ${path} is not lossless JSON`, { path, problem: `type ${typeof value}` });
    }
}
/**
 * Coerce an arbitrary unknown into a lossless-JSON value for error
 * `details` records: primitives pass through (non-finite numbers become
 * their string tag), arrays/records are deep-coerced, and anything else
 * (functions, undefined, class instances) becomes a `<type>` tag string.
 * Never throws.
 * @param value - the unknown value to coerce.
 * @returns a lossless-JSON representation of it.
 */
export function toRemoteSafeDetail(value) {
    if (value === null || typeof value === 'boolean' || typeof value === 'string') {
        return value;
    }
    if (typeof value === 'number')
        return Number.isFinite(value) ? value : String(value);
    if (typeof value === 'object') {
        if (Array.isArray(value))
            return value.map((item) => toRemoteSafeDetail(item));
        if (isPlainObject(value)) {
            const record = {};
            for (const [key, item] of Object.entries(value)) {
                record[key] = toRemoteSafeDetail(item);
            }
            return record;
        }
    }
    return `<${typeof value}>`;
}
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
export function canonicalJsonStringify(value) {
    assertRemoteSafeJsonValue(value);
    return canonical(value);
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
 * Recursively freeze a lossless-JSON value and return it. Used to make
 * parsed contract values immutable snapshots (Architecture §5.6/§8.4:
 * blueprint snapshots and records are immutable).
 * @param value - a lossless-JSON value (interfaces without an index
 *   signature are accepted; the runtime check is authoritative).
 * @returns the same value, deeply frozen.
 * @throws `REMOTE_VALUE_NOT_JSON` when the value is not lossless JSON.
 */
export function deepFreeze(value) {
    assertRemoteSafeJsonValue(value);
    freezeDeep(value);
    return value;
}
function freezeDeep(value) {
    if (value === null || typeof value !== 'object')
        return;
    for (const item of Array.isArray(value) ? value : Object.values(value)) {
        freezeDeep(item);
    }
    Object.freeze(value);
}
//# sourceMappingURL=remote-safe.js.map