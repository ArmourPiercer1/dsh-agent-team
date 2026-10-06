/**
 * A4-PR1 lane A — Blueprint schema **v3** as an ADDITIVE carrier (plan Task 1
 * lane A; ADR A2-2/A2-11, A3-9, A5-19; spec §3.2/§3.3/§3.4).
 *
 * What v3 is, precisely: the v2 document plus ONE new required top-level
 * field, `teamHardEnvelope`, and ONE new hard requirement on a field that has
 * been optional at every version until now (`permissionMutationEnvelope`,
 * ADR A1-19 — "Schema v3 makes it required — a NEW HARD REQUIREMENT, not a
 * retention"). Nothing else changes. That narrowness is the whole point of
 * lane A, and it is what this file polices from both sides:
 *
 *  1. **v3 admits exactly `v2 + teamHardEnvelope`.** Closedness here is not a
 *     new mechanism: `assertNoUnknownFields` runs at every sub-structure in
 *     `validate.ts`, and the TOP-LEVEL set has been version-gated since plan
 *     §E.2 (`schemaVersion === 2 ? …V2 : …`). The mapping gains a third arm,
 *     so a v3 document smuggling a new key is refused exactly the way a v2
 *     document smuggling `teamHardEnvelope` is refused.
 *
 *  2. **v1/v2 are frozen, including in hash.** ADR A2-4 forbids any v1/v2
 *     behaviour change in PR1, and A2-11 makes the concrete demand: the v1/v2
 *     hashable projection must stay BYTE-IDENTICAL, which holds only if
 *     `teamHardEnvelope` enters `toHashableBlueprint` KEY-OMITTED and only for
 *     v3 (the same "absent → key omitted" discipline the file already
 *     documents for `permissions` and `teamRequirements`). Two of this file's
 *     legs are therefore literal goldens, not self-comparisons: the existing
 *     hash specs re-parse a source and compare the result to itself or to
 *     `deriveContentHash(toHashableBlueprint(x))`, which re-derives from the
 *     very projection under test — they cannot see drift, they only see
 *     non-determinism. A literal is the only thing that can.
 *
 *  3. **the AST stays an AST.** The document carries the DECLARED shape
 *     (`matcher: {kind, path}` / `{kind, fingerprint}`); canonical identity
 *     belongs to the runtime plane (ADR A2-3). A v3 document can never carry
 *     a canonicalized `{kind, resource}` rule, and the validator never calls
 *     a filesystem provider (leg A11 proves the provider-free property).
 *
 * Test pattern of this repo (the plain-node shim's `it` is synchronous): the
 * scenarios run at module top level with the assertions captured; the `it`
 * bodies assert captured values.
 *
 * @module @dsh-agent-team/domain/test/a4p1-blueprint-v3-governance
 */

import { describe, expect, it } from 'vitest'

import {
  BLUEPRINT_TOP_LEVEL_FIELDS,
  BLUEPRINT_TOP_LEVEL_FIELDS_V2,
  SUPPORTED_BLUEPRINT_DOCUMENT_VERSIONS,
  deriveContentHash,
  parseBlueprint,
  toHashableBlueprint,
} from '../blueprint/src/index.js'
// Read through the module NAMESPACE on purpose: the v3 field-set constant is
// the API this lane adds, and a namespace read yields `undefined` before it
// exists — so the lane goes RED on the ASSERTION (the v3 set is missing)
// instead of dying at import time with nothing but a collection error.
import * as blueprintSchema from '../blueprint/src/schema.js'
// The negative fixture is imported rather than re-typed here so the derivation
// below is checked against the SAME document the shared fixture feeds to the
// pre-existing validation suite.
import { NEG_SCHEMA_VERSION_MISMATCH } from '../blueprint/testdata/fixtures.js'
import { expectCode } from './t2-helpers.js'

// ---------------------------------------------------------------------------
// fixtures
// ---------------------------------------------------------------------------

/** The body shared by every fixture: leader + one member + the v2 shape. */
function bodyLines(version: 1 | 2 | 3): string[] {
  return [
    '---',
    `schemaVersion: ${version}`,
    `blueprintId: team.a4p1.v${version}`,
    'revision: "1"',
    'leader:',
    '  templateId: leader',
    '  persona: "Lead."',
    'members:',
    '  - templateId: worker',
    '    persona: "Worker."',
    'requirements: []',
    'memberEnvelopes: []',
    'policyStates: []',
    'metadata: {}',
  ]
}

