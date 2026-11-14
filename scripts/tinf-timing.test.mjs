/**
 * Host-free regression suite for the TINF M3 harness timer (`scripts/tinf-timing.mjs`).
 *
 * The timer is a measuring instrument, and it is wired into the census path in SHADOW, so the
 * things that would make it dangerous or useless are pinned here rather than trusted:
 *   - a wrapped call that throws is recorded `failed` AND re-thrown (the gate's catch must still see it);
 *   - a sync leg stays sync (no promise sneaks into the leg loop and reorders output);
 *   - an unwritable timing dir is a WARNING — a broken clock may never redden a green census;
 *   - the summarizer REFUSES empty, foreign, tampered and census-less input with exit 2, because a
 *     zero-second report is a wrong answer (same rule as census-profile.mjs);
 *   - the nine-root decomposition is DERIVED from the vitest report (the roots run concurrently in
 *     one process), and a root with no readable span is `failed`, never a 0 ms `ok`.
 *
 * Host-free: pure functions + mkdtemp fixtures + three cheap `node` spawns. No port, no DSH_HOME,
 * no pristine host, no build, no network.
 */
import assert from 'node:assert/strict'
import test from 'node:test'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  SCHEMA,
  COLUMNS,
  createTimer,
  parseRows,
  percentile,
  render,
  rootOf,
  rowsFromVitestReport,
  summarize,
  hasCensusRows,
  verdictToken,
} from './tinf-timing.mjs'

const SCRIPT = fileURLToPath(new URL('./tinf-timing.mjs', import.meta.url))

function tmp(prefix = 'tinf-timing-test-') {
  return mkdtempSync(join(tmpdir(), prefix))
}

function cli(args) {
  const r = spawnSync(process.execPath, [SCRIPT, ...args], { encoding: 'utf8' })
  return { status: r.status, out: `${r.stdout}\n${r.stderr}` }
}

function rowsOf(dir) {
  return parseRows(readFileSync(join(dir, 'tinf-timing.tsv'), 'utf8'), { file: 'tinf-timing.tsv' })
}

const row = (overrides = {}) => ({
  phase: 'census-capture', root: 'nine-roots', attempt: 1, run_id: 'r1', duration_ms: 1000, status: 'ok', ...overrides,
})

function writeTsv(dir, rows, { header = true } = {}) {
  // Fill the write-once columns with valid values so a test can state only the field it is about.
  const filled = rows.map((r) => ({
    schema: SCHEMA,
    run_id: 'r1',
    attempt: 1,
    started_at: '2026-11-14T00:00:00.000Z',
    identity: '-',
    status: 'ok',
    ...r,
  }))
  const body = filled
    .map((r) => COLUMNS.map((c) => String(r[c]).replace(/[\t\r\n]+/g, ' ')).join('\t'))
    .join('\n')
  writeFileSync(join(dir, 'tinf-timing.tsv'), `${header ? `${COLUMNS.join('\t')}\n` : ''}${body}\n`)
}

test('timer: a sync call is recorded ok and its return value is passed through untouched', () => {
  const dir = tmp()
  const timer = createTimer({ dir, runId: 'run-a', identity: { host_commit: 'a'.repeat(40) } })
  const value = timer.time('leg', 'graph-parse', () => ({ verdict: 'pass' }))
  // Not a promise: the leg loop must not be forced to await (that would reorder the gate's output).
  assert.equal(typeof value.then, 'undefined')
  assert.deepEqual(value, { verdict: 'pass' })
  const flushed = timer.flush()
  assert.equal(flushed.rows, 1)
  assert.deepEqual(flushed.warnings, [])
  const { rows, problems } = rowsOf(dir)
  assert.deepEqual(problems, [])
  assert.equal(rows.length, 1)
  assert.equal(rows[0].schema, SCHEMA)
  assert.equal(rows[0].phase, 'leg')
  assert.equal(rows[0].root, 'graph-parse')
  assert.equal(rows[0].status, 'ok')
  assert.ok(Number.isInteger(rows[0].duration_ms) && rows[0].duration_ms >= 0)
  assert.match(rows[0].identity, /host_commit=a{40}/)
})

test('timer: a throw is recorded failed AND re-thrown (the gate catch must still see it)', () => {
  const dir = tmp()
  const timer = createTimer({ dir, runId: 'run-b' })
  assert.throws(() => timer.time('census-capture', 'nine-roots', () => { throw new Error('vitest exploded') }), /vitest exploded/)
  timer.flush()
  const { rows } = rowsOf(dir)
  assert.equal(rows.length, 1)
  assert.equal(rows[0].status, 'failed')
})

test('timer: an async rejection is recorded failed and propagates', async () => {
  const dir = tmp()
  const timer = createTimer({ dir, runId: 'run-c' })
  await assert.rejects(timer.time('census-capture', 'nine-roots', async () => { throw new Error('async exploded') }), /async exploded/)
  timer.flush()
  assert.equal(rowsOf(dir).rows[0].status, 'failed')
  // and a resolving async call is ok
  const okTimer = createTimer({ dir, runId: 'run-d' })
  const out = await okTimer.time('census-capture', 'nine-roots', async () => 7)
  assert.equal(out, 7)
  okTimer.flush()
  assert.equal(rowsOf(dir).rows[1].status, 'ok')
})

