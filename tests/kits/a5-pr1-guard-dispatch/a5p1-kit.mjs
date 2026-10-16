#!/usr/bin/env node
/**
 * a5p1-kit.mjs — Alpha.5 PR1 real-Host regression kit: the closed-world Guard
 * and the Stable Scoped Dispatcher, forced negative controls on the PINNED
 * host (0.2.0-rc.2 @ `639ed01539`, `tests/paths.mjs` is the single source).
 *
 * WHAT THIS PROVES, and only this:
 *
 *   C1 assembly      the production Team row (this worktree's built dist) arms
 *                    the Guard + Dispatcher per permissions-carrying Agent;
 *                    a permissions-less Agent gets NOTHING (NEG-2 zero impact).
 *   C2 dynRan FLIP   a tool the Team assembly never declared, registered AFTER
 *                    the Agent was published, is REFUSED with the typed
 *                    `TEAM_TOOL_UNGOVERNED` text and its body NEVER runs.
 *                    On the PoC host the same leg produced
 *                    `hc-dyn-observation.dynRan = true` (body ran, marker
 *                    written, `dyn-ran` returned) — evidence
 *                    `dev/agent-workflow/evidence/alpha5-adapter-p0/07-integration/03-stage2b/h6-result.json`.
 *   C3 governed      a GOVERNED, allowed call (member `read` of a seeded file)
 *                    still runs: the Guard is a closed world, not a shutdown.
 *   C4 control arm   the SAME probe on a permissions-less (legacy) template
 *                    RUNS — the PR1 line governs Team-scoped Agents and does
 *                    not interfere with anything else.
 *   C5 re-drive      the same member, delegated a SECOND task after its first
 *                    turn ended, still refuses the unbound name and still
 *                    serves the governed one (the Guard persists through the
 *                    Agent lifecycle — it is not a setup-time snapshot).
 *   C6 teardown      the ordered teardown reaches its end state at row close:
 *                    the host log shows the publishes and NO `dispose STOPPED`
 *                    line (nothing was in flight, so RELEASED was reachable;
 *                    the in-flight arm is pinned by the unit kit I9/I11 and by
 *                    `a5p1-order-hazard.mjs`).
 *   C7 discipline    :3080 is probed read-only and reads the same after; the
 *                    pinned test-use tree stays porcelain-clean; the world is
 *                    deleted at teardown (or its path recorded with --keep).
 *
 * MECHANISM: the public profile-patch seam only (`tests/homes/<world>` +
 * `cordis.patch.yml` rows: the production `dsh-agent-team` row pointing at
 * THIS worktree's built dist, the p6t6 observer row, and two `agent-preset`
 * registry rows). Mock model only (`packages/tools/harness/mock-deepseek.mjs`),
 * no real model key. Every wait <=180 s, plus a mock-storm fuse. Launch tokens
 * are REDACTED at capture, never at print. The host is killed only by its own
 * recorded pid, and only on the recorded port.
 *
 * Usage: node a5p1-kit.mjs [--keep] [--evidence-dir <p>] [--skip-order-leg]
 * EXIT: 0 = every criterion passed; 2 = a criterion failed; 1 = fatal.
 */
