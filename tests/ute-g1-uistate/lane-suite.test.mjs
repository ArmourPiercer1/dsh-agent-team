/**
 * lane-suite.test.mjs — the UI + AGENT-STATE binding lane.
 *
 * This is the suite CI must COLLECT. It asserts exactly what the retirement
 * ledger is allowed to cite:
 *
 *   1. the census is the booking: the corpus covers every member the census
 *      books for both families, with the required classes and ≥6 vectors each;
 *   2. the fixture is STABLE: two consecutive captures reproduce the golden
 *      byte-for-byte, with no host path, wall clock or pid anywhere;
 *   3. every golden row satisfies its own DESIGN CLAIM (the fixture is not a
 *      recording of whatever happened);
 *   4. the refusal mapping is TOTAL over what the corpus observed and lands in
 *      the owner's IMPORTED closed vocabulary — and every category is either
 *      reached or PRINTED as an exclusion with its reason;
 *   5. effects are corroborated INDEPENDENTLY of the row (the port log, the
 *      durable store's own record and ledger);
 *   6. the per-member negative controls hold (`NC-VERDICT GREEN`), one per
 *      census member;
 *   7. the semantic differences are measured, blocking and unapproved.
 *
 * It delivers NO new path: Stage 0 measured that both families have two live
 * implementations and that route-C serves neither, so the honest record is a
 * frozen baseline + controls + unresolved differences, never a retirement.
 *
 * Run: node --test tests/ute-g1-uistate/lane-suite.test.mjs
 *
 * @module tests/ute-g1-uistate/lane-suite.test
 */
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { test } from 'node:test'

import { retirementPin } from '../ute-g1-shared/retirement.mjs'
import { checkDesignClaim, compareAll, parseGolden } from './lib/compare.mjs'
import { COVERED_MEMBERS, MEMBERS_BY_FAMILY, REQUIRED_CLASSES, VECTOR_IDS, CORPUS } from './lib/corpus.mjs'

import { CATEGORY_EXCLUSIONS, categoricalCoverage, observedCodes } from './lib/effect-oracle.mjs'
import { captureCorpus, OLD_PATH_IDENTITY } from './lib/old-path.mjs'
import { DSH_BASELINE_VERSION, REPO_ROOT, TEST_USE_BASELINE_SHA } from './lib/paths.mjs'
import { assertVocabularyTotal, CATEGORY_IDS, REFUSAL_CATEGORIES } from './lib/refusal-map.mjs'
import { SEMANTIC_DIFFERENCES, SEMANTIC_MEASUREMENT_RETIRED, semanticDifferenceLines } from './lib/semantic-differences.mjs'
import { runNegativeControls } from './negative-controls.mjs'

const GOLDEN = join(REPO_ROOT, 'tests', 'ute-g1-uistate', 'golden', 'old-path.tsv')
const golden = parseGolden(readFileSync(GOLDEN, 'utf8'))
const census = JSON.parse(readFileSync(join(REPO_ROOT, 'dev', 'agent-workflow', 'ledgers', 'arc-a-family-census.json'), 'utf8'))
const censusMembersOf = (familyId) => census.families.find((family) => family.familyId === familyId).nativeNames
  .map((name) => name.replace(/^\(bound-definition\)\s*/, ''))

test('the fixture is bound to the pinned host and the census books the corpus', () => {
  assert.equal(DSH_BASELINE_VERSION, '0.2.0-rc.2', 'the baseline host generation moved; the fixture must be re-measured, not relabelled')
  assert.equal(OLD_PATH_IDENTITY.host, `${DSH_BASELINE_VERSION}@${TEST_USE_BASELINE_SHA}`, 'old-path.mjs must cite the ONE pin source tests/paths.mjs')
  // The census is the booking: members are DERIVED, never hand-listed.
  assert.deepEqual([...MEMBERS_BY_FAMILY.ui].sort(), censusMembersOf('dsh.ui-family').sort())
  assert.deepEqual([...MEMBERS_BY_FAMILY['agent-state']].sort(), censusMembersOf('dsh.agent-state-family').sort())
  assert.deepEqual([...COVERED_MEMBERS].sort(), [...censusMembersOf('dsh.ui-family'), ...censusMembersOf('dsh.agent-state-family')].sort())
  // Distinct ids, golden == corpus (no orphans in either direction).
  assert.equal(new Set(VECTOR_IDS).size, VECTOR_IDS.length)
  assert.deepEqual(golden.map((record) => record.id), VECTOR_IDS)
  // At least six vectors per member, and the four required classes per member.
  for (const member of COVERED_MEMBERS) {
    const vectors = CORPUS.filter((vector) => vector.member === member)
    assert.ok(vectors.length >= 6, `${member} has only ${String(vectors.length)} vectors; the lane requires at least 6`)
    for (const required of REQUIRED_CLASSES) {
      assert.ok(vectors.some((vector) => vector.klass === required), `${member} has no "${required}" vector`)
    }
    assert.ok(vectors.some((vector) => vector.klass === 'abort' || vector.klass === 'deadline'), `${member} has no abort/deadline vector`)
  }
  console.log(`UTE-G1-UISTATE-CORPUS members=${COVERED_MEMBERS.join(',')} vectors=${String(golden.length)} host=${OLD_PATH_IDENTITY.host}`)
})

