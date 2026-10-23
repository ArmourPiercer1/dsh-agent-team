#!/usr/bin/env node
/**
 * launch-world-infra.mjs — Alpha.5 parallel-world INFRASTRUCTURE boot validator.
 *
 * Scope (user ruling 2026-10-23): infrastructure ONLY. Boots ONE world
 * (Host639 runtime + FROZEN 249eb mount surface, shared read-only) with its
 * own DSH_HOME / profile / storages / mock port / logs / PID. It NEVER
 * creates sessions, NEVER calls business tools, NEVER re-runs product C2
 * criteria. Verification = boot line + no-token 401 + auth exchange +
 * production/p6t6 rows in composed profile + p6t6 /health 200 ok:true.
 *
 * Mechanism is the a5m2-todo-c2/r17 launcher's own (DshInstance + profile
 * patch seam + startMockModel), reduced to the boot slice.
 *
 * Usage:
 *   node launch-world-infra.mjs --world <tests/homes/dir> --lane w1 \
 *     --host-port 3183 --mock-port 3498 --nonce <N> --evidence <run dir>
 *
 * Lifecycle: writes <world>/infra-state.json {phase:'ready',...} then waits
 * for SIGTERM/SIGINT; on signal: stop host, close mock, prove port free,
 * remove lock, write FINAL section, exit.
 */
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

const HERE = dirname(new URL(import.meta.url).pathname)
const REPO = resolve(HERE, '..', '..', '..', '..')
const WORKTREE = join(REPO, '.worktrees', 'a5-m2-int')
const TESTUSE = join(WORKTREE, 'tests', 'deepseek-harness-test-use')
const HOST_BIN = join(TESTUSE, 'apps', 'cli', 'lib', 'bin.js')

const args = process.argv.slice(2)
function arg(name, dflt) {
  const i = args.indexOf(`--${name}`)
  return i === -1 ? dflt : args[i + 1]
}

const { parseWorldArg, isDirectEntry, WorldSafetyError } = await import(pathToFileURL(join(REPO, 'tests', 'kits', 'lib', 'world-safety.mjs')).href)
// ENTRY-SAFETY LAW (2026-10-23 ruling): importing this module executes NOTHING
// beyond pure imports (throws — catchable by the importer, never exits it);
// only a direct invocation proceeds. The world is parseWorldArg-validated —
// missing/illegal --world never defaults to REPO/cwd/HOME and nothing is
// created or removed before validation.
if (!isDirectEntry(import.meta.url, process.argv[1])) {
  throw new WorldSafetyError('launch-world-infra: imported as a module — nothing executed (entry-safety law); invoke it directly')
}

const LANE = arg('lane')
let HOME
try {
  HOME = parseWorldArg({ repoRoot: REPO, homesRoot: join(REPO, 'tests', 'homes'), worldArg: arg('world') }).home
} catch (e) {
  console.error(`FATAL: ${String(e?.message ?? e)}`)
  process.exit(2)
}
const HOST_PORT = Number(arg('host-port'))
const MOCK_PORT = Number(arg('mock-port'))
const NONCE = arg('nonce')
const EVIDENCE = resolve(REPO, arg('evidence'))
if (!LANE || !HOST_PORT || !MOCK_PORT || !NONCE || !EVIDENCE) {
  console.error('usage: --world <dir> --lane wN --host-port N --mock-port N --nonce N --evidence <dir>')
  process.exit(2)
}
for (const p of [HOST_PORT, MOCK_PORT]) {
  if ([3080, 3180, 3181, 3182, 3186, 3497, 3500].includes(p)) {
    console.error(`FATAL: port ${p} is forbidden for this lane (reserved/stable)`); process.exit(2)
  }
}

const RUN = `a5par-${LANE}-${NONCE}`
const ROOT = `session-${RUN}`
const REALM = `a5par-realm-${NONCE}`
const LOG_DIR = join(EVIDENCE, 'instances', LANE)
const RUN_LOG = join(EVIDENCE, `launch-${LANE}.log`)
const LOCK = `${HOME}.lock`
const STATE = join(HOME, 'infra-state.json')
function log(msg) {
  const line = `[${new Date().toISOString()}][${LANE}] ${msg}`
  console.log(line)
  try { writeFileSync(RUN_LOG, readFileSync(RUN_LOG, 'utf8') + line + '\n') } catch { writeFileSync(RUN_LOG, line + '\n') }
}

const { CLIENT_COMMIT_HASH } = await import(pathToFileURL(join(WORKTREE, 'tests', 'paths.mjs')).href)
const { startMockModel } = await import(pathToFileURL(join(REPO, 'packages', 'tools', 'harness', 'mock-deepseek.mjs')).href)
const { DshInstance } = await import(pathToFileURL(join(REPO, 'tests', 'characterization', 'lib', 'instance.mjs')).href)
const { portInUse, waitForPortFree, logTail } = await import(pathToFileURL(join(REPO, 'tests', 'characterization', 'lib', 'util.mjs')).href)

