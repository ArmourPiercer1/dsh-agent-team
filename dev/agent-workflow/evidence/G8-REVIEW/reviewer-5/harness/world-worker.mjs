/**
 * g8r5 world worker — hosts the ENTIRE TeamDomain world on a dedicated
 * worker thread and answers synchronous RPC calls from the host row
 * (plugin.mjs) through a SharedArrayBuffer mailbox.
 *
 * WHY a worker (documented G8-R5 host-wiring decision):
 *   The Remote contract v1 admission port is SYNCHRONOUS
 *   (`RemoteAdmissionPort.performAction(request): RemoteSafeRecord`,
 *   packages/remote/src/handlers/ports.ts), and the category handlers
 *   embed the port result directly in the success envelope (no await).
 *   The real P6-T2 TeamRuntime facade, however, is ASYNCHRONOUS
 *   (`async performAction`, packages/runtime/action-router/router.ts).
 *   The P8 in-process suites only ever exercised SYNC admission fakes, so
 *   no in-repo wiring bridges the two at this SHA. This harness — the
 *   first real host wiring — bridges it: the async world (runtime,
 *   prober, handoff) lives here and is AWAITED per call; the parent host
 *   thread stays synchronous through a JSON-encoded SAB round trip (len-less JSON protocol; documented environment workaround — see PROTOCOL below and the harness/sab-*.mjs probe chain).
 *
 * PROTOCOL (per call) — LEN-LESS JSON (documented G8-R5 environment
 * workaround; probe chain: harness/sab-*.mjs + instrumented
 * worker-diag.log runs). In this sandboxed Windows + Node v24.20.0
 * build, (a) cross-thread Atomics.wait notifications from worker
 * stores are never delivered, and (b) this deferred-build worker
 * thread's Atomics.store to int32 slot 1 (a length field) never
 * becomes visible to the parent, while slot 0 (the done flag) and
 * the bulk data bytes DO propagate. The mailbox therefore carries NO
 * length field:
 *   parent -> worker: postMessage({ type:'call', port, args, sab })
 *     `sab` is a SharedArrayBuffer laid out as
 *       Int32Array[0] = done flag (0 -> 1)
 *       Int32Array[1] = (unused; always 0 in the len-less protocol)
 *       bytes[8..8+n) = JSON text of { ok, value } | { ok:false, error }
 *   worker -> parent: JSON text written, then Atomics.store(done=1).
 *   The parent recovers n by a deterministic top-level JSON scan
 *   (string/escape-aware balanced braces), retrying on parse failure
 *   until its deadline (covers delayed data-byte visibility). All
 *   contract values are lossless-JSON safe by design (RemoteSafe
 *   assertions in packages/remote), so JSON is an equivalent carrier
 *   to v8 serialization for this bridge.
 *   Errors cross as { code: string|null, message: string } — a non-null
 *   code is re-thrown as a typed error on the parent (dispatcher
 *   invariant 4 pass-through); a null code becomes an untyped throw
 *   (invariant 5 -> internal-error, generic message, no leak).
 *
 * Plain .mjs; node: builtins only (this is harness code, not a tracked
 * package module). The ts-loader register MUST precede any dynamic TS
 * import (world-build.mjs is imported lazily after registration).
 * @module g8r5-harness/world-worker
 */

