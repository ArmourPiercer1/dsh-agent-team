/**
 * A5M2-G6 SESSION-QUERY — real-Host functional kit (root kit authorization;
 * capacity-disciplined: SOURCE-ONLY file, mounts the ALREADY-VERIFIED
 * installed 874 pack, zero new dependency closure, zero /__p6t6/* surface).
 *
 * ACCEPTANCE PLANE (root 22:4x, binding): every action and read-back
 * travels a PRODUCTION wire:
 *   - turns:       POST /api/session/prompt (DSH core public channel)
 *   - model:       packages/tools/harness/mock-deepseek.mjs served at
 *                  $DEEPSEEK_BASE_URL (the host's `deepseek-official`
 *                  provider resolves its base URL from that trusted env
 *                  layer — pr-d kit :1473-1480 prior art), scripted decide
 *                  oracle + recorder, Anthropic block wire at 0.2.0-rc.2
 *   - team plane:  POST /team-remote/<method>: team.create,
 *                  team.getLedgerPage v1 (durable facts, limit 1..500),
 *                  team.resolveControl v4 (human fallback only; the PRIMARY
 *                  PA resolve is the leader's own team_resolve_control MODEL
 *                  tool, driven through mock turns)
 *   - the p6t6 observability row is NOT mounted; the profile dump is
 *     asserted CLEAN of it (a leak = fatal).
 *
 * PRODUCTION ROW: mounted via the public profile-patch seam ONLY
 * (<dshHome>/profiles/web/cordis.patch.yml), pointing at the APPROVED
 * INSTALLED 874 pack (fixture node_modules realpaths; identity chain
 * tgz sha256 eda06b4a… -> lock 26bf7e77… -> hardlinked install -> cold ESM
 * RC=0). glueUrl/seamUrl are the pack's own root-binding pair (mirror of
 * run.mjs:368-370 geometry, resolved INSIDE the dist mirror as required).
 *
 * CASES (root's fixed five-query scope; one boot; halt-first discipline):
 *   C1  P session_trace own session (rides PA pairing: first gated call ->
 *          durable control-request -> leader team_list_pending_control +
 *          team_resolve_control(allow) via MODEL tools -> retry -> serve)
 *   C2  P session_event_trace own            C2b P session_event_read
 *   C3  P session_event_search (census)      C4  P session_search current
 *   C5  P member child session (ceiling+)    C6  N foreign session deny
 *   C7  N archived member (team_archive_member first) deny
 *   C8  N NO_CURRENT_STEP (fresh member w2, first turn, current scope)
 *   C9  N caller drift — NO public entry point exists (host.ts supply
 *          :2349-2357 lazy accessors; wiring canonicalValue law) ->
 *          NOT-ATTEMPTED-with-reason; NO hook forged (root law)
 *   C10 N unknown target -> SESSION_QUERY_SESSION_NOT_FOUND
 *
 * GATES: pre-flight BEFORE any boot; refuses on any failure. Ports: the
 * ruled 3186=WEB + 3187=MOCK endpoints, fixed (no fallback, no scan range;
 * 3080/3180-3184/3497 blacklisted). Budget: pre-launch verify + phase rechecks
 * of task-new allocated vs the 250MB total-world account; the 200MB cap is
 * the separate recovery-increment account. Budget: teardown = st_blocks×512 deduped by (dev,ino),
 * own-exclusive = nlink <= in-world refs, dirs separate; FAIL above 200MB.
 *
 * USAGE: `node g6-host-kit.mjs [--boot] [--port 3186]` — WITHOUT --boot the
 * kit runs pre-flight + case-table validation only (exit 0 = ready-to-boot).
 * EXIT: 0 all pass; 2 a case failed / budget; 1 fatal.
 */

import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, readdirSync, realpathSync, statSync, statfsSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { pathToFileURL, fileURLToPath } from 'node:url'
import { startMockModel } from '../../../../../packages/tools/harness/mock-deepseek.mjs'
import { DshInstance } from '../../../../../tests/characterization/lib/instance.mjs'
import { portInUse, waitForPortFree } from '../../../../../tests/characterization/lib/util.mjs'
import { captureGitState } from '../../../../../tests/characterization/lib/tree-clean.mjs'
import { CLIENT_COMMIT_HASH, TEST_USE_BASELINE_SHA } from '../../../../../tests/paths.mjs'

// ── CLI / constants ─────────────────────────────────────────────────────────

const args = process.argv.slice(2)
const argValue = (name, dflt) => { const i = args.indexOf(name); return i >= 0 && args[i + 1] !== undefined ? args[i + 1] : dflt }
const DO_BOOT = args.includes('--boot')
const BASE_PORT = Number(argValue('--port', 3186))
const MOCK_PORT_FIXED = Number(argValue('--mock-port', 3187))
const BLACKLIST_PORTS = new Set([3080, 3180, 3181, 3182, 3183, 3184, 3497])