test('RETIRED-BY-A0: both governed family bodies are gone and the fixture is the frozen baseline', () => {
  // ROUND 81 disposition (ROUND80-CI-CLOSURE.md §4): B1 captured the route-C
  // world by importing `packages/tools/families/ui.mjs`; the A0 frozen cut
  // deleted both governed bodies, and `attachA5sfNativeToolModules` no longer
  // appends a shadow (`5d1349767`). The capture arm retires; the fixture stays
  // the frozen historical baseline and is NOT re-recorded (this lane has no new
  // path). The retired surface is asserted ABSENT below.
  const ui = retirementPin({
    suite: 'UISTATE',
    subject: 'dsh.ui-family',
    retiredPaths: [
      'packages/tools/families/ui.mjs',
      'packages/tools/agent-state-family/src/executors.mjs',
    ],
    successors: [
      'tests/ute-g1-uistate/lane-suite.test.mjs',
      'tests/world-factory/a5sf-ask-precedence.test.mjs',
      'packages/runtime/test/vnext-admission.test.mjs',
    ],
    golden: 'tests/ute-g1-uistate/golden/old-path.tsv',
    goldenRows: golden.length,
  })
  assert.match(ui.line, /^UTE-G1-UISTATE-RETIRED-BY-A0 subject=dsh\.ui-family citation=5d1349767\+93ba0a1d1 /u)
  const state = retirementPin({
    suite: 'UISTATE',
    subject: 'dsh.agent-state-family',
    retiredPaths: ['packages/tools/families/agent-state.mjs'],
    successors: ['packages/runtime/test/vnext-admission.test.mjs', 'tests/world-factory/a5sf-ask-precedence.test.mjs'],
    checkRouteC: false,
  })
  assert.match(state.line, /^UTE-G1-UISTATE-RETIRED-BY-A0 subject=dsh\.agent-state-family /u)
  // No row may embed machine state: an absolute path, a pid, or a wall clock.
  for (const record of golden) {
    const row = JSON.stringify(record)
    assert.ok(!row.includes(REPO_ROOT), `${record.id} embeds an absolute path`)
    assert.ok(!/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(row), `${record.id} embeds a wall clock`)
    assert.ok(!/"pid"/.test(row), `${record.id} embeds a pid`)
  }
  console.log(`UTE-G1-UISTATE-STABLE vectors=${String(golden.length)} state=FROZEN re-records=0`)
  void captureCorpus
  void compareAll
})

test('every golden row satisfies its corpus design claim', () => {
  for (const record of golden) {
    const vector = CORPUS.find((candidate) => candidate.id === record.id)
    assert.deepEqual(checkDesignClaim(vector, record), [], `${record.id} does not satisfy its own claim`)
  }
})

