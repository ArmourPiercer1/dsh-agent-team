/**
 * effect-oracle.mjs — the witnesses the search golden vectors are recorded
 * from, and the closed refusal classification.
 *
 * THE OBSERVABLES (never the tool's self-report of an effect):
 *   1. the RETURNED MATCH SET — the structured `value` the call returned
 *      (`grep`: `{matches:[{path,lineNumber,line}]}`; `glob`:
 *      `{root,paths:[…]}`), canonically sorted and digested. Every returned
 *      match is additionally CHECKED AGAINST THE FILESYSTEM: the named path
 *      must exist, and for grep the named line number must actually carry the
 *      returned line text. A match the filesystem does not corroborate is a
 *      hard error, not a recorded effect.
 *   2. the FILESYSTEM TREE — a digest over every non-dot file under the
 *      fixture's `inside/` and `outside/` trees, taken before and after the
 *      call. A search must not mutate the tree.
 *   3. the PROVIDER/BACKEND FACTS — the confined provider's spawn count and
 *      the realm's own `a5sf-guard-consult/1` facts (decision + locator +
 *      code). "The confined face was never reached" is a measurement here.
 *
 * REFUSAL CLASSIFICATION reuses the CLOSED NINE-CATEGORY vocabulary of
 * `tests/ute-g1-fs/lib/refusal-categories.mjs` — imported, not forked. That
 * module's `LEGACY_REFUSAL_MAP` holds the FS surface only (and
 * `tests/ute-g1-fs/**` is out of this task's write scope), so the SEARCH
 * surface mapping lives here, with the same two invariants: it is TOTAL (an
 * observed refusal that no entry matches raises `REFUSAL_VOCABULARY_INCOMPLETE`
 * through the imported error type) and `unknown` is UNREACHABLE (no entry maps
 * to it). A category answers "why was this withheld?", never "should it be".
 *
 * @module tests/ute-g1-search/lib/effect-oracle
 */
import { createHash } from 'node:crypto'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { relative, sep } from 'node:path'

import {
  CATEGORY_IDS,
  REFUSAL_CATEGORIES,
  RefusalVocabularyError,
} from '../../ute-g1-fs/lib/refusal-categories.mjs'

export { CATEGORY_IDS, REFUSAL_CATEGORIES, RefusalVocabularyError }

/** The unclassified bucket. Declared here so a test can assert it is unreachable. */
export const UNKNOWN_CATEGORY = 'unknown'

/** sha256 of a string or byte buffer, hex. */
export function sha256Of(bytes) {
  return createHash('sha256').update(bytes).digest('hex')
}

/* ────────────────────────── match-set canonicalization ─────────────────── */

/**
 * Normalize one returned path to a world-relative token. `./a.txt`, `a.txt`
 * and `<cwd>/a.txt` all canonicalize to `a.txt`; a path that genuinely escapes
 * the world keeps its absolute form (prefixed `abs:`) so an escape is VISIBLE
 * in the digest instead of being normalized away.
 * @param {string} raw
 * @param {string} cwdAbs
 * @returns {string}
 */
export function canonicalPath(raw, cwdAbs) {
  let value = String(raw ?? '')
  while (value.startsWith('./')) value = value.slice(2)
  if (value.startsWith(`${cwdAbs}${sep}`) || value.startsWith('/')) {
    const rel = relative(cwdAbs, value).split(sep).join('/')
    if (!rel.startsWith('..')) return rel
    return `abs:${value}`
  }
  return value
}

/**
 * The canonical match list for one entry: sorted, world-relative, with the
 * fields the effect claim rests on. glob carries paths only (lineNumber/line
 * are null), grep carries all three.
 * @param {'grep'|'glob'} entry
 * @param {object|undefined} value
 * @param {string} cwdAbs
 * @returns {object[]}
 */
