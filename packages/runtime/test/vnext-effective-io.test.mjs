/**
 * vnext-effective-io.test.mjs — the I/O algebra's own arms.
 *
 * Every arm below is a way the old route was actually wrong, or a way a narrowing algebra can
 * silently stop narrowing: a read grant read as a write grant, a subtree that matches by string
 * prefix (`/w/ab` under `/w/a`), a denial that vanishes because it cannot be represented, an
 * empty ceiling read as "unset", a `..` path escaping its ceiling, a typo'd axis ignored.
 *
 * Run: node --test packages/runtime/test/vnext-effective-io.test.mjs
 */

import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  EffectiveIoError,
  allowsNet,
  allowsRead,
  allowsWrite,
  compileEffectiveIo,
  parseIoPolicy,
} from '../src/plugin/vnext/effective-io.ts'

const ceiling = (spec) => parseIoPolicy(spec, 'ceiling')
const restriction = (spec) => parseIoPolicy(spec, 'restriction')

test('IO-1 — the intersection is a subset of BOTH sides on every axis', () => {
  const io = compileEffectiveIo(
    ceiling({ read: [{ kind: 'subtree', path: '/w' }], write: [{ kind: 'subtree', path: '/w' }], net: { allow: [{ kind: 'subtree', host: 'example.com' }] } }),
    restriction({ read: [{ kind: 'subtree', path: '/w/project' }], write: [{ kind: 'exact', path: '/w/project/a.txt' }], net: { allow: [{ kind: 'exact', host: 'api.example.com' }] } }),
  )
  assert.equal(allowsRead(io, '/w/project/x'), true)
  assert.equal(allowsRead(io, '/w/other'), false, 'the restriction narrows the ceiling')
  assert.equal(allowsWrite(io, '/w/project/a.txt'), true)
  assert.equal(allowsWrite(io, '/w/project/b.txt'), false, 'an exact restriction is not a subtree')
  assert.equal(allowsNet(io, 'api.example.com'), true)
  assert.equal(allowsNet(io, 'other.example.com'), false)
})

test('IO-2 — the three axes never mix: a read grant is not a write grant, a net grant is not a path', () => {
  const io = compileEffectiveIo(
    ceiling({ read: [{ kind: 'subtree', path: '/w' }] }),
    restriction({ read: [{ kind: 'subtree', path: '/w' }], write: [{ kind: 'subtree', path: '/w' }], net: { allow: [{ kind: 'any' }] } }),
  )
  assert.equal(allowsRead(io, '/w/a'), true)
  assert.equal(allowsWrite(io, '/w/a'), false, 'read ⊆ /w must not imply write ⊆ /w')
  assert.equal(allowsNet(io, '/w'), false, 'a path is not a host')
})

test('IO-3 — a subtree boundary is a PATH boundary, not a string prefix', () => {
  const io = compileEffectiveIo(
    ceiling({ read: [{ kind: 'subtree', path: '/w/a' }] }),
    restriction({ read: [{ kind: 'any' }] }),
  )
  assert.equal(allowsRead(io, '/w/a'), true)
  assert.equal(allowsRead(io, '/w/a/b'), true)
  assert.equal(allowsRead(io, '/w/ab'), false, 'the /w/ab sibling must not ride a string prefix')
  assert.equal(allowsRead(io, '/w'), false)
})

test('IO-4 — an empty ceiling denies; it is never "unset, allow everything"', () => {
  const io = compileEffectiveIo(ceiling({}), restriction({ read: [{ kind: 'any' }], write: [{ kind: 'any' }], net: { allow: [{ kind: 'any' }] } }))
  assert.deepEqual([...io.emptyAxes].sort(), ['fs.read', 'fs.write', 'net'])
  assert.equal(allowsRead(io, '/anything'), false)
  assert.equal(allowsWrite(io, '/anything'), false)
  assert.equal(allowsNet(io, 'anything.example'), false)
})

test('IO-5 — `any` must be written by BOTH sides to survive', () => {
  const one = compileEffectiveIo(ceiling({ read: [{ kind: 'any' }] }), restriction({ read: [{ kind: 'subtree', path: '/w' }] }))
  assert.equal(allowsRead(one, '/w'), true)
  assert.equal(allowsRead(one, '/etc/passwd'), false)
  const two = compileEffectiveIo(ceiling({ read: [{ kind: 'any' }] }), restriction({ read: [{ kind: 'any' }] }))
  assert.equal(allowsRead(two, '/etc/passwd'), true)
})

