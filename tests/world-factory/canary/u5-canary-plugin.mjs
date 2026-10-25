/**
 * u5-canary-plugin.mjs — the U5 test-only Canary row (public seams ONLY).
 *
 * MOUNT: one plain plugin row `id: u5-canary` in the World's
 *   $DSH_HOME/profiles/web/cordis.patch.yml, `name: './u5-canary-plugin.mjs'`
 *   resolving beside the patch file (same proven shape as
 *   dev/agent-workflow/evidence/s1-h0-m1/probe-plugin.mjs @ 639ed015). The
 *   tool is registered through the PUBLIC tools API only:
 *   `export const inject = ['tools']` + `ctx.tools.register(definition)`
 *   inside `ctx.effect(...)` returning the disposer — exactly the upstream
 *   tool-row shape (packages/core/tools/src/index.ts register: "Register
 *   globally or in the calling agent scope"; effect contract per
 *   vendor/cordis/src/fiber.ts, as cited by the probe plugin).
 *   NO Team row, NO preset, NO private/upstream-internal import, NO Alpha.5
 *   product governance path — this plugin touches no product surface.
 *
 * WIRE DIALECT: raw ctx.tools.register gets WIRE form — `required` as ARRAYS
 *   (json-schema.ts:39,209-217 @639ed015), unknown keywords rejected at register.
 *
 * PURPOSE: the Canary walks the FULL public path once per live run:
 *   registration -> dispatch via a real model turn (mock provider issues a
 *   tool call) -> EFFECT (files written in the World workspace + a ledger
 *   appended from the HOST process) -> returned result.
 * The Oracle reads the effect channels (marker files, ledger, host log) and
 * NEVER the tool's own return value — so a tool that LIES about its effect
 * (mode 'defect') is caught, and a tool that ERRORS after its effect is still
 * seen. Modes are per-CALL arguments (the script in the mock reply decides),
 * not boot config: one boot can prove several cases.
 *
 * MODES (argument `mode`):
 *   'ok'                    write marker <tag>.marker + ledger body-ran, return ran:true
 *   'error-after-effect'    write marker + ledger body-ran, THEN throw —
 *                           the host returns an error result while the
 *                           effect stands on disk
 *   'defect'                PLANTED DEFECT: write NOTHING, still return
 *                           ran:true (the lie). A sound Oracle must report
 *                           NO effect — this is the fault-planting control.
 *   'sleep'                 write <tag>.pre marker, await sleepMs, write
 *                           <tag>.post (timeout / interrupt probes)
 *
 * ENV (set by the factory before spawn, inherited by the host process):
 *   U5_CANARY_LEDGER     append-only ledger path (World home)
 *   U5_CANARY_MARKER_DIR marker directory (World workspace/markers)
 *   U5_CANARY_VISIBLE    '0' = mount WITHOUT registering (wrong-scope control:
 *                        the tool is not visible to the session, so a scripted
 *                        call must produce NO effect); still records a
 *                        'register-skipped' row so mounted-but-invisible is
 *                        distinguishable from not-mounted.
 *   U5_CANARY_WORLD      world id (provenance inside every effect)
 */
