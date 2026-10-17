#!/usr/bin/env node
/**
 * run-a5ptc2-compose.mjs — W-PTC-C2 COMPOSED-CHAIN LIVE runner (single mode).
 *
 * Boots the pinned TEST Host (0.2.0-rc.2 @ tests/paths.mjs pin, reused built
 * tree read-only, porcelain checked before AND after) on port 3184 (self-proved
 * free), DSH_HOME = `tests/homes/a5ptc2-compose-<stamp>` (deleted at teardown
 * unless --keep), mounts `a5ptc2-compose-row.mjs` through the PUBLIC profile-patch
 * seam, drives ONE real session on the scripted mock model, and books criteria
 * ONLY from what the live run observed.
 *
 * ONE chain, four legs, all observed INSIDE the same run_code execution:
 *   outer = run_code in a REAL separate OS process (host's own PTC runtime);
 *   inner = tool calls re-entering the SAME pipeline, guarded, rootCallId = outer;
 *   (a)  supported  → real confined spawn via the Lane C provider (rc 0,
 *        spill content match, per-call receipt: lease=terminated + processIdentity);
 *   (a2) deny       → SAME confined policy over a private fixture: the OS plane
 *        refuses the payload (rc!=0, EACCES, zero leak) — per-call OS denial
 *        INSIDE the PTC pipeline;
 *   (b)  net-deny   → typed IO_POLICY_UNSUPPORTED BEFORE launch, per-call spy
 *        delta EXACTLY 0, no plan/out paths created;
 *   (c)  probe_spawn→ guard-denied typed reason, body marker absent, confined-exec
 *        counter stays flat across the denied call.
 *   Plus: reserved-transport throw census (4 sides) and the disclosed test-world
 *   PTC-mode switch (pre→post public reads; no OS caliber on that switch).
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
const KEEP = args.includes('--keep')
const HERE = dirname(new URL(import.meta.url).pathname)
const WORKTREE = resolve(argValue('worktree', resolve(HERE, '..', '..', '..', '..', '..')))
const RUN_STAMP = new Date().toISOString().slice(0, 19).replace(/:/g, '-') + 'Z'
const RUN = `a5ptc2-rev-${RUN_STAMP}`
const EVIDENCE_DIR = resolve(argValue('evidence-dir', join(HERE, 'runs', `compose-${RUN_STAMP}`)))
mkdirSync(EVIDENCE_DIR, { recursive: true })

const HOST_PORT = Number(argValue('port', 3184))
const TESTUSE = resolve([
  argValue('testuse', ''),
  join(WORKTREE, 'tests', 'deepseek-harness-test-use'),
  '/srv/workspace/dsh-plugins/dsh-agent-team/.worktrees/dsh-020rc2-upgrade/tests/deepseek-harness-test-use',
].filter((p) => p !== '' && existsSync(p))[0] ?? '')
const HOST_BIN = join(TESTUSE, 'apps', 'cli', 'lib', 'bin.js')
const ROW_PATH = join(HERE, 'a5ptc2-compose-row.mjs')
const DIST = join(WORKTREE, 'packages', 'runtime', 'dist', 'packages')
const LAUNCHER = join(WORKTREE, 'packages', 'runtime', 'sandbox-provider', 'launcher', 'landlock-prelauncher.py')
const HOME = join(WORKTREE, 'tests', 'homes', RUN)
const WS = join(HOME, 'ws')
const FIXTURES = join(HOME, 'fixtures')
const SCRATCH = join(HOME, 'scratch')
const REALM = `a5ptc2-realm-${RUN_STAMP}`
const LEDGER = join(EVIDENCE_DIR, 'assembly-ledger.jsonl')
const INSTANCE_RAW = join(EVIDENCE_DIR, 'instance.raw.log')
const INSTANCE_LOG = join(EVIDENCE_DIR, 'instance.log')
const TOKEN = `A5PTC2-${createHash('sha256').update(String(Math.random()) + RUN).digest('hex').slice(0, 12)}`
const OK_CONTENT = `A5PTC2-OK-CONTROL ${RUN_STAMP}\n`
const SECRET_CONTENT = `SYNTHETIC-SECRET ${RUN_STAMP} — never meant to cross the domain\n`

const launcherSha = spawnSync('sha256sum', [LAUNCHER], { encoding: 'utf8' }).stdout.trim().split(/\s+/)[0] ?? ''

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

let host = null
let mock = null
let stableBeforeRef = null
async function finalize(status) {
  try { host?.child?.kill() } catch { /* gone */ }
  try { await mock?.close?.() } catch { /* gone */ }
  await new Promise((r) => setTimeout(r, 400))
  try { writeFileSync(INSTANCE_LOG, redact(readFileSync(INSTANCE_RAW, 'utf8'))); rmSync(INSTANCE_RAW) } catch { /* no log */ }
  writeFileSync(join(EVIDENCE_DIR, 'criteria.json'), JSON.stringify({ run: RUN, status, launcherSha, criteria: CRITERIA }, null, 2) + '\n')
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