test('timer: an unwritable directory degrades to a warning — never to an exception', () => {
  const parent = tmp()
  // A path whose parent is a FILE: mkdir must fail (ENOTDIR) on every platform.
  writeFileSync(join(parent, 'not-a-dir'), 'x')
  const timer = createTimer({ dir: join(parent, 'not-a-dir', 'timing'), runId: 'run-e' })
  assert.equal(timer.path, null)
  assert.equal(timer.time('leg', 'typecheck', () => 42), 42)
  const flushed = timer.flush()
  assert.equal(flushed.rows, 1)
  assert.ok(flushed.warnings.some((w) => w.startsWith('TIMING_DIR_UNWRITABLE')), JSON.stringify(flushed.warnings))
})

test('timer: no dir is a silent no-op (the default gate run writes no file)', () => {
  const timer = createTimer({ dir: null, runId: 'run-f' })
  assert.equal(timer.time('leg', 'install', () => 'ok'), 'ok')
  const flushed = timer.flush()
  assert.equal(flushed.path, null)
  assert.deepEqual(flushed.warnings, [])
})

test('timer: a row records the attempt it belongs to and the identity it was given', () => {
  const dir = tmp()
  const timer = createTimer({ dir, runId: 'run-g', identity: { product_merge_tree: 'b'.repeat(40) } })
  timer.time('census-capture', 'nine-roots', () => 1, { attempt: 2 })
  timer.flush()
  const r = rowsOf(dir).rows[0]
  assert.equal(r.attempt, 2)
  assert.match(r.identity, /product_merge_tree=b{40}/)
})

test('summarize: empty input is refused (exit 2, NO_INPUT_ROWS), not reported as zero seconds', () => {
  const dir = tmp()
  writeFileSync(join(dir, 'tinf-timing.tsv'), `${COLUMNS.join('\t')}\n`)
  const r = cli(['--summarize', dir])
  assert.equal(r.status, 2)
  assert.match(r.out, /REFUSED NO_INPUT_ROWS/)
})

test('summarize: a foreign TSV is refused (BAD_SCHEMA), and it names the line', () => {
  const dir = tmp()
  writeFileSync(join(dir, 'other.tsv'), 'schema\trun_id\tphase\troot\tattempt\tstarted_at\tduration_ms\tstatus\tidentity\nbilling/2\tr\tp\troot\t1\t2026-11-14T00:00:00Z\t1\tok\t-\n')
  const r = cli(['--summarize', dir])
  assert.equal(r.status, 2)
  assert.match(r.out, /REFUSED BAD_ROW/)
  assert.match(r.out, /other\.tsv:2/)
  assert.match(r.out, /BAD_SCHEMA/)
})

test('summarize: rows with no census phase are refused (a leg row named census is not one)', () => {
  const dir = tmp()
  writeTsv(dir, [row({ phase: 'leg', root: 'census' }), row({ phase: 'leg', root: 'typecheck' })])
  const r = cli(['--summarize', dir])
  assert.equal(r.status, 2)
  assert.match(r.out, /REFUSED NO_CENSUS_ROWS/)
  assert.match(r.out, /phases seen: leg/)
})

test('summarize: a tampered row is refused by line — bad duration', () => {
  const dir = tmp()
  writeTsv(dir, [row()])
  const text = readFileSync(join(dir, 'tinf-timing.tsv'), 'utf8').replace('\t1000\tok\t', '\t12.5\tok\t')
  writeFileSync(join(dir, 'tinf-timing.tsv'), text)
  const r = cli(['--summarize', dir])
  assert.equal(r.status, 2)
  assert.match(r.out, /REFUSED BAD_ROW/)
  assert.match(r.out, /BAD_DURATION/)
  assert.match(r.out, /:2 /)
})

test('summarize: a tampered row is refused by line — unknown status', () => {
  const dir = tmp()
  writeTsv(dir, [row()])
  const text = readFileSync(join(dir, 'tinf-timing.tsv'), 'utf8').replace('\t1000\tok\t', '\t1000\tmaybe\t')
  writeFileSync(join(dir, 'tinf-timing.tsv'), text)
  const r = cli(['--summarize', dir])
  assert.equal(r.status, 2)
  assert.match(r.out, /BAD_STATUS/)
})

