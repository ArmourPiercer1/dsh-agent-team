/**
 * BaseRepository — the shared seam boundary of the eight TeamDomain store
 * repositories.
 *
 * Every repository over one `team_domain` table inherits the same seam
 * discipline (Development Plan §17.2 sidecar over the public StorageDomain):
 *
 * - every stored value is a canonical JSON string; a present-but-non-string
 *   row is `RECORD_INVALID` (problem `row-not-a-string`);
 * - every read deserializes into a frozen record and re-canonicalizes it;
 *   differing bytes are `RECORD_INVALID` (problem `non-canonical-bytes`);
 * - writes are single-write durable puts; identical bytes are an idempotent
 *   no-op, an occupied key delegates to a typed conflict;
 * - every seam failure is classified through `normalizeSeamError`
 *   (`closed` → `NOT_OPEN`, known backend codes → `SEAM_FAILURE`);
 * - every validation failure is classified through
 *   `normalizeValidationError` (contracts codes preserved in
 *   `details.contractsCode`).
 *
 * No repository ever talks to the host backend directly: only the
 * injected `StorageDomainHandle` (the seam) is consumed.
 *
 * @module @dsh-agent-team/storage/repositories/base
 */
import type { StorageDomainHandle, StorageKvTable, TeamDomainError, TeamDomainStore } from '../schema/index.js';
/**
 * The base of the TeamDomain store repositories: one store, one table
 * handle, the shared read/write/validate boundary.
 */
export declare abstract class BaseRepository {
    private readonly handle;
    protected readonly storeName: TeamDomainStore;
    /**
     * @param handle - the open `team_domain` handle (injected seam).
     * @param storeName - the store (table) this repository manages.
     */
    constructor(handle: StorageDomainHandle, storeName: TeamDomainStore);
    /** The store name this repository manages. */
    get store(): TeamDomainStore;
    /** The current record count of the store table. */
    get size(): number;
    /** The table handle for this repository's store (stable per domain). */
    protected get table(): StorageKvTable;
    /**
     * Read one raw row, verifying the TeamDomain string invariant.
     * @returns the canonical JSON string, or `undefined` when absent.
     * @throws `RECORD_INVALID` (problem `row-not-a-string`) when the row is
     *   present but not a string; seam failures via `normalizeSeamError`.
     */
    protected readRow(key: string): string | undefined;
    /**
     * Deserialize one raw row into a frozen record and verify byte
     * stability (re-canonicalization must reproduce the stored bytes).
     * @param key - the row key.
     * @param raw - the stored canonical JSON string.
     * @param deserialize - the record deserializer (throws on malformed data).
     * @param serialize - the record serializer (canonical form).
     * @returns the frozen record.
     * @throws `RECORD_INVALID` (problem `non-canonical-bytes`) or the
     *   deserializer's validation error, normalized.
     */
    protected readRecordFromRaw<T>(key: string, raw: string, deserialize: (json: string) => T, serialize: (value: T) => string): T;
    /**
     * Read one record by key.
     * @returns the frozen record, or `undefined` when the key is absent.
     */
    protected readRecord<T>(key: string, deserialize: (json: string) => T, serialize: (value: T) => string): T | undefined;
    /**
     * Durably write one raw row (single-write durability before resolve).
     */
    protected putRaw(key: string, value: string): Promise<void>;
    /**
     * Write one row with the shared idempotency rule: identical stored bytes
     * are a no-op; an occupied key hands the existing raw to `onConflict`,
     * which MUST throw a typed `TeamDomainError` (never returns normally).
     */
    protected putRecord(key: string, value: string, onConflict: (existing: string) => void): Promise<void>;
    /**
     * Durably delete one row.
     * @returns `true` when the row existed, `false` otherwise (no write).
     */
    protected deleteRow(key: string): Promise<boolean>;
    /**
     * Atomic read-modify-write on the domain's write chain.
     *
     * TeamDomain/contracts errors thrown by `fn` pass through unchanged
     * (they are business errors, not seam failures); anything else is
     * classified via `normalizeSeamError` — in particular the public
     * `missing-key` code surfaces as `SEAM_FAILURE`.
     */
    protected updateRaw(key: string, fn: (current: unknown) => unknown): Promise<unknown>;
    /**
     * Snapshot iterator over `[key, raw]` pairs; enforces the string
     * invariant on every row of the snapshot.
     */
    protected snapshotEntries(): IterableIterator<[string, string]>;
    /**
     * Classify an occupied-key conflict: contracts uniqueness codes are
     * preserved via `details.contractsCode` under `RECORD_DUPLICATE`;
     * already-typed TeamDomain errors pass through; anything else is an
     * unclassified conflict.
     */
    protected conflictError(error: unknown, key: string): TeamDomainError;
}
//# sourceMappingURL=base.d.ts.map