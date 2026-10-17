#!/usr/bin/env node
/**
 * run-a5lspdr-live.mjs — W-LSP-DR LIVE runner: destroy-&-rebuild assembly
 * verification of the PROPOSED ruling semantics
 * ("policy change -> destroy & rebuild the member-isolated instance")
 * on the EXISTING public surface (isolate / realm.plugin / fiber.dispose).
 *
 * Flow (one world `a5lspdr-<stamp>`, port 3183 default, pinned Host 0.2.0-rc.2):
 *   g0: member A (session cwd = ws/wsa-g0) + sibling B (ws/wsb), each realm =
 *       agent.ctx.isolate('lsp') remount; REAL model route `lsp` hover per
 *       member; OS probes (pid alive, /proc/<pid>/cwd == its root, opens=1).
 *   policy change #1: ONE row step — dispose A's whole old realm (public
 *       fiber.dispose, awaited) -> OS proof the old server pid dies and ZERO
 *       /proc handles (cwd/fd) remain under the OLD workspace root -> rebuild
 *       a NEW realm (new isolate) on a NEW session (cwd = ws/wsa-g1) -> NEW
 *       pid via the REAL model route (distinct, opens=1); sibling B's pid
 *       unchanged + still hot-serving.
 *   policy change #2: same shape (wsa-g1 -> wsa-g2).  => FOUR lifecycle
 *       transitions total (dispose,create,dispose,create), all clean.
 *   final close: dispose A-g2 + B -> every ever-booted fixture pid dead,
 *       zero handles under ALL roots, no zombie children of the host, host
 *       fd-count samples (raw) recorded.
 *
 * Every judgement comes from the LIVE run: fixture pid ledger (birth/death
 * raw lines), row journal (assembly/dispose events), /proc scans from this
 * runner process, and the criteria json. Fixture caliber disclosed: the LSP
 * server is a fictional auditable fixture; pool/spawn/dispose are REAL host libs.
 *
 * EXIT 0 all criteria pass · 2 a criterion failed · 1 fatal.
 */
