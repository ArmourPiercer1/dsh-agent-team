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
import type { EffectivePolicyRead, EffectivePolicyReadArgs } from './types.js';
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
export declare function readEffectivePolicy(args: EffectivePolicyReadArgs): EffectivePolicyRead;
//# sourceMappingURL=reader.d.ts.map