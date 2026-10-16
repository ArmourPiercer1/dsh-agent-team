/**
 * `RequestedEffectSet` — the immutable canonical effect set with its
 * Fingerprint (design §4.2: "不可变 canonical effects，包含 tool invoke、
 * read/write/list/meta/connect/Domain reference，具有 Fingerprint").
 *
 * THE LAWS ENCODED HERE (plan §3):
 *
 *  1. DEDUPLICATION + ORDER NORMALIZATION (复合 Effect 去重顺序): a set is a
 *     SET. `[x, y]` and `[y, x]` — and `[x, x, y]` — canonicalize to the same
 *     sorted, deduplicated list and therefore to the same fingerprint.
 *  2. REALM NON-CONFUSION: `realmId` lives inside every effect's resource, so
 *     it participates in the identity key and in the fingerprint; a realm-A
 *     effect is never a subset of a realm-B grant.
 *  3. NOTHING HIDDEN: every arm is a CLOSED record; an effect cannot smuggle
 *     an un-counted parameter (the A2C-5 fingerprint law, at the effect tier).
 *  4. CANONICAL ON PERSISTENCE: a claimed-canonical set re-verifies its
 *     fingerprint (a tampered or drifted set is refused, `fingerprint-mismatch`).
 *  5. EFFECT ↔ RESOURCE COUPLING: `list` binds a directory, `connect` binds a
 *     network destination, `read` never binds a metadata-only view — the
 *     effect kind and the resource kind/rights are checked AGAINST EACH OTHER.
 *
 * The approval law this set serves (design §4.2): a multi-effect Team-side
 * Ask is ONE immutable set; the approver legally covers ALL effects or none.
 *
 * Purity: no `node:*`, no I/O, no clock.
 *
 * @module @dsh-agent-team/domain/tool-governance/effects
 */
import { canonicalJsonFingerprint, canonicalJsonStringify } from './canonical-json.js';
import { closeRecordKeys, deepFreezeContracts, finish, isRecord, reqString, } from './parse-util.js';
import { parseResourceRef } from './resource.js';
/** The closed effect kinds (design §4.2, verbatim). */
export const EFFECT_KINDS = ['tool-invoke', 'read', 'write', 'list', 'meta', 'connect', 'domain-ref'];
/** The effect kind → required resource right law (tool-invoke/domain-ref act on their own arms). */
export const EFFECT_REQUIRED_RIGHT = Object.freeze({
    read: 'read',
    write: 'write',
    list: 'list',
    meta: 'meta',
    connect: 'connect',
});
function parseEffect(raw, path, problems) {
    if (!isRecord(raw)) {
        problems.push({ code: 'not-a-record', path, detail: 'an effect must be a record' });
        return undefined;
    }
    const kindRaw = raw['kind'];
    if (typeof kindRaw !== 'string' || !EFFECT_KINDS.includes(kindRaw)) {
        problems.push({ code: 'value-outside-closed-set', path: `${path}.kind`, detail: `effect kind must be one of ${EFFECT_KINDS.join(' | ')}` });
        return undefined;
    }
    const kind = kindRaw;
    if (kind === 'tool-invoke') {
        closeRecordKeys(raw, ['kind', 'toolName', 'resource'], path, problems);
        const toolName = reqString(raw, 'toolName', path, problems);
        if (raw['resource'] !== null) {
            problems.push({ code: 'field-type', path: `${path}.resource`, detail: 'a tool-invoke effect carries no resource' });
        }
        if (toolName === undefined)
            return undefined;
        return deepFreezeContracts({ kind, toolName, resource: null });
    }
    if (kind === 'domain-ref') {
        closeRecordKeys(raw, ['kind', 'domainAuthorityId', 'resource'], path, problems);
        const domainAuthorityId = reqString(raw, 'domainAuthorityId', path, problems);
        if (raw['resource'] !== null) {
            problems.push({ code: 'field-type', path: `${path}.resource`, detail: 'a domain-ref effect carries no ResourceRef — the Domain Authority is its own identity' });
        }
        if (domainAuthorityId === undefined)
            return undefined;
        return deepFreezeContracts({ kind, domainAuthorityId, resource: null });
    }
    closeRecordKeys(raw, ['kind', 'resource'], path, problems);
    const parsedResource = parseResourceRef(raw['resource']);
    if (!parsedResource.ok) {
        problems.push(...parsedResource.problems.map((p) => ({ ...p, path: `${path}.resource${p.path === '$' ? '' : p.path.slice(1)}` })));
        return undefined;
    }
    const resource = parsedResource.value;
    const requiredRight = EFFECT_REQUIRED_RIGHT[kind];
    if (requiredRight !== undefined && !resource.rights.includes(requiredRight)) {
        problems.push({ code: 'effect-resource-mismatch', path: `${path}.resource`, detail: `effect '${kind}' requires the '${requiredRight}' right on its resource` });
    }
    if (kind === 'list' && resource.kind !== 'directory') {
        problems.push({ code: 'effect-resource-mismatch', path: `${path}.resource`, detail: "`list` binds a directory resource" });
    }
    if (kind === 'connect' && resource.kind !== 'network-destination') {
        problems.push({ code: 'effect-resource-mismatch', path: `${path}.resource`, detail: '`connect` binds a network destination' });
    }
    return deepFreezeContracts({ kind, resource });
}
/** The canonical deduplication key of one effect (realm first inside the resource). */
export function effectIdentityKey(effect) {
    return canonicalJsonStringify(effect);
}
function canonicalize(effects) {
    const byKey = new Map();
    for (const effect of effects)
        byKey.set(effectIdentityKey(effect), effect);
    const sorted = [...byKey.entries()].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)).map(([, effect]) => effect);
    const fingerprint = canonicalJsonFingerprint(sorted);
    return deepFreezeContracts({ effects: sorted, fingerprint });
}
/** Is every requested effect inside the granted set (identity, not length)? */
export function effectsAreSubset(requested, granted) {
    const keys = new Set(granted.effects.map(effectIdentityKey));
    return requested.effects.every((effect) => keys.has(effectIdentityKey(effect)));
}
/**
 * Strictly parse a raw value into a canonical `RequestedEffectSet`.
 *
 * - a RAW ARRAY canonicalizes (parse → dedup → sort → fingerprint);
 * - a CLAIMED SET (`{ effects, fingerprint }`) must ALREADY be canonical:
 *   sorted, deduplicated, and re-hashing to its own fingerprint, or the parse
 *   refuses (`not-canonical` / `fingerprint-mismatch`).
 * An empty set is not a legal request (`not-canonical`).
 */
