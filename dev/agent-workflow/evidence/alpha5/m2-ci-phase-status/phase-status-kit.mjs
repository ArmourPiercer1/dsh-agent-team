#!/usr/bin/env node
/**
 * phase-status-kit.mjs — evidence kit for p-phase-status-check.md (card M2-CI-PHASE-STATUS-01).
 *
 * WHY IT READS THE PROPOSAL INSTEAD OF CARRYING A COPY: the patch proposal is the artifact
 * CENTER lands; a second hand-maintained copy here could drift and would prove nothing about
 * the document. So this kit (1) extracts the ```js fence of p-phase-status-check.md §2 and
 * executes it against scopes identical to checkCurrentContract's, (2) checks the test-file
 * mirror is line-for-line equal to that fence (modulo TS annotations, brace wrapper and the
 * header comment), (3) grades the REAL graph block against the REAL active plan (must be
 * green — the rule may not break the tree it lands onto), (4) grades four bad shapes and
 * prints one DSH-CI-LEG-shaped line each with verdict=fail and the joined Q9 detail, and
 * (5) imports the SHIPPED checkCurrentContract and prints its findings on the same
 * contradicting graph — the pinned pre-landing gap, verbatim.
 *
 * Fixture level only. Until CENTER lands §2 the production state-freshness leg does not
 * grade phase_status; nothing here changes any verdict of any real gate run.
 *
 * Run: node dev/agent-workflow/evidence/alpha5/m2-ci-phase-status/phase-status-kit.mjs
 * Exit: 0 = every expectation matched; 1 = a mismatch (the kit itself is a test).
 */
import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO = resolve(HERE, '..', '..', '..', '..', '..')
const DOC = resolve(HERE, 'p-phase-status-check.md')
const TEST = resolve(REPO, 'packages/testkit/test/a5-current-contract.test.ts')
const PLAN_REL = 'docs/plans/active/alpha5-tool-io-governance/current-execution-plan.md'

let fails = 0
const expect = (ok, what) => {
  console.log(`${ok ? 'OK  ' : 'FAIL'} ${what}`)
  if (!ok) fails += 1
}

// ── (1) extract the proposed patch body from the proposal itself ──
const doc = readFileSync(DOC, 'utf8')
const fence = doc.match(/```js\n([\s\S]*?)```/)
if (!fence) { console.log('FAIL cannot find the js fence in p-phase-status-check.md'); process.exit(1) }
const body = fence[1]

// ── (2) parity: test mirror == patch body (modulo TS annotations / wrapper / header) ──
const testText = readFileSync(TEST, 'utf8')
const mm = testText.match(/\/\/ ── BEGIN verbatim mirror of the patch body ──\n([\s\S]*?)\n      \/\/ ── END verbatim mirror ──/)
const norm = (lines) => lines
  .map((l) => l.trim().replace(/: Record<string, RegExp>/g, '').replace(/new Map<string, string>\(\)/g, 'new Map()'))
  .filter((l) => l.length > 0)
const testLines = norm(mm ? mm[1].split('\n') : [])
const bodyLinesRaw = body.split('\n')
const open = bodyLinesRaw.findIndex((l) => l.trim() === '{')
const close = bodyLinesRaw.length - 1 - [...bodyLinesRaw].reverse().findIndex((l) => l.trim() === '}')
const bodyLines = norm(bodyLinesRaw.slice(open + 1, close))
expect(mm !== null && bodyLines.length > 0 && testLines.length === bodyLines.length && testLines.every((l, i) => l === bodyLines[i]),
  'parity: test mirror body == patch §2 fence body (line-for-line, modulo TS annotations)')

