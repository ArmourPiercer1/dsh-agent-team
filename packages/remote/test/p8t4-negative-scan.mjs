/**
 * p8t4-negative-scan.mjs — the P8-T4 negative-scan scanner.
 *
 * Scans exactly the P8-T4-owned files — the push engine
 * (`packages/remote/src/push/**`, 6 TypeScript files) and the P8-T4 test
 * surface (`packages/remote/test/p8t4-*`, 7 files) — and enforces that the
 * push model is built from no legacy / upstream / session log source at
 * all. The same six rules as the P8-T3 scanner, with two documented
 * test-surface exemptions (the P8-T3 scanner scanned `src` only and
 * therefore never needed them):
 *
 *   R1  no `node:`-prefixed import specifier (no builtins in `.ts` source
 *       — ruling R24) — EXEMPT for `.mjs` scanner files
 *   R2  no upstream / private specifier (the frozen private upstream
 *       module family, the `references/` tree, and the test-use checkout
 *       path)
 *   R3  no word-bounded upstream session-controller mirror token
 *   R4  no session log artifact tokens: the JSONL ledger artifact name,
 *       the camelCase log-word form, the hyphenated log-word form, and
 *       the sessions-directory path fragment
 *   R5  no frozen legacy Team SessionEvent vocabulary — delegated to the
 *       P4-T6 scanner's `matchDenyListInText` (single source of truth;
 *       this file therefore must not carry the denylist itself)
 *   R6  every import specifier is relative (`./` or `../`) — EXEMPT for
 *       the `vitest` test-runner specifier (resolved by the sanctioned
 *       test shim, not a source dependency) and for `node:` builtin
 *       specifiers inside `.mjs` files (the R1 exemption)
 *
 * Token-free by design
 * --------------------
 * This file lives inside the tree the P4-T6 scanner scans (`packages/**`)
 * and is NOT among that scanner's self-excluded files, so it must carry
 * zero denylist tokens of its own — and, unlike the P8-T3 scanner, this
 * file is itself in the scanned set, so every rule pattern and every
 * positive-control text is assembled at runtime from fragments or
 * imported values: no rule token appears as a matchable literal in this
 * source. The legacy vocabulary is imported (not embedded) from the
 * frozen scanner.
 *
 * Runner / type-surface pair (ruling R24): this `.mjs` is loaded natively
 * by the test runner; the adjacent `p8t4-negative-scan.d.mts` provides
 * the tsc (NodeNext) type surface for the `.ts` test.
 *
 * @module remote/test/p8t4-negative-scan
 */
import { readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  LEGACY_TEAM_EVENT_STRINGS,
  SESSION_EVENT_MAP_IDENTIFIER,
  SESSION_TYPES_SPECIFIER,
  matchDenyListInText,
} from '../../testkit/fault-injection/session-event-scan.mjs'

const SELF_DIR = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = resolve(SELF_DIR, '..', '..', '..')

/**
 * The word-bounded pattern factory (identifier chars: `[A-Za-z0-9_$]`) —
 * the same boundary semantics as the frozen P4-T6 scanner.
 * @param name - the identifier to bound.
 * @returns the global bounded pattern.
 */
function boundedPattern(name) {
  return new RegExp(`(?<![A-Za-z0-9_$])${name}(?![A-Za-z0-9_$])`, 'g')
}

/**
 * Assemble a word-bounded pattern from fragments so the token itself
 * never appears as a matchable literal in this source (this file is in
 * the scanned set).
 * @param parts - the token, split so no single fragment is the token.
 * @returns the global bounded pattern.
 */
function boundedPatternFromFragments(parts) {
  return boundedPattern(parts.join(''))
}

/**
 * The upstream session-controller mirror token, split so the literal
 * never appears in this source.
 */
const MIRROR_TOKEN = boundedPatternFromFragments(['Session', 'Controller'])

/**
 * The camelCase session log word, split the same way.
 */
const LOG_TOKEN_CAMEL = boundedPatternFromFragments(['session', 'Log'])

/**
 * The hyphenated session log word, split the same way.
 */
