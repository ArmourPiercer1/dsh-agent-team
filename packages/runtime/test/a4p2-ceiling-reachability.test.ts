/**
 * a4p2-ceiling-reachability.test.ts — A4-PR2 lane A, the half of §7.4.1 that is
 * about CEILINGS: what each position can actually REACH, pinned per plane, with
 * the two planes' answers for the SAME documents shown side by side.
 *
 * ---------------------------------------------------------------------------
 * WHY THIS FILE EXISTS AS A SIBLING AND NOT AS MORE LINES IN THE FIRST ONE
 * ---------------------------------------------------------------------------
 * `a4p2-authority-ceiling.test.ts` pins the LADDER (who may act). This one pins
 * the REACH (what may be signed or committed), and the reason those are separate
 * files is the reason they must be separate numbers: ADR X7-R5 rules that the
 * expansion ceiling and the approval ceiling are computed by different lookups
 * with OPPOSITE no-match semantics, and that neither result may be handed to the
 * other's caller. A test file that mixed them would make the fusion look like a
 * helper someone forgot to inline. Every leg below therefore says in its own name
 * which plane it is on, and the leg that matters most computes BOTH.
 *
 * ---------------------------------------------------------------------------
 * THE ASYMMETRY, IN ONE TABLE
 * ---------------------------------------------------------------------------
 *     documents            EXPANSION (`effectiveAuthorityCeiling`)  APPROVAL (`narrowingForApproval`)
 *     rule matches allow   allow                                    allow
 *     rule matches ask     ask                                      ask
 *     NO rule matches      no-authority  (nothing is authorized)    identity  (nothing is narrowed)
 *     slot unavailable     REFUSES                                  REFUSES
 *     undetermined match   undetermined  (absorbing)                undetermined  (absorbing)
 *
 * Row three is where a wrong merge shows up, in BOTH directions: feeding the
 * expansion answer to an approval caller dead-locks every Leader approval in a
 * Team whose hard ceiling is the documented `{ rules: [] }` (the meet absorbs),
 * and feeding the approval answer to a mutation caller authorizes an expansion no
 * document ever granted. The coordinator's phrasing of the first hazard: "an
 * expansion-plane no-match that yields `{rules: []}` silently strips every
 * approval". The second is the more dangerous one, because it WIDENS.
 *
 * @module @dsh-agent-team/runtime/test/a4p2-ceiling-reachability
 */

import { describe, expect, it } from 'vitest'
import { AuthorityBindingError, expansionCeiling, grantCeiling } from '../governance/authority-ceiling.js'
import type { AuthorityEnvelopeDocuments } from '../governance/authority-ceiling.js'
import { PROPOSAL_AUTHORITY_POSITIONS } from '../governance/proposal-store.js'

const ROOT = { kind: 'subtree' as const, resource: 'file:/root' }
const UNDER = { kind: 'subtree' as const, resource: 'file:/root/sub' }
const ELSEWHERE = { kind: 'subtree' as const, resource: 'file:/other' }
const SCOPE = { operationClass: 'write', matcher: UNDER }
const SHELL_SCOPE = { operationClass: 'shell', matcher: UNDER }
const contains = (root: string, child: string): boolean => child === root || child.startsWith(`${root}/`)

/** `{ rules: [] }` — the LEGAL zero-expansion-authority document (spec §3.4). */
const EMPTY = { rules: [] }
const ABSENT = { status: 'absent' } as const
const UNAVAILABLE = { status: 'unavailable' } as const

/** A one-rule document granting `maximumEffect` under `file:/root`. The envelope
 *  WRAPS its rules, so a bare rule is a type error at a `docs(…)` call site on
 *  purpose: `{ rules: [] }` (a document that authorizes nothing) and an absent
 *  slot (no document at all) are different facts, and a helper with a loose
 *  signature could not keep them apart. */
