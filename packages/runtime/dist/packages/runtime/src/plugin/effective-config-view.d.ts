/**
 * P8-S7-R2 (R2-2) — BQ-08: the resolved effective-config view of one
 * member (the UI §18.1 / §18.2 per-field provenance surface).
 *
 * The durable projection v1 emitted the honest EMPTY view for every member
 * (`EMPTY_EFFECTIVE_CONFIG` in `projection-source.ts`): `value: null`,
 * source `blueprint`, state `unavailable` on all four frozen lanes. This
 * module closes that gap for the production composition: it resolves the
 * four lanes (model / workspace / permissions / autonomy) from the EXISTING
 * layer data — the bound blueprint envelope, the durable PolicyState
 * transitions, the durable governance `overrides`, and the static external
 * facts — through the ONE canonical effective-policy read (pre-alpha3
 * PR-B; the frozen P3-T4 resolver is reused verbatim inside it, never
 * re-implemented) plus this plane's
 * provenance derivations:
 *
 * - the policy is the ONE canonical read (`readEffectivePolicy`,
 *   pre-alpha3 PR-B, plan §B.2): the committed PolicyState (the last
 *   durable transition in COMMIT order — the production step clock is
 *   retired as a decision source), the durable governance `overrides`
 *   slot winners (the production write path — pre-alpha3 PR-A: the
 *   governance mutation authority's `setOverride`/`resetOverride` writes
 *   ONLY the storage `overrides` repository; the process-local
 *   mutation-store records lane has no production writer and is retired
 *   from this assembly), and the static layers (the bound snapshot
 *   through the production `PolicyReader`) — the SAME read the live
 *   request boundary and the R2-3 model-state view run;
 * - each capability cell's §18.3 provenance comes from `cellProvenance`
 *   (P8-S4B) with `appliedRecordIds = []` — the boundary-application
 *   record set is PROCESS-LOCAL, so the durable projection reports
 *   record-backed winning values conservatively as PENDING (the
 *   committed/applied ruling: the projection cannot observe the
 *   process-local applied set);
 * - the model lane additionally consumes `modelConsumptionView` (P5-T3),
 *   which applies the documented consumer rule: an `unspecified` cell
 *   keeps the world baseline (the harness-injected static model).
 *
 * Closed per-lane field shape (projection v2, `EffectiveConfigEntryV2`):
 * `value`, `source`, `state` (the v1 core) plus the DURATIONAL-optional
 * provenance keys `suppressed?`, `unavailable?`, `deniedBy?`,
 * `effectiveFrom?`, `locked?` — every optional key is ABSENT when the
 * fact does not hold (never an own `undefined` key; the contracts v2
 * parse enforces the closed set). This producer never sets `effectiveFrom`
 * (the legacy step display is retired with the production step clock —
 * the key stays part of the closed DTO shape for other producers).
 *
 * State precedence (highest first, per lane):
 *   unavailable > denied > pending-next-boundary > overridden > inherited
 * with two documented lane rules:
 * - the MODEL lane applies the baseline consumer rule BEFORE the team
 *   denial: an `unspecified` cell (Team silent — the fail-closed default)
 *   displays the baseline selection as `inherited` / source `capability`
 *   with NO `deniedBy` key (the denial is a consumption fact, not a UI
 *   denial of an active value); an EXTERNAL hard denial still displays
 *   `denied` (display honesty at the resolved horizon);
 * - the AUTONOMY lane expresses suppression as the STATE itself (the
 *   stored-but-suppressed overlay entry, §19.4 non-destructive) instead
 *   of a flag, and reports the highest active governance slot as
 *   `pending-next-boundary` (an applied override is process-local, so
 *   every active record-backed value is conservatively pending — the
 *   `overridden` state is therefore unreachable on this lane, by
 *   construction of the two-horizon ruling).
 *
 * This module is pure: no I/O, no DSH imports, no ambient state. The
 * caller (the production read-port dependency in `projection-source.ts`)
 * supplies every durable fact and receives a plain (unfrozen) DTO — the
 * projection pipeline validates and deep-freezes it. When the resolver
 * rejects the input (a malformed stored payload — fail closed), this
 * function THROWS the typed frozen error; the caller catches and falls
 * back to the v1 empty view.
 *
 * @module @dsh-agent-team/runtime/plugin/effective-config-view
 */
import type { EffectiveConfigDtoV2, EffectiveConfigSource, MemberLifecycleState } from '../../../contracts/src/index.js';
import type { TeamLayerOrUnspecified } from '../../../domain/policy/src/index.js';
import type { CellDeniedBy, PolicyReader, PolicyStateTransitionRecord } from '../../mutation/index.js';
import type { ModelSelection } from '../../agent-setup/model/index.js';
import type { GovernanceOverrideRecord } from '../../../storage/schema/index.js';
/** The arguments of {@link createEffectiveConfigView}. */
export interface EffectiveConfigViewArgs {
    /** The TeamSession (root session) id the member belongs to. */
    readonly teamSessionId: string;
    /** The member's stable instance id. */
    readonly instanceId: string;
    /** The member's durable lifecycle (the W2 workspace-lock signal). */
    readonly lifecycle: MemberLifecycleState;
    /** The member's own durable workspace (absent = inherited). */
    readonly memberWorkspace?: string;
    /** The TeamSession's durable default workspace (absent = none). */
    readonly teamDefaultWorkspace?: string;
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
 * Resolve one member's four-lane effective-config view (projection v2).
 * @param args - the durable layer facts (see {@link EffectiveConfigViewArgs}).
 * @returns the plain (unfrozen) v2 four-lane DTO; the projection pipeline
 *   validates and deep-freezes it.
 * @throws the frozen policy resolver's typed error when the merged input
 *   is rejected (malformed stored payload — fail closed); the caller
 *   falls back to the v1 empty view.
 */
export declare function createEffectiveConfigView(args: EffectiveConfigViewArgs): EffectiveConfigDtoV2;
/**
 * The §18.3 source word of the winning Team layer (the frozen lane map).
 * Exported for the R2-3 model-state view (same derivation, one source).
 */
export declare const SOURCE_BY_LAYER: Record<TeamLayerOrUnspecified, EffectiveConfigSource>;
/**
 * The Team layers CLOSER than the inherited base (blueprint / template).
 * Exported for the R2-3 model-state view (same derivation, one source).
 */
export declare const CLOSER_LAYERS: ReadonlySet<string>;
/**
 * Serialize the frozen `CellDeniedBy` derivation into the v2 `deniedBy`
 * provenance string (opaque, ≤ 128 chars, no control characters — the
 * layer / origin / reason values come from the closed frozen vocabulary).
 * Exported for the R2-3 model-state view (same derivation, one source).
 */
export declare function deniedByString(deniedBy: CellDeniedBy): string;
/**
 * True when the external stage (not a Team layer) decided the cell.
 * Exported for the R2-3 model-state view (same derivation, one source).
 */
export declare function externalHardDecides(note: string): boolean;
//# sourceMappingURL=effective-config-view.d.ts.map