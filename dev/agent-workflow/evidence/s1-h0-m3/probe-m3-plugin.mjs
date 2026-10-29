/**
 * S1 H0-M2 fence probe (public API only, fixed Host @639ed015).
 *
 * QUESTION: inside the real `tools/execute` around-dispatch fence, does a public
 * unregister→register of a SAME-NAME Definition change which body runs?
 *
 * Public seam references (@639ed015397290b3745d163aafe02ffee4aa3f84):
 *   - listener form: `ctx.on('tools/execute', async (exec, next) => …)` — exactly the host's
 *     own wrappers: packages/guard/timeout-policy/src/index.ts:56,
 *     packages/session/session-checkpoint-policy/src/index.ts:70. (`ctx.waterfall` is the
 *     EMITTER side, packages/core/tools/src/index.ts:1605-1607 — a plugin never calls it.)
 *   - unregister: the closure returned by `ctx.tools.register(definition)`
 *     (packages/core/tools/src/index.ts:1063 `register(definition): () => void`).
 *   - live name→Definition lookup happens AFTER the fence, right before the body:
 *     packages/core/tools/src/index.ts:1578 `resolveExecution(...)` → :1581 `tool.execute(...)`.
 *   - call identity: `ToolExecution.rootCallId` (packages/core/tools/src/index.ts:393), visible
 *     to the body through ToolRunContext (:418) → every ledger row is bound to a callID.
 *
 * A and B differ ONLY in body identity (marker/echo prefix and a `body` field).
 * Same name, same `parameters`, same VALID `output` schema: no intentional output-schema error,
 * no extra dimension. NO authorization claim: the pre-dispatch gate and guard restrictions are
 * name/argument based (packages/core/tools/src/index.ts:1493-1519, :700-711), so a same-name
 * swap is not distinguishable by any A-bound authorization check — this probe measures
 * resolution timing only.
 *
 * Kit env: S1M3_LEDGER, S1M3_MARKER_DIR, S1M3_SENTINEL, S1M3_SENTINEL_EXPECT, S1M3_FENCE_SLEEP_MS.
 * @module dev/agent-workflow/evidence/s1-h0-m2/probe-m3-plugin
 */
import { appendFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { dirname, join } from 'node:path'

/** Public identity tracker for Definitions returned by ctx.tools.get(). */
const identityIds = new WeakMap()
let nextIdentityId = 1
export function identityOf(definition) {
  if (definition === null || definition === undefined || (typeof definition !== 'object' && typeof definition !== 'function')) return null
  let id = identityIds.get(definition)
  if (id === undefined) { id = `def-${nextIdentityId++}`; identityIds.set(definition, id) }
  return id
}
export const fingerprintOf = identityOf

export const name = 's1m3-fence-probe'
export const inject = ['tools']

const LEDGER = process.env['S1M3_LEDGER'] ?? ''
const MARKER_DIR = process.env['S1M3_MARKER_DIR'] ?? ''
const SENTINEL = process.env['S1M3_SENTINEL'] ?? ''
const SENTINEL_EXPECT = process.env['S1M3_SENTINEL_EXPECT'] ?? ''
const FENCE_SLEEP_MS = Number(process.env['S1M3_FENCE_SLEEP_MS'] ?? '150')

const TOOL_NAME = 's1_m1_probe'
const slug = (value) => String(value ?? 'untagged').replace(/[^A-Za-z0-9._-]/g, '_').slice(0, 80)

function record(row) {
  if (LEDGER === '') return
  try {
    mkdirSync(dirname(LEDGER), { recursive: true })
    appendFileSync(LEDGER, JSON.stringify({ at: new Date().toISOString(), ...row }) + '\n')
  } catch {
    /* a dead ledger is an ORACLE failure (missing row => FAIL), never a silent pass */
  }
}

const sleep = (ms) => new Promise((resolve) => { setTimeout(resolve, ms) })

/** Shared valid output schema (identical for A and B — enforced subset, required as ARRAYS). */
const OUTPUT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    ran: { type: 'boolean' },
    tag: { type: 'string' },
    failed: { type: 'array', items: { type: 'string' } },
  },
  required: ['ran', 'tag', 'failed'],
}

