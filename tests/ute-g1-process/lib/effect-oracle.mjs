/**
 * effect-oracle.mjs — the witnesses the process golden vectors are recorded
 * from, and the closed refusal classification.
 *
 * THE OBSERVABLES (never the tool's self-report of an effect):
 *   1. THE CHILD'S OWN RECORD — the `bash` shadow answers a JSON record
 *      (`{kind, exitCode, signal, timedOut, aborted, stdout, stderr}`) built
 *      from the confined handle: the real exit status, the real collected
 *      stdout/stderr bytes, and the real settle flags. The record is PARSED,
 *      never pattern-matched, so a change of shape is a red, not a rewrite.
 *   2. THE FILESYSTEM TREE — a digest over every non-dot file under the
 *      fixture's `inside/` and `outside/` trees, taken before and after the
 *      call, plus an explicit existence check for a vector's expected ABSENT
 *      out-of-lane file. A shell must not leave an effect the lane refused.
 *   3. THE PROVIDER/BACKEND FACTS — the confined provider's spawn count and
 *      the realm's own `a5sf-guard-consult/1` facts (decision + locator +
 *      code). "The confined face was never reached" / "the declared root was
 *      consulted" are measurements here.
 *
 * REFUSAL CLASSIFICATION reuses the CLOSED vocabulary of
 * `tests/ute-g1-fs/lib/refusal-categories.mjs` — imported, not forked. That
 * module's `LEGACY_REFUSAL_MAP` holds the FS surface only (and
 * `tests/ute-g1-fs/**` is out of this task's write scope), so the PROCESS
 * surface's extra prose lives here, with the same two invariants: it is TOTAL
 * (an observed refusal that no entry matches raises
 * `REFUSAL_VOCABULARY_INCOMPLETE` through the imported error type) and
 * `unknown` is UNREACHABLE (no entry maps to it). A category answers "why was
 * this withheld?", never "should it be".
 *
 * @module tests/ute-g1-process/lib/effect-oracle
 */
import { createHash } from 'node:crypto'
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { relative, sep } from 'node:path'

import {
  CATEGORY_IDS,
  REFUSAL_CATEGORIES,
  RefusalVocabularyError,
  categoryOfLegacyRefusal,
} from '../../ute-g1-fs/lib/refusal-categories.mjs'

export { CATEGORY_IDS, REFUSAL_CATEGORIES, RefusalVocabularyError }

/** The unclassified bucket. Declared here so a test can assert it is unreachable. */
export const UNKNOWN_CATEGORY = 'unknown'

/**
 * The PROCESS surface's own prose/class entries. Each is measured in the B1
 * transcript (`golden/old-path.tsv` + the capture's `CODES` lines); a refusal
 * with no entry here raises instead of being bucketed.
 */
export const PROCESS_REFUSAL_MAP = Object.freeze([
  {
    kind: 'class',
    match: 'cancelled',
    category: 'cancelled',
    sample: 'cancelled',
    source: 'tests/ute-g1-process/golden/old-path.tsv refusal column (PB-B6), the registry\'s pre-dispatch abort',
  },
  {
    kind: 'class',
    match: 'denied-by-lane',
    category: 'denied-by-lane',
    sample: 'denied-by-lane',
    source: 'tests/ute-g1-process/golden/old-path.tsv refusal column (PB-B7, PB-B14), the confined face\'s declared-root denial',
  },
  {
    kind: 'class',
    match: 'missing-path',
    category: 'missing-path',
    sample: 'missing-path',
    source: 'tests/ute-g1-process/golden/old-path.tsv refusal column (PB-B12), a workdir that does not exist',
  },
  {
    kind: 'class',
    match: 'invalid-argument',
    category: 'invalid-argument',
    sample: 'invalid-argument',
    source: 'tests/ute-g1-process/golden/old-path.tsv refusal column (PB-B13), the tool\'s closed argument law',
  },
  {
    kind: 'text',
    // The registry refuses a call whose signal was already aborted. The FS map
    // carries the same token as a NATIVE tool code (ABORTED_BEFORE_DISPATCH);
    // here it reaches us as the error sentence, so it is mapped by prefix.
    match: /^ABORTED_BEFORE_DISPATCH\b|aborted before dispatch|\bABORTED_BEFORE_DISPATCH\b/u,
    category: 'cancelled',
    sample: 'ABORTED_BEFORE_DISPATCH: the call was aborted before dispatch',
    source: 'packages/runtime/tool-dispatch (the pre-dispatch abort refusal), observed in PB-B6',
  },
  {
    kind: 'text',
    match: /(?:^|[:\s])invalid command\b|(?:^|[:\s])invalid description\b|undeclared argument|assertClosedArguments|closed (?:tool )?arguments/iu,
    category: 'invalid-argument',
    sample: 'invalid command: expected a non-empty string',
    source: 'packages/runtime/src/plugin/live/closed-tool-arguments.mjs + confined-bash-tool.mjs, observed in PB-B13',
  },
])

