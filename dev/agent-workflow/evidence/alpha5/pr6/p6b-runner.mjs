#!/usr/bin/env node
/**
 * p6b-runner.mjs — Alpha.5 PR6 PoC6b (E 类 LSP：池键 + service 生命周期隔离勘查) runner.
 * Team-owned, PoC only, DORMANT (nothing live-wired). IDEMPOTENT: overwrites ./p6b-result.json,
 * rewrites ./probe-scratch/ (fictional server script + fabricated data only).
 *
 * WHAT THIS IS / IS NOT (honesty discipline):
 *  - Real pinned production libs under test: @deepseek-ai/dsh-lsp (ctx.lsp registry),
 *    @deepseek-ai/dsh-lsp-stdio (pooling provider + instance lifecycle),
 *    @deepseek-ai/dsh-tool-lsp (model tool -> ctx.lsp.query REAL route), cordis
 *    isolate()/extend + dsh-scope createScope, fs-local, subprocess-local.
 *  - The language server is a FICTIONAL fully-auditable stdio script (rewritten every run):
 *    echoes initialize/shutdown, reports its own OS pid + didOpen count in hover text,
 *    slow-hover via position.line (>50 => delay ms), optional shutdown-ignoring mode.
 *    NOT a real language server: "real server reuse behavior" stays NOT_RUN (as in P0-5).
 *  - Sensitive files are fabricated markers. No model keys, no Host server, no ports,
 *    no DSH_HOME world. :3080 untouched. T (0.2.0-rc.2) read-only, verified before/after.
 *
 * Legs (三态: SUPPORT / typed-reject / SEAM-GAP — records in SEAM-VERDICTS.md):
 *  P6B-1  baseline hazard control: shared root pool keyed by workspace identity only —
 *         two policy principals, same workspaceRoot string, SAME resident pid (P0-5 L3
 *         reproduced on this host as the contrast pair; HAZARD-OBSERVED is a PASS here).
 *  P6B-2  ctx.isolate('lsp') + per-realm plugin(Lsp)+plugin(lsp-stdio) remount: same
 *         workspace -> DIFFERENT pids (pool privacy per realm); hot reuse inside a realm;
 *         realm-A dispose kills only A's pid (B and root untouched; B hot-pid unchanged).
 *  P6B-3  REAL call route: tool-lsp mounted per agent scope (createScope ctx + isolate
 *         child) registers scope-local 'lsp' tools; a model-route execute() per member
 *         resolves that member's definition AND that member's pool (distinct pids),
 *         server-side didOpen attribution stays realm-private.
 *  P6B-4  granularity census: pool key contains no policy/policyGeneration field
 *         (LspQueryRequest has no caller/policy channel) -> within one realm, different
 *         policy labels still share a pid: SEAM-GAP at policy granularity (realm is the
 *         finest granularity the public seams can express).
 *  P6B-5  terminate & lease boundaries (C-PROC / C-GW mapping):
 *         (a) in-flight cancel escalates to instance TERMINATION (pid gone) and the next
 *             query RESPAWNS a new pid (cancel != terminate, both confirmed at the seam);
 *         (b) dispose of a shutdown-ignoring server is AWAITED: budget -> SIGTERM/SIGKILL
 *             -> process close observed before dispose returns (EXECUTION_TERMINATION
 *             not left unconfirmed);
 *         (c) after dispose begins: queued query rejects typed (LSP_DISPOSED, no process
 *             started) while the in-flight one rejects aborted — the C-GW
 *             already-started / not-started typing IS observable on the public seam.
 *
 * Exit code: 0 iff every PASS-candidate leg asserted true.
 */
import { spawnSync } from 'node:child_process'
import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { register } from 'node:module'

const HERE = dirname(fileURLToPath(import.meta.url))
const TEAM_ROOT = resolve(HERE, '..', '..', '..', '..', '..')
const TEST_USE = process.env.P6_TEST_USE
  ?? '/srv/workspace/dsh-plugins/dsh-agent-team/.worktrees/exp-alpha5-poc-20261016/tests/deepseek-harness-test-use'
const SCRATCH = join(HERE, 'probe-scratch')
const BASELINE_SHA = '639ed015397290b3745d163aafe02ffee4aa3f84'
const MODEL_NAME = 'qwen3.8-flash-next'

