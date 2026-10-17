/**
 * a5ptc-row.mjs — W-PTC-RE assembly row: the PTC pipeline and the per-member LSP
 * pool assembled INTO real session Agents on the pinned Host, through the public
 * profile-patch seam ONLY (`$DSH_HOME/profiles/web/cordis.patch.yml`, same
 * mount face as the W4/W5 rows).
 *
 * Mode `ptc` (M-08 missing legs, "PTC 管线两腿"):
 *   - `agent.ctx.tools.presentAs("ptc")` — the public scoped presentation seam
 *     makes the reserved `run_code` transport visible to THIS agent (the host's
 *     own base bundle already mounts the `ptcRuntime` implementation; this row
 *     assembles nothing of the runtime itself — census recorded).
 *   - two scoped witness tools (`a5ptc_echo`, `a5ptc_denied_probe`) registered
 *     through `agent.ctx.tools.register` (per-agent variant face);
 *   - a Team guard through the public `agent.ctx.tools.guard` face: it witnesses
 *     EVERY execution — outer `run_code` and each inner PTC sub-call (exec.parent
 *     present, exec.rootCallId == outer callId) — in dispatch order, and DENIES
 *     the probe tool by returning a typed reason;
 *   - reserved-transport throw census: `register`/`restrict` at BOTH the root
 *     face and the agent scope must throw the reserved-name typed error
 *     (transport_same_name_both_sides_throw).
 *
 * Mode `lsp` (M-09 per-Member pool leg):
 *   - per member: `agent.ctx.isolate("lsp")` realm + public plugin remount of
 *     `@deepseek-ai/dsh-lsp` + `@deepseek-ai/dsh-lsp-stdio` + `@deepseek-ai/dsh-tool-lsp`
 *     (file-URL imports of the host's OWN built barrels — same realpath, same
 *     module instances; zero vendor copy, zero patch);
 *   - the model route `execute("lsp", {agent})` then resolves THAT member's
 *     definition and that member's resident server pid (fixture-server audit —
 *     the server is fictional, the pool/spawn/route are real).
 *
 * Honesty: every judgement is recorded from the LIVE process (journal + routes);
 * no backfill; fixture caliber is disclosed in every record.
 *
 * Kit-provided environment:
 *   A5PTC_MODE        ptc | lsp
 *   A5PTC_TESTUSE     pinned host tree root (built lib plane, read-only)
 *   A5PTC_LEDGER      JSONL ledger path (append-only)
 *   A5PTC_SERVER      fake language server script (lsp mode)
 *   A5PTC_WS          workspace root for LSP fixtures (lsp mode)
 *   A5PTC_RUN         run id (guard deny token)
 *
 * @module dev/agent-workflow/evidence/alpha5/w-ptc-re/a5ptc-row
 */
