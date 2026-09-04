/**
 * r125-template-audit.mjs — verifies that the docs/INSTALL.md §3 mount template
 * blueprintSource block passes the EXACT blueprint parser the host glue runs.
 *
 * Why this exists (R125 round-3, reviewer-9): the §3 template's blueprintSource
 * literal block originally lacked the `---` frontmatter delimiters; a machine
 * following the template verbatim would feed a frontmatter-less document to
 * parseBlueprint (agent-bindings.mjs L619, row registration) and fail with
 * MALFORMED_DTO (frontmatter-missing). The template now carries the delimiters;
 * this audit proves it — and a negative control proves the check has teeth.
 *
 * Method:
 *   1. extract the `blueprintSource: |` literal block from docs/INSTALL.md
 *      (indent-relative, per YAML literal-block semantics: strip the block
 *      indent, join with \n, single trailing \n — exactly the string value
 *      DSH's profile loader yields for that key);
 *   2. import parseBlueprint from the runtime dist's compiled domain copy
 *      (packages/runtime/dist/packages/domain/blueprint/src/index.js) — the
 *      same compiled artifact the host glue imports via relative specifier;
 *   3. POSITIVE: parseBlueprint(extracted) must succeed;
 *   4. NEGATIVE CONTROL: the same block with the two `---` delimiter lines
 *      removed must throw MALFORMED_DTO with reason `frontmatter-missing`
 *      (the pre-fix template failure mode).
 *
 * Usage:  node r125-template-audit.mjs [repoRoot]
 * Prereq: the runtime package has been built (pnpm build / per-package tsc).
 */
import { readFileSync } from 'node:fs'

const root = (process.argv[2] ?? 'D:/AgentDev/dsh-plugins/dsh-agent-team/.worktrees/P9-MC').replace(/\\/g, '/').replace(/\/$/, '')

// --- 1. extract the blueprintSource literal block ---------------------------
const md = readFileSync(root + '/docs/INSTALL.md', 'utf8')
const lines = md.split('\n')
const keyRe = /^(\s*)blueprintSource:\s*\|\s*$/
let keyLine = -1
let keyIndent = -1
for (let i = 0; i < lines.length; i++) {
  const m = (lines[i] ?? '').match(keyRe)
  if (m) {
    keyLine = i
    keyIndent = (m[1] ?? '').length
    break
  }
}
if (keyLine < 0) {
  console.log('AUDIT-FAIL: no `blueprintSource: |` literal block found in docs/INSTALL.md')
  process.exit(1)
}
const block = []
let blockIndent = -1
for (let i = keyLine + 1; i < lines.length; i++) {
  const l = lines[i] ?? ''
  const indent = (l.match(/^\s*/) ?? [''])[0].length
  if (l.trim() === '') {
    block.push('')
    continue
  }
  if (indent <= keyIndent) break
  if (blockIndent < 0) blockIndent = indent
  if (indent < blockIndent) break
  block.push(l.slice(blockIndent))
}
// YAML literal block (clip chomping): value = lines joined with \n + one trailing \n
const blueprintSource = block.join('\n') + '\n'
console.log('extracted blueprintSource: ' + blueprintSource.length + ' chars, ' + block.length + ' lines')
console.log('first line: ' + JSON.stringify((blueprintSource.split('\n')[0] ?? '')))
console.log('last non-empty line: ' + JSON.stringify((block.filter((x) => x !== '').slice(-1)[0] ?? '')))

// --- 2. the exact compiled parser the host glue runs ------------------------
const distDomain = root + '/packages/runtime/dist/packages/domain/blueprint/src/index.js'
const { parseBlueprint } = await import('file:///' + distDomain.replace(/\\/g, '/'))

// --- 3. POSITIVE: the committed template must parse -------------------------
let bp
try {
  bp = parseBlueprint(blueprintSource)
} catch (e) {
  console.log('AUDIT-FAIL: template blueprintSource REJECTED by parseBlueprint: ' + e.code + ' ' + JSON.stringify(e.details ?? {}))
  console.log('  message: ' + e.message)
  process.exit(1)
}
console.log('POSITIVE PASS: parseBlueprint accepted the template block')
console.log('  blueprintId=' + bp.blueprintId + ' revision=' + bp.revision + ' leader.templateId=' + bp.leader.templateId + ' members=' + bp.members.length + ' contentHash=' + String(bp.contentHash).slice(0, 24) + '...')

// --- 4. NEGATIVE CONTROL: delimiters stripped must fail --------------------
const stripped = block
  .filter((l) => l.trim() !== '---')
  .join('\n') + '\n'
let negativeOk = false
let negativeDetail = ''
try {
  parseBlueprint(stripped)
  negativeDetail = 'no throw (unexpected!)'
} catch (e) {
  negativeOk = e.code === 'MALFORMED_DTO' && e.details?.reason === 'frontmatter-missing'
  negativeDetail = e.code + ' reason=' + (e.details?.reason ?? '?')
}
console.log((negativeOk ? 'NEGATIVE CONTROL PASS' : 'NEGATIVE CONTROL FAIL') + ': delimiter-stripped block -> ' + negativeDetail + ' (expected MALFORMED_DTO frontmatter-missing)')

const ok = negativeOk
console.log(ok ? 'TEMPLATE-AUDIT PASS (positive + negative control)' : 'TEMPLATE-AUDIT FAIL')
process.exit(ok ? 0 : 1)
