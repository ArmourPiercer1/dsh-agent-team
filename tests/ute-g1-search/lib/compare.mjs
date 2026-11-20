/**
 * compare.mjs — grade a captured record against the old-path golden, and check
 * a captured record against the corpus's DESIGN CLAIM.
 *
 * The comparison is deliberately structural: the typed codes and the provider
 * counters are RECORDED and (for `codes`) not compared, while everything the
 * retirement argument rests on IS compared: the declared lanes, the
 * allow/deny outcome, the refusal CATEGORY, the canonical match effect, the
 * filesystem witness and the leak checks. Nothing machine-specific (absolute
 * paths, mtimes, pids, walk order) is in a record at all.
 *
 * @module tests/ute-g1-search/lib/compare
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

/** Read one synthetic effect (`@matches:<entry>` / `@fs:tree`). */
export function effectOf(record, path) {
  return (record.effects ?? []).find((effect) => effect.path === path)
}

/** Parse a `@matches:` effect's `mode` cell (`retained=…,paths=…,keys=…`). */
export function matchMode(record, entry) {
  const effect = effectOf(record, `@matches:${entry}`)
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
 * @returns {string[]} problems (empty means the claim holds).
 */
export function checkDesignClaim(vector, record) {
  const problems = []
  if (vector.expect.outcome !== record.outcome) {
    problems.push(`outcome: corpus claims ${vector.expect.outcome}, old path observed ${record.outcome}`)
  }
  if ((vector.expect.refusal ?? null) !== record.refusal) {
    problems.push(`refusal: corpus claims ${vector.expect.refusal === null ? 'none' : vector.expect.refusal}, old path observed ${record.refusal === null ? 'none' : record.refusal}`)
  }
  const matches = matchMode(record, vector.entry)
  if (matches === undefined) {
    problems.push(`no @matches:${vector.entry} effect was recorded`)
  } else if (vector.expect.matches === null) {
    if (matches.effect.exists !== false) problems.push('corpus claims no match observation, but the record carries one')
  } else {
    if (matches.effect.exists !== true) problems.push('corpus claims a match observation, but the record carries none')
    if (matches.effect.bytes !== vector.expect.matches.count) {
      problems.push(`match count: corpus claims ${vector.expect.matches.count}, old path observed ${String(matches.effect.bytes)}`)
    }
    const keys = matches.mode.keys === '-' ? [] : String(matches.mode.keys ?? '').split('+')
    if (vector.expect.matches.paths.length > 8) {
      problems.push('the corpus claim may not name more than 8 paths (the keys cell caps at 8); use a count-only arm')
    } else if (keys.join('+') !== vector.expect.matches.paths.join('+')) {
      problems.push(`match paths: corpus claims ${JSON.stringify(vector.expect.matches.paths)}, old path observed ${JSON.stringify(keys)}`)
    }
    if (vector.expect.matches.retained !== undefined && Number(matches.mode.retained) !== vector.expect.matches.retained) {
      problems.push(`retention: corpus claims ${vector.expect.matches.retained} presented, old path presented ${String(matches.mode.retained)}`)
    }
  }
  const tree = effectOf(record, '@fs:tree')
  if (vector.expect.fsUnchanged === true && tree?.mode !== 'unchanged') {
    problems.push(`the search MUTATED the fixture tree (witness mode=${String(tree?.mode)})`)
  }
  if ((record.leaks ?? []).length > 0) {
    problems.push(`the old path returned a secret token: ${record.leaks.join(',')}`)
  }
  return problems
}
