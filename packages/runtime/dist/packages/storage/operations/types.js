/**
 * OperationJournal protocol types (TaskDoc §11.5 P4-T2).
 *
 * The vNext TeamDomain is not a cross-table ACID database (Architecture
 * §14.4): every TeamDomain write, the external DSH Session/Agent creation,
 * and the ledger append are separate durable boundaries with a crash
 * possible between any two of them (Development Plan §17.3). The protocol
 * this module types is the crash model made executable:
 *
 * ```text
 * PREPARED operation (journal row — the first durable write)
 * → idempotent effects (check-then-apply through the TeamDomain
 *    repositories; an effect whose target record already exists from a
 *    previous attempt is detected and SKIPPED, never re-applied)
 * → ledger fact (duplicate-prevented per operationId)
 * → COMMITTED (terminal journal row)
 * ```
 *
 * Recovery defaults to roll-forward / reconcile, never rollback: a crash
 * anywhere leaves a durable state that re-driving the SAME operation
 * (same operationId, same idempotency key, same canonical intent)
 * converges to the same durable result (Development Plan §17.3).
 *
 * The protocol vocabulary here is intentionally small; every failure is a
 * `TeamDomainError` whose stable `code` and `details.problem` the
 * consumer branches on (never on message text). The problem tags below are
 * the ENGINE-level additions on top of P4-T1's row-level tags
 * (`terminal-operation`, `idempotency-conflict`, `non-monotonic-update`,
 * `unallocated-sequence`, ...):
 *
 * - `idempotency-conflict` — same operationId re-submitted with a
 *   different idempotency key, a different canonical intent, or a ledger
 *   fact already committed under a different team (RECORD_DUPLICATE);
 * - `stale-generation` — the caller's generation CAS
 *   (`expectedGeneration`) does not match the durable row (RECORD_INVALID);
 * - `operation-not-found` — drive/fail on an operationId with no durable
 *   journal row (RECORD_INVALID);
 * - `child-session-conflict` — a different external child session identity
 *   is already durably recorded for the operation (RECORD_DUPLICATE);
 * - `unclassified-effect-error` — an effect threw something that is not a
 *   TeamDomain/contracts error (SEAM_FAILURE, mirroring the
 *   `BaseRepository.updateRaw` classification discipline).
 *
 * Pure module: types and constants only, no I/O.
 * @module @dsh-agent-team/storage/operations/types
 */
/**
 * The engine-level problem tags of the operation protocol (the
 * `details.problem` values a consumer may branch on).
 */
export const JOURNAL_PROBLEMS = {
    /** Same operationId, different idempotency key / canonical intent / team fact. */
    IDEMPOTENCY_CONFLICT: 'idempotency-conflict',
    /** The caller's generation CAS does not match the durable row. */
    STALE_GENERATION: 'stale-generation',
    /** No durable journal row for the operationId. */
    OPERATION_NOT_FOUND: 'operation-not-found',
    /** A different external child session is already recorded for the operation. */
    CHILD_SESSION_CONFLICT: 'child-session-conflict',
    /** The operation is terminal (COMMITTED | FAILED) and immutable. */
    TERMINAL_OPERATION: 'terminal-operation',
    /** An effect threw a value that is not a TeamDomain/contracts error. */
    UNCLASSIFIED_EFFECT_ERROR: 'unclassified-effect-error',
};
//# sourceMappingURL=types.js.map