/**
 * Schema version discipline for contract values.
 *
 * Every versioned DTO record carries a top-level `schemaVersion` stamped at
 * creation. Version 1 is the v1 freeze of P3-T1 (see CHANGELOG.md).
 *
 * Rules:
 * - a record whose version differs from the consumer's expected version is a
 *   `SCHEMA_VERSION_MISMATCH` error;
 * - a record whose version is not in the supported set (older than the oldest
 *   supported or from the future) is a `SCHEMA_VERSION_UNSUPPORTED` error;
 * - version bumps are contract changes: a new version is introduced by a new
 *   contracts version that adds (never edits) the supported set semantics,
 *   and old records remain readable per the freeze rule in CHANGELOG.md.
 *
 * Pure module: no I/O, no runtime environment assumptions.
 * @module @dsh-agent-team/contracts/schema-version
 */
import { teamContractError } from './errors.js';
import { toRemoteSafeDetail } from './remote-safe.js';
/**
 * The schema version stamped by contract v1 records.
 * Frozen by P3-T1; changing or replacing it is a contract change.
 */
export const TEAM_CONTRACT_SCHEMA_VERSION = 1;
/**
 * The schema version stamp of the LeaderInstance record (v2, P8-S2;
 * Architecture §9.2). The v2 row is the same identity core with
 * `childSessionId` and `lifecycle` ABSENT (the LeaderInstance is the
 * Root Agent + Root Session: no child Session, no ordinary member
 * lifecycle — invariants 14/15). Added by an explicit contract change
 * (see CHANGELOG.md); v1 records are untouched and stay readable.
 */
export const LEADER_INSTANCE_RECORD_SCHEMA_VERSION = 2;
/**
 * All schema versions this build reads and writes: `[1]` (every v1
 * record) + `[2]` (the LeaderInstance record added by P8-S2). The v1 set
 * itself is frozen: this constant only ever GROWS through an explicit
 * contract change, it never rewrites v1 semantics.
 */
export const SUPPORTED_SCHEMA_VERSIONS = [1, 2];
/**
 * Is `value` a supported schema version (a positive integer in the supported set)?
 * @param value - the raw value found in a `schemaVersion` field.
 * @returns `true` iff `value` is one of `SUPPORTED_SCHEMA_VERSIONS`.
 */
export function isSupportedSchemaVersion(value) {
    return (typeof value === 'number' &&
        Number.isInteger(value) &&
        value >= 1 &&
        SUPPORTED_SCHEMA_VERSIONS.includes(value));
}
/**
 * Assert that `value` is a supported schema version.
 * @param value - the raw value found in a `schemaVersion` field.
 * @throws `SCHEMA_VERSION_MISMATCH` for a well-formed version that is not
 *   supported by this build, or `SCHEMA_VERSION_UNSUPPORTED` when the value
 *   is not even a positive integer (structurally corrupt version field).
 */
export function assertSupportedSchemaVersion(value) {
    if (typeof value !== 'number' || !Number.isInteger(value) || value < 1) {
        throw teamContractError('SCHEMA_VERSION_UNSUPPORTED', `schema version must be a positive integer, got ${JSON.stringify(value)}`, { schemaVersion: toRemoteSafeDetail(value) });
    }
    if (!SUPPORTED_SCHEMA_VERSIONS.includes(value)) {
        throw teamContractError('SCHEMA_VERSION_MISMATCH', `unsupported schema version ${value}; this build supports [${SUPPORTED_SCHEMA_VERSIONS.join(', ')}]`, { schemaVersion: toRemoteSafeDetail(value), supported: [...SUPPORTED_SCHEMA_VERSIONS] });
    }
}
/**
 * Assert that `value` equals the exact version `expected` (the default is the
 * current v1 version). Used by DTO parsers, which must reject a record from
 * a different schema generation even when both versions are individually
 * "well-formed".
 * @param value - the raw value found in a `schemaVersion` field.
 * @param expected - the version the parsing consumer requires.
 * @throws `SCHEMA_VERSION_MISMATCH` when `value !== expected`,
 *   `SCHEMA_VERSION_UNSUPPORTED` when `value` is not a positive integer.
 */
export function assertSchemaVersion(value, expected = TEAM_CONTRACT_SCHEMA_VERSION) {
    if (typeof value !== 'number' || !Number.isInteger(value) || value < 1) {
        throw teamContractError('SCHEMA_VERSION_UNSUPPORTED', `schema version must be a positive integer, got ${JSON.stringify(value)}`, { schemaVersion: toRemoteSafeDetail(value), expected });
    }
    if (value !== expected) {
        throw teamContractError('SCHEMA_VERSION_MISMATCH', `schema version ${value} does not match expected version ${expected}`, { schemaVersion: toRemoteSafeDetail(value), expected });
    }
}
//# sourceMappingURL=schema-version.js.map