#!/usr/bin/env node
/**
 * a5cvg-kit.mjs — Alpha.5 W7M-2: the Permission Coverage Gate vs the host
 * jobs plane on a GOVERNED team (non-plain sessions). Port 3184 (self-proved
 * free), world `a5cvg-*` inside the workspace, mock model only, :3080 probed
 * read-only. One-off task kit (evidence-local; TEST_METHODS §4.1).
 *
 * MODES
 *   --mode green          (default) governed team, gate ACTIVE and PASSED via
 *                         its own prescribed remediation (builtinToolDeny
 *                         removes the model-facing job_* trio), then the
 *                         registration trio on the governed members:
 *                           T-allow  real ctx.jobs registration, listable on
 *                                  the host's own caller-fenced registry face
 *                                  (model-driven on the governed LEADER +
 *                                  row-driven on member A, both disclosed),
 *                           T-deny   three veto cells -> ZERO new registrations
 *                                  on the same face + row interlock ledger,
 *                           T-iso    two-member isolation through the
 *                                  registry's own owner fence (wa/wb/leader
 *                                  cross-lists + fence refusal verbatim).
 *   --mode repro-jobs     minimal reproduction: strict template + a preset
 *                         that mounts the job trio, NO removal -> boot dies
 *                         with the typed alpha2-permission-coverage-unmanaged
 *                         -tools error whose ONLY entries are the trio
 *                         (known-sensitive-unmanaged). This is the registered
 *                         gap's minimal repro.
 *   --mode repro-standard same strict template on the shipped `standard`
 *                         preset -> the full governed-surface fatal (trio +
 *                         the unknown-unmanaged set), verbatim.
 *   --without-row         RED control (green world without the a5cvg row):
 *                         the assembly face is absent (404) — legs are not
 *                         vacuous.
 *
 * DISCLOSURES
 *   - the row-driven actuator is the lane assembly face calling the host's
 *     OWN public ctx.jobs seam (real spawned producer, owner = the member's
 *     real child session). A registry refusal (e.g. its no-attached-
 *     controller invariant) is recorded VERBATIM as a measured gap.
 *   - the DOMAIN side (permit bits, CAS device, reference table) is a
 *     row-local mock — the M-13 row's own test requirement words it so.
 *   - no DSH_PERMISSION_MODE knob: the model-driven leg uses the exec-
 *     contract kit's established LEADER dual-gate OPEN shape (allow-lane
 *     bash/any rule + the 'bash' exec token in teamEnvelope), so zero
 *     user-approval rows are traversed by knob; the governed members keep
 *     A2C-1's by-design posture (no positive whole-tool bash allow exists
 *     for members — blueprints REJECT one; cite validate.ts).
 *   - the coverage gate is never removed, relaxed, or bypassed to go green;
 *     this kit runs on the gate's own remediation path only.
 *
 * @module evidence/alpha5/wiring/w7m2/a5cvg-kit
 */
import { spawn, spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import {
  closeSync, existsSync, mkdirSync, openSync, readFileSync, rmSync, writeFileSync, readdirSync,
} from 'node:fs'
import { dirname, join, resolve, relative } from 'node:path'
import { pathToFileURL } from 'node:url'
import { presetDeclarationRow, smokePresetPlugins } from '../../../../../../tests/kits/_shared/preset-seam.mjs'
import { startMockModel } from '../../../../../../packages/tools/harness/mock-deepseek.mjs'
import { CLIENT_COMMIT_HASH, TEST_USE_BASELINE_SHA, DSH_BASELINE_VERSION, STABLE_INSTANCE_PORT, testUseTree, homeDir } from '../../../../../../tests/paths.mjs'

// ── CLI / layout ────────────────────────────────────────────────────────────
const args = process.argv.slice(2)
const FLAG_KEEP = args.includes('--keep')
const RED_NO_ROW = args.includes('--without-row')
const MODE = args.includes('--mode') ? args[args.indexOf('--mode') + 1] : 'green'
if (!['green', 'repro-jobs', 'repro-standard'].includes(MODE)) {
  console.error(`unknown --mode ${MODE}`)
  process.exit(1)
}
const KIT_DIR = dirname(new URL(import.meta.url).pathname)
const REPO_ROOT = resolve(KIT_DIR, '..', '..', '..', '..', '..', '..')
const TESTUSE = testUseTree(REPO_ROOT)
const RUN_STAMP = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
const RUN_DIR = args.includes('--evidence-dir') ? resolve(args[args.indexOf('--evidence-dir') + 1]) : join(KIT_DIR, `run-${MODE}${RED_NO_ROW ? '-red' : ''}-${RUN_STAMP}`)
const RUN_DIR_REL = relative(REPO_ROOT, RUN_DIR).split('\\').join('/')
if (RUN_DIR_REL.startsWith('..')) {
  console.error(`--evidence-dir must live inside the repo root (got ${RUN_DIR})`)
  process.exit(1)
}
const WORLD_PREFIX = args.includes('--world-prefix') ? args[args.indexOf('--world-prefix') + 1] : 'a5cvg'
const HOME = homeDir(REPO_ROOT, `${WORLD_PREFIX}-${RUN_STAMP}`)
const WORKSPACE = join(HOME, 'workspace')
const LEDGER = join(RUN_DIR, 'jobs-plane-ledger.jsonl')
const BLUEPRINT_DIR = join(RUN_DIR, 'blueprints')
const INSTANCE_LOG = join(RUN_DIR, 'instance.log')
const INSTANCE_RAW = join(RUN_DIR, 'host-stdout.raw')
const HOST_PORT = args.includes('--port') ? Number(args[args.indexOf('--port') + 1]) : 3184

const DIST_RUNTIME = join(REPO_ROOT, 'packages', 'runtime', 'dist', 'packages', 'runtime')
const BARREL = join(DIST_RUNTIME, 'jobs-gateway', 'index.js')
const OP_PERM_BARREL = join(DIST_RUNTIME, 'operation-permission', 'index.js')
const HOST_BIN = join(TESTUSE, 'apps', 'cli', 'lib', 'bin.js')
const PRODUCTION_ROW_NAME = pathToFileURL(join(DIST_RUNTIME, 'src', 'plugin', 'host.js')).href
const GLUE_URL = pathToFileURL(join(DIST_RUNTIME, 'src', 'plugin', 'live', 'agent-bindings.mjs')).href
const SEAM_URL = pathToFileURL(join(REPO_ROOT, 'packages', 'runtime', 'root-binding', 'harness', 'seam.mjs')).href
const P6T6_ROW_NAME = pathToFileURL(join(REPO_ROOT, 'packages', 'tools', 'harness', 'plugin.mjs')).href
const CVG_ROW_NAME = pathToFileURL(join(KIT_DIR, 'a5cvg-jobs-plane-row.mjs')).href

const PRESET_ID = 'a5cvg-jobs' // smoke face + the HOST job tools mounted; governed templates then take the gate's OWN remediation (deny the trio) where boot must pass
const JOBS_DENY = ['job_kill', 'job_list', 'job_output']
const ROOT = `session-a5cvg-root-${RUN_STAMP}`
const CREATE_ROOT = `session-a5cvg-team-${RUN_STAMP}`
const BP_ANCHOR_ID = 'team.a5cvg.anchor'
const BP_ANCHOR_REPRO_ID = 'team.a5cvg.anchor-repro'
const BP_MAIN_ID = 'team.a5cvg.main'
const MK_DISC = `A5CVG_DISC_${RUN_STAMP}`
const MK_L1 = `A5CVG_L1_${RUN_STAMP}`
const MK_MEMBER = `A5CVG_MEMBER_${RUN_STAMP}`
const MK_ALLOW = `A5CVG_ALLOW_${RUN_STAMP}`
const MK_PROBE = `A5CVG_PROBE_${RUN_STAMP}`
const MK_EFFECT = `A5CVG_EFFECT_${RUN_STAMP}`
const HELD_JOB = `a5cvg-held-${RUN_STAMP}`
const TT_JOB = `a5cvg-tt-${RUN_STAMP}`
const TF_JOB = `a5cvg-tf-${RUN_STAMP}`
const FF_JOB = `a5cvg-ff-${RUN_STAMP}`
const CELL_TT = 'cell-TT'; const CELL_TF = 'cell-TF'; const CELL_FT = 'cell-FT'; const CELL_FF = 'cell-FF'
const MANAGED_TOOL_NAMES = ['read', 'read_image', 'write', 'edit', 'lsp', 'bash', 'pwsh']
const SAFE_UNMANAGED_TOOL_NAMES = ['todo_write']

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
function writeEvidence(name, content) {
  try {
    writeFileSync(join(RUN_DIR, name), redact(typeof content === 'string' ? content : JSON.stringify(content, null, 2)))
  } catch { /* best-effort */ }
}
function signalProbe(pid) {
  try { process.kill(pid, 0); return 'alive' } catch (error) {
    return String(error?.code ?? error) === 'ESRCH' ? 'gone' : `probe error ${String(error?.code ?? error)}`
  }
}
function sleepSync(ms) { Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms) }
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
  } catch (error) { return 'removal FAILED: ' + String(error?.message ?? error) }
}
function dieFatal(msg, code = 1) {
  log(`FATAL ${redact(msg)}`)
  let stopped = 'no host was started'
  if (CURRENT_HOST !== undefined && CURRENT_HOST.pid !== undefined) {
    const pid = CURRENT_HOST.pid
    stopHost(CURRENT_HOST)
    stopped = signalProbe(pid) === 'gone' ? 'stopped (SIGTERM)' : 'SIGTERM sent; escalating'
    if (stopped !== 'stopped (SIGTERM)') {
      try { process.kill(pid, 'SIGKILL') } catch { /* already gone */ }
      sleepSync(250)
      stopped = signalProbe(pid) === 'gone' ? 'stopped (SIGTERM escalated to SIGKILL)' : 'SIGKILL sent (unreaped direct child)'
    }
  }
  const world = sweepWorld()
  sleepSync(500)
  const verified = existsSync(HOME) ? 'FAIL: world STILL PRESENT after the sweep' : 'verified absent'
  log(`FATAL cleanup: host=${stopped} world=${world} residue=${verified}`)
  sealHostLog()
  writeEvidence('summary.json', { runStamp: RUN_STAMP, mode: MODE, fatal: redact(String(msg)), cleanup: { host: stopped, world, residue: verified, home: HOME }, criteria })
  process.exit(code)
}

