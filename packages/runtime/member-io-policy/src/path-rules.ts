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
 * P1-03 OWNS THE REST: exact-vs-subtree authoring semantics, the controlled
 * Provider's own path resolution / file identity (symlinks, hardlink aliases),
 * and the "unknown Provider capability ⇒ refuse" law. This module deliberately
 * does NOT touch the filesystem, so it cannot decide aliases; it only decides
 * segment containment over authored strings.
 *
 * @module @dsh-agent-team/runtime/member-io-policy/path-rules
 */

import type { PathRuleSet } from './types.js'

/** One comparison key: the path segments, plus whether it is absolute. */
export interface LocatorKey {
  readonly absolute: boolean
  readonly segments: readonly string[]
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
export function toLocatorKey(locator: string): LocatorKey {
  const absolute = locator.startsWith('/') || locator.startsWith('\\') || /^[A-Za-z]:[\\/]/.test(locator)
  const segments = locator
    .split(/[/\\]+/)
    .filter((segment) => segment !== '' && segment !== '.')
  return Object.freeze({ absolute, segments: Object.freeze(segments) })
}

/**
 * `parent` covers `child` iff every parent segment is a leading segment of the
 * child, with an ABSOLUTE/relative agreement and a real segment boundary:
 * `/work/a` covers `/work/a`, `/work/a/f`, `/work/a/`, but NOT `/work/ab`.
 * `/` (no segments) covers every absolute locator; a bare relative root covers
 * every relative locator.
 */
export function coversLocator(parent: string, child: string): boolean {
  return keyCovers(toLocatorKey(parent), toLocatorKey(child))
}

export function keyCovers(parent: LocatorKey, child: LocatorKey): boolean {
  if (parent.absolute !== child.absolute) return false
  if (parent.segments.length === 0) return true
  if (parent.segments.length > child.segments.length) return false
  return parent.segments.every((segment, index) => child.segments[index] === segment)
}

/** Does the lane allow this location (subtree-aware)? */
export function laneCoversAllow(lane: PathRuleSet, locator: string): boolean {
  const key = toLocatorKey(locator)
  if (lane.mode === 'all') return !laneCoversDeny(lane, locator)
  return lane.allow.some((allowed) => keyCovers(toLocatorKey(allowed), key))
}

/** Does the lane deny this location (subtree-aware)? */
export function laneCoversDeny(lane: PathRuleSet, locator: string): boolean {
  const key = toLocatorKey(locator)
  return lane.deny.some((denied) => keyCovers(toLocatorKey(denied), key))
}

/**
 * Intersect two ALLOW locator lists. A subtree union intersects by keeping the
 * NARROWER locator of each related pair, dropping unrelated pairs entirely:
 * `/work/a` ∩ `/work/a/docs` → `/work/a/docs`; `/work/a` ∩ `/work/c` → nothing.
 * A locator belonging to two disjoint subtrees is never synthesized.
 */
export function intersectAllowLocators(left: readonly string[], right: readonly string[]): readonly string[] {
  const out: string[] = []
  for (const leftLocator of left) {
    const leftKey = toLocatorKey(leftLocator)
    for (const rightLocator of right) {
      const rightKey = toLocatorKey(rightLocator)
      if (keyCovers(leftKey, rightKey)) {
        if (!out.includes(rightLocator)) out.push(rightLocator)
      } else if (keyCovers(rightKey, leftKey)) {
        if (!out.includes(leftLocator)) out.push(leftLocator)
      }
    }
  }
  return Object.freeze(out)
}

function unionLocators(...lists: readonly (readonly string[])[]): readonly string[] {
  const out: string[] = []
  for (const list of lists) {
    for (const locator of list) if (!out.includes(locator)) out.push(locator)
  }
  return Object.freeze(out)
}

/**
 * The one two-axis path intersection:
 *   effective = memberCeiling ∩ toolRestriction
 * where a tool `all` lane is expressed by the caller as the Member lane itself
 * (`no-additional-narrowing` is resolved in `compile.ts`, which owns that
 * vocabulary). Both inputs are rule sets here.
 *
 * Disposition law (conservative, never widens):
 *  - mode is `all` only when BOTH lanes are `all`;
 *  - allow keeps the narrower related subtree of each pair;
 *  - deny is the UNION (a deny on either axis survives);
 *  - `ask` is the STRICTER disposition: an ask survives if the OTHER lane
 *    permits that location, and it is never promoted to allow. Any surviving
 *    ask that is denied is dropped (deny wins).
 */
export function intersectPathRuleSets(member: PathRuleSet, tool: PathRuleSet): PathRuleSet {
  const allow = intersectAllowLocators(member.allow, tool.allow)
  const deny = unionLocators(member.deny, tool.deny)
  const mode: 'all' | 'restricted' = member.mode === 'all' && tool.mode === 'all' ? 'all' : 'restricted'
  const permissive: PathRuleSet = Object.freeze({
    mode,
    allow,
    ask: Object.freeze([]),
    deny,
  })
  const ask: string[] = []
  for (const locator of unionLocators(member.ask, tool.ask)) {
    if (ask.includes(locator)) continue
    if (!laneCoversAllow(permissive, locator)) continue
    if (laneCoversDeny(permissive, locator)) continue
    ask.push(locator)
  }
  return Object.freeze({
    mode,
    allow,
    ask: Object.freeze(ask),
    deny,
  })
}

/**
 * Is `locator` inside a compiled rule set? The matcher P1-03 will extend with
 * Provider-resolved identity; this is the authored-string answer used by the
 * compiler's own tests and by denial diagnostics.
 */
export function locatorWithinRuleSet(lane: PathRuleSet, locator: string): boolean {
  if (laneCoversDeny(lane, locator)) return false
  return lane.mode === 'all' || lane.allow.some((allowed) => coversLocator(allowed, locator))
}
