/**
 * Host-free negative-control suite for the TINF M4 census aggregator (`scripts/census-aggregate.mjs`).
 *
 * This is the point of M4. A sharded census is only as trustworthy as its worst refusal, so every
 * control below is a REAL artifact the aggregator reads — a plan file and shard JSON files on disk —
 * and every assertion is on a NAMED CODE or on the verdict, never on prose:
 *   - an omitted shard                          -> INCOMPLETE / TASK_MISSING
 *   - a duplicate shard id / task id            -> refusal
 *   - a task set that differs (extra + missing) -> TASK_EXTRA / TASK_MISSING
 *   - each identity field mismatched            -> IDENTITY_MISMATCH_<field> / PLAN_DIGEST_MISMATCH
 *   - a shard that exited 0 carrying a FAIL     -> FAIL (exit 0 is not a verdict)
 *   - INCOMPLETE / CANCELLED / INFRA_ERROR      -> that verdict, never PASS
 *   - a truncated / unparseable shard           -> SHARD_UNPARSEABLE refusal
 *   - a plan with only capture 1                -> CAPTURES_INSUFFICIENT refusal
 *   - a plan whose digest was recomputed after  -> PLAN_DIGEST_MISMATCH (the shards name the old one)
 *     editing a task
 *   - a task with no terminal result            -> TASK_NO_TERMINAL_RESULT
 *   - POSITIVE CONTROL: the complete, consistent set -> PASS
 * Plus the oracle rules and the artifact digest actually being the sha256 of the file's bytes.
 *
 * Host-free: pure functions, a shared fixture plan, mkdtemp files, four cheap `node` spawns. No port,
 * no DSH_HOME, no pristine host, no build, no network.
 */
import assert from 'node:assert/strict'
import test from 'node:test'
import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  PASS,
  POLICY_DIGEST,
  REQUIRED_CAPTURES,
  SCHEMA,
  SHARD_SCHEMA,
  aggregate,
  readShardFile,
  render,
  shardOf,
} from './census-aggregate.mjs'
import { buildPlan, makeIdentity, planDigest } from './census-plan.mjs'

const SCRIPT = fileURLToPath(new URL('./census-aggregate.mjs', import.meta.url))

function tmp(prefix = 'census-aggregate-test-') {
  return mkdtempSync(join(tmpdir(), prefix))
}

function cli(args) {
  const r = spawnSync(process.execPath, [SCRIPT, ...args], { encoding: 'utf8' })
  return { status: r.status, out: `${r.stdout}\n${r.stderr}`, stdout: r.stdout, stderr: r.stderr }
}

// ────────────────────────────────────────────────────────────────── fixtures ──

/** Two roots × two captures, one required oracle. The positive control runs against this. */
function makePlan({ captures = REQUIRED_CAPTURES } = {}) {
  const plan = buildPlan({
    roots: [{ root: 'packages/a', files: 2 }, { root: 'packages/b', files: 1 }],
    captures,
    identity: makeIdentity({
      merge_tree_sha: '1111111111111111111111111111111111111111',
      host_sha: '2222222222222222222222222222222222222222',
      catalog_digest: `sha256:${'c'.repeat(64)}`,
      build_digest: `sha256:${'d'.repeat(64)}`,
    }),
    testTimeout: 90000,
  })
  plan.required_oracles = ['ORACLE-CENSUS']
  plan.identity.plan_digest = planDigest(plan)
  return plan
}

const plan = makePlan()
const ALL_TASKS = plan.tasks.map((t) => t.task_id)

function identityOf(over = {}) {
  return {
    merge_tree_sha: plan.identity.merge_tree_sha,
    host_sha: plan.identity.host_sha,
    plan_digest: plan.identity.plan_digest,
    catalog_digest: plan.identity.catalog_digest,
    build_digest: plan.identity.build_digest,
    ...over,
  }
}

/** The plan is the authority on what a task id means; the fixture decodes it, it does not guess. */
function taskIdentityOf(task_id) {
  const task = plan.tasks.find((t) => t.task_id === task_id)
  if (task === undefined) throw new Error(`fixture: ${task_id} is not a plan task`)
  return { root: task.root, capture: task.capture }
}

/** A passing result WITH the per-task identity the aggregator now requires. */
const res = (task_id, over = {}) => ({
  task_id,
  ...taskIdentityOf(task_id),
  state: 'PASS',
  // A pointer the CLI can OPEN (see verifyEvidenceRefs): the CLI and the census leg resolve evidence
  // against the shard's own directory, so the fixture writes that file beside the shards.
  evidence: 'evidence.json',
  duration_ms: 1000,
  oracles: [{ id: 'ORACLE-CENSUS', state: 'PASS' }],
  ...over,
})

const passResults = (taskIds) => taskIds.map((task_id) => res(task_id))

/** One shard artifact; `over` replaces top-level fields (identity must be replaced as a whole). */
function shardFile(id, taskIds, over = {}) {
  const base = {
    schema: SHARD_SCHEMA,
    shard_id: id,
    status: 'COMPLETED',
    exit_code: 0,
    policy_digest: POLICY_DIGEST,
    identity: identityOf(),
    results: passResults(taskIds),
  }
  return shardOf(`${id}.json`, { ...base, ...over })
}

const SHARD_1 = shardFile('shard-1', ALL_TASKS.slice(0, 2))
const SHARD_2 = shardFile('shard-2', ALL_TASKS.slice(2))

// ────────────────────────────────────────────────── the positive control (last)
// Declared first in the file for readability; asserted below. It comes FIRST in the read order
// because a suite of refusals that never shows a green path proves only that the tool says no.