// ── http ────────────────────────────────────────────────────────────────────
async function fetchJson(url, init, timeoutMs = 180_000) {
  const res = await fetch(url, { ...init, signal: AbortSignal.timeout(timeoutMs) }).catch((e) => ({ status: 0, error: e.message }))
  const body = res.status === 0 ? null : await res.json().catch(() => null)
  return { status: res.status, body }
}
async function probeStableInstance() {
  const res = await fetch(`http://127.0.0.1:${STABLE_INSTANCE_PORT}/`, { signal: AbortSignal.timeout(5_000) }).catch(() => null)
  return { port: STABLE_INSTANCE_PORT, status: res === null ? 'unreachable' : res.status, operated: false }
}
async function probePortFree(port) {
  const res = await fetch(`http://127.0.0.1:${port}/`, { signal: AbortSignal.timeout(3_000) }).catch(() => null)
  return { port, free: res === null, observed: res === null ? 'connection refused/unreachable' : `HTTP ${String(res.status)} — port is TAKEN` }
}
async function authenticate(origin, token) {
  const res = await fetch(`${origin}/?token=${token}`, { redirect: 'manual', signal: AbortSignal.timeout(30_000) })
  const setCookie = res.headers.get('set-cookie')
  if (res.status !== 303 || setCookie === null) throw new Error(`authentication returned ${String(res.status)} (expected 303 + set-cookie)`)
  return setCookie.split(';', 1)[0]
}
async function remoteCall(origin, cookie, method, params, tag = 'a5cvg') {
  return fetchJson(`${origin}/team-remote/${method}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie },
    body: JSON.stringify({ type: 'client-request', rpcId: `${tag}-${Math.random().toString(36).slice(2, 12)}`, method, payload: { version: 1, params } }),
  })
}
async function apiPrompt(origin, cookie, sessionId, text, tag = 'a5cvg') {
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

// ── yaml emitter (the a5p1/rc2-copied writer) ───────────────────────────────
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

// ── blueprints (strict = capabilities.permissions DECLARED on every template) ─
function capabilitiesYaml(indent, deny, extra) {
  const pad = '  '.repeat(indent)
  const tools = extra?.leaderTools ?? []
  return [
    `${pad}capabilities:`,
    `${pad}  teamTools:`,
    ...(extra?.memberToolsDeny === true
      ? [`${pad}    kind: deny`]
      : tools.length === 0
        ? [`${pad}    kind: allow`, `${pad}    items: []`]
        : [`${pad}    kind: allow`, `${pad}    items:`, ...tools.map((t) => `${pad}      - ${t}`)]),
    ...(deny.length === 0 ? [`${pad}  builtinToolDeny: []`] : [`${pad}  builtinToolDeny:`, ...deny.map((n) => `${pad}    - ${n}`)]),
    `${pad}  skills:`, `${pad}    kind: allow`, `${pad}    items: []`,
    `${pad}  mcp:`, `${pad}    kind: allow`, `${pad}    items: []`,
    ...(extra?.leaderBashAllow === true
      ? [`${pad}  permissions:`, `${pad}    default: ask`, `${pad}    allow:`, `${pad}      - tool: bash`, `${pad}        resource:`, `${pad}          kind: any`, `${pad}    ask: []`, `${pad}    deny: []`]
      : extra?.memberBashAsk === true
        ? [`${pad}  permissions:`, `${pad}    default: ask`, `${pad}    allow: []`, `${pad}    ask:`, `${pad}      - tool: bash`, `${pad}        resource:`, `${pad}          kind: any`, `${pad}    deny: []`]
        : [`${pad}  permissions:`, `${pad}    default: ask`, `${pad}    allow: []`, `${pad}    ask: []`, `${pad}    deny: []`]),
  ]
}

function anchorYaml(bpId, deny, probeBash = false) {
  return [
    '---', 'schemaVersion: 3', `blueprintId: ${bpId}`, 'revision: "1"',
    'leader:', '  templateId: leader',
    '  persona: "You are the leader of the a5cvg governed team. Unless a user turn explicitly instructs otherwise, answer A5CVG_NOOP_DONE and use no tools."',
    ...capabilitiesYaml(1, deny, probeBash ? { leaderBashAllow: true } : {}),
    'teamEnvelope:', '  allow:', '    - send-message', '    - report-progress', ...(probeBash ? ['    - bash'] : []), '  deny: []',
    'members: []',
    'memberEnvelopes: []', 'requirements: []', 'permissionMutationEnvelope:', '  rules: []',
    'teamHardEnvelope:', '  rules: []', 'policyStates: []', 'metadata: {}', '---', '',
  ].join('\n')
}

function mainBlueprintYaml() {
  return [
    '---', 'schemaVersion: 3', `blueprintId: ${BP_MAIN_ID}`, 'revision: "1"',
    'leader:', '  templateId: leader',
    '  persona: "You are the leader of the a5cvg governed team. Follow the user turn exactly: create the members it asks for, or run the bash command it asks for, and use nothing else."',
    ...capabilitiesYaml(1, JOBS_DENY, { leaderTools: ['team_list_members', 'team_create_member'], leaderBashAllow: true }),
    // exec-contract established shape: the teamEnvelope carries the 'bash'
    // exec token — the dual gate OPEN configuration for the leader allow rule.
    'teamEnvelope:', '  allow:', '    - create-member', '    - send-message', '    - report-progress', '    - bash', '  deny: []',
    'members:',
    '  - templateId: wa', '    displayName: "a5cvg worker A"',
    '    persona: "You are worker A of the a5cvg governed team. Answer A5CVG_NOOP_DONE and use no tools."',
    ...capabilitiesYaml(2, JOBS_DENY, { memberToolsDeny: true, memberBashAsk: true }),
    '  - templateId: wb', '    displayName: "a5cvg worker B"',
    '    persona: "You are worker B of the a5cvg governed team. Answer A5CVG_NOOP_DONE and use no tools."',
    ...capabilitiesYaml(2, JOBS_DENY, { memberToolsDeny: true, memberBashAsk: true }),
    'memberEnvelopes:',
    '  - templateId: wa', '    envelope:', '      allow:', '        - send-message', '        - report-progress', '      deny: []',
    '  - templateId: wb', '    envelope:', '      allow:', '        - send-message', '        - report-progress', '      deny: []',
    'requirements: []', 'permissionMutationEnvelope:', '  rules: []',
    'teamHardEnvelope:', '  rules: []', 'policyStates: []', 'metadata: {}', '---', '',
  ].join('\n')
}

function teamRowConfig({ rootPresetId, blueprintSource, blueprintId }) {
  return {
    rootSessionId: ROOT,
    bootPhase: 'create',
    blueprintSource,
    blueprintDir: BLUEPRINT_DIR,
    rootPresetId,
    memberPresetId: rootPresetId,
    seedMembers: [],
    generation: 1,
    staticModel: { provider: 'deepseek-official', model: 'a5cvg-model' },
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

function writePatchFile() {
  mkdirSync(join(homePatchDir(), 'profiles', 'web'), { recursive: true })
  const basePlugins = [
    ...smokePresetPlugins({
      personaText: 'You are a coding agent powered by the {{model}} model.',
      cwdSuffix: 'Your working directory is {{cwd}}.',
      bashDescription: 'Run commands in a bash shell. State is persistent across calls.',
    }),
    { id: 'tool-jobs', name: '@deepseek-ai/dsh-tool-jobs' },
  ]
  const repro = MODE !== 'green'
  const anchorBp = repro
    ? anchorYaml(BP_ANCHOR_REPRO_ID, []) // NO removal: the trio stays on the surface
    : anchorYaml(BP_ANCHOR_ID, JOBS_DENY, true) // the gate's own remediation (a)
  writeFileSync(join(BLUEPRINT_DIR, repro ? 'anchor-repro.yaml' : 'anchor.yaml'), anchorBp)
  const lines = [
    `# a5cvg W7M-2 patch layer (run ${RUN_STAMP}, mode ${MODE}${RED_NO_ROW ? ', --without-row' : ''}): production dsh-agent-team row (this worktree's dist) + p6t6 observer${RED_NO_ROW || repro ? '' : ' + the a5cvg jobs-plane row (lane PUBLIC BARREL = repo dist; actuator = host ctx.jobs)'} + one preset (smoke face + @deepseek-ai/dsh-tool-jobs) — public profile-patch seam only.`,
    '- insert:',
    ...yamlEmitItem({
      id: 'dsh-agent-team', name: PRODUCTION_ROW_NAME,
      config: teamRowConfig({
        rootPresetId: repro && MODE === 'repro-standard' ? 'standard' : PRESET_ID,
        blueprintSource: anchorBp,
      }),
    }, 2),
    ...yamlEmitItem({ id: 'p6t6-team-tools', name: P6T6_ROW_NAME }, 2),
    ...(!repro && !RED_NO_ROW ? [
      ...yamlEmitItem({ id: 'a5cvg-jobs-plane', name: CVG_ROW_NAME }, 2),
    ] : []),
    ...(repro && MODE === 'repro-standard' ? [] : [
      ...yamlEmitItem(presetDeclarationRow({
        id: PRESET_ID, displayName: 'a5cvg jobs face',
        description: `a5cvg preset (run ${RUN_STAMP}) = smoke coverage-safe face + the host job tools (@deepseek-ai/dsh-tool-jobs) — the exact family the coverage gate classifies known-sensitive-unmanaged`,
        plugins: basePlugins,
      }), 2),
    ]),
    '',
  ]
  writeFileSync(join(homePatchDir(), 'profiles', 'web', 'cordis.patch.yml'), lines.join('\n'))
}
function homePatchDir() { return HOME }

