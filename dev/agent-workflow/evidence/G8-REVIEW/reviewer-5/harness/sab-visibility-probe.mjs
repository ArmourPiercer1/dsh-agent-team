/**
 * sab-visibility-probe.mjs — decisive measurement for the mailbox design.
 *
 * Question: in this sandboxed Windows + Node v24.20.0 build, after a
 * worker thread performs plain data writes + Atomics.store(len) +
 * Atomics.store(done), WHEN does each become visible to a parent thread
 * that polls with Atomics.wait(20ms)? (sab-delivery-probe3.mjs already
 * proved the notification half is broken; this probe measures the
 * VISIBILITY half: len store and bulk data bytes.)
 *
 * The worker writes 100KB of patterned data, stores len+done once, then
 * RE-STORES len+done 10 more times over 200ms (candidate fix pattern).
 * The parent polls done, then polls len, then checks data bytes at two
 * time points. Also verifies worker-side appendFileSync works (kills the
 * "diag silently failed" theory).
 */
import { Worker } from 'node:worker_threads'
import { join } from 'node:path'

const N = 102400

const workerCode = `
  const { parentPort } = require('node:worker_threads')
  const fs = require('node:fs')
  parentPort.on('message', (msg) => {
    const sab = msg.sab
    const diagPath = msg.diagPath
    const view = new Int32Array(sab)
    const data = new Uint8Array(sab, 8, ${N})
    for (let i = 0; i < ${N}; i++) data[i] = (i * 7 + 3) & 0xff
    const log = (line) => {
      try { fs.appendFileSync(diagPath, '[' + new Date().toISOString() + '] ' + line + '\\n') } catch {}
    }
    const store = () => {
      Atomics.store(view, 1, ${N})
      Atomics.store(view, 0, 1)
    }
    log('worker: data written, first store now')
    store()
    for (let k = 0; k < 10; k++) {
      setTimeout(() => { log('worker: re-store ' + (k + 1)); store() }, 20 * (k + 1))
    }
  })
`

const dir = import.meta.dirname
const diagPath = join(dir, 'probe-worker-fs.log')
const { rmSync } = await import('node:fs')
rmSync(diagPath, { force: true })
const worker = new Worker(workerCode, { eval: true })
worker.on('error', (error) => console.log(`WORKER ERROR: ${error?.message}`))
worker.on('exit', (code) => console.log(`WORKER EXIT code=${code}`))

const sab = new SharedArrayBuffer(16 * 1024 * 1024)
const view = new Int32Array(sab)
const T0 = Date.now()
const deadline = Date.now() + 30_000
worker.postMessage({ sab, diagPath })

let tDone = null
for (;;) {
  if (Atomics.load(view, 0) !== 0) {
    tDone = Date.now() - T0
    break
  }
  if (Date.now() >= deadline) break
  Atomics.wait(view, 0, 0, 20)
}
console.log(`done visible at +${tDone === null ? 'TIMEOUT(30s)' : tDone + 'ms'}`)

if (tDone !== null) {
  let tLen = null
  for (;;) {
    const len = Atomics.load(view, 1)
    if (len !== 0) {
      tLen = Date.now() - T0
      console.log(`len visible (${len}) at +${tLen}ms`)
      break
    }
    if (Date.now() >= deadline) {
      console.log('len STILL 0 after full 30s deadline')
      break
    }
    Atomics.wait(view, 1, 0, 20)
  }
  const check = (label) => {
    const data = new Uint8Array(sab, 8, N)
    let bad = 0
    for (let i = 0; i < N; i++) {
      if (data[i] !== ((i * 7 + 3) & 0xff)) bad++
    }
    console.log(`data ${label}: bad=${bad}/${N} at +${Date.now() - T0}ms`)
  }
  check('immediately after len-visible')
  setTimeout(() => {
    check('after +300ms more')
    worker.terminate()
  }, 300)
} else {
  worker.terminate()
}
