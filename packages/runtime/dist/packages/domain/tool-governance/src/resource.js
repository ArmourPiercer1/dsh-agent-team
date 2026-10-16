/**
 * `ResourceRef` — the one resource identity of the Alpha.5 governance planes
 * (design §4.2: `ResourceRef = {realmId, kind, canonicalLocator, rights}`).
 *
 * WHY `kind` EXISTS (design §3/§4.2, plan §3: "不预先将实体对象简化为无安全
 * 含义的字符串"): a real workspace path, a Realm Home (`~/`) path, an OS
 * absolute path, a directory scope, a metadata view and a network destination
 * have DIFFERENT security meanings even when two of them happen to print the
 * same characters. Collapsing them into one string would let a workspace
 * grant reach a Realm Home file, or a file grant authorize a listing. The
 * `kind` + `rights` pair is therefore a CLOSED MATRIX, not a hint.
 *
 * REALM RULES (design §1 architecture invariant, S0 matrix §3): `realmId`
 * participates in every identity and every fingerprint. Two resources with
 * the same locator in different Realms are NEVER the same resource, never
 * authorize each other, and never narrow each other.
 *
 * LOCATOR RULES (design §3.1 "文件对象身份"): relative paths are fixed to the
 * immutable Workspace; `~/` belongs to the execution Realm Home; relative `..`
 * is refused; LEGAL leading/trailing whitespace is PRESERVED (no trimming —
 * `trim()` would rename a file); a filesystem locator never wears a URI
 * scheme, and a destination never looks like a path.
 *
 * Purity: no `node:*`, no I/O — canonicalization to a `canonicalLocator` is
 * the injected provider's job (Alpha.4 A2-3: domain manufactures no canonical
 * key); this module only VALIDATES what a provider produced.
 *
 * @module @dsh-agent-team/domain/tool-governance/resource
 */
import { closeRecordKeys, deepFreezeContracts, finish, isRecord, reqString, } from './parse-util.js';
/** The closed resource kinds (design §4.2, verbatim distinctions). */
export const RESOURCE_KINDS = [
    'workspace',
    'realm-home',
    'absolute-path',
    'directory',
    'metadata',
    'network-destination',
];
/** The closed rights vocabulary. */
export const RESOURCE_RIGHTS = ['read', 'write', 'list', 'meta', 'connect'];
/**
 * The kind ↔ rights matrix: which rights a kind can carry AT ALL. `list`
 * belongs to directories, `connect` to network destinations, `metadata` only
 * ever carries `meta`. A right outside the matrix is a typed refusal, never a
 * silently inert entry.
 */