/** One Definition factory: `bodyId` is the ONLY difference ('A' | 'B'). */
function makeDefinition(bodyId) {
  return {
    name: TOOL_NAME,
    description: `S1 H0-M2 fence probe body ${bodyId}. Arguments: { tag: string }. Writes <body>-<tag>.marker, reads the sentinel once, runs /bin/echo, appends callID-bound ledger rows.`,
    parameters: {
      type: 'object',
      properties: { tag: { type: 'string', description: 'marker/ledger tag for this call' } },
      required: [],
    },
    output: {
      schema: OUTPUT_SCHEMA,
      render: (args, value) => [{ type: 'text', text: JSON.stringify(value) }],
    },
    execute: async (args, exec) => {
      const tag = typeof args?.tag === 'string' ? args.tag : 'untagged'
      const callId = String(exec?.rootCallId ?? 'unknown')
      const s = slug(tag)
      const failed = []
      // Leg marker — the file name itself carries the body identity.
      try {
        mkdirSync(MARKER_DIR, { recursive: true })
        writeFileSync(join(MARKER_DIR, `${bodyId}-${s}.marker`), `${TOOL_NAME} body=${bodyId} tag=${tag} callId=${callId} at ${new Date().toISOString()}\n`)
        record({ leg: 'marker-ran', body: bodyId, callId, tag, ok: true })
      } catch (error) {
        failed.push('marker')
        record({ leg: 'marker-ran', body: bodyId, callId, tag, ok: false, error: String(error?.message ?? error) })
      }
      // Leg read — one read, content must equal the sealed expectation.
      try {
        if (SENTINEL === '' || SENTINEL_EXPECT === '') throw new Error('S1M3_SENTINEL / S1M3_SENTINEL_EXPECT unset')
        const buf = readFileSync(SENTINEL)
        const got = buf.toString('utf8').trim()
        if (got !== SENTINEL_EXPECT) throw new Error(`sentinel content mismatch (got ${JSON.stringify(got.slice(0, 80))})`)
        record({ leg: 'read-ran', body: bodyId, callId, tag, ok: true, sentinelBytes: buf.length })
      } catch (error) {
        failed.push('read')
        record({ leg: 'read-ran', body: bodyId, callId, tag, ok: false, error: String(error?.message ?? error) })
      }
      // Leg process — controlled /bin/echo, exact expected stdout.
      try {
        const r = spawnSync('/bin/echo', ['s1m3-echo', bodyId, s], { encoding: 'utf8' })
        const out = String(r.stdout ?? '').trim()
        if (r.status !== 0) throw new Error(`echo exit ${String(r.status)} signal=${String(r.signal ?? '')}`)
        if (out !== `s1m3-echo ${bodyId} ${s}`) throw new Error(`echo stdout mismatch: ${JSON.stringify(out.slice(0, 80))}`)
        record({ leg: 'process-ran', body: bodyId, callId, tag, ok: true, echoOut: out })
      } catch (error) {
        failed.push('process')
        record({ leg: 'process-ran', body: bodyId, callId, tag, ok: false, error: String(error?.message ?? error) })
      }
      const ran = failed.length === 0
      record({ leg: 'body-ran', body: bodyId, callId, tag, ran, failed })
      return { ran, tag, failed }
    },
  }
}

const DEFINITION_A = makeDefinition('A')
const DEFINITION_B = makeDefinition('B')

