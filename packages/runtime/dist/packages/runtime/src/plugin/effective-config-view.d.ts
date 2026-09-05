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
 * transitions, the mutation-store records, the durable governance
 * `overrides`, and the static external facts — through the FROZEN P3-T4
 * resolver (reused verbatim, never re-implemented) plus this plane's
 * provenance derivations:
 *
 * - the policy input is assembled by `assembleEffectivePolicyInput`
 *   (the P7-T2 adapter, reused verbatim) over the member's durable
 *   transitions + records at the maximum step horizon (`atStep =
 *   Number.MAX_SAFE_INTEGER` — the production step clock is pinned to 0,
 *   so the resolved horizon sees every admitted future-boundary change);
 * - the durable governance `overrides` (the production write path —
 *   `override.set` / `admitGovernanceOverride` writes ONLY the storage
 *   `overrides` repository; the mutation-store records lane has no
 *   production caller) are merged in through `selectPolicyOverrides`
 *   (the P8-S4B deterministic slot selection, reused verbatim): a
 *   mutation-store slot wins when present (the test world), the
 *   governance slot fills whatever the store did not produce (the
 *   production world);
 * - each capability cell's §18.3 provenance comes from `cellProvenance`
 *   (P8-S4B) with `appliedRecordIds = []` — the boundary-application
 *   record set is PROCESS-LOCAL, so the durable projection reports
 *   record-backed winning values conservatively as PENDING (documented
 *   two-horizon ruling: NOW = 0, NEXT = the maximum step);
 * - the model lane additionally consumes `modelConsumptionView` (P5-T3),
 *   which applies the documented consumer rule: an `unspecified` cell
 *   keeps the world baseline (the harness-injected static model).
 *
 * Closed per-lane field shape (projection v2, `EffectiveConfigEntryV2`):
 * `value`, `source`, `state` (the v1 core) plus the DURATIONAL-optional
 * provenance keys `suppressed?`, `unavailable?`, `deniedBy?`,
 * `effectiveFrom?`, `locked?` — every optional key is ABSENT when the
 * fact does not hold (never an own `undefined` key; the contracts v2
 * parse enforces the closed set).
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
import type { CellDeniedBy, PolicyReader, PolicyStateTransitionRecord, StoredMutationRecord } from '../../mutation/index.js';
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
/**
 * The v2 `effectiveFrom` of a pending value: the record's durable
 * `effectiveFromStep` when the winning source is backed by a record of the
 * MUTATION lane (safe integer ≥ 1) — otherwise the key is ABSENT (the
 * governance records carry no step; their pending changes are boundary-
 * based without a step, documented per producer).
 */
/**
 * Exported for the R2-3 model-state view (same derivation, one source).
 */
export declare function effectiveFromOf(recordId: string | null, records: readonly StoredMutationRecord[]): number | undefined;
//# sourceMappingURL=effective-config-view.d.ts.map