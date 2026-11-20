/**
 * new-path-compare.mjs — grade a NEW-PATH run against the SAME golden row B1
 * captured, with the declared-divergence channel made explicit and TOTAL.
 *
 * WHY A SECOND COMPARATOR FILE. `lib/compare.mjs` answers "is this record equal
 * to the golden row, field by field?". That is the right question for a
 * reproduction run, but it is not the whole question a retirement claim has to
 * answer: a new path may legitimately differ from the old one on a difference
 * this family has ALREADY declared (and refused to call resolved). Folding that
 * into "equal / not equal" leaves two dishonest exits — silently accepting a
 * diff, or deleting the vector. This module closes both:
 *
 *   - an observed diff that no declaration covers is a FAILURE
 *     (`UNDECLARED_DIVERGENCE`), never a pass and never a bucket;
 *   - a declaration that the run did NOT observe is a FAILURE
 *     (`STALE_DECLARED_DIVERGENCE`) — a table of excuses that no longer fires is
 *     a claim, not evidence;
 *   - a declared divergence that fires with a DIFFERENT old/new value than the
 *     declaration pinned is a FAILURE (`DIVERGENCE_VALUE_DRIFT`) — the
 *     declaration must name the exact measured pair, so a future behaviour
 *     change cannot hide behind an id;
 *   - a vector missing from either side is a FAILURE (`MISSING_*`), so a vector
 *     cannot become "reproduced" by not running.
 *
 * A vector that reproduces its golden row EXACTLY needs no declaration, and a
 * declaration attached to a vector that reproduced is refused: this family's
 * measured state (2026-11-20, rc.5) is **zero** declared divergences, and the
 * empty table is asserted, not assumed.
 *
 * @module tests/ute-g1-search/lib/new-path-compare
 */
import { realpathSync } from 'node:fs'

import { COMPARED_FIELDS, compareRecord, fieldValue } from './compare.mjs'

/**
 * The declared new-path-vs-golden divergences.
 *
 * Each entry names the SAME semantic-difference id the retirement ledger
 * declares (`tests/ute-g1-search/lib/semantic-differences.mjs`), the vector it
 * fires on, and the exact `(field, old, new)` cells it produces. It is
 * deliberately EMPTY: the measured rc.5 new path reproduces all 15 golden rows
 * cell-for-cell, so there is nothing to declare. An entry added here must be
 * measured first and pinned to the exact observed cells.
 *
 * @type {readonly {vector: string, difference: string, note: string, diffs: readonly {field: string, old: string, new: string}[]}[]}
 */
export const DECLARED_DIVERGENCES = Object.freeze([])

/** The divergence ids this module is allowed to cite (the ledger's own set). */
export const DECLARABLE_DIFFERENCE_IDS = Object.freeze([
  'SD-SEARCH-1-grep-path-default',
  'SD-SEARCH-2-grep-vcs-ignore',
  'SD-SEARCH-3-refusal-surface',
])

/** The closed set of failure reasons a graded vector may carry. */
export const NEW_PATH_FAILURE_REASONS = Object.freeze([
  'MISSING_OBSERVED',
  'MISSING_GOLDEN',
  'UNDECLARED_DIVERGENCE',
  'STALE_DECLARED_DIVERGENCE',
  'DIVERGENCE_VALUE_DRIFT',
  'DIFFERENCE_ID_UNKNOWN',
  'PENDING_MARKER',
])

/** A record may not carry a pending/absent marker: that channel is gone. */
export function pendingMarkerOf(record) {
  if (record === null || typeof record !== 'object') return null
  if (Object.hasOwn(record, 'newPathPending')) return 'newPathPending'
  const status = record.status
  if (typeof status === 'string' && /^(?:PENDING|ABSENT|SKIP|SKIPPED)$/u.test(status)) return `status=${status}`
  return null
}

/** Find the declaration for one vector id (at most one is allowed). */
function declarationFor(vectorId, declared) {
  const matches = declared.filter((entry) => entry.vector === vectorId)
  if (matches.length > 1) {
    throw new Error(`new-path: ${matches.length} declarations name vector ${vectorId}; a vector may carry at most one declaration`)
  }
  return matches[0]
}

/**
 * Grade ONE vector: exact, or declared-divergent-with-pinned-values, or fail.
 *
 * @param {object} expected - the golden record.
 * @param {object|undefined} observed - the new-path record (undefined = not run).
 * @param {readonly object[]} [declared] - the declaration table.
 * @returns {{id: string, pass: boolean, exact: boolean, divergences: object[], failures: {reason: string, detail: string}[], diffs: object[]}}
 */
