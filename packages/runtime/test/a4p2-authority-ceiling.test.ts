/**
 * a4p2-authority-ceiling.test.ts — A4-PR2 lane A: the RUNTIME AUTHORITY ladder
 * (`RuntimeAuthority` / `authorityRank` / `isHigherAuthority` / `mayReview`) and
 * the minimum-authority evaluator, pinned POSITIONALLY.
 *
 * ---------------------------------------------------------------------------
 * THE MATRIX IS KEYED BY REVIEWER, NOT BY BENEFICIARY (ADR A5-1)
 * ---------------------------------------------------------------------------
 * Binding is by LADDER POSITION: a Leader is capped by both documents, a Human
 * User by `teamHardEnvelope` ALONE, a Human Admin by NEITHER, and a Member is
 * not a reviewer at all. A per-shape (beneficiary-keyed) matrix would re-test
 * the retired A2-6 model and would leave the `human-admin` row missing — and an
 * admin row that no test touches is an admin row any later "tidy-up" may cap,
 * which is a ceiling relaxation in the forbidden direction.
 *
 * ---------------------------------------------------------------------------
 * WHAT THIS FILE CANNOT CATCH, AND THEREFORE SCANs FOR (correction X7-R3)
 * ---------------------------------------------------------------------------
 * `RuntimeAuthority` must be a TYPE ALIAS of PR0's `ProposalAuthorityPosition`,
 * and the mutual-assignability assertion PR0 asked for CANNOT catch the
 * violation it exists to catch: a locally re-spelled
 * `'member' | 'leader' | 'human-user' | 'human-admin'` is structurally
 * assignable in BOTH directions with NO IMPORT AT ALL, and
 * `as const satisfies readonly ProposalAuthorityPosition[]` passes on a SUBSET
 * while silently creating a SECOND ordering. So the type assertion below is
 * accompanied by (a) a source scan — the module imports `./proposal-store.js`
 * and contains no re-spelled ladder — and (b) POSITIVE containment: the rank
 * map's keys are exactly `PROPOSAL_AUTHORITY_POSITIONS`.
 *
 * Every scan leg here carries its OWN injected offender (X9): a pattern that
 * has never matched anything is not a guard, it is a comment.
 *
 * @module @dsh-agent-team/runtime/test/a4p2-authority-ceiling
 */

import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import {
  AUTHORITY_RANK,
  authorityRank,
  isHigherAuthority,
  mayReview,
} from '../governance/authority-ceiling.js'
import { AuthorityBindingError } from '../governance/authority-ceiling.js'
import { evaluateAuthorityCeiling } from '../governance/runtime-authority.js'
import type { RuntimeAuthority } from '../governance/runtime-authority.js'
import {
  PROPOSAL_AUTHORITY_POSITIONS,
} from '../governance/proposal-store.js'
import type { ProposalAuthorityPosition } from '../governance/proposal-store.js'

const HERE = dirname(fileURLToPath(import.meta.url))
const RUNTIME_ROOT = join(HERE, '..')

/** The one ladder, in the one order PR0 froze (`proposal-store.ts:148`). */
const LADDER = PROPOSAL_AUTHORITY_POSITIONS

// ---------------------------------------------------------------------------
// The type-level legs. These are REAL but INSUFFICIENT, and the file says so:
// the scan legs below are what actually police the alias.
// ---------------------------------------------------------------------------

/** `Assignable<A, B>` — the same tuple-wrapped form PR1 used, so `never` and a
 *  bare union are not accidentally treated as assignable. */
type Assignable<A, B> = [A] extends [B] ? true : false

// Two directions, both required: a one-directional assertion hides divergence
// in the unchecked direction (X7-R3 fake-mode #2).
const runtimeIsPosition: Assignable<RuntimeAuthority, ProposalAuthorityPosition> = true
const positionIsRuntime: Assignable<ProposalAuthorityPosition, RuntimeAuthority> = true

