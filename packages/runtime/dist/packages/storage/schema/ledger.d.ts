/**
 * LedgerEntry — the `ledger` store record
 * (Architecture §14.3 category G, storage-level v1).
 *
 * The durable append-only fact ledger of a TeamSession: a strictly
 * increasing sequence of facts, each with its own fact type and
 * lossless-JSON payload. The ledger is the audit trail the recovery
 * protocol (roll-forward, never rollback) reconciles against: gaps in
 * the sequence are diagnosable, and a crashed write leaves a gap that a
 * later write can fill.
 *
 * Invariants enforced here:
 *
 * - `sequence` is a positive integer; the row key is `String(sequence)`;
 * - `factType` discriminates the fact family (1..128, no control
 *   chars/whitespace); semantic validation of the payload belongs to the
 *   domain that produced the fact;
 * - `operationId` (when present) links the fact to the operation that
 *   produced it, and must match the frozen operation id pattern.
 *
 * The sequence allocation itself (the counter row and its atomic
 * increment) is implemented by the repository over the public seam's
 * `update`; this module only fixes the row shapes.
 *
 * Pure module: no I/O.
 * @module @dsh-agent-team/storage/schema/ledger
 */
import type { RemoteSafeRecord, RootSessionId } from '../../contracts/src/index.js';
/** The reserved row key of the ledger sequence counter (not a fact row). */
export declare const LEDGER_SEQUENCE_COUNTER_KEY = "__ledger_sequence_counter";
/** The frozen discriminator of the counter row value. */
export declare const LEDGER_SEQUENCE_COUNTER_KIND = "ledger-sequence-counter";
/** The exact frozen fields of a LedgerSequenceCounter (v1). */
export declare const LEDGER_SEQUENCE_COUNTER_FIELDS: readonly string[];
/** The exact frozen fields of a LedgerEntry (v1). */
export declare const LEDGER_ENTRY_FIELDS: readonly string[];
/**
 * The durable sequence counter row of the `ledger` store: the highest
 * allocated sequence (0 before the first allocation).
 */
export interface LedgerSequenceCounter {
    /** Record shape version; v1 rows carry `1`. */
    readonly schemaVersion: number;
    /** Always the frozen counter discriminator. */
    readonly kind: typeof LEDGER_SEQUENCE_COUNTER_KIND;
    /** The highest allocated sequence (0 before the first allocation). */
    readonly value: number;
}
/**
 * The `ledger` store record: one durable fact row (keyed by
 * `String(sequence)`).
 */
export interface LedgerEntry {
    /** Record shape version; v1 entries carry `1`. */
    readonly schemaVersion: number;
    /** The strictly increasing sequence number (row key). */
    readonly sequence: number;
    /** The TeamSession (root session id) the fact belongs to. */
    readonly rootSessionId: RootSessionId;
    /** The fact family discriminator (1..128, no control chars/whitespace). */
    readonly factType: string;
    /** The lossless-JSON fact payload. */
    readonly payload: RemoteSafeRecord;
    /** The operation that produced the fact (when attributable to one). */
    readonly operationId?: string;
    /** Fact creation time, ISO-8601. */
    readonly createdAt: string;
}
/**
 * Parse and validate the ledger sequence counter row.
 * @param value - the unknown input.
 * @returns the frozen counter.
 * @throws `RECORD_INVALID` for any rule violation.
 */
export declare function parseLedgerSequenceCounter(value: unknown): LedgerSequenceCounter;
/**
 * Serialize the counter to its stable canonical JSON form.
 * @param counter - the counter.
 * @returns the canonical JSON text.
 */
export declare function serializeLedgerSequenceCounter(counter: LedgerSequenceCounter): string;
/**
 * Deserialize the counter row from canonical JSON.
 * @param json - the canonical JSON text.
 * @returns the parsed counter.
 * @throws `RECORD_INVALID` (problem `malformed-json`) when the text is not
 *   valid JSON, plus the validation codes a malformed row triggers.
 */
export declare function deserializeLedgerSequenceCounter(json: string): LedgerSequenceCounter;
/**
 * Parse and validate a ledger entry from an untrusted value.
 * @param value - the unknown input.
 * @returns the frozen entry.
 * @throws `RECORD_INVALID` (storage-level) or contracts codes for
 *   malformed root session ids (preserved via `normalizeValidationError`).
 */
export declare function parseLedgerEntry(value: unknown): LedgerEntry;
/**
 * Serialize an entry to its stable canonical JSON form (sorted keys).
 * @param entry - the entry.
 * @returns the canonical JSON text.
 */
export declare function serializeLedgerEntry(entry: LedgerEntry): string;
/**
 * Deserialize canonical JSON back into a validated, frozen entry.
 * @param json - the canonical JSON text.
 * @returns the parsed entry.
 * @throws `RECORD_INVALID` (problem `malformed-json`) when the text is not
 *   valid JSON, plus the validation codes a malformed entry triggers.
 */
export declare function deserializeLedgerEntry(json: string): LedgerEntry;
//# sourceMappingURL=ledger.d.ts.map