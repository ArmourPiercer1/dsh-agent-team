/**
 * MemberModelStateDto — the BQ-11 model state view of one member (or the
 * LeaderInstance) of a TeamSession (DevPlan P8-S §22 BQ-11: "current model
 * / next-boundary pending model / Team constraint/provenance /
 * availability"; UI §18.2 model row, rows D09/H06/H09/H10/H12).
 *
 * Design facts (frozen 20260829 plan docs + the S7-R2 R80 ruling):
 *
 * - The view is a per-member embedded value under the member projection
 *   row: DURATIONAL-optional at the member level (the `modelState` key is
 *   ABSENT when the view cannot be derived — never an own `undefined` key),
 *   present for every row of a projection v2 (S7-R2) production read.
 * - `current` is the model of the CURRENT boundary (the NOW horizon: the
 *   production step clock is pinned to 0, so the policy state active at
 *   step 0; record-backed winning values are conservatively
 *   pending, same two-horizon ruling as the R2-2 effective-config view).
 * - `pendingNextBoundary` is DURATIONAL-optional at the view level: the
 *   key is ABSENT when nothing is pending for the model cell (no pending
 *   PolicyState transition, no admitted-but-unapplied override record);
 *   present when either exists, carrying the model of the NEXT boundary
 *   (the maximum step horizon) and, when derivable, the step it applies
 *   from (`effectiveFrom`).
 * - `provenance` is the winning Team layer of the model cell at the NOW
 *   horizon (the §18.3 source: layer / origin / record id) plus the frozen
 *   resolver's per-cell explanation line (the p7t2 provenance fact,
 *   consumed verbatim — H12 "Team provenance on the Root model").
 * - `availability` is the TEAM-SIDE availability (H10): `unavailable`
 *   when the Team constraint denies or makes the current model
 *   inapplicable (team deny, capability absence, external hard facts,
 *   malformed item); `available` otherwise (a concrete selection applies,
 *   including the world baseline for `unspecified` cells). The ND-03
 *   substrate/browser adapter facts are a DIFFERENT concern (the R1
 *   cluster) and are intentionally OUT of this view.
 * - The entry field shape reuses the R2-2 effective-config entry
 *   vocabularies (value / source / state + the optional `deniedBy` /
 *   `unavailable` / `effectiveFrom` provenance keys) so the UI renders the
 *   model row from one closed vocabulary. The `suppressed` and `locked`
 *   keys of the effective-config entry are NOT part of this view:
 *   suppressed overlays and the workspace lock belong to their own lanes.
 *
 * Pure module: no I/O, no runtime environment assumptions.
 * @module @dsh-agent-team/contracts/projection/model-state
 */
import type { EffectiveConfigSource, EffectiveConfigState } from './effective-config.js';
/**
 * The model value display bound (one `provider/model` selection string, or
 * `null` when no model applies). Same bound as the effective-config entry.
 */
export declare const MODEL_STATE_VALUE_MAX_LENGTH = 512;
/** The `deniedBy` provenance string bound (opaque, same as effective-config). */
export declare const MODEL_STATE_DENIED_BY_MAX_LENGTH = 128;
/** The resolver explanation line bound (defensive clamp at the producer). */
export declare const MODEL_STATE_EXPLANATION_MAX_LENGTH = 512;
/**
 * The winning Team layer of the model cell (the §18.3 source vocabulary —
 * the closed `TeamLayerOrUnspecified` set of the domain policy package,
 * mirrored here: the contracts package does not import the domain).
 */
export declare const MODEL_STATE_LAYER_VALUES: readonly string[];
/**
 * Who supplied the winning value (the closed `TeamValueOrigin` set of the
 * domain policy package, mirrored here).
 */
