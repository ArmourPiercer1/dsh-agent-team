/**
 * pre-alpha3 PR-C — the RuntimeSubstrateResolver (plan §C.2): the SINGLE
 * authority for what the runtime WILL mount + the observed persona kind of
 * EACH mounted preset (the root's AND the member's).
 *
 * The historical four fact sources (plan §C.1) each fed a different consumer
 * and disagreed:
 *
 * 1. the UI-selected preset id (a persona env fact the UI asserts — it never
 *    enters creation or the mount);
 * 2. the static row `environmentFacts` (boot-world compatibility input);
 * 3. the `config.rootPresetId` / `config.memberPresetId` ACTUAL mount
 *    (absent → the deployment default id);
 * 4. the hardcoded persona substrate (`{ presetId: 'dsh-agent-team',
 *    personaKind: 'standard' }` — never observed from any preset).
 *
 * In the shipped state all four coincidentally agree on `standard`, which is
 * why the disagreement is latent. The moment a complete preset (e.g. the
 * web bundle's `minimal`) is actually mounted, (4) still evaluates
 * `standard` at bind time → a FALSE OPEN of the §13.5 complete-persona
 * conflict.
 *
 * The resolver collapses the four into ONE plan: the actual mount authority
 * (`config.rootPresetId` / `config.memberPresetId`, absent → the deployment
 * default id) plus the OBSERVED persona kind of the mounted ROOT preset AND
 * the mounted MEMBER preset (the review fix F5 — the config allows
 * `rootPresetId != memberPresetId`, and the member preset's actual persona is
 * observed too, not inherited from the root: a template whose requirement
 * names the member persona is checked against the MEMBER observation, R8).
 * The bind-time persona slot still uses the ROOT observation (Architecture
 * §13.1: members inherit the root's bind substrate); the MEMBER observation
 * exists for the requirement authority (the template/instance boundary).
 * Every consumer (preflight, the compatibility engine, the bind-time
 * persona, the UI projection) reads the SAME plan — "preflight /
 * compatibility must consume the same plan" (plan §C.2).
 *
 * Pure module: no I/O, no live Agent, no `node:` builtins. The mount
 * authority + the persona-kind observation are injected ports; the resolver
 * is a frozen data assembly. The kind probe is ASYNC (the real production
 * observer reads the DSH public preset seam — `compositionInventory()` +
 * `readDocument()` — which are remote reads, the review fix F14); when the
 * root and the member share one preset id the probe runs exactly ONCE and
 * both plan entries carry the same observation.
 * @module @dsh-agent-team/runtime/agent-setup/preset/substrate-resolver
 */
import { deepFreeze, teamContractError } from '../../../contracts/src/index.js';
import {} from './types.js';
/**
 * The source of a persona-kind observation (provenance, plan §C.2).
 * Provenance only — never a fingerprint input.
 */
export const PERSONA_OBSERVATION_SOURCES = {
    /** The DSH effective composition (the plugin-inventory live rows). */
    effectiveComposition: 'effective-composition',
    /** The static preset composition text (the readDocument + parser fallback). */
    compositionText: 'composition-text',
    /** No source was available (the observation is `unresolved`). */
    none: 'none',
};
/**
 * Resolve the ONE runtime substrate plan (plan §C.2, review fix F5): the
 * actual preset ids of BOTH roles + the observed persona kind of EACH.
 *
 * The probe is memoized per preset id: when the root and the member share
 * one preset id the seam is read exactly once and both plan entries carry
 * the same observation.
 *
 * @param args - the injected mount authority + the persona-kind probe.
 * @returns the frozen plan (per-role preset ids + per-role persona observations).
 * @throws `MALFORMED_DTO` when there is NO root preset authority (the config
 *   id is absent and no deployment default was provided).
 */
export async function resolveRuntimeSubstrate(args) {
    if (args.rootPresetId === undefined && args.deploymentDefaultPresetId === undefined) {
        throw teamContractError('MALFORMED_DTO', 'no root preset authority (config.rootPresetId absent and no deployment default)', { field: 'rootPresetId', problem: 'no root preset authority' });
    }
    const rootPresetId = (args.rootPresetId ?? args.deploymentDefaultPresetId);
    // Members inherit the root preset unless a distinct member id is configured
    // (Architecture §13.1: no per-member selector — the member id is the config
    // override, defaulting to the root's deployment default, then the root id).
    const memberPresetId = args.memberPresetId ?? args.deploymentDefaultPresetId ?? rootPresetId;
    // Memoize per preset id: one shared id (the common case) probes exactly
    // once. The IN-FLIGHT promise is cached (not the resolved observation) so
    // concurrent observes of the same id share one probe — the root and the
    // member resolve in parallel below.
    const probeCache = new Map();
    function observe(presetId) {
        let probe = probeCache.get(presetId);
        if (probe === undefined) {
            probe = Promise.resolve(args.observePersonaKind(presetId));
            probeCache.set(presetId, probe);
        }
        return probe;
    }
    const [rootObservation, memberObservation] = await Promise.all([observe(rootPresetId), observe(memberPresetId)]);
    const rootPersona = embedObservation(rootObservation);
    const plan = {
        root: {
            presetId: rootPresetId,
            persona: rootPersona,
        },
        member: {
            presetId: memberPresetId,
            // The SAME id probes once: both entries carry the identical observation
            // (the same frozen object, not a copy).
            persona: rootPresetId === memberPresetId ? rootPersona : embedObservation(memberObservation),
        },
    };
    return deepFreeze(plan);
}
/**
 * Embed one observation into the plan (the frozen copy). Omit `reason`
 * entirely when it is undefined — a present-but-undefined field is not
 * lossless JSON, and the frozen plan must round-trip.
 */
function embedObservation(observation) {
    return deepFreeze({
        kind: observation.kind,
        source: observation.source,
        ...(observation.reason !== undefined ? { reason: observation.reason } : {}),
    });
}
//# sourceMappingURL=substrate-resolver.js.map