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
 *   C1  P session_trace own session; PA gating is judged from the DURABLE
 *          LEDGER (open control-request), never from deny words in tool text;
 *          resolve rides team_list_pending_control + team_resolve_control and
 *          COMPLETES ONLY on a real control-resolved tool result; audit =
 *          exactly ONE decision + ONE allow-consume for that requestId.
 *   C3  P session_event_search (own target, census) -> seqs of REAL events
 *   C2  P session_event_trace {seq from C3}   C2b P session_event_read {same seq}
 *   C4  P session_event_search NO session_id  = the caller-clamp lane (leader
 *          HAS an active step here — NO_CURRENT_STEP is NOT forced)
 *   C5  P member child session (ceiling-positive)  C6  N foreign target deny
 *   C7  N archived member (team_archive_member first) deny
 *   C8  session_event_search on fresh w2's first turn: SHAPE case — a fresh
 *          turn normally HAS an active step (root 23:08: do NOT hard-expect
 *          NO_CURRENT_STEP); recorded verdict: clamp-executed OR
 *          SESSION_QUERY_TOOL_NO_CURRENT_STEP, only wire/schema/PA codes FAIL
 *   C9  N caller drift — NO public entry point exists (host.ts supply
 *          :2349-2357 lazy accessors; wiring canonicalValue law) ->
 *          NOT-ATTEMPTED-with-reason; NO hook forged (root law)
 *   C10 N unknown target -> the TEAM CEILING denies FIRST (root 23:08:
 *          expecting SESSION_QUERY_SESSION_NOT_FOUND would leak existence)
 *   Positive verdicts (root 23:08): the result FACE must correlate to the
 *   case's tool_use_id + tool name with is_error=false, and the payload must
 *   echo REAL seeded content (unique marker) / concrete seq — never mere
 *   non-empty minus four deny words.
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
// Root 23:08 card 5: after ANY start, every exit path runs the SAME awaited
// cleanup (stop host, close mock, BOTH ports free); cleanup failure flips the
// exit code — process.exit must never skip it.
const liveRef = { instance: null, mock: null, ports: [] }
let cleanupDone = false
async function cleanup() {
  if (cleanupDone) return []
  cleanupDone = true
  const failures = []
  if (liveRef.instance !== null) {
    try { const st = await liveRef.instance.stop({ timeoutMs: 30_000 }); log(`host stopped (killed=${st.killed} portFree=${st.portFree})`) } catch (e) { failures.push(`instance.stop: ${String(e).slice(0, 120)}`) }
  }
  if (liveRef.mock !== null) {
    try { await liveRef.mock.close() } catch (e) { failures.push(`mock.close: ${String(e).slice(0, 120)}`) }
  }
  for (const p of liveRef.ports) {
    try { await waitForPortFree(p, 30_000) } catch { failures.push(`port ${p} not free 30s after stop`) }
  }
  if (failures.length > 0) log(`CLEANUP FAILURES: ${failures.join(' | ')}`)
  return failures
}
async function dieFatal(msg) {
  try { mkdirSync(RUN_DIR, { recursive: true }) } catch { /* best effort */ }
  try { writeFileSync(join(RUN_DIR, 'FATAL.json'), JSON.stringify({ fatal: String(msg).slice(0, 2000), results, transcript: transcript.slice(-40) }, null, 2)) } catch { /* best effort */ }
  log(`FATAL: ${String(msg).slice(0, 400)}`)
  const cleanupFailures = await cleanup()
  process.exit(cleanupFailures.length > 0 ? 3 : 1)
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

// permissionPolicy is boundTemplate.capabilities.permissions (agent-bindings
// :2207); with capabilities ABSENT the governed plane (incl. the G6 arm)
// never mounts (root 23:08 card 1). Templates below are STRICT: the four
// required capability fields + permissions lanes; builtinToolDeny carries
// subagent_fork (known-sensitive; the preset-spawn subagent is NOT deny-able
// on the standard preset — skill §5.2, recorded, not mitigable here).
const BLUEPRINT_YAML = `---
schemaVersion: 1
blueprintId: ${BLUEPRINT_ID}
revision: "1"
displayName: "G6 session-query acceptance world"
description: "One boot; leader + archivable worker w1 + fresh worker w2 (C8 shape)."
leader:
  templateId: leader
  persona: "You lead this team. Follow the scripted instructions literally; never improvise extra tool calls."
  capabilities:
    teamTools:
      kind: allow
      items: [team_list_members, team_list_templates, team_inspect_config, team_create_member, team_delegate, team_follow_up, team_collect, team_send_message, team_report_progress, team_request_control, team_resolve_control, team_list_pending_control, team_archive_member]
    builtinToolDeny: [subagent_fork]
    skills: { kind: deny, items: [] }
    mcp: { kind: deny, items: [] }
    permissions:
      default: ask
      allow: []
      ask: []
      deny: []
members:
  - templateId: worker
    displayName: "Worker"
    persona: "You are a worker. Do exactly what each prompt says and answer briefly."
    capabilities:
      teamTools: { kind: deny }
      builtinToolDeny: [subagent_fork]
      skills: { kind: deny, items: [] }
      mcp: { kind: deny, items: [] }
      permissions:
        default: ask
        allow: []
        ask: []
        deny: []
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
/** The last user-text message carrying text blocks (mid-chain role:user
 *  tool_result carriers hold NO text — scanning only 'the last user message'
 *  loses the scenario marker; root 23:08 card 2). */
function userTextWithMarkers(msgs) {
  const textOf = (m) => (Array.isArray(m?.content) ? m.content.filter((b) => b?.type === 'text').map((b) => b.text ?? '').join(' ') : String(m?.content ?? ''))
  for (const m of [...msgs].reverse()) {
    if (m?.role !== 'user') continue
    const t = textOf(m)
    if (t !== '') return t
  }
  return ''
}
/** Faces = tool_result payloads CORRELATED to their assistant tool_use
 *  (id + name) with the wire's is_error flag (root 23:08 card 4). */
function toolResultFaces(msgs) {
  const names = new Map()
  const out = []
  for (const m of msgs) {
    const c = m?.content
    if (!Array.isArray(c)) continue
    for (const b of c) {
      if (b?.type === 'tool_use') names.set(b.id, b.name ?? 'unknown')
      if (b?.type === 'tool_result') out.push({
        tool_use_id: b.tool_use_id,
        name: names.get(b.tool_use_id) ?? 'unknown',
        is_error: b.is_error === true,
        text: typeof b.content === 'string' ? b.content : JSON.stringify(b.content ?? ''),
      })
    }
  }
  return out
}
async function waitForMock(mock, pred, timeoutMs, label, startsFrom = 0) {
  const deadline = Date.now() + timeoutMs
  for (;;) {
    const hit = mock.requests.slice(startsFrom).find((r) => { try { return pred(r) } catch { return false } })
    if (hit !== undefined) return hit
    if (Date.now() >= deadline) { noteTranscript({ waitTimeout: label, requests: mock.requests.length }); return null }
    await new Promise((r) => setTimeout(r, 250))
  }
}

// ── scenario state + scripted decide ────────────────────────────────────────

const S = { w1: null, w1Child: null, w2: null, w2Child: null, eventSeq: null }
const MK = {
  CREATE_W1: `G6_MK_CREATE_W1_${NONCE}`, CREATE_W2: `G6_MK_CREATE_W2_${NONCE}`,
  WORK_W1: `G6_MK_WORK_W1_${NONCE}`, ARCHIVE_W1: `G6_MK_ARCHIVE_W1_${NONCE}`,
  PAIR_RESOLVE: `G6_MK_PAIR_RESOLVE_${NONCE}`,
  WORKER_SEED: `G6_WORKER_SEED_${NONCE}`, // REAL unique content in w1's session
}
const doneTag = (c) => `G6_DONE_${c}_${NONCE}`
const toolSeq = new Map()
const caseAllowance = new Map()
const bump = (k) => { const n = toolSeq.get(k) ?? 0; toolSeq.set(k, n + 1); return n }

function decide({ req }) {
  const msgs = messagesOf(req)
  const userText = userTextWithMarkers(msgs)
  const lastResultText = toolResultFaces(msgs).at(-1)?.text ?? ''

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
      return toolCall('team_delegate', { rootSessionId: ROOT_G6, requestToken: `g6-work-w1-${NONCE}`, delegationInstanceId: S.w1, prompt: `Repeat exactly this line and nothing else: ${MK.WORKER_SEED}`, taskSummary: 'g6 w1 real activity', async: false })
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
  if (userText.includes(MK.PAIR_RESOLVE) && (toolSeq.get('pair_resolved') ?? 0) > 0) {
    // REAL completion branch: the resolve tool's OWN result must say
    // control-resolved; anything else is a named failure, never silence.
    if (lastResultText.includes('control-resolved')) return { kind: 'text', content: `${doneTag('PAIR_RESOLVED')} :: ${lastResultText.slice(0, 300)}` }
    return { kind: 'text', content: `G6_PAIR_RESOLVE_FAIL :: ${lastResultText.slice(0, 300)}` }
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
  if (userText.includes(MK.WORKER_SEED)) return { kind: 'text', content: MK.WORKER_SEED }
  return { kind: 'text', content: 'G6_IDLE' }
}

// ── the case table (inputs are data; expectations source-pinned) ───────────

const CASES = [
  { id: 'C1', tool: 'session_trace', input: () => ({ session_id: ROOT_G6 }), expect: 'ok', mustInclude: [ROOT_G6] },
  { id: 'C3', tool: 'session_event_search', input: () => ({ session_id: ROOT_G6, query: `G6_MARKER_${NONCE}` }), expect: 'ok', mustInclude: [`G6_MARKER_${NONCE}`] },
  { id: 'C2', tool: 'session_event_trace', input: () => ({ session_id: ROOT_G6, seq: S.eventSeq }), expect: 'ok', mustInclude: [String(S.eventSeq)] },
  { id: 'C2b', tool: 'session_event_read', input: () => ({ session_id: ROOT_G6, seq: S.eventSeq }), expect: 'ok', mustInclude: [String(S.eventSeq)] },
  { id: 'C4', tool: 'session_event_search', input: () => ({ query: `G6_MARKER_${NONCE}` }), expect: 'ok', mustInclude: [`G6_MARKER_${NONCE}`] }, // NO session_id = the caller-clamp lane (:1601-1608); the leader HAS an active step
  { id: 'C5', tool: 'session_trace', input: () => ({ session_id: S.w1Child }), expect: 'ok', mustInclude: [MK.WORKER_SEED] }, // REAL seeded content of w1's session
  { id: 'C6', tool: 'session_trace', input: () => ({ session_id: 'session-foreign-not-in-team-9f3c' }), expect: 'deny', anyOf: [G6.CEILING, G6.UNAUTHORIZED] },
  { id: 'C7', tool: 'session_trace', input: () => ({ session_id: S.w1Child }), expect: 'deny', anyOf: [G6.CEILING, G6.UNAUTHORIZED] },
  { id: 'C8', tool: 'session_event_search', input: () => ({ query: MK.WORKER_SEED }), expect: 'shape', shapeOk: [G6.NO_STEP] }, // fresh w2 first turn; NO_STEP allowed, not forced (root 23:08)
  { id: 'C10', tool: 'session_trace', input: () => ({ session_id: 'session-does-not-exist-000000' }), expect: 'deny', anyOf: [G6.CEILING, G6.UNAUTHORIZED] }, // ceiling FIRST; NOT_FOUND here = existence leak
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
    defaultWorkspace: WORLD, // session_search cross-session lane needs a cwd (:1047); pinned, not inherited
    // THE G6 ARM (agent-bindings :2633 gate + :3102 strict bit): the governed
    // plane mounts only with permissionPolicy (blueprint capabilities above)
    // AND config.teamToolPlane; sessionQuery accepts ONLY the literal true
    // (supply rides the live public service, never a config value).
    teamToolPlane: { sessionQuery: true },
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
  if (RECOVERY_RECORD_BYTES + budgetPre >= RECOVERY_CAP_BYTES) throw new Error(`pre-launch RECOVERY-ACCOUNT REFUSAL: recorded ${RECOVERY_RECORD_BYTES}B + task-new ${budgetPre}B >= recovery cap ${RECOVERY_CAP_BYTES}B (the 5GiB free-floor does NOT substitute for increment accounting — root 23:08 card 6)`)

  // model endpoint wiring (pr-d :1473-1480 prior art): the trusted env layer
  // the host's deepseek-official provider reads for its base URL.
  process.env.DEEPSEEK_BASE_URL = `http://127.0.0.1:${pre.mockPort}`
  process.env.DEEPSEEK_API_KEY = `g6-mock-${NONCE}`
  const mock = await startMockModel({ port: pre.mockPort, decide, log: (l) => log(`mock: ${l}`), fixtures: { dir: join(RUN_DIR, 'model-fixtures'), maxTextLength: 1600 } })
  liveRef.mock = mock
  liveRef.ports = [pre.port, pre.mockPort]

  const instance = new DshInstance({ hostTree: HOST_TREE, dshHome: WORLD, port: pre.port, clientCommitHash: CLIENT_COMMIT_HASH, logDir: join(RUN_DIR, 'instances') })
  mkdirSync(WORLD, { recursive: true })
  const rowConfig = writeG6PatchFile(instance.patchFile)
  writeFileSync(join(RUN_DIR, 'row-config.json'), JSON.stringify({ ...rowConfig, blueprintSource: '<inline BLUEPRINT_YAML>' }, null, 2))
  const started = await instance.start({ timeoutMs: 240_000 })
  liveRef.instance = instance
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

  // FULL pagination (307c getLedgerPage reuse point): result.value.data.entries
  // until a partial page; single-page reads are NOT treated as the truth.
  const ledgerEntries = async (tag) => {
    const all = []
    let afterSequence = 0
    for (;;) {
      const page = resultData((await remoteCallReady(host, 'team.getLedgerPage', { teamSessionId: ROOT_G6, afterSequence, limit: 500 }, `${tag}-p${all.length}`, 1)).body)
      const entries = page?.entries ?? []
      all.push(...entries)
      const last = entries.at(-1)?.sequence
      if (entries.length < 500 || typeof last !== 'number' || last <= afterSequence) return all
      afterSequence = last
    }
  }
  // Durable PA fact vocabulary (307c 737-740): the ONLY gating vocabulary.
  const PA_FACT_TYPES = new Set(['control-request-recorded', 'control-decision-recorded', 'control-allow-consumed', 'control-request-abandoned'])
  const payloadOf = (e) => {
    const raw = e?.payload
    if (raw === null || typeof raw === 'undefined') return {}
    if (typeof raw === 'string') { try { return JSON.parse(raw) ?? {} } catch { return {} } }
    return typeof raw === 'object' ? raw : {}
  }
  const paFacts = (entries, factType, requestId) => entries.filter((e) => {
    if (!PA_FACT_TYPES.has(e?.factType) || e?.factType !== factType) return false
    return requestId === undefined || payloadOf(e).requestId === requestId // EXACT correlation, never substring
  })
  const waitForLedgerFact = async (tag, factType, requestId, timeoutMs = 90_000) => {
    const deadline = Date.now() + timeoutMs
    for (;;) {
      const hit = paFacts(await ledgerEntries(`${tag}-wait`), factType, requestId)
      if (hit.length > 0) return hit.at(-1)
      if (Date.now() >= deadline) return null
      await new Promise((r) => setTimeout(r, 1500))
    }
  }

  const runCaseTurn = async (c, sessionId) => {
    const before = mock.requests.length
    const t = await apiPrompt(origin, cookie, sessionId, `G6_CASE ${c.id} Then answer one line.`, `g6-${c.id}`)
    if (!(t.status === 200 && t.body?.result?.ok === true)) return { status: 'TURN_NOT_ADMITTED', raw: JSON.stringify(t.body).slice(0, 300) }
    const done = await waitForMock(mock, (r) => r.reply?.kind === 'text' && String(r.reply?.content ?? '').startsWith(doneTag(c.id)), 240_000, `${c.id} done`, before)
    if (done === null) return { status: 'TURN_TIMEOUT' }
    const faces = mock.requests.slice(before).flatMap((r) => toolResultFaces(messagesOf(r)))
    const face = [...faces].reverse().find((f) => f.name === c.tool) ?? null
    return {
      status: 'DONE',
      faceFound: face !== null,
      isError: face?.is_error === true,
      toolResult: face?.text ?? '',
      toolResults: faces.length,
      mustInclude: typeof c.mustInclude === 'function' ? c.mustInclude() : (c.mustInclude ?? []),
    }
  }
  // PA law (root 23:08 card 2 + 307c reuse points): durable facts ONLY,
  // correlated by EXACT payload.requestId. The RPC envelope rpcId is transport
  // identity and is NEVER a PA requestId. Abandoned requests are terminal, not
  // open. Completion = a REAL control-resolved tool result, then exactly ONE
  // decision + ONE allow-consume for that requestId.
  const PAIR_AUDIT = []
  const resolvePairingIfNeeded = async (tag) => {
    const entries = await ledgerEntries(tag)
    const requests = entries.filter((e) => e?.factType === 'control-request-recorded')
    const openReq = [...requests].reverse().find((e) => {
      const reqId = payloadOf(e).requestId
      const closed = paFacts(entries, 'control-decision-recorded', reqId).length + paFacts(entries, 'control-request-abandoned', reqId).length
      return closed === 0
    })
    if (openReq === undefined) return 'none-open'
    const reqId = payloadOf(openReq).requestId
    if (typeof reqId !== 'string' || reqId === '') await dieFatal('pairing: durable request without a payload.requestId')
    const startsFrom = mock.requests.length
    const t = await apiPrompt(origin, cookie, ROOT_G6, `${MK.PAIR_RESOLVE} List pending control requests and resolve the pairing request with allow.`, 'g6-pair')
    if (!(t.status === 200 && t.body?.result?.ok === true)) await dieFatal('pairing resolve turn not admitted')
    const fail = await waitForMock(mock, (r) => r.reply?.kind === 'text' && String(r.reply?.content ?? '').startsWith('G6_PAIR_RESOLVE_FAIL'), 240_000, 'pair FAIL', startsFrom)
    if (fail !== null) await dieFatal(`pairing resolve NOT completed: ${String(fail.reply?.content).slice(0, 300)}`)
    const ok = await waitForMock(mock, (r) => r.reply?.kind === 'text' && String(r.reply?.content ?? '').startsWith(doneTag('PAIR_RESOLVED')), 240_000, 'pair settle', startsFrom)
    if (ok === null) await dieFatal('pairing resolve chain did not reach the control-resolved completion branch')
    const decided = await waitForLedgerFact(`${tag}-decided`, 'control-decision-recorded', reqId)
    if (decided === null) await dieFatal(`pairing: no durable control-decision-recorded for ${reqId}`)
    const consumed = await waitForLedgerFact(`${tag}-consumed`, 'control-allow-consumed', reqId)
    const after = await ledgerEntries(`${tag}-after-pair`)
    const decision = paFacts(after, 'control-decision-recorded', reqId)
    const consumedFacts = paFacts(after, 'control-allow-consumed', reqId)
    PAIR_AUDIT.push({ reqId, decisionFacts: decision.length, consumedFacts: consumedFacts.length })
    writeFileSync(join(RUN_DIR, 'pairing-audit.json'), JSON.stringify(PAIR_AUDIT, null, 2))
    if (decision.length !== 1 || consumedFacts.length !== 1) await dieFatal(`pairing audit: request ${reqId} decision=${decision.length} consume=${consumedFacts.length} (exactly-one law)`)
    void consumed
    return 'resolved-via-leader-model-tools'
  }

  // ── world build (real session/member activity only) ──────────────────────
  for (const [marker, done, tag] of [[MK.CREATE_W1, doneTag('CREATE_W1'), 'g6-seed'], [MK.WORK_W1, doneTag('WORK_W1'), 'g6-work'], [MK.CREATE_W2, doneTag('CREATE_W2'), 'g6-seed2']]) {
    const beforeSeed = mock.requests.length
    const t = await apiPrompt(origin, cookie, ROOT_G6, `${marker} Follow the scripted tool chain. G6_MARKER_${NONCE}`, tag)
    if (!(t.status === 200 && t.body?.result?.ok === true)) await dieFatal(`seed turn not admitted (${tag})`)
    if ((await waitForMock(mock, (r) => r.reply?.content === done, 240_000, tag, beforeSeed)) === null) await dieFatal(`seed chain did not settle (${tag})`)
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
    const recoveryUsed = RECOVERY_RECORD_BYTES + b
    writeFileSync(join(RUN_DIR, `budget-${where}.json`), JSON.stringify({ at: new Date().toISOString(), where, taskNewAllocatedBytes: b, taskWorldCapBytes: TASK_WORLD_CAP_BYTES, recoveryUsedBytes: recoveryUsed, recoveryCapBytes: RECOVERY_CAP_BYTES }, null, 2))
    if (b >= TASK_WORLD_CAP_BYTES || recoveryUsed >= RECOVERY_CAP_BYTES) { budgetHalt = true; log(`BUDGET-HALT at ${where}: world ${b}B/${TASK_WORLD_CAP_BYTES}B recovery ${recoveryUsed}B/${RECOVERY_CAP_BYTES}B — remaining case steps STOPPED`) }
  }
  phaseBudgetCheck('post-boot')
  let c1 = await runCaseTurn(CASES[0], ROOT_G6)
  const pairState = await resolvePairingIfNeeded('g6-ledger-pair') // DURABLE pending-approval law, not tool-text deny words
  if (pairState === 'resolved-via-leader-model-tools' && c1.status === 'DONE' && (!c1.faceFound || c1.isError)) {
    log('C1 gated (open durable request) -> resolved; retrying (allowance 2)')
    caseAllowance.set('C1', 2)
    c1 = await runCaseTurn(CASES[0], ROOT_G6)
    c1.paired = pairState
  } else if (pairState !== 'none-open' && pairState !== 'resolved-via-leader-model-tools') {
    await dieFatal(`unexpected pairing state: ${pairState}`)
  }
  results.push({ id: 'C1', ...c1, expect: CASES[0].expect, mustInclude: CASES[0].mustInclude })
  for (const id of ['C3', 'C2', 'C2b', 'C4', 'C5', 'C6', 'C10']) {
    const c = CASES.find((x) => x.id === id)
    await resolvePairingIfNeeded(`g6-ledger-${id}`) // NEW target realms gate per durable pending approval
    const r = await runCaseTurn(c, ROOT_G6)
    results.push({ id, ...r, expect: c.expect, anyOf: c.anyOf, shapeOk: c.shapeOk })
    if (id === 'C3') {
      // seq comes ONLY from a REAL public event surfaced by the search result
      // (0 is a legal seq); no fabricated fallback (root 23:08 card 3).
      const m = /"seq"\s*:\s*(\d+)/.exec(r.toolResult ?? '') ?? /\bseq (\d+)\b/.exec(r.toolResult ?? '')
      if (m === null) await dieFatal('C3 surfaced no real event seq; refusing to invent one for C2/C2b')
      S.eventSeq = Number(m[1])
      log(`C3 real event seq=${S.eventSeq}`)
    }
    if (budgetHalt) break
    phaseBudgetCheck(`case-${id}`)
  }

  // C7: archive w1 (leader MODEL tool), then leader queries the archived child.
  const at = await apiPrompt(origin, cookie, ROOT_G6, `${MK.ARCHIVE_W1} Archive w1.`, 'g6-archive')
  const archFrom = mock.requests.length
  if (!(at.status === 200 && at.body?.result?.ok === true) || (await waitForMock(mock, (r) => r.reply?.content === doneTag('ARCHIVE_W1'), 240_000, 'archive', archFrom)) === null) await dieFatal('archive chain failed')
  const r7 = await runCaseTurn(CASES.find((x) => x.id === 'C7'), ROOT_G6)
  const c7 = CASES.find((x) => x.id === 'C7')
  results.push({ id: 'C7', ...r7, expect: 'deny', anyOf: c7.anyOf })

  // C8: fresh w2 FIRST turn on its own child session (no committed step).
  if (S.w2Child === null) { results.push({ id: 'C8', status: 'NOT_ATTEMPTED', reason: 'w2 child session id not observable; refusing to fake the target' }) }
  else {
    const r8 = await runCaseTurn(CASES.find((x) => x.id === 'C8'), S.w2Child)
    results.push({ id: 'C8', ...r8, expect: 'shape', shapeOk: [G6.NO_STEP], session: S.w2Child })
  }

  // C9: NOT-ATTEMPTED with the source-level reason (no hook forged).
  results.push({ id: 'C9', status: 'NOT_ATTEMPTED', reason: 'no public surface flips exec-owner/caller snapshot (host.ts supply :2349-2357; wiring canonicalValue(callerSnapshot) law); forging a test hook violates the acceptance-plane law' })

  // ── durable cross-check + verdicts ───────────────────────────────────────
  writeFileSync(join(RUN_DIR, 'ledger-final.json'), JSON.stringify(await ledgerEntries('g6-ledger-final'), null, 2))
  const verdicts = results.map((r) => {
    if (r.status === 'NOT_ATTEMPTED') return { id: r.id, verdict: 'NOT_ATTEMPTED', reason: r.reason }
    if (r.status !== 'DONE') return { id: r.id, verdict: 'FAIL', why: r.status, raw: r.raw ?? '' }
    const text = r.toolResult ?? ''
    if (r.faceFound !== true) return { id: r.id, verdict: 'FAIL', why: 'no tool_result face correlated to the case tool_use_id' }
    const codes = [G6.CEILING, G6.UNAUTHORIZED, G6.NOT_FOUND, G6.NO_STEP, G6.DRIFT].filter((d) => text.includes(d))
    const wireCodes = ['P_G6_WIRE_', 'SESSION_QUERY_INVALID_', 'SESSION_QUERY_MISSING', 'SESSION_QUERY_UNKNOWN', 'SESSION_QUERY_TOOL_FAILED', 'SESSION_QUERY_CORRUPT', 'SESSION_QUERY_PERSISTENCE', 'SESSION_QUERY_SEARCH_DISABLED', 'SESSION_QUERY_ABORTED', 'SESSION_QUERY_INDEX_FAILED', 'SESSION_QUERY_STALE', 'SESSION_QUERY_RESULT_INTEGRITY'].filter((d) => text.includes(d))
    if (r.expect === 'deny') {
      const hits = (r.anyOf ?? DENY_TOKENS).filter((d) => text.includes(d))
      const pass = r.isError !== true && hits.length > 0
      return { id: r.id, verdict: pass ? 'PASS' : 'FAIL', expect: 'deny', observedCodes: codes, observed: text.slice(0, 240) }
    }
    if (r.expect === 'shape') {
      // fresh-turn shape: clamp-executed OR NO_CURRENT_STEP both legal (root
      // 23:08: a new turn normally HAS an active step); wire/schema/PA codes
      // or a missing/erroring face FAIL.
      const pass = r.isError !== true && wireCodes.length === 0 && codes.filter((c) => c !== G6.NO_STEP).length === 0
      return { id: r.id, verdict: pass ? 'PASS' : 'FAIL', expect: 'shape', observedCodes: codes, observed: text.slice(0, 240) }
    }
    const missing = (r.mustInclude ?? []).filter((needle) => !text.includes(needle))
    const pass = r.isError !== true && codes.length === 0 && wireCodes.length === 0 && missing.length === 0 && text.length > 0
    return { id: r.id, verdict: pass ? 'PASS' : 'FAIL', expect: 'ok', missingContent: missing, observedCodes: codes, observed: text.slice(0, 240) }
  })
  writeFileSync(join(RUN_DIR, 'results.json'), JSON.stringify({ results, verdicts, transcript: transcript.slice(-150) }, null, 2))

  // ── teardown + budget ────────────────────────────────────────────────────
  const fp = allocatedFootprint(WORLD)
  const cleanupFailures = await cleanup()
  writeFileSync(join(RUN_DIR, 'footprint.json'), JSON.stringify({ world: WORLD, ...fp, recoveryIncrementCap: BUDGET_CAP_BYTES, recoveryUsedBytes: RECOVERY_RECORD_BYTES + taskNewAllocated(), taskNewAllocatedBytes: taskNewAllocated(), taskWorldCapBytes: TASK_WORLD_CAP_BYTES, budgetHalt, cleanupFailures }, null, 2))
  const fails = verdicts.filter((v) => v.verdict === 'FAIL').length
  log(`verdicts: ${verdicts.filter((v) => v.verdict === 'PASS').length} PASS / ${fails} FAIL / ${verdicts.filter((v) => v.verdict === 'NOT_ATTEMPTED').length} NOT_ATTEMPTED; world own-allocated ${fp.ownExclusiveAllocated}B (+dirs ${fp.dirBytes}B) / recovery ${RECOVERY_RECORD_BYTES + taskNewAllocated()}B/${RECOVERY_CAP_BYTES}B`)
  process.exit(cleanupFailures.length > 0 ? 3 : (fails > 0 || budgetHalt === true || RECOVERY_RECORD_BYTES + taskNewAllocated() > RECOVERY_CAP_BYTES ? 2 : 0))
}

main().catch((e) => dieFatal(String(e?.stack ?? e)))
