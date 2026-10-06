/**
 * The approval-plane ceiling: WHICH documents bind a reviewer, and how far that
 * reviewer may approve one scope (spec §7.4, ADR A5-1/A5-2/A3-1/A3-2; plan
 * Task 1 lane C).
 *
 * ---------------------------------------------------------------------------
 * Two functions, never one `min()` (ADR A3-2, spec §7.4:296-305)
 * ---------------------------------------------------------------------------
 *
 *     mayReview(reviewer, case)        who may act      (ladder × case.requiredAuthority)
 *     bindingDocs(reviewer)            which documents bind this reviewer
 *     grantCeiling(reviewer, scope)    how far they may approve  = meet over
 *                                      { narrowing(d, scope) | d ∈ bindingDocs(reviewer) }
 *     legal approval  <=>  mayReview(...) AND desiredEffect <= grantCeiling(...)
 *
 * Ladder position and ceiling reach are DIFFERENT TYPES: a rank answers "am I
 * the one who acts", a ceiling answers "what may I sign". `mayReview` is
 * deliberately ABSENT from this module — it consumes `case.requiredAuthority`
 * and leg data that do not exist until PR2/PR4, and writing it now would mean
 * inventing a case shape or faking a parameter to compare against (execution-
 * round correction X5-E1). What lands in PR1 is the half whose inputs already
 * exist, plus the lattice it needs.
 *
 * ---------------------------------------------------------------------------
 * Why `bindingDocs` is a closed table with an explicit arm per position
 * ---------------------------------------------------------------------------
 *
 * ADR A5-1: which documents bind is a function of the reviewer's LADDER
 * POSITION only — never of the beneficiary, the carrier, or the request kind.
 * A closed-set table with an implicit fallback branch is forbidden outright
 * (ADR A1-2, invariant #16), and the precedent it cites is real: a fallback in
 * this repository once handed every caller operator identity. So:
 *
 *   leader      both documents   (the Leader is capped by its own ceiling AND
 *                                 the Team Hard one — the round-2 F-N1 hole)
 *   human-user  hard only        (the mutation envelope does not bind a Human
 *                                 User — spec §7.4.1's positional-binding test)
 *   human-admin NONE             (top of ladder; spec §7.4:302 `bindingDocs = {}`)
 *   member      REFUSED          (spec §7.4:307 "a Member cannot review at all":
 *                                 there is no document set to hand out, so this
 *                                 arm throws instead of inventing a fourth row
 *                                 or inheriting the Leader's)
 *
 * Both documents are evaluated on EVERY approval in PR2's wiring, including a
 * Member ask that a Human User settles (ADR A3-1). PR1 supplies the evaluator;
 * PR2 owns the call site that runs it.
 *
 * @module @dsh-agent-team/runtime/governance/authority-ceiling
 */
import { CEILING_IDENTITY, meetAllAuthorityCeilings, narrowingForApproval, } from '../../domain/authority-envelope/src/index.js';
/** The refusal vocabulary of this module — closed, and named rather than inline. */
export const AUTHORITY_CEILING_ERROR_CODES = Object.freeze({
    /** The reviewer/document BINDING is defective: a position the table gives no
     *  documents to, or a value outside the closed position union. */
    BINDING_DEFECT: 'AUTHORITY_BINDING_DEFECT',
    /** A document this reviewer IS bound by could not be read. Named separately
     *  from a binding defect because the table is fine and the storage is not:
     *  PR2 maps this to the terminal `authority-unavailable` outcome — which ADR
     *  A1-7 keeps distinct from `authority-undetermined` and from `denied` — and
     *  never to an identity. See {@link AuthorityDocumentRead}. */
    DOCUMENT_UNAVAILABLE: 'AUTHORITY_CEILING_DOCUMENT_UNAVAILABLE',
});
/** The refusal raised by {@link bindingDocs} and {@link grantCeiling}. */
export class AuthorityBindingError extends Error {
    code;
    problem;
    constructor(code, problem, detail) {
        super(`authority ceiling refusal (${code} / ${problem}): ${detail}`);
        this.name = 'AuthorityBindingError';
        this.code = code;
        this.problem = problem;
    }
}
function resolveSlot(slot) {
    if ('rules' in slot)
        return { present: true, document: slot };
    if (slot.status === 'declared')
        return { present: true, document: slot.document };
    return { present: false, reason: slot.status };
}
/**
 * Which documents bind one reviewer position (spec §7.4:300-302, ADR A5-1).
 *
 * Order is fixed (hard ceiling first) so the returned set is deterministic even
 * though `meet` is commutative — a governance read that varies between calls is
 * indistinguishable from one that drifts.
 */