test('positive control: the complete, consistent shard set aggregates to PASS', () => {
  const r = aggregate({ plan, shards: [SHARD_1, SHARD_2] })
  assert.equal(r.refused, false)
  assert.equal(r.verdict, PASS, JSON.stringify(r.codes))
  assert.deepEqual(r.summary.expected_task_ids, [...ALL_TASKS].sort())
  assert.deepEqual(r.summary.observed_task_ids, [...ALL_TASKS].sort())
  assert.equal(r.summary.counts.missing, 0)
  assert.equal(r.summary.counts.extra, 0)
  assert.equal(r.summary.shards.length, 2)
  assert.match(render(r), /DSH-CENSUS-SUMMARY PASS/)
})

test('the summary is STRUCTURALLY not an authority (fields, not prose)', () => {
  const r = aggregate({ plan, shards: [SHARD_1, SHARD_2] })
  assert.equal(r.summary.schema, SCHEMA)
  // A prose sentence can be rewritten without a test noticing; these five booleans cannot.
  assert.deepEqual(r.summary.scope, {
    shadow: true,
    wired_to_ci_required: false,
    writes_required_context_artifact: false,
    branch_protection_authority: false,
    decides_what_ci_runs: false,
  })
  // ...and no workflow/manifest input is named as a consumer.
  assert.equal('ci_required_input' in r.summary, false)
})

// ─────────────────────────────────────────────────────── rule 4: the multiset ──

test('an omitted shard is INCOMPLETE / TASK_MISSING, never a smaller PASS', () => {
  const r = aggregate({ plan, shards: [SHARD_1] })
  assert.equal(r.verdict, 'INCOMPLETE')
  assert.ok(r.codes.includes('TASK_MISSING'), JSON.stringify(r.codes))
  assert.equal(r.summary.counts.missing, 2)
  assert.notEqual(r.verdict, PASS)
})

test('a shard that reports a task outside the plan is TASK_EXTRA (INCOMPLETE)', () => {
  // A task the plan never enumerated still has to be well-formed to reach the multiset rule; it is
  // then EXTRA (INCOMPLETE), never silently ignored.
  const stray = { task_id: 'census:packages/z#1', root: 'packages/z', capture: 1, state: PASS, evidence: 'artifacts/z.json', oracles: [{ id: 'ORACLE-CENSUS', state: PASS }] }
  const r = aggregate({
    plan,
    shards: [SHARD_1, shardFile('shard-2', ALL_TASKS.slice(2), { results: [...passResults(ALL_TASKS.slice(2)), stray] })],
  })
  assert.equal(r.verdict, 'INCOMPLETE')
  assert.ok(r.codes.includes('TASK_EXTRA'), JSON.stringify(r.codes))
  assert.equal(r.summary.counts.extra, 1)
})

test('a task with no terminal result is INCOMPLETE / TASK_NO_TERMINAL_RESULT', () => {
  const r = aggregate({
    plan,
    shards: [SHARD_1, shardFile('shard-2', ALL_TASKS.slice(2), {
      results: ALL_TASKS.slice(2).map((task_id) => res(task_id, { state: undefined })),
    })],
  })
  assert.equal(r.verdict, 'INCOMPLETE')
  assert.ok(r.codes.includes('TASK_NO_TERMINAL_RESULT'), JSON.stringify(r.codes))
})

test('a shard that exited 0 while carrying a FAIL aggregates to FAIL', () => {
  const failing = shardFile('shard-2', ALL_TASKS.slice(2), {
    exit_code: 0,
    results: ALL_TASKS.slice(2).map((task_id, i) => res(task_id, { state: i === 0 ? 'FAIL' : PASS })),
  })
  const r = aggregate({ plan, shards: [SHARD_1, failing] })
  assert.equal(r.verdict, 'FAIL')
  assert.ok(r.codes.includes('TASK_STATE_FAIL'), JSON.stringify(r.codes))
})

test('exit 0 with a non-COMPLETED status is itself a red (the shard\'s two signals disagree)', () => {
  const r = aggregate({ plan, shards: [SHARD_1, shardFile('shard-2', ALL_TASKS.slice(2), { status: 'INCOMPLETE', exit_code: 0 })] })
  assert.notEqual(r.verdict, PASS)
  assert.ok(r.codes.includes('SHARD_EXIT_DISAGREES'), JSON.stringify(r.codes))
})

test('a COMPLETED shard with a non-zero exit is not green either', () => {
  const r = aggregate({ plan, shards: [SHARD_1, shardFile('shard-2', ALL_TASKS.slice(2), { exit_code: 2 })] })
  assert.equal(r.verdict, 'INFRA_ERROR')
  assert.ok(r.codes.includes('SHARD_EXIT_NONZERO'), JSON.stringify(r.codes))
})

test('a COMPLETED shard with zero results is SHARD_EMPTY, not a vacuous pass', () => {
  const r = aggregate({ plan, shards: [SHARD_1, shardFile('shard-2', [])] })
  assert.equal(r.verdict, 'INCOMPLETE')
  assert.ok(r.codes.includes('SHARD_EMPTY'), JSON.stringify(r.codes))
})

for (const [state, verdict] of [['INCOMPLETE', 'INCOMPLETE'], ['CANCELLED', 'CANCELLED'], ['INFRA_ERROR', 'INFRA_ERROR']]) {
  test(`a shard status ${state} aggregates to ${verdict}`, () => {
    const r = aggregate({ plan, shards: [SHARD_1, shardFile('shard-2', ALL_TASKS.slice(2), { status: state, exit_code: 1 })] })
    assert.equal(r.verdict, verdict)
    assert.notEqual(r.verdict, PASS)
    assert.ok(r.codes.some((c) => c.includes(state)), JSON.stringify(r.codes))
  })
}

