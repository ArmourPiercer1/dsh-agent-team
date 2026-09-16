/**
 * a2x topology probe row (diagnostic only — never part of the plugin).
 *
 * Mounted from a profile cordis.patch.yml (the SAME position the
 * dsh-agent-team production row occupies: a top-level profile-patch
 * insert), this row reports from inside the host's live composition:
 *
 *   1. the fiber ancestor chain of ITS OWN row fiber (uid, plugin name,
 *      provided service names, declared injects);
 *   2. the FULL composition map — every registered runtime's fibers with
 *      their store keys, so the webServer/connection provider fibers are
 *      locatable;
 *   3. the relationship between the probe fiber P and the webServer
 *      provider fiber W (ancestor-of / descendant-of / divergent +
 *      nearest common ancestor);
 *   4. the `ctx.webServer` PROPERTY read (what the 0.1.5 dsh-client-
 *      connection does inside `owner.webServer.register(route)` when the
 *      dsh-agent-team row registers /team-remote);
 *   5. the strict `ctx.get('webServer')` read (topology-independent);
 *   6. `connection.rpc.handle('/a2x-probe', ...)` — the exact call chain
 *      the production mount performs.
 *
 * Output: one `[A2X-PROBE] <json>` line on stderr once the connection
 * service is resolvable (or after the poll budget, whichever first).
 */
export async function apply(ctx) {
  // Candidate shim under test: resolve the `webServer` property read
  // through the strict service read (topology-independent) instead of
  // the built-in ancestor-fiber walk, which breaks on 0.1.5+ where the
  // connection row no longer injects webServer (upstream 2ef85b1e17).
  // Must stay behavior-identical on 0.1.2 (where the walk already works)
  // and fall through verbatim when the service is absent (headless).
  ctx.on('internal/get', (ownerCtx, name, _error, next) => {
    if (name !== 'webServer') return next()
    const value = ownerCtx.get('webServer')
    return value !== undefined ? value : next()
  })
  let done = false
  const ancestorsOf = (f) => {
    const list = []
    const seen = new Set()
    let cur = f
    while (cur !== null && cur !== undefined && !seen.has(cur)) {
      seen.add(cur)
      list.push(cur)
      const pf = cur.parent !== null && cur.parent !== undefined ? cur.parent.fiber : undefined
      if (pf === cur) break
      cur = pf
    }
    return list
  }
  const describe = (f) => ({
    uid: f.uid,
    name: f.name,
    runtimeName: f.runtime !== null && f.runtime !== undefined ? f.runtime.name : null,
    store: f.store !== null && f.store !== undefined ? Object.keys(f.store) : [],
    inject: Object.keys(f.inject !== null && f.inject !== undefined ? f.inject : {}),
    state: f.state,
  })
  const report = async () => {
    if (done) return
    done = true
    const probeFiber = ctx.fiber
    const out = { chain: ancestorsOf(probeFiber).map(describe) }

    // Full composition map (runtime name -> fibers).
    const fibers = []
    try {
      ctx.registry.forEach((runtime, key) => {
        for (const f of runtime.fibers) fibers.push({ runtime: runtime.name, callbackName: key && key.name ? String(key.name) : null, ...describe(f) })
      })
    } catch (error) {
      out.compositionError = error instanceof Error ? error.message : String(error)
    }
    out.composition = fibers

    // Locate the webServer + connection provider fibers.
    const providers = {}
    for (const svc of ['webServer', 'connection']) {
      providers[svc] = fibers.filter((f) => (f.store ?? []).includes(svc)).map((f) => f.uid)
    }
    out.providers = providers

    // Relationship: probe fiber P vs webServer provider W.
    const w = fibers.find((f) => (f.store ?? []).includes('webServer'))
    if (w !== undefined) {
      // Rebuild the fiber objects by uid from the ancestor walks.
      const wFibers = []
      ctx.registry.forEach((runtime, key) => {
        for (const f of runtime.fibers) if (f.uid === w.uid) wFibers.push(f)
      })
      const W = wFibers[0]
      if (W !== undefined) {
        const pChain = ancestorsOf(probeFiber)
        const wChain = ancestorsOf(W)
        const pUids = new Set(pChain.map((f) => f.uid))
        const wUids = new Set(wChain.map((f) => f.uid))
        const rel = {
          webServerProviderUid: W.uid,
          probeUid: probeFiber.uid,
          webServerIsAncestorOfProbe: wUids.has(probeFiber.uid) ? false : pUids.has(W.uid), // W in P's ancestor chain
          probeIsAncestorOfWebServer: wUids.has(probeFiber.uid),
          divergent: !pUids.has(W.uid) && !wUids.has(probeFiber.uid),
          nearestCommonAncestor: wChain.find((f) => pUids.has(f.uid)) !== undefined
            ? (wChain.find((f) => pUids.has(f.uid)) || null)
            : null,
        }
        if (rel.nearestCommonAncestor !== null) rel.nearestCommonAncestor = describe(rel.nearestCommonAncestor)
        out.relationship = rel
      }
    }

    try {
      const ws = ctx.webServer
      out.webServerProp = 'OK ' + (ws === null || ws === undefined ? 'undefined' : typeof ws.register)
    } catch (error) {
      out.webServerProp = 'FAIL ' + (error instanceof Error ? error.message : String(error))
    }
    try {
      const ws = ctx.get('webServer')
      out.webServerGet = 'OK ' + (ws === null || ws === undefined ? 'undefined' : typeof ws.register)
    } catch (error) {
      out.webServerGet = 'FAIL ' + (error instanceof Error ? error.message : String(error))
    }
    let conn
    try {
      conn = ctx.get('connection')
    } catch {
      conn = undefined
    }
    if (conn !== null && conn !== undefined && conn.rpc !== null && conn.rpc !== undefined) {
      try {
        const d = conn.rpc.handle('/a2x-probe', () => Promise.resolve({ ok: 1 }))
        out.rpcHandle = 'OK ' + (typeof d)
      } catch (error) {
        out.rpcHandle = 'FAIL ' + (error instanceof Error ? error.message : String(error))
      }
    } else {
      out.rpcHandle = 'NO-CONNECTION'
    }
    try {
      console.error('[A2X-PROBE] ' + JSON.stringify(out))
    } catch {
      /* last-resort evidence line; nothing else to do */
    }
  }
  const timer = setInterval(() => {
    let conn
    try {
      conn = ctx.get('connection')
    } catch {
      conn = undefined
    }
    if (conn !== null && conn !== undefined) {
      clearInterval(timer)
      report().catch(() => {})
    }
  }, 500)
  const budget = setTimeout(() => {
    clearInterval(timer)
    report().catch(() => {})
  }, 20_000)
  ctx.effect(() => () => {
    clearInterval(timer)
    clearTimeout(budget)
  })
}
