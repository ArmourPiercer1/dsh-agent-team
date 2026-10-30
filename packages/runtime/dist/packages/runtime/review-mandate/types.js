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
export const REVIEW_RUNGS = ['member', 'leader', 'human-user', 'human-admin'];
/** The three control request kinds, as this lane must name them (control/types.ts:163). */
export const REVIEW_REQUEST_KINDS = ['leader-approval', 'user-approval', 'envelope-mutation'];
/**
 * The only rung an Approval Officer may ever stand on. A plan that names a
 * human rung as its `delegatedRung`, or a case whose leg rung is anything
 * other than this, is refused (L-1): the Officer replaces the LEADER's
 * ordinary review, never the human's.
 */
export const DELEGABLE_REVIEW_RUNG = 'leader';
/** The one kind whose cases delegation may touch (L-1). */
export const DELEGABLE_REQUEST_KIND = 'leader-approval';
/** The caller roles the decision entrances know about. */
export const REVIEW_CALLER_ROLES = ['leader', 'member', 'human'];
/** A decision value, as the mandate grammar names it. `allow`/`deny` only:
 *  `escalate` and `stale-denied` are entrances, not reviewer choices. */
export const REVIEW_MANDATE_DECISIONS = ['allow', 'deny'];
// --- the admission question and its typed answer ------------------------------------------
/** Every refusal this lane can answer with. Closed: no free-form reason. */
export const REVIEW_ADMISSION_REFUSALS = [
    'REVIEW_INPUT_MALFORMED',
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
];
//# sourceMappingURL=types.js.map