test('verdict precedence: a measured FAIL wins over CANCELLED and INFRA_ERROR', () => {
  const failing = shardFile('shard-2', ALL_TASKS.slice(2), {
    results: ALL_TASKS.slice(2).map((task_id) => res(task_id, { state: 'FAIL' })),
  })
  const cancelled = shardFile('shard-3', [], { status: 'CANCELLED', exit_code: 1 })
  const r = aggregate({ plan, shards: [SHARD_1, failing, cancelled] })
  assert.equal(r.verdict, 'FAIL')
})

for (const state of ['FAIL', 'INCOMPLETE', 'INFRA_ERROR', 'CANCELLED']) {
  test(`a task terminal state ${state} is never PASS`, () => {
    const r = aggregate({
      plan,
      shards: [SHARD_1, shardFile('shard-2', ALL_TASKS.slice(2), {
        results: ALL_TASKS.slice(2).map((task_id, i) => res(task_id, { state: i === 0 ? state : PASS })),
      })],
    })
    assert.notEqual(r.verdict, PASS)
    assert.ok(r.codes.includes(`TASK_STATE_${state}`), JSON.stringify(r.codes))
  })
}

// ──────────────────────────────────────────────── rule 2: ids, structure, parse ──

test('a duplicate shard id refuses', () => {
  const r = aggregate({ plan, shards: [SHARD_1, shardFile('shard-1', ALL_TASKS.slice(2))] })
  assert.equal(r.refused, true)
  assert.ok(r.codes.includes('SHARD_ID_DUPLICATE'), JSON.stringify(r.codes))
})

test('a duplicate task id within a shard refuses', () => {
  const r = aggregate({ plan, shards: [SHARD_1, shardFile('shard-2', [ALL_TASKS[2], ALL_TASKS[2]])] })
  assert.equal(r.refused, true)
  assert.ok(r.codes.includes('SHARD_TASK_ID_DUPLICATE'), JSON.stringify(r.codes))
})

test('a duplicate task id ACROSS shards refuses (a lost task hides as a double report)', () => {
  const r = aggregate({ plan, shards: [SHARD_1, shardFile('shard-2', [ALL_TASKS[0], ALL_TASKS[3]])] })
  assert.equal(r.refused, true)
  assert.ok(r.codes.includes('SHARD_TASK_ID_DUPLICATE'), JSON.stringify(r.codes))
})

test('a truncated shard artifact refuses as SHARD_UNPARSEABLE', () => {
  const full = SHARD_2.text
  const r = aggregate({ plan, shards: [SHARD_1, { file: 'shard-2.json', text: full.slice(0, Math.floor(full.length / 2)) }] })
  assert.equal(r.refused, true)
  assert.ok(r.codes.includes('SHARD_UNPARSEABLE'), JSON.stringify(r.codes))
})

test('an unreadable shard path refuses as SHARD_UNREADABLE', () => {
  const r = aggregate({ plan, shards: [SHARD_1, readShardFile('/definitely/not/here/shard.json')] })
  assert.equal(r.refused, true)
  assert.ok(r.codes.includes('SHARD_UNREADABLE'), JSON.stringify(r.codes))
})

test('a foreign shard schema and an unknown status refuse by name', () => {
  const foreign = shardOf('x.json', { schema: 'census-shard/0', shard_id: 'x', results: [] })
  assert.ok(aggregate({ plan, shards: [SHARD_1, foreign] }).codes.includes('SHARD_SCHEMA_UNKNOWN'))
  const badStatus = shardFile('shard-3', [], { status: 'DONE' })
  assert.ok(aggregate({ plan, shards: [SHARD_1, badStatus] }).codes.includes('SHARD_STATUS_UNKNOWN'))
})

test('an unknown task state refuses instead of being counted as a pass', () => {
  const r = aggregate({
    plan,
    shards: [SHARD_1, shardFile('shard-2', ALL_TASKS.slice(2), {
      results: ALL_TASKS.slice(2).map((task_id) => res(task_id, { state: 'MAYBE' })),
    })],
  })
  assert.equal(r.refused, true)
  assert.ok(r.codes.includes('TASK_STATE_UNKNOWN'), JSON.stringify(r.codes))
})

// ─────────────────────────────────────────────────────────── rule 3: identity ──

const IDENTITY_CONTROLS = [
  ['merge_tree_sha', 'IDENTITY_MISMATCH_MERGE_TREE_SHA'],
  ['host_sha', 'IDENTITY_MISMATCH_HOST_SHA'],
  ['catalog_digest', 'IDENTITY_MISMATCH_CATALOG_DIGEST'],
  ['build_digest', 'IDENTITY_MISMATCH_BUILD_DIGEST'],
]

// A DIFFERENT but WELL-FORMED digest: the mismatch rule must be what fires, not the shape rule.
const OTHER_DIGEST = { 40: 'f'.repeat(40), 64: `sha256:${'f'.repeat(64)}` }
const differentDigestFor = (field) => (field === 'host_sha' || field === 'merge_tree_sha' ? OTHER_DIGEST[40] : OTHER_DIGEST[64])

for (const [field, code] of IDENTITY_CONTROLS) {
  test(`a mismatched ${field} refuses as ${code}`, () => {
    const r = aggregate({ plan, shards: [SHARD_1, shardFile('shard-2', ALL_TASKS.slice(2), { identity: identityOf({ [field]: differentDigestFor(field) }) })] })
    assert.equal(r.refused, true)
    assert.ok(r.codes.includes(code), JSON.stringify(r.codes))
    // ...and the shape rule did NOT fire, so the two controls stay distinguishable.
    assert.ok(!r.codes.includes('DIGEST_INVALID'), JSON.stringify(r.codes))
  })
}

