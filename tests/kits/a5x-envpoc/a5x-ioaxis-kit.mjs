/**
 * a5x-ioaxis-kit.mjs — D-FS-02 独立读写轴 DSH 接缝 PoC runner（PoC banner, disposable）.
 *
 * 内核层已独立验证（a5x-dfs02-step1.sh，19/19 绿）。本 kit 只验证一个接缝问题：
 *   独立 read/write 规则能否经由「现有/最小扩展的 DSH 基础设施接缝」提供给
 *   原生 bash 工具（ToolDefinition 不变），且拒绝 = 真实 OS 效果。
 *
 * 接缝 = 原生 spawnArgv 的两个公开服务面（terminal-bash lib/index.js:963-974）：
 *   policy = ctx.sandboxPolicy.resolve({session})   // 策略载体（v3: 附加 io 字段）
 *   sandbox = ctx.get("sandbox"); sandbox.confine(argv, policy, signal)  // argv 构造
 * 两条 lane（同一原生 bash 工具，不同 member caps）：
 *   IO-R  读轴域：io={maskPaths:[rootB]}      → 读 A OK / 读 B ENOENT / 写 A EROFS
 *   IO-W  写轴域：io={writeRoots:[rootB]}     → 写 B OK / 写 A EROFS / 读 A OK（dialect）
 * Verdicts = 工具输出（PTY 文本）+ 宿主 FS 侧效应 + consulted 轨迹，不靠散文。
 */
