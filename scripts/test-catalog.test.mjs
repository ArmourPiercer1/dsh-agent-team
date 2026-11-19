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
  gather,
  buildEntries,
  NODE_SUITE_RE,
  isNodeSuitePath,
  auditCatalog,
  parseVitestConfig,
  matchesAny,
  digestOf,
  classifyInstruments,
  refOf,
  summarize,
  excludedBaselineOf,
  checkExcludedBaseline,
  EXCLUDED_BASELINE_SCHEMA,
} from './test-catalog.mjs'
import { TEST_RE } from './test-collection-audit.mjs'
import {
  dispatchLegs,
  legByStep,
  loadManifest,
  resolveLeg,
  setDigest,
  trackedFiles,
} from './dispatch-tests.mjs'

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

test('discovery follows config include[], not the .test.ts suffix', () => {
  // packages/client includes `test/**/*.client.spec.ts[x]`; an extension-based
  // filter hid 32 real client suites from the first version of this catalog.
  const cfg = { include: ['test/**/*.test.ts', 'test/**/*.client.spec.ts', 'test/**/*.client.spec.tsx'], exclude: ['test/skip.client.spec.ts'] }
  const files = new Set(['packages/client/test/a.client.spec.ts', 'packages/client/test/b.client.spec.tsx', 'packages/client/test/c.test.ts', 'packages/client/test/skip.client.spec.ts', 'packages/client/test/d.spec.ts'])
  const { entries } = buildEntries(files, { configs: [{ base: 'packages/client', cfg }], registry: {} })
  const c = Object.fromEntries(entries.map((e) => [e.path, e.classification]))
  assert.equal(c['packages/client/test/a.client.spec.ts'], 'DISCOVERED_AND_COLLECTED')
  assert.equal(c['packages/client/test/b.client.spec.tsx'], 'DISCOVERED_AND_COLLECTED')
  assert.equal(c['packages/client/test/c.test.ts'], 'DISCOVERED_AND_COLLECTED')
  assert.equal(c['packages/client/test/skip.client.spec.ts'], 'EXCLUDED_WITH_REASON')
  assert.equal(c['packages/client/test/d.spec.ts'], 'UNCOLLECTED')
})

test('a config whose include spells out its own directory is repo-relative', () => {
  // tests/poc-web-native-reuse/vitest.poc.config.ts includes
  // 'tests/poc-web-native-reuse/**/*.test.ts' — the globs are repo-relative, not
  // relative to the config's directory. Reading it the other way hid four suites.
  const cfg0 = { include: ['test/**/*.test.ts'], exclude: [] }
  const cfg = { include: ['tests/poc-web-native-reuse/**/*.test.ts'], exclude: [] }
  const files = new Set(['tests/poc-web-native-reuse/poc-w1.test.ts', 'tests/poc-web-native-reuse/deep/poc-w9.test.ts'])
  const { entries } = buildEntries(files, { configs: [{ base: 'tests/poc-web-native-reuse', file: 'tests/poc-web-native-reuse/vitest.poc.config.ts', authoringOnly: true, cfg }], registry: {}, vitestCfg: cfg0 })
  assert.deepEqual(entries.map((e) => e.classification), ['UNCOLLECTED', 'UNCOLLECTED'])
  assert.match(entries[0].reason, /authoring-only/)
})

test('an authoring-only config does not make a suite collected', () => {
  // vitest.scratch.config.ts includes **/*.scratch.test.ts while the root config
  // excludes it. If "any include wins", a root-level scratch recorder is reported
  // as covered; it must instead be EXCLUDED by the authority config that governs it.
  const root = { include: ['packages/*/test/**/*.test.ts'], exclude: ['**/*.scratch.test.ts'] }
  const scratch = { include: ['**/*.scratch.test.ts'], exclude: [] }
  const files = new Set(['packages/runtime/test/zz-probe.scratch.test.ts'])
  const { entries } = buildEntries(files, {
    vitestCfg: root,
    configs: [{ base: '', file: 'vitest.config.ts', authoringOnly: false, cfg: root }, { base: '', file: 'vitest.scratch.config.ts', authoringOnly: true, cfg: scratch }],
    registry: {},
  })
  assert.equal(entries[0].classification, 'EXCLUDED_WITH_REASON')
  assert.equal(entries[0].reason, 'vitest config exclude[]')
})

