#!/usr/bin/env node
/**
 * live-ui-world.mjs — the REAL-BROWSER world for the 2026-09-21 supplemental
 * UI validation round (guide `PR27_PR28_supplemental_fix_and_real_ui_validation.md` §9).
 *
 * WHAT THIS KIT DOES (one branch at a time — the browser scenarios differ
 * per PR; run it once per PR branch):
 *
 *   1. PREFLIGHT — test-use checkout pinned @ fb2c4b9e69 + byte-clean;
 *      the branch's install surface built (runtime dist + root
 *      cordis.patch.yml + client bundle); :3080/:3180 read-only probes
 *      (pre) — the stable instance is NEVER touched.
 *   2. WORLD — a fresh DSH_HOME under tests/homes/ (workspace-contained,
 *      gitignored, TEST_METHODS §7 naming) with XDG_DATA_HOME + TMPDIR
 *      redirected INSIDE the world (workspace-write sandbox keeps
 *      out-of-workspace paths read-only; pnpm 11's SQLite store needs a
 *      writable location — the git-install-boot probe's proven layout).
 *   3. INSTALL — the branch installed the way a user installs it:
 *      `dsh plugin --profile web add git+file:///<local bare clone>#<branch>`
 *      (pnpm git-dep semantics; prebuilt install surface, zero lifecycle
 *      scripts) — the bundle layer then auto-adds the dsh-agent-team
 *      row (asserted, no hand-written row).
 *   4. CONFIG — the profile patch layer overrides the host row's config
 *      (whole-config replacement, the shipped bundle layer's own
 *      semantics): bootPhase create-or-open, rootSessionId team-root,
 *      the inline live-UI blueprint (leader + worker template, no
 *      capabilities — the legacy non-strict shape, so the A2C-2
 *      coverage gate never runs), the user preset, and the staticModel
 *      pin. The mock model endpoint is the host's DEEPSEEK_BASE_URL —
 *      the scripted leader chain (two team_delegate + one
 *      team_archive_member) is driven by the mock's decide policy,
 *      exactly like a real model calling the tools.
 *   5. BOOT — the real host (test-use built CLI) on a 3180-family port
 *      (3180 itself is the live session GUI — off-limits; :3080 stable
 *      instance untouched). Boot marker + auth (303 + cookie) proven.
 *   6. SESSION — the root DSH session is created over the public
 *      session channel (the same seam the Web UI's "New session" uses)
 *      so the browser sees it in the session list.
 *   7. CONTROL — a tiny 127.0.0.1 control server (controlPort):
 *         GET  /state    — phase + mock request count + member lifecycles
 *         POST /drive    — send the leader prompt (MK_LEAD) and poll the
 *                          durable ledger until worker-a SETTLED +
 *                          worker-b ARCHIVED (or timeout)
 *      The agent (browser side) triggers /drive, works the browser
 *      scenarios, then creates <world>/SCENARIOS-DONE; the kit tears
 *      down (host SIGTERM, mock close, world removal unless --keep),
 *      writes summary.json, and exits.
 *
 * DISCIPLINE: test-use stays pristine (post-assert); the stable instance
 * probes pre == post; the world holds the launch token → NEVER committed
 * (state.json lives in the world dir; only token-free artifacts are
 * committed to evidence); ports released at teardown.
 *
 * Usage:
 *   node live-ui-world.mjs --branch <branch> --worktree <path> \
 *     [--port 3181] [--mock-port 3491] [--control-port 3492] [--keep]
 */
import {
  appendFileSync, closeSync, existsSync, mkdirSync, openSync, readFileSync,
  rmSync, writeFileSync,
} from 'node:fs'
import { createServer } from 'node:http'
import { spawn, spawnSync } from 'node:child_process'
import { dirname, join, resolve } from 'node:path'
import process from 'node:process'
import { pathToFileURL } from 'node:url'

