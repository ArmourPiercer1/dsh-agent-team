/**
 * g8r5 host row — `g8r5-team-remote-host` (G8-REVIEW reviewer 5, R61).
 *
 * The FIRST real host wiring of the Remote contract v1 (R28 deferred it):
 *
 *   - spawns the g8r5 world worker (world-worker.mjs), which hosts the
 *     REAL TeamDomain world and the twelve port adapters;
 *   - registers the Remote contract v1 dispatcher on the public seam
 *     `connection.rpc.handle('/team-remote', dispatcher)` via the tracked
 *     `registerRemoteHandlers` (reversible: a caller-fiber effect);
 *   - every port call crosses to the worker through a v8-serialized
 *     SharedArrayBuffer round trip (synchronous on the host thread,
 *     awaiting async domain code on the worker — see world-worker.mjs).
 *
 * Row pattern: static node: builtins only; the ts-loader register runs at
 * module top BEFORE the first dynamic TS import; package imports are
 * dynamic and happen inside apply()/module-evaluation, never at static
 * import time of TS sources.
 * @module g8r5-harness/plugin
 */

import { register } from 'node:module'
import { Worker } from 'node:worker_threads'
import { appendFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))

// Register the .js -> .ts resolve hook BEFORE any dynamic TS import.
register(pathToFileURL(join(HERE, 'ts-loader.mjs')).href, import.meta.url)

export const name = 'g8r5-team-remote-host'

// Hard dependency: the Host Connection service (rpc.handle seam). The
// Loader defers apply until it is available (setup-ordering contract,
// mirrors the P2-T6 probe row).
export const inject = ['connection']

const LOG_PATH = process.env.G8R5_HOST_LOG

function log(line) {
  if (typeof LOG_PATH !== 'string' || LOG_PATH.length === 0) return
  try {
    appendFileSync(LOG_PATH, `[${new Date().toISOString()}] ${line}\n`)
  } catch {
    /* obs write failure must never kill activation */
  }
}

// The register module is TS: import it at module top level (after the
// register() call above). Top-level await means the host only receives
// the module namespace — and can call apply — AFTER this import has
// resolved, so the wiring inside apply() is fully synchronous.
const PACKAGES_DIR =
  process.env.G8R5_PACKAGES_DIR || join(HERE, '..', '..', '..', '..', '..', '..', 'packages')
const registerModule = await import(
  pathToFileURL(join(PACKAGES_DIR, 'remote/src/handlers/register.js')).href
)
if (typeof registerModule.registerRemoteHandlers !== 'function') {
  throw new Error('g8r5-team-remote-host: register module lacks registerRemoteHandlers')
}

