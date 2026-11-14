#!/usr/bin/env node
/**
 * census-cutover.test.mjs — TINF M5: the plan-driven census and the build stamp, host-free.
 *
 * WHAT THIS SUITE IS FOR. M5 replaces the census leg's INTERNAL execution (plan → execute tasks →
 * aggregate, same verdict token) and adds the one producer M4 disclosed as missing (`build_digest`).
 * Both are exactly the kind of change that can go green while proving less than it claims, so every
 * refusal path the milestone names has a negative control here, and every control drives the REAL
 * code: `LEGS.census` from `scripts/ci-pr-gate.mjs` (with a recorded capture directory, the same
 * `--census-dry-run` CLI path CI's cheap legs can run), `resultsFromReport`/`resultsFromReplay`
 * from `scripts/census-execution.mjs`, and `computeBuildStamp`/`verifyBuildStamp` from
 * `scripts/census-build-stamp.mjs`. The two CLI cases spawn the real command and assert the real
 * `DSH-CI-VERDICT` token and exit code, because the token is the acceptance surface.
 *
 * NEGATIVE CONTROLS (each must be RED, each named):
 *   - a plan refusal                   (a tree whose root config cannot be derived)
 *   - an aggregation refusal           (a one-capture plan → CAPTURES_INSUFFICIENT)
 *   - a missing second capture         (only capture 1 recorded → DRYRUN_CAPTURE_MISSING)
 *   - an exit-0-with-FAIL result       (shard COMPLETED/exit 0 carrying FAIL → TASK_STATE_FAIL)
 *   - a dropped root                   (one planned task has no result → TASK_MISSING/INCOMPLETE)
 *   - a missing build stamp            (→ BUILD_STAMP_MISSING; and nothing is written in its place)
 * plus the POSITIVE control (22 planned tasks, 22 observed, PASS) and a two-shard layout control.
 *
 * NO HOST, NO SUITE RUN. Nothing here spawns vitest; the recording is produced by the real
 * derivation path (`resultsFromReport`) or by the leg itself, and replayed. That is the same
 * mechanism a cheap CI leg uses.
 */
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import test from 'node:test'

import {
  SCHEMA as STAMP_SCHEMA,
  computeBuildStamp,
  readBuildStamp,
  resolveBuildStamp,
  verifyBuildStamp,
} from './census-build-stamp.mjs'
import { SCHEMA as PLAN_SCHEMA, buildPlan, deriveRoots, gitTreeSha, hostSha } from './census-plan.mjs'
import { isValidDigest } from './census-digest.mjs'
import {
  REPLAY_SCHEMA,
  buildShardArtifacts,
  resultsFromReplay,
  resultsFromReport,
} from './census-execution.mjs'
import { CENSUS_CAPTURE_REL, LEGS, censusPlanLeg } from './ci-pr-gate.mjs'
import { createTimer } from './tinf-timing.mjs'

const REPO_ROOT = resolve(import.meta.dirname, '..')
const CAPTURES = 2
const CLOCK = 90000

// ── shared fixtures (one derivation, so every control is about ONE population) ──────────────────

let base = null
function fixture() {
  if (base !== null) return base
  const roots = deriveRoots({ cwd: REPO_ROOT })
  assert.equal(roots.ok, true, `the root set must derive (${roots.code ?? ''})`)
  const stamp = computeBuildStamp({
    cwd: REPO_ROOT,
    merge_tree: gitTreeSha(REPO_ROOT),
    catalog_digest: roots.catalog_digest,
  })
  assert.equal(stamp.ok, true, stamp.detail)
  const plan = buildPlan({
    roots: roots.roots,
    captures: CAPTURES,
    identity: {
      merge_tree_sha: gitTreeSha(REPO_ROOT),
      host_sha: hostSha(),
      catalog_digest: roots.catalog_digest,
      build_digest: stamp.stamp.digest,
    },
    testTimeout: CLOCK,
    timings: null,
    rootsDropped: roots.roots_dropped ?? [],
  })
  base = { roots, stamp: stamp.stamp, plan }
  return base
}

