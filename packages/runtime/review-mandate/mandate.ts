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
  DELEGABLE_REQUEST_KIND,
  DELEGABLE_REVIEW_RUNG,
  REVIEW_CALLER_ROLES,
  REVIEW_REQUEST_KINDS,
  REVIEW_RUNGS,
  type ReviewAdmission,
  type ReviewAdmissionInput,
  type ReviewAdmissionRefusal,
  type ReviewMandate,
  type ReviewPlan,
  type ReviewRequestKind,
  type ReviewCaseView,
  type ReviewerIdentity,
} from './types.js'
import { isParsedReviewPlan, planActionScope, planCoversEffectScope } from './plan.js'

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

/** Frozen because it is returned to every caller that the role table admits;
 *  a shared mutable answer would let one caller's edit change the next one's
 *  governance answer. */
const ADMITTED_BY_ROLE_TABLE: ReviewAdmission = Object.freeze({ admitted: true, basis: 'role-table', refusal: null })

/**
 * Is the folded case view shaped as declared? (M-3)
 *
 * The module header promises "no exception path": every bad answer must be a
 * closed code. Without this guard a `requestKind` outside the closed set
 * reaches the mirror lookup and a missing `actedCallerRefs` reaches `.includes`,
 * and each throws a TypeError inside `resolveControl`. A throw is fail-CLOSED —
 * it can never admit — so this is contract hygiene, not over-admission; it is
 * still worth closing, because the caller that trips it is the one decision
 * write path, and an exception there is a stuck case with no typed reason.
 */
function malformedCaseView(caseView: ReviewCaseView): ReviewAdmission | null {
  if (typeof caseView.requestKind !== 'string' || !(REVIEW_REQUEST_KINDS as readonly string[]).includes(caseView.requestKind)) return refuse('REVIEW_CASE_MALFORMED')
  if (typeof caseView.legReviewAuthority !== 'string' || !(REVIEW_RUNGS as readonly string[]).includes(caseView.legReviewAuthority)) return refuse('REVIEW_CASE_MALFORMED')
  if (!Number.isSafeInteger(caseView.legOrdinal) || !Number.isSafeInteger(caseView.currentLegOrdinal)) return refuse('REVIEW_CASE_MALFORMED')
  if (!Array.isArray(caseView.actedCallerRefs) || caseView.actedCallerRefs.some((ref) => typeof ref !== 'string')) return refuse('REVIEW_CASE_MALFORMED')
  if (typeof caseView.requesterCallerRef !== 'string' || caseView.requesterCallerRef.length === 0) return refuse('REVIEW_CASE_MALFORMED')
  if (typeof caseView.actionName !== 'string' || caseView.actionName.length === 0) return refuse('REVIEW_CASE_MALFORMED')
  if (typeof caseView.effectScopeFingerprint !== 'string' || caseView.effectScopeFingerprint.length === 0) return refuse('REVIEW_CASE_MALFORMED')
  return null
}

/** The same well-formedness law for the caller identity (see {@link malformedCaseView}). */
function malformedCaller(caller: ReviewerIdentity): ReviewAdmission | null {
  if (typeof caller.role !== 'string' || !(REVIEW_CALLER_ROLES as readonly string[]).includes(caller.role)) return refuse('REVIEW_CALLER_MALFORMED')
  if (typeof caller.callerRef !== 'string' || caller.callerRef.length === 0) return refuse('REVIEW_CALLER_MALFORMED')
  if (typeof caller.rootSessionId !== 'string' || caller.rootSessionId.length === 0) return refuse('REVIEW_CALLER_MALFORMED')
  if (caller.instanceId !== null && typeof caller.instanceId !== 'string') return refuse('REVIEW_CALLER_MALFORMED')
  if (typeof caller.isLeaderInstance !== 'boolean') return refuse('REVIEW_CALLER_MALFORMED')
  return null
}

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
    caseView.requestKind === DELEGABLE_REQUEST_KIND
    && caseView.legReviewAuthority === DELEGABLE_REVIEW_RUNG
    // Whitespace is not an id. A fold row that carries ' ' as its case id is a
    // leg-less row wearing a case id, and the L-2 gate is the one gate that
    // keeps such rows out of Member reach.
    && typeof caseView.approvalCaseId === 'string'
    && caseView.approvalCaseId.trim().length > 0
  )
}

/**
 * The refusal a non-delegable row deserves, named by whichever of the three
 * conditions actually failed. Split out so `evaluateReviewAdmission` and the
 * future caller answer with the SAME predicate (M-2): the routing decision and
 * the admission decision must never be two copies of one rule, or a future edit
 * to one sends cases to a reviewer whose grant the center will always refuse.
 */
function nonDelegableRefusal(caseView: ReviewCaseView): ReviewAdmission {
  if (caseView.requestKind !== DELEGABLE_REQUEST_KIND) return refuse('REVIEW_KIND_NOT_DELEGABLE')
  if (caseView.legReviewAuthority !== DELEGABLE_REVIEW_RUNG) return refuse('REVIEW_RUNG_NOT_DELEGABLE')
  return refuse('REVIEW_CASE_UNBOUND')
}

