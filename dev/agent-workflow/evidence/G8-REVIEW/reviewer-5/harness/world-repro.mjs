/**
 * world-repro.mjs — in-process reproduction of the worker world path:
 * registers the same ts-loader, builds the world, and calls the exact
 * health-check port (catalog.list with the dispatcher's parsed params).
 * Prints the real error + stack instead of the invariant-5 generic message.
 */
import { register } from 'node:module'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

const HERE = import.meta.dirname
const PACKAGES = process.env.G8R5_PACKAGES_DIR
const DATA_DIR = process.env.G8R5_DATA_DIR
if (!PACKAGES || !DATA_DIR) {
  console.error('usage: G8R5_PACKAGES_DIR=... G8R5_DATA_DIR=... node world-repro.mjs')
  process.exit(2)
}
process.stdout.write(`world-repro: packages=${PACKAGES}\n`)
process.stdout.write(`world-repro: dataDir=${DATA_DIR}\n`)

register(pathToFileURL(join(HERE, 'ts-loader.mjs')).href, import.meta.url)

try {
  const t0 = Date.now()
  const { buildWorld } = await import('./world-build.mjs')
  const world = await buildWorld()
  process.stdout.write(`world built in ${Date.now() - t0} ms; ports=${Object.keys(world.ports).length}\n`)

  const t1 = Date.now()
  const result = world.ports['catalog.list']()
  process.stdout.write(`catalog.list ok in ${Date.now() - t1} ms:\n`)
  process.stdout.write(JSON.stringify(result, null, 1).slice(0, 2000) + '\n')

  const { serialize, deserialize } = await import('node:v8')
  try {
    const bytes = serialize({ ok: true, value: result })
    const round = deserialize(bytes)
    process.stdout.write(`v8 round-trip OK: ${bytes.byteLength} bytes, deepEqual=${JSON.stringify(round) === JSON.stringify(result)}\n`)
  } catch (error) {
    process.stdout.write(`V8-SERIALIZE FAILED: ${error?.name}: ${error?.message}\n`)
    process.exitCode = 1
  }
  process.exitCode = process.exitCode ?? 0
} catch (error) {
  process.stdout.write(`WORLD-REPRO ERROR: ${error?.name}: ${error?.message}\n`)
  process.stdout.write(String(error?.stack ?? error) + '\n')
  process.exitCode = 1
}
