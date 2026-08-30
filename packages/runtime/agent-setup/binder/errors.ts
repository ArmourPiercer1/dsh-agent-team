/**
 * The binder's closed error-code channel (TaskDoc §11.5 P5-T1; ruling R28:
 * "T1 只留决策点与错误码通道").
 *
 * `TeamAgentBinderErrorCode` is a CLOSED vocabulary as of P5-T1. Adding or
 * renaming a code requires a change to this module's contract (reviewed at
 * G5 with the P5-T2..T6 work); it is never a silent addition. Consumers
 * MUST branch on `code`, never on message text (the same discipline as the
 * frozen contracts v1 error codes, Development Plan §9.1).
 *
 * Semantics of each code (fail-closed):
 *
 * - `BINDER_TARGET_KIND_MISMATCH` — the requested bind path does not match
 *   the session's durable kind (a root path requested for a `team-member`
 *   session or vice versa). The call performs NO effect and throws.
 * - `BINDER_TARGET_NOT_FOUND` — the session IS a team session (its binding
 *   says so) but the durable record the path requires is absent
 *   (TeamSession record for a root path, or MemberInstance record for a
 *   member path). The binder never creates TeamDomain records — a missing
 *   record is a provisioning defect, surfaced fail-closed.
 * - `BINDER_RECORD_CONFLICT` — the durable records contradict each other
 *   (e.g. the session binding's child id differs from the MemberInstance
 *   record's `childSessionId`, invariant 23/24). TeamDomain integrity
 *   violation, surfaced fail-closed.
 * - `BINDER_MEMBER_DISPOSED` — the member's durable lifecycle is terminal
 *   (`DISPOSED`, Architecture §29.5). A disposed Member can never gain a
 *   residency (DevPlan §18.5); the bind is refused before any effect.
 * - `BINDER_OVERLAY_FAILED` — an overlay slot's `apply`, a surface
 *   `installOverlay` / `restoreScope` / `recordSessionEvent` call, or the
 *   event recording failed. FATAL before work: no later slot runs, no
 *   admission decision runs, the target is NOT registered as bound, and
 *   the original error is preserved on `cause` (the `details` record stays
 *   lossless-JSON; no live references are stored there).
 *
 * The ordinary-session no-op raises NO error: it is a successful no-effect
 * result (see {@link TeamAgentBindResult} in ./types.js).
 *
 * Pure module: no I/O, no runtime environment assumptions.
 * @module @dsh-agent-team/runtime/agent-setup/binder/errors
 */

/** The closed binder error-code vocabulary (P5-T1). */
export const TEAM_AGENT_BINDER_ERROR_CODES = {
  /** Root path on a `team-member` session (or vice versa). No effect. */
  BINDER_TARGET_KIND_MISMATCH: 'BINDER_TARGET_KIND_MISMATCH',
  /** Team session with an absent required durable record. No record is created. */
  BINDER_TARGET_NOT_FOUND: 'BINDER_TARGET_NOT_FOUND',
  /** Durable records contradict each other (TeamDomain integrity). */
  BINDER_RECORD_CONFLICT: 'BINDER_RECORD_CONFLICT',
  /** Terminal member lifecycle (`DISPOSED`); residency impossible. */
  BINDER_MEMBER_DISPOSED: 'BINDER_MEMBER_DISPOSED',
  /** Slot apply / surface effect / event recording failed; fatal before work. */
  BINDER_OVERLAY_FAILED: 'BINDER_OVERLAY_FAILED',
} as const

/** One closed binder error code. */
export type TeamAgentBinderErrorCode =
  (typeof TEAM_AGENT_BINDER_ERROR_CODES)[keyof typeof TEAM_AGENT_BINDER_ERROR_CODES]

/** The flat value list (for the `isTeamAgentBinderError` check). */
export const TEAM_AGENT_BINDER_ERROR_CODE_VALUES: readonly string[] = Object.freeze(
  Object.values(TEAM_AGENT_BINDER_ERROR_CODES),
)

/**
 * The binder's typed error. Carries a closed `code`, a lossless-JSON
 * `details` record, and (for `BINDER_OVERLAY_FAILED`) the original thrown
 * error on `cause`.
 */
export class TeamAgentBinderError extends Error {
  /** The closed error code (branch on this, never on the message). */
  readonly code: TeamAgentBinderErrorCode
  /** A lossless-JSON detail record (plain values only; no live references). */
  readonly details: Record<string, unknown>

  /**
   * @param code - the closed error code.
   * @param message - a human-readable message (NOT a contract).
   * @param details - the lossless-JSON detail record (default `{}`).
   * @param cause - the original error (default `undefined`).
   */
  constructor(
    code: TeamAgentBinderErrorCode,
    message: string,
    details: Record<string, unknown> = {},
    cause?: unknown,
  ) {
    super(message, cause !== undefined ? { cause } : undefined)
    this.name = 'TeamAgentBinderError'
    this.code = code
    this.details = details
  }
}

/**
 * Type guard: `true` iff `value` is an `Error` carrying one of the closed
 * binder codes.
 * @param value - the value to check.
 */
export function isTeamAgentBinderError(value: unknown): value is TeamAgentBinderError {
  if (!(value instanceof Error)) return false
  const code = (value as { code?: unknown }).code
  return typeof code === 'string' && TEAM_AGENT_BINDER_ERROR_CODE_VALUES.includes(code)
}
