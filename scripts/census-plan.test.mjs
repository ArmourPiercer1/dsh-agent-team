/**
 * Host-free regression suite for the TINF M4 census planner (`scripts/census-plan.mjs`).
 *
 * The planner is SHADOW: nothing in CI consumes its output yet. What it can still get wrong is the
 * thing the milestone exists to make impossible — producing a plan that is not the census population.
 * So the laws pinned here are:
 *   - the root set is DERIVED from the root `vitest.config.ts` through the collection authority
 *     (`test-catalog.mjs`) and named with M3's `rootOf`, and it equals the 11 roots / 705 files the
 *     last real census reported (a PIN on the population: a new census root reds this test on
 *     purpose, the same way `--max-uncollected 91` refuses growth);
 *   - when the root set cannot be derived the planner REFUSES with a named code — there is no
 *     fallback to a recorded count, and no "nine";
 *   - the plan is one task per (root, capture), each carrying the runner's own argv, and the two
 *     captures of a root are one indivisible group because parallelising them is UNPROVEN;
 *   - `est_ms` is a hint: unknown is `null`, and a plan with any unknown estimate cannot be balanced;
 *   - `plan_digest` covers tasks + identity (+ the root list, capture count and clock that produce
 *     them), so an edited task, a reordered task and a changed capture count all move it;
 *   - `--verify-plan` refuses on digest drift AND on identity/task-set drift against a moved tree.
 *
 * Host-free: pure functions, mkdtemp fixtures with a throwaway git repo, three cheap `node` spawns
 * against THIS repository. No port, no DSH_HOME, no pristine host, no build, no network.
 */
import assert from 'node:assert/strict'
import test from 'node:test'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  DEFAULT_CAPTURES,
  ROOT_CONFIG,
  SCHEMA,
  balance,
  buildPlan,
  canonicalJson,
  deriveRoots,
  loadTimings,
  makeIdentity,
  planDigest,
  verifyPlan,
} from './census-plan.mjs'
import { rootOf } from './tinf-timing.mjs'

const SCRIPT = fileURLToPath(new URL('./census-plan.mjs', import.meta.url))
const REPO_ROOT = join(dirname(SCRIPT), '..')

function tmp(prefix = 'census-plan-test-') {
  return mkdtempSync(join(tmpdir(), prefix))
}

function cli(args, { cwd = REPO_ROOT } = {}) {
  const r = spawnSync(process.execPath, [SCRIPT, ...args], { encoding: 'utf8', cwd })
  return { status: r.status, out: `${r.stdout}\n${r.stderr}`, stdout: r.stdout, stderr: r.stderr }
}

/**
 * A throwaway git repository with a root vitest config and a registry. `files` maps repo-relative
 * path -> content; `config` is the text of `vitest.config.ts`. Nothing is committed except what the
 * caller passes, so `git ls-files` is exactly the fixture's file set.
 */
function fixtureRepo({ config, files = {}, registry = true } = {}) {
  const dir = tmp()
  const write = (rel, text) => {
    mkdirSync(dirname(join(dir, rel)), { recursive: true })
    writeFileSync(join(dir, rel), text)
  }
  if (config !== null) write(ROOT_CONFIG, config)
  if (registry) write('dev/ci/test-contracts.json', JSON.stringify({ schema: 'test-contracts/1', contracts: [], excludes: [], instruments: [] }))
  for (const [rel, text] of Object.entries(files)) write(rel, text)
  const git = (args) => {
    const r = spawnSync('git', args, { cwd: dir, encoding: 'utf8' })
    assert.equal(r.status, 0, `git ${args.join(' ')} failed: ${r.stderr}`)
    return r.stdout
  }
  git(['init', '-q', '.'])
  git(['add', '-A'])
  git(['-c', 'user.email=test@example.invalid', '-c', 'user.name=census-plan-test', 'commit', '-q', '-m', 'fixture'])
  return dir
}

const GOOD_CONFIG = "export default { test: { include: ['packages/*/test/**/*.test.ts'] } }\n"

// ────────────────────────────────────────────────────────── the real population ──