import { spawn, spawnSync } from 'node:child_process'
import { appendFileSync, existsSync, mkdirSync, openSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { CLIENT_COMMIT_HASH, TEST_USE_BASELINE_SHA, TEST_USE_REL, TEST_HOME_ROOT_REL, STABLE_INSTANCE_PORT } from '../../paths.mjs'
import { presetDeclarationRow, PERSONA_ROW_NAME } from '../_shared/preset-seam.mjs'
import { startMockModel } from '../../../packages/tools/harness/mock-deepseek.mjs'
import * as v3 from './a5x-fork-ioaxis-v3.mjs'
import * as native from '../../../tests/deepseek-harness-test-use/packages/terminal/terminal-bash/lib/index.js'

const HERE = dirname(fileURLToPath(import.meta.url))
const WORKTREE = resolve(HERE, '..', '..', '..')
const TEST_USE = join(WORKTREE, TEST_USE_REL)
const HOST_BIN = join(TEST_USE, 'apps', 'cli', 'lib', 'bin.js')
const RUN_STAMP = process.env.A5X_STAMP ?? new Date().toISOString().replace(/[-:]/g, '').slice(0, 15)
const PORT = Number(process.env.A5X_PORT ?? 3186)
const EVIDENCE = join(WORKTREE, 'dev', 'agent-workflow', 'evidence', `a5x-pocIOAXIS-${RUN_STAMP}`)
const HOME = join(WORKTREE, TEST_HOME_ROOT_REL, `a5x-pocIOAXIS-${RUN_STAMP}`)
const HOST_LOG = join(EVIDENCE, 'host.log')
const ROOT_A = join(EVIDENCE, 'baseA', 'rootA')
const ROOT_B = join(EVIDENCE, 'baseB', 'rootB')
const CAPS = join(EVIDENCE, 'member-caps.json')
const ORIGIN = `http://127.0.0.1:${PORT}`
const SID = (lane) => `a5x-ioaxis-${lane}-${RUN_STAMP}`
const A_TEXT = 'ALPHA-CONTENT-7741\n'
const B_TEXT = 'BETA-CONTENT-3356\n'
const log = (m) => console.log(`[ioaxiskit ${new Date().toISOString().slice(11, 19)}] ${m}`)
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

function sha256ish(p) {
  return spawnSync('git', ['hash-object', p], { cwd: WORKTREE, encoding: 'utf8' }).stdout.trim()
}

function prepareWorld() {
  const head = spawnSync('git', ['-C', TEST_USE, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).stdout.trim()
  if (!head.startsWith(TEST_USE_BASELINE_SHA)) throw new Error(`pristine drift: ${head}`)
  mkdirSync(ROOT_A, { recursive: true })
  mkdirSync(ROOT_B, { recursive: true })
  writeFileSync(join(ROOT_A, 'one-file.txt'), A_TEXT)
  writeFileSync(join(ROOT_A, 'dir-other.txt'), 'ALPHA-DIR-OTHER-2290\n')
  writeFileSync(join(ROOT_B, 'b-file.txt'), B_TEXT)
  writeFileSync(CAPS, JSON.stringify({
    [SID('IO-R')]: { gen: 1, mode: 'workspace-write', workspaceRoot: ROOT_A, io: { maskPaths: [ROOT_B] } },
    [SID('IO-W')]: { gen: 1, mode: 'workspace-write', workspaceRoot: ROOT_B, io: { writeRoots: [ROOT_B] } },
  }, null, 2))
  mkdirSync(join(HOME, 'profiles', 'web'), { recursive: true })
  const forkUrl = pathToFileURL(join(HERE, 'a5x-fork-ioaxis-v3.mjs')).href
  const presetRow = presetDeclarationRow({
    id: 'a5x-ioaxis-tools',
    displayName: 'a5x ioaxis shell',
    description: `a5x-pocIOAXIS ${RUN_STAMP}: persona + shell group with dual-axis capped terminal-bash wrapper (PoC)`,
    plugins: [
      { id: 'persona', name: PERSONA_ROW_NAME, config: { prefix: 'You are the a5x PoC member. Use the bash tool for each delegated command, exactly, in order.' } },
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
  const patchLines = ['# a5x-pocIOAXIS ' + RUN_STAMP + ': preset row only (roster is ours)', '- insert:']
    .concat(yItemLines({ id: presetRow.id, name: presetRow.name, config: presetRow.config }, 2))
  writeFileSync(join(HOME, 'profiles', 'web', 'cordis.patch.yml'), patchLines.join('\n') + '\n')
}

// --- minimal YAML (same shape as b2r2 kit) ---
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
      A5X_IOAXIS_CAPS: CAPS,
    },
  })
  child.on('close', (code, signal) => appendFileSync(HOST_LOG, `\n[ioaxiskit] host closed code=${code} signal=${signal}\n`))
  return child
}
async function waitForBoot(ms = 150_000) {
  const deadline = Date.now() + ms
  while (Date.now() < deadline) {
    const txt = existsSync(HOST_LOG) ? readFileSync(HOST_LOG, 'utf8') : ''
    const m = txt.match(/dsh web: http:\/\/127\.0\.0\.1:(\d+)\/\?token=([A-Za-z0-9_-]+)/)
    if (m !== null) return { token: m[2] }
    await sleep(400)
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
async function apiCreate(cookie, sessionId) {
  const created = await fetchJson(`${ORIGIN}/api/session/create`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie },
    body: JSON.stringify({ type: 'client-request', rpcId: `iox-${Math.random().toString(36).slice(2, 10)}`, method: 'session/create', payload: { args: { request: { sessionId, cwd: WORKTREE, agentPreset: 'a5x-ioaxis-tools' } } } }),
  })
  if (created.status !== 200) throw new Error(`create ${created.status}`)
  if (created.body?.result?.ok === false) throw new Error(`create envelope invalid: ${JSON.stringify(created.body.result).slice(0, 300)}`)
}
async function apiPrompt(cookie, sessionId, text) {
  const prompted = await fetchJson(`${ORIGIN}/api/session/prompt`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie },
    body: JSON.stringify({ type: 'client-request', rpcId: `ioxp-${Math.random().toString(36).slice(2, 10)}`, method: 'session/prompt', payload: { args: { request: { requestId: `iox-${Math.random().toString(36).slice(2, 8)}`, sessionId, mode: 'queue', content: [{ type: 'text', text }] } } } }),
  })
  if (prompted.status !== 200) throw new Error(`prompt ${prompted.status}`)
}
async function waitLaneDone(lane, mock, ms = 180_000) {
  const deadline = Date.now() + ms
  while (Date.now() < deadline) {
    if (lanes[lane].done) return
    if (mock.requests.length > 100) throw new Error(`mock storm fuse (${mock.requests.length})`)
    await sleep(400)
  }
  throw new Error(`lane ${lane} never completed`)
}
async function stableProbe() {
  const res = await fetch(`http://127.0.0.1:${STABLE_INSTANCE_PORT}/`, { signal: AbortSignal.timeout(4000) }).catch(() => null)
  return res === null ? 'unreachable' : res.status
}