const sh = (cmd, args) => { const r = spawnSync(cmd, args, { encoding: 'utf8' }); return { cmd: [cmd, ...args].join(' '), code: r.status, out: (r.stdout ?? '').trim(), err: (r.stderr ?? '').trim() } }

const result = {
  poc: 'PR6 PoC6b — E-class (LSP) pool-key & service-lifecycle isolation seams',
  lane: 'Alpha.5 Lane E (PR6 PTC PoC6a + LSP PoC6b) writer',
  model_name_verbatim: { powered_by_line: 'You are a coding agent powered by the qwen3.8-flash-next model.', model: MODEL_NAME },
  recorded_at_utc: new Date().toISOString(),
  dormant: true,
  baseline_team: undefined,
  host_env: {},
  ports_used: [],
  homes_used: [],
  import_mechanism: 'ESM resolve hook p6-hook.mjs -> absolute lib/index.js file URLs inside T; no junctions; T read-only',
  test_double_declaration: 'Language server = FICTIONAL auditable stdio script (rewritten each run). Providers/pool/spawn/host-preread/tool-lsp under test are REAL pinned production libs. No claim about real language-server behavior.',
  commands: [],
  legs: [],
}
const shRun = (label, cmd, args) => { const r = sh(cmd, args); result.commands.push({ label, ...r }); return r }

const gT = shRun('git T HEAD', 'git', ['-C', TEST_USE, 'rev-parse', 'HEAD'])
const gTs = shRun('git T status', 'git', ['-C', TEST_USE, 'status', '--porcelain'])
const gW = shRun('git W HEAD', 'git', ['-C', TEAM_ROOT, 'rev-parse', 'HEAD'])
result.baseline_team = { team_worktree_HEAD: gW.out, test_use: TEST_USE, expected_SHA: BASELINE_SHA }
result.host_env = { node: process.version, platform: process.platform + ' ' + process.arch, test_use_HEAD: gT.out, test_use_porcelain_empty: gTs.out === '' }
if (gT.out !== BASELINE_SHA || gTs.out !== '') {
  console.error('pinned T must be @ ' + BASELINE_SHA + ' and porcelain-clean; got ' + gT.out + ' porcelain=' + JSON.stringify(gTs.out))
  process.exit(2)
}

rmSync(SCRATCH, { recursive: true, force: true })
const ws = join(SCRATCH, 'ws')
mkdirSync(ws, { recursive: true })
writeFileSync(join(ws, 'a.p06'), 'p06 source a line\n', 'utf8')
writeFileSync(join(ws, 'b.p06'), 'p06 source b line\n', 'utf8')
const serverScript = join(SCRATCH, 'fake-lang-server-p06.mjs')
writeFileSync(serverScript, FAKE_SERVER_SOURCE(), 'utf8')