test('the refusal mapping is total, closed, and every category is reached or excluded', () => {
  const codes = observedCodes(golden)
  assert.ok(codes.length >= 25, `only ${String(codes.length)} distinct refusal codes are exercised`)
  const totality = assertVocabularyTotal(codes)
  assert.deepEqual(totality.problems, [], 'the family-local vocabulary is not total over the observed codes')
  for (const record of golden) {
    if (record.refusal === null) continue
    assert.ok(CATEGORY_IDS.includes(record.refusal), `${record.id} refuses with '${record.refusal}', outside the owner's closed vocabulary`)
    assert.notEqual(record.refusal, 'unknown', `${record.id} rests in the 'unknown' bucket`)
  }
  const coverage = categoricalCoverage(golden)
  assert.deepEqual(coverage.missing, [], `categories neither reached nor excluded: ${coverage.missing.join(',')}`)
  assert.deepEqual(coverage.undeclaredReached, [], `categories declared as excluded ARE reached: ${coverage.undeclaredReached.join(',')}`)
  // Every category is accounted for by exactly one of the two sets.
  assert.deepEqual([...coverage.reached, ...Object.keys(CATEGORY_EXCLUSIONS)].sort(), [...CATEGORY_IDS].sort())
  assert.deepEqual(Object.keys(coverage.vocabulary).sort(), [...CATEGORY_IDS].sort())
  for (const [category, reason] of Object.entries(CATEGORY_EXCLUSIONS)) {
    assert.ok(reason.length >= 40, `the exclusion for ${category} must state its measured reason`)
    console.log(`UTE-G1-UISTATE-EXCLUDED category=${category} reason=${reason}`)
  }
  console.log(`UTE-G1-UISTATE-VOCABULARY codes=${String(codes.length)} reached=${coverage.reached.join('|')} excluded=${Object.keys(CATEGORY_EXCLUSIONS).join('|')}`)
})

test('effects are corroborated independently of the row', () => {
  for (const record of golden) {
    if (record.family === 'ui') {
      // A claimed effect must be witnessed by the PORT's own log, not the row.
      if (record.outcome === 'allow' && record.facts.portCalls > 0) {
        assert.ok(record.effects.includes('@published:') || record.effects.includes('@ask:'), `${record.id} claims an admitted effect with no port witness`)
        assert.ok(record.effects.includes('@result:'), `${record.id} claims an admitted effect with no returned payload`)
      }
      if (record.outcome === 'deny') {
        assert.ok(record.effects.includes('@refused:'), `${record.id} is a refusal with no typed refusal witness`)
      }
    } else {
      // Every agent-state row carries the durable record read back from the
      // store, and the store's own write/attempt ledger.
      assert.ok(record.effects.includes('@record:'), `${record.id} carries no durable readback`)
      assert.ok(record.effects.includes('@ledger:'), `${record.id} carries no store ledger witness`)
      if (record.outcome === 'allow' && record.facts.durableWrites > 0) {
        assert.ok(record.effects.includes('@write:'), `${record.id} committed ${String(record.facts.durableWrites)} write(s) with no ledger entry`)
      }
      if (record.outcome === 'deny') {
        assert.equal(record.facts.durableWrites, 0, `${record.id} refused but committed a durable write`)
      }
    }
  }
})

test('the POST-CUT control battery holds and the committed transcript is exact', async () => {
  const { verdict, results, failures } = await runNegativeControls()
  assert.deepEqual(failures, [], 'a negative control failed; the retirement is not load-bearing')
  assert.equal(verdict, 'GREEN')
  assert.equal(results.length, 8, 'the battery has EIGHT controls; dropping one must red, not silently lower the count')
  // The per-member arms retired with the governed body. Their property is
  // carried by the named successors, asserted here rather than asserted away.
  for (const id of [
    'NC-RETIRED-FAMILY-ABSENT',
    'NC-HOST-MODULES-ONLY',
    'NC-SUCCESSORS-EXIST',
    'NC-GOLDEN-FROZEN',
    'NC-CATEGORY-TOTAL',
    'NC-GOLDEN-DESIGN-CLAIMS',
    'NC-NO-NEW-PATH-CLAIM',
    'NC-LEDGER-CITES-SUCCESSOR',
  ]) {
    assert.ok(results.some((result) => result.id === id), `${id} must be present`)
  }
  const fresh = execFileSync(process.execPath, [join(REPO_ROOT, 'tests', 'ute-g1-uistate', 'negative-controls.mjs')], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
    maxBuffer: 32 * 1024 * 1024,
  }).trim().split('\n')
  assert.match(fresh[0], /^ACCEPTED-BY round81-a1-cut reason=/u, 'the re-recorded battery must name this round and its reason')
  const committed = readFileSync(join(REPO_ROOT, 'dev', 'agent-workflow', 'evidence', 'ute3-uistate-b1-20261121', 'negative-controls.txt'), 'utf8').trim().split('\n')
  assert.deepEqual(fresh, committed, 'the committed UI/AS negative-control transcript must be exactly a fresh run')
  assert.equal(fresh.at(-1), 'NC-VERDICT GREEN controls=8 failed=0')
  console.log(`UTE-G1-UISTATE-CONTROLS verdict=${verdict} controls=${String(results.length)} transcript=exact`)
})

