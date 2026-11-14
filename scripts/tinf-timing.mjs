#!/usr/bin/env node
/**
 * tinf-timing — the harness-level clock the Actions step split cannot see.
 *
 * WHY THIS EXISTS. `scripts/census-profile.mjs` (M0) reads the Actions jobs API, which exposes
 * one step per phase: it measured census 1108 s of a 1422 s job (78%), host build 272 s (19%),
 * repo build 22 s (1.6%) on run 43459947311. Everything ABOVE the census step is therefore
 * already measured; what no step exposes is the split of that one census step into its nine
 * roots. `census-profile.mjs` says so in its own output ("needs a harness-level timer (M3)").
 * This file is that timer: it records what the harness itself executes, as rows, so the nine-root
 * decomposition stops being a guess.
 *
 * WHAT IT MEASURES. Whatever the CALLER wraps with `time(phase, root, fn)` — one row per call,
 * duration from a monotonic clock (`process.hrtime.bigint()`; `Date.now()` is used only for the
 * row's `started_at` wall-clock stamp, never for a duration). `scripts/ci-pr-gate.mjs` wraps:
 *   phase=leg             root=<leg name>       each gate leg the process runs
 *   phase=census-capture  root=nine-roots       each vitest capture attempt (the census step)
 *   phase=census-root     root=<root dir>       DERIVED, see below — not an hrtime span
 *
 * THE ONE DEVIATION FROM "WRAP THE ROOT LOOP": there is no root loop to wrap. The nine roots run
 * CONCURRENTLY inside ONE `vitest run` (root `vitest.config.ts` include: `packages/<pkg>/test/**` plus
 * two lane directories; the config's own comment: "the census single-capture runs nine package
 * roots concurrently"). A per-root `hrtime` span around a non-existent loop would be an invention.
 * So `census-root` rows are DERIVED from the vitest JSON report's per-file `startTime`/`endTime`
 * (the reporter writes them; verified against vitest 4.1.11 in this repo): a root's row is the
 * WINDOW `max(endTime) - min(startTime)` over that root's files in that attempt. Windows overlap,
 * which is why the summarizer reports a root's share as a fraction of the capture wall clock and
 * says out loud that the shares do not sum to 100%. Rows derived this way are labelled in `phase`
 * (`census-root`), so a reader never mistakes them for monotonic-clock spans.
 *
 * SCHEMA. `tinf-timing/1`, one row per phase, tab-separated, exactly these nine columns:
 *   schema  run_id  phase  root  attempt  started_at  duration_ms  status  identity
 *     schema      always `tinf-timing/1`
 *     run_id      caller's run identifier (the gate uses <stamp>-<pid>)
 *     phase       `[a-z][a-z0-9-]*`; known values: leg, census-capture, census-root
 *     root        what the phase ran on: a leg name, `nine-roots`, or a root directory
 *     attempt     1-based integer (capture attempt / re-sample index)
 *     started_at  ISO-8601 UTC wall clock (`...Z`); a stamp, never a duration source
 *     duration_ms non-negative integer milliseconds (monotonic clock, rounded; derived rows are
 *                 the report's integer span)
 *     status      `ok` | `failed` (a wrapped call that threw / a root with no readable span)
 *     identity    `key=value` pairs joined by `;` (host_commit, product_merge_tree, head, …).
 *                 Values are percent-encoded so a value can never break the row.
 * A row that fails any of these rules makes the summarizer REFUSE the file by line number: a
 * half-parsed timing file is not a smaller measurement, it is a wrong one.
 *
 * COLD vs WARM: the schema carries no thermal label, so the report does NOT group cold/warm — it
 * says one line stating that it cannot. Inventing a split from `attempt` would be exactly the kind
 * of unsupported attribution this milestone exists to remove.
 *
 * USAGE
 *   node scripts/tinf-timing.mjs --summarize <dir-or-tsv> [...] [--json]
 *   node scripts/tinf-timing.mjs --self-test
 *
 * Exit 0 on a report; exit 2 with a named REFUSED line when the input is empty, foreign, has a
 * bad/unknown row, or contains no census-phase row (a zero-second report is a wrong answer, the
 * same rule census-profile.mjs follows).
 */
