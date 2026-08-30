/**
 * p7t5-no-creation-scan.mjs — the P7-T5 committed static "no creation
 * path" scanner (TaskDoc §11.8 P7-T5; DevPlan §20.5).
 *
 * Purpose: prove, as a deterministic re-runnable scan over the HANDOFF
 * module's sources (every `.ts` file under `packages/runtime/handoff/`
 * — the module that must DELEGATE team creation to the injected public
 * Team creation entry and own no MemberInstance/TeamSession creation
 * path of its own), that the module source:
 *
 *   R1 — never imports the storage layer: no static/dynamic import
 *        specifier may carry a path segment equal to `storage`;
 *   R2 — never imports a creation path: no specifier may carry a path
 *        segment equal to `activation` or `root-binding`;
 *   R3 — never touches the repositories: no `.repositories.` member
 *        access text may appear anywhere in the source text;
 *   R4 — never calls a creation entry: none of the creation call texts
 *        (`putTeamSession(`, `teamSessions.put`, `memberInstances.put`,
 *        `activate(`, `bindFreshTeamRoot`) may appear anywhere in the
 *        source text;
 *   R5 — never uses `node:` builtins: no import specifier may start
 *        with `node:`;
 *   R6 — imports ONLY intra-repo relative specifiers: every import
 *        specifier must start with `./` or `../`;
 *   R7 — never uses dynamic module loading: no `import(` / `require(`
 *        call text may appear anywhere in the source text.
 *
 * A gate reviewer re-runs it via the canonical chain:
 * `node scripts/run-tests.mjs` executes the committed
 * `packages/runtime/test/p7t5-no-creation-scan.test.ts`, which imports
 * this module and pins the result (zero violations, the exact file
 * list, positive and negative text controls).
 *
 * Precision notes: R1/R2 match PATH SEGMENTS of import specifiers only
 * (a comment that mentions a layer name is NOT a hit); R3/R4/R7 match
 * source TEXT (the module must not even carry the call text); R5/R6
 * match every import specifier, including dynamic ones.
 *
 * Only this `.mjs` file may import `node:` builtins; the adjacent
 * `.d.mts` carries the tsc type surface (the plain-node runner loads
 * the `.mjs` natively).
 *
 * @module p7t5-no-creation-scan
 */

import { readFileSync, readdirSync } from 'node:fs'
import { dirname, join, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

/** The repo root (this file lives at `packages/runtime/test/`). */
const REPO_ROOT = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
  '..',
)

/** The forbidden creation call texts (rule R4). */
const CALL_TEXT_RULES = [
  { rule: 'R4', source: 'putTeamSession\\s*\\(', detail: 'putTeamSession( call text' },
  { rule: 'R4', source: 'teamSessions\\.put', detail: 'teamSessions.put call text' },
  { rule: 'R4', source: 'memberInstances\\.put', detail: 'memberInstances.put call text' },
  { rule: 'R4', source: 'activate\\s*\\(', detail: 'activate( call text' },
  { rule: 'R4', source: 'bindFreshTeamRoot', detail: 'bindFreshTeamRoot call text' },
]

/**
 * Run every rule over one source text.
 * @param {string} text - the full source text of one file.
 * @param {string} [file] - the file label (POSIX, relative to the repo
 *   root) recorded on each violation.
 * @returns {{ importSpecifiers: string[], violations: Array<{file: string, rule: string, line: number, column: number, detail: string}> }}
 */
