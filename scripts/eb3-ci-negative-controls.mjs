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
  'scripts/eb3-evidence-guard.mjs': null,
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
  if (a.get(seedPath) === base.get(seedPath)) return { ok: false, detail: `mutation 3a did not change ${seedPath}` }
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
  // ANY spelling of the identifier list, not one file's: master's fs-family-contribution
  // writes `nativeNames: [readDefinition.name, writeDefinition.name, …]`, and a pin on
  // `[definition.name]` made this leg a silent no-op that reported MISSED (hosted run
  // 40352387786, after the rebase brought that file in ahead of the old seed).
  c.set(seedPath, c.get(seedPath).replace(/nativeNames: \[[^\]]*\]/, 'nativeNames: [computeNameAtRuntime()]'))
  if (c.get(seedPath) === base.get(seedPath)) return { ok: false, detail: `mutation 3c did not change ${seedPath}` }
  const cFindings = checkFamilyDefinitions({ files: c }).findings
  const cHit = cFindings.find((f) => f.code === 'DEF_NAME_UNREADABLE' && f.path === seedPath)

  // 3d: the contribution's source digest stops binding the execute transport — the
  // quiet replacement (a swapped body keeps the same digest). This leg exists because
  // the rule that catches it shipped once with BACKSPACE characters in its regex
  // (`/\x08sourceDocument\x08/`, a `\b` mangled in an edit): the rule could never
  // match, and the honest tree passed for the wrong reason. Only a mutation that
  // must trip it can tell a live rule from a dead one.
  const d = new Map(base)
  // Same generalisation: the binding is `<anyIdent>.execute?.toString?.() ?? null`
  // (search uses grepDefinition/globDefinition, fs-family readDefinition/…), which is
  // also how eb3-family-definitions reads it. The control now mutates what the rule reads.
  d.set(seedPath, d.get(seedPath).replace(/execute: [A-Za-z_$][\w$]*\.execute\?\.toString\?\.\(\) \?\? null,/, 'execute: null,'))
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
  // `synthesize` is a graded need too (C13): an all-green Required run includes it.
  const green = () => ({ synthesize: { result: 'success' }, ...Object.fromEntries(layers.map((id) => [id, { result: 'success', outputs: { verdict: 'PASS' } }])) })
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

// ─────────────────────────────── control 9: a mandatory leg must be INVOKED, not mentioned
/**
 * R1 review blocker (PR #395). The first mandatory-leg rule was
 * `stepsText(job).includes(leg)` — a substring search over step text — so a leg could
 * be satisfied by an `echo` of its name, a comment inside `run:`, or a weaker
 * invocation. The reviewer proved `echo docs:sync --check` passed. Each mutation here
 * is one quiet edit to the REAL workflow text; every one must produce a finding, and
 * the honest workflows must produce none.
 *
 * YAML FACT, measured not assumed: a `#` line between steps is a YAML comment and the
 * parser drops it entirely; a `#` line INSIDE a `run: |` block is part of the script
 * string the parser returns. So (d) is staged both ways: a commented-out YAML step
 * (must vanish — nothing invokes the leg) and a shell comment inside `run:` (survives
 * parsing — the checker itself must strip it). `name:` is never `run:`, so (b) moves
 * the invocation into the name.
 */