function tmpDir(label) {
  const dir = mkdtempSync(join(REPO_ROOT, '.artifacts', `m5-${label}-`))
  return dir
}

/** A recording of the shared plan: every task PASS unless `mutate` says otherwise. */
function replayOf(plan, capture, mutate = (results) => results) {
  return {
    schema: REPLAY_SCHEMA,
    plan_digest: plan.identity.plan_digest,
    capture,
    identity: { ...plan.identity },
    results: mutate(
      plan.tasks
        .filter((t) => t.capture === capture)
        .map((t) => ({
          task_id: t.task_id,
          root: t.root,
          capture: t.capture,
          state: 'PASS',
          evidence: `recorded:tinf-timing.tsv#${t.task_id}`,
        })),
    ),
  }
}

/** Write a dry-run directory holding the given captures (each recording or raw object). */
function writeDryRun(label, plan, { captures = [1, 2], mutate = {}, files = {} } = {}) {
  const dir = tmpDir(label)
  for (const capture of captures) {
    const name = files[capture] ?? `census-replay-${capture}.json`
    const body = mutate[capture] === undefined
      ? replayOf(plan, capture)
      : replayOf(plan, capture, mutate[capture])
    writeFileSync(join(dir, name), `${JSON.stringify(body, null, 2)}\n`)
  }
  return dir
}

/** The real gate context, as main() builds it, minus everything the plan path does not use. */
function gateContext({ dryRun = null, captures = CAPTURES, shards = 1, stampPath = null, root = undefined } = {}) {
  const dir = dryRun ?? tmpDir('ctx-transcripts')
  return {
    repoRoot: root,
    censusExecution: 'plan',
    censusCaptures: captures,
    censusShards: shards,
    censusDryRun: dryRun,
    censusBuildStamp: stampPath,
    censusTestTimeout: CLOCK,
    censusJson: null,
    resample: 3,
    transcriptDir: dryRun === null ? dir : null,
    stamp: 'm5-test',
    timing: createTimer({ dir: null, runId: 'm5-test', identity: 'phase=m5' }),
    capture() {},
    writeJson() {},
  }
}

// ── the build stamp: a REAL digest of REAL bytes ────────────────────────────────────────────────

test('the build stamp digests the real install surfaces, and the same bytes give the same digest', () => {
  const { stamp, roots } = fixture()
  assert.equal(stamp.schema, STAMP_SCHEMA)
  assert.equal(isValidDigest(stamp.digest), true, stamp.digest)
  assert.equal(stamp.merge_tree, gitTreeSha(REPO_ROOT))
  assert.equal(stamp.catalog_digest, roots.catalog_digest)
  assert.ok(stamp.artifact_count > 100, `the install surfaces hold real artifacts (got ${String(stamp.artifact_count)})`)
  assert.equal(stamp.artifact_count, stamp.artifacts.length)
  assert.equal(stamp.artifact_bytes, stamp.artifacts.reduce((a, x) => a + x.bytes, 0))
  // Sorted, so the digest is a function of the FILE SET and not of readdir order.
  const paths = stamp.artifacts.map((a) => a.path)
  assert.deepEqual(paths, [...paths].sort())
  // A timestamp is recorded but not digested: an identity cannot move because a clock moved.
  const again = computeBuildStamp({
    cwd: REPO_ROOT,
    merge_tree: stamp.merge_tree,
    catalog_digest: stamp.catalog_digest,
    built_at: '2000-01-01T00:00:00.000Z',
  })
  assert.equal(again.ok, true)
  assert.equal(again.stamp.digest, stamp.digest, 'built_at must not enter the digest')
  assert.notEqual(again.stamp.built_at, stamp.built_at)
})