export function apply(ctx) {
  const connection = ctx.get('connection')
  if (connection === undefined) {
    throw new Error('g8r5-team-remote-host: required service connection is missing')
  }
  log('apply: start')

  const workerPath = join(HERE, 'world-worker.mjs')
  const worker = new Worker(workerPath)
  let dead = null
  worker.on('error', (error) => {
    if (dead === null) dead = `worker error: ${String((error && error.message) || error)}`
    log(`worker: ${dead}`)
  })
  worker.on('exit', (code) => {
    if (dead === null) dead = `worker exited with code ${String(code)}`
    log(`worker: ${dead}`)
  })

  /**
   * Scan a SAB data region (bytes 8..) for one complete top-level JSON
   * value (the worker writes exactly one, via JSON.stringify). Returns
   * the parsed object, or null if the bytes do not yet form a complete
   * top-level value (incomplete visibility -> the caller retries).
   * String/escape-aware depth counting, so braces inside string values
   * never terminate the scan early.
   */
  const jsonDecoder = new TextDecoder()
  function scanTopLevelJson(buf) {
    const bytes = new Uint8Array(buf, 8, buf.byteLength - 8)
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
            return JSON.parse(jsonDecoder.decode(bytes.subarray(0, i + 1)))
          } catch {
            return null
          }
        }
      }
    }
    return null
  }

  /**
   * One synchronous world call. A fresh SharedArrayBuffer per call keeps
   * concurrent in-flight RPCs independent (the e2e drives them
   * sequentially, but the row never assumes that).
   */
  function syncCall(port, args, timeoutMs) {
    if (dead !== null) {
      throw new Error(`g8r5 world worker unavailable: ${dead}`)
    }
    const buf = new SharedArrayBuffer(16 * 1024 * 1024)
    const view = new Int32Array(buf)
    worker.postMessage({ type: 'call', port, args, sab: buf })
    // POLL-AND-WAIT (documented G8-R5 environment finding): in this
    // sandboxed Windows + Node v24.20.0 build, cross-thread Atomics.wait
    // notifications from worker-thread stores are never delivered — the
    // stored values propagate (eventual visibility), but the waiter
    // always times out (proven in harness/sab-delivery-probe3.mjs:
    // wait-1 timed-out with the value visible; wait-2 saw a later store
    // as not-equal). So poll the done flag: an atomic load each loop, a
    // <=20ms wait between loads. In an environment where the
    // notification works, the wait simply wakes early.
    const deadline = Date.now() + timeoutMs
    for (;;) {
      if (Atomics.load(view, 0) !== 0) break
      if (Date.now() >= deadline) {
        dead = `rpc '${port}' timed out after ${timeoutMs}ms`
        log(`syncCall: ${dead}`)
        try {
          worker.terminate()
        } catch {
          /* already gone */
        }
        throw new Error(`g8r5 world rpc timeout on '${port}'`)
      }
      Atomics.wait(view, 0, 0, 20)
    }
    // LEN-LESS JSON RECOVERY (documented G8-R5 environment finding, part
    // 2): in this sandboxed build, the deferred-build worker thread's
    // Atomics.store to int32 slot 1 (the length field) is never visible
    // to the parent, while slot 0 (done) and the bulk data bytes are —
    // proven by the harness/sab-*.mjs probe chain plus instrumented
    // worker-diag.log runs (success path stores len=92, parent reads 0
    // for 200ms while the data bytes are intact). The worker therefore
    // writes JSON text at bytes[8..) and stores ONLY the done flag; the
    // length is recovered by the deterministic top-level JSON scan
    // above. If the data bytes are not fully visible yet, the parse
    // fails and we rescan after a <=20ms wait until the deadline.
    for (;;) {
      const msg = scanTopLevelJson(buf)
      if (msg !== null) {
        if (msg.ok) return msg.value
        const error = new Error(msg.error.message)
        if (msg.error.code !== null) error.code = msg.error.code
        throw error
      }
      if (Date.now() >= deadline) {
        dead = `malformed world reply on '${port}' (JSON scan failed)`
        log(`syncCall: ${dead}`)
        try {
          worker.terminate()
        } catch {
          /* already gone */
        }
        throw new Error(`g8r5 world reply malformed on '${port}'`)
      }
      Atomics.wait(view, 0, 1, 20)
    }
  }

  const CALLOUT_MS = 120000

  const ports = {
    catalog: {
      list: () => syncCall('catalog.list', [], CALLOUT_MS),
      get: (blueprintId, blueprintRevision) =>
        syncCall('catalog.get', [blueprintId, blueprintRevision], CALLOUT_MS),
    },
    intent: {
      probe: (blueprintId, blueprintRevision, environmentFacts) =>
        syncCall('intent.probe', [blueprintId, blueprintRevision, environmentFacts], CALLOUT_MS),
    },
    teamCreate: {
      create: (rootSessionId, blueprintId, blueprintRevision) =>
        syncCall('teamCreate.create', [rootSessionId, blueprintId, blueprintRevision], CALLOUT_MS),
    },
    projection: {
      project: (teamSessionId) => syncCall('projection.project', [teamSessionId], CALLOUT_MS),
    },
    ledger: {
      listEntries: (teamSessionId) => syncCall('ledger.listEntries', [teamSessionId], CALLOUT_MS),
      countEntries: (teamSessionId) => syncCall('ledger.countEntries', [teamSessionId], CALLOUT_MS),
    },
    admission: {
      performAction: (request) => syncCall('admission.performAction', [request], CALLOUT_MS),
    },
    lifecycle: {
      archive: (teamSessionId, instanceId) =>
        syncCall('lifecycle.archive', [teamSessionId, instanceId], CALLOUT_MS),
      restore: (teamSessionId, instanceId) =>
        syncCall('lifecycle.restore', [teamSessionId, instanceId], CALLOUT_MS),
      dispose: (teamSessionId, instanceId) =>
        syncCall('lifecycle.dispose', [teamSessionId, instanceId], CALLOUT_MS),
    },
    override: {
      get: (teamSessionId, capability, scope, targetInstanceId) =>
        syncCall('override.get', [teamSessionId, capability, scope, targetInstanceId], CALLOUT_MS),
      set: (request) => syncCall('override.set', [request], CALLOUT_MS),
      reset: (request) => syncCall('override.reset', [request], CALLOUT_MS),
    },
    policyState: {
      read: (teamSessionId) => syncCall('policyState.read', [teamSessionId], CALLOUT_MS),
      switchState: (request) => syncCall('policyState.switchState', [request], CALLOUT_MS),
    },
    compatibility: {
      current: (teamSessionId) => syncCall('compatibility.current', [teamSessionId], CALLOUT_MS),
      acknowledge: (teamSessionId, requirementId, acknowledgedBy, note) =>
        syncCall('compatibility.acknowledge', [teamSessionId, requirementId, acknowledgedBy, note], CALLOUT_MS),
      probe: (teamSessionId, trigger) =>
        syncCall('compatibility.probe', [teamSessionId, trigger], CALLOUT_MS),
    },
    handoff: {
      prepareSource: (sourceSessionId) => syncCall('handoff.prepareSource', [sourceSessionId], CALLOUT_MS),
      start: (sourceSessionId, requestToken, staged) =>
        syncCall('handoff.start', [sourceSessionId, requestToken, staged], CALLOUT_MS),
    },
    legacy: {
      inspect: (dshHome, workspaceCwd, projectDir) =>
        syncCall('legacy.inspect', [dshHome, workspaceCwd, projectDir], CALLOUT_MS),
    },
  }

  const deps = {
    catalog: ports.catalog,
    intent: ports.intent,
    teamCreate: ports.teamCreate,
    projection: ports.projection,
    ledger: ports.ledger,
    admission: ports.admission,
    lifecycle: ports.lifecycle,
    override: ports.override,
    policyState: ports.policyState,
    compatibility: ports.compatibility,
    handoff: ports.handoff,
    legacy: ports.legacy,
  }

  // Effect 1 (disposes LAST under LIFO): terminate the world worker.
  ctx.effect(
    () => {
      log('effect: worker disposer armed')
      return () => {
        log('effect: terminating worker')
        try {
          worker.terminate()
        } catch {
          /* already gone */
        }
      }
    },
    'g8r5: world worker',
  )

  // Effect 2 (disposes FIRST): the Remote contract v1 RPC channel. The
  // register module was imported at module evaluation (top-level await),
  // so this wiring is synchronous and the channel is live before apply
  // returns; the world worker builds lazily on the first port call.
  ctx.effect(
    () => {
      const reg = registerModule.registerRemoteHandlers(connection, deps)
      log(`mounted: channel '${reg.channel}' live (world builds on first call)`)
      return () => {
        log('effect: disposing rpc registration')
        reg.dispose()
      }
    },
    'g8r5: team-remote rpc channel',
  )

  log('apply: done')
}
