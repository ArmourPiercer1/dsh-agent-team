/**
 * sab-delivery-probe3.mjs — control: worker uses PROPER Atomics.store
 * (the operation guaranteed to notify Atomics.wait waiters), immediate
 * write + a 1s-delayed second write, to settle notification semantics.
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
  Atomics.store(view, 1, 7)
  Atomics.store(view, 0, 1)
  console.error(\`w +\${Date.now() - T0}ms: Atomics.store done\`)
  setTimeout(() => {
    Atomics.store(view, 3, 42)
    console.error(\`w +\${Date.now() - T0}ms: delayed store done\`)
  }, 1000)
})
setInterval(() => {}, 1 << 30)
`
const dir = mkdtempSync(join(tmpdir(), 'g8r5-probe3-'))
const workerFile = join(dir, 'probe-worker3.mjs')
writeFileSync(workerFile, workerSrc)

const worker = new Worker(workerFile)
const sab = new SharedArrayBuffer(16)
const view = new Int32Array(sab)
const T0 = Date.now()
const dt = () => `+${Date.now() - T0}ms`
console.error(`d ${dt()}: posting`)
worker.postMessage({ type: 'ping', sab })
console.error(`d ${dt()}: wait-1 (index0, 8s)`)
const s1 = Atomics.wait(view, 0, 0, 8_000)
console.log(`d ${dt()}: wait-1=${s1} done=${view[0]} len=${view[1]}`)
console.error(`d ${dt()}: wait-2 (index3, 8s)`)
const s2 = Atomics.wait(view, 3, 0, 8_000)
console.log(`d ${dt()}: wait-2=${s2} slot3=${view[3]}`)
worker.terminate()
