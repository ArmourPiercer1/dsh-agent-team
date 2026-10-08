#!/usr/bin/env node
/**
 * boot.mjs — the A4-PR76 acceptance-world supervisor.
 *
 * SIMULATED / MACHINE acceptance world — NOT the human pass. The Alpha.4 human
 * acceptance remains BLOCKED/NOT_RUN (alpha4-implementation-plan.md §7.7).
 *
 * What this boots:
 *   - the PRISTINE test runtime `tests/deepseek-harness-test-use`
 *     (0.2.0-rc.2 @ 639ed01539, gitignored, never written by this script —
 *     TEST_METHODS §3.4/§3.5), entry `apps/cli/lib/bin.js web` (TEST_METHODS §2);
 *   - DSH_HOME = this repo's `tests/homes/<world>` (workspace-internal, §5);
 *   - the `dsh-agent-team` row from the MAIN CHECKOUT's committed dist on
 *     master (`packages/runtime/dist/.../plugin/host.js`) through the public
 *     cordis.patch.yml seam, plus the `p6t6-team-tools` observability row;
 *   - an in-process deterministic mock DeepSeek endpoint
 *     (`packages/tools/harness/mock-deepseek.mjs` — the repo's own harness
 *     component used by the pr-f/pr-e real-host kits). There are NO model
 *     credentials in this environment; the mock lane is what makes agent
 *     turns run at all, and everything observed through it is labeled
 *     SIMULATED.
 *
 * Red lines enforced here:
 *   - port 3180 only (3180 family per TEST_METHODS §1); never 3080;
 *   - refuses to start when 3180 is occupied by something it did not start
 *     (ownership = `<world>/.accept-host.json` marker with a live pid);
 *   - probes `GET http://127.0.0.1:3080/` BEFORE and AFTER the boot and
 *     records both readings (`<world>/accept-probe.log`) — observation only,
 *     the stable instance is never touched;
 *   - the launch line (with token) is printed to stdout and stored in
 *     `<world>/.accept-launch.json` (gitignored world, TEST_METHODS §3.6 —
 *     tokens are NEVER written into the repo tree).
 *
 * Usage:
 *   node boot.mjs                # foreground supervisor (Ctrl-C stops both)
 *   node boot.mjs --detach       # spawn a detached supervisor, print the boot
 *                                # line, exit 0; idempotent (second call with a
 *                                # live supervisor just reprints the launch line)
 *   node boot.mjs --stop         # stop the supervisor + host started here
 *   options: --port 3180 --mock-port 3491 --world <dir> --repo <dir>
 *            --model-delay-ms <n>  (mock reply latency, widens the RUNNING
 *                                window for the ACTIVE-notification leg)
 */
import { spawn } from 'node:child_process'
import {
  closeSync,
  copyFileSync,
  existsSync,
  mkdirSync,
  openSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { connect } from 'node:net'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))

// ── args ────────────────────────────────────────────────────────────────────
const argv = process.argv.slice(2)
const flag = (name) => argv.includes(name)
const opt = (name, dflt) => {
  const i = argv.indexOf(name)
  return i >= 0 && argv[i + 1] !== undefined ? argv[i + 1] : dflt
}
const REPO = opt('--repo', '/home/user/dsh-plugins/dsh-agent-team')
const WORLD_NAME = 'a4-accept-20261007T16-57-26Z'
const WORLD = opt('--world', join(REPO, 'tests', 'homes', WORLD_NAME))
const PORT = Number(opt('--port', '3180'))
const MOCK_PORT = Number(opt('--mock-port', '3491'))
const MODEL_DELAY_MS = Number(opt('--model-delay-ms', '0'))
const TEST_USE = join(REPO, 'tests', 'deepseek-harness-test-use')
const ROOT_SESSION_ID = 'session-a4-accept-boot'
const BOOT_MARKER = new RegExp(`dsh web: (http:\\/\\/127\\.0\\.0\\.1:${PORT}/\\?token=[A-Za-z0-9_-]+)`)

