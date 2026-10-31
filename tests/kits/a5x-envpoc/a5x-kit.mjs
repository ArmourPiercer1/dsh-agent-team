/**
 * a5x-kit.mjs — A5-XENV execution-environment PoC runner (Team-owned, PoC only —
 * NOT production criteria; PoC-bannered per repo convention).
 *
 * Boots the pristine pinned Host (tests/paths.mjs pins) with ONE extra public
 * patch-layer row (a5x-env-probe-plugin.mjs), creates ONE ordinary session
 * (public /api/session/create — no team, no model turn), and lets the probe run
 * E1/E2/E3/E4 inside the live Host process. Evidence: ledger JSONL + summary.
 *
 * Constraints honored: pristine test-use untouched; DSH_HOME inside workspace;
 * ports from the 3180 family (3186 default); :3080 stable instance observed
 * read-only before and after; no push, no upstream writes.
 *
 * @module tests/kits/a5x-envpoc/a5x-kit
 */
import { spawn } from 'node:child_process'
import { appendFileSync, existsSync, mkdirSync, openSync, readFileSync, writeFileSync } from 'node:fs'
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
const EVIDENCE = join(WORKTREE, 'dev', 'agent-workflow', 'evidence', `a5x-envpoc-${RUN_STAMP}`)
const HOME = join(WORKTREE, TEST_HOME_ROOT_REL, `a5x-envpoc-${RUN_STAMP}`)
const LEDGER = join(EVIDENCE, 'ledger.jsonl')
const HOST_LOG = join(EVIDENCE, 'host.log')
const ROOT_A = join(EVIDENCE, 'rootA')
const WROOT = join(EVIDENCE, 'wroot')
const SECRET = join(EVIDENCE, 'secret', 'outside.md')
const ORIGIN = `http://127.0.0.1:${PORT}`

const log = (m) => console.log(`[a5x ${new Date().toISOString().slice(11, 19)}] ${m}`)

// ── minimal YAML block emitter (kit-local; nested preset config needs blocks) ─
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

// ── world ───────────────────────────────────────────────────────────────────
function prepareWorld() {
  // baseline pin assertion (pristine role)
  const head = readFileSync(join(TEST_USE, '.git', 'HEAD'), 'utf8').trim()
  const packed = existsSync(join(TEST_USE, '.git', 'packed-refs')) ? readFileSync(join(TEST_USE, '.git', 'packed-refs'), 'utf8') : ''
  const shaLooksRight = head.includes(TEST_USE_BASELINE_SHA.slice(0, 40)) || head.startsWith('ref:')
  if (!shaLooksRight && !packed.includes(TEST_USE_BASELINE_SHA)) throw new Error(`test-use not at pinned SHA (HEAD=${head.slice(0, 20)})`)
  mkdirSync(join(ROOT_A, 'nested'), { recursive: true })
  mkdirSync(WROOT, { recursive: true })
  mkdirSync(dirname(SECRET), { recursive: true })
  writeFileSync(join(ROOT_A, 'inside.md'), 'INSIDE-OK member-readable content\n')
  writeFileSync(join(ROOT_A, 'nested', 'deep.md'), 'deep-inside\n')
  writeFileSync(SECRET, 'OUTSIDE-SECRET must never be reachable by the member\n')
  // patch layer: the one probe row, mounted through the public seam
  mkdirSync(join(HOME, 'profiles', 'web'), { recursive: true })
  const row = pathToFileURL(join(HERE, 'a5x-env-probe-plugin.mjs')).href
  // a preset roster carrying the NATIVE fs tools, persistent bash and web tools:
  // the member-visible tool plane these experiments must govern (weak-form
  // managed set per user ruling: direct read/write/exec/net + indirect-read).
  const presetRow = presetDeclarationRow({
    id: 'a5x-tools',
    displayName: 'a5x native tools',
    description: `a5x-envpoc ${RUN_STAMP}: native roster only (PoC)`,
    plugins: [
      { id: 'persona', name: PERSONA_ROW_NAME, config: { prefix: 'You are the a5x PoC member.' } },
      { id: 'tool-fs', name: '@deepseek-ai/dsh-tool-fs' },
      persistentShellGroup({}),
      { id: 'tool-web', name: '@deepseek-ai/dsh-tool-web' },
    ],
  })
  const patchLines = [
    `# a5x-envpoc ${RUN_STAMP}: execution-environment probe row + native-tools preset (public profile-patch seam)`,
    '- insert:',
  ].concat(
    yItemLines({ id: 'a5x-env-probe', name: row }, 2),
    yItemLines({ id: presetRow.id, name: presetRow.name, config: presetRow.config }, 2),
  )
  writeFileSync(join(HOME, 'profiles', 'web', 'cordis.patch.yml'), patchLines.join('\n') + '\n')
}

