#!/usr/bin/env node
/**
 * perf-diag-capture-trace.cjs — measure WHICH test file spends its time spawning, sleeping and
 * creating worlds, without changing a single line of product or test code.
 *
 * WHY THIS EXISTS (task `perf-diag-20261115`). The census's per-file durations say which files are
 * slow; they do not say WHY. Attribution needs evidence, not a reading of the source: the same
 * `spawn(` in a helper loop can mean 6 processes or 6600. Node's `--require` hook is enough — a
 * module loaded into every vitest worker thread (verified: `worker_threads` in the threads pool
 * inherit `NODE_OPTIONS`) can wrap the three primitives that produce non-CPU time and count them
 * per test file, identified from the CALL STACK, so no file needs a `try/finally` of its own.
 *
 * WHAT IT COUNTS (per test file that initiated the call)
 *   - `spawn` — child_process.spawn/spawnSync/execFile/execFileSync/exec/execSync/fork calls, keyed
 *     by the command word. This is the process-spawn share.
 *   - `sleep` — global `setTimeout` calls with a numeric delay >= SLEEP_MIN_MS, count and summed ms
 *     (the wall-clock FLOOR those timers impose). `timers/promises` is not wrapped: a binding
 *     imported by ESM cannot be replaced after the fact, so that use is UNDER-COUNTED by design.
 *   - `home` — `mkdir*` calls whose target is under `tests/homes/` (a DSH_HOME world being made).
 *   - `mkdtemp` — temp tree/fixture copies (count only; no byte accounting).
 *
 * WHAT IT IS NOT. It is inert unless `PERFDIAG_TRACE_OUT` is set, it writes only that file, it
 * monkey-patches only for the lifetime of the process, and it never throws into the caller: every
 * wrapper calls the original and records afterwards (and a recording failure is swallowed).
 *
 * USAGE (no config change; `--require` is inherited by the worker threads)
 *   PERFDIAG_TRACE_OUT=.artifacts/tmp/capture-trace.ndjson \
 *   NODE_OPTIONS="--require $PWD/tools/perf-diag-capture-trace.cjs" \
 *     pnpm exec vitest run --reporter=default --reporter=json --outputFile.json=… --testTimeout=90000
 *
 *   node tools/perf-diag-capture-trace.cjs --summarize .artifacts/tmp/capture-trace.ndjson
 */
const fs = require('node:fs')
const cp = require('node:child_process')
const path = require('node:path')

const SLEEP_MIN_MS = 20

const OUT = process.env.PERFDIAG_TRACE_OUT || ''
if (OUT === '' || process.env.PERFDIAG_TRACE_OFF === '1') {
  // Inert: still allow `--summarize` below (that path exits before this module would patch).
} else {
  install()
}