/** Is this plan live for this team at this epoch? */
function planIsLive(plan: ReviewPlan, input: ReviewAdmissionInput): ReviewAdmission | null {
  if (input.planRevoked) return refuse('REVIEW_PLAN_REVOKED')
  if (plan.rootSessionId !== input.caller.rootSessionId) return refuse('REVIEW_PLAN_TEAM_MISMATCH')
  if (plan.epoch !== input.currentEpoch) return refuse('REVIEW_PLAN_EPOCH_STALE')
  if (plan.expiresAtIso !== null) {
    const nowMs = Date.parse(input.nowIso)
    const expiryMs = Date.parse(plan.expiresAtIso)
    // An instant this module cannot read is a refusal, never a skipped check:
    // `now > NaN` is false, which is how an unreadable expiry silently stops
    // expiring. The parser already refuses such a string, so this leg exists
    // for the plan that reached here by another door.
    if (!Number.isFinite(nowMs) || !Number.isFinite(expiryMs)) return refuse('REVIEW_CLOCK_INVALID')
    if (nowMs > expiryMs) return refuse('REVIEW_PLAN_EXPIRED')
  }
  if (plan.delegatedRung !== DELEGABLE_REVIEW_RUNG) return refuse('REVIEW_PLAN_RUNG_NOT_DELEGABLE')
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
  // 0a. Container presence, BEFORE destructuring: `const { caller } = input` is
  //     itself a field read, so the presence guards cannot live below it. What
  //     this lane promises, stated at the precision the code actually holds:
  //     for any input whose containers EXIST, every value-level malformation
  //     answers a closed code. It cannot promise that against a hostile
  //     container — a getter that throws, or a Proxy trap that rethrows, makes
  //     every read in every module on earth an exception. Those are caller
  //     obligations, and the caller here is a fold projection read inside the
  //     team lock, which produces plain data by construction. Naming the limit
  //     is the honest version of "no exception path"; a claim an adversary could
  //     disprove in one line is worth less than the narrower one that stands.
  if (input === null || typeof input !== 'object') return refuse('REVIEW_INPUT_MALFORMED')
  const { caller, caseView } = input
  if (caseView === null || typeof caseView !== 'object') return refuse('REVIEW_CASE_MALFORMED')
  if (caller === null || typeof caller !== 'object') return refuse('REVIEW_CALLER_MALFORMED')

  // 0b. Malformed VALUES are closed-code refusals, never a TypeError inside the
  //     caller's write path (M-3), checked before step 1 because that step's
  //     mirror lookup is itself indexed by a vocabulary field.
  const callerFailure = malformedCaller(caller)
  if (callerFailure !== null) return callerFailure
  const caseFailure = malformedCaseView(caseView)
  if (caseFailure !== null) return caseFailure

  // 1. The Alpha.4 closure is untouched: a role the table admits decides
  //    exactly as it does today, with or without any Alpha.6 plan present.
  if (roleTableAdmits(caller.role, caseView.requestKind)) return ADMITTED_BY_ROLE_TABLE

  // 2. Only a resolved Member instance may reach the delegation branch. A human
  //    caller that the table refused is a `user-approval`-style mismatch, not a
  //    delegation candidate.
  if (!isMemberCaller(caller)) return refuse('REVIEW_NOT_A_MEMBER_CALLER')
  // A caller that says `role: 'member'` AND `isLeaderInstance: true` is not a
  // Member being delegated to — it is the Leader seat wearing Member clothing,
  // which is the one shape this phase must never produce. Named for what it
  // tests (the caller), and placed before any plan is consulted so the answer
  // does not depend on what else is in the row.
  if (caller.isLeaderInstance) return refuse('REVIEW_CALLER_IS_LEADER_INSTANCE')

  // 3-4. The plan must exist, be something the parser produced, be live, and
  //      bind this caller. The brand check is not ceremony: `ReviewPlan` is
  //      structural, so without it a hand-built object that never met the
  //      parser gets the fail-closed parser's benefits without its refusals
  //      (an unparseable expiry stops firing; a wildcard scope walks in).
  if (input.plan === undefined) return refuse('REVIEW_PLAN_ABSENT')
  if (!isParsedReviewPlan(input.plan)) return refuse('REVIEW_PLAN_UNBRANDED')
  const planFailure = planIsLive(input.plan, input)
  if (planFailure !== null) return planFailure
  const plan = input.plan
  if (caller.instanceId !== plan.reviewerInstanceId) return refuse('REVIEW_IDENTITY_FOREIGN')

  // 5. The row must be delegable at all — kind, rung, and above all a case id.
  //    One predicate, shared with the caller's routing branch (M-2).
  if (!delegationApplicable(caseView)) return nonDelegableRefusal(caseView)

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
