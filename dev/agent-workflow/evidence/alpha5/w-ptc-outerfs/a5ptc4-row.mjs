/**
 * a5ptc4-row.mjs — W-PTC-OUTERFS assembly row: per-call governance of the PTC
 * OUTER program's direct fs effects, assembled into the real structure through
 * PUBLIC seams only, driven end-to-end on the pinned host (M-08 fs half).
 *
 * What this row assembles (all public faces; zero Core change):
 *
 *  1. OS backend deployment (assembly-side, deployment-owned choice):
 *     `ctx.sandbox.internals.landlockLauncher = <launcher>` — the public,
 *     documented test-hook property on LocalSandboxProvider ("Test hook
 *     (mirrors the bash executors' internals)"), written BEFORE the first
 *     confine() so the host's OWN chain walk (bwrap → landlock functional
 *     probe) probes/executes the Landlock launcher at this path. Everything
 *     downstream — probe, grant compilation (landlockProfileArgs), runner
 *     argv, enforcement reporting — is the host's own code, per call.
 *
 *  2. Team resolver as the approval answerer (the draft's primary variant =
 *     host-native per-callId escalation chain):
 *     `ctx.on('approval/request', (request, next) => …)` — the same waterfall
 *     seam the host's ACP package and remote bridge use (verified shapes:
 *     packages/acp/acp/lib/index.js:1116; packages/api/remotes/lib/index.js:147).
 *     The run_code escalation path is host-native:
 *       run_code args {sandbox_permissions, justification}
 *         → approveEscalation({approver: ctx.get('approval'), callId: exec.callId})
 *         → ApprovalService.request → ctx.waterfall(..., 'approval/request', req)
 *     The resolver consults a per-call GRANT LEDGER (the Team Grant face inside
 *     this test world; production = Team ask-lane leader/human resolvers), keyed
 *     by the per-call token carried in the request's own reason, and returns a
 *     closed EscalationOutcome ('allowed-once' | 'rejected') or passes through
 *     (no-answer → the host's fail-closed fallback). EVERY ask is audited with
 *     its callId. This row NEVER calls setSandboxMode / setApprovalPolicy.
 *
 *  3. Per-agent witnesses (same faces as w-ptc-re): presentAs('ptc'), scoped
 *     echo tool, guard journal (outer + inner, callId/rootCallId), around-seam
 *     capture of the OUTER run_code result, /proc sampling of the outer OS
 *     child while the outer run is in flight.
 *
 * Env: A5PTC4_ASSEMBLE ('1' = deploy 1+2; '0' = RED posture: witnesses only),
 *      A5PTC4_TESTUSE (pinned host tree root), A5PTC4_LEDGER, A5PTC4_LAUNCHER,
 *      A5PTC4_RUN.
 *
 * @module dev/agent-workflow/evidence/alpha5/w-ptc-outerfs/a5ptc4-row
 */
