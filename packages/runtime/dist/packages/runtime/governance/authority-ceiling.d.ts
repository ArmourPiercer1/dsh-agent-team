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
import type { AuthorityEnvelope, AuthorityResourceMatcher, EffectiveCeiling, SubtreeContains } from '../../domain/authority-envelope/src/index.js';
import type { ProposalAuthorityPosition } from './proposal-store.js';
/** The refusal vocabulary of this module — closed, and named rather than inline. */
export declare const AUTHORITY_CEILING_ERROR_CODES: Readonly<{
    /** The reviewer/document BINDING is defective: a position the table gives no
     *  documents to, or a value outside the closed position union. */
    readonly BINDING_DEFECT: "AUTHORITY_BINDING_DEFECT";
    /** A document this reviewer IS bound by could not be read. Named separately
     *  from a binding defect because the table is fine and the storage is not:
     *  PR2 maps this to the terminal `authority-unavailable` outcome — which ADR
     *  A1-7 keeps distinct from `authority-undetermined` and from `denied` — and
     *  never to an identity. See {@link AuthorityDocumentRead}. */
    readonly DOCUMENT_UNAVAILABLE: "AUTHORITY_CEILING_DOCUMENT_UNAVAILABLE";
}>;
/** One refusal code of this module. */
export type AuthorityCeilingErrorCode = (typeof AUTHORITY_CEILING_ERROR_CODES)[keyof typeof AUTHORITY_CEILING_ERROR_CODES];
/** What went wrong, for a caller that branches rather than string-matches. */
export type AuthorityBindingProblem = 
/** The position is not a reviewer position at all, so no document binds it
 *  and no ceiling exists for it. Spec §7.4:307 for Member; a value outside
 *  the closed union lands here too, loudly — see the note on the
 *  post-`switch` refusal in {@link bindingDocs}. */
'position-is-not-a-reviewer'
/** A bound document's read failed. The ceiling is UNKNOWN, not wide. */
 | 'document-read-unavailable';
/** The refusal raised by {@link bindingDocs} and {@link grantCeiling}. */
export declare class AuthorityBindingError extends Error {
    readonly code: AuthorityCeilingErrorCode;
    readonly problem: AuthorityBindingProblem;
    constructor(code: AuthorityCeilingErrorCode, problem: AuthorityBindingProblem, detail: string);
}
/**
 * The read outcome of one authority document, as the plane reports it
 * (`src/plugin/permission-plane.ts` exports {@link AuthorityHardCeilingRead} as
 * an alias of this type, so the reader's output can be handed to
 * {@link grantCeiling} with no unwrapping and no intermediate `undefined`).
 *
 * WHY A THREE-WAY OUTCOME AND NOT `AuthorityEnvelope | undefined`.
 * On the APPROVAL plane an absent document narrows NOTHING (ADR A1-4), and an
 * empty bound set meets to the IDENTITY — the widest answer the algebra can
 * give. So `undefined` is a channel that carries two opposite facts:
 *
 *     absent      → "this Team never declared a hard ceiling"  → identity is RIGHT
 *     read failed → "we cannot tell what the ceiling is"        → identity is WRONG
 *
 * A one-channel type makes the second case representable, and a consumer that
 * writes the natural `unavailable ? undefined : document` hands a Leader or a
 * Human User UNLIMITED approval authority on a storage fault — with every test
 * still green, because identity is the correct answer to the OTHER question.
 * This is the same failure class as the fused-lookup hole (X5-E3): the identity
 * is right, the ABSENCE CHANNEL is what leaks. `undefined` is therefore not a
 * member of this union, and the slot type below does not accept it.
 */
export type AuthorityDocumentRead = 
/** A document exists (possibly declaring `rules: []`, a legal v3 declaration
 *  that the Human User has no runtime expansion authority). */
{
    readonly status: 'declared';
    readonly document: AuthorityEnvelope;
}
/** The bound Blueprint does not carry the field — the v1/v2 case through the
 *  bridge (ADR A2-4/A2-11). Stated, never defaulted. */
 | {
    readonly status: 'absent';
}
/** Unknown: the binding drifted, the read faulted, or the provider answered
 *  with nothing. A consumer must fail closed; it may not fall back. */
 | {
    readonly status: 'unavailable';
};
/**
 * One document slot of {@link AuthorityEnvelopeDocuments}: either the canonical
 * document itself (the shorthand a caller holding a document uses), or the
 * reader's outcome. NOT `undefined` — which is the point of the type.
 */
export type AuthorityDocumentSlot = AuthorityEnvelope | AuthorityDocumentRead;
/**
 * The two authority documents a Team declares, in their canonical RUNTIME shape
 * (already canonicalized by `src/plugin/permission-plane.ts`, never here).
 *
 * BOTH SLOTS ARE REQUIRED, and each one is a three-way outcome rather than an
 * optional document, because the dangerous move is the silent one: with
 * `?: AuthorityEnvelope` a caller could write `{ teamHardEnvelope: undefined }`
 * for a faulted read and get the identity. Here it must write one of
 * `{ status: 'absent' }` / `{ status: 'unavailable' }` / the document, so the
 * distinction survives to {@link bindingDocs} — which refuses on `unavailable`
 * instead of narrowing it away. `a4p1-authority-envelope.test.ts` pins both
 * halves: that `undefined` is not assignable, and that an `unavailable` slot
 * never yields a ceiling.
 */
export interface AuthorityEnvelopeDocuments {
    /** The Human User hard ceiling. v3-only, required at v3 (spec §3.2). */
    readonly teamHardEnvelope: AuthorityDocumentSlot;
    /** The Leader expansion ceiling. Optional in the DOCUMENT, required in the
     *  SLOT: a v1/v2 Team states `{ status: 'absent' }` (ADR A1-19). */
    readonly permissionMutationEnvelope: AuthorityDocumentSlot;
}
/**
 * Which documents bind one reviewer position (spec §7.4:300-302, ADR A5-1).
 *
 * Order is fixed (hard ceiling first) so the returned set is deterministic even
 * though `meet` is commutative — a governance read that varies between calls is
 * indistinguishable from one that drifts.
 */
export declare function bindingDocs(reviewer: ProposalAuthorityPosition, documents: AuthorityEnvelopeDocuments): readonly AuthorityEnvelope[];
/** The scope a ceiling is asked about. */
export interface AuthorityCeilingScope {
    readonly operationClass: string;
    readonly matcher: AuthorityResourceMatcher;
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
export declare function grantCeiling(reviewer: ProposalAuthorityPosition, documents: AuthorityEnvelopeDocuments, scope: AuthorityCeilingScope, subtreeContains?: SubtreeContains): EffectiveCeiling;
//# sourceMappingURL=authority-ceiling.d.ts.map