export function apply(ctx) {
  // Mutable disposer binding: whichever registration is current is the one we own.
  let disposeCurrent
  let currentBody = 'A'
  let fenceCalls = 0
  ctx.effect(() => {
    try {
      disposeCurrent = ctx.tools.register(DEFINITION_A)
    } catch (error) {
      record({ leg: 'register', body: 'A', ok: false, error: String(error?.message ?? error) })
      throw error
    }
    currentBody = 'A'
    record({ leg: 'register', body: 'A', ok: true })
    return () => {
      try { disposeCurrent?.() } finally { disposeCurrent = undefined }
    }
  }, 's1m3-probe-register-A')

  // ── M3 governance wrapper (candidate under test; public API only) ──────────────────
  // Registered FIRST so it is the OUTERMOST wrapper of the two listeners in this plugin:
  // its pre-`next()` work therefore runs before the inner swap arm below. It does three
  // things, all inside the pinned public contract:
  //   (a) snapshots the currently resolved Definition through the PUBLIC `ctx.tools.get(name, scope)`
  //       (packages/core/tools/src/index.ts:1221-1232) as a public-fields fingerprint;
  //   (b) replaces `exec.signal` with its own controller signal — exactly the replacement the
  //       event contract allows (ToolDispatchExecution :401-407, "wrappers may change only
  //       `exec.signal`" :156), verifying retention the way master install.ts:923-931 does;
  //   (c) aborts that controller from a SYNCHRONOUS `tools/change` listener, so the host's OWN
  //       pre-dispatch check (:1572 → :1574 toolAbortedBeforeDispatchResult, code
  //       ABORTED_BEFORE_DISPATCH :486/:1979) refuses before the live resolve at :1578.
  // It never calls a body, never reads a private field, never patches the host, and it
  // preserves the caller's own abort reason when forwarding, and the `next()` chain.
  let guardCalls = 0
  ctx.on('tools/execute', async (exec, next) => {
    if (exec.name !== TOOL_NAME) return next()
    guardCalls += 1
    const callId = String(exec.rootCallId ?? 'unknown')
    const tag = typeof exec.arguments?.tag === 'string' ? exec.arguments.tag : 'untagged'
    let approved
    let incoming = exec.signal
    let controller
    let maybeOff
    let incomingAbortOff
    let watchArmed = true
    let changeSeen = 0
    let abortFired = 0
    let approvedId
    const disposerKind = 'api-disposer'
    const refuse = (reason) => {
      record({ leg: 'guard-refused', callId, tag, reason })
      try { if (typeof maybeOff === 'function') maybeOff() } catch { /* reclaim best effort */ }
      try { if (typeof incomingAbortOff === 'function') incomingAbortOff() } catch { /* reclaim best effort */ }
      try { exec.signal = incoming } catch { /* refusal is fail-closed */ }
      return { isError: true, content: [{ type: 'text', text: `Error: S1M3 guard refused: ${reason}` }], error: { message: `S1M3 guard refused: ${reason}`, info: { code: 'S1M3_GUARD_REFUSED', reason } } }
    }
    try {
      approved = ctx.tools.get(TOOL_NAME, exec.agent)
      if (approved === undefined || approved === null) throw new Error('tools.get returned nothing')
      approvedId = identityOf(approved)
      record({ leg: 'guard-armed', callId, tag, approvedFp: approvedId, approvedPresent: true })
      controller = new AbortController()
      const onChange = () => {
        if (!watchArmed) return
        changeSeen += 1
        record({ leg: 'guard-change-delivered', callId, tag, delivery: changeSeen })
        try {
          controller.abort(incoming?.reason ?? new DOMException('s1m3-guard-change-abort', 'AbortError'))
          abortFired += 1
          record({ leg: 'guard-abort-fired', callId, tag, callerReasonPreserved: incoming?.reason !== undefined && incoming?.reason !== null, reasonName: controller.signal.reason?.name, reasonMessage: controller.signal.reason?.message })
        } catch (error) { record({ leg: 'guard-abort-threw', callId, tag, error: String(error?.message ?? error) }) }
      }
      maybeOff = ctx.on('tools/change', onChange)
      if (typeof maybeOff !== 'function') return refuse('tools/change disposer missing')
      record({ leg: 'guard-watch-installed', callId, tag, disposerKind: 'api-disposer', incomingAlreadyAborted: incoming?.aborted === true })
      const forward = () => controller.abort(incoming?.reason ?? new DOMException('s1m3-guard-change-abort', 'AbortError'))
      if (incoming?.addEventListener) { incomingAbortOff = () => incoming.removeEventListener('abort', forward); incoming.addEventListener('abort', forward, { once: true }) }
      if (incoming?.aborted === true) forward()
      exec.signal = controller.signal
      const retained = exec.signal === controller.signal
      record({ leg: 'guard-signal-replaced', callId, tag, retained })
      if (!retained) return refuse('exec.signal write not retained')
    } catch (error) {
      return refuse(`precondition failed: ${String(error?.message ?? error)}`)
    }

    try {
      const result = await next()
      const code = result?.error?.info?.code
      record({
        leg: 'guard-exit', callId, tag, phase: 'settled',
        abortedBeforeDispatch: code === 'ABORTED_BEFORE_DISPATCH',
        resultCode: typeof code === 'string' ? code : 'none',
        isError: result?.isError === true,
      })
      return result
    } catch (error) {
      record({ leg: 'guard-exit', callId, tag, phase: 'threw', error: String(error?.message ?? error) })
      throw error
    } finally {
      watchArmed = false
      let watchDisposed = 'not-attempted'
      try {
        if (typeof maybeOff === 'function') { maybeOff(); watchDisposed = 'called' } else { watchDisposed = 'no-api-disposer' }
      } catch (error) { watchDisposed = `threw:${String(error?.message ?? error)}` }
      try { exec.signal = incoming } catch { /* reported by signalRestored below */ }
      record({
        leg: 'guard-finally', callId, tag, disposerKind, watchDisposed,
        signalRestored: exec.signal === incoming, changeSeen, abortFired,
      })
    }
  })

  // The real around-dispatch fence (public scoped waterfall listener; host-side emitter is
  // packages/core/tools/src/index.ts:1605-1607, which resolves the body only at :1578).
  ctx.on('tools/execute', async (exec, next) => {
    if (exec.name !== TOOL_NAME) return next()
    fenceCalls += 1
    const callId = String(exec.rootCallId ?? 'unknown')
    const tag = typeof exec.arguments?.tag === 'string' ? exec.arguments.tag : 'untagged'
    record({ leg: 'fence-enter', callId, tag, fence_call: fenceCalls, body_visible_before: currentBody })

    if (fenceCalls !== 1) {
      // Control arm: no swap. A must be the live definition again (restored in the swap's finally).
      record({ leg: 'fence-control', callId, tag, body_visible_before: currentBody })
      try {
        const result = await next()
        record({ leg: 'fence-exit', callId, tag, phase: 'control', result: 'settled' })
        return result
      } catch (error) {
        record({ leg: 'fence-exit', callId, tag, phase: 'control', result: 'threw', error: String(error?.message ?? error) })
        throw error
      }
    }

    // Swap arm: async fence, then public unregister A → public register B (same name).
    await sleep(Number.isFinite(FENCE_SLEEP_MS) ? FENCE_SLEEP_MS : 150)
    const retireA = disposeCurrent
    disposeCurrent = undefined
    try { retireA?.() } catch (error) { record({ leg: 'fence-retire-failed', callId, tag, error: String(error?.message ?? error) }) }
    let disposeB
    try {
      disposeB = ctx.tools.register(DEFINITION_B)
      disposeCurrent = disposeB
      currentBody = 'B'
      record({ leg: 'fence-swapped', callId, tag, from: 'A', to: 'B' })
    } catch (error) {
      // Fail closed: put A back and let the dispatch proceed against the known-good A.
      record({ leg: 'fence-swap-failed', callId, tag, error: String(error?.message ?? error) })
      disposeCurrent = ctx.tools.register(DEFINITION_A)
      currentBody = 'A'
    }
    try {
      const result = await next()
      record({ leg: 'fence-exit', callId, tag, phase: 'swap', result: 'settled', body_visible: currentBody })
      return result
    } catch (error) {
      record({ leg: 'fence-exit', callId, tag, phase: 'swap', result: 'threw', error: String(error?.message ?? error) })
      throw error
    } finally {
      // Restore A on every path so the control call runs against the original Definition.
      try { disposeB?.() } catch { /* restoring A below is what the oracle needs */ }
      try {
        disposeCurrent = ctx.tools.register(DEFINITION_A)
        currentBody = 'A'
        record({ leg: 'fence-restored', callId, tag, to: 'A' })
      } catch (error) {
        disposeCurrent = undefined
        currentBody = 'unrestored'
        record({ leg: 'fence-restore-failed', callId, tag, error: String(error?.message ?? error) })
      }
    }
  })
}