export const RESOURCE_RIGHT_MATRIX = Object.freeze({
    workspace: Object.freeze(['read', 'write', 'meta']),
    'realm-home': Object.freeze(['read', 'write', 'meta']),
    'absolute-path': Object.freeze(['read', 'write', 'meta']),
    directory: Object.freeze(['read', 'write', 'list', 'meta']),
    metadata: Object.freeze(['meta']),
    'network-destination': Object.freeze(['connect']),
});
/** Split a locator into path segments for the `..` walk (both separators). */
function segmentsOf(locator) {
    return locator.split(/[\\/]/);
}
function validateLocator(kind, locator, path, problems) {
    if (locator.trim().length === 0) {
        problems.push({ code: 'locator-rejected', path, detail: 'a canonical locator must not be blank' });
        return;
    }
    if (kind === 'network-destination') {
        if (!/^[a-z][a-z0-9+.-]*:\/\/[^/\s]+$/.test(locator)) {
            problems.push({
                code: 'locator-rejected',
                path,
                detail: 'a network destination is `scheme://host[:port]` with no path (and a filesystem locator never wears a URI scheme)',
            });
        }
        return;
    }
    if (locator.includes('://')) {
        problems.push({ code: 'locator-rejected', path, detail: 'a filesystem locator never wears a URI scheme' });
        return;
    }
    // Filesystem kinds: relative `..` is refused on every one of them (design
    // §3.1: 拒绝相对 `..`). Legal leading/trailing spaces survive (never trimmed).
    if (segmentsOf(locator).includes('..')) {
        problems.push({ code: 'locator-rejected', path, detail: 'relative `..` segments are refused' });
        return;
    }
    const isAbsolutePosix = locator.startsWith('/');
    const isAbsoluteWindows = /^[A-Za-z]:[\\/]/.test(locator);
    const isHome = locator.startsWith('~/');
    if (kind === 'workspace' && (isAbsolutePosix || isAbsoluteWindows || isHome || locator.startsWith('\\'))) {
        problems.push({ code: 'locator-rejected', path, detail: 'a workspace locator is relative to the immutable workspace root' });
    }
    if (kind === 'realm-home' && !isHome) {
        problems.push({ code: 'locator-rejected', path, detail: 'a realm-home locator wears the `~/` prefix of the execution Realm Home' });
    }
    if (kind === 'absolute-path' && !(isAbsolutePosix || isAbsoluteWindows)) {
        problems.push({ code: 'locator-rejected', path, detail: 'an absolute-path locator is an OS absolute path' });
    }
}
function parseRights(raw, kind, path, problems) {
    if (!Array.isArray(raw)) {
        problems.push({ code: 'field-type', path, detail: '`rights` must be an array of right names' });
        return undefined;
    }
    const seen = new Set();
    for (const item of raw) {
        if (typeof item !== 'string') {
            problems.push({ code: 'field-type', path, detail: 'every right must be a plain right name (strings only)' });
            continue;
        }
        if (!RESOURCE_RIGHTS.includes(item)) {
            problems.push({ code: 'value-outside-closed-set', path, detail: `right must be one of ${RESOURCE_RIGHTS.join(' | ')}` });
            continue;
        }
        seen.add(item);
    }
    if (problems.some((p) => p.path === path && (p.code === 'value-outside-closed-set' || p.code === 'field-type'))) {
        return undefined;
    }
    const allowed = RESOURCE_RIGHT_MATRIX[kind];
    for (const right of seen) {
        if (!allowed.includes(right)) {
            problems.push({ code: 'rights-matrix', path, detail: `kind '${kind}' never carries the right '${right}'` });
        }
    }
    if (seen.size === 0) {
        problems.push({ code: 'rights-matrix', path, detail: 'a resource reference carries at least one right' });
        return undefined;
    }
    // Canonical order: the declaration order of RESOURCE_RIGHTS, never insertion.
    return RESOURCE_RIGHTS.filter((right) => seen.has(right));
}
/**
 * Strictly parse one raw value into a canonical, deep-frozen `ResourceRef`:
 * closed fields, closed kind, closed rights, the kind↔rights matrix, the
 * locator rules. Rights arrive normalized (canonical order, deduplicated).
 */
export function parseResourceRef(raw) {
    const problems = [];
    if (!isRecord(raw)) {
        return { ok: false, problems: [{ code: 'not-a-record', path: '$', detail: 'a ResourceRef must be a record' }] };
    }
    closeRecordKeys(raw, ['realmId', 'kind', 'canonicalLocator', 'rights'], '$', problems);
    const realmId = reqString(raw, 'realmId', '$', problems);
    const kind = raw['kind'];
    let parsedKind;
    if (typeof kind !== 'string' || !RESOURCE_KINDS.includes(kind)) {
        problems.push({ code: 'value-outside-closed-set', path: '$.kind', detail: `kind must be one of ${RESOURCE_KINDS.join(' | ')}` });
    }
    else {
        parsedKind = kind;
    }
    const locatorRaw = raw['canonicalLocator'];
    let locator;
    if (typeof locatorRaw !== 'string') {
        problems.push({ code: 'field-type', path: '$.canonicalLocator', detail: '`canonicalLocator` must be a string (never trimmed, never rewritten)' });
    }
    else {
        locator = locatorRaw;
    }
    const rights = parsedKind === undefined
        ? undefined
        : parseRights(raw['rights'], parsedKind, '$.rights', problems);
    if (parsedKind !== undefined && locator !== undefined) {
        validateLocator(parsedKind, locator, '$.canonicalLocator', problems);
    }
    return finish(problems, () => {
        const value = {
            realmId: realmId,
            kind: parsedKind,
            canonicalLocator: locator,
            rights: rights,
        };
        return deepFreezeContracts(value);
    });
}
/** The canonical identity of one resource: realm FIRST (never confusable). */
export function resourceIdentityKey(ref) {
    return JSON.stringify([ref.realmId, ref.kind, ref.canonicalLocator, [...ref.rights].sort()]);
}
/** Realm-aware resource equality (identity, not string equality). */
export function resourceEquals(a, b) {
    return resourceIdentityKey(a) === resourceIdentityKey(b);
}
//# sourceMappingURL=resource.js.map