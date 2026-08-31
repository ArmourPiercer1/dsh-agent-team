/**
 * p8t3-negative-scan.mjs — the P8-T3 negative-scan scanner (Brief §87–96).
 *
 * Scans exactly the P8-T3-owned source files, `packages/remote/src/**`
 * (22 TypeScript files: the index + 9 contract modules + 12 handler
 * modules), and enforces that the remote contract layer is built from no
 * legacy / upstream / session-log source at all. Six rules, one violation
 * object per hit:
 *
 *   R1  no `node:`-prefixed import specifier (no builtins in `.ts` source
 *       — ruling R24; only `.mjs` scanner files may import builtins)
 *   R2  no upstream / private specifier: no specifier containing
 *       `deepseek-harness-test-use`, starting with `references/`, or
 *       starting with `@deepseek-ai/`
 *   R3  no word-bounded `SessionController` token (no mirror of the
 *       upstream session controller for Team state)
 *   R4  no session-log artifact tokens: the `session.jsonl` substring
 *       (which also covers `.zstd`), word-bounded `sessionLog`,
 *       word-bounded `session-log`, and the `/sessions/` substring
 *   R5  no frozen legacy Team SessionEvent vocabulary — delegated to the
 *       P4-T6 scanner's `matchDenyListInText` (single source of truth;
 *       this file therefore must not carry the denylist itself)
 *   R6  every import specifier is relative (`./` or `../`) — one check
 *       that proves in a single stroke that no mirror / upstream /
 *       builtin source is used
 *
 * Token-free by design
 * --------------------
 * This file lives inside the tree the P4-T6 scanner scans (`packages/**`)
 * and is not one of that scanner's self-excluded files, so it must carry
 * zero denylist tokens of its own. The legacy vocabulary is imported (not
 * embedded) from the frozen scanner, and the positive-control texts below
 * are built at runtime from those imported values — no literal appears in
 * this file.
 *
 * Runner / type-surface pair (ruling R24): this `.mjs` is loaded natively
 * by the vitest worker; the adjacent `p8t3-negative-scan.d.mts` provides
 * the tsc (NodeNext) type surface for the `.ts` test.
 *
 * @module remote/test/p8t3-negative-scan
 */
import { readFileSync, readdirSync } from 'node:fs'
import { dirname, join, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  LEGACY_TEAM_EVENT_STRINGS,
  SESSION_EVENT_MAP_IDENTIFIER,
  SESSION_TYPES_SPECIFIER,
  matchDenyListInText,
} from '../../testkit/fault-injection/session-event-scan.mjs'

const SELF_DIR = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = resolve(SELF_DIR, '..', '..', '..')

