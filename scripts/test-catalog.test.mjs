/**
 * Host-free regression suite for the M1 Test Catalog (shadow).
 *
 * The catalog is a measuring instrument, so the suite pins the two things that
 * would make its numbers meaningless if they regressed: a wrong classification
 * (uncollected reported as collected, or the reverse) and a missing refusal
 * (a deleted contract test, a stale exclude, a duplicate logical id).
 */
import assert from 'node:assert/strict'
import test from 'node:test'
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'

import {
  buildEntries,
  auditCatalog,
  parseVitestConfig,
  matchesAny,
  digestOf,
  classifyInstruments,
  refOf,
  summarize,
} from './test-catalog.mjs'

const CFG = { include: ['packages/*/test/**/*.test.ts', 'packages/runtime/controlled-fs/test/**/*.test.ts'], exclude: ['**/*.scratch.test.ts', 'packages/client/test/spike.test.ts'] }
const REGISTRY = {
  contracts: [{ id: 'AUTH-01', test_refs: [{ path: 'packages/runtime/test/auth.test.ts', id: 'auth.binding' }] }],
  excludes: [{ path: 'dev/agent-workflow/evidence/x/y.test.ts', reason: 'recorder', review: 'on rewrite' }],
  instruments: [],
}

test('discovery: vitest and node tests are catalogued, non-tests are not', () => {
  const files = new Set([
    'packages/runtime/test/auth.test.ts',
    'packages/runtime/controlled-fs/test/cf.test.ts',
    'scripts/a.test.mjs',
    'tests/kits/k/run.mjs',
  ])
  const { entries } = buildEntries(files, { vitestCfg: CFG, registry: REGISTRY, ciCollected: new Set(['scripts/a.test.mjs']) })
  const paths = entries.map((e) => e.path).sort()
  assert.deepEqual(paths, ['packages/runtime/controlled-fs/test/cf.test.ts', 'packages/runtime/test/auth.test.ts', 'scripts/a.test.mjs'])
})

test('classification: collected, uncollected and excluded are distinct', () => {
  const files = new Set([
    'packages/runtime/test/auth.test.ts',
    'packages/runtime/test/z.scratch.test.ts',
    'scripts/a.test.mjs',
    'scripts/b.test.mjs',
    'dev/agent-workflow/evidence/x/y.test.ts',
  ])
  const { entries } = buildEntries(files, { vitestCfg: CFG, registry: REGISTRY, ciCollected: new Set(['scripts/a.test.mjs']) })
  const c = Object.fromEntries(entries.map((e) => [e.path, e.classification]))
  assert.equal(c['packages/runtime/test/auth.test.ts'], 'DISCOVERED_AND_COLLECTED')
  assert.equal(c['packages/runtime/test/z.scratch.test.ts'], 'EXCLUDED_WITH_REASON')
  assert.equal(c['scripts/a.test.mjs'], 'DISCOVERED_AND_COLLECTED')
  assert.equal(c['scripts/b.test.mjs'], 'UNCOLLECTED')
  assert.equal(c['dev/agent-workflow/evidence/x/y.test.ts'], 'EXCLUDED_WITH_REASON')
})

test('refusal: a discovered-but-uncollected unit is red by default and quiet only in shadow mode', () => {
  const files = new Set(['scripts/b.test.mjs'])
  const { entries } = buildEntries(files, { vitestCfg: CFG, registry: REGISTRY })
  assert.ok(auditCatalog(entries).some((f) => f.code === 'TEST_UNCOLLECTED'))
  assert.equal(auditCatalog(entries, { allowUncollected: true }).length, 0)
})

test('refusal: the ratchet refuses GROWTH but tolerates the recorded baseline', () => {
  const files = new Set(['scripts/b.test.mjs', 'scripts/c.test.mjs'])
  const { entries } = buildEntries(files, { vitestCfg: CFG, registry: REGISTRY })
  assert.equal(auditCatalog(entries, { maxUncollected: 2 }).length, 0)
  const grew = auditCatalog(entries, { maxUncollected: 1 })
  assert.ok(grew.some((f) => f.code === 'UNCOLLECTED_GREW'))
})

test('refusal: deleting a contract test is red, not a smaller catalog', () => {
  const { findings } = buildEntries(new Set(['packages/runtime/test/other.test.ts']), { vitestCfg: CFG, registry: REGISTRY })
  const f = findings.find((x) => x.code === 'CONTRACT_UNKNOWN_TEST')
  assert.ok(f)
  assert.equal(f.contract, 'AUTH-01')
})

