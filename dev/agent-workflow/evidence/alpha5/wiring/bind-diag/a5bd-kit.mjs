/**
 * a5bd-kit.mjs — BIND-DIAG: attribution of the A5P1 Guard refusal of the
 * preset-mounted `bash` on governed Team Agents (`the Tool Binding for "bash"
 * cannot be verified at dispatch time`), by MEASURING the three public faces
 * the closed-world Guard's bind rule reads, in two worlds that differ ONLY in
 * where the tool face is mounted.
 *
 * THE RULE UNDER TEST (facts on this tree, verified by needles at C0b):
 *   - tool-dispatch/closed-world-guard.ts  bindInheritedSurface: a name earns
 *     a VERIFIED inherited-native Binding only if (1) it is on the assembly's
 *     trusted native list, (2) it is pinnable through `tools.get(name, scope)`
 *     and (3) `tools.get(name)` (GLOBAL) resolves and is the SAME identity.
 *     Not on the trusted list -> bound UNVERIFIED reason `unattributed` ->
 *     dispatch refusal BINDING_UNVERIFIED — the exact w7m2 text.
 *   - src/plugin/live/agent-bindings.mjs  nativeNames := names of
 *     `tools.schemas()` with NO scope (the Host's GLOBAL view).
 *   - host packages/bundle/web-app/cordis.patch.yml: the Web surface DISABLES
 *     the root `tool-bash` / `tool-fs` rows — the agent tool plane lives behind
 *     agent presets (preset realm layers), and the shared smoke preset mounts
 *     the persistent shell group under `isolate: { terminals: true }`.
 *
 * THE TWO WORLDS (public profile-patch seam only, IF-5 untouched):
 *   --mode preset     = the w7m2 shape verbatim (persona + tool-fs +
 *                       persistent-shell group + tool-jobs INSIDE the preset).
 *                       Reproduce the bash refusal verbatim; run the `read`
 *                       positive control in the SAME world; capture the three
 *                       faces from the read-only diag row.
 *   --mode hostplane  = the same persona preset, but `@deepseek-ai/dsh-tool-bash`
 *                       and `@deepseek-ai/dsh-tool-fs` mounted as TOP-LEVEL
 *                       profile-patch rows (root/host plane, reviewed public
 *                       plugin names — the kit's own patch layer). If the rule
 *                       is provenance-of-the-GLOBAL-view, bash becomes an
 *                       attributable native and the model leg must RUN.
 *
 * The refusal-vs-ran verdict plus the measured face facts decide attribution:
 * (i) the trusted-native FACE was never fed for this mount shape (assembly
 * completion — a public path exists) vs (ii) no public face can ever make a
 * preset-realm bash verifiable (adjudication).
 *
 * Host pins come from tests/paths.mjs; port 3186 (self-proved free); world
 * tests/homes/a5bd-* removed at teardown; the stable :3080 instance is probed
 * read-only. The coverage gate is not touched: the anchor template keeps the
 * gate's own remediation (builtinToolDeny of the job trio) and the preset keeps
 * @deepseek-ai/dsh-tool-jobs so the trio is on the face exactly as in w7m2.
 *
 * @module evidence/alpha5/wiring/bind-diag/a5bd-kit
 */
import { spawn, spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, openSync, readFileSync, rmSync, writeFileSync, closeSync } from 'node:fs'
import { dirname, join, resolve, relative } from 'node:path'
import { pathToFileURL } from 'node:url'
import { startMockModel } from '../../../../../../packages/tools/harness/mock-deepseek.mjs'
import { presetDeclarationRow, smokePresetPlugins, personaRow } from '../../../../../../tests/kits/_shared/preset-seam.mjs'
import { CLIENT_COMMIT_HASH, TEST_USE_BASELINE_SHA, DSH_BASELINE_VERSION, STABLE_INSTANCE_PORT, testUseTree, homeDir } from '../../../../../../tests/paths.mjs'

// ── CLI / layout ────────────────────────────────────────────────────────────
const args = process.argv.slice(2)
const FLAG_KEEP = args.includes('--keep')
const MODE = args.includes('--mode') ? args[args.indexOf('--mode') + 1] : 'preset'
if (!['preset', 'hostplane', 'pr1shape'].includes(MODE)) {
  console.error(`unknown --mode ${MODE}`)
  process.exit(1)
}
const KIT_DIR = dirname(new URL(import.meta.url).pathname)
const REPO_ROOT = resolve(KIT_DIR, '..', '..', '..', '..', '..', '..')
const TESTUSE = testUseTree(REPO_ROOT)
const RUN_STAMP = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
const RUN_DIR = args.includes('--evidence-dir') ? resolve(args[args.indexOf('--evidence-dir') + 1]) : join(KIT_DIR, `run-${MODE}-${RUN_STAMP}`)
const RUN_DIR_REL = relative(REPO_ROOT, RUN_DIR).split('\\').join('/')
if (RUN_DIR_REL.startsWith('..')) { console.error(`--evidence-dir must live inside the repo root (got ${RUN_DIR})`); process.exit(1) }
const HOME = homeDir(REPO_ROOT, `a5bd-${MODE}-${RUN_STAMP}`)
const WORKSPACE = join(HOME, 'workspace')
const BLUEPRINT_DIR = join(RUN_DIR, 'blueprints')
const INSTANCE_LOG = join(RUN_DIR, 'instance.log')
const INSTANCE_RAW = join(RUN_DIR, 'host-stdout.raw')
const HOST_PORT = args.includes('--port') ? Number(args[args.indexOf('--port') + 1]) : 3186

const DIST_RUNTIME = join(REPO_ROOT, 'packages', 'runtime', 'dist', 'packages', 'runtime')
const HOST_BIN = join(TESTUSE, 'apps', 'cli', 'lib', 'bin.js')
const PRODUCTION_ROW_NAME = pathToFileURL(join(DIST_RUNTIME, 'src', 'plugin', 'host.js')).href
const GLUE_URL = pathToFileURL(join(DIST_RUNTIME, 'src', 'plugin', 'live', 'agent-bindings.mjs')).href
const SEAM_URL = pathToFileURL(join(REPO_ROOT, 'packages', 'runtime', 'root-binding', 'harness', 'seam.mjs')).href
const P6T6_ROW_NAME = pathToFileURL(join(REPO_ROOT, 'packages', 'tools', 'harness', 'plugin.mjs')).href
const DIAG_ROW_NAME = pathToFileURL(join(KIT_DIR, 'a5bd-diag-row.mjs')).href

