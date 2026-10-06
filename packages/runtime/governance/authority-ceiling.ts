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

import {
  CEILING_IDENTITY,
  CEILING_NO_AUTHORITY,
  effectiveAuthorityCeiling,
  meetAllAuthorityCeilings,
  narrowingForApproval,
} from '../../domain/authority-envelope/src/index.js'
import type {
  AuthorityEnvelope,
  AuthorityResourceMatcher,
  EffectiveCeiling,
  SubtreeContains,
} from '../../domain/authority-envelope/src/index.js'
// TYPE-ONLY on purpose (correction X5-E1, ADR A1-1): the durable position union
// is PR0's frozen vocabulary (`proposal-store.ts:150-151`), and reaching it as a
// type means this module gains the VOCABULARY without gaining an edge to the
// proposal write path or its storage import edge (the one the lane allow-list at
// `a3p3-governance-lane-hygiene.test.ts:351-358` had to name). A caller cannot
// smuggle a payload string into a parameter of this type.
import type { ProposalAuthorityPosition } from './proposal-store.js'

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
} as const)

/** One refusal code of this module. */
export type AuthorityCeilingErrorCode =
  (typeof AUTHORITY_CEILING_ERROR_CODES)[keyof typeof AUTHORITY_CEILING_ERROR_CODES]

/** What went wrong, for a caller that branches rather than string-matches. */
export type AuthorityBindingProblem =
  /** The position is not a reviewer position at all, so no document binds it
   *  and no ceiling exists for it. Spec §7.4:307 for Member; a value outside
   *  the closed union lands here too, loudly — see the note on the
   *  post-`switch` refusal in {@link bindingDocs}. */
  | 'position-is-not-a-reviewer'
  /** A bound document's read failed. The ceiling is UNKNOWN, not wide. */
  | 'document-read-unavailable'
  /** A slot was handed to the adapter that is not a slot at all — `undefined`,
   *  `null`, a non-object. A caller defect, and it must arrive as a CODE: a bare
   *  `TypeError` from `'rules' in slot` has `code === undefined`, which PR2's
   *  code-based outcome mapping reads as "not one of mine" and rethrows out of
   *  the governance path. */
  | 'document-slot-missing'
  /** A slot object whose `status` is outside the closed three-member union — a
   *  value that escaped the compiler. Its ceiling is unknown, so it is reported
   *  with the unavailable code, never as `absent`. */
  | 'document-slot-unrecognized-status'
  /** A position value that the closed ladder gives no rank to — `undefined`, a
   *  string from JSON, a position a later Alpha renames. Ranked as a DEFECT, not
   *  as "rank 0" and not as "no rank, therefore not higher": `undefined > 0` is
   *  `false`, which is indistinguishable from an ordinary refusal, and the whole
   *  point of PR2's ladder is that "we do not know who this is" and "this
   *  reviewer may not act" are DIFFERENT facts with different consequences. */
  | 'position-outside-closed-ladder'
  /** A Human Admin ASK: the ladder has no rung above the top, and no position may
   *  approve its own elevation, so no candidate reviewer exists to evaluate. A
   *  defective INPUT rather than an outcome — every arm of spec §7.3 presupposes
   *  someone who could sign. Unreachable in Alpha.4, which ships no Human Admin
   *  constructor (ADR A1-3). */
  | 'ask-has-no-upper-rung'
  /** The evaluator walked the whole closed ladder and nothing reached the effect.
   *  Impossible while the top rung binds no document (its ceiling is the identity,
   *  which reaches everything), so reaching it means the ladder was edited under
   *  the evaluator — and the alternative it replaces is inventing a fifth rung. */
  | 'no-rung-reached-effect'

/** The refusal raised by {@link bindingDocs} and {@link grantCeiling}. */
export class AuthorityBindingError extends Error {
  readonly code: AuthorityCeilingErrorCode
  readonly problem: AuthorityBindingProblem