export declare const MODEL_STATE_ORIGIN_VALUES: readonly string[];
/** The team-side availability states of the model (H10). */
export declare const MODEL_STATE_AVAILABILITY_VALUES: readonly string[];
/** The availability type. */
export type ModelStateAvailability = (typeof MODEL_STATE_AVAILABILITY_VALUES)[number];
/** The exact frozen fields of the MemberModelStateDto (closed). */
export declare const MODEL_STATE_FIELDS: readonly string[];
/** The DURATIONAL-optional view keys (present when the fact holds; ABSENT otherwise). */
export declare const MODEL_STATE_OPTIONAL_FIELDS: readonly string[];
/** The exact frozen fields of one model state entry (closed). */
export declare const MODEL_STATE_ENTRY_FIELDS: readonly string[];
/** The DURATIONAL-optional entry keys (present when the fact holds; ABSENT otherwise). */
export declare const MODEL_STATE_ENTRY_OPTIONAL_FIELDS: readonly string[];
/** The exact frozen fields of the model state provenance (closed). */
export declare const MODEL_STATE_PROVENANCE_FIELDS: readonly string[];
/**
 * One model state entry: the model value at ONE boundary (current or
 * next), with the closed effective-config source/state vocabularies and
 * the additive provenance keys (absent when the fact does not hold).
 */
export interface ModelStateEntryDto {
    /**
     * The model value (`provider/model`), or `null` when no model applies at
     * that boundary (denied / unavailable / unspecified-without-baseline).
     * A REQUIRED key — `null`, never absent.
     */
    readonly value: string | null;
    /** The closed effective-config source of the value. */
    readonly source: EffectiveConfigSource;
    /** The closed effective-config state of the value at that boundary. */
    readonly state: EffectiveConfigState;
    /** Who/what denied the cell (absent when the cell is granted). */
    readonly deniedBy?: string;
    /** True when the value cannot be applied (capability absent / malformed). */
    readonly unavailable?: boolean;
    /** The step at which the value applies (next-boundary entries only). */
    readonly effectiveFrom?: number;
}
/**
 * The winning Team layer provenance of the model cell (the §18.3 source +
 * the frozen resolver's per-cell explanation line).
 */
export interface ModelStateProvenanceDto {
    /** The winning Team-owned layer, or `'unspecified'` (fail-closed default). */
    readonly layer: string;
    /** Who supplied the winning value (closed origin vocabulary). */
    readonly origin: string;
    /** The winner's record id, or `null` for static layers / unspecified. */
    readonly recordId: string | null;
    /** The frozen resolver's per-cell explanation line (lossless, ≤ 512). */
    readonly explanation: string;
}
/** The BQ-11 model state view of one member (see module docs). */
export interface MemberModelStateDto {
    /** The model of the current boundary (the NOW horizon). */
    readonly current: ModelStateEntryDto;
    /**
     * The model of the next boundary; key ABSENT when nothing is pending
     * for the model cell (never an own `undefined` key).
     */
    readonly pendingNextBoundary?: ModelStateEntryDto;
    /** The winning Team layer provenance of the model cell (NOW horizon). */
    readonly provenance: ModelStateProvenanceDto;
    /** The team-side availability (ND-03 substrate facts out of scope). */
    readonly availability: ModelStateAvailability;
}
/**
 * Parse one model state entry (closed field set; the optional provenance
 * keys are rejected when they are own `undefined` keys — the parse input
 * is a plain record the producer built by omitting absent keys).
 * @param value - the raw entry value.
 * @param field - the enclosing field name (for error context).
 * @returns the frozen entry.
 * @throws `MALFORMED_DTO` on any closed-set violation.
 */
export declare function parseModelStateEntry(value: unknown, field: string): ModelStateEntryDto;
/**
 * Parse the model state provenance (closed field set).
 * @param value - the raw provenance value.
 * @returns the frozen provenance.
 * @throws `MALFORMED_DTO` on any closed-set violation.
 */
export declare function parseModelStateProvenance(value: unknown): ModelStateProvenanceDto;
/**
 * Parse the BQ-11 model state view of one member (closed field set).
 * @param value - the raw model state value.
 * @returns the frozen view.
 * @throws `MALFORMED_DTO` on any closed-set violation.
 */
export declare function parseMemberModelState(value: unknown): MemberModelStateDto;
//# sourceMappingURL=model-state.d.ts.map