#!/usr/bin/env node
/**
 * new-path-controls.mjs — the NEW PATH's mutation controls: proof that the
 * comparison, the declaration channel and the executor-provenance check BITE,
 * plus two REAL-RUN lane controls proving the rc.5 denial is the lane's own
 * decision and not a copied golden row.
 *
 *   node tests/ute-g1-search/new-path-controls.mjs
 *
 * Each control is RED when the mechanism it guards is removed or altered, and
 * GREEN when it is intact. The script prints one `NEW-PATH-NC <id> ok|FAIL`
 * line per control, then `NEW-PATH-NC-VERDICT GREEN controls=N failed=0`.
 * Exit 1 on any control that failed.
 *
 * WHY THE MUTATIONS USE REAL GOLDEN ROWS. A synthetic two-field record would
 * prove the comparator can compare; it would not prove it bites on THIS
 * fixture. Every mutation below starts from a parsed golden row, so the control
 * is coupled to the reviewed artifact, and a golden whose shape drifted breaks
 * the control instead of quietly weakening it.
 *
 * @module tests/ute-g1-search/new-path-controls
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { CORPUS } from './lib/corpus.mjs'
import { parseGolden } from './lib/compare.mjs'
import { runVector, loadNewPathSurface } from './lib/new-path.mjs'
import {
  DECLARED_DIVERGENCES,
  DECLARABLE_DIFFERENCE_IDS,
  checkDeclarations,
  checkModuleProvenance,
  gradeCorpus,
} from './lib/new-path-compare.mjs'
import { SEARCH_SECRET } from './lib/corpus.mjs'

const GOLDEN = join(process.cwd(), 'tests', 'ute-g1-search', 'golden', 'old-path.tsv')
const golden = parseGolden(readFileSync(GOLDEN, 'utf8'))
const byId = (id) => {
  const record = golden.find((candidate) => candidate.id === id)
  if (record === undefined) throw new Error(`the golden fixture no longer carries ${id}`)
  return record
}
const clone = (value) => JSON.parse(JSON.stringify(value))

/** Reasons a graded corpus run produced, as a set. */
const reasonsOf = (graded) => new Set(graded.failures.map((failure) => failure.reason))

let controls = 0
let failed = 0
/**
 * Run one control; `body` throws (or returns a failure string) when the
 * mechanism did not bite.
 * @param {string} id
 * @param {string} what
 * @param {() => (string|void|Promise<string|void>)} body
 */
async function control(id, what, body) {
  controls += 1
  try {
    const problem = await body()
    if (problem !== undefined) throw new Error(problem)
    console.log(`NEW-PATH-NC ${id} ok — ${what}`)
  } catch (error) {
    failed += 1
    console.log(`NEW-PATH-NC ${id} FAIL — ${what}: ${String(error && error.message ? error.message : error)}`)
  }
}

/** Assert the graded run failed with EXACTLY the expected reason on one vector. */
function expectFailure(graded, id, reason) {
  const reasons = reasonsOf(graded)
  assert.ok(reasons.has(reason), `expected ${reason}, got ${[...reasons].join(',') || '(none)'}`)
  const failure = graded.failures.find((candidate) => candidate.id === id && candidate.reason === reason)
  assert.ok(failure !== undefined, `expected ${reason} on ${id}, got ${graded.failures.map((candidate) => `${candidate.id}:${candidate.reason}`).join(' | ')}`)
  assert.equal(graded.verdicts.find((verdict) => verdict.id === id)?.pass, false, `${id} must not pass`)
}

