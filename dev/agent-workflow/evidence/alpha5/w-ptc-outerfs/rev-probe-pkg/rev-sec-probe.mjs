/**
 * rev-sec-probe.mjs — W-PTC-OUTERFS independent SECURITY-REVIEW probe row.
 *
 * Reviewer lane (a5ptc4-rev-sec @ 903c062f). This row does NOT touch the
 * reviewed artifact (a5ptc4-row.mjs stays byte-identical to 903c062f); it only
 * OBSERVES the approval waterfall from downstream, to answer the root brief:
 *
 *   R1 delegation integrity: a downstream listener registered with the PUBLIC
 *      ctx.on face (global, non-prepend → strictly downstream of the reviewed
 *      resolver's {global,prepend} face). Foreign asks (no/unknown grant token)
 *      must arrive HERE, verbatim, with ZERO answers from the reviewed side.
 *      The probe answers 'rejected' as the stand-in downstream approver
 *      ("GUI-bridge-lane" semantics: a downstream decider whose verdict must
 *      flow back untouched — proves neither pre-empt nor swallow).
 *   R8 late-registered probe (probeB): registered AFTER the remote bridge may
 *      have attached, i.e. downstream of the attached approval lane; used to
 *      observe the GUI-bridge-in-place posture (hold at the lane vs delivery),
 *      with the reviewed side still answering zero.
 *   Census: hook-chain shape before/after (install/uninstall symmetry check).
 *
 * All faces are the public cordis ctx.on / webServer.register; zero Core use.
 */
import { appendFileSync, mkdirSync } from 'node:fs'
import { dirname } from 'node:path'

export const name = 'a5ptc4-rev-probe'
export const inject = ['webServer']

const LEDGER = process.env.A5PTC4_REV_LEDGER ?? ''
function record(row) {
  const line = JSON.stringify({ at: new Date().toISOString(), ...row })
  if (LEDGER !== '') {
    try { mkdirSync(dirname(LEDGER), { recursive: true }); appendFileSync(LEDGER, line + '\n') } catch { /* journal copy stands */ }
  }
}

const PROBE_A = []
const PROBE_B = []
let probeBHandle = null

function snapshot(row, request) {
  return {
    ...row,
    callId: String(request?.callId ?? ''),
    toolName: String(request?.toolName ?? ''),
    agent: String(request?.agent?.id ?? request?.agent?.session?.header?.id ?? request?.agent?.scopeKey ?? 'unknown'),
    reason: String(request?.reason ?? ''),
    hasAgent: request?.agent !== undefined,
  }
}

function sendJson(res, status, body) {
  res.writeHead(status, { 'content-type': 'application/json' })
  res.end(JSON.stringify(body))
}

export async function apply(ctx) {
  record({ leg: 'rev-probe-apply', pid: process.pid })

  // ── probeA: downstream responder lane (registered downstream of the reviewed
  // resolver because the reviewed face is {global,prepend} = outermost). ─────
  ctx.on('approval/request', (request, next) => {
    const row = snapshot({ probe: 'A', decision: 'rejected(downstream-probe)' }, request)
    PROBE_A.push(row)
    record({ leg: 'probeA-received', ...row })
    // Stand-in downstream approver: deny, verbatim outcome flows back through
    // the same waterfall. The reviewed side MUST NOT have answered this ask.
    return 'rejected'
  }, { global: true })

  if (typeof ctx.webServer?.register === 'function') {
    ctx.webServer.register({ kind: 'exact', path: '/__rev/health', handler: (_q, res) =>
      sendJson(res, 200, { ok: true, applied: true, pid: process.pid }) }, 'rev health')

    ctx.webServer.register({ kind: 'exact', path: '/__rev/probes', handler: (_q, res) =>
      sendJson(res, 200, { probeA: PROBE_A, probeB: PROBE_B }) }, 'rev probe ledgers')

    // hook-chain census (public ctx.events surface read; shape only)
    ctx.webServer.register({ kind: 'exact', path: '/__rev/hooks', handler: (_q, res) => {
      const hooks = ctx.events?._hooks?.['approval/request'] ?? []
      sendJson(res, 200, {
        count: hooks.length,
        rows: hooks.map((h, i) => ({ idx: i, global: h.global === true, prepend: h.prepend === true })),
      })
    } }, 'rev hook census')

    // probeB: LATE registration (post remote-attach), still downstream of any
    // attached approval lane because that listener was pushed earlier.
    ctx.webServer.register({ kind: 'exact', path: '/__rev/register-probeB', handler: (_q, res) => {
      if (probeBHandle !== null) { sendJson(res, 200, { ok: true, already: true }); return }
      probeBHandle = ctx.on('approval/request', (request) => {
        const row = snapshot({ probe: 'B', decision: 'rejected(downstream-probe-late)' }, request)
        PROBE_B.push(row)
        record({ leg: 'probeB-received', ...row })
        return 'rejected'
      }, { global: true })
      record({ leg: 'probeB-registered' })
      sendJson(res, 200, { ok: true })
    } }, 'rev probeB register')

    // uninstall symmetry demo: dispose the LATE probe via the disposer ctx.on
    // returns (public face), then census. The reviewed resolver has NO such
    // disposer retained — this route exists only to show the symmetric shape.
    ctx.webServer.register({ kind: 'exact', path: '/__rev/uninstall-probeB', handler: (_q, res) => {
      let ok = false
      try { probeBHandle?.(); ok = true } catch { /* gone */ }
      probeBHandle = null
      record({ leg: 'probeB-uninstalled', ok })
      sendJson(res, 200, { ok })
    } }, 'rev probeB uninstall')
  }
}
