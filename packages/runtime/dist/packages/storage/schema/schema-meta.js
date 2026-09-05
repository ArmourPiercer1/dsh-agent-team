/**
 * SchemaMetaStamp — the per-store schema stamp row of the `schema_meta`
 * store (L2 of the TeamDomain version policy).
 *
 * `createTeamDomain` writes one stamp row per store (eight single-write
 * durable writes); `openTeamDomain` reads them back and verifies that all
 * eight stores are present and stamped at the supported version, failing
 * loudly with the exact store, expected version, and found value
 * (Development Plan §17.5 G4: "schema version mismatch fails loudly").
 *
 * The stamp is a storage-level record (no contracts DTO exists for it):
 * the field set is closed and strict, `schemaVersion` is the stamp record
 * shape version (v1), and `version` is the schema version stamped for the
 * store's records (v1 for all eight stores).
 *
 * Pure module: no I/O.
 * @module @dsh-agent-team/storage/schema/schema-meta
 */
import { assertNoLegacyFields, canonicalJsonStringify, deepFreeze, } from '../../contracts/src/index.js';
import { assertFieldPresent, assertNoUnknownFields, assertPlainRecord, parseIso8601TimestampField } from '../../contracts/src/dto/common.js';
import { teamDomainError } from './errors.js';
import { TEAM_DOMAIN_SCHEMA_VERSION, assertTeamDomainStore } from './stores.js';
import { assertSupportedTeamDomainSchemaVersion } from './version-policy.js';
/** The exact frozen fields of a SchemaMetaStamp (v1). */
export const SCHEMA_META_STAMP_FIELDS = [
    'schemaVersion',
    'store',
    'version',
    'stampedAt',
];
/**
 * Build a fresh stamp for one store at the current v1 version.
 * @param store - the store to stamp.
 * @param stampedAt - stamp creation time, ISO-8601.
 * @returns the frozen stamp.
 */
export function createSchemaMetaStamp(store, stampedAt) {
    const parsedStore = assertTeamDomainStore(store);
    const parsedStamp = parseIso8601TimestampField(stampedAt);
    return deepFreeze({
        schemaVersion: TEAM_DOMAIN_SCHEMA_VERSION,
        store: parsedStore,
        version: TEAM_DOMAIN_SCHEMA_VERSION,
        stampedAt: parsedStamp,
    });
}
/**
 * Parse and validate a schema stamp from an untrusted value.
 * @param value - the unknown input (e.g. a decoded `schema_meta` row).
 * @returns the frozen stamp.
 * @throws `RECORD_INVALID` (storage-level) for a malformed stamp
 *   (unknown/missing field, unknown store, wrong record shape version,
 *   bad timestamp), `SCHEMA_STAMP_MISMATCH` for an unsupported store
 *   version, and contracts `MALFORMED_DTO`/`LEGACY_MEMBER_ID_REJECTED`
 *   (preserved via `normalizeValidationError` at the repository boundary).
 */
export function parseSchemaMetaStamp(value) {
    const record = assertPlainRecord(value, 'SchemaMetaStamp');
    assertNoLegacyFields(record, 'SchemaMetaStamp');
    assertNoUnknownFields(record, SCHEMA_META_STAMP_FIELDS, 'SchemaMetaStamp');
    for (const field of SCHEMA_META_STAMP_FIELDS) {
        assertFieldPresent(record, field, 'SchemaMetaStamp');
    }
    const schemaVersion = record['schemaVersion'];
    if (schemaVersion !== TEAM_DOMAIN_SCHEMA_VERSION) {
        throw teamDomainError('RECORD_INVALID', `SchemaMetaStamp schemaVersion must be ${TEAM_DOMAIN_SCHEMA_VERSION}, got ${JSON.stringify(schemaVersion)}`, { field: 'schemaVersion', expected: TEAM_DOMAIN_SCHEMA_VERSION, found: schemaVersion });
    }
    const store = assertTeamDomainStore(record['store']);
    const version = assertSupportedTeamDomainSchemaVersion(record['version'], store);
    const stampedAt = parseIso8601TimestampField(record['stampedAt']);
    return deepFreeze({
        schemaVersion: TEAM_DOMAIN_SCHEMA_VERSION,
        store,
        version,
        stampedAt,
    });
}
/**
 * Serialize a stamp to its stable canonical JSON form (sorted keys).
 * @param stamp - the stamp.
 * @returns the canonical JSON text.
 */
export function serializeSchemaMetaStamp(stamp) {
    return canonicalJsonStringify(stamp);
}
/**
 * Deserialize canonical JSON back into a validated, frozen stamp.
 * @param json - the canonical JSON text.
 * @returns the parsed stamp.
 * @throws `RECORD_INVALID` (problem `malformed-json`) when the text is not
 *   valid JSON, plus the validation codes a malformed stamp triggers.
 */
export function deserializeSchemaMetaStamp(json) {
    let value;
    try {
        value = JSON.parse(json);
    }
    catch (error) {
        throw teamDomainError('RECORD_INVALID', `SchemaMetaStamp JSON is not valid: ${error instanceof Error ? error.message : String(error)}`, { problem: 'malformed-json' });
    }
    return parseSchemaMetaStamp(value);
}
//# sourceMappingURL=schema-meta.js.map