// ── lanes ────────────────────────────────────────────────────────────────────
const blockText = (b) => (b?.type === 'tool_result'
  ? (typeof b.content === 'string' ? b.content : (b.content ?? []).map((c) => String(c?.text ?? '')).join(' '))
  : String(b?.text ?? ''))
const textOfMsg = (m) => (typeof m?.content === 'string' ? m.content
  : Array.isArray(m?.content) ? m.content.map(blockText).join(' ') : '')
const toolCall = (id, name2, args) => ({ kind: 'tool-call', toolCalls: [{ id, name: name2, arguments: args }] })
const lanes = {}
for (const lane of ['IO-R', 'IO-W']) lanes[lane] = { step: 0, tails: {}, done: false }

function laneScript(lane, st) {
  const C = (cmd) => toolCall(`${lane}-${String(st.step)}`, 'bash', { command: cmd })
  switch (lane) {
    case 'IO-R':
      switch (st.step) {
        case 0: return C(`cat ${join(ROOT_A, 'one-file.txt')}`)
        case 1: return C(`cat ${join(ROOT_B, 'b-file.txt')}`)
        case 2: return C(`echo x > ${join(ROOT_A, 'r-write.txt')}`)
        default: st.done = true; return { kind: 'text', content: 'A5X-IOAXIS-DONE' }
      }
    case 'IO-W':
      switch (st.step) {
        case 0: return C(`echo w-content > ${join(ROOT_B, 'w-new.txt')} && cat ${join(ROOT_B, 'w-new.txt')}`)
        case 1: return C(`echo x > ${join(ROOT_A, 'w-write.txt')}`)
        case 2: return C(`cat ${join(ROOT_A, 'one-file.txt')}`)
        default: st.done = true; return { kind: 'text', content: 'A5X-IOAXIS-DONE' }
      }
  }
}
function makeDecide() {
  let n = 0
  return ({ req }) => {
    n += 1
    const messages = req?.messages ?? []
    const all = messages.map(textOfMsg).join('\n')
    const firstUser = messages.find((m) => m?.role === 'user')
    const laneHint = ['IO-R', 'IO-W'].find((l) => new RegExp(`A5X-LANE-${l}\\b`).test(textOfMsg(firstUser))) ?? (all.includes('Generate the session title') ? 'TITLE' : 'NONE')
    appendFileSync(join(EVIDENCE, 'mock-reqs.jsonl'), JSON.stringify({ n, lane: laneHint, steps: { 'IO-R': lanes['IO-R'].step, 'IO-W': lanes['IO-W'].step } }) + '\n')
    try {
      if (all.includes('Generate the session title')) return { kind: 'text', content: 'a5x ioaxis' }
      const lane = ['IO-R', 'IO-W'].find((l) => new RegExp(`A5X-LANE-${l}\\b`).test(textOfMsg(firstUser)))
      if (lane === undefined) return { kind: 'text', content: 'ioaxis-neutral' }
      const st = lanes[lane]
      st.tails[`step${String(st.step)}`] = messages.slice(-2).map(textOfMsg).join('\n').slice(0, 600)
      const reply = laneScript(lane, st)
      st.step += 1
      return reply
    } catch (e) {
      appendFileSync(join(EVIDENCE, 'mock-reqs.jsonl'), JSON.stringify({ n, DECIDE_ERROR: String(e?.stack ?? e).slice(0, 300) }) + '\n')
      throw e
    }
  }
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
    await apiCreate(cookie, SID('IO-R'))
    await apiPrompt(cookie, SID('IO-R'), 'A5X-LANE-IO-R run each delegated command exactly, in order.')
    await waitLaneDone('IO-R', mock)
    await apiCreate(cookie, SID('IO-W'))
    await apiPrompt(cookie, SID('IO-W'), 'A5X-LANE-IO-W run each delegated command exactly, in order.')
    await waitLaneDone('IO-W', mock)
  } finally {
    host.kill('SIGTERM')
    await mock.close?.()
  }
  stable.after = await stableProbe()
  const hostLog = existsSync(HOST_LOG) ? readFileSync(HOST_LOG, 'utf8') : ''
  const ioaxisLines = hostLog.split('\n').filter((l) => l.includes('[ioaxis]'))
  // NOTE: tails[stepN] is captured at the DECISION of step N, i.e. it contains
  // the tool result of step N-1 (B2R2 semantics). The result of command step N
  // therefore lives in tails[stepN+1].
  const resultOf = (lane, step) => lanes[lane].tails[`step${String(step + 1)}`] ?? ''
  const report = {
    stamp: RUN_STAMP,
    stableProbe: stable,
    hostSha: TEST_USE_BASELINE_SHA,
    hostHeadActual: spawnSync('git', ['-C', TEST_USE, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).stdout.trim(),
    wrapperSourceSha: sha256ish(join(HERE, 'a5x-fork-ioaxis-v3.mjs')),
    nativeToolDefinitionIdentity: {
      nameUnchanged: v3.name === native.name,
      injectUnchanged: JSON.stringify(v3.inject) === JSON.stringify(native.inject),
      name: native.name,
      inject: native.inject,
    },
    verdicts: {
      'IO-R(read-axis domain, io.maskPaths=[rootB])': {
        readA_ok: resultOf('IO-R', 0).includes('ALPHA-CONTENT-7741'),
        readB_denied_ENOENT: resultOf('IO-R', 1).includes('No such file') && !resultOf('IO-R', 1).includes('BETA-CONTENT-3356'),
        writeA_denied_EROFS: resultOf('IO-R', 2).includes('Read-only file system'),
        fs_rootA_untouched: !existsSync(join(ROOT_A, 'r-write.txt')),
      },
      'IO-W(write-axis domain, io.writeRoots=[rootB])': {
        writeB_ok: resultOf('IO-W', 0).includes('w-content'),
        writeB_fs: existsSync(join(ROOT_B, 'w-new.txt')) && readFileSync(join(ROOT_B, 'w-new.txt'), 'utf8').trim() === 'w-content',
        writeA_denied_EROFS: resultOf('IO-W', 1).includes('Read-only file system'),
        writeA_fs: !existsSync(join(ROOT_A, 'w-write.txt')),
        readA_in_W_readable_dialect: resultOf('IO-W', 2).includes('ALPHA-CONTENT-7741'),
      },
      'SEAM(consulted trace via existing public service faces)': {
        resolveConsultedBoth: ioaxisLines.some((l) => l.includes(`sid=${SID('IO-R')}`) && l.includes('resolve')) && ioaxisLines.some((l) => l.includes(`sid=${SID('IO-W')}`) && l.includes('resolve')),
        capIoApplied: ioaxisLines.filter((l) => l.includes('CAP applied') && l.includes('io=yes')).length === 2,
        confineDualAxisR: ioaxisLines.some((l) => l.includes(`sid=${SID('IO-R')}`) && l.includes('[ioaxis] confine') && l.includes(`maskPaths=["${ROOT_B}"]`)),
        confineDualAxisW: ioaxisLines.some((l) => l.includes(`sid=${SID('IO-W')}`) && l.includes('[ioaxis] confine') && l.includes(`writeRoots=["${ROOT_B}"]`)),
      },
    },
    tails: lanes,
    consulted: ioaxisLines,
    mockRequests: mock.requests?.length ?? -1,
  }
  writeFileSync(join(EVIDENCE, 'ioaxis.json'), JSON.stringify(report, null, 2))
  const v = report.verdicts
  log(JSON.stringify({
    'IO-R': v['IO-R(read-axis domain, io.maskPaths=[rootB])'],
    'IO-W': v['IO-W(write-axis domain, io.writeRoots=[rootB])'],
    SEAM: v['SEAM(consulted trace via existing public service faces)'],
    toolDefIdentity: report.nativeToolDefinitionIdentity,
    stable: stable,
  }, null, 1))
  log('EVIDENCE ' + EVIDENCE)
}
main().catch((e) => {
  console.error('FATAL', e.stack ?? String(e))
  try {
    const reqs = readFileSync(join(EVIDENCE, 'mock-reqs.jsonl'), 'utf8').trim().split('\n').slice(-12)
    console.error('MOCK-TAIL ' + reqs.join(' | ').slice(0, 1500))
    console.error('LANES ' + JSON.stringify(Object.fromEntries(Object.entries(lanes).map(([k, v]) => [k, { step: v.step, done: v.done }]))))
    const hl = readFileSync(HOST_LOG, 'utf8').trim().split('\n').slice(-8).join(' | ')
    console.error('HOSTLOG-TAIL ' + hl.slice(0, 1500))
  } catch (e2) { console.error('dump failed', String(e2)) }
  process.exit(1)
})
