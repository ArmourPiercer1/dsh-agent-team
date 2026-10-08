/**
 * A4-PR7 §7.5 — THE AUTHORITY WORLD THE ALPHA.3 FIXTURES NEVER DECLARED.
 *
 * Five fixtures (`a3p3-permission-mutation-authority`,
 * `a3p3-revoke-reveal-semantics`, `a3p4-permission-lifecycle-e2e`,
 * `a3p4-pr7-entry-exec-contract-regression`, `a3p4-pr4-production-entry-regression`)
 * were written while the v3 authority-ceiling gate could be skipped by never wiring
 * a reader. They therefore never declared a Team ceiling at all, and 54 of their
 * legs turned out to be establishing their preconditions by RAISING authority
 * through that open gate (51 of them fire the `authority-ceiling-port-absent`
 * refusal once the gate closes; the 3 others die on the classification's own
 * `subtree-relation-unknown`, for the same underlying reason: an unwired world).
 * Those fixtures were not passing a law, they were bypassing one.
 *
 * The repair is at the SEAM — the fixture declares the authority world its drives
 * need — and NEVER at an assertion. Every one of the 54 legs still asserts exactly
 * what it asserted before; what changed is that the world they drive now answers
 * "what is this Team's ceiling?" instead of being unable to be asked.
 *
 * WHY THE DECLARED-V3 WORLD AND NOT THE `undefined` SKIP
 * -----------------------------------------------------------------------------
 * The reader has exactly one answer that may skip the ceiling gate: `undefined` for
 * a DECIDED pre-v3 (v1/v2) binding, A5-12's existential. A fixture could have gone
 * green by declaring "this Team predates ceilings" — and that would have been a
 * lie twice over. These fixtures have no Blueprint object to date at all (they open
 * a bare overlay store), so "v2" is a fiction; and using an existential skip as a
 * per-fixture escape turns the one legitimate exemption into a loophole, which is
 * the opposite of what §7.5 is for. So the world declared here is a real production
 * shape: a v3 Team whose hard envelope EXPlicitly grants the expansion authority the
 * fixture exercises. Declaring authority is a statement about the world; declining
 * to be asked is not.
 *
 * WHY THE CEILING IS WIDE AND THE CARRIER IS NOT TOUCHED
 * -----------------------------------------------------------------------------
 * These legs' laws live on the LEADER carrier (`permissionLane.permissionEnvelope`,
 * the Alpha.3 coverage law) and on the ladder, not on the Team plane. The binding
 * table (`authority-ceiling.ts` `BOUND_AUTHORITY_DOCUMENTS`) is what makes that
 * separation enforceable rather than hopeful: a `leader` is capped by BOTH
 * documents, a `human-user` by the hard ceiling ONLY (the carrier is the Leader's
 * ceiling and must never cap the reviewer who overrules the Leader). So:
 *
 *   * a Leader leg is still stopped by its own carrier, in the Alpha.3 path, BEFORE
 *     this ceiling is ever consulted — its `EMPTY envelope refuses` /
 *     `maximumEffect is a CEILING` laws decide exactly as before;
 *   * a Human leg is capped only by the declared hard ceiling, so the ceiling says
 *     what the fixture means it to say and nothing else does;
 *   * a tightening never rises and is therefore untouched by either plane.
 *
 * The carrier this helper hands the ceiling context mirrors the lane's own carrier
 * document, so the v3 gate can never introduce a refusal on the carrier axis that
 * the Alpha.3 path did not already make. Where a fixture injects no carrier, the
 * context says `{ rules: [] }` — zero expansion authority, an answer, not a guess.
 */
import type { AuthorityEnvelopeDocuments } from '../governance/authority-ceiling.js'
import type { GovernancePermissionLaneDeps, PermissionMutationEnvelope } from '../governance/index.js'
import type { PermissionResourceMatcher } from '../governance/permission-mutation.js'
import type { PermissionAuthorityCeilingContext } from '../governance/types.js'

/** The anchor a fixture world stands on. Deliberately a constant: these fixtures
 *  never resolve a Blueprint, and the hash is the identity of the document set, not
 *  a value any leg branches on. */
export const CEILING_WORLD_ANCHOR = `sha256:${'d'.repeat(64)}`

/** Zero expansion authority — `declared`, so it is an ANSWER (the ADR's empty
 *  document), never the `unavailable` read that types as a context fault. */
export const DECLARED_NO_EXPANSION: PermissionMutationEnvelope = { rules: [] }