/** Per-line text rules (R3, R4). R1/R2/R6 are checked on import specifiers. */
const TEXT_RULES = [
  {
    rule: 'R3',
    pattern: /(?<![A-Za-z0-9_$])SessionController(?![A-Za-z0-9_$])/g,
    detail: 'SessionController mirror token',
  },
  { rule: 'R4', pattern: /session\.jsonl/g, detail: 'session-log artifact token' },
  {
    rule: 'R4',
    pattern: /(?<![A-Za-z0-9_$])sessionLog(?![A-Za-z0-9_$])/g,
    detail: 'session-log artifact token',
  },
  {
    rule: 'R4',
    pattern: /(?<![A-Za-z0-9_$])session-log(?![A-Za-z0-9_$])/g,
    detail: 'session-log artifact token',
  },
  { rule: 'R4', pattern: /\/sessions\//g, detail: 'session-log artifact token' },
]

/** Import-specifier extraction patterns: static `from`, dynamic, `require`, side-effect. */
const SPECIFIER_PATTERNS = [
  /from\s*['"]([^'"]+)['"]/g,
  /import\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
  /require\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
  /^\s*import\s+['"]([^'"]+)['"]/g,
]

/**
 * Apply rules R1–R6 to one text (a single file's content, or one synthetic
 * control sample).
 * @param text - the text to match.
 * @param file - the reported file label (POSIX, repo-root-relative).
 * @returns the import specifiers found plus the violations, both sorted.
 */
export function matchP8T3RulesInText(text, file = '<text>') {
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
          detail: `${textRule.detail} ('${match[0]}')`,
        })
        if (match.index === textRule.pattern.lastIndex) textRule.pattern.lastIndex += 1
      }
    }
    for (const pattern of SPECIFIER_PATTERNS) {
      pattern.lastIndex = 0
      let match
      while ((match = pattern.exec(line)) !== null) {
        const specifier = match[1]
        const column = match.index + match[0].indexOf(specifier) + 1
        importSpecifiers.push({ file, line: lineNo, column, specifier })
        if (specifier.startsWith('node:')) {
          violations.push({
            file,
            rule: 'R1',
            line: lineNo,
            column,
            detail: `node: builtin import ('${specifier}')`,
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
        if (!specifier.startsWith('./') && !specifier.startsWith('../')) {
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
 * A synthetic sample that must trip R1 + R2 + R6 (builtin, upstream and
 * non-relative specifiers). The private upstream specifier is built from
 * the imported constant value, never embedded as a literal, so this file
 * stays token-free.
 * @returns the control text.
 */
export function buildP8T3SpecifierControlText() {
  return [
    `import { readFileSync } from 'node:fs'`,
    `import { helper } from '../../references/deepseek-harness-test-use/src/fixture.js'`,
    `import type { Unknown } from '${SESSION_TYPES_SPECIFIER}'`,
  ].join('\n')
}

/**
 * A synthetic sample that must trip R3 (the mirror token) and R4 (four
 * session-log artifact tokens).
 * @returns the control text.
 */
export function buildP8T3MirrorLogControlText() {
  return [
    'const controller = SessionController',
    `const logPath = 'C:/dsh/sessions/root-1/session.jsonl.zstd'`,
    'let sessionLog = 1',
    'const key = "session-log"',
  ].join('\n')
}

/**
 * A synthetic sample that must produce exactly one `event-string` hit and
 * one `declaration-merge` hit under the frozen denylist. Built at runtime
 * from the imported frozen scanner values — no literal appears in this
 * file.
 * @returns the control text.
 */
export function buildP8T3VocabularyControlText() {
  return [
    `import type { ${SESSION_EVENT_MAP_IDENTIFIER} } from '${SESSION_TYPES_SPECIFIER}'`,
    `const sample = '${LEGACY_TEAM_EVENT_STRINGS[0]}'`,
  ].join('\n')
}

/**
 * Collect every `.ts` file under `dir` recursively (skipping
 * `node_modules` / `dist`), in sorted order.
 * @param dir - the directory to walk.
 * @param out - the accumulator.
 * @returns the accumulator.
 */
function collectTsFiles(dir, out) {
  const entries = readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))
  for (const entry of entries) {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === 'dist') continue
      collectTsFiles(full, out)
      continue
    }
    if (entry.name.endsWith('.ts')) out.push(full)
  }
  return out
}

/**
 * Scan every `.ts` file under `packages/remote/src` (the P8-T3-owned
 * source files) and apply rules R1–R6 to each.
 * @returns the deterministic scan result.
 * @throws when a candidate file cannot be read (fail loud, never skip).
 */
export function scanP8T3OwnedFiles() {
  const srcDir = join(REPO_ROOT, 'packages', 'remote', 'src')
  const fullFiles = collectTsFiles(srcDir, []).sort()
  const files = []
  const fileResults = []
  const violations = []
  for (const full of fullFiles) {
    const rel = relative(REPO_ROOT, full).split(sep).join('/')
    const text = readFileSync(full, 'utf8')
    const result = matchP8T3RulesInText(text, rel)
    files.push(rel)
    fileResults.push({ file: rel, importSpecifiers: result.importSpecifiers, violations: result.violations })
    violations.push(...result.violations)
  }
  return { files, fileResults, violations, totalViolations: violations.length }
}
