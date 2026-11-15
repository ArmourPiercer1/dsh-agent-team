#!/usr/bin/env node
/**
 * perf-diag-census-profile — per-FILE profile of one census capture, READ-ONLY.
 *
 * WHY THIS EXISTS (task `perf-diag-20261115`). The census's published decomposition stops at the
 * ROOT (`scripts/tinf-timing.mjs` records one `census-root` window per root per capture). That is
 * enough to prove root-level sharding cannot shorten the census (TINF M4) and not enough to say
 * WHERE inside `packages/runtime` (543 s) the time goes. This tool answers the per-file question
 * from signals that already exist, so no product/CI change is needed to measure it:
 *
 *   SOURCE A — the census's own vitest transcript (`census-capture-<n>.txt`, uploaded in the
 *   artifact `census-runtime-transcripts-<run>`). The `default` reporter prints one line per test
 *   file as it finishes: ` ✓ <path> (<n> tests) <ms>ms`, plus (above the reporter's slow-test
 *   threshold) one indented line per slow test. Those lines are the HOSTED runner's real per-file
 *   timing — the thing a local run can only approximate.
 *
 *   SOURCE B — a vitest JSON report (`--reporter=json --outputFile.json=…`). Its shape is
 *   `{startTime, testResults:[{name,startTime,endTime,assertionResults:[{duration,…}]}]}` — i.e.
 *   per-file ABSOLUTE WINDOWS plus per-assertion durations. There is NO `perfTest`/`duration` field
 *   on `testResults` itself (checked against vitest 4.1.11, the version the census pins), so a file
 *   duration is `endTime - startTime` and the windows of concurrently-run files OVERLAP by design.
 *   This is the only source that can say "which files ran at the same time", which is what a
 *   concurrency question needs.
 *
 * WHAT IT COMPUTES
 *   - per-file duration, % of the capture, assertions, assertion-time sum, and `outside`
 *     (= duration − Σ assertion durations: collection/import, hooks, spawned children, sleeps);
 *   - the top-N table;
 *   - aggregates by census root (`rootOf` is imported from `scripts/tinf-timing.mjs`, not copied);
 *   - aggregates by CLASS, decided by reading each test file's own imports/calls:
 *       WORLD  — creates a DSH world / starts a host (world-factory, DSH_HOME, test-use tree);
 *       SPAWN  — spawns a child process but no world;
 *       PURE   — neither (in-process logic).
 *     The class is a property of the SOURCE, computed here so the table is not hand-labelled.
 *
 * WHAT IT DOES NOT DO
 *   - It does not run anything: both sources are files that already exist.
 *   - It does not grade a suite and it writes nothing under `dev/`.
 *
 * USAGE
 *   node tools/perf-diag-census-profile.mjs --transcript <census-capture-1.txt> \
 *        [--capture-seconds 477.7] [--checkout <repoRoot>] [--top 20] [--tsv out.tsv]
 *   node tools/perf-diag-census-profile.mjs --vitest-json <report.json> [--capture-seconds N] …
 *   node tools/perf-diag-census-profile.mjs --self-test
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import process from 'node:process'
import { rootOf } from '../../../../../scripts/tinf-timing.mjs'

const ANSI = /\u001b\[[0-9;]*m/g

/** Strip SGR colour codes: the census transcript is captured with colour on. */
export function stripAnsi(text) {
  return String(text).replace(ANSI, '')
}

/**
 * Parse the `default` reporter's per-file lines out of one capture transcript.
 *
 * The line shape is stable across vitest 3/4: leading mark (`✓`/`✗`/`×`/`❯`), the file path, the
 * assertion count in parentheses and the duration in ms. A file is printed ONCE, when it finishes,
 * so this yields exactly one row per collected file. Indented `✓ <title> <ms>ms` lines are the
 * reporter's slow-test detail and are attached to the file above them (`slow` array) — that is the
 * only in-file breakdown the transcript carries, and a file whose slow tests do not cross the
 * threshold has an empty one (a LIMIT, not a zero).
 *
 * @param {string} text raw transcript bytes
 * @returns {{rows: Array<{file:string,tests:number,ms:number,slow:Array<{title:string,ms:number}>}>, seen: number}}
 */
