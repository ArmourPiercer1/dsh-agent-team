// PF-1 pass-3 diagnostic repro — captures the FULL p6t6 tool body for the
// T (team.prereq-main) delegate that the E.12 re-run (prereq-2026-09-29T20-52-08)
// saw as `toolOk=false targetInstanceId=?` (envelope ok=true, no 'executed'
// status, no worker member instance, no ledger trail, no control requests).
//
// Method: reuse the kit's preserved world (T + T2 already created, consent
// seeded), boot ONE resume-phase host, start the mock model + the three
// mini-MCPs (all-ready cell), re-fire the T delegate (async:false, fresh
// request token) and print the complete tool body + the mock request trail
// + the post-call member-instance table. Then the same for T2 (the iso
// control — that one had envelope ok=true in the run).
//
// Scratch diagnostic — NOT part of the kit; runs ONLY after the kit run has
// fully stopped (ports released).
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { resolve, join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { randomUUID } from 'node:crypto'
import { DshInstance } from '/home/user/dsh-plugins/dsh-agent-team/.worktrees/pre-alpha3-pre-e-requirement-recovery/tests/characterization/lib/instance.mjs'
import { TEST_USE_BASELINE_SHA, CLIENT_COMMIT_HASH } from '/home/user/dsh-plugins/dsh-agent-team/.worktrees/pre-alpha3-pre-e-requirement-recovery/tests/paths.mjs'
import { startMockModel } from '/home/user/dsh-plugins/dsh-agent-team/.worktrees/pre-alpha3-pre-e-requirement-recovery/packages/tools/harness/mock-deepseek.mjs'

const WORKTREE = '/home/user/dsh-plugins/dsh-agent-team/.worktrees/pre-alpha3-pre-e-requirement-recovery'
const TESTUSE = resolve(join(WORKTREE, '..', '..', 'tests', 'deepseek-harness-test-use'))
const RUN_STAMP = 'prereq-2026-09-29T20-52-08'
const HOME = join(WORKTREE, 'tests', 'homes', RUN_STAMP)
const REPRO_DIR = join(WORKTREE, 'dev', 'agent-workflow', 'evidence', 'pre-alpha3-refactor', 'pr-e', 'pf1-fix-gates', 'repro')
mkdirSync(REPRO_DIR, { recursive: true })

const ROOT = `session-prereq-boot-${RUN_STAMP}`
const T = `session-prereq-main-${RUN_STAMP}`
const T2 = `session-prereq-iso-${RUN_STAMP}`
const T9 = `session-prereq-persona-${RUN_STAMP}`
const REPRO_NONCE = `repro-${Date.now()}`

const PRODUCTION_ROW_PATH = join(WORKTREE, 'packages', 'runtime', 'dist', 'packages', 'runtime', 'src', 'plugin', 'host.js')
const GLUE_PATH = join(WORKTREE, 'packages', 'runtime', 'dist', 'packages', 'runtime', 'src', 'plugin', 'live', 'agent-bindings.mjs')
const SEAM_PATH = join(WORKTREE, 'packages', 'runtime', 'root-binding', 'harness', 'seam.mjs')
const P6T6_ROW_NAME = pathToFileURL(join(WORKTREE, 'packages', 'tools', 'harness', 'plugin.mjs')).href
const PRODUCTION_ROW_NAME = pathToFileURL(PRODUCTION_ROW_PATH).href

const HOST_PORT = 3183 // NEVER 3080/3180; 3182 = the kit's (released after its stop)
const MOCK_PORT = 3497
const PORT_REPO = 3492
const PORT_LEADERREQ = 3491
const PORT_WEB = 3493

const S_REPO = 'mcp_repo'
const S_LEADERREQ = 'mcp_leaderreq'
const S_WEB = 'mcp_web'

const log = (msg) => console.log(`[${new Date().toISOString()}] ${msg}`)
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function fetchJson(url, init, timeoutMs = 60_000) {
  const res = await fetch(url, { ...init, signal: AbortSignal.timeout(timeoutMs) }).catch((e) => ({ status: 0, body: null, _err: String(e?.message ?? e) }))
  let body = null
  if (res.status !== 0) {
    try { body = await res.json() } catch { body = null }
  }
  return { status: res.status, body }
}

async function authenticate(origin, token) {
  const res = await fetch(`${origin}/?token=${token}`, { redirect: 'manual', signal: AbortSignal.timeout(15_000) })
  const cookie = res.headers.get('set-cookie') ?? ''
  if (res.status !== 303) throw new Error(`authenticate: expected 303 (status=${res.status})`)
  if (!cookie) throw new Error('authenticate: no set-cookie on 303')
  return cookie.split(';')[0]
}

function miniMcpRpc(serverLabel, msg) {
  const { id, method, params } = msg ?? {}
  if (method === 'initialize') {
    return { jsonrpc: '2.0', id, result: { protocolVersion: '2025-03-26', capabilities: { tools: {} }, serverInfo: { name: serverLabel, version: '1.0.0' } } }
  }
  if (method === 'notifications/initialized') return null
  if (method === 'tools/list') {
    return { jsonrpc: '2.0', id, result: { tools: [{ name: 'ping', description: `ping ${serverLabel}`, inputSchema: { type: 'object', properties: { msg: { type: 'string' } }, required: ['msg'] } }] } }
  }
  if (method === 'tools/call') {
    if (String(params?.name ?? '') === 'ping') {
      return { jsonrpc: '2.0', id, result: { content: [{ type: 'text', text: `pong:${serverLabel}:${String(params?.arguments?.msg ?? '?')}` }], isError: false } }
    }
    return { jsonrpc: '2.0', id, error: { code: -32601, message: `unknown tool ${params?.name}` } }
  }
  return { jsonrpc: '2.0', id, error: { code: -32601, message: `method not found: ${String(method)}` } }
}

async function startMiniMcp(port, label) {
  const { createServer } = await import('node:http')
  const server = createServer((req, res) => {
    if (req.method !== 'POST') { res.writeHead(405).end(); return }
    let raw = ''
    req.on('data', (c) => { raw += c })
    req.on('end', () => {
      let msg = null
      try { msg = JSON.parse(raw || 'null') } catch { /* null */ }
      const reply = miniMcpRpc(label, msg)
      res.writeHead(200, { 'content-type': 'application/json' })
      res.end(reply === null ? '' : JSON.stringify(reply))
    })
  })
  await new Promise((resP, rejP) => { server.once('error', rejP); server.listen(port, '127.0.0.1', () => resP()) })
  log(`mini MCP ${label} up on 127.0.0.1:${port}`)
  return { port, server }
}

function yamlScalar(v) {
  if (v === null) return 'null'
  if (typeof v === 'string') return JSON.stringify(v)
  return String(v)
}
function yamlValueLines(value, indent) {
  if (Array.isArray(value)) return value.flatMap((i) => yamlEmitItem(i, indent))
  return Object.entries(value).flatMap(([k, v]) => yamlEmit(k, v, indent))
}
function yamlEmit(key, value, indent) {
  const pad = '  '.repeat(indent)
  if (value !== null && typeof value === 'object') {
    const empty = Array.isArray(value) ? value.length === 0 : Object.keys(value).length === 0
    if (empty) return [`${pad}${key}: ${Array.isArray(value) ? '[]' : '{}'}`]
    return [`${pad}${key}:`, ...yamlValueLines(value, indent + 1)]
  }
  return [`${pad}${key}: ${yamlScalar(value)}`]
}
function yamlEmitItem(item, indent) {
  const pad = '  '.repeat(indent)
  if (item === null || typeof item !== 'object') return [`${pad}- ${yamlScalar(item)}`]
  if (Array.isArray(item)) {
    if (item.length === 0) return [`${pad}- []`]
    return [`${pad}-`, ...yamlValueLines(item, indent + 1)]
  }
  const entries = Object.entries(item)
  const [firstKey, firstValue] = entries[0]
  const firstLines = yamlEmit(firstKey, firstValue, indent + 1)
  const rest = entries.slice(1).flatMap(([k, v]) => yamlEmit(k, v, indent + 1))
  return [`${pad}- ${firstLines[0].slice((indent + 1) * 2)}`, ...firstLines.slice(1), ...rest]
}

async function p6t6Tool(port, name, argsObj, as, timeoutMs = 200_000) {
  const r = await fetchJson(`http://127.0.0.1:${port}/__p6t6/tool`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ name, args: argsObj, as }),
  }, timeoutMs)
  log(`p6t6 tool ${name} as=${as} -> ${r.status} ok=${r.body?.ok === true}`)
  return r
}

