#!/usr/bin/env node
/**
 * eb3-ci-negative-controls.mjs — the EB3-A/B/C/D RED-first controls.
 *
 * WHY THIS FILE EXISTS (plan U7-2, EB3-A/B/C/D). The execution plan names four
 * things that MUST be detected before a merge:
 *
 *   "故意移除必选 CI job、引入未知 MCP 工具、替换执行 Definition、让某 Family
 *    影响别的 Family 时必须被发现；保留非 Team Native 正控、旧红完整身份集合"
 *
 * (a required CI job removed; an unknown MCP tool introduced; an execution
 * Definition replaced; one Family influencing another — all must be DETECTED,
 * while the non-Team native positive control and the complete known-old-red
 * identity set are PRESERVED.)
 *
 * A check nobody can point at a lie is not a check. So each control does two
 * things in one run:
 *
 *   1. it asks the enforcement, on the REAL tree, for a verdict — which must be
 *      `pass` when the tree is honest (the positive half), and
 *   2. it MUTATES its own input map (never the disk) and asks again — which must
 *      be `fail`, for the named reason (the negative half).
 *
 * The two halves together are what distinguishes enforcement from decoration: a
 * scanner that reports `fail` on everything would pass half 2 and fail half 1,
 * and a scanner hardcoded to `pass` would do the reverse.
 *
 * SCANNER REUSE, NOT A SECOND OPINION. The family/name/closedness scanners are
 * `packages/testkit/test/arc-a-fitness/scan.mjs` (ARC-A L1–L4, already the
 * owner of "which contributions exist, what do they claim to be"); the census
 * identity algebra is `scripts/ci-pr-gate.mjs` (`parsePopulationBaseline` /
 * `compareCensus`). This file is the CI-side enforcement layer over both, and it
 * imports them rather than re-deriving them — a second implementation of the
 * same law is two laws.
 *
 *   node scripts/eb3-ci-negative-controls.mjs [--only <substring>] [--json]
 *
 * Exit codes: 0 every control behaved | 1 a control did not | 2 setup failure.
 * A crashing control is reported FAILED, never as a pass (the 2026-10-23
 * lesson: a ReferenceError exit 1 nearly got logged as a successful negative
 * control).
 */
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

// The four enforcement modules under test, imported as MODULES (not shelled out
// to): a control must exercise the same entry point the workflow runs, and an
// out-of-process call would grade whatever argv the control chose instead.
// `import()` is used so a MISSING enforcement module is a named setup failure
// rather than a module-resolution stack trace at parse time — the RED phase of
// this task is exactly the state where they do not exist yet.
const MODULES = {
  'scripts/eb3-ci-required.mjs': null,
  'scripts/eb3-trusted-sources.mjs': null,
  'scripts/eb3-family-definitions.mjs': null,
  'scripts/eb3-family-boundaries.mjs': null,
  'scripts/eb3-merge-tree.mjs': null,
  'scripts/eb3-run-manifest.mjs': null,
  'scripts/eb3-impact.mjs': null,
}
const CI_PR_GATE = await import(new URL('./ci-pr-gate.mjs', import.meta.url).href)
// Per-module load errors: the RED run of this file first recorded only the FIRST
// failure, so C2–C4 all reported eb3-ci-required.mjs's absence as their reason —
// true about the tree, wrong about the control. Each control now names its own.
const moduleLoadErrors = {}
for (const rel of Object.keys(MODULES)) {
  try {
    MODULES[rel] = await import(new URL(`../${rel}`, import.meta.url).href)
  } catch (e) {
    moduleLoadErrors[rel] = String(e && e.message ? e.message : e).split('\n')[0]
  }
}

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(HERE, '..')

const argv = process.argv.slice(2)
const ONLY = (() => { const i = argv.indexOf('--only'); return i > -1 ? String(argv[i + 1]).toLowerCase() : null })()
const JSON_OUT = argv.includes('--json')

const results = []
let setupFailed = null

