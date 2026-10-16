/**
 * Alpha.5 PR0 — THE TWO PLANES, table-driven (plan §3: "无匹配规则的 Alpha.4
 * 双平面差异（expansion no authority / approval no narrowing）两条独立函数+
 * 表驱动测试").
 *
 * RED-FIRST FILE.
 *
 * THE LAW (ADR A1-4, quoted by `domain/authority-envelope`, the ONE place it is
 * encoded):
 *   the EXPANSION plane answers "does this document AUTHORIZE it?" — no
 *     matching rule ⇒ NO AUTHORITY;
 *   the APPROVAL plane answers "does this document RESTRICT it?" — no matching
 *     rule ⇒ NO NARROWING (the identity).
 * PR0 does not restate that algebra. `tool-governance` wraps it realm-scoped
 * and this file pins (a) the shared rank table is the SAME frozen object,
 * (b) the two wrappers differ in exactly the no-match arm, (c) the full
 * spec §24.3 meet-lattice still holds through the wrapper.
 *
 * @module test/a5p0-planes
 */
import { describe, expect, it } from 'vitest'

import {
  AUTHORITY_EFFECT_PRECEDENCE,
  effectiveAuthorityCeiling,
  narrowingForApproval,
} from '../authority-envelope/src/index.js'
import {
  EFFECT_RANK,
  evaluateToolPolicyApprovalNarrowing,
  evaluateToolPolicyExpansionAuthority,
  parseToolPolicyDocument,
  type ToolPolicyDocument,
  type ToolPolicyScope,
} from '../tool-governance/src/index.js'

const ok = <T>(r: { ok: true; value: T } | { ok: false }): T => {
  if (!r.ok) throw new Error(`expected ok: ${JSON.stringify(r)}`)
  return r.value
}

const realmA = 'realm:team-alpha:ws-1'
const realmB = 'realm:team-beta:ws-2'

const doc = (rules: readonly unknown[]): ToolPolicyDocument =>
  ok(parseToolPolicyDocument({ rules: rules as never[] }))

const TARGET = 'src/a.ts'

const scopeOn = (resource: string, realmId: string = realmA): ToolPolicyScope => ({
  realmId,
  effectKind: 'read',
  matcher: { kind: 'exact', resource },
})

// The injected containment algebra (Alpha.4 law: domain judges no FS; the
// predicate arrives from the consumer). A subtree covers its own root and
// everything under it, so the subtree rule on `src` covers `src/a.ts`.
const contains = (root: string, child: string): boolean => child === root || child.startsWith(`${root}/`)

describe('rank reuse is IDENTITY, not a copy (复用 Alpha.4 rank 语义)', () => {
  it('the wrapper exposes the very frozen object the Alpha.4 kernel aliases', () => {
    // `runtime/governance/permission-mutation.ts` pins PERMISSION_EFFECT_PRECEDENCE
    // to this object by `toBe` (a3p3 hygiene, line 77); PR0 reaches the SAME
    // object, so deny < ask < allow is one fact in the repository.
    expect(EFFECT_RANK).toBe(AUTHORITY_EFFECT_PRECEDENCE)
    expect(EFFECT_RANK.deny < EFFECT_RANK.ask && EFFECT_RANK.ask < EFFECT_RANK.allow).toBe(true)
  })
})

describe('the two independent functions differ in EXACTLY the no-match arm', () => {
  const empty = doc([])
  const expansion = evaluateToolPolicyExpansionAuthority(empty, scopeOn('anything'))
  const approval = evaluateToolPolicyApprovalNarrowing(empty, scopeOn('anything'))

  it('expansion: no matching rule ⇒ no-authority (never an implicit grant)', () => {
    expect(expansion).toEqual({ status: 'no-authority' })
  })

  it('approval: no matching rule ⇒ no narrowing (the identity)', () => {
    expect(approval.status).toBe('decided')
    if (approval.status === 'decided') expect(approval.effect).toBe('allow')
  })

  it('…and on a MATCHING rule the two agree — absence is the only difference (ADR A1-4)', () => {
    const one = doc([{ realmId: realmA, effectKind: 'read', matcher: { kind: 'exact', resource: 'a' }, maximumEffect: 'ask' }])
    const e = evaluateToolPolicyExpansionAuthority(one, scopeOn('a'))
    const a = evaluateToolPolicyApprovalNarrowing(one, scopeOn('a'))
    expect(e).toEqual(a)
    expect(e.status).toBe('decided')
    if (e.status === 'decided') expect(e.effect).toBe('ask')
  })
})

