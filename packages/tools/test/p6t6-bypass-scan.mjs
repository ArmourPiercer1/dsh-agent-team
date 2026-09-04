/**
 * p6t6-bypass-scan.mjs — the P6-T6 committed static bypass scanner
 * (brief §6b; G6 criterion 7).
 *
 * Purpose: prove, as a deterministic re-runnable scan over the TOOL
 * LAYER's sources (every `.ts` file under `packages/tools/src/`,
 * recursively — the layer that
 * must delegate EVERYTHING to the team runtime), that
 *
 *   1. the tool layer never writes the durable team domain directly:
 *      no static import/export-from specifier may target the storage
 *      layer (a path segment equal to `storage`), and no repository-
 *      level member access (`.repositories.`) may appear anywhere in
 *      the source text;
 *   2. the tool layer never creates agents of its own: no `agents.create`
 *      call text may appear anywhere in the source text;
 *   3. the tool layer never uses the legacy Team SessionEvent vocabulary —
 *      the P4-T6 frozen denylist (source of record: `references/deepseek-
 *      harness/packages/team/team/src/events.ts`), matched with the SAME
 *      precision as the whole-tree scanner
 *      `packages/testkit/fault-injection/session-event-scan.mjs`:
 *        - the five legacy event strings, ONLY as exact quoted string
 *          literals (single, double, or backtick; same quote character
 *          at both ends) — never a substring match;
 *        - the five legacy payload symbols, as exact word-bounded
 *          identifiers (a longer identifier is NOT a hit);
 *        - the legacy declaration-merging identifier, word-bounded;
 *          ANY occurrence is a violation HERE — unlike the whole-tree
 *          scanner (where a lone mention is not a hit and only the full
 *          three-part merge is), the tool layer has no business
 *          referencing the session-types registry at all;
 *        - the quoted session-types module specifier, exact quoted
 *          literal.
 *
 * SELF-CLEANLINESS CONTRACT: this file is INSIDE the P4-T6 whole-tree
 * scanner's scope (`packages/**`; only two files are self-excluded —
 * that scanner itself and the P4-T6 committed test). It therefore must
 * carry ZERO denylist tokens in its committed source. Every token below
 * is ASSEMBLED AT RUNTIME from fragments (the `team/` event prefix, the
 * `Team`/`Data` symbol edges, the `SessionEvent`/`Map` identifier edge).
 * The quoted session-types specifier is written verbatim because it is
 * inert on its own: the whole-tree merge rule additionally requires an
 * exact quoted legacy event literal AND the merging identifier in the
 * same file, and this source carries neither.
 *
 * Determinism: directories are walked in sorted name order (with the
 * standard `node_modules`/`dist` segment skips); files are reported
 * sorted by repo-relative POSIX path; per-file violations are sorted by
 * (line, column, rule, detail) and the aggregate by
 * (file, line, column, rule, detail).
 *
 * The `.d.mts` beside this file carries the tsc type surface (same
 * `.mjs` + adjacent `.d.mts` pattern as the P4-T6 scanner and the P4-T5
 * file-seam harness): only `.mjs` files may import `node:` builtins.
 */