export function parseTranscript(text) {
  const lines = stripAnsi(text).split(/\r?\n/)
  const fileLine = /^\s*[✓✗×❯✔]\s+(\S+\.(?:test|spec)\.[cm]?[jt]s)\s+\((\d+)\s+tests?\)\s+([\d.]+)ms\s*$/
  const slowLine = /^\s{2,}[✓✗×❯✔]\s+(.+?)\s+([\d.]+)ms\s*$/
  const rows = []
  let seen = 0
  for (const line of lines) {
    const m = line.match(fileLine)
    if (m !== null) {
      seen += 1
      rows.push({ file: m[1].replace(/\\/g, '/'), tests: Number(m[2]), ms: Number(m[3]), slow: [] })
      continue
    }
    const s = line.match(slowLine)
    if (s !== null && rows.length > 0) {
      const last = rows[rows.length - 1]
      const title = s[1].trim()
      // A slow-test line never repeats the file's own `(N tests)` shape; skip anything that does.
      if (!/\(\d+ tests?\)/.test(title)) last.slow.push({ title, ms: Number(s[2]) })
    }
  }
  return { rows, seen }
}

/**
 * Parse a vitest JSON report into the same row shape, with the absolute window kept.
 *
 * `assertion_ms` is the sum of `assertionResults[].duration` — the time the reporter attributes to
 * the test bodies themselves. `outside = duration − assertion_ms` is everything else the file's
 * window held: module import/collection, hooks, child-process waits and sleeps. It is a RESIDUAL,
 * not an attribution: this tool never claims which of those it is.
 *
 * @param {object} report parsed JSON
 * @returns {Array<{file:string,tests:number,ms:number,start:number,end:number,assertion_ms:number,failed:number}>}
 */
export function parseVitestJson(report) {
  const results = Array.isArray(report?.testResults) ? report.testResults : []
  const rows = []
  for (const r of results) {
    const start = Number(r.startTime)
    const end = Number(r.endTime)
    if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) continue
    const assertions = Array.isArray(r.assertionResults) ? r.assertionResults : []
    const assertionMs = assertions.reduce((a, x) => a + (Number.isFinite(Number(x.duration)) ? Number(x.duration) : 0), 0)
    rows.push({
      file: String(r.name ?? '').replace(/\\/g, '/'),
      tests: assertions.length,
      ms: end - start,
      start,
      end,
      assertion_ms: assertionMs,
      failed: assertions.filter((x) => x.status === 'failed').length,
    })
  }
  return rows
}

/**
 * Classify a test file by READING ITS SOURCE. Three classes, mutually exclusive, WORLD winning:
 * a file that creates a world also spawns, and "it created a world" is the stronger statement.
 * A file we cannot read is `UNREADABLE` — never silently PURE.
 *
 * @param {string} root checkout root the file paths are relative to ('' when absolute)
 * @param {string} file repo-relative (or absolute) test path
 * @returns {{class:'WORLD'|'SPAWN'|'PURE'|'UNREADABLE', why:string}}
 */
