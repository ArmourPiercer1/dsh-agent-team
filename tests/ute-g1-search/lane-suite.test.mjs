/**
 * lane-suite.test.mjs — the UTE G1 SEARCH lane's own gates.
 *
 *   node --test tests/ute-g1-search/lane-suite.test.mjs
 *
 * It runs SEVEN independent checks and prints one verdict line:
 *   1. the OLD PATH still reproduces the reviewed golden fixture (a re-capture,
 *      field by field);
 *   2. the golden covers both members and speaks only the closed refusal
 *      vocabulary;
 *   3. the NEW PATH reproduces every golden vector on the pinned rc.5 host
 *      through the PRODUCT route-C seam, dispatched by the host's own executor
 *      (the `run-new-path.mjs` machinery, run live here);
 *   4. the committed new-path evidence carries exactly those PASS lines and no
 *      pending/absent marker — the B1 `NEW-PATH-ABSENT` channel is gone;
 *   5. the three measured semantic differences are still declared, still
 *      blocking and still UNAPPROVED, and the new-path declaration table may
 *      cite only those ids (it is currently empty because nothing diverged);
 *   6. the new-path MUTATION CONTROLS are GREEN (the script is spawned; its
 *      verdict line is the fact);
 *   7. the old-path family-level and per-member NEGATIVE CONTROLS are GREEN.
 *
 * The verdict is NOT a retirement claim: old baseline captured, new path
 * verified for every vector, semantic differences UNRESOLVED ⇒ retirement
 * forbidden.
 *
 * @module tests/ute-g1-search/lane-suite.test
 */
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { test } from 'node:test'

import { CORPUS } from './lib/corpus.mjs'
import { compareAll, parseGolden } from './lib/compare.mjs'
import { CATEGORY_IDS, REFUSAL_CATEGORIES, UNKNOWN_CATEGORY } from './lib/effect-oracle.mjs'
import { captureCorpus } from './lib/old-path.mjs'
import { runCorpus } from './lib/new-path.mjs'
import {
  DECLARED_DIVERGENCES,
  DECLARABLE_DIFFERENCE_IDS,
  checkDeclarations,
  checkModuleProvenance,
  divergenceLine,
  failureLine,
  gradeCorpus,
  provenanceLine,
} from './lib/new-path-compare.mjs'
import { SEMANTIC_DIFF_LINE_RE, SEMANTIC_DIFFERENCES, semanticDifferenceLines } from './lib/semantic-differences.mjs'

const ROOT = process.cwd()
const GOLDEN_DIR = join(ROOT, 'tests', 'ute-g1-search', 'golden')
const GOLDEN = join(GOLDEN_DIR, 'old-path.tsv')
const META = join(GOLDEN_DIR, 'old-path.meta.txt')
const COVERAGE = join(GOLDEN_DIR, 'COVERAGE.md')
/** The B2 evidence directory (the `newPathVerified` pointer target). */
const NEW_PATH_EVIDENCE_DIR = join(ROOT, 'dev', 'agent-workflow', 'evidence', 'ute3-search-b2-20261120')
const NEW_PATH_EVIDENCE = join(NEW_PATH_EVIDENCE_DIR, 'new-path-run.txt')

/** Per-member minimum the golden must carry (non-vacuity of each member). */
const MEMBER_MINIMUM = Object.freeze({ grep: 6, glob: 5 })

const golden = parseGolden(readFileSync(GOLDEN, 'utf8'))
const meta = readFileSync(META, 'utf8')

let verdict = {
  oldBaseline: 'NOT-RUN',
  newPath: 'NOT-RUN',
  semanticDifferences: 'UNRESOLVED',
  newPathControls: 'NOT-RUN',
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
      assert.ok(CATEGORY_IDS.includes(record.refusal), `row ${record.id} refusal ${JSON.stringify(record.refusal)} is outside the closed vocabulary`)
      assert.notEqual(record.refusal, UNKNOWN_CATEGORY, `row ${record.id} rests in the unclassified bucket`)
    }
  }
  for (const [member, minimum] of Object.entries(MEMBER_MINIMUM)) {
    assert.ok(counts[member] >= minimum, `member ${member} carries ${counts[member]} vector(s), the lane claims at least ${minimum}`)
  }
  assert.match(meta, /OLD-PATH-META vectors=15 host=0\.2\.0-rc\.2 host_commit=[0-9a-f]{40} members=grep,glob composition=route-c/u)
  const coverage = readFileSync(COVERAGE, 'utf8')
  for (const record of golden) assert.ok(coverage.includes(record.id), `COVERAGE.md does not name ${record.id}`)
  assert.ok(coverage.includes('grep') && coverage.includes('glob'), 'COVERAGE.md must name both members')
})

/**
 * The new-path run, executed ONCE for the whole suite: the comparison test needs
 * the records, the provenance check needs the witnesses, and the evidence test
 * needs the printed lines. A second run would also be a second chance to
 * disagree with itself.
 */
