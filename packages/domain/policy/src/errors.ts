/**
 * Policy resolver domain errors (P3-T4).
 *
 * The resolver distinguishes two error families:
 *
 * - **Identity-boundary violations** (malformed ids, cross-scope member
 *   identity): the resolver validates its own boundary with the local
 *   contracts-v1 mirror (./contracts-mirror.js) and surfaces them as
 *   `MALFORMED_POLICY_INPUT` / `IDENTITY_SCOPE_MISMATCH` (the latter keeps
 *   the contracts-v1 code string) — one public error type, no re-wrapping.
 * - **Policy-semantic violations**: surfaced as
 *   {@link PolicyResolutionError} with the closed domain code set below.
 *
 * The two escalation codes implement the frozen invariants (Architecture
 * §42):
 * - invariant 37: "A member cannot self-escalate unrestrictedly" → a
 *   member-origin autonomy overlay that grants items outside the Team
 *   autonomy envelope FAILS with `MEMBER_SELF_ESCALATION` (TaskDoc P3-T4
 *   "a Member attempting self-elevation must fail (typed error)");
 * - invariant 36: "A leader/router/automation can never cross the Team
 *   autonomy envelope" → a leader-origin overlay outside the envelope FAILS
 *   with `LEADER_OUT_OF_ENVELOPE`.
 *
 * An out-of-envelope overlay record makes the WHOLE resolution fail
 * (fail-closed): the resolver never silently drops a violating record and
 * never resolves "around" it.
 *
 * Note the deliberate split with §19.4 "stored but suppressed": a
 * previously-recorded overlay that is inside the static envelope but
 * outside the CURRENT PolicyState envelope is NOT an error — it is
 * suppressed (the state tightening is a legitimate runtime event). Only an
 * overlay that violates the STATIC blueprint/template envelope — something
 * that could never have been recorded legitimately — is a violation.
 *
 * Pure module: no I/O, no DSH imports, no ambient state.
 * @module @dsh-agent-team/domain/policy/errors
 */

import type { CapabilityName } from './types.js'

/** The CLOSED set of policy resolver domain error codes. */
export const POLICY_ERROR_CODES = {
  /**
   * A structural violation of the resolver input: unknown capability key,
   * malformed policy entry (bad kind, empty/duplicate/non-string items,
   * unknown field), malformed overlay/override record (bad id, wrong
   * scope/kind, bad origin/scope), malformed PolicyState view, or malformed
   * external facts map.
   */
  MALFORMED_POLICY_INPUT: 'MALFORMED_POLICY_INPUT',
  /**
   * A MEMBER-origin autonomy overlay grants items outside the Team autonomy
   * envelope (invariant 37). The self-elevation attempt fails; it never
   * resolves.
   */
  MEMBER_SELF_ESCALATION: 'MEMBER_SELF_ESCALATION',
  /**
   * A LEADER-origin autonomy overlay (leader or authorized automation)
   * grants items outside the Team autonomy envelope (invariant 36). The
   * out-of-envelope attempt fails; it never resolves.
   */
  LEADER_OUT_OF_ENVELOPE: 'LEADER_OUT_OF_ENVELOPE',
  /**
   * The input member identity belongs to a different TeamSession
   * (`member.rootSessionId !== teamSessionId`; invariant 18: the composite
   * identity key prevents cross-TeamSession confusion). Keeps the
   * contracts-v1 code string of the same name; thrown by the local
   * boundary mirror (./contracts-mirror.js) as the policy's own error type.
   */
  IDENTITY_SCOPE_MISMATCH: 'IDENTITY_SCOPE_MISMATCH',
} as const

/** One of the closed domain error codes. */
export type PolicyErrorCode = (typeof POLICY_ERROR_CODES)[keyof typeof POLICY_ERROR_CODES]

/** Every domain error code value, for membership checks and closed-set tests. */
export const POLICY_ERROR_CODE_VALUES: readonly string[] = [
  POLICY_ERROR_CODES.MALFORMED_POLICY_INPUT,
  POLICY_ERROR_CODES.MEMBER_SELF_ESCALATION,
  POLICY_ERROR_CODES.LEADER_OUT_OF_ENVELOPE,
  POLICY_ERROR_CODES.IDENTITY_SCOPE_MISMATCH,
]

/**
 * The typed error thrown by the policy resolver for policy-semantic input
 * violations.
 *
 * Consumers MUST branch on `code`, never on `message` text (same discipline
 * as the contracts v1 `TeamContractError`).
 */
export class PolicyResolutionError extends Error {
  /** The closed domain error code. */
  readonly code: PolicyErrorCode
  /**
   * Machine-readable details. Known keys: `capability` (the affected cell,
   * {@link CapabilityName}), `overlayId` (the offending overlay record),
   * `field` (the malformed input path), `problem` (short structural
   * reason), `outOfEnvelopeItems` (items outside the envelope),
   * `envelopeItems` (the sorted envelope item set at failure time),
   * `identityRootSessionId` / `teamSessionId` / `instanceId` (the scope
   * mismatch components).
   */
  readonly details?: Record<string, unknown>

  constructor(
    code: PolicyErrorCode,
    message: string,
    details?: Record<string, unknown>,
  ) {
    super(message)
    this.name = 'PolicyResolutionError'
    this.code = code
    if (details !== undefined) {
      this.details = details
    }
  }
}

/** Type guard: is `value` a {@link PolicyResolutionError}? */
export function isPolicyResolutionError(value: unknown): value is PolicyResolutionError {
  if (!(value instanceof PolicyResolutionError)) return false
  return (
    typeof value.code === 'string' && POLICY_ERROR_CODE_VALUES.includes(value.code)
  )
}
