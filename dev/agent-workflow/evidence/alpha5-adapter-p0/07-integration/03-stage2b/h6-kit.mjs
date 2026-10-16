#!/usr/bin/env node
/**
 * h6-kit.mjs — Alpha.5 P0-6 GO-clauses completion (h6): end-to-end
 * "restricted file read + search + Bash/PTC comparison + deny/approval" plus
 * the assembly-order / self-registration clauses on the pinned REAL host, in
 * ONE boot (guide §3 P0-6; skeleton reused from the PASSed
 * p06-stage2b-kit.mjs run 2026-10-15T22-44-01).
 *
 * Legs (each judged independently; PASS/FAIL/BLOCKED-CONFIRMED with verbatim):
 *  H-A restricted read: own-layer same-name read Adapter over the native
 *      read (restrict-first). Policy: realpath inside allowedRoot AND never
 *      under the private name (fail-closed). Positive control returns the
 *      real seed bytes; negatives (../private/secret.txt and a symlink into
 *      private) are typed denials with zero content features and zero secret
 *      substrings on the host wire; the Adapter's own access ledger records
 *      every open actually issued (OS side-effect evidence).
 *  H-B search: own-layer same-name grep Adapter built from the pinned host's
 *      tool-fs-search PACKAGE-ROOT build artifact (file:// URL import of
 *      lib/index.js: parseGrepArgs/buildGrepCommand/parseGrepMatches/
 *      formatGrepMatches/runRipgrep over the public ctx.subprocess service;
 *      disclosed fallback = direct pinned @vscode ripgrep binary). Positive
 *      control = multiset equality (order-normalized) with the CONTROL
 *      member's native grep on the same query; negatives = deny-path typed
 *      denials with zero hit leakage.
 *  H-C Bash/PTC + assembly: builtinToolDeny:["bash"] member -> (1) the model
 *      dispatchable surface carries no bash (control member carries it);
 *      (2) own-layer same-name "bash" self-registration + call -> must not
 *      be reachable again (typed deny/unknown per guard; zero execution
 *      markers); (3) own-layer "run_code" register -> host typed rejection
 *      recorded verbatim (PTC-01, host version); (4) undeclared dynamic tool
 *      probe (fail-closed observation, disclosed either way).
 *  H-D deny/approval: deny-lane write -> typed rejection, target bytes
 *      unchanged; ask-lane bash -> durable leader-approval resolved through
 *      the PUBLIC team tool surface (list-pending + resolve via the Leader),
 *      executes once, the REPEAT call re-asks (one-shot consumption), all
 *      carried by the durable control ledger.
 *
 * HARD CONSTRAINTS: host port = 3185 ONLY (mock = ephemeral :0); every wait
 * capped at 180s and every timeout lands in run.log; DSH_HOME under
 * W/tests/homes/a5p0-h6-<stamp> (removed at teardown, recorded); test-use
 * tree never written; :3080 read-only probe only; kill ONLY the recorded
 * host PID; no third-party egress; no commits; tokens redacted.
 *
 * Usage: node h6-kit.mjs [--keep] [--evidence-dir <p>]
 * EXIT: 0 = all criteria pass; 2 = a criterion failed/blocked; 1 = fatal.
 */

import { spawn, spawnSync } from 'node:child_process'
import { closeSync, copyFileSync, existsSync, mkdirSync, openSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { release, type as ostype } from 'node:os'
import { join, resolve, dirname, basename } from 'node:path'
import { pathToFileURL } from 'node:url'
import { startMockModel } from '../../../../../../packages/tools/harness/mock-deepseek.mjs'
import { presetDeclarationRow, smokePresetPlugins } from '../../../../../../tests/kits/_shared/preset-seam.mjs'
import { TEST_USE_BASELINE_SHA, CLIENT_COMMIT_HASH, DSH_BASELINE_VERSION } from '../../../../../../tests/paths.mjs'

// ── CLI ─────────────────────────────────────────────────────────────────────
const args = process.argv.slice(2)
const FLAG_KEEP = args.includes('--keep')

const KIT_DIR = dirname(new URL(import.meta.url).pathname)
const WORKTREE = resolve(KIT_DIR, '..', '..', '..', '..', '..', '..')
const TESTUSE = join(WORKTREE, 'tests', 'deepseek-harness-test-use')
const HOST_PORT = 3185

const EVIDENCE_DIR_ARG = (() => {
  const i = args.indexOf('--evidence-dir')
  return i === -1 ? null : args[i + 1]
})()

// ── frozen facts ────────────────────────────────────────────────────────────
const HOST_BASELINE_SHA = TEST_USE_BASELINE_SHA
const HOST_BIN = join(TESTUSE, 'apps', 'cli', 'lib', 'bin.js')
const DIST_RUNTIME = join(WORKTREE, 'packages', 'runtime', 'dist', 'packages', 'runtime')
const PRODUCTION_ROW_PATH = join(DIST_RUNTIME, 'src', 'plugin', 'host.js')
const GLUE_PATH = join(DIST_RUNTIME, 'src', 'plugin', 'live', 'agent-bindings.mjs')
const SEAM_PATH = join(WORKTREE, 'packages', 'runtime', 'root-binding', 'harness', 'seam.mjs')
const P6T6_PLUGIN_PATH = join(WORKTREE, 'packages', 'tools', 'harness', 'plugin.mjs')
const ADAPTER_PLUGIN_PATH = join(KIT_DIR, 'h6-adapter-plugin.mjs')
const SEARCH_ENTRY = join(TESTUSE, 'packages', 'fs', 'tool-fs-search', 'lib', 'index.js')
const PRODUCTION_ROW_NAME = pathToFileURL(PRODUCTION_ROW_PATH).href
const GLUE_URL = pathToFileURL(GLUE_PATH).href
const SEAM_URL = pathToFileURL(SEAM_PATH).href
const P6T6_ROW_NAME = pathToFileURL(P6T6_PLUGIN_PATH).href
const ADAPTER_ROW_NAME = pathToFileURL(ADAPTER_PLUGIN_PATH).href
const SEARCH_ENTRY_URL = pathToFileURL(SEARCH_ENTRY).href

/** The pinned tree's @vscode ripgrep binary (fallback channel only). */
function findPinnedRg() {
  try {
    const pnpmRoot = join(TESTUSE, 'node_modules', '.pnpm')
    const hit = readdirSync(pnpmRoot).find((d) => d.startsWith('@vscode+ripgrep-'))
    if (hit === undefined) return null
    for (const cand of [
      join(pnpmRoot, hit, 'node_modules', '@vscode', 'ripgrep-linux-x64', 'bin', 'rg'),
      join(pnpmRoot, hit, 'node_modules', '@vscode', 'ripgrep-win32-x64', 'bin', 'rg.exe'),
    ]) if (existsSync(cand)) return cand
    return null
  } catch { return null }
}

const SMOKE_PRESET_ID = 'a5p0-h6-smoke'
const ADAPTER_PRESET_ID = 'a5p0-h6-adp'
const MANAGED_TOOL_NAMES = ['read', 'read_image', 'write', 'edit', 'lsp', 'bash', 'pwsh']
const SAFE_UNMANAGED_TOOL_NAMES = ['todo_write']
const LEADER_TEAM_TOOLS_ALLOW = [
  'team_list_members', 'team_list_templates', 'team_inspect_config',
  'team_create_member', 'team_delegate', 'team_collect',
  'team_list_pending_control', 'team_resolve_control',
]

const RUN_STAMP = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
const RUN_DIR = EVIDENCE_DIR_ARG !== null ? resolve(EVIDENCE_DIR_ARG) : join(KIT_DIR, `run-h6-${RUN_STAMP}`)
const HOME = join(WORKTREE, 'tests', 'homes', `a5p0-h6-${RUN_STAMP}`)
const WORKSPACE = join(HOME, 'workspace')
const BLUEPRINT_DIR = join(RUN_DIR, 'blueprints')
const LEDGER_FILE = join(RUN_DIR, 'h6-access-ledger.jsonl')
const PLUGIN_LOG = join(RUN_DIR, 'h6-adapter-plugin.log')
const RESULT_FILE = join(RUN_DIR, 'h6-plugin-results.jsonl')

const ROOT = `session-a5p0-root-${RUN_STAMP}`
const CREATE_ROOT = `session-a5p0-team-${RUN_STAMP}`
const BP_ANCHOR_ID = 'team.a5p0.h6-anchor'
const BP_MAIN_ID = 'team.a5p0.h6-main'

const MK_DISC = `A5P0MK_DISC_${RUN_STAMP}`
const MK_L1 = `A5P0MK_L1_${RUN_STAMP}`
const MK_M1 = `A5P0MK_M1_${RUN_STAMP}`
const MK_M2 = `A5P0MK_M2_${RUN_STAMP}`
const MK_M3 = `A5P0MK_M3_${RUN_STAMP}`
const MK_M4 = `A5P0MK_M4_${RUN_STAMP}`
const TRIGGER_RE = /A5P0MK_[A-Z0-9]+_[0-9T:.-]+/

const ARM_READ = `H6ARMREAD_${RUN_STAMP}`
const ARM_GREP = `H6ARMGREP_${RUN_STAMP}`
const ARM_BASH = `H6ARMBASH_${RUN_STAMP}`
const ARM_RC = `H6ARMRC_${RUN_STAMP}`
const ARM_DYN = `H6ARMDYN_${RUN_STAMP}`
const ADAPTER_MARK_READ = `H6_ADAPTER_READ_RAN_${RUN_STAMP}`
const ADAPTER_MARK_GREP = `H6_ADAPTER_GREP_RAN_${RUN_STAMP}`
const SEED_UNIQUE = `H6_SEED_CONTENT_${RUN_STAMP}`
const SECRET_UNIQUE = `H6_SECRET_CONTENT_${RUN_STAMP}`
const GREP_QUERY = `H6QSEARCH_${RUN_STAMP}`
const BASH_ECHO_MARK = `H6BASHRAN_${RUN_STAMP}`

// World fixtures
const WORLD_ROOT = join(WORKSPACE, `h6-${RUN_STAMP}`)
const ALLOWED = join(WORLD_ROOT, 'allowed')
const PRIVATE = join(WORLD_ROOT, 'private')
const FX = join(ALLOWED, 'fxdir')
const SEED_FILE = join(ALLOWED, 'h6-seed.txt')
const READARM_FILE = join(ALLOWED, `h6-readarm-${ARM_READ}.txt`)
const BASHARM_FILE = join(ALLOWED, `h6-basharm-${ARM_BASH}.txt`)
const RCARM_FILE = join(ALLOWED, `h6-rcarm-${ARM_RC}-${ARM_DYN}.txt`)
const ESCAPE_LINK = join(ALLOWED, 'h6-escape-link.txt')
const DIRLINK = join(ALLOWED, 'h6-dirlink')
const FX_A = join(FX, 'h6fx-a.txt')
const FX_B = join(FX, 'h6fx-b.txt')
const SECRET_FILE = join(PRIVATE, 'secret.txt')
const DENY_TARGET = join(WORLD_ROOT, 'h6-deny-target.txt')
const EDIT_TARGET = join(WORLD_ROOT, 'h6-edit-target.txt')
const EDIT_ORIG = `H6EDIT_ORIGINAL_${RUN_STAMP}`
const EDIT_M1 = `H6EDIT_APPLIED_1_${RUN_STAMP}`
const EDIT_M2 = `H6EDIT_APPLIED_2_${RUN_STAMP}`
const BASH_OUT = join(ALLOWED, 'h6-bash-out.txt')
const OWN_BASH_MARKER = join(WORLD_ROOT, 'h6-ownlayer-bash-marker.txt')
const DYN_MARKER = join(WORLD_ROOT, 'h6-dyn-marker.txt')
// deny-path read arguments ride host-cwd-relative strings (host cwd =
// WORKSPACE) so the Adapter must do the normalization + realpath itself.
const relFromWs = (p) => p.slice(WORKSPACE.length + 1)

// ── logging / criteria / fatals ─────────────────────────────────────────────
let RUN_LOG = null
function log(line) {
  const stamped = `[${new Date().toISOString()}] ${line}`
  console.log(stamped)
  if (RUN_LOG !== null) {
    try { writeFileSync(RUN_LOG, stamped + '\n', { flag: 'a' }) } catch { /* best-effort */ }
  }
}
const criteria = []
function check(critId, name, ok, detail) {
  criteria.push({ id: critId, name, ok: ok === true, detail: String(detail ?? '').slice(0, 900) })
  log(`${ok === true ? 'PASS' : 'FAIL'} ${critId}: ${name}${detail === undefined || detail === '' ? '' : ` — ${String(detail).slice(0, 400)}`}`)
  return ok === true
}
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
    mkdirSync(RUN_DIR, { recursive: true })
    writeFileSync(join(RUN_DIR, name), redact(typeof content === 'string' ? content : JSON.stringify(content, null, 2)))
  } catch { /* best-effort */ }
}
function dieFatal(msg, exitCode = 1) {
  log(`FATAL ${msg}`)
  writeEvidence('h6-summary.json', { runStamp: RUN_STAMP, fatal: redact(msg), criteria })
  try { writeFileSync(join(KIT_DIR, 'h6-KIT_EXIT'), `1\n`) } catch { /* best-effort */ }
  process.exit(exitCode)
}