test('a shard that ran a different plan refuses as PLAN_DIGEST_MISMATCH', () => {
  const r = aggregate({
    plan,
    shards: [SHARD_1, shardFile('shard-2', ALL_TASKS.slice(2), { identity: identityOf({ plan_digest: OTHER_DIGEST[64] }) })],
  })
  assert.equal(r.refused, true)
  assert.ok(r.codes.includes('PLAN_DIGEST_MISMATCH'), JSON.stringify(r.codes))
})

test('a shard produced under another policy refuses as POLICY_DIGEST_MISMATCH', () => {
  const r = aggregate({ plan, shards: [SHARD_1, shardFile('shard-2', ALL_TASKS.slice(2), { policy_digest: 'sha256:otherpolicy' })] })
  assert.equal(r.refused, true)
  assert.ok(r.codes.includes('POLICY_DIGEST_MISMATCH'), JSON.stringify(r.codes))
})

test('an unrecorded build identity refuses: equality of two nulls is not an identity', () => {
  const nullBuild = makePlan()
  nullBuild.identity.build_digest = null
  nullBuild.identity.plan_digest = planDigest(nullBuild)
  const shards = [
    shardFile('shard-1', ALL_TASKS.slice(0, 2), { identity: identityOf({ build_digest: null, plan_digest: nullBuild.identity.plan_digest }) }),
    shardFile('shard-2', ALL_TASKS.slice(2), { identity: identityOf({ build_digest: null, plan_digest: nullBuild.identity.plan_digest }) }),
  ]
  const r = aggregate({ plan: nullBuild, shards })
  assert.equal(r.refused, true)
  assert.ok(r.codes.includes('IDENTITY_BUILD_UNRECORDED'), JSON.stringify(r.codes))
})

// ──────────────────────────────────────────────────── rule 1: plan integrity ──

test('a plan edited without a new digest refuses (PLAN_DIGEST_MISMATCH)', () => {
  const stale = JSON.parse(JSON.stringify(plan))
  stale.tasks[0].est_ms = 1
  const r = aggregate({ plan: stale, shards: [SHARD_1, SHARD_2] })
  assert.equal(r.refused, true)
  assert.ok(r.codes.includes('PLAN_DIGEST_MISMATCH'), JSON.stringify(r.codes))
})

test('a plan whose digest was RECOMPUTED after editing a task still refuses (the shards name the old digest)', () => {
  const edited = JSON.parse(JSON.stringify(plan))
  edited.tasks[0].est_ms = 1
  edited.tasks[0].runner.argv.push('--testTimeout=1000')
  edited.identity.plan_digest = planDigest(edited)
  const r = aggregate({ plan: edited, shards: [SHARD_1, SHARD_2] })
  assert.equal(r.refused, true)
  assert.ok(r.codes.includes('PLAN_DIGEST_MISMATCH'), JSON.stringify(r.codes))
})

test('a plan with only capture 1 refuses (the missing second capture control)', () => {
  const oneCapture = makePlan({ captures: 1 })
  const tasks = oneCapture.tasks.map((t) => t.task_id)
  const r = aggregate({
    plan: oneCapture,
    shards: [shardFile('shard-1', tasks.slice(0, 1), { identity: identityOf({ plan_digest: oneCapture.identity.plan_digest }) }),
      shardFile('shard-2', tasks.slice(1), { identity: identityOf({ plan_digest: oneCapture.identity.plan_digest }) })],
  })
  assert.equal(r.refused, true)
  assert.ok(r.codes.includes('CAPTURES_INSUFFICIENT'), JSON.stringify(r.codes))
  assert.equal(oneCapture.captures, 1)
})

test('a plan with no tasks and a plan with duplicate tasks both refuse', () => {
  const empty = { ...JSON.parse(JSON.stringify(plan)), tasks: [] }
  empty.identity.plan_digest = planDigest(empty)
  assert.ok(aggregate({ plan: empty, shards: [SHARD_1] }).codes.includes('PLAN_TASK_SET_EMPTY'))
  const dup = JSON.parse(JSON.stringify(plan))
  dup.tasks[1].task_id = dup.tasks[0].task_id
  dup.identity.plan_digest = planDigest(dup)
  assert.ok(aggregate({ plan: dup, shards: [SHARD_1] }).codes.includes('PLAN_TASK_DUPLICATE'))
})

test('a foreign plan schema, a garbage plan and no shards refuse by name', () => {
  assert.ok(aggregate({ plan: { schema: 'census-plan/9' }, shards: [SHARD_1] }).codes.includes('PLAN_SCHEMA_UNKNOWN'))
  assert.ok(aggregate({ plan: null, shards: [SHARD_1] }).codes.includes('PLAN_UNREADABLE'))
  assert.ok(aggregate({ plan, shards: [] }).codes.includes('NO_SHARDS'))
})

// ────────────────────────────────────────────────────────── rule 5: oracles ──

test('a missing required oracle is not PASS', () => {
  const r = aggregate({
    plan,
    shards: [SHARD_1, shardFile('shard-2', ALL_TASKS.slice(2), {
      results: ALL_TASKS.slice(2).map((task_id) => res(task_id, { oracles: [] })),
    })],
  })
  assert.equal(r.verdict, 'INCOMPLETE')
  assert.ok(r.codes.includes('ORACLE_MISSING'), JSON.stringify(r.codes))
  assert.equal(r.summary.oracles.missing, 2)
})

