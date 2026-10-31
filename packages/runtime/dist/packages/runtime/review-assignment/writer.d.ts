/**
 * Alpha.6 PR-I1a (Lane 2) — the one durable writer of `ReviewAssignment` facts.
 *
 * WHAT THIS FILE ADDS, AND WHY IT WAS MISSING. PR2′ shipped the vocabulary (`types.ts`), the payload gate
 * (`facts.ts`), the fold and the CAS pre-flight — and, as `types.ts` A-8 said out loud, NO writer: "Durable writes
 * go through a port that PR-I1 wires (`allocateSequence()` + `put`, precedent `ArtifactLedgerPort.appendGranted`);
 * no writer exists in this PR, which is what 'dormant' means here". This is that writer. It reuses the Team
 * ledger that already exists — its sequence counter, its row shape, its write chain, its fold — and it does not
 * create a second approval ledger: the three fact types below are the only thing this module can append, they are
 * already booked into the frozen `team` category on BOTH projection surfaces (see
 * `REVIEW_ASSIGNMENT_FROZEN_CATEGORY`), and A-1 still holds: nothing this module writes can carry authority.
 *
 * THE THREE LAWS THAT DECIDE EVERY OTHER CHOICE HERE:
 *
 *  - **ONE WRITER (D-1).** Exactly one module in this repository appends `review-assignment-*` rows, and it is
 *    this one. A hygiene leg scans for a second (`a6-pr2-lane-hygiene.test.ts`), because two of the laws below
 *    are only sound under that assumption. The consequence for whoever wires this up next — PR-I1b, whose
 *    decision entry point lives INSIDE the protected centre — is a precondition, not a suggestion: route through
 *    this function. Re-implementing the write inside `control/service.ts` would put two locks on the same state,
 *    which is precisely the thing A-2's CAS cannot survive.
 *
 *  - **THE LOCK IS INJECTED, NOT IMPORTED (D-2).** ControlService serialises its writes with a `teamLocks` map
 *    that is a private closure (`control/service.ts:1656`), and reaching into it means editing the protected
 *    centre — which belongs to PR-I1b, not here. So this module takes a lock port. That means the writer's lock
 *    and the control plane's lock are, today, different objects, and the honest question is whether that is safe.
 *    It is, for a specific reason worth stating instead of assuming: the CAS domain of A-2 is this family's
 *    `assignmentEpoch`, and by the law above nothing but this writer appends these rows. A concurrent ControlService
 *    write can only append rows of OTHER families, which moves `sequence` (monotonic, allocated atomically on the
 *    host's single per-domain write chain) and cannot move `epochApplied`, cannot reorder two rows of this family,
 *    and cannot make this fold see an epoch it has not written. Two locks protecting disjoint mutable state is not
 *    a race; two locks protecting one state would be.
 *
 *  - **A REFUSAL IS AN ANSWER, AND NOTHING IS EVER HALF-CLAIMED (D-4/D-5).** There is no rollback anywhere in this
 *    storage layer — the ledger is append-only and failures roll forward, and the existing precedent for a
 *    multi-row operation is "retry completes the half-write" (`closeZeroReviewCaseTransactionally`). So every
 *    failure path here says which of three things happened: nothing was allocated, a sequence was allocated and
 *    nothing was written, or a row IS durable and here is its sequence (`REVIEW_ASSIGNMENT_ROW_DURABLE`, whose
 *    producing branch re-reads the ledger rather than inferring the answer from the exception — round 1 of
 *    #517 caught this branch asserting the second answer while the row sat durable at that sequence, because
 *    `LedgerRepository.putEntry` appends the row and only then stamps the session generation, so a root naming
 *    no TeamSession row makes the append succeed and the stamp throw). A write is only reported as applied after
 *    it has been read back out of the ledger, and a read-back disagreement is reported as one rather than
 *    presented as a retraction — the row stays, because the honest sentence about an append-only ledger is that
 *    you cannot un-write it.
 *
 * WHAT THIS MODULE IS NOT: it is not an authority check (A-1, and a row it writes cannot become one — the payload
 * gate refuses authority-bearing keys before anything durable happens), it is not a router (that is `router.ts`,
 * and the caller passes the target it decided), and it is not wired to anything yet: production imports of this
 * lane remain empty and pinned so (`a6-pr2-lane-hygiene.test.ts`, `ALLOWED_CONSUMERS = []`).
 *
 * @module @dsh-agent-team/runtime/review-assignment/writer
 */
