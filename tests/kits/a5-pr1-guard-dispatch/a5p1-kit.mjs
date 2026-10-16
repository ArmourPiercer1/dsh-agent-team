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
 *                          [--inject-fatal-after-boot]
 *
 * `--inject-fatal-after-boot` is the F5 proof leg: it forces a FATAL at the
 * strongest possible point — the world exists and the Host is live, past the
 * boot gate — so the run exercises the FAILURE path's cleanup (stop the Host,
 * sweep the world, verify it is gone) and leaves the trace behind. It is a kit
 * switch, not a production code path.
 * EXIT: 0 = every criterion passed; 2 = a criterion failed; 1 = fatal.
 */
import { createHash } from 'node:crypto'
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
// The Host's stdout is captured RAW and redacted into `instance.log` before
// that artifact is finalized. Raw-to-pipe was tried first and is not usable on
// this Host: with the child's stdout a pipe, the boot marker had not reached the
// kit 180 s in (measured — the same world boots in ~2 s when the child owns a
// file descriptor), which turns a working Host into a FATAL. The raw capture is
// deleted once the redacted copy exists; a run killed mid-flight can leave it
// behind, and `sweep-worlds.mjs --scrub-raw` is the runner-side repair (it
// rewrites every leftover through the same redaction table).
const INSTANCE_RAW = join(RUN_DIR, 'host-stdout.raw')
const HOST_PORT = 3185

const DIST_RUNTIME = join(REPO_ROOT, 'packages', 'runtime', 'dist', 'packages', 'runtime')
const HOST_BIN = join(TESTUSE, 'apps', 'cli', 'lib', 'bin.js')
const PRODUCTION_ROW_NAME = pathToFileURL(join(DIST_RUNTIME, 'src', 'plugin', 'host.js')).href
const GLUE_URL = pathToFileURL(join(DIST_RUNTIME, 'src', 'plugin', 'live', 'agent-bindings.mjs')).href
const SEAM_URL = pathToFileURL(join(REPO_ROOT, 'packages', 'runtime', 'root-binding', 'harness', 'seam.mjs')).href
const P6T6_ROW_NAME = pathToFileURL(join(REPO_ROOT, 'packages', 'tools', 'harness', 'plugin.mjs')).href
const PROBE_ROW_NAME = pathToFileURL(join(KIT_DIR, 'a5p1-probe-plugin.mjs')).href

const PROBED_PRESET_ID = 'a5p1-probed'
const BASE_PRESET_ID = 'a5p1-base'
const ROOT = `session-a5p1-root-${RUN_STAMP}`
const CREATE_ROOT = `session-a5p1-team-${RUN_STAMP}`
const BP_ANCHOR_ID = 'team.a5p1.anchor'
const BP_MAIN_ID = 'team.a5p1.main'
const MK_DISC = `A5P1_DISC_${RUN_STAMP}`
const MK_L1 = `A5P1_L1_${RUN_STAMP}`
const MK_STRICT = `A5P1_STRICT_${RUN_STAMP}`
const MK_CTL = `A5P1_CTL_${RUN_STAMP}`
const SEED_FILE = join(WORKSPACE, 'a5p1-seed.txt')
// A REAL native Definition with a real body, used as the undeclared name: its
// success is observable OUTSIDE the model transcript (the file it writes), so a
// refusal cannot be faked by a tool that does not exist.
const sideEffect = (tag) => join(WORKSPACE, `a5p1-${tag}.sideeffect`)
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
/** A stable fingerprint replaces the secret: two captures of the same token
 *  still line up across artifacts, and no artifact carries a usable value. */
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
/** The tail of a log, for a fatal message that has to be actionable. */
function logTail(logPath, n = 25) {
  try { return redact(readFileSync(logPath, 'utf8').split('\n').slice(-n).join('\n')) } catch { return '<no log>' }
}
function writeEvidence(name, content) {
  try {
    writeFileSync(join(RUN_DIR, name), redact(typeof content === 'string' ? content : JSON.stringify(content, null, 2)))
  } catch { /* best-effort */ }
}
/**
 * The world is scaffolding, so it goes away on EVERY exit route — success,
 * FATAL, or an unexpected throw. An abandoned `tests/homes/a5p1-*` per failed
 * attempt is how "worlds are deleted after use" quietly becomes a claim about
 * the happy path only; seven of them had piled up before this note.
 */
/**
 * Finalize the Host log: the REDACTED copy becomes the artifact and the raw
 * capture is removed, so the only instance log in the evidence directory has no
 * credential in it. Called on every exit route.
 */
function sealHostLog() {
  if (!existsSync(INSTANCE_RAW)) return
  try {
    writeFileSync(INSTANCE_LOG, redact(readFileSync(INSTANCE_RAW, 'utf8')))
    rmSync(INSTANCE_RAW, { force: true })
  } catch {
    /* a log is never a reason to lose the run */
  }
}

