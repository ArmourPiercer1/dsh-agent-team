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
 * until that PR lands nothing ACTS on the answer this function gives: PR0
 * deliberately ships the law and its negative controls WITHOUT wiring a
 * reviewer decision to `allow` anywhere (execution-plan G-5).
 *
 * As of Alpha.6 PR2′ (#507) this vocabulary has its first consumer — `review-assignment/router.ts`,
 * which calls `evaluateReviewAdmission` so that a router can never be wider than this gate. That
 * consumer is itself dormant (no importer, no writer; `a6-pr2-lane-hygiene.test.ts` pins it), so the
 * paragraph above still holds in the only sense that matters: there is no path from a reviewer decision
 * to `allow` yet. "No production caller" was the sentence before #507; it was true then and is not true
 * now, which is why it is amended here rather than left to mislead a reader of the dark lane.
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
import { type ReviewAdmission, type ReviewAdmissionInput, type ReviewRequestKind, type ReviewCaseView } from './types.js';
/**
 * The Alpha.4 role closure, mirrored for the ordering step 1. Deliberately a
 * mirror, not an import: `control/types.ts` sits inside the ARC-A protected
 * center and this lane must not depend on it for a 3-key table. The PR0 test
 * reads the protected source text and asserts this mirror still agrees, so the
 * duplication is policed rather than assumed.
 */
export declare const CONTROL_ROLE_CLOSURE_MIRROR: Readonly<Record<ReviewRequestKind, readonly string[]>>;
/** Does the Alpha.4 closure admit this role for this kind, unchanged? */
export declare function roleTableAdmits(role: string, kind: ReviewRequestKind): boolean;
/**
 * Is the delegation branch applicable to this row at all? Split out because
 * PR-I1 needs the same answer to decide whether to consult a mandate, and
 * because it is where L-2 lives: no case id, no delegation.
 */
export declare function delegationApplicable(caseView: ReviewCaseView): boolean;
/**
 * The admission check. See the module header for the ordering and why each
 * step sits where it does.
 */
export declare function evaluateReviewAdmission(input: ReviewAdmissionInput): ReviewAdmission;
//# sourceMappingURL=mandate.d.ts.map