/**
 * Resolve one slot a position IS bound by.
 *
 * `absent` contributes nothing; `unavailable` REFUSES. Refusal — not a ceiling
 * value — is deliberate: `EffectiveCeiling` has no `unavailable` status (its
 * statuses are `decided | no-authority | undetermined`, spec §24.2), and
 * inventing one here would collapse ADR A1-7's carefully separated
 * `authority-unavailable` into `authority-undetermined`. The caller that owns
 * the outcome maps THIS code to the terminal outcome; anything that catches it
 * and continues has made a decision the documents did not authorize.
 */
function boundDocument(name, slot) {
    const resolved = resolveSlot(slot);
    if (resolved.present)
        return resolved.document;
    if (resolved.reason === 'unavailable') {
        throw new AuthorityBindingError(AUTHORITY_CEILING_ERROR_CODES.DOCUMENT_UNAVAILABLE, 'document-read-unavailable', `${name} could not be read, so the ceiling is unknown — and unknown must not be answered with the identity, which is the WIDEST ceiling the algebra can produce`);
    }
    return undefined;
}
/**
 * Which documents bind one reviewer position (spec §7.4:300-302, ADR A5-1).
 *
 * Order is fixed (hard ceiling first) so the returned set is deterministic even
 * though `meet` is commutative — a governance read that varies between calls is
 * indistinguishable from one that drifts.
 */