const HOST_JS = join(REPO, 'packages/runtime/dist/packages/runtime/src/plugin/host.js')
const GLUE_MJS = join(REPO, 'packages/runtime/dist/packages/runtime/src/plugin/live/agent-bindings.mjs')
const SEAM_MJS = join(REPO, 'packages/runtime/root-binding/harness/seam.mjs')
const P6T6_MJS = join(REPO, 'packages/tools/harness/plugin.mjs')
// The shipped CLIENT row entry: a tracked composition output (packages/client/composition-shim, among
// the 1508 files check-artifacts-at-head compares). Round 43 found this world mounting only the
// runtime row, which left the browser with no team surface at all.
const CLIENT_SHIM = join(REPO, 'packages/client/composition-shim/index.js')
const MOCK_HARNESS = join(REPO, 'packages/tools/harness/mock-deepseek.mjs')
for (const p of [HOST_JS, GLUE_MJS, SEAM_MJS, P6T6_MJS, MOCK_HARNESS]) {
  if (!existsSync(p)) fail(`missing required artifact (is the main checkout built?): ${p}`)
}
if (!existsSync(join(TEST_USE, 'apps/cli/lib/bin.js'))) fail(`missing test runtime entry: ${TEST_USE}/apps/cli/lib/bin.js`)

const MARKER = join(WORLD, '.accept-host.json')
const LAUNCH = join(WORLD, '.accept-launch.json')
const PROBE = join(WORLD, 'accept-probe.log')
const TEMPLATE = join(HERE, 'world-template')

