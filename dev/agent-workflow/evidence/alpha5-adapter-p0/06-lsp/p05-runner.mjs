#!/usr/bin/env node
/**
 * p05-runner.mjs — Alpha.5 P0-5 LSP leg (06-lsp) runner. Team-owned, PoC only. IDEMPOTENT:
 * safe to re-run; rewrites ./probe-scratch/ and ./p05-result.json.
 *
 * WHAT THIS IS / IS NOT (honesty discipline, plan §1.2, §3 P0-5 LSP):
 *  - The provider/pool/spawn code under test is the REAL pinned production lib
 *    (@deepseek-ai/dsh-lsp-stdio built lib of pristine T @639ed01539), mounted through the
 *    public plugin surface on a plain-node cordis Context with fs-local + subprocess-local.
 *  - The language server is a FICTIONAL, fully auditable stdio server (fake-lang-server.mjs,
 *    written by this runner into probe-scratch/): it echoes initialize/shutdown, reports its
 *    OS pid, counts didOpen events, probes file reads, and answers the custom request
 *    `$/p05ReadProbe` by attempting to read the requested path (success/failure logged).
 *    NO real language server is used. NO claim is made that this equals a real LSP server's
 *    behavior — the observed REUSE/POOLING behavior is the real provider code path, the
 *    SERVER PROCESS BEHAVIOR is the fiction.
 *  - The environment has no per-agent/per-policy ctx.lsp composition and no OS confinement:
 *    the "two ACL policies" are simulated by CALLER-SIDE policy labels because the public
 *    seam has no channel to carry them (that absence is the finding, not a fixture shortcut).
 *  - Import mechanism: ESM resolve hook (../05-ptc/p05-ai-hook.mjs) mapping @deepseek-ai/*
 *    to absolute lib/index.js file URLs inside T. No new W/node_modules junctions; T read-only.
 */
import { spawnSync } from 'node:child_process'
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { register } from 'node:module'

const HERE = dirname(fileURLToPath(import.meta.url))
const WORKTREE_ROOT = resolve(HERE, '..', '..', '..', '..', '..')
const TEST_USE = join(WORKTREE_ROOT, 'tests', 'deepseek-harness-test-use')
const SCRATCH = join(HERE, 'probe-scratch')
const MODEL_NAME = 'qwen3.8-flash-next'

const sh = (cmd, args) => { const r = spawnSync(cmd, args, { encoding: 'utf8' }); return { cmd: [cmd, ...args].join(' '), code: r.status, out: (r.stdout ?? '').trim(), err: (r.stderr ?? '').trim() } }

const result = {
  leg: '06-lsp (P0-5 LSP leg)',
  agent: 'independent experimenter (not the coordinator)',
  model_name_verbatim: { powered_by_line: 'You are a coding agent powered by the qwen3.8-flash-next model.', model: MODEL_NAME },
  recorded_at_utc: new Date().toISOString(),
  host_env: {},
  import_mechanism: 'ESM resolve hook 05-ptc/p05-ai-hook.mjs → absolute lib/index.js file URLs inside T; no new junctions; T read-only',
  test_double_declaration: 'Language server = FICTIONAL auditable stdio script (probe-scratch/fake-lang-server.mjs), NOT a real language server. Provider/pool/spawn/host-preload code under test is the REAL @deepseek-ai/dsh-lsp-stdio pinned lib. Per-agent/per-policy simulation is caller-side policy labels ONLY, because LspQueryRequest has no policy/agent channel (that is the finding).',
  commands: [],
  legs: [],
}
const shRun = (label, cmd, args) => { const r = sh(cmd, args); result.commands.push({ label, ...r }); return r }

const gT = shRun('git T HEAD', 'git', ['-C', TEST_USE, 'rev-parse', 'HEAD'])
const gTs = shRun('git T status', 'git', ['-C', TEST_USE, 'status', '--porcelain'])
const gW = shRun('git W HEAD', 'git', ['-C', WORKTREE_ROOT, 'rev-parse', 'HEAD'])
result.host_env = { node: process.version, platform: process.platform + ' ' + process.arch, test_use_HEAD: gT.out, test_use_porcelain_empty: gTs.out === '', worktree_HEAD: gW.out }