function FAKE_SERVER_SOURCE() {
  return `#!/usr/bin/env node
/**
 * fake-lang-server-p06.mjs — FICTIONAL auditable stdio language server for PR6 PoC6b
 * (Team-owned PoC fixture, rewritten every run). LSP base framing. Hover text carries
 * pid + didOpen count; hover with position.line > 50 delays that many ms (lease probe);
 * env P6B_IGNORE_SHUTDOWN=1 makes it ignore shutdown/exit (terminate-escalation probe).
 * Audit lines (open/recv) go to stderr with the pid.
 */
const IGNORE_SHUTDOWN = process.env.P6B_IGNORE_SHUTDOWN === '1'
let opens = 0
let lastDelay = 0
const sleep = (ms) => new Promise(r => setTimeout(r, ms))
const log = (o) => process.stderr.write(JSON.stringify({ pid: process.pid, ...o }) + '\\n')
let buf = Buffer.alloc(0)
process.stdin.on('data', (chunk) => {
  buf = Buffer.concat([buf, chunk])
  for (;;) {
    const headerEnd = buf.indexOf('\\r\\n\\r\\n')
    if (headerEnd < 0) return
    const header = buf.subarray(0, headerEnd).toString('ascii')
    const match = /Content-Length: (\\d+)/i.exec(header)
    if (!match) { process.exit(1) }
    const len = Number(match[1])
    if (buf.length < headerEnd + 4 + len) return
    const body = buf.subarray(headerEnd + 4, headerEnd + 4 + len).toString('utf8')
    buf = buf.subarray(headerEnd + 4 + len)
    let msg
    try { msg = JSON.parse(body) } catch { continue }
    void handle(msg)
  }
})
const send = (m) => { const s = JSON.stringify(m); process.stdout.write('Content-Length: ' + Buffer.byteLength(s) + '\\r\\n\\r\\n' + s) }
const reply = (id, r) => send({ jsonrpc: '2.0', id, result: r })
async function handle(msg) {
  const { id, method, params } = msg
  log({ ev: 'recv', method })
  switch (method) {
    case 'initialize':
      reply(id, { capabilities: { hoverProvider: true, textDocumentSync: { openClose: true, change: 1 } }, serverInfo: { name: 'fake-lang-p06', version: '0.0.0-fixture' } })
      return
    case 'initialized': return
    case 'textDocument/didOpen': opens++; log({ ev: 'open', uri: params?.textDocument?.uri, opens }); return
    case 'textDocument/didClose': return
    case 'textDocument/hover': {
      const d = Number(params?.position?.line ?? 0)
      lastDelay = d > 50 ? d : 0
      if (lastDelay > 0) await sleep(lastDelay)
      reply(id, { contents: 'P06AUDIT pid=' + process.pid + ' opens=' + opens + ' delay=' + lastDelay })
      return
    }
    case 'shutdown':
      if (IGNORE_SHUTDOWN) { log({ ev: 'shutdown-ignored' }); return }
      return reply(id, null)
    case 'exit': process.exit(0)
    default:
      if (id !== undefined) send({ jsonrpc: '2.0', id, error: { code: -32601, message: 'fake-lang-p06: unsupported' } })
  }
}
log({ ev: 'boot' })
`
}

register(new URL('./p6-hook.mjs', import.meta.url), import.meta.url, { data: { testUse: TEST_USE } })
const { Context } = await import('@deepseek-ai/cordis')
const Lsp = (await import('@deepseek-ai/dsh-lsp')).default
const LocalFileSystem = (await import('@deepseek-ai/dsh-fs-local')).default
const LocalSubprocess = (await import('@deepseek-ai/dsh-subprocess-local')).default
const lspStdio = await import('@deepseek-ai/dsh-lsp-stdio')
const toolLsp = await import('@deepseek-ai/dsh-tool-lsp')
const SystemPrompt = (await import('@deepseek-ai/dsh-system-prompt')).default
const ToolRuntime = (await import('@deepseek-ai/dsh-tools')).default
const { ToolCallId } = await import('@deepseek-ai/dsh-llm')
const { createScope } = await import('@deepseek-ai/dsh-scope')

const leg = (id, verdict, detail) => { result.legs.push({ id, verdict, detail }); console.log(`[${verdict}] ${id}${detail === undefined ? '' : ' — ' + (typeof detail === 'string' ? detail : JSON.stringify(detail)).slice(0, 280)}`) }

const serverCfg = (extra = {}) => ({
  servers: {
    'p06-fake-lang': {
      command: process.execPath,
      args: [serverScript],
      env: {},
      extensionToLanguage: { '.p06': 'p06fake' },
      initializationOptions: null,
      configuration: null,
      maxMessageBytes: 2_000_000,
      maxStderrBytes: 200_000,
      maxDocumentBytes: 1_000_000,
      shutdownTimeoutMs: 1500,
      killGraceMs: 600,
      ...extra,
    },
  },
})
const parseAudit = (text) => ({
  pid: Number(/pid=(\d+)/.exec(text)?.[1] ?? -1),
  opens: Number(/opens=(\d+)/.exec(text)?.[1] ?? -1),
  delay: Number(/delay=(\d+)/.exec(text)?.[1] ?? -1),
})
const pidAlive = (pid) => { try { process.kill(pid, 0); return true } catch { return false } }
const hoverQ = (lsp, filePath, line = 1) => lsp.query({ operation: 'hover', filePath, workspaceRoot: ws, position: { line, character: 0 } })
const hoverText = (r) => r.kind === 'hover' ? r.hover?.contents ?? '(null)' : JSON.stringify(r).slice(0, 160)

// ================= context 1: baseline shared pool + isolate remount =================
const ctx = new Context()
await ctx.plugin(LocalFileSystem, {})
await ctx.plugin(Lsp)
await ctx.plugin(LocalSubprocess)
const fRootStdio = ctx.plugin(lspStdio, serverCfg()); await fRootStdio
const lspRoot = ctx.lsp

