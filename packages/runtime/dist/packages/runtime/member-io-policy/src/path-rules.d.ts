/**
 * Alpha.5 P1-02/P1-03 — locator algebra for the two-axis policy.
 *
 * WHAT THIS MODULE DECIDES: whether one authored locator lies inside another
 * (subtree containment), and how two path rule sets intersect. It is PURE:
 * no filesystem, no provider, no clock, no normalization of the STORED
 * strings — matching canonicalizes into a comparison key and throws that key
 * away.
 *
 * WHY CONTAINMENT IS NEEDED EVEN IN P1-02: the plan's own example is a Member
 * ceiling `/work/a` narrowed by a tool lane `/work/a/docs`. Exact string
 * equality would erase that intersection (both sides "restricted" but with
 * different strings), i.e. it would silently DENY a legal call; and the
 * inverse mistake — a prefix match without a boundary — would let
 * `/work/a` cover `/work/ab`, silently widening a ceiling. Both are pinned.
 *
 * P1-03 OWNS THE REST: exact-vs-subtree authoring semantics are settled HERE
 * (an `allow` locator is a subtree root; `..` never folds; `/work/a` never
 * covers `/work/ab`), together with the "native write/edit requires read"
 * check. The controlled Provider's own path RESOLUTION / file identity
 * (symlinks, hardlink aliases) and the "unknown Provider capability => refuse"
 * law live in `provider-capabilities.ts`; this module deliberately does NOT
 * touch the filesystem, so it cannot decide aliases — it only decides segment
 * containment over authored strings (and over a Provider-resolved string, when
 * the caller passes one back in).
 *
 * @module @dsh-agent-team/runtime/member-io-policy/path-rules
 */
import type { PathRuleSet } from './types.js';
/** One comparison key: the path segments, plus whether it is absolute. */
export interface LocatorKey {
    readonly absolute: boolean;
    readonly segments: readonly string[];
}
/**
 * Canonicalize ONE authored locator into a comparison key.
 *
 * - separators `/` and `\` both separate segments (a Windows-authored locator
 *   must not become one giant segment);
 * - empty segments collapse (`/work//a` ≡ `/work/a`), and a trailing separator
 *   is dropped (`/work/a/` ≡ `/work/a`) FOR COMPARISON ONLY;
 * - `.` segments are dropped (`./out` ≡ `out`);
 * - `..` cannot occur (the v4 grammar refuses it at authoring time); if one
 *   appears here anyway, the key keeps it as a literal segment rather than
 *   folding it — folding would be a normalization the schema phase forbids.
 */
export declare function toLocatorKey(locator: string): LocatorKey;
/**
 * `parent` covers `child` iff every parent segment is a leading segment of the
 * child, with an ABSOLUTE/relative agreement and a real segment boundary:
 * `/work/a` covers `/work/a`, `/work/a/f`, `/work/a/`, but NOT `/work/ab`.
 * `/` (no segments) covers every absolute locator; a bare relative root covers
 * every relative locator.
 */
export declare function coversLocator(parent: string, child: string): boolean;
export declare function keyCovers(parent: LocatorKey, child: LocatorKey): boolean;
/**
 * Do two authored locators denote the same location? Equality is decided on the
 * COMPARISON KEY only, so `/work/a/`, `/work/a/.` and `/work/a` are equivalent
 * while `/work/a/../b` is NOT `/work/b` (`..` is never folded) and an absolute
 * locator is never equivalent to a relative one.
 */
export declare function locatorsEquivalent(left: string, right: string): boolean;
/** Does the lane allow this location (subtree-aware)? */
export declare function laneCoversAllow(lane: PathRuleSet, locator: string): boolean;
/** Does the lane deny this location (subtree-aware)? */
export declare function laneCoversDeny(lane: PathRuleSet, locator: string): boolean;
/** The closed per-lane disposition vocabulary for one authored locator. */
export type LaneLocatorDisposition = 'allow' | 'ask' | 'deny';
/**
 * Decide ONE authored locator against ONE lane.
 *
 * Precedence is strict and fail-closed: an explicit (subtree) deny wins, then
 * `ask` (never promoted to allow), then an `all` lane or a covering allow
 * locator. A locator covered by no allow locator is `deny` — absence of an
 * allow is never permission. This is still a PURE authored-string decision;
 * symlink/hardlink identity is resolved by `provider-capabilities.ts`.
 */
export declare function matchLocator(lane: PathRuleSet, locator: string): LaneLocatorDisposition;
/**
 * Intersect two ALLOW locator lists. A subtree union intersects by keeping the
 * NARROWER locator of each related pair, dropping unrelated pairs entirely:
 * `/work/a` ∩ `/work/a/docs` → `/work/a/docs`; `/work/a` ∩ `/work/c` → nothing.
 * A locator belonging to two disjoint subtrees is never synthesized.
 */