// ---------- fixture tree (fabricated data only) ----------
rmSync(SCRATCH, { recursive: true, force: true })
const ws = join(SCRATCH, 'ws')
const ws2 = join(SCRATCH, 'ws2')
const forbiddenDir = join(SCRATCH, 'forbidden')
mkdirSync(ws, { recursive: true }); mkdirSync(ws2, { recursive: true }); mkdirSync(forbiddenDir, { recursive: true })
writeFileSync(join(ws, 'a.p05'), 'hello p05 source line\n', 'utf8')
writeFileSync(join(ws2, 'b.p05'), 'second workspace source\n', 'utf8')
const secretFile = join(forbiddenDir, 'secret.txt')
writeFileSync(secretFile, 'P05-FABRICATED-SECRET-NOT-REAL-DATA\n', 'utf8')
const serverScript = join(SCRATCH, 'fake-lang-server.mjs')
writeFileSync(serverScript, FAKE_SERVER_SOURCE(), 'utf8')

function FAKE_SERVER_SOURCE() {
  return `#!/usr/bin/env node
/**
 * fake-lang-server.mjs — FICTIONAL, fully auditable stdio language server for Alpha.5 P0-5
 * LSP-01 evidence (Team-owned PoC fixture; rewritten by 06-lsp/p05-runner.mjs on every run).
 * Protocol: LSP base framing (Content-Length). Reports its own OS pid, counts didOpen,
 * probes file reads at initialize time (boot probes), and answers the custom request
 * "$/p05ReadProbe" by attempting an os-level read of params.path and returning the outcome.
 * All probes go to stderr (audit log) AND into structured responses (observation channel).
 */
import { readFileSync } from 'node:fs'

const probe = (path) => {
  if (typeof path !== 'string' || path === '') return { path: String(path), ok: false, code: 'NO_PATH' }
  try {
    const buf = readFileSync(path)
    return { path, ok: true, bytes: buf.length, head: buf.subarray(0, 24).toString('utf8') }
  } catch (error) { return { path, ok: false, code: String(error && error.code || error) } }
}

const bootForbidden = probe(process.env.P05_FORBIDDEN)   // expected-under-strict-ACL DENIED; reality recorded as-is
const bootAllowed = probe(process.env.P05_ALLOWED)       // positive control, expected READ_OK
const customProbes = []
let opens = 0
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
    handle(msg)
  }
})

const send = (m) => { const s = JSON.stringify(m); process.stdout.write('Content-Length: ' + Buffer.byteLength(s) + '\\r\\n\\r\\n' + s) }
const reply = (id, r) => send({ jsonrpc: '2.0', id, result: r })

function handle(msg) {
  const { id, method, params } = msg
  log({ ev: 'recv', method })
  switch (method) {
    case 'initialize':
      reply(id, {
        capabilities: { hoverProvider: true, textDocumentSync: { openClose: true, change: 1 } },
        serverInfo: { name: 'fake-lang-p05', version: '0.0.0-fixture' },
      })
      return
    case 'initialized': return
    case 'textDocument/didOpen': opens++; log({ ev: 'open', uri: params?.textDocument?.uri, opens }); return
    case 'textDocument/didClose': return
    case 'textDocument/hover':
      reply(id, { contents: 'P05AUDIT pid=' + process.pid + ' opens=' + opens +
        ' boot_forbidden=' + JSON.stringify(bootForbidden) +
        ' boot_allowed=' + JSON.stringify(bootAllowed) +
        ' custom_probes=' + JSON.stringify(customProbes) })
      return
    case '$/p05ReadProbe': {
      const outcome = probe(params && params.path)
      customProbes.push(outcome)
      log({ ev: 'p05ReadProbe', ...outcome })
      reply(id, outcome)
      return
    }
    case 'shutdown': return reply(id, null)
    case 'exit': process.exit(0)
    default:
      if (id !== undefined) send({ jsonrpc: '2.0', id, error: { code: -32601, message: 'fake-lang-p05: unsupported ' + method } })
  }
}
log({ ev: 'boot', bootForbidden, bootAllowed })
`
}