/** sha256 of a string or byte buffer, hex. */
export function sha256Of(bytes) {
  return createHash('sha256').update(bytes).digest('hex')
}

/* ─────────────────────── world-path normalization ─────────────────────── */

/**
 * Collapse every machine-specific absolute path out of a model-facing string.
 * Two capture runs of the same world must be byte-identical, and the golden
 * must not carry an absolute host path, so the fixture root and the repo root
 * are replaced by stable tokens.
 * @param {string} text
 * @param {string} worldRoot
 * @returns {string}
 */
export function normalizeText(text, worldRoot) {
  let value = String(text ?? '')
  const replacements = [
    [worldRoot, '<world>'],
    [worldRoot.split(sep).join('/'), '<world>'],
    // The admitted shell's own absolute path is a constant of the composition,
    // not host state; the identity line (and the meta file) record its value.
    ['/bin/bash', '<shell>'],
  ]
  for (const [from, to] of replacements) {
    if (typeof from === 'string' && from.length > 0) value = value.split(from).join(to)
  }
  // A trailing scratch dir named `w-<id>` never reaches the golden either.
  return value
}

/* ─────────────────────────── the child record ─────────────────────────── */

/**
 * Parse the `bash` shadow's model-facing text as its JSON record.
 * @param {string} text
 * @returns {{kind: string, exitCode: number|null, signal: string|null, timedOut: boolean, aborted: boolean, stdout: string, stderr: string}|null}
 */
export function parseProcessRecord(text) {
  if (typeof text !== 'string' || text.trim() === '') return null
  let value
  try {
    value = JSON.parse(text)
  } catch {
    return null
  }
  if (value === null || typeof value !== 'object' || value.kind !== 'confined') return null
  return {
    kind: 'confined',
    exitCode: Number.isInteger(value.exitCode) ? value.exitCode : null,
    signal: typeof value.signal === 'string' ? value.signal : null,
    timedOut: value.timedOut === true,
    aborted: value.aborted === true,
    stdout: typeof value.stdout === 'string' ? value.stdout : '',
    stderr: typeof value.stderr === 'string' ? value.stderr : '',
  }
}

/* ────────────────────────── filesystem witness ────────────────────────── */

/** Every non-dot file under the fixture, relative and sorted. */
function walk(dir, out) {
  let entries
  try {
    entries = readdirSync(dir, { withFileTypes: true })
  } catch {
    return
  }
  for (const entry of entries) {
    if (entry.name.startsWith('.')) continue
    const absolute = `${dir}${sep}${entry.name}`
    if (entry.isDirectory()) walk(absolute, out)
    else if (entry.isFile()) out.push(absolute)
  }
}

/**
 * A digest over the fixture tree: `path:bytes:sha256`, sorted, hashed.
 * @param {string} fixtureRoot
 * @returns {{digest: string, files: number}}
 */
export function snapshotTree(fixtureRoot) {
  const files = []
  for (const rel of ['inside', 'outside']) {
    const absolute = `${fixtureRoot}${sep}${rel}`
    if (existsSync(absolute)) walk(absolute, files)
  }
  const rows = files
    .map((absolute) => {
      const bytes = readFileSync(absolute)
      return `${relative(fixtureRoot, absolute).split(sep).join('/')}:${String(bytes.length)}:${sha256Of(bytes)}`
    })
    .sort()
  return { digest: sha256Of(rows.join('\n')), files: rows.length }
}

/* ─────────────────────── refusal classification ──────────────────────── */

/** Does a path exist on disk (the missing-path discriminator)? */
function locatorExists(locator) {
  return typeof locator === 'string' && locator.length > 0 && existsSync(locator)
}

/**
 * Resolve a refusal against the PROCESS map, then (for typed codes) the
 * imported legacy map.
 * @param {string} value
 * @returns {{category: string, kind: string, matched: string}}
 */
