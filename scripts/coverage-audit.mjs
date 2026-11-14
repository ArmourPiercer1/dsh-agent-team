#!/usr/bin/env node
/**
 * coverage-audit — how often does the local gate (`pnpm ci:local`) answer
 * "coverage=undetermined", and WHICH KIND of path causes it?
 *
 * WHY THIS EXISTS. `ci-local` refuses to guess a test blast radius for paths it
 * cannot place (exit 2, `coverage=undetermined`). That is the honest behaviour,
 * but nobody measured how often it fires. If half of all merged changes are
 * undetermined, "L0 green" is not a local verdict for half of the work, and a
 * developer learns that by pushing. This tool measures the rate from git history
 * using ci-local's OWN classifier — no second rule, no guessing.
 *
 * M0 CORRECTION (TINF, 2026-11-14). The first version (PR #764) reported a bare
 * percentage. That number invites exactly one wrong fix, which that PR proposed
 * and the design set REJECTS (TINF-03, `04-IMPACT-PLANNER-AND-TIERS.md` §5):
 * classifying `tests/kits/**` as "evidence-only" so that `coverage=determined`
 * with ZERO selected tests. Turning "I cannot name the blast radius" into "green,
 * nothing was run" is the failure `ci-local.mjs` was changed to stop (the
 * `eslint.config.mjs` episode: the fall-through reported determined-with-nothing-
 * run). So this tool keeps exit 2 where it is and instead NAMES the reason:
 *
 *   kit-runner            tests/kits/**            an evidence generator, not a
 *                                                   collected suite (TINF-01/03)
 *   world-factory-driver  tests/world-factory/**   same, for the world drivers
 *   uncatalogued-script   scripts/**               a tool whose tests no lane
 *                                                   collects (the M1 gap)
 *   root-scratch          a tracked repo-root file a scratch file that was
 *                                                   committed by accident
 *   other                 anything else            a genuine classification gap
 *
 * The reason histogram is the actionable output: `root-scratch` is fixed by
 * `.gitignore` (no rule change), `kit-runner`/`uncatalogued-script` are fixed by
 * making collection real (M1), and only `other` indicates a rule that is
 * missing. A percentage alone cannot tell those apart.
 *
 * READ-ONLY: it reads `git diff` and calls `classify()`. It runs no tests.
 *
 * USAGE
 *   node scripts/coverage-audit.mjs [--commits 40] [--json] [--top 10] [--explain]
 *   node scripts/coverage-audit.mjs --self-test
 *
 * Exit 0 always for a measurement; exit 2 when git cannot be read. The rate and
 * the reason mix are the output, not a pass/fail verdict.
 */
import process from 'node:process'
import { execFileSync } from 'node:child_process'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { classify } from './ci-local.mjs'

const MASTER = 'origin/master'

export const REASONS = ['kit-runner', 'world-factory-driver', 'uncatalogued-script', 'root-scratch', 'other']

/**
 * Why a path `ci-local` cannot place is not a rule gap but a known class.
 * Order matters: more specific prefixes first.
 */
export function reasonOf(path) {
  const p = String(path ?? '').replace(/^\.\//, '')
  if (p.startsWith('tests/kits/')) return 'kit-runner'
  if (p.startsWith('tests/world-factory/')) return 'world-factory-driver'
  if (p.startsWith('scripts/')) return 'uncatalogued-script'
  if (!p.includes('/')) return 'root-scratch'
  return 'other'
}

/**
 * Pure aggregation. `rows` is [{sha, subject, files, undetermined:[paths]}].
 * Kept separate from git so the arithmetic is testable without a repository.
 */
export function summarizeAudit(rows, top = 10) {
  const clean = Array.isArray(rows) ? rows.filter(Boolean) : []
  const withFiles = clean.filter((r) => Array.isArray(r.files) && r.files.length > 0)
  const undetermined = withFiles.filter((r) => Array.isArray(r.undetermined) && r.undetermined.length > 0)
  const hist = new Map()
  const byReason = new Map(REASONS.map((r) => [r, new Map()]))
  for (const r of undetermined) {
    for (const p of r.undetermined) {
      hist.set(p, (hist.get(p) ?? 0) + 1)
      const reason = reasonOf(p)
      const m = byReason.get(reason) ?? new Map()
      m.set(p, (m.get(p) ?? 0) + 1)
      byReason.set(reason, m)
    }
  }
  const topPaths = [...hist.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, top)
    .map(([path, count]) => ({ path, count, reason: reasonOf(path) }))
  const reasonCounts = {}
  for (const [reason, m] of byReason) {
    reasonCounts[reason] = {
      paths: m.size,
      hits: [...m.values()].reduce((s, n) => s + n, 0),
    }
  }
  return {
    commits: withFiles.length,
    undeterminedCommits: undetermined.length,
    determinedCommits: withFiles.length - undetermined.length,
    ratePct: withFiles.length === 0 ? 0 : Math.round((100 * undetermined.length) / withFiles.length),
    topPaths,
    reasonCounts,
  }
}

export function verdictToken(result) {
  const top = result.topPaths[0]
  return `DSH-COVERAGE-AUDIT commits=${result.commits} undetermined=${result.undeterminedCommits} rate_pct=${result.ratePct} top=${top?.path ?? 'none'} top_reason=${top?.reason ?? 'none'}`
}

// ------------------------------------------------------------------- live

function git(args) {
  return execFileSync('git', args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
}

export function audit(commits = 40) {
  const shas = git(['log', '--first-parent', `-n${commits}`, '--format=%H', MASTER]).trim().split('\n').filter(Boolean)
  const rows = []
  for (const sha of shas) {
    let files = []
    try {
      files = git(['diff', '--name-only', `${sha}^`, sha]).trim().split('\n').filter(Boolean)
    } catch {
      continue // root commit or shallow boundary: not a measurable change set
    }
    if (files.length === 0) continue
    const c = classify(files)
    rows.push({
      sha,
      subject: git(['log', '-1', '--format=%s', sha]).trim(),
      files,
      undetermined: c.undetermined,
    })
  }
  return summarizeAudit(rows)
}

// ---------------------------------------------------------------- render

export function render(result, { top = 10, explain = false } = {}) {
  const lines = []
  lines.push(`coverage-audit (${MASTER}, last 40 commits with a diff):`)
  lines.push(`  determined   ${result.determinedCommits}`)
  lines.push(`  undetermined ${result.undeterminedCommits}  (${result.ratePct}%)`)
  lines.push('  why (paths named per class; "green with 0 tests" is NOT an acceptable fix):')
  for (const reason of REASONS) {
    const c = result.reasonCounts[reason]
    if (!c || c.paths === 0) continue
    lines.push(`    ${reason.padEnd(21)} ${String(c.hits).padStart(3)} hit(s) over ${c.paths} path(s)`)
  }
  lines.push('  paths that make a change undetermined:')
  for (const p of result.topPaths) lines.push(`    ${String(p.count).padStart(3)}x  ${p.path}  [${p.reason}]`)
  if (explain) {
    lines.push('  note: kit-runner/uncatalogued-script are collection gaps (M1); root-scratch is a')
    lines.push('        .gitignore bug; only "other" means a classify() rule is missing.')
  }
  lines.push(verdictToken(result))
  return lines.join('\n')
}

// --------------------------------------------------------------------- cli

function parseArgs(argv) {
  const opts = { commits: 40, json: false, top: 10, explain: false, input: null, selfTest: false, help: false }
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i]
    if (a === '--commits') opts.commits = Number(argv[++i])
    else if (a === '--json') opts.json = true
    else if (a === '--top') opts.top = Number(argv[++i])
    else if (a === '--explain') opts.explain = true
    else if (a === '--input') opts.input = argv[++i]
    else if (a === '--self-test') opts.selfTest = true
    else if (a === '--help' || a === '-h') opts.help = true
    else throw new Error(`unknown argument ${a}`)
  }
  if (!Number.isInteger(opts.commits) || opts.commits <= 0) throw new Error('--commits needs a positive integer')
  return opts
}