const PRESET_ID = 'a5bd-face'
const JOBS_DENY = ['job_kill', 'job_list', 'job_output']
// The deny list per world mirrors the PR1 kit's OWN derivation convention
// (a5p1-kit.mjs:762-771: builtinToolDeny = live-surface names that are
// neither team_* nor permission-managed nor safe): what exists and is not
// managed gets DENIED, never left unmanaged.
//  - P/H worlds: the jobs trio is on the face (tool-jobs mounted, the w7m2
//    shape) -> trio denied = the coverage gate's own remediation (a), kept
//    verbatim, never silently removed.
//  - pr1shape: no jobs trio exists; fs-search's glob/grep are on the face
//    unmanaged -> exactly those two denied, as PR1's discovery-derived list
//    does in its own world.
const EFFECTIVE_DENY = MODE === 'pr1shape' ? ['glob', 'grep'] : JOBS_DENY
const ROOT = `session-a5bd-root-${RUN_STAMP}`
const CREATE_ROOT = `session-a5bd-team-${RUN_STAMP}`
const BP_ANCHOR_ID = 'team.a5bd.anchor'
const BP_MAIN_ID = 'team.a5bd.main'
const MK_DISC = `A5BD_DISC_${RUN_STAMP}`
const MK_READ = `A5BD_READ_${RUN_STAMP}`
const MK_BASH = `A5BD_BASH_${RUN_STAMP}`
const MK_BASHBG = `A5BD_BASHBG_${RUN_STAMP}`
const MK_WRITE = `A5BD_WRITE_${RUN_STAMP}`
const MK_CREATE = `A5BD_CREATE_${RUN_STAMP}`
const MK_CHILDREAD = `A5BD_CHILDREAD_${RUN_STAMP}`
const MK_CREATEA = `A5BD_CREATEA_${RUN_STAMP}`
const MK_CHILDREAD2 = `A5BD_CHILDREAD2_${RUN_STAMP}`
const SEED_FILE = join(WORKSPACE, 'a5bd-seed.txt')
const SEED_CONTENT = `A5BD_SEED_${RUN_STAMP}`
const WRITE_TARGET = join(WORKSPACE, 'a5bd-written.txt')
const BASH_MARKER = join(WORKSPACE, 'a5bd-bash-marker.txt')
const W7M2_REFUSAL = 'Error: team tool guard: the Tool Binding for "bash" cannot be verified at dispatch time (no fallback to the native body)'
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
async function apiPrompt(origin, cookie, sessionId, text, tag = 'a5bd') {
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

// ── yaml emitter ────────────────────────────────────────────────────────────
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

// ── blueprint (verbatim w7m2 anchor shape: strict + trio deny + dual-gate bash) ─
// The anchor ALSO carries the two worker templates + the create-member gate:
// the PR1 world's verified children were children of the BOOT ANCHOR root, so
// the anchor member leg is the discriminating cell of the 2×3 matrix
// (leader / anchor-member / created-team-member × preset / host-plane).
function memberCapsYaml(pad) {
  return [
    `${pad}capabilities:`,
    `${pad}  teamTools:`, `${pad}    kind: deny`,
    ...(EFFECTIVE_DENY.length === 0 ? [`${pad}  builtinToolDeny: []`] : [`${pad}  builtinToolDeny:`, ...EFFECTIVE_DENY.map((n) => `${pad}    - ${n}`)]),
    `${pad}  skills:`, `${pad}    kind: allow`, `${pad}    items: []`,
    `${pad}  mcp:`, `${pad}    kind: allow`, `${pad}    items: []`,
    `${pad}  permissions:`, `${pad}    default: ask`, `${pad}    allow:`,
    `${pad}      - tool: read`, `${pad}        resource:`, `${pad}          kind: any`,
    `${pad}    ask:`, `${pad}      - tool: bash`, `${pad}        resource:`, `${pad}          kind: any`,
    `${pad}    deny: []`,
  ]
}

function anchorYaml() {
  return [
    '---', 'schemaVersion: 3', `blueprintId: ${BP_ANCHOR_ID}`, 'revision: "1"',
    'leader:', '  templateId: leader',
    '  persona: "You are the leader of the a5bd governed team. Unless a user turn explicitly instructs otherwise, answer A5BD_NOOP_DONE and use no tools."',
    '  capabilities:',
    '    teamTools:', '      kind: allow', '      items:', '        - team_list_members', '        - team_create_member',
    ...(EFFECTIVE_DENY.length === 0 ? ['    builtinToolDeny: []'] : ['    builtinToolDeny:', ...EFFECTIVE_DENY.map((n) => `      - ${n}`)]),
    '    skills:', '      kind: allow', '      items: []',
    '    mcp:', '      kind: allow', '      items: []',
    '    permissions:', '      default: ask', '      allow:',
    '        - tool: bash', '          resource:', '            kind: any',
    '        - tool: read', '          resource:', '            kind: any',
    '        - tool: write', '          resource:', '            kind: any',
    '      ask: []', '      deny: []',
    'teamEnvelope:', '  allow:', '    - create-member', '    - send-message', '    - report-progress', '    - bash', '  deny: []',
    'members:',
    '  - templateId: wa', '    displayName: "a5bd anchor worker A"',
    '    persona: "You are worker A of the a5bd anchor team. Answer A5BD_NOOP_DONE and use no tools."',
    ...memberCapsYaml('    '),
    '  - templateId: wb', '    displayName: "a5bd anchor worker B"',
    '    persona: "You are worker B of the a5bd anchor team. Answer A5BD_NOOP_DONE and use no tools."',
    ...memberCapsYaml('    '),
    'memberEnvelopes:',
    '  - templateId: wa', '    envelope:', '      allow:', '        - send-message', '        - report-progress', '      deny: []',
    '  - templateId: wb', '    envelope:', '      allow:', '        - send-message', '        - report-progress', '      deny: []',
    'requirements: []', 'permissionMutationEnvelope:', '  rules: []',
    'teamHardEnvelope:', '  rules: []', 'policyStates: []', 'metadata: {}', '---', '',
  ].join('\n')
}

// The team.create face (the SECOND governed face — the created-team path with
// durable members). Every template declares capabilities.permissions (strict).
// Members carry a POSITIVE `read` allow (bash-class positive allows are
// validator-forbidden for members — repo needle validate.member_shell_no_allow),
// so a child read call is permission-ALLOWED and its verdict isolates the
// Guard's binding question from the permission lane.
function mainBlueprintYaml() {
  return [
    '---', 'schemaVersion: 3', `blueprintId: ${BP_MAIN_ID}`, 'revision: "1"',
    'leader:', '  templateId: leader',
    '  persona: "You are the leader of the a5bd governed team. Follow the user turn exactly: create the members it asks for, or run the command it asks for, and use nothing else."',
    '  capabilities:',
    '    teamTools:', '      kind: allow', '      items:', '        - team_list_members', '        - team_create_member',
    ...(EFFECTIVE_DENY.length === 0 ? ['    builtinToolDeny: []'] : ['    builtinToolDeny:', ...EFFECTIVE_DENY.map((n) => `      - ${n}`)]),
    '    skills:', '      kind: allow', '      items: []',
    '    mcp:', '      kind: allow', '      items: []',
    '    permissions:', '      default: ask', '      allow:',
    '        - tool: bash', '          resource:', '            kind: any',
    '        - tool: read', '          resource:', '            kind: any',
    '      ask: []', '      deny: []',
    'teamEnvelope:', '  allow:', '    - create-member', '    - send-message', '    - report-progress', '    - bash', '  deny: []',
    'members:',
    '  - templateId: wa', '    displayName: "a5bd worker A"',
    '    persona: "You are worker A of the a5bd governed team. Answer A5BD_NOOP_DONE and use no tools."',
    '    capabilities:',
    '      teamTools:', '        kind: deny',
    ...(EFFECTIVE_DENY.length === 0 ? ['      builtinToolDeny: []'] : ['      builtinToolDeny:', ...EFFECTIVE_DENY.map((n) => `        - ${n}`)]),
    '      skills:', '        kind: allow', '        items: []',
    '      mcp:', '        kind: allow', '        items: []',
    '      permissions:', '        default: ask', '        allow:',
    '          - tool: read', '            resource:', '              kind: any',
    '        ask:', '          - tool: bash', '            resource:', '              kind: any',
    '        deny: []',
    '  - templateId: wb', '    displayName: "a5bd worker B"',
    '    persona: "You are worker B of the a5bd governed team. Answer A5BD_NOOP_DONE and use no tools."',
    '    capabilities:',
    '      teamTools:', '        kind: deny',
    ...(EFFECTIVE_DENY.length === 0 ? ['      builtinToolDeny: []'] : ['      builtinToolDeny:', ...EFFECTIVE_DENY.map((n) => `        - ${n}`)]),
    '      skills:', '        kind: allow', '        items: []',
    '      mcp:', '        kind: allow', '        items: []',
    '      permissions:', '        default: ask', '        allow:',
    '          - tool: read', '            resource:', '              kind: any',
    '        ask:', '          - tool: bash', '            resource:', '              kind: any',
    '        deny: []',
    'memberEnvelopes:',
    '  - templateId: wa', '    envelope:', '      allow:', '        - send-message', '        - report-progress', '      deny: []',
    '  - templateId: wb', '    envelope:', '      allow:', '        - send-message', '        - report-progress', '      deny: []',
    'requirements: []', 'permissionMutationEnvelope:', '  rules: []',
    'teamHardEnvelope:', '  rules: []', 'policyStates: []', 'metadata: {}', '---', '',
  ].join('\n')
}

async function remoteCall(origin, cookie, method, params, tag = 'a5bd') {
  return fetchJson(`${origin}/team-remote/${method}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie },
    body: JSON.stringify({ type: 'client-request', rpcId: `${tag}-${Math.random().toString(36).slice(2, 12)}`, method, payload: { version: 1, params } }),
  })
}

function teamRowConfig(blueprintSource) {
  return {
    rootSessionId: ROOT,
    bootPhase: 'create',
    blueprintSource,
    blueprintDir: BLUEPRINT_DIR,
    rootPresetId: PRESET_ID,
    memberPresetId: PRESET_ID,
    seedMembers: [],
    generation: 1,
    staticModel: { provider: 'deepseek-official', model: 'a5bd-model' },
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

// ── world materialization (public profile-patch seam only) ──────────────────
function basePlugins() {
  // P mode = the w7m2 smoke face verbatim through the SHARED seam helper
  // (persona + tool-fs + persistent-shell isolate group) + tool-jobs. H mode:
  // the SAME persona row + tool-jobs only — the tool plane moves to top-level
  // host-plane rows. The job trio stays preset-mounted in BOTH worlds so the
  // anchored blueprint's builtinToolDeny remains the coverage gate's own
  // remediation, exactly as in w7m2.
  const jobs = { id: 'tool-jobs', name: '@deepseek-ai/dsh-tool-jobs' }
  if (MODE === 'hostplane') {
    return [
      personaRow({
        text: 'You are a coding agent powered by the {{model}} model.',
        suffix: 'Your working directory is {{cwd}}.',
      }),
      jobs,
    ]
  }
  if (MODE === 'pr1shape') {
    // PR1 kit's PROBED preset verbatim (its member preset): smoke face + the
    // fs-search row + the probe row mounted INSIDE the preset (file URL), and
    // NO tool-jobs. This is the shape whose governed read RAN on this very
    // dist at 06:33 today — the world whose facts must reconcile (or refine)
    // the attribution.
    const probeUrl = pathToFileURL(join(REPO_ROOT, 'tests', 'kits', 'a5-pr1-guard-dispatch', 'a5p1-probe-plugin.mjs')).href
    return [
      ...smokePresetPlugins({
        personaText: 'You are a coding agent powered by the {{model}} model.',
        cwdSuffix: 'Your working directory is {{cwd}}.',
        bashDescription: 'Run commands in a bash shell. State is persistent across calls.',
      }),
      { id: 'tool-fs-search', name: '@deepseek-ai/dsh-tool-fs-search', config: { sampleOverCapGlobResults: false } },
      { id: 'a5p1-probe', name: probeUrl },
    ]
  }
  return [
    ...smokePresetPlugins({
      personaText: 'You are a coding agent powered by the {{model}} model.',
      cwdSuffix: 'Your working directory is {{cwd}}.',
      bashDescription: 'Run commands in a bash shell. State is persistent across calls.',
    }),
    jobs,
  ]
}

function writePatchFile() {
  mkdirSync(join(HOME, 'profiles', 'web'), { recursive: true })
  const blueprint = anchorYaml()
  mkdirSync(BLUEPRINT_DIR, { recursive: true })
  writeFileSync(join(BLUEPRINT_DIR, 'anchor.yaml'), blueprint)
  writeFileSync(join(BLUEPRINT_DIR, 'main.yaml'), mainBlueprintYaml())
  const lines = [
    `# a5bd BIND-DIAG patch layer (run ${RUN_STAMP}, mode ${MODE}): production dsh-agent-team row (this worktree's dist) + p6t6 observer + a5bd read-only diag row + one preset${MODE === 'hostplane' ? ' + the tool plane as TOP-LEVEL host-plane rows (tool-bash, tool-fs)' : ' (the w7m2 tool face inside the preset realm)'} — public profile-patch seam only.`,
    '- insert:',
    ...yamlEmitItem({ id: 'dsh-agent-team', name: PRODUCTION_ROW_NAME, config: teamRowConfig(blueprint) }, 2),
    ...yamlEmitItem({ id: 'p6t6-team-tools', name: P6T6_ROW_NAME }, 2),
    ...yamlEmitItem({ id: 'a5bd-diag', name: DIAG_ROW_NAME }, 2),
    ...(MODE === 'hostplane' ? [
      ...yamlEmitItem({ id: 'a5bd-tool-bash', name: '@deepseek-ai/dsh-tool-bash' }, 2),
      ...yamlEmitItem({ id: 'a5bd-tool-fs', name: '@deepseek-ai/dsh-tool-fs' }, 2),
    ] : []),
    ...yamlEmitItem(presetDeclarationRow({
      id: PRESET_ID, displayName: 'a5bd face',
      description: `a5bd preset (run ${RUN_STAMP}, mode ${MODE}) = ${MODE === 'hostplane' ? 'persona + the host job tools (the tool plane rides the top-level host-patch rows)' : 'the w7m2 smoke face + the host job tools (preset realm)'}`,
      plugins: basePlugins(),
    }), 2),
    '',
  ]
  writeFileSync(join(HOME, 'profiles', 'web', 'cordis.patch.yml'), lines.join('\n'))
}

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
        DEEPSEEK_API_KEY: 'a5bd-mock-key',
        // Deployment override the base patch itself documents ("The
        // environment remains an explicit deployment override"). The HOST-PLANE
        // world needs it: this host has no usable confinement backend (no
        // bubblewrap / Landlock), so the pinned workspace-write default would
        // make the bash TOOL BODY fail closed at the sandbox layer BELOW the
        // Team Guard and blur the ran-vs-refused verdict. The PRESET world
        // runs WITHOUT it (byte-equal env to w7m2's — the refusal under test
        // must not have any environment fingerprint). The kit world runs in
        // tests/homes/a5bd-* only.
        ...(MODE === 'hostplane' ? { DSH_PERMISSION_MODE: 'danger-full-access' } : {}),
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
  toolCalls: [{ id: `call-a5bd-${Math.random().toString(36).slice(2, 10)}`, name, arguments: argsObj }],
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
function laneOf(req) {
  const msgs = messagesOf(req).map(textOf)
  const joined = msgs.join('\n')
  if (joined.includes('Generate the session title')) return 'title'
  // The lane is the marker of the LATEST user turn (the session history keeps
  // every earlier marker): last-occurrence wins.
  const lastIndexOf = (marker) => {
    let last = -1
    msgs.forEach((t, i) => { if (t.includes(marker)) last = i })
    return last
  }
  const lanes = [
    ['read', lastIndexOf(MK_READ)],
    ['bashbg', lastIndexOf(MK_BASHBG)],
    ['bash', lastIndexOf(MK_BASH)],
    ['write', lastIndexOf(MK_WRITE)],
    ['childread', lastIndexOf(MK_CHILDREAD)],
    ['childread2', lastIndexOf(MK_CHILDREAD2)],
    ['create', lastIndexOf(MK_CREATE)],
    ['createa', lastIndexOf(MK_CREATEA)],
    ['disc', lastIndexOf(MK_DISC)],
  ].filter(([, at]) => at >= 0)
  if (lanes.length === 0) return 'other'
  lanes.sort((a, b) => a[1] - b[1])
  return lanes[lanes.length - 1][0]
}
function makeDecide() {
  const createSteps = { n: 0 }
  return function decide({ req }) {
    const lane = laneOf(req)
    if (lane === 'title' || lane === 'other') return { kind: 'text', content: 'A5BD_NOOP_DONE' }
    if (lane === 'disc') return { kind: 'text', content: 'A5BD_DISC_DONE' }
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
    if (lane === 'create') {
      const token = (x) => `a5bd-${x}-${RUN_STAMP}`
      if (afterCount(MK_CREATE) === 0) return toolCall('team_create_member', { rootSessionId: CREATE_ROOT, requestToken: token('ca'), delegationTemplateId: 'wa', label: 'bd-a' })
      if (afterCount(MK_CREATE) === 1) return toolCall('team_create_member', { rootSessionId: CREATE_ROOT, requestToken: token('cb'), delegationTemplateId: 'wb', label: 'bd-b' })
      return { kind: 'text', content: 'A5BD_CREATE_DONE' }
    }
    if (lane === 'createa') {
      // The PR1 world's shape: model-driven members of the BOOT ANCHOR team.
      const token = (x) => `a5bd-${x}-${RUN_STAMP}`
      if (afterCount(MK_CREATEA) === 0) return toolCall('team_create_member', { rootSessionId: ROOT, requestToken: token('aa'), delegationTemplateId: 'wa', label: 'bd-a2' })
      if (afterCount(MK_CREATEA) === 1) return toolCall('team_create_member', { rootSessionId: ROOT, requestToken: token('ab'), delegationTemplateId: 'wb', label: 'bd-b2' })
      return { kind: 'text', content: 'A5BD_CREATEA_DONE' }
    }
    if (lane === 'childread2') {
      if (afterCount(MK_CHILDREAD2) === 0) return toolCall('read', { file_path: SEED_FILE })
      return { kind: 'text', content: 'A5BD_CHILDREAD2_DONE' }
    }
    if (lane === 'childread') {
      if (afterCount(MK_CHILDREAD) === 0) return toolCall('read', { file_path: SEED_FILE })
      return { kind: 'text', content: 'A5BD_CHILDREAD_DONE' }
    }
    if (lane === 'read') {
      if (afterCount(MK_READ) === 0) return toolCall('read', { file_path: SEED_FILE })
      return { kind: 'text', content: 'A5BD_READ_DONE' }
    }
    if (lane === 'bash') {
      if (afterCount(MK_BASH) === 0) return toolCall('bash', { command: `echo A5BD_BASH_RAN > "${BASH_MARKER}" && echo A5BD_BASH_OK`, description: 'a5bd bind-diag foreground echo' })
      return { kind: 'text', content: 'A5BD_BASH_DONE' }
    }
    if (lane === 'bashbg') {
      // the exact w7m2 T-allow call shape (verbatim args pattern)
      if (afterCount(MK_BASHBG) === 0) return toolCall('bash', { command: 'echo A5BD_BG_EFFECT && sleep 1 && echo A5BD_BG_EFFECT_END', description: 'a5bd bind-diag background echo', run_in_background: true })
      return { kind: 'text', content: 'A5BD_BASHBG_DONE' }
    }
    if (lane === 'write') {
      if (afterCount(MK_WRITE) === 0) return toolCall('write', { file_path: WRITE_TARGET, content: `A5BD_WRITTEN_${RUN_STAMP}` })
      return { kind: 'text', content: 'A5BD_WRITE_DONE' }
    }
    return { kind: 'text', content: 'A5BD_NOOP_DONE' }
  }
}
async function waitForMock(mock, pred, timeoutMs, label) {
  const deadline = Date.now() + timeoutMs
  for (;;) {
    const all = mock.requests.filter(pred)
    if (all.length > 0) return all[all.length - 1]
    if (mock.requests.length > 300) { log(`mock storm fuse tripped (${label}, requests=${String(mock.requests.length)})`); return null }
    if (Date.now() >= deadline) { log(`mock wait timed out: ${label} (requests=${String(mock.requests.length)})`); return null }
    await new Promise((r) => setTimeout(r, 400))
  }
}
function laneResults(mock, lane) {
  // The verdict of a lane = the tool results that arrived AFTER the lane's
  // user turn in the LAST request of that lane (the message history also
  // carries every earlier turn's results — collecting those would attribute
  // another lane's verdict to this one).
  const marker = { read: MK_READ, bash: MK_BASH, bashbg: MK_BASHBG, write: MK_WRITE, childread: MK_CHILDREAD, childread2: MK_CHILDREAD2, create: MK_CREATE, createa: MK_CREATEA }[lane]
  const reqs = mock.requests.filter((r) => laneOf(r) === lane)
  if (reqs.length === 0) return []
  const msgs = messagesOf(reqs[reqs.length - 1])
  let last = -1
  msgs.forEach((m, i) => { if (marker !== undefined && textOf(m).includes(marker)) last = i })
  const out = []
  for (const m of msgs.slice(last + 1)) {
    for (const b of Array.isArray(m?.content) ? m.content : []) {
      if (b?.type === 'tool_result') out.push({ text: (Array.isArray(b.content) ? b.content : []).map((c) => c?.text ?? '').join(''), isError: b.is_error === true })
    }
  }
  return out
}

// ── citation anchors (needles on THIS tree only) ────────────────────────────
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
  { key: 'web.disable_tool_bash', file: 'packages/bundle/web-app/cordis.patch.yml', needle: '- id: tool-bash' },
  { key: 'web.disable_tool_fs', file: 'packages/bundle/web-app/cordis.patch.yml', needle: '- id: tool-fs' },
  { key: 'bash.run_in_background_schema', file: 'packages/shell/tool-bash/src/index.ts', needle: "run_in_background: { type: 'boolean'" },
  { key: 'bash.jobs_swap_register', file: 'packages/shell/tool-bash/src/index.ts', needle: 'const unregister = ctx.tools.register(bashTool(jobCtx.jobs))' },
  { key: 'registry.view_own_last', file: 'packages/core/tools/src/index.ts', needle: "The scope's own registrations last" },
  { key: 'registry.schemas_scope', file: 'packages/core/tools/src/index.ts', needle: 'schemas(scope?: ScopeKey)' },
]
const REPO_NEEDLES = [
  { key: 'guard.unverified_default', file: 'packages/runtime/tool-dispatch/closed-world-guard.ts', needle: 'unverifiedReason ?? \'unattributed\'' },
  { key: 'guard.claims_native_rule', file: 'packages/runtime/tool-dispatch/closed-world-guard.ts', needle: 'const claimsNative = nativeNames.has(name)' },
  { key: 'glue.native_names_global_read', file: 'packages/runtime/src/plugin/live/agent-bindings.mjs', needle: 'agentCtx.tools?.schemas === \'function\'' },
  { key: 'kit.preset_isolate_group', file: 'tests/kits/_shared/preset-seam.mjs', needle: 'isolate: { terminals: true }' },
  { key: 'dist.guard_same_rule', file: 'packages/runtime/dist/packages/runtime/tool-dispatch/closed-world-guard.js', needle: 'const claimsNative = nativeNames.has(name)' },
]
function treeState() {
  const head = spawnSync('git', ['-C', TESTUSE, 'rev-parse', 'HEAD'], { encoding: 'utf8' })
  const porcelain = spawnSync('git', ['-C', TESTUSE, 'status', '--porcelain'], { encoding: 'utf8' })
  return {
    treeHead: String(head.stdout ?? '').trim(),
    treePorcelainLines: String(porcelain.stdout ?? '').split('\n').filter((l) => l.trim() !== '').length,
  }
}
const sha256File = (p) => createHash('sha256').update(readFileSync(p)).digest('hex')
let CURRENT_HOST = undefined

