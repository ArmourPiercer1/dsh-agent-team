/**
 * Alpha.5 PR0 — CANONICAL FINGERPRINT NEGATIVES & STABILITY (plan §3:
 * "Canonical Fingerprint 的稳定性与冲突、隐藏参数不可忽略、资源 Realm 不可混淆、
 * 复合 Effect 去重顺序").
 *
 * RED-FIRST FILE.
 *
 * The fingerprint law inherited from Alpha.2 (`operation-permission/
 * canonical-operation.ts`, A2C-5): identity is over the SECURITY projection,
 * key order is irrelevant, ABSENCE is carried rather than substituted, and two
 * distinct requests must never mint one fingerprint.
 *
 * @module test/a5p0-fingerprint-negatives
 */
import { describe, expect, it } from 'vitest'

import { canonicalJsonFingerprint, effectIdentityKey, effectsAreSubset, parseRequestedEffectSet, parseResourceRef } from '../tool-governance/src/index.js'

const ok = <T>(r: { ok: true; value: T } | { ok: false }): T => {
  if (!r.ok) throw new Error(`expected ok: ${JSON.stringify(r)}`)
  return r.value
}

const realmA = 'realm:team-alpha:ws-1'
const realmB = 'realm:team-beta:ws-2'

describe('canonical JSON stability', () => {
  it('key insertion order never changes the fingerprint (键序不可影响)', () => {
    const one = canonicalJsonFingerprint({ a: 1, b: { c: true, d: [1, 'x', null] } })
    const two = canonicalJsonFingerprint({ b: { d: [1, 'x', null], c: true }, a: 1 })
    expect(one).toBe(two)
    expect(one).toMatch(/^sha256:[0-9a-f]{64}$/)
  })

  it('arrays keep their order (order IS semantics there)', () => {
    expect(canonicalJsonFingerprint({ v: [1, 2] })).not.toBe(canonicalJsonFingerprint({ v: [2, 1] }))
  })

  it('ABSENCE is carried, never substituted with a default (A2C-5 law)', () => {
    // `{limit: omitted}` and `{limit: 2000}` are DIFFERENT identities.
    expect(canonicalJsonFingerprint({ offset: 1 })).not.toBe(
      canonicalJsonFingerprint({ offset: 1, limit: null }),
    )
    expect(canonicalJsonFingerprint({ limit: null })).not.toBe(canonicalJsonFingerprint({ limit: 2000 }))
  })

  it('non-lossless JSON (NaN, Infinity, undefined, functions) is refused, not hashed', () => {
    expect(() => canonicalJsonFingerprint({ n: Number.NaN })).toThrow(/not-json/)
    expect(() => canonicalJsonFingerprint({ n: Number.POSITIVE_INFINITY })).toThrow(/not-json/)
    expect(() => canonicalJsonFingerprint({ f: () => 1 })).toThrow(/not-json/)
  })
})

