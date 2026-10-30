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
import { MEMBER_LIFECYCLE_STATES, MEMBER_LIFECYCLE_STATE_VALUES } from '../../contracts/src/index.js';
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
};
/** Every fact-type value of this family, in declaration order. */
export const REVIEW_ASSIGNMENT_FACT_TYPE_VALUES = Object.values(REVIEW_ASSIGNMENT_FACT_TYPES);
/**
 * The frozen ledger category this family books into: `team`, the category whose contract doc covers
 * "Team-level lifecycle facts (creation, admission, handoff, archive)" — the only one of the eight
 * frozen categories that names a handoff. It is deliberately NOT `control`, whose doc covers
 * "control requests, decisions, consumption, and durable authorization grants": an assignment is none
 * of those, and filing a non-authorizing row under the authorization category is the one mistake a
 * later reader could not see coming. A ninth category is not an option (contracts A3-7), and adding
 * one is a contract change this phase is forbidden to make.
 */
export const REVIEW_ASSIGNMENT_FROZEN_CATEGORY = 'team';
/** The categories an assignment fact may never be booked under, with the reason a reviewer can check. */
export const REVIEW_ASSIGNMENT_FORBIDDEN_CATEGORIES = ['control', 'policy'];
/** The reason codes the router itself emits. Closed: a router decision is reproducible from this set. */
export const REVIEW_ROUTER_REASON_CODES = [
    'ROUTER_PLAN_COVERS_ACTION',
    'ROUTER_ALREADY_ASSIGNED',
    'ROUTER_TARGET_INELIGIBLE_NOW_REASSIGNED',
    'LEADER_NO_APPROVAL_CASE_ID',
    'LEADER_PLAN_ABSENT',
    'LEADER_PLAN_EPOCH_STALE',
    'LEADER_MANDATE_ABSENT',
    'LEADER_MANDATE_REVOKED',
    'LEADER_MANDATE_NOT_COVERING',
    'LEADER_NO_ELIGIBLE_REVIEWER',
    'LEADER_LEG_NOT_CURRENT',
];
// --- refusals ---------------------------------------------------------------------------------------
/**
 * Every refusal this lane can answer with. Closed: no free-form reason, and every one is reachable —
 * `a6-pr3-wake-kernel.test.ts`'s sibling leg enumerates the produced set against this list in both
 * directions, because a vocabulary with a member no path can produce is a lie about the machine.
 */
export const REVIEW_ASSIGNMENT_REFUSALS = [
    'REVIEW_ASSIGNMENT_INPUT_MALFORMED',
    'REVIEW_ASSIGNMENT_ROW_UNPARSEABLE',
    'REVIEW_ASSIGNMENT_FIELD_UNKNOWN',
    'REVIEW_ASSIGNMENT_AUTHORITY_FIELD_PRESENT',
    'REVIEW_ASSIGNMENT_CROSS_TEAM_ROW',
    'REVIEW_ASSIGNMENT_CASE_MISMATCH',
    'REVIEW_ASSIGNMENT_SEQUENCE_INVALID',
    'REVIEW_ASSIGNMENT_EPOCH_CONFLICT',
    'REVIEW_ASSIGNMENT_ALREADY_ACTIVE',
    'REVIEW_ASSIGNMENT_NO_ACTIVE_ASSIGNMENT',
    'REVIEW_ASSIGNMENT_TARGET_UNCHANGED',
    'REVIEW_ASSIGNMENT_TARGET_IS_LEADER_INSTANCE',
    'REVIEW_ASSIGNMENT_STALE_TARGET',
    'REVIEW_ASSIGNMENT_REASON_CODE_INVALID',
    'REVIEW_ASSIGNMENT_ROUTER_INPUT_INCOMPLETE',
    'REVIEW_ASSIGNMENT_ROUTER_CANDIDATE_MALFORMED',
];
// --- the router's question and its typed answer ------------------------------------------------------
export const REVIEW_ROUTER_ELIGIBLE_LIFECYCLES = [
    MEMBER_LIFECYCLE_STATES.RUNNING,
    MEMBER_LIFECYCLE_STATES.SETTLED,
];
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
export const REVIEW_ROUTER_ELIGIBLE_LIFECYCLE_REASON = Object.freeze({
    RUNNING: 'an admitted turn exists (§29.2)',
    SETTLED: 'the resting state a wake is delivered to (§29.3)',
    CREATED: 'no work turn has ever run, so no session generation to wake (§29.1)',
    ARCHIVED: 'left the active work set (§29.4)',
    DISPOSED: 'terminal (§29.5)',
});
/** The five frozen states, re-exported so a caller can validate its own snapshot without a second import. */
export const REVIEW_MEMBER_LIFECYCLE_STATE_VALUES = MEMBER_LIFECYCLE_STATE_VALUES;
//# sourceMappingURL=types.js.map