#!/usr/bin/env node
/**
 * build-table.mjs — assemble P1-TABLE.md from measure/row-*.json rows.
 * Every row carries its ambient loadavg (gate pre/post) — the experiment law.
 */
import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const EV = '/srv/workspace/dsh-plugins/dsh-agent-team/.worktrees/u7r3-xval/dev/agent-workflow/evidence/u7r3-xval-20261030'
const O = join(EV, 'measure')
const order = ['a-serial-1', 'a-serial-2', 'b-serial-1', 'b-serial-2', 'a+b-parallel-1', 'a+b-parallel-2', 'p2-fold-a', 'b-rca3']
const rows = order.filter((l) => exists(join(O, `row-${l}.json`))).map((l) => JSON.parse(readFileSync(join(O, `row-${l}.json`), 'utf8')))
function exists(p) { try { readFileSync(p); return true } catch { return false } }

const hdr = ['row', 'mode', 'set', 'exit', 'wall_s', 'user_s', 'sys_s', 'peakRSS_MiB', 'amb.load pre(1m)', 'amb.load post(1m)', 'minMemAvail_MiB', 'diskDelta_du_kB', 'gateWaits', 'porcelain A/B']
const lines = [
  '| ' + hdr.join(' | ') + ' |',
  '|' + hdr.map(() => '---|').join(''),
]
for (const r of rows) {
  for (const run of r.runs) {
    // wall/CPU/RSS are re-derived from the raw /usr/bin/time file when the
    // row's parsed value is missing (parseTime fix landed mid-grid; the raw
    // time-*.txt files are the primary record).
    let wall = run.time?.wallClockS ?? null
    let userS = run.time?.userS ?? null
    let sysS = run.time?.sysS ?? null
    let rss = run.time?.maxRssKb ?? null
    if (wall === null || userS === null || Number.isNaN(userS)) {
      try {
        const t = readFileSync(run.timeFile, 'utf8')
        const em = t.match(/Elapsed \(wall clock\).*?:\s*(\d+):(\d+(?:\.\d+)?)/)
        if (wall === null && em) wall = Number(em[1]) * 60 + Number(em[2])
        if (userS === null || Number.isNaN(userS)) userS = Number((t.match(/User time \(seconds\): ([\d.]+)/) ?? [])[1] ?? NaN)
        if (sysS === null || Number.isNaN(sysS)) sysS = Number((t.match(/System time \(seconds\): ([\d.]+)/) ?? [])[1] ?? NaN)
        if (rss === null) rss = Number((t.match(/Maximum resident set size \(kbytes\): (\d+)/) ?? [])[1] ?? NaN)
      } catch { /* keep nulls visible */ }
    }
    lines.push('| ' + [
      r.label + (r.coRotatedWith ? ' (co-rotated)' : ''),
      r.mode,
      run.set,
      run.exit,
      (wall ?? run.wallMsProcess / 1000).toFixed(2),
      (userS ?? NaN).toFixed(2),
      (sysS ?? NaN).toFixed(2),
      ((rss ?? 0) / 1024).toFixed(0),
      r.pre.loadavg.split(' ')[0],
      r.post.loadavg.split(' ')[0],
      (r.system.minMemAvailKb / 1024).toFixed(0),
      `${run.set === 'a' ? r.diskDelta.duAKb : r.diskDelta.duBKb}`,
      r.gateWaits.length,
      `${r.cleanup.porcelainA}/${r.cleanup.porcelainB}`,
    ].join(' | ') + ' |')
  }
}
const md = `# P1 measurement table (u7r3-xval, real-UTC 2026-10-30, NO ACCEPTANCE CREDIT)

Set A = \`node --test tests/world-factory/binding-digests.test.mjs tests/world-factory/registries.test.mjs\` (cwd xval-a; sub-second by design — the brief names it as the LIGHT set).
Set B = \`pnpm exec vitest run packages/runtime/test\` (cwd xval-b; targeted single-package C1 family, 466 files/5777 tests; selection smokes in \`logs/p1-set-selection.log\` — the brief's example single u7-9a file runs in 2.6s and gives no contention signal).
Parallel rows run BOTH at once; the light A is deliberately delayed 30s into B's window (measure.mjs \`--delay-a-ms\`) so the overlap is real.
\`p2-fold-a\` = the P2 co-rotation fold-in: set A ran while BOTH real Host worlds (x1 @3189, x2 @3190) were live (P0 overlap window).
peakRSS = /usr/bin/time -v whole-tree MaxRSS. amb.load = /proc/loadavg 1-min at row gate-clear / row end. minMemAvail = MemAvailable min during the row. diskDelta_du_kB = du -sk delta of the set's own worktree.

${lines.join('\n')}

## Exit-code notes (failures are NOT washed out)
a+b-parallel-2 set B exit=1 and b-rca3 (standalone RCA re-run, nothing else in flight) exit=1: two DIFFERENT wall-clock-sensitive tests flaked once each (u7as N2, a5-m1 B4-D3); single-file re-runs after each: 6/6 and 3/3 green. Full RCA with the R-413-1 risk-ledger precedent in FLAKE-RCA.md — conclusion: pre-existing suite-internal timing sensitivity, reproduced SERIAL/standalone, not caused by co-rotation. Timings in the table are unaffected (per-run /usr/bin/time facts).

## Run-to-run spread (per set, serial vs parallel)
${spreadSection(rows)}
`
writeFileSync(join(O, 'P1-TABLE.md'), md)
console.log(md)

function spreadSection(rs) {
  const g = (label, set) => { const r = rs.find((x) => x.label === label); return r ? r.runs.find((x) => x.set === set) : null }
  const wall = (label, set) => { const r = g(label, set); return r ? (r.time?.wallClockS ?? r.wallMsProcess / 1000) : null }
  const fmt = (a, b) => a === null || b === null ? 'n/a' : `${a.toFixed(2)} / ${b.toFixed(2)}`
  const ratio = (par, ser) => { const p = Math.min(...par.filter(Boolean)); const s = Math.min(...ser.filter(Boolean)); return p && s ? `x${(p / s).toFixed(2)}` : 'n/a' }
  return [
    `- Set A serial walls: ${fmt(wall('a-serial-1', 'a'), wall('a-serial-2', 'a'))} s | parallel walls: ${fmt(wall('a+b-parallel-1', 'a'), wall('a+b-parallel-2', 'a'))} s | parallel/serial(min): ${ratio([wall('a+b-parallel-1', 'a'), wall('a+b-parallel-2', 'a')], [wall('a-serial-1', 'a'), wall('a-serial-2', 'a')])}`,
    `- Set B serial walls: ${fmt(wall('b-serial-1', 'b'), wall('b-serial-2', 'b'))} s | parallel walls: ${fmt(wall('a+b-parallel-1', 'b'), wall('a+b-parallel-2', 'b'))} s | parallel/serial(min): ${ratio([wall('a+b-parallel-1', 'b'), wall('a+b-parallel-2', 'b')], [wall('b-serial-1', 'b'), wall('b-serial-2', 'b')])}`,
    `- Co-rotated A (both hosts live): ${wall('p2-fold-a', 'a')?.toFixed(2) ?? 'n/a'} s vs A serial min ${Math.min(wall('a-serial-1', 'a'), wall('a-serial-2', 'a')).toFixed(2)} s`,
  ].join('\n')
}
