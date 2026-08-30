/**
 * P6-T3 — the closed error vocabulary of the messaging-coordination module.
 *
 * The coordinator fails closed with a {@link MessagingError} carrying one of
 * the {@link MESSAGING_ERROR_CODES} for failures of the MESSAGING SURFACE
 * (its own input validation, the self-send policy, the delivery phase, and
 * the confirmation-fact commit). The P6-T2 facade's
 * {@link import('../admission/index.js').TeamRuntimeError}
 * (addressing, caller identity, authority, envelope, quota, compatibility,
 * and the facade's own durable-write failures) PROPAGATES UNMAPPED: the
 * facade remains the single authority for action-admission codes, and this
 * module never re-implements or re-labels an admission decision.
 *
 * Closed codes:
 *
 * - `MESSAGING_REQUEST_MALFORMED` — the module-level input shape is invalid
 *   (checked BEFORE any facade call; zero durable writes).
 * - `MESSAGING_SELF_SEND_REJECTED` — an instance caller addresses its OWN
 *   instance. Defined policy (documented ruling): an instance cannot route
 *   team coordination input to itself — self-talk is not team coordination;
 *   the check runs before any facade call, zero durable writes.
 * - `MESSAGING_TARGET_NOT_LIVE` — the delivery target (the recipient
 *   instance for a direct delivery, the LEADER instance for a mediated
 *   one) is missing or not work-accepting in the fresh view at delivery
 *   time. The durable intent fact REMAINS (Architecture §24.2 orders the
 *   intent before the delivery); restart recovery skips dead/missing
 *   targets (documented ruling in `coordinator.ts`).
 * - `MESSAGING_DELIVERY_FAILED` — the injected session input port rejected
 *   the attributed input. The intent fact remains durable and the
 *   coordination is recoverable (at-least-once delivery semantics,
 *   detectable through the correlation token).
 * - `MESSAGING_LEDGER_WRITE_FAILED` — the durable confirmation-fact commit
 *   (or its sequence allocation) failed. The session input may already have
 *   been delivered (at-least-once, detectable through the correlation
 *   token); the fact stays pending for recovery.
 * - `MESSAGING_INTERNAL` — an internal invariant violation (a programming
 *   error; never a caller-reachable rejection).
 *
 * Pure module: no I/O.
 * @module messaging (P6-T3)
 */

export const MESSAGING_ERROR_CODES = {
  MESSAGING_REQUEST_MALFORMED: 'MESSAGING_REQUEST_MALFORMED',
  MESSAGING_SELF_SEND_REJECTED: 'MESSAGING_SELF_SEND_REJECTED',
  MESSAGING_TARGET_NOT_LIVE: 'MESSAGING_TARGET_NOT_LIVE',
  MESSAGING_DELIVERY_FAILED: 'MESSAGING_DELIVERY_FAILED',
  MESSAGING_LEDGER_WRITE_FAILED: 'MESSAGING_LEDGER_WRITE_FAILED',
  MESSAGING_INTERNAL: 'MESSAGING_INTERNAL',
} as const

/** One of the closed messaging error codes. */
export type MessagingErrorCode =
  (typeof MESSAGING_ERROR_CODES)[keyof typeof MESSAGING_ERROR_CODES]

/** Every messaging error code value, for membership checks. */
export const MESSAGING_ERROR_CODE_VALUES: readonly string[] = Object.values(
  MESSAGING_ERROR_CODES,
)

/**
 * One typed, fail-closed failure of the messaging surface.
 *
 * `details` is a lossless-JSON diagnostic record (never a live object).
 */
export class MessagingError extends Error {
  /** The closed error code. */
  readonly code: MessagingErrorCode
  /** The lossless-JSON diagnostic details (absent when not applicable). */
  readonly details?: Record<string, unknown>

  constructor(
    code: MessagingErrorCode,
    message: string,
    details?: Record<string, unknown>,
  ) {
    super(message)
    this.name = 'MessagingError'
    this.code = code
    if (details !== undefined) {
      this.details = details
    }
  }
}

/** Type guard: is `error` a MessagingError? */
export function isMessagingError(error: unknown): error is MessagingError {
  return error instanceof MessagingError
}
