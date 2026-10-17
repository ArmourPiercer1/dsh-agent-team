#!/usr/bin/env node
/**
 * a5w7m-kit.mjs — Alpha.5 W7M (M-13 Domain-veto) real-Host kit: the pr8 M-13
 * RLW line's missing observation legs, assembled on the PINNED host
 * (0.2.0-rc.2 @ `639ed01539`; `tests/paths.mjs` is the single source), on
 * port **3184** (self-proved free at boot; :3080 read-only probed, never
 * operated), world `tests/homes/a5w7m-<stamp>` (naming/cleanup per
 * TEST_METHODS §7). Sibling of — and with ZERO edits to — the reviewed W7
 * kit (`a5-w7-jobs-wiring`, its 22/22 baseline stays runnable unchanged).
 *
 * WHAT THIS PROVES, and only this (leg → pr8 M-13 assertion):
 *
 *   M1 assembly    the row boots the jobs-gateway from the lane's PUBLIC
 *                  BARREL IN REPO DIST (GLUE-1 build include @933f2f5d —
 *                  no kit-local compile), inside the live Host process.
 *   M2 face        the session's live tool surface carries the host's own
 *                  public jobs face (`job_list`/`job_output`/`job_kill` +
 *                  `bash` with `run_in_background`) — the JOPS-CAPABILITY-
 *                  RECHECK (a)-layer path, file:line-verified on the pinned
 *                  tree this run (M6b), not quoted from memory.
 *   M3 identity    two governed members exist as durable host-generated
 *                  MemberInstance rows (the TeamPermit leg admits against
 *                  these HOST facts, same read W7 used).
 *   M5 veto        the 4-cell `TeamPermit × DomainPermit` matrix, each cell
 *                  adjudicated at the ONE effect-commit gate inside the
 *                  row: TeamPermit = the live gateway's own admitJob verdict;
 *                  DomainPermit = the row-local Domain mock's armed bit.
 *                  A1: Team-refused × Domain-allowed ⇒ denied (the domain
 *                  allow cannot override). A2: Domain-refused × Team-allowed
 *                  ⇒ denied with the REGISTERED name DOMAIN_DENIED (IF-6 —
 *                  zero new names). T+D+ grants, T-D- denies.
 *   M6 allow       the granted cell's effect crosses a REAL process
 *                  boundary on the host's own path: `bash run_in_background`
 *                  (model tool call in the live session) really registers a
 *                  job in the host registry, `job_list` really lists it,
 *                  `job_output` really collects the command's output.
 *   M7 veto-zero   A3 measured, not claimed: the row's interlock ledger
 *                  shows ZERO effect commits for veto cells (device CAS
 *                  version delta attributable ONLY to the granted cell),
 *                  AND the host's public `job_list` face — the same face
 *                  that just showed the granted cell's real job — carries
 *                  ZERO veto-cell entries. `veto_side_effects = 0`.
 *   M8 negctrl     A4 fail-closed: with BOTH permits true and a genuine
 *                  team admit, an UNRESOLVED domain reference (never
 *                  registered) and a WITHDRAWN one are typed denies — the
 *                  binding is never guessed; a stale CAS version is
 *                  interlock-refused with the device untouched.
 *   M9 lease       every admitted gateway job settles while ACTIVE; drain
 *                  at self-counted zero reaches RELEASED (hygiene, same law
 *                  W7 proved).
 *   M10 anchor     `job_start` stays absent (pre AND post host-tree grep,
 *                  roster carries no job-start-shaped name): this kit adds
 *                  NO host tool and fakes no host Jobs face; the Domain
 *                  side is a DISCLOSED row-local mock — the S0 test
 *                  requirement ("Domain mock CAS/模拟设备") that this line
 *                  itself asked for.
 *   M11 receipt    the pr8 receipt (M-13) is emitted with the probe's
 *                  closed observation fields; every `evidence_refs` entry
 *                  is re-checked to exist under the repo root (F-1).
 *   M12 discipline :3080 reads the same before/after and was never
 *                  operated; no launch token reaches an artifact; the world
 *                  is removed and verified; the pinned tree stays clean and
 *                  the dist barrel is byte-identical after the run.
 *
 * Mechanism: the public profile-patch seam only (production `dsh-agent-team`
 * row from this worktree's built dist + the p6t6 observer + the a5w7m row;
 * sessions run the SHIPPED `standard` preset — the same face the host ships,
 * its leader governed to the L1 dual-gate OPEN shape the exec-contract kit
 * established, so the allow-leg `bash` executes with zero user-approval
 * rows). Mock model only (`packages/tools/harness/mock-deepseek.mjs`), no
 * real key. Every wait <= 180 s, storm fuse at 300 requests. Credentials
 * redacted AT CAPTURE. Host killed only by its recorded pid on the recorded
 * port.
 *
 * EXIT: 0 = every criterion passed; 2 = a criterion failed; 1 = fatal.
 */
