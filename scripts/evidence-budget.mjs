#!/usr/bin/env node
/**
 * evidence-budget — measure how much evidence a PR actually adds, and how much
 * the evidence tree has accumulated, before anyone proposes a number.
 *
 * WHY THIS EXISTS. The 2026-11-13 optimization memo proposed a "≤ 2 MB of
 * evidence per PR" cap (M5). A cap needs a measurement: otherwise it is a guess
 * that either never binds (and everyone ignores it) or blocks honest work. This
 * tool is READ-ONLY and answers two questions from git and the filesystem:
 *
 *   --commits N   bytes added under dev/agent-workflow/evidence by each of the
 *                 last N first-parent commits on origin/master (the PR-shaped
 *                 unit), with p50 / p90 / max.
 *   --dirs        bytes per top-level evidence directory, so accumulation is
 *                 visible separately from per-PR cost.
 *
 * It never deletes, moves or rewrites evidence. Exit 0 always for measurement
 * (a report is not a verdict); exit 2 when git or the directory cannot be read.
 *
 * USAGE
 *   node scripts/evidence-budget.mjs [--commits 30] [--cap-mb 2]
 *   node scripts/evidence-budget.mjs --dirs [--cap-mb 2] [--top 10]
 *   node scripts/evidence-budget.mjs --self-test
 */
import process from 'node:process'
import { readdirSync, statSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { join } from 'node:path'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const EVIDENCE_DIR = 'dev/agent-workflow/evidence'
const MIB = 1024 * 1024

/** Nearest-rank percentile over an ascending-sorted array. Empty -> 0. */
export function percentile(sorted, p) {
  if (!Array.isArray(sorted) || sorted.length === 0) return 0
  if (p <= 0) return sorted[0]
  if (p >= 100) return sorted[sorted.length - 1]
  const rank = Math.ceil((p / 100) * sorted.length) - 1
  return sorted[Math.max(0, Math.min(sorted.length - 1, rank))]
}

/**
 * `rows` is [{bytes, label}] in any order. Returns the distribution plus the
 * rows that exceed the cap, so a caller can print "the cap would have caught N
 * of M commits" instead of asserting a cap with no evidence.
 */
export function summarize(rows, capBytes = 2 * MIB) {
  const clean = (Array.isArray(rows) ? rows : [])
    .filter((r) => r && Number.isFinite(r.bytes))
    .map((r) => ({ ...r, bytes: Math.max(0, r.bytes) }))
  const sorted = clean.map((r) => r.bytes).sort((a, b) => a - b)
  const over = clean.filter((r) => r.bytes > capBytes).sort((a, b) => b.bytes - a.bytes)
  return {
    count: clean.length,
    totalBytes: sorted.reduce((s, b) => s + b, 0),
    p50: percentile(sorted, 50),
    p90: percentile(sorted, 90),
    max: sorted.length ? sorted[sorted.length - 1] : 0,
    capBytes,
    overCapCount: over.length,
    overCap: over,
  }
}

export function formatBytes(n) {
  if (!Number.isFinite(n)) return '?'
  if (n >= MIB) return `${(n / MIB).toFixed(1)} MiB`
  if (n >= 1024) return `${(n / 1024).toFixed(1)} KiB`
  return `${n} B`
}

/** Parse `git log --numstat --format=@@<sha>\t<subject>` into per-commit rows. */
export function parseNumstatLog(text) {
  const rows = []
  let current = null
  for (const line of String(text).split('\n')) {
    if (line.startsWith('@@')) {
      const [sha, ...rest] = line.slice(2).split('\t')
      current = { sha, subject: rest.join('\t'), bytes: 0, files: 0 }
      rows.push(current)
      continue
    }
    if (!current || !line.trim()) continue
    const parts = line.split('\t')
    if (parts.length < 3) continue
    const added = parts[0] === '-' ? 0 : Number.parseInt(parts[0], 10)
    if (Number.isFinite(added)) current.bytes += added
    current.files += 1
  }
  return rows
}

// ------------------------------------------------------------------- live

function git(args) {
  return execFileSync('git', args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
}

export function commitsReport(count = 30, capBytes = 2 * MIB) {
  const text = git([
    'log', '--first-parent', `-n${count}`, '--numstat', '--format=@@%H%x09%s',
    'origin/master', '--', EVIDENCE_DIR,
  ])
  const rows = parseNumstatLog(text)
  return { mode: 'commits', rows, summary: summarize(rows, capBytes) }
}

function walk(dir, acc) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name)
    if (e.isDirectory()) walk(p, acc)
    else if (e.isFile()) {
      try {
        acc.bytes += statSync(p).size
        acc.files += 1
      } catch { /* unreadable file: measured as 0, never fatal */ }
    }
  }
}

export function dirsReport(capBytes = 2 * MIB) {
  const rows = []
  for (const e of readdirSync(EVIDENCE_DIR, { withFileTypes: true })) {
    const p = join(EVIDENCE_DIR, e.name)
    const acc = { bytes: 0, files: 0 }
    if (e.isDirectory()) walk(p, acc)
    else if (e.isFile()) {
      try { acc.bytes = statSync(p).size; acc.files = 1 } catch { /* ignore */ }
    }
    rows.push({ label: e.name, bytes: acc.bytes, files: acc.files })
  }
  rows.sort((a, b) => b.bytes - a.bytes)
  return { mode: 'dirs', rows, summary: summarize(rows, capBytes) }
}

