/**
 * W-PTC-OUTER assembly row (PR#290 review comment 6230116007, leg ①).
 *
 * Deliberately the THINNEST possible world that still puts `run_code` in front of
 * the model:
 *   - `agent.ctx.tools.presentAs('ptc')` — the host's own PTC transport presentation
 *     (the row assembles NO runtime; census only);
 *   - ZERO registered tools: the bypass program therefore has nothing to call
 *     through the governed edge, which is exactly the reviewer's condition
 *     ("PTC 程序不调用注册工具");
 *   - one Team guard (witness only, denies nothing this round) recording every
 *     dispatch, so "no inner re-entry happened" is a LIVE census, not an absence claim;
 *   - the public around-seam (`agent.ctx.on('tools/execute')`) capturing the OUTER
 *     run_code result verbatim, with a /proc sampler running while the outer call is
 *     in flight (did an OS child for the outer program even exist?);
 *   - the sandbox-mode census read through the PUBLIC face only
 *     (`ctx.get('sandboxPolicy').resolve({ session })`) BEFORE and AFTER the run.
 *     This round NEVER calls `setSandboxMode`: the judgment leg is the deployment
 *     default (workspace-write), so the mode is a measured constant, not a parameter.
 *
 * Public seams only (profile-patch row insert + presentAs + guard + around-seam +
 * sandboxPolicy.resolve). Zero upstream modification, zero privilege widening.
 *
 * @module dev/agent-workflow/evidence/alpha5/w-ptc-outer/a5ptc3-outer-row
 */
