/**
 * Alpha.6 PR2′ (Lane 2) — the closed vocabularies of the review router and its assignment facts.
 *
 * WHY THIS PACKAGE EXISTS AT ALL. When a case needs a `leader` rung today, the ONLY reviewer the
 * system knows about is the Leader instance, and every such case lands in one mailbox. Alpha.6 puts a
 * bound Member in front of that mailbox for the cases a frozen ReviewPlan says it may handle. Choosing
 * which Member is a routing decision; recording it is a fact; approving the case is none of those
 * things. This package does the first two and is structurally incapable of the third.
 *
 * THE ONE LAW THAT HOLDS THIS PACKAGE TOGETHER (PR #319 §4, §7; goal 3 of the phase): a ReviewAssignment
 * records WHO is expected to look, and never WHY they may approve. The assignment is a non-authorizing
 * fact (PR #319 §6: "ReviewTaskRef / ReviewAssignment 属于控制平面的非授权 projection"). A reviewer
 * that acts on an assignment still passes the single ControlService write path, which re-reads the
 * latest leg, the live mandate and the rung — an assignment it never consults. `facts.ts` makes that
 * machine-checkable rather than aspirational: an authority-bearing key in a payload is a loud refusal,
 * not an ignored field.
 *
 * Laws, numbered for the review:
 *  - A-1 ASSIGNMENT ≠ AUTHORIZATION. No rung, no `reviewAuthority`, no decision value, no grant id, no
 *    effect set appears in any type below or in any payload `facts.ts` accepts. The frozen projection
 *    category this family books is `team` and explicitly NOT `control` (see
 *    `REVIEW_ASSIGNMENT_FROZEN_CATEGORY`): the UI's control filter is where an operator goes to find
 *    things that authorize, and a row that looks like a control row but authorizes nothing is how a
 *    phase like this one gets misread.
 *  - A-2 ONE CURRENT HANDLER PER CASE, BY CAS. Exactly one assignment is current for a case at a time,
 *    identified by `assignmentEpoch`. Every mutation carries the epoch it replaces; a writer that lost
 *    the race gets a typed `…_EPOCH_CONFLICT` and changes nothing. No lock, no last-write-wins.
 *  - A-3 A SUPERSEDED TARGET MAY NOT SUBMIT (PR #319 §6: 检查旧目标不得再次提交). After a transfer or a
 *    retirement the previous target is refused by `maySubmitFor`, including when it holds a perfectly
 *    well-formed TaskRef it obtained before the change. The check is on the FOLDED state, so a stale
 *    reader cannot win by reading early.
 *  - A-4 ROUTING IS DETERMINISTIC AND FAILS CLOSED TO THE LEADER. Given the same trusted inputs the
 *    router returns the same target; with a missing plan, a missing or non-covering mandate, an unknown
 *    action, an ineligible instance, or a candidate with any self-interest relation to the case, the
 *    answer is "leave it with the Leader" — never "guess a reviewer". PR #319 §7: 未知/失配/证据不充分
 *    时交由 Leader 或合法 Human 路径，绝不对未知资源授予普通 Reviewer 审批能力.
 *  - A-5 THE ROUTER READS TRUSTED INPUTS ONLY. Every input is host-derived (the case fold, the parsed
 *    plan, the resolved identity). Nothing here accepts a role, a mandate id, an authority or a target
 *    "as claimed by the model" and acts on it: those are references, not identities (PR #319 §5.1).
 *  - A-6 HANDOFF IS NOT ESCALATION (PR #319 §7, the phase's hardest boundary). A handoff moves the
 *    TARGET to the Leader and leaves the leg's rung exactly as it was; only the existing
 *    `escalateApprovalLeg` writes a higher-rung leg. `handoff.ts` cannot express a rung change — there
 *    is no field for one — and returns the empty set of ControlService effects.
 *  - A-7 A ROW WE CANNOT READ IS A DIAGNOSTIC, NEVER A CLEAN SLATE. The ledger is append-only, so a
 *    malformed or foreign row is reported in `diagnostics` and the fold is marked `unreconciled`.
 *    "Could not parse, therefore no review work" is the failure mode PR #319 §6 names explicitly.
 *  - A-8 NO CLOCK, NO I/O, NO HOST. This lane computes and refuses. Durable writes go through a port
 *    that PR-I1 wires (`plugin/host.ts`-style `allocateSequence()` + `put`, precedent
 *    `ArtifactLedgerPort.appendGranted`); no writer exists in this PR, which is what "dormant" means
 *    here, and `a6-pr2-lane-hygiene.test.ts` proves no production file imports the lane.
 */

