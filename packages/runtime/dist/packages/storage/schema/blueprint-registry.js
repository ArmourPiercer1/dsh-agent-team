/**
 * BlueprintRegistryRecord — the row of the `blueprint_registry` store
 * (schema version 2, issue #2 blueprint-loading parallel repair, plan BP2).
 *
 * One row per frozen Blueprint snapshot identity `{ blueprintId, revision }`:
 * the immutable source text of the frozen revision, its machine content
 * identity, and the freeze time. The registry is the DURABLE sidecar of
 * the Blueprint freeze barrier (plan BP6): a TeamSession that binds a
 * snapshot can always re-resolve that snapshot from the registry, even
 * after the source file is deleted or edited (plan BP3: "a frozen
 * revision resolvable after file deletion").
 *
 * Record shape (frozen, closed):
 *
 *   { schemaVersion, blueprintId, revision, contentHash, source,
 *     frozenAt }
 *
 * `schemaVersion` follows the TeamDomain L3 discipline (every storage-
 * level row carries the domain schema version that shaped it — the same
 * coupling as `OperationRecord`, `GovernanceOverride`,
 * `CompatibilityState`, and the `LedgerEntry`/`LedgerSequenceCounter`
 * rows): v2 rows carry `2`. (The plan's record sketch
 * `{schemaVersion:1, ...}` was written against the v1 tree, where the
 * row stamp and the domain version were both `1`; the plan's own v2
 * bump moves the stamp with the domain — the registry store is new in
 * v2, so no row ever carried `1`.)
 *
 * The record stores the IMMUTABLE SOURCE TEXT (`source`), not a derived
 * projection: the freeze barrier must be able to re-parse the frozen
 * bytes (plan BP4: registry identity resolution re-parses
 * `registry.source` and requires the hash to match `registry.contentHash`).
 *
 * The storage surface is read + freeze-only (plan BP2: NO
 * update/delete/unfreeze/replace): `get`, `list`, `freeze` — the
 * repository enforces that surface; the base primitives that could write
 * differently (`deleteRow`, `updateRaw`) are never exposed.
 *
 * Pure module: no I/O.
 * @module @dsh-agent-team/storage/schema/blueprint-registry
 */
import { assertNoLegacyFields, canonicalJsonStringify, deepFreeze, parseBlueprintContentHash, parseBlueprintId, parseBlueprintRevision, } from '../../contracts/src/index.js';
import { assertFieldPresent, assertNoUnknownFields, assertPlainRecord, parseIso8601TimestampField, } from '../../contracts/src/dto/common.js';
import { teamDomainError } from './errors.js';
import { TEAM_DOMAIN_SCHEMA_VERSION } from './stores.js';
/** The exact frozen fields of a BlueprintRegistryRecord (v2 domain). */
export const BLUEPRINT_REGISTRY_RECORD_FIELDS = [
    'schemaVersion',
    'blueprintId',
    'revision',
    'contentHash',
    'source',
    'frozenAt',
];
/**
 * Build a fresh registry record for one frozen snapshot.
 * @param input - the snapshot identity + source + freeze time.
 * @returns the frozen record (schemaVersion stamped to the TeamDomain
 *   schema version, per the L3 row-stamp discipline).
 * @throws `RECORD_INVALID` (storage-level) for malformed components
 *   (the contracts identity parsers are the grammar authority), or a
 *   contracts `MALFORMED_DTO`-family code via `normalizeValidationError`
 *   at the repository boundary.
 */
export function createBlueprintRegistryRecord(input) {
    return deepFreeze({
        schemaVersion: TEAM_DOMAIN_SCHEMA_VERSION,
        blueprintId: String(parseBlueprintId(input.blueprintId)),
        revision: parseBlueprintRevision(input.revision),
        contentHash: parseBlueprintContentHash(input.contentHash),
        source: assertSource(input.source),
        frozenAt: parseIso8601TimestampField(input.frozenAt),
    });
}
/**
 * Parse and validate a registry record from an untrusted value.
 * @param value - the unknown input (e.g. a decoded `blueprint_registry`
 *   row).
 * @returns the frozen record.
 * @throws `RECORD_INVALID` (storage-level) for a malformed record
 *   (unknown/missing field, wrong schema version, bad source,
 *   bad timestamp), or the contracts id codes via
 *   `normalizeValidationError` at the repository boundary.
 */
export function parseBlueprintRegistryRecord(value) {
    const record = assertPlainRecord(value, 'BlueprintRegistryRecord');
    assertNoLegacyFields(record, 'BlueprintRegistryRecord');
    assertNoUnknownFields(record, BLUEPRINT_REGISTRY_RECORD_FIELDS, 'BlueprintRegistryRecord');
    for (const field of BLUEPRINT_REGISTRY_RECORD_FIELDS) {
        assertFieldPresent(record, field, 'BlueprintRegistryRecord');
    }
    const schemaVersion = record['schemaVersion'];
    if (schemaVersion !== TEAM_DOMAIN_SCHEMA_VERSION) {
        throw teamDomainError('RECORD_INVALID', `BlueprintRegistryRecord schemaVersion must be ${TEAM_DOMAIN_SCHEMA_VERSION} (the TeamDomain schema version that shaped the row, L3 discipline), got ${JSON.stringify(schemaVersion)}`, { field: 'schemaVersion', expected: TEAM_DOMAIN_SCHEMA_VERSION, found: schemaVersion });
    }
    return deepFreeze({
        schemaVersion: TEAM_DOMAIN_SCHEMA_VERSION,
        blueprintId: String(parseBlueprintId(record['blueprintId'])),
        revision: parseBlueprintRevision(record['revision']),
        contentHash: parseBlueprintContentHash(record['contentHash']),
        source: assertSource(record['source']),
        frozenAt: parseIso8601TimestampField(record['frozenAt']),
    });
}
/** The closed `source` field rule: a non-empty string (the document text). */
function assertSource(value) {
    if (typeof value !== 'string' || value.length === 0) {
        throw teamDomainError('RECORD_INVALID', `BlueprintRegistryRecord source must be a non-empty string (the immutable source text), got ${JSON.stringify(typeof value)}`, { field: 'source', problem: 'empty-or-non-string-source' });
    }
    return value;
}
/**
 * The durable row key of one registry record: the canonical snapshot
 * display form `blueprintId@revision` (the same form as the contracts
 * `blueprintSnapshotKey`; unambiguous because neither component may
 * contain `@`).
 * @param blueprintId - the blueprint id.
 * @param revision - the revision.
 * @returns the row key.
 */
export function blueprintRegistryKey(blueprintId, revision) {
    return `${blueprintId}@${revision}`;
}
/**
 * Serialize a record to its stable canonical JSON form (sorted keys).
 * @param record - the record.
 * @returns the canonical JSON text.
 */
export function serializeBlueprintRegistryRecord(record) {
    return canonicalJsonStringify(record);
}
/**
 * Deserialize canonical JSON back into a validated, frozen record.
 * @param json - the canonical JSON text.
 * @returns the parsed record.
 * @throws `RECORD_INVALID` (problem `malformed-json`) when the text is not
 *   valid JSON, plus the validation codes a malformed record triggers.
 */
export function deserializeBlueprintRegistryRecord(json) {
    let value;
    try {
        value = JSON.parse(json);
    }
    catch (error) {
        throw teamDomainError('RECORD_INVALID', `BlueprintRegistryRecord JSON is not valid: ${error instanceof Error ? error.message : String(error)}`, { problem: 'malformed-json' });
    }
    return parseBlueprintRegistryRecord(value);
}
//# sourceMappingURL=blueprint-registry.js.map