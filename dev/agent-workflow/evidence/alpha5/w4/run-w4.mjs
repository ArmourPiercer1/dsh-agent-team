#!/usr/bin/env node
/**
 * run-w4.mjs — Alpha.5 W4 runner: the provider factory → test-session wiring,
 * its POSITIVE control (real confined spawn), its NEGATIVE controls (typed
 * refusals with zero-spawn evidence), and the OS-revocation contrast — all on
 * the pinned Host, on port 3182 (IF-2), world `tests/homes/a5w4-<phase>-<stamp>`
 * (IF-3), host `tests/deepseek-harness-test-use` @ 639ed01539 (IF-4, read-only
 * reuse), the stable `:3080` probed READ-ONLY before and after (never touched).
 *
 * Phases (one world each):
 *   pos    POSITIVE control. The row registers the ONE restricted exec tool on
 *          the real session Agent; the mock model calls it E2E; the tool body
 *          runs the REAL Lane C provider (dist public barrel → real launcher →
 *          real Landlock → real execve /usr/bin/cat). Observed live: exit code
 *          (rc, via the public deps spy — the seam's RunOutput carries no rc,
 *          the disclosed review-LaneC 观察-1 gap), payload pid, spill files
 *          (the launcher's out/err refs under the plan dir + the provider's
 *          read-back content match), the in-domain DENIAL leg (cat of the
 *          private fixture must fail EACCES inside the domain), the live
 *          capability rows (ENFORCE grading is COMPUTED FROM THEM — presence
 *          measured at run time, never assumed), and the hard-realm gate
 *          (hardDimensions ['content-read','write'] configured on every
 *          instance ⇒ every accepted spawn passed verifyHardProfileEvidence).
 *   nega   NEGATIVE control A (关键). The same tool, three unavailable-profile
 *          classes: network deny/restricted + a forged 'unconfined' → the
 *          provider's typed IO_POLICY_UNSUPPORTED BEFORE any process exists
 *          (counting spy: ZERO launcher invocations for the call); a PTY request
 *          (unexpressible on the frozen seam) → typed IO_POLICY_UNSUPPORTED at
 *          the wiring boundary before any provider entry point; a missing-pieces
 *          instance → SANDBOX_UNAVAILABLE with zero confined-exec. Zero spawn
 *          is evidenced structurally: spy deltas, zero plans/out paths, zero
 *          exec-answer rows, fixture manifests unchanged. Refusal ORIGINALS are
 *          recorded verbatim in the ledger and the receipt.
 *   negb   NEGATIVE control B (OS 撤销对照). The SAME factory, the SAME request
 *          shape, the launcher processes OS-revoked by the committed
 *          seccomp-BPF wrapper (landlock syscalls → EACCES, kernel-enforced —
 *          proven by a direct self-test BEFORE boot): the authoritative probe
 *          measures abi-unavailable, prepare refuses SANDBOX_UNAVAILABLE, the
 *          naked-spawn arm does not exist. The contrast (same request ok in
 *          pos, typed-refused here) is the criterion. System-wide revocation
 *          (sysctl/boot/module) is out of reach in this sandbox — recorded as
 *          an environment constraint in the README, per the plan's honesty law.
 *
 * Honesty rules held by construction: criteria are computed from LIVE route
 * reads captured at observation time; a missing leg FAILS, nothing is
 * back-filled; the launch token is redacted at capture (`REDACTED-<sha8>`),
 * the raw instance log is deleted after redaction.
 *
 * EXIT: 0 all criteria pass · 2 a criterion failed · 1 fatal (env/boot).
 */
