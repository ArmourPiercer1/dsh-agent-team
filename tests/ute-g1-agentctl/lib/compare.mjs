/**
 * compare.mjs — the graded fields, the reviewed TSV serializer/parser, and the
 * corpus DESIGN-CLAIM check.
 *
 * Every field except the two observation-only ones is graded. `state` is a
 * digest of the injected port's state + the legs it saw, so an effect claim is
 * corroborated by a real state change rather than by the returned payload alone.
 *
 * @module tests/ute-g1-agentctl/lib/compare
 */
import { RECORD_FIELDS } from './scenario.mjs'

/** The reviewed TSV fixture's columns, in order. */
export const ROW_HEADER = RECORD_FIELDS

/** Serialize one record to its TSV line. */
export function recordRow(record) {
  return ROW_HEADER.map((field) => String(record[field] ?? '-')).join('\t')
}

/** Serialize a capture. */
export function serializeGolden(records) {
  return `${[ROW_HEADER.join('\t'), ...records.map(recordRow)].join('\n')}\n`
}

/** Parse a reviewed TSV fixture. */
export function parseGolden(text) {
  const lines = text.split('\n').filter((line) => line.trim().length > 0)
  const header = lines[0].split('\t')
  if (header.join('\t') !== ROW_HEADER.join('\t')) {
    throw new Error(`golden fixture header drifted: expected ${JSON.stringify(ROW_HEADER.join('\t'))}, got ${JSON.stringify(lines[0])}`)
  }
  return lines.slice(1).map((line) => {
    const cells = line.split('\t')
    if (cells.length !== ROW_HEADER.length) throw new Error(`golden row has ${cells.length} cells, expected ${ROW_HEADER.length}: ${line}`)
    return Object.fromEntries(ROW_HEADER.map((field, index) => [field, cells[index]]))
  })
}

/** Compare one record against its golden row; returns the differing fields. */
export function compareRecord(goldenRow, observed) {
  const failures = []
  for (const field of ROW_HEADER) {
    if (String(goldenRow[field]) !== String(observed[field])) {
      failures.push({ id: observed.id, field, golden: goldenRow[field], observed: observed[field] })
    }
  }
  return failures
}

/** Compare a whole capture; also reports missing/extra vectors by id. */
export function compareAll(golden, observed) {
  const failures = []
  const goldenById = new Map(golden.map((row) => [row.id, row]))
  const observedById = new Map(observed.map((row) => [row.id, row]))
  for (const [id, row] of goldenById) {
    const match = observedById.get(id)
    if (match === undefined) { failures.push({ id, field: 'id', golden: id, observed: 'MISSING' }); continue }
    failures.push(...compareRecord(row, match))
  }
  return {
    failures: Object.freeze(failures),
    missingObserved: Object.freeze([...goldenById.keys()].filter((id) => !observedById.has(id))),
    missingGolden: Object.freeze([...observedById.keys()].filter((id) => !goldenById.has(id))),
  }
}

/**
 * The corpus's own DESIGN CLAIM, checked against what the old path did. A claim
 * the old path does not satisfy is a CORPUS BUG (red), never a green: it means
 * the vector was written against an assumption the measured path did not honour.
 *
 * @param {object} vector
 * @param {object} record
 * @returns {ReadonlyArray<{id: string, claim: string, expected: string, observed: string}>}
 */
export function checkDesignClaim(vector, record) {
  const claim = vector.expect
  const facts = new Map(String(record.facts).split(';').map((part) => {
    const index = part.indexOf('=')
    return [part.slice(0, index), part.slice(index + 1)]
  }))
  const failures = []
  const expectEqual = (field, expected, observed) => {
    if (String(expected) !== String(observed)) failures.push({ id: vector.id, claim: field, expected: String(expected), observed: String(observed) })
  }
  expectEqual('outcome', claim.outcome, record.outcome)
  expectEqual('refusal', claim.refusal ?? '-', record.refusal)
  if (claim.category !== undefined) expectEqual('category', claim.category, record.category)
  if (claim.calls !== undefined) expectEqual('calls', claim.calls, facts.get('calls'))
  if (claim.control !== undefined) expectEqual('control', claim.control, facts.get('control'))
  if (claim.stateContains !== undefined) {
    if (!record.state.includes(claim.stateContains)) failures.push({ id: vector.id, claim: 'stateContains', expected: claim.stateContains, observed: record.state })
  }
  if (claim.payloadContains !== undefined) {
    if (!record.payload.includes(claim.payloadContains)) failures.push({ id: vector.id, claim: 'payloadContains', expected: claim.payloadContains, observed: record.payload })
  }
  return failures
}
