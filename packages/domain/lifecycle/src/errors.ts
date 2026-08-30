/**
 * Typed errors for the MemberInstance lifecycle FSM (P3-T3, domain level).
 *
 * Authority: Architecture §29 (Member lifecycle FSM), §29.5 (DISPOSED is
 * terminal), §30 (Archive / Restore / Dispose), §31 (lifecycle != residency).
 *
 * **Why a domain error and not `TeamContractError`**: contract v1
 * (`packages/contracts/src/errors.ts`) fixes a CLOSED 20-code vocabulary for
 * *contract* rules (identity format, binding cardinality, DTO shape, legacy
 * vocabulary, schema version). Lifecycle legality is a *domain* rule
 * (Architecture §29/§30), so it carries its own typed error. The codes below
 * are deliberately disjoint from the contract code set: `isTeamContractError`
 * branches on `code`, so a lifecycle error must never be mistaken for a
 * contract error, and vice versa.
 *
 * Pure module: no I/O, no live Agent, no runtime environment assumptions.
 * @module @dsh-agent-team/domain/lifecycle/errors
 */

import type { MemberLifecycleState } from '../../../contracts/src/index.js'

/** Closed set of lifecycle domain error codes (P3-T3). */
export const LIFECYCLE_DOMAIN_ERROR_CODES = {
  /** The source state is the terminal DISPOSED state: no outgoing transitions exist (Architecture §29.5). */
  TERMINAL_STATE: 'LIFECYCLE_TERMINAL_STATE',
  /** The (from, to) pair is not a legal edge of the Architecture §29 FSM — including self-transitions. */
  ILLEGAL_TRANSITION: 'LIFECYCLE_ILLEGAL_TRANSITION',
} as const

/** A lifecycle domain error code. */
export type LifecycleDomainErrorCode =
  (typeof LIFECYCLE_DOMAIN_ERROR_CODES)[keyof typeof LIFECYCLE_DOMAIN_ERROR_CODES]

/** Which rule rejected the attempted transition. */
export type LifecycleTransitionReason = 'TERMINAL_STATE' | 'ILLEGAL_TRANSITION'

/**
 * Thrown when a requested lifecycle transition is not legal.
 *
 * Carries the exact (from, to) pair so callers (runtime, tests, future UI)
 * can branch on structure, never on message text.
 */
export class LifecycleTransitionError extends Error {
  /** Disjoint-from-contracts error code ({@link LIFECYCLE_DOMAIN_ERROR_CODES}). */
  readonly code: LifecycleDomainErrorCode
  /** The rejection rule that fired. */
  readonly reason: LifecycleTransitionReason
  /** The lifecycle state the record was in. */
  readonly from: MemberLifecycleState
  /** The requested target state. */
  readonly to: MemberLifecycleState

  constructor(
    code: LifecycleDomainErrorCode,
    reason: LifecycleTransitionReason,
    from: MemberLifecycleState,
    to: MemberLifecycleState,
    message: string,
  ) {
    super(message)
    this.name = 'LifecycleTransitionError'
    this.code = code
    this.reason = reason
    this.from = from
    this.to = to
  }
}

/** Type guard for {@link LifecycleTransitionError}. */
export function isLifecycleTransitionError(value: unknown): value is LifecycleTransitionError {
  return value instanceof LifecycleTransitionError
}
