/**
 * P7-T7 — legacy Team Session read-only reader: the closed error channel.
 *
 * The reader has exactly three typed failure modes (closed vocabulary):
 *
 * - `LEGACY_READER_INVALID_REQUEST` — the inspect request itself is not
 *   valid (a mutation-style action routed through the dispatch surface,
 *   or a malformed request object). The ONLY code the surface uses for
 *   mutation rejection; the details carry the offending action so a
 *   caller can attribute the attempt.
 * - `LEGACY_READER_MUTATION_REJECTED` — a mutate/resume/restore-style
 *   action was routed through the reader surface. The reader is
 *   read-only by construction (invariant 65: legacy Team Sessions stay
 *   read-only, never mutated or resumed): the typed rejection is the
 *   P7-T7 G7 criterion-9 guarantee on the surface.
 * - `LEGACY_READER_PORT_FAILURE` — the injected read-only port threw
 *   (an I/O fault beyond the best-effort missing-path contract). The
 *   reader never swallows port faults silently; it re-types them.
 *
 * Consumers MUST branch on `code`, never on message text.
 *
 * Pure module: no I/O, no ambient state.
 *
 * @module @dsh-agent-team/legacy/session-reader/errors
 */
/** The closed reader error-code vocabulary. */
export declare const LEGACY_READER_ERROR_CODES: {
    /** The request object is not a valid inspect request. */
    readonly LEGACY_READER_INVALID_REQUEST: "LEGACY_READER_INVALID_REQUEST";
    /** A mutation-style action was routed through the read-only surface. */
    readonly LEGACY_READER_MUTATION_REJECTED: "LEGACY_READER_MUTATION_REJECTED";
    /** The injected read-only port threw an unexpected fault. */
    readonly LEGACY_READER_PORT_FAILURE: "LEGACY_READER_PORT_FAILURE";
};
/** One reader error code. */
export type LegacyReaderErrorCode = (typeof LEGACY_READER_ERROR_CODES)[keyof typeof LEGACY_READER_ERROR_CODES];
/** Every reader error code, for closed-set membership tests. */
export declare const LEGACY_READER_ERROR_CODE_VALUES: readonly string[];
/** The typed reader error (closed code + lossless-JSON details). */
export declare class LegacyReaderError extends Error {
    /** The closed error code. */
    readonly code: LegacyReaderErrorCode;
    /** Lossless-JSON diagnostic details (no live references). */
    readonly details: Readonly<Record<string, unknown>>;
    constructor(code: LegacyReaderErrorCode, message: string, details: Readonly<Record<string, unknown>>);
}
/**
 * Type guard: is `value` a {@link LegacyReaderError} carrying a known code?
 * @param value - the value to check.
 * @returns `true` iff it is a `LegacyReaderError` with a vocabulary code.
 */
export declare function isLegacyReaderError(value: unknown): value is LegacyReaderError;
//# sourceMappingURL=errors.d.ts.map