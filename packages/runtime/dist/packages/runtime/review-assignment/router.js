/**
 * Alpha.6 PR2′ (Lane 2) — the deterministic review router.
 *
 * WHAT THIS DECIDES: for one case that needs the `leader` rung, whether a bound Approval Officer is the
 * one to look at it, or whether the case stays with the Leader. That is the whole job. It does not
 * decide whether anything is allowed, and PR #319 §7 is explicit about the direction of the failure:
 * 未知/失配/证据不充分时交由 Leader 或合法 Human 路径，绝不对未知资源授予普通 Reviewer 审批能力.
 *
 * THE PROPERTY THAT MATTERS MOST, and the reason this file calls into PR0 rather than re-implementing a
 * check of its own: **the router is never wider than the admission gate.** A case is routed to an
 * instance only if PR0's `evaluateReviewAdmission` would admit that same instance for that same case,
 * plan and mandate, at the epoch and instant supplied. Routing therefore cannot anticipate,
 * pre-empt or smuggle an admission — the strongest statement this lane can make without touching the
 * write path, and it is pinned by a leg that runs adversarial inputs through BOTH functions.
 *
 * Determinism (A-4): the plan binds exactly one officer (`ReviewPlan.reviewerInstanceId` — "Exactly one
 * in Alpha.6"), so there is never a choice between candidates to be clever about. Same inputs in, same
 * decision out, byte for byte; no clock read here, no scoring, no recency, no load. Where the router
 * cannot proceed it says which of its reasons applies (the closed list is `REVIEW_ROUTER_REASON_CODES`; the count is deliberately not restated here — restating it was wrong once already, review F-4), so a mis-routed team is diagnosable from
 * the reason code alone.
 *
 * THE LAW ABOUT HANDOFFS, which is this file's most important non-obvious branch: once a case has been
 * handed off to the Leader, a later wake does NOT pull it back to the Officer. A handoff is a decision
 * that the Leader's global information is needed (PR #319 §7); the router has no basis to overrule it,
 * and re-stealing the case on the next event would silently reverse a coordination decision the Leader
 * made. The answer is `ROUTER_ALREADY_ASSIGNED` with `leaderAlreadyTarget: true`, and it is a leave-with-
 * the-Leader decision, not a failure: the code named here is the one the router actually emits (`LEADER_
 * TOOK_OVER` was a name this file used to advertise and no path ever produced — a reason code that cannot
 * be produced is the same lie A-9 refuses in the closed lists).
 */
import { evaluateReviewAdmission, isParsedReviewPlan, } from '../review-mandate/index.js';
import { REVIEW_MEMBER_LIFECYCLE_STATE_VALUES, REVIEW_ROUTER_ELIGIBLE_LIFECYCLES, } from './types.js';
const ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
function decision(value) {
    return { ok: true, value };
}
function refused(refusal, detail) {
    return { ok: false, refusal, detail };
}
function leaderLeaves(reason, current, detail = '') {
    const target = current?.assignment?.target;
    return {
        kind: 'leaveWithLeader',
        reasonCode: reason,
        leaderAlreadyTarget: target !== undefined && target.kind === 'leader' && current?.live === true,
        expectedPreviousEpoch: current?.epochApplied ?? 0,
        detail,
    };
}
function isCandidateWellFormed(candidate) {
    return (typeof candidate === 'object' &&
        candidate !== null &&
        typeof candidate.instanceId === 'string' &&
        ID_PATTERN.test(candidate.instanceId) &&
        typeof candidate.callerRef === 'string' &&
        candidate.callerRef.length > 0 &&
        candidate.callerRef.length <= 256 &&
        typeof candidate.lifecycle === 'string' &&
        // A state outside the frozen five is a refusal, not a skip: silence here is how a router keeps
        // working right up until it routes to something that cannot run.
        REVIEW_MEMBER_LIFECYCLE_STATE_VALUES.includes(candidate.lifecycle) &&
        typeof candidate.isLeaderInstance === 'boolean');
}
function selfInterestRefs(caseView) {
    return [caseView.requesterCallerRef, caseView.beneficiaryCallerRef, caseView.subjectCallerRef].filter((ref) => typeof ref === 'string' && ref.length > 0);
}
/**
 * Would PR0's admission gate admit this instance for this case at all?
 *
 * Checked over the decision values the mandate actually names, and if it names none, over both: a
 * mandate that grants no decision value is refused by PR0 itself, and the router reports that refusal
 * rather than inventing its own verdict.
 */
