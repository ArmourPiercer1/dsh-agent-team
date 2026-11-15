/**
 * tinf-trust-closeout.test.mjs — negative controls for the TINF trust-closeout findings.
 *
 * Each block names the finding it pins and the exact mutation that must turn it red:
 *   F-02  plan records a per-root FILE LIST; the report's collected set is compared both ways.
 *   F-04  the raw process exit is carried into the shard and a green report + non-zero exit is red.
 *   F-05  the uncollected baseline is a SET, not a count (new/fixed/stale/reappears).
 *
 * Host-free: every fixture is synthetic, and the only subprocesses are this repo's own scripts.
 */
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import test from 'node:test'

import {
  buildShardArtifacts,
  EXIT_POLICY,
  exitTolerance,
  resultsFromReport,
  writeShardArtifacts,
} from './census-execution.mjs'
import { aggregate, render } from './census-aggregate.mjs'
import { buildPlan, checkPopulationBaseline, makeIdentity, populationBaselineOf } from './census-plan.mjs'
import { checkUncollectedBaseline, UNCOLLECTED_BASELINE_SCHEMA } from './test-catalog.mjs'

const REPO_ROOT = resolve(new URL('..', import.meta.url).pathname)
const IDENTITY = makeIdentity({
  merge_tree_sha: '1'.repeat(40),
  host_sha: '2'.repeat(40),
  catalog_digest: `sha256:${'3'.repeat(64)}`,
  build_digest: `sha256:${'4'.repeat(64)}`,
})

function planWith(files, { root = 'packages/a', captures = 2 } = {}) {
  return buildPlan({
    roots: [{ root, files_expected: files }],
    captures,
    identity: IDENTITY,
  })
}

/** A vitest report that collected exactly `names` and every assertion passed. */
function reportOf(names, { success = true } = {}) {
  return {
    success,
    testResults: names.map((name) => ({
      name: `/runner/work/repo/${name}`,
      status: 'passed',
      assertionResults: [{ status: 'passed' }],
    })),
  }
}

// ── F-02: a count is not a population ─────────────────────────────────────────────────────────────

test('F-02 counterexample: a plan of 100 files + a green report collecting 1 is INCOMPLETE/FILE_MISSING, never PASS', () => {
  const files = Array.from({ length: 100 }, (_, i) => `test/f${String(i).padStart(3, '0')}.test.ts`)
  const plan = planWith(files)
  const got = resultsFromReport({
    plan,
    capture: 1,
    reportRef: 'report-1.json',
    exitCode: 0,
    report: reportOf(['packages/a/test/f000.test.ts']),
  })
  assert.equal(got.ok, true, got.detail)
  const row = got.results[0]
  assert.equal(row.state, 'INCOMPLETE', 'one collected file out of 100 planned is not a pass')
  assert.deepEqual(row.codes, ['FILE_MISSING'])
  assert.equal(row.files_expected, 100)
  assert.equal(row.files_observed, 1)
  assert.equal(row.file_digest, plan.roots[0].file_digest)
  assert.match(row.detail, /FILE_MISSING packages\/a: 99 planned file\(s\) are absent/)
})

test('F-02 both directions: a collected file the plan does not name is INCOMPLETE/FILE_UNPLANNED', () => {
  const plan = planWith(['test/a.test.ts', 'test/b.test.ts'])
  const got = resultsFromReport({
    plan,
    capture: 1,
    reportRef: 'r.json',
    exitCode: 0,
    report: reportOf(['packages/a/test/a.test.ts', 'packages/a/test/b.test.ts', 'packages/a/test/c.test.ts']),
  })
  assert.equal(got.ok, true, got.detail)
  assert.equal(got.results[0].state, 'INCOMPLETE')
  assert.deepEqual(got.results[0].codes, ['FILE_UNPLANNED'])
  assert.match(got.results[0].detail, /FILE_UNPLANNED packages\/a: 1 collected file\(s\) are not in the plan/)
})