test('deriveRoots: the root set is the 11 roots the last real census reported, from the config', () => {
  const derived = deriveRoots({ cwd: REPO_ROOT })
  assert.equal(derived.ok, true, JSON.stringify(derived))
  // PIN, not a constant the tool carries: the planner must derive this, and when the census
  // population changes this list is the review checkpoint (same role as `--max-uncollected 91`).
  assert.deepEqual(derived.roots.map((r) => r.root), [
    'packages/client',
    'packages/contracts',
    'packages/domain',
    'packages/legacy',
    'packages/remote',
    'packages/runtime',
    'packages/runtime/controlled-fs',
    'packages/storage',
    'packages/testkit',
    'packages/tools',
    'packages/tools/a5p5-tools',
  ])
  // 705 files is what the L2 census printed (`captured 705f/9213l`); the derivation is the same
  // authority the run used, so the two numbers must agree.
  assert.equal(derived.file_count, 705)
  assert.match(derived.catalog_digest, /^sha256:[0-9a-f]{64}$/)
})

test('deriveRoots: every root is a real directory with a test/ subtree, and rootOf agrees with it', () => {
  const derived = deriveRoots({ cwd: REPO_ROOT })
  for (const { root, files } of derived.roots) {
    assert.ok(files > 0, `${root} has no files`)
    // The root name is only meaningful if M3 would name the same directory from a report path.
    assert.equal(rootOf(`/home/runner/work/repo/${root}/test/x.test.ts`), root)
  }
})

test('deriveRoots: no root config is a refusal, never a recorded count', () => {
  const dir = fixtureRepo({ config: null, files: { 'packages/a/test/x.test.ts': '' } })
  const derived = deriveRoots({ cwd: dir })
  assert.equal(derived.ok, false)
  assert.equal(derived.code, 'ROOT_CONFIG_MISSING')
})

test('deriveRoots: an unparsable include[] is ROOT_CONFIG_UNREADABLE', () => {
  const dir = fixtureRepo({ config: 'export default { test: { exclude: [] } }\n', files: { 'packages/a/test/x.test.ts': '' } })
  const derived = deriveRoots({ cwd: dir })
  assert.equal(derived.ok, false)
  assert.equal(derived.code, 'ROOT_CONFIG_UNREADABLE')
})

test('deriveRoots: a matched file outside every census root is ROOT_UNRESOLVED', () => {
  const dir = fixtureRepo({
    config: "export default { test: { include: ['docs/**/*.test.ts'] } }\n",
    files: { 'docs/x.test.ts': '' },
  })
  const derived = deriveRoots({ cwd: dir })
  assert.equal(derived.ok, false)
  assert.equal(derived.code, 'ROOT_UNRESOLVED')
})

test('deriveRoots: an include[] that matches nothing is ROOTS_NOT_DERIVED', () => {
  const dir = fixtureRepo({
    config: "export default { test: { include: ['nowhere/**/*.test.ts'] } }\n",
    files: { 'packages/a/test/x.test.ts': '' },
  })
  const derived = deriveRoots({ cwd: dir })
  assert.equal(derived.ok, false)
  assert.equal(derived.code, 'ROOTS_NOT_DERIVED')
})

test('deriveRoots: a missing catalog registry is CATALOG_UNREADABLE (not "no roots")', () => {
  const dir = fixtureRepo({ config: GOOD_CONFIG, registry: false, files: { 'packages/a/test/x.test.ts': '' } })
  const derived = deriveRoots({ cwd: dir })
  assert.equal(derived.ok, false)
  assert.equal(derived.code, 'CATALOG_UNREADABLE')
})

test('deriveRoots: the package configs are not the census population (root config only)', () => {
  const dir = fixtureRepo({
    config: GOOD_CONFIG,
    files: {
      'packages/a/test/x.test.ts': '',
      'packages/b/test/y.client.spec.tsx': '',
      'packages/b/vitest.config.ts': "export default { test: { include: ['test/**/*.client.spec.tsx'] } }\n",
    },
  })
  const derived = deriveRoots({ cwd: dir })
  assert.equal(derived.ok, true, JSON.stringify(derived))
  // packages/b's jsdom suite is collected by ITS config, not by the root run — planning a task for
  // it would be a task the census never executes.
  assert.deepEqual(derived.roots.map((r) => r.root), ['packages/a'])
})