import { appendFileSync, mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

export const name = 'u5-canary'
export const inject = ['tools']

const LEDGER = process.env['U5_CANARY_LEDGER'] ?? ''
const MARKER_DIR = process.env['U5_CANARY_MARKER_DIR'] ?? ''
const VISIBLE = (process.env['U5_CANARY_VISIBLE'] ?? '1') !== '0'
const WORLD = process.env['U5_CANARY_WORLD'] ?? 'unknown'

const slug = (value) => String(value ?? 'untagged').replace(/[^A-Za-z0-9._-]/g, '_').slice(0, 80)

function record(row) {
  if (LEDGER === '') return
  try {
    mkdirSync(dirname(LEDGER), { recursive: true })
    appendFileSync(LEDGER, JSON.stringify({ at: new Date().toISOString(), world: WORLD, ...row }) + '\n')
  } catch {
    /* best-effort append: a dead ledger means the Oracle loses a channel and
       fails — a broken observation must never read as a pass. */
  }
}

function writeMarker(fileName, content) {
  mkdirSync(MARKER_DIR, { recursive: true })
  const path = join(MARKER_DIR, fileName)
  writeFileSync(path, content)
  return path
}

const definition = {
  name: 'u5_canary',
  description: 'U5 test-world canary. Arguments: { mode: "ok"|"error-after-effect"|"defect"|"sleep", tag: string, sleepMs?: number }. Writes effect markers + ledger rows in the test world; never touches anything outside.',
  parameters: {
    type: 'object',
    properties: {
      mode: { type: 'string', description: 'canary behaviour mode' },
      tag: { type: 'string', description: 'marker/ledger tag for this call' },
      sleepMs: { type: 'number', description: 'for mode=sleep: milliseconds to wait between pre and post markers' },
    },
    required: [],
  },
  output: {
    schema: {
      type: 'object',
      additionalProperties: false,
      properties: {
        ran: { type: 'boolean' },
        tag: { type: 'string' },
        mode: { type: 'string' },
      },
      required: ['ran', 'tag', 'mode'],
    },
    render: (args, value) => [{ type: 'text', text: JSON.stringify(value) }],
  },
  execute: async (args) => {
    const tag = typeof args?.tag === 'string' ? args.tag : 'untagged'
    const mode = typeof args?.mode === 'string' ? args.mode : 'ok'
    const s = slug(tag)
    const stamp = () => new Date().toISOString()
    record({ leg: 'body-ran', tool: 'u5_canary', mode, tag })
    if (mode === 'defect') {
      // PLANTED DEFECT: the lie. NO marker is written, yet the result claims
      // ran:true. A sound Oracle (effect = filesystem + ledger + log) reports
      // effect MISSING; a blinded Oracle (effect = return value) reports it —
      // the divergence IS the sensitivity measurement.
      record({ leg: 'return-only', tool: 'u5_canary', mode, tag, lied: true })
      return { ran: true, tag, mode }
    }
    if (mode === 'error-after-effect') {
      writeMarker(`${s}.marker`, `u5_canary effect tag=${tag} at ${stamp()}\n`)
      record({ leg: 'marker-ran', tool: 'u5_canary', mode, tag, ok: true })
      // The effect stands; the RETURN fails. The tool layer turns this throw
      // into an is_error tool result for the model.
      throw new Error(`U5_CANARY_FORCED_ERROR tag=${s}`)
    }
    if (mode === 'sleep') {
      writeMarker(`${s}.pre`, `u5_canary pre tag=${tag} at ${stamp()}\n`)
      record({ leg: 'pre-marker', tool: 'u5_canary', mode, tag })
      const sleepMs = Number.isFinite(args?.sleepMs) ? Math.max(0, Math.min(Number(args.sleepMs), 120_000)) : 5_000
      await new Promise((resolve) => setTimeout(resolve, sleepMs))
      writeMarker(`${s}.post`, `u5_canary post tag=${tag} at ${stamp()}\n`)
      record({ leg: 'post-marker', tool: 'u5_canary', mode, tag })
      return { ran: true, tag, mode }
    }
    // mode 'ok' (also the fallback for unknown modes: never silently 'defect')
    const path = writeMarker(`${s}.marker`, `u5_canary effect tag=${tag} at ${stamp()}\n`)
    record({ leg: 'marker-ran', tool: 'u5_canary', mode, tag, ok: true, path: path.slice(0, 200) })
    return { ran: true, tag, mode }
  },
}

export function apply(ctx) {
  ctx.effect(() => {
    if (!VISIBLE) {
      // Wrong-scope control: the row mounts (proving the seam works) but the
      // Definition is never registered, so the tool is not visible in scope.
      record({ leg: 'register-skipped', tool: 'u5_canary', ok: true, reason: 'U5_CANARY_VISIBLE=0' })
      return () => {}
    }
    let dispose
    try {
      dispose = ctx.tools.register(definition)
    } catch (error) {
      record({ leg: 'register', tool: 'u5_canary', ok: false, error: String(error?.message ?? error) })
      throw error // failed registration must fail the mount visibly
    }
    record({ leg: 'register', tool: 'u5_canary', ok: true })
    return () => {
      dispose()
      record({ leg: 'unregister', tool: 'u5_canary', ok: true })
    }
  }, 'u5-canary-register')
}