// ── main ────────────────────────────────────────────────────────────────────
async function main() {
  writeFileSync(RUN_LOG, '', { flag: 'w' })
  log(`a5bd kit ${RUN_STAMP} mode=${MODE}: host ${DSH_BASELINE_VERSION} @ ${TEST_USE_BASELINE_SHA.slice(0, 10)}; port ${HOST_PORT}; world ${HOME}`)
  if (!existsSync(HOST_BIN)) dieFatal(`pinned host build absent: ${HOST_BIN}`)
  if (!existsSync(join(DIST_RUNTIME, 'src', 'plugin', 'host.js'))) dieFatal(`the production row is not built: ${join(DIST_RUNTIME, 'src', 'plugin', 'host.js')}`)

  const treePre = treeState()
  const hostAnchors = verifyNeedles(TESTUSE, HOST_NEEDLES)
  const repoAnchors = verifyNeedles(REPO_ROOT, REPO_NEEDLES)
  writeEvidence('host-face-anchors.json', hostAnchors)
  writeEvidence('repo-citation-anchors.json', repoAnchors)
  check('C0b', 'citation guard: host tree at pin porcelain-clean PRE and every host/repo needle matches THIS tree (guard rule, global read, isolate group, jobs swap all cited at live lines)',
    treePre.treeHead === TEST_USE_BASELINE_SHA && treePre.treePorcelainLines === 0 && hostAnchors.allFound && repoAnchors.allFound,
    `head=${treePre.treeHead.slice(0, 10)} porcelain=${String(treePre.treePorcelainLines)} missingHost=${JSON.stringify(hostAnchors.anchors.filter((a) => !a.found).map((a) => a.key))} missingRepo=${JSON.stringify(repoAnchors.anchors.filter((a) => !a.found).map((a) => a.key))}`)

  const portFree = await probePortFree(HOST_PORT)
  const stableBefore = await probeStableInstance()
  writeEvidence('port-self-proof.json', { selfPort: portFree, stableInstanceBefore: stableBefore })
  if (!portFree.free) dieFatal(`port ${HOST_PORT} is not free: ${portFree.observed}`)

  mkdirSync(WORKSPACE, { recursive: true })
  writeFileSync(SEED_FILE, `${SEED_CONTENT}\n`)
  writePatchFile()
  writeFileSync(join(HOME, 'p6t6-directive.json'), JSON.stringify({
    boot: 1, phase: 'create', reportDir: RUN_DIR, runStamp: RUN_STAMP, rootSessionId: ROOT,
  }, null, 2))

  const mock = await startMockModel({ port: 0, decide: makeDecide(), log: () => {} })
  let host
  let hostStopped = false
  let face = null
  let origin = ''
  let cookie = ''
  try {
    host = spawnHost({ port: HOST_PORT, home: HOME, mockPort: mock.port })
    CURRENT_HOST = host
    const boot = await waitForLogLine(INSTANCE_RAW, BOOT_MARKER, 120_000, host.alive)
    if (boot === null) {
      const raw = existsSync(INSTANCE_RAW) ? redact(readFileSync(INSTANCE_RAW, 'utf8').split('\n').slice(-40).join('\n')) : ''
      writeEvidence('boot-failure.json', { tail: raw })
      dieFatal(`host boot marker absent (alive=${String(host.alive())})\n${raw.slice(0, 600)}`)
    }
    origin = `http://127.0.0.1:${boot.m[1]}`
    if (String(boot.m[1]) !== String(HOST_PORT)) dieFatal(`host bound ${String(boot.m[1])}, expected ${String(HOST_PORT)}`)
    cookie = await authenticate(origin, boot.m[2])

    const diagHealth = await fetchJson(`${origin}/__a5bd/health`, undefined, 15_000)
    check('C1a', 'the read-only diag row answers (plain profile-patch row; tools service resolved)',
      diagHealth.status === 200 && diagHealth.body?.ok === true && diagHealth.body?.tools === 'resolved',
      `status=${String(diagHealth.status)} body=${JSON.stringify(diagHealth.body ?? null).slice(0, 200)}`)

    // The p6t6 SUCCESS routes register only once teamRoot.ready settles = the
    // production anchor boot settled (durable session rows exist). Gate on it
    // before the first prompt (a prompt against an unsettled boot reads
    // `session/not-found` — the durable row is not minted yet).
    let p6Health = { status: 0 }
    const bootDeadline = Date.now() + 120_000
    for (;;) {
      p6Health = await fetchJson(`${origin}/__p6t6/health`, undefined, 30_000)
      if (p6Health.status === 200) break
      if (!host.alive()) dieFatal('host died while waiting for the settled boot')
      if (Date.now() >= bootDeadline) break
      await new Promise((r) => setTimeout(r, 1000))
    }
    writeEvidence('p6t6-health.json', p6Health.body ?? { status: p6Health.status })
    check('C1b', 'the production anchor boot SETTLED (the p6t6 observer publishes its success health only on settled teamRoot.ready)',
      p6Health.status === 200, `status=${String(p6Health.status)} body=${JSON.stringify(p6Health.body ?? null).slice(0, 240)}`)
    if (p6Health.status !== 200) dieFatal(`anchor boot never settled: p6t6 health ${String(p6Health.status)} ${JSON.stringify(p6Health.body ?? null).slice(0, 300)}`)

    // Discovery turn = the live model-facing surface of the governed leader.
    const discPrompt = await apiPrompt(origin, cookie, ROOT, `${MK_DISC} discovery turn`)
    writeEvidence('disc-prompt.json', discPrompt.body ?? { status: discPrompt.status })
    if (discPrompt.status !== 200 || discPrompt.body?.result?.ok === false) {
      dieFatal(`discovery prompt rejected: http=${String(discPrompt.status)} body=${JSON.stringify(discPrompt.body ?? null).slice(0, 400)}`)
    }
    const disc = await waitForMock(mock, (r) => laneOf(r) === 'disc' && surfaceNamesOf(r).length > 0, 180_000, 'DISC')
    if (disc === null) dieFatal('discovery model request absent')
    const surface = surfaceNamesOf(disc).sort()
    writeEvidence('leader-surface.json', { surface })
    check('C1c', 'governed leader live surface carries bash AND read AND write AND the job trio is absent (deny effective; same scene as w7m2 C2)',
      surface.includes('bash') && surface.includes('read') && surface.includes('write') && !surface.some((n) => n.startsWith('job_')),
      `surface=${JSON.stringify(surface)}`)

    // ── THE THREE FACES (read-only, durable-facts agent handle) ────────────
    const facts = await fetchJson(`${origin}/__a5bd/facts?team=${encodeURIComponent(ROOT)}&member=inst-leader`, undefined, 30_000)
    writeEvidence('faces-leader.json', facts.body ?? { status: facts.status })
    const faceOk = facts.status === 200 && facts.body?.scoped?.agentResolved === true && Array.isArray(facts.body?.globalNames)
    check('C2', 'the three faces are measured for the governed leader: GLOBAL schemas() (the nativeNames source), the AGENT scoped view, and the per-name global-vs-agent definition identity',
      faceOk, `status=${String(facts.status)} agentResolved=${String(facts.body?.scoped?.agentResolved ?? false)} globalN=${String(facts.body?.globalNames?.length ?? -1)}`)
    if (!faceOk) dieFatal(`faces unreadable: ${JSON.stringify(facts.body ?? null).slice(0, 300)}`)
    face = {
      globalNames: facts.body.globalNames,
      bash: facts.body.scoped.perName.bash,
      read: facts.body.scoped.perName.read,
      write: facts.body.scoped.perName.write,
      scopedNames: facts.body.scoped.scopedNames,
    }
    writeEvidence('faces-summary.json', face)

    // ── MODEL LEGS (all on the SAME governed boot-anchor leader) ───────────
    // Positive controls FIRST: read + write (tool-fs), then the subject bash.
    await apiPrompt(origin, cookie, ROOT, `${MK_READ} read the seed file ${SEED_FILE}`)
    const readDone = await waitForMock(mock, (r) => r.reply?.kind === 'text' && r.reply.content === 'A5BD_READ_DONE', 180_000, 'READ')
    const readResults = laneResults(mock, 'read')
    writeEvidence('leg-read.json', { done: readDone !== null, results: readResults.slice(0, 4) })
    const readRan = readResults.some((m) => m.isError !== true && String(m.text).includes(SEED_CONTENT))
    check('C3', 'POSITIVE CONTROL: model-driven read on the SAME governed agent — verdict captured verbatim (ran = seed content returned)',
      readResults.length >= 1, `readRan=${String(readRan)} verbatim=${JSON.stringify(readResults[0] ?? null).slice(0, 300)}`)

    await apiPrompt(origin, cookie, ROOT, `${MK_WRITE} write ${WRITE_TARGET}`)
    const writeDone = await waitForMock(mock, (r) => r.reply?.kind === 'text' && r.reply.content === 'A5BD_WRITE_DONE', 180_000, 'WRITE')
    const writeResults = laneResults(mock, 'write')
    writeEvidence('leg-write.json', { done: writeDone !== null, results: writeResults.slice(0, 4) })
    const writeRan = existsSync(WRITE_TARGET) && String(readFileSync(WRITE_TARGET, 'utf8')).includes(`A5BD_WRITTEN_${RUN_STAMP}`)
    check('C4', 'POSITIVE CONTROL: model-driven write on the SAME governed agent — verdict captured verbatim (ran = target file exists with the content)',
      writeResults.length >= 1, `writeRan=${String(writeRan)} verbatim=${JSON.stringify(writeResults[0] ?? null).slice(0, 300)}`)

    await apiPrompt(origin, cookie, ROOT, `${MK_BASH} run the foreground echo`)
    const bashDone = await waitForMock(mock, (r) => r.reply?.kind === 'text' && r.reply.content === 'A5BD_BASH_DONE', 180_000, 'BASH')
    const bashResults = laneResults(mock, 'bash')
    const bashRan = existsSync(BASH_MARKER) && String(readFileSync(BASH_MARKER, 'utf8')).includes('A5BD_BASH_RAN')
    writeEvidence('leg-bash.json', { done: bashDone !== null, ran: bashRan, results: bashResults.slice(0, 4) })
    const bashRefused = bashResults.some((m) => String(m.text).includes(W7M2_REFUSAL))
    if (MODE === 'preset') {
      check('C5', 'SUBJECT (preset-realm bash, w7m2 shape): the refusal reproduces VERBATIM on this build (boot-anchor path) while the read/write controls ran',
        bashResults.length >= 1 && bashRefused && !bashRan,
        `refusal=${String(bashRefused)} ran=${String(bashRan)} verbatim=${JSON.stringify(bashResults[0] ?? null).slice(0, 300)}`)
    } else if (MODE === 'hostplane') {
      check('C5', 'SUBJECT (host-plane bash): the model-driven bash RUNS under the armed Guard (marker file written) — a verified Tool Binding via the public GLOBAL face',
        bashResults.length >= 1 && bashRan,
        `ran=${String(bashRan)} verbatim=${JSON.stringify(bashResults[0] ?? null).slice(0, 300)}`)
    } else {
      check('C5', 'SUBJECT (pr1shape — the PR1 kit\'s own mount): verdict captured VERBATIM (reconciliation cell; the read leg is the discriminator, no expectation pinned here)',
        bashResults.length >= 1,
        `refusal=${String(bashRefused)} ran=${String(bashRan)} verbatim=${JSON.stringify(bashResults[0] ?? null).slice(0, 300)}`)
    }

    // Background shape (the w7m2 T-allow call shape verbatim) — same verdict
    // expected as the foreground leg (the refusal is name/identity, not args).
    await apiPrompt(origin, cookie, ROOT, `${MK_BASHBG} run the background echo`)
    const bgDone = await waitForMock(mock, (r) => r.reply?.kind === 'text' && r.reply.content === 'A5BD_BASHBG_DONE', 180_000, 'BASHBG')
    const bgResults = laneResults(mock, 'bashbg')
    writeEvidence('leg-bash-background.json', { done: bgDone !== null, results: bgResults.slice(0, 4) })
    log(`bashbg leg verdict verbatim: ${JSON.stringify(bgResults[bgResults.length - 1] ?? null).slice(0, 260)}`)

    // ── THE THIRD CELL: model-driven members OF THE BOOT ANCHOR (the exact
    // PR1-world shape — PR1's verified read ran on an anchor-root child) ────
    await apiPrompt(origin, cookie, ROOT, `${MK_CREATEA} create the two anchor workers`)
    const createADone = await waitForMock(mock, (r) => r.reply?.kind === 'text' && r.reply.content === 'A5BD_CREATEA_DONE', 180_000, 'CREATEA')
    const stA = await fetchJson(`${origin}/__a5bd/members?team=${encodeURIComponent(ROOT)}`, undefined, 30_000)
    const durableA = stA.body?.members ?? []
    const anchorA = durableA.find((m) => m.templateId === 'wa')
    check('C8a', 'model-driven create-member on the BOOT ANCHOR root produced a durable wa member (the PR1-world shape reproduced on this world)',
      createADone !== null && anchorA !== undefined && /^inst-/.test(anchorA.instanceId ?? ''),
      `done=${String(createADone !== null)} members=${JSON.stringify(durableA.map((m) => ({ t: m.templateId, i: m.instanceId })))}`)
    if (anchorA === undefined) dieFatal('anchor wa member absent — the PR1-shape cell cannot be measured')
    const aFacts = await fetchJson(`${origin}/__a5bd/facts?team=${encodeURIComponent(ROOT)}&member=${encodeURIComponent(anchorA.instanceId)}`, undefined, 30_000)
    writeEvidence('faces-anchor-member.json', aFacts.body ?? { status: aFacts.status })
    writeEvidence('faces-anchor-member-summary.json', {
      agentResolved: aFacts.body?.scoped?.agentResolved ?? false,
      globalNames: aFacts.body?.globalNames ?? null,
      read: aFacts.body?.scoped?.perName?.read ?? null,
      bash: aFacts.body?.scoped?.perName?.bash ?? null,
      scopedNames: aFacts.body?.scoped?.scopedNames ?? null,
    })
    await apiPrompt(origin, cookie, anchorA.childSessionId, `${MK_DISC} anchor member setup turn`)
    await new Promise((r) => setTimeout(r, 1500))
    await apiPrompt(origin, cookie, anchorA.childSessionId, `${MK_CHILDREAD2} read ${SEED_FILE}`)
    const childADone = await waitForMock(mock, (r) => r.reply?.kind === 'text' && r.reply.content === 'A5BD_CHILDREAD2_DONE', 180_000, 'CHILDREAD2')
    const childAResults = laneResults(mock, 'childread2')
    const childARan = childAResults.some((m) => m.isError !== true && String(m.text).includes(SEED_CONTENT))
    const childAGuard = childAResults.find((m) => String(m.text).includes('team tool guard'))
    writeEvidence('leg-anchor-member-read.json', { done: childADone !== null, ran: childARan, results: childAResults.slice(0, 4) })
    check('C8b', 'ANCHOR-MEMBER read leg (permission-allowed read/any) — verdict captured VERBATIM (PR1 C3\'s exact cell on this world shape)',
      childAResults.length >= 1, `ran=${String(childARan)} guardRefusal=${JSON.stringify(childAGuard?.text ?? null).slice(0, 280)}`)

    // ── THE SECOND GOVERNED FACE: the team.create path (durable members) ───
    // The created team (public /team-remote) with two durable members created
    // through the MODEL-DRIVEN create-member chain (envelope-gated). A member
    // read is permission-ALLOWED (read/any), so its verdict isolates the
    // Guard's binding question from the permission lane on the MEMBER face.
    const created = await remoteCall(origin, cookie, 'team.create', { rootSessionId: CREATE_ROOT, blueprintId: BP_MAIN_ID, initialWork: { prompt: MK_CREATE } })
    writeEvidence('team-create.json', created.body ?? { status: created.status })
    const createOk = created.status === 200 && created.body?.result?.error === undefined
    check('C7a', 'team.create (public /team-remote) starts the governed MAIN team (every template declares capabilities.permissions; create-member rides the envelope token)',
      createOk, `status=${String(created.status)} body=${JSON.stringify(created.body ?? null).slice(0, 240)}`)
    const createDone = await waitForMock(mock, (r) => r.reply?.kind === 'text' && r.reply.content === 'A5BD_CREATE_DONE', 180_000, 'CREATE')
    const createResults = laneResults(mock, 'create')
    writeEvidence('leg-create-member.json', { done: createDone !== null, results: createResults.slice(0, 4) })
    const st1 = await fetchJson(`${origin}/__a5bd/members?team=${encodeURIComponent(CREATE_ROOT)}`, undefined, 30_000)
    const durable = st1.body?.members ?? []
    const memberA = durable.find((m) => m.templateId === 'wa')
    const memberB = durable.find((m) => m.templateId === 'wb')
    check('C7b', 'the model-driven create-member chain completed and TWO durable members exist with distinct instances (the create-member gate is lawfully OPEN on this world)',
      createDone !== null && memberA !== undefined && memberB !== undefined && memberA.instanceId !== memberB.instanceId && memberA.childSessionId !== memberB.childSessionId,
      `createDone=${String(createDone !== null)} durable=${JSON.stringify(durable.map((m) => ({ t: m.templateId, i: m.instanceId })))}`)
    if (memberA === undefined) dieFatal('no durable member to measure — the member-face attribution would be ungrounded')
    const mFacts = await fetchJson(`${origin}/__a5bd/facts?team=${encodeURIComponent(CREATE_ROOT)}&member=${encodeURIComponent(memberA.instanceId)}`, undefined, 30_000)
    writeEvidence('faces-memberA.json', mFacts.body ?? { status: mFacts.status })
    check('C7c', 'the three faces are measured for a durable MEMBER agent too (agent handle through the durable pair face)',
      mFacts.status === 200 && mFacts.body?.scoped?.agentResolved === true,
      `status=${String(mFacts.status)} agentResolved=${String(mFacts.body?.scoped?.agentResolved ?? false)} globalN=${String(mFacts.body?.globalNames?.length ?? -1)}`)
    if (mFacts.status !== 200 || mFacts.body?.scoped?.agentResolved !== true) dieFatal(`member faces unreadable: ${JSON.stringify(mFacts.body ?? null).slice(0, 300)}`)
    writeEvidence('faces-member-summary.json', {
      globalNames: mFacts.body.globalNames,
      read: mFacts.body.scoped.perName.read,
      bash: mFacts.body.scoped.perName.bash,
      scopedNames: mFacts.body.scoped.scopedNames,
    })
    await apiPrompt(origin, cookie, memberA.childSessionId, `${MK_DISC} member setup turn`)
    await new Promise((r) => setTimeout(r, 1500))
    await apiPrompt(origin, cookie, memberA.childSessionId, `${MK_CHILDREAD} read ${SEED_FILE}`)
    const childDone = await waitForMock(mock, (r) => r.reply?.kind === 'text' && r.reply.content === 'A5BD_CHILDREAD_DONE', 180_000, 'CHILDREAD')
    const childResults = laneResults(mock, 'childread')
    const childRan = childResults.some((m) => m.isError !== true && String(m.text).includes(SEED_CONTENT))
    const childGuard = childResults.find((m) => String(m.text).includes('team tool guard'))
    writeEvidence('leg-member-read.json', { done: childDone !== null, ran: childRan, results: childResults.slice(0, 4) })
    check('C7d', 'MEMBER read leg (permission-allowed read/any) — verdict captured VERBATIM: ran vs Guard-refusal discriminates leader-vs-member binding on this mount shape',
      childResults.length >= 1, `ran=${String(childRan)} guardRefusal=${JSON.stringify(childGuard?.text ?? null).slice(0, 280)}`)

    // ── GUARD OBSERVATIONS (production closure face via the p6t6 observer) ──
    const st = await fetchJson(`${origin}/__p6t6/state`, undefined, 30_000)
    const allObs = Array.isArray(st.body?.observations) ? st.body.observations.map(String) : []
    const hostLog = existsSync(INSTANCE_RAW) ? redact(readFileSync(INSTANCE_RAW, 'utf8')) : ''
    const guardLines = [...allObs.filter((o) => o.includes('a5p1-guard:')), ...hostLog.split('\n').filter((l) => l.includes('a5p1-guard:'))]
    writeEvidence('guard-observations.txt', guardLines.join('\n'))
    const published = guardLines.filter((l) => l.includes('agent-published'))
    const refused = guardLines.filter((l) => l.includes('REFUSED') || l.includes('native-list-unavailable'))
    const unverifiedEvents = guardLines.filter((l) => l.includes('published-surface-unverified') || l.includes('published-surface-shadowed') || l.includes('published-surface-native-unreadable'))
    writeEvidence('guard-observations-summary.json', {
      published: published.length, refusedOrUnavailable: refused.length,
      surfaceEvents: unverifiedEvents.length, allGuardLines: guardLines.length,
      note: 'strings carry event+agent only (names are NOT in the onObserve format) — the NAME-level facts are faces-leader.json',
    })
    check('C6', 'the Guard armed and PUBLISHED the closed world for the governed boot-anchor leader (agent-published) with no install refusal / native-list-unavailable line',
      published.length >= 1 && refused.length === 0,
      `published=${String(published.length)} refused=${String(refused.length)} surfaceEvents=${String(unverifiedEvents.length)}`)

    stopHost(host)
    hostStopped = true
    await new Promise((r) => setTimeout(r, 1500))
    sealHostLog()
  } finally {
    if (!hostStopped && host !== undefined) stopHost(host)
    try { await mock.close() } catch { /* already closed */ }
  }

  const stableAfter = await probeStableInstance()
  writeEvidence('stable-instance-after.json', stableAfter)
  check('C9a', 'the stable development instance (:3080) reads the same before/after and was never operated',
    stableAfter.status === stableBefore.status, `before=${String(stableBefore.status)} after=${String(stableAfter.status)}`)
  const treePost = treeState()
  check('C9b', 'the pinned test-use tree is still at pin and porcelain-clean (no Team write ever touched it)',
    treePost.treeHead === TEST_USE_BASELINE_SHA && treePost.treePorcelainLines === 0,
    `head=${treePost.treeHead.slice(0, 10)} porcelain=${String(treePost.treePorcelainLines)}`)

  const world = sweepWorld()
  writeEvidence('summary.json', {
    runStamp: RUN_STAMP, mode: MODE,
    hostBaseline: { version: DSH_BASELINE_VERSION, sha: TEST_USE_BASELINE_SHA, clientCommitHash: CLIENT_COMMIT_HASH },
    port: HOST_PORT,
    world: { path: HOME, disposition: world },
    faces: face,
    criteria,
  })
  const failed = criteria.filter((c) => !c.ok)
  log(`criteria: ${String(criteria.length - failed.length)}/${String(criteria.length)} pass${failed.length === 0 ? '' : ` — FAILED: ${failed.map((c) => c.id).join(', ')}`}`)
  process.exitCode = failed.length === 0 ? 0 : 2
}

main().catch((error) => dieFatal(`uncaught: ${String(error?.stack ?? error)}`))
