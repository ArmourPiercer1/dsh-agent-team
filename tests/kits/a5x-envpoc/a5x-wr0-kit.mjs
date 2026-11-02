/**
 * a5x-wr0-kit.mjs — 严格只写不读 DSH 接缝 PoC runner（PoC banner, disposable）.
 *
 * 内核层已独立验证（a5x-wr0-step1.sh，15/15 绿：VFS owner 位 0300/0200 +
 * bwrap rw-bind 组合，域内拒绝 = EACCES，区别于 EROFS/ENOENT）。本 kit 验证
 * 同一能力经「现有/最小扩展的 DSH 基础设施接缝」交付给原生 bash 工具：
 *   io.writeOnlyRoots[] = v4 词汇新增（additive）；confine 影子构造 rw-bind
 *   （bwrap 层）+ fail-closed 前置条件（宿主 VFS 位 = deployer 前置条件）。
 * 单 lane WO（只写不读域）：读文件 EACCES / 列表 EACCES / 追加+新建 OK /
 *   域外写 EROFS；PTY 真实输出 + 宿主 FS 侧效应（teardown 恢复位后读回）双证。
 */
import { spawn, spawnSync } from 'node:child_process'
import { appendFileSync, chmodSync, existsSync, mkdirSync, openSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { CLIENT_COMMIT_HASH, TEST_USE_BASELINE_SHA, TEST_USE_REL, TEST_HOME_ROOT_REL, STABLE_INSTANCE_PORT } from '../../paths.mjs'
import { presetDeclarationRow, PERSONA_ROW_NAME } from '../_shared/preset-seam.mjs'
import { startMockModel } from '../../../packages/tools/harness/mock-deepseek.mjs'
import * as v4 from './a5x-fork-ioaxis-v4.mjs'
import * as native from '../../../tests/deepseek-harness-test-use/packages/terminal/terminal-bash/lib/index.js'

const HERE = dirname(fileURLToPath(import.meta.url))
const WORKTREE = resolve(HERE, '..', '..', '..')
const TEST_USE = join(WORKTREE, TEST_USE_REL)
const HOST_BIN = join(TEST_USE, 'apps', 'cli', 'lib', 'bin.js')
const RUN_STAMP = process.env.A5X_STAMP ?? new Date().toISOString().replace(/[-:]/g, '').slice(0, 15)
const PORT = Number(process.env.A5X_PORT ?? 3186)
const EVIDENCE = join(WORKTREE, 'dev', 'agent-workflow', 'evidence', `a5x-pocWR0-${RUN_STAMP}`)
const HOME = join(WORKTREE, TEST_HOME_ROOT_REL, `a5x-pocWR0-${RUN_STAMP}`)
const HOST_LOG = join(EVIDENCE, 'host.log')
const BASE_W = join(EVIDENCE, 'baseW')
const ROOT_W = join(BASE_W, 'rootW')
const CAPS = join(EVIDENCE, 'member-caps.json')
const ORIGIN = `http://127.0.0.1:${PORT}`
const SID = `a5x-wr0-WO-${RUN_STAMP}`
const SEED = 'WRITEONLY-SEED-1123\n'
const log = (m) => console.log(`[wr0kit ${new Date().toISOString().slice(11, 19)}] ${m}`)
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

function sha256ish(p) {
  return spawnSync('git', ['hash-object', p], { cwd: WORKTREE, encoding: 'utf8' }).stdout.trim()
}

function prepareWorld() {
  const head = spawnSync('git', ['-C', TEST_USE, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).stdout.trim()
  if (!head.startsWith(TEST_USE_BASELINE_SHA)) throw new Error(`pristine drift: ${head}`)
  mkdirSync(ROOT_W, { recursive: true })
  writeFileSync(join(ROOT_W, 'wf.txt'), SEED)
  chmodSync(ROOT_W, 0o300)      // 只写不读前置条件（宿主侧，spawn 前）
  chmodSync(join(ROOT_W, 'wf.txt'), 0o200)
  writeFileSync(CAPS, JSON.stringify({
    [SID]: { gen: 1, mode: 'workspace-write', workspaceRoot: ROOT_W, io: { writeOnlyRoots: [ROOT_W] } },
  }, null, 2))
  mkdirSync(join(HOME, 'profiles', 'web'), { recursive: true })
  const forkUrl = pathToFileURL(join(HERE, 'a5x-fork-ioaxis-v4.mjs')).href
  const presetRow = presetDeclarationRow({
    id: 'a5x-wr0-tools',
    displayName: 'a5x wr0 shell',
    description: `a5x-pocWR0 ${RUN_STAMP}: persona + shell group with write-only capped terminal-bash wrapper (PoC)`,
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
  const patchLines = ['# a5x-pocWR0 ' + RUN_STAMP + ': preset row only (roster is ours)', '- insert:']
    .concat(yItemLines({ id: presetRow.id, name: presetRow.name, config: presetRow.config }, 2))
  writeFileSync(join(HOME, 'profiles', 'web', 'cordis.patch.yml'), patchLines.join('\n') + '\n')
}

function restoreModes() {
  try {
    if (existsSync(ROOT_W)) {
      for (const f of [join(ROOT_W, 'wf.txt'), join(ROOT_W, 'wf2.txt')]) if (existsSync(f)) chmodSync(f, 0o644)
      chmodSync(ROOT_W, 0o755)
    }
  } catch (e) { log('restoreModes warn: ' + String(e).slice(0, 120)) }
}

// --- minimal YAML (same shape as ioaxis kit) ---
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

function spawnHost() {
  const outFd = openSync(HOST_LOG, 'a')
  const child = spawn(process.execPath, [HOST_BIN, 'web', '--port', String(PORT), '--no-open'], {
    cwd: WORKTREE,
    stdio: ['ignore', outFd, outFd],
    env: {
      ...process.env,
      DSH_HOME: HOME,
      DSH_CLIENT_COMMIT_HASH: CLIENT_COMMIT_HASH,
      DEEPSEEK_BASE_URL: `http://127.0.0.1:${mock.port}`,
      DEEPSEEK_API_KEY: 'a5x-mock-key',
      A5X_IOAXIS_CAPS: CAPS,
    },
  })
  child.on('close', (code, signal) => appendFileSync(HOST_LOG, `\n[wr0kit] host closed code=${code} signal=${signal}\n`))
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
    body: JSON.stringify({ type: 'client-request', rpcId: `wr0-${Math.random().toString(36).slice(2, 10)}`, method: 'session/create', payload: { args: { request: { sessionId, cwd: WORKTREE, agentPreset: 'a5x-wr0-tools' } } } }),
  })
  if (created.status !== 200) throw new Error(`create ${created.status}`)
  if (created.body?.result?.ok === false) throw new Error(`create envelope invalid: ${JSON.stringify(created.body.result).slice(0, 300)}`)
}
async function apiPrompt(cookie, sessionId, text) {
  const prompted = await fetchJson(`${ORIGIN}/api/session/prompt`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie },
    body: JSON.stringify({ type: 'client-request', rpcId: `wr0p-${Math.random().toString(36).slice(2, 10)}`, method: 'session/prompt', payload: { args: { request: { requestId: `wr0-${Math.random().toString(36).slice(2, 8)}`, sessionId, mode: 'queue', content: [{ type: 'text', text }] } } } }),
  })
  if (prompted.status !== 200) throw new Error(`prompt ${prompted.status}`)
}
async function waitLaneDone(mock, ms = 180_000) {
  const deadline = Date.now() + ms
  while (Date.now() < deadline) {
    if (lanes.WO.done) return
    if (mock.requests.length > 100) throw new Error(`mock storm fuse (${mock.requests.length})`)
    await sleep(400)
  }
  throw new Error('lane WO never completed')
}
async function stableProbe() {
  const res = await fetch(`http://127.0.0.1:${STABLE_INSTANCE_PORT}/`, { signal: AbortSignal.timeout(4000) }).catch(() => null)
  return res === null ? 'unreachable' : res.status
}

