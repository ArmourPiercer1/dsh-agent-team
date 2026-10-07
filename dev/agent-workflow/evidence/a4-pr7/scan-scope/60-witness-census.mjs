#!/usr/bin/env node
/**
 * 60-witness-census.mjs — the measurement that retired the class (R3, 2026-10-08).
 *
 * QUESTION: for how many DIRTY sites does the round-5 admission rule accept SOME
 * witness today? Not the key the report named — ANY key in the site's own legal
 * window. Answer decides the class: 63 of 87 admitted, and every one of those
 * sites is document-shaped — the ordinary keys of a Blueprint file (`code:`,
 * `source:`, `items:`) are admissible witnesses against the file they document.
 *
 * METHOD — behavioral, not simulated: for each OFFENDING site, probe up to 8
 * nearest window tokens (code/string lines only, leading-comment lines skipped;
 * tokens outside the fence's own exported forbidden set) by spawning the fence
 * with a single-row ledger and recording exit != 2 as admitted. A site counting
 * as admitted means the SHIPPED gate let that row through, with the shipped
 * radius, comment masking and width caps — nothing re-implemented here.
 * Per-site probing stops at the first admitted token, so the census is a LOWER
 * BOUND on the surface and the histogram names the cheapest witness FOUND, not
 * provably THE cheapest.
 *
 * THIS SCRIPT HAS NO ADMISSION PATH BY DESIGN: it measures and prints; it exits
 * 0 only if it produced a non-empty census (a run that classified zero dirty
 * sites is a broken harness, not a clean result). Run against the fence and tree
 * it labels on stdout; historical numbers live in this directory, not in the
 * fence's runtime.
 */
import { execFileSync, execSync } from 'node:child_process'
import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { readFileSync } from 'node:fs'

const cwd = process.cwd()
const SCRATCH = '.tmp-census'
rmSync(SCRATCH, { recursive: true, force: true })
mkdirSync(SCRATCH, { recursive: true })

const fencePath = process.env.CENSUS_FENCE ?? 'scripts/verify-blueprint-version-clean.mjs'
const fenceMod = await import(resolve(cwd, fencePath))
const derive = fenceMod.deriveSchemaWitnessForbidden
if (typeof derive !== 'function') {
  console.error('census needs the fence to export deriveSchemaWitnessForbidden — the class under census is gone; label CENSUS_FENCE at the fence whose surface you are measuring')
  process.exit(3)
}
const derived = derive(cwd)
if ('error' in derived) {
  console.error(`census refused: ${derived.error}`)
  process.exit(3)
}
const forbidden = derived.keys

let scanOut = ''
try {
  scanOut = execFileSync(process.execPath, [fencePath], { cwd, encoding: 'utf8' })
} catch (e) {
  scanOut = String(e.stdout ?? '')
}
const sites = []
for (const l of scanOut.split('\n')) {
  if (!l.startsWith('OFFENDING ')) continue
  const path = l.split(' :: ')[0].slice('OFFENDING '.length)
  for (const m of l.matchAll(/L(\d+)=v(\d+)/g)) sites.push([path, Number(m[1]), Number(m[2])])
}
if (sites.length === 0) {
  console.error('CENSUS NOT-EMPTY FLOOR: the fence classified zero dirty sites — nothing was measured. exit 3, never a green.')
  process.exit(3)
}
console.log(`dirty sites under census: ${String(sites.length)}`)

const row = (path, w, from, to) =>
  `intentionally-dirty: census probe (no human row — this is the point); foreign-axis: census-of-admission-surface; witness-key: ${w}; owner: census; retirement-check: n/a census artifact; hand-verified ${path}:${String(from)}-${String(to)}`

const admitted = []
const refusedAll = []
const histogram = new Map()
const MAX_PROBES = 8
for (const [path, line, v] of sites) {
  let lines
  try {
    lines = readFileSync(resolve(cwd, path), 'utf8').split('\n')
  } catch {
    refusedAll.push([path, line, v, 'unreadable'])
    continue
  }
  const cands = []
  const seenTok = new Set(['schemaVersion'])
  const order = []
  for (let d = 1; d <= 11; d += 1) {
    for (const k of [line - 1 - d, line - 1 + d]) {
      if (k < 0 || k >= lines.length) continue
      const L = String(lines[k])
      if (/^\s*(\/\/|\*|\/\*)/.test(L)) continue
      for (const m of L.matchAll(/([A-Za-z_$][A-Za-z0-9_$]*)\s*:/g)) order.push([String(m[1]), k + 1])
    }
  }
  for (const [tok, wl] of order) {
    if (seenTok.has(tok)) continue
    seenTok.add(tok)
    if (forbidden.has(tok)) continue
    cands.push([tok, wl])
    if (cands.length >= MAX_PROBES) break
  }
  let got = null
  for (const [tok, wl] of cands) {
    const from = Math.min(line, wl)
    const to = Math.max(line, wl)
    const f = resolve(cwd, SCRATCH, 'c.json')
    writeFileSync(f, JSON.stringify({ [`${path}::L${String(line)}::v${String(v)}`]: row(path, tok, from, to) }))
    let status = 0
    try {
      execFileSync(process.execPath, [fencePath], {
        cwd,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
        env: { ...process.env, DSH_SCAN_ADJUDICATIONS: f, DSH_SCAN_TEST_MODE: '1' },
      })
    } catch (e) {
      status = e.status ?? -1
    }
    if (status !== 2) {
      got = tok
      break
    }
  }
  if (got !== null) {
    admitted.push([path, line, v, got])
    histogram.set(got, (histogram.get(got) ?? 0) + 1)
  } else {
    refusedAll.push([path, line, v, cands.length === 0 ? 'no-candidate' : `all-${String(cands.length)}-refused`])
  }
}
const sha = execSync('git rev-parse --short HEAD', { cwd }).toString().trim()
console.log(`census base: tree@${sha} fence=${fencePath}`)
console.log(`ADMITTED ${String(admitted.length)} of ${String(sites.length)} dirty sites (lower bound: <=${String(MAX_PROBES)} nearest candidates probed per site)`)
console.log(`cheapest-witness histogram (admitted sites): ${[...histogram.entries()].sort((a, b) => b[1] - a[1]).map(([k, n]) => `${k} x${String(n)}`).join(', ')}`)
for (const [p, l, v, w] of admitted) console.log(`OPEN  ${p}::L${String(l)}::v${String(v)}  via ${w}`)
for (const [p, l, v, why] of refusedAll) console.log(`HELD  ${p}::L${String(l)}::v${String(v)}  ${why}`)
rmSync(SCRATCH, { recursive: true, force: true })
process.exit(0)