export function canonicalMatches(entry, value, cwdAbs) {
  if (value === null || value === undefined || typeof value !== 'object') return []
  if (entry === 'grep') {
    const matches = Array.isArray(value.matches) ? value.matches : []
    return matches
      .map((match) => ({
        path: canonicalPath(match.path, cwdAbs),
        lineNumber: Number(match.lineNumber),
        line: String(match.line ?? ''),
      }))
      .sort((left, right) => (left.path === right.path
        ? left.lineNumber - right.lineNumber
        : left.path < right.path ? -1 : 1))
  }
  if (entry === 'glob') {
    const paths = Array.isArray(value.paths) ? value.paths : []
    return paths.map((path) => ({ path: canonicalPath(path, cwdAbs) }))
      .sort((left, right) => (left.path < right.path ? -1 : left.path > right.path ? 1 : 0))
  }
  throw new Error(`not a search entry: ${JSON.stringify(entry)}`)
}

/**
 * Corroborate every returned match against the FILESYSTEM. A match the tree
 * does not carry is a hard error (the oracle refuses to record a fabricated
 * effect); the read is on the world's own fixture, not through the tool.
 * @param {object[]} matches
 * @param {string} cwdAbs
 */
export function corroborateMatches(matches, cwdAbs) {
  for (const match of matches) {
    if (match.path.startsWith('abs:')) {
      throw new Error(`the call returned a path OUTSIDE the session workspace (${match.path}); refusing to record it as a normal match`)
    }
    const absolute = `${cwdAbs}/${match.path}`
    let stat
    try {
      stat = statSync(absolute)
    } catch {
      throw new Error(`the call returned match path ${JSON.stringify(match.path)} but nothing exists at ${absolute}`)
    }
    if (!stat.isFile()) throw new Error(`the call returned non-file match path ${JSON.stringify(match.path)}`)
    if (match.lineNumber !== undefined && match.lineNumber !== null) {
      const lines = readFileSync(absolute, 'utf8').split('\n')
      const line = lines[match.lineNumber - 1]
      if (line === undefined) throw new Error(`${match.path}:${match.lineNumber} does not exist in the file`)
      if (line !== match.line) {
        throw new Error(`${match.path}:${match.lineNumber} returned line ${JSON.stringify(match.line)} but the file carries ${JSON.stringify(line)}`)
      }
    }
  }
}

/**
 * The canonical match digest: sorted records, JSON-line encoded, sha256.
 * Absolute roots, walk order and the retention window never enter it.
 * @param {object[]} matches
 * @returns {string}
 */
export function matchDigest(matches) {
  return sha256Of(matches.map((match) => JSON.stringify(match)).join('\n'))
}

/**
 * The rendered retention boundary, read from the MODEL-FACING text
 * (`Found 250 of 300 matches`, `Found 2 matches`, `No matches found`).
 * @param {string} text
 * @returns {{found: number, total: number, rendered: number}}
 */
export function retentionOf(text) {
  const haystack = String(text ?? '')
  const partial = haystack.match(/Found (\d+) of (\d+) match(?:es)?/u)
  if (partial !== null) {
    const rendered = Number(partial[1])
    const total = Number(partial[2])
    return { found: total, total, rendered }
  }
  const full = haystack.match(/Found (\d+) match(?:es)?/u)
  if (full !== null) {
    const count = Number(full[1])
    return { found: count, total: count, rendered: count }
  }
  if (/No matches found/u.test(haystack)) return { found: 0, total: 0, rendered: 0 }
  return { found: null, total: null, rendered: null }
}

/**
 * glob's model-facing text IS the path list, one per line, with no summary
 * header. Its rendered count is therefore the number of non-empty lines — an
 * independent witness of what the model actually received.
 * @param {string} text
 * @returns {number}
 */
export function renderedGlobCount(text) {
  return String(text ?? '').split('\n').filter((line) => line.trim().length > 0).length
}

/* ────────────────────────────── tree witness ───────────────────────────── */

