#!/usr/bin/env node
/**
 * run-a5ptc-live.mjs — W-PTC-RE LIVE assembly runner (modes: ptc | lsp).
 *
 * Boots the pinned TEST Host (0.2.0-rc.2 @639ed01539, reused built tree, read-
 * only, porcelain checked before AND after) on the W-PTC-RE port 3184,
 * DSH_HOME = `tests/homes/a5ptc-<mode>-<stamp>` (IF-3, deleted at teardown
 * unless --keep), mounts `a5ptc-row.mjs` through the PUBLIC profile-patch seam,
 * drives REAL sessions on the scripted mock model, and books criteria ONLY from
 * what the live run observed (fixture caliber disclosed, never promoted).
 *
 * mode ptc  (pr8 M-08 "PTC 管线两腿"):
 *   one session; assembly = presentAs(ptc) + scoped witness tools + Team guard
 *   + reserved-transport throw census; the scripted turn calls run_code once;
 *   the program makes two INNER calls (echo witness + guarded probe) which must
 *   re-enter the same scheduler pipeline in order (the guard witnesses
 *   exec.parent + rootCallId per inner call) and the probe must come back
 *   typed-denied with its body never executed.
 *   Books: execution.outer_real_process, execution.inner_reentry_same_pipeline,
 *          transport_same_name_both_sides_throw.
 *
 * mode lsp  (pr8 M-09 per-Member pool leg):
 *   two sessions (two members) over the SAME workspace; per-agent
 *   isolate('lsp') realm remount of the host's OWN lsp/lsp-stdio/tool-lsp
 *   built barrels; scripted turns drive the REAL `lsp` tool route per member;
 *   the (fictional, fully auditable) server reports its own OS pid.
 *   Books: pool.per_member_pids_distinct. Corroborating facts (hot reuse,
 *   realm-scoped dispose kill, sibling untouched) are recorded; the
 *   policy-generation / server-read legs are NOT bookable here (README, 真缺腿).
 *
 * EXIT 0 all criteria pass · 2 a criterion failed · 1 fatal.
 */
