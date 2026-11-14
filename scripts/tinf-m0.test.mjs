// TINF M0 — one suite for the five baseline tools.
//
// Why one file: until M1 lands automatic discovery, every node:test leg is
// hand-listed in two places (workflow run line + manifest check[]). Four more
// separated files would mean four more hand-maintained entries — the exact
// anti-pattern TINF-01 names. One suite, one entry, and `test-collection-audit`
// reports the gap for everything else.
//
// Host-free: pure functions plus one read-only `git ls-files` pass. No ports, no
// DSH_HOME, no pristine host, no build, no network.
import test from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { resolve } from 'node:path'

import { evaluate, newestCheck, flattenPages, verdictToken as readyToken } from './pr-ready-check.mjs'
import { parseLsTree, parseBatchCheckOrdered, summarize, groupByDir, percentile, formatBytes } from './evidence-budget.mjs'
import { reasonOf, summarizeAudit, verdictToken as coverageToken } from './coverage-audit.mjs'
import { collectTokens, audit, inScope, verdictToken as collectionToken } from './test-collection-audit.mjs'
import { stepSeconds, profileJobs, percentile as profilePercentile, verdictToken as profileToken } from './census-profile.mjs'

const HEAD = 'a'.repeat(40)
const OTHER = 'b'.repeat(40)

function checks(overrides = {}) {
  const base = [
    ['ci-fast / ci-fast', 'completed', 'success', '2026-11-13T00:00:01Z'],
    ['ci-integration / ci-integration', 'completed', 'success', '2026-11-13T00:00:02Z'],
    ['ci-security / ci-security', 'completed', 'success', '2026-11-13T00:00:03Z'],
    ['ci-product / ci-product', 'completed', 'success', '2026-11-13T00:00:04Z'],
    ['ci-required-deferred', 'completed', 'success', '2026-11-13T00:00:05Z'],
    ['ci-census / census-runtime', 'completed', 'skipped', '2026-11-13T00:00:06Z'],
  ]
  return base.map(([name, status, conclusion, started_at]) => ({ name, status, conclusion, started_at, completed_at: started_at }))
    .concat(overrides.extra ?? [])
}

const readyInput = {
  pr: { number: 1, isDraft: true, mergeStateStatus: 'blocked', headRefOid: HEAD, headRefName: 'task/x', title: 'x', body: 'y', labels: [] },
  checks: checks(),
  comments: [{ id: 1, body: `**[dated settlement, 2026-11-13T16:00Z — done]**\ncovered head ${HEAD}` }],
  git: { clean: true, head: HEAD, branch: 'task/x', upstream: 'origin/task/x', ahead: 0, remoteHasHead: true },
}

test('ready: every precondition holds -> READY/0', () => {
  const v = evaluate(readyInput)
  assert.equal(v.verdict, 'READY')
  assert.equal(v.exit, 0)
  assert.deepEqual(v.reasons, [])
  assert.match(readyToken(v, 1), /^DSH-PR-READY verdict=READY pr=1 reasons=none$/)
})

test('ready: the five #759 false passes are now refusals', () => {
  // 1. unknown mergeability is not a fact about the branch
  assert.deepEqual(evaluate({ ...readyInput, pr: { ...readyInput.pr, mergeStateStatus: 'unknown' } }).reasons, ['STATE_UNKNOWN'])
  assert.deepEqual(evaluate({ ...readyInput, pr: { ...readyInput.pr, mergeStateStatus: undefined } }).reasons, ['STATE_MISSING'])
  // 2. a stale worktree may not grade its own branch
  assert.deepEqual(evaluate({ ...readyInput, git: { ...readyInput.git, head: OTHER } }).reasons, ['LOCAL_HEAD_NOT_PR_HEAD'])
  // 3. no remote branch is not "0 commits ahead"
  assert.deepEqual(evaluate({ ...readyInput, git: { ...readyInput.git, remoteHasHead: false, upstream: null, ahead: 0 } }).reasons, ['BRANCH_NOT_PUSHED'])
  // 4. a newer pending attempt outranks an older success
  const pending = checks({ extra: [{ name: 'ci-fast / ci-fast', status: 'in_progress', conclusion: null, started_at: '2026-11-13T00:10:00Z' }] })
  assert.deepEqual(evaluate({ ...readyInput, checks: pending }).reasons, ['LAYER_CI_FAST_IN_PROGRESS'])
  // 5. comment pagination is structural: flattenPages over pages keeps the old one
  const pages = [[{ id: 1, body: 'a' }], [{ id: 2, body: `settlement head ${HEAD}` }]]
  assert.equal(flattenPages(pages).length, 2)
})

