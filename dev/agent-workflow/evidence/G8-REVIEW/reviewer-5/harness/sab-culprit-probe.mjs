/**
 * sab-culprit-probe.mjs — two cases:
 *  case-wait-stomp: TRIVIAL worker (300ms delay before stores) + parent
 *     using the CURRENT wait-based poll loop. If len=0 here, the parent's
 *     Atomics.wait(index0) calls corrupt the adjacent len slot in this
 *     environment. If len is visible, wait is innocent.
 *  case-real-nowait: the REAL world-worker.mjs + parent with a WAIT-FREE
 *     busy-spin poll. If len is visible here but the wait-based run shows
 *     len=0, the fix is wait-free polling in plugin.mjs syncCall.
 */
import { Worker } from 'node:worker_threads'
import { join } from 'node:path'
import { writeFileSync } from 'node:fs'

const HERE = import.meta.dirname
const N = 92

const trivialCode = `
  const { parentPort } = require('node:worker_threads')
  parentPort.on('message', async (msg) => {
    await new Promise((r) => setTimeout(r, 300))
    const sab = msg.sab
    const view = new Int32Array(sab)
    const data = new Uint8Array(sab, 8, ${N})
    for (let i = 0; i < ${N}; i++) data[i] = (i * 13 + 1) & 0xff
    Atomics.store(view, 1, ${N})
    Atomics.store(view, 0, 1)
  })
`

function summarize(label, tDone, first, reReads, head) {
  console.log(
    `${label}: done@+${tDone === null ? 'TIMEOUT' : tDone + 'ms'} firstLen=${first} reReads=[${reReads.join(', ')}] head8=[${Array.from(head).join(',')}]`
  )
}

// ---- case 1: trivial worker + wait-based driver (current style) ----
{
  const worker = new Worker(trivialCode, { eval: true })
  worker.on('error', (error) => console.log(`case-wait-stomp WORKER ERROR: ${error?.message}`))
  const sab = new SharedArrayBuffer(16 * 1024 * 1024)
  const view = new Int32Array(sab)
  const T0 = Date.now()
  worker.postMessage({ sab })
  const deadline = Date.now() + 15_000
  let tDone = null
  let waits = 0
  for (;;) {
    if (Atomics.load(view, 0) !== 0) {
      tDone = Date.now() - T0
      break
    }
    if (Date.now() >= deadline) break
    Atomics.wait(view, 0, 0, 20)
    waits++
  }
  const first = Atomics.load(view, 1)
  const reReads = []
  for (let k = 0; k < 5; k++) {
    reReads.push(Atomics.load(view, 1))
    Atomics.wait(view, 0, 1, 20)
  }
  const head = new Uint8Array(sab, 8, 8)
  summarize(`case-wait-stomp (waits=${waits})`, tDone, first, reReads, head)
  worker.terminate()
}

// ---- case 2: real worker + wait-free busy-spin driver ----
{
  const worker = new Worker(join(HERE, 'world-worker.mjs'))
  worker.on('error', (error) => console.log(`case-real-nowait WORKER ERROR: ${error?.message}`))
  const sab = new SharedArrayBuffer(16 * 1024 * 1024)
  const view = new Int32Array(sab)
  const T0 = Date.now()
  worker.postMessage({ type: 'call', port: 'catalog.list', args: [], sab })
  const deadline = Date.now() + 90_000
  let tDone = null
  while (Date.now() < deadline) {
    if (Atomics.load(view, 0) !== 0) {
      tDone = Date.now() - T0
      break
    }
  }
  const first = Atomics.load(view, 1)
  const reReads = []
  const tEnd = Date.now() + 200
  while (Date.now() < tEnd) {
    reReads.push(Atomics.load(view, 1))
    // wait-free 20ms sleep: tiny spin
    const t = Date.now()
    while (Date.now() - t < 20) {}
  }
  const head = new Uint8Array(sab, 8, 8)
  summarize('case-real-nowait           ', tDone, first, reReads, head)
  worker.terminate()
}
