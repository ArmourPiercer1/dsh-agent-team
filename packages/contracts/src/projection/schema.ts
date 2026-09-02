/**
 * Schema version discipline for the projection DTO family.
 *
 * TeamProjectionDto (P8-T1) is a new versioned record family. It carries its
 * OWN `schemaVersion` track — frozen at `1` by P8-T1 — instead of re-stamping
 * the package-wide `TEAM_CONTRACT_SCHEMA_VERSION` (P3-T1 freeze). Rationale:
 * the three record families (TeamSessionRecord, MemberInstanceRecord,
 * TeamProjection) evolve independently; a projection-shape change must not
 * bump the stamp of the TeamDomain record family, and vice versa. The
 * freeze rule in CHANGELOG.md governs bumps in either direction.
 *
 * The error codes are the shared closed set (`SCHEMA_VERSION_MISMATCH` /
 * `SCHEMA_VERSION_UNSUPPORTED`); no new codes are introduced.
 *
 * Pure module: no I/O, no runtime environment assumptions.
 * @module @dsh-agent-team/contracts/projection/schema
 */

import { teamContractError } from '../errors.js'
import { toRemoteSafeDetail } from '../remote-safe.js'

/**
 * The schema version stamped by projection v1 records.
 * Frozen by P8-T1; changing or replacing it is a contract change.
 */
export const PROJECTION_SCHEMA_VERSION = 1 as const

/** Type of the v1 projection schema version field: exactly `1`. */
export type ProjectionSchemaVersion = typeof PROJECTION_SCHEMA_VERSION

/**
 * The schema version stamped by projection v2 records (S7-R2, repair
 * R2-2..R2-6): v1 plus ADDITIVE optional fields — the per-entry
 * provenance fields of the effective-config view (effective-config.ts)
 * and the version-gated optional member/top-level fields of the same
 * repair line. v1 records remain valid and are parsed byte-identically
 * through the v1 field sets; a v2 record may carry the additive keys
 * (and may also omit them — every v2 addition is DURATIONAL-optional).
 *
 * This is the version-track change required by the contracts freeze rule
 * (CHANGELOG.md): a new version, new stamp, v1 semantics untouched.
 */
export const PROJECTION_SCHEMA_VERSION_V2 = 2 as const

/** Type of the v2 projection schema version field: exactly `2`. */
export type ProjectionSchemaVersionV2 = typeof PROJECTION_SCHEMA_VERSION_V2

/**
 * All projection schema versions this build reads and writes:
 * `[1, 2]` (S7-R2 R2-2 additive v2).
 */
export const SUPPORTED_PROJECTION_SCHEMA_VERSIONS: readonly number[] = [1, 2]

/**
 * Is `value` a supported projection schema version (a positive integer in
 * the supported set)?
 * @param value - the raw value found in a `schemaVersion` field.
 * @returns `true` iff `value` is one of `SUPPORTED_PROJECTION_SCHEMA_VERSIONS`.
 */
export function isSupportedProjectionSchemaVersion(value: unknown): boolean {
  return (
    typeof value === 'number' &&
    Number.isInteger(value) &&
    value >= 1 &&
    SUPPORTED_PROJECTION_SCHEMA_VERSIONS.includes(value)
  )
}

/**
 * Assert that `value` is a supported projection schema version.
 * @param value - the raw value found in a `schemaVersion` field.
 * @throws `SCHEMA_VERSION_MISMATCH` for a well-formed version that is not
 *   supported by this build, or `SCHEMA_VERSION_UNSUPPORTED` when the value
 *   is not even a positive integer (structurally corrupt version field).
 */
export function assertProjectionSchemaVersion(value: unknown): void {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 1) {
    throw teamContractError(
      'SCHEMA_VERSION_UNSUPPORTED',
      `projection schema version must be a positive integer, got ${JSON.stringify(value)}`,
      { schemaVersion: toRemoteSafeDetail(value) },
    )
  }
  if (!SUPPORTED_PROJECTION_SCHEMA_VERSIONS.includes(value)) {
    throw teamContractError(
      'SCHEMA_VERSION_MISMATCH',
      `unsupported projection schema version ${value}; this build supports [${SUPPORTED_PROJECTION_SCHEMA_VERSIONS.join(', ')}]`,
      { schemaVersion: toRemoteSafeDetail(value), supported: [...SUPPORTED_PROJECTION_SCHEMA_VERSIONS] },
    )
  }
}