/* ── 1. the comparator bites on a mutated expected effect ────────────────── */
await control('NPNC-MATCHSET-BITES', 'a mutated match-set digest turns SR-G1 RED (a wrong expected effect cannot pass)', () => {
  const expected = clone(byId('SR-G1-inlane-match'))
  const observed = clone(expected)
  const effect = observed.effects.find((entry) => entry.path === '@matches:grep')
  assert.ok(effect !== undefined, 'SR-G1 must carry a @matches:grep effect')
  const mode = String(effect.mode)
  effect.mode = mode.includes('keys=a.txt+sub/b.txt') ? mode.replace('keys=a.txt+sub/b.txt', 'keys=a.txt') : `${mode},mutated`
  effect.sha256 = '0'.repeat(64)
  const graded = gradeCorpus([expected], [observed], [])
  expectFailure(graded, 'SR-G1-inlane-match', 'UNDECLARED_DIVERGENCE')
})

/* ── 2. an undeclared behaviour change is refused ────────────────────────── */
await control('NPNC-UNDECLARED-DIVERGENCE-BITES', 'flipping SR-G3 from deny to allow with no declaration turns the run RED', () => {
  const expected = clone(byId('SR-G3-outside-denied'))
  const observed = clone(expected)
  observed.outcome = 'allow'
  observed.refusal = null
  const graded = gradeCorpus([expected], [observed], [])
  expectFailure(graded, 'SR-G3-outside-denied', 'UNDECLARED_DIVERGENCE')
})

/* ── 3. a declared divergence must be OBSERVED, not asserted ─────────────── */
await control('NPNC-STALE-DECLARATION-BITES', 'declaring a divergence for a vector that reproduced exactly turns the run RED', () => {
  const expected = clone(byId('SR-G2-no-path-stdin'))
  const observed = clone(expected)
  const declared = [{
    vector: 'SR-G2-no-path-stdin',
    difference: 'SD-SEARCH-1-grep-path-default',
    note: 'control: a declaration with nothing to declare',
    diffs: [{ field: 'effects', old: 'a', new: 'b' }],
  }]
  const graded = gradeCorpus([expected], [observed], declared)
  expectFailure(graded, 'SR-G2-no-path-stdin', 'STALE_DECLARED_DIVERGENCE')
})

/* ── 4. a declared divergence must pin the EXACT measured cells ──────────── */
await control('NPNC-DIVERGENCE-PIN-BITES', 'a declaration whose pinned new value drifts from the measurement turns the run RED', () => {
  const expected = clone(byId('SR-G1-inlane-match'))
  const observed = clone(expected)
  const effect = observed.effects.find((entry) => entry.path === '@matches:grep')
  effect.sha256 = 'f'.repeat(64)
  const field = 'effects'
  const goldenCell = expected.effects.map((entry) => `${entry.path}|${entry.exists ? 'present' : 'absent'}|${entry.bytes ?? '-'}|${entry.sha256 ?? '-'}|${entry.mode ?? '-'}`).join(';')
  const declared = [{
    vector: 'SR-G1-inlane-match',
    difference: 'SD-SEARCH-2-grep-vcs-ignore',
    note: 'control: pinned to a forged value the run does not produce',
    diffs: [{ field, old: goldenCell, new: 'forged' }],
  }]
  const graded = gradeCorpus([expected], [observed], declared)
  expectFailure(graded, 'SR-G1-inlane-match', 'DIVERGENCE_VALUE_DRIFT')
})

/* ── 5. a correctly pinned divergence IS a pass (the channel is not a veto) ─ */
await control('NPNC-PINNED-DIVERGENCE-PASSES', 'a divergence declared with the exact measured (field, old, new) cells grades as PASS and carries its id', () => {
  const expected = clone(byId('SR-G1-inlane-match'))
  const observed = clone(expected)
  const effect = observed.effects.find((entry) => entry.path === '@matches:grep')
  const mode = String(effect.mode)
  effect.mode = mode.includes('keys=a.txt+sub/b.txt') ? mode.replace('keys=a.txt+sub/b.txt', 'keys=a.txt') : `${mode},control`
  const cell = (record) => record.effects.map((entry) => `${entry.path}|${entry.exists ? 'present' : 'absent'}|${entry.bytes ?? '-'}|${entry.sha256 ?? '-'}|${entry.mode ?? '-'}`).join(';')
  const declared = [{
    vector: 'SR-G1-inlane-match',
    difference: 'SD-SEARCH-1-grep-path-default',
    note: 'control: correctly pinned',
    diffs: [{ field: 'effects', old: cell(expected), new: cell(observed) }],
  }]
  const graded = gradeCorpus([expected], [observed], declared)
  assert.deepEqual(graded.failures, [], `a correctly pinned divergence must grade green, got ${graded.failures.map((failure) => failure.reason).join(',')}`)
  assert.equal(graded.observedCount, 1, 'the pinned divergence must be RECORDED, not merely tolerated')
  assert.equal(graded.divergences[0].difference, 'SD-SEARCH-1-grep-path-default')
  assert.equal(graded.divergences[0].vector, 'SR-G1-inlane-match')
})

