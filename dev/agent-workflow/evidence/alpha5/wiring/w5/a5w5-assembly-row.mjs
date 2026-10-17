/**
 * a5w5-assembly-row.mjs — W5 LIVE assembly (Alpha.5 wiring phase, lane W5).
 *
 * A PLAIN plugin row mounted through the public profile-patch seam
 * (`$DSH_HOME/profiles/web/cordis.patch.yml`) — the same public seam the
 * production row and the PR3 live round use (IF-1). It carries the TEST-SIDE
 * LIVE assembly of the PR5 Search/Shell tool face INTO a real session Agent:
 *
 *   gated mode   register `a5w5_search`/`a5w5_bash` (aliases of the lane's
 *                `grep`/`bash` — wiring aliases, never extends the closed
 *                set) → install the PR1 Guard (`installScopedToolGuard`,
 *                the observation stream is the live event face) →
 *                `bindOwnTools` + `publish` → the BODIES run the composed
 *                admission face per call: parse (lane `args`) → derive
 *                effects (lane `effects-schema`) → PR2 bind → grant →
 *                exec-edge one-shot consume → `pipeline.runToolCall` with a
 *                REAL backend (system grep / /bin/sh) → settle → spill
 *                (world-bound store) → render (lane `render`).
 *                `a5w5_unbound_probe` is registered AFTER publish: a name
 *                that appeared after the assembly is denied at the call
 *                edge (the unbound negative control rides the REAL
 *                dispatch path, the Body never runs).
 *
 *   ungated mode  the same tool defs WITHOUT the guard install and WITHOUT
 *                 the admission face (the RED control: the same criteria
 *                 must go RED when the gate is absent — the gate is what
 *                 carries the refusals, not the prose).
 *
 * Every judgement comes from the compiled lane / committed dist through
 * public barrels ONLY (`a5w5-fixtures.mjs`); this row re-implements no law.
 * Reads of other objects are labelled, never assumed; waterfall listeners
 * always forward `next()`.
 *
 * Kit-provided environment:
 *   A5W5_DIST      <worktree>/packages/runtime/dist/packages
 *   A5W5_LANE      the lane ESM build root (build-lane-esm.mjs output)
 *   A5W5_LEDGER    JSONL ledger path (append-only)
 *   A5W5_WORLD     absolute world root (repo/ + spill/ under it)
 *   A5W5_OUTSIDE   absolute policy-outside dir
 *   A5W5_TOKEN     the fixture token the repo files carry
 *   A5W5_MODE      gated | ungated
 *
 * @module dev/agent-workflow/evidence/alpha5/wiring/w5/a5w5-assembly-row
 */
import { appendFileSync, mkdirSync, readdirSync } from 'node:fs'
import { dirname, join } from 'node:path'

export const name = 'a5w5-assembly'
export const inject = ['webServer', 'agents']

const LEDGER = process.env['A5W5_LEDGER'] ?? ''
const DIST = process.env['A5W5_DIST'] ?? ''
const LANE = process.env['A5W5_LANE'] ?? ''
const WORLD_ROOT = process.env['A5W5_WORLD'] ?? ''
const OUTSIDE = process.env['A5W5_OUTSIDE'] ?? ''
const TOKEN = process.env['A5W5_TOKEN'] ?? 'A5W5-TOKEN'
const MODE = process.env['A5W5_MODE'] ?? 'gated'

