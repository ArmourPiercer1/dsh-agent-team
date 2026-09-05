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
import type { OperationRecord, StorageDomainHandle } from '../schema/index.js';
import { BaseRepository } from './base.js';
/**
 * The `operations` repository (append-only journal).
 */
export declare class OperationsRepository extends BaseRepository {
    /**
     * @param handle - the open `team_domain` handle.
     */
    constructor(handle: StorageDomainHandle);
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
    put(operation: unknown): Promise<OperationRecord>;
    /**
     * Read one operation row by operation id.
     * @returns the frozen record, or `undefined` when absent.
     * @throws `RECORD_INVALID` (problem `bad-operation-id`) for a malformed
     *   operation id, or a malformed/non-canonical stored row.
     */
    get(operationId: string): OperationRecord | undefined;
    /**
     * List every operation row, sorted by operation id (byte order).
     */
    list(): OperationRecord[];
}
//# sourceMappingURL=operations.d.ts.map