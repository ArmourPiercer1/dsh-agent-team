#!/usr/bin/env node
/**
 * census-profile — where the ~24 minutes of a Ready round actually go.
 *
 * WHY THIS EXISTS. The 2026-11-13 optimization memo (#762) proposed caching and
 * sharding on the premise that "most of the 24 minutes is the build" and that
 * the Actions API gives no step-level breakdown. The second half is false: the
 * jobs endpoint returns every step's `started_at`/`completed_at`, so the stage
 * split can be measured with zero workflow changes. The first half turns out to
 * be false too, at least on the 2026-11-13 sample (run 43459947311): census
 * 1108 s of a 1422 s job (78%), host build 272 s (19%), repo build 22 s (1.6%).
 *
 * This tool turns that one-off observation into a supported report: N successful
 * census jobs, per-step medians and their share of the job, so a priority claim
 * ("cache the host", "shard the census") cites a distribution instead of a
 * single run. It is READ-ONLY and changes nothing on the runner.
 *
 * WHAT IT CANNOT SEE: the split of the census step itself into the nine roots.
 * Actions records one step, so that decomposition needs a harness-level timer
 * (M3). The report says so rather than inventing an attribution.
 *
 * USAGE
 *   node scripts/census-profile.mjs [--runs 5] [--repo owner/name] [--json]
 *   node scripts/census-profile.mjs --input fixture.json   # offline
 *   node scripts/census-profile.mjs --self-test
 *
 * Exit 0 on success; 2 when no measurable census job is found (a refusal, not a
 * zero-second report).
 */
import process from 'node:process'
import { readFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

export const CENSUS_JOB_PREFIX = 'ci-census'
const SKIPPED = new Set(['skipped'])

/** Parse an ISO timestamp; null/'' -> null (never 0 — a missing time is unknown). */
export function ts(v) {
  if (typeof v !== 'string' || v === '') return null
  const t = Date.parse(v)
  return Number.isFinite(t) ? t : null
}

/** Nearest-rank percentile over ascending numbers. Empty -> 0. */
export function percentile(sorted, p) {
  if (!Array.isArray(sorted) || sorted.length === 0) return 0
  if (p <= 0) return sorted[0]
  if (p >= 100) return sorted[sorted.length - 1]
  const rank = Math.ceil((p / 100) * sorted.length) - 1
  return sorted[Math.max(0, Math.min(sorted.length - 1, rank))]
}

/** A step is measurable only when both timestamps exist and it did not skip. */
export function stepSeconds(step) {
  if (!step || SKIPPED.has(String(step.conclusion ?? ''))) return null
  const a = ts(step.started_at)
  const b = ts(step.completed_at)
  if (a === null || b === null || b < a) return null
  return Math.round((b - a) / 1000)
}

export function jobSeconds(job) {
  const a = ts(job?.started_at)
  const b = ts(job?.completed_at)
  if (a === null || b === null || b < a) return null
  return Math.round((b - a) / 1000)
}

/**
 * Pure aggregation over census jobs. Every step keeps its own sample count, so a
 * step that only exists on some runs cannot silently be averaged as zero.
 */
export function profileJobs(jobs) {
  // A job only counts as a sample when at least one step has both timestamps.
  // A draft round's census job is all-skipped: including it would add a 7 s
  // "job total" with no steps and drag every stage median toward zero.
  const usable = (Array.isArray(jobs) ? jobs : []).filter((j) => jobSeconds(j) !== null && (j.steps ?? []).some((st) => stepSeconds(st) !== null))
  if (usable.length === 0) return { runs: 0, steps: [], total: { p50: 0, min: 0, max: 0, samples: 0 } }
  const byStep = new Map()
  for (const job of usable) {
    for (const step of Array.isArray(job.steps) ? job.steps : []) {
      const s = stepSeconds(step)
      if (s === null) continue
      const name = String(step.name ?? '?')
      const arr = byStep.get(name) ?? []
      arr.push(s)
      byStep.set(name, arr)
    }
  }
  const steps = [...byStep.entries()].map(([name, samples]) => {
    const sorted = samples.slice().sort((a, b) => a - b)
    return {
      name,
      samples: sorted.length,
      p50: percentile(sorted, 50),
      min: sorted[0],
      max: sorted[sorted.length - 1],
    }
  }).sort((a, b) => b.p50 - a.p50)
  const totals = usable.map(jobSeconds).sort((a, b) => a - b)
  const total = { p50: percentile(totals, 50), min: totals[0], max: totals[totals.length - 1], samples: totals.length }
  for (const s of steps) s.sharePct = total.p50 === 0 ? 0 : Math.round((100 * s.p50) / total.p50)
  return { runs: usable.length, steps, total }
}

export function verdictToken(result) {
  const top = result.steps[0]
  return `DSH-CENSUS-PROFILE runs=${result.runs} total_p50_s=${result.total.p50} top_step=${top ? JSON.stringify(top.name) : 'none'} top_p50_s=${top?.p50 ?? 0} top_share_pct=${top?.sharePct ?? 0}`
}

// ------------------------------------------------------------------- live

function ghJson(path) {
  // The API has been seen to return a bare EOF under load (2026-11-13/14).
  // Two short retries: a transient network error must not become a report.
  let last
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return JSON.parse(execFileSync('gh', ['api', path], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }))
    } catch (e) {
      last = e
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 800)
    }
  }
  throw last
}

