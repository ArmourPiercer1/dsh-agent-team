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

import { errorMessage, isTeamDomainError, normalizeSeamError, normalizeValidationError, teamDomainError } from '../schema/index.js'
import type { StorageDomainHandle, StorageKvTable, TeamDomainError, TeamDomainStore } from '../schema/index.js'
import { isTeamContractError } from '../../contracts/src/index.js'

/**
 * The base of the TeamDomain store repositories: one store, one table
 * handle, the shared read/write/validate boundary.
 */
export abstract class BaseRepository {
  private readonly handle: StorageDomainHandle
  protected readonly storeName: TeamDomainStore

  /**
   * @param handle - the open `team_domain` handle (injected seam).
   * @param storeName - the store (table) this repository manages.
   */
  constructor(handle: StorageDomainHandle, storeName: TeamDomainStore) {
    this.handle = handle
    this.storeName = storeName
  }

  /** The store name this repository manages. */
  get store(): TeamDomainStore {
    return this.storeName
  }

  /** The current record count of the store table. */
  get size(): number {
    try {
      return this.table.size
    } catch (error) {
      throw normalizeSeamError(error, this.storeName, 'size')
    }
  }

  /** The table handle for this repository's store (stable per domain). */
  protected get table(): StorageKvTable {
    try {
      return this.handle.table(this.storeName)
    } catch (error) {
      throw normalizeSeamError(error, this.storeName, 'table')
    }
  }

  /**
   * Read one raw row, verifying the TeamDomain string invariant.
   * @returns the canonical JSON string, or `undefined` when absent.
   * @throws `RECORD_INVALID` (problem `row-not-a-string`) when the row is
   *   present but not a string; seam failures via `normalizeSeamError`.
   */
  protected readRow(key: string): string | undefined {
    let value: unknown
    try {
      value = this.table.get(key)
    } catch (error) {
      throw normalizeSeamError(error, this.storeName, 'get')
    }
    if (value === undefined) return undefined
    if (typeof value !== 'string') {
      throw teamDomainError(
        'RECORD_INVALID',
        `row '${key}' of store '${this.storeName}' is not a string (TeamDomain rows are canonical JSON strings)`,
        { store: this.storeName, key, problem: 'row-not-a-string' },
      )
    }
    return value
  }

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
  protected readRecordFromRaw<T>(
    key: string,
    raw: string,
    deserialize: (json: string) => T,
    serialize: (value: T) => string,
  ): T {
    let record: T
    try {
      record = deserialize(raw)
    } catch (error) {
      throw normalizeValidationError(error, this.storeName, key)
    }
    if (serialize(record) !== raw) {
      throw teamDomainError(
        'RECORD_INVALID',
        `row '${key}' of store '${this.storeName}' is not in canonical byte form`,
        { store: this.storeName, key, problem: 'non-canonical-bytes' },
      )
    }
    return record
  }

  /**
   * Read one record by key.
   * @returns the frozen record, or `undefined` when the key is absent.
   */
  protected readRecord<T>(key: string, deserialize: (json: string) => T, serialize: (value: T) => string): T | undefined {
    const raw = this.readRow(key)
    if (raw === undefined) return undefined
    return this.readRecordFromRaw(key, raw, deserialize, serialize)
  }

  /**
   * Durably write one raw row (single-write durability before resolve).
   */
  protected async putRaw(key: string, value: string): Promise<void> {
    try {
      await this.table.put(key, value)
    } catch (error) {
      throw normalizeSeamError(error, this.storeName, 'put')
    }
  }

  /**
   * Write one row with the shared idempotency rule: identical stored bytes
   * are a no-op; an occupied key hands the existing raw to `onConflict`,
   * which MUST throw a typed `TeamDomainError` (never returns normally).
   */
  protected async putRecord(key: string, value: string, onConflict: (existing: string) => void): Promise<void> {
    const existing = this.readRow(key)
    if (existing === value) return
    if (existing !== undefined) onConflict(existing)
    await this.putRaw(key, value)
  }

  /**
   * Durably delete one row.
   * @returns `true` when the row existed, `false` otherwise (no write).
   */
  protected async deleteRow(key: string): Promise<boolean> {
    try {
      return await this.table.delete(key)
    } catch (error) {
      throw normalizeSeamError(error, this.storeName, 'delete')
    }
  }

  /**
   * Atomic read-modify-write on the domain's write chain.
   *
   * TeamDomain/contracts errors thrown by `fn` pass through unchanged
   * (they are business errors, not seam failures); anything else is
   * classified via `normalizeSeamError` — in particular the public
   * `missing-key` code surfaces as `SEAM_FAILURE`.
   */
  protected async updateRaw(key: string, fn: (current: unknown) => unknown): Promise<unknown> {
    try {
      return await this.table.update(key, fn)
    } catch (error) {
      if (isTeamDomainError(error) || isTeamContractError(error)) throw error
      throw normalizeSeamError(error, this.storeName, 'update')
    }
  }

  /**
   * Snapshot iterator over `[key, raw]` pairs; enforces the string
   * invariant on every row of the snapshot.
   */
  protected *snapshotEntries(): IterableIterator<[string, string]> {
    let iterator: IterableIterator<[string, unknown]>
    try {
      iterator = this.table.entries()
    } catch (error) {
      throw normalizeSeamError(error, this.storeName, 'entries')
    }
    for (const [key, value] of iterator) {
      if (typeof value !== 'string') {
        throw teamDomainError(
          'RECORD_INVALID',
          `row '${key}' of store '${this.storeName}' is not a string (TeamDomain rows are canonical JSON strings)`,
          { store: this.storeName, key, problem: 'row-not-a-string' },
        )
      }
      yield [key, value]
    }
  }

  /**
   * Classify an occupied-key conflict: contracts uniqueness codes are
   * preserved via `details.contractsCode` under `RECORD_DUPLICATE`;
   * already-typed TeamDomain errors pass through; anything else is an
   * unclassified conflict.
   */
  protected conflictError(error: unknown, key: string): TeamDomainError {
    if (isTeamDomainError(error)) return error
    if (isTeamContractError(error)) {
      return teamDomainError(
        'RECORD_DUPLICATE',
        `key '${key}' of store '${this.storeName}' is already occupied: ${error.message}`,
        { store: this.storeName, key, contractsCode: error.code },
      )
    }
    return teamDomainError(
      'RECORD_DUPLICATE',
      `key '${key}' of store '${this.storeName}' is already occupied: ${errorMessage(error)}`,
      { store: this.storeName, key, problem: 'unclassified-conflict' },
    )
  }
}