export function gradeVector(expected, observed, declared = DECLARED_DIVERGENCES) {
  const id = expected.id
  const failures = []
  const divergences = []
  const pending = pendingMarkerOf(observed)
  if (pending !== null) {
    failures.push({ reason: 'PENDING_MARKER', detail: `the observed record carries ${pending}; a pending/absent vector is not a pass` })
    return { id, pass: false, exact: false, divergences, failures, diffs: [] }
  }
  if (observed === undefined) {
    failures.push({ reason: 'MISSING_OBSERVED', detail: 'the new-path run produced no record for this golden vector' })
    return { id, pass: false, exact: false, divergences, failures, diffs: [] }
  }
  const comparison = compareRecord(expected, observed)
  const declaration = declarationFor(id, declared)
  if (declaration !== undefined && !DECLARABLE_DIFFERENCE_IDS.includes(declaration.difference)) {
    failures.push({
      reason: 'DIFFERENCE_ID_UNKNOWN',
      detail: `the declaration for ${id} names ${JSON.stringify(declaration.difference)}, which is not one of this family's declared differences (${DECLARABLE_DIFFERENCE_IDS.join(', ')})`,
    })
    return { id, pass: false, exact: false, divergences, failures, diffs: comparison.diffs }
  }
  if (comparison.ok) {
    if (declaration !== undefined) {
      failures.push({
        reason: 'STALE_DECLARED_DIVERGENCE',
        detail: `a divergence is declared for ${id} (${declaration.difference}) but the run reproduced the golden row exactly — remove the stale declaration with evidence, never keep it as a standing excuse`,
      })
    }
    return { id, pass: failures.length === 0, exact: true, divergences, failures, diffs: [] }
  }
  if (declaration === undefined) {
    failures.push({
      reason: 'UNDECLARED_DIVERGENCE',
      detail: `the run diverged on ${comparison.diffs.map((diff) => diff.field).join(',')} and no declared difference covers ${id}`,
    })
    return { id, pass: false, exact: false, divergences, failures, diffs: comparison.diffs }
  }
  // Every observed diff must be declared WITH the exact measured cells, and
  // every declared cell must actually have been observed.
  const observedCells = new Map(comparison.diffs.map((diff) => [diff.field, diff]))
  const declaredCells = new Map((declaration.diffs ?? []).map((diff) => [diff.field, diff]))
  for (const diff of comparison.diffs) {
    const pinned = declaredCells.get(diff.field)
    if (pinned === undefined) {
      failures.push({
        reason: 'UNDECLARED_DIVERGENCE',
        detail: `the run diverged on field ${JSON.stringify(diff.field)} (old=${JSON.stringify(diff.expected)}, new=${JSON.stringify(diff.observed)}) and ${declaration.difference} declares no such cell`,
      })
      continue
    }
    if (pinned.old !== diff.expected || pinned.new !== diff.observed) {
      failures.push({
        reason: 'DIVERGENCE_VALUE_DRIFT',
        detail: `${declaration.difference} pins ${diff.field} as old=${JSON.stringify(pinned.old)} / new=${JSON.stringify(pinned.new)}, the run measured old=${JSON.stringify(diff.expected)} / new=${JSON.stringify(diff.observed)}`,
      })
      continue
    }
    divergences.push({ vector: id, difference: declaration.difference, field: diff.field, old: diff.expected, new: diff.observed })
  }
  for (const field of declaredCells.keys()) {
    if (!observedCells.has(field)) {
      failures.push({
        reason: 'STALE_DECLARED_DIVERGENCE',
        detail: `${declaration.difference} declares ${JSON.stringify(field)} diverging on ${id}, but the run reproduced that field`,
      })
    }
  }
  return { id, pass: failures.length === 0, exact: false, divergences, failures, diffs: comparison.diffs }
}

/**
 * Grade the whole run.
 *
 * @param {readonly object[]} golden
 * @param {readonly object[]} observed
 * @param {readonly object[]} [declared]
 * @returns {{verdicts: object[], failures: object[], divergences: object[],
 *            missingGolden: string[], missingObserved: string[],
 *            declaredCount: number, observedCount: number}}
 */
export function gradeCorpus(golden, observed, declared = DECLARED_DIVERGENCES) {
  const observedById = new Map()
  for (const record of observed) {
    if (observedById.has(record.id)) throw new Error(`new-path: the run produced two records for ${record.id}`)
    observedById.set(record.id, record)
  }
  const goldenIds = new Set(golden.map((record) => record.id))
  if (goldenIds.size !== golden.length) throw new Error('new-path: the golden fixture carries a duplicate vector id')
  const verdicts = []
  const failures = []
  const divergences = []
  for (const expected of golden) {
    const verdict = gradeVector(expected, observedById.get(expected.id), declared)
    verdicts.push(verdict)
    if (!verdict.pass) {
      for (const failure of verdict.failures) failures.push({ id: verdict.id, ...failure })
    }
    divergences.push(...verdict.divergences)
  }
  const missingGolden = observed.filter((record) => !goldenIds.has(record.id)).map((record) => record.id)
  for (const id of missingGolden) {
    // A record the fixture does not carry cannot be graded: it would be a
    // vector with no old-path baseline, i.e. an unbacked claim.
    failures.push({ id, reason: 'MISSING_GOLDEN', detail: 'the new-path run produced a vector the golden fixture does not carry' })
  }
  return {
    verdicts,
    failures,
    divergences,
    missingGolden,
    missingObserved: golden.filter((record) => !observedById.has(record.id)).map((record) => record.id),
    declaredCount: declared.length,
    observedCount: divergences.length,
  }
}