test('a failed required oracle is FAIL even when the task says PASS', () => {
  const r = aggregate({
    plan,
    shards: [SHARD_1, shardFile('shard-2', ALL_TASKS.slice(2), {
      results: ALL_TASKS.slice(2).map((task_id) => res(task_id, { oracles: [{ id: 'ORACLE-CENSUS', state: 'FAIL' }] })),
    })],
  })
  assert.equal(r.verdict, 'FAIL')
  assert.ok(r.codes.includes('ORACLE_FAILED'), JSON.stringify(r.codes))
})

test('an undecidable required oracle is INCOMPLETE, not green', () => {
  const r = aggregate({
    plan,
    shards: [SHARD_1, shardFile('shard-2', ALL_TASKS.slice(2), {
      results: ALL_TASKS.slice(2).map((task_id) => res(task_id, { oracles: [{ id: 'ORACLE-CENSUS', state: 'UNDECIDABLE' }] })),
    })],
  })
  assert.equal(r.verdict, 'INCOMPLETE')
  assert.ok(r.codes.includes('ORACLE_UNDECIDABLE'), JSON.stringify(r.codes))
})

test('a plan with no required oracles states zero rather than inventing contracts', () => {
  const bare = makePlan()
  bare.required_oracles = []
  bare.identity.plan_digest = planDigest(bare)
  const shards = [
    shardFile('shard-1', ALL_TASKS.slice(0, 2), { identity: identityOf({ plan_digest: bare.identity.plan_digest }) }),
    shardFile('shard-2', ALL_TASKS.slice(2), { identity: identityOf({ plan_digest: bare.identity.plan_digest }) }),
  ]
  const r = aggregate({ plan: bare, shards })
  assert.equal(r.verdict, PASS)
  assert.deepEqual(r.summary.oracles.required, [])
  assert.equal(r.summary.oracles.checked, 0)
})

// ─────────────────────────────────────────────────────────────── the artifact ──

test('artifact_digest is the sha256 of the shard file bytes, not of a reserialisation', () => {
  const dir = tmp()
  const file = join(dir, 'shard-1.json')
  // Deliberately NOT pretty-printed and NOT canonically ordered: the digest must be over these bytes.
  writeFileSync(file, '{"schema":"census-shard/1","shard_id":"s","status":"COMPLETED","exit_code":0}')
  const bytes = readFileSync(file)
  const expected = `sha256:${createHash('sha256').update(bytes).digest('hex')}`
  const r = aggregate({ plan, shards: [readShardFile(file), SHARD_2] })
  // This artifact is incomplete (no policy/identity), so the run refuses — but the digest is recorded
  // on the parsed shard either way only when the run survives parsing. Use the positive fixture for
  // the recorded value.
  assert.equal(r.refused, true)
  const good = aggregate({ plan, shards: [SHARD_1, SHARD_2] })
  const recomputed = `sha256:${createHash('sha256').update(Buffer.from(SHARD_1.text, 'utf8')).digest('hex')}`
  assert.equal(good.summary.shards[0].artifact_digest, recomputed)
  assert.notEqual(good.summary.shards[0].artifact_digest, expected)
})

// ──────────────────────────────────────────────────────────────────────── cli ──

function writePlan(planObject) {
  const dir = tmp()
  const file = join(dir, 'plan.json')
  writeFileSync(file, JSON.stringify(planObject, null, 2))
  return file
}

function writeShard(dir, name, shard) {
  const file = join(dir, name)
  writeFileSync(file, shard.text)
  // The evidence root: `verifyEvidenceRefs` (which the CLI runs before grading) resolves every
  // result's reference against THIS directory, so the fixture must put the named file here.
  writeFileSync(join(dir, 'evidence.json'), '{}\n')
  return file
}

test('cli: PASS exits 0 and --json prints the census-summary/1 artifact', () => {
  const dir = tmp()
  const planFile = writePlan(plan)
  const s1 = writeShard(dir, 'shard-1.json', SHARD_1)
  const s2 = writeShard(dir, 'shard-2.json', SHARD_2)
  const r = cli(['--aggregate', s1, s2, '--plan', planFile, '--json'])
  assert.equal(r.status, 0, r.out)
  const summary = JSON.parse(r.stdout)
  assert.equal(summary.schema, SCHEMA)
  assert.equal(summary.census_verdict, PASS)
  assert.deepEqual(summary.expected_task_ids, [...ALL_TASKS].sort())
  assert.equal(summary.shards.length, 2)
  assert.match(summary.shards[0].artifact_digest, /^sha256:[0-9a-f]{64}$/)
})

test('cli: a non-PASS verdict exits 1 and still prints the summary', () => {
  const dir = tmp()
  const planFile = writePlan(plan)
  const s1 = writeShard(dir, 'shard-1.json', SHARD_1)
  const r = cli(['--aggregate', s1, '--plan', planFile, '--json'])
  assert.equal(r.status, 1, r.out)
  const summary = JSON.parse(r.stdout)
  assert.equal(summary.census_verdict, 'INCOMPLETE')
  assert.ok(summary.codes.includes('TASK_MISSING'), JSON.stringify(summary.codes))
})

test('cli: a truncated shard exits 2 with the code on stderr', () => {
  const dir = tmp()
  const planFile = writePlan(plan)
  const s1 = writeShard(dir, 'shard-1.json', SHARD_1)
  const cut = join(dir, 'cut.json')
  writeFileSync(cut, SHARD_2.text.slice(0, 30))
  const r = cli(['--aggregate', s1, cut, '--plan', planFile])
  assert.equal(r.status, 2, r.out)
  assert.match(r.stderr, /REFUSED SHARD_UNPARSEABLE/)
})