import { createHash } from 'node:crypto'
import { spawn, spawnSync } from 'node:child_process'
import { closeSync, existsSync, mkdirSync, openSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { presetDeclarationRow, smokePresetPlugins } from '../_shared/preset-seam.mjs'
import { startMockModel } from '../../../packages/tools/harness/mock-deepseek.mjs'
import { CLIENT_COMMIT_HASH, TEST_USE_BASELINE_SHA, DSH_BASELINE_VERSION, STABLE_INSTANCE_PORT, testUseTree, homeDir } from '../../paths.mjs'

// ── CLI / layout ────────────────────────────────────────────────────────────
const args = process.argv.slice(2)
const FLAG_KEEP = args.includes('--keep')
/** RED control: boot the world WITHOUT the a5w7m row — every leg below then
 *  fails on its own 404 and the criteria table names what the wiring owes. */
const RED_NO_ROW = args.includes('--without-row')
const KIT_DIR = dirname(new URL(import.meta.url).pathname)
const REPO_ROOT = resolve(KIT_DIR, '..', '..', '..')
const TESTUSE = testUseTree(REPO_ROOT)
const RUN_STAMP = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
const RUN_DIR = args.includes('--evidence-dir') ? resolve(args[args.indexOf('--evidence-dir') + 1]) : join(KIT_DIR, `run-${RUN_STAMP}`)
const RUN_DIR_REL = relative(REPO_ROOT, RUN_DIR).split('\\').join('/')
if (RUN_DIR_REL.startsWith('..')) {
  console.error(`--evidence-dir must live inside the repo root (receipt evidence_refs must be repo-relative; got ${RUN_DIR})`)
  process.exit(1)
}
const WORLD_PREFIX = args.includes('--world-prefix') ? args[args.indexOf('--world-prefix') + 1] : 'a5w7m'
const HOME = homeDir(REPO_ROOT, `${WORLD_PREFIX}-${RUN_STAMP}`)
const WORKSPACE = join(HOME, 'workspace')
const LEDGER = join(RUN_DIR, 'veto-ledger.jsonl')
const BLUEPRINT_DIR = join(RUN_DIR, 'blueprints')
const INSTANCE_LOG = join(RUN_DIR, 'instance.log')
const INSTANCE_RAW = join(RUN_DIR, 'host-stdout.raw')
const HOST_PORT = args.includes('--port') ? Number(args[args.indexOf('--port') + 1]) : 3184
const EMIT_RECEIPT = args.includes('--emit-receipt') ? args[args.indexOf('--emit-receipt') + 1] : null

const DIST_RUNTIME = join(REPO_ROOT, 'packages', 'runtime', 'dist', 'packages', 'runtime')
const BARREL = join(DIST_RUNTIME, 'jobs-gateway', 'index.js')
const HOST_BIN = join(TESTUSE, 'apps', 'cli', 'lib', 'bin.js')
const PRODUCTION_ROW_NAME = pathToFileURL(join(DIST_RUNTIME, 'src', 'plugin', 'host.js')).href
const GLUE_URL = pathToFileURL(join(DIST_RUNTIME, 'src', 'plugin', 'live', 'agent-bindings.mjs')).href
const SEAM_URL = pathToFileURL(join(REPO_ROOT, 'packages', 'runtime', 'root-binding', 'harness', 'seam.mjs')).href
const P6T6_ROW_NAME = pathToFileURL(join(REPO_ROOT, 'packages', 'tools', 'harness', 'plugin.mjs')).href
const W7M_ROW_NAME = pathToFileURL(join(KIT_DIR, 'a5w7m-veto-plugin.mjs')).href

const PRESET_ID = 'a5w7m-base' // kit-local smoke-face preset for the TEAM sessions — coverage-safe:
// the lane's OWN Permission Coverage Gate (packages/runtime/operation-permission/
// permission-coverage.ts, six-class closed union) classifies the job_ family as
// KNOWN_SENSITIVE_UNMANAGED = FATAL on any governed surface, so a governed team
// session structurally CANNOT carry the host job face. The (a)-layer allow leg runs
// on a PLAIN ordinary host session (public session.create, shipped default face,
// outside team governance) — exactly where JOPS-CAPABILITY-RECHECK places the (a)
// layer: bash run_in_background + ctx.jobs + job_* on the host's own plane.
const PLAIN_SESSION = `session-a5w7m-plain-${RUN_STAMP}`
const ROOT = `session-a5w7m-root-${RUN_STAMP}`
const CREATE_ROOT = `session-a5w7m-team-${RUN_STAMP}`
const BP_ANCHOR_ID = 'team.a5w7m.anchor'
const BP_MAIN_ID = 'team.a5w7m.main'
const MK_DISC = `A5W7M_DISC_${RUN_STAMP}`
const MK_L1 = `A5W7M_L1_${RUN_STAMP}`
const MK_ALLOW = `A5W7M_ALLOW_${RUN_STAMP}`
const MK_EFFECT = `A5W7M_EFFECT_${RUN_STAMP}`
const MK_EFFECT_END = `${MK_EFFECT}_END`
const VETO_MARK = 'A5W7M_VETO_'
/** Kit-local tool identity used as the gateway's definition subject (row-local
 *  store — disclosed; NOT a host tool, and NOT named `job_start` on purpose). */
const DEF_TOOL = 'a5w7m_tool'
const HELD_JOB = `a5w7m-held-${RUN_STAMP}`
const CELL_TT = 'cell-TT'; const CELL_TF = 'cell-TF'; const CELL_FT = 'cell-FT'; const CELL_FF = 'cell-FF'

// ── logging / criteria / redaction ──────────────────────────────────────────
mkdirSync(RUN_DIR, { recursive: true })
const RUN_LOG = join(RUN_DIR, 'kit.log')
function log(line) {
  const stamped = `[${new Date().toISOString()}] ${line}`
  console.log(stamped)
  try { writeFileSync(RUN_LOG, stamped + '\n', { flag: 'a' }) } catch { /* best-effort */ }
}
const criteria = []
function check(id, name, ok, detail) {
  criteria.push({ id, name, ok: ok === true, detail: redact(String(detail ?? '')).slice(0, 900) })
  log(`${ok === true ? 'PASS' : 'FAIL'} ${id}: ${name}${detail === undefined ? '' : ` — ${redact(String(detail)).slice(0, 400)}`}`)
  return ok === true
}
const hex8 = (value) => createHash('sha256').update(String(value)).digest('hex').slice(0, 8)
const REDACT = [
  [/(https?:\/\/[^\s"'`]+?\?token=)([A-Za-z0-9_-]{8,})/g, (_m, head, tok) => head + '<REDACTED-' + hex8(tok) + '>'],
  [/(dsh-auth-[A-Za-z0-9_-]{6,}=)([A-Za-z0-9._\-%=]{6,})/g, (_m, head, tok) => 'dsh-auth-<REDACTED>=<REDACTED-' + hex8(tok) + '>'],
  [/\bBearer\s+([A-Za-z0-9._-]{6,})/gi, (_m, tok) => 'Bearer <REDACTED-' + hex8(tok) + '>'],
]
function redact(text) {
  let out = String(text)
  for (const [re, repl] of REDACT) out = out.replace(re, repl)
  return out
}
function logTail(logPath, n = 25) {
  try { return redact(readFileSync(logPath, 'utf8').split('\n').slice(-n).join('\n')) } catch { return '<no log>' }
}
function writeEvidence(name, content) {
  try {
    writeFileSync(join(RUN_DIR, name), redact(typeof content === 'string' ? content : JSON.stringify(content, null, 2)))
  } catch { /* best-effort */ }
}

let CURRENT_HOST = undefined
function signalProbe(pid) {
  try {
    process.kill(pid, 0)
    return 'alive'
  } catch (error) {
    return String(error?.code ?? error) === 'ESRCH' ? 'gone' : `probe error ${String(error?.code ?? error)}`
  }
}
function sleepSync(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms)
}
function sealHostLog() {
  if (!existsSync(INSTANCE_RAW)) return
  try {
    writeFileSync(INSTANCE_LOG, redact(readFileSync(INSTANCE_RAW, 'utf8')))
    rmSync(INSTANCE_RAW, { force: true })
  } catch { /* a log is never a reason to lose the run */ }
}
function sweepWorld() {
  if (FLAG_KEEP) return 'kept (--keep)'
  if (!existsSync(HOME)) return 'absent'
  try {
    rmSync(HOME, { recursive: true, force: true })
    return existsSync(HOME) ? 'removal FAILED' : 'removed'
  } catch (error) {
    return 'removal FAILED: ' + String(error?.message ?? error)
  }
}
function dieFatal(msg, code = 1) {
  log(`FATAL ${redact(msg)}`)
  let stopped = 'no host was started'
  if (CURRENT_HOST !== undefined && CURRENT_HOST.pid !== undefined) {
    const pid = CURRENT_HOST.pid
    stopHost(CURRENT_HOST)
    stopped = signalProbe(pid) === 'gone' ? 'stopped (SIGTERM)' : 'SIGTERM sent; process still answering signals'
    if (stopped !== 'stopped (SIGTERM)') {
      try { process.kill(pid, 'SIGKILL') } catch { /* already gone */ }
      sleepSync(250)
      stopped = signalProbe(pid) === 'gone' ? 'stopped (SIGTERM escalated to SIGKILL)' : 'SIGKILL sent (unreaped direct child)'
    }
  }
  const world = sweepWorld()
  sleepSync(500)
  const verified = existsSync(HOME) ? 'FAIL: world STILL PRESENT after the sweep' : 'verified absent (re-checked 500 ms after the sweep)'
  log(`FATAL cleanup: host=${stopped} world=${world} residue=${verified}`)
  sealHostLog()
  writeEvidence('summary.json', { runStamp: RUN_STAMP, fatal: redact(String(msg)), cleanup: { host: stopped, world, residue: verified, home: HOME }, criteria })
  process.exit(code)
}

// ── http ─────────────────────────────────────────────────────────────────────
async function fetchJson(url, init, timeoutMs = 180_000) {
  const res = await fetch(url, { ...init, signal: AbortSignal.timeout(timeoutMs) }).catch((e) => ({ status: 0, error: e.message }))
  const body = res.status === 0 ? null : await res.json().catch(() => null)
  return { status: res.status, body }
}
async function probeStableInstance() {
  const res = await fetch(`http://127.0.0.1:${STABLE_INSTANCE_PORT}/`, { signal: AbortSignal.timeout(5_000) }).catch(() => null)
  return { port: STABLE_INSTANCE_PORT, status: res === null ? 'unreachable' : res.status, operated: false }
}
async function authenticate(origin, token) {
  const res = await fetch(`${origin}/?token=${token}`, { redirect: 'manual', signal: AbortSignal.timeout(30_000) })
  const setCookie = res.headers.get('set-cookie')
  if (res.status !== 303 || setCookie === null) throw new Error(`authentication returned ${String(res.status)} (expected 303 + set-cookie)`)
  return setCookie.split(';', 1)[0]
}
async function remoteCall(origin, cookie, method, params, tag = 'a5w7m') {
  return fetchJson(`${origin}/team-remote/${method}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie },
    body: JSON.stringify({ type: 'client-request', rpcId: `${tag}-${Math.random().toString(36).slice(2, 12)}`, method, payload: { version: 1, params } }),
  })
}
async function apiPrompt(origin, cookie, sessionId, text, tag = 'a5w7m') {
  return fetchJson(`${origin}/api/session/prompt`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie },
    body: JSON.stringify({
      type: 'client-request',
      rpcId: `${tag}-${Math.random().toString(36).slice(2, 12)}`,
      method: 'session/prompt',
      payload: { args: { request: { requestId: `${tag}-r-${Math.random().toString(36).slice(2, 10)}`, sessionId, mode: 'queue', content: [{ type: 'text', text }] } } },
    }),
  })
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

// ── yaml emitter (the a5p1/rc2-copied writer; two YAML writers is how drift starts) ─
function yamlScalar(v) { return v === null ? 'null' : typeof v === 'string' ? JSON.stringify(v) : String(v) }
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
  const entries = Object.entries(item)
  const [firstKey, firstValue] = entries[0]
  const firstLines = yamlEmit(firstKey, firstValue, indent + 1)
  const rest = entries.slice(1).flatMap(([k, v]) => yamlEmit(k, v, indent + 1))
  return [`${pad}- ${firstLines[0].slice((indent + 1) * 2)}`, ...firstLines.slice(1), ...rest]
}

function teamRowConfig() {
  return {
    rootSessionId: ROOT,
    bootPhase: 'create',
    blueprintSource: BP_ANCHOR_YAML,
    blueprintDir: BLUEPRINT_DIR,
    rootPresetId: PRESET_ID,
    memberPresetId: PRESET_ID,
    seedMembers: [],
    generation: 1,
    staticModel: { provider: 'deepseek-official', model: 'a5w7m-model' },
    deniedSelection: null,
    mcpServers: [],
    mcpServer: null,
    environmentFacts: [
      { domain: 'tool', subject: 'web', available: true, generation: 1 },
      { domain: 'skill', subject: 'base', available: true, generation: 1 },
      { domain: 'persona', subject: 'standard', available: true, generation: 1 },
    ],
    externalPolicyFacts: { hard: {}, capabilityExists: {} },
    glueUrl: GLUE_URL,
    seamUrl: SEAM_URL,
  }
}

/**
 * The boot-root anchor: the governed team world (root + member templates).
 * The leader does NOT run the allow leg — the lane's own coverage gate makes
 * job_* impossible on any governed surface — so the anchor stays the minimal
 * coverage-safe shape (smoke preset face: managed + team_* only).
 */
const BP_ANCHOR_YAML = [
  '---', 'schemaVersion: 3', `blueprintId: ${BP_ANCHOR_ID}`, 'revision: "1"',
  'leader:', '  templateId: leader',
  `  persona: "You are the leader of the a5w7m domain-veto team. ${MK_DISC} is the discovery marker."`,
  '  capabilities:',
  '    teamTools:', '      kind: allow', '      items: []',
  '    builtinToolDeny: []',
  '    skills:', '      kind: allow', '      items: []',
  '    mcp:', '      kind: allow', '      items: []',
  '    permissions:', '      default: ask', '      allow: []', '      ask: []', '      deny: []',
  'teamEnvelope:', '  allow:', '    - send-message', '    - report-progress', '    - request-control', '    - resolve-control', '  deny: []',
  'members:', '  - templateId: wa', '    persona: "You are a worker of the a5w7m domain-veto team."',
  'memberEnvelopes: []', 'requirements: []', 'permissionMutationEnvelope:', '  rules: []',
  'teamHardEnvelope:', '  rules: []', 'policyStates: []', 'metadata: {}', '---', '',
].join('\n')

function savedBlueprintYaml(denyList) {
  const denyLines = denyList.length === 0 ? ['    builtinToolDeny: []'] : ['    builtinToolDeny:', ...denyList.map((n) => `      - ${n}`)]
  return [
    '---', 'schemaVersion: 3', `blueprintId: ${BP_MAIN_ID}`, 'revision: "1"',
    'leader:', '  templateId: leader',
    `  persona: ${JSON.stringify(`You are the leader of the a5w7m domain-veto team. ${MK_L1} drives your chain: create one worker from template wa and one from template wb, then finish.`)}`,
    '  capabilities:', '    teamTools:', '      kind: allow', '      items:',
    '        - team_list_members', '        - team_create_member',
    ...denyLines,
    '    skills:', '      kind: allow', '      items: []',
    '    mcp:', '      kind: allow', '      items: []',
    '    permissions:', '      default: ask', '      allow: []', '      ask: []', '      deny: []',
    'teamEnvelope:', '  allow:', '    - create-member', '    - send-message', '    - report-progress', '  deny: []',
    'members:',
    '  - templateId: wa', '    displayName: "a5w7m worker A"',
    `    persona: ${JSON.stringify('You are worker A of the a5w7m domain-veto team. No tasks are delegated to you in this run.')}`,
    '  - templateId: wb', '    displayName: "a5w7m worker B"',
    `    persona: ${JSON.stringify('You are worker B of the a5w7m domain-veto team. No tasks are delegated to you in this run.')}`,
    'memberEnvelopes:',
    '  - templateId: wa', '    envelope:', '      allow:', '        - send-message', '        - report-progress', '      deny: []',
    '  - templateId: wb', '    envelope:', '      allow:', '        - send-message', '        - report-progress', '      deny: []',
    'permissionMutationEnvelope:', '  rules: []', 'teamHardEnvelope:', '  rules: []',
    'policyStates: []', 'metadata: {}', '---', '',
  ].join('\n')
}

function writePatchFile(home) {
  mkdirSync(join(home, 'profiles', 'web'), { recursive: true })
  const basePlugins = smokePresetPlugins({
    personaText: 'You are a coding agent powered by the {{model}} model.',
    cwdSuffix: 'Your working directory is {{cwd}}.',
    bashDescription: 'Run commands in a bash shell. State is persistent across calls.',
  })
  const lines = [
    `# a5w7m W7M patch layer (run ${RUN_STAMP}): production dsh-agent-team row (this worktree's dist) + p6t6 observer + the a5w7m domain-veto row (lane PUBLIC BARREL = repo dist, GLUE-1) + one preset — public profile-patch seam only. TEAM sessions run the kit preset (coverage-safe); the (a)-layer allow leg runs on a PLAIN ordinary session (session.create → shipped default face, outside team governance).`,
    '- insert:',
    ...yamlEmitItem({ id: 'dsh-agent-team', name: PRODUCTION_ROW_NAME, config: teamRowConfig() }, 2),
    ...yamlEmitItem({ id: 'p6t6-team-tools', name: P6T6_ROW_NAME }, 2),
    ...(RED_NO_ROW ? [] : [
      ...yamlEmitItem({ id: 'a5w7m-veto', name: W7M_ROW_NAME }, 2),
    ]),
    ...yamlEmitItem(presetDeclarationRow({
      id: PRESET_ID, displayName: 'a5w7m base',
      description: `a5w7m base preset (run ${RUN_STAMP}) = smoke preset (coverage-safe team face)`,
      plugins: basePlugins,
    }), 2),
    '',
  ]
  writeFileSync(join(home, 'profiles', 'web', 'cordis.patch.yml'), lines.join('\n'))
}

// ── host boot ───────────────────────────────────────────────────────────────
function spawnHost({ port, home, mockPort, gatewayUrl }) {
  const outFd = openSync(INSTANCE_RAW, 'a')
  const errFd = openSync(INSTANCE_RAW, 'a')
  let child
  try {
    child = spawn(process.execPath, [HOST_BIN, 'web', '--port', String(port), '--no-open'], {
      cwd: WORKSPACE,
      stdio: ['ignore', outFd, errFd],
      env: {
        ...process.env,
        DSH_HOME: home,
        DSH_CLIENT_COMMIT_HASH: CLIENT_COMMIT_HASH,
        DEEPSEEK_BASE_URL: `http://127.0.0.1:${mockPort}`,
        DEEPSEEK_API_KEY: 'a5w7m-mock-key',
        // Public deployment knob (the base web-app patch layer reads DSH_PERMISSION_MODE
        // for the host approval policy: danger-full-access ⇒ policy 'never'). The
        // allow leg must traverse the host's OWN approval layer headlessly; the
        // leg's commands are echo/sleep only. Disclosed in receipt + kit.log.
        DSH_PERMISSION_MODE: 'danger-full-access',
        A5W7M_DIRECTIVE: join(home, 'a5w7m-directive.json'),
      },
    })
  } catch (error) {
    closeSync(outFd); closeSync(errFd)
    throw new Error(`host spawn failed: ${error.message}`)
  } finally {
    closeSync(outFd); closeSync(errFd)
  }
  const exitInfo = { exited: false, code: undefined, signal: undefined }
  child.on('error', () => { exitInfo.exited = true; exitInfo.signal = 'spawn-error' })
  child.on('close', (code, signal) => { exitInfo.exited = true; exitInfo.code = code; exitInfo.signal = signal })
  return { pid: child.pid, exitInfo, alive: () => !exitInfo.exited, logPath: INSTANCE_LOG }
}
function stopHost(h) {
  try { if (h?.pid !== undefined) process.kill(h.pid) } catch { /* already gone */ }
}

// ── mock model: leader creates members; the allow leg runs the REAL host
//    tool chain (bash run_in_background -> job_list -> job_output) ────────────
const toolCall = (name, argsObj) => ({
  kind: 'tool-call',
  toolCalls: [{ id: `call-a5w7m-${Math.random().toString(36).slice(2, 10)}`, name, arguments: argsObj }],
})
function bodyOf(rec) { return rec === null || typeof rec !== 'object' ? null : ('body' in rec ? (rec.body ?? null) : rec) }
function messagesOf(req) { return bodyOf(req)?.messages ?? [] }
function textOf(m) { return typeof m?.content === 'string' ? m.content : JSON.stringify(m.content ?? '') }
function hasMarker(req, marker) { return messagesOf(req).some((m) => textOf(m).includes(marker)) }
function surfaceNamesOf(req) { return (bodyOf(req)?.tools ?? []).map((t) => String(t?.name ?? '')).filter((n) => n !== '') }
function toolMsgsOf(req) {
  const out = []
  for (const m of messagesOf(req)) {
    for (const b of Array.isArray(m?.content) ? m.content : []) {
      if (b?.type === 'tool_result') out.push({ text: (Array.isArray(b.content) ? b.content : []).map((c) => c?.text ?? '').join(''), isError: b.is_error === true })
    }
  }
  return out
}
function extractInstanceId(content) {
  const m = /"targetInstanceId"\s*:\s*"([^"]+)"/.exec(String(content))
    ?? /"instanceId"\s*:\s*"([^"]+)"/.exec(String(content))
    ?? /inst-[A-Za-z0-9][A-Za-z0-9-]{3,64}/.exec(String(content))
  return m === null ? null : (m[1] ?? m[0])
}
/** Pull a job id out of the host `job_list` render (`<id> [kind] status — label`). */
function parseJobId(jobListText) {
  for (const line of String(jobListText).split('\n')) {
    const m = /^(\S+)\s+\[/.exec(line.trim())
    if (m !== null) return { id: m[1], line: line.trim() }
  }
  return null
}
function laneOf(req) {
  const t = messagesOf(req).map(textOf).join('\n')
  if (t.includes('Generate the session title')) return 'title'
  if (t.includes(MK_ALLOW)) return 'allow'
  if (t.includes(MK_DISC)) return 'disc'
  if (t.includes(MK_L1)) return 'leader'
  return 'other'
}
function makeDecide() {
  const steps = { leader: 0 }
  return function decide({ req }) {
    const lane = laneOf(req)
    if (lane === 'title') return { kind: 'text', content: 'a5w7m domain veto session' }
    if (lane === 'disc' || lane === 'other') return { kind: 'text', content: 'A5W7M_NOOP_DONE' }
    if (lane === 'allow') {
      // The chain state is the tool_result count the HOST has appended —
      // every step is driven by a REAL tool result crossing the real
      // tool boundary. No step is assumed; each waits for its evidence.
      const results = toolMsgsOf(req)
      const n = results.length
      if (n === 0) return toolCall('bash', { command: `echo ${MK_EFFECT} && sleep 1 && echo ${MK_EFFECT_END}`, description: 'a5w7m allow-leg background echo', run_in_background: true })
      if (n === 1) return toolCall('job_list', {})
      const listed = parseJobId(results[1]?.text ?? '')
      if (listed === null) return { kind: 'text', content: 'A5W7M_ALLOW_NOJOB' }
      if (n === 2) return toolCall('job_output', { job_id: listed.id, wait: true })
      if (results.some((r) => r.text.includes(MK_EFFECT_END))) return { kind: 'text', content: 'A5W7M_ALLOW_DONE' }
      if (n < 6) return toolCall('job_output', { job_id: listed.id, wait: true })
      return { kind: 'text', content: 'A5W7M_ALLOW_TIMEOUT' }
    }
    const step = steps.leader
    steps.leader += 1
    const token = (x) => `a5w7m-${x}-${RUN_STAMP}`
    switch (step) {
      case 0: return toolCall('team_create_member', { rootSessionId: CREATE_ROOT, requestToken: token('ca'), delegationTemplateId: 'wa', label: 'w7m-a' })
      case 1: return toolCall('team_create_member', { rootSessionId: CREATE_ROOT, requestToken: token('cb'), delegationTemplateId: 'wb', label: 'w7m-b' })
      default: return { kind: 'text', content: 'A5W7M_L1_DONE' }
    }
  }
}
async function waitForMock(mock, pred, timeoutMs, label, nth = 1) {
  const deadline = Date.now() + timeoutMs
  for (;;) {
    const all = mock.requests.filter(pred)
    if (all[nth - 1] !== undefined) return all[nth - 1]
    if (mock.requests.length > 300) { log(`mock storm fuse tripped (${label}, requests=${String(mock.requests.length)})`); return null }
    if (Date.now() >= deadline) { log(`mock wait timed out: ${label} (requests=${String(mock.requests.length)})`); return null }
    await new Promise((r) => setTimeout(r, 400))
  }
}

// ── helpers ─────────────────────────────────────────────────────────────────
const MANAGED_TOOL_NAMES = ['read', 'read_image', 'write', 'edit', 'lsp', 'bash', 'pwsh']
const SAFE_UNMANAGED_TOOL_NAMES = ['todo_write']

async function op(origin, opName, opArgs = {}) {
  return fetchJson(`${origin}/__a5w7m/op`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ op: opName, args: opArgs }),
  }, 30_000)
}
const settleEvent = (jobId) => ({ event: 'dispatcher-call-cancelled-before-body', callId: jobId, abortIssuedBy: 'lane-settle-hygiene' })