test('F-02: a collected file with ZERO assertions is INCOMPLETE/NO_ASSERTIONS (names are not a measurement)', () => {
  const plan = planWith(['test/a.test.ts'])
  const shapes = [
    { label: 'empty assertionResults', entry: { status: 'passed', assertionResults: [] } },
    { label: 'pending, no assertions', entry: { status: 'pending', assertionResults: [] } },
    { label: 'passed, no assertionResults key', entry: { status: 'passed' } },
  ]
  for (const { label, entry } of shapes) {
    const report = {
      success: true,
      testResults: [{ name: '/runner/work/repo/packages/a/test/a.test.ts', ...entry }],
    }
    const got = resultsFromReport({ plan, capture: 1, reportRef: 'r.json', report, exitCode: 0 })
    assert.equal(got.ok, true, `${label}: ${got.detail}`)
    assert.equal(got.results[0].state, 'INCOMPLETE', label)
    assert.deepEqual(got.results[0].codes, ['NO_ASSERTIONS'], label)
    assert.match(got.results[0].detail, /NO_ASSERTIONS packages\/a: 1 collected file/)
  }
})

test('F-02 positive control: N files with N>0 assertions (total) passes', () => {
  const plan = planWith(['test/a.test.ts', 'test/b.test.ts'])
  const report = {
    success: true,
    testResults: ['test/a.test.ts', 'test/b.test.ts'].map((name) => ({
      name: `/runner/work/repo/packages/a/${name}`,
      status: 'passed',
      assertionResults: [{ status: 'passed' }, { status: 'passed' }],
    })),
  }
  const got = resultsFromReport({ plan, capture: 1, reportRef: 'r.json', report, exitCode: 0 })
  assert.equal(got.ok, true, got.detail)
  assert.equal(got.results[0].state, 'PASS')
  assert.equal(got.results[0].assertions, 4)
})

test('F-02 aggregator: a PASS result that carries assertions=0 is RESULT_NO_ASSERTIONS (INCOMPLETE)', () => {
  const plan = planWith(['test/a.test.ts'])
  const root = plan.roots[0]
  const results = plan.tasks.map((task) => ({
    task_id: task.task_id,
    root: task.root,
    capture: task.capture,
    state: 'PASS',
    codes: [],
    files: 1,
    files_expected: 1,
    files_observed: 1,
    file_digest: root.file_digest,
    assertions: 0,
    skipped: 0,
    exit_code: 0,
    evidence: 'artifacts/task.json',
  }))
  const built = buildShardArtifacts({ plan, results, shards: 1, exitCode: 0 })
  const got = aggregate({ plan, shards: built.artifacts.map((a) => ({ file: a.file, text: `${JSON.stringify(a.json, null, 2)}\n` })) })
  assert.equal(got.summary.census_verdict, 'INCOMPLETE')
  assert.ok(got.summary.codes.includes('RESULT_NO_ASSERTIONS'), got.summary.codes.join(','))
  assert.equal(got.summary.counts.assertions_total, 0)
  assert.match(render(got), /assertions_total=0/)
})

test('F-02: an equal-size replacement is caught by the per-root FILE DIGEST, not by the count', () => {
  const before = planWith(['test/a.test.ts', 'test/b.test.ts'])
  const after = planWith(['test/a.test.ts', 'test/other.test.ts'])
  assert.equal(before.roots[0].files, after.roots[0].files, 'same count')
  assert.notEqual(before.roots[0].file_digest, after.roots[0].file_digest, 'different population')
})

test('F-02: a file-level collection error is INCOMPLETE/COLLECTION_ERROR (not a failed assertion)', () => {
  const plan = planWith(['test/a.test.ts', 'test/b.test.ts'])
  const report = reportOf(['packages/a/test/a.test.ts', 'packages/a/test/b.test.ts'])
  report.testResults[0] = { name: report.testResults[0].name, status: 'failed', message: 'import failed', assertionResults: [] }
  const got = resultsFromReport({ plan, capture: 1, reportRef: 'r.json', report, exitCode: 0 })
  assert.equal(got.results[0].state, 'INCOMPLETE')
  assert.deepEqual(got.results[0].codes, ['COLLECTION_ERROR'])
})

test('F-02: a plan that records only counts is refused (PLAN_POPULATION_MISSING), not graded', () => {
  const plan = planWith(['test/a.test.ts'])
  // Hand-delete the enumerable population, leaving the count a legacy plan carried.
  plan.roots = plan.roots.map(({ root, files }) => ({ root, files }))
  const got = resultsFromReport({
    plan,
    capture: 1,
    reportRef: 'r.json',
    exitCode: 0,
    report: reportOf(['packages/a/test/a.test.ts']),
  })
  assert.equal(got.ok, false)
  assert.equal(got.code, 'PLAN_POPULATION_MISSING')
})