/** Every non-dot regular file under one root, as relpath -> sha256. */
function treeOf(rootAbs) {
  const out = []
  let entries
  try {
    entries = readdirSync(rootAbs, { withFileTypes: true })
  } catch {
    return out
  }
  for (const entry of entries.sort((left, right) => (left.name < right.name ? -1 : 1))) {
    if (entry.name.startsWith('.')) continue
    const absolute = `${rootAbs}/${entry.name}`
    if (entry.isDirectory()) out.push(...treeOf(absolute).map((row) => ({ path: `${entry.name}/${row.path}`, sha256: row.sha256 })))
    else if (entry.isFile()) out.push({ path: entry.name, sha256: sha256Of(readFileSync(absolute)) })
  }
  return out
}

/**
 * The filesystem witness: a digest over the fixture's searchable trees. Dot
 * entries are skipped because the world itself writes its guard sink and its
 * sandbox scratch there.
 * @param {string} fixtureRoot
 * @param {readonly string[]} [roots]
 * @returns {{files: number, digest: string}}
 */
export function snapshotTree(fixtureRoot, roots = ['inside', 'outside']) {
  const rows = []
  for (const root of roots) {
    for (const row of treeOf(`${fixtureRoot}/${root}`)) rows.push({ path: `${root}/${row.path}`, sha256: row.sha256 })
  }
  rows.sort((left, right) => (left.path < right.path ? -1 : left.path > right.path ? 1 : 0))
  return { files: rows.length, digest: sha256Of(rows.map((row) => `${row.path}:${row.sha256}`).join('\n')) }
}

/* ──────────────────────── refusal classification ───────────────────────── */

/** The searched locators reported by the realm's deny facts. */
export function denyLocators(facts) {
  return (Array.isArray(facts) ? facts : [])
    .filter((fact) => fact?.decision === 'deny' && typeof fact.locator === 'string')
    .map((fact) => fact.locator)
}

/**
 * SEARCH refusal surface → the closed nine-category vocabulary.
 *
 * Order is significant. Every entry carries a MEASURED `sample` (the text or
 * fact shape the capture transcripts observed) and a `source` pointer; the
 * mapping is total, so a refusal no entry matches is refused, never bucketed.
 *
 * The generic confined failure ("grep subprocess failed before reporting an
 * outcome") is deliberately NOT classified by its text: the text is the same
 * for a lane denial and a missing target, and only the guard fact plus the
 * FILESYSTEM determine which condition fired. That is why the lane/missing
 * decision reads the deny locator and stats it.
 *
 * @type {readonly object[]}
 */
export const SEARCH_REFUSAL_MAP = Object.freeze([
  {
    kind: 'text',
    match: /aborted before dispatch/u,
    category: 'cancelled',
    sample: 'Error: tool call aborted before dispatch',
    source: 'dev/agent-workflow/evidence/ute3-search-b1-20261120/composition-probe.txt (SR-G7)',
  },
  {
    kind: 'text',
    match: /pattern rejected by ripgrep|error parsing glob|regex parse error/u,
    category: 'invalid-argument',
    sample: 'Error: grep pattern rejected by ripgrep: rg: regex parse error:',
    source: 'dev/agent-workflow/evidence/ute3-search-b1-20261120/composition-probe.txt (SR-G6 / SR-L5)',
  },
])

/**
 * Does `locator` exist on the filesystem? The witness that separates
 * `missing-path` from `denied-by-lane` for the single `IO_READ_DENIED` code.
 * @param {string} locator
 * @returns {boolean}
 */
function locatorExists(locator) {
  try {
    statSync(locator)
    return true
  } catch {
    return false
  }
}

/**
 * Is `locator` inside any declared read root?
 * @param {readonly string[]} readRoots
 * @param {string} locator
 * @returns {boolean}
 */
function insideAny(readRoots, locator) {
  return readRoots.some((root) => locator === root || locator.startsWith(`${root}/`))
}

/**
 * Classify one observed refusal into the closed vocabulary.
 *
 * @param {object} input
 * @param {'allow'|'deny'} input.outcome
 * @param {string} input.text - the model-facing result text.
 * @param {readonly object[]} input.facts - the realm's guard-consult facts.
 * @param {readonly string[]} input.readRoots - the declared absolute read roots.
 * @returns {string|null} a `REFUSAL_CATEGORIES` id, or null for an allow.
 */