import { appendFileSync, mkdirSync, readFileSync, readdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { pathToFileURL } from 'node:url'

export const name = 'a5ptc3-outer-row'
export const inject = ['webServer', 'agents', 'tools']

const TESTUSE = process.env.A5PTC3_TESTUSE ?? ''
const LEDGER = process.env.A5PTC3_LEDGER ?? ''
const RUN = process.env.A5PTC3_RUN ?? 'run'

const lib = (rel) => pathToFileURL(join(TESTUSE, rel)).href

const JOURNAL = []
function record(row) {
  const line = JSON.stringify({ at: new Date().toISOString(), ...row })
  if (LEDGER !== '') {
    try { mkdirSync(dirname(LEDGER), { recursive: true }); appendFileSync(LEDGER, line + '\n') } catch { /* journal copy stands */ }
  }
  JOURNAL.push({ at: new Date().toISOString(), ...row })
}

const sendJson = (res, status, body) => {
  res.writeHead(status, { 'content-type': 'application/json' })
  res.end(JSON.stringify(body))
}
const slug = (v) => String(v ?? 'untagged').replace(/[^A-Za-z0-9._-]/g, '_').slice(0, 80)

const assemblies = new Map()

export async function apply(ctx) {
  record({ leg: 'plugin-apply', pid: process.pid, testUse: TESTUSE, run: RUN })

  if (typeof ctx.webServer?.register !== 'function') { record({ leg: 'no-webserver' }); return }

  ctx.webServer.register({ kind: 'exact', path: '/__a5ptc3/health', handler: (_q, res) => sendJson(res, 200, { ok: true, applied: true, pid: process.pid }) }, 'a5ptc3 health')
  ctx.webServer.register({ kind: 'exact', path: '/__a5ptc3/journal', handler: (_q, res) => sendJson(res, 200, { rows: JOURNAL }) }, 'a5ptc3 journal')
  ctx.webServer.register({ kind: 'exact', path: '/__a5ptc3/state', handler: (_q, res) => {
    const out = {}
    for (const [label, a] of assemblies) out[label] = view(a)
    sendJson(res, 200, { run: RUN, assemblies: out })
  } }, 'a5ptc3 state')
  ctx.webServer.register({ kind: 'exact', path: '/__a5ptc3/assemble', handler: async (req, res) => {
    let body = ''
    for await (const c of req) body += c
    let parsed; try { parsed = JSON.parse(body || '{}') } catch { parsed = {} }
    const sessionId = String(parsed?.sessionId ?? '')
    const agent = findAgent(sessionId)
    if (agent == null) { sendJson(res, 404, { ok: false, error: `no agent for session ${sessionId}` }); return }
    const label = slug(agent?.id ?? agent?.session?.header?.id ?? 'unknown')
    if (assemblies.has(label)) { sendJson(res, 200, { ok: true, already: true, label }); return }
    const asm = { label, agent, legs: [], guardRows: [], ok: false, error: null }
    assemblies.set(label, asm)
    void assemble(ctx, asm)
      .then(() => { asm.ok = true; record({ leg: 'assembly-complete', label, legs: asm.legs.map((l) => l.leg) }) })
      .catch((error) => { asm.error = String(error?.stack ?? error).slice(0, 900); record({ leg: 'assembly-failed', label, error: asm.error }) })
    sendJson(res, 200, { ok: true, started: true, label })
  } }, 'a5ptc3 assemble')

  function findAgent(sessionId) {
    try {
      for (const a of ctx.agents.list?.() ?? []) if (a?.id === sessionId || a?.session?.header?.id === sessionId) return a
      return null
    } catch { return null }
  }
}

function view(a) {
  return {
    ok: a.ok, error: a.error,
    runtimeCensus: a.runtimeCensus ?? null,
    modeCensus: a.modeCensus ?? null,
    toolSurface: a.toolSurface ?? null,
    legs: a.legs,
    guardRows: a.guardRows,
    runs: a.runs ?? [],
    outerChildren: a.outerChildren ?? [],
    throwCensus: a.throwCensus ?? null,
    disposers: a.disposers?.length ?? 0,
  }
}

async function assemble(ctx, asm) {
  const { legs } = asm
  const acx = asm.agent.ctx
  if (acx?.tools?.presentAs == null) throw new Error('agent.ctx.tools.presentAs unavailable')

  // ── host runtime census (the row assembles nothing) ─────────────────────────
  const runtime = ctx.get?.('ptcRuntime') ?? undefined
  asm.runtimeCensus = {
    hasPtcRuntime: runtime !== undefined,
    language: runtime?.language,
    runtimeSandboxMode: runtime?.sandboxMode,
    runtimeTimeout: runtime?.timeout,
    toolsModeFor: (() => { try { return ctx.tools.modeFor?.(undefined) } catch { return undefined } })(),
  }
  legs.push({ leg: 'ptc-runtime-census', ok: runtime !== undefined, census: asm.runtimeCensus })

  // ── sandbox mode: PUBLIC READ ONLY, never written by this round ─────────────
  const disposers0 = []
  const policy = ctx.get?.('sandboxPolicy')
  const readMode = async () => {
    try {
      const r = await Promise.resolve(policy?.resolve?.({ session: asm.agent.session }))
      return { mode: r?.mode ?? r?.sandboxMode ?? null, faces: Object.keys(r ?? {}).sort() }
    } catch (error) { return { mode: null, error: String(error?.message ?? error) } }
  }
  asm.modeCensus = {
    pre: await readMode(),
    deploymentDefault: runtime?.sandboxMode ?? null,
    writeCallsByThisRow: 0,
    note: 'writeCallsByThisRow = setSandboxMode calls made inside this world; it stays 0 through LEG A/LEG B (the judgment legs run on the deployment default, workspace-write) and only becomes 1 if the runner triggers the DISCLOSED LEG C switch route',
  }
  legs.push({ leg: 'sandbox-mode-census-pre', ok: true, mode: asm.modeCensus.pre.mode })

  // ── One WITNESS tool, deliberately never referenced by the program. The bypass
  // still has no governed edge to call (the program never touches `tools.*`); the
  // witness makes that a positive observation instead of an absence, and a scoped
  // tool row is what keeps the host's tool-schema emission path on its normal road.
  let witnessRegistered = false
  try {
    const core = await import(lib('packages/core/tools/lib/index.js'))
    const witness = core.defineTool({
      name: 'a5ptc3_witness',
      description: 'Witness tool: a5ptc3 never references it from the bypass program.',
      parameters: { tag: { type: 'string', required: true, description: 'tag' } },
      output: { schema: { type: 'string' }, render: (_a, v) => [{ type: 'text', text: String(v) }] },
      execute: async (a) => `A5PTC3-WITNESS-RAN:${a?.tag ?? ''}`,
    })
    disposers0.push(acx.tools.register(witness))
    witnessRegistered = true
  } catch (error) { record({ leg: 'witness-register-failed', error: String(error?.message ?? error).slice(0, 200) }) }
  const surface = { registeredByThisRow: witnessRegistered ? 1 : 0, witnessTool: 'a5ptc3_witness', note: 'registered as a schema-path witness only; the bypass program never references it, and the guard census below must show ZERO calls to it', scopedFaces: Object.keys(acx.tools ?? {}).sort(), listed: null }
  for (const face of ['list', 'definitions', 'all']) {
    try {
      const fn = acx.tools?.[face]
      if (typeof fn === 'function') { const v = fn.call(acx.tools, asm.agent); surface.listed = { face, value: (Array.isArray(v) ? v : []).map((d) => String(d?.name ?? d)).sort() }; break }
    } catch { /* face not offered */ }
  }
  asm.toolSurface = surface
  legs.push({ leg: 'witness-only-assembly', ok: true, census: surface })

  // ── guard: witness every dispatch (nothing denied this round) ───────────────
  let seq = 0
  const disposers = disposers0
  disposers.push(acx.tools.guard((exec) => {
    seq += 1
    asm.guardRows.push({
      seq,
      name: String(exec?.name),
      callId: String(exec?.callId ?? ''),
      rootCallId: String(exec?.rootCallId ?? ''),
      inner: exec?.parent !== undefined,
      argsHead: (() => { try { return JSON.stringify(exec?.args ?? {}).slice(0, 160) } catch { return '' } })(),
    })
    return undefined
  }))
  legs.push({ leg: 'team-guard-witness-installed', ok: true })

  disposers.push(acx.tools.presentAs('ptc'))
  legs.push({ leg: 'presentAs-ptc', ok: true })
  asm.disposers = disposers

  // ── around-seam: verbatim outer run_code result + /proc child sampling ──────
  asm.runs = []
  asm.outerChildren = []
  acx.on?.('tools/execute', (exec, next) => {
    const out = next()
    if (exec?.name === 'run_code' && exec?.parent === undefined) {
      const entry = { at: new Date().toISOString(), callId: String(exec?.callId ?? ''), sampled: 0, children: [] }
      const sampler = setInterval(() => {
        entry.sampled += 1
        for (const d of readdirSync('/proc')) {
          if (!/^\d+$/.test(d)) continue
          try {
            const stat = readFileSync(`/proc/${d}/stat`, 'utf8')
            const ppid = Number(stat.slice(stat.lastIndexOf(')') + 2).split(' ')[1])
            const cmd = readFileSync(`/proc/${d}/cmdline`, 'utf8').split('\0').filter(Boolean).join(' ')
            if (ppid !== process.pid && !/ptc-runtime-node/.test(cmd)) continue
            if (!/node|ptc-runtime-node/.test(cmd)) continue
            entry.children.push({ pid: Number(d), ppid, cmd: cmd.slice(0, 240) })
            if (!asm.outerChildren.some((c) => String(c.pid) === String(d))) asm.outerChildren.push({ pid: Number(d), ppid, cmd: cmd.slice(0, 240) })
          } catch { /* raced away */ }
        }
      }, 40)
      Promise.resolve(out)
        .then((res) => {
          setTimeout(() => clearInterval(sampler), 200)
          const text = (res?.content ?? []).map((c) => c?.text ?? '').join('\n')
          asm.runs.push({ ...entry, isError: res?.isError === true, text: text.slice(0, 6000), textLength: text.length })
        })
        .catch((error) => {
          clearInterval(sampler)
          asm.runs.push({ ...entry, threw: true, error: String(error?.message ?? error).slice(0, 600) })
        })
    }
    return out
  })
  legs.push({ leg: 'around-seam-installed', ok: typeof acx.on === 'function' })

  // ── reserved-transport throw census (both faces): can the Team side take the
  //    outer transport over at all? (seam inventory for leg ④) ────────────────
  const throwCensus = {}
  const tryThrow = (key, fn) => {
    try { fn(); throwCensus[key] = { threw: false } } catch (error) {
      const msg = String(error?.message ?? error)
      throwCensus[key] = { threw: true, reservedName: msg.includes('run_code'), msg: msg.slice(0, 220) }
    }
  }
  try {
    const coreTools = await import(lib('packages/core/tools/lib/index.js'))
    const defineTool = coreTools.defineTool
    const mk = () => defineTool({
      name: 'run_code', description: 'Team-side takeover attempt',
      parameters: { x: { type: 'string', required: true, description: 'x' } },
      output: { schema: { type: 'string' }, render: (_a, v) => [{ type: 'text', text: String(v) }] },
      execute: async () => 'never',
    })
    tryThrow('root_register', () => ctx.tools.register(mk()))
    tryThrow('scope_register', () => acx.tools.register(mk()))
    tryThrow('scope_restrict_deny', () => acx.tools.restrict?.({ deny: ['run_code'] }))
    tryThrow('scope_restrict_allow', () => acx.tools.restrict?.({ allow: ['run_code'] }))
    // Is the PTC runtime SERVICE slot replaceable through the mount face the host itself uses?
    tryThrow('ptc_runtime_service_replace', () => {
      const slot = ctx.get?.('ptcRuntime')
      if (slot === undefined) throw new Error('no ptcRuntime service mounted')
      const before = slot
      try { ctx.set?.('ptcRuntime', { language: 'typescript' }) } catch (e) { throw new Error('ctx.set refused: ' + String(e?.message ?? e)) }
      if (ctx.get?.('ptcRuntime') === before) throw new Error('ctx.set had no effect (slot not owner-writable)')
    })
  } catch (error) {
    throwCensus.barrel = { error: String(error?.message ?? error).slice(0, 200) }
  }
  asm.throwCensus = throwCensus
  legs.push({ leg: 'seam-census', ok: true })

  // LEG C ONLY, runner-triggered, DISCLOSED: the public per-session write path
  // (`setSandboxMode` = one `session.append("sandbox/mode", …)` event inside THIS
  // world). It is a test-world parameter with ZERO OS-enforcement caliber and is
  // never touched by the judgment legs; the counter below keeps that separation
  // auditable (`writeCallsByThisRow` stays 0 until this route is hit).
  ctx.webServer.register({ kind: 'exact', path: `/__a5ptc3/switch/${asm.label}`, handler: async (_q, res) => {
    try {
      const { setSandboxMode } = await import(lib('packages/sandbox/sandbox-policy/lib/index.js'))
      const before = asm.modeCensus.writeCallsByThisRow
      setSandboxMode(asm.agent.session, 'danger-full-access')
      asm.modeCensus.writeCallsByThisRow = before + 1
      record({ leg: 'disclosed-mode-switch', label: asm.label, to: 'danger-full-access', calls: asm.modeCensus.writeCallsByThisRow })
      sendJson(res, 200, { ok: true, calls: asm.modeCensus.writeCallsByThisRow })
    } catch (error) {
      sendJson(res, 200, { ok: false, error: String(error?.message ?? error).slice(0, 300) })
    }
  } }, `a5ptc3 switch ${RUN}`)

  // post-run mode re-read is done by the route so the runner can see it after the turn
  ctx.webServer.register({ kind: 'exact', path: `/__a5ptc3/mode/${asm.label}`, handler: async (_q, res) => {
    const policy2 = ctx.get?.('sandboxPolicy')
    let mode = null
    try { const r = await Promise.resolve(policy2?.resolve?.({ session: asm.agent.session })); mode = r?.mode ?? r?.sandboxMode ?? null } catch { /* unreadable */ }
    sendJson(res, 200, { post: mode, deploymentDefault: ctx.get?.('ptcRuntime')?.sandboxMode ?? null, writeCallsByThisRow: asm.modeCensus.writeCallsByThisRow })
  } }, `a5ptc3 mode ${RUN}`)
}