// ── args ─────────────────────────────────────────────────────────────────
const argv = process.argv.slice(2)
function arg(name, dflt) {
  const i = argv.indexOf(`--${name}`)
  return i === -1 ? dflt : argv[i + 1]
}
const BRANCH = arg('branch', null)
const WORKTREE = resolve(arg('worktree', '.'))
const PORT = Number(arg('port', '3181'))
const MOCK_PORT = Number(arg('mock-port', '3491'))
const CONTROL_PORT = Number(arg('control-port', '3492'))
const KEEP = argv.includes('--keep')
if (BRANCH === null) { console.error('usage: --branch <b> --worktree <path> [--port P] [--mock-port P] [--control-port P] [--keep]'); process.exit(2) }
const BRANCH_SHORT = BRANCH.replace(/[^A-Za-z0-9]/g, '').slice(-12)
const STAMP = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)

// ── paths ────────────────────────────────────────────────────────────────
const MAIN_REPO = resolve(WORKTREE, '..', '..')
const TESTUSE = join(MAIN_REPO, 'tests', 'deepseek-harness-test-use')
const BIN_JS = join(TESTUSE, 'apps', 'cli', 'lib', 'bin.js')
const TESTUSE_PIN = 'fb2c4b9e698e30edb738bca4cf0618587db7d203'
const KIT_DIR = dirname(new URL(import.meta.url).pathname)
const LIVE_BROWSER_DIR = dirname(KIT_DIR)
const RUN_DIR = join(LIVE_BROWSER_DIR, `run-${BRANCH_SHORT}-${STAMP}`)
const HOME = join(MAIN_REPO, 'tests', 'homes', `liveui-${BRANCH_SHORT}-${STAMP}`)
const WORKSPACE = join(HOME, 'workspace')
const WORLD_TMP = join(HOME, 'tmp')
const XDG = join(HOME, '.xdg')
const BLUEPRINT_DIR = join(HOME, 'blueprints')
const REPO_GIT = join(HOME, 'repo.git')
const PROFILE_DIR = join(HOME, 'profiles', 'web')
const PRESET_ID = 'live-ui'
const ROOT = 'team-root'
const INSTANCE_LOG = join(RUN_DIR, 'instance.log')
const SETUP_LOG = join(RUN_DIR, 'setup.log')
const STATE_FILE = join(HOME, 'state.json')

// ── logging / criteria ───────────────────────────────────────────────────
const CRITERIA = []
function log(msg) {
  const line = `[${new Date().toISOString()}] ${msg}`
  try { appendFileSync(join(RUN_DIR, 'kit.log'), line + '\n') } catch { /* pre-RUN_DIR */ }
  console.log(line)
}
function check(leg, name, ok, detail) {
  CRITERIA.push({ leg, name, ok: !!ok, detail: String(detail ?? '') })
  log(`${ok ? 'PASS' : 'FAIL'} [${leg}] ${name}${detail ? ` — ${String(detail).slice(0, 300)}` : ''}`)
  return !!ok
}

// ── markers / scripted chain ─────────────────────────────────────────────
const MK_LEAD = `LIVEUI-LEAD-${STAMP}`
const MK_WA = `LIVEUI-WORKA-${STAMP}`
const MK_WB = `LIVEUI-WORKB-${STAMP}`