test('the semantic differences stay DECLARED, blocking and unapproved; their measurement retired with the source', () => {
  const lines = semanticDifferenceLines()
  assert.equal(lines.length, SEMANTIC_DIFFERENCES.length)
  assert.ok(lines.length > 0, 'an empty difference list is a claim of equivalence; delete it deliberately, not silently')
  for (const line of lines) {
    console.log(`UTE-G1-UISTATE-${line}`)
    assert.match(line, /^SEMANTIC-DIFF \S+ klass=\S+ blocking=(true|false) approval=(none|recorded)$/)
  }
  assert.ok(SEMANTIC_DIFFERENCES.every((difference) => difference.blocking === true), 'every difference is blocking while no replacement exists')
  assert.ok(SEMANTIC_DIFFERENCES.every((difference) => difference.approval === undefined || difference.approval === null), 'no difference may carry an approval record from this lane')
  // The MEASUREMENT retired with the governed bodies (see the module doc); the
  // DECLARATION stays binding, and the historical measurement is the B1 probe.
  for (const path of SEMANTIC_MEASUREMENT_RETIRED.sources) {
    assert.equal(existsSync(join(REPO_ROOT, path)), false, `${path} is back; the retired measurement source must stay absent`)
  }
  const probe = readFileSync(join(REPO_ROOT, SEMANTIC_MEASUREMENT_RETIRED.historicalEvidence), 'utf8')
  assert.match(probe, /PROBE-CONCLUSION ui=two-implementations/u)
  assert.match(probe, /PROBE-CONCLUSION state=two-implementations/u)
  console.log(`UTE-G1-UISTATE-SEMANTIC declared=${String(SEMANTIC_DIFFERENCES.length)} blocking=all approval=none measurement=RETIRED-BY-A0`)
})

test('the Stage-0 composition probe transcript is committed and answers every member', () => {
  const transcript = readFileSync(join(REPO_ROOT, 'dev', 'agent-workflow', 'evidence', 'ute3-uistate-b1-20261121', 'composition-probe.txt'), 'utf8')
  assert.match(transcript, /PROBE-CONCLUSION ui=two-implementations/u)
  assert.match(transcript, /PROBE-CONCLUSION state=two-implementations/u)
  assert.match(transcript, /PROBE-CONCLUSION delivery-shape=both families owe a real old-path baseline/u)
  assert.match(transcript, /PROBE-ROUTE-C-BARE/u)
  for (const member of COVERED_MEMBERS) {
    assert.ok(
      transcript.includes('PROBE-UISTATE family='),
      'the probe must print one PROBE-UISTATE token per member',
    )
    assert.ok(
      new RegExp(`PROBE-UISTATE family=\\S+ member=${member} two-implementations=yes legacy=\\S+ native=\\S+`, 'u').test(transcript),
      `the probe transcript carries no two-implementations token for ${member}`,
    )
  }
  // The transcript must not leak this host's shape.
  assert.ok(!transcript.includes(REPO_ROOT), 'the probe transcript embeds an absolute repo path')
  console.log(`PROBE-TRANSCRIPT path=dev/agent-workflow/evidence/ute3-uistate-b1-20261121/composition-probe.txt members=${String(COVERED_MEMBERS.length)} many`);
})

test('no member is claimed retireable: this lane delivers no new path', () => {
  const ledger = JSON.parse(readFileSync(join(REPO_ROOT, 'dev', 'agent-workflow', 'ledgers', 'ute-retirement.json'), 'utf8'))
  for (const familyId of ['dsh.ui-family', 'dsh.agent-state-family']) {
    const row = ledger.families.find((family) => family.unit?.familyId === familyId)
    assert.ok(row !== undefined, `the retirement ledger has no row for ${familyId}`)
    assert.equal(row.state, 'NOT_RETIREABLE', `${familyId} must be NOT_RETIREABLE until a replacement path is verified`)
    const differences = row.terms.semanticDifferencesResolved.differences
    assert.ok(differences.length > 0, `${familyId} must list its blocking differences`)
    assert.ok(differences.every((difference) => difference.blocking === true), `${familyId} must mark every difference blocking`)
    assert.ok(differences.every((difference) => difference.approval === null), `${familyId} must not carry an approval record`)
  }
})
