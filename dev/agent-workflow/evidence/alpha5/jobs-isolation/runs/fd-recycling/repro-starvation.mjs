#!/usr/bin/env node
/* #349 census fd-recycling RED repro (deterministic, no CI luck).
 * LAW (POSIX): open() returns the LOWEST free fd. The poc3-probes E leg
 * waits for the OS to hand its captured number BACK. The nine-root census
 * runs every test file as worker_threads in ONE process - the fd table is
 * PROCESS-WIDE - so any other holder that keeps the number alive for the
 * probe's whole window starves it for every one of the 500 held-open
 * attempts: each probe lands ABOVE the number, and held misses can only
 * shrink the FREE set, never take a HELD one. Identity of the holder is
 * irrelevant to the mechanism (shared table), so this repro holds the
 * number synchronously in-process - exactly what a long-lived concurrent
 * handle does in census. exit 0 + STARVED line = the diagnosis is law. */
import { openSync, closeSync, writeFileSync, mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
const dir = mkdtempSync(join(tmpdir(), 'fdrecip-'))
writeFileSync(join(dir, 'x.txt'), 'x')
const laneFd = openSync(join(dir, 'x.txt'), 'r') // the lane stand-in opens...
closeSync(laneFd) // ...and closes: the number is free
const holder = openSync(join(dir, 'x.txt'), 'r') // a concurrent LONG-LIVED holder takes it
let recycled = -1
const held = []
const probes = []
for (let attempt = 0; attempt < 500 && recycled !== laneFd; attempt += 1) {
  const probe = openSync(join(dir, 'x.txt'), 'r')
  if (probe === laneFd) { recycled = probe; break }
  if (probes.length < 5) probes.push(probe)
  held.push(probe)
  if (held.length >= 128) closeSync(held.shift())
}
for (const fd of held) closeSync(fd)
closeSync(holder) // only NOW the number frees - and the next open proves the law
const afterRelease = openSync(join(dir, 'x.txt'), 'r')
closeSync(afterRelease)
if (recycled === -1) {
  console.log(`STARVED-as-diagnosed: captured=${laneFd} held for the window; first probes=[${probes.join(',')}] all ABOVE it`)
  console.log(`after the holder closes, the number returns immediately: next open = ${afterRelease}`)
  console.log('RED-CONFIRMED: in-process waiting cannot force the number back - the held-open retry is starvable BY LAW under a shared fd table with a long-lived holder')
  process.exit(0)
}
console.log(`UNEXPECTED: probe landed on ${recycled} while the holder lived - diagnosis wrong`)
process.exit(1)
