/**
 * A4-PR1 lane B — the SHARED authority-envelope algebra (plan Task 1 lane B;
 * ADR A1-4/A1-5/A1-6/A3-9/A5-12, spec §5.2/§5.3/§24.2/§24.3/§7.4).
 *
 * This file is where the phase's deciding point is settled in code. Two
 * lookups read the SAME document with OPPOSITE no-match semantics, and the
 * whole governance design turns on them never being conflated:
 *
 *  - `effectiveAuthorityCeiling(envelope, class, matcher)` — the DURABLE
 *    MUTATION / expansion plane. No matching rule ⇒ **`no-authority`**. A
 *    document with `rules: []` means the Leader can expand nothing (A1-4,
 *    spec §5.2 step 3).
 *  - `narrowingForApproval(document, scope)` — the CONCRETE-OPERATION APPROVAL
 *    plane. No matching rule ⇒ **the identity** (`decided(allow)`): "absence of
 *    a matching rule imposes no narrowing" (A1-4). Envelope rules are
 *    restrictions on a reviewer's reach, and the source of approval authority
 *    is the ladder, not the envelope.
 *
 * The blocking case this file was written for (X5-E3, and the reason the RED
 * had to exist before the algebra): a Team whose `teamHardEnvelope` is the
 * documented `{ rules: [] }`, with a mutation-envelope rule matching the scope
 * at `allow`. If one function served both planes, or if the two results were
 * ever `min()`-ed, the empty hard envelope would contribute `no-authority`,
 * `no-authority` would absorb the meet (§24.2), and **every Leader approval
 * under the documented empty hard ceiling would dead-lock** — precisely the
 * alternative A1-4 records as "explicitly rejected". The expected answer is
 * `allow`, and it is asserted first below.
 *
 * What is deliberately NOT here, with the reason:
 *  - `mayReview(reviewer, case)` — spec §7.4's other function. It consumes
 *    `case.requiredAuthority` and leg data that do not exist until PR2/PR4, so
 *    writing it now would either invent a case shape or fake a parameter
 *    (X5-E1). `bindingDocs`/`grantCeiling` are keyed on the durable, already
 *    frozen `ProposalAuthorityPosition` union instead.
 *  - any production wiring. PR1 connects nothing (plan Task 1); the algebra is
 *    exercised directly, through the same injected seams production will use.
 *
 * Test pattern of this repo: scenarios are captured at module level, the `it`
 * bodies assert captured values (the plain-node shim's `it` is synchronous).
 *
 * @module @dsh-agent-team/runtime/test/a4p1-authority-envelope
 */

import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

import {
  AUTHORITY_EFFECT_PRECEDENCE,
  AUTHORITY_OPERATION_CLASSES,
  AUTHORITY_EFFECT_VALUES,
  AUTHORITY_MATCHER_KINDS,
  CEILING_IDENTITY,
  CEILING_NO_AUTHORITY,
  effectiveAuthorityCeiling,
  matcherCovers,
  meetAllAuthorityCeilings,
  meetAuthorityCeilings,
  narrowingForApproval,
  parseAuthorityEnvelope,
} from '../../domain/authority-envelope/src/index.js'
import type {
  AuthorityEffect,
  AuthorityEnvelope,
  AuthorityEnvelopeAst,
  AuthorityEnvelopeAstMatcher,
  AuthorityEnvelopeRule,
  AuthorityResourceMatcher,
  EffectiveCeiling,
} from '../../domain/authority-envelope/src/index.js'
import { buildAuthorityEnvelope } from '../src/plugin/permission-plane.js'
import { bindingDocs, grantCeiling } from '../governance/authority-ceiling.js'
import type { AuthorityEnvelopeDocuments } from '../governance/authority-ceiling.js'
import type {
  GovernanceProposalEnvelopeAst,
  ProposalAuthorityPosition,
} from '../governance/proposal-store.js'
import {
  PERMISSION_EFFECT_PRECEDENCE,
  matcherCovers as kernelMatcherCovers,
} from '../governance/permission-mutation.js'
import type {
  PermissionEnvelopeRule,
  PermissionResourceMatcher,
  PermissionMutationEnvelope,
} from '../governance/permission-mutation.js'
import type { PermissionOverlayEffect } from '../../storage/schema/permission-overlay.js'
import { PERMISSION_TOOL_NAMES } from '../../domain/blueprint/src/index.js'