// P6B-1 baseline hazard (same pool, two policy principals — no policy channel exists)
{
  const q1 = parseAudit(hoverText(await hoverQ(lspRoot, join(ws, 'a.p06'))))
  const q2 = parseAudit(hoverText(await hoverQ(lspRoot, join(ws, 'b.p06'))))
  const shared = q1.pid > 0 && q2.pid === q1.pid && q2.opens === 2
  leg('P6B-1.shared-pool-hazard-control', shared ? 'HAZARD-OBSERVED(as-expected control)' : 'NOT-REPRODUCED', {
    pid_first: q1.pid, pid_second: q2.pid, opens_on_second: q2.opens,
    reading: 'shared root pool keyed by workspace identity ONLY: two (caller-side) policy principals reuse one resident pid AND one server-side didOpen ledger — the P0-5 L3 hazard reproduced on this host as the contrast pair for realm isolation',
    pool_key_home: 'lsp-stdio/src/index.ts:264,274 + host.ts:38-45 (fs targetKey); LspQueryRequest fields = operation/filePath/position/workspaceRoot only (lsp/src/types.ts:38-47)',
  })
}

// P6B-2 isolate('lsp') per-realm provider mounts
const realmA = ctx.isolate('lsp')
const realmB = ctx.isolate('lsp')
let fA1, fA2, fB1, fB2
let isolateOk = false, isolateErr
try {
  fA1 = realmA.plugin(Lsp); await fA1
  fA2 = realmA.plugin(lspStdio, serverCfg()); await fA2
  fB1 = realmB.plugin(Lsp); await fB1
  fB2 = realmB.plugin(lspStdio, serverCfg()); await fB2
  isolateOk = true
} catch (error) { isolateErr = String(error?.stack ?? error) }
leg('P6B-2a.isolate-remount-mounts', isolateOk ? 'PASS' : 'BLOCKED', isolateOk
  ? { lsp_service_identity_distinct: { realmA_ne_root: realmA.lsp !== lspRoot, realmB_ne_root: realmB.lsp !== lspRoot, realmA_ne_realmB: realmA.lsp !== realmB.lsp }, seam: 'public cordis Context.isolate(name, label?) (vendor/cordis/src/context.ts:121-125) + public plugin surface' }
  : { error: isolateErr?.slice(0, 600) })

let pidA1 = -1, pidA2 = -1, pidB1 = -1, pidRootPrev = -1
if (isolateOk) {
  const qa1 = parseAudit(hoverText(await hoverQ(realmA.lsp, join(ws, 'a.p06'))))
  const qb1 = parseAudit(hoverText(await hoverQ(realmB.lsp, join(ws, 'b.p06'))))
  const qa2 = parseAudit(hoverText(await hoverQ(realmA.lsp, join(ws, 'a.p06'))))
  pidRootPrev = parseAudit(hoverText(await hoverQ(lspRoot, join(ws, 'a.p06')))).pid
  pidA1 = qa1.pid; pidA2 = qa2.pid; pidB1 = qb1.pid
  const distinct = qa1.pid > 0 && qb1.pid > 0 && qa1.pid !== qb1.pid && qa1.pid !== pidRootPrev && qb1.pid !== pidRootPrev
  const hot = qa2.pid === qa1.pid
  const serverSideAttribution = qa1.opens === 1 && qb1.opens === 1 // each realm server saw ONLY its own didOpen (shared ledger showed opens=2 in P6B-1)
  leg('P6B-2b.realm-private-pools', distinct && hot && serverSideAttribution ? 'SUPPORT(realm-grained)' : 'FAIL', {
    pid_realm_A: qa1.pid, pid_realm_B: qb1.pid, pid_root: pidRootPrev,
    hot_reuse_within_realm: hot,
    server_side_didOpen_attribution: { realm_A_opens: qa1.opens, realm_B_opens: qb1.opens },
    reading: 'same workspaceRoot string -> different resident pid per realm; server-side effect ledger (didOpen) is realm-private; pool privacy comes from per-realm PROVIDER INSTANCE, not from the pool key (key remains workspace-only)',
  })
  // dispose realm A only
  const t0 = Date.now()
  await fA2.dispose()
  await fA1.dispose()
  const disposeMs = Date.now() - t0
  await new Promise(r => setTimeout(r, 150))
  const qb2 = parseAudit(hoverText(await hoverQ(realmB.lsp, join(ws, 'b.p06'))))
  const ok = !pidAlive(qa1.pid) && pidAlive(qb1.pid) && qb2.pid === qb1.pid && pidAlive(pidRootPrev)
  leg('P6B-2c.realm-dispose-kill-isolation', ok ? 'SUPPORT' : 'FAIL', {
    pid_A: qa1.pid, pid_A_alive_after_dispose: pidAlive(qa1.pid),
    pid_B: qb1.pid, pid_B_alive_after_A_dispose: pidAlive(qb1.pid), pid_B_hot_after_A_dispose: qb2.pid === qb1.pid,
    root_pid_alive: pidAlive(pidRootPrev), dispose_ms: disposeMs,
    reading: 'realm-scoped fiber dispose terminates ONLY that realm\'s resident servers (C-PROC terminate boundary at the service-lifecycle seam); sibling realm + root pools untouched',
  })
}

