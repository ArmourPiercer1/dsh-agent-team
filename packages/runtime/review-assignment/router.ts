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
 * cannot proceed it says which of its twelve reasons applies, so a mis-routed team is diagnosable from
 * the reason code alone.
 *
 * THE LAW ABOUT HANDOFFS, which is this file's most important non-obvious branch: once a case has been
 * handed off to the Leader, a later wake does NOT pull it back to the Officer. A handoff is a decision
 * that the Leader's global information is needed (PR #319 §7); the router has no basis to overrule it,
 * and re-stealing the case on the next event would silently reverse a coordination decision the Leader
 * made. `LEADER_TOOK_OVER` keeps it.
 */

import {
  evaluateReviewAdmission,
  isParsedReviewPlan,
  type ReviewCaseView,
  type ReviewMandate,
  type ReviewMandateDecision,
  type ReviewPlan,
} from '../review-mandate/index.js'
import {
  REVIEW_MEMBER_LIFECYCLE_STATE_VALUES,
  REVIEW_ROUTER_ELIGIBLE_LIFECYCLES,
  type ReviewAssignmentRefusal,
  type ReviewAssignmentResult,
  type ReviewAssignmentState,
  type ReviewRoutingDecision,
  type ReviewerCandidate,
} from './types.js'

/** Everything the router reads. Every field is host-derived or folded; none is model-supplied (A-5). */
export interface ReviewRoutingInput {
  readonly rootSessionId: string
  /** The request id of the leg being routed, from the authoritative fold. */
  readonly currentLegRequestId: string
  /** The case version the fold reported for this read, recorded into the assignment (not trusted). */
  readonly caseVersion: string
  readonly caseView: ReviewCaseView
  /** The live parsed plan, or `null` when this Team has none — the default for every pre-Alpha.6 Team. */
  readonly plan: ReviewPlan | null
  /** The candidate mandate covering this case+leg, or `null`. */
  readonly mandate: ReviewMandate | null
  /** The host's snapshot of the instances that exist and their lifecycle. */
  readonly candidates: readonly ReviewerCandidate[]
  /** The folded assignment state for this case, or `null` when the caller has not folded one. */
  readonly current: ReviewAssignmentState | null
  /** The runtime's current plan epoch, supplied by the caller. */
  readonly currentEpoch: number
  /** The caller's wall clock as an ISO instant, for the plan's expiry law. No clock is read here. */
  readonly nowIso: string
  /** True when the plan itself was revoked at the current epoch. */
  readonly planRevoked: boolean
}

const ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/

function decision(value: ReviewRoutingDecision): ReviewAssignmentResult<ReviewRoutingDecision> {
  return { ok: true, value }
}

function refused(refusal: ReviewAssignmentRefusal, detail: string): ReviewAssignmentResult<never> {
  return { ok: false, refusal, detail }
}

function leaderLeaves(
  reason: ReviewRouterReasonFor,
  current: ReviewAssignmentState | null,
  detail = '',
): ReviewRoutingDecision {
  const target = current?.assignment?.target
  return {
    kind: 'leaveWithLeader',
    reasonCode: reason,
    leaderAlreadyTarget: target !== undefined && target.kind === 'leader' && current?.live === true,
    expectedPreviousEpoch: current?.epochApplied ?? 0,
    detail,
  }
}

type ReviewRouterReasonFor =
  | 'LEADER_NO_APPROVAL_CASE_ID'
  | 'LEADER_PLAN_ABSENT'
  | 'LEADER_PLAN_EPOCH_STALE'
  | 'LEADER_MANDATE_ABSENT'
  | 'LEADER_MANDATE_REVOKED'
  | 'LEADER_MANDATE_NOT_COVERING'
  | 'LEADER_NO_ELIGIBLE_REVIEWER'
  | 'LEADER_LEG_NOT_CURRENT'
  | 'ROUTER_ALREADY_ASSIGNED'

function isCandidateWellFormed(candidate: ReviewerCandidate): boolean {
  return (
    typeof candidate === 'object' &&
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
    typeof candidate.isLeaderInstance === 'boolean'
  )
}

function selfInterestRefs(caseView: ReviewCaseView): readonly string[] {
  return [caseView.requesterCallerRef, caseView.beneficiaryCallerRef, caseView.subjectCallerRef].filter(
    (ref): ref is string => typeof ref === 'string' && ref.length > 0,
  )
}

/**
 * Would PR0's admission gate admit this instance for this case at all?
 *
 * Checked over the decision values the mandate actually names, and if it names none, over both: a
 * mandate that grants no decision value is refused by PR0 itself, and the router reports that refusal
 * rather than inventing its own verdict.
 */
function admitsSomewhere(
  input: ReviewRoutingInput,
  plan: ReviewPlan,
  mandate: ReviewMandate,
  instanceId: string,
  callerRef: string,
): { readonly admitted: true } | { readonly admitted: false; readonly refusals: readonly string[] } {
  const values: readonly ReviewMandateDecision[] = mandate.decisions.length > 0 ? mandate.decisions : ['allow', 'deny']
  const refusals: string[] = []
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
    })
    if (answer.admitted) return { admitted: true }
    refusals.push(answer.refusal ?? 'REVIEW_ADMISSION_REFUSAL_UNNAMED')
  }
  return { admitted: false, refusals }
}

