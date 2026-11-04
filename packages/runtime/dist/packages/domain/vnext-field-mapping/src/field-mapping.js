/**
 * field-mapping.ts — the Domain field-mapping CONSUMPTION SURFACE for
 * vNext (INTERFACES-v1 §C-VNEXT: 默认拒绝, 无隐式默认; the v3 production
 * document is not modified by this lane).
 *
 * THE LAW: this is a consumer, not a producer. It projects an incoming
 * document onto a DECLARED field map, and every field the map does not
 * cover is a typed REJECTION, not a silent drop:
 *
 *  - DEFAULT DENY. A source leaf path not named by the map ⇒
 *    `unmapped-source-field`, listing every offender. Silently dropping a
 *    field would let a producer smuggle a new field through a version bump.
 *  - NO IMPLICIT DEFAULTS. A map entry whose source path is absent from the
 *    document ⇒ `missing-source-field`. Nothing is filled in with `undefined`,
 *    `null`, `''`, or a zero — an absent fact stays absent, and absence is loud.
 *  - NO TARGET COLLISIONS. Two source paths writing one target ⇒ declared
 *    invalid at map-declaration time, not at projection time.
 *  - PURE + FROZEN. No I/O, no clock, no schema-version sniffing; the output
 *    is deep-frozen so a later consumer cannot launder a rejected field back in.
 *
 * Leaf-only flattening: arrays are leaves (element mapping is a separate
 * contract; treating an array as a leaf means the WHOLE array is one mapped
 * field, never silently per-element).
 *
 * @module @dsh-agent-team/domain/vnext-field-mapping/field-mapping
 */
const PATH_SEGMENT = /^[A-Za-z0-9_$][A-Za-z0-9_$-]*$/;
function isPlainObject(value) {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}
/** Flatten a document to leaf paths; arrays and scalars are leaves. */
function leafPaths(value, prefix, into) {
    if (isPlainObject(value)) {
        for (const key of Object.keys(value)) {
            leafPaths(value[key], [...prefix, key], into);
        }
        return;
    }
    into.set(prefix.join('.'), value);
}
/**
 * Declare a field map (source dotted path → target key). The map is closed
 * at declaration: duplicate targets, empty maps, and malformed paths are
 * refusals HERE, so a projection never has to guess what a broken map meant.
 */
export function declareFieldMapping(entries) {
    if (entries.length === 0) {
        return { ok: false, code: 'empty-map', detail: 'a field map with no entries accepts no document', fields: [] };
    }
    const map = new Map();
    const targets = new Map();
    const duplicateTargets = [];
    const invalidPaths = [];
    for (const entry of entries) {
        if (entry.sourcePath.length === 0 || entry.sourcePath.split('.').some((s) => !PATH_SEGMENT.test(s))) {
            invalidPaths.push(entry.sourcePath);
            continue;
        }
        if (targets.has(entry.targetKey)) {
            duplicateTargets.push(`${targets.get(entry.targetKey)} -> ${entry.targetKey}`);
            continue;
        }
        targets.set(entry.targetKey, entry.sourcePath);
        map.set(entry.sourcePath, entry.targetKey);
    }
    if (invalidPaths.length > 0) {
        return { ok: false, code: 'invalid-path', detail: 'malformed dotted path(s)', fields: invalidPaths };
    }
    if (duplicateTargets.length > 0) {
        return { ok: false, code: 'duplicate-target', detail: 'two sources would write one target', fields: duplicateTargets };
    }
    return { ok: true, map };
}
/**
 * Project one incoming document through a declared map, DEFAULT-DENY.
 * Exact cover is required both ways: every source leaf is mapped, and every
 * map source is present. Anything else is a typed refusal naming fields.
 */
export function projectThroughMap(map, document) {
    const leaves = new Map();
    leafPaths(document, [], leaves);
    const unmapped = [];
    for (const path of leaves.keys()) {
        if (!map.has(path))
            unmapped.push(path);
    }
    if (unmapped.length > 0) {
        unmapped.sort();
        return {
            ok: false,
            code: 'unmapped-source-field',
            detail: 'default deny: a field the map does not declare is not dropped, it is refused',
            fields: unmapped,
        };
    }
    const missing = [];
    for (const sourcePath of map.keys()) {
        if (!leaves.has(sourcePath))
            missing.push(sourcePath);
    }
    if (missing.length > 0) {
        missing.sort();
        return {
            ok: false,
            code: 'missing-source-field',
            detail: 'no implicit default: a declared field the document does not carry stays a refusal, not an undefined',
            fields: missing,
        };
    }
    const value = {};
    for (const [sourcePath, targetKey] of map) {
        value[targetKey] = structuredClone(leaves.get(sourcePath));
    }
    return { ok: true, value: deepFreeze(value) };
}
function deepFreeze(value) {
    if (value !== null && typeof value === 'object') {
        for (const inner of Object.values(value))
            deepFreeze(inner);
        Object.freeze(value);
    }
    return value;
}
//# sourceMappingURL=field-mapping.js.map