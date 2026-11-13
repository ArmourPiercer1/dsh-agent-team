/**
 * coverage-audit.test.mjs — the rate arithmetic, plus a pin on the classifier
 * behaviour it reports (a kit runner must stay undetermined until a rule names it).
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { summarizeAudit } from './coverage-audit.mjs'
import { classify } from './ci-local.mjs'

const rows = [
  { sha: 'a', subject: 'docs', files: ['docs/x.md'], undetermined: [] },
  { sha: 'b', subject: 'kit', files: ['tests/kits/x/run.mjs'], undetermined: ['tests/kits/x/run.mjs'] },
  { sha: 'c', subject: 'mixed', files: ['scripts/x.mjs', 'docs/y.md'], undetermined: ['scripts/x.mjs'] },
  { sha: 'd', subject: 'empty', files: [], undetermined: [] },
]

test('rate counts only commits with a diff', () => {
  const r = summarizeAudit(rows)
  assert.equal(r.commits, 3)
  assert.equal(r.undeterminedCommits, 2)
  assert.equal(r.determinedCommits, 1)
  assert.equal(r.ratePct, 67)
})

test('path histogram sorts by count then path', () => {
  const r = summarizeAudit([
    ...rows,
    { sha: 'e', subject: 'again', files: ['tests/kits/x/run.mjs'], undetermined: ['tests/kits/x/run.mjs'] },
  ])
  assert.equal(r.topPaths[0].path, 'tests/kits/x/run.mjs')
  assert.equal(r.topPaths[0].count, 2)
})

test('examples only carry undetermined commits and respect --top', () => {
  const r = summarizeAudit(rows, 1)
  assert.equal(r.examples.length, 1)
  assert.ok(r.examples.every((e) => e.paths.length > 0))
})

test('an all-determined history reports 0%', () => {
  const r = summarizeAudit([{ sha: 'a', subject: 'docs', files: ['docs/x.md'], undetermined: [] }])
  assert.equal(r.ratePct, 0)
  assert.equal(r.undeterminedCommits, 0)
})

test('zero measurable commits does not divide by zero', () => {
  const r = summarizeAudit([{ sha: 'a', subject: 'empty', files: [], undetermined: [] }])
  assert.equal(r.commits, 0)
  assert.equal(r.ratePct, 0)
})

test('the classifier still refuses to place a kit runner (the finding, not a bug)', () => {
  const c = classify(['tests/kits/c1-leader-approval-smoke/c1-leader-approval-smoke.mjs'])
  assert.deepEqual(c.undetermined, ['tests/kits/c1-leader-approval-smoke/c1-leader-approval-smoke.mjs'])
})

test('prose and package paths stay determined', () => {
  assert.deepEqual(classify(['docs/x.md']).undetermined, [])
  assert.deepEqual(classify(['packages/runtime/src/a.ts']).undetermined, [])
})

test('the CLI self-test runs without network', () => {
  const r = spawnSync(process.execPath, ['scripts/coverage-audit.mjs', '--self-test'], { encoding: 'utf8' })
  assert.equal(r.status, 0, r.stdout + r.stderr)
  assert.match(r.stdout, /DSH-COVERAGE-AUDIT-SELFTEST PASS/)
})