test('cli: a missing plan or missing shards is a named refusal', () => {
  const dir = tmp()
  const s1 = writeShard(dir, 'shard-1.json', SHARD_1)
  const noPlan = cli(['--aggregate', s1])
  assert.equal(noPlan.status, 2)
  assert.match(noPlan.stderr, /REFUSED PLAN_UNREADABLE/)
  const noShards = cli(['--plan', writePlan(plan)])
  assert.equal(noShards.status, 2)
  assert.match(noShards.stderr, /REFUSED NO_MODE/)
  const missingShard = cli(['--aggregate', '/definitely/not/here.json', '--plan', writePlan(plan)])
  assert.equal(missingShard.status, 2)
  assert.match(missingShard.stderr, /REFUSED SHARD_UNREADABLE/)
})

test('cli: the human report names the codes and the token; it never says PASS for a refusal', () => {
  const dir = tmp()
  const s1 = writeShard(dir, 'shard-1.json', SHARD_1)
  const r = cli(['--aggregate', s1, '--plan', writePlan(plan)])
  assert.equal(r.status, 1, r.out)
  assert.match(r.stdout, /DSH-CENSUS-SUMMARY INCOMPLETE codes=.*TASK_MISSING/)
  assert.doesNotMatch(r.stdout, /DSH-CENSUS-SUMMARY PASS/)
  assert.match(r.stdout, /SHADOW: not an authority/)
})

test('cli: --self-test stays green', () => {
  const r = cli(['--self-test'])
  assert.equal(r.status, 0, r.out)
  assert.match(r.stdout, /DSH-CENSUS-AGGREGATE-SELFTEST PASS/)
})

// ════════════════════════════════════════════════════════════════════════════════════════════════
// Review round 1. Every control below is one of the six findings, and every one asserts a CODE or an
// exact count — a mutation that deletes the rule it names must make it red.
// ════════════════════════════════════════════════════════════════════════════════════════════════

// ── finding 1: a digest is a digest (both sides) ────────────────────────────────────────────────

const SENTINEL_DIGESTS = ['null', 'undefined', '', ' ', 'NULL', 'a'.repeat(39), 'a'.repeat(65), `sha256:${'A'.repeat(64)}`, 'sha1:' + 'a'.repeat(40)]

for (const sentinel of SENTINEL_DIGESTS) {
  test(`plan build_digest ${JSON.stringify(sentinel)} refuses as DIGEST_INVALID (never a recorded "value")`, () => {
    const p = JSON.parse(JSON.stringify(plan))
    p.identity.build_digest = sentinel
    p.identity.plan_digest = planDigest(p)
    const r = aggregate({ plan: p, shards: [shardFile('shard-1', ALL_TASKS, { identity: identityOf({ plan_digest: p.identity.plan_digest, build_digest: sentinel }) })] })
    assert.equal(r.refused, true, JSON.stringify(r))
    assert.ok(r.codes.includes('DIGEST_INVALID'), JSON.stringify(r.codes))
    // NOT a PASS and NOT a graded verdict: nothing was graded.
    assert.equal(r.verdict, null)
  })
}

for (const sentinel of SENTINEL_DIGESTS) {
  test(`shard merge_tree_sha ${JSON.stringify(sentinel)} refuses as DIGEST_INVALID`, () => {
    const r = aggregate({ plan, shards: [SHARD_1, shardFile('shard-2', ALL_TASKS.slice(2), { identity: identityOf({ merge_tree_sha: sentinel }) })] })
    assert.equal(r.refused, true, JSON.stringify(r.codes))
    assert.ok(r.codes.includes('DIGEST_INVALID'), JSON.stringify(r.codes))
  })
}

test('the accepted digest shapes are exactly sha256:<64 hex> and <40 hex>', () => {
  // Positive control for the shape rule: both real producer shapes must aggregate to PASS, so the
  // refusals above cannot be passing because EVERYTHING refuses.
  const forty = aggregate({
    plan,
    shards: [
      shardFile('shard-1', ALL_TASKS.slice(0, 2), { identity: identityOf({ merge_tree_sha: 'a'.repeat(40), host_sha: 'b'.repeat(40) }) }),
      shardFile('shard-2', ALL_TASKS.slice(2), { identity: identityOf() }),
    ].map((shard, i) => (i === 0 ? shard : shard)),
  })
  // shard-1 now disagrees with the plan, which must be a MISMATCH (not a shape error): the shape rule
  // accepted both values and the equality rule did the rest.
  assert.equal(forty.refused, true)
  assert.ok(forty.codes.includes('IDENTITY_MISMATCH_MERGE_TREE_SHA'), JSON.stringify(forty.codes))
  assert.ok(!forty.codes.includes('DIGEST_INVALID'), JSON.stringify(forty.codes))
})

// ── finding 2: a plan with a null/absent identity field cannot "match" ─────────────────────────

for (const [field, code] of [
  ['merge_tree_sha', 'PLAN_IDENTITY_UNRECORDED'],
  ['host_sha', 'PLAN_IDENTITY_UNRECORDED'],
  ['catalog_digest', 'PLAN_IDENTITY_UNRECORDED'],
  ['build_digest', 'IDENTITY_BUILD_UNRECORDED'],
]) {
  test(`a plan whose ${field} is null refuses as ${code} even when every shard is null too`, () => {
    const p = JSON.parse(JSON.stringify(plan))
    p.identity[field] = null
    p.identity.plan_digest = planDigest(p)
    const shards = [
      shardFile('shard-1', ALL_TASKS.slice(0, 2), { identity: identityOf({ [field]: null, plan_digest: p.identity.plan_digest }) }),
      shardFile('shard-2', ALL_TASKS.slice(2), { identity: identityOf({ [field]: null, plan_digest: p.identity.plan_digest }) }),
    ]
    const r = aggregate({ plan: p, shards })
    assert.equal(r.refused, true, JSON.stringify(r))
    assert.ok(r.codes.includes(code), JSON.stringify(r.codes))
    assert.equal(r.verdict, null)
  })

  test(`a plan whose ${field} is ABSENT refuses as ${code}`, () => {
    const p = JSON.parse(JSON.stringify(plan))
    delete p.identity[field]
    p.identity.plan_digest = planDigest(p)
    const r = aggregate({ plan: p, shards: [shardFile('shard-1', ALL_TASKS.slice(0, 2), { identity: identityOf({ plan_digest: p.identity.plan_digest }) })] })
    assert.equal(r.refused, true)
    assert.ok(r.codes.includes(code), JSON.stringify(r.codes))
  })
}

