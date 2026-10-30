#!/usr/bin/env node
/**
 * measure.mjs — P1 serial-vs-parallel measurement harness (u7r3-xval).
 *
 * ONE invocation = ONE measurement row. Wraps the selected C1 sets in
 * /usr/bin/time -v (whole-tree user/sys CPU + peak RSS per command), samples
 * system context every second (loadavg, MemAvailable, marker-matched process
 * RSS/CPU), gates on ambient loadavg1 < --gate-load (waits in 30s steps and
 * records every wait), and records disk deltas (df avail + du -sk per
 * worktree) and cleanup state (git porcelain of both worktrees after).
 *
 * Modes: a-serial | b-serial (one set alone) | a+b (BOTH sets at once).
 *
 * Sets (fixed for this experiment):
 *   A = node --test tests/world-factory/binding-digests.test.mjs
 *                 tests/world-factory/registries.test.mjs      (cwd xval-a)
 *   B = pnpm exec vitest run packages/runtime/test              (cwd xval-b)
 *       (targeted family: the 466-file runtime C1 directory, ~289s wall /
 *        ~10min CPU measured; the single u7-9a-fs-mutation-c1.test.ts named in
 *        the brief runs in 2.6s wall — too light for a contention signal, the
 *        smoke timings that picked this are in logs/p1-set-selection.log.
 *        NOT the root vitest run (full suite stays forbidden).)
 */