import { appendFileSync, mkdirSync, readdirSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { pathToFileURL } from 'node:url'

export const name = 'a5ptc-assembly'
export const inject = ['webServer', 'agents', 'tools']

const MODE = process.env.A5PTC_MODE ?? 'ptc'
const TESTUSE = process.env.A5PTC_TESTUSE ?? ''
const LEDGER = process.env.A5PTC_LEDGER ?? ''
const SERVER = process.env.A5PTC_SERVER ?? ''
const WS = process.env.A5PTC_WS ?? ''
const RUN = process.env.A5PTC_RUN ?? 'run'

const lib = (rel) => pathToFileURL(join(TESTUSE, rel)).href
const URLS = {
  tools: lib('packages/core/tools/lib/index.js'),
  scope: lib('packages/core/scope/lib/index.js'),
  sandboxPolicy: lib('packages/sandbox/sandbox-policy/lib/index.js'),
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

function sendJson(res, status, body) {
  res.writeHead(status, { 'content-type': 'application/json' })
  res.end(JSON.stringify(body))
}

const slug = (v) => String(v ?? 'untagged').replace(/[^A-Za-z0-9._-]/g, '_').slice(0, 80)
const agentLabel = (agent) => slug(agent?.id ?? agent?.session?.header?.id ?? agent?.scopeKey ?? 'unknown')

const assemblies = new Map()

export async function apply(ctx) {
  record({ leg: 'plugin-apply', pid: process.pid, mode: MODE, testUse: TESTUSE })

  if (typeof ctx.webServer?.register === 'function') {
    ctx.webServer.register({ kind: 'exact', path: '/__a5ptc/health', handler: (_q, res) => sendJson(res, 200, { ok: true, applied: true, pid: process.pid, mode: MODE }) }, 'a5ptc health')
    ctx.webServer.register({ kind: 'exact', path: '/__a5ptc/journal', handler: (_q, res) => sendJson(res, 200, { rows: JOURNAL }) }, 'a5ptc journal')
    ctx.webServer.register({ kind: 'exact', path: '/__a5ptc/state', handler: (_q, res) => {
      const out = {}
      for (const [label, a] of assemblies) out[label] = { kind: MODE, ...(MODE === 'ptc' ? ptcView(a) : lspView(a)) }
      sendJson(res, 200, { mode: MODE, assemblies: out })
    } }, 'a5ptc state')
    ctx.webServer.register({ kind: 'exact', path: '/__a5ptc/assemble', handler: async (req, res) => {
      let body = ''
      for await (const c of req) body += c
      let parsed; try { parsed = JSON.parse(body || '{}') } catch { parsed = {} }
      const sessionId = String(parsed?.sessionId ?? '')
      const agent = findAgent(sessionId)
      if (agent == null) { sendJson(res, 404, { ok: false, error: `no agent for session ${sessionId}` }); return }
      const label = agentLabel(agent)
      if (assemblies.has(label)) { sendJson(res, 200, { ok: true, already: true, label }); return }
      const asm = { label, agent, legs: [], guardRows: [], ok: false, error: null }
      assemblies.set(label, asm)
      void (MODE === 'ptc' ? assemblePtc(asm) : assembleLsp(asm))
        .then(() => record({ leg: 'assembly-complete', label }))
        .catch((error) => { asm.error = String(error?.stack ?? error).slice(0, 900); record({ leg: 'assembly-failed', label, error: asm.error }) })
      sendJson(res, 200, { ok: true, started: true, label })
    } }, 'a5ptc assemble')
    if (MODE === 'lsp') {
      ctx.webServer.register({ kind: 'exact', path: '/__a5ptc/defs', handler: (_q, res) => {
        const out = {}
        for (const [label, a] of assemblies) {
          try { out[label] = { hasDef: ctx.tools.get?.('lsp', a.agent) !== undefined, identity: String(ctx.tools.get?.('lsp', a.agent)?.name ?? '') } } catch (error) { out[label] = { error: String(error?.message ?? error) } }
        }
        const defs = []
        for (const [, a] of assemblies) { try { defs.push(ctx.tools.get?.('lsp', a.agent) ?? null) } catch { defs.push(null) } }
        const distinct = defs.length >= 2 && defs.every((d) => d != null) && new Set(defs).size === defs.length
        sendJson(res, 200, { perAgent: out, allDefined: defs.every((d) => d != null), distinctDefinitions: distinct })
      } }, 'a5ptc defs')
      ctx.webServer.register({ kind: 'exact', path: '/__a5ptc/hover', handler: async (req, res) => {
        let body = ''
        for await (const c of req) body += c
        let parsed; try { parsed = JSON.parse(body || '{}') } catch { parsed = {} }
        const asm = assemblies.get(String(parsed?.label ?? ''))
        if (asm == null || asm.lspService == null) { sendJson(res, 404, { ok: false, error: 'no realm for label' }); return }
        try {
          const result = await asm.lspService.query({
            operation: 'hover',
            filePath: String(parsed?.filePath ?? ''),
            workspaceRoot: WS,
            position: { line: Number(parsed?.line ?? 1), character: Number(parsed?.character ?? 1) },
          })
          const text = result?.contents ?? JSON.stringify(result)
          sendJson(res, 200, { ok: true, text })
        } catch (error) { sendJson(res, 200, { ok: false, error: String(error?.message ?? error) }) }
      } }, 'a5ptc hover')
      ctx.webServer.register({ kind: 'exact', path: '/__a5ptc/dispose', handler: async (req, res) => {
        let body = ''
        for await (const c of req) body += c
        let parsed; try { parsed = JSON.parse(body || '{}') } catch { parsed = {} }
        const asm = assemblies.get(String(parsed?.label ?? ''))
        if (asm == null) { sendJson(res, 404, { ok: false, error: 'no label' }); return }
        const t0 = Date.now()
        try {
          for (const f of [...asm.fibers].reverse()) await f.dispose()
          asm.disposed = true
          asm.disposeMs = Date.now() - t0
          record({ leg: 'realm-disposed', label: asm.label, disposeMs: asm.disposeMs })
          sendJson(res, 200, { ok: true, disposeMs: asm.disposeMs })
        } catch (error) { sendJson(res, 200, { ok: false, error: String(error?.stack ?? error).slice(0, 400) }) }
      } }, 'a5ptc dispose')
    }
  }

  function findAgent(sessionId) {
    try {
      const list = ctx.agents.list?.() ?? []
      for (const a of list) if (a?.id === sessionId || a?.session?.header?.id === sessionId) return a
      return null
    } catch { return null }
  }

  // ─────────────────────────────── PTC ───────────────────────────────
  function ptcView(a) {
    return { ok: a.ok, error: a.error, runtimeCensus: a.runtimeCensus ?? null, guardRows: a.guardRows, throwCensus: a.throwCensus ?? null, runResult: a.runResult ?? null, outerChildren: a.outerChildren ?? [], disposers: a.disposers?.length ?? 0 }
  }

  async function assemblePtc(asm) {
    const { agent, legs } = asm
    const coreTools = await import(URLS.tools)
    const { defineTool } = coreTools
    legs.push({ leg: 'core-tools-barrel', ok: typeof defineTool === 'function' })
    const acx = agent.ctx
    if (acx?.tools?.register == null) throw new Error('agent.ctx.tools unavailable')

    // census of the host-provided PTC runtime (the row assembles NO runtime of its own)
    const runtime = ctx.get?.('ptcRuntime') ?? undefined
    asm.runtimeCensus = {
      hasPtcRuntime: runtime !== undefined,
      language: runtime?.language,
      sandboxMode: runtime?.sandboxMode,
      toolsDefaultMode: (() => { try { return ctx.tools.modeFor?.(undefined) } catch { return undefined } })(),
    }
    legs.push({ leg: 'ptc-runtime-census', ok: runtime !== undefined, census: asm.runtimeCensus })

    // Test-world policy caliber: the host's own typed error prescribes this exact
    // public switch ("otherwise switch the consumer to danger-full-access") when no
    // OS sandbox backend is usable in the test environment. This leg asserts the
    // PIPELINE (outer real process + inner re-entry), NOT OS enforcement (that is
    // M-08 A2 = the W4 kit's Landlock plane, booked there, not here).
    if (runtime !== undefined && runtime.sandboxMode !== 'danger-full-access' && agent.session !== undefined) {
      const { setSandboxMode } = await import(URLS.sandboxPolicy)
      setSandboxMode(agent.session, 'danger-full-access')
      legs.push({ leg: 'sandbox-mode-override', mode: 'danger-full-access', from: runtime.sandboxMode, note: 'public setSandboxMode write path; OS-enforcement caliber NOT asserted by this leg' })
    }

    const echoDef = defineTool({
      name: 'a5ptc_echo',
      description: 'Witness tool: echo the tag (inner-call canary of the PTC pipeline).',
      parameters: { tag: { type: 'string', required: true, description: 'tag to echo back' } },
      output: { schema: { type: 'string' }, render: (_a, v) => [{ type: 'text', text: String(v) }] },
      execute: async (args) => `A5PTC-ECHO:${args.tag}`,
    })
    const probeDef = defineTool({
      name: 'a5ptc_denied_probe',
      description: 'Witness tool: must be denied by the Team guard (typed-reject canary).',
      parameters: { tag: { type: 'string', required: true, description: 'tag' } },
      output: { schema: { type: 'string' }, render: (_a, v) => [{ type: 'text', text: String(v) }] },
      execute: async (args) => `A5PTC-PROBE-BODY-RAN:${args.tag}`,
    })

    const disposers = []
    disposers.push(acx.tools.register(echoDef))
    disposers.push(acx.tools.register(probeDef))
    legs.push({ leg: 'scoped-witness-tools-registered', ok: true })

    let seq = 0
    disposers.push(acx.tools.guard((exec) => {
      seq += 1
      asm.guardRows.push({
        seq,
        name: String(exec?.name),
        callId: String(exec?.callId ?? ''),
        rootCallId: String(exec?.rootCallId ?? ''),
        inner: exec?.parent !== undefined,
        agent: String(exec?.agent?.id ?? exec?.agent ?? ''),
      })
      if (exec?.name === 'a5ptc_denied_probe') return `${RUN}-GUARD-DENY reserved inner probe denied by the team guard (assembly-face leg)`
      return undefined
    }))
    legs.push({ leg: 'team-guard-installed', ok: true })

    disposers.push(acx.tools.presentAs('ptc'))
    legs.push({ leg: 'presentAs-ptc', ok: true })
    asm.disposers = disposers

    // public around-seam listener (PoC6a face): capture the OUTER run_code result
    // from the live dispatch, independent of how the client transport renders it;
    // and while the outer run is in flight, sample /proc for the runtime's OS child
    // (outer_real_process = a real separate node process running the PTC bootstrap).
    asm.outerChildren = []
    acx.on?.('tools/execute', (exec, next) => {
      const out = next()
      if (exec?.name === 'run_code' && exec?.parent === undefined) {
        const sampler = setInterval(() => {
          for (const d of readdirSync('/proc')) {
            if (!/^\d+$/.test(d)) continue
            try {
              const stat = readFileSync(`/proc/${d}/stat`, 'utf8')
              const rest = stat.slice(stat.lastIndexOf(')') + 2).split(' ')
              const ppid = Number(rest[1])
              const cmd = readFileSync(`/proc/${d}/cmdline`, 'utf8').split('\0').filter(Boolean).join(' ')
              if (!/node/.test(cmd)) continue
              if (ppid !== process.pid && !/ptc-runtime-node/.test(cmd)) continue
              if (!asm.outerChildren.some((c) => String(c.pid) === d)) asm.outerChildren.push({ pid: Number(d), ppid, cmd: cmd.slice(0, 300) })
            } catch { /* raced away */ }
          }
        }, 50)
        Promise.resolve(out).then((res) => {
          setTimeout(() => clearInterval(sampler), 150)
          asm.runResult = { isError: res?.isError === true, text: (res?.content ?? []).map((c) => c?.text ?? '').join('\n').slice(0, 4000) }
        }).catch((error) => {
          clearInterval(sampler)
          asm.runResult = { error: String(error?.message ?? error).slice(0, 400) }
        })
      }
      return out
    })
    legs.push({ leg: 'around-listener-installed', ok: typeof acx.on === 'function' })

    // reserved-transport throw census: both registration sides + both restrict sides
    const throwCensus = {}
    const tryThrow = (key, fn) => {
      try { fn(); throwCensus[key] = { threw: false } } catch (error) {
        const msg = String(error?.message ?? error)
        throwCensus[key] = { threw: true, reservedName: msg.includes('run_code'), msg: msg.slice(0, 200) }
      }
    }
    tryThrow('root_register', () => ctx.tools.register(defineTool({
      name: 'run_code', description: 'collision attempt',
      parameters: { x: { type: 'string', required: true, description: 'x' } },
      output: { schema: { type: 'string' }, render: (_a, v) => String(v) },
      execute: async () => 'never',
    })))
    tryThrow('scope_register', () => acx.tools.register(defineTool({
      name: 'run_code', description: 'collision attempt (agent scope)',
      parameters: { x: { type: 'string', required: true, description: 'x' } },
      output: { schema: { type: 'string' }, render: (_a, v) => String(v) },
      execute: async () => 'never',
    })))
    tryThrow('scope_restrict_deny', () => acx.tools.restrict({ deny: ['run_code'] }))
    tryThrow('scope_restrict_allow', () => acx.tools.restrict({ allow: ['run_code'] }))
    asm.throwCensus = throwCensus
    legs.push({ leg: 'reserved-transport-throw-census', census: throwCensus })

    asm.ok = true
  }

  // ─────────────────────────────── LSP ───────────────────────────────
  function lspView(a) {
    return {
      ok: a.ok, error: a.error, disposed: a.disposed === true,
      lspIdentity: a.lspIdentity ?? null, defs: a.defs ?? null, mountOk: a.mountOk ?? false,
      modelRouteResults: a.modelRouteResults ?? [],
    }
  }

  async function assembleLsp(asm) {
    const { agent, legs } = asm
    const { default: Lsp } = await import(URLS.lsp)
    const lspStdio = await import(URLS.lspStdio)
    const toolLsp = await import(URLS.toolLsp)
    const rootLsp = ctx.get?.('lsp') ?? undefined
    const realm = agent.ctx.isolate('lsp')
    asm.realm = realm
    asm.lspIdentity = {
      rootLspMounted: rootLsp !== undefined,
      rootLspNote: 'realm Lsp identity verified through the capture-plugin face (capability gate)',
    }
    const fibers = []
    fibers.push(realm.plugin(Lsp))
    fibers.push(realm.plugin(lspStdio, {
      servers: {
        'a5ptc-fake-lang': {
          command: process.execPath,
          args: [SERVER],
          env: {},
          extensionToLanguage: { '.a5ptc': 'a5ptcfake' },
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
    fibers.push(realm.plugin(toolLsp))
    for (const f of fibers) await f
    asm.fibers = fibers
    // capture REAL model-route ('lsp' tool) results on the public around-seam face
    asm.modelRouteResults = []
    agent.ctx.on?.('tools/execute', (exec, next) => {
      const out = next()
      if (exec?.name === 'lsp') {
        Promise.resolve(out).then((res) => {
          asm.modelRouteResults.push({ at: new Date().toISOString(), isError: res?.isError === true, text: (res?.content ?? []).map((c) => c?.text ?? '').join('\n').slice(0, 1500) })
        }).catch((error) => asm.modelRouteResults.push({ error: String(error?.message ?? error).slice(0, 300) }))
      }
      return out
    })
    // capture the realm's Lsp service through a plugin's own inject face
    // (capability-gated property access from the row ctx is not granted)
    const cap = realm.plugin({
      inject: ['lsp'],
      apply: (inner) => { asm.lspService = inner.lsp },
    })
    fibers.push(cap)
    await cap
    asm.mountOk = true
    legs.push({ leg: 'realm-remount', ok: true, identity: asm.lspIdentity })

    asm.defs = {}
    try { asm.selfDef = ctx.tools.get?.('lsp', agent) ?? null } catch { asm.selfDef = null }
    asm.ok = true
  }
}