import type { ReviewAssignmentPayload } from './facts.js';
import type { ReviewAssignmentFactKind, ReviewAssignmentRefusal, ReviewAssignmentState, ReviewAssignmentTarget } from './types.js';
/**
 * The writer's own refusal codes, in the order a reader meets them in the flow below. The kernel's refusals
 * (`REVIEW_ASSIGNMENT_*` in `types.ts`) pass through unchanged when the refusal came from the kernel; these are
 * the ones that only exist once a durable write is on the table, so they are a separate closed set rather than
 * an addition to the frozen kernel vocabulary.
 */
export declare const REVIEW_ASSIGNMENT_WRITE_REFUSALS: readonly ["REVIEW_ASSIGNMENT_WRITE_COMMAND_MALFORMED", "REVIEW_ASSIGNMENT_WRITE_ROOT_UNMINTABLE", "REVIEW_ASSIGNMENT_WRITE_CROSS_TEAM_ROW", "REVIEW_ASSIGNMENT_WRITE_FOLD_UNRECONCILED", "REVIEW_ASSIGNMENT_WRITE_CLOCK_UNREADABLE", "REVIEW_ASSIGNMENT_DURABLE_WRITE_FAILED", "REVIEW_ASSIGNMENT_ROW_DURABLE", "REVIEW_ASSIGNMENT_READBACK_MISMATCH"];
export type ReviewAssignmentWriteRefusal = (typeof REVIEW_ASSIGNMENT_WRITE_REFUSALS)[number];
/**
 * What a refusal result may name. The kernel's refusals pass through **unchanged** rather than being re-labelled:
 * a `REVIEW_ASSIGNMENT_LEG_MISMATCH` returned by `checkAssignmentMutation` means exactly what it means when the
 * caller called the kernel itself, and inventing a durable wrapper code for it would make the durable path
 * report a different fact than the pure path about the same state. (The wording here is not incidental: the
 * lane's import screen reads the preposition that introduces a module specifier followed by any quoted token,
 * comments included, and two earlier drafts of this paragraph began that phrase with the preposition and then
 * named the kernel function in backticks — which the screen, correctly, read as an import of a module named
 * after a function. A screen that is literal is a screen; a screen that gets worked around is not, so the
 * sentence moved instead.)
 */
export type ReviewAssignmentRefusalCode = ReviewAssignmentWriteRefusal | ReviewAssignmentRefusal;
/** A row of the ledger as the ports see it: the fields this module reads, with the payload left unknown. */
export interface ReviewAssignmentLedgerRow {
    readonly sequence: number;
    readonly rootSessionId: string;
    readonly factType: string;
    readonly payload: unknown;
}
/**
 * The row this module hands to `put`. `schemaVersion` is deliberately NOT here: it belongs to the storage schema,
 * which this lane does not import — the import-closure leg in `a6-pr2-lane-hygiene.test.ts` is the reason. The adapter that
 * satisfies this port is the place that knows the schema version, and it is exactly the kind of thin adapter the
 * `ArtifactLedgerPort` precedent puts at the composition root.
 */