test('ready: marker, census, label, settlement and duty-cycle refusals', () => {
  assert.deepEqual(evaluate({ ...readyInput, pr: { ...readyInput.pr, isDraft: false } }).reasons, ['ALREADY_READY'])
  assert.deepEqual(evaluate({ ...readyInput, pr: { ...readyInput.pr, title: 'DO-NOT-MERGE x' } }).reasons, ['MARKER_PRESENT_TITLE'])
  assert.deepEqual(evaluate({ ...readyInput, pr: { ...readyInput.pr, labels: [{ name: 'ci-defer-full' }] } }).reasons, ['DEFERRED_LABEL_PRESENT'])
  assert.deepEqual(evaluate({ ...readyInput, comments: [] }).reasons, ['SETTLEMENT_MISSING'])
  assert.deepEqual(evaluate({ ...readyInput, comments: [{ id: 9, body: `**[dated settlement, 2026-11-13T16:00Z — done]**\ncovered head ${OTHER}` }] }).reasons, ['SETTLEMENT_NOT_COVERING_HEAD'])
  assert.deepEqual(evaluate({ ...readyInput, git: { ...readyInput.git, clean: false } }).reasons, ['WORKTREE_DIRTY'])
  assert.deepEqual(evaluate({ ...readyInput, git: { ...readyInput.git, ahead: 2 } }).reasons, ['UNPUSHED_COMMITS'])
  const ran = checks().map((c) => (c.name.startsWith('ci-census') ? { ...c, conclusion: 'success' } : c))
  assert.deepEqual(evaluate({ ...readyInput, checks: ran }).reasons, ['CENSUS_SUCCESS_NOT_SKIPPED'])
  const red = checks().map((c) => (c.name.startsWith('ci-product') ? { ...c, conclusion: 'failure' } : c))
  assert.deepEqual(evaluate({ ...readyInput, checks: red }).reasons, ['LAYER_CI_PRODUCT_FAILURE'])
})

test('ready: a head without a 40-hex sha is refused, not guessed', () => {
  assert.deepEqual(evaluate({ ...readyInput, pr: { ...readyInput.pr, headRefOid: 'abc' } }).reasons, ['NO_HEAD_SHA'])
})

test('ready: newestCheck breaks ties by start time, not completion time', () => {
  const oldSuccess = { name: 'ci-fast / ci-fast', status: 'completed', conclusion: 'success', started_at: '2026-11-13T00:00:01Z', completed_at: '2026-11-13T00:00:02Z' }
  const newQueued = { name: 'ci-fast / ci-fast', status: 'queued', conclusion: null, started_at: '2026-11-13T00:05:00Z', completed_at: null }
  assert.equal(newestCheck([oldSuccess, newQueued], 'ci-fast').status, 'queued')
  assert.equal(newestCheck([oldSuccess], 'ci-not-there'), null)
})

test('evidence-budget: bytes come from the object DB, binaries included', () => {
  const rows = parseLsTree('100644 blob aaaa          12\tdev/agent-workflow/evidence/x/run.txt\n100644 blob bbbb     4194304\tdev/agent-workflow/evidence/x/shot.png\n')
  assert.equal(rows.length, 2)
  assert.equal(rows[1].bytes, 4194304)
  const batch = parseBatchCheckOrdered('aaaa blob 12\nbbbb missing\ncccc blob 7\n', 3)
  assert.deepEqual(batch, [12, 0, 7])
})

test('evidence-budget: the window is the last N commits, and zeros do not enter percentiles', () => {
  const s = summarize([{ bytes: 0 }, { bytes: 100 }, { bytes: 300 }], 200)
  assert.equal(s.count, 3)
  assert.equal(s.withEvidence, 2)
  assert.equal(s.p50, 100)
  assert.equal(s.max, 300)
  assert.equal(s.overCapCount, 1)
  assert.equal(percentile([1, 2, 3, 4], 50), 2)
  assert.equal(percentile([], 50), 0)
  assert.equal(formatBytes(2 * 1024 * 1024), '2.0 MiB')
  assert.deepEqual(groupByDir([
    { path: 'dev/agent-workflow/evidence/a/x', bytes: 10 },
    { path: 'dev/agent-workflow/evidence/a/y', bytes: 20 },
  ]), [{ label: 'a', bytes: 30, files: 2 }])
})

test('coverage-audit: UNKNOWN is named by class; zero-test "determined" is not a fix', () => {
  assert.equal(reasonOf('tests/kits/a1/a1-bash.mjs'), 'kit-runner')
  assert.equal(reasonOf('tests/world-factory/a5sf-bash.test.mjs'), 'world-factory-driver')
  assert.equal(reasonOf('scripts/tool.mjs'), 'uncatalogued-script')
  assert.equal(reasonOf('.merge-loop.sh'), 'root-scratch')
  assert.equal(reasonOf('config/eslint.mjs'), 'other')
  const r = summarizeAudit([
    { sha: 'a', subject: 's', files: ['x'], undetermined: [] },
    { sha: 'b', subject: 's', files: ['a', 'b'], undetermined: ['tests/kits/k.mjs', '.scratch.sh'] },
    { sha: 'c', subject: 's', files: ['c'], undetermined: ['scripts/tool.mjs'] },
  ])
  assert.equal(r.ratePct, 67)
  assert.equal(r.reasonCounts['kit-runner'].hits, 1)
  assert.equal(r.reasonCounts['root-scratch'].hits, 1)
  assert.equal(r.reasonCounts['uncatalogued-script'].hits, 1)
  assert.match(coverageToken(r), /undetermined=2 rate_pct=67/)
})

