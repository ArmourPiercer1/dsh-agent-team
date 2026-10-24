/**
 * c1sw-probe-row.mjs — READ-ONLY diagnostic row for the a5ie-r5 C1 red
 * (evidence-side, public seams only, mounted through the public profile
 * `insert:` seam exactly like the a5g5/a5ie observer rows).
 *
 * WHAT IT MEASURES (all on the REAL installed face, no product byte touched):
 *   M1 tools/execute entry — the per-call exec the host dispatches for
 *      team_bash: signal presence, aborted-at-entry; attaches a PASSIVE
 *      one-shot 'abort' listener that records the exact reason shape
 *      (constructor name, .kind, enumerable fields) at abort time.
 *      The listener never mutates anything; the handler delegates through
 *      next() UNTOUCHED (the PTC-row convention).
 *   M2 tools/post-execute — records the result the scheduler hands the
 *      post-execute waterfall for team_bash legs (for the swallowed leg this
 *      is where the death form is already in place: wire-visible proof of
 *      the dispatchToolBody aborted-replacement order).
 *   M3 GET /__c1sw/direct — the GREEN control: calls the registered
 *      team_bash definition's execute DIRECTLY (lane-level, host scheduler
 *      bypassed) with a real AbortController aborted with {kind:'user'}
 *      after a delay — the exact shape a5b3 C1 proves at lane level.
 *   M4 POST /__c1sw/mitigate — OPTIONAL, DEFAULT OFF. When enabled, the
 *      tools/post-execute listener returns an accept-decision replacing
 *      ONLY `content` for a swallowed team_bash leg (the host seam at
 *      core/tools dispatch postExecute accept/content branch). Used by the
 *      kit ONLY after the red measurement is captured, to grade whether the
 *      seam can carry the cancelled form to the wire.
 *   M5 internal/dispatch global tap (the invariant-row pattern) — fallback
 *      witness in case the named tools/execute listener does not fire.
 *
 * Every line is prefixed `[c1sw-probe]` and lands in the host instance log.
 * PACKAGING NOTE (measured, TRIAGE K2): this row lives in its OWN mini-package
 * (sibling package.json with NO peerDependencies). The host 0.2.0-rc.2
 * profile-row compatibility gate (app-boot evaluatePluginCompatibility,
 * packages/boot/app-boot/lib/index.js:286-293) resolves each row's OWNING
 * package by nearest-package.json; under the repo ROOT checkout that is the
 * old-lineage dsh-agent-team@0.1.1-alpha.2 with the 0.1.7-rc.1 peer, which the
 * gate disables at boot (runs 2026-10-18T21-06/21-11/21-13Z). No peerDep field
 * = the gate skips the row (:289) — the neutral manifest is the whole fix.
 * @module evidence/alpha5/c1-swallow-diag/c1sw-probe-row/c1sw-probe-row
 */

export const name = 'c1sw-probe'
export const inject = ['webServer', 'tools', 'agents']

const safeJson = (v) => { try { return JSON.stringify(v) ?? String(v) } catch { return '<unstringifiable>' } }

