/**
 * Strict-read + Core-spill — the in-memory grant candidate registry (D4:
 * the registry is a PROJECTION/CACHE; the durable facts are the source
 * of truth).
 *
 * One registry per production root (implementation guide §4). It is
 * rebuilt from the ledger on cold start (no stale-fact deletion —
 * inactive candidates simply fail the fresh identity check at use),
 * and it is install-only at runtime (a new grant is installed after its
 * durable put; nothing is removed — D6 has no revoke fact, and an
 * archived/disposed instance is made inert by the authority's
 * eligibility check, not by registry mutation).
 *
 * Keying (invariant 18): grants are keyed by the COMPOSITE member
 * identity `(rootSessionId, instanceId)` — a bare instanceId is never
 * an identity on its own. Within one identity, grants are keyed by the
 * exact locator string.
 *
 * Pure module: no I/O, no clocks.
 * @module @dsh-agent-team/runtime/artifact-read/registry
 */
import type { ArtifactReadGrant } from './types.js';
/**
 * The candidate registry of artifact-read grants.
 */
export declare class ArtifactGrantRegistry {
    /** identityKey → (locator → grant). Identity is the canonical composite key. */
    private readonly byIdentity;
    /**
     * Install (or replace) one grant. Re-installing the same identity +
     * locator replaces the previous candidate (e.g. the same artifact
     * re-spilled → a newer grant supersedes it).
     * @param identityKey - the canonical composite identity key (`memberIdentityKey`).
     * @param grant - the grant to install.
     */
    install(identityKey: string, grant: ArtifactReadGrant): void;
    /**
     * Every candidate grant of one member identity.
     * @param identityKey - the canonical composite identity key.
     * @returns the grants (a stable snapshot array; may be empty).
     */
    listForIdentity(identityKey: string): readonly ArtifactReadGrant[];
    /**
     * The candidates for a fresh fs target under one member identity:
     * every grant of the identity whose TARGET-KEY DIGEST matches the
     * fresh digest (the locator is checked by the authority afterwards —
     * candidate lookup must not silently narrow the set the auditor
     * would compare).
     * @param identityKey - the canonical composite identity key.
     * @param freshTargetKeyDigest - the digest of the freshly resolved target.
     * @returns the matching candidates (may be empty).
     */
    findCandidates(identityKey: string, freshTargetKeyDigest: string): readonly ArtifactReadGrant[];
    /** Whether the identity has at least one candidate grant. */
    hasAny(identityKey: string): boolean;
    /** The total number of installed grants (diagnostics). */
    get size(): number;
    /** Drop every candidate (cold-restart rebuild, domain close). */
    clear(): void;
}
//# sourceMappingURL=registry.d.ts.map