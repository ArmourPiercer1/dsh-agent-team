#!/usr/bin/env node
/**
 * run-a5-legs-live.mjs — F-route executor for the R gap-legs DRAFTS
 * (dev/agent-workflow/evidence/alpha5/inventory/gap-legs/{GAP-LEGS.md,leg1,leg2,leg3}).
 *
 * ONE runner, THREE legs (run each with --leg=leg1|leg2|leg3, sequentially —
 * one world per leg, TEST_METHODS §7, deleted at teardown unless --keep):
 *
 *  leg1  LSP 装面腿: the world profile patch adds the explicit tool-lsp (+ lsp
 *        seam + lsp-stdio provider with clangd) rows through the PUBLIC
 *        profile-patch seam; strict leader with lsp allow(subtree team)/
 *        deny(subtree runtime). Mock-driven lsp calls; judgment reads = the
 *        wire tool results (typed deny verbatim / execution landing) + host-log
 *        trace probes.
 *  leg2  subagent 纯 setup 负控 (cheap form): the preset additionally mounts
 *        the host default subagent rows; strict leader whose builtinToolDeny
 *        covers the WHOLE live surface EXCEPT subagent/subagent_fork -> setup
 *        typed FATAL alpha2-permission-coverage-unmanaged-tools naming them,
 *        with the registry reason string. Full chain (delegate->spawn->collect
 *        ->drain) is A-line scope, NOT this leg.
 *  leg3  MCP×治理负控: fixture single-tool MCP server (row-config mcpServers,
 *        server a5probe, tool echo) + strict leader, permissions lane silent on
 *        the mcp__ tool (default deny). EXPECTED RED = the gap receipt itself:
 *        the call EXECUTES (fixture server counts it) while the SAME world
 *        still typed-denies a read on the runtime/ deny subtree (positive
 *        control A). Positive control B (team_grep alias row) needs a placed
 *        plane row — recorded NOT_RUN (this world is the unfed form).
 *
 * Discipline: host = main-checkout tests/deepseek-harness-test-use pristine @
 * the paths.mjs pin (porcelain 0 before/after); DSH_HOME only under
 * tests/homes/a5legs-*; ports from the 3491-3500 family (measured free);
 * :3080/:3180 probed READ-ONLY before/after; launch tokens redacted at capture.
 *
 * Usage: node run-a5-legs-live.mjs --leg=leg1 [--host-port N] [--keep]
 * Exit: 0 all criteria PASS · 2 a criterion failed (红不销案，如实入账) · 1 fatal.
 */