// ── frozen shared mount surface (read-only; symlinked into the world) ─────
const SHARED = join(REPO, 'tests', 'homes', '.a5par-shared-249eb65ec')
const INSTALL_PKG = join(HOME, 'install-249eb65ec', 'package')
const PRODUCTION_ROW_PATH = join(INSTALL_PKG, 'packages', 'runtime', 'dist', 'packages', 'runtime', 'src', 'plugin', 'host.js')
const GLUE_PATH = join(INSTALL_PKG, 'packages', 'runtime', 'dist', 'packages', 'runtime', 'src', 'plugin', 'live', 'agent-bindings.mjs')
const SEAM_PATH = join(INSTALL_PKG, 'packages', 'runtime', 'dist', 'packages', 'runtime', 'root-binding', 'harness', 'seam.mjs')
const P6T6_PLUGIN_PATH = join(HOME, 'mount-helper-root', 'package', 'packages', 'tools', 'harness', 'plugin.mjs')
const PRODUCTION_ROW_NAME = pathToFileURL(PRODUCTION_ROW_PATH).href
const P6T6_ROW_NAME = pathToFileURL(P6T6_PLUGIN_PATH).href

// ── yaml emitter (exemplar-verbatim from the r17 launcher) ─────────────────
function yamlScalar(v) { if (v === null) return 'null'; if (typeof v === 'string') return JSON.stringify(v); return String(v) }
function yamlValueLines(value, indent) {
  if (Array.isArray(value)) return value.flatMap((item) => yamlEmitItem(item, indent))
  return Object.entries(value).flatMap(([k, v]) => yamlEmit(k, v, indent))
}
function yamlEmit(key, value, indent) {
  const pad = '  '.repeat(indent)
  if (value !== null && typeof value === 'object') {
    const empty = Array.isArray(value) ? value.length === 0 : Object.keys(value).length === 0
    if (empty) return [`${pad}${key}: ${Array.isArray(value) ? '[]' : '{}'}`]
    return [`${pad}${key}:`, ...yamlValueLines(value, indent + 1)]
  }
  return [`${pad}${key}: ${yamlScalar(value)}`]
}
function yamlEmitItem(item, indent) {
  const pad = '  '.repeat(indent)
  if (item === null || typeof item !== 'object') return [`${pad}- ${yamlScalar(item)}`]
  if (Array.isArray(item)) { if (item.length === 0) return [`${pad}- []`]; return [`${pad}-`, ...yamlValueLines(item, indent + 1)] }
  const entries = Object.entries(item)
  const [firstKey, firstValue] = entries[0]
  const firstLines = yamlEmit(firstKey, firstValue, indent + 1)
  const rest = entries.slice(1).flatMap(([k, v]) => yamlEmit(k, v, indent + 1))
  return [`${pad}- ${firstLines[0].slice((indent + 1) * 2)}`, ...firstLines.slice(1), ...rest]
}

const BP_YAML = [
  '---', 'schemaVersion: 3', `blueprintId: team.a5par.${LANE}`, 'revision: "1"',
  'leader:', '  templateId: leader', `  persona: "You are the leader of the A5PAR ${LANE} infra world (boot-only, no sessions)."`,
  'members:', '  - templateId: worker', '    persona: "Infra-world worker (never instantiated)."',
  'memberEnvelopes: []', 'requirements: []', 'permissionMutationEnvelope:', '  rules: []',
  'teamHardEnvelope:', '  rules: []', 'policyStates: []', 'metadata: {}', '---', '',
].join('\n')

function teamRowConfig() {
  return {
    rootSessionId: ROOT,
    bootPhase: 'create',
    blueprintSource: BP_YAML,
    blueprintDir: join(HOME, 'blueprints'),
    seedMembers: [],
    generation: 1,
    staticModel: { provider: 'deepseek-official', model: 'a5par-infra-model' },
    deniedSelection: null,
    mcpServers: [],
    mcpServer: null,
    environmentFacts: [
      { domain: 'tool', subject: 'web', available: true, generation: 1 },
      { domain: 'skill', subject: 'base', available: true, generation: 1 },
      { domain: 'persona', subject: 'standard', available: true, generation: 1 },
    ],
    externalPolicyFacts: { hard: {}, capabilityExists: {} },
    glueUrl: pathToFileURL(GLUE_PATH).href,
    seamUrl: pathToFileURL(SEAM_PATH).href,
    teamToolPlane: {
      realmId: REALM,
      todoEnabled: true,
      todoAllowParallelInProgress: false,
      fsInstance: { fs: 'a5par-infra', rootDir: TESTUSE, realmId: REALM, kind: 'absolute-path' },
    },
  }
}

