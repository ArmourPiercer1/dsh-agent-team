#!/usr/bin/env node
/**
 * team-projection-recovery-smoke.mjs — real-host smoke for the
 * 2026-09-27 team projection read-side recovery (phase 1).
 *
 * WHAT IT SETS UP (the guide §5.2 world):
 *
 *   A self-contained world under tests/homes/tpr-<stamp>/ on a pristine
 *   DSH 0.1.7-rc.1 host (tests/deepseek-harness-test-use @ 46a7f68b09),
 *   seeded from the mpr smoke world (a SYNTHETIC 2026-09-27 world with
 *   four durable teams, real session rows, blueprints — zero private
 *   user data):
 *
 *     - team T1  (session-mpr-t1-…)  — the grant team (≈ incident team A):
 *       the fixture adds ONE durable `artifact-read-granted` ledger entry
 *       (schemaVersion 1 payload, legal digests) + the sequence counter
 *       advance + the team_sessions generation advance (replaceState
 *       semantics: put = +1). The fixture is written BEFORE the host
 *       opens the domain in this run (the guide's pre-placement rule).
 *     - team BOOT (session-mpr-boot-…) — the second readable team
 *       (≈ incident team B, unchanged).
 *
 *   The plugin is installed as a BUNDLE from the task branch (a bare
 *   clone <home>/repo.git of the main repo at
 *   fix/team-projection-recovery-20260927 — the COMMITTED install
 *   surface: the committed dist + composition-shim), mounted ONLY
 *   through the public profile-patch seam (production row config
 *   OVERRIDE: bootPhase resume on T1 + the team-spill-local root pin).
 *
 *   A plain (non-team) session is created through the host's public
 *   channel (POST /api/session/prompt with the mock model) — it is the
 *   no-frame foreign/absent scenario target.
 *
 * SCENARIO DRIVE (by the main agent, with browser-skill):
 *   1. cold open T1 → team identity + members (readable; NOT "teamless");
 *   2. open the BOOT team → readable (two teams);
 *   3. open the plain session → no-frame: loading → failure line
 *      (internal-error / TEAM_SESSION_ABSENT) — never "no team";
 *   4. add a member to T1 (public mutation entry: POST
 *      /team-remote/member.create) → click 刷新团队视图 → the new member
 *      appears (dedicated refresh fetches members + events);
 *   5. compatibility reprobe on T1 → targets T1 (S1-H2 wrong-team fix);
 *   6. stale-frame failure: --stop → --corrupt T1 → --restart → the
 *      reconnecting client re-pulls T1 and shows the old content + the
 *      "update failed, showing last successful data" banner.
 *
 * CONTROL COMMANDS (env.json in the world home):
 *   node team-projection-recovery-smoke.mjs                 # setup + boot
 *   node team-projection-recovery-smoke.mjs --stop
 *   node team-projection-recovery-smoke.mjs --corrupt <rootSessionId>
 *   node team-projection-recovery-smoke.mjs --restart
 *   node team-projection-recovery-smoke.mjs --teardown
 *
 * USAGE FLAGS (setup):
 *   --host-port N (default: first free of 3181–3186)
 *   --mock-port N (default: 3496)
 *
 * EXIT: 0 ok; 1 fatal (environment/boot/install).
 *
 * ZERO-TOUCH: :3080/:3081/:3180 are never touched (port selection skips
 * them; they are not in the allowed ranges at all). The mpr SOURCE
 * world is read-only (copied, never modified).
 */