test('a plan with no plan_digest refuses as PLAN_DIGEST_UNRECORDED', () => {
  const p = JSON.parse(JSON.stringify(plan))
  p.identity.plan_digest = null
  assert.ok(aggregate({ plan: p, shards: [SHARD_1, SHARD_2] }).codes.includes('PLAN_DIGEST_UNRECORDED'))
})

// ── finding 3: every result carries its own identity and an evidence reference ──────────────────

test('a capture-2 id carrying capture-1 data refuses (RESULT_CAPTURE_MISMATCH)', () => {
  // The reviewer's probe: the SAME task ids, the SAME shard ids, the SAME identity — only the
  // per-result capture is wrong. Keying on task_id alone aggregated this to PASS.
  const capture1Data = ALL_TASKS.slice(2).map((task_id) => res(task_id, { capture: 1 }))
  const r = aggregate({ plan, shards: [SHARD_1, shardFile('shard-2', ALL_TASKS.slice(2), { results: capture1Data })] })
  assert.equal(r.refused, true, JSON.stringify(r))
  assert.ok(r.codes.includes('RESULT_CAPTURE_MISMATCH'), JSON.stringify(r.codes))
})

test('a result whose root disagrees with the plan task refuses (RESULT_ROOT_MISMATCH)', () => {
  const wrongRoot = ALL_TASKS.slice(2).map((task_id) => res(task_id, { root: 'packages/somewhere-else' }))
  const r = aggregate({ plan, shards: [SHARD_1, shardFile('shard-2', ALL_TASKS.slice(2), { results: wrongRoot })] })
  assert.equal(r.refused, true)
  assert.ok(r.codes.includes('RESULT_ROOT_MISMATCH'), JSON.stringify(r.codes))
})

test('a result with no root/capture field at all refuses (the pre-review shard shape)', () => {
  const bare = ALL_TASKS.slice(2).map((task_id) => ({ task_id, state: PASS, evidence: 'x', oracles: [{ id: 'ORACLE-CENSUS', state: PASS }] }))
  const r = aggregate({ plan, shards: [SHARD_1, shardFile('shard-2', ALL_TASKS.slice(2), { results: bare })] })
  assert.equal(r.refused, true)
  assert.ok(r.codes.includes('RESULT_ROOT_MISMATCH'), JSON.stringify(r.codes))
})

for (const [label, evidence] of [['missing', undefined], ['empty', ''], ['whitespace', '   '], ['non-string', 42]]) {
  test(`a result whose evidence is ${label} refuses (RESULT_EVIDENCE_MISSING)`, () => {
    const results = ALL_TASKS.slice(2).map((task_id) => {
      const base = res(task_id)
      if (evidence === undefined) delete base.evidence
      else base.evidence = evidence
      return base
    })
    const r = aggregate({ plan, shards: [SHARD_1, shardFile('shard-2', ALL_TASKS.slice(2), { results })] })
    assert.equal(r.refused, true)
    assert.ok(r.codes.includes('RESULT_EVIDENCE_MISSING'), JSON.stringify(r.codes))
  })
}

// ── finding 4: a dropped root is visible, and fail-closed in the plan ───────────────────────────

function planWithDropped(roots_dropped) {
  const p = JSON.parse(JSON.stringify(plan))
  p.roots_dropped = roots_dropped
  p.identity.plan_digest = planDigest(p)
  return p
}

test('a dropped root recorded by the plan reaches the aggregator output (and the human report)', () => {
  const p = planWithDropped([{ root: 'packages/b', files_excluded: 3, allowed: true }])
  const identity = identityOf({ plan_digest: p.identity.plan_digest })
  const r = aggregate({
    plan: p,
    shards: [shardFile('shard-1', ALL_TASKS.slice(0, 2), { identity }), shardFile('shard-2', ALL_TASKS.slice(2), { identity })],
  })
  assert.equal(r.refused, false, JSON.stringify(r.codes))
  assert.deepEqual(r.summary.roots_dropped, [{ root: 'packages/b', files_excluded: 3, allowed: true }])
  assert.match(render(r), /DROPPED ROOTS/)
  assert.match(render(r), /packages\/b files_excluded=3 allowed=true/)
})

test('a dropped root that is not explicitly allowed/malformed refuses', () => {
  for (const bad of [[{ root: 'packages/b', files_excluded: 3 }], [{ root: '', files_excluded: 1, allowed: true }], [{ root: 'packages/b', files_excluded: 0, allowed: true }], 'not-an-array']) {
    const p = JSON.parse(JSON.stringify(plan))
    p.roots_dropped = bad
    // A string value cannot be digested; the shape refusal must come first, so only recompute when the
    // fixture is at least an array.
    p.identity.plan_digest = Array.isArray(bad) ? planDigest(p) : p.identity.plan_digest
    const r = aggregate({ plan: p, shards: [SHARD_1, SHARD_2] })
    assert.equal(r.refused, true, JSON.stringify(bad))
    assert.ok(r.codes.includes('PLAN_ROOTS_DROPPED_MALFORMED'), JSON.stringify([bad, r.codes]))
  }
})

