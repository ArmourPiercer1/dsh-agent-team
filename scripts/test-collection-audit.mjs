#!/usr/bin/env node
/**
 * test-collection-audit — which tracked node:test suites does CI actually run?
 *
 * WHY THIS EXISTS (TINF-01, `docs/plans/memo/agent-testing-infrastructure-20261114/`).
 * Every node:test leg in this repo names its files explicitly, in two places that
 * must agree: a `run:` line in `.github/workflows/ci-integration.yml` and a
 * `check[]` entry in `dev/ci/eb3-ci-manifest.json`. Nothing discovers suites. A
 * new `*.test.mjs` nobody names simply never runs, and the local gate cannot
 * notice: `ci-local` selects changed test files, but a suite that no cloud lane
 * collects only ever runs on the author's machine.
 *
 * That is not a hypothesis. #529 (2026-10-31) found 38 tracked suites with 6
 * collected; #552 found `scripts/ci-local.test.mjs` collected by nobody. The
 * count of tracked `*.test.mjs` files has since grown to ~100, and the number of
 * distinct files named by any workflow is on the order of a dozen. This tool
 * measures the current gap and names both sides, so a "we now collect them"
 * claim can be checked instead of believed.
 *
 * DESIGN NOTES
 *   - KNOWN LIMIT: a suite named by a DIRECTORY or GLOB argument
 *     (`node --test tests/kits/`, `.../*.test.mjs`) is not expanded, so it would
 *     be reported UNCOLLECTED. No workflow on master passes a directory or a
 *     glob (all 18 `node --test` invocations name files); M1's discovery is
 *     what removes the limit.
 *   - READ-ONLY, and NOT a gate. It reports; `--strict` exists so a future lane
 *     (M1) can turn it into one without a second rule.
 *   - Scope is node:test suites only (`*.test.mjs|cjs|js`). Vitest suites are
 *     collected by the runner's own include globs and are counted but not
 *     audited here; mixing them in would repeat the "evidence-only = zero
 *     tests" mistake in the other direction.
 *   - An EXEMPTION is a file with a reason, never a silent allow-list: the
 *     exemptions file must map path -> {reason, review}. A file that is both
 *     collected and exempted is reported as a warning (a stale exemption).
 *   - The negative control is real: `git add -N <new>.test.mjs` makes the file
 *     visible to `git ls-files` without committing it, so an UNCOLLECTED verdict
 *     can be produced on purpose.
 *
 * USAGE
 *   node scripts/test-collection-audit.mjs [--json] [--strict] [--explain]
 *   node scripts/test-collection-audit.mjs --self-test
 *
 * Exit 0 for a measurement (and for --strict with no gap); 1 for --strict with
 * an uncollected file; 2 on read failure.
 */