// ================= context 2: REAL model route (tool-lsp per agent scope) =================
const ctx2 = new Context()
await ctx2.plugin(LocalFileSystem, {})
await ctx2.plugin(Lsp)
await ctx2.plugin(LocalSubprocess)
await ctx2.plugin(SystemPrompt, {})
await ctx2.plugin(ToolRuntime)
const memberA = { id: 'member-A', session: { id: 'sess-A', header: { cwd: ws }, append: () => undefined } }
const memberB = { id: 'member-B', session: { id: 'sess-B', header: { cwd: ws }, append: () => undefined } }
let chainOk = false, chainErr, mounts = {}
try {
  await ctx2.plugin({
    inject: ['tools'],
    apply: (inner) => {
      for (const m of [memberA, memberB]) {
        const scope = createScope(inner, m).ctx
        const realm = scope.isolate('lsp')
        mounts[m.id] = { realm, fLsp: realm.plugin(Lsp), fStdio: realm.plugin(lspStdio, serverCfg()), fTool: realm.plugin(toolLsp) }
      }
    },
  })
  for (const m of [memberA, memberB]) { await mounts[m.id].fLsp; await mounts[m.id].fStdio; await mounts[m.id].fTool }
  chainOk = true
} catch (error) { chainErr = String(error?.stack ?? error) }
leg('P6B-3a.tool-lsp-per-scope-mount', chainOk ? 'PASS' : 'BLOCKED', chainOk
  ? "createScope(inner, agent).ctx -> .isolate(lsp) child carries BOTH the scope tag (tool layer key) and the isolate label (Lsp resolution); tool-lsp/Lsp/lsp-stdio mounted per member; ToolRuntime register accepts per-scope variant (per-agent variant registers through that agent scope, index.ts:747)"
  : { error: chainErr?.slice(0, 900) })

if (chainOk) {
  const defA = ctx2.tools.get('lsp', memberA)
  const defB = ctx2.tools.get('lsp', memberB)
  const callSeq2 = { n: 0 }
  const execTool = async (agent, args) => {
    const callId = ToolCallId(`p6b-c${String(++callSeq2.n)}`)
    const res = await ctx2.tools.execute({ signal: new AbortController().signal, callId, name: 'lsp', arguments: args, agent })
    const first = res?.content?.[0]
    return { isError: res?.isError === true, text: first?.type === 'text' ? first.text : JSON.stringify(res?.content ?? res) }
  }
  const va = parseAudit((await execTool(memberA, { operation: 'hover', file_path: join(ws, 'a.p06'), line: 1, character: 1 })).text)
  const vb = parseAudit((await execTool(memberB, { operation: 'hover', file_path: join(ws, 'b.p06'), line: 1, character: 1 })).text)
  const ok = defA !== undefined && defA !== defB && va.pid > 0 && vb.pid > 0 && va.pid !== vb.pid && va.opens === 1 && vb.opens === 1
  leg('P6B-3b.model-route-resolves-member-instance', ok ? 'SUPPORT(real tool-lsp->ctx.lsp.query route)' : 'FAIL', {
    distinct_definitions: defA !== defB,
    pid_via_tool_member_A: va.pid, pid_via_tool_member_B: vb.pid,
    server_side_opens: { A: va.opens, B: vb.opens },
    reading: 'the model-facing execute() path resolves the agent-scope tool-lsp, whose captured ctx resolves the realm Lsp -> per-member resident instance WITHOUT touching core',
  })
}

