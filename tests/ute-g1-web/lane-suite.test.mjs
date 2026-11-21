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
import { readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'

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
import { TEST_USE_BASELINE_SHA, DSH_BASELINE_VERSION } from '../paths.mjs'
import { isSanctionedTestPort, STABLE_INSTANCE_PORT } from '../paths.mjs'
import { FIXTURE_PORT } from './lib/fixture-server.mjs'

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')
const GOLDEN = join(REPO_ROOT, 'tests', 'ute-g1-web', 'golden', 'old-path.tsv')
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

test('the golden is stable: two consecutive captures are byte-identical to it', async () => {
  for (const pass of ['first', 'second']) {
    const records = await captureCorpus()
    const comparison = compareAll(golden, records)
    assert.deepEqual(comparison.failures, [], `pass ${pass} drifted from the golden: ${JSON.stringify(comparison.failures)}`)
    assert.deepEqual(comparison.missingObserved, [])
    assert.deepEqual(comparison.missingGolden, [])
  }
  // No row may embed machine state: an absolute path, a pid, or a wall clock.
  for (const record of golden) {
    const row = JSON.stringify(record)
    assert.ok(!row.includes(REPO_ROOT), `${record.id} embeds an absolute path`)
    assert.ok(!/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(row), `${record.id} embeds a wall clock`)
    assert.ok(!/"pid"/.test(row), `${record.id} embeds a pid`)
  }
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
  const { installNetworkWitness, uninstallNetworkWitness, classifyConnectTarget } = await import('./lib/net-witness.mjs')
  const counters = installNetworkWitness()
  try {
    const { mountRouteCWorld } = await import('./lib/world.mjs')
    const world = await mountRouteCWorld({ label: 'target-proof' })
    try {
      await world.dispatch('web_fetch', { url: `${world.fixtureOrigin}/text` })
      const snapshot = world.network()
      assert.deepEqual([...new Set(snapshot.targets)], [`127.0.0.1:${FIXTURE_PORT}`], `the witness recorded ${JSON.stringify(snapshot.targets)}; undici's array-like connect bag must be unwrapped or an EXTERNAL fetch would be classified loopback`)
      assert.equal(snapshot.forwarded, 1)
    } finally {
      await world.dispose()
    }
  } finally {
    uninstallNetworkWitness()
  }
  void counters
  assert.equal(classifyConnectTarget({ kind: 'tcp', host: 'example.com', port: 443, label: 'example.com:443' }), 'external')
})

test('the semantic differences are measured, blocking, and unapproved', async () => {
  const { measureAll } = await import('./lib/semantic-differences.mjs')
  const differences = await measureAll()
  assert.deepEqual(differences.map((difference) => difference.id), [
    'SD-WEB-1-native-name-claim-collision',
    'SD-WEB-2-redirect-ownership',
    'SD-WEB-3-refusal-surface',
  ])
  for (const difference of differences) {
    assert.equal(difference.blocking, true, `${difference.id} is claimed resolved without an owner decision`)
    assert.equal(difference.approval, null, `${difference.id} carries an approval; this lane found none`)
  }
  const redirect = differences.find((difference) => difference.id === 'SD-WEB-2-redirect-ownership')
  assert.equal(redirect.legacy.requests, 1, 'the legacy transport must answer ONE hop')
  assert.ok(redirect.routeC.requests > 1, 'the route-C provider must follow the chain')
  assert.ok(redirect.routeC.residual.includes('WEB_REDIRECT_UNMEDIATED_ON_ALLOW'), 'the face must disclose the unmediated redirect')
  const refusal = differences.find((difference) => difference.id === 'SD-WEB-3-refusal-surface')
  for (const row of refusal.routeC.rows) assert.equal(row.typedCodeInText, null, `${row.id} unexpectedly carries a typed code`)
})
