/**
 * sab-portcall-probe.mjs — single case: world build + REAL port call
 * (catalog.list, the exact code path of the failing worker) + store
 * sequence. If len=0, the port call / its result is the factor.
 */
import { Worker } from 'node:worker_threads'
import { join } from 'node:path'
import { writeFileSync } from 'node:fs'

const HERE = import.meta.dirname
const N = 92

const code = `
  import { parentPort } from 'node:worker_threads'
  import { register } from 'node:module'
  import { join, dirname } from 'node:path'
  import { fileURLToPath, pathToFileURL } from 'node:url'
  const HERE = dirname(fileURLToPath(import.meta.url))
  register(pathToFileURL(join(HERE, 'ts-loader.mjs')).href, import.meta.url)
  const { buildWorld } = await import('./world-build.mjs')
  const world = await buildWorld()
  parentPort.on('message', async (msg) => {
    const sab = msg.sab
    const view = new Int32Array(sab)
    const value = world.ports['catalog.list']()
    const data = new Uint8Array(sab, 8, ${N})
    for (let i = 0; i < ${N}; i++) data[i] = (i * 13 + 1) & 0xff
    Atomics.store(view, 1, ${N})
    Atomics.store(view, 0, 1)
  })
`

writeFileSync(join(HERE, 'portcall-worker.mjs'), code)
const worker = new Worker(join(HERE, 'portcall-worker.mjs'))
worker.on('error', (error) => console.log(`WORKER ERROR: ${error?.message}`))
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
console.log(
  `portcall: done@+${tDone === null ? 'TIMEOUT' : tDone + 'ms'} firstLen=${first} reReads=[${reReads.join(', ')}]`
)
worker.terminate()
