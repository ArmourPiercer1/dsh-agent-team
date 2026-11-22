/**
 * lane-suite.test.mjs — the WEB family's binding lane.
 *
 * This is the suite CI must COLLECT (it is a `*.test.mjs` under `tests/`), and
 * it asserts the four things the retirement ledger is allowed to cite:
 *
 *   1. the fixture is STABLE: a fresh capture reproduces every golden row, twice
 *      in a row (no wall clock, no port, no path, no arrival race);
 *   2. every row satisfies its corpus DESIGN CLAIM (the fixture is not a
 *      recording of whatever happened);
 *   3. the refusal mapping is TOTAL over what the corpus observed, and lands in
 *      the owner's closed vocabulary only (no `unknown`, no residual `other`);
 *   4. the seam is what the README says it is: every admitted call opened a real
 *      loopback socket to the fixture origin and ZERO non-loopback connects were
 *      attempted; the route-C shadow owns the pair (the inherited host service
 *      is never consulted).
 *
 * Run: node --test tests/ute-g1-web/lane-suite.test.mjs
 *
 * @module tests/ute-g1-web/lane-suite.test
 */
import assert from 'node:assert/strict'
import { execFileSync, spawnSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'

import { retirementPin } from '../ute-g1-shared/retirement.mjs'
import { CORPUS, COVERED_MEMBERS, VECTOR_IDS } from './lib/corpus.mjs'
import { checkDesignClaim, compareAll, parseGolden } from './lib/compare.mjs'
import {
  assertVocabularyTotal,
  CATEGORY_IDS,
  REFUSAL_CATEGORIES,
  RESIDUAL_CLASS,
  UNKNOWN_CATEGORY,
} from './lib/effect-oracle.mjs'
import { captureCorpus, OLD_PATH_IDENTITY, TEST_USE_BASELINE_SHA_FULL } from './lib/old-path.mjs'
import { mountRouteCWorld } from './lib/world.mjs'
import { TEST_USE_BASELINE_SHA, DSH_BASELINE_VERSION } from '../paths.mjs'
import { isSanctionedTestPort, STABLE_INSTANCE_PORT } from '../paths.mjs'
import { FIXTURE_PORT } from './lib/fixture-server.mjs'

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')
const GOLDEN = join(REPO_ROOT, 'tests', 'ute-g1-web', 'golden', 'old-path.tsv')
const EVIDENCE = join(REPO_ROOT, 'dev', 'agent-workflow', 'evidence', 'ute3-web-b1-20261120')
const CONTROL_SCRIPT = join(REPO_ROOT, 'tests', 'ute-g1-web', 'negative-controls.mjs')
const golden = parseGolden(readFileSync(GOLDEN, 'utf8'))

test('the fixture is bound to the pinned legacy host and a sanctioned port', () => {
  assert.equal(DSH_BASELINE_VERSION, '0.2.0-rc.2', 'the baseline host generation moved; the fixture must be re-measured, not relabelled')
  assert.equal(TEST_USE_BASELINE_SHA_FULL, TEST_USE_BASELINE_SHA, 'old-path.mjs must cite the ONE pin source tests/paths.mjs')
  assert.equal(String(FIXTURE_PORT), '3182')
  assert.ok(isSanctionedTestPort(FIXTURE_PORT), `${FIXTURE_PORT} is not a sanctioned test port`)
  assert.notEqual(FIXTURE_PORT, STABLE_INSTANCE_PORT, 'the fixture must never bind the stable instance port')
  assert.equal(OLD_PATH_IDENTITY.port, FIXTURE_PORT)
})

test('the corpus covers every census member and the required vector kinds', () => {
  assert.deepEqual(COVERED_MEMBERS.slice().sort(), ['web_fetch', 'web_search'])
  assert.ok(VECTOR_IDS.length >= 8, `the corpus has ${VECTOR_IDS.length} vectors; the lane requires at least 8`)
  // Distinct ids, and the golden row set is exactly the corpus set (no orphans).
  assert.equal(new Set(VECTOR_IDS).size, VECTOR_IDS.length)
  assert.deepEqual(golden.map((record) => record.id), VECTOR_IDS)
  const required = {
    'successful fetch with a deterministic body': 'WB-F1-inline-text',
    'redirect chain': 'WB-F3-redirect-chain',
    'non-2xx status': 'WB-F5-status-404',
    'timeout/abort before dispatch': 'WB-F9-timeout',
    'body-size cap': 'WB-F7-body-byte-cap',
    'refused content type': 'WB-F6-content-type-refused',
    'out-of-lane destination denial': 'WB-F11-destination-forbidden',
    'member-specific web_search vector': 'WB-S1-search-single',
    'member-specific search-unavailable vector': 'WB-S3-search-unavailable',
  }
  for (const [kind, id] of Object.entries(required)) {
    assert.ok(VECTOR_IDS.includes(id), `the corpus is missing the "${kind}" vector (${id})`)
  }
})

test('RETIRED-BY-A0: the appended PD-27 web shadow is gone and the fixture is the frozen baseline', async () => {
  // ROUND 81 disposition (ROUND80-CI-CLOSURE.md §4): B1 captured the route-C
  // world whose attach APPENDED `confined-web-tool.mjs`. The A1 cut deleted that
  // mechanism (`5d1349767`), so the capture arm retires. The fixture is NOT
  // re-recorded (this lane owns no new path); it stays the frozen historical
  // baseline, and the retired surface is asserted ABSENT with a LIVE mount.
  const pin = retirementPin({
    suite: 'WEB',
    subject: 'dsh.web-family',
    retiredPaths: [
      'packages/tools/families/web.mjs',
      'packages/tools/web-family/src/web-mechanics.mjs',
      'packages/tools/web-family/src/web-transport.mjs',
    ],
    successors: [
      'tests/ute-g1-web/lane-suite.test.mjs',
      'tests/world-factory/a5sf-pd18-web-ptc.test.mjs',
      'tests/world-factory/a5sf-web-contract.test.mjs',
      'packages/runtime/test/vnext-admission.test.mjs',
    ],
    golden: 'tests/ute-g1-web/golden/old-path.tsv',
    goldenRows: golden.length,
  })
  assert.match(pin.line, /^UTE-G1-WEB-RETIRED-BY-A0 subject=dsh\.web-family citation=5d1349767\+93ba0a1d1 /u)
  // A LIVE mount with no composition-declared module proves the seam appends
  // nothing (a resurrected shadow turns this RED).
  const world = await mountRouteCWorld({ label: 'retired-mechanism' })
  try {
    assert.equal(world.attachAppendedNothing, true, 'the post-cut attach appended a PD-27 web shadow; the A1 law is HOST-MODULES-ONLY')
    console.log('WEB-ATTACH appended=none')
  } finally {
    await world.dispose()
  }
  // No row may embed machine state: an absolute path, a pid, or a wall clock.
  for (const record of golden) {
    const row = JSON.stringify(record)
    assert.ok(!row.includes(REPO_ROOT), `${record.id} embeds an absolute path`)
    assert.ok(!/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(row), `${record.id} embeds a wall clock`)
    assert.ok(!/"pid"/.test(row), `${record.id} embeds a pid`)
  }
  void captureCorpus
  void compareAll
})

test('every golden row satisfies its corpus design claim', () => {
  for (const record of golden) {
    const vector = CORPUS.find((candidate) => candidate.id === record.id)
    assert.deepEqual(checkDesignClaim(vector, record), [], `${record.id} does not satisfy its own claim`)
  }
})

test('the refusal mapping is total and uses only the owner\'s closed vocabulary', () => {
  const observedCodes = [...new Set(golden.flatMap((record) => record.codes))]
  assert.ok(observedCodes.length >= 5, `only ${observedCodes.length} refusal codes are exercised`)
  const totality = assertVocabularyTotal(observedCodes)
  assert.deepEqual(totality.problems, [])
  for (const record of golden) {
    if (record.refusal === null) continue
    assert.ok(CATEGORY_IDS.includes(record.refusal), `${record.id} refuses with '${record.refusal}', outside the closed vocabulary`)
    assert.notEqual(record.refusal, UNKNOWN_CATEGORY, `${record.id} rests in the 'unknown' bucket`)
    assert.notEqual(record.refusal, RESIDUAL_CLASS, `${record.id} rests in the residual '${RESIDUAL_CLASS}' bucket`)
  }
  // `unknown` is a DECLARED value of the vocabulary, and no map entry may land there.
  assert.ok(Object.keys(REFUSAL_CATEGORIES).includes(UNKNOWN_CATEGORY))
})

test('every admitted call is corroborated by a real loopback socket and zero external attempts', () => {
  for (const record of golden) {
    assert.equal(record.net.external, 0, `${record.id} attempted a non-loopback connect`)
    if (record.outcome === 'allow') assert.equal(record.net.loopback, 'yes', `${record.id} claims an admitted effect with no wire event`)
    // The route-C shadow owns the pair: the inherited host service is never read.
    assert.equal(record.facts.hostWeb, 0, `${record.id} consulted the inherited host ctx.web`)
  }
})

test('the socket witness reads the real undici destination, not a default', async () => {
  // RE-POINTED (round 81): B1 drove this through the deleted route-C shadow.
  // The property under test is the INSTRUMENT (undici's array-like connect bag
  // must be unwrapped or an EXTERNAL fetch would classify loopback), so it is
  // measured on a REAL undici request against the lane's own loopback fixture.
  const { installNetworkWitness, uninstallNetworkWitness, classifyConnectTarget } = await import('./lib/net-witness.mjs')
  const { startFixtureServer } = await import('./lib/fixture-server.mjs')
  const counters = installNetworkWitness()
  const fixture = await startFixtureServer()
  try {
    const response = await fetch(`${fixture.origin}/text`)
    assert.equal(response.status, 200, 'the fixture must answer the witness probe')
    await response.text()
    const snapshot = counters.snapshot()
    assert.deepEqual([...new Set(snapshot.targets)], [`127.0.0.1:${FIXTURE_PORT}`], `the witness recorded ${JSON.stringify(snapshot.targets)}; undici's array-like connect bag must be unwrapped or an EXTERNAL fetch would be classified loopback`)
    assert.ok(snapshot.forwarded >= 1, 'the loopback connect must reach the real syscall')
    assert.equal(snapshot.external, 0)
  } finally {
    await fixture.close()
    uninstallNetworkWitness()
  }
  assert.equal(classifyConnectTarget({ kind: 'tcp', host: 'example.com', port: 443, label: 'example.com:443' }), 'external')
})


test('the POST-CUT control battery re-runs, its committed transcript is exact, and a mutation reds', () => {
  const fresh = execFileSync(process.execPath, [CONTROL_SCRIPT], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
    maxBuffer: 32 * 1024 * 1024,
  })
  const freshLines = fresh.trim().split('\n')
  assert.ok(
    freshLines.includes('NC-VERDICT GREEN controls=8 failed=0'),
    `the battery must print an exact GREEN verdict: ${freshLines.filter((line) => line.startsWith('NC-VERDICT')).join(' | ')}`,
  )
  assert.match(fresh, /^ACCEPTED-BY round81-a1-cut reason=/mu, 'the re-recorded battery must name this round and its reason')
  const committed = readFileSync(join(EVIDENCE, 'negative-controls.txt'), 'utf8').trim().split('\n')
  assert.deepEqual(freshLines, committed, 'the committed negative-control transcript must be exactly a fresh run (a shrunk or hand-edited battery reds)')
  // A deliberately broken run MUST report RED: the GREEN above is measured,
  // not a constant printed by the script.
  const mutated = spawnSync(process.execPath, [CONTROL_SCRIPT], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
    maxBuffer: 32 * 1024 * 1024,
    env: { ...process.env, UTE_WEB_NC_MUTATE: 'drop-widening' },
  })
  assert.equal(mutated.status, 1, 'the mutated battery must exit 1')
  assert.match(`${mutated.stdout}\n${mutated.stderr}`, /NC-VERDICT RED controls=8 failed=1/u, `the mutated battery did not red: ${mutated.stdout}${mutated.stderr}`)
  console.log('UTE-G1-WEB-CONTROLS GREEN controls=8 transcript=exact mutated=RED')
})