// ─────────────────────────────────────────────────────────────────────── plan ──

const IDENTITY = () => makeIdentity({ merge_tree_sha: 'tree-sha', host_sha: 'host-sha', catalog_digest: 'sha256:cat', build_digest: 'build-sha' })

test('buildPlan: one task per (root, capture), stable ids, runner argv from the census invocation', () => {
  const plan = buildPlan({ roots: [{ root: 'packages/a', files: 2 }, { root: 'packages/b', files: 1 }], captures: 2, identity: IDENTITY() })
  assert.equal(plan.schema, SCHEMA)
  assert.equal(plan.captures, DEFAULT_CAPTURES)
  assert.deepEqual(plan.tasks.map((t) => t.task_id), [
    'census:packages/a#1', 'census:packages/a#2', 'census:packages/b#1', 'census:packages/b#2',
  ])
  for (const task of plan.tasks) {
    assert.equal(task.runner.cmd, 'pnpm')
    assert.deepEqual(task.runner.argv.slice(0, 4), ['exec', 'vitest', 'run', '--reporter=default'])
    assert.ok(task.runner.argv.includes('--reporter=json'))
    assert.ok(task.runner.argv.some((a) => a.startsWith('--outputFile.json=.artifacts/census/')))
  }
  // The clock appears only when it was set: a plan for a run under the suite default must not carry
  // a --testTimeout it never used.
  assert.ok(!plan.tasks[0].runner.argv.some((a) => a.startsWith('--testTimeout')))
  const clocked = buildPlan({ roots: [{ root: 'packages/a' }], captures: 2, identity: IDENTITY(), testTimeout: 90000 })
  assert.ok(clocked.tasks[0].runner.argv.includes('--testTimeout=90000'))
})

test('buildPlan: both captures of a root are one indivisible group, with the reason stated', () => {
  const plan = buildPlan({ roots: [{ root: 'packages/a' }, { root: 'packages/b' }], captures: 2, identity: IDENTITY() })
  assert.equal(plan.groups.length, 2)
  assert.deepEqual(plan.groups[0].task_ids, ['census:packages/a#1', 'census:packages/a#2'])
  assert.equal(plan.groups[0].kind, 'ordering-unproven')
  assert.match(plan.groups[0].reason, /SEQUENTIALLY/i)
  assert.match(plan.groups[0].reason, /No World is claimed/i)
  // A group is a constraint added, not a task dropped.
  assert.equal(plan.tasks.length, 4)
})

test('buildPlan: an estimate is a hint — unknown is null, and it never changes the task set', () => {
  const without = buildPlan({ roots: [{ root: 'packages/a' }, { root: 'packages/b' }], captures: 2, identity: IDENTITY() })
  assert.ok(without.tasks.every((t) => t.est_ms === null))
  assert.deepEqual(without.timings.unknown_roots, ['packages/a', 'packages/b'])
  const withTiming = buildPlan({
    roots: [{ root: 'packages/a' }, { root: 'packages/b' }],
    captures: 2,
    identity: IDENTITY(),
    timings: { byRoot: new Map([['packages/a', 1234.6]]), source_files: ['x.tsv'] },
  })
  assert.deepEqual(withTiming.tasks.map((t) => t.task_id), without.tasks.map((t) => t.task_id))
  assert.ok(withTiming.tasks.filter((t) => t.root === 'packages/a').every((t) => t.est_ms === 1235))
  assert.ok(withTiming.tasks.filter((t) => t.root === 'packages/b').every((t) => t.est_ms === null))
  assert.deepEqual(withTiming.timings.unknown_roots, ['packages/b'])
  assert.match(withTiming.timings.used_for, /no task is added, removed or reordered/)
})

test('buildPlan: captures must be a positive integer', () => {
  assert.throws(() => buildPlan({ roots: [{ root: 'packages/a' }], captures: 0, identity: IDENTITY() }))
  assert.throws(() => buildPlan({ roots: [{ root: 'packages/a' }], captures: 1.5, identity: IDENTITY() }))
})