import { readdir, readFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

// --- the frozen denylist (assembled at runtime; see header) ------------

const TEAM_EVENT_PREFIX = 'team/'

/** The five legacy Team SessionEvent type strings (P4-T6 frozen). */
export const LEGACY_TEAM_EVENT_STRINGS = [
  TEAM_EVENT_PREFIX + 'member-bound',
  TEAM_EVENT_PREFIX + 'progress',
  TEAM_EVENT_PREFIX + 'control-request',
  TEAM_EVENT_PREFIX + 'control-decision',
  TEAM_EVENT_PREFIX + 'message',
]

/** The five legacy payload symbol names (P4-T6 frozen). */
export const LEGACY_PAYLOAD_SYMBOLS = [
  'Team' + 'MemberBound' + 'Data',
  'Team' + 'Progress' + 'Data',
  'Team' + 'Control' + 'Request' + 'Data',
  'Team' + 'Control' + 'Decision' + 'Data',
  'Team' + 'Message' + 'Data',
]

/** The legacy declaration-merging identifier (P4-T6 frozen). */
export const SESSION_EVENT_MAP_IDENTIFIER = 'SessionEvent' + 'Map'

/** The legacy session-types module specifier (P4-T6 frozen; inert on its own). */
export const SESSION_TYPES_SPECIFIER = '@deepseek-ai/dsh-session/types'

// --- rule ids -----------------------------------------------------------

export const BYPASS_RULES = Object.freeze({
  STORAGE_IMPORT: 'storage-import',
  REPOSITORIES_ACCESS: 'repositories-access',
  AGENTS_CREATE: 'agents-create',
  LEGACY_EVENT_STRING: 'legacy-event-string',
  LEGACY_PAYLOAD_SYMBOL: 'legacy-payload-symbol',
  LEGACY_SESSION_EVENT_MAP: 'legacy-session-event-map',
  LEGACY_SESSION_TYPES_SPECIFIER: 'legacy-session-types-specifier',
})

// --- matchers -----------------------------------------------------------

/** Word-bounded identifier match (identifier chars: [A-Za-z0-9_$]). */
function boundedIdentifier(name) {
  return new RegExp('(?<![A-Za-z0-9_$])' + name + '(?![A-Za-z0-9_$])', 'g')
}

const QUOTED_EVENT_PATTERNS = LEGACY_TEAM_EVENT_STRINGS.map(
  (name) => new RegExp('(["\'`])' + name + '\\1', 'g'),
)
const PAYLOAD_SYMBOL_PATTERNS = LEGACY_PAYLOAD_SYMBOLS.map(boundedIdentifier)
const SESSION_EVENT_MAP_PATTERN = boundedIdentifier(SESSION_EVENT_MAP_IDENTIFIER)
const SESSION_TYPES_SPECIFIER_PATTERN = /(["'`])@deepseek-ai\/dsh-session\/types\1/g

/**
 * Every static import/export-from specifier with the index of its
 * opening quote. Covers `import ... from 'x'`, `export ... from 'x'`
 * and the bare side-effect form `import 'x'`.
 */
function importSpecifiers(source) {
  const out = []
  const re = /(?:from\s+|import\s+)['"]([^'"]+)['"]/g
  let match = re.exec(source)
  while (match !== null) {
    const quoteIndex = match.index + match[0].length - match[1].length - 1
    out.push({ specifier: match[1], index: quoteIndex })
    match = re.exec(source)
  }
  return out
}

/** 1-based (line, column) of a source index. */
function locate(source, index) {
  const before = source.slice(0, index)
  return {
    line: before.split(/\r?\n/).length,
    column: index - before.lastIndexOf('\n'),
  }
}

/** Push every `pattern`/`token` pair hit of one line into `hits`. */
function scanLinePatterns(line, lineNo, file, hits, patterns, rule, tokens) {
  for (let k = 0; k < patterns.length; k += 1) {
    const pattern = patterns[k]
    pattern.lastIndex = 0
    let match
    while ((match = pattern.exec(line)) !== null) {
      hits.push({ file, rule, line: lineNo, column: match.index + 1, detail: tokens[k] })
      if (match[0].length === 0) pattern.lastIndex += 1
    }
  }
}

/**
 * Match every bypass rule inside one text.
 * @param {string} text - the file content (or one synthetic control sample).
 * @param {string} file - the reported file label (POSIX, repo-root-relative).
 * @returns the violations, sorted by (line, column, rule, detail).
 */
export function matchBypassRulesInText(text, file = '<text>') {
  const hits = []
  const lines = text.split(/\r?\n/)

  // Per-line denylist rules (same precision as the P4-T6 whole-tree
  // scanner, plus the stronger local SessionEventMap rule).
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i] ?? ''
    const lineNo = i + 1
    scanLinePatterns(
      line,
      lineNo,
      file,
      hits,
      QUOTED_EVENT_PATTERNS,
      BYPASS_RULES.LEGACY_EVENT_STRING,
      LEGACY_TEAM_EVENT_STRINGS,
    )
    scanLinePatterns(
      line,
      lineNo,
      file,
      hits,
      PAYLOAD_SYMBOL_PATTERNS,
      BYPASS_RULES.LEGACY_PAYLOAD_SYMBOL,
      LEGACY_PAYLOAD_SYMBOLS,
    )
    SESSION_EVENT_MAP_PATTERN.lastIndex = 0
    let mapMatch
    while ((mapMatch = SESSION_EVENT_MAP_PATTERN.exec(line)) !== null) {
      hits.push({
        file,
        rule: BYPASS_RULES.LEGACY_SESSION_EVENT_MAP,
        line: lineNo,
        column: mapMatch.index + 1,
        detail: SESSION_EVENT_MAP_IDENTIFIER,
      })
      if (mapMatch[0].length === 0) SESSION_EVENT_MAP_PATTERN.lastIndex += 1
    }
    SESSION_TYPES_SPECIFIER_PATTERN.lastIndex = 0
    let specMatch
    while ((specMatch = SESSION_TYPES_SPECIFIER_PATTERN.exec(line)) !== null) {
      hits.push({
        file,
        rule: BYPASS_RULES.LEGACY_SESSION_TYPES_SPECIFIER,
        line: lineNo,
        column: specMatch.index + 1,
        detail: SESSION_TYPES_SPECIFIER,
      })
      if (specMatch[0].length === 0) SESSION_TYPES_SPECIFIER_PATTERN.lastIndex += 1
    }
  }

  // Whole-text structural rules.
  for (const found of importSpecifiers(text)) {
    if (found.specifier.split('/').includes('storage')) {
      const { line, column } = locate(text, found.index)
      hits.push({
        file,
        rule: BYPASS_RULES.STORAGE_IMPORT,
        line,
        column,
        detail: found.specifier,
      })
    }
  }
  let repositories = text.indexOf('.repositories.')
  while (repositories !== -1) {
    const { line, column } = locate(text, repositories)
    hits.push({
      file,
      rule: BYPASS_RULES.REPOSITORIES_ACCESS,
      line,
      column,
      detail: '.repositories.',
    })
    repositories = text.indexOf('.repositories.', repositories + 1)
  }
  let agentsCreate = text.indexOf('agents.create')
  while (agentsCreate !== -1) {
    const { line, column } = locate(text, agentsCreate)
    hits.push({ file, rule: BYPASS_RULES.AGENTS_CREATE, line, column, detail: 'agents.create' })
    agentsCreate = text.indexOf('agents.create', agentsCreate + 1)
  }

  hits.sort(
    (a, b) =>
      a.line - b.line ||
      a.column - b.column ||
      (a.rule < b.rule ? -1 : a.rule > b.rule ? 1 : 0) ||
      (a.detail < b.detail ? -1 : a.detail > b.detail ? 1 : 0),
  )
  return hits
}

// --- the tree scan ------------------------------------------------------

const SELF_DIR = dirname(resolve(fileURLToPath(import.meta.url)))
const REPO_ROOT = resolve(SELF_DIR, '..', '..', '..')
const SRC_DIR = resolve(SELF_DIR, '..', 'src')

function toPosix(p) {
  return p.split('\\').join('/')
}

/** Recursively collect `.ts` files under `dir`, as repo-root-relative paths. */
async function collectSourceFiles(dir, out) {
  const entries = await readdir(dir, { withFileTypes: true })
  entries.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0))
  for (const entry of entries) {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === 'dist') continue
      await collectSourceFiles(full, out)
    } else if (entry.isFile() && entry.name.endsWith('.ts')) {
      const relative = toPosix(full.slice(REPO_ROOT.length).replace(/^[\\/]/, ''))
      out.push(relative)
    }
  }
  return out
}

/**
 * Run the deterministic bypass scan over every `.ts` file under
 * `packages/tools/src/` (recursively).
 * @returns the scan result (files, per-file summaries, every violation).
 */
export async function scanToolsBypass() {
  const files = []
  await collectSourceFiles(SRC_DIR, files)
  files.sort()

  const fileResults = []
  const violations = []
  for (const file of files) {
    const text = await readFile(join(REPO_ROOT, file), 'utf8')
    const hits = matchBypassRulesInText(text, file)
    violations.push(...hits)
    fileResults.push({
      file,
      importSpecifierCount: importSpecifiers(text).length,
      violationCount: hits.length,
    })
  }
  violations.sort(
    (a, b) =>
      a.file.localeCompare(b.file) ||
      a.line - b.line ||
      a.column - b.column ||
      (a.rule < b.rule ? -1 : a.rule > b.rule ? 1 : 0) ||
      (a.detail < b.detail ? -1 : a.detail > b.detail ? 1 : 0),
  )
  return {
    files,
    fileResults,
    violations,
    totalViolations: violations.length,
    totalImportSpecifiers: fileResults.reduce((sum, f) => sum + f.importSpecifierCount, 0),
  }
}
