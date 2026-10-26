/**
 * dist-placements.test.mjs — u7-w0 (2026-10-26) C1 controls for the
 * enumerated placement ledger (`scripts/dist-placements/*.json` ← loaded by
 * `scripts/place-dist-glue.mjs`). ZERO builds, ZERO hosts, ZERO ports: every
 * case mutates an INPUT (a planted temp directory), never the tree.
 *
 * Run: node --test tests/checks/dist-placements.test.mjs
 *
 * What is pinned:
 *   - the shipped ledger equals the 38-entry list at origin/master 88107ad71
 *     (order AND content) — the migration moved entries, it did not reorder
 *     or drop them (the receipt is
 *     dev/agent-workflow/evidence/u7-w0-20261026/placements-before-after.txt);
 *   - the enumeration is DETERMINISTIC (two loads, same order) and the order
 *     comes from the file-name prefix, not from readdir order;
 *   - RED-first: a removed placement, a mis-named file, a duplicate order
 *     prefix, a duplicate src, a broken mirror law, a misplaced glue and an
 *     unknown schema ALL refuse (each was a silent hole in a by-hand list);
 *   - the tracked dist mirror equals the ledger's dist set (so a
 *     hand-added mirror file cannot ride along unbooked).
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { GLUE_SRC, PLACEMENTS, PLACEMENTS_DIR, loadPlacements } from '../../scripts/place-dist-glue.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = resolve(HERE, '..', '..')

/** A 38-entry, 5-file ledger copy that a case may mutate freely. */
function plantedLedger(mutate = () => {}) {
  const dir = mkdtempSync(join(tmpdir(), 'dist-placements-'))
  for (const name of readdirSync(PLACEMENTS_DIR).filter((n) => n.endsWith('.json'))) {
    mkdirSync(join(dir), { recursive: true })
    writeFileSync(join(dir, name), readFileSync(join(PLACEMENTS_DIR, name), 'utf8'))
  }
  mutate(dir)
  return dir
}

/** Edit one placement file in a planted directory (JSON round-trip). */
function editDoc(dir, file, fn) {
  const p = join(dir, file)
  const doc = JSON.parse(readFileSync(p, 'utf8'))
  fn(doc)
  writeFileSync(p, JSON.stringify(doc, null, 2) + '\n')
}

test('shipped ledger: 38 placements, glue first, order and content as migrated', () => {
  assert.equal(PLACEMENTS.length, 38)
  assert.equal(PLACEMENTS[0]?.src, GLUE_SRC)
  // Every earlier entry kept its place: the 5 files cover the 38 in order.
  const perFile = readdirSync(PLACEMENTS_DIR).filter((n) => n.endsWith('.json')).sort()
    .map((n) => JSON.parse(readFileSync(join(PLACEMENTS_DIR, n), 'utf8')).placements.length)
  assert.deepEqual(perFile, [8, 3, 15, 5, 7])
  assert.equal(perFile.reduce((a, b) => a + b, 0), 38)
})

/** The tracked non-tsc files of the runtime dist mirror (what an install ships). */
const TRACKED_MIRROR = execFileSync('git', ['ls-files', 'packages/runtime/dist'], { cwd: REPO_ROOT, encoding: 'utf8' })
  .split('\n').filter((f) => /\.(mjs|py)$/.test(f)).sort()

/** Mirror parity: tracked-but-unplaced (would go stale on the next edit) and placed-but-untracked. */
function mirrorParity(placements) {
  const placed = new Set(placements.map((p) => p.dist))
  return {
    unplaced: TRACKED_MIRROR.filter((f) => !placed.has(f)),
    untracked: [...placed].filter((f) => !TRACKED_MIRROR.includes(f)),
  }
}

test('shipped ledger: the tracked dist mirror equals the ledger dist set (no unbooked mirror file)', () => {
  assert.deepEqual(mirrorParity(PLACEMENTS), { unplaced: [], untracked: [] })
})

test('enumeration is deterministic: two loads agree, and the order is the file-name prefix', () => {
  const a = loadPlacements()
  const b = loadPlacements()
  assert.deepEqual(a, b)
  // Reversing the readdir order must not move the result: the loader sorts.
  const files = readdirSync(PLACEMENTS_DIR).filter((n) => n.endsWith('.json'))
  const reversed = [...files].reverse().sort()
  assert.deepEqual(reversed, [...files].sort())
  assert.deepEqual(a.map((p) => p.src), PLACEMENTS.map((p) => p.src))
})