/** One authority-document block in the DECLARED (AST) shape. */
function authorityBlock(field: string, rules: readonly string[]): string[] {
  if (rules.length === 0) return [`${field}:`, '  rules: []']
  return [`${field}:`, '  rules:', ...rules]
}

function rule(
  operationClass: string,
  matcherLines: readonly string[],
  maximumEffect: string,
): string[] {
  return [
    `    - operationClass: ${operationClass}`,
    '      matcher:',
    ...matcherLines,
    `      maximumEffect: ${maximumEffect}`,
  ]
}

const FILE_ALLOW = rule('write', ['        kind: subtree', '        path: "src/**"'], 'allow')
const FILE_ASK = rule('read', ['        kind: exact', '        path: "docs/README.md"'], 'ask')
const EXEC_ALLOW = rule('bash', ['        kind: fingerprint', '        fingerprint: "fp:ls-la"'], 'allow')

const MUTATION_ENVELOPE = authorityBlock('permissionMutationEnvelope', FILE_ALLOW)
const HARD_ENVELOPE = authorityBlock('teamHardEnvelope', FILE_ASK)

/** A complete, valid v3 document. */
const V3_SOURCE: readonly string[] = [
  ...bodyLines(3).slice(0, -1),
  ...MUTATION_ENVELOPE,
  ...HARD_ENVELOPE,
  'metadata: {}',
  '---',
]

/** The same v3 document whose hard envelope declares NO rules. */
const V3_EMPTY_HARD: readonly string[] = [
  ...bodyLines(3).slice(0, -1),
  ...MUTATION_ENVELOPE,
  ...authorityBlock('teamHardEnvelope', []),
  'metadata: {}',
  '---',
]

/** The v2 bridge fixture — its contentHash is a literal golden below. */
const V2_SOURCE: readonly string[] = [
  ...bodyLines(2).slice(0, -1),
  'teamRequirements: []',
  'metadata: {}',
  '---',
]

/** The v1 bridge fixture, likewise. */
const V1_SOURCE: readonly string[] = [...bodyLines(1), '---']

/** A v2 document that smuggles the v3-only key. */
const V2_WITH_HARD: readonly string[] = [
  ...bodyLines(2).slice(0, -1),
  'teamRequirements: []',
  ...authorityBlock('teamHardEnvelope', []),
  'metadata: {}',
  '---',
]

/** A v1 document that smuggles the v3-only key. */
const V1_WITH_HARD: readonly string[] = [...bodyLines(1).slice(0, -1), ...authorityBlock('teamHardEnvelope', []), 'metadata: {}', '---']

// ---------------------------------------------------------------------------
// module-level capture (the `it` bodies below are synchronous)
// ---------------------------------------------------------------------------

type ParseOutcome =
  | { readonly ok: true; readonly bp: ReturnType<typeof parseBlueprint> }
  | { readonly ok: false; readonly error: unknown }

/** Parse a fixture, capturing success OR the thrown contract error. Parsing
 *  at module level is the repo pattern: a fixture that fails to build cannot
 *  silently turn an assertion into a vacuous pass. */
function attempt(source: readonly string[]): ParseOutcome {
  try {
    return { ok: true, bp: parseBlueprint(source.join('\n')) }
  } catch (error) {
    return { ok: false, error }
  }
}

/** The message of a captured failure, for failure diagnostics. */
function failureOf(outcome: ParseOutcome): string {
  return outcome.ok ? '(parsed)' : String((outcome.error as Error)?.message ?? outcome.error)
}