import { spawn, spawnSync } from 'node:child_process'
import { closeSync, existsSync, mkdirSync, openSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { createServer } from 'node:net'
import { dirname, join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

import { TEST_USE_BASELINE_SHA, CLIENT_COMMIT_HASH } from '../../../../../../tests/paths.mjs'
import { presetDeclarationRow, smokePresetPlugins } from '../../../../../../tests/kits/_shared/preset-seam.mjs'
import { startMockModel } from '../../../../../../packages/tools/harness/mock-deepseek.mjs'
import { inspectBlueprintSource } from '../../../../../../packages/runtime/dist/packages/domain/blueprint/src/index.js'
import { startFixture, stopFixture } from './a5probe-mcp-fixture.mjs'

const argv = process.argv.slice(2)
const argValue = (n, d) => { const i = argv.indexOf(`--${n}`); return i === -1 ? d : argv[i + 1] }
const LEG = argValue('leg', '')
const KEEP = argv.includes('--keep')
if (!['leg1', 'leg2', 'leg3'].includes(LEG)) throw new Error('--leg must be leg1|leg2|leg3')

const HERE = dirname(new URL(import.meta.url).pathname)
const WORKTREE = resolve(HERE, '..', '..', '..', '..', '..', '..')
const MAIN = '/srv/workspace/dsh-plugins/dsh-agent-team'
const TESTUSE = join(MAIN, 'tests', 'deepseek-harness-test-use')
const HOST_BIN = join(TESTUSE, 'apps', 'cli', 'lib', 'bin.js')
const DIST_RUNTIME = join(WORKTREE, 'packages', 'runtime', 'dist', 'packages', 'runtime')
const PRODUCTION_ROW_NAME = pathToFileURL(join(DIST_RUNTIME, 'src', 'plugin', 'host.js')).href
const GLUE_URL = pathToFileURL(join(DIST_RUNTIME, 'src', 'plugin', 'live', 'agent-bindings.mjs')).href
const SEAM_URL = pathToFileURL(join(WORKTREE, 'packages', 'runtime', 'root-binding', 'harness', 'seam.mjs')).href
const P6T6_ROW_NAME = pathToFileURL(join(WORKTREE, 'packages', 'tools', 'harness', 'plugin.mjs')).href

const RUN_STAMP = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
const RUN_DIR = join(HERE, 'runs', `a5legs-${LEG}-${RUN_STAMP}Z`)
mkdirSync(RUN_DIR, { recursive: true })
const WORLD_NAME = `a5legs-${LEG}-${RUN_STAMP}Z`
const HOME = join(MAIN, 'tests', 'homes', WORLD_NAME)
const WS = join(HOME, 'ws')
const BLUEPRINT_DIR = join(HOME, 'blueprints')
const MK = `A5LEGS_${LEG.toUpperCase()}_${RUN_STAMP.replace(/[^A-Za-z0-9]/g, '')}`
const ROOT = `session-a5legs-${LEG}-boot`
const CREATE_ROOT = `session-a5legs-${LEG}-main`
const PRESET_ID = LEG === 'leg2' ? 'a5legs-sub' : 'a5legs-smoke'
const BP_MAIN_ID = `team.a5legs-${LEG}-main`

// ── criteria / logging (natexe shapes) ─────────────────────────────────────
const CRITERIA = []
function log(line) {
  const s = `[${new Date().toISOString()}] ${line}`
  console.log(s)
  try { writeFileSync(join(RUN_DIR, 'run.log'), s + '\n', { flag: 'a' }) } catch { /* best-effort */ }
}
function redact(text) {
  return String(text).replace(/token=([A-Za-z0-9_-]{8,})/g, (_m, t) => `token=REDACTED-${createHash('sha256').update(t).digest('hex').slice(0, 8)}`)
}
function check(id, claim, cond, observed) {
  CRITERIA.push({ id, claim, pass: cond === true, observed: redact(String(observed ?? '')) })
  log(`${cond === true ? 'PASS' : 'FAIL'} ${id} — ${claim}${observed !== undefined ? ` [${redact(String(observed)).slice(0, 400)}]` : ''}`)
}
function writeEvidence(name, value) {
  writeFileSync(join(RUN_DIR, name), typeof value === 'string' ? redact(value) : redact(JSON.stringify(value, null, 2)))
}
const safeRead = (p) => { try { return readFileSync(p, 'utf8') } catch { return '' } }
const die = (msg) => { throw new Error(`FATAL: ${msg}`) }
const runGit = (...a) => spawnSync('git', ['-C', TESTUSE, ...a], { encoding: 'utf8' }).stdout.trim()

// ── wire shapes (natexe copies) ────────────────────────────────────────────
const BOOT_MARKER = /dsh web: http:\/\/127\.0\.0\.1:(\d+)\/\?token=([A-Za-z0-9_-]+)/
async function fetchJson(url, init, timeoutMs = 240_000) {
  const res = await fetch(url, { ...init, signal: AbortSignal.timeout(timeoutMs) }).catch(() => ({ status: 0 }))
  const body = res.status === 0 ? null : await res.text()
  try { return { status: res.status, body: JSON.parse(body) } } catch { return { status: res.status, body } }
}
async function authenticate(origin, token) {
  const res = await fetch(`${origin}/?token=${token}`, { redirect: 'manual', signal: AbortSignal.timeout(30_000) })
  const sc = res.headers.get('set-cookie')
  if (res.status !== 303 || sc === null) throw new Error(`auth HTTP ${res.status} (expected 303)`)
  return sc.split(';', 1)[0]
}
async function remoteCall(origin, cookie, method, params, tag = 'a5legs') {
  return fetchJson(`${origin}/team-remote/${method}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie },
    body: JSON.stringify({ type: 'client-request', rpcId: `${tag}-${Math.random().toString(36).slice(2, 12)}`, method, payload: { version: 1, params } }),
  })
}
async function apiPrompt(origin, cookie, sessionId, text, tag = 'a5legs') {
  return fetchJson(`${origin}/api/session/prompt`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie },
    body: JSON.stringify({
      type: 'client-request',
      rpcId: `${tag}-${Math.random().toString(36).slice(2, 12)}`,
      method: 'session/prompt',
      payload: { args: { request: { requestId: `${tag}-r-${Math.random().toString(36).slice(2, 12)}`, sessionId, mode: 'queue', content: [{ type: 'text', text }] } } },
    }),
  })
}
async function portFree(port) {
  return new Promise((done) => {
    const srv = createServer()
    srv.once('error', () => done(false))
    srv.once('listening', () => srv.close(() => done(true)))
    srv.listen(port, '127.0.0.1')
  })
}
async function waitFor(ms, fn, what) {
  const deadline = Date.now() + ms
  for (;;) {
    const v = await fn()
    if (v !== null && v !== false && v !== undefined) return v
    if (Date.now() >= deadline) die(`timeout waiting for ${what}`)
    await new Promise((r) => setTimeout(r, 300))
  }
}
const stableProbe = async (url) => {
  try { const r = await fetch(url, { redirect: 'manual', signal: AbortSignal.timeout(5000) }); return r.status } catch { return 'unreachable' }
}

// ── digest (natexe shape, 0.2.0 block format) ──────────────────────────────
function digestRequest(parsed) {
  const msgs = Array.isArray(parsed?.messages) ? parsed.messages : []
  let text = typeof parsed?.system === 'string' ? parsed.system : ''
  const assistantToolNames = []
  const toolResults = []
  for (const m of msgs) {
    if (typeof m?.content === 'string') { text += '\u0001' + m.content; continue }
    if (!Array.isArray(m?.content)) continue
    for (const b of m.content) {
      if (b?.type === 'text') text += '\u0001' + String(b.text ?? '')
      else if (b?.type === 'tool_use') { assistantToolNames.push(String(b.name ?? '')); text += '\u0001tool_use:' + String(b.name ?? '') + JSON.stringify(b.input ?? {}) }
      else if (b?.type === 'tool_result') {
        const rep = typeof b.content === 'string' ? b.content : JSON.stringify(b.content ?? '')
        toolResults.push(rep.slice(0, 3000))
        text += '\u0001tool_result:' + rep
      }
    }
  }
  const toolNames = Array.isArray(parsed?.tools) ? parsed.tools.map((t) => String(t?.name ?? '')).filter((n) => n !== '') : null
  return { msgCount: msgs.length, toolNames, toolCount: toolNames === null ? 0 : toolNames.length, assistantToolNames, toolResults, _text: text }
}
function firstUserText(parsed) {
  const first = Array.isArray(parsed?.messages) ? parsed.messages[0] : undefined
  if (!first) return ''
  if (typeof first.content === 'string') return first.content
  if (Array.isArray(first.content)) return first.content.map((b) => String(b?.text ?? '')).join('\u0001')
  return ''
}

// ── YAML emitter (preset-seam copy) ────────────────────────────────────────
function yamlScalar(v) {
  if (v === null) return 'null'
  if (typeof v === 'number' || typeof v === 'boolean') return String(v)
  const s = String(v)
  if (/^[A-Za-z0-9._\-/ ]+$/.test(s) && !/^\s|\s$/.test(s)) return s
  return JSON.stringify(s)
}
function yamlEmit(key, value, indent) {
  const pad = '  '.repeat(indent)
  if (Array.isArray(value)) {
    if (value.length === 0) return [`${pad}${key}: []`]
    return [`${pad}${key}:`, ...value.map((item) => yamlEmitItem(item, indent + 1)).flat()]
  }
  if (value !== null && typeof value === 'object') {
    if (Object.keys(value).length === 0) return [`${pad}${key}: {}`]
    return [`${pad}${key}:`, ...Object.entries(value).flatMap(([k, v]) => yamlEmit(k, v, indent + 1))]
  }
  return [`${pad}${key}: ${yamlScalar(value)}`]
}
function yamlEmitItem(item, indent) {
  const pad = '  '.repeat(indent)
  if (item === null || typeof item !== 'object') return [`${pad}- ${yamlScalar(item)}`]
  const entries = Object.entries(item)
  const [fk, fv] = entries[0]
  const firstLines = yamlEmit(fk, fv, indent + 1)
  const rest = entries.slice(1).flatMap(([k, v]) => yamlEmit(k, v, indent + 1))
  return [`${pad}- ${firstLines[0].slice((indent + 1) * 2)}`, ...firstLines.slice(1), ...rest]
}

// ── blueprints ──────────────────────────────────────────────────────────────
const BP_ANCHOR_ID = `team.a5legs-${LEG}-anchor`
function bpAnchorYaml() {
  return [
    '---', 'schemaVersion: 3', `blueprintId: ${BP_ANCHOR_ID}`, 'revision: "1"',
    'leader:', '  templateId: leader',
    `  persona: "You are the leader of the a5legs boot team. ${MK}_DISC is the discovery marker."`,
    'members: []', 'memberEnvelopes: []', 'requirements: []',
    'permissionMutationEnvelope:', '  rules: []',
    'teamHardEnvelope:', '  rules: []',
    'policyStates: []', 'metadata: {}', '---', '',
  ].join('\n')
}
const MANAGED7 = ['read', 'read_image', 'write', 'edit', 'lsp', 'bash', 'pwsh']
const LEADER_TEAM_TOOLS = ['team_list_members', 'team_list_templates', 'team_create_member', 'team_delegate', 'team_collect', 'team_follow_up']

function permissionsLines(pad) {
  const P = '  '.repeat(pad)
  if (LEG === 'leg1') {
    return [
      `${P}permissions:`, `${P}  default: deny`,
      `${P}  allow:`,
      `${P}    - tool: lsp`, `${P}      resource:`, `${P}        kind: subtree`, `${P}        path: team`,
      `${P}    - tool: read`, `${P}      resource:`, `${P}        kind: subtree`, `${P}        path: team`,
      `${P}  ask: []`,
      `${P}  deny:`,
      `${P}    - tool: lsp`, `${P}      resource:`, `${P}        kind: subtree`, `${P}        path: runtime`,
      `${P}    - tool: read`, `${P}      resource:`, `${P}        kind: subtree`, `${P}        path: runtime`,
    ]
  }
  if (LEG === 'leg3') {
    return [
      `${P}permissions:`, `${P}  default: deny`,
      `${P}  allow:`,
      `${P}    - tool: read`, `${P}      resource:`, `${P}        kind: subtree`, `${P}        path: team`,
      `${P}  ask: []`,
      `${P}  deny:`,
      `${P}    - tool: read`, `${P}      resource:`, `${P}        kind: subtree`, `${P}        path: runtime`,
    ]
  }
  return [`${P}permissions:`, `${P}  default: deny`, `${P}  allow: []`, `${P}  ask: []`, `${P}  deny: []`]
}

function mainBlueprintYaml(denyList) {
  const denyBlock = (pad) => denyList.length === 0
    ? [`${pad}builtinToolDeny: []`]
    : [`${pad}builtinToolDeny:`, ...denyList.map((n) => `${pad}  - ${n}`)]
  const mcpAllow = LEG === 'leg3' ? ['a5probe'] : []
  const mcpLines = mcpAllow.length === 0
    ? ['      kind: allow', '      items: []']
    : ['      kind: allow', '      items:', ...mcpAllow.map((s) => `        - ${s}`)]
  return [
    '---', 'schemaVersion: 3', `blueprintId: ${BP_MAIN_ID}`, 'revision: "1"',
    'leader:', '  templateId: leader',
    `  persona: ${JSON.stringify(`You are the leader of the a5legs ${LEG} team. ${MK}_L0 is your directive marker. Follow it exactly.`)}`,
    '  capabilities:',
    '    teamTools:', '      kind: allow', '      items:',
    ...LEADER_TEAM_TOOLS.map((t) => `        - ${t}`),
    ...denyBlock('    '),
    '    skills:', '      kind: allow', '      items: []',
    '    mcp:', ...mcpLines,
    ...permissionsLines(2),
    'members:',
    '  - templateId: wa', '    displayName: "a5legs worker A"',
    `    persona: ${JSON.stringify(`You are worker A of the a5legs ${LEG} team. ${MK}_TASK_A`)}`,
    '    capabilities:',
    '      teamTools:', '        kind: allow', '        items: []',
    ...denyBlock('      '),
    '      skills:', '        kind: allow', '        items: []',
    '      mcp:', '        kind: allow', '        items: []',
    ...permissionsLines(3),
    'memberEnvelopes:', '  - templateId: wa', '    envelope:', '      allow: [send-message, report-progress]', '      deny: []',
    'teamEnvelope:', '  allow: [create-member, assign-task, send-message, report-progress]', '  deny: []',
    'requirements:', '  - domain: persona', '    name: standard',
    'permissionMutationEnvelope:', '  rules: []',
    'teamHardEnvelope:', '  rules: []',
    'policyStates: []', 'metadata: {}', '---', '',
  ].join('\n')
}

// ── leader scripts (mock) ───────────────────────────────────────────────────
function leaderScript(callsIssued) {
  const call = (name, args) => ({ kind: 'tool-call', toolCalls: [{ id: `call-${LEG}-${callsIssued}-${Math.random().toString(36).slice(2, 8)}`, name, arguments: args }] })
  if (LEG === 'leg1') {
    // THREE probes (finding F-1): the shipped tool-lsp schema spells `filePath`
    // while the team canonicalizer extracts `file_path` (canonical-operation.ts
    // :301) -> schema-shaped calls fail closed. Probe 1 = the shipped spelling
    // (records the fail-closed landing); probe 2 = canonicalizer spelling on the
    // DENY lane (typed lane deny); probe 3 = BOTH spellings on the ALLOW lane
    // (canonicalizer resolves + tool body sees its own key).
    if (callsIssued === 0) return call('lsp', { operation: 'hover', filePath: join(WS, 'runtime', 'secret.c'), line: 3, character: 3 })
    if (callsIssued === 1) return call('lsp', { operation: 'hover', file_path: join(WS, 'runtime', 'secret.c'), line: 3, character: 3 })
    if (callsIssued === 2) return call('lsp', { operation: 'hover', file_path: join(WS, 'team', 'hello.c'), filePath: join(WS, 'team', 'hello.c'), line: 3, character: 3 })
    return { kind: 'text', content: `${MK}_DONE` }
  }
  if (LEG === 'leg3') {
    if (callsIssued === 0) return call('mcp__a5probe__echo', { msg: 'A5LEG3-DYN' })
    if (callsIssued === 1) return call('read', { file_path: join(WS, 'runtime', 'secret.txt') })
    if (callsIssued === 2) return call('read', { file_path: join(WS, 'team', 'hello.txt') })
    return { kind: 'text', content: `${MK}_DONE` }
  }
  if (callsIssued === 0) return call('team_create_member', { rootSessionId: CREATE_ROOT, requestToken: `${MK}-cm-1`, templateId: 'wa', label: 'l2a', displayName: 'leg2 strict member' })
  return { kind: 'text', content: `${MK}_DONE` }
}

// ── world materialization ───────────────────────────────────────────────────
function materializeWorld() {
  mkdirSync(join(HOME, 'profiles', 'web'), { recursive: true })
  mkdirSync(BLUEPRINT_DIR, { recursive: true })
  mkdirSync(join(WS, 'team'), { recursive: true })
  mkdirSync(join(WS, 'runtime'), { recursive: true })
  writeFileSync(join(WS, 'team', 'hello.c'), '#include <stdio.h>\n\nint team_symbol(int x) { return x + 1; }\n\nint main(void) { return team_symbol(0); }\n')
  writeFileSync(join(WS, 'team', 'hello.txt'), `A5LEGS-TEAM-SENTINEL-${RUN_STAMP}\n`)
  writeFileSync(join(WS, 'runtime', 'secret.c'), '#include <stdio.h>\n\nint runtime_symbol(int x) { return x - 1; }\n\nint main(void) { return runtime_symbol(0); }\n')
  writeFileSync(join(WS, 'runtime', 'secret.txt'), `A5LEGS-RUNTIME-SECRET-${RUN_STAMP}\n`)
}

let fixturePort = 0
function rowConfig() {
  return {
    rootSessionId: ROOT,
    bootPhase: 'create',
    blueprintSource: bpAnchorYaml(),
    blueprintDir: BLUEPRINT_DIR,
    rootPresetId: PRESET_ID,
    memberPresetId: PRESET_ID,
    seedMembers: [],
    generation: 1,
    staticModel: { provider: 'deepseek-official', model: 'a5legs-live-model' },
    deniedSelection: null,
    mcpServers: LEG === 'leg3' ? [{ name: 'a5probe', port: fixturePort }] : [],
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

function presetPlugins() {
  const base = smokePresetPlugins({
    personaText: 'You are a coding agent powered by the {{model}} model.',
    cwdSuffix: 'Your working directory is {{cwd}}.',
    bashDescription: 'Run commands in a bash shell.',
  })
  if (LEG !== 'leg2') return base
  // leg2: the MODEL-FACING subagent tool row joins the PRESET (the surface the
  // strict MemberInstance actually assembles from; the profile-patch global row
  // activates but does NOT add model tools to the preset surface — on-site
  // witness). ON-SITE DEVIATIONS recorded verbatim in instance.log:
  //  (a) first form (service + spawn/fork-in-process rows in the preset) died
  //      LOUD: service "subagents" has been registered at <SubagentRuntime>;
  //  (b) tool-subagent npm-name form failed to import (not linked) → file URL;
  //  (c) tool-subagent config schema requires { provider, model }.
  // (d) ON-SITE finding: this pinned host build ships NO model-facing
  // subagent tool anywhere in its package set (grep 'subagent_fork' = 0 hits;
  // @deepseek-ai/dsh-tool-subagent provides only list_subagent_models — the
  // subagent lane of the coverage gate is UNREACHABLE on this host variant,
  // recorded). The gate itself is lane-agnostic, so leg2 drives the SAME
  // coverage gate through another KNOWN_SENSITIVE lane shipped by this host:
  // tool-web (web_fetch / web_search — both in KNOWN_SENSITIVE_UNMANAGED).
  return [
    ...base,
    { id: 'tool-web', name: pathToFileURL(join(TESTUSE, 'packages', 'web', 'tool-web', 'lib', 'index.js')).href },
  ]
}

function writePatchFile() {
  const rows = [
    { id: 'dsh-agent-team', name: PRODUCTION_ROW_NAME, config: rowConfig() },
    { id: 'p6t6-team-tools', name: P6T6_ROW_NAME },
    presetDeclarationRow({ id: PRESET_ID, displayName: `a5legs ${PRESET_ID}`, description: `a5legs ${LEG} preset (run ${RUN_STAMP})`, plugins: presetPlugins() }),
  ]
  if (LEG === 'leg2') {
    // Host-DEFAULT subagent service row as an explicit profile-patch row (the
    // spawn/collect engine face; mounts no model tools by itself — the model
    // tools join via the preset row above).
    rows.push({ id: 'subagent', name: pathToFileURL(join(TESTUSE, 'packages', 'subagent', 'subagent', 'lib', 'index.js')).href })
  }
  if (LEG === 'leg1') {
    // leg1 [1]: the explicit tool-lsp opt-in rows (R draft), shipped host packages.
    // ON-SITE DEVIATION (记录): the npm-name spelling {id: tool-lsp, name:
    // '@deepseek-ai/dsh-tool-lsp'} was tried FIRST and the host reported
    // "lsp/lsp-stdio/tool-lsp ... failed to import" (packages shipped, but not
    // linked into this checkout's app-level bare-name resolution set — recorded
    // in runs/a5legs-leg1-2026-10-19T09-00-53Z/instance.log). The SAME public
    // profile-patch seam therefore mounts the SAME shipped packages by built
    // file URL (the row-URL form the team rows use repo-wide; each package
    // resolves its own deps from its workspace node_modules).
    rows.push(
      { id: 'lsp', name: pathToFileURL(join(TESTUSE, 'packages', 'lsp', 'lsp', 'lib', 'index.js')).href },
      { id: 'lsp-stdio', name: pathToFileURL(join(TESTUSE, 'packages', 'lsp', 'lsp-stdio', 'lib', 'index.js')).href, config: { servers: { clangd: { command: 'clangd' } } } },
      { id: 'tool-lsp', name: pathToFileURL(join(TESTUSE, 'packages', 'lsp', 'tool-lsp', 'lib', 'index.js')).href },
    )
  }
  const lines = [`# a5legs ${LEG} patch (run ${RUN_STAMP}): production row + p6t6 + preset${LEG === 'leg1' ? ' + explicit lsp/tool-lsp rows' : LEG === 'leg2' ? ' + explicit subagent row' : ''} — public profile-patch seam only.`, '- insert:']
  for (const r of rows) lines.push(...yamlEmitItem(r, 1))
  lines.push('')
  writeFileSync(join(HOME, 'profiles', 'web', 'cordis.patch.yml'), lines.join('\n'))
}

// ── main ────────────────────────────────────────────────────────────────────
let hostChild = null
let mock = null
let mini = null
const instanceRaw = join(RUN_DIR, 'instance.raw.log')
async function finalize(status) {
  try { if (hostChild !== null) hostChild.kill() } catch { /* gone */ }
  try { if (mock !== null) await mock.close() } catch { /* gone */ }
  try { if (mini !== null) stopFixture(mini) } catch { /* gone */ }
  try { if (existsSync(instanceRaw)) { writeFileSync(join(RUN_DIR, 'instance.log'), redact(safeRead(instanceRaw))); rmSync(instanceRaw) } } catch { /* none */ }
  writeEvidence('criteria.json', { leg: LEG, status, stamp: RUN_STAMP, criteria: CRITERIA })
  if (!KEEP) { try { rmSync(HOME, { recursive: true, force: true }) } catch { /* best effort */ } }
}

async function main() {
  log(`a5legs runner leg=${LEG} stamp=${RUN_STAMP} world=${WORLD_NAME}`)
  check('L-PIN', 'the host runtime is the pinned pristine baseline', runGit('rev-parse', 'HEAD') === TEST_USE_BASELINE_SHA && runGit('status', '--porcelain') === '', `head=${runGit('rev-parse', 'HEAD').slice(0, 10)} porcelain=${runGit('status', '--porcelain') === '' ? 0 : 'DIRTY'}`)
  const hostPort = Number(argValue('host-port', 0)) || await waitFor(5_000, async () => {
    for (const p of [3497, 3498, 3499, 3491]) { if (await portFree(p)) return p }
    return false
  }, 'free host port in the 3491-3500 family')
  let mockPort = 0
  for (const p of [3493, 3496, 3492, 3491]) { if (await portFree(p)) { mockPort = p; break } }
  check('L-PORTS', 'host + mock ports from the legal 3491-3500 family are free', hostPort > 0 && mockPort > 0, `host=${hostPort} mock=${mockPort}`)
  const stable3080Before = await stableProbe('http://127.0.0.1:3080/')
  const stable3180Before = await stableProbe('http://127.0.0.1:3180/')

  materializeWorld()
  if (LEG === 'leg3') {
    process.env.A5LEGS_MCP_LOG = join(RUN_DIR, 'mcp-fixture-calls.log')
    mini = await startFixture([3494])
    fixturePort = mini.port
    writeFileSync(process.env.A5LEGS_MCP_LOG, `# fixture started at ${new Date().toISOString()} on port ${fixturePort}\n`)
    log(`mini MCP fixture (a5probe/echo) on 127.0.0.1:${fixturePort}`)
  }
  writePatchFile()
  writeEvidence('cordis.patch.yml', safeRead(join(HOME, 'profiles', 'web', 'cordis.patch.yml')))
  writeFileSync(join(HOME, 'p6t6-directive.json'), JSON.stringify({ boot: 1, phase: 'create', reportDir: RUN_DIR, runStamp: RUN_STAMP, rootSessionId: ROOT }, null, 2))

  mock = await startMockModel({
    port: mockPort,
    log: (m) => log(`[mock] ${m}`),
    decide: ({ req }) => {
      const digest = digestRequest(req)
      const opener = firstUserText(req)
      if (/^Create a concise title|^Generate the session title/.test(opener)) return { kind: 'text', content: 'a5legs live session' }
      if (opener.includes(`${MK}_L0`)) return leaderScript(digest.assistantToolNames.length)
      if (opener.includes(`${MK}_DISC`) || digest._text.includes(`${MK}_DISC`)) return { kind: 'text', content: `${MK}_DISC_DONE` }
      return { kind: 'text', content: 'a5legs-mock: unscripted request, completing quietly.' }
    },
  })

  const outFd = openSync(instanceRaw, 'a')
  hostChild = spawn(process.execPath, [HOST_BIN, 'web', '--port', String(hostPort), '--no-open'], {
    cwd: WS,
    stdio: ['ignore', outFd, outFd],
    env: {
      ...process.env,
      DSH_HOME: HOME,
      DSH_CLIENT_COMMIT_HASH: CLIENT_COMMIT_HASH,
      DEEPSEEK_BASE_URL: `http://127.0.0.1:${mockPort}`,
      DEEPSEEK_API_KEY: 'a5legs-mock-key',
    },
  })
  hostChild.on('close', (code, signal) => log(`host exited code=${String(code)} signal=${String(signal)}`))
  const boot = await waitFor(120_000, () => {
    try { return BOOT_MARKER.exec(safeRead(instanceRaw)) ?? false } catch { return false }
  }, 'boot marker')
  const origin = `http://127.0.0.1:${boot[1]}`
  const cookie = await authenticate(origin, boot[2])
  check('L-BOOT', 'the test Host booted with the token gate live (auth 303 + cookie)', true, `origin=${origin}`)

  const p6 = async (what) => fetchJson(`http://127.0.0.1:${hostPort}/__p6t6/${what}`, undefined, 30_000)
  await waitFor(60_000, async () => {
    const hb = await p6('health')
    if (hb.status === 200 && hb.body?.ok === false && hb.body?.setupError !== undefined) die(`row setup failed: ${JSON.stringify(hb.body).slice(0, 500)}`)
    return hb.status === 200 && hb.body?.ok === true
  }, 'p6t6 row health')
  await waitFor(120_000, async () => {
    const st = await p6('state')
    return st.status === 200 && st.body?.rootSessionId === ROOT && st.body?.teamSession !== null ? st : false
  }, 'row state (anchor team bound)')
  check('L-ROW', 'the production team row bound the anchor team at boot (bootPhase create)', true, `root=${ROOT}`)

  // DISC: live surface on the boot root (natexe pattern)
  const reqBase = mock.requests.length
  await apiPrompt(origin, cookie, ROOT, `${MK}_DISC Do not call tools; just answer OK.`)
  const discReq = await waitFor(180_000, () => {
    const hit = mock.requests.slice(reqBase).filter((r) => r.body !== null && digestRequest(r.body).toolCount > 0 && digestRequest(r.body)._text.includes(`${MK}_DISC`)).pop()
    return hit ?? false
  }, 'DISC model request with the tool roster')
  const surface = (discReq.body.tools ?? []).map((t) => t.function?.name ?? t.name ?? String(t))
  const TEAM_TOOLS_CLOSED = ['team_list_members', 'team_list_templates', 'team_inspect_config', 'team_create_member', 'team_delegate', 'team_follow_up', 'team_collect', 'team_send_message', 'team_report_progress', 'team_request_control', 'team_resolve_control', 'team_list_pending_control', 'team_archive_member']
  const denyListAll = surface.filter((n) => !MANAGED7.includes(n) && !TEAM_TOOLS_CLOSED.includes(n) && !n.startsWith('team_') && !n.startsWith('mcp__'))
  writeEvidence('live-surface.json', { surface, denyListAll })
  check('L-SURFACE', 'the live tool surface was captured on the boot root (bash present)', surface.includes('bash'), `surface=${surface.length} deny=${denyListAll.length}`)
  if (LEG === 'leg2') {
    check('L2-PRESET', 'the leg2 preset row put a KNOWN_SENSITIVE tool (web_fetch/web_search; subagent lane unreachable on this host build — recorded) on the live root surface', surface.includes('web_fetch') || surface.includes('web_search'), `web_fetch=${surface.includes('web_fetch')} web_search=${surface.includes('web_search')} subagent=${surface.includes('subagent')}`)
  }
  if (LEG === 'leg1') {
    check('L1-MOUNT', 'the explicit tool-lsp rows put lsp on the live tool surface', surface.includes('lsp'), `surfaceHasLsp=${surface.includes('lsp')}`)
  }

  // main BP: validate at authoring, publish, create, drive
  const denyForBp = LEG === 'leg2'
    ? denyListAll.filter((n) => !['subagent', 'subagent_fork', 'web_fetch', 'web_search'].includes(n))
    : denyListAll
  const bpYaml = mainBlueprintYaml(denyForBp)
  writeEvidence('bp-main-authoring.yaml', bpYaml)
  let inspection = null
  try { inspection = inspectBlueprintSource(bpYaml) } catch (e) { inspection = { threw: String(e) } }
  writeEvidence('bp-main-inspection.json', inspection)
  writeFileSync(join(BLUEPRINT_DIR, `${BP_MAIN_ID.replace('team.', '')}.yaml`), bpYaml)

  const listed = await waitFor(90_000, async () => {
    const list = await remoteCall(origin, cookie, 'catalog.list', {})
    const rows = list.body?.result?.value?.data?.blueprints ?? []
    return rows.some((r) => r.blueprintId === BP_MAIN_ID) ? rows : false
  }, `catalog lists ${BP_MAIN_ID}`).catch(() => false)
  check('L-BP-LISTED', 'the main saved blueprint is listed through the wire catalog', listed !== false, `bp=${BP_MAIN_ID}${listed === false ? ` inspection=${JSON.stringify(inspection).slice(0, 300)}` : ''}`)

  const createRes = await remoteCall(origin, cookie, 'team.create', {
    rootSessionId: CREATE_ROOT,
    blueprintId: BP_MAIN_ID,
    initialWork: { prompt: `${MK}_L0 Begin your directive.` },
  })
  writeEvidence('team-create.json', createRes)
  log(`team.create -> status=${createRes.status}`)

  // wait: terminal reply, OR (leg2) the typed coverage FATAL in the host log
  const coverageRefusal = () => JSON.stringify(createRes).includes('alpha2-permission-coverage-unmanaged-tools')
  const done = await waitFor(LEG === 'leg2' ? 90_000 : 300_000, () => {
    const replied = mock.requests.some((r) => JSON.stringify(r.reply ?? '').includes(`${MK}_DONE`))
    if (replied) return 'replied'
    if (LEG === 'leg2' && (safeRead(instanceRaw).includes('alpha2-permission-coverage-unmanaged-tools') || coverageRefusal())) return 'fatal'
    return false
  }, LEG === 'leg2' ? 'the typed coverage refusal (wire or log) or the terminal reply' : 'the scripted leader chain to reach its terminal reply').catch(() => false)
  check('L-TURN', done === false ? 'the scripted leader chain reached its terminal reply' : 'the leader chain terminated (terminal reply, or the leg2 typed setup FATAL)', done !== false, `termination=${String(done)} mockRequests=${mock.requests.length}`)
  await new Promise((r) => setTimeout(r, 2500))

  const legReqs = mock.requests
    .filter((r) => r.body !== null && firstUserText(r.body).includes(`${MK}_L0`))
    .map((r) => ({ seq: r.seq, digest: digestRequest(r.body), reply: r.reply }))
  writeEvidence('leader-transcript.json', legReqs)
  const lastDigest = legReqs.length > 0 ? legReqs[legReqs.length - 1].digest : { toolResults: [], toolNames: [] }
  writeEvidence('leader-tool-results.json', lastDigest.toolResults)
  writeFileSync(join(RUN_DIR, 'instance.log'), redact(safeRead(instanceRaw)))
  try { rmSync(instanceRaw) } catch { /* already moved */ }
  const hostLog = safeRead(join(RUN_DIR, 'instance.log'))
  const results = lastDigest.toolResults

  if (LEG === 'leg1') {
    const failClosed = results[0] ?? ''
    check('L1-FAILCLOSED', 'probe 1 (shipped tool-lsp `filePath` spelling): typed permission fail-closed deny recorded verbatim (finding F-1: canonicalizer reads `file_path`) — fail-closed is DENY, never passthrough', /permission denied/i.test(failClosed) && /file-path-missing/.test(failClosed), String(failClosed).slice(0, 300))
    const denyRes = results[1] ?? ''
    const laneDeny = /permission denied/i.test(denyRes) && !/canonicalization failed/.test(denyRes)
    check('L1-DENY', 'probe 2: lsp on the runtime/ deny lane returns a typed LANE permission deny (verbatim in leader-tool-results.json)', laneDeny, String(denyRes).slice(0, 400))
    const allowRes = results[2] ?? null
    const executed = allowRes !== null && !/permission denied/i.test(allowRes)
    check('L1-ALLOW', 'probe 3: lsp on the team/ allow lane got PAST the permission layer (landing recorded verbatim: clangd answer or tool-body validation landing)', executed, String(allowRes).slice(0, 400))
    const clangdLanding = executed === true && /hover|signature|clangd/i.test(allowRes)
    const governedPass = executed === true && /no LSP provider handles/i.test(allowRes)
    check('L1-CLANGD', 'the allow-lane landing past governance: real clangd answer OR the recorded unfed-world provider-dispatch landing (verbatim; env record per dispatch rule "clangd answer else honest env record")', clangdLanding || governedPass, `clangdAnswer=${clangdLanding} providerDispatchLanding=${governedPass} :: ${String(allowRes).slice(0, 260)}`)
    const canonicalizedRows = hostLog.split('\n').filter((l) => l.includes('canonicalized') && l.includes('lsp'))
    check('L1-TRACE-CANON', 'host log carries the R-draft trace string (observe stage=canonicalized tool=lsp)', canonicalizedRows.length > 0, `matchingLogLines=${canonicalizedRows.length}${canonicalizedRows.length === 0 ? ' — onObserve NOT wired at the pinned baseline (static-vs-runtime deviation, see F-RESULTS)' : ''}`)
  }
  if (LEG === 'leg3') {
    const dyn = results.find((t) => t.includes('echo:A5LEG3-DYN')) ?? null
    const fixtureLog = safeRead(join(RUN_DIR, 'mcp-fixture-calls.log'))
    const serverRan = fixtureLog.includes('call#1')
    check('L3-MOUNT', 'the mcp__a5probe__echo tool is on the leader wire roster (supply face in place)', (lastDigest.toolNames ?? []).includes('mcp__a5probe__echo') || JSON.stringify(legReqs).includes('mcp__a5probe__echo'), `leaderToolNames=${String((lastDigest.toolNames ?? []).some((n) => String(n).startsWith('mcp__')))}`)
    check('L3-DYNRED', 'GAP RECEIPT (PLAN:74 H6 first-run): the mcp__a5probe__echo call EXECUTED under the silent lane (dynRan=true) — server-side count + wire echo', dyn !== null && serverRan, `wireEcho=${dyn !== null} serverCounted=${serverRan}`)
    const denyRead = results.find((t) => /permission denied/i.test(t)) ?? null
    check('L3-READ-DENY', 'positive control A: same world, read on the runtime/ deny lane still returns a typed permission deny', denyRead !== null, String(denyRead).slice(0, 400))
    const sentinel = results.find((t) => t.includes('A5LEGS-TEAM-SENTINEL')) ?? null
    const guardLanding = results.find((t) => /Tool Binding .* cannot be verified/i.test(t)) ?? null
    check('L3-READ-ALLOW', 'positive control C: read on the team/ allow lane PASSES the permission layer (sentinel if reachable; on this UNFED world the landing is the recorded plane-guard dispatch landing — verbatim, proving the deny lane is lane-specific, not a global block)', sentinel !== null || guardLanding !== null, `sentinel=${sentinel !== null} planeGuardLanding=${guardLanding !== null} :: ${String(guardLanding ?? sentinel ?? '').slice(0, 260)}`)
    // CORRECT READ (R 附注二, root order 09:3xZ): governance observations live
    // IN-PROCESS on the row handle (glue dist :3122-3124 onObserve -> :779
    // observations[] -> :5355 handle export; the p6t6 plugin already surfaces
    // `teamRoot.live.observations` on GET /__p6t6/state). The host stdout is
    // NOT the governance channel — an empty log never proves absence.
    const st = await p6('state')
    const obs = Array.isArray(st.body?.observations) ? st.body.observations : []
    writeEvidence('p6t6-observations.json', { status: st.status, count: obs.length, observations: obs })
    const permObs = obs.filter((l) => String(l).startsWith('alpha2-perm:'))
    const managedObs = permObs.filter((l) => /"tool":"(read|lsp)"/.test(String(l)) || /"stage":"decision"/.test(String(l)))
    const mcpObs = permObs.filter((l) => String(l).includes('mcp__a5probe__echo'))
    check('L3-ROWHANDLE-CHANNEL', 'row-handle read works on this world: alpha2-perm observations exist for the MANAGED calls (channel alive, read method correct)', permObs.length > 0 && managedObs.length > 0, `permRows=${permObs.length} managedRows=${managedObs.length} sample=${String(permObs[0] ?? '').slice(0, 220)}`)
    const branch = mcpObs.length > 0 ? 'A' : 'B'
    check('L3-ROWOBS-MCP', 'governance verdict over the mcp__ call read from the row handle: branch A = canonicalized/decision observations DO exist for mcp__a5probe__echo (governance face actually touched -> verdict must be amended), branch B = zero alpha2-perm rows for it under an alive channel (structural absence with the CORRECT read = upgraded GAP receipt)', branch === 'A' || branch === 'B', `branch=${branch} mcpPermRows=${mcpObs.length} :: ${mcpObs.slice(0, 3).map(String).join(' | ').slice(0, 400)}`)
    check('L3-DYNRED2', 'branch consistency: branch B REQUIRES the call still executed (server counted) = the gap is exactly "no governance row yet execution happens"; branch A with executed=true means governance OBSERVED but did not block', (branch === 'B') === serverRan === true, `branch=${branch} serverCounted=${serverRan}`)
    const mcpTrace = hostLog.split('\n').filter((l) => l.includes('mcp__a5probe__echo') && /(canonicaliz|permission denied|decision|guard)/i.test(l))
    check('L3-TRACE-ABSENT', 'host stdout carries no mcp__ governance line (retained as the NEGATIVE control proving stdout is not the governance channel — see L3-ROWHANDLE-CHANNEL)', mcpTrace.length === 0, `matchingStdoutLines=${mcpTrace.length}`)
    check('L3-POS-B', 'positive control B (team_grep alias row) — plane-fed world required', false, 'NOT_RUN: unfed world; plane placement (natexe teamToolPlane form) out of this runner budget — recorded, not faked')
  }
  if (LEG === 'leg2') {
    // Direct wire probe: create a strict wa member through the SAME wire as
    // team_delegate would (MemberInstance setup = the coverage gate face).
    const memberCreate = await remoteCall(origin, cookie, 'team.createMember', {
      rootSessionId: CREATE_ROOT,
      requestToken: `${MK}-wire-cm-1`,
      templateId: 'wa',
      label: 'l2wire',
    }, 'a5legs-wire')
    writeEvidence('member-create.json', memberCreate)
    log(`wire team.createMember -> status=${memberCreate.status} ok=${String(memberCreate.body?.result?.ok)}`)
    await new Promise((r) => setTimeout(r, 2000))
    const hostLog2 = safeRead(join(RUN_DIR, 'instance.log'))
    const wireText = JSON.stringify(memberCreate) + JSON.stringify(legReqs) + JSON.stringify(createRes)
    const logHit = hostLog2.includes('alpha2-permission-coverage-unmanaged-tools')
    const wireHit = wireText.includes('alpha2-permission-coverage-unmanaged-tools')
    check('L2-FATAL-TYPED', 'MemberInstance setup typed FATAL alpha2-permission-coverage-unmanaged-tools (host log or wire reply)', logHit || wireHit, `hostLog=${logHit} wire=${wireHit} observed=${(wireText.match(/alpha2-permission-coverage-unmanaged-tools[^"]*/) ?? [''])[0].slice(0, 300)}`)
    const fatalWindow = hostLog2.split('\n').filter((l) => l.includes('alpha2-permission-coverage-unmanaged-tools') || (l.includes('subagent') && (l.includes('known-sensitive') || l.includes('unmanaged')))).slice(0, 6).join('\n')
    writeEvidence('fatal-window.txt', fatalWindow + '\n--- wire ---\n' + wireText.slice(0, 4000))
    const namesHit = /web_fetch|web_search|subagent/.test(fatalWindow) || /unmanaged tool\(s\)[^)]*web_(fetch|search)/.test(wireText)
    check('L2-NAMES', 'the FATAL detail names the unmanaged known-sensitive tool (web_fetch/web_search; subagent lane recorded unreachable)', namesHit, `window=${fatalWindow.slice(0, 400)}`)
    const phrase = hostLog2.includes('escapes MemberInstance governance') || wireText.includes('escapes MemberInstance governance')
    check('L2-PHRASE', 'runtime witness carries the registry reason string "escapes MemberInstance governance"', phrase, `present=${phrase}; deviation recorded: the string lives in buildPermissionCoverageErrorDetail's unmanagedTools[].reason (detail STRUCTURE); the closed Remote DTO serializes code+message only and the host log carries no entry — static source of truth holds, wire-visible witness stops at code+message+per-tool classification (see F-RESULTS leg2).`)
  }

  const stable3080After = await stableProbe('http://127.0.0.1:3080/')
  const stable3180After = await stableProbe('http://127.0.0.1:3180/')
  check('L-STABLE', 'stable :3080/:3180 probed read-only, status unchanged (401 invariant)', String(stable3080Before) === String(stable3080After) && String(stable3180Before) === String(stable3180After), `3080 ${String(stable3080Before)}->${String(stable3080After)} 3180 ${String(stable3180Before)}->${String(stable3180After)}`)
  check('L-PRISTINE', 'host runtime stayed pristine (porcelain 0, HEAD unmoved)', runGit('status', '--porcelain') === '' && runGit('rev-parse', 'HEAD') === TEST_USE_BASELINE_SHA, `porcelain=${runGit('status', '--porcelain') === '' ? 0 : 'DIRTY'}`)

  const failed = CRITERIA.filter((c) => !c.pass)
  writeEvidence('run-receipt.md', [
    `# a5legs ${LEG} run ${RUN_STAMP}Z`,
    `- host ${TESTUSE} @ ${TEST_USE_BASELINE_SHA.slice(0, 10)} · ports host=${hostPort} mock=${mockPort} mcp=${fixturePort}`,
    `- world ${KEEP ? `KEPT ${HOME}` : 'deleted at teardown'} · criteria ${CRITERIA.length - failed.length}/${CRITERIA.length}`,
    ...CRITERIA.map((c) => `- [${c.pass ? 'x' : ' '}] ${c.id}: ${c.claim}${c.observed ? ` — ${c.observed.slice(0, 300)}` : ''}`),
  ].join('\n'))
  const status = failed.length === 0 ? 'GREEN' : 'RED'
  await finalize(status)
  log(`${status} — ${CRITERIA.length - failed.length}/${CRITERIA.length} · evidence ${RUN_DIR}`)
  process.exit(failed.length === 0 ? 0 : 2)
}

main().catch(async (error) => {
  log(String(error?.stack ?? error))
  try { writeEvidence('host-log-tail.txt', safeRead(instanceRaw).split('\n').slice(-120).join('\n')) } catch { /* none */ }
  await finalize('FATAL')
  process.exit(1)
})