export function classifySearchRefusal({ outcome, text, facts, readRoots }) {
  if (outcome === 'allow') return null
  const haystack = String(text ?? '')
  for (const entry of SEARCH_REFUSAL_MAP) {
    if (entry.kind === 'text' && entry.match.test(haystack)) return assertCategory(entry.category, entry)
  }
  const locators = denyLocators(facts)
  if (locators.length > 0) {
    const locator = locators[locators.length - 1]
    // A locator that does not exist cannot be a lane-only decision: it is the
    // missing-target condition (the confined face reports the SAME
    // IO_READ_DENIED code for both, measured in the composition probe).
    if (!locatorExists(locator)) return assertCategory('missing-path', { sample: locator, source: 'filesystem witness: the deny locator does not exist' })
    if (!insideAny(readRoots, locator)) return assertCategory('denied-by-lane', { sample: locator, source: 'declared read lane: the deny locator is outside every read root' })
    // Inside the lane, exists, and still denied: the confinement refused for a
    // reason this corpus never observed. Do NOT invent a bucket.
    throw new RefusalVocabularyError(
      'REFUSAL_VOCABULARY_INCOMPLETE',
      `the confined face denied locator ${JSON.stringify(locator)} which EXISTS and is INSIDE the declared read lane; no search mapping entry explains that condition (text=${JSON.stringify(haystack.slice(0, 200))})`,
    )
  }
  throw new RefusalVocabularyError(
    'REFUSAL_VOCABULARY_INCOMPLETE',
    `an observed refusal matched no SEARCH_REFUSAL_MAP entry and produced no guard fact (text=${JSON.stringify(haystack.slice(0, 200))})`,
  )
}

/** Assert a category is part of the imported closed vocabulary. */
function assertCategory(category, entry) {
  if (!Object.hasOwn(REFUSAL_CATEGORIES, category)) {
    throw new RefusalVocabularyError('REFUSAL_VOCABULARY_INVALID', `mapping entry ${JSON.stringify(entry.sample)} names ${JSON.stringify(category)}, which is outside the closed vocabulary`)
  }
  if (category === UNKNOWN_CATEGORY) {
    throw new RefusalVocabularyError('REFUSAL_VOCABULARY_INVALID', 'no search mapping entry may reach the unknown bucket')
  }
  return category
}

/**
 * Typed codes observed in the model-facing text plus the realm's own decision
 * codes. Recorded (never a pass condition) so an unclassified refusal cannot
 * hide behind an empty cell.
 * @param {string} text
 * @param {readonly object[]} facts
 * @returns {string[]}
 */
export function codesOf(text, facts) {
  const fromText = String(text ?? '').match(/\b(?:IO|FS|SEARCH|TEAM|PLANE)_[A-Z][A-Z0-9_]+\b/gu) ?? []
  const fromFacts = (Array.isArray(facts) ? facts : [])
    .map((fact) => fact?.decidedBy)
    .filter((code) => typeof code === 'string' && /^[A-Z][A-Z0-9_]+$/u.test(code) && code !== 'ALLOW')
  return [...new Set([...fromText, ...fromFacts])]
}

/**
 * Scan the model-facing text AND the returned match set for secret tokens.
 * Absence proves the refusal/response did not CARRY them; it does not prove no
 * read happened.
 * @param {string} text
 * @param {readonly object[]} matches
 * @param {readonly string[]} tokens
 * @returns {string[]}
 */
export function findLeaks(text, matches, tokens) {
  const haystack = `${String(text ?? '')}\n${(matches ?? []).map((match) => `${match.path}\n${match.line ?? ''}`).join('\n')}`
  return tokens.filter((token) => haystack.includes(token))
}

/** The `effects` cell: synthetic entries in the FS serializer's grammar. */
export function effectsCell(effects) {
  if (effects.length === 0) return '-'
  return effects.map((effect) => [
    effect.path,
    effect.exists ? 'present' : 'absent',
    effect.bytes === null || effect.bytes === undefined ? '-' : String(effect.bytes),
    effect.sha256 ?? '-',
    effect.mode ?? '-',
  ].join('|')).join(';')
}
