/**
 * eslint-node-globals.test.mjs — u7-w0 (2026-10-26) C1 controls for the
 * collected node-globals file list (`scripts/eslint-node-globals/*.json`,
 * spread into the second block of `eslint.config.mjs`). ZERO eslint runs
 * here: the config's own module is loaded and its block inspected, so this is
 * cheap and deterministic.
 *
 * Run: node --test tests/checks/eslint-node-globals.test.mjs
 *
 * What is pinned:
 *   - PARITY with the pre-u7-w0 list: the five tree patterns in the config plus
 *     the collected entries equal the NINE hand-written entries at
 *     origin/master 88107ad71 (as a SET — the order carries no meaning for a
 *     flat pattern list, and the numeric prefix is only a determinism device);
 *   - every collected entry (and every config pattern) matches at least one
 *     TRACKED file — a stale pattern silently disables node globals and turns
 *     into a phantom `no-undef`, which is exactly the stale-comment failure mode
 *     this repo keeps re-earning;
 *   - RED-first: a removed entry, a malformed document and an empty list all
 *     refuse or are detected.
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = resolve(HERE, '..', '..')
const DIR = join(REPO_ROOT, 'scripts', 'eslint-node-globals')

/**
 * The nine entries the `files` array carried by hand at origin/master
 * 88107ad71 (verbatim, from that blob). A removal or an addition that no
 * collected file accounts for is a RED here.
 */
const PRE_U7W0_ENTRIES = [
  'packages/tools/harness/**/*.mjs',
  'packages/runtime/member-residency/harness/**/*.mjs',
  'packages/runtime/root-binding/harness/**/*.mjs',
  'packages/legacy/session-reader/e2e/**/*.mjs',
  'packages/runtime/test/t12a-live-bridge.mjs',
  'packages/runtime/src/plugin/upstream-resolver.mjs',
  'packages/runtime/src/plugin/live/agent-bindings.mjs',
  'packages/runtime/src/plugin/live/jobs-background-producer.mjs',
  'packages/testkit/census/**/*.mjs',
]

/**
 * The CONFIG's own collector (exported by eslint.config.mjs since review R1),
 * so every control below exercises the code ESLint actually runs, not a copy.
 */
const { nodeGlobalsPatterns } = await import('../../eslint.config.mjs')
const collected = (dir = DIR) => nodeGlobalsPatterns(dir)

/** The five patterns the config keeps inline (a whole tree is node-side). */
function inlinePatterns() {
  const src = readFileSync(join(REPO_ROOT, 'eslint.config.mjs'), 'utf8')
  // THE block is the one that spreads the collected list (the earlier
  // `files: ['scripts/**/*.mjs']` block is a different law and stays as it is),
  // so the match is anchored on the spread and read BACKWARDS to its `files: [`.
  const at = src.indexOf('...nodeGlobalsPatterns(),')
  assert.ok(at > 0, 'eslint.config.mjs no longer spreads nodeGlobalsPatterns() into any `files` list')
  const open = src.lastIndexOf('files: [', at)
  assert.ok(open > 0, 'the spread is not inside a `files: [...]` list')
  return [...src.slice(open + 'files: ['.length, at).matchAll(/'([^']+)'/g)].map((m) => m[1])
}

/**
 * The entries the node-side LANES added on top of the nine.
 *
 * u7-fixfwd (2026-10-27) — DERIVED, NOT A LANE LIST. This used to be a literal
 * `[...ADDED_BY_U7W0, 'packages/tools/inspect-family/src/*.mjs']`, i.e. exactly
 * the per-family edit the u7-w0 collection law exists to abolish: every new
 * node-side lane had to come back and edit this line, and the one that did not
 * (U7-F web, PR #403 / a0d708c59, which shipped
 * `030-web-family-node-modules.json`) left this leg RED on master — unnoticed,
 * because no CI layer ran this suite until u7-fixfwd put `tests/checks` into
 * ci-integration.
 *
 * The expected set is now READ FROM the collected placement documents on disk,
 * independently of the collector itself (raw JSON, not `nodeGlobalsPatterns()`),
 * so the parity below still compares two independent readings of the tree.
 * `PRE_U7W0_ENTRIES` stays a frozen historical literal — that is history, not a
 * lane roster — and that is what keeps the assertion meaningful.
 */