let newPathRun
function runNewPathOnce() {
  newPathRun ??= (async () => {
    const { host, records, witnesses, identity } = await runCorpus()
    const graded = gradeCorpus(golden, records, DECLARED_DIVERGENCES)
    const provenanceFailures = witnesses.flatMap((witness) => checkModuleProvenance(witness))
    return { host, records, witnesses, identity, graded, provenanceFailures }
  })()
  return newPathRun
}

test('new path: every golden vector reproduces on the pinned rc.5 host through the product route C', async () => {
  const { host, records, witnesses, identity, graded, provenanceFailures } = await runNewPathOnce()
  for (const vectorVerdict of graded.verdicts) {
    if (vectorVerdict.pass) {
      console.log(`NEW-PATH-VECTOR ${vectorVerdict.id} PASS${vectorVerdict.exact ? '' : ' (declared divergence)'}`)
    } else {
      for (const failure of vectorVerdict.failures) console.error(failureLine({ id: vectorVerdict.id, ...failure }))
    }
  }
  for (const divergence of graded.divergences) console.log(divergenceLine(divergence))
  for (const witness of witnesses) console.log(provenanceLine(witness))
  console.log(`NEW-PATH-HOST ${identity}`)
  console.log(`NEW-PATH-DIVERGENCE-TOTAL declared=${graded.declaredCount} observed=${graded.observedCount}`)
  for (const failure of provenanceFailures) console.error(`NEW-PATH-FAIL id=${failure.vector} reason=${failure.reason} detail=${JSON.stringify(failure.detail)}`)

  assert.equal(records.length, golden.length, 'every golden vector must run on the new path (a skipped vector is never a pass)')
  assert.deepEqual(graded.missingObserved, [], 'the new path must run every golden vector')
  assert.deepEqual(graded.missingGolden, [], 'the new path must not invent a vector the fixture does not carry')
  assert.deepEqual(graded.failures, [], `the new path diverged from its golden rows: ${JSON.stringify(graded.failures)}`)
  assert.deepEqual(provenanceFailures, [], `the run's executor provenance drifted off the pinned next host: ${JSON.stringify(provenanceFailures)}`)
  assert.equal(graded.verdicts.filter((candidate) => candidate.pass).length, golden.length, 'every golden vector must grade PASS')
  // The measured state is ZERO divergences. The table is asserted BOTH ways: an
  // excuse that stops firing is refused by the grader, and a table that grows
  // without a measured divergence is refused here.
  assert.equal(graded.declaredCount, 0, 'no divergence is declared until one is measured and pinned with its exact cells')
  assert.equal(graded.observedCount, DECLARED_DIVERGENCES.length, 'the observed divergence count must equal the declaration count exactly')
  for (const witness of witnesses) {
    assert.equal(witness.entry, host.searchModuleEntry, 'every vector must be served by the next host\'s own search package entry')
  }
  verdict.newPath = 'VERIFIED'
})

test('new path: the committed evidence carries every PASS line and no pending/absent marker', () => {
  const evidence = readFileSync(NEW_PATH_EVIDENCE, 'utf8')
  for (const record of golden) {
    assert.ok(
      evidence.includes(`NEW-PATH-VECTOR ${record.id} PASS`),
      `${NEW_PATH_EVIDENCE} lacks the committed \`NEW-PATH-VECTOR ${record.id} PASS\` line`,
    )
  }
  assert.match(evidence, /NEW-PATH-DIVERGENCE-TOTAL declared=0 observed=0/u, 'the committed evidence must record the measured divergence total')
  assert.match(evidence, /NEW-PATH-VERDICT GREEN vectors=15 /u, 'the committed evidence must carry the GREEN verdict line')
  assert.match(evidence, /NEW-PATH-HOST host=next version=0\.2\.2-rc\.5 /u, 'the committed evidence must name the pinned next host generation')
  // The B1 pending/absent channel must not exist in this lane any more: not in
  // the corpus, not in the evidence, not in a vector's record.
  for (const vector of CORPUS) {
    assert.equal(Object.hasOwn(vector, 'newPathPending'), false, `${vector.id} carries a newPathPending marker; the pending channel is gone`)
  }
  const files = readdirSync(NEW_PATH_EVIDENCE_DIR)
  assert.ok(files.length > 0, 'the B2 evidence directory must not be empty')
  for (const file of files) {
    const content = readFileSync(join(NEW_PATH_EVIDENCE_DIR, file), 'utf8')
    assert.equal(content.includes('NEW-PATH-ABSENT'), false, `${file} still carries the retired NEW-PATH-ABSENT marker`)
    assert.equal(/NEW-PATH-VECTOR \S+ (?:PENDING|ABSENT|SKIP)/u.test(content), false, `${file} parks a vector as pending/absent`)
  }
})

