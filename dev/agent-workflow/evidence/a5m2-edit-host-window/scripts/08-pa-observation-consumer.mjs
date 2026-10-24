// A5M2 EDIT diagnostic — READ-ONLY teamRoot.live.observations consumer.
// Root diagnostic ruling 2026-10-24: capture THIS run's bridge events (incl.
// `a5-pa-bridge:` leg observations, agent-bindings.mjs :4187/:4197) to THIS
// HOME only. No product bytes/permissions/timing change; no new RPC; NO new
// packages. Module contract = the SAME public Cordis row shape the product
// row itself ships (dist host.js :611 `export const name`, :701 `export
// async function apply(ctx, config)`).
//
// Public seam (all pinned read-only against 37646):
//   - provider:  host.ts :4144 `ctx.provide('teamRoot', facade)`; facade =
//     host.ts :4100-4107 `{ ready, get domain, get live }` (getters, row-
//     restart-stable).
//   - live array: agent-bindings.mjs :1049 `const observations = []` returned
//     BY REFERENCE on the bindings object (:10444 shorthand; JSDoc :244
//     "string[]; noteworthy async observations") — reading .length/.slice
//     mutates nothing; this consumer NEVER writes the array.
//   - consumer pattern copied verbatim from the product's own public
//     child-fiber use (host.ts :2959-2967): `ctx.inject(['teamRoot'],
//     (child) => … child.get('teamRoot') …)`, optional face + try/catch
//     fail-safe; await facade.ready BEFORE touching `live` (the getter
//     requireRoot()s; pre-ready it refuses — wrapped regardless).
//   - flush law: append per 300ms increment (event lands on disk
//     immediately; a kill -TERM loses AT MOST the last increment, and the
//     normal stop path leaves the full stream), plus a process 'exit'
//     best-effort flush. File lives under process.env.DSH_HOME ONLY. The
//     lines NEVER enter any model-facing channel (no tool/prompt/transcript
//     wiring here at all).
import { appendFileSync } from 'node:fs'
import { join } from 'node:path'

export const name = 'a5m2-pa-observer'

export async function apply(ctx, config) {
  const home = process.env.DSH_HOME
  if (typeof home !== 'string' || home.length === 0) return // nowhere to write — stay inert
  const out = join(home, String(config?.outFile ?? 'pa-observations.log'))
  let facade = null
  let cursor = 0
  const flush = () => {
    try {
      const obs = facade === null ? null : facade.live?.observations
      if (!Array.isArray(obs) || obs.length <= cursor) return
      const stamp = new Date().toISOString()
      appendFileSync(out, obs.slice(cursor).map((l) => `OBS ${stamp} ${String(l)}\n`).join(''))
      cursor = obs.length
    } catch {
      // a pre-ready `live` getter refuses; the next tick retries. Never throw
      // into the harness row.
    }
  }
  if (typeof ctx.inject === 'function') {
    try {
      ctx.inject(['teamRoot'], (child) => {
        const f = child.get('teamRoot')
        facade = null
        cursor = 0
        ;(async () => {
          try { await f.ready } catch { /* failure evidence still lands below via ready-rejection + observations */ }
          facade = f
          flush()
        })()
      })
    } catch { /* absent face — inert, never fatal */ }
  }
  const timer = setInterval(flush, 300)
  if (typeof timer.unref === 'function') timer.unref()
  process.on('exit', () => {
    clearInterval(timer)
    flush()
  })
  try { appendFileSync(out, `OBS ${new Date().toISOString()} a5m2-pa-observer: consumer row applied (out=${out})\n`) } catch { /* inert */ }
}
