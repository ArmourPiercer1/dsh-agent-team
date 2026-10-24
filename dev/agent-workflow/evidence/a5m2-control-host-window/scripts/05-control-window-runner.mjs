#!/usr/bin/env node
/**
 * A5M2 CONTROL host-window runner — minimal governed-Control vertical slice
 * (root card 2026-10-29: ONE runnable slice, A's lifecycle verbatim, no new
 * framework, no C1-C5 expansion).
 *
 * SCENARIO (one boot, exactly four governed model turns' worth of tool calls,
 * every Control decision/read as a REAL tool-registry toolCall — RPC rides
 * OBSERVATION ONLY and never decides):
 *   L1 leader  toolCall team_create_member        (A lifecycle, unchanged)
 *   L2 member  toolCall team_request_control      (record 83 via the registry;
 *                                                  durable control-request-recorded)
 *   L3 leader  toolCall team_list_pending_control (record 85 via the registry)
 *              toolCall team_resolve_control ALLOW (record 84 via the registry;
 *                                                  settles L2's request)
 *   L4 member  toolCall edit -> the ask-lane adapter parks ITS request row;
 *              a second leader list+resolve toolCall turn allows it; THE SAME
 *              blocked call consumes it (control-allow-consumed) and the bytes
 *              change. Durable double-check via team.getLedgerPage (product
 *              wire, observation) + read-only team_domain.json scan.
 *
 * BOOT is behind the root's ruling: A5M2_CONTROL_WINDOW=GRANTED. Without it:
 * NOT_RUN receipt, rc 3 (never a green line). A5M2_CONTROL_DRY=1 runs the REAL
 * pre-flight (install -> entry resolution -> patch) to the boot boundary and
 * stops BEFORE any spawn.
 *
 * PRODUCT (mount law exactly as A's fifth-window runner — read from
 * .worktrees/a5m2-wire-g3/.../05-edit-window-runner.mjs, sha256-verified原件):
 *   HOST     = ROOT_DIR/tests/deepseek-harness-test-use (639 CLI tree; the
 *              npm install dir is NEVER the Host).
 *   PRODUCT  = INSTALL_DIR (37646 npm-form fixture, READ-ONLY; no install, no
 *              clone, no chmod): INSTALL_DIR/node_modules/dsh-agent-team
 *              exports['./host'] -> HOST_ENTRY -> cordis profile-patch insert
 *              onto instance.patchFile (the public seam; CORE PATCH BUDGET 0).
 *   PINS     = tgz name/dir-prefix/sha256 triple + driver/product DOUBLE-PIN
 *              (runner-identity.json: this file's git HEAD + file sha256 vs
 *              composed product SHA + pack sha256 + installDir).
 * Fixed (root 2026-10-29): host port 3184, mock port 3499 (PRE-CHECK ONLY,
 * occupied => refuse, NEVER kill foreign); fresh explicit world home
 * tests/homes/a5m2-ctl-hw-<UTC>Z (fail closed if non-empty; NEVER deleted).
 */