import { MEMBER_LIFECYCLE_STATES, MEMBER_LIFECYCLE_STATE_VALUES } from '../../contracts/src/index.js'

// --- the fact family -------------------------------------------------------------------------------

/**
 * The three fact types of this family, named exactly as PR #319 §6 proposed them
 * (`review-assignment-created` / `-transferred` / `-retired`). The design left the naming to be
 * confirmed against the closed vocabulary by S0; this is that confirmation, and it is the writer's
 * canonical registry — `projection-source.ts` mirrors these three literals the way every other row of
 * `FACT_TYPE_CATEGORY` mirrors its writer, and `a6-pr2-assignment-kernel.test.ts` pins the two against
 * drift because the ledger is append-only and an unmapped `factType` breaks `team.getProjection` for
 * every Team that ever writes it (the `control-request-abandoned` and `artifact-read-granted` history).
 */
export const REVIEW_ASSIGNMENT_FACT_TYPES = {
  created: 'review-assignment-created',
  transferred: 'review-assignment-transferred',
  retired: 'review-assignment-retired',
} as const

export type ReviewAssignmentFactKind = keyof typeof REVIEW_ASSIGNMENT_FACT_TYPES

/** Every fact-type value of this family, in declaration order. */
export const REVIEW_ASSIGNMENT_FACT_TYPE_VALUES: readonly string[] = Object.values(REVIEW_ASSIGNMENT_FACT_TYPES)

/**
 * The frozen ledger category this family books into: `team`, the category whose contract doc covers
 * "Team-level lifecycle facts (creation, admission, handoff, archive)" — the only one of the eight
 * frozen categories that names a handoff. It is deliberately NOT `control`, whose doc covers
 * "control requests, decisions, consumption, and durable authorization grants": an assignment is none
 * of those, and filing a non-authorizing row under the authorization category is the one mistake a
 * later reader could not see coming. A ninth category is not an option (contracts A3-7), and adding
 * one is a contract change this phase is forbidden to make.
 */
export const REVIEW_ASSIGNMENT_FROZEN_CATEGORY = 'team' as const

/** The categories an assignment fact may never be booked under, with the reason a reviewer can check. */
export const REVIEW_ASSIGNMENT_FORBIDDEN_CATEGORIES: readonly string[] = ['control', 'policy']

// --- target, assignment, epoch ----------------------------------------------------------------------

/**
 * Who is expected to look at the case. There is no `human` target: the design caps Alpha.6's
 * delegation at the `leader` rung (PR #319 §5, `maximumReviewAuthority: 'leader'`), a human path is
 * not something a router may choose on a model's say-so, and the union simply does not offer it.
 */
export type ReviewAssignmentTarget =
  | { readonly kind: 'instance'; readonly instanceId: string }
  | { readonly kind: 'leader' }

/** The assignment record of PR #319 §5, field for field, with the CAS epoch it specified. */
export interface ReviewAssignment {
  readonly rootSessionId: string
  readonly approvalCaseId: string
  /** The request id of the leg this assignment was made for. A new leg means the case moved on. */
  readonly currentLegRequestId: string
  readonly target: ReviewAssignmentTarget
  /** 1-based, monotonic per case. The CAS token of A-2 and the staleness test of A-3. */
  readonly assignmentEpoch: number
  /** Why this target. A hygienic string, because the reason is audit prose the router does not
   *  interpret — the router's OWN emissions come from the closed set below. */
  readonly reasonCode: string
  /** The case version the routing decision was computed from, so a decision can be replayed against
   *  the state it actually saw. Not a claim that the case is still in that state. */
  readonly basedOnCaseVersion: string
  /** The durable actor ref of whoever caused this change (the Leader's own ref for a handoff, the
   *  router's caller for an automatic creation). A reference, never an authorization. */
  readonly actorCallerRef: string
}