export function classifySource(root, file) {
  let source
  try {
    source = readFileSync(resolve(root, file), 'utf8')
  } catch {
    return { class: 'UNREADABLE', why: 'source not readable from the checkout given' }
  }
  const world = /world-factory|TestWorldFactory|createWorld|DSH_HOME|deepseek-harness-test-use|testUseTree|apps\/cli\/lib\/bin\.js|provision-host-sandbox/.exec(source)
  if (world !== null) return { class: 'WORLD', why: `matches /${world[0]}/` }
  const spawn = /\b(?:spawn|spawnSync|execFile|execFileSync|execSync)\s*\(|node:child_process/.exec(source)
  if (spawn !== null) return { class: 'SPAWN', why: `matches /${spawn[0]}/` }
  return { class: 'PURE', why: 'no child process, no world' }
}

/** Group rows by a key function, summing durations; order by total descending. */
export function rollup(rows, keyOf) {
  const map = new Map()
  for (const r of rows) {
    const k = keyOf(r)
    const cur = map.get(k) ?? { key: k, files: 0, ms: 0, tests: 0, worst: 0 }
    cur.files += 1
    cur.ms += r.ms
    cur.tests += r.tests
    cur.worst = Math.max(cur.worst, r.ms)
    map.set(k, cur)
  }
  return [...map.values()].sort((a, b) => b.ms - a.ms)
}

/** Nearest-rank percentile over ascending numbers (same rule as tinf-timing.mjs). */
export function pct(sorted, p) {
  if (sorted.length === 0) return 0
  const rank = Math.ceil((p / 100) * sorted.length) - 1
  return sorted[Math.max(0, Math.min(sorted.length - 1, rank))]
}

const s1 = (ms) => (ms / 1000).toFixed(1)
/** Display path: relative to the checkout when the report carries absolute names. */
const relPath = (file, checkout) => {
  if (checkout === null) return file
  const base = String(checkout).replace(/\\/g, '/').replace(/\/$/, '')
  return file.startsWith(base + '/') ? file.slice(base.length + 1) : file
}
const pctOf = (part, whole) => (whole > 0 ? ((100 * part) / whole).toFixed(1) : '0.0')

/**
 * Render the report. `captureSeconds` is the capture's own wall clock (from `tinf-timing.tsv` or
 * the transcript header): every "% of capture" below is share of WORK (Σ file ms), never of wall —
 * files overlap, so Σ file ms / wall is the achieved parallelism and is printed as such.
 */
export function render({ rows, captureSeconds, top, checkout, trace = null }) {
  const totalMs = rows.reduce((a, r) => a + r.ms, 0)
  const sorted = [...rows].sort((a, b) => b.ms - a.ms)
  const out = []
  out.push(`# per-file census profile`)
  out.push(``)
  out.push(`files=${rows.length}  sum_file_seconds=${s1(totalMs)}  capture_wall_seconds=${captureSeconds === null ? 'UNKNOWN' : String(captureSeconds)}`)
  if (captureSeconds !== null && captureSeconds > 0) {
    out.push(`achieved_parallelism = sum_file_ms / capture_wall_ms = ${(totalMs / (captureSeconds * 1000)).toFixed(2)}x`)
  }
  out.push('')
  out.push(`## top ${top} slowest test files`)
  out.push('')
  const hasAssertion = rows.some((r) => r.assertion_ms !== undefined)
  const hasTrace = trace !== null
  const traceOf = (file) => (trace === null ? null : trace.get(file) ?? trace.get(file.replace(/^.*?(?=packages\/|tests\/)/, '')) ?? null)
  const head = ['#', 'file', 'root', 'class', 'seconds', '% of work', 'tests']
  const sep = ['---:', '---', '---', '---', '---:', '---:', '---:']
  if (hasAssertion) head.push('assertion s', 'outside s'), sep.push('---:', '---:')
  if (hasTrace) head.push('spawns', 'fired sleep ms', 'DSH_HOME mkdirs'), sep.push('---:', '---:', '---:')
  head.push('slow-subtests (s)')
  sep.push('---')
  out.push(`| ${head.join(' | ')} |`)
  out.push(`| ${sep.join(' | ')} |`)
  sorted.slice(0, top).forEach((r, i) => {
    const cls = checkout === null ? { class: '—' } : classifySource(checkout, r.file)
    const slow = (r.slow ?? [])
      .slice()
      .sort((a, b) => b.ms - a.ms)
      .slice(0, 2)
      .map((x) => `${x.title.slice(0, 48)} ${(x.ms / 1000).toFixed(1)}`)
      .join('; ')
    const cells = [String(i + 1), `\`${relPath(r.file, checkout)}\``, rootOf(r.file), cls.class, s1(r.ms), `${pctOf(r.ms, totalMs)}%`, String(r.tests)]
    if (hasAssertion) cells.push(s1(r.assertion_ms ?? 0), s1(r.ms - (r.assertion_ms ?? 0)))
    if (hasTrace) {
      const t = traceOf(relPath(r.file, checkout))
      cells.push(t === null ? '—' : String(t.spawns), t === null ? '—' : String(t.sleep_ms), t === null ? '—' : String(t.homes))
    }
    cells.push(slow === '' ? '—' : slow)
    out.push(`| ${cells.join(' | ')} |`)
  })
  out.push('')
  out.push(`## by root`)
  out.push('')
  out.push('| root | files | file-seconds | % of work | tests | slowest file (s) |')
  out.push('| --- | ---: | ---: | ---: | ---: | ---: |')
  for (const r of rollup(rows, (x) => rootOf(x.file))) {
    out.push(`| ${r.key} | ${r.files} | ${s1(r.ms)} | ${pctOf(r.ms, totalMs)}% | ${r.tests} | ${s1(r.worst)} |`)
  }
  out.push('')
  out.push(`## by class (source-derived)`)
  out.push('')
  out.push('| class | files | file-seconds | % of work | slowest file (s) |')
  out.push('| --- | ---: | ---: | ---: | ---: |')
  const withClass = rows.map((r) => ({ ...r, class: checkout === null ? 'UNKNOWN' : classifySource(checkout, r.file).class }))
  for (const r of rollup(withClass, (x) => x.class)) {
    out.push(`| ${r.key} | ${r.files} | ${s1(r.ms)} | ${pctOf(r.ms, totalMs)}% | ${s1(r.worst)} |`)
  }
  out.push('')
  const durations = sorted.map((r) => r.ms).sort((a, b) => a - b)
  out.push(
    `distribution: p50=${s1(pct(durations, 50))}s p90=${s1(pct(durations, 90))}s p99=${s1(pct(durations, 99))}s max=${s1(durations[durations.length - 1] ?? 0)}s`,
  )
  return out.join('\n') + '\n'
}

/** Every row as TSV, so the tables can be re-derived without re-running this tool. */
export function toTsv(rows, checkout) {
  const head = ['file', 'root', 'class', 'tests', 'ms', 'assertion_ms', 'outside_ms', 'start_ms_epoch', 'end_ms_epoch']
  const lines = [head.join('\t')]
  for (const r of [...rows].sort((a, b) => b.ms - a.ms)) {
    const cls = checkout === null ? 'UNKNOWN' : classifySource(checkout, r.file).class
    const outside = r.assertion_ms === undefined ? '' : String(Math.round(r.ms - r.assertion_ms))
    lines.push(
      [
        r.file,
        rootOf(r.file),
        cls,
        String(r.tests),
        String(Math.round(r.ms)),
        r.assertion_ms === undefined ? '' : String(Math.round(r.assertion_ms)),
        outside,
        r.start === undefined ? '' : String(Math.round(r.start)),
        r.end === undefined ? '' : String(Math.round(r.end)),
      ].join('\t'),
    )
  }
  return lines.join('\n') + '\n'
}

function selfTest() {
  const fixture = [
    '\u001b[32m✓\u001b[39m packages/contracts/test/a.test.ts \u001b[2m(3 tests)\u001b[22m \u001b[32m 12ms\u001b[39m',
    '     \u001b[33m✓\u001b[39m a slow title \u001b[33m 900ms\u001b[39m',
    '\u001b[32m✓\u001b[39m packages/runtime/test/b.test.ts \u001b[2m(8 tests)\u001b[22m \u001b[32m 204898ms\u001b[39m',
    'stdout | packages/runtime/test/b.test.ts > x > y',
    '\u001b[32m✓\u001b[39m packages/runtime/test/b.test.ts \u001b[2m(8 tests)\u001b[22m \u001b[32m 204898ms\u001b[39m',
  ].join('\n')
  // (the duplicated final line is real: a stdout interleave can repeat a printed line; only the
  //  FIRST occurrence positions a file, so the parser must not double count. See `dedupe` below.)
  const { rows } = parseTranscript(fixture)
  const cases = []
  const ok = (name, cond) => cases.push({ name, ok: Boolean(cond) })
  const deduped = dedupeRows(rows)
  ok('strips ANSI and reads both file lines', rows.length === 3)
  ok('attaches the slow subtest to its file', deduped[0].slow.length === 1 || deduped[1].slow.length === 1)
  ok('dedupes a repeated file line', deduped.length === 2)
  ok('exact ms survives', deduped.find((r) => /b\.test\.ts/.test(r.file)).ms === 204898)
  ok('rootOf names the root', rootOf(deduped[0].file) === 'packages/contracts')
  const json = {
    startTime: 1,
    testResults: [
      { name: '/w/packages/domain/test/x.test.ts', startTime: 1000, endTime: 2500, assertionResults: [{ duration: 100 }, { duration: 200 }] },
      { name: '/w/packages/domain/test/broken.test.ts', startTime: 5, endTime: 1, assertionResults: [] },
    ],
  }
  const jr = parseVitestJson(json)
  ok('json: one row per usable result, window derived', jr.length === 1 && jr[0].ms === 1500)
  ok('json: assertion sum', jr[0].assertion_ms === 300)
  ok('percentile is nearest-rank', pct([1, 2, 3, 4], 50) === 2 && pct([1, 2, 3, 4], 100) === 4)
  const bad = cases.filter((c) => !c.ok)
  for (const c of cases) process.stdout.write(`${c.ok ? 'ok' : 'FAIL'} ${c.name}\n`)
  process.stdout.write(`PASS cases=${String(cases.length - bad.length)} failed=${String(bad.length)}\n`)
  return bad.length === 0 ? 0 : 1
}

/**
 * The reporter can print the same file line twice across a stdout interleave (vitest reprints on
 * rerun/failure). Only the first row per file is kept — the duration of a file's only run.
 */
export function dedupeRows(rows) {
  const seen = new Set()
  const out = []
  for (const r of rows) {
    if (seen.has(r.file)) continue
    seen.add(r.file)
    out.push(r)
  }
  return out
}

function main(argv) {
  const args = { transcript: null, json: null, captureSeconds: null, checkout: null, top: 20, tsv: null, traceTsv: null }
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i]
    if (a === '--self-test') return selfTest()
    if (a === '--transcript') args.transcript = argv[++i]
    else if (a === '--vitest-json') args.json = argv[++i]
    else if (a === '--capture-seconds') args.captureSeconds = Number(argv[++i])
    else if (a === '--checkout') args.checkout = resolve(argv[++i])
    else if (a === '--top') args.top = Number(argv[++i])
    else if (a === '--tsv') args.tsv = argv[++i]
    else if (a === '--trace-tsv') args.traceTsv = argv[++i]
    else {
      process.stderr.write(`perf-diag-census-profile: unknown argument ${a}\n`)
      return 2
    }
  }
  if (args.transcript === null && args.json === null) {
    process.stderr.write('perf-diag-census-profile: one of --transcript / --vitest-json / --self-test is required\n')
    return 2
  }
  let rows
  if (args.transcript !== null) {
    const parsed = parseTranscript(readFileSync(args.transcript, 'utf8'))
    rows = dedupeRows(parsed.rows)
  } else {
    rows = parseVitestJson(JSON.parse(readFileSync(args.json, 'utf8')))
  }
  if (rows.length === 0) {
    process.stderr.write('perf-diag-census-profile: no per-file rows (wrong file, or a reporter that prints no file lines)\n')
    return 2
  }
  const captureSeconds = Number.isFinite(args.captureSeconds) ? args.captureSeconds : null
  let trace = null
  if (args.traceTsv !== null) {
    trace = new Map()
    for (const line of readFileSync(args.traceTsv, 'utf8').split('\n').slice(1)) {
      if (line.trim() === '') continue
      const [file, spawns, sleepMs, sleepN, homes] = line.split('\t')
      trace.set(file, { spawns: Number(spawns), sleep_ms: Number(sleepMs), sleep_n: Number(sleepN), homes: Number(homes) })
    }
  }
  process.stdout.write(render({ rows, captureSeconds, top: args.top, checkout: args.checkout, trace }))
  if (args.tsv !== null) writeFileSync(args.tsv, toTsv(rows, args.checkout))
  return 0
}

if (import.meta.url === `file://${process.argv[1]}`) process.exit(main(process.argv.slice(2)))
