#!/usr/bin/env node
/**
 * boot.mjs — tests/mock team full-feature test deployment host
 * (docs/plans/active/TEAM_DTEST_WORKSPACE_PLAN.md, user-approved location
 * change 2026-09-07: D:\test -> <repo>/tests/mock).
 *
 * Same boot chain as the v2 Playwright acceptance (pw-boot.mjs):
 * DshInstance over the pristine upstream tree
 * references/deepseek-harness-test-use, public profile-patch seam,
 * production dist host row, p6t6 observability row, junction bridges —
 * plus TWO mini-MCP servers (repo harness, streamable-http, one `ping`
 * tool each):
 *   - #1 127.0.0.1:3491  -> the PLUGIN MCP FACET server
 *     (rowConfig.mcpServer {name: dtest-mini}; governance-gated,
 *     per-instance, fail-closed by default)
 *   - #2 127.0.0.1:3492  -> the HOST-LEVEL MCP row
 *     (@deepseek-ai/dsh-mcp-client, serverName dtesthttp; visible to
 *     every session, supervisor auto-reconnect)
 *
 * Dedicated fresh DSH_HOME: tests/mock/.dsh-home (profile tree copied
 * from the proven references/.dsh-test profile on first run; sessions/
 * storages/ created fresh by the host). .credentials.yaml is NOT
 * copied — the user configures the mock-test API key; the ref is read
 * into the spawn env only, never printed. Absent key = the host boots,
 * but model calls fail until configured.
 *
 * Usage: node boot.mjs
 *   MOCK_ROOT_SESSION_ID=<id>  restart the SAME root (bootPhase
 *     'create-or-open' resolves to 'resume' when the durable Team
 *     identity exists for the configured root; directive carries the
 *     boot/phase for record)
 *   MOCK_HARD_TOOLS=1          boot#3 scenario: inject
 *     externalPolicyFacts.hard.tools = {kind:'deny'}
 *   MOCK_BOOT_LABEL=<label>    hosts/<label> log dir (default boot1|resume)
 *   MOCK_DEAD_MCP_URL=1        T3.8a negative: point the dtest-mcp-http
 *     row at dead 127.0.0.1:3499/mcp (mini#2 not started) — expect a
 *     LOUD startup failure (failOnStartupError: true)
  *   MOCK_EXTERNAL_MINIS=1      T3.8b enablement: run the two mini-MCP
  *     endpoints as SEPARATE node processes (mini-standalone.mjs) so each
  *     can be killed/restarted independently while the 3181 host stays up
  *     (default = in-process listeners, unkillable independently)
  *   MOCK_DSH_HOME=<dir>        use an ALTERNATE home (scratch-home smoke
  *     runs; the campaign home tests/mock/.dsh-home stays untouched).
  *     Default: tests/mock/.dsh-home.
  *   MOCK_PRESEEDED_WORKSPACES=0  disable the D1 workspace-registry
  *     pre-seed (default ON; no-op when workspace.json already exists)
 *
 * Prints BOOT_URL=http://127.0.0.1:3181/?token=... + MOCKBOOT_READY once
 * healthy (D2: also persists state/cookie-header.txt + prints
 * PLAYWRIGHT_NAV for the ui-gate scripts); stays alive until SIGTERM/SIGINT,
 * then stops cleanly and verifies all three ports (3181/3491/3492) are
 * free. Kill->restart recipe (V2 plan D6): after killing a boot that left
 * sessions OPEN, the first restart may fail with "cannot prepare session
 * ... while it is live" (the new process revives the open session, then the
 * team prepare collides; the failing process retires it and appends
 * session/end-seed) — run wait-end-seed.mjs to confirm the retire, then
 * retry the boot once (round-1 boot#7 proven).
 */

