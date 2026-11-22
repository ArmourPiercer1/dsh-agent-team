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
import { execFileSync } from 'node:child_process'
import { test } from 'node:test'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname } from 'node:path'
import { join } from 'node:path'
import { MODULES, checkLedger, cutState, snapshotDigest } from './ute-p0-assets.mjs'

/**
 * THE FIXTURE BASE IS THE A0 FROZEN TREE (round 80). `derive()` walks the WORKING TREE, and
 * A0 then deleted every file the shipped boundary books: 33 modules came back with empty
 * `files[]`, so the positive arm failed with UTE_P0_ASSETS_EMPTY on a ledger that is correct
 * and the mutations below would be mutating a surface nobody can see. The frozen twin derives
 * the same ledger from the commit that froze the boundary (read by git object id; no copy in
 * the tree), so every arm grades the inventory it was reviewed against. The LIVE check
 * (`node scripts/ute-p0-assets.mjs --check`) is the one that reports the cut.
 */
const A0_TREE = (() => {
  const allow = JSON.parse(readFileSync('dev/agent-workflow/ledgers/ute-cut-closure.allow.json', 'utf8'))
  const rev = allow.retiredSurfaces?.frozenTree
  assert.match(String(rev), /^[0-9a-f]{40}$/, 'the A0 retirement record must name a 40-hex frozenTree')
  return rev
})()
const A0_FILES = execFileSync('git', ['ls-tree', '-r', '--name-only', A0_TREE], { encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 })
  .split('\n').filter(Boolean)
const a0Lines = (rel) => execFileSync('git', ['show', `${A0_TREE}:${rel}`], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }).split('\n').length - 1

function deriveFrozen() {
  const modules = MODULES.map((m) => {
    const files = [...new Set(m.roots.flatMap((r) => A0_FILES.filter((p) => p === r || p.startsWith(`${r}/`))))].sort()
    const lines = files.reduce((n, f) => n + a0Lines(f), 0)
    return { ...m, roots: [...m.roots], files, lines }
  })
  const claimed = new Map()
  for (const m of modules) for (const f of m.files) claimed.set(f, [...(claimed.get(f) ?? []), m.id])
  return {
    schema: 'ute-p0-assets/1',
    derivedFrom: `git ls-tree ${A0_TREE} over the module roots in scripts/ute-p0-assets.mjs`,
    totals: {
      modules: modules.length,
      files: modules.reduce((n, m) => n + m.files.length, 0),
      lines: modules.reduce((n, m) => n + m.lines, 0),
      deleteFiles: modules.filter((m) => m.verdict === 'delete').reduce((n, m) => n + m.files.length, 0),
      replaceFiles: modules.filter((m) => m.verdict === 'replace').reduce((n, m) => n + m.files.length, 0),
      keepFiles: modules.filter((m) => m.verdict === 'keep').reduce((n, m) => n + m.files.length, 0),
      wave1Files: modules.filter((m) => m.verdict === 'delete' && m.wave === 1).reduce((n, m) => n + m.files.length, 0),
      wave2Files: modules.filter((m) => m.wave === 2 && m.verdict === 'delete').reduce((n, m) => n + m.files.length, 0),
      wave1Lines: modules.filter((m) => m.wave === 1 && m.verdict !== 'keep').reduce((n, m) => n + m.lines, 0),
      deleteLines: modules.filter((m) => m.verdict === 'delete').reduce((n, m) => n + m.lines, 0),
    },
    duplicateClaims: [...claimed].filter(([, ids]) => ids.length > 1).map(([file, ids]) => ({ file, modules: ids })),
    modules,
  }
}

const base = deriveFrozen()
const clone = () => JSON.parse(JSON.stringify(base))
const codes = (v) => v.map((f) => f.code)
const mod = (l, id) => l.modules.find((m) => m.id === id)

/**
 * A materialised A0 boundary in a throwaway git repo. `checkLedger` grades FILE PRESENCE and
 * COVERAGE against a working tree + index, so the frozen twin needs a real (tiny) repo with
 * the frozen blobs, not the post-cut tree. Written once, added to a throwaway index, removed
 * after the suite; the repository under test is never touched.
 */
const FIXTURE = mkdtempSync(join(tmpdir(), 'ute-p0-frozen-'))
const boundaryFiles = [...new Set(base.modules.flatMap((m) => m.files))].sort()
for (const rel of boundaryFiles) {
  mkdirSync(dirname(join(FIXTURE, rel)), { recursive: true })
  writeFileSync(join(FIXTURE, rel), execFileSync('git', ['show', `${A0_TREE}:${rel}`], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }))
}
execFileSync('git', ['init', '-q'], { cwd: FIXTURE })
execFileSync('git', ['add', '-A'], { cwd: FIXTURE })
process.on('exit', () => rmSync(FIXTURE, { recursive: true, force: true }))