/* ── 6. an unknown difference id is not a wildcard ───────────────────────── */
await control('NPNC-DIFFERENCE-ID-BITES', 'a declaration citing an id this family never declared turns the run RED', () => {
  const expected = clone(byId('SR-G2-no-path-stdin'))
  const observed = clone(expected)
  observed.outcome = 'deny'
  observed.refusal = 'unknown-but-real'
  const declared = [{
    vector: 'SR-G2-no-path-stdin',
    difference: 'SD-MADE-UP-9',
    note: 'control: unknown id',
    diffs: [{ field: 'outcome', old: 'allow', new: 'deny' }],
  }]
  const graded = gradeCorpus([expected], [observed], declared)
  expectFailure(graded, 'SR-G2-no-path-stdin', 'DIFFERENCE_ID_UNKNOWN')
})

/* ── 7. the pending/absent channel cannot come back ──────────────────────── */
await control('NPNC-PENDING-MARKER-BITES', 'a record carrying newPathPending is RED, never a pass', () => {
  const expected = clone(byId('SR-L6-cancel-before-dispatch'))
  const observed = clone(expected)
  observed.newPathPending = true
  const graded = gradeCorpus([expected], [observed], [])
  expectFailure(graded, 'SR-L6-cancel-before-dispatch', 'PENDING_MARKER')
})

/* ── 8. an unrun vector cannot pass by omission ──────────────────────────── */
await control('NPNC-MISSING-VECTOR-BITES', 'a vector that produced no record is RED, not silently skipped', () => {
  const expected = clone(byId('SR-L4-missing-target'))
  const graded = gradeCorpus([expected], [], DECLARED_DIVERGENCES)
  expectFailure(graded, 'SR-L4-missing-target', 'MISSING_OBSERVED')
  assert.equal(graded.verdicts[0].pass, false)
})

/* ── 9. the executor provenance check bites ──────────────────────────────── */
await control('NPNC-PROVENANCE-BITES', 'a definition or spawn program resolved OUTSIDE the next tree is RED', () => {
  const host = { vector: 'SR-G1-inlane-match', entry: '/legacy/node_modules/@deepseek-ai/dsh-tool-fs-search/lib/index.js', nextTree: '/pinned/next', spawns: [['/legacy/node_modules/bin/rg', '--json']] }
  const failures = checkModuleProvenance(host)
  const reasons = new Set(failures.map((failure) => failure.reason))
  assert.deepEqual([...reasons].sort(), ['DEFINITION_NOT_NEXT_HOST', 'SPAWN_PROGRAM_NOT_NEXT_HOST'])
  const clean = checkModuleProvenance({ ...host, entry: '/pinned/next/packages/fs/tool-fs-search/lib/index.js', spawns: [['/pinned/next/node_modules/rg', '--json']] })
  assert.deepEqual(clean, [], 'the provenance check must accept a run that stayed inside the tree')
})