// ── small helpers ────────────────────────────────────────────────────────
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
function gitOf(cwd, args) {
  const r = spawnSync('git', args, { cwd, encoding: 'utf8' })
  if (r.status !== 0) throw new Error(`git ${args.join(' ')} failed: ${String(r.stderr ?? r.stdout).slice(0, 400)}`)
  return r.stdout
}
async function isFree(port) {
  return new Promise((res) => {
    const srv = createServer()
    srv.once('error', () => res(false))
    srv.once('listening', () => { srv.close(() => res(true)) })
    srv.listen(port, '127.0.0.1')
  })
}
async function probeInstance(port) {
  try {
    const res = await fetch(`http://127.0.0.1:${port}/`, { signal: AbortSignal.timeout(3000) })
    return { reachable: true, status: res.status }
  } catch (error) {
    return { reachable: false, status: null, error: String(error?.message ?? error).slice(0, 120) }
  }
}
async function fetchJson(url, init, timeoutMs = 240000) {
  const res = await fetch(url, { ...init, signal: AbortSignal.timeout(timeoutMs) })
  const text = await res.text()
  let body = null
  try { body = text ? JSON.parse(text) : null } catch { body = { raw: text.slice(0, 4000) } }
  return { status: res.status, body, cookie: res.headers.get('set-cookie')?.split(';')[0] ?? null }
}
/** The proven rc2-kit auth: GET /?token=… redirect:manual → 303 + set-cookie. */
async function authenticate(origin, token) {
  const res = await fetch(`${origin}/?token=${token}`, { redirect: 'manual', signal: AbortSignal.timeout(30000) })
  const setCookie = res.headers.get('set-cookie')
  if (res.status !== 303 || setCookie === null) {
    throw new Error(`dsh web authentication returned HTTP ${res.status} (expected 303 + set-cookie)`)
  }
  return setCookie.split(';', 1)[0]
}
/** One user turn on the public session channel (the Web UI's prompt seam). */
async function apiPrompt(origin, cookie, sessionId, text, tag, timeoutMs = 240000) {
  return fetchJson(`${origin}/api/session/prompt`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie },
    body: JSON.stringify({
      type: 'client-request',
      rpcId: `${tag}-${Math.random().toString(36).slice(2, 12)}`,
      method: 'session/prompt',
      payload: { args: { request: { requestId: `${tag}-${Math.random().toString(36).slice(2, 12)}`, sessionId, mode: 'queue', content: [{ type: 'text', text }] } } },
    }),
  }, timeoutMs)
}
/** Explicit-id session adoption (the Web UI's "New session" seam). */
async function apiSessionCreate(origin, cookie, sessionId, cwd, presetId, tag) {
  return fetchJson(`${origin}/api/session/create`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie },
    body: JSON.stringify({
      type: 'client-request',
      rpcId: `${tag}-${Math.random().toString(36).slice(2, 12)}`,
      method: 'session/create',
      payload: { args: { request: { sessionId, cwd, agentPreset: presetId } } },
    }),
  }, 120000)
}
/** Durable ledger scan (the rc2 kit pattern, read-only). */
function readDurableLedger() {
  const file = join(HOME, 'storages', 'team_domain.json')
  if (!existsSync(file)) return []
  let parsed
  try { parsed = JSON.parse(readFileSync(file, 'utf8')) } catch { return [] }
  const table = parsed?.tables?.ledger
  if (table === null || typeof table !== 'object') return []
  const out = []
  for (const [seq, raw] of Object.entries(table)) {
    if (seq === '__ledger_sequence_counter' || typeof raw !== 'string') continue
    let entry = null
    try { entry = JSON.parse(raw) } catch { continue }
    if (entry !== null && typeof entry === 'object') out.push({ sequence: seq, ...entry })
  }
  return out
}
/** The instance id from a team_delegate / team_create_member tool result. */
function extractInstanceId(content) {
  const m =
    /"targetInstanceId"\s*:\s*"([^"]+)"/.exec(String(content)) ??
    /"instanceId"\s*:\s*"([^"]+)"/.exec(String(content)) ??
    /inst-[A-Za-z0-9][A-Za-z0-9-]{3,64}/.exec(String(content))
  return m === null ? null : m[1]
}

// ── the blueprint (inline via the host row's blueprintSource) ───────────
const BLUEPRINT_YAML = [
  '---',
  'schemaVersion: 1',
  'blueprintId: live-ui-blueprint',
  'revision: "1"',
  'leader:',
  '  templateId: leader',
  '  persona: "You are the leader of the live UI verification team. Use the team tools when asked: create members by delegating to template \'worker\', archive members with team_archive_member. Keep replies short."',
  'members:',
  '  - templateId: worker',
  '    persona: "You are a worker of the live UI verification team. Do exactly what the delegated work says and reply with the exact requested text only."',
  'teamEnvelope:',
  '  allow:',
  '    - assign-task',
  '    - create-member',
  '    - send-message',
  '    - report-progress',
  '    - request-control',
  '    - resolve-control',
  '    - archive-member',
  '    - restore-member',
  '    - dispose-member',
  '  deny: []',
  'memberEnvelopes: []',
  'requirements: []',
  'policyStates: []',
  'metadata: {}',
  '---',
  '',
].join('\n')