const v3 = attempt(V3_SOURCE)
const v3EmptyHard = attempt(V3_EMPTY_HARD)
const v2 = attempt(V2_SOURCE)
const v1 = attempt(V1_SOURCE)
const v2WithHard = attempt(V2_WITH_HARD)
const v1WithHard = attempt(V1_WITH_HARD)
/** v3 carrying the mutation envelope but NO hard envelope (must be refused). */
const v3NoHard = attempt([
  ...bodyLines(3).slice(0, -1),
  ...MUTATION_ENVELOPE,
  'metadata: {}',
  '---',
])
/** v3 carrying NEITHER authority document (both are required at v3). */
const v3NoEnvelopes = attempt([...bodyLines(3), '---'])
/** v3 with the mutation envelope missing entirely (ADR A1-19: also required). */
const v3NoMutation = attempt([...bodyLines(3).slice(0, -1), ...HARD_ENVELOPE, 'metadata: {}', '---'])
/** v3 whose hard envelope declares a shell rule with a file matcher (mispair). */
const v3ShellFileMatcher = attempt([
  ...bodyLines(3).slice(0, -1),
  ...MUTATION_ENVELOPE,
  ...authorityBlock('teamHardEnvelope', rule('bash', ['        kind: subtree', '        path: "src/**"'], 'allow')),
  'metadata: {}',
  '---',
])
/** v3 whose hard envelope declares a file rule with a fingerprint (mispair). */
const v3FileFingerprint = attempt([
  ...bodyLines(3).slice(0, -1),
  ...MUTATION_ENVELOPE,
  ...authorityBlock('teamHardEnvelope', rule('write', ['        kind: fingerprint', '        fingerprint: "fp:ls-la"'], 'allow')),
  'metadata: {}',
  '---',
])
/** v3 whose hard envelope rule carries an unknown field. */
const v3UnknownRuleField = attempt([
  ...bodyLines(3).slice(0, -1),
  ...MUTATION_ENVELOPE,
  ...authorityBlock('teamHardEnvelope', [...FILE_ASK.slice(0, -1), '        smuggledField: 1', ...FILE_ASK.slice(-1)]),
  'metadata: {}',
  '---',
])
/** v3 whose hard envelope declares an effect outside the closed ladder. */
const v3BadEffect = attempt([
  ...bodyLines(3).slice(0, -1),
  ...MUTATION_ENVELOPE,
  ...authorityBlock('teamHardEnvelope', rule('read', ['        kind: exact', '        path: "a"'], 'granted')),
  'metadata: {}',
  '---',
])
/** v3 with a duplicate (operationClass, matcher) pair in the hard envelope. */
const v3DuplicatePair = attempt([
  ...bodyLines(3).slice(0, -1),
  ...MUTATION_ENVELOPE,
  ...authorityBlock('teamHardEnvelope', [...FILE_ASK, ...FILE_ASK.map((line) => line.replace('maximumEffect: ask', 'maximumEffect: deny'))]),
  'metadata: {}',
  '---',
])
/** v3 carrying an unknown TOP-LEVEL key (the closed set must be exactly v2 + teamHardEnvelope). */
const v3UnknownTopLevel = attempt([...V3_SOURCE.slice(0, -2), 'futureField: 1', 'metadata: {}', '---'])
/** v3 carrying an EXEC rule (fingerprint only, legal). */
const v3Exec = attempt([
  ...bodyLines(3).slice(0, -1),
  ...MUTATION_ENVELOPE,
  ...authorityBlock('teamHardEnvelope', EXEC_ALLOW),
  'metadata: {}',
  '---',
])
/** A second parse of each bridge fixture, for the byte-identity legs. */
const v1Again = attempt(V1_SOURCE)
const v2Again = attempt(V2_SOURCE)
/** A v3 that differs from V3_SOURCE ONLY in its hard envelope. */
const v3HardVariant = attempt([
  ...bodyLines(3).slice(0, -1),
  ...MUTATION_ENVELOPE,
  ...authorityBlock('teamHardEnvelope', FILE_ALLOW),
  'metadata: {}',
  '---',
])

// ---------------------------------------------------------------------------
// GOLDEN literals — measured on the PRE-v3 tree (HEAD 3c310342, before any
// lane-A source change), never re-derived here.
// ---------------------------------------------------------------------------

/** A v1 document's content hash, frozen since before Alpha.4 exists. */
const V1_GOLDEN_HASH = 'sha256:d25ea1cfb50079083fb0dbc0c6dc39fbc8d7f735aa1e5ae2226b8d054df972bc'
/** A v2 document's content hash, frozen since plan §E.2. */
const V2_GOLDEN_HASH = 'sha256:d6368916c88577e290fe0a929a48415d9f70d8f512db0c7895f7a6b12ead92d8'