// ── lane ─────────────────────────────────────────────────────────────────────
const blockText = (b) => (b?.type === 'tool_result'
  ? (typeof b.content === 'string' ? b.content : (b.content ?? []).map((c) => String(c?.text ?? '')).join(' '))
  : String(b?.text ?? ''))
const textOfMsg = (m) => (typeof m?.content === 'string' ? m.content
  : Array.isArray(m?.content) ? m.content.map(blockText).join(' ') : '')
const toolCall = (id, name2, args) => ({ kind: 'tool-call', toolCalls: [{ id, name: name2, arguments: args }] })
const lanes = { WO: { step: 0, tails: {}, done: false } }

function laneScript(st) {
  const C = (cmd) => toolCall(`WO-${String(st.step)}`, 'bash', { command: cmd })
  switch (st.step) {
    case 0: return C(`cat ${join(ROOT_W, 'wf.txt')}`)
    case 1: return C(`ls -A ${ROOT_W}`)
    case 2: return C(`echo TOOL-APPEND-7788 >> ${join(ROOT_W, 'wf.txt')} && echo TOOL-NEW-3344 > ${join(ROOT_W, 'wf2.txt')} && stat -c %s ${join(ROOT_W, 'wf.txt')}`)
    case 3: return C(`echo z > ${join(BASE_W, 'sib.txt')}`)
    default: st.done = true; return { kind: 'text', content: 'A5X-WR0-DONE' }
  }
}
function makeDecide() {
  let n = 0
  return ({ req }) => {
    n += 1
    const messages = req?.messages ?? []
    const all = messages.map(textOfMsg).join('\n')
    const firstUser = messages.find((m) => m?.role === 'user')
    const laneHint = /A5X-LANE-WO\b/.test(textOfMsg(firstUser)) ? 'WO' : (all.includes('Generate the session title') ? 'TITLE' : 'NONE')
    appendFileSync(join(EVIDENCE, 'mock-reqs.jsonl'), JSON.stringify({ n, lane: laneHint, step: lanes.WO.step }) + '\n')
    try {
      if (all.includes('Generate the session title')) return { kind: 'text', content: 'a5x wr0' }
      if (!/A5X-LANE-WO\b/.test(textOfMsg(firstUser))) return { kind: 'text', content: 'wr0-neutral' }
      const st = lanes.WO
      st.tails[`step${String(st.step)}`] = messages.slice(-2).map(textOfMsg).join('\n').slice(0, 700)
      const reply = laneScript(st)
      st.step += 1
      return reply
    } catch (e) {
      appendFileSync(join(EVIDENCE, 'mock-reqs.jsonl'), JSON.stringify({ n, DECIDE_ERROR: String(e?.stack ?? e).slice(0, 300) }) + '\n')
      throw e
    }
  }
}