import { register } from 'node:module'
import { parentPort } from 'node:worker_threads'
import { appendFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const DIAG_PATH = join(HERE, 'worker-diag.log')
// Bisect toggle (sab factor hunt): disable diag file writes.
const NO_DIAG = process.env.G8R5_NO_DIAG === '1'
function diag(line) {
  if (NO_DIAG) return
  try {
    appendFileSync(DIAG_PATH, `[${new Date().toISOString()}] ${line}\n`)
  } catch {
    /* diagnostics must never break the worker */
  }
}

// Register the .js -> .ts resolve hook BEFORE any dynamic TS import.
register(pathToFileURL(join(HERE, 'ts-loader.mjs')).href, import.meta.url)

// Diagnostics: the worker must not silently die on a late async throw
// (e.g. an unhandled rejection from the world after a reply is written).
// Log the full stack; a swallowed rejection keeps the world serviceable
// for the remaining e2e calls (documented harness behavior).
process.on('unhandledRejection', (reason) => {
  diag(`unhandledRejection: ${reason && reason.stack ? reason.stack : String(reason)}`)
})
process.on('uncaughtException', (error) => {
  diag(`uncaughtException: ${error && error.stack ? error.stack : String(error)}`)
})

const DONE_OFFSET = 0
const DATA_OFFSET = 8

let world = null
let building = null

/**
 * Write one reply into the call's SAB (always; never throws silently).
 * Len-less JSON protocol (environment workaround — see header PROTOCOL):
 *   encode { ok, ... } as JSON text -> write bytes at [8..8+n) ->
 *   Atomics.store(done=1). There is NO length store: slot 1 is never
 *   written because this worker thread's slot-1 stores are invisible to
 *   the parent in this build. The parent recovers n by scanning the
 *   top-level JSON value, so the only invariant we must keep is "data
 *   fully written before done flips" — the sequential write order here
 *   plus the single done store provides that (the parent rescans on a
 *   parse failure if the data bytes are still settling).
 */
function reply(sab, msg) {
  const view = new Int32Array(sab)
  diag('reply enter')
  try {
    const bytes = new TextEncoder().encode(JSON.stringify(msg))
    diag(`json ok bytes=${bytes.byteLength}`)
    const capacity = sab.byteLength - DATA_OFFSET
    if (bytes.byteLength > capacity) {
      // Oversized result: report a typed-free error instead of truncating.
      const errBytes = new TextEncoder().encode(
        JSON.stringify({
          ok: false,
          error: { code: null, message: 'g8r5 world: reply exceeds mailbox capacity' },
        })
      )
      new Uint8Array(sab, DATA_OFFSET, errBytes.byteLength).set(errBytes)
    } else {
      new Uint8Array(sab, DATA_OFFSET, bytes.byteLength).set(bytes)
    }
    Atomics.store(view, DONE_OFFSET, 1)
    diag('stores done')
  } catch (error) {
    // Last resort: flip done with no valid JSON; the parent's scan fails
    // and surfaces internal-error (never a hang).
    diag(`reply last-resort: ${error && error.stack ? error.stack : String(error)}`)
    Atomics.store(view, DONE_OFFSET, 1)
  }
}

const T0 = Date.now()
const stamp = () => `+${Date.now() - T0}ms`
console.error(
  `g8r5 worker ${stamp()}: started NO_DIAG=${NO_DIAG ? 1 : 0} proto=len-less-json`
)

parentPort.on('message', async (msg) => {
  if (!msg || msg.type !== 'call' || !msg.sab) return
  diag(`handler entry port=${msg.port}`)
  try {
    if (world === null) {
      if (building === null) {
        building = import('./world-build.mjs').then((m) => m.buildWorld())
      }
      world = await building
      diag(`world built: ports=${Object.keys(world.ports).length}`)
      console.error(`g8r5 worker ${stamp()}: world built: ports=${Object.keys(world.ports).length}`)
    }
    if (msg.port === '__init__') {
      reply(msg.sab, { ok: true, value: { ready: true } })
      return
    }
    const fn = world.ports[msg.port]
    if (typeof fn !== 'function') {
      diag(`unknown port '${String(msg.port)}'`)
      reply(msg.sab, {
        ok: false,
        error: { code: null, message: `g8r5 world: unknown port '${String(msg.port)}'` },
      })
      return
    }
    const args = Array.isArray(msg.args) ? msg.args : []
    // The world may be fully async (the real P6-T2 runtime, the P7-T1
    // prober, the P7-T5 handoff service): await uniformly.
    diag(`pre-fn ${msg.port}`)
    const value = await fn(...args)
    diag(`post-fn ${msg.port} typeof=${typeof value}`)
    reply(msg.sab, { ok: true, value })
  } catch (error) {
    diag(`call failed: ${error && error.stack ? error.stack : String(error)}`)
    const code =
      error !== null && typeof error === 'object' && typeof error.code === 'string'
        ? error.code
        : null
    const message =
      error !== null && typeof error === 'object' && typeof error.message === 'string'
        ? error.message
        : String(error)
    reply(msg.sab, { ok: false, error: { code, message } })
  }
})

// Keep the worker alive until terminated by the parent.
setInterval(() => {}, 1 << 30)
