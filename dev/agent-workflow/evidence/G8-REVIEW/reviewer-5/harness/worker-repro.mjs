/**
 * worker-repro.mjs — spawns the REAL world-worker.mjs (its own ts-loader
 * registration, its own lazy world build) and makes ONE protocol-exact
 * catalog.list call through the SAB mailbox. Isolates worker-thread
 * behavior from the DSH host. Prints the worker reply + worker stderr.
 */
import { Worker } from 'node:worker_threads'
import { join } from 'node:path'

const HERE = import.meta.dirname

const worker = new Worker(join(HERE, 'world-worker.mjs'))
worker.on('error', (error) => {
  console.log(`WORKER ERROR EVENT: ${error?.message}`)
})

const sab = new SharedArrayBuffer(16 * 1024 * 1024)
const view = new Int32Array(sab)
// Evidence: is a fresh SAB actually zeroed in this environment?
const head0 = new Uint8Array(sab, 8, 16)
console.log(
  `driver SAB fresh-check: done=${view[0]} len=${view[1]} head16=[${Array.from(head0).join(',')}] env NO_DIAG=${process.env.G8R5_NO_DIAG ?? '-'} NO_V8=${process.env.G8R5_NO_V8 ?? '-'}`
)
const T0 = Date.now()
const dt = () => `+${Date.now() - T0}ms`
console.error(`driver ${dt()}: posting call`)
worker.postMessage({ type: 'call', port: 'catalog.list', args: [], sab })
// Poll-and-wait (Atomics.wait notifications are broken in this env —
// see sab-delivery-probe3.mjs).
const deadline = Date.now() + 90_000
let observed = false
for (;;) {
  if (Atomics.load(view, 0) !== 0) {
    observed = true
    break
  }
  if (Date.now() >= deadline) break
  Atomics.wait(view, 0, 0, 20)
}
const len0 = Atomics.load(view, 1)
console.log(`driver ${dt()}: observed=${observed} done=${view[0]} len(slot1, now unused)=${len0}`)
// Len-less JSON protocol: scan for the top-level JSON end (retry on
// parse failure until the deadline — covers delayed data visibility).
const decoder = new TextDecoder()
function scanTopLevelJson() {
  const bytes = new Uint8Array(sab, 8, sab.byteLength - 8)
  if (bytes.length === 0 || bytes[0] !== 0x7b) return null // expect '{'
  let depth = 0
  let inString = false
  let escaped = false
  for (let i = 0; i < bytes.length; i++) {
    const c = bytes[i]
    if (inString) {
      if (escaped) escaped = false
      else if (c === 0x5c) escaped = true
      else if (c === 0x22) inString = false
      continue
    }
    if (c === 0x22) inString = true
    else if (c === 0x7b) depth++
    else if (c === 0x7d) {
      depth--
      if (depth === 0) {
        try {
          return JSON.parse(decoder.decode(bytes.subarray(0, i + 1)))
        } catch {
          return null
        }
      }
    }
  }
  return null
}
const scanDeadline = Date.now() + 10_000
let msg = null
let scans = 0
for (;;) {
  msg = scanTopLevelJson()
  scans++
  if (msg !== null) break
  if (Date.now() >= scanDeadline) break
  Atomics.wait(view, 0, 1, 20)
}
const head = new Uint8Array(sab, 8, 16)
console.log(`driver data head 16 bytes: [${Array.from(head).join(',')}] scans=${scans} at ${dt()}`)
if (msg !== null) {
  console.log(JSON.stringify(msg, null, 1).slice(0, 3000))
} else {
  console.log('NO PARSEABLE JSON IN MAILBOX (worker did not answer or data never settled)')
}
worker.terminate()