import { appendFileSync, mkdirSync, readdirSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { pathToFileURL } from 'node:url'

export const name = 'a5ptc4-outerfs'
export const inject = ['webServer', 'agents', 'sandbox', 'sandboxPolicy']

const ASSEMBLE = (process.env.A5PTC4_ASSEMBLE ?? '0') === '1'
const TESTUSE = process.env.A5PTC4_TESTUSE ?? ''
const LEDGER = process.env.A5PTC4_LEDGER ?? ''
const LAUNCHER = process.env.A5PTC4_LAUNCHER ?? ''
const RUN = process.env.A5PTC4_RUN ?? 'run'

const URLS = {
  tools: pathToFileURL(join(TESTUSE, 'packages/core/tools/lib/index.js')).href,
  scope: pathToFileURL(join(TESTUSE, 'packages/core/scope/lib/index.js')).href,
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
async function readBody(req) {
  let body = ''
  for await (const c of req) body += c
  try { return JSON.parse(body || '{}') } catch { return {} }
}
const slug = (v) => String(v ?? 'untagged').replace(/[^A-Za-z0-9._-]/g, '_').slice(0, 80)
const agentLabel = (agent) => slug(agent?.id ?? agent?.session?.header?.id ?? agent?.scopeKey ?? 'unknown')

// Team Grant face (test-world shape of the ask-lane resolver input): per-call
// decisions fed by the runner BEFORE the escalation call; keyed by the token the
// model carries inside its own `justification` (i.e. per-call data the resolver
// reads at ask time — never a global mode).
const GRANTS = new Map()
// Audit of every approval ask this resolver saw: {seq, callId, toolName, agent,
// token, decision, outcome, at}. This is the per-callId ledger the M-08 note asks for.
const APPROVALS = []
let approvalSeq = 0

const assemblies = new Map()

export async function apply(ctx) {
  record({ leg: 'plugin-apply', pid: process.pid, assemble: ASSEMBLE, launcher: LAUNCHER, testUse: TESTUSE })

  // ── 1. OS backend deployment (GREEN only) ────────────────────────────────
  const provider = ctx.get?.('sandbox') ?? undefined
  const deploy = { attempted: ASSEMBLE, ok: false, note: '' }
  if (ASSEMBLE) {
    if (provider === undefined) {
      deploy.note = 'sandbox service not resolvable'
    } else if (typeof provider.internals !== 'object' || provider.internals === null) {
      deploy.note = 'public internals property absent'
    } else {
      // BEFORE any confine() — the chain verdict is cached on first use.
      provider.internals.landlockLauncher = LAUNCHER
      deploy.ok = provider.internals.landlockLauncher === LAUNCHER
      deploy.note = 'public `internals.landlockLauncher` test-hook property set on the host provider instance'
    }
  }
  record({ leg: 'launcher-deploy', ...deploy, selectedRunnerAtApply: provider?.selectedRunner ?? null })

  // ── 2. Team resolver on the approval waterfall (GREEN only) ──────────────
  // Registered at three public faces for cascade reach, with per-token
  // idempotence so whichever face the host waterfall dispatches to decides
  // exactly once: the plugin ctx (ACP's registration shape), the same listener
  // with the documented `global: true` ctx.on option (dispatch skips the scope
  // filter for global hooks), and per-agent `agent.ctx`. EVERY ask that reaches
  // any face is journaled (pass-throughs included) — a ledger of zero means the
  // ask never reached these public faces, which is itself the finding.
  const ANSWERED = new Map()
  function resolverHandler(source) {
    return (request, next) => {
      const reason = String(request?.reason ?? '')
      const m = /A5PTC4-TOKEN:([A-Za-z0-9_-]+)/.exec(reason)
      const token = m?.[1] ?? ''
      const entry = {
        seq: (approvalSeq += 1),
        at: new Date().toISOString(),
        face: source,
        callId: String(request?.callId ?? ''),
        toolName: String(request?.toolName ?? ''),
        agent: agentLabel(request?.agent),
        token,
        reasonHead: reason.slice(0, 200),
      }
      if (token === '') {
        // not ours: pass through untouched (other answerers / fallback decide)
        record({ leg: 'approval-ask', ...entry, decision: 'foreign', outcome: 'pass-through' })
        return next()
      }
      if (ANSWERED.has(token)) {
        record({ leg: 'approval-ask', ...entry, decision: 'duplicate', outcome: ANSWERED.get(token) })
        return ANSWERED.get(token)
      }
      const decision = GRANTS.get(token) ?? 'unknown'
      let outcome
      if (decision === 'reject') outcome = 'rejected'
      else if (decision === 'allow') outcome = 'allowed-once'
      else if (decision === 'no-answer') {
        // Resolver-not-answering posture, expressed through the host's own
        // documented normalization: "a missing or throwing answerer yields
        // 'unavailable' (fail closed)" (ApprovalService.request doc). Passing
        // through via next() instead would reach the still-pending inner
        // bridge listener and hold the ask (chain behavior recorded as a seam
        // fact in the README); throwing reaches the closed fail-closed
        // vocabulary ('no approval channel is available').
        APPROVALS.push({ ...entry, decision, outcome: 'unavailable(throw)' })
        record({ leg: 'approval-ask', ...entry, decision, outcome: 'unavailable(throw)' })
        throw new Error('a5ptc4 resolver: no answer for this ask (no-answer posture)')
      } else outcome = 'pass-through' // unknown token → untouched host path
      if (outcome !== 'pass-through') ANSWERED.set(token, outcome)
      APPROVALS.push({ ...entry, decision, outcome })
      record({ leg: 'approval-ask', ...entry, decision, outcome })
      if (outcome === 'pass-through') return next()
      return outcome
    }
  }
  if (ASSEMBLE) {
    const bootHooks = (ctx.events?._hooks?.['approval/request'] ?? []).map((h) => ({ global: h.global === true, prepend: h.prepend === true }))
    record({ leg: 'approval-hooks-at-apply', count: bootHooks.length, shape: bootHooks })
    ctx.on('approval/request', resolverHandler('plugin-ctx'))
    // Outermost + global: documented listener options (cordis ctx.on options —
    // `prepend` places the hook first; waterfall runs outermost-first and a
    // listener that returns without calling next() vetoes the rest of the
    // chain). Assembly ordering: in this world the Team resolver IS the
    // designated answerer; the ordering decision belongs to the assembly.
    ctx.on('approval/request', resolverHandler('plugin-ctx-global-outer'), { global: true, prepend: true })
    record({ leg: 'resolver-installed', ok: true, faces: ['plugin-ctx', 'plugin-ctx-global-outer'] })
  }

  // ── control / census routes ──────────────────────────────────────────────
  if (typeof ctx.webServer?.register === 'function') {
    ctx.webServer.register({ kind: 'exact', path: '/__a5ptc4/health', handler: (_q, res) =>
      sendJson(res, 200, { ok: true, applied: true, pid: process.pid, assemble: ASSEMBLE }) }, 'a5ptc4 health')

    ctx.webServer.register({ kind: 'exact', path: '/__a5ptc4/journal', handler: (_q, res) =>
      sendJson(res, 200, { rows: JOURNAL }) }, 'a5ptc4 journal')

    ctx.webServer.register({ kind: 'exact', path: '/__a5ptc4/state', handler: (_q, res) => {
      const out = {}
      for (const [label, a] of assemblies) out[label] = view(a)
      sendJson(res, 200, { assemble: ASSEMBLE, assemblies: out })
    } }, 'a5ptc4 state')

    ctx.webServer.register({ kind: 'exact', path: '/__a5ptc4/sandbox', handler: (_q, res) => {
      const p = ctx.get?.('sandbox')
      sendJson(res, 200, {
        selectedRunner: p?.selectedRunner?.runner ?? null,
        enforcement: p?.selectedRunner?.enforcement ?? null,
        landlockLauncher: p?.internals?.landlockLauncher ?? null,
        deploy,
      })
    } }, 'a5ptc4 sandbox census')

    ctx.webServer.register({ kind: 'exact', path: '/__a5ptc4/approvals', handler: (_q, res) =>
      sendJson(res, 200, { rows: APPROVALS }) }, 'a5ptc4 approvals ledger')

    // diagnostics: the LIVE listener chain for 'approval/request' (who is
    // registered ahead of us, global flag, scope tag), via the ctx.events bus.
    ctx.webServer.register({ kind: 'exact', path: '/__a5ptc4/hooks', handler: async (_q, res) => {
      let scope = null
      try { scope = await import(URLS.scope) } catch { /* diag */ }
      const hooks = ctx.events?._hooks?.['approval/request'] ?? []
      const rows = hooks.map((h, i) => {
        let tag = null
        try {
          const t = scope?.scopeOf?.(h.ctx)
          tag = t == null ? null : String(t?.id ?? t?.session?.header?.id ?? t)
        } catch { /* diag */ }
        return {
          idx: i,
          global: h.global === true,
          tag: tag === null ? null : String(tag).slice(0, 60),
          fnHead: String(h.callback?.toString?.() ?? '').replace(/\s+/g, ' ').slice(0, 130),
        }
      })
      sendJson(res, 200, { count: rows.length, rows })
    } }, 'a5ptc4 hook chain census')

    ctx.webServer.register({ kind: 'exact', path: '/__a5ptc4/grant', handler: async (req, res) => {
      const p = await readBody(req)
      GRANTS.set(String(p.token), String(p.decision))
      record({ leg: 'grant-fed', token: String(p.token), decision: String(p.decision) })
      sendJson(res, 200, { ok: true })
    } }, 'a5ptc4 grant feed')

    ctx.webServer.register({ kind: 'exact', path: '/__a5ptc4/mode', handler: async (req, res) => {
      const p = await readBody(req)
      const agent = findAgent(String(p.sessionId ?? ''))
      const policy = ctx.get?.('sandboxPolicy')
      let mode = null
      try {
        const r = await Promise.resolve(policy?.resolve?.({ session: agent?.session }))
        mode = r?.mode ?? null
      } catch { /* census */ }
      sendJson(res, 200, { mode, approvalPolicy: ctx.get?.('approval')?.overrideOf?.(agent?.session) ?? null })
    } }, 'a5ptc4 mode census')

    ctx.webServer.register({ kind: 'exact', path: '/__a5ptc4/assemble', handler: async (req, res) => {
      const p = await readBody(req)
      const agent = findAgent(String(p.sessionId ?? ''))
      if (agent == null) { sendJson(res, 404, { ok: false, error: 'no agent for session' }); return }
      const label = agentLabel(agent)
      if (assemblies.has(label)) { sendJson(res, 200, { ok: true, already: true, label }); return }
      const asm = { label, agent, legs: [], guardRows: [], runs: [], outerChildren: [], disposers: [], ok: false, error: null }
      assemblies.set(label, asm)
      void assemble(asm)
        .then(() => record({ leg: 'assembly-complete', label }))
        .catch((error) => { asm.error = String(error?.stack ?? error).slice(0, 900); record({ leg: 'assembly-failed', label, error: asm.error }) })
      sendJson(res, 200, { ok: true, started: true, label })
    } }, 'a5ptc4 assemble')
  }

  function findAgent(sessionId) {
    try {
      for (const a of ctx.agents.list?.() ?? []) if (a?.id === sessionId || a?.session?.header?.id === sessionId) return a
      return null
    } catch { return null }
  }

  function view(a) {
    return { ok: a.ok, error: a.error, runtimeCensus: a.runtimeCensus ?? null, legs: a.legs, guardRows: a.guardRows, runs: a.runs, outerChildren: a.outerChildren }
  }

  async function assemble(asm) {
    const { agent } = asm
    const { defineTool } = await import(URLS.tools)
    asm.legs.push({ leg: 'core-tools-barrel', ok: typeof defineTool === 'function' })
    const acx = agent.ctx
    if (acx?.tools?.register == null) throw new Error('agent.ctx.tools unavailable')

    const runtime = ctx.get?.('ptcRuntime') ?? undefined
    asm.runtimeCensus = {
      hasPtcRuntime: runtime !== undefined,
      language: runtime?.language,
      isolation: runtime?.isolation,
      runtimeSandboxMode: runtime?.sandboxMode,
    }
    asm.legs.push({ leg: 'ptc-runtime-census', ok: runtime !== undefined })

    const echoDef = defineTool({
      name: 'a5ptc4_echo',
      description: 'Witness tool: proves the outer program body really ran (inner pipeline canary).',
      parameters: { tag: { type: 'string', required: true, description: 'tag' } },
      output: { schema: { type: 'string' }, render: (_a, v) => [{ type: 'text', text: String(v) }] },
      execute: async (args) => `A5PTC4-ECHO:${args.tag}`,
    })
    asm.disposers.push(acx.tools.register(echoDef))

    let seq = 0
    asm.disposers.push(acx.tools.guard((exec) => {
      seq += 1
      asm.guardRows.push({ seq, name: String(exec?.name), callId: String(exec?.callId ?? ''), rootCallId: String(exec?.rootCallId ?? ''), inner: exec?.parent !== undefined })
      return undefined
    }))
    asm.disposers.push(acx.tools.presentAs('ptc'))
    if (ASSEMBLE) {
      asm.disposers.push(acx.on?.('approval/request', resolverHandler('agent-ctx')) ?? (() => {}))
      asm.legs.push({ leg: 'resolver-agent-scope', ok: true })
    }
    asm.legs.push({ leg: 'witness-and-presentAs', ok: true })

    // around-seam: capture each OUTER run_code outcome verbatim + /proc-sample
    // the outer OS child for the duration of that outer call (fail-closed
    // pre-spawn refusals therefore show ZERO sampled children — by design).
    acx.on?.('tools/execute', (exec, next) => {
      const out = next()
      if (exec?.name === 'run_code' && exec?.parent === undefined) {
        const startedAt = Date.now()
        const sampler = setInterval(() => {
          try {
            for (const d of readdirSync('/proc')) {
              if (!/^\d+$/.test(d)) continue
              const pid = Number(d)
              if (pid === process.pid) continue
              try {
                const cmd = readFileSync(`/proc/${d}/cmdline`, 'utf8').replaceAll('\0', ' ')
                if (cmd.includes('ptc-runtime-node')) asm.outerChildren.push({ t: Date.now(), startedAt, pid, cmd: cmd.slice(0, 160) })
              } catch { /* raced */ }
            }
          } catch { /* proc raced */ }
        }, 40)
        void Promise.resolve(out).then((value) => {
          clearInterval(sampler)
          asm.runs.push({ at: Date.now(), startedAt, text: extractText(value), raw: safeClone(value) })
        }, () => {
          clearInterval(sampler)
          asm.runs.push({ at: Date.now(), startedAt, text: '(execute rejected)', raw: null })
        })
      }
      return out
    })
    asm.ok = true
  }
}

function extractText(value) {
  try {
    const t = value?.content ?? value?.blocks ?? value
    if (typeof t === 'string') return t
    if (Array.isArray(t)) return t.map((b) => b?.text ?? JSON.stringify(b)).join('\n')
    return JSON.stringify(t)
  } catch { return String(value) }
}
function safeClone(value) {
  try { return JSON.parse(JSON.stringify(value)) } catch { return null }
}
