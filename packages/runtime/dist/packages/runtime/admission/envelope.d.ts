/**
 * P6-T2 — step 3 of the documented enforcement order: caller authority +
 * mutation envelope.
 *
 * The mutation envelope is the operation-level allow/deny boundary of the
 * caller's authority (Architecture §5.4/§19.3). The P6-T1
 * `computeOverlayBounds` semantics are REUSED, not forked: an operation is
 * in-bounds only when every applicable allow-set allows it and no
 * applicable deny-set denies it — an absent envelope or an absent operation
 * is OUT OF BOUNDS, the boundary fails closed.
 *
 * Per-role envelope (documented):
 * - `human`: NOT bounded by the team autonomy envelope (invariant 34: the
 *   human override may exceed team autonomy). The External Hard Policy is
 *   per-CAPABILITY (ExternalPolicyFacts.hard), enforced by the policy
 *   resolver at the capability level; the v1 contracts carry no op-level
 *   external hard deny, so every closed op is human-allowed. (Documented
 *   ruling — no invented op-level external vocabulary.)
 * - `leader`: the team autonomy envelope — `blueprint.teamEnvelope`
 *   (invariant 36: the leader never exceeds it). When the blueprint also
 *   carries a member-envelope entry for the leader template, that entry is
 *   additionally intersected (it only tightens).
 * - `member`: the team envelope ∩ the member template's envelope ∩ the
 *   member's instance autonomy overlay (when stored). The overlay's
 *   operation-level bounds live under the `envelope` key of the record's
 *   free-form `values` field (P6-T2 convention for the storage schema's
 *   `values: RemoteSafeRecord`; the policy-domain cell interpretation of
 *   the same field is untouched and orthogonal). An overlay WITHOUT an
 *   `envelope` key constrains no operations (capability-cell overlays).
 *
 * Self-escalation (invariant 37): a member's envelope is the
 * INTERSECTION of team + template (+ overlay) — a member cannot grant
 * itself an operation none of its three allow-sets contains. There is no
 * self-grant path in the facade (overlays are written by other authority,
 * never by the member being bounded).
 */
import type { TeamBlueprint } from '../../domain/blueprint/src/index.js';
import type { GovernanceOverrideRecord } from '../../storage/schema/index.js';
import { LEADER_INSTANCE_ID } from '../../contracts/src/index.js';
import type { ActionSpec } from './actions.js';
import type { ResolvedCaller } from './resolve.js';
/**
 * Extract the operation-level envelope from one durable override record's
 * free-form `values` (the P6-T2 convention). Returns undefined when the
 * record carries no op-level envelope (capability-cell overlays).
 */
export declare function overlayEnvelopeOf(record: GovernanceOverrideRecord): {
    readonly allow?: readonly string[];
    readonly deny?: readonly string[];
} | undefined;
/**
 * The caller's effective mutation envelope (the in-bounds op set,
 * deterministic order, fail closed).
 *
 * @param blueprint - the resolved bound blueprint.
 * @param caller - the resolved caller.
 * @param overrides - the team's durable governance override records.
 * @returns the in-bounds mutation operations.
 */
export declare function callerEnvelope(blueprint: TeamBlueprint, caller: ResolvedCaller, overrides: readonly GovernanceOverrideRecord[]): readonly string[];
/**
 * The complete closed mutation-operation vocabulary (the human ceiling and
 * the envelope-check reference).
 */
export declare const ALL_MUTATION_OPS: readonly string[];
/**
 * Step 3 — enforce the action's required ops against the caller's
 * effective envelope (fail closed).
 *
 * @param spec - the action spec.
 * @param envelope - the caller's effective envelope (in-bounds ops).
 * @throws {@link TeamRuntimeError} ENVELOPE_OUT_OF_BOUNDS.
 */
export declare function enforceEnvelope(spec: ActionSpec, envelope: readonly string[]): void;
export { LEADER_INSTANCE_ID };
//# sourceMappingURL=envelope.d.ts.map