/**
 * s1-h0-m1 / probe-plugin.mjs — the S1 H0-M1 probe row (fixture, never run here).
 *
 * MOUNT: plain plugin row `id: s1m1-probe` in $DSH_HOME/profiles/web/cordis.patch.yml,
 *   `name: './s1m1-probe-plugin.mjs'` resolving beside the patch file
 *   (639ed015 packages/boot/app-boot/src/index.ts:532 + :994 baseUrl = patch dir +
 *   :550 '.'-prefixed import via tree baseUrl). Upstream tool-row shape:
 *   `export const inject = ['tools']` (639ed015 packages/fs/tool-fs/src/index.ts:22)
 *   + one fixed Definition via ctx.tools.register (639ed015
 *   packages/core/tools/src/index.ts:1058 "Register globally or in the calling
 *   agent scope", :1063-1075 + :1071 assertSupportedJsonSchema, :849 provide 'tools').
 *
 * EFFECT CONTRACT (639ed015; the Cordis framework is VENDORED in the HTU tree at
 * vendor/cordis — there is no @cordisjs in node_modules, so vendor/cordis/src is
 * the pin-tree equivalent of the framework source):
 *   - vendor/cordis/src/fiber.ts:402-413 (JSDoc on effect; "`execute` runs
 *     immediately" :405, reverse-order disposal on returned-disposer call or
 *     fiber unload :405-406, double-call no-op :406-407, INACTIVE_EFFECT /
 *     invalid-shape TypeError :407-409): "`execute` runs
 *     immediately; the disposers it produces are collected and run (in reverse
 *     order) either when the returned disposer is called or when the fiber
 *     unloads, whichever comes first. Calling the disposer twice
 *     is a no-op. Throws
 *     CordisError('INACTIVE_EFFECT') if the fiber is already disposed, and
 *     `TypeError` if `execute` returns an invalid shape."
 *   - vendor/cordis/src/fiber.ts:68-73 (Disposable): "Function returned by an
 *     effect to release resources during disposal ... Disposers run in reverse
 *     registration order when the owning fiber unloads".
 *   - vendor/cordis/src/fiber.ts:366-368 (_execute): the body runs synchronously;
 *     `if (typeof effect === 'function') runner.collect(effect)` — the RETURNED
 *     function is the collected disposer.
 *   - vendor/cordis/src/fiber.ts:521-536: a synchronous body throw unwinds the
 *     effect and RE-RAISES (`throw reason` at :536) — so a failed register()
 *     fails the mount visibly out of apply(). NO swallowing.
 *   - Upstream same shape: packages/core/agent-loop/src/index.ts:368
 *     `ctx.effect(() => () => this.ownership.dispose(), 'agentLoop.transactions()')`
 *     (cleanup-returning body; the second form root sanctioned).
 *   FORM CHOSEN: register INSIDE the effect body and RETURN the disposer
 *   (fiber.ts:366-368). The PREVIOUS form (register before apply, effect body
 *     merely disposing) was WRONG: the body runs immediately (fiber.ts:405), so
 *     it would have disposed the registration at apply time.
 *
 * SCHEMA DIALECT (wire shapes, 639ed015):
 *   - output.schema is the ENFORCED JSON-Schema subset: packages/core/tools/src/
 *     json-schema.ts:39 `required?: string[]`; :209-217 ".required must be an
 *     array of strings" + every entry must name a declared property; :267 unknown
 *     keywords REJECT; enforced at register (core/tools/src/index.ts:1071).
 *     Property-level `required: true` (as in tool-fs/src/read.ts:81-104) is the
 *     defineTool INPUT dialect — schema.ts:24 converts it to wire form; raw
 *     ctx.tools.register gets WIRE form: required AS ARRAYS ONLY.
 *   - parameters is a JSON Schema object for arguments (packages/llm/llm/src/
 *     types.ts:473-483 "JSON Schema object for the arguments", ToolSchema) —
 *     same wire form defineTool emits (schema.ts:30).
 *
 * SEMANTICS: registers EXACTLY ONE tool `s1_m1_probe` (expected count 1).
 *   `s1_m1_other` is NOT registered and never is: it is an UNTRIGGERED NAME
 *   (expected marker/ledger count 0) — NOT a discriminating negative control
 *   (unregistered proves no guard decision). The real cross-generation negative
 *   control belongs to M2. No dynamic registration, no guard, no Team vocabulary.
 *
 * BODY LEGS — hard failure (any failed leg => ran=false + failed=[legs], and
 * every leg records its own ledger row, ok or not):
 *   marker : writeFileSync(MARKER_DIR/<tag>.marker)
 *   read   : readFileSync(S1M1_SENTINEL) ONCE; trimmed content MUST equal
 *            S1M1_SENTINEL_EXPECT
 *   process: spawnSync('/bin/echo', ['s1m1-process-leg', <tag>]) exit 0 AND
 *            trimmed stdout === 's1m1-process-leg <tag>' (non-empty, exact)
 *   ledger : fixed row {at,leg:'body-ran',tool,tag} (+ ran/failed verdict)
 *
 * Kit env: S1M1_LEDGER, S1M1_MARKER_DIR, S1M1_SENTINEL, S1M1_SENTINEL_EXPECT.
 * @module dev/agent-workflow/evidence/s1-h0-m1/probe-plugin
 */
import { appendFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { dirname, join } from 'node:path'

export const name = 's1m1-probe'
export const inject = ['tools']

const LEDGER = process.env['S1M1_LEDGER'] ?? ''
const MARKER_DIR = process.env['S1M1_MARKER_DIR'] ?? ''
const SENTINEL = process.env['S1M1_SENTINEL'] ?? ''
const SENTINEL_EXPECT = process.env['S1M1_SENTINEL_EXPECT'] ?? ''

const slug = (value) => String(value ?? 'untagged').replace(/[^A-Za-z0-9._-]/g, '_').slice(0, 80)

function record(row) {
  if (LEDGER === '') return
  try {
    mkdirSync(dirname(LEDGER), { recursive: true })
    appendFileSync(LEDGER, JSON.stringify({ at: new Date().toISOString(), ...row }) + '\n')
  } catch {
    /* best-effort append: a dead ledger is an ORACLE failure (missing
       body-ran row => FAIL), never a silent pass */
  }
}

/** The ONE fixed Definition. Name/shape never change at runtime.
 *  Wire dialect: `required` as ARRAYS (json-schema.ts:39,209-217 @639ed015). */
const s1m1ProbeDefinition = {
  name: 's1_m1_probe',
  description: 'S1 H0-M1 positive-control probe. Arguments: { tag: string }. Writes a marker, reads the sentinel once, runs /bin/echo, appends ledger rows. Any failed leg sets ran=false.',
  parameters: {
    type: 'object',
    properties: { tag: { type: 'string', description: 'marker/ledger tag for this call' } },
    required: [],
  },
  output: {
    schema: {
      type: 'object',
      additionalProperties: false,
      properties: {
        ran: { type: 'boolean' },
        tag: { type: 'string' },
        failed: { type: 'array', items: { type: 'string' } },
      },
      required: ['ran', 'tag', 'failed'],
    },
    render: (args, value) => [{ type: 'text', text: JSON.stringify(value) }],
  },
  execute: async (args) => {
    const tag = typeof args?.tag === 'string' ? args.tag : 'untagged'
    const s = slug(tag)
    const failed = []
    // Leg marker — reaching this line IS the measurement.
    try {
      mkdirSync(MARKER_DIR, { recursive: true })
      writeFileSync(join(MARKER_DIR, `${s}.marker`), `s1_m1_probe ran tag=${tag} at ${new Date().toISOString()}\n`)
      record({ leg: 'marker-ran', tool: 's1_m1_probe', tag, ok: true })
    } catch (error) {
      failed.push('marker')
      record({ leg: 'marker-ran', tool: 's1_m1_probe', tag, ok: false, error: String(error?.message ?? error) })
    }
    // Leg read — exactly one read; content must equal the sealed expectation.
    let sentinelBytes = -1
    try {
      if (SENTINEL === '' || SENTINEL_EXPECT === '') throw new Error('S1M1_SENTINEL / S1M1_SENTINEL_EXPECT unset')
      const buf = readFileSync(SENTINEL)
      sentinelBytes = buf.length
      const got = buf.toString('utf8').trim()
      if (got !== SENTINEL_EXPECT) throw new Error(`sentinel content mismatch (got ${JSON.stringify(got.slice(0, 80))})`)
      record({ leg: 'read-ran', tool: 's1_m1_probe', tag, ok: true, sentinelBytes })
    } catch (error) {
      failed.push('read')
      record({ leg: 'read-ran', tool: 's1_m1_probe', tag, ok: false, sentinelBytes, error: String(error?.message ?? error) })
    }
    // Leg process — /bin/echo: exit 0 AND exact expected stdout.
    try {
      const r = spawnSync('/bin/echo', ['s1m1-process-leg', s], { encoding: 'utf8' })
      const out = String(r.stdout ?? '').trim()
      if (r.status !== 0) throw new Error(`echo exit ${String(r.status)} signal=${String(r.signal ?? '')}`)
      if (out !== `s1m1-process-leg ${s}`) throw new Error(`echo stdout mismatch: ${JSON.stringify(out.slice(0, 80))}`)
      record({ leg: 'process-ran', tool: 's1_m1_probe', tag, ok: true, echoOut: out })
    } catch (error) {
      failed.push('process')
      record({ leg: 'process-ran', tool: 's1_m1_probe', tag, ok: false, error: String(error?.message ?? error) })
    }
    const ran = failed.length === 0
    // The required ledger row (fixed keys present; ran/failed carry the verdict).
    record({ leg: 'body-ran', tool: 's1_m1_probe', tag, ran, failed })
    return { ran, tag, failed }
  },
}

export function apply(ctx) {
  // Contract (header): fiber.ts:405 immediate execute; :366-368 the body's
  // RETURNED function is collected as the teardown disposer; :521-536 a sync
  // body throw propagates out of effect()/apply() after unwinding — a failed
  // register FAILS THE MOUNT, visibly. Not swallowed: the ledger row is written
  // and the error re-thrown.
  ctx.effect(() => {
    let dispose
    try {
      dispose = ctx.tools.register(s1m1ProbeDefinition)
    } catch (error) {
      record({ leg: 'register', tool: 's1_m1_probe', ok: false, error: String(error?.message ?? error) })
      throw error
    }
    record({ leg: 'register', tool: 's1_m1_probe', ok: true })
    return () => { dispose() }
  }, 's1m1-probe-register')
}
