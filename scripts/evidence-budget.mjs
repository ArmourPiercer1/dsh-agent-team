#!/usr/bin/env node
/**
 * evidence-budget — measure how much evidence a PR actually adds, and how much
 * the evidence tree has accumulated, before anyone proposes a number.
 *
 * WHY THIS EXISTS. The 2026-11-13 optimization memo proposed a "≤ 2 MB of
 * evidence per PR" cap (M5). A cap needs a measurement: otherwise it is a guess
 * that either never binds (and everyone ignores it) or blocks honest work. This
 * tool is READ-ONLY.
 *
 * M0 CORRECTION (TINF, 2026-11-14). The first version of this tool (PR #761)
 * measured `git --numstat` and labelled the result "bytes". Two things were
 * wrong, both named in `docs/plans/memo/agent-testing-infrastructure-20261114/`:
 *
 *   1. `--numstat` counts LINES, not bytes. For prose-ish JSON the two are
 *      close, for minified or long-line evidence they are not, and for a BINARY
 *      blob `--numstat` prints `-` and the old parser recorded 0 — a binary
 *      evidence file was invisible to the very metric meant to bound it.
 *      Sizes are now read from the object database (`git cat-file -s`), so a
 *      binary file counts by its real size.
 *   2. `git log -n30 -- <path>` selects the 30 most recent commits that TOUCH
 *      the path, which is not "the last 30 commits". At the 2026-11-13 base the
 *      window actually spanned 39 first-parent commits, which is why the
 *      published p50 (7591 B) disagreed with the per-PR median of the same 30
 *      commits (2845 B). The window is now literally the last N first-parent
 *      commits; commits that add no evidence are reported as such instead of
 *      being silently skipped.
 *
 * WHAT ONE ROW MEANS. For a commit C, `bytes` is the total size, AT C, of the
 * evidence files C changed (added, modified or renamed). For an added file that
 * is exact; for a modified file it is the new size, i.e. an upper bound on the
 * bytes actually added. That definition is deliberate: it answers "how large is
 * the evidence footprint this PR leaves", which is what a per-PR budget means,
 * and it is stable for binary files and renames. It is NOT a diff size.
 *
 * USAGE
 *   node scripts/evidence-budget.mjs [--commits 30] [--rev origin/master] [--cap-mb 2] [--json]
 *   node scripts/evidence-budget.mjs --dirs [--cap-mb 2] [--top 10]
 *   node scripts/evidence-budget.mjs --input fixture.json    # offline
 *   node scripts/evidence-budget.mjs --self-test
 *
 * Exit 0 always for measurement (a report is not a verdict); exit 2 when git or
 * the directory cannot be read.
 */
import process from 'node:process'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { join, resolve } from 'node:path'
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
 *
 * `withEvidence` is the count of rows whose bytes > 0: the percentiles describe
 * PRs that actually shipped evidence, while `count` says how many commits were
 * examined. Reporting both keeps "the last 30 commits" and "the last 30
 * evidence-bearing commits" from being confused again.
 */
