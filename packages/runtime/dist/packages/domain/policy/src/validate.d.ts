/**
 * Strict structural validation of policy resolver inputs (P3-T4).
 *
 * The resolver consumes plain data structures (no runtime guards upstream
 * in the pure domain), so every input is validated at the boundary, the
 * same way the contracts v1 DTOs are (closed record discipline):
 *
 * - identity: `teamSessionId` must be a valid TeamSessionId
 *   (`parseTeamSessionId`); `member.rootSessionId` / `member.instanceId`
 *   must be valid ids and `member` must belong to the TeamSession
 *   (`assertMemberIdentityInTeam`, invariant 18) — both from the local
 *   contracts-v1 mirror (./contracts-mirror.js, see its module doc for why
 *   the package does not import contracts sources directly).
 * - capability keys: every map key must be one of the CLOSED
 *   {@link CAPABILITY_NAME_VALUES} (unknown keys →
 *   `MALFORMED_POLICY_INPUT`, never silently ignored);
 * - entries: a `PolicyEntry` is exactly `{kind:'deny'}` or
 *   `{kind:'allow', items:[...1..n unique non-empty strings]}` — an empty
 *   allow-list is malformed (use `deny`), duplicates are malformed;
 * - overlay/override/state/external records: exact field shapes.
 *
 * Identity-boundary violations fail as the policy's own
 * `PolicyResolutionError`: malformed ids → `MALFORMED_POLICY_INPUT`,
 * cross-scope member identity → `IDENTITY_SCOPE_MISMATCH` (the contracts
 * v1 code string) — thrown by the mirror, propagated here unwrapped.
 *
 * The validation also precomputes the per-cell TEAM AUTONOMY ENVELOPE:
 * the intersection of the blueprint `autonomyEnvelope` and the template
 * `mutationEnvelope` (Architecture §19.3, jointly with the PolicyState
 * envelope which gates at resolve time). An absent/deny entry contributes
 * an EMPTY set: the Team domain fails closed for agent overlays.
 *
 * Pure module: no I/O, no DSH imports, no ambient state.
 * @module @dsh-agent-team/domain/policy/validate
 */
import type { CapabilityName, EffectivePolicyInput } from './types.js';
/** Internal validation result: the per-cell Team autonomy envelope sets. */
export interface ValidatedPolicyInput {
    /**
     * The per-cell Team autonomy envelope item set:
     * `blueprint.autonomyEnvelope[c] ∩ template.mutationEnvelope[c]`
     * (absent/deny → ∅). Only used for overlay admission; never leaves the
     * resolver (internal state, not part of the output).
     */
    readonly envelopeItems: ReadonlyMap<CapabilityName, ReadonlySet<string>>;
}
/**
 * Validate a complete resolver input.
 *
 * @param input - the pure resolver input to validate.
 * @returns the precomputed envelope (internal).
 * @throws `PolicyResolutionError` (`MALFORMED_POLICY_INPUT`) for
 *   malformed ids or any structural policy violation, or
 *   (`IDENTITY_SCOPE_MISMATCH`) for a cross-scope member identity.
 */
export declare function validatePolicyInput(input: EffectivePolicyInput): ValidatedPolicyInput;
//# sourceMappingURL=validate.d.ts.map