function testFileFromStack() {
  const stack = String(new Error().stack || '')
  const m = /((?:packages|tests)\/[^\s()]+\.(?:test|spec)\.[cm]?[jt]s)/.exec(stack)
  if (m !== null) return m[1]
  // No test file in the stack (a timer callback, or a helper called from a continuation): name the
  // first non-internal frame instead of lumping everything into one anonymous bucket, so the number
  // still says WHERE it came from.
  const frame = /\n\s+at\s+(?:async\s+)?(?:\(([^)]+)\)|([^\s]+))/.exec(stack.slice(stack.indexOf('\n')))
  const raw = frame === null ? '' : String(frame[1] || frame[2] || '')
  const rel = /((?:packages|tests|scripts|node_modules\/vitest)\/[^:()]+)/.exec(raw.replace(/^file:\/\/[^/]+\//, ''))
  return rel === null ? '(not-in-a-test-file)' : `${rel[1]} (non-test frame)`
}

function baseCmd(file) {
  const s = String(file ?? '')
  const base = path.basename(s)
  return base === '' ? s : base
}

function install() {
  const spawned = new Map() // `${file}\u0000${cmd}` -> n
  const sleeps = new Map() // file -> {n, ms}
  let homes = 0
  let mkdtemps = 0
  const homesByFile = new Map()
  const worlds = new Set()

  const record = (map, key, n = 1) => map.set(key, (map.get(key) || 0) + n)
  const asMap = (v) => (v instanceof Map ? v : new Map(Object.entries(v || {})))

  const bump = (file, cmd) => record(spawned, `${file}\u0000${cmd}`)

  for (const name of ['spawn', 'spawnSync', 'execFile', 'execFileSync', 'exec', 'execSync', 'fork']) {
    const original = cp[name]
    if (typeof original !== 'function') continue
    cp[name] = function traced(...args) {
      try {
        const first = args[0]
        const cmd = Array.isArray(first) ? baseCmd(first[0]) : baseCmd(first)
        bump(testFileFromStack(), `${name}:${cmd}`)
      } catch {
        /* recording must never break the caller */
      }
      return original.apply(this, args)
    }
  }

  // A `setTimeout(fn, 5000)` used as a Promise.race GUARD is not five seconds of waiting: it is
  // cleared when the real operation wins. So a timer is counted only when it actually FIRES — a
  // requested-but-cleared delay is discarded. `pending` holds the attribution captured at set time
  // (the firing callback's stack no longer contains the test file).
  const realSetTimeout = globalThis.setTimeout
  const realClearTimeout = globalThis.clearTimeout
  const pending = new Map() // timer token -> {file, ms}
  let timerToken = 0
  const tokenOf = new Map() // Timeout object -> token
  globalThis.setTimeout = function tracedSetTimeout(fn, ms, ...rest) {
    let token = null
    try {
      if (typeof ms === 'number' && ms >= SLEEP_MIN_MS) {
        token = ++timerToken
        pending.set(token, { file: testFileFromStack(), ms })
      }
    } catch {
      /* ignore */
    }
    const wrapped =
      token === null
        ? fn
        : function tracedFire(...a) {
            try {
              const rec = pending.get(token)
              if (rec !== undefined) {
                pending.delete(token)
                const cur = sleeps.get(rec.file) || { n: 0, ms: 0, fired: 0 }
                cur.n += 1
                cur.fired += 1
                cur.ms += rec.ms
                sleeps.set(rec.file, cur)
              }
            } catch {
              /* ignore */
            }
            return fn.apply(this, a)
          }
    const handle = realSetTimeout(wrapped, ms, ...rest)
    if (token !== null) {
      try {
        tokenOf.set(handle, token)
      } catch {
        /* ignore */
      }
    }
    return handle
  }
  globalThis.clearTimeout = function tracedClearTimeout(handle) {
    try {
      const token = tokenOf.get(handle)
      if (token !== undefined) {
        pending.delete(token)
        tokenOf.delete(handle)
      }
    } catch {
      /* ignore */
    }
    return realClearTimeout(handle)
  }

  for (const name of ['mkdirSync', 'mkdir']) {
    const original = fs[name]
    if (typeof original !== 'function') continue
    fs[name] = function tracedMkdir(p, ...rest) {
      try {
        const target = String(p)
        if (target.includes('/tests/homes/') || target.includes('\\tests\\homes\\')) {
          homes += 1
          const w = /tests[\\/]homes[\\/]([^\\/]+)/.exec(target)
          if (w !== null) worlds.add(w[1])
          const file = testFileFromStack()
          homesByFile.set(file, (homesByFile.get(file) || 0) + 1)
        }
      } catch {
        /* ignore */
      }
      return original.call(this, p, ...rest)
    }
  }
  const realMkdtemp = fs.mkdtempSync
  if (typeof realMkdtemp === 'function') {
    fs.mkdtempSync = function tracedMkdtemp(p, ...rest) {
      try {
        mkdtemps += 1
      } catch {
        /* ignore */
      }
      return realMkdtemp.call(this, p, ...rest)
    }
  }

  const flush = () => {
    try {
      if (spawned.size === 0 && sleeps.size === 0 && homes === 0 && mkdtemps === 0) return
      const line = {
        schema: 'perfdiag-trace/1',
        pid: process.pid,
        thread: require('node:worker_threads').threadId,
        at: new Date().toISOString(),
        spawns: [...spawned.entries()].map(([key, n]) => {
          const [file, cmd] = key.split('\u0000')
          return { file, cmd, n }
        }),
        sleeps: [...sleeps.entries()].map(([file, v]) => ({ file, n: v.n, ms: v.ms })),
        homes,
        worlds: [...worlds],
        homes_by_file: [...homesByFile.entries()].map(([file, n]) => ({ file, n })),
        mkdtemps,
      }
      fs.appendFileSync(OUT, JSON.stringify(line) + '\n')
      spawned.clear()
      sleeps.clear()
      homesByFile.clear()
      worlds.clear()
      homes = 0
      mkdtemps = 0
    } catch {
      /* a tracing failure must not fail a suite */
    }
  }
  // The ORIGINAL interval, so the trace cannot recurse through the wrapped timer.
  const timer = setInterval(flush, 3000)
  if (typeof timer.unref === 'function') timer.unref()
  process.on('exit', flush)
}

// ── summarize a trace file back into per-file counts + a per-command rollup ──────────────────────
function summarize(file) {
  const wantTsv = process.env.PERFDIAG_TRACE_TSV || ''
  const lines = fs.readFileSync(file, 'utf8').split('\n').filter((l) => l.trim() !== '')
  const spawns = new Map()
  const cmdTotals = new Map()
  const sleeps = new Map()
  let homes = 0
  let mkdtemps = 0
  let events = 0
  const homesByFile = new Map()
  const worldNames = new Set()
  for (const line of lines) {
    let rec
    try {
      rec = JSON.parse(line)
    } catch {
      continue
    }
    events += 1
    for (const s of rec.spawns || []) {
      spawns.set(s.file, (spawns.get(s.file) || 0) + s.n)
      cmdTotals.set(s.cmd, (cmdTotals.get(s.cmd) || 0) + s.n)
    }
    for (const s of rec.sleeps || []) {
      const cur = sleeps.get(s.file) || { n: 0, ms: 0 }
      cur.n += s.n
      cur.ms += s.ms
      sleeps.set(s.file, cur)
    }
    homes += Number(rec.homes) || 0
    for (const w of rec.worlds || []) worldNames.add(w)
    for (const h of rec.homes_by_file || []) homesByFile.set(h.file, (homesByFile.get(h.file) || 0) + h.n)
    mkdtemps += Number(rec.mkdtemps) || 0
  }
  const spawnTotal = [...spawns.values()].reduce((a, b) => a + b, 0)
  const sleepTotalMs = [...sleeps.values()].reduce((a, b) => a + b.ms, 0)
  const sleepTotalN = [...sleeps.values()].reduce((a, b) => a + b.n, 0)
  if (wantTsv !== '') {
    const files = new Set([...spawns.keys(), ...sleeps.keys(), ...homesByFile.keys()])
    const lines = ['file\tspawns\tfired_sleep_ms\tfired_sleep_n\thome_mkdirs']
    for (const f of [...files].sort()) {
      const sl = sleeps.get(f) || { ms: 0, n: 0 }
      lines.push([f, spawns.get(f) || 0, sl.ms, sl.n, homesByFile.get(f) || 0].join('\t'))
    }
    fs.writeFileSync(wantTsv, lines.join('\n') + '\n')
  }
  const out = []
  out.push(
    `flush_records=${events}  spawn_calls=${spawnTotal}  fired_sleep_calls=${sleepTotalN}  fired_sleep_ms=${sleepTotalMs}  home_mkdirs=${homes}  distinct_worlds=${worldNames.size}  mkdtemps=${mkdtemps}`,
  )
  out.push('')
  out.push('## spawns by command (top 15)')
  for (const [cmd, n] of [...cmdTotals.entries()].sort((a, b) => b[1] - a[1]).slice(0, 15)) out.push(`${String(n).padStart(7)}  ${cmd}`)
  out.push('')
  out.push('## files by spawn count (top 20)')
  for (const [f, n] of [...spawns.entries()].sort((a, b) => b[1] - a[1]).slice(0, 20)) out.push(`${String(n).padStart(7)}  ${f}`)
  out.push('')
  out.push('## worlds created (distinct DSH_HOME names)')
  out.push(`count=${worldNames.size}`)
  for (const w of [...worldNames].sort()) out.push(`  ${w}`)
  out.push('')
  out.push('## files by DSH_HOME mkdir (top 10)')
  for (const [f, n] of [...homesByFile.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10)) out.push(`${String(n).padStart(7)}  ${f}`)
  out.push('')
  out.push('## files by sleep ms (top 20, FIRED timers only)')
  for (const [f, v] of [...sleeps.entries()].sort((a, b) => b[1].ms - a[1].ms).slice(0, 20)) out.push(`${String(v.ms).padStart(9)} ms  n=${String(v.n).padStart(5)}  ${f}`)
  return out.join('\n') + '\n'
}

if (require.main === module) {
  const args = process.argv.slice(2)
  const i = args.indexOf('--summarize')
  if (i < 0 || args[i + 1] === undefined) {
    process.stderr.write('usage: perf-diag-capture-trace.cjs --summarize <trace.ndjson>  (or set PERFDIAG_TRACE_OUT and --require this file)\n')
    process.exit(2)
  }
  process.stdout.write(summarize(args[i + 1]))
  process.exit(0)
}

module.exports = { summarize }
