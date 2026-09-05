/**
 * Lifecycle transitions at the MemberInstance (domain wrapper) level (P3-T3).
 *
 * Composes the record-level lifecycle FSM (domain `lifecycle` module) with the
 * member-wrapper bookkeeping the v1 DTO cannot carry:
 *
 * - **I1** — `transitionInstance(instance, operation)` commits the operation
 *   on the durable record via `applyLifecycleOperation` (lifecycle rules
 *   D1–D3: same legal edges, same typed rejection, `activityVersion + 1`)
 *   and returns a NEW frozen {@link MemberInstance}.
 * - **I2** — `hasEnteredRunning` flips to `true` the first time the record
 *   enters RUNNING and never resets (roster rule R4). This is what makes the
 *   §21.2 workspace lock for-life, and what distinguishes "never ran" from
 *   "ran and settled" (Architecture §31: lifecycle != residency).
 * - **I3** — `contextPolicy` is carried over verbatim on every transition —
 *   it froze at creation (§21.6) and there is no operation that changes it.
 *
 * Pure module: no I/O, no live Agent, no runtime environment assumptions.
 * @module @dsh-agent-team/domain/member/instance
 */
import type { LifecycleOperation } from '../../lifecycle/src/index.js';
import type { MemberInstance } from './roster.js';
/**
 * Commit a lifecycle operation on a MemberInstance (I1–I3).
 *
 * @param instance - the current member instance (never mutated).
 * @param operation - the lifecycle operation (see the lifecycle module for
 *   the frozen rules: ADMIT_WORK / SETTLE / ARCHIVE / RESTORE / DISPOSE).
 * @returns a NEW frozen {@link MemberInstance} in the operation's target
 *   state, with `hasEnteredRunning` updated (I2) and `contextPolicy`
 *   unchanged (I3).
 * @throws {@link import('../lifecycle/src/index.js').LifecycleTransitionError}
 *   when the record's state is not a legal source for the operation
 *   (lifecycle rule D1).
 * @throws TypeError when `operation` is not a vocabulary member.
 */
export declare function transitionInstance(instance: MemberInstance, operation: LifecycleOperation): MemberInstance;
//# sourceMappingURL=instance.d.ts.map