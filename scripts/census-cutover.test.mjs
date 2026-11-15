#!/usr/bin/env node
/**
 * census-cutover.test.mjs — TINF M5: the plan-driven census and the build stamp, host-free.
 *
 * WHAT THIS SUITE IS FOR. M5 replaces the census leg's INTERNAL execution (plan → execute tasks →
 * aggregate, same verdict token) and adds the one producer M4 disclosed as missing (`build_digest`).
 * Both are exactly the kind of change that can go green while proving less than it claims, so every
 * refusal path the milestone names has a negative control here, and every control drives the REAL
 * code: `LEGS.census` from `scripts/ci-pr-gate.mjs` (recorded captures, or an injected runner for
 * the live branch), `resultsFromReport`/`resultsFromReplay` from `scripts/census-execution.mjs`,
 * `verifyEvidenceRefs`/`aggregateArtifacts` from `scripts/census-aggregate.mjs`, and
 * `computeBuildStamp`/`readBuildStamp` from `scripts/census-build-stamp.mjs`. Three cases spawn the
 * real CLI (`ci-pr-gate` twice, `census-aggregate` once) and assert the real token / exit / stderr,
 * because the token is the acceptance surface and the aggregator CLI is what a doctored directory
 * meets first.
 *
 * HERMETIC BY CONSTRUCTION. Every fixture is created under `os.tmpdir()`. The first draft made them
 * under `REPO_ROOT/.artifacts` and passed only because an UNRELATED earlier suite left that
 * directory behind (16 of 25 failed on a clean checkout): a test that depends on execution order is
 * not a test. `shardDir`/`transcriptDir` are injected for the same reason — a run writes nothing
 * inside the checkout.
 *
 * NEGATIVE CONTROLS (each RED, each named):
 *   - a plan refusal                   (a tree whose root config cannot be derived)
 *   - an aggregation refusal           (a one-capture plan → CAPTURES_INSUFFICIENT)
 *   - a missing second capture         (only capture 1 recorded → DRYRUN_CAPTURE_MISSING)
 *   - a replay from another tree       (→ DRYRUN_IDENTITY_MISMATCH)
 *   - a replay that omits a root       (→ DRYRUN_COVERAGE_MISMATCH)
 *   - an exit-0-with-FAIL result       (shard COMPLETED/exit 0 carrying FAIL → TASK_STATE_FAIL)
 *   - a dropped root                   (a shard missing a task → TASK_MISSING/INCOMPLETE)
 *   - an unplanned root                (report names a root the plan does not → RESULT_ROOT_UNPLANNED)
 *   - evidence that names nothing      (→ RESULT_EVIDENCE_UNREADABLE, at the aggregator CLI too)
 *   - evidence that escapes the dir    (→ RESULT_EVIDENCE_OUTSIDE)
 *   - evidence naming a directory      (→ RESULT_EVIDENCE_NOT_REGULAR)
 *   - evidence naming an escaping link (→ RESULT_EVIDENCE_OUTSIDE, resolved)
 *   - evidence whose bytes changed     (→ RESULT_EVIDENCE_DIGEST_MISMATCH)
 *   - evidence carrying a bogus digest (→ RESULT_EVIDENCE_DIGEST_INVALID), with or without `#root`
 *   - evidence whose digest is checked but whose reference has no fragment (→ DIGEST_MISMATCH)
 *   - a missing build stamp            (→ BUILD_STAMP_MISSING; nothing is written in its place)
 *   - a stale build stamp              (same tree, changed bytes → BUILD_STAMP_STALE)
 *   - a stale report at the graded path (unlinked before the run → CENSUS_REPORT_MISSING)
 *   - EB3_MERGE_TREE naming another tree (→ PLAN_MERGE_TREE_MISMATCH)
 *   - a skipped assertion              (NOT a failure, but the count travels with the result)
 * plus the POSITIVE control (22 planned tasks, 22 observed, PASS), a two-shard layout control, and
 * the live branch with an injected runner (one stamped invocation per capture).
 *
 * NO HOST, NO SUITE RUN. Nothing here spawns vitest; the live branch's runner is injected and writes
 * a report, and the dry-run branch replays a recording.
 */
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmdirSync, rmSync, statSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
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
import { aggregateArtifacts, buildShardArtifacts, writeShardArtifacts } from './census-execution.mjs'
import {
  REPLAY_SCHEMA,
  resultsFromReplay,
  resultsFromReport,
  stampedReportPath,
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

/** A fixture directory OUTSIDE the checkout: a clean clone has no `.artifacts/`, and must not need one. */
function tmpDir(label) {
  return mkdtempSync(join(tmpdir(), `m5-${label}-`))
}

/** A recording of the shared plan: every task PASS unless `mutate` says otherwise. */
function replayOf(plan, capture, mutate = (results) => results) {
  return {
    schema: REPLAY_SCHEMA,
    plan_digest: plan.identity.plan_digest,
    merge_tree: plan.identity.merge_tree_sha,
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

/** Write a dry-run directory holding the given captures (each a recording, optionally mutated). */
function writeDryRun(label, plan, { captures = [1, 2], mutate = {} } = {}) {
  const dir = tmpDir(label)
  for (const capture of captures) {
    const body = mutate[capture] === undefined ? replayOf(plan, capture) : replayOf(plan, capture, mutate[capture])
    writeFileSync(join(dir, `census-replay-${capture}.json`), `${JSON.stringify(body, null, 2)}\n`)
  }
  return dir
}

/** The real gate context, as main() builds it, minus everything the plan path does not use. */
function gateContext({ dryRun = null, captures = CAPTURES, shards = 1, stampPath = null, root = undefined, runCommand = undefined } = {}) {
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
    // Both output directories are tmp: the leg writes the build stamp, the replay recording and the
    // evidence artifacts here, so a test run leaves no byte inside the checkout.
    transcriptDir: tmpDir('ctx-transcripts'),
    shardDir: tmpDir('ctx-shards'),
    stamp: 'm5-test',
    runCommand,
    timing: createTimer({ dir: null, runId: 'm5-test', identity: 'phase=m5' }),
    capture() {},
    writeJson() {},
  }
}

/**
 * The files a plan root expects, as report entries. A synthetic report MUST enumerate the plan's
 * population (F-02): one file per root is no longer "the root passed", it is 704 missing files.
 */
function reportFilesOf(plan, root = null) {
  return plan.roots
    .filter((r) => root === null || r.root === root)
    .flatMap((r) => r.files_expected.map((rel) => ({ root: r.root, name: `/runner/work/repo/${r.root}/${rel}` })))
}

/**
 * A synthetic vitest report whose enumerated files all pass (with `skipped` extra skipped legs on the
 * FIRST file of each root). `mutate(file, index)` may rewrite one entry; `onlyRoot` narrows the report
 * to one root (used by the per-root derivation controls).
 */
function reportFor(plan, { skipped = 0, failedRoot = null, onlyRoot = null, assertionsPerFile = 1, mutate = null } = {}) {
  const files = reportFilesOf(plan, onlyRoot)
  return {
    success: failedRoot === null,
    testResults: files.map((file, index) => {
      const failed = failedRoot !== null && file.root === failedRoot
      const firstOfRoot = files.findIndex((f) => f.root === file.root) === index
      const entry = {
        name: file.name,
        status: failed ? 'failed' : 'passed',
        assertionResults: [
          ...Array.from({ length: assertionsPerFile }, () => ({ status: failed ? 'failed' : 'passed' })),
          ...(firstOfRoot ? Array.from({ length: skipped }, () => ({ status: 'skipped' })) : []),
        ],
      }
      return mutate === null ? entry : mutate(entry, index, file)
    }),
  }
}

/** A hand-built result row must carry the plan's population (F-02); this is the one place that does it. */
function pop(plan, task, over = {}) {
  const root = plan.roots.find((r) => r.root === task.root)
  return {
    task_id: task.task_id,
    root: task.root,
    capture: task.capture,
    state: 'PASS',
    files_expected: root.files_expected.length,
    files_observed: root.files_expected.length,
    file_digest: root.file_digest,
    ...over,
  }
}

// ── the build stamp: a REAL digest of REAL bytes ────────────────────────────────────────────────

test('fixtures live outside the checkout, so a clean checkout can run this suite', () => {
  const dir = tmpDir('hermetic')
  try {
    assert.equal(dir.startsWith(REPO_ROOT), false, 'no fixture may be created inside the checkout')
    assert.equal(dir.startsWith(tmpdir()), true)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

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
    assert.equal(verifyBuildStamp(two.stamp, { cwd: dir, ignoredFiles: [] }).ok, true)
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

test('NEGATIVE: a same-tree stamp whose bytes changed is BUILD_STAMP_STALE (not trusted)', () => {
  const dir = tmpDir('stamp-stale')
  try {
    spawnSync('git', ['init', '-q'], { cwd: dir })
    mkdirSync(join(dir, 'packages/runtime/dist'), { recursive: true })
    mkdirSync(join(dir, 'packages/client/composition-shim'), { recursive: true })
    writeFileSync(join(dir, 'packages/runtime/dist/a.js'), 'A')
    writeFileSync(join(dir, 'packages/client/composition-shim/b.js'), 'B')
    const made = computeBuildStamp({
      cwd: dir,
      merge_tree: 'a'.repeat(40),
      catalog_digest: `sha256:${'b'.repeat(64)}`,
      ignoredFiles: [],
    })
    assert.equal(made.ok, true, made.detail)
    const file = join(dir, 'product-build.json')
    writeFileSync(file, `${JSON.stringify(made.stamp, null, 2)}\n`)
    // Self-consistent, correct tree, correct catalog — and describing a moment that has passed.
    assert.equal(readBuildStamp(file, { cwd: dir, ignoredFiles: [] }).ok, true)
    writeFileSync(join(dir, 'packages/runtime/dist/a.js'), 'A changed')
    const stale = readBuildStamp(file, { cwd: dir, ignoredFiles: [] })
    assert.equal(stale.ok, false)
    assert.equal(stale.code, 'BUILD_STAMP_STALE')
    assert.match(stale.detail, /packages\/runtime\/dist\/a\.js \(bytes changed\)/)
    // ...and when the surface cannot be re-hashed at all, the stamp is refused rather than trusted.
    rmSync(join(dir, 'packages/runtime/dist'), { recursive: true, force: true })
    const unverifiable = readBuildStamp(file, { cwd: dir, ignoredFiles: [] })
    assert.equal(unverifiable.ok, false)
    assert.equal(unverifiable.code, 'BUILD_STAMP_UNVERIFIABLE')
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
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
    const read = readBuildStamp(file, { cwd: REPO_ROOT, merge_tree: stamp.merge_tree, catalog_digest: stamp.catalog_digest })
    assert.equal(read.ok, true, read.detail)
    assert.equal(read.stamp.digest, stamp.digest)
    // A stamp file that is not JSON is a named refusal, not a crash.
    writeFileSync(file, 'not json\n')
    assert.equal(readBuildStamp(file, { cwd: REPO_ROOT }).code, 'BUILD_STAMP_UNREADABLE')
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

// ── per-task derivation: the runner's identity + evidence, never the report's after the fact ────

test('resultsFromReport derives root identity, a terminal state and evidence from the report', () => {
  const { plan } = fixture()
  const root = plan.tasks.find((t) => t.capture === 1).root
  const expected = plan.roots.find((r) => r.root === root).files_expected.length
  const ok = resultsFromReport({
    plan,
    capture: 1,
    reportRef: '.artifacts/census/report-1.json',
    exitCode: 0,
    report: reportFor(plan, { assertionsPerFile: 2 }),
  })
  assert.equal(ok.ok, true, ok.detail)
  assert.equal(ok.results.length, plan.tasks.filter((t) => t.capture === 1).length)
  const mine = ok.results.find((r) => r.root === root)
  assert.equal(mine.state, 'PASS')
  assert.equal(mine.capture, 1)
  assert.equal(mine.task_id, plan.tasks.find((t) => t.root === root && t.capture === 1).task_id)
  assert.equal(mine.files, expected)
  assert.equal(mine.files_expected, expected)
  assert.equal(mine.files_observed, expected)
  assert.equal(mine.assertions, 2 * expected)
  assert.equal(mine.skipped, 0)
  assert.match(mine.evidence, /^\.artifacts\/census\/report-1\.json#/)
  assert.match(mine.evidence, /sha256:[0-9a-f]{64}$/)

  // A root ABSENT from the report is INCOMPLETE, never PASS: silence is not evidence of running.
  const partial = resultsFromReport({
    plan,
    capture: 1,
    reportRef: '.artifacts/census/report-1.json',
    exitCode: 0,
    report: { success: true, testResults: [] },
  })
  assert.equal(partial.ok, true)
  assert.equal(partial.results.every((r) => r.state === 'INCOMPLETE'), true)
})

test('a skip is NOT a failure (legacy semantics) and the skip count is carried', () => {
  const { plan } = fixture()
  const root = plan.tasks.find((t) => t.capture === 1).root
  const expected = plan.roots.find((r) => r.root === root).files_expected.length
  const got = resultsFromReport({
    plan,
    capture: 1,
    reportRef: 'r.json',
    exitCode: 0,
    report: reportFor(plan, {
      onlyRoot: root,
      mutate: (entry, index) =>
        index === 0
          ? { ...entry, assertionResults: [{ status: 'passed' }, { status: 'pending' }, { status: 'skipped' }] }
          : entry,
    }),
  })
  const mine = got.results.find((r) => r.root === root)
  assert.equal(mine.state, 'PASS', 'a skipped leg is a leg the runner declined to run, not a red')
  assert.equal(mine.skipped, 2)
  assert.equal(mine.assertions, expected + 2)
})

test('an unknown assertion status is a FAIL, not a silent pass', () => {
  const { plan } = fixture()
  const root = plan.tasks.find((t) => t.capture === 1).root
  const got = resultsFromReport({
    plan,
    capture: 1,
    reportRef: 'r.json',
    exitCode: 0,
    report: reportFor(plan, {
      onlyRoot: root,
      mutate: (entry, index) => (index === 0 ? { ...entry, assertionResults: [{ status: 'quarantined' }] } : entry),
    }),
  })
  const mine = got.results.find((r) => r.root === root)
  assert.equal(mine.state, 'FAIL')
  assert.match(mine.detail, /UNKNOWN_ASSERTION_STATUS/)
})

test('NEGATIVE: a root that RAN without being planned is refused (the invariant runs both ways)', () => {
  const { plan } = fixture()
  const got = resultsFromReport({
    plan,
    capture: 1,
    reportRef: 'r.json',
    exitCode: 0,
    report: {
      success: true,
      testResults: [
        ...reportFor(plan).testResults,
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
    exitCode: 0,
    report: reportFor(plan, {
      onlyRoot: root,
      mutate: (entry, index) => (index === 0 ? { ...entry, assertionResults: [{ status: 'failed' }] } : entry),
    }),
  })
  assert.equal(failed.results.find((r) => r.root === root).state, 'FAIL')
  // A collection error has no per-assertion detail: F-02 names it COLLECTION_ERROR (INCOMPLETE), not
  // a failed assertion, so the transcript says "it never ran" instead of "an assertion failed".
  const collection = resultsFromReport({
    plan,
    capture: 1,
    reportRef: 'r.json',
    exitCode: 0,
    report: reportFor(plan, {
      onlyRoot: root,
      mutate: (entry, index) =>
        index === 0 ? { ...entry, status: 'failed', message: 'collection error', assertionResults: [] } : entry,
    }),
  })
  assert.equal(collection.results.find((r) => r.root === root).state, 'INCOMPLETE')
  assert.deepEqual(collection.results.find((r) => r.root === root).codes, ['COLLECTION_ERROR'])
  const noFile = resultsFromReport({
    plan,
    capture: 1,
    reportRef: 'r.json',
    exitCode: 0,
    report: { success: false, testResults: reportFor(plan).testResults },
  })
  assert.equal(noFile.results.find((r) => r.root === root).state, 'INCOMPLETE')
})

test('resultsFromReplay refuses every identity mismatch by name', () => {
  const { plan } = fixture()
  const good = replayOf(plan, 1)
  assert.equal(resultsFromReplay({ plan, capture: 1, replay: good, replayRef: 'r1.json' }).ok, true)

  const cases = [
    ['DRYRUN_PLAN_MISMATCH', { ...good, plan_digest: `sha256:${'e'.repeat(64)}` }],
    ['DRYRUN_IDENTITY_MISMATCH', { ...good, merge_tree: 'f'.repeat(40), identity: { ...good.identity, merge_tree_sha: 'f'.repeat(40) } }],
    ['DRYRUN_IDENTITY_MISMATCH', { ...good, merge_tree: undefined, identity: undefined }],
    ['DRYRUN_CAPTURE_MISMATCH', { ...good, capture: 2 }],
    ['DRYRUN_REPLAY_SCHEMA_UNKNOWN', { ...good, schema: 'census-replay/0' }],
    ['TASK_ID_MISSING', { ...good, results: [{ ...good.results[0], task_id: '' }] }],
    ['DRYRUN_TASK_UNKNOWN', { ...good, results: [{ ...good.results[0], task_id: 'census:not-a-root#1' }] }],
    ['RESULT_ROOT_MISMATCH', { ...good, results: [{ ...good.results[0], root: 'packages/not-the-root' }, ...good.results.slice(1)] }],
    ['RESULT_CAPTURE_MISMATCH', { ...good, results: [{ ...good.results[0], capture: 2 }, ...good.results.slice(1)] }],
    ['TASK_STATE_UNKNOWN', { ...good, results: [{ ...good.results[0], state: 'OK' }, ...good.results.slice(1)] }],
    ['RESULT_EVIDENCE_MISSING', { ...good, results: [{ ...good.results[0], evidence: '  ' }, ...good.results.slice(1)] }],
    ['SHARD_TASK_ID_DUPLICATE', { ...good, results: [good.results[0], ...good.results] }],
    ['DRYRUN_COVERAGE_MISMATCH', { ...good, results: good.results.slice(1) }],
  ]
  for (const [code, replay] of cases) {
    const got = resultsFromReplay({ plan, capture: 1, replay, replayRef: 'r1.json' })
    assert.equal(got.ok, false, `${code} must refuse`)
    assert.equal(got.code, code, got.detail)
  }
})

// ── evidence references: a pointer that can be OPENED, not a string that is trusted ────────────

test('NEGATIVE: evidence that names a file which does not exist is refused', () => {
  const { plan } = fixture()
  const dir = tmpDir('evidence-missing')
  try {
    const results = plan.tasks.map((t) => ({ task_id: t.task_id, root: t.root, capture: t.capture, state: 'PASS', evidence: '/nonexistent/report.json#x' }))
    const built = buildShardArtifacts({ plan, results, shards: 1 })
    assert.equal(built.ok, true)
    const files = writeShardArtifacts(dir, built.artifacts)
    const got = aggregateArtifacts({ plan, files })
    assert.equal(got.refused, true)
    assert.equal(got.codes.includes('RESULT_EVIDENCE_OUTSIDE'), true, JSON.stringify(got.codes))
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('NEGATIVE: evidence that escapes the artifact directory is refused by name', () => {
  const { plan } = fixture()
  const parent = tmpDir('evidence-escape')
  const dir = join(parent, 'shards')
  mkdirSync(dir)
  try {
    writeFileSync(join(parent, 'outside.json'), '{}\n')
    const results = plan.tasks.map((t) => ({ task_id: t.task_id, root: t.root, capture: t.capture, state: 'PASS', evidence: '../outside.json#' }))
    const built = buildShardArtifacts({ plan, results, shards: 1 })
    const files = writeShardArtifacts(dir, built.artifacts)
    const got = aggregateArtifacts({ plan, files })
    assert.equal(got.refused, true)
    assert.deepEqual(got.codes, ['RESULT_EVIDENCE_OUTSIDE'])
  } finally {
    rmSync(parent, { recursive: true, force: true })
  }
})

test('NEGATIVE: the aggregator CLI refuses a doctored shard directory (exit 2, named code)', () => {
  const { plan } = fixture()
  const dir = tmpDir('cli-doctored')
  try {
    const planFile = join(dir, 'plan.json')
    writeFileSync(planFile, `${JSON.stringify(plan, null, 2)}\n`)
    const results = plan.tasks.map((t) => ({ task_id: t.task_id, root: t.root, capture: t.capture, state: 'PASS', evidence: '/nonexistent/report.json#x' }))
    const built = buildShardArtifacts({ plan, results, shards: 1 })
    const files = writeShardArtifacts(dir, built.artifacts)
    const r = spawnSync(process.execPath, ['scripts/census-aggregate.mjs', '--aggregate', ...files, '--plan', planFile], { cwd: REPO_ROOT, encoding: 'utf8' })
    assert.equal(r.status, 2, r.stdout + r.stderr)
    assert.match(r.stderr, /REFUSED RESULT_EVIDENCE_(OUTSIDE|UNREADABLE)/)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('NEGATIVE: evidence must be a REGULAR FILE — a directory is not a pointer (M6)', () => {
  const { plan } = fixture()
  const dir = tmpDir('evidence-dir')
  try {
    mkdirSync(join(dir, 'census-evidence-1.json'))
    const results = plan.tasks.map((t) => ({ task_id: t.task_id, root: t.root, capture: t.capture, state: 'PASS', evidence: 'census-evidence-1.json#' + t.root }))
    const built = buildShardArtifacts({ plan, results, shards: 1 })
    const files = writeShardArtifacts(dir, built.artifacts)
    const got = aggregateArtifacts({ plan, files })
    assert.equal(got.refused, true)
    assert.deepEqual(got.codes, ['RESULT_EVIDENCE_NOT_REGULAR'])
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('NEGATIVE: a symlink that escapes the artifact directory is refused after resolution (M6)', () => {
  const { plan } = fixture()
  const parent = tmpDir('evidence-link')
  const dir = join(parent, 'shards')
  mkdirSync(dir)
  try {
    writeFileSync(join(parent, 'outside.json'), '{}\n')
    symlinkSync(join(parent, 'outside.json'), join(dir, 'census-evidence-1.json'))
    const results = plan.tasks.map((t) => ({ task_id: t.task_id, root: t.root, capture: t.capture, state: 'PASS', evidence: 'census-evidence-1.json#' + t.root }))
    const built = buildShardArtifacts({ plan, results, shards: 1 })
    const files = writeShardArtifacts(dir, built.artifacts)
    const got = aggregateArtifacts({ plan, files })
    assert.equal(got.refused, true)
    assert.deepEqual(got.codes, ['RESULT_EVIDENCE_OUTSIDE'])
  } finally {
    rmSync(parent, { recursive: true, force: true })
  }
})

test('NEGATIVE: a reference whose bytes changed is a DIGEST_MISMATCH, and a bogus digest is refused (M6)', () => {
  const { plan } = fixture()
  const dir = tmpDir('evidence-digest')
  try {
    const artifact = join(dir, 'census-evidence-1.json')
    writeFileSync(artifact, JSON.stringify({ schema: 'census-evidence/1', capture: 1, source: { path: 'x', digest: null }, roots: plan.tasks.filter((t) => t.capture === 1).map((t) => ({ root: t.root })) }))
    const digest = `sha256:${createHash('sha256').update(readFileSync(artifact)).digest('hex')}`
    const results = plan.tasks.map((t) => ({ task_id: t.task_id, root: t.root, capture: t.capture, state: 'PASS', evidence: `census-evidence-1.json#${t.root} ${digest}` }))
    const built = buildShardArtifacts({ plan, results, shards: 1 })
    const files = writeShardArtifacts(dir, built.artifacts)
    // The bytes the reference attests are gone: a replaced/edited artifact must not pass.
    writeFileSync(artifact, JSON.stringify({ schema: 'census-evidence/1', capture: 1, source: { path: 'x', digest: null }, roots: plan.tasks.filter((t) => t.capture === 1).map((t) => ({ root: t.root })) }, null, 2))
    const got = aggregateArtifacts({ plan, files })
    assert.equal(got.refused, true)
    assert.deepEqual(got.codes, ['RESULT_EVIDENCE_DIGEST_MISMATCH'])
    // …and the reference itself must carry a real sha256, not a token that looks like one.
    const bogus = plan.tasks.map((t) => ({ task_id: t.task_id, root: t.root, capture: t.capture, state: 'PASS', evidence: `census-evidence-1.json#${t.root} sha256:not-a-digest` }))
    const built2 = buildShardArtifacts({ plan, results: bogus, shards: 1 })
    const files2 = writeShardArtifacts(dir, built2.artifacts)
    const got2 = aggregateArtifacts({ plan, files: files2 })
    assert.equal(got2.refused, true)
    assert.deepEqual(got2.codes, ['RESULT_EVIDENCE_DIGEST_INVALID'])
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('NEGATIVE: the trailing digest is verified with OR without a `#root` fragment (M6 review)', () => {
  // The digest attests the FILE, so it cannot be a property of the reference shape that happens to
  // carry one. Before this, `'evidence.json sha256:…'` (no fragment) skipped the digest check
  // entirely: a replaced artifact passed as long as some ref with `#root` was checked elsewhere.
  const { plan } = fixture()
  const dir = tmpDir('evidence-digest-shapes')
  try {
    const artifact = join(dir, 'census-evidence-1.json')
    const body = (pretty) =>
      JSON.stringify(
        { schema: 'census-evidence/1', capture: 1, source: { path: 'x', digest: null }, roots: plan.tasks.filter((t) => t.capture === 1).map((t) => ({ root: t.root })) },
        null,
        pretty ? 2 : 0,
      )
    writeFileSync(artifact, body(false))
    const digest = `sha256:${createHash('sha256').update(readFileSync(artifact)).digest('hex')}`

    // POSITIVE: no fragment, honest digest — the shape is legal and must still aggregate.
    const ok = plan.tasks.map((t) => pop(plan, t, { evidence: `census-evidence-1.json ${digest}` }))
    const okFiles = writeShardArtifacts(dir, buildShardArtifacts({ plan, results: ok, shards: 1 }).artifacts)
    const okGot = aggregateArtifacts({ plan, files: okFiles })
    assert.equal(okGot.refused, false, okGot.detail)
    assert.equal(okGot.verdict, 'PASS')

    // NEGATIVE 1: same shape (no fragment), bytes replaced → the digest must still be caught.
    writeFileSync(artifact, body(true))
    const got = aggregateArtifacts({ plan, files: okFiles })
    assert.equal(got.refused, true)
    assert.deepEqual(got.codes, ['RESULT_EVIDENCE_DIGEST_MISMATCH'])

    // NEGATIVE 2: no fragment, malformed digest → INVALID (not silently ignored).
    const bogus = plan.tasks.map((t) => pop(plan, t, { evidence: 'census-evidence-1.json sha256:not-a-digest' }))
    const bogusFiles = writeShardArtifacts(dir, buildShardArtifacts({ plan, results: bogus, shards: 1 }).artifacts)
    const gotBogus = aggregateArtifacts({ plan, files: bogusFiles })
    assert.equal(gotBogus.refused, true)
    assert.deepEqual(gotBogus.codes, ['RESULT_EVIDENCE_DIGEST_INVALID'])

    // NEGATIVE 3: with a fragment, the malformed digest is refused the same way (the old shape).
    const bogusFrag = plan.tasks.map((t) => pop(plan, t, { evidence: `census-evidence-1.json#${t.root} sha256:not-a-digest` }))
    const bogusFragFiles = writeShardArtifacts(dir, buildShardArtifacts({ plan, results: bogusFrag, shards: 1 }).artifacts)
    const gotBogusFrag = aggregateArtifacts({ plan, files: bogusFragFiles })
    assert.equal(gotBogusFrag.refused, true)
    assert.deepEqual(gotBogusFrag.codes, ['RESULT_EVIDENCE_DIGEST_INVALID'])
  } finally {
    rmSync(dir, { recursive: true, force: true })
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
    const ctx = gateContext({ dryRun: empty })
    ctx.repoRoot = empty
    const leg = censusPlanLeg(ctx)
    assert.equal(leg.verdict, 'fail')
    assert.match(leg.detail, /^REFUSED [A-Z_]+:/)
    // No legacy body ran: the detail is the refusal, not a baseline comparison.
    assert.doesNotMatch(leg.detail, /baseline|identity set|titled reds/)
  } finally {
    rmSync(empty, { recursive: true, force: true })
  }
})

test('NEGATIVE: EB3_MERGE_TREE naming another tree refuses PLAN_MERGE_TREE_MISMATCH', () => {
  const { plan } = fixture()
  const dryRun = writeDryRun('tree-claim', plan)
  const before = process.env.EB3_MERGE_TREE
  process.env.EB3_MERGE_TREE = 'f'.repeat(40)
  try {
    const leg = LEGS.census(gateContext({ dryRun }))
    assert.equal(leg.verdict, 'fail')
    assert.match(leg.detail, /REFUSED PLAN_MERGE_TREE_MISMATCH/)
  } finally {
    if (before === undefined) delete process.env.EB3_MERGE_TREE
    else process.env.EB3_MERGE_TREE = before
    rmSync(dryRun, { recursive: true, force: true })
  }
})

test('NEGATIVE: a replay from another tree refuses DRYRUN_IDENTITY_MISMATCH', () => {
  const { plan } = fixture()
  const dryRun = writeDryRun('other-tree', plan)
  try {
    const file = join(dryRun, 'census-replay-1.json')
    const doc = JSON.parse(readFileSync(file, 'utf8'))
    doc.merge_tree = 'f'.repeat(40)
    writeFileSync(file, `${JSON.stringify(doc, null, 2)}\n`)
    const leg = LEGS.census(gateContext({ dryRun }))
    assert.equal(leg.verdict, 'fail')
    assert.match(leg.detail, /REFUSED DRYRUN_IDENTITY_MISMATCH/)
  } finally {
    rmSync(dryRun, { recursive: true, force: true })
  }
})

test('NEGATIVE: a replay that omits a root refuses DRYRUN_COVERAGE_MISMATCH', () => {
  const { plan } = fixture()
  const dryRun = writeDryRun('coverage', plan, { mutate: { 1: (results) => results.slice(1) } })
  try {
    const leg = LEGS.census(gateContext({ dryRun }))
    assert.equal(leg.verdict, 'fail')
    assert.match(leg.detail, /REFUSED DRYRUN_COVERAGE_MISMATCH/)
  } finally {
    rmSync(dryRun, { recursive: true, force: true })
  }
})

test('NEGATIVE: a missing build stamp is RED and the plan refuses (no placeholder)', () => {
  const { plan } = fixture()
  const dryRun = writeDryRun('stamp-red', plan)
  try {
    const ctx = gateContext({ dryRun, stampPath: join(dryRun, 'absent.json') })
    const leg = LEGS.census(ctx)
    assert.equal(leg.verdict, 'fail')
    assert.match(leg.detail, /REFUSED BUILD_STAMP_MISSING/)
    assert.equal(readdirSync(ctx.transcriptDir).includes('product-build.json'), false)
  } finally {
    rmSync(dryRun, { recursive: true, force: true })
  }
})

test('NEGATIVE: an aggregation refusal is RED (a one-capture plan is a smaller population)', () => {
  // A one-capture plan is internally consistent; the AGGREGATOR is what refuses it. Build the
  // matching recording so the refusal provably comes from rule 1, not from a replay mismatch.
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
    const ctx = gateContext({ dryRun })
    const leg = LEGS.census(ctx)
    assert.equal(leg.verdict, 'fail', leg.detail)
    assert.match(leg.detail, /aggregate=FAIL/)
    assert.match(leg.detail, /TASK_STATE_FAIL/)
    // The shard itself claims success — that is the point.
    const shard = JSON.parse(readFileSync(join(ctx.shardDir, 'census-shard-1.json'), 'utf8'))
    // A dry run REPLAYS bytes; it must not fabricate a process exit. The shard says REPLAY/null and
    // the FAIL still comes from the recorded states, not from an invented green exit.
    assert.equal(shard.status, 'REPLAY')
    assert.equal(shard.exit_code, null)
    assert.equal(shard.results.some((r) => r.state === 'FAIL'), true)
    // ...and every result's evidence points at an artifact that EXISTS in the shard directory.
    for (const r of shard.results) {
      const rel = r.evidence.split('#')[0].split(/\s+/)[0]
      assert.equal(statSync(join(ctx.shardDir, rel)).isFile(), true, `${rel} must exist`)
    }
  } finally {
    rmSync(dryRun, { recursive: true, force: true })
  }
})

test('NEGATIVE: a dropped shard result is TASK_MISSING/INCOMPLETE, never a smaller green census', () => {
  // The dry-run path refuses incomplete coverage BEFORE aggregating (see the replay test), so the
  // aggregator's own dropped-task rule is exercised where it lives: on the shard artifact.
  const { plan } = fixture()
  const dir = tmpDir('dropped-task')
  try {
    // The evidence pointer is real (it is not what this control is about): the missing thing is a
    // planned TASK, and that is the aggregator's own rule.
    writeFileSync(join(dir, 'evidence.json'), '{}\n')
    const results = plan.tasks.slice(1).map((t) => pop(plan, t, { evidence: 'evidence.json' }))
    const built = buildShardArtifacts({ plan, results, shards: 1 })
    const files = writeShardArtifacts(dir, built.artifacts)
    const got = aggregateArtifacts({ plan, files })
    assert.equal(got.ok, false)
    assert.equal(got.verdict, 'INCOMPLETE')
    assert.equal(got.codes.includes('TASK_MISSING'), true)
    assert.equal(got.summary.counts.expected, plan.tasks.length)
    assert.equal(got.summary.counts.observed, plan.tasks.length - 1)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('shards: N artifacts carry the SAME task multiset and still aggregate to PASS', () => {
  const { plan } = fixture()
  const dryRun = writeDryRun('shards-2', plan)
  try {
    const ctx = gateContext({ dryRun, shards: 2 })
    const leg = LEGS.census(ctx)
    assert.equal(leg.verdict, 'pass', leg.detail)
    assert.match(leg.detail, /shards=2/)
    const shardFiles = readdirSync(ctx.shardDir).filter((f) => /^census-shard-\d+\.json$/.test(f)).sort()
    assert.equal(shardFiles.length, 2)
    const ids = shardFiles.flatMap((f) => JSON.parse(readFileSync(join(ctx.shardDir, f), 'utf8')).results.map((r) => r.task_id))
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

// ── the LIVE branch, driven with an injected runner (no host, no vitest) ───────────────────────

test('LIVE: one stamped invocation per capture, graded from the report it just wrote', () => {
  const { plan } = fixture()
  const calls = []
  const runCommand = (cmd, args) => {
    calls.push({ cmd, args })
    const jsonArg = args.find((a) => a.startsWith('--outputFile.json='))
    assert.ok(jsonArg, 'the plan argv must carry a report path')
    const capture = Number(/census-m5-test-\d+-(\d+)\.json$/.exec(jsonArg)?.[1] ?? 0)
    assert.ok(capture === 1 || capture === 2, `stamped path must name the capture: ${jsonArg}`)
    const rel = jsonArg.slice('--outputFile.json='.length)
    mkdirSync(resolve(REPO_ROOT, rel, '..'), { recursive: true })
    writeFileSync(resolve(REPO_ROOT, rel), `${JSON.stringify(reportFor(plan, { skipped: 1 }), null, 2)}\n`)
    return { command: cmd, args, seconds: 0, code: 0, signal: null, error: null, stdout: '', stderr: '' }
  }
  try {
    const ctx = gateContext({ runCommand })
    const leg = LEGS.census(ctx)
    assert.equal(leg.verdict, 'pass', leg.detail)
    assert.equal(calls.length, 2, 'one invocation per capture, not one per task')
    assert.match(leg.detail, /expected=22 observed=22/)
    // Every result's evidence names an artifact written beside the shards, and carries its skip count.
    const shard = JSON.parse(readFileSync(join(ctx.shardDir, 'census-shard-1.json'), 'utf8'))
    for (const r of shard.results) {
      assert.match(r.evidence, /^census-evidence-\d\.json#/)
      assert.equal(statSync(join(ctx.shardDir, r.evidence.split('#')[0])).isFile(), true)
      assert.equal(r.skipped, 1, 'the skip count travels with the result')
    }
    // The graded path is the run-stamped one, not the plan's deterministic path.
    for (const call of calls) {
      const rel = call.args.find((a) => a.startsWith('--outputFile.json=')).slice('--outputFile.json='.length)
      const capture = rel.includes('-1.json') ? 1 : 2
      assert.equal(rel, stampedReportPath({ stamp: 'm5-test', pid: process.pid, capture }))
      assert.notEqual(rel, plan.tasks[0].runner.argv.find((a) => a.startsWith('--outputFile.json=')).slice('--outputFile.json='.length))
    }
  } finally {
    rmSync(resolve(REPO_ROOT, CENSUS_CAPTURE_REL), { recursive: true, force: true })
    // The live branch writes into the checkout's gitignored artifact directory (it must: it grades a
    // real stamped path). Remove the parent too, but ONLY when it is empty — never a real artifact.
    try {
      rmdirSync(resolve(REPO_ROOT, '.artifacts'))
    } catch {
      /* not empty, or already gone: leave it alone */
    }
  }
})

test('NEGATIVE: a stale report at the graded path is UNLINKED, so its absence is a named refusal', () => {
  const { plan } = fixture()
  for (const capture of [1, 2]) {
    const rel = stampedReportPath({ stamp: 'm5-test', pid: process.pid, capture })
    mkdirSync(resolve(REPO_ROOT, rel, '..'), { recursive: true })
    // Byte-for-byte what a previous run would have left: a fully green report.
    writeFileSync(resolve(REPO_ROOT, rel), `${JSON.stringify(reportFor(plan), null, 2)}\n`)
  }
  const runCommand = (cmd, args) => ({ command: cmd, args, seconds: 0, code: 0, signal: null, error: null, stdout: '', stderr: '' })
  try {
    const leg = LEGS.census(gateContext({ runCommand }))
    assert.equal(leg.verdict, 'fail')
    assert.match(leg.detail, /REFUSED CENSUS_REPORT_MISSING/)
  } finally {
    for (const capture of [1, 2]) rmSync(resolve(REPO_ROOT, stampedReportPath({ stamp: 'm5-test', pid: process.pid, capture })), { force: true })
    rmSync(resolve(REPO_ROOT, CENSUS_CAPTURE_REL), { recursive: true, force: true })
    try {
      rmdirSync(resolve(REPO_ROOT, '.artifacts'))
    } catch {
      /* not empty, or already gone */
    }
  }
})

// ── the acceptance surface: the real CLI's token and exit code ─────────────────────────────────

function runGate(args) {
  return spawnSync(process.execPath, ['scripts/ci-pr-gate.mjs', ...args], { cwd: REPO_ROOT, encoding: 'utf8' })
}

test('CLI: plan mode dry-run prints the same DSH-CI-VERDICT channel and exits 0 on PASS', () => {
  const { plan } = fixture()
  const dryRun = writeDryRun('cli-pass', plan)
  const transcript = tmpDir('cli-pass-out')
  try {
    const r = runGate(['--only', 'census', '--census-execution', 'plan', '--census-dry-run', dryRun,
      '--census-captures', String(CAPTURES), '--census-test-timeout', String(CLOCK), '--transcript-dir', transcript])
    assert.equal(r.status, 0, r.stderr)
    assert.match(r.stdout, /^DSH-CI-VERDICT pass /m)
    assert.match(r.stdout, /DSH-CENSUS-PLAN execution=plan tasks=22 roots=11 captures=2 plan=sha256:[0-9a-f]{64}/)
    assert.match(r.stdout, /DSH-CENSUS-SUMMARY mode=dry-run verdict=PASS codes=none expected=22 observed=22 missing=0 extra=0 shards=1 assertions_total=0 assertions_executed=0 skipped_total=0/)
    assert.equal((r.stdout.match(/^DSH-CI-VERDICT /gm) ?? []).length, 1, 'exactly one token')
    assert.match(r.stdout, /DSH-CENSUS-CAPTURE capture=1 .*assertions_executed=0 assertions_total=0 skipped_total=0 evidence=census-evidence-1\.json/)
  } finally {
    rmSync(dryRun, { recursive: true, force: true })
    rmSync(transcript, { recursive: true, force: true })
  }
})

test('CLI: a FAIL result is a fail token and exit 1 (the token and the code agree)', () => {
  const { plan } = fixture()
  const dryRun = writeDryRun('cli-fail', plan, {
    mutate: { 1: (results) => results.map((r, i) => (i === 0 ? { ...r, state: 'FAIL' } : r)) },
  })
  const transcript = tmpDir('cli-fail-out')
  try {
    const r = runGate(['--only', 'census', '--census-execution', 'plan', '--census-dry-run', dryRun,
      '--census-captures', String(CAPTURES), '--census-test-timeout', String(CLOCK), '--transcript-dir', transcript])
    assert.equal(r.status, 1)
    assert.match(r.stdout, /^DSH-CI-VERDICT fail /m)
    assert.match(r.stdout, /DSH-CENSUS-SUMMARY mode=dry-run verdict=FAIL codes=TASK_STATE_FAIL/)
  } finally {
    rmSync(dryRun, { recursive: true, force: true })
    rmSync(transcript, { recursive: true, force: true })
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
    const ctx = gateContext({ dryRun })
    const leg = LEGS.census(ctx)
    assert.equal(leg.verdict, 'pass', leg.detail)
    const stamp = JSON.parse(readFileSync(join(ctx.transcriptDir, 'product-build.json'), 'utf8'))
    assert.equal(stamp.schema, STAMP_SCHEMA)
    assert.equal(isValidDigest(stamp.digest), true)
    assert.equal(stamp.digest, plan.identity.build_digest)
    assert.equal(verifyBuildStamp(stamp, { cwd: REPO_ROOT, merge_tree: stamp.merge_tree, catalog_digest: stamp.catalog_digest }).ok, true)
    // The recording is an OUTPUT of the real derivation: replaying it is not a fixture.
    const replay = JSON.parse(readFileSync(join(ctx.transcriptDir, 'census-replay-1.json'), 'utf8'))
    assert.equal(replay.schema, REPLAY_SCHEMA)
    assert.equal(replay.plan_digest, plan.identity.plan_digest)
    assert.equal(replay.merge_tree, plan.identity.merge_tree_sha)
    assert.equal(replay.results.length, 11)
    assert.match(replay.results[0].evidence, /^census-evidence-1\.json#/)
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