export function matchNoCreationRulesInText(text, file = '<text>') {
  const lines = text.split('\n')
  /** @type {Array<{spec: string, line: number, column: number}>} */
  const specs = []
  /** @type {Array<{file: string, rule: string, line: number, column: number, detail: string}>} */
  const violations = []

  lines.forEach((line, i) => {
    const lineNo = i + 1
    // Static / re-export specifiers: ... from '...'
    let match
    const fromRe = /from\s+['"]([^'"]+)['"]/g
    while ((match = fromRe.exec(line)) !== null) {
      specs.push({ spec: match[1], line: lineNo, column: match.index + 1 })
    }
    // Side-effect imports: import '...'
    const sideRe = /^\s*import\s+['"]([^'"]+)['"]/g
    while ((match = sideRe.exec(line)) !== null) {
      specs.push({ spec: match[1], line: lineNo, column: match.index + 1 })
    }
    // Dynamic imports: import('...') — rule R7 + a specifier.
    const dynRe = /import\s*\(\s*['"]([^'"]+)['"]\s*\)/g
    while ((match = dynRe.exec(line)) !== null) {
      specs.push({ spec: match[1], line: lineNo, column: match.index + 1 })
      violations.push({
        file,
        rule: 'R7',
        line: lineNo,
        column: match.index + 1,
        detail: 'dynamic import( call',
      })
    }
    // require( ... ) calls — rule R7.
    const reqRe = /require\s*\(\s*['"]([^'"]*)['"]\s*\)/g
    while ((match = reqRe.exec(line)) !== null) {
      violations.push({
        file,
        rule: 'R7',
        line: lineNo,
        column: match.index + 1,
        detail: 'require( call',
      })
    }
  })

  for (const { spec, line, column } of specs) {
    if (spec.startsWith('node:')) {
      violations.push({ file, rule: 'R5', line, column, detail: spec })
    }
    if (!spec.startsWith('./') && !spec.startsWith('../')) {
      violations.push({ file, rule: 'R6', line, column, detail: spec })
    }
    if (spec.startsWith('./') || spec.startsWith('../')) {
      const segments = spec.split('/')
      if (segments.includes('storage')) {
        violations.push({ file, rule: 'R1', line, column, detail: spec })
      }
      if (segments.includes('activation') || segments.includes('root-binding')) {
        violations.push({ file, rule: 'R2', line, column, detail: spec })
      }
    }
  }

  // Text rules (R3 + R4): every occurrence, per line.
  lines.forEach((line, i) => {
    const lineNo = i + 1
    const re3 = /\.repositories\./g
    let match
    while ((match = re3.exec(line)) !== null) {
      violations.push({
        file,
        rule: 'R3',
        line: lineNo,
        column: match.index + 1,
        detail: '.repositories. member access',
      })
    }
    for (const callRule of CALL_TEXT_RULES) {
      const re = new RegExp(callRule.source, 'g')
      while ((match = re.exec(line)) !== null) {
        violations.push({
          file,
          rule: callRule.rule,
          line: lineNo,
          column: match.index + 1,
          detail: callRule.detail,
        })
      }
    }
  })

  violations.sort(
    (a, b) => a.line - b.line || a.column - b.column || a.rule.localeCompare(b.rule),
  )
  return {
    importSpecifiers: specs.map((s) => s.spec),
    violations,
  }
}

/**
 * Run the deterministic scan over every `.ts` file under
 * `packages/runtime/handoff/` (the handoff module).
 * @returns {{
 *   files: string[],
 *   fileResults: Array<{file: string, importSpecifiers: string[], violations: number}>,
 *   violations: Array<{file: string, rule: string, line: number, column: number, detail: string}>,
 *   totalViolations: number,
 *   totalImportSpecifiers: number
 * }}
 */
export function scanHandoffNoCreation() {
  const handoffDir = join(REPO_ROOT, 'packages', 'runtime', 'handoff')
  const names = readdirSync(handoffDir)
    .filter((n) => n.endsWith('.ts'))
    .sort()
  /** @type {string[]} */
  const files = []
  /** @type {Array<{file: string, importSpecifiers: string[], violations: number}>} */
  const fileResults = []
  /** @type {Array<{file: string, rule: string, line: number, column: number, detail: string}>} */
  const violations = []
  let totalImportSpecifiers = 0
  for (const name of names) {
    const fullPath = join(handoffDir, name)
    const rel = relative(REPO_ROOT, fullPath).split(sep).join('/')
    files.push(rel)
    const text = readFileSync(fullPath, 'utf8')
    const { importSpecifiers, violations: fileViolations } =
      matchNoCreationRulesInText(text, rel)
    totalImportSpecifiers += importSpecifiers.length
    fileResults.push({
      file: rel,
      importSpecifiers,
      violations: fileViolations.length,
    })
    violations.push(...fileViolations)
  }
  return {
    files,
    fileResults,
    violations,
    totalViolations: violations.length,
    totalImportSpecifiers,
  }
}