test('refusal: a contract with no test_refs is an unbacked promise', () => {
  const { findings } = buildEntries(new Set(['scripts/a.test.mjs']), { vitestCfg: CFG, registry: { contracts: [{ id: 'X-01', test_refs: [] }] } })
  assert.ok(findings.some((f) => f.code === 'CONTRACT_WITHOUT_TEST'))
})

test('refusal: an exclude without reason+review is stale', () => {
  const { findings } = buildEntries(new Set(['dev/agent-workflow/evidence/x/y.test.ts']), { vitestCfg: CFG, registry: { excludes: [{ path: 'dev/agent-workflow/evidence/x/y.test.ts' }] } })
  assert.ok(findings.some((f) => f.code === 'STALE_EXCLUDE'))
})

test('refusal: two tests sharing one logical id is red', () => {
  const reg = { contracts: [{ id: 'A-01', test_refs: [{ path: 'packages/runtime/test/auth.test.ts', id: 'dup' }, { path: 'packages/runtime/controlled-fs/test/cf.test.ts', id: 'dup' }] }] }
  const { findings } = buildEntries(new Set(['packages/runtime/test/auth.test.ts', 'packages/runtime/controlled-fs/test/cf.test.ts']), { vitestCfg: CFG, registry: reg })
  assert.ok(findings.some((f) => f.code === 'DUPLICATE_ID'))
})

test('refusal: an instrument without its driver is red', () => {
  const { findings } = classifyInstruments({ instruments: [{ id: 'k', driver: 'tests/kits/k/run.mjs' }] }, { exists: () => false })
  assert.ok(findings.some((f) => f.code === 'INSTRUMENT_DRIVER_MISSING'))
})

test('logical ids survive a path move, and refOf tolerates both shapes', () => {
  assert.deepEqual(refOf('a.test.ts'), { path: 'a.test.ts', id: null })
  assert.deepEqual(refOf({ path: 'a.test.ts', id: 'x' }), { path: 'a.test.ts', id: 'x' })
  const reg = { contracts: [{ id: 'A-01', test_refs: [{ path: 'packages/runtime/test/auth.test.ts', id: 'auth.binding' }] }] }
  const moved = buildEntries(new Set(['packages/runtime/test/auth.test.ts']), { vitestCfg: CFG, registry: reg }).entries[0]
  assert.equal(moved.id, 'auth.binding')
})

test('digest ignores order and entry classification but tracks the test set', () => {
  const a = buildEntries(new Set(['scripts/a.test.mjs', 'scripts/b.test.mjs']), { vitestCfg: CFG, registry: REGISTRY }).entries
  const b = [...a].reverse()
  assert.equal(digestOf(a), digestOf(b))
  const c = buildEntries(new Set(['scripts/a.test.mjs']), { vitestCfg: CFG, registry: REGISTRY }).entries
  assert.notEqual(digestOf(a), digestOf(c))
})

test('glob semantics: ** crosses directories, * does not', () => {
  assert.ok(matchesAny('packages/a/b/test/x.test.ts', ['packages/**/test/**/*.test.ts']))
  assert.ok(!matchesAny('packages/a/b/test/x.test.ts', ['packages/*/test/*.test.ts']))
})

test('vitest.config.ts is the source for include/exclude (no copy here)', () => {
  const text = readFileSync('vitest.config.ts', 'utf8')
  const cfg = parseVitestConfig(text)
  assert.ok(cfg.include.length >= 1)
  assert.ok(cfg.exclude.includes('**/*.scratch.test.ts'))
  assert.throws(() => parseVitestConfig('export default defineConfig({ test: {} })'))
})

test('live read-only check: every registered contract test exists on this head', () => {
  const tracked = execFileSync('git', ['ls-files', '-z'], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }).split('\0').filter(Boolean)
  const registry = JSON.parse(readFileSync('dev/ci/test-contracts.json', 'utf8'))
  const trackedSet = new Set(tracked)
  for (const c of registry.contracts) {
    assert.ok(c.test_refs.length > 0, `${c.id} has no test_refs`)
    for (const raw of c.test_refs) {
      const ref = refOf(raw)
      assert.ok(trackedSet.has(ref.path), `${c.id} refs a missing test: ${ref.path}`)
    }
  }
  const live = buildEntries(trackedSet, { vitestCfg: parseVitestConfig(readFileSync('vitest.config.ts', 'utf8')), registry, ciCollected: new Set() })
  assert.ok(summarize(live.entries, []).total > 700)
})