test('planDigest: canonical, order-insensitive for keys, but sensitive to every task field', () => {
  const plan = buildPlan({ roots: [{ root: 'packages/a' }], captures: 2, identity: IDENTITY() })
  assert.equal(canonicalJson({ b: 1, a: 2 }), '{"a":2,"b":1}')
  assert.equal(planDigest(plan), planDigest(JSON.parse(JSON.stringify(plan))))
  const edits = [
    (p) => { p.tasks[0].est_ms = 1 },
    (p) => { p.tasks[0].capture = 7 },
    (p) => { p.tasks[0].runner.argv.push('--x') },
    (p) => { p.tasks.reverse() },
    (p) => { p.identity.host_sha = 'other' },
    (p) => { p.test_timeout_ms = 5000 },
    (p) => { p.roots[0].root = 'packages/zz' },
  ]
  for (const edit of edits) {
    const copy = JSON.parse(JSON.stringify(plan))
    edit(copy)
    assert.notEqual(planDigest(copy), plan.identity.plan_digest)
  }
})

// ───────────────────────────────────────────────────────────────────── verify ──

test('verifyPlan: an unchanged plan verifies', () => {
  const plan = buildPlan({ roots: [{ root: 'packages/a' }], captures: 2, identity: IDENTITY() })
  assert.equal(verifyPlan(plan, { currentPlan: { plan } }).ok, true)
})

test('verifyPlan: an edited task without a new digest is PLAN_DIGEST_MISMATCH', () => {
  const plan = buildPlan({ roots: [{ root: 'packages/a' }], captures: 2, identity: IDENTITY() })
  const stale = JSON.parse(JSON.stringify(plan))
  stale.tasks[0].est_ms = 1
  const v = verifyPlan(stale, { currentPlan: { plan: stale } })
  assert.equal(v.ok, false)
  assert.ok(v.codes.includes('PLAN_DIGEST_MISMATCH'), JSON.stringify(v.codes))
})

test('verifyPlan: a moved tree is PLAN_IDENTITY_DRIFT', () => {
  const plan = buildPlan({ roots: [{ root: 'packages/a' }], captures: 2, identity: IDENTITY() })
  const other = buildPlan({
    roots: [{ root: 'packages/a' }],
    captures: 2,
    identity: makeIdentity({ merge_tree_sha: 'other-tree', host_sha: 'host-sha', catalog_digest: 'sha256:cat', build_digest: 'build-sha' }),
  })
  const v = verifyPlan(plan, { currentPlan: { plan: other } })
  assert.ok(v.codes.includes('PLAN_IDENTITY_DRIFT'), JSON.stringify(v.codes))
})

test('verifyPlan: a changed root set is PLAN_TASK_SET_CHANGED, in both directions', () => {
  const plan = buildPlan({ roots: [{ root: 'packages/a' }, { root: 'packages/b' }], captures: 2, identity: IDENTITY() })
  const fewer = buildPlan({ roots: [{ root: 'packages/a' }], captures: 2, identity: IDENTITY() })
  assert.ok(verifyPlan(plan, { currentPlan: { plan: fewer } }).codes.includes('PLAN_TASK_SET_CHANGED'))
  assert.ok(verifyPlan(fewer, { currentPlan: { plan } }).codes.includes('PLAN_TASK_SET_CHANGED'))
})

test('verifyPlan: a duplicate task id is refused even when the digest was recomputed', () => {
  const plan = buildPlan({ roots: [{ root: 'packages/a' }], captures: 2, identity: IDENTITY() })
  const dup = JSON.parse(JSON.stringify(plan))
  dup.tasks[1].task_id = dup.tasks[0].task_id
  dup.identity.plan_digest = planDigest(dup)
  assert.ok(verifyPlan(dup, { currentPlan: { plan: dup } }).codes.includes('PLAN_TASK_DUPLICATE'))
})