  constructor(
    code: AuthorityCeilingErrorCode,
    problem: AuthorityBindingProblem,
    detail: string,
  ) {
    super(`authority ceiling refusal (${code} / ${problem}): ${detail}`)
    this.name = 'AuthorityBindingError'
    this.code = code
    this.problem = problem
  }
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
  | { readonly status: 'declared'; readonly document: AuthorityEnvelope }
  /** The bound Blueprint does not carry the field — the v1/v2 case through the
   *  bridge (ADR A2-4/A2-11). Stated, never defaulted. */
  | { readonly status: 'absent' }
  /** Unknown: the binding drifted, the read faulted, or the provider answered
   *  with nothing. A consumer must fail closed; it may not fall back. */
  | { readonly status: 'unavailable' }

/**
 * One document slot of {@link AuthorityEnvelopeDocuments}: either the canonical
 * document itself (the shorthand a caller holding a document uses), or the
 * reader's outcome. NOT `undefined` — which is the point of the type.
 */
export type AuthorityDocumentSlot = AuthorityEnvelope | AuthorityDocumentRead

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
  readonly teamHardEnvelope: AuthorityDocumentSlot
  /** The Leader expansion ceiling. Optional in the DOCUMENT, required in the
   *  SLOT: a v1/v2 Team states `{ status: 'absent' }` (ADR A1-19). */
  readonly permissionMutationEnvelope: AuthorityDocumentSlot
}

/** One slot, resolved. `unavailable` is never folded into `absent`. */
type ResolvedSlot =
  | { readonly present: true; readonly document: AuthorityEnvelope }
  | { readonly present: false; readonly reason: 'absent' | 'unavailable' }

function resolveSlot(
  name: AuthorityDocumentName,
  slot: AuthorityDocumentSlot,
): ResolvedSlot {
  // A slot that is not a slot. Without this line the check below is
  // `TypeError: Cannot use 'in' operator`, an error with NO `code`, and the
  // caller's `code`-based mapping treats it as an unrelated fault instead of a
  // refusal. `undefined` is not in the SLOT TYPE (that is SF1), so this arm
  // exists only for a value that arrived from JSON or a cast — which is exactly
  // where the compiler has already stopped helping.
  if (slot === undefined || slot === null || typeof slot !== 'object') {
    throw new AuthorityBindingError(
      AUTHORITY_CEILING_ERROR_CODES.BINDING_DEFECT,
      'document-slot-missing',
      `${name} was not given a document or a read outcome (received ${String(slot)}); absence is { status: 'absent' }, and neither fact may be spelled by omission`,
    )
  }
  if ('rules' in slot) return { present: true, document: slot }
  switch (slot.status) {
    case 'declared':
      return { present: true, document: slot.document }
    case 'absent':
    case 'unavailable':
      return { present: false, reason: slot.status }
  }
  // NO FALL-THROUGH PAST THIS POINT — and this is the B1 bug one level up. The
  // first draft ENDED with `return { present: false, reason: slot.status }`, so
  // an unrecognized status was typed away but at runtime produced
  // `reason: undefined`, which `boundDocument` counts as absent: a document that
  // nobody can interpret contributes NOTHING, and an empty bound set meets to
  // `CEILING_IDENTITY`. A malformed or future-versioned slot would therefore
  // WIDEN authority — unlimited reach for whoever's document failed to parse.
  // Refuse instead; `a4p1-authority-envelope.test.ts` exercises this arm.
  throw new AuthorityBindingError(
    AUTHORITY_CEILING_ERROR_CODES.DOCUMENT_UNAVAILABLE,
    'document-slot-unrecognized-status',
    `${name} carried an unrecognized status ${String((slot as { status?: unknown }).status)}; an uninterpretable document is UNKNOWN, and unknown is never absent`,
  )
}

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
function boundDocument(
  name: AuthorityDocumentName,
  slot: AuthorityDocumentSlot,
): AuthorityEnvelope | undefined {
  const resolved = resolveSlot(name, slot)
  if (resolved.present) return resolved.document
  if (resolved.reason === 'unavailable') {
    throw new AuthorityBindingError(
      AUTHORITY_CEILING_ERROR_CODES.DOCUMENT_UNAVAILABLE,
      'document-read-unavailable',
      `${name} could not be read, so the ceiling is unknown — and unknown must not be answered with the identity, which is the WIDEST ceiling the algebra can produce`,
    )
  }
  return undefined
}

/**
 * THE positional document table: which named document binds which position
 * (spec §7.4:300-302, ADR A5-1). ONE table, read by both ceiling families.
 *
 * It is a table of NAMES rather than of resolved documents because the two
 * planes read an ABSENT document in opposite ways — the approval plane skips it
 * (no rule contributes no narrowing), the expansion plane reads it as
 * NO-AUTHORITY (an undeclared ceiling authorizes nothing) — and two independently
 * written tables would drift the moment one row is edited. The row order is fixed
 * (hard ceiling first) so the resolved set is deterministic even though `meet` is
 * commutative: a governance read that varies between calls is indistinguishable
 * from one that drifts.
 */