let mock
async function main() {
  mkdirSync(EVIDENCE, { recursive: true })
  prepareWorld()
  const stable = { before: await stableProbe() }
  mock = await startMockModel({ port: 0, decide: makeDecide() })
  const host = spawnHost()
  try {
    const { token } = await waitForBoot()
    const cookie = await authenticate(token)
    await apiCreate(cookie, SID)
    await apiPrompt(cookie, SID, 'A5X-LANE-WO run each delegated command exactly, in order.')
    await waitLaneDone(mock)
  } finally {
    host.kill('SIGTERM')
    await mock.close?.()
    restoreModes()   // teardown 先于 oracle：恢复权限位后宿主侧才可读回
  }
  stable.after = await stableProbe()
  const hostLog = existsSync(HOST_LOG) ? readFileSync(HOST_LOG, 'utf8') : ''
  const ioaxisLines = hostLog.split('\n').filter((l) => l.includes('[ioaxis]'))
  const resultOf = (step) => lanes.WO.tails[`step${String(step + 1)}`] ?? ''   // B2R2 语义：tails[stepN] = step N-1 的结果
  const wf = existsSync(join(ROOT_W, 'wf.txt')) ? readFileSync(join(ROOT_W, 'wf.txt'), 'utf8') : ''
  const wf2 = existsSync(join(ROOT_W, 'wf2.txt')) ? readFileSync(join(ROOT_W, 'wf2.txt'), 'utf8') : ''
  const report = {
    stamp: RUN_STAMP,
    stableProbe: stable,
    hostSha: TEST_USE_BASELINE_SHA,
    hostHeadActual: spawnSync('git', ['-C', TEST_USE, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).stdout.trim(),
    wrapperSourceSha: sha256ish(join(HERE, 'a5x-fork-ioaxis-v4.mjs')),
    nativeToolDefinitionIdentity: {
      nameUnchanged: v4.name === native.name,
      injectUnchanged: JSON.stringify(v4.inject) === JSON.stringify(native.inject),
      name: native.name,
      inject: native.inject,
    },
    verdicts: {
      'WO(write-only domain, io.writeOnlyRoots=[rootW])': {
        readFile_denied_EACCES: resultOf(0).includes('Permission denied') && !resultOf(0).includes('WRITEONLY-SEED-1123'),
        listDir_denied_EACCES: resultOf(1).includes('Permission denied') && !resultOf(1).includes('wf.txt'),
        append_ok: resultOf(2).includes('[exit=0]') || /exit code 0/.test(resultOf(2)),
        create_ok: resultOf(2).includes('[exit=0]') || /exit code 0/.test(resultOf(2)),
        outside_write_scope_EROFS: resultOf(3).includes('Read-only file system'),
        denial_is_EACCES_not_EROFS: resultOf(0).includes('Permission denied') && !resultOf(0).includes('Read-only file system'),
        fs_appendLanded: wf.includes('TOOL-APPEND-7788'),
        fs_newFileLanded: wf2.trim() === 'TOOL-NEW-3344',
        fs_seedIntact: wf.startsWith(SEED.trim()),
      },
      'SEAM(consulted trace via existing public service faces)': {
        resolveConsulted: ioaxisLines.some((l) => l.includes(`sid=${SID}`) && l.includes('resolve') && l.includes('mapped=gen1')),
        capIoApplied: ioaxisLines.some((l) => l.includes(`sid=${SID}`) && l.includes('CAP applied') && l.includes('io=yes')),
        preconditionChecked: ioaxisLines.some((l) => l.includes(`sid=${SID}`) && l.includes('precondition') && l.includes('owner=300')),
        confineWriteOnly: ioaxisLines.some((l) => l.includes(`sid=${SID}`) && l.includes('[ioaxis] confine') && l.includes(`writeOnlyRoots=["${ROOT_W}"]`)),
      },
    },
    tails: lanes.WO.tails,
    consulted: ioaxisLines,
    mockRequests: mock.requests?.length ?? -1,
  }
  writeFileSync(join(EVIDENCE, 'wr0.json'), JSON.stringify(report, null, 2))
  const v = report.verdicts
  log(JSON.stringify({ WO: v['WO(write-only domain, io.writeOnlyRoots=[rootW])'], SEAM: v['SEAM(consulted trace via existing public service faces)'], toolDefIdentity: report.nativeToolDefinitionIdentity, stable }, null, 1))
  log('EVIDENCE ' + EVIDENCE)
}
main().catch((e) => {
  console.error('FATAL', e.stack ?? String(e))
  try {
    restoreModes()
    const reqs = readFileSync(join(EVIDENCE, 'mock-reqs.jsonl'), 'utf8').trim().split('\n').slice(-12)
    console.error('MOCK-TAIL ' + reqs.join(' | ').slice(0, 1500))
    console.error('LANES ' + JSON.stringify({ step: lanes.WO.step, done: lanes.WO.done }))
    const hl = readFileSync(HOST_LOG, 'utf8').trim().split('\n').slice(-8).join(' | ')
    console.error('HOSTLOG-TAIL ' + hl.slice(0, 1500))
  } catch (e2) { console.error('dump failed', String(e2)) }
  process.exit(1)
})