test('F-02 aggregator: a result derived from another file set is RESULT_FILE_SET_MISMATCH', () => {
  const plan = planWith(['test/a.test.ts', 'test/b.test.ts'])
  const result = {
    task_id: plan.tasks[0].task_id,
    root: 'packages/a',
    capture: 1,
    state: 'PASS',
    file_digest: `sha256:${'9'.repeat(64)}`,
    files_expected: 2,
    files_observed: 2,
    evidence: 'e.json',
  }
  const built = buildShardArtifacts({ plan, results: [result, { ...result, task_id: plan.tasks[1].task_id, capture: 2 }], shards: 1 })
  const shard = { schema: built.artifacts[0].json.schema, text: JSON.stringify(built.artifacts[0].json) }
  const got = aggregate({ plan, shards: [shard] })
  assert.equal(got.refused, true)
  assert.deepEqual(got.codes, ['RESULT_FILE_SET_MISMATCH'])
})

test('F-02 aggregator: observed files that do not sum to the plan are SUMMARY_FILE_TOTAL_MISMATCH', () => {
  const plan = planWith(['test/a.test.ts', 'test/b.test.ts'])
  const results = plan.tasks.map((t) => ({
    task_id: t.task_id,
    root: t.root,
    capture: t.capture,
    state: 'PASS',
    files_expected: 2,
    files_observed: 1, // the row's own digest is right; the SUM is what disagrees
    file_digest: plan.roots[0].file_digest,
    evidence: 'e.json',
  }))
  const built = buildShardArtifacts({ plan, results, shards: 1 })
  const got = aggregate({ plan, shards: [{ schema: built.artifacts[0].json.schema, text: JSON.stringify(built.artifacts[0].json) }] })
  assert.equal(got.refused, false)
  assert.equal(got.verdict, 'INCOMPLETE')
  assert.ok(got.codes.includes('SUMMARY_FILE_TOTAL_MISMATCH'), JSON.stringify(got.codes))
})

