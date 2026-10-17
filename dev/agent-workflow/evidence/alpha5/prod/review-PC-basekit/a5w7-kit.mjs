#!/usr/bin/env node
/**
 * a5w7-kit.mjs — Alpha.5 W7 (jobs wiring) real-Host kit: the PR7 jobs-gateway
 * public face assembled into a live test session on the PINNED host
 * (0.2.0-rc.2 @ `639ed01539`, `tests/paths.mjs` is the single source), on
 * port **3184** (WIRING-PHASE-PLAN IF-2; :3080 read-only probed, never
 * operated), world `tests/homes/a5w7-<stamp>` (IF-3, §7 teardown).
 *
 * WHAT THIS PROVES, and only this:
 *
 *   W1 assembly      the row boots with the lane's PUBLIC BARREL (compiled
 *                    from unmodified sources by the kit-local project — the
 *                    lane's FIRST tsc run, review-LaneF condition 2) and the
 *                    gateway is armed inside the live Host process.
 *   W2 members       two governed members exist as durable, host-generated
 *                    MemberInstance rows with distinct child sessions —
 *                    two live sessions on one host.
 *   W3 identity      admission binds the host-derived owner pair; the
 *                    canonical key is the lane's math over host facts; a
 *                    post-admission mutation of the caller's object does not
 *                    re-attribute (value pin, re-verified live); a second
 *                    owner re-admitting the live jobId is an owner-mismatch
 *                    with an alarm; same-owner re-admit is duplicate-job.
 *   W4 isolation     the two members' job namespaces are MUTUALLY INVISIBLE
 *                    (list comparison, verbatim lists in the evidence); the
 *                    boot-root leader scope sees neither; cross-scope
 *                    projections refuse with the lane's static detail and
 *                    never carry the other side's identity; a swapped-root
 *                    viewer (same instanceId, other rootSessionId) is a
 *                    different owner, refused.
 *   W5 revocation    the C-BIND law on the live gateway: a Definition that
 *                    moves (or cannot be read) cancels only ITS in-flight
 *                    jobs; the neighbour (same scope, other name) is not
 *                    friendly-fired; after the Definition returns, a new
 *                    admission pins the NEW identity and settles, while the
 *                    old job's attribution stays pinned to the execution-time
 *                    identity. DISCLOSED: the identity source is the row's
 *                    own definition store — the pinned Host gives a
 *                    third-party row no public seam to move another scope's
 *                    Definition, and no host Jobs face at all (W8). The
 *                    host-registry-shaped chain stays fixture-level
 *                    (a5p7-mcp-rebind-chain, 6/6) — cited, not booked.
 *   W6 release       every job settles through the boundary while ACTIVE;
 *                    drain at self-counted zero releases (RELEASED).
 *   W7 lease mutex   while A holds jobId X, B's admission of X is refused
 *                    (A holds ⇒ B refused); once the window drains, NEW
 *                    admissions are refused from the first instant; an
 *                    outcome observed across the boundary is recorded (the
 *                    plane's fact) while the lease settle is REFUSED and the
 *                    token stays outstanding; after giveUp the release
 *                    refuses FOREVER. Abort propagation is COOPERATIVE —
 *                    the plane decides; this face mirrors with no termination
 *                    guarantee (G-g is OPEN, PENDING-GATES; no wording here
 *                    claims otherwise).
 *   W8 anchor        the pinned absent-anchor stays pinned: `job_start`
 *                    greps ZERO across the host tree (pre and post), and the
 *                    live assembly roster carries no job-start-shaped name.
 *                    This kit adds NO host tool and fakes no host Jobs face
 *                    (that dimension is PROBE-GATED, minimal reproduction in
 *                    the receipt).
 *   W9 wording       the kit's own files cite the gate G-g as OPEN-only
 *                    (PENDING-GATES register) and carry no termination
 *                    promise of any kind (self-scan criterion W9).
 *   W10 discipline   :3080 reads the same before/after and was never
 *                    operated; the pinned test-use tree stays porcelain-
 *                    clean; no launch token reaches any artifact; the world
 *                    and the kit-local build dir are removed and verified.
 *
 * Mechanism: the public profile-patch seam only (production `dsh-agent-team`
 * row from this worktree's built dist + the p6t6 observer + the a5w7 row);
 * mock model only (`packages/tools/harness/mock-deepseek.mjs`), no real key.
 * Every wait <= 180 s, storm fuse at 300 requests. Credentials redacted AT
 * CAPTURE. Host killed only by its recorded pid on the recorded port.
 * EXIT: 0 = every criterion passed; 2 = a criterion failed; 1 = fatal.
 */