import process from 'node:process'
import { appendFileSync, mkdirSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

export const SCHEMA = 'tinf-timing/1'
export const COLUMNS = ['schema', 'run_id', 'phase', 'root', 'attempt', 'started_at', 'duration_ms', 'status', 'identity']
/** The phases a census decomposition is made of. A `leg` row named census is NOT one. */
export const CENSUS_PHASES = new Set(['census-capture', 'census-root'])
/** Rows whose duration is derived from a report window, not a monotonic span. */
export const DERIVED_PHASES = new Set(['census-root'])
export const STATUSES = new Set(['ok', 'failed'])

const PHASE_RE = /^[a-z][a-z0-9-]*$/
const ISO_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/
const HEADER = `${COLUMNS.join('\t')}\n`

/** One field, safe for a tab-separated row: no tab, no newline, no empty cell. */
function cell(v) {
  const s = String(v ?? '').replace(/[\t\r\n]+/g, ' ')
  return s === '' ? '-' : s
}

/** `key=value` pairs, values percent-encoded so neither `;` nor `=` in a value can split a pair. */
export function encodeIdentity(pairs) {
  if (pairs === null || pairs === undefined) return '-'
  if (typeof pairs === 'string') return cell(pairs)
  const keys = Object.keys(pairs).filter((k) => pairs[k] !== undefined && pairs[k] !== null && pairs[k] !== '')
  if (keys.length === 0) return '-'
  return keys.sort().map((k) => `${k}=${encodeURIComponent(String(pairs[k]))}`).join(';')
}

/**
 * The recorder. `dir` is where `tinf-timing.tsv` goes; a null/absent dir makes it a silent no-op
 * (the default gate run writes no file). EVERY failure to record becomes a warning on `flush()`
 * — never an exception, because a broken clock must not turn a census green into a census red.
 */
export function createTimer({ dir = null, runId = null, identity = null, file = 'tinf-timing.tsv' } = {}) {
  const rows = []
  const warnings = []
  let path = null
  let headerWritten = false
  let stopped = false

  if (dir !== null && dir !== undefined && String(dir) !== '') {
    try {
      mkdirSync(dir, { recursive: true })
      path = join(dir, file)
    } catch (e) {
      stopped = true
      warnings.push(`TIMING_DIR_UNWRITABLE: ${String(dir)}: ${String(e && e.message ? e.message : e)}`)
    }
  }

  const warn = (message) => {
    // First occurrence of each distinct message only: a row-by-row echo of one broken dir would
    // bury the census output it is supposed to annotate.
    if (!warnings.includes(message)) warnings.push(message)
  }

  const writeRow = (row) => {
    if (path === null || stopped) return
    try {
      const line = `${COLUMNS.map((c) => cell(row[c])).join('\t')}\n`
      appendFileSync(path, headerWritten ? line : HEADER + line)
      headerWritten = true
    } catch (e) {
      stopped = true
      warn(`TIMING_WRITE_FAILED: ${path}: ${String(e && e.message ? e.message : e)}`)
    }
  }

  const push = ({ phase, root, attempt = 1, startedAt = null, durationMs, status, identity: rowIdentity = null }) => {
    const row = {
      schema: SCHEMA,
      run_id: cell(runId ?? 'unassigned'),
      phase: String(phase),
      root: String(root),
      attempt: String(attempt),
      started_at: startedAt ?? new Date().toISOString(),
      duration_ms: String(Math.max(0, Math.round(Number(durationMs)))),
      status: String(status),
      identity: encodeIdentity(rowIdentity ?? identity),
    }
    rows.push(row)
    writeRow(row)
    return row
  }

  return {
    /** Where rows go (null when no dir was given). */
    get path() { return path },
    /** Rows recorded so far (already written through when a dir is writable). */
    get rows() { return rows.slice() },
    /** Record a row the caller measured itself (e.g. a span derived from a report). */
    record(row) {
      try {
        return push(row)
      } catch (e) {
        warn(`TIMING_RECORD_FAILED: ${String(e && e.message ? e.message : e)}`)
        return null
      }
    },
    warn,
    /**
     * Time `fn`. Sync fns stay SYNC (the return value is passed through, not wrapped in a
     * promise), so wrapping a leg cannot reorder the gate's output. A thrown error is recorded as
     * `failed` and re-thrown; a rejected promise likewise.
     */
    time(phase, root, fn, opts = {}) {
      const startedAt = new Date().toISOString()
      const t0 = process.hrtime.bigint()
      const done = (status) => {
        try {
          push({
            phase,
            root,
            attempt: opts.attempt ?? 1,
            startedAt,
            durationMs: Number(process.hrtime.bigint() - t0) / 1e6,
            status,
            identity: opts.identity ?? null,
          })
        } catch (e) {
          warn(`TIMING_RECORD_FAILED: ${String(e && e.message ? e.message : e)}`)
        }
      }
      let out
      try {
        out = fn()
      } catch (e) {
        done('failed')
        throw e
      }
      if (out !== null && typeof out === 'object' && typeof out.then === 'function') {
        return out.then((v) => { done('ok'); return v }, (e) => { done('failed'); throw e })
      }
      done('ok')
      return out
    },
    /**
     * Finish. Idempotent, never throws. Returns the file path, the row count and the warnings;
     * when a dir was given but nothing was recorded the file is created with its header, so an
     * empty timing file is an empty measurement rather than a missing one.
     */
    flush() {
      if (path !== null && !headerWritten && !stopped) {
        try {
          appendFileSync(path, HEADER)
          headerWritten = true
        } catch (e) {
          warn(`TIMING_WRITE_FAILED: ${path}: ${String(e && e.message ? e.message : e)}`)
        }
      }
      return { path, rows: rows.length, warnings: warnings.slice() }
    },
  }
}

/**
 * DERIVED census-root rows from a vitest JSON report. One row per root directory, duration =
 * `max(endTime) - min(startTime)` over that root's files in this attempt (windows overlap; the
 * summarizer says so). A file with no readable `startTime`/`endTime` is skipped and makes its
 * root's row `failed` only when the root has no readable file at all — a partially timed root is
 * still a measurement, and its status says which.
 */
export function rowsFromVitestReport(report, { attempt = 1 } = {}) {
  const files = Array.isArray(report?.testResults) ? report.testResults : []
  const byRoot = new Map()
  for (const f of files) {
    const name = String(f?.name ?? '')
    const a = Number(f?.startTime)
    const b = Number(f?.endTime)
    const root = rootOf(name)
    if (!byRoot.has(root)) byRoot.set(root, { starts: [], ends: [], files: 0, timed: 0 })
    const acc = byRoot.get(root)
    acc.files += 1
    if (Number.isFinite(a) && Number.isFinite(b) && b >= a && a > 0) {
      acc.starts.push(a)
      acc.ends.push(b)
      acc.timed += 1
    }
  }
  const rows = []
  for (const [root, acc] of byRoot) {
    if (acc.timed === 0) {
      rows.push({ root, attempt, startedAt: null, durationMs: 0, status: 'failed', files: acc.files })
      continue
    }
    const start = Math.min(...acc.starts)
    const end = Math.max(...acc.ends)
    rows.push({
      root,
      attempt,
      startedAt: new Date(start).toISOString(),
      durationMs: end - start,
      status: acc.timed === acc.files ? 'ok' : 'failed',
      files: acc.files,
    })
  }
  return rows.sort((x, y) => (x.root < y.root ? -1 : x.root > y.root ? 1 : 0))
}

/**
 * The census root a test file belongs to. Vitest reports ABSOLUTE paths, so the `/packages/`
 * anchor is what makes the root a stable name (`packages/domain`) instead of a runner-specific
 * absolute prefix — a report whose roots carried `/home/runner/work/...` would not be comparable
 * between runs.
 *   packages/runtime/controlled-fs/test/x.test.ts -> packages/runtime/controlled-fs
 *   packages/domain/test/y.test.ts                -> packages/domain
 */
export function rootOf(file) {
  const p = String(file ?? '').replace(/\\/g, '/')
  const pkgs = p.lastIndexOf('/packages/')
  const rel = pkgs >= 0 ? p.slice(pkgs + 1) : p
  const i = rel.lastIndexOf('/test/')
  if (i > 0) return rel.slice(0, i)
  const j = rel.indexOf('/test/')
  if (j > 0) return rel.slice(0, j)
  return rel === '' ? 'unknown' : rel
}

// ───────────────────────────────────────────────────────────────────────── parsing ──

/** Strict row parser. Returns {rows, problems}; a problem names the file and 1-based line. */
export function parseRows(text, { file = '<memory>' } = {}) {
  const rows = []
  const problems = []
  const lines = String(text ?? '').split('\n')
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i]
    if (line.trim() === '') continue
    if (i === 0 && line.split('\t')[0] === 'schema') continue
    const bad = (reason) => problems.push({ file, line: i + 1, reason, text: line.slice(0, 200) })
    const cells = line.split('\t')
    if (cells.length !== COLUMNS.length) {
      bad(`BAD_ROW expected ${String(COLUMNS.length)} columns, got ${String(cells.length)}`)
      continue
    }
    const row = Object.fromEntries(COLUMNS.map((c, k) => [c, cells[k]]))
    if (row.schema !== SCHEMA) { bad(`BAD_SCHEMA expected ${SCHEMA}, got ${row.schema}`); continue }
    if (!PHASE_RE.test(row.phase)) { bad(`BAD_PHASE ${JSON.stringify(row.phase)} is not [a-z][a-z0-9-]*`); continue }
    if (row.root.trim() === '' || row.root === '-') { bad('BAD_ROOT empty root'); continue }
    if (!/^[1-9]\d*$/.test(row.attempt)) { bad(`BAD_ATTEMPT ${JSON.stringify(row.attempt)} is not a positive integer`); continue }
    if (!ISO_RE.test(row.started_at) || !Number.isFinite(Date.parse(row.started_at))) { bad(`BAD_TIMESTAMP ${JSON.stringify(row.started_at)} is not ISO-8601 UTC`); continue }
    if (!/^\d+$/.test(row.duration_ms)) { bad(`BAD_DURATION ${JSON.stringify(row.duration_ms)} is not a non-negative integer`); continue }
    if (!STATUSES.has(row.status)) { bad(`BAD_STATUS ${JSON.stringify(row.status)} is not ok|failed`); continue }
    rows.push({
      schema: row.schema,
      run_id: row.run_id,
      phase: row.phase,
      root: row.root,
      attempt: Number(row.attempt),
      started_at: row.started_at,
      duration_ms: Number(row.duration_ms),
      status: row.status,
      identity: row.identity,
    })
  }
  return { rows, problems }
}

