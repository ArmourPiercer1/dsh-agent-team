/**
 * compare.mjs — BL-13 / R5: the golden-vector REGRESSION COMPARATOR.
 *
 * WHAT THIS FILE IS: a pure comparator between
 *   1. an entry of the converted corpus (`vectors.json`, an OLD Alpha.5
 *      tool-family golden vector), and
 *   2. an observation produced by a NEW lane (`member-io-policy`,
 *      `team-services`, or the `sandbox-provider` OS runner).
 *
 * WHAT IT IS NOT: an acceptance gate. A MATCH says only "the new-lane
 * observation still has the recorded shape"; it is NOT evidence that any
 * P2–P5 / G2–G5 row is satisfied. The result vocabulary is exactly
 * `MATCH` / `DIVERGED` / `NOT_APPLICABLE`, and every result carries
 * `comparison: 'regression comparison'` plus a disclaimer. No acceptance
 * token is ever produced by this module — the tokens it REFUSES as fixture
 * content are listed in `ACCEPTANCE_SHAPED_TOKENS` below and are never a
 * return value.
 *
 * DISPOSITION LAW (reclamation registry §0, class C):
 *   - REPLAY_AS_REGRESSION      → comparable; may return MATCH/DIVERGED
 *   - RETIRE_AS_OLD_SEMANTICS   → never comparable → NOT_APPLICABLE
 *   - UNUSABLE                  → never comparable → NOT_APPLICABLE
 * A RETIRE/UNUSABLE vector is refused BEFORE the observation is inspected,
 * so no crafted observation can turn a dead vector into a MATCH.
 *
 * CORE PATCH BUDGET = 0. The pure functions have no I/O; only the CLI and
 * `loadCorpus` read files.
 *
 * @module tests/kits/a5sf-golden/compare
 */
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

/** Closed comparison vocabulary. No acceptance token is a member. */
export const RESULT = Object.freeze({
  MATCH: 'MATCH',
  DIVERGED: 'DIVERGED',
  NOT_APPLICABLE: 'NOT_APPLICABLE',
})

/** The label every result carries, so a reader cannot mistake it for a gate. */
export const REGRESSION_LABEL = 'regression comparison'
export const DISCLAIMER = 'regression comparison only — a MATCH is not acceptance evidence'

export const DISPOSITIONS = Object.freeze([
  'REPLAY_AS_REGRESSION',
  'RETIRE_AS_OLD_SEMANTICS',
  'UNUSABLE',
])

export const NEW_LANE_OWNERS = Object.freeze([
  'member-io-policy',
  'team-services',
  'sandbox-provider-os-runner',
])

export const COMPARE_KINDS = Object.freeze(['equal', 'subset', 'lane-decision', 'argv'])

/**
 * The ONE blocklist of acceptance-shaped vocabulary a fixture MUST NOT carry.
 * This is the single source: SCHEMA.md documents it and the tests exercise every
 * family of it.
 *
 * Matching is CASE-INSENSITIVE and INFLECTION-AWARE (whole words over a
 * lowercased haystack), because a fixture that says `verdict: "pass"`,
 * `"PASSED"`, `"Accepted"` or `"approved"` is exactly as acceptance-shaped as
 * one that shouts `PASS`. `live-confirmed` is kept as the old matrix's own
 * grade word.
 */
export const ACCEPTANCE_SHAPED_TOKENS = Object.freeze([
  'accept',
  'accepts',
  'accepted',
  'accepting',
  'acceptance',
  'approve',
  'approves',
  'approved',
  'approving',
  'approval',
  'pass',
  'passes',
  'passed',
  'passing',
  'go',
  'green',
  'live-confirmed',
])

/**
 * Keys that could carry a VERDICT / STATUS meaning. Any object key with one of
 * these names is refused outright, at any depth, regardless of its value — a
 * fixture may not smuggle a verdict under a key whose name is the verdict. If a
 * fixture genuinely needs to talk about an observed outcome it must use a
 * descriptive name (e.g. `observedDisposition`), not a grade slot.
 *
 * `disposition` is deliberately NOT in this set: it is the R5 classification
 * (`REPLAY` / `RETIRE` / `UNUSABLE`), a conversion decision, not acceptance.
 */