// Lane law: world + evidence live in THIS worktree. findTestRepoRoot climbs
// to the MAIN tree when the worktree lacks its own test-use marker (it does
// here) — pinning the root from the kit's own location avoids the cross-tree
// misplacement (root 23:1x capacity discipline: no peer bytes upward).
const KIT_DIR = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = resolve(KIT_DIR, '../../../../..')
// Host runtime tree: the worktree's own pristine checkout first (absent in
// this lane), else the MAIN tree's pinned test-use checkout used STRICTLY
// READ-ONLY (boot spawns its built bin.js; every write lands in DSH_HOME =
// tests/homes/<world> inside this worktree). Precheck pins head + porcelain.
const HOST_TREE_CANDIDATES = [
  join(REPO_ROOT, 'tests/deepseek-harness-test-use'),
  '/srv/workspace/dsh-plugins/dsh-agent-team/tests/deepseek-harness-test-use',
]
const HOST_TREE = HOST_TREE_CANDIDATES.find((t) => existsSync(join(t, 'apps/cli/lib/bin.js')))
const RUN_STAMP = new Date().toISOString().replace(/[:.]/g, '-')
const EVIDENCE_ROOT = resolve(argValue('--evidence-dir', join(REPO_ROOT, 'dev/agent-workflow/evidence/a5m2-g6host')))
const RUN_DIR = join(EVIDENCE_ROOT, `run-${RUN_STAMP}`)
const WORLD = join(REPO_ROOT, 'tests/homes', `.a5m2-g6host-${RUN_STAMP}Z`)
const FIXTURE_INSTALL = '/srv/workspace/dsh-plugins/dsh-agent-team/.worktrees/a5m2-wire-g6/tests/homes/.a5m2-g6rc874-fixture-20261023T22-06-00Z/install'
const LOCK_SHA_EXPECTED = '26bf7e77050090eaf194e4a06904ce26c6eb9972c4e260f807e8d2e48cd659bc'
const PACK_TGZ = '/srv/workspace/dsh-plugins/dsh-agent-team/.worktrees/pack-int/out-874f3ae0d-20261023T213601Z/dsh-agent-team-0.1.1-alpha.2.tgz'
const PACK_SHA_EXPECTED = 'eda06b4a78bba180c0acef1b25237f3f741917385cd0728ee66adc737b1cd09d'
const BUDGET_CAP_BYTES = 200 * 1024 * 1024
// Root 23:2x: the 200MB cap is THIS recovery's increment; total test budget
// and projected run growth must be verified BEFORE launch, not only found at
// teardown. Preflight therefore refuses when free space is under the floor
// and records the ledger of known heavy scenes.
const MIN_FREE_BYTES = Number(argValue('--min-free-bytes', 5 * 1024 * 1024 * 1024))
// Root 23:2x: the approved TOTAL-WORLD budget (250MB) and the recovery
// increment (200MB) are SEPARATE accounts; the free-floor and scene ledger
// do NOT substitute for increment accounting. Before launch the kit verifies
// THIS TASK's new allocated vs remaining world budget and re-checks at key
// phases; exceeding stops the relevant steps (budgetHalt), never the scene.
const TASK_WORLD_CAP_BYTES = Number(argValue('--task-cap-bytes', 250 * 1024 * 1024))
const RECOVERY_CAP_BYTES = 200 * 1024 * 1024
const RECOVERY_RECORD_BYTES = 46465024 + 21999616 // root-law accounting of the 874-install scene, measured 22:4xZ
const MISLANDED_EVIDENCE_DIRS = [
  '/srv/workspace/dsh-plugins/dsh-agent-team/dev/agent-workflow/evidence/a5m2-g6host/run-2026-10-23T22-56-46-169Z',
  '/srv/workspace/dsh-plugins/dsh-agent-team/dev/agent-workflow/evidence/a5m2-g6host/run-2026-10-23T22-57-03-336Z',
]
function taskNewAllocated() {
  let n = 0
  for (const d of [RUN_DIR, WORLD, ...MISLANDED_EVIDENCE_DIRS]) { try { n += allocatedFootprint(d).totalAllocated } catch { /* absent */ } }
  return n
}
const SCENE_LEDGER = [
  ['frozen-512-scene-dev-pnp-store', '/srv/workspace/dsh-plugins/dsh-agent-team/.worktrees/a5m2-wire-g6/dev/.pnp-store'],
  ['frozen-512-scene-plugin-install', '/srv/workspace/dsh-plugins/dsh-agent-team/.worktrees/a5m2-wire-g6/dev/plugin-install'],
  ['approved-install-874-fixture', FIXTURE_INSTALL],
  ['r18-store(protected)', '/srv/workspace/dsh-plugins/dsh-agent-team/tests/homes/.pnpmm-r18-store'],
]

const PACK_ROOT = realpathSync(join(FIXTURE_INSTALL, 'node_modules/dsh-agent-team'))
const INSTALLED_HOST_JS = realpathSync(join(PACK_ROOT, 'packages/runtime/dist/packages/runtime/src/plugin/host.js'))
const INSTALLED_GLUE = realpathSync(join(PACK_ROOT, 'packages/runtime/dist/packages/runtime/src/plugin/live/agent-bindings.mjs'))
const INSTALLED_SEAM = realpathSync(join(PACK_ROOT, 'packages/runtime/root-binding/harness/seam.mjs'))
const PRODUCTION_ROW_NAME = pathToFileURL(INSTALLED_HOST_JS).href

const ROOT_G6 = `session-team-g6-${RUN_STAMP.slice(0, 15)}`
const NONCE = Math.random().toString(36).slice(2, 10)
const BLUEPRINT_ID = 'g6-query-bp'

const results = []
const transcript = []
const log = (m) => console.log(`[g6-kit ${new Date().toISOString().slice(11, 19)}] ${m}`)
async function dieFatal(msg) {
  try { mkdirSync(RUN_DIR, { recursive: true }) } catch { /* best effort */ }
  try { writeFileSync(join(RUN_DIR, 'FATAL.json'), JSON.stringify({ fatal: String(msg).slice(0, 2000), results, transcript: transcript.slice(-40) }, null, 2)) } catch { /* best effort */ }
  log(`FATAL: ${String(msg).slice(0, 400)}`)
  process.exit(1)
}

// ── G6 result codes (source-pinned @ lane HEAD: g6-session-query{,-wiring}.mjs) ──

const G6 = {
  CEILING: 'P_G6_TEAM_CEILING_DENY',
  UNAUTHORIZED: 'SESSION_QUERY_TOOL_UNAUTHORIZED',
  NOT_FOUND: 'SESSION_QUERY_SESSION_NOT_FOUND',
  NO_STEP: 'SESSION_QUERY_TOOL_NO_CURRENT_STEP',
  DRIFT: 'P_G6_CALLER_DRIFT',
}
const DENY_TOKENS = [G6.CEILING, G6.UNAUTHORIZED, G6.NOT_FOUND, G6.NO_STEP]

