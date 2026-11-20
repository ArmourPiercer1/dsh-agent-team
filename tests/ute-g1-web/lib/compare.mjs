/**
 * compare.mjs — grade a captured record against the old-path golden and against
 * the corpus's DESIGN CLAIM.
 *
 * The comparison is deliberately structural. Everything the retirement argument
 * rests on IS compared: the member, the declared network axis, the allow/deny
 * outcome, the refusal CATEGORY, the corroborating server witness, the admitted
 * result, the guard-fact counts, the model-facing text and the socket witness.
 * The typed `codes` cell is recorded but NOT compared (the category is the
 * compatibility interface; the code is the surface that the two paths are
 * allowed to spell differently).
 *
 * @module tests/ute-g1-web/lib/compare
 */
import { servedBytes, typedCodeOf } from './effect-oracle.mjs'
import { ROW_HEADER, recordToRow, rowToRecord } from './scenario.mjs'

/** Fields the harness grades. `codes` is captured but never a pass condition. */
export const COMPARED_FIELDS = Object.freeze(['entry', 'network', 'outcome', 'refusal', 'effects', 'facts', 'text', 'net'])

/** The canonical cell for one field. */
export function fieldValue(record, field) {
  switch (field) {
    case 'effects':
      return record.effects.map((effect) => [effect.path, effect.exists ? 'present' : 'absent', effect.bytes ?? '-', effect.sha256 ?? '-', effect.mode ?? '-'].join('|')).join(';')
    case 'facts':
      return `fetches=${record.facts.fetches},searches=${record.facts.searches},allow=${record.facts.allowFacts},deny=${record.facts.denyFacts},hostweb=${record.facts.hostWeb}`
    case 'net':
      return `loopback=${record.net.loopback},external=${record.net.external}`
    default: {
      const value = record[field]
      if (value === null || value === undefined) return '-'
      if (Array.isArray(value)) return value.join(',')
      return String(value)
    }
  }
}

/**
 * Compare one record against the golden.
 * @returns {{id: string, ok: boolean, diffs: Array<{field: string, expected: string, observed: string}>}}
 */
export function compareRecord(expected, observed) {
  const diffs = []
  for (const field of COMPARED_FIELDS) {
    const left = fieldValue(expected, field)
    const right = fieldValue(observed, field)
    if (left !== right) diffs.push({ field, expected: left, observed: right })
  }
  return { id: expected.id, ok: diffs.length === 0, diffs }
}

/** Compare a whole corpus run against the golden. */
export function compareAll(golden, observed) {
  const observedById = new Map(observed.map((record) => [record.id, record]))
  const goldenIds = new Set(golden.map((record) => record.id))
  const verdicts = []
  for (const expected of golden) {
    const actual = observedById.get(expected.id)
    if (actual === undefined) {
      verdicts.push({ id: expected.id, ok: false, diffs: [{ field: 'record', expected: 'present', observed: 'MISSING' }] })
      continue
    }
    verdicts.push(compareRecord(expected, actual))
  }
  return {
    verdicts,
    failures: verdicts.filter((verdict) => !verdict.ok),
    missingGolden: observed.filter((record) => !goldenIds.has(record.id)).map((record) => record.id),
    missingObserved: golden.filter((record) => !observedById.has(record.id)).map((record) => record.id),
  }
}

/** Serialize records as the reviewed TSV fixture (header + one row per vector). */
export function serializeGolden(records) {
  return `${[ROW_HEADER.join('\t'), ...records.map((record) => recordToRow(record))].join('\n')}\n`
}

/** Parse the reviewed TSV fixture (header drift is a hard error). */
export function parseGolden(text) {
  const lines = text.split('\n').filter((line) => line.trim().length > 0)
  if (lines[0].split('\t').join('\t') !== ROW_HEADER.join('\t')) {
    throw new Error(`golden fixture header drifted: expected ${JSON.stringify(ROW_HEADER.join('\t'))}, got ${JSON.stringify(lines[0])}`)
  }
  return lines.slice(1).map(rowToRecord)
}

/** Read one effect by path. */
export function effectOf(record, path) {
  return (record.effects ?? []).find((effect) => effect.path === path)
}

/** Parse an effect's `mode` cell into a map. */
export function modeOf(record, path) {
  const effect = effectOf(record, path)
  if (effect === undefined) return undefined
  const mode = {}
  for (const part of String(effect.mode ?? '').split(',')) {
    const index = part.indexOf('=')
    if (index === -1) continue
    mode[part.slice(0, index)] = part.slice(index + 1)
  }
  return { effect, mode }
}

/**
 * Check one captured record against the corpus's DESIGN CLAIM. A claim the old
 * path does not satisfy is a CORPUS BUG, reported RED — not a green.
 *
 * @param {object} vector - the corpus vector.
 * @param {object} record - the captured record.
 * @returns {string[]} problems (empty means the claim holds).
 */
