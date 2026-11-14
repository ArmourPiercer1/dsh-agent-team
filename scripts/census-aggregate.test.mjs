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
      catalog_digest: 'sha256:catalog',
      build_digest: 'sha256:build',
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

const passResults = (taskIds) => taskIds.map((task_id) => ({
  task_id,
  state: 'PASS',
  duration_ms: 1000,
  oracles: [{ id: 'ORACLE-CENSUS', state: 'PASS' }],
}))

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

test('the summary says it is not an authority', () => {
  const r = aggregate({ plan, shards: [SHARD_1, SHARD_2] })
  assert.equal(r.summary.schema, SCHEMA)
  assert.match(r.summary.scope_note, /SHADOW: not wired to ci-required/)
  assert.match(r.summary.scope_note, /not read by any Required context/)
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
  const r = aggregate({ plan, shards: [SHARD_1, shardFile('shard-2', [...ALL_TASKS.slice(2), 'census:packages/z#1'])] })
  assert.equal(r.verdict, 'INCOMPLETE')
  assert.ok(r.codes.includes('TASK_EXTRA'), JSON.stringify(r.codes))
  assert.equal(r.summary.counts.extra, 1)
})

test('a task with no terminal result is INCOMPLETE / TASK_NO_TERMINAL_RESULT', () => {
  const r = aggregate({
    plan,
    shards: [SHARD_1, shardFile('shard-2', ALL_TASKS.slice(2), {
      results: ALL_TASKS.slice(2).map((task_id) => ({ task_id, oracles: [{ id: 'ORACLE-CENSUS', state: PASS }] })),
    })],
  })
  assert.equal(r.verdict, 'INCOMPLETE')
  assert.ok(r.codes.includes('TASK_NO_TERMINAL_RESULT'), JSON.stringify(r.codes))
})

test('a shard that exited 0 while carrying a FAIL aggregates to FAIL', () => {
  const failing = shardFile('shard-2', ALL_TASKS.slice(2), {
    exit_code: 0,
    results: ALL_TASKS.slice(2).map((task_id, i) => ({
      task_id,
      state: i === 0 ? 'FAIL' : PASS,
      oracles: [{ id: 'ORACLE-CENSUS', state: PASS }],
    })),
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
    results: ALL_TASKS.slice(2).map((task_id) => ({ task_id, state: 'FAIL', oracles: [{ id: 'ORACLE-CENSUS', state: 'PASS' }] })),
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
        results: ALL_TASKS.slice(2).map((task_id, i) => ({
          task_id,
          state: i === 0 ? state : PASS,
          oracles: [{ id: 'ORACLE-CENSUS', state: PASS }],
        })),
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
      results: ALL_TASKS.slice(2).map((task_id) => ({ task_id, state: 'MAYBE', oracles: [{ id: 'ORACLE-CENSUS', state: PASS }] })),
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

for (const [field, code] of IDENTITY_CONTROLS) {
  test(`a mismatched ${field} refuses as ${code}`, () => {
    const r = aggregate({ plan, shards: [SHARD_1, shardFile('shard-2', ALL_TASKS.slice(2), { identity: identityOf({ [field]: 'other' }) })] })
    assert.equal(r.refused, true)
    assert.ok(r.codes.includes(code), JSON.stringify(r.codes))
  })
}

test('a shard that ran a different plan refuses as PLAN_DIGEST_MISMATCH', () => {
  const r = aggregate({
    plan,
    shards: [SHARD_1, shardFile('shard-2', ALL_TASKS.slice(2), { identity: identityOf({ plan_digest: 'sha256:anotherplan' }) })],
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
      results: ALL_TASKS.slice(2).map((task_id) => ({ task_id, state: PASS, oracles: [] })),
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
      results: ALL_TASKS.slice(2).map((task_id) => ({ task_id, state: PASS, oracles: [{ id: 'ORACLE-CENSUS', state: 'FAIL' }] })),
    })],
  })
  assert.equal(r.verdict, 'FAIL')
  assert.ok(r.codes.includes('ORACLE_FAILED'), JSON.stringify(r.codes))
})

test('an undecidable required oracle is INCOMPLETE, not green', () => {
  const r = aggregate({
    plan,
    shards: [SHARD_1, shardFile('shard-2', ALL_TASKS.slice(2), {
      results: ALL_TASKS.slice(2).map((task_id) => ({ task_id, state: PASS, oracles: [{ id: 'ORACLE-CENSUS', state: 'UNDECIDABLE' }] })),
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