/** `job_start` across the whole host tree: count only (the tree is huge and
 *  read-only; the count is the pinned absent-anchor fact). */
function anchorGrep() {
  const r = spawnSync('grep', ['-r', '-n', '--include=*.ts', '--include=*.js', '--include=*.mjs', '--include=*.json', '--include=*.md', 'job_start', TESTUSE], { encoding: 'utf8', timeout: 240_000 })
  const lines = String(r.stdout ?? '').split('\n').filter((l) => l.trim() !== '')
  const head = spawnSync('git', ['-C', TESTUSE, 'rev-parse', 'HEAD'], { encoding: 'utf8' })
  const porcelain = spawnSync('git', ['-C', TESTUSE, 'status', '--porcelain'], { encoding: 'utf8' })
  return {
    hits: lines.length,
    sample: lines.slice(0, 5),
    treeHead: String(head.stdout ?? '').trim(),
    treePorcelainLines: String(porcelain.stdout ?? '').split('\n').filter((l) => l.trim() !== '').length,
  }
}

/** The JOPS (a)-layer public-path anchors, VERIFIED against the pinned tree
 *  this run (read-only): every entry is `file` + grep-derived `line` + the
 *  verbatim line text. A quoted line that does not match the tree is a FAIL,
 *  never a silently stale citation. */