test('verifyPlan: a foreign schema and a non-object are refusals, not crashes', () => {
  const plan = buildPlan({ roots: [{ root: 'packages/a' }], captures: 2, identity: IDENTITY() })
  assert.ok(verifyPlan({ schema: 'census-plan/2' }, { currentPlan: { plan } }).codes.includes('PLAN_SCHEMA_UNKNOWN'))
  assert.ok(verifyPlan(null, { currentPlan: { plan } }).codes.includes('PLAN_UNREADABLE'))
})

// ──────────────────────────────────────────────────────────────────── balance ──

function weightedPlan(weights) {
  const roots = Object.keys(weights).map((root) => ({ root }))
  return buildPlan({
    roots,
    captures: 2,
    identity: IDENTITY(),
    timings: { byRoot: new Map(Object.entries(weights)) },
  })
}

test('balance: exact minimum makespan on a partition with a known answer', () => {
  const plan = weightedPlan({ 'packages/a': 500, 'packages/b': 500, 'packages/c': 100, 'packages/d': 100 })
  const two = balance(plan, 2)
  assert.equal(two.ok, true, JSON.stringify(two))
  assert.equal(two.method, 'exhaustive-min-makespan')
  assert.equal(two.makespan_ms, 1200)
  assert.equal(two.matches_lower_bound, true)
  assert.match(two.optimal_guarantee, /exhaustive/)
})

test('balance: every task appears exactly once, and a group is never split', () => {
  const plan = weightedPlan({ 'packages/a': 400, 'packages/b': 300, 'packages/c': 200, 'packages/d': 100 })
  for (const k of [1, 2, 3, 4]) {
    const b = balance(plan, k)
    assert.equal(b.ok, true)
    const shardTasks = b.shards.flatMap((s) => s.task_ids).sort()
    assert.deepEqual(shardTasks, plan.tasks.map((t) => t.task_id).sort(), `k=${k}`)
    for (const shard of b.shards) {
      // A group's two captures are either both in the shard or both out.
      for (const group of plan.groups) {
        const inShard = group.task_ids.filter((id) => shard.task_ids.includes(id))
        assert.ok(inShard.length === 0 || inShard.length === group.task_ids.length, `k=${k}: ${group.id} split`)
      }
    }
  }
})

test('balance: unknown estimates refuse instead of guessing', () => {
  const plan = buildPlan({
    roots: [{ root: 'packages/a' }, { root: 'packages/b' }],
    captures: 2,
    identity: IDENTITY(),
    timings: { byRoot: new Map([['packages/a', 500]]) },
  })
  assert.equal(balance(plan, 2).code, 'ESTIMATES_UNKNOWN')
})

test('balance: more shards than indivisible units refuses', () => {
  const plan = weightedPlan({ 'packages/a': 500, 'packages/b': 500 })
  assert.equal(balance(plan, 3).code, 'BALANCE_K_INVALID')
})

// ──────────────────────────────────────────────────────────────────── timings ──

const TIMING_HEADER = 'schema\trun_id\tphase\troot\tattempt\tstarted_at\tduration_ms\tstatus\tidentity\n'
const timingRow = (phase, root, attempt, ms, status = 'ok') =>
  `${['tinf-timing/1', 'r1', phase, root, String(attempt), '2026-11-14T20:48:35.843Z', String(ms), status, 'head=abc'].join('\t')}\n`

test('loadTimings: per-root medians come from M3 rows, and a failed span is not a duration', () => {
  const dir = tmp()
  const file = join(dir, 'tinf-timing.tsv')
  writeFileSync(file, TIMING_HEADER +
    timingRow('census-capture', 'nine-roots', 1, 500000) +
    timingRow('census-root', 'packages/a', 1, 100) +
    timingRow('census-root', 'packages/a', 2, 900) +
    // The failed row must not become 0 ms and must not be averaged in.
    timingRow('census-root', 'packages/b', 1, 700, 'failed'))
  const loaded = loadTimings([file])
  assert.equal(loaded.ok, true, JSON.stringify(loaded))
  // nearest-rank median of [100, 900] is the LOWER value, the same rule tinf-timing publishes.
  assert.equal(loaded.byRoot.get('packages/a'), 100)
  assert.equal(loaded.byRoot.has('packages/b'), false)
})