function record(name, ok, detail) {
  results.push({ name, ok, detail })
  if (!JSON_OUT) console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${detail ? ` :: ${detail}` : ''}`)
}

/** Run one control; a throw is a FAILED control, never a silent skip. */
function control(name, fn) {
  if (ONLY !== null && !name.toLowerCase().includes(ONLY)) return
  try {
    const { ok, detail } = fn()
    record(name, ok, detail)
  } catch (e) {
    record(name, false, `control threw: ${String(e && e.message ? e.message : e)}`)
  }
}

const posix = (p) => p.split(sep).join('/')

function gitLsFiles(...args) {
  const out = execFileSync('git', ['-C', ROOT, 'ls-files', '-z', ...args], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
  return out.split('\0').filter((p) => p.length > 0).map(posix)
}

function readMap(root, paths) {
  const map = new Map()
  for (const p of paths) {
    const abs = join(root, p)
    if (!existsSync(abs)) continue
    map.set(p, readFileSync(abs, 'utf8'))
  }
  return map
}

// ───────────────────────────────────────────────────────────── control 1: CI jobs
/**
 * EB3-C "a required CI job removed must be detected". The checker under test is
 * `scripts/eb3-ci-required.mjs`, which reads the workflow files and answers
 * whether every job the EB3 manifest declares REQUIRED is actually present,
 * triggered, non-cancellable where it must be, and aggregated by a merge-tree
 * summary job.
 *
 * The mutation is applied to an in-memory copy of the workflow map, exactly the
 * shape `arc-a-fitness/scan.mjs` uses: the disk is never touched, so a control
 * can never be the thing that breaks the tree it is grading.
 */
control('C1 required-ci-job-removal', () => {
  const { checkRequiredJobs, REQUIRED_JOBS, workflowFiles } = requireModule('scripts/eb3-ci-required.mjs')
  // THE WORKING TREE, not the git index. The first draft read `git ls-files`, so the
  // very workflow files this task ADDS (untracked until the commit) were invisible and
  // the control reported the honest tree as failing — the check would have been green
  // only after committing, which is exactly when a control is no longer useful.
  const wf = workflowFiles(ROOT)
  if (wf.size === 0) return { ok: false, detail: 'no workflow files found in the working tree' }
  const honest = checkRequiredJobs({ files: wf })
  if (honest.findings.length !== 0) {
    return { ok: false, detail: `the real tree already fails the required-job check (${honest.findings.length} finding(s)): ${honest.findings.slice(0, 3).map((f) => f.code).join(', ')}` }
  }
  const target = REQUIRED_JOBS[0]
  // MUTATION: delete the job from the workflow text that declares it.
  const mutated = new Map(wf)
  let removed = false
  for (const [path, text] of mutated) {
    const rx = new RegExp(`^  ${target.job}:\\n`, 'm')
    if (!rx.test(text)) continue
    // Remove the whole job block: from its header to the next line at the same indent.
    const lines = text.split('\n')
    const start = lines.findIndex((l) => l === `  ${target.job}:`)
    let end = lines.length
    for (let i = start + 1; i < lines.length; i += 1) {
      if (/^ {2}[A-Za-z0-9_-]+:\s*$/.test(lines[i]) || /^[A-Za-z]/.test(lines[i])) { end = i; break }
    }
    lines.splice(start, end - start)
    mutated.set(path, lines.join('\n'))
    removed = true
    break
  }
  if (!removed) return { ok: false, detail: `could not find job "${target.job}" to remove — the control cannot stage its own mutation` }
  const detected = checkRequiredJobs({ files: mutated })
  const hit = detected.findings.find((f) => f.code === 'CI_REQUIRED_JOB_ABSENT' && f.detail.includes(target.job))
  return {
    ok: hit !== undefined,
    detail: hit !== undefined
      ? `honest tree passes; removing required job "${target.job}" produced ${hit.code} naming it`
      : `removing "${target.job}" was NOT detected — findings were: ${detected.findings.map((f) => f.code).join(', ') || 'none'}`,
  }
})

// ───────────────────────────────────────────── control 2: unknown MCP tool injected
/**
 * EB3-A/the plan's second negative: "引入未知 MCP 工具" — an unknown MCP tool
 * introduced must be caught. The enforcement is `scripts/eb3-trusted-sources.mjs`,
 * which walks every tracked source file and compares the `mcp__<server>__<tool>`
 * spellings it finds against the trusted-sources ledger. An MCP tool name is a
 * DYNAMIC source under the Alpha.5 dynamic-source law: an unbooked one is
 * UNKNOWN, and UNKNOWN is never an authorization.
 */
control('C2 unknown-mcp-tool-injection', () => {
  const { checkTrustedSources, SOURCE_ROOTS } = requireModule('scripts/eb3-trusted-sources.mjs')
  const srcPaths = gitLsFiles(...SOURCE_ROOTS).filter((p) => !p.includes('/dist/'))
  const honest = checkTrustedSources({ files: readMap(ROOT, srcPaths) })
  if (honest.findings.length !== 0) {
    return { ok: false, detail: `the real tree already carries ${honest.findings.length} unbooked MCP spelling(s): ${honest.findings.slice(0, 3).map((f) => f.detail).join(' ;; ')}` }
  }
  // MUTATION: inject a fresh mcp__ spelling into a source file that already has one.
  const seedPath = srcPaths.find((p) => (readMap(ROOT, [p]).get(p) ?? '').includes('mcp__'))
  if (seedPath === undefined) return { ok: false, detail: 'no source file carries an mcp__ spelling to mutate — the control cannot stage its own mutation' }
  const mutated = new Map(readMap(ROOT, srcPaths))
  // Assembled at runtime, never written as one literal: this file is itself a scanned
  // source, and a literal here would have to be BOOKED to keep the honest half green —
  // at which point the mutation half would inject a booked name and pass vacuously.
  const PLANTED = ['mcp', 'injected_server', 'exfiltrate_everything'].join('__')
  mutated.set(seedPath, `${mutated.get(seedPath)}\n// planted negative control: ${PLANTED}\n`)
  const detected = checkTrustedSources({ files: mutated })
  const hit = detected.findings.find((f) => f.code === 'MCP_TOOL_UNKNOWN' && f.detail.includes(PLANTED))
  return {
    ok: hit !== undefined,
    detail: hit !== undefined
      ? `honest tree has no unbooked MCP spelling; injecting ${PLANTED} produced ${hit.code} naming it`
      : `injecting ${PLANTED} was NOT detected — findings were: ${detected.findings.map((f) => f.code).join(', ') || 'none'}`,
  }
})

