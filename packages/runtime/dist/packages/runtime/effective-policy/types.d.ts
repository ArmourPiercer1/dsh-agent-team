/**
 * pre-alpha3 PR-B — the canonical EffectivePolicy read plane (plan §B.2,
 * ADR-03 successor): the SINGLE public read entry through which every
 * consumer (the live request boundary, the activation step 8, the
 * inspect-config action, the effective-config projection, the model-state
 * view) obtains one member's effective policy from the DURABLE facts.
 *
 * The plane replaces the two historically divergent production assemblies:
 * the request surface's `resolveActivationPolicy` (overrides only, the
 * PolicyState layer pinned to `default`, the blueprint/template layers
 * caller-supplied) and the config view's `assembleEffectivePolicyInput`
 * (a step-horizon read of the process-local mutation store). Both are
 * retired from the production decision path; their frozen building blocks
 * are REUSED VERBATIM (never re-implemented):
 *
 * - `selectPolicyOverrides` (P8-S4B deterministic slot selection) — the
 *   override winners;
 * - `resolveEffectivePolicy` (P3-T4 frozen resolver) — the layer merge;
 * - the production `PolicyReader` (the bound-snapshot static facts: the
 *   blueprint envelope, the per-member template policy, the external hard
 *   facts) — the SAME reader the governance mutation authority uses for
 *   its write-time checks (one static-facts authority);
 * - the durable PolicyState commits (the ledger-backed transition list in
 *   admission order) — the committed state layer.
 *
 * The STEP CONCEPT is retired as a production decision source (plan §B.2):
 * the committed PolicyState is the LAST durable transition in admission
 * order — the step fields (`requestedAtStep` / `effectiveFromStep`) remain
 * parseable/displayable on the legacy records but no longer decide what is
 * effective. In the production flow every committed transition carries the
 * pinned pair (requested 0 / effective 1), so "last in admission order"
 * is exactly the state every committed switch intends to be live at the
 * NEXT request boundary — the committed/applied split is expressed by the
 * views (`pendingNextBoundary` / the process-local `appliedRecordIds`
 * set), not by a fake runtime clock.
 *
 * The read is PURE (no I/O): the caller supplies every durable fact.
 *
 * @module @dsh-agent-team/runtime/effective-policy
 */
import type { AutonomyOverlayRecord, EffectivePolicy, HumanOverrideRecord, PolicyStateView } from '../../domain/policy/src/index.js';
import type { GovernanceOverrideRecord } from '../../storage/schema/index.js';
import type { DurableOverrideRef, PolicyReader, PolicyStateTransitionRecord } from '../mutation/index.js';
/**
 * The inputs of the canonical read (every field is a DURABLE fact or the
 * static-facts authority — nothing process-local).
 */
export interface EffectivePolicyReadArgs {
    /** The owning TeamSession (root session) id. */
    readonly rootSessionId: string;
    /** The addressed MemberInstance. */
    readonly instanceId: string;
    /**
     * The static policy authority (the bound-snapshot reader: the blueprint
     * envelope, the per-member template policy, the external hard facts).
     * The production root passes the SAME instance the governance mutation
     * authority uses (one static-facts authority).
     */
    readonly policy: PolicyReader;
    /**
     * The member's durable PolicyState transitions (admission order — the
     * ledger sequence order; the LAST entry is the committed state).
     */
    readonly transitions: readonly PolicyStateTransitionRecord[];
    /** Every durable governance override record of the TeamSession. */
    readonly overrides: readonly GovernanceOverrideRecord[];
}
/**
 * The canonical read result: the frozen effective policy + the durable
 * facts it was resolved from (the consumers derive their per-capability
 * views from this — no consumer re-assembles policy itself).
 */
export interface EffectivePolicyRead {
    /** The frozen effective policy (the backend truth every view derives from). */
    readonly policy: EffectivePolicy;
    /** The committed PolicyState (the last durable transition, else default). */
    readonly policyState: PolicyStateView;
    /** The durable transition the committed state came from (absent = default). */
    readonly policyStateTransition: PolicyStateTransitionRecord | null;
    /** The selected slot winners (the frozen P8-S4B selection result). */
    readonly templateOverlay?: AutonomyOverlayRecord;
    readonly instanceOverlay?: AutonomyOverlayRecord;
    readonly humanOverride?: HumanOverrideRecord;
    /**
     * The committed-generation marker: the highest override-record
     * generation among the selected slot winners (0 = no record-backed
     * winner). A writer that committed at a lower generation is stale
     * against this read; the next read after a new commit advances it.
     * (The frozen v1 wire carries no client expectedGeneration — the
     * marker is the in-process staleness anchor, pre-alpha3 PR-A ruling.)
     */
    readonly committedGeneration: number;
    /**
     * The durable override refs scoped to THIS member (team scope + this
     * instance) — the provenance input for the per-capability views.
     */
    readonly refs: readonly DurableOverrideRef[];
}
/**
 * The committed PolicyState of the durable transition list: the LAST
 * transition in admission order (the production step clock is retired —
 * plan §B.2; the pinned (0, 1) pair makes admission order the honest
 * commitment order). `null` transition = the implicit `default` state.
 */
export declare function committedPolicyState(transitions: readonly PolicyStateTransitionRecord[]): {
    readonly state: PolicyStateView;
    readonly transition: PolicyStateTransitionRecord | null;
};
/** The override refs scoped to one member (team scope + this instance). */
export declare function memberOverrideRefs(overrides: readonly GovernanceOverrideRecord[], instanceId: string): DurableOverrideRef[];
/** The generation of one selected slot winner (0 = none / not found). */
export declare function winnerGeneration(overrides: readonly GovernanceOverrideRecord[], recordId: string | undefined): number;
//# sourceMappingURL=types.d.ts.map