/** Recent completed runs, newest first, that carry a census job. */
export function discoverJobs(repo, runs, want) {
  const jobs = []
  const seen = new Set()
  // Workflow-specific endpoint: a plain /runs listing is dominated by the three
  // cheap layers, so 16 runs can contain one or two ci-required rounds.
  const runList = ghJson(`repos/${repo}/actions/workflows/ci-required.yml/runs?per_page=${Math.min(100, Math.max(20, runs * 6))}&status=completed`)
  for (const run of runList.workflow_runs ?? []) {
    if (run.status !== 'completed') continue
    let payload
    try {
      payload = ghJson(`repos/${repo}/actions/runs/${run.id}/jobs?per_page=100`)
    } catch {
      continue // one unreadable run is skipped and counted as such, never as 0 s
    }
    for (const job of payload.jobs ?? []) {
      if (!String(job.name ?? '').startsWith(CENSUS_JOB_PREFIX)) continue
      if (seen.has(job.id)) continue
      // A draft round skips the census job: no steps ever ran, so it is not a
      // sample. Counting it as "0 s" would drag every median down.
      if (!(job.steps ?? []).some((s) => stepSeconds(s) !== null)) continue
      seen.add(job.id)
      jobs.push({ id: job.id, runId: run.id, name: job.name, started_at: job.started_at, completed_at: job.completed_at, steps: job.steps })
      if (jobs.length >= want) return jobs
    }
  }
  return jobs
}

// ---------------------------------------------------------------- render

export function render(result) {
  const lines = []
  lines.push(`census-profile (n=${result.runs} census jobs, step medians):`)
  for (const s of result.steps) {
    lines.push(`  ${String(s.p50).padStart(5)} s  ${String(s.sharePct).padStart(3)}%  n=${String(s.samples).padStart(2)}  ${s.name}`)
  }
  lines.push(`  ${String(result.total.p50).padStart(5)} s   100%  n=${String(result.total.samples).padStart(2)}  JOB TOTAL (min ${result.total.min}s / max ${result.total.max}s)`)
  lines.push('  not visible here: the split of the census step into its nine roots (M3 harness timer).')
  lines.push(verdictToken(result))
  return lines.join('\n')
}

// --------------------------------------------------------------------- cli

function parseArgs(argv) {
  const opts = { runs: 5, repo: null, json: false, input: null, selfTest: false, help: false }
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i]
    if (a === '--runs') opts.runs = Number(argv[++i])
    else if (a === '--repo') opts.repo = argv[++i]
    else if (a === '--json') opts.json = true
    else if (a === '--input') opts.input = argv[++i]
    else if (a === '--self-test') opts.selfTest = true
    else if (a === '--help' || a === '-h') opts.help = true
    else throw new Error(`unknown argument ${a}`)
  }
  if (!Number.isInteger(opts.runs) || opts.runs <= 0) throw new Error('--runs needs a positive integer')
  return opts
}