control('C9 mandatory-leg-invoked-not-mentioned', () => {
  const { checkRequiredJobs, workflowFiles } = requireModule('scripts/eb3-ci-required.mjs')
  const wf = workflowFiles(ROOT)
  const honest = checkRequiredJobs({ files: wf }).findings
  if (honest.length !== 0) return { ok: false, detail: `honest workflows already fail: ${honest.map((f) => f.code).join(',')}` }
  const FAST = '.github/workflows/ci-fast.yml'
  const FULL = '.github/workflows/ci-full.yml'
  const SYNC = 'node scripts/docs-sync.mjs --check'
  const stage = (name, path, edit, codes) => {
    const before = wf.get(path)
    if (before === undefined) return `${name}: ${path} absent`
    const after = edit(before)
    if (after === before) return `${name}: mutation did not apply`
    const m = new Map(wf)
    m.set(path, after)
    const f = checkRequiredJobs({ files: m }).findings
    return f.some((x) => codes.includes(x.code)) ? null : `${name}: not detected (${codes.join('|')}; got ${f.map((x) => x.code).join(',') || 'none'})`
  }
  // UNPROVEN is the allowlist's code for a leg-shaped command it cannot prove gates the
  // step (R2 F-2); every C9 evasion must produce one of the three, never nothing.
  const LEG = ['CI_LAYER_LEG_MISSING', 'CI_LAYER_LEG_WEAKENED', 'CI_LAYER_LEG_UNPROVEN']
  const misses = [
    // (a) the real invocation replaced by an echo of the same words
    stage('a-echo', FAST, (t) => t.replace(`          ${SYNC}\n`, `          echo ${SYNC}\n`), LEG),
    // (b) the invocation exists only in a step NAME (the real one removed)
    stage('b-name-only', FAST, (t) => t.replace(`          ${SYNC}\n`, '          true\n').replace('- name: docs:sync --check\n', `- name: ${SYNC}\n`), LEG),
    // (c1) the census flag-set weakened: --allow-refused census added
    stage('c1-allow-refused', FULL, (t) => t.replace('node scripts/ci-pr-gate.mjs --full \\\n', 'node scripts/ci-pr-gate.mjs --full --allow-refused census \\\n'), LEG),
    // (c2) the census flag removed: no --full, so the opt-in census is SKIPPED by default
    stage('c2-no-full', FULL, (t) => t.replace('node scripts/ci-pr-gate.mjs --full \\\n', 'node scripts/ci-pr-gate.mjs \\\n'), LEG),
    // (c3) the census itself skipped by name
    stage('c3-skip-census', FULL, (t) => t.replace('node scripts/ci-pr-gate.mjs --full \\\n', 'node scripts/ci-pr-gate.mjs --full --skip census \\\n'), LEG),
    // (d1) a shell COMMENT inside run: — survives YAML parsing, must not count
    stage('d1-shell-comment', FAST, (t) => t.replace(`          ${SYNC}\n`, `          # ${SYNC}\n          true\n`), LEG),
    // (d2) a commented-out YAML step — the parser drops it; nothing invokes the leg
    stage('d2-yaml-commented-step', FAST, (t) => t.replace(`          ${SYNC}\n`, '          true\n') + `      # - run: ${SYNC}\n`, LEG),
    // (e) the invocation inside a quoted string handed to echo/printf
    stage('e-quoted-string', FAST, (t) => t.replace(`          ${SYNC}\n`, `          printf '%s\\n' "${SYNC}"\n`), LEG),
    // (f) the invocation made unreachable: `|| true` would swallow its failure
    stage('f-or-true', FAST, (t) => t.replace(`          ${SYNC}\n`, `          ${SYNC} || true\n`), LEG),
  ].filter((x) => x !== null)
  return {
    ok: misses.length === 0,
    detail: misses.length === 0
      ? 'honest workflows pass; a-echo, b-name-only, c1-allow-refused, c2-no-full, c3-skip-census, d1-shell-comment, d2-yaml-commented-step, e-quoted-string, f-or-true each detected'
      : misses.join(' ;; '),
  }
})

// ─────────────────────── control 10: a host-free layer may not list a host-dependent suite
/**
 * PR #395 first hosted run: ci-security went RED (267/270) because one listed suite,
 * a5-pindir-reserved-native, harvests the PINNED HOST tree (findTestRepoRoot,
 * TEST_USE_REL, TEST_USE_BASELINE_SHA) and ci-security provisions no host. The local
 * 270/270 was host-assisted — this worktree resolves tests/deepseek-harness-test-use.
 * The layer did the right thing (red, not laundered); this control makes the
 * misplacement a STATIC refusal so it can never reach a hosted run again.
 */
control('C10 host-free-layer-refuses-host-dependent-suite', () => {
  const { checkSuiteLists } = requireModule('scripts/eb3-ci-required.mjs')
  if (typeof checkSuiteLists !== 'function') return { ok: false, detail: 'eb3-ci-required.mjs exports no checkSuiteLists — host-dependence is not graded at all' }
  const honest = checkSuiteLists({ root: ROOT })
  if (honest.findings.length !== 0) return { ok: false, detail: `honest suite lists already fail: ${honest.findings.map((f) => f.detail).join(' ;; ')}` }
  const PINDIR = 'packages/runtime/test/a5-pindir-reserved-native.test.ts'
  const list = readFileSync(join(ROOT, 'tests/checks/eb3-security-suites.txt'), 'utf8')
  if (list.split('\n').includes(PINDIR)) return { ok: false, detail: `${PINDIR} is still listed in the host-free ci-security list` }
  const planted = checkSuiteLists({ root: ROOT, override: { 'tests/checks/eb3-security-suites.txt': `${list}${PINDIR}\n` } })
  const hit = planted.findings.find((f) => f.code === 'CI_HOST_DEPENDENT_SUITE_IN_HOST_FREE_LAYER' && f.detail.includes(PINDIR))
  return {
    ok: hit !== undefined,
    detail: hit !== undefined
      ? `honest lists pass; re-listing ${PINDIR.split('/').pop()} in host-free ci-security => ${hit.code}`
      : `re-listing ${PINDIR} in host-free ci-security NOT detected: ${planted.findings.map((f) => f.code).join(',') || 'no findings'}`,
  }
})

