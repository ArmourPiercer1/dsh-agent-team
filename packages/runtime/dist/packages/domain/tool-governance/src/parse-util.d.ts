/**
 * Strict-parse utilities for the Alpha.5 PR0 tool-governance lane.
 *
 * THE PARSE LAW (plan §3, mirroring `domain/authority-envelope`'s parser
 * discipline): every raw structure is validated against a CLOSED shape — an
 * unknown extra field is a typed refusal (`unknown-field`), never a silent
 * drop. Problems are COLLECTED, not short-circuited: a reviewer reading one
 * refusal sees every defect of that document, and a test can pin the exact
 * code of each. Partial acceptance never happens.
 *
 * Purity: no `node:*`, no I/O, no clock.
 *
 * @module @dsh-agent-team/domain/tool-governance/parse-util
 */
/** The closed set of structural problem codes this lane reports. */
export declare const TOOL_CONTRACT_PROBLEM_CODES: readonly ["not-a-record", "unknown-field", "missing-field", "field-type", "value-outside-closed-set", "empty-string", "locator-rejected", "rights-matrix", "effect-resource-mismatch", "not-canonical", "fingerprint-mismatch", "state-transition", "lease-terminal", "lease-extends-grant", "contradiction", "canonical-value-not-json"];
/** One structural problem code. */
export type ToolContractProblemCode = (typeof TOOL_CONTRACT_PROBLEM_CODES)[number];
/** One located structural problem. */
export interface ToolContractProblem {
    readonly code: ToolContractProblemCode;
    readonly path: string;
    readonly detail: string;
}
/** A strict parse outcome — never partial, never a silent default. */
export type ParseResult<T> = {
    readonly ok: true;
    readonly value: T;
} | {
    readonly ok: false;
    readonly problems: readonly ToolContractProblem[];
};
/** The mutable collector threaded through one parse. */
export type ProblemSink = ToolContractProblem[];
/** Extract the codes of a failed result (test helper, exported for pins). */
export declare function problemCodesOf(result: {
    ok: boolean;
    problems?: readonly ToolContractProblem[];
}): string[];
/** True for a non-null, non-array object. */
export declare function isRecord(value: unknown): value is Record<string, unknown>;
/** Report every key outside the closed allow-list (`unknown-field`). */
export declare function closeRecordKeys(record: Record<string, unknown>, allowed: readonly string[], path: string, problems: ProblemSink): void;
/** A required non-empty string field (present-but-null counts as absent). */
export declare function reqString(record: Record<string, unknown>, key: string, path: string, problems: ProblemSink): string | undefined;
/** A required non-negative safe integer. */
export declare function reqNonNegativeInt(record: Record<string, unknown>, key: string, path: string, problems: ProblemSink): number | undefined;
/** A value from a closed enumeration (wrong value → `value-outside-closed-set`). */
export declare function closedValue<T extends string>(record: Record<string, unknown>, key: string, values: readonly T[], path: string, problems: ProblemSink): T | undefined;
/** A `sha256:<hex>` fingerprint tag (shape only — the value is opaque here). */
export declare function reqFingerprint(record: Record<string, unknown>, key: string, path: string, problems: ProblemSink): string | undefined;
/** Finish a parse: refusal with the collected problems, or the frozen value. */
export declare function finish<T>(problems: ProblemSink, value: () => T): ParseResult<T>;
/** Recursively freeze a plain value and return it (immutable snapshots). */
export declare function deepFreezeContracts<T>(value: T): T;
//# sourceMappingURL=parse-util.d.ts.map