import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import { basename, dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { CLIENT_COMMIT_HASH, findTestRepoRoot } from '../../../../../tests/paths.mjs'
import { DshInstance } from '../../../../../tests/characterization/lib/instance.mjs'
import { portInUse, waitForPortFree } from '../../../../../tests/characterization/lib/util.mjs'
import { startMockModel } from '../../../../../packages/tools/harness/mock-deepseek.mjs'

const COMPOSED_SHA = '37646ac288dbd0ee3c998343dc91fd1a8da7a2d5' // root-accepted product (same pack A's fifth window ran)
const EXPECTED_PACK_SHA = 'sha256:3652b2ce19025d0d25d8b661fc08f0a3cb0737bb7b4fbc339fd61a12e2b5fd7c' // root 2026-10-29 receipt (measured equal by B read-only)
const EXPECTED_LOCK_SHA = 'sha256:7685317ff1ba675f6d3f6b012907360579c3c85bd1bc3319d0248483bde3c659' // root receipt (measured equal by B read-only)
const EXPECTED_TGZ_NAME = 'dsh-agent-team-0.1.1-alpha.2.tgz'
const EXPECTED_TGZ_DIR_PREFIX = 'out-37646ac2-'
const PACK_BYTES_MAX = 8_000_000
const HOST_PORT = 3184 // root-pinned for B
const MOCK_PORT = 3499 // root-pinned for B
const WORLD_PREFIX = 'a5m2-ctl-hw'
const BP_ID = 'team.a5m2-ctl-hw'
const WINDOW_GO = process.env.A5M2_CONTROL_WINDOW === 'GRANTED'
const DRY = process.env.A5M2_CONTROL_DRY === '1'
const INSTALL_DIR = process.env.A5M2_CONTROL_INSTALL_DIR
  ?? '/srv/workspace/dsh-plugins/dsh-agent-team/.worktrees/pack-int/install-0a3f11b2' // root 2026-10-29 exact path; absence fail-closes rc3

function notRun(reason) {
  console.log(JSON.stringify({ implemented: true, booted: false, dry: DRY, verdict: 'NOT_RUN', reason }, null, 2))
  process.exit(3) // NOT_RUN is NON-ZERO by root order
}
if (!WINDOW_GO && !DRY) notRun('window env A5M2_CONTROL_WINDOW not GRANTED (root GO pending) — nothing booted')
const envPack = process.env.A5M2_CONTROL_PACK_SHA256
if (envPack !== undefined && envPack !== EXPECTED_PACK_SHA) notRun(`A5M2_CONTROL_PACK_SHA256 ${envPack} is not the root-pinned ${EXPECTED_PACK_SHA}`)

const ROOT_DIR = findTestRepoRoot(dirname(fileURLToPath(import.meta.url)))
if (ROOT_DIR === null) { console.error('findTestRepoRoot returned null'); process.exit(3) }
const HOST_TREE = join(ROOT_DIR, 'tests', 'deepseek-harness-test-use')
if (!existsSync(HOST_TREE)) notRun(`639 host checkout absent at ${HOST_TREE}`)

// ── blueprints (A's lifecycle shapes verbatim; ONLY the worker's teamTools
//    face differs: exactly one member operation, request-control — per the
//    root ruling; NO resolve/self-approve/policy for any member) ────────────
const ANCHOR_V3_YAML = [
  '---', 'schemaVersion: 3', `blueprintId: ${BP_ID}.boot-anchor`, 'revision: "1"',
  'leader:', '  templateId: leader', '  persona: "You are the leader of the A5M2 CONTROL window team."',
  'members:', '  - templateId: ctl-worker', '    persona: "You are a worker of the A5M2 CONTROL window team."',
  'memberEnvelopes: []', 'requirements: []',
  'permissionMutationEnvelope:', '  rules: []',
  'teamHardEnvelope:', '  rules: []',
  'policyStates: []', 'metadata: {}', '---', '',
].join('\n')
const SAVED_BP_V3_YAML = [
  '---', 'schemaVersion: 3', `blueprintId: ${BP_ID}`, 'revision: "1"',
  'leader:', '  templateId: leader', '  persona: "You are the leader of the A5M2 CONTROL window team. Resolve member control requests through your team tools when instructed; keep answers brief."',
  'members:', '  - templateId: ctl-worker',
  '    persona: "You are the control worker. Follow the marker instructions literally and only."',
  '    capabilities:', '      teamTools:', '        kind: allow', '        items:',
  '          - team_request_control', // the ONE member team tool (root ruling: request only)
  '      builtinToolDeny:', // A's isolation list verbatim (exposure-shrink, no ownership claim)
  '        - ask_user_question', '        - create_goal', '        - exit_plan_mode',
  '        - get_goal', '        - glob', '        - grep', '        - job_kill',
  '        - job_list', '        - job_output', '        - present', '        - skill',
  '        - update_goal', '        - web_fetch', '        - web_search', '        - workflow',
  '      skills:', '        kind: deny', '      mcp:', '        kind: deny',
  '      permissions:', '        default: deny', '        allow:',
  '          - tool: read', '            resource:', '              kind: exact',
  `              path: '@@TARGET_ABS@@'`,
  '          - tool: write', '            resource:', '              kind: exact',
  `              path: '@@TARGET_ABS@@'`,
  '        ask:',
  '          - tool: edit', '            resource:', '              kind: any',
  '        deny: []',
  'teamEnvelope:', '  allow:',
  '    - assign-task', '    - create-member', '    - send-message',
  '    - report-progress', '    - request-control', '    - resolve-control',
  '  deny: []',
  // member mutation envelope: request-control ONLY (verified M1 shape, kit
  // :1284-1293 law; validate.js :962-978 schema). NO resolve, NO self-approve.
  'memberEnvelopes:', '  - templateId: ctl-worker', '    envelope:', '      allow:',
  '        - request-control', '      deny: []', 'requirements: []',
  'permissionMutationEnvelope:', '  rules: []',
  'teamHardEnvelope:', '  rules: []',
  'policyStates: []', 'metadata: {}', '---', '',
].join('\n')

const NONCE = Math.random().toString(36).slice(2, 8)
const RUN_STAMP = new Date().toISOString().replace(/[:.]/g, '-')
const HOME = join(ROOT_DIR, 'tests', 'homes', `${WORLD_PREFIX}-${DRY ? 'dry-' : ''}${RUN_STAMP}Z`) // fresh EXPLICIT home (root-pinned law)
const FSROOT = join(HOME, 'fsroot')
const RUN_DIR = join(ROOT_DIR, 'dev', 'agent-workflow', 'evidence', 'a5m2-control-host-window', `runs-${DRY ? 'dry-' : ''}${RUN_STAMP}`)
const TRANSCRIPT = []
const checks = []
const steps = new Map()      // callId -> {step, tool}
const callResults = []       // harvested tool results (THE registry-execution witness)
const memberToolsSeen = []
let currentCriterion = 'setup'
let mock = null
let instance = null
let origin = null
let cookie = null
let currentRoot = null

function log(msg) { console.log(`[ctlhw] ${msg}`) }
function sha256(file) { return `sha256:${createHash('sha256').update(readFileSync(file)).digest('hex')}` }
async function sleep(ms) { return new Promise((r) => setTimeout(r, ms)) }
function check(criterion, name, ok, detail) {
  checks.push({ criterion, name, ok: ok === true, detail: detail === undefined ? null : String(detail).slice(0, 400) })
  log(`check ${criterion}: ${ok ? 'PASS' : 'FAIL'} ${name}${detail ? ` (${String(detail).slice(0, 160)})` : ''}`)
}
async function waitFor(label, budgetMs, fn) {
  const deadline = Date.now() + budgetMs
  for (;;) {
    const v = await fn()
    if (v !== null && v !== undefined && v !== false) return v
    if (Date.now() >= deadline) throw new Error(`timeout waiting for ${label}`)
    await sleep(1500)
  }
}
function finish(code) {
  const pass = checks.every((c) => c.ok) && code === 0
  const summary = {
    runner: '05-control-window-runner.mjs', scenario: 'control-slice', dry: DRY,
    booted: !DRY && instance !== null, verdict: pass ? 'PASS' : (DRY ? 'DRY' : 'FAIL'),
    ports: { host: HOST_PORT, mock: MOCK_PORT }, world: HOME, runDir: RUN_DIR,
    checks, stamps: { nonce: NONCE, runStamp: RUN_STAMP },
  }
  try {
    mkdirSync(RUN_DIR, { recursive: true })
    writeFileSync(join(RUN_DIR, 'summary.json'), JSON.stringify(summary, null, 2))
    writeFileSync(join(RUN_DIR, 'transcript.jsonl'), TRANSCRIPT.map((t) => JSON.stringify(t)).join('\n'))
  } catch { /* evidence best-effort; verdict unchanged */ }
  console.log(JSON.stringify({ verdict: summary.verdict, pass, checks: checks.filter((c) => !c.ok).length, runDir: RUN_DIR }, null, 2))
  process.exit(pass ? 0 : (code === 0 ? 2 : code))
}

// ── f86 fixture reuse (READ-ONLY triple pin, A law verbatim) ───────────────
if (!existsSync(INSTALL_DIR)) notRun(`fixture install dir absent: ${INSTALL_DIR}`)
{
  const fixManifestPath = join(INSTALL_DIR, 'package.json')
  if (!existsSync(fixManifestPath)) { console.error(`fixture manifest absent: ${fixManifestPath}`); process.exit(3) }
  const fixDeps = JSON.parse(readFileSync(fixManifestPath, 'utf8'))?.dependencies?.['dsh-agent-team']
  if (typeof fixDeps !== 'string' || !fixDeps.startsWith('file:')) { console.error(`fixture plugin file: entry missing (got ${JSON.stringify(fixDeps)})`); process.exit(3) }
  const fileTarget = fixDeps.slice('file:'.length)
  const resolvedTgz = fileTarget.startsWith('/') ? fileTarget : resolve(INSTALL_DIR, fileTarget)
  if (basename(resolvedTgz) !== EXPECTED_TGZ_NAME || !basename(dirname(resolvedTgz)).startsWith(EXPECTED_TGZ_DIR_PREFIX)) { console.error(`fixture file: target is NOT the pinned pack (want ${EXPECTED_TGZ_DIR_PREFIX}*/${EXPECTED_TGZ_NAME}): ${resolvedTgz}`); process.exit(3) }
  if (!existsSync(resolvedTgz)) { console.error(`pinned pack tgz absent behind the fixture pointer: ${resolvedTgz}`); process.exit(3) }
  if (statSync(resolvedTgz).size > PACK_BYTES_MAX) { console.error('pack bytes exceed the bound'); process.exit(3) }
  if (sha256(resolvedTgz) !== EXPECTED_PACK_SHA) { console.error(`pack sha256 drifted from the pinned ${EXPECTED_PACK_SHA}`); process.exit(2) }
  if (sha256(join(INSTALL_DIR, 'pnpm-lock.yaml')) !== EXPECTED_LOCK_SHA) { console.error('fixture pnpm-lock.yaml sha256 drifted from the root receipt'); process.exit(2) }
  var tgzPath = resolvedTgz
}
const PKG_DIR_READ = join(INSTALL_DIR, 'node_modules', 'dsh-agent-team')
if (!existsSync(PKG_DIR_READ)) notRun(`f86 fixture not installed (node_modules/dsh-agent-team absent): ${PKG_DIR_READ}`)

function writePatch(patchPath, hostEntryHref) {
  mkdirSync(dirname(patchPath), { recursive: true })
  writeFileSync(patchPath, [
    `- insert:`,
    '    - id: dsh-agent-team',
    `      name: ${JSON.stringify(hostEntryHref)}`,
    '      config:',
    "        bootPhase: 'create'",
    `        rootSessionId: ${JSON.stringify(`session-a5m2ctlhw-boot-${RUN_STAMP}`)}`,
    '        blueprintSource: |-',
    ...ANCHOR_V3_YAML.replace(/\n$/, '').split('\n').map((l) => `          ${l}`),
    `        blueprintDir: ${JSON.stringify(join(HOME, 'blueprints'))}`,
    '        seedMembers: []', '        generation: 1',
    '        staticModel:', '          provider: deepseek-official', '          model: a5m2-control-window-model',
    '        deniedSelection: null', '        mcpServers: []', '        mcpServer: null',
    '        environmentFacts: []', '        externalPolicyFacts:', '          hard: {}', '          capabilityExists: {}',
    '        teamToolPlane:', // the EDIT gate (L4 ask lane needs the governed fs arm): A's closed key + world fs root
    '          editEnabled: true',
    "          realmId: 'a5m2-ctl-hw-realm'",
    '          fsInstance:',
    "            fs: 'a5m2-ctl-hw-fs'",
    `            rootDir: ${JSON.stringify(FSROOT)}`,
    "            realmId: 'a5m2-ctl-hw-realm'",
    "            kind: 'absolute-path'", '',
  ].join('\n'))
}

function resultError(body) {
  const r = body?.result
  if (r === undefined) return { code: 'NO_RESULT', message: String(body).slice(0, 200) }
  if (r.ok !== true) return r.error ?? { code: 'UNKNOWN', message: JSON.stringify(r).slice(0, 200) }
  return null
}
function resultData(body) {
  const r = body?.result
  if (r === undefined || r.ok !== true) return null
  const v = r.value
  if (v && typeof v === 'object' && 'data' in v) return v.data
  return v
}
async function fetchJson(url, init, timeoutMs = 240_000) {
  const res = await fetch(url, { ...init, signal: AbortSignal.timeout(timeoutMs) })
  let body = null
  try { body = await res.json() } catch { /* raw */ }
  return { status: res.status, body }
}
async function remoteCall(method, params, tag, version = 1) { // OBSERVATION ONLY (root law): never decides
  const res = await fetchJson(`${origin}/team-remote/${method}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie },
    body: JSON.stringify({ type: 'client-request', rpcId: `${tag}-${Math.random().toString(36).slice(2, 12)}`, method, payload: { version, params } }),
  })
  TRANSCRIPT.push({ channel: 'team-remote', method, version, params, status: res.status, body: res.body })
  return res
}
async function remoteCallReady(method, params, tag, version = 1, retries = 20) {
  let last = null
  for (let i = 0; i < retries; i += 1) {
    last = await remoteCall(method, params, tag, version)
    if (last.status !== 429) return last
    await sleep(1500)
  }
  return last
}
async function sessionRpc(method, request, tag) {
  const res = await fetchJson(`${origin}/api/session/${method}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie },
    body: JSON.stringify({ type: 'client-request', rpcId: `${tag}-${Math.random().toString(36).slice(2, 12)}`, method: `session/${method}`, payload: { args: { request } } }),
  })
  TRANSCRIPT.push({ channel: 'session-rpc', method, request, status: res.status, body: res.body })
  const err = resultError(res.body)
  if (err !== null) throw new Error(`session/${method} ${tag} failed: ${JSON.stringify(err).slice(0, 300)}`)
  return resultData(res.body)
}
let promptSeq = 0
const apiPrompt = (sessionId, text, tag) => sessionRpc('prompt', { requestId: `ctlhw-prompt-${NONCE}-${tag}-${promptSeq += 1}`, sessionId, mode: 'queue', content: [{ type: 'text', text }] }, tag)