// ---------- module loading through the hook ----------
register(new URL('../05-ptc/p05-ai-hook.mjs', import.meta.url), import.meta.url, { data: { testUse: TEST_USE } })
const { Context } = await import('@deepseek-ai/cordis')
const Lsp = (await import('@deepseek-ai/dsh-lsp')).default
const LocalFileSystem = (await import('@deepseek-ai/dsh-fs-local')).default
const LocalSubprocess = (await import('@deepseek-ai/dsh-subprocess-local')).default
const lspStdio = await import('@deepseek-ai/dsh-lsp-stdio')
const { LspConnection } = lspStdio

const leg = (id, verdict, detail) => { result.legs.push({ id, verdict, detail }); console.log(`[${verdict}] ${id}${detail === undefined ? '' : ' — ' + (typeof detail === 'string' ? detail : JSON.stringify(detail)).slice(0, 280)}`) }

// ---------- L0: static judgment on the public package root (S-11 path = lsp-stdio) ----------
leg('P05-LSP-0.static-judgment', 'CONFIRMED-CODEPATH', {
  public_package_roots: { 'ctx.lsp service definition + registry': 'T/packages/lsp/lsp (lib/index.js)', 'stdio provider': 'T/packages/lsp/lsp-stdio (lib/index.js)', 'model tool': 'T/packages/lsp/tool-lsp (lib/index.js)' },
  per_provider_workspace_resident_pool: 'YES — one plugin instance registers one provider per config entry (lsp-stdio/src/index.ts:126-186); "One live instance per stable canonical workspace identity" Map<WorkspaceKey, LspInstance> (index.ts:220-221); get-or-create instanceFor (index.ts:331-339); server process persists across queries (idle-pool note index.ts:277-278); teardown only on provider disposal (index.ts:364-380)',
  ctx_subprocess_spawn_launch: 'YES — provider built with spec => ctx.subprocess.spawn(spec) (index.ts:157); LspConnection spawns argv [command,...args] cwd=canonical workspace, piped stdio (connection.ts:92-104); inject = [fs, lsp, subprocess] (index.ts:47)',
  host_prereads_filePath: 'YES — per query the host reads the FULL source through ctx.fs BEFORE any spawn: readHostSource → fs.streamText (host.ts:72-120, stream at :99), called at index.ts:279 inside the per-workspace queue; workspace canonicalization also via ctx.fs (host.ts:32-59)',
  pooling_key_composition: 'key = workspace.target.targetKey, i.e. fs.resolve(workspaceRoot) filesystem identity ONLY (index.ts:264 + :274 + host.ts:38-45). LspQueryRequest fields = operation/filePath/position/workspaceRoot (lsp/src/types.ts:38-47): NO agent, NO scope, NO policy/policy-generation field. Lsp service is one context-global registry (lsp/src/index.ts:82-88, query routes by extension :143-149). tool-lsp passes workspaceRoot=sessionCwd(exec) and no caller identity (tool-lsp/src/index.ts:183-194).',
  server_side_io_surface: 'Server process does its own OS-level I/O (workspace/config/index files) with the rights of the harness subprocess provider; no ctx.fs mediation and no confine parameter on the spawn spec; server→client requests are limited to configuration/lifecycle-noop, workspace/applyEdit rejected (instance.ts:247-264) — documented, and NOT a whole-process read-only proof (guide §3 P0-5).',
})

