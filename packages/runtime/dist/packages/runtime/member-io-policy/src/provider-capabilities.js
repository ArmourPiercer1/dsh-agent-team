/**
 * Alpha.5 P1-03 — the Provider-facing half of the authorized-path law.
 *
 * WHAT THIS MODULE DECIDES (two independent, injectable guards):
 *
 *  1. LOCATOR ACCESS. The authored string decision (subtree containment) lives
 *     in `path-rules.ts` and stays pure. Here the AUTHORED locator is resolved
 *     through a `PathIdentityResolver` (default `node:fs/promises`) and the
 *     RESOLVED path must still be inside the allowed subtree. A symlink that
 *     was authored inside an allowed subtree but resolves outside it is
 *     `deny` (`PATH_SYMLINK_ESCAPE`) — a symlinked PARENT directory is caught
 *     the same way, because `realpath` canonicalizes the whole chain.
 *
 *  2. PROVIDER CAPABILITIES. `MANAGED_FS_METHODS` is the CLOSED set of `ctx.fs`
 *     methods the managed path needs. A Provider missing any of them gets a
 *     TYPED `unsupported` refusal naming every missing method; the result
 *     NEVER degrades to "all read" and there is NO raw Node fs fallback. An
 *     unknown/extra method on the Provider (or in the `needed` list) never
 *     counts as a managed capability.
 *
 * HARD LAW — this module is PATH-based, never inode-based. No `nlink` check
 * exists here on purpose: the old controlled-fs `nlink === 1` integrity rule is
 * being retired for MEMBER WORKSPACE I/O (it must stay for the internal
 * authority/ledger planes, which are not consumers of this module). A hardlink
 * created under an allowed path is operable through that allowed path even
 * though another name for the same inode lives outside the policy; the outside
 * name is still refused because the DECISION IS TAKEN ON THE PATH. The alias
 * consequence (the same inode is reachable under two names) is disclosed, not
 * redefined as a denial — see ADR D5.
 *
 * Everything is injectable (`resolver`) so the behavior is deterministic in
 * tests; no clock, no network, no hidden global filesystem read in the decision
 * path other than the default resolver call.
 *
 * @module @dsh-agent-team/runtime/member-io-policy/provider-capabilities
 */
import { basename, dirname, join, resolve as resolvePath, sep } from 'node:path';
import { lstat as nodeLstat, realpath as nodeRealpath } from 'node:fs/promises';
import { laneCoversAsk, laneCoversDeny, locatorWithinRuleSet } from './path-rules.js';
// ---------------------------------------------------------------------------
// 1. Provider capability coverage
// ---------------------------------------------------------------------------
/**
 * The CLOSED set of `ctx.fs` methods the managed Member path needs. Order is
 * the declaration order used in refusal diagnostics.
 */
export const MANAGED_FS_METHODS = [
    'resolve',
    'processPath',
    'contains',
    'stat',
    'lstat',
    'readText',
    'streamText',
    'readBytes',
    'readByteRange',
    'listDir',
    'watch',
    'writeText',
    'editText',
];
/** Closed refusal vocabulary for Provider capability coverage. */
export const PROVIDER_CAPABILITY_REFUSAL_CODES = [
    'PROVIDER_CAPABILITY_MISSING',
    'PROVIDER_CAPABILITY_UNKNOWN',
];
function uniqueInOrder(values) {
    const out = [];
    for (const value of values)
        if (!out.includes(value))
            out.push(value);
    return out;
}
/**
 * Verify that `provider` exposes every needed method as a FUNCTION.
 *
 * Fail-closed laws:
 *  - a missing (or non-function) needed method is `PROVIDER_CAPABILITY_MISSING`
 *    and the refusal names ALL of them;
 *  - requesting a name outside `MANAGED_FS_METHODS` is
 *    `PROVIDER_CAPABILITY_UNKNOWN` (the closed vocabulary cannot be extended by
 *    a Provider that happens to expose an extra function);
 *  - refusal returns no capability grant, so a consumer cannot accidentally
 *    continue with a partial Provider.
 */
