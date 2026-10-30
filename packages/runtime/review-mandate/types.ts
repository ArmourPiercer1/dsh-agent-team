/**
 * Alpha.6 PR0 (Lane 2) — the CLOSED vocabulary of case-scoped review
 * delegation: the trusted ReviewPlan, the bound ReviewerIdentity, the
 * Case-scoped ReviewMandate derived from them, and the typed refusal codes
 * of the admission check.
 *
 * WHY THIS LANE EXISTS (design source PR #319 §4, §5; revalidated in
 * `docs/plans/memo/alpha6-review-separation/s0-revalidation-20261030.md` §2).
 * Alpha.4 made the Leader the only non-human resolver of a `leader-approval`
 * case (`CONTROL_RESOLVER_ROLES`, control/types.ts:193). Alpha.6 lets a
 * dedicated Approval Officer — a NORMAL Member Instance holding a limited,
 * case-scoped mandate — handle ordinary leader-rung review, WITHOUT:
 *   - a new permission rung (the ladder stays member < leader < human-user
 *     < human-admin; the Officer is not a second Leader and never one),
 *   - a second approval authority or store (the mandate is a fact of the same
 *     TeamDomain ledger; this module only DERIVES and CHECKS, it never
 *     decides),
 *   - assignment-as-authority (who handles a case says nothing about who may
 *     decide it).
 *
 * WHAT THIS MODULE IS NOT. It is not the write path. It imports NOTHING from
 * `control/**` (which is inside the ARC-A digest-pinned protected center) and
 * performs no I/O, no clock read, no lock. The admission result it produces is
 * an INPUT to the one authoritative decision entrance (`resolveControl` and its
 * three sibling entrances); composing it there is a named Center-Interface PR
 * (plan PR-I1), gated separately, precisely so that this file can never be
 * mistaken for the authority itself.
 *
 * THE LAWS THIS FILE IS NAMED FOR, each encoded once and tested:
 *  L-1 ONLY the delegated rung is delegable. `user-approval` is never
 *      delegable (a Member standing in for the user defeats the kind);
 *      `envelope-mutation` subjects the Leader's envelope and is not delegated
 *      in Alpha.6. A leg whose `reviewAuthority` is a human rung is never
 *      delegated.
 *  L-2 NO mandate without a case. The delegation is keyed by
 *      `approvalCaseId`; a leg-less row (pre-v3 adapter rows, PA-bridge rows,
 *      raw `team_request_control`) structurally cannot carry one, so the
 *      Member branch refuses with `REVIEW_CASE_UNBOUND`. Widening the role
 *      table instead would hand Members authority over exactly those rows —
 *      which is why the OR-branch is gated on case presence and NOT a table
 *      edit (S0 revision R-3).
 *  L-3 A mandate is derived from a trusted ReviewPlan, never from input the
 *      model can write. The plan arrives from Host-supplied config, is bound
 *      to (rootSessionId, blueprint digest, epoch), and every field of a
 *      candidate mandate is checked against it.
 *  L-4 Self-review is impossible, directly and indirectly: the reviewer
 *      instance may not be the requester, the beneficiary, or the subject of
 *      the case, and may not act on a case where it already acted on an
 *      earlier leg.
 *  L-5 Fail closed everywhere. An absent plan, a malformed plan, a foreign
 *      binding, a stale epoch, a revoked generation, an unknown key: all
 *      refusals, never defaults. A refusal is not an error and writes nothing.
 *
 * @module review-mandate/types
 */

// --- closed vocabularies ---------------------------------------------------------------

/**
 * The rungs of the frozen ladder (Alpha.4 spec §23; the same four values the
 * PA manifest grammar admits, control/types.ts:1016). Duplicated as a literal
 * union deliberately: importing the protected `control/types.js` from a new
 * lane would make this lane a dependency of the center for a four-value
 * vocabulary, and a census, not a compiler, is what keeps the two lists
 * aligned (pinned by the PR0 test against the source text).
 */
export const REVIEW_RUNGS = ['member', 'leader', 'human-user', 'human-admin'] as const
export type ReviewRung = (typeof REVIEW_RUNGS)[number]

