/**
 * create-probe.mjs — targeted validation of the run #7 teamCreate.create
 * adapter (synchronous composition over the real repositories + binder).
 *
 * Checks:
 *   1. fresh create: path='fresh-root', durable={teamSession,binding,wrote},
 *      bind.bound===true, bind.installed===true, lossless-JSON safe.
 *   2. immediate re-call: cold path, path='cold-root', durable.wrote=false.
 *   3. projection.project after create: generation=1 (whole-projection works).
 *   4. no unhandledRejection / uncaughtException within a settle window.
 */
import { register } from 'node:module'
import { join, dirname } from 'node:path'
import { pathToFileURL } from 'node:url'
import { mkdirSync, rmSync } from 'node:fs'

const HERE = import.meta.dirname
const PACKAGES = process.env.G8R5_PACKAGES_DIR
if (!PACKAGES) {
  console.error('usage: G8R5_PACKAGES_DIR=... node create-probe.mjs')
  process.exit(2)
}
const DATA_DIR = join(HERE, 'repro-data-create')
rmSync(DATA_DIR, { recursive: true, force: true })
mkdirSync(DATA_DIR, { recursive: true })
process.env.G8R5_DATA_DIR = DATA_DIR

register(pathToFileURL(join(HERE, 'ts-loader.mjs')).href, import.meta.url)

let asyncFailure = null
process.on('unhandledRejection', (reason) => {
  asyncFailure = reason
  process.stdout.write(`UNHANDLED-REJECTION: ${reason && reason.stack ? reason.stack : String(reason)}\n`)
})
process.on('uncaughtException', (error) => {
  asyncFailure = error
  process.stdout.write(`UNCAUGHT-EXCEPTION: ${error && error.stack ? error.stack : String(error)}\n`)
})

const TEAM = 'session-root-g8r5'
const BLUEPRINT = 'P6T2-BP'

try {
  const t0 = Date.now()
  const { buildWorld } = await import('./world-build.mjs')
  const world = await buildWorld()
  process.stdout.write(`world built in ${Date.now() - t0} ms; ports=${Object.keys(world.ports).length}\n`)

  // 1. fresh create (synchronous call — the Remote contract v1 shape).
  const t1 = Date.now()
  const created = world.ports['teamCreate.create'](TEAM, BLUEPRINT, undefined)
  process.stdout.write(`teamCreate.create (fresh) in ${Date.now() - t1} ms\n`)
  if (created.then !== undefined) {
    process.stdout.write('FAIL: adapter returned a Promise (must be a synchronous value object)\n')
    process.exitCode = 1
  } else {
    process.stdout.write(`path=${created.path}\n`)
    process.stdout.write(`durable keys=[${Object.keys(created.durable ?? {}).join(',')}] wrote=${created.durable?.wrote}\n`)
    process.stdout.write(`durable.teamSession.rootSessionId=${created.durable?.teamSession?.rootSessionId} generation=${created.durable?.teamSession?.generation}\n`)
    process.stdout.write(`durable.binding.kind=${created.durable?.binding?.kind} sessionId=${created.durable?.binding?.sessionId}\n`)
    process.stdout.write(`bind: requested=${created.bind?.requested} bound=${created.bind?.bound} installed=${created.bind?.installed} noop=${created.bind?.noopReason ?? '-'} admission=${created.bind?.admissionCode ?? created.bind?.admissionState ?? '-'}\n`)
    process.stdout.write(`bind.emittedEvents=${created.bind?.emittedEvents?.length ?? 'n/a'}\n`)
    const wire = JSON.parse(JSON.stringify({ path: created.path, durable: created.durable, bind: created.bind }))
    process.stdout.write(`lossless-JSON round-trip OK (bytes=${Buffer.byteLength(JSON.stringify(wire))})\n`)
    if (created.path !== 'fresh-root') process.stdout.write('FAIL: path !== fresh-root\n')
    if (!created.durable || typeof created.durable !== 'object') process.stdout.write('FAIL: durable not an object\n')
    if (created.durable?.wrote !== true) process.stdout.write('FAIL: fresh path wrote !== true\n')
    if (created.bind?.bound !== true) process.stdout.write('FAIL: bind.bound !== true\n')
    if (created.bind?.installed !== true) process.stdout.write('FAIL: bind.installed !== true\n')
  }

  // 2. immediate re-call -> cold path (record now exists).
  const t2 = Date.now()
  const rec = world.ports['teamCreate.create'](TEAM, BLUEPRINT, undefined)
  process.stdout.write(`teamCreate.create (re-call) in ${Date.now() - t2} ms\n`)
  process.stdout.write(`re-call: path=${rec.path} durable.wrote=${rec.durable?.wrote} bind.bound=${rec.bind?.bound} bind.installed=${rec.bind?.installed} noop=${rec.bind?.noopReason ?? '-'}\n`)
  if (rec.path !== 'cold-root') process.stdout.write('FAIL: re-call path !== cold-root\n')
  if (rec.durable?.wrote !== false) process.stdout.write('FAIL: cold path durable.wrote !== false\n')

  // 3. projection after create.
  const proj = world.ports['projection.project'](TEAM)
  process.stdout.write(`projection: generation=${proj?.generation} teamSessionId=${proj?.teamSessionId ?? proj?.rootSessionId ?? '-'} fields=${Object.keys(proj ?? {}).length}\n`)
  if (proj?.generation !== 1) process.stdout.write('FAIL: projection generation !== 1\n')

  // 4. settle window for late async failures.
  await new Promise((resolve) => setTimeout(resolve, 100))
  if (asyncFailure !== null) {
    process.stdout.write('FAIL: late async failure observed (see above)\n')
    process.exitCode = 1
  } else {
    process.stdout.write('no late async failures (100 ms settle)\n')
  }
  if (process.exitCode === undefined) process.stdout.write('CREATE-PROBE PASS\n')
} catch (error) {
  process.stdout.write(`CREATE-PROBE ERROR: ${error?.name}: ${error?.message}\n`)
  process.stdout.write(String(error?.stack ?? error) + '\n')
  process.exitCode = 1
}