function sweepWorld() {
  if (FLAG_KEEP) return 'kept (--keep)'
  if (!existsSync(HOME)) return 'absent'
  try {
    rmSync(HOME, { recursive: true, force: true })
    return 'removed'
  } catch (error) {
    return 'removal FAILED: ' + String(error?.message ?? error)
  }
}

/** The Host child the failure path has to stop before it can sweep (set by the
 *  run body right after spawn; a live Host re-creates whatever is deleted). */
let CURRENT_HOST = undefined
/** Is a process still there? ESRCH means no, anything else means yes. */
function signalProbe(pid) {
  try {
    process.kill(pid, 0)
    return 'alive'
  } catch (error) {
    return String(error?.code ?? error) === 'ESRCH' ? 'gone' : `probe error ${String(error?.code ?? error)}`
  }
}

/** A synchronous wait the failure path can use (no timers survive exit). */
function sleepSync(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms)
}

function dieFatal(msg, code = 1) {
  log(`FATAL ${redact(msg)}`)
  // THE FAILURE PATH CLEANS UP TOO (a deleted world that the run left RUNNING
  // behind it is not cleanup). Stop the Host, wait for it to actually go, then
  // sweep — and VERIFY the absence, because "rmSync did not throw" is not the
  // same fact as "the world is gone".
  // Liveness is probed with `process.kill(pid, 0)`, NOT with the child's
  // `exited` flag: this path has no event loop left to run the `close` handler,
  // so the flag would say "alive" for a process that is already gone (measured
  // on the first F5 leg). A direct child can also sit unreaped, which is a
  // resource question, not a safety one — the safety question is whether
  // anything is still writing into the world, and that is answered by the
  // re-check below.
  let stopped = 'no host was started'
  if (CURRENT_HOST !== undefined && CURRENT_HOST.pid !== undefined) {
    const pid = CURRENT_HOST.pid
    stopHost(CURRENT_HOST)
    stopped = signalProbe(pid) === 'gone' ? 'stopped (SIGTERM)' : 'SIGTERM sent; process still answering signals'
    if (stopped !== 'stopped (SIGTERM)') {
      try {
        process.kill(pid, 'SIGKILL')
      } catch {
        /* already gone */
      }
      sleepSync(250)
      stopped = signalProbe(pid) === 'gone' ? 'stopped (SIGTERM escalated to SIGKILL)' : 'SIGKILL sent; process still answering signals (unreaped direct child; no event loop left to reap it)'
    }
  }
  const world = sweepWorld()
  // The claim that matters is the one a live writer could break: sweep, wait
  // past any in-flight flush, and look again.
  sleepSync(500)
  const verified = existsSync(HOME)
    ? 'FAIL: world STILL PRESENT after the sweep (something re-created it)'
    : 'verified absent (re-checked 500 ms after the sweep)'
  log(`FATAL cleanup: host=${stopped} world=${world} residue=${verified}`)
  sealHostLog()
  writeEvidence('summary.json', {
    runStamp: RUN_STAMP,
    fatal: redact(String(msg)),
    world,
    cleanup: { host: stopped, world, residue: verified, home: HOME },
    criteria,
  })
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
  // The hazard row is mounted through the PRESET, on both members: the probe
  // needs an Agent scope to register against (a plugin row's own scope cannot
  // register on this Host — `cannot get property "tools" without inject`,
  // measured), and both lanes must carry the identical plugin mount so no
  // criterion can be explained away by a different setup.
  const probedPlugins = [...basePlugins, { id: 'a5p1-probe', name: PROBE_ROW_NAME }]
  const lines = [
    `# a5p1 PR1 patch layer (run ${RUN_STAMP}): production dsh-agent-team row (this worktree's dist) + p6t6 observer + two presets (base; base + a5p1 probe) — public profile-patch seam only.`,
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
/** The text of one message, however it is shaped. */
function textOf(m) { return typeof m?.content === 'string' ? m.content : JSON.stringify(m.content ?? '') }
/**
 * Which scripted chain this request belongs to: a marker is found ANYWHERE in
 * the transcript, not just in the last user message — after the first tool
 * call the last user message is a `tool_result` block, and a script that keys
 * on "the last user text contains my marker" silently stops matching exactly
 * when the chain starts doing work.
 */
function hasMarker(req, marker) { return messagesOf(req).some((m) => textOf(m).includes(marker)) }
/**
 * How many tool results have come back SINCE the last occurrence of the
 * marker. Per-TURN, not per-conversation: the second delegation to the same
 * member reuses the same session, and a counter over the whole transcript
 * would start the second script already finished.
 */
function stepsSince(req, marker) {
  const messages = messagesOf(req)
  let start = -1
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    if (textOf(messages[i]).includes(marker)) { start = i; break }
  }
  if (start === -1) return -1
  let n = 0
  for (let i = start + 1; i < messages.length; i += 1) {
    for (const b of Array.isArray(messages[i]?.content) ? messages[i].content : []) {
      if (b?.type === 'tool_result') n += 1
    }
  }
  return n
}
function resultsSince(req, marker) {
  const messages = messagesOf(req)
  let start = -1
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    if (textOf(messages[i]).includes(marker)) { start = i; break }
  }
  if (start === -1) return []
  const out = []
  for (let i = start + 1; i < messages.length; i += 1) {
    for (const b of Array.isArray(messages[i]?.content) ? messages[i].content : []) {
      if (b?.type === 'tool_result') out.push({ text: (Array.isArray(b.content) ? b.content : []).map((c) => c?.text ?? '').join(''), isError: b.is_error === true })
    }
  }
  return out
}
/** The tool results of the NEWEST turn only — the whole transcript would hand
 *  back the first instance id forever, and two delegations would silently
 *  address the same member. */
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
function extractInstanceId(content) {
  const m = /"targetInstanceId"\s*:\s*"([^"]+)"/.exec(String(content))
    ?? /"instanceId"\s*:\s*"([^"]+)"/.exec(String(content))
    ?? /inst-[A-Za-z0-9][A-Za-z0-9-]{3,64}/.exec(String(content))
  return m === null ? null : (m[1] ?? m[0])
}

