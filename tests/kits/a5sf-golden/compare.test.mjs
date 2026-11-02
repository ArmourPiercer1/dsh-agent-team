/**
 * compare.test.mjs — BL-13 / R5: the golden-vector regression comparator.
 *
 * Run: node --test tests/kits/a5sf-golden/compare.test.mjs
 *
 * HOST-FREE: no port, no DSH_HOME, no pristine-host checkout, no boot. The
 * only new-lane code exercised is the P1 path algebra, imported through the
 * repo's existing TS hook by `observations.mjs`.
 *
 * The suite pins the comparator's refusal laws, not just its happy path:
 *   - a same-shape observation yields MATCH, reported as a REGRESSION
 *     COMPARISON (never as acceptance);
 *   - a divergence yields DIVERGED(<reason>) naming the field that moved;
 *   - a fixture without `regressionOnly: true` is refused;
 *   - a fixture carrying acceptance-shaped vocabulary is refused;
 *   - RETIRE / UNUSABLE vectors are NOT_APPLICABLE even when the observation
 *     is byte-identical to the old expectation — they can never MATCH.
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  ACCEPTANCE_SHAPED_TOKENS,
  DISPOSITIONS,
  GoldenVectorError,
  RESULT,
  REGRESSION_LABEL,
  VERDICT_BEARING_KEYS,
  compareObservation,
  describeResult,
  findAcceptanceToken,
  loadCorpus,
  validateVector,
} from './compare.mjs'
import { REPO_ROOT, observeLaneDecision, observeLocator, observeRunnerArgv } from './observations.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const CORPUS_PATH = join(HERE, 'vectors.json')
const { corpus, vectors } = loadCorpus(CORPUS_PATH)

function vectorById(id) {
  const found = vectors.find((candidate) => candidate.id === id)
  assert.ok(found !== undefined, `corpus must contain vector '${id}'`)
  return found
}

function refusalCode(fn) {
  try {
    fn()
  } catch (error) {
    assert.ok(error instanceof GoldenVectorError, `expected GoldenVectorError, got ${String(error)}`)
    return error.code
  }
  assert.fail('expected a GoldenVectorError refusal, got none')
}

test('the corpus is well-formed: every vector is regression-only and names a new-lane owner', () => {
  assert.equal(corpus.vectorCount, vectors.length)
  assert.equal(vectors.length, 12)
  const counts = Object.fromEntries(DISPOSITIONS.map((disposition) => [disposition, 0]))
  for (const vector of vectors) {
    assert.equal(validateVector(vector), true, vector.id)
    assert.equal(vector.regressionOnly, true, vector.id)
    assert.ok(DISPOSITIONS.includes(vector.disposition), vector.id)
    counts[vector.disposition] += 1
    // The source must exist in this checkout, so a reviewer can go read it.
    assert.doesNotThrow(
      () => readFileSync(join(REPO_ROOT, vector.source.path), 'utf8'),
      `${vector.id}: source ${vector.source.path} must be tracked and readable`,
    )
  }
  assert.deepEqual(counts, {
    REPLAY_AS_REGRESSION: 6,
    RETIRE_AS_OLD_SEMANTICS: 4,
    UNUSABLE: 2,
  })
  assert.deepEqual(corpus.dispositionCounts, counts)
})

test('the corpus and every fixture are free of acceptance-shaped vocabulary', () => {
  assert.equal(findAcceptanceToken(corpus), null)
})

test('MATCH: a same-shape new-lane observation is a regression comparison, not acceptance', async () => {
  const vector = vectorById('read-path-unicode-nfc-locator')
  const observation = await observeLocator(vector.input.locator)
  const result = compareObservation(vector, observation)
  assert.equal(result.status, RESULT.MATCH)
  assert.equal(result.comparison, REGRESSION_LABEL)
  assert.match(result.disclaimer, /not acceptance evidence/)
  assert.equal(describeResult(result), 'MATCH')
  // No verdict token is a member of the result vocabulary.
  assert.equal(Object.values(RESULT).includes('PASS'), false)
  assert.equal(Object.values(RESULT).includes('GO'), false)
})

test('MATCH: an absolute-outside locator is denied by a restricted lane (lane decision)', async () => {
  const vector = vectorById('read-path-absolute-outside-denied')
  const observation = await observeLaneDecision(vector.input.lane, vector.input.locator)
  const result = compareObservation(vector, observation)
  assert.equal(result.status, RESULT.MATCH, JSON.stringify(result))
})

test('DIVERGED: a folded Unicode path names the field that moved', async () => {
  const vector = vectorById('read-path-unicode-nfc-locator')
  const folded = { absolute: false, segments: ['cafe.txt'] }
  const result = compareObservation(vector, folded)
  assert.equal(result.status, RESULT.DIVERGED)
  assert.equal(result.comparison, REGRESSION_LABEL)
  assert.match(result.reason, /segments/)
  const text = describeResult(result)
  assert.match(text, /^DIVERGED\(.+\)$/)
  assert.match(text, /caf/)
})

test('DIVERGED: a relaxed lane decision is reported with both decisions named', async () => {
  const vector = vectorById('read-path-absolute-outside-denied')
  const result = compareObservation(vector, 'allow')
  assert.equal(result.status, RESULT.DIVERGED)
  assert.match(result.reason, /expected lane decision 'deny'/)
  assert.match(result.reason, /observed 'allow'/)
})

test('MATCH: a subset expectation pins only the field it names', async () => {
  const vector = vectorById('read-path-absolute-stays-absolute')
  const observation = await observeLocator(vector.input.locator)
  const result = compareObservation(vector, observation)
  assert.equal(result.status, RESULT.MATCH, JSON.stringify(result))
  // Extra keys are allowed by design: the segments are deliberately un-pinned.
  assert.deepEqual(Object.keys(vector.compare.expected), ['absolute'])
})

test('DIVERGED: a subset expectation still catches a changed pinned field', () => {
  const vector = vectorById('read-path-absolute-stays-absolute')
  const result = compareObservation(vector, { absolute: false, segments: ['etc', 'outside.txt'] })
  assert.equal(result.status, RESULT.DIVERGED)
  assert.match(result.reason, /observation\.absolute: expected true, observed false/)
})

test('MATCH: the OS runner passes an explicit argv element through unchanged', async () => {
  const vector = vectorById('shell-command-is-not-resplit-into-argv')
  const observation = await observeRunnerArgv(vector.input.argv)
  assert.deepEqual(observation, vector.compare.expected)
  const result = compareObservation(vector, observation)
  assert.equal(result.status, RESULT.MATCH, JSON.stringify(result))
})

test('DIVERGED: a re-split argv is reported at the argv index', () => {
  const vector = vectorById('shell-command-is-not-resplit-into-argv')
  const result = compareObservation(vector, ['a | b && c || d ; e', 'whoami'])
  assert.equal(result.status, RESULT.DIVERGED)
  assert.match(result.reason, /argv length: expected 1, observed 2/)
  const element = compareObservation(vector, ['a | b && c || d ; e whoami'])
  assert.equal(element.status, RESULT.DIVERGED)
  assert.match(element.reason, /argv\[0\]: expected/)
})

test('REFUSED: a fixture without regressionOnly: true is not a comparison input', () => {
  const vector = vectorById('read-path-unicode-nfc-locator')
  const { regressionOnly: _dropped, ...withoutFlag } = vector
  assert.equal(refusalCode(() => validateVector(withoutFlag)), 'FIXTURE_NOT_REGRESSION_ONLY')
})

test('REFUSED: an acceptance-shaped token is refused in EVERY case and inflection', () => {
  const vector = vectorById('read-path-unicode-nfc-locator')
  const carried = [
    'PASS', 'pass', 'Pass', 'PASSED', 'passed', 'passing', 'passes',
    'ACCEPTED', 'Accepted', 'accepted', 'accept', 'acceptance',
    'APPROVED', 'approved', 'approval', 'approve',
    'GO', 'go', 'Green', 'green', 'LIVE-CONFIRMED', 'live-confirmed',
  ]
  for (const token of carried) {
    // (a) as the value of a key that has no verdict meaning
    const inValue = { ...vector, effectClaim: `${vector.effectClaim} ${token}` }
    assert.equal(refusalCode(() => validateVector(inValue)), 'FIXTURE_ACCEPTANCE_TOKEN', `value: ${token}`)
    // (b) as a key (a bare token key is refused by the token scan)
    const asKey = { ...vector, [token]: 'x' }
    assert.equal(refusalCode(() => validateVector(asKey)), 'FIXTURE_ACCEPTANCE_TOKEN', `key: ${token}`)
  }
  // The refusal vocabulary itself is not emitted as a result vocabulary.
  assert.ok(ACCEPTANCE_SHAPED_TOKENS.length > 0)
  assert.ok(ACCEPTANCE_SHAPED_TOKENS.every((token) => token === token.toLowerCase()))
})

test('REFUSED: a verdict/status-bearing KEY is refused even with a benign value', () => {
  const vector = vectorById('read-path-unicode-nfc-locator')
  for (const key of VERDICT_BEARING_KEYS) {
    const contaminated = { ...vector, [key]: 'anything' }
    assert.equal(refusalCode(() => validateVector(contaminated)), 'FIXTURE_ACCEPTANCE_TOKEN', key)
  }
  // ... and the key scan is case- and punctuation-insensitive.
  for (const key of ['VERDICT', 'Status', 'sign_off', 'sign-off', 'Grade']) {
    const contaminated = { ...vector, [key]: 'anything' }
    assert.equal(refusalCode(() => validateVector(contaminated)), 'FIXTURE_ACCEPTANCE_TOKEN', key)
  }
})

test('REFUSED: an argv expectation must be a string[] (C2)', () => {
  const vector = vectorById('shell-command-is-not-resplit-into-argv')
  for (const bad of ['a | b', 42, null, { argv: [] }, [1, 2], [null]]) {
    const contaminated = { ...vector, compare: { ...vector.compare, expected: bad } }
    assert.equal(
      refusalCode(() => validateVector(contaminated)),
      'FIXTURE_FIELD_INVALID',
      `expected: ${JSON.stringify(bad)}`,
    )
  }
  // The happy shape still validates.
  assert.equal(validateVector(vector), true)
})

test('REFUSED: a subset expectation must be an object (C2, no array-kind escape)', () => {
  const vector = vectorById('read-path-absolute-stays-absolute')
  for (const bad of [[true], 'absolute', 1, null]) {
    const contaminated = { ...vector, compare: { ...vector.compare, expected: bad } }
    assert.equal(
      refusalCode(() => validateVector(contaminated)),
      'FIXTURE_FIELD_INVALID',
      `expected: ${JSON.stringify(bad)}`,
    )
  }
  assert.equal(validateVector(vector), true)
})

test('NOT_APPLICABLE: a RETIRE vector never matches, even with a byte-identical observation', () => {
  const vector = vectorById('shell-golden-command-fingerprint')
  const result = compareObservation(vector, { fingerprint: 'sha256:whatever', workdirDisplay: 'display:.' })
  assert.equal(result.status, RESULT.NOT_APPLICABLE)
  assert.equal(result.disposition, 'RETIRE_AS_OLD_SEMANTICS')
  assert.equal(describeResult(result), 'NOT_APPLICABLE(old-semantics)')
  assert.match(result.reason, /Changed invariant/)
})

test('NOT_APPLICABLE: an UNUSABLE vector never matches, and says why there is no equivalent', () => {
  const vector = vectorById('effect-fingerprint-backend-parity')
  const result = compareObservation(vector, { effectFingerprint: 'same', settlement: 'same' })
  assert.equal(result.status, RESULT.NOT_APPLICABLE)
  assert.equal(result.disposition, 'UNUSABLE')
  assert.equal(describeResult(result), 'NOT_APPLICABLE(no-equivalent)')
  assert.match(result.reason, /No equivalent/)
})

test('NOT_APPLICABLE: every retired vector is refused BEFORE the observation is inspected', () => {
  for (const vector of vectors.filter((candidate) => candidate.disposition !== 'REPLAY_AS_REGRESSION')) {
    for (const observation of [undefined, null, 'allow', { arbitrary: true }]) {
      const result = compareObservation(vector, observation)
      assert.equal(result.status, RESULT.NOT_APPLICABLE, `${vector.id} / ${JSON.stringify(observation)}`)
      assert.notEqual(result.status, RESULT.MATCH)
    }
  }
})

test('the closed result vocabulary has exactly three statuses and none is a verdict', () => {
  assert.deepEqual(Object.keys(RESULT).sort(), ['DIVERGED', 'MATCH', 'NOT_APPLICABLE'])
  assert.deepEqual(Object.values(RESULT).sort(), ['DIVERGED', 'MATCH', 'NOT_APPLICABLE'])
})