test('IO-6 — a network denial wins over any allow, on both sides', () => {
  const io = compileEffectiveIo(
    ceiling({ net: { allow: [{ kind: 'any' }], deny: [{ kind: 'exact', host: 'evil.example' }] } }),
    restriction({ net: { allow: [{ kind: 'any' }], deny: [{ kind: 'subtree', host: 'internal.example' }] } }),
  )
  assert.equal(allowsNet(io, 'api.example.com'), true)
  assert.equal(allowsNet(io, 'evil.example'), false, 'the ceiling denial survives')
  assert.equal(allowsNet(io, 'a.internal.example'), false, 'the restriction denial survives')
  assert.equal(allowsNet(io, 'notinternal.example'), true, 'a suffix denial matches on a dot boundary')
})

test('IO-7 — a `..` path is refused, never normalized out of its ceiling', () => {
  assert.throws(() => ceiling({ read: [{ kind: 'subtree', path: '/w/../etc' }] }), (e) => e instanceof EffectiveIoError && e.code === 'FS_PATH_ESCAPE')
  const io = compileEffectiveIo(ceiling({ read: [{ kind: 'subtree', path: '/w' }] }), restriction({ read: [{ kind: 'any' }] }))
  assert.throws(() => allowsRead(io, '/w/../etc/passwd'), (e) => e.code === 'FS_PATH_ESCAPE')
})

test('IO-8 — a misspelled axis is refused, not ignored', () => {
  assert.throws(() => ceiling({ rad: [{ kind: 'any' }] }), (e) => e.code === 'IO_POLICY_UNKNOWN_KEY')
  assert.throws(() => ceiling({ net: { alow: [{ kind: 'any' }] } }), (e) => e.code === 'IO_POLICY_UNKNOWN_KEY')
})

test('IO-9 — a malformed resource is refused at parse time, not silently dropped', () => {
  assert.throws(() => ceiling({ read: [{ kind: 'prefix', path: '/w' }] }), (e) => e.code === 'FS_RESOURCE_INVALID')
  assert.throws(() => ceiling({ net: { allow: [{ kind: 'exact' }] } }), (e) => e.code === 'NET_HOST_INVALID')
  assert.throws(() => ceiling({ read: 'not-an-array' }), (e) => e.code === 'IO_POLICY_INVALID')
})

test('IO-10 — disjoint subtrees intersect to nothing, and the axis is reported empty', () => {
  const io = compileEffectiveIo(
    ceiling({ write: [{ kind: 'subtree', path: '/w/one' }] }),
    restriction({ write: [{ kind: 'subtree', path: '/w/two' }] }),
  )
  assert.equal(io.write.length, 0)
  assert.deepEqual([...io.emptyAxes].sort(), ['fs.read', 'fs.write', 'net'], 'every axis with nothing admitted is reported, not just the one this arm aimed at')
  assert.equal(allowsWrite(io, '/w/one/x'), false)
})

test('IO-11 — a nested wider subtree wins, and the result is deduplicated', () => {
  const io = compileEffectiveIo(
    ceiling({ read: [{ kind: 'subtree', path: '/w' }, { kind: 'subtree', path: '/w/a' }] }),
    restriction({ read: [{ kind: 'subtree', path: '/w' }, { kind: 'subtree', path: '/w/a' }] }),
  )
  assert.equal(io.read.length, 1, `expected one resource after dedupe, got ${JSON.stringify(io.read)}`)
  assert.equal(allowsRead(io, '/w/b'), true)
})

test('IO-12 — the compiled policy records no provenance and cannot be widened by recompiling', () => {
  const a = compileEffectiveIo(ceiling({ read: [{ kind: 'subtree', path: '/w' }] }), restriction({ read: [{ kind: 'any' }] }))
  const b = compileEffectiveIo({ ...a, provenance: 'second pass' }, restriction({ read: [{ kind: 'any' }] }))
  assert.equal(allowsRead(b, '/etc'), false, 'recompiling the result with `any` must not widen it')
  assert.equal(b.read.length, 1)
})
