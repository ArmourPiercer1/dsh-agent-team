/**
 * Alpha.6 PR2′ (Lane 2) — handoff, and the boundary that a handoff is not an escalation.
 *
 * PR #319 §7 states the boundary as a test requirement, and this file exists to make it unmissable:
 *
 *   - An Officer decides the case needs the Leader's global information → `handoff`. The TARGET becomes
 *     the Leader. The leg's `reviewAuthority` and the current leg itself are untouched, because nothing
 *     about *what may be approved* changed — only about *who is looking*.
 *   - The current leg's approval authority is genuinely insufficient → only the existing
 *     `escalateApprovalLeg` (`control/service.ts`) may create a higher-rung leg. A handoff may not be
 *     used to raise authority, and this module cannot even express that: there is no rung field, no leg
 *     field and no decision field anywhere in `ReviewHandoffPlan`.
 *
 * So the boundary is three facts a reviewer can check in order: (1) the output type has no authority
 * vocabulary; (2) `controlServiceEffects` is the empty array, typed as `readonly []`, so "it triggers
 * nothing in the control plane" is a type, not a promise; (3) the only row a handoff produces is
 * `review-assignment-transferred`, whose payload the facts layer refuses the moment it carries an
 * authority-bearing key. `a6-pr2-assignment-kernel.test.ts` asserts all three, plus the positive
 * control that escalation is a different operation entirely: it is not implemented here, and no import
 * of this lane reaches it.
 *
 * The CAS discipline is the same as everywhere else in the lane: a handoff states the epoch it
 * replaces, and a handoff that lost the race changes nothing.
 */
import { checkAssignmentMutation, encodeAssignmentFact, } from './facts.js';
import { REVIEW_ASSIGNMENT_FACT_TYPES, } from './types.js';
function ok(value) {
    return { ok: true, value };
}
function no(refusal, detail) {
    return { ok: false, refusal, detail };
}
/**
 * Prepare the handoff fact for a case the Officer can no longer usefully hold.
 *
 * Refusals are the family's own: nothing to hand off (`…_NO_ACTIVE_ASSIGNMENT`), already with the
 * Leader (`…_TARGET_UNCHANGED`), or a CAS miss against the folded state (`…_EPOCH_CONFLICT`). None of
 * them writes anything; all of them are the caller's signal to re-read.
 */
export function planHandoff(state, request) {
    const checked = checkAssignmentMutation(state, 'transferred', { kind: 'leader' }, request.currentLegRequestId);
    if (!checked.ok)
        return checked;
    const assignmentEpoch = state.epochApplied + 1;
    const encoded = encodeAssignmentFact('transferred', {
        rootSessionId: request.rootSessionId,
        approvalCaseId: request.approvalCaseId,
        currentLegRequestId: request.currentLegRequestId,
        target: { kind: 'leader' },
        assignmentEpoch,
        reasonCode: request.reasonCode,
        basedOnCaseVersion: request.basedOnCaseVersion,
        actorCallerRef: request.actorCallerRef,
    }, state.epochApplied);
    if (!encoded.ok)
        return encoded;
    return ok({
        factType: REVIEW_ASSIGNMENT_FACT_TYPES.transferred,
        payload: encoded.value,
        plan: {
            factType: REVIEW_ASSIGNMENT_FACT_TYPES.transferred,
            assignmentEpoch,
            expectedPreviousEpoch: state.epochApplied,
            rootSessionId: request.rootSessionId,
            approvalCaseId: request.approvalCaseId,
            currentLegRequestId: request.currentLegRequestId,
            basedOnCaseVersion: request.basedOnCaseVersion,
            reasonCode: request.reasonCode,
            actorCallerRef: request.actorCallerRef,
            // A-6 as a value: a handoff runs no ControlService code and raises no rung. Typed `readonly []`
            // and `false`, so a future edit that tries to populate either is a compile error, not a review
            // miss.
            controlServiceEffects: [],
            rungChanged: false,
        },
    });
}
/**
 * Prepare the retirement of a case's assignment: the Officer is done with it (closed, decided elsewhere,
 * disposed) and nobody is expected to look. After this row the case has no current handler, and the
 * retired target is refused by `maySubmitFor` — A-3, the same law a handoff relies on.
 */
export function planRetirement(state, request) {
    const checked = checkAssignmentMutation(state, 'retired', state.assignment?.target ?? { kind: 'leader' }, request.currentLegRequestId);
    if (!checked.ok)
        return checked;
    if (state.assignment === null) {
        return no('REVIEW_ASSIGNMENT_NO_ACTIVE_ASSIGNMENT', 'nothing to retire');
    }
    const assignmentEpoch = state.epochApplied + 1;
    const encoded = encodeAssignmentFact('retired', {
        rootSessionId: request.rootSessionId,
        approvalCaseId: request.approvalCaseId,
        currentLegRequestId: request.currentLegRequestId,
        target: state.assignment.target,
        assignmentEpoch,
        reasonCode: request.reasonCode,
        basedOnCaseVersion: request.basedOnCaseVersion,
        actorCallerRef: request.actorCallerRef,
    }, state.epochApplied);
    if (!encoded.ok)
        return encoded;
    return ok({
        factType: REVIEW_ASSIGNMENT_FACT_TYPES.retired,
        payload: encoded.value,
        plan: {
            factType: REVIEW_ASSIGNMENT_FACT_TYPES.retired,
            assignmentEpoch,
            expectedPreviousEpoch: state.epochApplied,
            rootSessionId: request.rootSessionId,
            approvalCaseId: request.approvalCaseId,
            currentLegRequestId: request.currentLegRequestId,
            basedOnCaseVersion: request.basedOnCaseVersion,
            reasonCode: request.reasonCode,
            actorCallerRef: request.actorCallerRef,
            controlServiceEffects: [],
            rungChanged: false,
        },
    });
}
//# sourceMappingURL=handoff.js.map