// ---------- mount the real stack ----------
let mounted = false, mountError
const ctx = new Context()
try {
  await ctx.plugin(LocalFileSystem, {})
  await ctx.plugin(Lsp)
  await ctx.plugin(LocalSubprocess)
  await ctx.plugin(lspStdio, {
    servers: {
      'p05-fake-lang': {
        command: process.execPath,
        args: [serverScript],
        env: { P05_FORBIDDEN: secretFile, P05_ALLOWED: join(ws, 'a.p05') },
        extensionToLanguage: { '.p05': 'p05fake' },
        initializationOptions: null,
        configuration: null,
        maxMessageBytes: 2_000_000,
        maxStderrBytes: 200_000,
        maxDocumentBytes: 1_000_000,
        shutdownTimeoutMs: 2000,
        killGraceMs: 1000,
      },
    },
  })
  mounted = true
} catch (error) { mountError = String(error?.stack ?? error) }
leg('P05-LSP-1.full-stack-mount', mounted ? 'PASS' : 'BLOCKED', mounted
  ? 'public plugin surface: ctx.plugin(fs-local)+ctx.plugin(Lsp)+ctx.plugin(subprocess-local)+ctx.plugin(lsp-stdio ns plugin, {servers}) — namespace plugin with inject [fs, lsp, subprocess]'
  : { error: mountError?.slice(0, 1500) })

const hoverOf = (r) => r.kind === 'hover' ? r.hover?.contents ?? '(null hover)' : JSON.stringify(r).slice(0, 160)
const parseAudit = (text) => {
  const pid = /pid=(\d+)/.exec(text)?.[1]
  const opens = /opens=(\d+)/.exec(text)?.[1]
  const slice = (from, to) => { const i = text.indexOf(from); if (i < 0) return undefined; const start = i + from.length; const j = to === null ? text.length : text.indexOf(to, start); return text.slice(start, j < 0 ? text.length : j) }
  const j = (from, to) => { const s = slice(from, to); try { return s === undefined ? undefined : JSON.parse(s) } catch { return { parse_error: s } } }
  return {
    pid: pid === undefined ? undefined : Number(pid),
    opens: opens === undefined ? undefined : Number(opens),
    boot_forbidden: j('boot_forbidden=', ' boot_allowed='),
    boot_allowed: j('boot_allowed=', ' custom_probes='),
    custom_probes: j('custom_probes=', null),
  }
}
const pidAlive = (pid) => { try { process.kill(pid, 0); return true } catch { return false } }