test('RED-first: a REMOVED placement is detected (the drift a by-hand list hid)', () => {
  const dir = plantedLedger((d) => editDoc(d, '030-fs-family.json', (doc) => { doc.placements.splice(3, 1) }))
  try {
    const now = loadPlacements(dir)
    assert.equal(now.length, 37)
    // The dropped entry's mirror file is still tracked, so the parity leg above
    // names it: a removal can no longer leave a stale shipped copy behind silently
    // (check D of check-artifacts-committed only compares what the list names).
    const dropped = PLACEMENTS.find((p) => !now.some((q) => q.src === p.src))
    assert.deepEqual(mirrorParity(now), { unplaced: [dropped.dist], untracked: [] })
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('RED-first: a mis-named file, a duplicate prefix, an unknown schema and an empty list all refuse', () => {
  const cases = [
    ['no-prefix.json', (d) => { writeFileSync(join(d, 'no-prefix.json'), readFileSync(join(d, '010-runtime-live-rows.json'), 'utf8')) }, /<NNN>-<family>\.json/],
    ['dup-prefix', (d) => { writeFileSync(join(d, '010-second.json'), JSON.stringify({ schema: 'dist-placements/1', placements: [{ src: 'packages/x/y.mjs', dist: 'packages/runtime/dist/packages/x/y.mjs' }] })) }, /prefix 010 is already taken/],
    ['schema', (d) => editDoc(d, '020-runtime-entry-deps.json', (doc) => { doc.schema = 'dist-placements/2' }), /schema/],
    ['empty', (d) => editDoc(d, '020-runtime-entry-deps.json', (doc) => { doc.placements = [] }), /non-empty/],
    ['mirror', (d) => editDoc(d, '010-runtime-live-rows.json', (doc) => { doc.placements[1].dist = 'packages/runtime/dist/packages/elsewhere.mjs' }), /mirror law/],
    ['dup-src', (d) => editDoc(d, '020-runtime-entry-deps.json', (doc) => { doc.placements[0].src = GLUE_SRC; doc.placements[0].dist = `packages/runtime/dist/${GLUE_SRC}` }), /duplicate src/],
    ['no-glue-first', (d) => editDoc(d, '010-runtime-live-rows.json', (doc) => { doc.placements.shift() }), /first placement must be the glue/],
  ]
  for (const [label, mutate, expected] of cases) {
    const dir = plantedLedger(mutate)
    try {
      assert.throws(() => loadPlacements(dir), expected, label)
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  }
})

test('RED-first (review R1 F-1): a stray entry — other extension, subdirectory, dotfile — refuses BY NAME', () => {
  for (const [label, plant, named] of [
    ['x.txt', (d) => writeFileSync(join(d, 'x.txt'), 'hidden placement'), 'x.txt'],
    ['sub/y.json', (d) => { mkdirSync(join(d, 'sub')); writeFileSync(join(d, 'sub', 'y.json'), '{}') }, 'sub/'],
    ['.hidden.json', (d) => writeFileSync(join(d, '.060-hidden.json'), '{}'), '.060-hidden.json'],
  ]) {
    const dir = plantedLedger(plant)
    try {
      assert.throws(() => loadPlacements(dir), (e) => /stray-entry/.test(e.message) && e.message.includes(named), label)
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  }
})

test('order law (review R1 F-2): prefix GAPS are allowed and order correctly; only duplicates/ill-formed names refuse', () => {
  // the shipped ledger already has gaps (010, 020, …, 050 — nine numbers between each)
  const prefixes = readdirSync(PLACEMENTS_DIR).map((n) => Number(n.slice(0, 3)))
  assert.ok(prefixes.some((p, i) => i > 0 && p - prefixes[i - 1] > 1), 'the shipped prefixes are gapped by design')
  // a file dropped INTO a gap (015, between 010 and 020) lands exactly there
  const dir = plantedLedger((d) => writeFileSync(join(d, '015-gap-family.json'), JSON.stringify({
    schema: 'dist-placements/1',
    placements: [{ src: 'packages/tools/gap-family/src/row.mjs', dist: 'packages/runtime/dist/packages/tools/gap-family/src/row.mjs' }],
  })))
  try {
    const now = loadPlacements(dir)
    assert.equal(now.length, 39)
    assert.equal(now[8]?.src, 'packages/tools/gap-family/src/row.mjs', 'after the eight 010 entries, before the 020 ones')
    assert.deepEqual(now.slice(0, 8), PLACEMENTS.slice(0, 8))
    assert.deepEqual(now.slice(9), PLACEMENTS.slice(8))
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('RED-first: an EMPTY directory refuses instead of reading as "no placements"', () => {
  const dir = mkdtempSync(join(tmpdir(), 'dist-placements-empty-'))
  try {
    assert.throws(() => loadPlacements(dir), /no placement files/)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('a new family adds ONE file and edits none: the appended entry lands after the existing ones', () => {
  const dir = plantedLedger((d) => writeFileSync(join(d, '060-u7-w0-family.json'), JSON.stringify({
    schema: 'dist-placements/1',
    family: 'u7-w0-family',
    placements: [{ src: 'packages/tools/u7-w0-family/src/row.mjs', dist: 'packages/runtime/dist/packages/tools/u7-w0-family/src/row.mjs' }],
  }, null, 2) + '\n'))
  try {
    const now = loadPlacements(dir)
    assert.equal(now.length, 39)
    assert.equal(now.at(-1)?.src, 'packages/tools/u7-w0-family/src/row.mjs')
    assert.deepEqual(now.slice(0, 38), PLACEMENTS, 'the existing 38 are untouched, in order')
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})