/**
 * A hard ceiling built from the cells the fixture actually drives, one rule per
 * (class, matcher) pair, at the top effect.
 *
 * WHY CELLS AND NOT A WILDCARD. The temptation is one `{ kind: 'any' }` rule per
 * class — "this Team is unrestricted within the class" — and the domain algebra
 * does not contain that rule: `matcherCovers` (`domain/authority-envelope/
 * authority-envelope.ts:213-231`) branches on `fingerprint`, `exact` and, by
 * elimination, `subtree`, with NO branch for `any`. A document-level `any` is
 * therefore read down the subtree arm against an `undefined` resource: it either
 * covers nothing or makes the whole scope UNDETERMINABLE (step 2 of
 * `evaluateMatches`: one undecidable same-class rule decides the whole scope). So
 * an `any` rule in a ceiling document is not "unlimited authority" — it is a
 * wildcard that quietly un-decides every other rule of its class. `any` is a
 * STATIC-LAYER and mutation-matcher kind (`permission-mutation.ts:824`), never a
 * ceiling-document kind, and the declared world says so by naming cells.
 *
 * WHY THE SET IS NARROWER THAN "EVERYTHING". A ceiling is a statement about the
 * Team, and a fixture's world should say what the fixture means. Every leg in the
 * five repaired files either (i) asserts a COMMIT — then the world must cover that
 * cell, or the fixture is being refused for a wiring fact again; or (ii) asserts a
 * REFUSAL — then the law that refused it before keeps refusing it, on the plane it
 * always spoke from, and widening the ceiling to cover that cell would delete the
 * leg's meaning. The cell sets below were therefore extended leg by leg against the
 * refusal messages (`the <plane> authority ceiling reaches only <ceiling>` names the
 * class and region), and only where the leg asserts `changed: true`.
 *
 * `subtree` rules are the price of a world with a containment predicate: a
 * subtree-vs-exact question with no predicate is UNDETERMINABLE, so a
 * predicate-less world declares exact and fingerprint cells only, and asks about
 * subtrees only where the subtree resource is identical (identity decides before
 * the seam: `matcherCovers` line 228).
 */
export function ceilingOverCells(
  cells: readonly { readonly operationClass: string; readonly matcher: PermissionResourceMatcher }[],
  maximumEffect: 'allow' | 'ask' | 'deny' = 'allow',
): PermissionMutationEnvelope {
  return { rules: cells.map((cell) => ({ ...cell, maximumEffect })) }
}

/** Both documents `declared`. `carrier` mirrors the lane's own carrier document so
 *  the ceiling gate repeats, and never widens or narrows, the Alpha.3 coverage law. */
export function ceilingWorldDocuments(options: {
  hardCeiling: PermissionMutationEnvelope
  carrier?: PermissionMutationEnvelope
}): AuthorityEnvelopeDocuments {
  return {
    teamHardEnvelope: {
      status: 'declared',
      document: options.hardCeiling,
    } as AuthorityEnvelopeDocuments['teamHardEnvelope'],
    permissionMutationEnvelope: {
      status: 'declared',
      document: options.carrier ?? DECLARED_NO_EXPANSION,
    } as AuthorityEnvelopeDocuments['permissionMutationEnvelope'],
  }
}

/**
 * The `authorityCeiling` port for a fixture that has no Blueprint to read. The
 * actor→ladder mapping is the ONE place the translation happens in production too
 * (`governance/types.ts:258-272`): `leader` → `leader`, the normalized human
 * surface → `human-user`. `beneficiaryAuthority: 'member'` is the target of every
 * one of these fixtures (`grant_instance` / `update_permission` on a member).
 */
export function declaredCeilingReader(port: {
  hardCeiling: PermissionMutationEnvelope
  carrier?: () => PermissionMutationEnvelope | Promise<PermissionMutationEnvelope>
  blueprintContentHash?: string
}): NonNullable<GovernancePermissionLaneDeps['authorityCeiling']> {
  return async (
    _teamSessionId: string,
    _memberInstanceId: string,
    actor: 'leader' | 'human',
  ): Promise<PermissionAuthorityCeilingContext> => ({
    beneficiaryAuthority: 'member',
    initiatorAuthority: actor === 'leader' ? 'leader' : 'human-user',
    documents: ceilingWorldDocuments({
      hardCeiling: port.hardCeiling,
      ...(port.carrier === undefined ? {} : { carrier: await port.carrier() }),
    }),
    blueprintContentHash: port.blueprintContentHash ?? CEILING_WORLD_ANCHOR,
  })
}
