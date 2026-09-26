// cpu-sampler.mjs <pgrep-pattern> <out-file> — sample /proc/<pid>/stat
// (utime+stime) of matching processes every 100 ms and log anomalies:
// cpuDelta < 0 or > 95 ms per 100 ms tick (a frozen process shows the
// jump when it resumes; a CPU-bound block shows large deltas throughout).
import { execSync } from 'node:child_process'
import { appendFileSync, readFileSync } from 'node:fs'
const pattern = process.argv[2]
const out = process.argv[3]
const self = String(process.pid)
let last = {}
const t0 = Date.now()
const iv = setInterval(() => {
  let pids = []
  try {
    pids = execSync(`pgrep -f ${JSON.stringify(pattern)} || true`, { encoding: 'utf8' })
      .trim().split('\n').filter((p) => p && p !== self)
  } catch { pids = [] }
  const wall = Date.now() - t0
  for (const pid of pids) {
    try {
      const s = readFileSync(`/proc/${pid}/stat`, 'utf8')
      const i = s.lastIndexOf(')')
      const f = s.slice(i + 2).split(' ')
      const cpuMs = (Number(f[11] ?? 0) + Number(f[12] ?? 0)) / 10 * 1000
      const prev = last[pid]
      // Log EVERY tick: wall gap + cpu delta. A frozen target shows a big
      // wall gap with ~0 cpu delta; a CPU-bound block shows big cpu deltas;
      // a frozen SAMPLER (whole machine) shows no lines at all.
      if (prev !== undefined) {
        const wallD = wall - prev[0]
        const cpuD = cpuMs - prev[1]
        appendFileSync(out, `wall=${String(wall).padStart(8, ' ')} pid=${pid} wallDelta=${wallD} cpuDelta=${Math.round(cpuD)} totalCpu=${Math.round(cpuMs)}\n`)
      }
      last[pid] = [wall, cpuMs]
    } catch { /* process gone */ }
  }
  if (Date.now() - t0 > 900_000) { clearInterval(iv); process.exit(0) }
}, 100)