// ──────────────────── control 11: the remaining text rules must not be satisfiable by text
/**
 * R1 review item 4: "re-check the rest of the manifest for the same pattern". The
 * leg rule was not the only one deciding by substring. Each mutation below satisfies
 * the OLD predicate textually while disabling what it guards:
 *
 *   a  summary `if: ${{ always() && false }}` — contains `always()`, never runs
 *   b  layer verdict step `if: ${{ always() && false }}` — same, on the token step
 *   c  verdict step reads job.status only in a SHELL COMMENT, writes a constant PASS
 *   d  synthesize job no longer EXECUTES `eb3-merge-tree.mjs --synthesize` (echo)
 *   e  grade step echoes the grader instead of executing it
 *   f  grade step executes the grader but its env no longer binds toJSON(needs)
 */
control('C11 remaining-text-rules-not-textually-satisfiable', () => {
  const { checkRequiredJobs, workflowFiles } = requireModule('scripts/eb3-ci-required.mjs')
  const wf = workflowFiles(ROOT)
  if (checkRequiredJobs({ files: wf }).findings.length !== 0) return { ok: false, detail: 'honest workflows already fail' }
  const REQ = '.github/workflows/ci-required.yml'
  const INT = '.github/workflows/ci-integration.yml'
  const stage = (name, path, edit, codes) => {
    const before = wf.get(path)
    const after = edit(before)
    if (after === before) return `${name}: mutation did not apply`
    const m = new Map(wf)
    m.set(path, after)
    const f = checkRequiredJobs({ files: m }).findings
    return f.some((x) => codes.includes(x.code)) ? null : `${name}: not detected (${codes.join('|')}; got ${f.map((x) => x.code).join(',') || 'none'})`
  }
  const misses = [
    stage('a-summary-always-and-false', REQ, (t) => t.replace(/(\n {4})if: always\(\)(\n {4}needs:)/, '$1if: ${{ always() && false }}$2'), ['CI_SUMMARY_NOT_ALWAYS']),
    stage('b-verdict-step-always-and-false', INT, (t) => t.replace(/(id: eb3_layer_verdict\n {8})if: always\(\)/, '$1if: ${{ always() && false }}'), ['CI_LAYER_VERDICT_OUTPUT_UNBOUND']),
    stage('c-verdict-job-status-in-comment', INT, (t) => t.replace(/case "\$\{\{ job\.status \}\}" in\n(?:.*\n)*? {10}esac\n/, '# ${{ job.status }}\n          V=PASS\n'), ['CI_LAYER_VERDICT_OUTPUT_UNBOUND']),
    stage('d-synthesize-echoed', REQ, (t) => t.replace('node scripts/eb3-merge-tree.mjs --synthesize', 'echo node scripts/eb3-merge-tree.mjs --synthesize'), ['CI_SUMMARY_NOT_SYNTHESIZING']),
    stage('e-grader-echoed', REQ, (t) => t.replace('node scripts/eb3-merge-tree.mjs --grade-needs', 'echo node scripts/eb3-merge-tree.mjs --grade-needs'), ['CI_SUMMARY_NOT_GRADING']),
    stage('f-needs-unbound', REQ, (t) => t.replace('EB3_NEEDS_JSON: ${{ toJSON(needs) }}', "EB3_NEEDS_JSON: '{}'"), ['CI_SUMMARY_NOT_GRADING']),
  ].filter((x) => x !== null)
  return { ok: misses.length === 0, detail: misses.length === 0 ? 'honest workflows pass; a-summary-always-and-false, b-verdict-step-always-and-false, c-verdict-job-status-in-comment, d-synthesize-echoed, e-grader-echoed, f-needs-unbound each detected' : misses.join(' ;; ') }
})

// ───────────── control 12: the reusable-workflow BOUNDARY must carry the verdict output
/**
 * R1 review, final item. The four layers each declared `jobs.<id>.outputs.verdict`, and
 * the local checker validated exactly that — but a reusable workflow exposes outputs to
 * its CALLER only through `on.workflow_call.outputs`, so the caller saw nothing and the
 * hosted aggregate reported `verdict-missing` for all four layers while every layer job
 * was green. Fourth instance in this PR of a check that could not see the thing it
 * claimed to guarantee. This control makes the boundary itself gradable.
 */
control('C12 reusable-workflow-output-boundary', () => {
  const { checkRequiredJobs, workflowFiles } = requireModule('scripts/eb3-ci-required.mjs')
  const wf = workflowFiles(ROOT)
  if (checkRequiredJobs({ files: wf }).findings.length !== 0) return { ok: false, detail: 'honest workflows already fail' }
  const misses = []
  for (const name of ['ci-fast', 'ci-integration', 'ci-security', 'ci-full']) {
    const path = `.github/workflows/${name}.yml`
    const before = wf.get(path)
    // Remove the on.workflow_call.outputs block from the honest file.
    // Indentation is 4/6/8 in the real files; the first draft guessed 6/8/10 and the
    // control reported "could not stage its mutation" instead of a verdict — which is
    // exactly the failure mode a mutation control must not have silently.
    const after = before.replace(/\n {4}outputs:\n {6}verdict:\n(?: {8}.*\n)+/, '\n')
    if (after === before) { misses.push(`${name}: could not remove the workflow_call.outputs block (control cannot stage its own mutation)`); continue }
    const m = new Map(wf)
    m.set(path, after)
    const f = checkRequiredJobs({ files: m }).findings
    if (!f.some((x) => x.code === 'CI_WORKFLOW_CALL_OUTPUT_MISSING' && x.detail.includes(name))) {
      misses.push(`${name}: removal not detected (${f.map((x) => x.code).join(',') || 'none'})`)
    }
  }
  return { ok: misses.length === 0, detail: misses.length === 0 ? 'honest workflows pass; removing on.workflow_call.outputs from each of the four layers => CI_WORKFLOW_CALL_OUTPUT_MISSING' : misses.join(' ;; ') }
})

