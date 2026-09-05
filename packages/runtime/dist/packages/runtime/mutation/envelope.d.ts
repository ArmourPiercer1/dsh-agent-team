/**
 * P7-T2 — the team autonomy/mutation envelope check of the mutation intake
 * (Architecture §19.3; invariants 36/37).
 *
 * The envelope is NOT re-computed here: this module reuses the FROZEN
 * P3-T4 `validatePolicyInput` envelope precomputation (blueprint
 * `autonomyEnvelope` ∩ member template `mutationEnvelope`, per cell;
 * absent/deny → ∅) — the single source of the §19.3 boundary semantics.
 *
 * Two checks exist, matching the two frozen escalation codes:
 *
 * - **member origin** (`MEMBER_SELF_ESCALATION`, invariant 37): the
 *   member's OWN cell envelope (blueprint ∩ that member's template
 *   mutationEnvelope);
 * - **leader origin** (`LEADER_OUT_OF_ENVELOPE`, invariant 36): a
 *   template-scoped overlay applies to EVERY member, so the leader is
 *   checked against the intersection of every registered member's cell
 *   envelope. When no member instance is registered yet there is no
 *   template envelope to intersect with — the check is skipped (the first
 *   registration cannot violate a boundary that has no members to bind);
 *   this is the design decision recorded in the P7-T2 design note.
 *
 * `deny` entries are ALWAYS admitted: a tightening overlay can never
 * escape the envelope (the resolver admits deny overlays unconditionally —
 * the same rule applied here at intake so the rejection is fail-closed at
 * the boundary, not only at resolution time).
 *
 * Human origin is checked here for NOTHING: the human override is not
 * bounded by the Team autonomy envelope (invariant 34) — it IS bounded by
 * the external hard facts, which the service checks separately for every
 * origin.
 *
 * @module @dsh-agent-team/runtime/mutation/envelope
 */
import type { BlueprintPolicyEnvelope, CapabilityName, MemberIdentity, PolicyEntry, TeamSessionId, TeamValueOrigin, TemplatePolicy } from '../../domain/policy/src/index.js';
/**
 * The cell envelope items of ONE member (the frozen computation):
 * blueprint `autonomyEnvelope` ∩ that member's template `mutationEnvelope`,
 * per capability (absent/deny on either side → empty set).
 *
 * @throws {@link MutationError} `MALFORMED_MUTATION_INPUT` when the stored
 *   blueprint/template facts are structurally malformed (the frozen
 *   `MALFORMED_POLICY_INPUT` mapped into this module's closed surface —
 *   a stored-facts integrity failure, not a request-shape failure).
 */
export declare function memberEnvelopeItems(teamSessionId: TeamSessionId, member: MemberIdentity, blueprint: BlueprintPolicyEnvelope, template: TemplatePolicy): ReadonlyMap<CapabilityName, ReadonlySet<string>>;
/**
 * The LEADER's effective envelope: the intersection of every registered
 * member's cell envelope (a template-scoped overlay must fit the boundary
 * of every member it will apply to). Returns `undefined` when no member
 * is registered (check skipped — see the module doc).
 */
export declare function teamEnvelopeItems(teamSessionId: TeamSessionId, members: readonly MemberIdentity[], blueprint: BlueprintPolicyEnvelope, templateFor: (teamSessionId: TeamSessionId, member: MemberIdentity) => TemplatePolicy): ReadonlyMap<CapabilityName, ReadonlySet<string>> | undefined;
/**
 * The intake check of ONE agent-origin cell value against its envelope.
 *
 * - `deny` values always pass (tightening can never escalate);
 * - an `allow` value passes only when EVERY item is inside the cell's
 *   envelope item set (an `undefined` envelope means "no check" — the
 *   no-registered-members leader case);
 * - a violation throws the frozen code string of the actor origin
 *   (`MEMBER_SELF_ESCALATION` / `LEADER_OUT_OF_ENVELOPE`) with the
 *   violating items and the cell envelope in `details`.
 */
export declare function checkAgainstEnvelope(capability: CapabilityName, entry: PolicyEntry, envelope: ReadonlyMap<CapabilityName, ReadonlySet<string>> | undefined, origin: TeamValueOrigin): void;
//# sourceMappingURL=envelope.d.ts.map