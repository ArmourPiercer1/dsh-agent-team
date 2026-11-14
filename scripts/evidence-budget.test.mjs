/**
 * evidence-budget.test.mjs — the measurement algebra. The git/filesystem half
 * is exercised by running the tool on the real tree; these cases pin the parts
 * a cap proposal depends on (percentiles, over-cap split, numstat parsing).
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { formatBytes, parseNumstatLog, percentile, summarize } from './evidence-budget.mjs'

test('percentile is nearest-rank and total for the empty and single cases', () => {
  assert.equal(percentile([], 50), 0)
  assert.equal(percentile([7], 50), 7)
  assert.equal(percentile([7], 90), 7)
  assert.equal(percentile([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 50), 5)
  assert.equal(percentile([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 90), 9)
  assert.equal(percentile([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 100), 10)
})

test('summarize reports count, p50, p90, max, total and only over-cap rows', () => {
  const rows = [
    { label: 'a', bytes: 100 },
    { label: 'b', bytes: 300 },
    { label: 'c', bytes: 900 },
    { label: 'd', bytes: 2000 },
  ]
  const s = summarize(rows, 1000)
  assert.equal(s.count, 4)
  assert.equal(s.p50, 300)
  assert.equal(s.p90, 2000)
  assert.equal(s.max, 2000)
  assert.equal(s.totalBytes, 3300)
  assert.equal(s.overCapCount, 1)
  assert.equal(s.overCap[0].label, 'd')
})

test('summarize ignores rows without a finite byte count and never goes negative', () => {
  const s = summarize([{ label: 'ok', bytes: 10 }, { label: 'nan', bytes: NaN }, null, { label: 'neg', bytes: -5 }], 100)
  assert.equal(s.count, 2)
  assert.equal(s.totalBytes, 10)
  assert.equal(s.max, 10)
})

test('a cap of zero flags every non-empty row (the cap must be explicit)', () => {
  const s = summarize([{ label: 'a', bytes: 1 }, { label: 'b', bytes: 0 }], 0)
  assert.equal(s.overCapCount, 1)
  assert.equal(s.overCap[0].label, 'a')
})

test('numstat parsing keeps zero-byte commits and ignores the blank separator', () => {
  const text = [
    '@@abc123\tsubject one',
    '10\t0\tdev/agent-workflow/evidence/x/a.txt',
    '5\t2\tdev/agent-workflow/evidence/x/b.json',
    '',
    '@@def456\tsubject two',
    '',
  ].join('\n')
  const rows = parseNumstatLog(text)
  assert.equal(rows.length, 2)
  assert.deepEqual(rows[0], { sha: 'abc123', subject: 'subject one', bytes: 15, files: 2 })
  assert.equal(rows[1].bytes, 0)
})

test('binary numstat entries count the file but add no bytes', () => {
  const rows = parseNumstatLog('@@abc\tsubject\n-\t-\tdev/agent-workflow/evidence/x/a.png\n')
  assert.equal(rows[0].bytes, 0)
  assert.equal(rows[0].files, 1)
})

test('formatBytes stays human at the boundaries', () => {
  assert.equal(formatBytes(0), '0 B')
  assert.equal(formatBytes(1023), '1023 B')
  assert.equal(formatBytes(1024), '1.0 KiB')
  assert.equal(formatBytes(2 * 1024 * 1024), '2.0 MiB')
})

test('the CLI self-test runs without network', () => {
  const r = spawnSync(process.execPath, ['scripts/evidence-budget.mjs', '--self-test'], { encoding: 'utf8' })
  assert.equal(r.status, 0, r.stdout + r.stderr)
  assert.match(r.stdout, /DSH-EVIDENCE-BUDGET-SELFTEST PASS/)
})