function hostRowConfigYaml() {
  return [
    '  config:',
    '    bootPhase: "create-or-open"',
    `    rootSessionId: "${ROOT}"`,
    '    blueprintSource: |',
    ...BLUEPRINT_YAML.split('\n').map((l) => (l.length > 0 ? `      ${l}` : '')),
    `    blueprintDir: ${BLUEPRINT_DIR}`,
    `    rootPresetId: ${PRESET_ID}`,
    `    memberPresetId: ${PRESET_ID}`,
    '    seedMembers: []',
    '    generation: 1',
    '    staticModel:',
    '      provider: deepseek-official',
    '      model: live-ui-model',
    '    deniedSelection: null',
    '    mcpServers: []',
    '    mcpServer: null',
    '    environmentFacts:',
    '      - { domain: "tool", subject: "web", available: true, generation: 1 }',
    '      - { domain: "skill", subject: "base", available: true, generation: 1 }',
    '      - { domain: "persona", subject: "standard", available: true, generation: 1 }',
    '    externalPolicyFacts:',
    '      hard: {}',
    '      capabilityExists: {}',
  ].join('\n')
}

function writePreset() {
  const dir = join(HOME, '.agent-presets', PRESET_ID)
  mkdirSync(dir, { recursive: true })
  const text = [
    `# ${PRESET_ID} — live UI validation preset (run ${STAMP}). Kit-authored via`,
    '# the public user-preset seam (DSH_HOME/.agent-presets). persona + fs',
    '# tools only: the team tools are registered by the team glue, the',
    '# scripted mock drives every model decision.',
    '- id: persona',
    "  name: '@deepseek-ai/dsh-persona'",
    '  config:',
    '    suffix: Your working directory is {{cwd}}.',
    '    prefix: >-',
    '      You are a precise, terse agent. Do exactly what is asked.',
    '- id: tool-fs',
    "  name: '@deepseek-ai/dsh-tool-fs'",
    '',
  ].join('\n')
  writeFileSync(join(dir, 'agent.cordis.yml'), text)
}

// ── mock model (the scripted leader chain) ───────────────────────────────
function toolCall(name, argumentsObj) {
  return { kind: 'tool-call', toolCalls: [{ id: `call-liveui-${Math.random().toString(36).slice(2, 10)}`, name, arguments: argumentsObj }] }
}
function userTextOf(req) {
  const msgs = req?.messages ?? []
  return msgs
    .filter((m) => m.role === 'user')
    .map((m) => (typeof m.content === 'string' ? m.content : JSON.stringify(m.content ?? '')))
    .join('\n')
}
function toolMsgsOf(req) {
  return (req?.messages ?? []).filter((m) => m.role === 'tool')
}
function makeDecide(state) {
  return function decide({ req }) {
    state.mockDecisions += 1
    const msgs = req?.messages ?? []
    const first = msgs[0]
    // Title-generation side call — never drive the chain from it.
    if (first?.role === 'system' && typeof first.content === 'string' && /concise title/i.test(first.content)) {
      return { kind: 'text', content: 'live UI verification session' }
    }
    const text = userTextOf(req)
    const tools = toolMsgsOf(req)
    // Member turns (separate sessions; the delegated prompt carries the marker).
    if (text.includes(MK_WA)) return { kind: 'text', content: 'WORK_DONE_A' }
    if (text.includes(MK_WB)) return { kind: 'text', content: 'WORK_DONE_B' }
    // The leader chain: delegate(worker-a) → delegate(worker-b) → archive(worker-b) → done.
    if (text.includes(MK_LEAD)) {
      switch (tools.length) {
        case 0:
          return toolCall('team_delegate', {
            rootSessionId: ROOT,
            requestToken: `liveui-dlga-${STAMP}`,
            delegationTemplateId: 'worker',
            label: 'worker-a',
            taskSummary: 'live UI: settle worker-a',
            prompt: MK_WA,
          })
        case 1:
          return toolCall('team_delegate', {
            rootSessionId: ROOT,
            requestToken: `liveui-dlgb-${STAMP}`,
            delegationTemplateId: 'worker',
            label: 'worker-b',
            taskSummary: 'live UI: settle then archive worker-b',
            prompt: MK_WB,
          })
        case 2: {
          const id = extractInstanceId(tools[1]?.content)
          if (id === null) return { kind: 'text', content: `LIVEUI_EXTRACT_FAIL :: ${String(tools[1]?.content).slice(0, 300)}` }
          return toolCall('team_archive_member', {
            rootSessionId: ROOT,
            requestToken: `liveui-arch-${STAMP}`,
            targetInstanceId: id,
          })
        }
        case 3:
          return { kind: 'text', content: 'LIVEUI-TEAM-DONE: worker-a settled, worker-b archived.' }
        default:
          return { kind: 'text', content: `LIVEUI_FALLTHROUGH tools=${tools.length}` }
      }
    }
    return { kind: 'text', content: 'LIVEUI-NOOP' }
  }
}