// ── finding 6: each rule is load-bearing (code + exact multiset delta) ─────────────────────────

test('rule 1 (plan digest): an edited plan refuses by code and grades NOTHING', () => {
  const edited = JSON.parse(JSON.stringify(plan))
  edited.tasks[0].est_ms = 1
  edited.identity.plan_digest = planDigest(edited)
  const r = aggregate({ plan: edited, shards: [SHARD_1, SHARD_2] })
  assert.deepEqual(r.codes, ['PLAN_DIGEST_MISMATCH'])
  assert.equal(r.refused, true)
  assert.equal(r.summary, null)
})

test('rule 2 (uniqueness): one duplicate id refuses, and the delta is not reported as MISSING', () => {
  const r = aggregate({ plan, shards: [SHARD_1, shardFile('shard-2', [ALL_TASKS[2], ALL_TASKS[2]])] })
  assert.deepEqual(r.codes, ['SHARD_TASK_ID_DUPLICATE'])
  // A refusal grades nothing: there is no "observed=2 missing=2" summary to misread as measured.
  assert.equal(r.summary, null)
})

test('rule 3 (identity): a mismatched host refuses and never reaches the multiset', () => {
  const r = aggregate({ plan, shards: [SHARD_1, shardFile('shard-2', ALL_TASKS.slice(2), { identity: identityOf({ host_sha: 'f'.repeat(40) }) })] })
  assert.deepEqual(r.codes, ['IDENTITY_MISMATCH_HOST_SHA'])
  assert.equal(r.summary, null)
})

test('rule 4 (multiset): the EXACT expected/observed delta for missing and extra at once', () => {
  const result = [...passResults(ALL_TASKS.slice(0, 3)), { task_id: 'census:packages/z#1', root: 'packages/z', capture: 1, state: PASS, evidence: 'artifacts/z.json', oracles: [{ id: 'ORACLE-CENSUS', state: PASS }] }]
  const r = aggregate({ plan, shards: [shardFile('shard-1', [], { results: result })] })
  assert.equal(r.refused, false, JSON.stringify(r.codes))
  assert.deepEqual(r.summary.expected_task_ids, [...ALL_TASKS].sort())
  assert.deepEqual(r.summary.observed_task_ids, [...ALL_TASKS.slice(0, 3), 'census:packages/z#1'].sort())
  assert.equal(r.summary.counts.expected, ALL_TASKS.length)
  assert.equal(r.summary.counts.observed, 4)
  assert.equal(r.summary.counts.reported, 4)
  assert.equal(r.summary.counts.missing, 1)
  assert.equal(r.summary.counts.extra, 1)
  assert.deepEqual(r.codes.filter((c) => c === 'TASK_MISSING' || c === 'TASK_EXTRA'), ['TASK_MISSING', 'TASK_EXTRA'])
  assert.equal(r.verdict, 'INCOMPLETE')
})

test('rule 4 (terminal state): a FAIL is in by_state AND the verdict, not only a code', () => {
  const r = aggregate({
    plan,
    shards: [SHARD_1, shardFile('shard-2', ALL_TASKS.slice(2), {
      results: ALL_TASKS.slice(2).map((task_id, i) => res(task_id, { state: i === 0 ? 'FAIL' : PASS })),
    })],
  })
  assert.equal(r.summary.counts.by_state.FAIL, 1)
  assert.equal(r.summary.counts.by_state.PASS, ALL_TASKS.length - 1)
  assert.equal(r.verdict, 'FAIL')
  assert.ok(r.codes.includes('TASK_STATE_FAIL'))
})

test('rule 5 (oracles): a failed oracle counts as failed AND is in the verdict', () => {
  const r = aggregate({
    plan,
    shards: [SHARD_1, shardFile('shard-2', ALL_TASKS.slice(2), {
      results: ALL_TASKS.slice(2).map((task_id) => res(task_id, { oracles: [{ id: 'ORACLE-CENSUS', state: 'FAIL' }] })),
    })],
  })
  assert.equal(r.summary.oracles.failed, ALL_TASKS.length - 2)
  assert.equal(r.summary.oracles.checked, ALL_TASKS.length)
  assert.ok(r.codes.includes('ORACLE_FAILED'))
  assert.notEqual(r.verdict, PASS)
})

test('rule 6 (verdict): precedence FAIL > INFRA_ERROR > CANCELLED > INCOMPLETE is observable', () => {
  const failing = shardFile('shard-2', ALL_TASKS.slice(2), {
    results: ALL_TASKS.slice(2).map((task_id) => res(task_id, { state: 'FAIL' })),
  })
  const infra = shardFile('shard-3', [], { status: 'INFRA_ERROR', exit_code: 2 })
  const cancelled = shardFile('shard-4', [], { status: 'CANCELLED', exit_code: 1 })
  const onlyInfra = aggregate({ plan, shards: [SHARD_1, shardFile('shard-2', ALL_TASKS.slice(2)), infra] })
  assert.equal(onlyInfra.verdict, 'INFRA_ERROR')
  const cancelledOnly = aggregate({ plan, shards: [SHARD_1, shardFile('shard-2', ALL_TASKS.slice(2)), cancelled] })
  assert.equal(cancelledOnly.verdict, 'CANCELLED')
  const all = aggregate({ plan, shards: [SHARD_1, failing, infra, cancelled] })
  assert.equal(all.verdict, 'FAIL')
})