// ── http helpers (c1/p06 shape; every wait <=180s) ─────────────────────────
async function fetchJson(url, init, timeoutMs = 180_000) {
  const res = await fetch(url, { ...init, signal: AbortSignal.timeout(timeoutMs) }).catch((e) => ({ status: 0, body: null, error: e.message }))
  const body = res.status === 0 ? null : await res.json().catch(() => null)
  return { status: res.status, body }
}
async function probeStableInstance(url) {
  const res = await fetch(url, { signal: AbortSignal.timeout(5_000) }).catch(() => null)
  return { url, status: res === null ? 'unreachable' : res.status }
}
async function authenticate(origin, token) {
  const res = await fetch(`${origin}/?token=${token}`, { redirect: 'manual', signal: AbortSignal.timeout(30_000) })
  const setCookie = res.headers.get('set-cookie')
  if (res.status !== 303 || setCookie === null) {
    throw new Error(`dsh web authentication returned HTTP ${res.status} (expected 303 + set-cookie)`)
  }
  return setCookie.split(';', 1)[0]
}
async function remoteCall(origin, cookie, method, params, tag = 'h6', version = 1) {
  return fetchJson(`${origin}/team-remote/${method}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie },
    body: JSON.stringify({ type: 'client-request', rpcId: `${tag}-${Math.random().toString(36).slice(2, 12)}`, method, payload: { version, params } }),
  }, 180_000)
}
async function apiCall(origin, cookie, endpoint, request, tag = 'h6', timeoutMs = 180_000) {
  return fetchJson(`${origin}/api/${endpoint}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie },
    body: JSON.stringify({ type: 'client-request', rpcId: `${tag}-${Math.random().toString(36).slice(2, 12)}`, method: endpoint, payload: { args: { request } } }),
  }, timeoutMs)
}
async function apiPrompt(origin, cookie, sessionId, text, tag = 'h6') {
  return apiCall(origin, cookie, 'session/prompt', {
    requestId: `${tag}-${Math.random().toString(36).slice(2, 12)}`,
    sessionId, mode: 'queue', content: [{ type: 'text', text }],
  }, tag)
}
function logTail(logPath, n = 25) {
  try { return readFileSync(logPath, 'utf8').split('\n').slice(-n).join('\n') } catch { return '<no log>' }
}
const BOOT_MARKER = /dsh web: http:\/\/127\.0\.0\.1:(\d+)\/\?token=[A-Za-z0-9_-]+/
async function waitForLogLine(logPath, regex, timeoutMs, alive) {
  const deadline = Date.now() + timeoutMs
  for (;;) {
    let text = ''
    try { text = readFileSync(logPath, 'utf8') } catch { /* not yet */ }
    for (const line of text.split('\n')) {
      const m = regex.exec(line)
      if (m !== null) return line
    }
    if (Date.now() >= deadline) break
    if (alive !== undefined && !alive()) return null
    await new Promise((r) => setTimeout(r, 300))
  }
  return null
}
async function portFree(port, timeoutMs = 1500) {
  const res = await fetch(`http://127.0.0.1:${port}/`, { signal: AbortSignal.timeout(timeoutMs) }).catch((e) => ({ error: e }))
  return res.error !== undefined
}

// ── world materialization ───────────────────────────────────────────────────
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
    rootPresetId: SMOKE_PRESET_ID,
    memberPresetId: ADAPTER_PRESET_ID,
    seedMembers: [],
    generation: 1,
    staticModel: { provider: 'deepseek-official', model: 'a5p0-model' },
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
  `  persona: "You are the leader of the a5p0 h6 boot team. ${MK_DISC} is the discovery marker."`,
  'members:', '  - templateId: worker', '    persona: "You are a worker of the a5p0 h6 boot team."',
  'memberEnvelopes: []', 'requirements: []', 'permissionMutationEnvelope:', '  rules: []',
  'teamHardEnvelope:', '  rules: []', 'policyStates: []', 'metadata: {}', '---', '',
].join('\n')

const denyLines = (list, baseIndent) => {
  const pad = '  '.repeat(baseIndent)
  return list.length === 0 ? [`${pad}builtinToolDeny: []`] : [`${pad}builtinToolDeny:`, ...list.map((n) => `${pad}  - ${n}`)]
}

/** h6 blueprint: strict (MEM1+MEM3), legacy ctl (MEM2), nobash (MEM4). */
function savedBlueprintYaml(denyList) {
  const leaderBlock = [
    'leader:', '  templateId: leader',
    `  persona: ${JSON.stringify(`You are the leader of the a5p0 h6 main team. ${MK_L1} drives your chain; separate system notices arrive for approvals.`)}`,
    '  capabilities:', '    teamTools:', '      kind: allow', '      items:',
    ...LEADER_TEAM_TOOLS_ALLOW.map((t) => `        - ${t}`),
    ...denyLines(denyList, 2),
    '    skills:', '      kind: allow', '      items: []',
    '    mcp:', '      kind: allow', '      items: []',
    '    permissions:', '      default: ask',
    '      allow:', '        - tool: read', '          resource:', '            kind: subtree', '            path: team',
    '      ask:', '        - tool: bash', '          resource:', '            kind: any',
    '      deny: []',
  ]
  const strictBlock = (indentN) => {
    const pad = '  '.repeat(indentN)
    return [
      `${pad}- templateId: strict`,
      `${pad}  displayName: "strict worker"`,
      `    persona: ${JSON.stringify('You are a worker of the a5p0 h6 main team (strict lane). Follow the delegated script exactly, one tool call at a time.')}`,
      `${pad}  capabilities:`, `${pad}    teamTools:`, `${pad}      kind: deny`,
      ...denyLines(denyList, 3),
      `${pad}    skills:`, `${pad}      kind: allow`, `${pad}      items: []`,
      `${pad}    mcp:`, `${pad}      kind: allow`, `${pad}      items: []`,
      `${pad}    permissions:`, `${pad}      default: ask`,
      `${pad}      allow:`, `${pad}        - tool: read`, `${pad}          resource:`, `${pad}            kind: any`,
      `${pad}      ask:`, `${pad}        - tool: bash`, `${pad}          resource:`, `${pad}            kind: any`, `${pad}        - tool: edit`, `${pad}          resource:`, `${pad}            kind: any`,
      `${pad}      deny:`, `${pad}        - tool: write`, `${pad}          resource:`, `${pad}            kind: any`,
    ]
  }
  const nobashBlock = (indentN) => {
    const pad = '  '.repeat(indentN)
    return [
      `${pad}- templateId: nobash`,
      `${pad}  displayName: "no-bash worker"`,
      `    persona: ${JSON.stringify('You are a worker of the a5p0 h6 main team (no-bash lane). Follow the delegated script exactly, one tool call at a time.')}`,
      `${pad}  capabilities:`, `${pad}    teamTools:`, `${pad}      kind: deny`,
      ...denyLines([...denyList, 'bash'], 3),
      `${pad}    skills:`, `${pad}      kind: allow`, `${pad}      items: []`,
      `${pad}    mcp:`, `${pad}      kind: allow`, `${pad}      items: []`,
      `${pad}    permissions:`, `${pad}      default: deny`,
      `${pad}      allow:`, `${pad}        - tool: read`, `${pad}          resource:`, `${pad}            kind: any`,
      `${pad}      ask: []`, `${pad}      deny: []`,
    ]
  }
  const ctlBlock = [
    '  - templateId: ctl',
    '    displayName: "legacy control worker"',
    `    persona: ${JSON.stringify('You are a worker of the a5p0 h6 main team (legacy control lane). Follow the delegated script exactly, one tool call at a time.')}`,
  ]
  return [
    '---', 'schemaVersion: 3', `blueprintId: ${BP_MAIN_ID}`, 'revision: "1"',
    ...leaderBlock,
    'teamEnvelope:', '  allow:', '    - assign-task', '    - create-member', '    - send-message',
    '    - report-progress', '    - request-control', '    - resolve-control', '  deny: []',
    'members:',
    ...strictBlock(1),
    ...ctlBlock,
    ...nobashBlock(1),
    'memberEnvelopes:',
    '  - templateId: strict', '    envelope:', '      allow:', '        - send-message', '        - report-progress', '        - request-control', '      deny: []',
    '  - templateId: nobash', '    envelope:', '      allow:', '        - send-message', '        - report-progress', '        - request-control', '      deny: []',
    'permissionMutationEnvelope:', '  rules: []', 'teamHardEnvelope:', '  rules: []',
    'policyStates: []', 'metadata: {}', '---', '',
  ].join('\n')
}