const doc = (
  maximumEffect: 'allow' | 'ask' | 'deny',
): { rules: { operationClass: string; matcher: typeof ROOT; maximumEffect: 'allow' | 'ask' | 'deny' }[] } => ({
  rules: [{ operationClass: 'write', matcher: ROOT, maximumEffect }],
})
const ALLOW = doc('allow')
const ASK = doc('ask')
const DENY = doc('deny')

const docs = (
  hard: AuthorityEnvelopeDocuments['teamHardEnvelope'],
  mutation: AuthorityEnvelopeDocuments['permissionMutationEnvelope'],
): AuthorityEnvelopeDocuments => ({ teamHardEnvelope: hard, permissionMutationEnvelope: mutation })

const positions = PROPOSAL_AUTHORITY_POSITIONS

describe('EXPANSION plane: what each position may commit, by reviewer position (A5-1)', () => {
  it('EXPANSION: a Leader is capped by the MEET of both documents', () => {
    // Both reach `allow`, so the meet does too — the baseline the rows below vary.
    expect(expansionCeiling('leader', docs(ALLOW, ALLOW), SCOPE, contains)).toMatchObject({
      status: 'decided',
      effect: 'allow',
    })
    // The Leader's OWN envelope says allow and the Team Hard ceiling says `ask`:
    // the answer is `ask`. This single value is the round-2 F-N1 hole closed — a
    // Leader reading only its own document would have answered `allow` here.
    expect(expansionCeiling('leader', docs(ASK, ALLOW), SCOPE, contains)).toMatchObject({
      status: 'decided',
      effect: 'ask',
    })
    // And the other direction, to show it is a MEET and not "whichever document
    // this code happened to look at first".
    expect(expansionCeiling('leader', docs(ALLOW, ASK), SCOPE, contains)).toMatchObject({
      status: 'decided',
      effect: 'ask',
    })
    expect(expansionCeiling('leader', docs(DENY, ALLOW), SCOPE, contains)).toMatchObject({
      status: 'decided',
      effect: 'deny',
    })
  })

  it('EXPANSION: a Leader whose hard ceiling declares no rule for the scope has NO authority', () => {
    // THE row X7-R5 exists for. `{ rules: [] }` is a legal document, and on this
    // plane "no rule matches" is not "no restriction" — it is the absence of a
    // grant. A `CEILING_IDENTITY` here would hand a v3 Leader unlimited expansion
    // authority in exactly the Team that wrote the most restrictive ceiling: a
    // relaxation in the forbidden direction, invisible to every approval test.
    expect(expansionCeiling('leader', docs(EMPTY, ALLOW), SCOPE, contains)).toEqual({ status: 'no-authority' })
    // Both documents empty → still `no-authority`: the meet of two `no-authority`
    // is `no-authority` (spec §24.2), never the identity.
    expect(expansionCeiling('leader', docs(EMPTY, EMPTY), SCOPE, contains)).toEqual({ status: 'no-authority' })
    // An ABSENT slot (a v1/v2 Team declared no hard ceiling at all) reads the same
    // way on this plane: no document, no grant. This is the row that makes the
    // statement "a pre-v3 Leader may approve within the ladder and expand nothing"
    // true, and it is only true because an absent slot is NOT skipped here.
    expect(expansionCeiling('leader', docs(ABSENT, ABSENT), SCOPE, contains)).toEqual({ status: 'no-authority' })
  })

  it('EXPANSION: a Human User is capped by the hard ceiling ONLY — the Leader envelope never caps them', () => {
    // The mutation envelope is the LEADER's ceiling. Capping a Human User with it
    // would let the Leader's own document restrict the reviewer who exists to
    // overrule that Leader (spec §7.4.1, ADR A5-1). The proof is the WIDENING
    // direction: the Leader document is `{ rules: [] }` — which zeroes out a
    // Leader — and the Human User is still at `allow`.
    expect(expansionCeiling('human-user', docs(ALLOW, EMPTY), SCOPE, contains)).toMatchObject({
      status: 'decided',
      effect: 'allow',
    })
    expect(expansionCeiling('human-user', docs(ASK, ALLOW), SCOPE, contains)).toMatchObject({
      status: 'decided',
      effect: 'ask',
    })
    // And a Human User with an empty hard ceiling has no expansion authority
    // either: the row is "not capped by the LEADER's document", not "uncapped".
    expect(expansionCeiling('human-user', docs(EMPTY, ALLOW), SCOPE, contains)).toEqual({ status: 'no-authority' })
  })

  it('EXPANSION: a Human Admin binds NO document, so nothing narrows it — not even a faulted read', () => {
    // Spec §7.4:302. Pinned against the most restrictive pair available, because an
    // admin row no test touches is a row a later tidy-up may cap.
    expect(expansionCeiling('human-admin', docs(EMPTY, EMPTY), SCOPE, contains)).toMatchObject({
      status: 'decided',
      effect: 'allow',
    })
    // `boundDocumentNames` returns no names for this position, so no slot is
    // RESOLVED for it — and a document that is not read cannot refuse a position it
    // does not bind. Same shape as PR1's approval-plane row at
    // `a4p1-authority-envelope.test.ts:621`, and the reason the admin row is the
    // one row a storage fault must never touch.
    expect(expansionCeiling('human-admin', docs(UNAVAILABLE, UNAVAILABLE), SCOPE, contains)).toMatchObject({
      status: 'decided',
      effect: 'allow',
    })
  })

  it('EXPANSION: a Member is not a position with zero reach, it is a position with no row', () => {
    // `status: 'no-authority'` would be representable and WRONG: it is an ANSWER,
    // and the table gives none here. Refusal, with the code and problem the
    // approval plane raises, so one fact has one name across the two planes.
    let raised: unknown
    try {
      expansionCeiling('member', docs(ALLOW, ALLOW), SCOPE, contains)
    } catch (error) {
      raised = error
    }
    expect(raised).toBeInstanceOf(AuthorityBindingError)
    expect((raised as AuthorityBindingError).code).toBe('AUTHORITY_BINDING_DEFECT')
    expect((raised as AuthorityBindingError).problem).toBe('position-is-not-a-reviewer')
  })

  it('EXPANSION: an unreadable document REFUSES; it never widens and never meets', () => {
    // The SF1/X7-R5 mapping on the plane where it has the sharpest edge. An
    // `unavailable` slot read as `absent` yields `no-authority` here, which
    // happens to be safe — but read as a SKIPPED slot (the other way a caller
    // writes `undefined`) it would leave only the Leader's own document, and a
    // Leader could then expand past the Team Hard ceiling whenever storage
    // faulted. One code, one refusal, both slots.
    const cases: readonly (readonly [label: string, documents: AuthorityEnvelopeDocuments])[] = [
      ['hard', docs(UNAVAILABLE, ALLOW)],
      ['mutation', docs(ALLOW, UNAVAILABLE)],
    ]
    for (const [label, faulted] of cases) {
      let raised: unknown
      try {
        expansionCeiling('leader', faulted, SCOPE, contains)
      } catch (error) {
        raised = error
      }
      expect(raised, `${label} must refuse`).toBeInstanceOf(AuthorityBindingError)
      expect((raised as AuthorityBindingError).code).toBe('AUTHORITY_CEILING_DOCUMENT_UNAVAILABLE')
    }
  })

  it('EXPANSION: an undetermined subtree match absorbs instead of guessing', () => {
    // No `subtreeContains`: whether `file:/root` covers `file:/root/sub` is
    // unknowable. Reporting `allow` would authorize an expansion on a guess, and
    // reporting `no-authority` would refuse on one; `undetermined` is the only
    // honest value and it is ABSORBING (ADR A1-6/A5-2).
    expect(expansionCeiling('leader', docs(ALLOW, ALLOW), SCOPE)).toMatchObject({ status: 'undetermined' })
    expect(expansionCeiling('human-user', docs(ALLOW, ALLOW), SCOPE)).toMatchObject({ status: 'undetermined' })
    // Absorbing means absorbing: the other document deciding `deny` does not make
    // the answer `deny`.
    expect(expansionCeiling('leader', docs(ALLOW, DENY), SCOPE)).toMatchObject({ status: 'undetermined' })
  })

  it('EXPANSION: a matcher that matches nothing is a decisive no-authority, not an undetermined', () => {
    // The contrast that keeps the leg above honest: WITH `subtreeContains` the same
    // documents answer decisively in both directions — inside the granted subtree
    // and outside it — and for an operation class no rule names.
    const scoped = docs(ALLOW, ALLOW)
    expect(expansionCeiling('leader', scoped, { operationClass: 'write', matcher: ELSEWHERE }, contains)).toEqual({
      status: 'no-authority',
    })
    expect(expansionCeiling('leader', scoped, SCOPE, contains)).toMatchObject({ status: 'decided', effect: 'allow' })
    expect(expansionCeiling('leader', scoped, SHELL_SCOPE, contains)).toEqual({ status: 'no-authority' })
  })
})

