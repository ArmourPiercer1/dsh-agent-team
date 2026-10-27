/**
 * dist-placements.test.mjs — u7-w0 (2026-10-26) C1 controls for the
 * enumerated placement ledger (`scripts/dist-placements/*.json` ← loaded by
 * `scripts/place-dist-glue.mjs`). ZERO builds, ZERO hosts, ZERO ports: every
 * case mutates an INPUT (a planted temp directory), never the tree.
 *
 * Run: node --test tests/checks/dist-placements.test.mjs
 * CI:  ci-integration leg `dist-placements node:test` (dev/ci/eb3-ci-manifest.json).
 *
 * u7-fixfwd (2026-10-27) — DERIVED, NOT LITERAL. The #397 version pinned the
 * 38-placement / 5-file snapshot (`PLACEMENTS.length === 38`, per-file
 * `[8,3,15,5,7]`, and 37/39 in the mutation cases). Every family lane since
 * added a file, so on a clean origin/master the check was 4 pass / 5 fail —
 * and no CI layer ran it, so nobody saw. Same lesson as the seam-test derived
 * count: the expected totals are now MEASURED from the files on disk at run
 * time, and the mutation cases assert DELTAS (N-1, N+1) from that measured N.
 * A new family adds one placement file and this test stays green unedited.
 *
 * What is pinned (every real law of the #397 version is kept):
 *   - the frozen `PLACEMENTS` equals a fresh load of the ledger on disk, and
 *     its length equals the sum of the per-file counts read from disk;
 *   - the FIRST placement is the glue; the order is the file-name prefix, not
 *     readdir order (deterministic: two loads agree);
 *   - RED-first: a removed placement, a mis-named file, a duplicate order
 *     prefix, a duplicate src, a broken mirror law, a misplaced glue, an
 *     unknown schema, an empty list, an empty directory and every stray entry
 *     ALL refuse; prefix GAPS are allowed and order correctly;
 *   - the tracked dist mirror equals the ledger's dist set. The parity filter
 *     covers EVERY extension placements actually ship — measured: mjs, py and
 *     json — so the legitimately placed
 *     `packages/runtime/dist/packages/tools/families/manifest.json` is no
 *     longer misread as "untracked" (the #397 filter matched mjs|py only).
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, extname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { GLUE_SRC, PLACEMENTS, PLACEMENTS_DIR, loadPlacements } from '../../scripts/place-dist-glue.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = resolve(HERE, '..', '..')

/** The ledger files, sorted (the prefix is the order). */
const LEDGER_FILES = readdirSync(PLACEMENTS_DIR).filter((n) => n.endsWith('.json')).sort()
/** The measured per-file counts and total N — read from disk, never a literal. */
const PER_FILE = LEDGER_FILES.map((n) => JSON.parse(readFileSync(join(PLACEMENTS_DIR, n), 'utf8')).placements.length)
const N = PER_FILE.reduce((a, b) => a + b, 0)

