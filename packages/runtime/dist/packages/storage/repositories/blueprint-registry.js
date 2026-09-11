/**
 * BlueprintRegistryRepository — the `blueprint_registry` store: the
 * durable, immutable registry of frozen Blueprint snapshot identities
 * (schema version 2, issue #2 blueprint-loading parallel repair, plan
 * BP2).
 *
 * The surface is read + freeze-only, by plan: `get(blueprintId,
 * revision)`, `list()`, `freeze(record)`. There is NO update, NO delete,
 * NO unfreeze, NO replace — the base write primitives that could do
 * otherwise (`deleteRow`, `updateRaw`) are deliberately never exposed.
 * A revision, once frozen, stays frozen for the life of the medium; a
 * new revision of the same blueprint is a NEW row
 * (`blueprintId@revision` key), never a rewrite of the old one.
 *
 * `freeze` semantics (the put-if-absent / re-read discipline, plan BP2 —
 * never last-write-wins):
 *
 *   - absent identity → APPEND the row (single-write durable put);
 *   - present identity with the SAME `contentHash` → IDEMPOTENT no-op
 *     (the snapshot is already frozen; the stored row is returned);
 *   - present identity with a DIFFERENT `contentHash` → LOUD typed
 *     failure: `RECORD_DUPLICATE` with `details.problem =
 *     'blueprint-revision-frozen'` and both hashes — a revision may not
 *     be re-frozen from different content (the crash rule then applies:
 *     the already-frozen row stays).
 *
 * The write-time re-read (the `putRecord` conflict path) covers the
 * window between the pre-read and the durable put: a concurrent freeze
 * of the same identity that lands in that window is refused loudly
 * rather than overwritten — the single-freezer invariant (the host is
 * the only writer, serialized on the domain write chain) is protected
 * by loud failure, the established TeamDomain philosophy (the same
 * shape as `TeamSessionsRepository.advanceGeneration`'s missing-team
 * ruling).
 *
 * @module @dsh-agent-team/storage/repositories/blueprint-registry
 */
import { parseBlueprintId, parseBlueprintRevision, } from '../../contracts/src/index.js';
import { blueprintRegistryKey, createBlueprintRegistryRecord, deserializeBlueprintRegistryRecord, normalizeValidationError, serializeBlueprintRegistryRecord, teamDomainError, } from '../schema/index.js';
import { BaseRepository } from './base.js';
/**
 * The `blueprint_registry` repository.
 */
export class BlueprintRegistryRepository extends BaseRepository {
    /**
     * @param handle - the open `team_domain` handle.
     */
    constructor(handle) {
        super(handle, 'blueprint_registry');
    }
    /**
     * Durably freeze one Blueprint snapshot identity from its source.
     *
     * The input is the snapshot identity + the IMMUTABLE source text + the
     * freeze time; the record is built (and its identity parsed through
     * the contracts grammar) here, keyed by `blueprintId@revision`.
     *
     * @param input - the frozen snapshot (identity + source + frozenAt).
     * @returns the frozen registry record (the STORED row when the identity
     *   was already frozen with the same content hash — idempotency).
     * @throws `RECORD_INVALID` for a malformed input; `RECORD_DUPLICATE`
     *   (problem `blueprint-revision-frozen`) when the identity is already
     *   frozen with a different content hash.
     */
    async freeze(input) {
        let record;
        try {
            record = createBlueprintRegistryRecord(input);
        }
        catch (error) {
            throw normalizeValidationError(error, this.storeName);
        }
        const key = blueprintRegistryKey(record.blueprintId, record.revision);
        const existingRaw = this.readRow(key);
        if (existingRaw !== undefined) {
            const existing = this.readRecordFromRaw(key, existingRaw, deserializeBlueprintRegistryRecord, serializeBlueprintRegistryRecord);
            if (existing.contentHash === record.contentHash)
                return existing;
            throw this.blueprintRevisionFrozen(key, record.contentHash, existing.contentHash);
        }
        await this.putRecord(key, serializeBlueprintRegistryRecord(record), (existing) => {
            let other;
            try {
                other = deserializeBlueprintRegistryRecord(existing);
            }
            catch (error) {
                throw normalizeValidationError(error, this.storeName, key);
            }
            // Write-time re-read: the identity was frozen in the window between
            // the pre-read and the put. Never last-write-wins — loud failure
            // (both the different-hash and the same-hash races: the single-
            // freezer invariant was violated by a concurrent writer).
            throw this.blueprintRevisionFrozen(key, record.contentHash, other.contentHash);
        });
        return record;
    }
    /**
     * Read one frozen registry record by snapshot identity.
     * @param blueprintId - the blueprint id (plain string, parsed).
     * @param revision - the revision (plain string, parsed).
     * @returns the frozen record, or `undefined` when the identity is not
     *   frozen.
     * @throws `RECORD_INVALID` (contracts code preserved) for a malformed
     *   identity component, or a malformed/non-canonical stored row.
     */
    get(blueprintId, revision) {
        const key = this.keyOf(blueprintId, revision);
        return this.readRecord(key, deserializeBlueprintRegistryRecord, serializeBlueprintRegistryRecord);
    }
    /**
     * List every frozen registry record, sorted by the row key
     * (`blueprintId@revision`, byte order).
     */
    list() {
        const records = [];
        for (const [key, raw] of this.snapshotEntries()) {
            records.push(this.readRecordFromRaw(key, raw, deserializeBlueprintRegistryRecord, serializeBlueprintRegistryRecord));
        }
        records.sort((a, b) => {
            const ka = blueprintRegistryKey(a.blueprintId, a.revision);
            const kb = blueprintRegistryKey(b.blueprintId, b.revision);
            return ka < kb ? -1 : ka > kb ? 1 : 0;
        });
        return records;
    }
    /** Parse one identity pair and derive its durable row key. */
    keyOf(blueprintId, revision) {
        try {
            return blueprintRegistryKey(String(parseBlueprintId(blueprintId)), parseBlueprintRevision(revision));
        }
        catch (error) {
            throw normalizeValidationError(error, this.storeName, blueprintId);
        }
    }
    /** The typed loud failure for a revision frozen from different content. */
    blueprintRevisionFrozen(key, expectedContentHash, foundContentHash) {
        return teamDomainError('RECORD_DUPLICATE', `blueprint revision '${key}' is already frozen with content hash ${foundContentHash}; refusing to re-freeze it with different content ${expectedContentHash} (a frozen revision is immutable — publish a NEW revision instead)`, {
            store: this.storeName,
            key,
            problem: 'blueprint-revision-frozen',
            expectedContentHash,
            foundContentHash,
        });
    }
}
//# sourceMappingURL=blueprint-registry.js.map