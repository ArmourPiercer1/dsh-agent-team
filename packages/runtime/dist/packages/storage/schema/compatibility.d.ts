/**
 * CompatibilityStateRecord — the `compatibility` store record
 * (Architecture §14.3 category E, storage-level v1).
 *
 * The durable compatibility verdict of a TeamSession: the requirement
 * outcomes evaluated by the P3 policy domain, the fingerprint of the
 * checked environment/inputs, and the explicit human acknowledgements
 * that allow DEGRADED_ACKNOWLEDGED states. The vocabulary is aligned
 * with the frozen P3 policy domain:
 *
 * - status `OPEN` — no blocking requirement mismatch;
 * - `BLOCKED_WARNING` — warnings present, not blocking;
 * - `BLOCKED_FATAL` — a fatal mismatch blocks further progress;
 * - `DEGRADED_ACKNOWLEDGED` — a mismatch was explicitly acknowledged
 *   (one acknowledgement per requirement+fingerprint pair).
 *
 * Storage validates the closed shape only: `outcomes` is a lossless-JSON
 * record of requirement outcomes (semantic evaluation stays in the P3
 * domain). Acknowledgements carry their own fingerprints so an
 * acknowledgement cannot silently survive an environment change.
 *
 * The store key is the root session id: exactly one durable
 * compatibility state per TeamSession.
 *
 * Pure module: no I/O.
 * @module @dsh-agent-team/storage/schema/compatibility
 */
import type { RemoteSafeRecord, RootSessionId } from '../../contracts/src/index.js';
/** The four frozen compatibility statuses (P3 policy-domain aligned). */
export declare const COMPATIBILITY_STATUS: {
    /** No blocking requirement mismatch. */
    readonly OPEN: "OPEN";
    /** Warnings present; not blocking. */
    readonly BLOCKED_WARNING: "BLOCKED_WARNING";
    /** A fatal mismatch blocks further progress. */
    readonly BLOCKED_FATAL: "BLOCKED_FATAL";
    /** A mismatch explicitly acknowledged by a human. */
    readonly DEGRADED_ACKNOWLEDGED: "DEGRADED_ACKNOWLEDGED";
};
/** One of the four frozen compatibility statuses. */
export type CompatibilityStatus = (typeof COMPATIBILITY_STATUS)[keyof typeof COMPATIBILITY_STATUS];
/** The frozen statuses (for validation and iteration). */
export declare const COMPATIBILITY_STATUS_VALUES: readonly CompatibilityStatus[];
/** The exact frozen fields of a CompatibilityAcknowledgement (v1). */
export declare const COMPATIBILITY_ACKNOWLEDGEMENT_FIELDS: readonly string[];
/** The exact frozen fields of a CompatibilityStateRecord (v1). */
export declare const COMPATIBILITY_FIELDS: readonly string[];
/**
 * A durable, explicit human acknowledgement of one compatibility
 * mismatch (required for DEGRADED_ACKNOWLEDGED).
 */
export interface CompatibilityAcknowledgement {
    /** The requirement the acknowledgement applies to. */
    readonly requirementId: string;
    /** Fingerprint of the mismatch that was acknowledged. */
    readonly mismatchFingerprint: string;
    /** Fingerprint of the environment the mismatch was evaluated in. */
    readonly environmentFingerprint: string;
    /** The human identity that acknowledged. */
    readonly acknowledgedBy: string;
    /** Acknowledgement time, ISO-8601. */
    readonly acknowledgedAt: string;
    /** Optional free-text note (whitespace allowed, no control characters). */
    readonly note?: string;
}
/**
 * The `compatibility` store record: the durable compatibility state of
 * one TeamSession (keyed by root session id).
 */
export interface CompatibilityStateRecord {
    /** Record shape version; v1 records carry `1`. */
    readonly schemaVersion: number;
    /** The TeamSession (root session id) this state belongs to. */
    readonly rootSessionId: RootSessionId;
    /** The frozen compatibility status. */
    readonly status: CompatibilityStatus;
    /** Fingerprint of the checked environment/inputs. */
    readonly fingerprint: string;
    /** Record version/generation counter (starts at 1). */
    readonly generation: number;
    /** The lossless-JSON requirement outcomes (semantic values owned by the P3 domain). */
    readonly outcomes: RemoteSafeRecord;
    /** The durable explicit acknowledgements. */
    readonly acknowledgements: readonly CompatibilityAcknowledgement[];
    /** Last evaluation time, ISO-8601. */
    readonly computedAt: string;
}
/**
 * Parse and validate one compatibility acknowledgement.
 * @param value - the unknown input.
 * @returns the frozen acknowledgement.
 * @throws `RECORD_INVALID` for any rule violation.
 */
export declare function parseCompatibilityAcknowledgement(value: unknown): CompatibilityAcknowledgement;
/**
 * Parse and validate a compatibility state record from an untrusted value.
 * @param value - the unknown input.
 * @returns the frozen record.
 * @throws `RECORD_INVALID` (storage-level) or contracts codes for
 *   malformed ids (preserved via `normalizeValidationError`).
 */
export declare function parseCompatibilityState(value: unknown): CompatibilityStateRecord;
/**
 * Serialize a record to its stable canonical JSON form (sorted keys).
 * @param record - the record.
 * @returns the canonical JSON text.
 */
export declare function serializeCompatibilityState(record: CompatibilityStateRecord): string;
/**
 * Deserialize canonical JSON back into a validated, frozen record.
 * @param json - the canonical JSON text.
 * @returns the parsed record.
 * @throws `RECORD_INVALID` (problem `malformed-json`) when the text is not
 *   valid JSON, plus the validation codes a malformed record triggers.
 */
export declare function deserializeCompatibilityState(json: string): CompatibilityStateRecord;
//# sourceMappingURL=compatibility.d.ts.map