import { createHash } from 'node:crypto'
import { spawn, spawnSync } from 'node:child_process'
import { closeSync, existsSync, mkdirSync, openSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { startMockModel } from "/srv/workspace/dsh-plugins/dsh-agent-team/.worktrees/a5p7-rev-pc/packages/tools/harness/mock-deepseek.mjs"
import { presetDeclarationRow, smokePresetPlugins } from "/srv/workspace/dsh-plugins/dsh-agent-team/.worktrees/a5p7-rev-pc/tests/kits/_shared/preset-seam.mjs"
import { CLIENT_COMMIT_HASH, TEST_USE_BASELINE_SHA, DSH_BASELINE_VERSION, STABLE_INSTANCE_PORT, testUseTree, homeDir } from "/srv/workspace/dsh-plugins/dsh-agent-team/.worktrees/a5p7-rev-pc/tests/paths.mjs"

// ── CLI / layout ────────────────────────────────────────────────────────────
const args = process.argv.slice(2)
const FLAG_KEEP = args.includes('--keep')
/** RED control: boot the world WITHOUT the a5w7 row so every op leg fails on a
 *  404 — the criteria table then shows, per leg, exactly what the wiring owes. */
const RED_NO_ROW = args.includes('--without-row')
const KIT_DIR = "/srv/workspace/dsh-plugins/dsh-agent-team/.worktrees/a5p7-rev-pc/dev/agent-workflow/evidence/alpha5/prod/review-PC-basekit"
const REPO_ROOT = "/srv/workspace/dsh-plugins/dsh-agent-team/.worktrees/a5p7-rev-pc"
const TESTUSE = testUseTree(REPO_ROOT)
const RUN_STAMP = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
const RUN_DIR = args.includes('--evidence-dir') ? resolve(args[args.indexOf('--evidence-dir') + 1]) : join(KIT_DIR, `run-${RUN_STAMP}`)
const WORLD_PREFIX = args.includes('--world-prefix') ? args[args.indexOf('--world-prefix') + 1] : 'a5w7' // W8 正式轮 --world-prefix a5w8（IF-3）；默认=lane 原前缀
const HOME = homeDir(REPO_ROOT, `${WORLD_PREFIX}-${RUN_STAMP}`)
const WORKSPACE = join(HOME, 'workspace')
const LEDGER = join(RUN_DIR, 'jobs-ledger.jsonl')
const BLUEPRINT_DIR = join(RUN_DIR, 'blueprints')
const INSTANCE_LOG = join(RUN_DIR, 'instance.log')
const INSTANCE_RAW = join(RUN_DIR, 'host-stdout.raw')
const HOST_PORT = args.includes('--port') ? Number(args[args.indexOf('--port') + 1]) : 3184 // IF-2: W7's recorded port; W8 正式轮 --port 3186（IF-2 记 W8=3186）；默认不变
const LANE_BUILD = join(REPO_ROOT, 'node_modules', '.a5w7-jobs-build')

const DIST_RUNTIME = join(REPO_ROOT, 'packages', 'runtime', 'dist', 'packages', 'runtime')
const HOST_BIN = join(TESTUSE, 'apps', 'cli', 'lib', 'bin.js')
const PRODUCTION_ROW_NAME = pathToFileURL(join(DIST_RUNTIME, 'src', 'plugin', 'host.js')).href
const GLUE_URL = pathToFileURL(join(DIST_RUNTIME, 'src', 'plugin', 'live', 'agent-bindings.mjs')).href
const SEAM_URL = pathToFileURL(join(REPO_ROOT, 'packages', 'runtime', 'root-binding', 'harness', 'seam.mjs')).href
const P6T6_ROW_NAME = pathToFileURL(join(REPO_ROOT, 'packages', 'tools', 'harness', 'plugin.mjs')).href
const W7_ROW_NAME = pathToFileURL(join(KIT_DIR, 'a5w7-jobs-plugin.mjs')).href

const PRESET_ID = 'a5w7-base'
const ROOT = `session-a5w7-root-${RUN_STAMP}`
const CREATE_ROOT = `session-a5w7-team-${RUN_STAMP}`
const BP_ANCHOR_ID = 'team.a5w7.anchor'
const BP_MAIN_ID = 'team.a5w7.main'
const MK_DISC = `A5W7_DISC_${RUN_STAMP}`
const MK_L1 = `A5W7_L1_${RUN_STAMP}`
/** Kit-local tool identity used as the gateway's definition subject (row-local
 *  store — disclosed; NOT a host tool, and NOT named `job_start` on purpose). */
const DEF_TOOL = 'a5w7_def_tool'
const DEF_NEIGHBOUR = 'a5w7_def_neighbour'

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
async function remoteCall(origin, cookie, method, params, tag = 'a5w7') {
  return fetchJson(`${origin}/team-remote/${method}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie },
    body: JSON.stringify({ type: 'client-request', rpcId: `${tag}-${Math.random().toString(36).slice(2, 12)}`, method, payload: { version: 1, params } }),
  })
}
async function apiPrompt(origin, cookie, sessionId, text, tag = 'a5w7') {
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
    staticModel: { provider: 'deepseek-official', model: 'a5w7-model' },
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

const BP_ANCHOR_YAML = [
  '---', 'schemaVersion: 3', `blueprintId: ${BP_ANCHOR_ID}`, 'revision: "1"',
  'leader:', '  templateId: leader',
  `  persona: "You are the leader of the a5w7 jobs-wiring team. ${MK_DISC} is the discovery marker."`,
  'members:', '  - templateId: wa', '    persona: "You are a worker of the a5w7 jobs-wiring team."',
  'memberEnvelopes: []', 'requirements: []', 'permissionMutationEnvelope:', '  rules: []',
  'teamHardEnvelope:', '  rules: []', 'policyStates: []', 'metadata: {}', '---', '',
].join('\n')

function savedBlueprintYaml(denyList) {
  const denyLines = denyList.length === 0 ? ['    builtinToolDeny: []'] : ['    builtinToolDeny:', ...denyList.map((n) => `      - ${n}`)]
  return [
    '---', 'schemaVersion: 3', `blueprintId: ${BP_MAIN_ID}`, 'revision: "1"',
    'leader:', '  templateId: leader',
    `  persona: ${JSON.stringify(`You are the leader of the a5w7 jobs-wiring team. ${MK_L1} drives your chain: create one worker from template wa and one from template wb, then finish.`)}`,
    '  capabilities:', '    teamTools:', '      kind: allow', '      items:',
    '        - team_list_members', '        - team_create_member',
    ...denyLines,
    '    skills:', '      kind: allow', '      items: []',
    '    mcp:', '      kind: allow', '      items: []',
    '    permissions:', '      default: ask', '      allow: []', '      ask: []', '      deny: []',
    'teamEnvelope:', '  allow:', '    - create-member', '    - send-message', '    - report-progress', '  deny: []',
    'members:',
    '  - templateId: wa', '    displayName: "a5w7 worker A"',
    `    persona: ${JSON.stringify('You are worker A of the a5w7 jobs-wiring team. No tasks are delegated to you in this run.')}`,
    '  - templateId: wb', '    displayName: "a5w7 worker B"',
    `    persona: ${JSON.stringify('You are worker B of the a5w7 jobs-wiring team. No tasks are delegated to you in this run.')}`,
    'memberEnvelopes:',
    '  - templateId: wa', '    envelope:', '      allow:', '        - send-message', '        - report-progress', '      deny: []',
    '  - templateId: wb', '    envelope:', '      allow:', '        - send-message', '        - report-progress', '      deny: []',
    'permissionMutationEnvelope:', '  rules: []', 'teamHardEnvelope:', '  rules: []',
    'policyStates: []', 'metadata: {}', '---', '',
  ].join('\n')
}

function writePatchFile(home, gatewayUrl) {
  mkdirSync(join(home, 'profiles', 'web'), { recursive: true })
  const basePlugins = smokePresetPlugins({
    personaText: 'You are a coding agent powered by the {{model}} model.',
    cwdSuffix: 'Your working directory is {{cwd}}.',
    bashDescription: 'Run commands in a bash shell. State is persistent across calls.',
  })
  const lines = [
    `# a5w7 W7 patch layer (run ${RUN_STAMP}): production dsh-agent-team row (this worktree's dist) + p6t6 observer + the a5w7 jobs-gateway row (public barrel through the kit-local compile) + one preset — public profile-patch seam only.`,
    '- insert:',
    ...yamlEmitItem({ id: 'dsh-agent-team', name: PRODUCTION_ROW_NAME, config: teamRowConfig() }, 2),
    ...yamlEmitItem({ id: 'p6t6-team-tools', name: P6T6_ROW_NAME }, 2),
    ...(RED_NO_ROW ? [] : [
      ...yamlEmitItem({ id: 'a5w7-jobs', name: W7_ROW_NAME }, 2),
    ]),
    ...yamlEmitItem(presetDeclarationRow({
      id: PRESET_ID, displayName: 'a5w7 base',
      description: `a5w7 base preset (run ${RUN_STAMP}) = smoke preset`,
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
        DEEPSEEK_API_KEY: 'a5w7-mock-key',
        A5W7_DIRECTIVE: join(home, 'a5w7-directive.json'),
        A5W7_GATEWAY_URL: gatewayUrl,
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

// ── mock model: the leader creates two members, then stops ─────────────────
const toolCall = (name, argsObj) => ({
  kind: 'tool-call',
  toolCalls: [{ id: `call-a5w7-${Math.random().toString(36).slice(2, 10)}`, name, arguments: argsObj }],
})
function bodyOf(rec) { return rec === null || typeof rec !== 'object' ? null : ('body' in rec ? (rec.body ?? null) : rec) }
function messagesOf(req) { return bodyOf(req)?.messages ?? [] }
function textOf(m) { return typeof m?.content === 'string' ? m.content : JSON.stringify(m.content ?? '') }
function hasMarker(req, marker) { return messagesOf(req).some((m) => textOf(m).includes(marker)) }
function surfaceNamesOf(req) { return (bodyOf(req)?.tools ?? []).map((t) => String(t?.name ?? '')).filter((n) => n !== '') }
function lastToolResultText(req) {
  const messages = messagesOf(req)
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const blocks = Array.isArray(messages[i]?.content) ? messages[i].content : []
    const results = blocks.filter((b) => b?.type === 'tool_result')
    if (results.length > 0) {
      return results.map((b) => (Array.isArray(b.content) ? b.content : []).map((c) => c?.text ?? '').join('')).join('\n')
    }
  }
  return ''
}
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
function laneOf(req) {
  const t = messagesOf(req).map(textOf).join('\n')
  if (t.includes('Generate the session title')) return 'title'
  if (t.includes(MK_DISC)) return 'disc'
  if (t.includes(MK_L1)) return 'leader'
  return 'other'
}
function makeDecide() {
  const steps = { leader: 0 }
  return function decide({ req }) {
    const lane = laneOf(req)
    if (lane === 'title') return { kind: 'text', content: 'a5w7 jobs wiring session' }
    if (lane === 'disc' || lane === 'other') return { kind: 'text', content: 'A5W7_NOOP_DONE' }
    const step = steps.leader
    steps.leader += 1
    const token = (n) => `a5w7-${n}-${RUN_STAMP}`
    switch (step) {
      case 0: return toolCall('team_create_member', { rootSessionId: CREATE_ROOT, requestToken: token('ca'), delegationTemplateId: 'wa', label: 'w7-a' })
      case 1: return toolCall('team_create_member', { rootSessionId: CREATE_ROOT, requestToken: token('cb'), delegationTemplateId: 'wb', label: 'w7-b' })
      default: return { kind: 'text', content: 'A5W7_L1_DONE' }
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
  return fetchJson(`${origin}/__a5w7/op`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ op: opName, args: opArgs }),
  }, 30_000)
}
async function assemblyAction(origin, action, extra = {}) {
  return fetchJson(`${origin}/__a5w7/assembly`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ action, ...extra }),
  }, 30_000)
}
const settleEvent = (jobId) => ({ event: 'dispatcher-call-cancelled-before-body', callId: jobId, abortIssuedBy: 'lane-definition-move' })

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

function scanKitFilesForWording() {
  const files = ['a5w7-kit.mjs', 'a5w7-jobs-plugin.mjs', 'README.md'].map((f) => join(KIT_DIR, f)).filter(existsSync)
  const offenders = []
  const findings = []
  // Built without the literal so the SCANNER never matches its own source line.
  const G_RE = new RegExp(['G', String.fromCharCode(45), 'g'].join(''))
  const OPEN_RE = /OPEN|PENDING-GATES/i
  // The literal-free guarantee patterns: the SCANNED FILE is this file, so a
  // pattern that matched its own source line would be a scanner bug, not a
  // finding. The CJK wording is spelled in escapes for exactly that reason.
  const GUARANTEE_RE = new RegExp([
    'termination\\s+(is\\s+)?guaranteed',
    'guaranteed\\s+termination',
    '\\u7ec8\\u6b62\\u4fdd\\u8bc1',
    '\\u4fdd\\u8bc1\\u7ec8\\u6b62',
  ].join('|'), 'i')
  for (const file of files) {
    const text = readFileSync(file, 'utf8')
    const rel = file.slice(KIT_DIR.length + 1)
    for (const line of text.split('\n')) {
      // The gate G-g may only ever be cited as OPEN here (PENDING-GATES is the
      // OPEN register) — a citation without OPEN wording is an offender.
      if (G_RE.test(line) && !OPEN_RE.test(line)) offenders.push(`${rel}: ${line.trim().slice(0, 160)}`)
      if (GUARANTEE_RE.test(line)) offenders.push(`${rel}: ${line.trim().slice(0, 160)}`)
      if (G_RE.test(line)) findings.push(`${rel}: ${line.trim().slice(0, 120)}`)
    }
  }
  return { offenders, mentions: findings }
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

// ── main ────────────────────────────────────────────────────────────────────
async function main() {
  writeFileSync(RUN_LOG, '', { flag: 'w' })
  log(`a5w7 kit ${RUN_STAMP}: host ${DSH_BASELINE_VERSION} @ ${TEST_USE_BASELINE_SHA.slice(0, 10)}; port ${HOST_PORT}; world ${HOME}`)
  if (!existsSync(HOST_BIN)) dieFatal(`pinned host build absent: ${HOST_BIN} (build tests/deepseek-harness-test-use per docs/TEST_METHODS.md §2)`)
  if (!existsSync(join(DIST_RUNTIME, 'src', 'plugin', 'host.js'))) dieFatal(`the production row is not built: ${join(DIST_RUNTIME, 'src', 'plugin', 'host.js')} (run the repo build)`)

  // ── W0a: the lane's FIRST tsc run (kit-local project; review-LaneF cond. 2)
  rmSync(LANE_BUILD, { recursive: true, force: true })
  const tsc = spawnSync(process.execPath, [join(REPO_ROOT, 'node_modules', 'typescript', 'bin', 'tsc'), '-p', join(KIT_DIR, 'tsconfig.lane.json')], { encoding: 'utf8', timeout: 240_000 })
  writeEvidence('lane-tsc-output.txt', `exit=${String(tsc.status)}\n${String(tsc.stdout ?? '')}${String(tsc.stderr ?? '')}`)
  try { writeFileSync(join(LANE_BUILD, 'package.json'), '{"type":"module"}\n') } catch { /* import leg reports */ }
  const gateImport = spawnSync(process.execPath, ['--input-type=module', '-e',
    `import(${JSON.stringify(pathToFileURL(join(LANE_BUILD, 'index.js')).href)}).then((m) => { const need = ['createJobsGateway','createLeaseWindow','classifyDispatchEvent','jobOwnerKey','projectJobForViewer','redactCredentials','gatewayRefusal','REDACTION_MARKER']; const missing = need.filter((n) => m[n] === undefined); if (missing.length > 0) { console.error('missing ' + missing.join(',')); process.exit(1) } console.log('BARREL_OK') }).catch((e) => { console.error(String(e)); process.exit(1) })`],
    { encoding: 'utf8', timeout: 60_000 })
  check('W0a', 'the UNMODIFIED lane compiles with the repo strict base via the kit-local project (first tsc pass) and its public barrel imports',
    tsc.status === 0 && String(gateImport.stdout ?? '').includes('BARREL_OK'),
    `tsc exit=${String(tsc.status)} import=${String(gateImport.stdout ?? '').trim()}/${String(gateImport.stderr ?? '').slice(0, 200)}`)
  if (!(tsc.status === 0 && String(gateImport.stdout ?? '').includes('BARREL_OK'))) dieFatal('the lane does not compile / import — nothing downstream can be honest')
  const gatewayUrl = pathToFileURL(join(LANE_BUILD, 'index.js')).href

  // ── W0b: the pinned absent-anchor, PRE state (host tree, read-only)
  const anchorPre = anchorGrep()
  writeEvidence('anchor-host-grep-pre.json', anchorPre)
  check('W0b', 'absent-anchor PRE: job_start is ZERO hits across the pinned host tree; tree at pin and porcelain-clean',
    anchorPre.hits === 0 && anchorPre.treeHead === TEST_USE_BASELINE_SHA && anchorPre.treePorcelainLines === 0,
    `hits=${String(anchorPre.hits)} head=${anchorPre.treeHead.slice(0, 10)} porcelain=${String(anchorPre.treePorcelainLines)}`)

  const stableBefore = await probeStableInstance()
  writeEvidence('stable-instance-before.json', stableBefore)
  let anchorPost = null

  mkdirSync(WORKSPACE, { recursive: true })
  mkdirSync(BLUEPRINT_DIR, { recursive: true })
  writeFileSync(join(BLUEPRINT_DIR, 'anchor.yaml'), BP_ANCHOR_YAML)
  writePatchFile(HOME, gatewayUrl)
  writeFileSync(join(HOME, 'p6t6-directive.json'), JSON.stringify({
    boot: 1, phase: 'create', reportDir: RUN_DIR, runStamp: RUN_STAMP, rootSessionId: ROOT,
  }, null, 2))
  writeFileSync(join(HOME, 'a5w7-directive.json'), JSON.stringify({
    boot: 1, runStamp: RUN_STAMP, gatewayUrl, ledger: LEDGER,
    rootSessionId: ROOT, memberRootSessionIds: [ROOT, CREATE_ROOT],
  }, null, 2))

  const mock = await startMockModel({ port: 0, decide: makeDecide(), log: () => {} })
  let host = undefined
  let origin = ''
  let cookie = ''
  let launchToken = ''
  let hostStopped = false
  try {
    host = spawnHost({ port: HOST_PORT, home: HOME, mockPort: mock.port, gatewayUrl })
    CURRENT_HOST = host
    const boot = await waitForLogLine(INSTANCE_RAW, BOOT_MARKER, 180_000, host.alive)
    if (boot === null) dieFatal(`no boot marker within 180s; log tail: ${logTail(INSTANCE_RAW)}`)
    origin = `http://127.0.0.1:${boot.m[1]}`
    launchToken = boot.m[2]
    cookie = await authenticate(origin, launchToken)

    // Row readiness: p6t6 health + state, then the a5w7 health route.
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
    const w7Health = await fetchJson(`${origin}/__a5w7/health`, undefined, 30_000)
    const noTok = await fetch(`${origin}/`, { signal: AbortSignal.timeout(10_000) }).catch(() => null)
    writeEvidence('row-health-a5w7.json', w7Health.body)
    check('W1a', 'host booted on :3184 with the production Team row + p6t6 + the a5w7 row mounted; token gate live',
      Number(boot.m[1]) === HOST_PORT && health.body?.ok === true && st.body?.teamSession !== null && noTok?.status === 401,
      `port=${String(boot.m[1])} p6t6=${String(health.body?.ok)} teamSession=${String(st.body?.teamSession !== null)} noToken=${String(noTok?.status)}`)
    check('W1b', 'the jobs-gateway is ASSEMBLED in the live process from the lane PUBLIC BARREL (row health reports the export surface)',
      w7Health.status === 200 && w7Health.body?.ok === true && w7Health.body?.gateway === 'assembled'
        && Array.isArray(w7Health.body?.publicExports) && w7Health.body.publicExports.length === 8,
      `status=${String(w7Health.status)} body=${JSON.stringify(w7Health.body ?? null).slice(0, 300)}`)
    if (!(w7Health.body?.ok === true)) log('W1b: the assembly is absent (--without-row RED control) — continuing; every op leg below fails on its own 404, and the table names what the wiring owes')

    // Discovery (the a4/a5 convention: builtinToolDeny from the LIVE surface).
    const discPrompt = await apiPrompt(origin, cookie, ROOT, MK_DISC)
    if (discPrompt.status !== 200) dieFatal(`discovery prompt not accepted (${String(discPrompt.status)})`)
    const disc = await waitForMock(mock, (r) => r.body !== null && hasMarker(r, MK_DISC) && surfaceNamesOf(r).length > 0, 180_000, 'DISC')
    if (disc === null) dieFatal('discovery model request absent; cannot compute the deny list')
    const surface = surfaceNamesOf(disc).sort()
    const denyList = surface.filter((n) => !n.startsWith('team_') && !MANAGED_TOOL_NAMES.includes(n) && !SAFE_UNMANAGED_TOOL_NAMES.includes(n))
    writeFileSync(join(BLUEPRINT_DIR, 'main.yaml'), savedBlueprintYaml(denyList))
    writeEvidence('discovery-surface.json', { surface, denyList })

    // Team session + the two members (host-generated ids, durable rows).
    const created = await remoteCall(origin, cookie, 'team.create', { rootSessionId: CREATE_ROOT, blueprintId: BP_MAIN_ID, initialWork: { prompt: MK_L1 } })
    const createOk = created.status === 200 && created.body?.result?.ok === true
    check('W2a', 'team.create (public /team-remote) starts the second session on the same host',
      createOk, `status=${String(created.status)} body=${JSON.stringify(created.body ?? created).slice(0, 300)}`)
    if (!createOk) dieFatal(`team.create failed: ${JSON.stringify(created.body ?? {}).slice(0, 400)}`)
    const leaderDone = await waitForMock(mock, (r) => r.reply?.kind === 'text' && r.reply.content === 'A5W7_L1_DONE', 180_000, 'leader chain')
    if (leaderDone === null) dieFatal('leader chain did not finish (two create-member calls + DONE)')
    const issued = mock.requests.filter((r) => r.reply?.kind === 'tool-call').flatMap((r) => (r.reply.toolCalls ?? []).map((tc) => String(tc.name)))
    const leaderResults = mock.requests.filter((r) => laneOf(r) === 'leader').flatMap((r) => toolMsgsOf(r))
    const leaderTexts = leaderResults.map((m) => String(m.text))
    const ids = [...new Set(leaderTexts.map(extractInstanceId).filter((x) => x !== null))]
    writeEvidence('leader-tool-results.json', {
      issuedToolCalls: issued,
      leaderResults: leaderResults.map((m) => ({ isError: m.isError, text: String(m.text).slice(0, 2000) })),
      extractedInstanceIds: ids,
    })
    const w7State1 = await fetchJson(`${origin}/__a5w7/state`, undefined, 30_000)
    const durableA = (w7State1.body?.durableMembers?.[CREATE_ROOT] ?? [])
    writeEvidence('durable-state.json', w7State1.body)
    // The durable read-back through the assembly is the gold channel (W2b
    // asserts on it); when the row is absent (RED control) fall back to the
    // ids the leader chain actually received, so the remaining legs still
    // evaluate against real host facts.
    const memberA = durableA.find((m) => m.templateId === 'wa') ?? (RED_NO_ROW && ids[0] !== undefined ? { instanceId: ids[0], templateId: 'wa', childSessionId: `fallback-${ids[0]}` } : undefined)
    const memberB = durableA.find((m) => m.templateId === 'wb') ?? (RED_NO_ROW && ids[1] !== undefined ? { instanceId: ids[1], templateId: 'wb', childSessionId: `fallback-${ids[1]}` } : undefined)
    check('W2b', 'two durable host members with distinct host ids and distinct child sessions (two live sessions, one host)',
      issued.filter((n) => n === 'team_create_member').length === 2
        && memberA !== undefined && memberB !== undefined
        && memberA.instanceId !== memberB.instanceId
        && memberA.childSessionId !== memberB.childSessionId
        && /^inst-/.test(memberA.instanceId) && /^inst-/.test(memberB.instanceId),
      `issued=${String(issued.filter((n) => n === 'team_create_member').length)} A=${JSON.stringify(memberA ?? null).slice(0, 160)} B=${JSON.stringify(memberB ?? null).slice(0, 160)}`)
    if (memberA === undefined || memberB === undefined) dieFatal('members absent from durable state; identity legs would be vacuous')

    const OWNER_A = { rootSessionId: CREATE_ROOT, instanceId: memberA.instanceId }
    const OWNER_B = { rootSessionId: CREATE_ROOT, instanceId: memberB.instanceId }
    const OWNER_C = { rootSessionId: ROOT, instanceId: 'inst-leader' } // the boot-root team's LEADER (a real second session)

    // ── W3 identity leg ─────────────────────────────────────────────────────
    const keyA = await op(origin, 'canonicalKey', { owner: OWNER_A })
    const expectedKeyA = `{"instanceId":${JSON.stringify(memberA.instanceId)},"rootSessionId":${JSON.stringify(CREATE_ROOT)}}`
    const admitA1 = await op(origin, 'admit', { jobId: 'w7-a-1', owner: OWNER_A, scopeKey: 'a5w7-scope-a', toolName: DEF_TOOL, pinnedIdentity: 'def-v1' })
    const admitB1dup = await op(origin, 'admit', { jobId: 'w7-a-1', owner: OWNER_B, scopeKey: 'a5w7-scope-b', toolName: DEF_TOOL, pinnedIdentity: 'def-v1' })
    const admitAdup = await op(origin, 'admit', { jobId: 'w7-a-1', owner: OWNER_A, scopeKey: 'a5w7-scope-a', toolName: DEF_TOOL, pinnedIdentity: 'def-v1' })
    const pinProbe = await op(origin, 'ownerPinProbe', { jobId: 'w7-pin-1', owner: OWNER_B })
    const stateAfterId = await fetchJson(`${origin}/__a5w7/state`, undefined, 30_000)
    const alarm = (stateAfterId.body?.observations ?? []).filter((o) => o.event === 'gateway-admit-owner-claim-conflict')
    writeEvidence('identity-leg.json', { keyA: keyA.body, expectedKeyA, admitA1: admitA1.body, admitB1dup: admitB1dup.body, admitAdup: admitAdup.body, pinProbe: pinProbe.body, alarm })
    check('W3a', 'identity: the canonical ownerKey is the lane math over the HOST-derived pair, and admission binds it',
      keyA.body?.key === expectedKeyA && admitA1.body?.ok === true && admitA1.body?.job?.ownerKey === expectedKeyA,
      `key=${String(keyA.body?.key).slice(0, 120)} admit=${JSON.stringify(admitA1.body ?? null).slice(0, 200)}`)
    check('W3b', 'identity: B re-admitting A\u2019s live jobId is owner-mismatch WITH an alarm; same-owner re-admit is duplicate-job',
      admitB1dup.body?.ok === false && admitB1dup.body?.code === 'owner-mismatch'
        && admitAdup.body?.ok === false && admitAdup.body?.code === 'duplicate-job'
        && alarm.length >= 1,
      `b=${JSON.stringify(admitB1dup.body ?? null).slice(0, 160)} dup=${JSON.stringify(admitAdup.body ?? null).slice(0, 120)} alarms=${String(alarm.length)}`)
    check('W3c', 'identity: value pin survives a post-admission mutation of the caller\u2019s object (re-verified on the live gateway)',
      pinProbe.body?.ok === true && typeof pinProbe.body?.keyAtAdmission === 'string' && pinProbe.body?.keyAtAdmission !== ''
        && pinProbe.body?.keyAtAdmission === pinProbe.body?.keyAfterMutation
        && !String(pinProbe.body?.keyAfterMutation ?? '').includes('MUTATED'),
      JSON.stringify(pinProbe.body ?? null).slice(0, 300))

    // ── W4 isolation leg (two-member mutual invisibility, list comparison) ──
    await op(origin, 'admit', { jobId: 'w7-a-2', owner: OWNER_A, scopeKey: 'a5w7-scope-a', toolName: DEF_NEIGHBOUR, pinnedIdentity: 'def-v1' })
    await op(origin, 'defPut', { scopeKey: 'a5w7-scope-a', name: DEF_TOOL, identity: 'def-v1' })
    await op(origin, 'defPut', { scopeKey: 'a5w7-scope-a', name: DEF_NEIGHBOUR, identity: 'def-v1' })
    // Every IN-FLIGHT (scope,name) must be readable before the withdrawal:
    // the lane's law is that an unreadable read counts as MOVED (no reader ⇒
    // everything moves), so leaving a pair unregistered would fake a move.
    await op(origin, 'defPut', { scopeKey: 'a5w7-scope-b', name: DEF_TOOL, identity: 'def-v1' })
    await op(origin, 'defPut', { scopeKey: 'a5w7-scope-b', name: DEF_NEIGHBOUR, identity: 'def-v1' })
    await op(origin, 'admit', { jobId: 'w7-b-3', owner: OWNER_B, scopeKey: 'a5w7-scope-b', toolName: DEF_TOOL, pinnedIdentity: 'def-v1' })
    await op(origin, 'admit', { jobId: 'w7-b-4', owner: OWNER_B, scopeKey: 'a5w7-scope-b', toolName: DEF_NEIGHBOUR, pinnedIdentity: 'def-v1' })
    const listA = await op(origin, 'list', { viewer: OWNER_A })
    const listB = await op(origin, 'list', { viewer: OWNER_B })
    const listC = await op(origin, 'list', { viewer: OWNER_C })
    const swapped = await op(origin, 'list', { viewer: { rootSessionId: ROOT, instanceId: memberA.instanceId } })
    const projX = await op(origin, 'project', { viewer: OWNER_A, jobId: 'w7-b-3' })
    const visible = (r) => (r.body?.visible ?? []).map((v) => v.jobId).sort()
    const refusedCodes = (r) => Object.fromEntries((r.body?.refused ?? []).map((x) => [x.jobId, x.code]))
    const comparison = {
      note: 'Two live members of the same host session, admitted with their durable host identities. visible/refused are the verbatim projection results of the gateway\u2019s public face (projectFor per job).',
      memberA: { ownerKey: keyA.body?.key, visible: visible(listA), refused: refusedCodes(listA) },
      memberB: { visible: visible(listB), refused: refusedCodes(listB) },
      bootRootLeaderC: { visible: visible(listC), refused: refusedCodes(listC) },
      swappedRootViewer: { visible: visible(swapped), refused: refusedCodes(swapped) },
      crossProjectionAtoB3: projX.body,
    }
    writeEvidence('isolation-comparison.json', comparison)
    check('W4a', 'isolation: each member\u2019s visible set is EXACTLY its own jobs; the other\u2019s are refused owner-mismatch (list comparison)',
      JSON.stringify(visible(listA)) === JSON.stringify(['w7-a-1', 'w7-a-2'])
        && JSON.stringify(visible(listB)) === JSON.stringify(['w7-b-3', 'w7-b-4', 'w7-pin-1'])
        && (listA.body?.refused ?? []).length === 3 && (listB.body?.refused ?? []).length === 2
        && Object.values(refusedCodes(listA)).every((c) => c === 'owner-mismatch')
        && Object.values(refusedCodes(listB)).every((c) => c === 'owner-mismatch'),
      `A=${JSON.stringify(visible(listA))} B=${JSON.stringify(visible(listB))} refusedA=${JSON.stringify(refusedCodes(listA))}`)
    check('W4b', 'isolation: the boot-root LEADER (a second real session on the host) sees nothing; a same-instanceId/different-root viewer is a different owner, refused',
      visible(listC).length === 0 && (listC.body?.refused ?? []).length === 5
        && visible(swapped).length === 0 && (swapped.body?.refused ?? []).length === 5,
      `C=${JSON.stringify(listC.body ?? null).slice(0, 160)} swapped=${JSON.stringify(swapped.body ?? null).slice(0, 160)}`)
    const leakTest = `${memberB.instanceId}|${memberB.childSessionId}|${CREATE_ROOT}`.split('|')
    const projDetail = String(projX.body?.detail ?? '')
    check('W4c', 'isolation: the cross-scope refusal is the static detail — it never carries the other member\u2019s identity',
      projX.body?.ok === false && projX.body?.code === 'owner-mismatch'
        && !leakTest.some((v) => v !== '' && projDetail.includes(v)),
      `detail=${projDetail.slice(0, 160)}`)

    // ── W5 revocation leg (row-local definition store — DISCLOSED source) ───
    await op(origin, 'defWithdraw', { scopeKey: 'a5w7-scope-a', name: DEF_TOOL })
    const regChange = await op(origin, 'registryChange', {})
    const movedIds = (regChange.body?.moved ?? []).map((m) => m.jobId).sort()
    const stateR = await fetchJson(`${origin}/__a5w7/state`, undefined, 30_000)
    const jobNow = (id) => (stateR.body?.jobs ?? []).find((j) => j.jobId === id)
    await op(origin, 'defPut', { scopeKey: 'a5w7-scope-a', name: DEF_TOOL, identity: 'def-v2' })
    const recoverAdmit = await op(origin, 'admit', { jobId: 'w7-a-5', owner: OWNER_A, scopeKey: 'a5w7-scope-a', toolName: DEF_TOOL, pinnedIdentity: 'def-v2' })
    const recoverSettle = await op(origin, 'observe', { event: settleEvent('w7-a-5') })
    const projOld = await op(origin, 'project', { viewer: OWNER_A, jobId: 'w7-a-1' })
    writeEvidence('revocation-leg.json', {
      note: 'The definition identity source is the ROW-LOCAL store (disclosed): the pinned host gives a third-party row no public seam to move another scope\u2019s Definition mid-session; the host-registry-shaped chain stays fixture-level (a5p7-mcp-rebind-chain 6/6, cited not booked). What is LIVE: the gateway law (cancel-only-what-moved, neighbour-safe, attribution pinned to the execution-time identity) on the live assembly.',
      withdrawn: { scopeKey: 'a5w7-scope-a', name: DEF_TOOL },
      moved: regChange.body?.moved,
      a1: jobNow('w7-a-1'), a2Neighbour: jobNow('w7-a-2'), b3Neighbour: jobNow('w7-b-3'),
      recoverAdmit: recoverAdmit.body, recoverSettle: recoverSettle.body, oldAttribution: projOld.body,
    })
    check('W5a', 'revocation: only the jobs whose own (scope,name) moved become cancel-requested; neighbours (same scope other name, other scope) are untouched',
      JSON.stringify(movedIds) === JSON.stringify(['w7-a-1'])
        && jobNow('w7-a-1')?.cancelRequested === true
        && jobNow('w7-a-2')?.cancelRequested === false && jobNow('w7-b-3')?.cancelRequested === false,
      `moved=${JSON.stringify(movedIds)} a1=${JSON.stringify(jobNow('w7-a-1')?.cancelRequested)} a2=${JSON.stringify(jobNow('w7-a-2')?.cancelRequested)} b3=${JSON.stringify(jobNow('w7-b-3')?.cancelRequested)}`)
    check('W5b', 'revocation→recovery: the returned Definition admits under the NEW identity and settles; the old job stays pinned to the execution-time identity',
      recoverAdmit.body?.ok === true && recoverAdmit.body?.job?.pinnedIdentity === 'def-v2'
        && recoverSettle.body?.ok === true
        && projOld.body?.ok === true && projOld.body?.view?.pinnedIdentity === 'def-v1',
      `admit=${JSON.stringify(recoverAdmit.body ?? null).slice(0, 160)} settle=${JSON.stringify(recoverSettle.body ?? null).slice(0, 80)} old=${JSON.stringify(projOld.body ?? null).slice(0, 200)}`)

    // ── W6 settle-all + clean release (self-counted zero) ───────────────────
    const liveJobs = (await fetchJson(`${origin}/__a5w7/state`, undefined, 30_000)).body?.jobs ?? []
    const settleOutcomes = []
    for (const j of liveJobs.filter((x) => x.state === 'leased')) {
      settleOutcomes.push({ jobId: j.jobId, res: (await op(origin, 'observe', { event: settleEvent(j.jobId) })).body })
    }
    const drain1 = await assemblyAction(origin, 'drain')
    const release1 = await assemblyAction(origin, 'release')
    writeEvidence('release-leg.json', { settleOutcomes, drain1: drain1.body, release1: release1.body })
    check('W6', 'lease: every lease settles while ACTIVE; drain at self-counted zero reaches RELEASED',
      settleOutcomes.every((s) => s.res?.ok === true) && drain1.body?.ok === true && release1.body?.ok === true && release1.body?.windowState === 'RELEASED',
      `settled=${String(settleOutcomes.length)} drain=${JSON.stringify(drain1.body ?? null).slice(0, 120)} release=${JSON.stringify(release1.body ?? null).slice(0, 160)}`)

    // ── W7 lease mutex + cooperative abort (no termination guarantee) ───────
    await op(origin, 'reassemble', {})
    await op(origin, 'admit', { jobId: 'w7-m-1', owner: OWNER_A, scopeKey: 'a5w7-scope-a', toolName: DEF_TOOL, pinnedIdentity: 'def-v2' })
    const mutexRefusal = await op(origin, 'admit', { jobId: 'w7-m-1', owner: OWNER_B, scopeKey: 'a5w7-scope-b', toolName: DEF_TOOL, pinnedIdentity: 'def-v2' })
    const drain2 = await assemblyAction(origin, 'drain')
    const admitWhileDraining = await op(origin, 'admit', { jobId: 'w7-m-2', owner: OWNER_B, scopeKey: 'a5w7-scope-b', toolName: DEF_TOOL, pinnedIdentity: 'def-v2' })
    const acrossBoundary = await op(origin, 'observe', { event: { event: 'dispatcher-call-terminated-after-body-start', callId: 'w7-m-1', abortIssuedBy: 'lane-definition-move' } })
    const releaseBlocked = await assemblyAction(origin, 'release')
    const giveUp = await assemblyAction(origin, 'giveup', { reason: 'kit: no termination evidence for w7-m-1' })
    const releaseAfterGiveUp = await assemblyAction(origin, 'release')
    const releaseAfterGiveUp2 = await assemblyAction(origin, 'release')
    const stateEnd = await fetchJson(`${origin}/__a5w7/state`, undefined, 30_000)
    const m1 = (stateEnd.body?.jobs ?? []).find((j) => j.jobId === 'w7-m-1')
    writeEvidence('giveup-leg.json', {
      note: 'Abort propagation is COOPERATIVE: the plane\u2019s event decides the outcome fact; the jobs face mirrors it and REFUSES to call an unsettled lease done. After giveUp the release refuses forever — the pinned no-termination-guarantee shape (G-g is OPEN; nothing here claims the Body stopped).',
      mutexRefusal: mutexRefusal.body, drain2: drain2.body, admitWhileDraining: admitWhileDraining.body,
      acrossBoundary: acrossBoundary.body, releaseBlocked: releaseBlocked.body, giveUp: giveUp.body,
      releaseAfterGiveUp: releaseAfterGiveUp.body, releaseAfterGiveUp2: releaseAfterGiveUp2.body,
      windowState: stateEnd.body?.windowState, outstanding: stateEnd.body?.outstandingCallIds, m1,
    })
    check('W7a', 'lease mutex: while A holds the jobId, B\u2019s admission is refused (owner-mismatch); after drain, NEW admissions are refused from the first instant',
      mutexRefusal.body?.ok === false && mutexRefusal.body?.code === 'owner-mismatch'
        && admitWhileDraining.body?.ok === false && admitWhileDraining.body?.code === 'gateway-not-active',
      `mutex=${JSON.stringify(mutexRefusal.body ?? null).slice(0, 140)} draining=${JSON.stringify(admitWhileDraining.body ?? null).slice(0, 140)}`)
    check('W7b', 'cooperative abort: the outcome crosses the boundary as the plane\u2019s fact (terminated-after-start, sideEffectPossible true) while the lease settle is refused and the token stays outstanding; release refuses with-outstanding and forever after giveUp',
      acrossBoundary.body?.ok === true && m1?.outcome?.kind === 'terminated-after-start' && m1?.outcome?.sideEffectPossible === true
        && m1?.state === 'settled' // outcome face recorded
        && releaseBlocked.body?.ok === false && releaseBlocked.body?.code === 'release-with-outstanding'
        && giveUp.body?.ok === true
        && releaseAfterGiveUp.body?.ok === false && releaseAfterGiveUp.body?.code === 'drain-given-up'
        && releaseAfterGiveUp2.body?.ok === false && releaseAfterGiveUp2.body?.code === 'drain-given-up'
        && stateEnd.body?.windowState === 'GIVEN_UP' && (stateEnd.body?.outstandingCallIds ?? []).includes('w7-m-1'),
      `m1=${JSON.stringify(m1?.outcome ?? null).slice(0, 200)} blocked=${JSON.stringify(releaseBlocked.body ?? null).slice(0, 100)} after=${JSON.stringify(releaseAfterGiveUp.body ?? null).slice(0, 100)} window=${String(stateEnd.body?.windowState)} outstanding=${JSON.stringify(stateEnd.body?.outstandingCallIds ?? null)}`)

    // ── W8 anchor, live + post ──────────────────────────────────────────────
    const roster = stateEnd.body?.roster ?? []
    anchorPost = anchorGrep()
    writeEvidence('anchor-runtime-roster.json', { roster, rosterHasJobStart: stateEnd.body?.rosterHasJobStart, jobStartShaped: roster.filter((n) => /job[_-]?start/i.test(n)) })
    writeEvidence('anchor-host-grep-post.json', anchorPost)
    check('W8', 'absent-anchor unchanged: host tree job_start = 0 (pre AND post), live roster carries no job-start-shaped name; the kit added no host tool',
      anchorPost.hits === 0 && anchorPost.treeHead === TEST_USE_BASELINE_SHA && anchorPost.treePorcelainLines === 0
        && stateEnd.body?.rosterHasJobStart === false && (stateEnd.body?.roster ?? []).length >= 1,
      `pre=${String(anchorPre.hits)} post=${String(anchorPost.hits)} head=${anchorPost.treeHead.slice(0, 10)} porcelain=${String(anchorPost.treePorcelainLines)} rosterJob=${JSON.stringify((stateEnd.body?.roster ?? []).filter((n) => /job/i.test(n)))}`)

    // Stop the host before the bookkeeping legs (the routes are no longer needed).
    stopHost(host)
    hostStopped = true
    await new Promise((r) => setTimeout(r, 1500))
  } finally {
    if (!hostStopped) stopHost(host)
    try { await mock.close() } catch { /* already closed */ }
    CURRENT_HOST = undefined
  }

  // ── W9 wording self-scan ──────────────────────────────────────────────────
  const wording = scanKitFilesForWording()
  writeEvidence('wording-scan.json', wording)
  check('W9', 'wording: kit files cite G-g OPEN-only and carry no termination guarantee (abort propagation is cooperative)',
    wording.offenders.length === 0 && wording.mentions.length >= 1,
    `offenders=${JSON.stringify(wording.offenders).slice(0, 300)} mentions=${String(wording.mentions.length)}`)

  // ── W10 discipline ────────────────────────────────────────────────────────
  const stableAfter = await probeStableInstance()
  writeEvidence('stable-instance-after.json', stableAfter)
  // Seal FIRST (raw stdout → redacted copy, raw deleted), then scan: a scan
  // that runs while the sanctioned raw capture still exists would report the
  // capture, not a leak.
  sealHostLog()
  const tokenOffenders = tokenScanEvidenceDir(launchToken)
  writeEvidence('token-scan.json', { offenders: tokenOffenders })
  const world = sweepWorld()
  sleepSync(400)
  const worldGone = !existsSync(HOME)
  rmSync(LANE_BUILD, { recursive: true, force: true })
  const buildGone = !existsSync(LANE_BUILD)
  const porcelain = spawnSync('git', ['-C', TESTUSE, 'status', '--porcelain'], { encoding: 'utf8' })
  const porcelainLines = String(porcelain.stdout ?? '').split('\n').filter((l) => l.trim() !== '').length
  check('W10a', 'the stable development instance (:3080) reads the same before/after and was never operated',
    stableAfter.status === stableBefore.status, `before=${String(stableBefore.status)} after=${String(stableAfter.status)}`)
  check('W10b', 'no raw launch token / auth cookie reached any evidence artifact (scan after host stop, before log seal)',
    tokenOffenders.length === 0, JSON.stringify(tokenOffenders).slice(0, 300))
  check('W10c', `world ${HOME} removed and verified; lane build dir removed; pinned tree still porcelain-clean`,
    (FLAG_KEEP || worldGone) && buildGone && porcelainLines === 0,
    `world=${world} buildGone=${String(buildGone)} porcelain=${String(porcelainLines)}`)

  writeEvidence('summary.json', {
    runStamp: RUN_STAMP,
    hostBaseline: { version: DSH_BASELINE_VERSION, sha: TEST_USE_BASELINE_SHA, clientCommitHash: CLIENT_COMMIT_HASH },
    port: HOST_PORT,
    world: { path: HOME, disposition: world },
    anchor: { pre: anchorPre, post: anchorPost },
    criteria,
  })
  const failed = criteria.filter((c) => !c.ok)
  log(`criteria: ${String(criteria.length - failed.length)}/${String(criteria.length)} pass${failed.length === 0 ? '' : ` — FAILED: ${failed.map((c) => c.id).join(', ')}`}`)
  writeReceipt(failed, world)
  process.exitCode = failed.length === 0 ? 0 : 2
}

function writeReceipt(failed, world) {
  const lines = [
    '# Alpha.5 W7 (jobs wiring) — real Host Run Receipt',
    '',
    `- run stamp: \`${RUN_STAMP}\``,
    `- host baseline: \`${DSH_BASELINE_VERSION}\` @ \`${TEST_USE_BASELINE_SHA}\` (client hash \`${CLIENT_COMMIT_HASH}\`), tree \`${testUseTree(REPO_ROOT)}\` porcelain-clean at W10c`,
    '- assembly under test: the jobs-gateway PUBLIC BARREL compiled from unmodified sources by the kit-local project (`tsconfig.lane.json` — the lane\u2019s first tsc pass; the repo `tsconfig*.json` include is GLUE\u2019s shared-file duty per WIRING-PHASE IF-5 and is NOT touched here), mounted by the `a5w7-jobs` row through the profile-patch seam beside the production `dsh-agent-team` row (this worktree\u2019s built dist)',
    `- port: \`${HOST_PORT}\` (IF-2); the stable development instance :${String(STABLE_INSTANCE_PORT)} only read, never operated — W10a`,
    `- world: \`${HOME}\` — ${world}`,
    '- redaction: credentials redacted AT CAPTURE; the Host\u2019s raw stdout is sealed and deleted; W10b scans every artifact for the raw launch token.',
    '- storm fuse: model waits abort above 300 recorded requests; waits <= 180 s.',
    '',
    '## absent-anchor (PROBE-GATED dimension, minimal reproduction)',
    '',
    `- host tree \`job_start\`: pre-run **${String(criteria.find((c) => c.id === 'W0b')?.ok ? 0 : 'NONZERO')}** / post-run **${String(criteria.find((c) => c.id === 'W8')?.ok ? 0 : 'NONZERO')}** hits (evidence \`anchor-host-grep-pre.json\` / \`anchor-host-grep-post.json\`; reproduction: \`grep -rn job_start <test-use tree>\` → 0). The live roster carries no job-start-shaped name (\`anchor-runtime-roster.json\`). The pinned Host exposes no host-side Jobs face and no public seam for a third-party row to move another scope\u2019s Definition mid-session: the host-registry-shaped revocation therefore stays PROBE-GATED at fixture level (\`a5p7-mcp-rebind-chain\`, 6/6, cited not booked), and W5 proves the gateway law on the live assembly against a DISCLOSED row-local definition store. The absent-anchor fact is re-asserted, never papered over: this kit registers NO host tool and fakes no host Jobs capability.`,
    '',
    '## Gate G-g / cancellation semantics (G-g is OPEN — cited from PENDING-GATES, not claimed)',
    '',
    '- G-g is OPEN (PENDING-GATES). Abort propagation is COOPERATIVE: the dispatch plane decides what happened; the jobs face mirrors the plane\u2019s events and never promises that a Body stopped. W7b measures the shape live: an outcome across the drain boundary is recorded while the lease settle is refused and the release refuses forever after giveUp.',
    '',
    '## criteria (verbatim)',
    '',
    '| id | verdict | detail |',
    '| --- | --- | --- |',
    ...criteria.map((c) => `| ${c.id} | ${c.ok ? 'PASS' : 'FAIL'} | ${String(c.detail).replace(/\|/g, '\\|').slice(0, 220).replace(/\n/g, ' ')} |`),
    '',
    failed.length === 0 ? 'All criteria pass.' : `FAILED: ${failed.map((c) => c.id).join(', ')}`,
    '',
  ]
  writeFileSync(join(RUN_DIR, 'run-receipt.md'), lines.join('\n'))
}

main().catch((error) => dieFatal(`kit crashed: ${error instanceof Error ? error.stack : String(error)}`))
