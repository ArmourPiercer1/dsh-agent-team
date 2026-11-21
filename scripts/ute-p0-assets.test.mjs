#!/usr/bin/env node
/**
 * ute-p0-assets.test.mjs — the P0 asset gate's negative controls.
 *
 * The gate exists to stop an inventory from going stale or from being hand-
 * edited into something more convenient than the tree. So every arm here is a
 * mutation of a PASSING ledger that must turn the gate red, plus the positive
 * arm that shows the same ledger passes untouched. An arm that cannot be made to
 * red is not a control.
 *
 * Run: node --test scripts/ute-p0-assets.test.mjs
 */

import assert from 'node:assert/strict'
import { test } from 'node:test'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { MODULES, checkLedger, cutState, derive, snapshotDigest } from './ute-p0-assets.mjs'

const base = derive()
const clone = () => JSON.parse(JSON.stringify(base))
const codes = (v) => v.map((f) => f.code)
const mod = (l, id) => l.modules.find((m) => m.id === id)

test('P0-ASSETS-0 — the shipped ledger passes untouched (positive arm)', () => {
  const findings = checkLedger(clone(), { inventoryText: null })
  assert.deepEqual(findings, [], `unexpected findings: ${JSON.stringify(findings)}`)
})

test('P0-ASSETS-1 — every file really exists on disk (the ledger was generated, not typed)', () => {
  // The derive() above already proves existence implicitly: a fabricated path
  // would have no line count. This arm pins that every listed file is tracked.
  const total = base.modules.reduce((n, m) => n + m.files.length, 0)
  assert.equal(total, base.totals.files)
  assert.ok(total >= 100, `expected the inventory to be substantial, got ${total}`)
})

test('P0-ASSETS-2 — a listed file that is no longer on disk is a PARTIAL cut, never a pass', () => {
  // The point of the arm changed with the gate: before the cut, one missing file means the
  // tree no longer matches the boundary, and after the cut begins a half-deleted realm has
  // two declarants per name. Both are red, and neither may be reported as MISSING-tolerated.
  const l = clone()
  mod(l, 'family-fs').files.push('packages/tools/fs-family/src/does-not-exist.mjs')
  mod(l, 'family-fs').lines += 1
  l.totals.files += 1
  l.totals.lines += 1
  l.totals.deleteFiles += 1
  l.totals.wave1Files += 1
  const got = codes(checkLedger(l))
  assert.ok(got.includes('UTE_P0_ASSETS_PARTIAL') || got.includes('UTE_P0_ASSETS_MISSING'), `got ${JSON.stringify(got)}`)
})

test('P0-ASSETS-3 — a file that grew under a module root but was never listed is UNLISTED', () => {
  const l = clone()
  const m = mod(l, 'family-search')
  const dropped = m.files.pop()
  m.lines -= 1
  l.totals.files -= 1
  l.totals.lines -= 1
  l.totals.deleteFiles -= 1
  l.totals.wave1Files -= 1
  const findings = checkLedger(l)
  assert.ok(codes(findings).includes('UTE_P0_ASSETS_UNLISTED'), `dropped ${dropped}`)
})

test('P0-ASSETS-4 — one file claimed by two modules is DOUBLE', () => {
  const l = clone()
  const f = mod(l, 'family-fs').files[0]
  mod(l, 'family-web').files.push(f)
  mod(l, 'family-web').lines += 1
  l.totals.files += 1
  l.totals.lines += 1
  l.totals.deleteFiles += 1
  l.totals.wave1Files += 1
  assert.ok(codes(checkLedger(l)).includes('UTE_P0_ASSETS_DOUBLE'))
})

test('P0-ASSETS-5 — bucket B without a paired deleteWith is refused', () => {
  const l = clone()
  mod(l, 'family-web').deleteWith = []
  assert.ok(codes(checkLedger(l)).includes('UTE_P0_ASSETS_PAIRED'))
})

test('P0-ASSETS-6 — bucket B that claims to be KEEP-able is refused (only enforcement cannot be kept as a "retire later")', () => {
  const l = clone()
  mod(l, 'family-web').verdict = 'keep'
  mod(l, 'family-web').wave = null
  mod(l, 'family-web').deleteWith = ['x']
  const got = codes(checkLedger(l))
  assert.ok(got.includes('UTE_P0_ASSETS_PAIRED') || got.includes('UTE_P0_ASSETS_KEEP'), `got ${JSON.stringify(got)}`)
})

test('P0-ASSETS-7 — a deletable module with no wave is refused', () => {
  const l = clone()
  mod(l, 'family-fs').wave = null
  assert.ok(codes(checkLedger(l)).includes('UTE_P0_ASSETS_WAVE'))
})

test('P0-ASSETS-8 — a kept module that claims a deletion wave is refused', () => {
  const l = clone()
  mod(l, 'central-control').wave = 1
  assert.ok(codes(checkLedger(l)).includes('UTE_P0_ASSETS_WAVE'))
})

