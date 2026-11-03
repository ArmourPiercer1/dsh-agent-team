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
import type { PathRuleSet } from './types.js';
/**
 * The CLOSED set of `ctx.fs` methods the managed Member path needs. Order is
 * the declaration order used in refusal diagnostics.
 */
export declare const MANAGED_FS_METHODS: readonly ["resolve", "processPath", "contains", "stat", "lstat", "readText", "streamText", "readBytes", "readByteRange", "listDir", "watch", "writeText", "editText"];
export type ManagedFsMethod = (typeof MANAGED_FS_METHODS)[number];
/** A `ctx.fs`-shaped surface: only method presence/typeof is inspected. */
export interface ManagedFsProviderSurface {
    readonly [method: string]: unknown;
}
/** Closed refusal vocabulary for Provider capability coverage. */
export declare const PROVIDER_CAPABILITY_REFUSAL_CODES: readonly ["PROVIDER_CAPABILITY_MISSING", "PROVIDER_CAPABILITY_UNKNOWN"];
export type ProviderCapabilityRefusalCode = (typeof PROVIDER_CAPABILITY_REFUSAL_CODES)[number];
export interface ProviderCapabilityAccepted {
    readonly ok: true;
    readonly value: {
        readonly methods: readonly ManagedFsMethod[];
        readonly provider: ManagedFsProviderSurface;
    };
}
export interface ProviderCapabilityRefused {
    readonly ok: false;
    /** The closed refusal category: missing/unknown Provider capability. */
    readonly decision: 'unsupported';
    readonly code: ProviderCapabilityRefusalCode;
    readonly detail: string;
    /** Every method that cannot be satisfied, in requested order (deduped). */
    readonly missing: readonly string[];
}
export type ProviderCapabilityResult = ProviderCapabilityAccepted | ProviderCapabilityRefused;
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
export declare function requireProviderCapabilities(provider: ManagedFsProviderSurface, needed?: readonly string[]): ProviderCapabilityResult;
/** The minimal file identity the guard needs; intentionally NOT inode/nlink. */
export interface PathIdentity {
    isSymbolicLink(): boolean;
    isFile(): boolean;
    isDirectory(): boolean;
}
/**
 * Injectable filesystem identity interface. The default is
 * `node:fs/promises`; tests pass a fake to keep the law deterministic.
 */
export interface PathIdentityResolver {
    realpath(path: string): Promise<string>;
    lstat(path: string): Promise<PathIdentity>;
}
/** The default resolver: the real filesystem (`node:fs/promises`). */
export declare const NODE_PATH_IDENTITY_RESOLVER: PathIdentityResolver;
/** Closed refusal vocabulary for one authored locator decision. */
export declare const PATH_GUARD_REFUSAL_CODES: readonly ["PATH_NOT_ALLOWED", "PATH_EXPLICITLY_DENIED", "PATH_SYMLINK_ESCAPE", "PATH_NOT_FOUND", "PATH_RESOLUTION_UNSUPPORTED"];
export type PathGuardRefusalCode = (typeof PATH_GUARD_REFUSAL_CODES)[number];
/** Whether the caller intends to read or write the locator. */
export type PathGuardAccess = 'read' | 'write';
export interface PathGuardInput {
    readonly lane: PathRuleSet;
    readonly locator: string;
    /** Defaults to `read` (the conservative case). */
    readonly access?: PathGuardAccess;
    /** Defaults to `NODE_PATH_IDENTITY_RESOLVER`. */
    readonly resolver?: PathIdentityResolver;
}
export interface PathGuardAllowed {
    readonly decision: 'allow';
    readonly authored: string;
    /** The Provider-resolved (canonical) path the decision was taken on. */
    readonly resolved: string;
    /** Whether the FINAL component of the authored locator is a symlink. */
    readonly symlink: boolean;
}
export interface PathGuardRefused {
    readonly decision: 'deny' | 'unsupported';
    readonly code: PathGuardRefusalCode;
    readonly detail: string;
}
export type PathGuardDecision = PathGuardAllowed | PathGuardRefused;
/**
 * Decide one authored locator against one lane using Provider-resolved identity.
 *
 * Order (fail-closed):
 *  1. the AUTHORED locator must be inside the lane (pure containment);
 *  2. resolve it through the resolver; a non-existent read target is `deny`
 *     (`PATH_NOT_FOUND`), a non-existent write target is allowed to resolve
 *     through its PARENT (so a write may create a file);
 *  3. the RESOLVED path must still be inside the lane. When it is not, an
 *     aliased/symlinked resolution is `PATH_SYMLINK_ESCAPE`, otherwise
 *     `PATH_NOT_ALLOWED`; a resolved path inside an explicit deny is
 *     `PATH_EXPLICITLY_DENIED`. A symlink that resolves INSIDE the subtree is
 *     allowed.
 *
 * No inode identity is consulted, so a legal hardlink is decided purely by the
 * name used: allowed through the allowed name, refused through an outside one.
 */
export declare function evaluateLocatorAccess(input: PathGuardInput): Promise<PathGuardDecision>;
//# sourceMappingURL=provider-capabilities.d.ts.map