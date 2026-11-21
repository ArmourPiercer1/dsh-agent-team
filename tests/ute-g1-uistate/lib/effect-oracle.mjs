/**
 * effect-oracle.mjs — turn a measured call into a graded row.
 *
 * The row is the retirement ledger's unit of evidence: the census member, the
 * covered class, the OUTCOME, the refusal CATEGORY (the owner's closed
 * vocabulary, resolved through the family-local map), the typed code, the
 * independently corroborated effects and the load-bearing facts.
 *
 * Nothing here decides what "pass" means: the comparison against the golden
 * and the corpus design claim do (compare.mjs), and the suite asserts both.
 *
 * @module tests/ute-g1-uistate/lib/effect-oracle
 */
import { CATEGORY_IDS, categoryOfFamilyRefusal, isNoRefusal, REFUSAL_CATEGORIES } from './refusal-map.mjs'

/** The reviewed TSV header (order is part of the fixture contract). */
export const ROW_HEADER = Object.freeze(['id', 'entry', 'family', 'class', 'outcome', 'refusal', 'code', 'effects', 'facts'])

/**
 * Classify one raw observation into a graded row.
 * @param {object} vector - the corpus vector (the design claim).
 * @param {object} raw - what `runVector` observed.
 */
export function classifyRecord(vector, raw) {
  const category = isNoRefusal(raw.code) ? null : categoryOfFamilyRefusal(raw.code).category
  return Object.freeze({
    id: vector.id,
    entry: vector.member,
    family: vector.family,
    klass: vector.klass,
    outcome: raw.outcome,
    refusal: category,
    code: raw.code,
    effects: raw.effects,
    facts: raw.facts,
    notes: raw.notes ?? [],
  })
}

/** The canonical cell for a facts record (sorted, so the fixture is stable). */
export function factsCell(facts) {
  return Object.keys(facts).sort().map((key) => `${key}=${String(facts[key])}`).join(',')
}

/** One graded row -> the TSV cells. */
export function recordToRow(record) {
  return [
    record.id,
    record.entry,
    record.family,
    record.klass,
    record.outcome,
    record.refusal === null ? '-' : record.refusal,
    record.code,
    record.effects,
    factsCell(record.facts),
  ].join('\t')
}

/** The TSV cells -> one graded row. */
export function rowToRecord(line) {
  const cells = line.split('\t')
  if (cells.length !== ROW_HEADER.length) throw new Error(`golden row has ${String(cells.length)} cells, expected ${String(ROW_HEADER.length)}: ${JSON.stringify(line)}`)
  const [id, entry, family, klass, outcome, refusal, code, effects, facts] = cells
  const parsedFacts = {}
  for (const part of facts.split(',')) {
    if (part.length === 0) continue
    const index = part.indexOf('=')
    parsedFacts[part.slice(0, index)] = Number(part.slice(index + 1))
  }
  return Object.freeze({
    id, entry, family, klass, outcome,
    refusal: refusal === '-' ? null : refusal,
    code, effects, facts: parsedFacts, notes: [],
  })
}

/** Every typed code a set of rows observed, sorted. */
export function observedCodes(records) {
  return [...new Set(records.map((record) => record.code).filter((code) => !isNoRefusal(code)))].sort()
}

/**
 * The PRINTED EXCLUSION SET: categories this corpus deliberately does not
 * reach, each with the measured reason. A category that IS reached must not
 * appear here, and every category must appear in exactly one of the two sets —
 * that is what the suite asserts.
 */
export const CATEGORY_EXCLUSIONS = Object.freeze({
  'read-before-write': 'no read-then-write contract exists in either family: todo_write replaces a whole list, the goal rows read fresh state INSIDE the store transaction (so a stale observation is `stale-version`, measured by AS-U8), and neither row exposes a write that requires a prior read',
  'route-unresolved': 'the two families refuse a missing backend at MOUNT time (PLANE_AGENT_STATE_STORE_MISSING / an unbuilt family), so no CALL-level route-unresolved refusal is observable from the rows themselves; the ui port absence is refused by the ROW (unsupported-mode, measured by UI-A8) because the row exists and answers',
  unknown: 'every code the corpus observes is explicitly mapped with a citation; the map has no default bucket and no prose fallback, so an unmapped value raises REFUSAL_VOCABULARY_INCOMPLETE instead of landing here',
})

/** Categories the corpus reaches, given its observed codes. */
export function categoricalCoverage(records) {
  const reached = new Set(records.map((record) => record.refusal).filter((refusal) => refusal !== null))
  const missing = CATEGORY_IDS.filter((id) => !reached.has(id) && !Object.hasOwn(CATEGORY_EXCLUSIONS, id))
  const undeclaredReached = [...reached].filter((id) => Object.hasOwn(CATEGORY_EXCLUSIONS, id))
  return { reached: [...reached].sort(), missing, undeclaredReached, exclusions: CATEGORY_EXCLUSIONS, vocabulary: REFUSAL_CATEGORIES }
}