export function summarize(rows, capBytes = 2 * MIB) {
  const clean = (Array.isArray(rows) ? rows : [])
    .filter((r) => r && Number.isFinite(r.bytes))
    .map((r) => ({ ...r, bytes: Math.max(0, r.bytes) }))
  const withEvidence = clean.filter((r) => r.bytes > 0)
  const sorted = withEvidence.map((r) => r.bytes).sort((a, b) => a - b)
  const over = clean.filter((r) => r.bytes > capBytes).sort((a, b) => b.bytes - a.bytes)
  return {
    count: clean.length,
    withEvidence: withEvidence.length,
    totalBytes: clean.reduce((s, r) => s + r.bytes, 0),
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

/** Parse `git ls-tree -r -l <rev> -- <path>` into [{path, bytes}]. */
export function parseLsTree(text) {
  const rows = []
  for (const line of String(text).split('\n')) {
    if (!line.trim()) continue
    const tab = line.indexOf('\t')
    if (tab < 0) continue
    const meta = line.slice(0, tab).trim().split(/\s+/)
    const size = Number(meta[3])
    if (!Number.isFinite(size)) continue
    rows.push({ path: line.slice(tab + 1), bytes: size })
  }
  return rows
}

/**
 * Parse `git cat-file --batch-check` output into sizes aligned to the INPUT
 * order.
 *
 * `--batch-check` echoes the RESOLVED object name, not the `<rev>:<path>`
 * expression it was given, so the output cannot be mapped back by path. It does
 * preserve input order (documented git behaviour), so pairing by index is the
 * only correct mapping — the first version of this function matched on the path
 * and silently produced zeros for every file.
 */
export function parseBatchCheckOrdered(text, count) {
  const lines = String(text).split('\n').filter((l) => l.trim())
  const sizes = new Array(count).fill(0)
  for (let i = 0; i < Math.min(count, lines.length); i += 1) {
    const m = /^(\S+)\s+(blob|tree|commit|tag|missing)(?:\s+(\d+))?$/.exec(lines[i].trim())
    if (!m) continue
    // `missing` (deleted in this commit) keeps 0 so the path still counts as
    // "touched" without inventing bytes.
    if (m[2] === 'blob') sizes[i] = Number(m[3] ?? 0)
  }
  return sizes
}

/** Group ls-tree rows by their first path segment under the evidence root. */
export function groupByDir(rows, root = EVIDENCE_DIR) {
  const map = new Map()
  for (const r of rows) {
    const rest = r.path.startsWith(`${root}/`) ? r.path.slice(root.length + 1) : r.path
    const dir = rest.includes('/') ? rest.split('/')[0] : rest
    const cur = map.get(dir) ?? { label: dir, bytes: 0, files: 0 }
    cur.bytes += r.bytes
    cur.files += 1
    map.set(dir, cur)
  }
  return [...map.values()].sort((a, b) => b.bytes - a.bytes)
}

// ------------------------------------------------------------------- live

function git(args, input) {
  return execFileSync('git', args, { encoding: 'utf8', input, maxBuffer: 128 * 1024 * 1024 })
}

/**
 * Paths changed by `sha` against its first parent, under the evidence root.
 *
 * `diff-tree --root` rather than `diff ${sha}^ ${sha}`: a root commit has no
 * parent, and the first version silently produced `commits=0 / 0 bytes` for a
 * one-commit repository — a false zero of exactly the kind this tool exists to
 * remove.
 */
export function changedEvidencePaths(sha) {
  const out = git(['diff-tree', '-r', '--root', '--no-commit-id', '--name-only', '-z', sha, '--', EVIDENCE_DIR])
  return out.split('\0').filter(Boolean)
}

/** Real bytes (from the object DB) of those paths AT `sha`. */
export function bytesAtCommit(sha, paths) {
  if (paths.length === 0) return { bytes: 0, files: 0 }
  const input = paths.map((p) => `${sha}:${p}`).join('\n')
  const sizes = parseBatchCheckOrdered(git(['cat-file', '--batch-check'], input), paths.length)
  let bytes = 0
  for (const s of sizes) bytes += s
  return { bytes, files: paths.length }
}

export function commitsReport(count = 30, capBytes = 2 * MIB, rev = 'origin/master') {
  const shas = git(['log', '--first-parent', `-n${count}`, '--format=%H', rev])
    .trim().split('\n').filter(Boolean)
  const rows = []
  for (const sha of shas) {
    let subject = ''
    try {
      subject = git(['log', '-1', '--format=%s', sha]).trim()
    } catch { /* shallow boundary */ }
    let paths = []
    try {
      paths = changedEvidencePaths(sha)
    } catch {
      continue // root commit / shallow boundary: not a measurable change set
    }
    const { bytes, files } = bytesAtCommit(sha, paths)
    rows.push({ sha, subject, bytes, files })
  }
  return { mode: 'commits', window: count, rows, summary: summarize(rows, capBytes) }
}

export function dirsReport(root = EVIDENCE_DIR, capBytes = 2 * MIB) {
  const rows = groupByDir(parseLsTree(git(['ls-tree', '-r', '-l', 'HEAD', '--', root])), root)
  return { mode: 'dirs', rows, summary: summarize(rows, capBytes) }
}

function walkWorktree(dir, acc) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name)
    if (e.isDirectory()) walkWorktree(p, acc)
    else if (e.isFile()) {
      try {
        acc.bytes += statSync(p).size
        acc.files += 1
      } catch { /* unreadable: 0, never fatal */ }
    }
  }
}

