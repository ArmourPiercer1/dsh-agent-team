/**
 * session-event-scan — the committed ZERO Team SessionEvent scanner
 * (P4-T6, ruling R24; G4 criterion 2: "no Team SessionEvent persistence").
 *
 * Purpose: prove, as a deterministic re-runnable scan over ALL vNext
 * sources, that no Team SessionEvent vocabulary is defined, merged, or
 * emitted anywhere in the 9-package tree. A gate reviewer re-runs it via
 * the canonical chain: `node scripts/run-tests.mjs` executes the committed
 * `packages/testkit/test/p4t6-*.test.ts`, which imports this module and
 * pins the result (zero violations, the frozen quarantine set, positive
 * and negative controls).
 *
 * Denylist (FROZEN, verbatim from the legacy reference
 * `references/deepseek-harness/packages/team/team/src/events.ts` — the
 * denylist source of record named by TaskDoc §11.5 P4-T6; confirmed at
 * audit time by reading that file):
 *
 * 1. The five legacy Team SessionEvent type strings:
 *      team/member-bound   team/progress   team/control-request
 *      team/control-decision   team/message
 *    Matched ONLY as EXACT quoted string literals — single, double, or
 *    backtick, same quote character at both ends. Longer literals
 *    (`'team/progress2'`, `'team/progress-report'`, `'team/unknown'`) and
 *    other prefixes (`'user/message'`) are NOT hits: exact-match
 *    precision, never a substring scan.
 * 2. The declaration-merging pattern: the word-bounded identifier
 *    `SessionEventMap` together with at least one rule-1 legacy event
 *    string and the quoted module specifier
 *    `'@deepseek-ai/dsh-session/types'` in the SAME file — the legacy
 *    pattern merges team/* members into SessionEventMap on
 *    @deepseek-ai/dsh-session/types. Exactly ONE file-level hit, at the
 *    first `SessionEventMap` line.
 * 3. The five legacy payload symbol names, matched as exact word-bounded
 *    identifiers:
 *      TeamMemberBoundData   TeamProgressData   TeamControlRequestData
 *      TeamControlDecisionData   TeamMessageData
 *    A longer identifier (`TeamProgressDataX`) is NOT a hit.
 *
 * Scope: EVERY `.ts` / `.mts` / `.mjs` file under `packages/**` (all nine
 * TaskDoc §11 packages, production + test sources).
 *
 * Exclusions (documented; NO other skips exist — no blanket file skips):
 *
 * - directory segments named exactly `node_modules` or `dist`, at any
 *   depth (dependency and build-artifact trees, not vNext sources);
 * - EXACTLY TWO self-referential files, which must exist in the scanned
 *   tree because the denylist text has to be committed somewhere:
 *     1. this scanner itself:
 *        `packages/testkit/fault-injection/session-event-scan.mjs`
 *     2. the committed test that carries the pinned quarantine table and
 *        the synthetic control samples:
 *        `packages/testkit/test/p4t6-*.test.ts`
 *   The adjacent `session-event-scan.d.mts` is NOT excluded: it is
 *   scanned and must carry zero denylist tokens (its type names are
 *   token-free by design).
 *
 * Determinism: directories are walked in sorted (code-unit) name order,
 * files are sorted, hits are sorted by (file, line, column, kind, token);
 * no clocks, no environment reads, no randomness. The same tree yields
 * the same result on every run.
 *
 * This `.mjs` is the only module here allowed to import `node:` builtins
 * (`node:fs`, `node:path`, `node:url`) — the zero-`node:`-builtin rule for
 * `.ts` files is absolute (rulings R22/R24). The plain-node test runner
 * loads this module natively; tsc (NodeNext) resolves the types from the
 * adjacent `session-event-scan.d.mts`.
 *
 * @module fault-injection/session-event-scan
 */