/** `dir` -> its *.tsv files (sorted); a file -> itself. Missing path is a named refusal. */
export function collectInputs(paths) {
  const files = []
  for (const p of paths) {
    const abs = resolve(process.cwd(), p)
    let st
    try {
      st = statSync(abs)
    } catch {
      return { files: [], problems: [{ file: p, line: 0, reason: `INPUT_UNREADABLE ${p} does not exist` }] }
    }
    if (st.isDirectory()) {
      for (const name of readdirSync(abs).sort()) {
        if (name.endsWith('.tsv')) files.push(join(abs, name))
      }
    } else {
      files.push(abs)
    }
  }
  return { files, problems: [] }
}

/** Nearest-rank percentile over ascending numbers (same rule as census-profile.mjs). */
export function percentile(sorted, p) {
  if (!Array.isArray(sorted) || sorted.length === 0) return 0
  if (p <= 0) return sorted[0]
  if (p >= 100) return sorted[sorted.length - 1]
  const rank = Math.ceil((p / 100) * sorted.length) - 1
  return sorted[Math.max(0, Math.min(sorted.length - 1, rank))]
}

function stats(values) {
  const sorted = values.slice().sort((a, b) => a - b)
  return { n: sorted.length, median_ms: percentile(sorted, 50), p90_ms: percentile(sorted, 90), sum_ms: sorted.reduce((a, b) => a + b, 0) }
}