function entriesOnDisk(dir = DIR) {
  return readdirSync(dir).filter((n) => n.endsWith('.json')).sort()
    .flatMap((n) => JSON.parse(readFileSync(join(dir, n), 'utf8')).globals)
}
/** The lane-added entries = whatever the collected documents carry beyond the
 *  frozen nine. Recomputed per call so a planted directory can be inspected. */
function laneAdded(dir = DIR) {
  return [...new Set(entriesOnDisk(dir))].filter((p) => !PRE_U7W0_ENTRIES.includes(p)).sort()
}
const ADDED_BY_LANES = laneAdded()

/**
 * Does a config-style glob match any tracked path? `**` spans path separators,
 * `*` does not — the two forms this config uses. Escapes regex metacharacters
 * except the glob ones.
 */
function matchesTracked(pattern, tracked) {
  const literal = (lit) => lit.replace(/[.+?^${}()|[\]\\]/g, '\\$&')
  const segment = (chunk) => chunk.split('*').map(literal).join('[^/]*')
  // `a/**/b` matches `a/b` too (zero directories), as in ESLint's minimatch.
  const rx = new RegExp(`^${pattern.split('**/').map((chunk) => chunk.split('**').map(segment).join('.*')).join('(?:.*/)?')}$`)
  return tracked.some((p) => rx.test(p))
}

/**
 * THE PARITY LAW, as a pure function of (inline, collected, expected-lane-set).
 * Returns the drift, never throws — so a control below can feed it a
 * deliberately-wrong `collected` and prove the law still bites.
 */
function parityFindings(inline, collectedList, laneSet, dir = DIR) {
  const all = [...inline, ...collectedList]
  const dupes = all.filter((p, i) => all.indexOf(p) !== i)
  const expected = new Set([...PRE_U7W0_ENTRIES, ...laneSet])
  return {
    duplicates: [...new Set(dupes)].sort(),
    // A frozen pre-u7-w0 entry that no longer appears anywhere: history lost.
    missingFrozen: PRE_U7W0_ENTRIES.filter((p) => !all.includes(p)).sort(),
    // A collected entry the tree does not carry: the collector invented one.
    notOnDisk: collectedList.filter((p) => !entriesOnDisk(dir).includes(p)).sort(),
    // A document entry the collector did not surface: the document is invisible
    // to eslint — a new lane's node globals would silently not apply.
    notCollected: [...expected].filter((p) => !all.includes(p)).sort(),
  }
}

test('parity: the frozen nine are all still declared, and inline adds no lane of its own', () => {

  const inline = inlinePatterns()
  // THE FROZEN HISTORY (a literal on purpose — it is a fact about 88107ad71).
  const missingFrozen = PRE_U7W0_ENTRIES.filter((p) => ![...inline, ...collected()].includes(p))
  assert.deepEqual(missingFrozen, [], `pre-u7-w0 entr(ies) no longer declared anywhere: ${missingFrozen.join(', ')}`)
  // INLINE ADDS NOTHING BEYOND THE NINE. A new node-side lane ships ONE
  // collected JSON and edits nothing — that is the u7-w0 collection law, and
  // this is the line that keeps it true (an inline addition is RED here).
  const inlineBeyondFrozen = inline.filter((p) => !PRE_U7W0_ENTRIES.includes(p))
  assert.deepEqual(inlineBeyondFrozen, [], `pattern(s) added inline to eslint.config.mjs instead of a collected JSON: ${inlineBeyondFrozen.join(', ')}`)
})