import { spawn, spawnSync } from 'node:child_process'
import { copyFileSync, existsSync, lstatSync, mkdirSync, readFileSync, realpathSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { randomBytes, randomUUID } from 'node:crypto'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import net from 'node:net'

import { DshInstance, ensureProfile } from '../../characterization/lib/instance.mjs'
import { logTail, waitForPortFree } from '../../characterization/lib/util.mjs'
import { closeMiniServer, startMiniMcpServer } from '../../../packages/runtime/root-binding/harness/mini-mcp.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const MOCK_ROOT = resolve(HERE, '..')
const REPO_ROOT = resolve(HERE, '..', '..', '..')
const HOST_TREE = join(REPO_ROOT, 'references', 'deepseek-harness-test-use')
const SRC_HOME = join(REPO_ROOT, 'references', '.dsh-test')
const DSH_HOME = process.env.MOCK_DSH_HOME
  ? resolve(process.env.MOCK_DSH_HOME)
  : join(MOCK_ROOT, '.dsh-home')
const PORT = 3181
const FACET_PORT_CANDIDATES = [3491]
const HOST_MCP_PORT_CANDIDATES = [3492]
const FACET_SERVER_NAME = 'dtest-mini'
const HOST_MCP_SERVER_NAME = 'dtesthttp'
const BLUEPRINT_ID = 'dtest-bp'

const PRODUCTION_ROW_NAME = pathToFileURL(
  join(REPO_ROOT, 'packages', 'runtime', 'dist', 'packages', 'runtime', 'src', 'plugin', 'host.js'),
).href
const P6T6_ROW_NAME = pathToFileURL(join(REPO_ROOT, 'packages', 'tools', 'harness', 'plugin.mjs')).href
const CLIENT_ROW_NAME = pathToFileURL(join(REPO_ROOT, 'packages', 'client', 'composition-shim', 'index.js')).href
const GLUE_URL = pathToFileURL(
  join(REPO_ROOT, 'packages', 'runtime', 'dist', 'packages', 'runtime', 'src', 'plugin', 'live', 'agent-bindings.mjs'),
).href
const SEAM_URL = pathToFileURL(join(REPO_ROOT, 'packages', 'runtime', 'root-binding', 'harness', 'seam.mjs')).href

const NONCE = `dtest${Date.now().toString(36)}${randomBytes(2).toString('hex')}`
const ROOT_A = process.env.MOCK_ROOT_SESSION_ID ?? `session-${NONCE}`
const RESTART = process.env.MOCK_ROOT_SESSION_ID !== undefined
const HARD_TOOLS = process.env.MOCK_HARD_TOOLS === '1'
const DEAD_MCP_URL = process.env.MOCK_DEAD_MCP_URL === '1'
const DEAD_MCP_PORT = 3499 // never listening — the T3.8a dead endpoint
const BOOT_LABEL = process.env.MOCK_BOOT_LABEL ?? (RESTART ? 'resume' : 'boot1')
// MOCK_EXTERNAL_MINIS=1 — run the two mini-MCP endpoints as SEPARATE node
// processes (mini-standalone.mjs) instead of in-process listeners, so T3.8b
// can kill/restart each mini independently while the 3181 host stays up.
const EXTERNAL_MINIS = process.env.MOCK_EXTERNAL_MINIS === '1'
const MINI_STANDALONE = join(HERE, 'mini-standalone.mjs')

// The client commit hash must match the host tree's CURRENT HEAD (the tree
// may move between baselines — e.g. 2026-09-07: baseline 76fda729 ->
// stable@a66e4702, user-approved clean+rebuild). Read it live from git.
function clientCommitHash() {
  const res = spawnSync('git', ['-C', HOST_TREE, 'rev-parse', '--short=10', 'HEAD'], { encoding: 'utf8' })
  if (res.status === 0 && res.stdout.trim().length > 0) return res.stdout.trim()
  throw new Error(`cannot read host tree HEAD via git (status=${res.status} err=${String(res.stderr).slice(0, 200)})`)
}

const log = (line) => console.log(`[mock-boot ${new Date().toISOString()}] ${line}`)

// ── fresh DSH_HOME bootstrap (idempotent) ──────────────────────────────────

function bootstrapHome() {
  const dstProfiles = join(DSH_HOME, 'profiles')
  const profileMode = process.env.MOCK_PROFILE_MODE ?? 'copy'
  if (profileMode === 'fresh') {
    // Re-initialize the profile from the CURRENT host tree (e.g. after a
    // branch switch): let ensureProfile's throwaway boot build a fresh
    // node_modules link farm instead of reusing a stale copied one.
    if (existsSync(dstProfiles)) {
      log('MOCK_PROFILE_MODE=fresh — removing profile tree for re-initialization')
      rmSync(dstProfiles, { recursive: true, force: true })
    }
    log('profile will be created fresh by ensureProfile throwaway boot')
  } else if (existsSync(join(dstProfiles, 'web', 'package.json'))) {
    log('profile tree already present')
  } else {
    // Junction-preserving copy: the profile node_modules is a link farm of
    // absolute junctions into the host tree; fs.cpSync follows them and
    // stack-overflows (0xC0000409) on the transitive cycle.
    if (existsSync(dstProfiles)) {
      log('removing partial profile copy')
      rmSync(dstProfiles, { recursive: true, force: true })
    }
    log(`copying web profile tree ${SRC_HOME}\\profiles -> ${dstProfiles} (junction-preserving)`)
    const res = spawnSync(process.execPath, [join(HERE, 'copy-profile.mjs'), join(SRC_HOME, 'profiles'), dstProfiles], { stdio: 'inherit' })
    if (res.status !== 0) throw new Error(`profile copy failed (exit ${res.status})`)
    log('profile tree copied (proven v2 profile; sessions/storages stay fresh; foreign junctions point at the pinned host tree)')
  }
  if (profileMode !== 'copy' && profileMode !== 'fresh') throw new Error(`unknown MOCK_PROFILE_MODE ${profileMode}`)
  const dstSettings = join(DSH_HOME, 'settings.yaml')
  if (!existsSync(dstSettings)) {
    copyFileSync(join(SRC_HOME, 'settings.yaml'), dstSettings)
    log('settings.yaml copied (provider qiyuan-self; API key NOT configured yet — user will set it)')
  }
  for (const d of ['hosts', 'state', 'fixtures', 'work', 'evidence']) {
    mkdirSync(join(MOCK_ROOT, d), { recursive: true })
  }
}

// ── junction bridges (worktree node_modules only; host tree untouched) ────

const RUNTIME_LINKS = [
  ['@deepseek-ai', 'dsh-agent'],
  ['@deepseek-ai', 'dsh-llm'],
  ['@deepseek-ai', 'dsh-mcp-client'],
  ['@deepseek-ai', 'dsh-session'],
  ['@deepseek-ai', 'dsh-storage-domain'],
  [null, 'zod'],
]
const PACKAGES_LINKS = [
  ['@deepseek-ai', 'dsh-agent'],
  ['@deepseek-ai', 'dsh-llm'],
  ['@deepseek-ai', 'dsh-mcp-client'],
  ['@deepseek-ai', 'dsh-session'],
  ['@deepseek-ai', 'dsh-storage-domain'],
  ['@deepseek-ai', 'dsh-scope'],
  ['@deepseek-ai', 'dsh-system-prompt'],
]

function ensureJunctions(base, links, logTag) {
  const hoist = join(HOST_TREE, 'node_modules', '.pnpm', 'node_modules')
  mkdirSync(base, { recursive: true })
  for (const [scope, name] of links) {
    const label = scope ? `${scope}/${name}` : name
    const target = scope ? join(hoist, scope, name) : join(hoist, name)
    if (!existsSync(target)) {
      throw new Error(`host tree pnpm hoist has no entry for ${label} at ${target}`)
    }
    const scopeDir = scope ? join(base, scope) : base
    mkdirSync(scopeDir, { recursive: true })
    const link = join(scopeDir, name)
    let st = null
    try {
      st = lstatSync(link)
    } catch { /* absent */ }
    if (st !== null) {
      let ok = false
      try { ok = st.isSymbolicLink() && realpathSync(link) === realpathSync(target) } catch { ok = false }
      if (!ok) rmSync(link, { force: true, recursive: true })
      else continue
    }
    symlinkSync(target, link, 'junction')
    log(`${logTag} link: ${label} -> ${target}`)
  }
}

// ── profile-patch YAML (the public seam; same dialect as pw-boot.mjs) ─────

function yamlScalar(v) {
  if (v === null) return 'null'
  if (typeof v === 'string') return JSON.stringify(v)
  return String(v)
}
function yamlValueLines(value, indent) {
  if (Array.isArray(value)) {
    return value.flatMap((item) => yamlEmitItem(item, indent))
  }
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
  if (item === null || typeof item !== 'object') {
    return [`${pad}- ${yamlScalar(item)}`]
  }
  if (Array.isArray(item)) {
    if (item.length === 0) return [`${pad}- []`]
    return [`${pad}-`, ...yamlValueLines(item, indent + 1)]
  }
  const entries = Object.entries(item)
  const [firstKey, firstValue] = entries[0]
  const firstLines = yamlEmit(firstKey, firstValue, indent + 1)
  const rest = entries.slice(1).flatMap(([k, v]) => yamlEmit(k, v, indent + 1))
  return [`${pad}- ${firstLines[0].slice((indent + 1) * 2)}`, ...firstLines.slice(1), ...rest]
}

const BLUEPRINT_DOC = [
  '---',
  'schemaVersion: 1',
  `blueprintId: ${BLUEPRINT_ID}`,
  'revision: "1"',
  'leader:',
  '  templateId: leader',
  '  persona: "You are the leader of a small engineering team. You coordinate members through the team_* tools and report concrete results back to the user. Always include exact file contents or command outputs when a member collects them."',
  'members:',
  '  - templateId: worker',
  '    displayName: "DTest Worker"',
  '    persona: "You are a precise worker. You read files, run shell commands, and report exactly what you observe, without embellishment."',
  '  - templateId: collector',
  '    displayName: "DTest Collector"',
  '    persona: "You are a collector. You gather data with the available tools and quote raw tool output verbatim in your reports."',
  'requirements:',
  '  - domain: persona',
  '    name: standard',
  '  - domain: mcp',
  `    name: ${FACET_SERVER_NAME}`,
  'teamEnvelope:',
  '  allow:',
  '    - assign-task',
  '    - create-member',
  '    - send-message',
  '    - report-progress',
  '    - archive-member',
  '    - restore-member',
  '    - request-control',
  '    - resolve-control',
  '  deny:',
  '    - delete-team',
  'memberEnvelopes:',
  '  - templateId: worker',
  '    envelope:',
  '      allow:',
  '        - send-message',
  '        - report-progress',
  '        - request-control',
  '        - resolve-control',
  '      deny: []',
  '  - templateId: collector',
  '    envelope:',
  '      allow:',
  '        - send-message',
  '        - report-progress',
  '        - request-control',
  '        - resolve-control',
  '      deny: []',
  'policyStates:',
  '  - id: default',
  '    description: "The dtest default state."',
  'quotas:',
  '  team:',
  '    maxInstances: 12',
  '    maxConcurrent: 12',
  '  members:',
  '    maxInstances: 4',
  '    maxConcurrent: 4',
  'metadata: {}',
  '---',
].join('\n')

// The mini servers are started in main() before the patch is written; the
// row config reads their bound ports.
let miniFacet = null
let miniHost = null

function rowConfig(bootPhase) {
  return {
    rootSessionId: ROOT_A,
    bootPhase,
    blueprintSource: BLUEPRINT_DOC,
    seedMembers: [],
    defaultWorkspace: MOCK_ROOT,
    generation: 1,
    // THE REAL MODEL (no mock overrides): the provider exists in
    // DSH_HOME/settings.yaml; the key is read from DSH_HOME/.credentials.yaml
    // into the spawn env (never printed) once the user configures it.
    staticModel: { provider: 'qiyuan-self', model: 'qwen3.8-27b' },
    deniedSelection: { provider: 'dtest-denied', model: 'dtest-denied' },
    mcpServer: { name: FACET_SERVER_NAME, port: miniFacet.port },
    environmentFacts: [
      { domain: 'tool', subject: 'web', available: true, generation: 1 },
      { domain: 'skill', subject: 'base', available: true, generation: 1 },
      { domain: 'persona', subject: 'standard', available: true, generation: 1 },
      { domain: 'mcpServer', subject: FACET_SERVER_NAME, available: true, generation: 1 },
    ],
    externalPolicyFacts: HARD_TOOLS
      ? { hard: { tools: { kind: 'deny' } }, capabilityExists: {} }
      : { hard: {}, capabilityExists: {} },
    glueUrl: GLUE_URL,
    seamUrl: SEAM_URL,
  }
}

function writeTeamPatchFile(patchPath, bootPhase) {
  const lines = [
    '# DTest (tests/mock) full-feature test mount: production dsh-agent-team row + client + p6t6 observability + host-level MCP row, mounted ONLY through this public profile-patch seam.',
    '- insert:',
    ...yamlEmitItem({
      id: 'dsh-agent-team',
      name: PRODUCTION_ROW_NAME,
      config: rowConfig(bootPhase),
    }, 2),
    ...yamlEmitItem({
      id: 'dsh-agent-team-client',
      name: CLIENT_ROW_NAME,
    }, 2),
    ...yamlEmitItem({
      id: 'p6t6-team-tools',
      name: P6T6_ROW_NAME,
    }, 2),
    ...yamlEmitItem({
      id: 'dtest-mcp-http',
      name: '@deepseek-ai/dsh-mcp-client',
      config: {
        serverName: HOST_MCP_SERVER_NAME,
        transport: 'streamable-http',
        url: DEAD_MCP_URL ? `http://127.0.0.1:${DEAD_MCP_PORT}/mcp` : `http://127.0.0.1:${miniHost.port}/mcp`,
        headers: {},
        toolCallTimeoutMs: 15000,
        failOnStartupError: true,
      },
    }, 2),
    '',
  ]
  writeFileSync(patchPath, lines.join('\n'))
}

// ── boot ───────────────────────────────────────────────────────────────────

function portBusy(port) {
  return new Promise((resolvePromise) => {
    const s = net.connect(port, '127.0.0.1')
    s.on('connect', () => { s.destroy(); resolvePromise(true) })
    s.on('error', () => resolvePromise(false))
    s.setTimeout(1500, () => { s.destroy(); resolvePromise(false) })
  })
}

// Wait until a port accepts connections (external mini readiness).
async function waitForPortListen(port, timeoutMs = 15_000) {
  const deadline = Date.now() + timeoutMs
  for (;;) {
    if (await portBusy(port)) return true
    if (Date.now() > deadline) throw new Error(`port ${port} not listening after ${timeoutMs}ms`)
    await new Promise((r) => setTimeout(r, 250))
  }
}

// Start one external mini as its own node process (T3.8b killable).
function startExternalMini(port) {
  const child = spawn(process.execPath, [MINI_STANDALONE, String(port)], {
    stdio: ['ignore', 'pipe', 'inherit'],
  })
  let readyBuf = ''
  child.stdout.on('data', (d) => {
    readyBuf += d.toString('utf8')
    const i = readyBuf.indexOf('\n')
    if (i >= 0) log(`mini-standalone: ${readyBuf.slice(0, i).trim()}`)
  })
  child.on('exit', (code) => log(`mini-standalone port ${port} exited (code=${code})`))
  return { port, child }
}

async function fetchJson(url, timeoutMs) {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) })
    const text = await res.text()
    let body = null
    try { body = text === '' ? null : JSON.parse(text) } catch { body = { nonJsonBody: text.slice(0, 400) } }
    return { status: res.status, body }
  } catch (error) {
    return { status: null, body: { error: String(error) } }
  }
}

