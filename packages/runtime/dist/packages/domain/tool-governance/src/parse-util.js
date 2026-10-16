/**
 * Strict-parse utilities for the Alpha.5 PR0 tool-governance lane.
 *
 * THE PARSE LAW (plan §3, mirroring `domain/authority-envelope`'s parser
 * discipline): every raw structure is validated against a CLOSED shape — an
 * unknown extra field is a typed refusal (`unknown-field`), never a silent
 * drop. Problems are COLLECTED, not short-circuited: a reviewer reading one
 * refusal sees every defect of that document, and a test can pin the exact
 * code of each. Partial acceptance never happens.
 *
 * Purity: no `node:*`, no I/O, no clock.
 *
 * @module @dsh-agent-team/domain/tool-governance/parse-util
 */
/** The closed set of structural problem codes this lane reports. */
export const TOOL_CONTRACT_PROBLEM_CODES = [
    'not-a-record',
    'unknown-field',
    'missing-field',
    'field-type',
    'value-outside-closed-set',
    'empty-string',
    'locator-rejected',
    'rights-matrix',
    'effect-resource-mismatch',
    'not-canonical',
    'fingerprint-mismatch',
    'state-transition',
    'lease-terminal',
    'lease-extends-grant',
    'contradiction',
    'canonical-value-not-json',
];
/** Extract the codes of a failed result (test helper, exported for pins). */
export function problemCodesOf(result) {
    if (result.ok || result.problems === undefined)
        return [];
    return result.problems.map((problem) => problem.code);
}
/** True for a non-null, non-array object. */
export function isRecord(value) {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}
/** Report every key outside the closed allow-list (`unknown-field`). */
export function closeRecordKeys(record, allowed, path, problems) {
    for (const key of Object.keys(record)) {
        if (!allowed.includes(key)) {
            problems.push({ code: 'unknown-field', path: `${path}.${key}`, detail: `field '${key}' is outside the closed shape` });
        }
    }
}
/** A required non-empty string field (present-but-null counts as absent). */
export function reqString(record, key, path, problems) {
    const raw = record[key];
    if (raw === undefined || raw === null) {
        problems.push({ code: 'missing-field', path: `${path}.${key}`, detail: `\`${key}\` is required` });
        return undefined;
    }
    if (typeof raw !== 'string') {
        problems.push({ code: 'field-type', path: `${path}.${key}`, detail: `\`${key}\` must be a string` });
        return undefined;
    }
    if (raw.length === 0) {
        problems.push({ code: 'empty-string', path: `${path}.${key}`, detail: `\`${key}\` must be non-empty` });
        return undefined;
    }
    return raw;
}
/** A required non-negative safe integer. */
export function reqNonNegativeInt(record, key, path, problems) {
    const raw = record[key];
    if (raw === undefined) {
        problems.push({ code: 'missing-field', path: `${path}.${key}`, detail: `\`${key}\` is required` });
        return undefined;
    }
    if (typeof raw !== 'number' || !Number.isSafeInteger(raw) || raw < 0) {
        problems.push({ code: 'field-type', path: `${path}.${key}`, detail: `\`${key}\` must be a non-negative integer` });
        return undefined;
    }
    return raw;
}
/** A value from a closed enumeration (wrong value → `value-outside-closed-set`). */
export function closedValue(record, key, values, path, problems) {
    const raw = record[key];
    if (raw === undefined) {
        problems.push({ code: 'missing-field', path: `${path}.${key}`, detail: `\`${key}\` is required` });
        return undefined;
    }
    if (typeof raw !== 'string' || !values.includes(raw)) {
        problems.push({ code: 'value-outside-closed-set', path: `${path}.${key}`, detail: `\`${key}\` must be one of ${values.join(' | ')}` });
        return undefined;
    }
    return raw;
}
/** A `sha256:<hex>` fingerprint tag (shape only — the value is opaque here). */
export function reqFingerprint(record, key, path, problems) {
    const raw = reqString(record, key, path, problems);
    if (raw === undefined)
        return undefined;
    if (!/^sha256:[0-9a-f]+$/.test(raw)) {
        problems.push({ code: 'field-type', path: `${path}.${key}`, detail: `\`${key}\` must be a 'sha256:<hex>' fingerprint` });
        return undefined;
    }
    return raw;
}
/** Finish a parse: refusal with the collected problems, or the frozen value. */
export function finish(problems, value) {
    if (problems.length > 0)
        return { ok: false, problems };
    return { ok: true, value: deepFreezeContracts(value()) };
}
/** Recursively freeze a plain value and return it (immutable snapshots). */
export function deepFreezeContracts(value) {
    if (value === null || typeof value !== 'object')
        return value;
    for (const item of Array.isArray(value) ? value : Object.values(value)) {
        deepFreezeContracts(item);
    }
    Object.freeze(value);
    return value;
}
//# sourceMappingURL=parse-util.js.map