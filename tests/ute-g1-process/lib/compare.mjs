/**
 * compare.mjs — grade a captured record against the old-path golden, and check
 * a captured record against the corpus's DESIGN CLAIM.
 *
 * The comparison is deliberately structural: the typed code cell and the
 * provider counters are RECORDED and (for `codes`) not compared, while
 * everything the retirement argument rests on IS compared: the declared lanes,
 * the allow/deny outcome, the refusal CATEGORY, the child's record effect
 * (exit status + settle flags), the normalized stdout/stderr digests, the
 * filesystem witness and the leak checks. Nothing machine-specific (absolute
 * paths, mtimes, pids, walk order, wall-clock) is in a record at all.
 *
 * @module tests/ute-g1-process/lib/compare
 */
import { effectsCell } from './effect-oracle.mjs'
import { ROW_HEADER, recordToRow, rowToRecord } from './scenario.mjs'

/** Fields the harness grades. `codes` is captured but never a pass condition. */
export const COMPARED_FIELDS = Object.freeze(['entry', 'laneRead', 'laneWrite', 'outcome', 'refusal', 'effects', 'facts', 'leaks'])

/** The canonical cell for one field. */
export function fieldValue(record, field) {
  if (field === 'effects') return effectsCell(record.effects ?? [])
  if (field === 'leaks') return (record.leaks ?? []).join(',') || '-'
  if (field === 'facts') {
    const facts = record.facts ?? {}
    return `confined=${facts.confined},allow=${facts.allowFacts},deny=${facts.denyFacts},base=${facts.baseCalls}`
  }
  const value = record[field]
  if (value === null || value === undefined) return '-'
  if (Array.isArray(value)) return value.join(',')
  return String(value)
}

/**
 * Compare one record.
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

/** Compare a whole corpus run. */
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

/** Read one synthetic effect (`@process` / `@stdout` / `@fs:tree`). */
export function effectOf(record, path) {
  return (record.effects ?? []).find((effect) => effect.path === path)
}

/** Parse a `@process` effect's `mode` cell into its flags. */
export function processMode(record) {
  const effect = effectOf(record, '@process')
  if (effect === undefined) return undefined
  const mode = {}
  for (const part of String(effect.mode ?? '').split(',')) {
    const index = part.indexOf('=')
    if (index > 0) mode[part.slice(0, index)] = part.slice(index + 1)
  }
  mode.exit = effect.bytes
  return mode
}