function selfTest() {
  const cases = []
  const job = (a, b, steps) => ({ started_at: a, completed_at: b, steps })
  const s = (name, a, b, conclusion = 'success') => ({ name, started_at: a, completed_at: b, conclusion })
  const j1 = job('2026-11-13T16:10:28Z', '2026-11-13T16:34:10Z', [
    s('Bind', '2026-11-13T16:10:39Z', '2026-11-13T16:10:39Z'),
    s('Host build', '2026-11-13T16:10:44Z', '2026-11-13T16:15:16Z'),
    s('Census', '2026-11-13T16:15:40Z', '2026-11-13T16:34:08Z'),
    s('Census verdict', '2026-11-13T16:34:09Z', '2026-11-13T16:34:09Z', 'skipped'),
  ])
  const j2 = job('2026-11-13T17:00:00Z', '2026-11-13T17:24:00Z', [
    s('Host build', '2026-11-13T17:00:05Z', '2026-11-13T17:04:35Z'),
    s('Census', '2026-11-13T17:04:40Z', '2026-11-13T17:23:50Z'),
  ])
  const r = profileJobs([j1, j2])
  cases.push(['runs counted', r.runs === 2, JSON.stringify(r.runs)])
  cases.push(['host build median 270s', r.steps.find((x) => x.name === 'Host build').p50 === 270, JSON.stringify(r.steps)])
  cases.push(['skipped step excluded', !r.steps.some((x) => x.name === 'Census verdict'), JSON.stringify(r.steps.map((x) => x.name))])
  cases.push(['job total median 1422s', r.total.p50 === 1422 && r.total.min === 1422 && r.total.max === 1440, JSON.stringify(r.total)])
  cases.push(['share rounds to 78%', r.steps[0].sharePct === 78, JSON.stringify(r.steps[0])])
  cases.push(['missing timestamp is not zero', stepSeconds({ name: 'x', started_at: '2026-11-13T16:00:00Z', completed_at: null }) === null, 'null'])
  cases.push(['empty input refuses', profileJobs([]).runs === 0, JSON.stringify(profileJobs([]))])
  cases.push(['all-skipped job is not a sample', profileJobs([job('2026-11-13T16:10:28Z', '2026-11-13T16:10:35Z', [s('Census', '', '', 'skipped')])]).runs === 0, 'runs=0'])
  let bad = 0
  for (const [label, ok, detail] of cases) {
    if (!ok) bad += 1
    process.stdout.write(`  ${ok ? 'ok  ' : 'FAIL'} ${label}${ok ? '' : `: ${detail}`}\n`)
  }
  process.stdout.write(`DSH-CENSUS-PROFILE-SELFTEST ${bad === 0 ? 'PASS' : 'FAIL'} cases=${cases.length} failed=${bad}\n`)
  return bad === 0 ? 0 : 1
}

function main() {
  const opts = parseArgs(process.argv.slice(2))
  if (opts.help) {
    process.stdout.write('usage: node scripts/census-profile.mjs [--runs N] [--repo owner/name] [--json]\n' +
      '       node scripts/census-profile.mjs --input fixture.json\n' +
      '       node scripts/census-profile.mjs --self-test\n')
    return 0
  }
  if (opts.selfTest) return selfTest()
  let result
  try {
    const jobs = opts.input
      ? JSON.parse(readFileSync(resolve(opts.input), 'utf8')).jobs
      : discoverJobs(opts.repo ?? execFileSync('gh', ['repo', 'view', '--json', 'nameWithOwner', '-q', '.nameWithOwner'], { encoding: 'utf8' }).trim(), opts.runs, opts.runs)
    result = profileJobs(jobs)
  } catch (e) {
    process.stdout.write(`ERROR PROFILE_FAILED ${e?.message ?? e}\n`)
    return 2
  }
  if (result.runs === 0) {
    process.stdout.write('ERROR NO_MEASURABLE_CENSUS_JOB: no completed census job with timestamps found (a refusal, not a 0 s report)\n')
    return 2
  }
  process.stdout.write(`${opts.json ? JSON.stringify(result, null, 2) : render(result)}\n`)
  return 0
}

const invokedDirectly = process.argv[1] !== undefined && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))
if (invokedDirectly) process.exit(main())