export const VERDICT_BEARING_KEYS = Object.freeze([
  'verdict',
  'grade',
  'status',
  'acceptance',
  'decision',
  'result',
  'signoff',
  'sign-off',
])

/** A typed refusal: an invalid fixture is an operator error, not a diverged vector. */
export class GoldenVectorError extends Error {
  /**
   * @param {string} code closed refusal code
   * @param {string} detail human-readable detail
   * @param {Record<string, unknown>} [extra]
   */
  constructor(code, detail, extra = {}) {
    super(`${code}: ${detail}`)
    this.name = 'GoldenVectorError'
    this.code = code
    this.detail = detail
    this.extra = Object.freeze({ ...extra })
  }
}

/**
 * Walk an arbitrary fixture value and return the first acceptance-shaped token
 * found, as `{ token, at }`, or the first verdict-bearing KEY, or `null`.
 *
 * @param {unknown} value
 * @param {string} [at]
 * @returns {{ token: string, at: string } | null}
 */
export function findAcceptanceToken(value, at = '$') {
  if (typeof value === 'string') {
    const haystack = value.toLowerCase()
    for (const token of ACCEPTANCE_SHAPED_TOKENS) {
      if (new RegExp(`(^|[^a-z0-9])${token}([^a-z0-9]|$)`).test(haystack)) {
        return { token, at }
      }
    }
    return null
  }
  if (Array.isArray(value)) {
    for (let index = 0; index < value.length; index += 1) {
      const hit = findAcceptanceToken(value[index], `${at}[${String(index)}]`)
      if (hit !== null) return hit
    }
    return null
  }
  if (value !== null && typeof value === 'object') {
    for (const [key, child] of Object.entries(value)) {
      const normalizedKey = String(key).toLowerCase().replace(/[^a-z0-9-]/g, '')
      if (VERDICT_BEARING_KEYS.includes(normalizedKey)) {
        return { token: key, at: `${at}.<key>` }
      }
      const hit = findAcceptanceToken(key, `${at}.<key>`) ?? findAcceptanceToken(child, `${at}.${key}`)
      if (hit !== null) return hit
    }
    return null
  }
  return null
}

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function requireString(value, field) {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new GoldenVectorError('FIXTURE_FIELD_INVALID', `${field} must be a non-empty string`, { field })
  }
  return value
}

/**
 * Validate ONE converted vector. Throws `GoldenVectorError` with a closed code
 * when the fixture is not a regression-only, replayable claim.
 *
 * @param {unknown} vector
 * @returns {true}
 */