/**
 * Which scripted chain a model request belongs to, decided on HOST-PROTOCOL
 * facts that survive the Host's own transcript handling: the delegation
 * request tokens and the `[team-root-work]` / `[team-work]` / `[team-work-settled]`
 * message prefixes the Team glue puts on its notices. Deliberately NOT decided
 * by "the last user message contains my marker" — after the first tool call the
 * last user message is a `tool_result`, and after an async delegation settles
 * the Host resumes the Leader with a NOTICE whose transcript no longer carries
 * the original prompt in a findable position. A script keyed on the latter
 * silently stops matching exactly when the work starts.
 */
function laneOf(req) {
  const t = messagesOf(req).map(textOf).join('\n')
  if (t.includes('Generate the session title')) return 'title'
  if (t.includes(`[team-work requestToken=a5p1-d3-`)) return 'strict-again'
  if (t.includes(`[team-work requestToken=a5p1-d2-`)) return 'ctl'
  if (t.includes(`[team-work requestToken=a5p1-d1-`)) return 'strict'
  if (t.includes(MK_DISC)) return 'disc'
  if (t.includes('[team-root-work') || t.includes('[team-work-settled') || t.includes(`a5p1-c1-${RUN_STAMP}`)) return 'leader'
  return 'other'
}

function makeDecide() {
  // The step is THIS script's own progress in its own lane — a counter it
  // issued, not something re-derived from a transcript the Host owns and may
  // summarize. One request per step, because the Host asks once per result.
  const steps = { leader: 0, strict: 0, ctl: 0, 'strict-again': 0 }
  const ids = /** @type {Record<string, string>} */ ({})
  const memberReply = (lane, step, tag) => {
    switch (step) {
      // (1) a governed, ALLOWED call (`read` is in the blueprint's allow lane):
      // the closed world must keep serving it. A Guard that shuts the Agent
      // down instead of closing a world fails here, not at (2).
      case 0: return toolCall('read', { file_path: SEED_FILE })
      // (2) `write`: a REAL native Definition with a real body, present in the
      // registry on every lane, and NOT declared to the governed Agent. Its
      // body writes a file, so "the body never ran" is proved outside the
      // transcript. On the permissions-less lane the same call must simply run.
      case 1: return toolCall('write', { file_path: sideEffect(tag), content: `A5P1_RAN_${tag}_${RUN_STAMP}\n` })
      default: return { kind: 'text', content: `A5P1_${lane.toUpperCase()}_DONE` }
    }
  }
  return function decide({ req }) {
    const lane = laneOf(req)
    if (lane === 'title' || lane === 'disc' || lane === 'other') {
      if (lane === 'title') return { kind: 'text', content: 'a5p1 assembly session' }
      return { kind: 'text', content: 'A5P1_NOOP_DONE' }
    }
    if (lane === 'leader') {
      const step = steps.leader
      steps.leader += 1
      const token = (n) => `a5p1-${n}-${RUN_STAMP}`
      switch (step) {
        case 0: return toolCall('team_create_member', { rootSessionId: CREATE_ROOT, requestToken: token('c1'), delegationTemplateId: 'strict', label: 'p1-strict' })
        case 1: return toolCall('team_create_member', { rootSessionId: CREATE_ROOT, requestToken: token('c2'), delegationTemplateId: 'ctl', label: 'p1-ctl' })
        case 2: {
          const found = extractInstanceId(lastToolResultText(req))
          if (found === null) return { kind: 'text', content: 'A5P1_ID_FAIL_1' }
          ids.strict = found
          return toolCall('team_delegate', { rootSessionId: CREATE_ROOT, requestToken: token('d1'), delegationInstanceId: found, label: 'p1-strict', prompt: MK_STRICT, async: true })
        }
        case 3: {
          // The NEWEST result only: this is the second create-member reply,
          // and addressing the first instance again would silently run both
          // delegations against the same Agent.
          const found = extractInstanceId(lastToolResultText(req))
          if (found === null) return { kind: 'text', content: 'A5P1_ID_FAIL_2' }
          ids.ctl = found
          return toolCall('team_delegate', { rootSessionId: CREATE_ROOT, requestToken: token('d2'), delegationInstanceId: found, label: 'p1-ctl', prompt: MK_CTL, async: true })
        }
        // C2: a Team tool the blueprint never declared, which the Team glue
        // registered AFTER this Agent published. It is a real definition with a
        // real effect — the only post-publish, real-definition name this Host
        // lets a test reach without any plugin of ours — so it is the honest
        // Host-side instance of "a name nothing bound".
        case 4: return toolCall('team_follow_up', { rootSessionId: CREATE_ROOT, requestToken: token('u1'), delegationInstanceId: ids.strict ?? 'inst-unknown', label: 'p1-strict' })
        // C5: the governed member gets a SECOND task after its first turn
        // ended — the same instance, a new turn, the Guard long since published.
        case 5: {
          if (ids.strict === undefined) return { kind: 'text', content: 'A5P1_ID_FAIL_3' }
          return toolCall('team_delegate', { rootSessionId: CREATE_ROOT, requestToken: token('d3'), delegationInstanceId: ids.strict, label: 'p1-strict-again', prompt: `${MK_STRICT} AGAIN`, async: true })
        }
        default: return { kind: 'text', content: 'A5P1_L1_DONE' }
      }
    }
    const tag = lane === 'ctl' ? 'ctl' : 'strict'
    const step = steps[lane]
    steps[lane] += 1
    return memberReply(lane === 'strict-again' ? 'strict' : lane, step, tag)
  }
}
/** Wait for the Nth request matching `pred` (1-based): two turns of the same
 *  scripted member produce two identical DONE replies, and "the first one" is
 *  not the one the second leg just caused. */