// ── the frozen remote surface (POST /team-remote/<method>) ─────────────
let remoteSeq = 0
async function remoteCall(origin, cookie, method, params, tag, version = 1, timeoutMs = 60_000) {
  const body = {
    type: 'client-request',
    rpcId: `${tag}-${String(++remoteSeq)}`,
    method,
    payload: { version, params },
  }
  const r = await fetchJson(`${origin}/team-remote/${method}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie },
    body: JSON.stringify(body),
  }, timeoutMs)
  const out = r.body?.result
  log(`remote ${method} v${version} [${tag}] -> ${r.status} ok=${out?.ok === true}${out?.ok === false ? ` code=${out?.error?.code ?? '?'} msg=${String(out?.error?.message ?? '').slice(0, 200)}` : ''}`)
  writeFileSync(join(REPRO_DIR, `remote-${tag}.json`), JSON.stringify(r.body, null, 1))
  return r
}

async function main() {
  // 1. services: mock model + the three mini-MCPs (the all-ready cell)
  const mockLogPath = join(REPRO_DIR, 'mock.log')
  const MOCK = await startMockModel({
    port: MOCK_PORT,
    decide: (req) => {
      // single-text-reply: any model request -> REPRO_DONE (the worker's
      // DONE witness is not the point — the tool body + request trail are).
      return { kind: 'text', content: `REPRO_DONE_${REPRO_NONCE}` }
    },
    log: (msg) => { try { writeFileSync(mockLogPath, `${msg}\n`, { flag: 'a' }) } catch { /* ignore */ } },
  })
  if (MOCK.port !== MOCK_PORT) throw new Error(`mock landed on ${MOCK.port}`)
  process.env.DEEPSEEK_BASE_URL = `http://127.0.0.1:${MOCK_PORT}`
  process.env.DEEPSEEK_API_KEY = 'prereq-smoke-mock-key'
  const miniRepo = await startMiniMcp(PORT_REPO, S_REPO)
  const miniLeaderreq = await startMiniMcp(PORT_LEADERREQ, S_LEADERREQ)
  const miniWeb = await startMiniMcp(PORT_WEB, S_WEB)
  log(`services up: mock=${MOCK.port} repo=${PORT_REPO} leaderreq=${PORT_LEADERREQ} web=${PORT_WEB}`)

  // 2. patch (resume, all-ready) + directive — the B1b world truth
  const facts = [
    { domain: 'mcpServer', subject: S_REPO, available: true, generation: 1 },
    { domain: 'mcpServer', subject: S_LEADERREQ, available: true, generation: 1 },
    { domain: 'mcpServer', subject: S_WEB, available: true, generation: 1 },
    // B9b row parity: the row seed says persona/standard UNAVAILABLE (the
    // current world state — persona absent).
    { domain: 'persona', subject: 'standard', available: false, generation: 1 },
  ]
  const rowConfig = {
    rootSessionId: ROOT,
    bootPhase: 'resume',
    // The row anchor: a plain LEGACY v1 leader (no capabilities, no
    // requirements) — byte-for-byte the kit's BP_ANCHOR_YAML (inline text,
    // not a path — the row validator requires a non-empty string).
    blueprintSource: [
      '---',
      'schemaVersion: 1',
      'blueprintId: team.prereq-anchor',
      'revision: "1"',
      'leader:',
      '  templateId: leader',
      `  persona: ${JSON.stringify(`You are the leader of the PR-E smoke boot team. ${REPRO_NONCE} is the run nonce.`)}`,
      'members: []',
      'requirements: []',
      'memberEnvelopes: []',
      'policyStates: []',
      'metadata: {}',
      '---',
      '',
    ].join('\n'),
    blueprintDir: join(HOME, 'blueprints'),
    seedMembers: [],
    generation: 1,
    staticModel: { provider: 'deepseek-official', model: 'prereq-smoke-model' },
    deniedSelection: null,
    mcpServers: [
      { name: S_REPO, port: PORT_REPO },
      { name: S_LEADERREQ, port: PORT_LEADERREQ },
      { name: S_WEB, port: PORT_WEB },
    ],
    mcpServer: null,
    environmentFacts: facts,
    externalPolicyFacts: { hard: {}, capabilityExists: {} },
    glueUrl: pathToFileURL(GLUE_PATH).href,
    seamUrl: pathToFileURL(SEAM_PATH).href,
  }
  const instLogDir = join(REPRO_DIR, 'instance')
  let instance
  try { // cleanup safety net (run-2 orphan lesson): boot + row setup included
  instance = new DshInstance({ hostTree: TESTUSE, dshHome: HOME, port: HOST_PORT, clientCommitHash: CLIENT_COMMIT_HASH, logDir: instLogDir })
  const patchLines = [
    `# repro patch (world ${RUN_STAMP}): resume boot, all-ready cell`,
    '- insert:',
    ...yamlEmitItem({ id: 'dsh-agent-team', name: PRODUCTION_ROW_NAME, config: rowConfig }, 2),
    ...yamlEmitItem({ id: 'p6t6-team-tools', name: P6T6_ROW_NAME }, 2),
    '',
  ]
  writeFileSync(instance.patchFile, patchLines.join('\n'))
  writeFileSync(join(HOME, 'p6t6-directive.json'), JSON.stringify({
    boot: 2,
    phase: 'resume',
    reportDir: REPRO_DIR,
    runStamp: RUN_STAMP,
    kitBoot: 99,
    rootSessionId: ROOT,
    mcpPort: PORT_LEADERREQ,
  }, null, 2))
  log('patch + directive written (resume, all-ready)')

  // 3. boot
  const started = await instance.start({ timeoutMs: 240_000 })
  const m = /^http:\/\/127\.0\.0\.1:(\d+)\/\?token=([A-Za-z0-9_-]+)$/.exec(started.url)
  if (m === null) throw new Error(`unexpected boot url: ${started.url}`)
  const cookie = await authenticate(`http://127.0.0.1:${m[1]}`, m[2])
  log(`booted at http://127.0.0.1:${m[1]}`)
  const deadline = Date.now() + 240_000
  for (;;) {
    const hb = await fetchJson(`http://127.0.0.1:${HOST_PORT}/__p6t6/health`, undefined, 10_000)
    if (hb.status === 200 && hb.body?.ok === true) { log(`row ready — toolCount=${hb.body.toolCount}`); break }
    if (hb.status === 200 && hb.body?.ok === false && hb.body?.setupError !== undefined) {
      throw new Error(`row setup failed: ${String(hb.body.setupError).slice(0, 600)}`)
    }
    if (Date.now() >= deadline) throw new Error('row health not ready in 240s')
    await sleep(1000)
  }

  // ── consumer matrix: flat probe vs per-root prober vs admit gate, SAME
  // ── world, same process — the INV-9.4 identity check (20:52 run: T9
  // ── prober row said persona PASS in the persona-absent world while the
  // ── flat probe said FATAL 112ms later; admit false-opened on both).
  const BP_PERSONA_ID = 'team.prereq-persona'
  const matrix = async () => {
    const compBefore = await remoteCall(`http://127.0.0.1:${HOST_PORT}`, cookie, 'compatibility.get', { teamSessionId: T9 }, 'm1-comp-get-t9-before')
    log(`M1 T9 durable row (pre): ${JSON.stringify(compBefore.body?.result?.value ?? compBefore.body?.result ?? null).slice(0, 600)}`)
    const reprobe = await remoteCall(`http://127.0.0.1:${HOST_PORT}`, cookie, 'compatibility.reprobe', { teamSessionId: T9, trigger: 'ROOT_COLD_RESUME' }, 'm2-comp-reprobe-t9')
    log(`M2 T9 reprobe: ${JSON.stringify(reprobe.body?.result?.value ?? reprobe.body?.result ?? null).slice(0, 600)}`)
    const compAfter = await remoteCall(`http://127.0.0.1:${HOST_PORT}`, cookie, 'compatibility.get', { teamSessionId: T9 }, 'm3-comp-get-t9-after')
    log(`M3 T9 durable row (post): ${JSON.stringify(compAfter.body?.result?.value ?? compAfter.body?.result ?? null).slice(0, 600)}`)
    // Mirror the kit's B9b sequence EXACTLY: S12a probe WITH the caller
    // persona fact (standard=true — the wire world), then the S12b admit,
    // then the S12b BARE probe. If the wire fact leaks across the U5
    // caller-only boundary (process cache or row-static pollution), the
    // admit false-opens and/or a post-admit row carries persona=available.
    const probeWire = await remoteCall(`http://127.0.0.1:${HOST_PORT}`, cookie, 'intent.probe', {
      blueprintId: BP_PERSONA_ID,
      environmentFacts: [{ domain: 'persona', subject: 'standard', available: true, generation: 1 }],
    }, 'm4a-probe-persona-wire-true')
    log(`M4a flat probe (wire persona=true): ${JSON.stringify(probeWire.body?.result?.value ?? probeWire.body?.result ?? null).slice(0, 700)}`)
    // Admit gate — the S12b false-open path (112ms AFTER the wire probe in
    // the 20:52 run; the row write sat between the two probes).
    const admit = await remoteCall(`http://127.0.0.1:${HOST_PORT}`, cookie, 'team.admitInitialWork', {
      rootSessionId: T9,
      requestToken: `rt-repro-admit-${REPRO_NONCE}`,
      prompt: `repro admit probe ${REPRO_NONCE}`,
    }, 'm5-admit-t9', 2)
    log(`M5 admitInitialWork(T9): ${JSON.stringify(admit.body?.result ?? null).slice(0, 700)}`)
    // BARE probe (no caller persona facts) — the S12b check's own lane.
    // NOTE: 'intent.probe' v1 REQUIRES the environmentFacts field on the
    // wire (the kit's "bare" = explicit environmentFacts: [] — omitting the
    // field is malformed-params). Run 4's M4 hit that; parity with the
    // 20:52 S12b flat probe (FATAL fp 6cb31629da76b43f) needs the explicit [].
    const probe = await remoteCall(`http://127.0.0.1:${HOST_PORT}`, cookie, 'intent.probe', { blueprintId: BP_PERSONA_ID, environmentFacts: [] }, 'm4b-probe-persona-bare')
    log(`M4b flat probe (bare): ${JSON.stringify(probe.body?.result?.value ?? probe.body?.result ?? null).slice(0, 700)}`)
    const compPostAdmit = await remoteCall(`http://127.0.0.1:${HOST_PORT}`, cookie, 'compatibility.get', { teamSessionId: T9 }, 'm5b-comp-get-t9-postadmit')
    log(`M5b T9 durable row (post-admit): ${JSON.stringify(compPostAdmit.body?.result?.value ?? compPostAdmit.body?.result ?? null).slice(0, 600)}`)
    // T (MAIN blueprint, all-ready world): team-scope reprobe + flat probe.
    const reprobeT = await remoteCall(`http://127.0.0.1:${HOST_PORT}`, cookie, 'compatibility.reprobe', { teamSessionId: T, trigger: 'ROOT_COLD_RESUME' }, 'm6-comp-reprobe-t')
    log(`M6 T reprobe: ${JSON.stringify(reprobeT.body?.result?.value ?? reprobeT.body?.result ?? null).slice(0, 600)}`)
  }

  const delegate = async (rootId, tag) => {
    const before = MOCK.requests.length
    const r = await p6t6Tool(HOST_PORT, 'team_delegate', {
      rootSessionId: rootId,
      requestToken: `rt-${tag}-${REPRO_NONCE}`,
      label: `w-${tag}`,
      prompt: `REPRO_${tag} work unit (nonce ${REPRO_NONCE})`,
      delegationTemplateId: 'worker',
      async: false,
    }, rootId)
    await sleep(12_000) // give an async worker turn a moment to hit the mock
    const after = MOCK.requests.length
    log(`== ${tag}: envelope status=${r.status} ok=${r.body?.ok}`)
    log(`== ${tag}: FULL tool body: ${JSON.stringify(r.body, null, 1)}`)
    log(`== ${tag}: mock requests before=${before} after=${after} (delta=${after - before})`)
    for (const req of MOCK.requests.slice(before)) {
      log(`== ${tag}: mock req seq=${req.seq} url=${req.url}`)
    }
    writeFileSync(join(REPRO_DIR, `tool-body-${tag}.json`), JSON.stringify(r.body, null, 1))
  }

  await matrix()
  await delegate(T, 't-main')
  await delegate(T2, 't-iso')
  } finally {
    if (instance !== undefined) {
      try { await instance.stop({ timeoutMs: 20_000 }) } catch (e) { log(`stop: ${e.message}`) }
    }
    for (const mini of [miniRepo, miniLeaderreq, miniWeb]) await new Promise((r) => mini.server.close(r))
    await MOCK.close()
  }
  log('REPRO DONE')
}

main().catch((e) => {
  log(`REPRO FATAL: ${String(e?.stack ?? e)}`)
  process.exitCode = 1
})