/** The three control request kinds, as this lane must name them (control/types.ts:163). */
export const REVIEW_REQUEST_KINDS = ['leader-approval', 'user-approval', 'envelope-mutation'] as const
export type ReviewRequestKind = (typeof REVIEW_REQUEST_KINDS)[number]

/**
 * The only rung an Approval Officer may ever stand on. A plan that names a
 * human rung as its `delegatedRung`, or a case whose leg rung is anything
 * other than this, is refused (L-1): the Officer replaces the LEADER's
 * ordinary review, never the human's.
 */
export const DELEGABLE_REVIEW_RUNG: ReviewRung = 'leader'

/** The one kind whose cases delegation may touch (L-1). */
export const DELEGABLE_REQUEST_KIND: ReviewRequestKind = 'leader-approval'

/** The caller roles the decision entrances know about. */
export const REVIEW_CALLER_ROLES = ['leader', 'member', 'human'] as const
export type ReviewCallerRole = (typeof REVIEW_CALLER_ROLES)[number]

/** A decision value, as the mandate grammar names it. `allow`/`deny` only:
 *  `escalate` and `stale-denied` are entrances, not reviewer choices. */
export const REVIEW_MANDATE_DECISIONS = ['allow', 'deny'] as const
export type ReviewMandateDecision = (typeof REVIEW_MANDATE_DECISIONS)[number]

// --- trusted ReviewPlan ----------------------------------------------------------------

/** One action this plan delegates, matched by canonical operation/tool name. */
export interface ReviewPlanActionScope {
  /** Exact name match (the closed operation or tool name), never a prefix. */
  readonly actionName: string
  /** The decision values this action is delegated. Non-empty, subset of
   *  {@link REVIEW_MANDATE_DECISIONS}. */
  readonly decisions: readonly ReviewMandateDecision[]
}

/** One effect-scope shape this plan delegates. `effectSetFingerprint` is the
 *  exact fingerprint of the effect set under review; a plan may delegate an
 *  exact fingerprint or an entire action scope, never a wildcard string. */
export interface ReviewPlanEffectScope {
  /** `'exact-fingerprint'` (value = one fingerprint) or `'by-action-name'`
   *  (value = an action listed in `actions`). Closed, no other form. */
  readonly form: 'exact-fingerprint' | 'by-action-name'
  readonly value: string
}

/**
 * The trusted review plan: Host-supplied, immutable for a given
 * (rootSessionId, blueprint digest, epoch), and the ONLY source a
 * {@link ReviewMandate} may be derived from (L-3).
 */
export interface ReviewPlan {
  /** The team this plan belongs to. A plan never applies cross-team. */
  readonly rootSessionId: string
  /** Content hash the live blueprint is verified against (64-hex lowercase). */
  readonly blueprintDigest: string
  /** Plan epoch. A candidate mandate must carry the epoch the runtime
   *  currently holds; a mismatch is `REVIEW_PLAN_EPOCH_STALE`. */
  readonly epoch: number
  /** The bound Approval Officer instance. Exactly one in Alpha.6. */
  readonly reviewerInstanceId: string
  /** The single rung this plan delegates — always {@link DELEGABLE_REVIEW_RUNG}. */
  readonly delegatedRung: ReviewRung
  /** The delegated actions and per-action decision values. Non-empty. */
  readonly actions: readonly ReviewPlanActionScope[]
  /** The delegated effect scopes. Non-empty. */
  readonly effectScopes: readonly ReviewPlanEffectScope[]
  /**
   * Optional WALL-CLOCK expiry (`null` = none). Kept a separate law from
   * {@link ReviewPlan.epoch} on purpose: the epoch catches a plan a newer
   * config superseded, the expiry catches a delegation that outlived its
   * agreed window ("review ordinary fs writes for the next 8 hours"). If both
   * were epochs, expiry could never fire — a live plan always matches the
   * current epoch — and the field would be decorative.
   */
  readonly expiresAtIso: string | null
}

// --- bound reviewer identity ------------------------------------------------------------

