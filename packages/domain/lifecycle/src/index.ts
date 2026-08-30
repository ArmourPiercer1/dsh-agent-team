/**
 * @dsh-agent-team/domain/lifecycle — the MemberInstance lifecycle FSM.
 *
 * Pure domain layer over the frozen contracts v1 vocabulary
 * (Development Plan §9.2: "lifecycle FSM" lives in `domain`):
 *
 * - the five-state vocabulary is the contract's `MEMBER_LIFECYCLE_STATES`
 *   (Architecture §29) — this module does not redefine it;
 * - the legal (from, to) matrix (9 edges of 25 pairs) is derived from the
 *   frozen operation rules (Architecture §29 FSM, §30.1–§30.4);
 * - transitions are pure functions over `MemberInstanceRecordDto`: they
 *   describe durable state changes only — no Agent/Session handle, no I/O
 *   (TaskDoc §11.4 P3-T3 "只描述 durable state"; §31: lifecycle != residency).
 *
 * Key acceptance semantics encoded here:
 *
 * - **Restore is ONLY legal from ARCHIVED to SETTLED** (Architecture §30.2
 *   final frozen semantics 3A; TaskDoc P3-T3 验收标准);
 * - Archive commits only from the quiescent SETTLED state (§30.1);
 * - DISPOSED is terminal (§29.5).
 *
 * Pure module: no I/O, no live Agent, no ambient state.
 * @module @dsh-agent-team/domain/lifecycle
 */

export {
  LIFECYCLE_DOMAIN_ERROR_CODES,
  LifecycleTransitionError,
  isLifecycleTransitionError,
} from './errors.js'
export type {
  LifecycleDomainErrorCode,
  LifecycleTransitionReason,
} from './errors.js'

export {
  LIFECYCLE_OPERATIONS,
  LIFECYCLE_OPERATION_VALUES,
  isLifecycleOperation,
  LIFECYCLE_OPERATION_RULES,
  LIFECYCLE_TRANSITION_MATRIX,
} from './operations.js'
export type { LifecycleOperation, LifecycleOperationRule } from './operations.js'

export {
  isTerminalState,
  canTransition,
  legalTargets,
  assertTransitionLegal,
  transitionMemberLifecycle,
  applyLifecycleOperation,
} from './transitions.js'
