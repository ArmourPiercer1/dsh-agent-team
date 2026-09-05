/**
 * The pure policy resolver (P3-T4).
 *
 * `resolveEffectivePolicy` computes the effective policy of one member of
 * one TeamSession in the two frozen stages (Architecture §19.6):
 *
 * ```text
 * P_TeamResolved = Resolve(
 *     Blueprint, MemberTemplate, PolicyState,
 *     TemplateAutonomyOverlay, InstanceAutonomyOverlay,
 *     ExplicitHumanOverride
 * )
 * P_effective = P_externalHard ∩ P_capabilityExists ∩ P_TeamResolved
 * ```
 *
 * Stage 1 (Team domain, invariant 33 — resolved in the Team domain before
 * materialization to the DSH guard):
 *
 * - Each capability cell resolves by PRECEDENCE over the Team-owned value
 *   layers ({@link TEAM_LAYER_ORDER}: blueprint < policyState < template <
 *   templateOverlay < instanceOverlay < humanOverride). A cell no Team
 *   layer granted fails closed: deny (the explicit human override is the
 *   only layer that may grant such a cell, invariant 34).
 * - Autonomy overlays are ADMISSION-CHECKED against the Team autonomy
 *   envelope (blueprint ∩ template envelope, §19.3) before they may win:
 *   - a `deny` overlay always wins admission (it only tightens);
 *   - an `allow` overlay with items outside the envelope FAILS the whole
 *     resolution with a typed error — `MEMBER_SELF_ESCALATION` for
 *     member-origin (invariant 37), `LEADER_OUT_OF_ENVELOPE` for
 *     leader-origin (invariant 36). The resolver never resolves "around"
 *     a violating record.
 *   - an in-envelope `allow` overlay in a cell the current PolicyState
 *     LOCKS is "stored but suppressed" (§19.4): recorded in the output
 *     provenance, non-destructive, re-admissible if the state relaxes.
 *     Locking never suppresses a `deny` overlay (suppression must never
 *     loosen) and never suppresses an explicit human override (§19.5).
 * - The human override is NOT envelope-checked and NOT state-gated
 *   (invariant 34: it may exceed the Team autonomy boundary).
 *
 * Stage 2 (external intersection, un-bypassable — invariant 34, §25.4):
 *
 * - a missing capability (`capabilityExists[c] === false`) denies the cell
 *   for EVERY layer — an override cannot create a removed capability back
 *   (invariant 35, §21.5: compatibility drift instead);
 * - an external hard `deny` denies the cell for every layer;
 * - an external hard allow-list INTERSECTS the Team-allowed items
 *   (removed items are recorded per cell); an empty intersection denies.
 *
 * The output makes the provenance of EVERY value first-class data
 * (TaskDoc P3-T4 acceptance: "every effective value is explainable"):
 * winner layer/origin/record, the losing lower layers, the suppressed
 * overlays, the external facts and exactly which items were removed, plus
 * a deterministic one-line explanation per cell.
 *
 * Pure function: no I/O, no state mutation, no ambient state; the same
 * input always yields a deeply-equal output. The output is deep-frozen.
 *
 * @module @dsh-agent-team/domain/policy/resolve
 */
import type { EffectivePolicy, EffectivePolicyInput } from './types.js';
/**
 * Resolve the effective policy of one member of one TeamSession.
 *
 * @param input - the complete pure resolver input (validated at the
 *   boundary; see {@link validatePolicyInput}).
 * @returns the effective policy with full per-cell provenance.
 * @throws `PolicyResolutionError` (`MALFORMED_POLICY_INPUT`) for malformed
 *   ids or structural policy violations, (`IDENTITY_SCOPE_MISMATCH`) for a
 *   cross-scope member identity, and the escalation codes for overlays
 *   outside the Team autonomy envelope
 *   (`MEMBER_SELF_ESCALATION`) / (`LEADER_OUT_OF_ENVELOPE`) for an
 *   out-of-envelope autonomy overlay.
 */
export declare function resolveEffectivePolicy(input: EffectivePolicyInput): EffectivePolicy;
//# sourceMappingURL=resolve.d.ts.map