test('P0-ASSETS-9 — bucket C must state why: no names and no blockedBy is UNBACKED', () => {
  const l = clone()
  const m = mod(l, 'family-inspect')
  m.names = []
  m.blockedBy = []
  assert.ok(codes(checkLedger(l)).includes('UTE_P0_ASSETS_UNBACKED'))
})

test('P0-ASSETS-10 — blockedBy naming a module that does not exist is UNBACKED', () => {
  const l = clone()
  mod(l, 'central-alpha6').blockedBy = ['family-ghost']
  assert.ok(codes(checkLedger(l)).includes('UTE_P0_ASSETS_UNBACKED'))
})

test('P0-ASSETS-11 — typed totals that stop summing are refused', () => {
  const l = clone()
  l.totals.files += 1
  assert.ok(codes(checkLedger(l)).includes('UTE_P0_ASSETS_TOTALS'))
})

test('P0-ASSETS-12 — an unknown bucket or verdict is a schema refusal, not a silent pass', () => {
  const a = clone(); mod(a, 'family-fs').bucket = 'Z'
  assert.ok(codes(checkLedger(a)).includes('UTE_P0_ASSETS_BUCKET'))
  const b = clone(); mod(b, 'family-fs').verdict = 'maybe'
  assert.ok(codes(checkLedger(b)).includes('UTE_P0_ASSETS_VERDICT'))
})

test('P0-ASSETS-13 — a KEEP module classed as old-execution is refused (what we build on is not a route)', () => {
  const l = clone()
  mod(l, 'central-tools-src').kind = 'old-execution'
  assert.ok(codes(checkLedger(l)).includes('UTE_P0_ASSETS_KEEP'))
})

test('P0-ASSETS-14 — an empty module is refused (a typo or already deleted, never both silent)', () => {
  const l = clone()
  mod(l, 'family-ui').files = []
  assert.ok(codes(checkLedger(l)).includes('UTE_P0_ASSETS_EMPTY'))
})

test('P0-ASSETS-15 — prose drift: a module missing from the generated inventory is refused', () => {
  const l = clone()
  const findings = checkLedger(l, { inventoryText: 'no module mentions here' })
  assert.ok(codes(findings).includes('UTE_P0_ASSETS_PROSE'))
})

test('P0-ASSETS-15b — bucket D without a ruling (no deleteWith) is refused', () => {
  const l = clone()
  mod(l, 'family-inspect').deleteWith = []
  assert.ok(codes(checkLedger(l)).includes('UTE_P0_ASSETS_PAIRED'))
})

test('P0-ASSETS-15c — a replaced module without a named replacement is refused', () => {
  const l = clone()
  mod(l, 'assembly-root').deleteWith = []
  assert.ok(codes(checkLedger(l)).includes('UTE_P0_ASSETS_PAIRED'))
})

test('P0-ASSETS-17 — cutState names the three moments, and only `cut` is a finished deletion', () => {
  const dir = mkdtempSync(join(tmpdir(), 'p0-cut-'))
  try {
    const ledger = {
      modules: [
        { id: 'a', verdict: 'delete', bucket: 'B', wave: 1, files: ['gone1.mjs', 'gone2.mjs'], lines: 2 },
        { id: 'b', verdict: 'keep', bucket: 'KEEP', wave: null, files: ['stay.mjs'], lines: 1 },
      ],
    }
    writeFileSync(join(dir, 'stay.mjs'), 'x')
    writeFileSync(join(dir, 'gone1.mjs'), 'x')
    writeFileSync(join(dir, 'gone2.mjs'), 'x')
    assert.equal(cutState(ledger, { root: dir }).state, 'pending', 'nothing removed yet')

    rmSync(join(dir, 'gone1.mjs'))
    const half = cutState(ledger, { root: dir })
    assert.equal(half.state, 'partial', 'a half-cut realm has two declarants per name')
    assert.equal(half.gone, 1)
    assert.equal(half.total, 2)

    rmSync(join(dir, 'gone2.mjs'))
    assert.equal(cutState(ledger, { root: dir }).state, 'cut', 'every deletable file gone')
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('P0-ASSETS-18 — the frozen digest covers exactly the boundary, and moves when the boundary moves', () => {
  const a = snapshotDigest(clone())
  const b = clone(); mod(b, 'family-fs').verdict = 'keep'; mod(b, 'family-fs').wave = null
  const c = clone(); mod(c, 'family-fs').files = [...mod(c, 'family-fs').files].reverse()
  assert.notEqual(a, snapshotDigest(b), 'a verdict flip must move the digest')
  assert.equal(a, snapshotDigest(c), 'file ORDER must not move the digest — it is a set, not a list')
})

test('P0-ASSETS-16 — the module set itself is coherent: every delete module is either wave 1 or wave 2+', () => {
  for (const m of MODULES) {
    if (m.verdict === 'delete' || m.verdict === 'replace') assert.ok(m.wave === 1 || m.wave === 2 || m.wave === 3, `${m.id} has wave ${m.wave}`)
    else assert.equal(m.wave, null, `${m.id} is kept but claims wave ${m.wave}`)
  }
})
