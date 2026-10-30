/**
 * Alpha.6 PR2′ (Lane 2) — the durable shape of the assignment family: encode, decode, fold.
 *
 * This module is the only place in the lane that knows what an assignment ROW looks like on the ledger,
 * and it is written to be the narrowest possible gate for three reasons that are all histories in this
 * repository:
 *
 *  1. The ledger is append-only and the projection fold THROWS on any `factType` it cannot map, so the
 *     three names below must be booked in `FACT_TYPE_CATEGORY` in the same PR that introduces them —
 *     that is what `a6-pr2-assignment-kernel.test.ts`'s mirror leg enforces, in the same way
 *     `a4pr0a-fact-type-closed-set.test.ts` polices every other writer (the `control-request-abandoned`
 *     bug made `team.getProjection` fail permanently for a Team; `artifact-read-granted` did it first).
 *  2. A payload with a stray field is the shape a later "just add a hint" change takes. The field set
 *     here is CLOSED, and an unknown key is a refusal rather than something to ignore.
 *  3. The law "an assignment never grants authority" (A-1) is worth nothing if it only lives in a
 *     comment, so it is a machine check: a key whose name claims authority, a rung, a permission, a
 *     grant, a decision or a mandate is refused LOUDLY with
 *     `REVIEW_ASSIGNMENT_AUTHORITY_FIELD_PRESENT`. A writer that tries to smuggle authority into an
 *     assignment fact gets a red test, not a row that looks fine on a dashboard.
 *
 * No I/O, no host, no clock: `recordedAt` is deliberately absent from the payload because the ledger
 * entry already owns `createdAt`, and a fact that carries its own timestamp is two facts.
 */
import { type ReviewAssignment, type ReviewAssignmentFactKind, type ReviewAssignmentResult, type ReviewAssignmentState, type ReviewAssignmentTarget } from './types.js';
/** The payload's closed field set. Anything outside it is a refusal (see the module doc, reason 2). */
export declare const REVIEW_ASSIGNMENT_PAYLOAD_FIELDS: readonly string[];
/** The durable payload of one assignment fact. Flat scalars only, so it survives any JSON round trip. */
export interface ReviewAssignmentPayload {
    readonly rootSessionId: string;
    readonly approvalCaseId: string;
    readonly currentLegRequestId: string;
    readonly targetKind: 'instance' | 'leader';
    readonly targetInstanceId: string | null;
    readonly assignmentEpoch: number;
    readonly previousEpoch: number;
    readonly reasonCode: string;
    readonly basedOnCaseVersion: string;
    readonly actorCallerRef: string;
}
/** The row shape the lane writes and reads: a `factType` plus its payload, without storage's wrapper. */
export interface ReviewAssignmentRow {
    readonly ledgerSequence: number;
    readonly factType: string;
    readonly payload: unknown;
}
/**
 * Encode one fact. `expectedPreviousEpoch` is the CAS token of A-2: the writer passes the epoch it
 * read, the fold accepts the row only if that is still the epoch it stands at.
 */
export declare function encodeAssignmentFact(kind: ReviewAssignmentFactKind, assignment: ReviewAssignment, expectedPreviousEpoch: number): ReviewAssignmentResult<ReviewAssignmentPayload>;
/**
 * Decode one row's payload. Every failure is typed and every failure is a DIAGNOSTIC in the fold, never
 * a silent skip: the ledger cannot be repaired, so the only honest response to an unreadable row is to
 * say so on every read afterwards (A-7).
 */
export declare function decodeAssignmentPayload(factType: string, payload: unknown): ReviewAssignmentResult<ReviewAssignmentPayload>;
/** Is `factType` one of this family's three? */
export declare function isReviewAssignmentFactType(factType: string): boolean;
/**
 * Fold one case's assignment rows into a state view.
 *
 * The input is the case's ledger rows in durable sequence order, interleaved with every other family's
 * rows — exactly what `repositories.ledger.list()` yields — because that is the shape a caller can
 * produce without inventing a second index (the mistake PR3′'s §2 documents for wake slots). Rows of
 * other families, of other Teams and of other cases are ignored WITHOUT a diagnostic; a row of THIS
 * case's family that cannot be applied is a diagnostic, and any diagnostic marks the view
 * `unreconciled`.
 */
export declare function foldReviewAssignmentRows(rows: Iterable<ReviewAssignmentRow>, rootSessionId: string, approvalCaseId: string): ReviewAssignmentState;
/**
 * The staleness gate of A-3: may this caller act as the current handler of this case, at the epoch it
 * read?
 *
 * Every branch fails closed, including the one a caller would rather not have: an `unreconciled` fold
 * cannot confirm a current target, so it confirms nothing. A reviewer that reads a broken view and
 * proceeds anyway is exactly the "无法解析所以没待办" inversion PR #319 §6 forbids, with the polarity
 * flipped.
 */
export declare function maySubmitFor(state: ReviewAssignmentState, caller: {
    readonly instanceId: string | null;
    readonly callerRef: string;
    readonly isLeaderInstance: boolean;
}, atEpoch: number): ReviewAssignmentResult<{
    readonly assignmentEpoch: number;
}>;
/** The targets that may no longer submit, newest superseded target first. Empty on a healthy fold. */
export declare function supersededTargetsOf(state: ReviewAssignmentState): readonly ReviewAssignmentTarget[];
/**
 * The writer's pre-flight check: may a fact of `kind` for `target` be appended on top of this folded
 * state, replacing `expectedPreviousEpoch`?
 *
 * The fold enforces the same rules when it reads rows, so this is not the safety mechanism — the durable
 * write path inside the team lock is, and PR-I1 owns it. This exists so a caller gets a typed "no" with
 * the family's own vocabulary BEFORE it allocates a sequence number, instead of an append that the fold
 * later reports as an epoch conflict. Both sides of the check agree because both are this file's.
 */
export declare function checkAssignmentMutation(state: ReviewAssignmentState, kind: ReviewAssignmentFactKind, target: ReviewAssignmentTarget, currentLegRequestId: string): ReviewAssignmentResult<{
    readonly expectedPreviousEpoch: number;
    readonly assignmentEpoch: number;
}>;
//# sourceMappingURL=facts.d.ts.map