async function teamReadyBarrier(budgetMs = 180_000) {
  const deadline = Date.now() + budgetMs
  for (;;) {
    const res = await remoteCall('team.listRoots', {}, 'ctlhw-ready', 3)
    const err = resultError(res.body)
    if (err === null) return
    const starting = err.code === 'internal-error' && err.details?.reason === 'runtime-not-ready'
    if (!starting) throw new Error(`readiness barrier STOP: ${JSON.stringify(err).slice(0, 300)}`)
    if (Date.now() >= deadline) throw new Error('readiness budget exhausted while starting')
    await sleep(1500)
  }
}
function safeParse(v) {
  if (v === null || v === undefined) return {}
  if (typeof v === 'object') return v
  try { return JSON.parse(v) } catch { return { raw: String(v).slice(0, 400) } }
}
async function controlFacts() { // durable double-check, product wire, OBSERVATION
  const byType = { 'control-request-recorded': [], 'control-decision-recorded': [], 'control-allow-consumed': [], 'control-request-abandoned': [] }
  let afterSequence = 0
  for (let pageNo = 0; pageNo < 50; pageNo += 1) {
    const page = await remoteCallReady('team.getLedgerPage', { teamSessionId: currentRoot, afterSequence, limit: 500 }, `ctlhw-ledger-${pageNo + 1}`, 1)
    const err = resultError(page.body)
    if (err !== null) throw new Error(`team.getLedgerPage failed: ${JSON.stringify(err).slice(0, 200)}`)
    const data = resultData(page.body)
    const entries = Array.isArray(data?.entries) ? data.entries : []
    for (const e of entries) if (byType[e?.factType] !== undefined) byType[e.factType].push({ sequence: e.sequence, payload: safeParse(e.payload) })
    const next = data?.nextAfterSequence
    if (next === null || next === undefined || entries.length === 0) break
    afterSequence = Number(next)
  }
  return byType
}
function domainFacts() { // read-only durable scan: member binding (instanceId + sessionId) for ctl-worker
  const f = join(HOME, 'storages', 'team_domain.json')
  if (!existsSync(f)) return null
  const doc = safeParse(readFileSync(f, 'utf8'))
  // A's two-map law verbatim (05-edit-window-runner domainFacts): member
  // bindings under kind 'team-member', template per instanceId wherever it pairs.
  const memberBindings = new Map()
  const templates = new Map()
  const seen = new Set()
  const walk = (n) => {
    if (typeof n === 'string') { if (n.length > 1 && (n.startsWith('{') || n.startsWith('[')) && !seen.has(n)) { seen.add(n); walk(safeParse(n)) } return }
    if (n === null || typeof n !== 'object') return
    if (Array.isArray(n)) { n.forEach(walk); return }
    if (n.kind === 'team-member' && n.rootSessionId === currentRoot && typeof n.sessionId === 'string' && typeof n.instanceId === 'string') memberBindings.set(n.instanceId, n.sessionId)
    if (typeof n.templateId === 'string' && typeof n.instanceId === 'string') templates.set(n.instanceId, n.templateId)
    for (const v of Object.values(n)) walk(v)
  }
  walk(doc)
  const hits = [...memberBindings.entries()].filter(([i]) => templates.get(i) === 'ctl-worker')
  return hits.length === 1 ? { instanceId: hits[0][0], sessionId: hits[0][1] } : null
}