import { spawn, spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, openSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { createServer } from 'node:net'
import { dirname, join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

import { startMockModel } from '../../../../../packages/tools/harness/mock-deepseek.mjs'
import { TEST_USE_BASELINE_SHA, CLIENT_COMMIT_HASH } from '../../../../../tests/paths.mjs'

const args = process.argv.slice(2)
const argValue = (n, d) => { const i = args.indexOf(`--${n}`); return i === -1 ? d : args[i + 1] }
const PHASE = argValue('phase', 'pos')
const KEEP = args.includes('--keep')
const HERE = dirname(new URL(import.meta.url).pathname)
const WORKTREE = resolve(argValue('worktree', resolve(HERE, '..', '..', '..', '..', '..')))
const RUN_STAMP = new Date().toISOString().slice(0, 19).replace(/[:]/g, '-') + 'Z'
const EVIDENCE_DIR = resolve(argValue('evidence-dir', join(HERE, 'runs', `${PHASE}-${RUN_STAMP}`)))
mkdirSync(EVIDENCE_DIR, { recursive: true })

const HOST_PORT = Number(argValue('port', 3182)) // IF-2: W4 owns 3182
const STABLE_PORT = 3080
const TESTUSE_CANDIDATES = [
  argValue('testuse', ''),
  join(WORKTREE, 'tests', 'deepseek-harness-test-use'),
  '/srv/workspace/dsh-plugins/dsh-agent-team/.worktrees/dsh-020rc2-upgrade/tests/deepseek-harness-test-use',
].filter((p) => p !== '' && existsSync(p))
const TESTUSE = resolve(TESTUSE_CANDIDATES[0] ?? '')
const HOST_BIN = join(TESTUSE, 'apps', 'cli', 'lib', 'bin.js')
const DIST_PACKAGES = join(WORKTREE, 'packages', 'runtime', 'dist', 'packages')
const LAUNCHER = join(WORKTREE, 'packages', 'runtime', 'sandbox-provider', 'launcher', 'landlock-prelauncher.py')
const REVOKE_PY = join(HERE, 'a5w4-revoke-python.py')
const ROW_PATH = join(HERE, 'a5w4-provider-row.mjs')
const WORLD = join(WORKTREE, 'tests', 'homes', `a5w4-${PHASE}-${RUN_STAMP}`)
const HOME = WORLD
const LEDGER = join(EVIDENCE_DIR, 'assembly-ledger.jsonl')
const INSTANCE_RAW = join(EVIDENCE_DIR, 'instance.raw.log')
const REALM = `a5w4-realm-${RUN_STAMP}`
const SCRATCH = join(HOME, 'a5w4-scratch')
const FIXTURES = join(HOME, 'a5w4-fixtures')
const OK_CONTENT = `A5W4-OK-CONTROL ${RUN_STAMP}\n`
const SECRET_CONTENT = `SYNTHETIC-SECRET ${RUN_STAMP} — never meant to cross the domain\n`
const ORIGIN = `http://127.0.0.1:${HOST_PORT}`
const posReceiptArg = argValue('pos-receipt', '')

const CRITERIA = []
function check(id, claim, pass, observed) {
  CRITERIA.push({ id, claim, pass: pass === true, observed })
  console.log(`  [${pass === true ? 'x' : ' '}] ${id}: ${claim}${observed === undefined ? '' : ` — ${observed}`}`)
  return pass === true
}
const sha8 = (s) => createHash('sha256').update(String(s)).digest('hex').slice(0, 8)
const REDACT = new Map()
function redact(text) {
  let s = String(text)
  for (const secret of [TOKEN, ...REDACT.values()].filter((x) => x !== undefined && x !== '')) {
    if (s.includes(secret)) {
      const key = `REDACTED-${sha8(secret)}`
      REDACT.set(key, secret)
      s = s.split(secret).join(key)
    }
  }
  return s
}

let HOST = null
let TOKEN = ''
let MOCK = null
let WORLD_GONE = false
async function finalize(status) {
  if (MOCK !== null) { try { await MOCK.close() } catch { /* idempotent */ } }
  if (HOST !== null && HOST.exitCode === null) {
    try { process.kill(-HOST.pid, 'SIGTERM') } catch { try { HOST.kill('SIGTERM') } catch { /* gone */ } }
    const deadline = Date.now() + 5_000
    while (HOST.exitCode === null && Date.now() < deadline) await new Promise((r) => setTimeout(r, 200))
    if (HOST.exitCode === null) { try { process.kill(-HOST.pid, 'SIGKILL') } catch { try { HOST.kill('SIGKILL') } catch { /* gone */ } } }
  }
  const portFree = await isPortFree(HOST_PORT)
  if (!KEEP && existsSync(HOME)) {
    rmSync(HOME, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 })
    try { rmSync(`${HOME}.lock`, { force: true }) } catch { /* best effort */ }
    WORLD_GONE = true
  }
  writeFileSync(join(EVIDENCE_DIR, 'run-meta.json'), redact(JSON.stringify({
    phase: PHASE, status, runStamp: RUN_STAMP, world: HOME, worldKept: KEEP,
    worldGone: WORLD_GONE || KEEP === false, port: HOST_PORT, portFreeAfter: portFree,
    host: { use: TESTUSE === join(WORKTREE, 'tests', 'deepseek-harness-test-use') ? 'worktree-tree' : 'shared-built-tree(read-only)', bin: HOST_BIN },
    pinned: { sha: TEST_USE_BASELINE_SHA, client: CLIENT_COMMIT_HASH }, realm: REALM,
    posReceipt: posReceiptArg, criteria: CRITERIA,
  }, null, 2)))
}
function processAlive(pid) { try { process.kill(pid, 0); return true } catch { return false } }
async function sealHostLog() {
  await new Promise((r) => setTimeout(r, 400))
  const raw = readFileSync(INSTANCE_RAW, 'utf8')
  writeFileSync(join(EVIDENCE_DIR, 'instance.log'), redact(raw))
  rmSync(INSTANCE_RAW)
}
async function isPortFree(port) {
  return new Promise((res) => {
    const srv = createServer()
    srv.once('error', () => res(false))
    srv.listen(port, '127.0.0.1', () => { srv.close(() => res(true)) })
  })
}

// ── http (every wait <= 180 s) ──────────────────────────────────────────────
async function fetchJson(url, init, timeoutMs = 180_000) {
  const res = await fetch(url, { ...init, signal: AbortSignal.timeout(timeoutMs) }).catch((e) => ({ status: 0, error: e.message }))
  const body = res.status === 0 ? null : await res.json().catch(() => null)
  return { status: res.status, body }
}
async function probeStable() {
  const res = await fetch(`http://127.0.0.1:${STABLE_PORT}/`, { signal: AbortSignal.timeout(5_000) }).catch(() => null)
  return { port: STABLE_PORT, status: res === null ? 'unreachable' : res.status, operated: false }
}
async function authenticate(origin, token) {
  const res = await fetch(`${origin}/?token=${token}`, { redirect: 'manual', signal: AbortSignal.timeout(30_000) })
  const setCookie = res.headers.get('set-cookie')
  if (res.status !== 303 || setCookie === null) throw new Error(`authentication returned ${String(res.status)} (expected 303 + set-cookie)`)
  return setCookie.split(';', 1)[0]
}
async function apiPrompt(origin, cookie, sessionId, text) {
  return fetchJson(`${origin}/api/session/prompt`, {
    method: 'POST', headers: { 'content-type': 'application/json', cookie },
    body: JSON.stringify({
      type: 'client-request', rpcId: `w4-${Math.random().toString(36).slice(2, 12)}`, method: 'session/prompt',
      payload: { args: { request: { requestId: `w4-r-${Math.random().toString(36).slice(2, 10)}`, sessionId, mode: 'queue', content: [{ type: 'text', text }] } } },
    }),
  }, 240_000)
}
const BOOT_MARKER = /dsh web: http:\/\/127\.0\.0\.1:(\d+)\/\?token=([A-Za-z0-9_-]+)/
async function waitForLogLine(logPath, regex, timeoutMs, alive) {
  const deadline = Date.now() + timeoutMs
  for (;;) {
    let text = ''
    try { text = readFileSync(logPath, 'utf8') } catch { /* not yet */ }
    for (const line of text.split('\n')) {
      const m = regex.exec(line)
      if (m !== null) return { line, m }
    }
    if (Date.now() >= deadline) return null
    if (alive !== undefined && !alive()) return null
    await new Promise((r) => setTimeout(r, 300))
  }
}

// ── world materialization (public profile-patch seam only) ──────────────────
// The patch-file shape is the live round's MEASURED truth: a top-level YAML
// array of loader patch entries (`- insert:` rows, the row module named by a
// file URL, `config: {}`). An object-shaped file here is rejected at host boot
// ("must be a top-level YAML array of loader patch entries" — observed).
function writePatchFile(patchPath) {
  mkdirSync(dirname(patchPath), { recursive: true })
  writeFileSync(patchPath, [
    `# a5w4 W4 provider wiring (run ${RUN_STAMP}, phase ${PHASE}): the test-side provider-assembly row via the public profile-patch seam; zero production-row mounts in this world.`,
    '- insert:',
    '    - id: a5w4-provider-row',
    `      name: ${JSON.stringify(pathToFileURL(ROW_PATH).href)}`,
    '      config: {}',
    '',
  ].join('\n'))
}

// ── mock model (scripted tool chain per phase) ──────────────────────────────
const TOOL_NAME = 'a5w4_confined_exec'
const MK = `A5W4W${RUN_STAMP.replace(/[^0-9A-Za-z]/g, '')}`
const MK1 = `${MK}_SET`
const MK2 = `${MK}_RUN`
const MODES = {
  pos: ['supported', 'supported-deny', 'chan'],
  nega: ['net-deny', 'net-restricted', 'net-forged', 'pty', 'missing-pieces'],
  negb: ['revoked'],
}
if (MODES[PHASE] === undefined) { console.error(`--phase must be one of ${Object.keys(MODES).join('|')}`); process.exit(1) }
const TURN_TEXT = `${MK2} drive the confined-exec wiring modes IN ORDER: ${MODES[PHASE].join(', ')}. Call ${TOOL_NAME} with { mode, tag } once per mode; wait for each result before the next; after the LAST one answer exactly ${MK2}_DONE.`
const bodyOf = (rec) => (rec !== null && typeof rec === 'object' ? ('body' in rec ? (rec.body ?? null) : rec) : null)
const messagesOf = (rec) => bodyOf(rec)?.messages ?? []
const textOf = (m) => (typeof m?.content === 'string' ? m.content : JSON.stringify(m.content ?? ''))
const normText = (t) => String(t ?? '').replace(/\s+/g, ' ').trim()
// WIRE TRUTH (measured 2026-10-16 by the live round): tool_result blocks ride
// in USER messages (Anthropic-style), and plain role:'tool' strings exist on
// the OpenAI-style route. Collect BOTH; dedupe on normalized text.
function toolResultTexts(rec) {
  const out = []
  for (const msg of messagesOf(rec)) {
    if (msg?.role === 'tool' && typeof msg.content === 'string') { out.push(msg.content); continue }
    if (!Array.isArray(msg?.content)) continue
    for (const b of msg.content) {
      if (b?.type === 'tool_result') {
        const c = b.content
        out.push(typeof c === 'string' ? c : Array.isArray(c) ? c.map((x) => x?.text ?? '').join('') : JSON.stringify(c ?? ''))
      } else if (msg.role === 'tool' && typeof b?.text === 'string') out.push(b.text)
    }
  }
  return [...new Set(out.map(normText))].filter((t) => t !== '')
}
const a5Results = (rec) => toolResultTexts(rec).filter((t) => t.includes('A5W4-RES'))
const seenRes = new Set()
let chainReqs = 0
function decideForPhase({ req }) {
  const turnText = messagesOf(req).map(textOf).join(' ')
  if (!turnText.includes(MK2)) {
    if (turnText.includes(MK1)) return { kind: 'text', content: `${MK1}_DONE` }
    return { kind: 'text', content: 'a5w4-mock: unscripted request, completing quietly.' }
  }
  for (const t of a5Results(req)) seenRes.add(t)
  chainReqs += 1
  if (chainReqs > 15) return { kind: 'text', content: `${MK}_FUSED chain fuse: ${String(chainReqs)} scripted requests.` }
  const k = seenRes.size
  if (k < MODES[PHASE].length) {
    const next = MODES[PHASE][k]
    return { kind: 'tool-call', toolCalls: [{ id: `call-${Math.random().toString(36).slice(2, 10)}`, name: TOOL_NAME, arguments: { mode: next, tag: `${MK2}-${PHASE}-${String(k)}-${next}` } }] }
  }
  return { kind: 'text', content: `${MK2}_DONE ${String(seenRes.size)} results: ${[...seenRes].slice(-2).map((s) => s.slice(0, 160)).join(' | ')}` }
}

// ── host boot ───────────────────────────────────────────────────────────────
async function bootWorld() {
  mkdirSync(join(HOME, 'profiles', 'web'), { recursive: true })
  writePatchFile(join(HOME, 'profiles', 'web', 'cordis.patch.yml'))
  mkdirSync(SCRATCH, { recursive: true })
  mkdirSync(join(FIXTURES, 'allow'), { recursive: true })
  mkdirSync(join(FIXTURES, 'private'), { recursive: true })
  writeFileSync(join(FIXTURES, 'allow', 'ok.txt'), OK_CONTENT)
  writeFileSync(join(FIXTURES, 'private', 'secret.txt'), SECRET_CONTENT)
  const launcher = readFileSync(LAUNCHER, 'utf8')
  const launcherSha = createHash('sha256').update(launcher).digest('hex')
  const trustRoot = `sha256:${launcherSha.slice(0, 16)}#${'packages/runtime/sandbox-provider/launcher/landlock-prelauncher.py'}`
  let mockPort = 0
  for (const p of [3499, 3498, 3497, 3496, 3495, 3494, 3493, 3492, 3491]) { if (await isPortFree(p)) { mockPort = p; break } }
  if (mockPort === 0) throw new Error('no mock port free in the 349x family')
  MOCK = await startMockModel({ port: mockPort, decide: decideForPhase })
  HOST = spawn('node', [HOST_BIN, 'web', '--port', String(HOST_PORT), '--no-open'], {
    cwd: TESTUSE,
    env: {
      ...process.env,
      DSH_HOME: HOME,
      DEEPSEEK_BASE_URL: `http://127.0.0.1:${mockPort}`, DEEPSEEK_API_KEY: 'SYNTHETIC-KEY-a5w4',
      DSH_CLIENT_COMMIT_HASH: CLIENT_COMMIT_HASH,
      A5W4_DIST: DIST_PACKAGES, A5W4_LAUNCHER: LAUNCHER, A5W4_PYTHON: 'python3', A5W4_REVOKE_PY: REVOKE_PY,
      A5W4_REALM: REALM, A5W4_TRUSTROOT: trustRoot, A5W4_SCRATCH: SCRATCH, A5W4_FIXTURES: FIXTURES, A5W4_LEDGER: LEDGER,
    },
    stdio: ['ignore', openSync(INSTANCE_RAW, 'a'), openSync(INSTANCE_RAW, 'a')],
    detached: true,
  })
  const found = await waitForLogLine(INSTANCE_RAW, BOOT_MARKER, 60_000, () => HOST.exitCode === null)
  if (found === null) throw new Error('host did not boot within 60s')
  TOKEN = found.m[2]
  const cookie = await authenticate(ORIGIN, TOKEN)
  const health = await fetchJson(`${ORIGIN}/__a5w4/health`)
  return { cookie, health }
}

function pinnedProbe() {
  const head = spawnSync('git', ['-C', TESTUSE, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).stdout.trim()
  const dirty = spawnSync('git', ['-C', TESTUSE, 'status', '--porcelain'], { encoding: 'utf8' }).stdout.trim()
  const paths = spawnSync('git', ['-C', TESTUSE, 'status', '--porcelain', '--', 'packages', 'apps', 'scripts'], { encoding: 'utf8' }).stdout.trim()
  return { head, porcelain: dirty.length === 0, trackedDirty: paths.length === 0 }
}
function netstatLine(port) {
  const r = spawnSync('bash', ['-c', `(ss -tln 2>/dev/null || netstat -tln 2>/dev/null) | grep -E ':(${port})\\b' || echo "port ${port}: no listener"`], { encoding: 'utf8' })
  return String(r.stdout ?? '').trim()
}
function directAbiProbe(pythonPath) {
  const r = spawnSync(pythonPath, [LAUNCHER, '--abi-probe'], { encoding: 'utf8', timeout: 20_000 })
  return { rc: r.status, stdout: String(r.stdout ?? '').trim().slice(0, 300), stderr: String(r.stderr ?? '').slice(0, 200) }
}

const mainResults = {}
async function main() {
  console.log(`A5W4 phase=${PHASE} world=${HOME} port=${HOST_PORT} host=${TESTUSE}`)
  // ── pre-boot: pinned tree, dist barrels, launcher identity, revocation self-test, ports ──
  const pinned0 = pinnedProbe()
  check('W4-PIN', `pinned tree @${TEST_USE_BASELINE_SHA.slice(0, 10)} · porcelain 0 · HEAD==pin`,
    pinned0.head.startsWith(TEST_USE_BASELINE_SHA.slice(0, 12)) && pinned0.porcelain, `head=${pinned0.head.slice(0, 12)} porcelain=${String(pinned0.porcelain)}`)
  check('W4-DIST', 'provider factory reachable through the dist PUBLIC barrel only',
    existsSync(join(DIST_PACKAGES, 'runtime', 'sandbox-provider', 'index.js')), join(DIST_PACKAGES, 'runtime/sandbox-provider/index.js'))
  const launcherSha = createHash('sha256').update(readFileSync(LAUNCHER)).digest('hex')
  check('W4-LAUNCHER', 'trusted pre-launcher is the TRACKED source copy (disclosed: dist emit carries no .py assets)',
    existsSync(LAUNCHER), `sha256=${launcherSha.slice(0, 16)} (trustRoot names it)`)
  const bareAbi = directAbiProbe('python3')
  const revokedAbi = directAbiProbe(REVOKE_PY)
  check('W4-REVOKE-SELFTEST', 'revocation wrapper really removes the enforcement plane: bare probe finds the ABI, wrapper probe answers EACCES',
    /abi-available/.test(bareAbi.stdout) && /abi-unavailable/.test(revokedAbi.stdout) && /EACCES/.test(revokedAbi.stdout),
    `bare rc=${bareAbi.rc} ${bareAbi.stdout.slice(0, 60)} · wrapper rc=${revokedAbi.rc} ${revokedAbi.stdout.slice(0, 90)}`)
  check('W4-PORTS', `port ${HOST_PORT} free at start (IF-2 self-proof; netstat)`, await isPortFree(HOST_PORT), netstatLine(HOST_PORT))
  mainResults.bareAbi = bareAbi
  mainResults.launcherSha = launcherSha

  const stableBefore = await probeStable()
  let cookie = ''
  let health = { status: 0, body: null }
  let booted = true
  try {
    const b = await bootWorld()
    cookie = b.cookie
    health = b.health
  } catch (error) {
    booted = false
    mainResults.bootError = String(error?.message ?? error)
  }
  check('W4-BOOT', 'test instance boots, token gate returns 303, row health answers',
    booted && health?.body?.applied === true, `booted=${String(booted)} health=${JSON.stringify(health?.body ?? null).slice(0, 160)}${mainResults.bootError ? ` bootError=${mainResults.bootError}` : ''}`)
  if (!booted) {
    try { const j = readFileSync(INSTANCE_RAW, 'utf8'); writeFileSync(join(EVIDENCE_DIR, 'host-log-tail.txt'), redact(j).split('\n').slice(-60).join('\n')); rmSync(INSTANCE_RAW) } catch { /* none */ }
    const stableFailed = await probeStable()
    check('W4-STABLE', ':3080 read-only probed, untouched', stableFailed.status === stableBefore.status && stableFailed.operated === false, `after=${stableFailed.status}`)
    check('W4-ROW-ABSENT', 'no dependent leg is claimed when the row never applied (RED posture: everything downstream stays a scored FAIL, nothing back-filled)', true, 'boot failed → assembly/tool legs not attempted')
    for (const id of ['W4-AGENT', 'W4-REGISTER', 'W4-TURN', `W4-${PHASE.toUpperCase()}-CONTROLS`]) check(id, 'dependent leg', false, 'not attempted (boot failed)')
    await finalize('RED')
    console.log('\nRED — row/boot failure recorded as scored criteria (see host-log-tail.txt)')
    process.exit(2)
  }

  // ── assemble: create the REAL session via the public entry (create-then-
  //    prompt; a pre-decided sessionId does NOT create on prompt — kit-measured
  //    by the live round), resolve the Agent via the public ctx.agents seam ──
  const created = await fetchJson(`${ORIGIN}/api/session/create`, {
    method: 'POST', headers: { 'content-type': 'application/json', cookie },
    body: JSON.stringify({ type: 'client-request', rpcId: `w4-c-${Math.random().toString(36).slice(2, 12)}`, method: 'session/create', payload: { args: { request: {} } } }),
  }, 30_000)
  const sessionId = created.body?.result?.value?.sessionId ?? created.body?.value?.sessionId ?? null
  check('W4-SESSION', 'the host public session/create entry returned a real sessionId',
    created.status === 200 && typeof sessionId === 'string' && sessionId !== '', `status=${created.status} sid=${String(sessionId).slice(0, 24)}`)
  if (sessionId === null) { await sealHostLog(); await finalize('FATAL'); process.exit(1) }
  const setup = await apiPrompt(ORIGIN, cookie, sessionId, `${MK1} This is a setup turn. Do not call any tools. Reply with the single word OK.`)
  check('W4-SETUP', 'the real session ran a setup turn to a model reply (an Agent now exists behind the session)',
    setup.status === 200, `setup=${setup.status}`)
  // the Agent appears asynchronously after the setup turn; retry assemble.
  let asm = { status: 0, body: null }
  for (let i = 0; i < 24; i += 1) {
    asm = await fetchJson(`${ORIGIN}/__a5w4/assemble`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ sessionId }) }, 30_000)
    if (asm.status === 200 && asm.body?.ok === true) break
    await new Promise((r) => setTimeout(r, 500))
  }
  check('W4-AGENT', 'the row resolved the real Agent through the PUBLIC ctx.agents seam and assembled',
    asm.status === 200 && asm.body?.assembled === true, `assemble=${JSON.stringify(asm.body ?? {}).slice(0, 160)}`)
  let state0 = (await fetchJson(`${ORIGIN}/__a5w4/state`)).body ?? {}
  const label = Object.keys(state0.assemblies ?? {})[0]
  const reg = state0.assemblies?.[label]?.registration ?? null
  check('W4-REGISTER', 'the row registered exactly the ONE restricted exec tool on the live Agent scope (argv row-fixed, model picks mode only)',
    reg?.ok === true && reg?.name === 'a5w4_confined_exec', `registration=${JSON.stringify(reg)}`)

  // ── drive the scripted tool turns ──
  const prompt = await apiPrompt(ORIGIN, cookie, sessionId, TURN_TEXT)
  check('W4-PROMPT', 'turn accepted (202/200)', prompt.status === 200 || prompt.status === 202, `prompt=${prompt.status}`)
  let reply = ''
  const seen = new Set()
  const deadline = Date.now() + 240_000
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 2_000))
    // the DONE/fuse markers live in the mock's REPLY to the final request
    // (the host never re-asks after a stop), so watch the reply side too.
    for (const rec of MOCK.requests) {
      const rep = rec?.reply
      const text = typeof rep?.content === 'string' ? rep.content : Array.isArray(rep?.content) ? rep.content.join('') : ''
      if (text.includes(MK2) || text.includes(`${MK}_FUSED`)) seen.add(text.slice(0, 400))
      const msgs = messagesOf(rec)
      const last = msgs[msgs.length - 1]
      const t2 = typeof last?.content === 'string' ? last.content : Array.isArray(last?.content) ? last.content.map((p) => p?.text ?? '').join('') : ''
      if (typeof t2 === 'string' && (t2.includes(MK2) || t2.includes(`${MK}_FUSED`))) seen.add(t2.slice(0, 400))
    }
    reply = [...seen].sort((a, b) => a.length - b.length).pop() ?? reply
    if (reply.includes(`${MK2}_DONE`) || [...seen].some((t) => t.includes(`${MK}_FUSED`))) break
  }
  const fuseTripped = [...seen].some((t) => t.includes(`${MK}_FUSED`))
  check('W4-TURN', `the scripted chain ran to its DONE marker on the mock (fuse not tripped)${fuseTripped ? ' — FUSED' : ''}`,
    reply.includes(`${MK2}_DONE`) && !fuseTripped, `turn=${reply.slice(0, 200)}`)

  // ── LIVE reads: state + journal + scan (captured at observation time) ──
  const state = (await fetchJson(`${ORIGIN}/__a5w4/state`)).body ?? {}
  const journal = (await fetchJson(`${ORIGIN}/__a5w4/journal`)).body ?? { rows: [] }
  const asmState = state.assemblies?.[label] ?? {}
  const trs = asmState.toolResults ?? []
  const tr = (mode) => trs.find((r) => r.mode === mode) ?? null
  const pgrep = spawnSync('bash', ['-c', "pgrep -af 'landlock-prelauncher' | head -5 || true"], { encoding: 'utf8' })
  mainResults.pgrePrelauncher = String(pgrep.stdout ?? '').trim()

  const stableAfter = await probeStable()
  check('W4-STABLE', `:3080 read-only probed before/after, untouched`, stableBefore.status === stableAfter.status && stableAfter.operated === false,
    `before=${stableBefore.status} after=${stableAfter.status}`)

  // ── phase criteria ──
  if (PHASE === 'pos') {
    const ok = tr('supported')
    const deny = tr('supported-deny')
    check('W4-POS-SPAWN', 'positive control: REAL confined spawn — provider ok, launcher rc=0, payload pid real, lease terminated',
      ok?.ok === true && ok?.rc === 0 && (ok?.pid ?? 0) > 0 && ok?.lease === 'terminated' && ok?.ceDelta === 1,
      `ok=${String(ok?.ok)} rc=${String(ok?.rc)} pid=${String(ok?.pid)} lease=${String(ok?.lease)} spyDelta=${String(ok?.spyDelta)}(probe legs included) ceDelta=${String(ok?.ceDelta)}`)
    check('W4-POS-SPILL', 'spill observation: launcher out/err refs EXIST under the plan dir; provider read-back matches the fixture content',
      ok?.outRefExists === true && ok?.errRefExists === true && ok?.stdoutMatch === true && String(ok?.stdoutHead ?? '').includes('A5W4-OK-CONTROL'),
      `out=${String(ok?.outRefExists)} err=${String(ok?.errRefExists)} match=${String(ok?.stdoutMatch)} stdout=${String(ok?.stdoutHead ?? '').slice(0, 60)}`)
    check('W4-DOMAIN-DENY', 'OS enforcement plane ACTS on the payload: the same domain refuses the PRIVATE fixture (cat rc!=0, stderr EACCES, zero leak)',
      deny?.ok === true && (deny?.rc ?? 0) !== 0 && deny?.stderrEACCES === true && deny?.secretLeaked === false,
      `rc=${String(deny?.rc)} eacces=${String(deny?.stderrEACCES)} leaked=${String(deny?.secretLeaked)} stderr=${String(deny?.stderrHead ?? deny?.message ?? '').slice(0, 90)}`)
    check('W4-RC-SURFACE', 'exit codes observed through the public deps spy (seam RunOutput carries NO rc — disclosed 观察-1 gap)',
      ok?.rc !== null && ok?.rc !== undefined && deny?.rc !== null && deny?.rc !== undefined && (deny?.rc ?? 0) !== (ok?.rc ?? -1),
      `supported rc=${String(ok?.rc)} · supported-deny rc=${String(deny?.rc)} · launcherRc=${String(ok?.launcherRc)}/${String(deny?.launcherRc)}`)
    const main0 = asmState.instances?.main ?? {}
    const rows = Array.isArray(main0.rows) ? main0.rows : []
    const cr = rows.find((r) => r.dimension === 'content-read') ?? {}
    const wr = rows.find((r) => r.dimension === 'write') ?? {}
    const abiV = (main0.abiAnswers?.[main0.abiAnswers.length - 1]?.abiVersion ?? null)
    check('W4-ENFORCE-LIVE', 'ENFORCE grading COMPUTED FROM LIVE ROWS: content-read & write enforced (double evidence), ABI present, network honestly unsupported, enforcement legs answered clean',
      cr.level === 'enforced' && wr.level === 'enforced' && abiV !== null && abiV >= 1
      && (rows.find((r) => r.dimension === 'network-destination') ?? {}).level === 'unsupported'
      && main0.legVerdicts?.selective === 'ENFORCE-CONFIRMED' && main0.legVerdicts?.denyall === 'ENFORCE-CONFIRMED' && main0.legVerdicts?.badhandled === 'DEMO-CONFIRMED',
      `abi=v${String(abiV)} content-read=${cr.level} write=${wr.level} network=${(rows.find((r) => r.dimension === 'network-destination') ?? {}).level} legVerdicts=${JSON.stringify(main0.legVerdicts ?? {})} (badhandled DEMO = the false-ABSENT discriminator)`)
    check('W4-HARD-REALM', 'hard realm correctly configured (观察 2): hardDimensions set on every instance; accepted spawns passed verifyHardProfileEvidence against the REAL captured evidence',
      (main0.hardDimensionsConfigured ?? []).length === 2 && ok?.ok === true && typeof cr.evidence === 'string' && cr.evidence.length > 0 && cr.realmId === state.realm && typeof cr.trustRoot === 'string' && cr.trustRoot === state.trustRoot && String(cr.mechanism ?? '').includes('double evidence'),
      `hardDims=${JSON.stringify(main0.hardDimensionsConfigured)} evidence=${String(cr.evidence ?? '').slice(0, 48)} realm=${String(cr.realmId)} mechanism-names-double-evidence=${String(String(cr.mechanism ?? '').includes('double evidence'))}`)
    const chan = tr('chan')
    check('W4-CHAN-OBS', 'G-6/G-7 observation plumbing reused at the provider face: ONE legal registry move on the row’s own Definition, the row-owned control subscription saw the REAL registry deliver (provider seam itself emits no §5 events — recorded, no closure claim; G-g posture unchanged)',
      chan?.ok === true && chan?.move === 'disposed-reregistered' && (chan?.controlEventsAfter ?? 0) > (chan?.controlEventsBefore ?? -1),
      `controlEvents ${String(chan?.controlEventsBefore)}→${String(chan?.controlEventsAfter)} move=${String(chan?.move)}`)
    check('W4-POS-E2E', 'the tool calls rode the REAL dispatch path (model-driven: tool_result texts visible in the transcript the model read)',
      trs.length >= 3 && MOCK.requests.some((r) => a5Results(r).length > 0),
      `toolResults=${trs.length} transcriptToolResults=${MOCK.requests.filter((r) => a5Results(r).length > 0).length}`)
    const grade = (cr.level === 'enforced' && wr.level === 'enforced')
      ? 'ENFORCE-CONFIRMED (fixture/subprocess-grade OS_ENFORCED: rules compiled by the tracked lane launcher, real Landlock domain, real execve; realm/trust-root fixture-grade by the lane wording — not an OS-anchored identity)'
      : 'LIVE-CONFIRMED · ENFORCE not reached (rows say otherwise — recorded as measured)'
    mainResults.grade = grade
  }
  if (PHASE === 'nega') {
    const nets = ['net-deny', 'net-restricted', 'net-forged'].map((m) => [m, tr(m)])
    check('W4-NEG-NET', '负控 A network class: deny AND restricted (PoC-4b honesty) plus the forged unconfined all typed-refused IO_POLICY_UNSUPPORTED BEFORE any process — counting spy ZERO, originals recorded',
      nets.every(([, r]) => r !== null && r.ok === false && r.code === 'IO_POLICY_UNSUPPORTED' && String(r.message).length > 20 && r.spyDelta === 0 && r.ceDelta === 0 && (r.spawnEvidencePaths ?? ['x']).length === 0),
      nets.map(([m, r]) => `${m}: code=${String(r?.code)} spyDelta=${String(r?.spyDelta)} msg="${String(r?.message ?? '').slice(0, 70)}…"`).join(' | '))
    const pty = tr('pty')
    check('W4-NEG-PTY', '负控 A PTY class (unexpressible on the frozen seam): typed IO_POLICY_UNSUPPORTED at the WIRING BOUNDARY before any provider entry point (a silent capability downgrade is not representable)',
      pty !== null && pty.ok === false && pty.code === 'IO_POLICY_UNSUPPORTED' && pty.providerTouched === false && pty.stage === 'wiring-boundary-before-provider',
      `code=${String(pty?.code)} stage=${String(pty?.stage)}`)
    const miss = tr('missing-pieces')
    check('W4-NEG-MISSING', '负控 A 缺件 class: launcher absent → SANDBOX_UNAVAILABLE typed (no-fallback law) with ZERO confined-exec; existence preflight (python3 --version / test -f) recorded as precondition probes, not payload spawns',
      miss !== null && miss.ok === false && miss.code === 'SANDBOX_UNAVAILABLE' && miss.ceDelta === 0 && (miss.spawnEvidencePaths ?? ['x']).length === 0,
      `code=${String(miss?.code)} ceDelta=${String(miss?.ceDelta)} msg="${String(miss?.message ?? '').slice(0, 90)}…"`)
    const execRows = journal.rows.filter((r) => r.leg === 'exec-answer')
    const ceKinds = journal.rows.filter((r) => r.leg === 'run-spy' && r.kind === 'confined-exec')
    const scratchSpawnPaths = (state.scratchManifest ?? []).filter((p) => /(^|\/)plans\//.test(p) || /(^|\/)out\//.test(p))
    const fixturesNow = asmState.fixturesManifest ?? []
    check('W4-NEG-ZEROSPAWN', 'zero-spawn evidenced STRUCTURALLY: zero exec-answer rows, zero confined-exec spy rows, zero plans/out paths anywhere under scratch, fixture world byte-unchanged (2 seeded files)',
      execRows.length === 0 && ceKinds.length === 0 && scratchSpawnPaths.length === 0 && fixturesNow.length === 2,
      `execAnswerRows=${execRows.length} ceSpyRows=${ceKinds.length} scratchSpawnPaths=${scratchSpawnPaths.length} fixtures=${fixturesNow.length}`)
    check('W4-NEG-E2E', 'every refusal rode the REAL dispatch path into the transcript (refusal text reached the model, originals in the ledger)',
      trs.length === MODES.nega.length && MOCK.requests.some((r) => a5Results(r).some((t) => t.includes('IO_POLICY_UNSUPPORTED') || t.includes('SANDBOX_UNAVAILABLE'))),
      `toolResults=${trs.length} ledgerToolRows=${journal.rows.filter((r) => r.leg === 'tool-result').length}`)
  }
  if (PHASE === 'negb') {
    const rev = tr('revoked')
    const revInst = asmState.instances?.revoked ?? {}
    const abiAns = (revInst.abiAnswers ?? [])[ (revInst.abiAnswers ?? []).length - 1 ] ?? {}
    check('W4-NEGB-REFUSE', '负控 B OS-revoked contrast: SAME factory + SAME request shape with the enforcement plane OS-revoked (seccomp EACCES) → probe measures abi-unavailable → SANDBOX_UNAVAILABLE before spawn, zero confined-exec',
      rev !== null && rev.ok === false && rev.code === 'SANDBOX_UNAVAILABLE' && rev.ceDelta === 0 && abiAns.abiVersion === null,
      `code=${String(rev?.code)} abi=${String(abiAns.abiVersion)} eaccesInRaw=${String(abiAns.eaccesInRaw)} ceDelta=${String(rev?.ceDelta)}`)
    check('W4-NEGB-FILTER-EVIDENCE', 'the revocation is OS-enforced and observed: the ABI probe run THROUGH THE WRAPPER answered with the kernel EACCES in its raw line (not a userspace mock)',
      abiAns.eaccesInRaw === true && /EACCES/.test(String(abiAns.rawHead ?? '')),
      `raw="${String(abiAns.rawHead ?? '').slice(0, 110)}…"`)
    const revPaths = (state.scratchManifest ?? []).filter((p) => p.startsWith('revoked/'))
    const revSpawnPaths = revPaths.filter((p) => /(^|\/)plans\//.test(p) || /(^|\/)out\//.test(p))
    const fixturesNow = asmState.fixturesManifest ?? []
    check('W4-NEGB-ZEROWRITE', 'no naked spawn left any trace: zero plan/out paths for the revoked instance (only probe scratch, disclosed), fixture world byte-unchanged, zero exec-answer rows',
      revSpawnPaths.length === 0 && fixturesNow.length === 2 && journal.rows.filter((r) => r.leg === 'exec-answer').length === 0,
      `revokedProbePaths=${revPaths.length} revSpawnPaths=${revSpawnPaths.length} fixtures=${fixturesNow.length}`)
    check('W4-NEGB-CONTRAST', 'the CONTRAST is recorded: this request shape SUCCEEDED in the pos phase (real pid/rc) and is typed-refused here — the no-fallback law leaves no naked arm; system-wide (sysctl/boot) revocation is out of reach unprivileged (recorded constraint)',
      posReceiptArg !== '' && existsSync(resolve(posReceiptArg)) && rev !== null && rev.ok === false,
      `pos receipt cited: ${posReceiptArg || '(MISSING — run pos first and pass --pos-receipt)'}`)
  }

  const pinned1 = pinnedProbe()
  check('W4-PRISTINE', 'pinned tree porcelain = 0 at the end', pinned1.porcelain && pinned1.head === pinned0.head, `porcelain=${String(pinned1.porcelain)}`)
  await sealHostLog()
  const failed = CRITERIA.filter((c) => c.pass !== true)
  writeFileSync(join(EVIDENCE_DIR, 'criteria.json'), redact(JSON.stringify({ phase: PHASE, stamp: RUN_STAMP, grade: mainResults.grade ?? null, bareAbi: mainResults.bareAbi, launcherSha: mainResults.launcherSha, pgrepPrelauncher: mainResults.pgrePrelauncher, failedCount: failed.length, criteria: CRITERIA }, null, 2)))
  writeFileSync(join(EVIDENCE_DIR, 'live-state.json'), redact(JSON.stringify(state, null, 2)))
  writeFileSync(join(EVIDENCE_DIR, 'live-journal.json'), redact(JSON.stringify(journal, null, 2)))
  writeFileSync(join(EVIDENCE_DIR, 'mock-capture.json'), redact(JSON.stringify({
    requests: MOCK.requests.map((r) => ({ path: r.path, status: r.status, model: r.body?.model, toolDefs: (r.body?.tools ?? []).length })),
    transcriptTail: [...seen].slice(-4).map((s) => s.slice(0, 400)),
  }, null, 2)))
  writeFileSync(join(EVIDENCE_DIR, 'run-receipt.md'), redact([
    `# A5W4 live wiring run — phase ${PHASE} · ${RUN_STAMP}`,
    ``,
    `- host: pinned 0.2.0-rc.2 @ \`${TEST_USE_BASELINE_SHA.slice(0, 10)}\` · port ${HOST_PORT} · world \`tests/homes/${HOME.split('/').pop()}\` · realm \`${REALM}\``,
    `- pinned tree: head \`${pinned0.head.slice(0, 12)}\` porcelain=${String(pinned0.porcelain)} (before) / ${String(pinned1.porcelain)} (after)`,
    `- launcher (tracked source copy; dist carries no .py — disclosed): sha256 \`${(mainResults.launcherSha ?? '').slice(0, 16)}\``,
    `- bare ABI probe (pre-boot, this host): \`${String(mainResults.bareAbi?.stdout ?? '').slice(0, 120)}\``,
    PHASE === 'negb' ? `- pos contrast receipt: \`${posReceiptArg || '(not supplied)'}\`` : `- ENFORCE grading (from live rows): ${mainResults.grade ?? 'n/a (negative phase)'}`,
    `- residual prelauncher processes after the run: \`${mainResults.pgrePrelauncher || '(none)'}\``,
    ``,
    `- criteria: ${CRITERIA.length - failed.length}/${CRITERIA.length} pass`,
    ``,
    ...CRITERIA.map((c) => `- [${c.pass ? 'x' : ' '}] ${c.id}: ${c.claim}${c.observed ? ` — ${c.observed}` : ''}`),
    ``,
    `token: launch token redacted at capture (REDACTED-<sha8>); raw instance log deleted after redaction.`,
  ].join('\n')))
  await finalize(failed.length === 0 ? 'GREEN' : 'RED')
  console.log(`\n${failed.length === 0 ? 'GREEN' : 'RED'} — ${CRITERIA.length - failed.length}/${CRITERIA.length} · evidence ${EVIDENCE_DIR}`)
  process.exit(failed.length === 0 ? 0 : 2)
}

main().catch(async (error) => {
  console.error(String(error?.stack ?? error))
  try { const j = readFileSync(INSTANCE_RAW, 'utf8'); writeFileSync(join(EVIDENCE_DIR, 'host-log-tail.txt'), redact(j).split('\n').slice(-80).join('\n')); rmSync(INSTANCE_RAW) } catch { /* none */ }
  await finalize('FATAL')
  process.exit(1)
})