test('collection-audit: tokens, scope and the three-way split', () => {
  const tokens = collectTokens([
    'run: node --test scripts/a.test.mjs scripts/b.test.mjs',
    'run: node --test --test-reporter=spec tests/c.test.mjs',
    'run: |\n  node --test \\\n    tests/d.test.mjs',
  ], { layers: [{ check: ['tests/e.test.mjs', 'tests/not-a-test.mjs'] }] })
  for (const p of ['scripts/a.test.mjs', 'scripts/b.test.mjs', 'tests/c.test.mjs', 'tests/d.test.mjs', 'tests/e.test.mjs']) assert.ok(tokens.has(p), p)
  assert.ok(![...tokens].some((t) => t.startsWith('-')))
  assert.deepEqual(inScope(['tests/kits/a/a.mjs', 'scripts/x.test.mjs', 'packages/p/x.test.mjs']), ['scripts/x.test.mjs'])

  const r = audit(['scripts/a.test.mjs', 'tests/b.test.mjs'], new Set(['scripts/a.test.mjs']), { 'tests/b.test.mjs': { reason: 'needs host', review: 'M1' } })
  assert.deepEqual([r.collected.length, r.exempt.length, r.uncollected.length], [1, 1, 0])
  const gap = audit(['scripts/a.test.mjs', 'tests/c.test.mjs'], new Set(['scripts/a.test.mjs']))
  assert.deepEqual(gap.uncollected, ['tests/c.test.mjs'])
  assert.match(collectionToken(gap), /uncollected=1 covered_pct=50/)
  const stale = audit(['scripts/a.test.mjs'], new Set(['scripts/a.test.mjs']), { 'scripts/a.test.mjs': { reason: 'x', review: 'y' } })
  assert.deepEqual(stale.staleExemptions, ['scripts/a.test.mjs'])
})

test('census-profile: skips are not zero seconds and shares use the job total', () => {
  const j = (a, b, steps) => ({ started_at: a, completed_at: b, steps })
  const s = (name, a, b, conclusion = 'success') => ({ name, started_at: a, completed_at: b, conclusion })
  const r = profileJobs([
    j('2026-11-13T16:10:28Z', '2026-11-13T16:34:10Z', [
      s('Host build', '2026-11-13T16:10:44Z', '2026-11-13T16:15:16Z'),
      s('Census', '2026-11-13T16:15:40Z', '2026-11-13T16:34:08Z'),
      s('Verdict', '2026-11-13T16:34:09Z', '2026-11-13T16:34:09Z', 'skipped'),
    ]),
    j('2026-11-13T17:00:00Z', '2026-11-13T17:24:00Z', [
      s('Host build', '2026-11-13T17:00:05Z', '2026-11-13T17:04:35Z'),
      s('Census', '2026-11-13T17:04:40Z', '2026-11-13T17:23:50Z'),
    ]),
  ])
  assert.equal(r.runs, 2)
  assert.equal(r.steps.find((x) => x.name === 'Host build').p50, 270)
  assert.equal(r.steps.find((x) => x.name === 'Census').p50, 1108)
  assert.equal(r.steps[0].sharePct, 78)
  assert.equal(r.total.p50, 1422)
  assert.ok(!r.steps.some((x) => x.name === 'Verdict'))
  assert.equal(stepSeconds({ name: 'x', started_at: '2026-11-13T16:00:00Z', completed_at: null }), null)
  assert.equal(stepSeconds(null), null)
  assert.equal(profilePercentile([1, 2, 3, 4], 90), 4)
  assert.equal(profileJobs([]).runs, 0)
  assert.match(profileToken(r), /runs=2 total_p50_s=1422/)
})

test('collection-audit: the live repository is measurable (read-only git)', () => {
  const out = execFileSync(process.execPath, [resolve('scripts/test-collection-audit.mjs'), '--json'], { encoding: 'utf8', cwd: resolve('.') })
  const r = JSON.parse(out)
  assert.ok(r.total >= 50, `expected a tracked node:test population, got ${r.total}`)
  assert.ok(r.uncollected.length + r.collected.length + r.exempt.length === r.total)
  assert.match(collectionToken(r), /^DSH-TEST-COLLECTION total=\d+ collected=\d+ exempt=\d+ uncollected=\d+ covered_pct=\d+$/)
})