const BOUND_AUTHORITY_DOCUMENTS: Readonly<
  Record<ProposalAuthorityPosition, readonly AuthorityDocumentName[]>
> = Object.freeze({
  // Not a reviewer at all (spec §7.4:307). An EMPTY row here would be the silent
  // version of a fourth ceiling, so the two readers below refuse on this row
  // rather than meeting over nothing — an empty meet is the IDENTITY, which is
  // the WIDEST ceiling the algebra has.
  member: Object.freeze([]),
  // Capped by BOTH. The Leader wrote the mutation envelope, so binding it to
  // only its own document would be self-approval by construction; the hard
  // ceiling is the Human User's restriction on it (round-2 F-N1).
  leader: Object.freeze(['teamHardEnvelope', 'permissionMutationEnvelope'] as const),
  // The mutation envelope does NOT bind a Human User: it is the Leader's ceiling,
  // and reading it here would let a document the Leader wrote cap the reviewer
  // who exists to overrule that Leader.
  'human-user': Object.freeze(['teamHardEnvelope'] as const),
  // Spec §7.4:302 — `{ }`, "top of ladder; no envelope binds it".
  'human-admin': Object.freeze([]),
})

/**
 * The NAMES of the documents that bind one position; refuses for a Member.
 *
 * Exported for the evaluator's evidence: a caller auditing WHY a Human User was
 * not capped by the mutation envelope needs the row itself, not a reconstructed
 * guess at it. Refuses exactly as {@link bindingDocs} does, so there is one
 * refusal vocabulary for the table.
 */
export function boundDocumentNames(reviewer: ProposalAuthorityPosition): readonly AuthorityDocumentName[] {
  // REACHED, AND ENFORCED. While `ProposalAuthorityPosition` is the closed
  // four-member union this check is a compile-time impossibility for typed
  // callers — but the position arrives from a PROPOSAL ROW and from caller-side
  // casts, and a string that is not in the union walks straight in here at
  // runtime. It must refuse. The alternative it replaces is the silent one: a
  // `return []` for an unknown position routes to `grantCeiling`'s empty-set
  // branch and yields `CEILING_IDENTITY`, i.e. UNLIMITED approval reach for a
  // principal the table never heard of — reached exactly the way invariant #16
  // worries about, by a cast payload, with the whole suite green.
  // `a4p1-authority-envelope.test.ts:496-515` therefore pins this refusal by
  // CALLING it (a bogus position throws), not by trusting the types; and there is
  // no implicit fallback, because a fallback answers the question it was never
  // given instead of refusing it (ADR A1-2).
  if (typeof reviewer !== 'string' || !Object.hasOwn(BOUND_AUTHORITY_DOCUMENTS, reviewer)) {
    throw new AuthorityBindingError(
      AUTHORITY_CEILING_ERROR_CODES.BINDING_DEFECT,
      'position-is-not-a-reviewer',
      `reviewer position ${String(reviewer)} has no written binding arm`,
    )
  }
  const names = BOUND_AUTHORITY_DOCUMENTS[reviewer]
  if (names.length === 0 && reviewer !== 'human-admin') {
    // Spec §7.4:307 — "a Member cannot review at all". Refusing is the only
    // honest arm: returning a document set would create a ceiling for a reviewer
    // that must not exist, and a later PR would consult it as if the table had
    // authorized it. Only Human Admin is TABLE-AUTHORIZED to bind nothing.
    // Restriction-preserving is NOT a licence to invent a row.
    throw new AuthorityBindingError(
      AUTHORITY_CEILING_ERROR_CODES.BINDING_DEFECT,
      'position-is-not-a-reviewer',
      'a Member is not a reviewer position, so no authority document binds it',
    )
  }
  return names
}

/**
 * Which documents bind one reviewer position (spec §7.4:300-302, ADR A5-1).
 *
 * APPROVAL-plane reading: an ABSENT document is skipped, because on this plane a
 * missing rule imposes no narrowing and the identity is the correct contribution.
 * The expansion-plane reading of the same row is {@link expansionCeiling}.
 */
