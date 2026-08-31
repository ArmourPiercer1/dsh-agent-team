/**
 * G8-R5 catalog-probe — targeted in-process validation of the FIXED
 * `catalog.list` port adapter (run #7 defect: adapter double-wrapped the
 * array; the frozen handler remote/src/handlers/catalog.ts L23-26 already
 * adds the `blueprints` key: `const blueprints = deps.list();
 * return { data: { blueprints } }`).
 *
 * Checks:
 *   1. ports['catalog.list']() returns a BARE ARRAY (not {blueprints: [...]}).
 *   2. The simulated frozen-handler wrap `{ blueprints: <array> }` yields a
 *      record whose `blueprints` is an array containing P6T2-BP with
 *      revisions ['1'] and latest '1' (matches the run #7 live health body
 *      minus the double wrap).
 *   3. catalog.get still returns the resolved blueprint object (unchanged).
 */
import { register } from 'node:module'
import { appendFileSync, rmSync, mkdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const fail = (msg) => {
  appendFileSync(join(HERE, 'catalog-probe.log'), `[${new Date().toISOString()}] FAIL ${msg}\n`)
  console.error(`FAIL: ${msg}`)
  process.exit(1)
}

const PACKAGES_DIR = process.env.G8R5_PACKAGES_DIR
if (!PACKAGES_DIR) fail('G8R5_PACKAGES_DIR env missing')
const DATA_DIR = join(HERE, 'repro-data-catalog')
rmSync(DATA_DIR, { recursive: true, force: true })
mkdirSync(DATA_DIR, { recursive: true })
process.env.G8R5_DATA_DIR = DATA_DIR

register(pathToFileURL(join(HERE, 'ts-loader.mjs')).href, import.meta.url)

const { buildWorld } = await import('./world-build.mjs')
const t0 = Date.now()
const { ports } = await buildWorld()
const buildMs = Date.now() - t0

const raw = ports['catalog.list']()
if (!Array.isArray(raw)) fail(`catalog.list port must return a bare array, got ${typeof raw}`)
if (raw.length !== 1) fail(`expected exactly 1 blueprint, got ${raw.length}`)
const bp = raw[0]
if (bp.blueprintId !== 'P6T2-BP') fail(`blueprintId (got ${String(bp.blueprintId)})`)
if (!Array.isArray(bp.revisions) || bp.revisions.length !== 1 || bp.revisions[0] !== '1') {
  fail(`revisions (got ${JSON.stringify(bp.revisions)})`)
}
if (bp.latest !== '1') fail(`latest (got ${String(bp.latest)})`)

// Simulate the frozen handler wrap (catalog.ts L23-26)
const handlerResult = { data: { blueprints: raw } }
if (!Array.isArray(handlerResult.data.blueprints)) fail('simulated handler wrap: data.blueprints not an array')
if (!JSON.stringify(handlerResult.data.blueprints).includes('P6T2-BP')) fail('simulated handler wrap: P6T2-BP missing')

const resolved = ports['catalog.get']('P6T2-BP', undefined)
if (typeof resolved !== 'object' || resolved === null || !('leader' in resolved)) {
  fail(`catalog.get must return the resolved blueprint object (got ${typeof resolved})`)
}

appendFileSync(
  join(HERE, 'catalog-probe.log'),
  `[${new Date().toISOString()}] PASS bare-array port; simulated wrap data.blueprints[1]=P6T2-BP revs=[1] latest=1; catalog.get resolved; build ${buildMs}ms\n`,
)
console.log(`CATALOG-PROBE PASS (world build ${buildMs}ms)`)
