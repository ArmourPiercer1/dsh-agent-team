/**
 * The canonical `resolveActivationPolicy` (pre-alpha3 PR-B, plan §B.2):
 * the frozen step-8 / inspect surface now delegates to the ONE canonical
 * read ({@link readEffectivePolicy}) — the two historically divergent
 * assemblies are retired; every input style funnels into the same frozen
 * building blocks (`selectPolicyOverrides` + `resolveEffectivePolicy` +
 * the static-facts authority).
 *
 * Input styles (both produce the identical assembly):
 *
 * - CANONICAL (the production callers): `policy` (the production
 *   PolicyReader — the bound-snapshot static facts) + `transitions` (the
 *   durable PolicyState commits; the committed state participates) +
 *   `overrides` (the durable governance records).
 * - LEGACY ARGS (the test worlds + the pre-PR-B call shape): `external`
 *   + `templateValues` (the partial model/mcp static template grants) —
 *   adapted to a literal PolicyReader (`blueprint: {}`, the partial
 *   template, the given external) and resolved with NO transitions (the
 *   implicit `default` state) — bit-for-bit the pre-PR-B behavior, so the
 *   frozen P8-S4B / step-8 test pins stay intact.
 */
import { legacyPolicyReaderOf } from './legacy.js';
import { readEffectivePolicy } from './reader.js';
/**
 * Resolve one member's effective policy through the canonical read.
 *
 * @throws {@link ActivationError} `ACTIVATION_POLICY_RESOLUTION_FAILED`
 *   when the frozen resolver rejects the input (fail closed — the SAME
 *   error type the pre-PR-B `resolveActivationPolicy` raised).
 */
export function resolveActivationPolicy(args) {
    if (args.policy !== undefined) {
        // CANONICAL: the bound-snapshot static authority + the durable
        // committed state.
        return readEffectivePolicy({
            rootSessionId: args.rootSessionId,
            instanceId: args.instanceId,
            policy: args.policy,
            transitions: args.transitions ?? [],
            overrides: args.overrides,
        }).policy;
    }
    // LEGACY ARGS: adapt the pre-PR-B input pair to a literal reader — the
    // assembly then runs the ONE canonical path with the implicit default
    // state (the pre-PR-B behavior bit-for-bit).
    const legacyReader = legacyPolicyReaderOf(args.external, args.templateValues);
    return readEffectivePolicy({
        rootSessionId: args.rootSessionId,
        instanceId: args.instanceId,
        policy: legacyReader,
        transitions: [],
        overrides: args.overrides,
    }).policy;
}
//# sourceMappingURL=activation-policy.js.map