const HERE = dirname(fileURLToPath(import.meta.url))
/** Read as TEXT on purpose: this leg asserts the SHAPE of the closed table (an
 *  explicit arm per union member, no `default:` fallthrough), which is a
 *  source-level property no runtime call can observe. Same technique as
 *  `a3p3-governance-lane-hygiene.test.ts:60-63`. */
const bindingDocsSource = readFileSync(join(HERE, '../governance/authority-ceiling.ts'), 'utf8')

// ---------------------------------------------------------------------------
// type-level pins (the typecheck gate is what enforces these; the values below
// make the same claims visible to a reader of the test output)
// ---------------------------------------------------------------------------

/** True only when A is assignable to B. Both directions are asserted where the
 *  claim is "these two names denote ONE vocabulary" (A3-9). */
type Assignable<A, B> = [A] extends [B] ? true : false

// A3-9: PR0 froze the durable AST node as `GovernanceProposalEnvelopeAst`
// (proposal-store.ts:184-187 — the matcher union, NOT a document). PR1's shared
// AST matcher must be its twin IN BOTH DIRECTIONS: a proposal row's node is
// usable wherever the shared grammar is, and vice versa, with no cast. If PR1
// had renamed the concept into a subtly different shape, exactly one of these
// two lines would stop compiling — a one-directional test would not see it.
const astMatchesProposalNode: readonly [
  Assignable<AuthorityEnvelopeAstMatcher, GovernanceProposalEnvelopeAst>,
  Assignable<GovernanceProposalEnvelopeAst, AuthorityEnvelopeAstMatcher>,
] = [true, true]

// A3-9: the effect vocabulary is structurally RE-DECLARED in domain (domain may
// not import storage), so the re-declaration is pinned to the storage owner's
// type in both directions for the same reason.
const effectVocabularyIsOneSet: readonly [
  Assignable<AuthorityEffect, PermissionOverlayEffect>,
  Assignable<PermissionOverlayEffect, AuthorityEffect>,
] = [true, true]

// A1-18: the PR0 runtime names survive PR1 as ALIASES of the domain types, so
// PR2-PR6 keep compiling and PR7 deletes the aliases rather than migrating
// call sites in six PRs. Both directions again.
const runtimeNamesAreAliases: readonly [
  Assignable<PermissionEnvelopeRule, AuthorityEnvelopeRule>,
  Assignable<AuthorityEnvelopeRule, PermissionEnvelopeRule>,
  Assignable<PermissionResourceMatcher, AuthorityResourceMatcher>,
  Assignable<AuthorityResourceMatcher, PermissionResourceMatcher>,
  Assignable<PermissionMutationEnvelope, AuthorityEnvelope>,
] = [true, true, true, true, true]

// ---------------------------------------------------------------------------
// fixtures
// ---------------------------------------------------------------------------

const FILE = (resource: string): AuthorityResourceMatcher => ({ kind: 'subtree', resource })
const EXACT = (resource: string): AuthorityResourceMatcher => ({ kind: 'exact', resource })
const FP = (resource: string): AuthorityResourceMatcher => ({ kind: 'fingerprint', resource })

/** A canonical containment algebra — deterministic, injected, never guessed. */
const contains = (root: string, child: string): boolean =>
  child === root || child.startsWith(`${root}/`) || child.startsWith(`${root}/**`)

const doc = (rules: readonly { operationClass: string; matcher: AuthorityResourceMatcher; maximumEffect: AuthorityEffect }[]): AuthorityEnvelope => ({ rules })

const EMPTY: AuthorityEnvelope = { rules: [] }
const WRITE_A_ALLOW = doc([{ operationClass: 'write', matcher: FILE('file:/a'), maximumEffect: 'allow' }])
const WRITE_A_ASK = doc([{ operationClass: 'write', matcher: FILE('file:/a'), maximumEffect: 'ask' }])
const WRITE_A_DENY = doc([{ operationClass: 'write', matcher: FILE('file:/a'), maximumEffect: 'deny' }])
const READ_B_ALLOW = doc([{ operationClass: 'read', matcher: EXACT('file:/b'), maximumEffect: 'allow' }])

/** One scope reused across the whole file: a write under `/a`. */
const SCOPE_A = { operationClass: 'write', matcher: FILE('file:/a/sub.txt') }

/** A ceiling reduced to what a decision consumer actually branches on. Used
 *  where the CLAIM is about the ceiling, not about rule attribution — which is
 *  pinned separately, by name, in its own leg below. */
const effectOf = (ceiling: EffectiveCeiling): string =>
  ceiling.status === 'decided' ? ceiling.effect : ceiling.status