function admitsSomewhere(input, plan, mandate, instanceId, callerRef) {
    const values = mandate.decisions.length > 0 ? mandate.decisions : ['allow', 'deny'];
    const refusals = [];
    for (const value of values) {
        const answer = evaluateReviewAdmission({
            caller: {
                role: 'member',
                instanceId,
                callerRef,
                rootSessionId: input.rootSessionId,
                isLeaderInstance: false,
            },
            attempt: {
                decision: value,
                actionName: input.caseView.actionName,
                effectScopeFingerprint: input.caseView.effectScopeFingerprint,
            },
            caseView: input.caseView,
            plan,
            mandate,
            currentEpoch: input.currentEpoch,
            nowIso: input.nowIso,
            planRevoked: input.planRevoked,
        });
        if (answer.admitted)
            return { admitted: true };
        refusals.push(answer.refusal ?? 'REVIEW_ADMISSION_REFUSAL_UNNAMED');
    }
    return { admitted: false, refusals };
}
/**
 * Route one case. Pure, total, and closed: it returns either a typed decision or a typed refusal, and
 * the decision is one of assign / keep / leaveWithLeader. No effect, no I/O, no fact construction — the
 * caller turns an `assign` into an encoded fact with `encodeAssignmentFact` and lets PR-I1 write it.
 */