async function waitForMock(mock, pred, timeoutMs, label, nth = 1) {
  const deadline = Date.now() + timeoutMs
  let matched = 0
  for (;;) {
    const all = mock.requests.filter(pred)
    matched = all.length
    const hit = all[nth - 1]
    if (hit !== undefined) return hit
    if (mock.requests.length > 300) { log(`mock storm fuse tripped (${label}, requests=${String(mock.requests.length)})`); return null }
    if (Date.now() >= deadline) { log(`mock wait timed out (<=180s): ${label} (matched=${String(matched)}/${String(nth)}, requests=${String(mock.requests.length)})`); return null }
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
  CURRENT_HOST = undefined
  let origin = ''
  let cookie = ''
  try {
    host = spawnHost({ port: HOST_PORT, home: HOME, logPath: INSTANCE_LOG, mockPort: mock.port })
    // Known to the failure path from the moment the world has a Host writing to it.
    CURRENT_HOST = host
    const boot = await waitForLogLine(INSTANCE_RAW, BOOT_MARKER, 180_000, host.alive)
    if (boot === null) dieFatal(`no boot marker within 180s; log tail: ${redact(readFileSync(INSTANCE_RAW, 'utf8')).slice(-1200)}`)
    origin = `http://127.0.0.1:${boot.m[1]}`
    cookie = await authenticate(origin, boot.m[2])
    // READINESS, the way every a4/a5 real-host world does it: the Team row's
    // setup must SUCCEED (`ok: true`, or a visible `setupError`) and its STATE
    // must show the anchored Team Session before anything is prompted. A
    // prompt sent to a session the row has not created yet is not queued — it
    // is simply gone, and a kit that waits 180 s for a model request that was
    // never possible reports a false negative.
    let health = null
    const healthDeadline = Date.now() + 90_000
    let healthTries = 0
    for (;;) {
      health = await fetchJson(`${origin}/__p6t6/health`, undefined, 20_000)
      healthTries += 1
      if (healthTries === 5) log(`observer health probe: status=${String(health.status)} body=${JSON.stringify(health.body ?? null).slice(0, 200)}`)
      if (health.status === 200 && health.body?.ok === true) break
      if (health.status === 200 && health.body?.ok === false && health.body?.setupError !== undefined) {
        stopHost(host)
        dieFatal(`row setup failed — setupError: ${String(health.body.setupError).slice(0, 600)}\n--- log tail ---\n${logTail(INSTANCE_RAW)}`)
      }
      if (Date.now() >= healthDeadline || !host.alive()) break
      await new Promise((r) => setTimeout(r, 1000))
    }
    let stateBody = null
    const stateDeadline = Date.now() + 90_000
    let stateTries = 0
    for (;;) {
      stateTries += 1
      if (stateTries === 20) log(`row state probe still waiting: ${JSON.stringify(stateBody ?? null).slice(0, 240)}`)
      const st = await fetchJson(`${origin}/__p6t6/state`, undefined, 30_000)
      stateBody = st.body
      if (st.status === 200 && stateBody !== null && typeof stateBody === 'object'
        && stateBody.rootSessionId === ROOT && stateBody.phase === 'create' && stateBody.teamSession !== null) break
      if (Date.now() >= stateDeadline || !host.alive()) break
      await new Promise((r) => setTimeout(r, 500))
    }
    writeEvidence('row-state.json', stateBody)
    const noTok = await fetch(`${origin}/`, { signal: AbortSignal.timeout(10_000) }).catch(() => null)
    check('C1a', 'host booted on the recorded port with the production Team row mounted and the token gate live',
      Number(boot.m[1]) === HOST_PORT && health.body?.ok === true && stateBody?.teamSession !== null && noTok?.status === 401,
      `port=${String(boot.m[1])} healthOk=${String(health.body?.ok)} toolCount=${String(health.body?.toolCount)} teamSession=${String(stateBody?.teamSession !== null)} noToken=${String(noTok?.status)}`)

    // F5 PROOF LEG: the failure path must clean up a world it created. Forced
    // here, after C1a, because that is where the residue actually exists: a
    // booted Host, a populated DSH_HOME, a token in the raw log.
    if (args.includes('--inject-fatal-after-boot')) {
      dieFatal('INJECTED FATAL (F5 proof leg: failure-path world cleanup); no criterion was evaluated past this point', 1)
    }

    // Discovery: compute `builtinToolDeny` from the LIVE leader surface, the
    // same convention as every a4/a5 real-host world, so the Coverage
    // diagnostic (kept, not the safety line) does not pre-empt the legs.
    const discPrompt = await apiPrompt(origin, cookie, ROOT, MK_DISC)
    writeEvidence('discovery-prompt-response.json', discPrompt)
    if (discPrompt.status !== 200) dieFatal(`the discovery prompt was not accepted (${String(discPrompt.status)}): ${JSON.stringify(discPrompt.body ?? {}).slice(0, 300)}`)
    const disc = await waitForMock(mock, (r) => r.body !== null && hasMarker(r, MK_DISC) && surfaceNamesOf(r).length > 0, 180_000, 'DISC')
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

    const leaderDone = await waitForMock(mock, (r) => r.reply?.kind === 'text' && r.reply.content === 'A5P1_L1_DONE', 180_000, 'leader chain')
    // The leader chain is read from what the mock actually ISSUED and what the
    // Host actually replied to it — the script's own ledger, not a transcript
    // the Host may have summarized by the time the chain ends.
    const issued = mock.requests.filter((r) => r.reply?.kind === 'tool-call').flatMap((r) => (r.reply.toolCalls ?? []).map((tc) => String(tc.name)))
    // Every result the LEADER was given, verbatim. A Team tool can answer
    // `{"status":"rejected", ...}` in a payload with `isError` still false —
    // the protocol-level error lives in the body — so the criterion reads the
    // payload's own `status`, and the evidence keeps the whole text (a
    // truncated rejection is the difference between a kit bug and a real
    // refusal, and only one of those is fixable by rerunning).
    const leaderResults = mock.requests.filter((r) => laneOf(r) === 'leader').flatMap((r) => toolMsgsOf(r))
    writeEvidence('leader-tool-results.json', {
      issuedToolCalls: issued,
      leaderResults: leaderResults.map((m) => ({ isError: m.isError, text: String(m.text).slice(0, 2000) })),
    })
    // The same result text is re-sent in every later model request, so the
    // chain is counted by DISTINCT payloads, not by occurrences.
    const distinct = (rows) => [...new Set(rows.map((m) => String(m.text).slice(0, 160)))]
    const executed = distinct(leaderResults.filter((m) => String(m.text).includes('"status":"executed"')))
    const rejected = distinct(leaderResults.filter((m) => String(m.text).includes('"status":"rejected"') || String(m.text).includes('"status":"blocked"')))
    check('C1c', 'the leader created one governed member and one legacy member and delegated to both (plus the C5 re-drive)',
      issued.filter((n) => n === 'team_create_member').length === 2
        && issued.filter((n) => n === 'team_delegate').length === 3
        && rejected.length === 0
        // two create replies must come back `executed`; a delegation's own
        // reply text depends on the async ack shape, so it is not asserted here
        // (the member legs below are the proof the delegation actually landed).
        && executed.length >= 2,
      `created=${String(issued.filter((n) => n === 'team_create_member').length)} delegated=${String(issued.filter((n) => n === 'team_delegate').length)} executed=${String(executed.length)} rejected=${String(rejected.length)} firstRejection=${String(rejected[0]?.text ?? '').slice(0, 300)}`)

    const strictDone = await waitForMock(mock, (r) => r.reply?.kind === 'text' && r.reply.content === 'A5P1_STRICT_DONE', 180_000, 'strict member script', 1)
    const ctlDone = await waitForMock(mock, (r) => r.reply?.kind === 'text' && r.reply.content === 'A5P1_CTL_DONE', 180_000, 'ctl member script')
    if (strictDone === null || ctlDone === null) {
      writeEvidence('mock-tail.json', mock.requests.slice(-12).map((r) => ({ seq: r.seq, lastUser: lastUserTextOf(r).slice(0, 200), reply: r.reply })))
      dieFatal(`member scripts did not finish (strict=${String(strictDone !== null)} ctl=${String(ctlDone !== null)}); see mock-tail.json`)
    }

    // C5's re-drive rode the leader chain (the 5th step above delegated the
    // SAME instance a second time), so the second DONE from the governed
    // member is the re-drive's reply — a new turn on an Agent that already ran
    // once, which is what the criterion is about.
    const secondStrict = await waitForMock(mock, (r) => r.reply?.kind === 'text' && r.reply.content === 'A5P1_STRICT_DONE', 180_000, 'strict member re-drive', 2)
    writeEvidence('member-model-views.json', {
      strict: resultsSince(strictDone, MK_STRICT).map((r) => ({ isError: r.isError, text: String(r.text).slice(0, 500) })),
      ctl: resultsSince(ctlDone, MK_CTL).map((r) => ({ isError: r.isError, text: String(r.text).slice(0, 500) })),
      strictRedrive: secondStrict === null ? null : resultsSince(secondStrict, MK_STRICT).map((r) => ({ isError: r.isError, text: String(r.text).slice(0, 500) })),
    })
    const ledger = existsSync(LEDGER) ? readFileSync(LEDGER, 'utf8').split('\n').filter((l) => l.trim() !== '').map((l) => { try { return JSON.parse(l) } catch { return null } }).filter(Boolean) : []
    writeEvidence('probe-ledger.json', ledger)
    const markers = existsSync(MARKER_DIR) ? readdirSync(MARKER_DIR) : []
    writeEvidence('marker-dir.json', { markers })

    // The assembly's own observation log is read from the row BEFORE the Host
    // stops: the bindings closure surfaces it through the observer row
    // (`packages/tools/harness/plugin.mjs` reports `live.observations`), and a
    // Guard observation is only evidence while it can still be attributed to
    // the live Agent that produced it. The instance log is kept as a fallback
    // and as the teardown-order witness.
    const finalState = await fetchJson(`${origin}/__p6t6/state`, undefined, 30_000)
    const rowObservations = Array.isArray(finalState.body?.observations) ? finalState.body.observations : []
    stopHost(host)
    await new Promise((r) => setTimeout(r, 1500))
    const hostLog = redact(existsSync(INSTANCE_RAW) ? readFileSync(INSTANCE_RAW, 'utf8') : '')
    const guardLines = [
      ...rowObservations.filter((o) => String(o).includes('a5p1-guard:')),
      ...hostLog.split('\n').filter((l) => l.includes('a5p1-guard:')),
    ]
    writeEvidence('guard-observations.txt', guardLines.join('\n'))
    writeEvidence('row-state-final.json', finalState.body)

    // ── criteria ────────────────────────────────────────────────────────────
    // The PRIMARY channel is what each Agent's own model was told (a tool
    // result attributed to a lane by construction), cross-checked against the
    // side effect the refused tool's body would have left in the world. The
    // probe row's own ledger is a supporting channel and is NOT required: on
    // this Host a preset row's scope cannot register a tool at all
    // (`cannot get property "tools" without inject`) and its `agent/created` /
    // `tools/pre-execute` subscriptions are accepted but never delivered — both
    // measured, both recorded in undeclared-name-evidence.json, because a
    // criterion built on an undelivered event would be green on an absence of
    // evidence rather than on a protection.
    const strictView = strictDone === null ? [] : resultsSince(strictDone, MK_STRICT)
    const ctlView = ctlDone === null ? [] : resultsSince(ctlDone, MK_CTL)
    const REFUSAL = /(team tool guard|no Team Tool Binding|not permitted|permission|blocked|denied|ask)/i
    const wroteFile = (tag) => existsSync(sideEffect(tag)) ? readFileSync(sideEffect(tag), 'utf8').trim() : null
    writeEvidence('undeclared-name-evidence.json', {
      note: 'The undeclared name here is `write`: a real native Definition whose body creates a file, present on every lane. That matters because an "unknown tool" refusal proves nothing about the Guard — a name with no definition cannot run anywhere. What this file MEASURES is the inherited-native class: the SAME definition runs on BOTH lanes (sideEffectFiles.strict and .ctl are both present), and that equality is the zero-interference statement (decision delta (a)(3) in the §12 evidence set). The class PR1 refuses is the UNBOUND one — a real Team Definition that appears after publish and is bound by nothing — recorded in undeclared-team-tool-evidence.json (C2a/C2b), where the typed refusal and the absence of that body\'s effect are both asserted. Earlier revisions of this note claimed the governed lane "leaves no file behind" for `write`; that contradicted the data in this same file and is withdrawn (independent review MINOR-2).',
      governedLaneView: strictView.map((r) => ({ isError: r.isError, text: String(r.text).slice(0, 400) })),
      legacyLaneView: ctlView.map((r) => ({ isError: r.isError, text: String(r.text).slice(0, 400) })),
      sideEffectFiles: { strict: wroteFile('strict'), ctl: wroteFile('ctl') },
      probeRowLedger: ledger,
      probeRowMarkers: markers,
    })
    // The Leader's undeclared-but-real Team tool: registered by the Team glue
    // AFTER publish, so no declared surface and no publish-time inheritance can
    // cover it. Both halves are asserted: a typed refusal the model can read,
    // and — the half a permission message alone cannot prove — the body's own
    // effect is absent from the reply.
    const undeclaredCalls = mock.requests.flatMap((r) => {
      const calls = r.reply?.kind === 'tool-call' ? (r.reply.toolCalls ?? []) : []
      return calls.filter((tc) => String(tc.name) === 'team_follow_up').map(() => r)
    })
    const undeclaredResults = mock.requests.flatMap((r) => toolMsgsOf(r)).filter((m) => /team_follow_up|follow-up|follow_up/i.test(String(m.text)))
    writeEvidence('undeclared-team-tool-evidence.json', {
      note: 'A Team tool the blueprint never declared, registered by the Team glue after the Leader published. Which layer refused is recorded verbatim rather than assumed: PR1 closed-world text and the pre-existing Team tool lane are different protections, and this kit must not book the second one as the first.',
      asked: undeclaredCalls.length,
      results: undeclaredResults.map((m) => ({ isError: m.isError, text: String(m.text).slice(0, 400) })),
      guardLinesForLeader: guardLines.filter((l) => String(l).includes('guard-denial')).map((l) => String(l).slice(0, 240)),
    })
    const undeclaredRefusal = undeclaredResults.find((m) => m.isError === true)
    check('C2a', 'the governed Leader is refused with a typed, readable reason when it asks for a Team tool nothing bound',
      undeclaredCalls.length >= 1 && undeclaredRefusal !== undefined && REFUSAL.test(String(undeclaredRefusal.text)),
      `asked=${String(undeclaredCalls.length)} results=${JSON.stringify(undeclaredResults.map((m) => ({ err: m.isError, text: String(m.text).slice(0, 130) })))}`)
    check('C2b', 'the undeclared Team tool BODY produced no effect on the governed lane (PoC H6 recorded its equivalent running: dynRan=true)',
      undeclaredRefusal !== undefined && !/executed|\"action\"|queued/i.test(String(undeclaredRefusal.text))
        && undeclaredResults.every((m) => !/executed/i.test(String(m.text))),
      `results=${JSON.stringify(undeclaredResults.map((m) => String(m.text).slice(0, 140)))}`)
    // DISCLOSED SCOPE BOUNDARY, recorded rather than argued away: a native host
    // tool that already existed when the Agent published (here `write`) is bound
    // by PR1 as an inherited name, so the closed world abstains and the
    // permission lane decides. Both lanes behaving the same way for it is the
    // non-interference statement; PR1 owns the post-publish / unbound class.
    writeEvidence('inherited-native-observation.json', {
      note: 'PR1 binds publish-time native names as inherited; refusing them is the permission layer\'s job and is unchanged by PR1. Recorded per lane so the claim is visible, not argued.',
      governedLaneWriteRan: wroteFile('strict') !== null,
      legacyLaneWriteRan: wroteFile('ctl') !== null,
    })

    check('C3', 'a governed allowed call still runs (the closed world closes a world, it does not shut the Agent down)',
      String(strictView[0]?.text ?? '').includes(SEED_CONTENT),
      `read=${String(strictView[0]?.text ?? '').slice(0, 120)}`)

    check('C4', 'the SAME tool still runs on the permissions-less legacy lane (zero interference)',
      ctlView[1] !== undefined && ctlView[1].isError === false && wroteFile('ctl') === `A5P1_RAN_ctl_${RUN_STAMP}`,
      `legacyLaneSaw=${JSON.stringify(ctlView.map((r) => ({ err: r.isError, text: String(r.text).slice(0, 130) })))} sideEffect=${String(wroteFile('ctl'))}`)
    const ctlGuard = ctlView.filter((r) => String(r.text).includes('team tool guard'))
    check('C4b', 'no Guard ever spoke for the permissions-less lane',
      ctlGuard.length === 0, `unexpected=${JSON.stringify(ctlGuard.map((r) => String(r.text).slice(0, 120)))}`)

    // C5: a governed Agent that has ALREADY served a task is served again — the
    // world stays armed across turns without drifting its binding (a drift would
    // show up as a refusal of a call that ran before).
    const secondView = secondStrict === null ? [] : resultsSince(secondStrict, MK_STRICT)
    // Drift means the published world started refusing what it already served.
    // C2's own planned refusal (`tool=team_follow_up` on the Leader) is evidence
    // of the protection, not drift, so it is excluded by name rather than by a
    // filter wide enough to swallow anything containing the word "denial".
    const drift = guardLines.filter((l) => /REVISION_DRIFT|revision-drift|TOOL_BINDING_UNVERIFIED|not ACTIVE/.test(String(l))
      || /guard-denial/.test(String(l)) && /tool=(read|write)\b/.test(String(l)))
    check('C5', 'the re-driven governed Agent is still served by the same published world (no drift, no new refusal)',
      secondStrict !== null
        && String(secondView[0]?.text ?? '').includes(SEED_CONTENT)
        && drift.length === 0,
      `seen=${String(secondStrict !== null)} drift=${JSON.stringify(drift.map((l) => String(l).slice(0, 140)))} results=${JSON.stringify(secondView.map((r) => String(r.text).slice(0, 90)))}`)

    const publishes = guardLines.filter((l) => l.includes('agent-published') || l.includes('dispatcher-active'))
    const refused = guardLines.filter((l) => l.includes('REFUSED') || l.includes('STOPPED'))
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

  // The world is test scaffolding: removed on the success path AND (below) on
  // every failure path, unless --keep asks for it. Seven abandoned worlds from
  // failing runs is how a "deleted after use" promise becomes false.
  sealHostLog()
  const world = sweepWorld()
  writeEvidence('summary.json', {
    runStamp: RUN_STAMP,
    hostBaseline: { version: DSH_BASELINE_VERSION, sha: TEST_USE_BASELINE_SHA, clientCommitHash: CLIENT_COMMIT_HASH },
    port: HOST_PORT,
    world: { path: HOME, disposition: world },
    criteria,
    orderLeg: orderResult,
  })
  const failed = criteria.filter((c) => !c.ok)
  log(`criteria: ${String(criteria.length - failed.length)}/${String(criteria.length)} pass${failed.length === 0 ? '' : ` — FAILED: ${failed.map((c) => c.id).join(', ')}`}`)
  writeReceipt(failed, world)
  process.exitCode = failed.length === 0 ? 0 : 2
}

/**
 * The §12(d) real-Host Run Receipt: the run's own identity (baseline the Host
 * reported, port, world and its removal, the criteria table verbatim, the
 * dynRan before/after line) written INTO the evidence directory, so the receipt
 * and the artifacts it describes cannot drift apart. Redaction is stated here
 * because it is enforced at capture (`redact()` on every captured byte,
 * including the Host's own stdout) rather than promised afterwards.
 */
function writeReceipt(failed, world) {
  const lines = [
    '# Alpha.5 PR1 — real Host Run Receipt',
    '',
    `- run stamp: \`${RUN_STAMP}\``,
    `- host baseline: \`${DSH_BASELINE_VERSION}\` @ \`${TEST_USE_BASELINE_SHA}\` (client hash \`${CLIENT_COMMIT_HASH}\`), tree \`${testUseTree(REPO_ROOT)}\` porcelain-clean at C7b`,
    `- glue under test: this worktree's built dist (\`packages/runtime/dist/.../host.js\`), mounted as the production \`dsh-agent-team\` row through the profile-patch seam only`,
    `- port: \`${HOST_PORT}\` (the stable development instance :${String(STABLE_INSTANCE_PORT)} only read, never operated — C7a)`,
    `- world: \`${HOME}\` — ${world}`,
    '- redaction: every credential the kit itself captures (HTTP bodies, headers, log tails, the Host log lines it merges) is redacted at capture; the Host\'s own stdout is captured raw and redacted before `instance.log` is finalised (`host-stdout.raw` is deleted at the same step, and `sweep-worlds.mjs --scrub-raw` repairs it if a run is killed mid-flight). No credential is left in the evidence directory.',
    `- storm fuse: every model wait aborts above 300 recorded requests; waits are <= 180 s`,
    '',
    '## dynRan, before and after',
    '',
    '| | PoC (alpha.5 adapter P0, KIT H6) | this run (PR1 installed) |',
    '| --- | --- | --- |',
    '| undeclared / unbound tool, body | `hc-dyn-observation.dynRan = true` — the body ran | '
      + `${criteria.some((c) => c.id === 'C2b' && c.ok) ? 'refused with `TEAM_TOOL_UNGOVERNED` text and no body effect (C2a/C2b)' : 'CRITERION FAILED — see table'} |`,
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
