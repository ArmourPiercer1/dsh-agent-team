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

import {
  assertFieldPresent,
  assertNoUnknownFields,
  assertPlainRecord,
} from '../dto/common.js'
import { teamContractError } from '../errors.js'
import { deepFreeze } from '../remote-safe.js'
import {
  EFFECTIVE_CONFIG_SOURCE_VALUES,
  EFFECTIVE_CONFIG_STATE_VALUES,
  isEffectiveConfigSource,
  isEffectiveConfigState,
} from './effective-config.js'
import type { EffectiveConfigSource, EffectiveConfigState } from './effective-config.js'

// --- closed vocabularies -----------------------------------------------------------

/**
 * The model value display bound (one `provider/model` selection string, or
 * `null` when no model applies). Same bound as the effective-config entry.
 */
export const MODEL_STATE_VALUE_MAX_LENGTH = 512

/** The `deniedBy` provenance string bound (opaque, same as effective-config). */
export const MODEL_STATE_DENIED_BY_MAX_LENGTH = 128

/** The resolver explanation line bound (defensive clamp at the producer). */
export const MODEL_STATE_EXPLANATION_MAX_LENGTH = 512

/**
 * The winning Team layer of the model cell (the §18.3 source vocabulary —
 * the closed `TeamLayerOrUnspecified` set of the domain policy package,
 * mirrored here: the contracts package does not import the domain).
 */
export const MODEL_STATE_LAYER_VALUES: readonly string[] = [
  'blueprint',
  'policyState',
  'template',
  'templateOverlay',
  'instanceOverlay',
  'humanOverride',
  'unspecified',
]

/**
 * Who supplied the winning value (the closed `TeamValueOrigin` set of the
 * domain policy package, mirrored here).
 */
export const MODEL_STATE_ORIGIN_VALUES: readonly string[] = [
  'static',
  'leader',
  'member',
  'human',
]

/** The team-side availability states of the model (H10). */
export const MODEL_STATE_AVAILABILITY_VALUES: readonly string[] = ['available', 'unavailable']

/** The availability type. */
export type ModelStateAvailability = (typeof MODEL_STATE_AVAILABILITY_VALUES)[number]

// --- field sets ----------------------------------------------------------------------

/** The exact frozen fields of the MemberModelStateDto (closed). */
export const MODEL_STATE_FIELDS: readonly string[] = [
  'current',
  'pendingNextBoundary',
  'provenance',
  'availability',
]

/** The DURATIONAL-optional view keys (present when the fact holds; ABSENT otherwise). */
export const MODEL_STATE_OPTIONAL_FIELDS: readonly string[] = ['pendingNextBoundary']

/** The exact frozen fields of one model state entry (closed). */
export const MODEL_STATE_ENTRY_FIELDS: readonly string[] = [
  'value',
  'source',
  'state',
  'deniedBy',
  'unavailable',
  'effectiveFrom',
]

/** The DURATIONAL-optional entry keys (present when the fact holds; ABSENT otherwise). */
export const MODEL_STATE_ENTRY_OPTIONAL_FIELDS: readonly string[] = [
  'deniedBy',
  'unavailable',
  'effectiveFrom',
]

/** The exact frozen fields of the model state provenance (closed). */
export const MODEL_STATE_PROVENANCE_FIELDS: readonly string[] = [
  'layer',
  'origin',
  'recordId',
  'explanation',
]

// --- types ---------------------------------------------------------------------------

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
  readonly value: string | null
  /** The closed effective-config source of the value. */
  readonly source: EffectiveConfigSource
  /** The closed effective-config state of the value at that boundary. */
  readonly state: EffectiveConfigState
  /** Who/what denied the cell (absent when the cell is granted). */
  readonly deniedBy?: string
  /** True when the value cannot be applied (capability absent / malformed). */
  readonly unavailable?: boolean
  /** The step at which the value applies (next-boundary entries only). */
  readonly effectiveFrom?: number
}

/**
 * The winning Team layer provenance of the model cell (the §18.3 source +
 * the frozen resolver's per-cell explanation line).
 */
export interface ModelStateProvenanceDto {
  /** The winning Team-owned layer, or `'unspecified'` (fail-closed default). */
  readonly layer: string
  /** Who supplied the winning value (closed origin vocabulary). */
  readonly origin: string
  /** The winner's record id, or `null` for static layers / unspecified. */
  readonly recordId: string | null
  /** The frozen resolver's per-cell explanation line (lossless, ≤ 512). */
  readonly explanation: string
}