function log(msg) {
  process.stdout.write(`[a4-boot ${new Date().toISOString()}] ${msg}\n`)
}
function fail(msg) {
  process.stderr.write(`[a4-boot FAIL] ${msg}\n`)
  process.exit(1)
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
function pidAlive(pid) {
  try {
    process.kill(pid, 0)
    return true
  } catch {
    return false
  }
}
function portInUse(port) {
  return new Promise((resolve) => {
    const s = connect({ host: '127.0.0.1', port }, () => {
      s.destroy()
      resolve(true)
    })
    s.on('error', () => resolve(false))
    s.setTimeout(1500, () => {
      s.destroy()
      resolve(false)
    })
  })
}
/** Stable-instance red-line probe (:3080): read-only GET, refusal recorded as data. */
async function stableProbe(label) {
  let rec
  try {
    const res = await fetch('http://127.0.0.1:3080/', { signal: AbortSignal.timeout(10_000), redirect: 'manual' })
    const text = await res.text().catch(() => '')
    rec = { at: new Date().toISOString(), label, status: res.status, length: text.length }
  } catch (e) {
    rec = { at: new Date().toISOString(), label, status: 0, error: String(e?.message ?? e) }
  }
  appendFileSyncSafe(PROBE, `${JSON.stringify(rec)}\n`)
  log(`stable :3080 probe (${label}): status=${rec.status ?? rec.error}`)
  return rec
}
function appendFileSyncSafe(path, data) {
  try {
    mkdirSync(dirname(path), { recursive: true })
    writeFileSync(path, data, { flag: 'a' })
  } catch { /* probes must never break the boot */ }
}

// ── --stop ──────────────────────────────────────────────────────────────────
if (flag('--stop')) {
  if (!existsSync(MARKER)) {
    log(`no supervisor marker at ${MARKER} — nothing started by this world is recorded; NO kill performed`)
    process.exit(0)
  }
  const marker = JSON.parse(readFileSync(MARKER, 'utf8'))
  const targets = [marker.supervisorPid, marker.hostPid].filter((p) => Number.isInteger(p))
  for (const pid of targets) {
    if (!pidAlive(pid)) {
      log(`pid ${pid} not alive`)
      continue
    }
    try {
      process.kill(pid, 'SIGTERM')
      log(`SIGTERM -> ${pid}`)
    } catch (e) {
      log(`kill ${pid} failed: ${String(e?.message ?? e)}`)
    }
  }
  await sleep(2000)
  for (const pid of targets) if (pidAlive(pid)) { try { process.kill(pid, 'SIGKILL'); log(`SIGKILL -> ${pid}`) } catch { /* gone */ } }
  rmSync(MARKER, { force: true })
  log('stopped (marker removed)')
  process.exit(0)
}

// ── idempotence / port ownership guard ─────────────────────────────────────
const markerLive =
  existsSync(MARKER) && pidAlive(JSON.parse(readFileSync(MARKER, 'utf8'))?.supervisorPid ?? -1)
const busy = await portInUse(PORT)
if (busy && markerLive) {
  const launch = existsSync(LAUNCH) ? JSON.parse(readFileSync(LAUNCH, 'utf8')) : null
  log(`already running (supervisor pid ${JSON.parse(readFileSync(MARKER, 'utf8')).supervisorPid}) — reprinting launch line; NOTHING re-started`)
  if (launch?.bootLine !== undefined) process.stdout.write(launch.bootLine + '\n')
  process.exit(0)
}
if (busy && !markerLive) {
  fail(`port ${PORT} is occupied and NOT by a host this world started (no live marker at ${MARKER}) — refusing to run (TEST_METHODS §3.2: never touch a foreign instance). Free the port or pass another with --port (3180 family).`)
}
if (!busy && markerLive) {
  // stale supervisor (supervisor alive but host gone?) — clean marker, continue fresh boot
  log('marker alive but port free — previous host exited; removing stale marker')
  rmSync(MARKER, { force: true })
}

// ── materialize the world (idempotent; durable state is never removed) ────
for (const dir of [
  join(WORLD, 'profiles/web'),
  join(WORLD, 'blueprints'),
  join(WORLD, 'workspace/grants'),
  join(WORLD, 'logs'),
]) {
  mkdirSync(dir, { recursive: true })
}
for (const rel of ['profiles/web/package.json', 'profiles/web/cordis.yml', 'profiles/web/pnpm-workspace.yaml']) {
  copyFileSync(join(TEMPLATE, rel), join(WORLD, rel))
}
// Row ANCHOR = the team Blueprint itself (pr-f/pr-e kit pattern; measured
// 2026-10-07: team.create must name the blueprint the bound TeamSession
// carries — a different anchor fails TEAM_REMOTE_TEAM_CREATE_BLUEPRINT_MISMATCH).
// a4.accept.anchor stays in blueprintDir as a second catalog entry.
const anchorSource = readFileSync(join(TEMPLATE, 'blueprints/a4-accept-team.yaml'), 'utf8')
copyFileSync(join(TEMPLATE, 'blueprints/a4-accept-team.yaml'), join(WORLD, 'blueprints/a4-accept-team.yaml'))
copyFileSync(join(TEMPLATE, 'blueprints/a4-accept-anchor.yaml'), join(WORLD, 'blueprints/a4-accept-anchor.yaml'))
// The patch: config shape derived from packages/runtime/src/plugin/types.ts
// TeamPluginConfig + validateTeamPluginConfig (host.ts:596) — the CURRENT
// field set; the Alpha.4 permission envelopes live in the BOUND v3 BLUEPRINT
// (domain validate.ts:1335-1337), NOT in the row config (measured: no
// envelope field exists in TeamPluginConfig).
const firstEver = !existsSync(join(WORLD, 'storages'))
writeFileSync(join(WORLD, 'p6t6-directive.json'), JSON.stringify({
  boot: firstEver ? 1 : 2,
  phase: firstEver ? 'create' : 'resume',
  reportDir: join(WORLD, 'logs'),
  runStamp: WORLD_NAME,
  rootSessionId: ROOT_SESSION_ID,
}, null, 2) + '\n')
const fileUrl = (p) => `file://${p}`
writeFileSync(join(WORLD, 'profiles/web/cordis.patch.yml'), [
  '# A4-PR76 acceptance world — SIMULATED / MACHINE acceptance — NOT the human pass.',
  '# Idempotently regenerated by boot.mjs (same evidence dir); edit the template there, not this file.',
  '# The row loads the MAIN CHECKOUT committed dist on master (never a worktree dist):',
  `#   ${fileUrl(HOST_JS)}`,
  '- insert:',
  '    - id: "dsh-agent-team"',
  `      name: "${fileUrl(HOST_JS)}"`,
  '      config:',
  `        rootSessionId: "${ROOT_SESSION_ID}"`,
  '        bootPhase: "create-or-open"',
  `        blueprintSource: ${JSON.stringify(anchorSource)}`,
  `        blueprintDir: "${join(WORLD, 'blueprints')}"`,
  `        defaultWorkspace: "${join(WORLD, 'workspace')}"`,
  '        seedMembers: []',
  '        generation: 1',
  '        staticModel:',
  '          provider: "deepseek-official"',
  '          model: "a4-accept-mock-model"',
  '        deniedSelection: null',
  '        mcpServers: []',
  '        mcpServer: null',
  '        environmentFacts: []',
  '        externalPolicyFacts:',
  '          hard: {}',
  '          capabilityExists: {}',
  `        glueUrl: "${fileUrl(GLUE_MJS)}"`,
  `        seamUrl: "${fileUrl(SEAM_MJS)}"`,
  '    - id: "p6t6-team-tools"',
  `      name: "${fileUrl(P6T6_MJS)}"`,
  '# The CLIENT half of the install surface. TeamView and TeamLedger — including the live Allow/Deny',
  '# affordance a human needs for §7.7 steps 3/4/5 — live in packages/client, and without this row the',
  '# browser renders only the host shell: no team entry in the sidebar footer, no ledger, nothing to',
  '# click (evidence/a4-pr76-acceptance-world/GUI-20261008-R43.md). Mounted by file URL, the same',
  '# tradeoff the host row already makes, from the tracked composition shim rather than a worktree.',
  '- insert:',
  '    - id: "dsh-agent-team-client"',
  `      name: "${fileUrl(CLIENT_SHIM)}"`,
  '',
].join('\n'))
if (!existsSync(CLIENT_SHIM)) {
  log(`WARNING client row UNAVAILABLE: ${CLIENT_SHIM} is absent (run pnpm build:composition). ` +
    `The host will boot, but no team surface exists in the browser, so the GUI team legs are ungradeable here.`)
}
log(`world materialized at ${WORLD} (profiles, blueprints, p6t6 directive, workspace/grants)`)

// ── detached supervision mode: relaunch self with --supervise ──────────────
if (flag('--detach') && !flag('--supervise')) {
  const out = openSync(join(WORLD, 'logs', 'supervisor.log'), 'a')
  const child = spawn(process.execPath, [
    fileURLToPath(import.meta.url), '--supervise', '--port', String(PORT), '--mock-port', String(MOCK_PORT),
    '--model-delay-ms', String(MODEL_DELAY_MS), '--world', WORLD, '--repo', REPO,
  ], { detached: true, stdio: ['ignore', out, out], cwd: HERE })
  child.unref()
  closeSync(out)
  log(`detached supervisor spawned pid=${child.pid}; waiting for its boot line in ${join(WORLD, 'logs', 'supervisor.log')}`)
  const deadline = Date.now() + 300_000
  let bootLine = null
  while (Date.now() < deadline) {
    await sleep(500)
    if (existsSync(LAUNCH)) {
      const info = JSON.parse(readFileSync(LAUNCH, 'utf8'))
      if (info.port === PORT && typeof info.bootLine === 'string') {
        bootLine = info.bootLine
        break
      }
    }
    if (!pidAlive(child.pid)) break
  }
  if (bootLine === null) {
    fail(`supervisor did not report a boot line within 300s — see ${join(WORLD, 'logs', 'supervisor.log')}`)
  }
  process.stdout.write(bootLine + '\n')
  log('launch line above; supervisor keeps the host + mock model running. Stop with: node boot.mjs --stop')
  process.exit(0)
}

// ── (supervise) or foreground: stable probe BEFORE ─────────────────────────
await stableProbe('before-boot')

// ── start the mock DeepSeek lane (in-process for the supervisor) ───────────
const { startMockModel } = await import(fileUrl(MOCK_HARNESS))
const mockReqLog = join(WORLD, 'logs', 'mock-requests.jsonl')
const mockLog = join(WORLD, 'logs', 'mock.log')
const MOCK = await startMockModel({
  port: MOCK_PORT,
  log: (msg) => {
    try {
      writeFileSync(mockLog, `${new Date().toISOString()} ${msg}\n`, { flag: 'a' })
    } catch { /* ignore */ }
  },
  decide: async ({ seq, req }) => {
    try {
      writeFileSync(mockReqLog, JSON.stringify({
        seq,
        at: new Date().toISOString(),
        model: req?.model,
        nMessages: Array.isArray(req?.messages) ? req.messages.length : 0,
      }) + '\n', { flag: 'a' })
      // FULL raw envelope per request, world-local ONLY (never committed —
      // the world dir is gitignored and raw bodies carry absolute paths).
      // The driver's receipts cite matched EXCERPTS (e.g. the injected
      // `[team-perm-changed …]` line), never whole bodies.
      const raw = typeof req === 'string' ? req : JSON.stringify(req ?? null)
      writeFileSync(join(WORLD, 'logs', `mock-req-${String(seq).padStart(5, '0')}.json`), raw.slice(0, 4_000_000))
    } catch { /* ignore */ }
    if (MODEL_DELAY_MS > 0) await sleep(MODEL_DELAY_MS)
    return { kind: 'text', content: 'a4-accept mock: turn acknowledged (SIMULATED model lane).' }
  },
})
log(`mock DeepSeek endpoint up at 127.0.0.1:${MOCK.port} (delay ${MODEL_DELAY_MS}ms)`)

// ── spawn the host (TEST_METHODS §2 chain) ─────────────────────────────────
const stamp = new Date().toISOString().replace(/[:.]/g, '-')
const hostLogPath = join(WORLD, 'logs', `host-${stamp}.log`)
const fd = openSync(hostLogPath, 'a')
// DSH_CLIENT_COMMIT_HASH: the deterministic build pin, taken from tests/paths.mjs (single source).
const { CLIENT_COMMIT_HASH } = await import(fileUrl(join(REPO, 'tests/paths.mjs')))
// Environment hygiene (measured 2026-10-07: an agent-session shell inherits
// DSH_WEB_URL/DSH_SESSION_ID/DSH_PROFILE_DIR/DSH_SHELL from the harness —
// DSH_PROFILE_DIR pointed at the STABLE :3080 instance's home profile tree.
// The web entry still composed from DSH_HOME/profiles (verified: the stable
// patch has no dsh-agent-team row while the boot served it), but inheriting
// session identity/URLs is red-line noise. Strip every DSH_* and pin all
// HOME/XDG/npm-cache writes INSIDE the world, so the boot cannot write
// outside DSH_HOME even structurally (survives the workspace-write sandbox
// tightening; TEST_METHODS §5).
const sanitizeEnv = () => {
  const env = {}
  for (const [k, v] of Object.entries(process.env)) {
    if (k === 'DSH_HOME' || k === 'DSH_CLIENT_COMMIT_HASH' || k.startsWith('DSH_') || k === 'HOME'
      || (k.startsWith('XDG_') && k !== 'XDG_RUNTIME_DIR') || k === 'NPM_CONFIG_CACHE') continue
    env[k] = v
  }
  return env
}
for (const dir of [join(WORLD, '.tmp-home'), join(WORLD, '.tmp-xdg', 'data'), join(WORLD, '.tmp-xdg', 'config'), join(WORLD, '.tmp-xdg', 'cache'), join(WORLD, '.tmp-npm-cache')]) {
  mkdirSync(dir, { recursive: true })
}
const host = spawn(process.execPath, ['apps/cli/lib/bin.js', 'web', '--port', String(PORT), '--no-open'], {
  cwd: TEST_USE,
  stdio: ['ignore', fd, fd],
  env: {
    ...sanitizeEnv(),
    HOME: join(WORLD, '.tmp-home'),
    XDG_DATA_HOME: join(WORLD, '.tmp-xdg', 'data'),
    XDG_CONFIG_HOME: join(WORLD, '.tmp-xdg', 'config'),
    XDG_CACHE_HOME: join(WORLD, '.tmp-xdg', 'cache'),
    NPM_CONFIG_CACHE: join(WORLD, '.tmp-npm-cache'),
    DSH_HOME: WORLD,
    DSH_CLIENT_COMMIT_HASH: CLIENT_COMMIT_HASH,
    DEEPSEEK_BASE_URL: `http://127.0.0.1:${MOCK_PORT}`,
    DEEPSEEK_API_KEY: 'a4-accept-mock-key',
  },
})
closeSync(fd)
log(`host spawned pid=${host.pid} (log ${hostLogPath})`)
writeFileSync(MARKER, JSON.stringify({
  supervisorPid: process.pid,
  hostPid: host.pid,
  port: PORT,
  mockPort: MOCK_PORT,
  startedAt: new Date().toISOString(),
  modelDelayMs: MODEL_DELAY_MS,
  world: WORLD,
  hostLog: hostLogPath,
  hostJs: fileUrl(HOST_JS),
}, null, 2) + '\n')

let stopping = false
async function shutdown(sig) {
  if (stopping) return
  stopping = true
  log(`shutting down (${sig})`)
  try {
    host.kill('SIGTERM')
  } catch { /* gone */ }
  for (let i = 0; i < 40 && pidAlive(host.pid); i += 1) await sleep(250)
  try {
    if (pidAlive(host.pid)) host.kill('SIGKILL')
  } catch { /* gone */ }
  try {
    await MOCK.close()
  } catch { /* ignore */ }
  rmSync(MARKER, { force: true })
  await stableProbe('after-shutdown')
  process.exit(0)
}
process.on('SIGINT', () => void shutdown('SIGINT'))
process.on('SIGTERM', () => void shutdown('SIGTERM'))
host.on('exit', (code) => {
  if (!stopping) {
    log(`host exited unexpectedly (code=${code}); stopping mock and removing marker`)
    void shutdown('host-exit')
  }
})

// ── wait for the boot line, print it, record, then idle as supervisor ──────
const deadline = Date.now() + 300_000
let bootLine = null
let token = null
while (Date.now() < deadline && bootLine === null) {
  if (!pidAlive(host.pid)) fail(`host exited before booting; log tail in ${hostLogPath}`)
  const text = existsSync(hostLogPath) ? readFileSync(hostLogPath, 'utf8') : ''
  const m = BOOT_MARKER.exec(text)
  if (m !== null) {
    bootLine = m[0].replace(/^dsh web: /, '')
    token = new URL(bootLine).searchParams.get('token')
  } else {
    await sleep(500)
  }
}
if (bootLine === null) fail(`boot line not seen within 300s; log tail in ${hostLogPath}`)
writeFileSync(LAUNCH, JSON.stringify({ at: new Date().toISOString(), port: PORT, origin: `http://127.0.0.1:${PORT}`, token, bootLine }, null, 2) + '\n')
process.stdout.write(bootLine + '\n')
log('host booted (launch line above). Row surface: GET /__p6t6/health; remote: POST /team-remote/<method>.')
log('idle as supervisor — Ctrl-C (or node boot.mjs --stop from another shell) shuts the host + mock down.')
while (!stopping) await sleep(1000)