export function validateVector(vector) {
  if (!isPlainObject(vector)) {
    throw new GoldenVectorError('FIXTURE_NOT_OBJECT', 'a vector must be an object')
  }
  requireString(vector.id, 'id')
  if (vector.regressionOnly !== true) {
    throw new GoldenVectorError(
      'FIXTURE_NOT_REGRESSION_ONLY',
      `vector '${String(vector.id)}' must carry regressionOnly: true — a corpus entry is never acceptance evidence`,
      { id: vector.id },
    )
  }
  const token = findAcceptanceToken(vector)
  if (token !== null) {
    throw new GoldenVectorError(
      'FIXTURE_ACCEPTANCE_TOKEN',
      `vector '${String(vector.id)}' carries the acceptance-shaped token '${token.token}' at ${token.at}; convert the claim instead of copying a verdict`,
      { id: vector.id, token: token.token, at: token.at },
    )
  }
  if (!DISPOSITIONS.includes(vector.disposition)) {
    throw new GoldenVectorError(
      'FIXTURE_DISPOSITION_INVALID',
      `vector '${String(vector.id)}' has disposition '${String(vector.disposition)}'; expected one of ${DISPOSITIONS.join(', ')}`,
      { id: vector.id },
    )
  }
  requireString(vector.effectClaim, `vector '${String(vector.id)}'.effectClaim`)
  if (!isPlainObject(vector.source)) {
    throw new GoldenVectorError('FIXTURE_FIELD_INVALID', `vector '${String(vector.id)}' has no source object`, { id: vector.id })
  }
  requireString(vector.source.path, `vector '${String(vector.id)}'.source.path`)
  if (!Number.isInteger(vector.source.line) || vector.source.line < 1) {
    throw new GoldenVectorError(
      'FIXTURE_FIELD_INVALID',
      `vector '${String(vector.id)}'.source.line must be a 1-based integer`,
      { id: vector.id },
    )
  }
  if (!isPlainObject(vector.newLane)) {
    throw new GoldenVectorError('FIXTURE_FIELD_INVALID', `vector '${String(vector.id)}' has no newLane object`, { id: vector.id })
  }
  if (!NEW_LANE_OWNERS.includes(vector.newLane.owner)) {
    throw new GoldenVectorError(
      'FIXTURE_FIELD_INVALID',
      `vector '${String(vector.id)}'.newLane.owner must be one of ${NEW_LANE_OWNERS.join(', ')}`,
      { id: vector.id },
    )
  }
  requireString(vector.newLane.entry, `vector '${String(vector.id)}'.newLane.entry`)
  requireString(vector.newLane.module, `vector '${String(vector.id)}'.newLane.module`)

  if (vector.disposition === 'REPLAY_AS_REGRESSION') {
    requireString(vector.derivation, `vector '${String(vector.id)}'.derivation`)
    if (!isPlainObject(vector.compare)) {
      throw new GoldenVectorError(
        'FIXTURE_FIELD_INVALID',
        `replay vector '${String(vector.id)}' has no compare block`,
        { id: vector.id },
      )
    }
    if (!COMPARE_KINDS.includes(vector.compare.kind)) {
      throw new GoldenVectorError(
        'FIXTURE_FIELD_INVALID',
        `replay vector '${String(vector.id)}'.compare.kind must be one of ${COMPARE_KINDS.join(', ')}`,
        { id: vector.id },
      )
    }
    if (!('expected' in vector.compare)) {
      throw new GoldenVectorError(
        'FIXTURE_FIELD_INVALID',
        `replay vector '${String(vector.id)}'.compare.expected is required`,
        { id: vector.id },
      )
    }
    const expected = vector.compare.expected
    if (vector.compare.kind === 'argv') {
      if (!Array.isArray(expected) || expected.some((part) => typeof part !== 'string')) {
        throw new GoldenVectorError(
          'FIXTURE_FIELD_INVALID',
          `argv vector '${String(vector.id)}'.compare.expected must be a string[] (got ${formatValue(expected)})`,
          { id: vector.id },
        )
      }
    }
    if (vector.compare.kind === 'subset' && !isPlainObject(expected)) {
      throw new GoldenVectorError(
        'FIXTURE_FIELD_INVALID',
        `subset vector '${String(vector.id)}'.compare.expected must be an object (got ${formatValue(expected)})`,
        { id: vector.id },
      )
    }
  } else {
    requireString(vector.oldSemantics, `vector '${String(vector.id)}'.oldSemantics`)
  }
  return true
}

function formatValue(value) {
  const text = JSON.stringify(value) ?? String(value)
  return text.length > 120 ? `${text.slice(0, 117)}...` : text
}

/**
 * Structural diff, used by the `equal` comparison. Returns a human-readable
 * reason for the FIRST divergence, or null when the shapes are identical.
 */
function diffEqual(expected, observed, at = 'observation') {
  if (Array.isArray(expected)) {
    if (!Array.isArray(observed)) {
      return `${at}: expected an array, observed ${formatValue(observed)}`
    }
    if (expected.length !== observed.length) {
      return `${at}: expected length ${String(expected.length)}, observed ${String(observed.length)}`
    }
    for (let index = 0; index < expected.length; index += 1) {
      const reason = diffEqual(expected[index], observed[index], `${at}[${String(index)}]`)
      if (reason !== null) return reason
    }
    return null
  }
  if (isPlainObject(expected)) {
    if (!isPlainObject(observed)) {
      return `${at}: expected an object, observed ${formatValue(observed)}`
    }
    const expectedKeys = Object.keys(expected).sort()
    const observedKeys = Object.keys(observed).sort()
    if (expectedKeys.join('\u0000') !== observedKeys.join('\u0000')) {
      return `${at}: expected keys ${formatValue(expectedKeys)}, observed ${formatValue(observedKeys)}`
    }
    for (const key of expectedKeys) {
      const reason = diffEqual(expected[key], observed[key], `${at}.${key}`)
      if (reason !== null) return reason
    }
    return null
  }
  if (!Object.is(expected, observed)) {
    return `${at}: expected ${formatValue(expected)}, observed ${formatValue(observed)}`
  }
  return null
}