import { spawn, spawnSync } from 'node:child_process'
import { closeSync, existsSync, mkdirSync, openSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { startMockModel } from '../../../packages/tools/harness/mock-deepseek.mjs'
import { presetDeclarationRow, smokePresetPlugins } from '../../kits/_shared/preset-seam.mjs'
import { CLIENT_COMMIT_HASH, TEST_USE_BASELINE_SHA, DSH_BASELINE_VERSION, STABLE_INSTANCE_PORT, testUseTree, homeDir } from '../../paths.mjs'

// ── CLI / layout ────────────────────────────────────────────────────────────
const args = process.argv.slice(2)
const FLAG_KEEP = args.includes('--keep')
const SKIP_ORDER = args.includes('--skip-order-leg')
const KIT_DIR = dirname(new URL(import.meta.url).pathname)
const REPO_ROOT = resolve(KIT_DIR, '..', '..', '..')
const TESTUSE = testUseTree(REPO_ROOT)
const RUN_STAMP = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
const RUN_DIR = args.includes('--evidence-dir') ? resolve(args[args.indexOf('--evidence-dir') + 1]) : join(KIT_DIR, `run-${RUN_STAMP}`)
const HOME = homeDir(REPO_ROOT, `a5p1-${RUN_STAMP}`)
const WORKSPACE = join(HOME, 'workspace')
const MARKER_DIR = join(RUN_DIR, 'markers')
const LEDGER = join(RUN_DIR, 'probe-ledger.jsonl')
const BLUEPRINT_DIR = join(RUN_DIR, 'blueprints')
const INSTANCE_LOG = join(RUN_DIR, 'instance.log')
const HOST_PORT = 3185

const DIST_RUNTIME = join(REPO_ROOT, 'packages', 'runtime', 'dist', 'packages', 'runtime')
const HOST_BIN = join(TESTUSE, 'apps', 'cli', 'lib', 'bin.js')
const PRODUCTION_ROW_NAME = pathToFileURL(join(DIST_RUNTIME, 'src', 'plugin', 'host.js')).href
const GLUE_URL = pathToFileURL(join(DIST_RUNTIME, 'src', 'plugin', 'live', 'agent-bindings.mjs')).href
const SEAM_URL = pathToFileURL(join(REPO_ROOT, 'packages', 'runtime', 'root-binding', 'harness', 'seam.mjs')).href
const P6T6_ROW_NAME = pathToFileURL(join(REPO_ROOT, 'packages', 'tools', 'harness', 'plugin.mjs')).href
const PROBE_ROW_NAME = pathToFileURL(join(KIT_DIR, 'a5p1-probe-plugin.mjs')).href

const BASE_PRESET_ID = 'a5p1-base'
const PROBED_PRESET_ID = 'a5p1-probed'
const ROOT = `session-a5p1-root-${RUN_STAMP}`
const CREATE_ROOT = `session-a5p1-team-${RUN_STAMP}`
const BP_ANCHOR_ID = 'team.a5p1.anchor'
const BP_MAIN_ID = 'team.a5p1.main'
const MK_DISC = `A5P1_DISC_${RUN_STAMP}`
const MK_L1 = `A5P1_L1_${RUN_STAMP}`
const MK_STRICT = `A5P1_STRICT_${RUN_STAMP}`
const MK_CTL = `A5P1_CTL_${RUN_STAMP}`
const SEED_FILE = join(WORKSPACE, 'a5p1-seed.txt')
const SEED_CONTENT = `A5P1_SEED_${RUN_STAMP}`
/** The names the alpha.2 lane governs; everything else on the discovery
 *  surface goes into `builtinToolDeny` so the Coverage diagnostic stays a
 *  diagnostic (the same convention every a5/a4 real-host world uses). */
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
/** REDACTION AT CAPTURE: the launch token, session cookies and bearer
 *  values never enter an evidence file (or a log line) in the clear. */
const REDACT = [
  [/(https?:\/\/[^\s"'`]+?\?token=)[A-Za-z0-9_-]{8,}/g, '$1<REDACTED-TOKEN>'],
  [/dsh-auth-[A-Za-z0-9_-]{6,}(=[A-Za-z0-9._\-%=]{6,})?/g, 'dsh-auth-<REDACTED>=<REDACTED>'],
  [/\bBearer\s+[A-Za-z0-9._-]{6,}/gi, 'Bearer <REDACTED>'],
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
function dieFatal(msg, code = 1) {
  log(`FATAL ${redact(msg)}`)
  writeEvidence('summary.json', { runStamp: RUN_STAMP, fatal: redact(String(msg)), criteria })
  process.exit(code)
}

// ── http (every wait <= 180 s) ──────────────────────────────────────────────
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
async function remoteCall(origin, cookie, method, params, tag = 'a5p1') {
  return fetchJson(`${origin}/team-remote/${method}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie },
    body: JSON.stringify({ type: 'client-request', rpcId: `${tag}-${Math.random().toString(36).slice(2, 12)}`, method, payload: { version: 1, params } }),
  })
}
async function apiPrompt(origin, cookie, sessionId, text, tag = 'a5p1') {
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

// ── world materialization (public profile-patch seam only) ──────────────────
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
    rootPresetId: BASE_PRESET_ID,
    memberPresetId: PROBED_PRESET_ID,
    seedMembers: [],
    generation: 1,
    staticModel: { provider: 'deepseek-official', model: 'a5p1-model' },
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
  `  persona: "You are the leader of the a5p1 assembly team. ${MK_DISC} is the discovery marker."`,
  'members:', '  - templateId: strict', '    persona: "You are a worker of the a5p1 assembly team."',
  'memberEnvelopes: []', 'requirements: []', 'permissionMutationEnvelope:', '  rules: []',
  'teamHardEnvelope:', '  rules: []', 'policyStates: []', 'metadata: {}', '---', '',
].join('\n')

/** The main blueprint: `strict` carries `permissions` (the Guard population),
 *  `ctl` carries NO capabilities at all (the alpha.1/legacy control lane). */
function savedBlueprintYaml(denyList) {
  const denyLines = denyList.length === 0 ? ['    builtinToolDeny: []'] : ['    builtinToolDeny:', ...denyList.map((n) => `      - ${n}`)]
  return [
    '---', 'schemaVersion: 3', `blueprintId: ${BP_MAIN_ID}`, 'revision: "1"',
    'leader:', '  templateId: leader',
    `  persona: ${JSON.stringify(`You are the leader of the a5p1 assembly team. ${MK_L1} drives your chain: create one strict member and one legacy member, then delegate one script to each.`)}`,
    '  capabilities:', '    teamTools:', '      kind: allow', '      items:',
    '        - team_list_members', '        - team_create_member', '        - team_delegate', '        - team_collect',
    ...denyLines,
    '    skills:', '      kind: allow', '      items: []',
    '    mcp:', '      kind: allow', '      items: []',
    '    permissions:', '      default: ask', '      allow:', '        - tool: read', '          resource:', '            kind: any',
    '      ask: []', '      deny: []',
    'teamEnvelope:', '  allow:', '    - create-member', '    - assign-task', '    - send-message', '    - report-progress', '  deny: []',
    'members:',
    '  - templateId: strict', '    displayName: "a5p1 strict worker"',
    `    persona: ${JSON.stringify('You are a worker of the a5p1 assembly team (governed lane). Follow the delegated script exactly, one tool call at a time.')}`,
    '    capabilities:', '      teamTools:', '        kind: deny',
    ...denyLines.map((l) => `  ${l}`),
    '      skills:', '        kind: allow', '        items: []',
    '      mcp:', '        kind: allow', '        items: []',
    '      permissions:', '        default: ask',
    '        allow:', '          - tool: read', '            resource:', '              kind: any',
    '        ask: []', '        deny: []',
    // The control lane: NO `capabilities` block at all — the alpha.1 world,
    // where the Team glue installs no permission listener and PR1 installs no
    // Guard. `tools.restrict` would not be a closed world, and this lane is
    // where that absence has to stay harmless.
    '  - templateId: ctl', '    displayName: "legacy control worker"',
    `    persona: ${JSON.stringify('You are a worker of the a5p1 assembly team (legacy control lane). Follow the delegated script exactly, one tool call at a time.')}`,
    'memberEnvelopes:',
    '  - templateId: strict', '    envelope:', '      allow:', '        - send-message', '        - report-progress', '      deny: []',
    '  - templateId: ctl', '    envelope:', '      allow:', '        - send-message', '        - report-progress', '      deny: []',
    'permissionMutationEnvelope:', '  rules: []', 'teamHardEnvelope:', '  rules: []',
    'policyStates: []', 'metadata: {}', '---', '',
  ].join('\n')
}

function writePatchFile(home) {
  mkdirSync(join(home, 'profiles', 'web'), { recursive: true })
  const basePlugins = [...smokePresetPlugins({
    personaText: 'You are a coding agent powered by the {{model}} model.',
    cwdSuffix: 'Your working directory is {{cwd}}.',
    bashDescription: 'Run commands in a bash shell. State is persistent across calls.',
  }), { id: 'tool-fs-search', name: '@deepseek-ai/dsh-tool-fs-search', config: { sampleOverCapGlobResults: false } }]
  const probedPlugins = [...basePlugins, { id: 'a5p1-probe', name: PROBE_ROW_NAME }]
  const lines = [
    `# a5p1 PR1 patch layer (run ${RUN_STAMP}): production dsh-agent-team row (this worktree's dist) + p6t6 observer + two presets (base; base + a5p1-probe) — public profile-patch seam only.`,
    '- insert:',
    ...yamlEmitItem({ id: 'dsh-agent-team', name: PRODUCTION_ROW_NAME, config: teamRowConfig() }, 2),
    ...yamlEmitItem({ id: 'p6t6-team-tools', name: P6T6_ROW_NAME }, 2),
    ...yamlEmitItem(presetDeclarationRow({
      id: BASE_PRESET_ID, displayName: 'a5p1 base',
      description: `a5p1 base preset (run ${RUN_STAMP}) = smoke + tool-fs-search`,
      plugins: basePlugins,
    }), 2),
    ...yamlEmitItem(presetDeclarationRow({
      id: PROBED_PRESET_ID, displayName: 'a5p1 probed',
      description: `a5p1 probed preset (run ${RUN_STAMP}) = base + the undeclared-registration probe`,
      plugins: probedPlugins,
    }), 2),
    '',
  ]
  writeFileSync(join(home, 'profiles', 'web', 'cordis.patch.yml'), lines.join('\n'))
}

// ── host boot ───────────────────────────────────────────────────────────────
function spawnHost({ port, home, logPath, mockPort }) {
  const outFd = openSync(logPath, 'a')
  const errFd = openSync(logPath, 'a')
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
        DEEPSEEK_API_KEY: 'a5p1-mock-key',
        A5P1_LEDGER: LEDGER,
        A5P1_MARKER_DIR: MARKER_DIR,
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
  return { pid: child.pid, exitInfo, alive: () => !exitInfo.exited, logPath }
}
function stopHost(h) {
  try { if (h?.pid !== undefined) process.kill(h.pid) } catch { /* already gone */ }
}

// ── mock model: the scripted leader and the two member scripts ──────────────
const toolCall = (name, argsObj) => ({
  kind: 'tool-call',
  toolCalls: [{ id: `call-a5p1-${Math.random().toString(36).slice(2, 10)}`, name, arguments: argsObj }],
})
function bodyOf(rec) { return rec === null || typeof rec !== 'object' ? null : ('body' in rec ? (rec.body ?? null) : rec) }
function messagesOf(req) { return bodyOf(req)?.messages ?? [] }
function toolMsgsOf(req) {
  const out = []
  for (const m of messagesOf(req)) {
    for (const b of Array.isArray(m?.content) ? m.content : []) {
      if (b?.type === 'tool_result') out.push({ text: (Array.isArray(b.content) ? b.content : []).map((c) => c?.text ?? '').join(''), isError: b.is_error === true })
    }
  }
  return out
}
function lastUserTextOf(req) {
  const messages = messagesOf(req)
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const m = messages[i]
    if (m?.role === 'user') return typeof m.content === 'string' ? m.content : JSON.stringify(m.content ?? '')
  }
  return ''
}
function surfaceNamesOf(req) { return (bodyOf(req)?.tools ?? []).map((t) => String(t?.name ?? '')).filter((n) => n !== '') }
function extractInstanceId(content) {
  const m = /"targetInstanceId"\s*:\s*"([^"]+)"/.exec(String(content))
    ?? /"instanceId"\s*:\s*"([^"]+)"/.exec(String(content))
    ?? /inst-[A-Za-z0-9][A-Za-z0-9-]{3,64}/.exec(String(content))
  return m === null ? null : (m[1] ?? m[0])
}

