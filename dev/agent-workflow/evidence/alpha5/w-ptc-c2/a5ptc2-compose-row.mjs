/**
 * a5ptc2-compose-row.mjs — W-PTC-C2 COMPOSED-CHAIN assembly row: ONE real chain in
 * ONE session Agent on the pinned Host, through the public seams only.
 *
 * THE CHAIN (this row's whole point — the two proven halves assembled ONCE, on
 * the SAME execution path, not as two receipts glued in prose):
 *
 *   model turn ─▶ run_code (PTC reserved transport; host's OWN NodePtcRuntime;
 *                 outer = a REAL separate OS process)                    [W-PTC-RE face]
 *        ─▶ stdio control pipe ─▶ inner tool call re-enters the SAME ToolRuntime
 *                 pipeline (exec.parent present, exec.rootCallId = outer callId),
 *                 every execution passes the Team guard                 [W-PTC-RE face]
 *        ─▶ the inner tool's EXECUTION EDGE = a confined spawn through the
 *                 Lane C provider: dist public barrel ─▶ createConfinedProcessProvider
 *                 ─▶ counting-spy deps ─▶ tracked landlock pre-launcher ─▶ real
 *                 execve under real Landlock                                     [W4 face]
 *
 * Faces used (all public, each barrel/export pre-censused):
 *   - `agent.ctx.tools.presentAs('ptc')` / `register` / `guard` (@deepseek-ai/dsh-tools
 *     scoped face, same as w-ptc-re/a5ptc-row.mjs);
 *   - `agent.ctx.on('tools/execute')` around-seam (same);
 *   - `@deepseek-ai/dsh-sandbox-policy` setSandboxMode = TEST-WORLD session-scoped
 *     mode switch ONLY (this host has no bwrap backend for the PTC runtime itself;
 *     the host's typed error prescribes this exact public switch; OS-enforcement
 *     caliber is NEVER asserted by that switch — the OS plane below is the
 *     provider's real Landlock launcher, disclosed and separated);
 *   - the sandbox-provider DIST PUBLIC BARREL dynamic import + `createConfinedProcessProvider`
 *     + the frozen `deps` counting-spy injection point (exactly the W4 kit's
 *     binding shapes; zero lane edit, IF-5 honored);
 *   - `ctx.webServer.register` assembly/journal/state routes (same assembly face as
 *     both prior kits — a plain row's agent/created subscription receives nothing
 *     in a plain-session world; assembly is route-driven, measured fact on record).
 *
 * THE THREE LEGS this row serves inside ONE PTC program (see runner):
 *   (a) POSITIVE  — mode 'supported': the inner execution edge REALLY spawns
 *                   (cat of the allowed fixture, rc 0, spill content match) and
 *                   the per-call receipt (lease terminated, processIdentity pid)
 *                   flies back through the PTC control pipe;
 *   (b) UNSUPPORTED — mode 'net-deny': the provider refuses BEFORE launch with
 *                   the typed IO_POLICY_UNSUPPORTED and the per-call spy delta
 *                   is exactly 0 (no launcher invocation, no plan/out paths);
 *   (c) GUARD-DENY — tool `a5ptc2_probe_spawn` (its body WOULD confined-spawn):
 *                   the Team guard returns a typed deny reason, the body never
 *                   runs, the confined-exec spy stays flat.
 *   Plus (a2, on the SAME chain) mode 'deny': the SAME confined policy, cat of a
 *   PRIVATE fixture ⇒ the OS plane refuses the payload itself (rc!=0, EACCES,
 *   zero leak) — the per-call OS-denial negative control living INSIDE the PTC
 *   pipeline, not beside it.
 *
 * Restricted by construction: the model chooses only {mode, tag}; every
 * SpawnRequest (argv/cwd/allowPaths/networkProfile) is FIXED in this row (the
 * W4 restriction law). Hard realm: the instance is built WITH hardDimensions
 * ['content-read','write'] (review-LaneC 观察 2 law), so every accepted spawn
 * passed verifyHardProfileEvidence against the REAL captured probe legs.
 *
 * DISCLOSED ASSEMBLY FACT (carried from the W4 kit, unchanged): provider.execute()
 * passes its OWN module-relative launcherPath as argv[0]; dist carries no .py
 * assets, so the spy rewrites argv[0] to the TRACKED launcher (sha recorded by
 * the runner) and journals both identities. The argv tail stays provider-compiled.
 *
 * Honesty: every judgement is recorded from the LIVE process (journal + routes);
 * no backfill; fixture caliber disclosed; the PTC-outer-process mode switch is
 * disclosed as a test-world parameter, NOT an OS-isolation claim.
 *
 * Kit-provided environment (runner):
 *   A5PTC2_MODE      always 'compose' (single composed mode)
 *   A5PTC2_TESTUSE   pinned host tree root (built lib plane, read-only)
 *   A5PTC2_DIST      <worktree>/packages/runtime/dist/packages (public barrels)
 *   A5PTC2_LAUNCHER  tracked landlock-prelauncher.py path
 *   A5PTC2_PYTHON    python interpreter for the launcher
 *   A5PTC2_REALM     realm id for this world
 *   A5PTC2_FIXTURES  fixture root (allow/ok.txt + private/secret.txt)
 *   A5PTC2_SCRATCH   provider scratch root (plans/out under it)
 *   A5PTC2_LEDGER    JSONL ledger path (append-only)
 *   A5PTC2_RUN       run id (guard deny token)
 *
 * @module dev/agent-workflow/evidence/alpha5/w-ptc-c2/a5ptc2-compose-row
 */