function writePatchFile(patchPath) {
  mkdirSync(dirname(patchPath), { recursive: true })
  const lines = [
    `# A5PAR infra-world patch layer (${RUN}): boot-only mount of the FROZEN 249eb65ec shared surface (tgz ca0f4b25) + pinned p6t6 helper; NO product criteria (public profile-patch seam only, CORE PATCH BUDGET = 0).`,
    '- insert:',
    ...yamlEmitItem({ id: 'dsh-agent-team', name: PRODUCTION_ROW_NAME, config: teamRowConfig() }, 2),
    ...yamlEmitItem({ id: 'p6t6-team-tools', name: P6T6_ROW_NAME }, 2),
    '',
  ]
  writeFileSync(patchPath, lines.join('\n'))
}

let instance = null
let mock = null
let stopping = false
async function shutdown(reason, code) {
  if (stopping) return
  stopping = true
  const out = { run: RUN, reason, code, hostStopped: null, mockClosed: false, hostPortFree: null, mockPortFree: null, survivorPids: [] }
  try {
    if (instance) {
      const res = await instance.stop({ timeoutMs: 30_000 })
      out.hostStopped = { killed: res.killed, portFree: res.portFree }
    }
  } catch (e) { out.hostStopError = e.message }
  try { if (mock) { await mock.close(); out.mockClosed = true } } catch (e) { out.mockCloseError = e.message }
  out.hostPortFree = !(await portInUse(HOST_PORT, 1500))
  out.mockPortFree = !(await portInUse(MOCK_PORT, 1500))
  try {
    for (const pid of execFileSync('ls', ['/proc'], { encoding: 'utf8' }).trim().split('\n')) {
      if (!/^\d+$/.test(pid)) continue
      try {
        const cmd = readFileSync(`/proc/${pid}/cmdline`, 'utf8').replace(/\0/g, ' ')
        if (cmd.includes('apps/cli/lib/bin.js') && cmd.includes(`--port ${String(HOST_PORT)}`)) out.survivorPids.push({ pid, cmd: cmd.slice(0, 160) })
      } catch { /* gone */ }
    }
  } catch { /* /proc scan best effort */ }
  for (const f of [STATE, LOCK]) { try { rmSync(f, { force: true }) } catch { /* ok */ } }
  log(`SHUTDOWN ${JSON.stringify(out)}`)
  const fin = { phase: 'final', ...out, at: new Date().toISOString() }
  writeFileSync(join(EVIDENCE, `final-${LANE}.json`), JSON.stringify(fin, null, 2) + '\n')
  process.exit(code)
}
process.on('SIGTERM', () => { void shutdown('SIGTERM', 0) })
process.on('SIGINT', () => { void shutdown('SIGINT', 0) })

async function fatal(msg, code = 1) {
  log(`FATAL: ${msg}`)
  const tailOf = instance?.logPath ? join(EVIDENCE, `hostlog-tail-${LANE}.txt`) : null
  if (tailOf) { try { writeFileSync(tailOf, logTail(instance.logPath, 40)) } catch { /* ok */ } }
  await shutdown(`fatal: ${msg}`, code)
}

