/**
 * sab-delivery-probe.mjs — minimal controlled experiment: does a
 * worker.postMessage() get delivered to the worker while the parent's
 * main thread is blocked in Atomics.wait on a shared SAB?
 * Worker: on message -> immediately store 1 into the SAB (no world, no
 * imports). Parent: post, Atomics.wait(10s), report.
 */
import { Worker } from 'node:worker_threads'
import { writeFileSync, mkdtempSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

const workerSrc = `
import { parentPort } from 'node:worker_threads'
parentPort.on('message', (msg) => {
  const view = new Int32Array(msg.sab)
  view[0] = 1
  view[1] = 7
})
setInterval(() => {}, 1 << 30)
`
const dir = mkdtempSync(join(tmpdir(), 'g8r5-probe-'))
const workerFile = join(dir, 'probe-worker.mjs')
writeFileSync(workerFile, workerSrc)

const worker = new Worker(workerFile)
const sab = new SharedArrayBuffer(64)
const view = new Int32Array(sab)
const T0 = Date.now()
const dt = () => `+${Date.now() - T0}ms`
console.error(`probe ${dt()}: posting`)
worker.postMessage({ type: 'ping', sab })
console.error(`probe ${dt()}: blocking in Atomics.wait(10s)`)
const status = Atomics.wait(view, 0, 0, 10_000)
console.log(`probe ${dt()}: status=${status} done=${view[0]} len=${view[1]}`)
worker.terminate()
