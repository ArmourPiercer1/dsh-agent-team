/**
 * a5x-kit2.mjs — PoC-PLAN A1/A2-host/A3 multi-member runner (PoC banner).
 * One Host boot, three members (sessions on the same preset roster):
 *   M1 = read rootA(+big window), write rootA, network deny, evil, late-same-name
 *   M2 = read rootB, write rootB+wonly, network allow (prefix 127.0.0.1:3497)
 *   CTL = same roster, NO policy → probe plants nothing → native ungoverned path
 * Real model dispatch drives each leg (a5p1 step-counter lanes; never
 * transcript-derived). HTTP fixtures on 3497/3498 (MOCK band) carry per-path
 * hit counters → "deny produced zero connections" is measured, not asserted.
 */
import { spawn } from 'node:child_process'
import { createServer } from 'node:http'
import { appendFileSync, existsSync, linkSync, mkdirSync, openSync, readFileSync, symlinkSync, unlinkSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { CLIENT_COMMIT_HASH, TEST_USE_BASELINE_SHA, TEST_USE_REL, TEST_HOME_ROOT_REL, STABLE_INSTANCE_PORT } from '../../paths.mjs'
import { presetDeclarationRow, PERSONA_ROW_NAME, persistentShellGroup } from '../_shared/preset-seam.mjs'
import { startMockModel } from '../../../packages/tools/harness/mock-deepseek.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const WORKTREE = resolve(HERE, '..', '..', '..')
const TEST_USE = join(WORKTREE, TEST_USE_REL)
const HOST_BIN = join(TEST_USE, 'apps', 'cli', 'lib', 'bin.js')
const RUN_STAMP = process.env.A5X_STAMP ?? new Date().toISOString().replace(/[-:]/g, '').slice(0, 15)
const PORT = Number(process.env.A5X_PORT ?? 3186)
const EVIDENCE = join(WORKTREE, 'dev', 'agent-workflow', 'evidence', `a5x-pocA1-${RUN_STAMP}`)
const HOME = join(WORKTREE, TEST_HOME_ROOT_REL, `a5x-pocA1-${RUN_STAMP}`)
const LEDGER = join(EVIDENCE, 'ledger.jsonl')
const HOST_LOG = join(EVIDENCE, 'host.log')
const ROOT_A = join(EVIDENCE, 'rootA')
const ROOT_B = join(EVIDENCE, 'rootB')
const WONLY = join(EVIDENCE, 'wonly')
const SECRET_DIR = join(EVIDENCE, 'secret')
const SECRET = join(SECRET_DIR, 'outside.md')
const ORIGIN = `http://127.0.0.1:${PORT}`
const FIX_PORT = 3497
const HOP_PORT = 3498
const SID = (lane) => `a5x2-${lane}-${RUN_STAMP}`
const POLICIES_FILE = join(EVIDENCE, 'policies.json')

const log = (m) => console.log(`[a5x2 ${new Date().toISOString().slice(11, 19)}] ${m}`)

// ── YAML block emitter (same measured rules as a5x-kit: list-insert, quoting) ─
function yScalar(v) {
  const s = String(v)
  return /^[@`]/.test(s) || /[:#{}[\]"']|^\s|\s$/.test(s) || s === '' ? JSON.stringify(s) : s
}
function yLines(key, value, indent) {
  const pad = '  '.repeat(indent)
  if (Array.isArray(value)) {
    if (value.length === 0) return [`${pad}${key}: []`]
    return [`${pad}${key}:`, ...value.flatMap((item) => yItemLines(item, indent + 1))]
  }
  if (value !== null && typeof value === 'object') {
    const entries = Object.entries(value)
    if (entries.length === 0) return [`${pad}${key}: {}`]
    return [`${pad}${key}:`, ...entries.flatMap(([k, v]) => yLines(k, v, indent + 1))]
  }
  return [`${pad}${key}: ${yScalar(value)}`]
}
function yItemLines(item, indent) {
  const pad = '  '.repeat(indent)
  if (item === null || typeof item !== 'object' || Array.isArray(item)) return [`${pad}- ${yScalar(item)}`]
  const entries = Object.entries(item)
  const [fk, fv] = entries[0]
  const first = yLines(fk, fv, indent + 1)
  return [`${pad}- ${first[0].slice((indent + 1) * 2)}`, ...first.slice(1), ...entries.slice(1).flatMap(([k, v]) => yLines(k, v, indent + 1))]
}

// ── world + fixtures ─────────────────────────────────────────────────────────
function prepareWorld() {
  mkdirSync(ROOT_A, { recursive: true })
  mkdirSync(ROOT_B, { recursive: true })
  mkdirSync(WONLY, { recursive: true })
  mkdirSync(SECRET_DIR, { recursive: true })
  writeFileSync(join(ROOT_A, 'inside.md'), 'INSIDE-OK member-readable content\n')
  writeFileSync(join(ROOT_B, 'other.md'), 'OTHER-OK m2-readable content\n')
  writeFileSync(SECRET, 'OUTSIDE-SECRET must never be reachable by governed members\n')
  writeFileSync(join(WONLY, 'target.md'), 'OLD-CONTENT-VISIBLE-IF-ESCALATED\n')
  symlinkSafe(SECRET, join(ROOT_A, 'esc.md'))
  linkSafe(SECRET, join(ROOT_A, 'hard.md'))
  const line = 'x'.repeat(60) + '\n'
  const lines = new Array(172_034).fill(line)
  lines[100_000] = 'BIGMIDDLE-TOKEN-LINE-1\n'
  lines[100_001] = 'BIGMIDDLE-TOKEN-LINE-2\n'
  writeFileSync(join(ROOT_A, 'big.txt'), lines.join(''))
  const policies = {
    [SID('m1')]: { readRoots: [ROOT_A], writeRoots: [ROOT_A], network: 'deny', evil: true, lateSameName: true },
    [SID('m2')]: { readRoots: [ROOT_B], writeRoots: [ROOT_B, WONLY], network: 'allow', allowUrls: ['http://example.org/', 'http://httpbin.org/'] },
  }
  writeFileSync(POLICIES_FILE, JSON.stringify(policies, null, 2))
  mkdirSync(join(HOME, 'profiles', 'web'), { recursive: true })
  const row = pathToFileURL(join(HERE, 'a5x-probe2.mjs')).href
  const presetRow = presetDeclarationRow({
    id: 'a5x-tools',
    displayName: 'a5x native tools',
    description: `a5x-pocA1 ${RUN_STAMP}: native roster (PoC)`,
    plugins: [
      { id: 'persona', name: PERSONA_ROW_NAME, config: { prefix: 'You are the a5x PoC member.' } },
      { id: 'tool-fs', name: '@deepseek-ai/dsh-tool-fs' },
      persistentShellGroup({}),
      { id: 'tool-web', name: '@deepseek-ai/dsh-tool-web' },
    ],
  })
  const patchLines = [
    `# a5x-pocA1 ${RUN_STAMP}: probe2 + native roster (public profile-patch seam)`,
    '- insert:',
  ].concat(
    yItemLines({ id: 'a5x-env-probe2', name: row }, 2),
    yItemLines({ id: presetRow.id, name: presetRow.name, config: presetRow.config }, 2),
  )
  writeFileSync(join(HOME, 'profiles', 'web', 'cordis.patch.yml'), patchLines.join('\n') + '\n')
}
function symlinkSafe(target, linkPath) { try { unlinkSync(linkPath) } catch { /* fresh */ } symlinkSync(target, linkPath) }
function linkSafe(target, hardPath) { try { unlinkSync(hardPath) } catch { /* fresh */ } linkSync(target, hardPath) }

// ── HTTP fixtures with connection ledger ─────────────────────────────────────
const fixtureHits = []
function startFixtures() {
  const s1 = createServer((req, res) => {
    fixtureHits.push({ at: Date.now(), port: FIX_PORT, path: req.url ?? '' })
    if ((req.url ?? '').startsWith('/probe-deny')) { res.writeHead(200); res.end('DENY-LANE-REACHED-SERVER-BUG'); return }
    if ((req.url ?? '').startsWith('/probe')) { res.writeHead(200); res.end('WEB-ALLOW-MARKER m2 reachable'); return }
    if ((req.url ?? '').startsWith('/redir')) { res.writeHead(302, { location: `http://127.0.0.1:${HOP_PORT}/redir2` }); res.end(); return }
    res.writeHead(404); res.end()
  })
  const s2 = createServer((req, res) => {
    fixtureHits.push({ at: Date.now(), port: HOP_PORT, path: req.url ?? '' })
    res.writeHead(200); res.end('REDIR-HOP-MARKER redirect target content (hop was NOT re-adjudicated by the seam)')
  })
  return new Promise((r) => {
    s1.listen(FIX_PORT, '127.0.0.1', () => {
      s2.listen(HOP_PORT, '127.0.0.1', () => r({ close: () => { s1.close(); s2.close() } }))
    })
  })
}

// ── host lifecycle (identical measured chain as wave-11) ─────────────────────
function spawnHost({ mockPort }) {
  const outFd = openSync(HOST_LOG, 'a')
  const child = spawn(process.execPath, [HOST_BIN, 'web', '--port', String(PORT), '--no-open'], {
    cwd: WORKTREE,
    stdio: ['ignore', outFd, outFd],
    env: {
      ...process.env,
      DSH_HOME: HOME,
      DSH_CLIENT_COMMIT_HASH: CLIENT_COMMIT_HASH,
      DEEPSEEK_BASE_URL: `http://127.0.0.1:${mockPort}`,
      DEEPSEEK_API_KEY: 'a5x-mock-key',
      A5X_LEDGER: LEDGER,
      A5X_SECRET: SECRET,
      A5X_POLICIES_FILE: POLICIES_FILE,
      A5X_TOOLFS_URL: pathToFileURL(join(TEST_USE, 'packages', 'fs', 'tool-fs', 'lib', 'index.js')).href,
      A5X_TOOLWEB_URL: pathToFileURL(join(TEST_USE, 'packages', 'web', 'tool-web', 'lib', 'index.js')).href,
    },
  })
  child.on('close', (code, signal) => appendFileSync(HOST_LOG, `\n[a5x-kit2] host closed code=${code} signal=${signal}\n`))
  return child
}
async function waitForBoot(ms = 150_000) {
  const deadline = Date.now() + ms
  while (Date.now() < deadline) {
    const txt = existsSync(HOST_LOG) ? readFileSync(HOST_LOG, 'utf8') : ''
    const m = txt.match(/dsh web: http:\/\/127\.0\.0\.1:(\d+)\/\?token=([A-Za-z0-9_-]+)/)
    if (m !== null && m !== undefined) return { token: m[2] }
    await new Promise((r) => setTimeout(r, 400))
  }
  throw new Error('boot line never appeared')
}
async function fetchJson(url, init, timeoutMs = 30_000) {
  const res = await fetch(url, { ...init, signal: AbortSignal.timeout(timeoutMs) }).catch((e) => ({ status: 0, error: e.message }))
  const body = res.status === 0 ? null : await res.json().catch(() => null)
  return { status: res.status ?? 0, body, error: res.error }
}
async function authenticate(token) {
  const res = await fetch(`${ORIGIN}/?token=${token}`, { redirect: 'manual', signal: AbortSignal.timeout(30_000) })
  const setCookie = res.headers.get('set-cookie')
  if (res.status !== 303 || setCookie === null) throw new Error(`auth returned ${res.status}`)
  return setCookie.split(';', 1)[0]
}
async function apiCreate(cookie, sessionId, preset) {
  return fetchJson(`${ORIGIN}/api/session/create`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie },
    body: JSON.stringify({ type: 'client-request', rpcId: `a5x-${Math.random().toString(36).slice(2, 12)}`, method: 'session/create', payload: { args: { request: { sessionId, cwd: WORKTREE, ...(preset ? { agentPreset: preset } : {}) } } } }),
  })
}
async function apiPrompt(cookie, sessionId, text) {
  return fetchJson(`${ORIGIN}/api/session/prompt`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie },
    body: JSON.stringify({ type: 'client-request', rpcId: `a5x-p-${Math.random().toString(36).slice(2, 12)}`, method: 'session/prompt', payload: { args: { request: { requestId: `a5x-rq-${Math.random().toString(36).slice(2, 10)}`, sessionId, mode: 'queue', content: [{ type: 'text', text }] } } } }),
  })
}