// ── the drive poll: member lifecycles from the durable ledger ────────────
function memberLifecycles() {
  // member-lifecycle-changed facts: track the newest lifecycle per instance.
  const latest = new Map()
  for (const e of readDurableLedger()) {
    const ft = String(e.factType ?? '')
    if (!/lifecycle/i.test(ft)) continue
    const p = e.payload
    if (p === null || typeof p !== 'object') continue
    const instanceId = p.instanceId ?? p.targetInstanceId ?? p.memberInstanceId
    if (typeof instanceId !== 'string') continue
    const to = p.to ?? p.after ?? p.lifecycle ?? p.newLifecycle
    if (typeof to === 'string') latest.set(instanceId, to)
  }
  return Object.fromEntries(latest)
}
function driveSatisfied() {
  const l = memberLifecycles()
  const values = Object.values(l)
  return values.includes('SETTLED') && values.includes('ARCHIVED')
}

// ── main ─────────────────────────────────────────────────────────────────
let hostProc = null
let mock = null
let control = null
const STATE = { phase: 'setup', mockDecisions: 0, drive: { sent: false, done: false, detail: '' } }

async function main() {
  mkdirSync(RUN_DIR, { recursive: true })
  log(`live-ui world kit — branch=${BRANCH} worktree=${WORKTREE}`)
  log(`testuse=${TESTUSE} home=${HOME} runDir=${RUN_DIR}`)

  // ── preflight ──────────────────────────────────────────────────────────
  const head = gitOf(TESTUSE, ['rev-parse', 'HEAD']).trim()
  if (!head.startsWith(TESTUSE_PIN)) throw new Error(`test-use baseline drift: ${head} (want ${TESTUSE_PIN})`)
  const dirty = gitOf(TESTUSE, ['status', '--porcelain'])
  if (dirty !== '') throw new Error(`test-use not pristine:\n${dirty.slice(0, 400)}`)
  check('PRE', 'test-use pinned @ fb2c4b9e69 + byte-clean', true, head.slice(0, 12))
  for (const rel of [
    'packages/runtime/dist/packages/runtime/src/plugin/host.js',
    'cordis.patch.yml',
    'packages/client/composition-shim/client-bundle.js',
  ]) {
    if (!existsSync(join(WORKTREE, rel))) throw new Error(`worktree install surface missing: ${rel} (run the gate build first)`)
  }
  check('PRE', 'branch install surface built (runtime dist + bundle patch + client bundle)', true, '')
  const wtHead = gitOf(WORKTREE, ['rev-parse', 'HEAD']).trim()
  log(`worktree head: ${wtHead}`)
  const preStable = { p3080: await probeInstance(3080), p3180: await probeInstance(3180) }
  log(`ZERO-TOUCH probe :3080 pre: ${JSON.stringify(preStable.p3080)}`)
  log(`ZERO-TOUCH probe :3180 pre: ${JSON.stringify(preStable.p3180)}`)
  for (const [label, p] of [['host', PORT], ['mock', MOCK_PORT], ['control', CONTROL_PORT]]) {
    if (!(await isFree(p))) throw new Error(`port ${p} (${label}) busy`)
  }
  if (existsSync(HOME)) throw new Error(`world already exists (refusing to clobber): ${HOME}`)
  check('PRE', 'ports free (3180 family) + world fresh', true, `host=${PORT} mock=${MOCK_PORT} control=${CONTROL_PORT}`)

  // ── world layout ───────────────────────────────────────────────────────
  mkdirSync(WORKSPACE, { recursive: true })
  mkdirSync(WORLD_TMP, { recursive: true })
  mkdirSync(XDG, { recursive: true })
  mkdirSync(BLUEPRINT_DIR, { recursive: true })

  // ── install: bare clone + real-CLI git add ─────────────────────────────
  log(`bare repo: cloning ${MAIN_REPO} → ${REPO_GIT}`)
  const clone = spawnSync('git', ['clone', '--bare', MAIN_REPO, REPO_GIT], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
  if (clone.status !== 0) throw new Error(`git clone --bare failed: ${String(clone.stderr ?? clone.stdout).slice(0, 600)}`)
  log('bare repo cloned (local branches included)')

  const SPEC = `git+file:///${REPO_GIT.replace(/\\/g, '/')}#${BRANCH}`
  log(`installing: ${SPEC}`)
  const add = spawnSync(process.execPath, [BIN_JS, 'plugin', '--profile', 'web', 'add', SPEC], {
    cwd: HOME,
    env: { ...process.env, DSH_HOME: HOME, XDG_DATA_HOME: XDG },
    encoding: 'utf8',
    maxBuffer: 256 * 1024 * 1024,
  })
  const addOut = `${add.stdout ?? ''}${add.stderr ?? ''}`
  writeFileSync(SETUP_LOG, addOut)
  log(`plugin add exit=${add.status}`)
  check('INST', 'the real-CLI git install succeeds (prebuilt surface, zero lifecycle scripts)',
    add.status === 0 && !/ERR_PNPM_GIT_DEP_PREPARE_NOT_ALLOWED/.test(addOut),
    `exit=${add.status} tail=${addOut.slice(-200).replace(/\n/g, ' | ')}`)
  if (add.status !== 0) throw new Error('plugin add failed — aborting (setup log in evidence)')
  const profilePkg = JSON.parse(readFileSync(join(PROFILE_DIR, 'package.json'), 'utf8'))
  const bundles = profilePkg?.dsh?.profile?.bundles
  check('INST', 'dsh.profile.bundles AUTO-contains dsh-agent-team (bundle layer, no hand-written row)',
    Array.isArray(bundles) && bundles.includes('dsh-agent-team'), JSON.stringify(bundles))
  const userPatch = join(PROFILE_DIR, 'cordis.patch.yml')
  const userPatchText = existsSync(userPatch) ? readFileSync(userPatch, 'utf8') : ''
  if (/dsh-agent-team/.test(userPatchText)) throw new Error('profile patch already references dsh-agent-team before the config override — inspect manually')
  // The profile patch layer: override the host row's config (whole-config
  // replacement — the shipped bundle layer keeps the row ids/order).
  writeFileSync(userPatch, [
    `# live UI validation (${BRANCH_SHORT} ${STAMP}): override the dsh-agent-team`,
    '# host row config (boot team + scripted mock + preset). The bundle layer',
    '# itself installs the rows; this layer only replaces the config.',
    '- id: dsh-agent-team',
    hostRowConfigYaml(),
    '',
  ].join('\n'))
  writePreset()
  check('INST', 'profile config override + user preset written (boot team, mock staticModel, preset)', true, '')

  // ── mock model + host boot ─────────────────────────────────────────────
  const { startMockModel } = await import(pathToFileURL(join(WORKTREE, 'packages', 'tools', 'harness', 'mock-deepseek.mjs')).href)
  mock = await startMockModel({ port: MOCK_PORT, decide: makeDecide(STATE), log: (m) => log(`mock: ${m}`) })
  log(`mock model listening on 127.0.0.1:${MOCK_PORT}`)
  const outFd = openSync(INSTANCE_LOG, 'a')
  const errFd = openSync(INSTANCE_LOG, 'a')
  hostProc = spawn(process.execPath, [BIN_JS, 'web', '--port', String(PORT), '--no-open'], {
    cwd: WORKSPACE,
    env: {
      ...process.env,
      DSH_HOME: HOME,
      XDG_DATA_HOME: XDG,
      TMPDIR: WORLD_TMP,
      DSH_CLIENT_COMMIT_HASH: 'fb2c4b9e69',
      DEEPSEEK_BASE_URL: `http://127.0.0.1:${MOCK_PORT}`,
      DEEPSEEK_API_KEY: 'live-ui-validation-mock-key',
    },
    stdio: ['ignore', outFd, errFd],
  })
  closeSync(outFd)
  closeSync(errFd)
  log(`host spawned (pid=${hostProc.pid}, port=${PORT})`)

  const bootDeadline = Date.now() + 240000
  let booted = false
  while (Date.now() < bootDeadline) {
    if (existsSync(INSTANCE_LOG) && readFileSync(INSTANCE_LOG, 'utf8').includes('dsh web: http://')) { booted = true; break }
    await sleep(1000)
  }
  const logText = existsSync(INSTANCE_LOG) ? readFileSync(INSTANCE_LOG, 'utf8') : ''
  check('BOOT', 'the real host booted to the `dsh web:` marker', booted,
    booted ? '' : `logTail=${logText.split('\n').slice(-8).join(' | ').slice(0, 300)}`)
  if (!booted) throw new Error('host did not boot — aborting (instance log in evidence)')
  const moduleNotFound = logText.split('\n').filter((l) => l.includes('ERR_MODULE_NOT_FOUND'))
  check('BOOT', 'NO ERR_MODULE_NOT_FOUND in the instance log', moduleNotFound.length === 0, `hits=${moduleNotFound.length}`)

  const bootUrlLine = logText.split('\n').find((l) => l.includes('dsh web: http://')) ?? ''
  const m = /http:\/\/127\.0\.0\.1:\d+\/\?token=([A-Za-z0-9_-]+)/.exec(bootUrlLine)
  if (m === null) throw new Error(`no boot token in log: ${bootUrlLine.slice(0, 200)}`)
  const token = m[1]
  const origin = `http://127.0.0.1:${PORT}`
  const cookie = await authenticate(origin, token).catch((e) => { throw new Error(`auth failed: ${e.message}`) })
  check('BOOT', 'auth proven (303 + session cookie)', true, '')

  // ── root session (the Web UI's "New session" seam) ─────────────────────
  const created = await apiSessionCreate(origin, cookie, ROOT, WORKSPACE, PRESET_ID, 'liveui-root')
  check('SESS', 'root session created over the public session channel', created.status === 200,
    `status=${created.status} ${JSON.stringify(created.body).slice(0, 200)}`)

  writeFileSync(STATE_FILE, JSON.stringify({
    origin, port: PORT, token, cookie, world: HOME, runDir: RUN_DIR,
    instanceLog: INSTANCE_LOG, hostPid: hostProc.pid, branch: BRANCH, worktreeHead: wtHead,
    mockPort: MOCK_PORT, controlPort: CONTROL_PORT, markers: { MK_LEAD, MK_WA, MK_WB },
  }, null, 2))

  // ── control server (drive trigger + state poll for the browser agent) ──
  STATE.phase = 'ready'
  control = createServer((req, res) => {
    const send = (code, obj) => {
      res.writeHead(code, { 'content-type': 'application/json' })
      res.end(JSON.stringify(obj))
    }
    if (req.method === 'GET' && req.url === '/state') {
      const ledger = readDurableLedger()
      send(200, {
        ...STATE,
        memberLifecycles: memberLifecycles(),
        ledgerFacts: ledger.length,
        rawLifecycleFacts: ledger
          .filter((e) => /lifecycle/i.test(String(e.factType ?? '')))
          .slice(-8)
          .map((e) => ({ factType: e.factType, payload: e.payload })),
      })
    } else if (req.method === 'POST' && req.url === '/drive') {
      if (STATE.drive.sent === true) { send(409, { error: 'already driven' }); return }
      STATE.drive.sent = true
      send(202, { ok: true, note: 'leader prompt queued; poll /state for drive.done' })
      void (async () => {
        try {
          const pr = await apiPrompt(origin, cookie, ROOT, MK_LEAD, 'liveui-drive')
          STATE.drive.detail = `prompt status=${pr.status}`
          const deadline = Date.now() + 240000
          while (Date.now() < deadline) {
            if (driveSatisfied()) { STATE.drive.done = true; STATE.phase = 'driven'; return }
            await sleep(1000)
          }
          STATE.drive.detail += ' | TIMEOUT: member lifecycles never reached SETTLED+ARCHIVED'
          STATE.phase = 'drive-timeout'
        } catch (error) {
          STATE.drive.detail += ` | ERROR: ${String(error?.message ?? error).slice(0, 200)}`
          STATE.phase = 'drive-error'
        }
      })()
    } else {
      send(404, { error: 'not found' })
    }
  })
  await new Promise((res, rej) => { control.once('error', rej); control.listen(CONTROL_PORT, '127.0.0.1', () => res()) })
  log(`control server on 127.0.0.1:${CONTROL_PORT}`)
  log(`READY origin=${origin} token=${token} world=${HOME}`)

  // ── wait for the browser scenarios, then teardown ──────────────────────
  const waitDeadline = Date.now() + 30 * 60 * 1000
  while (Date.now() < waitDeadline && !existsSync(join(HOME, 'SCENARIOS-DONE'))) {
    await sleep(2000)
  }
  log(`scenarios-done: ${existsSync(join(HOME, 'SCENARIOS-DONE'))} — tearing down`)
  STATE.phase = 'teardown'
  try { hostProc?.kill('SIGTERM') } catch { /* already dead */ }
  let done = false
  const waiter = new Promise((res) => { hostProc?.once('exit', () => { done = true; res() }); setTimeout(() => res(), 20000).unref() })
  while (!done && Date.now() < Date.now() + 20000) await sleep(200)
  if (!done) { try { hostProc?.kill('SIGKILL') } catch { /* already dead */ } await waiter }
  if (mock !== null) { try { await mock.close() } catch { /* already closed */ } mock = null }
  try { control?.close() } catch { /* already closed */ }

  const postStable = { p3080: await probeInstance(3080), p3180: await probeInstance(3180) }
  log(`ZERO-TOUCH probe :3080 post: ${JSON.stringify(postStable.p3080)}`)
  log(`ZERO-TOUCH probe :3180 post: ${JSON.stringify(postStable.p3180)}`)
  check('POST', 'stable instances :3080/:3180 unchanged (read-only probes pre == post)',
    JSON.stringify(preStable) === JSON.stringify(postStable),
    `pre=${JSON.stringify(preStable)} post=${JSON.stringify(postStable)}`)
  let testuseClean = true
  try { testuseClean = gitOf(TESTUSE, ['status', '--porcelain']) === '' } catch { testuseClean = false }
  check('POST', 'test-use working tree byte-clean after the run', testuseClean, '')
  // Ports released (the host is dead; assert nothing listens on our ports).
  check('POST', 'host port released after teardown', (await isFree(PORT)) === true, `port=${PORT}`)

  const summary = {
    verdict: CRITERIA.every((c) => c.ok) ? 'PASS' : 'FAIL',
    branch: BRANCH, worktreeHead: wtHead,
    origin, port: PORT, world: HOME,
    drive: STATE.drive,
    memberLifecyclesAtTeardown: memberLifecycles(),
    mockDecisions: STATE.mockDecisions,
    criteria: CRITERIA,
    preStable, postStable,
    worldRetained: KEEP,
  }
  writeFileSync(join(RUN_DIR, 'summary.json'), JSON.stringify(summary, null, 2))
  if (KEEP) {
    log(`--keep: world retained at ${HOME}`)
  } else {
    rmSync(HOME, { recursive: true, force: true })
    log(`world removed: ${HOME} (evidence retained in ${RUN_DIR})`)
  }
  process.exit(summary.verdict === 'PASS' ? 0 : 1)
}

main().catch((e) => {
  console.error(`kit fatal: ${e?.stack ?? e}`)
  try { hostProc?.kill('SIGKILL') } catch { /* n/a */ }
  if (mock !== null) { try { void mock.close() } catch { /* n/a */ } }
  process.exit(1)
})