// ─────────────────── control 13: the synthetic merge tree job is itself a graded need
/**
 * Found while READING the first fully green hosted run: the grader listed `synthesize`
 * as `info-undeclared-need (not graded)`. A failed or cancelled synthesize (a conflict,
 * a stale merge ref) was therefore invisible to the Required verdict. Today the layers
 * `needs: synthesize` and would be skipped — red — so the gate held by accident of
 * topology, not by rule. EB3-C says the merge tree is REQUIRED; this makes it so.
 */
control('C13 merge-tree-job-is-graded', () => {
  const { gradeNeeds } = requireModule('scripts/eb3-merge-tree.mjs')
  const { REQUIRED_JOBS } = requireModule('scripts/eb3-ci-required.mjs')
  const layers = REQUIRED_JOBS.filter((j) => j.id !== 'aggregate').map((j) => j.id)
  const green = () => ({ synthesize: { result: 'success' }, ...Object.fromEntries(layers.map((id) => [id, { result: 'success', outputs: { verdict: 'PASS' } }])) })
  if (gradeNeeds({ needs: green() }).verdict !== 'pass') return { ok: false, detail: 'all-green needs (with synthesize success) do not pass' }
  const missed = []
  for (const [name, v] of [['failure', { result: 'failure' }], ['cancelled', { result: 'cancelled' }], ['skipped', { result: 'skipped' }], ['absent', undefined]]) {
    const n = green()
    if (v === undefined) delete n.synthesize
    else n.synthesize = v
    if (gradeNeeds({ needs: n }).verdict !== 'fail') missed.push(name)
  }
  return { ok: missed.length === 0, detail: missed.length === 0 ? 'layers all green + synthesize failure/cancelled/skipped/absent => fail each' : `synthesize ${missed.join(', ')} graded GREEN` }
})

// ──────────────── control 14: a mandatory leg is satisfied ONLY by an allowlisted shape
/**
 * R2 review F-2 (PR #395, BLOCKED): the leg reader claimed "a construct it does not
 * understand never SATISFIES a leg" — and the reviewer falsified it with three invented
 * shapes (`if false; then node …; fi`, `node … &`, `node … || exit 0`). A denylist of
 * known evasions is what failed; the rule is now an ALLOWLIST. Each case here is graded
 * by calling gradeLeg directly on a synthetic step, so the control measures the reader
 * itself, independent of what any workflow happens to contain.
 *
 * Every NEGATIVE must leave the leg UNSATISFIED. The POSITIVES pin that the allowed
 * shapes still pass (a reader that rejects everything is not a reader).
 */
