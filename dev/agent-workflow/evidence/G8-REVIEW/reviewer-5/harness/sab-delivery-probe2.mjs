/**
 * sab-delivery-probe2.mjs — polling variant: does the driver ever observe
 * the worker's SAB store during repeated short Atomics.wait calls, and
 * when (relative to driver time)? Worker logs its own receive time.
 */
import { Worker } from 'node:worker_threads'
import { writeFileSync, mkdtempSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

const workerSrc = `
import { parentPort } from 'node:worker_threads'
const T0 = Date.now()
parentPort.on('message', (msg) => {
  console.error(\`w +\${Date.now() - T0}ms: message received\`)
  const view = new Int32Array(msg.sab)
  view[1] = 7
  view[0] = 1
  console.error(\`w +\${Date.now() - T0}ms: store done\`)
})
setInterval(() => {}, 1 << 30)
`
const dir = mkdtempSync(join(tmpdir(), 'g8r5-probe2-'))
const workerFile = join(dir, 'probe-worker2.mjs')
writeFileSync(workerFile, workerSrc)

const worker = new Worker(workerFile)
const sab = new SharedArrayBuffer(64)
const view = new Int32Array(sab)
const T0 = Date.now()
const dt = () => `+${Date.now() - T0}ms`
console.error(`d ${dt()}: posting`)
worker.postMessage({ type: 'ping', sab })

// Poll with short waits for up to 10s.
const end = Date.now() + 10_000
let n = 0
while (Date.now() < end) {
  const status = Atomics.wait(view, 0, 0, 50)
  n += 1
  if (view[0] !== 0) {
    console.log(`d ${dt()}: iter=${n} status=${status} OBSERVED done=${view[0]} len=${view[1]}`)
    break
  }
  if (status === 'not-equal') {
    console.log(`d ${dt()}: iter=${n} status=${status} done=${view[0]} len=${view[1]}`)
    break
  }
}
if (view[0] === 0) {
  console.log(`d ${dt()}: NEVER OBSERVED after ${n} iters; final read done=${view[0]} len=${view[1]}`)
}
worker.terminate()