export function checkDesignClaim(vector, record) {
  const problems = []
  const expect = vector.expect
  if (expect.outcome !== record.outcome) problems.push(`outcome: corpus claims ${expect.outcome}, old path observed ${record.outcome}`)
  if ((expect.refusal ?? null) !== record.refusal) {
    problems.push(`refusal: corpus claims ${expect.refusal === null ? 'none' : expect.refusal}, old path observed ${record.refusal === null ? 'none' : record.refusal}`)
  }
  if (expect.code !== undefined && !record.codes.includes(expect.code)) {
    problems.push(`code: corpus claims ${expect.code}, old path observed ${record.codes.join(',') || '-'}`)
  }
  if (expect.textualCode === true && typedCodeOf(record.text) !== null) {
    problems.push(`code: corpus claims NO typed code in the model text, but the text carries '${String(typedCodeOf(record.text))}'`)
  }
  // The corroborating side effect: the server's OWN arrival log.
  const requests = (record.effects ?? []).find((effect) => effect.path === '@srv:requests')
  const expectedRequests = [...expect.requests]
  if (vector.concurrent === true) expectedRequests.sort()
  const observedList = requests === undefined ? [] : String(requests.mode ?? '').replace(/^[^,]*,list=/, '')
  const normalizedObserved = observedList === '-' ? [] : observedList.split('+')
  if (normalizedObserved.join('|') !== expectedRequests.join('|')) {
    problems.push(`requests: corpus claims ${JSON.stringify(expectedRequests)}, fixture served ${JSON.stringify(normalizedObserved)}`)
  }
  if (requests !== undefined && requests.bytes !== expectedRequests.length) {
    problems.push(`request count: corpus claims ${String(expectedRequests.length)}, fixture logged ${String(requests.bytes)}`)
  }
  if (expect.providerFetches !== undefined && record.facts.fetches !== expect.providerFetches) {
    problems.push(`provider fetches: corpus claims ${String(expect.providerFetches)}, composition recorded ${String(record.facts.fetches)}`)
  }
  if (expect.providerSearches !== undefined && record.facts.searches !== expect.providerSearches) {
    problems.push(`provider searches: corpus claims ${String(expect.providerSearches)}, composition recorded ${String(record.facts.searches)}`)
  }
  if (!Number.isInteger(record.facts.hostWeb) || record.facts.hostWeb !== 0) {
    problems.push(`the inherited host web service was consulted ${String(record.facts.hostWeb)} time(s); the route-C face must own the pair`)
  }
  if (record.net.external !== 0) {
    problems.push(`the socket witness recorded ${String(record.net.external)} non-loopback connect attempt(s)`)
  }
  if (expect.outcome === 'allow' && record.net.loopback !== 'yes') {
    problems.push('an admitted web call opened no loopback socket; the effect is not corroborated by a wire event')
  }
  // The admitted result's own facts.
  const result = modeOf(record, '@result')
  if (expect.outcome === 'allow') {
    if (result === undefined || result.effect.exists !== true) {
      problems.push('corpus claims an admitted result, but the record carries none')
    } else {
      if (expect.status !== undefined && result.mode.status !== String(expect.status)) {
        problems.push(`status: corpus claims ${String(expect.status)}, old path observed ${String(result.mode.status)}`)
      }
      if (expect.bodyKind !== undefined && result.mode.kind !== expect.bodyKind) {
        problems.push(`body kind: corpus claims ${expect.bodyKind}, old path observed ${String(result.mode.kind)}`)
      }
      if (expect.truncated !== undefined && result.mode.truncated !== (expect.truncated ? 'yes' : 'no')) {
        problems.push(`truncated: corpus claims ${String(expect.truncated)}, old path observed ${String(result.mode.truncated)}`)
      }
      if (expect.sourceCount !== undefined && result.mode.sources !== String(expect.sourceCount)) {
        problems.push(`sources: corpus claims ${String(expect.sourceCount)}, old path observed ${String(result.mode.sources)}`)
      }
    }
  } else if (result !== undefined && result.effect.exists !== false) {
    problems.push('corpus claims a refusal, but the record carries an admitted result')
  }
  for (const needle of expect.includes ?? []) {
    if (!record.text.includes(needle)) problems.push(`model text is missing ${JSON.stringify(needle)}`)
  }
  return problems
}

/** The bytes cell of a record's server witness (used by the controls). */
export function servedBytesOf(record) {
  return servedBytes(
    String(modeOf(record, '@srv:requests')?.mode?.list ?? '-') === '-'
      ? []
      : String(modeOf(record, '@srv:requests').mode.list).split('+').map((line) => {
        const space = line.indexOf(' ')
        return { method: line.slice(0, space), path: line.slice(space + 1) }
      }),
  )
}
