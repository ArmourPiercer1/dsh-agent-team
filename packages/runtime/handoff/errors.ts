/**
 * Start Team from Here — the closed handoff error contract
 * (TaskDoc §11.8 P7-T5; DevPlan §20.5; Architecture §34).
 *
 * Fail-closed error semantics (frozen):
 *
 * - every validation failure and every port failure is either THROWN as
 *   a {@link HandoffError} with a code from the CLOSED vocabulary below,
 *   or CARRIED on the observable operation state (the
 *   `awaiting-decision` / `creation-failed` variants of the
 *   `HandoffOperationState` union in `types.ts`) — a failure is never
 *   silently pretended as a successful handoff (Architecture §34.4);
 * - a failure BEFORE the team creation entry is called leaves ZERO
 *   creation effects (the "failure before root create" invariant,
 *   DevPlan §20.5);
 * - the target-side source-history guard ALWAYS rejects with
 *   {@link HANDOFF_ERROR_CODES.SOURCE_HISTORY_ACCESS_DENIED} — the
 *   target has no history/search permission on the source
 *   (Architecture §34.3).
 *
 * Pure module: no I/O, no `node:` builtins.
 * @module @dsh-agent-team/runtime/handoff/errors
 */

/** The closed handoff error-code vocabulary. */
export const HANDOFF_ERROR_CODES = {
  /** The request failed structural validation (session id rules,
   *  request token rules, staged-fields lossless-JSON check, decision
   *  option vocabulary). */
  REQUEST_MALFORMED: 'HANDOFF_REQUEST_MALFORMED',
  /** The public session query/read surface failed to deliver the
   *  frozen current canonical surface (or delivered a non lossless-JSON
   *  value). No summary, no team creation. */
  SOURCE_SURFACE_UNAVAILABLE: 'HANDOFF_SOURCE_SURFACE_UNAVAILABLE',
  /** The one-shot summarize/compress route failed (Architecture §34.4).
   *  Carried on the `awaiting-decision` state with the explicit
   *  Retry / Continue without handoff / Cancel triad — never thrown
   *  away silently, never pretended as success. */
  SUMMARIZATION_FAILED: 'HANDOFF_SUMMARIZATION_FAILED',
  /** The public Team creation entry failed AFTER the handoff context
   *  was frozen. Carried on the `creation-failed` state; a
   *  re-invocation retries the creation idempotently (same stable
   *  intentToken). */
  TEAM_CREATION_FAILED: 'HANDOFF_TEAM_CREATION_FAILED',
  /** A target-side attempt to history-read or search the source
   *  session (Architecture §34.3: B cannot history_read(A); B cannot
   *  search A). ALWAYS rejected; the rejection never depends on the
   *  presented context token. */
  SOURCE_HISTORY_ACCESS_DENIED: 'HANDOFF_SOURCE_HISTORY_ACCESS_DENIED',
  /** The operation identity is unknown to the service (never started,
   *  or a different service instance — the registry is
   *  process-lifetime). */
  OPERATION_UNKNOWN: 'HANDOFF_OPERATION_UNKNOWN',
  /** A decision was requested for an operation that is not in the
   *  `awaiting-decision` state. */
  OPERATION_NOT_DECIDABLE: 'HANDOFF_OPERATION_NOT_DECIDABLE',
  /** The operation is already finalized (completed /
   *  completed-without-handoff / canceled) and no decision may be
   *  taken on it anymore (one-shot, Architecture §34.2). */
  OPERATION_ALREADY_FINALIZED: 'HANDOFF_OPERATION_ALREADY_FINALIZED',
} as const

/** One code of the closed handoff error vocabulary. */
export type HandoffErrorCode =
  (typeof HANDOFF_ERROR_CODES)[keyof typeof HANDOFF_ERROR_CODES]

/** The closed set of handoff error codes (exhaustion checks). */
export const HANDOFF_ERROR_CODE_VALUES: readonly string[] = Object.values(
  HANDOFF_ERROR_CODES,
)

/**
 * The handoff error: a fail-closed rejection of one handoff operation
 * (or one target-side source access attempt), carrying a code from the
 * closed vocabulary plus an optional lossless-JSON detail record.
 */
export class HandoffError extends Error {
  /** The closed error code. */
  readonly code: HandoffErrorCode
  /** An optional lossless-JSON detail record. */
  readonly details?: Record<string, unknown>

  /**
   * @param code - the closed error code.
   * @param message - the human-readable message.
   * @param details - the optional lossless-JSON detail record.
   */
  constructor(
    code: HandoffErrorCode,
    message: string,
    details?: Record<string, unknown>,
  ) {
    super(message)
    this.name = 'HandoffError'
    this.code = code
    if (details !== undefined) {
      this.details = details
    }
  }
}

/** Type guard: is `value` a {@link HandoffError}? */
export function isHandoffError(value: unknown): value is HandoffError {
  return value instanceof HandoffError
}