export function requireProviderCapabilities(provider, needed = MANAGED_FS_METHODS) {
    const declared = new Set(MANAGED_FS_METHODS);
    const requested = uniqueInOrder(needed);
    const unknown = requested.filter((method) => !declared.has(method));
    const missing = requested.filter((method) => typeof provider[method] !== 'function');
    if (unknown.length > 0) {
        const named = uniqueInOrder([...unknown, ...missing]);
        return Object.freeze({
            ok: false,
            decision: 'unsupported',
            code: 'PROVIDER_CAPABILITY_UNKNOWN',
            detail: `the managed FS path needs method(s) outside the closed ctx.fs vocabulary: ${named.join(', ')}; an extra Provider function is never a managed capability`,
            missing: Object.freeze(named),
        });
    }
    if (missing.length > 0) {
        return Object.freeze({
            ok: false,
            decision: 'unsupported',
            code: 'PROVIDER_CAPABILITY_MISSING',
            detail: `the managed FS Provider is missing required ctx.fs method(s): ${missing.join(', ')}; refusing rather than degrading to all-read or a raw Node fs fallback`,
            missing: Object.freeze(missing),
        });
    }
    return Object.freeze({
        ok: true,
        value: Object.freeze({
            methods: Object.freeze([...requested]),
            provider,
        }),
    });
}
/** The default resolver: the real filesystem (`node:fs/promises`). */
export const NODE_PATH_IDENTITY_RESOLVER = Object.freeze({
    realpath: (path) => nodeRealpath(path),
    lstat: (path) => nodeLstat(path),
});
/**
 * Closed refusal vocabulary for one authored locator decision.
 *
 * `IO_ASK_REQUIRES_APPROVAL` is the ONE non-`PATH_*` member, on purpose: it is
 * the token the Service layer (`TEAM_IO_DENIAL_CODES`) already speaks, and the
 * confined Provider re-raises it verbatim, so a rename on this side would hide
 * the reason from the tool layer and from the guard fact
 * (`a5sf-guard-consult/1.decidedBy`).
 */
export const PATH_GUARD_REFUSAL_CODES = [
    'PATH_NOT_ALLOWED',
    'PATH_EXPLICITLY_DENIED',
    'PATH_SYMLINK_ESCAPE',
    'PATH_NOT_FOUND',
    'PATH_RESOLUTION_UNSUPPORTED',
    /**
     * A5-DUAL-PLANE-01 (2026-11-05): the lane's effective disposition for this
     * locator is `ask`. `ask` is a DECISION of the lane algebra, not a gap in it,
     * but admission has no approval consumer — `resolveAskClassCall` is the
     * designed consumption seam and has NO production caller (BL-30 owns it).
     * An ask that cannot be consumed must REFUSE, because the alternative is
     * silent auto-approval: the call would run with bytes read / file changed and
     * no approval ever requested or recorded.
     */
    'IO_ASK_REQUIRES_APPROVAL',
];
function refusePath(decision, code, detail) {
    return Object.freeze({ decision, code, detail });
}
/** Does any existing segment of `locator` name a symlink? Fail-closed `false` on probe error. */
async function pathHasSymlinkSegment(locator, resolver) {
    const absolute = resolvePath(locator);
    const segments = absolute.split(sep).filter((segment) => segment.length > 0);
    let current = sep;
    for (const segment of segments) {
        current = current === sep ? `${sep}${segment}` : `${current}${sep}${segment}`;
        try {
            if ((await resolver.lstat(current)).isSymbolicLink())
                return true;
        }
        catch {
            // A non-existent segment cannot be a symlink (and cannot be a link hop).
            return false;
        }
    }
    return false;
}
function isNotFound(error) {
    return typeof error === 'object' && error !== null &&
        error.code === 'ENOENT';
}
/**
 * Decide one authored locator against one lane using Provider-resolved identity.
 *
 * Order (fail-closed, the lane algebra's own precedence `deny > ask > allow`):
 *  1. the AUTHORED locator is decided first: an explicit deny subtree is
 *     `PATH_EXPLICITLY_DENIED`; a locator the lane ASKS for is
 *     `IO_ASK_REQUIRES_APPROVAL` (a REFUSAL at admission — see that code's
 *     note: `ask` has no production approval consumer, so letting the allow
 *     that also covers it stand in would be silent auto-approval); anything
 *     outside every allow subtree is `PATH_NOT_ALLOWED`;
 *  2. resolve it through the resolver; a non-existent read target is `deny`
 *     (`PATH_NOT_FOUND`), a non-existent write target is allowed to resolve
 *     through its PARENT (so a write may create a file);
 *  3. the RESOLVED path is the one the decision is taken on: an explicit deny
 *     is `PATH_EXPLICITLY_DENIED`, an `ask`-covered resolution is
 *     `IO_ASK_REQUIRES_APPROVAL` (this is the symlink-alias case: an allowed
 *     authored name that lands on an asked-for file), and a resolution outside
 *     the lane is `PATH_SYMLINK_ESCAPE` (when a symlink really is on the
 *     authored path) or `PATH_NOT_ALLOWED`. A symlink that resolves INSIDE an
 *     allowed, non-asked subtree is allowed.
 *
 * No inode identity is consulted, so a legal hardlink is decided purely by the
 * name used: allowed through the allowed name, refused through an outside one.
 */
