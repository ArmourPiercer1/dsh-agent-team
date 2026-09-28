/**
 * pre-alpha3 PR-C — the ephemeral capability observation registry (plan
 * §C.4/§C.5): the per-TeamSession cache of the LIVE readiness observations.
 *
 * The registry is EPHEMERAL (plan §C.5: "当前状态 ephemeral"): it holds the
 * most recent observation per (capabilityType, capabilityName) for one live
 * team, rebuilt from the first post-restart probe — it is NEVER persisted as
 * a fabricated failure. A team with no live observations (a cold member)
 * reports `not-applicable` for every configured capability (plan §C.6),
 * derived from liveness, not from a stored `failed` slot.
 *
 * Pure module: a frozen Map-of-frozen-observations, no I/O, no clock. The
 * caller records probe results (from the provider) and reads the current
 * observations (for the unified runtime status / the UI projection).
 * @module @dsh-agent-team/runtime/readiness/registry
 */
import { type CapabilityObservation, type CapabilityType } from './types.js';
/** The public ephemeral observation registry surface. */
export interface CapabilityObservationRegistry {
    /**
     * Record (replace) the most recent observation for one capability. The
     * observation is frozen on record; an earlier observation for the same
     * (type, name) is replaced.
     */
    record(observation: CapabilityObservation): void;
    /** The most recent observation for one capability, or undefined. */
    get(capabilityType: CapabilityType, capabilityName: string): CapabilityObservation | undefined;
    /** Every recorded observation (frozen order by record time of the key). */
    all(): readonly CapabilityObservation[];
    /** The number of recorded observations. */
    readonly size: number;
    /** Drop every recorded observation (team teardown). */
    clear(): void;
}
/**
 * Create one ephemeral capability observation registry.
 * @returns the registry surface (fresh, empty).
 */
export declare function createCapabilityObservationRegistry(): CapabilityObservationRegistry;
//# sourceMappingURL=registry.d.ts.map