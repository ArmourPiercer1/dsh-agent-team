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
import type { SchemaMetaStamp, StorageDomainHandle, TeamDomainStore } from '../schema/index.js';
import { BaseRepository } from './base.js';
/**
 * The `schema_meta` repository: per-store schema stamps.
 */
export declare class SchemaMetaRepository extends BaseRepository {
    /**
     * @param handle - the open `team_domain` handle.
     */
    constructor(handle: StorageDomainHandle);
    /**
     * Read every stamp row.
     * @returns a map from store name to its frozen stamp (key order =
     *   snapshot order; use `TEAM_DOMAIN_STORES` for canonical ordering).
     * @throws `RECORD_INVALID` for a malformed or inconsistent stamp row
     *   (including `stamp-key-mismatch` when a row's `store` field does not
     *   equal its key).
     */
    listStamps(): Map<TeamDomainStore, SchemaMetaStamp>;
    /**
     * Stamp one store at the current schema version (single-write durable).
     * Idempotent when the identical stamp bytes are already stored; a
     * different existing stamp is rejected (`stamp-already-exists`).
     * @param store - the store to stamp (must be one of the eight).
     * @param stampedAt - the stamp time, ISO-8601.
     * @throws `RECORD_INVALID` (problem `unknown-store` /
     *   `stamp-already-exists`) or seam failures via `normalizeSeamError`.
     */
    stampStore(store: TeamDomainStore, stampedAt: string): Promise<void>;
}
//# sourceMappingURL=schema-meta.d.ts.map