export function bindingDocs(reviewer, documents) {
    switch (reviewer) {
        case 'leader': {
            // Capped by BOTH. The Leader wrote the mutation envelope, so binding it
            // to only its own document would be self-approval by construction; the
            // hard ceiling is the Human User's restriction on it (round-2 F-N1).
            const bound = [];
            const hard = boundDocument('teamHardEnvelope', documents.teamHardEnvelope);
            if (hard !== undefined)
                bound.push(hard);
            const mutation = boundDocument('permissionMutationEnvelope', documents.permissionMutationEnvelope);
            if (mutation !== undefined)
                bound.push(mutation);
            return bound;
        }
        case 'human-user': {
            // The mutation envelope does NOT bind a Human User: it is the Leader's
            // ceiling, and reading it here would let a document the Leader wrote cap
            // the reviewer who exists to overrule that Leader.
            const hard = boundDocument('teamHardEnvelope', documents.teamHardEnvelope);
            return hard === undefined ? [] : [hard];
        }
        case 'human-admin': {
            // Spec §7.4:302 — `{ }`, "top of ladder; no envelope binds it". The empty
            // set is meaningful, not incidental: `meetAllAuthorityCeilings([])` is the
            // identity, so Human Admin reach is the ladder's, unmodified. Note that
            // the slots are NOT resolved here: a document that binds nobody cannot
            // refuse, so a faulted hard-ceiling read does not narrow a Human Admin
            // either. That is the spec's row, not an oversight — and it is why this
            // arm returns rather than falls through.
            return [];
        }
        case 'member': {
            // Spec §7.4:307 — "a Member cannot review at all". Refusing is the only
            // honest arm: returning a document set would create a ceiling for a
            // reviewer that must not exist, and a later PR would consult it as if the
            // table had authorized it. Restriction-preserving is NOT a licence to
            // invent a row.
            throw new AuthorityBindingError(AUTHORITY_CEILING_ERROR_CODES.BINDING_DEFECT, 'position-is-not-a-reviewer', 'a Member is not a reviewer position, so no authority document binds it');
        }
    }
    // REACHED, AND ENFORCED. While `ProposalAuthorityPosition` is the closed
    // four-member union this line is a compile-time impossibility for typed
    // callers — but the position arrives from a PROPOSAL ROW and from caller-side
    // casts, and a string that is not in the union walks straight down here at
    // runtime. It must refuse. The alternative it replaces is the silent one: a
    // `return []` here routes to `grantCeiling`'s empty-set branch and yields
    // `CEILING_IDENTITY`, i.e. UNLIMITED approval reach for a principal the table
    // never heard of — reached exactly the way invariant #16 worries about, by a
    // cast payload, with the whole suite green. `a4p1-authority-envelope.test.ts`
    // therefore pins this refusal by calling it (a bogus position throws), not by
    // trusting the types; and there is no `default` arm above, because an implicit
    // fallback branch is what ADR A1-2 forbids — a fallback answers the question
    // it was never given instead of refusing it.
    throw new AuthorityBindingError(AUTHORITY_CEILING_ERROR_CODES.BINDING_DEFECT, 'position-is-not-a-reviewer', `reviewer position ${String(reviewer)} has no written binding arm`);
}
/**
 * How far one reviewer may approve one scope (spec §7.4:303): the `meet` over
 * the APPROVAL narrowing of each document that binds them.
 *
 * `narrowingForApproval` — never `effectiveAuthorityCeiling` — is the lookup
 * this composes (ADR A1-4). That choice is the whole dead-lock avoidance: an
 * absent rule contributes the identity, so a Team whose hard ceiling is the
 * documented `{ rules: [] }` narrows nothing, and a Leader whose mutation
 * envelope matches the scope at `allow` keeps `allow`. Had the expansion lookup
 * been folded in, `no-authority` would have absorbed the meet (spec §24.2) and
 * every Leader approval in such a Team would have been impossible — the
 * alternative ADR A1-4 records as explicitly rejected, and the reason
 * `a4p1-authority-envelope.test.ts` opens with that exact case.
 *
 * An undetermined narrowing ABSORBS the whole result (ADR A1-6/A5-2): a
 * reviewer's approvable set is never computed from a partially-evaluated
 * document, and the caller's terminal outcome is `authority-undetermined`,
 * which must not carry `requiredAuthority` and must not mint an admin case
 * (ADR A1-7).
 *
 * TWO THINGS THIS FUNCTION DELIBERATELY DOES NOT DO, both for PR2 to own:
 *  - it does not consult `mayReview`. An approval is legal iff
 *    `mayReview(...) AND desiredEffect <= grantCeiling(...)` (ADR A3-2); the
 *    ceiling half is here, the ladder half needs PR2's `authorityRank` and
 *    PR3's case shape (X5-E1).
 *  - it does not narrow a reviewer whose bound documents are all ABSENT. That
 *    is the identity, and it is correct ON THIS PLANE — a v1/v2 Team declared
 *    no hard ceiling. The same v1/v2 Team is capped to ZERO authority on the
 *    expansion plane (`effectiveAuthorityCeiling` reads the absence as
 *    `no-authority`), so a pre-v3 Leader may approve within the ladder and
 *    still expand nothing. Reading only this ceiling and concluding "the Leader
 *    may expand" is the one way to reintroduce the fused-lookup hole from the
 *    other direction.
 */
export function grantCeiling(reviewer, documents, scope, subtreeContains) {
    const bound = bindingDocs(reviewer, documents);
    if (bound.length === 0)
        return CEILING_IDENTITY;
    return meetAllAuthorityCeilings(bound.map((document) => narrowingForApproval(document, scope, subtreeContains)));
}
//# sourceMappingURL=authority-ceiling.js.map