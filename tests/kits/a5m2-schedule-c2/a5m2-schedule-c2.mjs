#!/usr/bin/env node
/**
 * A5M2 schedule C2 — REAL-HOST runner (root 22:07 order: real
 * implementation, not a skeleton; the BOOT itself remains gated behind
 * A5M2_SCHED_C2_WINDOW=GRANTED — the window is root's ruling).
 *
 * ONE boot per granted window; the FIRST failed criterion tears down and
 * STOPS pending adjudication (root 21:22). Criteria (both governed tools,
 * ordinary business evidence only; explicit oracle per call below):
 *   C1 list returns REAL records — three tasks seeded through THIS world's
 *      legal create path (member-session native schedule_create; the tool
 *      is ungoverned here on purpose: schedule_create is not a permission
 *      tool — SP-R13 vocabulary), then governed schedule_list ask ->
 *      public team.resolveControl v4 ALLOW -> the tool result names all
 *      three seeded ids/titles.
 *   C2 granted delete -> PERSISTENT disappearance: delete ALPHA -> allow;
 *      the SUCCESSOR governed list (separate call) lacks ALPHA, keeps
 *      BETA+GAMMA.
 *   C3 deny -> unchanged: delete BETA -> public DENY -> successor list
 *      still carries BETA; no consumption fact.
 *   C4 abandon -> unchanged: a governed list claim is abandoned (member
 *      prompt flight cancelled); ledger records terminal non-pending;
 *      successor list identical; otherwise honest FAIL pending ruling.
 *   C5 absent id: granted delete of the absent id returns the REAL error
 *      VALUE {code:'invalid_selector'} (service-error-value law on the
 *      real published class); nothing moved.
 * Evidence: durable Control facts (storages/team_domain.json read-back +
 * team.getLedgerPage v1), member-turn tool results captured from the model
 * requests, successor list calls. Existing logs only — no new hooks.
 *
 * Reuse entry points (actually read, not imagined): DshInstance +
 * patchFile (tests/characterization/lib/instance.mjs), util
 * (portInUse/waitForPortFree/logTail), tests/paths.mjs pins,
 * packages/tools/harness/mock-deepseek.mjs startMockModel({port,decide})
 * wired via DEEPSEEK_BASE_URL BEFORE instance.start (pr-d :1480 shape),
 * public channels exactly as proven: POST /team-remote/{method}
 * client-request envelope; team.create v1 {rootSessionId, blueprintId};
 * team_create_member {rootSessionId, requestToken, delegationTemplateId,
 * label}; team.resolveControl v4 {teamSessionId, requestId, decision,
 * note}; POST /api/session/prompt client-request shape (pr-d :526-545);
 * authenticate = 303 + set-cookie over /?token= (pr-d :424-431).
 * Install contract (root-ruled forward path): bf4 success-standard fixture
 * lock (sha 163ed899…, 15 pins @0.2.0-rc.2 + cordis 4.0.4 + yaml/zod, 523
 * resolutions) + ONLY the file: entry for the canonical rootpack;
 * --frozen-lockfile --offline (bare-manifest auto-resolve structurally
 * absent).
 */
import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, openSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { CLIENT_COMMIT_HASH, findTestRepoRoot } from '../../../tests/paths.mjs'
import { DshInstance } from '../../../tests/characterization/lib/instance.mjs'
import { logTail, portInUse, waitForPortFree } from '../../../tests/characterization/lib/util.mjs'
import { startMockModel } from '../../../packages/tools/harness/mock-deepseek.mjs'