/** Worktree mode is separate and labelled: it counts untracked/ignored files. */
export function worktreeDirsReport(root = EVIDENCE_DIR, capBytes = 2 * MIB) {
  const rows = []
  for (const e of readdirSync(root, { withFileTypes: true })) {
    const p = join(root, e.name)
    const acc = { bytes: 0, files: 0 }
    if (e.isDirectory()) walkWorktree(p, acc)
    else if (e.isFile()) {
      try { acc.bytes = statSync(p).size; acc.files = 1 } catch { /* ignore */ }
    }
    rows.push({ label: e.name, bytes: acc.bytes, files: acc.files })
  }
  rows.sort((a, b) => b.bytes - a.bytes)
  return { mode: 'dirs', scope: 'worktree', rows, summary: summarize(rows, capBytes) }
}

// ---------------------------------------------------------------- render

export function render(result, top = 10) {
  const s = result.summary
  const lines = []
  if (result.mode === 'commits') {
    lines.push(`evidence-budget (last ${result.window} first-parent commits, bytes of the evidence files each commit leaves):`)
    for (const r of result.rows.slice().sort((a, b) => b.bytes - a.bytes).slice(0, top)) {
      lines.push(`  ${formatBytes(r.bytes).padStart(10)}  ${String(r.files).padStart(3)} file(s)  ${r.sha.slice(0, 10)}  ${r.subject.slice(0, 72)}`)
    }
    lines.push(`  commits=${s.count} with_evidence=${s.withEvidence} p50=${s.p50} p90=${s.p90} max=${s.max} cap=${s.capBytes} over_cap=${s.overCapCount}`)
    lines.push(`DSH-EVIDENCE-BUDGET mode=commits n=${s.count} with_evidence=${s.withEvidence} p50=${s.p50} p90=${s.p90} max=${s.max} cap=${s.capBytes} over_cap=${s.overCapCount}`)
  } else {
    lines.push(`evidence-budget (accumulated per top-level evidence directory, scope=${result.scope ?? 'git'}):`)
    for (const r of result.rows.slice(0, top)) {
      lines.push(`  ${formatBytes(r.bytes).padStart(10)}  ${String(r.files).padStart(4)} file(s)  ${r.label}`)
    }
    lines.push(`  dirs=${s.count} total=${formatBytes(s.totalBytes)} p50=${s.p50} p90=${s.p90} max=${s.max} cap=${s.capBytes} over_cap=${s.overCapCount}`)
    lines.push(`DSH-EVIDENCE-BUDGET mode=dirs scope=${result.scope ?? 'git'} n=${s.count} total_bytes=${s.totalBytes} over_cap=${s.overCapCount}`)
  }
  return lines.join('\n')
}

// --------------------------------------------------------------------- cli

function parseArgs(argv) {
  const opts = { commits: 30, capMb: 2, top: 10, rev: 'origin/master', dirs: false, worktree: false, json: false, input: null, selfTest: false, help: false }
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i]
    if (a === '--commits') opts.commits = Number(argv[++i])
    else if (a === '--cap-mb') opts.capMb = Number(argv[++i])
    else if (a === '--top') opts.top = Number(argv[++i])
    else if (a === '--rev') opts.rev = argv[++i]
    else if (a === '--dirs') opts.dirs = true
    else if (a === '--worktree') opts.worktree = true
    else if (a === '--json') opts.json = true
    else if (a === '--input') opts.input = argv[++i]
    else if (a === '--self-test') opts.selfTest = true
    else if (a === '--help' || a === '-h') opts.help = true
    else throw new Error(`unknown argument ${a}`)
  }
  if (!Number.isInteger(opts.commits) || opts.commits <= 0) throw new Error('--commits needs a positive integer')
  if (!Number.isFinite(opts.capMb) || opts.capMb < 0) throw new Error('--cap-mb needs a non-negative number')
  return opts
}