function verifyHostFaceAnchors() {
  const NEEDLES = [
    { key: 'bash.run_in_background_schema', file: 'packages/shell/tool-bash/src/index.ts', needle: 'run_in_background: { type: \'boolean\'' },
    { key: 'bash.run_in_background_exec', file: 'packages/shell/tool-bash/src/index.ts', needle: 'if (args.run_in_background === true) {' },
    { key: 'bash.registry_required', file: 'packages/shell/tool-bash/src/index.ts', needle: 'background jobs unavailable: load @deepseek-ai/dsh-jobs' },
    { key: 'tool_jobs.job_output', file: 'packages/jobs/tool-jobs/src/index.ts', needle: 'name: \'job_output\'' },
    { key: 'tool_jobs.job_list', file: 'packages/jobs/tool-jobs/src/index.ts', needle: 'name: \'job_list\'' },
    { key: 'tool_jobs.job_kill', file: 'packages/jobs/tool-jobs/src/index.ts', needle: 'name: \'job_kill\'' },
    { key: 'bundle.jobs_provider', file: 'packages/bundle/base/cordis.patch.yml', needle: '\'@deepseek-ai/dsh-jobs-local\'' },
    { key: 'bundle.tool_jobs', file: 'packages/bundle/base/cordis.patch.yml', needle: '\'@deepseek-ai/dsh-tool-jobs\'' },
    { key: 'remote.job_namespace', file: 'packages/api/job-controller/src/index.ts', needle: 'namespace: \'job\'' },
    { key: 'preset.standard_tool_jobs', file: 'packages/bundle/web-app/presets/standard.patch.yml', needle: '\'@deepseek-ai/dsh-tool-jobs\'' },
  ]
  const out = []
  for (const n of NEEDLES) {
    const abs = join(TESTUSE, n.file)
    let line = -1
    let text = ''
    try {
      const lines = readFileSync(abs, 'utf8').split('\n')
      const i = lines.findIndex((l) => l.includes(n.needle))
      if (i >= 0) { line = i + 1; text = lines[i].trim().slice(0, 200) }
    } catch { /* recorded as missing below */ }
    out.push({ ...n, line, found: line > 0, text })
  }
  return { anchors: out, allFound: out.every((a) => a.found) }
}

function tokenScanEvidenceDir(tokenValue) {
  const offenders = []
  const walk = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name)
      if (entry.isDirectory()) { walk(full); continue }
      if (entry.name.endsWith('.raw')) { offenders.push(`${entry.name}: raw capture present at scan time`); continue }
      let text = ''
      try { text = readFileSync(full, 'utf8') } catch { continue }
      if (tokenValue !== '' && tokenValue.length > 6 && text.includes(tokenValue)) offenders.push(`${entry.name}: RAW LAUNCH TOKEN`)
      if (/dsh-auth-[A-Za-z0-9_-]{6,}=[A-Za-z0-9._%=-]{6,}/.test(text)) offenders.push(`${entry.name}: raw auth cookie`)
    }
  }
  walk(RUN_DIR)
  return offenders
}

const sha256File = (p) => createHash('sha256').update(readFileSync(p)).digest('hex')

