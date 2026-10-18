/**
 * a5fl2 — the M-3 envelope Scope extension, GRAMMAR + COVERAGE half of the
 * atomic pair (VNEXT-SCHEMA-ADR §1-D1【迁】/ §3 M-3; landed same-stroke as the
 * v4 flip because "effect-face scope half-landed with a runnable v4" is the
 * parse-accept/runtime-unmap crack the flip-PREP named).
 *
 * Pinned here (domain side):
 *  1. the DELTA table is exactly {fs-metadata, network-destination,
 *     domain-reference} — fs read/write are NOT new, the tool-name classes
 *     stay the v3 mirror untouched;
 *  2. the matcher-shape law is TOTAL over the delta and maps INTO the closed
 *     matcher kinds — zero new kinds, zero new rungs (the effect lattice and
 *     the two documents are the same objects the flip found them to be);
 *  3. the coverage algebra runs the NEW descriptor shapes through the SAME
 *     `matcherCovers` / ceiling functions with zero special-casing: the
 *     identity-first ordering and the `containment-undetermined` fail-closed
 *     answer behave exactly as they do for fs tool classes (zero drift);
 *  4. the refusal direction stays closed: none of this is DOCUMENT
 *     ACCEPTANCE — parsing an envelope document that names a delta class is
 *     still refused by the frozen closed set (production acceptance is the
 *     effect-queue round's, with its own review).
 *
 * The kernel mirror of these pins is
 * `packages/runtime/test/a5fl3-kernel-scope-mirror.test.ts` (same objects,
 * same functions, write-time refusal unchanged).
 *
 * @module test/a5fl2-envelope-scope-mirror
 */
import { describe, expect, it } from 'vitest'
import {
  AUTHORITY_EFFECT_PRECEDENCE,
  AUTHORITY_EFFECT_VALUES,
  AUTHORITY_MATCHER_KINDS,
  AUTHORITY_OPERATION_CLASSES,
  AUTHORITY_V4_SCOPE_CLASSES,
  AUTHORITY_V4_SCOPE_MATCHER_KINDS,
  effectiveAuthorityCeiling,
  isShellOperationClass,
  isV4ScopeOperationClass,
  matcherCovers,
  parseAuthorityEnvelope,
  v4ScopeMatcherLaw,
} from '../authority-envelope/src/index.js'

describe('a5fl2 the delta table — three new operation types, nothing else', () => {
  it('AUTHORITY_V4_SCOPE_CLASSES is exactly the CAND D-06 delta and is DISJOINT from the v3 mirror', () => {
    expect([...AUTHORITY_V4_SCOPE_CLASSES]).toEqual(['fs-metadata', 'network-destination', 'domain-reference'])
    for (const cls of AUTHORITY_V4_SCOPE_CLASSES) {
      expect(AUTHORITY_OPERATION_CLASSES as readonly string[]).not.toContain(cls)
      // …and the v3 mirror itself did not move: the tool-name set is intact.
      expect([...AUTHORITY_OPERATION_CLASSES]).toEqual([
        'read',
        'read_image',
        'write',
        'edit',
        'lsp',
        'bash',
        'pwsh',
      ])
    }
  })

  it('the matcher law is TOTAL over the delta and maps INTO the closed kinds (zero new kinds)', () => {
    for (const cls of AUTHORITY_V4_SCOPE_CLASSES) {
      const law = v4ScopeMatcherLaw(cls)
      expect(law, `law for ${cls}`).toBeDefined()
      for (const kind of law ?? []) {
        expect(AUTHORITY_MATCHER_KINDS as readonly string[]).toContain(kind)
      }
    }
    // The shapes D-06 names, stated as a table (fs metadata is fs-class;
    // destinations and Domain references are identity-only — no invented
    // hierarchies):
    expect(AUTHORITY_V4_SCOPE_MATCHER_KINDS['fs-metadata']).toEqual(['exact', 'subtree'])
    expect(AUTHORITY_V4_SCOPE_MATCHER_KINDS['network-destination']).toEqual(['exact'])
    expect(AUTHORITY_V4_SCOPE_MATCHER_KINDS['domain-reference']).toEqual(['exact'])
    // Non-members answer `undefined` — a lookup refusal, never a guess.
    expect(v4ScopeMatcherLaw('read')).toBeUndefined()
    expect(v4ScopeMatcherLaw('anything-else')).toBeUndefined()
    expect(isV4ScopeOperationClass('bash')).toBe(false)
    expect(isV4ScopeOperationClass('network-destination')).toBe(true)
  })

  it('ZERO NEW RUNGS: the lattice objects the whole governance plane shares are the same closed sets', () => {
    // The effect ladder is byte-identical to what the flip found (three
    // effects, deny<ask<allow); the matcher kinds stay the closed triple; no
    // new ceiling status exists beyond decided/no-authority/undetermined —
    // the delta classes travel the EXISTING lattice, that is the D1 clause.
    expect([...AUTHORITY_EFFECT_VALUES].slice().sort()).toEqual(['allow', 'ask', 'deny'])
    expect(Object.keys(AUTHORITY_EFFECT_PRECEDENCE)).toEqual(['deny', 'ask', 'allow'])
    expect([...AUTHORITY_MATCHER_KINDS]).toEqual(['exact', 'subtree', 'fingerprint'])
    expect(Object.isFrozen(AUTHORITY_V4_SCOPE_MATCHER_KINDS)).toBe(true)
    // Shell discipline untouched — the delta did not add a fingerprint class
    // or remove one.
    expect(isShellOperationClass('bash')).toBe(true)
    expect(isShellOperationClass('network-destination')).toBe(false)
  })
})

