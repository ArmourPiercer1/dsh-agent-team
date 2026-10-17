/**
 * a5ptc4b-downstream-probe.mjs — independent DOWNSTREAM ask-lane observer for the
 * W-PTC-OUTERFS-L2 round (the stand-in for a GUI/remote bridge sitting behind the
 * Team resolver).
 *
 * Purpose (root brief: 委托完整性 = foreign callId answered ZERO by us and
 * delivered VERBATIM downstream):
 *  - registered with the PUBLIC ctx.on face, global, NON-prepend ⇒ strictly
 *    downstream of the L2 resolver's {global,prepend} face;
 *  - records every ask that reaches it with the request's OWN fields (callId,
 *    toolName, agent, full reason) so the runner can compare byte-for-byte with
 *    what the caller asked (verbatim-downlink proof, live — not only from the
 *    session log afterwards);
 *  - answers 'rejected' as the downstream approver (fail-closed posture): a
 *    delegated ask is refused by the DOWNSTREAM lane, never by us, and the
 *    refusal text the caller sees is the host's own;
 *  - keeps its disposer (public symmetric shape) and exposes a read-only census.
 *
 * It never mints, reads or mutates a Grant; it observes and answers. Zero Core
 * use: public cordis ctx.on + ctx.webServer.register only.
 *
 * @module dev/agent-workflow/evidence/alpha5/w-ptc-outerfs/a5ptc4b-probe-pkg/a5ptc4b-downstream-probe
 */
export const name = 'a5ptc4b-downstream-probe'
export const inject = ['webServer']

const LEDGER = process.env.A5PTC4B_PROBE_LEDGER ?? ''
import { appendFileSync, mkdirSync } from 'node:fs'
import { dirname } from 'node:path'

function record(row) {
  const line = JSON.stringify({ at: new Date().toISOString(), ...row })
  if (LEDGER !== '') {
    try { mkdirSync(dirname(LEDGER), { recursive: true }); appendFileSync(LEDGER, line + '\n') } catch { /* journal copy stands */ }
  }
}

const RECEIVED = []
let disposer = null
let installed = false

function snapshot(request) {
  return {
    callId: String(request?.callId ?? ''),
    toolName: String(request?.toolName ?? ''),
    agent: String(request?.agent?.id ?? request?.agent?.session?.header?.id ?? request?.agent?.scopeKey ?? 'unknown'),
    reason: String(request?.reason ?? ''),
    hasAgent: request?.agent !== undefined,
    at: new Date().toISOString(),
  }
}

export async function apply(ctx) {
  record({ leg: 'downstream-probe-apply', pid: process.pid })
  disposer = ctx.on('approval/request', (request) => {
    const row = snapshot(request)
    RECEIVED.push(row)
    record({ leg: 'downstream-received', ...row })
    // Downstream approver posture: refuse fail-closed. The ask got here because
    // the Team resolver answered ZERO for it — never pre-empt, never swallow.
    return 'rejected'
  }, { global: true })
  installed = true

  if (typeof ctx.webServer?.register === 'function') {
    const get = (path, handler, title) => ctx.webServer.register({ kind: 'exact', path, handler: async (_req, res) => handler(res) }, `a5ptc4b-probe ${title}`)
    get('/__a5ptc4bp/health', (res) => { res.writeHead(200, { 'content-type': 'application/json' }); res.end(JSON.stringify({ ok: true, applied: true, installed, pid: process.pid })) }, 'health')
    get('/__a5ptc4bp/received', (res) => { res.writeHead(200, { 'content-type': 'application/json' }); res.end(JSON.stringify({ rows: RECEIVED })) }, 'received asks (verbatim)')
    get('/__a5ptc4bp/hooks', (res) => {
      const hooks = ctx.events?._hooks?.['approval/request'] ?? []
      res.writeHead(200, { 'content-type': 'application/json' })
      res.end(JSON.stringify({ count: hooks.length, rows: hooks.map((h, i) => ({ idx: i, global: h.global === true, prepend: h.prepend === true, fnHead: String(h.callback?.toString?.() ?? '').replace(/\s+/g, ' ').slice(0, 90) })) }))
    }, 'hook census')
  }
}