test('F-02 CLI: the 1-of-100 green report aggregates to a non-PASS token', () => {
  const dir = mkdtempSync(join(tmpdir(), 'tinf-f02-'))
  try {
    const files = Array.from({ length: 100 }, (_, i) => `test/f${String(i).padStart(3, '0')}.test.ts`)
    const plan = planWith(files)
    const results = []
    for (const task of plan.tasks) {
      // The aggregator OPENS each evidence reference: give it a real file beside the shard and anchor
      // the reference to that file's digest, exactly as the census leg does.
      const evidenceFile = `evidence-${String(task.capture)}.json`
      const evidenceBody = `${JSON.stringify({ capture: task.capture, root: task.root })}\n`
      writeFileSync(join(dir, evidenceFile), evidenceBody)
      const digest = `sha256:${createHash('sha256').update(evidenceBody).digest('hex')}`
      const derived = resultsFromReport({
        plan,
        capture: task.capture,
        reportRef: `report-${String(task.capture)}.json`,
        exitCode: 0,
        report: reportOf(['packages/a/test/f000.test.ts']),
      })
      assert.equal(derived.ok, true, derived.detail)
      results.push(...derived.results.map((r) => ({ ...r, evidence: `${evidenceFile}#${r.root} ${digest}` })))
    }
    const built = buildShardArtifacts({ plan, results, shards: 1 })
    const planFile = join(dir, 'plan.json')
    writeFileSync(planFile, `${JSON.stringify(plan, null, 2)}\n`)
    writeShardArtifacts(dir, built.artifacts)
    let out = ''
    let status = 0
    try {
      out = execFileSync(process.execPath, ['scripts/census-aggregate.mjs', '--plan', planFile, '--aggregate', join(dir, 'census-shard-1.json')], {
        cwd: REPO_ROOT,
        encoding: 'utf8',
      })
    } catch (e) {
      status = e.status
      out = `${e.stdout ?? ''}${e.stderr ?? ''}`
    }
    assert.equal(status, 1, out)
    assert.doesNotMatch(out, /DSH-CENSUS-SUMMARY PASS/)
    assert.match(out, /DSH-CENSUS-SUMMARY INCOMPLETE/)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

// ── F-04: the process's exit is a fact the census must carry ──────────────────────────────────────

test('F-04: a LIVE derivation without an explicit exit refuses EXIT_CODE_UNRECORDED (never a fabricated 0)', () => {
  const plan = planWith(['test/a.test.ts'])
  const report = reportOf(['packages/a/test/a.test.ts'])
  const got = resultsFromReport({ plan, capture: 1, reportRef: 'r.json', report })
  assert.equal(got.ok, false)
  assert.equal(got.code, 'EXIT_CODE_UNRECORDED')
  // A replay says so explicitly and needs no process exit.
  const replay = resultsFromReport({ plan, capture: 1, reportRef: 'r.json', report, exitCode: null, mode: 'replay' })
  assert.equal(replay.ok, true, replay.detail)
  assert.equal(replay.results[0].exit_code, null)
})

test('F-04: the default exit policy tolerates NOTHING', () => {
  assert.deepEqual(EXIT_POLICY.exitTolerances, [])
  assert.equal(exitTolerance({ code: 1 }).tolerated, false)
  assert.equal(exitTolerance({ code: 0 }).tolerated, false, 'even 0 needs no tolerance; only non-zero is asked about')
})

test('F-04: a shard carries the REAL exit code, and non-zero beside all-PASS is INFRA_ERROR', () => {
  const plan = planWith(['test/a.test.ts'])
  const results = plan.tasks.map((t) => ({
    task_id: t.task_id,
    root: t.root,
    capture: t.capture,
    state: 'PASS',
    files_expected: 1,
    files_observed: 1,
    file_digest: plan.roots[0].file_digest,
    evidence: 'e.json',
    exit_code: 1,
  }))
  const built = buildShardArtifacts({ plan, results, shards: 1, exitCode: 1 })
  assert.equal(built.artifacts[0].json.exit_code, 1, 'the artifact must not hard-code 0')
  const got = aggregate({ plan, shards: [{ schema: built.artifacts[0].json.schema, text: JSON.stringify(built.artifacts[0].json) }] })
  assert.equal(got.refused, false)
  assert.equal(got.verdict, 'INFRA_ERROR')
  assert.ok(got.codes.includes('SHARD_EXIT_NONZERO'))
})

test('F-04: a tolerance must be an explicit, non-expired, owned entry naming the exact code', () => {
  const policy = {
    schema: 'census-exit-policy/1',
    version: 1,
    exitTolerances: [
      { code: 1, signal: null, owner: 'someone', reason: 'known flake', expires: '2026-12-31' },
      { code: 2, signal: null, owner: 'someone', reason: 'expired', expires: '2026-01-01' },
      { code: 3, signal: null, owner: '', reason: 'no owner', expires: '2026-12-31' },
    ],
  }
  assert.equal(exitTolerance({ code: 1, policy, today: '2026-11-15' }).tolerated, true)
  assert.equal(exitTolerance({ code: 2, policy, today: '2026-11-15' }).tolerated, false, 'expired')
  assert.equal(exitTolerance({ code: 3, policy, today: '2026-11-15' }).tolerated, false, 'no owner')
  assert.equal(exitTolerance({ code: 4, policy, today: '2026-11-15' }).tolerated, false, 'unlisted code')
})

// ── F-05: the uncollected baseline is a SET ──────────────────────────────────────────────────────

const uncollected = (paths) => paths.map((path) => ({ path, runner: path.endsWith('.ts') ? 'vitest' : 'node', classification: 'UNCOLLECTED' }))
const baselineOf = (paths) => ({
  schema: UNCOLLECTED_BASELINE_SCHEMA,
  entries: paths.map((path) => ({ path, runner: 'vitest', classification: 'UNCOLLECTED', reason: 'baseline' })),
})

test('F-05: a new uncollected path outside the baseline is RED (UNCOLLECTED_NEW)', () => {
  const findings = checkUncollectedBaseline(uncollected(['a.test.ts', 'b.test.ts', 'new.test.ts']), {
    baseline: baselineOf(['a.test.ts', 'b.test.ts']),
    files: new Set(['a.test.ts', 'b.test.ts', 'new.test.ts']),
  })
  assert.equal(findings.length, 1)
  assert.equal(findings[0].code, 'UNCOLLECTED_NEW')
  assert.equal(findings[0].path, 'new.test.ts')
})

test('F-05: fixing one and adding one at the same COUNT is still caught by the set diff', () => {
  // The exact F-05 counterexample: 2 baseline entries, one fixed, one new -> count unchanged at 2.
  const findings = checkUncollectedBaseline(uncollected(['a.test.ts', 'new.test.ts']), {
    baseline: baselineOf(['a.test.ts', 'b.test.ts']),
    files: new Set(['a.test.ts', 'b.test.ts', 'new.test.ts']),
  })
  const codes = findings.map((f) => f.code).sort()
  assert.deepEqual(codes, ['UNCOLLECTED_FIXED', 'UNCOLLECTED_NEW'])
})

test('F-05: a baseline path whose file is gone is a non-blocking stale warning', () => {
  const findings = checkUncollectedBaseline(uncollected(['a.test.ts']), {
    baseline: baselineOf(['a.test.ts', 'deleted.test.ts']),
    files: new Set(['a.test.ts']),
  })
  assert.deepEqual(findings.map((f) => f.code), ['UNCOLLECTED_BASELINE_STALE'])
})

test('F-05: a path fixed and removed from the baseline, then uncollected again, is NEW again', () => {
  // `a` was fixed and removed from the baseline earlier; `b` was never baselined. The set diff has no
  // memory of `a`, so a regression there (or any new path) can only be NEW — there is no stale row to
  // hide behind.
  const findings = checkUncollectedBaseline(uncollected(['b.test.ts']), {
    baseline: baselineOf(['a.test.ts']),
    files: new Set(['a.test.ts', 'b.test.ts']),
  })
  assert.equal(findings.some((f) => f.code === 'UNCOLLECTED_NEW' && f.path === 'b.test.ts'), true)
  assert.equal(findings.some((f) => f.code === 'UNCOLLECTED_FIXED' && f.path === 'a.test.ts'), true)
})

test('F-05: an absent baseline is a refusal, never "no baseline, no rule"', () => {
  const findings = checkUncollectedBaseline(uncollected(['a.test.ts']), { baseline: null, files: new Set(['a.test.ts']) })
  assert.deepEqual(findings.map((f) => f.code), ['UNCOLLECTED_BASELINE_MISSING'])
})

// ── population baseline (F-02 review artifact) ────────────────────────────────────────────────────

test('population baseline reason gate: regeneration needs a reason; catalog drift is UNREVIEWED', () => {
  const roots = [{ root: 'packages/a', files_expected: ['test/a.test.ts'], files: 1, file_digest: 'sha256:' + 'a'.repeat(64) }]
  const catalog = 'sha256:' + 'b'.repeat(64)
  const reviewed = populationBaselineOf(roots, { acceptedReason: 'reviewed: initial population', acceptedBy: 'owner-a', catalogDigest: catalog })
  assert.equal(reviewed.accepted_reason, 'reviewed: initial population')
  assert.equal(reviewed.accepted_by, 'owner-a')
  assert.equal(reviewed.catalog_digest, catalog)
  assert.match(reviewed.generated_at, /^\d{4}-\d{2}-\d{2}T/)
  assert.equal(checkPopulationBaseline({ roots, baseline: reviewed, catalogDigest: catalog }).ok, true)
  const drifted = checkPopulationBaseline({ roots, baseline: reviewed, catalogDigest: 'sha256:' + 'c'.repeat(64) })
  assert.equal(drifted.code, 'POPULATION_BASELINE_UNREVIEWED')
  const unreviewed = populationBaselineOf(roots, { catalogDigest: catalog })
  const got = checkPopulationBaseline({ roots, baseline: unreviewed, catalogDigest: catalog })
  assert.equal(got.ok, true, 'no reason is only a risk when the digest DRIFTS')
})

test('population baseline: missing is refused; a lost file or an equal-count swap is POPULATION_SHRANK; growth passes', () => {
  const roots = (files) => buildPlan({ roots: [{ root: 'packages/a', files_expected: files }], captures: 1, identity: IDENTITY }).roots
  const base = populationBaselineOf(roots(['test/a.test.ts', 'test/b.test.ts']))
  assert.equal(checkPopulationBaseline({ roots: roots(['test/a.test.ts', 'test/b.test.ts']), baseline: base }).ok, true)
  assert.equal(checkPopulationBaseline({ roots: roots(['test/a.test.ts', 'test/b.test.ts', 'test/c.test.ts']), baseline: base }).ok, true, 'growth is not a shrink')
  assert.equal(checkPopulationBaseline({ roots: roots(['test/a.test.ts']), baseline: base }).code, 'POPULATION_SHRANK')
  const swap = checkPopulationBaseline({ roots: roots(['test/a.test.ts', 'test/other.test.ts']), baseline: base })
  assert.equal(swap.code, 'POPULATION_SHRANK', 'same count, different file set')
  assert.equal(checkPopulationBaseline({ roots: roots(['test/a.test.ts']), baseline: null }).code, 'POPULATION_BASELINE_MISSING')
  assert.equal(base.file_count, 2)
})