function makeDecide() {
  const seen = { ids: [] }
  return function decide({ req }) {
    const first = messagesOf(req)[0]
    const firstText = typeof first?.content === 'string' ? first.content : JSON.stringify(first?.content ?? '')
    if (firstText.includes('session title')) return { kind: 'text', content: 'a5p1 assembly session' }
    const user = lastUserTextOf(req)
    const results = toolMsgsOf(req)
    if (user.includes(MK_STRICT) || user.includes(MK_CTL)) {
      const tag = user.includes(MK_STRICT) ? 'strict' : 'ctl'
      switch (results.length) {
        // (1) a governed, allowed call — the Guard must NOT shutdown the Agent.
        case 0: return toolCall('read', { file_path: SEED_FILE })
        // (2) the tool that appeared AFTER publish — the H6 shape.
        case 1: return toolCall('a5p1_dyn_probe', { tag })
        // (3) the tool the mounted preset contributed during assembly.
        case 2: return toolCall('a5p1_early_probe', { tag })
        default: return { kind: 'text', content: `A5P1_${tag.toUpperCase()}_DONE` }
      }
    }
    if (user.includes(MK_L1)) {
      switch (results.length) {
        case 0: return toolCall('team_create_member', { rootSessionId: CREATE_ROOT, requestToken: `a5p1-c1-${RUN_STAMP}`, delegationTemplateId: 'strict', label: 'p1-strict' })
        case 1: return toolCall('team_create_member', { rootSessionId: CREATE_ROOT, requestToken: `a5p1-c2-${RUN_STAMP}`, delegationTemplateId: 'ctl', label: 'p1-ctl' })
        case 2: {
          const id = extractInstanceId(results[0]?.text ?? '')
          if (id === null) return { kind: 'text', content: `A5P1_ID_FAIL :: ${String(results[0]?.text).slice(0, 200)}` }
          seen.ids.push(id)
          return toolCall('team_delegate', { rootSessionId: CREATE_ROOT, requestToken: `a5p1-d1-${RUN_STAMP}`, delegationInstanceId: id, label: 'p1-strict', prompt: MK_STRICT, async: true })
        }
        case 3: {
          const id = extractInstanceId(results[1]?.text ?? '')
          if (id === null) return { kind: 'text', content: 'A5P1_ID_FAIL2' }
          seen.ids.push(id)
          return toolCall('team_delegate', { rootSessionId: CREATE_ROOT, requestToken: `a5p1-d2-${RUN_STAMP}`, delegationInstanceId: id, label: 'p1-ctl', prompt: MK_CTL, async: true })
        }
        // C5: the SECOND delegation to the governed member, after its first
        // turn ended — the re-drive arm of the same instance.
        case 4: return toolCall('team_delegate', { rootSessionId: CREATE_ROOT, requestToken: `a5p1-d3-${RUN_STAMP}`, delegationInstanceId: seen.ids[0] ?? 'unknown', label: 'p1-strict-again', prompt: `${MK_STRICT} AGAIN`, async: true })
        default: return { kind: 'text', content: 'A5P1_L1_DONE' }
      }
    }
    return { kind: 'text', content: 'A5P1_NOOP_DONE' }
  }
}
async function waitForMock(mock, pred, timeoutMs, label) {
  const deadline = Date.now() + timeoutMs
  for (;;) {
    const hit = mock.requests.find(pred)
    if (hit !== undefined) return hit
    if (mock.requests.length > 300) { log(`mock storm fuse tripped (${label}, requests=${String(mock.requests.length)})`); return null }
    if (Date.now() >= deadline) { log(`mock wait timed out (<=180s): ${label} (requests=${String(mock.requests.length)})`); return null }
    await new Promise((r) => setTimeout(r, 400))
  }
}