if (mounted) {
  // ---------- L2: first hover (spawn + host pre-read + boot probes) ----------
  const q1 = await ctx.lsp.query({ operation: 'hover', filePath: join(ws, 'a.p05'), workspaceRoot: ws, position: { line: 0, character: 0 } })
  const a1 = parseAudit(hoverOf(q1))
  leg('P05-LSP-2.first-query', a1.pid !== undefined && a1.boot_allowed?.ok === true ? 'PASS' : 'FAIL', {
    hover: hoverOf(q1).slice(0, 400), pid: a1.pid,
    host_pre_read_evidence: 'provider read a.p05 via ctx.fs BEFORE spawn (index.ts:279; host.ts:99) — hover answered from host-supplied didOpen text',
    boot_allowed_positive_control: a1.boot_allowed,
    boot_forbidden_observation: a1.boot_forbidden,
  })

  // ---------- L3: same workspace root string, different (caller-side) ACL policy ----------
  // Simulated principals: agent A (policy: read-allowed workspace only), agent B (policy: STRICTER read ACL).
  // The public seam has no channel for the policy, so both principals call the identical
  // ctx.lsp.query with the identical workspaceRoot — exactly the plan §3 P0-5 hazard pair
  // ("两个 Agent 同名 Workspace 但不同 Read ACL 不能复用危险实例").
  const q2 = await ctx.lsp.query({ operation: 'hover', filePath: join(ws, 'a.p05'), workspaceRoot: ws, position: { line: 0, character: 0 } })
  const a2 = parseAudit(hoverOf(q2))
  const shared = a2.pid !== undefined && a2.pid === a1.pid && a2.opens === a1.opens + 1
  leg('P05-LSP-3.same-path-different-policy-shared-server', shared ? 'HAZARD-OBSERVED' : 'NOT-REPRODUCED', {
    pid_A: a1.pid, pid_B: a2.pid, opens_B_after_second_query: a2.opens,
    reading: 'two policy principals whose workspaceRoot strings are identical share ONE resident server process (same pid), and the share key cannot contain policy because LspQueryRequest carries no policy/agent field (types.ts:38-47; pool key index.ts:274 → targetKey only)',
    hazard: 'the shared process runs with the OS rights captured at ITS spawn (plain ctx.subprocess, index.ts:157); a stricter later caller inherits the first spawn\u2019s capabilities; server-side boot probe below shows its reads are not ctx.fs-mediated',
  })

  // ---------- L4: forbidden-read observation (server side, not host side) ----------
  const forb = a2.boot_forbidden
  leg('P05-LSP-4.server-side-read-probe', forb !== undefined ? (forb.ok === true ? 'UNCONFINED-READ-OBSERVED' : 'READ-DENIED-BY-OS') : 'FAIL', {
    positive_control_allowed_read: a2.boot_allowed,
    forbidden_read_by_server_process: forb,
    meaning: 'the FICTIONAL server (standing in for any persistent language server) read the fixture-forbidden file with plain OS rights during initialize; nothing on the ctx.lsp/lsp-stdio path intercepted or mediated this read; host-side readHostSource containment (host.ts:91) constrains only the HOST pre-read, never the server process',
    fixture_secret_only: 'content is fabricated (P05-FABRICATED-SECRET); no real data involved',
  })

  // ---------- L5: distinct workspace gets its own server (pool granularity positive control) ----------
  const q3 = await ctx.lsp.query({ operation: 'hover', filePath: join(ws2, 'b.p05'), workspaceRoot: ws2, position: { line: 0, character: 0 } })
  const a3 = parseAudit(hoverOf(q3))
  leg('P05-LSP-5.distinct-workspace-distinct-server', a3.pid !== undefined && a3.pid !== a1.pid ? 'PASS' : 'FAIL', { pid_ws: a1.pid, pid_ws2: a3.pid, note: 'pool granularity = per canonical workspace; proves L3 sharing is key-driven, not a single-process accident' })

  // ---------- L6: custom method over the real spawn seam (ctx.lsp has no protocol escape hatch) ----------
  const serverRequestLog = []
  const conn = new LspConnection({
    command: process.execPath, args: [serverScript], cwd: ws,
    env: { P05_FORBIDDEN: secretFile }, maxMessageBytes: 2_000_000, maxStderrBytes: 200_000,
    killGraceMs: 1000, configuration: null,
  }, (spec) => { serverRequestLog.push({ argv: spec.argv, cwd: spec.cwd }); return ctx.subprocess.spawn(spec) },
    async () => null)
  const custom = await conn.request('$/p05ReadProbe', { path: secretFile }).catch(e => ({ ok: false, code: 'REQUEST_FAILED', message: String(e?.message ?? e) }))
  conn.terminate()
  await conn.closed.catch(() => {})
  leg('P05-LSP-6.custom-method-read-probe', custom !== undefined ? (custom.ok === true ? 'SERVER-READS-ARBITRARY-PATH' : 'READ-DENIED') : 'FAIL', {
    ctx_lsp_seam_fact: 'ctx.lsp exposes exactly 4 semantic operations and no JSON-RPC escape hatch (lsp/src/index.ts:9-10 doc; types.ts:5-6) — the arbitrary-method path exists at the connection/provider level a production provider may use; used here via the package-root exported LspConnection with the REAL ctx.subprocess.spawn',
    spawn_observations: serverRequestLog,
    custom_method_outcome: custom,
  })

  // ---------- L7: policy→server-key design demo (risk-point demonstration) ----------
  const keyOf = async (workspaceRoot) => (await ctx.fs.resolve(workspaceRoot, {})).targetKey
  const principal = (label, policy) => ({ label, policy })
  const A = principal('team-agent-A', { read: ['ws/**'] })
  const B = principal('team-agent-B', { read: [] }) // stricter ACL
  const keyA = await keyOf(ws)
  const keyB = await keyOf(ws)
  const demo = {
    as_built_key: 'key = canonical workspace targetKey (path identity)',
    keyA, keyB, equal: keyA === keyB,
    consequence: 'keyA === keyB while policy(A) !== policy(B): a policy→server map built this way MUST reuse one server for different ACLs (matches observed L3)',
    minimal_safe_key_direction: 'serverKey must include (policyGeneration, executionRealm, providerId) — none of which is derivable from LspQueryRequest today; therefore not implementable at the seam without upstream surface (see P05-LSP-9)',
  }
  leg('P05-LSP-7.policy-to-key-demo', demo.equal ? 'DANGEROUS-SHARING-CODEPATH-SHOWN' : 'FAIL', demo)

  // ---------- L8: teardown leaves no residual server ----------
  const pids = [a1.pid, a3.pid].filter(p => p !== undefined)
  const aliveBefore = pids.map(p => pidAlive(p))
  await ctx.fiber.dispose()
  await new Promise(r => setTimeout(r, 300))
  const aliveAfter = pids.map(p => pidAlive(p))
  leg('P05-LSP-8.teardown-no-residual', aliveBefore.every(Boolean) && aliveAfter.every(a => a === false) ? 'PASS' : 'FAIL', { pids, alive_before: aliveBefore, alive_after_dispose: aliveAfter, note: 'bounded to the fictional servers; ctx.fiber disposal runs the lsp-stdio effect disposer (index.ts:179-185) → disposeAll shutdown/exit/terminate' })
}