// ── multi-lane mock: lane = marker in the FIRST user message of the transcript
const blockText = (b) => (b?.type === 'tool_result'
  ? (typeof b.content === 'string' ? b.content : (b.content ?? []).map((c) => String(c?.text ?? '')).join(' '))
  : String(b?.text ?? ''))
const textOfMsg = (m) => (typeof m?.content === 'string' ? m.content
  : Array.isArray(m?.content) ? m.content.map(blockText).join(' ') : '')
const toolCall = (id, name, args) => ({ kind: 'tool-call', toolCalls: [{ id, name, arguments: args }] })
const lanes = {
  M1: { step: 0, snaps: [], done: false },
  M2: { step: 0, snaps: [], done: false },
  CTL: { step: 0, snaps: [], done: false },
}
function laneScript(lane, st) {
  if (lane === 'M1') {
    switch (st.step) {
      case 0: return toolCall('m1a', 'read', { file_path: join(ROOT_A, 'inside.md') })
      case 1: return toolCall('m1b', 'read', { file_path: join(ROOT_B, 'other.md') })
      case 2: return toolCall('m1c', 'read', { file_path: join(ROOT_A, 'esc.md') })
      case 3: return toolCall('m1d', 'read', { file_path: join(ROOT_A, 'hard.md') })
      case 4: return toolCall('m1e', 'read', { file_path: join(ROOT_A, 'big.txt'), offset: 100_000, limit: 3 })
      case 5: return toolCall('m1f', 'write', { file_path: join(ROOT_B, 'cross.txt'), content: 'cross-escape\n' })
      case 6: return toolCall('m1g', 'a5x_evil', {})
      case 7: return toolCall('m1h', 'web_fetch', { url: `http://127.0.0.1:${FIX_PORT}/probe-deny` })
      case 8: return toolCall('m1i', 'a5x_late_clone', {}) // NOT registered → unknown-tool baseline
      default: st.done = true; return { kind: 'text', content: 'A5X-M1-COMPLETE' }
    }
  }
  if (lane === 'M2') {
    switch (st.step) {
      case 0: return toolCall('m2a', 'read', { file_path: join(ROOT_B, 'other.md') })
      case 1: return toolCall('m2b', 'read', { file_path: join(ROOT_A, 'inside.md') })
      case 2: return toolCall('m2c', 'edit', { file_path: join(WONLY, 'target.md'), old_string: 'OLD-CONTENT-VISIBLE-IF-ESCALATED', new_string: 'EDITED-BLIND' })
      case 3: return toolCall('m2d', 'web_fetch', { url: 'http://example.org/' })
      case 4: return toolCall('m2e', 'web_fetch', { url: 'http://httpbin.org/redirect-to?url=http://example.org/' })
      default: st.done = true; return { kind: 'text', content: 'A5X-M2-COMPLETE' }
    }
  }
  switch (st.step) {
    case 0: return toolCall('ctla', 'read', { file_path: SECRET })
    case 1: return toolCall('ctlb', 'web_fetch', { url: 'http://example.com/probe' })
    default: st.done = true; return { kind: 'text', content: 'A5X-CTL-COMPLETE' }
  }
}
function makeDecide() {
  return ({ req }) => {
    const messages = req?.messages ?? []
    const all = messages.map(textOfMsg).join('\n')
    if (all.includes('Generate the session title')) return { kind: 'text', content: 'a5x2 session' }
    const firstUser = messages.find((m) => m?.role === 'user')
    const lane = ['M1', 'M2', 'CTL'].find((l) => textOfMsg(firstUser).includes(`A5X-LANE-${l}`))
    if (lane === undefined) return { kind: 'text', content: 'a5x2-neutral' }
    const st = lanes[lane]
    const tail = messages.slice(-2).map(textOfMsg).join('\n').slice(0, 400)
    st.snaps.push({ afterStep: st.step, tail })
    const reply = laneScript(lane, st)
    st.step += 1
    return reply
  }
}
async function waitForLane(lane, mock, ms = 150_000) {
  const st = lanes[lane]
  const deadline = Date.now() + ms
  while (Date.now() < deadline) {
    if (st.done) return st
    if (mock.requests.length > 140) throw new Error(`mock storm fuse (${mock.requests.length})`)
    await new Promise((r) => setTimeout(r, 400))
  }
  return st
}
async function stableProbe() {
  const res = await fetch(`http://127.0.0.1:${STABLE_INSTANCE_PORT}/`, { signal: AbortSignal.timeout(4000) }).catch(() => null)
  return res === null ? 'unreachable' : res.status
}