test('semantic differences: all three stay declared, blocking and unapproved; only they may be cited', () => {
  assert.equal(SEMANTIC_DIFFERENCES.length, 3, 'this family declares exactly three measured differences')
  const declaredIds = SEMANTIC_DIFFERENCES.map((difference) => difference.id)
  assert.deepEqual([...DECLARABLE_DIFFERENCE_IDS].sort(), [...declaredIds].sort(), 'the new-path declaration table must cite exactly the declared difference ids')
  for (const difference of SEMANTIC_DIFFERENCES) {
    assert.equal(difference.blocking, true, `${difference.id} must stay blocking until an approval record exists`)
    assert.equal(difference.approval, null, `${difference.id} carries an approval record; this lane may not fabricate one`)
  }
  const lines = semanticDifferenceLines()
  assert.equal(lines.length, 3)
  for (const line of lines) {
    console.log(`UTE-G1-SEARCH-${line}`)
    assert.match(line, SEMANTIC_DIFF_LINE_RE)
    assert.match(line, /blocking=YES approval=PENDING/u, 'every declared difference must still print as blocking and unapproved')
  }
  // An empty declaration table is allowed ONLY because the run measured no
  // divergence; a malformed table is refused outright.
  assert.deepEqual(checkDeclarations(DECLARED_DIVERGENCES, CORPUS.map((vector) => vector.id), DECLARABLE_DIFFERENCE_IDS), [])
  verdict.semanticDifferences = 'UNRESOLVED'
})

test('new path: the mutation controls bite (comparator, declaration channel, provenance, lane)', () => {
  const output = execFileSync(process.execPath, [join(ROOT, 'tests', 'ute-g1-search', 'new-path-controls.mjs')], {
    encoding: 'utf8',
    timeout: 300_000,
  })
  for (const line of output.split('\n').filter((candidate) => candidate.startsWith('NEW-PATH-NC '))) console.log(line)
  const verdictLine = output.split('\n').find((line) => line.startsWith('NEW-PATH-NC-VERDICT '))
  assert.ok(verdictLine !== undefined, 'the new-path controls printed no verdict line')
  console.log(verdictLine)
  assert.match(verdictLine, /^NEW-PATH-NC-VERDICT GREEN controls=(\d+) failed=0$/u, `the new-path controls are not green: ${verdictLine}`)
  const controls = Number(verdictLine.match(/controls=(\d+)/u)[1])
  assert.ok(
    controls >= 12,
    `only ${controls} new-path controls ran; the lane claims at least 12 (8 comparator/declaration mutations + 1 declaration-table check + 1 provenance check + 2 real-run lane controls)`,
  )
  verdict.newPathControls = 'GREEN'
})

test('old path: the family-level and per-member negative controls are green', () => {
  const output = execFileSync(process.execPath, [join(ROOT, 'tests', 'ute-g1-search', 'negative-controls.mjs')], {
    encoding: 'utf8',
    timeout: 300_000,
  })
  for (const line of output.split('\n').filter((candidate) => candidate.startsWith('NC '))) console.log(line)
  const verdictLine = output.split('\n').find((line) => line.startsWith('NC-VERDICT '))
  assert.ok(verdictLine !== undefined, 'the negative controls printed no verdict line')
  console.log(verdictLine)
  assert.match(verdictLine, /^NC-VERDICT GREEN controls=(\d+) failed=0$/u, `the negative controls are not green: ${verdictLine}`)
  const controls = Number(verdictLine.match(/controls=(\d+)/u)[1])
  assert.ok(controls >= 8, `only ${controls} controls ran; the lane claims 2 family-level + 2 per-member + 2 positive arms + 2 composition controls`)
  verdict.negativeControls = 'GREEN'
})

test('VERDICT: the Search family is NOT retireable from this lane', () => {
  console.log(
    `UTE-G1-SEARCH-VERDICT old-baseline=${verdict.oldBaseline} new-path=${verdict.newPath}`
    + ` semantic-differences=${verdict.semanticDifferences} new-path-controls=${verdict.newPathControls}`
    + ` negative-controls=${verdict.negativeControls} retirement=FORBIDDEN`,
  )
  assert.equal(verdict.oldBaseline, 'REPRODUCIBLE', 'the old-path baseline must have been reproduced in this run')
  assert.equal(verdict.newPath, 'VERIFIED', 'the new path must have reproduced every vector in this run')
  assert.equal(verdict.newPathControls, 'GREEN', 'the new-path mutation controls must have been green in this run')
  assert.equal(verdict.negativeControls, 'GREEN', 'the negative controls must have been green in this run')
  // Retirement needs all four terms; the semantic-difference term is
  // structurally false here and MUST stay false: three blocking differences
  // have no approval record.
  assert.equal(verdict.semanticDifferences, 'UNRESOLVED')
  assert.notEqual(REFUSAL_CATEGORIES[UNKNOWN_CATEGORY], undefined)
})