// THE composed-chain program: every leg inside ONE run_code execution.
const PTC_PROGRAM = [
  "const pos = await tools.a5ptc2_confined_exec({ mode: 'supported', tag: 'c2pos' });",
  "const den = await tools.a5ptc2_confined_exec({ mode: 'deny', tag: 'c2deny' });",
  "const uns = await tools.a5ptc2_confined_exec({ mode: 'net-deny', tag: 'c2uns' });",
  'let probe;',
  "try { await tools.a5ptc2_probe_spawn({ tag: 'c2probe' }); probe = 'C2-PROBE-NOT-DENIED'; }",
  "catch (error) { probe = 'C2-PROBE-CAUGHT:' + String((error && error.message) || error); }",
  "const pid = (typeof process !== 'undefined' && process.pid !== undefined) ? process.pid : -1;",
  'return { pid, pos, den, uns, probe };',
].join('\n')

async function main() {
  const stableBefore = await stableProbe()
  stableBeforeRef = stableBefore
  console.log(`stable-instance :3080 probe (pre) = ${stableBefore}`)
  if (!(await portFree(HOST_PORT))) die(`port ${HOST_PORT} busy (self-probe)`)
  const pinnedHead = gitAt(TESTUSE, 'rev-parse', 'HEAD')
  const porcelain0 = gitAt(TESTUSE, 'status', '--porcelain') === ''
  check('P-PIN', `host is the pinned pristine tree @${TEST_USE_BASELINE_SHA.slice(0, 10)} and porcelain-clean`, pinnedHead === TEST_USE_BASELINE_SHA && porcelain0, `head=${pinnedHead.slice(0, 10)} porcelain=${porcelain0} at ${TESTUSE}`)
  check('P-LAUNCHER', 'the trusted pre-launcher is the TRACKED file (sha recorded)', launcherSha.length === 64 && existsSync(LAUNCHER), `sha256=${launcherSha.slice(0, 16)}… at packages/runtime/sandbox-provider/launcher/landlock-prelauncher.py`)

  mkdirSync(WS, { recursive: true })
  mkdirSync(join(FIXTURES, 'allow'), { recursive: true })
  mkdirSync(join(FIXTURES, 'private'), { recursive: true })
  writeFileSync(join(FIXTURES, 'allow', 'ok.txt'), OK_CONTENT)
  writeFileSync(join(FIXTURES, 'private', 'secret.txt'), SECRET_CONTENT)
  mkdirSync(SCRATCH, { recursive: true })
  mkdirSync(join(HOME, 'profiles', 'web'), { recursive: true })
  writeFileSync(join(HOME, 'profiles', 'web', 'cordis.patch.yml'), [
    `# a5ptc2 W-PTC-C2 composed-chain patch (run ${RUN}): compose row via the public profile-patch seam; zero production-row mounts in this world.`,
    '- insert:',
    '    - id: a5ptc2-compose-row',
    `      name: ${JSON.stringify(pathToFileURL(ROW_PATH).href)}`,
    '      config: {}',
    '',
  ].join('\n'))

  const MK = RUN.replace(/[^A-Za-z0-9]/g, '').toUpperCase()
  const mk1 = `${MK}_SET`, mk2 = `${MK}_RUN`
  const seen = []
  let reqs = 0
  mock = await startMockModel({
    port: 0,
    decide: ({ req }) => {
      reqs += 1
      if (reqs > 12) return { kind: 'text', content: `${MK}_FUSED fuse at ${reqs} requests` }
      const turn = turnText(req)
      if (!turn.includes(mk2)) return turn.includes(mk1) ? { kind: 'text', content: `${mk1}_OK` } : { kind: 'text', content: 'a5ptc2-mock: quiet.' }
      for (const t of newToolResults(req)) if (!seen.includes(t)) seen.push(t)
      if (seen.some((t) => t.includes('C2-RES') || t.includes('C2-PROBE') || t.includes('run_code run') || t.includes('error'))) {
        return { kind: 'text', content: `${MK}_DONE ${seen.join(' | ').slice(0, 2500)}` }
      }
      return toolCall('run_code', { code: PTC_PROGRAM, description: 'a5ptc2: one composed chain — confined-spawn pos + OS-deny + unsupported zero-spawn + guard-denied probe' })
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
      DEEPSEEK_API_KEY: 'a5ptc2-mock-key',
      A5PTC2_TESTUSE: TESTUSE,
      A5PTC2_DIST: DIST,
      A5PTC2_LAUNCHER: LAUNCHER,
      A5PTC2_PYTHON: 'python3',
      A5PTC2_REALM: REALM,
      A5PTC2_FIXTURES: FIXTURES,
      A5PTC2_SCRATCH: SCRATCH,
      A5PTC2_LEDGER: LEDGER,
      A5PTC2_RUN: RUN,
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
  const health = await waitFor(30_000, async () => { const h = await fetchJson(`${origin}/__a5ptc2/health`).catch(() => null); return h?.status === 200 && h.body.applied === true ? h : false }, 'row apply')
  const hostPid = health.body.pid
  check('L-BARREL', 'the sandbox-provider dist PUBLIC BARREL imported in-process (binding censused)', health.body.barrel === true, `barrel=${health.body.barrel}`)

  const api = (method, payload, timeoutMs = 240_000) => fetchJson(`${origin}/api/session/${method}`, {
    method: 'POST', headers: { 'content-type': 'application/json', cookie: cookie ?? '' },
    body: JSON.stringify({ type: 'client-request', rpcId: `a5ptc2-${Math.random().toString(36).slice(2, 10)}`, method: `session/${method}`, payload: { args: { request: payload } } }),
  }, timeoutMs)
  const createSession = async () => {
    const r = await api('create', { requestId: `a5ptc2-c-${Math.random().toString(36).slice(2, 10)}`, cwd: WS }, 60_000)
    return r.body?.result?.value?.sessionId ?? r.body?.value?.sessionId ?? null
  }
  const prompt = (sessionId, text) => api('prompt', { requestId: `a5ptc2-r-${Math.random().toString(36).slice(2, 10)}`, sessionId, mode: 'queue', content: [{ type: 'text', text }] })
  const assemble = (sessionId) => fetchJson(`${origin}/__a5ptc2/assemble`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ sessionId }) }, 30_000)

  const sessionId = await createSession()
  check('L-CREATE', 'session created through the public entry', typeof sessionId === 'string' && sessionId !== '', `sid=${String(sessionId).slice(0, 24)}`)
  await prompt(sessionId, `${mk1} setup turn; reply OK`)
  await waitFor(90_000, async () => { const r = await assemble(sessionId).catch(() => null); return r?.body?.ok === true ? r : false }, 'agent visible to the assembly route')
  await waitFor(180_000, async () => {
    const rows = ((await fetchJson(`${origin}/__a5ptc2/journal`).catch(() => null))?.body?.rows) ?? []
    if (rows.some((r) => r.leg === 'assembly-failed')) return 'failed'
    return rows.some((r) => r.leg === 'assembly-complete') ? true : false
  }, 'composed assembly legs')
  const jrows0 = (await fetchJson(`${origin}/__a5ptc2/journal`)).body.rows
  const failedRow = jrows0.find((r) => r.leg === 'assembly-failed')
  if (failedRow !== undefined) die(`assembly failed: ${failedRow.error}`)

  const promptRes = await prompt(sessionId, `${mk2} call run_code exactly once with the composed program, then answer DONE`)
  check('L-PROMPT', 'the scripted run_code turn completed', promptRes.status === 200, `status=${promptRes.status}`)
  const transcript = typeof promptRes.body === 'string' ? promptRes.body : JSON.stringify(promptRes.body ?? {})
  writeFileSync(join(EVIDENCE_DIR, 'prompt-turn-body.redacted.txt'), redact(transcript).slice(0, 200_000))

  const asm = await waitFor(120_000, async () => {
    const s = await fetchJson(`${origin}/__a5ptc2/state`).catch(() => null)
    const a0 = Object.values(s?.body?.assemblies ?? {})[0]
    return (a0?.guardRows ?? []).filter((g) => g.inner === true).length >= 4 && a0?.runResult != null ? a0 : false
  }, 'guard to witness outer + 4 inner executions and the run_code result to land')
  writeEvidence('composed-state.json', asm)
  writeEvidence('mock-decisions.json', (mock.requests ?? []).map((r, i) => ({
    seq: i + 1,
    markers: ['SET', 'RUN', 'C2-RES', 'C2-PROBE', 'tool_result'].filter((n) => JSON.stringify(r).includes(n)),
  })))

  const programSource = `${transcript}\n${asm.runResult?.text ?? ''}\n${JSON.stringify(asm.runResult ?? {})}\n${JSON.stringify(asm.toolResults ?? [])}`

  // ── assembly / policy caliber ────────────────────────────────────────────
  check('C2-HOST-RUNTIME', 'the host itself mounts a PTC runtime (the row assembles none; census)', asm.runtimeCensus?.hasPtcRuntime === true, JSON.stringify(asm.runtimeCensus ?? {}))
  check('C2-PROVIDER-PROBE', 'the Lane C provider instance probed enforced-class capability rows on THIS world (real launcher; hard realm configured; ENFORCE-CONFIRMED legs with the false-negative discriminator handled)',
    Array.isArray(asm.providerProbe) && asm.providerProbe.some((r) => r.level === 'enforced' && (r.dimension === 'content-read' || r.dimension === 'write')) && String(asm.legVerdicts?.selective ?? '') === 'ENFORCE-CONFIRMED' && String(asm.legVerdicts?.denyall ?? '') === 'ENFORCE-CONFIRMED',
    `legs=${JSON.stringify(asm.legVerdicts ?? {})} levels=${JSON.stringify((asm.providerProbe ?? []).map((r) => `${r.dimension}:${r.level}`))}`)
  const mc = asm.modeCensus ?? {}
  check('C2-MODE-SCOPED', 'PTC-mode danger-full-access = per-session test-world switch (pre→post via public sandboxPolicy.resolve; deployment default untouched); OS caliber carried ONLY by the provider plane below',
    mc.pre === 'workspace-write' && mc.post === 'danger-full-access' && mc.deploymentDefault === 'workspace-write',
    `pre=${mc.pre} post=${mc.post} default=${mc.deploymentDefault}`)

  // ── chain shape ──────────────────────────────────────────────────────────
  const guardRows = asm.guardRows ?? []
  const outer = guardRows.find((g) => g.name === 'run_code')
  const inners = guardRows.filter((g) => g.inner === true)
  const ceNames = ['a5ptc2_confined_exec', 'a5ptc2_probe_spawn']
  const innerCompose = inners.filter((g) => ceNames.includes(g.name))
  check('C2-CHAIN-OUTER-REAL', 'outer run_code executed in a REAL separate OS process (/proc sampling saw the ptc-runtime-node child during the run)',
    (asm.outerChildren ?? []).some((c) => /ptc-runtime-node/.test(String(c.cmd)) && Number(c.pid) > 0 && Number(c.pid) !== hostPid),
    `outerChildren=${JSON.stringify((asm.outerChildren ?? []).slice(0, 2))} hostPid=${hostPid}`)
  check('C2-CHAIN-INNER-GUARD', 'four INNER calls re-entered the SAME pipeline, guarded in order with the outer call as rootCallId (3 confined_exec + 1 probe_spawn)',
    outer !== undefined && innerCompose.length === 4 && innerCompose.every((g) => g.rootCallId === outer.callId) && innerCompose.every((g, i, xs) => i === 0 || g.seq > xs[i - 1].seq),
    `outer=${outer?.callId ?? '-'} seqs=${JSON.stringify(innerCompose.map((g) => `${g.seq}:${g.name}`))}`)

  // ── leg (a): positive confined spawn on the chain ────────────────────────
  const tr = asm.toolResults ?? []
  const pos = tr.find((t) => t.tag === 'c2pos') ?? {}
  check('C2-CHAIN-POS-REAL-SPAWN', '(a) supported: REAL confined spawn on the PTC inner edge — rc=0, launcher pid>0, lease=terminated, spill content match, per-call spy delta ≥1',
    pos.ok === true && pos.rc === 0 && Number(pos.pid) > 0 && pos.lease === 'terminated' && pos.stdoutMatch === true && Number(pos.spyDelta) >= 1 && Number(pos.ceDelta) === 1,
    JSON.stringify({ ok: pos.ok, rc: pos.rc, pid: pos.pid, lease: pos.lease, stdoutMatch: pos.stdoutMatch, spyDelta: pos.spyDelta, ceDelta: pos.ceDelta }))
  check('C2-CHAIN-POS-RECEIPT-FLIGHT', '(a) the per-call receipt (processIdentity pid + terminated lease) flew back through the PTC control pipe into the program result',
    /C2-RES tag=c2pos[^"]*receipt=pid:\d+:plan-/.test(`${JSON.stringify(asm.toolResults)}${asm.runResult?.text ?? ''}${transcript}`) && Number(pos.pid) > 0,
    `receipt=${pos.receiptPid ?? '-'} inRunResult=${String(asm.runResult?.text ?? '').includes('receipt=pid:')}`)

  // ── leg (a2): per-call OS denial INSIDE the chain ────────────────────────
  const den = tr.find((t) => t.tag === 'c2deny') ?? {}
  check('C2-CHAIN-DENY-OS', '(a2) deny: SAME confined policy, private fixture — the OS plane refused the payload itself on the PTC inner edge (rc!=0, EACCES, zero leak; real spawn attempted: ceDelta=1)',
    den.ok === true && Number(den.rc) !== 0 && den.stderrEACCES === true && den.secretLeaked === false && Number(den.ceDelta) === 1,
    JSON.stringify({ ok: den.ok, rc: den.rc, eacces: den.stderrEACCES, leaked: den.secretLeaked, ceDelta: den.ceDelta, stderrHead: (den.stderrHead ?? '').slice(0, 120) }))

  // ── leg (b): unsupported profile, pre-launch refusal, zero spawn ─────────
  const uns = tr.find((t) => t.tag === 'c2uns') ?? {}
  check('C2-CHAIN-UNSUPPORTED-ZEROSPAWN', '(b) net-deny: typed IO_POLICY_UNSUPPORTED BEFORE launch — per-call spy delta EXACTLY 0, confined-exec delta 0, zero plan/out paths in this call window',
    uns.ok === false && uns.code === 'IO_POLICY_UNSUPPORTED' && uns.stage === 'provider-refused' && Number(uns.spyDelta) === 0 && Number(uns.ceDelta) === 0 && Array.isArray(uns.spawnEvidencePaths) && uns.spawnEvidencePaths.length === 0,
    JSON.stringify({ ok: uns.ok, code: uns.code, stage: uns.stage, spyDelta: uns.spyDelta, ceDelta: uns.ceDelta, paths: uns.spawnEvidencePaths, message: (uns.message ?? '').slice(0, 160) }))

  // ── leg (c): guard denial — body never runs ──────────────────────────────
  const probeRow = innerCompose.find((g) => g.name === 'a5ptc2_probe_spawn') ?? {}
  const ceTotal = asm.counters?.confinedExec ?? -1
  check('C2-CHAIN-GUARD-DENY', '(c) probe_spawn: guard returned the typed deny reason; program caught it; body marker C2-PROBE-SPAWN-RAN absent EVERYWHERE (run result, tool results, transcript, ledger)',
    programSource.includes(`${RUN}-C2-GUARD-DENY`) && programSource.includes('C2-PROBE-CAUGHT') && !programSource.includes('C2-PROBE-NOT-DENIED') && !programSource.includes('C2-PROBE-SPAWN-RAN') && !JSON.stringify(jrows0).includes('C2-PROBE-SPAWN-RAN'),
    `sawDeny=${programSource.includes(`${RUN}-C2-GUARD-DENY`)} caught=${programSource.includes('C2-PROBE-CAUGHT')} markerAbsent=${!programSource.includes('C2-PROBE-SPAWN-RAN')}`)
  check('C2-CHAIN-GUARD-ZERO-SPAWN', '(c) the confined-exec counter stayed flat across the denied call: total confined-exec for the WHOLE turn = 2 (pos + deny only); guard-side ceSnapshot at the probe = 2',
    ceTotal === 2 && probeRow.ceSnapshot === 2,
    `confinedExecTotal=${ceTotal} probeCeSnapshot=${probeRow.ceSnapshot ?? '-'} byKind=${JSON.stringify(asm.counters?.byKind ?? {})}`)

  // ── A4: reserved transport, both sides ───────────────────────────────────
  const tc = asm.throwCensus ?? {}
  const sides = ['root_register', 'scope_register', 'scope_restrict_deny', 'scope_restrict_allow']
  check('C2-RESERVED-TRANSPORT-THROW', 'reserved run_code transport: register AND restrict throw reserved-name errors at both faces (双侧) — on THIS chain',
    sides.every((k) => tc[k]?.threw === true && tc[k]?.reservedName === true), JSON.stringify(tc))

  // ── world hygiene (mode-scope walk, same caliber as w-ptc-re) ────────────
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
          }
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
    note: 'the mode switch lives ONLY in this world\'s session event stream; teardown (rm HOME) removes it all; the runner writes nowhere else',
  })
  check('C2-WORLD-CONFINED', 'mode event + all state confined to this world (<HOME> session logs; teardown removes everything)', sessionLogs.length >= 1, `sessionLogs=${JSON.stringify(sessionLogs.slice(0, 2))} persistedEventFiles=${hits.length}`)
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
    const portGone = await portFree(HOST_PORT)
    check('P-PORT-RELEASED', `port ${HOST_PORT} released after teardown`, portGone, `free=${portGone}`)
    writeFileSync(join(EVIDENCE_DIR, 'criteria.json'), JSON.stringify({ run: RUN, launcherSha, criteria: CRITERIA }, null, 2) + '\n')
    const failing = CRITERIA.filter((c) => !c.pass).length
    exitCode = failing === 0 ? 0 : 2
    process.exitCode = exitCode
  })