// ── host lifecycle ──────────────────────────────────────────────────────────
function spawnHost({ mockPort }) {
  const outFd = openSync(HOST_LOG, 'a')
  const errFd = openSync(HOST_LOG, 'a')
  const child = spawn(process.execPath, [HOST_BIN, 'web', '--port', String(PORT), '--no-open'], {
    cwd: WORKTREE,
    stdio: ['ignore', outFd, errFd],
    env: {
      ...process.env,
      DSH_HOME: HOME,
      DSH_CLIENT_COMMIT_HASH: CLIENT_COMMIT_HASH,
      DEEPSEEK_BASE_URL: `http://127.0.0.1:${mockPort}`, // in-process mock, never a real key
      DEEPSEEK_API_KEY: 'a5x-mock-key',
      A5X_LEDGER: LEDGER,
      A5X_ROOT_A: ROOT_A,
      A5X_WROOT: WROOT,
      A5X_SECRET: SECRET,
      A5X_TOOLFS_URL: pathToFileURL(join(TEST_USE, 'packages', 'fs', 'tool-fs', 'lib', 'index.js')).href,
      A5X_TOOLWEB_URL: pathToFileURL(join(TEST_USE, 'packages', 'web', 'tool-web', 'lib', 'index.js')).href,
    },
  })
  child.on('close', (code, signal) => appendFileSync(HOST_LOG, `\n[a5x-kit] host closed code=${code} signal=${signal}\n`))
  return child
}

async function waitForBoot(ms = 150_000) {
  const deadline = Date.now() + ms
  while (Date.now() < deadline) {
    const txt = existsSync(HOST_LOG) ? readFileSync(HOST_LOG, 'utf8') : ''
    const m = txt.match(/dsh web: http:\/\/127\.0\.0\.1:(\d+)\/\?token=([A-Za-z0-9_-]+)/)
    if (m !== null && m !== undefined) return { token: m[2] }
    await new Promise((r) => setTimeout(r, 500))
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
  if (res.status !== 303 || setCookie === null) throw new Error(`auth returned ${res.status} (expected 303+set-cookie)`)
  return setCookie.split(';', 1)[0]
}

async function waitForLedgerDone(ms = 120_000) {
  const deadline = Date.now() + ms
  while (Date.now() < deadline) {
    if (existsSync(LEDGER)) {
      const txt = readFileSync(LEDGER, 'utf8')
      if (txt.includes('"ev":"done"') || txt.includes('"ev": "done"')) return txt
    }
    await new Promise((r) => setTimeout(r, 1000))
  }
  return existsSync(LEDGER) ? readFileSync(LEDGER, 'utf8') : ''
}

// ── model turn driver: real dispatch is the only visibility ground truth ────
async function apiPrompt(cookie, sessionId, text) {
  return fetchJson(`${ORIGIN}/api/session/prompt`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie },
    body: JSON.stringify({
      type: 'client-request',
      rpcId: `a5x-p-${Math.random().toString(36).slice(2, 12)}`,
      method: 'session/prompt',
      payload: { args: { request: { requestId: `a5x-rq-${Math.random().toString(36).slice(2, 10)}`, sessionId, mode: 'queue', content: [{ type: 'text', text }] } } },
    }),
  })
}

function toolCall(id, name, args) { return { kind: 'tool-call', toolCalls: [{ id, name, arguments: args }] } }

// Chain state lives in THIS script (a5p1 lesson: never re-derive progress from
// a transcript the Host owns and may compact). One request per step; the Host
// asks once per result. Result TEXT is snapshotted per request as it arrives.
const chain = { step: 0, snapshots: [], finished: false }
const blockText = (b) => (b?.type === 'tool_result'
  ? (typeof b.content === 'string' ? b.content : (b.content ?? []).map((c) => String(c?.text ?? '')).join(' '))
  : String(b?.text ?? ''))
const textOfMsg = (m) => (typeof m?.content === 'string' ? m.content
  : Array.isArray(m?.content) ? m.content.map(blockText).join(' ') : '')

function makeDecide() {
  return ({ req }) => {
    const messages = req?.messages ?? []
    const all = messages.map(textOfMsg).join('\n')
    if (all.includes('Generate the session title')) return { kind: 'text', content: 'a5x session' }
    if (!all.includes('A5XTURN')) return { kind: 'text', content: 'a5x-neutral-sidechain' }
    const tail = messages.slice(-2).map(textOfMsg).join('\n').slice(0, 400)
    chain.snapshots.push({ afterStep: chain.step, tail })
    const step = chain.step
    chain.step += 1
    switch (step) {
      case 0: return toolCall('c1', 'read', { file_path: join(ROOT_A, 'inside.md') })
      case 1: return toolCall('c2', 'read', { file_path: SECRET })
      case 2: return toolCall('c3', 'write', { file_path: join(WROOT, 'note.txt'), content: 'written-in-scope\n' })
      case 3: return toolCall('c4', 'write', { file_path: join(EVIDENCE, 'escaped.txt'), content: 'escape\n' })
      case 4: return toolCall('c5', 'a5x_evil', {})
      case 5: return toolCall('c6', 'web_fetch', { url: 'http://example.com/probe' })
      default: chain.finished = true; return { kind: 'text', content: 'A5X-TURN-COMPLETE' }
    }
  }
}