/**
 * Aggregate. Shares are stated against an explicit denominator, never a silent one:
 *   - phase rows:   share_pct = phase sum / sum of all NON-derived rows (census-root rows are
 *                   windows over the same wall clock and would double count).
 *   - census roots: share_of_capture_pct = root median / median census-capture attempt. Roots run
 *                   concurrently, so these shares overlap and may sum past 100% — the report says so.
 * Cold/warm is NOT grouped: the schema has no thermal label.
 */
export function summarize(rows, { files = [], problems = [] } = {}) {
  const list = Array.isArray(rows) ? rows : []
  const byPhase = new Map()
  const byRoot = new Map()
  for (const r of list) {
    if (!byPhase.has(r.phase)) byPhase.set(r.phase, [])
    byPhase.get(r.phase).push(r.duration_ms)
    if (r.phase === 'census-root') {
      if (!byRoot.has(r.root)) byRoot.set(r.root, [])
      byRoot.get(r.root).push(r.duration_ms)
    }
  }
  const baseSum = list.filter((r) => !DERIVED_PHASES.has(r.phase)).reduce((a, r) => a + r.duration_ms, 0)
  const phases = [...byPhase.entries()]
    .map(([phase, values]) => {
      const s = stats(values)
      // A derived phase (census-root) has no share here: its windows overlap the capture they were
      // derived from, so a percentage against the non-derived denominator would be a double count.
      return { phase, ...s, share_pct: DERIVED_PHASES.has(phase) || baseSum === 0 ? null : Math.round((100 * s.sum_ms) / baseSum) }
    })
    .sort((a, b) => b.sum_ms - a.sum_ms || a.phase.localeCompare(b.phase))
  const captures = list.filter((r) => r.phase === 'census-capture').map((r) => r.duration_ms)
  const captureMedian = percentile(captures.slice().sort((a, b) => a - b), 50)
  const censusRoots = [...byRoot.entries()]
    .map(([root, values]) => {
      const s = stats(values)
      return { root, ...s, share_of_capture_pct: captureMedian === 0 ? null : Math.round((100 * s.median_ms) / captureMedian) }
    })
    .sort((a, b) => b.median_ms - a.median_ms || a.root.localeCompare(b.root))
  return {
    schema: SCHEMA,
    files,
    rows: list.length,
    problems,
    run_ids: [...new Set(list.map((r) => r.run_id))].sort(),
    phases,
    census_roots: censusRoots,
    census_total_ms: captures.reduce((a, b) => a + b, 0),
    census_capture_median_ms: captureMedian,
    census_attempts: [...new Set(list.filter((r) => CENSUS_PHASES.has(r.phase)).map((r) => r.attempt))].sort((a, b) => a - b),
    cold_warm: 'not-distinguished',
    notes: [
      'census-root rows are DERIVED windows (max(end)-min(start) of that root\'s files in one vitest attempt), not hrtime spans; the nine roots run concurrently, so root shares overlap and do not sum to 100%.',
      'cold/warm is not distinguished: tinf-timing/1 rows carry no thermal label, so no split is inferred from attempt index.',
      'phases above the census (host provision/build, repo build, security suite) run as workflow YAML steps, not in the process that writes these rows; they are measured by scripts/census-profile.mjs from the Actions step API, not here.',
    ],
  }
}