import { execFileSync, spawn, spawnSync } from 'node:child_process'
import {
  appendFileSync,
  copyFileSync,
  existsSync,
  mkdirSync,
  openSync,
  readFileSync,
  readdirSync,
  readSync,
  closeSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs'
import { createHash } from 'node:crypto'
import { createServer } from 'node:net'
import { dirname, join, resolve } from 'node:path'

const readDir = readdirSync
const STAMP = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
const KIT_DIR = resolve(dirname(new URL(import.meta.url).pathname))
const WORKTREE = resolve(KIT_DIR, '..', '..', '..')
const MAIN_REPO = resolve(WORKTREE, '..', '..')
const TESTUSE = join(MAIN_REPO, 'tests', 'deepseek-harness-test-use')
const HOST_BIN = join(TESTUSE, 'apps', 'cli', 'lib', 'bin.js')
import { TEST_USE_BASELINE_SHA } from '../../../tests/paths.mjs'  // canonical test-infrastructure pin (docs/TEST_METHODS.md §1)
const HOST_PIN = TEST_USE_BASELINE_SHA // canonical pin = tests/paths.mjs (moves with the pinned host generation)
const BRANCH = 'fix/team-projection-recovery-20260927'
const SOURCE_WORLD = join(MAIN_REPO, 'tests', 'homes', 'mpr-2026-09-27T08-35-52')
const STORE_DIR = join(MAIN_REPO, '.pnpm-store')

const T1 = 'session-mpr-t1-mpr-2026-09-27T08-35-52' // the grant team
const TEAM_B = 'session-mpr-boot-mpr-2026-09-27T08-35-52' // the second team
const BP_MAIN_FILE = 'mpr-main.yaml'

/** Recursive copy (dirs + files; the session store is 3 levels deep). */
function copyTree(src, dst) {
  mkdirSync(dst, { recursive: true })
  for (const entry of readDir(src)) {
    const s = join(src, entry)
    const d = join(dst, entry)
    const st = statSync(s)
    if (st.isDirectory()) copyTree(s, d)
    else copyFileSync(s, d)
  }
}

function arg(name, fallback) {
  const i = process.argv.indexOf(name)
  if (i === -1 || process.argv[i + 1] === undefined) return fallback
  return process.argv[i + 1]
}

const HOST_PORT = Number(arg('--host-port', '0'))
const MOCK_PORT = Number(arg('--mock-port', '3496'))

const log = (line) => {
  const s = `[tpr-smoke ${new Date().toISOString()}] ${line}`
  process.stdout.write(`${s}\n`)
}
function dieFatal(message) {
  log(`FATAL: ${message}`)
  process.exit(1)
}
function git(cwd, ...args) {
  return execFileSync('git', args, { cwd, encoding: 'utf8' }).trim()
}

// ── port helpers (the 3181–3186 family only; 3080/3081/3180 are NOT in
//    the range and are never touched) ──────────────────────────────────

function portFree(port) {
  return new Promise((resolveFree) => {
    const srv = createServer()
    srv.once('error', () => resolveFree(false))
    srv.once('listening', () => srv.close(() => resolveFree(true)))
    srv.listen(port, '127.0.0.1')
  })
}
async function firstFreePort(from, to) {
  for (let p = from; p <= to; p += 1) {
    if (await portFree(p)) return p
  }
  return null
}

// ── world setup ────────────────────────────────────────────────────────

function setupWorld() {
  if (!existsSync(SOURCE_WORLD)) {
    dieFatal(`source world missing: ${SOURCE_WORLD}`)
  }
  const home = join(MAIN_REPO, 'tests', 'homes', `tpr-${STAMP}`)
  if (existsSync(home)) dieFatal(`world already exists: ${home}`)
  mkdirSync(join(home, 'logs'), { recursive: true })
  mkdirSync(join(home, 'blueprints'), { recursive: true })
  // sessions + the durable team domain (synthetic mpr data, read-only
  // source) + the blueprints (the row config references mpr-main.yaml).
  copyTree(join(SOURCE_WORLD, 'sessions'), join(home, 'sessions'))
  mkdirSync(join(home, 'storages'), { recursive: true })
  copyFileSync(join(SOURCE_WORLD, 'storages', 'team_domain.json'), join(home, 'storages', 'team_domain.json'))
  for (const bp of readDir(join(SOURCE_WORLD, 'blueprints'))) {
    copyFileSync(join(SOURCE_WORLD, 'blueprints', bp), join(home, 'blueprints', bp))
  }
  return home
}

/**
 * Inject the grant fixture into T1 (the ≈ incident team A): one durable
 * `artifact-read-granted` ledger entry + the sequence counter advance +
 * the team_sessions generation advance (the put's stamp). Written
 * BEFORE the host opens the domain in this run.
 */
function injectGrantFixture(home) {
  const p = join(home, 'storages', 'team_domain.json')
  const domain = JSON.parse(readFileSync(p, 'utf8'))
  const t = domain.tables
  const ledger = t.ledger
  const counterRow = ledger.__ledger_sequence_counter
  const counter = JSON.parse(counterRow).value
  const nextSeq = String(counter + 1)
  const digest = (seed) => {
    // sha256 hex of a deterministic label (legal digest shape; synthetic).
    return `sha256:${crypto_sha256_hex(seed)}`
  }
  const grant = {
    createdAt: new Date().toISOString(),
    factType: 'artifact-read-granted',
    sequence: counter + 1,
    payload: {
      schemaVersion: 1,
      instanceId: 'inst-leader',
      locator: `/artifacts/tpr-smoke/report-${STAMP}.md`,
      targetKeyDigest: digest(`tpr-target-${STAMP}`),
      versionDigest: digest(`tpr-version-${STAMP}`),
      source: {
        kind: 'spill-store',
        spillSource: {
          kind: 'session-reference',
          sessionId: T1,
          label: 'tpr-smoke synthetic grant source',
        },
      },
    },
    rootSessionId: T1,
    schemaVersion: 2,
  }
  ledger[nextSeq] = canonicalJson(grant)
  ledger.__ledger_sequence_counter = canonicalJson({
    kind: 'ledger-sequence-counter',
    schemaVersion: 2,
    value: counter + 1,
  })
  const tsRow = JSON.parse(t.team_sessions[T1])
  tsRow.generation += 1
  t.team_sessions[T1] = canonicalJson(tsRow)
  writeFileSync(p, JSON.stringify(domain, null, 2))
  return { nextSeq, generation: tsRow.generation, counter: counter + 1 }
}

function crypto_sha256_hex(label) {
  return createHash('sha256').update(label).digest('hex')
}

/**
 * Canonical row bytes (the durable store's validation shape): compact
 * JSON with EVERY object level's keys sorted (the mpr seed rows carry
 * exactly this form — the repository's readRecordFromRaw rejects any
 * other byte form as non-canonical).
 */
function canonicalJson(value) {
  const sortValue = (v) => {
    if (v !== null && typeof v === 'object' && !Array.isArray(v)) {
      return Object.keys(v).sort().reduce((acc, k) => {
        acc[k] = sortValue(v[k])
        return acc
      }, {})
    }
    if (Array.isArray(v)) return v.map(sortValue)
    return v
  }
  return JSON.stringify(sortValue(value))
}

// ── bundle install (the committed install surface from the task branch) ─

function setupRepoGit(home) {
  const repoGit = join(home, 'repo.git')
  log(`cloning ${BRANCH} -> ${repoGit}`)
  execFileSync(
    'git',
    ['clone', '--bare', '--single-branch', '--branch', BRANCH, MAIN_REPO, repoGit],
    { encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'] },
  )
  return repoGit
}

function setupProfile(home, repoGit) {
  const profileDir = join(home, 'profiles', 'web')
  mkdirSync(profileDir, { recursive: true })
  const gitSpec = `git+file:////${repoGit.slice(1).replace(/\\/g, '/')}#${BRANCH}`
  writeFileSync(join(profileDir, 'package.json'), JSON.stringify({
    name: 'dsh-profile-web',
    private: true,
    dependencies: { 'dsh-agent-team': gitSpec },
    dsh: {
      profile: {
        bundles: ['@deepseek-ai/dsh-base', '@deepseek-ai/dsh-web-app', 'dsh-agent-team'],
      },
    },
  }, null, 2))
  writeFileSync(join(profileDir, 'pnpm-workspace.yaml'), [
    'packages:',
    '  - .',
    '',
    'nodeLinker: hoisted',
    'autoInstallPeers: false',
    '',
  ].join('\n'))
  const bpMain = readFileSync(join(home, 'blueprints', BP_MAIN_FILE), 'utf8')
  const rowConfig = {
    // 'create-or-open' (the shipped default phase): ADOPT the already-
    // stamped team_domain of this world (the mpr seed + the grant
    // fixture) — never re-create, never break a returning home.
    bootPhase: 'create-or-open',
    rootSessionId: T1,
    blueprintSource: bpMain,
    blueprintDir: join(home, 'blueprints'),
    rootPresetId: 'standard',
    memberPresetId: 'standard',
    seedMembers: [],
    generation: 1,
    staticModel: { provider: 'deepseek-official', model: `tpr-model-${STAMP}` },
    deniedSelection: null,
    mcpServers: [],
    environmentFacts: [
      { domain: 'tool', subject: 'web', available: true, generation: 1 },
      { domain: 'skill', subject: 'base', available: true, generation: 1 },
      { domain: 'persona', subject: 'standard', available: true, generation: 1 },
    ],
    externalPolicyFacts: { hard: {}, capabilityExists: {} },
  }
  writeFileSync(join(profileDir, 'cordis.patch.yml'), [
    `# team-projection-recovery smoke patch layer (run ${STAMP}): the public profile-patch seam — the dsh-agent-team row CONFIG OVERRIDE (production row = the COMMITTED task-branch install surface) + the team-spill-local root pin (world isolation).`,
    '- insert:',
    yamlItem({ id: 'dsh-agent-team', name: 'dsh-agent-team/host', config: rowConfig }, 2),
    yamlItem({ id: 'team-spill-local', name: 'dsh-agent-team/spill-local', config: { root: join(home, 'spill') } }, 2),
    '',
  ].join('\n'))
  log(`pnpm add ${gitSpec}`)
  const r = spawnSync('pnpm', ['add', gitSpec, `--store-dir=${STORE_DIR}`, '--ignore-scripts'], {
    cwd: profileDir,
    encoding: 'utf8',
    env: { ...process.env, CI: 'true', npm_config_store_dir: STORE_DIR },
    timeout: 600_000,
  })
  if (r.status !== 0) {
    dieFatal(`profile pnpm add failed (exit ${r.status}):\n${(r.stdout ?? '') + (r.stderr ?? '')}`)
  }
  const hostJs = join(profileDir, 'node_modules', 'dsh-agent-team', 'packages', 'runtime', 'dist', 'packages', 'runtime', 'src', 'plugin', 'host.js')
  if (!existsSync(hostJs)) {
    dieFatal(`installed bundle missing the dist host entry: ${hostJs}`)
  }
  log('bundle installed (committed dist entry verified)')
  return profileDir
}

function yamlItem(item, indent) {
  const pad = ' '.repeat(indent)
  const lines = [`${pad}- id: ${yamlStr(item.id)}`]
  lines.push(`${pad}  name: ${yamlStr(item.name)}`)
  if (item.config !== undefined) {
    lines.push(`${pad}  config:`)
    lines.push(...yamlDump(item.config, indent + 4).map((l) => (l === '' ? '' : `${' '.repeat(indent + 2)}${l}`)))
  }
  return lines.join('\n')
}

function yamlStr(s) {
  return JSON.stringify(String(s))
}

function yamlDump(value, indent) {
  const pad = ' '.repeat(indent)
  const lines = []
  if (value === null || typeof value !== 'object') {
    return [String(value)]
  }
  if (typeof value === 'object' && !Array.isArray(value) && Object.keys(value).length === 0) {
    // YAML block style cannot express an empty mapping ('key:' parses to
    // null) — the row config requires {} records (e.g. externalPolicyFacts
    // .hard), so emit the flow form.
    return ['{}']
  }
  if (Array.isArray(value)) {
    if (value.length === 0) return ['[]']
    for (const item of value) {
      if (item !== null && typeof item === 'object') {
        const sub = yamlDump(item, indent + 2)
        lines.push(`${pad}- ${sub[0].trimStart()}`)
        for (const l of sub.slice(1)) lines.push(l)
      } else {
        lines.push(`${pad}- ${item}`)
      }
    }
    return lines
  }
  for (const [k, v] of Object.entries(value)) {
    if (v === null) lines.push(`${pad}${k}: null`)
    else if (Array.isArray(v)) {
      if (v.length === 0) lines.push(`${pad}${k}: []`)
      else {
        lines.push(`${pad}${k}:`)
        for (const item of v) {
          if (item !== null && typeof item === 'object') {
            const sub = yamlDump(item, indent + 4)
            lines.push(`${pad}  - ${sub[0].trimStart()}`)
            for (const l of sub.slice(1)) lines.push(l)
          } else {
            lines.push(`${pad}  - ${item}`)
          }
        }
      }
    } else if (typeof v === 'object') {
      if (Object.keys(v).length === 0) lines.push(`${pad}${k}: {}`)
      else {
        lines.push(`${pad}${k}:`)
        lines.push(...yamlDump(v, indent + 2))
      }
    } else if (typeof v === 'string') {
      lines.push(`${pad}${k}: ${yamlStr(v)}`)
    } else {
      lines.push(`${pad}${k}: ${v}`)
    }
  }
  return lines
}

// ── mock + host boot ───────────────────────────────────────────────────

function spawnMock(home, port) {
  const logPath = join(home, 'logs', 'mock.log')
  const child = spawn(
    process.execPath,
    [join(KIT_DIR, 'mock-host.mjs'), '--port', String(port), '--log', logPath],
    { cwd: home, stdio: ['ignore', 'ignore', 'ignore'], detached: true },
  )
  child.unref()
  return { child, pid: child.pid, logPath }
}

function spawnHost(home, port, mockPort, logPath) {
  const outFd = openSync(logPath, 'a')
  const child = spawn(
    process.execPath,
    [HOST_BIN, 'web', '--port', String(port), '--no-open'],
    {
      cwd: TESTUSE,
      stdio: ['ignore', outFd, outFd],
      env: {
        ...process.env,
        DSH_HOME: home,
        DSH_CLIENT_COMMIT_HASH: HOST_PIN.slice(0, 10),
        DEEPSEEK_BASE_URL: `http://127.0.0.1:${mockPort}`,
        DEEPSEEK_API_KEY: 'tpr-smoke-mock-key',
      },
    },
  )
  return { child, pid: child.pid, logPath }
}

const BOOT_MARKER = /dsh web: http:\/\/127\.0\.0\.1:(\d+)\/\?token=([A-Za-z0-9_-]+)/
async function waitForBoot(logPath, timeoutMs, alive) {
  const deadline = Date.now() + timeoutMs
  let base = 0
  try { base = statSync(logPath).size } catch { /* fresh log */ }
  while (Date.now() < deadline) {
    if (!alive()) return null
    try {
      // The instance log is APPENDED across boots (restart reuse). Match the
      // marker only in bytes written since the spawn — a stale token line
      // from a previous boot would otherwise satisfy the wait instantly and
      // race the authenticate against a still-starting server.
      const stat = statSync(logPath)
      const fh = openSync(logPath, 'r')
      let appended = ''
      try {
        const len = stat.size - base
        if (len > 0) {
          const buf = Buffer.alloc(len)
          readSync(fh, buf, 0, len, base)
          appended = buf.toString('utf8')
        }
      } finally {
        closeSync(fh)
      }
      const m = BOOT_MARKER.exec(appended)
      if (m !== null) return { port: Number(m[1]), token: m[2] }
    } catch { /* not yet */ }
    await sleep(500)
  }
  return null
}

async function authenticate(origin, token) {
  const res = await fetch(`${origin}/?token=${token}`, { redirect: 'manual', signal: AbortSignal.timeout(30_000) })
  const setCookie = res.headers.get('set-cookie')
  if (res.status !== 303 || setCookie === null) {
    throw new Error(`dsh web authentication returned HTTP ${res.status} (expected 303 + set-cookie)`)
  }
  return setCookie.split(';', 1)[0]
}

async function apiPrompt(origin, cookie, sessionId, text, tag) {
  const res = await fetch(`${origin}/api/session/prompt`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie },
    body: JSON.stringify({
      type: 'client-request',
      rpcId: `${tag}-${Math.random().toString(36).slice(2, 12)}`,
      method: 'session/prompt',
      payload: {
        args: {
          request: {
            requestId: `${tag}-${Math.random().toString(36).slice(2, 12)}`,
            sessionId,
            mode: 'queue',
            content: [{ type: 'text', text }],
          },
        },
      },
    }),
    signal: AbortSignal.timeout(240_000),
  })
  if (!res.ok) {
    throw new Error(`session/prompt HTTP ${res.status}: ${(await res.text()).slice(0, 400)}`)
  }
  const body = await res.json()
  const result = body.result ?? body
  if (result.ok === false) {
    throw new Error(`session/prompt rejected: ${JSON.stringify(result.error ?? result).slice(0, 300)}`)
  }
  return res.status
}

