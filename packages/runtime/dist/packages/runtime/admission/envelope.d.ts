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
 * The closed EXEC-authorization token vocabulary (exec-autonomy-contract,
 * user ruling 2026-09-18): the envelope tokens that gate the shell-class
 * TOOL CALLS (as opposed to the team-governance mutation actions of
 * {@link ALL_MUTATION_OPS}).
 *
 * A leader's allow-lane shell-class permission rule (`bash` / `pwsh` with
 * the whole-tool `any` resource — the leader-only allow-lane exception in
 * blueprint validation) authorizes the tool at runtime ONLY when the
 * leader's effective mutation envelope carries the matching token: the
 * pre-execute dual gate (see
 * `packages/runtime/operation-permission/pre-execute-adapter.ts`). The
 * two tokens are SEPARATE (`bash authority != pwsh authority`): the
 * envelope gates each shell tool independently.
 *
 * These tokens live in the same open-slug envelope fields as the
 * governance ops (`blueprint.teamEnvelope` / `memberEnvelopes`); they are
 * recognized HERE (the runtime) — the blueprint parse layer is unchanged
 * (envelope tokens were always open slugs).
 */
export declare const ENVELOPE_EXEC_OPS: readonly string[];
/**
 * The LEADER's effective envelope restricted to the exec-authorization
 * tokens (exec-autonomy-contract, user ruling 2026-09-18) — the dual
 * gate's input.
 *
 * Formula (the SAME leader branch as {@link callerEnvelope}):
 * `teamEnvelope.allow − teamEnvelope.deny`, further intersected with the
 * leader template's `memberEnvelopes` entry `allow − deny` when such an
 * entry exists (it only tightens), ∩ {@link ENVELOPE_EXEC_OPS}.
 *
 * Fail closed: an absent `teamEnvelope` = the empty set (no exec
 * authorization). The instance autonomy overlay does NOT apply here — it
 * is a MEMBER mechanism (see {@link callerEnvelope}); the leader's
 * effective envelope is the team ∩ template-entry intersection, full
 * stop.
 *
 * @param blueprint - the resolved bound blueprint.
 * @returns the exec tokens the leader's effective envelope carries
 *   (deterministic order: the team allow-list order).
 */
export declare function leaderExecEnvelopeOps(blueprint: TeamBlueprint): readonly string[];
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