function searchRow() {
  return { id: 'tool-fs-search', name: '@deepseek-ai/dsh-tool-fs-search', config: { sampleOverCapGlobResults: false } }
}

function writePatchFile(home) {
  mkdirSync(join(home, 'profiles', 'web'), { recursive: true })
  const basePlugins = [...smokePresetPlugins({
    personaText: 'You are a coding agent powered by the {{model}} model.',
    cwdSuffix: 'Your working directory is {{cwd}}.',
    bashDescription: 'Run commands in a bash shell. State is persistent across calls.',
  }), searchRow()]
  const adapterPlugins = [...basePlugins, { id: 'h6-adapter', name: ADAPTER_ROW_NAME }]
  const lines = [
    `# a5p0 h6 patch layer (run ${RUN_STAMP}): production dsh-agent-team row (W dist) + p6t6 observer + two presets (base smoke+search; smoke+search+h6 multi-adapter row) — public profile-patch seam only.`,
    '- insert:',
    ...yamlEmitItem({ id: 'dsh-agent-team', name: PRODUCTION_ROW_NAME, config: teamRowConfig() }, 2),
    ...yamlEmitItem({ id: 'p6t6-team-tools', name: P6T6_ROW_NAME }, 2),
    ...yamlEmitItem(presetDeclarationRow({
      id: SMOKE_PRESET_ID, displayName: 'a5p0 h6 smoke',
      description: `a5p0 h6 base preset (run ${RUN_STAMP}) = smoke + tool-fs-search`,
      plugins: basePlugins,
    }), 2),
    ...yamlEmitItem(presetDeclarationRow({
      id: ADAPTER_PRESET_ID, displayName: 'a5p0 h6 adp',
      description: `a5p0 h6 adapter preset (run ${RUN_STAMP}) = base + h6-adapter row`,
      plugins: adapterPlugins,
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
        DEEPSEEK_API_KEY: 'a5p0-h6-mock-key',
      },
    })
  } catch (error) {
    closeSync(outFd); closeSync(errFd)
    throw new Error(`host spawn failed: ${error.message}`)
  }
  const exitInfo = { exited: false, code: undefined, signal: undefined, message: undefined }
  child.on('error', (error) => { exitInfo.exited = true; exitInfo.signal = 'spawn-error'; exitInfo.message = error.message })
  child.on('close', (code, signal) => { exitInfo.exited = true; exitInfo.code = code; exitInfo.signal = signal })
  return { child, pid: child.pid, exitInfo, alive: () => !exitInfo.exited, logPath }
}
function stopHost(h) {
  try { if (h !== undefined && h.pid !== undefined) process.kill(h.pid) } catch { /* already gone */ }
  return h
}
async function bootHost({ port, home, mockPort, instanceLog }) {
  writePatchFile(home)
  mkdirSync(BLUEPRINT_DIR, { recursive: true })
  writeFileSync(join(BLUEPRINT_DIR, 'h6-anchor.yaml'), BP_ANCHOR_YAML)
  writeFileSync(join(home, 'p6t6-directive.json'), JSON.stringify({ boot: 1, phase: 'create', reportDir: RUN_DIR, runStamp: RUN_STAMP, rootSessionId: ROOT }, null, 2))
  writeFileSync(join(home, 'h6-adapter-directive.json'), JSON.stringify({
    allowedRoot: ALLOWED, privateDirName: 'private',
    arms: { read: ARM_READ, grep: ARM_GREP, bash: ARM_BASH, runcode: ARM_RC, dyn: ARM_DYN },
    markRead: ADAPTER_MARK_READ, markGrep: ADAPTER_MARK_GREP,
    ledgerFile: LEDGER_FILE, logFile: PLUGIN_LOG, resultFile: RESULT_FILE,
    searchEntryUrl: SEARCH_ENTRY_URL, fallbackRgBinary: findPinnedRg(),
    ownBashMarkerFile: OWN_BASH_MARKER, dynMarkerFile: DYN_MARKER,
  }, null, 2))
  const h = spawnHost({ port, home, logPath: instanceLog, mockPort })
  const line = await waitForLogLine(instanceLog, BOOT_MARKER, 180_000, h.alive)
  if (line === null) {
    stopHost(h)
    const detail = h.exitInfo.exited
      ? `process exited (code=${String(h.exitInfo.code)} signal=${String(h.exitInfo.signal ?? 'none')}${h.exitInfo.message ? ` msg=${h.exitInfo.message}` : ''})`
      : 'no boot marker within 180s (cap)'
    dieFatal(`host boot failed: ${detail}\n--- log tail ---\n${logTail(instanceLog)}`)
  }
  const m = /^http:\/\/127\.0\.0\.1:(\d+)\/\?token=([A-Za-z0-9_-]+)$/.exec(line.replace(/.*dsh web:\s*/, ''))
  if (m === null) dieFatal(`unexpected boot url shape: ${line}`)
  const origin = `http://127.0.0.1:${m[1]}`
  const cookie = await authenticate(origin, m[2]).catch((e) => dieFatal(`auth failed: ${e.message}`))
  const deadline = Date.now() + 180_000
  let health = null
  for (;;) {
    const hb = await fetchJson(`${origin}/__p6t6/health`, undefined, 20_000)
    health = hb
    if (hb.status === 200 && hb.body?.ok === true) break
    if (hb.status === 200 && hb.body?.ok === false && hb.body?.setupError !== undefined) {
      stopHost(h)
      dieFatal(`row setup failed — setupError: ${String(hb.body.setupError).slice(0, 600)}\n--- log tail ---\n${logTail(instanceLog)}`)
    }
    if (Date.now() >= deadline) { stopHost(h); dieFatal(`row health not ready in 180s (cap) — ${JSON.stringify(hb.body).slice(0, 400)}\n--- log tail ---\n${logTail(instanceLog)}`) }
    await new Promise((r) => setTimeout(r, 1000))
  }
  const sDeadline = Date.now() + 180_000
  let state = null
  for (;;) {
    const s = await fetchJson(`${origin}/__p6t6/state`, undefined, 30_000)
    state = s
    const b = s.body
    if (s.status === 200 && b !== null && typeof b === 'object' && b.rootSessionId === ROOT && b.phase === 'create' && b.teamSession !== null) break
    if (Date.now() >= sDeadline) { stopHost(h); dieFatal(`row state not well-formed in 180s (cap); last: status=${s.status} body=${JSON.stringify(s.body).slice(0, 400)}`) }
    await new Promise((r) => setTimeout(r, 500))
  }
  log(`host booted at ${origin} (pid ${String(h.pid)}); row ready — toolCount=${String(health.body?.toolCount)}`)
  return { host: h, port: Number(m[1]), origin, cookie, instanceLog, health, stateBody: state.body }
}

// ── mock decide policy ──────────────────────────────────────────────────────
function toolCall(name, argumentsObj) {
  return { kind: 'tool-call', toolCalls: [{ id: `call-h6-${Math.random().toString(36).slice(2, 10)}`, name, arguments: argumentsObj }] }
}
function bodyOf(rec) { return rec === null || typeof rec !== 'object' ? null : ('body' in rec ? (rec.body ?? null) : rec) }
function messagesOf(req) { return bodyOf(req)?.messages ?? [] }
function userTextOf(req) {
  return messagesOf(req).filter((m) => m.role === 'user')
    .map((m) => (typeof m.content === 'string' ? m.content : JSON.stringify(m.content ?? ''))).join('\n')
}
function lastTriggerIndex(req) {
  const messages = messagesOf(req)
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const m = messages[i]
    if (m.role !== 'user') continue
    const t = typeof m.content === 'string' ? m.content : JSON.stringify(m.content ?? '')
    if (TRIGGER_RE.test(t)) return i
  }
  for (let i = messages.length - 1; i >= 0; i -= 1) if (messages[i].role === 'user') return i
  return -1
}
function lastUserTextOf(req) {
  const messages = messagesOf(req)
  const i = lastTriggerIndex(req)
  if (i === -1) return ''
  const last = messages[i]
  return typeof last.content === 'string' ? last.content : JSON.stringify(last.content ?? '')
}
function toolResultsAfterTrigger(req) {
  const messages = messagesOf(req)
  const out = []
  for (const m of messages.slice(lastTriggerIndex(req) + 1)) {
    const blocks = Array.isArray(m.content) ? m.content : []
    for (const b of blocks) {
      if (b?.type === 'tool_result') {
        const text = (Array.isArray(b.content) ? b.content : []).map((c) => c?.text ?? '').join('')
        out.push({ text, isError: b.is_error === true, toolUseId: b.tool_use_id ?? null })
      }
    }
    if (m.role === 'tool') out.push({ text: typeof m.content === 'string' ? m.content : JSON.stringify(m.content ?? ''), isError: false, toolUseId: m.tool_call_id ?? null })
  }
  return out
}
function toolMsgsOf(req) { return toolResultsAfterTrigger(req) }
/** Notification anchor: the LAST user message carrying the leader-approval
 *  notice token; results = tool_result blocks delivered after it (the notice
 *  itself does not match TRIGGER_RE, so lastTriggerIndex cannot anchor it). */
