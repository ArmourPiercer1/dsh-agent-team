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
import { MEMBER_LIFECYCLE_STATES, deepFreeze, } from '../../../contracts/src/index.js';
import { LIFECYCLE_DOMAIN_ERROR_CODES, LifecycleTransitionError, } from './errors.js';
import { LIFECYCLE_OPERATION_RULES, LIFECYCLE_OPERATION_VALUES, LIFECYCLE_TRANSITION_MATRIX, isLifecycleOperation, } from './operations.js';
const DISPOSED = MEMBER_LIFECYCLE_STATES.DISPOSED;
/**
 * Is `state` the terminal DISPOSED state (no outgoing transitions, §29.5)?
 * @param state - the lifecycle state to check.
 */
export function isTerminalState(state) {
    return state === DISPOSED;
}
/**
 * Is the (from, to) pair a legal edge of the §29 FSM?
 * @param from - the source lifecycle state.
 * @param to - the requested target state.
 */
export function canTransition(from, to) {
    return LIFECYCLE_TRANSITION_MATRIX[from].includes(to);
}
/**
 * The exact legal targets from `from` (empty for the terminal state).
 * @param from - the source lifecycle state.
 */
export function legalTargets(from) {
    return LIFECYCLE_TRANSITION_MATRIX[from];
}
/**
 * Assert the (from, to) pair is a legal §29 edge; throw a typed
 * {@link LifecycleTransitionError} otherwise.
 * @param from - the source lifecycle state.
 * @param to - the requested target state.
 * @throws `LIFECYCLE_TERMINAL_STATE` when `from` is DISPOSED;
 *   `LIFECYCLE_ILLEGAL_TRANSITION` for every other illegal pair.
 */
export function assertTransitionLegal(from, to) {
    if (isTerminalState(from)) {
        rejectTransition(from, to);
    }
    if (!canTransition(from, to)) {
        rejectTransition(from, to);
    }
}
/**
 * Construct (and throw) the typed rejection for an illegal (from, to) move.
 * `TERMINAL_STATE` when `from` is DISPOSED, `ILLEGAL_TRANSITION` otherwise.
 * `extra` optionally appends operation-specific context to the message.
 */
function rejectTransition(from, to, extra = '') {
    if (isTerminalState(from)) {
        throw new LifecycleTransitionError(LIFECYCLE_DOMAIN_ERROR_CODES.TERMINAL_STATE, 'TERMINAL_STATE', from, to, `DISPOSED is terminal (Architecture §29.5): it cannot transition to '${to}' — no restore, no new Team work`);
    }
    throw new LifecycleTransitionError(LIFECYCLE_DOMAIN_ERROR_CODES.ILLEGAL_TRANSITION, 'ILLEGAL_TRANSITION', from, to, `illegal lifecycle transition '${from}' -> '${to}' (Architecture §29 FSM; legal targets from '${from}': [${legalTargets(from).join(', ')}])${extra}`);
}
/**
 * Build the next durable record for a committed transition (D2, D3).
 * The input record is never mutated.
 * @param record - the current member record.
 * @param to - the target state (assumed already validated by the caller).
 */
function nextLifecycleRecord(record, to) {
    return deepFreeze({
        ...record,
        lifecycle: to,
        activityVersion: record.activityVersion + 1,
    });
}
/**
 * Commit a (from, to) lifecycle transition on a member record.
 *
 * @param record - the current member record (its `lifecycle` is `from`).
 * @param to - the requested target state.
 * @returns a NEW frozen record with `lifecycle = to` and
 *   `activityVersion + 1` (D2, D3).
 * @throws {@link LifecycleTransitionError} when the pair is illegal (D1).
 */
export function transitionMemberLifecycle(record, to) {
    assertTransitionLegal(record.lifecycle, to);
    return nextLifecycleRecord(record, to);
}
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
export function applyLifecycleOperation(record, operation) {
    if (!isLifecycleOperation(operation)) {
        throw new TypeError(`unknown lifecycle operation ${JSON.stringify(operation)} (expected one of: ${LIFECYCLE_OPERATION_VALUES.join(', ')})`);
    }
    const rule = LIFECYCLE_OPERATION_RULES[operation];
    // The operation is legal only from ITS OWN source states — not merely from
    // any state that can legally reach the target. Without this check, an
    // operation would alias another one (e.g. RESTORE from RUNNING would
    // silently commit the SETTLE edge) and the operation semantics of §30
    // (quiesce/restore/admit as distinct procedures) would be lost.
    if (!rule.sources.includes(record.lifecycle)) {
        rejectTransition(record.lifecycle, rule.target, `; operation '${operation}' is legal only from [${rule.sources.join(', ')}]`);
    }
    return nextLifecycleRecord(record, rule.target);
}
//# sourceMappingURL=transitions.js.map