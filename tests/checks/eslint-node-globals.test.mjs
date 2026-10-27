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
 * The entries u7-w0 itself ADDED on top of the nine (a new node-side family is
 * exactly the case the collected list exists for): the p4t6 booking loader is a
 * plain .mjs the vitest suite imports. Not in the pre-u7-w0 list because it did
 * not exist; still asserted present, so a later removal is a RED here too.
 */
const ADDED_BY_U7W0 = ['packages/testkit/test/p4t6-bookings/*.mjs']
/**
 * U7-F (2026-10-26): dsh.inspect-family's node-side lane tree. The ONE
 * ambient symbol it needs is AbortController (the downstream abort handle
 * of the governed inspect-query settle race — a platform global with no
 * module to import it from); the lane imports node:fs/promises and the
 * shared cancel leg for everything else. This dated entry IS the registry:
 * a later removal is a RED here too, exactly the u7-w0 discipline.
 */
const ADDED_BY_LANES = [...ADDED_BY_U7W0, 'packages/tools/inspect-family/src/*.mjs']

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

test('parity: inline patterns + collected entries == the nine pre-u7-w0 entries + what u7-w0 added', () => {
  const all = [...inlinePatterns(), ...collected()]
  assert.deepEqual([...new Set(all)].sort(), [...PRE_U7W0_ENTRIES, ...ADDED_BY_LANES].sort())
  assert.equal(new Set(all).size, all.length, 'a pattern is declared twice (inline AND collected)')
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

test('RED-first: a REMOVED collected entry breaks parity (the family deleted its line, the tree did not)', () => {
  const dir = mkdtempSync(join(tmpdir(), 'eslint-globals-'))
  try {
    for (const name of readdirSync(DIR).filter((n) => n.endsWith('.json'))) writeFileSync(join(dir, name), readFileSync(join(DIR, name), 'utf8'))
    const target = join(dir, '010-runtime-plugin-node-modules.json')
    const doc = JSON.parse(readFileSync(target, 'utf8'))
    const removed = doc.globals.pop()
    writeFileSync(target, JSON.stringify(doc, null, 2) + '\n')
    const all = [...inlinePatterns(), ...collected(dir)]
    const missing = [...PRE_U7W0_ENTRIES, ...ADDED_BY_LANES].filter((p) => !all.includes(p))
    assert.deepEqual(missing, [removed])
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
