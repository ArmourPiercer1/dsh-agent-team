#!/usr/bin/env node
/**
 * Serializer-class audit, refined instrument (a4-pr7/capability-negatives, task 5).
 *
 * Measures the class "a negative leg passes because its input never reached the
 * code under test", in four numbers:
 *
 *  A. files under packages/<pkg>/test that build blueprint-document YAML text
 *     in-test (a hand-written `---` frontmatter, or a local serializer);
 *  B. of those, files whose YAML is DYNAMICALLY assembled so that a value can
 *     carry a multi-line block (join/map/JSON.stringify into the text) — the
 *     shape nobody eyeballs;
 *  C. NEGATIVE legs written as a bare `.toThrow()` (no expected message, no
 *     error class, `.not.toThrow()` excluded) whose throwing expression calls a
 *     blueprint parse/validate entry point — the only assertion form in which a
 *     fixture syntax error can impersonate a refusal;
 *  D. SUSPECTS = C, in a file that builds its own document (A). A suspect is not
 *     automatically a false green: it is a leg that must be shown to carry its
 *     own reachability proof (like `bp1-blueprint-inspector.test.ts`, whose leg
 *     asserts `inspection.status === 'ok'` over the SAME text first).
 *
 * The `expect(...)` expression is found by a balanced-paren scan, so a
 * multi-line `expect(() => { ... }).toThrow()` counts and a neighbouring line's
 * parser call does not.
 *
 * Run: node dev/agent-workflow/evidence/a4-pr7/capability-negatives/scratch/audit-serializers.mjs <repoRoot>
 */
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

const ROOT = process.argv[2] ?? process.cwd()
const ROOTS = ['contracts', 'domain', 'legacy', 'remote', 'runtime', 'storage', 'testkit', 'tools', 'client']

function walk(dir, out = []) {
  let entries
  try {
    entries = readdirSync(dir)
  } catch {
    return out
  }
  for (const name of entries) {
    const p = join(dir, name)
    const st = statSync(p)
    if (st.isDirectory()) walk(p, out)
    else if (name.endsWith('.ts') || name.endsWith('.mts') || name.endsWith('.mjs')) out.push(p)
  }
  return out
}

const files = []
for (const pkg of ROOTS) walk(join(ROOT, 'packages', pkg, 'test'), files)

