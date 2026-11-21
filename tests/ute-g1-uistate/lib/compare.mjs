/**
 * compare.mjs — grade a capture against the golden and against its own design
 * claim.
 *
 * Everything the retirement argument rests on IS compared: the member, the
 * family, the covered class, the allow/deny/cancelled outcome, the refusal
 * CATEGORY, the corroborated effects and the load-bearing facts. The typed
 * `code` cell is captured and printed but NOT a pass condition — the category
 * is the compatibility interface, exactly as the fs/search/web lanes define it
 * — while the DESIGN CLAIM still pins the exact code per vector, so a code
 * that silently changes is a RED corpus, not a tolerated drift.
 *
 * @module tests/ute-g1-uistate/lib/compare
 */
import { ROW_HEADER, recordToRow, rowToRecord } from './effect-oracle.mjs'

/** Fields the golden comparison grades. `code` is captured, not compared. */
export const COMPARED_FIELDS = Object.freeze(['entry', 'family', 'class', 'outcome', 'refusal', 'effects', 'facts'])

/** The canonical cell for one compared field. */
export function fieldValue(record, field) {
  if (field === 'refusal') return record.refusal === null ? '-' : String(record.refusal)
  if (field === 'facts') {
    const facts = record.facts
    return Object.keys(facts).sort().map((key) => `${key}=${String(facts[key])}`).join(',')
  }
  return String(record[field])
}

/** Compare one record against the golden. */
export function compareRecord(expected, observed) {
  const diffs = []
  for (const field of COMPARED_FIELDS) {
    const left = fieldValue(expected, field)
    const right = fieldValue(observed, field)
    if (left !== right) diffs.push({ field, expected: left, observed: right })
  }
  return { id: expected.id, ok: diffs.length === 0, diffs }
}

/** Compare a whole capture against the golden. */
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

/** Serialize the reviewed TSV fixture (header + one row per vector). */
export function serializeGolden(records) {
  return `${[ROW_HEADER.join('\t'), ...records.map(recordToRow)].join('\n')}\n`
}

/** Parse the reviewed TSV fixture (header drift is a hard error). */
export function parseGolden(text) {
  const lines = text.split('\n').filter((line) => line.trim().length > 0)
  if (lines[0] !== ROW_HEADER.join('\t')) {
    throw new Error(`golden fixture header drifted: expected ${JSON.stringify(ROW_HEADER.join('\t'))}, got ${JSON.stringify(lines[0])}`)
  }
  return lines.slice(1).map(rowToRecord)
}

/**
 * Check one captured record against its corpus DESIGN CLAIM. A claim the old
 * path does not satisfy is a CORPUS bug reported RED — never a green.
 *
 * @param {object} vector - the corpus vector.
 * @param {object} record - the captured row.
 * @returns {string[]} problems (empty means the claim holds).
 */
export function checkDesignClaim(vector, record) {
  const problems = []
  const expect = vector.expect
  if (record.outcome !== expect.outcome) problems.push(`outcome: corpus claims ${expect.outcome}, observed ${record.outcome}`)
  if (record.refusal !== expect.refusal) problems.push(`refusal: corpus claims ${expect.refusal === null ? 'none' : expect.refusal}, observed ${record.refusal === null ? 'none' : record.refusal}`)
  if (record.code !== expect.code) problems.push(`code: corpus claims ${expect.code}, observed ${record.code}`)
  if (expect.portCalls !== undefined && record.facts.portCalls !== expect.portCalls) {
    problems.push(`portCalls: corpus claims ${String(expect.portCalls)}, observed ${String(record.facts.portCalls)}`)
  }
  if (expect.durableWrites !== undefined && record.facts.durableWrites !== expect.durableWrites) {
    problems.push(`durableWrites: corpus claims ${String(expect.durableWrites)}, observed ${String(record.facts.durableWrites)}`)
  }
  // A refusal must never claim an effect it did not perform.
  if (record.outcome === 'deny' && expect.durableWrites === 0 && record.effects.includes('@record:')) {
    const writes = record.facts.durableWrites ?? 0
    if (writes !== 0) problems.push(`a refused call committed ${String(writes)} durable write(s)`)
  }
  return problems
}
