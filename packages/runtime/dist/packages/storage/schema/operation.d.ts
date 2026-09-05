/**
 * OperationRecord — the `operations` store record
 * (Architecture §14.3 category F, storage-level v1).
 *
 * The durable operation journal row of the TeamDomain: one intent, one
 * idempotency key, one phase. This is the PREPARED→effects→COMMITTED
 * journal that P4-T2 will drive; the storage layer fixes the row shape
 * and the identity/idempotency rules, not the protocol.
 *
 * Invariants enforced here:
 *
 * - `operationId` is the row key: `/^op-[a-z0-9]{1,32}$/`;
 * - `idempotencyKey` identifies the caller's logical operation across
 *   retries; the same key may be re-put with a strictly higher
 *   generation while the operation is non-terminal;
 * - `phase` is `PREPARED` | `COMMITTED` | `FAILED`;
 * - `failureDiagnostic` is required exactly when the phase is `FAILED`
 *   and forbidden otherwise (a COMMITTED operation carries no failure
 *   text; a PREPARED one has not failed yet);
 * - `childSessionId` (when present) must be a valid member child session
 *   id — the operation may reference its target member.
 *
 * The put-time conflict semantics (terminal immutability,
 * idempotency-key agreement, generation monotonicity) live in the
 * repository, which has access to the existing row.
 *
 * Pure module: no I/O.
 * @module @dsh-agent-team/storage/schema/operation
 */
import type { ChildSessionId, RemoteSafeRecord } from '../../contracts/src/index.js';
/** The frozen operation id pattern (row key). */
export declare const OPERATION_ID_PATTERN: RegExp;
/** The frozen operation phases. */
export declare const OPERATION_PHASES: {
    /** The operation was prepared; effects may not be committed yet. */
    readonly PREPARED: "PREPARED";
    /** The operation's effects are durably committed (terminal). */
    readonly COMMITTED: "COMMITTED";
    /** The operation failed (terminal). */
    readonly FAILED: "FAILED";
};
/** One of the three frozen operation phases. */
export type OperationPhase = (typeof OPERATION_PHASES)[keyof typeof OPERATION_PHASES];
/** The terminal phases (immutability boundary). */
export declare const OPERATION_TERMINAL_PHASES: readonly OperationPhase[];
/** The exact frozen fields of an OperationIntent (v1). */
export declare const OPERATION_INTENT_FIELDS: readonly string[];
/** The exact frozen fields of an OperationRecord (v1). */
export declare const OPERATION_FIELDS: readonly string[];
/** The durable operation intent: a typed payload. */
export interface OperationIntent {
    /** The intent type discriminator (1..128, no control chars/whitespace). */
    readonly type: string;
    /** The lossless-JSON intent payload. */
    readonly payload: RemoteSafeRecord;
}
/**
 * The `operations` store record: one durable operation row
 * (keyed by operation id).
 */
export interface OperationRecord {
    /** Record shape version; v1 records carry `1`. */
    readonly schemaVersion: number;
    /** The operation id (row key), `/^op-[a-z0-9]{1,32}$/`. */
    readonly operationId: string;
    /** The caller's logical operation identity (idempotency key). */
    readonly idempotencyKey: string;
    /** The typed intent. */
    readonly intent: OperationIntent;
    /** The operation phase. */
    readonly phase: OperationPhase;
    /** The target member child session (when the operation acts on one). */
    readonly childSessionId?: ChildSessionId;
    /** The failure diagnostic; present exactly when the phase is `FAILED`. */
    readonly failureDiagnostic?: string;
    /** Last modification time, ISO-8601. */
    readonly updatedAt: string;
    /** Record version/generation counter (starts at 1; must increase on re-put). */
    readonly generation: number;
}
/**
 * Parse and validate an operation record from an untrusted value.
 * @param value - the unknown input.
 * @returns the frozen record.
 * @throws `RECORD_INVALID` (storage-level) or contracts codes for
 *   malformed child session ids (preserved via `normalizeValidationError`).
 */
export declare function parseOperationRecord(value: unknown): OperationRecord;
/**
 * Serialize a record to its stable canonical JSON form (sorted keys).
 * @param record - the record.
 * @returns the canonical JSON text.
 */
export declare function serializeOperationRecord(record: OperationRecord): string;
/**
 * Deserialize canonical JSON back into a validated, frozen record.
 * @param json - the canonical JSON text.
 * @returns the parsed record.
 * @throws `RECORD_INVALID` (problem `malformed-json`) when the text is not
 *   valid JSON, plus the validation codes a malformed record triggers.
 */
export declare function deserializeOperationRecord(json: string): OperationRecord;
//# sourceMappingURL=operation.d.ts.map