import { spawn, spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, openSync, readFileSync, readdirSync, realpathSync, rmSync, writeFileSync, appendFileSync } from 'node:fs'
import { createServer } from 'node:net'
import { dirname, join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

import { startMockModel } from '../../../../../packages/tools/harness/mock-deepseek.mjs'
import { TEST_USE_BASELINE_SHA, CLIENT_COMMIT_HASH } from '../../../../../tests/paths.mjs'

const args = process.argv.slice(2)
const argValue = (n, d) => { const i = args.indexOf(`--${n}`); return i === -1 ? d : args[i + 1] }
const KEEP = args.includes('--keep')
const HERE = dirname(new URL(import.meta.url).pathname)
const WORKTREE = resolve(argValue('worktree', resolve(HERE, '..', '..', '..', '..', '..')))
const RUN_STAMP = new Date().toISOString().slice(0, 19).replace(/:/g, '-') + 'Z'
const RUN = `a5lspdr-${RUN_STAMP}`
const EVIDENCE_DIR = resolve(argValue('evidence-dir', join(HERE, 'runs', RUN_STAMP)))
mkdirSync(EVIDENCE_DIR, { recursive: true })

const HOST_PORT = Number(argValue('port', 3183))
const TESTUSE = resolve([
  argValue('testuse', ''),
  join(WORKTREE, 'tests', 'deepseek-harness-test-use'),
  resolve(WORKTREE, '..', 'dsh-020rc2-upgrade', 'tests', 'deepseek-harness-test-use'),
  '/srv/workspace/dsh-plugins/dsh-agent-team/.worktrees/dsh-020rc2-upgrade/tests/deepseek-harness-test-use',
].filter((p) => p !== '' && existsSync(p))[0] ?? '')
const HOST_BIN = join(TESTUSE, 'apps', 'cli', 'lib', 'bin.js')
const ROW_PATH = join(HERE, 'a5lspdr-row.mjs')
const SERVER_PATH = join(HERE, 'fake-lang-server-a5lspdr.mjs')
const HOME = join(WORKTREE, 'tests', 'homes', RUN)
const WS = join(HOME, 'ws')
const ROOTS = { A0: join(WS, 'wsa-g0'), A1: join(WS, 'wsa-g1'), A2: join(WS, 'wsa-g2'), B: join(WS, 'wsb') }
const LEDGER = join(EVIDENCE_DIR, 'assembly-ledger.jsonl')          // row journal (host-side)
const SERVER_LEDGER = join(EVIDENCE_DIR, 'pid-ledger.raw.txt')      // fixture birth/death (raw)
const LEAK_LOG = join(EVIDENCE_DIR, 'leak-samples.jsonl')           // fd/pid samples (raw)
const INSTANCE_RAW = join(EVIDENCE_DIR, 'instance.raw.log')
const INSTANCE_LOG = join(EVIDENCE_DIR, 'instance.log')
const TOKEN = `A5LSPDR-${createHash('sha256').update(String(Math.random()) + RUN).digest('hex').slice(0, 12)}`

const REDACTIONS = [
  [/(https?:\/\/[^\s"'`]+?\?token=)([A-Za-z0-9_-]{8,})/g, (_m, head, tok) => head + `<REDACTED-${createHash('sha256').update(tok).digest('hex').slice(0, 8)}>`],
  [/\b(token|api_key|apikey|access_token)=["']?[A-Za-z0-9_\-.=]{8,}/gi, (m0) => m0.split('=')[0] + '=<REDACTED>'],
  [/dsh-auth-[A-Za-z0-9_-]{6,}/g, 'dsh-auth-<REDACTED>'],
]
const redact = (t) => REDACTIONS.reduce((x, [re, r]) => x.replace(re, r), t)

const CRITERIA = []
const check = (id, claim, cond, observed) => {
  CRITERIA.push({ id, claim, pass: cond === true, observed })
  console.log(`${cond === true ? 'PASS' : 'FAIL'} ${id} — ${claim}${observed === undefined ? '' : ` [${observed}]`}`)
}
const die = (msg) => { throw new Error(`FATAL: ${msg}`) }

const portFree = (port) => new Promise((res) => { const s = createServer(); s.once('error', () => res(false)); s.once('listening', () => s.close(() => res(true))); s.listen(port, '127.0.0.1') })
const gitAt = (dir, ...a) => spawnSync('git', ['-C', dir, ...a], { encoding: 'utf8' }).stdout.trim()
const stableProbe = async () => { try { const r = await fetch('http://127.0.0.1:3080/', { redirect: 'manual', signal: AbortSignal.timeout(5000) }); return r.status } catch { return 'unreachable' } }
const pidAlive = (pid) => { try { process.kill(pid, 0); return true } catch { return false } }
const slug = (v) => String(v ?? '').replace(/[^A-Za-z0-9._-]/g, '_').slice(0, 80)
const canon = (p) => { try { return realpathSync(p) } catch { return p } }

// ── OS observation (runner side) ────────────────────────────────────────────
const procCmd = (pid) => { try { return readFileSync(`/proc/${pid}/cmdline`, 'utf8').split('\0').filter(Boolean).join(' ').slice(0, 240) } catch { return '' } }
const procState = (pid) => { try { const s = readFileSync(`/proc/${pid}/stat`, 'utf8'); return s.slice(s.lastIndexOf(')') + 2).split(' ')[0] } catch { return null } }
import * as fsLazy from 'node:fs'
const procCwd = (pid) => { try { return Number.isFinite(pid) ? fsLazy.readlinkSync(`/proc/${pid}/cwd`) : null } catch { return null } }
const fdCount = (pid) => { try { return readdirSync(`/proc/${pid}/fd`).length } catch { return null } }
const hostChildren = (hostPid) => {
  const out = []
  for (const d of readdirSync('/proc')) {
    if (!/^\d+$/.test(d)) continue
    try {
      const stat = readFileSync(`/proc/${d}/stat`, 'utf8')
      const rest = stat.slice(stat.lastIndexOf(')') + 2).split(' ')
      if (Number(rest[1]) === hostPid) out.push({ pid: Number(d), state: rest[0], cmd: procCmd(Number(d)) })
    } catch { /* raced away */ }
  }
  return out
}
/** Every live process whose cwd or any fd points at `root` (or below). */
function scanHandles(root) {
  const hits = []
  const want = canon(root)
  for (const d of readdirSync('/proc')) {
    if (!/^\d+$/.test(d)) continue
    const pid = Number(d)
    const cwd = procCwd(pid)
    if (cwd === want || (cwd !== null && cwd.startsWith(want + '/'))) hits.push({ pid, kind: 'cwd', path: cwd, cmd: procCmd(pid) })
    try {
      for (const fd of readdirSync(`/proc/${pid}/fd`)) {
        const t = fsLazy.readlinkSync(`/proc/${pid}/fd/${fd}`)
        if (t === want || t.startsWith(want + '/')) hits.push({ pid, kind: `fd:${fd}`, path: t, cmd: procCmd(pid) })
      }
    } catch { /* not ours / raced away */ }
  }
  return hits
}
const writeEvidence = (name, value) => writeFileSync(join(EVIDENCE_DIR, name), typeof value === 'string' ? value : JSON.stringify(value, null, 2) + '\n')
const scans = {}
const recordScan = (tag, root) => { const hits = scanHandles(root); scans[tag] = { root, hits }; writeEvidence(`proc-scan-${tag}.json`, scans[tag]); return hits }
const leak = (tag, hostPid) => {
  const row = { at: new Date().toISOString(), tag, hostPid, hostFdCount: fdCount(hostPid), hostChildPids: hostChildren(hostPid).map((c) => c.pid), selfFdCount: fdCount(process.pid) }
  appendFileSync(LEAK_LOG, JSON.stringify(row) + '\n')
  return row
}

let host = null
let mock = null
let stableBeforeRef = null
async function finalize(status) {
  try { host?.child?.kill() } catch { /* gone */ }
  try { await mock?.close?.() } catch { /* gone */ }
  await new Promise((r) => setTimeout(r, 400))
  try { writeFileSync(INSTANCE_LOG, redact(readFileSync(INSTANCE_RAW, 'utf8'))); rmSync(INSTANCE_RAW) } catch { /* no log */ }
  writeFileSync(join(EVIDENCE_DIR, 'criteria.json'), JSON.stringify({ run: RUN, status, criteria: CRITERIA }, null, 2) + '\n')
  if (!KEEP) { try { rmSync(HOME, { recursive: true, force: true }) } catch { /* best effort */ } }
}

const BOOT_MARKER = /dsh web: http:\/\/127\.0\.0\.1:(\d+)\/\?token=([A-Za-z0-9_-]+)/
async function waitFor(deadlineMs, fn, what) {
  const deadline = Date.now() + deadlineMs
  for (;;) {
    const v = await fn()
    if (v !== null && v !== undefined && v !== false) return v
    if (Date.now() >= deadline) die(`timeout waiting for ${what}`)
    await new Promise((r) => setTimeout(r, 250))
  }
}
async function fetchJson(url, init, timeoutMs = 240_000) {
  const res = await fetch(url, { ...(init ?? {}), signal: AbortSignal.timeout(timeoutMs) })
  const text = await res.text()
  try { return { status: res.status, body: JSON.parse(text) } } catch { return { status: res.status, body: text } }
}

const bodyOf = (rec) => (rec !== null && typeof rec === 'object' ? ('body' in rec ? (rec.body ?? null) : rec) : null)
const messagesOf = (req) => bodyOf(req)?.messages ?? []
const normText = (s) => String(s).replace(/\s+/g, ' ').trim()
const newToolResults = (req) => {
  const out = []
  for (const m of messagesOf(req)) {
    if (Array.isArray(m?.content)) for (const b of m.content) {
      if (b?.type !== 'tool_result') continue
      const c = b.content
      out.push(typeof c === 'string' ? c : Array.isArray(c) ? c.map((x) => x?.text ?? '').join('') : JSON.stringify(c ?? ''))
    }
  }
  return out.map(normText)
}
const turnText = (req) => messagesOf(req).map((m) => (typeof m?.content === 'string' ? m.content : JSON.stringify(m.content ?? ''))).join(' ')
const toolCall = (name, a) => ({ kind: 'tool-call', toolCalls: [{ id: `call-${Math.random().toString(36).slice(2, 10)}`, name, arguments: a }] })

const AUDIT_RE = /A5DR pid=(\d+) gen=(\S+) opens=(\d+) cwd=(\S+)/

async function main() {
  const stableBefore = await stableProbe()
  stableBeforeRef = stableBefore
  console.log(`stable-instance :3080 probe (pre) = ${stableBefore}`)
  if (!(await portFree(HOST_PORT))) die(`port ${HOST_PORT} busy`)
  const pinnedHead = gitAt(TESTUSE, 'rev-parse', 'HEAD')
  const porcelain0 = gitAt(TESTUSE, 'status', '--porcelain') === ''
  check('P-PIN', `host is the pinned pristine 0.2.0-rc.2 @${TEST_USE_BASELINE_SHA.slice(0, 10)} and porcelain-clean`, pinnedHead === TEST_USE_BASELINE_SHA && porcelain0, `head=${pinnedHead.slice(0, 10)} porcelain=${porcelain0} at ${TESTUSE}`)

  for (const root of Object.values(ROOTS)) { mkdirSync(root, { recursive: true }); writeFileSync(join(root, 'f.a5lspdr'), `alpha ${TOKEN}\nbeta\ngamma\n`) }
  mkdirSync(join(HOME, 'profiles', 'web'), { recursive: true })
  writeFileSync(join(HOME, 'profiles', 'web', 'cordis.patch.yml'), [
    `# a5lspdr W-LSP-DR live-assembly patch (run ${RUN}): assembly row via the public profile-patch seam; zero production-row mounts in this world.`,
    '- insert:',
    '    - id: a5lspdr-assembly',
    `      name: ${JSON.stringify(pathToFileURL(ROW_PATH).href)}`,
    '      config: {}',
    '',
  ].join('\n'))

  const MK = RUN.replace(/[^A-Za-z0-9]/g, '').toUpperCase()
  const runFile = { A0: join(ROOTS.A0, 'f.a5lspdr'), A1: join(ROOTS.A1, 'f.a5lspdr'), A2: join(ROOTS.A2, 'f.a5lspdr'), B: join(ROOTS.B, 'f.a5lspdr') }
  let reqs = 0
  mock = await startMockModel({
    port: 0,
    decide: ({ req }) => {
      reqs += 1
      if (reqs > 40) return { kind: 'text', content: `${MK}_FUSED fuse at ${reqs} requests` }
      const turn = turnText(req)
      const mkRun = turn.match(/A5DRRUN_(A0|A1|A2|B)\b/)
      if (mkRun == null) return turn.includes(`${MK}_SET`) ? { kind: 'text', content: `${MK}_SET_OK` } : { kind: 'text', content: 'a5lspdr-mock: quiet.' }
      const which = mkRun[1]
      const last = newToolResults(req).find((t) => t.includes('A5DR pid=')) ?? ''
      if (last.length > 0) return { kind: 'text', content: `A5DRDONE_${which}_${last.slice(0, 240)}` }
      return toolCall('lsp', { operation: 'hover', file_path: runFile[which], line: 1, character: 1 })
    },
  })

  const outFd = openSync(INSTANCE_RAW, 'a')
  const child = spawn(process.execPath, [HOST_BIN, 'web', '--port', String(HOST_PORT), '--no-open'], {
    cwd: TESTUSE,
    stdio: ['ignore', outFd, outFd],
    env: {
      ...process.env,
      DSH_HOME: HOME,
      DSH_CLIENT_COMMIT_HASH: CLIENT_COMMIT_HASH,
      DEEPSEEK_BASE_URL: `http://127.0.0.1:${mock.port}`,
      DEEPSEEK_API_KEY: 'a5lspdr-mock-key',
      A5LSPDR_TESTUSE: TESTUSE,
      A5LSPDR_LEDGER: LEDGER,
      A5LSPDR_SERVER: SERVER_PATH,
      A5LSPDR_SERVER_LEDGER: SERVER_LEDGER,
      A5LSPDR_RUN: RUN,
    },
  })
  host = { child }
  child.on('exit', (code, signal) => console.log(`host exited code=${String(code)} signal=${String(signal)}`))
  const boot = await waitFor(90_000, () => {
    try { const m = BOOT_MARKER.exec(readFileSync(INSTANCE_RAW, 'utf8')); return m === null ? false : m } catch { return false }
  }, 'host boot marker')
  const origin = `http://127.0.0.1:${boot[1]}`
  const cookie = (await fetch(`${origin}/?token=${boot[2]}`, { redirect: 'manual', signal: AbortSignal.timeout(30_000) })).headers.get('set-cookie')
  check('L-BOOT', `host booted on ${HOST_PORT} with the token gate live`, cookie !== null, `cookie=${cookie !== null}`)
  const health = await waitFor(30_000, async () => { const h = await fetchJson(`${origin}/__a5lspdr/health`).catch(() => null); return h?.status === 200 && h.body.applied === true ? h : false }, 'row apply')
  const hostPid = health.body.pid

  const api = (method, payload, timeoutMs = 240_000) => fetchJson(`${origin}/api/session/${method}`, {
    method: 'POST', headers: { 'content-type': 'application/json', cookie: cookie ?? '' },
    body: JSON.stringify({ type: 'client-request', rpcId: `a5lspdr-${Math.random().toString(36).slice(2, 10)}`, method: `session/${method}`, payload: { args: { request: payload } } }),
  }, timeoutMs)
  const createSession = async (cwd) => {
    const r = await api('create', { requestId: `a5lspdr-c-${Math.random().toString(36).slice(2, 10)}`, cwd }, 60_000)
    return r.body?.result?.value?.sessionId ?? r.body?.value?.sessionId ?? null
  }
  const prompt = (sessionId, text) => api('prompt', { requestId: `a5lspdr-r-${Math.random().toString(36).slice(2, 10)}`, sessionId, mode: 'queue', content: [{ type: 'text', text }] })
  const rowRoute = (path, body) => fetchJson(`${origin}${path}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }, 60_000)
  const state = () => fetchJson(`${origin}/__a5lspdr/state`)

  const newMember = async (cwd) => {
    const sessionId = await createSession(cwd)
    if (typeof sessionId !== 'string' || sessionId === '') die(`session create failed for ${cwd}`)
    await prompt(sessionId, `${MK}_SET setup turn; reply OK`)
    return { sessionId, label: slug(sessionId) }
  }
  const modelHover = async (member, tag) => {
    const res = await prompt(member.sessionId, `A5DRRUN_${tag} hover f.a5lspdr then answer DONE`)
    writeFileSync(join(EVIDENCE_DIR, `prompt-${tag}-${member.label.slice(0, 12)}.redacted.txt`), redact(typeof res.body === 'string' ? res.body : JSON.stringify(res.body ?? {})).slice(0, 200_000))
    const captured = await waitFor(120_000, async () => {
      const s = await state().catch(() => null)
      const a = s?.body?.assemblies?.[member.label]
      const audit = AUDIT_RE.exec(String(a?.lastAudit ?? ''))
      return audit != null && a?.gen === (tag === 'A0' ? 'g0' : tag === 'A1' ? 'g1' : tag === 'A2' ? 'g2' : 'b0') ? { pid: Number(audit[1]), gen: audit[2], opens: Number(audit[3]), cwd: audit[4] } : false
    }, `model-route audit capture for ${tag} on ${member.label}`)
    return captured
  }

  // ── g0: two members, distinct realms, distinct pids ─────────────────────
  const a0 = await newMember(ROOTS.A0)
  const b = await newMember(ROOTS.B)
  check('L-CREATE', 'two member sessions created through the public entry', a0.label !== '' && b.label !== '', `labels=${a0.label.slice(0, 10)}|${b.label.slice(0, 10)}`)
  const asmA0 = await rowRoute('/__a5lspdr/assemble', { sessionId: a0.sessionId, gen: 'g0', root: ROOTS.A0 })
  const asmB = await rowRoute('/__a5lspdr/assemble', { sessionId: b.sessionId, gen: 'b0', root: ROOTS.B })
  check('L-ASSEMBLE', 'both member realms assembled (isolate + public barrel remount)', asmA0.body?.ok === true && asmB.body?.ok === true, JSON.stringify([asmA0.body?.ok, asmB.body?.ok]))
  const defs = (await fetchJson(`${origin}/__a5lspdr/defs`)).body
  check('L-DEFS-DISTINCT', 'the two live realms resolve DISTINCT per-agent `lsp` definitions', defs.allDefined === true && defs.distinctDefinitions === true, JSON.stringify(defs).slice(0, 200))

  const pA0 = await modelHover(a0, 'A0')
  const pB0 = await modelHover(b, 'B')
  check('DR-G0-PIDS', 'g0: per-member resident servers DISTINCT (opens=1; /proc/<pid>/cwd == each own workspace root)',
    pA0 != null && pB0 != null && pA0.pid !== pB0.pid && pA0.opens === 1 && pB0.opens === 1 && procCwd(pA0.pid) === canon(ROOTS.A0) && procCwd(pB0.pid) === canon(ROOTS.B),
    JSON.stringify({ A: pA0, B: pB0, procCwdA: procCwd(pA0?.pid), procCwdB: procCwd(pB0?.pid) }))
  const hotA0 = await rowRoute('/__a5lspdr/hover', { label: a0.label, filePath: join(ROOTS.A0, 'f.a5lspdr'), workspaceRoot: ROOTS.A0 })
  const hotM = AUDIT_RE.exec(String(hotA0.body?.text ?? ''))
  check('DR-G0-HOTREUSE', 'g0: inside ONE realm the same pid is hot-reused (opens 1->2)', hotM != null && Number(hotM[1]) === pA0.pid && Number(hotM[3]) === 2, JSON.stringify({ first: pA0.pid, hot: hotM?.[1], opens: hotM?.[3] }))

  const scanBase = recordScan('g0-baseline-wsa-g0', ROOTS.A0)
  leak('g0-baseline', hostPid)
  const fdBase = fdCount(hostPid)
  const bootPids = [pA0.pid, pB0.pid]

  // ── policy change #1: dispose g0 realm -> zero old-root handles -> rebuild ──
  const a1 = await newMember(ROOTS.A1)
  const ch1 = await rowRoute('/__a5lspdr/policy-change', { oldLabel: a0.label, sessionId: a1.sessionId, gen: 'g1', root: ROOTS.A1 })
  check('DR-C1-DISPOSED', 'change#1: the ONE policy-change step disposed the old realm (public fiber.dispose; old server pid last served by that realm)',
    ch1.body?.ok === true && ch1.body?.old?.lastPid === pA0.pid && typeof ch1.body?.old?.disposeMs === 'number', JSON.stringify(ch1.body).slice(0, 300))
  let goneA0 = false
  try { goneA0 = await waitFor(15_000, () => (pidAlive(pA0.pid) ? false : true), 'old pid termination') === true } catch { goneA0 = false }
  const scanA0 = recordScan('c1-after-dispose-wsa-g0', ROOTS.A0)
  check('DR-C1-OLDROOT-ZERO', 'change#1: old pid gone (OS probe) AND ZERO /proc handles (cwd/fd) remain under the OLD workspace root',
    goneA0 && scanA0.length === 0, JSON.stringify({ goneA0, hits: scanA0, baselineHitCount: scanBase.length }))
  const pA1 = await modelHover(a1, 'A1')
  check('DR-C1-NEWPID', 'change#1: rebuilt realm (NEW isolate) serves the REAL model route with a NEW distinct pid, opens=1, cwd == new root',
    pA1 != null && pA1.opens === 1 && ![pA0.pid, pB0.pid].includes(pA1.pid) && procCwd(pA1.pid) === canon(ROOTS.A1), JSON.stringify({ A1: pA1, procCwd: procCwd(pA1?.pid) }))
  const hotB1 = await rowRoute('/__a5lspdr/hover', { label: b.label, filePath: join(ROOTS.B, 'f.a5lspdr'), workspaceRoot: ROOTS.B })
  const hotB1M = AUDIT_RE.exec(String(hotB1.body?.text ?? ''))
  check('DR-C1-SIBLING', 'change#1: sibling realm untouched — B pid identical, still hot-serving (opens increased)', hotB1M != null && Number(hotB1M[1]) === pB0.pid && Number(hotB1M[3]) >= 2, JSON.stringify({ B: pB0.pid, after: hotB1M?.[1], opens: hotB1M?.[3] }))
  bootPids.push(pA1.pid)
  leak('c1', hostPid)

  // ── policy change #2 ────────────────────────────────────────────────────
  const a2 = await newMember(ROOTS.A2)
  const ch2 = await rowRoute('/__a5lspdr/policy-change', { oldLabel: a1.label, sessionId: a2.sessionId, gen: 'g2', root: ROOTS.A2 })
  check('DR-C2-DISPOSED', 'change#2: second consecutive policy change disposed the g1 realm',
    ch2.body?.ok === true && ch2.body?.old?.lastPid === pA1.pid, JSON.stringify(ch2.body).slice(0, 300))
  let goneA1 = false
  try { goneA1 = await waitFor(15_000, () => (pidAlive(pA1.pid) ? false : true), 'g1 pid termination') === true } catch { goneA1 = false }
  const scanA1 = recordScan('c2-after-dispose-wsa-g1', ROOTS.A1)
  check('DR-C2-OLDROOT-ZERO', 'change#2: g1 pid gone AND ZERO /proc handles remain under the g1 workspace root',
    goneA1 && scanA1.length === 0, JSON.stringify({ goneA1, hits: scanA1 }))
  const pA2 = await modelHover(a2, 'A2')
  check('DR-C2-NEWPID', 'change#2: rebuilt g2 realm serves the REAL model route with a NEW distinct pid, opens=1, cwd == new root',
    pA2 != null && pA2.opens === 1 && ![pA0.pid, pA1.pid, pB0.pid].includes(pA2.pid) && procCwd(pA2.pid) === canon(ROOTS.A2), JSON.stringify({ A2: pA2, procCwd: procCwd(pA2?.pid) }))
  const hotB2 = await rowRoute('/__a5lspdr/hover', { label: b.label, filePath: join(ROOTS.B, 'f.a5lspdr'), workspaceRoot: ROOTS.B })
  const hotB2M = AUDIT_RE.exec(String(hotB2.body?.text ?? ''))
  check('DR-C2-SIBLING', 'change#2: sibling still undisturbed after TWO consecutive member policy changes (same B pid, hot)', hotB2M != null && Number(hotB2M[1]) === pB0.pid, JSON.stringify({ B: pB0.pid, after: hotB2M?.[1] }))
  bootPids.push(pA2.pid)
  leak('c2', hostPid)

  // four lifecycle transitions ledger: journal must show exactly
  // 3 realm-assembled + 2 realm-disposed (with lastPid == the dead pids) at this point
  const jl = (await fetchJson(`${origin}/__a5lspdr/journal`)).body.rows
  const disposedRows = jl.filter((r) => r.leg === 'realm-disposed')
  const assembledRows = jl.filter((r) => r.leg === 'realm-assembled')
  const policyRows = jl.filter((r) => r.leg === 'policy-change-complete')
  writeEvidence('journal.raw.txt', jl.map((r) => JSON.stringify(r)).join('\n'))
  // total assemblies in this world = 4 (A-g0, B-b0, A-g1, A-g2); the FOUR
  // lifecycle transitions of the two changes = dispose(g0)+assemble(g1)+dispose(g1)+assemble(g2),
  // i.e. the two post-change assemblies must be exactly g1 then g2, each dispose bound to a dead pid.
  const postChangeAssembled = assembledRows.slice(2).map((r) => r.gen)
  check('DR-FOUR-LIFECYCLES', 'two consecutive changes = FOUR lifecycle transitions (dispose,create,dispose,create) journalled on the row face, each dispose bound to the pid that died above',
    disposedRows.length === 2 && assembledRows.length === 4 && policyRows.length === 2
    && JSON.stringify(postChangeAssembled) === JSON.stringify(['g1', 'g2'])
    && disposedRows[0]?.lastPid === pA0.pid && disposedRows[1]?.lastPid === pA1.pid,
    JSON.stringify({ disposed: disposedRows.map((r) => ({ gen: r.gen, lastPid: r.lastPid, ms: r.disposeMs })), assembled: assembledRows.map((r) => r.gen), postChangeAssembled, policy: policyRows.length }))

  // ── final close + leak census ───────────────────────────────────────────
  const dA2 = await rowRoute('/__a5lspdr/dispose', { label: a2.label })
  const dB = await rowRoute('/__a5lspdr/dispose', { label: b.label })
  let goneA2 = false; let goneB = false
  try { goneA2 = await waitFor(15_000, () => (pidAlive(pA2.pid) ? false : true), 'A-g2 pid termination') === true } catch { goneA2 = false }
  try { goneB = await waitFor(15_000, () => (pidAlive(pB0.pid) ? false : true), 'B pid termination') === true } catch { goneB = false }
  const allScans = {}
  let anyHandle = false
  for (const [k, root] of Object.entries(ROOTS)) { const hits = scanHandles(root); allScans[k] = { root, hits }; if (hits.length > 0) anyHandle = true }
  writeEvidence('proc-scan-final-all-roots.json', allScans)
  check('DR-FINAL-CLOSE', 'final dispose closed every member instance: both pids gone, ZERO handles under ALL four workspace roots',
    dA2.body?.ok === true && dB.body?.ok === true && goneA2 && goneB && !anyHandle,
    JSON.stringify({ goneA2, goneB, handles: Object.fromEntries(Object.entries(allScans).map(([k, v]) => [k, v.hits.length])) }))

  const ledgerRaw = (() => { try { return readFileSync(SERVER_LEDGER, 'utf8') } catch { return '' } })()
  const ledgerLines = ledgerRaw.split('\n').filter((l) => l !== '').map((l) => { try { return JSON.parse(l) } catch { return { unparsable: l.slice(0, 200) } } })
  const booted = ledgerLines.filter((l) => l.ev === 'server-boot').map((l) => l.pid)
  const exited = new Set(ledgerLines.filter((l) => l.ev === 'server-exit').map((l) => l.pid))
  const allDead = bootPids.every((pid) => !pidAlive(pid))
  const zombies = hostChildren(hostPid).filter((c) => c.state === 'Z')
  const fdFinal = fdCount(hostPid)
  leak('final', hostPid)
  check('DR-NO-FD-PID-LEAK', 'four lifecycles net-clean: every booted fixture pid dead + journalled-exited (pid ledger), no zombie children of the host, host fd count within base+24 (raw samples in leak-samples.jsonl)',
    booted.length === 4 && bootPids.every((pid) => exited.has(pid)) && allDead && zombies.length === 0 && fdBase !== null && fdFinal !== null && fdFinal <= fdBase + 24,
    JSON.stringify({ booted, exited: [...exited], allDead, zombies, fdBase, fdFinal }))

  writeEvidence('facts.json', {
    run: RUN, hostPid,
    pids: { A_g0: pA0, A_g1: pA1, A_g2: pA2, B_b0: pB0 },
    labels: { A_g0: a0.label, A_g1: a1.label, A_g2: a2.label, B: b.label },
    sessions: { A_g0: a0.sessionId, A_g1: a1.sessionId, A_g2: a2.sessionId, B: b.sessionId },
    changes: [ch1.body, ch2.body], finalDispose: [dA2.body, dB.body],
    fdBase, fdFinal,
    pidLedgerLines: ledgerLines.length,
  })
}

let exitCode = 1
main()
  .then(async () => { await finalize('GREEN') })
  .catch(async (error) => { console.error(error); await finalize('RED') })
  .finally(async () => {
    const stableAfter = await stableProbe()
    check('P-STABLE-UNTOUCHED', 'the :3080 stable dev instance was never touched (probe status equal pre/post; kit binds only port 3183)', stableAfter === stableBeforeRef, `pre=${stableBeforeRef} post=${stableAfter}`)
    const porcelainAfter = gitAt(TESTUSE, 'status', '--porcelain') === ''
    const headAfter = gitAt(TESTUSE, 'rev-parse', 'HEAD') === TEST_USE_BASELINE_SHA
    check('P-PRISTINE', 'the test-use runtime stayed pristine (porcelain empty, HEAD unmoved)', porcelainAfter && headAfter, `porcelain=${porcelainAfter} head=${headAfter}`)
    writeFileSync(join(EVIDENCE_DIR, 'criteria.json'), JSON.stringify({ run: RUN, criteria: CRITERIA }, null, 2) + '\n')
    const failing = CRITERIA.filter((c) => !c.pass).length
    exitCode = failing === 0 ? 0 : 2
    console.log(`RESULT ${failing === 0 ? 'GREEN' : 'RED'} (${CRITERIA.length - failing}/${CRITERIA.length} criteria pass) exit=${exitCode}`)
    process.exitCode = exitCode
  })