import { spawn, spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { zstdDecompressSync } from 'node:zlib'
import { existsSync, mkdirSync, openSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { createServer } from 'node:net'
import { dirname, join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

import { startMockModel } from '../../../../../packages/tools/harness/mock-deepseek.mjs'
import { TEST_USE_BASELINE_SHA, CLIENT_COMMIT_HASH } from '../../../../../tests/paths.mjs'

const args = process.argv.slice(2)
const argValue = (n, d) => { const i = args.indexOf(`--${n}`); return i === -1 ? d : args[i + 1] }
const MODE = argValue('mode', 'ptc')
if (MODE !== 'ptc' && MODE !== 'lsp') { console.error('mode must be ptc|lsp'); process.exit(1) }
const KEEP = args.includes('--keep')
const HERE = dirname(new URL(import.meta.url).pathname)
const WORKTREE = resolve(argValue('worktree', resolve(HERE, '..', '..', '..', '..', '..')))
const RUN_STAMP = new Date().toISOString().slice(0, 19).replace(/:/g, '-') + 'Z'
const RUN = `a5ptc-${MODE}-${RUN_STAMP}`
const EVIDENCE_DIR = resolve(argValue('evidence-dir', join(HERE, 'runs', `${MODE}-${RUN_STAMP}`)))
mkdirSync(EVIDENCE_DIR, { recursive: true })

const HOST_PORT = Number(argValue('port', 3184))
const TESTUSE = resolve([
  argValue('testuse', ''),
  join(WORKTREE, 'tests', 'deepseek-harness-test-use'),
  '/srv/workspace/dsh-plugins/dsh-agent-team/.worktrees/dsh-020rc2-upgrade/tests/deepseek-harness-test-use',
].filter((p) => p !== '' && existsSync(p))[0] ?? '')
const HOST_BIN = join(TESTUSE, 'apps', 'cli', 'lib', 'bin.js')
const ROW_PATH = join(HERE, 'a5ptc-row.mjs')
const SERVER_PATH = join(HERE, 'fake-lang-server-a5ptc.mjs')
const HOME = join(WORKTREE, 'tests', 'homes', RUN)
const WS = join(HOME, 'ws')
const LEDGER = join(EVIDENCE_DIR, 'assembly-ledger.jsonl')
const INSTANCE_RAW = join(EVIDENCE_DIR, 'instance.raw.log')
const INSTANCE_LOG = join(EVIDENCE_DIR, 'instance.log')
const TOKEN = `A5PTC-${createHash('sha256').update(String(Math.random()) + RUN).digest('hex').slice(0, 12)}`

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

let host = null
let mock = null
let stableBeforeRef = null
async function finalize(status) {
  try { host?.child?.kill() } catch { /* gone */ }
  try { await mock?.close?.() } catch { /* gone */ }
  await new Promise((r) => setTimeout(r, 400))
  try { writeFileSync(INSTANCE_LOG, redact(readFileSync(INSTANCE_RAW, 'utf8'))); rmSync(INSTANCE_RAW) } catch { /* no log */ }
  writeFileSync(join(EVIDENCE_DIR, 'criteria.json'), JSON.stringify({ mode: MODE, run: RUN, status, criteria: CRITERIA }, null, 2) + '\n')
  if (!KEEP) { try { rmSync(HOME, { recursive: true, force: true }) } catch { /* best effort */ } }
}
const writeEvidence = (name, value) => writeFileSync(join(EVIDENCE_DIR, name), typeof value === 'string' ? value : JSON.stringify(value, null, 2) + '\n')

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
async function fetchJson(url, init, timeoutMs = 30_000) {
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

const PTC_PROGRAM = [
  "const first = await tools.a5ptc_echo({ tag: 'inner-1' });",
  'let probe;',
  "try { await tools.a5ptc_denied_probe({ tag: 'inner-2' }); probe = 'A5PTC-NOT-DENIED'; }",
  "catch (error) { probe = 'A5PTC-CAUGHT:' + String((error && error.message) || error); }",
  "const pid = (typeof process !== 'undefined' && process.pid !== undefined) ? process.pid : -1;",
  'return { pid, echo: first, probe };',
].join('\n')

async function main() {
  const stableBefore = await stableProbe()
  stableBeforeRef = stableBefore
  console.log(`stable-instance :3080 probe (pre) = ${stableBefore}`)
  if (!(await portFree(HOST_PORT))) die(`port ${HOST_PORT} busy`)
  const pinnedHead = gitAt(TESTUSE, 'rev-parse', 'HEAD')
  const porcelain0 = gitAt(TESTUSE, 'status', '--porcelain') === ''
  check('P-PIN', `host is the pinned pristine 0.2.0-rc.2 @${TEST_USE_BASELINE_SHA.slice(0, 10)} and porcelain-clean`, pinnedHead === TEST_USE_BASELINE_SHA && porcelain0, `head=${pinnedHead.slice(0, 10)} porcelain=${porcelain0} at ${TESTUSE}`)

  mkdirSync(WS, { recursive: true })
  writeFileSync(join(WS, 'a.a5ptc'), 'alpha\nbeta\ngamma\n')
  writeFileSync(join(WS, 'b.a5ptc'), `TOKEN-${TOKEN}\nsecond\n`)
  mkdirSync(join(HOME, 'profiles', 'web'), { recursive: true })
  writeFileSync(join(HOME, 'profiles', 'web', 'cordis.patch.yml'), [
    `# a5ptc W-PTC-RE live-assembly patch (run ${RUN}): assembly row via the public profile-patch seam; zero production-row mounts in this world.`,
    '- insert:',
    '    - id: a5ptc-assembly',
    `      name: ${JSON.stringify(pathToFileURL(ROW_PATH).href)}`,
    '      config: {}',
    '',
  ].join('\n'))

  const MK = RUN.replace(/[^A-Za-z0-9]/g, '').toUpperCase()
  if (MODE === 'ptc') {
    const seen = []
    const mk1 = `${MK}_SET`, mk2 = `${MK}_RUN`
    let reqs = 0
    mock = await startMockModel({
      port: 0,
      decide: ({ req }) => {
        reqs += 1
        if (reqs > 12) return { kind: 'text', content: `${MK}_FUSED fuse at ${reqs} requests` }
        const turn = turnText(req)
        if (!turn.includes(mk2)) return turn.includes(mk1) ? { kind: 'text', content: `${mk1}_OK` } : { kind: 'text', content: 'a5ptc-mock: quiet.' }
        for (const t of newToolResults(req)) if (!seen.includes(t)) seen.push(t)
        if (seen.some((t) => t.includes('A5PTC-CAUGHT') || t.includes('A5PTC-NOT-DENIED') || t.includes('run_code run') || t.includes('error'))) {
          return { kind: 'text', content: `${MK}_DONE ${seen.join(' | ').slice(0, 1200)}` }
        }
        return toolCall('run_code', { code: PTC_PROGRAM, description: 'a5ptc: two inner witness calls through the same pipeline; the probe must be guard-denied' })
      },
    })
  } else {
    let reqs = 0
    mock = await startMockModel({
      port: 0,
      log: (m) => console.log(m),
      decide: ({ req }) => {
        reqs += 1
        if (reqs > 24) return { kind: 'text', content: `${MK}_FUSED fuse at ${reqs} requests` }
        const turn = turnText(req)
        const mkRun = turn.match(/A5PTCRUN([AB])_/)
        if (mkRun == null) return turn.includes(`${MK}_SET`) ? { kind: 'text', content: `${MK}_SET_OK` } : { kind: 'text', content: 'a5ptc-mock: quiet.' }
        const member = mkRun[1]
        const results = newToolResults(req)
        const last = results.find((t) => t.includes('A5PTCAUDIT')) ?? ''
        if (last.length > 0) return { kind: 'text', content: `A5PTCDONE_${member}_${last.slice(0, 200)}` }
        const file = join(WS, member === 'A' ? 'a.a5ptc' : 'b.a5ptc')
        return toolCall('lsp', { operation: 'hover', file_path: file, line: 1, character: 1 })
      },
    })
  }

  const outFd = openSync(INSTANCE_RAW, 'a')
  const child = spawn(process.execPath, [HOST_BIN, 'web', '--port', String(HOST_PORT), '--no-open'], {
    cwd: TESTUSE,
    stdio: ['ignore', outFd, outFd],
    env: {
      ...process.env,
      DSH_HOME: HOME,
      DSH_CLIENT_COMMIT_HASH: CLIENT_COMMIT_HASH,
      DEEPSEEK_BASE_URL: `http://127.0.0.1:${mock.port}`,
      DEEPSEEK_API_KEY: 'a5ptc-mock-key',
      A5PTC_MODE: MODE,
      A5PTC_TESTUSE: TESTUSE,
      A5PTC_LEDGER: LEDGER,
      A5PTC_SERVER: SERVER_PATH,
      A5PTC_WS: WS,
      A5PTC_RUN: RUN,
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
  const health = await waitFor(30_000, async () => { const h = await fetchJson(`${origin}/__a5ptc/health`).catch(() => null); return h?.status === 200 && h.body.applied === true ? h : false }, 'row apply')
  const hostPid = health.body.pid

  const api = (method, payload, timeoutMs = 240_000) => fetchJson(`${origin}/api/session/${method}`, {
    method: 'POST', headers: { 'content-type': 'application/json', cookie: cookie ?? '' },
    body: JSON.stringify({ type: 'client-request', rpcId: `a5ptc-${Math.random().toString(36).slice(2, 10)}`, method: `session/${method}`, payload: { args: { request: payload } } }),
  }, timeoutMs)
  const createSession = async () => {
    const r = await api('create', { requestId: `a5ptc-c-${Math.random().toString(36).slice(2, 10)}`, cwd: WS }, 60_000)
    return r.body?.result?.value?.sessionId ?? r.body?.value?.sessionId ?? null
  }
  const prompt = (sessionId, text) => api('prompt', { requestId: `a5ptc-r-${Math.random().toString(36).slice(2, 10)}`, sessionId, mode: 'queue', content: [{ type: 'text', text }] })
  const assemble = (sessionId) => fetchJson(`${origin}/__a5ptc/assemble`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ sessionId }) }, 30_000)

  if (MODE === 'ptc') {
    const mk1 = `${MK}_SET`, mk2 = `${MK}_RUN`
    const sessionId = await createSession()
    check('L-CREATE', 'session created through the public entry', typeof sessionId === 'string' && sessionId !== '', `sid=${String(sessionId).slice(0, 24)}`)
    await prompt(sessionId, `${mk1} setup turn; reply OK`)
    await waitFor(90_000, async () => { const r = await assemble(sessionId).catch(() => null); return r?.body?.ok === true ? r : false }, 'agent visible to the assembly route')
    await waitFor(120_000, async () => {
      const rows = ((await fetchJson(`${origin}/__a5ptc/journal`).catch(() => null))?.body?.rows) ?? []
      if (rows.some((r) => r.leg === 'assembly-failed')) return 'failed'
      return rows.some((r) => r.leg === 'assembly-complete') ? true : false
    }, 'ptc assembly legs')
    const jrows = (await fetchJson(`${origin}/__a5ptc/journal`)).body.rows
    const failedRow = jrows.find((r) => r.leg === 'assembly-failed')
    if (failedRow !== undefined) die(`assembly failed: ${failedRow.error}`)

    const promptRes = await prompt(sessionId, `${mk2} call run_code exactly once, then answer DONE`)
    check('L-PROMPT', 'the scripted run_code turn completed', promptRes.status === 200, `status=${promptRes.status}`)
    const transcript = typeof promptRes.body === 'string' ? promptRes.body : JSON.stringify(promptRes.body ?? {})
    writeFileSync(join(EVIDENCE_DIR, 'prompt-turn-body.redacted.txt'), redact(transcript).slice(0, 200_000))

    const asm = await waitFor(90_000, async () => {
      const s = await fetchJson(`${origin}/__a5ptc/state`).catch(() => null)
      const a0 = Object.values(s?.body?.assemblies ?? {})[0]
      return (a0?.guardRows ?? []).length >= 2 && a0?.runResult != null ? a0 : false
    }, 'guard to witness outer + inner executions and the run_code result to land')
    writeEvidence('ptc-state.json', asm)
    const programSource = `${transcript}\n${asm.runResult?.text ?? ''}\n${JSON.stringify(asm.runResult ?? {})}`

    const guardRows = asm.guardRows ?? []
    const outer = guardRows.find((g) => g.name === 'run_code')
    const inners = guardRows.filter((g) => g.inner === true)
    const echo = inners.find((g) => g.name === 'a5ptc_echo')
    const probe = inners.find((g) => g.name === 'a5ptc_denied_probe')
    const pidMatch = /"pid"\s*:\s*(\d+)|pid=(\d+)/.exec(programSource)
    const childPid = pidMatch != null ? Number(pidMatch[1] ?? pidMatch[2]) : null
    const procChildren = (asm.outerChildren ?? []).filter((c) => /ptc-runtime-node/.test(String(c.cmd)) && Number(c.pid) > 0 && Number(c.pid) !== hostPid)
    const pidProgramSide = childPid !== null && childPid > 0 && childPid !== hostPid

    check('PTC-HOST-RUNTIME', 'the host itself mounts a PTC runtime (the row assembles none; census)', asm.runtimeCensus?.hasPtcRuntime === true, JSON.stringify(asm.runtimeCensus ?? {}))
    check('PTC-OUTER-REAL-PROCESS', 'outer run_code executed in a REAL separate OS process (/proc sampling saw the ptc-runtime-node bootstrap child during the run)',
      procChildren.length > 0 || pidProgramSide, `procChildren=${JSON.stringify(procChildren.slice(0, 2))} programPid=${childPid} hostPid=${hostPid}`)
    check('PTC-INNER-REENTRY-SAME-PIPELINE', 'both inner calls re-entered the SAME scheduler pipeline, guarded in order with the outer call as rootCallId',
      outer !== undefined && echo !== undefined && probe !== undefined && echo.rootCallId === outer.callId && probe.rootCallId === outer.callId && probe.seq > echo.seq && programSource.includes('A5PTC-ECHO:inner-1'),
      `outer=${outer?.callId ?? '-'} echoSeq=${echo?.seq ?? '-'} probeSeq=${probe?.seq ?? '-'} rootMatch=${echo !== undefined && probe !== undefined && outer !== undefined && echo.rootCallId === outer.callId && probe.rootCallId === outer.callId}`)
    check('PTC-GUARD-TYPED-DENIAL', 'the guarded inner call was typed-denied before its body (program saw the deny reason; body never ran)', programSource.includes(`${RUN}-GUARD-DENY`) && !programSource.includes('A5PTC-PROBE-BODY-RAN'), `sawDenyReason=${programSource.includes(`${RUN}-GUARD-DENY`)} bodyRan=${programSource.includes('A5PTC-PROBE-BODY-RAN')}`)
    const tc = asm.throwCensus ?? {}
    const sides = ['root_register', 'scope_register', 'scope_restrict_deny', 'scope_restrict_allow']
    check('PTC-RESERVED-TRANSPORT-THROW', 'reserved run_code transport: register AND restrict throw reserved-name errors at both faces (双侧)',
      sides.every((k) => tc[k]?.threw === true && tc[k]?.reservedName === true), JSON.stringify(tc))

    // mode-scope evidence (coordinator 核验单 04:24Z): the override's ONLY write
    // surface is session.append('sandbox/mode') — the session event stream, which
    // lives under THIS world ($DSH_HOME=HOME). Walk the world pre-teardown (zstd
    // aware) for the event/log; teardown (rm HOME) removes it all — no residual path.
    const hits = []
    const sessionLogs = []
    const walk = (dir) => {
      for (const e of readdirSync(dir, { withFileTypes: true })) {
        const p = join(dir, e.name)
        if (e.isDirectory()) walk(p)
        else if (e.isFile() && statSync(p).size < 20_000_000) {
          try {
            if (/session\..*\.jsonl(\.zstd)?$/.test(e.name)) {
              sessionLogs.push(p.replace(HOME, '<HOME>'))
              const txt = e.name.endsWith('.zstd') ? zstdDecompressSync(readFileSync(p)).toString('utf8') : readFileSync(p, 'utf8')
              if (txt.includes('sandbox/mode')) hits.push(p.replace(HOME, '<HOME>'))
            } else if (readFileSync(p, 'utf8').includes('sandbox/mode')) hits.push(p.replace(HOME, '<HOME>'))
          } catch { /* binary/raced/unflushed */ }
        }
      }
    }
    walk(HOME)
    writeEvidence('mode-scope-evidence.json', {
      world: RUN,
      dsh_home: '<WORKTREE>/tests/homes/' + RUN,
      world_session_logs: sessionLogs,
      sandbox_mode_event_files: hits,
      flush_note: 'event 面持久化=world 内 session 事件流（session.v4.jsonl.zstd）；host 被 runner kill 时 pending 事件可能未 flush——两种情形均无 world 外残留（本 runner 除 HOME 与证据目录外零写入路径）',
    })
    const mc = asm.modeCensus ?? {}
    check('PTC-MODE-SCOPED', 'danger-full-access = per-session fold scoped to THIS world/process (pre→post via public sandboxPolicy.resolve; deployment default untouched every fresh boot; session log confined to <HOME>)',
      mc.pre === 'workspace-write' && mc.post === 'danger-full-access' && mc.deploymentDefault === 'workspace-write' && sessionLogs.length >= 1,
      `pre=${mc.pre} post=${mc.post} default=${mc.deploymentDefault} sessionLogs=${JSON.stringify(sessionLogs.slice(0, 2))} persistedEventFiles=${hits.length}`)
    return
  }

  // ── LSP flow ─────────────────────────────────────────────────────────────
  const sessions = {}
  for (const member of ['A', 'B']) {
    const sessionId = await createSession()
    check(`L-CREATE-${member}`, `session ${member} created`, typeof sessionId === 'string' && sessionId !== '', `sid=${String(sessionId).slice(0, 24)}`)
    sessions[member] = sessionId
    await prompt(sessionId, `${MK}_SET setup turn; reply OK`)
  }
  for (const member of ['A', 'B']) {
    const r = await waitFor(90_000, async () => { const x = await assemble(sessions[member]).catch(() => null); return x?.body?.ok === true ? x : false }, `assemble ${member}`)
    void r
  }
  await waitFor(120_000, async () => {
    const rows = ((await fetchJson(`${origin}/__a5ptc/journal`).catch(() => null))?.body?.rows) ?? []
    if (rows.some((r) => r.leg === 'assembly-failed')) return 'failed'
    return rows.filter((r) => r.leg === 'assembly-complete').length >= 2 ? true : false
  }, 'both realm mounts')
  const jl = (await fetchJson(`${origin}/__a5ptc/journal`)).body.rows
  const failed = jl.find((r) => r.leg === 'assembly-failed')
  if (failed !== undefined) die(`assembly failed: ${failed.error}`)

  const defs = (await fetchJson(`${origin}/__a5ptc/defs`)).body
  writeEvidence('defs.json', defs)
  check('LSP-SCOPE-ROUTE', 'the scoped route resolves DISTINCT per-agent `lsp` definitions (scope tag survives isolate)', defs.allDefined === true && defs.distinctDefinitions === true, JSON.stringify(defs).slice(0, 220))

  const auditRe = /A5PTCAUDIT pid=(\d+) opens=(\d+)/
  const pids = {}
  for (const member of ['A', 'B']) {
    const res = await prompt(sessions[member], `A5PTCRUN${member}_ call the lsp tool: hover over the ${member === 'A' ? 'a' : 'b'}.a5ptc file, then answer DONE`)
    const body = typeof res.body === 'string' ? res.body : JSON.stringify(res.body ?? {})
    writeFileSync(join(EVIDENCE_DIR, `prompt-${member}.redacted.txt`), redact(body).slice(0, 200_000))
    const label = slug(sessions[member])
    const captured = await waitFor(120_000, async () => {
      const s = await fetchJson(`${origin}/__a5ptc/state`).catch(() => null)
      const rows = s?.body?.assemblies?.[label]?.modelRouteResults ?? []
      return rows.find((r) => auditRe.test(String(r.text ?? ''))) ?? (rows.length > 0 ? false : false)
    }, `model-route capture for member ${member}`).catch(() => null)
    const m = captured != null ? auditRe.exec(captured.text) : null
    pids[member] = m != null ? { pid: Number(m[1]), opens: Number(m[2]) } : null
    check(`LSP-MODEL-ROUTE-${member}`, `member ${member} reached a resident server via the REAL model route execute("lsp") (captured on the public around-seam face)`, m != null, JSON.stringify(pids[member] ?? { status: res.status, captured: captured ?? null }))
  }
  check('LSP-PER-MEMBER-PIDS-DISTINCT', 'per-Member resident pids are DISTINCT for the SAME workspaceRoot (pool privacy per realm; fixture-server caliber disclosed)',
    pids.A != null && pids.B != null && pids.A.pid > 0 && pids.B.pid > 0 && pids.A.pid !== pids.B.pid && pids.A.opens === 1 && pids.B.opens === 1,
    JSON.stringify(pids))

  const state = (await fetchJson(`${origin}/__a5ptc/state`)).body
  writeEvidence('mock-requests.summary.json', (mock.requests ?? []).map((r, i) => ({
    seq: i + 1,
    markers: ['SET', 'A5PTCRUNA_', 'A5PTCRUNB_', 'A5PTCAUDIT', 'tool_result'].filter((n) => JSON.stringify(r).includes(n)),
    toolNames: (bodyOf(r)?.messages ?? []).flatMap((m) => Array.isArray(m?.content) ? m.content.filter((b) => b?.type === 'tool_call' || b?.type === 'tool-use').map((b) => String(b?.name ?? '')) : []).filter(Boolean),
    toolResultErrors: newToolResults(r).filter((t) => /error|not found|invalid|unknown/i.test(t)).map((t) => t.slice(0, 160)),
  })))
  const labelA = slug(sessions.A)
  const labelB = slug(sessions.B)
  if (pids.A == null || pids.B == null) {
    check('LSP-DISPOSE-FACTS', 'realm-scoped dispose facts (requires both model-route pids)', false, `pids=${JSON.stringify(pids)}`)
    return
  }
  if (((state.assemblies ?? {})[labelA]) == null || ((state.assemblies ?? {})[labelB]) == null) {
    check('LSP-LABELS', 'assembly labels map to the two session agents', false, `labels=${JSON.stringify(Object.keys(state.assemblies ?? {}))}`)
    return
  }
  const hot = await fetchJson(`${origin}/__a5ptc/hover`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ label: labelA, filePath: join(WS, 'b.a5ptc') }) })
  const hotM = auditRe.exec(String(hot.body?.text ?? ''))
  check('LSP-HOT-REUSE', 'inside ONE realm the same resident pid is hot-reused (pool hot path intact)', hotM != null && Number(hotM[1]) === pids.A?.pid, `hot=${hotM?.[1] ?? '-'} first=${pids.A?.pid ?? '-'} opens=${hotM?.[2] ?? '-'}`)

  const disp = await fetchJson(`${origin}/__a5ptc/dispose`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ label: labelA }) }, 60_000)
  let goneA = false
  try { goneA = await waitFor(15_000, () => (pidAlive(pids.A.pid) ? false : true), 'A pid termination after realm dispose') === true } catch { goneA = false }
  check('LSP-REALM-DISPOSE-KILLS-OWN', 'realm dispose terminated ONLY that realm\'s resident server (A pid gone, B alive)', disp.body?.ok === true && goneA === true && pidAlive(pids.B.pid), `goneA=${goneA} BAlive=${pidAlive(pids.B.pid)} dispose=${JSON.stringify(disp.body).slice(0, 120)}`)
  const after = await fetchJson(`${origin}/__a5ptc/hover`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ label: labelB, filePath: join(WS, 'b.a5ptc') }) })
  const afterM = auditRe.exec(String(after.body?.text ?? ''))
  check('LSP-SIBLING-UNTOUCHED', 'sibling realm kept its resident pid after the other realm was disposed (cross-realm zero pid overlap)', afterM != null && Number(afterM[1]) === pids.B.pid, `after=${afterM?.[1] ?? '-'} first=${pids.B?.pid ?? '-'}`)
  writeEvidence('lsp-facts.json', { pids, hotPid: hotM?.[1] ?? null, labels: { A: labelA, B: labelB }, dispose: disp.body, after: after.body })
}

let exitCode = 1
main()
  .then(async () => { await finalize('GREEN') })
  .catch(async (error) => { console.error(error); await finalize('RED') })
  .finally(async () => {
    const stableAfter = await stableProbe()
    check('P-STABLE-UNTOUCHED', 'the :3080 stable dev instance was never touched (probe status equal pre/post; kit binds only port 3184)', stableAfter === stableBeforeRef, `pre=${stableBeforeRef} post=${stableAfter}`)
    const porcelainAfter = gitAt(TESTUSE, 'status', '--porcelain') === ''
    const headAfter = gitAt(TESTUSE, 'rev-parse', 'HEAD') === TEST_USE_BASELINE_SHA
    check('P-PRISTINE', 'the test-use runtime stayed pristine (porcelain empty, HEAD unmoved)', porcelainAfter && headAfter, `porcelain=${porcelainAfter} head=${headAfter}`)
    writeFileSync(join(EVIDENCE_DIR, 'criteria.json'), JSON.stringify({ mode: MODE, run: RUN, criteria: CRITERIA }, null, 2) + '\n')
    const failing = CRITERIA.filter((c) => !c.pass).length
    exitCode = failing === 0 ? 0 : 2
    process.exitCode = exitCode
  })