import process from 'node:process'
import { readFileSync, existsSync, readdirSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { NODE_SUITE_RE } from './test-suite-paths.mjs'

// M6: this used to be a private regex (`\.test\.(mjs|cjs|js)$`), i.e. a second definition of "a
// node:test suite" one alternative away from the catalog's. It is now the shared predicate, aliased
// under the old name so callers do not change shape. Population-identical on this tree (110 files
// either way) and pinned by the `--self-test` case below.
export const TEST_RE = NODE_SUITE_RE
export const AUDITED_PREFIXES = ['scripts/', 'tests/']
export const EXEMPTIONS_FILE = 'dev/ci/node-test-exemptions.json'
const WORKFLOW_DIR = '.github/workflows'

/** node:test suites in scope (scripts/ and tests/), sorted. */
export function inScope(paths) {
  return paths.filter((p) => TEST_RE.test(p) && AUDITED_PREFIXES.some((pre) => p.startsWith(pre))).sort()
}

/**
 * Tokens named by a workflow file's `run:` blocks and by the manifest's
 * `check[]` arrays. Anything that is not a plausible path is dropped, so a
 * `--test-reporter=spec` flag cannot masquerade as a suite.
 */
export function collectTokens(workflowTexts = [], manifest = null, scopePaths = []) {
  const found = new Set()
  for (const text of workflowTexts) {
    // Join shell line-continuations so a wrapped `node --test a \\\n b` yields both.
    const joined = String(text).replace(/\\\r?\n/g, ' ')
    for (const line of joined.split('\n')) {
      const at = line.indexOf('node --test')
      if (at < 0) continue
      const rest = line.slice(at + 'node --test'.length)
      for (const raw of rest.split(/\s+/)) {
        const tok = raw.replace(/^['"]|['"]$/g, '')
        if (!tok || tok.startsWith('-') || tok.startsWith('$')) continue
        // A placeholder from prose (`scripts/<name>.test.mjs` in a comment) is not
        // a collected file: it has no real path character set.
        if (/[<>*?[\]{}]/.test(tok)) continue
        if (TEST_RE.test(tok)) found.add(tok.replace(/^\.\//, ''))
      }
    }
  }
  // The manifest's file names live at layers[].legs[].check — reading
  // layers[].check (the first version) always yielded zero tokens, i.e. the
  // manifest half of the criterion was dead code.
  const checks = []
  for (const layer of Array.isArray(manifest?.layers) ? manifest.layers : []) {
    if (Array.isArray(layer?.check)) checks.push(...layer.check)
    for (const leg of Array.isArray(layer?.legs) ? layer.legs : []) {
      if (Array.isArray(leg?.check)) checks.push(...leg.check)
      // M6: a dispatched leg declares its population as `suites[]` (an explicit subset) and/or
      // `areas[]` (a whole directory, expanded over the audited suites). This reader is what makes
      // the catalog's DISCOVERED_AND_COLLECTED agree with what the dispatcher actually runs; the
      // leg's `cmd` names only a leg id, so without these two fields the whole node:test set would
      // read as UNCOLLECTED and the ratchet would red for a set that did not change.
      if (Array.isArray(leg?.suites)) checks.push(...leg.suites)
      if (Array.isArray(leg?.areas)) {
        for (const raw of leg.areas) {
          const area = String(raw).replace(/^\.\//, '').replace(/\/+$/, '')
          if (area === '') continue
          for (const p of scopePaths) if (p.startsWith(`${area}/`)) found.add(p)
        }
      }
    }
  }
  // M6: a `knownNonRequired[]` entry may declare dispatch legs too (a job whose Required-ness is
  // declared there — currently pr-gate.yml#settlement). The workflow no longer names its suite, so
  // without this branch that suite would silently become UNCOLLECTED and the ratchet would read the
  // conversion as "CI stopped running a test".
  for (const entry of Array.isArray(manifest?.knownNonRequired) ? manifest.knownNonRequired : []) {
    for (const leg of Array.isArray(entry?.legs) ? entry.legs : []) {
      if (Array.isArray(leg?.suites)) checks.push(...leg.suites)
      if (Array.isArray(leg?.areas)) {
        for (const raw of leg.areas) {
          const area = String(raw).replace(/^\.\//, '').replace(/\/+$/, '')
          if (area === '') continue
          for (const p of scopePaths) if (p.startsWith(`${area}/`)) found.add(p)
        }
      }
    }
  }
  for (const c of checks) if (typeof c === 'string' && TEST_RE.test(c)) found.add(c.replace(/^\.\//, ''))
  return found
}

/**
 * Pure audit. `exemptions` maps path -> {reason, review}; an entry with no
 * non-empty `reason` is not an exemption (it is reported as an error).
 */
export function audit(testPaths, collected, exemptions = {}) {
  testPaths = (testPaths ?? []).filter((p) => TEST_RE.test(p))
  const exemptPaths = new Set()
  const badExemptions = []
  for (const [p, v] of Object.entries(exemptions ?? {})) {
    if (v && typeof v === 'object' && String(v.reason ?? '').trim() !== '' && String(v.review ?? '').trim() !== '') exemptPaths.add(p)
    else badExemptions.push(p)
  }
  const collectedList = []
  const uncollected = []
  const exempt = []
  const staleExemptions = []
  for (const p of testPaths) {
    const isCollected = collected.has(p)
    const isExempt = exemptPaths.has(p)
    if (isCollected) collectedList.push(p)
    else if (isExempt) exempt.push(p)
    else uncollected.push(p)
    if (isCollected && isExempt) staleExemptions.push(p)
  }
  const collectedButUnknown = [...collected].filter((p) => !testPaths.includes(p)).sort()
  return {
    total: testPaths.length,
    collected: collectedList,
    uncollected,
    exempt,
    staleExemptions,
    badExemptions,
    collectedNotInScope: collectedButUnknown,
    coveragePct: testPaths.length === 0 ? 100 : Math.round((100 * (collectedList.length + exempt.length)) / testPaths.length),
  }
}

export function verdictToken(result) {
  return `DSH-TEST-COLLECTION total=${result.total} collected=${result.collected.length} exempt=${result.exempt.length} uncollected=${result.uncollected.length} covered_pct=${result.coveragePct}`
}

// ------------------------------------------------------------------- live

function readIf(path) {
  return existsSync(path) ? readFileSync(path, 'utf8') : null
}

export function gather({ cwd = process.cwd() } = {}) {
  const tracked = execFileSync('git', ['ls-files', '-z'], { cwd, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
    .split('\0').filter(Boolean)
  const testPaths = inScope(tracked)
  const workflowTexts = []
  const wfDir = resolve(cwd, WORKFLOW_DIR)
  if (existsSync(wfDir)) {
    for (const f of readdirSync(wfDir).filter((n) => /\.ya?ml$/.test(n))) workflowTexts.push(readFileSync(resolve(wfDir, f), 'utf8'))
  }
  const manifestText = readIf(resolve(cwd, 'dev/ci/eb3-ci-manifest.json'))
  const manifest = manifestText ? JSON.parse(manifestText) : null
  const exemptionsText = readIf(resolve(cwd, EXEMPTIONS_FILE))
  const exemptions = exemptionsText ? JSON.parse(exemptionsText) : {}
  return { testPaths, collected: collectTokens(workflowTexts, manifest, testPaths), exemptions, tracked }
}

// ---------------------------------------------------------------- render

export function render(result) {
  const lines = []
  lines.push(`test-collection-audit (node:test suites under ${AUDITED_PREFIXES.join(', ')}):`)
  lines.push(`  tracked suites   ${result.total}`)
  lines.push(`  collected        ${result.collected.length}`)
  lines.push(`  exempted         ${result.exempt.length}`)
  lines.push(`  UNCOLLECTED      ${result.uncollected.length}`)
  if (result.uncollected.length > 0) {
    lines.push('  not named by any workflow step or manifest leg:')
    for (const p of result.uncollected.slice(0, 40)) lines.push(`    ${p}`)
    if (result.uncollected.length > 40) lines.push(`    ... ${result.uncollected.length - 40} more`)
  }
  if (result.staleExemptions.length > 0) lines.push(`  WARN stale exemption (file is also collected): ${result.staleExemptions.join(', ')}`)
  if (result.badExemptions.length > 0) lines.push(`  ERROR exemption without reason/review: ${result.badExemptions.join(', ')}`)
  if (result.collectedNotInScope.length > 0) lines.push(`  note collected outside scope: ${result.collectedNotInScope.join(', ')}`)
  lines.push('  NOTE the L2 census only PARSES tests/world-factory as a raw corpus (ci-pr-gate.mjs:1368');
  lines.push('        "parse, no spawn"); it runs no world-factory suite, so parse is not collection.')
  lines.push('  a suite named in NO lane runs only on its author machine (TINF-01);')
  lines.push('  "collect it in M1 by discovery" is the fix, not another hand-written list.')
  lines.push(verdictToken(result))
  return lines.join('\n')
}

// --------------------------------------------------------------------- cli

function parseArgs(argv) {
  const opts = { json: false, strict: false, explain: false, input: null, selfTest: false, help: false }
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i]
    if (a === '--json') opts.json = true
    else if (a === '--strict') opts.strict = true
    else if (a === '--explain') opts.explain = true
    else if (a === '--input') opts.input = argv[++i]
    else if (a === '--self-test') opts.selfTest = true
    else if (a === '--help' || a === '-h') opts.help = true
    else throw new Error(`unknown argument ${a}`)
  }
  return opts
}

function selfTest() {
  const cases = []
  const wf = [
    'run: node --test scripts/a.test.mjs scripts/b.test.mjs',
    'run: node --test --test-reporter=spec tests/c.test.mjs',
    'run: |\n  node --test \\\n    tests/d.test.mjs',
  ]
  const toks = collectTokens(wf, { layers: [{ check: ['tests/e.test.mjs', 'tests/not-a-test.mjs'] }] })
  cases.push(['workflow tokens + continuation + flags', ['scripts/a.test.mjs', 'scripts/b.test.mjs', 'tests/c.test.mjs', 'tests/d.test.mjs', 'tests/e.test.mjs'].every((p) => toks.has(p)) && ![...toks].some((t) => t.startsWith('-')), JSON.stringify([...toks])])

  const paths = ['scripts/a.test.mjs', 'tests/b.test.mjs', 'tests/kits/c.mjs']
  const r = audit(paths, new Set(['scripts/a.test.mjs']), { 'tests/b.test.mjs': { reason: 'needs host', review: 'M1' } })
  cases.push(['collected/exempt/uncollected split', r.total === 2 && r.collected.length === 1 && r.exempt.length === 1 && r.uncollected.length === 0 && r.coveragePct === 100, JSON.stringify(r)])
  const r2 = audit(paths, new Set(['scripts/a.test.mjs']))
  cases.push(['uncollected is red surface', r2.uncollected.length === 1 && r2.coveragePct === 50, JSON.stringify(r2)])
  const r3 = audit(paths, new Set(['scripts/a.test.mjs']), { 'scripts/a.test.mjs': { reason: 'x', review: 'y' }, 'tests/b.test.mjs': { reason: '' } })
  cases.push(['stale + reasonless exemption are reported', r3.staleExemptions.length === 1 && r3.badExemptions.includes('tests/b.test.mjs'), JSON.stringify([r3.staleExemptions, r3.badExemptions])])
  cases.push(['scope excludes kit runners that are not suites', inScope(['tests/kits/a/a.mjs', 'scripts/x.test.mjs']).length === 1, JSON.stringify(inScope(['tests/kits/a/a.mjs', 'scripts/x.test.mjs']))])

  // M6: a dispatched leg declares `suites[]`/`areas[]`, not `check[]`. Both must count as collected,
  // otherwise the catalog's own ratchet reds the day the workflow list is deleted — and the failure
  // would look like "CI stopped running tests" instead of "the reader is stale".
  const dispatchManifest = {
    layers: [{
      id: 'l', legs: [
        { id: 'subset', cmd: ['node', 'scripts/dispatch-tests.mjs', '--run', '--leg', 'subset'], suites: ['scripts/a.test.mjs', './scripts/b.test.mjs'] },
        { id: 'area', cmd: ['node', 'scripts/dispatch-tests.mjs', '--run', '--leg', 'area'], areas: ['tests/checks/'] },
      ],
    }],
  }
  const scope = ['scripts/a.test.mjs', 'scripts/b.test.mjs', 'tests/checks/x.test.mjs', 'tests/checks/deep/y.test.mjs', 'tests/other/z.test.mjs']
  const d = collectTokens([], dispatchManifest, scope)
  cases.push([
    'dispatched suites[] + areas[] are collected (and an area is expanded, not globbed)',
    ['scripts/a.test.mjs', 'scripts/b.test.mjs', 'tests/checks/x.test.mjs', 'tests/checks/deep/y.test.mjs'].every((p) => d.has(p)) && !d.has('tests/other/z.test.mjs'),
    JSON.stringify([...d]),
  ])

  let bad = 0
  for (const [label, ok, detail] of cases) {
    if (!ok) bad += 1
    process.stdout.write(`  ${ok ? 'ok  ' : 'FAIL'} ${label}${ok ? '' : `: ${detail}`}\n`)
  }
  process.stdout.write(`DSH-TEST-COLLECTION-SELFTEST ${bad === 0 ? 'PASS' : 'FAIL'} cases=${cases.length} failed=${bad}\n`)
  return bad === 0 ? 0 : 1
}

function main() {
  const opts = parseArgs(process.argv.slice(2))
  if (opts.help) {
    process.stdout.write('usage: node scripts/test-collection-audit.mjs [--json] [--strict] [--explain]\n' +
      '       node scripts/test-collection-audit.mjs --self-test\n')
    return 0
  }
  if (opts.selfTest) return selfTest()
  let result
  try {
    if (opts.input) {
      const payload = JSON.parse(readFileSync(resolve(opts.input), 'utf8'))
      result = audit(payload.testPaths, new Set(payload.collected), payload.exemptions)
    } else {
      const g = gather()
      result = audit(g.testPaths, g.collected, g.exemptions)
    }
  } catch (e) {
    process.stdout.write(`ERROR AUDIT_FAILED ${e?.message ?? e}\n`)
    return 2
  }
  process.stdout.write(`${opts.json ? JSON.stringify(result, null, 2) : render(result)}\n`)
  if (opts.strict && result.uncollected.length > 0) return 1
  return 0
}

const invokedDirectly = process.argv[1] !== undefined && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))
if (invokedDirectly) process.exit(main())
