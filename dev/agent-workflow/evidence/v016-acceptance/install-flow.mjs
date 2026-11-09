#!/usr/bin/env node
/**
 * install-flow.mjs — Gate-3 C: the ORDINARY-INSTALL joint flow on the frozen
 * v0.1.6 candidate.
 *
 * What is real here (nothing from the WorldFactory):
 *   - `pnpm pack` of THIS worktree, installed with the real `dsh plugin
 *     --profile web add <tarball>` into a profile written by the CLI itself;
 *   - the host is `@deepseek-ai/dsh@0.2.0-rc.2` installed from the npm registry
 *     into a CLEAN directory that carries nothing else;
 *   - a real `dsh web` boot;
 *   - the real model (`qiyuan-self/deepseek-v4.1-flash-1017`, credentials from
 *     the operator's credential store, same as the earlier install lanes);
 *   - the whole flow over the public HTTP surface the GUI uses: team.create,
 *     the Leader's own model turns (create member -> delegate), a governed
 *     Member bash call -> durable Team control request -> human allow through
 *     `team.resolveControl` -> execution, a Goal, Stop (goals/pause +
 *     session/cancel, the exact RPCs the button issues), result collection and
 *     a cold restart on the same DSH_HOME.
 *
 * The profile-level override written below is OPERATOR CONFIG (the documented
 * way to enable the shipped opt-in governed preset); it is not a product
 * change. `CORE PATCH BUDGET = 0`.
 *
 * Subcommands:
 *   setup    pack (if needed) + clean-dir dsh install + plugin add + profile row
 *   boot     start `dsh web`, wait for the boot line, print origin+token
 *   flow     drive the joint flow against an already-booted host
 *   restart  kill + cold restart on the same DSH_HOME, then re-read state
 *   all      setup + boot + flow + restart + teardown
 */
import { spawn, execFileSync } from 'node:child_process'
import { createRequire } from 'node:module'
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync, appendFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { zstdDecompressSync } from 'node:zlib'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO = resolve(HERE, '..', '..', '..', '..')
const ARGS = Object.fromEntries(process.argv.slice(2).map((a) => {
  const [k, ...rest] = a.replace(/^--/u, '').split('=')
  return [k, rest.join('=') || true]
}))
const RUN = String(ARGS.run ?? '1')
const PHASE = String(ARGS.phase ?? 'all')
const PORT = Number(ARGS.port ?? (RUN === '1' ? 3189 : 3190))
const BASE = join(REPO, 'tests', 'homes', `v016-install-r${RUN}`)
const HOST_DIR = join(BASE, 'host')
const HOME = join(BASE, 'home')
const WS = join(BASE, 'ws')
const BLUEPRINTS = join(BASE, 'blueprints')
const EVID = HERE
const PACK_DIR = join(HERE, 'pack')
const TARBALL = join(PACK_DIR, 'dsh-agent-team-0.1.6.tgz')
const ROOT = `session-v016-install-root-r${RUN}`
const BP_ID = 'v016-install-bp'
// The permission-coverage gate refuses a Leader surface with unmanaged tools
// (measured: PermissionCoverageUnmanagedError, 19 names). This is the same
// deny list the C1 kit computes from its live discovery; here it is declared
// from the measured error text (a blueprint capability list, not a product
// change). `bash`/`read`/`write`/`edit` stay OUT: the host permission preset
// manages them.
const NON_TEAM_TOOLS = [
  'ask_user_question', 'create_goal', 'exit_plan_mode', 'get_goal', 'glob', 'grep',
  'interrupt_agent', 'job_kill', 'job_list', 'job_output', 'list_agents', 'present',
  'send_message', 'skill', 'subagent_fork', 'update_goal', 'web_fetch', 'web_search', 'workflow',
]
const STAMP = String(ARGS.stamp ?? `r${RUN}`)
const MARK = `INSTALL_FLOW_${STAMP}`
const LEDGER = join(EVID, `install-r${RUN}`)
const LOG = join(LEDGER, 'flow.log')