async function cleanup() {
  const notes = []
  try { if (instance !== null) { await instance.stop(); notes.push('host stopped') } } catch (e) { notes.push(`host-stop ERR ${String(e).slice(0, 120)}`) }
  try { if (mock !== null) { await mock.close(); notes.push('mock closed') } } catch (e) { notes.push(`mock-close ERR ${String(e).slice(0, 120)}`) }
  try { notes.push(`hostPortFree=${await waitForPortFree(HOST_PORT, 20_000)}`) } catch (e) { notes.push('hostPortFree ERR') }
  try { notes.push(`mockPortFree=${await waitForPortFree(MOCK_PORT, 20_000)}`) } catch (e) { notes.push('mockPortFree ERR') }
  notes.push('world retained (root law: NEVER delete HOME/raw)')
  log(`cleanup: ${notes.join(' | ')}`)
  return notes
}

// ── mock model program: Control decisions ride ONLY tool-registry toolCalls ─
function lastUserText(req) {
  const msgs = req?.messages ?? req?.body?.messages ?? []
  for (let i = msgs.length - 1; i >= 0; i -= 1) {
    const m = msgs[i]
    if (m?.role !== 'user') continue
    const c = m.content
    if (typeof c === 'string') return c
    if (Array.isArray(c)) return c.filter((p) => p?.type === 'text').map((p) => p.text ?? '').join('\n')
  }
  return ''
}
function harvest(req) {
  for (const m of req?.messages ?? req?.body?.messages ?? []) {
    if (m?.role === 'tool') {
      const callId = typeof m?.tool_call_id === 'string' ? m.tool_call_id : ''
      if (callId.length > 0 && !callResults.some((r) => r.callId === callId)) {
        const known = steps.get(callId)
        callResults.push({ callId, step: known?.step ?? null, toolName: known?.tool ?? 'unknown', text: typeof m?.content === 'string' ? m.content : JSON.stringify(m?.content ?? '') })
      }
      continue
    }
    if (!Array.isArray(m?.content)) continue
    for (const b of m.content) {
      if (b?.type !== 'tool_result') continue
      const callId = typeof b.tool_use_id === 'string' ? b.tool_use_id : ''
      if (callId.length === 0 || callResults.some((r) => r.callId === callId)) continue
      const known = steps.get(callId)
      if (known === undefined) continue
      callResults.push({ callId, step: known.step, toolName: known.tool, text: typeof b.content === 'string' ? b.content : JSON.stringify(b.content ?? ''), isError: b.is_error === true })
    }
  }
}
function toolsAfterMarker(msgs, markerPrefix) {
  let idx = -1
  for (let i = msgs.length - 1; i >= 0; i -= 1) {
    const m = msgs[i]
    if (m?.role !== 'user') continue
    const c = m.content
    const t = typeof c === 'string' ? c : Array.isArray(c) ? c.filter((p) => p?.type === 'text').map((p) => p.text ?? '').join('\n') : ''
    if (t.startsWith(markerPrefix)) { idx = i; break }
  }
  if (idx === -1) return 0
  let n = 0
  for (let i = idx + 1; i < msgs.length; i += 1) if (msgs[i]?.role === 'tool') n += 1
  return n
}
function toolMsgsAfter(msgs, markerPrefix) {
  let idx = -1
  for (let i = msgs.length - 1; i >= 0; i -= 1) {
    const m = msgs[i]
    if (m?.role !== 'user') continue
    const c = m.content
    const t = typeof c === 'string' ? c : Array.isArray(c) ? c.filter((p) => p?.type === 'text').map((p) => p.text ?? '').join('\n') : ''
    if (t.startsWith(markerPrefix)) { idx = i; break }
  }
  return msgs.slice(idx + 1).filter((m) => m?.role === 'tool')
}
function extractListedRequestId(content) {
  const m = /"requestId"\s*:\s*"([^"]+)"/.exec(String(content))
  return m === null ? null : m[1]
}
function decide({ req }) {
  harvest(req)
  const msgs = req?.messages ?? req?.body?.messages ?? []
  const first = msgs[0]
  const firstText = Array.isArray(first?.content) ? first.content.map((b) => (b !== null && typeof b === 'object' && typeof b.text === 'string' ? b.text : '')).join('') : (typeof first?.content === 'string' ? first.content : '')
  if (firstText.startsWith('Create a concise title') || firstText.startsWith('Generate the session title')) return { kind: 'text', content: 'a5m2 control window session' }
  const text = lastUserText(req)
  const mk = (step, name, args) => {
    const callId = `call-ctlhw-${NONCE}-${step}`
    steps.set(callId, { step, tool: name })
    return { kind: 'tool-call', toolCalls: [{ id: callId, name, arguments: args }] }
  }
  if (text.startsWith(`A5M2-CTLHW-LEADER-CREATE ${NONCE}`)) {
    return toolsAfterMarker(msgs, `A5M2-CTLHW-LEADER-CREATE ${NONCE}`) === 0
      ? mk('leader:create', 'team_create_member', { rootSessionId: currentRoot, requestToken: `ctlhw-create-${NONCE}`, delegationTemplateId: 'ctl-worker', label: 'ctl1' })
      : { kind: 'text', content: `TURN-DONE ${NONCE}` }
  }
  if (text.startsWith(`A5M2-CTLHW-MEMBER-REQ ${NONCE} inst=`)) {
    const inst = /inst=([A-Za-z0-9_-]+)/.exec(text)?.[1] ?? null
    if (inst === null) return { kind: 'text', content: `CTLHW_NO_INST ${NONCE}` }
    return toolsAfterMarker(msgs, `A5M2-CTLHW-MEMBER-REQ ${NONCE}`) === 0
      ? mk('member:req83', 'team_request_control', { rootSessionId: currentRoot, requestToken: `ctlhw-req-${NONCE}`, kind: 'leader-approval', targetInstanceId: inst, actionName: 'ctl-slice-probe', toolName: 'team_request_control', summary: `A5M2-CTLHW-R83 ${NONCE}` })
      : { kind: 'text', content: `TURN-DONE ${NONCE}` }
  }
  if (text.startsWith(`A5M2-CTLHW-LEADER-RESOLVE ${NONCE}`)) {
    const n = toolsAfterMarker(msgs, `A5M2-CTLHW-LEADER-RESOLVE ${NONCE}`)
    if (n === 0) return mk('leader:list85', 'team_list_pending_control', { rootSessionId: currentRoot, requestToken: `ctlhw-list-${NONCE}-${Date.now()}` })
    if (n === 1) {
      const requestId = extractListedRequestId(toolMsgsAfter(msgs, `A5M2-CTLHW-LEADER-RESOLVE ${NONCE}`)[0]?.content)
      if (requestId === null) return { kind: 'text', content: `CTLHW_EXTRACT_FAIL ${NONCE}` }
      return mk('leader:res84', 'team_resolve_control', { rootSessionId: currentRoot, requestToken: `ctlhw-res-${requestId}`, requestId, decision: 'allow', note: 'a5m2-ctlhw model-tool allow' })
    }
    return { kind: 'text', content: `TURN-DONE ${NONCE}` }
  }
  if (text.startsWith(`A5M2-CTLHW-MEMBER-EDIT ${NONCE}`)) {
    return toolsAfterMarker(msgs, `A5M2-CTLHW-MEMBER-EDIT ${NONCE}`) === 0
      ? mk('member:edit', 'edit', { file_path: 'notes.txt', old_string: 'beta', new_string: 'BETA-CTL-CONSUMED' })
      : { kind: 'text', content: `TURN-DONE ${NONCE}` }
  }
  if (text.startsWith('TOOLS-CHECK')) return { kind: 'text', content: `ACK-C0 ${NONCE}` }
  return { kind: 'text', content: `TURN-DONE ${NONCE}` }
}