test('a contract ref that is not a test file is refused', () => {
  const reg = { contracts: [{ id: 'A-01', test_refs: ['packages/domain/src/index.ts'] }] }
  const { findings } = buildEntries(new Set(['packages/domain/src/index.ts']), { configs: [{ base: '', cfg: CFG }], registry: reg })
  assert.ok(findings.some((f) => f.code === 'CONTRACT_REF_NOT_A_TEST'))
})

test('the CI step that dispatches this suite also runs the ratchet', () => {
  // The manifest declares this suite's leg, not the step's commands: without this the
  // ratchet line could be deleted and eb3-ci-required would still say pass.
  const wf = readFileSync('.github/workflows/ci-integration.yml', 'utf8')
  const manifest = loadManifest()
  const leg = dispatchLegs(manifest).find((l) => (l.leg.suites ?? []).includes('scripts/test-catalog.test.mjs'))
  assert.ok(leg, 'no dispatch leg collects scripts/test-catalog.test.mjs')
  const steps = wf.split(/^ {6}- name: /m)
  const step = steps.find((s) => s.includes(`--leg ${leg.id}`))
  assert.ok(step, `the step that dispatches ${leg.id} is gone from ci-integration.yml`)
  assert.ok(step.includes('--max-uncollected '), 'the ratchet command was removed from the catalog step')
  // The excludes channel is a non-execution path: the step must bound it too, or
  // "put the failing suite in excludes" silently retires it (review finding).
  assert.ok(step.includes('--max-excluded '), 'the excludes ratchet command was removed from the catalog step')
})

test('excludes: the non-execution channel is baselined — a new exclude is REFUSED', () => {
  const files = new Set([
    'dev/agent-workflow/evidence/x/y.test.ts',
    'tests/planted/never-runs.test.mjs',
  ])
  const registry = {
    contracts: [],
    excludes: [
      { path: 'dev/agent-workflow/evidence/x/y.test.ts', reason: 'recorder', review: 'on rewrite' },
      { path: 'tests/planted/never-runs.test.mjs', reason: 'planted', review: 'never' },
    ],
    instruments: [],
  }
  const { entries } = buildEntries(files, { vitestCfg: CFG, registry })
  // The reviewed baseline has ONLY the legitimate recorder.
  const baseline = excludedBaselineOf(entries.filter((e) => e.path !== 'tests/planted/never-runs.test.mjs'))
  assert.equal(baseline.schema, EXCLUDED_BASELINE_SCHEMA)
  assert.equal(baseline.excluded_count, 1)
  const findings = checkExcludedBaseline(entries, { baseline, files })
  assert.ok(findings.some((f) => f.code === 'EXCLUDED_NEW' && f.path === 'tests/planted/never-runs.test.mjs'), 'a planted exclude outside the baseline is EXCLUDED_NEW')
  // A population larger than the bound is EXCLUDED_GREW even if every path is baselined.
  const grown = excludedBaselineOf(entries)
  const grew = checkExcludedBaseline(entries, { baseline: grown, files, maxExcluded: 1 })
  assert.ok(grew.some((f) => f.code === 'EXCLUDED_GREW'), 'growth past --max-excluded is EXCLUDED_GREW')
  // No amnesty without the artifact.
  const missing = checkExcludedBaseline(entries, { baseline: null, files })
  assert.ok(missing.some((f) => f.code === 'EXCLUDED_BASELINE_MISSING'), 'a missing excludes baseline refuses')
  // And the legitimate, baselined entry passes with its reason + review carried through.
  const ok = checkExcludedBaseline(entries.filter((e) => e.path === 'dev/agent-workflow/evidence/x/y.test.ts'), { baseline, files })
  assert.equal(ok.length, 0, 'the reviewed entry is not refused')
  assert.equal(baseline.entries[0].reason, 'recorder')
  assert.equal(baseline.entries[0].review, 'on rewrite')
})