// ---------- L9: PTC-01-style NOT_RUN + CORE_SEAM_BLOCKER material (§6.1) ----------
leg('P05-LSP-9.not-run-items', 'NOT_RUN', {
  real_host_per_agent_ctx_lsp: 'INCONCLUSIVE (needs real pinned host + per-Agent ctx.lsp composition; none exists in pinned 0.2.0-rc.2: Lsp is a single context-global service)',
  real_language_server_reuse: 'NOT_RUN (fictional server used; typescript-language-server or similar not exercised — reuse/pool behavior observed here is provider-code-path behavior)',
  policy_rebind_server_restart: 'NOT_RUN/UNEXPRESSIBLE (there is no policy input to rebind: the scenario cannot be expressed at the public seam at all — see blocker)',
  apply_edit_rejection_full_readonly: 'CODEPATH-ONLY (instance.ts:259-261 rejects workspace/applyEdit; per guide this is NOT a whole-process read-only proof; L4 shows the server reads directly)',
})

const blocker = {
  type: 'CORE_SEAM_BLOCKER (candidate — filed as material; P0-6/Gate adjudication owns final classification)',
  hostSHA: '639ed015397290b3745d163aafe02ffee4aa3f84',
  publicSeam: 'ctx.lsp (packages/lsp/lsp/src/types.ts LspQueryRequest/LspService) + @deepseek-ai/dsh-lsp-stdio provider pooling (src/index.ts:220-221, 260-315, 331-339) + ctx.subprocess spawn (src/index.ts:157)',
  requiredBehavior: 'per-Agent / per-policy binding of a resident language-server process: (a) the pool key must include the caller\u2019s policy generation / execution realm, (b) the spawn must accept per-policy confinement parameters, (c) a policy change must be able to force server eviction + respawn (guide §3 P0-5 LSP, §4 LSP-01)',
  observedBehavior: 'pool key = canonical workspace targetKey only; LspQueryRequest carries no agent/scope/policy field; one context-global Lsp service; provider spawns through plain ctx.subprocess with fixed configured env/argv; fictional server demonstrably read a fixture-forbidden file with OS rights (P05-LSP-4/6), and two policy principals sharing the workspaceRoot string shared one resident pid (P05-LSP-3)',
  minimalReproducer: 'dev/agent-workflow/evidence/alpha5-adapter-p0/06-lsp/p05-runner.mjs legs P05-LSP-3/4/6/7 (node p05-runner.mjs; deterministic; no model key, no host server)',
  affectedInvariant: 'INV-1 coverage, INV-2 exclusivity (server outlives per-caller policy), INV-5 real I/O (server-side reads unmediated), INV-6 lifecycle (resident process, no policy rebind), INV-9 fail-closed',
  alternatePublicRoutesExamined: 'R1 name-shadowing: does not apply (no per-Agent Lsp service layer to shadow; server-side I/O is not a tool body). R2 ctx.isolate(fs|subprocess) + own lsp-stdio mount per Team realm: can give a realm its OWN pool+servers (realm-level isolation is real), but queries still carry no per-call identity, spawn spec has no per-call confinement, and intra-realm two members with different ACLs still share a pool keyed by path only. R3 composed adapter at package root: LspConnection/LspInstance are exported, so a Team-owned provider could key by realm+policy, BUT the language server process itself still needs OS confinement that the public spawn surface does not parameterize per policy, and the fictional-server probes show its reads bypass ctx.fs entirely.',
  whyToolForkHelpsOrCannotHelp: 'a tool-level fork of the lsp tool cannot help: the exposure lives in the provider/pool + resident process, not the tool body; Fork cannot move the pool key or confine the server without a spawn-time per-policy OS mechanism (P0-4 provider capability). It CANNOT help (for the enforcement half) and helps only for the keying half if paired with an upstream confine parameter.',
  proposedUpstreamGenericAPI: 'LspQueryRequest-scoped caller identity or a per-realm Lsp service resolution; provider pool key extension point (policy generation in key + forced-evict on generation change); ctx.subprocess.spawn per-spec confinement parameter (shared with P0-4) so a language-server launch carries the read ACL.',
  affectedToolFamilies: ['lsp (ctx.lsp all four operations via lsp-stdio providers; any future provider inherits the path-only key)'],
  safeFallback: 'until then: deny persistent-language-server capability in strict Team profiles (fail-closed per INV-9); native tool-level Team governance of the OUTER lsp tool call is still possible via 01-routing-style binding, but is provably insufficient for the resident server (this leg).',
}
leg('P05-LSP-10.core-seam-blocker-material', 'RECORDED', blocker)