export function bindingDocs(
  reviewer: ProposalAuthorityPosition,
  documents: AuthorityEnvelopeDocuments,
): readonly AuthorityEnvelope[] {
  const bound: AuthorityEnvelope[] = []
  for (const name of boundDocumentNames(reviewer) as readonly AuthorityDocumentName[]) {
    const resolved = boundDocument(name, documents[name])
    if (resolved !== undefined) bound.push(resolved)
  }
  return bound
}

/**
 * The EXPANSION-plane ceiling of one position: meet of
 * `effectiveAuthorityCeiling` over the documents that bind it (ADR A1-4's
 * expansion reading, spec §7.4; pinned by `a4p2-ceiling-reachability.test.ts`).
 *
 * WHY THIS IS NOT `grantCeiling` WITH THE OTHER LOOKUP SWAPPED IN. The two planes
 * disagree about ABSENCE, and only here does that difference decide anything: a v3
 * Team whose `teamHardEnvelope` declares no rule for this scope authorizes NO
 * expansion (`no-authority`), where the same document imposes no narrowing when a
 * Human User approves. Computing one and handing it to the other caller is the
 * mistake correction X7-R5 rules out in both directions — it dead-locks every
 * Leader approval on `{ rules: [] }`, and it authorizes a Leader expansion no
 * document ever granted.
 *
 * An ABSENT bound document therefore contributes `CEILING_NO_AUTHORITY` rather
 * than being skipped, and an `unavailable` one refuses with
 * `AUTHORITY_CEILING_DOCUMENT_UNAVAILABLE` exactly as on the approval plane.
 * Human Admin binds nothing, so its expansion ceiling is the identity — the
 * ladder's own reach, unmodified.
 */
export function expansionCeiling(
  position: ProposalAuthorityPosition,
  documents: AuthorityEnvelopeDocuments,
  scope: AuthorityCeilingScope,
  subtreeContains?: SubtreeContains,
): EffectiveCeiling {
  const names = boundDocumentNames(position) as readonly AuthorityDocumentName[]
  if (names.length === 0) return CEILING_IDENTITY
  const ceilings: EffectiveCeiling[] = []
  for (const name of names) {
    const resolved = resolveSlot(name, documents[name])
    if (!resolved.present) {
      if (resolved.reason === 'unavailable') {
        throw new AuthorityBindingError(
          AUTHORITY_CEILING_ERROR_CODES.DOCUMENT_UNAVAILABLE,
          'document-read-unavailable',
          `${name} could not be read, so the expansion ceiling is unknown and unknown never authorizes an expansion`,
        )
      }
      // `absent` on THIS plane is not "no restriction". It is the absence of a
      // grant, which the expansion plane spells `no-authority`.
      ceilings.push(CEILING_NO_AUTHORITY)
      continue
    }
    // NOTE the FLAT argument shape: the domain's expansion lookup takes
    // `(envelope, operationClass, matcher)` while its approval lookup takes
    // `(document, scope)`. Passing `scope` here is a compile error rather than a
    // silent wrong-plane call, which is the good kind of asymmetry.
    ceilings.push(effectiveAuthorityCeiling(resolved.document, scope.operationClass, scope.matcher, subtreeContains))
  }
  return meetAllAuthorityCeilings(ceilings)
}

/** The refusal for a value the closed ladder gives no rank to. */
function outsideLadder(caller: string, value: unknown): AuthorityBindingError {
  return new AuthorityBindingError(
    AUTHORITY_CEILING_ERROR_CODES.BINDING_DEFECT,
    'position-outside-closed-ladder',
    `${caller}: ${JSON.stringify(value) ?? String(value)} is outside the closed authority ladder member < leader < human-user < human-admin, so it has no rank`,
  )
}

/**
 * THE RUNTIME AUTHORITY LADDER, as a rank per position (plan Task 2 Produces:
 * `authorityRank()`, added HERE because X5-E1 moved `mayReview` into this module
 * and a `mayReview` with no rank cannot answer anything).
 *
 * An exhaustive `Record` over PR0's union, NOT a local array: `satisfies
 * Record<ProposalAuthorityPosition, number>` is a COMPLETENESS check on an object
 * literal (drop a key and it is a compile error), which is precisely the check
 * `as const satisfies readonly ProposalAuthorityPosition[]` on an array does NOT
 * give — a three-element array passes it and silently creates a second, shorter
 * ordering with no rank for the position it dropped (correction X7-R3, fake-mode
 * #3). The ladder VALUES live in `proposal-store.ts:148`; only the ORDER lives
 * here, and `a4p2-authority-ceiling.test.ts` pins the two against each other in
 * both directions.
 */