describe('table-driven: the §24.3 meet-lattice through the wrapper (最低效果支配)', () => {
  // Rows: [name, rules, expected-decided-effect | 'no-authority'], asked at
  // the scope exact `src/a.ts` (the subtree rule on `src` covers it via the
  // injected `contains`).
  const rows: readonly (readonly [string, readonly unknown[], string])[] = [
    ['single allow', [{ realmId: realmA, effectKind: 'read', matcher: { kind: 'exact', resource: TARGET }, maximumEffect: 'allow' }], 'allow'],
    ['ask lowers allow', [
      { realmId: realmA, effectKind: 'read', matcher: { kind: 'exact', resource: TARGET }, maximumEffect: 'allow' },
      { realmId: realmA, effectKind: 'read', matcher: { kind: 'subtree', resource: 'src' }, maximumEffect: 'ask' },
    ], 'ask'],
    ['deny lowers everything', [
      { realmId: realmA, effectKind: 'read', matcher: { kind: 'subtree', resource: 'src' }, maximumEffect: 'allow' },
      { realmId: realmA, effectKind: 'read', matcher: { kind: 'exact', resource: TARGET }, maximumEffect: 'deny' },
    ], 'deny'],
    ['ask absorbs under deny', [
      { realmId: realmA, effectKind: 'read', matcher: { kind: 'exact', resource: TARGET }, maximumEffect: 'deny' },
      { realmId: realmA, effectKind: 'read', matcher: { kind: 'subtree', resource: 'src' }, maximumEffect: 'ask' },
    ], 'deny'],
    ['no row covers the target', [
      { realmId: realmA, effectKind: 'read', matcher: { kind: 'exact', resource: 'other' }, maximumEffect: 'allow' },
    ], 'no-authority'],
    ['other effect kind never matches', [
      { realmId: realmA, effectKind: 'write', matcher: { kind: 'exact', resource: TARGET }, maximumEffect: 'deny' },
    ], 'no-authority'],
  ] as const

  for (const [name, rules, expected] of rows) {
    it(`expansion plane: ${name}`, () => {
      const result = evaluateToolPolicyExpansionAuthority(doc(rules), scopeOn(TARGET, realmA), contains)
      if (expected === 'no-authority') expect(result.status).toBe('no-authority')
      else {
        expect(result.status).toBe('decided')
        if (result.status === 'decided') expect(result.effect).toBe(expected)
      }
    })
    it(`approval plane: ${name} — narrows ONLY where it matches`, () => {
      const result = evaluateToolPolicyApprovalNarrowing(doc(rules), scopeOn(TARGET, realmA), contains)
      if (expected === 'no-authority') {
        // no match ⇒ NO NARROWING: the identity, not the expansion refusal.
        expect(result.status).toBe('decided')
        if (result.status === 'decided') expect(result.effect).toBe('allow')
      } else {
        expect(result.status).toBe('decided')
        if (result.status === 'decided') expect(result.effect).toBe(expected)
      }
    })
  }

  it('monotonic restriction: adding a matching rule can never RAISE the ceiling', () => {
    const base = doc([{ realmId: realmA, effectKind: 'read', matcher: { kind: 'exact', resource: TARGET }, maximumEffect: 'allow' }])
    const widened = doc([
      ...base.rules,
      { realmId: realmA, effectKind: 'read', matcher: { kind: 'exact', resource: TARGET }, maximumEffect: 'allow' },
    ])
    const withAsk = doc([
      ...base.rules,
      { realmId: realmA, effectKind: 'read', matcher: { kind: 'subtree', resource: 'src' }, maximumEffect: 'ask' },
    ])
    const r0 = evaluateToolPolicyExpansionAuthority(base, scopeOn(TARGET), contains)
    // The duplicate rule MATCHES too (it is reported), but the MEET is the
    // same value: matchedRules is evidence, the effect is the decision.
    const rDup = evaluateToolPolicyExpansionAuthority(widened, scopeOn(TARGET), contains)
    expect(rDup.status).toBe(r0.status)
    if (rDup.status === 'decided' && r0.status === 'decided') expect(rDup.effect).toBe(r0.effect)
    const r1 = evaluateToolPolicyExpansionAuthority(withAsk, scopeOn(TARGET), contains)
    expect(r1.status === 'decided' && EFFECT_RANK[r1.effect] <= EFFECT_RANK[(r0 as { effect: 'allow' | 'ask' | 'deny' }).effect]).toBe(true)
    expect(r1.status === 'decided' && r1.effect === 'ask').toBe(true)
  })
})

describe('realm scoping on top of the shared walk', () => {
  const ruleB = [{ realmId: realmB, effectKind: 'read', matcher: { kind: 'exact', resource: 'a' }, maximumEffect: 'deny' }]

  it('a realm-B deny neither authorizes nor narrows a realm-A scope (Realm 不可混淆)', () => {
    const d = doc(ruleB)
    expect(evaluateToolPolicyExpansionAuthority(d, scopeOn('a', realmA)).status).toBe('no-authority')
    const narrow = evaluateToolPolicyApprovalNarrowing(d, scopeOn('a', realmA))
    expect(narrow.status === 'decided' && narrow.effect).toBe('allow') // no narrowing
    // …while it DOES bite inside its own realm.
    expect(evaluateToolPolicyExpansionAuthority(d, scopeOn('a', realmB)).status === 'decided').toBe(true)
  })
})

describe('the wrapper agrees with the underlying Alpha.4 algebra rule-for-rule', () => {
  // The cross-check that makes "reuse, not restatement" testable: strip the
  // realm dimension and both planes must return what `authority-envelope`
  // itself returns on the same document.
  it('identical ceilings on realm-pure inputs', () => {
    const rules = [
      { realmId: realmA, effectKind: 'read', matcher: { kind: 'subtree', resource: 'src' }, maximumEffect: 'ask' },
      { realmId: realmA, effectKind: 'read', matcher: { kind: 'exact', resource: 'src/secret' }, maximumEffect: 'deny' },
    ] as const
    const policy = doc(rules)
    const raw = { rules: rules.map((r) => ({ operationClass: r.effectKind, matcher: r.matcher, maximumEffect: r.maximumEffect })) }
    for (const resource of ['src/a.ts', 'src/secret', 'outside']) {
      const matcher = { kind: 'exact' as const, resource }
      const contains = (root: string, child: string): boolean => child === root || child.startsWith(`${root}/`)
      const eWrap = evaluateToolPolicyExpansionAuthority(policy, { realmId: realmA, effectKind: 'read', matcher }, contains)
      const eRaw = effectiveAuthorityCeiling(raw, 'read', matcher, contains)
      expect(eWrap).toEqual(eRaw)
      const aWrap = evaluateToolPolicyApprovalNarrowing(policy, { realmId: realmA, effectKind: 'read', matcher }, contains)
      const aRaw = narrowingForApproval(raw, { operationClass: 'read', matcher }, contains)
      expect(aWrap).toEqual(aRaw)
    }
  })
})