export async function apply(ctx) {
  const webServer = ctx.get('webServer')
  const tools = ctx.get('tools')
  const agents = ctx.get('agents')
  const log = (s) => { console.log(`[c1sw-probe] ${s}`) }
  const facts = { applied: true, enter: [], abort: [], swap: [], post: [], mitigate: [] }
  let mitigate = false

  const describeSignal = (tag, sig) => ({
    [`${tag}-present`]: sig !== undefined && sig !== null,
    [`${tag}-ctor`]: sig?.constructor?.name ?? null,
    [`${tag}-aborted`]: sig?.aborted ?? null,
  })

  // M1 — the dispatch-entry observer (timeout-policy registration shape,
  // passive: never replaces exec.signal, never blocks; delegates untouched).
  // v2: an in-flight IDENTITY TRACKER logs any `exec.signal` replacement made
  // by a downstream wrapper while the body runs, and watches every signal
  // generation for its abort reason — measuring exactly WHAT the row receives
  // and WHAT reason it dies with (the ② discriminator; still read-only).
  ctx.on('tools/execute', async (exec, next) => {
    let tracker = null
    try {
      if (exec?.name === 'team_bash') {
        const sig = exec.signal
        const rec = { t: Date.now(), call: String(exec.callId ?? ''), ...describeSignal('sig', sig) }
        facts.enter.push(rec); if (facts.enter.length > 50) facts.enter.shift()
        log(`enter call=${rec.call} t=${String(rec.t)} sig-present=${String(rec['sig-present'])} ctor=${String(rec['sig-ctor'])} aborted-at-entry=${String(rec['sig-aborted'])}`)
        const watched = new Set()
        const watch = (s, tag) => {
          if (s === undefined || s === null || watched.has(s)) return
          watched.add(s)
          s.addEventListener('abort', () => {
            const r = s.reason
            const kind = r !== null && typeof r === 'object' ? r.kind : undefined
            const keys = r !== null && typeof r === 'object' ? Object.keys(r) : []
            log(`ABORT call=${rec.call} gen=${tag} t=${String(Date.now())} reason-ctor=${String(r?.constructor?.name ?? null)} reason-kind=${String(kind ?? null)} reason-keys=${safeJson(keys)} reason-json=${safeJson(r).slice(0, 160)}`)
            facts.abort.push({ call: rec.call, gen: tag, t: Date.now(), ctor: r?.constructor?.name ?? null, kind: kind ?? null, keys, json: safeJson(r).slice(0, 160) })
          }, { once: true })
        }
        watch(sig, 'entry')
        let last = sig
        tracker = setInterval(() => {
          try {
            if (exec.signal !== last) {
              const s = exec.signal
              log(`sig-swap call=${rec.call} t=${String(Date.now())} from=${String(last?.constructor?.name ?? null)} to=${String(s?.constructor?.name ?? null)} abortedNow=${String(s?.aborted ?? null)} reasonNow=${safeJson(s?.reason).slice(0, 140)}`)
              facts.swap.push({ call: rec.call, t: Date.now(), toCtor: s?.constructor?.name ?? null, abortedNow: s?.aborted ?? null, reasonNow: safeJson(s?.reason).slice(0, 140) })
              last = s
              watch(s, `gen${String(watched.size)}`)
            }
          } catch { /* passive */ }
        }, 20)
      }
    } catch (e) { log(`enter-probe-error ${String(e?.message ?? e).slice(0, 140)}`) }
    try { return await next() } finally { if (tracker !== null) clearInterval(tracker) }
  })

  // M2/M4 — post-execute observer; mitigation ONLY when armed by route.
  ctx.on('tools/post-execute', async (exec, result, next) => {
    try {
      if (exec?.name === 'team_bash') {
        const content = safeJson(result?.content ?? null).slice(0, 220)
        log(`post-exec call=${String(exec.callId ?? '')} t=${String(Date.now())} isError=${String(result?.isError ?? null)} err=${String(result?.error?.message ?? '')} content=${content} addCtx=${String(result?.additionalContexts?.length ?? 0)}`)
        facts.post.push({ t: Date.now(), call: String(exec.callId ?? ''), isError: result?.isError ?? null, err: String(result?.error?.message ?? ''), content })
        if (mitigate && result?.isError === true && String(result?.error?.message ?? '').includes('tool call aborted')) {
          log(`MITIGATE-ON replacing content for call=${String(exec.callId ?? '')} (accept-decision, content-only)`)
          facts.mitigate.push({ t: Date.now(), call: String(exec.callId ?? ''), action: 'accept-content' })
          return { kind: 'accept', content: [{ type: 'text', text: 'c1sw · cancelled a5meta {"cancelled":true,"probe":"post-execute-accept"}' }] }
        }
      }
    } catch (e) { log(`post-probe-error ${String(e?.message ?? e).slice(0, 140)}`) }
    return await next()
  })

  // M5 — global internal/dispatch fallback tap (invariant-row pattern).
  ctx.on('internal/dispatch', (_mode, eventName, args) => {
    try {
      if (eventName === 'tools/execute') {
        const exec = args?.[0]
        if (exec?.name === 'team_bash') log(`internal-tap call=${String(exec.callId ?? '')} sig-present=${String(exec.signal !== undefined)} t=${String(Date.now())}`)
      }
    } catch { /* passive */ }
    return undefined
  }, { global: true })

  const send = (res, code, obj) => { res.statusCode = code; res.setHeader('content-type', 'application/json'); res.end(JSON.stringify(obj)) }

  ctx.effect(() => webServer.register({
    method: 'GET', path: '/__c1sw/health',
    handler: (_req, res) => send(res, 200, { ok: true, applied: true }),
  }, 'c1sw probe health'))

  ctx.effect(() => webServer.register({
    method: 'GET', path: '/__c1sw/facts',
    handler: (_req, res) => send(res, 200, facts),
  }, 'c1sw probe facts'))

  ctx.effect(() => webServer.register({
    method: 'POST', path: '/__c1sw/mitigate',
    handler: (req, res) => {
      let b = ''
      req.on('data', (c) => { b += String(c) })
      req.on('end', () => {
        try { mitigate = JSON.parse(b || '{}').on === true } catch { mitigate = false }
        log(`mitigate-flag set to ${String(mitigate)}`)
        send(res, 200, { mitigate })
      })
    },
  }, 'c1sw probe mitigate toggle'))

  // M3 — the GREEN control: direct execute on the registered definition.
  ctx.effect(() => webServer.register({
    method: 'POST', path: '/__c1sw/direct',
    handler: async (req, res) => {
      let b = ''
      req.on('data', (c) => { b += String(c) })
      req.on('end', async () => {
        let p = {}
        try { p = JSON.parse(b || '{}') } catch { /* defaults */ }
        const command = typeof p.command === 'string' ? p.command : 'sleep 12'
        const kind = typeof p.kind === 'string' ? p.kind : 'user'
        const delayMs = typeof p.delayMs === 'number' ? p.delayMs : 400
        // resolve any agent that carries team_bash (the member agent)
        let def = null
        try {
          const list = agents?.list?.() ?? []
          for (const row of list) {
            const session = String(row?.session ?? row?.id ?? '')
            const h = agents?.get?.(session) ?? row
            const d = tools?.get?.('team_bash', h)
            if (d !== undefined && d !== null && typeof d.execute === 'function') { def = d; break }
          }
          if (def === null) { const d = tools?.get?.('team_bash'); if (typeof d?.execute === 'function') def = d }
        } catch (e) { log(`direct-resolve-error ${String(e?.message ?? e).slice(0, 140)}`) }
        if (def === null) { send(res, 404, { error: 'team_bash definition not resolvable' }); return }
        const controller = new AbortController()
        const timer = setTimeout(() => controller.abort({ kind }), delayMs)
        const t0 = Date.now()
        try {
          const out = await def.execute({ command }, { signal: controller.signal })
          clearTimeout(timer)
          const text = String(out?.text ?? '')
          log(`direct done t=${String(Date.now())} elapsed=${String(Date.now() - t0)}ms text=${text.slice(0, 220).replace(/\s+/g, ' ')}`)
          send(res, 200, { ok: true, landing: text, elapsedMs: Date.now() - t0, cause: { kind }, delayMs })
        } catch (error) {
          clearTimeout(timer)
          send(res, 500, { ok: false, error: String(error?.message ?? error).slice(0, 200) })
        }
      })
    },
  }, 'c1sw probe direct'))

  log('row applied (passive observers on tools/execute + tools/post-execute + internal/dispatch; routes /__c1sw/{health,facts,mitigate,direct}; mitigate=OFF)')
}