function selfTest() {
  const cases = []
  cases.push(['reason: kit runner', reasonOf('tests/kits/a1/a1-bash.mjs') === 'kit-runner', reasonOf('tests/kits/a1/a1-bash.mjs')])
  cases.push(['reason: script', reasonOf('scripts/pr-ready-check.mjs') === 'uncatalogued-script', reasonOf('scripts/pr-ready-check.mjs')])
  cases.push(['reason: root scratch', reasonOf('.merge-loop.sh') === 'root-scratch', reasonOf('.merge-loop.sh')])
  cases.push(['reason: other', reasonOf('config/eslint.mjs') === 'other', reasonOf('config/eslint.mjs')])

  const rows = [
    { sha: 'a', subject: 's', files: ['x'], undetermined: [] },
    { sha: 'b', subject: 's', files: ['a', 'b'], undetermined: ['tests/kits/k.mjs', '.scratch.sh'] },
    { sha: 'c', subject: 's', files: ['c'], undetermined: ['scripts/tool.mjs'] },
  ]
  const s = summarizeAudit(rows)
  cases.push(['rate counts only commits with a diff', s.commits === 3 && s.undeterminedCommits === 2 && s.ratePct === 67, JSON.stringify(s)])
  cases.push(['reason histogram', s.reasonCounts['kit-runner'].hits === 1 && s.reasonCounts['root-scratch'].hits === 1 && s.reasonCounts['uncatalogued-script'].hits === 1, JSON.stringify(s.reasonCounts)])
  cases.push(['top path carries its reason', s.topPaths.length === 3 && s.topPaths.every((p) => p.reason), JSON.stringify(s.topPaths)])

  // A directory called `tests/kits` is a kit runner; a FILE with that prefix
  // that is actually a collected suite would be classified by ci-local first,
  // so reasonOf() only ever sees paths ci-local already refused.
  cases.push(['colon-free token', verdictToken(s).includes('rate_pct=67'), verdictToken(s)])

  let bad = 0
  for (const [label, ok, detail] of cases) {
    if (!ok) bad += 1
    process.stdout.write(`  ${ok ? 'ok  ' : 'FAIL'} ${label}${ok ? '' : `: ${detail}`}\n`)
  }
  process.stdout.write(`DSH-COVERAGE-AUDIT-SELFTEST ${bad === 0 ? 'PASS' : 'FAIL'} cases=${cases.length} failed=${bad}\n`)
  return bad === 0 ? 0 : 1
}

function main() {
  const opts = parseArgs(process.argv.slice(2))
  if (opts.help) {
    process.stdout.write('usage: node scripts/coverage-audit.mjs [--commits N] [--top N] [--explain] [--json]\n' +
      '       node scripts/coverage-audit.mjs --self-test\n')
    return 0
  }
  if (opts.selfTest) return selfTest()
  let result
  try {
    result = opts.input ? JSON.parse(execFileSync('cat', [opts.input], { encoding: 'utf8' })) : audit(opts.commits)
  } catch (e) {
    process.stdout.write(`ERROR AUDIT_FAILED ${e?.message ?? e}\n`)
    return 2
  }
  process.stdout.write(`${opts.json ? JSON.stringify(result, null, 2) : render(result, opts)}\n`)
  return 0
}

const invokedDirectly = process.argv[1] !== undefined && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))
if (invokedDirectly) process.exit(main())