control('C14 leg-allowlist-not-denylist', () => {
  const { gradeLeg, checkRequiredJobs, workflowFiles, loadManifest } = requireModule('scripts/eb3-ci-required.mjs')
  const LEG = { id: 'docs:sync --check', cmd: ['node', 'scripts/docs-sync.mjs'], check: ['--check'] }
  const N = 'node scripts/docs-sync.mjs --check'
  const step = (run, extra = {}) => ({ steps: [{ name: 'x', run, ...extra }] })
  const negatives = [
    ['r2-1 if false; then …; fi', step(`if false; then ${N}; fi`)],
    ['r2-1 if false, leg on its own line', step(`if false; then\n  ${N}\nfi`)],
    ['false && leg (errexit ignores non-final && members)', step(`false && ${N}`)],
    ['leg && true (leg failure swallowed as non-final)', step(`${N} && true`)],
    ['trap EXIT after (overrides exit status)', step(`${N}\ntrap 'exit 0' EXIT`)],
    ['function shadowing node', step(`node() { true; }\n${N}`)],
    ['PATH redirected before', step(`PATH=/tmp/fake:$PATH\n${N}`)],
    ['cd before (relative script path moves)', step(`cd /tmp\n${N}`)],
    ['source before', step(`source ./x.sh\n${N}`)],
    ['step working-directory', step(N, { 'working-directory': '/tmp' })],
    ['step env PATH', step(N, { env: { PATH: '/tmp/fake' } })],
    ['r2-2 background &', step(`${N} &`)],
    ['r2-3 || exit 0', step(`${N} || exit 0`)],
    ['set +e before', step(`set +e\n${N}`)],
    ['set +o errexit before', step(`set +o errexit\n${N}`)],
    ['trap … ERR before', step(`trap 'true' ERR\n${N}`)],
    ["bash -c '…'", step(`bash -c '${N}'`)],
    ['sh -c "…"', step(`sh -c "${N}"`)],
    ['inside $( )', step(`OUT=$(${N})`)],
    ['inside backticks', step(`OUT=\`${N}\``)],
    ['case arm', step(`case x in\n  x) ${N} ;;\nesac`)],
    ['case arm, own line', step(`case x in\n  x)\n    ${N}\n    ;;\nesac`)],
    ['{ …; } || true', step(`{ ${N}; } || true`)],
    ['( … )', step(`( ${N} )`)],
    ['; true after', step(`${N}; true`)],
    ['| cat without pipefail', step(`${N} | cat`)],
    ['| cat WITH pipefail (only `| tee <file>` is allowed)', step(`set -o pipefail\n${N} | cat`)],
    // NARROWER THAN THE R2 BRIEF, on purpose: the brief permits the leg LAST in a pipe
    // under pipefail. No real workflow needs it, and an upstream command feeding the
    // leg's stdin is one more thing to prove — so it is refused (false red > false green).
    ['leg LAST in a pipe, even with pipefail (deliberately narrowed)', step(`set -o pipefail\necho hi | ${N}`)],
    ['| tee WITHOUT pipefail', step(`${N} 2>&1 | tee out.txt`)],
    ['| tee then || true', step(`set -o pipefail\n${N} | tee out.txt || true`)],
    ['for loop body', step(`for i in 1; do\n  ${N}\ndone`)],
    ['while loop body', step(`while true; do\n  ${N}\n  break\ndone`)],
    ['function body', step(`f() {\n  ${N}\n}\nf`)],
    ['eval', step(`eval "${N}"`)],
    ['xargs', step(`echo --check | xargs node scripts/docs-sync.mjs`)],
    ['heredoc fed to bash', step(`bash <<'EOF'\n${N}\nEOF`)],
    ['step if: false', step(N, { if: false })],
    ['step if: ${{ false }}', step(N, { if: '${{ false }}' })],
    ['step if: github.event_name == push', step(N, { if: "github.event_name == 'push'" })],
    ['shell: bash {0} || true', step(N, { shell: 'bash {0} || true' })],
    ['shell: python', step(N, { shell: 'python' })],
    ['step continue-on-error', step(N, { 'continue-on-error': true })],
    ['&& chain with a non-simple head', step(`false || true && ${N}`)],
    ['! negation', step(`! ${N}`)],
    // D12 (main-agent verification at 6c1aeda17): leading NAME=value on the LEG line was
    // skipped without any check. NODE_OPTIONS=--require=<preload> was demonstrated to turn
    // process.exit(3) into status 0. One allowlist now governs leg-line prefixes AND
    // prelude assignment lines.
    ['D12 NODE_OPTIONS prefix', step(`NODE_OPTIONS=--require=/x ${N}`)],
    ['D12 BASH_ENV prefix', step(`BASH_ENV=/tmp/x ${N}`)],
    ['D12 LD_PRELOAD prefix', step(`LD_PRELOAD=/tmp/x.so ${N}`)],
    ['D12 PATH prefix', step(`PATH=/tmp/fake:$PATH ${N}`)],
    ['D12 unknown FOO=1 prefix', step(`FOO=1 ${N}`)],
    ['D12 allowlisted then forbidden prefix', step(`NO_COLOR=1 NODE_OPTIONS=--require=/x ${N}`)],
    ['D12 NODE_OPTIONS prelude line', step(`NODE_OPTIONS=--require=/x\n${N}`)],
    ['D12 unknown FOO=1 prelude line', step(`FOO=1\n${N}`)],
  ]
  const positives = [
    ['plain line', step(N)],
    ['after set -euo pipefail', step(`set -euo pipefail\n${N}`)],
    // Allowlisted prefixes (no real leg line uses one today; pinned so the allowlist is a
    // real allowlist, not "refuse every assignment").
    ['allowlisted prefix NO_COLOR=1', step(`NO_COLOR=1 ${N}`)],
    ['allowlisted prefixes TZ + LC_ALL', step(`TZ=UTC LC_ALL=C ${N}`)],
    ['allowlisted prelude line CI=true', step(`CI=true\n${N}`)],
    ['line continuation', step(`node scripts/docs-sync.mjs \\\n  --check`)],
    ['pipefail + leg FIRST, into tee (the census shape)', step(`set -o pipefail\n${N} 2>&1 | tee out.txt`)],
    ['if: always()', step(N, { if: 'always()' })],
    ['shell: bash', step(N, { shell: 'bash' })],
  ]
  const leaked = negatives.filter(([, j]) => gradeLeg(j, LEG) === null).map(([n]) => n)
  const refused = positives.filter(([, j]) => gradeLeg(j, LEG) !== null).map(([n]) => n)
  // POSITIVE on the real tree: every layer satisfies every declared leg.
  const real = checkRequiredJobs({ files: workflowFiles(ROOT), manifest: loadManifest() }).findings
    .filter((f) => /LEG_/.test(f.code))
  const ok = leaked.length === 0 && refused.length === 0 && real.length === 0
  return {
    ok,
    detail: ok
      ? `${String(negatives.length)} negatives all UNSATISFIED; ${String(positives.length)} allowed shapes satisfied; every real layer satisfies every leg`
      : [
          leaked.length > 0 ? `SATISFIED by evasion: ${leaked.join(' | ')}` : '',
          refused.length > 0 ? `allowed shape REFUSED: ${refused.join(' | ')}` : '',
          real.length > 0 ? `real workflow leg findings: ${real.map((f) => f.detail).join(' ;; ')}` : '',
        ].filter(Boolean).join(' ;; '),
  }
})

