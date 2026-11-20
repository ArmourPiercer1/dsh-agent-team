/**
 * compare.mjs — grade a prototype record against the old-path golden.
 *
 * The comparison is deliberately narrower than "the records are equal": the
 * typed CODES are recorded but NOT compared (the two host generations own
 * different code vocabularies; the corpus compares the refusal CLASS), and
 * nothing machine-specific (absolute paths, mtimes, pids) is in a record at all.
 *
 * The fields that ARE compared are the ones the retirement argument rests on:
 * the declared lanes, the allow/deny outcome, the refusal class, the observed
 * file effects (existence + bytes + sha256 + mode) and the leak checks.
 *
 * @module tests/ute-g1-fs/lib/compare
 */
import { effectsCell } from './effect-oracle.mjs'
import { categoryOfLegacyRefusal, categoryOfNativeRefusal, isNoRefusal } from './refusal-categories.mjs'
import { ROW_HEADER, recordToRow, rowToRecord } from './scenario.mjs'

/** Fields the harness grades. `codes` is captured but never a pass condition. */
export const COMPARED_FIELDS = Object.freeze(['entry', 'laneRead', 'laneWrite', 'outcome', 'refusal', 'effects', 'leaks'])

/** The canonical cell for one field (so effects are compared structurally). */
export function fieldValue(record, field) {
  if (field === 'effects') return effectsCell(record.effects ?? [])
  if (field === 'leaks') return (record.leaks ?? []).join(',') || '-'
  const value = record[field]
  if (value === null || value === undefined) return '-'
  if (Array.isArray(value)) return value.join(',')
  return String(value)
}

/**
 * Compare one record.
 * @param {object} expected - the golden (old path) record.
 * @param {object} observed - the prototype record.
 * @returns {{id: string, ok: boolean, diffs: Array<{field: string, expected: string, observed: string}>}}
 */
export function compareRecord(expected, observed) {
  const diffs = []
  for (const field of COMPARED_FIELDS) {
    // PR #800's compatibility interface: a refusal is compared by its CLOSED
    // CATEGORY, not by class/code/text equality. Both sides must classify
    // (an unmapped value throws REFUSAL_VOCABULARY_INCOMPLETE), and an allow
    // compares as "no refusal".
    if (field === 'refusal') {
      const left = refusalCategory(expected)
      const right = refusalCategory(observed)
      if (left !== right) {
        diffs.push({
          field,
          expected: `${expected.refusal ?? '-'}[${left ?? 'none'}]`,
          observed: `${observed.refusal ?? '-'}[${right ?? 'none'}]`,
        })
      }
      continue
    }
    const left = fieldValue(expected, field)
    const right = fieldValue(observed, field)
    if (left !== right) diffs.push({ field, expected: left, observed: right })
  }
  return { id: expected.id, ok: diffs.length === 0, diffs }
}

/** The closed refusal category of a record, or null for an allow. */
function refusalCategory(record) {
  if (isNoRefusal(record.refusal)) return null
  const code = (record.codes ?? [])[0]
  return categoryOfNativeRefusal({ code, refusal: record.refusal }).category
}

/**
 * Compare a whole corpus run.
 * @param {readonly object[]} golden
 * @param {readonly object[]} observed
 * @returns {{verdicts: object[], failures: object[], missingGolden: string[], missingObserved: string[]}}
 */
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

/** Parse the reviewed TSV fixture. */
export function parseGolden(text) {
  const lines = text.split('\n').filter((line) => line.trim().length > 0)
  const header = lines[0].split('\t')
  if (header.join('\t') !== ROW_HEADER.join('\t')) {
    throw new Error(`golden fixture header drifted: expected ${JSON.stringify(ROW_HEADER.join('\t'))}, got ${JSON.stringify(lines[0])}`)
  }
  return lines.slice(1).map(rowToRecord)
}

/**
 * Check a captured old-path record against the corpus's DESIGN CLAIM. A claim
 * the old path does not satisfy is a corpus bug, not a green.
 */
export function checkDesignClaim(vector, record) {
  const problems = []
  if (vector.expect.outcome !== record.outcome) {
    problems.push(`outcome: corpus claims ${vector.expect.outcome}, old path observed ${record.outcome}`)
  }
  if (vector.expect.refusal !== record.refusal) {
    problems.push(`refusal: corpus claims ${required(vector.expect.refusal)}, old path observed ${required(record.refusal)}`)
  }
  if (record.leaks.length > 0) problems.push(`the old path returned a secret token: ${record.leaks.join(',')}`)
  return problems
}

function required(value) {
  return value === null ? 'none' : value
}