describe('the two planes for the SAME documents: X7-R5, in both directions', () => {
  const hardEmpty = docs(EMPTY, ALLOW)

  it('the same documents answer DIFFERENTLY per plane, and that difference is the whole point', () => {
    // Team Hard = `{ rules: [] }`, Leader envelope = `allow` on this scope.
    const expansion = expansionCeiling('leader', hardEmpty, SCOPE, contains)
    const approval = grantCeiling('leader', hardEmpty, SCOPE, contains)
    expect(expansion).toEqual({ status: 'no-authority' })
    expect(approval).toMatchObject({ status: 'decided', effect: 'allow' })
    // Stated as the assertion a reviewer actually needs: the two are NOT equal, so
    // neither can be substituted for the other. Had `expansionCeiling` been
    // implemented with `narrowingForApproval` — or `grantCeiling` with
    // `effectiveAuthorityCeiling` — this leg is where the suite says so.
    expect(expansion).not.toEqual(approval)
    // The consequence, in words the next reader cannot skip: a Leader in this Team
    // may APPROVE an `allow` ask and may COMMIT nothing.
  })

  it('APPROVAL: an absent rule imposes NO narrowing, so a `{ rules: [] }` hard ceiling never dead-locks approvals', () => {
    // The mirror leg, explicit because PR1 shipped this property and PR2 is the PR
    // positioned to break it by "helpfully" sharing one lookup: if the expansion
    // reading leaked into `grantCeiling`, every approval in a `{ rules: [] }` Team
    // would become impossible — the alternative ADR A1-4 records as rejected.
    for (const position of positions.filter((p) => p !== 'member')) {
      expect(
        grantCeiling(position, hardEmpty, SCOPE, contains),
        `${position} must still be able to approve`,
      ).toMatchObject({ status: 'decided', effect: 'allow' })
    }
  })

  it('the planes AGREE on the two things they must agree on: refusals and undetermined', () => {
    // Where divergence is NOT allowed. An unreadable document is not a ceiling on
    // either plane, and an unanswerable containment question is not a ceiling on
    // either — those two facts are what the terminal outcomes
    // `authority-unavailable` and `authority-undetermined` are NAMED after (ADR
    // A1-7), and a plane that disagreed about one of them would split a single
    // fact into two outcomes with different consequences.
    const faulted = docs(UNAVAILABLE, ALLOW)
    expect(() => grantCeiling('leader', faulted, SCOPE, contains)).toThrowError(AuthorityBindingError)
    expect(() => expansionCeiling('leader', faulted, SCOPE, contains)).toThrowError(AuthorityBindingError)
    const undecided = docs(ALLOW, ALLOW)
    expect(grantCeiling('leader', undecided, SCOPE)).toMatchObject({ status: 'undetermined' })
    expect(expansionCeiling('leader', undecided, SCOPE)).toMatchObject({ status: 'undetermined' })
  })
})
