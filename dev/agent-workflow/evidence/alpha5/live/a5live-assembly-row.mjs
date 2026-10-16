/**
 * a5live-assembly-row.mjs — PR3 live-assembly slice (Scope-4 live round).
 *
 * A PLAIN plugin row mounted through the public profile-patch seam
 * (`$DSH_HOME/profiles/web/cordis.patch.yml`) — the same public seam the
 * production `dsh-agent-team` row and the p6t6 observer use. It carries the
 * TEST-SIDE LIVE assembly of:
 *
 *   Phase 1  the PR3 ControlledFs GATED FACE (`createAdmissionGatedControlledFs`)
 *            assembled INTO a real session Agent: the unbound typed refusal
 *            (`admission-unbound`) and the full PR2 admission flow
 *            bind → grant → one controlled FS read, executed BOTH at assembly
 *            time (in-assembly) and E2E through a real tool call
 *            (`a5live_fs_read`) whose body re-runs the flow, so the refusal
 *            and the read travel the real dispatch path into the transcript.
 *
 *   Phase 2  G-6 — the PR1 guard installed on the live Agent scope; one legal
 *            registry-change DELIVERED on the live subscription; the test face
 *            reads `handle.changeChannelStatus()` === 'proven' through
 *            GET /__a5live/state (the kit criterion RW-CHANNEL-PROVEN-ON-FIRST-DELIVERY, live version).
 *
 *   Phase 3  G-7 — the SAME install, but the `tools/change` subscription is
 *            SWALLOWED inside the test row (kit G-4 injection form: the entry
 *            sits in the Host's real listener table, its disposer is real and
 *            never called, and a proxy that forwards nothing stands at it).
 *            A row-owned control subscription proves the registry really
 *            emitted; the lane stays 'armed'; the five-piece loud predicate is
 *            read from the LIVE observation stream (kit criterion
 *            RW-CHANGE-SWALLOWED-LOUD, live version).
 *
 * This file is EVIDENCE (dev/agent-workflow/evidence/alpha5/live/): zero
 * production-surface change. It imports the built dist artifacts of THIS
 * worktree only through `a5live-fixtures.mjs` (public barrels / the same
 * install.ts factory the production glue uses).
 *
 * Cordis facts honoured (measured, a5p1 kit): a row scope cannot register
 * tools (`cannot get property "tools" without inject`); an Agent scope handed
 * to the `agent/created` payload CAN. Every read of someone else's object is
 * labelled, never assumed; every waterfall listener forwards `next()`.
 *
 * Kit-provided environment:
 *   A5LIVE_DIST    <worktree>/packages/runtime/dist/packages
 *   A5LIVE_LEDGER  JSONL ledger path (append-only)
 *   A5LIVE_FSWORLD absolute path of the controlled-fs fixture world
 *   A5LIVE_MODE    s1s2 | g6 | g7
 *   A5LIVE_TARGET  optional substring to select the Agent (else: first Agent)
 *
 * @module dev/agent-workflow/evidence/alpha5/live/a5live-assembly-row
 */
import { appendFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'

export const name = 'a5live-assembly'
export const inject = ['webServer', 'agents']

const LEDGER = process.env['A5LIVE_LEDGER'] ?? ''
const DIST = process.env['A5LIVE_DIST'] ?? ''
const FS_WORLD = process.env['A5LIVE_FSWORLD'] ?? ''
const MODE = process.env['A5LIVE_MODE'] ?? 's1s2'
const TARGET = process.env['A5LIVE_TARGET'] ?? ''

function record(row) {
  const line = JSON.stringify({ at: new Date().toISOString(), ...row })
  if (LEDGER !== '') {
    try {
      mkdirSync(dirname(LEDGER), { recursive: true })
      appendFileSync(LEDGER, line + '\n')
    } catch { /* the journal below is the authoritative in-process copy */ }
  }
  JOURNAL.push({ at: new Date().toISOString(), ...row })
}
const JOURNAL = []

/** One entry per assembled Agent — the runner reads these through the routes. */
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

/** Live counters computed FROM the in-process handle + captured observations
 *  at read time (the test face reading the live object, not a JSON replay). */
function guardView(asm) {
  if (asm.handle === undefined) return null
  const obs = asm.observations
  const count = (event) => obs.filter((o) => String(o.event) === event).length
  const verifiedNow = (() => {
    try { return asm.handle.dispatcher.surface.entryOf(asm.driftName)?.verified ?? null } catch { return null }
  })()
  return {
    changeChannelStatus: asm.handle.changeChannelStatus(),
    pendingCalls: asm.handle.pendingCalls(),
    observationsCount: obs.length,
    // the kit's predicate fields, same names, same filters (a5p1r kit mjs:536-568)
    changeAbortIssued: count('dispatcher-change-abort-issued'),
    cancelledBeforeBody: count('dispatcher-call-cancelled-before-body'),
    executedUnvalidated: count('dispatcher-call-executed-unvalidated'),
    callEdgeDrift: obs.filter((o) => String(o.event) === 'dispatcher-definition-change-at-call-edge' && String(o.reason) === 'definition-drift').length,
    bindingRevisedUnverified: obs.filter((o) => String(o.event) === 'dispatcher-binding-revised' && o.verified === false).length,
    executedUnvalidatedAlarms: obs.filter((o) => String(o.event) === 'dispatcher-call-executed-unvalidated' && o.severity === 'alarm').length,
    abortIssuedRows: obs.filter((o) => String(o.event) === 'dispatcher-change-abort-issued'),
    alarmRows: obs.filter((o) => String(o.event) === 'dispatcher-call-executed-unvalidated' && o.severity === 'alarm'),
    verifiedAtCallEdge: asm.verifiedAtCallEdge,
    verifiedFalseObserved: asm.verifiedFalseObserved,
    verifiedNow,
    swallow: asm.swallow,
    controlEvents: asm.swallow.controlEvents,
    proxyEmissions: asm.swallow.proxyEmissions,
    bodyCounts: asm.bodyCounts,
    rebind: asm.rebind,
    installOk: asm.installOk,
    publishedOk: asm.publishedOk,
    bindOwnOk: asm.bindOwnOk,
    channelBeforeInjection: asm.channelBeforeInjection,
  }
}

export async function apply(ctx) {
  const webServer = ctx.webServer
  record({ leg: 'plugin-apply', pid: process.pid, mode: MODE, hasWebServer: webServer !== undefined && typeof webServer.register === 'function', dist: DIST })

  let lanes = null
  try {
    const mod = await import(new URL(`file://${join(import.meta.dirname, 'a5live-fixtures.mjs')}`).href)
    lanes = await mod.loadA5LiveLanes(DIST)
    record({ leg: 'lanes-imported', ok: true })
  } catch (error) {
    record({ leg: 'lanes-imported', ok: false, error: String(error?.message ?? error) })
  }

  // ── routes: the test face reading the LIVE process ────────────────────────
  if (webServer !== undefined && typeof webServer.register === 'function') {
    webServer.register({
      kind: 'exact', path: '/__a5live/health',
      handler: (_req, res) => sendJson(res, 200, { ok: true, pid: process.pid, mode: MODE, applied: true, agents: [...assemblies.keys()] }),
    }, 'a5live health')
    webServer.register({
      kind: 'exact', path: '/__a5live/journal',
      handler: (_req, res) => sendJson(res, 200, { rows: JOURNAL }),
    }, 'a5live journal')
    webServer.register({
      kind: 'exact', path: '/__a5live/state',
      handler: (_req, res) => {
        const out = {}
        for (const [label, asm] of assemblies) {
          out[label] = {
            assembly: asm.assemblyResult ?? null,
            guard: guardView(asm),
            toolResults: asm.toolResults,
          }
        }
        sendJson(res, 200, { mode: MODE, assemblies: out })
      },
    }, 'a5live state')
  }

  // ── discovery: events are best-effort; the PUBLIC read is ctx.agents ────
  // (core-plugin pattern, file-reference-local: ctx.agents.get(session.id),
  //  ctx.on('agent/created')). On this pinned Host a plain row's `agent/created`
  //  subscription was MEASURED to receive nothing in our world (disclosed
  //  observation of this round) — the runner therefore drives assembly
  //  explicitly through POST /__a5live/assemble, which resolves the Agent
  //  through the same public service the core plugins use.
  let onCreatedOff = null
  try {
    onCreatedOff = ctx.on('agent/created', (payload) => {
      record({ leg: 'agent-created-event', label: agentLabel(payload?.agent) })
    })
    record({ leg: 'listen', event: 'agent/created', ok: true })
  } catch (error) {
    record({ leg: 'listen', event: 'agent/created', ok: false, error: String(error?.message ?? error) })
  }
  ctx.effect?.(() => { try { onCreatedOff?.() } catch { /* scope unwind */ } }, 'a5live-assembly')

  async function listAgents() {
    try {
      return await ctx.agents.inject?.(['agents'], () => ctx.agents.list?.() ?? []) ?? ctx.agents.list?.() ?? []
    } catch {
      try { return ctx.agents.list?.() ?? [] } catch { return 'threw' }
    }
  }
  async function getAgent(sessionId) {
    try { return ctx.agents.inject?.(['agents'], () => ctx.agents.get?.(sessionId)) ?? ctx.agents.get?.(sessionId) ?? null } catch { return null }
  }

  // route-driven assembly (the runner's explicit seam)
  if (webServer !== undefined && typeof webServer.register === 'function') {
    webServer.register({
      kind: 'exact', path: '/__a5live/agents',
      handler: async (_req, res) => {
        let rows
        try {
          const list = ctx.agents.list?.() ?? []
          rows = [...list].map((a) => ({ id: safeLabel(() => a?.id), session: safeLabel(() => a?.session?.header?.id), hasCtx: a?.ctx !== undefined }))
        } catch (error) { rows = [{ error: String(error?.message ?? error) }] }
        sendJson(res, 200, { agents: rows })
      },
    }, 'a5live agents')
    webServer.register({
      kind: 'exact', path: '/__a5live/assemble',
      handler: async (req, res) => {
        let body = ''
        for await (const chunk of req) body += chunk
        let parsed
        try { parsed = JSON.parse(body || '{}') } catch { parsed = {} }
        const sessionId = String(parsed?.sessionId ?? '')
        const agent = await getAgent(sessionId)
        if (agent === null || agent === undefined) { sendJson(res, 404, { ok: false, error: `no agent for session ${sessionId}` }); return }
        const label = agentLabel(agent)
        if (assemblies.has(label)) { sendJson(res, 200, { ok: true, already: true, label }); return }
        void assemble(label, agent).catch((error) => {
          record({ leg: 'assembly-failed', label, error: String(error?.stack ?? error).slice(0, 800) })
        })
        sendJson(res, 200, { ok: true, started: true, label })
      },
    }, 'a5live assemble')
  }

  // ── the live assembly for one Agent ───────────────────────────────────────
  async function assemble(label, agent) {
    const asm = {
      assemblyResult: null,
      handle: undefined,
      observations: [],
      verifiedAtCallEdge: null,
      verifiedFalseObserved: false,
      swallow: { proxyEmissions: 0, controlEvents: 0 },
      bodyCounts: { v1: 0, v2: 0, v3: 0 },
      rebind: { attempted: false, ok: null },
      toolResults: [],
      installOk: false, publishedOk: false, bindOwnOk: false,
      channelBeforeInjection: 'unknown',
      driftName: 'a5live_drift',
    }
    assemblies.set(label, asm)
    let agentCtx
    try { agentCtx = agent?.ctx } catch (error) { record({ leg: 'agent-ctx-unreadable', label, error: String(error?.message ?? error) }); return }
    if (agentCtx === undefined || typeof agentCtx.on !== 'function' || typeof agentCtx.tools?.register !== 'function') {
      record({ leg: 'agent-ctx-unusable', label, hasOn: typeof agentCtx?.on, hasRegister: typeof agentCtx?.tools?.register })
      return
    }
    const inner = agentCtx
    const disposers = []
    const listen = (target, event, handler) => {
      try { disposers.push(target.on(event, handler)); return true } catch (error) { record({ leg: 'listen-fail', label, event, error: String(error?.message ?? error) }); return false }
    }

    // surface probe (labelled reads, never assumptions)
    const probe = {
      hasTools: inner.tools !== undefined,
      hasGuard: typeof inner.tools?.guard === 'function',
      hasGet: typeof inner.tools?.get === 'function',
      hasSchemas: typeof inner.tools?.schemas === 'function',
      globalSchemaNames: (() => { try { const s = inner.tools?.schemas?.(); return Array.isArray(s) ? s.map((r) => r?.name).filter(Boolean).length : null } catch { return 'threw' } })(),
      scopedSchemaNames: (() => { try { const s = inner.tools?.schemas?.(agent); return Array.isArray(s) ? s.map((r) => r?.name).filter(Boolean).length : null } catch { return 'threw' } })(),
    }
    record({ leg: 'surface-probe', label, ...probe })

    if (MODE === 's1s2') { await runS1S2(label, inner, asm); return }
    await runGuard(label, agent, inner, asm, listen)
  }

  // ── PHASE 1: ControlledFs gated face in the real session ─────────────────
  async function runS1S2(label, inner, asm) {
    const mod = await import(new URL(`file://${join(import.meta.dirname, 'a5live-fixtures.mjs')}`).href)
    const world = mod.buildLiveFsWorld(FS_WORLD)
    // in-assembly legs (real Host process, real session context)
    const unbound = await mod.runUnboundRead({ cf: lanes.cf, tg: lanes.tg }, world)
    const bound = await mod.runBoundBindGrantRead({ cf: lanes.cf, tg: lanes.tg, ta: lanes.ta }, world, 'assembly')
    asm.assemblyResult = { unbound, bound }
    record({ leg: 'assembly-s1s2', label, unboundOk: unbound.ok === false && unbound.refusal?.cfReason === 'effect-outside-grant', boundStage: bound.stage, boundReadOk: bound.firstOk === true })
    // E2E: one tool whose BODY runs the flows; the model calls it twice.
    const def = {
      name: 'a5live_fs_read',
      description: 'Alpha.5 live-assembly probe. args {mode: "unbound"|"bound"}. Runs the gated ControlledFs flow and reports what the LIVE lane observed.',
      parameters: { type: 'object', properties: { mode: { type: 'string' }, tag: { type: 'string' } }, required: ['mode'] },
      output: {
        schema: { type: 'object', additionalProperties: false, required: ['text'], properties: { text: { type: 'string' } } },
        render: (_args, value) => [{ type: 'text', text: String(value?.text ?? '') }],
      },
      execute: async (args) => {
        try {
          if (args?.mode === 'unbound') {
            const r = await mod.runUnboundRead({ cf: lanes.cf, tg: lanes.tg }, world)
            asm.toolResults.push({ kind: 'e2e-unbound', ok: r.ok, cfReason: r.refusal?.cfReason ?? null, code: r.refusal?.code ?? null })
            return { text: `A5LIVE-UNBOUND refused=${String(r.ok === false)} code=${String(r.refusal?.code)} cfClass=${String(r.refusal?.cfClass)} cfReason=${String(r.refusal?.cfReason)} msgHasAdmissionUnbound=${String(String(r.refusal?.message).includes('admission-unbound'))}` }
          }
          const r = await mod.runBoundBindGrantRead({ cf: lanes.cf, tg: lanes.tg, ta: lanes.ta }, world, `e2e-${String(args?.tag ?? 'x')}`)
          asm.toolResults.push({ kind: 'e2e-bound', ok: r.firstOk, stage: r.stage })
          return { text: `A5LIVE-BOUND stage=${r.stage} firstOk=${String(r.firstOk)} textMatches=${String(r.firstTextMatches)} secondRefused=${String(r.secondOk === false)} secondCode=${String(r.secondRefusal?.code)} portCalls=${String(r.portCallCount)} fpIsBound=${String(r.presentedFingerprintIsBound)} consumed=${String(r.ledgerConsumedCount)}` }
        } catch (error) {
          record({ leg: 'fs-read-body-threw', error: String(error?.message ?? error) })
          return { text: `A5LIVE-FS-ERROR ${String(error?.message ?? error).slice(0, 200)}` }
        }
      },
    }
    try { inner.tools.register(def); record({ leg: 'register', label, name: 'a5live_fs_read', ok: true }) } catch (error) {
      record({ leg: 'register', label, name: 'a5live_fs_read', ok: false, error: String(error?.message ?? error) })
    }
  }

  // ── PHASE 2/3: the PR1 guard live; G-6 passthrough / G-7 swallow ─────────
  async function runGuard(label, agent, inner, asm, listen) {
    const swallow = MODE === 'g7'
    let version = 1
    const driftDef = () => ({
      name: asm.driftName,
      description: 'Alpha.5 live guard probe. args {v: number}. The BODY counter is the evidence.',
      parameters: { type: 'object', properties: { v: { type: 'number' } }, required: ['v'] },
      output: {
        schema: { type: 'object', additionalProperties: false, required: ['text'], properties: { text: { type: 'string' } } },
        render: (_args, value) => [{ type: 'text', text: String(value?.text ?? '') }],
      },
      execute: async (args) => {
        const n = Number(args?.v ?? 0)
        asm.bodyCounts[`v${n}`] = (asm.bodyCounts[`v${n}`] ?? 0) + 1
        record({ leg: 'drift-body', label, v: n, version })
        return { text: `drift-body-ran v=${String(n)}` }
      },
    })
    let driftDisposer
    try { driftDisposer = inner.tools.register(driftDef()); record({ leg: 'register', label, name: asm.driftName, ok: true, version: 1 }) } catch (error) {
      record({ leg: 'register', label, name: asm.driftName, ok: false, error: String(error?.message ?? error) }); return
    }

    // the wrapped `on` handed to installScopedToolGuard (kit G-4 injection form)
    const onEvent = (event, listener) => {
      if (event === 'tools/change' && swallow) {
        const proxy = () => { asm.swallow.proxyEmissions += 1 }
        return inner.on(event, proxy) // accepted into the REAL table; forwards nothing
      }
      return inner.on(event, listener)
    }
    const nativeNames = (() => { try { const s = inner.tools.schemas(); return Array.isArray(s) ? s.map((r) => r?.name).filter((n) => typeof n === 'string' && n.length > 0) : [] } catch { return [] } })()
    const trusted = [...new Set([
      safeLabel(() => agent?.id), safeLabel(() => agent?.session?.header?.id),
    ].filter((s) => !s.startsWith('(unreadable') && s !== '(unknown-agent)'))]
    const outcome = lanes.td.installScopedToolGuard({
      agentCtx: { tools: inner.tools, on: onEvent },
      runtimeAgent: agent,
      trustedIdentities: trusted,
      nativeNames,
      assemblyOwnedNames: [asm.driftName],
      onObserve: (row) => { asm.observations.push(row); if (String(row?.event) === 'dispatcher-call-executed-unvalidated') record({ leg: 'alarm', label, row: { event: row.event, callId: row.callId, tool: row.tool, changeChannel: row.changeChannel, severity: row.severity } }) },
    })
    asm.installOk = outcome.ok === true
    if (!outcome.ok) {
      asm.assemblyResult = { installError: outcome.error }
      record({ leg: 'guard-install-refused', label, code: outcome.error?.code, message: String(outcome.error?.message).slice(0, 300) })
      return
    }
    const handle = outcome.value
    asm.handle = handle
    asm.channelBeforeInjection = handle.changeChannelStatus()
    const bound = handle.bindOwnTools([asm.driftName])
    asm.bindOwnOk = bound.ok === true
    const published = handle.publish()
    asm.publishedOk = published.ok === true
    record({ leg: 'guard-assembled', label, installOk: true, bindOwnOk: asm.bindOwnOk, publishedOk: asm.publishedOk, channelBeforeInjection: asm.channelBeforeInjection })
    asm.assemblyResult = { installOk: true, bindOwnOk: asm.bindOwnOk, publishedOk: published.ok === true, publishedError: published.ok ? null : published.error }

    // kit G-4 control subscription: proves the REAL registry emits, independent
    // of the lane's swallowed subscription (mount it OUTSIDE the wrapper).
    if (swallow) listen(inner, 'tools/change', () => { asm.swallow.controlEvents += 1 })

    // The LEGAL registry change, mounted the kit mounts it: a `tools/execute`
    // listener installed AFTER the lane's door re-registers the name's own
    // Definition (same row, same name, new Body — the ordinary way a plugin
    // updates its own tool). One time only.
    let movedOnce = false
    listen(inner, 'tools/execute', (exec, next) => {
      const name2 = String(exec?.name ?? '')
      if (name2 !== asm.driftName || movedOnce) return typeof next === 'function' ? next() : undefined
      movedOnce = true
      version = 2
      try {
        // the ordinary way a row replaces its own Definition on this Host:
        // unregister (the disposer register() returned), then register fresh.
        // Both moves emit tools/change on the REAL registry.
        try { const r = driftDisposer?.(); if (r && typeof r.then === 'function') r.then(() => {}, () => {}) } catch { /* best effort */ }
        driftDisposer = inner.tools.register(driftDef())
        record({ leg: 'legal-re-register', label, name: name2, version: 2 })
      } catch (error) {
        record({ leg: 'legal-re-register-failed', label, error: String(error?.message ?? error) })
      }
      return typeof next === 'function' ? next() : undefined
    })
    // record the verified flag at the call edge of the drift call's settle
    listen(inner, 'tools/post-execute', (exec, result, next) => {
      if (String(exec?.name ?? '') === asm.driftName) {
        try { asm.verifiedAtCallEdge = handle.dispatcher.surface.entryOf(asm.driftName)?.verified ?? null } catch { /* keep null */ }
        if (asm.verifiedAtCallEdge === false) asm.verifiedFalseObserved = true
        const text = (Array.isArray(result?.content) ? result.content : []).map((c) => c?.text ?? '').join('')
        asm.toolResults.push({ name: String(exec?.name), isError: result?.isError === true, text: text.slice(0, 300), verifiedAfter: asm.verifiedAtCallEdge })
        record({ leg: 'drift-result', label, isError: result?.isError === true, text: text.slice(0, 160), verifiedAtCallEdge: asm.verifiedAtCallEdge })
      }
      return typeof next === 'function' ? next() : undefined
    })
    // the documented recovery: the trusted assembly explicitly re-binds after
    // the drift downgrade refused a call (the SAME arm, no extrapolation).
    listen(inner, 'tools/post-execute', (exec, result, next) => {
      if (String(exec?.name ?? '') === asm.driftName && result?.isError === true && asm.rebind.attempted === false && asm.verifiedAtCallEdge === false) {
        asm.rebind.attempted = true
        const rb = handle.bindOwnTools([asm.driftName])
        asm.rebind.ok = rb.ok === true
        asm.rebind.error = rb.ok ? null : rb.error
        record({ leg: 'rebind', label, ok: rb.ok === true })
      }
      return typeof next === 'function' ? next() : undefined
    })
  }
}