export declare function intersectAllowLocators(left: readonly string[], right: readonly string[]): readonly string[];
/**
 * The one two-axis path intersection:
 *   effective = memberCeiling ∩ toolRestriction
 * where a tool `all` lane is expressed by the caller as the Member lane itself
 * (`no-additional-narrowing` is resolved in `compile.ts`, which owns that
 * vocabulary). Both inputs are rule sets here.
 *
 * Disposition law (conservative, never widens):
 *  - mode is `all` only when BOTH lanes are `all`;
 *  - an `all` side is the IDENTITY of the intersection: it contributes no
 *    narrowing, so the other side's allow list is the effective allow list
 *    (treating `all` as `allow: []` would turn every "no Member narrowing"
 *    declaration into deny-everything);
 *  - otherwise allow keeps the narrower related subtree of each pair;
 *  - deny is the UNION (a deny on either axis survives);
 *  - `ask` is the STRICTER disposition: an ask survives if the OTHER lane
 *    permits that location, and it is never promoted to allow. Any surviving
 *    ask that is denied is dropped (deny wins).
 */
export declare function intersectPathRuleSets(member: PathRuleSet, tool: PathRuleSet): PathRuleSet;
/**
 * Normalize ONE authored (or already-projected) v4 lane into a frozen
 * `PathRuleSet`: `mode: 'all'` iff the lane says so, and the three locator
 * lists keep only string entries in authored order. There is ONE normalizer on
 * purpose — the compiler and the product-declaration reconciliation read lanes
 * through this function, so one authored lane can never acquire two meanings.
 */
export declare function toPathRuleSet(lane: unknown): PathRuleSet;
/**
 * Is `inner` a NARROWING of `outer` — i.e. does `inner` permit no location that
 * `outer` does not permit? Pure authored-string containment over the same
 * `coversLocator` relation the matcher uses (subtree-aware, `..` never folded),
 * fail-closed in the same precedence order as `matchLocator`:
 *
 *  - every `allow` locator of `inner` that `inner` itself does not deny must be
 *    (a) covered by an `allow` locator of `outer` (or by `outer.mode === 'all'`)
 *    and (b) NOT denied by `outer` — an outer deny would make `inner` wider
 *    exactly there;
 *  - an `inner` `all` lane permits everything outside its own deny list, so
 *    `outer` must also be `all` AND must deny nothing `inner` permits
 *    (`all` ⊄ `restricted`: a finite allow list is never the complement of a
 *    deny list);
 *  - `inner.deny` only narrows, so it needs no check; `ask` is never a
 *    permission (`matchLocator` never promotes it), and the intersection drops
 *    an ask that either side denies, so it needs no check either.
 *
 * This predicate only ANSWERS a question: it never rewrites, intersects or
 * widens a lane.
 */
export declare function laneWithinLane(inner: PathRuleSet, outer: PathRuleSet): boolean;
/**
 * Is `locator` inside a compiled rule set? The matcher P1-03 will extend with
 * Provider-resolved identity; this is the authored-string answer used by the
 * compiler's own tests and by denial diagnostics.
 */
export declare function locatorWithinRuleSet(lane: PathRuleSet, locator: string): boolean;
/** Closed refusal vocabulary for the native write/edit read prerequisite. */
export declare const WRITE_REQUIRES_READ_REFUSAL_CODES: readonly ["WRITE_TARGET_NOT_WRITABLE", "WRITE_REQUIRES_READ"];
export type WriteRequiresReadRefusalCode = (typeof WRITE_REQUIRES_READ_REFUSAL_CODES)[number];
export interface WriteRequiresReadAccepted {
    readonly ok: true;
    readonly value: {
        readonly locator: string;
        readonly read: PathRuleSet;
        readonly write: PathRuleSet;
    };
}
export interface WriteRequiresReadRefused {
    readonly ok: false;
    readonly code: WriteRequiresReadRefusalCode;
    readonly detail: string;
}
export type WriteRequiresReadResult = WriteRequiresReadAccepted | WriteRequiresReadRefused;
/**
 * Native `write`/`edit` must READ the target before rewriting it (the upstream
 * implementation reads for diff/atomic replace). That read is a REAL read under
 * the caller's read axis: `write: allow` alone is not enough, and an `ask` on
 * the read axis is not a read either. This is fail-closed in both directions —
 * a target outside the write axis is refused first, then a target outside the
 * read axis is refused with its own typed code. The two axes are never merged.
 */
export declare function checkWriteRequiresRead(read: PathRuleSet, write: PathRuleSet, locator: string): WriteRequiresReadResult;
//# sourceMappingURL=path-rules.d.ts.map