const PIN_PKG_SHA256 = 'eda06b4a78bba180c0acef1b25237f3f741917385cd0728ee66adc737b1cd09d' // CENTER CANONICAL rootpack @874f3ae0d (3,857,455B/1821 entries; re-measured by this lane, identical)
const PIN_PKG_BYTES_MAX = 4_000_000
const PIN_TGZ = '.worktrees/pack-int/out-874f3ae0d-20261023T213601Z/dsh-agent-team-0.1.1-alpha.2.tgz'
const FIXTURE_LOCK = 'tests/homes/.a5m2-bf4-fixture-20261023T20-55-19Z/install/pnpm-lock.yaml'
const FIXTURE_LOCK_SHA256 = '163ed8991902f7dc07fd828181c0184cb09377a1aa28cbb0fff0cc6bd788310c'
const WORLD_BUDGET = Object.freeze({
  installBytesMax: 25_000_000,
  stateBytesMax: 100_000_000,
  evidenceBytesMax: 100_000_000,
  worldTotalMax: 250_000_000, // two-world combined 500MB per root 21:29; image keeps its own 500MB
})
const HOST_PORT = 3185
const MOCK_PORT = 3496
const WORLD_PREFIX = 'a5m2-sched-c2'
const BP_ID = 'team.a5m2-sched-c2'
const SEED_TITLES = ['A5M2SEED-ALPHA', 'A5M2SEED-BETA', 'A5M2SEED-GAMMA']
const ABSENT_ID = 'sch_a5m2_absent_zz'
const NONCE = Math.random().toString(36).slice(2, 8)

function refuse(reason) {
  console.error(`a5m2-schedule-c2: REFUSED — ${reason}`)
  process.exit(3)
}
if (process.env.A5M2_SCHED_C2_WINDOW !== 'GRANTED') {
  console.log(JSON.stringify({
    implemented: true, bootable: false,
    reason: 'window env A5M2_SCHED_C2_WINDOW not GRANTED (root ruling pending) — cannot boot anything',
    pinPkgSha256: PIN_PKG_SHA256, pinPkgBytesMax: PIN_PKG_BYTES_MAX, fixtureLockSha256: FIXTURE_LOCK_SHA256,
    worldBudget: WORLD_BUDGET, hostPort: HOST_PORT, mockPort: MOCK_PORT, worldPrefix: WORLD_PREFIX,
    criteria: ['C0', 'C1', 'C2', 'C3', 'C4', 'C5'],
  }, null, 2))
  process.exit(0)
}