describe('A4-PR1 lane A — Blueprint v3 is an additive carrier (v1/v2 untouched)', () => {
  it('V1 SUPPORTED_BLUEPRINT_DOCUMENT_VERSIONS is widened to 1|2|3 (ADR A2-11, temporary PR1-PR6 bridge)', () => {
    expect([...SUPPORTED_BLUEPRINT_DOCUMENT_VERSIONS]).toEqual([1, 2, 3])
    // The REFUSAL carries the set, DERIVED from this constant — which is what
    // `testdata/fixtures.ts` means when it moves the witness to v4 and declines
    // to pin the `supported` detail there. The derivation is pinned at the
    // constant, not at the fixture: a future widening (or PR7's collapse to
    // `[3]`) must move the error text with it, never strand a stale list in a
    // message an operator reads.
    let refused: unknown
    try {
      parseBlueprint(NEG_SCHEMA_VERSION_MISMATCH.source) // the fixture's text, verbatim
    } catch (error) {
      refused = error
    }
    expect(refused, 'schemaVersion 4 must still be refused').toBeDefined()
    const error = refused as { code?: string; details?: { supported?: readonly number[] } }
    expect(error.code).toBe('SCHEMA_VERSION_MISMATCH')
    expect(error.details?.supported).toEqual([...SUPPORTED_BLUEPRINT_DOCUMENT_VERSIONS])
  })

  it('V2 a v3 document carrying both authority documents parses', () => {
    expect(v3.ok, failureOf(v3)).toBe(true)
    if (!v3.ok) return
    expect(v3.bp.schemaVersion).toBe(3)
    expect(v3.bp.permissionMutationEnvelope === undefined, 'mutation envelope must be carried').toBe(false)
    expect(v3.bp.teamHardEnvelope === undefined, 'hard envelope must be carried').toBe(false)
  })

  it('V3 the v3 document keeps the DECLARED AST shape: a file matcher carries `path`, never a canonical `resource` (ADR A2-3)', () => {
    expect(v3.ok, failureOf(v3)).toBe(true)
    if (!v3.ok) return
    const matcher = v3.bp.teamHardEnvelope?.rules[0]?.matcher as Record<string, unknown> | undefined
    expect(matcher?.kind).toBe('exact')
    expect(matcher?.path).toBe('docs/README.md')
    expect(Object.hasOwn(matcher ?? {}, 'resource')).toBe(false)
    // No rule of either document was canonicalized into `{kind, resource}` —
    // that shape is the runtime plane's, and it does not exist here yet.
    expect(JSON.stringify(v3.bp.teamHardEnvelope)).not.toContain('"resource"')
  })

  it('V4 v3 REQUIRES teamHardEnvelope — absence is a typed refusal, never an implicit wide grant (spec §3.2)', () => {
    const err = expectCode(() => {
      if (!v3NoHard.ok) throw v3NoHard.error
    }, 'MALFORMED_DTO')
    expect(String(err.message)).toContain('teamHardEnvelope')
  })

  it('V5 v3 REQUIRES permissionMutationEnvelope (ADR A1-19: a new hard requirement at v3 only)', () => {
    const err = expectCode(() => {
      if (!v3NoMutation.ok) throw v3NoMutation.error
    }, 'MALFORMED_DTO')
    expect(String(err.message)).toContain('permissionMutationEnvelope')
    // A v3 with neither names the mutation envelope first and still refuses.
    expect(v3NoEnvelopes.ok).toBe(false)
    // And the requirement is v3-only: the identical v2 document (no authority
    // documents at all) is the pre-v3 shape and must still parse.
    expect(v2.ok, failureOf(v2)).toBe(true)
  })

  it('V6 `rules: []` is a legal declaration in either document and survives validation (spec §3.4)', () => {
    expect(v3EmptyHard.ok, failureOf(v3EmptyHard)).toBe(true)
    if (!v3EmptyHard.ok) return
    expect(v3EmptyHard.bp.teamHardEnvelope?.rules).toEqual([])
    // The empty document is still hash-bound and still PRESENT in the core.
    expect(Object.hasOwn(v3EmptyHard.bp, 'teamHardEnvelope')).toBe(true)
  })

  it('V7 file classes accept exact AND subtree; the shell class accepts fingerprint (spec §3.3)', () => {
    expect(v3Exec.ok, failureOf(v3Exec)).toBe(true)
    if (!v3Exec.ok) return  // diagnostics above carry the message
    const matcher = v3Exec.bp.teamHardEnvelope?.rules[0]?.matcher as Record<string, unknown> | undefined
    expect(matcher?.kind).toBe('fingerprint')
    // The fingerprint is carried VERBATIM — this layer canonicalizes nothing.
    expect(matcher?.fingerprint).toBe('fp:ls-la')
  })

  it('V8 a shell-class rule with a file matcher is refused, never silently inert', () => {
    expectCode(() => {
      if (!v3ShellFileMatcher.ok) throw v3ShellFileMatcher.error
    }, 'MALFORMED_DTO')
  })

  it('V9 a file-class rule with a fingerprint matcher is refused (no `any`, no cross-class pairing)', () => {
    expectCode(() => {
      if (!v3FileFingerprint.ok) throw v3FileFingerprint.error
    }, 'MALFORMED_DTO')
  })

  it('V10 the parse entry has NO provider surface — arity 1, source in, document out (ADR A2-3)', () => {
    // Round-1 review nit: this leg used to assert `expect(v3.ok).toBe(true)`,
    // which is a precondition of a dozen legs below and proves nothing about the
    // claim in its own title. The claim (ADR A2-3: the shared grammar is a pure
    // domain leaf, with no filesystem provider to inject) IS checkable, and the
    // checkable form is the SEAM: `parseBlueprint(source: string)` takes exactly
    // one parameter, so there is no argument position where a provider, a
    // canonicalizer, or a `cwd` could arrive. A PR that widens the entry to
    // accept one has to change this line and then say why in review.
    //
    // This is also what makes the v3 field safe to hash: the bytes of the hard
    // envelope can only have come from the document, never from a host lookup —
    // the same reason `buildAuthorityEnvelope` stays the single canonicalizer on
    // the runtime side (X5-E2).
    expect(parseBlueprint.length).toBe(1)
    // And the v3 document this lane hashes did come from text alone: the parse
    // outcome below is the one V3-V9 and V18-V20 all read, captured by
    // `attempt()` with no second argument available to pass.
    expect(v3.ok, failureOf(v3)).toBe(true)
  })

  it('V11 unknown rule field, out-of-vocabulary effect, and a duplicate pair all fail closed', () => {
    for (const bad of [v3UnknownRuleField, v3BadEffect, v3DuplicatePair]) {
      expect(bad.ok).toBe(false)
      if (bad.ok) continue
      expect((bad.error as { code?: string }).code).toBe('MALFORMED_DTO')
    }
  })

  it('V12 the v3 top-level closed set is EXACTLY the v2 set plus teamHardEnvelope', () => {
    const v2Set = new Set(BLUEPRINT_TOP_LEVEL_FIELDS_V2)
    const v3Fields = (blueprintSchema as Record<string, unknown>).BLUEPRINT_TOP_LEVEL_FIELDS_V3 as readonly string[] | undefined
    expect(v3Fields, 'BLUEPRINT_TOP_LEVEL_FIELDS_V3 must be exported by the schema module').toBeDefined()
    const v3Set = new Set(v3Fields ?? [])
    const added = [...v3Set].filter((field) => !v2Set.has(field))
    const removed = [...v2Set].filter((field) => !v3Set.has(field))
    expect(added).toEqual(['teamHardEnvelope'])
    expect(removed).toEqual([])
    // …and v2 is itself still exactly v1 + teamRequirements (§E.2, unperturbed).
    expect([...new Set(BLUEPRINT_TOP_LEVEL_FIELDS_V2)].filter((f) => !new Set(BLUEPRINT_TOP_LEVEL_FIELDS).has(f))).toEqual(['teamRequirements'])
    // The parser agrees with the constant: an unknown top-level key is refused.
    expect(v3UnknownTopLevel.ok).toBe(false)
  })

  it('V13 a v2 document must STILL reject `teamHardEnvelope` (the version→closed-set mapping is version-gated)', () => {
    const err = expectCode(() => {
      if (!v2WithHard.ok) throw v2WithHard.error
    }, 'MALFORMED_DTO')
    expect(String(err.message)).toContain('teamHardEnvelope')
  })

  it('V14 a v1 document rejects it too (the v1 validator stays frozen)', () => {
    expect(v1WithHard.ok).toBe(false)
  })

  it('V15 v1/v2 still parse during the temporary bridge (ADR A2-4)', () => {
    expect(v1.ok, failureOf(v1)).toBe(true)
    expect(v2.ok, failureOf(v2)).toBe(true)
  })

  it('V16 GOLDEN: the v1 and v2 content hashes are BYTE-IDENTICAL to the pre-v3 literals (ADR A2-11)', () => {
    // Literal goldens measured on the PRE-v3 tree. The repo's other hash
    // specs re-parse and self-compare, or compare against
    // deriveContentHash(toHashableBlueprint(x)) — which re-derives from the
    // projection under test. Neither can see a projection that changed shape
    // while staying deterministic. These two literals can.
    if (!v1.ok || !v2.ok || !v1Again.ok || !v2Again.ok) return
    expect(v1.bp.contentHash).toBe(V1_GOLDEN_HASH)
    expect(v1Again.bp.contentHash).toBe(V1_GOLDEN_HASH)
    expect(v2.bp.contentHash).toBe(V2_GOLDEN_HASH)
    expect(v2Again.bp.contentHash).toBe(V2_GOLDEN_HASH)
    // A third, structure-level backstop that does not depend on hashing at
    // all: the committed JSON of the v2 projection carries no v3 key.
    expect(JSON.stringify(toHashableBlueprint(v2.bp))).not.toContain('teamHardEnvelope')
  })

  it('V17 the v1/v2 hashable projections carry NO teamHardEnvelope key (key-omitted, not null)', () => {
    if (!v1.ok || !v2.ok) return
    expect(Object.hasOwn(toHashableBlueprint(v1.bp) as Record<string, unknown>, 'teamHardEnvelope')).toBe(false)
    expect(Object.hasOwn(toHashableBlueprint(v2.bp) as Record<string, unknown>, 'teamHardEnvelope')).toBe(false)
    // …and neither carries a v3-derived null either.
    expect(JSON.stringify(toHashableBlueprint(v1.bp))).not.toContain('teamHardEnvelope')
  })

  it('V18 the v3 hash BINDS teamHardEnvelope: one bit of the hard envelope moves the hash', () => {
    expect(v3.ok, failureOf(v3)).toBe(true)
    expect(v3HardVariant.ok, failureOf(v3HardVariant)).toBe(true)
    if (!v3.ok || !v3HardVariant.ok) return
    expect(v3.bp.contentHash).not.toBe(v3HardVariant.bp.contentHash)
    // Both are still v3 documents differing ONLY in that document's content.
    expect(v3.bp.schemaVersion).toBe(v3HardVariant.bp.schemaVersion)
    expect(v3.bp.permissionMutationEnvelope).toEqual(v3HardVariant.bp.permissionMutationEnvelope)
  })

  it('V19 the v3 projection carries teamHardEnvelope with the DECLARED AST shape (committed JSON)', () => {
    expect(v3.ok, failureOf(v3)).toBe(true)
    if (!v3.ok) return
    const projection = toHashableBlueprint(v3.bp) as Record<string, unknown>
    expect(Object.hasOwn(projection, 'teamHardEnvelope')).toBe(true)
    expect(projection.teamHardEnvelope).toEqual({
      rules: [
        {
          operationClass: 'read',
          matcher: { kind: 'exact', path: 'docs/README.md' },
          maximumEffect: 'ask',
        },
      ],
    })
  })

  it('V20 the v3 hash is still just deriveContentHash over the projection (no new hash mechanism)', () => {
    expect(v3.ok, failureOf(v3)).toBe(true)
    if (!v3.ok) return
    expect(v3.bp.contentHash).toBe(deriveContentHash(toHashableBlueprint(v3.bp)))
  })
})