/** `NEW-PATH-DIVERGENCE id=… vector=… field=… old=… new=…` (machine-readable). */
export function divergenceLine(divergence) {
  return `NEW-PATH-DIVERGENCE id=${divergence.difference} vector=${divergence.vector} field=${divergence.field} old=${JSON.stringify(divergence.old)} new=${JSON.stringify(divergence.new)}`
}

/** `NEW-PATH-FAIL id=… reason=… detail="…"`. */
export function failureLine(failure) {
  return `NEW-PATH-FAIL id=${failure.id} reason=${failure.reason} detail=${JSON.stringify(failure.detail)}`
}

/**
 * The declaration table may only cite a difference id this family declares,
 * and every declaration must name a real corpus vector. Checked by the suite
 * before any run, so a typo cannot become a standing excuse.
 * @param {readonly object[]} declared
 * @param {readonly string[]} vectorIds
 * @param {readonly string[]} differenceIds
 * @returns {string[]} problems (empty = the table is well-formed)
 */
export function checkDeclarations(declared, vectorIds, differenceIds) {
  const problems = []
  const seen = new Set()
  for (const entry of declared) {
    if (seen.has(entry.vector)) problems.push(`declaration for ${entry.vector} appears more than once`)
    seen.add(entry.vector)
    if (!vectorIds.includes(entry.vector)) problems.push(`declaration names ${JSON.stringify(entry.vector)}, which is not a corpus vector`)
    if (!differenceIds.includes(entry.difference)) problems.push(`declaration names ${JSON.stringify(entry.difference)}, which is not a declared semantic difference`)
    if (!Array.isArray(entry.diffs) || entry.diffs.length === 0) problems.push(`declaration for ${entry.vector} pins no (field, old, new) cell`)
    for (const diff of entry.diffs ?? []) {
      if (!COMPARED_FIELDS.includes(diff.field)) problems.push(`declaration for ${entry.vector} pins field ${JSON.stringify(diff.field)}, which is not a compared field (${COMPARED_FIELDS.join(', ')})`)
      if (diff.old === diff.new) problems.push(`declaration for ${entry.vector} pins ${diff.field} with identical old/new cells; that is not a divergence`)
    }
  }
  return problems
}

/** The canonical cell for one compared field (re-export for the controls). */
export { fieldValue }

/* ──────────────────── executor provenance (which host ran) ─────────────── */

/** The closed set of provenance failures. */
export const PROVENANCE_FAILURE_REASONS = Object.freeze([
  'DEFINITION_NOT_NEXT_HOST',
  'SPAWN_PROGRAM_NOT_NEXT_HOST',
])

/** Resolve a path for containment checks; a path that cannot be resolved is its own literal. */
function canonicalPath(file) {
  try {
    return realpathSync(file)
  } catch {
    return file
  }
}

/** Is `file` the same path as, or beneath, `tree` (both canonicalized)? */
function insideTree(file, tree) {
  const left = canonicalPath(file)
  const right = canonicalPath(tree)
  return left === right || left.startsWith(`${right}/`)
}

/**
 * Prove that the run's DEFINITION and its SPAWNED PROGRAM came from the pinned
 * next host, not from the legacy tree the product is installed against.
 *
 * This is the cheap, total form of the claim "the host's own tool body ran":
 * a definition resolved from the next tree whose `rg` binary lives in the next
 * tree's node_modules cannot be the legacy package or the Team-owned PD-16
 * shadow (both resolve their binary through the repository's own
 * `node_modules`). A run whose provenance fails is not a new-path run.
 *
 * @param {{vector: string, entry: string, nextTree: string, spawns: readonly string[][]}} witness
 * @returns {{vector: string, reason: string, detail: string}[]}
 */
export function checkModuleProvenance(witness) {
  const failures = []
  if (!insideTree(witness.entry, witness.nextTree)) {
    failures.push({
      vector: witness.vector,
      reason: 'DEFINITION_NOT_NEXT_HOST',
      detail: `the served search module entry ${JSON.stringify(witness.entry)} is not inside the pinned next-host tree ${JSON.stringify(witness.nextTree)}`,
    })
  }
  for (const argv of witness.spawns) {
    const program = String(argv?.[0] ?? '')
    if (!insideTree(program, witness.nextTree)) {
      failures.push({
        vector: witness.vector,
        reason: 'SPAWN_PROGRAM_NOT_NEXT_HOST',
        detail: `the confined face spawned ${JSON.stringify(program)}, which is not the pinned next host's own packaged ripgrep under ${JSON.stringify(witness.nextTree)}`,
      })
    }
  }
  return failures
}

/** `NEW-PATH-PROVENANCE vector=… entry=… spawns=…` (one line per spawn-bearing vector). */
export function provenanceLine(witness) {
  const programs = [...new Set(witness.spawns.map((argv) => String(argv?.[0] ?? '-')))].sort()
  return `NEW-PATH-PROVENANCE vector=${witness.vector} entry=${witness.entry} spawns=${witness.spawns.length} program=${programs.join(',') || '-'}`
}