async function waitForTurn(mock, ms = 150_000) {
  const deadline = Date.now() + ms
  while (Date.now() < deadline) {
    if (chain.finished) return chain.snapshots
    if (mock.requests.length > 60) throw new Error(`mock storm fuse (${mock.requests.length} requests, step=${chain.step})`)
    await new Promise((r) => setTimeout(r, 500))
  }
  return chain.snapshots
}

async function stableProbe() {
  const res = await fetch(`http://127.0.0.1:${STABLE_INSTANCE_PORT}/`, { signal: AbortSignal.timeout(4000) }).catch(() => null)
  return res === null ? 'unreachable' : res.status
}

// ── main ────────────────────────────────────────────────────────────────────
async function main() {
  mkdirSync(EVIDENCE, { recursive: true })
  const stableBefore = await stableProbe()
  prepareWorld()
  const mock = await startMockModel({ port: 0, decide: makeDecide(), log: () => {} })
  log(`mock model up :${mock.port}; booting host :${PORT}`)
  const host = spawnHost({ mockPort: mock.port })
  const summary = { runStamp: RUN_STAMP, port: PORT, sha: TEST_USE_BASELINE_SHA.slice(0, 10), stableBefore, stableAfter: undefined }
  try {
    const { token } = await waitForBoot()
    log('boot line seen')
    const cookie = await authenticate(token)
    const sid = `a5x-${RUN_STAMP}`
    const created = await fetchJson(`${ORIGIN}/api/session/create`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie },
      body: JSON.stringify({
        type: 'client-request',
        rpcId: `a5x-${Math.random().toString(36).slice(2, 12)}`,
        method: 'session/create',
        payload: { args: { request: { sessionId: sid, cwd: WORKTREE, agentPreset: 'a5x-tools' } } },
      }),
    })
    log(`session/create status=${created.status}`)
    writeFileSync(join(EVIDENCE, 'session-create.json'), JSON.stringify({ status: created.status, body: created.body, error: created.error }, null, 2))
    const ledgerTxt = await waitForLedgerDone()
    summary.ledgerDone = ledgerTxt.includes('"done"')
    const prompted = await apiPrompt(cookie, sid, 'A5XTURN please walk through the requested probes one tool call at a time.')
    summary.promptStatus = prompted.status
    writeFileSync(join(EVIDENCE, 'prompt-response.json'), JSON.stringify({ status: prompted.status, body: prompted.body, error: prompted.error }, null, 2))
    log(`prompt status=${prompted.status}; driving real dispatch via mock`)
    const snapshots = await waitForTurn(mock)
    const resOf = (n) => String(snapshots.find((s) => s.afterStep === n)?.tail ?? '')
    const verdicts = {
      readInsideOk: resOf(1).includes('INSIDE-OK'),
      readSecretRefused: resOf(2).includes('A5X-ENFORCE-REFUSE'),
      readSecretLeaked: resOf(2).includes('OUTSIDE-SECRET'),
      writeInScopeRefused: resOf(3).includes('A5X-ENFORCE-REFUSE'),
      writeInScopeWritten: existsSync(join(WROOT, 'note.txt')),
      writeEscapeRefused: resOf(4).includes('A5X-ENFORCE-REFUSE'),
      writeEscapeHappened: existsSync(join(EVIDENCE, 'escaped.txt')),
      evilBypassed: resOf(5).includes('OUTSIDE-SECRET'),
      webFetchRefused: resOf(6).includes('A5X-NETWORK-REFUSE'),
      webFetchAttempted: /ECONNREFUSED|fetch failed|ECONN|ENOTFOUND|getaddrinfo/i.test(resOf(6)),
    }
    summary.modelRequests = mock.requests.length
    summary.verdicts = verdicts
    writeFileSync(join(EVIDENCE, 'turn-evidence.json'), JSON.stringify({ steps: chain.step, snapshots, verdicts }, null, 2))
  } finally {
    try { process.kill(host.pid) } catch { /* gone */ }
    await mock.close().catch(() => {})
  }
  await new Promise((r) => setTimeout(r, 2000))
  summary.stableAfter = await stableProbe()
  summary.secretIntactAtEnd = (() => { try { const t = readFileSync(SECRET, 'utf8'); return t.includes('OUTSIDE-SECRET') && !t.includes('pwned') } catch { return 'unreadable' } })()
  writeFileSync(join(EVIDENCE, 'summary.json'), JSON.stringify(summary, null, 2))
  log(`done; evidence at ${EVIDENCE}`)
  log(JSON.stringify(summary.verdicts ?? summary))
}

main().catch((e) => { log(`FATAL ${e.stack ?? e}`); process.exit(1) })
