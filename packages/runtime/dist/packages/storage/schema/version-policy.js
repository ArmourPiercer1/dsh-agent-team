/**
 * The TeamDomain v1 schema version policy.
 *
 * Layered versioning (the policy this task owns, TaskDoc §11.5 P4-T1):
 *
 * - **L1 — seam level:** the persisted domain `team_domain` carries
 *   `version: 1`. The public StorageDomain rejects `open` of a persisted
 *   domain at a different version (the frozen `version-mismatch` backend
 *   code); the facade maps that to `SCHEMA_VERSION_MISMATCH`.
 * - **L2 — store level:** one schema stamp row per store in the
 *   `schema_meta` table, `version: 1`. `createTeamDomain` stamps all eight
 *   stores; `openTeamDomain` verifies all eight stamps are present and at
 *   the supported version, failing loudly with the exact store, expected
 *   version, and found value (G4: "schema version mismatch fails loudly").
 * - **L3 — record level:** every record carries its own `schemaVersion`
 *   field; the frozen contracts v1 parsers enforce it for the contracts
 *   DTOs, and the storage-level record parsers enforce it for the
 *   TeamDomain-own records.
 *
 * There is NO built-in migration in v1 (the public StorageDomain performs
 * none either — version mismatch rejects at open). The upgrade strategy is
 * a documented future extension point only: a future version ships the
 * migration as a new supported version plus an explicit migration
 * operation, never as an implicit in-place rewrite.
 *
 * Pure module: no I/O.
 * @module @dsh-agent-team/storage/schema/version-policy
 */
import { toRemoteSafeDetail } from '../../contracts/src/index.js';
import { teamDomainError } from './errors.js';
import { SUPPORTED_TEAM_DOMAIN_SCHEMA_VERSIONS, TEAM_DOMAIN_SCHEMA_VERSION } from './stores.js';
/**
 * Is `value` a schema version TeamDomain v1 supports?
 * @param value - the unknown version value.
 */
export function isSupportedTeamDomainSchemaVersion(value) {
    return typeof value === 'number' && SUPPORTED_TEAM_DOMAIN_SCHEMA_VERSIONS.includes(value);
}
/**
 * Assert `value` is a supported TeamDomain schema version.
 * @param value - the version found on a schema stamp (or record).
 * @param store - the store the stamp belongs to, for the diagnostic.
 * @returns the version (a number).
 * @throws `SCHEMA_STAMP_MISMATCH` with `details {store, expected, found}`
 *   when the value is not a supported version.
 */
export function assertSupportedTeamDomainSchemaVersion(value, store) {
    if (typeof value !== 'number' || !SUPPORTED_TEAM_DOMAIN_SCHEMA_VERSIONS.includes(value)) {
        throw teamDomainError('SCHEMA_STAMP_MISMATCH', `TeamDomain store '${store}' is stamped at schema version ${typeof value === 'number' ? String(value) : typeof value}; this TeamDomain supports version ${TEAM_DOMAIN_SCHEMA_VERSION} and has no built-in migration`, { store, expected: TEAM_DOMAIN_SCHEMA_VERSION, found: toRemoteSafeDetail(value) });
    }
    return value;
}
//# sourceMappingURL=version-policy.js.map