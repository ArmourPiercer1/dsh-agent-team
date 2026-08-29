import { describe, expect, it } from 'vitest'

import {
  assertRemoteSafeJsonValue,
  canonicalJsonStringify,
  deepFreeze,
  isRemoteSafeJsonValue,
  toRemoteSafeDetail,
} from '../src/index.js'
import { expectCode, expectErrorPath } from './helpers.js'

function expectRemoteError(fn: () => unknown): void {
  expectCode(fn, 'REMOTE_VALUE_NOT_JSON')
}

describe('contracts v1 — lossless-JSON (remote-safe) values', () => {
  it('accepts exactly the lossless-JSON value space', () => {
    expect(isRemoteSafeJsonValue(null)).toBe(true)
    expect(isRemoteSafeJsonValue(true)).toBe(true)
    expect(isRemoteSafeJsonValue('x')).toBe(true)
    expect(isRemoteSafeJsonValue(42)).toBe(true)
    expect(isRemoteSafeJsonValue(0.5)).toBe(true)
    expect(isRemoteSafeJsonValue([1, 'a', null, { b: [true] }])).toBe(true)
    expect(isRemoteSafeJsonValue({ a: [1, 2], b: { c: 'd' } })).toBe(true)
    // null-prototype records are plain
    expect(isRemoteSafeJsonValue(Object.create(null))).toBe(true)
  })

  it('rejects values that do not survive a JSON round-trip', () => {
    expect(isRemoteSafeJsonValue(NaN)).toBe(false)
    expect(isRemoteSafeJsonValue(Infinity)).toBe(false)
    expect(isRemoteSafeJsonValue(-Infinity)).toBe(false)
    expect(isRemoteSafeJsonValue(() => 0)).toBe(false)
    expect(isRemoteSafeJsonValue(undefined)).toBe(false)
    expect(isRemoteSafeJsonValue(Symbol('s'))).toBe(false)
    expect(isRemoteSafeJsonValue(new Date())).toBe(false)
    expect(isRemoteSafeJsonValue({ a: new Date() })).toBe(false)
    expect(isRemoteSafeJsonValue([NaN])).toBe(false)
    class Point {
      x = 1
    }
    expect(isRemoteSafeJsonValue(new Point())).toBe(false)
  })

  it('assertRemoteSafeJsonValue reports the exact failing path', () => {
    expectErrorPath(
      () => assertRemoteSafeJsonValue({ a: { b: NaN } }),
      'REMOTE_VALUE_NOT_JSON',
      '$.a.b',
    )
    expectErrorPath(() => assertRemoteSafeJsonValue([1, undefined]), 'REMOTE_VALUE_NOT_JSON', '$[1]')
    expectErrorPath(() => assertRemoteSafeJsonValue(new Date()), 'REMOTE_VALUE_NOT_JSON', '$')
  })
})

describe('contracts v1 — canonical JSON encoding', () => {
  it('sorts object keys recursively by code unit and preserves array order', () => {
    expect(canonicalJsonStringify({ b: 1, a: { d: 2, c: true } })).toBe(
      '{"a":{"c":true,"d":2},"b":1}',
    )
    expect(canonicalJsonStringify([3, 1, 2])).toBe('[3,1,2]')
    expect(canonicalJsonStringify({})).toBe('{}')
    expect(canonicalJsonStringify('a"b')).toBe('"a\\"b"')
    expect(canonicalJsonStringify(null)).toBe('null')
  })

  it('is insertion-order independent for deeply-equal input', () => {
    const first = { x: 1, y: { z: 2, w: 3 } }
    const second = { y: { w: 3, z: 2 }, x: 1 }
    expect(canonicalJsonStringify(second)).toBe(canonicalJsonStringify(first))
  })

  it('rejects non-lossless values with REMOTE_VALUE_NOT_JSON', () => {
    for (const bad of [{ a: NaN }, [undefined], new Date(), () => 0, { a: Infinity }]) {
      expectRemoteError(() => canonicalJsonStringify(bad))
    }
  })
})

describe('contracts v1 — error detail coercion (never throws)', () => {
  it('passes lossless values through unchanged', () => {
    expect(toRemoteSafeDetail(1)).toBe(1)
    expect(toRemoteSafeDetail('x')).toBe('x')
    expect(toRemoteSafeDetail(null)).toBe(null)
    expect(toRemoteSafeDetail([1, { a: NaN }])).toEqual([1, { a: 'NaN' }])
    expect(toRemoteSafeDetail({ a: 1 })).toEqual({ a: 1 })
  })

  it('tags non-lossless values with their type', () => {
    expect(toRemoteSafeDetail(NaN)).toBe('NaN')
    expect(toRemoteSafeDetail(Infinity)).toBe('Infinity')
    expect(toRemoteSafeDetail(() => 0)).toBe('<function>')
    expect(toRemoteSafeDetail(undefined)).toBe('<undefined>')
    expect(toRemoteSafeDetail(new Date())).toBe('<object>')
  })
})

describe('contracts v1 — deepFreeze immutability', () => {
  it('freezes recursively and returns the same value', () => {
    const value = { a: [1, 2], b: { c: 'd' } }
    const frozen = deepFreeze(value)
    expect(frozen).toBe(value)
    expect(Object.isFrozen(value)).toBe(true)
    expect(Object.isFrozen(value.a)).toBe(true)
    expect(Object.isFrozen(value.b)).toBe(true)
    // (Object.isFrozen on primitives is vacuously true — nothing to check.)
  })

  it('mutating a frozen snapshot throws (strict mode) and rejects non-lossless input', () => {
    const rec = deepFreeze({ a: 1 })
    expect(() => {
      const mutable = rec as { a: number }
      mutable.a = 2
    }).toThrow()
    expectRemoteError(() => deepFreeze({ a: NaN }))
  })
})