test('one changed byte changes the build digest (it is not a constant or a name)', () => {
  const dir = tmpDir('stamp-bytes')
  try {
    spawnSync('git', ['init', '-q'], { cwd: dir })
    mkdirSync(join(dir, 'packages/runtime/dist'), { recursive: true })
    mkdirSync(join(dir, 'packages/client/composition-shim'), { recursive: true })
    writeFileSync(join(dir, 'packages/runtime/dist/a.js'), 'export const a = 1\n')
    writeFileSync(join(dir, 'packages/client/composition-shim/client-bundle.js'), 'bundle\n')
    const args = { cwd: dir, merge_tree: 'a'.repeat(40), catalog_digest: `sha256:${'b'.repeat(64)}`, ignoredFiles: [] }
    const one = computeBuildStamp(args)
    assert.equal(one.ok, true, one.detail)
    writeFileSync(join(dir, 'packages/runtime/dist/a.js'), 'export const a = 2\n')
    const two = computeBuildStamp(args)
    assert.equal(two.ok, true, two.detail)
    assert.notEqual(two.stamp.digest, one.stamp.digest)
    assert.equal(two.stamp.artifact_count, one.stamp.artifact_count)
    // ...and the second stamp verifies against its own bytes.
    assert.equal(verifyBuildStamp(two.stamp).ok, true)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('a build that did not happen cannot be stamped: absent / empty surfaces refuse by name', () => {
  const dir = tmpDir('stamp-absent')
  try {
    const missing = computeBuildStamp({
      cwd: dir,
      merge_tree: 'a'.repeat(40),
      catalog_digest: `sha256:${'b'.repeat(64)}`,
      ignoredFiles: [],
    })
    assert.equal(missing.ok, false)
    assert.equal(missing.code, 'BUILD_ARTIFACTS_MISSING')

    mkdirSync(join(dir, 'packages/runtime/dist'), { recursive: true })
    mkdirSync(join(dir, 'packages/client/composition-shim'), { recursive: true })
    const empty = computeBuildStamp({
      cwd: dir,
      merge_tree: 'a'.repeat(40),
      catalog_digest: `sha256:${'b'.repeat(64)}`,
      ignoredFiles: [],
    })
    assert.equal(empty.ok, false)
    assert.equal(empty.code, 'BUILD_ARTIFACTS_EMPTY')
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('a tampered stamp is caught: its own digest covers its own artifact list', () => {
  const { stamp } = fixture()
  const forged = JSON.parse(JSON.stringify(stamp))
  forged.artifacts[0].sha256 = `sha256:${'0'.repeat(64)}`
  const bad = verifyBuildStamp(forged)
  assert.equal(bad.ok, false)
  assert.equal(bad.code, 'BUILD_STAMP_DIGEST_MISMATCH')

  // A sentinel / malformed digest is refused by shape before any equality can "agree".
  const sentinel = JSON.parse(JSON.stringify(stamp))
  sentinel.digest = 'null'
  assert.equal(verifyBuildStamp(sentinel).code, 'DIGEST_INVALID')
})

test('a stamp from another tree is not this census build', () => {
  const { stamp } = fixture()
  const other = verifyBuildStamp(stamp, { merge_tree: 'c'.repeat(40) })
  assert.equal(other.ok, false)
  assert.equal(other.code, 'BUILD_STAMP_IDENTITY_MISMATCH')
  const otherCatalog = verifyBuildStamp(stamp, { catalog_digest: `sha256:${'d'.repeat(64)}` })
  assert.equal(otherCatalog.code, 'BUILD_STAMP_IDENTITY_MISMATCH')
})

test('an explicitly named stamp must EXIST — no substitute is computed in its place', () => {
  const dir = tmpDir('stamp-missing')
  try {
    const out = join(dir, 'product-build.json')
    const resolved = resolveBuildStamp({
      cwd: REPO_ROOT,
      merge_tree: gitTreeSha(REPO_ROOT),
      catalog_digest: fixture().roots.catalog_digest,
      stampPath: join(dir, 'does-not-exist.json'),
      outPath: out,
    })
    assert.equal(resolved.ok, false)
    assert.equal(resolved.code, 'BUILD_STAMP_MISSING')
    assert.equal(readdirSync(dir).includes('product-build.json'), false, 'a refusal must not write a placeholder')
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('a recorded stamp round-trips through a file and verifies', () => {
  const dir = tmpDir('stamp-roundtrip')
  try {
    const { stamp } = fixture()
    const file = join(dir, 'product-build.json')
    writeFileSync(file, `${JSON.stringify(stamp, null, 2)}\n`)
    const read = readBuildStamp(file, { merge_tree: stamp.merge_tree, catalog_digest: stamp.catalog_digest })
    assert.equal(read.ok, true, read.detail)
    assert.equal(read.stamp.digest, stamp.digest)
    // A stamp file that is not JSON is a named refusal, not a crash.
    writeFileSync(file, 'not json\n')
    assert.equal(readBuildStamp(file).code, 'BUILD_STAMP_UNREADABLE')
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

// ── per-task derivation: the runner's identity + evidence, never the report's after the fact ────

test('resultsFromReport derives root identity, a terminal state and evidence from the report', () => {
  const { plan } = fixture()
  const root = plan.tasks.find((t) => t.capture === 1).root
  const ok = resultsFromReport({
    plan,
    capture: 1,
    reportRef: '.artifacts/census/report-1.json',
    report: {
      success: true,
      testResults: [
        { name: `/runner/work/repo/${root}/test/a.test.ts`, status: 'passed', assertionResults: [{ status: 'passed' }, { status: 'passed' }] },
      ],
    },
  })
  assert.equal(ok.ok, true, ok.detail)
  assert.equal(ok.results.length, plan.tasks.filter((t) => t.capture === 1).length)
  const mine = ok.results.find((r) => r.root === root)
  assert.equal(mine.state, 'PASS')
  assert.equal(mine.capture, 1)
  assert.equal(mine.task_id, plan.tasks.find((t) => t.root === root && t.capture === 1).task_id)
  assert.match(mine.evidence, /^\.artifacts\/census\/report-1\.json#/)
  assert.match(mine.evidence, /sha256:[0-9a-f]{64}$/)

  // A root ABSENT from the report is INCOMPLETE, never PASS: silence is not evidence of running.
  const partial = resultsFromReport({
    plan,
    capture: 1,
    reportRef: '.artifacts/census/report-1.json',
    report: { success: true, testResults: [] },
  })
  assert.equal(partial.ok, true)
  assert.equal(partial.results.every((r) => r.state === 'INCOMPLETE'), true)
})

test('NEGATIVE: a root that RAN without being planned is refused (the invariant runs both ways)', () => {
  const { plan } = fixture()
  const root = plan.tasks.find((t) => t.capture === 1).root
  const got = resultsFromReport({
    plan,
    capture: 1,
    reportRef: 'r.json',
    report: {
      success: true,
      testResults: [
        { name: `/repo/${root}/test/a.test.ts`, assertionResults: [{ status: 'passed' }] },
        { name: '/repo/packages/not-planned/test/a.test.ts', assertionResults: [{ status: 'passed' }] },
      ],
    },
  })
  assert.equal(got.ok, false)
  assert.equal(got.code, 'RESULT_ROOT_UNPLANNED')
  assert.match(got.detail, /packages\/not-planned/)
})

test('a failed assertion is a FAIL; an unattributed report failure is INCOMPLETE, not PASS', () => {
  const { plan } = fixture()
  const root = plan.tasks.find((t) => t.capture === 1).root
  const failed = resultsFromReport({
    plan,
    capture: 1,
    reportRef: 'r.json',
    report: {
      success: false,
      testResults: [{ name: `/repo/${root}/test/a.test.ts`, assertionResults: [{ status: 'failed' }] }],
    },
  })
  assert.equal(failed.results.find((r) => r.root === root).state, 'FAIL')
  // A collection error has no per-assertion detail; the whole report failed and no root owns it.
  const unattributed = resultsFromReport({
    plan,
    capture: 1,
    reportRef: 'r.json',
    report: {
      success: false,
      testResults: [{ name: `/repo/${root}/test/a.test.ts`, status: 'failed', message: 'collection error', assertionResults: [] }],
    },
  })
  assert.equal(unattributed.results.find((r) => r.root === root).state, 'FAIL')
  const noFile = resultsFromReport({
    plan,
    capture: 1,
    reportRef: 'r.json',
    report: { success: false, testResults: [{ name: `/repo/${root}/test/a.test.ts`, status: 'passed', assertionResults: [] }] },
  })
  assert.equal(noFile.results.find((r) => r.root === root).state, 'INCOMPLETE')
})

test('resultsFromReplay refuses every identity mismatch by name', () => {
  const { plan } = fixture()
  const good = replayOf(plan, 1)
  assert.equal(resultsFromReplay({ plan, capture: 1, replay: good, replayRef: 'r1.json' }).ok, true)

  const cases = [
    ['DRYRUN_PLAN_MISMATCH', { ...good, plan_digest: `sha256:${'e'.repeat(64)}` }],
    ['DRYRUN_CAPTURE_MISMATCH', { ...good, capture: 2 }],
    ['DRYRUN_REPLAY_SCHEMA_UNKNOWN', { ...good, schema: 'census-replay/0' }],
    ['TASK_ID_MISSING', { ...good, results: [{ ...good.results[0], task_id: '' }] }],
    ['DRYRUN_TASK_UNKNOWN', { ...good, results: [{ ...good.results[0], task_id: 'census:not-a-root#1' }] }],
    ['RESULT_ROOT_MISMATCH', { ...good, results: [{ ...good.results[0], root: 'packages/not-the-root' }, ...good.results.slice(1)] }],
    ['RESULT_CAPTURE_MISMATCH', { ...good, results: [{ ...good.results[0], capture: 2 }, ...good.results.slice(1)] }],
    ['TASK_STATE_UNKNOWN', { ...good, results: [{ ...good.results[0], state: 'OK' }, ...good.results.slice(1)] }],
    ['RESULT_EVIDENCE_MISSING', { ...good, results: [{ ...good.results[0], evidence: '  ' }, ...good.results.slice(1)] }],
    ['SHARD_TASK_ID_DUPLICATE', { ...good, results: [good.results[0], ...good.results] }],
  ]
  for (const [code, replay] of cases) {
    const got = resultsFromReplay({ plan, capture: 1, replay, replayRef: 'r1.json' })
    assert.equal(got.ok, false, `${code} must refuse`)
    assert.equal(got.code, code)
  }
})

// ── the gate leg: plan mode, through the REAL function ─────────────────────────────────────────

test('POSITIVE: the plan leg runs 22 planned tasks to a PASS with expected==observed', () => {
  const { plan } = fixture()
  const dryRun = writeDryRun('positive', plan)
  try {
    const leg = LEGS.census(gateContext({ dryRun }))
    assert.equal(leg.verdict, 'pass', leg.detail)
    assert.match(leg.detail, /expected=22 observed=22/)
    assert.match(leg.detail, /aggregate=PASS/)
    assert.match(leg.detail, /tasks=22 roots=11 captures=2/)
    assert.equal(plan.schema, PLAN_SCHEMA)
  } finally {
    rmSync(dryRun, { recursive: true, force: true })
  }
})

test('NEGATIVE: a plan refusal is RED with a named code (and never falls back to legacy)', () => {
  const empty = tmpDir('no-root-config')
  try {
    const leg = censusPlanLeg(gateContext({ root: empty, dryRun: empty }))
    assert.equal(leg.verdict, 'fail')
    assert.match(leg.detail, /^REFUSED [A-Z_]+:/)
    // No legacy body ran: the detail is the refusal, not a baseline comparison.
    assert.doesNotMatch(leg.detail, /baseline|identity set|titled reds/)
  } finally {
    rmSync(empty, { recursive: true, force: true })
  }
})

test('NEGATIVE: a missing build stamp is RED and the plan refuses (no placeholder)', () => {
  const { plan } = fixture()
  const dryRun = writeDryRun('stamp-red', plan)
  try {
    const leg = LEGS.census(gateContext({ dryRun, stampPath: join(dryRun, 'absent.json') }))
    assert.equal(leg.verdict, 'fail')
    assert.match(leg.detail, /REFUSED BUILD_STAMP_MISSING/)
  } finally {
    rmSync(dryRun, { recursive: true, force: true })
  }
})

test('NEGATIVE: an aggregation refusal is RED (a one-capture plan is a smaller population)', () => {
  // A one-capture plan is internally consistent; the AGGREGATOR is what refuses it. Build the
  // matching recording so the refusal provably comes from rule 1 and not from a replay mismatch.
  const { roots, stamp } = fixture()
  const one = buildPlan({
    roots: roots.roots,
    captures: 1,
    identity: {
      merge_tree_sha: gitTreeSha(REPO_ROOT),
      host_sha: hostSha(),
      catalog_digest: roots.catalog_digest,
      build_digest: stamp.digest,
    },
    testTimeout: CLOCK,
    timings: null,
    rootsDropped: roots.roots_dropped ?? [],
  })
  const dryRun = writeDryRun('captures-insufficient', one, { captures: [1] })
  try {
    const leg = LEGS.census(gateContext({ dryRun, captures: 1 }))
    assert.equal(leg.verdict, 'fail')
    assert.match(leg.detail, /REFUSED CAPTURES_INSUFFICIENT/)
    assert.match(leg.detail, /single-capture plan is a smaller population/)
  } finally {
    rmSync(dryRun, { recursive: true, force: true })
  }
})

test('NEGATIVE: a missing second capture refuses instead of aggregating a one-capture census', () => {
  const { plan } = fixture()
  const dryRun = writeDryRun('no-capture-2', plan, { captures: [1] })
  try {
    const leg = LEGS.census(gateContext({ dryRun }))
    assert.equal(leg.verdict, 'fail')
    assert.match(leg.detail, /REFUSED DRYRUN_CAPTURE_MISSING/)
  } finally {
    rmSync(dryRun, { recursive: true, force: true })
  }
})

test('NEGATIVE: a shard that exited 0 while carrying FAIL is not a verdict (aggregate FAIL)', () => {
  const { plan } = fixture()
  const dryRun = writeDryRun('exit0-fail', plan, {
    mutate: { 1: (results) => results.map((r, i) => (i === 0 ? { ...r, state: 'FAIL' } : r)) },
  })
  try {
    const leg = LEGS.census(gateContext({ dryRun }))
    assert.equal(leg.verdict, 'fail', leg.detail)
    assert.match(leg.detail, /aggregate=FAIL/)
    assert.match(leg.detail, /TASK_STATE_FAIL/)
    // The shard itself claims success — that is the point.
    const shard = JSON.parse(readFileSync(join(REPO_ROOT, CENSUS_CAPTURE_REL, 'plan', 'census-shard-1.json'), 'utf8'))
    assert.equal(shard.status, 'COMPLETED')
    assert.equal(shard.exit_code, 0)
    assert.equal(shard.results.some((r) => r.state === 'FAIL'), true)
  } finally {
    rmSync(dryRun, { recursive: true, force: true })
  }
})

test('NEGATIVE: a dropped root is INCOMPLETE (TASK_MISSING), never a smaller green census', () => {
  const { plan } = fixture()
  const dryRun = writeDryRun('dropped-root', plan, {
    mutate: { 1: (results) => results.slice(1) },
  })
  try {
    const leg = LEGS.census(gateContext({ dryRun }))
    assert.equal(leg.verdict, 'fail')
    assert.match(leg.detail, /aggregate=INCOMPLETE/)
    assert.match(leg.detail, /TASK_MISSING/)
    assert.match(leg.detail, /expected=22 observed=21/)
  } finally {
    rmSync(dryRun, { recursive: true, force: true })
  }
})

test('shards: N artifacts carry the SAME task multiset and still aggregate to PASS', () => {
  const { plan } = fixture()
  const dryRun = writeDryRun('shards-2', plan)
  try {
    const leg = LEGS.census(gateContext({ dryRun, shards: 2 }))
    assert.equal(leg.verdict, 'pass', leg.detail)
    assert.match(leg.detail, /shards=2/)
    const dir = join(REPO_ROOT, CENSUS_CAPTURE_REL, 'plan')
    const shardFiles = readdirSync(dir).filter((f) => /^census-shard-\d+\.json$/.test(f)).sort()
    assert.equal(shardFiles.length, 2)
    const ids = shardFiles.flatMap((f) => JSON.parse(readFileSync(join(dir, f), 'utf8')).results.map((r) => r.task_id))
    assert.equal(ids.length, plan.tasks.length)
    assert.equal(new Set(ids).size, plan.tasks.length)
    assert.deepEqual([...new Set(ids)].sort(), plan.tasks.map((t) => t.task_id).sort())
  } finally {
    rmSync(dryRun, { recursive: true, force: true })
  }
})

test('the shard artifacts carry per-result root/capture/evidence and the plan identity', () => {
  const { plan } = fixture()
  const results = plan.tasks.map((t) => ({ task_id: t.task_id, root: t.root, capture: t.capture, state: 'PASS', evidence: `e#${t.task_id}` }))
  const built = buildShardArtifacts({ plan, results, shards: 1 })
  assert.equal(built.ok, true)
  const shard = built.artifacts[0].json
  assert.equal(shard.identity.plan_digest, plan.identity.plan_digest)
  assert.equal(shard.identity.build_digest, plan.identity.build_digest)
  for (const r of shard.results) {
    assert.ok(plan.tasks.some((t) => t.task_id === r.task_id && t.root === r.root && t.capture === r.capture))
    assert.notEqual(r.evidence.trim(), '')
  }
})

// ── the acceptance surface: the real CLI's token and exit code ─────────────────────────────────

function runGate(args) {
  return spawnSync(process.execPath, ['scripts/ci-pr-gate.mjs', ...args], { cwd: REPO_ROOT, encoding: 'utf8' })
}

test('CLI: plan mode dry-run prints the same DSH-CI-VERDICT channel and exits 0 on PASS', () => {
  const { plan } = fixture()
  const dryRun = writeDryRun('cli-pass', plan)
  try {
    const r = runGate(['--only', 'census', '--census-execution', 'plan', '--census-dry-run', dryRun,
      '--census-captures', String(CAPTURES), '--census-test-timeout', String(CLOCK)])
    assert.equal(r.status, 0, r.stderr)
    assert.match(r.stdout, /^DSH-CI-VERDICT pass /m)
    assert.match(r.stdout, /DSH-CENSUS-PLAN execution=plan tasks=22 roots=11 captures=2 plan=sha256:[0-9a-f]{64}/)
    assert.match(r.stdout, /DSH-CENSUS-SUMMARY verdict=PASS codes=none expected=22 observed=22/)
    assert.equal((r.stdout.match(/^DSH-CI-VERDICT /gm) ?? []).length, 1, 'exactly one token')
  } finally {
    rmSync(dryRun, { recursive: true, force: true })
  }
})

test('CLI: a FAIL result is a fail token and exit 1 (the token and the code agree)', () => {
  const { plan } = fixture()
  const dryRun = writeDryRun('cli-fail', plan, {
    mutate: { 1: (results) => results.map((r, i) => (i === 0 ? { ...r, state: 'FAIL' } : r)) },
  })
  try {
    const r = runGate(['--only', 'census', '--census-execution', 'plan', '--census-dry-run', dryRun,
      '--census-captures', String(CAPTURES), '--census-test-timeout', String(CLOCK)])
    assert.equal(r.status, 1)
    assert.match(r.stdout, /^DSH-CI-VERDICT fail /m)
    assert.match(r.stdout, /DSH-CENSUS-SUMMARY verdict=FAIL codes=TASK_STATE_FAIL/)
  } finally {
    rmSync(dryRun, { recursive: true, force: true })
  }
})

test('CLI: the plan-only flags are refused with legacy instead of being silently ignored', () => {
  const legacy = runGate(['--only', 'census', '--census-shards', '2'])
  assert.equal(legacy.status, 1)
  assert.match(legacy.stderr, /only affect the plan path/)
  const bogus = runGate(['--only', 'census', '--census-execution', 'shadow'])
  assert.equal(bogus.status, 1)
  assert.match(bogus.stderr, /--census-execution must be legacy or plan/)
})

// ── the build stamp the census leg WRITES, and the byte-level determinism of the shard digest ──

test('the plan leg writes the build stamp it used, and its digest equals the plan identity', () => {
  const { plan } = fixture()
  const dryRun = writeDryRun('stamp-written', plan)
  try {
    const ctx = gateContext({ dryRun: null, root: undefined })
    // Live mode would spawn vitest; drive the leg with a dry run but keep the transcript dir so the
    // stamp write path is the production one.
    ctx.censusDryRun = dryRun
    const leg = LEGS.census(ctx)
    assert.equal(leg.verdict, 'pass', leg.detail)
    const stampFile = join(ctx.transcriptDir, 'product-build.json')
    const stamp = JSON.parse(readFileSync(stampFile, 'utf8'))
    assert.equal(stamp.schema, STAMP_SCHEMA)
    assert.equal(isValidDigest(stamp.digest), true)
    assert.equal(stamp.digest, plan.identity.build_digest)
    assert.equal(verifyBuildStamp(stamp, { merge_tree: stamp.merge_tree, catalog_digest: stamp.catalog_digest }).ok, true)
    // The recording is an OUTPUT of the real derivation: replaying it is not a fixture.
    const replay = JSON.parse(readFileSync(join(ctx.transcriptDir, 'census-replay-1.json'), 'utf8'))
    assert.equal(replay.schema, REPLAY_SCHEMA)
    assert.equal(replay.plan_digest, plan.identity.plan_digest)
    assert.equal(replay.results.length, 11)
  } finally {
    rmSync(dryRun, { recursive: true, force: true })
  }
})

test('the stamp digest is a digest of the artifact BYTES, not of a list of names', () => {
  const dir = tmpDir('bytes-not-names')
  try {
    spawnSync('git', ['init', '-q'], { cwd: dir })
    mkdirSync(join(dir, 'packages/runtime/dist'), { recursive: true })
    mkdirSync(join(dir, 'packages/client/composition-shim'), { recursive: true })
    writeFileSync(join(dir, 'packages/runtime/dist/a.js'), 'A')
    writeFileSync(join(dir, 'packages/client/composition-shim/b.js'), 'B')
    const args = { cwd: dir, merge_tree: 'a'.repeat(40), catalog_digest: `sha256:${'b'.repeat(64)}`, ignoredFiles: [] }
    const made = computeBuildStamp(args)
    assert.equal(made.ok, true)
    const a = made.stamp.artifacts.find((x) => x.path.endsWith('/a.js'))
    assert.equal(a.sha256, `sha256:${createHash('sha256').update('A').digest('hex')}`)
    assert.equal(a.bytes, statSync(join(dir, 'packages/runtime/dist/a.js')).size)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})