// ── main ────────────────────────────────────────────────────────────────────
async function main() {
  writeFileSync(RUN_LOG, '', { flag: 'w' })
  log(`a5p1 kit ${RUN_STAMP}: host ${DSH_BASELINE_VERSION} @ ${TEST_USE_BASELINE_SHA.slice(0, 10)}; port ${HOST_PORT}; world ${HOME}`)
  if (!existsSync(HOST_BIN)) dieFatal(`pinned host build absent: ${HOST_BIN} (build tests/deepseek-harness-test-use per docs/TEST_METHODS.md §2)`)
  if (!existsSync(join(DIST_RUNTIME, 'tool-dispatch', 'index.js'))) dieFatal(`the PR1 lane is not built: ${join(DIST_RUNTIME, 'tool-dispatch', 'index.js')} (run the runtime build)`)

  const stableBefore = await probeStableInstance()
  writeEvidence('stable-instance-before.json', stableBefore)

  const orderResult = SKIP_ORDER ? { skipped: true } : await runOrderLeg()

  mkdirSync(WORKSPACE, { recursive: true })
  mkdirSync(BLUEPRINT_DIR, { recursive: true })
  mkdirSync(MARKER_DIR, { recursive: true })
  writeFileSync(SEED_FILE, `${SEED_CONTENT}\n`)
  writeFileSync(join(BLUEPRINT_DIR, 'anchor.yaml'), BP_ANCHOR_YAML)
  writePatchFile(HOME)
  // The p6t6 observer row validates its run directive at setup and refuses to
  // boot without it (packages/tools/harness/plugin.mjs) — written before the
  // spawn, exactly as every a4/a5 real-host world does.
  writeFileSync(join(HOME, 'p6t6-directive.json'), JSON.stringify({
    boot: 1, phase: 'create', reportDir: RUN_DIR, runStamp: RUN_STAMP, rootSessionId: ROOT,
  }, null, 2))

  const mock = await startMockModel({ port: 0, decide: makeDecide(), log: () => {} })
  let host = undefined
  let origin = ''
  let cookie = ''
  try {
    host = spawnHost({ port: HOST_PORT, home: HOME, logPath: INSTANCE_LOG, mockPort: mock.port })
    const boot = await waitForLogLine(INSTANCE_LOG, BOOT_MARKER, 180_000, host.alive)
    if (boot === null) dieFatal(`no boot marker within 180s; log tail: ${readFileSync(INSTANCE_LOG, 'utf8').slice(-1200)}`)
    origin = `http://127.0.0.1:${boot.m[1]}`
    cookie = await authenticate(origin, boot.m[2])
    const health = await fetchJson(`${origin}/__p6t6/health`, undefined, 30_000)
    const noTok = await fetch(`${origin}/`, { signal: AbortSignal.timeout(10_000) }).catch(() => null)
    check('C1a', 'host booted on the recorded port with the production Team row mounted and the token gate live',
      Number(boot.m[1]) === HOST_PORT && health.body?.ok === true && noTok?.status === 401,
      `port=${String(boot.m[1])} healthOk=${String(health.body?.ok)} noToken=${String(noTok?.status)}`)

    // Discovery: compute `builtinToolDeny` from the LIVE leader surface, the
    // same convention as every a4/a5 real-host world, so the Coverage
    // diagnostic (kept, not the safety line) does not pre-empt the legs.
    await apiPrompt(origin, cookie, ROOT, MK_DISC)
    const disc = await waitForMock(mock, (r) => r.body !== null && lastUserTextOf(r).includes(MK_DISC) && surfaceNamesOf(r).length > 0, 180_000, 'DISC')
    if (disc === null) dieFatal('discovery model request absent; cannot compute the deny list')
    const surface = surfaceNamesOf(disc).sort()
    const denyList = surface.filter((n) => !n.startsWith('team_') && !MANAGED_TOOL_NAMES.includes(n) && !SAFE_UNMANAGED_TOOL_NAMES.includes(n))
    writeFileSync(join(BLUEPRINT_DIR, 'main.yaml'), savedBlueprintYaml(denyList))
    writeEvidence('discovery-surface.json', { surface, denyList })

    const created = await remoteCall(origin, cookie, 'team.create', { rootSessionId: CREATE_ROOT, blueprintId: BP_MAIN_ID, initialWork: { prompt: MK_L1 } })
    const createOk = created.status === 200 && created.body?.result?.ok === true
    check('C1b', 'team.create (remote HTTP) starts the governed team session', createOk,
      `status=${String(created.status)} body=${JSON.stringify(created.body ?? created).slice(0, 300)}`)
    if (!createOk) dieFatal(`team.create failed: ${JSON.stringify(created.body ?? {}).slice(0, 400)}`)

    const leaderDone = await waitForMock(mock, (r) => lastUserTextOf(r).includes(MK_L1) && r.reply?.kind === 'text' && r.reply.content === 'A5P1_L1_DONE', 180_000, 'leader chain')
    writeEvidence('leader-tool-results.json', (leaderDone === null ? [] : toolMsgsOf(leaderDone)).map((r) => String(r.text).slice(0, 900)))
    check('C1c', 'the leader created one governed member and one legacy member and delegated to both',
      leaderDone !== null && toolMsgsOf(leaderDone).length === 4,
      `results=${String(toolMsgsOf(leaderDone ?? {}).length)} seen=${leaderDone === null ? 'timeout' : 'ok'}`)

    const strictDone = await waitForMock(mock, (r) => lastUserTextOf(r).includes(MK_STRICT) && r.reply?.kind === 'text' && r.reply.content === 'A5P1_STRICT_DONE', 180_000, 'strict member script')
    const ctlDone = await waitForMock(mock, (r) => lastUserTextOf(r).includes(MK_CTL) && r.reply?.kind === 'text' && r.reply.content === 'A5P1_CTL_DONE', 180_000, 'ctl member script')
    if (strictDone === null || ctlDone === null) {
      writeEvidence('mock-tail.json', mock.requests.slice(-12).map((r) => ({ seq: r.seq, lastUser: lastUserTextOf(r).slice(0, 200), reply: r.reply })))
      dieFatal(`member scripts did not finish (strict=${String(strictDone !== null)} ctl=${String(ctlDone !== null)}); see mock-tail.json`)
    }

    // Re-drive the governed member a second time (C5): the notice below is a
    // new turn on the SAME member, after its first turn ended.
    await apiPrompt(origin, cookie, ROOT, `${MK_L1} again`)
    const secondLeader = await waitForMock(mock, (r) => lastUserTextOf(r).includes(`${MK_L1} again`), 180_000, 'leader re-drive')
    const secondStrict = secondLeader !== null
      ? await waitForMock(mock, (r) => lastUserTextOf(r).includes(`${MK_STRICT} AGAIN`) && r.reply?.kind === 'text' && r.reply.content === 'A5P1_STRICT_DONE', 180_000, 'strict member re-drive')
      : null
    writeEvidence('member-model-views.json', {
      strict: toolMsgsOf(strictDone).map((r) => ({ isError: r.isError, text: String(r.text).slice(0, 500) })),
      ctl: toolMsgsOf(ctlDone).map((r) => ({ isError: r.isError, text: String(r.text).slice(0, 500) })),
      strictRedrive: secondStrict === null ? null : toolMsgsOf(secondStrict).map((r) => ({ isError: r.isError, text: String(r.text).slice(0, 500) })),
    })
    const ledger = existsSync(LEDGER) ? readFileSync(LEDGER, 'utf8').split('\n').filter((l) => l.trim() !== '').map((l) => { try { return JSON.parse(l) } catch { return null } }).filter(Boolean) : []
    writeEvidence('probe-ledger.json', ledger)
    const markers = existsSync(MARKER_DIR) ? readdirSync(MARKER_DIR) : []
    writeEvidence('marker-dir.json', { markers })

    stopHost(host)
    await new Promise((r) => setTimeout(r, 1500))
    const hostLog = existsSync(INSTANCE_LOG) ? readFileSync(INSTANCE_LOG, 'utf8') : ''
    const guardLines = hostLog.split('\n').filter((l) => l.includes('a5p1-guard:'))
    writeEvidence('guard-observations.txt', guardLines.join('\n'))

    // ── criteria ────────────────────────────────────────────────────────────
    const textFor = (kind, wantsError) => ledger.filter((r) => r.leg === 'probe-result' && r.kind === kind && (wantsError === undefined || r.isError === wantsError))
    const dynDenied = textFor('dyn', true)
    const dynVerdict = dynDenied.find((r) => String(r.text).includes('team tool guard') && String(r.text).includes('no Team Tool Binding'))
    const dynMarkers = markers.filter((m) => m.startsWith('dyn-'))
    check('C2a', 'the post-publish undeclared registration is REFUSED with the typed closed-world text',
      dynVerdict !== undefined,
      dynVerdict === undefined ? `denials=${String(dynDenied.length)} texts=${JSON.stringify(dynDenied.map((r) => String(r.text).slice(0, 120)))}` : `text=${String(dynVerdict.text).slice(0, 240)}`)
    check('C2b', 'the undeclared probe BODY never ran on the governed lane (the dynRan FLIP: PoC recorded true)',
      !dynMarkers.some((m) => m.includes('strict')), `markers=${JSON.stringify(markers)}`)

    const readResults = toolMsgsOf(strictDone)
    check('C3', 'a governed allowed call still runs (the Guard closes a world, it does not shut the Agent down)',
      readResults.length >= 1 && String(readResults[0]?.text ?? '').includes(SEED_CONTENT),
      `first=${String(readResults[0]?.text ?? '').slice(0, 160)}`)

    const ctlRan = markers.some((m) => m.startsWith('dyn-') && m.includes('ctl'))
    const ctlDyn = textFor('dyn').filter((r) => String(r.text).includes('dyn-ran'))
    check('C4', 'the SAME undeclared registration still runs on the permissions-less legacy lane (zero interference)',
      ctlRan || ctlDyn.length > 0, `markers=${JSON.stringify(markers)} ranResults=${JSON.stringify(ctlDyn.map((r) => r.text).slice(0, 2))}`)
    const ctlDenied = textFor('dyn', true).filter((r) => String(r.text).includes('ctl'))
    check('C4b', 'no Guard ever spoke for the permissions-less lane',
      ctlDenied.length === 0, `unexpected=${JSON.stringify(ctlDenied.map((r) => String(r.text).slice(0, 120)))}`)

    const earlyRan = markers.filter((m) => m.startsWith('early-'))
    writeEvidence('early-registration-observation.json', {
      note: 'DISCLOSED OBSERVATION, not a criterion: which side of the publish line `agent/created` falls on is a host fact. A name the mounted preset contributes BEFORE the assembly publishes is part of the declared surface and is bound as such; the PR1 claim is about names that appear after it (C2) and about never falling back to a native body.',
      markers: earlyRan,
      results: ledger.filter((r) => r.kind === 'early'),
    })

    const secondView = secondStrict === null ? null : toolMsgsOf(secondStrict)
    check('C5', 'the re-driven governed member still refuses the unbound name and still serves the governed one',
      secondStrict !== null
        && String(secondView?.[0]?.text ?? '').includes(SEED_CONTENT)
        && String(secondView?.[1]?.text ?? '').includes('team tool guard'),
      `seen=${String(secondStrict !== null)} results=${JSON.stringify((secondView ?? []).map((r) => String(r.text).slice(0, 100)))}`)

    const publishes = guardLines.filter((l) => l.includes('dispatcher-published'))
    const refused = guardLines.filter((l) => l.includes('REFUSED'))
    check('C1d', 'the production assembly armed and published the closed world per permissions-carrying Agent (leader + governed member)',
      publishes.length >= 2 && refused.length === 0,
      `publishes=${String(publishes.length)} refused=${String(refused.length)}`)
    const stopped = guardLines.filter((l) => l.includes('ordered dispose STOPPED'))
    check('C6', 'the ordered teardown reached its end state at row close (nothing in flight ⇒ no STOPPED line)',
      stopped.length === 0, `stopped=${JSON.stringify(stopped.map((l) => l.slice(0, 160)))}`)
  } finally {
    stopHost(host)
    try { await mock.close() } catch { /* already closed */ }
  }

  const stableAfter = await probeStableInstance()
  writeEvidence('stable-instance-after.json', stableAfter)
  check('C7a', 'the stable development instance (:3080) reads the same before/after and was never operated',
    stableAfter.status === stableBefore.status, `before=${String(stableBefore.status)} after=${String(stableAfter.status)}`)

  const cleanTree = checkTreePristine()
  check('C7b', 'the pinned test-use tree is still porcelain-clean (no Team write ever touched it)', cleanTree.ok, cleanTree.detail)

  if (!FLAG_KEEP && existsSync(HOME)) {
    rmSync(HOME, { recursive: true, force: true })
  }
  writeEvidence('summary.json', {
    runStamp: RUN_STAMP,
    hostBaseline: { version: DSH_BASELINE_VERSION, sha: TEST_USE_BASELINE_SHA, clientCommitHash: CLIENT_COMMIT_HASH },
    port: HOST_PORT,
    world: FLAG_KEEP ? HOME : `${HOME} (removed at teardown)`,
    criteria,
    orderLeg: orderResult,
  })
  const failed = criteria.filter((c) => !c.ok)
  log(`criteria: ${String(criteria.length - failed.length)}/${String(criteria.length)} pass${failed.length === 0 ? '' : ` — FAILED: ${failed.map((c) => c.id).join(', ')}`}`)
  process.exitCode = failed.length === 0 ? 0 : 2
}

