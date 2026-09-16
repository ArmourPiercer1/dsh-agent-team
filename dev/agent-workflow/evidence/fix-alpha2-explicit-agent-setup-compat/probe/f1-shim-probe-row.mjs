/**
 * F1 shim-scope probe row (diagnostic only — never part of the plugin).
 *
 * Mounted FIRST in the profile cordis.patch.yml (before the dsh-agent-team
 * production row) so its `internal/get` OBSERVER (pure observation — it
 * never grants, always falls through to `next()`) is registered before the
 * production row's own /team-remote mount performs its `webServer`
 * property read.
 *
 * Records (real 0.1.5-rc.2 host):
 *   E1 — every `internal/get` event: prop + reader identity observables
 *        (reader ctx fiber name/chain, declared injects, reader===thisCtx);
 *   P2 — the production row's /team-remote mount webServer read (E1 entry
 *        whose reader fiber chain carries the connection row) — captured
 *        passively, LIVE readerCtx object kept for identity comparison;
 *   P1 — THIS row's own `ctx.webServer` property read (NO webServer
 *        inject) — does the production shim serve an UNRELATED row's read?
 *   P3 — THIS row's `connection.rpc.handle('/f1-probe-foreign', ...)` call
 *        — can an unrelated plugin mount an RPC channel through the
 *        production shim? (the worst case of process-wide scope);
 *   P4 — identity: is the foreign-call readerCtx the SAME object as the
 *        team-mount readerCtx (the connection row's ctx proxy is
 *        per-service-instance → reader-identity discrimination would be
 *        impossible)?
 *
 * Output: JSON appended to the file named by config.outputPath (the
 * runner polls it).
 */
import { appendFileSync, mkdirSync } from 'node:fs'
import { dirname } from 'node:path'

export async function apply(ctx, config = {}) {
  const events = []
  const liveReaders = [] // LIVE readerCtx objects, webServer events only
  const seq = { n: 0 }
  const fiberBrief = (f) => {
    if (f === null || f === undefined || typeof f !== 'object') return String(f)
    return {
      name: typeof f.name === 'string' ? f.name : undefined,
      uid: typeof f.uid === 'number' ? f.uid : undefined,
      injects: f.inject && typeof f.inject === 'object' ? Object.keys(f.inject) : undefined,
      storeKeys: f.store && typeof f.store === 'object' ? Object.keys(f.store) : undefined,
    }
  }
  const ctxBrief = (readerCtx) => {
    try {
      const fiber = readerCtx?.fiber
      const names = []
      let cur = fiber
      const seen = new Set()
      while (cur && !seen.has(cur) && names.length < 8) {
        seen.add(cur)
        if (typeof cur.name === 'string') names.push(cur.name)
        const pf = cur.parent ? cur.parent.fiber : undefined
        if (pf === cur) break
        cur = pf
      }
      return {
        isThisRowCtx: readerCtx === ctx,
        hasFiber: fiber !== undefined && fiber !== null,
        fiber: fiberBrief(fiber),
        chain: names,
      }
    } catch (error) {
      return { error: String(error) }
    }
  }

  // The OBSERVER: records (brief + LIVE object for webServer), never grants.
  ctx.on('internal/get', (readerCtx, prop, _error, next) => {
    seq.n += 1
    const entry = { seq: seq.n, prop, reader: ctxBrief(readerCtx) }
    events.push(entry)
    if (prop === 'webServer') liveReaders.push({ entry, readerCtx })
    return next()
  })

  // Wait until the connection service is resolvable (strict read — no
  // inject declared on this row), bounded.
  const deadline = Date.now() + 60_000
  let connection = null
  for (;;) {
    try {
      connection = ctx.get('connection')
      if (connection && connection.rpc && typeof connection.rpc.handle === 'function') break
    } catch { /* not up yet */ }
    if (Date.now() >= deadline) break
    await new Promise((r) => setTimeout(r, 250))
  }

  const results = {}
  // P1 — this row's own ctx.webServer property read (NO inject).
  try {
    const ws = ctx.webServer
    results.p1_selfRead = {
      outcome: 'resolved',
      type: typeof ws,
      hasRegister: ws !== null && typeof ws.register === 'function',
    }
  } catch (error) {
    results.p1_selfRead = { outcome: 'threw', message: String(error?.message ?? error) }
  }

  // P3 — this row's foreign rpc.handle (the exact 0.1.5 read path).
  const callForeign = (channel) => {
    try {
      const r = connection.rpc.handle(channel, async () => 'f1-probe-response')
      results[channel] = { outcome: 'registered', returnsDisposer: typeof r === 'function' }
      if (typeof r === 'function') {
        try { r() } catch { /* disposer best-effort */ }
      }
    } catch (error) {
      results[channel] = { outcome: 'threw', message: String(error?.message ?? error) }
    }
  }
  if (connection) {
    callForeign('/f1-probe-foreign')
    callForeign('/f1-probe-foreign-2')
  } else {
    results['/f1-probe-foreign'] = { outcome: 'skipped', reason: 'connection service not resolvable within budget' }
    results['/f1-probe-foreign-2'] = { outcome: 'skipped', reason: 'connection service not resolvable within budget' }
  }

  // P4 — identity: foreign readerCtxs vs the team-mount readerCtx.
  const teamReader = liveReaders.length > 0 ? liveReaders[0].readerCtx : undefined
  const foreignReaders = liveReaders.slice(1).map((r) => r.readerCtx)
  results.p4_identity = {
    webServerEventCount: liveReaders.length,
    teamMountReaderChain: liveReaders.length > 0 ? liveReaders[0].entry.reader.chain : undefined,
    thisRowChain: ctxBrief(ctx).chain,
    foreignReaderCount: foreignReaders.length,
    sameTeamVsForeign1:
      teamReader !== undefined && foreignReaders.length >= 1 ? teamReader === foreignReaders[0] : undefined,
    sameForeign1VsForeign2:
      foreignReaders.length >= 2 ? foreignReaders[0] === foreignReaders[1] : undefined,
    foreignReaderIsThisRowCtx:
      foreignReaders.length >= 1 ? foreignReaders[0] === ctx : undefined,
  }

  const report = {
    probe: 'f1-shim-scope',
    at: new Date().toISOString(),
    thisRowCtxBrief: ctxBrief(ctx),
    results,
    events,
  }
  try {
    if (config.outputPath) {
      mkdirSync(dirname(config.outputPath), { recursive: true })
      appendFileSync(config.outputPath, JSON.stringify(report) + '\n')
    }
  } catch { /* report is best-effort */ }
}
