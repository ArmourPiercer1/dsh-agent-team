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
import { deepFreeze } from '../../contracts/src/index.js';
import { capabilityKey, } from './types.js';
/**
 * Create one ephemeral capability observation registry.
 * @returns the registry surface (fresh, empty).
 */
export function createCapabilityObservationRegistry() {
    const observations = new Map();
    const registry = {
        record(observation) {
            observations.set(capabilityKey(observation.capabilityType, observation.capabilityName), observation);
        },
        get(capabilityType, capabilityName) {
            return observations.get(capabilityKey(capabilityType, capabilityName));
        },
        all() {
            return deepFreeze([...observations.values()]);
        },
        get size() {
            return observations.size;
        },
        clear() {
            observations.clear();
        },
    };
    return registry;
}
//# sourceMappingURL=registry.js.map