// ── blueprint (inline bootstrap anchor; LEGACY templates => the full
// thirteen-tool catalog inherited; envelope carries control + lifecycle) ──

const BLUEPRINT_YAML = `---
schemaVersion: 1
blueprintId: ${BLUEPRINT_ID}
revision: "1"
displayName: "G6 session-query acceptance world"
description: "One boot; leader + archivable worker w1 + fresh worker w2 (C8)."
leader:
  templateId: leader
  persona: "You lead this team. Follow the scripted instructions literally; never improvise extra tool calls."
members:
  - templateId: worker
    displayName: "Worker"
    persona: "You are a worker. Do exactly what each prompt says and answer briefly."
requirements:
  - domain: persona
    name: standard
teamEnvelope:
  allow: [assign-task, create-member, send-message, report-progress, request-control, resolve-control, archive-member, restore-member]
  deny: []
policyStates:
  - id: default
    description: "Default state."
quotas:
  team: { maxInstances: 4, maxConcurrent: 3 }
  members: { maxInstances: 2, maxConcurrent: 2 }
metadata: {}
---
`

// ── HTTP helpers (production wires; shapes mirrored from pr-d kit) ─────────

async function fetchJson(url, init, timeoutMs) {
  const res = await fetch(url, { ...init, signal: AbortSignal.timeout(timeoutMs) })
  const text = await res.text()
  let body = null
  try { body = text === '' ? null : JSON.parse(text) } catch { body = { nonJsonBody: text.slice(0, 800) } }
  return { status: res.status, body }
}
async function authenticate(origin, token) {
  const res = await fetch(`${origin}/?token=${token}`, { redirect: 'manual', signal: AbortSignal.timeout(30_000) })
  const setCookie = res.headers.get('set-cookie')
  if (res.status !== 303 || setCookie === null) throw new Error(`auth returned HTTP ${res.status} (expected 303 + set-cookie)`)
  return setCookie.split(';', 1)[0]
}
const scrub = (t) => String(t ?? '').replace(/\/\?token=([A-Za-z0-9_-]+)/g, '/?token=<S>').replace(/("token"\s*:\s*")[A-Za-z0-9_-]+(")/g, '$1<S>$2')
const noteTranscript = (e) => transcript.push({ at: new Date().toISOString(), ...e })
async function remoteCall(origin, cookie, method, params, tag, version = 1, timeoutMs = 180_000) {
  const res = await fetchJson(`${origin}/team-remote/${method}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie },
    body: JSON.stringify({ type: 'client-request', rpcId: `${tag}-${Math.random().toString(36).slice(2, 12)}`, method, payload: { version, params } }),
  }, timeoutMs)
  noteTranscript({ method, status: res.status, body: scrub(JSON.stringify(res.body)).slice(0, 400) })
  return res
}
async function remoteCallReady(host, method, params, tag, version = 1, retries = 20) {
  let last = null
  for (let i = 0; i < retries; i += 1) {
    last = await remoteCall(host.origin, host.cookie, method, params, tag, version)
    if (last.status !== 429) return last
    await new Promise((r) => setTimeout(r, 1500))
  }
  return last
}
const resultError = (body) => { const r = body?.result; if (r === undefined) return { code: 'NO_RESULT', message: String(body).slice(0, 200) }; return r.ok === true ? null : (r.error ?? { code: 'UNKNOWN', message: JSON.stringify(r).slice(0, 200) }) }
const resultData = (body) => { const r = body?.result; if (r === undefined || r.ok !== true) return null; const v = r.value; return v && typeof v === 'object' && 'data' in v ? v.data : v }
async function apiPrompt(origin, cookie, sessionId, text, tag) {
  const res = await fetchJson(`${origin}/api/session/prompt`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie },
    body: JSON.stringify({ type: 'client-request', rpcId: `${tag}-${Math.random().toString(36).slice(2, 12)}`, method: 'session/prompt', payload: { args: { request: { requestId: `${tag}-${Math.random().toString(36).slice(2, 12)}`, sessionId, mode: 'queue', content: [{ type: 'text', text }] } } } }),
  }, 240_000)
  noteTranscript({ method: 'session/prompt', sessionId, text: String(text).slice(0, 160), status: res.status })
  return res
}

// ── mock oracle (0.2.0-rc.2 /v1/messages block wire; tool_result nested in
// role:user messages — f15 §wire note honored) ──────────────────────────────

const toolCall = (name, argumentsObj) => ({ kind: 'tool-call', toolCalls: [{ id: `call-g6-${Math.random().toString(36).slice(2, 10)}`, name, arguments: argumentsObj }] })
const bodyOf = (x) => (x !== null && typeof x === 'object' ? ('body' in x ? (x.body ?? null) : x) : null)
const messagesOf = (req) => bodyOf(req)?.messages ?? []
function toolResultBlocks(msgs) {
  const out = []
  for (const m of msgs) {
    const c = m?.content
    if (!Array.isArray(c)) continue
    for (const b of c) if (b?.type === 'tool_result') out.push({ tool_use_id: b.tool_use_id, text: typeof b.content === 'string' ? b.content : JSON.stringify(b.content ?? '') })
  }
  return out
}
async function waitForMock(mock, pred, timeoutMs, label) {
  const deadline = Date.now() + timeoutMs
  for (;;) {
    const hit = mock.requests.find((r) => { try { return pred(r) } catch { return false } })
    if (hit !== undefined) return hit
    if (Date.now() >= deadline) { noteTranscript({ waitTimeout: label, requests: mock.requests.length }); return null }
    await new Promise((r) => setTimeout(r, 250))
  }
}

// ── scenario state + scripted decide ────────────────────────────────────────

const S = { w1: null, w1Child: null, w2: null, w2Child: null, firstEventSeq: null }
const MK = {
  CREATE_W1: `G6_MK_CREATE_W1_${NONCE}`, CREATE_W2: `G6_MK_CREATE_W2_${NONCE}`,
  WORK_W1: `G6_MK_WORK_W1_${NONCE}`, ARCHIVE_W1: `G6_MK_ARCHIVE_W1_${NONCE}`,
  PAIR_RESOLVE: `G6_MK_PAIR_RESOLVE_${NONCE}`,
}
const doneTag = (c) => `G6_DONE_${c}_${NONCE}`
const toolSeq = new Map()
const caseAllowance = new Map()
const bump = (k) => { const n = toolSeq.get(k) ?? 0; toolSeq.set(k, n + 1); return n }

function decide({ req }) {
  const msgs = messagesOf(req)
  const lastUser = [...msgs].reverse().find((m) => m?.role === 'user')
  const userText = Array.isArray(lastUser?.content) ? lastUser.content.filter((b) => b?.type === 'text').map((b) => b.text ?? '').join(' ') : String(lastUser?.content ?? '')
  const lastResultText = toolResultBlocks(msgs).at(-1)?.text ?? ''

  if (userText.includes(MK.CREATE_W1) || userText.includes(MK.CREATE_W2)) {
    const which = userText.includes(MK.CREATE_W1) ? 'w1' : 'w2'
    const key = `create_${which}`
    if ((toolSeq.get(key) ?? 0) === 0) {
      bump(key)
      return toolCall('team_create_member', { rootSessionId: ROOT_G6, requestToken: `g6-create-${which}-${NONCE}`, delegationTemplateId: 'worker', label: which })
    }
    const id = /inst-[A-Za-z0-9_-]+/.exec(lastResultText)?.[0] ?? null
    if (id === null) return { kind: 'text', content: `G6_CREATE_EXTRACT_FAIL :: ${lastResultText.slice(0, 200)}` }
    const child = /session-team-child-[A-Za-z0-9_-]+/.exec(lastResultText)?.[0] ?? null
    if (which === 'w1') { S.w1 = id; if (child !== null) S.w1Child = child } else { S.w2 = id; if (child !== null) S.w2Child = child }
    return { kind: 'text', content: doneTag(`CREATE_${which.toUpperCase()}`) }
  }
  if (userText.includes(MK.WORK_W1)) {
    if ((toolSeq.get('work_w1') ?? 0) === 0) {
      bump('work_w1')
      return toolCall('team_delegate', { rootSessionId: ROOT_G6, requestToken: `g6-work-w1-${NONCE}`, delegationInstanceId: S.w1, prompt: 'Say exactly: WORKER_STEP_DONE', taskSummary: 'g6 w1 real activity', async: false })
    }
    return { kind: 'text', content: doneTag('WORK_W1') }
  }
  if (userText.includes(MK.ARCHIVE_W1)) {
    if ((toolSeq.get('archive_w1') ?? 0) === 0) {
      bump('archive_w1')
      return toolCall('team_archive_member', { rootSessionId: ROOT_G6, requestToken: `g6-archive-w1-${NONCE}`, targetInstanceId: S.w1 })
    }
    return { kind: 'text', content: doneTag('ARCHIVE_W1') }
  }
  if (userText.includes(MK.PAIR_RESOLVE)) {
    if ((toolSeq.get('pair') ?? 0) === 0) {
      bump('pair')
      return toolCall('team_list_pending_control', { rootSessionId: ROOT_G6, requestToken: `g6-pending-${NONCE}` })
    }
    const reqId = /"requestId"\s*:\s*"([^"]+)"/.exec(lastResultText)?.[1] ?? null
    if (reqId === null) return { kind: 'text', content: `G6_PAIR_ID_EXTRACT_FAIL :: ${lastResultText.slice(0, 200)}` }
    bump('pair_resolved')
    return toolCall('team_resolve_control', { rootSessionId: ROOT_G6, requestToken: `g6-resolve-${NONCE}`, requestId: reqId, decision: 'allow' })
  }
  if (userText.includes('G6_CASE ')) {
    const caseId = /G6_CASE (C\d+[a-z]?)/.exec(userText)?.[1] ?? 'C?'
    const spec = CASES.find((c) => c.id === caseId)
    if (spec === undefined) return { kind: 'text', content: `G6_UNKNOWN_CASE ${caseId}` }
    const k = `${caseId}_call`
    const allow = caseAllowance.get(caseId) ?? spec.maxToolCalls ?? 1
    if ((toolSeq.get(k) ?? 0) < allow) {
      bump(k)
      return toolCall(spec.tool, typeof spec.input === 'function' ? spec.input() : spec.input)
    }
    return { kind: 'text', content: `${doneTag(caseId)} :: ${lastResultText.slice(0, 600)}` }
  }
  if (userText.includes('WORKER_STEP_DONE')) return { kind: 'text', content: 'WORKER_STEP_DONE' }
  return { kind: 'text', content: 'G6_IDLE' }
}

// ── the case table (inputs are data; expectations source-pinned) ───────────

const CASES = [
  { id: 'C1', tool: 'session_trace', input: () => ({ session_id: ROOT_G6 }), expect: 'ok' },
  { id: 'C2', tool: 'session_event_trace', input: () => ({ session_id: ROOT_G6 }), expect: 'ok' },
  { id: 'C2b', tool: 'session_event_read', input: () => ({ session_id: ROOT_G6, ...(S.firstEventSeq !== null ? { seq: S.firstEventSeq } : {}) }), expect: 'ok' },
  { id: 'C3', tool: 'session_event_search', input: () => ({ session_id: ROOT_G6, query: `G6_MARKER_${NONCE}` }), expect: 'ok' },
  { id: 'C4', tool: 'session_search', input: () => ({ query: `G6_MARKER_${NONCE}` }), expect: 'ok' }, // NO session_id -> caller default (:1331 args.session_id ?? caller) = the REAL current-session clamp
  { id: 'C5', tool: 'session_trace', input: () => ({ session_id: S.w1Child }), expect: 'ok' },
  { id: 'C6', tool: 'session_trace', input: () => ({ session_id: 'session-foreign-not-in-team-9f3c' }), expect: 'deny', anyOf: [G6.CEILING, G6.UNAUTHORIZED] },
  { id: 'C7', tool: 'session_trace', input: () => ({ session_id: S.w1Child }), expect: 'deny', anyOf: [G6.CEILING, G6.UNAUTHORIZED] },
  { id: 'C8', tool: 'session_search', input: () => ({ query: 'anything' }), expect: 'deny', anyOf: [G6.NO_STEP] },
  { id: 'C10', tool: 'session_trace', input: () => ({ session_id: 'session-does-not-exist-000000' }), expect: 'deny', anyOf: [G6.NOT_FOUND] },
]
// C9 = caller drift: verified at source level that NO public surface flips the
// exec-owner/caller snapshot (host.ts :2349-2357 lazy public accessors; the
// wiring canonicalValue(callerSnapshot) law). Recorded NOT-ATTEMPTED; no
// observation hook is forged (root law).

// ── profile patch (ONE production row through the public seam) ─────────────

const yamlScalar = (v) => (typeof v === 'string' && /^[\w./:@+-]+$/.test(v) ? v : JSON.stringify(v))
function writeG6PatchFile(patchPath) {
  mkdirSync(dirname(patchPath), { recursive: true })
  const rowConfig = {
    bootPhase: 'create',
    rootSessionId: ROOT_G6,
    blueprintSource: BLUEPRINT_YAML,
    generation: 1,
    seedMembers: [],
    staticModel: { provider: 'deepseek-official', model: 'g6-model-v1' },
    glueUrl: pathToFileURL(INSTALLED_GLUE).href,
    seamUrl: pathToFileURL(INSTALLED_SEAM).href,
  }
  const lines = [
    '# A5M2-G6 kit patch layer: the production dsh-agent-team row (APPROVED INSTALLED 874 pack) mounted ONLY through the public profile-patch seam.',
    '- insert:',
    '  - id: dsh-agent-team',
    `    name: ${yamlScalar(PRODUCTION_ROW_NAME)}`,
    '    config:',
    ...Object.entries(rowConfig).map(([k, v]) => `      ${k}: ${typeof v === 'object' ? JSON.stringify(v) : yamlScalar(v)}`),
    '',
  ]
  writeFileSync(patchPath, lines.join('\n'))
  return rowConfig
}

// ── pre-flight (no boot; refuses on any failure) ───────────────────────────

const sha256File = (p) => createHash('sha256').update(readFileSync(p)).digest('hex')
async function runPrechecks() {
  const checks = []
  const ck = (name, ok, detail) => { checks.push({ name, ok, detail: String(detail ?? '').slice(0, 300) }); if (!ok) throw new Error(`precheck FAILED: ${name} :: ${detail}`) }
  if (HOST_TREE === undefined) throw new Error('precheck FAILED: no host runtime tree with a built apps/cli/lib/bin.js among the candidates')
  mkdirSync(join(RUN_DIR, 'git-pre'), { recursive: true })
  const ht = await captureGitState(HOST_TREE, join(RUN_DIR, 'git-pre'))
  ck('host-tree-porcelain-empty', (ht.porcelain ?? ht.status ?? '') === '' || ht.statusEmpty === true, JSON.stringify(ht).slice(0, 160))
  ck('host-tree-baseline-sha', (ht.head ?? '') === TEST_USE_BASELINE_SHA || String(ht.head ?? '').startsWith(TEST_USE_BASELINE_SHA.slice(0, 12)), `head=${ht.head} pinned=${TEST_USE_BASELINE_SHA}`)
  const wt = await captureGitState(REPO_ROOT, join(RUN_DIR, 'git-pre'))
  ck('lane-head-recorded', /^[0-9a-f]{40}$/.test(String(wt.head ?? '')), `head=${wt.head}`)
  ck('install-lock-26bf7', sha256File(join(FIXTURE_INSTALL, 'pnpm-lock.yaml')) === LOCK_SHA_EXPECTED, '')
  ck('pack-tgz-eda06b4a', sha256File(PACK_TGZ) === PACK_SHA_EXPECTED, '')
  ck('installed-host-present', existsSync(INSTALLED_HOST_JS), INSTALLED_HOST_JS)
  ck('installed-glue-present', existsSync(INSTALLED_GLUE), INSTALLED_GLUE)
  ck('installed-seam-present', existsSync(INSTALLED_SEAM), INSTALLED_SEAM)
  ck('world-absent', !existsSync(WORLD), WORLD)
  const lockf = join(REPO_ROOT, 'tests/homes', `${WORLD_NAME_CLEAN}.lock`)
  ck('world-lockfile-absent', !existsSync(lockf), lockf)
  // portInUse is ASYNC (connect-probe): await it; never a sync truthiness test.
  const freePort = async (cands) => {
    for (const p of cands) {
      if (BLACKLIST_PORTS.has(p)) continue
      if (!(await portInUse(p))) return p
    }
    return undefined
  }
  const st = statfsSync(REPO_ROOT)
  const freeBytes = Number(st.bavail) * Number(st.bsize)
  ck('disk-free-floor', freeBytes >= MIN_FREE_BYTES, `free=${freeBytes} floor=${MIN_FREE_BYTES}`)
  const sceneLedger = SCENE_LEDGER.map(([name, path]) => {
    let bytes = 0
    try { bytes = allocatedFootprint(path).totalAllocated } catch { /* absent = 0 */ }
    return { name, path, allocatedApprox: bytes }
  })
  ck('scene-ledger-recorded', true, JSON.stringify(sceneLedger.map((x) => `${x.name}=${x.allocatedApprox}B`)).slice(0, 280))
  // Root 23:2x: the ruled window 3186/3187 = web + mock ENDPOINTS (not two
  // web candidates). Fixed minimal configuration; NO extra scan ranges. A
  // busy web port is a refusal, not a fallback. The 3191-alternative applies
  // only on EVIDENCED occupancy of 3187 by another approved lane (root 23:02)
  // — none observed; this kit then refuses rather than self-widening.
  const port = await freePort([BASE_PORT])
  if (port === undefined) throw new Error(`web port ${BASE_PORT} busy/blacklisted — refusing (3187 is the mock endpoint, not a web fallback)`)
  const mockPort = MOCK_PORT_FIXED === port ? undefined : await freePort([MOCK_PORT_FIXED])
  if (mockPort === undefined) throw new Error(`mock port ${MOCK_PORT_FIXED} busy/blacklisted/equals-web — refusing (no self-widening; occupancy conflict evidence needed for an alternative per root 23:02)`)
  return { port, mockPort, hostTree: HOST_TREE, freeBytes, minFreeBytes: MIN_FREE_BYTES, sceneLedger, checks, row: { name: PRODUCTION_ROW_NAME, glue: INSTALLED_GLUE, seam: INSTALLED_SEAM }, rootSessionId: ROOT_G6 }
}
const WORLD_NAME_CLEAN = `.a5m2-g6host-${RUN_STAMP}Z`.replace(/^\./, '')

// ── allocated footprint (root accounting law) ──────────────────────────────

function allocatedFootprint(root) {
  const seen = new Map() // dev:ino -> {blocks, nlink, refs}
  const dirs = new Map()
  const stack = [root]
  while (stack.length > 0) {
    const d = stack.pop()
    let entries = []
    try { entries = readdirSync(d, { withFileTypes: true }) } catch { continue }
    for (const e of entries) {
      const p = join(d, e.name)
      let st
      try { st = statSync(p) } catch { continue }
      if (e.isDirectory()) { if (!dirs.has(st.ino)) dirs.set(st.ino, st.blocks); stack.push(p); continue }
      if (!e.isFile()) continue
      const k = `${st.dev}:${st.ino}`
      const rec = seen.get(k)
      if (rec === undefined) seen.set(k, { blocks: st.blocks, nlink: st.nlink, refs: 1 })
      else rec.refs += 1
    }
  }
  let own = 0, shared = 0, total = 0
  for (const { blocks, nlink, refs } of seen.values()) { const b = blocks * 512; total += b; if (nlink <= refs) own += b; else shared += b }
  let dirBytes = 0
  for (const blocks of dirs.values()) dirBytes += blocks * 512
  return { files: seen.size, totalAllocated: total, ownExclusiveAllocated: own, externallySharedAllocated: shared, dirs: dirs.size, dirBytes }
}

// ── main ────────────────────────────────────────────────────────────────────

async function main() {
  mkdirSync(RUN_DIR, { recursive: true })
  const pre = await runPrechecks()
  writeFileSync(join(RUN_DIR, 'prechecks.json'), JSON.stringify({ ...pre, cases: CASES.map((c) => ({ id: c.id, tool: c.tool, expect: c.expect })), boot: DO_BOOT }, null, 2))
  log(`pre-checks PASS (web ${pre.port}, mock ${pre.mockPort}); production row = installed 874 pack`)
  if (!DO_BOOT) { writeFileSync(join(RUN_DIR, 'READY-TO-BOOT.json'), JSON.stringify({ ready: true, note: 'no --boot given; nothing spawned' }, null, 2)); log('pre-flight-only mode: READY-TO-BOOT, exit 0'); return }

  // PRE-LAUNCH budget verification (root 23:2x): this task's new allocated
  // vs the remaining TOTAL-WORLD budget, recorded before anything spawns.
  const budgetPre = taskNewAllocated()
  writeFileSync(join(RUN_DIR, 'budget-preboot.json'), JSON.stringify({ taskNewAllocatedBytes: budgetPre, taskWorldCapBytes: TASK_WORLD_CAP_BYTES, remainingBytes: TASK_WORLD_CAP_BYTES - budgetPre, recoveryAccount: { capBytes: RECOVERY_CAP_BYTES, recordedNewAllocatedBytes: RECOVERY_RECORD_BYTES, status: RECOVERY_RECORD_BYTES <= RECOVERY_CAP_BYTES ? 'under-cap (recorded at root 23:2x)' : 'OVER — root action' } }, null, 2))
  log(`pre-launch budget: task-new ${budgetPre}B / world-cap ${TASK_WORLD_CAP_BYTES}B (recovery account separate: ${RECOVERY_RECORD_BYTES}B / ${RECOVERY_CAP_BYTES}B)`)
  if (budgetPre >= TASK_WORLD_CAP_BYTES) throw new Error(`pre-launch budget REFUSAL: task-new ${budgetPre}B >= world cap ${TASK_WORLD_CAP_BYTES}B`)

  // model endpoint wiring (pr-d :1473-1480 prior art): the trusted env layer
  // the host's deepseek-official provider reads for its base URL.
  process.env.DEEPSEEK_BASE_URL = `http://127.0.0.1:${pre.mockPort}`
  process.env.DEEPSEEK_API_KEY = `g6-mock-${NONCE}`
  const mock = await startMockModel({ port: pre.mockPort, decide, log: (l) => log(`mock: ${l}`), fixtures: { dir: join(RUN_DIR, 'model-fixtures'), maxTextLength: 1600 } })

  const instance = new DshInstance({ hostTree: HOST_TREE, dshHome: WORLD, port: pre.port, clientCommitHash: CLIENT_COMMIT_HASH, logDir: join(RUN_DIR, 'instances') })
  mkdirSync(WORLD, { recursive: true })
  const rowConfig = writeG6PatchFile(instance.patchFile)
  writeFileSync(join(RUN_DIR, 'row-config.json'), JSON.stringify({ ...rowConfig, blueprintSource: '<inline BLUEPRINT_YAML>' }, null, 2))
  const started = await instance.start({ timeoutMs: 240_000 })
  const m = /^http:\/\/127\.0\.0\.1:(\d+)\/\?token=([A-Za-z0-9_-]+)$/.exec(started.url)
  if (m === null) await dieFatal('unexpected boot url shape')
  const origin = `http://127.0.0.1:${m[1]}`
  const cookie = await authenticate(origin, m[2])
  const host = { origin, cookie }
  log(`host up at ${origin} (token scrubbed); cookie exchanged`)

  const dump = await instance.dumpConfig({ timeoutMs: 60_000 })
  writeFileSync(join(RUN_DIR, 'dump-config.txt'), dump.text)
  if (!DshInstance.rowInDump(dump.text, { id: 'dsh-agent-team', name: PRODUCTION_ROW_NAME })) await dieFatal('production row NOT in composed profile dump')
  if (dump.text.includes('p6t6')) await dieFatal('p6t6 surface leaked into the profile — acceptance plane must be production-only')

  const createP = await remoteCallReady(host, 'team.create', { rootSessionId: ROOT_G6, blueprintId: BLUEPRINT_ID }, 'g6-create', 1)
  if (resultError(createP.body) !== null) await dieFatal(`team.create failed: ${JSON.stringify(resultError(createP.body)).slice(0, 400)}`)
  log(`team created at ${ROOT_G6} (product wire)`)

  const ledgerEntries = async (tag) => resultData((await remoteCallReady(host, 'team.getLedgerPage', { teamSessionId: ROOT_G6, afterSequence: 0, limit: 500 }, tag, 1)).body)?.entries ?? []

  const runCaseTurn = async (c, sessionId) => {
    const before = mock.requests.length
    const t = await apiPrompt(origin, cookie, sessionId, `G6_CASE ${c.id} Then answer one line.`, `g6-${c.id}`)
    if (!(t.status === 200 && t.body?.result?.ok === true)) return { status: 'TURN_NOT_ADMITTED', raw: JSON.stringify(t.body).slice(0, 300) }
    const done = await waitForMock(mock, (r) => r.reply?.kind === 'text' && String(r.reply?.content ?? '').startsWith(doneTag(c.id)), 240_000, `${c.id} done`)
    if (done === null) return { status: 'TURN_TIMEOUT' }
    const tr = mock.requests.slice(before).flatMap((r) => toolResultBlocks(messagesOf(r)))
    return { status: 'DONE', toolResult: tr.at(-1)?.text ?? '', toolResults: tr.length }
  }
  const resolvePairingIfNeeded = async (tag) => {
    const entries = await ledgerEntries(tag)
    const asText = (e) => (typeof e?.payload === 'string' ? e.payload : JSON.stringify(e?.payload ?? {}))
    const openReq = [...entries].reverse().find((e) => e?.factType === 'control-request-recorded')
    if (openReq === undefined) return 'none-open'
    const reqIdRaw = /"requestId"\s*:\s*"([^"]+)"/.exec(asText(openReq))?.[1] ?? null
    const already = reqIdRaw !== null && entries.some((e) => e?.factType === 'control-decision-recorded' && asText(e).includes(reqIdRaw))
    if (already) return 'already-resolved'
    const t = await apiPrompt(origin, cookie, ROOT_G6, `${MK.PAIR_RESOLVE} List pending control requests and resolve the pairing request with allow.`, 'g6-pair')
    if (!(t.status === 200 && t.body?.result?.ok === true)) await dieFatal('pairing resolve turn not admitted')
    const ok = await waitForMock(mock, (r) => r.reply?.kind === 'text' && String(r.reply?.content ?? '').includes('control-resolved'), 240_000, 'pair settle')
    if (ok === null) await dieFatal('pairing resolve chain did not settle (leader model tools)')
    return 'resolved-via-leader-model-tools'
  }

  // ── world build (real session/member activity only) ──────────────────────
  for (const [marker, done, tag] of [[MK.CREATE_W1, doneTag('CREATE_W1'), 'g6-seed'], [MK.WORK_W1, doneTag('WORK_W1'), 'g6-work'], [MK.CREATE_W2, doneTag('CREATE_W2'), 'g6-seed2']]) {
    const t = await apiPrompt(origin, cookie, ROOT_G6, `${marker} Follow the scripted tool chain.`, tag)
    if (!(t.status === 200 && t.body?.result?.ok === true)) await dieFatal(`seed turn not admitted (${tag})`)
    if ((await waitForMock(mock, (r) => r.reply?.content === done, 240_000, tag)) === null) await dieFatal(`seed chain did not settle (${tag})`)
  }
  const entriesAfterSeed = await ledgerEntries('g6-ledger-seed')
  if (S.w1Child === null || S.w2Child === null) {
    const childSessions = [...new Set((entriesAfterSeed.map((e) => JSON.stringify(e.payload)).join(' ').match(/session-team-child-[A-Za-z0-9_-]+/g) ?? []).filter((s) => s !== ROOT_G6))]
    if (S.w1Child === null) S.w1Child = childSessions[0] ?? null
    if (S.w2Child === null) S.w2Child = childSessions.length > 1 ? childSessions[childSessions.length - 1] : null
  }
  if (S.w1Child === null) await dieFatal('member child session id not observable in durable ledger facts')

  // ── cases on the leader (P) session ──────────────────────────────────────
  let budgetHalt = false
  const phaseBudgetCheck = (where) => {
    const b = taskNewAllocated()
    writeFileSync(join(RUN_DIR, `budget-${where}.json`), JSON.stringify({ at: new Date().toISOString(), where, taskNewAllocatedBytes: b, taskWorldCapBytes: TASK_WORLD_CAP_BYTES }, null, 2))
    if (b >= TASK_WORLD_CAP_BYTES) { budgetHalt = true; log(`BUDGET-HALT at ${where}: task-new ${b}B >= cap ${TASK_WORLD_CAP_BYTES}B — remaining case steps STOPPED`) }
  }
  phaseBudgetCheck('post-boot')
  let c1 = await runCaseTurn(CASES[0], ROOT_G6)
  if (c1.status === 'DONE' && DENY_TOKENS.some((d) => c1.toolResult.includes(d))) {
    const how = await resolvePairingIfNeeded('g6-ledger-pair')
    log(`C1 gated -> pairing ${how}; retrying (allowance 2)`)
    caseAllowance.set('C1', 2)
    c1 = await runCaseTurn(CASES[0], ROOT_G6)
    c1.paired = how
  }
  results.push({ id: 'C1', ...c1, expect: CASES[0].expect })
  for (const id of ['C2', 'C3', 'C4', 'C5', 'C6', 'C10']) {
    const c = CASES.find((x) => x.id === id)
    const r = await runCaseTurn(c, ROOT_G6)
    results.push({ id, ...r, expect: c.expect, anyOf: c.anyOf })
    if (id === 'C2') {
      S.firstEventSeq = Number(/"seq"\s*:\s*(\d+)/.exec(r.toolResult ?? '')?.[1] ?? /seq (\d+)/.exec(r.toolResult ?? '')?.[1] ?? '') || null
      const c2b = await runCaseTurn(CASES.find((x) => x.id === 'C2b'), ROOT_G6)
      results.push({ id: 'C2b', ...c2b, expect: 'ok' })
    }
    await resolvePairingIfNeeded(`g6-ledger-${id}`) // a NEW realm may gate a fresh pairing
    if (budgetHalt) break
    phaseBudgetCheck(`case-${id}`)
  }

  // C7: archive w1 (leader MODEL tool), then leader queries the archived child.
  const at = await apiPrompt(origin, cookie, ROOT_G6, `${MK.ARCHIVE_W1} Archive w1.`, 'g6-archive')
  if (!(at.status === 200 && at.body?.result?.ok === true) || (await waitForMock(mock, (r) => r.reply?.content === doneTag('ARCHIVE_W1'), 240_000, 'archive')) === null) await dieFatal('archive chain failed')
  const r7 = await runCaseTurn(CASES.find((x) => x.id === 'C7'), ROOT_G6)
  const c7 = CASES.find((x) => x.id === 'C7')
  results.push({ id: 'C7', ...r7, expect: 'deny', anyOf: c7.anyOf })

  // C8: fresh w2 FIRST turn on its own child session (no committed step).
  if (S.w2Child === null) { results.push({ id: 'C8', status: 'NOT_ATTEMPTED', reason: 'w2 child session id not observable; refusing to fake the target' }) }
  else {
    const r8 = await runCaseTurn(CASES.find((x) => x.id === 'C8'), S.w2Child)
    results.push({ id: 'C8', ...r8, expect: 'deny', session: S.w2Child })
  }

  // C9: NOT-ATTEMPTED with the source-level reason (no hook forged).
  results.push({ id: 'C9', status: 'NOT_ATTEMPTED', reason: 'no public surface flips exec-owner/caller snapshot (host.ts supply :2349-2357; wiring canonicalValue(callerSnapshot) law); forging a test hook violates the acceptance-plane law' })

  // ── durable cross-check + verdicts ───────────────────────────────────────
  writeFileSync(join(RUN_DIR, 'ledger-final.json'), JSON.stringify(await ledgerEntries('g6-ledger-final'), null, 2))
  const verdicts = results.map((r) => {
    if (r.status === 'NOT_ATTEMPTED') return { id: r.id, verdict: 'NOT_ATTEMPTED', reason: r.reason }
    if (r.status !== 'DONE') return { id: r.id, verdict: 'FAIL', why: r.status, raw: r.raw ?? '' }
    const text = r.toolResult ?? ''
    const hit = (r.anyOf ?? DENY_TOKENS).filter((d) => text.includes(d))
    const pass = r.expect === 'deny' ? hit.length > 0 : (hit.length === 0 && DENY_TOKENS.every((d) => !text.includes(d)) && text.length > 0)
    return { id: r.id, verdict: pass ? 'PASS' : 'FAIL', expect: r.expect, observed: text.slice(0, 240) }
  })
  writeFileSync(join(RUN_DIR, 'results.json'), JSON.stringify({ results, verdicts, transcript: transcript.slice(-150) }, null, 2))

  // ── teardown + budget ────────────────────────────────────────────────────
  let stopInfo = null
  try { stopInfo = await instance.stop({ timeoutMs: 30_000 }); log(`host stopped (killed=${stopInfo.killed} portFree=${stopInfo.portFree})`) } finally { try { await mock.close() } catch { /* port check below is authoritative */ } }
  await waitForPortFree(pre.port, 30_000).catch(() => log('WARN port not free 30s after stop'))
  const fp = allocatedFootprint(WORLD)
  writeFileSync(join(RUN_DIR, 'footprint.json'), JSON.stringify({ world: WORLD, ...fp, recoveryIncrementCap: BUDGET_CAP_BYTES, taskNewAllocatedBytes: taskNewAllocated(), taskWorldCapBytes: TASK_WORLD_CAP_BYTES, budgetHalt }, null, 2))
  const fails = verdicts.filter((v) => v.verdict === 'FAIL').length
  log(`verdicts: ${verdicts.filter((v) => v.verdict === 'PASS').length} PASS / ${fails} FAIL / ${verdicts.filter((v) => v.verdict === 'NOT_ATTEMPTED').length} NOT_ATTEMPTED; world own-allocated ${fp.ownExclusiveAllocated}B (+dirs ${fp.dirBytes}B) / cap ${BUDGET_CAP_BYTES}B`)
  process.exit(fails > 0 || budgetHalt === true || fp.ownExclusiveAllocated + fp.dirBytes > BUDGET_CAP_BYTES ? 2 : 0)
}

main().catch((e) => dieFatal(String(e?.stack ?? e)))