/** True when the rows carry at least one census-phase row (the refusal condition). */
export function hasCensusRows(rows) {
  return (Array.isArray(rows) ? rows : []).some((r) => CENSUS_PHASES.has(r.phase))
}

export function verdictToken(report) {
  const top = report.census_roots[0]
  return `DSH-TINF-TIMING rows=${report.rows} run_ids=${report.run_ids.length} census_capture_ms=${report.census_total_ms}` +
    ` top_root=${top ? JSON.stringify(top.root) : 'none'} top_median_ms=${top?.median_ms ?? 0}` +
    ` top_share_of_capture_pct=${top?.share_of_capture_pct ?? 'n/a'}`
}

export function render(report) {
  const lines = []
  lines.push(`tinf-timing (${SCHEMA}) files=${String(report.files.length)} rows=${String(report.rows)} runs=${String(report.run_ids.length)}${report.run_ids.length ? ` [${report.run_ids.join(', ')}]` : ''}`)
  lines.push('phases (share = phase sum / sum of non-derived rows; census-root rows are derived windows and excluded from the denominator):')
  lines.push('       n  median_ms    p90_ms      sum_ms  share  phase')
  for (const p of report.phases) {
    const share = p.share_pct === null ? 'n/a' : `${String(p.share_pct)}%`
    lines.push(`  ${String(p.n).padStart(5)}  ${String(p.median_ms).padStart(9)}  ${String(p.p90_ms).padStart(9)}  ${String(p.sum_ms).padStart(11)}  ${share.padStart(4)}  ${p.phase}`)
  }
  lines.push('census roots (window per root per attempt; roots run concurrently, so shares overlap and may sum past 100%):')
  lines.push('       n  median_ms    p90_ms  share_of_capture  root')
  if (report.census_roots.length === 0) {
    lines.push('       0          -         -                 -  (no census-root rows in the input)')
  }
  for (const r of report.census_roots) {
    lines.push(`  ${String(r.n).padStart(5)}  ${String(r.median_ms).padStart(9)}  ${String(r.p90_ms).padStart(9)}  ${String(r.share_of_capture_pct === null ? 'n/a' : `${String(r.share_of_capture_pct)}%`).padStart(15)}  ${r.root}`)
  }
  lines.push(`census wall clock: ${String(report.census_total_ms)} ms across ${String(report.census_attempts.length)} attempt(s) [${report.census_attempts.join(', ')}]`)
  lines.push('cold/warm: NOT distinguished — tinf-timing/1 rows carry no thermal label, so no split is inferred.')
  lines.push('not measured here: host provision/build, repo build, security suite (workflow YAML steps, not this process) — see scripts/census-profile.mjs.')
  lines.push(verdictToken(report))
  return lines.join('\n')
}

