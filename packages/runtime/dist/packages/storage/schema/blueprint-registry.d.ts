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
/** The exact frozen fields of a BlueprintRegistryRecord (v2 domain). */
export declare const BLUEPRINT_REGISTRY_RECORD_FIELDS: readonly string[];
/**
 * One row of the `blueprint_registry` store: one frozen Blueprint
 * snapshot identity and its immutable source.
 */
export interface BlueprintRegistryRecord {
    /** The TeamDomain schema version that shaped the row (L3: v2 rows carry `2`). */
    readonly schemaVersion: number;
    /** The stable logical blueprint identity (contracts grammar). */
    readonly blueprintId: string;
    /** The human-readable revision (contracts grammar). */
    readonly revision: string;
    /** The machine content identity of the frozen source (contracts grammar). */
    readonly contentHash: string;
    /** The IMMUTABLE source text the snapshot was frozen from. */
    readonly source: string;
    /** Freeze time, ISO-8601. */
    readonly frozenAt: string;
}
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
export declare function createBlueprintRegistryRecord(input: {
    readonly blueprintId: string;
    readonly revision: string;
    readonly contentHash: string;
    readonly source: string;
    readonly frozenAt: string;
}): BlueprintRegistryRecord;
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
export declare function parseBlueprintRegistryRecord(value: unknown): BlueprintRegistryRecord;
/**
 * The durable row key of one registry record: the canonical snapshot
 * display form `blueprintId@revision` (the same form as the contracts
 * `blueprintSnapshotKey`; unambiguous because neither component may
 * contain `@`).
 * @param blueprintId - the blueprint id.
 * @param revision - the revision.
 * @returns the row key.
 */
export declare function blueprintRegistryKey(blueprintId: string, revision: string): string;
/**
 * Serialize a record to its stable canonical JSON form (sorted keys).
 * @param record - the record.
 * @returns the canonical JSON text.
 */
export declare function serializeBlueprintRegistryRecord(record: BlueprintRegistryRecord): string;
/**
 * Deserialize canonical JSON back into a validated, frozen record.
 * @param json - the canonical JSON text.
 * @returns the parsed record.
 * @throws `RECORD_INVALID` (problem `malformed-json`) when the text is not
 *   valid JSON, plus the validation codes a malformed record triggers.
 */
export declare function deserializeBlueprintRegistryRecord(json: string): BlueprintRegistryRecord;
//# sourceMappingURL=blueprint-registry.d.ts.map