/** The reason codes the router itself emits. Closed: a router decision is reproducible from this set. */
export const REVIEW_ROUTER_REASON_CODES = [
  'ROUTER_PLAN_COVERS_ACTION',
  'ROUTER_ALREADY_ASSIGNED',
  // Renamed on review (F-7): it used to read `ROUTER_TARGET_INELIGIBLE_NOW_REASSIGNED` and asserted that
  // the previous target had become ineligible, which the router never evaluates — it compares the plan's
  // bound officer with the current target and nothing more. A reason code may only state what the code
  // checked.
  'ROUTER_PLAN_BINDS_DIFFERENT_OFFICER',
  'LEADER_NO_APPROVAL_CASE_ID',
  'LEADER_PLAN_ABSENT',
  'LEADER_PLAN_EPOCH_STALE',
  'LEADER_MANDATE_ABSENT',
  'LEADER_MANDATE_REVOKED',
  'LEADER_MANDATE_NOT_COVERING',
  'LEADER_NO_ELIGIBLE_REVIEWER',
  'LEADER_LEG_NOT_CURRENT',
  // Both added by review F-1. The lane ships three row kinds and none of them can express "assign this
  // case's NEW leg" (`created` may only replace epoch 0; `transferred`/`retired` need a live assignment on
  // the same leg). A router that answered `assign` for those shapes was handing PR-I1 an order it could
  // not execute — and executing it anyway produces a permanent diagnostic, an `unreconciled` view and a
  // case nobody can wake or submit. So the router now says the truth instead: the Leader keeps the case,
  // which is exactly the pre-Alpha.6 behaviour. If PR-I1 wants cross-leg assignment it must ADD the row
  // kind that can carry it, in the open, and then these two codes can go away.
  'LEADER_LEG_MOVED',
  'LEADER_ASSIGNMENT_RETIRED',
] as const

export type ReviewRouterReasonCode = (typeof REVIEW_ROUTER_REASON_CODES)[number]

// --- the folded view -------------------------------------------------------------------------------

/** Why a row was skipped, with enough identity to find it again. */
export interface ReviewAssignmentDiagnostic {
  readonly ledgerSequence: number
  readonly factType: string
  readonly refusal: ReviewAssignmentRefusal
  readonly detail: string
}

/**
 * The derived state of one case's assignment, produced only by folding ledger rows in sequence order.
 * It is a VIEW: nothing stores it, and nothing may treat its absence as permission to do nothing —
 * see `unreconciled`.
 */
export interface ReviewAssignmentState {
  readonly rootSessionId: string
  readonly approvalCaseId: string
  /** The current assignment, or null when the family has never produced one (or retired its last). */
  readonly assignment: ReviewAssignment | null
  /** True while `assignment` is the handler the reviewer may act for. False after a retirement. */
  readonly live: boolean
  /** The highest epoch applied. 0 when no row of this family has been seen. The value a mutation must
   *  present as `expectedPreviousEpoch` to change anything. */
  readonly epochApplied: number
  /** Every row this fold could not use, in sequence order. Non-empty means the view is INCOMPLETE. */
  readonly diagnostics: readonly ReviewAssignmentDiagnostic[]
  /**
   * True exactly when some row of this family could not be applied, so the fold may be missing an
   * assignment that exists. A-7: a caller that reads "no assignment" out of an unreconciled fold is
   * looking at a broken reading, not at an unassigned case, and must not conclude "no work".
   */
  readonly unreconciled: boolean
}

// --- refusals ---------------------------------------------------------------------------------------

/**
 * Every refusal this lane can answer with. Closed: no free-form reason, and every one is reachable —
 * `a6-pr2-assignment-kernel.test.ts`'s A-9 leg enumerates the produced set against this list in BOTH
 * directions, because a vocabulary with a member no path can produce is a lie about the machine.
 *
 * The review round on PR #507 renamed one member and added two, and the reason for each is the reason
 * the law changed rather than the spelling:
 * - `REVIEW_ASSIGNMENT_CASE_MISMATCH` is GONE. It was used for two different facts — a row naming another
 *   case, and a row naming another LEG — and the reviewer's F-1 showed the second use hid what actually
 *   went wrong. It is now `REVIEW_ASSIGNMENT_LEG_MISMATCH`, which says what the check compares. A row
 *   naming another case is no longer a refusal at all: see `foldReviewAssignmentRows`' input contract,
 *   whose old wording made the obvious reader (fold the whole team ledger, once per case) fail closed.
 * - `REVIEW_ASSIGNMENT_SEQUENCE_MALFORMED` is new, and it exists because a row of THIS family whose
 *   `ledgerSequence` is not a safe integer used to be dropped before the family check, i.e. A-7's promise
 *   that no row of this family is lost silently had a one-line hole (reviewer F-2, reproduced).
 */