// ──────────────────────────────── controls 15–19: evidence guard (raw captures, size)
/**
 * The recurring defect these close (PR #396, then three lanes again): the census leg
 * wrote ~3.8 MB raw vitest captures `census-<stamp>-<pid>-<n>.json` into the SAME tracked
 * directory as its ~2 KB comparison sidecars `census-comparison-<stamp>-<pid>.json`, and the
 * only thing keeping the captures out of git was prose. Two halves, both controlled here:
 *
 *   C15–C18  scripts/eb3-evidence-guard.mjs refuses what a PR ADDS under the evidence root:
 *            a raw-capture / resample name, or a file over the bound that no reviewed
 *            allowlist entry names. Each control plants the file in a THROWAWAY git repo
 *            (real commits, real `git diff --diff-filter=A`), never in this tree.
 *   C19      the census leg itself writes captures and resamples to a gitignored path
 *            and keeps only the sidecar in tracked scratch/ — separation at the source,
 *            so the guard is the backstop, not the mechanism.
 */
function plantedRepo(files, allowlist = null) {
  const dir = mkdtempSync(join(tmpdir(), 'eb3-evguard-'))
  const git = (...a) => execFileSync('git', ['-C', dir, ...a], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim()
  git('init', '-q', '-b', 'main')
  git('config', 'user.email', 'controls@example.invalid')
  git('config', 'user.name', 'eb3 controls')
  mkdirSync(join(dir, 'dev/agent-workflow/evidence'), { recursive: true })
  writeFileSync(join(dir, 'dev/agent-workflow/evidence/README.md'), 'base\n')
  git('add', '.')
  git('commit', '-q', '-m', 'base')
  const base = git('rev-parse', 'HEAD')
  for (const [rel, bytes] of Object.entries(files)) {
    mkdirSync(dirname(join(dir, rel)), { recursive: true })
    writeFileSync(join(dir, rel), bytes)
  }
  if (allowlist !== null) {
    mkdirSync(join(dir, 'dev/ci'), { recursive: true })
    writeFileSync(join(dir, 'dev/ci/evidence-large-allowlist.json'), JSON.stringify(allowlist, null, 2))
  }
  git('add', '.')
  git('commit', '-q', '-m', 'planted')
  return { dir, base, cleanup: () => rmSync(dir, { recursive: true, force: true }) }
}

/** Grade one planted repo through the guard's own entry point (git diff + allowlist load). */
function guardPlanted(files, allowlist = null) {
  const { guardAddedEvidence } = requireModule('scripts/eb3-evidence-guard.mjs')
  const r = plantedRepo(files, allowlist)
  try { return guardAddedEvidence({ root: r.dir, since: r.base }) } finally { r.cleanup() }
}

const SCRATCH = 'dev/agent-workflow/evidence/a4-pr7/ci-gate/scratch'
const TWO_MIB = Buffer.alloc(2 * 1024 * 1024, 0x61)

control('C15 evidence-guard-refuses-raw-capture', () => {
  const planted = {
    [`${SCRATCH}/census-20261027T003234Z-4-1.json`]: '{"testResults":[]}\n',
    'dev/agent-workflow/evidence/some-lane/census-20261027T052628Z-4417-2.json': '{}\n',
    [`${SCRATCH}/resample-4-packages_runtime_test_x_ts-1.json`]: '{}\n',
  }
  const out = guardPlanted(planted)
  const hit = new Set(out.findings.filter((f) => f.code === 'EVIDENCE_RAW_CAPTURE').map((f) => f.path))
  const missed = Object.keys(planted).filter((p) => !hit.has(p))
  // Small on purpose: the refusal must be by NAME, not by the size rule catching it.
  return { ok: missed.length === 0, detail: missed.length === 0 ? `${String(hit.size)} planted raw captures/resamples (tiny, so the NAME rule alone refuses them) => EVIDENCE_RAW_CAPTURE each` : `not refused: ${missed.join(', ')} (findings: ${out.findings.map((f) => f.code).join(',') || 'none'})` }
})

control('C16 evidence-guard-refuses-oversized', () => {
  const rel = 'dev/agent-workflow/evidence/some-lane/huge-log.txt'
  const out = guardPlanted({ [rel]: TWO_MIB })
  const ok = out.findings.some((f) => f.code === 'EVIDENCE_OVERSIZED' && f.path === rel)
  return { ok, detail: ok ? `a planted 2 MiB ${rel.split('/').pop()} => EVIDENCE_OVERSIZED (bound ${String(out.boundBytes)} B)` : `not refused: ${JSON.stringify(out.findings)}` }
})

control('C17 evidence-guard-allowlist-accepts-reviewed-large', () => {
  const rel = 'dev/agent-workflow/evidence/some-lane/huge-log.txt'
  const allow = { schema: 'evidence-large-allowlist/1', entries: [{ path: rel, reason: 'control: a reviewed large file' }] }
  const out = guardPlanted({ [rel]: TWO_MIB }, allow)
  // The allowlist must exempt SIZE only — never the raw-capture name, and never without a reason.
  const raw = `${SCRATCH}/census-20261027T003234Z-4-1.json`
  const rawOut = guardPlanted({ [raw]: TWO_MIB }, { schema: 'evidence-large-allowlist/1', entries: [{ path: raw, reason: 'trying to launder a capture' }] })
  const noReason = guardPlanted({ [rel]: TWO_MIB }, { schema: 'evidence-large-allowlist/1', entries: [{ path: rel }] })
  const misses = []
  if (out.findings.length !== 0) misses.push(`listed 2 MiB file still refused: ${out.findings.map((f) => f.code).join(',')}`)
  if (!rawOut.findings.some((f) => f.code === 'EVIDENCE_RAW_CAPTURE')) misses.push('an allowlist entry laundered a raw capture')
  if (!noReason.findings.some((f) => f.code === 'EVIDENCE_ALLOWLIST_INVALID')) misses.push('an entry with no reason was honoured')
  return { ok: misses.length === 0, detail: misses.length === 0 ? 'the same 2 MiB file listed WITH a reason => accepted; a listed raw capture => still EVIDENCE_RAW_CAPTURE; an entry with no reason => EVIDENCE_ALLOWLIST_INVALID' : misses.join(' ;; ') }
})

control('C18 evidence-guard-accepts-sidecar', () => {
  const planted = {
    [`${SCRATCH}/census-comparison-20261027T003234Z-4.json`]: '{"comparison":{}}\n',
    [`${SCRATCH}/census-comparison-62.json`]: '{}\n',
    'dev/agent-workflow/evidence/some-lane/census-newreds.json': '{}\n',
  }
  const out = guardPlanted(planted)
  const ok = out.findings.length === 0 && out.added.length === Object.keys(planted).length
  return { ok, detail: ok ? `${String(out.added.length)} sidecar-shaped additions (census-comparison-*, a named census note) => accepted, and all ${String(out.added.length)} were graded` : `sidecar refused or not graded: added=${String(out.added.length)} findings=${JSON.stringify(out.findings)}` }
})

control('C19 census-leg-writes-captures-outside-tracked-evidence', () => {
  const { censusCapturePath, censusResamplePath, CENSUS_SIDECAR_REL } = requireModule('scripts/ci-pr-gate.mjs')
  if (typeof censusCapturePath !== 'function' || typeof censusResamplePath !== 'function' || typeof CENSUS_SIDECAR_REL !== 'string') {
    return { ok: false, detail: 'scripts/ci-pr-gate.mjs exports no censusCapturePath/censusResamplePath/CENSUS_SIDECAR_REL — the capture location is not separated from the sidecar location' }
  }
  const { isRawCaptureName } = requireModule('scripts/eb3-evidence-guard.mjs')
  const cap = posix(censusCapturePath(ROOT, '20261027T003234Z', 4, 1)).slice(posix(ROOT).length + 1)
  const res = posix(censusResamplePath(ROOT, 4, 'packages/runtime/test/x.test.ts', 1)).slice(posix(ROOT).length + 1)
  const ignored = (rel) => { try { execFileSync('git', ['-C', ROOT, 'check-ignore', '-q', '--no-index', rel]); return true } catch { return false } }
  const misses = []
  for (const rel of [cap, res]) {
    if (rel.startsWith('dev/agent-workflow/evidence/')) misses.push(`${rel} is under the tracked evidence root`)
    if (!ignored(rel)) misses.push(`${rel} is not gitignored`)
    if (!isRawCaptureName(rel.split('/').pop())) misses.push(`${rel} no longer matches the raw-capture grammar the guard refuses — moving it back would not be caught`)
  }
  if (CENSUS_SIDECAR_REL !== SCRATCH) misses.push(`sidecar dir moved to ${CENSUS_SIDECAR_REL}`)
  if (isRawCaptureName('census-comparison-20261027T003234Z-4.json')) misses.push('the sidecar name matches the raw-capture grammar')
  return { ok: misses.length === 0, detail: misses.length === 0 ? `captures -> ${cap.split('/').slice(0, -1).join('/')}/ and resamples -> ${res.split('/').slice(0, -1).join('/')}/ (gitignored, outside the evidence root, still raw-capture-named); sidecar stays in ${CENSUS_SIDECAR_REL}/` : misses.join(' ;; ') }
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
 * PRESERVED POSITIVE B — "旧红完整身份集合" (the complete known-old-red identity set).
 * The nine-root census grades IDENTITY SETS against whatever `BASELINES.census` in
 * scripts/ci-pr-gate.mjs points at. The standing red set is disclosed debt: a PR may
 * not ADD to it, and it may not quietly SHRINK either (a red that vanishes into a
 * collection error is an ESCALATION — `compareCensus` owns that).
 *
 * TWO LEGITIMATE SHAPES, ONE ILLEGITIMATE ONE. While this branch was in flight,
 * U7-1/EB2-C (PR #393) repaired all nine tolerated reds and moved the pointer to
 * `nine-root-u7-1-old-reds.md`, which states its zero with a RETIRED-TO-EMPTY sentinel
 * whose retirement table the gate requires to EQUAL the predecessor's set. So:
 *
 *   - a non-empty tolerated set: the identical set must grade pass, +1 red must fail;
 *   - a zero BY NAMED RETIREMENT: the retirement must name exactly the predecessor's
 *     full identity set (the "complete" in 完整身份集合 — nothing dropped on the way
 *     to zero), an empty run must grade pass, and +1 red must fail;
 *   - a zero WITHOUT the sentinel: refused (the gate's own parser throws; this control
 *     reports it) — that is the "every run clean by construction" hole.
 *
 * The first draft of this control only knew the first shape and went red on the
 * rebase onto #393; it was wrong about the law, not the tree.
 */
control('P2 known-old-red-identity-set-complete', () => {
  const { parsePopulationBaseline, compareCensus, BASELINES } = requireModule('scripts/ci-pr-gate.mjs')
  const rel = BASELINES.census
  const abs = join(ROOT, rel)
  if (!existsSync(abs)) return { ok: false, detail: `the census baseline the gate reads is absent: ${rel}` }
  let baseline
  try {
    baseline = parsePopulationBaseline(readFileSync(abs, 'utf8'))
  } catch (e) {
    return { ok: false, detail: `the gate's own parser refuses ${rel}: ${String(e?.message ?? e).slice(0, 200)}` }
  }
  // The identity FORMAT is the gate's (`TEST <file>::<name>`), not the markdown display
  // form `file > name`: an earlier draft planted the display form and blamed the algebra.
  const PLANTED_RED = 'TEST packages/x/test/new-red.test.ts::a fresh failure'
  const withExtra = compareCensus(baseline.ids, [...baseline.ids, PLANTED_RED], {})
  const okExtraFails = withExtra.verdict === 'fail' && withExtra.newReds.length === 1

  if (baseline.ids.length === 0) {
    const r = baseline.retiredToEmpty
    if (r === undefined) {
      return { ok: false, detail: `${rel} parsed ZERO tolerated identities with NO RETIRED-TO-EMPTY sentinel — an empty baseline without a named retirement makes every run clean by construction` }
    }
    // COMPLETENESS: the retirement must name the predecessor's FULL identity set.
    let pred
    try {
      pred = parsePopulationBaseline(readFileSync(join(dirname(abs), `nine-root-${r.predecessor}.md`), 'utf8'))
    } catch (e) {
      return { ok: false, detail: `${rel} retires against predecessor ${r.predecessor}, which cannot be read: ${String(e?.message ?? e).slice(0, 160)}` }
    }
    const want = [...pred.ids].sort()
    const got = [...r.ids].sort()
    const complete = want.length > 0 && JSON.stringify(want) === JSON.stringify(got) && r.count === want.length
    const empty = compareCensus(baseline.ids, [], {})
    const okEmpty = empty.verdict === 'pass'
    return {
      ok: complete && okEmpty && okExtraFails,
      detail: `${rel} is zero BY NAMED RETIREMENT (sentinel: ${String(r.count)} retired against ${r.predecessor}); ` +
        `retirement names the predecessor's full set of ${String(want.length)} => ${complete ? 'complete' : 'INCOMPLETE'}; ` +
        `empty run => ${empty.verdict} (${okEmpty ? 'correct' : 'WRONG'}), one planted new red => ${withExtra.verdict} (${okExtraFails ? 'correct' : 'WRONG'})`,
    }
  }
  const identical = compareCensus(baseline.ids, [...baseline.ids], {})
  const okIdentical = identical.verdict === 'pass'
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