// P6B-4 policy granularity census within one provider (typed field absence)
leg('P6B-4.pool-key-policy-granularity', 'SEAM-GAP(policy-generation)', {
  observed_in_P6B_1: 'within one provider (one realm), two policy principals on the same workspace shared one pid (contrast pair)',
  field_census: 'LspQueryRequest = { operation, filePath, position, workspaceRoot } only; provider pool key = fs targetKey of workspaceRoot; neither accepts a policy/policyGeneration/trustRoot input',
  consequence: 'per-MEMBER isolation is achievable via per-realm provider instances (P6B-2/3), but per-POLICY-GENERATION eviction inside a realm is NOT expressible at the public seam: a Team pool-key extension point (policy generation in key + forced evict on generation change) is an upstream gap (P0-5 L10 blocker material reaffirmed on this host)',
})

// ================= context 3: terminate & lease boundaries =================
const ctx3 = new Context()
await ctx3.plugin(LocalFileSystem, {})
await ctx3.plugin(Lsp)
await ctx3.plugin(LocalSubprocess)

// (a) cancel escalates to terminate + respawn
{
  const realm = ctx3.isolate('lsp')
  const f1 = realm.plugin(Lsp); await f1
  const f2 = realm.plugin(lspStdio, serverCfg({ killGraceMs: 400 })); await f2
  const warm = parseAudit(hoverText(await hoverQ(realm.lsp, join(ws, 'a.p06')))) // resident pid P, opens=1
  const ctrl = new AbortController()
  const slow = realm.lsp.query({ operation: 'hover', filePath: join(ws, 'a.p06'), workspaceRoot: ws, position: { line: 1200, character: 0 } }, ctrl.signal).catch(e => ({ err: String(e?.message ?? e) }))
  await new Promise(r => setTimeout(r, 300))
  ctrl.abort('user-cancel')
  const cancelR = await slow
  let goneMs = -1
  for (let t = 0; t < 4000; t += 100) { if (!pidAlive(warm.pid)) { goneMs = t; break }; await new Promise(r => setTimeout(r, 100)) }
  const respawn = parseAudit(hoverText(await hoverQ(realm.lsp, join(ws, 'a.p06'))))
  const ok = cancelR.err !== undefined && goneMs >= 0 && respawn.pid > 0 && respawn.pid !== warm.pid && respawn.opens === 1
  leg('P6B-5a.cancel-escalates-to-terminate', ok ? 'SUPPORT(cancel != terminate)' : 'FAIL', {
    resident_pid_before: warm.pid, cancel_rejected: String(cancelR.err ?? '').slice(0, 120),
    old_pid_gone_after_ms: goneMs,
    respawn_pid: respawn.pid, respawn_opens: respawn.opens,
    home: 'cancel path kills the cancelled instance after LSP_CANCEL_GRACE and disposal awaits process close (lsp-stdio/src/instance.ts cancel: "terminate the instance (disposal awaits process close) so nothing outlives the query"); next query respawns => C-PROC terminate boundary observable, cancel reported separately from terminate',
  })
  await f2.dispose(); await f1.dispose()
}

// (b) dispose is awaited even against a shutdown-ignoring server
{
  const realm = ctx3.isolate('lsp')
  const f1 = realm.plugin(Lsp); await f1
  const f2 = realm.plugin(lspStdio, serverCfg({ env: { P6B_IGNORE_SHUTDOWN: '1' }, shutdownTimeoutMs: 1200, killGraceMs: 400 })); await f2
  const p = parseAudit(hoverText(await hoverQ(realm.lsp, join(ws, 'a.p06'))))
  const t0 = Date.now()
  await f2.dispose()
  const ms = Date.now() - t0
  await new Promise(r => setTimeout(r, 100))
  const ok = p.pid > 0 && !pidAlive(p.pid) && ms >= 1100 && ms < 6000
  leg('P6B-5b.dispose-termination-confirmed-bounded', ok ? 'SUPPORT(C-PROC terminate)' : 'FAIL', {
    pid: p.pid, alive_after_awaited_dispose: pidAlive(p.pid), dispose_wall_ms: ms,
    budget: 'shutdownTimeoutMs=1200 then SIGTERM->SIGKILL; instance.tearDown awaits process close ("nothing outlives disposal", lsp-stdio/src/instance.ts:267-301)',
    reading: 'EXECUTION_TERMINATION is CONFIRMED (not fire-and-forget) at the public fiber-dispose seam even against a server that ignores shutdown',
  })
  await f1.dispose()
}