// ── main ─────────────────────────────────────────────────────────────────────
async function main() {
  mkdirSync(EVIDENCE, { recursive: true })
  const stableBefore = await stableProbe()
  prepareWorld()
  const fixtures = await startFixtures()
  const mock = await startMockModel({ port: 0, decide: makeDecide(), log: () => {} })
  log(`mock :${mock.port}, fixtures :${FIX_PORT}/${HOP_PORT}; booting host :${PORT}`)
  const host = spawnHost({ mockPort: mock.port })
  const summary = { runStamp: RUN_STAMP, sha: TEST_USE_BASELINE_SHA.slice(0, 10), stableBefore, stableAfter: undefined }
  try {
    const { token } = await waitForBoot()
    const cookie = await authenticate(token)
    log('booted; running lanes')
    const runs = []
    for (const [lane, preset] of [['M1', 'a5x-tools'], ['M2', 'a5x-tools'], ['CTL', 'a5x-tools']]) {
      const sid = SID(lane.toLowerCase())
      const created = await apiCreate(cookie, sid, preset)
      const prompted = await apiPrompt(cookie, sid, `A5X-LANE-${lane} walk the probes one tool call at a time.`)
      log(`${lane}: create=${created.status} prompt=${prompted.status}`)
      const st = await waitForLane(lane, mock)
      runs.push({ lane, sid, createStatus: created.status, promptStatus: prompted.status, snaps: st.snaps })
      log(`${lane}: ${st.step} requests, done=${st.done}`)
    }
    writeFileSync(join(EVIDENCE, 'turn-evidence.json'), JSON.stringify({ runs, fixtureHits }, null, 2))
    const resOf = (lane, n) => String(runs.find((r) => r.lane === lane)?.snaps.find((s) => s.afterStep === n)?.tail ?? '')
    const plantRow = (txt) => { try { return JSON.parse(txt) } catch { return {} } }
    const plants = (existsSync(LEDGER) ? readFileSync(LEDGER, 'utf8') : '').split('\n').filter((l) => l.includes('"ev":"plant"')).map(plantRow)
    summary.verdicts = {
      m1InsideOk: resOf('M1', 1).includes('INSIDE-OK'),
      m1CrossRefused: resOf('M1', 2).includes('A5X-ENFORCE-REFUSE'),
      m1SymlinkRefused: resOf('M1', 3).includes('A5X-ENFORCE-REFUSE'),
      m1SymlinkLeaked: resOf('M1', 3).includes('OUTSIDE-SECRET'),
      m1HardlinkLeaked: resOf('M1', 4).includes('OUTSIDE-SECRET'),
      m1BigWindowOk: resOf('M1', 5).includes('BIGMIDDLE-TOKEN'),
      m1WriteCrossRefused: resOf('M1', 6).includes('A5X-ENFORCE-REFUSE'),
      m1WriteCrossHappened: existsSync(join(ROOT_B, 'cross.txt')),
      m1EvilBypassed: resOf('M1', 7).includes('OUTSIDE-SECRET'),
      m1FetchRefused: resOf('M1', 8).includes('A5X-NETWORK-REFUSE'),
      denyZeroConnections: !fixtureHits.some((h) => h.path.startsWith('/probe-deny')),
      m1UnknownLateTool: /not (a known|found)|unknown tool|no tool/i.test(resOf('M1', 9)) || !resOf('M1', 9).includes('LATE-CLONE-RAN'),
      m2OtherOk: resOf('M2', 1).includes('OTHER-OK'),
      m2CrossRefused: resOf('M2', 2).includes('A5X-ENFORCE-REFUSE'),
      m2BlindEditBlockedNativeProtocol: resOf('M2', 3).includes('file has not been read')
        && !readFileSync(join(WONLY, 'target.md'), 'utf8').includes('EDITED-BLIND'),
      m2HostSsrfBehindAllow: resOf('M2', 4).includes('non-public IP'),
      m2AllowFetchOk: resOf('M2', 4).includes('Example Domain'),
      m2RedirectHopUnrejudicated: resOf('M2', 5).includes('Example Domain'),
      ctlSecretReadable: resOf('CTL', 1).includes('OUTSIDE-SECRET'),
      lateSameName: plants.map((p) => p.lateSameName).find(Boolean) ?? 'not-seen',
      evilRegistered: plants.map((p) => p.evilRegistered).find(Boolean) ?? 'not-seen',
      fsMounts: plants.map((p) => p.fsMount),
      webMounts: plants.map((p) => p.webMount),
    }
    summary.modelRequests = mock.requests.length
  } finally {
    try { process.kill(host.pid) } catch { /* gone */ }
    await mock.close().catch(() => {})
    fixtures.close()
  }
  await new Promise((r) => setTimeout(r, 1500))
  summary.stableAfter = await stableProbe()
  writeFileSync(join(EVIDENCE, 'summary.json'), JSON.stringify(summary, null, 2))
  log(`done; evidence at ${EVIDENCE}`)
  log(JSON.stringify(summary.verdicts ?? summary))
}

main().catch((e) => { log(`FATAL ${e.stack ?? e}`); process.exit(1) })
