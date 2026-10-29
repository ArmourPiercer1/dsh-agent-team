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
 * Kit env: S1M2_LEDGER, S1M2_MARKER_DIR, S1M2_SENTINEL, S1M2_SENTINEL_EXPECT, S1M2_FENCE_SLEEP_MS.
 * @module dev/agent-workflow/evidence/s1-h0-m2/probe-m2-plugin
 */
import { appendFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { dirname, join } from 'node:path'

export const name = 's1m2-fence-probe'
export const inject = ['tools']

const LEDGER = process.env['S1M2_LEDGER'] ?? ''
const MARKER_DIR = process.env['S1M2_MARKER_DIR'] ?? ''
const SENTINEL = process.env['S1M2_SENTINEL'] ?? ''
const SENTINEL_EXPECT = process.env['S1M2_SENTINEL_EXPECT'] ?? ''
const FENCE_SLEEP_MS = Number(process.env['S1M2_FENCE_SLEEP_MS'] ?? '150')

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
        if (SENTINEL === '' || SENTINEL_EXPECT === '') throw new Error('S1M2_SENTINEL / S1M2_SENTINEL_EXPECT unset')
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
        const r = spawnSync('/bin/echo', ['s1m2-echo', bodyId, s], { encoding: 'utf8' })
        const out = String(r.stdout ?? '').trim()
        if (r.status !== 0) throw new Error(`echo exit ${String(r.status)} signal=${String(r.signal ?? '')}`)
        if (out !== `s1m2-echo ${bodyId} ${s}`) throw new Error(`echo stdout mismatch: ${JSON.stringify(out.slice(0, 80))}`)
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
  }, 's1m2-probe-register-A')

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
