#!/usr/bin/env node
/**
 * stub-runner.mjs — OFFLINE dry-orchestration stub for the parallel
 * supervisor (zero Host boots). Behaves like a real runner at the surface:
 *   --line pb (the doomed B): creates a REAL World via the factory, spawns a
 *     fake long-lived "host" (sleep 300) recorded in .u5-ownership.json,
 *     holds a real port lease, prints U5-IN-RUN, idles until SIGKILLed.
 *   --line pa (the surviving A): prints U5-IN-RUN, idles briefly, exits 0.
 * Exercises: supervisor IN-RUN parsing, own-handle kill, stale lease scan,
 * reclaimWorld (pid /proc-environ verified via the fake host env DSH_HOME),
 * marker home deletion, census checks, exit-path wiring.
 */
import { spawn } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { TestWorldFactory } from './lib/world-factory.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = resolve(HERE, '..', '..')
const args = process.argv.slice(2)
const line = args[args.indexOf('--line') + 1]
const evidence = args[args.indexOf('--evidence') + 1]
const recPathIdx = args.indexOf('--run-record')
const factory = new TestWorldFactory({ repoRoot: REPO_ROOT, evidenceRoot: evidence })
const world = await factory.createWorld({ line: `dry${line}` })
if (line === 'pa') {
  console.log(`U5-IN-RUN ${world.id} ${world.home} ${process.pid}`)
  await new Promise((r) => setTimeout(r, 12_000))
  if (recPathIdx !== -1) writeFileSync(args[recPathIdx + 1], JSON.stringify({ overall: 'PASS', cases: [] }, null, 2))
  await world.teardown({})
  process.exit(0)
}
// doomed B: fake host = sleep child carrying DSH_HOME in its environ, plus a
// real mock-port lease so the supervisor has a stale lease to reclaim.
void mkdirSync
const sleepChild = spawn('sleep', ['300'], { env: { ...process.env, DSH_HOME: world.home }, stdio: 'ignore' })
const { acquireFirstFreeLease } = await import('./lib/port-lease.mjs')
const pl = await acquireFirstFreeLease({ leaseRoot: factory.leaseRoot, world: world.id, purpose: 'host', include: [3497, 3498, 3499, 3500], preferred: [] })
writeFileSync(join(world.home, '.u5-ownership.json'), JSON.stringify({ worldId: world.id, runnerPid: process.pid, hostPid: sleepChild.pid, hostPort: pl.port, mockPort: null }, null, 2))
console.log(`U5-IN-RUN ${world.id} ${world.home} ${sleepChild.pid}`)
// hold the lease file on disk; when the supervisor SIGKILLs THIS process the
// lease + fake-host + home are exactly the crash-recovery mess to clean.
await new Promise(() => {})
