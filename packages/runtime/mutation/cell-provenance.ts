/**
 * P8-S4B — the backend-truth provenance derivation for one capability cell
 * (DevPlan P8-S §18.3: "Projection 后续必须能读到 effective value / source
 * / suppressed / unavailable / deniedBy / pending next boundary — 但本任务
 * 只负责 backend truth").
 *
 * {@link cellProvenance} is a PURE derivation over the frozen P3-T4
 * resolver's output ({@link EffectivePolicy}) plus the durable override
 * records of the TeamSession: it maps ONE capability cell of one member to
 * the six §18.3 fields, each as first-class, lossless-JSON data:
 *
 * - `effective` — the cell's effective value (the Team ∩ external result);
 * - `source` — the winning Team layer's provenance (layer / origin /
 *   record id; `layer: 'unspecified'` when no Team layer granted the cell —
 *   the Team domain then fails closed);
 * - `suppressed` — the stored-but-suppressed autonomy overlays of the cell
 *   (non-destructive preservation, §19.4);
 * - `unavailable` — `true` when the capability value cannot be applied
 *   because the substrate reports the capability absent (external
 *   `capabilityMissing`); capability-specific unavailability (e.g. a
 *   malformed model item) is computed by the consuming view;
 * - `deniedBy` — who/what denied the cell, with the layer/origin/record
 *   provenance for Team denials and the frozen external-stage reason for
 *   external denials (absent when the cell is allowed);
 * - `pendingNextBoundary` — the durable records that admit a value for
 *   this cell but were NOT part of the session's last applied boundary
 *   (the mutation is admitted durably and takes effect from the NEXT
 *   request boundary only — the in-flight request keeps its resolution).
 *
 * Pure module: no I/O, no live Agent, no `node:` builtin, no ambient state.
 * @module @dsh-agent-team/runtime/mutation/cell-provenance
 */

import type {
  CapabilityName,
  EffectivePolicy,
  PolicyEntry,
  SuppressedOverlayRecord,
  TeamLayerOrUnspecified,
  TeamValueOrigin,
} from '../../domain/policy/src/index.js'

/**
 * One durable override record as the provenance derivation consumes it
 * (the lossless subset of the storage record; the row / repository owner
 * projects the frozen record onto this shape).
 */
export interface DurableOverrideRef {
  /** The override's own identity. */
  readonly recordId: string
  /** `'autonomy-overlay' | 'human-override'`. */
  readonly kind: string
  /** `'team' | 'instance'`. */
  readonly scope: string
  /** The record's generation (the slot winner ordering input). */
  readonly generation: number
  /** The record's last modification time (ISO-8601). */
  readonly updatedAt: string
  /** The per-cell policy values payload (lossless JSON). */
  readonly values: Record<string, unknown>
}

/** A pending-next-boundary entry (one admitted-but-not-yet-applied record). */
export interface PendingBoundaryRecord {
  readonly recordId: string
  readonly kind: string
  readonly scope: string
  readonly generation: number
  readonly updatedAt: string
  readonly values: Record<string, unknown>
}

/** The §18.3 "source" of one cell: the winning Team layer's provenance. */
export interface CellSource {
  /** The winning Team-owned layer, or `'unspecified'` (fail-closed default). */
  readonly layer: TeamLayerOrUnspecified
  /** Who supplied the winning value. */
  readonly origin: TeamValueOrigin
  /** The winner's record id, or `null` for static layers / unspecified. */
  readonly recordId: string | null
}

/** Why a denied cell was denied (the §18.3 "deniedBy" field). */
export interface CellDeniedBy {
  /** Which plane denied the cell. */
  readonly by: 'team' | 'external'
  /** The frozen external-stage reason, for `by: 'external'`. */
  readonly reason:
    | 'capabilityMissing'
    | 'externalHardDeny'
    | 'externalHardRemovedAll'
    | 'teamDeny'
    | 'unspecifiedFailClosed'
  /** The denying Team layer, for `by: 'team'`. */
  readonly layer?: TeamLayerOrUnspecified
  /** The denying origin, for `by: 'team'`. */
  readonly origin?: TeamValueOrigin
  /** The denying record id, for `by: 'team'` record-backed layers. */
  readonly recordId?: string | null
}

/**
 * The backend-truth provenance of one capability cell (the §18.3 field
 * set, lossless-JSON).
 */
