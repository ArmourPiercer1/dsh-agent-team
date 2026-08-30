/**
 * ActivationProvider error contract (TaskDoc §11.7 P6-T1).
 *
 * Fail-closed error semantics (frozen):
 *
 * - every admission failure (steps 1–11 of the DevPlan §19.2 order) throws
 *   an {@link ActivationError} with a code from the CLOSED vocabulary below
 *   and leaves ZERO durable writes;
 * - durable-protocol failures (the journal, the binding service, the
 *   repositories) are mapped onto this same closed vocabulary; an
 *   unclassified downstream fault is re-thrown UNWRAPPED (it belongs to the
 *   owner module and must keep its original identity);
 * - a failure AFTER the durable reservation never rolls back: the reserved
 *   operation stays PREPARED and the activation converges on re-drive
 *   (Architecture §18 roll-forward model).
 *
 * Pure module: no I/O, no `node:` builtins.
 * @module @dsh-agent-team/runtime/activation/errors
 */

/** The closed activation error-code vocabulary. */
export const ACTIVATION_ERROR_CODES = {
  /** The request failed structural validation (closed source vocabulary,
   *  XOR addressing, required fields). */
  REQUEST_MALFORMED: 'ACTIVATION_REQUEST_MALFORMED',
  /** Step 1: the root has no `team-root` binding or no TeamSession record. */
  TEAM_SESSION_NOT_FOUND: 'ACTIVATION_TEAM_SESSION_NOT_FOUND',
  /** Step 2: the bound blueprint snapshot cannot be resolved from the
   *  catalog. */
  BLUEPRINT_UNRESOLVED: 'ACTIVATION_BLUEPRINT_UNRESOLVED',
  /** Step 2: the resolved blueprint's content hash does not match the bound
   *  snapshot ref (the snapshot is immutable — invariant, §5.2/§8.4). */
  BLUEPRINT_HASH_MISMATCH: 'ACTIVATION_BLUEPRINT_HASH_MISMATCH',
  /** Step 3: the blueprint declares no member template with this id. */
  TEMPLATE_NOT_FOUND: 'ACTIVATION_TEMPLATE_NOT_FOUND',
  /** Step 4: the caller lacks the authority for the activation source. */
  CALLER_AUTHORITY_DENIED: 'ACTIVATION_CALLER_AUTHORITY_DENIED',
  /** Step 5: the activation source is not admitted to create new work. */
  SOURCE_NOT_ADMITTED: 'ACTIVATION_SOURCE_NOT_ADMITTED',
  /** Step 6: compatibility is BLOCKED_WARNING (unacknowledged). */
  COMPATIBILITY_BLOCKED_WARNING: 'ACTIVATION_COMPATIBILITY_BLOCKED_WARNING',
  /** Step 6: compatibility is BLOCKED_FATAL. */
  COMPATIBILITY_BLOCKED_FATAL: 'ACTIVATION_COMPATIBILITY_BLOCKED_FATAL',
  /** Delegation: the delegation target cannot be resolved to a continued
   *  instance (no member at the explicit address, or the addressed instance
   *  is terminal-DISPOSED; the underlying domain/contract code is carried
   *  in `details.code`). */
  DELEGATION_TARGET_UNRESOLVED: 'ACTIVATION_DELEGATION_TARGET_UNRESOLVED',
  /** Step 7: the team-wide instance quota is exhausted. */
  QUOTA_TEAM_MAX_INSTANCES: 'ACTIVATION_QUOTA_TEAM_MAX_INSTANCES',
  /** Step 7: the team-wide concurrent-active quota is exhausted. */
  QUOTA_TEAM_MAX_CONCURRENT: 'ACTIVATION_QUOTA_TEAM_MAX_CONCURRENT',
  /** Step 7: the per-member (per-template) instance quota is exhausted. */
  QUOTA_MEMBER_MAX_INSTANCES: 'ACTIVATION_QUOTA_MEMBER_MAX_INSTANCES',
  /** Step 7: the per-member (per-template) concurrent-active quota is
   *  exhausted. */
  QUOTA_MEMBER_MAX_CONCURRENT: 'ACTIVATION_QUOTA_MEMBER_MAX_CONCURRENT',
  /** Step 8: the effective policy could not be resolved (malformed stored
   *  overlay/override values fail closed). */
  POLICY_RESOLUTION_FAILED: 'ACTIVATION_POLICY_RESOLUTION_FAILED',
  /** Step 9: the overlay bounds check failed (a claimed value lies outside
   *  the blueprint ∩ template mutation envelope). */
  OVERLAY_BOUNDS_VIOLATION: 'ACTIVATION_OVERLAY_BOUNDS_VIOLATION',
  /** Step 10: the workspace field is structurally invalid. */
  INVALID_WORKSPACE_FIELD: 'ACTIVATION_INVALID_WORKSPACE_FIELD',
  /** Step 10: the label field is structurally invalid. */
  INVALID_LABEL_FIELD: 'ACTIVATION_INVALID_LABEL_FIELD',
  /** Step 10: the groupId field is structurally invalid. */
  INVALID_GROUP_ID_FIELD: 'ACTIVATION_INVALID_GROUP_ID_FIELD',
  /** Step 10: the template declares a contextPolicy token outside the closed
   *  contextPolicy vocabulary (invariant 29: the creation-time policy must
   *  be a known value — the blueprint validation does not enforce the
   *  domain vocabulary). */
  TEMPLATE_CONTEXT_POLICY_UNKNOWN: 'ACTIVATION_TEMPLATE_CONTEXT_POLICY_UNKNOWN',
  /** Step 11: the allocated instance id collides with a committed member or
   *  an in-flight reservation (loud failure — the logical token is stable,
   *  so this is a true conflict, never a silent rotation). */
  INSTANCE_ID_CONFLICT: 'ACTIVATION_INSTANCE_ID_CONFLICT',
  /** Step 11: the allocated instance id would equal the reserved leader id. */
  LEADER_INSTANCE_ID_RESERVED: 'ACTIVATION_LEADER_INSTANCE_ID_RESERVED',
  /** Durable protocol: a different idempotency key/intent under the same
   *  operation id (the logical operation was reused with different
   *  content). */
  IDEMPOTENCY_CONFLICT: 'ACTIVATION_IDEMPOTENCY_CONFLICT',
  /** Durable protocol: the durable child session is already bound to
   *  another member (the durable child is never re-pointed). */
  CHILD_SESSION_CONFLICT: 'ACTIVATION_CHILD_SESSION_CONFLICT',
  /** Step 13: the child-session factory faulted (the one external effect). */
  CHILD_SESSION_CREATION_FAILED: 'ACTIVATION_CHILD_SESSION_CREATION_FAILED',
  /** Step 13: the unconditional session-durability barrier rejected. */
  BARRIER_REJECTED: 'ACTIVATION_BARRIER_REJECTED',
  /** Post-commit: the binder install failed (the member is durably
   *  committed; the overlay install must be re-driven). */
  BINDER_FAILED: 'ACTIVATION_BINDER_FAILED',
  /** Recovery: the durable operation for this logical activation is
   *  terminally FAILED (abandoned — an unclassified effect error made the
   *  journal give up on the operation). Roll-forward never applies to a
   *  FAILED operation: the caller must start a NEW logical operation
   *  (new requestToken). */
  OPERATION_FAILED: 'ACTIVATION_OPERATION_FAILED',
} as const

/** One of the closed activation error codes. */
export type ActivationErrorCode = (typeof ACTIVATION_ERROR_CODES)[keyof typeof ACTIVATION_ERROR_CODES]

/** Every activation error code value, for membership checks. */
export const ACTIVATION_ERROR_CODE_VALUES: readonly string[] = Object.values(ACTIVATION_ERROR_CODES)

/**
 * The fail-closed activation error.
 *
 * Branch on `code` (and `details`), never on the message text.
 */
export class ActivationError extends Error {
  /** The stable closed error code. */
  readonly code: ActivationErrorCode
  /** Stable, lossless-JSON diagnostic details (optional). */
  readonly details?: Record<string, unknown>

  constructor(code: ActivationErrorCode, message: string, details?: Record<string, unknown>) {
    super(message)
    this.name = 'ActivationError'
    this.code = code
    if (details !== undefined) {
      this.details = details
    }
  }
}

/** Type guard: is `value` an {@link ActivationError}? */
export function isActivationError(value: unknown): value is ActivationError {
  return value instanceof ActivationError
}
