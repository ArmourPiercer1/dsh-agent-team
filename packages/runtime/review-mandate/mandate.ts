/**
 * Alpha.6 PR0 (Lane 2) — the case-scoped review admission check.
 *
 * WHAT THIS ANSWERS, and only this: "may THIS caller, as it has been resolved
 * by the host, take THIS decision value on THIS leg of THIS case?" It returns
 * a typed yes/no and nothing else — no write, no ledger access, no clock, no
 * lock, no event. The one authoritative decision entrance asks it and then
 * proceeds exactly as it does today (case law, envelope, staleness, external
 * hard policy, PA gate, commit). Composing it into that entrance is Lane-plan
 * PR-I1, a named Center-Interface PR inside the ARC-A protected center, and
 * until that PR lands this function has no production caller: PR0 deliberately
 * ships the law and its negative controls WITHOUT wiring a reviewer decision
 * to `allow` anywhere (execution-plan G-5).
 *
 * THE ORDERING IS THE SECURITY PROPERTY, so it lives in one function, in one
 * order, with the first failure winning:
 *
 *   1. the Alpha.4 role closure still decides everything it decides today —
 *      Leader and Human resolve `leader-approval` exactly as before, so an
 *      un-migrated Team sees byte-for-byte the old behaviour (L-6 default-off);
 *   2. only a Member caller continues, and only with a plan present
 *      (`REVIEW_PLAN_ABSENT`);
 *   3. the plan must be LIVE: not revoked, same team, same epoch, not expired,
 *      delegating only the leader rung, naming a non-Leader reviewer;
 *   4. the caller must BE that bound reviewer — the mandate binds exactly one
 *      instance and never travels (`REVIEW_IDENTITY_FOREIGN`);
 *   5. the case must be delegable: `leader-approval` kind, a leg whose rung is
 *      `leader`, and — the load-bearing gate — an `approvalCaseId`. A leg-less
 *      row has nothing a case-scoped mandate can attach to, so it keeps its
 *      Leader and is refused with `REVIEW_CASE_UNBOUND`. That gate is why this
 *      is not a widening of `CONTROL_RESOLVER_ROLES`, which would have handed
 *      Members authority over pre-v3 adapter rows, PA-bridge rows and raw
 *      `team_request_control` rows too;
 *   6. case law: a stale leg is refused, and a caller who already acted on an
 *      earlier leg of the same case is refused (one actor, one act per case);
 *   7. self-interest: the reviewer may not be the requester, the beneficiary or
 *      the subject of the case (L-4, direct and indirect);
 *   8. the grant fact must exist, be unrevoked, and agree with the live plan on
 *      case, leg, epoch, action, decision value and effect scope;
 *   9. only then `admitted: true`, with `basis: 'case-mandate'` — a diagnostic,
 *      never a stored authority.
 *
 * REFUSALS ARE ROUTINE. Every one of them means "the ordinary path still
 * applies": the caller is told why in a closed code, the case stays with the
 * Leader, and nothing is written. A refusal is not an error path and this
 * module has no exception path.
 *
 * @module review-mandate/mandate
 */

import {
  DELEGABLE_REVIEW_RUNG,
  REVIEW_CALLER_ROLES,
  type ReviewAdmission,
  type ReviewAdmissionInput,
  type ReviewAdmissionRefusal,
  type ReviewMandate,
  type ReviewPlan,
  type ReviewRequestKind,
  type ReviewCaseView,
  type ReviewerIdentity,
} from './types.js'
import { planActionScope, planCoversEffectScope } from './plan.js'

/**
 * The Alpha.4 role closure, mirrored for the ordering step 1. Deliberately a
 * mirror, not an import: `control/types.ts` sits inside the ARC-A protected
 * center and this lane must not depend on it for a 3-key table. The PR0 test
 * reads the protected source text and asserts this mirror still agrees, so the
 * duplication is policed rather than assumed.
 */