test('excludes: auditCatalog enforces the baseline on every invocation, not only under --max-uncollected', () => {
  const files = new Set(['tests/planted/never-runs.test.mjs'])
  const registry = { contracts: [], excludes: [{ path: 'tests/planted/never-runs.test.mjs', reason: 'planted', review: 'never' }], instruments: [] }
  const { entries } = buildEntries(files, { vitestCfg: CFG, registry })
  const findings = auditCatalog(entries, {
    allowUncollected: true,
    maxUncollected: 48,
    excludedBaseline: { schema: EXCLUDED_BASELINE_SCHEMA, excluded_count: 0, entries: [] },
    maxExcluded: 0,
    files,
  })
  assert.ok(findings.some((f) => f.code === 'EXCLUDED_NEW'), 'the excludes law runs alongside the uncollected ratchet')
  assert.ok(findings.some((f) => f.code === 'EXCLUDED_GREW'), 'and the count bound too')
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


// ───────────────────────────────── TINF M6: the catalog is the dispatcher ──
// The defect M6 removes is a file list with TWO copies. These laws keep the replacement honest:
// the workflow names only a leg, every leg resolves to tracked node:test suites, the catalog
// classifies every resolved suite as collected, and the committed old-vs-new parity evidence still
// describes the set the legs resolve today.

const WORKFLOWS = ['.github/workflows/ci-integration.yml', '.github/workflows/pr-gate.yml']

test('dispatch: no workflow enumerates a single node:test file any more (M6)', () => {
  for (const wf of WORKFLOWS) {
    const text = readFileSync(wf, 'utf8')
    const offenders = text.split('\n').filter((l) => /^\s*run: .*node --test/.test(l) || /^\s*node --test/.test(l))
    assert.deepEqual(offenders, [], `${wf}: a hand-written node:test file list came back; the manifest leg is the ONE declaration`)
  }
})

test('dispatch: every dispatch step maps to one manifest leg and every leg has its step', () => {
  const manifest = loadManifest()
  for (const wf of WORKFLOWS) {
    const expected = dispatchLegs(manifest).filter((l) => l.workflow === wf).map((l) => l.id).sort()
    const fromYaml = [...legByStep(readFileSync(wf, 'utf8')).values()].sort()
    assert.deepEqual(fromYaml, expected, `${wf}: dispatched legs and manifest legs disagree`)
    assert.equal(new Set(fromYaml).size, fromYaml.length, `${wf}: one leg dispatched twice runs it twice`)
  }
})

test('dispatch: every leg resolves to tracked node:test suites (no invented path)', () => {
  const tracked = trackedFiles()
  for (const { id, leg } of dispatchLegs(loadManifest())) {
    const r = resolveLeg(leg, tracked)
    assert.deepEqual(r.problems, [], `${id}: ${r.problems.map((p) => p.code).join(',')}`)
    assert.ok(r.suites.length > 0, `${id} resolved to nothing`)
  }
})

test('dispatch: the catalog classifies every dispatched suite as collected', () => {
  const state = gather({ cwd: process.cwd() })
  const byPath = new Map(state.entries.map((e) => [e.path, e]))
  for (const { id, leg } of dispatchLegs(loadManifest())) {
    for (const p of resolveLeg(leg, new Set(state.entries.map((e) => e.path))).suites) {
      const e = byPath.get(p) ?? state.entries.find((x) => x.path === p)
      assert.ok(e, `${id}: ${p} is not in the catalog`)
      assert.equal(e.runner, 'node', `${id}: ${p} is not a node:test suite`)
      assert.equal(e.classification, 'DISCOVERED_AND_COLLECTED', `${id}: ${p} is ${e.classification}, so CI would run an uncollected suite`)
    }
  }
})

test('dispatch: refusals — untracked, non-node, empty area, empty leg', () => {
  const tracked = new Set(['tests/area/a.test.mjs', 'scripts/x.mjs'])
  assert.equal(resolveLeg({ id: 'x', suites: ['tests/gone.test.mjs'] }, tracked).problems[0].code, 'DISPATCH_SUITE_UNTRACKED')
  assert.equal(resolveLeg({ id: 'x', suites: ['scripts/x.mjs'] }, tracked).problems[0].code, 'DISPATCH_SUITE_NOT_NODE_TEST')
  assert.equal(resolveLeg({ id: 'x', areas: ['tests/empty'] }, tracked).problems[0].code, 'DISPATCH_AREA_EMPTY')
  const none = resolveLeg({ id: 'x' }, tracked)
  assert.equal(none.problems[0].code, 'DISPATCH_NO_SUITES')
  assert.deepEqual(none.suites, [], 'an empty argv is never "run everything" here')
  const area = resolveLeg({ id: 'x', areas: ['tests/area'] }, tracked)
  assert.deepEqual(area.problems, [])
  assert.deepEqual(area.suites, ['tests/area/a.test.mjs'], 'an area collects the discovered suites under it')
})

test('dispatch: the committed parity evidence still describes the resolved set', () => {
  const evidence = readFileSync('dev/agent-workflow/evidence/tinf-m6-dispatch-parity/old-vs-new-argv.txt', 'utf8')
  // Trust-closeout regenerated this file with four NEW negative-control suites wired into the same
  // leg, so the verdict is DIFFERS by design. The laws that still hold are the ones that matter:
  // nothing may be MISSING, the run must have no problems, and the only added files are the four
  // named control suites. A future addition cannot hide behind this exception.
  // The comparison base is e5bf05670 (last pre-M6 workflow). 7e3b6532a is the M6 merge point and has
  // no old `node --test` argv at all, so a parity run against it reports 18 UNCONVERTED — the base
  // named in the evidence is the only meaningful one, and this assertion keeps that explicit.
  assert.match(evidence, /base: {2}e5bf05670/)
  const verdict = /DISPATCH-PARITY mode=inspect (\w+) steps=(\d+) old_files=(\d+) new_files=(\d+) problems=(\d+)/.exec(evidence)
  assert.ok(verdict, 'the evidence file has no DISPATCH-PARITY verdict line')
  assert.equal(verdict[5], '0', 'parity problems must be zero')
  assert.equal(verdict[1], 'DIFFERS', 'the regenerated evidence records a deliberate growth')
  const added = [...evidence.matchAll(/^ {4}\S.*?added=([^\n]+)$/gm)].flatMap((m) => (m[1] === 'none' ? [] : m[1].split(','))).sort()
  assert.deepEqual(added, [
    'scripts/contract-tiers.test.mjs',
    'scripts/dispatch-tests.test.mjs',
    'scripts/eb3-ci-required.test.mjs',
    'scripts/tinf-trust-closeout.test.mjs',
    // B2 (2026-11-16): EIGHT of the ten host-free `tests/s2-authority/` suites ride the
    // SAME tinf-instruments leg (explicit `suites[]`), for the SAME reason as M7-A: a new
    // dispatch step has no old-side `node --test` argv and would be a permanent UNCONVERTED
    // problem. TWO stay UNCOLLECTED: the tenth (consumer-candidate — its C10 compares the
    // live `git status` count, so it reds beside a sibling suite) and freeze-candidate
    // (passed the hosted leg on head e0514df18, failed the same byte-identical leg on head
    // 49bb277f in one case and does not reproduce locally — unknown nondeterminism).
    // Both were repaired in their own round (2026-11-18) and are collected BELOW: C10 now
    // compares the RENDERED fields only (the live `runtime` instrument is not rendered by
    // `renderView`), and freeze-candidate now drains stdout instead of `process.exit`ing.
    // Declared HERE so the next addition still cannot hide.
    'tests/s2-authority/authority-dual-read.test.mjs',
    'tests/s2-authority/authority-snapshot-isolated.test.mjs',
    'tests/s2-authority/candidate-track-negative-control.test.mjs',
    'tests/s2-authority/ci-snapshot-reader.test.mjs',
    // Residual-fixes round (2026-11-18): the two B2 suites that were held back are repaired at
    // their root and ride the SAME tinf-instruments leg (48 -> 50). freeze-candidate's generator
    // no longer drops its queued stdout on exit; consumer-candidate's C10 compares the RENDERED
    // fields only, not the live `runtime.dirty_paths` instrument. Both leave
    // dev/ci/uncollected-baseline.json (48 -> 46).
    'tests/s2-authority/consumer-candidate.test.mjs',
    'tests/s2-authority/current-authority-pointer.test.mjs',
    'tests/s2-authority/freeze-candidate.test.mjs',
    'tests/s2-authority/probe-candidate.test.mjs',
    'tests/s2-authority/sync-candidate-resolver.test.mjs',
    'tests/s2-authority/verify-candidate.test.mjs',
    // B3 (2026-11-16): batch B3 of the uncollected-test audit. The 28 world-factory suites the
    // audit called host-free were RE-MEASURED with the pinned tree ABSENT (its own rev-2 records
    // that the first host-free label was wrong for 18 files), and ride the SAME `tinf-instruments`
    // leg for the SAME M6 reason: a new dispatch step has no old-side `node --test` argv and would
    // be a permanent UNCONVERTED problem (measured problems=1 before the reshape). The three B3
    // files that are red regardless of the host (two install-shape `require.resolve` reds, one
    // stale product-debt anchor) are NOT collected and stay in the uncollected baseline. Declared
    // HERE so the next addition still cannot hide.
    'tests/world-factory/a5sf-acceptance-preflight.test.mjs',
    'tests/world-factory/a5sf-ask-precedence.test.mjs',
    'tests/world-factory/a5sf-assembly.test.mjs',
    'tests/world-factory/a5sf-bash.test.mjs',
    'tests/world-factory/a5sf-capability-defaults.test.mjs',
    'tests/world-factory/a5sf-dev-live-slots.test.mjs',
    'tests/world-factory/a5sf-dev-live.test.mjs',
    'tests/world-factory/a5sf-dual-plane.test.mjs',
    'tests/world-factory/a5sf-instrument-graph.test.mjs',
    'tests/world-factory/a5sf-p01-realm-binding.test.mjs',
    'tests/world-factory/a5sf-pd1-revocation-escape.test.mjs',
    'tests/world-factory/a5sf-pd12-bash-governance.test.mjs',
    'tests/world-factory/a5sf-pd13-terminal-read-axis.test.mjs',
    'tests/world-factory/a5sf-pd26-confined-skill.test.mjs',
    'tests/world-factory/a5sf-pd29-goal-stop.test.mjs',
    'tests/world-factory/a5sf-pd33-preview-e2e.test.mjs',
    'tests/world-factory/a5sf-pd34-member-stop.test.mjs',
    'tests/world-factory/a5sf-run-record-binding.test.mjs',
    'tests/world-factory/a5sf-search-live.test.mjs',
    'tests/world-factory/a5sf-window-taxonomy.test.mjs',
    'tests/world-factory/arm-verdict.test.mjs',
    'tests/world-factory/binding-digests.test.mjs',
    // M7-A (2026-11-15): the real-host slice's two host-free suites ride the
    // tinf-instruments leg (a new leg would be a permanent UNCONVERTED problem:
    // the parity law needs an old-side `node --test` argv for every dispatch
    // step). Declared HERE so the next addition still cannot hide.
    'tests/world-factory/m7a-real-slice-host-state.test.mjs',
    'tests/world-factory/m7a-real-slice-unit.test.mjs',
    'tests/world-factory/port-probe.test.mjs',
    // TINF observer closeout (2026-11-19): F-07/F-08/F-09 + M7-C controls, host-free, wired into
    // the same tinf-instruments leg (50 -> 51 suites; union 69 -> 70).
    'tests/world-factory/tinf-observer-closeout.test.mjs',
    'tests/world-factory/u6-arc-d.test.mjs',
    'tests/world-factory/u7-tbash-offline-drive.test.mjs',
    'tests/world-factory/u7-tbash-seam.test.mjs',
    'tests/world-factory/u7-tbash.test.mjs',
    'tests/world-factory/u7-uileg0-answer-drive.test.mjs',
    // Residual-fixes round (2026-11-18): the two B2 suites that were held back are repaired at
    // their root and ride the SAME tinf-instruments leg (48 -> 50). freeze-candidate's generator
    // no longer drops its queued stdout on exit; consumer-candidate's C10 compares the rendered
    // fields only, not the live `runtime.dirty_paths` instrument. Both leave
    // dev/ci/uncollected-baseline.json (48 -> 46).
  ])
  const missing = [...evidence.matchAll(/^ {4}\S.*?missing=([^\n]+?)(?: added=|$)/gm)].flatMap((m) => (m[1] === 'none' ? [] : m[1].split(',')))
  assert.deepEqual(missing, [], 'parity may grow the set; it may never lose a suite')
  const recorded = /union old=\d+ new=\d+ set=(sha256:[0-9a-f]{64})/.exec(evidence)
  assert.ok(recorded, 'the evidence file has no union digest line')
  const tracked = trackedFiles()
  const union = [...new Set(dispatchLegs(loadManifest()).flatMap(({ leg }) => resolveLeg(leg, tracked).suites))].sort()
  assert.equal(setDigest(union), recorded[1], 'the dispatched set moved away from the committed parity evidence — regenerate it deliberately')
})

test('one predicate: the catalog, the collection audit and the dispatcher share it', () => {
  // M6 replaced the workflow file lists; the OTHER duplicate was the filename predicate. Two regexes
  // one alternative apart (`.test` vs `.test|spec`) make the catalog call a suite collected while the
  // dispatcher refuses it. Identity, not equality: the same binding, from a leaf module that imports
  // nothing (test-catalog imports the audit, so the audit cannot import the catalog without a cycle).
  assert.equal(TEST_RE, NODE_SUITE_RE)
  assert.equal(isNodeSuitePath('a/b.spec.mjs'), true)
  assert.equal(isNodeSuitePath('a/b.test.mjs'), true)
  assert.equal(isNodeSuitePath('a/b.test.ts'), false, 'node --test does not execute a .test.ts')
  assert.equal(isNodeSuitePath('a/b.mjs'), false)
})
