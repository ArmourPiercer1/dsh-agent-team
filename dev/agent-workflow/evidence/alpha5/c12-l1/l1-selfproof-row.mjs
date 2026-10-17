/**
 * l1-selfproof-row.mjs — C-12 L1 startup-self-prove bounded PoC row (evidence-only).
 *
 * A PLAIN plugin row mounted through the public profile-patch seam
 * (`$DSH_HOME/profiles/web/cordis.patch.yml`) — the same public seam the
 * live round (../live/a5live-assembly-row.mjs) used. It carries ONE
 * already-subscribed silent-channel scenario on a REAL session Agent:
 *
 *   A) the PR1 guard installs with its `tools/change` subscription PRESENT
 *      through the public seams (channel reads 'armed');
 *   B) STARTUP SELF-PROVE leg: one same-name NO-OP re-registration through the
 *      public change face (disposer + register of the SAME Definition object —
 *      this Host forbids same-scope overwrite, so disposer+register is THE
 *      public replacement move, measured in the live round). The raw delivered
 *      `tools/change` event originals are captured on BOTH the guard-forwarded
 *      lane and a row-owned control subscription; `changeChannelStatus()`
 *      must flip 'armed' → 'proven' (the L1 premise: Host really emits);
 *   C) COUNTER-EXAMPLE leg (the G-7 swallow移法, time-shifted AFTER the proof):
 *      the forwarder keeps its entry in the Host's REAL listener table (the
 *      disposer the install received is never called) but stops forwarding;
 *      then a drifted same-name re-registration runs. The control subscription
 *      proves the registry still emits while the guard receives nothing and
 *      `changeChannelStatus()` still reads 'proven' — a STALE startup proof.
 *      A model-driven call on the drifted Definition then produces the loud
 *      five-piece delta at the call edge (kit G-7 posture), with ZERO delivered
 *      cancellation — proving startup-time health does NOT extrapolate to
 *      subsequent delivery.
 *
 * Zero production-surface change: this file imports the worktree's BUILT dist
 * through the SAME public barrel the production glue uses
 * (`runtime/tool-dispatch/install.js`) and only public Host seams
 * (`ctx.agents`, `agent.ctx.tools.register/on/guard`, `ctx.webServer.register`).
 *
 * Kit-provided environment:
 *   A5L1_DIST    <worktree>/packages/runtime/dist/packages
 *   A5L1_LEDGER  JSONL ledger path (append-only, row-owned journal mirror)
 *
 * @module dev/agent-workflow/evidence/alpha5/c12-l1/l1-selfproof-row
 */
import { appendFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'

export const name = 'a5l1-selfproof'
export const inject = ['webServer', 'agents']

const LEDGER = process.env.A5L1_LEDGER ?? ''
const DIST = process.env.A5L1_DIST ?? ''
const PROBE = 'a5l1_probe'

const JOURNAL = []
function record(row) {
  const line = { at: new Date().toISOString(), ...row }
  JOURNAL.push(line)
  if (LEDGER !== '') {
    try {
      mkdirSync(dirname(LEDGER), { recursive: true })
      appendFileSync(LEDGER, JSON.stringify(line) + '\n')
    } catch { /* the journal route is the authoritative in-process copy */ }
  }
}

const assemblies = new Map()

const slug = (v) => String(v ?? 'untagged').replace(/[^A-Za-z0-9._-]/g, '_').slice(0, 80)
function safeLabel(read) {
  try { return String(read() ?? '(unknown-agent)') } catch (error) { return `(unreadable: ${String(error?.message ?? error).slice(0, 60)})` }
}
const agentLabel = (agent) => slug(safeLabel(() => agent?.id ?? agent?.session?.header?.id ?? agent?.scopeKey))

function sendJson(res, status, body) {
  res.writeHead(status, { 'content-type': 'application/json' })
  res.end(JSON.stringify(body))
}

/** Raw-text capture of one delivered event (原文 + arity, not a projection).
 *  MEASURED fact on this pinned Host: `tools/change` fires with ONE argument
 *  whose value is `undefined` (payload-less signal); the raw record is the
 *  evidence, recorded as found. */
function rawEvent(payload, rest = [], called = false) {
  const out = { at: new Date().toISOString(), type: typeof payload, ctor: '(none)', keys: [], argCount: called ? 1 + rest.length : 0, text: '' }
  try { out.ctor = payload?.constructor?.name ?? '(none)' } catch { /* labelled */ }
  try { out.keys = Object.keys(payload ?? {}) } catch { /* labelled */ }
  let text
  try { text = JSON.stringify(payload) } catch { text = undefined }
  out.text = String(text ?? String(payload)).slice(0, 1500)
  return out
}

export async function apply(ctx) {
  record({ leg: 'plugin-apply', pid: process.pid, dist: DIST, hasWebServer: typeof ctx.webServer?.register === 'function' })

  let td = null
  try {
    td = await import(new URL(`file://${join(DIST, 'runtime/tool-dispatch/install.js')}`).href)
    record({ leg: 'install-import', ok: typeof td.installScopedToolGuard === 'function' })
  } catch (error) {
    record({ leg: 'install-import', ok: false, error: String(error?.message ?? error) })
  }

  // ── routes: the test face driving + reading the LIVE process ─────────────
  const latest = () => assemblies.values().next().value
  if (typeof ctx.webServer?.register === 'function') {
    ctx.webServer.register({
      kind: 'exact', path: '/__a5l1/health',
      handler: (_req, res) => sendJson(res, 200, { ok: true, pid: process.pid, applied: true, assemblies: [...assemblies.keys()] }),
    }, 'a5l1 health')
    ctx.webServer.register({
      kind: 'exact', path: '/__a5l1/journal',
      handler: (_req, res) => sendJson(res, 200, { rows: JOURNAL }),
    }, 'a5l1 journal')
    ctx.webServer.register({
      kind: 'exact', path: '/__a5l1/state',
      handler: (_req, res) => sendJson(res, 200, { assemblies: Object.fromEntries([...assemblies].map(([k, a]) => [k, stateOf(a)])) }),
    }, 'a5l1 state')
    ctx.webServer.register({
      kind: 'exact', path: '/__a5l1/assemble',
      handler: async (req, res) => {
        let body = ''
        for await (const chunk of req) body += chunk
        let sessionId = ''
        try { sessionId = String(JSON.parse(body || '{}').sessionId ?? '') } catch { /* empty */ }
        let agent = null
        try { agent = ctx.agents.get?.(sessionId) ?? null } catch (error) { sendJson(res, 500, { ok: false, error: String(error?.message ?? error) }); return }
        if (agent === null) { sendJson(res, 404, { ok: false, error: `no agent for session ${sessionId}` }); return }
        const label = agentLabel(agent)
        if (assemblies.has(label)) { sendJson(res, 200, { ok: true, already: true, label }); return }
        void assemble(label, agent).catch((error) => record({ leg: 'assembly-failed', label, error: String(error?.stack ?? error).slice(0, 800) }))
        sendJson(res, 200, { ok: true, started: true, label })
      },
    }, 'a5l1 assemble')
    ctx.webServer.register({
      kind: 'exact', path: '/__a5l1/control',
      handler: async (req, res) => {
        let body = ''
        for await (const chunk of req) body += chunk
        let action = ''
        try { action = String(JSON.parse(body || '{}').action ?? '') } catch { /* empty */ }
        const asm = latest()
        if (asm === undefined || asm.handle === undefined) { sendJson(res, 409, { ok: false, error: 'no installed assembly yet' }); return }
        if (action === 'reregister-noop' || action === 'reregister-drift') {
          const def = action === 'reregister-noop' ? asm.noopDef() : asm.driftDef()
          try {
            // THE public change face on this Host (live-round measured): the
            // disposer register() returned, then register fresh. Both emit
            // tools/change on the REAL registry.
            const off = asm.probeDisposer?.()
            if (off !== null && typeof off?.then === 'function') off.then(() => {}, () => {})
            asm.probeDisposer = asm.inner.tools.register(def)
            if (action === 'reregister-drift') asm.drifted = true
            record({ leg: 'reregister', mode: action, name: PROBE, controlEvents: asm.controlEvents, laneDeliveries: asm.laneDeliveries, absorbed: asm.absorbed, channel: asm.handle.changeChannelStatus() })
            sendJson(res, 200, { ok: true, action, channel: asm.handle.changeChannelStatus() })
          } catch (error) {
            record({ leg: 'reregister-failed', mode: action, error: String(error?.message ?? error) })
            sendJson(res, 500, { ok: false, error: String(error?.message ?? error) })
          }
          return
        }
        if (action === 'swallow') {
          asm.swallowActive = true
          record({ leg: 'swallow-engaged', via: 'G-7 forwarder-stop (entry stays in the real listener table; the disposer the install received was never called)', channel: asm.handle.changeChannelStatus() })
          sendJson(res, 200, { ok: true, action })
          return
        }
        sendJson(res, 400, { ok: false, error: `unknown action ${action}` })
      },
    }, 'a5l1 control')
  }

  let onCreatedOff = null
  try { onCreatedOff = ctx.on('agent/created', () => {}) } catch { /* measured no-op on this Host */ }
  ctx.effect?.(() => { try { onCreatedOff?.() } catch { /* scope unwind */ } }, 'a5l1-selfproof')

  // ── the live assembly ─────────────────────────────────────────────────────
  async function assemble(label, agent) {
    const inner = agent?.ctx
    const asm = {
      label, inner, handle: undefined, installOk: false, bindOwnOk: false, publishedOk: false,
      channelBeforeInjection: 'unknown', channelNow: () => asm.handle?.changeChannelStatus() ?? null,
      observations: [],
      sub: { attempted: false, disposerCalled: false },
      swallowActive: false,
      laneCalls: 0, laneDeliveries: 0, absorbed: 0, controlEvents: 0,
      laneEventRaw: [], controlEventRaw: [],
      bodyCounts: {}, verifiedAtCallEdge: null, verifiedFalseObserved: false,
      toolResults: [], drifted: false, probeDisposer: undefined,
      countersAt: {}, // runner checkpoints the deltas
    }
    assemblies.set(label, asm)
    if (typeof inner?.on !== 'function' || typeof inner.tools?.register !== 'function') {
      record({ leg: 'agent-ctx-unusable', label }); return
    }

    // one Definition object for the no-op re-registration (SAME object, SAME
    // execute closure — the strongest public no-op this Host allows), and a
    // visibly drifted one for the counter-example leg.
    const probeExecute = async (args) => {
      const n = Number(args?.v ?? 0)
      asm.bodyCounts[`v${n}`] = (asm.bodyCounts[`v${n}`] ?? 0) + 1
      record({ leg: 'probe-body', v: n, drifted: asm.drifted })
      return { text: `probe-body-ran v=${String(n)}` }
    }
    asm.noopDef = () => ({
      name: PROBE,
      description: 'Alpha.5 L1 startup-self-probe. args {v}. The BODY counter is the evidence.',
      parameters: { type: 'object', properties: { v: { type: 'number' } }, required: ['v'] },
      output: { schema: { type: 'object', additionalProperties: false, required: ['text'], properties: { text: { type: 'string' } } }, render: (_a, val) => [{ type: 'text', text: String(val?.text ?? '') }] },
      execute: probeExecute,
    })
    let driftSeq = 0
    asm.driftDef = () => {
      driftSeq += 1
      return {
        name: PROBE,
        description: `A5L1-DRIFT-${driftSeq} visibly-changed Definition (counter-example leg).`,
        parameters: { type: 'object', properties: { v: { type: 'number' } }, required: ['v'] },
        output: { schema: { type: 'object', additionalProperties: false, required: ['text'], properties: { text: { type: 'string' } } }, render: (_a, val) => [{ type: 'text', text: String(val?.text ?? '') }] },
        execute: async (args) => {
          const n = Number(args?.v ?? 0)
          asm.bodyCounts[`d${n}`] = (asm.bodyCounts[`d${n}`] ?? 0) + 1
          record({ leg: 'probe-body', v: n, drifted: true })
          return { text: `probe-body-ran-drifted v=${String(n)}` }
        },
      }
    }

    asm.probeDisposer = inner.tools.register(asm.noopDef())
    record({ leg: 'register', name: PROBE, ok: true })

    // wrapped `on` handed to the install: the tools/change listener stays in
    // the Host's REAL listener table; forwarding is the time-shifted lever.
    const onEvent = (event, listener) => {
      if (event === 'tools/change') {
        asm.sub.attempted = true
        const forwarder = (...args) => {
          asm.laneCalls += 1
          if (asm.laneEventRaw.length < 12) asm.laneEventRaw.push(rawEvent(args[0], args.slice(1), true))
          if (asm.swallowActive === false) {
            asm.laneDeliveries += 1
            try { listener(...args) } catch (error) { record({ leg: 'lane-listener-threw', error: String(error?.message ?? error) }) }
          } else {
            asm.absorbed += 1
          }
        }
        const off = inner.on(event, forwarder)
        record({ leg: 'subscribe', event, form: 'forwarder-into-real-table', disposerType: typeof off })
        return () => { asm.sub.disposerCalled = true; return off }
      }
      return inner.on(event, listener)
    }

    const nativeNames = (() => { try { const s = inner.tools.schemas(); return Array.isArray(s) ? s.map((r) => r?.name).filter((n) => typeof n === 'string' && n.length > 0) : [] } catch { return [] } })()
    const trusted = [...new Set([safeLabel(() => agent?.id), safeLabel(() => agent?.session?.header?.id)].filter((s) => !s.startsWith('(unreadable') && s !== '(unknown-agent)'))]

    const outcome = td.installScopedToolGuard({
      agentCtx: { tools: inner.tools, on: onEvent },
      runtimeAgent: agent,
      trustedIdentities: trusted,
      nativeNames,
      assemblyOwnedNames: [PROBE],
      onObserve: (row) => {
        asm.observations.push(rawEvent(row, [], true))
        if (String(row?.event) === 'dispatcher-call-executed-unvalidated') record({ leg: 'alarm', label, row: { event: row.event, severity: row.severity, tool: row.tool, changeChannel: row.changeChannel } })
      },
    })
    asm.installOk = outcome.ok === true
    if (!outcome.ok) { record({ leg: 'guard-install-refused', code: outcome.error?.code }); return }
    asm.handle = outcome.value
    asm.channelBeforeInjection = asm.handle.changeChannelStatus()
    asm.bindOwnOk = asm.handle.bindOwnTools([PROBE]).ok === true
    asm.publishedOk = asm.handle.publish().ok === true
    record({ leg: 'guard-assembled', label, installOk: true, bindOwnOk: asm.bindOwnOk, publishedOk: asm.publishedOk, channel: asm.channelBeforeInjection })

    // kit G-4 control subscription, mounted OUTSIDE the wrapper (proves the
    // REAL registry emits independently of the lane's forwarder state).
    const controlOff = inner.on('tools/change', (...args) => {
      asm.controlEvents += 1
      if (asm.controlEventRaw.length < 12) asm.controlEventRaw.push(rawEvent(args[0], args.slice(1), true))
    })
    asm.controlOff = controlOff

    // call-edge facts (same listeners the live round used)
    inner.on('tools/post-execute', (exec, result, next) => {
      if (String(exec?.name ?? '') === PROBE) {
        try { asm.verifiedAtCallEdge = asm.handle.dispatcher.surface.entryOf(PROBE)?.verified ?? null } catch { /* keep */ }
        if (asm.verifiedAtCallEdge === false) asm.verifiedFalseObserved = true
        const text = (Array.isArray(result?.content) ? result.content : []).map((c) => c?.text ?? '').join('')
        asm.toolResults.push({ isError: result?.isError === true, text: text.slice(0, 200), verifiedAfter: asm.verifiedAtCallEdge })
        record({ leg: 'probe-result', isError: result?.isError === true, text: text.slice(0, 120), verifiedAtCallEdge: asm.verifiedAtCallEdge })
      }
      return typeof next === 'function' ? next() : undefined
    })
  }

  function stateOf(asm) {
    const count = (pred) => asm.observations.filter(pred).length
    return {
      installOk: asm.installOk, bindOwnOk: asm.bindOwnOk, publishedOk: asm.publishedOk,
      channelBeforeInjection: asm.channelBeforeInjection,
      changeChannelStatus: asm.handle?.changeChannelStatus?.() ?? null,
      subAttempted: asm.sub.attempted, subDisposerCalled: asm.sub.disposerCalled,
      swallowActive: asm.swallowActive,
      laneCalls: asm.laneCalls, laneDeliveries: asm.laneDeliveries, absorbed: asm.absorbed, controlEvents: asm.controlEvents,
      laneEventRaw: asm.laneEventRaw, controlEventRaw: asm.controlEventRaw,
      bodyCounts: asm.bodyCounts, drifted: asm.drifted,
      verifiedAtCallEdge: asm.verifiedAtCallEdge, verifiedFalseObserved: asm.verifiedFalseObserved,
      verifiedNow: (() => { try { return asm.handle?.dispatcher?.surface?.entryOf?.(PROBE)?.verified ?? null } catch { return null } })(),
      pendingCalls: asm.handle?.pendingCalls?.()?.length ?? null,
      observationsCount: asm.observations.length,
      // loud five-piece counters (kit G-7 names)
      changeAbortIssued: count((o) => o.text.includes('"dispatcher-change-abort-issued"')),
      cancelledBeforeBody: count((o) => o.text.includes('"dispatcher-call-cancelled-before-body"')),
      executedUnvalidated: count((o) => o.text.includes('"dispatcher-call-executed-unvalidated"')),
      executedUnvalidatedAlarms: count((o) => o.text.includes('"dispatcher-call-executed-unvalidated"') && o.text.includes('"alarm"')),
      callEdgeDrift: count((o) => o.text.includes('"dispatcher-definition-change-at-call-edge"') && o.text.includes('"definition-drift"')),
      bindingRevisedUnverified: count((o) => o.text.includes('"dispatcher-binding-revised"') && o.text.includes('"verified":false')),
      toolResults: asm.toolResults,
    }
  }
}