import { appendFileSync, existsSync, mkdirSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'
import { pathToFileURL } from 'node:url'

export const name = 'a5ptc2-compose-row'
export const inject = ['webServer', 'agents', 'tools']

const TESTUSE = process.env.A5PTC2_TESTUSE ?? ''
const DIST = process.env.A5PTC2_DIST ?? ''
const LAUNCHER = process.env.A5PTC2_LAUNCHER ?? ''
const PYTHON = process.env.A5PTC2_PYTHON ?? 'python3'
const REALM = process.env.A5PTC2_REALM ?? 'a5ptc2-realm'
const FIXTURES = process.env.A5PTC2_FIXTURES ?? ''
const SCRATCH = process.env.A5PTC2_SCRATCH ?? ''
const LEDGER = process.env.A5PTC2_LEDGER ?? ''
const RUN = process.env.A5PTC2_RUN ?? 'run'

const lib = (rel) => pathToFileURL(join(TESTUSE, rel)).href
const URLS = {
  tools: lib('packages/core/tools/lib/index.js'),
  sandboxPolicy: lib('packages/sandbox/sandbox-policy/lib/index.js'),
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

/** Recursive manifest of a subtree: sorted `rel|size` lines (structural zero-spawn evidence). */
function manifest(root) {
  const out = []
  const walk = (dir) => {
    let entries = []
    try { entries = readdirSync(dir) } catch { return }
    for (const entry of entries.sort()) {
      const full = join(dir, entry)
      let st = null
      try { st = statSync(full) } catch { continue }
      if (st.isDirectory()) walk(full)
      else if (st.isFile()) out.push(`${relative(root, full)}|${String(st.size)}`)
    }
  }
  if (existsSync(root)) walk(root)
  return out
}

/** Classify one launcher invocation by its mode argument (argv[1]). */
const classify = (argv) => {
  const a = String(argv?.[1] ?? '')
  if (a === '--confined-exec') return 'confined-exec'
  if (a === '--abi-probe') return 'abi-probe'
  if (a === '--enforce-leg') return `enforce-leg:${String(argv?.[2] ?? '?')}`
  if (a === '--fd-close') return 'fd-close'
  return `other:${a.slice(0, 20)}`
}

const assemblies = new Map()

/** One provider instance: REAL launcher deps wrapped in the counting spy (W4 shape). */
function buildInstance(mod, label, { pythonPath, launcherPath }) {
  const real = mod.createLauncherDeps({ pythonPath, launcherPath })
  const counters = { runs: 0, confinedExec: 0, byKind: {} }
  const execAnswers = []
  const abiAnswers = []
  const legVerdicts = {}
  const offeredLauncherPaths = new Set()
  const spyRun = (argv, timeoutMs) => {
    const kind = classify(argv)
    if (typeof argv?.[0] === 'string') offeredLauncherPaths.add(argv?.[0])
    counters.runs += 1
    counters.byKind[kind] = (counters.byKind[kind] ?? 0) + 1
    if (kind === 'confined-exec') counters.confinedExec += 1
    record({ leg: 'run-spy', instance: label, kind, offered: String(argv?.[0] ?? ''), rewritten: argv?.[0] !== launcherPath })
    const r = real.run([launcherPath, ...(argv ?? []).slice(1)], timeoutMs)
    record({ leg: 'run-answer', instance: label, kind, rc: r.rc, stderrTail: String(r.stderr ?? '').slice(0, 160) })
    if (kind.startsWith('enforce-leg:')) {
      let verdict = 'MIXED/FAILED'
      try {
        const line = String(r.stdout ?? '').trim().split('\n').filter((l) => l.length > 0).pop()
        const v = JSON.parse(line ?? 'null')
        if (typeof v?.verdict === 'string') verdict = v.verdict
      } catch { /* unparseable stays MIXED/FAILED — the probe's own truth */ }
      legVerdicts[kind.slice('enforce-leg:'.length)] = verdict
      record({ leg: 'leg-verdict', instance: label, kind, verdict })
    }
    if (kind === 'confined-exec') {
      let answer = null
      try {
        const line = String(r.stdout ?? '').trim().split('\n').filter((l) => l.length > 0).pop()
        if (line !== undefined) answer = JSON.parse(line)
      } catch { answer = null }
      execAnswers.push({ rc: answer?.rc ?? null, pid: answer?.pid ?? null, executed: answer?.executed === true, outRef: answer?.out_ref ?? null, errRef: answer?.err_ref ?? null, launcherRc: r.rc })
      record({ leg: 'exec-answer', instance: label, rc: answer?.rc ?? null, pid: answer?.pid ?? null, launcherRc: r.rc, abiUnavailable: answer?.abi_unavailable === true })
    }
    if (kind === 'abi-probe') {
      const raw = String(r.stdout ?? '')
      let abiVersion = null
      try {
        const line = raw.trim().split('\n').filter((l) => l.length > 0).pop()
        const v = JSON.parse(line ?? 'null')
        if (v?.kind === 'abi-available' && typeof v?.abi_version === 'number') abiVersion = v.abi_version
      } catch { /* unparseable stays null — the probe's own truth */ }
      abiAnswers.push({ abiVersion, rawHead: raw.slice(0, 400) })
      record({ leg: 'abi-answer', instance: label, abiVersion })
    }
    return r
  }
  const launcher = { pythonPath, launcherPath, run: spyRun }
  const deps = {
    availability: () => ({ rows: mod.runAvailabilityPreflight({ pythonPath, launcherPath, runnerCommand: null }) }),
    run: spyRun,
    probeFacts: () => {
      const abi = mod.runAbiProbe(launcher)
      const legs = {}
      for (const leg of mod.ENFORCEMENT_LEGS) {
        legs[leg] = mod.runEnforcementLeg(launcher, leg, join(SCRATCH, label, `probe-${RUN}`, leg))
      }
      return { abiVersion: abi.abiVersion, legs }
    },
  }
  const provider = mod.createConfinedProcessProvider({
    realmId: REALM,
    trustRoot: 'a5ptc2-trustroot',
    scratchRoot: join(SCRATCH, label),
    hardDimensions: ['content-read', 'write'],
    deps,
  })
  return { provider, counters, execAnswers, abiAnswers, legVerdicts, offeredLauncherPaths: [...offeredLauncherPaths] }
}

/** The ONLY SpawnRequest shapes the tool can produce (row-fixed, restricted; W4 law). */
function spawnRequest(mode, tag) {
  const base = {
    grantFingerprint: `a5ptc2-grant-${slug(tag)}`,
    realmId: REALM,
    bindingId: 'a5ptc2-compose-binding',
    memberScope: 'session',
    cwd: FIXTURES,
    env: [],
    allowPaths: [{ path: join(FIXTURES, 'allow'), accessBits: { readFile: true, readDir: true } }],
  }
  if (mode === 'supported') return { ...base, argv: ['/usr/bin/cat', join(FIXTURES, 'allow', 'ok.txt')] }
  if (mode === 'deny') return { ...base, argv: ['/usr/bin/cat', join(FIXTURES, 'private', 'secret.txt')] }
  if (mode === 'net-deny') return { ...base, argv: ['/usr/bin/cat', join(FIXTURES, 'allow', 'ok.txt')], networkProfile: 'deny' }
  return { ...base, argv: ['/usr/bin/cat', join(FIXTURES, 'allow', 'ok.txt')] }
}

export async function apply(ctx) {
  record({ leg: 'plugin-apply', pid: process.pid, dist: DIST, launcher: LAUNCHER, realm: REALM, testUse: TESTUSE })

  let prov = null
  try {
    prov = await import(pathToFileURL(join(DIST, 'runtime', 'sandbox-provider', 'index.js')).href)
    record({ leg: 'barrel-import', ok: true, names: ['createConfinedProcessProvider', 'createLauncherDeps', 'runAvailabilityPreflight', 'runAbiProbe', 'runEnforcementLeg', 'ENFORCEMENT_LEGS'].map((n) => `${n}:${typeof prov[n]}`).join(',') })
  } catch (error) {
    record({ leg: 'barrel-import', ok: false, error: String(error?.message ?? error) })
  }

  if (typeof ctx.webServer?.register === 'function') {
    ctx.webServer.register({ kind: 'exact', path: '/__a5ptc2/health', handler: (_q, res) => sendJson(res, 200, { ok: true, applied: true, pid: process.pid, barrel: prov !== null }) }, 'a5ptc2 health')
    ctx.webServer.register({ kind: 'exact', path: '/__a5ptc2/journal', handler: (_q, res) => sendJson(res, 200, { rows: JOURNAL }) }, 'a5ptc2 journal')
    ctx.webServer.register({ kind: 'exact', path: '/__a5ptc2/state', handler: async (_q, res) => {
      const out = {}
      for (const [label, a] of assemblies) out[label] = await view(a)
      sendJson(res, 200, { realm: REALM, assemblies: out })
    } }, 'a5ptc2 state')
    ctx.webServer.register({ kind: 'exact', path: '/__a5ptc2/assemble', handler: async (req, res) => {
      let body = ''
      for await (const c of req) body += c
      let parsed; try { parsed = JSON.parse(body || '{}') } catch { parsed = {} }
      const sessionId = String(parsed?.sessionId ?? '')
      const agent = findAgent(sessionId)
      if (agent == null) { sendJson(res, 404, { ok: false, error: `no agent for session ${sessionId}` }); return }
      const label = agentLabel(agent)
      if (assemblies.has(label)) { sendJson(res, 200, { ok: true, already: true, label }); return }
      const asm = { label, agent, legs: [], guardRows: [], toolResults: [], ok: false, error: null }
      assemblies.set(label, asm)
      void assembleCompose(asm)
        .then(() => record({ leg: 'assembly-complete', label }))
        .catch((error) => { asm.error = String(error?.stack ?? error).slice(0, 900); record({ leg: 'assembly-failed', label, error: asm.error }) })
      sendJson(res, 200, { ok: true, started: true, label })
    } }, 'a5ptc2 assemble')
  }

  function findAgent(sessionId) {
    try {
      const list = ctx.agents.list?.() ?? []
      for (const a of list) if (a?.id === sessionId || a?.session?.header?.id === sessionId) return a
      return null
    } catch { return null }
  }

  async function view(a) {
    const holder = a.instance ?? null
    let probeRows = null
    if (holder !== null && holder !== undefined) {
      try {
        const p = await holder.provider.probe()
        probeRows = p.ok ? p.value.map((r) => ({ dimension: r.dimension, level: r.level, mechanism: r.mechanism, realmId: r.realmId, evidence: r.evidence, note: r.note.slice(0, 200) })) : { refused: p.error?.code ?? String(p.error) }
      } catch (error) { probeRows = { threw: String(error?.message ?? error) } }
    }
    return {
      ok: a.ok, error: a.error,
      runtimeCensus: a.runtimeCensus ?? null, modeCensus: a.modeCensus ?? null,
      legs: a.legs ?? [], guardRows: a.guardRows, toolResults: a.toolResults,
      throwCensus: a.throwCensus ?? null, runResult: a.runResult ?? null, outerChildren: a.outerChildren ?? [],
      counters: holder?.counters ?? null, execAnswers: holder?.execAnswers ?? [], abiAnswers: holder?.abiAnswers ?? [],
      legVerdicts: holder?.legVerdicts ?? {}, offeredLauncherPaths: holder?.offeredLauncherPaths ?? [],
      providerProbe: probeRows, hardDimensionsConfigured: ['content-read', 'write'],
      scratchManifest: manifest(SCRATCH), fixturesManifest: manifest(FIXTURES),
    }
  }

  async function assembleCompose(asm) {
    const { agent, legs } = asm
    const coreTools = await import(URLS.tools)
    const { defineTool } = coreTools
    legs.push({ leg: 'core-tools-barrel', ok: typeof defineTool === 'function' })
    const acx = agent.ctx
    if (acx?.tools?.register == null) throw new Error('agent.ctx.tools unavailable')
    if (prov === null) throw new Error('sandbox-provider dist barrel import failed (see barrel-import leg)')

    // census of the host-provided PTC runtime (the row assembles NO runtime of its own)
    const runtime = ctx.get?.('ptcRuntime') ?? undefined
    asm.runtimeCensus = { hasPtcRuntime: runtime !== undefined, language: runtime?.language, sandboxMode: runtime?.sandboxMode }
    legs.push({ leg: 'ptc-runtime-census', ok: runtime !== undefined, census: asm.runtimeCensus })

    // TEST-WORLD policy caliber (carried from w-ptc-re, same public switch, same
    // disclosure): this host has no bwrap/Landlock backend FOR THE PTC RUNTIME'S OWN
    // sandbox mode; the host's typed error prescribes this exact public switch. It
    // switches ONLY the per-session event fold inside THIS world and asserts NO
    // OS-isolation caliber — the OS plane of THIS chain is the provider's real
    // Landlock launcher below, disclosed separately and evidenced independently.
    if (runtime !== undefined && runtime.sandboxMode !== 'danger-full-access' && agent.session !== undefined) {
      const { setSandboxMode } = await import(URLS.sandboxPolicy)
      const policy = ctx.get?.('sandboxPolicy')
      const pre = await Promise.resolve(policy?.resolve?.({ session: agent.session }))
      setSandboxMode(agent.session, 'danger-full-access')
      const post = await Promise.resolve(policy?.resolve?.({ session: agent.session }))
      asm.modeCensus = {
        pre: pre?.mode ?? pre?.sandboxMode ?? null,
        post: post?.mode ?? post?.sandboxMode ?? null,
        deploymentDefault: runtime.sandboxMode,
        write_path: 'setSandboxMode(session, mode) = session.append("sandbox/mode", { mode }) — per-session event inside THIS test world only',
        os_caliber_note: 'NOT the OS-enforcement plane of this chain; the OS plane = provider Landlock launcher (see leg provider-instance-built + tool rc/lease)',
      }
      legs.push({ leg: 'sandbox-mode-override', mode: 'danger-full-access', modeCensus: asm.modeCensus })
    }

    // the Lane C provider instance behind the inner execution edge (W4 face, same shapes)
    asm.instance = buildInstance(prov, 'main', { pythonPath: PYTHON, launcherPath: LAUNCHER })
    legs.push({ leg: 'provider-instance-built', ok: true, realm: REALM, hardDimensions: ['content-read', 'write'] })

    const confinedExecDef = defineTool({
      name: 'a5ptc2_confined_exec',
      description: 'Composed-chain witness: confined spawn through the Lane C provider on the PTC inner-call edge. Args {mode: "supported"|"deny"|"net-deny", tag}; argv is fixed by the assembly row — the model chooses only the mode.',
      parameters: {
        mode: { type: 'string', required: true, description: 'supported | deny | net-deny' },
        tag: { type: 'string', required: true, description: 'marker tag' },
      },
      output: { schema: { type: 'string' }, render: (_a, v) => [{ type: 'text', text: String(v) }] },
      execute: async (args) => runConfined(asm, String(args?.mode ?? 'unknown'), String(args?.tag ?? 'untagged')),
    })
    const probeSpawnDef = defineTool({
      name: 'a5ptc2_probe_spawn',
      description: 'Composed-chain canary: its body WOULD run a confined spawn (marker C2-PROBE-SPAWN-RAN). It must be guard-denied; if the marker ever appears, the guard failed.',
      parameters: { tag: { type: 'string', required: true, description: 'tag' } },
      output: { schema: { type: 'string' }, render: (_a, v) => [{ type: 'text', text: String(v) }] },
      execute: async (args) => {
        const before = asm.instance.counters.confinedExec
        const res = await asm.instance.provider.spawn(spawnRequest('supported', `probe-${String(args?.tag ?? '')}`))
        return `C2-PROBE-SPAWN-RAN ok=${String(res.ok)} ceDelta=${String(asm.instance.counters.confinedExec - before)}`
      },
    })

    const disposers = []
    disposers.push(acx.tools.register(confinedExecDef))
    disposers.push(acx.tools.register(probeSpawnDef))
    legs.push({ leg: 'scoped-compose-tools-registered', ok: true })

    let seq = 0
    disposers.push(acx.tools.guard((exec) => {
      seq += 1
      asm.guardRows.push({
        seq,
        name: String(exec?.name),
        callId: String(exec?.callId ?? ''),
        rootCallId: String(exec?.rootCallId ?? ''),
        inner: exec?.parent !== undefined,
        ceSnapshot: asm.instance?.counters?.confinedExec ?? null,
      })
      if (exec?.name === 'a5ptc2_probe_spawn') return `${RUN}-C2-GUARD-DENY composed-chain probe denied by the team guard before its body`
      return undefined
    }))
    legs.push({ leg: 'team-guard-installed', ok: true })

    disposers.push(acx.tools.presentAs('ptc'))
    legs.push({ leg: 'presentAs-ptc', ok: true })
    asm.disposers = disposers

    // public around-seam: capture the OUTER run_code result + /proc-sample the real
    // PTC runtime child process while the outer run is in flight (same face/shape
    // as w-ptc-re: outer_real_process evidence class).
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
          asm.runResult = { isError: res?.isError === true, text: (res?.content ?? []).map((c) => c?.text ?? '').join('\n').slice(0, 6000) }
        }).catch((error) => {
          clearInterval(sampler)
          asm.runResult = { error: String(error?.message ?? error).slice(0, 400) }
        })
      }
      return out
    })
    legs.push({ leg: 'around-listener-installed', ok: typeof acx.on === 'function' })

    // reserved-transport throw census (4 sides; same shapes as w-ptc-re → A4 on THIS chain)
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

  async function runConfined(asm, mode, tag) {
    const holder = asm.instance
    const line = (fields) => {
      const row = { mode, tag, ...fields }
      asm.toolResults.push(row)
      record({ leg: 'tool-result', ...row })
      return `C2-RES tag=${slug(tag)} mode=${mode} ok=${String(row.ok)} code=${String(row.code)} rc=${String(row.rc)} pid=${String(row.pid)} lease=${String(row.lease)} stage=${String(row.stage)} spyDelta=${String(row.spyDelta)} ceDelta=${String(row.ceDelta)} stdoutMatch=${String(row.stdoutMatch)} eacces=${String(row.stderrEACCES)} leaked=${String(row.secretLeaked)} receipt=${String(row.receiptPid)}`
    }
    const before = { runs: holder.counters.runs, ce: holder.counters.confinedExec }
    const scratchBefore = new Set(manifest(SCRATCH))
    let res
    try {
      res = await holder.provider.spawn(spawnRequest(mode, tag))
    } catch (error) {
      return line({ ok: false, code: 'THREW', rc: null, pid: null, lease: null, stage: 'provider-spawn-threw', message: String(error?.message ?? error).slice(0, 300), spyDelta: holder.counters.runs - before.runs, ceDelta: holder.counters.confinedExec - before.ce, stdoutMatch: null, stderrEACCES: null, secretLeaked: null, receiptPid: null })
    }
    const spyDelta = holder.counters.runs - before.runs
    const ceDelta = holder.counters.confinedExec - before.ce
    const newPaths = manifest(SCRATCH).filter((p) => !scratchBefore.has(p))
    const spawnEvidencePaths = newPaths.filter((p) => /(^|\/)plans\//.test(p) || /(^|\/)out\//.test(p))
    if (!res.ok) {
      return line({
        ok: false, code: res.error?.code ?? null, message: String(res.error?.message ?? '').slice(0, 300),
        rc: null, pid: null, lease: null, stage: 'provider-refused',
        spyDelta, ceDelta, spawnEvidencePaths, stdoutMatch: null, stderrEACCES: null, secretLeaked: null, receiptPid: null,
      })
    }
    const { receipt, output, lease } = res.value
    const answer = holder.execAnswers[holder.execAnswers.length - 1] ?? null
    const allowContent = (() => { try { return readFileSync(join(FIXTURES, 'allow', 'ok.txt'), 'utf8') } catch { return '' } })()
    const secretContent = (() => { try { return readFileSync(join(FIXTURES, 'private', 'secret.txt'), 'utf8') } catch { return '' } })()
    return line({
      ok: true, code: null, stage: 'provider-executed',
      rc: answer?.rc ?? null, pid: answer?.pid ?? null, launcherRc: answer?.launcherRc ?? null,
      lease: lease.status, receiptPid: receipt.processIdentity,
      stdoutHead: output.stdout.slice(0, 120), stderrHead: output.stderr.slice(0, 200),
      stdoutMatch: mode === 'supported' ? output.stdout.trim() === allowContent.trim() : undefined,
      stderrEACCES: /Permission denied|EACCES/i.test(output.stderr),
      secretLeaked: secretContent.trim().length > 0 && (output.stdout.includes(secretContent.trim().slice(0, 16)) || output.stderr.includes(secretContent.trim().slice(0, 16))),
      spyDelta, ceDelta, spawnEvidencePaths,
    })
  }

  ctx.effect?.(() => {
    for (const asm of assemblies.values()) {
      for (const d of asm.disposers ?? []) { try { d() } catch { /* scope unwind covers it */ } }
    }
  }, 'a5ptc2-compose-row')
  record({ leg: 'apply-done' })
}