/** The BQ-11 model state view of one member (see module docs). */
export interface MemberModelStateDto {
  /** The model of the current boundary (the NOW horizon). */
  readonly current: ModelStateEntryDto
  /**
   * The model of the next boundary; key ABSENT when nothing is pending
   * for the model cell (never an own `undefined` key).
   */
  readonly pendingNextBoundary?: ModelStateEntryDto
  /** The winning Team layer provenance of the model cell (NOW horizon). */
  readonly provenance: ModelStateProvenanceDto
  /** The team-side availability (ND-03 substrate facts out of scope). */
  readonly availability: ModelStateAvailability
}

// --- parsing ---------------------------------------------------------------------------

/**
 * Parse one model state entry (closed field set; the optional provenance
 * keys are rejected when they are own `undefined` keys — the parse input
 * is a plain record the producer built by omitting absent keys).
 * @param value - the raw entry value.
 * @param field - the enclosing field name (for error context).
 * @returns the frozen entry.
 * @throws `MALFORMED_DTO` on any closed-set violation.
 */
export function parseModelStateEntry(value: unknown, field: string): ModelStateEntryDto {
  const record = assertPlainRecord(value, field)
  assertNoUnknownFields(record, MODEL_STATE_ENTRY_FIELDS, field)
  for (const key of MODEL_STATE_ENTRY_FIELDS) {
    if (MODEL_STATE_ENTRY_OPTIONAL_FIELDS.includes(key)) continue
    assertFieldPresent(record, key, field)
  }
  const valueField = record['value']
  if (
    valueField !== null &&
    !(typeof valueField === 'string' && valueField.length > 0 && valueField.length <= MODEL_STATE_VALUE_MAX_LENGTH)
  ) {
    throw teamContractError(
      'MALFORMED_DTO',
      `${field}.value must be a non-empty string of at most ${MODEL_STATE_VALUE_MAX_LENGTH} characters or null, got ${JSON.stringify(valueField)}`,
      { field: `${field}.value` },
    )
  }
  const source = record['source']
  if (!isEffectiveConfigSource(source)) {
    throw teamContractError(
      'MALFORMED_DTO',
      `${field}.source must be one of ${EFFECTIVE_CONFIG_SOURCE_VALUES.join(' | ')}, got ${JSON.stringify(source)}`,
      { field: `${field}.source` },
    )
  }
  const state = record['state']
  if (!isEffectiveConfigState(state)) {
    throw teamContractError(
      'MALFORMED_DTO',
      `${field}.state must be one of ${EFFECTIVE_CONFIG_STATE_VALUES.join(' | ')}, got ${JSON.stringify(state)}`,
      { field: `${field}.state` },
    )
  }
  const out: {
    value: string | null
    source: EffectiveConfigSource
    state: EffectiveConfigState
    deniedBy?: string
    unavailable?: boolean
    effectiveFrom?: number
  } = { value: valueField, source, state }
  const deniedBy = record['deniedBy']
  if (deniedBy !== undefined) {
    if (typeof deniedBy !== 'string' || deniedBy.length === 0 || deniedBy.length > MODEL_STATE_DENIED_BY_MAX_LENGTH) {
      throw teamContractError(
        'MALFORMED_DTO',
        `${field}.deniedBy must be a non-empty string of at most ${MODEL_STATE_DENIED_BY_MAX_LENGTH} characters, got ${JSON.stringify(deniedBy)}`,
        { field: `${field}.deniedBy` },
      )
    }
    out.deniedBy = deniedBy
  }
  const unavailable = record['unavailable']
  if (unavailable !== undefined) {
    if (typeof unavailable !== 'boolean') {
      throw teamContractError(
        'MALFORMED_DTO',
        `${field}.unavailable must be a boolean, got ${JSON.stringify(unavailable)}`,
        { field: `${field}.unavailable` },
      )
    }
    out.unavailable = unavailable
  }
  const effectiveFrom = record['effectiveFrom']
  if (effectiveFrom !== undefined) {
    if (
      typeof effectiveFrom !== 'number' ||
      !Number.isSafeInteger(effectiveFrom) ||
      effectiveFrom < 0
    ) {
      throw teamContractError(
        'MALFORMED_DTO',
        `${field}.effectiveFrom must be a non-negative safe integer, got ${JSON.stringify(effectiveFrom)}`,
        { field: `${field}.effectiveFrom` },
      )
    }
    out.effectiveFrom = effectiveFrom
  }
  return deepFreeze(out)
}