function selfTest() {
  const cases = []
  // Binary evidence: the old numstat parser recorded 0 for a binary blob.
  const ls = '100644 blob aaaa\tdev/agent-workflow/evidence/x/a.png\n100644 blob bbbb\tdev/agent-workflow/evidence/x/run.json\n'
  const parsed = parseLsTree(ls.replace(/\t/g, '     123\t'))
  cases.push(['ls-tree sizes', parsed.length === 2 && parsed[0].bytes === 123, JSON.stringify(parsed)])
  const batch = parseBatchCheckOrdered('391a9c3b blob 4096\n391a9c3b missing\n391a9c3b blob 12\n', 3)
  cases.push(['binary counted, missing = 0, order preserved', batch[0] === 4096 && batch[1] === 0 && batch[2] === 12, JSON.stringify(batch)])
  const s = summarize([{ bytes: 0 }, { bytes: 10 }, { bytes: 100 }], 50)
  cases.push(['zeros excluded from percentiles', s.count === 3 && s.withEvidence === 2 && s.p50 === 10 && s.overCapCount === 1, JSON.stringify(s)])
  const grouped = groupByDir([
    { path: 'dev/agent-workflow/evidence/a/x', bytes: 10 },
    { path: 'dev/agent-workflow/evidence/a/y', bytes: 20 },
    { path: 'dev/agent-workflow/evidence/b/z', bytes: 5 },
  ])
  cases.push(['group by top dir', grouped[0].label === 'a' && grouped[0].bytes === 30 && grouped[1].bytes === 5, JSON.stringify(grouped)])
  cases.push(['percentile nearest rank', percentile([1, 2, 3, 4], 50) === 2 && percentile([], 50) === 0, 'p50(1..4)=2'])
  let bad = 0
  for (const [label, ok, detail] of cases) {
    if (!ok) bad += 1
    process.stdout.write(`  ${ok ? 'ok  ' : 'FAIL'} ${label}${ok ? '' : `: ${detail}`}\n`)
  }
  process.stdout.write(`DSH-EVIDENCE-BUDGET-SELFTEST ${bad === 0 ? 'PASS' : 'FAIL'} cases=${cases.length} failed=${bad}\n`)
  return bad === 0 ? 0 : 1
}

function main() {
  const opts = parseArgs(process.argv.slice(2))
  if (opts.help) {
    process.stdout.write('usage: node scripts/evidence-budget.mjs [--commits N] [--rev R] [--cap-mb X] [--json]\n' +
      '       node scripts/evidence-budget.mjs --dirs [--worktree] [--top N]\n' +
      '       node scripts/evidence-budget.mjs --self-test\n')
    return 0
  }
  if (opts.selfTest) return selfTest()
  const capBytes = Math.round(opts.capMb * MIB)
  let result
  try {
    if (opts.input) {
      result = JSON.parse(readFileSync(resolve(opts.input), 'utf8'))
    } else if (opts.dirs) {
      result = opts.worktree ? worktreeDirsReport(EVIDENCE_DIR, capBytes) : dirsReport(EVIDENCE_DIR, capBytes)
    } else {
      result = commitsReport(opts.commits, capBytes, opts.rev)
    }
  } catch (e) {
    process.stdout.write(`ERROR MEASURE_FAILED ${e?.message ?? e}\n`)
    return 2
  }
  if (opts.json) process.stdout.write(`${JSON.stringify(result, null, 2)}\n`)
  else process.stdout.write(`${render(result, opts.top)}\n`)
  return 0
}

const invokedDirectly = process.argv[1] !== undefined && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))
if (invokedDirectly) process.exit(main())