async function main() {
  if (await portBusy(PORT)) {
    console.error(`MOCKBOOT_FAIL port ${PORT} busy — aborting`)
    process.exit(2)
  }

  bootstrapHome()

  // ── D1: workspace-registry pre-seed (V2 plan §1 D1) ──────────────────────
  // FRESH homes only: when storages/workspace.json is ABSENT, seed it with
  // the mock workspace row + the directive root session, so the UI session
  // tree shows the root from the first boot (removes the round-1 T1.2
  // manual bootstrap detour). Existing home: no-op — the live registry is
  // never touched by a script.
  if (process.env.MOCK_PRESEEDED_WORKSPACES !== '0') {
    const wsPath = join(DSH_HOME, 'storages', 'workspace.json')
    if (!existsSync(wsPath)) {
      mkdirSync(join(DSH_HOME, 'storages'), { recursive: true })
      const wsId = randomUUID()
      const now = new Date().toISOString()
      writeFileSync(wsPath, JSON.stringify({
        unit: { name: 'workspace', version: 2 },
        global: { initialized: true, workspaceIds: [wsId], archivedSessionIds: [] },
        tables: { workspaces: { [wsId]: { path: MOCK_ROOT, title: 'mock', sessionIds: [ROOT_A], createdAt: now, updatedAt: now } } },
      }, null, 2))
      log(`D1: workspace registry pre-seeded (workspace=${wsId.slice(0, 8)}… path=${MOCK_ROOT} sessionIds=[${ROOT_A}])`)
    } else {
      log('D1: workspace registry already present — no-op (existing home)')
    }
  }

  const instLogDir = join(MOCK_ROOT, 'hosts', BOOT_LABEL)
  mkdirSync(instLogDir, { recursive: true })

  // Mini-MCP servers BEFORE the host: the host-level MCP row connects at
  // profile load; the facet server is the rowConfig.mcpServer endpoint.
  if (EXTERNAL_MINIS) {
    miniFacet = startExternalMini(FACET_PORT_CANDIDATES[0])
    await waitForPortListen(FACET_PORT_CANDIDATES[0])
    log(`facet mini-MCP up on 127.0.0.1:${miniFacet.port} (serverName ${FACET_SERVER_NAME}, tool ping) [EXTERNAL pid=${miniFacet.child.pid}]`)
    if (DEAD_MCP_URL) {
      log(`T3.8a: MOCK_DEAD_MCP_URL=1 — dtest-mcp-http row points at dead 127.0.0.1:${DEAD_MCP_PORT}/mcp (mini#2 NOT started); loud failure expected`)
    } else {
      miniHost = startExternalMini(HOST_MCP_PORT_CANDIDATES[0])
      await waitForPortListen(HOST_MCP_PORT_CANDIDATES[0])
      log(`host mini-MCP up on 127.0.0.1:${miniHost.port} (serverName ${HOST_MCP_SERVER_NAME}, tool ping) [EXTERNAL pid=${miniHost.child.pid}]`)
    }
  } else {
    miniFacet = await startMiniMcpServer(FACET_PORT_CANDIDATES)
    if (miniFacet.port !== FACET_PORT_CANDIDATES[0]) throw new Error(`facet mini-MCP landed on ${miniFacet.port}, expected ${FACET_PORT_CANDIDATES[0]}`)
    log(`facet mini-MCP up on 127.0.0.1:${miniFacet.port} (serverName ${FACET_SERVER_NAME}, tool ping)`)
    if (DEAD_MCP_URL) {
      log(`T3.8a: MOCK_DEAD_MCP_URL=1 — dtest-mcp-http row points at dead 127.0.0.1:${DEAD_MCP_PORT}/mcp (mini#2 NOT started); loud failure expected`)
    } else {
      miniHost = await startMiniMcpServer(HOST_MCP_PORT_CANDIDATES)
      if (miniHost.port !== HOST_MCP_PORT_CANDIDATES[0]) throw new Error(`host mini-MCP landed on ${miniHost.port}, expected ${HOST_MCP_PORT_CANDIDATES[0]}`)
      log(`host mini-MCP up on 127.0.0.1:${miniHost.port} (serverName ${HOST_MCP_SERVER_NAME}, tool ping)`)
    }
  }

  const instance = new DshInstance({
    hostTree: HOST_TREE,
    dshHome: DSH_HOME,
    port: PORT,
    clientCommitHash: clientCommitHash(),
    logDir: instLogDir,
  })
  const profile = await ensureProfile({ instance, log, timeoutMs: 120_000 })
  log(`profile ${profile.created ? 'created via throwaway boot' : 'already initialized'}`)
  writeTeamPatchFile(instance.patchFile, 'create-or-open')
  log(`patch layer written to ${instance.patchFile}`)

  const directive = {
    boot: RESTART ? 2 : 1,
    phase: RESTART ? 'resume' : 'create',
    reportDir: join(MOCK_ROOT, 'evidence'),
    runStamp: RESTART ? `restart-${NONCE}` : NONCE,
    rootSessionId: ROOT_A,
    mcpPort: miniFacet.port,
    hardTools: HARD_TOOLS,
  }
  writeFileSync(join(DSH_HOME, 'p6t6-directive.json'), JSON.stringify(directive, null, 2))
  log(`directive written (boot=${directive.boot} phase=${directive.phase} root=${ROOT_A} hardTools=${HARD_TOOLS})`)

  ensureJunctions(join(REPO_ROOT, 'packages', 'runtime', 'node_modules'), RUNTIME_LINKS, 'runtime')
  ensureJunctions(join(REPO_ROOT, 'packages', 'node_modules'), PACKAGES_LINKS, 'packages')

  // The model key: read the ref from DSH_HOME/.credentials.yaml into the
  // spawn env only (never logged). Absent = boot without a key.
  const credsPath = join(DSH_HOME, '.credentials.yaml')
  let keyConfigured = false
  if (existsSync(credsPath)) {
    const credsText = readFileSync(credsPath, 'utf8')
    const m = credsText.match(/QIYUAN_SELF_API_KEY:\s*(\S+)/)
    if (m === null) {
      log('WARN: .credentials.yaml present but no QIYUAN_SELF_API_KEY ref')
    } else {
      process.env.QIYUAN_SELF_API_KEY = m[1]
      keyConfigured = true
      log('model key loaded from .credentials.yaml (value never printed)')
    }
  } else {
    log('NO_API_KEY: DSH_HOME/.credentials.yaml absent — host boots WITHOUT a model key; model calls fail until the user configures one')
  }

  const started = await instance.start({ timeoutMs: 240_000 })
  const url = started.url
  const origin = `http://127.0.0.1:${PORT}`
  log(`booted at ${origin}`)

  const dump = await instance.dumpConfig({ timeoutMs: 60_000 })
  writeFileSync(join(instLogDir, 'dump-config.txt'), dump.text)
  const rows = {
    'dsh-agent-team': DshInstance.rowInDump(dump.text, { id: 'dsh-agent-team', name: PRODUCTION_ROW_NAME }),
    'dsh-agent-team-client': DshInstance.rowInDump(dump.text, { id: 'dsh-agent-team-client', name: CLIENT_ROW_NAME }),
    'p6t6-team-tools': DshInstance.rowInDump(dump.text, { id: 'p6t6-team-tools', name: P6T6_ROW_NAME }),
    'dtest-mcp-http': DshInstance.rowInDump(dump.text, { id: 'dtest-mcp-http', name: '@deepseek-ai/dsh-mcp-client' }),
  }
  log(`rows mounted: ${JSON.stringify(rows)}`)
  if (!rows['dsh-agent-team-client']) throw new Error('client row not in the composed profile dump — the Team UI would not mount in the browser')
  if (!rows['dtest-mcp-http']) throw new Error('host MCP row not in the composed profile dump — the host-level MCP tool would be absent')

  // Client-bundle serve probe (authenticated): the DEFINITIVE list of
  // client rows is the boot graph injected into the index page.
  const authRes = await fetch(`${origin}/?token=${url.slice(url.indexOf('token=') + 6).trim()}`, { redirect: 'manual', signal: AbortSignal.timeout(30_000) })
  const setCookie = authRes.headers.get('set-cookie')
  if (authRes.status !== 303 || setCookie === null) throw new Error(`dsh web authentication returned HTTP ${authRes.status} (expected 303 + set-cookie)`)
  const cookie = setCookie.split(';', 1)[0]
  const idxRes = await fetch(origin, { headers: { cookie }, signal: AbortSignal.timeout(30_000) })
  const idxText = await idxRes.text()
  const pluginUrls = [...new Set(idxText.match(/\/plugins\/[^"'\s\\]+/g) ?? [])]
  log(`boot graph /plugins/ URLs: ${JSON.stringify(pluginUrls)}`)
  const clientCandidates = pluginUrls.filter((u) => u.includes('dsh-agent-team'))
  if (clientCandidates.length === 0) throw new Error(`no dsh-agent-team client row in the composed boot graph — the Team UI would not mount (index status=${idxRes.status} bytes=${idxText.length})`)
  let served = null
  for (const u of clientCandidates) {
    const cb = await fetch(origin + u, { headers: { cookie }, signal: AbortSignal.timeout(30_000) })
    const cbText = await cb.text()
    log(`client bundle serve: ${u} status=${cb.status} bytes=${cbText.length}`)
    if (cb.status === 200 && cbText.length > 100_000) served = { url: u, bytes: cbText.length }
  }
  if (served === null) throw new Error(`client bundle not served from any boot-graph candidate ${JSON.stringify(clientCandidates)} — Team UI cannot load`)

  // Row health gate (plugin ready + ten tool registrations).
  const deadline = Date.now() + 300_000
  for (;;) {
    const hb = await fetchJson(`http://127.0.0.1:${PORT}/__p6t6/health`, 30_000)
    if (hb.status === 200 && hb.body?.ok === true && hb.body?.toolCount === 10) {
      log(`row ready — toolCount=${hb.body.toolCount} liveSessions=${JSON.stringify(hb.body.liveSessions)}`)
      break
    }
    if (hb.status === 200 && hb.body?.ok === false && hb.body?.setupError !== undefined) {
      throw new Error(`row setup failed — setupError: ${String(hb.body.setupError).slice(0, 800)}; log tail:\n${logTail(started.logPath, 30)}`)
    }
    if (Date.now() >= deadline) throw new Error(`row health not ready in 300s — health=${JSON.stringify(hb.body).slice(0, 600)}; log tail:\n${logTail(started.logPath, 30)}`)
    await new Promise((r) => setTimeout(r, 2000))
  }

  writeFileSync(join(MOCK_ROOT, 'state', 'boot-state.json'), JSON.stringify({
    rootSessionId: ROOT_A,
    nonce: NONCE,
    url,
    origin,
    logPath: started.logPath,
    model: { provider: 'qiyuan-self', model: 'qwen3.8-27b', keyConfigured },
    mcp: {
      facet: { serverName: FACET_SERVER_NAME, port: miniFacet.port },
      host: { serverName: HOST_MCP_SERVER_NAME, port: miniHost.port },
    },
    hardTools: HARD_TOOLS,
    blueprint: `${BLUEPRINT_ID}@1`,
    bootedAt: new Date().toISOString(),
  }, null, 2))
  console.log(`BOOT_URL=${url}`)
  console.log(`MOCKBOOT_READY host up at ${origin} (keyConfigured=${keyConfigured}); keep-alive until killed`)

  // ── D2: cookie automation (V2 plan §1 D2) ────────────────────────────────
  // Persist the session cookie for the suite scripts (suite-*,
  // preflight-check, ui-gate read state/cookie-header.txt) and print the
  // playwright navigation command — the round-1 manual 4-step chain
  // (open/goto/click root/click team tab) collapses to one documented
  // command. Cookie value itself is never printed.
  writeFileSync(join(MOCK_ROOT, 'state', 'cookie-header.txt'), cookie)
  log('D2: cookie persisted to state/cookie-header.txt (value never printed)')
  console.log('COOKIED=1')
  console.log(`PLAYWRIGHT_NAV: playwright-cli -s=mocktest goto ${url}`)

  let stopping = false
  const stopMini = async (m) => {
    if (!m) return
    if (m.child) { m.child.kill(); return }
    await closeMiniServer(m)
  }
  const stopAll = async (signal) => {
    if (stopping) return
    stopping = true
    log(`received ${signal} — stopping host`)
    await stopMini(miniFacet)
    await stopMini(miniHost)
    try {
      const res = await instance.stop({ timeoutMs: 20_000 })
      log(`stopped (killed=${res.killed} portFree=${res.portFree})`)
    } catch (error) {
      log(`stop error: ${error.message}`)
    }
    const freeWeb = await waitForPortFree(PORT, 10_000)
    const freeFacet = await waitForPortFree(miniFacet.port, 5_000)
    const freeHost = miniHost === null ? true : await waitForPortFree(miniHost.port, 5_000)
    console.log(`MOCKBOOT_STOPPED portFree=${freeWeb} facetPortFree=${freeFacet} hostMcpPortFree=${freeHost}`)
    process.exit(freeWeb && freeFacet && freeHost ? 0 : 1)
  }
  process.on('SIGTERM', () => void stopAll('SIGTERM'))
  process.on('SIGINT', () => void stopAll('SIGINT'))
  setInterval(() => {}, 1 << 30) // keep-alive
}

main().catch((error) => {
  // Best-effort mini teardown on boot failure.
  const stopMini = (m) => {
    if (!m) return Promise.resolve()
    if (m.child) { m.child.kill(); return Promise.resolve() }
    return closeMiniServer(m)
  }
  void Promise.allSettled([
    stopMini(miniFacet),
    stopMini(miniHost),
  ]).then(() => {
    console.error(`MOCKBOOT_FAIL ${error.message}`)
    process.exit(1)
  })
})