test('loadTimings: missing, garbage and census-less inputs are refused by name', () => {
  assert.equal(loadTimings(['/definitely/not/here.tsv']).code, 'TIMINGS_INPUT_UNREADABLE')
  const dir = tmp()
  const bad = join(dir, 'bad.tsv')
  writeFileSync(bad, `${TIMING_HEADER}only\tthree\tcells\n`)
  assert.equal(loadTimings([bad]).code, 'TIMINGS_BAD_ROW')
  const noCensus = join(dir, 'noleg.tsv')
  writeFileSync(noCensus, TIMING_HEADER + timingRow('leg', 'census', 1, 10))
  assert.equal(loadTimings([noCensus]).code, 'TIMINGS_NO_CENSUS_ROWS')
})

// ──────────────────────────────────────────────────────────────────────── cli ──

test('cli: --plan on a fixture derives the plan and exits 0', () => {
  const dir = fixtureRepo({
    config: GOOD_CONFIG,
    files: { 'packages/a/test/x.test.ts': '', 'packages/b/test/y.test.ts': '' },
  })
  const r = cli(['--plan'], { cwd: dir })
  assert.equal(r.status, 0, r.out)
  const plan = JSON.parse(r.stdout)
  assert.equal(plan.schema, SCHEMA)
  assert.equal(plan.tasks.length, 4)
  assert.equal(plan.identity.merge_tree_sha.length, 40)
  assert.equal(plan.identity.build_digest, null)
})

test('cli: --plan --out writes the artifact and prints a token, never the JSON', () => {
  const dir = fixtureRepo({ config: GOOD_CONFIG, files: { 'packages/a/test/x.test.ts': '' } })
  const out = join(tmp(), 'plan.json')
  const r = cli(['--plan', '--out', out, '--build-digest', 'build-x'], { cwd: dir })
  assert.equal(r.status, 0, r.out)
  assert.match(r.stdout, /DSH-CENSUS-PLAN plan=ok roots=1 tasks=2 captures=2/)
  const plan = JSON.parse(readFileSync(out, 'utf8'))
  assert.equal(plan.identity.build_digest, 'build-x')
  assert.equal(plan.tasks.length, 2)
})

test('cli: an underivable root set is exit 2 with a named code and NO plan on stdout', () => {
  const dir = fixtureRepo({ config: 'export default { test: { exclude: [] } }\n', files: { 'packages/a/test/x.test.ts': '' } })
  const r = cli(['--plan'], { cwd: dir })
  assert.equal(r.status, 2, r.out)
  assert.match(r.stderr, /REFUSED ROOT_CONFIG_UNREADABLE/)
  assert.equal(r.stdout.trim(), '')
})

test('cli: --captures 1 plans one capture per root (and the aggregator refuses to PASS it)', () => {
  const dir = fixtureRepo({ config: GOOD_CONFIG, files: { 'packages/a/test/x.test.ts': '' } })
  const r = cli(['--plan', '--captures', '1'], { cwd: dir })
  assert.equal(r.status, 0, r.out)
  const plan = JSON.parse(r.stdout)
  assert.equal(plan.captures, 1)
  assert.deepEqual(plan.tasks.map((t) => t.task_id), ['census:packages/a#1'])
})

test('cli: --captures 0 is a refusal', () => {
  const dir = fixtureRepo({ config: GOOD_CONFIG, files: { 'packages/a/test/x.test.ts': '' } })
  const r = cli(['--plan', '--captures', '0'], { cwd: dir })
  assert.equal(r.status, 2, r.out)
  assert.match(r.stderr, /REFUSED CAPTURES_INVALID/)
})