function notifOf(req) {
  const messages = messagesOf(req)
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const m = messages[i]
    if (m.role !== 'user') continue
    const t = typeof m.content === 'string' ? m.content : JSON.stringify(m.content ?? '')
    if (t.includes('[team-control requestId=')) {
      const results = []
      for (const mm of messages.slice(i + 1)) {
        const blocks = Array.isArray(mm.content) ? mm.content : []
        for (const b of blocks) {
          if (b?.type === 'tool_result') results.push({ text: (Array.isArray(b.content) ? b.content : []).map((c) => c?.text ?? '').join(''), isError: b.is_error === true })
        }
      }
      return { text: t, rid: extractRequestId(t), results }
    }
  }
  return null
}
function allToolResultsOf(req) {
  const out = []
  for (const m of messagesOf(req)) {
    const blocks = Array.isArray(m.content) ? m.content : []
    for (const b of blocks) {
      if (b?.type === 'tool_result') out.push({ text: (Array.isArray(b.content) ? b.content : []).map((c) => c?.text ?? '').join(''), toolUseId: b.tool_use_id ?? null })
    }
  }
  return out
}
function extractInstanceId(content) {
  const m = /"targetInstanceId"\s*:\s*"([^"]+)"/.exec(String(content))
    ?? /"instanceId"\s*:\s*"([^"]+)"/.exec(String(content))
    ?? /inst-[A-Za-z0-9][A-Za-z0-9-]{3,64}/.exec(String(content))
  return m === null ? null : m[1]
}
function extractRequestId(text) {
  const m = /\[team-control requestId=([^\]]+)\]/.exec(String(text))
    ?? /"requestId"\s*:\s*"([^"]+)"/.exec(String(text))
  return m === null ? null : m[1]
}
function surfaceNames(req) {
  return (bodyOf(req)?.tools ?? []).map((t) => t?.function?.name ?? t?.name ?? String(t))
}
function discoverArgKey(req, toolName, candidates) {
  const tools = bodyOf(req)?.tools ?? []
  const t = tools.find((x) => (x?.function?.name ?? x?.name) === toolName)
  const props = t?.function?.parameters?.properties ?? t?.input_schema?.properties ?? t?.parameters?.properties ?? {}
  for (const key of candidates) if (key in props) return key
  const first = Object.keys(props)[0]
  return first ?? candidates[0]
}

const M1_PROMPT = `${MK_M1} Follow this script EXACTLY, one tool call per turn: (1) read ${SEED_FILE}; (2) read ${EDIT_TARGET}; (3) read ${READARM_FILE}; (4) read ${SEED_FILE} again; (5) read ${relFromWs(ALLOWED)}/../private/secret.txt; (6) read ${relFromWs(ALLOWED)}/h6-escape-link.txt; (7) write to ${DENY_TARGET} the text "h6-write-attempt"; (8) run bash command: echo ${BASH_ECHO_MARK} >> ${BASH_OUT}; (9) run the SAME bash command again; (10) edit ${EDIT_TARGET}: replace ${EDIT_ORIG} with ${EDIT_M1}; (11) edit ${EDIT_TARGET} again: replace ${EDIT_M1} with ${EDIT_M2}; (12) finish with the final marker.`
const M2_PROMPT = `${MK_M2} Call grep exactly once with pattern ${GREP_QUERY} and path ${FX}, then finish.`
const M3_PROMPT = `${MK_M3} Follow EXACTLY, one grep per turn: (1) grep pattern ${ARM_GREP} path ${FX}; (2) grep pattern ${GREP_QUERY} path ${FX}; (3) grep pattern ${GREP_QUERY} path ${PRIVATE}; (4) grep pattern ${GREP_QUERY} path ${DIRLINK}; (5) finish.`
const M4_PROMPT = `${MK_M4} Follow EXACTLY, one tool call per turn: (1) read ${BASHARM_FILE}; (2) run bash command: touch ${OWN_BASH_MARKER} && echo RAN; (3) read ${RCARM_FILE}; (4) call the tool h6_dyn_probe with no arguments; (5) finish.`

function makeDecide() {
  const st = { readKey: 'file_path', writePathKey: 'file_path', writeContentKey: 'content', bashKey: 'command', editPathKey: 'file_path', editOldKey: 'old_string', editNewKey: 'new_string', ids: [] }
  return function decide({ req }) {
    const firstMsg = messagesOf(req)[0]
    const firstText = typeof firstMsg?.content === 'string' ? firstMsg.content : JSON.stringify(firstMsg?.content ?? '')
    if (firstText.includes('session title')) return { kind: 'text', content: 'a5p0 h6 session' }
    const notif = notifOf(req)
    if (notif !== null) {
      const n = notif.results.length
      if (n === 0) return toolCall('team_list_pending_control', { rootSessionId: CREATE_ROOT, requestToken: `h6-npl-${Math.random().toString(36).slice(2, 10)}` })
      if (n === 1) return toolCall('team_resolve_control', {
        rootSessionId: CREATE_ROOT, requestToken: `h6-nr-${Math.random().toString(36).slice(2, 10)}`,
        requestId: notif.rid ?? notif.results[0]?.text ?? '', decision: 'allow',
        note: 'h6 scripted approval (mock world, fake fixture only)',
      })
      return { kind: 'text', content: 'A5P0_LN_DONE' }
    }
    const lastUser = lastUserTextOf(req)
    const results = toolMsgsOf(req)
    const tools = results.length
    if (lastUser.includes(MK_M1)) {
      switch (tools) {
        case 0: st.readKey = discoverArgKey(req, 'read', ['file_path', 'path']); return toolCall('read', { [st.readKey]: SEED_FILE })
        case 1: return toolCall('read', { [st.readKey]: EDIT_TARGET })
        case 2: return toolCall('read', { [st.readKey]: READARM_FILE })
        case 3: return toolCall('read', { [st.readKey]: SEED_FILE })
        case 4: return toolCall('read', { [st.readKey]: `${relFromWs(ALLOWED)}/../private/secret.txt` })
        case 5: return toolCall('read', { [st.readKey]: `${relFromWs(ALLOWED)}/h6-escape-link.txt` })
        case 6:
          st.writePathKey = discoverArgKey(req, 'write', ['file_path', 'path'])
          st.writeContentKey = discoverArgKey(req, 'write', ['content', 'text', 'new_string'])
          return toolCall('write', { [st.writePathKey]: DENY_TARGET, [st.writeContentKey]: 'h6-write-attempt (deny lane probe)' })
        case 7:
          st.bashKey = discoverArgKey(req, 'bash', ['command', 'cmd'])
          return toolCall('bash', { [st.bashKey]: `echo ${BASH_ECHO_MARK} >> ${BASH_OUT}` })
        case 8: return toolCall('bash', { [st.bashKey]: `echo ${BASH_ECHO_MARK} >> ${BASH_OUT}` })
        case 9: {
          st.editPathKey = discoverArgKey(req, 'edit', ['file_path', 'path'])
          st.editOldKey = discoverArgKey(req, 'edit', ['old_string', 'oldText', 'old'])
          st.editNewKey = discoverArgKey(req, 'edit', ['new_string', 'newText', 'new'])
          const [pk, ok, nk] = [st.editPathKey, st.editOldKey, st.editNewKey]
          return toolCall('edit', { [pk]: EDIT_TARGET, [ok]: EDIT_ORIG, [nk]: EDIT_M1 })
        }
        case 10: {
          const [pk, ok, nk] = [st.editPathKey, st.editOldKey, st.editNewKey]
          return toolCall('edit', { [pk]: EDIT_TARGET, [ok]: EDIT_M1, [nk]: EDIT_M2 })
        }
        case 11: return { kind: 'text', content: 'A5P0_M1_DONE' }
        default: return { kind: 'text', content: `A5P0_M1_FALLTHROUGH tools=${String(tools)}` }
      }
    }
    if (lastUser.includes(MK_M2)) {
      switch (tools) {
        case 0: return toolCall('grep', { pattern: GREP_QUERY, path: FX })
        case 1: return { kind: 'text', content: 'A5P0_M2_DONE' }
        default: return { kind: 'text', content: `A5P0_M2_FALLTHROUGH tools=${String(tools)}` }
      }
    }
    if (lastUser.includes(MK_M3)) {
      switch (tools) {
        case 0: return toolCall('grep', { pattern: ARM_GREP, path: FX })
        case 1: return toolCall('grep', { pattern: GREP_QUERY, path: FX })
        case 2: return toolCall('grep', { pattern: GREP_QUERY, path: PRIVATE })
        case 3: return toolCall('grep', { pattern: GREP_QUERY, path: DIRLINK })
        case 4: return { kind: 'text', content: 'A5P0_M3_DONE' }
        default: return { kind: 'text', content: `A5P0_M3_FALLTHROUGH tools=${String(tools)}` }
      }
    }
    if (lastUser.includes(MK_M4)) {
      switch (tools) {
        case 0: return toolCall('read', { [st.readKey]: BASHARM_FILE })
        case 1: return toolCall('bash', { [st.bashKey]: `touch ${OWN_BASH_MARKER} && echo RAN` })
        case 2: return toolCall('read', { [st.readKey]: RCARM_FILE })
        case 3: return toolCall('h6_dyn_probe', {})
        case 4: return { kind: 'text', content: 'A5P0_M4_DONE' }
        default: return { kind: 'text', content: `A5P0_M4_FALLTHROUGH tools=${String(tools)}` }
      }
    }
    if (lastUser.includes(MK_DISC)) return { kind: 'text', content: 'A5P0_DISC_DONE' }
    if (lastUser.includes(MK_L1)) {
      const all = allToolResultsOf(req)
      switch (tools) {
        case 0: return toolCall('team_create_member', { rootSessionId: CREATE_ROOT, requestToken: `h6-c1-${RUN_STAMP}`, delegationTemplateId: 'strict', label: 'm1-fs' })
        case 1: return toolCall('team_create_member', { rootSessionId: CREATE_ROOT, requestToken: `h6-c2-${RUN_STAMP}`, delegationTemplateId: 'strict', label: 'm3-search' })
        case 2: return toolCall('team_create_member', { rootSessionId: CREATE_ROOT, requestToken: `h6-c3-${RUN_STAMP}`, delegationTemplateId: 'ctl', label: 'm2-native-grep' })
        case 3: return toolCall('team_create_member', { rootSessionId: CREATE_ROOT, requestToken: `h6-c4-${RUN_STAMP}`, delegationTemplateId: 'nobash', label: 'm4-nobash' })
        case 4: { const id = extractInstanceId(all[0]?.text ?? ''); if (id === null) return { kind: 'text', content: `A5P0_L1_ID_FAIL0 :: ${String(all[0]?.text).slice(0, 200)}` }; st.ids.push(id); return toolCall('team_delegate', { rootSessionId: CREATE_ROOT, requestToken: `h6-d1-${RUN_STAMP}`, delegationInstanceId: id, label: 'm1-fs', prompt: M1_PROMPT, async: true }) }
        case 5: { const id = extractInstanceId(all[1]?.text ?? ''); if (id === null) return { kind: 'text', content: 'A5P0_L1_ID_FAIL1' }; st.ids.push(id); return toolCall('team_delegate', { rootSessionId: CREATE_ROOT, requestToken: `h6-d2-${RUN_STAMP}`, delegationInstanceId: id, label: 'm3-search', prompt: M3_PROMPT, async: true }) }
        case 6: { const id = extractInstanceId(all[2]?.text ?? ''); if (id === null) return { kind: 'text', content: 'A5P0_L1_ID_FAIL2' }; st.ids.push(id); return toolCall('team_delegate', { rootSessionId: CREATE_ROOT, requestToken: `h6-d3-${RUN_STAMP}`, delegationInstanceId: id, label: 'm2-native-grep', prompt: M2_PROMPT, async: true }) }
        case 7: { const id = extractInstanceId(all[3]?.text ?? ''); if (id === null) return { kind: 'text', content: 'A5P0_L1_ID_FAIL3' }; st.ids.push(id); return toolCall('team_delegate', { rootSessionId: CREATE_ROOT, requestToken: `h6-d4-${RUN_STAMP}`, delegationInstanceId: id, label: 'm4-nobash', prompt: M4_PROMPT, async: true }) }
        case 8: return { kind: 'text', content: 'A5P0_L1_DONE' }
        default: return { kind: 'text', content: `A5P0_L1_FALLTHROUGH tools=${String(tools)}` }
      }
    }
    return { kind: 'text', content: 'A5P0_NOOP_DONE' }
  }
}
async function waitForMock(mock, pred, timeoutMs, label) {
  const deadline = Date.now() + timeoutMs
  for (;;) {
    const hit = mock.requests.find(pred)
    if (hit !== undefined) return hit
    if (mock.requests.length > 300) { log(`mock storm fuse: ${label} (requests=${String(mock.requests.length)})`); return null }
    if (Date.now() >= deadline) { log(`mock wait timed out (cap ${String(timeoutMs)}ms): ${label} (requests=${String(mock.requests.length)})`); return null }
    await new Promise((r) => setTimeout(r, 400))
  }
}
const toolResultText = (req, idx) => String(toolMsgsOf(req)[idx]?.text ?? '')
const readLedger = () => {
  try {
    return readFileSync(LEDGER_FILE, 'utf8').split('\n').filter((l) => l.trim() !== '').map((l) => JSON.parse(l))
  } catch { return [] }
}
const readResults = () => {
  try {
    return readFileSync(RESULT_FILE, 'utf8').split('\n').filter((l) => l.trim() !== '').map((l) => JSON.parse(l))
  } catch { return [] }
}
/** Order-normalized multiset of (basename:line:text) over a grep result body. */
function grepMultiset(text) {
  const keys = []
  let curFile = ''
  for (const line of String(text).split('\n')) {
    const m = /^Line (\d+): (.*)$/.exec(line)
    if (m !== null) keys.push(`${basename(curFile)}:${m[1]}:${m[2]}`)
    else if (line.trim() !== '' && !line.startsWith('Found ') && !line.startsWith('H6_') && !line.startsWith('found=') && !line.startsWith('No matches')) curFile = line
  }
  return keys.sort()
}
const sha256 = (p) => { try { return createHash('sha256').update(readFileSync(p)).digest('hex') } catch { return null } }
const fileLines = (p, marker) => {
  try { return readFileSync(p, 'utf8').split('\n').filter((l) => l.includes(marker)).length } catch { return -1 }
}

