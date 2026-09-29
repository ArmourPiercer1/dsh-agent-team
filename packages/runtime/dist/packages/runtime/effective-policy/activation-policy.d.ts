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
import type { EffectivePolicy, ExternalPolicyFacts, TemplatePolicy } from '../../domain/policy/src/index.js';
import type { GovernanceOverrideRecord } from '../../storage/schema/index.js';
import type { PolicyReader, PolicyStateTransitionRecord } from '../mutation/index.js';
/**
 * The arguments of {@link resolveActivationPolicy} (the canonical fields
 * win when present; the legacy fields are the pre-PR-B call shape).
 */
export interface ResolveActivationPolicyArgs {
    /** The owning TeamSession (root session) id. */
    readonly rootSessionId: string;
    /** The addressed MemberInstance. */
    readonly instanceId: string;
    /** Every durable governance override record of the TeamSession. */
    readonly overrides: readonly GovernanceOverrideRecord[];
    /**
     * THE CANONICAL INPUT — the static policy authority (the production
     * PolicyReader: blueprint envelope + per-member template policy +
     * external hard facts, from the bound snapshot). Wins over the legacy
     * `external` / `templateValues` pair when present.
     */
    readonly policy?: PolicyReader;
    /**
     * THE CANONICAL INPUT — the durable PolicyState transitions (admission
     * order; the last entry is the committed state). Absent = the implicit
     * `default` state (the legacy behavior).
     */
    readonly transitions?: readonly PolicyStateTransitionRecord[];
    /** LEGACY ARGS — the external hard facts (the legacy `external` input). */
    readonly external?: ExternalPolicyFacts;
    /** LEGACY ARGS — the static template values (model/mcp grants). */
    readonly templateValues?: TemplatePolicy['values'];
}
/**
 * Resolve one member's effective policy through the canonical read.
 *
 * @throws {@link ActivationError} `ACTIVATION_POLICY_RESOLUTION_FAILED`
 *   when the frozen resolver rejects the input (fail closed — the SAME
 *   error type the pre-PR-B `resolveActivationPolicy` raised).
 */
export declare function resolveActivationPolicy(args: ResolveActivationPolicyArgs): EffectivePolicy;
//# sourceMappingURL=activation-policy.d.ts.map