// ───────────────────────────────────── control 3: execution Definition replaced
/**
 * The plan's third negative: "替换执行 Definition". Three separate replacement
 * shapes are staged, because they fail differently and a check that catches only
 * the loud one is a check that catches the quiet ones never:
 *
 *   3a  execution.via flipped `family-body` -> `named-bridge` with no bridgeId
 *   3b  the row's execute transport replaced by a computed/dynamic property
 *   3c  visibility.nativeNames carrying a non-literal (the name a review cannot read)
 *
 * 3c is already `arc-a-fitness` L4's `not-verified`; this control asserts the CI
 * enforcement REACHES it (a law enforced only inside a suite the census may
 * refuse is a law enforced nowhere), and 3a/3b are additions that lane does not
 * make.
 */
control('C3 execution-definition-replaced', () => {
  const { checkFamilyDefinitions } = requireModule('scripts/eb3-family-definitions.mjs')
  // Contribution files AND row files: the execution ARM lives on the contribution
  // (`execution.via`), the execute TRANSPORT on the row (`*-row.mjs`). The first draft
  // staged 3b only on contributions, where no `execute: async (` exists, so the
  // substitution silently did nothing and the control blamed the enforcement — a
  // mutation that does not mutate is a green light wired to nothing.
  const paths = gitLsFiles('packages/tools', 'tests').filter((p) => (/contribution[^/]*\.mjs$/.test(p) || /-row\.mjs$/.test(p)) && !p.includes('/dist/'))
  const honest = checkFamilyDefinitions({ files: readMap(ROOT, paths) })
  if (honest.findings.length !== 0) {
    return { ok: false, detail: `the real tree already fails the definition check: ${honest.findings.slice(0, 3).map((f) => `${f.code} ${f.detail}`).join(' ;; ')}` }
  }
  const seedPath = paths.find((p) => (readMap(ROOT, [p]).get(p) ?? '').includes('via: \'family-body\''))
  if (seedPath === undefined) return { ok: false, detail: 'no contribution declares via family-body — the control cannot stage mutation 3a' }
  const base = readMap(ROOT, paths)

  // 3a: replace the execution arm with a named-bridge claim that names no bridge.
  const a = new Map(base)
  a.set(seedPath, a.get(seedPath).replace("via: 'family-body'", "via: 'named-bridge'"))
  const aFindings = checkFamilyDefinitions({ files: a }).findings
  const aHit = aFindings.find((f) => f.code === 'DEF_EXECUTION_REPLACED' && f.path === seedPath)

  // 3b: replace a row's execute transport with a computed member. The target is a
  // ROW file that actually declares `execute: async (`; failing to find one is a
  // control failure, never a silent no-op.
  const rowPath = paths.find((p) => /-row\.mjs$/.test(p) && /^\s*execute: async \(/m.test(readMap(ROOT, [p]).get(p) ?? ''))
  if (rowPath === undefined) return { ok: false, detail: 'no row file declares a plain `execute: async (` — the control cannot stage mutation 3b' }
  const b = new Map(base)
  b.set(rowPath, b.get(rowPath).replace(/^(\s*)execute: async \(/m, '$1execute: __injectedTransport ?? (async ('))
  if (b.get(rowPath) === base.get(rowPath)) return { ok: false, detail: `mutation 3b did not change ${rowPath} — the control would be grading an unmutated tree` }
  const bFindings = checkFamilyDefinitions({ files: b }).findings
  const bHit = bFindings.find((f) => f.code === 'DEF_EXECUTION_REPLACED' && f.path === rowPath)

  // 3c: a nativeNames entry no review can read.
  const c = new Map(base)
  c.set(seedPath, c.get(seedPath).replace('nativeNames: [definition.name]', 'nativeNames: [computeNameAtRuntime()]'))
  const cFindings = checkFamilyDefinitions({ files: c }).findings
  const cHit = cFindings.find((f) => f.code === 'DEF_NAME_UNREADABLE' && f.path === seedPath)

  // 3d: the contribution's source digest stops binding the execute transport — the
  // quiet replacement (a swapped body keeps the same digest). This leg exists because
  // the rule that catches it shipped once with BACKSPACE characters in its regex
  // (`/\x08sourceDocument\x08/`, a `\b` mangled in an edit): the rule could never
  // match, and the honest tree passed for the wrong reason. Only a mutation that
  // must trip it can tell a live rule from a dead one.
  const d = new Map(base)
  d.set(seedPath, d.get(seedPath).replace(/execute: definition\.execute\?\.toString\?\.\(\) \?\? null,/, 'execute: null,'))
  if (d.get(seedPath) === base.get(seedPath)) return { ok: false, detail: `mutation 3d did not change ${seedPath}` }
  const dHit = checkFamilyDefinitions({ files: d }).findings.find((f) => f.code === 'DEF_EXECUTION_REPLACED' && f.path === seedPath && f.detail.includes('same digest'))

  const parts = [`3a ${aHit !== undefined ? 'detected' : 'MISSED'} on ${seedPath}`, `3b ${bHit !== undefined ? 'detected' : 'MISSED'} on ${rowPath}`, `3c ${cHit !== undefined ? 'detected' : 'MISSED'} on ${seedPath}`, `3d ${dHit !== undefined ? 'detected' : 'MISSED'} on ${seedPath}`]
  const all = aHit !== undefined && bHit !== undefined && cHit !== undefined && dHit !== undefined
  return { ok: all, detail: `honest tree passes; ${parts.join(', ')}` }
})

// ─────────────────────────────────────────────── control 4: cross-family influence
/**
 * The plan's fourth negative: "让某 Family 影响别的 Family" — one Family
 * influencing another must be detected. The lane law is stated in the family
 * READMEs ("Allowed outward edges, and only these: ... the SIBLING FAMILY public
 * faces: ../../fs-family/src/index.mjs (resolveAnchored ...) and
 * ../../process-family/src/index.mjs (SYSTEM_RX ...)"). The enforcement is
 * `scripts/eb3-family-boundaries.mjs`, which walks the import edges of every
 * family lane and refuses anything not on that lane's declared edge list —
 * including an edge to a sibling family's INTERNALS (a relative path that does
 * not terminate at the sibling's `src/index.mjs`), which is the influence shape
 * that still compiles and still passes review.
 */
control('C4 cross-family-influence', () => {
  const { checkFamilyBoundaries, LANE_EDGES } = requireModule('scripts/eb3-family-boundaries.mjs')
  const paths = gitLsFiles('packages/tools').filter((p) => /^packages\/tools\/[a-z0-9-]+-family\/src\/.*\.(mjs|ts)$/.test(p) && !p.includes('/dist/'))
  const honest = checkFamilyBoundaries({ files: readMap(ROOT, paths) })
  if (honest.findings.length !== 0) {
    return { ok: false, detail: `the real tree already carries ${honest.findings.length} undeclared cross-lane edge(s): ${honest.findings.slice(0, 3).map((f) => f.detail).join(' ;; ')}` }
  }
  // The seed must hold the IMPORT, not merely mention the lane: the first draft took
  // the first file whose text contained "fs-family" (a comment in search-contribution),
  // so the 4a substitution matched nothing and the control blamed the enforcement.
  const IMPORT = "from '../../fs-family/src/index.mjs'"
  const seedPath = paths.find((p) => p.startsWith('packages/tools/search-family/src/') && (readMap(ROOT, [p]).get(p) ?? '').includes(IMPORT))
  if (seedPath === undefined) return { ok: false, detail: 'no search-family source imports the fs-family public face — the control cannot stage its own mutation' }

  // 4a: reach into a sibling family's INTERNals instead of its public index.
  const a = new Map(readMap(ROOT, paths))
  a.set(seedPath, a.get(seedPath).replace(IMPORT, "from '../../fs-family/src/fs-mechanics.mjs'"))
  if (a.get(seedPath) === readMap(ROOT, [seedPath]).get(seedPath)) return { ok: false, detail: `mutation 4a did not change ${seedPath}` }
  const aHit = checkFamilyBoundaries({ files: a }).findings.find((f) => f.code === 'FAMILY_CROSS_INFLUENCE' && f.path === seedPath)

  // 4b: a whole new edge into a family this lane declares no edge to.
  const b = new Map(readMap(ROOT, paths))
  b.set(seedPath, `import { buildReadRowDefinition } from '../../fs-family/src/read-row.mjs'\n${b.get(seedPath)}`)
  const bHit = checkFamilyBoundaries({ files: b }).findings.find((f) => f.code === 'FAMILY_CROSS_INFLUENCE' && f.path === seedPath && f.detail.includes('read-row'))

  // 4c: a lane importing the plane (the centre) is the influence direction the
  // READMEs forbid outright — influence must not flow centre-ward either.
  const c = new Map(readMap(ROOT, paths))
  c.set(seedPath, `import { x } from '../../../runtime/src/plugin/live/team-tool-plane.mjs'\n${c.get(seedPath)}`)
  const cHit = checkFamilyBoundaries({ files: c }).findings.find((f) => f.code === 'FAMILY_CROSS_INFLUENCE' && f.path === seedPath)

  const parts = [`4a ${aHit !== undefined ? 'detected' : 'MISSED'}`, `4b ${bHit !== undefined ? 'detected' : 'MISSED'}`, `4c ${cHit !== undefined ? 'detected' : 'MISSED'}`]
  const all = aHit !== undefined && bHit !== undefined && cHit !== undefined
  return { ok: all, detail: `honest tree passes (${Object.keys(LANE_EDGES).length} lanes declare edges); ${parts.join(', ')} (mutations staged on ${seedPath})` }
})

// ────────────────────────────── control 5: the Required context may not go green
/**
 * EB3-C, the plan's parenthesis verbatim: "缺席、skip、ENV_BLOCK、refused、cancel 不能绿"
 * — absence, skip, ENV_BLOCK, refused and cancel may not be green. The grader is
 * `scripts/eb3-merge-tree.mjs --grade-needs`, the step the ONE Required context runs.
 * Each of the five (plus failure and an unrecognised result) is staged on an
 * otherwise all-green `needs`, one at a time, so a single wrong row is the only
 * difference between a pass and the case under test.
 */
control('C5 required-context-nongreen-states', () => {
  const { gradeNeeds } = requireModule('scripts/eb3-merge-tree.mjs')
  const { REQUIRED_JOBS } = requireModule('scripts/eb3-ci-required.mjs')
  const layers = REQUIRED_JOBS.filter((j) => j.id !== 'aggregate').map((j) => j.id)
  const green = () => Object.fromEntries(layers.map((id) => [id, { result: 'success', outputs: { verdict: 'PASS' } }]))
  const honest = gradeNeeds({ needs: green() })
  if (honest.verdict !== 'pass') return { ok: false, detail: `all-green needs graded ${honest.verdict} — the grader cannot pass anything` }
  const victim = layers[1]
  const cases = [
    ['absent', (n) => { delete n[victim] }],
    ['skip', (n) => { n[victim] = { result: 'skipped' } }],
    ['cancel', (n) => { n[victim] = { result: 'cancelled' } }],
    ['failure', (n) => { n[victim] = { result: 'failure' } }],
    ['ENV_BLOCK', (n) => { n[victim] = { result: 'success', outputs: { verdict: 'ENV_BLOCK' } } }],
    ['refused', (n) => { n[victim] = { result: 'success', outputs: { verdict: 'REFUSED' } } }],
    ['SKIP-token', (n) => { n[victim] = { result: 'success', outputs: { verdict: 'SKIP' } } }],
    ['verdict-missing', (n) => { n[victim] = { result: 'success' } }],
    ['unrecognised-result', (n) => { n[victim] = { result: 'neutral' } }],
    ['empty-needs', (n) => { for (const k of Object.keys(n)) delete n[k] }],
  ]
  const missed = []
  for (const [name, mutate] of cases) {
    const n = green()
    mutate(n)
    if (gradeNeeds({ needs: n }).verdict !== 'fail') missed.push(name)
  }
  return {
    ok: missed.length === 0,
    detail: missed.length === 0
      ? `all-green => pass; each of ${cases.map((c) => c[0]).join(', ')} on layer ${victim} => fail`
      : `graded GREEN for: ${missed.join(', ')}`,
  }
})

// ───────────────────────────────────── control 6: summary job wiring cannot be loosened
/**
 * The grader is only as good as the job that calls it. Four quiet edits to the
 * summary workflow would make the Required context green with a layer red, and each
 * must be caught by eb3-ci-required: dropping `if: always()`, dropping a layer from
 * `needs`, a paths filter on the summary trigger, and a `continue-on-error` on a layer.
 */
control('C6 summary-wiring-loosened', () => {
  const { checkRequiredJobs, loadManifest, workflowFiles } = requireModule('scripts/eb3-ci-required.mjs')
  const m = loadManifest()
  const wf = workflowFiles(ROOT)
  if (checkRequiredJobs({ files: wf }).findings.length !== 0) return { ok: false, detail: 'honest workflows already fail eb3-ci-required' }
  const agg = m.aggregate.workflow
  const layer1 = m.layers[1]
  const stage = (name, path, from, to, code) => {
    const mm = new Map(wf)
    const before = mm.get(path)
    if (before === undefined) return `${name}: ${path} absent`
    const after = before.replace(from, to)
    if (after === before) return `${name}: mutation did not apply`
    mm.set(path, after)
    return checkRequiredJobs({ files: mm }).findings.some((f) => f.code === code) ? null : `${name}: not detected (${code})`
  }
  const misses = [
    // The summary's own always() is the row that matters: it is the one that decides
    // whether a failed layer reaches the verdict at all.
    stage('drop-always', agg, /(\n {4}if: always\(\)\n {4}needs:)/, '\n    if: success()\n    needs:', 'CI_SUMMARY_NOT_ALWAYS'),
    stage('drop-need', agg, new RegExp(`(needs: \\[[^\\]]*?)\\b${layer1.id}, `), '$1', 'CI_SUMMARY_NEEDS_INCOMPLETE'),
    stage('paths-filter', agg, /pull_request:\n(\s+)branches: \[master\]/, "pull_request:\n$1branches: [master]\n$1paths: ['packages/**']", 'CI_LAYER_PATH_FILTERED'),
    stage('continue-on-error', layer1.workflow, /(\n {4}runs-on: )/, '\n    continue-on-error: true$1', 'CI_LAYER_CONTINUE_ON_ERROR'),
    // A layer called by ci-required has no concurrency block of its own (one caller,
    // one run); the cancellable mutation therefore goes on the CALLER's concurrency.
    stage('cancel-in-progress', agg, /cancel-in-progress: false/, 'cancel-in-progress: true', 'CI_LAYER_CANCELLABLE'),
    stage('job-level-if', layer1.workflow, /(\n {4}runs-on: )/, "\n    if: github.event_name == 'push'$1", 'CI_LAYER_SKIPPABLE'),
  ].filter((x) => x !== null)
  return { ok: misses.length === 0, detail: misses.length === 0 ? 'honest workflows pass; drop-always, drop-need, paths-filter, continue-on-error, cancel-in-progress, job-level-if each detected' : misses.join(' ;; ') }
})

// ─────────────────────────────────────────────── control 7: unknown impact is non-zero
/**
 * EB3-A: "变更影响图对未知影响非零选择". A path no rule recognises must select the full
 * layered CI, never nothing; an empty change still runs ci-fast with docs:probe; a
 * doc hit selects docs:sync --check; and a Family-lane path keeps the family checks
 * even though a broader `packages/**` rule also matches (the union law).
 */
control('C7 impact-unknown-nonzero', () => {
  const { selectImpact, loadGraph } = requireModule('scripts/eb3-impact.mjs')
  // loadGraph(root) reads <root>/dev/ci/eb3-impact-graph.json; the refusal leg below
  // points it at a throwaway root so the tracked graph is never touched.
  const { REQUIRED_JOBS } = requireModule('scripts/eb3-ci-required.mjs')
  const all = REQUIRED_JOBS.filter((j) => j.id !== 'aggregate').map((j) => j.id).sort()
  const g = loadGraph()
  const misses = []
  const unk = selectImpact({ paths: ['totally/unmapped/new-thing.bin'] })
  if (unk.unknownPaths.length !== 1 || JSON.stringify(unk.layers) !== JSON.stringify(all)) misses.push(`unknown path selected ${unk.layers.join(',') || 'NOTHING'}`)
  const empty = selectImpact({ paths: [] })
  if (!empty.layers.includes('ci-fast') || !empty.checks.includes('docs:probe')) misses.push('empty change did not select ci-fast + docs:probe')
  const doc = selectImpact({ paths: ['docs/STATUS.md'] })
  if (!doc.checks.includes('docs:sync --check')) misses.push('doc hit did not select docs:sync --check')
  const fam = selectImpact({ paths: ['packages/tools/fs-family/src/read-row.mjs'] })
  if (!fam.checks.includes('eb3-family-boundaries') || !fam.checks.includes('eb3-family-definitions')) misses.push('family path lost the family checks')
  // A graph whose `unknown` set was emptied must be REFUSED at load, not obeyed:
  // stage it as a real file in a throwaway root and ask loadGraph about it.
  const scratch = mkdtempSync(join(tmpdir(), 'eb3-impact-'))
  try {
    mkdirSync(join(scratch, 'dev/ci'), { recursive: true })
    writeFileSync(join(scratch, 'dev/ci/eb3-impact-graph.json'), JSON.stringify({ ...g, unknown: { layers: [], checks: [] } }))
    let refused = false
    try { loadGraph(scratch) } catch (e) { refused = /unknown/.test(String(e?.message)) }
    if (!refused) misses.push('a graph with an EMPTY unknown set loaded without refusal')
  } finally {
    rmSync(scratch, { recursive: true, force: true })
  }
  return { ok: misses.length === 0, detail: misses.length === 0 ? `unknown path => all ${all.length} layers; empty change => ci-fast+docs:probe; doc hit => docs:sync --check; family path keeps family checks under the union law` : misses.join(' ;; ') }
})

// ──────────────────────────────────────────── control 8: RUN Manifest refuses lies
/**
 * EB3-D: "改写 RUN、错 digest、混入不同来源代际必须拒绝". The honest record is a real
 * finalised RUN already on the tree; each mutation is one field.
 */
control('C8 run-manifest-refuses-rewrites', () => {
  const { validateRunRecord, context, findRunRecords } = requireModule('scripts/eb3-run-manifest.mjs')
  const ctx = context(ROOT)
  const complete = findRunRecords(ROOT).filter((r) => typeof r.record.finishedAt === 'string' && r.record.overall !== undefined && r.record.bindings?.mode !== 'reconstruct' && typeof r.record.bindings?.teamSha === 'string')
  if (complete.length === 0) return { ok: false, detail: 'no finalised, non-reconstruct RUN record on the tree to mutate' }
  const seed = complete.find((r) => r.record.cases.some((c) => c.verdict === 'PASS')) ?? complete[0]
  const honest = validateRunRecord({ record: seed.record, rel: seed.rel, ctx })
  if (honest.findings.length !== 0) return { ok: false, detail: `honest seed ${seed.rel} already fails: ${honest.findings.map((f) => f.code).join(',')}` }
  const clone = () => JSON.parse(JSON.stringify(seed.record))
  const tries = [
    ['rewritten-overall', 'RUN_OVERALL_DISHONEST', (r) => { r.cases[0].verdict = 'FAIL'; r.overall = 'PASS' }, false],
    ['env-block-case-graded-pass', 'RUN_OVERALL_DISHONEST', (r) => { r.cases[0].verdict = 'ENV_BLOCK'; r.overall = 'PASS' }, false],
    ['unknown-verdict-token', 'RUN_CASE_VERDICT', (r) => { r.cases[0].verdict = 'GREENISH' }, false],
    ['dropped-selected-case', 'RUN_CASE_VERDICT', (r) => { r.cases.shift() }, false],
    ['host-generation-mixed', 'RUN_HOST_PIN_DRIFT', (r) => { r.bindings.hostSha = '46a7f68b0922371ce7144b668b90e377d8e799f4' }, false],
    ['team-sha-unresolvable', 'RUN_SOURCE_UNRESOLVED', (r) => { r.bindings.teamSha = 'deadbeef'.repeat(5) }, false],
    ['invented-authority-generation', 'RUN_AUTHORITY_BINDING_MISMATCH', (r) => { r.bindings.authority = { pointer: { snapshot_version: 'as20991231r9', content_digest: 'sha256:' + '0'.repeat(64) }, pointerSha256: '0'.repeat(64) } }, false],
    ['superseded-generation-on-new-record', 'RUN_AUTHORITY_BINDING_MISMATCH', (r) => { r.bindings.authority = { pointer: { snapshot_version: 'as20261025r1', content_digest: 'sha256:220427218281602d572e8749858d08e17c388b9cbb437d68e3f3987869195062' }, pointerSha256: '5356e8deabdcad5e6686208a8f3debe1113b56393d4a5c1c787e575c897725ee' } }, true],
    ['wrong-evidence-digest', 'RUN_EVIDENCE_DIGEST_MISMATCH', (r) => { r.evidence = [{ path: 'tests/paths.mjs', sha256: '0'.repeat(64) }] }, false],
    ['missing-evidence', 'RUN_EVIDENCE_MISSING', (r) => { r.evidence = ['dev/agent-workflow/evidence/does-not-exist.json'] }, false],
  ]
  const misses = []
  for (const [name, code, mutate, strict] of tries) {
    const r = clone()
    mutate(r)
    const f = validateRunRecord({ record: r, rel: seed.rel, ctx, strictGeneration: strict }).findings
    if (!f.some((x) => x.code === code)) misses.push(`${name} (${code}) not detected: ${f.map((x) => x.code).join(',') || 'no findings'}`)
  }
  return { ok: misses.length === 0, detail: misses.length === 0 ? `honest ${seed.rel.split('/').slice(-3).join('/')} passes; ${tries.map((t) => t[0]).join(', ')} each refused` : misses.join(' ;; ') }
})

// ─────────────────────────────────────── preserved positive 1: non-Team native control
/**
 * PRESERVED POSITIVE A — "保留非 Team Native 正控". The two controls that prove a
 * non-Team install is never widened live in the census population:
 *
 *   packages/runtime/test/u6-pr3-bl01-ask-door.test.ts
 *     "CI03-b control: WITHOUT a plane the native bash rides on, unchanged"
 *   packages/runtime/test/u6-pr2-review-r1.test.ts
 *     "non-Team native read rides on, unchanged"
 *
 * ENFORCEMENT IS "ON THE TREE, NOT ON THE NAME". The check asserts the control
 * still EXISTS and is still a positive (the body count assertion), because the
 * cheapest way to make a red set green is to delete the positive control that
 * disagrees with you. It deliberately does NOT pin the literal test title: a
 * retitled test that still asserts the law is a live control, and a check that
 * fails on a retitle would train people to stop editing the file.
 */
control('P1 non-Team-native-positive-preserved', () => {
  const need = [
    {
      path: 'packages/runtime/test/u6-pr3-bl01-ask-door.test.ts',
      marker: "expect(run.bodies.length, 'non-Team native bash rides on, unchanged').toBe(1)",
      what: 'non-Team native bash rides on',
    },
    {
      path: 'packages/runtime/test/u6-pr2-review-r1.test.ts',
      marker: "expect(run.bodies.length, 'non-Team native read rides on, unchanged').toBe(1)",
      what: 'non-Team native read rides on',
    },
  ]
  const missing = []
  for (const n of need) {
    const abs = join(ROOT, n.path)
    if (!existsSync(abs)) { missing.push(`${n.path} is absent`); continue }
    if (!readFileSync(abs, 'utf8').includes(n.marker)) missing.push(`${n.path} no longer carries the "${n.what}" positive assertion`)
  }
  return {
    ok: missing.length === 0,
    detail: missing.length === 0
      ? `both non-Team native positive controls present and still asserting the native ride (${need.map((n) => n.path.split('/').pop()).join(', ')}); pinned BY ASSERTION, not by title`
      : missing.join(' ;; '),
  }
})

// ───────────────────────────────────── preserved positive 2: known-old-red identity set
/**
 * PRESERVED POSITIVE B — "旧红完整身份集合". The nine-root census grades IDENTITY
 * SETS against `dev/agent-workflow/evidence/a4-pr7/population-baseline/nine-root-2b1099d7.md`.
 * The standing red set is disclosed debt: a PR may not ADD to it, and the gate's
 * honest-instrument rule is that it may not quietly SHRINK it either (a red that
 * vanishes into a collection error is an ESCALATION — `compareCensus` owns that).
 *
 * This control asserts the baseline the gate actually reads still carries the
 * full set, and that the set is non-empty: an empty baseline would make every
 * future run "clean" by construction, which is the failure mode where the
 * enforcement itself becomes the hole.
 */
control('P2 known-old-red-identity-set-complete', () => {
  const { parsePopulationBaseline, compareCensus, BASELINES } = requireModule('scripts/ci-pr-gate.mjs')
  const rel = BASELINES.census
  const abs = join(ROOT, rel)
  if (!existsSync(abs)) return { ok: false, detail: `the census baseline the gate reads is absent: ${rel}` }
  const baseline = parsePopulationBaseline(readFileSync(abs, 'utf8'))
  if (baseline.ids.length === 0) return { ok: false, detail: `${rel} parsed ZERO tolerated identities — an empty baseline makes every run clean by construction` }
  // A run that reproduces the baseline exactly must be graded `pass`; a run that
  // drops an identity must be graded as the gate documents (allowed: debt may be
  // removed, never added). Both halves prove the algebra still reads this file.
  const identical = compareCensus(baseline.ids, [...baseline.ids], {})
  // The identity FORMAT is the gate's (`TEST <file>::<name>`, from fail-set.mjs capture),
  // not the markdown display form `file > name`. The first draft of this control planted the
  // display form; compareCensus then filed it under `added` but not `newReds` (which keys on
  // the `TEST ` prefix), and the control reported the algebra WRONG when the control was.
  const PLANTED_RED = 'TEST packages/x/test/new-red.test.ts::a fresh failure'
  const withExtra = compareCensus(baseline.ids, [...baseline.ids, PLANTED_RED], {})
  const okIdentical = identical.verdict === 'pass'
  const okExtraFails = withExtra.verdict === 'fail' && withExtra.newReds.length === 1
  return {
    ok: okIdentical && okExtraFails,
    detail: `${rel} carries ${String(baseline.ids.length)} tolerated identities and ${String(baseline.loadFamilies.length)} disclosed load family/ies; ` +
      `identical set => ${identical.verdict} (${okIdentical ? 'correct' : 'WRONG'}), one planted new red => ${withExtra.verdict} (${okExtraFails ? 'correct' : 'WRONG'})`,
  }
})

// ───────────────────────────────────────────────────────────────────── module loader
/** Resolve a pre-imported module; an absent enforcement module FAILS the control. */
function requireModule(rel) {
  if (rel === 'scripts/ci-pr-gate.mjs') return { ...CI_PR_GATE, BASELINES: { census: censusBaselinePath() } }
  const m = MODULES[rel]
  if (m === null || m === undefined) {
    throw new Error(`enforcement module absent or unloadable: ${rel}${moduleLoadErrors[rel] !== undefined ? ` (${moduleLoadErrors[rel]})` : ''}`)
  }
  return m
}

/** The census baseline path the gate ACTUALLY reads, taken from its own source
 *  (BASELINES is module-private there; reading the literal keeps this control
 *  pointed at whatever the gate points at, instead of a copy that can drift). */
function censusBaselinePath() {
  const src = readFileSync(join(ROOT, 'scripts/ci-pr-gate.mjs'), 'utf8')
  const m = /const BASELINES = \{[\s\S]*?census:\s*'([^']+)'/.exec(src)
  if (m === null) throw new Error('could not read BASELINES.census out of scripts/ci-pr-gate.mjs')
  return m[1]
}

// ──────────────────────────────────────────────────────────────────────── reporting
const failures = results.filter((r) => !r.ok)
if (JSON_OUT) {
  console.log(JSON.stringify({ controls: results, failures: failures.length }, null, 2))
} else {
  console.log(`\n${results.length - failures.length}/${results.length} control(s) behaved as required`)
}
if (setupFailed !== null) {
  console.error(`SETUP FAILED: ${setupFailed}`)
  process.exit(2)
}
// ZERO SELECTED IS RED. A first draft exited 0 on `--only <typo>` with "0/0 control(s)
// behaved" — the exact absence-reads-as-green shape EB3-C forbids, inside the tool that
// is supposed to prove it is forbidden. A run that graded nothing has proved nothing.
if (results.length === 0) {
  console.error(`NO CONTROL SELECTED${ONLY !== null ? ` by --only ${ONLY}` : ''} — a run that graded nothing is a failure, never a pass`)
  process.exit(1)
}
process.exit(failures.length === 0 ? 0 : 1)