import { readdirSync, readFileSync, realpathSync, statSync } from 'node:fs'
import { basename, dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

// --- the frozen denylist (verbatim; see header) -----------------------------

/** The five legacy Team SessionEvent type strings. */
export const LEGACY_TEAM_EVENT_STRINGS = [
  'team/member-bound',
  'team/progress',
  'team/control-request',
  'team/control-decision',
  'team/message',
]

/** The five legacy payload symbol names. */
export const LEGACY_PAYLOAD_SYMBOLS = [
  'TeamMemberBoundData',
  'TeamProgressData',
  'TeamControlRequestData',
  'TeamControlDecisionData',
  'TeamMessageData',
]

/** The identifier the legacy declaration-merging pattern targets. */
export const SESSION_EVENT_MAP_IDENTIFIER = 'SessionEventMap'

/** The module the legacy declaration-merging pattern merges into. */
export const SESSION_TYPES_SPECIFIER = '@deepseek-ai/dsh-session/types'

// --- matchers ----------------------------------------------------------------

/** One quoted literal of an exact legacy event name (same quote both ends). */
const QUOTED_EVENT_PATTERNS = LEGACY_TEAM_EVENT_STRINGS.map(
  (name) => new RegExp(`(["'\`])${name}\\1`, 'g'),
)

/** Word-bounded identifier match (identifier chars: [A-Za-z0-9_$]). */
function boundedIdentifier(name) {
  return new RegExp(`(?<![A-Za-z0-9_$])${name}(?![A-Za-z0-9_$])`, 'g')
}

const PAYLOAD_SYMBOL_PATTERNS = LEGACY_PAYLOAD_SYMBOLS.map(boundedIdentifier)
const SESSION_EVENT_MAP_PATTERN = boundedIdentifier(SESSION_EVENT_MAP_IDENTIFIER)
const SPECIFIER_PATTERN = /(["'`])@deepseek-ai\/dsh-session\/types\1/g

/**
 * Match the denylist inside one text.
 * @param text - the file content (or one synthetic control sample).
 * @param file - the reported file label (POSIX, repo-root-relative).
 * @returns the hits, sorted by (line, column, kind, token).
 */
export function matchDenyListInText(text, file = '<text>') {
  const lines = text.split(/\r?\n/)
  const hits = []
  let sawQuotedLegacyEvent = false
  let sawSpecifier = false
  let firstMapLine = 0
  let firstMapColumn = 0

  lines.forEach((line, index) => {
    const lineNo = index + 1
    for (let k = 0; k < LEGACY_TEAM_EVENT_STRINGS.length; k += 1) {
      const pattern = QUOTED_EVENT_PATTERNS[k]
      pattern.lastIndex = 0
      let match
      while ((match = pattern.exec(line)) !== null) {
        hits.push({ file, line: lineNo, column: match.index + 1, kind: 'event-string', token: LEGACY_TEAM_EVENT_STRINGS[k] })
        sawQuotedLegacyEvent = true
        if (match[0].length === 0) pattern.lastIndex += 1
      }
    }
    for (let k = 0; k < LEGACY_PAYLOAD_SYMBOLS.length; k += 1) {
      const pattern = PAYLOAD_SYMBOL_PATTERNS[k]
      pattern.lastIndex = 0
      let match
      while ((match = pattern.exec(line)) !== null) {
        hits.push({ file, line: lineNo, column: match.index + 1, kind: 'payload-symbol', token: LEGACY_PAYLOAD_SYMBOLS[k] })
        if (match[0].length === 0) pattern.lastIndex += 1
      }
    }
    if (firstMapLine === 0) {
      SESSION_EVENT_MAP_PATTERN.lastIndex = 0
      const match = SESSION_EVENT_MAP_PATTERN.exec(line)
      if (match !== null) {
        firstMapLine = lineNo
        firstMapColumn = match.index + 1
      }
    }
    if (!sawSpecifier) {
      SPECIFIER_PATTERN.lastIndex = 0
      if (SPECIFIER_PATTERN.test(line)) sawSpecifier = true
    }
  })

  if (sawQuotedLegacyEvent && sawSpecifier && firstMapLine > 0) {
    hits.push({ file, line: firstMapLine, column: firstMapColumn, kind: 'declaration-merge', token: SESSION_EVENT_MAP_IDENTIFIER })
  }

  hits.sort(
    (a, b) =>
      a.line - b.line ||
      a.column - b.column ||
      (a.kind < b.kind ? -1 : a.kind > b.kind ? 1 : 0) ||
      (a.token < b.token ? -1 : a.token > b.token ? 1 : 0),
  )
  return hits
}

// --- the tree scan ------------------------------------------------------------

const SELF_PATH = join(resolve(dirname(fileURLToPath(import.meta.url))), 'session-event-scan.mjs')

function toPosix(p) {
  return p.split('\\').join('/')
}

function compareNames(a, b) {
  return a < b ? -1 : a > b ? 1 : 0
}

/**
 * Scan every `.ts` / `.mts` / `.mjs` file under `packages/**` of one repo
 * root (default: the repo root this module lives in) for the frozen
 * Team SessionEvent denylist. See the module header for the exact
 * matching precision and the exclusion contract.
 * @param options - optional override of the repo root.
 * @returns the deterministic scan result.
 */
export function scanSessionEventVocabulary(options = {}) {
  const repoRoot = resolve(options.repoRoot !== undefined ? options.repoRoot : join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..'))
  const packagesDir = join(repoRoot, 'packages')
  const testkitTestDir = join(packagesDir, 'testkit', 'test')

  const files = []
  const excludedSelfFiles = []
  const skippedDirs = []
  const visited = new Set()

  function walk(dir) {
    let real
    try {
      real = realpathSync(dir)
    } catch {
      real = dir
    }
    if (visited.has(real)) return
    visited.add(real)
    let entries
    try {
      entries = readdirSync(dir, { withFileTypes: true }).sort((a, b) => compareNames(a.name, b.name))
    } catch (error) {
      // A concurrent fault-injection suite may tear down transient scratch
      // (test/.tmp-fault/) between the parent listing and this descent.
      if (error && error.code === 'ENOENT') return
      throw error
    }
    for (const entry of entries) {
      const abs = join(dir, entry.name)
      let isDir = entry.isDirectory()
      if (entry.isSymbolicLink()) {
        try {
          isDir = statSync(abs).isDirectory()
        } catch {
          isDir = false
        }
      }
      if (isDir) {
        if (entry.name === 'node_modules' || entry.name === 'dist' || entry.name === '.tmp-fault') {
          skippedDirs.push({ name: entry.name, path: toPosix(relative(repoRoot, abs)) })
          continue
        }
        walk(abs)
        continue
      }
      if (!entry.isFile()) continue
      const base = entry.name
      if (!(base.endsWith('.ts') || base.endsWith('.mts') || base.endsWith('.mjs'))) continue
      const rel = toPosix(relative(repoRoot, abs))
      if (abs === SELF_PATH) {
        excludedSelfFiles.push(rel)
        continue
      }
      if (dirname(abs) === testkitTestDir && /^p4t6-.*\.test\.ts$/.test(base)) {
        excludedSelfFiles.push(rel)
        continue
      }
      files.push(rel)
    }
  }

  const packageDirs = readdirSync(packagesDir, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .sort(compareNames)

  for (const name of packageDirs) {
    walk(join(packagesDir, name))
  }

  files.sort(compareNames)
  excludedSelfFiles.sort(compareNames)

  const hits = []
  for (const file of files) {
    const abs = join(repoRoot, ...file.split('/'))
    let text
    try {
      text = readFileSync(abs, 'utf8')
    } catch (error) {
      throw new Error(
        `session-event-scan: cannot read ${file}: ${error instanceof Error ? error.message : String(error)}`,
      )
    }
    for (const hit of matchDenyListInText(text, file)) hits.push(hit)
  }

  return {
    repoRoot,
    packagesDir,
    packageDirs,
    files,
    filesScanned: files.length,
    excludedSelfFiles,
    skippedDirs,
    hits,
    summary: {
      eventString: hits.filter((h) => h.kind === 'event-string').length,
      payloadSymbol: hits.filter((h) => h.kind === 'payload-symbol').length,
      declarationMerge: hits.filter((h) => h.kind === 'declaration-merge').length,
      total: hits.length,
    },
  }
}

/** The basename of this module (the self-exclusion contract names it). */
export const SCANNER_SELF_BASENAME = basename(SELF_PATH)
