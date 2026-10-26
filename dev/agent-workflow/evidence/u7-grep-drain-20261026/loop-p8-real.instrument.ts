/**
 * u7 grep-drain LOAD LOOP (evidence instrument, NOT a committed suite).
 * Copied into packages/runtime/test/ for the run, removed after; the copy kept
 * in the evidence directory is this file verbatim.
 *
 * Leg REAL: the hosted P8 shape through the REAL launcher + REAL packaged rg
 * (`pattern: '('`), N times. Every answer that is not `walker-invalid-pattern`
 * is a misjudgement.
 * Env: U7GD_LOOPS (default 500), U7GD_OUT (jsonl summary path),
 * U7GD_ROW=master loads `search-backend.master-probe.mjs` (the origin/master
 * blob written beside the lane file for the BEFORE run, removed after).
 */
import { afterAll, describe, expect, it } from 'vitest'
import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { buildSearchFixture, confinedConf, destroyWorldVerified, loadSearchBackendRow, newWorld, searchCall } from './alpha5-search-harness.js'

const ENV = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env ?? {}
const LOOPS = Number(ENV['U7GD_LOOPS'] ?? '500')
const WORLD = newWorld('u7grep-loop')
const ROOT = join(WORLD, 'root')

afterAll(() => destroyWorldVerified(WORLD))

describe('u7 grep-drain load loop', () => {
  it(`REAL P8 x${String(LOOPS)}`, async () => {
    buildSearchFixture(ROOT)
    const row = ENV['U7GD_ROW'] === 'master'
      ? (await import(new URL('../../tools/search-family/src/search-backend.master-probe.mjs', import.meta.url).href)) as Awaited<ReturnType<typeof loadSearchBackendRow>>
      : await loadSearchBackendRow()
    const backend = row.createAnchoredRgSearchBackend({ realmId: 'a5srgp-realm', rootDir: ROOT, confined: confinedConf(WORLD) })
    const tally: Record<string, number> = {}
    const ms: number[] = []
    for (let i = 0; i < LOOPS; i += 1) {
      const t0 = Date.now()
      const r = await backend.run(searchCall(`loop-${String(i)}`, { pattern: '(' }) as never, { sink: { write: () => {} } })
      ms.push(Date.now() - t0)
      const k = r.ok ? 'ADMITTED' : String(r.failure.code)
      tally[k] = (tally[k] ?? 0) + 1
    }
    ms.sort((a, b) => a - b)
    const summary = { leg: 'real-P8', row: ENV['U7GD_ROW'] ?? 'tree', loops: LOOPS, tally, p50: ms[Math.floor(LOOPS / 2)], p99: ms[Math.floor(LOOPS * 0.99)], max: ms[LOOPS - 1] }
    console.info(`[u7gd] ${JSON.stringify(summary)}`)
    if (ENV['U7GD_OUT']) writeFileSync(ENV['U7GD_OUT'], `${JSON.stringify(summary)}\n`, { flag: 'a' })
    expect(tally).toEqual({ 'walker-invalid-pattern': LOOPS })
  }, 3_600_000)
})