test('parity: collected == the collected documents on disk (derived — no lane roster to edit)', () => {
  const got = parityFindings(inlinePatterns(), collected(), ADDED_BY_LANES)
  assert.deepEqual(got.duplicates, [], `a pattern is declared twice (inline AND collected): ${got.duplicates.join(', ')}`)
  assert.deepEqual(got.missingFrozen, [], `pre-u7-w0 entr(ies) lost: ${got.missingFrozen.join(', ')}`)
  assert.deepEqual(got.notOnDisk, [], `collector returned pattern(s) no collected document carries: ${got.notOnDisk.join(', ')}`)
  // THE DRIFT DETECTOR: every entry a document on disk carries must reach the
  // config. A new lane that ships a JSON is picked up automatically; a document
  // the collector fails to surface is RED here, by DRIFT, not by a lane name.
  assert.deepEqual(got.notCollected, [], `collected document entr(ies) that never reached eslint.config.mjs (node globals silently off): ${got.notCollected.join(', ')}`)
  // And the two independent readings agree as sets.
  assert.deepEqual([...new Set(entriesOnDisk())].sort(), [...new Set(collected())].sort())
})

test('a NEW node-side lane is reflected with NO edit to this test (the u7-w0 collection law)', () => {
  const dir = mkdtempSync(join(tmpdir(), 'eslint-globals-newlane-'))
  try {
    for (const name of readdirSync(DIR).filter((n) => n.endsWith('.json'))) writeFileSync(join(dir, name), readFileSync(join(DIR, name), 'utf8'))
    const before = { disk: entriesOnDisk(dir), collected: collected(dir), lane: laneAdded(dir) }
    // A lane ships ONE file and edits nothing else — exactly the web-family shape.
    writeFileSync(join(dir, '040-brand-new-family.json'), JSON.stringify({
      schema: 'eslint-node-globals/1',
      family: 'brand-new-family',
      summary: 'a new node-side lane',
      globals: ['packages/tools/brand-new-family/src/*.mjs'],
    }, null, 2) + '\n')
    // The derivation sees it … (no edit to any literal in this file)
    assert.deepEqual(entriesOnDisk(dir), [...before.disk, 'packages/tools/brand-new-family/src/*.mjs'])
    assert.deepEqual(laneAdded(dir), [...before.lane, 'packages/tools/brand-new-family/src/*.mjs'].sort())
    // … the collector surfaces it …
    assert.deepEqual(collected(dir), [...before.collected, 'packages/tools/brand-new-family/src/*.mjs'])
    // … and the parity law is satisfied with the DERIVED set, no lane named.
    assert.deepEqual(parityFindings(inlinePatterns(), collected(dir), laneAdded(dir), dir), { duplicates: [], missingFrozen: [], notOnDisk: [], notCollected: [] })
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('RED-first: a lane JSON the collector fails to surface is caught as DRIFT (not by naming a lane)', () => {
  // The collector reading is INDEPENDENT of the raw document reading, so a
  // collector that drops a document is visible even though the expected set is
  // derived. Simulated by handing the law the un-updated collector output.
  const dir = mkdtempSync(join(tmpdir(), 'eslint-globals-drift-'))
  try {
    for (const name of readdirSync(DIR).filter((n) => n.endsWith('.json'))) writeFileSync(join(dir, name), readFileSync(join(DIR, name), 'utf8'))
    const stale = collected(dir) // taken BEFORE the lane ships its file
    writeFileSync(join(dir, '040-late-family.json'), JSON.stringify({
      schema: 'eslint-node-globals/1',
      family: 'late-family',
      summary: 'ships a document the collector run above never saw',
      globals: ['packages/tools/late-family/src/*.mjs'],
    }, null, 2) + '\n')
    const got = parityFindings(inlinePatterns(), stale, laneAdded(dir), dir)
    assert.deepEqual(got.notCollected, ['packages/tools/late-family/src/*.mjs'], 'the unsurfaced document entry is named by the law')
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('every declared pattern matches at least one TRACKED file (a stale pattern is RED)', () => {
  const tracked = execFileSync('git', ['ls-files'], { cwd: REPO_ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
    .split('\n').filter((f) => f !== '')
  const stale = [...inlinePatterns(), ...collected()].filter((pattern) => !matchesTracked(pattern, tracked))
  assert.deepEqual(stale, [], `pattern(s) matching no tracked file: ${stale.join(', ')} — a dead pattern reads as coverage that does not exist`)
})

test('the config is deterministic: two reads of the collected list agree, and the order is the file prefix', () => {
  assert.deepEqual(collected(), collected())
  const names = readdirSync(DIR).filter((n) => n.endsWith('.json'))
  assert.deepEqual(names, [...names].sort())
  for (const name of names) assert.match(name, /^\d{3}-[a-z0-9][a-z0-9-]*\.json$/, 'the numeric prefix is the order')
})

test('RED-first: a REMOVED frozen entry breaks parity (the family deleted its line, the tree did not)', () => {
  const dir = mkdtempSync(join(tmpdir(), 'eslint-globals-'))
  try {
    for (const name of readdirSync(DIR).filter((n) => n.endsWith('.json'))) writeFileSync(join(dir, name), readFileSync(join(DIR, name), 'utf8'))
    const target = join(dir, '010-runtime-plugin-node-modules.json')
    const doc = JSON.parse(readFileSync(target, 'utf8'))
    const removed = doc.globals.pop()
    writeFileSync(target, JSON.stringify(doc, null, 2) + '\n')
    // The FROZEN nine are history, so their loss is caught even though the
    // lane-added expectation is derived from the same tree.
    const got = parityFindings(inlinePatterns(), collected(dir), laneAdded(dir), dir)
    assert.deepEqual(got.missingFrozen, [removed], 'the deleted frozen entry is still demanded by the frozen list')
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('RED-first (review R1 F-1): a stray entry — other extension, subdirectory, dotfile — refuses BY NAME', () => {
  for (const [label, plant, named] of [
    ['x.txt', (d) => writeFileSync(join(d, 'x.txt'), 'hidden pattern'), 'x.txt'],
    ['sub/y.json', (d) => { mkdirSync(join(d, 'sub')); writeFileSync(join(d, 'sub', 'y.json'), '{}') }, 'sub'],
    ['.hidden', (d) => writeFileSync(join(d, '.030-hidden.json'), '{}'), '.030-hidden.json'],
  ]) {
    const dir = mkdtempSync(join(tmpdir(), 'eslint-globals-stray-'))
    try {
      for (const name of readdirSync(DIR)) writeFileSync(join(dir, name), readFileSync(join(DIR, name), 'utf8'))
      plant(dir)
      assert.throws(() => collected(dir), (e) => /stray-entry/.test(e.message) && e.message.includes(named), label)
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  }
})

test('RED-first: a malformed or empty document refuses instead of silently dropping globals', () => {
  const dir = mkdtempSync(join(tmpdir(), 'eslint-globals-bad-'))
  try {
    writeFileSync(join(dir, '010-bad-schema.json'), JSON.stringify({ schema: 'eslint-node-globals/2', globals: ['scripts/**/*.mjs'] }))
    assert.throws(() => collected(dir), /schema/)
    rmSync(join(dir, '010-bad-schema.json'))
    writeFileSync(join(dir, '010-empty.json'), JSON.stringify({ schema: 'eslint-node-globals/1', globals: [] }))
    assert.throws(() => collected(dir), /non-empty/)
    rmSync(join(dir, '010-empty.json'))
    writeFileSync(join(dir, '010-blank.json'), JSON.stringify({ schema: 'eslint-node-globals/1', globals: ['  '] }))
    assert.throws(() => collected(dir), /non-empty pattern string/)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})
