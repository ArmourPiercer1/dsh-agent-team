/**
 * P6-T6 — the tool argument boundary: request-token validation and the
 * per-tool argument field readers (fail closed, closed error codes).
 *
 * `requestToken` is REQUIRED on every tool: it is the caller's stable
 * logical-operation token (stable across retries of the same logical
 * operation; distinct per logical operation — the facade's idempotency /
 * audit identity, and the control plane's correlation identity). An empty
 * or over-long token is rejected BEFORE any runtime call (zero side
 * effects).
 *
 * @module @dsh-agent-team/tools/tokens
 */
/**
 * The maximum request-token length the tool layer accepts: the tightest
 * documented bound in the runtime (the activity ledger's
 * `ACTIVITY_REQUEST_TOKEN_MAX_LENGTH`); every satellite the tool layer
 * drives accepts a token within this bound.
 */
export declare const TEAM_TOOL_REQUEST_TOKEN_MAX_LENGTH = 128;
/** The closed tool-layer argument error code. */
export declare const TEAM_TOOL_BAD_ARGUMENTS = "TEAM_TOOL_BAD_ARGUMENTS";
/** The closed tool-layer caller-resolution error code. */
export declare const TEAM_TOOL_CALLER_UNRESOLVED = "TEAM_TOOL_CALLER_UNRESOLVED";
/** The closed tool-layer leader-only caller error code (C1: the pending-
 *  control list is a Leader discovery surface — a non-leader caller is
 *  rejected before any read). */
export declare const TEAM_TOOL_PENDING_LIST_NOT_LEADER = "TEAM_TOOL_PENDING_LIST_NOT_LEADER";
/** The closed tool-layer caller-root binding error code (P0: the calling
 *  session's owning team root must equal the requested root — every
 *  Team's leader shares `inst-leader`, so a cross-root caller is
 *  rejected typed at the common entry, before any downstream effect). */
export declare const TEAM_TOOL_CALLER_ROOT_MISMATCH = "TEAM_TOOL_CALLER_ROOT_MISMATCH";
/**
 * The fail-closed tool-layer argument error (one of the closed rejection
 * codes the result union maps to `status: 'rejected'`).
 */
export declare class TeamToolArgsError extends Error {
    /** The stable closed error code. */
    readonly code: string;
    /** Stable, lossless-JSON diagnostic details (optional). */
    readonly details?: Record<string, unknown>;
    constructor(message: string, details?: Record<string, unknown>);
}
/** Type guard: is `value` a {@link TeamToolArgsError}? */
export declare function isTeamToolArgsError(value: unknown): value is TeamToolArgsError;
/** Type guard: is `value` a JSON object usable as tool arguments? */
export declare function isArgsRecord(value: unknown): value is Record<string, unknown>;
/**
 * Read one string field of the arguments object.
 * @param args - the raw tool arguments (the host guarantees a JSON value).
 * @param field - the field name.
 * @returns the string, or `undefined` when the field is absent.
 * @throws {@link TeamToolArgsError} when the arguments are not an object
 *   or the field is present but not a string.
 */
export declare function readStringField(args: unknown, field: string): string | undefined;
/**
 * Read one REQUIRED string field (present, non-empty, length-bounded).
 * @param args - the raw tool arguments.
 * @param field - the field name.
 * @param maxLength - the maximum accepted length.
 * @throws {@link TeamToolArgsError} on missing / empty / over-long / non-string.
 */
export declare function requireStringField(args: unknown, field: string, maxLength: number): string;
/**
 * Read one OPTIONAL string field; an empty string is treated as ABSENT
 * (documented: optional fields carry no empty values).
 * @param args - the raw tool arguments.
 * @param field - the field name.
 * @param maxLength - the maximum accepted length.
 * @returns the string, or `undefined` when absent or empty.
 */
export declare function optionalStringField(args: unknown, field: string, maxLength: number): string | undefined;
/**
 * Validate the per-call logical-operation token (required, non-empty,
 * length-bounded to {@link TEAM_TOOL_REQUEST_TOKEN_MAX_LENGTH}).
 * @param args - the raw tool arguments.
 * @param field - the field name (default `requestToken`).
 * @returns the validated token.
 */
export declare function validateRequestToken(args: unknown, field?: string): string;
//# sourceMappingURL=tokens.d.ts.map