/**
 * u6-shadow-host.mjs — U6 PR1 C2 test-only mount row (public seams ONLY).
 *
 * A1 CUT: the PRODUCT shadow row this fixture mounted
 * (`packages/runtime/src/plugin/live/center-shadow-row.mjs`) and its C1
 * suite (`u6-pr1-shadow-inert.test.ts`) retired together. The fixture stays
 * as the parity runner's mount row, but no U6_CENTER_ROW_URL is handed down
 * any more, so a `shadow` World records `center-error` (nothing to import)
 * instead of mounting an assembly; it never imports a deleted file.
 *
 * MOUNT: identical in BOTH worlds of the shadow-parity run (the only delta
 * between the two Worlds is the U6_CENTER_ASSEMBLY value this row reads):
 *   'shadow' — would import the product shadow row from U6_CENTER_ROW_URL
 *              (never set since the A1 cut), so it records `center-error`
 *              and installs nothing;
 *   'off'    — installs NOTHING and appends one `center-skipped` row, so
 *              "mounted but inert" stays distinguishable from "not mounted".
 *
 * This file is test infrastructure; it touches no product surface and holds
 * no authority.
 *
 * ENV (set by the TestWorldFactory before spawn):
 *   U6_CENTER_ASSEMBLY        'shadow' | 'off'
 *   U6_CENTER_ROW_URL         RETIRED — never set since the A1 cut
 *   U6_CENTER_SHADOW_LEDGER   audit JSONL inside the World home (CAPPED)
 *   U5_CANARY_WORLD           world id (provenance in the skipped row)
 */
import { mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
// FIX-T T3: every ledger write goes through the byte-capped appender
// (ledger-cap.mjs is copied beside this row by TestWorldFactory.startHost).
// The PRODUCT shadow row is handed `ledgerPath: ''` and its `observe` sink
// instead: the sink receives the SAME stamped rows the row would have
// appended and writes them here, so the ledger file content stays
// byte-identical while EVERY append — including the row's own — respects the
// cap. (product rows are never modified from test infra — red line.)
import { appendCappedLine } from './ledger-cap.mjs'

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
    appendCappedLine(LEDGER, { at: new Date().toISOString(), world: WORLD, ...row })
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
        // the audit destination and hands it down. FIX-T T3: we route it
        // through the public `observe` sink and hand `ledgerPath: ''` — the
        // row stamps each entry itself, then hands it to the sink, so the
        // SAME entries land in the SAME file, every append now byte-capped.
        // (The product module is untouched: `observe` is its public seam.)
        const handle = await installCenterShadowRow({
          agentCtx: ctx,
          scopeKey: `u6-shadow:${WORLD}`,
          ledgerPath: '',
          observe: (stamped) => {
            mkdirSync(dirname(LEDGER), { recursive: true })
            appendCappedLine(LEDGER, stamped)
          },
        })
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