// ── preflight ───────────────────────────────────────────────────────────────
mkdirSync(EVIDENCE, { recursive: true })
log(`RUN ${RUN} world=${HOME} hostPort=${HOST_PORT} mockPort=${MOCK_PORT} testuse=${TESTUSE} clientCommit=${CLIENT_COMMIT_HASH}`)
const tuHead = execFileSync('git', ['-C', TESTUSE, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim()
const tuPorc = execFileSync('git', ['-C', TESTUSE, 'status', '--porcelain'], { encoding: 'utf8' }).trim()
if (tuHead !== '639ed015397290b3745d163aafe02ffee4aa3f84' || tuPorc !== '') await fatal(`Host639 identity: HEAD=${tuHead} porcelain=${tuPorc === '' ? 'empty' : 'DIRTY'}`)
if (!existsSync(HOST_BIN)) await fatal(`host entry missing: ${HOST_BIN}`)
for (const [l, p] of [['host.js', PRODUCTION_ROW_PATH], ['glue', GLUE_PATH], ['seam', SEAM_PATH], ['helper', P6T6_PLUGIN_PATH]]) {
  if (!existsSync(p)) await fatal(`mount surface missing (${l}): ${p} (shared root broken?)`)
}
if (existsSync(join(HOME, 'storages')) || existsSync(join(HOME, 'sessions'))) await fatal(`world not fresh: ${HOME}`)
if (existsSync(LOCK)) await fatal(`world locked by another writer: ${LOCK}`)
for (const p of [HOST_PORT, MOCK_PORT]) if (await portInUse(p, 1500)) await fatal(`port ${p} busy before launch`)
writeFileSync(LOCK, JSON.stringify({ world: HOME, pid: process.pid, kit: 'launch-world-infra.mjs', run: RUN, at: new Date().toISOString() }, null, 2))

// token-free port snapshot
try { writeFileSync(join(EVIDENCE, `ss-ltn-${LANE}-before.txt`), execFileSync('ss', ['-ltn'], { encoding: 'utf8' })) } catch { /* ok */ }

// ── boot ────────────────────────────────────────────────────────────────────
const patch = join(HOME, 'profiles', 'web', 'cordis.patch.yml')
writePatchFile(patch)
writeFileSync(join(HOME, 'p6t6-directive.json'), JSON.stringify({ boot: 1, phase: 'create', reportDir: EVIDENCE, runStamp: RUN, rootSessionId: ROOT }, null, 2))
process.env.DEEPSEEK_BASE_URL = `http://127.0.0.1:${MOCK_PORT}`
process.env.DEEPSEEK_API_KEY = `a5par-mock-${NONCE}`
mkdirSync(LOG_DIR, { recursive: true })

mock = await startMockModel({ port: MOCK_PORT, decide: () => ({ kind: 'text', content: 'a5par-infra-noop' }), log: (l) => log(`mock: ${l}`) })
log(`mock up on ${MOCK_PORT}`)

instance = new DshInstance({ hostTree: TESTUSE, dshHome: HOME, port: HOST_PORT, clientCommitHash: CLIENT_COMMIT_HASH, logDir: LOG_DIR })
const started = await instance.start({ timeoutMs: 240_000 })
const m = /^http:\/\/127\.0\.0\.1:(\d+)\/\?token=([A-Za-z0-9_-]+)$/.exec(started.url)
if (m === null) await fatal(`unexpected boot url: ${started.url.replace(/token=\S+/, 'token=<SCRUBBED>')}`)
const origin = `http://127.0.0.1:${m[1]}`
const token = m[2]
log(`boot line seen (token present, len=${token.length}); pid=${instance.child?.pid}`)

const anon = await fetch(`${origin}/`, { redirect: 'manual', signal: AbortSignal.timeout(10_000) })
log(`no-token GET / => ${anon.status} (expect 401)`)
if (anon.status !== 401) await fatal(`no-token gate expected 401, got ${anon.status}`)

const auth = await fetch(`${origin}/?token=${token}`, { redirect: 'manual', signal: AbortSignal.timeout(30_000) })
const cookie = auth.headers.get('set-cookie')
log(`auth GET /?token= => ${auth.status} (expect 303) set-cookie=${cookie !== null}`)
if (auth.status !== 303 || cookie === null) await fatal('auth exchange failed')

const dump = await instance.dumpConfig({ timeoutMs: 60_000 })
writeFileSync(join(LOG_DIR, 'dump-config.txt'), dump.text)
const rowOk = (row) => DshInstance.rowInDump(dump.text, row)
for (const [label, row] of [['dsh-agent-team', { id: 'dsh-agent-team', name: PRODUCTION_ROW_NAME }], ['p6t6-team-tools', { id: 'p6t6-team-tools', name: P6T6_ROW_NAME }]]) {
  if (!rowOk(row)) await fatal(`row ${label} not in composed profile dump`)
  log(`profile dump: row ${label} mounted (name match)`)
}

let hb = null
const t0 = Date.now()
for (;;) {
  try {
    const r = await fetch(`${origin}/__p6t6/health`, { signal: AbortSignal.timeout(10_000) })
    hb = { status: r.status, body: await r.json().catch(() => null) }
  } catch (e) { hb = { status: 0, error: e.message } }
  if (hb.status === 200 && hb.body?.ok === true) break
  if (hb.status === 200 && hb.body?.ok === false) await fatal(`row setup failed: ${JSON.stringify(hb.body).slice(0, 400)}`)
  if (Date.now() - t0 >= 240_000) await fatal(`health not ready in 240s: ${JSON.stringify(hb)}`)
  await new Promise((r) => setTimeout(r, 1000))
}
log(`health OK: ${JSON.stringify(hb.body).slice(0, 200)}`)

writeFileSync(STATE, JSON.stringify({
  phase: 'ready', run: RUN, lane: LANE, at: new Date().toISOString(),
  launcherPid: process.pid, hostPid: instance.child?.pid ?? null, mockPort: MOCK_PORT,
  hostPort: HOST_PORT, origin, bootUrlRedacted: started.url.replace(/token=\S+/, 'token=<SCRUBBED>'),
  health: hb.body, rows: ['dsh-agent-team', 'p6t6-team-tools'], sharedRoot: SHARED,
}, null, 2) + '\n')
log('READY — waiting for SIGTERM (infra validator holds the world up)')

// watchdog: never hold a lane forever if something upstream vanished
setTimeout(() => { void shutdown('watchdog-25min', 3) }, 25 * 60_000).unref?.()
