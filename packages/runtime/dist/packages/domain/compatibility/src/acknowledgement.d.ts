/**
 * Warning acknowledgement for the compatibility engine.
 *
 * Architecture §27.3: an acknowledgement must correspond to a **specific
 * mismatch / environment generation** —it binds to the requirement's
 * mismatch fingerprint *and* the environment fingerprint of the evaluation
 * it was created from. It is never a permanent "ignore all warnings" flag:
 * when the environment or the selected AgentPreset changes and produces a
 * new mismatch, the old acknowledgement does not cover the new problem.
 *
 * An ack therefore carries provenance (who/when) and both fingerprints; the
 * engine re-derives both fingerprints on every evaluation and classifies the
 * ack VALID / STALE / MISSING. Only VALID acks of a WARNING satisfy it
 * (Team enters the acknowledged-degraded state, §27.2/§28
 * DEGRADED_ACKNOWLEDGED). FATAL outcomes are never ack-able (§27.2: FATAL
 * 不允许Continue Anyway).
 *
 * Pure module: no I/O, no live Agent, no runtime environment assumptions.
 * @module @dsh-agent-team/domain/compatibility/acknowledgement
 */
/** A user acknowledgement of one specific compatibility WARNING. */
export interface WarningAcknowledgement {
    /** The requirementId of the WARNING being acknowledged. */
    readonly requirementId: string;
    /** Mismatch fingerprint of the evaluation the ack was created from. */
    readonly mismatchFingerprint: string;
    /** Environment fingerprint of the evaluation the ack was created from. */
    readonly environmentFingerprint: string;
    /** Provenance: who acknowledged (Architecture §14.3 E). */
    readonly acknowledgedBy: string;
    /** Provenance: when (ISO 8601). */
    readonly acknowledgedAt: string;
    /** Optional operator note. */
    readonly note?: string;
}
/**
 * Parse and validate one warning acknowledgement.
 * @param value - the raw acknowledgement.
 * @param path - pointer used in the error details (defaults to `$`).
 * @returns the frozen acknowledgement.
 * @throws `MALFORMED_DTO` for any malformed/unknown field or a non-ISO
 *   `acknowledgedAt`.
 */
export declare function parseWarningAcknowledgement(value: unknown, path?: string): WarningAcknowledgement;
/**
 * Parse and validate an acknowledgement list (order preserved).
 * @param values - the raw array (an empty list is valid).
 * @returns the frozen list.
 * @throws `MALFORMED_DTO` when not an array or for any malformed member.
 */
export declare function parseWarningAcknowledgements(values: unknown): readonly WarningAcknowledgement[];
//# sourceMappingURL=acknowledgement.d.ts.map