/* ── 10. the declaration table itself is checked ─────────────────────────── */
await control('NPNC-DECLARATION-TABLE-BITES', 'a declaration naming a non-vector, an unknown difference or a no-op cell is refused', () => {
  const problems = checkDeclarations(
    [
      { vector: 'SR-DOES-NOT-EXIST', difference: 'SD-SEARCH-1-grep-path-default', note: '', diffs: [{ field: 'effects', old: 'a', new: 'b' }] },
      { vector: 'SR-G1-inlane-match', difference: 'SD-NOPE', note: '', diffs: [{ field: 'effects', old: 'a', new: 'b' }] },
      { vector: 'SR-G2-no-path-stdin', difference: 'SD-SEARCH-1-grep-path-default', note: '', diffs: [{ field: 'effects', old: 'x', new: 'x' }] },
    ],
    CORPUS.map((vector) => vector.id),
    DECLARABLE_DIFFERENCE_IDS,
  )
  assert.equal(problems.length, 3, `expected three problems, got ${JSON.stringify(problems)}`)
})

/* ── 11–12. REAL RUN: the rc.5 denial is the lane's own decision ─────────── */
const surface = await loadNewPathSurface()

/**
 * The witness that a withheld READ reached the model. For `grep` it is the
 * returned file CONTENT; for `glob` it is the returned PATH (a listing carries
 * no bytes). Same distinction the old-path per-member controls use; restated
 * here because that script RUNS its controls on import and cannot be imported.
 */
function escapedWitness(record, member) {
  if (member === 'grep') return record.leaks.length > 0 ? `leaked content ${record.leaks.join(',')}` : undefined
  const effect = record.effects.find((candidate) => candidate.path === '@matches:glob')
  const keys = String(effect?.mode ?? '').split(',').find((part) => part.startsWith('keys='))
  const escaped = (keys ?? '').slice('keys='.length).split('+').filter((key) => key.startsWith('abs:'))
  return escaped.length > 0 ? `leaked path ${escaped.join('+')}` : undefined
}

/**
 * Widen only the read lane by the vector's `outside` token and require the SAME
 * call to change from a typed lane denial to an admitted read that carries the
 * out-of-lane witness. A control that cannot move the outcome is not measuring
 * the lane.
 */
async function laneControl(id, vectorId, member) {
  await control(id, `widening the ${member} read lane turns ${vectorId}'s denial into an admitted, out-of-lane read`, async () => {
    const vector = CORPUS.find((candidate) => candidate.id === vectorId)
    assert.ok(vector !== undefined, `${vectorId} must be in the corpus`)
    assert.equal(vector.entry, member)
    const denied = await runVector(vector, surface)
    assert.equal(denied.record.outcome, 'deny', `${vectorId} must be denied on the declared lane`)
    assert.equal(denied.record.refusal, 'denied-by-lane', `${vectorId} must be denied BY THE LANE`)
    assert.equal(denied.record.facts.confined, 0, 'a lane denial must not reach the confined provider')
    assert.equal(denied.witness.spawns.length, 0, 'a lane denial must not spawn')
    const widened = await runVector(vector, surface, { laneExtraRead: ['outside'], allowEscapedMatches: true })
    assert.equal(widened.record.outcome, 'allow', `${vectorId} must be ALLOWED once the lane covers the target`)
    const witness = escapedWitness(widened.record, member)
    assert.ok(witness !== undefined, `${vectorId} must then carry an out-of-lane witness (leaks=${widened.record.leaks.join(',') || 'none'})`)
    assert.ok(widened.witness.spawns.length > 0, 'an admitted search must reach the confined provider')
    assert.equal(widened.record.facts.baseCalls, 0, 'even the admitted search must not fall back to the inherited subprocess service')
  })
}

await laneControl('NPNC-LANE-BITES-GREP', 'SR-G3-outside-denied', 'grep')
await laneControl('NPNC-LANE-BITES-GLOB', 'SR-L2-outside-denied', 'glob')

console.log(`NEW-PATH-NC-VERDICT ${failed === 0 ? 'GREEN' : 'RED'} controls=${controls} failed=${failed}`)
if (failed > 0) process.exitCode = 1