export const CONTROL_ROLE_CLOSURE_MIRROR: Readonly<Record<ReviewRequestKind, readonly string[]>> = Object.freeze({
  'leader-approval': Object.freeze(['leader', 'human']),
  'user-approval': Object.freeze(['human']),
  'envelope-mutation': Object.freeze(['leader', 'human']),
})

/** Does the Alpha.4 closure admit this role for this kind, unchanged? */
export function roleTableAdmits(role: string, kind: ReviewRequestKind): boolean {
  return (CONTROL_ROLE_CLOSURE_MIRROR[kind] as readonly string[]).includes(role)
}

/** A refusal, always with `basis: null`. */
function refuse(refusal: ReviewAdmissionRefusal): ReviewAdmission {
  return { admitted: false, basis: null, refusal }
}

const ADMITTED_BY_ROLE_TABLE: ReviewAdmission = { admitted: true, basis: 'role-table', refusal: null }

/** Is this identity a Member instance the delegation branch may even consider? */
function isMemberCaller(caller: ReviewerIdentity): boolean {
  return (REVIEW_CALLER_ROLES as readonly string[]).includes(caller.role)
    && caller.role === 'member'
    && typeof caller.instanceId === 'string'
    && caller.instanceId.length > 0
}

/**
 * Is the delegation branch applicable to this row at all? Split out because
 * PR-I1 needs the same answer to decide whether to consult a mandate, and
 * because it is where L-2 lives: no case id, no delegation.
 */
export function delegationApplicable(caseView: ReviewCaseView): boolean {
  return (
    caseView.requestKind === 'leader-approval'
    && caseView.legReviewAuthority === DELEGABLE_REVIEW_RUNG
    && typeof caseView.approvalCaseId === 'string'
    && caseView.approvalCaseId.length > 0
  )
}

/** Is this plan live for this team at this epoch? */
function planIsLive(plan: ReviewPlan | undefined, input: ReviewAdmissionInput): ReviewAdmission | null {
  if (plan === undefined) return refuse('REVIEW_PLAN_ABSENT')
  if (input.planRevoked) return refuse('REVIEW_PLAN_REVOKED')
  if (plan.rootSessionId !== input.caller.rootSessionId) return refuse('REVIEW_PLAN_TEAM_MISMATCH')
  if (plan.epoch !== input.currentEpoch) return refuse('REVIEW_PLAN_EPOCH_STALE')
  if (plan.expiresAtIso !== null) {
    const nowMs = Date.parse(input.nowIso)
    if (!Number.isFinite(nowMs)) return refuse('REVIEW_CLOCK_INVALID')
    if (nowMs > Date.parse(plan.expiresAtIso)) return refuse('REVIEW_PLAN_EXPIRED')
  }
  if (plan.delegatedRung !== DELEGABLE_REVIEW_RUNG) return refuse('REVIEW_PLAN_RUNG_NOT_DELEGABLE')
  if (input.caller.isLeaderInstance) return refuse('REVIEW_PLAN_REVIEWER_IS_LEADER')
  return null
}

