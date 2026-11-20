/**
 * lane-suite.test.mjs — the UTE G1 SEARCH lane's own gates.
 *
 *   node --test tests/ute-g1-search/lane-suite.test.mjs
 *
 * It runs FOUR independent checks and prints one verdict line:
 *   1. the OLD PATH still reproduces the reviewed golden fixture (a re-capture,
 *      field by field);
 *   2. the golden covers both members and speaks only the closed refusal
 *      vocabulary;
 *   3. the NEW PATH is still NOT implemented — pinned by an explicit id
 *      assertion, so "pending" cannot become "verified" by silence;
 *   4. the family-level and per-member NEGATIVE CONTROLS are GREEN (the script
 *      is spawned; its `NC-VERDICT` line is the graded fact).
 *
 * The verdict is NOT a retirement claim: old baseline captured, new path
 * pending, semantic differences unresolved ⇒ retirement forbidden.
 *
 * @module tests/ute-g1-search/lane-suite.test
 */
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { test } from 'node:test'

import { CORPUS } from './lib/corpus.mjs'
import { compareAll, parseGolden } from './lib/compare.mjs'
import { CATEGORY_IDS, REFUSAL_CATEGORIES, UNKNOWN_CATEGORY } from './lib/effect-oracle.mjs'
import { captureCorpus, OLD_PATH_IDENTITY } from './lib/old-path.mjs'

const ROOT = process.cwd()
const GOLDEN_DIR = join(ROOT, 'tests', 'ute-g1-search', 'golden')
const GOLDEN = join(GOLDEN_DIR, 'old-path.tsv')
const META = join(GOLDEN_DIR, 'old-path.meta.txt')
const COVERAGE = join(GOLDEN_DIR, 'COVERAGE.md')

/**
 * The NEW PATH vector ids this family still owes. EMPTY and that is the point:
 * the task is the OLD-PATH baseline only. The assertion below pins the flag by
 * EXPLICIT id so a future lane flips it by listing ids, never by deleting a
 * check.
 */
export const SEARCH_NEW_PATH_PENDING_IDS = Object.freeze([])
export const SEARCH_NEW_PATH_PENDING = true

/** Per-member minimum the golden must carry (non-vacuity of each member). */
const MEMBER_MINIMUM = Object.freeze({ grep: 6, glob: 5 })

const golden = parseGolden(readFileSync(GOLDEN, 'utf8'))
const meta = readFileSync(META, 'utf8')

/** Every `id` the fixture carries, as a set. */
const goldenIds = new Set(golden.map((record) => record.id))

let verdict = {
  oldBaseline: 'NOT-RUN',
  newPath: 'PENDING',
  semanticDifferences: 'UNRESOLVED',
  negativeControls: 'NOT-RUN',
}

test('old path: every corpus vector reproduces its golden row', async () => {
  const observed = await captureCorpus()
  const compared = compareAll(golden, observed)
  const same = compared.failures.length === 0 && compared.missingGolden.length === 0 && compared.missingObserved.length === 0
  console.log(`OLD-PATH-GOLDEN compare=${same ? 'identical' : 'DIFFERS'} fixture=${GOLDEN} vectors=${golden.length} captured=${observed.length}`)
  if (!same) {
    for (const failure of compared.failures) {
      console.error(`OLD-PATH-DRIFT ${failure.id} ${failure.diffs.map((diff) => `${diff.field}: golden=${JSON.stringify(diff.expected)} observed=${JSON.stringify(diff.observed)}`).join(' | ')}`)
    }
    if (compared.missingGolden.length > 0) console.error(`OLD-PATH-DRIFT uncaptured-in-fixture=${compared.missingGolden.join(',')}`)
    if (compared.missingObserved.length > 0) console.error(`OLD-PATH-DRIFT captured-but-missing=${compared.missingObserved.join(',')}`)
  }
  verdict.oldBaseline = same ? 'REPRODUCIBLE' : 'DIFFERS'
  assert.equal(compared.failures.length, 0, 'every golden row must reproduce on this host')
  assert.equal(compared.missingGolden.length, 0, 'the re-capture must not carry a vector the fixture lacks')
  assert.equal(compared.missingObserved.length, 0, 'the fixture must not carry a vector the re-capture lacks')
})