export const REVIEW_ASSIGNMENT_REFUSALS = [
  'REVIEW_ASSIGNMENT_INPUT_MALFORMED',
  'REVIEW_ASSIGNMENT_ROW_UNPARSEABLE',
  'REVIEW_ASSIGNMENT_FIELD_UNKNOWN',
  'REVIEW_ASSIGNMENT_AUTHORITY_FIELD_PRESENT',
  'REVIEW_ASSIGNMENT_CROSS_TEAM_ROW',
  'REVIEW_ASSIGNMENT_LEG_MISMATCH',
  'REVIEW_ASSIGNMENT_SEQUENCE_INVALID',
  'REVIEW_ASSIGNMENT_SEQUENCE_MALFORMED',
  'REVIEW_ASSIGNMENT_EPOCH_CONFLICT',
  'REVIEW_ASSIGNMENT_ALREADY_ACTIVE',
  'REVIEW_ASSIGNMENT_NO_ACTIVE_ASSIGNMENT',
  'REVIEW_ASSIGNMENT_TARGET_UNCHANGED',
  'REVIEW_ASSIGNMENT_TARGET_IS_LEADER_INSTANCE',
  'REVIEW_ASSIGNMENT_STALE_TARGET',
  'REVIEW_ASSIGNMENT_REASON_CODE_INVALID',
  'REVIEW_ASSIGNMENT_ROUTER_INPUT_INCOMPLETE',
  'REVIEW_ASSIGNMENT_ROUTER_CANDIDATE_MALFORMED',
] as const

/**
 * Two codes were deleted here while this file was being written, and the reason belongs in the open
 * because deleting vocabulary is the sort of edit a reviewer should not have to reverse-engineer: the
 * first draft carried `REVIEW_ASSIGNMENT_ROUTER_LIFECYCLE_INELIGIBLE` and
 * `REVIEW_ASSIGNMENT_ROUTER_SELF_INTEREST`, but no path in the router could produce either — an
 * ineligible lifecycle and a self-interested officer both answer `leaveWithLeader` with the reason code
 * `LEADER_NO_ELIGIBLE_REVIEWER` and name the cause in `detail`. A refusal code nothing can produce is a
 * lie about the machine (PR3′'s `WAKE_REDELIVER_BUDGET_EXCEEDED`, found by its own review), so the list
 * above is exactly the set the kernel test can reach, in both directions.
 */

export type ReviewAssignmentRefusal = (typeof REVIEW_ASSIGNMENT_REFUSALS)[number]

/** A typed refusal: code + a detail string that never carries case payload. */
export interface ReviewAssignmentRefusalResult {
  readonly ok: false
  readonly refusal: ReviewAssignmentRefusal
  readonly detail: string
}

/** A typed acceptance. */
export interface ReviewAssignmentAccept<T> {
  readonly ok: true
  readonly value: T
}

export type ReviewAssignmentResult<T> = ReviewAssignmentAccept<T> | ReviewAssignmentRefusalResult

// --- the router's question and its typed answer ------------------------------------------------------

export const REVIEW_ROUTER_ELIGIBLE_LIFECYCLES: readonly string[] = [
  MEMBER_LIFECYCLE_STATES.RUNNING,
  MEMBER_LIFECYCLE_STATES.SETTLED,
]