/** Does the grant fact still say what the live plan says? (step 8) */
function grantAgrees(mandate: ReviewMandate | undefined, plan: ReviewPlan, input: ReviewAdmissionInput): ReviewAdmission | null {
  const { caseView, attempt, caller } = input
  if (mandate === undefined) return refuse('REVIEW_MANDATE_ABSENT')
  if (mandate.revoked) return refuse('REVIEW_MANDATE_REVOKED')
  if (!Number.isSafeInteger(mandate.generation) || mandate.generation <= 0) return refuse('REVIEW_MANDATE_GENERATION_INVALID')
  if (mandate.reviewerInstanceId !== caller.instanceId) return refuse('REVIEW_IDENTITY_FOREIGN')
  if (mandate.approvalCaseId !== caseView.approvalCaseId) return refuse('REVIEW_MANDATE_CASE_MISMATCH')
  if (mandate.legOrdinal !== caseView.legOrdinal) return refuse('REVIEW_MANDATE_LEG_MISMATCH')
  if (mandate.planEpoch !== plan.epoch) return refuse('REVIEW_MANDATE_EPOCH_MISMATCH')
  if (mandate.actionName !== attempt.actionName || mandate.actionName !== caseView.actionName) {
    return refuse('REVIEW_MANDATE_ACTION_NOT_DELEGATED')
  }
  const scope = planActionScope(plan, attempt.actionName)
  if (scope === undefined) return refuse('REVIEW_MANDATE_ACTION_NOT_DELEGATED')
  if (!scope.decisions.includes(attempt.decision) || !mandate.decisions.includes(attempt.decision)) {
    return refuse('REVIEW_MANDATE_DECISION_NOT_DELEGATED')
  }
  if (attempt.effectScopeFingerprint !== caseView.effectScopeFingerprint) return refuse('REVIEW_MANDATE_SCOPE_NOT_DELEGATED')
  if (mandate.effectScopeFingerprint !== caseView.effectScopeFingerprint) return refuse('REVIEW_MANDATE_SCOPE_NOT_DELEGATED')
  if (!planCoversEffectScope(plan, attempt.actionName, attempt.effectScopeFingerprint)) return refuse('REVIEW_MANDATE_SCOPE_NOT_DELEGATED')
  return null
}

/**
 * The admission check. See the module header for the ordering and why each
 * step sits where it does.
 */
export function evaluateReviewAdmission(input: ReviewAdmissionInput): ReviewAdmission {
  const { caller, caseView } = input

  // 1. The Alpha.4 closure is untouched: a role the table admits decides
  //    exactly as it does today, with or without any Alpha.6 plan present.
  if (roleTableAdmits(caller.role, caseView.requestKind)) return ADMITTED_BY_ROLE_TABLE

  // 2. Only a resolved Member instance may reach the delegation branch. A human
  //    caller that the table refused is a `user-approval`-style mismatch, not a
  //    delegation candidate.
  if (!isMemberCaller(caller)) return refuse('REVIEW_NOT_A_MEMBER_CALLER')

  // 3-4. The plan must exist and be live, and the caller must be its reviewer.
  const planFailure = planIsLive(input.plan, input)
  if (planFailure !== null) return planFailure
  const plan = input.plan
  if (plan === undefined) return refuse('REVIEW_PLAN_ABSENT')
  if (caller.instanceId !== plan.reviewerInstanceId) return refuse('REVIEW_IDENTITY_FOREIGN')

  // 5. The row must be delegable at all — kind, rung, and above all a case id.
  if (caseView.requestKind !== 'leader-approval') return refuse('REVIEW_KIND_NOT_DELEGABLE')
  if (caseView.legReviewAuthority !== DELEGABLE_REVIEW_RUNG) return refuse('REVIEW_RUNG_NOT_DELEGABLE')
  if (caseView.approvalCaseId === undefined || caseView.approvalCaseId.length === 0) return refuse('REVIEW_CASE_UNBOUND')

  // 6. Case law: current leg only, one act per actor per case.
  if (caseView.legOrdinal !== caseView.currentLegOrdinal) return refuse('REVIEW_LEG_STALE')
  if (caseView.actedCallerRefs.includes(caller.callerRef)) return refuse('REVIEW_ALREADY_ACTED_ON_THIS_CASE')

  // 7. Self-interest, direct and indirect.
  if (caseView.requesterCallerRef === caller.callerRef) return refuse('REVIEW_SELF_REQUESTER')
  if (caseView.beneficiaryCallerRef !== null && caseView.beneficiaryCallerRef === caller.callerRef) return refuse('REVIEW_SELF_BENEFICIARY')
  if (caseView.subjectCallerRef !== null && caseView.subjectCallerRef === caller.callerRef) return refuse('REVIEW_SELF_SUBJECT')

  // 8. The grant fact must exist and still agree with the live plan.
  const grantFailure = grantAgrees(input.mandate, plan, input)
  if (grantFailure !== null) return grantFailure

  // 9. Admitted — as a case-scoped reviewer, never as a Leader.
  return { admitted: true, basis: 'case-mandate', refusal: null }
}