export function routeReviewCase(input) {
    // ---- structural: a malformed input is a refusal, never a silent "leave it with the Leader" ----
    // The distinction matters: leaveWithLeader is a routing outcome that a caller may act on (it means
    // "no change"), while a refusal means the caller's own inputs were not usable. Silently converting
    // the second into the first would make a broken host look like a healthy team that needs no change.
    if (typeof input !== 'object' || input === null) {
        return refused('REVIEW_ASSIGNMENT_ROUTER_INPUT_INCOMPLETE', 'input must be a record');
    }
    if (typeof input.rootSessionId !== 'string' || !ID_PATTERN.test(input.rootSessionId)) {
        return refused('REVIEW_ASSIGNMENT_ROUTER_INPUT_INCOMPLETE', 'rootSessionId failed hygiene');
    }
    if (!ID_PATTERN.test(input.currentLegRequestId) || !ID_PATTERN.test(input.caseVersion)) {
        return refused('REVIEW_ASSIGNMENT_ROUTER_INPUT_INCOMPLETE', 'leg request id / case version failed hygiene');
    }
    if (typeof input.caseView !== 'object' || input.caseView === null) {
        return refused('REVIEW_ASSIGNMENT_ROUTER_INPUT_INCOMPLETE', 'caseView must be a folded record');
    }
    if (!Array.isArray(input.candidates)) {
        return refused('REVIEW_ASSIGNMENT_ROUTER_INPUT_INCOMPLETE', 'candidates must be an array');
    }
    if (typeof input.nowIso !== 'string' || input.nowIso.length === 0) {
        return refused('REVIEW_ASSIGNMENT_ROUTER_INPUT_INCOMPLETE', 'nowIso must be supplied (no clock is read here)');
    }
    if (!Number.isSafeInteger(input.currentEpoch) || input.currentEpoch < 0) {
        return refused('REVIEW_ASSIGNMENT_ROUTER_INPUT_INCOMPLETE', 'currentEpoch must be a safe non-negative integer');
    }
    const seen = new Set();
    for (const candidate of input.candidates) {
        if (!isCandidateWellFormed(candidate)) {
            return refused('REVIEW_ASSIGNMENT_ROUTER_CANDIDATE_MALFORMED', 'a candidate record failed validation');
        }
        if (seen.has(candidate.instanceId)) {
            // The same instance twice means the host's snapshot is inconsistent. Routing over an
            // inconsistent snapshot is how one instance ends up with two assignments.
            return refused('REVIEW_ASSIGNMENT_ROUTER_CANDIDATE_MALFORMED', `duplicate candidate ${candidate.instanceId}`);
        }
        seen.add(candidate.instanceId);
    }
    if (input.current !== null) {
        if (typeof input.current !== 'object' || input.current.rootSessionId !== input.rootSessionId) {
            return refused('REVIEW_ASSIGNMENT_ROUTER_INPUT_INCOMPLETE', 'the current assignment view belongs to another team');
        }
        if (input.current.unreconciled) {
            // A-7 on the read side: a family view with diagnostics cannot tell us who currently holds the
            // case, and "we do not know who holds it" must not become "nobody holds it, assign it".
            return refused('REVIEW_ASSIGNMENT_ROUTER_INPUT_INCOMPLETE', `the current assignment view is unreconciled (${String(input.current.diagnostics.length)} diagnostic(s))`);
        }
    }
    const current = input.current;
    const nextEpoch = (current?.epochApplied ?? 0) + 1;
    // ---- the case itself: no case identity, no delegation ----
    const caseId = input.caseView.approvalCaseId;
    if (caseId === undefined) {
        // PR #319 §6: legacy `leader-approval` rows without a case id get no fabricated case. This is the
        // single most important leave-with-Leader branch, because it is the one that keeps the OLD path
        // whole for every Team Alpha.6 has not been enabled for.
        return decision(leaderLeaves('LEADER_NO_APPROVAL_CASE_ID', current));
    }
    if (input.caseView.legOrdinal !== input.caseView.currentLegOrdinal) {
        return decision(leaderLeaves('LEADER_LEG_NOT_CURRENT', current));
    }
    // ---- the plan: a hard precondition (R-1), not a preference ----
    if (input.plan === null || !isParsedReviewPlan(input.plan)) {
        return decision(leaderLeaves('LEADER_PLAN_ABSENT', current));
    }
    const plan = input.plan;
    if (plan.rootSessionId !== input.rootSessionId) {
        return refused('REVIEW_ASSIGNMENT_ROUTER_INPUT_INCOMPLETE', 'the plan belongs to another team');
    }
    // No `delegatedRung` check here, and that is deliberate rather than an oversight: `parseReviewPlan`
    // refuses any plan that delegates something other than DELEGABLE_REVIEW_RUNG (RUNG_NOT_DELEGABLE) and
    // refuses an officer bound to the Leader instance (REVIEWER_IS_LEADER_INSTANCE), so a
    // parser-produced plan cannot reach this function carrying either. A branch that no input can reach
    // would be a refusal code the closed-set leg could never produce — the dead-vocabulary defect this
    // phase has already been burned on twice.
    if (plan.epoch !== input.currentEpoch) {
        return decision(leaderLeaves('LEADER_PLAN_EPOCH_STALE', current));
    }
    // ---- the mandate: case-scoped, covering, unrevoked ----
    if (input.mandate === null) {
        return decision(leaderLeaves('LEADER_MANDATE_ABSENT', current));
    }
    const mandate = input.mandate;
    if (mandate.revoked) {
        return decision(leaderLeaves('LEADER_MANDATE_REVOKED', current));
    }
    const mandateCovers = mandate.approvalCaseId === caseId &&
        mandate.legOrdinal === input.caseView.legOrdinal &&
        mandate.actionName === input.caseView.actionName &&
        mandate.effectScopeFingerprint === input.caseView.effectScopeFingerprint &&
        mandate.planEpoch === plan.epoch;
    if (!mandateCovers) {
        return decision(leaderLeaves('LEADER_MANDATE_NOT_COVERING', current));
    }
    // ---- the officer the plan binds, as the host reports it ----
    const officer = input.candidates.find((candidate) => candidate.instanceId === plan.reviewerInstanceId);
    if (officer === undefined) {
        return decision(leaderLeaves('LEADER_NO_ELIGIBLE_REVIEWER', current));
    }
    if (officer.isLeaderInstance) {
        // PR0's L-1: an Officer binding that points at the Leader is a refusal, not a shortcut. Loud here
        // too, because a plan wired to the Leader means somebody's configuration is wrong RIGHT NOW.
        return refused('REVIEW_ASSIGNMENT_TARGET_IS_LEADER_INSTANCE', `the plan binds ${plan.reviewerInstanceId}, which the host reports as the Leader instance`);
    }
    if (!REVIEW_ROUTER_ELIGIBLE_LIFECYCLES.includes(officer.lifecycle)) {
        return decision(leaderLeaves('LEADER_NO_ELIGIBLE_REVIEWER', current, `the bound officer is ${officer.lifecycle}`));
    }
    if (selfInterestRefs(input.caseView).includes(officer.callerRef)) {
        // Self-review is refused at routing time as well as at the write path: a case that will be refused
        // anyway should never acquire an assignment that an operator then has to explain.
        return decision(leaderLeaves('LEADER_NO_ELIGIBLE_REVIEWER', current));
    }
    // ---- never wider than the admission gate ----
    const admits = admitsSomewhere(input, plan, mandate, officer.instanceId, officer.callerRef);
    if (!admits.admitted) {
        return decision(leaderLeaves('LEADER_MANDATE_NOT_COVERING', current, `the admission gate refused every decision value: ${admits.refusals.join(', ')}`));
    }
    // ---- what an existing assignment does to the answer ----
    if (current !== null && current.live && current.assignment !== null) {
        const existing = current.assignment;
        if (existing.currentLegRequestId === input.currentLegRequestId && existing.target.kind === 'leader') {
            // THE HANDOFF IS NOT UNDONE BY A WAKE. See the module doc: the Leader took this case on purpose.
            return decision(leaderLeaves('ROUTER_ALREADY_ASSIGNED', current));
        }
        if (existing.currentLegRequestId === input.currentLegRequestId && existing.target.kind === 'instance') {
            if (existing.target.instanceId === officer.instanceId) {
                return decision({
                    kind: 'keep',
                    target: existing.target,
                    reasonCode: 'ROUTER_ALREADY_ASSIGNED',
                    assignmentEpoch: existing.assignmentEpoch,
                });
            }
            return decision({
                kind: 'assign',
                target: { kind: 'instance', instanceId: officer.instanceId },
                reasonCode: 'ROUTER_PLAN_BINDS_DIFFERENT_OFFICER',
                expectedPreviousEpoch: current.epochApplied,
                assignmentEpoch: nextEpoch,
            });
        }
        // The case moved to a NEW LEG since the assignment was made, and the lane cannot answer that with a
        // decision (review F-1). Three row kinds is all this family has: `created` may only replace epoch 0,
        // `transferred` and `retired` both require a LIVE assignment standing on the SAME leg. So there is no
        // row a writer may append for a new leg, and the decision the previous code returned — `assign` at
        // `epochApplied + 1` — was an order PR-I1 could not execute: its pre-flight refuses every kind on this
        // state, and forcing the row through anyway yields a permanent diagnostic, a permanently
        // `unreconciled` view, and a case whose wakes and submissions are then refused forever. A router must
        // not order what its own writer cannot write.
        return decision(leaderLeaves('LEADER_LEG_MOVED', current, `the family stands under leg ${existing.currentLegRequestId}, this wake is under ${input.currentLegRequestId}`));
    }
    if (current !== null && current.assignment !== null && !current.live) {
        // The assignment for this case was RETIRED. A wake is not a reason to resurrect it: retirement is a
        // fact in the ledger, and re-opening it would need a `created` row replacing epoch 0, which the epoch
        // law forbids on a family that has already advanced. The Leader holds the case — same answer as if
        // Alpha.6 had never been switched on, which is the right answer for a state the lane cannot express.
        return decision(leaderLeaves('LEADER_ASSIGNMENT_RETIRED', current, `epoch ${String(current.epochApplied)} was retired; only the Leader re-drives a retired case`));
    }
    return decision({
        kind: 'assign',
        target: { kind: 'instance', instanceId: officer.instanceId },
        reasonCode: 'ROUTER_PLAN_COVERS_ACTION',
        expectedPreviousEpoch: current?.epochApplied ?? 0,
        assignmentEpoch: nextEpoch,
    });
}
//# sourceMappingURL=router.js.map