/** A copy of the live ledger that a case may mutate freely. */
function plantedLedger(mutate = () => {}) {
  const dir = mkdtempSync(join(tmpdir(), 'dist-placements-'))
  for (const name of LEDGER_FILES) {
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

test('shipped ledger: N derived from disk, glue first, every file non-empty, frozen list == a fresh load', () => {
  assert.ok(LEDGER_FILES.length > 0, 'the ledger directory holds placement files')
  assert.ok(PER_FILE.every((n) => n > 0), `every placement file is non-empty: ${JSON.stringify(PER_FILE)}`)
  assert.equal(PLACEMENTS.length, N, `PLACEMENTS (${String(PLACEMENTS.length)}) == sum of per-file counts read from disk (${String(N)})`)
  assert.equal(PLACEMENTS[0]?.src, GLUE_SRC)
  // The frozen export is exactly a fresh load: the loader is the one home.
  assert.deepEqual([...PLACEMENTS].map((p) => ({ ...p })), loadPlacements())
  // Per-file order: walking the files in prefix order reproduces PLACEMENTS.
  const walked = LEDGER_FILES.flatMap((n) => JSON.parse(readFileSync(join(PLACEMENTS_DIR, n), 'utf8')).placements.map((p) => p.src))
  assert.deepEqual(walked, PLACEMENTS.map((p) => p.src))
})

/** The extensions placements actually ship — measured from the ledger, not assumed. */
const SHIPPED_EXTS = [...new Set(PLACEMENTS.map((p) => extname(p.dist)))].sort()

/** The tracked non-tsc files of the runtime dist mirror (what an install ships).
 *  tsc emits .js/.d.ts/.map; everything else in the mirror is placed. The
 *  filter is the MEASURED shipped-extension set, so a new placed extension is
 *  covered automatically. */
const TRACKED_MIRROR = execFileSync('git', ['ls-files', 'packages/runtime/dist'], { cwd: REPO_ROOT, encoding: 'utf8' })
  .split('\n').filter((f) => f.length > 0 && SHIPPED_EXTS.includes(extname(f))).sort()

/** Mirror parity: tracked-but-unplaced (would go stale on the next edit) and placed-but-untracked. */
function mirrorParity(placements) {
  const placed = new Set(placements.map((p) => p.dist))
  return {
    unplaced: TRACKED_MIRROR.filter((f) => !placed.has(f)),
    untracked: [...placed].filter((f) => !TRACKED_MIRROR.includes(f)),
  }
}

test('mirror filter: covers every shipped extension (json included) and no tsc-emitted one', () => {
  // Measured on 2026-10-27: .mjs + .py + .json. The assertion is structural —
  // json MUST be covered while a placement ships one (the #397 filter missed it).
  assert.ok(SHIPPED_EXTS.length > 0)
  if (PLACEMENTS.some((p) => p.dist.endsWith('.json'))) assert.ok(SHIPPED_EXTS.includes('.json'))
  for (const tscExt of ['.js', '.ts', '.map']) assert.ok(!SHIPPED_EXTS.includes(tscExt), `${tscExt} is tsc output, never a placement`)
})

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

test('RED-first: a REMOVED placement is detected — DELTA N-1 (the drift a by-hand list hid)', () => {
  const dir = plantedLedger((d) => editDoc(d, '030-fs-family.json', (doc) => { doc.placements.splice(3, 1) }))
  try {
    const now = loadPlacements(dir)
    assert.equal(now.length, N - 1)
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
  // the shipped ledger is gapped by design (010, 020, … — nine numbers between each)
  const prefixes = LEDGER_FILES.map((n) => Number(n.slice(0, 3)))
  assert.ok(prefixes.some((p, i) => i > 0 && p - prefixes[i - 1] > 1), 'the shipped prefixes are gapped by design')
  assert.equal(prefixes[0], 10, 'the glue file keeps the first prefix (010)')
  assert.ok(prefixes[1] > 15, 'a 015 gap file lands between the first two shipped files')
  // a file dropped INTO a gap (015, between 010 and the next) lands exactly there
  const dir = plantedLedger((d) => writeFileSync(join(d, '015-gap-family.json'), JSON.stringify({
    schema: 'dist-placements/1',
    placements: [{ src: 'packages/tools/gap-family/src/row.mjs', dist: 'packages/runtime/dist/packages/tools/gap-family/src/row.mjs' }],
  })))
  try {
    const now = loadPlacements(dir)
    const first = PER_FILE[0] // the measured size of the 010 file
    assert.equal(now.length, N + 1)
    assert.equal(now[first]?.src, 'packages/tools/gap-family/src/row.mjs', 'after the whole 010 block, before the next file')
    assert.deepEqual(now.slice(0, first), PLACEMENTS.slice(0, first))
    assert.deepEqual(now.slice(first + 1), PLACEMENTS.slice(first))
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

test('a new family adds ONE file and edits none: the appended entry lands after the existing ones (DELTA N+1)', () => {
  // The next free prefix above the highest shipped one — derived, so this case
  // never collides with a real lane's file (the #397 literal 060 did, once
  // u7-w0b took it).
  const next = String(Math.max(...LEDGER_FILES.map((n) => Number(n.slice(0, 3)))) + 10).padStart(3, '0')
  assert.ok(Number(next) <= 999, 'the prefix space is not exhausted')
  const dir = plantedLedger((d) => writeFileSync(join(d, `${next}-new-family.json`), JSON.stringify({
    schema: 'dist-placements/1',
    family: 'new-family',
    placements: [{ src: 'packages/tools/new-family/src/row.mjs', dist: 'packages/runtime/dist/packages/tools/new-family/src/row.mjs' }],
  }, null, 2) + '\n'))
  try {
    const now = loadPlacements(dir)
    assert.equal(now.length, N + 1)
    assert.equal(now.at(-1)?.src, 'packages/tools/new-family/src/row.mjs')
    assert.deepEqual(now.slice(0, N), [...PLACEMENTS].map((p) => ({ ...p })), 'the existing N are untouched, in order')
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})