test('golden: both members are covered and every refusal is a closed category', () => {
  const counts = { grep: 0, glob: 0 }
  for (const record of golden) {
    assert.ok(Object.hasOwn(counts, record.entry), `row ${record.id} declares an entry outside the Search family: ${record.entry}`)
    counts[record.entry] += 1
    if (record.refusal !== null) {
      assert.ok(CATEGORY_IDS.includes(record.refusal), `row ${record.id} refuses with ${JSON.stringify(record.refusal)}, outside the closed vocabulary`)
      assert.notEqual(record.refusal, UNKNOWN_CATEGORY, `row ${record.id} rests in the unclassified bucket`)
      assert.ok(Object.hasOwn(REFUSAL_CATEGORIES, record.refusal), `row ${record.id} refuses with a category absent from REFUSAL_CATEGORIES`)
    }
    assert.ok(record.outcome === 'allow' || record.outcome === 'deny', `row ${record.id} has outcome ${JSON.stringify(record.outcome)}`)
    assert.equal(record.outcome === 'deny', record.refusal !== null, `row ${record.id} must carry a refusal exactly when it is a deny`)
  }
  for (const [member, minimum] of Object.entries(MEMBER_MINIMUM)) {
    assert.ok(counts[member] >= minimum, `member ${member} has only ${counts[member]} golden rows, below the ${minimum} this lane claims`)
  }
  assert.equal(counts.grep + counts.glob, golden.length, 'every golden row must be attributable to exactly one Search member')
  console.log(`OLD-PATH-COVERAGE grep=${counts.grep} glob=${counts.glob} vectors=${golden.length}`)
})

test('the new path is still pending, pinned by an explicit id list', () => {
  assert.equal(SEARCH_NEW_PATH_PENDING, true, 'this lane delivers the OLD-PATH baseline; a new path must arrive as its own task with its own evidence')
  assert.deepEqual([...SEARCH_NEW_PATH_PENDING_IDS], [], 'the pending-id list must stay empty until a new path is verified; listing ids is how it is flipped')
  for (const id of SEARCH_NEW_PATH_PENDING_IDS) {
    assert.match(id, /^SR-[GL]\d+-/u, `a pending id ${id} does not name a corpus vector`)
    assert.ok(!goldenIds.has(id), `pending id ${id} is also a captured golden row`)
  }
  // The corpus is the pending set: every vector is old-path evidence only.
  for (const vector of CORPUS) assert.match(vector.id, /^SR-[GL]\d-[a-z0-9-]+$/u)
  console.log(`NEW-PATH-PENDING ${SEARCH_NEW_PATH_PENDING_IDS.length === 0 ? 'all' : SEARCH_NEW_PATH_PENDING_IDS.join(',')} (no new-path vector is claimed by this lane)`)
})

test('golden metadata and coverage agree with the fixture', () => {
  assert.match(meta, new RegExp(`vectors=${golden.length}\\b`, 'u'), 'old-path.meta.txt must state the fixture vector count')
  assert.match(meta, new RegExp(`host=${OLD_PATH_IDENTITY.hostVersion.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&')}`, 'u'), 'the metadata must name the pinned host version')
  const coverage = readFileSync(COVERAGE, 'utf8')
  for (const record of golden) {
    assert.ok(coverage.includes(record.id), `golden/COVERAGE.md does not mention ${record.id}`)
  }
})

test('negative controls: the family-level and per-member mutations are GREEN', { timeout: 480_000 }, () => {
  const stdout = execFileSync(process.execPath, [join(ROOT, 'tests', 'ute-g1-search', 'negative-controls.mjs')], {
    cwd: ROOT,
    encoding: 'utf8',
    maxBuffer: 32 * 1024 * 1024,
  })
  for (const line of stdout.split('\n')) {
    if (line.startsWith('NC ') || line.startsWith('NC-MEMBER') || line.startsWith('NC-VERDICT')) console.log(line)
  }
  const verdictLine = stdout.split('\n').find((line) => line.startsWith('NC-VERDICT '))
  assert.ok(verdictLine !== undefined, 'the negative-control script printed no verdict line')
  assert.match(verdictLine, /^NC-VERDICT GREEN controls=(\d+) failed=0$/u, `the negative controls are not green: ${verdictLine}`)
  const controls = Number(verdictLine.match(/controls=(\d+)/u)[1])
  assert.ok(controls >= 8, `only ${controls} controls ran; the lane claims 2 family-level + 2 per-member + 2 positive arms + 2 composition controls`)
  verdict.negativeControls = 'GREEN'
})

test('VERDICT: the Search family is NOT retireable from this lane', () => {
  console.log(
    `UTE-G1-SEARCH-VERDICT old-baseline=${verdict.oldBaseline} new-path=PENDING`
    + ` semantic-differences=${verdict.semanticDifferences} negative-controls=${verdict.negativeControls} retirement=FORBIDDEN`,
  )
  assert.equal(verdict.oldBaseline, 'REPRODUCIBLE', 'the old-path baseline must have been reproduced in this run')
  assert.equal(verdict.negativeControls, 'GREEN', 'the negative controls must have been green in this run')
  // Retirement needs all four terms; two are structurally false here.
  assert.equal(SEARCH_NEW_PATH_PENDING, true)
  assert.equal(verdict.semanticDifferences, 'UNRESOLVED')
})
