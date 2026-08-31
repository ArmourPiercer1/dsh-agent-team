/**
 * sab-factor-probe.mjs — bisect the real worker's unique factors:
 *  case-loader-only: trivial ESM worker that ONLY registers the ts-loader
 *     (module.register -> dedicated loader thread) then does the store
 *     sequence. If len=0, module.register corrupts this thread's atomics.
 *  case-world-only: ESM worker that registers the loader AND builds the
 *     full world (23 TS modules, domain, runtime) then does the store
 *     sequence. If len=0 here but fine in loader-only, the world build
 *     is the factor.
 */
import { Worker } from 'node:worker_threads'
import { join } from 'node:path'
import { writeFileSync } from 'node:fs'

const HERE = import.meta.dirname
const N = 92

writeFileSync(
  join(HERE, 'noop-loader.mjs'),
  'export async function resolve(specifier, context, next) { return next(specifier, context) }\n'
)

function makeWorkerCode(mode) {
  const body =
    mode === 'loader-only'
      ? `
      const loaderUrl = pathToFileURL(join(HERE, 'noop-loader.mjs')).href
      register(loaderUrl, import.meta.url)
      await new Promise((r) => setTimeout(r, 100))
      `
      : `
      const loaderUrl = pathToFileURL(join(HERE, 'ts-loader.mjs')).href
      register(loaderUrl, import.meta.url)
      const { buildWorld } = await import('./world-build.mjs')
      const world = await buildWorld()
      `
  return `
    import { parentPort } from 'node:worker_threads'
    import { register } from 'node:module'
    import { join, dirname } from 'node:path'
    import { fileURLToPath, pathToFileURL } from 'node:url'
    const HERE = dirname(fileURLToPath(import.meta.url))
    parentPort.on('message', async (msg) => {
      const sab = msg.sab
      const view = new Int32Array(sab)
      ${body}
      const data = new Uint8Array(sab, 8, ${N})
      for (let i = 0; i < ${N}; i++) data[i] = (i * 13 + 1) & 0xff
      Atomics.store(view, 1, ${N})
      Atomics.store(view, 0, 1)
    })
  `
}

async function runCase(label, workerPath) {
  const worker = new Worker(workerPath)
  worker.on('error', (error) => console.log(`${label} WORKER ERROR: ${error?.message}`))
  const sab = new SharedArrayBuffer(16 * 1024 * 1024)
  const view = new Int32Array(sab)
  const T0 = Date.now()
  worker.postMessage({ sab })
  const deadline = Date.now() + 60_000
  let tDone = null
  while (Date.now() < deadline) {
    if (Atomics.load(view, 0) !== 0) {
      tDone = Date.now() - T0
      break
    }
  }
  const first = Atomics.load(view, 1)
  const reReads = []
  const tEnd = Date.now() + 100
  while (Date.now() < tEnd) {
    reReads.push(Atomics.load(view, 1))
    const t = Date.now()
    while (Date.now() - t < 20) {}
  }
  console.log(`${label}: done@+${tDone === null ? 'TIMEOUT' : tDone + 'ms'} firstLen=${first} reReads=[${reReads.join(', ')}]`)
  worker.terminate()
}

writeFileSync(join(HERE, 'factor-worker-loader.mjs'), makeWorkerCode('loader-only'))
await runCase('case-loader-only', join(HERE, 'factor-worker-loader.mjs'))
writeFileSync(join(HERE, 'factor-worker-world.mjs'), makeWorkerCode('world-only'))
await runCase('case-world-only ', join(HERE, 'factor-worker-world.mjs'))