export function parseRequestedEffectSet(raw) {
    const problems = [];
    const claimed = !Array.isArray(raw) && isRecord(raw);
    const list = Array.isArray(raw)
        ? raw
        : isRecord(raw)
            ? Array.isArray(raw['effects'])
                ? raw['effects']
                : undefined
            : undefined;
    if (list === undefined) {
        return {
            ok: false,
            problems: [{ code: 'not-a-record', path: '$', detail: 'an effect set is an array or a canonical { effects, fingerprint } record' }],
        };
    }
    if (claimed && isRecord(raw)) {
        closeRecordKeys(raw, ['effects', 'fingerprint'], '$', problems);
    }
    if (list.length === 0) {
        problems.push({ code: 'not-canonical', path: '$', detail: 'an empty effect set is not a request' });
    }
    const parsed = [];
    for (const [index, item] of list.entries()) {
        const effect = parseEffect(item, `$[${index}]`, problems);
        if (effect !== undefined)
            parsed.push(effect);
    }
    if (claimed && isRecord(raw)) {
        // Canonical-form demands on a claimed set: sorted, deduplicated, exact fingerprint.
        const keys = parsed.map(effectIdentityKey);
        for (let i = 1; i < keys.length; i += 1) {
            if (keys[i - 1] >= keys[i]) {
                problems.push({ code: 'not-canonical', path: '$.effects', detail: 'a claimed set must arrive sorted and deduplicated' });
                break;
            }
        }
        const claimedFingerprintRaw = raw['fingerprint'];
        if (claimedFingerprintRaw === undefined || claimedFingerprintRaw === null) {
            // A claimed set without a digest attestation is NOT a canonicalized
            // array wearing a wrapper: the claimed arm exists to RE-VERIFY, and
            // silently re-canonicalizing here would mint a fingerprint the claimant
            // never asserted (review finding @ 3f8cfff8).
            problems.push({ code: 'missing-field', path: '$.fingerprint', detail: 'a claimed effect set must carry its own `fingerprint` — only the raw-array arm canonicalizes' });
        }
        else if (typeof claimedFingerprintRaw !== 'string') {
            problems.push({ code: 'field-type', path: '$.fingerprint', detail: 'a fingerprint must be a `sha256:<hex>` string' });
        }
        else if (parsed.length === list.length) {
            const recomputed = canonicalize(parsed);
            if (recomputed.fingerprint !== claimedFingerprintRaw) {
                problems.push({ code: 'fingerprint-mismatch', path: '$.fingerprint', detail: 'the claimed fingerprint is not the canonical digest of these effects' });
            }
        }
    }
    return finish(problems, () => canonicalize(parsed));
}
//# sourceMappingURL=effects.js.map