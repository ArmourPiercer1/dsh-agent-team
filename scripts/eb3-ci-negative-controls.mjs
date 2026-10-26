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
import { existsSync, readFileSync } from 'node:fs'
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
}
const CI_PR_GATE = await import(new URL('./ci-pr-gate.mjs', import.meta.url).href)
let moduleLoadError = null
for (const rel of Object.keys(MODULES)) {
  try {
    MODULES[rel] = await import(new URL(`../${rel}`, import.meta.url).href)
  } catch (e) {
    moduleLoadError = moduleLoadError ?? `${rel}: ${String(e && e.message ? e.message : e)}`
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
  const { checkRequiredJobs, REQUIRED_JOBS } = requireModule('scripts/eb3-ci-required.mjs')
  const wfPaths = gitLsFiles('.github/workflows')
  const honest = checkRequiredJobs({ files: readMap(ROOT, wfPaths) })
  if (honest.findings.length !== 0) {
    return { ok: false, detail: `the real tree already fails the required-job check (${honest.findings.length} finding(s)): ${honest.findings.slice(0, 3).map((f) => f.code).join(', ')}` }
  }
  const target = REQUIRED_JOBS[0]
  // MUTATION: delete the job from the workflow text that declares it.
  const mutated = new Map(readMap(ROOT, wfPaths))
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
  const PLANTED = 'mcp__injected_server__exfiltrate_everything'
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
  const paths = gitLsFiles('packages/tools', 'tests').filter((p) => /contribution[^/]*\.mjs$/.test(p) && !p.includes('/dist/'))
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

  // 3b: replace the row execute transport with a computed member.
  const b = new Map(base)
  b.set(seedPath, b.get(seedPath).replace(/execute: async \(/, 'execute: __injectedTransport ?? (async ('))
  const bFindings = checkFamilyDefinitions({ files: b }).findings
  const bHit = bFindings.find((f) => f.code === 'DEF_EXECUTION_REPLACED' && f.path === seedPath)

  // 3c: a nativeNames entry no review can read.
  const c = new Map(base)
  c.set(seedPath, c.get(seedPath).replace('nativeNames: [definition.name]', 'nativeNames: [computeNameAtRuntime()]'))
  const cFindings = checkFamilyDefinitions({ files: c }).findings
  const cHit = cFindings.find((f) => f.code === 'DEF_NAME_UNREADABLE' && f.path === seedPath)

  const parts = [`3a ${aHit !== undefined ? 'detected' : 'MISSED'}`, `3b ${bHit !== undefined ? 'detected' : 'MISSED'}`, `3c ${cHit !== undefined ? 'detected' : 'MISSED'}`]
  const all = aHit !== undefined && bHit !== undefined && cHit !== undefined
  return {
    ok: all,
    detail: `honest tree passes; ${parts.join(', ')}${all ? ` (mutations staged on ${seedPath})` : ''}`,
  }
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
  const seedPath = paths.find((p) => p.startsWith('packages/tools/search-family/src/') && (readMap(ROOT, [p]).get(p) ?? '').includes('fs-family'))
  if (seedPath === undefined) return { ok: false, detail: 'no search-family source imports fs-family — the control cannot stage its own mutation' }

  // 4a: reach into a sibling family's INTERNals instead of its public index.
  const a = new Map(readMap(ROOT, paths))
  a.set(seedPath, a.get(seedPath).replace("from '../../fs-family/src/index.mjs'", "from '../../fs-family/src/fs-mechanics.mjs'"))
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
  return { ok: all, detail: `honest tree passes (${Object.keys(LANE_EDGES).length} lanes declare edges); ${parts.join(', ')}` }
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
    throw new Error(`enforcement module absent or unloadable: ${rel}${moduleLoadError !== null ? ` (first load error: ${moduleLoadError})` : ''}`)
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
