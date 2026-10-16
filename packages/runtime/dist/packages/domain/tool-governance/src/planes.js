/**
 * The tool-policy PLANE evaluations (plan §3: deny/ask/allow evaluation with
 * REUSED Alpha.4 rank semantics, and the dual-plane no-match difference).
 *
 * THE REUSE CONTRACT (this is the whole file's reason to exist):
 *
 *  - the rank table, the total meet lattice, the matching walk and BOTH
 *    no-match arms are owned by `domain/authority-envelope` (ADR A3-9: the
 *    one shared grammar; A1-4: the two planes). This module ADDS EXACTLY ONE
 *    dimension Alpha.4's grammar cannot express — the Realm (S0 matrix §3:
 *    Realms never confuse each other) — by SCOPING: rules of another Realm
 *    are incomparable to this scope (they match nothing, so they neither
 *    authorize on the expansion plane nor narrow on the approval plane —
 *    which is precisely the shared law applied per Realm), then the
 *    realm-filtered rules go through the SHARED walk verbatim. No second
 *    lattice, no second rank table, no restated absence semantics.
 *  - the test `a5p0-planes` pins (a) `EFFECT_RANK` is the SAME frozen object
 *    the Alpha.4 kernel aliases (`toBe`), and (b) rule-for-rule equality of
 *    both planes against `authority-envelope` itself.
 *
 * Purity: no `node:*`, no I/O; containment stays an injected predicate
 * (Alpha.4 law: domain manufactures no canonical keys and judges no FS).
 *
 * @module @dsh-agent-team/domain/tool-governance/planes
 */
import { AUTHORITY_EFFECT_PRECEDENCE, effectiveAuthorityCeiling, narrowingForApproval, } from '../../authority-envelope/src/index.js';
import { EFFECT_KINDS } from './effects.js';
import { closeRecordKeys, finish, isRecord, reqString, } from './parse-util.js';
/** THE rank semantics of this lane — the Alpha.4 frozen object, by identity. */
export const EFFECT_RANK = AUTHORITY_EFFECT_PRECEDENCE;
/**
 * Strictly parse a raw policy document (closed rules; closed effect kinds;
 * closed `deny | ask | allow`; matchers from the Alpha.4 runtime family —
 * there is no `any`, ever).
 */
export function parseToolPolicyDocument(raw) {
    const problems = [];
    if (!isRecord(raw)) {
        return { ok: false, problems: [{ code: 'not-a-record', path: '$', detail: 'a ToolPolicyDocument must be a record { rules }' }] };
    }
    closeRecordKeys(raw, ['rules'], '$', problems);
    const rulesRaw = raw['rules'];
    const rules = [];
    if (!Array.isArray(rulesRaw)) {
        problems.push({ code: 'field-type', path: '$.rules', detail: '`rules` must be an array (possibly empty)' });
    }
    else {
        rulesRaw.forEach((item, index) => {
            const path = `$.rules[${index}]`;
            if (!isRecord(item)) {
                problems.push({ code: 'not-a-record', path, detail: 'a rule must be a record' });
                return;
            }
            closeRecordKeys(item, ['realmId', 'effectKind', 'matcher', 'maximumEffect'], path, problems);
            const realmId = reqString(item, 'realmId', path, problems);
            const effectKindRaw = item['effectKind'];
            if (typeof effectKindRaw !== 'string' || !EFFECT_KINDS.includes(effectKindRaw)) {
                problems.push({ code: 'value-outside-closed-set', path: `${path}.effectKind`, detail: `effectKind must be one of ${EFFECT_KINDS.join(' | ')}` });
            }
            const matcherRaw = item['matcher'];
            let matcher;
            if (isRecord(matcherRaw)) {
                closeRecordKeys(matcherRaw, ['kind', 'resource'], `${path}.matcher`, problems);
                const kind = matcherRaw['kind'];
                const resource = matcherRaw['resource'];
                if (kind !== 'exact' && kind !== 'subtree' && kind !== 'fingerprint') {
                    problems.push({ code: 'value-outside-closed-set', path: `${path}.matcher.kind`, detail: "matcher kind must be 'exact' | 'subtree' | 'fingerprint' (no 'any')" });
                }
                else if (typeof resource !== 'string' || resource.length === 0) {
                    problems.push({ code: 'field-type', path: `${path}.matcher.resource`, detail: 'matcher.resource must be a non-empty canonical locator' });
                }
                else {
                    matcher = { kind, resource };
                }
            }
            else {
                problems.push({ code: 'not-a-record', path: `${path}.matcher`, detail: 'matcher must be a record { kind, resource }' });
            }
            const maximumEffectRaw = item['maximumEffect'];
            if (maximumEffectRaw !== 'deny' && maximumEffectRaw !== 'ask' && maximumEffectRaw !== 'allow') {
                problems.push({ code: 'value-outside-closed-set', path: `${path}.maximumEffect`, detail: 'maximumEffect must be deny | ask | allow' });
            }
            if (realmId !== undefined && typeof effectKindRaw === 'string' && matcher !== undefined && (maximumEffectRaw === 'deny' || maximumEffectRaw === 'ask' || maximumEffectRaw === 'allow')) {
                rules.push({ realmId, effectKind: effectKindRaw, matcher, maximumEffect: maximumEffectRaw });
            }
        });
    }
    return finish(problems, () => ({ rules }));
}
/** Realm-scope the document, then hand the shared Alpha.4 walk its own shape. */
function envelopeForRealm(document, realmId) {
    return {
        rules: document.rules
            .filter((rule) => rule.realmId === realmId)
            .map((rule) => ({ operationClass: rule.effectKind, matcher: rule.matcher, maximumEffect: rule.maximumEffect })),
    };
}
/**
 * The EXPANSION plane (design §4.2, A1-4 strict reading): "does this document
 * AUTHORIZE it?" — no matching rule in this Realm ⇒ `no-authority`; the
 * absence of an authorization is NEVER an implicit permission.
 */
export function evaluateToolPolicyExpansionAuthority(document, scope, subtreeContains) {
    return effectiveAuthorityCeiling(envelopeForRealm(document, scope.realmId), scope.effectKind, scope.matcher, subtreeContains);
}
/**
 * The APPROVAL plane's narrowing (design §4.2, A1-4): "does this document
 * RESTRICT it?" — no matching rule in this Realm ⇒ NO NARROWING, the meet
 * identity. Absence of a rule imposes nothing; the source of approval
 * authority stays the ladder plus the permission lanes. (Two independent
 * functions on purpose — folding them or `min()`-ing their results dead-locks
 * every approval over an empty document, the A1-4 rejected alternative.)
 */
export function evaluateToolPolicyApprovalNarrowing(document, scope, subtreeContains) {
    return narrowingForApproval(envelopeForRealm(document, scope.realmId), { operationClass: scope.effectKind, matcher: scope.matcher }, subtreeContains);
}
//# sourceMappingURL=planes.js.map