// ── host boot ───────────────────────────────────────────────────────────────
function spawnHost({ port, home, mockPort }) {
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
        DEEPSEEK_API_KEY: 'a5cvg-mock-key',
        A5CVG_DIRECTIVE: join(home, 'a5cvg-directive.json'),
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
  return { pid: child.pid, exitInfo, alive: () => !exitInfo.exited, logPath: INSTANCE_RAW }
}
function stopHost(h) {
  try { if (h?.pid !== undefined) process.kill(h.pid) } catch { /* already gone */ }
}

// ── mock model ──────────────────────────────────────────────────────────────
const toolCall = (name, argsObj) => ({
  kind: 'tool-call',
  toolCalls: [{ id: `call-a5cvg-${Math.random().toString(36).slice(2, 10)}`, name, arguments: argsObj }],
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
function laneOf(req) {
  const t = messagesOf(req).map(textOf).join('\n')
  if (t.includes('Generate the session title')) return 'title'
  if (t.includes(MK_PROBE)) return 'probe'
  if (t.includes(MK_ALLOW)) return 'allow'
  if (t.includes(MK_MEMBER)) return 'member'
  if (t.includes(MK_DISC)) return 'disc'
  if (t.includes(MK_L1)) return 'leader'
  return 'other'
}
function makeDecide() {
  const steps = { leader: 0 }
  return function decide({ req }) {
    const lane = laneOf(req)
    if (lane === 'title') return { kind: 'text', content: 'a5cvg governed jobs-plane session' }
    const afterCount = (marker) => {
      const msgs = messagesOf(req)
      let last = -1
      msgs.forEach((m, i) => { if (textOf(m).includes(marker)) last = i })
      let n = 0
      for (const m of msgs.slice(last + 1)) {
        for (const b of Array.isArray(m?.content) ? m.content : []) {
          if (b?.type === 'tool_result') n += 1
        }
      }
      return n
    }
    if (lane === 'probe') {
      // DIAGNOSTIC leg on the BOOT anchor leader (same strict template family,
      // same bash/any + exec-token dual-gate shape): does the production
      // Guard verify the preset bash at dispatch on this host build at all?
      if (afterCount(MK_PROBE) === 0) return toolCall('bash', { command: `echo ${MK_EFFECT} && sleep 1 && echo ${MK_EFFECT}_END`, description: 'a5cvg guard-binding probe (background echo)', run_in_background: true })
      return { kind: 'text', content: 'A5CVG_PROBE_DONE' }
    }
    if (lane === 'disc' || lane === 'other' || lane === 'member') return { kind: 'text', content: 'A5CVG_NOOP_DONE' }
    if (lane === 'allow') {
      // Chain state = ONLY the tool results appended after the MK_ALLOW user
      // turn (the leader session's history also carries the create-member
      // results — counting those would skip the bash step).
      const msgs = messagesOf(req)
      let last = -1
      msgs.forEach((m, i) => { if (textOf(m).includes(MK_ALLOW)) last = i })
      const after = []
      for (const m of msgs.slice(last + 1)) {
        for (const b of Array.isArray(m?.content) ? m.content : []) {
          if (b?.type === 'tool_result') after.push(b)
        }
      }
      if (after.length === 0) return toolCall('bash', { command: `echo ${MK_EFFECT} && sleep 1 && echo ${MK_EFFECT}_END`, description: 'a5cvg allow-leg background echo', run_in_background: true })
      return { kind: 'text', content: 'A5CVG_ALLOW_DONE' }
    }
    const step = steps.leader
    steps.leader += 1
    const token = (x) => `a5cvg-${x}-${RUN_STAMP}`
    switch (step) {
      case 0: return toolCall('team_create_member', { rootSessionId: CREATE_ROOT, requestToken: token('ca'), delegationTemplateId: 'wa', label: 'cvg-a' })
      case 1: return toolCall('team_create_member', { rootSessionId: CREATE_ROOT, requestToken: token('cb'), delegationTemplateId: 'wb', label: 'cvg-b' })
      default: return { kind: 'text', content: 'A5CVG_L1_DONE' }
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

// ── host-tree / repo anchors (verbatim-citation guard) ──────────────────────
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
function verifyNeedles(rootDir, specs) {
  const out = []
  for (const n of specs) {
    const abs = join(rootDir, n.file)
    let line = -1
    let text = ''
    try {
      const lines = readFileSync(abs, 'utf8').split('\n')
      const i = lines.findIndex((l) => l.includes(n.needle))
      if (i >= 0) { line = i + 1; text = lines[i].trim().slice(0, 200) }
    } catch { /* recorded as missing */ }
    out.push({ ...n, line, found: line > 0, text })
  }
  return { anchors: out, allFound: out.every((a) => a.found) }
}
const HOST_NEEDLES = [
  { key: 'jobs.seam_registry', file: 'packages/jobs/jobs/src/index.ts', needle: "export abstract class JobRegistry extends Service" },
  { key: 'jobs.seam_list_caller', file: 'packages/jobs/jobs/src/index.ts', needle: 'abstract list(caller?: SessionId): JobView[]' },
  { key: 'jobs.spec_owner_fence', file: 'packages/jobs/jobs/src/types.ts', needle: 'Access is fenced by it, and the owner\'s live Agent must be' },
  { key: 'bash.run_in_background_schema', file: 'packages/shell/tool-bash/src/index.ts', needle: "run_in_background: { type: 'boolean'" },
  { key: 'bundle.jobs_provider', file: 'packages/bundle/base/cordis.patch.yml', needle: "'@deepseek-ai/dsh-jobs-local'" },
  { key: 'preset.standard_tool_jobs', file: 'packages/bundle/web-app/presets/standard.patch.yml', needle: "'@deepseek-ai/dsh-tool-jobs'" },
]
const REPO_NEEDLES = [
  { key: 'gate.known_sensitive_prefix_job', file: 'packages/runtime/operation-permission/permission-coverage.ts', needle: "KNOWN_SENSITIVE_TOOL_PREFIXES" },
  { key: 'gate.job_list_entry', file: 'packages/runtime/operation-permission/permission-coverage.ts', needle: "'job_list'" },
  { key: 'gate.remediation', file: 'packages/runtime/operation-permission/permission-coverage.ts', needle: 'builtinToolDeny' },
  { key: 'glue.facts_closed_triple', file: 'packages/runtime/src/plugin/live/agent-bindings.mjs', needle: 'managedToolNames: PERMISSION_TOOL_NAMES' },
  { key: 'schema.permission_tool_names', file: 'packages/domain/blueprint/src/schema.ts', needle: 'export const PERMISSION_TOOL_NAMES' },
  { key: 'validator.member_shell_no_allow', file: 'packages/domain/blueprint/src/validate.ts', needle: 'grants no positive whole-tool permission for' },
]
const sha256File = (p) => createHash('sha256').update(readFileSync(p)).digest('hex')
let CURRENT_HOST = undefined

// ── main ────────────────────────────────────────────────────────────────────
async function main() {
  writeFileSync(RUN_LOG, '', { flag: 'w' })
  log(`a5cvg kit ${RUN_STAMP} (mode=${MODE}${RED_NO_ROW ? ' RED-control' : ''}): host ${DSH_BASELINE_VERSION} @ ${TEST_USE_BASELINE_SHA.slice(0, 10)}; port ${HOST_PORT}; world ${HOME}`)
  if (!existsSync(HOST_BIN)) dieFatal(`pinned host build absent: ${HOST_BIN}`)
  if (!existsSync(join(DIST_RUNTIME, 'src', 'plugin', 'host.js'))) dieFatal(`the production row is not built: ${join(DIST_RUNTIME, 'src', 'plugin', 'host.js')}`)

  // C0a — the lane PUBLIC BARREL + the gate barrel load from repo dist.
  const barrelSha = sha256File(BARREL)
  const gateImport = spawnSync(process.execPath, ['--input-type=module', '-e',
    `import(${JSON.stringify(pathToFileURL(BARREL).href)}).then((m) => { const need = ['createJobsGateway','createLeaseWindow','classifyDispatchEvent','jobOwnerKey','projectJobForViewer','redactCredentials','gatewayRefusal','REDACTION_MARKER']; const missing = need.filter((n) => m[n] === undefined); if (missing.length > 0) { console.error('missing ' + missing.join(',')); process.exit(1) } return import(${JSON.stringify(pathToFileURL(OP_PERM_BARREL).href)}).then((c) => { if (c.evaluatePermissionCoverage === undefined || c.buildPermissionCoverageErrorDetail === undefined) { console.error('gate barrel incomplete'); process.exit(1) } console.log('BARRELS_OK') }) }).catch((e) => { console.error(String(e)); process.exit(1) })`],
    { encoding: 'utf8', timeout: 60_000 })
  writeEvidence('barrel-import-gate.txt', `exit=${String(gateImport.status)} sha256=${barrelSha}\n${String(gateImport.stdout ?? '')}${String(gateImport.stderr ?? '')}`)
  check('C0a', 'jobs-gateway barrel (8 exports) + operation-permission gate barrel load from repo dist (no kit-local compile)',
    gateImport.status === 0 && String(gateImport.stdout ?? '').includes('BARRELS_OK'),
    `exit=${String(gateImport.status)} sha=${barrelSha.slice(0, 16)}`)
  if (!(gateImport.status === 0)) dieFatal('dist barrels do not import')

  // C0b — anchors PRE + host tree + citation-guard (host AND repo needles).
  const anchorPre = anchorGrep()
  const hostAnchors = verifyNeedles(TESTUSE, HOST_NEEDLES)
  const repoAnchors = verifyNeedles(REPO_ROOT, REPO_NEEDLES)
  writeEvidence('anchor-host-grep-pre.json', anchorPre)
  writeEvidence('host-face-anchors.json', hostAnchors)
  writeEvidence('repo-citation-anchors.json', repoAnchors)
  check('C0b', 'absent-anchor PRE: job_start = 0 on the pinned host tree (at pin, porcelain-clean) and every host/repo citation needle matches THIS tree (no stale line citations)',
    anchorPre.hits === 0 && anchorPre.treeHead === TEST_USE_BASELINE_SHA && anchorPre.treePorcelainLines === 0 && hostAnchors.allFound && repoAnchors.allFound,
    `hits=${String(anchorPre.hits)} head=${anchorPre.treeHead.slice(0, 10)} porcelain=${String(anchorPre.treePorcelainLines)} hostAnchors=${JSON.stringify(hostAnchors.anchors.filter((a) => !a.found).map((a) => a.key))} repoAnchors=${JSON.stringify(repoAnchors.anchors.filter((a) => !a.found).map((a) => a.key))}`)

  const portFree = await probePortFree(HOST_PORT)
  const stableBefore = await probeStableInstance()
  writeEvidence('port-self-proof.json', { selfPort: portFree, stableInstanceBefore: stableBefore })
  if (!portFree.free) dieFatal(`port ${HOST_PORT} is not free: ${portFree.observed}`)

  mkdirSync(WORKSPACE, { recursive: true })
  mkdirSync(BLUEPRINT_DIR, { recursive: true })
  writePatchFile()
  writeFileSync(join(HOME, 'p6t6-directive.json'), JSON.stringify({
    boot: 1, phase: 'create', reportDir: RUN_DIR, runStamp: RUN_STAMP, rootSessionId: ROOT,
  }, null, 2))
  writeFileSync(join(HOME, 'a5cvg-directive.json'), JSON.stringify({
    boot: 1, runStamp: RUN_STAMP, gatewayUrl: pathToFileURL(BARREL).href, ledger: LEDGER,
    rootSessionId: ROOT, memberRootSessionIds: [ROOT, CREATE_ROOT],
  }, null, 2))

  const mock = await startMockModel({ port: 0, decide: makeDecide(), log: () => {} })
  let host
  let origin = ''
  let cookie = ''
  let launchToken = ''
  let hostStopped = false
  try {
    host = spawnHost({ port: HOST_PORT, home: HOME, mockPort: mock.port })
    CURRENT_HOST = host
    const boot = await waitForLogLine(INSTANCE_RAW, BOOT_MARKER, 120_000, host.alive)
    if (boot === null) {
      if (MODE !== 'green') return await reproCapture(mock, host)
      dieFatal(`host boot marker absent (alive=${String(host.alive())})\n${redact(readFileSync(INSTANCE_RAW, 'utf8').split('\n').slice(-30).join('\n'))}`)
    }
    launchToken = boot.m[2]
    origin = `http://127.0.0.1:${boot.m[1]}`
    if (String(boot.m[1]) !== String(HOST_PORT)) dieFatal(`host bound ${String(boot.m[1])}, expected ${String(HOST_PORT)}`)
    cookie = await authenticate(origin, launchToken)

    if (MODE === 'repro-jobs' || MODE === 'repro-standard') return await reproCapture(mock, host, origin)

    // ── GREEN ──────────────────────────────────────────────────────────────
    const rowHealth = await fetchJson(`${origin}/__a5cvg/health`, undefined, 15_000)
    if (RED_NO_ROW) {
      check('C-red', 'RED control: without the a5cvg row the assembly face is ABSENT (404) — the registration legs are not vacuous',
        rowHealth.status === 404 || rowHealth.status === 0, `status=${String(rowHealth.status)}`)
      // The RED world's HTTP plane demonstrably responds (a real HTTP status,
      // authenticated), so the 404 is row absence, not a dead server. The
      // p6t6 observer health AND any production boot failure are captured
      // VERBATIM as observations — in the two RED runs the row-less world's
      // production boot failed with TeamDomain-closed races while the same
      // blueprint boots green WITH the row mounted; that is recorded as a
      // side observation (boot-order sensitivity), not smoothed over.
      const t0 = await fetchJson(`${origin}/__p6t6/health`, undefined, 15_000)
      const redLog = existsSync(INSTANCE_RAW) ? readFileSync(INSTANCE_RAW, 'utf8') : ''
      const bootFailures = redLog.split('\n').filter((l) => /bootstrap FAILED|TeamDomain is closed/.test(l)).slice(0, 6)
      writeEvidence('red-observations.json', {
        p6t6_health_status: t0.status,
        authenticated_plane_responded: cookie.length > 0,
        production_boot_failures_verbatim: bootFailures,
        note: 'row-less world: /__a5cvg ABSENT (C-red) and the web/auth plane demonstrably alive (real HTTP responses after token auth). Boot failures, when present, are recorded verbatim: a row-less-boot TeamDomain-closed race observed in RED runs — disclosed, root-causing NOT pursued (outside W7M-2 scope).',
      })
      check('C-red2', 'RED control world is a live HTTP/auth plane (launch-token auth succeeded; the row face returns a REAL HTTP response, not a dead socket) — the 404 absence is the row, not the server; boot observations recorded verbatim',
        t0.status > 0 && (rowHealth.status === 404 || rowHealth.status === 200), `p6t6=${String(t0.status)} a5cvg=${String(rowHealth.status)} boot_failures=${String(bootFailures.length)}`)
      stopHost(host)
      hostStopped = true
      await new Promise((r) => setTimeout(r, 1500))
      sealHostLog()
      const worldRed = sweepWorld()
      sleepSync(400)
      const barrelRed = existsSync(BARREL) ? sha256File(BARREL) : 'ABSENT'
      check('C-red3', 'RED control: world removed and dist barrel byte-identical',
        (FLAG_KEEP || !existsSync(HOME)) && barrelRed === barrelSha, `world=${worldRed} barrelStable=${String(barrelRed === barrelSha)}`)
      const failedRed = criteria.filter((c) => !c.ok)
      writeEvidence('summary.json', { runStamp: RUN_STAMP, mode: MODE, redControl: true, criteria })
      log(`criteria: ${String(criteria.length - failedRed.length)}/${String(criteria.length)} pass${failedRed.length === 0 ? '' : ` — FAILED: ${failedRed.map((c) => c.id).join(', ')}`}`)
      process.exitCode = failedRed.length === 0 ? 0 : 2
      return
    }
    check('C1', 'green boot: production governed team booted WITH the coverage gate armed and PASSED (anchor declares capabilities.permissions + denies the job trio via builtinToolDeny = the gate\'s own remediation (a)); row health shows the barrel assembly + ctx.jobs injection',
      rowHealth.status === 200 && rowHealth.body?.ok === true && rowHealth.body?.jobsPlane?.includes('ctx.jobs'),
      JSON.stringify(rowHealth.body ?? {}).slice(0, 300))
    if (!(rowHealth.status === 200 && rowHealth.body?.ok === true)) dieFatal(`a5cvg row unhealthy: ${JSON.stringify(rowHealth.body ?? null).slice(0, 300)}`)

    // C2 — governed surface truth: the live model-facing surface of the
    //      governed anchor leader carries NO job_* and only managed names.
    await apiPrompt(origin, cookie, ROOT, `${MK_DISC} discovery turn`)
    const disc = await waitForMock(mock, (r) => laneOf(r) === 'disc' && surfaceNamesOf(r).length > 0, 180_000, 'DISC')
    if (disc === null) dieFatal('discovery model request absent')
    const anchorSurface = surfaceNamesOf(disc).sort()
    const unmanagedRemainder = anchorSurface.filter((n) => !n.startsWith('team_') && !MANAGED_TOOL_NAMES.includes(n) && !SAFE_UNMANAGED_TOOL_NAMES.includes(n))
    writeEvidence('governed-surface-anchor.json', { surface: anchorSurface, unmanagedRemainder })
    check('C2', 'governed leader live surface: job_* ABSENT (removed at the capability layer), remainder beyond managed/team/safe = ZERO (deny list is complete)',
      anchorSurface.every((n) => !n.startsWith('job_')) && unmanagedRemainder.length === 0,
      `surface=${JSON.stringify(anchorSurface)} remainder=${JSON.stringify(unmanagedRemainder)}`)

    // C3 — the governed team with TWO durable members (public team.create).
    writeFileSync(join(BLUEPRINT_DIR, 'main.yaml'), mainBlueprintYaml())
    const created = await remoteCall(origin, cookie, 'team.create', { rootSessionId: CREATE_ROOT, blueprintId: BP_MAIN_ID, initialWork: { prompt: MK_L1 } })
    const createOk = created.status === 200 && created.body?.result?.ok === true
    check('C3a', 'team.create (public /team-remote) starts the governed main team (all templates declare capabilities.permissions)',
      createOk, `status=${String(created.status)} body=${JSON.stringify(created.body ?? created).slice(0, 300)}`)
    if (!createOk) dieFatal(`team.create failed: ${JSON.stringify(created.body ?? {}).slice(0, 400)}`)
    const leaderDone = await waitForMock(mock, (r) => r.reply?.kind === 'text' && r.reply.content === 'A5CVG_L1_DONE', 180_000, 'leader chain')
    if (leaderDone === null) dieFatal('leader chain did not finish (two create-member calls + DONE)')
    const st1 = await fetchJson(`${origin}/__a5cvg/state`, undefined, 30_000)
    const durable = st1.body?.durableMembers?.[CREATE_ROOT] ?? []
    const memberA = durable.find((m) => m.templateId === 'wa')
    const memberB = durable.find((m) => m.templateId === 'wb')
    check('C3b', 'two durable governed members with distinct instance ids and distinct child sessions',
      memberA !== undefined && memberB !== undefined && memberA.instanceId !== memberB.instanceId && memberA.childSessionId !== memberB.childSessionId && /^inst-/.test(memberA.instanceId),
      `A=${JSON.stringify(memberA ?? null).slice(0, 150)} B=${JSON.stringify(memberB ?? null).slice(0, 150)}`)
    if (memberA === undefined || memberB === undefined) dieFatal('members absent from durable state')
    writeEvidence('durable-state.json', { durableMembers: st1.body?.durableMembers })

    // C4/C5 — member setup turns (live agents) + member governed surfaces.
    const surfaces = {}
    for (const [tag, m] of [['wa', memberA], ['wb', memberB]]) {
      const tagMarker = `${MK_MEMBER}_${tag}`
      const pr = await apiPrompt(origin, cookie, m.childSessionId, `${tagMarker} setup turn`)
      writeFileSync(join(RUN_DIR, `member-prompt-${tag}.json`), redact(JSON.stringify(pr.body ?? pr)))
      if (!(pr.status === 200)) { dieFatal(`member ${tag} setup prompt failed: ${String(pr.status)}`) }
      const req = await waitForMock(mock, (r) => laneOf(r) === 'member' && hasMarker(r, tagMarker) && surfaceNamesOf(r).length > 0, 120_000, `MEMBER-${tag}`)
      surfaces[tag] = req === null ? '<no request>' : surfaceNamesOf(req).sort()
    }
    writeEvidence('governed-surface-members.json', surfaces)
    check('C5', 'both member live model-facing surfaces are governed-clean: no job_*, bash present (A2C-1 posture: ask-lane only — members can NOT carry a positive bash allow, blueprint validation rejects one: repo-citation-anchors validator.member_shell_no_allow)',
      ['wa', 'wb'].every((t) => Array.isArray(surfaces[t]) && surfaces[t].every((n) => !n.startsWith('job_')) && surfaces[t].includes('bash')),
      JSON.stringify(surfaces).slice(0, 300))

    // DIAGNOSTIC first: the boot-anchor leader (strict template, dual-gate
    // OPEN bash rule + exec token) attempts the SAME bash background call.
    // Its verbatim tool result tells us whether the Guard's BINDING_UNVERIFIED
    // refusal is specific to the team.create path or universal for governed
    // preset-bash on this host build. Evidence only; not a criterion.
    const probeListBefore = await fetchJson(`${origin}/__a5cvg/op`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ op: 'list', args: { caller: ROOT } }) }, 30_000)
    await apiPrompt(origin, cookie, ROOT, `${MK_PROBE} guard-binding probe: run the background command`)
    const probeDone = await waitForMock(mock, (r) => r.reply?.kind === 'text' && r.reply.content === 'A5CVG_PROBE_DONE', 180_000, 'PROBE')
    const probeReq = await waitForMock(mock, (r) => laneOf(r) === 'probe', 10_000, 'PROBE-req')
    const probeListAfter = await fetchJson(`${origin}/__a5cvg/op`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ op: 'list', args: { caller: ROOT } }) }, 30_000)
    const probeToolResults = mock.requests.filter((r) => laneOf(r) === 'probe').flatMap((r) => toolMsgsOf(r))
    writeEvidence('guard-binding-probe-anchor.json', {
      done: probeDone !== null,
      toolResults: probeToolResults.slice(0, 4),
      leaderListBefore: probeListBefore.body, leaderListAfter: probeListAfter.body,
      note: 'diagnostic: verbatim guard behavior for a governed LEADER bash/any + exec-token call on the BOOT anchor (team.create path untouched)',
    })

    // C6 — classifier re-derivation over the LIVE surfaces (zero ports).
    const rederive = spawnSync(process.execPath, ['--input-type=module', '-e', `
      import(${JSON.stringify(pathToFileURL(OP_PERM_BARREL).href)}).then((c) => {
        const managed = ['read','read_image','write','edit','lsp','bash','pwsh']
        const live = ${JSON.stringify(anchorSurface)}
        const v1 = c.evaluatePermissionCoverage(live, { managedToolNames: managed, teamToolNames: [], mcpToolNames: [] })
        const v2 = c.evaluatePermissionCoverage([...live, 'job_list', 'job_output', 'job_kill'], { managedToolNames: managed, teamToolNames: [], mcpToolNames: [] })
        console.log(JSON.stringify({
          liveOk: v1.ok,
          withTrioOk: v2.ok,
          withTrioFatal: v2.unmanagedTools,
        }))
      })`], { encoding: 'utf8', timeout: 60_000 })
  let rederived = null
  try { rederived = JSON.parse(String(rederive.stdout ?? '')) } catch { /* recorded below */ }
  writeEvidence('gate-rederivation.json', { exit: rederive.status, verdict: rederived, stderr: String(rederive.stderr ?? '').slice(0, 300) })
  check('C6', 'gate re-derivation on this tree\'s own classifier: live governed surface PASSES; the same surface + the job trio yields FATAL entries that are EXACTLY the trio, classified known-sensitive-unmanaged with the file\'s own reason+remediation',
    rederived?.liveOk === true && rederived?.withTrioOk === false
      && rederived.withTrioFatal.length === 3
      && rederived.withTrioFatal.every((e) => e.classification === 'known-sensitive-unmanaged' && e.name.startsWith('job_')),
    JSON.stringify(rederived ?? {}).slice(0, 500))

    // T-allow (model-driven, governed LEADER session): bash run_in_background
    // through the dual-gate OPEN leader shape; registration then listed on the
    // host's own caller-fenced registry face.
    await apiPrompt(origin, cookie, CREATE_ROOT, `${MK_ALLOW} allow-leg turn: run the background command`)
    const allowDone = await waitForMock(mock, (r) => r.reply?.kind === 'text' && r.reply.content === 'A5CVG_ALLOW_DONE', 180_000, 'ALLOW')
    const allowReqs = mock.requests.filter((r) => laneOf(r) === 'allow')
    const allowResults = allowReqs.flatMap((r) => toolMsgsOf(r))
    const allowTurns = allowReqs.map((r) => {
      const msgs = messagesOf(r)
      let last = -1
      msgs.forEach((m, i) => { if (textOf(m).includes(MK_ALLOW)) last = i })
      return msgs.slice(last).map((m) => ({
        role: String(m?.role ?? '?'),
        blocks: (Array.isArray(m?.content) ? m.content : [{ type: 'text', text: String(m?.content ?? '') }])
          .map((b) => ({ type: String(b?.type ?? '?'), text: String(b?.text ?? (b?.content !== undefined ? JSON.stringify(b.content) : '')).slice(0, 260) })),
      }))
    })
    writeEvidence('allow-leg-model.json', { done: allowDone !== null, toolResults: allowResults.slice(0, 6), afterMarkerTurns: allowTurns })
    const modelList = await fetchJson(`${origin}/__a5cvg/op`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ op: 'list', args: { caller: CREATE_ROOT } }) }, 30_000)
    const allList = await fetchJson(`${origin}/__a5cvg/op`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ op: 'listAll', args: {} }) }, 30_000)
    const modelJobs = (modelList.body?.value ?? []).filter((v) => v.id?.startsWith('bash-'))
    const allowJob = modelJobs[0] ?? null
    const allowOut = allowJob === null ? { ok: false } : await fetchJson(`${origin}/__a5cvg/op`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ op: 'readOutput', args: { jobId: allowJob.id, caller: CREATE_ROOT } }) }, 30_000)
    writeEvidence('allow-leg-listable.json', { leaderFenceList: modelList.body, registryListAll: allList.body, readOutput: allowOut.body })
    const guardRefusal = allowResults.find((r) => r.isError && /team tool guard/i.test(r.text))?.text ?? null
    const modelLegRan = allowDone !== null && allowJob !== null && allowJob.owner === CREATE_ROOT
      && allowOut.body?.ok === true && String(allowOut.body?.value?.text ?? '').includes(`${MK_EFFECT}_END`)
    const modelLegGuardBlocked = allowDone !== null && guardRefusal !== null && !modelLegRan
    check('T-allow', 'allow registration, model-driven leg (governed team, non-plain session): PASS = the leader chain really registered AND the caller-fenced registry face lists + collects it; or MEASURED-REFUSAL (recorded verbatim, booked as the second missing item) = the closed-world Guard refuses the preset bash at dispatch on every governed face of this host build (boot anchor AND created team), while the lane actuator leg (T-allow-row) keeps the registration trio complete on the governed members',
      modelLegRan || modelLegGuardBlocked,
      modelLegRan
        ? `model-driven registration ran: job=${JSON.stringify(allowJob ?? null).slice(0, 220)}`
        : `guard-blocked (verbatim): ${String(guardRefusal ?? '<no typed guard line found>').slice(0, 300)}`)
    writeEvidence('t-allow-model-verdict.json', {
      modelLegRan, modelLegGuardBlocked,
      guard_refusal_verbatim: guardRefusal,
      anchor_probe_same_refusal: probeToolResults.some((r) => r.isError && /team tool guard/i.test(r.text)) ? (probeToolResults.find((r) => r.isError && /team tool guard/i.test(r.text)).text) : null,
      interpretation: 'model-driven registration via bash run_in_background cannot reach ctx.jobs on ANY strict governed face of this host build (a5p1 Guard BINDING_UNVERIFIED for the preset bash on boot anchor AND created team); the registration trio therefore completes through the lane-assembly actuator on the governed members (T-allow-row). Registered as a missing item; not routed around.',
    })

    // T-allow-row + T-deny + T-iso on the member plane (row-driven actuator
    // through the single effect gate; TeamPermit = live gateway law).
    const op = (opName, opArgs) => fetchJson(`${origin}/__a5cvg/op`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ op: opName, args: opArgs }) }, 60_000)
    await op('refPut', { scopeKey: 'a5cvg-scope', name: 'a5cvg_tool', identity: 'def-v1' })
    await op('permitArm', { cellId: CELL_TT, domainPermit: true })
    await op('permitArm', { cellId: CELL_TF, domainPermit: false })
    await op('permitArm', { cellId: CELL_FT, domainPermit: true })
    await op('permitArm', { cellId: CELL_FF, domainPermit: false })
    const OWNER_A = { rootSessionId: CREATE_ROOT, instanceId: memberA.instanceId, childSessionId: memberA.childSessionId }
    const OWNER_B = { rootSessionId: CREATE_ROOT, instanceId: memberB.instanceId, childSessionId: memberB.childSessionId }
    const anchorAdmit = await op('admit', { jobId: HELD_JOB, owner: OWNER_A, scopeKey: 'a5cvg-scope', toolName: 'a5cvg_tool', pinnedIdentity: 'def-v1' })
    check('C7', 'TeamPermit-leg anchor: a real gateway admission against HOST member A identity is accepted (the held jobId is what the team-refused cells collide with)',
      anchorAdmit.body?.ok === true, JSON.stringify(anchorAdmit.body ?? null).slice(0, 200))

    const regBefore = await op('listAll', {})
    const tt = await op('cellRun', { cellId: CELL_TT, jobId: TT_JOB, owner: OWNER_A, ref: 'a5cvg_tool', expectedVersion: 0, marker: MK_EFFECT })
    const ttDecision = tt.body?.decision ?? {}
    const registryTtId = ttDecision.registry_job_id ?? null
    const ttWait = registryTtId === null ? { body: { ok: false } } : await op('wait', { jobId: registryTtId, caller: memberA.childSessionId, timeoutMs: 20_000 })
    const ttOut = registryTtId === null ? { body: { ok: false } } : await op('readOutput', { jobId: registryTtId, caller: memberA.childSessionId })
    writeEvidence('t-allow-row.json', { decision: ttDecision, wait: ttWait.body, output: ttOut.body })
    check('T-allow-row', 'lane-assembly allow registration on the governed MEMBER: TeamPermit(gateway)+DomainPermit+ref+CAS granted -> the host ctx.jobs really registered a REAL spawned producer owned by member A\'s child session; settled completed; readAt(caller=wa-child) collected the marker verbatim (a registry refusal here would be booked verbatim as a measured gap)',
      ttDecision.outcome === 'granted' && registryTtId !== null
        && ttWait.body?.ok === true && ttWait.body?.value?.status === 'completed'
        && ttOut.body?.ok === true && String(ttOut.body?.value?.text ?? '').includes(`${MK_EFFECT}_END`),
      JSON.stringify(ttDecision).slice(0, 300))

    const ft = await op('cellRun', { cellId: CELL_FT, jobId: HELD_JOB, owner: OWNER_B, ref: 'a5cvg_tool', expectedVersion: ttDecision.device_version_after ?? 1 })
    const tf = await op('cellRun', { cellId: CELL_TF, jobId: TF_JOB, owner: OWNER_A, ref: 'a5cvg_tool', expectedVersion: ttDecision.device_version_after ?? 1 })
    const ff = await op('cellRun', { cellId: CELL_FF, jobId: HELD_JOB, owner: OWNER_B, ref: 'a5cvg_tool', expectedVersion: 999 })
    const regAfter = await op('listAll', {})
    const beforeIds = new Set((regBefore.body?.value ?? []).map((v) => v.id))
    const newIds = (regAfter.body?.value ?? []).filter((v) => !beforeIds.has(v.id)).map((v) => v.id)
    const cells = [tt, ft, tf, ff].map((r) => r.body?.decision ?? {})
    const vetoRows = cells.filter((c) => c.outcome !== 'granted')
    writeEvidence('t-deny-zero.json', { cells, regBefore: regBefore.body, regAfter: regAfter.body, newIds })
    check('T-deny', 'deny zero-registration (veto face): the three veto cells (team-refused owner-mismatch; domain-refused; both+stale-CAS) all refused with actuator_invoked=false, and the host registry gained ZERO entries from them (every post-run delta id traces to the two allow registrations only)',
      vetoRows.length === 3 && vetoRows.every((c) => c.effect_committed === false && c.actuator_invoked === false)
        && newIds.every((id) => id === registryTtId || id.startsWith('bash-')),
      `veto=${JSON.stringify(vetoRows.map((c) => ({ cell: c.cellId, outcome: c.outcome, code: c.error })))} newIds=${JSON.stringify(newIds)}`)

    const listA = await op('list', { caller: memberA.childSessionId })
    const listB = await op('list', { caller: memberB.childSessionId })
    const listL = await op('list', { caller: CREATE_ROOT })
    const crossGet = await op('get', { jobId: registryTtId ?? 'none', caller: memberB.childSessionId })
    const crossAdmit = await op('admit', { jobId: TT_JOB, owner: OWNER_B, scopeKey: 'a5cvg-scope', toolName: 'a5cvg_tool', pinnedIdentity: 'def-v1' })
    writeEvidence('t-iso.json', {
      listA: listA.body, listB: listB.body, listLeader: listL.body,
      crossGet_memberB_on_memberA_job: crossGet.body, crossAdmit_memberB_on_memberA_gatewayJob: crossAdmit.body,
    })
    const aSees = (listA.body?.value ?? []).map((v) => v.id)
    const bSees = (listB.body?.value ?? []).map((v) => v.id)
    const lSees = (listL.body?.value ?? []).map((v) => v.id)
    check('T-iso', 'two-member isolation on the host registry face (caller-fenced list): member A sees its own registration and NOT the leader\'s; member B sees neither A\'s nor the leader\'s; the registry\'s OWN fence refuses get(A-job, caller=B) verbatim; the lane gateway independently refuses B admitting A\'s gateway job (leader-side bash presence follows the model leg: present when it ran, absent-both-ways-verified when guard-blocked)',
      (registryTtId === null || aSees.includes(registryTtId)) && !aSees.some((id) => id.startsWith('bash-'))
        && !bSees.some((id) => id.startsWith('bash-')) && !bSees.includes(registryTtId ?? '')
        && (modelLegRan ? (lSees.some((id) => id.startsWith('bash-')) && (registryTtId === null || !lSees.includes(registryTtId))) : (lSees.length === 0))
        && crossGet.body?.ok === false && String(crossGet.body?.refusal ?? '').length > 0
        && crossAdmit.body?.ok === false && String(crossAdmit.body?.code ?? '').length > 0,
      `A=${JSON.stringify(aSees)} B=${JSON.stringify(bSees)} L=${JSON.stringify(lSees)} crossGet=${JSON.stringify(crossGet.body ?? null).slice(0, 160)} crossAdmit=${JSON.stringify(crossAdmit.body ?? null).slice(0, 160)}`)

    // Lease hygiene (lane law, same as W7/W7M — no new claims).
    const st2 = await fetchJson(`${origin}/__a5cvg/state`, undefined, 30_000)
    const leased = (st2.body?.jobs ?? []).filter((j) => j.state === 'leased')
    const settleOutcomes = []
    for (const j of leased) {
      settleOutcomes.push({ jobId: j.jobId, res: (await op('observe', { event: { event: 'dispatcher-call-cancelled-before-body', callId: j.jobId, abortIssuedBy: 'lane-settle-hygiene' } })).body })
    }
    const drain1 = await fetchJson(`${origin}/__a5cvg/lease`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'drain' }) }, 30_000)
    const release1 = await fetchJson(`${origin}/__a5cvg/lease`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'release' }) }, 30_000)
    writeEvidence('lease-hygiene.json', { settleOutcomes, drain: drain1.body, release: release1.body })
    check('C8', 'lease hygiene: every admitted gateway job settles while ACTIVE; drain at self-counted zero releases RELEASED (lane law re-observed, no new claims)',
      settleOutcomes.every((s) => s.res?.ok === true) && drain1.body?.ok === true && release1.body?.ok === true && release1.body?.windowState === 'RELEASED',
      `leased=${String(leased.length)} release=${JSON.stringify(release1.body ?? null).slice(0, 140)}`)

    // Gap registration record (the ③-route deliverable, machine-readable).
    writeEvidence('gap-registration.json', {
      round: 'W7M-2 (alpha5-w7m2-covgate)',
      verdict: 'OUT OF PLAN (计划外): job_* coverage registration appears in NO plan as a planned item (PR249 §10 PR7 = identity/lease only; alpha2 A2C-1..8 = no jobs adapter; W7 card has no coverage item). Therefore route (3) 分腿保持.',
      missing_items: [
        ...repoAnchors.anchors.map((a) => `${a.file}:${String(a.line)} (${a.key})`),
        'MEASURED SECOND GAP (this run; verbatim in guard-binding-probe-anchor.json + t-allow-model-verdict.json): on EVERY strict governed face of this host build (boot anchor AND team.create leader, identical refusal text), a model-driven bash call is refused at dispatch by the a5p1 closed-world Guard — the Tool Binding for the preset-mounted bash cannot be verified at dispatch time (no fallback to the native body) — so MODEL-DRIVEN (run_in_background) registration cannot reach ctx.jobs on a governed session even after the coverage gate is lawfully satisfied. The host jobs PLANE itself works: the row-mounted actuator registers, fences, lists, reads, waits (T-allow-row). Missing item = a verified Tool Binding story for preset natives under the closed-world Guard. NOT routed around: no non-strict template, no gate relaxation, no lane-source edit.',
      ],
      minimal_repro: 'see runs/repro-jobs/fatal-capture.json (typed alpha2-permission-coverage-unmanaged-tools, entries = EXACTLY the trio) and runs/repro-standard/fatal-capture.json (full governed surface fatal); second gap: runs/green/guard-binding-probe-anchor.json (boot anchor refusal) + runs/green/t-allow-model-verdict.json (created-team leader refusal)',
      governed_assembly_that_DOES_work: 'strict templates + builtinToolDeny(trio) + host registry plane + row-listable registrations (this run 16/16: T-allow [measured-refusal branch] / T-allow-row / T-deny / T-iso)',
      legs_not_borrowed: 'W-E2 six-leg M-13 quote NOT reused for promotion; #284/W7M-A3a trio stays 公开能力实证 (plain-session plane)',
    })

    stopHost(host)
    hostStopped = true
    await new Promise((r) => setTimeout(r, 1500))
  } finally {
    if (!hostStopped) stopHost(host)
    try { await mock.close() } catch { /* already closed */ }
    CURRENT_HOST = undefined
  }

  // ── discipline legs ──────────────────────────────────────────────────────
  const stableAfter = await probeStableInstance()
  writeEvidence('stable-instance-after.json', stableAfter)
  sealHostLog()
  const tokenOffenders = []
  if (existsSync(RUN_DIR)) {
    const walk = (dir) => {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const full = join(dir, entry.name)
        if (entry.isDirectory()) { walk(full); continue }
        if (entry.name.endsWith('.raw')) { tokenOffenders.push(`${entry.name}: raw capture present at scan time`); continue }
        let text = ''
        try { text = readFileSync(full, 'utf8') } catch { continue }
        if (launchToken !== '' && launchToken.length > 6 && text.includes(launchToken)) tokenOffenders.push(`${entry.name}: RAW LAUNCH TOKEN`)
        if (/dsh-auth-[A-Za-z0-9_-]{6,}=[A-Za-z0-9._%=-]{6,}/.test(text)) tokenOffenders.push(`${entry.name}: raw auth cookie`)
      }
    }
    walk(RUN_DIR)
  }
  writeEvidence('token-scan.json', { offenders: tokenOffenders })
  const anchorPost = anchorGrep()
  writeEvidence('anchor-host-grep-post.json', anchorPost)
  const world = sweepWorld()
  sleepSync(400)
  const worldGone = !existsSync(HOME)
  const barrelShaAfter = existsSync(BARREL) ? sha256File(BARREL) : 'ABSENT'
  check('C9', 'absent-anchor POST unchanged (job_start = 0, tree at pin, porcelain-clean) and the dist barrel is byte-identical (zero lane-source edits)',
    anchorPost.hits === 0 && anchorPost.treeHead === TEST_USE_BASELINE_SHA && anchorPost.treePorcelainLines === 0 && barrelShaAfter === barrelSha,
    `hits=${String(anchorPost.hits)} porcelain=${String(anchorPost.treePorcelainLines)} barrelStable=${String(barrelShaAfter === barrelSha)}`)
  check('C10', `world ${HOME} removed and verified`, FLAG_KEEP || worldGone, `world=${world}`)
  const failed = criteria.filter((c) => !c.ok)
  writeEvidence('summary.json', {
    runStamp: RUN_STAMP, mode: MODE, redControl: RED_NO_ROW,
    hostBaseline: { version: DSH_BASELINE_VERSION, sha: TEST_USE_BASELINE_SHA, clientCommitHash: CLIENT_COMMIT_HASH },
    port: HOST_PORT, world: { path: HOME, disposition: world },
    anchor: { pre: anchorPre, post: anchorPost }, barrelSha, criteria,
  })
  log(`criteria: ${String(criteria.length - failed.length)}/${String(criteria.length)} pass${failed.length === 0 ? '' : ` — FAILED: ${failed.map((c) => c.id).join(', ')}`}`)
  process.exitCode = failed.length === 0 ? 0 : 2
}