const DECIDED = (effect: AuthorityEffect): EffectiveCeiling => ({ status: 'decided', effect, matchedRules: [] })
const UNDETERMINED: EffectiveCeiling = { status: 'undetermined', reason: 'containment-undetermined' }

// ---------------------------------------------------------------------------
// module-level capture
// ---------------------------------------------------------------------------

/** THE blocking case (X5-E3). Written before the algebra existed. */
const blocking = {
  documents: { teamHardEnvelope: EMPTY, permissionMutationEnvelope: WRITE_A_ALLOW } as AuthorityEnvelopeDocuments,
  get leader() {
    return grantCeiling('leader', this.documents, SCOPE_A, contains)
  },
}

/** X5-E3's mirror on the expansion plane: the SAME empty document. */
const expansionOnEmpty = effectiveAuthorityCeiling(EMPTY, 'write', FILE('file:/a/sub.txt'), contains)

/** §7.4.1 positional binding, verbatim from spec:315. */
const positionalLeader = grantCeiling(
  'leader',
  { teamHardEnvelope: WRITE_A_ALLOW, permissionMutationEnvelope: WRITE_A_ASK },
  SCOPE_A,
  contains,
)
const positionalHumanUser = grantCeiling(
  'human-user',
  { teamHardEnvelope: WRITE_A_ALLOW, permissionMutationEnvelope: WRITE_A_ASK },
  SCOPE_A,
  contains,
)
const humanUserCapped = grantCeiling(
  'human-user',
  { teamHardEnvelope: WRITE_A_ASK },
  SCOPE_A,
  contains,
)

/** A1-6: one undecidable same-class subtree rule poisons the whole scope —
 *  relevance filtering is forbidden, so a rule that "probably does not apply"
 *  cannot be quietly dropped. */
const undecidableScope: AuthorityEnvelope = {
  rules: [
    { operationClass: 'write', matcher: FILE('file:/a'), maximumEffect: 'allow' },
    { operationClass: 'write', matcher: FILE('file:/unreachable'), maximumEffect: 'deny' },
  ],
}
/** An EXACT scope, for the legs that need three DISTINCT matchers that all
 *  cover one scope (an exact target is covered by its own identity, by an exact
 *  matcher naming it, and by any subtree root above it). */
const SCOPE_A_EXACT = { operationClass: 'write', matcher: EXACT('file:/a/sub.txt') }

const noPredicate = effectiveAuthorityCeiling(undecidableScope, 'write', FILE('file:/a/sub.txt'))
const otherClassStillUndetermined = effectiveAuthorityCeiling(undecidableScope, 'write', FILE('file:/zzz'))

/** The §24.2 table, generated from its own row/column headers. */
const MEET_ROW_ORDER = [
  DECIDED('deny'),
  DECIDED('ask'),
  DECIDED('allow'),
  CEILING_NO_AUTHORITY,
  UNDETERMINED,
] as const
const MEET_EXPECTED: readonly (readonly string[])[] = [
  ['decided:deny', 'decided:deny', 'decided:deny', 'no-authority', 'undetermined'],
  ['decided:deny', 'decided:ask', 'decided:ask', 'no-authority', 'undetermined'],
  ['decided:deny', 'decided:ask', 'decided:allow', 'no-authority', 'undetermined'],
  ['no-authority', 'no-authority', 'no-authority', 'no-authority', 'undetermined'],
  ['undetermined', 'undetermined', 'undetermined', 'undetermined', 'undetermined'],
]
const meetCell = (a: EffectiveCeiling, b: EffectiveCeiling): string => {
  const m = meetAuthorityCeilings(a, b)
  return m.status === 'decided' ? `decided:${m.effect}` : m.status
}
const meetTable = MEET_ROW_ORDER.map((row) => MEET_ROW_ORDER.map((col) => meetCell(row, col)))

/** One canonicalization, in the plane: file paths through the provider,
 *  fingerprints verbatim, ZERO provider calls for a fingerprint-only doc. */
const canonicalizeCalls: string[] = []
const countingCanonicalize = async (path: string, cwd: string): Promise<string> => {
  canonicalizeCalls.push(`${cwd}|${path}`)
  return `file:${path}`
}
const astDocument: AuthorityEnvelopeAst = {
  rules: [
    { operationClass: 'write', matcher: { kind: 'subtree', path: 'src/**' }, maximumEffect: 'allow' },
    { operationClass: 'bash', matcher: { kind: 'fingerprint', fingerprint: 'sha256:abc' }, maximumEffect: 'ask' },
  ],
}

