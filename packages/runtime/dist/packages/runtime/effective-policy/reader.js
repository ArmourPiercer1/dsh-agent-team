/**
 * The canonical read (plan §B.2): the SINGLE production entry through
 * which a consumer obtains one member's effective policy from the durable
 * facts. Every production consumer (the live request boundary via
 * `deriveModelSelection` / `deriveMcpFacet`, the activation step 8, the
 * inspect-config action, the effective-config projection, the model-state
 * view) derives from this read — no consumer assembles policy itself.
 *
 * The frozen building blocks are reused verbatim (never re-implemented):
 * `selectPolicyOverrides` (P8-S4B) + `resolveEffectivePolicy` (P3-T4) +
 * the production `PolicyReader` (the same static-facts authority the
 * governance mutation authority's write-time checks use).
 */
import { resolveEffectivePolicy, } from '../../domain/policy/src/index.js';
import { createMemberIdentity, parseInstanceId, parseRootSessionId, teamSessionIdOf, } from '../../contracts/src/index.js';
import { selectPolicyOverrides, } from './select.js';
import { ACTIVATION_ERROR_CODES, ActivationError, } from '../activation/errors.js';
import { committedPolicyState, memberOverrideRefs, winnerGeneration, } from './types.js';
/**
 * Read one member's effective policy from the durable facts.
 *
 * @param args - the durable inputs (see {@link EffectivePolicyReadArgs}).
 * @returns the canonical read (frozen policy + the durable facts it was
 *   resolved from).
 * @throws {@link ActivationError} `ACTIVATION_POLICY_RESOLUTION_FAILED`
 *   when the frozen resolver rejects the input (malformed stored payload —
 *   fail closed; the SAME error type the retired `resolveActivationPolicy`
 *   raised, so the consumers' typed catches stay intact).
 */
export function readEffectivePolicy(args) {
    const { rootSessionId, instanceId, policy, transitions, overrides } = args;
    const root = parseRootSessionId(rootSessionId);
    const teamSessionId = teamSessionIdOf(root);
    const member = createMemberIdentity(root, parseInstanceId(instanceId));
    // 1. The static layers (the bound-snapshot authority).
    const blueprint = policy.readBlueprintEnvelope(teamSessionId);
    const template = policy.readTemplatePolicy(teamSessionId, member);
    const external = policy.readExternalFacts(teamSessionId);
    // 2. The committed PolicyState (the last durable transition in
    //    admission order — the production step clock is retired, plan
    //    §B.2: the pinned (requested 0 / effective 1) pair makes admission
    //    order the honest commitment order).
    const { state: policyState, transition: policyStateTransition } = committedPolicyState(transitions);
    // 3. The slot winners (the frozen P8-S4B deterministic selection over
    //    the durable governance records — the production record lane of the
    //    old mutation store has no production writer since PR-A, so the
    //    durable records are the ONLY slot source).
    const selected = selectPolicyOverrides(overrides, rootSessionId, instanceId);
    // 4. The frozen resolver (P3-T4) — fail closed on a malformed payload.
    let policyResult;
    try {
        policyResult = resolveEffectivePolicy({
            teamSessionId,
            member,
            blueprint,
            template,
            policyState,
            ...(selected.templateOverlay !== undefined ? { templateOverlay: selected.templateOverlay } : {}),
            ...(selected.instanceOverlay !== undefined ? { instanceOverlay: selected.instanceOverlay } : {}),
            ...(selected.humanOverride !== undefined ? { humanOverride: selected.humanOverride } : {}),
            external,
        });
    }
    catch (error) {
        throw new ActivationError(ACTIVATION_ERROR_CODES.POLICY_RESOLUTION_FAILED, `effective-policy: canonical read failed (fail closed): ${String(error)}`, { rootSessionId, instanceId });
    }
    // 5. The committed-generation marker (the in-process staleness anchor —
    //    the frozen v1 wire carries no client expectedGeneration, pre-alpha3
    //    PR-A ruling) + the member-scoped durable refs (the provenance
    //    input of the per-capability views).
    const committedGeneration = Math.max(winnerGeneration(overrides, selected.templateOverlay?.overlayId), winnerGeneration(overrides, selected.instanceOverlay?.overlayId), winnerGeneration(overrides, selected.humanOverride?.overrideId));
    return {
        policy: policyResult,
        policyState,
        policyStateTransition,
        ...(selected.templateOverlay !== undefined ? { templateOverlay: selected.templateOverlay } : {}),
        ...(selected.instanceOverlay !== undefined ? { instanceOverlay: selected.instanceOverlay } : {}),
        ...(selected.humanOverride !== undefined ? { humanOverride: selected.humanOverride } : {}),
        committedGeneration,
        refs: memberOverrideRefs(overrides, instanceId),
    };
}
//# sourceMappingURL=reader.js.map