// ───────────────────────────────────────────────────────────────────────────── cli ──

const HELP = [
  'usage: node scripts/tinf-timing.mjs --summarize <dir-or-tsv> [...] [--json]',
  '       node scripts/tinf-timing.mjs --self-test',
  '',
  '  --summarize PATH...  one or more tinf-timing.tsv files or directories holding *.tsv',
  '  --json               machine-readable report on stdout',
  '  --self-test          pin the parser, the refusal set and the arithmetic',
  '',
].join('\n')

function selfTest() {
  const cases = []
  const ok = (label, cond, detail = '') => cases.push([label, cond, detail])
  const rowsText = (rows) => HEADER + rows.map((r) => COLUMNS.map((c) => cell(r[c])).join('\t')).join('\n') + '\n'
  const base = {
    schema: SCHEMA, run_id: 'r1', phase: 'census-capture', root: 'nine-roots', attempt: '1',
    started_at: '2026-11-14T00:00:00.000Z', duration_ms: '1000', status: 'ok', identity: 'head=abc',
  }
  const good = parseRows(rowsText([base]))
  ok('a well-formed row parses', good.rows.length === 1 && good.problems.length === 0, JSON.stringify(good))
  ok('duration is a number after parse', good.rows[0].duration_ms === 1000, String(good.rows[0].duration_ms))
  ok('attempt is a number after parse', good.rows[0].attempt === 1, String(good.rows[0].attempt))

  const badDuration = parseRows(rowsText([{ ...base, duration_ms: '12.5' }]))
  ok('a non-integer duration is refused', badDuration.problems[0]?.reason.startsWith('BAD_DURATION'), JSON.stringify(badDuration.problems))
  const negative = parseRows(rowsText([{ ...base, duration_ms: '-1' }]))
  ok('a negative duration is refused', negative.problems[0]?.reason.startsWith('BAD_DURATION'), JSON.stringify(negative.problems))
  const badStatus = parseRows(rowsText([{ ...base, status: 'maybe' }]))
  ok('an unknown status is refused', badStatus.problems[0]?.reason.startsWith('BAD_STATUS'), JSON.stringify(badStatus.problems))
  const badSchema = parseRows('schema\trun_id\tphase\troot\tattempt\tstarted_at\tduration_ms\tstatus\tidentity\nfoo\tbilling/2\tx\ty\t1\t2026-11-14T00:00:00Z\t1\tok\t-\n')
  ok('a foreign schema is refused', badSchema.problems[0]?.reason.startsWith('BAD_SCHEMA'), JSON.stringify(badSchema.problems))
  const short = parseRows(`${HEADER}only\tthree\tcells\n`)
  ok('a row with the wrong column count is refused', short.problems[0]?.reason.startsWith('BAD_ROW'), JSON.stringify(short.problems))
  const noZsuffix = parseRows(rowsText([{ ...base, started_at: '2026-11-14T00:00:00+02:00' }]))
  ok('a non-UTC timestamp is refused', noZsuffix.problems[0]?.reason.startsWith('BAD_TIMESTAMP'), JSON.stringify(noZsuffix.problems))

  const withCensus = summarize([
    { phase: 'census-capture', root: 'nine-roots', attempt: 1, run_id: 'r1', duration_ms: 1000, status: 'ok' },
    { phase: 'census-root', root: 'packages/domain', attempt: 1, run_id: 'r1', duration_ms: 600, status: 'ok' },
    { phase: 'census-root', root: 'packages/runtime', attempt: 1, run_id: 'r1', duration_ms: 400, status: 'ok' },
    { phase: 'leg', root: 'census', attempt: 1, run_id: 'r1', duration_ms: 1100, status: 'ok' },
  ])
  const root = (name) => withCensus.census_roots.find((r) => r.root === name)
  ok('census has a decomposition', withCensus.census_roots.length === 2, JSON.stringify(withCensus.census_roots))
  ok('root share is a fraction of the capture median', root('packages/domain').share_of_capture_pct === 60, JSON.stringify(root('packages/domain')))
  ok('derived rows do not inflate the phase denominator', withCensus.phases.find((p) => p.phase === 'census-capture').share_pct === 48, JSON.stringify(withCensus.phases))
  ok('a derived phase states no share instead of a double count', withCensus.phases.find((p) => p.phase === 'census-root').share_pct === null, JSON.stringify(withCensus.phases))
  ok('census total is the capture sum, not the root sum', withCensus.census_total_ms === 1000, String(withCensus.census_total_ms))
  ok('no cold/warm split is invented', withCensus.cold_warm === 'not-distinguished', withCensus.cold_warm)

  ok('a leg row named census is NOT a census decomposition', hasCensusRows([{ phase: 'leg', root: 'census' }]) === false, 'true')
  ok('empty input has no census rows', hasCensusRows([]) === false, 'false')

  const p = percentile([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 90)
  ok('nearest-rank p90 of 1..10 is 9', p === 9, String(p))

  ok('identity values are percent-encoded so a value cannot break a row', encodeIdentity({ b: 'x;y=z', a: 'q q' }) === 'a=q%20q;b=x%3By%3Dz', encodeIdentity({ b: 'x;y=z', a: 'q q' }))
  ok('an empty identity is a dash, never an empty cell', encodeIdentity({}) === '-', encodeIdentity({}))
  ok('cells cannot carry a tab or newline', cell('a\tb\nc') === 'a b c', JSON.stringify(cell('a\tb\nc')))
  ok('a root is named from the /packages/ anchor, not the runner path', rootOf('/home/runner/work/repo/packages/domain/test/a.test.ts') === 'packages/domain', rootOf('/home/runner/work/repo/packages/domain/test/a.test.ts'))
  ok('a lane root keeps its sub-directory', rootOf('/w/packages/runtime/controlled-fs/test/x.test.ts') === 'packages/runtime/controlled-fs', rootOf('/w/packages/runtime/controlled-fs/test/x.test.ts'))
  const derived = rowsFromVitestReport({
    testResults: [
      { name: '/w/packages/domain/test/a.test.ts', startTime: 1000, endTime: 5000 },
      { name: '/w/packages/domain/test/b.test.ts', startTime: 2000, endTime: 7000 },
      { name: '/w/packages/storage/test/c.test.ts', startTime: 1500, endTime: 9000 },
    ],
  }, { attempt: 2 })
  ok('a root window is max(end)-min(start) over its files', derived.find((r) => r.root === 'packages/domain').durationMs === 6000, JSON.stringify(derived))
  ok('a derived row keeps the attempt it came from', derived.every((r) => r.attempt === 2), 'attempt')
  ok('a root with no readable span is failed, not zero-duration ok', rowsFromVitestReport({ testResults: [{ name: '/w/packages/x/test/a.test.ts', startTime: null, endTime: null }] })[0].status === 'failed', 'failed')

  let bad = 0
  for (const [label, cond, detail] of cases) {
    if (!cond) bad += 1
    process.stdout.write(`  ${cond ? 'ok  ' : 'FAIL'} ${label}${cond ? '' : `: ${detail}`}\n`)
  }
  process.stdout.write(`DSH-TINF-TIMING-SELFTEST ${bad === 0 ? 'PASS' : 'FAIL'} cases=${String(cases.length)} failed=${String(bad)}\n`)
  return bad === 0 ? 0 : 1
}

function refuse(code, detail) {
  process.stdout.write(`REFUSED ${code}: ${detail}\n`)
  return 2
}

function main(argv) {
  const opts = { summarize: null, json: false, selfTest: false, help: false }
  const inputs = []
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i]
    if (a === '--summarize') {
      opts.summarize = true
      while (i + 1 < argv.length && !argv[i + 1].startsWith('--')) inputs.push(argv[++i])
    } else if (a === '--json') opts.json = true
    else if (a === '--self-test') opts.selfTest = true
    else if (a === '--help' || a === '-h') opts.help = true
    else return refuse('UNKNOWN_ARGUMENT', `${a} (see --help)`)
  }
  if (opts.help) { process.stdout.write(HELP); return 0 }
  if (opts.selfTest) return selfTest()
  if (!opts.summarize) return refuse('NO_MODE', 'nothing to do: give --summarize <dir-or-tsv...> or --self-test')
  if (inputs.length === 0) return refuse('NO_INPUT_PATHS', '--summarize was given no path')

  const { files, problems } = collectInputs(inputs)
  if (problems.length > 0) return refuse('NO_INPUT', problems.map((p) => p.reason).join(' ;; '))
  if (files.length === 0) return refuse('NO_INPUT_ROWS', `no *.tsv file under ${inputs.join(', ')} — a zero-second report is a wrong answer`)

  const rows = []
  const rowProblems = []
  for (const file of files) {
    let text
    try {
      text = readFileSync(file, 'utf8')
    } catch (e) {
      return refuse('NO_INPUT', `${file}: ${String(e && e.message ? e.message : e)}`)
    }
    const parsed = parseRows(text, { file })
    rows.push(...parsed.rows)
    rowProblems.push(...parsed.problems)
  }
  if (rowProblems.length > 0) {
    return refuse('BAD_ROW', rowProblems.slice(0, 5).map((p) => `${p.file}:${String(p.line)} ${p.reason}`).join(' ;; ') +
      (rowProblems.length > 5 ? ` ;; (+${String(rowProblems.length - 5)} more)` : ''))
  }
  if (rows.length === 0) return refuse('NO_INPUT_ROWS', `${files.length} file(s), 0 row(s) — an empty timing file measures nothing`)
  if (!hasCensusRows(rows)) {
    return refuse('NO_CENSUS_ROWS',
      `${String(rows.length)} row(s) in ${String(files.length)} file(s) but none with phase census-capture|census-root ` +
      `(phases seen: ${[...new Set(rows.map((r) => r.phase))].join(', ')}) — a census report with no census row is a wrong answer`)
  }
  const report = summarize(rows, { files, problems: [] })
  process.stdout.write(`${opts.json ? JSON.stringify(report, null, 2) : render(report)}\n`)
  return 0
}

const invokedDirectly = process.argv[1] !== undefined && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))
if (invokedDirectly) process.exit(main(process.argv.slice(2)))