async function main() {
  currentCriterion = 'preflight'
  const hostBusy = await portInUse(HOST_PORT)
  const mockBusy = await portInUse(MOCK_PORT)
  if (hostBusy || mockBusy) throw new Error(`ports busy at start: host=${hostBusy} mock=${mockBusy} (pinned 3184/3499; never kill foreign)`)
  if (existsSync(HOME) && readdirSync(HOME).length > 0) throw new Error(`home ${HOME} exists non-empty — fail closed`)
  for (const p of [HOME, join(HOME, 'blueprints'), join(HOME, 'storages'), FSROOT, RUN_DIR]) mkdirSync(p, { recursive: true })
  writeFileSync(join(HOME, 'a5m2-ctl-hw-lock.json'), JSON.stringify({ world: HOME, pid: process.pid, runner: '05-control-window-runner.mjs', composedSha: COMPOSED_SHA, packSha256: EXPECTED_PACK_SHA, stamp: RUN_STAMP }, null, 2))
  try {
    const selfSha = execFileSync('git', ['-C', ROOT_DIR, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim()
    writeFileSync(join(RUN_DIR, 'runner-identity.json'), JSON.stringify({ runnerFullSha: selfSha, runnerFileSha256: sha256(fileURLToPath(import.meta.url)), composedSha: COMPOSED_SHA, packTgz: tgzPath, packSha256: EXPECTED_PACK_SHA, installDir: INSTALL_DIR, ports: { host: HOST_PORT, mock: MOCK_PORT } }, null, 2))
  } catch { /* identity best-effort */ }
  writeFileSync(join(FSROOT, 'notes.txt'), 'alpha\nbeta\ngamma\n', 'utf8')

  { // REAL entry resolution from the f86 fixture (READ-ONLY; A's hookup verbatim)
    const installedManifest = JSON.parse(readFileSync(join(PKG_DIR_READ, 'package.json'), 'utf8'))
    const hostExport = installedManifest?.exports?.['./host']
    if (typeof hostExport !== 'string') throw new Error('fixture plugin exports["./host"] missing')
    var HOST_ENTRY = resolve(PKG_DIR_READ, hostExport.replace(/^\.\//, ''))
    if (!existsSync(HOST_ENTRY)) throw new Error(`host entry absent: ${HOST_ENTRY}`)
    log(`plugin entry resolved from the f86 fixture exports['./host']: ${HOST_ENTRY}`)
  }
  writeFileSync(join(HOME, 'blueprints', 'a5m2-ctl-hw.yaml'), SAVED_BP_V3_YAML.replaceAll('@@TARGET_ABS@@', join(FSROOT, 'notes.txt')))

  if (DRY) {
    const dryPatch = join(HOME, 'dry-patch.yml')
    writePatch(dryPatch, pathToFileURL(HOST_ENTRY).href)
    writeFileSync(join(RUN_DIR, 'dry-receipts.json'), JSON.stringify({
      dry: true, reachedBootBoundary: true, booted: false,
      portsAwaited: { host: HOST_PORT, hostIdle: !(await portInUse(HOST_PORT)), mock: MOCK_PORT, mockIdle: !(await portInUse(MOCK_PORT)) },
      manifestEntry: HOST_ENTRY, fsRoot: FSROOT, patchWritten: dryPatch, world: HOME,
    }, null, 2))
    finish(0)
    return
  }

  currentCriterion = 'boot'
  mock = await startMockModel({ port: MOCK_PORT, decide, log: (l) => TRANSCRIPT.push({ channel: 'mock', line: String(l).slice(0, 200) }) })
  process.env.DEEPSEEK_BASE_URL = `http://127.0.0.1:${MOCK_PORT}`
  process.env.DEEPSEEK_API_KEY = `ctlhw-mock-${NONCE}` // non-secret mock-only dummy
  const instLogDir = join(RUN_DIR, 'instance')
  mkdirSync(instLogDir, { recursive: true })
  instance = new DshInstance({ hostTree: HOST_TREE, dshHome: HOME, port: HOST_PORT, clientCommitHash: CLIENT_COMMIT_HASH, logDir: instLogDir })
  writePatch(instance.patchFile, pathToFileURL(HOST_ENTRY).href) // THE mount: install fixture -> public profile-patch seam
  const started = await instance.start({ timeoutMs: 240_000 })
  const m = /^http:\/\/127\.0\.0\.1:(\d+)\/\?token=([A-Za-z0-9_-]+)$/.exec(started.url)
  if (m === null) throw new Error('unexpected boot url shape')
  origin = `http://127.0.0.1:${m[1]}`
  const auth = await fetch(`${origin}/?token=${m[2]}`, { redirect: 'manual', signal: AbortSignal.timeout(30_000) })
  if (auth.status !== 303 || auth.headers.get('set-cookie') === null) throw new Error(`authenticate status=${auth.status}`)
  cookie = auth.headers.get('set-cookie').split(';', 1)[0]
  log(`host booted at ${origin}`)

  currentCriterion = 'setup'
  currentRoot = `session-a5m2ctlhw-p-${RUN_STAMP}`
  await teamReadyBarrier()
  const team = await remoteCall('team.create', { rootSessionId: currentRoot, blueprintId: BP_ID }, 'ctlhw-create', 1)
  if (resultError(team.body) !== null) throw new Error(`team.create: ${JSON.stringify(resultError(team.body)).slice(0, 400)}`)
  await apiPrompt(currentRoot, `A5M2-CTLHW-LEADER-CREATE ${NONCE}`, 'ctlhw-leader-create')
  const member = await waitFor('member binding in team_domain', 120_000, () => domainFacts())
  log(`member instance=${member.instanceId} session=${member.sessionId}`)

  await apiPrompt(member.sessionId, `TOOLS-CHECK ${NONCE}`, 'ctlhw-c0')
  await waitFor('member tool surface', 60_000, () => (memberToolsSeen.length > 0 ? true : null))
  check('E0', 'member surface carries team_request_control', memberToolsSeen.includes('team_request_control'), `visible=${memberToolsSeen.join(',')}`)
  check('E0', 'member surface carries NO team_resolve_control (no self-approve)', !memberToolsSeen.includes('team_resolve_control'), `visible=${memberToolsSeen.join(',')}`)

  // L2: 83 via the registry (member model toolCall)
  currentCriterion = 'L2-83'
  await apiPrompt(member.sessionId, `A5M2-CTLHW-MEMBER-REQ ${NONCE} inst=${member.instanceId}`, 'ctlhw-req')
  const req83Result = await waitFor('team_request_control tool result', 120_000, () => callResults.find((r) => r.step === 'member:req83') ?? null)
  check('L2-83', 'team_request_control EXECUTED through the tool registry (harvested tool result)', req83Result?.isError !== true, String(req83Result?.text).slice(0, 200))
  const facts83 = await waitFor('durable control-request-recorded for R83', 60_000, async () => {
    const byType = await controlFacts()
    const hit = byType['control-request-recorded'].find((e) => String(e.payload?.summary ?? '').includes(`A5M2-CTLHW-R83 ${NONCE}`))
    return hit === undefined ? null : { byType, hit }
  })
  const r83 = facts83.hit.payload.requestId

  // L3: 85 + 84 via the registry (leader model toolCalls: list -> resolve ALLOW)
  currentCriterion = 'L3-85-84'
  await apiPrompt(currentRoot, `A5M2-CTLHW-LEADER-RESOLVE ${NONCE}`, 'ctlhw-resolve1')
  const listResult = await waitFor('team_list_pending_control tool result', 120_000, () => callResults.find((r) => r.step === 'leader:list85') ?? null)
  check('L3-85', 'team_list_pending_control EXECUTED through the tool registry', listResult !== null && listResult.isError !== true, String(listResult?.text).slice(0, 200))
  const resResult = await waitFor('team_resolve_control tool result', 120_000, () => callResults.find((r) => r.step === 'leader:res84') ?? null)
  check('L3-84', 'team_resolve_control EXECUTED through the tool registry (ALLOW)', resResult !== null && resResult.isError !== true, String(resResult?.text).slice(0, 200))
  await waitFor('durable control-decision-recorded for R83', 60_000, async () => {
    const byType = await controlFacts()
    return (byType['control-decision-recorded'] ?? []).some((e) => e.payload?.requestId === r83 && e.payload?.decision === 'allow')
  })
  check('L3', 'L2 request settled by a model-tool decision (durable)', true, `requestId=${r83}`)

  // L4: ask-lane row -> model-tool decision -> THE blocked call consumes it
  currentCriterion = 'L4-consume'
  const target = join(FSROOT, 'notes.txt')
  const shaBefore = sha256(target)
  await apiPrompt(member.sessionId, `A5M2-CTLHW-MEMBER-EDIT ${NONCE}`, 'ctlhw-edit')
  const parked = await waitFor('ask-lane parked a pending request for the blocked edit', 120_000, async () => {
    const byType = await controlFacts()
    const decided = new Set((byType['control-decision-recorded'] ?? []).map((e) => e.payload?.requestId))
    const fresh = (byType['control-request-recorded'] ?? []).map((e) => e.payload?.requestId)
      .filter((r) => typeof r === 'string' && !decided.has(r) && r !== r83)
    return fresh.length > 0 ? fresh[0] : null
  })
  await apiPrompt(currentRoot, `A5M2-CTLHW-LEADER-RESOLVE ${NONCE}`, 'ctlhw-resolve2')
  const consumed = await waitFor('control-allow-consumed for the ask-lane request', 180_000, async () => {
    const byType = await controlFacts()
    return (byType['control-allow-consumed'] ?? []).some((e) => e.payload?.requestId === parked)
  })
  check('L4', 'THE blocked call consumed the model-tool decision (same-call consumption, durable fact)', consumed === true, `requestId=${parked}`)
  const after = await waitFor('edit tool result', 60_000, () => callResults.find((r) => r.step === 'member:edit') ?? null)
  check('L4', 'blocked edit returned OK after consumption', after?.isError !== true, String(after?.text).slice(0, 200))
  check('L4', 'the governed bytes changed on disk', sha256(target) !== shaBefore && readFileSync(target, 'utf8').includes('BETA-CTL-CONSUMED'), `before=${shaBefore.slice(0, 18)} after=${sha256(target).slice(0, 18)}`)

  const finalFacts = await controlFacts()
  check('V', 'ledger: recorded=2 decided=2 consumed=1 (no duplicates)', finalFacts['control-request-recorded'].length === 2 && finalFacts['control-decision-recorded'].length === 2 && finalFacts['control-allow-consumed'].length === 1, `recorded=${finalFacts['control-request-recorded'].length} decided=${finalFacts['control-decision-recorded'].length} consumed=${finalFacts['control-allow-consumed'].length}`)
  check('V', 'decisions were NOT RPC-driven (RPC transcript carries only reads/observation)', !TRANSCRIPT.some((t) => t.channel === 'team-remote' && t.method === 'team.resolveControl'), 'observation-only transcript verified')

  await cleanup()
  finish(0)
}

main().then(() => { /* finish() exits */ }, async (err) => {
  log(`FATAL: ${String(err?.stack ?? err).slice(0, 600)}`)
  try { await cleanup() } catch { /* keep evidence */ }
  checks.push({ criterion: 'fatal', name: 'runner completed', ok: false, detail: String(err?.message ?? err).slice(0, 400) })
  finish(1)
})
