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
import { type ParseResult } from './parse-util.js';
import { type ResourceRef, type ResourceRight } from './resource.js';
/** The closed effect kinds (design §4.2, verbatim). */
export declare const EFFECT_KINDS: readonly ["tool-invoke", "read", "write", "list", "meta", "connect", "domain-ref"];
/** One effect kind. */
export type EffectKind = (typeof EFFECT_KINDS)[number];
/** The effect kind → required resource right law (tool-invoke/domain-ref act on their own arms). */
export declare const EFFECT_REQUIRED_RIGHT: Readonly<Partial<Record<EffectKind, ResourceRight>>>;
/** One tool invocation (the tool itself is an effect, design §4.2). */
export interface ToolInvokeEffect {
    readonly kind: 'tool-invoke';
    readonly toolName: string;
    readonly resource: null;
}
/** One I/O effect over a resource. */
export interface ResourceEffect {
    readonly kind: 'read' | 'write' | 'list' | 'meta' | 'connect';
    readonly resource: ResourceRef;
}
/** One Domain-reference effect (the Domain Authority decides at commit). */
export interface DomainRefEffect {
    readonly kind: 'domain-ref';
    readonly domainAuthorityId: string;
    readonly resource: null;
}
/** One effect of the set. */
export type Effect = ToolInvokeEffect | ResourceEffect | DomainRefEffect;
/** The immutable, canonical, fingerprinted effect set. */
export interface RequestedEffectSet {
    readonly effects: readonly Effect[];
    readonly fingerprint: string;
}
/** The canonical deduplication key of one effect (realm first inside the resource). */
export declare function effectIdentityKey(effect: Effect): string;
/** Is every requested effect inside the granted set (identity, not length)? */
export declare function effectsAreSubset(requested: RequestedEffectSet, granted: RequestedEffectSet): boolean;
/**
 * Strictly parse a raw value into a canonical `RequestedEffectSet`.
 *
 * - a RAW ARRAY canonicalizes (parse → dedup → sort → fingerprint);
 * - a CLAIMED SET (`{ effects, fingerprint }`) must ALREADY be canonical:
 *   sorted, deduplicated, and re-hashing to its own fingerprint, or the parse
 *   refuses (`not-canonical` / `fingerprint-mismatch`).
 * An empty set is not a legal request (`not-canonical`).
 */
export declare function parseRequestedEffectSet(raw: unknown): ParseResult<RequestedEffectSet>;
//# sourceMappingURL=effects.d.ts.map