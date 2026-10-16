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
import type { AuthorityEffect, AuthorityResourceMatcher, EffectiveCeiling, SubtreeContains } from '../../authority-envelope/src/index.js';
import { type EffectKind } from './effects.js';
import { type ParseResult } from './parse-util.js';
/** THE rank semantics of this lane — the Alpha.4 frozen object, by identity. */
export declare const EFFECT_RANK: Readonly<{
    readonly deny: 0;
    readonly ask: 1;
    readonly allow: 2;
}>;
/** A policy matcher over canonical locators (the Alpha.4 runtime matcher shape). */
export type ToolPolicyMatcher = AuthorityResourceMatcher;
/** One realm-scoped tool-policy rule (runtime shape; documents are built by PR2). */
export interface ToolPolicyRule {
    readonly realmId: string;
    readonly effectKind: EffectKind;
    readonly matcher: ToolPolicyMatcher;
    readonly maximumEffect: AuthorityEffect;
}
/** One realm-scoped tool-policy document. */
export interface ToolPolicyDocument {
    readonly rules: readonly ToolPolicyRule[];
}
/** The scope a policy question is asked about. */
export interface ToolPolicyScope {
    readonly realmId: string;
    readonly effectKind: EffectKind;
    readonly matcher: ToolPolicyMatcher;
}
/** The shared ceiling lattice — the SAME type Alpha.4 evaluates into. */
export type ToolPolicyCeiling = EffectiveCeiling;
/**
 * Strictly parse a raw policy document (closed rules; closed effect kinds;
 * closed `deny | ask | allow`; matchers from the Alpha.4 runtime family —
 * there is no `any`, ever).
 */
export declare function parseToolPolicyDocument(raw: unknown): ParseResult<ToolPolicyDocument>;
/**
 * The EXPANSION plane (design §4.2, A1-4 strict reading): "does this document
 * AUTHORIZE it?" — no matching rule in this Realm ⇒ `no-authority`; the
 * absence of an authorization is NEVER an implicit permission.
 */
export declare function evaluateToolPolicyExpansionAuthority(document: ToolPolicyDocument, scope: ToolPolicyScope, subtreeContains?: SubtreeContains): ToolPolicyCeiling;
/**
 * The APPROVAL plane's narrowing (design §4.2, A1-4): "does this document
 * RESTRICT it?" — no matching rule in this Realm ⇒ NO NARROWING, the meet
 * identity. Absence of a rule imposes nothing; the source of approval
 * authority stays the ladder plus the permission lanes. (Two independent
 * functions on purpose — folding them or `min()`-ing their results dead-locks
 * every approval over an empty document, the A1-4 rejected alternative.)
 */
export declare function evaluateToolPolicyApprovalNarrowing(document: ToolPolicyDocument, scope: ToolPolicyScope, subtreeContains?: SubtreeContains): ToolPolicyCeiling;
//# sourceMappingURL=planes.d.ts.map