result.overall = {
  judgment_per_provider_resident_pool_spawn_hostpreread: 'CONFIRMED (P05-LSP-0 citations; S-11 upheld)',
  same_path_different_policy_reuse: 'HAZARD-OBSERVED on the real provider code path with a fictional auditable server (P05-LSP-3); policy is not merely unkeyed — it has no channel at the seam',
  server_side_reads_unmediated: 'OBSERVED for the fictional server (fixture secret only, P05-LSP-4/6); not a proof about real LSP servers, but they run the same unsandboxed spawn path',
  teardown: 'PASS on the fictional servers (P05-LSP-8)',
  verdict_candidate: 'LSP-01 = INCONCLUSIVE for the full matrix (needs real host + per-Agent ctx.lsp, which does not exist) + CORE_SEAM_BLOCKER material recorded for the missing per-policy server binding and confine-parameterized spawn; LSP family classification candidate for P0-5: 需要上游接口 (needs upstream interface) under strict profiles, realm-level isolation only otherwise',
}

const out = join(HERE, 'p05-result.json')
writeFileSync(out, JSON.stringify(result, null, 2) + '\n', 'utf8')
const gT2 = shRun('git T status after', 'git', ['-C', TEST_USE, 'status', '--porcelain'])
result.host_env.test_use_porcelain_empty_after = gT2.out === ''
writeFileSync(out, JSON.stringify(result, null, 2) + '\n', 'utf8')
const failed = result.legs.filter(l => l.verdict === 'FAIL' || l.verdict === 'BLOCKED').length
console.log(`\nwrote ${out}; legs=${result.legs.length}; failing(PASS-candidates)=${failed}`)
process.exit(failed === 0 ? 0 : 1)