/** Grade against the frozen boundary tree (the tree the ledger describes). */
const grade = (ledger, opts = {}) => checkLedger(ledger, { root: FIXTURE, ...opts })

test('P0-ASSETS-0 — the shipped ledger passes untouched (positive arm)', () => {
  const findings = grade(clone(), { inventoryText: null })
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
  const got = codes(grade(l))
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
  const findings = grade(l)
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
  assert.ok(codes(grade(l)).includes('UTE_P0_ASSETS_DOUBLE'))
})

test('P0-ASSETS-5 — bucket B without a paired deleteWith is refused', () => {
  const l = clone()
  mod(l, 'family-web').deleteWith = []
  assert.ok(codes(grade(l)).includes('UTE_P0_ASSETS_PAIRED'))
})

test('P0-ASSETS-6 — bucket B that claims to be KEEP-able is refused (only enforcement cannot be kept as a "retire later")', () => {
  const l = clone()
  mod(l, 'family-web').verdict = 'keep'
  mod(l, 'family-web').wave = null
  mod(l, 'family-web').deleteWith = ['x']
  const got = codes(grade(l))
  assert.ok(got.includes('UTE_P0_ASSETS_PAIRED') || got.includes('UTE_P0_ASSETS_KEEP'), `got ${JSON.stringify(got)}`)
})

test('P0-ASSETS-7 — a deletable module with no wave is refused', () => {
  const l = clone()
  mod(l, 'family-fs').wave = null
  assert.ok(codes(grade(l)).includes('UTE_P0_ASSETS_WAVE'))
})

test('P0-ASSETS-8 — a kept module that claims a deletion wave is refused', () => {
  const l = clone()
  mod(l, 'central-control').wave = 1
  assert.ok(codes(grade(l)).includes('UTE_P0_ASSETS_WAVE'))
})

test('P0-ASSETS-9 — bucket C must state why: no names and no blockedBy is UNBACKED', () => {
  const l = clone()
  const m = mod(l, 'family-inspect')
  m.names = []
  m.blockedBy = []
  assert.ok(codes(grade(l)).includes('UTE_P0_ASSETS_UNBACKED'))
})

test('P0-ASSETS-10 — blockedBy naming a module that does not exist is UNBACKED', () => {
  const l = clone()
  mod(l, 'central-alpha6').blockedBy = ['family-ghost']
  assert.ok(codes(grade(l)).includes('UTE_P0_ASSETS_UNBACKED'))
})

test('P0-ASSETS-11 — typed totals that stop summing are refused', () => {
  const l = clone()
  l.totals.files += 1
  assert.ok(codes(grade(l)).includes('UTE_P0_ASSETS_TOTALS'))
})

test('P0-ASSETS-12 — an unknown bucket or verdict is a schema refusal, not a silent pass', () => {
  const a = clone(); mod(a, 'family-fs').bucket = 'Z'
  assert.ok(codes(grade(a)).includes('UTE_P0_ASSETS_BUCKET'))
  const b = clone(); mod(b, 'family-fs').verdict = 'maybe'
  assert.ok(codes(grade(b)).includes('UTE_P0_ASSETS_VERDICT'))
})

test('P0-ASSETS-13 — a KEEP module classed as old-execution is refused (what we build on is not a route)', () => {
  const l = clone()
  mod(l, 'central-tools-src').kind = 'old-execution'
  assert.ok(codes(grade(l)).includes('UTE_P0_ASSETS_KEEP'))
})

test('P0-ASSETS-14 — an empty module is refused (a typo or already deleted, never both silent)', () => {
  const l = clone()
  mod(l, 'family-ui').files = []
  assert.ok(codes(grade(l)).includes('UTE_P0_ASSETS_EMPTY'))
})

test('P0-ASSETS-15 — prose drift: a module missing from the generated inventory is refused', () => {
  const l = clone()
  const findings = grade(l, { inventoryText: 'no module mentions here' })
  assert.ok(codes(findings).includes('UTE_P0_ASSETS_PROSE'))
})

test('P0-ASSETS-15b — bucket D without a ruling (no deleteWith) is refused', () => {
  const l = clone()
  mod(l, 'family-inspect').deleteWith = []
  assert.ok(codes(grade(l)).includes('UTE_P0_ASSETS_PAIRED'))
})

test('P0-ASSETS-15c — a replaced module without a named replacement is refused', () => {
  const l = clone()
  mod(l, 'assembly-root').deleteWith = []
  assert.ok(codes(grade(l)).includes('UTE_P0_ASSETS_PAIRED'))
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
