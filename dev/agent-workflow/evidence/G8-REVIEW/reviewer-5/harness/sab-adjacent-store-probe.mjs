/**
 * sab-adjacent-store-probe.mjs — isolate WHY the real world-worker's
 * Atomics.store(len) is invisible to the parent while Atomics.store(done)
 * and the data bytes are visible (worker-diag.log +272ms run: done=1,
 * len=0 across 200ms, v8 data head visible at offset 8).
 *
 * Two ESM file workers (not eval — the real worker is ESM):
 *   seq-sync:  handler runs synchronously: .set(92B) -> store len -> store done
 *   seq-async: await 250ms first (mimics the real worker's await gap),
 *              then .set(92B) -> store len -> store done
 * The parent polls done, then reads len (once, and 5x over 100ms).
 */
import { Worker } from 'node:worker_threads'
import { join } from 'node:path'
import { writeFileSync } from 'node:fs'

const HERE = import.meta.dirname
const N = 92

function makeWorkerCode(mode) {
  return `
    import { parentPort } from 'node:worker_threads'
    parentPort.on('message', async (msg) => {
      const sab = msg.sab
      const view = new Int32Array(sab)
      ${mode === 'async' ? "await new Promise((r) => setTimeout(r, 250))" : ''}
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
  const head = new Uint8Array(sab, 8, 8)
  console.log(
    `${label}: done@+${tDone === null ? 'TIMEOUT' : tDone + 'ms'} firstLen=${first} reReads=[${reReads.join(', ')}] dataHead=[${Array.from(head).join(',')}]`
  )
  worker.terminate()
  await new Promise((r) => worker.on('exit', r))
}

const pSync = join(HERE, 'probe4-worker-sync.mjs')
const pAsync = join(HERE, 'probe4-worker-async.mjs')
writeFileSync(pSync, makeWorkerCode('sync'))
writeFileSync(pAsync, makeWorkerCode('async'))

await runCase('seq-sync ', pSync)
await runCase('seq-async', pAsync)