/** The pinned test-use tree must stay a pristine upstream checkout: git
 *  status empty (its build output is gitignored, its sources untouched). */
function checkTreePristine() {
  const r = spawnSync('git', ['-C', TESTUSE, 'status', '--porcelain'], { encoding: 'utf8' })
  const out = String(r.stdout ?? '').trim()
  return { ok: r.status === 0 && out === '', detail: out.slice(0, 400) }
}

/** The NEG-1 order-hazard arms, run in a child process against the pinned
 *  registry (`a5p1-order-hazard.mjs`); its criteria join this kit's table. */
function runOrderLeg() {
  const outFile = join(RUN_DIR, 'order-hazard.json')
  const r = spawnSync(process.execPath, [join(KIT_DIR, 'a5p1-order-hazard.mjs'), '--out', outFile], { encoding: 'utf8', timeout: 240_000 })
  let parsed = null
  try { parsed = JSON.parse(readFileSync(outFile, 'utf8')) } catch { parsed = null }
  const legs = (parsed?.criteria ?? []).map((c) => ({ ...c, detail: `${c.detail} (exit=${String(r.status)})` }))
  for (const c of legs) check(c.id, `order-leg — ${c.name}`, c.ok, c.detail)
  if (legs.length === 0) check('NEG1-RUN', 'the order-hazard leg produced a result file', false, `exit=${String(r.status)} stderr=${String(r.stderr).slice(0, 300)}`)
  return { exit: r.status, criteria: legs, result: parsed === null ? null : parsed.arms }
}

main().catch((error) => dieFatal(`kit crashed: ${error instanceof Error ? error.stack : String(error)}`))
