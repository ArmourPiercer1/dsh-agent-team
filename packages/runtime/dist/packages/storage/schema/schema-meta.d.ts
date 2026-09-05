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
import type { TeamDomainStore } from './stores.js';
/** The exact frozen fields of a SchemaMetaStamp (v1). */
export declare const SCHEMA_META_STAMP_FIELDS: readonly string[];
/** One schema stamp row of the `schema_meta` store. */
export interface SchemaMetaStamp {
    /** Stamp record shape version; v1 stamps carry `1`. */
    readonly schemaVersion: number;
    /** The stamped store (one of the eight frozen store names). */
    readonly store: TeamDomainStore;
    /** The schema version stamped for the store's records. */
    readonly version: number;
    /** Stamp creation time, ISO-8601. */
    readonly stampedAt: string;
}
/**
 * Build a fresh stamp for one store at the current v1 version.
 * @param store - the store to stamp.
 * @param stampedAt - stamp creation time, ISO-8601.
 * @returns the frozen stamp.
 */
export declare function createSchemaMetaStamp(store: TeamDomainStore, stampedAt: string): SchemaMetaStamp;
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
export declare function parseSchemaMetaStamp(value: unknown): SchemaMetaStamp;
/**
 * Serialize a stamp to its stable canonical JSON form (sorted keys).
 * @param stamp - the stamp.
 * @returns the canonical JSON text.
 */
export declare function serializeSchemaMetaStamp(stamp: SchemaMetaStamp): string;
/**
 * Deserialize canonical JSON back into a validated, frozen stamp.
 * @param json - the canonical JSON text.
 * @returns the parsed stamp.
 * @throws `RECORD_INVALID` (problem `malformed-json`) when the text is not
 *   valid JSON, plus the validation codes a malformed stamp triggers.
 */
export declare function deserializeSchemaMetaStamp(json: string): SchemaMetaStamp;
//# sourceMappingURL=schema-meta.d.ts.map