/**
 * Which of the five frozen lifecycle states a routed reviewer may be in, and why those two.
 *
 * The first draft of this router gated on a state called `'active'`, a word that appears nowhere in the
 * frozen vocabulary — the same class of defect PR3′ caught in its own test (a hand-copied vocabulary
 * that kept passing because the code refused everything anyway). So the list is imported from
 * `@dsh-agent-team/contracts` rather than retyped, and the choice is Architecture §29:
 *
 *  - `RUNNING` (§29.2) — an admitted turn exists, so the case will actually be looked at.
 *  - `SETTLED` (§29.3) — the resting state of an idle Member: identity, child Session and conversation
 *    preserved. This is the state a wake is delivered to; excluding it would refuse every reviewer the
 *    team is not mid-turn with, which is the entire point of a scheduler.
 *  - not `CREATED` (§29.1) — identity and config are durable but no work turn has ever run, so the
 *    instance has no session generation to key a wake slot on. Routing a case there strands it.
 *  - not `ARCHIVED` (§29.4) / `DISPOSED` (§29.5) — out of the active work set, and terminal after that.
 */
export const REVIEW_ROUTER_ELIGIBLE_LIFECYCLE_REASON: Readonly<Record<string, string>> = Object.freeze({
  RUNNING: 'an admitted turn exists (§29.2)',
  SETTLED: 'the resting state a wake is delivered to (§29.3)',
  CREATED: 'no work turn has ever run, so no session generation to wake (§29.1)',
  ARCHIVED: 'left the active work set (§29.4)',
  DISPOSED: 'terminal (§29.5)',
})

/** The five frozen states, re-exported so a caller can validate its own snapshot without a second import. */
export const REVIEW_MEMBER_LIFECYCLE_STATE_VALUES: readonly string[] = MEMBER_LIFECYCLE_STATE_VALUES

/** A reviewer the host says exists and is eligible to run. Lifecycle is supplied, never inferred. */
export interface ReviewerCandidate {
  readonly instanceId: string
  readonly callerRef: string
  /** The durable lifecycle state exactly as the host reports it — one of the five frozen
   *  `MEMBER_LIFECYCLE_STATES`. Anything else is a malformed snapshot and refused loudly, because a
   *  router that quietly skipped an unrecognised state would keep working after the center grew the
   *  vocabulary, and nobody would notice the day it started routing to a DISPOSED instance. */
  readonly lifecycle: string
  /** True exactly when this instance IS the team's Leader. A plan that points at the Leader is a
   *  refusal, not a shortcut (PR0's L-1: an Officer is not a second Leader). */
  readonly isLeaderInstance: boolean
}

/** The router's decision. Three outcomes, and only one of them moves work to a Member. */
export type ReviewRoutingDecision =
  | {
      readonly kind: 'assign'
      readonly target: ReviewAssignmentTarget
      readonly reasonCode: ReviewRouterReasonCode
      /** The epoch the resulting fact must claim to replace. */
      readonly expectedPreviousEpoch: number
      readonly assignmentEpoch: number
    }
  | {
      readonly kind: 'keep'
      readonly target: ReviewAssignmentTarget
      readonly reasonCode: ReviewRouterReasonCode
      readonly assignmentEpoch: number
    }
  | {
      readonly kind: 'leaveWithLeader'
      readonly reasonCode: ReviewRouterReasonCode
      /** Whether the Leader is already the current target, so the caller knows a fact would be churn. */
      readonly leaderAlreadyTarget: boolean
      readonly expectedPreviousEpoch: number
      /** What more the router could say about this outcome — the PR0 admission refusal codes it saw, or
       *  the reason a snapshot was insufficient. Diagnostic only: it authorizes nothing and changes
       *  nothing, and "leave it with the Leader" with no way to ask WHY was not good enough. */
      readonly detail: string
    }

/** The typed handoff outcome of `handoff.ts` (A-6). Note what is NOT here: any leg, rung or decision. */
export interface ReviewHandoffPlan {
  readonly factType: string
  readonly assignmentEpoch: number
  readonly expectedPreviousEpoch: number
  readonly rootSessionId: string
  readonly approvalCaseId: string
  readonly currentLegRequestId: string
  readonly basedOnCaseVersion: string
  readonly reasonCode: string
  readonly actorCallerRef: string
  /** Always empty. Present so the boundary is a value a test can assert, not a comment. */
  readonly controlServiceEffects: readonly []
  /** Always false. The leg's rung is untouched by a handoff; escalation is a different operation. */
  readonly rungChanged: false
}