/**
 * Parse the model state provenance (closed field set).
 * @param value - the raw provenance value.
 * @returns the frozen provenance.
 * @throws `MALFORMED_DTO` on any closed-set violation.
 */
export function parseModelStateProvenance(value: unknown): ModelStateProvenanceDto {
  const record = assertPlainRecord(value, 'provenance')
  assertNoUnknownFields(record, MODEL_STATE_PROVENANCE_FIELDS, 'provenance')
  for (const key of MODEL_STATE_PROVENANCE_FIELDS) assertFieldPresent(record, key, 'provenance')
  const layer = record['layer']
  if (typeof layer !== 'string' || !MODEL_STATE_LAYER_VALUES.includes(layer)) {
    throw teamContractError(
      'MALFORMED_DTO',
      `provenance.layer must be one of ${MODEL_STATE_LAYER_VALUES.join(' | ')}, got ${JSON.stringify(layer)}`,
      { field: 'provenance.layer' },
    )
  }
  const origin = record['origin']
  if (typeof origin !== 'string' || !MODEL_STATE_ORIGIN_VALUES.includes(origin)) {
    throw teamContractError(
      'MALFORMED_DTO',
      `provenance.origin must be one of ${MODEL_STATE_ORIGIN_VALUES.join(' | ')}, got ${JSON.stringify(origin)}`,
      { field: 'provenance.origin' },
    )
  }
  const recordId = record['recordId']
  if (
    recordId !== null &&
    !(typeof recordId === 'string' && recordId.length > 0 && recordId.length <= 128)
  ) {
    throw teamContractError(
      'MALFORMED_DTO',
      'provenance.recordId must be a non-empty string of at most 128 characters or null, got ' +
        `${JSON.stringify(recordId)}`,
      { field: 'provenance.recordId' },
    )
  }
  const explanation = record['explanation']
  if (typeof explanation !== 'string' || explanation.length > MODEL_STATE_EXPLANATION_MAX_LENGTH) {
    throw teamContractError(
      'MALFORMED_DTO',
      `provenance.explanation must be a string of at most ${MODEL_STATE_EXPLANATION_MAX_LENGTH} characters, got ${JSON.stringify(explanation)}`,
      { field: 'provenance.explanation' },
    )
  }
  return deepFreeze({ layer, origin, recordId, explanation })
}

/**
 * Parse the BQ-11 model state view of one member (closed field set).
 * @param value - the raw model state value.
 * @returns the frozen view.
 * @throws `MALFORMED_DTO` on any closed-set violation.
 */
export function parseMemberModelState(value: unknown): MemberModelStateDto {
  const record = assertPlainRecord(value, 'modelState')
  assertNoUnknownFields(record, MODEL_STATE_FIELDS, 'modelState')
  for (const key of MODEL_STATE_FIELDS) {
    if (MODEL_STATE_OPTIONAL_FIELDS.includes(key)) continue
    assertFieldPresent(record, key, 'modelState')
  }
  const availability = record['availability']
  if (
    typeof availability !== 'string' ||
    !MODEL_STATE_AVAILABILITY_VALUES.includes(availability)
  ) {
    throw teamContractError(
      'MALFORMED_DTO',
      `modelState.availability must be one of ${MODEL_STATE_AVAILABILITY_VALUES.join(' | ')}, got ${JSON.stringify(availability)}`,
      { field: 'modelState.availability' },
    )
  }
  const out: {
    current: ModelStateEntryDto
    pendingNextBoundary?: ModelStateEntryDto
    provenance: ModelStateProvenanceDto
    availability: ModelStateAvailability
  } = {
    current: parseModelStateEntry(record['current'], 'modelState.current'),
    provenance: parseModelStateProvenance(record['provenance']),
    availability,
  }
  const pending = record['pendingNextBoundary']
  if (pending !== undefined) out.pendingNextBoundary = parseModelStateEntry(pending, 'modelState.pendingNextBoundary')
  return deepFreeze(out)
}