describe('a5fl2 coverage algebra over the new descriptor shapes — zero special-casing, zero drift', () => {
  it('fs-metadata: subtree identity-first, then the seam, then the fail-closed undetermined — the SAME three answers', () => {
    const same = matcherCovers(
      { kind: 'subtree', resource: '/ws/docs' },
      { kind: 'exact', resource: '/ws/docs' },
    )
    expect(same).toEqual({ covers: true, undeterminable: false })
    const belowNoSeam = matcherCovers(
      { kind: 'subtree', resource: '/ws/docs' },
      { kind: 'exact', resource: '/ws/docs/a.md.meta' },
    )
    expect(belowNoSeam).toEqual({ covers: false, undeterminable: true })
    const belowWithSeam = matcherCovers(
      { kind: 'subtree', resource: '/ws/docs' },
      { kind: 'exact', resource: '/ws/docs/a.md.meta' },
      (root, child) => child.startsWith(`${root}/`),
    )
    expect(belowWithSeam).toEqual({ covers: true, undeterminable: false })
  })

  it('network-destination: exact identity only — same destination covers, a different one plainly does not, nothing is ever undeterminable', () => {
    expect(
      matcherCovers(
        { kind: 'exact', resource: 'https://api.example.com:443' },
        { kind: 'exact', resource: 'https://api.example.com:443' },
      ),
    ).toEqual({ covers: true, undeterminable: false })
    expect(
      matcherCovers(
        { kind: 'exact', resource: 'https://api.example.com:443' },
        { kind: 'exact', resource: 'https://other.example.com:443' },
      ),
    ).toEqual({ covers: false, undeterminable: false })
  })

  it('domain-reference: pure identity — the TeamDomain reference reads like an exec fingerprint over domain identity (no containment seam exists, and none is asked for)', () => {
    const verdict = matcherCovers(
      { kind: 'exact', resource: 'dom:team-alpha/ops' },
      { kind: 'exact', resource: 'dom:team-alpha/ops' },
    )
    expect(verdict).toEqual({ covers: true, undeterminable: false })
    // No seam, no undeterminable: exact-only classes can NEVER take the
    // containment-undetermined path.
    const miss = matcherCovers(
      { kind: 'exact', resource: 'dom:team-alpha/ops' },
      { kind: 'exact', resource: 'dom:team-beta/ops' },
    )
    expect(miss).toEqual({ covers: false, undeterminable: false })
  })

  it('the ceiling fold evaluates delta classes with the SAME class-equality + coverage law (no-match ⇒ no-authority, cross-class rules never leak)', () => {
    const envelope = {
      rules: [
        {
          operationClass: 'network-destination',
          matcher: { kind: 'exact' as const, resource: 'https://api.example.com:443' },
          maximumEffect: 'ask' as const,
        },
        {
          operationClass: 'fs-metadata',
          matcher: { kind: 'subtree' as const, resource: '/ws/docs' },
          maximumEffect: 'allow' as const,
        },
      ],
    }
    // Same class, exact identity: decided at the rule's ceiling.
    expect(
      effectiveAuthorityCeiling(envelope, 'network-destination', {
        kind: 'exact',
        resource: 'https://api.example.com:443',
      }),
    ).toMatchObject({ status: 'decided', effect: 'ask', matchedRules: [0] })
    // Cross class: a network rule NEVER ceilings a domain-reference query.
    expect(
      effectiveAuthorityCeiling(envelope, 'domain-reference', {
        kind: 'exact',
        resource: 'dom:team-alpha/ops',
      }),
    ).toEqual({ status: 'no-authority' })
    // fs-metadata under the subtree with NO seam: the undetermined answer is
    // carried with its reason, distinct from denial (the semantics the flip
    // promised to move zero of).
    expect(
      effectiveAuthorityCeiling(envelope, 'fs-metadata', {
        kind: 'exact',
        resource: '/ws/docs/a.md.meta',
      }),
    ).toMatchObject({ status: 'undetermined', reason: 'containment-undetermined' })
  })
})

describe('a5fl2 grammar, not acceptance — documents still refuse the delta classes by name', () => {
  it('parseAuthorityEnvelope refuses every delta operationClass with operation-class-unknown (the document face closes until the effect round)', () => {
    for (const cls of AUTHORITY_V4_SCOPE_CLASSES) {
      const parsed = parseAuthorityEnvelope({
        rules: [{ operationClass: cls, matcher: { kind: 'exact', path: '/x' }, maximumEffect: 'ask' }],
      })
      expect(parsed.ok, `document face must still refuse ${cls}`).toBe(false)
      if (!parsed.ok) {
        expect(parsed.problems.map((p) => p.problem)).toContain('operation-class-unknown')
      }
    }
  })
})