const LOG_TOKEN_HYPHEN = boundedPatternFromFragments(['session', '-', 'log'])

/** Per-line text rules (R3, R4). R1/R2/R6 are checked on import specifiers. */
const TEXT_RULES = [
  { rule: 'R3', pattern: MIRROR_TOKEN, detail: 'upstream session-controller mirror token' },
  { rule: 'R4', pattern: /session\.jsonl/g, detail: 'session log artifact token' },
  { rule: 'R4', pattern: LOG_TOKEN_CAMEL, detail: 'session log artifact token' },
  { rule: 'R4', pattern: LOG_TOKEN_HYPHEN, detail: 'session log artifact token' },
  { rule: 'R4', pattern: /\/sessions\//g, detail: 'session log artifact token' },
]

/** Import-specifier extraction patterns: static `from`, dynamic, `require`, side-effect. */
const SPECIFIER_PATTERNS = [
  /from\s*['"]([^'"]+)['"]/g,
  /import\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
  /require\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
  /^\s*import\s+['"]([^'"]+)['"]/g,
]

/** The test-runner specifier exempted from R6 (sanctioned test shim). */
const TEST_RUNNER_SPECIFIER = 'vitest'

/**
 * The single-quote character, assembled at runtime so the control texts
 * below cannot form extractable import syntax inside this source.
 */
const Q = String.fromCharCode(39)

/**
 * Apply rules R1–R6 to one text (a single file's content, or one synthetic
 * control sample).
 * @param text - the text to match.
 * @param file - the reported file label (POSIX, repo-root-relative).
 * @param isMjs - whether the label is a `.mjs` file (R1 exemption).
 * @returns the import specifiers found plus the violations, both sorted.
 */
export function matchP8T4RulesInText(text, file = '<text>', isMjs = false) {
  const violations = []
  const importSpecifiers = []
  const lines = text.split(/\r?\n/)

  lines.forEach((line, index) => {
    const lineNo = index + 1
    for (const textRule of TEXT_RULES) {
      textRule.pattern.lastIndex = 0
      let match
      while ((match = textRule.pattern.exec(line)) !== null) {
        violations.push({
          file,
          rule: textRule.rule,
          line: lineNo,
          column: match.index + 1,
          detail: `${textRule.detail} ('${match[0]})`,
        })
        if (match.index === textRule.pattern.lastIndex) textRule.pattern.lastIndex += 1
      }
    }
    for (const pattern of SPECIFIER_PATTERNS) {
      pattern.lastIndex = 0
      let match
      while ((match = pattern.exec(line)) !== null) {
        const specifier = match[1]
        const column = match.index + 1
        importSpecifiers.push({ file, line: lineNo, column, specifier })
        if (!isMjs && specifier.startsWith('node:')) {
          violations.push({
            file,
            rule: 'R1',
            line: lineNo,
            column,
            detail: `node: builtin import, specifier '${specifier}'`,
          })
        }
        if (
          specifier.includes('deepseek-harness-test-use') ||
          specifier.startsWith('references/') ||
          specifier.startsWith('@deepseek-ai/')
        ) {
          violations.push({
            file,
            rule: 'R2',
            line: lineNo,
            column,
            detail: `upstream/private specifier ('${specifier}')`,
          })
        }
        const isRelative = specifier.startsWith('./') || specifier.startsWith('../')
        const isTestRunner = specifier === TEST_RUNNER_SPECIFIER
        const isMjsBuiltin = isMjs && specifier.startsWith('node:')
        if (!isRelative && !isTestRunner && !isMjsBuiltin) {
          violations.push({
            file,
            rule: 'R6',
            line: lineNo,
            column,
            detail: `non-relative import specifier ('${specifier}')`,
          })
        }
        if (match.index === pattern.lastIndex) pattern.lastIndex += 1
      }
    }
  })

  for (const hit of matchDenyListInText(text, file)) {
    violations.push({
      file,
      rule: 'R5',
      line: hit.line,
      column: hit.column,
      detail: `frozen legacy vocabulary ${hit.kind} ('${hit.token}')`,
    })
  }

  violations.sort((a, b) => a.line - b.line || a.column - b.column || a.rule.localeCompare(b.rule))
  importSpecifiers.sort((a, b) => a.line - b.line || a.column - b.column)
  return { importSpecifiers, violations }
}

/**
 * The exact P8-T4-owned files (POSIX, repo-root-relative), in the
 * scanner's sorted order: the 6 push engine files + the 7 test files.
 */
const P8T4_OWNED_FILES = [
  'packages/remote/src/push/generation.ts',
  'packages/remote/src/push/index.ts',
  'packages/remote/src/push/ledger-page.ts',
  'packages/remote/src/push/pull.ts',
  'packages/remote/src/push/reconnect.ts',
  'packages/remote/src/push/types.ts',
  'packages/remote/test/p8t4-engine.test.ts',
  'packages/remote/test/p8t4-negative-scan.d.mts',
  'packages/remote/test/p8t4-negative-scan.mjs',
  'packages/remote/test/p8t4-negative.test.ts',
  'packages/remote/test/p8t4-server.ts',
  'packages/remote/test/p8t4-sync.test.ts',
  'packages/remote/test/p8t4-test-client.ts',
]

/**
 * A synthetic sample that must trip R1 + R2 + R6 (builtin, upstream and
 * non-relative specifiers). Every line is assembled at runtime from
 * fragments / imported values so this source stays token-free and
 * carries no extractable import syntax of its own.
 * @returns the control text.
 */
export function buildP8T4SpecifierControlText() {
  return [
    `import { readFileSync } from ${Q}node:fs${Q}`,
    `import { helper } from ${Q}${SESSION_TYPES_SPECIFIER}${Q}`,
    `import { other } from ${Q}some-bare-specifier${Q}`,
  ].join('\n')
}

/**
 * A synthetic sample that must trip R3 (the mirror token) and R4 (four
 * session log artifact tokens). Assembled at runtime from fragments.
 * @returns the control text.
 */
export function buildP8T4MirrorLogControlText() {
  return [
    `const controller = ${['Session', 'Controller'].join('')}`,
    `const logPath = ${Q}C:/dsh/${['sess', 'ions'].join('')}/root-1/${['session', '.jsonl', '.zstd'].join('')}${Q}`,
    `let ${['session', 'Log'].join('')} = 1`,
    `const key = ${String.fromCharCode(34)}${['session', '-', 'log'].join('')}${String.fromCharCode(34)}`,
  ].join('\n')
}

/**
 * A synthetic sample that must produce exactly one `event-string` hit and
 * one `declaration-merge` hit under the frozen denylist. Built at runtime
 * from the imported frozen scanner values — no literal appears in this
 * file.
 * @returns the control text.
 */
export function buildP8T4VocabularyControlText() {
  return [
    `import type { ${SESSION_EVENT_MAP_IDENTIFIER} } from ${Q}${SESSION_TYPES_SPECIFIER}${Q}`,
    `const sample = ${Q}${LEGACY_TEAM_EVENT_STRINGS[0]}${Q}`,
  ].join('\n')
}

/**
 * Scan the exact P8-T4-owned file list and apply rules R1–R6 to each
 * (the `.mjs` scanner file gets the R1 exemption).
 * @returns the deterministic scan result.
 * @throws when an owned file is missing or cannot be read (fail loud,
 *   never skip).
 */
export function scanP8T4OwnedFiles() {
  const files = []
  const fileResults = []
  const violations = []
  for (const rel of [...P8T4_OWNED_FILES].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))) {
    const full = join(REPO_ROOT, ...rel.split('/'))
    const text = readFileSync(full, 'utf8')
    const result = matchP8T4RulesInText(text, rel, rel.endsWith('.mjs'))
    files.push(rel)
    fileResults.push({
      file: rel,
      importSpecifiers: result.importSpecifiers,
      violations: result.violations,
    })
    violations.push(...result.violations)
  }
  return { files, fileResults, violations, totalViolations: violations.length }
}