function resultOf(status, fields = {}) {
  return Object.freeze({
    status,
    comparison: REGRESSION_LABEL,
    disclaimer: DISCLAIMER,
    ...fields,
  })
}

/**
 * Compare a new-lane observation against one converted vector.
 *
 * @param {unknown} vector a corpus entry (validated here)
 * @param {unknown} observation the new lane's observation (shape is
 *   `compare.kind`-dependent and documented in SCHEMA.md)
 * @returns {{ status: string, comparison: string, disclaimer: string, reason?: string, disposition?: string }}
 *   `status` is `MATCH` | `DIVERGED` | `NOT_APPLICABLE`. The latter two are
 *   never acceptance, and `NOT_APPLICABLE` is returned for every
 *   RETIRE/UNUSABLE vector BEFORE the observation is read.
 */
export function compareObservation(vector, observation) {
  validateVector(vector)

  if (vector.disposition !== 'REPLAY_AS_REGRESSION') {
    const basis = vector.disposition === 'RETIRE_AS_OLD_SEMANTICS' ? 'old-semantics' : 'no-equivalent'
    return resultOf(RESULT.NOT_APPLICABLE, {
      disposition: vector.disposition,
      basis,
      reason: vector.oldSemantics,
    })
  }

  const { kind, expected } = vector.compare
  if (kind === 'lane-decision') {
    const allowed = ['allow', 'ask', 'deny']
    if (!allowed.includes(expected)) {
      throw new GoldenVectorError(
        'FIXTURE_FIELD_INVALID',
        `lane-decision vector '${String(vector.id)}' must expect one of ${allowed.join(', ')}`,
        { id: vector.id },
      )
    }
    if (typeof observation !== 'string' || !allowed.includes(observation)) {
      throw new GoldenVectorError(
        'OBSERVATION_SHAPE_INVALID',
        `lane-decision vector '${String(vector.id)}' needs an observation of ${allowed.join('/')}, observed ${formatValue(observation)}`,
        { id: vector.id },
      )
    }
    if (observation === expected) {
      return resultOf(RESULT.MATCH, { id: vector.id })
    }
    const locator = isPlainObject(vector.input) && typeof vector.input.locator === 'string' ? vector.input.locator : 'locator'
    return resultOf(RESULT.DIVERGED, {
      id: vector.id,
      reason: `${locator}: expected lane decision '${expected}', observed '${observation}'`,
    })
  }

  if (kind === 'argv') {
    if (!Array.isArray(observation) || observation.some((part) => typeof part !== 'string')) {
      throw new GoldenVectorError(
        'OBSERVATION_SHAPE_INVALID',
        `argv vector '${String(vector.id)}' needs a string[] observation`,
        { id: vector.id },
      )
    }
    const expectedArgv = Array.isArray(expected) ? expected : []
    if (observation.length !== expectedArgv.length) {
      return resultOf(RESULT.DIVERGED, {
        id: vector.id,
        reason: `argv length: expected ${String(expectedArgv.length)}, observed ${String(observation.length)}`,
      })
    }
    for (let index = 0; index < expectedArgv.length; index += 1) {
      if (observation[index] !== expectedArgv[index]) {
        return resultOf(RESULT.DIVERGED, {
          id: vector.id,
          reason: `argv[${String(index)}]: expected ${formatValue(expectedArgv[index])}, observed ${formatValue(observation[index])}`,
        })
      }
    }
    return resultOf(RESULT.MATCH, { id: vector.id })
  }

  const reason = kind === 'subset'
    ? diffSubset(expected, observation)
    : diffEqual(expected, observation)
  if (reason === null) {
    return resultOf(RESULT.MATCH, { id: vector.id })
  }
  return resultOf(RESULT.DIVERGED, { id: vector.id, reason })
}

/** Every key in `expected` must be present and deep-equal; extra keys are allowed. */
function diffSubset(expected, observed) {
  if (!isPlainObject(expected)) {
    throw new GoldenVectorError('FIXTURE_FIELD_INVALID', 'a subset expectation must be an object')
  }
  if (!isPlainObject(observed)) {
    return `observation: expected an object, observed ${formatValue(observed)}`
  }
  for (const key of Object.keys(expected)) {
    if (!(key in observed)) {
      return `observation.${key}: expected key missing`
    }
    const reason = diffEqual(expected[key], observed[key], `observation.${key}`)
    if (reason !== null) return reason
  }
  return null
}