/**
 * Route one case. Pure, total, and closed: it returns either a typed decision or a typed refusal, and
 * the decision is one of assign / keep / leaveWithLeader. No effect, no I/O, no fact construction — the
 * caller turns an `assign` into an encoded fact with `encodeAssignmentFact` and lets PR-I1 write it.
 */
export function routeReviewCase(input: ReviewRoutingInput): ReviewAssignmentResult<ReviewRoutingDecision> {
  // ---- structural: a malformed input is a refusal, never a silent "leave it with the Leader" ----
  // The distinction matters: leaveWithLeader is a routing outcome that a caller may act on (it means
  // "no change"), while a refusal means the caller's own inputs were not usable. Silently converting
  // the second into the first would make a broken host look like a healthy team that needs no change.
  if (typeof input !== 'object' || input === null) {
    return refused('REVIEW_ASSIGNMENT_ROUTER_INPUT_INCOMPLETE', 'input must be a record')
  }
  if (typeof input.rootSessionId !== 'string' || !ID_PATTERN.test(input.rootSessionId)) {
    return refused('REVIEW_ASSIGNMENT_ROUTER_INPUT_INCOMPLETE', 'rootSessionId failed hygiene')
  }
  if (!ID_PATTERN.test(input.currentLegRequestId) || !ID_PATTERN.test(input.caseVersion)) {
    return refused('REVIEW_ASSIGNMENT_ROUTER_INPUT_INCOMPLETE', 'leg request id / case version failed hygiene')
  }
  if (typeof input.caseView !== 'object' || input.caseView === null) {
    return refused('REVIEW_ASSIGNMENT_ROUTER_INPUT_INCOMPLETE', 'caseView must be a folded record')
  }
  if (!Array.isArray(input.candidates)) {
    return refused('REVIEW_ASSIGNMENT_ROUTER_INPUT_INCOMPLETE', 'candidates must be an array')
  }
  if (typeof input.nowIso !== 'string' || input.nowIso.length === 0) {
    return refused('REVIEW_ASSIGNMENT_ROUTER_INPUT_INCOMPLETE', 'nowIso must be supplied (no clock is read here)')
  }
  if (!Number.isSafeInteger(input.currentEpoch) || input.currentEpoch < 0) {
    return refused('REVIEW_ASSIGNMENT_ROUTER_INPUT_INCOMPLETE', 'currentEpoch must be a safe non-negative integer')
  }
  const seen = new Set<string>()
  for (const candidate of input.candidates) {
    if (!isCandidateWellFormed(candidate)) {
      return refused('REVIEW_ASSIGNMENT_ROUTER_CANDIDATE_MALFORMED', 'a candidate record failed validation')
    }
    if (seen.has(candidate.instanceId)) {
      // The same instance twice means the host's snapshot is inconsistent. Routing over an
      // inconsistent snapshot is how one instance ends up with two assignments.
      return refused('REVIEW_ASSIGNMENT_ROUTER_CANDIDATE_MALFORMED', `duplicate candidate ${candidate.instanceId}`)
    }
    seen.add(candidate.instanceId)
  }
  if (input.current !== null) {
    if (typeof input.current !== 'object' || input.current.rootSessionId !== input.rootSessionId) {
      return refused('REVIEW_ASSIGNMENT_ROUTER_INPUT_INCOMPLETE', 'the current assignment view belongs to another team')
    }
    if (input.current.unreconciled) {
      // A-7 on the read side: a family view with diagnostics cannot tell us who currently holds the
      // case, and "we do not know who holds it" must not become "nobody holds it, assign it".
      return refused(
        'REVIEW_ASSIGNMENT_ROUTER_INPUT_INCOMPLETE',
        `the current assignment view is unreconciled (${String(input.current.diagnostics.length)} diagnostic(s))`,
      )
    }
  }

  const current = input.current
  const nextEpoch = (current?.epochApplied ?? 0) + 1

  // ---- the case itself: no case identity, no delegation ----
  const caseId = input.caseView.approvalCaseId
  if (caseId === undefined) {
    // PR #319 §6: legacy `leader-approval` rows without a case id get no fabricated case. This is the
    // single most important leave-with-Leader branch, because it is the one that keeps the OLD path
    // whole for every Team Alpha.6 has not been enabled for.
    return decision(leaderLeaves('LEADER_NO_APPROVAL_CASE_ID', current))
  }
  if (input.caseView.legOrdinal !== input.caseView.currentLegOrdinal) {
    return decision(leaderLeaves('LEADER_LEG_NOT_CURRENT', current))
  }

  // ---- the plan: a hard precondition (R-1), not a preference ----
  if (input.plan === null || !isParsedReviewPlan(input.plan)) {
    return decision(leaderLeaves('LEADER_PLAN_ABSENT', current))
  }
  const plan = input.plan
  if (plan.rootSessionId !== input.rootSessionId) {
    return refused('REVIEW_ASSIGNMENT_ROUTER_INPUT_INCOMPLETE', 'the plan belongs to another team')
  }
  // No `delegatedRung` check here, and that is deliberate rather than an oversight: `parseReviewPlan`
  // refuses any plan that delegates something other than DELEGABLE_REVIEW_RUNG (RUNG_NOT_DELEGABLE) and
  // refuses an officer bound to the Leader instance (REVIEWER_IS_LEADER_INSTANCE), so a
  // parser-produced plan cannot reach this function carrying either. A branch that no input can reach
  // would be a refusal code the closed-set leg could never produce — the dead-vocabulary defect this
  // phase has already been burned on twice.
  if (plan.epoch !== input.currentEpoch) {
    return decision(leaderLeaves('LEADER_PLAN_EPOCH_STALE', current))
  }

  // ---- the mandate: case-scoped, covering, unrevoked ----
  if (input.mandate === null) {
    return decision(leaderLeaves('LEADER_MANDATE_ABSENT', current))
  }
  const mandate = input.mandate
  if (mandate.revoked) {
    return decision(leaderLeaves('LEADER_MANDATE_REVOKED', current))
  }
  const mandateCovers =
    mandate.approvalCaseId === caseId &&
    mandate.legOrdinal === input.caseView.legOrdinal &&
    mandate.actionName === input.caseView.actionName &&
    mandate.effectScopeFingerprint === input.caseView.effectScopeFingerprint &&
    mandate.planEpoch === plan.epoch
  if (!mandateCovers) {
    return decision(leaderLeaves('LEADER_MANDATE_NOT_COVERING', current))
  }

  // ---- the officer the plan binds, as the host reports it ----
  const officer = input.candidates.find((candidate) => candidate.instanceId === plan.reviewerInstanceId)
  if (officer === undefined) {
    return decision(leaderLeaves('LEADER_NO_ELIGIBLE_REVIEWER', current))
  }
  if (officer.isLeaderInstance) {
    // PR0's L-1: an Officer binding that points at the Leader is a refusal, not a shortcut. Loud here
    // too, because a plan wired to the Leader means somebody's configuration is wrong RIGHT NOW.
    return refused(
      'REVIEW_ASSIGNMENT_TARGET_IS_LEADER_INSTANCE',
      `the plan binds ${plan.reviewerInstanceId}, which the host reports as the Leader instance`,
    )
  }
  if (!REVIEW_ROUTER_ELIGIBLE_LIFECYCLES.includes(officer.lifecycle)) {
    return decision(
      leaderLeaves(
        'LEADER_NO_ELIGIBLE_REVIEWER',
        current,
        `the bound officer is ${officer.lifecycle}`,
      ),
    )
  }
  if (selfInterestRefs(input.caseView).includes(officer.callerRef)) {
    // Self-review is refused at routing time as well as at the write path: a case that will be refused
    // anyway should never acquire an assignment that an operator then has to explain.
    return decision(leaderLeaves('LEADER_NO_ELIGIBLE_REVIEWER', current))
  }

  // ---- never wider than the admission gate ----
  const admits = admitsSomewhere(input, plan, mandate, officer.instanceId, officer.callerRef)
  if (!admits.admitted) {
    return decision(
      leaderLeaves(
        'LEADER_MANDATE_NOT_COVERING',
        current,
        `the admission gate refused every decision value: ${admits.refusals.join(', ')}`,
      ),
    )
  }

  // ---- what an existing assignment does to the answer ----
  if (current !== null && current.live && current.assignment !== null) {
    const existing = current.assignment
    if (existing.currentLegRequestId === input.currentLegRequestId && existing.target.kind === 'leader') {
      // THE HANDOFF IS NOT UNDONE BY A WAKE. See the module doc: the Leader took this case on purpose.
      return decision(leaderLeaves('ROUTER_ALREADY_ASSIGNED', current))
    }
    if (existing.currentLegRequestId === input.currentLegRequestId && existing.target.kind === 'instance') {
      if (existing.target.instanceId === officer.instanceId) {
        return decision({
          kind: 'keep',
          target: existing.target,
          reasonCode: 'ROUTER_ALREADY_ASSIGNED',
          assignmentEpoch: existing.assignmentEpoch,
        })
      }
      return decision({
        kind: 'assign',
        target: { kind: 'instance', instanceId: officer.instanceId },
        reasonCode: 'ROUTER_TARGET_INELIGIBLE_NOW_REASSIGNED',
        expectedPreviousEpoch: current.epochApplied,
        assignmentEpoch: nextEpoch,
      })
    }
    // The case moved to a new leg since the assignment was made: the old assignment describes an old
    // leg and the new one needs its own decision. Fall through to a fresh assignment at the next epoch.
  }

  return decision({
    kind: 'assign',
    target: { kind: 'instance', instanceId: officer.instanceId },
    reasonCode: 'ROUTER_PLAN_COVERS_ACTION',
    expectedPreviousEpoch: current?.epochApplied ?? 0,
    assignmentEpoch: nextEpoch,
  })
}