export interface ReviewAssignmentRowDraft {
    readonly sequence: number;
    readonly rootSessionId: string;
    readonly factType: string;
    readonly payload: ReviewAssignmentPayload;
    readonly createdAt: string;
}
/** The write half. `allocateSequence` then `put`, in that order, because the ledger rejects an unallocated one. */
export interface ReviewAssignmentLedgerWriterPort {
    allocateSequence(): Promise<number>;
    put(row: ReviewAssignmentRowDraft): Promise<unknown>;
}
/**
 * The read half: the WHOLE ledger, in sequence order, unfiltered — the row-level filter is this module's job.
 *
 * **An unfiltered, un-truncated, non-stale read is part of this port's contract, and the writer cannot detect an
 * omission.** It re-reads inside the lock rather than trusting a cached view, and it refuses when a row it can
 * see does not reconcile; it has no way to notice a row it cannot see, because a fold over a shorter ledger is
 * just a fold over a shorter ledger. That is not a gap this module can close from its seat, so it is stated as
 * the adapter's obligation. Measured, not asserted: `a6-pri1a-writer.test.ts` drives a reader that drops one
 * row and pins what follows — the second create is accepted and the family ends up with two live rows in one
 * epoch, which is the epoch CAS failing to have anything to conflict with. A `slice`, a stale cache or a
 * filtered adapter behind this port is an adapter bug with that shape of consequence.
 */
export interface ReviewAssignmentLedgerReaderPort {
    list(): readonly ReviewAssignmentLedgerRow[];
}
/**
 * Per-root serialisation. `withLock` must be non-reentrant from this module's point of view: this writer holds it
 * exactly once per call and never calls back into itself.
 */
export interface ReviewAssignmentLockPort {
    withLock<T>(rootSessionId: string, critical: () => Promise<T>): Promise<T>;
}
/** Everything the writer needs. No optional port: an half-wired writer is the dormant half this lane forbids. */
export interface ReviewAssignmentStoreDeps {
    readonly ledger: ReviewAssignmentLedgerWriterPort & ReviewAssignmentLedgerReaderPort;
    readonly lock: ReviewAssignmentLockPort;
    /** The store's clock (ISO-8601). Precedent: `GovernanceProposalStoreDeps.now` — the durable stamp is the
     *  store's, not the caller's, so a caller cannot date its own fact. */
    readonly now: () => string;
}
/** The command shape. `kind` is the operation the caller decided; legality is decided by `checkAssignmentMutation`. */
export interface ReviewAssignmentCommand {
    readonly kind: ReviewAssignmentFactKind;
    readonly rootSessionId: string;
    readonly approvalCaseId: string;
    readonly currentLegRequestId: string;
    /** The target the row will name: the new handler for `created`/`transferred`, the outgoing one for `retired`. */
    readonly target: ReviewAssignmentTarget;
    readonly reasonCode: string;
    readonly basedOnCaseVersion: string;
    readonly actorCallerRef: string;
}
/** A durable write, or a faithful report of a replay that needed no write. */
export interface ReviewAssignmentWriteApplied {
    readonly ok: true;
    /** `'already'` is the idempotent-replay answer of D-4: this exact row is already durable at this sequence. */
    readonly applied: 'written' | 'already';
    readonly sequence: number;
    readonly factType: string;
    readonly assignmentEpoch: number;
    readonly payload: ReviewAssignmentPayload;
    /** The fold as it stands after the write, so the caller can act without a second read. */
    readonly state: ReviewAssignmentState;
}
export type ReviewAssignmentWriteResult = ReviewAssignmentWriteApplied | {
    readonly ok: false;
    readonly refusal: ReviewAssignmentRefusalCode;
    readonly detail: string;
};
/**
 * The one entry point: fold the family, decide legality, write, read back.
 *
 * Everything happens inside one `withLock` hold, and the fold is done FROM THE LEDGER inside that hold rather than
 * taken from a cache — the same discipline `loadControlState` uses (`control/service.ts:1766`: re-fold inside the
 * lock, never trust a cached view), and the reason the epoch CAS in A-2 means anything.
 */
export declare function applyReviewAssignment(deps: ReviewAssignmentStoreDeps, command: ReviewAssignmentCommand): Promise<ReviewAssignmentWriteResult>;
//# sourceMappingURL=writer.d.ts.map