test('summarize: 3 roots x 2 attempts — medians, p90 and per-root capture shares', () => {
  // Attempt 1 is slow, attempt 2 is warm; three roots overlap inside each attempt.
  const rows = [
    row({ duration_ms: 200000, attempt: 1 }),
    row({ duration_ms: 100000, attempt: 2 }),
    row({ phase: 'census-root', root: 'packages/runtime', attempt: 1, duration_ms: 180000 }),
    row({ phase: 'census-root', root: 'packages/runtime', attempt: 2, duration_ms: 90000 }),
    row({ phase: 'census-root', root: 'packages/domain', attempt: 1, duration_ms: 80000 }),
    row({ phase: 'census-root', root: 'packages/domain', attempt: 2, duration_ms: 30000 }),
    row({ phase: 'census-root', root: 'packages/storage', attempt: 1, duration_ms: 20000 }),
    row({ phase: 'census-root', root: 'packages/storage', attempt: 2, duration_ms: 10000 }),
  ]
  const report = summarize(rows, { files: ['x.tsv'] })
  const byRoot = Object.fromEntries(report.census_roots.map((r) => [r.root, r]))
  // Capture median of [200000, 100000] under nearest-rank = 100000.
  assert.equal(report.census_capture_median_ms, 100000)
  assert.equal(report.census_total_ms, 300000)
  assert.deepEqual(report.census_attempts, [1, 2])
  // runtime: values [180000, 90000] -> nearest-rank median = 90000 -> 90% of the capture median.
  assert.equal(byRoot['packages/runtime'].median_ms, 90000)
  assert.equal(byRoot['packages/runtime'].share_of_capture_pct, 90)
  assert.equal(byRoot['packages/runtime'].p90_ms, 180000)
  assert.equal(byRoot['packages/domain'].share_of_capture_pct, 30)
  assert.equal(byRoot['packages/storage'].share_of_capture_pct, 10)
  // Derived rows never enter the phase denominator, and state no share of their own.
  assert.equal(report.phases.find((p) => p.phase === 'census-capture').share_pct, 100)
  assert.equal(report.phases.find((p) => p.phase === 'census-root').share_pct, null)
  assert.equal(report.cold_warm, 'not-distinguished')
  assert.match(render(report), /cold\/warm: NOT distinguished/)
  assert.match(verdictToken(report), /^DSH-TINF-TIMING rows=8 run_ids=1 census_capture_ms=300000 top_root="packages\/runtime"/)
})

test('summarize: --json is the machine form of the same report', () => {
  const dir = tmp()
  writeTsv(dir, [row(), row({ phase: 'census-root', root: 'packages/domain', duration_ms: 400 })])
  const r = cli(['--summarize', join(dir, 'tinf-timing.tsv'), '--json'])
  assert.equal(r.status, 0)
  const parsed = JSON.parse(r.out)
  assert.equal(parsed.schema, SCHEMA)
  assert.equal(parsed.rows, 2)
  assert.equal(parsed.census_roots.length, 1)
  assert.equal(parsed.census_roots[0].root, 'packages/domain')
})

test('summarize: a directory and an explicit file are both accepted', () => {
  const dir = tmp()
  writeTsv(dir, [row()])
  assert.equal(cli(['--summarize', dir]).status, 0)
  assert.equal(cli(['--summarize', join(dir, 'tinf-timing.tsv')]).status, 0)
  assert.equal(cli(['--summarize', join(dir, 'absent.tsv')]).status, 2)
})

test('derived roots: named from the /packages/ anchor, windowed, and honest about missing spans', () => {
  assert.equal(rootOf('/home/runner/work/repo/packages/domain/test/a.test.ts'), 'packages/domain')
  assert.equal(rootOf('/w/packages/runtime/controlled-fs/test/x.test.ts'), 'packages/runtime/controlled-fs')
  const rows = rowsFromVitestReport({
    testResults: [
      { name: '/w/packages/domain/test/a.test.ts', startTime: 1000, endTime: 5000 },
      { name: '/w/packages/domain/test/b.test.ts', startTime: 2000, endTime: 7000 },
      { name: '/w/packages/storage/test/c.test.ts', startTime: 1500, endTime: 9000 },
    ],
  }, { attempt: 2 })
  const domain = rows.find((r) => r.root === 'packages/domain')
  assert.equal(domain.durationMs, 6000) // max(end) - min(start), NOT the sum of two files
  assert.equal(domain.status, 'ok')
  assert.equal(domain.attempt, 2)
  const broken = rowsFromVitestReport({ testResults: [{ name: '/w/packages/x/test/a.test.ts', startTime: null, endTime: null }] })
  assert.equal(broken[0].status, 'failed')
  assert.equal(hasCensusRows([{ phase: 'census-root' }]), true)
})

test('parser: the schema pin is the constant the wire format claims', () => {
  assert.equal(SCHEMA, 'tinf-timing/1')
  assert.deepEqual(COLUMNS, ['schema', 'run_id', 'phase', 'root', 'attempt', 'started_at', 'duration_ms', 'status', 'identity'])
  assert.equal(percentile([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 50), 5)
  assert.equal(percentile([], 90), 0)
})

test('cli: --self-test pins its own parser (exit 0)', () => {
  const r = cli(['--self-test'])
  assert.equal(r.status, 0, r.out)
  assert.match(r.out, /DSH-TINF-TIMING-SELFTEST PASS/)
})
