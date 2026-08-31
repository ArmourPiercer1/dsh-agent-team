/**
 * sab-v8serialize-probe.mjs — does v8.serialize() in a worker thread,
 * followed by the exact real-worker write sequence (.set -> store len ->
 * store done), lose the len store the way the real world-worker does?
 * Control case uses a plain Uint8Array pattern of the same size.
 */
import { Worker } from 'node:worker_threads'
import { join } from 'node:path'
import { writeFileSync } from 'node:fs'

const HERE = import.meta.dirname

function makeWorkerCode(mode) {
  const payload =
    mode === 'v8'
      ? `
      const { serialize } = require('node:v8')
      const bytes = serialize({ ok: true, value: { blueprints: [{ blueprintId: 'P6T2-BP', revisions: ['1'], latest: '1' }] } })
      new Uint8Array(sab, 8, bytes.byteLength).set(bytes)
      const N = bytes.byteLength
      `
      : `
      const N = 92
      const pat = new Uint8Array(N)
      for (let i = 0; i < N; i++) pat[i] = (i * 13 + 1) & 0xff
      new Uint8Array(sab, 8, N).set(pat)
      `
  return `
    const { parentPort } = require('node:worker_threads')
    parentPort.on('message', (msg) => {
      const sab = msg.sab
      const view = new Int32Array(sab)
      ${payload}
      Atomics.store(view, 1, N)
      Atomics.store(view, 0, 1)
    })
  `
}

async function runCase(label, code) {
  const worker = new Worker(code, { eval: true })
  worker.on('error', (error) => console.log(`${label} WORKER ERROR: ${error?.message}`))
  const sab = new SharedArrayBuffer(16 * 1024 * 1024)
  const view = new Int32Array(sab)
  const T0 = Date.now()
  worker.postMessage({ sab })
  const deadline = Date.now() + 15_000
  let tDone = null
  for (;;) {
    if (Atomics.load(view, 0) !== 0) {
      tDone = Date.now() - T0
      break
    }
    if (Date.now() >= deadline) break
    Atomics.wait(view, 0, 0, 20)
  }
  const first = Atomics.load(view, 1)
  const reReads = []
  for (let k = 0; k < 5; k++) {
    reReads.push(Atomics.load(view, 1))
    Atomics.wait(view, 0, 1, 20)
  }
  const head = new Uint8Array(sab, 8, 16)
  console.log(
    `${label}: done@+${tDone === null ? 'TIMEOUT' : tDone + 'ms'} firstLen=${first} reReads=[${reReads.join(', ')}] head16=[${Array.from(head).join(',')}]`
  )
  worker.terminate()
  await new Promise((r) => worker.on('exit', r))
}

// v8 case: ESM wrapper so `require` works via createRequire? No — eval
// workers are CJS by default, so require('node:v8') is fine.
await runCase('v8-payload   ', makeWorkerCode('v8'))
await runCase('pattern-payload', makeWorkerCode('pattern'))
