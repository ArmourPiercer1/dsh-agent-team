/**
 * P8-S7-R2 (R2-3) — BQ-11: the model state view of one member (DevPlan
 * P8-S §22 BQ-11: "current model / next-boundary pending model / Team
 * constraint/provenance / availability"; UI rows D09/H06/H09/H10/H12).
 *
 * The view resolves the model cell of ONE member twice through the FROZEN
 * P3-T4 resolver (reused verbatim, never re-implemented), over the SAME
 * durable layer facts the R2-2 effective-config view consumes:
 *
 * - `current` — the NOW horizon: the policy state active at the CURRENT
 *   step (the production step clock is pinned to 0, so the policy state
 *   of a fresh boundary). Record-backed winning values are conservatively
 *   pending in this horizon (the two-horizon ruling of R2-2: the
 *   boundary-application record set is PROCESS-LOCAL, appliedRecordIds
 *   empty in the durable projection).
 * - `pendingNextBoundary` — the NEXT horizon (the maximum step: every
 *   admitted future-boundary change is resolved). The key is present when
 *   something is pending FOR THE MODEL CELL: a PolicyState transition
 *   with `effectiveFromStep > currentStep`, or a winning value backed by
 *   an admitted-but-not-yet-applied record. The entry's `state` is
 *   `pending-next-boundary` when a concrete model value applies at the
 *   next boundary; when no model applies there (team deny, capability
 *   absence, external hard facts, malformed item) the entry carries the
 *   corresponding `denied` / `unavailable` state with `value: null` —
 *   the UI reads "the next request has no model" from it.
 * - `provenance` — the winning Team layer of the model cell at the NOW
 *   horizon (layer / origin / record id — the §18.3 source) plus the
 *   frozen resolver's per-cell explanation line: the p7t2 provenance
 *   fact, consumed verbatim (H12 "Team provenance on the Root model").
 * - `availability` — the TEAM-SIDE availability (H10): `unavailable`
 *   exactly when the current entry is `denied` or `unavailable` (the Team
 *   constraint removed the model), `available` otherwise (a concrete
 *   selection applies, including the world baseline for `unspecified`
 *   cells). The ND-03 substrate/browser adapter facts are a DIFFERENT
 *   concern (the R1 cluster) and are out of this view by design.
 *
 * When the resolver rejects the input (a malformed stored payload — fail
 * closed), this function THROWS the typed frozen error; the caller
 * catches and drops the `modelState` key (the row keeps its other fields).
 *
 * @module @dsh-agent-team/runtime/plugin/model-state-view
 */
import type { MemberModelStateDto } from '../../../contracts/src/index.js';
import type { ModelSelection } from '../../agent-setup/model/index.js';
import type { PolicyReader, PolicyStateTransitionRecord, StoredMutationRecord } from '../../mutation/index.js';
import type { GovernanceOverrideRecord } from '../../../storage/schema/index.js';
/** The arguments of {@link createModelStateView}. */
export interface ModelStateViewArgs {
    /** The TeamSession (root session) id the member belongs to. */
    readonly teamSessionId: string;
    /** The member's stable instance id. */
    readonly instanceId: string;
    /** The current step (the projection clock; the production pin is 0). */
    readonly currentStep: number;
    /** The world baseline model selection (the harness-injected static model). */
    readonly staticModel: ModelSelection;
    /** The member's durable PolicyState transitions (admission order). */
    readonly transitions: readonly PolicyStateTransitionRecord[];
    /** The member's durable mutation records (admission order). */
    readonly records: readonly StoredMutationRecord[];
    /** Every durable governance override record of the TeamSession. */
    readonly overrides: readonly GovernanceOverrideRecord[];
    /** The static policy reader (blueprint envelope / template / external). */
    readonly policyReader: PolicyReader;
}
/**
 * Resolve the BQ-11 model state view of one member.
 * @param args - the durable layer facts (see {@link ModelStateViewArgs}).
 * @returns the plain (unfrozen) view; the projection pipeline validates
 *   and deep-freezes it.
 * @throws the frozen policy resolver's typed error when the merged input
 *   is malformed (fail closed — the caller drops the view, never a
 *   partial one).
 */
export declare function createModelStateView(args: ModelStateViewArgs): MemberModelStateDto;
//# sourceMappingURL=model-state-view.d.ts.map