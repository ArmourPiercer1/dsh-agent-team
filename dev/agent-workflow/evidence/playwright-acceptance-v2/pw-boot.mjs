#!/usr/bin/env node
/**
 * pw-boot.mjs — persistent real-model test host for the Playwright
 * browser acceptance of the Team D1-D6 repair v2 (user-directed run,
 * 2026-09-07).
 *
 * Same boot chain as packages/tools/harness/d4-restart-reopen.mjs
 * (DshInstance, public profile-patch seam, production dist host row,
 * p6t6-team-tools observability row, junction bridges) with ONE
 * deliberate difference: NO mock-model env overrides — the team row's
 * staticModel is the REAL provider configured in the shared test home
 * (settings.yaml: qiyuan-self/qwen3.8-27b; the API key is read from
 * DSH_HOME/.credentials.yaml refs into the spawn env, never printed),
 * so every model call goes through the real dsh-llm adapter + SSE +
 * agent loop against the user's self-hosted endpoint.
 *
 * Usage: node pw-boot.mjs
 * Prints BOOT_URL=http://127.0.0.1:3180/?token=... once healthy;
 * stays alive (keep-alive) until SIGTERM/SIGINT, then stops the
 * instance cleanly and verifies the port is free.
 */

import { existsSync, lstatSync, mkdirSync, readFileSync, realpathSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { randomBytes } from 'node:crypto'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import net from 'node:net'

import { DshInstance, ensureProfile } from '../../../../tests/characterization/lib/instance.mjs'
import { logTail, waitForPortFree } from '../../../../tests/characterization/lib/util.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const WORKTREE_ROOT = resolve(HERE, '..', '..', '..', '..')

function findRepoRoot(start) {
  let dir = start
  for (;;) {
    if (existsSync(join(dir, 'references', 'deepseek-harness-test-use'))) return dir
    const parent = dirname(dir)
    if (parent === dir) throw new Error(`no ancestor of ${start} contains references/deepseek-harness-test-use`)
    dir = parent
  }
}

const REPO_ROOT = findRepoRoot(WORKTREE_ROOT)
const HOST_TREE = join(REPO_ROOT, 'references', 'deepseek-harness-test-use')
const DSH_HOME = join(REPO_ROOT, 'references', '.dsh-test')
const PORT = 3180
const CLIENT_COMMIT_HASH = '76fda72979'
const REPORT_DIR = HERE

const PRODUCTION_ROW_NAME = pathToFileURL(
  join(WORKTREE_ROOT, 'packages', 'runtime', 'dist', 'packages', 'runtime', 'src', 'plugin', 'host.js'),
).href
const P6T6_ROW_NAME = pathToFileURL(join(WORKTREE_ROOT, 'packages', 'tools', 'harness', 'plugin.mjs')).href
const CLIENT_ROW_NAME = pathToFileURL(join(WORKTREE_ROOT, 'packages', 'client', 'composition-shim', 'index.js')).href
const GLUE_URL = pathToFileURL(
  join(WORKTREE_ROOT, 'packages', 'runtime', 'dist', 'packages', 'runtime', 'src', 'plugin', 'live', 'agent-bindings.mjs'),
).href
const SEAM_URL = pathToFileURL(
  join(WORKTREE_ROOT, 'packages', 'runtime', 'root-binding', 'harness', 'seam.mjs'),
).href

const WORKSPACE = REPO_ROOT
const NONCE = `pw${Date.now().toString(36)}${randomBytes(2).toString('hex')}`
// D6 restart step: re-run with PW2_ROOT_SESSION_ID=<existing root> to
// restart the SAME root (row bootPhase stays 'create-or-open', which the
// host resolves to 'resume' when the durable Team identity exists for the
// configured root; the directive carries boot=2/phase=resume for record).
const ROOT_A = process.env.PW2_ROOT_SESSION_ID ?? `session-pw2-${NONCE}`
const RESTART = process.env.PW2_ROOT_SESSION_ID !== undefined
const BLUEPRINT_ID = 'pw2-bp'

const log = (line) => console.log(`[pw-boot ${new Date().toISOString()}] ${line}`)

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

// ── profile-patch YAML (the public seam; same dialect as the D4 runner) ────

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
  '    displayName: "PW2 Worker"',
  '    persona: "You are a precise worker. You read files, run shell commands, and report exactly what you observe, without embellishment."',
  'requirements:',
  '  - domain: persona',
  '    name: standard',
  'teamEnvelope:',
  '  allow:',
  '    - assign-task',
  '    - create-member',
  '    - send-message',
  '    - report-progress',
  '    - archive-member',
  '    - restore-member',
  '  deny:',
  '    - delete-team',
  'memberEnvelopes:',
  '  - templateId: worker',
  '    envelope:',
  '      allow:',
  '        - send-message',
  '        - report-progress',
  '      deny: []',
  'policyStates:',
  '  - id: default',
  '    description: "The pw2 default state."',
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

function rowConfig(bootPhase) {
  return {
    rootSessionId: ROOT_A,
    bootPhase,
    blueprintSource: BLUEPRINT_DOC,
    seedMembers: [],
    defaultWorkspace: WORKSPACE,
    generation: 1,
    // THE REAL MODEL (no mock overrides): the provider exists in
    // DSH_HOME/settings.yaml and its key in DSH_HOME/.credentials.yaml.
    staticModel: { provider: 'qiyuan-self', model: 'qwen3.8-27b' },
    deniedSelection: { provider: 'pw2-denied', model: 'pw2-denied' },
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

function writeTeamPatchFile(patchPath, bootPhase) {
  const lines = [
    '# PW2 Playwright acceptance mount: production dsh-agent-team row + p6t6-team-tools observability row, mounted ONLY through this public profile-patch seam.',
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
    '',
  ]
  writeFileSync(patchPath, lines.join('\n'))
}

// ── boot ───────────────────────────────────────────────────────────────────

const instLogDir = join(REPORT_DIR, 'instances', 'PWBOOT')
mkdirSync(instLogDir, { recursive: true })

function portBusy() {
  return new Promise((resolvePromise) => {
    const s = net.connect(PORT, '127.0.0.1')
    s.on('connect', () => { s.destroy(); resolvePromise(true) })
    s.on('error', () => resolvePromise(false))
    s.setTimeout(1500, () => { s.destroy(); resolvePromise(false) })
  })
}

async function main() {
  if (await portBusy()) {
    console.error('PWBOOT_FAIL port 3180 busy — aborting (shared test host; wait for the other run to end)')
    process.exit(2)
  }

  const instance = new DshInstance({
    hostTree: HOST_TREE,
    dshHome: DSH_HOME,
    port: PORT,
    clientCommitHash: CLIENT_COMMIT_HASH,
    logDir: instLogDir,
  })
  const profile = await ensureProfile({ instance, log, timeoutMs: 120_000 })
  log(`profile ${profile.created ? 'created via throwaway boot' : 'already initialized'}`)
  writeTeamPatchFile(instance.patchFile, 'create-or-open')
  log(`patch layer written to ${instance.patchFile}`)

  const directive = { boot: RESTART ? 2 : 1, phase: RESTART ? 'resume' : 'create', reportDir: REPORT_DIR, runStamp: RESTART ? `restart-${NONCE}` : NONCE, rootSessionId: ROOT_A, mcpPort: null }
  writeFileSync(join(DSH_HOME, 'p6t6-directive.json'), JSON.stringify(directive, null, 2))
  log(`directive written (boot=${directive.boot} phase=${directive.phase} root=${ROOT_A})`)

  ensureJunctions(join(WORKTREE_ROOT, 'packages', 'runtime', 'node_modules'), RUNTIME_LINKS, 'runtime')
  ensureJunctions(join(WORKTREE_ROOT, 'packages', 'node_modules'), PACKAGES_LINKS, 'packages')

  // The real provider key: read the ref from the test home's credential
  // store into the spawn env only (never logged).
  const credsText = readFileSync(join(DSH_HOME, '.credentials.yaml'), 'utf8')
  const m = credsText.match(/QIYUAN_SELF_API_KEY:\s*(\S+)/)
  if (m === null) throw new Error('QIYUAN_SELF_API_KEY ref missing from .credentials.yaml — cannot run the real-model acceptance')
  process.env.QIYUAN_SELF_API_KEY = m[1]

  const started = await instance.start({ timeoutMs: 240_000 })
  const url = started.url
  const origin = `http://127.0.0.1:${PORT}`
  log(`booted at ${origin}`)

  const dump = await instance.dumpConfig({ timeoutMs: 60_000 })
  writeFileSync(join(instLogDir, 'dump-config.txt'), dump.text)
  const clientRowInDump = DshInstance.rowInDump(dump.text, { id: 'dsh-agent-team-client', name: CLIENT_ROW_NAME })
  log(`rows mounted: dsh-agent-team=${DshInstance.rowInDump(dump.text, { id: 'dsh-agent-team', name: PRODUCTION_ROW_NAME })} dsh-agent-team-client=${clientRowInDump} p6t6=${DshInstance.rowInDump(dump.text, { id: 'p6t6-team-tools', name: P6T6_ROW_NAME })}`)
  if (!clientRowInDump) throw new Error('client row not in the composed profile dump — the Team UI would not mount in the browser')

  // Client-bundle serve probe (authenticated): the DEFINITIVE list of
  // client rows is the boot graph injected into the index page — extract
  // the /plugins/ URLs and verify the team client bundle is fetchable
  // (the route id is the owning manifest's package name, not the row id).
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

  writeFileSync(join(REPORT_DIR, 'boot-state.json'), JSON.stringify({
    rootSessionId: ROOT_A,
    nonce: NONCE,
    url,
    origin,
    logPath: started.logPath,
    model: { provider: 'qiyuan-self', model: 'qwen3.8-27b' },
    bootedAt: new Date().toISOString(),
  }, null, 2))
  console.log(`BOOT_URL=${url}`)
  console.log('PWBOOT_READY real-model host up; keep-alive until killed')

  let stopping = false
  const stopAll = async (signal) => {
    if (stopping) return
    stopping = true
    log(`received ${signal} — stopping host`)
    try {
      const res = await instance.stop({ timeoutMs: 20_000 })
      log(`stopped (killed=${res.killed} portFree=${res.portFree})`)
    } catch (error) {
      log(`stop error: ${error.message}`)
    }
    const free = await waitForPortFree(PORT, 10_000)
    console.log(`PWBOOT_STOPPED portFree=${free}`)
    process.exit(free ? 0 : 1)
  }
  process.on('SIGTERM', () => void stopAll('SIGTERM'))
  process.on('SIGINT', () => void stopAll('SIGINT'))
  setInterval(() => {}, 1 << 30) // keep-alive
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

main().catch((error) => {
  console.error(`PWBOOT_FAIL ${error.message}`)
  process.exit(1)
})
