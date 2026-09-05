/**
 * Pure lifecycle transition logic over the frozen
 * {@link MemberInstanceRecordDto} vocabulary.
 *
 * Domain rules (this module, P3-T3):
 *
 * - **D1** — The only legal (from, to) pairs are the 9 edges of
 *   {@link LIFECYCLE_TRANSITION_MATRIX} (Architecture §29). Everything else —
 *   including self-transitions — is rejected with a typed
 *   {@link LifecycleTransitionError}.
 * - **D2** — A committed transition produces a NEW frozen record: the input
 *   record is never mutated; identity fields
 *   (`rootSessionId`, `instanceId`, `templateId`, `label`, `groupId`,
 *   `childSessionId`) and `createdAt` are preserved verbatim.
 * - **D3** — Every committed transition is one durable record change and
 *   bumps `activityVersion` by exactly 1 (contract v1: "starts at 1,
 *   monotonically increases" — the domain fixes the step size deterministically).
 *
 * This module describes durable state transitions only: no Agent/Session
 * handle, no I/O, no runtime side effect (Architecture §29/§30 — the runtime
 * procedures such as quiesce/admit/settle happen BEFORE the durable commit;
 * this module is the commit rule).
 *
 * Pure module: no I/O, no live Agent, no runtime environment assumptions.
 * @module @dsh-agent-team/domain/lifecycle/transitions
 */
import type { MemberInstanceRecordDto, MemberLifecycleState } from '../../../contracts/src/index.js';
import type { LifecycleOperation } from './operations.js';
/**
 * Is `state` the terminal DISPOSED state (no outgoing transitions, §29.5)?
 * @param state - the lifecycle state to check.
 */
export declare function isTerminalState(state: MemberLifecycleState): boolean;
/**
 * Is the (from, to) pair a legal edge of the §29 FSM?
 * @param from - the source lifecycle state.
 * @param to - the requested target state.
 */
export declare function canTransition(from: MemberLifecycleState, to: MemberLifecycleState): boolean;
/**
 * The exact legal targets from `from` (empty for the terminal state).
 * @param from - the source lifecycle state.
 */
export declare function legalTargets(from: MemberLifecycleState): readonly MemberLifecycleState[];
/**
 * Assert the (from, to) pair is a legal §29 edge; throw a typed
 * {@link LifecycleTransitionError} otherwise.
 * @param from - the source lifecycle state.
 * @param to - the requested target state.
 * @throws `LIFECYCLE_TERMINAL_STATE` when `from` is DISPOSED;
 *   `LIFECYCLE_ILLEGAL_TRANSITION` for every other illegal pair.
 */
export declare function assertTransitionLegal(from: MemberLifecycleState, to: MemberLifecycleState): void;
/**
 * Commit a (from, to) lifecycle transition on a member record.
 *
 * @param record - the current member record (its `lifecycle` is `from`).
 * @param to - the requested target state.
 * @returns a NEW frozen record with `lifecycle = to` and
 *   `activityVersion + 1` (D2, D3).
 * @throws {@link LifecycleTransitionError} when the pair is illegal (D1).
 */
export declare function transitionMemberLifecycle(record: MemberInstanceRecordDto, to: MemberLifecycleState): MemberInstanceRecordDto;
/**
 * Commit a named lifecycle operation on a member record.
 *
 * @param record - the current member record.
 * @param operation - the lifecycle operation to apply.
 * @returns a NEW frozen record in the operation's target state with
 *   `activityVersion + 1` (D2, D3).
 * @throws {@link LifecycleTransitionError} when the record's state is not one
 *   of the operation's sources.
 * @throws TypeError when `operation` is not a vocabulary member (the typed
 *   API already forbids this; the runtime guard keeps the module total).
 */
export declare function applyLifecycleOperation(record: MemberInstanceRecordDto, operation: LifecycleOperation): MemberInstanceRecordDto;
//# sourceMappingURL=transitions.d.ts.map