// ---------------------------------------------------------------- render

export function render(result, top = 10) {
  const s = result.summary
  const lines = []
  if (result.mode === 'commits') {
    lines.push(`evidence-budget commits: n=${s.count} total=${formatBytes(s.totalBytes)} p50=${formatBytes(s.p50)} p90=${formatBytes(s.p90)} max=${formatBytes(s.max)} cap=${formatBytes(s.capBytes)} over_cap=${s.overCapCount}`)
    for (const r of result.rows.slice(0, top)) {
      lines.push(`  ${formatBytes(r.bytes).padStart(9)}  ${r.files} file(s)  ${r.sha.slice(0, 10)}  ${r.subject.slice(0, 70)}`)
    }
  } else {
    lines.push(`evidence-budget dirs: n=${s.count} total=${formatBytes(s.totalBytes)} p50=${formatBytes(s.p50)} p90=${formatBytes(s.p90)} max=${formatBytes(s.max)} cap=${formatBytes(s.capBytes)} over_cap=${s.overCapCount}`)
    for (const r of result.rows.slice(0, top)) {
      lines.push(`  ${formatBytes(r.bytes).padStart(9)}  ${String(r.files).padStart(5)} file(s)  ${r.label}`)
    }
  }
  return lines.join('\n')
}

export function verdictToken(result) {
  const s = result.summary
  return `DSH-EVIDENCE-BUDGET mode=${result.mode} n=${s.count} p50=${s.p50} p90=${s.p90} max=${s.max} cap=${s.capBytes} over_cap=${s.overCapCount}`
}

// ------------------------------------------------------------------- cli

function parseArgs(argv) {
  const o = { mode: 'commits', commits: 30, capMb: 2, top: 10, selfTest: false }
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i]
    if (a === '--commits') o.commits = Number.parseInt(argv[++i], 10)
    else if (a === '--dirs') o.mode = 'dirs'
    else if (a === '--cap-mb') o.capMb = Number.parseFloat(argv[++i])
    else if (a === '--top') o.top = Number.parseInt(argv[++i], 10)
    else if (a === '--self-test') o.selfTest = true
    else if (a === '--help' || a === '-h') { o.help = true }
    else throw new Error(`unknown argument ${a}`)
  }
  if (!Number.isFinite(o.commits) || o.commits <= 0) throw new Error('--commits needs a positive integer')
  if (!Number.isFinite(o.capMb) || o.capMb < 0) throw new Error('--cap-mb needs a non-negative number')
  return o
}

function selfTest() {
  const cases = [
    ['empty percentile is 0', percentile([], 50) === 0],
    ['p50 of 1..10 is 5', percentile([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 50) === 5],
    ['p90 of 1..10 is 9', percentile([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 90) === 9],
    ['summarize splits over-cap rows', (() => {
      const r = summarize([{ label: 'a', bytes: 1 }, { label: 'b', bytes: 5 }], 4)
      return r.count === 2 && r.overCapCount === 1 && r.overCap[0].label === 'b' && r.p50 === 1 && r.max === 5
    })()],
    ['numstat parsing keeps zero-byte commits', (() => {
      const rows = parseNumstatLog('@@abc\tsubject one\n10\t0\tdev/agent-workflow/evidence/x/a.txt\n@@def\tsubject two\n')
      return rows.length === 2 && rows[0].bytes === 10 && rows[0].files === 1 && rows[1].bytes === 0
    })()],
  ]
  let bad = 0
  for (const [label, ok] of cases) {
    if (!ok) bad += 1
    process.stdout.write(`  ${ok ? 'ok  ' : 'FAIL'} ${label}\n`)
  }
  process.stdout.write(`DSH-EVIDENCE-BUDGET-SELFTEST ${bad === 0 ? 'PASS' : 'FAIL'} cases=${cases.length} failed=${bad}\n`)
  return bad === 0 ? 0 : 1
}

function main() {
  let o
  try {
    o = parseArgs(process.argv.slice(2))
  } catch (e) {
    process.stdout.write(`ERROR ${e.message}\n`)
    return 2
  }
  if (o.help) {
    process.stdout.write('usage: node scripts/evidence-budget.mjs [--commits N] [--dirs] [--cap-mb N] [--top N] [--self-test]\n')
    return 0
  }
  if (o.selfTest) return selfTest()
  const capBytes = Math.round(o.capMb * MIB)
  let result
  try {
    result = o.mode === 'dirs' ? dirsReport(capBytes) : commitsReport(o.commits, capBytes)
  } catch (e) {
    process.stdout.write(`ERROR MEASUREMENT_FAILED ${e?.message ?? e}\n`)
    return 2
  }
  process.stdout.write(`${render(result, o.top)}\n${verdictToken(result)}\n`)
  return 0
}

const invokedDirectly = (() => {
  if (!process.argv[1]) return false
  try { return resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url)) } catch { return false }
})()

if (invokedDirectly) process.exit(main())