// ── main ────────────────────────────────────────────────────────────────────
async function main() {
  mkdirSync(RUN_DIR, { recursive: true })
  RUN_LOG = join(RUN_DIR, 'run.log')
  log(`a5p0 h6 kit (P0-6 GO clauses) — stamp ${RUN_STAMP}`)
  log(`worktree=${WORKTREE}; testuse=${TESTUSE} @ ${HOST_BASELINE_SHA.slice(0, 10)}; evidence=${RUN_DIR}`)

  const teamHead = spawnSync('git', ['rev-parse', 'HEAD'], { cwd: WORKTREE, encoding: 'utf8' }).stdout.trim()
  const rev = spawnSync('git', ['rev-parse', 'HEAD'], { cwd: TESTUSE, encoding: 'utf8' })
  if (rev.status !== 0 || rev.stdout.trim() !== HOST_BASELINE_SHA) dieFatal(`test-use not at baseline: ${String(rev.stdout?.trim() ?? rev.stderr)}`)
  const dirty = spawnSync('git', ['status', '--porcelain'], { cwd: TESTUSE, encoding: 'utf8' })
  if (dirty.status !== 0 || dirty.stdout.trim() !== '') dieFatal(`test-use not pristine: ${String(dirty.stdout).slice(0, 200)}`)
  for (const p of [HOST_BIN, PRODUCTION_ROW_PATH, GLUE_PATH, SEAM_PATH, P6T6_PLUGIN_PATH, ADAPTER_PLUGIN_PATH, SEARCH_ENTRY]) {
    if (!existsSync(p)) dieFatal(`required file missing: ${p}`)
  }
  if (!(await portFree(HOST_PORT))) dieFatal(`host port ${HOST_PORT} busy (constraint: 3185 only)`)

  const preStable = { p3080: await probeStableInstance('http://127.0.0.1:3080/'), p3180: await probeStableInstance('http://127.0.0.1:3180/') }
  writeEvidence('pre-stable-probe.json', preStable)

  rmSync(HOME, { recursive: true, force: true })
  mkdirSync(FX, { recursive: true })
  mkdirSync(PRIVATE, { recursive: true })
  writeFileSync(SEED_FILE, `h6 seed (run ${RUN_STAMP})\nsecond line\n${SEED_UNIQUE}\nfourth line\n`)
  writeFileSync(READARM_FILE, `read arm carrier ${ARM_READ}\n`)
  writeFileSync(BASHARM_FILE, `bash arm carrier ${ARM_BASH}\n`)
  writeFileSync(RCARM_FILE, `runcode+dyn arm carrier ${ARM_RC} ${ARM_DYN}\n`)
  writeFileSync(FX_A, `alpha line ${GREP_QUERY} alpha\nplain line\nbeta line ${GREP_QUERY} beta\ngamma line\n${GREP_QUERY} tail alpha\n`)
  writeFileSync(FX_B, `delta ${GREP_QUERY} delta\nother\n`)
  writeFileSync(SECRET_FILE, `SECRET ZONE ${GREP_QUERY} ${SECRET_UNIQUE}\nnever readable\n`)
  const DENY_BYTES = 'h6-deny-target ORIGINAL bytes (must survive the denied write)\n'
  writeFileSync(DENY_TARGET, DENY_BYTES)
  writeFileSync(EDIT_TARGET, `${EDIT_ORIG} line\n`)
  spawnSync('ln', ['-s', join('..', 'private', 'secret.txt'), ESCAPE_LINK])
  spawnSync('ln', ['-s', '..', DIRLINK])
  log(`world materialized under ${WORLD_ROOT} (symlinks: escape.txt->private/secret.txt, dirlink->..)`)

  const mock = await startMockModel({ port: 0, decide: makeDecide(), log: (l) => { try { writeFileSync(join(RUN_DIR, 'mock.log'), l + '\n', { flag: 'a' }) } catch { /* best-effort */ } } })
  log(`mock model listening on ephemeral port ${String(mock.port)}`)

  const instanceLog = join(RUN_DIR, 'instance.log')
  writeFileSync(instanceLog, '', { flag: 'w' })
  const booted = await bootHost({ port: HOST_PORT, home: HOME, mockPort: mock.port, instanceLog })
  const host = booted.host
  const bootTs = new Date().toISOString()
  writeEvidence('boot-raw.json', { bootLine: BOOT_MARKER.exec(readFileSync(instanceLog, 'utf8'))?.[0] ?? null, port: booted.port, p6t6Health: booted.health.body, note: 'boot token redacted everywhere' })

  const FAILS = []
  const fail = (id) => { if (!FAILS.includes(id)) FAILS.push(id) }
  let wireSecretHits = -1

  try {
    // ══ H1 boot ══
    const noTok = await fetch(`${booted.origin}/`, { redirect: 'manual', signal: AbortSignal.timeout(10_000) }).catch(() => null)
    const noTokStatus = noTok === null ? 'unreachable' : noTok.status
    const bootLines = readFileSync(instanceLog, 'utf8').split('\n').filter((l) => BOOT_MARKER.test(l)).length
    const h1ok = check('H1', 'cold boot :3185: boot line + no-token 401 + auth 303 + p6t6 row health/state',
      booted.port === 3185 && bootLines >= 1 && noTokStatus === 401 && booted.health.body?.ok === true,
      `port=${String(booted.port)} bootLines=${String(bootLines)} noToken=${String(noTokStatus)} healthOk=${String(booted.health.body?.ok)}`)
    if (!h1ok) fail('H1')

    // ══ L0 discovery (denyList for the strict templates) ══
    await apiPrompt(booted.origin, booted.cookie, ROOT, MK_DISC)
    const discReq = await waitForMock(mock, (r) => r.body !== null && userTextOf(r).includes(MK_DISC) && (r.body?.tools ?? []).length > 0, 180_000, 'DISC model request')
    if (discReq === null) dieFatal('L0 discovery request absent; cannot compute the deny list')
    const surface = surfaceNames(discReq).sort()
    writeEvidence('l0-surface.json', { surface })
    const denyList = surface.filter((n) => !n.startsWith('team_')
      && !MANAGED_TOOL_NAMES.includes(n) && !SAFE_UNMANAGED_TOOL_NAMES.includes(n))
    writeFileSync(join(BLUEPRINT_DIR, 'h6-main.yaml'), savedBlueprintYaml(denyList))
    log(`main blueprint written (denyList=${JSON.stringify(denyList)})`)

    // ══ H2 team ══
    const liveBefore = new Set(booted.health.body?.liveSessions ?? [])
    const createX = await remoteCall(booted.origin, booted.cookie, 'team.create', {
      rootSessionId: CREATE_ROOT, blueprintId: BP_MAIN_ID, initialWork: { prompt: MK_L1 },
    }, 'h6x')
    writeEvidence('h2-team-create.json', createX.body ?? createX)
    const createOk = createX.status === 200 && createX.body?.result?.ok === true && createX.body?.result?.value?.data?.path === 'fresh-root'
    check('H2a', 'team.create (remote HTTP) creates the fresh root team session', createOk,
      `status=${String(createX.status)} body=${JSON.stringify(createX.body ?? createX).slice(0, 300)}`)
    if (!createOk) fail('H2a')

    const cat = await remoteCall(booted.origin, booted.cookie, 'catalog.list', {}, 'h6cat')
    const catOk = cat.status === 200 && JSON.stringify(cat.body ?? '').includes(BP_MAIN_ID)
    check('H2b', 'catalog.list serves the saved h6 blueprint', catOk, `status=${String(cat.status)}`)
    if (!catOk) fail('H2b')

    const l1Done = await waitForMock(mock, (r) => r.body !== null && lastUserTextOf(r).includes(MK_L1) && (r.reply?.kind === 'text' ? r.reply.content : '') === 'A5P0_L1_DONE', 180_000, 'L1 leader chain done')
    const l1Results = l1Done === null ? [] : toolMsgsOf(l1Done).slice(0, 4).map((r) => String(r.text ?? ''))
    const instanceIds = l1Results.map((c) => extractInstanceId(c))
    writeEvidence('h2-member-create-results.json', l1Results.map((c) => c.slice(0, 1200)))
    const membersCreated = l1Done !== null && instanceIds.length === 4 && instanceIds.every((v) => v !== null)
    check('H2c', 'Leader created 4 members (strict m1, strict m3, legacy m2, nobash m4) + async delegated each', membersCreated,
      `instanceIds=${JSON.stringify(instanceIds)}`)
    if (!membersCreated) fail('H2c')

    const h2dDeadline = Date.now() + 180_000
    let newLive = []
    for (;;) {
      const h2 = await fetchJson(`${booted.origin}/__p6t6/health`, undefined, 20_000)
      newLive = [...new Set(h2.body?.liveSessions ?? [])].filter((s) => !liveBefore.has(s) && s !== CREATE_ROOT)
      if (newLive.length >= 4 || Date.now() >= h2dDeadline) break
      await new Promise((r) => setTimeout(r, 1000))
    }
    check('H2d', 'member sessions live (p6t6 liveSessions grew by >= 4; polled <=180s)', newLive.length >= 4, `newLive=${JSON.stringify(newLive)}`)
    if (!(newLive.length >= 4)) fail('H2d')

    // ══ H-A read ══
    const m1done = await waitForMock(mock, (r) => r.body !== null && lastUserTextOf(r).includes(MK_M1) && (r.reply?.kind === 'text' ? r.reply.content : '') === 'A5P0_M1_DONE', 180_000, 'M1 chain done')
    const m1req = m1done === undefined || m1done === null ? null : mock.requests.find((r) => r.body !== null && lastUserTextOf(r).includes(MK_M1) && toolMsgsOf(r).length === 11)
    const R = (i) => (m1req === null || m1req === undefined ? '' : toolResultText(m1req, i))
    writeEvidence('ha-m1-results.json', Array.from({ length: 11 }, (_, i) => ({ idx: i, text: R(i).slice(0, 1500) })))

    const nativeRead = R(0)
    const ledger0 = readLedger()
    const haPos = nativeRead.includes(SEED_UNIQUE) && R(2).includes(ADAPTER_MARK_READ) && R(3).includes(ADAPTER_MARK_READ) && R(3).includes(SEED_UNIQUE) && /call=2\b/.test(R(3))
    check('HA-pos', 'H-A positive: native read (pre-arm) then Adapter same-name read returns the real seed bytes with Adapter marker call=2 (positive control = real I/O through the Adapter)',
      haPos, `native=${nativeRead.slice(0, 90)} | adapter=${R(3).slice(0, 120)}`)
    if (!haPos) fail('HA-pos')

    const neg1 = R(4)
    const neg2 = R(5)
    // Layered wire scan (coordinator directive): the unique content-byte marker
    // SECRET_UNIQUE is the ONLY leak criterion; path-name echoes
    // (private/secret.txt inside tool_use inputs) are expected re-echoes,
    // recorded as a note, never a FAIL.
    const wireText = JSON.stringify(mock.requests.map((r) => redact(JSON.stringify(bodyOf(r) ?? ''))))
    wireSecretHits = wireText.split(SECRET_UNIQUE).length - 1
    const pathEchoHits = wireText.split('secret.txt').length - 1
    if (wireSecretHits > 0) {
      const hunt = []
      for (const r of mock.requests) {
        const s = redact(JSON.stringify(bodyOf(r) ?? ''))
        let at = s.indexOf(SECRET_UNIQUE)
        while (at !== -1 && hunt.length < 6) { hunt.push({ seq: r.seq, ctx: s.slice(Math.max(0, at - 180), at + 120) }); at = s.indexOf(SECRET_UNIQUE, at + 1) }
      }
      writeEvidence('ha-wire-secret-hunt.json', hunt)
    }
    const haNeg = neg1.includes('H6_ADAPTER_DENY') && neg2.includes('H6_ADAPTER_DENY')
      && !neg1.includes(SECRET_UNIQUE) && !neg2.includes(SECRET_UNIQUE)
      && !neg1.includes('never readable') && !neg2.includes('never readable')
      && wireSecretHits === 0
    check('HA-neg', 'H-A negative: ../private/secret.txt and the symlink into private/ both typed-denied; zero content features in results; ZERO secret CONTENT bytes across all host wire (path-name echoes counted separately, disclosed, not a disclosure)',
      haNeg, `neg1=${neg1.slice(0, 120)} neg2=${neg2.slice(0, 120)} wireContentHits=${String(wireSecretHits)} wirePathEchoes=${String(pathEchoHits)}`)
    if (!haNeg) fail('HA-neg')

    const ledger = readLedger()
    const readOpens = ledger.filter((e) => e.op === 'read' && e.phase === 'OPEN')
    const readDenies = ledger.filter((e) => e.op === 'read' && e.phase === 'DENY')
    const writeEvidenceLedger = ledger
    writeEvidence('ha-ledger-snapshot.json', { ledger })
    const haLedger = readOpens.length === 2 && readDenies.length === 2
      && readOpens.every((e) => String(e.real).includes('/allowed'))
      && readDenies.every((e) => String(e.reason).includes('fail-closed') || String(e.reason).includes('outside-allowedRoot'))
    check('HA-ledger', 'H-A OS side effects: Adapter access ledger shows exactly the opens it issued (2 allowed reads) + 2 denied attempts (realpath recorded, none under a real open)',
      haLedger, `opens=${String(readOpens.length)} denies=${String(readDenies.length)} ledgerFile=h6-access-ledger.jsonl`)
    if (!haLedger) fail('HA-ledger')

    // ══ H-B search ══
    const m2done = await waitForMock(mock, (r) => r.body !== null && lastUserTextOf(r).includes(MK_M2) && (r.reply?.kind === 'text' ? r.reply.content : '') === 'A5P0_M2_DONE', 180_000, 'M2 native grep done')
    const m2req = m2done === null ? null : mock.requests.find((r) => r.body !== null && lastUserTextOf(r).includes(MK_M2) && toolMsgsOf(r).length === 1)
    const nativeGrep = m2req === null || m2req === undefined ? '' : toolResultText(m2req, 0)
    writeEvidence('hb-native-grep.json', { result: nativeGrep.slice(0, 2000) })
    const m3done = await waitForMock(mock, (r) => r.body !== null && lastUserTextOf(r).includes(MK_M3) && (r.reply?.kind === 'text' ? r.reply.content : '') === 'A5P0_M3_DONE', 180_000, 'M3 adapter grep chain done')
    const m3req = m3done === null ? null : mock.requests.find((r) => r.body !== null && lastUserTextOf(r).includes(MK_M3) && toolMsgsOf(r).length === 4)
    const G = (i) => (m3req === null || m3req === undefined ? '' : toolResultText(m3req, i))
    writeEvidence('hb-m3-results.json', Array.from({ length: 4 }, (_, i) => ({ idx: i, text: G(i).slice(0, 1500) })))
    const adpGrep = G(1)
    check('HB-ctl', 'H-B control: legacy-template member native grep returned the fixture hits (real body)',
      nativeGrep.includes(GREP_QUERY) && nativeGrep.includes('Line '), `native=${nativeGrep.slice(0, 160)}`)
    if (!(nativeGrep.includes(GREP_QUERY) && nativeGrep.includes('Line '))) fail('HB-ctl')
    const hbAdp = adpGrep.includes(ADAPTER_MARK_GREP) && adpGrep.includes('call=2') && adpGrep.includes(GREP_QUERY) && G(0).includes('found=0')
    check('HB-adapter', 'H-B adapter: same-name grep Adapter (package-root helpers over public subprocess provider) ran the query, count=2 calls (arm + query)',
      hbAdp, `impl=${/impl=([a-z-]+)/.exec(adpGrep)?.[1] ?? '?'} adp=${adpGrep.slice(0, 160)}`)
    if (!hbAdp) fail('HB-adapter')
    const nativeSet = grepMultiset(nativeGrep)
    const adpSet = grepMultiset(adpGrep)
    const hbEquiv = nativeSet.length >= 3 && JSON.stringify(nativeSet) === JSON.stringify(adpSet)
    check('HB-equiv', 'H-B equivalence: Adapter result == native control result as order-normalized multisets of (file:line:text)',
      hbEquiv, `native=${String(nativeSet.length)} adapter=${String(adpSet.length)} equal=${JSON.stringify(nativeSet) === JSON.stringify(adpSet)}`)
    if (!hbEquiv) fail('HB-equiv')
    writeEvidence('hb-multisets.json', { native: nativeSet, adapter: adpSet })
    const hbNeg = G(2).includes('H6_ADAPTER_DENY') && G(3).includes('H6_ADAPTER_DENY')
      && ![G(2), G(3)].some((t) => t.includes('Line ') || t.includes(SECRET_UNIQUE))
    const grepLedger = ledger0.concat(readLedger()).filter((e) => e.op === 'grep')
    check('HB-neg', 'H-B negative: deny-dir + symlinked-dir queries typed-denied BEFORE any spawn; zero hit leakage',
      hbNeg, `neg1=${G(2).slice(0, 140)} neg2=${G(3).slice(0, 140)}`)
    if (!hbNeg) fail('HB-neg')

    // ══ H-C bash/PTC + assembly ══
    const m4done = await waitForMock(mock, (r) => r.body !== null && lastUserTextOf(r).includes(MK_M4) && (r.reply?.kind === 'text' ? r.reply.content : '') === 'A5P0_M4_DONE', 180_000, 'M4 chain done')
    const m4reqs = mock.requests.filter((r) => r.body !== null && lastUserTextOf(r).includes(MK_M4))
    const m4req = m4done === null ? null : m4reqs.find((r) => toolMsgsOf(r).length === 4)
    const B = (i) => (m4req === null || m4req === undefined ? '' : toolResultText(m4req, i))
    writeEvidence('hc-m4-results.json', {
      bashCallResult: B(1).slice(0, 1500), dynCallResult: B(3).slice(0, 800),
      m4Surfaces: m4reqs.map((r) => ({ seq: r.seq, toolCount: surfaceNames(r).length, hasBash: surfaceNames(r).includes('bash'), hasDyn: surfaceNames(r).includes('h6_dyn_probe') })),
      m4FirstSurface: m4reqs.length > 0 ? surfaceNames(m4reqs[0]).sort() : [],
      m4LastSurface: m4reqs.length > 0 ? surfaceNames(m4reqs[m4reqs.length - 1]).sort() : [],
    })
    const m1reqs = mock.requests.filter((r) => r.body !== null && lastUserTextOf(r).includes(MK_M1))
    const m1FirstSurface = m1reqs.length > 0 ? surfaceNames(m1reqs[0]) : []
    const m4FirstSurface = m4reqs.length > 0 ? surfaceNames(m4reqs[0]) : []
    const surfaceDiff = [...m1FirstSurface].filter((n) => !m4FirstSurface.includes(n)).sort()
    const hc1 = !m4FirstSurface.includes('bash') && m1FirstSurface.includes('bash')
    check('HC1-surface', 'H-C(1) assembly: builtinToolDeny(["bash"]) member dispatchable surface carries NO bash (control member does); surface diff recorded',
      hc1, `m4HasBash=false?${String(!m4FirstSurface.includes('bash'))} m1HasBash=${String(m1FirstSurface.includes('bash'))} diff(m1-m4)=${JSON.stringify(surfaceDiff)}`)
    if (!hc1) fail('HC1-surface')
    const bashCallResult = B(1)
    const bashMarkerExists = existsSync(OWN_BASH_MARKER)
    const hc2 = !bashCallResult.includes('H6_OWNLAYER_BASH_RAN') && !bashMarkerExists
      && bashCallResult !== '' && /denied|denied by|permission|blocked|unknown tool|no rule/i.test(bashCallResult)
    writeEvidence('hc-bash-register-results.json', { pluginResults: readResults(), bashCallResult })
    check('HC2-nonreach', 'H-C(2) clause: after own-layer same-name self-registration of the builtinToolDeny-shielded bash, the call is NOT reachable again (typed deny/unknown per guard; zero execution markers)',
      hc2, `result=${bashCallResult.slice(0, 220)} ownBashMarker=${String(bashMarkerExists)}`)
    if (!hc2) fail('HC2-nonreach')
    const rcRow = readResults().find((e) => e.leg === 'runcode-register')
    const hc3 = rcRow !== undefined && rcRow.ok === false && String(rcRow.error).length > 0
    check('HC3-runcode', 'H-C(3) PTC-01 host version: own-layer register("run_code") rejected by the host with a typed error (recorded verbatim)',
      hc3, `runcode-register=${JSON.stringify(rcRow ?? null).slice(0, 260)}`)
    if (!hc3) fail('HC3-runcode')
    const dynRow = readResults().find((e) => e.leg === 'dyn-register')
    const dynRan = existsSync(DYN_MARKER)
    writeEvidence('hc-dyn-observation.json', { dynRow, dynRan, dynCallResult: B(3).slice(0, 600), bashRegisterRow: readResults().find((e) => e.leg === 'bash-register') })
    log(`OBSERVATION (disclosed): undeclared dynamic tool h6_dyn_probe: register=${String(dynRow?.ok ?? 'n/a')} body-reachable-at-runtime=${String(dynRan)} (runtime guard abstains on unmanaged names; the setup Coverage Gate is the fail-closed line — recorded as a finding, not a clause gate)`)

    // ══ H-D deny/approval ══
    const denyWrite = R(6)
    const denyTargetContentPost = (() => { try { return readFileSync(DENY_TARGET, 'utf8') } catch { return '<missing>' } })()
    const denyTargetShaPost = sha256(DENY_TARGET)
    const hdDenyOk = (denyWrite.toLowerCase().includes('denied') || denyWrite.toLowerCase().includes('deny') || denyWrite.toLowerCase().includes('permission'))
      && denyTargetContentPost === DENY_BYTES && denyTargetShaPost !== null
    writeEvidence('hd-write-deny.json', { denyWrite: denyWrite.slice(0, 1200), denyTargetUnchanged: denyTargetContentPost === DENY_BYTES, shaAfter: denyTargetShaPost })
    check('HD-deny', 'H-D deny lane: same-name write call on the deny lane = typed rejection; target file bytes UNCHANGED (OS evidence)',
      hdDenyOk, `result=${denyWrite.slice(0, 200)} bytesUnchanged=${String(denyTargetContentPost === DENY_BYTES)}`)
    if (!hdDenyOk) fail('HD-deny')

    const bash1 = R(7)
    const bash2 = R(8)
    const edit1 = R(9)
    const edit2 = R(10)
    const bashOutLines = fileLines(BASH_OUT, BASH_ECHO_MARK)
    const editContentPost = (() => { try { return readFileSync(EDIT_TARGET, 'utf8') } catch { return '<missing>' } })()
    // Approval notifications: notifOf sweep (authoritative rid capture), plus
    // the durable control ledger below as the OS-side channel.
    const notifRids = []
    for (const r of mock.requests) {
      const n = notifOf(r)
      if (n !== null && n.rid !== null && !notifRids.includes(n.rid)) notifRids.push(n.rid)
    }
    // Verbatim list-pending / resolve responses driven through the PUBLIC
    // model-facing team tools (captured from the leader session history).
    const approvalToolResponses = []
    for (const r of mock.requests) {
      for (const res of allToolResultsOf(r)) {
        if (/requestId|pending/i.test(String(res.text)) && String(res.text).includes('ctrl-') && approvalToolResponses.length < 8) {
          approvalToolResponses.push(String(res.text).slice(0, 900))
        }
      }
    }
    writeEvidence('hd-approval-channel-responses.json', approvalToolResponses)
    const ledgerPath = join(HOME, 'storages', 'team_domain.json')
    const controlRows = { requests: [], decisions: [], consumptions: [], error: null }
    try {
      copyFileSync(ledgerPath, join(RUN_DIR, 'h6-team_domain.json.copy'))
      const parsed = JSON.parse(readFileSync(ledgerPath, 'utf8'))
      const tbl = parsed?.tables?.ledger ?? {}
      for (const [k, v] of Object.entries(tbl)) {
        if (k === '__ledger_sequence_counter' || typeof v !== 'string') continue
        let entry
        try { entry = JSON.parse(v) } catch { continue }
        if (String(entry?.rootSessionId) !== CREATE_ROOT) continue
        const payload = entry?.payload ?? {}
        if (entry.factType === 'control-request-recorded') controlRows.requests.push({ requestId: payload.requestId, kind: payload.kind, toolName: payload.toolName, targetInstanceId: payload.targetInstanceId })
        else if (entry.factType === 'control-decision-recorded') controlRows.decisions.push({ requestId: payload.requestId, decision: payload.decision })
        else if (entry.factType === 'control-allow-consumed') controlRows.consumptions.push({ requestId: payload.requestId })
      }
    } catch (e) { controlRows.error = String(e?.message ?? e) }
    writeEvidence('hd-control-ledger.json', { controlRows, notifRids })
    const bashAskRows = controlRows.requests.filter((r) => String(r.toolName) === 'bash')
    const editAskRows = controlRows.requests.filter((r) => String(r.toolName) === 'edit')
    const bashAskIds = [...new Set(bashAskRows.map((r) => r.requestId))]
    const editAskIds = [...new Set(editAskRows.map((r) => r.requestId))]
    const consumedIds = new Set(controlRows.consumptions.map((c) => c.requestId))
    // ENV DISCLOSURE: on this host the persistent-bash body fail-closes at the
    // host sandbox provider ("no sandbox backend is usable"); the ask lane itself
    // (request -> public approval -> dispatch -> consumption) is proven by the
    // bash lane ledger; EXECUTES-ONCE evidence therefore rides the edit lane
    // (in-process fs fence, no kernel backend needed).
    const bashSandboxEnv = bash1.includes('sandbox') ? 'host sandbox backend unusable on this host (bash body fail-closed by the host itself; verbatim in hd-bash-ask.json)' : 'n/a'
    const hdAsk = editContentPost.includes(EDIT_M2) && editAskIds.length === 2
      && editAskIds.every((id) => controlRows.decisions.some((d) => d.requestId === id && d.decision === 'allow'))
      && editAskIds.every((id) => consumedIds.has(id))
      && bashAskIds.length === 2 && bashAskIds.every((id) => consumedIds.has(id))
      && edit1 !== '' && edit2 !== ''
    writeEvidence('hd-ask.json', { bash1: bash1.slice(0, 600), bash2: bash2.slice(0, 600), edit1: edit1.slice(0, 600), edit2: edit2.slice(0, 600), bashOutLines, editContentPost, bashSandboxEnv, notifRids, ledger: controlRows })
    check('HD-ask', 'H-D ask lane: asks became durable leader-approval requests resolved allow through the PUBLIC team tools (no browser); EDIT lane executed exactly once per approval (file shows EDIT_APPLIED_2 whose old-text was EDIT_APPLIED_1 => sequential once-per-approval); bash lane consumed too (body env-blocked by the host sandbox guard, disclosed)',
      hdAsk, `editIds=${JSON.stringify(editAskIds)} bashIds=${JSON.stringify(bashAskIds)} consumed=${String(consumedIds.size)} editContent=${editContentPost.slice(0, 80)} bashEnv=${bashSandboxEnv}`)
    if (!hdAsk) fail('HD-ask')
    const hdOneshot = editAskIds.length === 2 && bashAskIds.length === 2 && notifRids.length >= 4
      && !editAskIds.some((id) => bashAskIds.includes(id))
      && edit2 !== '' && editContentPost.includes(EDIT_M2) && !editContentPost.includes(`${EDIT_M1} line`)
    check('HD-onshot', 'H-D one-shot consumption: every call re-asked (4 distinct durable requestIds + 4 leader notifications; the second edit could only match the text produced by the FIRST approval\'s execution — no standing grant)',
      hdOneshot, `notifRids=${String(notifRids.length)} editIds=${JSON.stringify(editAskIds)} bashIds=${JSON.stringify(bashAskIds)}`)
    if (!hdOneshot) fail('HD-onshot')
  } catch (error) {
    log(`UNCAUGHT in leg sequence: ${String(error?.stack ?? error)}`)
    writeEvidence('uncaught.json', { error: String(error?.message ?? error), stack: redact(String(error?.stack ?? '')) })
  } finally {
    log('teardown: stopping host + mock')
    writeEvidence('instance-tail.txt', logTail(booted.instanceLog, 120))
    if (existsSync(PLUGIN_LOG)) writeEvidence('h6-adapter-plugin.log.copy', readFileSync(PLUGIN_LOG, 'utf8'))
    stopHost(host)
    try { await mock.close() } catch { /* best-effort */ }
    await new Promise((r) => setTimeout(r, 1500))
    const portAfter = await portFree(HOST_PORT)
    const postStable = { p3080: await probeStableInstance('http://127.0.0.1:3080/'), p3180: await probeStableInstance('http://127.0.0.1:3180/') }
    const tuDirty = spawnSync('git', ['status', '--porcelain'], { cwd: TESTUSE, encoding: 'utf8' }).stdout.trim().length
    const tuHead = spawnSync('git', ['rev-parse', 'HEAD'], { cwd: TESTUSE, encoding: 'utf8' }).stdout.trim()
    writeEvidence('post-probes.json', { port3185FreeAfterTeardown: portAfter, postStable, testUsePorcelainLines: tuDirty, testUseHead: tuHead, hostPid: host.pid, hostExited: host.exitInfo.exited })
    const finalBashLines = fileLines(BASH_OUT, BASH_ECHO_MARK)
    if (FLAG_KEEP) log(`--keep: world retained at ${HOME}`)
    else { rmSync(HOME, { recursive: true, force: true }); log(`world removed (${HOME}) — IMPACT RECORD: ephemeral h6 world deleted at teardown (TEST_METHODS §7); full evidence kept in ${RUN_DIR}`) }

    const passed = criteria.filter((c) => c.ok).length
    const verdictOf = (p) => {
      const rows = criteria.filter((c) => c.id.startsWith(p))
      if (rows.length === 0) return 'NOT_RUN'
      return rows.every((c) => c.ok) ? 'PASS' : 'FAIL'
    }
    const summary = {
      runStamp: RUN_STAMP, hostBaseline: HOST_BASELINE_SHA, hostVersion: DSH_BASELINE_VERSION,
      hostPort: HOST_PORT, mockPort: mock.port, hostPid: host.pid, bootTs, teamHead,
      worktree: WORKTREE, criteria, passed, total: criteria.length, failed: FAILS,
      stable: { pre: preStable, post: postStable }, port3185FreeAfterTeardown: portAfter,
      verdict: FAILS.length === 0 ? 'PASS' : 'FAIL',
    }
    writeEvidence('h6-summary.json', summary)
    writeEvidence('mock-requests.json', mock.requests.map((r) => ({ seq: r.seq, userHead: lastUserTextOf(r).slice(0, 110), toolMsgAfterTrigger: toolMsgsOf(r).length, toolCount: (bodyOf(r)?.tools ?? []).length, reply: r.reply })))

    // Versioned qualification table (family x route x host/team/port/world).
    const qual = {
      schema: 'h6.p0-6.go-clauses-qualification/v1',
      generatedAt: new Date().toISOString(),
      qualification: { host: { sha: HOST_BASELINE_SHA, version: DSH_BASELINE_VERSION, bootTs }, teamTreeHead: teamHead, port: HOST_PORT, world: HOME, runStamp: RUN_STAMP },
      env: { node: process.version, os: `${ostype()} ${release()}`, mockModel: 'in-process (deepseek-official/a5p0-model), zero third-party egress' },
      grepImplementation: (() => { const l = readLedger().filter((e) => e.op === 'grep' && e.phase === 'SPAWN'); return l.length > 0 ? String(l[0].impl) : 'not-exercised' })(),
      legs: {
        'H-A fs.read-restricted': { verdict: verdictOf('HA-'), route: 'R1 own-layer shadow (restrict-first) + R3 adapter body (pure node fs, realpath+name fail-closed policy)', counts: { adapterReads: readLedger().filter((e) => e.op === 'read' && e.phase === 'OPEN').length, denies: readLedger().filter((e) => e.op === 'read' && e.phase === 'DENY').length, wireSecretHits }, osEvidence: ['h6-access-ledger.jsonl', 'ha-ledger-snapshot.json'] },
        'H-B fs.search-restricted': { verdict: `${verdictOf('HB-ctl')}/${verdictOf('HB-adapter')}/${verdictOf('HB-equiv')}/${verdictOf('HB-neg')}`, route: 'R1 same-name over builtinToolDeny-masked grep + R3 pinned package-root helpers over public ctx.subprocess', counts: { nativeMultiset: nativeSetSafe(), adapterMultiset: adpSetSafe() }, osEvidence: ['hb-multisets.json', 'h6-access-ledger.jsonl (SPAWN/DENY lines)', 'hb-m3-results.json'] },
        'H-C bash-shield + run_code + assembly': { verdict: `${verdictOf('HC1')}/${verdictOf('HC2')}/${verdictOf('HC3')}`, route: 'builtinToolDeny(restrict@setup) + Team guard; run_code = reserved-registry rejection', counts: { ownBashMarker: existsSync(OWN_BASH_MARKER), runcodeRegisterRejected: (() => { const r = readResults().find((e) => e.leg === 'runcode-register'); return r !== undefined && r.ok === false })() }, osEvidence: ['hc-bash-register-results.json', 'hc-m4-results.json'], observation: { dynToolRow: readResults().find((e) => e.leg === 'dyn-register') ?? null, dynMarkerExists: existsSync(DYN_MARKER) } },
        'H-D deny + ask(one-shot)': { verdict: `${verdictOf('HD-deny')}/${verdictOf('HD-ask')}/${verdictOf('HD-onshot')}`, route: 'Alpha.4 permission lanes (deny) + durable Control plane via PUBLIC team_list_pending_control/team_resolve_control (leader channel)', counts: { bashAskLines: finalBashLines }, osEvidence: ['hd-write-deny.json', 'hd-control-ledger.json', 'h6-team_domain.json.copy (if present)'] },
        assemblyOrder: { verdict: 'OBSERVED', note: 'preset mount(+search row) -> team.create blueprint builtinToolDeny (setup restrict) -> Coverage/Guard pass -> member turn: own-layer restrict-first + same-name register on FIRST armed call (assembly inside the pre-execute pass, dispatch lands on the Adapter; proven pre-arm native call + post-arm adapter call in the SAME call chain) -> Policy/Guard still dominates every own-layer registration (HC2 guard-denied bash; grep adapter passes as unmanaged-reviewable). No competition observed: every leg above rode this order in one boot.' },
      },
      criteria,
    }
    try {
      writeFileSync(join(KIT_DIR, 'h6-result.json'), JSON.stringify(qual, null, 2))
      writeFileSync(join(RUN_DIR, 'h6-result.json'), JSON.stringify(qual, null, 2))
    } catch { /* best-effort */ }
    log(`VERDICT ${summary.verdict} — ${String(passed)}/${String(criteria.length)} criteria${FAILS.length > 0 ? `; failed: ${FAILS.join(',')}` : ''}`)
    try { writeFileSync(join(KIT_DIR, 'h6-KIT_EXIT'), `${String(FAILS.length === 0 ? 0 : 2)}\n`) } catch { /* best-effort */ }
  }

  process.exit(FAILS.length === 0 ? 0 : 2)
}
function nativeSetSafe() { try { return JSON.parse(readFileSync(join(RUN_DIR, 'hb-multisets.json'), 'utf8')).native.length } catch { return -1 } }
function adpSetSafe() { try { return JSON.parse(readFileSync(join(RUN_DIR, 'hb-multisets.json'), 'utf8')).adapter.length } catch { return -1 } }

main().catch((e) => {
  try {
    log(`FATAL uncaught: ${redact(String(e?.stack ?? e))}`)
    writeEvidence('h6-summary.json', { runStamp: RUN_STAMP, fatal: redact(String(e?.message ?? e)), criteria })
    writeFileSync(join(KIT_DIR, 'h6-KIT_EXIT'), '1\n')
  } catch { /* best-effort */ }
  process.exit(1)
})
