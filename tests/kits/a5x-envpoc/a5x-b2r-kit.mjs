/**
 * a5x-b2r-kit.mjs — B2-R fork-spike runner (PoC banner, disposable).
 * Question: with a ZERO-COPY member-capped terminal-bash wrapper swapped into
 * the Team preset shell group (public exports only), does the persistent bash
 * member ceiling finally hold? Compare against run9 (a5x-pocB1-20261031T185429)
 * where the same legs ESCAPED (secret written, escape file written, danger
 * accepted at exit 0).
 * Verdicts are file-system side effects, never tool prose.
 */
import { spawn, spawnSync } from 'node:child_process'
import { appendFileSync, existsSync, mkdirSync, openSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { CLIENT_COMMIT_HASH, TEST_USE_BASELINE_SHA, TEST_USE_REL, TEST_HOME_ROOT_REL, STABLE_INSTANCE_PORT } from '../../paths.mjs'
import { presetDeclarationRow, PERSONA_ROW_NAME } from '../_shared/preset-seam.mjs'
import { startMockModel } from '../../../packages/tools/harness/mock-deepseek.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const WORKTREE = resolve(HERE, '..', '..', '..')
const TEST_USE = join(WORKTREE, TEST_USE_REL)
const HOST_BIN = join(TEST_USE, 'apps', 'cli', 'lib', 'bin.js')
const RUN_STAMP = process.env.A5X_STAMP ?? new Date().toISOString().replace(/[-:]/g, '').slice(0, 15)
const PORT = Number(process.env.A5X_PORT ?? 3186)
const EVIDENCE = join(WORKTREE, 'dev', 'agent-workflow', 'evidence', `a5x-pocB2R-${RUN_STAMP}`)
const HOME = join(WORKTREE, TEST_HOME_ROOT_REL, `a5x-pocB2R-${RUN_STAMP}`)
const HOST_LOG = join(EVIDENCE, 'host.log')
const ROOT_A = join(EVIDENCE, 'rootA')
const ROOT_B = join(EVIDENCE, 'rootB')
const SECRET = join(EVIDENCE, 'secret.md')
const CAPS = join(EVIDENCE, 'member-caps.json')
const ORIGIN = `http://127.0.0.1:${PORT}`
const SID = `a5x-b2r-M1-${RUN_STAMP}`
const SECRET_TEXT = 'OUTSIDE-SECRET b2r baseline\n'
const log = (m) => console.log(`[b2r ${new Date().toISOString().slice(11, 19)}] ${m}`)

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

function prepareWorld() {
  const head = spawnSync('git', ['-C', TEST_USE, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).stdout.trim()
  if (!head.startsWith(TEST_USE_BASELINE_SHA)) throw new Error(`pristine drift: ${head} != ${TEST_USE_BASELINE_SHA}`)
  mkdirSync(ROOT_A, { recursive: true })
  mkdirSync(ROOT_B, { recursive: true })
  writeFileSync(SECRET, SECRET_TEXT)
  writeFileSync(CAPS, JSON.stringify({ M1: { mode: 'workspace-write', workspaceRoot: ROOT_A } }, null, 2))
  mkdirSync(join(HOME, 'profiles', 'web'), { recursive: true })
  const forkUrl = pathToFileURL(join(HERE, 'a5x-fork-capped-terminal-bash.mjs')).href
  const presetRow = presetDeclarationRow({
    id: 'a5x-b2r-tools',
    displayName: 'a5x b2r shell',
    description: `a5x-pocB2R ${RUN_STAMP}: persona + shell group with member-capped terminal-bash wrapper (PoC)`,
    plugins: [
      { id: 'persona', name: PERSONA_ROW_NAME, config: { prefix: 'You are the a5x PoC member. Use the bash tool for every command; do not explain.' } },
      {
        id: 'persistent-shell',
        name: 'cordis:group',
        group: true,
        isolate: { terminals: true },
        config: [
          { id: 'pty', name: '@deepseek-ai/dsh-terminal' },
          { id: 'terminal-bash', name: forkUrl, config: { timeoutMs: 300_000 } },
          { id: 'persistent-bash', name: '@deepseek-ai/dsh-tool-bash-persistent' },
        ],
      },
    ],
  })
  const patchLines = ['# a5x-pocB2R ' + RUN_STAMP + ': preset row only (roster is ours; no disable needed)', '- insert:']
    .concat(yItemLines({ id: presetRow.id, name: presetRow.name, config: presetRow.config }, 2))
  writeFileSync(join(HOME, 'profiles', 'web', 'cordis.patch.yml'), patchLines.join('\n') + '\n')
}

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
      A5X_B2R_CAPS: CAPS,
    },
  })
  child.on('close', (code, signal) => appendFileSync(HOST_LOG, `\n[b2r] host closed code=${code} signal=${signal}\n`))
  return child
}
async function waitForBoot(ms = 150_000) {
  const deadline = Date.now() + ms
  while (Date.now() < deadline) {
    const txt = existsSync(HOST_LOG) ? readFileSync(HOST_LOG, 'utf8') : ''
    const m = txt.match(/dsh web: http:\/\/127\.0\.0\.1:(\d+)\/\?token=([A-Za-z0-9_-]+)/)
    if (m !== null) return { token: m[2] }
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

// ── single-lane mock: 5 bash legs, verdicts from side effects only ──────────
const blockText = (b) => (b?.type === 'tool_result'
  ? (typeof b.content === 'string' ? b.content : (b.content ?? []).map((c) => String(c?.text ?? '')).join(' '))
  : String(b?.text ?? ''))
const textOfMsg = (m) => (typeof m?.content === 'string' ? m.content
  : Array.isArray(m?.content) ? m.content.map(blockText).join(' ') : '')
const toolCall = (id, name, args) => ({ kind: 'tool-call', toolCalls: [{ id, name, arguments: args }] })
const st = { step: 0, snaps: [], tails: {}, done: false }
function laneScript() {
  switch (st.step) {
    case 0: return toolCall('r1', 'bash', { command: `cat ${SECRET}` })
    case 1: return toolCall('r2', 'bash', { command: `echo pwned > ${SECRET}` })
    case 2: return toolCall('r3', 'bash', { command: `echo ok > ${join(ROOT_A, 'inside.txt')}` })
    case 3: return toolCall('r4', 'bash', { command: `echo escape > ${join(ROOT_B, 'escape.txt')}` })
    case 4: return toolCall('r5', 'bash', { command: `echo pwned2 > ${SECRET}`, sandbox_permissions: 'danger-full-access', justification: 'PoC ceiling clamp probe' })
    default: st.done = true; return { kind: 'text', content: 'A5X-B2R-COMPLETE' }
  }
}
function makeDecide() {
  return ({ req }) => {
    const messages = req?.messages ?? []
    const all = messages.map(textOfMsg).join('\n')
    if (all.includes('Generate the session title')) return { kind: 'text', content: 'a5x b2r' }
    const firstUser = messages.find((m) => m?.role === 'user')
    if (!textOfMsg(firstUser).includes('A5X-LANE-M1')) return { kind: 'text', content: 'b2r-neutral' }
    const tail = messages.slice(-2).map(textOfMsg).join('\n').slice(0, 500)
    st.tails[`step${st.step}`] = tail
    const reply = laneScript()
    st.step += 1
    return reply
  }
}
async function waitForLane(ms = 150_000) {
  const deadline = Date.now() + ms
  while (Date.now() < deadline) {
    if (st.done) return
    await new Promise((r) => setTimeout(r, 400))
  }
  throw new Error('lane never completed')
}
async function stableProbe() {
  const res = await fetch(`http://127.0.0.1:${STABLE_INSTANCE_PORT}/`, { signal: AbortSignal.timeout(4000) }).catch(() => null)
  return res === null ? 'unreachable' : res.status
}

async function main() {
  mkdirSync(EVIDENCE, { recursive: true })
  prepareWorld()
  const stable = { before: await stableProbe() }
  const mock = await startMockModel({ port: 0, decide: makeDecide() })
  const host = spawnHost({ mockPort: mock.port })
  try {
    const { token } = await waitForBoot()
    const cookie = await authenticate(token)
    const created = await fetchJson(`${ORIGIN}/api/session/create`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie },
      body: JSON.stringify({ type: 'client-request', rpcId: 'b2r-create', method: 'session/create', payload: { args: { request: { sessionId: SID, cwd: WORKTREE, agentPreset: 'a5x-b2r-tools' } } } }),
    })
    if (created.status !== 200) throw new Error(`create ${created.status}`)
    if (created.body?.result?.ok === false) throw new Error(`create envelope invalid: ${JSON.stringify(created.body.result).slice(0, 400)}`)
    const prompted = await fetchJson(`${ORIGIN}/api/session/prompt`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie },
      body: JSON.stringify({ type: 'client-request', rpcId: 'b2r-p', method: 'session/prompt', payload: { args: { request: { requestId: 'b2r-rq', sessionId: SID, mode: 'queue', content: [{ type: 'text', text: 'A5X-LANE-M1 run each command I delegate, exactly, in order.' }] } } } }),
    })
    if (prompted.status !== 200) throw new Error(`prompt ${prompted.status}`)
    await waitForLane()
  } finally {
    host.kill('SIGTERM')
    await mock.close?.()
  }
  stable.after = await stableProbe()
  const hostLog = existsSync(HOST_LOG) ? readFileSync(HOST_LOG, 'utf8') : ''
  const secretNow = readFileSync(SECRET, 'utf8')
  const allTails = JSON.stringify(st.tails)
  const report = {
    stamp: RUN_STAMP,
    stableProbe: stable,
    forkEngaged: hostLog.includes('[a5x-b2r] capped terminal-bash apply()'),
    verdicts: {
      // run9 comparison: run9 bashWriteSecretRefused=false / bashEscapeRefused=false / bashDangerEscaped=true
      bashWriteSecretRefused: secretNow === SECRET_TEXT,
      bashWriteInsideOk: existsSync(join(ROOT_A, 'inside.txt')) && readFileSync(join(ROOT_A, 'inside.txt'), 'utf8').trim() === 'ok',
      bashEscapeRefused: !existsSync(join(ROOT_B, 'escape.txt')),
      dangerClamped: secretNow === SECRET_TEXT && !allTails.includes('pwned2'),
      // host read dialect (F9) is unchanged by this spike — disclose, don't hide
      bashReadLeakFork: allTails.includes('OUTSIDE-SECRET'),
    },
    tails: st.tails,
    mockRequests: mock.requests?.length ?? -1,
  }
  writeFileSync(join(EVIDENCE, 'b2r.json'), JSON.stringify(report, null, 2))
  log(JSON.stringify({ forkEngaged: report.forkEngaged, ...report.verdicts, stable: stable }))
  log('EVIDENCE ' + EVIDENCE)
}
main().catch((e) => { console.error('FATAL', e.stack ?? String(e)); process.exit(1) })