function resolveProcessRefusal(value) {
  for (const entry of PROCESS_REFUSAL_MAP) {
    if (entry.kind !== 'text' && entry.match === value) {
      return { category: entry.category, kind: entry.kind, matched: String(entry.match) }
    }
  }
  for (const entry of PROCESS_REFUSAL_MAP) {
    if (entry.kind !== 'text') continue
    if (entry.match.test(value)) return { category: entry.category, kind: 'text', matched: String(entry.match) }
  }
  // The shared closed vocabulary already owns the IO_* / PATH_* codes.
  const resolved = categoryOfLegacyRefusal(value)
  return { category: resolved.category, kind: resolved.kind, matched: resolved.matched }
}

/**
 * Classify one refusal: the typed code when the error carries one, else the
 * sentence; a lane/deny category is then DISCRIMINATED by the filesystem
 * witness (a locator that does not exist is `missing-path`, not a lane
 * decision) — the same discipline the search family uses.
 *
 * @param {object} input
 * @param {string} input.text - the error sentence the registry answered.
 * @param {string|undefined} input.code - the typed code when one is exposed.
 * @param {readonly object[]} input.facts - the realm's guard-consult facts.
 * @returns {{category: string, value: string, matched: string}}
 */
export function classifyProcessRefusal({ text, code, facts = [] }) {
  const sentence = String(text ?? '')
  let value = typeof code === 'string' && code.length > 0 ? code : null
  if (value === null) {
    for (const entry of PROCESS_REFUSAL_MAP) {
      if (entry.kind !== 'text' && sentence.includes(entry.match)) {
        value = entry.match
        break
      }
    }
  }
  if (value === null) value = sentence
  const resolved = resolveProcessRefusal(value)
  // The shared IO code names BOTH "outside the lane" and "no such path"; the
  // guard fact's locator plus the filesystem decide which was measured.
  const attempted = (facts ?? []).filter((fact) => String(fact?.decision ?? '') !== 'allow')
  const locator = attempted.at(-1)?.locator
  if (resolved.category === 'denied-by-lane' && locator !== undefined && !locatorExists(locator)) {
    return { ...resolved, value, category: 'missing-path' }
  }
  if (resolved.category === 'denied-by-lane' && locator === undefined) {
    // A lane category with no locator is not attributable to a path decision.
    throw new RefusalVocabularyError(
      'REFUSAL_VOCABULARY_INCOMPLETE',
      `refusal ${JSON.stringify(sentence.slice(0, 160))} classified as ${resolved.category} but no guard fact names the locator, so the category cannot be attributed`,
    )
  }
  return { ...resolved, value }
}

/**
 * Assert the closed-vocabulary invariants for this suite: every category is a
 * declared id, and `unknown` is unreachable from every entry.
 * @returns {string[]} findings (empty = clean)
 */
export function auditProcessVocabulary() {
  const findings = []
  for (const entry of PROCESS_REFUSAL_MAP) {
    if (!Object.hasOwn(REFUSAL_CATEGORIES, entry.category)) {
      findings.push(`entry ${JSON.stringify(entry.match)} names unknown category ${JSON.stringify(entry.category)}`)
    }
    if (entry.category === UNKNOWN_CATEGORY) {
      findings.push(`entry ${JSON.stringify(entry.match)} maps to the unclassified bucket`)
    }
  }
  return findings
}

/* ─────────────────────────── effect serialization ─────────────────────── */

/** The `effects` cell: entries in the FS serializer's grammar. */
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

/**
 * Build the four synthetic effects of one process observation.
 * @param {object} input
 * @param {{exitCode: number|null, timedOut: boolean, aborted: boolean}|null} input.record
 * @param {string} input.stdout
 * @param {string} input.stderr
 * @param {{digest: string, files: number}} input.treeBefore
 * @param {{digest: string, files: number}} input.treeAfter
 * @returns {object[]}
 */
export function processEffects({ record, stdout, stderr, treeBefore, treeAfter }) {
  const effects = []
  effects.push({
    path: '@process',
    exists: true,
    bytes: record?.exitCode ?? null,
    sha256: null,
    mode: `timedOut=${record?.timedOut === true ? 'yes' : 'no'},aborted=${record?.aborted === true ? 'yes' : 'no'},record=${record === null ? 'absent' : 'json'}`,
  })
  for (const [path, text] of [['@stdout', stdout], ['@stderr', stderr]]) {
    effects.push({
      path,
      exists: text.length > 0,
      bytes: Buffer.byteLength(text),
      sha256: sha256Of(text),
      mode: 'normalized',
    })
  }
  effects.push({
    path: '@fs:tree',
    exists: true,
    bytes: treeAfter.files,
    sha256: treeAfter.digest,
    mode: treeBefore.digest === treeAfter.digest ? 'unchanged' : 'CHANGED',
  })
  return effects
}