// ── state + helpers ────────────────────────────────────────────────────────
const ROOT_DIR = findTestRepoRoot()
const HOST_TREE = join(ROOT_DIR, 'tests', 'deepseek-harness-test-use')
const RUN_STAMP = new Date().toISOString().replace(/[:.]/g, '-')
const HOME = join(ROOT_DIR, 'tests', 'homes', `${WORLD_PREFIX}-${RUN_STAMP}Z`)
const RUN_DIR = join(ROOT_DIR, 'dev', 'agent-workflow', 'evidence', 'a5m2-schedule-c2', `run-${RUN_STAMP}`)
const TRANSCRIPT = []
const results = []
const toolResults = [] // captured tool-result texts, in model-request order
let currentCriterion = 'setup'
let mock = null
let host = null
const log = (line) => { console.log(`[sched-c2] ${line}`) }
function check(critId, name, ok, detail) {
  results.push({ critId, name, ok, detail: String(detail).slice(0, 600) })
  log(`${critId} ${ok ? 'PASS' : 'FAIL'} — ${name} ${ok ? '' : `detail=${String(detail).slice(0, 300)}`}`)
  if (!ok) { teardown(); finish(ok ? 0 : 1) } // first failure: teardown + STOP
}
function dieFatal(msg) {
  log(`FATAL (${currentCriterion}): ${String(msg).slice(0, 500)}`)
  teardown()
  finish(2)
}
const sha256 = (file) => createHash('sha256').update(readFileSync(file)).digest('hex')
const duBytes = (dir) => Number(execFileSync('du', ['-sb', dir], { encoding: 'utf8' }).split('\t')[0])
function budget(label, dir, max) {
  const b = duBytes(dir)
  log(`budget ${label}: ${b}B (max ${max}B)`)
  if (b > max) dieFatal(`budget breach ${label}: ${b} > ${max}`)
}
function finish(rc) {
  try {
    mkdirSync(RUN_DIR, { recursive: true })
    writeFileSync(join(RUN_DIR, 'results.json'), JSON.stringify({ stamp: RUN_STAMP, rc, results, transcript: TRANSCRIPT.slice(-400) }, null, 2))
    const total = duBytes(HOME)
    log(`world total ${total}B (hard cap ${WORLD_BUDGET.worldTotalMax}B)${total > WORLD_BUDGET.worldTotalMax ? ' — BREACH, world retained' : ''}`)
  } finally { process.exit(rc) }
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
async function waitFor(label, timeoutMs, pred) {
  const deadline = Date.now() + timeoutMs
  for (;;) {
    const v = await pred()
    if (v !== null && v !== undefined && v !== false) return v
    if (Date.now() > deadline) dieFatal(`timeout waiting for ${label}`)
    await sleep(500)
  }
}

// ── pins + fresh world (fail closed) ───────────────────────────────────────
const tgzPath = join(ROOT_DIR, PIN_TGZ)
if (!existsSync(tgzPath)) dieFatal(`canonical rootpack missing: ${PIN_TGZ}`)
if (statSync(tgzPath).size > PIN_PKG_BYTES_MAX) dieFatal(`rootpack bytes > bound ${PIN_PKG_BYTES_MAX}`)
if (sha256(tgzPath) !== PIN_PKG_SHA256) dieFatal('rootpack sha256 drifted from the center canonical pin')
const lockPath = join(ROOT_DIR, FIXTURE_LOCK)
if (!existsSync(lockPath) || sha256(lockPath) !== FIXTURE_LOCK_SHA256) dieFatal('bf4 fixture lock missing/drifted (install contract is pin-bound)')
if (existsSync(HOME) && readdirSync(HOME).length > 0) dieFatal(`home ${HOME} exists non-empty — fail closed`)
for (const p of [HOME, join(HOME, 'blueprints'), join(HOME, 'storages'), RUN_DIR]) mkdirSync(p, { recursive: true })
writeFileSync(join(HOME, 'a5m2-sched-lock.json'), JSON.stringify({ world: HOME, pid: process.pid, kit: 'a5m2-schedule-c2.mjs', stamp: RUN_STAMP }, null, 2))
if (portInUse(HOST_PORT) || portInUse(MOCK_PORT)) dieFatal(`ports ${HOST_PORT}/${MOCK_PORT} not idle at start (root 21:2x avoidance table: image 3182/3497, G6 3186, legacy 3183/3184/3498/3499 untouched)`)

// ── install: fixture lock + ONLY the canonical file: entry, offline/frozen ─
const INSTALL = join(HOME, `install-${PIN_PKG_SHA256.slice(0, 9)}`)
mkdirSync(INSTALL, { recursive: true })
writeFileSync(join(INSTALL, 'package.json'), JSON.stringify({
  name: 'a5m2-sched-c2-install', version: '0.0.0', private: true,
  dependencies: { 'dsh-agent-team': `file:${tgzPath}` },
}, null, 2))
writeFileSync(join(INSTALL, 'pnpm-lock.yaml'), readFileSync(lockPath, 'utf8'))
const installLogFd = openSync(join(RUN_DIR, 'install.log'), 'a')
execFileSync('pnpm', ['install', '--frozen-lockfile', '--offline'], { cwd: INSTALL, stdio: ['ignore', installLogFd, installLogFd] })
const PKG_DIR = join(INSTALL, 'node_modules', 'dsh-agent-team')
if (!existsSync(join(PKG_DIR, 'packages/runtime/src/plugin/host.js'))) dieFatal('installed package missing ./host plugin entry (install layout mismatch)')
execFileSync('chmod', ['-R', 'a-w', INSTALL], { stdio: 'ignore' })
budget('install', INSTALL, WORLD_BUDGET.installBytesMax)

// ── blueprint (saved-source catalog = the real team.create path) ──────────
// Member permissions: schedule_list/schedule_delete ask-lane any-rules —
// the ONLY projectable shape for the invocation-only pair (AUTH closed
// set). NO schedule_create entry: it is not a permission tool (a policy
// naming it fails plane build with the vocabulary refusal — SP-R13b), so
// the legal create seeds run as ordinary ungoverned host-tool calls.
writeFileSync(join(HOME, 'blueprints', 'a5m2-sched-c2.yaml'), [
  '---',
  'schemaVersion: 3',
  `blueprintId: ${BP_ID}`,
  'revision: "1"',
  'leader:',
  '  templateId: leader',
  '  persona: "You are the leader of the A5M2 schedule C2 team."',
  'members:',
  '  - templateId: sched-worker',
  '    persona: "You are the schedule worker. Follow the marker instructions literally and only."',
  '    capabilities:',
  '      permissions:',
  '        default: deny',
  '        ask:',
  '          - tool: schedule_list',
  '            resource: { kind: any }',
  '          - tool: schedule_delete',
  '            resource: { kind: any }',
  '        allow: []',
  '        deny: []',
  'memberEnvelopes: []',
  'requirements: []',
  'permissionMutationEnvelope:',
  '  rules: []',
  'policyStates: []',
  '',
].join('\n'))

// ── row mount through the public profile-patch seam ───────────────────────
function writePatch(patchPath) {
  mkdirSync(dirname(patchPath), { recursive: true })
  const rowName = pathToFileURL(join(PKG_DIR, 'packages/runtime/src/plugin/host.js')).href
  writeFileSync(patchPath, [
    `- insert:`,
    '    id: dsh-agent-team',
    `    name: ${JSON.stringify(rowName)}`,
    '    config:',
    `      blueprintDir: ${JSON.stringify(join(HOME, 'blueprints'))}`,
    '      seedMembers: []',
    '      generation: 1',
    '      staticModel:',
    '        provider: deepseek-official',
    '        model: a5m2-sched-model',
    '      deniedSelection: null',
    '      mcpServers: []',
    '      mcpServer: null',
    '      environmentFacts: []',
    '      externalPolicyFacts:',
    '        hard: {}',
    '        capabilityExists: {}',
    '',
  ].join('\n'))
}

// ── mock model (decide machine; captures tool results + member tool surface) ─
const memberToolsSeen = []
function lastUserText(req) {
  const msgs = req?.messages ?? req?.body?.messages ?? []
  for (let i = msgs.length - 1; i >= 0; i -= 1) {
    const m = msgs[i]
    if (m?.role !== 'user') continue
    const c = m.content
    if (typeof c === 'string') return c
    if (Array.isArray(c)) return c.filter((p) => p?.type === 'text').map((p) => p.text).join('\n')
  }
  return ''
}
function captureToolResults(req) {
  const msgs = req?.messages ?? req?.body?.messages ?? []
  const tools = req?.tools ?? req?.body?.tools ?? null
  if (Array.isArray(tools) && tools.length > 0 && memberToolsSeen.length === 0) {
    for (const t of tools) {
      const n = typeof t === 'string' ? t : t?.name ?? t?.id
      if (typeof n === 'string') memberToolsSeen.push(n)
    }
  }
  for (const m of msgs) {
    const parts = Array.isArray(m?.content) ? m.content : []
    for (const p of parts) {
      if (p?.type === 'tool-result' || m?.role === 'tool') {
        const txt = typeof p?.text === 'string' ? p.text : typeof p?.result === 'string' ? p.result : JSON.stringify(p?.result ?? p?.text ?? m?.content ?? '')
        const key = `${p?.toolName ?? p?.toolCallId ?? m?.toolName ?? ''}|${txt.slice(0, 180)}`
        if (!toolResults.some((t) => t.key === key)) toolResults.push({ key, toolName: p?.toolName ?? m?.toolName ?? 'unknown', text: txt })
      }
    }
  }
}
function decide({ req }) {
  captureToolResults(req)
  const text = lastUserText(req)
  const mk = (name, args) => ({ kind: 'tool-call', toolCalls: [{ id: `call-c2-${Math.random().toString(36).slice(2, 10)}`, name, arguments: args }] })
  if (text.startsWith('A5M2-C2-LEADER')) {
    return mk('team_create_member', { rootSessionId: currentRoot, requestToken: `c2-create-${NONCE}`, delegationTemplateId: 'sched-worker', label: 'sched1' })
  }
  if (text.startsWith('SEED-')) {
    const i = Number(text.slice(5))
    return mk('schedule_create', { title: SEED_TITLES[i], prompt: `a5m2 seed ${SEED_TITLES[i]}`, scheduledAt: new Date(Date.now() + 86_400_000).toISOString() })
  }
  if (text.startsWith('LIST')) return mk('schedule_list', {})
  if (text.startsWith('DELETE-ALPHA')) return mk('schedule_delete', { id: seedIds[0] ?? 'unresolved' })
  if (text.startsWith('DELETE-BETA')) return mk('schedule_delete', { id: seedIds[1] ?? 'unresolved' })
  if (text.startsWith('DELETE-ABSENT')) return mk('schedule_delete', { id: ABSENT_ID })
  return { kind: 'text', text: `TURN-DONE ${NONCE}` }
}

// ── public channels (shapes proven by pr-d-control-real-host) ─────────────
async function fetchJson(url, init, timeoutMs = 240_000) {
  const res = await fetch(url, { ...init, signal: AbortSignal.timeout(timeoutMs) })
  let body = null
  try { body = await res.json() } catch { /* raw */ }
  return { status: res.status, body }
}
let origin = null
let cookie = null
async function remoteCall(method, params, tag, version = 1) {
  const res = await fetchJson(`${origin}/team-remote/${method}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie },
    body: JSON.stringify({ type: 'client-request', rpcId: `${tag}-${Math.random().toString(36).slice(2, 12)}`, method, payload: { version, params } }),
  })
  TRANSCRIPT.push({ channel: 'team-remote', method, version, params, status: res.status, body: res.body })
  return res
}
async function remoteCallReady(method, params, tag, version = 1, retries = 20) {
  let last = null
  for (let i = 0; i < retries; i += 1) {
    last = await remoteCall(method, params, tag, version)
    if (last.status !== 429) return last
    await sleep(1500)
  }
  return last
}
const resultError = (b) => b?.error ?? b?.payload?.error ?? null
const resultData = (b) => b?.result ?? b?.payload?.result ?? b?.payload ?? null
async function apiPrompt(sessionId, text, tag = 'c2', abortable = false) {
  const body = JSON.stringify({
    type: 'client-request',
    rpcId: `${tag}-${Math.random().toString(36).slice(2, 12)}`,
    method: 'session/prompt',
    payload: { args: { request: { requestId: `${tag}-r-${Math.random().toString(36).slice(2, 12)}`, sessionId, mode: 'queue', content: [{ type: 'text', text }] } } },
  })
  const ac = abortable ? new AbortController() : null
  const p = fetch(`${origin}/api/session/prompt`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie },
    body, signal: ac ? ac.signal : AbortSignal.timeout(240_000),
  }).then(async (r) => ({ status: r.status, body: await r.json().catch(() => null) }))
  if (abortable) return { promise: p, abort: () => ac.abort() }
  const res = await p
  TRANSCRIPT.push({ channel: 'session/prompt', text, status: res.status, body: res.body })
  if (res.status !== 200 && res.status !== 202) dieFatal(`session/prompt ${tag} status=${res.status} body=${JSON.stringify(res.body).slice(0, 300)}`)
  return res
}

// ── durable control facts read-back (existing storage read, read-only) ────
function domainFacts() {
  const f = join(HOME, 'storages', 'team_domain.json')
  if (!existsSync(f)) return null
  return JSON.parse(readFileSync(f, 'utf8'))
}
function collectRows(node, out) {
  if (node === null || typeof node !== 'object') return out
  if (Array.isArray(node)) { for (const v of node) collectRows(v, out); return out }
  if (typeof node.requestId === 'string') out.push(node)
  for (const v of Object.values(node)) collectRows(v, out)
  return out
}
async function findPendingRequest(toolName) {
  const facts = domainFacts()
  if (facts === null) return null
  const rows = collectRows(facts, [])
  const hit = rows.find((r) => (r.status === 'pending' || r.state === 'pending')
    && JSON.stringify(r).includes(`tool:${toolName}`))
  return hit?.requestId ?? null
}
async function waitPending(toolName, label) {
  return waitFor(`pending control row for ${toolName} (${label})`, 120_000, () => findPendingRequest(toolName))
}
async function resolvePending(requestId, decision, tag) {
  const res = await remoteCallReady('team.resolveControl', { teamSessionId: currentRoot, requestId, decision, note: `sched-c2 ${tag}` }, tag, 4)
  const err = resultError(res.body)
  if (err !== null) dieFatal(`resolveControl ${decision} ${tag} failed: ${JSON.stringify(err).slice(0, 300)}`)
  return res
}
// ask -> (optional decision) -> returns after the decision is durable
async function driveGoverned(memberSession, marker, toolName, decision, tag) {
  const pre = toolResults.length
  await apiPrompt(memberSession, marker, tag)
  const requestId = await waitPending(toolName, tag)
  if (decision !== null) await resolvePending(requestId, decision, tag)
  return { requestId, resultFrom: pre }
}
async function lastResultFor(toolName, since) {
  return waitFor(`${toolName} result after ${since}`, 60_000, () => {
    const hits = toolResults.slice(since).filter((t) => String(t.toolName).includes(toolName))
    return hits.length > 0 ? hits[hits.length - 1].text : null
  })
}

// ── boot + criteria orchestration ──────────────────────────────────────────
let currentRoot = null
let seedIds = []
function teardown() {
  try { mock?.stop?.() } catch { /* recorded below */ }
  try { host?.instance?.stop?.({ timeoutMs: 30_000 }) } catch { /* recorded below */ }
}
async function main() {
  currentCriterion = 'boot'
  mock = await startMockModel({ port: MOCK_PORT, decide, log: (l) => TRANSCRIPT.push({ channel: 'mock', line: String(l).slice(0, 200) }) })
  process.env.DEEPSEEK_BASE_URL = `http://127.0.0.1:${MOCK_PORT}` // host reads base URL from the trusted environment layer (pr-d :1474-1480)
  const instLogDir = join(RUN_DIR, 'instance')
  mkdirSync(instLogDir, { recursive: true })
  const instance = new DshInstance({ hostTree: HOST_TREE, dshHome: HOME, port: HOST_PORT, clientCommitHash: CLIENT_COMMIT_HASH, logDir: instLogDir })
  writePatch(instance.patchFile)
  const started = await instance.start({ timeoutMs: 240_000 })
  const m = /^http:\/\/127\.0\.0\.1:(\d+)\/\?token=([A-Za-z0-9_-]+)$/.exec(started.url)
  if (m === null) dieFatal(`unexpected boot url: ${started.url}`)
  origin = `http://127.0.0.1:${m[1]}`
  const auth = await fetch(`${origin}/?token=${m[2]}`, { redirect: 'manual', signal: AbortSignal.timeout(30_000) })
  const setCookie = auth.headers.get('set-cookie')
  if (auth.status !== 303 || setCookie === null) dieFatal(`authenticate status=${auth.status} (expected 303 + set-cookie)`)
  cookie = setCookie.split(';', 1)[0]
  host = { instance, logPath: started.logPath }
  log(`host booted at ${origin}`)

  currentCriterion = 'setup'
  const sc = await fetchJson(`${origin}/api/session/create`, {
    method: 'POST', headers: { 'content-type': 'application/json', cookie },
    body: JSON.stringify({ type: 'client-request', rpcId: `c2-sc-${NONCE}`, method: 'session/create', payload: { args: { request: { requestId: `c2-scr-${NONCE}`, title: 'a5m2-sched-c2' } } } }),
  })
  {
    const d = resultData(sc.body)
    const id = d?.sessionId ?? d?.session?.id ?? d?.id
    if (typeof id !== 'string') dieFatal(`session/create shape unknown: status=${sc.status} body=${JSON.stringify(sc.body).slice(0, 400)}`)
    currentRoot = id
  }
  const created = await remoteCallReady('team.create', { rootSessionId: currentRoot, blueprintId: BP_ID }, 'c2-create', 1)
  if (resultError(created.body) !== null) dieFatal(`team.create failed: ${JSON.stringify(resultError(created.body)).slice(0, 400)}`)
  log(`team created at root session ${currentRoot}`)

  // member through the leader model turn (real create path)
  await apiPrompt(currentRoot, `A5M2-C2-LEADER ${NONCE}`, 'c2-leader')
  const memberSession = await waitFor('member session in team_domain', 120_000, () => {
    const facts = domainFacts()
    if (facts === null) return null
    const found = []
    const walk = (n) => {
      if (n === null || typeof n !== 'object') return
      if (Array.isArray(n)) { n.forEach(walk); return }
      for (const [k, v] of Object.entries(n)) {
        if ((k === 'sessionId' || k === 'memberSessionId') && typeof v === 'string' && v !== currentRoot) found.push(v)
        else walk(v)
      }
    }
    walk(facts)
    return found[0] ?? null
  })
  log(`member session ${memberSession}`)

  // C0 — visibility receipt BEFORE any seed (root 22:10: do not ASSUME the
  // governed member surface exposes the public create entry; probe a text
  // turn first and read the tool list off the model request). Absent entry
  // = concrete reported gap, not a TODO.
  currentCriterion = 'C0-seed-entry-visibility'
  await apiPrompt(memberSession, `TOOLS-CHECK ${NONCE}`, 'c2-c0')
  await waitFor('member tool surface captured from a model request', 60_000, () => (memberToolsSeen.length > 0 ? true : null))
  TRANSCRIPT.push({ channel: 'receipt', kind: 'member-tool-surface', tools: memberToolsSeen })
  const need = ['schedule_create', 'schedule_list', 'schedule_delete']
  const missing = need.filter((n) => !memberToolsSeen.includes(n))
  check('C0', 'member model-facing surface visibly carries the legal create entry AND the governed pair',
    missing.length === 0, `visible=${memberToolsSeen.join(',')} missing=${missing.join(',') || 'none'}`)

  // seeds: legal create path (ungoverned native tool; result carries ids)
  currentCriterion = 'seed'
  for (let i = 0; i < 3; i += 1) {
    const pre = toolResults.length
    await apiPrompt(memberSession, `SEED-${i}`, `c2-seed${i}`)
    const res = await waitFor(`seed ${i} tool result`, 90_000, () => {
      const hits = toolResults.slice(pre).filter((t) => String(t.toolName).includes('schedule_create'))
      return hits.length > 0 ? hits[hits.length - 1].text : null
    })
    const ids = [...String(res).matchAll(/sch_[A-Za-z0-9_-]+/g)].map((x) => x[0])
    if (ids.length !== 1) dieFatal(`seed ${i} produced ${ids.length} ids (expected exactly 1) from result: ${String(res).slice(0, 250)}`)
    seedIds.push(ids[0])
  }
  log(`seeded ids: ${seedIds.join(',')}`)
  budget('state', HOME, WORLD_BUDGET.stateBytesMax)

  // C1 — governed list returns the real seeded records
  currentCriterion = 'C1'
  {
    const { requestId, resultFrom } = await driveGoverned(memberSession, 'LIST-1', 'schedule_list', 'allow', 'c2-c1')
    const res = await lastResultFor('schedule_list', resultFrom)
    const allIn = SEED_TITLES.every((t) => res.includes(t)) && seedIds.every((id) => res.includes(id))
    check('C1', 'list returns all three real seeded records (ids+titles) after public ALLOW', allIn, `requestId=${requestId} result=${res.slice(0, 400)}`)
  }

  // C2 — granted delete: persistent disappearance vs the SUCCESSOR list
  currentCriterion = 'C2'
  {
    const del = await driveGoverned(memberSession, 'DELETE-ALPHA', 'schedule_delete', 'allow', 'c2-c2del')
    const delRes = await lastResultFor('schedule_delete', del.resultFrom)
    const lst = await driveGoverned(memberSession, 'LIST-2', 'schedule_list', 'allow', 'c2-c2lst')
    const res = await lastResultFor('schedule_list', lst.resultFrom)
    check('C2', 'granted delete ALPHA -> successor list lacks ALPHA and keeps BETA+GAMMA (persistent)',
      !res.includes(seedIds[0]) && res.includes(seedIds[1]) && res.includes(seedIds[2]) && !/error|invalid/i.test(String(delRes).slice(0, 120)),
      `del=${String(delRes).slice(0, 180)} list=${res.slice(0, 300)}`)
  }

  // C3 — public DENY: BETA unchanged
  currentCriterion = 'C3'
  {
    const { requestId } = await driveGoverned(memberSession, 'DELETE-BETA', 'schedule_delete', 'deny', 'c2-c3')
    const lst = await driveGoverned(memberSession, 'LIST-3', 'schedule_list', 'allow', 'c2-c3lst')
    const res = await lastResultFor('schedule_list', lst.resultFrom)
    const consumed = collectRows(domainFacts(), []).find((r) => r.requestId === requestId)
    check('C3', 'public DENY on delete BETA -> successor list still carries BETA; request denied not consumed',
      res.includes(seedIds[1]) && !/consumed/i.test(JSON.stringify(consumed ?? {})),
      `requestId=${requestId} row=${JSON.stringify(consumed ?? null).slice(0, 250)} list=${res.slice(0, 250)}`)
  }

  // C4 — abandon a governed list claim: unchanged
  currentCriterion = 'C4'
  {
    const pre = toolResults.length
    const { promise, abort } = await apiPrompt(memberSession, 'LIST-4-ABANDON', 'c2-c4', true)
    const requestId = await waitPending('schedule_list', 'c2-c4')
    abort()
    await promise.catch(() => {})
    const terminal = await waitFor('abandonment terminal fact', 60_000, () => {
      const row = collectRows(domainFacts(), []).find((r) => r.requestId === requestId)
      const st = row?.status ?? row?.state
      return st !== undefined && st !== 'pending' ? st : null
    })
    const lst = await driveGoverned(memberSession, 'LIST-5', 'schedule_list', 'allow', 'c2-c4lst')
    const res = await lastResultFor('schedule_list', lst.resultFrom)
    check('C4', 'abandoned governed list claim -> terminal non-pending fact; records unchanged (BETA+GAMMA, ALPHA absent)',
      res.includes(seedIds[1]) && res.includes(seedIds[2]) && !res.includes(seedIds[0]),
      `requestId=${requestId} terminal=${terminal} resultsSeen=${toolResults.length - pre}`)
  }

  // C5 — absent id: real published error value
  currentCriterion = 'C5'
  {
    const { requestId, resultFrom } = await driveGoverned(memberSession, 'DELETE-ABSENT', 'schedule_delete', 'allow', 'c2-c5')
    const res = await lastResultFor('schedule_delete', resultFrom)
    check('C5', `absent-id granted delete returns the real error value (invalid_selector) on ${ABSENT_ID}`,
      res.includes('invalid_selector'), `requestId=${requestId} result=${res.slice(0, 300)}`)
  }

  teardown()
  finish(results.every((r) => r.ok) ? 0 : 1)
}
main().catch((e) => dieFatal(e?.stack ?? e))
