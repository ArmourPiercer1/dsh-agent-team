/**
 * OperationsRepository — the `operations` store: the durable operation
 * journal, keyed by operation id (append-only: no delete).
 *
 * This repository fixes the row-level conflict semantics the P4-T2
 * operation protocol (PREPARED → effects → COMMITTED) will build on:
 *
 * - a terminal operation (`COMMITTED` | `FAILED`) is IMMUTABLE: any
 *   different value at its key raises `RECORD_DUPLICATE` (problem
 *   `terminal-operation`); identical bytes are the idempotent no-op;
 * - a non-terminal operation may be re-put (retry/repair) only under the
 *   same `idempotencyKey` (else `RECORD_DUPLICATE`, problem
 *   `idempotency-conflict`) and only with a strictly higher `generation`
 *   (else `RECORD_INVALID`, problem `non-monotonic-update`).
 *
 * @module @dsh-agent-team/storage/repositories/operations
 */

import {
  OPERATION_ID_PATTERN,
  OPERATION_TERMINAL_PHASES,
  deserializeOperationRecord,
  normalizeValidationError,
  parseOperationRecord,
  serializeOperationRecord,
  teamDomainError,
} from '../schema/index.js'
import type { OperationRecord, StorageDomainHandle } from '../schema/index.js'
import { BaseRepository } from './base.js'

/**
 * The `operations` repository (append-only journal).
 */
export class OperationsRepository extends BaseRepository {
  /**
   * @param handle - the open `team_domain` handle.
   */
  constructor(handle: StorageDomainHandle) {
    super(handle, 'operations')
  }

  /**
   * Durably put one operation row, keyed by operation id.
   *
   * Conflict semantics: identical bytes → no-op; existing terminal →
   * `terminal-operation`; different idempotency key →
   * `idempotency-conflict`; non-increasing generation →
   * `non-monotonic-update`.
   * @param operation - the unknown input, parsed via
   *   `parseOperationRecord` (closed shape, diagnostic cross-field rules).
   * @returns the frozen record.
   */
  async put(operation: unknown): Promise<OperationRecord> {
    let record: OperationRecord
    try {
      record = parseOperationRecord(operation)
    } catch (error) {
      throw normalizeValidationError(error, this.storeName)
    }
    const key = record.operationId
    await this.putRecord(key, serializeOperationRecord(record), (existing) => {
      let other: OperationRecord
      try {
        other = deserializeOperationRecord(existing)
      } catch (error) {
        throw normalizeValidationError(error, this.storeName, key)
      }
      if (OPERATION_TERMINAL_PHASES.includes(other.phase)) {
        throw teamDomainError(
          'RECORD_DUPLICATE',
          `operation '${key}' is terminal in phase '${other.phase}' and immutable`,
          { store: this.storeName, key, problem: 'terminal-operation', phase: other.phase },
        )
      }
      if (other.idempotencyKey !== record.idempotencyKey) {
        throw teamDomainError(
          'RECORD_DUPLICATE',
          `operation '${key}' was prepared under a different idempotency key`,
          { store: this.storeName, key, problem: 'idempotency-conflict', expected: other.idempotencyKey, found: record.idempotencyKey },
        )
      }
      if (record.generation <= other.generation) {
        throw teamDomainError(
          'RECORD_INVALID',
          `operation '${key}' re-put must carry a strictly higher generation`,
          { store: this.storeName, key, problem: 'non-monotonic-update', existing: other.generation, found: record.generation },
        )
      }
    })
    return record
  }

  /**
   * Read one operation row by operation id.
   * @returns the frozen record, or `undefined` when absent.
   * @throws `RECORD_INVALID` (problem `bad-operation-id`) for a malformed
   *   operation id, or a malformed/non-canonical stored row.
   */
  get(operationId: string): OperationRecord | undefined {
    if (!OPERATION_ID_PATTERN.test(operationId)) {
      throw teamDomainError(
        'RECORD_INVALID',
        `operation id must match ${OPERATION_ID_PATTERN}, got ${JSON.stringify(operationId)}`,
        { store: this.storeName, key: operationId, problem: 'bad-operation-id' },
      )
    }
    return this.readRecord(operationId, deserializeOperationRecord, serializeOperationRecord)
  }

  /**
   * List every operation row, sorted by operation id (byte order).
   */
  list(): OperationRecord[] {
    const records: OperationRecord[] = []
    for (const [key, raw] of this.snapshotEntries()) {
      records.push(this.readRecordFromRaw(key, raw, deserializeOperationRecord, serializeOperationRecord))
    }
    records.sort((a, b) => (a.operationId < b.operationId ? -1 : a.operationId > b.operationId ? 1 : 0))
    return records
  }
}