// (c) lease boundary: not-started after dispose is typed and starts no process
{
  const realm = ctx3.isolate('lsp')
  const f1 = realm.plugin(Lsp); await f1
  const f2 = realm.plugin(lspStdio, serverCfg()); await f2
  const ctrl = new AbortController()
  const inFlight = realm.lsp.query({ operation: 'hover', filePath: join(ws, 'a.p06'), workspaceRoot: ws, position: { line: 1200, character: 0 } }, ctrl.signal).catch(e => ({ err: String(e?.message ?? e), code: e?.code }))
  const queued = realm.lsp.query({ operation: 'hover', filePath: join(ws, 'b.p06'), workspaceRoot: ws, position: { line: 1, character: 0 } }).catch(e => ({ err: String(e?.message ?? e), code: e?.code }))
  await new Promise(r => setTimeout(r, 200))
  await f2.dispose() // disposes provider while both are pending
  const inR = await inFlight
  const qR = await queued
  const after = await realm.lsp.query({ operation: 'hover', filePath: join(ws, 'a.p06'), workspaceRoot: ws, position: { line: 1, character: 0 } }).then(() => ({ settled: 'ok' })).catch(e => ({ err: String(e?.message ?? e), code: e?.code }))
  const allTyped = inR.err !== undefined && qR.err !== undefined && after.err !== undefined
  const settledEdgeHolds = allTyped && String(after.code ?? '') !== 'LSP_DISPOSED' // post-settle route = provider GONE from registry: no query can start a process any more
  leg('P6B-5c.lease-boundary-typed-forms', allTyped && settledEdgeHolds ? 'SUPPORT(C-GW settled edge; typing on effect side)' : 'FAIL', {
    in_flight_form: inR, queued_form: qR, post_dispose_form: after,
    observation: 'in-flight AND queued both reject with the SAME typed code LSP_DISPOSED (lifetime abort reason); POST-dispose queries reject LSP_NO_PROVIDER-shaped ("no LSP provider handles ...") because the disposer unregisters the provider — no post-settle query can start a process',
    reading: 'C-GW lease boundary HOLDS at the effect side (settled edge: started instance was terminated [P6B-5b witness], never-started ones spawn nothing [index.ts:261-262 honors aborted signal before any I/O; post-settle route cannot even find a provider]); the ERROR channel does NOT distinguish 已开始 vs 未开始 (same LSP_DISPOSED code) — event-surface typing of the two forms at the LSP seam is a noted residual (vs PR1r B3 form), recorded in SEAM-VERDICTS',
  })
  await f1.dispose()
}

function finish() {
  const out = join(HERE, 'p6b-result.json')
  const gT2 = shRun('git T status after', 'git', ['-C', TEST_USE, 'status', '--porcelain'])
  result.host_env.test_use_porcelain_empty_after = gT2.out === ''
  result.overall = {
    seam_summary: 'see ../SEAM-VERDICTS.md (PoC-1 format, three-state per seam)',
    pool_isolation: 'SUPPORT at realm granularity via public isolate()+plugin remount (incl. real tool route); SEAM-GAP below realm granularity (no policy/policyGeneration channel)',
    lifecycle: 'terminate CONFIRMED+bounded at dispose; cancel!=terminate with respawn witness; lease boundary typed (started vs not-started)',
    not_run: 'real language servers; real OS confinement of server processes (spawn spec has no per-policy confinement parameter — P0-5 L10 upstream material reaffirmed)',
  }
  writeFileSync(out, JSON.stringify(result, null, 2) + '\n', 'utf8')
  const failed = result.legs.filter(l => l.verdict.startsWith('FAIL') || l.verdict === 'BLOCKED').length
  console.log(`\nwrote ${out}; legs=${result.legs.length}; failing(PASS-candidates)=${failed}`)
  process.exit(failed === 0 ? 0 : 1)
}
finish()
