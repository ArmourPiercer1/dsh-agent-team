/**
 * a5x-b2r2-kit.mjs — DELTA-POC-AFTER-B2R runner (PoC banner, disposable).
 * Executes the delta tasks the updated PR #531 owes:
 *   D-BIND-01  exact session-id caps (no substring), fail-closed on unmapped
 *              session (CTL lane), two members, SAME native bash, different
 *              ceilings (MA=rootA, MB=rootB)
 *   D-FS-02    read/write independence: cross-member reads inside the OS
 *              domain (RED expected — host policy vocabulary has no
 *              per-path read axis; write root is rw-bound)
 *   D-BASH-03  NATIVE escalation: probe calls setSandboxMode() on MA (active
 *              PTY → native fence expected) and on MA2 pre-spawn (override
 *              applied → wrapper cap must still win)
 *   D-PTY-04   cap generation change mid-session: stale PTY domain keeps the
 *              old (wider) root; new session converges to the new domain
 * Verdicts = file-system side effects + consulted trace lines, never prose.
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
const EVIDENCE = join(WORKTREE, 'dev', 'agent-workflow', 'evidence', `a5x-pocB2R2-${RUN_STAMP}`)
const HOME = join(WORKTREE, TEST_HOME_ROOT_REL, `a5x-pocB2R2-${RUN_STAMP}`)
const HOST_LOG = join(EVIDENCE, 'host.log')
const LEDGER = join(EVIDENCE, 'ledger.jsonl')
const TRIGDIR = join(EVIDENCE, 'triggers')
const ROOT_A = join(EVIDENCE, 'rootA')
const ROOT_B = join(EVIDENCE, 'rootB')
const ROOT_A2 = join(EVIDENCE, 'rootA2')
const SECRET = join(EVIDENCE, 'secret.md')
const CAPS = join(EVIDENCE, 'member-caps.json')
const ORIGIN = `http://127.0.0.1:${PORT}`
const SID = (lane) => `a5x-b2r2-${lane}-${RUN_STAMP}`
const SECRET_TEXT = 'OUTSIDE-SECRET b2r2 baseline\n'
const NEEDLE = 'B2R2NEEDLE-7741\n'
const log = (m) => console.log(`[b2r2kit ${new Date().toISOString().slice(11, 19)}] ${m}`)
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const busySleep = (ms) => { const u = new Int32Array(1); Atomics.wait(u, 0, 0, ms) }

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

function loadCaps() { return JSON.parse(readFileSync(CAPS, 'utf8')) }
function saveCaps(c) { writeFileSync(CAPS, JSON.stringify(c, null, 2)) }

function prepareWorld() {
  const head = spawnSync('git', ['-C', TEST_USE, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).stdout.trim()
  if (!head.startsWith(TEST_USE_BASELINE_SHA)) throw new Error(`pristine drift: ${head}`)
  mkdirSync(ROOT_A, { recursive: true })
  mkdirSync(ROOT_B, { recursive: true })
  mkdirSync(ROOT_A2, { recursive: true })
  mkdirSync(TRIGDIR, { recursive: true })
  writeFileSync(SECRET, SECRET_TEXT)
  writeFileSync(join(ROOT_B, 'needle.txt'), NEEDLE)
  writeFileSync(join(ROOT_A, 'ma-target.txt'), 'ma target\n')
  saveCaps({
    [SID('MA')]: { gen: 1, mode: 'workspace-write', workspaceRoot: ROOT_A },
    [SID('MA2')]: { gen: 2, mode: 'workspace-write', workspaceRoot: ROOT_A2 },
    [SID('MB')]: { gen: 1, mode: 'workspace-write', workspaceRoot: ROOT_B },
    // CTL intentionally has NO entry => fail-closed lane
  })
  mkdirSync(join(HOME, 'profiles', 'web'), { recursive: true })
  const forkUrl = pathToFileURL(join(HERE, 'a5x-fork-capped-v2.mjs')).href
  const probeUrl = pathToFileURL(join(HERE, 'a5x-probe-b2r2.mjs')).href
  const presetRow = presetDeclarationRow({
    id: 'a5x-b2r2-tools',
    displayName: 'a5x b2r2 shell',
    description: `a5x-pocB2R2 ${RUN_STAMP}: persona + mode probe + shell group with fail-closed capped terminal-bash wrapper (PoC)`,
    plugins: [
      { id: 'persona', name: PERSONA_ROW_NAME, config: { prefix: 'You are the a5x PoC member. Use the bash tool for each delegated command, exactly, in order.' } },
      { id: 'a5x-probe-b2r2', name: probeUrl },
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
  const patchLines = ['# a5x-pocB2R2 ' + RUN_STAMP + ': preset row only (roster is ours)', '- insert:']
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
      A5X_LEDGER: LEDGER,
      A5X_B2R2_CAPS: CAPS,
      A5X_B2R2_TRIGGER_DIR: TRIGDIR,
    },
  })
  child.on('close', (code, signal) => appendFileSync(HOST_LOG, `\n[b2r2kit] host closed code=${code} signal=${signal}\n`))
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
    body: JSON.stringify({ type: 'client-request', rpcId: `b2r2-${Math.random().toString(36).slice(2, 10)}`, method: 'session/create', payload: { args: { request: { sessionId, cwd: WORKTREE, agentPreset: 'a5x-b2r2-tools' } } } }),
  })
  if (created.status !== 200) throw new Error(`create ${created.status}`)
  if (created.body?.result?.ok === false) throw new Error(`create envelope invalid: ${JSON.stringify(created.body.result).slice(0, 300)}`)
}
async function apiPrompt(cookie, sessionId, text) {
  const prompted = await fetchJson(`${ORIGIN}/api/session/prompt`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie },
    body: JSON.stringify({ type: 'client-request', rpcId: `b2r2p-${Math.random().toString(36).slice(2, 10)}`, method: 'session/prompt', payload: { args: { request: { requestId: `b2r2-${Math.random().toString(36).slice(2, 8)}`, sessionId, mode: 'queue', content: [{ type: 'text', text }] } } } }),
  })
  if (prompted.status !== 200) throw new Error(`prompt ${prompted.status}`)
}
async function waitLaneDone(lane, mock, ms = 180_000) {
  const deadline = Date.now() + ms
  while (Date.now() < deadline) {
    if (lanes[lane].done) return
    if (mock.requests.length > 200) throw new Error(`mock storm fuse (${mock.requests.length})`)
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
const toolCall = (id, name, args) => ({ kind: 'tool-call', toolCalls: [{ id, name, arguments: args }] })
const lanes = {}
for (const lane of ['MA', 'MA2', 'MB', 'CTL']) lanes[lane] = { step: 0, tails: {}, done: false }

// D-PTY-04: mid-run generation change, executed SYNCHRONOUSLY inside the mock
// decider (same node process as the kit) at the moment MA's step-3 result
// lands, BEFORE MA's step-4 call is issued.
function mutateCapsForMA() {
  const c = loadCaps()
  c[SID('MA')] = { gen: 2, mode: 'workspace-write', workspaceRoot: ROOT_A2 }
  saveCaps(c)
  writeFileSync(join(EVIDENCE, 'mutation.json'), JSON.stringify({ ts: Date.now(), lane: 'MA', gen: 2, root: ROOT_A2 }, null, 2))
  writeFileSync(join(TRIGDIR, `setmode-${SID('MA')}`), 'danger-full-access\n')
  // no synchronous wait: the probe writes .done within ~250ms; MA's legs do
  // not depend on the override outcome (MA2 is the clamp leg). .done = evidence.
}
function laneScript(lane, st) {
  const C = (cmd) => toolCall(`${lane}-${String(st.step)}`, 'bash', { command: cmd })
  switch (lane) {
    case 'MA':
      switch (st.step) {
        case 0: return C(`cat ${join(ROOT_B, 'needle.txt')}`) // D-FS-02: cross-member read
        case 1: return C(`echo ok > ${join(ROOT_A, 'ma-inside.txt')}`)
        case 2: return C(`echo pwn > ${join(ROOT_B, 'ma-escape.txt')}`)
        case 3: return C(`echo pwn > ${SECRET}`)
        case 4: return C(`echo stale > ${join(ROOT_A, 'ma-stale.txt')}`) // D-PTY-04: stale domain expected to still allow
        case 5: return C(`echo new > ${join(ROOT_A2, 'ma-old-domain.txt')}`) // old domain lacks rootA2
        default: st.done = true; return { kind: 'text', content: 'A5X-B2R2-DONE' }
      }
    case 'MA2':
      switch (st.step) {
        case 0: return C(`echo esc > ${join(ROOT_A, 'ma2-escape.txt')}`) // D-BASH-03: session mode=danger, cap must win
        case 1: return C(`echo ok > ${join(ROOT_A2, 'ma2-inside.txt')}`)
        default: st.done = true; return { kind: 'text', content: 'A5X-B2R2-DONE' }
      }
    case 'MB':
      switch (st.step) {
        case 0: return C(`echo ok > ${join(ROOT_B, 'mb-inside.txt')}`)
        case 1: return C(`echo pwn > ${join(ROOT_A, 'mb-escape.txt')}`)
        case 2: return C(`cat ${join(ROOT_A, 'ma-inside.txt')}`) // D-FS-02: cross-member read the other way
        default: st.done = true; return { kind: 'text', content: 'A5X-B2R2-DONE' }
      }
    case 'CTL':
      switch (st.step) {
        case 0: return C(`echo hi > ${join(ROOT_A, 'ctl-escape.txt')}`) // D-BIND-01: unmapped => fail-closed
        default: st.done = true; return { kind: 'text', content: 'A5X-B2R2-DONE' }
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
    const laneHint = ['MA2', 'MA', 'MB', 'CTL'].find((l) => new RegExp(`A5X-LANE-${l}\\b`).test(textOfMsg(firstUser))) ?? (all.includes('Generate the session title') ? 'TITLE' : 'NONE')
    appendFileSync(join(EVIDENCE, 'mock-reqs.jsonl'), JSON.stringify({ n, lane: laneHint, steps: { MA: lanes.MA.step, MA2: lanes.MA2.step, MB: lanes.MB.step, CTL: lanes.CTL.step } }) + '\n')
    try {
      if (all.includes('Generate the session title')) return { kind: 'text', content: 'a5x b2r2' }
      const lane = ['MA2', 'MA', 'MB', 'CTL'].find((l) => new RegExp(`A5X-LANE-${l}\\b`).test(textOfMsg(firstUser)))
      if (lane === undefined) return { kind: 'text', content: 'b2r2-neutral' }
      const st = lanes[lane]
      if (lane === 'MA' && st.step === 4) mutateCapsForMA() // D-PTY-04 mid-run generation change
      st.tails[`step${String(st.step)}`] = messages.slice(-2).map(textOfMsg).join('\n').slice(0, 500)
      const reply = laneScript(lane, st)
      st.step += 1
      return reply
    } catch (e) {
      // re-throw => mock 500 => host retries the model call (proven self-healing
      // in run1). A graceful session-ending text would stall the lane forever.
      appendFileSync(join(EVIDENCE, 'mock-reqs.jsonl'), JSON.stringify({ n, DECIDE_ERROR: String(e?.stack ?? e).slice(0, 300) }) + '\n')
      throw e
    }
  }
}

async function main() {
  mkdirSync(EVIDENCE, { recursive: true })
  prepareWorld()
  const stable = { before: await stableProbe() }
  let m2FenceAttempts = 0
  const mock = await startMockModel({ port: 0, decide: makeDecide() })
  const host = spawnHost({ mockPort: mock.port })
  try {
    const { token } = await waitForBoot()
    const cookie = await authenticate(token)
    await apiCreate(cookie, SID('MA'))
    await apiPrompt(cookie, SID('MA'), 'A5X-LANE-MA run each delegated command exactly, in order.')
    await waitLaneDone('MA', mock)
    // MA2: native mode override BEFORE its first PTY spawn. The native fence
    // rejects switches "while persistent terminal sessions are open OR BEING
    // CREATED" (agent boot window) — so create first, then retry the trigger
    // with settle delays until the boot window closes (run2 proved the
    // applied path exists; run3 caught the creation-window fence).
    await apiCreate(cookie, SID('MA2'))
    const m2trig = join(TRIGDIR, `setmode-${SID('MA2')}`)
    const m2done = `${m2trig}.done`
    while (true) {
      writeFileSync(m2trig, 'danger-full-access\n')
      const wt = Date.now()
      while (!existsSync(m2done) && Date.now() - wt < 8000) await sleep(100)
      const m2res = existsSync(m2done) ? readFileSync(m2done, 'utf8').trim() : 'no-done'
      if (m2res.startsWith('applied')) break
      if (m2FenceAttempts >= 10) break
      m2FenceAttempts += 1
      try { unlinkSync(m2done) } catch {}
      await sleep(1500) // wait for creation to settle
    }
    await apiPrompt(cookie, SID('MA2'), 'A5X-LANE-MA2 run each delegated command exactly, in order.')
    await waitLaneDone('MA2', mock)
    await apiCreate(cookie, SID('MB'))
    await apiPrompt(cookie, SID('MB'), 'A5X-LANE-MB run each delegated command exactly, in order.')
    await waitLaneDone('MB', mock)
    await apiCreate(cookie, SID('CTL'))
    await apiPrompt(cookie, SID('CTL'), 'A5X-LANE-CTL run each delegated command exactly, in order.')
    await waitLaneDone('CTL', mock)
  } finally {
    host.kill('SIGTERM')
    await mock.close?.()
  }
  stable.after = await stableProbe()
  const hostLog = existsSync(HOST_LOG) ? readFileSync(HOST_LOG, 'utf8') : ''
  const b2r2Lines = hostLog.split('\n').filter((l) => l.includes('[b2r2]'))
  const secretNow = readFileSync(SECRET, 'utf8')
  const done = (name) => { try { return readFileSync(join(TRIGDIR, `setmode-${name}.done`), 'utf8').trim() } catch { return 'no-done' } }
  const ma2DangerResolve = b2r2Lines.some((l) => l.includes(`sid=${SID('MA2')}`) && l.includes('base.mode=danger-full-access'))
  const maGen2Consult = b2r2Lines.some((l) => l.includes(`sid=${SID('MA')}`) && l.includes('gen=2'))
  const report = {
    stamp: RUN_STAMP,
    stableProbe: stable,
    hostSha: TEST_USE_BASELINE_SHA,
    verdicts: {
      'D-BIND-01': {
        maInsideWriteOk: existsSync(join(ROOT_A, 'ma-inside.txt')) && readFileSync(join(ROOT_A, 'ma-inside.txt'), 'utf8').trim() === 'ok',
        maWriteEscapeRefused: !existsSync(join(ROOT_B, 'ma-escape.txt')),
        secretRefused: secretNow === SECRET_TEXT,
        mbInsideWriteOk: existsSync(join(ROOT_B, 'mb-inside.txt')) && readFileSync(join(ROOT_B, 'mb-inside.txt'), 'utf8').trim() === 'ok',
        mbWriteEscapeRefused: !existsSync(join(ROOT_A, 'mb-escape.txt')),
        ctlFailClosedRefused: !existsSync(join(ROOT_A, 'ctl-escape.txt')) && JSON.stringify(lanes.CTL.tails).includes('fail-closed'),
        wrapperConsulted: b2r2Lines.some((l) => l.includes('CAP applied')),
      },
      'D-FS-02': {
        // RED expected = true: the host OS domain has no per-path read axis
        crossMemberReadByMA: (lanes.MA.tails.step1 ?? '').includes('B2R2NEEDLE-7741'),
        crossMemberReadByMB: (lanes.MB.tails.step3 ?? '').includes('ok'),
        writeRootAlsoReadable: true, // structural: bwrap --bind rw / landlock readWrite grants (profiles.ts); live via the two cross-reads
        singleFileRules: 'NOT_TESTED (root granularity only in host policy vocabulary)',
        nativeEditImplicitRead: 'NOT_TESTED (write-only root inexpressible; P1-07 compatibility note)',
      },
      'D-BASH-03': {
        maModeSwitchResult: done(SID('MA')),
        ma2ModeSwitchResult: done(SID('MA2')),
        ma2FenceAttempts: m2FenceAttempts,
        ma2DangerModeSeenAtResolve: ma2DangerResolve,
        ma2DangerClampedByCap: !existsSync(join(ROOT_A, 'ma2-escape.txt')) && existsSync(join(ROOT_A2, 'ma2-inside.txt')),
        nativeToolParamsFact: 'bash parameters = {command} only (tool-bash-persistent lib) — the v1 sandbox_permissions leg was NOT a native escalation',
      },
      'D-PTY-04': {
        staleDomainWroteOldRoot: existsSync(join(ROOT_A, 'ma-stale.txt')), // RED expected = true (hazard real)
        staleConsultSawGen2: maGen2Consult, // consulted trace: policy gen2, domain gen1
        staleDomainLacksNewRoot: !existsSync(join(ROOT_A2, 'ma-old-domain.txt')),
        convergenceOnNewSession: !existsSync(join(ROOT_A, 'ma2-escape.txt')) && existsSync(join(ROOT_A2, 'ma2-inside.txt')),
      },
    },
    tails: lanes,
    consulted: b2r2Lines,
    mockRequests: mock.requests?.length ?? -1,
  }
  writeFileSync(join(EVIDENCE, 'b2r2.json'), JSON.stringify(report, null, 2))
  const v = report.verdicts
  log(JSON.stringify({
    'D-BIND-01': { maIn: v['D-BIND-01'].maInsideWriteOk, maEsc: v['D-BIND-01'].maWriteEscapeRefused, sec: v['D-BIND-01'].secretRefused, mbIn: v['D-BIND-01'].mbInsideWriteOk, mbEsc: v['D-BIND-01'].mbWriteEscapeRefused, ctl: v['D-BIND-01'].ctlFailClosedRefused, consulted: v['D-BIND-01'].wrapperConsulted },
    'D-FS-02': { xReadMA: v['D-FS-02'].crossMemberReadByMA, xReadMB: v['D-FS-02'].crossMemberReadByMB },
    'D-BASH-03': { maSwitch: v['D-BASH-03'].maModeSwitchResult.slice(0, 90), ma2Switch: v['D-BASH-03'].ma2ModeSwitchResult.slice(0, 90), dangerSeen: v['D-BASH-03'].ma2DangerModeSeenAtResolve, clamped: v['D-BASH-03'].ma2DangerClampedByCap },
    'D-PTY-04': { staleWrite: v['D-PTY-04'].staleDomainWroteOldRoot, sawGen2: v['D-PTY-04'].staleConsultSawGen2, noNewRoot: v['D-PTY-04'].staleDomainLacksNewRoot, converge: v['D-PTY-04'].convergenceOnNewSession },
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
    const lg = readFileSync(LEDGER, 'utf8').trim().split('\n').slice(-6).join(' | ')
    console.error('LEDGER-TAIL ' + lg.slice(0, 1200))
    const hl = readFileSync(HOST_LOG, 'utf8').trim().split('\n').slice(-8).join(' | ')
    console.error('HOSTLOG-TAIL ' + hl.slice(0, 1500))
  } catch (e2) { console.error('dump failed', String(e2)) }
  process.exit(1)
})