export interface CellProvenance {
  /** The capability the provenance is for. */
  readonly capability: CapabilityName
  /** §18.3 "effective value". */
  readonly effective: PolicyEntry
  /** §18.3 "source". */
  readonly source: CellSource
  /** §18.3 "suppressed". */
  readonly suppressed: readonly SuppressedOverlayRecord[]
  /** §18.3 "unavailable". */
  readonly unavailable: boolean
  /** §18.3 "deniedBy" (absent when the cell is allowed). */
  readonly deniedBy: CellDeniedBy | undefined
  /** §18.3 "pending next boundary". */
  readonly pendingNextBoundary: readonly PendingBoundaryRecord[]
  /** The frozen resolver's per-cell explanation line (lossless). */
  readonly explanation: string
}

/**
 * The options of {@link cellProvenance}.
 */
export interface CellProvenanceOptions {
  /**
   * Every durable override record of the TeamSession (backend truth).
   * Records admitting a value for the cell but not in
   * {@link CellProvenanceOptions.appliedRecordIds} become
   * `pendingNextBoundary` entries.
   * @defaultValue []
   */
  readonly overrides?: readonly DurableOverrideRef[]
  /**
   * The record ids the session has already APPLIED at its last request
   * boundary (the resolution the session is currently running on).
   * @defaultValue []
   */
  readonly appliedRecordIds?: readonly string[]
}

/**
 * Whether one durable record admits a value for the capability (its
 * `values` payload names the capability key).
 * @param record - the durable record.
 * @param capability - the capability cell name.
 * @returns `true` when the record could affect the cell.
 */
export function recordAdmitsCapability(
  record: Pick<DurableOverrideRef, 'values'>,
  capability: CapabilityName,
): boolean {
  const values = record.values
  return (
    typeof values === 'object' &&
    values !== null &&
    Object.prototype.hasOwnProperty.call(values, capability)
  )
}

/**
 * Derive the §18.3 backend-truth provenance of ONE capability cell from
 * the frozen resolver's output.
 *
 * Deterministic: the same policy + options yield the same provenance. The
 * function never throws on a well-formed policy; it reads only the cell's
 * frozen fields (every value is already explainable by construction —
 * P3-T4 acceptance).
 *
 * @param policy - the frozen effective policy of the member.
 * @param capability - the capability cell to project.
 * @param options - the durable records + the session's applied record ids.
 * @returns the cell's provenance (lossless-JSON).
 */
export function cellProvenance(
  policy: EffectivePolicy,
  capability: CapabilityName,
  options: CellProvenanceOptions = {},
): CellProvenance {
  const cell = policy.cells[capability]
  const team = cell.team
  const external = cell.external
  const overrides = options.overrides ?? []
  const applied = new Set(options.appliedRecordIds ?? [])
  const pending = overrides
    .filter((record) => recordAdmitsCapability(record, capability))
    .filter((record) => !applied.has(record.recordId))
    .map<PendingBoundaryRecord>((record) => ({
      recordId: record.recordId,
      kind: record.kind,
      scope: record.scope,
      generation: record.generation,
      updatedAt: record.updatedAt,
      values: record.values,
    }))

  const source: CellSource = {
    layer: team.layer,
    origin: team.origin,
    recordId: team.recordId,
  }

  let deniedBy: CellDeniedBy | undefined
  if (cell.effective.kind === 'deny') {
    if (external.note === 'capabilityMissing') {
      deniedBy = { by: 'external', reason: 'capabilityMissing' }
    } else if (external.note === 'externalHardDeny') {
      deniedBy = { by: 'external', reason: 'externalHardDeny' }
    } else if (external.note === 'externalHardRemovedAll') {
      deniedBy = { by: 'external', reason: 'externalHardRemovedAll' }
    } else if (team.layer === 'unspecified') {
      // The Team domain's fail-closed default: no layer granted the cell.
      deniedBy = { by: 'team', reason: 'unspecifiedFailClosed' }
    } else {
      deniedBy = {
        by: 'team',
        reason: 'teamDeny',
        layer: team.layer,
        origin: team.origin,
        recordId: team.recordId,
      }
    }
  }

  return {
    capability,
    effective: cell.effective,
    source,
    suppressed: team.suppressed,
    unavailable: external.note === 'capabilityMissing',
    deniedBy,
    pendingNextBoundary: pending,
    explanation: cell.explanation,
  }
}