const FRONTMATTER = /['"`]---\\n?|^\s*'---',|\\n---/m
const SERIALIZER = /function\s+(toYaml\w*|yamlify\w*|emitYaml\w*|stringifyYaml\w*|writeYaml\w*|dumpYaml\w*)|const\s+(toYaml\w*|yamlify\w*)\s*=/
const BLOCK_INTERP = /\$\{[^}\n]*\.join\((['"`])\\n\1[^}]*\}|\$\{[^}\n]*\.map\([^}]*\}|\$\{[^}\n]*JSON\.stringify/
const PARSE_ENTRY = /\b(parseBlueprint|parseBlueprintText|inspectBlueprintSource|inspectBlueprint|decodeYamlFrontmatter|validateBlueprintDocument|validateBlueprint)\s*\(/

/** Every `expect(` ... `)` expression in `text`, balanced. */
function expectExpressions(text) {
  const out = []
  for (let i = 0; i < text.length - 6; i += 1) {
    if (text.slice(i, i + 6) !== 'expect') continue
    let j = i + 6
    while (j < text.length && /\s/.test(text[j])) j += 1
    if (text[j] !== '(') continue
    let depth = 0
    let inString = null
    for (let k = j; k < text.length; k += 1) {
      const ch = text[k]
      if (inString) {
        if (ch === '\\') k += 1
        else if (ch === inString) inString = null
        continue
      }
      if (ch === '"' || ch === "'" || ch === '`') inString = ch
      else if (ch === '(') depth += 1
      else if (ch === ')') {
        depth -= 1
        if (depth === 0) {
          // The matcher lives OUTSIDE the expect(...) parens: `expect(x).toThrow()`.
          // Collect the fluent chain that follows (`.not`, `.rejects`, the matcher
          // call), continuing over a line break when the line ends mid-chain.
          let tail = ''
          let rest = text.slice(k + 1)
          for (let step = 0; step < 3; step += 1) {
            const lineEnd = rest.indexOf('\n')
            const line = lineEnd < 0 ? rest : rest.slice(0, lineEnd)
            tail += line
            if (!/[.(]$|\.not$|\.rejects$|\.resolves$/.test(line.trimEnd())) break
            tail += '\n'
            rest = lineEnd < 0 ? '' : rest.slice(lineEnd + 1)
          }
          out.push({
            start: i,
            line: text.slice(0, i).split('\n').length,
            call: text.slice(i, k + 1),
            expr: text.slice(i, k + 1) + tail,
          })
          i = k
          break
        }
      }
    }
  }
  return out
}

const rows = []
for (const abs of files) {
  const rel = relative(ROOT, abs).replaceAll('\\', '/')
  const text = readFileSync(abs, 'utf8')
  const buildsFrontmatter = FRONTMATTER.test(text)
  const serializer = SERIALIZER.test(text)
  const dynamicBlock = buildsFrontmatter && BLOCK_INTERP.test(text)
  const negativeLegs = []
  let bareAny = 0
  // A comment is not an assertion: drop the text of line/block comments first.
  const code = text.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' ')).replace(/(^|[^:'"`])\/\/[^\n]*/g, '$1')
  for (const e of expectExpressions(code)) {
    // bare .toThrow(): empty argument list, and NOT the `.not` form
    const bare = /\.toThrow\(\s*\)/.test(e.expr) && !/\.not\s*\.\s*toThrow\(\s*\)/.test(e.expr)
    if (!bare) continue
    bareAny += 1
    if (PARSE_ENTRY.test(e.call)) negativeLegs.push(e.line)
  }
  if (!buildsFrontmatter && !serializer && bareAny === 0) continue
  rows.push({
    rel,
    buildsFrontmatter,
    serializer,
    dynamicBlock,
    bareAny,
    bareOnParse: negativeLegs,
    suspect: buildsFrontmatter && negativeLegs.length > 0,
  })
}

const n = (pred) => rows.filter(pred).length
const testTs = files.filter((f) => f.endsWith('.test.ts')).length
console.log(JSON.stringify({
  testFilesTestTsInNineRoots: testTs,
  filesScannedAllExtensions: files.length,
  A_filesBuildingBlueprintFrontmatter: n((r) => r.buildsFrontmatter),
  A1_withLocalYamlSerializer: n((r) => r.serializer),
  B_withMultiLineDynamicInterpolation: n((r) => r.dynamicBlock),
  filesWithAnyBareToThrow: n((r) => r.bareAny > 0),
  bareToThrowTotal: rows.reduce((a, r) => a + r.bareAny, 0),
  C_bareToThrowOnParseEntryFiles: n((r) => r.bareOnParse.length > 0),
  C_bareToThrowOnParseEntryLegs: rows.reduce((a, r) => a + r.bareOnParse.length, 0),
  D_suspects: n((r) => r.suspect),
}, null, 1))

console.log('\n--- local YAML serializers (the t1 class) ---')
for (const r of rows.filter((x) => x.serializer)) console.log(`  ${r.rel}`)
console.log('\n--- B: frontmatter text with multi-line dynamic interpolation ---')
for (const r of rows.filter((x) => x.dynamicBlock)) console.log(`  ${r.rel}`)
console.log('\n--- C: bare .toThrow() whose throwing expression calls a parse/validate entry ---')
for (const r of rows.filter((x) => x.bareOnParse.length > 0)) {
  console.log(`  ${r.rel}  line(s) ${r.bareOnParse.join(',')}  buildsFrontmatter=${r.buildsFrontmatter}`)
}
console.log('\n--- files that build frontmatter AND have some bare .toThrow() (probe targets) ---')
for (const r of rows.filter((x) => x.buildsFrontmatter && x.bareAny > 0)) {
  console.log(`  ${r.rel}  bare=${r.bareAny}`)
}