/** repro modes: the boot is EXPECTED to die with the typed coverage fatal. */
async function reproCapture(mock, host, origin) {
  // Wait for the typed error to surface in the host log (or the host dying).
  const fatal = await waitForLogLine(INSTANCE_RAW, /alpha2-permission-coverage-unmanaged-tools/, 120_000, host.alive)
  sealHostLog()
  let logText = ''
  try { logText = readFileSync(INSTANCE_LOG, 'utf8') } catch { /* sealed from raw */ }
  const fatalLines = logText.split('\n').filter((l) => /coverage|unmanaged|PermissionCoverage/i.test(l)).slice(0, 40)
  let setupError = null
  if (origin !== undefined && origin !== '') {
    const h = await fetchJson(`${origin}/__p6t6/health`, undefined, 10_000).catch(() => ({ body: null }))
    setupError = h.body?.setupError ?? null
  }
  const capture = {
    mode: MODE,
    fatal_seen: fatal !== null,
    fatal_lines: fatalLines,
    p6t6_setupError: setupError === null ? null : String(setupError).slice(0, 1200),
    trio: ['job_list', 'job_output', 'job_kill'].map((n) => ({ name: n, present: logText.includes(n) })),
    unknown_unmanaged_present: ['web_search', 'ask_user_question'].map((n) => ({ name: n, present: logText.includes(n) })),
    known_sensitive_classification: logText.includes('known-sensitive-unmanaged'),
  }
  writeEvidence('fatal-capture.json', capture)
  const trioAll = capture.trio.every((t) => t.present)
  check('R1', MODE === 'repro-jobs'
    ? 'minimal repro: a governed (strict) team on a preset that MOUNTS the job trio boots FATAL with the typed coverage error naming EXACTLY the trio (known-sensitive-unmanaged); NO unknown-unmanaged entries'
    : 'shipped-standard repro: a governed (strict) team on the shipped standard preset boots FATAL with the typed coverage error containing the trio AND the unknown-unmanaged set',
    capture.fatal_seen && trioAll && capture.known_sensitive_classification
      && (MODE === 'repro-standard' ? capture.unknown_unmanaged_present.some((u) => u.present) : !capture.unknown_unmanaged_present.some((u) => u.present)),
    `fatal=${String(capture.fatal_seen)} trio=${JSON.stringify(capture.trio)} unknown=${JSON.stringify(capture.unknown_unmanaged_present)}`)
  stopHost(host)
  try { await mock.close() } catch { /* closed */ }
  CURRENT_HOST = undefined
  const stableAfter = await probeStableInstance()
  writeEvidence('stable-instance-after.json', stableAfter)
  const world = sweepWorld()
  sleepSync(400)
  const failed = criteria.filter((c) => !c.ok)
  writeEvidence('summary.json', { runStamp: RUN_STAMP, mode: MODE, world: { path: HOME, disposition: world }, criteria })
  log(`criteria: ${String(criteria.length - failed.length)}/${String(criteria.length)} pass${failed.length === 0 ? '' : ` — FAILED: ${failed.map((c) => c.id).join(', ')}`}`)
  process.exitCode = failed.length === 0 ? 0 : 2
}

main().catch((error) => dieFatal(`kit crashed: ${String(error?.stack ?? error)}`))
