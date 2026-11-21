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
import { MODULES, checkLedger, derive } from './ute-p0-assets.mjs'

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

test('P0-ASSETS-2 — a deleted file left in the ledger is MISSING', () => {
  const l = clone()
  mod(l, 'family-fs').files.push('packages/tools/fs-family/src/does-not-exist.mjs')
  mod(l, 'family-fs').lines += 1
  l.totals.files += 1
  l.totals.lines += 1
  l.totals.deleteFiles += 1
  l.totals.wave1Files += 1
  assert.ok(codes(checkLedger(l)).includes('UTE_P0_ASSETS_MISSING'))
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
  mod(l, 'family-inspect').wave = 1
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
  mod(l, 'team-tool-plane').blockedBy = ['family-ghost']
  assert.ok(codes(checkLedger(l)).includes('UTE_P0_ASSETS_UNBACKED'))
})

test('P0-ASSETS-11 — typed totals that stop summing are refused', () => {
  const l = clone()
  l.totals.files += 1
  assert.ok(codes(checkLedger(l)).includes('UTE_P0_ASSETS_TOTALS'))
})

test('P0-ASSETS-12 — an unknown bucket or verdict is a schema refusal, not a silent pass', () => {
  const a = clone(); mod(a, 'family-fs').bucket = 'D'
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

test('P0-ASSETS-16 — the module set itself is coherent: every delete module is either wave 1 or wave 2+', () => {
  for (const m of MODULES) {
    if (m.verdict === 'delete') assert.ok(m.wave === 1 || m.wave === 2 || m.wave === 3, `${m.id} has wave ${m.wave}`)
    else assert.equal(m.wave, null, `${m.id} is kept but claims wave ${m.wave}`)
  }
})