test('cli: --verify-plan passes on an unchanged tree and refuses after the tree moves', () => {
  const dir = fixtureRepo({ config: GOOD_CONFIG, files: { 'packages/a/test/x.test.ts': '' } })
  const out = join(tmp(), 'plan.json')
  assert.equal(cli(['--plan', '--out', out], { cwd: dir }).status, 0)
  const first = cli(['--verify-plan', out], { cwd: dir })
  assert.equal(first.status, 0, first.out)
  assert.match(first.stdout, /DSH-CENSUS-PLAN verify=ok tasks=2/)
  // A new census root appears: the plan no longer covers the population.
  mkdirSync(join(dir, 'packages/b/test'), { recursive: true })
  writeFileSync(join(dir, 'packages/b/test/y.test.ts'), '')
  const git = (args) => spawnSync('git', args, { cwd: dir, encoding: 'utf8' })
  git(['add', '-A'])
  git(['-c', 'user.email=t@e.invalid', '-c', 'user.name=t', 'commit', '-q', '-m', 'add root'])
  const second = cli(['--verify-plan', out], { cwd: dir })
  assert.equal(second.status, 2, second.out)
  assert.match(second.stderr, /REFUSED PLAN_TASK_SET_CHANGED/)
})

test('cli: --verify-plan refuses a plan whose digest no longer matches its tasks', () => {
  const dir = fixtureRepo({ config: GOOD_CONFIG, files: { 'packages/a/test/x.test.ts': '' } })
  const out = join(tmp(), 'plan.json')
  assert.equal(cli(['--plan', '--out', out], { cwd: dir }).status, 0)
  const plan = JSON.parse(readFileSync(out, 'utf8'))
  plan.tasks[0].est_ms = 1
  writeFileSync(out, JSON.stringify(plan, null, 2))
  const r = cli(['--verify-plan', out], { cwd: dir })
  assert.equal(r.status, 2, r.out)
  assert.match(r.stderr, /REFUSED PLAN_DIGEST_MISMATCH/)
})

test('cli: --verify-plan on a missing file is PLAN_UNREADABLE, and no mode is a refusal', () => {
  const r = cli(['--verify-plan', '/definitely/not/here.json'])
  assert.equal(r.status, 2)
  assert.match(r.stderr, /REFUSED PLAN_UNREADABLE/)
  const none = cli([])
  assert.equal(none.status, 2)
  assert.match(none.stderr, /REFUSED NO_MODE/)
})

test('cli: --balance prints the shard assignment; unknown estimates refuse', () => {
  const dir = fixtureRepo({ config: GOOD_CONFIG, files: { 'packages/a/test/x.test.ts': '', 'packages/b/test/y.test.ts': '' } })
  const timings = join(tmp(), 't.tsv')
  writeFileSync(timings, TIMING_HEADER +
    timingRow('census-capture', 'nine-roots', 1, 1000) +
    timingRow('census-root', 'packages/a', 1, 600) +
    timingRow('census-root', 'packages/b', 1, 400))
  const r = cli(['--balance', '2', '--timings', timings], { cwd: dir })
  assert.equal(r.status, 0, r.out)
  const b = JSON.parse(r.stdout)
  assert.equal(b.shard_count, 2)
  assert.equal(b.shards.length, 2)
  // 600 ms is the per-capture median; a group holds BOTH captures, so its weight is 1200.
  assert.equal(b.makespan_ms, 1200)
  const unknown = cli(['--balance', '2'], { cwd: dir })
  assert.equal(unknown.status, 2)
  assert.match(unknown.stderr, /REFUSED ESTIMATES_UNKNOWN/)
})

test('cli: the real repository plans 22 tasks for 11 roots and two captures', () => {
  const r = cli(['--plan', '--test-timeout', '90000'])
  assert.equal(r.status, 0, r.out)
  const plan = JSON.parse(r.stdout)
  assert.equal(plan.roots.length, 11)
  assert.equal(plan.tasks.length, 22)
  assert.equal(plan.captures, 2)
  assert.equal(plan.test_timeout_ms, 90000)
  assert.equal(plan.tasks.filter((t) => t.capture === 2).length, 11)
  // The plan's tree is the tree of the commit it was planned on — recorded, not recomputed.
  assert.equal(plan.identity.merge_tree_sha.length, 40)
})

test('cli: --self-test stays green', () => {
  const r = cli(['--self-test'])
  assert.equal(r.status, 0, r.out)
  assert.match(r.stdout, /DSH-CENSUS-PLAN-SELFTEST PASS/)
})
