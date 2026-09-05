/**
 * SchemaMetaRepository — the `schema_meta` store (L2 of the version
 * policy): one stamp row per store, stamped at `createTeamDomain` time.
 *
 * The store is effectively append-only in v1: `createTeamDomain` stamps
 * all eight stores; `openTeamDomain` reads the stamps back and verifies
 * them; re-stamping a present store is rejected (no migration in v1).
 *
 * @module @dsh-agent-team/storage/repositories/schema-meta
 */
import { assertTeamDomainStore, createSchemaMetaStamp, deserializeSchemaMetaStamp, normalizeValidationError, serializeSchemaMetaStamp, teamDomainError, } from '../schema/index.js';
import { BaseRepository } from './base.js';
/**
 * The `schema_meta` repository: per-store schema stamps.
 */
export class SchemaMetaRepository extends BaseRepository {
    /**
     * @param handle - the open `team_domain` handle.
     */
    constructor(handle) {
        super(handle, 'schema_meta');
    }
    /**
     * Read every stamp row.
     * @returns a map from store name to its frozen stamp (key order =
     *   snapshot order; use `TEAM_DOMAIN_STORES` for canonical ordering).
     * @throws `RECORD_INVALID` for a malformed or inconsistent stamp row
     *   (including `stamp-key-mismatch` when a row's `store` field does not
     *   equal its key).
     */
    listStamps() {
        const stamps = new Map();
        for (const [key, raw] of this.snapshotEntries()) {
            let stamp;
            try {
                stamp = deserializeSchemaMetaStamp(raw);
            }
            catch (error) {
                throw normalizeValidationError(error, this.storeName, key);
            }
            if (stamp.store !== key) {
                throw teamDomainError('RECORD_INVALID', `schema_meta row '${key}' does not match its stamped store '${stamp.store}'`, { store: this.storeName, key, problem: 'stamp-key-mismatch' });
            }
            stamps.set(key, stamp);
        }
        return stamps;
    }
    /**
     * Stamp one store at the current schema version (single-write durable).
     * Idempotent when the identical stamp bytes are already stored; a
     * different existing stamp is rejected (`stamp-already-exists`).
     * @param store - the store to stamp (must be one of the eight).
     * @param stampedAt - the stamp time, ISO-8601.
     * @throws `RECORD_INVALID` (problem `unknown-store` /
     *   `stamp-already-exists`) or seam failures via `normalizeSeamError`.
     */
    async stampStore(store, stampedAt) {
        assertTeamDomainStore(store);
        const value = serializeSchemaMetaStamp(createSchemaMetaStamp(store, stampedAt));
        const existing = this.readRow(store);
        if (existing === value)
            return;
        if (existing !== undefined) {
            throw teamDomainError('RECORD_INVALID', `schema_meta already carries a different stamp for store '${store}' (v1 has no migration)`, { store: this.storeName, key: store, problem: 'stamp-already-exists' });
        }
        await this.putRaw(store, value);
    }
}
//# sourceMappingURL=schema-meta.js.map