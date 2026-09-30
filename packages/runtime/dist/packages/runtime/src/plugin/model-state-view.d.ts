/**
 * P8-S7-R2 (R2-3) — BQ-11: the model state view of one member (DevPlan
 * P8-S §22 BQ-11: "current model / next-boundary pending model / Team
 * constraint/provenance / availability"; UI rows D09/H06/H09/H10/H12).
 *
 * pre-alpha3 PR-B (plan §B.2/§B.3): the view resolves the model cell of
 * ONE member through the ONE canonical read (`readEffectivePolicy`) over
 * the SAME durable facts the R2-2 effective-config view consumes — the
 * production step clock is RETIRED as a decision source:
 *
 * - `current` — the COMMITTED model: the durable PolicyState (the last
 *   committed transition in commit order, else the implicit `default`) +
 *   the governance slot winners + the static layers (the bound snapshot
 *   through the production PolicyReader). A host restart derives the SAME
 *   view from the SAME durable truth (no process-local policy truth).
 * - `pendingNextBoundary` — the NEXT-BOUNDARY entry: present when a
 *   durable fact may not yet be applied by this process (a committed
 *   PolicyState transition, or a winning value backed by an admitted
 *   durable record). The boundary-application set is PROCESS-LOCAL
 *   (absent in the durable projection), so the projection reports
 *   conservatively (the R2-2 two-horizon ruling, re-based from step
 *   horizons onto the committed/applied split). The entry's `state` is
 *   `pending-next-boundary` when a concrete model value applies at the
 *   next boundary; when no model applies there (team deny, capability
 *   absence, external hard facts, malformed item) the entry carries the
 *   corresponding `denied` / `unavailable` state with `value: null` —
 *   the UI reads "the next request has no model" from it.
 * - `provenance` — the winning Team layer of the model cell at the
 *   committed horizon (layer / origin / record id — the §18.3 source)
 *   plus the frozen resolver's per-cell explanation line.
 * - `availability` — the TEAM-SIDE availability (H10): `unavailable`
 *   exactly when the current entry is `denied` or `unavailable` (the Team
 *   constraint removed the model), `available` otherwise (a concrete
 *   selection applies, including the world baseline for `unspecified`
 *   cells). The ND-03 substrate/browser adapter facts are a DIFFERENT
 *   concern (the R1 cluster) and are out of this view by design.
 *
 * The legacy `effectiveFromStep` display of the pre-PR-B two-horizon view
 * (the `effectiveFrom` key sourced from the step fields) is RETIRED: the
 * frozen v2 key remains part of the closed DTO shape (DURATIONAL-optional)
 * but the production derivation never sets it (there is no runtime step
 * anymore — plan §B.2 "legacy step fields keep parse/display only" and the
 * process-local step fields are test-world-only).
 *
 * When the canonical read rejects the input (a malformed stored payload —
 * fail closed), this function THROWS the typed frozen error; the caller
 * catches and drops the `modelState` key (the row keeps its other fields).
 *
 * @module @dsh-agent-team/runtime/plugin/model-state-view
 */
import type { MemberModelStateDto } from '../../../contracts/src/index.js';
import type { ModelSelection } from '../../agent-setup/model/index.js';
import type { PolicyReader, PolicyStateTransitionRecord } from '../../mutation/index.js';
import type { GovernanceOverrideRecord } from '../../../storage/schema/index.js';
/** The arguments of {@link createModelStateView}. */
export interface ModelStateViewArgs {
    /** The TeamSession (root session) id the member belongs to. */
    readonly teamSessionId: string;
    /** The member's stable instance id. */
    readonly instanceId: string;
    /** The world baseline model selection (the harness-injected static model). */
    readonly staticModel: ModelSelection;
    /**
     * The member's durable PolicyState transitions (COMMIT order — the
     * ledger sequence order; the LAST entry is the committed state).
     */
    readonly transitions: readonly PolicyStateTransitionRecord[];
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