mkdirSync(LEDGER, { recursive: true })
mkdirSync(WS, { recursive: true })
if (ARGS.phase === 'all') writeFileSync(LOG, '')
function log(line) {
  const text = `[${new Date().toISOString()}] ${line}`
  process.stdout.write(`${text}\n`)
  appendFileSync(LOG, `${text}\n`)
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

// ── the real host: installed from the registry into a clean directory ───────
function ensureHostInstall() {
  if (existsSync(join(HOST_DIR, 'node_modules', '@deepseek-ai', 'dsh', 'lib', 'bin.js'))) return
  mkdirSync(HOST_DIR, { recursive: true })
  writeFileSync(join(HOST_DIR, 'package.json'), JSON.stringify({ name: 'v016-host', private: true, version: '1.0.0' }, null, 2) + '\n')
  writeFileSync(join(HOST_DIR, '.npmrc'), 'nodeLinker: hoisted\nautoInstallPeers: false\nstrictDepBuilds: false\n')
  execFileSync('pnpm', ['add', '@deepseek-ai/dsh@0.2.0-rc.2', '--ignore-scripts', '--store-dir', join(REPO, '.pnpm-store')], {
    cwd: HOST_DIR, stdio: ['ignore', 'pipe', 'pipe'], encoding: 'utf8',
  })
  log(`host installed: @deepseek-ai/dsh@0.2.0-rc.2 in ${HOST_DIR} (clean dir, this is the ONLY package)`)
}
const DSH_BIN = () => join(HOST_DIR, 'node_modules', '@deepseek-ai', 'dsh', 'lib', 'bin.js')

function pack() {
  mkdirSync(PACK_DIR, { recursive: true })
  execFileSync('pnpm', ['pack', '--pack-destination', PACK_DIR], { cwd: REPO, stdio: ['ignore', 'pipe', 'pipe'], encoding: 'utf8' })
  const sha = createHash('sha256').update(readFileSync(TARBALL)).digest('hex')
  log(`packed ${TARBALL} bytes=${readFileSync(TARBALL).length} sha256=${sha}`)
  return sha
}

function pluginAdd() {
  mkdirSync(join(HOME, 'profiles', 'web'), { recursive: true })
  writeFileSync(join(HOME, 'profiles', 'web', 'pnpm-workspace.yaml'),
    `packages:\n  - .\n\nnodeLinker: hoisted\nautoInstallPeers: false\nstoreDir: ${join(REPO, '.pnpm-store')}\nstrictDepBuilds: false\n`)
  const out = execFileSync(process.execPath, [DSH_BIN(), 'plugin', '--profile', 'web', 'add', TARBALL], {
    cwd: HOST_DIR, env: { ...process.env, DSH_HOME: HOME, npm_config_store_dir: join(REPO, '.pnpm-store') }, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'],
  })
  log(`dsh plugin --profile web add: ${out.trim().split('\n').slice(-2).join(' | ')}`)
}

// ── the operator config row (documented enablement of the opt-in preset) ────
function readShippedRow() {
  const text = readFileSync(join(HOME, 'profiles', 'web', 'node_modules', 'dsh-agent-team', 'cordis.patch.yml'), 'utf8')
  const substituted = text.replace(/!!js[ \t]+([^\n]+)/gu, (_m, expr) => {
    const value = new Function(`"use strict";return (${expr.trim()})`)()
    return JSON.stringify(value)
  })
  // tiny YAML-free extraction: find the host row by its id/name pair using the
  // parsed document through the installed `yaml` package.
  const YAML = (() => {
    const req = createRequire(join(HOME, 'profiles', 'web', 'package.json'))
    return req('yaml')
  })()
  const doc = YAML.parse(substituted)
  const rows = []
  const visit = (list) => { for (const row of list ?? []) { if (Array.isArray(row?.insert)) { visit(row.insert); continue } rows.push(row) } }
  visit(doc)
  const host = rows.find((r) => r?.id === 'dsh-agent-team' || r?.name === 'dsh-agent-team/host')
  if (host === undefined) throw new Error('installed bundle carries no dsh-agent-team host row')
  return host
}

function blueprint() {
  const lane = (allow) => ({ mode: 'restricted', allow: [...allow], ask: [], deny: [] })
  return {
    schemaVersion: 4,
    blueprintId: BP_ID,
    revision: '1',
    leader: {
      templateId: 'leader',
      persona: `You lead the v016 install-flow team. ${MARK} is the marker. Follow the operator instruction exactly, once.`,
    },
    members: [{
      templateId: 'worker',
      displayName: 'Install Flow Worker',
      persona: `You are the install-flow worker. ${MARK}. Do exactly the delegated task and then answer with a short report.`,
    }],
    requirements: [],
    teamEnvelope: {
      allow: ['create-member', 'assign-task', 'send-message', 'report-progress', 'archive-member', 'restore-member'],
      deny: [],
    },
    memberEnvelopes: [],
    policyStates: [{ id: 'default', description: 'Default state.' }],
    permissionMutationEnvelope: { rules: [] },
    teamHardEnvelope: { rules: [] },
    metadata: {},
    memberIoCeilings: [{
      templateId: 'worker',
      io: { read: lane([WS]), write: lane([WS]), network: { mode: 'allow' } },
    }],
  }
}

function writeProfileConfig() {
  const host = readShippedRow()
  const doc = blueprint()
  const config = {
    ...host.config,
    rootSessionId: ROOT,
    bootPhase: 'create-or-open',
    defaultWorkspace: WS,
    blueprintSource: `---\n${JSON.stringify(doc, null, 2)}\n---\n`,
    blueprintDir: BLUEPRINTS,
    seedMembers: [],
    generation: 1,
    memberPresetId: 'a5sf-governed-member',
    a5sfGovernedRealm: true,
    a5sfEvidencePath: join(HOME, 'a5sf-consult.jsonl'),
    staticModel: { provider: 'qiyuan-self', model: 'deepseek-v4.1-flash-1017' },
    mcpServers: [],
    mcpServer: null,
  }
  const patch = [
    '# v016 Gate-3 C: OPERATOR config (not a product change).',
    '# 1) enable the shipped opt-in governed Member preset on the host row;',
    '# 2) point the model at the operator provider (same store as earlier lanes).',
    '- id: "dsh-agent-team"',
    '  name: "dsh-agent-team/host"',
    '  config:',
    JSON.stringify(config, null, 2).split('\n').map((l) => `    ${l}`).join('\n'),
    '- id: llm-pi-ai',
    '  name: "@deepseek-ai/dsh-llm-pi-ai"',
    '  config:',
    '    providers:',
    '      qiyuan-self:',
    '        apiKeyEnv: QIYUAN_SELF_API_KEY',
    '        api: openai-completions',
    '        baseURL: http://58.57.119.30:52010/v1',
    '        models:',
    '          - id: deepseek-v4.1-flash-1017',
    '            name: deepseek-v4.1-flash-1017',
    '            maxTokens: 8000',
    '- id: agent-default-model',
    '  name: "@deepseek-ai/dsh-agent-default-model"',
    '  config:',
    '    provider: qiyuan-self',
    '    model: deepseek-v4.1-flash-1017',
    '',
  ].join('\n')
  mkdirSync(BLUEPRINTS, { recursive: true })
  writeFileSync(join(BLUEPRINTS, `${BP_ID}.yaml`), `---\n${JSON.stringify(doc, null, 2)}\n---\n`)
  writeFileSync(join(HOME, 'profiles', 'web', 'cordis.patch.yml'), patch)
  log(`profile cordis.patch.yml written (host row + operator provider); blueprint ${BP_ID} v4 with memberIoCeilings`)
}

function credentialsKey() {
  const text = readFileSync(join(process.env.HOME, '.dsh', '.credentials.yaml'), 'utf8')
  const m = /^\s+QIYUAN_SELF_API_KEY:\s*(\S+)\s*$/mu.exec(text)
  if (m === null) throw new Error('QIYUAN_SELF_API_KEY absent from the credential store')
  return m[1]
}

// ── boot / rpc helpers ──────────────────────────────────────────────────────
function spawnHost() {
  const logPath = join(LEDGER, `instance-r${RUN}.log`)
  writeFileSync(logPath, '')
  const env = { ...process.env, DSH_HOME: HOME, QIYUAN_SELF_API_KEY: credentialsKey(), DSH_CLIENT_COMMIT_HASH: '639ed01539' }
  const child = spawn(process.execPath, [DSH_BIN(), 'web', '--port', String(PORT), '--no-open'], {
    cwd: WS, env, stdio: ['ignore', 'pipe', 'pipe'],
  })
  const out = []
  child.stdout.on('data', (d) => { out.push(String(d)); appendFileSync(logPath, String(d)) })
  child.stderr.on('data', (d) => { appendFileSync(logPath, String(d)) })
  return { child, logPath, out }
}
async function waitBoot(boot, timeoutMs = 180_000) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    if (boot.child.exitCode !== null) throw new Error(`host exited code=${boot.child.exitCode}; tail=${readFileSync(boot.logPath,'utf8').split('\n').slice(-6).join('\n')}`)
    const text = existsSync(boot.logPath) ? readFileSync(boot.logPath, 'utf8') : ''
    const matches = [...text.matchAll(/dsh web: (http:\/\/127\.0\.0\.1:\d+\/\?token=[A-Za-z0-9_-]+)/gu)]
    if (matches.length > 0) return matches.at(-1)[1]
    await sleep(300)
  }
  throw new Error(`no boot line; tail=${existsSync(boot.logPath) ? readFileSync(boot.logPath, 'utf8').split('\n').slice(-8).join('\n') : '<none>'}`)
}
async function authenticate(url) {
  const res = await fetch(url, { redirect: 'manual', signal: AbortSignal.timeout(20_000) })
  const cookie = res.headers.get('set-cookie')
  if (res.status !== 303 || cookie === null) throw new Error(`auth ${res.status}`)
  return cookie.split(';', 1)[0]
}
async function fetchJson(url, init, timeoutMs = 180_000) {
  const res = await fetch(url, { ...init, signal: AbortSignal.timeout(timeoutMs) }).catch((e) => ({ status: 0, error: String(e?.message ?? e) }))
  if (res.status === 0) return { status: 0, body: null, error: res.error }
  const body = await res.json().catch(() => null)
  return { status: res.status, body }
}
let ORIGIN = null
let COOKIE = null
async function teamRpc(method, params, tag = 'v016', version = 4) {
  return fetchJson(`${ORIGIN}/team-remote/${method}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie: COOKIE },
    body: JSON.stringify({ type: 'client-request', rpcId: `${tag}-${Math.random().toString(36).slice(2, 10)}`, method, payload: { version, params } }),
  })
}
async function apiPrompt(sessionId, text, tag = 'v016p') {
  return fetchJson(`${ORIGIN}/api/session/prompt`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie: COOKIE },
    body: JSON.stringify({
      type: 'client-request', rpcId: `${tag}-${Math.random().toString(36).slice(2, 10)}`, method: 'session/prompt',
      payload: { args: { request: { requestId: `${tag}-${Math.random().toString(36).slice(2, 10)}`, sessionId, mode: 'queue', content: [{ type: 'text', text }] } } },
    }),
  })
}
async function apiCancel(sessionId, tag = 'v016c') {
  return fetchJson(`${ORIGIN}/api/session/cancel`, {
    method: 'POST', headers: { 'content-type': 'application/json', cookie: COOKIE },
    body: JSON.stringify({ type: 'client-request', rpcId: `${tag}-${Math.random().toString(36).slice(2, 10)}`, method: 'session/cancel', payload: { args: { request: { sessionId } } } }),
  }, 30_000)
}
async function goalGet(agentId) {
  const r = await fetchJson(`${ORIGIN}/api/goals/get`, {
    method: 'POST', headers: { 'content-type': 'application/json', cookie: COOKIE },
    body: JSON.stringify({ type: 'client-request', rpcId: `g-${Math.random().toString(36).slice(2, 10)}`, method: 'goals/get', payload: { args: { agentId } } }),
  }, 60_000)
  return { status: r.status, ok: r.body?.result?.ok === true, goal: r.body?.result?.value ?? null, error: r.body?.result?.error ?? null }
}
async function goalPause(agentId) {
  const cur = await goalGet(agentId)
  if (cur.goal === null) return { status: cur.status, ok: false, error: cur.error ?? 'no goal' }
  const r = await fetchJson(`${ORIGIN}/api/goals/pause`, {
    method: 'POST', headers: { 'content-type': 'application/json', cookie: COOKIE },
    body: JSON.stringify({
      type: 'client-request', rpcId: `g-${Math.random().toString(36).slice(2, 10)}`, method: 'goals/pause',
      payload: { args: { agentId, ref: { id: cur.goal.id, revision: cur.goal.revision } } },
    }),
  }, 60_000)
  return { status: r.status, ok: r.body?.result?.ok === true, value: r.body?.result?.value ?? null, error: r.body?.result?.error ?? null }
}

const projectionMembers = (p) => {
  const members = p?.body?.result?.value?.data?.projection?.members
    ?? p?.body?.result?.value?.projection?.members ?? p?.body?.result?.value?.members ?? []
  return members.map((m) => ({
    instanceId: m.instanceId ?? m.id ?? null,
    templateId: m.templateId ?? null,
    label: m.label ?? m.displayName ?? null,
    lifecycle: m.lifecycle ?? m.lifecycleState ?? null,
    childSessionId: m.childSessionId ?? m.sessionId ?? null,
    result: m.memberResult ?? m.result ?? null,
  }))
}
async function readProjection() {
  const r = await teamRpc('team.getProjection', { teamSessionId: ROOT })
  return r
}
async function ledger() {
  const r = await teamRpc('team.getLedgerPage', { teamSessionId: ROOT, afterSequence: 0, limit: 1000 })
  const entries = r.body?.result?.value?.data?.entries ?? []
  return {
    status: r.status,
    requests: entries.filter((e) => e?.factType === 'control-request-recorded').map((e) => e.payload),
    decisions: entries.filter((e) => e?.factType === 'control-decision-recorded').map((e) => e.payload),
    consumptions: entries.filter((e) => e?.factType === 'control-allow-consumed').map((e) => e.payload),
    execution: entries.filter((e) => e?.factType === 'control-execution-result').map((e) => e.payload),
    raw: entries,
  }
}
async function waitFor(fn, timeoutMs, what) {
  const deadline = Date.now() + timeoutMs
  let last = null
  while (Date.now() < deadline) {
    last = await fn()
    if (last?.ok === true) return last
    await sleep(500)
  }
  throw new Error(`timeout waiting for ${what}; last=${JSON.stringify(last)?.slice(0, 600)}`)
}

// durable session log reader (zstd)
function sessionRecords(sessionId) {
  const root = join(HOME, 'sessions')
  if (!existsSync(root)) return []
  const records = []
  for (const wsEntry of readdirSync(root, { withFileTypes: true })) {
    if (!wsEntry.isDirectory()) continue
    const wsDir = join(root, wsEntry.name)
    for (const sesEntry of readdirSync(wsDir, { withFileTypes: true })) {
      if (!sesEntry.isDirectory() || !sesEntry.name.includes(sessionId)) continue
      const sdir = join(wsDir, sesEntry.name)
      for (const f of readdirSync(sdir)) {
        if (!/session.*\.jsonl\.zstd$/u.test(f)) continue
        let text = ''
        try {
          const buf = readFileSync(join(sdir, f))
          const magic = Buffer.from([0x28, 0xb5, 0x2f, 0xfd])
          const offs = []
          for (let i = 0; i + 3 < buf.length; i += 1) {
            if (buf[i] === magic[0] && buf[i + 1] === magic[1] && buf[i + 2] === magic[2] && buf[i + 3] === magic[3]) offs.push(i)
          }
          for (let k = 0; k < offs.length; k += 1) {
            const end = k + 1 < offs.length ? offs[k + 1] : buf.length
            try { text += zstdDecompressSync(buf.subarray(offs[k], end)).toString('utf8') } catch { /* frame */ }
          }
        } catch { text = '' }
        for (const line of text.split('\n')) { if (line.trim() === '') continue; try { records.push(JSON.parse(line)) } catch { /* skip */ } }
      }
    }
  }
  return records
}

// ── the flow ────────────────────────────────────────────────────────────────
async function flow() {
  const result = { schema: 'v016-install-flow/1', run: RUN, steps: {}, ok: false }
  const bootLine = await waitBoot(globalThis.__boot)
  log(`boot line: ${bootLine.replace(/\?token=[A-Za-z0-9_-]+/u, '?token=<redacted>')}`)
  ORIGIN = bootLine.replace(/\/\?token=.*$/u, '')
  const token = /\?token=([A-Za-z0-9_-]+)/u.exec(bootLine)[1]
  COOKIE = await authenticate(bootLine)
  result.origin = ORIGIN
  log(`authenticated (303 + cookie); origin=${ORIGIN}`)

  await waitFor(async () => {
    const r = await teamRpc('team.listRoots', {})
    return { ok: r.status === 200 && r.body?.result?.ok === true, status: r.status, body: r.body }
  }, 120_000, 'team-remote mount')
  result.steps.mount = { ok: true, at: new Date().toISOString() }
  log('team-remote MOUNTED (team.listRoots ok)')

  // 1) Team creation + Leader turn (the real model creates and delegates).
  const leaderPrompt = [
    `Operator acceptance run ${MARK}. Do exactly this, once:`,
    `1. Create ONE member from template "worker" with label "w1".`,
    `2. Delegate to it asynchronously this exact task: "Use the bash tool to run exactly: mkdir -p . && printf ${MARK} > install-flow-${STAMP}.txt && cat install-flow-${STAMP}.txt ; then reply with the command output." Do NOT run the command yourself.`,
    `3. When the member is done, call team_collect for it and include the collected body in your reply.`,
    `Reply with a one-line status when done.`,
  ].join('\n')
  const create = await teamRpc('team.create', { rootSessionId: ROOT, blueprintId: BP_ID }, 'v016create')
  result.steps.teamCreate = { status: create.status, ok: create.body?.result?.ok === true, error: create.body?.result?.error ?? null }
  log(`team.create status=${create.status} ok=${create.body?.result?.ok} err=${JSON.stringify(create.body?.result?.error ?? null)}`)
  const ensure = await teamRpc('team.ensureRootLive', { teamSessionId: ROOT }, 'v016ensure')
  log(`team.ensureRootLive ok=${ensure.body?.result?.ok} live=${ensure.body?.result?.value?.data?.live}`)
  const lp = await apiPrompt(ROOT, leaderPrompt, 'v016lead')
  log(`leader prompt status=${lp.status} accepted=${lp.body?.result?.value?.accepted}`)

  const member = await waitFor(async () => {
    const p = await readProjection()
    const members = projectionMembers(p)
    const w = members.find((m) => m.label === 'w1' || m.templateId === 'worker')
    return { ok: w !== undefined && w.childSessionId !== null, member: w, members, status: p.status }
  }, 180_000, 'member created by the Leader')
  result.steps.memberCreated = { member: member.member, members: member.members }
  log(`member created: ${JSON.stringify(member.member)}`)

  // 2) Member execution: a governed bash ask lands as a durable Team control
  //    request; the HUMAN (this driver) resolves it through the public RPC.
  // The shipped configuration may or may not surface a durable approval for the
  // member's bash. Wait up to 90s for one; if none appears and the command has
  // already executed, record that honestly as `none-required` (no product
  // change: this is a measurement of the shipped default).
  const ask = await waitFor(async () => {
    const l = await ledger()
    const req = l.requests.find((r) => (r.toolName === 'bash') && !l.decisions.some((d) => d.requestId === r.requestId))
    const file = join(WS, `install-flow-${STAMP}.txt`)
    return { ok: req !== undefined || existsSync(file), request: req ?? null, ledger: l, fileExists: existsSync(file) }
  }, 90_000, 'Member bash control request or side effect')
  const askRequest = ask.request
  if (askRequest !== null) {
    result.steps.pendingControl = { request: askRequest }
    log(`pending control: requestId=${askRequest.requestId} action=${askRequest.actionName} tool=${askRequest.toolName} authority=${askRequest.reviewAuthority ?? askRequest.authority}`)
    const resolve = await teamRpc('team.resolveControl', {
      teamSessionId: ROOT, requestId: askRequest.requestId, decision: 'allow', note: 'v016 install-flow human approval',
    }, 'v016approve')
    result.steps.humanApprove = { status: resolve.status, ok: resolve.body?.result?.ok === true, body: resolve.body?.result ?? resolve.body }
    log(`human team.resolveControl allow status=${resolve.status} ok=${resolve.body?.result?.ok}`)
  } else {
    result.steps.pendingControl = { request: null, finding: 'no durable approval was surfaced for the member bash in the shipped configuration' }
    result.steps.humanApprove = { ok: false, skipped: true, finding: 'member bash executed without an approval prompt; approval required the opt-in A6 plane (measured in part B)' }
    log('no pending control for the member bash; side effect already present -> approval=none-required (finding)')
  }

  const file = join(WS, `install-flow-${STAMP}.txt`)
  await waitFor(async () => ({ ok: existsSync(file), exists: existsSync(file) }), 180_000, 'member execution side effect')
  const executedBody = readFileSync(file, 'utf8')
  result.steps.memberExecuted = { ok: executedBody.includes(MARK), file, body: executedBody }
  log(`member executed: ${file} body=${JSON.stringify(executedBody.slice(0, 120))}`)

  const l2 = await ledger()
  const consumed = askRequest === null ? undefined : l2.consumptions.find((c) => c.requestId === askRequest.requestId)
  const execFact = askRequest === null ? undefined : l2.execution.find((e) => e.requestId === askRequest.requestId)
  result.steps.executionFacts = { consumption: consumed ?? null, execution: execFact ?? null }
  log(`consumption=${consumed !== undefined} execution=${execFact?.outcome ?? 'none'}`)

  // 3) Goal on the Member (the model creates it via its own tool).
  const memberSession = member.member.childSessionId
  const goalPrompt = [
    `Call create_goal with objective "v016 install-flow goal ${MARK}" and max_goal_rounds 3.`,
    `Then answer with one short line. Do not run any command.`,
  ].join('\n')
  const gp = await apiPrompt(memberSession, goalPrompt, 'v016goal')
  log(`member goal prompt status=${gp.status} ok=${gp.body?.result?.ok}`)
  const goal = await waitFor(async () => {
    const g = await goalGet(memberSession)
    return { ok: g.goal !== null && (g.goal.roundsStarted ?? 0) >= 1, goal: g.goal, status: g.status }
  }, 180_000, 'Member goal with >=1 automatic round')
  result.steps.goal = { ok: true, goal: goal.goal }
  log(`goal active: id=${goal.goal?.id} phase=${goal.goal?.phase} roundsStarted=${goal.goal?.roundsStarted}`)

  // 4) Stop: the exact RPCs the button issues (no DOM click — no headless browser here).
  const before = await goalGet(memberSession)
  const pause = await goalPause(memberSession)
  const cancel = await apiCancel(memberSession)
  const after = await goalGet(memberSession)
  const stopSeq = {
    before: before.goal === null ? null : { phase: before.goal.phase, revision: before.goal.revision, roundsStarted: before.goal.roundsStarted },
    pause: { status: pause.status, ok: pause.ok, value: pause.value, error: pause.error },
    cancel: { status: cancel.status, ok: cancel.body?.result?.ok === true },
    after: after.goal === null ? null : { phase: after.goal.phase, revision: after.goal.revision, roundsStarted: after.goal.roundsStarted },
    note: 'goals/get -> goals/pause -> session/cancel -> goals/get are the RPCs the Stop button issues; no DOM click occurred (no headless browser in this environment).',
  }
  const silentRecordsBefore = sessionRecords(memberSession).length
  await sleep(15_000)
  const silentRecordsAfter = sessionRecords(memberSession).length
  const afterQuiet = await goalGet(memberSession)
  stopSeq.silentWindowMs = 15_000
  stopSeq.recordsBefore = silentRecordsBefore
  stopSeq.recordsAfter = silentRecordsAfter
  stopSeq.recordsDelta = silentRecordsAfter - silentRecordsBefore
  stopSeq.roundsAfter = afterQuiet.goal?.roundsStarted ?? null
  stopSeq.ok = pause.ok && cancel.status === 200 && after.goal?.phase === 'paused'
    && (afterQuiet.goal?.roundsStarted ?? 0) === (after.goal?.roundsStarted ?? 0)
    && silentRecordsBefore === silentRecordsAfter
  result.steps.stop = stopSeq
  log(`stop: pause=${pause.ok} cancel=${cancel.status} phase=${after.goal?.phase} rounds=${stopSeq.roundsAfter} recordsDelta=${stopSeq.recordsDelta} ok=${stopSeq.ok}`)

  // 5) Result collection: ask the Leader to run team_collect, read the durable
  //    Leader log for the tool result carrying the marker.
  const collectPrompt = `Call team_collect for member w1 now and reply with the collected body verbatim.`
  const cp = await apiPrompt(ROOT, collectPrompt, 'v016collect')
  log(`leader collect prompt status=${cp.status}`)
  let collectBody = null
  const collectDeadline = Date.now() + 120_000
  while (Date.now() < collectDeadline) {
    const recs = sessionRecords(ROOT)
    for (const rec of recs) {
      if (rec.type !== 'tool/result') continue
      const text = JSON.stringify(rec.data?.message?.content ?? '')
      if (text.includes(MARK) && text.includes('install-flow')) { collectBody = text.slice(0, 1200); break }
    }
    if (collectBody !== null) break
    await sleep(1000)
  }
  result.steps.collect = { ok: collectBody !== null, body: collectBody }
  log(`collect: ok=${collectBody !== null}`)

  result.ok = result.steps.teamCreate.ok && result.steps.memberExecuted.ok && stopSeq.ok
  writeFileSync(join(LEDGER, `flow-r${RUN}.json`), JSON.stringify(result, null, 2) + '\n')
  return result
}

async function restart() {
  const boot = globalThis.__boot
  const before = await readProjection()
  const members = projectionMembers(before)
  const w = members.find((m) => m.label === 'w1' || m.templateId === 'worker')
  const goalBefore = w?.childSessionId ? await goalGet(w.childSessionId) : null
  boot.child.kill('SIGKILL')
  const deadline = Date.now() + 20_000
  while (boot.child.exitCode === null && Date.now() < deadline) await sleep(100)
  log(`host killed for cold restart (exit=${boot.child.exitCode})`)
  const boot2 = spawnHost()
  const url = await waitBoot(boot2)
  const cookie = await authenticate(url)
  const out = { schema: 'v016-install-cold-recovery/1', run: RUN, ok: false }
  out.bootLine = url.replace(/\?token=[A-Za-z0-9_-]+/u, '?token=<redacted>')
  ORIGIN = url.replace(/\/\?token=.*$/u, '')
  COOKIE = cookie
  await waitFor(async () => {
    const r = await teamRpc('team.getProjection', { teamSessionId: ROOT })
    return { ok: r.status === 200 && r.body?.result?.ok === true, status: r.status }
  }, 120_000, 'projection after cold restart')
  const p2 = await readProjection()
  const members2 = projectionMembers(p2)
  const w2 = members2.find((m) => m.label === 'w1' || m.templateId === 'worker')
  const g2 = w2?.childSessionId ? await goalGet(w2.childSessionId) : null
  const roundsBefore = g2?.goal?.roundsStarted ?? null
  const recordsBefore = w2?.childSessionId ? sessionRecords(w2.childSessionId).length : 0
  await sleep(20_000)
  const g3 = w2?.childSessionId ? await goalGet(w2.childSessionId) : null
  const recordsAfter = w2?.childSessionId ? sessionRecords(w2.childSessionId).length : 0
  out.members = members2
  out.memberPresent = w2 !== undefined
  out.goalBefore = goalBefore?.goal ?? null
  out.goalAfterRestart = g2?.goal ?? null
  out.goalAfterQuiet = g3?.goal ?? null
  out.roundsBefore = roundsBefore
  out.roundsAfterQuiet = g3?.goal?.roundsStarted ?? null
  out.recordsBefore = recordsBefore
  out.recordsAfter = recordsAfter
  const file = join(WS, `install-flow-${STAMP}.txt`)
  out.resultStillOnDisk = existsSync(file)
  out.ok = w2 !== undefined && g2?.goal?.phase === 'paused'
    && (g3?.goal?.roundsStarted ?? 0) === (g2?.goal?.roundsStarted ?? 0)
    && recordsBefore === recordsAfter
  log(`cold recovery: member=${out.memberPresent} goal=${g2?.goal?.phase} rounds=${roundsBefore}->${out.roundsAfterQuiet} records=${recordsBefore}->${recordsAfter} ok=${out.ok}`)
  writeFileSync(join(LEDGER, `cold-recovery-r${RUN}.json`), JSON.stringify(out, null, 2) + '\n')
  globalThis.__boot = boot2
  return out
}

// ── main ────────────────────────────────────────────────────────────────────
async function main() {
  if (PHASE === 'setup' || PHASE === 'all') {
    ensureHostInstall()
    pack()
    pluginAdd()
    writeProfileConfig()
    writeFileSync(join(LEDGER, 'install.txt'), [
      `run=${RUN}`,
      `tarball=${TARBALL}`,
      `sha256=${createHash('sha256').update(readFileSync(TARBALL)).digest('hex')}`,
      `bytes=${readFileSync(TARBALL).length}`,
      `host=${join(HOST_DIR, 'node_modules', '@deepseek-ai', 'dsh')}`,
      `profile=${join(HOME, 'profiles', 'web')}`,
      '',
    ].join('\n'))
  }
  if (PHASE === 'boot' || PHASE === 'all') {
    globalThis.__boot = spawnHost()
    const url = await waitBoot(globalThis.__boot)
    log(`boot line: ${url.replace(/\?token=[A-Za-z0-9_-]+/u, '?token=<redacted>')}`)
    if (PHASE === 'boot') { writeFileSync(join(LEDGER, 'boot.txt'), url + '\n'); return }
  }
  if (PHASE === 'flow' || PHASE === 'all') {
    log('── flow: team.create -> member execute -> human approval -> goal -> stop -> collect ──')
    const r = await flow()
    if (!r.ok) { log('FLOW FAILED (see flow JSON)'); process.exitCode = 2 }
  }
  if (PHASE === 'restart' || PHASE === 'all') {
    log('── cold recovery: SIGKILL + restart on the same DSH_HOME ──')
    const c = await restart()
    if (!c.ok) { log('COLD RECOVERY FAILED'); process.exitCode = 2 }
  }
  if (PHASE === 'all') {
    log('teardown: stopping host')
    if (globalThis.__boot?.child?.exitCode === null) globalThis.__boot.child.kill('SIGTERM')
    await sleep(1500)
    log(`world retained at ${BASE} (evidence; delete after the run)`)
  }
}

main().catch((e) => {
  log(`FATAL ${String(e?.stack ?? e)}`)
  process.exitCode = 1
})
