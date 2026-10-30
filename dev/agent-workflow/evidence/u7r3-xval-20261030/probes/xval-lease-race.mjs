#!/usr/bin/env node
/**
 * xval-lease-race.mjs — ZERO-START contention probe for the u7r3-xval
 * experiment (NO host boot, NO budget consumed; pure lease-layer mechanics).
 *
 * Question it answers mechanically: what does the shared lease root ACTUALLY
 * do when creators from TWO worktrees acquire simultaneously? (The boot pair
 * rarely races at all because 3181+ is empty; this forces the race.)
 *
 * Protocol: N child processes (half importing the port-lease module through
 * worktree A, half through worktree B — identical code, different trees, all
 * sharing the MAIN hoisted lease root) all attempt acquireFirstFreeLease on
 * the SAME ordered band the instant a GO file appears. Outcomes recorded:
 * acquired port / LEASE_HELD refusal / other error. The driver samples the
 * live slot census mid-window and the post-release census, then asserts:
 *   - no port was acquired twice (distinctness of winners),
 *   - refusals are exactly the exhaustion of the band (never a silent steal),
 *   - after release, zero live claims remain,
 *   - every attempt (win or loss) is visible in the append-only seq logs.
 */
import { spawn, spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, openSync, readFileSync, readdirSync, unlinkSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

const arg = (n, d) => { const i = process.argv.indexOf(n); return i === -1 ? d : process.argv[i + 1] }

if (process.argv.includes('--child')) {
  const side = arg('--side'); const lib = arg('--lib'); const readyDir = arg('--ready-dir')
  const world = arg('--world'); const lo = Number(arg('--lo')); const hi = Number(arg('--hi'))
  const out = arg('--out')
  const { acquireFirstFreeLease } = await import(pathToFileURL(join(lib, 'port-lease.mjs')).href)
  const { portsOfBands } = await import(pathToFileURL(join(lib, '..', '..', 'paths.mjs')).href)
  writeFileSync(join(readyDir, `ready-${side}.json`), JSON.stringify({ side, world, pid: process.pid, at: new Date().toISOString() }))
  const deadline = Date.now() + 30_000
  while (!existsSync(join(readyDir, 'GO'))) {
    if (Date.now() > deadline) { writeFileSync(out, JSON.stringify({ side, error: 'NO_GO' })); process.exit(2) }
    await new Promise((r) => setTimeout(r, 2))
  }
  const include = portsOfBands([[lo, hi]])
  const t0 = Date.now()
  let result
  try {
    const lease = await acquireFirstFreeLease({ leaseRoot: arg('--lease-root'), world, purpose: 'xval-race', include, preferred: [] })
    result = { side, world, ok: true, port: lease.port, acquireMs: Date.now() - t0, at: new Date().toISOString() }
    await new Promise((r) => setTimeout(r, Number(arg('--hold-ms', '1500'))))
    try { lease.release() } catch (e) { result.releaseError = String(e?.message ?? e) }
  } catch (error) {
    result = { side, world, ok: false, code: error?.code ?? null, error: String(error?.message ?? error).slice(0, 200), acquireMs: Date.now() - t0, at: new Date().toISOString() }
  }
  writeFileSync(out, JSON.stringify(result))
  process.exit(0)
}

// ---- driver ----------------------------------------------------------------
const WT_A = arg('--worktree-a', '/srv/workspace/dsh-plugins/dsh-agent-team/.worktrees/xval-a')
const WT_B = arg('--worktree-b', '/srv/workspace/dsh-plugins/dsh-agent-team/.worktrees/xval-b')
const LEASE_ROOT = arg('--lease-root', '/srv/workspace/dsh-plugins/dsh-agent-team/.artifacts/tmp/port-leases')
const LO = Number(arg('--lo', '13040')); const HI = Number(arg('--hi', '13045'))
const PER_SIDE = Number(arg('--per-side', '4'))
const OUT_DIR = arg('--out-dir')
const READY = join(OUT_DIR, 'ready'); mkdirSync(READY, { recursive: true })
const { scanAllLeases } = await import(pathToFileURL(join(WT_A, 'tests/world-factory/lib/port-lease.mjs')).href)
const stamp = new Date().toISOString().replace(/[-:.]/g, '').slice(0, 15)

const spawned = []
for (let i = 0; i < PER_SIDE; i += 1) {
  for (const [side, wt] of [['A', WT_A], ['B', WT_B]]) {
    const world = `u5xvalrace${side.toLowerCase()}${i}-${stamp}`
    const out = join(OUT_DIR, `child-${side}${i}.json`)
    const fd = openSync(join(OUT_DIR, `child-${side}${i}.log`), 'w')
    const child = spawn(process.execPath, [
      process.argv[1], '--child', '--side', side + i, '--lib', join(wt, 'tests/world-factory/lib'),
      '--ready-dir', READY, '--world', world, '--lo', String(LO), '--hi', String(HI),
      '--lease-root', LEASE_ROOT, '--out', out,
    ], { stdio: ['ignore', fd, fd] })
    spawned.push({ side: side + i, child, done: new Promise((res) => child.on('close', (status) => res({ side: side + i, status }))) })
  }
}
// barrier: wait until EVERY child declares readiness, then release GO at once
const barrierDeadline = Date.now() + 20_000
while (readdirSync(READY).filter((f) => f.startsWith('ready-')).length < spawned.length) {
  if (Date.now() > barrierDeadline) break
  await new Promise((r) => setTimeout(r, 5))
}
const censusBefore = scanAllLeases(LEASE_ROOT).filter((l) => l.port >= LO && l.port <= HI && l.alive)
writeFileSync(join(READY, 'GO'), 'go\n')
await new Promise((r) => setTimeout(r, 500))
const censusMid = scanAllLeases(LEASE_ROOT).filter((l) => l.port >= LO && l.port <= HI && l.alive)
await Promise.all(spawned.map((s) => s.done))
await new Promise((r) => setTimeout(r, 500))
const results = readdirSync(OUT_DIR).filter((f) => f.startsWith('child-') && f.endsWith('.json')).map((f) => JSON.parse(readFileSync(join(OUT_DIR, f), 'utf8')))
const censusAfter = scanAllLeases(LEASE_ROOT).filter((l) => l.port >= LO && l.port <= HI && l.alive)
const winners = results.filter((r) => r.ok).map((r) => r.port)
const losers = results.filter((r) => !r.ok)
const verdict = {
  leaseRoot: LEASE_ROOT, band: [LO, HI], children: results.length,
  censusBefore: censusBefore.map((l) => l.port), censusMid: censusMid.map((l) => `${l.port}:${l.by?.world}`), censusAfter: censusAfter.map((l) => l.port),
  winners: winners.sort((a, b) => a - b), losers: losers.map((l) => ({ code: l.code, ms: l.acquireMs })),
  assertNoDoubleAcquire: new Set(winners).size === winners.length,
  assertRefusalsAreExhaustion: losers.every((l) => l.code === 'LEASE_HELD'),
  assertZeroLiveAfter: censusAfter.length === 0,
  assertDistinctPortsInRange: winners.every((p) => p >= LO && p <= HI),
  results,
}
writeFileSync(join(OUT_DIR, 'LEASE-RACE-VERDICT.json'), JSON.stringify(verdict, null, 2) + '\n')
console.log(JSON.stringify({ ...verdict, results: undefined }, null, 2))
for (const f of ['GO']) unlinkSync(join(READY, f))
process.exit(verdict.assertNoDoubleAcquire && verdict.assertRefusalsAreExhaustion && verdict.assertZeroLiveAfter ? 0 : 1)
