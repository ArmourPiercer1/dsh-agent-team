#!/usr/bin/env node
/**
 * coverage-audit — how often does the local gate (`pnpm ci:local`) answer
 * "coverage=undetermined", and which paths cause it?
 *
 * WHY THIS EXISTS. `ci-local` refuses to guess a test blast radius for paths it
 * cannot place (exit 2, `coverage=undetermined`). That is the honest behaviour,
 * but nobody measured how often it fires. If half of all merged changes are
 * undetermined, "L0 green" is not a local verdict for half of the work, and a
 * developer learns that by pushing. This tool measures the rate from git history
 * using ci-local's OWN classifier — no second rule, no guessing.
 *
 * READ-ONLY: it reads `git diff` and calls `classify()`. It runs no tests.
 *
 * USAGE
 *   node scripts/coverage-audit.mjs [--commits 40] [--json] [--top 10]
 *   node scripts/coverage-audit.mjs --self-test
 *
 * Exit 0 always for a measurement; exit 2 when git cannot be read. The rate is
 * the output, not a pass/fail verdict.
 */
import process from 'node:process'
import { execFileSync } from 'node:child_process'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { classify } from './ci-local.mjs'

const MASTER = 'origin/master'

/**
 * Pure aggregation. `rows` is [{sha, subject, files, undetermined:[paths]}].
 * Kept separate from git so the arithmetic is testable without a repository.
 */
export function summarizeAudit(rows, top = 10) {
  const clean = Array.isArray(rows) ? rows.filter(Boolean) : []
  const withFiles = clean.filter((r) => Array.isArray(r.files) && r.files.length > 0)
  const undetermined = withFiles.filter((r) => Array.isArray(r.undetermined) && r.undetermined.length > 0)
  const hist = new Map()
  for (const r of undetermined) {
    for (const p of r.undetermined) hist.set(p, (hist.get(p) ?? 0) + 1)
  }
  const topPaths = [...hist.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, top)
    .map(([path, count]) => ({ path, count }))
  return {
    commits: withFiles.length,
    undeterminedCommits: undetermined.length,
    determinedCommits: withFiles.length - undetermined.length,
    ratePct: withFiles.length === 0 ? 0 : Math.round((100 * undetermined.length) / withFiles.length),
    topPaths,
    examples: undetermined.slice(0, top).map((r) => ({ sha: r.sha, subject: r.subject, paths: r.undetermined })),
  }
}

export function verdictToken(result) {
  return `DSH-COVERAGE-AUDIT commits=${result.commits} undetermined=${result.undeterminedCommits} rate_pct=${result.ratePct} top=${result.topPaths[0]?.path ?? 'none'}`
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
      packages: c.packages,
      tests: c.tests,
      ci: c.ci,
      docsOnly: c.docsOnly,
    })
  }
  return summarizeAudit(rows)
}

// ---------------------------------------------------------------- render

export function render(result, top = 10) {
  const lines = [
    `coverage-audit (${MASTER}, last ${result.commits} commits with a diff):`,
    `  determined   ${result.determinedCommits}`,
    `  undetermined ${result.undeterminedCommits}  (${result.ratePct}%)`,
  ]
  if (result.topPaths.length) {
    lines.push('  paths that make a change undetermined:')
    for (const p of result.topPaths.slice(0, top)) lines.push(`    ${String(p.count).padStart(3)}x  ${p.path}`)
  }
  return lines.join('\n')
}

// ------------------------------------------------------------------- cli

function parseArgs(argv) {
  const o = { commits: 40, top: 10, json: false, selfTest: false }
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i]
    if (a === '--commits') o.commits = Number.parseInt(argv[++i], 10)
    else if (a === '--top') o.top = Number.parseInt(argv[++i], 10)
    else if (a === '--json') o.json = true
    else if (a === '--self-test') o.selfTest = true
    else if (a === '--help' || a === '-h') { o.help = true }
    else throw new Error(`unknown argument ${a}`)
  }
  if (!Number.isFinite(o.commits) || o.commits <= 0) throw new Error('--commits needs a positive integer')
  return o
}

function selfTest() {
  const rows = [
    { sha: 'a', subject: 'docs', files: ['docs/x.md'], undetermined: [] },
    { sha: 'b', subject: 'kit', files: ['tests/kits/x/run.mjs'], undetermined: ['tests/kits/x/run.mjs'] },
    { sha: 'c', subject: 'both', files: ['scripts/x.mjs', 'docs/y.md'], undetermined: ['scripts/x.mjs'] },
    { sha: 'd', subject: 'empty', files: [], undetermined: [] },
  ]
  const r = summarizeAudit(rows, 5)
  const cases = [
    ['empty change sets are excluded', r.commits === 3],
    ['rate is 2 of 3', r.undeterminedCommits === 2 && r.ratePct === 67],
    ['histogram is counted', r.topPaths[0].count === 1 && r.topPaths.length === 2],
    ['examples omit determined rows', r.examples.every((e) => e.paths.length > 0)],
  ]
  let bad = 0
  for (const [label, ok] of cases) {
    if (!ok) bad += 1
    process.stdout.write(`  ${ok ? 'ok  ' : 'FAIL'} ${label}\n`)
  }
  process.stdout.write(`DSH-COVERAGE-AUDIT-SELFTEST ${bad === 0 ? 'PASS' : 'FAIL'} cases=${cases.length} failed=${bad}\n`)
  return bad === 0 ? 0 : 1
}

function main() {
  let o
  try { o = parseArgs(process.argv.slice(2)) } catch (e) {
    process.stdout.write(`ERROR ${e.message}\n`)
    return 2
  }
  if (o.help) {
    process.stdout.write('usage: node scripts/coverage-audit.mjs [--commits N] [--top N] [--json] [--self-test]\n')
    return 0
  }
  if (o.selfTest) return selfTest()
  let result
  try {
    result = audit(o.commits)
  } catch (e) {
    process.stdout.write(`ERROR AUDIT_FAILED ${e?.message ?? e}\n`)
    return 2
  }
  if (o.json) process.stdout.write(`${JSON.stringify(result, null, 2)}\n`)
  process.stdout.write(`${render(result, o.top)}\n${verdictToken(result)}\n`)
  return 0
}

const invokedDirectly = (() => {
  if (!process.argv[1]) return false
  try { return resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url)) } catch { return false }
})()

if (invokedDirectly) process.exit(main())