import { spawn, spawnSync } from 'node:child_process'
import { openSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const arg = (n, d) => { const i = process.argv.indexOf(`--${n}`); return i === -1 ? d : process.argv[i + 1] }
const MODE = arg('mode'); const LABEL = arg('label'); const OUT_DIR = arg('out-dir')
const GATE = Number(arg('gate-load', '3.0'))
const WT_A = '/srv/workspace/dsh-plugins/dsh-agent-team/.worktrees/xval-a'
const WT_B = '/srv/workspace/dsh-plugins/dsh-agent-team/.worktrees/xval-b'
const WS = '/srv/workspace/dsh-plugins/dsh-agent-team'
const time = () => new Date().toISOString()
const load1 = () => Number(readFileSync('/proc/loadavg', 'utf8').split(' ')[0])
const loadAll = () => readFileSync('/proc/loadavg', 'utf8').trim()
const memAvailKb = () => Number(/MemAvailable:\s+(\d+)/.exec(readFileSync('/proc/meminfo', 'utf8'))[1])
const dfAvailKb = () => Number(spawnSync('df', ['--output=avail', '-k', WS], { encoding: 'utf8' }).stdout.split('\n')[1].trim())
const duKb = (wt) => Number(spawnSync('du', ['-sk', wt], { encoding: 'utf8' }).stdout.split('\t')[0])
const porcelainCount = (wt) => spawnSync('git', ['-C', wt, 'status', '--porcelain'], { encoding: 'utf8' }).stdout.split('\n').filter((l) => l.trim() !== '').length

const SETS = {
  a: { cwd: WT_A, markers: ['binding-digests.test.mjs', 'registries.test.mjs'], argv: ['node', '--test', 'tests/world-factory/binding-digests.test.mjs', 'tests/world-factory/registries.test.mjs'] },
  b: { cwd: WT_B, markers: ['packages/runtime/test', 'vitest'], argv: ['pnpm', 'exec', 'vitest', 'run', 'packages/runtime/test'] },
}
const which = MODE === 'a+b' ? ['a', 'b'] : MODE === 'a-serial' ? ['a'] : MODE === 'b-serial' ? ['b'] : (() => { throw new Error(`bad --mode ${MODE}`) })()

// ---- ambient-load gate ------------------------------------------------------
const gateWaits = []
while (load1() >= GATE) {
  gateWaits.push({ at: time(), load1: load1(), action: 'sleep 30s, re-gate' })
  await new Promise((r) => setTimeout(r, 30_000))
}
const gateClearedAt = time()
const pre = { at: time(), loadavg: loadAll(), memAvailKb: memAvailKb(), dfAvailKb: dfAvailKb(), duA: duKb(WT_A), duB: duKb(WT_B) }

// ---- 1s system/context sampler ------------------------------------------------
const markers = which.flatMap((w) => SETS[w].markers)
const pidCpuSeen = new Map()
const samples = []
let maxTreeRssKb = 0
let minMemAvailKb = memAvailKb()
let cpuJiffiesTotal = 0
function tick() {
  let rssKb = 0
  for (const pid of readdirSync('/proc')) {
    if (!/^\d+$/.test(pid)) continue
    let cmdline
    try { cmdline = readFileSync(`/proc/${pid}/cmdline`, 'utf8').replace(/\0/g, ' ') } catch { continue }
    if (cmdline.includes('measure.mjs')) continue
    if (!markers.some((m) => cmdline.includes(m))) continue
    try {
      const st = readFileSync(`/proc/${pid}/stat`, 'utf8')
      const after = st.slice(st.lastIndexOf(')') + 2).split(' ')
      rssKb += Number(after[21]) * 4
      const cur = Number(after[11]) + Number(after[12])
      const prev = pidCpuSeen.get(pid) ?? 0
      cpuJiffiesTotal += cur >= prev ? cur - prev : cur
      pidCpuSeen.set(pid, cur)
    } catch { /* raced exit */ }
  }
  const avail = memAvailKb()
  if (rssKb > maxTreeRssKb) maxTreeRssKb = rssKb
  if (avail < minMemAvailKb) minMemAvailKb = avail
  samples.push({ at: time(), loadavg: loadAll(), rssKb, memAvailKb: avail })
}
const timer = setInterval(tick, 1000)

// ---- run (parallel modes really run concurrently) ---------------------------
// In a+b mode the light set A (sub-second) is deliberately DELAYED into the
// middle of set B's window so the overlap is real, not just the first tick.
function runSet(w, delayMs = 0) {
  const set = SETS[w]
  const tf = join(OUT_DIR, `time-${LABEL}-${w}.txt`)
  const out = join(OUT_DIR, `out-${LABEL}-${w}.txt`)
  const fd = openSync(out, 'w')
  const started = Date.now()
  return new Promise((resolve) => {
    setTimeout(() => {
      const child = spawn('/usr/bin/time', ['-v', '-o', tf, ...set.argv], { cwd: set.cwd, stdio: ['ignore', fd, fd], env: process.env })
      child.on('close', (status) => resolve({ set: w, exit: status, wallMsProcess: Date.now() - started, delayMs, timeFile: tf, outFile: out }))
    }, delayMs)
  })
}
const t0 = Date.now()
const DELAY_A_MS = MODE === 'a+b' ? Number(arg('delay-a-ms', '30000')) : 0
const runs = await Promise.all(which.map((w) => runSet(w, w === 'a' ? DELAY_A_MS : 0)))
const totalWallMs = Date.now() - t0
clearInterval(timer)
tick()

const post = { at: time(), loadavg: loadAll(), memAvailKb: memAvailKb(), dfAvailKb: dfAvailKb(), duA: duKb(WT_A), duB: duKb(WT_B), porcelainA: porcelainCount(WT_A), porcelainB: porcelainCount(WT_B) }

function parseTime(f) {
  try {
    const t = readFileSync(f, 'utf8')
    const g = (re) => (t.match(re) ?? [])[1] ?? null
    const em = t.match(/Elapsed \(wall clock\).*?:\s*(\d+):(\d+(?:\.\d+)?)/)
    return {
      wallClockS: em === null ? null : Number(em[1]) * 60 + Number(em[2]),
      userS: Number(g(/User time \(seconds\): ([\d.]+)/) ?? NaN),
      sysS: Number(g(/System time \(seconds\): ([\d.]+)/) ?? NaN),
      maxRssKb: Number(g(/Maximum resident set size \(kbytes\): (\d+)/) ?? NaN),
      voluntaryCtx: g(/Voluntary context switches (\d+)/),
      involuntaryCtx: g(/Involuntary context switches (\d+)/),
    }
  } catch { return null }
}
const row = {
  label: LABEL, mode: MODE, gateLoadMax: GATE, gateWaits, gateClearedAt,
  pre, post, totalWallMs,
  runs: runs.map((r) => ({ ...r, time: parseTime(r.timeFile), tail: readFileSync(r.outFile, 'utf8').split('\n').slice(-6).join('\n') })),
  system: { maxMarkerRssKb: maxTreeRssKb, minMemAvailKb, cpuJiffiesTotal, cpuSecondsApprox: cpuJiffiesTotal / 100, samplerSamples: samples.length, samples: samples.filter((_, i) => i % 5 === 0) },
  diskDelta: { dfKb: post.dfAvailKb - pre.dfAvailKb, duAKb: post.duA - pre.duA, duBKb: post.duB - pre.duB },
  cleanup: { porcelainA: post.porcelainA, porcelainB: post.porcelainB },
  methodNote: 'per-run CPU+peakRSS = /usr/bin/time -v (whole waited tree); system context = 1s sampler of marker-matched /proc RSS/CPU (approximate, misses short-lived children between ticks); disk = df avail + du -sk deltas on the shared ext4; loadavg = /proc/loadavg at gate + before/after + sampler trace',
}
writeFileSync(join(OUT_DIR, `row-${LABEL}.json`), JSON.stringify(row, null, 2) + '\n')
console.log(JSON.stringify({ label: LABEL, mode: MODE, ok: runs.every((r) => r.exit === 0), totalWallMs, gateWaits: gateWaits.length, runs: row.runs.map((r) => ({ set: r.set, exit: r.exit, wallClockS: r.time?.wallClockS, userS: r.time?.userS, sysS: r.time?.sysS, maxRssKb: r.time?.maxRssKb })) }))
process.exit(runs.every((r) => r.exit === 0) ? 0 : 1)