const JOURNAL = []
function record(row) {
  const line = JSON.stringify({ at: new Date().toISOString(), ...row })
  if (LEDGER !== '') {
    try {
      mkdirSync(dirname(LEDGER), { recursive: true })
      appendFileSync(LEDGER, line + '\n')
    } catch { /* the journal is the authoritative in-process copy */ }
  }
  JOURNAL.push({ at: new Date().toISOString(), ...row })
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

const SEARCH = 'a5w5_search'
const BASH = 'a5w5_bash'
const PROBE = 'a5w5_unbound_probe'

/** The policy the round GRANTS: invoke of both tools + list/read on the repo. */
function policyArms(fx, world) {
  return [
    { kind: 'tool-invoke', toolName: 'grep' },
    { kind: 'tool-invoke', toolName: 'bash' },
    { kind: 'list', locator: world.repo },
    { kind: 'read', locator: world.repo },
  ]
}

export async function apply(ctx) {
  const webServer = ctx.webServer
  record({ leg: 'plugin-apply', pid: process.pid, mode: MODE, hasWebServer: webServer !== undefined && typeof webServer.register === 'function', dist: DIST, lane: LANE })

  let lanes = null
  let fx = null
  try {
    fx = await import(new URL(`file://${join(import.meta.dirname, 'a5w5-fixtures.mjs')}`).href)
    lanes = await fx.loadA5W5Lanes({ laneBuild: LANE, distPackages: DIST })
    record({ leg: 'lanes-imported', ok: true, settlement0: lanes.spill.SETTLEMENT_EVENTS[0] })
  } catch (error) {
    record({ leg: 'lanes-imported', ok: false, error: String(error?.message ?? error) })
  }

  // ── routes: the test face reading the LIVE process ────────────────────────
  if (webServer !== undefined && typeof webServer.register === 'function') {
    webServer.register({
      kind: 'exact', path: '/__a5w5/health',
      handler: (_req, res) => sendJson(res, 200, { ok: true, pid: process.pid, mode: MODE, applied: true, assemblies: [...assemblies.keys()] }),
    }, 'a5w5 health')
    webServer.register({
      kind: 'exact', path: '/__a5w5/journal',
      handler: (_req, res) => sendJson(res, 200, { rows: JOURNAL }),
    }, 'a5w5 journal')
    webServer.register({
      kind: 'exact', path: '/__a5w5/state',
      handler: (_req, res) => {
        const out = {}
        for (const [label, asm] of assemblies) out[label] = stateView(asm)
        sendJson(res, 200, { mode: MODE, assemblies: out })
      },
    }, 'a5w5 state')
    webServer.register({
      kind: 'exact', path: '/__a5w5/agents',
      handler: async (_req, res) => {
        let rows
        try {
          const list = ctx.agents.list?.() ?? []
          rows = [...list].map((a) => ({ id: safeLabel(() => a?.id), session: safeLabel(() => a?.session?.header?.id), hasCtx: a?.ctx !== undefined }))
        } catch (error) { rows = [{ error: String(error?.message ?? error) }] }
        sendJson(res, 200, { agents: rows })
      },
    }, 'a5w5 agents')
    webServer.register({
      kind: 'exact', path: '/__a5w5/raw-parity',
      handler: (_req, res) => {
        const label = [...assemblies.keys()][0]
        const asm = assemblies.get(label)
        if (asm === undefined) { sendJson(res, 404, { ok: false, error: 'no assembly' }); return }
        sendJson(res, 200, { ok: true, raw: buildRawTable(asm) })
      },
    }, 'a5w5 raw-parity')
    webServer.register({
      kind: 'exact', path: '/__a5w5/assemble',
      handler: async (req, res) => {
        let body = ''
        for await (const chunk of req) body += chunk
        let parsed
        try { parsed = JSON.parse(body || '{}') } catch { parsed = {} }
        const sessionId = String(parsed?.sessionId ?? '')
        const agent = getAgent(sessionId)
        if (agent === null || agent === undefined) { sendJson(res, 404, { ok: false, error: `no agent for session ${sessionId}` }); return }
        const label = agentLabel(agent)
        if (assemblies.has(label)) { sendJson(res, 200, { ok: true, already: true, label }); return }
        void assemble(label, agent).catch((error) => {
          record({ leg: 'assembly-failed', label, error: String(error?.stack ?? error).slice(0, 800) })
        })
        sendJson(res, 200, { ok: true, started: true, label })
      },
    }, 'a5w5 assemble')
  }

  function getAgent(sessionId) {
    try { return ctx.agents.inject?.(['agents'], () => ctx.agents.get?.(sessionId)) ?? ctx.agents.get?.(sessionId) ?? null } catch { return null }
  }

  function stateView(asm) {
    const obs = asm.observations
    const byName = {}
    for (const o of obs) byName[String(o?.event)] = (byName[String(o?.event)] ?? 0) + 1
    return {
      mode: MODE,
      guard: {
        installOk: asm.installOk,
        installError: asm.installError ?? null,
        bindOwnOk: asm.bindOwnOk,
        publishedOk: asm.publishedOk,
        channel: asm.handle?.changeChannelStatus?.() ?? null,
        channelAtPublish: asm.channelAtPublish ?? null,
        probeRegisteredAfterPublish: asm.probeRegisteredAfterPublish ?? null,
        pendingCalls: asm.handle?.pendingCalls?.() ?? null,
      },
      eventCensus: byName,
      observationsCount: obs.length,
      registryNames: (() => { try { return (asm.inner?.tools?.schemas?.(asm.agent) ?? []).map((r) => String(r?.name)).filter((n) => n.startsWith('a5w5_')) } catch { return null } })(),
      lifecycle: asm.lifecycle ?? null,
      six: asm.six ?? null,
      toolCalls: asm.toolCalls,
      probeBodyCount: asm.probeBodyCount,
      backendExecs: { shell: asm.shellBackend?.execCount?.() ?? null, search: asm.searchBackend?.execCount?.() ?? null },
      backendOutcomes: [...(asm.shellBackend?.outcomes ?? []), ...(asm.searchBackend?.outcomes ?? [])],
      spillFiles: (() => { try { return readdirSync(asm.world.spillRoot) } catch { return null } })(),
      spillResidue: asm.spillStore?.listResidue?.()?.map((e) => ({ spillId: e.spillId, bytes: e.bytes, attributed: e.attribution !== null, settlement: e.settlement })) ?? null,
    }
  }

  /** RAW comparison leg (no lane, no admission): the same commands, direct. */
  function buildRawTable(asm) {
    const rows = []
    for (const t of asm.parityInputs) {
      if (t.kind === 'shell') {
        rows.push({ label: t.label, kind: 'shell', ...fx.runRawShell(t.command, asm.world.repo) })
      } else {
        rows.push({ label: t.label, kind: 'search', ...fx.runRawGrep(asm.searchArgv ?? []) })
      }
    }
    return rows
  }

  // ── the live assembly for one Agent ───────────────────────────────────────
  async function assemble(label, agent) {
    const world = { rootDir: WORLD_ROOT, spillRoot: join(WORLD_ROOT, 'spill'), repo: join(WORLD_ROOT, 'repo'), outside: OUTSIDE, token: TOKEN }
    const asm = {
      observations: [], toolCalls: [], probeBodyCount: 0,
      installOk: false, installError: null, bindOwnOk: false, publishedOk: false,
      handle: null, inner: null, agent, world,
      lifecycle: null, six: null,
      shellBackend: null, searchBackend: null, spillStore: null,
      parityInputs: [
        { label: 'printf', kind: 'shell', command: "printf 'alpha\\nbeta\\n'" },
        { label: 'stderr-exit3', kind: 'shell', command: 'echo out; echo err >&2; exit 3' },
        { label: 'big-seq', kind: 'shell', command: 'seq 1 4000' },
        { label: 'grep-token', kind: 'search' },
      ],
      searchArgv: null, searchParsed: null,
      probeRegisteredAfterPublish: null,
    }
    assemblies.set(label, asm)
    const agentCtx = agent?.ctx
    if (agentCtx === undefined || typeof agentCtx.on !== 'function' || typeof agentCtx.tools?.register !== 'function') {
      record({ leg: 'agent-ctx-unusable', label, hasOn: typeof agentCtx?.on, hasRegister: typeof agentCtx?.tools?.register })
      return
    }
    const inner = agentCtx
    asm.inner = inner

    // live lane objects: one spill store (world-bound), real backends
    const spillOpened = lanes.spill.openSpillStore({
      worldRoot: world.rootDir,
      rootDir: world.spillRoot,
      fs: await nodeSpillPort(),
    })
    if (!spillOpened.ok) { record({ leg: 'spill-store-refused', label, refusal: spillOpened.refusal }); return }
    asm.spillStore = spillOpened.store
    // ONE shared backend instance per kind: the exec counters and outcome
    // ledgers the runner reads are the same objects the model-driven calls
    // move. The admission gate hangs on a per-call holder the body swaps in.
    const shellGateRef = { current: undefined }
    const searchGateRef = { current: undefined }
    asm.shellGateRef = shellGateRef
    asm.searchGateRef = searchGateRef
    asm.shellBackend = fx.createRealShellBackend(lanes.a5, { world, gateRef: shellGateRef })
    asm.searchBackend = fx.createRealSearchBackend(lanes.a5, { world, gateRef: searchGateRef })
    // the parity argv is fixed here so governed/raw legs share ONE argv
    const parsedGrep = lanes.a5.parseGrepArgs({ pattern: TOKEN, path: world.repo, output_mode: 'content' })
    asm.searchParsed = parsedGrep.ok ? parsedGrep.value : null
    asm.searchArgv = parsedGrep.ok ? fx.grepArgv(parsedGrep.value, world.repo) : null

    // ── tool defs (one builder, both modes; the BODY carries the difference) ──
    const outDef = {
      schema: { type: 'object', additionalProperties: false, required: ['text'], properties: { text: { type: 'string' } } },
      render: (_args, value) => [{ type: 'text', text: String(value?.text ?? '') }],
    }
    let callSeq = 0

    const refusalText = (kind, code, message, extra = '') =>
      `A5W5-REFUSED kind=${kind} code=${String(code)} payloadBytes=0${extra === '' ? '' : ` ${extra}`} message=${String(message).slice(0, 300)}`

    async function runGatedCall(kindName, registeredName, parseFn, backendPick, gateRef, raw, argsForFp) {
      const callId = `w5-${kindName}-${++callSeq}`
      const entry = { callId, tool: kindName, registeredName, stage: null, grantId: null, effectKinds: null, fingerprint: null, execEdgeFirst: null, execEdgeReplay: null, ledgerConsumed: null, resultKind: null, spillPointer: null, presented: null, payloadBytes: 0, backendExecBefore: null, backendExecAfter: null, args: (() => { try { return JSON.parse(JSON.stringify(raw ?? null)) } catch { return String(raw).slice(0, 120) } })() }
      asm.toolCalls.push(entry)
      const parsedRes = parseFn(raw)
      if (!parsedRes.ok) {
        entry.stage = 'refused-schema'
        entry.problems = parsedRes.problems
        const text = refusalText('refused-schema', parsedRes.problems[0]?.code ?? 'unknown', JSON.stringify(parsedRes.problems).slice(0, 200))
        record({ leg: 'gated-call', label, callId, stage: entry.stage })
        return { text }
      }
      const derived = lanes.a5.deriveToolEffectSet(fx.REALM, parsedRes.value)
      if (!derived.ok) {
        entry.stage = 'refused-schema'
        entry.problems = derived.problems
        return { text: refusalText('refused-schema', derived.problems[0]?.code ?? 'unknown', JSON.stringify(derived.problems).slice(0, 200)) }
      }
      entry.effectKinds = derived.value.effects.map((e) => e.kind)
      const fingerprint = fx.canonicalParamsFingerprint({ tool: parsedRes.value.tool, args: argsForFp, callId })
      entry.fingerprint = fingerprint
      entry.backendExecBefore = backendPick.execCount()
      const spillFilesBefore = readdirSync(world.spillRoot).length
      const flow = await fx.admitCall(lanes, { registeredName, callId, requestedEffects: derived.value, parametersFingerprint: fingerprint, policyArms: policyArms(fx, world) })
      entry.stage = flow.stage
      if (flow.grant === null || flow.grant === undefined) {
        entry.backendExecAfter = backendPick.execCount()
        entry.spillFilesDelta = readdirSync(world.spillRoot).length - spillFilesBefore
        const decision = flow.decision ?? { error: flow.error }
        const err = decision.error ?? decision
        entry.decisionVerbatim = JSON.parse(JSON.stringify(decision))
        const code = decision.error?.code ?? decision.kind ?? 'unknown'
        const message = decision.error?.message ?? `admission returned ${String(decision.kind)}`
        record({ leg: 'gated-refused', label, callId, stage: flow.stage, code })
        return { text: refusalText(flow.stage, code, message, `deniedEffects=${JSON.stringify(decision.deniedEffects ?? null).slice(0, 160)}`) }
      }
      entry.grantId = flow.grant.grantId
      // exec edge: FIRST consume gates the spawn (deny-before-spawn leg)
      let consumed = false
      gateRef.current = {
        execEdge: () => {
          const r = fx.execEdgeConsume(flow, { replay: consumed })
          if (!consumed) { consumed = true; entry.execEdgeFirst = r }
          return r
        },
      }
      entry.backendExecBefore = backendPick.execCount()
      const result = await lanes.a5.runToolCall({
        request: { realmId: fx.REALM, callId, parsedArgs: parsedRes.value },
        decide: () => ({ kind: 'allow' }),
        backend: backendPick,
        spill: { store: asm.spillStore },
      })
      gateRef.current = undefined
      entry.backendExecAfter = backendPick.execCount()
      // deliberate REPLAY on the one-shot grant (post-success): must refuse
      entry.execEdgeReplay = fx.execEdgeConsume(flow, { replay: true })
      entry.ledgerConsumed = flow.ledger.consumedCount()
      entry.resultKind = result.kind
      if (result.kind === 'presented') {
        entry.spillPointer = result.spill
        entry.presented = result.rendered.text
        entry.presentationMeta = JSON.parse(JSON.stringify(result.rendered.presentationMeta))
        entry.backendOutcome = backendPick.outcomes[backendPick.outcomes.length - 1] ?? null
        // payload bytes the model is shown (the presentation itself) minus renderer structure:
        entry.payloadBytes = presentedPayloadBytes(result.rendered.text, result.rendered.presentationMeta.kind)
        record({ leg: 'gated-presented', label, callId, kindName, grant: entry.grantId, spill: entry.spillPointer })
        return { text: result.rendered.text }
      }
      if (result.kind === 'refused-spill') return { text: refusalText('refused-spill', result.refusal.code, result.refusal.detail) }
      if (result.kind === 'backend-failed') return { text: refusalText('backend-failed', result.failure.code, result.failure.detail) }
      return { text: refusalText(result.kind, 'unknown', JSON.stringify(result).slice(0, 200)) }
    }

    /** Payload bytes of a presentation: the `> `-indented body lines only. */
    function presentedPayloadBytes(text, _kind) {
      const lines = String(text).split('\n')
      const body = []
      for (const line of lines) {
        if (!line.startsWith('> ')) continue
        body.push(line.slice(2))
      }
      return body.join('\n').length
    }

    const searchDef = {
      name: SEARCH,
      description: 'Alpha.5 W5 governed Search (a5p5 grep alias). args: {pattern, path, output_mode}.',
      parameters: { type: 'object', properties: { pattern: { type: 'string' }, path: { type: 'string' }, output_mode: { type: 'string' } }, required: ['pattern'] },
      output: outDef,
      execute: async (raw) => MODE === 'gated'
        ? runGatedCall('search', SEARCH, lanes.a5.parseGrepArgs, asm.searchBackend, asm.searchGateRef, raw, raw)
        : directCall('search', lanes.a5.parseGrepArgs, asm.searchBackend, raw),
    }
    const bashDef = {
      name: BASH,
      description: 'Alpha.5 W5 governed Shell (a5p5 bash alias). args: {command, cwd}.',
      parameters: { type: 'object', properties: { command: { type: 'string' }, cwd: { type: 'string' } }, required: ['command'] },
      output: outDef,
      execute: async (raw) => MODE === 'gated'
        ? runGatedCall('bash', BASH, lanes.a5.parseBashArgs, asm.shellBackend, asm.shellGateRef, raw, raw)
        : directCall('bash', lanes.a5.parseBashArgs, asm.shellBackend, raw),
    }
    const probeDef = {
      name: PROBE,
      description: 'Alpha.5 W5 unbound-control probe. args: {}.',
      parameters: { type: 'object', properties: {} },
      output: outDef,
      execute: async () => { asm.probeBodyCount += 1; record({ leg: 'probe-body-ran', label }) ; return { text: 'A5W5-PROBE-BODY-RAN' } },
    }

    // ungated control: the lane PIPELINE still runs (the lane laws hold), but
    // with NO admission face at all — a static allow, no kernel, no exec edge.
    async function directCall(kindName, parseFn, backendPick, raw) {
      const callId = `w5-${kindName}-ungated-${++callSeq}`
      const entry = { callId, tool: kindName, stage: 'ungated', grantId: null, resultKind: null, presented: null, payloadBytes: 0, backendExecBefore: backendPick.execCount(), backendExecAfter: null, spillFilesDelta: 0, args: (() => { try { return JSON.parse(JSON.stringify(raw ?? null)) } catch { return String(raw).slice(0, 120) } })() }
      asm.toolCalls.push(entry)
      const parsedRes = parseFn(raw)
      if (!parsedRes.ok) return { text: refusalText('refused-schema', parsedRes.problems[0]?.code ?? 'unknown', JSON.stringify(parsedRes.problems).slice(0, 200)) }
      const result = await lanes.a5.runToolCall({
        request: { realmId: fx.REALM, callId, parsedArgs: parsedRes.value },
        decide: () => ({ kind: 'allow' }), // THE RED: a standing allow, no admission fact behind it
        backend: backendPick,
        spill: { store: asm.spillStore },
      })
      entry.backendExecAfter = backendPick.execCount()
      entry.resultKind = result.kind
      if (result.kind === 'presented') {
        entry.presented = result.rendered.text
        entry.payloadBytes = presentedPayloadBytes(result.rendered.text, result.rendered.presentationMeta.kind)
        return { text: result.rendered.text }
      }
      return { text: refusalText(result.kind, result.failure?.code ?? result.refusal?.code ?? 'unknown', JSON.stringify(result).slice(0, 200)) }
    }

    // ── assembly order (design §4.1): defs → guard install → bind → publish → post-publish probe ──
    try {
      inner.tools.register(searchDef)
      inner.tools.register(bashDef)
      record({ leg: 'register', label, names: [SEARCH, BASH], ok: true })
    } catch (error) {
      record({ leg: 'register', label, ok: false, error: String(error?.message ?? error) })
      return
    }

    if (MODE === 'gated') {
      const nativeNames = (() => { try { const s = inner.tools.schemas(); return Array.isArray(s) ? s.map((r) => r?.name).filter((n) => typeof n === 'string' && n.length > 0) : [] } catch { return [] } })()
      const trusted = [...new Set([safeLabel(() => agent?.id), safeLabel(() => agent?.session?.header?.id)].filter((s) => !s.startsWith('(unreadable') && s !== '(unknown-agent)'))]
      const outcome = lanes.td.installScopedToolGuard({
        agentCtx: { tools: inner.tools, on: inner.on?.bind(inner) },
        runtimeAgent: agent,
        trustedIdentities: trusted,
        nativeNames,
        assemblyOwnedNames: [SEARCH, BASH],
        onObserve: (row) => { asm.observations.push(row) },
      })
      asm.installOk = outcome.ok === true
      if (!outcome.ok) {
        asm.installError = { code: outcome.error?.code, message: String(outcome.error?.message).slice(0, 300) }
        record({ leg: 'guard-install-refused', label, code: outcome.error?.code })
        return
      }
      asm.handle = outcome.value
      const bound = asm.handle.bindOwnTools([SEARCH, BASH])
      asm.bindOwnOk = bound.ok === true
      const published = asm.handle.publish()
      asm.publishedOk = published.ok === true
      asm.channelAtPublish = asm.handle.changeChannelStatus()
      record({ leg: 'guard-assembled', label, installOk: true, bindOwnOk: asm.bindOwnOk, publishedOk: asm.publishedOk, channelAtPublish: asm.channelAtPublish })
    }

    // the unbound probe: registered AFTER the assembly face exists (gated) —
    // a name that appears after assembly is denied at the call edge.
    try {
      inner.tools.register(probeDef)
      asm.probeRegisteredAfterPublish = true
      record({ leg: 'register', label, name: PROBE, afterAssembly: MODE === 'gated', ok: true })
    } catch (error) {
      asm.probeRegisteredAfterPublish = false
      record({ leg: 'register', label, name: PROBE, ok: false, error: String(error?.message ?? error) })
    }

    // the spill lifecycle + six-name tables (lane laws measured LIVE)
    asm.lifecycle = await fx.runSpillLifecycle(lanes.spill, world)
    asm.six = fx.runSixNames(lanes.spill)
    record({ leg: 'lifecycle-complete', label, legsOk: asm.lifecycle?.idInUse?.refused === true && asm.lifecycle?.unknownEvent?.refused === true })
    record({ leg: 'assembly-complete', label })
  }
}

async function nodeSpillPort() {
  const mod = await import('node:fs')
  return {
    ensureDir: (p) => { mod.mkdirSync(p, { recursive: true }) },
    writeFile: (p, t) => mod.writeFileSync(p, t),
    appendFile: (p, t) => mod.writeFileSync(p, t, { flag: 'a' }),
    readText: (p) => mod.readFileSync(p, 'utf8'),
    sizeBytes: (p) => mod.readFileSync(p).length,
    list: (d) => { try { return mod.readdirSync(d) } catch { return [] } },
    remove: (p) => mod.rmSync(p, { force: true }),
    exists: (p) => mod.existsSync(p),
  }
}