/**
 * The identity a decision entrance resolves for the caller, in the shape this
 * lane checks. Field-for-field this is the caller resolution of
 * `admission/resolve.ts` (host-derived, never model-supplied); it is a plain
 * record here so this lane stays pure and testable.
 */
export interface ReviewerIdentity {
  readonly role: ReviewCallerRole
  /** The caller's instance id (absent for a human caller). */
  readonly instanceId: string | null
  /** The durable actor ref `callerRefOf(caller)` produces. */
  readonly callerRef: string
  /** The team the caller belongs to. */
  readonly rootSessionId: string
  /** True exactly when this caller IS the team's Leader instance. Carried in
   *  rather than re-derived: this lane must not guess the Leader sentinel, and
   *  an Officer binding that points at the Leader is a refusal (L-1 — the
   *  Officer is not a second Leader). */
  readonly isLeaderInstance: boolean
}

// --- case-scoped mandate ----------------------------------------------------------------

/**
 * A Case-scoped ReviewMandate: the claim that the named reviewer instance may
 * take the named decision value on THIS case's leg, under this plan epoch.
 *
 * A mandate is a DERIVED view (L-3): the durable form is a grant fact in the
 * TeamDomain ledger whose payload is re-derived against the live plan on every
 * check. Nothing here is authority — the check in `mandate.ts` recomputes
 * coverage from the plan at call time, so a revoked or superseded plan cannot
 * be replayed from a stale copy of this record.
 */
export interface ReviewMandate {
  readonly approvalCaseId: string
  readonly legOrdinal: number
  readonly reviewerInstanceId: string
  readonly planEpoch: number
  readonly actionName: string
  readonly decisions: readonly ReviewMandateDecision[]
  readonly effectScopeFingerprint: string
  /** Set by the revoke fact; a revoked mandate is refused, never downgraded. */
  readonly revoked: boolean
  /** Monotonic grant generation, for the single-use ledger. */
  readonly generation: number
}

// --- the view of the case the check needs ------------------------------------------------

/**
 * The folded case facts this lane reads. It is a VIEW, produced by the caller
 * from the authoritative fold (`buildApprovalCaseState`); this module never
 * folds and never stores.
 */
/*
 * THE ONE INPUT THIS LANE DOES NOT OWN, stated for the PR-I1 reviewer: every
 * field below must come from the authoritative case fold read INSIDE the team
 * lock, never from a tool argument. This is where the phase's safety actually
 * rests — the answer is computed from the leg's rung, the action name, the
 * effect-set fingerprint and the list of actors who already acted, so a caller
 * that fabricated a fold-shaped object could make a bound Member the resolver
 * of anything, which is exactly what invariant 37 exists to prevent. The law
 * on the PR-I1 side is therefore unconditional, and this lane's unit tests are
 * NOT evidence about it: only an integration test that drives the real fold is.
 * What this lane guarantees on its own is narrower and total: given a truthful
 * case view and a parser-produced plan, no Member decides anything it was not
 * granted, and every refusal is a closed code with no exception path.
 */
export interface ReviewCaseView {
  /** The derived case id. ABSENT on leg-less rows — which alone disqualifies
   *  a row from delegation (L-2). */
  readonly approvalCaseId: string | undefined
  readonly requestKind: ReviewRequestKind
  /** The leg's rung (`row.reviewAuthority`), the rung a resolver must be
   *  sufficient for. */
  readonly legReviewAuthority: ReviewRung
  readonly legOrdinal: number
  /** The ordinal the fold says is current. A stale leg is refused. */
  readonly currentLegOrdinal: number
  /** The durable refs that already acted on any leg of this case. */
  readonly actedCallerRefs: readonly string[]
  /** Durable requester / beneficiary / subject refs (self-interest, L-4). */
  readonly requesterCallerRef: string
  readonly beneficiaryCallerRef: string | null
  /** The durable ref of the instance the case is about, when it has one
   *  (L-4: the subject may not review its own case). */
  readonly subjectCallerRef: string | null
  /** The canonical action under review. */
  readonly actionName: string
  /** The exact effect-set fingerprint the request was opened with. */
  readonly effectScopeFingerprint: string
}