type Built = { readonly ok: boolean; readonly rules?: readonly { operationClass: string; matcher: AuthorityResourceMatcher; maximumEffect: AuthorityEffect }[]; readonly error?: unknown }
const buildCapture: Built = await (async (): Promise<Built> => {
  try {
    const envelope = await buildAuthorityEnvelope(astDocument, '/work/tree', { canonicalize: countingCanonicalize })
    return { ok: true, rules: envelope.rules }
  } catch (error) {
    return { ok: false, error }
  }
})()

/** Parse: the AST shape survives, and a malformed document is refused. */
const parsed = parseAuthorityEnvelope({
  rules: [
    { operationClass: 'write', matcher: { kind: 'subtree', path: 'src/**' }, maximumEffect: 'allow' },
    { operationClass: 'bash', matcher: { kind: 'fingerprint', fingerprint: 'sha256:abc' }, maximumEffect: 'deny' },
  ],
})
const parsedDuplicatePair = parseAuthorityEnvelope({
  rules: [
    { operationClass: 'write', matcher: { kind: 'subtree', path: 'src/**' }, maximumEffect: 'allow' },
    { operationClass: 'write', matcher: { kind: 'subtree', path: 'src/**' }, maximumEffect: 'deny' },
  ],
})
const parsedShellWithPath = parseAuthorityEnvelope({
  rules: [{ operationClass: 'bash', matcher: { kind: 'subtree', path: 'src/**' }, maximumEffect: 'allow' }],
})
const parsedNotARecord = parseAuthorityEnvelope(null)
const parsedEmpty = parseAuthorityEnvelope({ rules: [] })

// ---------------------------------------------------------------------------
// the deciding point, asserted FIRST
// ---------------------------------------------------------------------------