// ── scopes identical to checkCurrentContract's (helpers verbatim from scripts/ci-pr-gate.mjs :301-306/:317) ──
const mkScope = (ccBlock) => {
  const findings = []
  const field = (name) => {
    const m = new RegExp('^ {2}' + name + ':\\s*(.+?)\\s*$', 'm').exec(ccBlock)
    if (!m) return null
    const v = m[1].trim()
    return v.startsWith('"') ? v.replace(/^"(.*)"$/, '$1') : v.replace(/\s+#.*$/, '').trim()
  }
  const count = (re, text) => (String(text).match(re) ?? []).length
  return { findings, field, count }
}
const gradeProposed = (ccBlock, activePlan, readFile) => {
  const { findings, field, count } = mkScope(ccBlock)
  new Function('ccBlock', 'activePlan', 'readFile', 'findings', 'field', 'count', body)(ccBlock, activePlan, readFile, findings, field, count)
  return findings
}

// ── block extraction identical to checkCurrentContract :297-300 ──
const ccBlockOf = (g) => {
  const s = g.search(/^current_contract:[ \t]*$/m)
  const tail = g.slice(g.indexOf('\n', s) + 1)
  const next = tail.match(/^(?!\s*#)[^\s#]/m)
  return next ? tail.slice(0, next.index) : tail
}

const legLine = (verdict, detail) =>
  `DSH-CI-LEG leg=phase-status-proposed verdict=${verdict} detail=${String(detail).replace(/\s+/g, ' ').trim().slice(0, 400)}`

// ── (3) the real production pair must grade clean ──
const realGraph = readFileSync(resolve(REPO, 'dev/agent-workflow/graph.yaml'), 'utf8')
const realPlan = readFileSync(resolve(REPO, PLAN_REL), 'utf8')
const realFindings = gradeProposed(ccBlockOf(realGraph), PLAN_REL, () => realPlan)
console.log(legLine(realFindings.length === 0 ? 'pass' : 'fail', realFindings.length === 0 ? 'real graph block vs real plan 当期三态指针 agree' : realFindings.join(' ; ')))
expect(realFindings.length === 0, 'real tree: proposed rule grades the production graph+plan GREEN (the patch will not mis-red the real leg)')

// ── (4) four bad shapes must grade RED, naming the item ──
const POINTER = '- **当期三态指针（2026-10-23 更新）**：**M0 已冻结**（历史基线原样保留）／**M1 已准入并合入 master** `929fc4a…`／**M2 进行中**。'
const PS_OK = '  phase_status: "M0-FROZEN (historical baseline preserved as-is) / M1-MERGED (master merge ' + '9'.repeat(40) + '; audited tree ' + '7'.repeat(40) + ') / M2-IN-PROGRESS"'
const PSC_OK = '  phase_status_collected: "2026-10-23T06:55:36Z"'
const blockOf = (psLine, pscLine) => [
  '  phase_id: alpha5-tool-io-governance',
  `  active_plan: ${PLAN_REL}`,
  '  baseline: ' + '9'.repeat(40),
  '  baseline_collected: "2026-10-22T07:20:56Z"',
  ...(psLine === null ? [] : [psLine]),
  ...(pscLine === null ? [] : [pscLine]),
].join('\n')

const cases = [
  { name: 'disagree (M2-FROZEN vs plan M2 进行中)', block: blockOf('  phase_status: "M0-FROZEN / M1-MERGED / M2-FROZEN"', PSC_OK), must: ['Q9:', 'M2-FROZEN', 'M2 进行中'] },
  { name: 'phase_status missing', block: blockOf(null, PSC_OK), must: ['Q9:', 'phase_status is missing'] },
  { name: 'non-scalar (flow value)', block: blockOf('  phase_status: [M0-FROZEN, M1-MERGED, M2-IN-PROGRESS]', PSC_OK), must: ['Q9:', 'single-line string scalar'] },
  { name: 'phase_status_collected missing', block: blockOf(PS_OK, null), must: ['Q9:', 'phase_status_collected is missing'] },
]
for (const c of cases) {
  const f = gradeProposed(c.block, PLAN_REL, () => POINTER)
  console.log(legLine(f.length > 0 ? 'fail' : 'pass', f.length > 0 ? f.join(' ; ') : 'NOT FLAGGED'))
  expect(c.must.every((s) => f.some((x) => x.includes(s))), `negative red: ${c.name}`)
}

// ── (5) the pinned gap: the SHIPPED six-field reader on the same contradicting pair ──
const shipped = await import(pathToFileURL(resolve(REPO, 'scripts/ci-pr-gate.mjs')).href)
const contraGraph = ['current_phase: "ALPHA.5 TOOL-IO-GOVERNANCE PHASE — EXECUTION (authority = current_contract)"', 'current_contract:', blockOf('  phase_status: "M0-FROZEN / M1-MERGED / M2-FROZEN"', PSC_OK), 'blocked: []'].join('\n')
const gap = shipped.checkCurrentContract({
  graphText: contraGraph,
  readFile: (p) => (p === PLAN_REL ? POINTER + '\n<!-- phase-baseline-ref: dev/agent-workflow/graph.yaml#current_contract -->\n<!-- phase-identity: alpha5-tool-io-governance -->\n# doc' : null),
  fileExists: (p) => p === PLAN_REL,
  revExists: () => true,
  baselineCurrent: () => true,
  driftProvider: () => [],
})
console.log('gap (pre-landing, shipped checkCurrentContract on the contradicting graph):', JSON.stringify(gap.findings))
expect(gap.findings.filter((x) => x.startsWith('Q9:')).length === 0, 'gap pinned: the shipped reader does NOT yet grade phase_status (this card exists to close it)')

console.log(fails === 0 ? 'KIT VERDICT pass' : `KIT VERDICT fail (${String(fails)})`)
process.exit(fails === 0 ? 0 : 1)