describe('requested effect set: dedup, ordering, conflict detection (复合 Effect 去重顺序)', () => {
  const readA = ok(parseResourceRef({ realmId: realmA, kind: 'workspace', canonicalLocator: 'a', rights: ['read'] }))
  const readB = ok(parseResourceRef({ realmId: realmA, kind: 'workspace', canonicalLocator: 'b', rights: ['read'] }))
  const invoke = { kind: 'tool-invoke', toolName: 'read', resource: null } as const

  it('[x, y] and [y, x] canonicalize to ONE set with ONE fingerprint (顺序规范化)', () => {
    const xy = ok(parseRequestedEffectSet([{ kind: 'read', resource: readA }, { kind: 'read', resource: readB }, invoke]))
    const yx = ok(parseRequestedEffectSet([invoke, { kind: 'read', resource: readB }, { kind: 'read', resource: readA }]))
    expect(xy.fingerprint).toBe(yx.fingerprint)
    expect(JSON.stringify(xy.effects)).toBe(JSON.stringify(yx.effects))
  })

  it('duplicates collapse; the count is the distinct count (去重)', () => {
    const dup = ok(
      parseRequestedEffectSet([
        { kind: 'read', resource: readA },
        { kind: 'read', resource: readA },
        { kind: 'tool-invoke', toolName: 'read', resource: null },
      ]),
    )
    expect(dup.effects).toHaveLength(2)
  })

  it('two requests differing ONLY in a hidden security parameter never share a fingerprint (冲突检测/隐藏参数不可忽略)', () => {
    // read(a, offset 1) vs read(a, offset 2001): the resource window belongs to
    // the PARAMETERS fingerprint, so the parameter fingerprint MUST differ —
    // the same construction Alpha.2 uses (`parametersFingerprint`).
    const p1 = canonicalJsonFingerprint({ tool: 'read', resourceKey: 'a', offset: 1, limit: null })
    const p2 = canonicalJsonFingerprint({ tool: 'read', resourceKey: 'a', offset: 2001, limit: null })
    expect(p1).not.toBe(p2)
    // A parameter object smuggling an extra security-relevant key cannot hash
    // equal to the shorter one (nothing is dropped on the way in).
    const withHidden = canonicalJsonFingerprint({ tool: 'read', resourceKey: 'a', offset: 1, limit: null, shell: ' -c rm ' })
    expect(withHidden).not.toBe(p1)
  })
})

describe('Realm is never confusable (资源 Realm 不可混淆)', () => {
  const sameLocatorRealmA = ok(parseResourceRef({ realmId: realmA, kind: 'workspace', canonicalLocator: 'secrets.env', rights: ['read'] }))
  const sameLocatorRealmB = ok(parseResourceRef({ realmId: realmB, kind: 'workspace', canonicalLocator: 'secrets.env', rights: ['read'] }))

  it('same kind + same locator + different realm → different identity AND different fingerprint', () => {
    expect(effectIdentityKey({ kind: 'read', resource: sameLocatorRealmA })).not.toBe(
      effectIdentityKey({ kind: 'read', resource: sameLocatorRealmB }),
    )
    const setA = ok(parseRequestedEffectSet([{ kind: 'read', resource: sameLocatorRealmA }]))
    const setB = ok(parseRequestedEffectSet([{ kind: 'read', resource: sameLocatorRealmB }]))
    expect(setA.fingerprint).not.toBe(setB.fingerprint)
  })

  it('a set inside realm A is NOT a subset of a realm-B grant (cross-realm subset refused)', () => {
    const grantedB = ok(parseRequestedEffectSet([{ kind: 'read', resource: sameLocatorRealmB }]))
    const requestedA = ok(parseRequestedEffectSet([{ kind: 'read', resource: sameLocatorRealmA }]))
    expect(effectsAreSubset(requestedA, grantedB)).toBe(false)
    expect(effectsAreSubset(requestedA, requestedA)).toBe(true)
  })
})

describe('subset algebra over canonical sets', () => {
  const a = ok(parseResourceRef({ realmId: realmA, kind: 'workspace', canonicalLocator: 'a', rights: ['read'] }))
  const b = ok(parseResourceRef({ realmId: realmA, kind: 'workspace', canonicalLocator: 'b', rights: ['read'] }))

  it('subset holds over distinct-effect identity, never over array length', () => {
    const small = ok(parseRequestedEffectSet([{ kind: 'read', resource: a }]))
    const big = ok(parseRequestedEffectSet([{ kind: 'read', resource: a }, { kind: 'read', resource: b }]))
    expect(effectsAreSubset(small, big)).toBe(true)
    expect(effectsAreSubset(big, small)).toBe(false)
  })

  it('a widened RIGHT (read→write) is never a subset even for the same locator', () => {
    const readOnly = ok(parseRequestedEffectSet([{ kind: 'read', resource: a }]))
    const writable = ok(
      parseRequestedEffectSet([
        { kind: 'write', resource: ok(parseResourceRef({ realmId: realmA, kind: 'workspace', canonicalLocator: 'a', rights: ['write'] })) },
      ]),
    )
    expect(effectsAreSubset(writable, readOnly)).toBe(false)
    expect(effectsAreSubset(readOnly, writable)).toBe(false)
  })
})
