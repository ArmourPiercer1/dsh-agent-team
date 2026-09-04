/**
 * RootBinding error channel (P5-T5).
 *
 * `RootBindingErrorCode` is a CLOSED vocabulary as of P5-T5 (same
 * discipline as the P5-T1 binder codes and the frozen contracts v1 error
 * codes, Development Plan §9.1). Consumers MUST branch on `code`, never
 * on message text.
 *
 * Semantics of each code (fail-closed; no effect before the throw):
 *
 * - `ROOT_BINDING_INVALID_INPUT` — the request is structurally invalid
 *   (e.g. a non-positive or non-integer `generation`). The call performs
 *   NO durable write and NO agent-setup step.
 * - `ROOT_BINDING_SESSION_KIND_CONFLICT` — the session already carries a
 *   session-kind binding of a kind other than `team-root` (a
 *   `team-member` or `ordinary` row): it cannot become the root of a
 *   Team (invariant 8: one Root Session owns 0/1 TeamSession; invariant
 *   23/24: a member child binding is never re-pointed). No effect.
 * - `ROOT_BINDING_TEAM_SESSION_CONFLICT` — the durable state contradicts
 *   the fresh-create request: a `team-root` binding without its
 *   TeamSession record (integrity violation, invariant 41), or an
 *   existing TeamSession record with a different immutable identity
 *   (blueprint, invariant 10) or a different generation (the fresh
 *   create is a generation-1 path). No effect.
 * - `ROOT_BINDING_LEADER_MINT_FAILED` — the durable LeaderInstance mint
 *   (P8-S2, Architecture §9.2 / invariants 14/15) cannot run: the
 *   blueprint catalog is absent (the mint is never defaulted) or the
 *   bound blueprint cannot be resolved / its content hash mismatches.
 *   The TeamSession record + binding committed before it stand
 *   (crash-safe ordering; a re-run completes the mint).
 *
 * Durable-write failures (the seam/repositories rejecting a put) are NOT
 * wrapped: the repository/seam error is the source of truth and carries
 * the stable code; the module only guarantees the ORDERING (binder not
 * run when a write failed).
 *
 * @module @dsh-agent-team/runtime/root-binding/errors
 */

/** The closed root-binding error-code vocabulary (P5-T5). */
export const ROOT_BINDING_ERROR_CODES = {
  /** Structurally invalid request (e.g. `generation` < 1). No effect. */
  ROOT_BINDING_INVALID_INPUT: 'ROOT_BINDING_INVALID_INPUT',
  /** The session's durable binding kind forbids a fresh team-root bind. */
  ROOT_BINDING_SESSION_KIND_CONFLICT: 'ROOT_BINDING_SESSION_KIND_CONFLICT',
  /** Durable TeamDomain state contradicts the fresh-create request. */
  ROOT_BINDING_TEAM_SESSION_CONFLICT: 'ROOT_BINDING_TEAM_SESSION_CONFLICT',
  /**
   * The fresh-root LeaderInstance mint (P8-S2) cannot run: the blueprint
   * catalog is absent (`details.cause = 'catalog-absent'`) or the bound
   * blueprint is unusable (`details.cause` = the activation code
   * `BLUEPRINT_UNRESOLVED` / `BLUEPRINT_HASH_MISMATCH`). The mint is
   * NEVER defaulted. Thrown AFTER the TeamSession record + binding
   * commits (crash-safe ordering: a re-run re-resolves and completes the
   * mint).
   */
  ROOT_BINDING_LEADER_MINT_FAILED: 'ROOT_BINDING_LEADER_MINT_FAILED',
} as const

/** One closed root-binding error code. */
export type RootBindingErrorCode =
  (typeof ROOT_BINDING_ERROR_CODES)[keyof typeof ROOT_BINDING_ERROR_CODES]

/** The flat value list (for the `isRootBindingError` check). */
export const ROOT_BINDING_ERROR_CODE_VALUES: readonly string[] = Object.freeze(
  Object.values(ROOT_BINDING_ERROR_CODES),
)

/**
 * The root-binding typed error. Carries a closed `code` and a lossless-
 * JSON `details` record.
 */
export class RootBindingError extends Error {
  /** The closed error code (branch on this, never on the message). */
  readonly code: RootBindingErrorCode
  /** A lossless-JSON details record (no live references). */
  readonly details: Record<string, unknown>

  /**
   * @param code - the closed error code.
   * @param message - the human-readable message (not an API).
   * @param details - the lossless-JSON details record.
   */
  constructor(
    code: RootBindingErrorCode,
    message: string,
    details: Record<string, unknown> = {},
  ) {
    super(message)
    this.name = 'RootBindingError'
    this.code = code
    this.details = details
  }
}

/**
 * Type guard: `true` iff `value` is an `Error` carrying one of the closed
 * root-binding codes.
 * @param value - the value to check.
 */
export function isRootBindingError(value: unknown): value is RootBindingError {
  if (!(value instanceof Error)) return false
  const code = (value as { code?: unknown }).code
  return typeof code === 'string' && ROOT_BINDING_ERROR_CODE_VALUES.includes(code)
}