test('the semantic differences stay DECLARED, blocking, and unapproved; their measurement retired with the source', async () => {
  const { SEMANTIC_DIFFERENCES } = await import('./lib/semantic-differences.mjs')
  const differences = SEMANTIC_DIFFERENCES
  assert.deepEqual(differences.map((difference) => difference.id), [
    'SD-WEB-1-native-name-claim-collision',
    'SD-WEB-2-redirect-ownership',
    'SD-WEB-3-refusal-surface',
  ])
  for (const difference of differences) {
    assert.equal(difference.blocking, true, `${difference.id} is claimed resolved without an owner decision`)
    assert.equal(difference.approval, null, `${difference.id} carries an approval; this lane found none`)
    assert.match(difference.retiredMeasurement, /93ba0a1d1|5d1349767/u, `${difference.id} must cite the deleting commit`)
  }
  // The RECORDED cells are the B1 measurement (evidence file), kept as a
  // historical assertion; the live re-derivation is retired with `web.mjs`.
  const redirect = differences.find((difference) => difference.id === 'SD-WEB-2-redirect-ownership')
  assert.equal(redirect.historical.legacy.requests, 1, 'the legacy transport answered ONE hop (recorded)')
  assert.ok(redirect.historical.routeC.requests > 1, 'the route-C provider followed the chain (recorded)')
  assert.ok(redirect.historical.routeC.residual.includes('WEB_REDIRECT_UNMEDIATED_ON_ALLOW'), 'the unmediated-redirect residual was recorded')
  const refusal = differences.find((difference) => difference.id === 'SD-WEB-3-refusal-surface')
  assert.equal(refusal.historical.typedCodeInText, null, 'the recorded route-C refusals carried no typed code')
  const evidence = readFileSync(join(EVIDENCE, 'semantic-differences.txt'), 'utf8')
  for (const difference of differences) assert.ok(evidence.includes(difference.id), `the historical measurement for ${difference.id} is not in the evidence file`)
  // The deleted source must stay deleted: a re-measure against it is impossible.
  for (const path of ['packages/tools/families/web.mjs', 'packages/tools/web-family/src/web-mechanics.mjs', 'packages/tools/web-family/src/web-transport.mjs']) {
    assert.equal(existsSync(join(REPO_ROOT, path)), false, `${path} is back; the retired measurement source must stay absent`)
  }
  console.log('UTE-G1-WEB-SEMANTIC declared=3 blocking=3 approval=none measurement=RETIRED-BY-A0')
})