describe('RuntimeAuthority is PR0’s ladder, not a second one (X7-R3)', () => {
  it('is assignable to ProposalAuthorityPosition in both directions', () => {
    expect(runtimeIsPosition).toBe(true)
    expect(positionIsRuntime).toBe(true)
  })

  /**
   * Strip comments before scanning, in the ORDER the X9 correction demands, and
   * prove the stripper cannot eat code. The precedent is in this repository: a
   * comment-strip written the other way round deleted ~279 lines of `host.ts` and
   * silently blinded the very leg it was added to strengthen
   * (`a3p3-governance-lane-hygiene.test.ts:477-478` carries the fixed form and its
   * regression leg at :551-576). Block comments FIRST, non-anchored and lazy, so a
   * `/**`-opened header cannot reach past its own `*\/`; then line comments.
   */
  const codeOnly = (source: string): string =>
    source.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/[^\n]*/g, ' ')

  /** The four shapes X7-R3 names, quote-tolerant: a re-spelled union SPELLS ITS
   *  MEMBERS AS STRING LITERALS, so a pattern that expects a bare `member|`
   *  matches nothing and reports a clean file forever. The non-vacuity leg below
   *  is what caught that about these patterns on their first run. */
  const RESPELLING_PATTERNS: readonly (readonly [string, RegExp])[] = [
    ['union member before a bar', /['"](?:member|leader|human-user|human-admin)['"]\s*\|/],
    ['union member after a bar', /\|\s*['"](?:member|leader|human-user|human-admin)['"]/],
    ['a second positions array', /(?:POSITIONS|LADDER|RANKS?)\s*=\s*\[[^\]]*['"]member['"]/],
    ['the satisfies form that passes on a subset', /satisfies\s+readonly\s+ProposalAuthorityPosition\[\]/],
    // A second RANK MAP is the same defect in its most dangerous form: it does not
    // merely re-spell the names, it re-spells the ORDER, and X7-R3's whole point is
    // that there is exactly one (`AUTHORITY_RANK` in `authority-ceiling.ts`, which
    // is why this module imports it instead of holding a copy).
    ['a second rank map', /(?:RANKS?|ORDER)\s*=\s*\{[^}]*\bmember\s*:/],
  ]

  it('imports the PR0 union instead of re-spelling it (source scan, with a planted offender)', () => {
    const source = readFileSync(join(RUNTIME_ROOT, 'governance', 'runtime-authority.ts'), 'utf8')
    const code = codeOnly(source)
    // THE NON-VACUITY OF THE STRIPPER ITSELF (X9): everything this leg then
    // asserts is computed on `code`, so a stripper that deleted the module body
    // would make all four patterns green. The two facts below are the ones the
    // scan depends on, re-asserted on the stripped text.
    expect(code, 'the comment stripper deleted code').toContain("from './proposal-store.js'")
    expect(code, 'the comment stripper deleted code').toMatch(
      /export type RuntimeAuthority = ProposalAuthorityPosition\b/,
    )
    // THE IMPORT. Assignability cannot see a structural copy; the import is the
    // only fact that makes the two names ONE union (the same argument
    // `a3p3-governance-lane-hygiene.test.ts:755-764` makes for PR0's names).
    expect(source).toContain("from './proposal-store.js'")
    expect(source).toMatch(/export type RuntimeAuthority = ProposalAuthorityPosition\b/)
    // No local re-spelling of the ladder, in ANY of the four shapes X7-R3 names.
    for (const [label, pattern] of RESPELLING_PATTERNS) {
      expect(pattern.test(code), `the module re-spells the ladder: ${label}`).toBe(false)
    }
  })

  it('the re-spelling scan fires on every violation shape X7-R3 names (non-vacuity)', () => {
    // Without this leg the four patterns above could be typos and the file would
    // be green forever. Each offender is injected into a REAL stripped copy of the
    // scanned source, so a pattern that never matches is caught — which is how
    // this leg earned its quote-tolerance: the first version of these patterns
    // missed all four offenders, because a ladder re-spelling quotes its members.
    const real = codeOnly(readFileSync(join(RUNTIME_ROOT, 'governance', 'runtime-authority.ts'), 'utf8'))
    const offenders: readonly (readonly [string, string])[] = [
      ['re-spelled union, left-anchored', "export type RuntimeAuthority = 'member' | 'leader' | 'human-user' | 'human-admin'"],
      ['re-spelled union, right-anchored', "type Other = 'a' | 'human-admin'"],
      ['a second positions array', "export const OWN_POSITIONS = ['member', 'leader'] as const"],
      ['the subset-passing satisfies', 'const partial = ["member"] as const satisfies readonly ProposalAuthorityPosition[]'],
      ['a second rank map', "const OWN_RANK = { member: 0, leader: 1 } as const"],
    ]
    let fired = 0
    for (const [label, offender] of offenders) {
      const poisoned = `${real}\n${offender}\n`
      const caught = RESPELLING_PATTERNS.some(([, pattern]) => {
        pattern.lastIndex = 0
        return pattern.test(poisoned)
      })
      expect(caught, `the scan does not catch: ${label}`).toBe(true)
      fired += caught ? 1 : 0
    }
    expect(fired, 'the non-vacuity leg itself is vacuous').toBe(offenders.length)
  })

  it('authority-ceiling.ts reaches the same union as a TYPE and not a copy', () => {
    const source = readFileSync(join(RUNTIME_ROOT, 'governance', 'authority-ceiling.ts'), 'utf8')
    expect(source).toContain("import type { ProposalAuthorityPosition } from './proposal-store.js'")
    // A VALUE import would put a storage-adjacent edge where PR1 reviewed none.
    expect(source).not.toMatch(/^import \{[^}]*\} from '\.\/proposal-store\.js'/m)
  })
})

describe('authorityRank: the ladder has ONE order, and its keys are the whole ladder', () => {
  it('ranks strictly increase along PROPOSAL_AUTHORITY_POSITIONS', () => {
    const ranks = LADDER.map((position) => authorityRank(position))
    expect(ranks).toEqual([0, 1, 2, 3])
    for (let i = 1; i < ranks.length; i += 1) {
      const previous = ranks[i - 1] as number
      const current = ranks[i] as number
      expect(current, `position ${String(LADDER[i])} is not above its predecessor`).toBeGreaterThan(previous)
    }
  })

  it('POSITIVE CONTAINMENT: the rank map keys are exactly PR0’s positions (X7-R3)', () => {
    // The subset fake: `as const satisfies readonly ProposalAuthorityPosition[]`
    // passes when a LOCAL array lists three of the four, so containment must be
    // asserted in BOTH directions against PR0's array. A missing key here is a
    // position with no rank — and `undefined` rank comparisons are `false`,
    // which reads as "this reviewer cannot act", a silent refusal no test names.
    expect([...Object.keys(AUTHORITY_RANK)].sort()).toEqual([...LADDER].sort())
    // And the array order stays PINNED-CONSISTENT with ranking (A5-16): the map
    // is the definition, the array order is what must agree with it.
    expect(LADDER.map((position) => AUTHORITY_RANK[position])).toEqual([0, 1, 2, 3])
  })

  it('refuses a position outside the closed union instead of ranking it undefined', () => {
    // The PR1 precedent one file over: `bindingDocs` refuses below the switch
    // because a value that walked in from JSON would otherwise reach an empty
    // document set and come out as UNLIMITED reach. `authorityRank` is the same
    // door: an unranked position must throw, never return `undefined`.
    const bogus = 'not-a-position' as unknown as RuntimeAuthority
    expect(() => authorityRank(bogus)).toThrow(AuthorityBindingError)
    expect(() => authorityRank(bogus)).toThrow(/has no rank/)
    // Undefined is not an answer, and the refusal carries a code (PR1's
    // `code`-based mapping reads a bare TypeError as "not one of mine").
    try {
      authorityRank(bogus)
      expect.unreachable('authorityRank accepted a position outside the union')
    } catch (error) {
      expect((error as AuthorityBindingError).code).toBe('AUTHORITY_BINDING_DEFECT')
    }
    for (const value of [undefined, null, 0, '', 'HUMAN-USER', 'admin']) {
      expect(() => authorityRank(value as unknown as RuntimeAuthority), String(value)).toThrow(AuthorityBindingError)
    }
  })
})

describe('isHigherAuthority', () => {
  it('is true exactly for a strictly higher position, in both directions of every pair', () => {
    for (const left of LADDER) {
      for (const right of LADDER) {
        expect(isHigherAuthority(left, right)).toBe(authorityRank(left) > authorityRank(right))
      }
    }
    // Self-comparison is the self-approval case in disguise: never higher.
    for (const position of LADDER) {
      expect(isHigherAuthority(position, position)).toBe(false)
    }
  })
})

describe('mayReview (X7-R2): flat, all required, no defaults', () => {
  it('takes exactly three required parameters', () => {
    // A defaulted or optional `requiredAuthority` is SILENTLY PERMISSIVE: the
    // caller that forgets the argument gets "any reviewer above the beneficiary
    // may sign it" instead of a compile error. `Function.length` counts
    // parameters BEFORE the first default, so one default is visible here.
    expect(mayReview.length).toBe(3)
    expect(mayReview).toHaveLength(3)
  })

  it('refuses a missing argument instead of treating it as no requirement', () => {
    // The runtime half of the same rule: JS callers, JS-compiled callers and
    // `{ ...spread }` calls can all arrive short. `undefined` must never read
    // as "nothing is required" — the widest possible answer.
    const missing = mayReview as unknown as (r: RuntimeAuthority, b: RuntimeAuthority) => boolean
    expect(() => missing('leader', 'member')).toThrow(AuthorityBindingError)
    const tooMany = mayReview as unknown as (
      r: RuntimeAuthority,
      b: RuntimeAuthority,
      q: RuntimeAuthority | undefined,
    ) => boolean
    expect(() => tooMany('leader', 'member', undefined)).toThrow(AuthorityBindingError)
    expect(() => tooMany('leader', undefined as unknown as RuntimeAuthority, 'leader')).toThrow(AuthorityBindingError)
    expect(() => tooMany(undefined as unknown as RuntimeAuthority, 'member', 'leader')).toThrow(AuthorityBindingError)
  })

  it('POSITIONAL MATRIX: who may act, keyed by reviewer (A5-1)', () => {
    // `required` is the case's requiredAuthority; every cell is the pair
    // (reviewer, beneficiary) with the requirement satisfied or not by LADDER
    // POSITION ONLY. Read it as: a reviewer must be strictly above the
    // beneficiary AND at or above the requirement.
    const cells: readonly (readonly [
      reviewer: RuntimeAuthority,
      beneficiary: RuntimeAuthority,
      required: RuntimeAuthority,
      allowed: boolean,
      why: string,
    ])[
    ] = [
      // --- reviewer = member: never a reviewer, whatever the case says.
      ['member', 'member', 'member', false, 'self-approval is never legal'],
      ['member', 'leader', 'member', false, 'a member is below the beneficiary'],
      // --- reviewer = leader.
      ['leader', 'member', 'member', true, 'one up, requirement met'],
      ['leader', 'member', 'leader', true, 'one up, requirement at own rank'],
      ['leader', 'member', 'human-user', false, 'requirement above the reviewer'],
      ['leader', 'leader', 'member', false, 'same-level approval is never legal'],
      ['leader', 'human-user', 'member', false, 'below the beneficiary'],
      // --- reviewer = human-user.
      ['human-user', 'member', 'member', true, 'two up'],
      ['human-user', 'member', 'leader', true, 'two up, leader requirement'],
      ['human-user', 'member', 'human-user', true, 'requirement at own rank'],
      ['human-user', 'member', 'human-admin', false, 'Admin-only case: nobody below Admin'],
      ['human-user', 'leader', 'member', true, 'beneficiary is the Leader, still strictly above'],
      ['human-user', 'leader', 'human-user', true, 'requirement at own rank'],
      ['human-user', 'human-user', 'member', false, 'self-approval'],
      ['human-user', 'human-admin', 'member', false, 'Admin is the top of the ladder'],
      // --- reviewer = human-admin: bound by the ladder only, never by a
      // document. Every case a lower reviewer could settle is also its own.
      ['human-admin', 'member', 'member', true, 'top of ladder'],
      ['human-admin', 'member', 'human-user', true, 'a Human-User case'],
      ['human-admin', 'member', 'human-admin', true, 'an Admin-only case'],
      ['human-admin', 'leader', 'human-admin', true, 'Admin settling a Leader case'],
      ['human-admin', 'human-user', 'human-admin', true, 'above a Human User'],
      ['human-admin', 'human-admin', 'member', false, 'self-approval survives even at the top'],
    ]
    for (const [reviewer, beneficiary, required, allowed, why] of cells) {
      expect(mayReview(reviewer, beneficiary, required), `${reviewer} / ${beneficiary} / needs ${required}: ${why}`).toBe(allowed)
    }
  })

  it('pins the no-self-and-no-same-level law on its own (plan lane A)', () => {
    // Minimum approver must be STRICTLY higher than the beneficiary — asserted
    // independently of the matrix so a matrix edit cannot retire the law.
    for (const position of LADDER) {
      expect(mayReview(position, position, 'member'), position).toBe(false)
    }
    for (const [reviewer, beneficiary] of [
      ['member', 'leader'],
      ['member', 'human-user'],
      ['member', 'human-admin'],
      ['leader', 'human-user'],
      ['leader', 'human-admin'],
      ['human-user', 'human-admin'],
    ] as const) {
      expect(mayReview(reviewer, beneficiary, 'member'), `${reviewer} over ${beneficiary}`).toBe(false)
    }
  })

  it('refuses an unknown position rather than answering false by accident', () => {
    // `undefined > 0` is false, so an unvalidated position would return `false`
    // and look like an ordinary refusal. It must arrive as a typed refusal
    // instead, because "we do not know who this is" is not "this reviewer may
    // not act" (the same distinction PR1 drew between `unavailable`/`absent`).
    const bogus = 'wizard' as unknown as RuntimeAuthority
    expect(() => mayReview(bogus, 'member', 'member')).toThrow(/has no rank/)
    expect(() => mayReview('leader', bogus, 'member')).toThrow(/has no rank/)
    expect(() => mayReview('leader', 'member', bogus)).toThrow(/has no rank/)
  })
})

describe('evaluateAuthorityCeiling: two planes, and it never fuses them (X7-R5)', () => {
  const documents = {
    teamHardEnvelope: { rules: [{ operationClass: 'write', matcher: { kind: 'subtree' as const, resource: 'file:/root' }, maximumEffect: 'allow' as const }] },
    permissionMutationEnvelope: { rules: [{ operationClass: 'write', matcher: { kind: 'subtree' as const, resource: 'file:/root' }, maximumEffect: 'allow' as const }] },
  }
  const scope = { operationClass: 'write', matcher: { kind: 'subtree' as const, resource: 'file:/root/sub' } }
  const contains = (root: string, child: string): boolean => child === root || child.startsWith(`${root}/`)

  it('answers with a minimum authority and evidence, and nothing about availability', () => {
    const evaluation = evaluateAuthorityCeiling({
      beneficiaryAuthority: 'member',
      initiatorAuthority: 'leader',
      ...scope,
      desiredEffect: 'allow',
      documents,
      subtreeContains: contains,
    })
    // The three-way outcome, and the shape each arm owes.
    expect(['direct', 'approval-required', 'undetermined']).toContain(evaluation.outcome)
    // The evaluator "does not return admin unavailable" (spec §7.3) and knows
    // nothing about resolver availability: no availability vocabulary anywhere.
    expect(JSON.stringify(evaluation)).not.toMatch(/unavailable|resolver|capability/)
    if (evaluation.outcome === 'undetermined') {
      expect(evaluation).not.toHaveProperty('requiredAuthority')
      return
    }
    expect(LADDER).toContain(evaluation.requiredAuthority)
    expect(evaluation).toHaveProperty('ceilingByRole')
    expect(evaluation).toHaveProperty('ceilingUndetermined')
    expect(evaluation).toHaveProperty('evidence')
  })

  it('a Member ask whose effect the Leader may reach stops at Leader (ladder default)', () => {
    // Beneficiary `member`, initiator `member`: the beneficiary cannot sign its
    // own elevation, so this is an approval even though the rung is the default.
    const evaluation = evaluateAuthorityCeiling({
      beneficiaryAuthority: 'member',
      initiatorAuthority: 'member',
      ...scope,
      desiredEffect: 'allow',
      documents,
      subtreeContains: contains,
    })
    expect(evaluation.outcome).toBe('approval-required')
    // The ladder default for a Member ask is Leader, and nothing here rises it:
    // `roseBecauseInsufficient` is the proof, not a comment about it.
    expect(evaluation.requiredAuthority).toBe('leader')
    expect(evaluation.evidence.roseBecauseInsufficient).toEqual([])
    // `authority-undetermined` never carries requiredAuthority (spec §24.2), so
    // the decided arms are the only ones allowed to name a position.
    expect(evaluation.ceilingUndetermined).toBe(false)
  })

  it('the same ask answered `direct` for a Leader initiator — the arm needs an initiator', () => {
    // Identical documents, identical scope, different ACTOR. Without
    // `initiatorAuthority` in the input these two legs are the same call and the
    // `direct` arm is unreachable: shipping an outcome no input can produce is
    // exactly the defect class PR1 shipped (an arm whose removal keeps the suite
    // green). Spec §7.2 lists the CONCEPTUAL inputs; §7.3's arm needs this one.
    const asLeader = evaluateAuthorityCeiling({
      beneficiaryAuthority: 'member',
      initiatorAuthority: 'leader',
      ...scope,
      desiredEffect: 'allow',
      documents,
      subtreeContains: contains,
    })
    expect(asLeader.outcome).toBe('direct')
    expect(asLeader.requiredAuthority).toBe('leader')
    // And a HUMAN USER may also settle it directly, from the same documents —
    // positional binding, not "whoever is highest in the room".
    const asHuman = evaluateAuthorityCeiling({
      beneficiaryAuthority: 'member',
      initiatorAuthority: 'human-user',
      ...scope,
      desiredEffect: 'allow',
      documents,
      subtreeContains: contains,
    })
    expect(asHuman.outcome).toBe('direct')
    expect(asHuman.requiredAuthority).toBe('leader')
  })

  it('a Leader ask rises to Human User, and the Human User row names ONE document', () => {
    // The positional-binding evidence at value level: the Leader's row is capped
    // by both documents, the Human User's by the hard ceiling ALONE (spec §7.4.1,
    // ADR A5-1). A beneficiary-keyed matrix cannot show this row at all.
    const evaluation = evaluateAuthorityCeiling({
      beneficiaryAuthority: 'leader',
      initiatorAuthority: 'leader',
      ...scope,
      desiredEffect: 'allow',
      documents,
      subtreeContains: contains,
    })
    expect(evaluation.requiredAuthority).toBe('human-user')
    expect(evaluation.outcome).toBe('approval-required')
    // The walk STARTS above the beneficiary, so the Leader rung is never a
    // candidate for its own ask — the evidence map proves the no-self-approval law
    // structurally rather than asserting it.
    expect(evaluation.evidence.consideredRoles).toEqual(['human-user'])
    expect(evaluation.evidence.boundDocumentsByRole.leader).toBeUndefined()
    expect(evaluation.evidence.boundDocumentsByRole['human-user']).toEqual(['teamHardEnvelope'])
    // A Human User initiator settles it directly, so the rise is about the
    // BENEFICIARY's rung, not about who is asking.
    const asHuman = evaluateAuthorityCeiling({
      beneficiaryAuthority: 'leader',
      initiatorAuthority: 'human-user',
      ...scope,
      desiredEffect: 'allow',
      documents,
      subtreeContains: contains,
    })
    expect(asHuman.outcome).toBe('direct')
    expect(asHuman.requiredAuthority).toBe('human-user')
  })

  it('a ceiling that decides BELOW the effect rises past Human User to Human Admin', () => {
    // The `roseBecauseInsufficient` list is the value-level proof of the rise: the
    // Human User rung was EVALUATED, decided `ask`, and was not enough — so the
    // answer names Human Admin, whose row binds NO document (spec §7.4:302) and
    // therefore reaches everything. Pinning the empty row here is what stops a
    // later "tidy-up" from capping the top of the ladder: an admin row no test
    // touches is an admin row that may be narrowed in the forbidden direction.
    const hardCapsAtAsk = {
      teamHardEnvelope: {
        rules: [
          { operationClass: 'write', matcher: { kind: 'subtree' as const, resource: 'file:/root' }, maximumEffect: 'ask' as const },
        ],
      },
      permissionMutationEnvelope: {
        rules: [
          { operationClass: 'write', matcher: { kind: 'subtree' as const, resource: 'file:/root' }, maximumEffect: 'allow' as const },
        ],
      },
    }
    const evaluation = evaluateAuthorityCeiling({
      beneficiaryAuthority: 'member',
      initiatorAuthority: 'leader',
      ...scope,
      desiredEffect: 'allow',
      documents: hardCapsAtAsk,
      subtreeContains: contains,
    })
    expect(evaluation.requiredAuthority).toBe('human-admin')
    expect(evaluation.outcome).toBe('approval-required')
    expect(evaluation.evidence.roseBecauseInsufficient).toEqual(['leader', 'human-user'])
    expect(evaluation.ceilingByRole['human-user']?.status).toBe('decided')
    expect(evaluation.ceilingByRole['human-user']).toMatchObject({ effect: 'ask' })
    expect(evaluation.evidence.boundDocumentsByRole['human-admin']).toEqual([])
    // A Leader whose OWN envelope reaches `allow` is still capped by the hard
    // ceiling: the Leader row is the meet of both, so the rise starts there.
    expect(evaluation.ceilingByRole.leader).toMatchObject({ effect: 'ask' })
  })

  it('an undetermined containment ends the walk and mints no position', () => {
    // No `subtreeContains`: every subtree question is unanswerable, so the
    // narrowing is `undetermined`, which ABSORBS (ADR A1-6/A5-2). The refusal to
    // name a reviewer is the point — a position is a routing instruction.
    const evaluation = evaluateAuthorityCeiling({
      beneficiaryAuthority: 'member',
      initiatorAuthority: 'leader',
      ...scope,
      desiredEffect: 'allow',
      documents,
    })
    expect(evaluation.outcome).toBe('undetermined')
    expect(evaluation.ceilingUndetermined).toBe(true)
    expect(evaluation).not.toHaveProperty('requiredAuthority')
    expect(evaluation.ceilingByRole.leader?.status).toBe('undetermined')
  })

  it('a Human Admin ask refuses instead of inventing a fifth rung', () => {
    expect(() =>
      evaluateAuthorityCeiling({
        beneficiaryAuthority: 'human-admin',
        initiatorAuthority: 'human-user',
        ...scope,
        desiredEffect: 'allow',
        documents,
        subtreeContains: contains,
      }),
    ).toThrowError(/no rung above it/)
  })

  it('refuses an input that omits a required field rather than defaulting it', () => {
    // Same law as `mayReview`: a defaulted `desiredEffect` or a missing
    // document slot is silently permissive, so the evaluator takes the
    // three-way slot type and refuses on a hole in it.
    const anyInput = evaluateAuthorityCeiling as unknown as (i: unknown) => { outcome: string }
    const full = {
      beneficiaryAuthority: 'member',
      initiatorAuthority: 'leader',
      ...scope,
      desiredEffect: 'allow',
      documents,
      subtreeContains: contains,
    }
    // Each REQUIRED field, dropped one at a time. A defaulted `desiredEffect`
    // compares below every ceiling and would return the ladder default as an
    // AUTHORIZATION; a missing `documents` is `absent` for both slots, i.e. the
    // widest pair the algebra can hold.
    for (const drop of ['desiredEffect', 'documents', 'initiatorAuthority', 'beneficiaryAuthority', 'matcher', 'operationClass'] as const) {
      const hole = { ...full }
      delete (hole as Record<string, unknown>)[drop]
      expect(() => anyInput(hole), `dropping ${drop} must refuse, not default`).toThrowError(/is required and was/)
    }
  })
})
