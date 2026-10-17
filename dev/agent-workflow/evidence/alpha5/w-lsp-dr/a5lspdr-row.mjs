/**
 * a5lspdr-row.mjs — W-LSP-DR assembly row: verifies the PROPOSED (not yet
 * adjudicated) ruling semantics "policy change -> destroy & rebuild the
 * member-isolated instance" ASSEMBLED on the EXISTING public surface only.
 * Mounted through the public profile-patch seam ($DSH_HOME/profiles/web/
 * cordis.patch.yml); zero production-row mounts; zero production interfaces
 * added or modified (frozen face respected: no SpawnReceipt, no streaming
 * start method — see LSP-rulings-brief.md R-1/R-2).
 *
 * Public faces used (all already public, same faces W-PTC-RE booked LIVE):
 *   - `agent.ctx.isolate(label)`            per-agent realm (member-isolated instance)
 *   - `realm.plugin(Lsp|LspStdio|ToolLsp)`  public barrel remount of the host's own libs
 *   - fiber `dispose()`                     the public disposal face (awaited, bounded)
 *   - `ctx.webServer.register`              evidence routes
 *   - `agent.ctx.on('tools/execute')`       public around-seam capture of model-route results
 *
 * The policy label is TEAM-SIDE assembly state (a string + the workspace root
 * it maps to). "Policy change" in this kit = POST /__a5lspdr/policy-change:
 * ONE step that (a) disposes the member's whole old realm (fibers, reverse
 * order), journals `realm-disposed` with the old server pid it last served,
 * then (b) mounts a NEW realm (new isolate + new plugin fibers) bound to the
 * new generation's policy (its workspace root). This demonstrates the
 * assembly-discipline SHAPE of the proposed semantics — it is not OS
 * enforcement and not an interface promise (README, honesty section).
 *
 * Kit-provided environment (set by run-a5lspdr-live.mjs on the host process):
 *   A5LSPDR_TESTUSE         pinned host tree root (built lib plane, read-only)
 *   A5LSPDR_LEDGER          JSONL journal path (this row's events, append-only)
 *   A5LSPDR_SERVER          fake language server script
 *   A5LSPDR_SERVER_LEDGER   fixture-side PID birth/death ledger (server env)
 *   A5LSPDR_RUN             run id
 *
 * @module dev/agent-workflow/evidence/alpha5/w-lsp-dr/a5lspdr-row
 */
import { appendFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { pathToFileURL } from 'node:url'

export const name = 'a5lspdr-assembly'
export const inject = ['webServer', 'agents', 'tools']

const TESTUSE = process.env.A5LSPDR_TESTUSE ?? ''
const LEDGER = process.env.A5LSPDR_LEDGER ?? ''
const SERVER = process.env.A5LSPDR_SERVER ?? ''
const SERVER_LEDGER = process.env.A5LSPDR_SERVER_LEDGER ?? ''
const RUN = process.env.A5LSPDR_RUN ?? 'run'

const lib = (rel) => pathToFileURL(join(TESTUSE, rel)).href
const URLS = {
  lsp: lib('packages/lsp/lsp/lib/index.js'),
  lspStdio: lib('packages/lsp/lsp-stdio/lib/index.js'),
  toolLsp: lib('packages/lsp/tool-lsp/lib/index.js'),
}

const JOURNAL = []
function record(row) {
  const line = JSON.stringify({ at: new Date().toISOString(), ...row })
  if (LEDGER !== '') {
    try { mkdirSync(dirname(LEDGER), { recursive: true }); appendFileSync(LEDGER, line + '\n') } catch { /* journal copy stands */ }
  }
  JOURNAL.push({ at: new Date().toISOString(), ...row })
}

const sendJson = (res, status, body) => { res.writeHead(status, { 'content-type': 'application/json' }); res.end(JSON.stringify(body)) }
const readBody = async (req) => { let b = ''; for await (const c of req) b += c; try { return JSON.parse(b || '{}') } catch { return {} } }
const slug = (v) => String(v ?? 'untagged').replace(/[^A-Za-z0-9._-]/g, '_').slice(0, 80)
const agentLabel = (agent) => slug(agent?.id ?? agent?.session?.header?.id ?? agent?.scopeKey ?? 'unknown')
const AUDIT_RE = /A5DR pid=(\d+) gen=(\S+) opens=(\d+) cwd=(\S+)/

const assemblies = new Map()

export async function apply(ctx) {
  record({ leg: 'plugin-apply', pid: process.pid, run: RUN, testUse: TESTUSE })

  function findAgent(sessionId) {
    try {
      for (const a of ctx.agents.list?.() ?? []) if (a?.id === sessionId || a?.session?.header?.id === sessionId) return a
      return null
    } catch { return null }
  }

  async function assembleRealm({ agent, label, gen, root, legs }) {
    const Lsp = (await import(URLS.lsp)).default
    const lspStdio = await import(URLS.lspStdio)
    const toolLsp = await import(URLS.toolLsp)
    const asm = { label, agent, gen, root, legs: [], fibers: [], modelRouteResults: [], lastPid: null, lastAudit: null, disposed: false, ok: false, error: null }
    const realm = agent.ctx.isolate('lsp')
    asm.realm = realm
    asm.fibers.push(realm.plugin(Lsp))
    asm.fibers.push(realm.plugin(lspStdio, {
      servers: {
        'a5lspdr-fake-lang': {
          command: process.execPath,
          args: [SERVER],
          env: { A5DR_GEN: gen, A5DR_LEDGER: SERVER_LEDGER },
          extensionToLanguage: { '.a5lspdr': 'a5drfake' },
          initializationOptions: null,
          configuration: null,
          maxMessageBytes: 2_000_000,
          maxStderrBytes: 200_000,
          maxDocumentBytes: 1_000_000,
          shutdownTimeoutMs: 1500,
          killGraceMs: 1000,
        },
      },
    }))
    asm.fibers.push(realm.plugin(toolLsp))
    for (const f of asm.fibers) await f
    // capture the realm's Lsp service through a plugin's own inject face
    const cap = realm.plugin({ inject: ['lsp'], apply: (inner) => { asm.lspService = inner.lsp } })
    asm.fibers.push(cap)
    await cap
    // public around-seam: capture REAL model-route ('lsp' tool) results for this realm
    agent.ctx.on?.('tools/execute', (exec, next) => {
      const out = next()
      if (exec?.name === 'lsp') {
        Promise.resolve(out).then((res) => {
          const text = (res?.content ?? []).map((c) => c?.text ?? '').join('\n').slice(0, 1500)
          asm.modelRouteResults.push({ at: new Date().toISOString(), isError: res?.isError === true, text })
          const m = AUDIT_RE.exec(text)
          if (m != null) { asm.lastPid = Number(m[1]); asm.lastAudit = text.slice(0, 400) }
        }).catch((error) => asm.modelRouteResults.push({ error: String(error?.message ?? error).slice(0, 300) }))
      }
      return out
    })
    asm.ok = true
    assemblies.set(label, asm)
    record({ leg: 'realm-assembled', label, gen, root, agentId: String(agent?.id ?? ''), legs: ['isolate', 'lsp', 'lsp-stdio', 'tool-lsp', 'cap'] })
    void legs
    return asm
  }

  async function disposeRealm(asm) {
    const t0 = Date.now()
    for (const f of [...asm.fibers].reverse()) await f.dispose()
    asm.disposed = true
    asm.disposeMs = Date.now() - t0
    record({ leg: 'realm-disposed', label: asm.label, gen: asm.gen, root: asm.root, lastPid: asm.lastPid, disposeMs: asm.disposeMs })
    return asm.disposeMs
  }

  if (typeof ctx.webServer?.register === 'function') {
    ctx.webServer.register({ kind: 'exact', path: '/__a5lspdr/health', handler: (_q, res) => sendJson(res, 200, { ok: true, applied: true, pid: process.pid, run: RUN }) }, 'a5lspdr health')
    ctx.webServer.register({ kind: 'exact', path: '/__a5lspdr/journal', handler: (_q, res) => sendJson(res, 200, { rows: JOURNAL }) }, 'a5lspdr journal')
    ctx.webServer.register({ kind: 'exact', path: '/__a5lspdr/state', handler: (_q, res) => {
      const out = {}
      for (const [label, a] of assemblies) out[label] = {
        gen: a.gen, root: a.root, ok: a.ok, disposed: a.disposed, lastPid: a.lastPid, lastAudit: a.lastAudit,
        disposeMs: a.disposeMs ?? null, modelRouteCount: a.modelRouteResults.length,
        modelRouteResults: a.modelRouteResults.slice(-6),
      }
      sendJson(res, 200, { assemblies: out })
    } }, 'a5lspdr state')
    ctx.webServer.register({ kind: 'exact', path: '/__a5lspdr/defs', handler: (_q, res) => {
      const defs = []
      for (const [, a] of assemblies) { if (a.disposed) continue; try { defs.push(ctx.tools.get?.('lsp', a.agent) ?? null) } catch { defs.push(null) } }
      const distinct = defs.length >= 2 && defs.every((d) => d != null) && new Set(defs).size === defs.length
      sendJson(res, 200, { liveRealms: defs.length, allDefined: defs.every((d) => d != null), distinctDefinitions: distinct })
    } }, 'a5lspdr defs')

    // initial assembly (generation 0 for a member)
    ctx.webServer.register({ kind: 'exact', path: '/__a5lspdr/assemble', handler: async (req, res) => {
      const p = await readBody(req)
      const agent = findAgent(String(p?.sessionId ?? ''))
      if (agent == null) { sendJson(res, 404, { ok: false, error: `no agent for session ${p?.sessionId}` }); return }
      const label = agentLabel(agent)
      if (assemblies.has(label)) { sendJson(res, 200, { ok: true, already: true, label }); return }
      try {
        const asm = await assembleRealm({ agent, label, gen: String(p?.gen ?? 'g0'), root: String(p?.root ?? '') })
        sendJson(res, 200, { ok: true, label, gen: asm.gen })
      } catch (error) { record({ leg: 'assembly-failed', label, error: String(error?.stack ?? error).slice(0, 900) }); sendJson(res, 200, { ok: false, error: String(error?.stack ?? error).slice(0, 900) }) }
    } }, 'a5lspdr assemble')

    // THE proposed-semantics step: policy change = dispose old realm + rebuild new realm
    ctx.webServer.register({ kind: 'exact', path: '/__a5lspdr/policy-change', handler: async (req, res) => {
      const p = await readBody(req)
      const oldAsm = assemblies.get(String(p?.oldLabel ?? ''))
      if (oldAsm == null) { sendJson(res, 404, { ok: false, error: `no assembly for oldLabel ${p?.oldLabel}` }); return }
      const agent = findAgent(String(p?.sessionId ?? ''))
      if (agent == null) { sendJson(res, 404, { ok: false, error: `no agent for session ${p?.sessionId}` }); return }
      record({ leg: 'policy-change-begin', oldLabel: oldAsm.label, oldGen: oldAsm.gen, newGen: String(p?.gen ?? ''), newRoot: String(p?.root ?? ''), oldLastPid: oldAsm.lastPid })
      try {
        const disposeMs = await disposeRealm(oldAsm)
        const label = agentLabel(agent)
        const asm = await assembleRealm({ agent, label, gen: String(p?.gen ?? ''), root: String(p?.root ?? '') })
        record({ leg: 'policy-change-complete', oldLabel: oldAsm.label, newLabel: label, newGen: asm.gen, oldLastPid: oldAsm.lastPid })
        sendJson(res, 200, { ok: true, old: { label: oldAsm.label, lastPid: oldAsm.lastPid, disposeMs }, label, gen: asm.gen })
      } catch (error) {
        record({ leg: 'policy-change-failed', oldLabel: oldAsm.label, error: String(error?.stack ?? error).slice(0, 900) })
        sendJson(res, 200, { ok: false, error: String(error?.stack ?? error).slice(0, 900) })
      }
    } }, 'a5lspdr policy-change')

    // plain realm dispose (final teardown of a member instance)
    ctx.webServer.register({ kind: 'exact', path: '/__a5lspdr/dispose', handler: async (req, res) => {
      const p = await readBody(req)
      const asm = assemblies.get(String(p?.label ?? ''))
      if (asm == null) { sendJson(res, 404, { ok: false, error: 'no label' }); return }
      try { const disposeMs = await disposeRealm(asm); sendJson(res, 200, { ok: true, disposeMs, lastPid: asm.lastPid }) }
      catch (error) { sendJson(res, 200, { ok: false, error: String(error?.stack ?? error).slice(0, 400) }) }
    } }, 'a5lspdr dispose')

    // direct assembly-face query (workspaceRoot explicit)
    ctx.webServer.register({ kind: 'exact', path: '/__a5lspdr/hover', handler: async (req, res) => {
      const p = await readBody(req)
      const asm = assemblies.get(String(p?.label ?? ''))
      if (asm == null || asm.lspService == null) { sendJson(res, 404, { ok: false, error: 'no realm for label' }); return }
      try {
        const result = await asm.lspService.query({
          operation: 'hover',
          filePath: String(p?.filePath ?? ''),
          workspaceRoot: String(p?.workspaceRoot ?? asm.root),
          position: { line: Number(p?.line ?? 1), character: Number(p?.character ?? 1) },
        })
        const text = result?.contents ?? JSON.stringify(result)
        const m = AUDIT_RE.exec(String(text))
        if (m != null) { asm.lastPid = Number(m[1]); asm.lastAudit = String(text).slice(0, 400) }
        sendJson(res, 200, { ok: true, text })
      } catch (error) { sendJson(res, 200, { ok: false, error: String(error?.message ?? error) }) }
    } }, 'a5lspdr hover')
  }

  record({ leg: 'routes-registered', run: RUN })
}
