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
  BINDING_DEFECT: 'AUTHORITY_BINDING_DEFECT',
} as const)

/** A defect in the reviewer/document binding itself, never a policy answer. */
export type AuthorityBindingProblem =
  /** The position is not a reviewer position at all, so no document binds it
   *  and no ceiling exists for it. Spec §7.4:307 for Member; a widening of the
   *  union without a written arm lands here too, loudly. */
  | 'position-is-not-a-reviewer'

/** The refusal raised by {@link bindingDocs}. */
export class AuthorityBindingError extends Error {
  readonly code: string = AUTHORITY_CEILING_ERROR_CODES.BINDING_DEFECT
  readonly problem: AuthorityBindingProblem

  constructor(problem: AuthorityBindingProblem, detail: string) {
    super(`authority binding defect (${problem}): ${detail}`)
    this.name = 'AuthorityBindingError'
    this.problem = problem
  }
}

/**
 * The two authority documents a Team declares, in their canonical RUNTIME shape
 * (already canonicalized by `src/plugin/permission-plane.ts`, never here).
 *
 * Both are OPTIONAL at this layer for the PR1-PR6 bridge: a v1/v2 blueprint
 * carries no hard ceiling at all, and the absence is a typed `undefined`, not
 * an empty document (ADR A2-4/A2-11). A reader that substituted
 * `{ rules: [] }` for "this document does not exist" would change the answer on
 * the EXPANSION plane — where `rules: []` means "expand nothing" — which is why
 * the distinction is carried in the type rather than normalized away.
 */
export interface AuthorityEnvelopeDocuments {
  /** The Human User hard ceiling. v3-only, required at v3 (spec §3.2). */
  readonly teamHardEnvelope?: AuthorityEnvelope | undefined
  /** The Leader expansion ceiling. Optional through the bridge (ADR A1-19). */
  readonly permissionMutationEnvelope?: AuthorityEnvelope | undefined
}

/**
 * Which documents bind one reviewer position (spec §7.4:300-302, ADR A5-1).
 *
 * Order is fixed (hard ceiling first) so the returned set is deterministic even
 * though `meet` is commutative — a governance read that varies between calls is
 * indistinguishable from one that drifts.
 */
export function bindingDocs(
  reviewer: ProposalAuthorityPosition,
  documents: AuthorityEnvelopeDocuments,
): readonly AuthorityEnvelope[] {
  switch (reviewer) {
    case 'leader': {
      // Capped by BOTH. The Leader wrote the mutation envelope, so binding it
      // to only its own document would be self-approval by construction; the
      // hard ceiling is the Human User's restriction on it (round-2 F-N1).
      const bound: AuthorityEnvelope[] = []
      if (documents.teamHardEnvelope !== undefined) bound.push(documents.teamHardEnvelope)
      if (documents.permissionMutationEnvelope !== undefined) bound.push(documents.permissionMutationEnvelope)
      return bound
    }
    case 'human-user': {
      // The mutation envelope does NOT bind a Human User: it is the Leader's
      // ceiling, and reading it here would let a document the Leader wrote cap
      // the reviewer who exists to overrule that Leader.
      return documents.teamHardEnvelope === undefined ? [] : [documents.teamHardEnvelope]
    }
    case 'human-admin': {
      // Spec §7.4:302 — `{ }`, "top of ladder; no envelope binds it". The empty
      // set is meaningful, not incidental: `meetAllAuthorityCeilings([])` is the
      // identity, so Human Admin reach is the ladder's, unmodified.
      return []
    }
    case 'member': {
      // Spec §7.4:307 — "a Member cannot review at all". Refusing is the only
      // honest arm: returning a document set would create a ceiling for a
      // reviewer that must not exist, and a later PR would consult it as if the
      // table had authorized it. Restriction-preserving is NOT a licence to
      // invent a row.
      throw new AuthorityBindingError(
        'position-is-not-a-reviewer',
        'a Member is not a reviewer position, so no authority document binds it',
      )
    }
  }
  // Unreachable while `ProposalAuthorityPosition` is the closed four-member
  // union: a fifth position added to that union makes THIS line a compile
  // error at every arm it did not write, which is the property invariant #16
  // asks for. There is no `default` arm above — an implicit fallback branch is
  // exactly what ADR A1-2 forbids, because a fallback answers the question it
  // was never given instead of refusing it.
  throw new AuthorityBindingError(
    'position-is-not-a-reviewer',
    `reviewer position ${String(reviewer)} has no written binding arm`,
  )
}

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
