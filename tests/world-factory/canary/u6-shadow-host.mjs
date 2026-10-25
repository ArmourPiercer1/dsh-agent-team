/**
 * u6-shadow-host.mjs — U6 PR1 C2 test-only mount row (public seams ONLY).
 *
 * MOUNT: identical in BOTH worlds of the shadow-parity run (the only delta
 * between the two Worlds is the U6_CENTER_ASSEMBLY value this row reads):
 *   'shadow' — imports the PRODUCT shadow row from its DIST face
 *              (U6_CENTER_ROW_URL — the exact file the shipped
 *              agent-bindings glue resolves) and installs the center
 *              assembly over this plugin context's public seams;
 *   'off'    — installs NOTHING and appends one `center-skipped` row, so
 *              "mounted but inert" stays distinguishable from "not mounted".
 *
 * This file is test infrastructure; it touches no product surface and holds
 * no authority. The product law (ALWAYS next(), audit-only) lives in
 * packages/runtime/src/plugin/live/center-shadow-row.mjs and is asserted by
 * packages/runtime/test/u6-pr1-shadow-inert.test.ts (C1) plus the parity
 * comparison of this suite (C2).
 *
 * ENV (set by the TestWorldFactory before spawn):
 *   U6_CENTER_ASSEMBLY        'shadow' | 'off'
 *   U6_CENTER_ROW_URL         file URL of the DIST center-shadow-row.mjs
 *   U6_CENTER_SHADOW_LEDGER   audit JSONL inside the World home
 *   U5_CANARY_WORLD           world id (provenance in the skipped row)
 */
import { appendFileSync, mkdirSync } from 'node:fs'
import { dirname } from 'node:path'

export const name = 'u6-shadow-host'
export const inject = ['tools']

const ASSEMBLY = process.env['U6_CENTER_ASSEMBLY'] ?? 'off'
const ROW_URL = process.env['U6_CENTER_ROW_URL'] ?? ''
const LEDGER = process.env['U6_CENTER_SHADOW_LEDGER'] ?? ''
const WORLD = process.env['U5_CANARY_WORLD'] ?? 'unknown'

function record(row) {
  if (LEDGER === '') return
  try {
    mkdirSync(dirname(LEDGER), { recursive: true })
    appendFileSync(LEDGER, JSON.stringify({ at: new Date().toISOString(), world: WORLD, ...row }) + '\n')
  } catch {
    /* best-effort append; a dead audit channel must never break the boot */
  }
}

export function apply(ctx) {
  if (ASSEMBLY !== 'shadow') {
    record({ leg: 'center-skipped', assembly: ASSEMBLY })
    return
  }
  if (ROW_URL === '') {
    record({ leg: 'center-error', detail: 'U6_CENTER_ROW_URL is unset' })
    return
  }
  // Synchronous apply + effect(setup) per the proven row shape
  // (u5-canary-plugin.mjs, g1fa-plugin.mjs @639ed015): the install is async
  // (dynamic import), so the setup KICKS it and the runner waits for the
  // `center-mounted` ledger row before driving any tool call — deterministic,
  // no race. A failed install records `center-error`; neither outcome may
  // touch the boot or the call flow.
  let disposers = []
  ctx.effect(() => {
    void (async () => {
      try {
        const { installCenterShadowRow } = await import(ROW_URL)
        // The product row reads no env (live-row law): this harness resolves
        // the audit destination and hands it down.
        const handle = await installCenterShadowRow({ agentCtx: ctx, scopeKey: `u6-shadow:${WORLD}`, ledgerPath: LEDGER })
        disposers = handle.disposers
        record({ leg: 'center-mounted', row: ROW_URL })
      } catch (error) {
        record({ leg: 'center-error', detail: String(error?.message ?? error).slice(0, 300) })
      }
    })()
    return () => {
      for (const dispose of disposers) {
        try {
          dispose()
        } catch {
          /* dispose is audit-close only */
        }
      }
    }
  }, 'u6-shadow-install')
}