// --- the admission question and its typed answer ------------------------------------------

/** Every refusal this lane can answer with. Closed: no free-form reason. */
export const REVIEW_ADMISSION_REFUSALS = [
  'REVIEW_ROLE_ADMITS_ALREADY',
  'REVIEW_NOT_A_MEMBER_CALLER',
  'REVIEW_PLAN_ABSENT',
  'REVIEW_PLAN_UNBRANDED',
  'REVIEW_CASE_MALFORMED',
  'REVIEW_CALLER_MALFORMED',
  'REVIEW_PLAN_EPOCH_STALE',
  'REVIEW_PLAN_EXPIRED',
  'REVIEW_CLOCK_INVALID',
  'REVIEW_PLAN_TEAM_MISMATCH',
  'REVIEW_PLAN_RUNG_NOT_DELEGABLE',
  'REVIEW_PLAN_REVOKED',
  'REVIEW_IDENTITY_FOREIGN',
  'REVIEW_CALLER_IS_LEADER_INSTANCE',
  'REVIEW_KIND_NOT_DELEGABLE',
  'REVIEW_RUNG_NOT_DELEGABLE',
  'REVIEW_CASE_UNBOUND',
  'REVIEW_LEG_STALE',
  'REVIEW_ALREADY_ACTED_ON_THIS_CASE',
  'REVIEW_SELF_REQUESTER',
  'REVIEW_SELF_BENEFICIARY',
  'REVIEW_SELF_SUBJECT',
  'REVIEW_MANDATE_ABSENT',
  'REVIEW_MANDATE_REVOKED',
  'REVIEW_MANDATE_CASE_MISMATCH',
  'REVIEW_MANDATE_LEG_MISMATCH',
  'REVIEW_MANDATE_EPOCH_MISMATCH',
  'REVIEW_MANDATE_ACTION_NOT_DELEGATED',
  'REVIEW_MANDATE_DECISION_NOT_DELEGATED',
  'REVIEW_MANDATE_SCOPE_NOT_DELEGATED',
  'REVIEW_MANDATE_GENERATION_INVALID',
] as const
export type ReviewAdmissionRefusal = (typeof REVIEW_ADMISSION_REFUSALS)[number]

/** The admission answer. `basis` is diagnostic only — it is never persisted
 *  as authority and never changes what the decision row records. */
export interface ReviewAdmission {
  readonly admitted: boolean
  /** `'role-table'` (the Alpha.4 closure admitted it — behaviour unchanged),
   *  `'case-mandate'` (this lane admitted it), `null` on refusal. */
  readonly basis: 'role-table' | 'case-mandate' | null
  readonly refusal: ReviewAdmissionRefusal | null
}

/** The decision the reviewer wants to take — the thing being authorized. */
export interface ReviewDecisionAttempt {
  readonly decision: ReviewMandateDecision
  readonly actionName: string
  readonly effectScopeFingerprint: string
}

/** Everything the check reads. All fields are host-derived or folded. */
export interface ReviewAdmissionInput {
  readonly caller: ReviewerIdentity
  readonly attempt: ReviewDecisionAttempt
  readonly caseView: ReviewCaseView
  /** The live trusted plan, or `undefined` when this team has none (the
   *  default: every pre-Alpha.6 Team). */
  readonly plan: ReviewPlan | undefined
  /** The candidate mandate for this case (derived from the grant fact), or
   *  `undefined` when no grant fact covers this case. */
  readonly mandate: ReviewMandate | undefined
  /** The runtime's current epoch, supplied by the caller (this module reads no
   *  clock). */
  readonly currentEpoch: number
  /** The caller's wall clock as an ISO-8601 instant, for the expiry law above.
   *  Injected rather than read: the check stays pure and testable, and a
   *  caller with no usable clock fails closed here instead of guessing. */
  readonly nowIso: string
  /** True when the plan itself has been revoked at the current epoch. */
  readonly planRevoked: boolean
}