/**
 * The exact human string for a result: `MATCH`, `DIVERGED(<reason>)`, or
 * `NOT_APPLICABLE(old-semantics)` / `NOT_APPLICABLE(no-equivalent)`.
 *
 * @param {{ status: string, reason?: string, basis?: string }} result
 * @returns {string}
 */
export function describeResult(result) {
  if (result.status === RESULT.MATCH) return 'MATCH'
  if (result.status === RESULT.DIVERGED) return `DIVERGED(${String(result.reason)})`
  if (result.status === RESULT.NOT_APPLICABLE) return `NOT_APPLICABLE(${String(result.basis)})`
  throw new GoldenVectorError('RESULT_UNKNOWN', `unknown result status '${String(result.status)}'`)
}

/**
 * Read and validate a corpus file (CLI helper; also used by the tests).
 *
 * @param {string} corpusPath
 * @returns {{ corpus: Record<string, unknown>, vectors: readonly unknown[] }}
 */
export function loadCorpus(corpusPath) {
  const corpus = JSON.parse(readFileSync(corpusPath, 'utf8'))
  if (!isPlainObject(corpus) || !Array.isArray(corpus.vectors)) {
    throw new GoldenVectorError('CORPUS_INVALID', `${corpusPath} has no vectors[] array`)
  }
  const token = findAcceptanceToken(corpus)
  if (token !== null) {
    throw new GoldenVectorError(
      'CORPUS_ACCEPTANCE_TOKEN',
      `${corpusPath} carries the acceptance-shaped token '${token.token}' at ${token.at}`,
      { token: token.token, at: token.at },
    )
  }
  for (const vector of corpus.vectors) validateVector(vector)
  return { corpus, vectors: corpus.vectors }
}

const HERE = dirname(fileURLToPath(import.meta.url))
const DEFAULT_CORPUS = join(HERE, 'vectors.json')

function parseArgs(argv) {
  const options = { corpus: DEFAULT_CORPUS, vector: null, observation: null }
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]
    if (arg === '--corpus') options.corpus = argv[++index]
    else if (arg === '--vector') options.vector = argv[++index]
    else if (arg === '--observation') options.observation = argv[++index]
    else if (arg === '--help' || arg === '-h') options.help = true
    else throw new GoldenVectorError('CLI_ARGUMENT_UNKNOWN', `unknown argument '${arg}'`)
  }
  return options
}

const USAGE = `usage: node tests/kits/a5sf-golden/compare.mjs --vector <id> --observation <json> [--corpus <path>]

Compares a new-lane observation against ONE converted old golden vector.
This is a regression comparison, not a gate:
  MATCH                       exit 0
  DIVERGED(<reason>)          exit 1
  NOT_APPLICABLE(<basis>)     exit 0
fixture refused / bad input   exit 2
`

if (process.argv[1] !== undefined && fileURLToPath(import.meta.url) === process.argv[1]) {
  try {
    const options = parseArgs(process.argv.slice(2))
    if (options.help === true) {
      process.stdout.write(USAGE)
    } else {
      if (typeof options.vector !== 'string' || typeof options.observation !== 'string') {
        throw new GoldenVectorError('CLI_ARGUMENT_MISSING', '--vector and --observation are required')
      }
      const { vectors } = loadCorpus(options.corpus)
      const vector = vectors.find((candidate) => candidate.id === options.vector)
      if (vector === undefined) {
        throw new GoldenVectorError('VECTOR_UNKNOWN', `no vector '${options.vector}' in ${options.corpus}`)
      }
      const result = compareObservation(vector, JSON.parse(options.observation))
      process.stdout.write(`${describeResult(result)}\n${JSON.stringify(result, null, 2)}\n`)
      process.exitCode = result.status === RESULT.DIVERGED ? 1 : 0
    }
  } catch (error) {
    const code = error instanceof GoldenVectorError ? error.code : 'INTERNAL_ERROR'
    process.stderr.write(`REFUSED(${code}): ${String(error?.message ?? error)}\n`)
    process.exitCode = 2
  }
}