export async function evaluateLocatorAccess(input) {
    const access = input.access ?? 'read';
    const resolver = input.resolver ?? NODE_PATH_IDENTITY_RESOLVER;
    const locator = input.locator;
    // 1. authored-string decision: never resolve a location the lane refuses.
    if (laneCoversDeny(input.lane, locator)) {
        return refusePath('deny', 'PATH_EXPLICITLY_DENIED', `authored locator '${locator}' is inside an explicit deny subtree`);
    }
    // `ask` outranks the allow that (by construction) also covers this locator.
    // This is the A5-DUAL-PLANE-01 arm: without it the allow stands in for an
    // approval that was never requested, let alone consumed.
    if (laneCoversAsk(input.lane, locator)) {
        return refusePath('ask', 'IO_ASK_REQUIRES_APPROVAL', `authored locator '${locator}' has the disposition 'ask', but this admission plane has no approval consumer (resolveAskClassCall has no production caller); refusing rather than auto-approving`);
    }
    if (!locatorWithinRuleSet(input.lane, locator)) {
        return refusePath('deny', 'PATH_NOT_ALLOWED', `authored locator '${locator}' is outside every allow subtree of the lane`);
    }
    // 2. provider resolution.
    let resolved;
    let symlink = false;
    let linkIdentityKnown = false;
    try {
        const identity = await resolver.lstat(locator);
        symlink = identity.isSymbolicLink();
        linkIdentityKnown = true;
        resolved = await resolver.realpath(locator);
    }
    catch (error) {
        if (!isNotFound(error)) {
            return refusePath('unsupported', 'PATH_RESOLUTION_UNSUPPORTED', `the Provider could not resolve '${locator}': ${error instanceof Error ? error.message : String(error)}`);
        }
        if (linkIdentityKnown && symlink) {
            // A symlink whose target does not resolve is a DANGLING LINK: the leaf
            // itself exists and points outside. Falling into the create-leaf branch
            // would approve a write whose bytes land wherever the link points.
            return refusePath('deny', 'PATH_SYMLINK_ESCAPE', `'${locator}' is a dangling symlink whose target does not resolve; a write through it would leave the authorized subtree`);
        }
        if (access === 'read') {
            return refusePath('deny', 'PATH_NOT_FOUND', `read target '${locator}' does not exist`);
        }
        // A write may create the leaf, but the PARENT directory must resolve.
        try {
            const parent = await resolver.realpath(dirname(locator));
            resolved = join(parent, basename(locator));
        }
        catch (parentError) {
            return refusePath('unsupported', 'PATH_RESOLUTION_UNSUPPORTED', `the Provider could not resolve the parent of '${locator}': ${parentError instanceof Error ? parentError.message : String(parentError)}`);
        }
    }
    // 3. the RESOLVED path is the one the decision is taken on.
    const lexical = resolvePath(locator);
    // A DIFFERENT resolved path is only a SYMLINK escape when a symlink is really
    // on the authored path. Lexical/canonicalization differences (relative
    // locator, `//`, a symlinked checkout root, case folding) must not be
    // reported as an alias; they are decided by containment like any other path.
    const aliased = resolved !== lexical && (symlink || (await pathHasSymlinkSegment(locator, resolver)));
    if (laneCoversDeny(input.lane, resolved)) {
        return refusePath('deny', aliased ? 'PATH_SYMLINK_ESCAPE' : 'PATH_EXPLICITLY_DENIED', `'${locator}' resolves to '${resolved}', which is inside an explicit deny subtree`);
    }
    // The RESOLVED identity can be ask-covered even when the authored name is
    // not (an in-lane symlink onto an asked-for file). Asking about the authored
    // name alone would let the alias through — the symlink case of
    // A5-DUAL-PLANE-01.
    if (laneCoversAsk(input.lane, resolved)) {
        return refusePath('ask', 'IO_ASK_REQUIRES_APPROVAL', `'${locator}' resolves to '${resolved}', which has the disposition 'ask'; this admission plane has no approval consumer, so the alias is refused rather than auto-approved`);
    }
    if (!locatorWithinRuleSet(input.lane, resolved)) {
        return refusePath('deny', aliased ? 'PATH_SYMLINK_ESCAPE' : 'PATH_NOT_ALLOWED', `'${locator}' resolves to '${resolved}', which is outside every allow subtree of the lane`);
    }
    return Object.freeze({ decision: 'allow', authored: locator, resolved, symlink });
}
//# sourceMappingURL=provider-capabilities.js.map