/**
 * The frozen Result/Error vocabulary of the PR0 interface freeze points.
 *
 * THE ERROR SET IS COPIED VERBATIM from post-poc-technical-design.md §5
 * ("错误类型建议（尚未发布）"), spelling included:
 *
 *   TOOL_BINDING_UNVERIFIED, TEAM_TOOL_UNGOVERNED, APPROVAL_STALE,
 *   IO_POLICY_UNSUPPORTED, SANDBOX_UNAVAILABLE, ADAPTER_DRAINING,
 *   DOMAIN_DENIED, EXECUTION_TERMINATION_UNCONFIRMED
 *
 * The design's own status is carried honestly (§5 heading: 建议，尚未发布):
 * these are the PR0 CONTRACT names the PR1–PR8 error surfaces map onto; the
 * §5 distinctions are load-bearing — "区分 Team deny、审批不存在、Provider
 * 能力不足、Domain deny 和未知是否已发生副作用；错误不能为 LLM 自动重试/绕行
 * 开门" — so `sideEffectUnknown` is a first-class field and no code here is
 * retryable by implication.
 *
 * Purity: no `node:*`, no I/O.
 *
 * @module @dsh-agent-team/domain/tool-governance/errors
 */

/** The §5 suggested error codes, VERBATIM (test-pinned by exact spelling). */
export const GOVERNANCE_ERROR_CODES = Object.freeze([
  'TOOL_BINDING_UNVERIFIED',
  'TEAM_TOOL_UNGOVERNED',
  'APPROVAL_STALE',
  'IO_POLICY_UNSUPPORTED',
  'SANDBOX_UNAVAILABLE',
  'ADAPTER_DRAINING',
  'DOMAIN_DENIED',
  'EXECUTION_TERMINATION_UNCONFIRMED',
] as const)

/** One §5 error code. */
export type GovernanceErrorCode = (typeof GOVERNANCE_ERROR_CODES)[number]

/** One typed governance error (never a stringly tool failure). */
export interface GovernanceError {
  readonly code: GovernanceErrorCode
  readonly message: string
  /**
   * TRUE when the operation may have produced side effects that the platform
   * cannot confirm as stopped (e.g. `EXECUTION_TERMINATION_UNCONFIRMED`,
   * timeout-after-execution, design §4.3). A retry that assumes "nothing
   * happened" is a law violation, so this field is explicit, never implied.
   */
  readonly sideEffectUnknown?: boolean
  readonly details?: Readonly<Record<string, string | number | boolean | null>>
}

/** The closed Result shape of every frozen interface (no thrown authorities). */
export type GovernanceResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: GovernanceError }