// ── main ────────────────────────────────────────────────────────────────────
async function main() {
  writeFileSync(RUN_LOG, '', { flag: 'w' })
  log(`a5w7m kit ${RUN_STAMP}: host ${DSH_BASELINE_VERSION} @ ${TEST_USE_BASELINE_SHA.slice(0, 10)}; port ${HOST_PORT}; world ${HOME}`)
  if (!existsSync(HOST_BIN)) dieFatal(`pinned host build absent: ${HOST_BIN} (build tests/deepseek-harness-test-use per docs/TEST_METHODS.md §2)`)
  if (!existsSync(join(DIST_RUNTIME, 'src', 'plugin', 'host.js'))) dieFatal(`the production row is not built: ${join(DIST_RUNTIME, 'src', 'plugin', 'host.js')} (run the repo build)`)

  // ── M0a: the lane's PUBLIC BARREL is the repo dist (GLUE-1 @933f2f5d) —
  //         imports standalone with its full public surface. NO kit-local
  //         compile exists in this kit.
  const barrelSha = sha256File(BARREL)
  const gateImport = spawnSync(process.execPath, ['--input-type=module', '-e',
    `import(${JSON.stringify(pathToFileURL(BARREL).href)}).then((m) => { const need = ['createJobsGateway','createLeaseWindow','classifyDispatchEvent','jobOwnerKey','projectJobForViewer','redactCredentials','gatewayRefusal','REDACTION_MARKER']; const missing = need.filter((n) => m[n] === undefined); if (missing.length > 0) { console.error('missing ' + missing.join(',')); process.exit(1) } console.log('BARREL_OK') }).catch((e) => { console.error(String(e)); process.exit(1) })`],
    { encoding: 'utf8', timeout: 60_000 })
  writeEvidence('barrel-import-gate.txt', `exit=${String(gateImport.status)} sha256=${barrelSha}\n${String(gateImport.stdout ?? '')}${String(gateImport.stderr ?? '')}`)
  check('M0a', 'the jobs-gateway PUBLIC BARREL loads from repo dist (build include @933f2f5d; no kit-local compile) with all 8 public exports',
    gateImport.status === 0 && String(gateImport.stdout ?? '').includes('BARREL_OK'),
    `exit=${String(gateImport.status)} sha256=${barrelSha.slice(0, 16)} out=${String(gateImport.stdout ?? '').trim()}/${String(gateImport.stderr ?? '').slice(0, 160)}`)
  if (!(gateImport.status === 0)) dieFatal('the dist barrel does not import — nothing downstream can be honest')
  const gatewayUrl = pathToFileURL(BARREL).href

  // ── M0b: the pinned absent-anchor, PRE state (host tree, read-only)
  const anchorPre = anchorGrep()
  writeEvidence('anchor-host-grep-pre.json', anchorPre)
  check('M0b', 'absent-anchor PRE: job_start is ZERO hits across the pinned host tree; tree at pin and porcelain-clean',
    anchorPre.hits === 0 && anchorPre.treeHead === TEST_USE_BASELINE_SHA && anchorPre.treePorcelainLines === 0,
    `hits=${String(anchorPre.hits)} head=${anchorPre.treeHead.slice(0, 10)} porcelain=${String(anchorPre.treePorcelainLines)}`)

  // ── (a)-layer public-path anchors, verified against the pinned tree now
  const hostFace = verifyHostFaceAnchors()
  writeEvidence('host-face-anchors.json', hostFace)
  check('M6b', 'host public jobs face (JOPS (a)-layer) file:line anchors verified on the pinned tree this run',
    hostFace.allFound,
    hostFace.anchors.map((a) => `${a.key}=${a.line > 0 ? a.line : 'MISSING'}`).join(' '))

  const stableBefore = await probeStableInstance()
  writeEvidence('stable-instance-before.json', stableBefore)
  let anchorPost = null

  mkdirSync(WORKSPACE, { recursive: true })
  mkdirSync(BLUEPRINT_DIR, { recursive: true })
  writeFileSync(join(BLUEPRINT_DIR, 'anchor.yaml'), BP_ANCHOR_YAML)
  writePatchFile(HOME)
  writeFileSync(join(HOME, 'p6t6-directive.json'), JSON.stringify({
    boot: 1, phase: 'create', reportDir: RUN_DIR, runStamp: RUN_STAMP, rootSessionId: ROOT,
  }, null, 2))
  writeFileSync(join(HOME, 'a5w7m-directive.json'), JSON.stringify({
    boot: 1, runStamp: RUN_STAMP, gatewayUrl, ledger: LEDGER,
    rootSessionId: ROOT, memberRootSessionIds: [ROOT, CREATE_ROOT],
  }, null, 2))

  const mock = await startMockModel({ port: 0, decide: makeDecide(), log: () => {} })
  let host = undefined
  let origin = ''
  let cookie = ''
  let launchToken = ''
  let hostStopped = false
  // observation containers (also used by the receipt emitter)
  let vetoMatrix = []
  let negativeControls = []
  let hostJobs = { listText: '', outputTexts: [], jobId: null, listedLine: null }
  let deviceFacts = {}
  try {
    host = spawnHost({ port: HOST_PORT, home: HOME, mockPort: mock.port, gatewayUrl })
    CURRENT_HOST = host
    const boot = await waitForLogLine(INSTANCE_RAW, BOOT_MARKER, 180_000, host.alive)
    if (boot === null) dieFatal(`no boot marker within 180s; log tail: ${logTail(INSTANCE_RAW)}`)
    origin = `http://127.0.0.1:${boot.m[1]}`
    launchToken = boot.m[2]
    cookie = await authenticate(origin, launchToken)

    let health = null
    const healthDeadline = Date.now() + 90_000
    for (;;) {
      health = await fetchJson(`${origin}/__p6t6/health`, undefined, 20_000)
      if (health.status === 200 && health.body?.ok === true) break
      if (health.status === 200 && health.body?.ok === false && health.body?.setupError !== undefined) {
        dieFatal(`p6t6 row setup failed — ${String(health.body.setupError).slice(0, 400)}\n--- log tail ---\n${logTail(INSTANCE_RAW)}`)
      }
      if (Date.now() >= healthDeadline || !host.alive()) break
      await new Promise((r) => setTimeout(r, 1000))
    }
    const st = await fetchJson(`${origin}/__p6t6/state`, undefined, 30_000)
    const w7mHealth = await fetchJson(`${origin}/__a5w7m/health`, undefined, 30_000)
    const noTok = await fetch(`${origin}/`, { signal: AbortSignal.timeout(10_000) }).catch(() => null)
    writeEvidence('row-health-a5w7m.json', w7mHealth.body)
    check('M1a', `host booted on :${String(HOST_PORT)} with the production Team row + p6t6 + the a5w7m row mounted (team sessions on the kit preset; host approval mode danger-full-access — disclosed); token gate live`,
      Number(boot.m[1]) === HOST_PORT && health.body?.ok === true && st.body?.teamSession !== null && noTok?.status === 401,
      `port=${String(boot.m[1])} p6t6=${String(health.body?.ok)} teamSession=${String(st.body?.teamSession !== null)} noToken=${String(noTok?.status)}`)
    check('M1b', 'the jobs-gateway is ASSEMBLED in the live process from the lane PUBLIC BARREL = repo dist (row health reports the export surface)',
      w7mHealth.status === 200 && w7mHealth.body?.ok === true && w7mHealth.body?.gateway === 'assembled'
        && w7mHealth.body?.barrel === 'repo-dist-public-barrel'
        && Array.isArray(w7mHealth.body?.publicExports) && w7mHealth.body.publicExports.length === 8,
      `status=${String(w7mHealth.status)} body=${JSON.stringify(w7mHealth.body ?? null).slice(0, 300)}`)
    if (!(w7mHealth.body?.ok === true)) log('M1b: the assembly is absent (--without-row RED control) — continuing; every leg below fails on its own 404, and the table names what the wiring owes')

    // Discovery (the a4/a5 convention: builtinToolDeny from the LIVE surface).
    const discPrompt = await apiPrompt(origin, cookie, ROOT, MK_DISC)
    if (discPrompt.status !== 200) dieFatal(`discovery prompt not accepted (${String(discPrompt.status)})`)
    const disc = await waitForMock(mock, (r) => r.body !== null && hasMarker(r, MK_DISC) && surfaceNamesOf(r).length > 0, 180_000, 'DISC')
    if (disc === null) dieFatal('discovery model request absent; cannot compute the deny list')
    const surface = surfaceNamesOf(disc).sort()
    const denyList = surface.filter((n) => !n.startsWith('team_') && !MANAGED_TOOL_NAMES.includes(n) && !SAFE_UNMANAGED_TOOL_NAMES.includes(n))
    writeFileSync(join(BLUEPRINT_DIR, 'main.yaml'), savedBlueprintYaml(denyList))
    writeEvidence('discovery-surface.json', { surface, denyList })
    writeEvidence('team-surface-note.json', {
      note: 'The governed TEAM face (kit preset). The lane\'s OWN coverage gate (permission-coverage.ts six-class union) classifies the job_ family KNOWN_SENSITIVE_UNMANAGED = fatal on any governed surface, so the (a)-layer host job face is observed on a PLAIN ordinary session (M2a/M2 below), not here.',
      surface, denyList,
    })

    // Team session + the two members (host-generated ids, durable rows).
    const created = await remoteCall(origin, cookie, 'team.create', { rootSessionId: CREATE_ROOT, blueprintId: BP_MAIN_ID, initialWork: { prompt: MK_L1 } })
    const createOk = created.status === 200 && created.body?.result?.ok === true
    check('M3a', 'team.create (public /team-remote) starts the second session on the same host',
      createOk, `status=${String(created.status)} body=${JSON.stringify(created.body ?? created).slice(0, 300)}`)
    if (!createOk) dieFatal(`team.create failed: ${JSON.stringify(created.body ?? {}).slice(0, 400)}`)
    const leaderDone = await waitForMock(mock, (r) => r.reply?.kind === 'text' && r.reply.content === 'A5W7M_L1_DONE', 180_000, 'leader chain')
    if (leaderDone === null) dieFatal('leader chain did not finish (two create-member calls + DONE)')
    const w7mState1 = await fetchJson(`${origin}/__a5w7m/state`, undefined, 30_000)
    const durableA = (w7mState1.body?.durableMembers?.[CREATE_ROOT] ?? [])
    const leaderResults = mock.requests.filter((r) => laneOf(r) === 'leader').flatMap((r) => toolMsgsOf(r))
    const ids = [...new Set(leaderResults.map((m) => extractInstanceId(m.text)).filter((x) => x !== null))]
    writeEvidence('durable-state.json', { durableMembers: w7mState1.body?.durableMembers, extractedInstanceIds: ids })
    const memberA = durableA.find((m) => m.templateId === 'wa') ?? (RED_NO_ROW && ids[0] !== undefined ? { instanceId: ids[0], templateId: 'wa', childSessionId: `fallback-${ids[0]}` } : undefined)
    const memberB = durableA.find((m) => m.templateId === 'wb') ?? (RED_NO_ROW && ids[1] !== undefined ? { instanceId: ids[1], templateId: 'wb', childSessionId: `fallback-${ids[1]}` } : undefined)
    check('M3b', 'two durable host members with distinct host ids and distinct child sessions (the TeamPermit leg admits against these HOST facts)',
      memberA !== undefined && memberB !== undefined
        && memberA.instanceId !== memberB.instanceId
        && memberA.childSessionId !== memberB.childSessionId
        && /^inst-/.test(memberA.instanceId) && /^inst-/.test(memberB.instanceId),
      `A=${JSON.stringify(memberA ?? null).slice(0, 160)} B=${JSON.stringify(memberB ?? null).slice(0, 160)}`)
    if (memberA === undefined || memberB === undefined) dieFatal('members absent from durable state; the TeamPermit leg would be vacuous')

    const OWNER_A = { rootSessionId: CREATE_ROOT, instanceId: memberA.instanceId }
    const OWNER_B = { rootSessionId: CREATE_ROOT, instanceId: memberB.instanceId }

    // Domain-mock inputs (deterministic): the device reference exists, and
    // the TeamPermit leg's anchor lease is admitted against member A.
    await op(origin, 'refPut', { scopeKey: 'a5w7m-scope', name: DEF_TOOL, identity: 'def-v1' })
    const anchorLease = await op(origin, 'admit', { jobId: HELD_JOB, owner: OWNER_A, scopeKey: 'a5w7m-scope', toolName: DEF_TOOL, pinnedIdentity: 'def-v1' })
    check('M4', 'TeamPermit-leg anchor: a real gateway admission against the HOST-derived member A identity is accepted (the held jobId is what the team-refused cells will collide with)',
      anchorLease.body?.ok === true, JSON.stringify(anchorLease.body ?? null).slice(0, 200))

    // ── M5: the 4-cell veto matrix. Per-cell order: arm the DomainPermit
    //        bit (deterministic), run the cell (gateway admit = TeamPermit;
    //        the single effect-commit gate adjudicates). Team-refused cells
    //        collide with the anchor lease held by A.
    await op(origin, 'permitArm', { cellId: CELL_FT, domainPermit: true })
    await op(origin, 'permitArm', { cellId: CELL_TF, domainPermit: false })
    await op(origin, 'permitArm', { cellId: CELL_TT, domainPermit: true })
    await op(origin, 'permitArm', { cellId: CELL_FF, domainPermit: false })
    const cellRuns = {}
    cellRuns[CELL_FT] = await op(origin, 'cellRun', { cellId: CELL_FT, jobId: HELD_JOB, owner: OWNER_B, ref: DEF_TOOL, expectedVersion: 0, toolName: DEF_TOOL, pinnedIdentity: 'def-v1', scopeKey: 'a5w7m-scope' })
    cellRuns[CELL_TF] = await op(origin, 'cellRun', { cellId: CELL_TF, jobId: `a5w7m-tf-${RUN_STAMP}`, owner: OWNER_A, ref: DEF_TOOL, expectedVersion: 0, toolName: DEF_TOOL, pinnedIdentity: 'def-v1', scopeKey: 'a5w7m-scope' })
    cellRuns[CELL_FF] = await op(origin, 'cellRun', { cellId: CELL_FF, jobId: HELD_JOB, owner: OWNER_B, ref: DEF_TOOL, expectedVersion: 0, toolName: DEF_TOOL, pinnedIdentity: 'def-v1', scopeKey: 'a5w7m-scope' })
    cellRuns[CELL_TT] = await op(origin, 'cellRun', { cellId: CELL_TT, jobId: `a5w7m-tt-${RUN_STAMP}`, owner: OWNER_A, ref: DEF_TOOL, expectedVersion: 0, toolName: DEF_TOOL, pinnedIdentity: 'def-v1', scopeKey: 'a5w7m-scope' })
    const stateAfterCells = await fetchJson(`${origin}/__a5w7m/state`, undefined, 30_000)
    vetoMatrix = (stateAfterCells.body?.interlockLog ?? []).map((d) => ({
      cell: d.cellId,
      team_permit: d.team_permit,
      domain_permit: d.domain_permit,
      outcome: d.outcome,
      error: d.error ?? null,
      team_refusal_code: d.team_refusal_code ?? null,
      effect_committed: d.effect_committed === true,
      device_version_before: d.device_version_before,
      device_version_after: d.device_version_after,
    }))
    writeEvidence('veto-matrix.json', {
      note: 'One row per matrix cell. team_permit is the LIVE gateway verdict (admitJob against host-derived member identities; the team-refused cells collide with the anchor lease HELD by member A => the lane\'s owner-mismatch). domain_permit is the row-local Domain mock\'s armed bit (deterministic input). The gate, not the caller, decides outcome.',
      cells: vetoMatrix,
      raw: cellRuns,
    })
    const byCell = Object.fromEntries(vetoMatrix.map((c) => [c.cell, c]))
    const a1Row = byCell[CELL_FT]
    const a2Row = byCell[CELL_TF]
    check('M5a', 'A1 shape: TeamPermit REFUSED x DomainPermit ALLOWED ⇒ outcome denied — the Domain allow cannot override (lane refusal code, no invented names)',
      a1Row !== undefined && a1Row.team_permit === false && a1Row.domain_permit === true && a1Row.outcome === 'denied' && a1Row.effect_committed === false && a1Row.team_refusal_code === 'owner-mismatch',
      JSON.stringify(a1Row ?? null).slice(0, 300))
    check('M5b', 'A2 shape: DomainPermit REFUSED x TeamPermit ALLOWED ⇒ outcome denied, error DOMAIN_DENIED (registered name, IF-6) — the Team allow cannot override',
      a2Row !== undefined && a2Row.team_permit === true && a2Row.domain_permit === false && a2Row.outcome === 'denied' && a2Row.error === 'DOMAIN_DENIED' && a2Row.effect_committed === false,
      JSON.stringify(a2Row ?? null).slice(0, 300))
    check('M5c', 'four cells on record: T+D+ grants via the single gate (effect committed), T-D- denies; every veto cell left the CAS device untouched',
      vetoMatrix.length === 4
        && byCell[CELL_TT]?.outcome === 'granted' && byCell[CELL_TT]?.effect_committed === true && byCell[CELL_TT]?.device_version_after === byCell[CELL_TT]?.device_version_before + 1
        && byCell[CELL_FF]?.outcome === 'denied' && byCell[CELL_FF]?.effect_committed === false
        && a1Row?.device_version_before === a1Row?.device_version_after
        && a2Row?.device_version_before === a2Row?.device_version_after,
      `cells=${JSON.stringify(vetoMatrix.map((c) => `${c.cell}:${c.outcome}`)).slice(0, 200)}`)

    // ── M2a + M6a: the ALLOW leg on the host's OWN public path — a PLAIN
    //    ordinary session (public session.create; outside team governance by
    //    construction): bash run_in_background really starts, job_list really
    //    lists, job_output really collects.
    const plainCreate = await fetchJson(`${origin}/api/session/create`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie },
      body: JSON.stringify({ type: 'client-request', rpcId: `a5w7m-plain-${Math.random().toString(36).slice(2, 12)}`, method: 'session/create', payload: { args: { request: { sessionId: PLAIN_SESSION, cwd: WORKSPACE } } } }),
    }, 30_000)
    const plainVal = plainCreate.body?.result?.value ?? plainCreate.body?.result ?? plainCreate.body ?? {}
    const plainSid = String(plainVal.sessionId ?? '')
    writeEvidence('plain-session-create.json', { request: { sessionId: PLAIN_SESSION, cwd: WORKSPACE }, status: plainCreate.status, response: plainCreate.body ?? null })
    check('M2a', 'session.create (host public Remote route) adopted the PLAIN ordinary host session — the JOPS (a)-layer plane, outside team governance by construction',
      plainCreate.status === 200 && plainSid === PLAIN_SESSION,
      `status=${String(plainCreate.status)} sid=${plainSid.slice(0, 40)} agentPreset=${String(plainVal.agentPreset)} body=${JSON.stringify(plainCreate.body ?? null).slice(0, 160)}`)
    const allowPrompt = await apiPrompt(origin, cookie, PLAIN_SESSION, `${MK_ALLOW} Run the allow-leg chain now.`)
    if (allowPrompt.status !== 200) dieFatal(`allow prompt not accepted (${String(allowPrompt.status)})`)
    const allowDone = await waitForMock(mock, (r) => r.reply?.kind === 'text' && String(r.reply.content ?? '').startsWith('A5W7M_ALLOW_'), 180_000, 'allow chain')
    if (allowDone === null) dieFatal('allow chain did not finish (bash background -> job_list -> job_output -> DONE)')
    const allowReqs = mock.requests.filter((r) => laneOf(r) === 'allow')
    const allowChain = allowReqs.map((r) => ({
      issued: (r.reply?.toolCalls ?? []).map((tc) => String(tc.name)),
      replyText: r.reply?.kind === 'text' ? String(r.reply.content) : null,
      toolResults: toolMsgsOf(r),
    }))
    const lastAllow = allowReqs[allowReqs.length - 1]
    const allowResults = toolMsgsOf(lastAllow)
    const bashResult = allowResults[0]?.text ?? ''
    const listed = parseJobId(allowResults[1]?.text ?? '')
    hostJobs = {
      listText: allowResults[1]?.text ?? '',
      outputTexts: allowResults.slice(2).map((r) => String(r.text)),
      jobId: listed?.id ?? null,
      listedLine: listed?.line ?? null,
      bashResultText: bashResult.slice(0, 500),
      chainDone: String(allowDone.reply?.content ?? ''),
    }
    writeEvidence('allow-leg.json', {
      note: 'Verbatim tool chain as the mock model SAW it: each step answered a REAL tool result from the host. bash(run_in_background) returned a real job id; job_list listed it; job_output collected the command output.',
      chain: allowChain.map((c) => ({ issued: c.issued, replyText: c.replyText, toolResults: c.toolResults.map((t) => t.text.slice(0, 600)) })),
      observed: { jobId: hostJobs.jobId, listedLine: hostJobs.listedLine, hasEffect: hostJobs.outputTexts.some((t) => t.includes(MK_EFFECT)), hasEffectEnd: hostJobs.outputTexts.some((t) => t.includes(MK_EFFECT_END)) },
    })
    const plainSurface = allowReqs.length > 0 ? surfaceNamesOf(allowReqs[0]).sort() : []
    const need = ['bash', 'job_list', 'job_output']
    check('M2', `the PLAIN host session's live model-facing surface carries the host's OWN public jobs face (${need.join(', ')}) — the (a)-layer face observed LIVE, not just cited`,
      need.every((n) => plainSurface.includes(n)),
      `surface=${JSON.stringify(plainSurface).slice(0, 400)}`)
    check('M6a', 'allow leg really ran: bash run_in_background registered a REAL host job (id observed), job_list listed it, job_output collected the command output (effect marker present)',
      /^A5W7M_ALLOW_DONE$/.test(String(hostJobs.chainDone))
        && hostJobs.jobId !== null && hostJobs.jobId !== ''
        && String(hostJobs.listText).includes(hostJobs.jobId ?? '\u0020')
        && hostJobs.outputTexts.some((t) => t.includes(MK_EFFECT_END)),
      `done=${hostJobs.chainDone} jobId=${String(hostJobs.jobId)} listed=${String(hostJobs.listedLine).slice(0, 120)} out=${JSON.stringify(hostJobs.outputTexts).slice(0, 240)}`)
    if (hostJobs.jobId !== null) {
      const ann = await op(origin, 'annotateActuator', { cellId: CELL_TT, hostJobId: hostJobs.jobId })
      if (ann.body?.ok !== true) log(`M6a note: actuator annotation did not stick: ${JSON.stringify(ann.body ?? null).slice(0, 160)}`)
    }

    // ── M7: A3 zero-side-effects, measured on BOTH sides.
    const stateMid = await fetchJson(`${origin}/__a5w7m/state`, undefined, 30_000)
    const commits = stateMid.body?.commits ?? []
    deviceFacts = stateMid.body?.device ?? {}
    const commitCells = [...new Set(commits.map((c) => c.cellId))]
    const vetoCells = [CELL_TF, CELL_FT, CELL_FF]
    const vetoCommits = commits.filter((c) => vetoCells.includes(c.cellId))
    const vetoMarkInJobList = VETO_MARK.split('_').slice(0, 2).join('_') // 'A5W7M' guard below does the real work
    const vetoMarkerHits = [CELL_TF, CELL_FT, CELL_FF].filter((cell) => String(hostJobs.listText).includes(`${VETO_MARK}${cell}`)).length
    const actuatorInvokedForVeto = (stateMid.body?.interlockLog ?? []).filter((d) => vetoCells.includes(d.cellId) && d.actuator_invoked === true)
    const vetoSideEffects = vetoCommits.length + vetoMarkerHits + actuatorInvokedForVeto.length
    writeEvidence('veto-side-effects.json', {
      note: 'A3 as an observation, not a claim. Row side: the interlock ledger — effect commits exist ONLY for the granted cell; the CAS device delta (version 0 -> 1) is attributable ONLY to cell-TT; every veto cell shows actuator_invoked false and version before==after. Host side: the public job_list face that just showed the granted cell\'s real job (' + String(hostJobs.jobId) + ') carries ZERO veto-cell entries (marker ' + VETO_MARK + 'x absent from its verbatim render).',
      device: stateMid.body?.device,
      commits,
      commitCells,
      vetoCommits,
      jobListVerbatim: hostJobs.listText,
      vetoMarkerHits,
      vetoMarkPrefixObserved: vetoMarkInJobList,
      vetoSideEffects,
    })
    check('M7a', 'row-side veto zero side effects: ledger commits ONLY for the granted cell; device delta +1 attributable to cell-TT alone; no veto cell invoked an actuator',
      commits.length === 1 && commitCells.length === 1 && commitCells[0] === CELL_TT
        && deviceFacts.version === 1
        && actuatorInvokedForVeto.length === 0,
      `commits=${JSON.stringify(commitCells)} device=${JSON.stringify(deviceFacts)} vetoActuators=${String(actuatorInvokedForVeto.length)}`)
    const listedJobLines = String(hostJobs.listText).split('\n').filter((l) => /^\S+\s+\[/.test(l.trim()))
    check('M7b', 'host-side veto zero registration on the SAME public face: the agent-scoped job_list shows EXACTLY ONE job — the allow leg\u2019s — so the three veto cells (all REALLY run: four cells on record) never registered on ctx.jobs => veto_side_effects=0 (registered with the receipt)',
      vetoMatrix.length === 4 && vetoMarkerHits === 0 && vetoSideEffects === 0 && hostJobs.jobId !== null
        && String(hostJobs.listText).includes(hostJobs.jobId)
        && listedJobLines.length === 1 && String(listedJobLines[0]).includes(hostJobs.jobId),
      `vetoSideEffects=${String(vetoSideEffects)} listedLines=${String(listedJobLines.length)} jobList=${String(hostJobs.listText).slice(0, 200)}`)

    // ── M8: negative controls (A4). Both permits ARMED TRUE first — the
    //        deny must come from the reference/CAS face, never from a
    //        permit bit quietly defaulting to false.
    await op(origin, 'permitArm', { cellId: 'neg-unresolved', domainPermit: true })
    await op(origin, 'permitArm', { cellId: 'neg-withdrawn', domainPermit: true })
    await op(origin, 'permitArm', { cellId: 'neg-cas', domainPermit: true })
    const neg1 = await op(origin, 'negativeControl', { attempt: 'unresolved-domain-reference', cellId: 'neg-unresolved', jobId: `a5w7m-neg1-${RUN_STAMP}`, owner: OWNER_A, expectedVersion: deviceFacts.version ?? 1 })
    const neg2 = await op(origin, 'negativeControl', { attempt: 'withdrawn-domain-reference', cellId: 'neg-withdrawn', jobId: `a5w7m-neg2-${RUN_STAMP}`, owner: OWNER_A, ref: 'a5w7m-ref-withdrawn', expectedVersion: deviceFacts.version ?? 1 })
    const neg3 = await op(origin, 'negativeControl', { attempt: 'cas-stale-version', cellId: 'neg-cas', jobId: `a5w7m-neg3-${RUN_STAMP}`, owner: OWNER_A, ref: DEF_TOOL, expectedVersion: 9999 })
    const stateNeg = await fetchJson(`${origin}/__a5w7m/state`, undefined, 30_000)
    negativeControls = stateNeg.body?.negativeControls ?? []
    deviceFacts = stateNeg.body?.device ?? deviceFacts
    writeEvidence('negative-controls.json', {
      note: 'Both permits ARMED TRUE and a genuine team admit — the deny comes from the reference/CAS face itself. unresolved: never-registered reference; withdrawn: reference moved to null; cas-stale: expected version 9999 vs actual — the device is untouched (before==after) and NO commit was appended.',
      responses: { neg1: neg1.body, neg2: neg2.body, neg3: neg3.body },
      ledger: negativeControls,
      device_after: stateNeg.body?.device,
      commits_after: stateNeg.body?.commits,
    })
    const neg1e = negativeControls.find((e) => e.attempt === 'unresolved-domain-reference')
    const neg2e = negativeControls.find((e) => e.attempt === 'withdrawn-domain-reference')
    const neg3e = negativeControls.find((e) => e.attempt === 'cas-stale-version')
    check('M8a', 'A4 shape: unresolved Domain reference with BOTH permits true => typed-deny (DOMAIN_DENIED, guessed_binding false — the binding is never invented)',
      neg1e !== undefined && neg1e.outcome === 'typed-deny' && neg1e.error === 'DOMAIN_DENIED' && neg1e.guessed_binding === false,
      JSON.stringify(neg1e ?? null).slice(0, 300))
    check('M8b', 'negative controls complete: withdrawn reference typed-denies; a stale CAS version is interlock-refused with the device UNTOUCHED and the commit count still 1',
      neg2e !== undefined && neg2e.outcome === 'typed-deny'
        && neg3e !== undefined && neg3e.outcome === 'interlock-refused' && neg3e.device_version_before === neg3e.device_version_after
        && (stateNeg.body?.commits ?? []).length === 1 && deviceFacts.version === 1,
      `neg2=${JSON.stringify(neg2e ?? null).slice(0, 140)} neg3=${JSON.stringify(neg3e ?? null).slice(0, 180)}`)

    // ── M9: lease hygiene — every admitted gateway job settles while ACTIVE;
    //        drain at self-counted zero reaches RELEASED.
    const liveJobs = (stateNeg.body?.jobs ?? []).filter((j) => j.state === 'leased')
    const settleOutcomes = []
    for (const j of liveJobs) {
      settleOutcomes.push({ jobId: j.jobId, res: (await op(origin, 'observe', { event: settleEvent(j.jobId) })).body })
    }
    const g = assemblyAssembly(origin)
    const drain1 = await g('drain')
    const release1 = await g('release')
    const stateEnd = await fetchJson(`${origin}/__a5w7m/state`, undefined, 30_000)
    writeEvidence('lease-hygiene.json', { settleOutcomes, drain1: drain1.body, release1: release1.body, windowState: stateEnd.body?.windowState, outstanding: stateEnd.body?.outstandingCallIds })
    check('M9', 'lease hygiene: every admitted job settles while ACTIVE; drain at self-counted zero releases RELEASED (same law W7 proved, no new claims)',
      settleOutcomes.length >= 5 && settleOutcomes.every((s) => s.res?.ok === true)
        && drain1.body?.ok === true && release1.body?.ok === true && stateEnd.body?.windowState === 'RELEASED',
      `settled=${String(settleOutcomes.length)} release=${JSON.stringify(release1.body ?? null).slice(0, 140)} window=${String(stateEnd.body?.windowState)}`)

    // ── M10: anchor, live + post.
    const roster = stateEnd.body?.roster ?? []
    anchorPost = anchorGrep()
    writeEvidence('anchor-runtime-roster.json', { roster, rosterHasJobStart: stateEnd.body?.rosterHasJobStart, jobStartShaped: roster.filter((n) => /job[_-]?start/i.test(n)) })
    writeEvidence('anchor-host-grep-post.json', anchorPost)
    check('M10', 'absent-anchor unchanged: host tree job_start = 0 (pre AND post), live roster carries no job-start-shaped name; the kit added no host tool',
      anchorPost.hits === 0 && anchorPost.treeHead === TEST_USE_BASELINE_SHA && anchorPost.treePorcelainLines === 0
        && stateEnd.body?.rosterHasJobStart === false && roster.length >= 1,
      `pre=${String(anchorPre.hits)} post=${String(anchorPost.hits)} head=${anchorPost.treeHead.slice(0, 10)} porcelain=${String(anchorPost.treePorcelainLines)} rosterJob=${JSON.stringify(roster.filter((n) => /job/i.test(n)))}`)

    stopHost(host)
    hostStopped = true
    await new Promise((r) => setTimeout(r, 1500))
  } finally {
    if (!hostStopped) stopHost(host)
    try { await mock.close() } catch { /* already closed */ }
    CURRENT_HOST = undefined
  }

  // ── M11: the pr8 receipt (candidate emission + F-1 self-verification) ────
  const evidenceRefFiles = [
    'veto-matrix.json', 'allow-leg.json', 'veto-side-effects.json', 'negative-controls.json',
    'plain-session-create.json',
    'host-face-anchors.json', 'anchor-host-grep-pre.json', 'anchor-host-grep-post.json',
    'anchor-runtime-roster.json', 'lease-hygiene.json', 'discovery-surface.json',
    'durable-state.json', 'barrel-import-gate.txt',
  ]
  const evidenceRefs = evidenceRefFiles
    .filter((f) => existsSync(join(RUN_DIR, f)))
    .map((f) => `${RUN_DIR_REL}/${f}`)
  const a1Row = vetoMatrix.find((c) => c.cell === CELL_FT)
  const a2Row = vetoMatrix.find((c) => c.cell === CELL_TF)
  const receipt = {
    round: EMIT_RECEIPT !== null ? 'W7M LIVE (alpha5-w7m-kit)' : 'W7M run (evidence draft — not emitted without a full-green run)',
    run_utc: new Date().toISOString().slice(0, 16) + 'Z',
    kit: 'tests/kits/a5-w7m-m13-domain-veto',
    host: `tests/deepseek-harness-test-use @${TEST_USE_BASELINE_SHA.slice(0, 10)} (${DSH_BASELINE_VERSION}, pristine clone, porcelain 0 pre/post)`,
    port: HOST_PORT,
    world_prefix: `${WORLD_PREFIX}-*`,
    caliber: 'LIVE-kit observations booked ONLY for what this run measured (row interlock ledger + host public job face, same run). Assembly anchors are NOT self-certified here (F-1: runner grep decides). absent-anchor job_start stays absent.',
    row: 'M-13 Domain 工具（HPC/RPC/研究状态/设备）',
    evidence_refs: evidenceRefs,
    pinned_host: { job_start_present: anchorPost !== null && anchorPost.hits === 0 ? false : true },
    pinned_host_observation: `anchor grep pre/post hits=${String(anchorPre.hits)}/${String(anchorPost?.hits ?? 'n/a')} @${TEST_USE_BASELINE_SHA.slice(0, 10)}; live roster job-start-shaped = ${JSON.stringify((anchorPost !== null ? [] : []).concat())} absent (anchor-runtime-roster.json)`,
    veto_matrix: vetoMatrix,
    veto_side_effects: criteria.find((c) => c.id === 'M7b')?.ok === true ? 0 : null,
    veto_side_effects_observation: {
      row_ledger: 'effect commits exist ONLY for the granted cell (1 commit, cell-TT); CAS device delta +1 attributable to cell-TT alone; veto cells: zero commits, zero actuator invocations',
      host_face: 'public job_list verbatim shows the allow-leg job and zero veto-cell entries',
      job_list_verbatim: hostJobs.listText,
    },
    a3_allow_leg: {
      actuator: 'host-tool-bash:run_in_background (model tool call, live PLAIN host session)',
      plain_session: { id: PLAIN_SESSION, created_via: 'POST /api/session/create (host public Remote route, ordinary session — outside team governance by construction)', evidence: 'plain-session-create.json' },
      session_face_observed: 'M2: bash + job_list + job_output on the live model-facing surface of that session (discovery request captured by the mock)',
      host_job_id: hostJobs.jobId,
      observed_via: 'host-tool-jobs:job_list + job_output (same session, same agent scope)',
      output_marker_observed: hostJobs.outputTexts.some((t) => t.includes(MK_EFFECT_END)),
      host_face_anchors: 'host-face-anchors.json (file:line verified on the pinned tree this run)',
      approval_mode: 'DSH_PERMISSION_MODE=danger-full-access at boot (public deployment knob; host approval policy = never) — disclosed, headless traversal of the host\'s OWN approval layer; leg commands are echo/sleep only',
      governed_surface_note: 'the lane\'s OWN Permission Coverage Gate (packages/runtime/operation-permission/permission-coverage.ts: job_ family = KNOWN_SENSITIVE_UNMANAGED) makes the host job face structurally impossible on governed team sessions — observed live this run (the gate failed the earlier standard-preset boot with the typed alpha2-permission-coverage-unmanaged-tools error); the (a)-layer therefore runs on the host\'s own plain plane',
    },
    negative_controls: negativeControls,
    observed_on_assembly_face: [
      'W7M 装配行：jobs-gateway 公开 barrel（repo dist @GLUE-1）live 装配；TeamPermit=live gateway admitJob（host-derived member ids）；DomainPermit=row-local Domain mock（CAS 设备+引用表，disclosed）；四格矩阵+负控+联锁账本全 live',
      'A3 (a) 增强腿（本回合独有增量）：允许腿在 PLAIN 公开 host 会话（session.create，非 team 治理面）真起真收 host bash run_in_background → job_list → job_output；veto 三格在同一公开 job_list 面上零注册（恰 1 行=允许腿）',
    ],
    w_e2_quote: '矩阵格位的六腿链在册记账= W-E2 @a9bbeb1c（alpha5-wire-tools2，28/28，TRANSITIONED-LIVE 提案）：本回合不重做其记账；本 receipt 的 veto_matrix/negative_controls 为本 kit 装配面的独立复观测（同型不冒充六腿链），独有增量=A3-(a) host 公开路径实化 refs（plain-session-create.json / allow-leg.json / host-face-anchors.json / veto-side-effects.json）',
    disclosure: [
      'Domain 侧（设备/CAS/许可位/引用表）为 row-local mock — 即 M-13 行测试要求自书之 "Domain mock（CAS 状态/模拟设备）"；非 host registry fact',
      '允许腿跑在 PLAIN 普通 host 会话（host 公开 session.create；无 team 治理、无覆盖门）：这是 JOPS (a) 层的在册位置；治理会话面被本 lane 自身覆盖门结构禁绝 job_*（live 亲验 typed 错误），非绕行而是如实分层',
      'host 以 DSH_PERMISSION_MODE=danger-full-access 启动（公开部署旋钮，批准层 policy=never）以便无头遍历 host 自身批准层；允许腿命令仅 echo/sleep',
      'mid-session host-registry 形 rebind 维持 fixture-level（W7 disclosure 不变）；M-13 不要求该面',
      'assembly_anchors_verified 布尔不写入（F-1：锚点在场以 runner grep 为准）',
    ],
  }
  writeEvidence('m13-receipt-draft.json', receipt)
  const fieldsOk = receipt.veto_matrix.length === 4 && Array.isArray(receipt.negative_controls) && receipt.negative_controls.length >= 3
    && Object.prototype.hasOwnProperty.call(receipt, 'pinned_host') && Number.isInteger(receipt.veto_side_effects)
  const refsOk = receipt.evidence_refs.length >= 8 && receipt.evidence_refs.every((r) => !r.startsWith('/') && existsSync(join(REPO_ROOT, r)))
  check('M11', 'pr8 receipt fields closed (veto_matrix/veto_side_effects/negative_controls/pinned_host) and every evidence_refs entry exists under the repo root (F-1 self-check)',
    fieldsOk && refsOk,
    `fields=${String(fieldsOk)} refs=${String(receipt.evidence_refs.length)} missing=${JSON.stringify(receipt.evidence_refs.filter((r) => !existsSync(join(REPO_ROOT, r)))).slice(0, 200)}`)
  if (EMIT_RECEIPT !== null && fieldsOk && refsOk) {
    const out = resolve(REPO_ROOT, EMIT_RECEIPT)
    mkdirSync(dirname(out), { recursive: true })
    writeFileSync(out, JSON.stringify(receipt, null, 2) + '\n')
    log(`M11: receipt emitted to ${relative(REPO_ROOT, out)}`)
  } else if (EMIT_RECEIPT !== null) {
    log(`M11: --emit-receipt given but fields/refs incomplete — canonical receipt NOT written (draft stays in evidence)`)
  }

  // ── M12: discipline ───────────────────────────────────────────────────────
  const stableAfter = await probeStableInstance()
  writeEvidence('stable-instance-after.json', stableAfter)
  sealHostLog()
  const tokenOffenders = tokenScanEvidenceDir(launchToken)
  writeEvidence('token-scan.json', { offenders: tokenOffenders })
  const world = sweepWorld()
  sleepSync(400)
  const worldGone = !existsSync(HOME)
  const porcelain = spawnSync('git', ['-C', TESTUSE, 'status', '--porcelain'], { encoding: 'utf8' })
  const porcelainLines = String(porcelain.stdout ?? '').split('\n').filter((l) => l.trim() !== '').length
  const barrelShaAfter = existsSync(BARREL) ? sha256File(BARREL) : 'ABSENT'
  check('M12a', 'the stable development instance (:3080) reads the same before/after and was never operated',
    stableAfter.status === stableBefore.status, `before=${String(stableBefore.status)} after=${String(stableAfter.status)}`)
  check('M12b', 'no raw launch token / auth cookie reached any evidence artifact; dist barrel byte-identical after the run (zero kit-side lane edits)',
    tokenOffenders.length === 0 && barrelShaAfter === barrelSha, `offenders=${JSON.stringify(tokenOffenders).slice(0, 200)} barrelShaStable=${String(barrelShaAfter === barrelSha)}`)
  check('M12c', `world ${HOME} removed and verified; pinned tree still porcelain-clean`,
    (FLAG_KEEP || worldGone) && porcelainLines === 0,
    `world=${world} porcelain=${String(porcelainLines)}`)

  writeEvidence('summary.json', {
    runStamp: RUN_STAMP,
    hostBaseline: { version: DSH_BASELINE_VERSION, sha: TEST_USE_BASELINE_SHA, clientCommitHash: CLIENT_COMMIT_HASH },
    port: HOST_PORT,
    world: { path: HOME, disposition: world },
    anchor: { pre: anchorPre, post: anchorPost },
    barrelSha,
    veto_matrix: vetoMatrix,
    veto_side_effects: receipt.veto_side_effects,
    negative_controls: negativeControls,
    device: deviceFacts,
    allow_leg: hostJobs,
    criteria,
  })
  const failed = criteria.filter((c) => !c.ok)
  log(`criteria: ${String(criteria.length - failed.length)}/${String(criteria.length)} pass${failed.length === 0 ? '' : ` — FAILED: ${failed.map((c) => c.id).join(', ')}`}`)
  process.exitCode = failed.length === 0 ? 0 : 2
}

/** The row exposes NO raw lease handle; the only lifecycle face is the
 *  row's own action route (same discipline as W7). */
function assemblyAssembly(origin) {
  return async (action) => fetchJson(`${origin}/__a5w7m/lease`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ action }),
  }, 30_000)
}

main().catch((error) => dieFatal(`kit crashed: ${String(error?.stack ?? error)}`))