export const AUTHORITY_RANK = {
  member: 0,
  leader: 1,
  'human-user': 2,
  'human-admin': 3,
} as const satisfies Record<ProposalAuthorityPosition, number>

/**
 * The rank of one authority position (plan Task 2 Produces).
 *
 * The post-index refusal is not decoration: an index into `AUTHORITY_RANK` is
 * `undefined` for anything the type did not admit, and `undefined` POISONs every
 * comparison below it into `false`. A `false` from `mayReview` reads as an
 * ordinary refusal, so a proposal row naming a renamed position would look like
 * "this reviewer may not act" when the truth is "we do not know who this is" —
 * the same fact/consequence split `AuthorityDocumentRead` draws for documents.
 */
export function authorityRank(position: ProposalAuthorityPosition): number {
  if (typeof position !== 'string' || !Object.hasOwn(AUTHORITY_RANK, position)) {
    throw outsideLadder('authorityRank', position)
  }
  return AUTHORITY_RANK[position as ProposalAuthorityPosition]
}

/**
 * Is `left` strictly higher than `right` on the ladder? (plan Task 2 Produces.)
 *
 * A comparison, not a policy: it answers nothing about documents. Equal ranks are
 * NOT higher — that is what makes same-level approval impossible everywhere it is
 * derived.
 */
export function isHigherAuthority(left: ProposalAuthorityPosition, right: ProposalAuthorityPosition): boolean {
  return authorityRank(left) > authorityRank(right)
}

/**
 * WHO MAY ACT (spec §7.4:299, ADR A3-2) — one of the two functions that are
 * never combined into one `min()`.
 *
 *     mayReview(reviewer, beneficiary, requiredAuthority)
 *
 * The shape is FLAT with THREE REQUIRED PARAMETERS by ruling X7-R2: PR3 owns the
 * `ApprovalCase` shape whose legs carry `reviewAuthority` /
 * `beneficiaryAuthority` / `requiredAuthorityAtCreation` and map onto these three
 * 1:1, so inventing a case type here would put a durable shape in a PR that does
 * not own it — and a defaulted or optional `requiredAuthority` is SILENTLY
 * PERMISSIVE, since the caller that forgets the third argument gets "any reviewer
 * above the beneficiary may sign it" with no compile error and no red test.
 *
 * Two conditions, both necessary:
 *  1. STRICTLY above the beneficiary — self-approval and same-level approval are
 *     never legal (spec §7.4:309, ADR §11);
 *  2. at or above the case's required authority — the ladder rung the evaluator
 *     computed, which is where a CEILING can raise the bar but never lower it.
 *
 * It consults NO document. Whether what they may sign reaches the desired effect
 * is {@link grantCeiling}'s question, and fusing the two is the error spec §7.4
 * opens by naming them "two independent functions": a rank and a ceiling are
 * different types answering different questions.
 */
export function mayReview(
  reviewer: ProposalAuthorityPosition,
  beneficiary: ProposalAuthorityPosition,
  requiredAuthority: ProposalAuthorityPosition,
): boolean {
  const reviewerRank = authorityRank(reviewer)
  const beneficiaryRank = authorityRank(beneficiary)
  const requiredRank = authorityRank(requiredAuthority)
  return reviewerRank > beneficiaryRank && reviewerRank >= requiredRank
}

/** The two authority documents a position can be bound by (spec §7.4:300-302). */
export type AuthorityDocumentName = 'teamHardEnvelope' | 'permissionMutationEnvelope'

/** The scope a ceiling is asked about. */
export interface AuthorityCeilingScope {
  readonly operationClass: string
  readonly matcher: AuthorityResourceMatcher
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
export function grantCeiling(
  reviewer: ProposalAuthorityPosition,
  documents: AuthorityEnvelopeDocuments,
  scope: AuthorityCeilingScope,
  subtreeContains?: SubtreeContains,
): EffectiveCeiling {
  const bound = bindingDocs(reviewer, documents)
  if (bound.length === 0) return CEILING_IDENTITY
  return meetAllAuthorityCeilings(bound.map((document) => narrowingForApproval(document, scope, subtreeContains)))
}