/**
 * session/create -> the host's public creation entry (a pre-decided
 * sessionId does NOT create on prompt — the prompt of an unknown id
 * fails session/not-found; the app's own flow is create-then-prompt).
 */
async function apiCreateSession(origin, cookie, tag) {
  const res = await fetch(`${origin}/api/session/create`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie },
    body: JSON.stringify({
      type: 'client-request',
      rpcId: `${tag}-${Math.random().toString(36).slice(2, 12)}`,
      method: 'session/create',
      payload: { args: { request: {} } },
    }),
    signal: AbortSignal.timeout(30_000),
  })
  if (!res.ok) throw new Error(`session/create HTTP ${res.status}`)
  const body = await res.json()
  const result = body.result ?? body
  if (result.ok === false) {
    throw new Error(`session/create rejected: ${JSON.stringify(result.error ?? result).slice(0, 300)}`)
  }
  return result.value.sessionId
}

async function remoteCall(origin, cookie, method, params, tag, version = 1) {
  const res = await fetch(`${origin}/team-remote/${method}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie },
    body: JSON.stringify({
      type: 'client-request',
      rpcId: `${tag}-${Math.random().toString(36).slice(2, 12)}`,
      method,
      payload: { version, params },
    }),
    signal: AbortSignal.timeout(240_000),
  })
  const text = await res.text()
  let body
  try {
    body = JSON.parse(text)
  } catch {
    body = { raw: text.slice(0, 800) }
  }
  return { status: res.status, body }
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

function readEnv(home) {
  const p = join(home, 'env.json')
  if (!existsSync(p)) dieFatal(`env.json missing (run setup first): ${p}`)
  return JSON.parse(readFileSync(p, 'utf8'))
}
function writeEnv(home, env) {
  writeFileSync(join(home, 'env.json'), JSON.stringify(env, null, 2))
}

// ── mode: setup + boot ─────────────────────────────────────────────────

async function setupAndBoot() {
  if (HOST_PIN.length !== 40) dieFatal('HOST_PIN must be the full 40-char sha')
  log(`world stamp ${STAMP}`)
  const home = setupWorld()
  const fx = injectGrantFixture(home)
  log(`grant fixture injected into ${T1}: ledger seq ${fx.nextSeq}, team generation ${fx.generation}`)
  const repoGit = setupRepoGit(home)
  setupProfile(home, repoGit)

  const hostPort = HOST_PORT !== 0 ? HOST_PORT : (await firstFreePort(3181, 3186))
  if (hostPort === null) dieFatal('no free port in 3181–3186')
  if (!(await portFree(MOCK_PORT))) dieFatal(`mock port ${MOCK_PORT} busy`)

  const mock = spawnMock(home, MOCK_PORT)
  const instanceLog = join(home, 'logs', 'host.log')
  writeFileSync(env.instanceLog, '')
  const host = spawnHost(home, hostPort, MOCK_PORT, instanceLog)
  log(`host pid ${host.pid} (log ${instanceLog}); mock pid ${mock.pid}`)

  const boot = await waitForBoot(instanceLog, 240_000, () => pidAlive(host.pid))
  if (boot === null) {
    const tail = logTail(instanceLog)
    stopPids([host.pid, mock.pid])
    dieFatal(`host boot failed:\n--- log tail ---\n${tail}`)
  }
  const origin = `http://127.0.0.1:${boot.port}`
  let cookie
  try {
    cookie = await authenticate(origin, boot.token)
  } catch (error) {
    stopPids([host.pid, mock.pid])
    dieFatal(`authenticate failed: ${error.message}`)
  }
  log(`authenticated at ${origin}`)

  let plainSession
  try {
    plainSession = await apiCreateSession(origin, cookie, 'tpr-plain')
    await apiPrompt(origin, cookie, plainSession, `tpr smoke plain session ${STAMP} (no team)`, 'tpr-plain')
  } catch (error) {
    stopPids([host.pid, mock.pid])
    dieFatal(`plain session creation failed: ${error.message}`)
  }
  log(`plain session created: ${plainSession}`)

  const env = {
    stamp: STAMP,
    home,
    hostPort: boot.port,
    mockPort: MOCK_PORT,
    origin,
    cookie,
    hostPid: host.pid,
    mockPid: mock.pid,
    instanceLog,
    hostArgs: { bin: HOST_BIN, port: boot.port, home, mockPort: MOCK_PORT, cwd: TESTUSE },
    sessions: { teamA_grant: T1, teamB: TEAM_B, plain: plainSession },
    fixture: fx,
  }
  writeEnv(home, env)
  log(`env.json written: ${join(home, 'env.json')}`)
  log('READY — browser scenarios can start (origin, cookie, session ids in env.json)')
  return env
}

// ── mode: --stop ───────────────────────────────────────────────────────

function stopWorld(home) {
  const env = readEnv(home)
  stopPids([env.hostPid, env.mockPid])
  writeEnv(home, { ...env, hostPid: null, mockPid: null })
  log('stopped (host + mock)')
}

function stopPids(pids) {
  for (const pid of pids) {
    if (pid === null || pid === undefined) continue
    if (!pidAlive(pid)) continue
    try {
      process.kill(pid, 'SIGTERM')
    } catch { /* gone */ }
  }
  for (let i = 0; i < 20; i += 1) {
    const alive = pids.filter((p) => p !== null && p !== undefined && pidAlive(p))
    if (alive.length === 0) return
    // eslint-disable-next-line no-await-in-loop
    sleepSync(250)
  }
  for (const pid of pids) {
    if (pid === null || pid === undefined) continue
    if (pidAlive(pid)) {
      try {
        process.kill(pid, 'SIGKILL')
      } catch { /* gone */ }
    }
  }
}

function sleepSync(ms) {
  spawnSync('sleep', [String(ms / 1000)])
}

// ── mode: --corrupt <rootSessionId> (host must be STOPPED) ─────────────

function corruptTeam(home, rootSessionId) {
  const env = readEnv(home)
  if (env.hostPid !== null && pidAlive(env.hostPid)) {
    dieFatal('the host is still running — stop it first (--stop): the fixture is only written to a CLOSED domain')
  }
  const p = join(home, 'storages', 'team_domain.json')
  const domain = JSON.parse(readFileSync(p, 'utf8'))
  const ledger = domain.tables.ledger
  const counter = JSON.parse(ledger.__ledger_sequence_counter).value
  const nextSeq = String(counter + 1)
  // A durable fact type with NO category mapping: the read fails loud
  // (TEAM_PROJECTION_SOURCE_LEDGER_CATEGORY_UNKNOWN -> the frozen
  // internal-error envelope — the incident shape).
  const corruptRow = {
    createdAt: new Date().toISOString(),
    factType: 'tpr-smoke-corrupt-fact',
    sequence: counter + 1,
    payload: { note: 'tpr-smoke controlled read failure fixture (synthetic)' },
    rootSessionId,
    schemaVersion: 2,
  }
  ledger[nextSeq] = canonicalJson(corruptRow)
  ledger.__ledger_sequence_counter = canonicalJson({
    kind: 'ledger-sequence-counter',
    schemaVersion: 2,
    value: counter + 1,
  })
  writeFileSync(p, JSON.stringify(domain, null, 2))
  writeEnv(home, { ...env, corrupted: { ...(env.corrupted ?? {}), [rootSessionId]: nextSeq } })
  log(`corrupted ${rootSessionId}: ledger seq ${nextSeq} (unknown fact type) — restart to arm`)
}

// ── mode: --restart ────────────────────────────────────────────────────

async function restartWorld(home) {
  const env = readEnv(home)
  const h = env.hostArgs
  // mock first (the host talks to it).
  if (env.mockPid === null || !pidAlive(env.mockPid)) {
    const m = spawnMock(home, env.mockPort)
    env.mockPid = m.pid
    log(`mock respawned (pid ${m.pid})`)
    await sleep(750)
  }
  // Fresh log per boot: waitForBoot scans appended bytes, and a truncated
  // log also keeps the boot evidence unambiguous per generation.
  writeFileSync(env.instanceLog, '')
  const host = spawnHost(home, h.port, env.mockPort, env.instanceLog)
  const boot = await waitForBoot(env.instanceLog, 240_000, () => pidAlive(host.pid))
  if (boot === null) {
    stopPids([host.pid])
    dieFatal(`restart failed (no boot marker):\n${logTail(env.instanceLog)}`)
  }
  const cookie = await authenticate(`http://127.0.0.1:${boot.port}`, boot.token)
  writeEnv(home, { ...env, hostPid: host.pid, cookie, origin: `http://127.0.0.1:${boot.port}` })
  log(`restarted (pid ${host.pid}) — fresh cookie in env.json`)
  process.exit(0) // detached world (host+mock) outlives this process; undici keep-alive would otherwise pin node
}

// ── mode: --teardown ───────────────────────────────────────────────────

function teardownWorld(home, keep) {
  const env = existsSync(join(home, 'env.json')) ? readEnv(home) : {}
  stopPids([env.hostPid ?? null, env.mockPid ?? null])
  if (!keep) {
    rmSync(home, { recursive: true, force: true })
    log(`world removed: ${home}`)
  } else {
    log(`world kept (evidence): ${home}`)
  }
}

function logTail(p, n = 30) {
  try {
    return readFileSync(p, 'utf8').split('\n').slice(-n).join('\n')
  } catch {
    return '<no log>'
  }
}

// ── dispatch ───────────────────────────────────────────────────────────

const rawArgs = process.argv.slice(2)
// Positional args (mode + its operands); --host-port/--mock-port/--keep
// are flags (value-carrying ones consume the next arg).
const positional = []
for (let i = 0; i < rawArgs.length; i += 1) {
  const a = rawArgs[i]
  if (a === '--host-port' || a === '--mock-port') { i += 1; continue }
  if (a === '--keep') continue
  positional.push(a)
}
const MODE = positional[0]

if (MODE === undefined) {
  await setupAndBoot()
} else if (MODE === '--stop') {
  stopWorld(resolveWorldHome(positional[1]))
} else if (MODE === '--corrupt') {
  const rootId = positional[1]
  if (rootId === undefined) dieFatal('--corrupt needs <rootSessionId>')
  corruptTeam(resolveWorldHome(positional[2]), rootId)
} else if (MODE === '--restart') {
  await restartWorld(resolveWorldHome(positional[1]))
} else if (MODE === '--teardown') {
  teardownWorld(resolveWorldHome(positional[1]), rawArgs.includes('--keep'))
} else {
  dieFatal(`unknown mode: ${MODE}`)
}
// The world (host + mock) is detached; undici keep-alive sockets from the
// authenticate/prompt calls would otherwise pin this process forever.
process.exit(0)

/** Find the world home: explicit arg, or the most recent tpr-* world. */
function resolveWorldHome(explicit) {
  const homes = join(MAIN_REPO, 'tests', 'homes')
  if (explicit !== undefined) {
    const p = resolve(explicit)
    if (!existsSync(p)) dieFatal(`world not found: ${p}`)
    return p
  }
  const candidates = readDir(homes)
    .filter((n) => n.startsWith('tpr-') && existsSync(join(homes, n, 'env.json')))
    .sort()
  if (candidates.length === 0) dieFatal('no tpr-* world with env.json (run setup first)')
  return join(homes, candidates[candidates.length - 1])
}