describe('A4-PR1 lane B — the two lookups, and the meet that must never fuse them', () => {
  it('X5-E3 (BLOCKING) an EMPTY hard envelope plus a matching allow mutation ceiling yields grantCeiling = allow, not no-authority', () => {
    const leader = blocking.leader
    expect(
      `${leader.status}${leader.status === 'decided' ? `/${leader.effect}` : ''}`,
      `got ${JSON.stringify(leader)} — an empty hard envelope read as no-authority would dead-lock every Leader approval (A1-4)`,
    ).toBe('decided/allow')
    // The same documents on the expansion plane say the OPPOSITE thing, and
    // both readings are correct because they answer different questions.
    expect(expansionOnEmpty.status).toBe('no-authority')
  })

  it('X5-E3a the EXPANSION lookup reads an empty document as NO-AUTHORITY, never as identity', () => {
    expect(expansionOnEmpty.status).toBe('no-authority')
    // "rules exist but nothing matches" is the SAME outcome, by the same law.
    expect(effectiveAuthorityCeiling(READ_B_ALLOW, 'write', FILE('file:/a'), contains).status).toBe('no-authority')
    // …and `no-authority` is a real bottom element, not a disguised deny.
    expect(expansionOnEmpty).not.toEqual(DECIDED('deny'))
    expect(meetAuthorityCeilings(CEILING_NO_AUTHORITY, DECIDED('allow'))).toEqual(CEILING_NO_AUTHORITY)
  })

  it('X5-E3b the two lookups are never composed: grantCeiling meets ONLY narrowingForApproval', () => {
    // If grantCeiling folded the EXPANSION lookup in, this cell would be
    // `no-authority` (empty hard envelope) instead of `allow`.
    expect(meetTable[2]?.[2]).toBe('decided:allow')
    // And the expansion plane's own answer is never silently used as an
    // approval ceiling: for the same document and scope they differ.
    const expansion = effectiveAuthorityCeiling(EMPTY, SCOPE_A.operationClass, SCOPE_A.matcher, contains)
    const approval = narrowingForApproval(EMPTY, SCOPE_A, contains)
    expect(expansion.status).toBe('no-authority')
    expect(approval.status).toBe('decided')
    if (approval.status !== 'decided') return
    expect(approval.effect).toBe('allow')
    // …and the identity is exactly what meet's unit must be.
    expect(approval).toEqual(CEILING_IDENTITY)
  })

  it('§5.3 monotonic restriction — adding a rule never raises a ceiling on either plane', () => {
    // The property ADR §29 #2 states is about OVERLAPPING rules on a document
    // that already speaks about the scope: adding one may LOWER the ceiling and
    // must never raise it. (Adding the FIRST rule to an empty document obviously
    // grants what was absent — that is authority being created, not a ceiling
    // being raised, and the lattice leg below pins where the bottom is.)
    const base = doc([{ operationClass: 'write', matcher: FILE('file:/a'), maximumEffect: 'allow' }])
    const plusAsk = doc([
      { operationClass: 'write', matcher: FILE('file:/a'), maximumEffect: 'allow' },
      { operationClass: 'write', matcher: EXACT('file:/a/sub.txt'), maximumEffect: 'ask' },
    ])
    const plusDeny = doc([
      { operationClass: 'write', matcher: FILE('file:/a'), maximumEffect: 'allow' },
      { operationClass: 'write', matcher: EXACT('file:/a/sub.txt'), maximumEffect: 'ask' },
      { operationClass: 'write', matcher: FILE('file:/a/sub.txt'), maximumEffect: 'deny' },
    ])
    const rank = (c: EffectiveCeiling): number =>
      c.status === 'decided' ? AUTHORITY_EFFECT_PRECEDENCE[c.effect] : -1
    const approvals = [base, plusAsk, plusDeny].map((d) => narrowingForApproval(d, SCOPE_A_EXACT, contains))
    for (let i = 1; i < approvals.length; i += 1) {
      const before = approvals[i - 1]
      const after = approvals[i]
      if (before === undefined || after === undefined) continue
      expect(rank(after), `approval step ${String(i)} raised the ceiling`).toBeLessThanOrEqual(rank(before))
    }
    expect(approvals.map(effectOf)).toEqual(['allow', 'ask', 'deny'])
    // The expansion plane over the same three documents: every one of them
    // matches, and the same non-increasing sequence holds.
    const expansions = [base, plusAsk, plusDeny].map((d) => effectiveAuthorityCeiling(d, 'write', SCOPE_A_EXACT.matcher, contains))
    expect(expansions.map(effectOf)).toEqual(['allow', 'ask', 'deny'])
    // ORDER-INDEPENDENCE: a ceiling is a function of the rule SET, not of the
    // order the rules were written in (the hash binds order; the algebra must
    // not, or a re-ordered document would change a decision).
    const reversed = doc([...plusDeny.rules].reverse())
    expect(effectOf(narrowingForApproval(reversed, SCOPE_A_EXACT, contains))).toBe('deny')
    expect(effectOf(effectiveAuthorityCeiling(reversed, 'write', SCOPE_A_EXACT.matcher, contains))).toBe('deny')
    // A rule that does NOT match the scope changes nothing on either plane —
    // restriction must be attributable to a matching rule, never to the
    // document's size.
    expect(effectiveAuthorityCeiling(READ_B_ALLOW, 'write', FILE('file:/a'), contains)).toEqual(expansionOnEmpty)
    expect(narrowingForApproval(READ_B_ALLOW, SCOPE_A, contains)).toEqual(CEILING_IDENTITY)
  })

  it('grantCeiling never exceeds either binding document (meet over the approval plane only)', () => {
    const leader = grantCeiling('leader', { teamHardEnvelope: WRITE_A_ALLOW, permissionMutationEnvelope: WRITE_A_ASK }, SCOPE_A, contains)
    expect(effectOf(leader)).toBe('ask')
    // Whichever document is removed, the ceiling can only stay or rise.
    expect(effectOf(grantCeiling('leader', { permissionMutationEnvelope: WRITE_A_ASK }, SCOPE_A, contains))).toBe('ask')
    expect(effectOf(grantCeiling('leader', { teamHardEnvelope: WRITE_A_ALLOW }, SCOPE_A, contains))).toBe('allow')
    // A document that does not mention the scope contributes NOTHING to the
    // meet — it is not read as deny, and not read as no-authority either.
    expect(effectOf(grantCeiling('leader', { teamHardEnvelope: READ_B_ALLOW, permissionMutationEnvelope: WRITE_A_ASK }, SCOPE_A, contains))).toBe('ask')
    // …and the meet is never BELOW what a single binding document says when the
    // other is silent about the scope (the "never greater than either envelope"
    // direction of ADR §29 #3, checked both ways).
    const capped = grantCeiling('leader', { teamHardEnvelope: WRITE_A_DENY, permissionMutationEnvelope: WRITE_A_ALLOW }, SCOPE_A, contains)
    expect(effectOf(capped)).toBe('deny')
  })

  it('§7.4.1 positional binding — the mutation envelope does not bind a Human User (ADR A5-1)', () => {
    expect(effectOf(positionalLeader)).toBe('ask')
    expect(effectOf(positionalHumanUser)).toBe('allow')
    // The same case with the HARD ceiling at ask is insufficient at Human User.
    expect(effectOf(humanUserCapped)).toBe('ask')
  })

  it('§7.4 bindingDocs is positional: Leader both documents, Human User hard only, Human Admin none', () => {
    const both = { teamHardEnvelope: WRITE_A_ALLOW, permissionMutationEnvelope: WRITE_A_ASK }
    expect(bindingDocs('leader', both).length).toBe(2)
    expect(bindingDocs('human-user', both).length).toBe(1)
    expect(bindingDocs('human-user', both)).toEqual([WRITE_A_ALLOW])
    expect(bindingDocs('human-admin', both)).toEqual([])
    // Human Admin is bound by NO envelope: meet over the empty set is identity.
    expect(grantCeiling('human-admin', both, SCOPE_A, contains)).toEqual(CEILING_IDENTITY)
    // The binding set is a function of the POSITION only — never of the
    // beneficiary, the carrier, or the request kind (ADR A5-1): the same call
    // with different documents keeps the same cardinality per position.
    expect(bindingDocs('human-user', { teamHardEnvelope: WRITE_A_DENY }).length).toBe(1)
  })

  it('bindingDocs has an explicit arm for every position and NO default branch', () => {
    const positions: readonly ProposalAuthorityPosition[] = ['member', 'leader', 'human-user', 'human-admin']
    const both = { teamHardEnvelope: WRITE_A_ALLOW, permissionMutationEnvelope: WRITE_A_ASK }
    // Every member of the closed union is answered explicitly…
    const answered = positions.map((p) => {
      try {
        return bindingDocs(p, both).length
      } catch {
        return 'refused'
      }
    })
    expect(answered).toEqual(['refused', 2, 1, 0])
    // …and the module carries no `default:` arm to fall through into.
    const source = bindingDocsSource
    expect(source).not.toMatch(/\bdefault\s*:/)
    for (const position of positions) {
      expect(source, `missing explicit arm for ${position}`).toContain(`case '${position}'`)
    }
  })

  it('bindingDocs — Member is not a reviewer of its own expansion', () => {
    // spec §7.4:307 — "a Member cannot review at all". There is no document set
    // to hand out, so the table REFUSES rather than inventing a fourth row or
    // quietly inheriting the Leader row (which would give a later PR a ceiling
    // to consult for a reviewer that must not exist).
    let refused: unknown
    try {
      bindingDocs('member', { teamHardEnvelope: WRITE_A_ALLOW, permissionMutationEnvelope: WRITE_A_ASK })
    } catch (error) {
      refused = error
    }
    expect(refused, 'bindingDocs(member) must refuse').toBeInstanceOf(Error)
    const asError = refused as { code?: string; problem?: string }
    expect(asError.code).toBe('AUTHORITY_BINDING_DEFECT')
    expect(asError.problem).toBe('position-is-not-a-reviewer')
    // grantCeiling inherits the refusal — it cannot be reached around.
    let ceilingRefused: unknown
    try {
      grantCeiling('member', { teamHardEnvelope: WRITE_A_ALLOW }, SCOPE_A, contains)
    } catch (error) {
      ceilingRefused = error
    }
    expect(ceilingRefused).toBeInstanceOf(Error)
  })

  it('§24.2 meet table — every pairing, including undetermined absorbing', () => {
    expect(meetTable).toEqual(MEET_EXPECTED)
    // Symmetry: meet is a meet, so it must not depend on argument order.
    for (const [i, row] of MEET_ROW_ORDER.entries()) {
      for (const [j, col] of MEET_ROW_ORDER.entries()) {
        expect(meetCell(row, col), `asymmetry at ${String(i)},${String(j)}`).toBe(meetCell(col, row))
      }
    }
    // undetermined ABSORBS everything, including itself and the bottom.
    for (const other of MEET_ROW_ORDER) {
      expect(meetAuthorityCeilings(UNDETERMINED, other)).toEqual(UNDETERMINED)
    }
    // identity is the unit of meet, so a meet over no documents is exactly it.
    expect(meetAuthorityCeilings(CEILING_IDENTITY, DECIDED('ask'))).toEqual(DECIDED('ask'))
    expect(meetAllAuthorityCeilings([])).toEqual(CEILING_IDENTITY)
    expect(meetAllAuthorityCeilings([DECIDED('allow'), DECIDED('ask'), DECIDED('allow')])).toEqual(DECIDED('ask'))
    expect(meetAllAuthorityCeilings([DECIDED('allow'), UNDETERMINED, DECIDED('deny')])).toEqual(UNDETERMINED)
  })

  it('A1-5 the lattice is total and ordered no-authority < deny < ask < allow', () => {
    expect([...AUTHORITY_EFFECT_VALUES]).toEqual(['allow', 'ask', 'deny'])
    expect(AUTHORITY_EFFECT_PRECEDENCE).toEqual({ deny: 0, ask: 1, allow: 2 })
    expect([...AUTHORITY_MATCHER_KINDS]).toEqual(['exact', 'subtree', 'fingerprint'])
    // The bottom element is named, not implied by an empty match list.
    expect(CEILING_NO_AUTHORITY).toEqual({ status: 'no-authority' })
    expect(meetAuthorityCeilings(CEILING_NO_AUTHORITY, UNDETERMINED)).toEqual(UNDETERMINED)
  })

  it('A1-6 an undecidable same-class subtree rule forces whole-scope undetermined (no relevance filtering)', () => {
    expect(noPredicate).toEqual(UNDETERMINED)
    // The target sits under the DECIDABLE rule. The undecidable one is not
    // filtered out as "probably irrelevant" — that filtering is what A1-6
    // forbids, because it is how a degraded filesystem seam becomes authority.
    expect(otherClassStillUndetermined).toEqual(UNDETERMINED)
    // The approval plane honors the same law (an approvable set cannot be
    // computed from a partially-evaluated document).
    expect(narrowingForApproval(undecidableScope, SCOPE_A)).toEqual(UNDETERMINED)
    // A DIFFERENT operation class is unaffected — undetermined is scoped to the
    // class whose rules could not be decided, not to the whole document.
    expect(narrowingForApproval(undecidableScope, { operationClass: 'read', matcher: EXACT('file:/b') }, contains)).toEqual(CEILING_IDENTITY)
  })

  it('matcherCovers keeps its fail-closed order: identity BEFORE the containment seam', () => {
    // A5-12/A2-4: the kernel's existing semantics are DELEGATED, not
    // reimplemented, so the ordering the consumption sites depend on survives —
    // `EXPANSION_OUTSIDE_ENVELOPE` and `EFFECT_CONTEXT_UNAVAILABLE` are
    // different answers and the fold that separates them lives here.
    const root = FILE('file:/a')
    expect(matcherCovers(root, FILE('file:/a'))).toEqual({ covers: true, undeterminable: false })
    expect(matcherCovers(root, FILE('file:/a/x'), undefined)).toEqual({ covers: false, undeterminable: true })
    expect(matcherCovers(root, FILE('file:/a/x'), contains)).toEqual({ covers: true, undeterminable: false })
    // exec stays exact-only, and cross-class never covers.
    expect(matcherCovers(FP('sha256:abc'), FP('sha256:abc'))).toEqual({ covers: true, undeterminable: false })
    expect(matcherCovers(FP('sha256:abc'), FP('sha256:def'))).toEqual({ covers: false, undeterminable: false })
    expect(matcherCovers(FP('sha256:abc'), FILE('file:/a'), contains)).toEqual({ covers: false, undeterminable: false })
    expect(matcherCovers(EXACT('file:/a'), FILE('file:/a/b'), contains)).toEqual({ covers: false, undeterminable: false })
    // ONE implementation, not two: the kernel's exported name IS this one.
    expect(matcherCovers).toBe(kernelMatcherCovers)
  })

  it('one canonicalization — the plane resolves file paths and carries fingerprints verbatim', () => {
    expect(buildCapture.ok, JSON.stringify(buildCapture.error)).toBe(true)
    if (!buildCapture.ok) return
    expect(buildCapture.rules).toEqual([
      { operationClass: 'write', matcher: { kind: 'subtree', resource: 'file:src/**' }, maximumEffect: 'allow' },
      { operationClass: 'bash', matcher: { kind: 'fingerprint', resource: 'sha256:abc' }, maximumEffect: 'ask' },
    ])
    // Exactly ONE provider call for two rules: the fingerprint never reaches
    // the filesystem (it already IS a canonical identity).
    expect(canonicalizeCalls).toEqual(['/work/tree|src/**'])
    // The runtime document is the {kind, resource} shape, never the AST one.
    const json = JSON.stringify(buildCapture.rules)
    expect(json).not.toContain('"path"')
    expect(json).toContain('"resource"')
  })

  it('A3-9 the shared grammar is a LEAF — the AST vocabulary matches PR0 and blueprint, both directions', () => {
    expect([...astMatchesProposalNode]).toEqual([true, true])
    expect([...effectVocabularyIsOneSet]).toEqual([true, true])
    expect([...runtimeNamesAreAliases]).toEqual([true, true, true, true, true])
    // The kind set is the one PR0 froze (`PROPOSAL_ENVELOPE_AST_KINDS`).
    const proposalKinds: readonly string[] = ['exact', 'subtree', 'fingerprint']
    expect([...AUTHORITY_MATCHER_KINDS]).toEqual(proposalKinds)
    // The operation-class vocabulary is MIRRORED (domain stays the leaf) and
    // pinned here, so a drift in either is red rather than silent.
    expect([...AUTHORITY_OPERATION_CLASSES].slice().sort()).toEqual([...PERMISSION_TOOL_NAMES].slice().sort())
    // The precedence object the hygiene test pins by IDENTITY is this object.
    expect(PERMISSION_EFFECT_PRECEDENCE).toBe(AUTHORITY_EFFECT_PRECEDENCE)
  })

  it('parseAuthorityEnvelope returns the DECLARED AST shape and refuses a malformed document', () => {
    expect(parsed.ok, JSON.stringify(parsed.ok ? null : parsed.problems)).toBe(true)
    if (!parsed.ok) return
    // X5-E2: the parser hands back the AST (`{kind, path|fingerprint}`), NOT the
    // runtime `{kind, resource}` — canonicalization is the plane's, once.
    expect(parsed.envelope.rules[0]?.matcher).toEqual({ kind: 'subtree', path: 'src/**' })
    expect(parsed.envelope.rules[1]?.matcher).toEqual({ kind: 'fingerprint', fingerprint: 'sha256:abc' })
    // An empty document parses: it is a legal declaration, not an error.
    expect(parsedEmpty.ok).toBe(true)
    // Refusals, each with a closed problem code.
    expect(parsedNotARecord.ok).toBe(false)
    if (parsedNotARecord.ok) return
    expect(parsedNotARecord.problems.map((p) => p.problem)).toContain('envelope-not-a-record')
    expect(parsedDuplicatePair.ok).toBe(false)
    if (parsedDuplicatePair.ok) return
    expect(parsedDuplicatePair.problems.map((p) => p.problem)).toContain('duplicate-envelope-pair')
    expect(parsedShellWithPath.ok).toBe(false)
    if (parsedShellWithPath.ok) return
    expect(parsedShellWithPath.problems.map((p) => p.problem)).toContain('matcher-class-mismatch')
  })

  it('a declared deny narrows to nothing, and absence never does (plan :26 — deny is terminal)', () => {
    // A DECLARED deny on the approval plane means no approval is legal at that
    // scope; it is reachable ONLY through a rule, never through its absence.
    expect(effectOf(grantCeiling('leader', { teamHardEnvelope: WRITE_A_DENY }, SCOPE_A, contains))).toBe('deny')
    expect(narrowingForApproval(EMPTY, SCOPE_A, contains)).toEqual(CEILING_IDENTITY)
    expect(effectOf(narrowingForApproval(WRITE_A_DENY, SCOPE_A, contains))).toBe('deny')
  })

  it('a decided ceiling names the rules that decided it (matchedRules is provenance, not debug output)', () => {
    // The lookup says WHICH rule said so: ADR A1-14's consumption-point recheck
    // and the audit ledger both need it, and an answer that cannot be
    // attributed cannot be defended.
    const one = effectiveAuthorityCeiling(WRITE_A_ASK, 'write', FILE('file:/a/sub.txt'), contains)
    expect(one.status).toBe('decided')
    if (one.status !== 'decided') return
    expect(one.matchedRules).toEqual([0])
    // The identity and the two non-decided statuses carry no attribution,
    // because there is no deciding rule to name.
    const nothingMatched = narrowingForApproval(EMPTY, SCOPE_A, contains)
    expect(nothingMatched.status).toBe('decided')
    if (nothingMatched.status !== 'decided') return
    expect(nothingMatched.matchedRules).toEqual([])
    expect(CEILING_NO_AUTHORITY.status).toBe('no-authority')
    // A tie between two rules of ONE document names both.
    const tied = doc([
      { operationClass: 'write', matcher: FILE('file:/a'), maximumEffect: 'ask' },
      { operationClass: 'write', matcher: FILE('file:/a'), maximumEffect: 'ask' },
    ])
    const tie = effectiveAuthorityCeiling(tied, 'write', FILE('file:/a/sub.txt'), contains)
    if (tie.status !== 'decided') return
    expect(tie.matchedRules).toEqual([0, 1])
  })
})
