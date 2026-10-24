#!/usr/bin/env node
/**
 * A5M2 schedule C2 — REAL-HOST runner (final 5-item card per root 23:03
 * on top of the 22:44 items; BOOT remains gated behind
 * A5M2_SCHED_C2_WINDOW=GRANTED — the window is root's ruling). A no-boot
 * dry path (A5M2_SCHED_C2_DRY=1) runs the REAL pre-flight to the boot
 * boundary — pins -> awaited port probes -> real offline install (minimal
 * lock update over the standard fixture) -> exports-resolved plugin entry
 * -> blueprint/patch writes -> cleanup handles — then stops BEFORE any
 * listen/spawn. THE DRY PATH PROVES ONLY UP-TO-BOUNDARY FACTS: the API/
 * ledger code paths below are exercised ONLY in a real granted window;
 * dry must never be claimed as full readiness.
 *
 * Root 23:03 final five (all grounded in cited real contracts):
 *  1 EVERY prompt mints a unique requestId (types :333-341 required;
 *    commands :330 + hasPromptRequest :602-612 dedup on source.rpcId —
 *    a shared/undefined id silently no-ops every later prompt).
 *  2 session values under result.value; team ledger pages under
 *    result.value.data.entries (pr-d resultData .data wrapper).
 *  3 durable rows are canonical JSON strings (pr-d :720-741 safeParse);
 *    pending = public-ledger recorded MINUS decision MINUS abandoned
 *    (pr-d :751-781), never a raw status field.
 *  4 payloads parsed; STRICT payload.requestId equality; factTypes exact
 *    'control-allow-consumed' / 'control-request-abandoned' — no
 *    stringify().includes, no whole-text regex.
 *  5 teardown error or portFree=false => NON-ZERO verdict; never log-
 *     and-finish(0).
 *
 * Root 22:44 items, each grounded in the cited real contract:
 *  ① findTestRepoRoot(dirname(fileURLToPath(import.meta.url))) + null
 *    fail-closed (paths.mjs :99-108); portInUse ASYNC (util :130) awaited.
 *  ② plugin entry = INSTALLED package exports['./host'] (signed layout
 *    packages/runtime/dist/…); install = standard fixture manifest/lock +
 *    ONLY the file: entry with the normal minimal lock update — no blind
 *    lock copy over a mismatched importer.
 *  ③ governed pair mounts only with row config teamToolPlane
 *    (agent-bindings :2715-2726) + scheduleEnabled === true (:3152).
 *  ④ HTTP RPC envelope {type:'server-response', result:{ok:true,value}} /
 *    result.error; session.create takes workspaceId|cwd|sessionId|
 *    agentPreset (session-controller types :285-296) — no invented
 *    requestId/title.
 *  ⑤ seeds: {title, prompt, after_seconds} — exactly one timing parameter
 *    (schedule tools.ts :233-249).
 *  ⑥ C4 via PUBLIC session/cancel {sessionId} (types :371-377,
 *    @Remote('cancel') index :450-458); verifies a REAL abandonment ledger
 *    event for the exact requestId — any non-pending does NOT count.
 *  ⑦ mock: marker -> ONE tool call; on that call's result return
 *    {kind:'text', content:…} — content field, conversation closes.
 *  ⑧ tool-surface receipt captured ONLY on the member's TOOLS-CHECK
 *    request; accepts tools[].function.name shapes.
 *  ⑨ results correlate by tool_call_id (OpenAI role:'tool', content string
 *    or array); no global text dedup swallowing repeated identical lists.
 *  ⑩ instance registered BEFORE start; exit only after await
 *    instance.stop / await mock.close / ports verified free.
 *  ⑪ consumed/abandoned checked against team.getLedgerPage EVENTS for the
 *    exact requestId — never a first-object string scan.
 */
import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, openSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve, basename } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { CLIENT_COMMIT_HASH, findTestRepoRoot } from '../../../tests/paths.mjs'
import { DshInstance } from '../../../tests/characterization/lib/instance.mjs'
import { portInUse, waitForPortFree } from '../../../tests/characterization/lib/util.mjs'
import { startMockModel } from '../../../packages/tools/harness/mock-deepseek.mjs'

const PIN_PKG_SHA256 = 'eda06b4a78bba180c0acef1b25237f3f741917385cd0728ee66adc737b1cd09d' // CENTER CANONICAL rootpack @874f3ae0d (3,857,455B/1821 entries; re-measured by this lane, identical)
const PIN_PKG_BYTES_MAX = 4_000_000
const PIN_TGZ = '.worktrees/pack-int/out-874f3ae0d-20261023T213601Z/dsh-agent-team-0.1.1-alpha.2.tgz'
const FIXTURE_DIR = 'tests/homes/.a5m2-bf4-fixture-20261023T20-55-19Z/install'
const FIXTURE_LOCK_SHA256 = '163ed8991902f7dc07fd828181c0184cb09377a1aa28cbb0fff0cc6bd788310c'
const WORLD_BUDGET = Object.freeze({
  // Root 22:5x capacity law: this install shape (fixture lock + minimal
  // file: update, --offline from the pinned r18 store, 0 downloads) is
  // explicitly allowed at "tens of MB new"; dry-path measured 45.6MB
  // (pnpm 11.7 copies from the store on ext4, all bytes pre-existing).
  installBytesMax: 60_000_000,
  stateBytesMax: 100_000_000,
  evidenceBytesMax: 100_000_000,
  worldTotalMax: 250_000_000,
})
const HOST_PORT = 3185
const MOCK_PORT = 3496
const WORLD_PREFIX = 'a5m2-sched-c2'
const BP_ID = 'team.a5m2-sched-c2'
const SEED_TITLES = ['A5M2SEED-ALPHA', 'A5M2SEED-BETA', 'A5M2SEED-GAMMA']
const ABSENT_ID = 'sch_a5m2_absent_zz'
// Root 01:1x FINAL v3 STRUCTURE (image b811 a5m2-todo-c2 BP_ANCHOR_YAML/
// savedBlueprintYaml canonical shape — structure only borrowed): schema 3 +
// the REQUIRED v3 permissionMutationEnvelope/teamHardEnvelope rule blocks,
// metadata present. The anchor carries NO capabilities; the saved doc keeps
// ONLY schedule-lane rules (schedule_list/schedule_delete ask — named in
// the widened template permission vocabulary, schema.js:426; skills/mcp as
// kind:deny WITHOUT items; NO copied read/bash/send permissions, NO
// available:true anywhere). Both sources are validated by the product's
// real blueprint parser (parseBlueprint), not YAML-legality alone.
const ANCHOR_V3_YAML = [
  '---', 'schemaVersion: 3', `blueprintId: ${BP_ID}.boot-anchor`, 'revision: "1"',
  'leader:', '  templateId: leader', '  persona: "You are the leader of the A5M2 schedule C2 boot team."',
  'members:', '  - templateId: sched-worker', '    persona: "You are a worker of the A5M2 schedule C2 boot team."',
  'memberEnvelopes: []', 'requirements: []',
  'permissionMutationEnvelope:', '  rules: []',
  'teamHardEnvelope:', '  rules: []',
  'policyStates: []', 'metadata: {}', '---', '',
].join('\n')
const SAVED_BP_V3_YAML = [
  '---', 'schemaVersion: 3', `blueprintId: ${BP_ID}`, 'revision: "1"',
  'leader:', '  templateId: leader', '  persona: "You are the leader of the A5M2 schedule C2 team."',
  'members:', '  - templateId: sched-worker',
  '    persona: "You are the schedule worker. Follow the marker instructions literally and only."',
  '    capabilities:', '      teamTools:', '        kind: deny', '      builtinToolDeny: []',
  '      skills:', '        kind: deny', '      mcp:', '        kind: deny',
  '      permissions:', '        default: deny', '        allow: []', '        ask:',
  '          - tool: schedule_list', '            resource:', '              kind: any',
  '          - tool: schedule_delete', '            resource:', '              kind: any',
  '        deny: []',
  'teamEnvelope:', '  allow:',
  '    - assign-task', '    - create-member', '    - send-message',
  '    - report-progress', '    - request-control', '    - resolve-control',
  '  deny: []',
  'memberEnvelopes: []', 'requirements: []',
  'permissionMutationEnvelope:', '  rules: []',
  'teamHardEnvelope:', '  rules: []',
  'policyStates: []', 'metadata: {}', '---', '',
].join('\n')
// Root 23:5x: read-only reuse of the approved frozen surface (skips the
// install stage; verified before use; the reused tree is never written).
const REUSE_INSTALL = process.env.A5M2_SCHED_C2_REUSE_INSTALL ?? null
const REUSE_LOCK_SHA256 = '7faee42f88306edb43888cbd3d822a45596d6a05d0641e32457cbcd553568cfe'
const FIFTEEN_PEER_PINS = Object.freeze({
  '@deepseek-ai/dsh': '0.2.0-rc.2', '@deepseek-ai/dsh-agent': '0.2.0-rc.2',
  '@deepseek-ai/dsh-llm': '0.2.0-rc.2', '@deepseek-ai/dsh-mcp-client': '0.2.0-rc.2',
  '@deepseek-ai/dsh-schedule': '0.2.0-rc.2', '@deepseek-ai/dsh-scope': '0.2.0-rc.2',
  '@deepseek-ai/dsh-session': '0.2.0-rc.2', '@deepseek-ai/dsh-spill': '0.2.0-rc.2',
  '@deepseek-ai/dsh-spill-local': '0.2.0-rc.2', '@deepseek-ai/dsh-storage-domain': '0.2.0-rc.2',
  '@deepseek-ai/dsh-system-prompt': '0.2.0-rc.2', '@deepseek-ai/dsh-tool-fs-search': '0.2.0-rc.2',
  '@deepseek-ai/cordis': '4.0.4', yaml: '2.9.0', zod: '4.4.3',
})
const NONCE = Math.random().toString(36).slice(2, 8)
const DRY = process.env.A5M2_SCHED_C2_DRY === '1'

// ① repo root: real start directory + null fail-closed
const ROOT_DIR = findTestRepoRoot(dirname(fileURLToPath(import.meta.url)))
if (ROOT_DIR === null) { console.error('findTestRepoRoot returned null — kit not under a repo root'); process.exit(3) }
const HOST_TREE = join(ROOT_DIR, 'tests', 'deepseek-harness-test-use')

if (!DRY && process.env.A5M2_SCHED_C2_WINDOW !== 'GRANTED') {
  console.log(JSON.stringify({
    implemented: true, bootable: false, dry: false,
    reason: 'window env A5M2_SCHED_C2_WINDOW not GRANTED (root ruling pending) — cannot boot anything',
    pinPkgSha256: PIN_PKG_SHA256, fixtureLockSha256: FIXTURE_LOCK_SHA256,
    hostPort: HOST_PORT, mockPort: MOCK_PORT, criteria: ['C0', 'C1', 'C2', 'C3', 'C4', 'C5'],
  }, null, 2))
  process.exit(0)
}

// ── state ──────────────────────────────────────────────────────────────────
const RUN_STAMP = new Date().toISOString().replace(/[:.]/g, '-')
const HOME = join(ROOT_DIR, 'tests', 'homes', `${WORLD_PREFIX}${DRY ? '-dry' : ''}-${RUN_STAMP}Z`)
const RUN_DIR = join(ROOT_DIR, 'dev', 'agent-workflow', 'evidence', 'a5m2-schedule-c2', `run-${DRY ? 'dry-' : ''}${RUN_STAMP}`)
const TRANSCRIPT = []
const results = []
const steps = new Map() // callId -> { step, tool }
const callResults = [] // { callId, step, toolName, text } per OCCURRENCE (⑨ no global text dedup)
const memberToolsSeen = []
let currentCriterion = 'setup'
let mock = null
let instance = null // ⑩ registered BEFORE start
const log = (line) => { console.log(`[sched-c2] ${line}`) }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
function check(critId, name, ok, detail) {
  results.push({ critId, name, ok, detail: String(detail).slice(0, 600) })
  log(`${critId} ${ok ? 'PASS' : 'FAIL'} — ${name}${ok ? '' : ` detail=${String(detail).slice(0, 300)}`}`)
  if (!ok) throw new Error(`CRIT-FAIL ${critId}: ${name}`) // first failure: unwind -> cleanup -> STOP
}
const sha256 = (file) => createHash('sha256').update(readFileSync(file)).digest('hex')
// NEW-BYTES metric: hardlinks to the shared warm store are NOT new disk
// (0-download reuse), so budgets count files with nlink==1 only — the
// bytes actually allocated by this world.
const duBytes = (dir) => Number(execFileSync('bash', ['-c', 's=0; while IFS= read -r f; do s=$((s + $(stat -c %s "$f" 2>/dev/null || echo 0))); done < <(find "$1" -type f -links 1 2>/dev/null); echo "$s"', 'x', dir], { encoding: 'utf8' }).trim() || 0)
function budget(label, dir, max) {
  const b = duBytes(dir)
  log(`budget ${label}: ${b}B (max ${max}B)`)
  if (b > max) throw new Error(`budget breach ${label}: ${b} > ${max}`)
}
async function waitFor(label, timeoutMs, pred) {
  const deadline = Date.now() + timeoutMs
  for (;;) {
    const v = await pred()
    if (v !== null && v !== undefined && v !== false) return v
    if (Date.now() > deadline) throw new Error(`timeout waiting for ${label}`)
    await sleep(500)
  }
}
function finish(rc) {
  try {
    mkdirSync(RUN_DIR, { recursive: true })
    writeFileSync(join(RUN_DIR, 'results.json'), JSON.stringify({ stamp: RUN_STAMP, dry: DRY, rc, results, transcript: TRANSCRIPT.slice(-400) }, null, 2))
    if (existsSync(HOME)) log(`world total ${duBytes(HOME)}B (hard cap ${WORLD_BUDGET.worldTotalMax}B)`)
  } finally { process.exit(rc) }
}
// ⑩ cleanup handles awaited BEFORE exit. Root 23:03 ⑤: any cleanup ERROR
// or portFree=false sets cleanupOk=false — a green conclusion is FORBIDDEN
// then; the verdict must be non-zero.
let cleanupOk = true
async function cleanup() {
  const notes = []
  try { if (mock !== null) { await mock.close(); notes.push('mock closed') } } catch (e) { notes.push(`mock close ERR ${String(e).slice(0, 120)}`) }
  try { if (instance !== null) { const r = await instance.stop({ timeoutMs: 30_000 }); notes.push(`instance stopped killed=${r.killed} portFree=${r.portFree}`) } } catch (e) { notes.push(`instance stop ERR ${String(e).slice(0, 120)}`) }
  for (const p of [HOST_PORT, MOCK_PORT]) {
    try { const free = await waitForPortFree(p, 10_000); notes.push(`port ${p} free=${free}`) } catch (e) { notes.push(`port ${p} ERR ${String(e).slice(0, 120)}`) }
  }
  const ok = !notes.some((n) => n.includes('ERR') || n.includes('free=false'))
  cleanupOk = ok
  log(`cleanup (${ok ? 'OK' : 'NOT-OK'}): ${notes.join(' | ')}`)
  return { ok, notes }
}

// ── pins (fail closed) ─────────────────────────────────────────────────────
const tgzPath = join(ROOT_DIR, PIN_TGZ)
if (!existsSync(tgzPath)) { console.error(`canonical rootpack missing: ${PIN_TGZ}`); process.exit(3) }
if (statSync(tgzPath).size > PIN_PKG_BYTES_MAX) { console.error('rootpack bytes exceed the kit bound'); process.exit(3) }
if (sha256(tgzPath) !== PIN_PKG_SHA256) { console.error('rootpack sha256 drifted from the center canonical pin'); process.exit(3) }
const fixtureDir = join(ROOT_DIR, FIXTURE_DIR)
const lockPath = join(fixtureDir, 'pnpm-lock.yaml')
const fixtureManifestPath = join(fixtureDir, 'package.json')
if (!existsSync(lockPath) || sha256(lockPath) !== FIXTURE_LOCK_SHA256) { console.error('bf4 fixture lock missing/drifted'); process.exit(3) }
if (!existsSync(fixtureManifestPath)) { console.error('standard fixture package.json missing'); process.exit(3) }

function writePatch(patchPath, hostEntryHref) {
  mkdirSync(dirname(patchPath), { recursive: true })
  // Root 00:2x (loader dialect): top-level ARRAY, `insert:` a LIST of one
  // plugin entry. Root 00:4x (874 dist validator, one-batch fix, pr-d
  // canonical row shape): REQUIRED validateTeamPluginConfig keys added —
  // bootPhase/rootSessionId/blueprintSource; the four lawful MINIMAL-EMPTY
  // keys kept (deniedSelection:null, mcpServers:[]/mcpServer:null,
  // environmentFacts:[], externalPolicyFacts:{hard:{},capabilityExists:{}})
  // — empty facts state NO capabilities (no fabricated available:true
  // entries; authority stays a real later verification). glueUrl/seamUrl
  // stay ABSENT (the real location-derived defaults). teamToolPlane is the
  // consumed optional row face (agent-bindings); my lane's schedule gate.
  writeFileSync(patchPath, [
    `- insert:`,
    '    - id: dsh-agent-team',
    `      name: ${JSON.stringify(hostEntryHref)}`,
    '      config:',
    "        bootPhase: 'create'",
    `        rootSessionId: ${JSON.stringify(`session-a5m2c2-boot-${RUN_STAMP}`)}`,
    '        blueprintSource: |-',
    // canonical v3 source WITH its frontmatter fences, indented into the block scalar
    ...ANCHOR_V3_YAML.replace(/\n$/, '').split('\n').map((l) => `          ${l}`),
    `        blueprintDir: ${JSON.stringify(join(HOME, 'blueprints'))}`,
    '        seedMembers: []',
    '        generation: 1',
    '        staticModel:', '          provider: deepseek-official', '          model: a5m2-sched-model',
    '        deniedSelection: null', '        mcpServers: []', '        mcpServer: null',
    '        environmentFacts: []', '        externalPolicyFacts:', '          hard: {}', '          capabilityExists: {}',
    '        teamToolPlane:', // ③ governed pair refuses without plane+schedule
    '          scheduleEnabled: true', '',
  ].join('\n'))
}

// ── public channels (root 23:03 ②: session values under result.value; team
//    ledger pages under result.value.data.entries — pr-d resultData/
//    resultError verbatim shape incl. the .data wrapper + fail-loud error) ──
let origin = null
let cookie = null
let currentRoot = null
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
async function remoteCall(method, params, tag, version = 1) {
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
// Root 02:1x card: minimal bounded READ-ONLY team-runtime readiness barrier.
// team.listRoots is the EXISTING public v3-only read method (874 s6-remote.ts
// :4053-4063; params {}; no root addressed, no repository writes, no agent
// effects). The first "starting" refusal was answered by the readiness gate
// BEFORE the business dispatcher (:4814-4834), so nothing was ever executed;
// this kit previously had only the 429 retry and no ready barrier. Policy:
//   - EXACT runtime-not-ready envelope whose message says "state: starting"
//     -> bounded wait (poll every 1.5s, hard budget);
//   - state "failed", any other error, transport/shape anomaly -> STOP now;
//   - ok -> proceed; team.create is then issued EXACTLY ONCE by the caller
//     (write requests are never retried; the product is not modified).
async function teamReadyBarrier(budgetMs = 180_000) {
  const deadline = Date.now() + budgetMs
  let polls = 0
  for (;;) {
    polls += 1
    const res = await remoteCall('team.listRoots', {}, 'c2-ready', 3)
    const err = resultError(res.body)
    if (err === null) {
      log(`team runtime READY via read-only team.listRoots (polls=${polls})`)
      return
    }
    const starting = err.code === 'internal-error'
      && err.details?.reason === 'runtime-not-ready'
      && String(err.message).includes('state: starting')
    if (!starting) throw new Error(`readiness barrier STOP (immediate, polls=${polls}): ${JSON.stringify(err).slice(0, 400)}`)
    if (Date.now() >= deadline) throw new Error(`readiness barrier budget exhausted while state=starting (polls=${polls})`)
    await sleep(1500)
  }
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
// Root 23:03 ①: SessionPromptRequest.requestId is REQUIRED (types :333-341)
// and the dedup key (commands :330 + hasPromptRequest :602-612 matches the
// accepted message's source.rpcId) — EVERY prompt mints a unique one;
// session/create ({cwd}) and session/cancel ({sessionId}) keep their own
// lawful field sets (types :285-296 / :371-373), no shared template.
let promptSeq = 0
const apiPrompt = (sessionId, text, tag = 'c2') => sessionRpc('prompt', { requestId: `c2-prompt-${NONCE}-${tag}-${promptSeq += 1}`, sessionId, mode: 'queue', content: [{ type: 'text', text }] }, tag)
const apiCancel = (sessionId, tag = 'c2-cancel') => sessionRpc('cancel', { sessionId }, tag) // ⑥ public cancel

async function main() {
  // ① awaited port probes
  currentCriterion = 'preflight'
  const hostBusy = await portInUse(HOST_PORT)
  const mockBusy = await portInUse(MOCK_PORT)
  if (hostBusy || mockBusy) throw new Error(`ports busy at start: host=${hostBusy} mock=${mockBusy} (avoidance: image 3182/3497, G6 3186, legacy untouched)`)

  if (existsSync(HOME) && readdirSync(HOME).length > 0) throw new Error(`home ${HOME} exists non-empty — fail closed`)
  for (const p of [HOME, join(HOME, 'blueprints'), join(HOME, 'storages'), RUN_DIR]) mkdirSync(p, { recursive: true })
  writeFileSync(join(HOME, 'a5m2-sched-lock.json'), JSON.stringify({ world: HOME, pid: process.pid, kit: 'a5m2-schedule-c2.mjs', stamp: RUN_STAMP, dry: DRY }, null, 2))

  // Root 23:5x sanctioned READ-ONLY reuse entry: when
  // A5M2_SCHED_C2_REUSE_INSTALL names the approved frozen surface, the
  // install stage is SKIPPED entirely (no pnpm, no downloads, no writes
  // to the reused tree) after verifying: lock hash, 15-peer ACTUAL
  // resolved versions, and the product tgz identity/hash. HOME and
  // RUN_DIR remain fresh and independent; the reused install is never a
  // boot world and never written.
  let INSTALL = REUSE_INSTALL
  if (INSTALL !== null) {
    if (!existsSync(INSTALL)) throw new Error(`reuse install absent: ${INSTALL}`)
    const reuseLockPath = join(INSTALL, 'pnpm-lock.yaml')
    if (sha256(reuseLockPath) !== REUSE_LOCK_SHA256) throw new Error(`reuse lock sha drifted from ${REUSE_LOCK_SHA256}`)
    const ryaml = (await import('yaml')).default ?? (await import('yaml'))
    const rlock = ryaml.parse(readFileSync(reuseLockPath, 'utf8'))
    const rdeps = rlock?.importers?.['.']?.dependencies ?? {}
    const verOf = (v) => String(typeof v === 'object' ? (v?.version ?? '') : (v ?? '')).split('(')[0]
    const pinMiss = Object.entries(FIFTEEN_PEER_PINS)
      .filter(([name, want]) => verOf(rdeps[name]) !== want)
      .map(([name, want]) => `${name} want ${want} got ${verOf(rdeps[name]) || 'ABSENT'}`)
    if (pinMiss.length > 0) throw new Error(`reuse 15-peer resolution mismatch: ${pinMiss.join('; ')}`)
    const fileEntry = verOf(rdeps['dsh-agent-team'])
    if (!fileEntry.startsWith('file:')) throw new Error(`reuse file: entry missing (got "${fileEntry}")`)
    const tgzFromLock = resolve(INSTALL, fileEntry.slice('file:'.length)) // lock file: paths are relative to the lock's own directory
    if (basename(tgzFromLock) !== basename(tgzPath)) throw new Error(`reuse product tgz name mismatch: ${tgzFromLock}`)
    if (sha256(tgzFromLock) !== PIN_PKG_SHA256) throw new Error(`reuse product tgz hash mismatch: ${tgzFromLock}`)
    writeFileSync(join(RUN_DIR, 'reuse-receipt.json'), JSON.stringify({
      reuseInstall: INSTALL, lockSha256: REUSE_LOCK_SHA256,
      peersVerified: Object.keys(FIFTEEN_PEER_PINS).length, productTgz: tgzFromLock, productTgzSha256: PIN_PKG_SHA256,
      mode: 'READ-ONLY reuse; install stage skipped; reused tree not written; no pnpm invoked',
    }, null, 2))
    log(`READ-ONLY REUSE: ${INSTALL} (lock verified ${REUSE_LOCK_SHA256.slice(0, 12)}…, 15 peers + product tgz verified; pnpm skipped)`)
  } else {
  // ② install: fixture manifest/lock + ONLY the file: entry; minimal
  //    lockfile-only update first, then frozen offline install.
  //    NOTE (root 23:5x phrasing law): execFileSync THROWS on any
  //    non-zero child exit — a normal return is a true proof of the
  //    pnpm child's exit 0 (plus the Done line + kit rc0).
  INSTALL = join(HOME, `install-${PIN_PKG_SHA256.slice(0, 9)}`)
  mkdirSync(INSTALL, { recursive: true })
  const fixtureManifest = JSON.parse(readFileSync(fixtureManifestPath, 'utf8'))
  writeFileSync(join(INSTALL, 'package.json'), JSON.stringify({
    name: fixtureManifest.name, version: fixtureManifest.version, private: true,
    dependencies: { ...fixtureManifest.dependencies, 'dsh-agent-team': `file:${tgzPath}` },
  }, null, 2))
  writeFileSync(join(INSTALL, 'pnpm-lock.yaml'), readFileSync(lockPath, 'utf8'))
  // The fixture's OWN proven store (node_modules/.modules.yaml storeDir):
  // workspace-warm AND sandbox-writable — the sqlite store index opens.
  const STORE = join(ROOT_DIR, 'tests', 'homes', '.pnpmm-r18-store')
  if (!existsSync(STORE)) throw new Error(`shared warm store absent: ${STORE}`)
  const lockLogFd = openSync(join(RUN_DIR, 'lockupdate.log'), 'a')
  // NORMAL minimal lock update: metadata may come from the registry (a
  // changed importer always revalidates metadata), but the result passes a
  // HARD DIFF GATE against the pinned fixture lock below — no existing
  // specifier/version may move — and the INSTALL itself is --offline from
  // the warm store, so a drifted version cannot be fetched or linked.
  execFileSync('pnpm', ['install', '--lockfile-only', '--ignore-workspace', `--store-dir=${STORE}`], { cwd: INSTALL, stdio: ['ignore', lockLogFd, lockLogFd] })
  {
    const yaml = (await import('yaml')).default ?? (await import('yaml'))
    const baseLock = yaml.parse(readFileSync(lockPath, 'utf8'))
    const newLock = yaml.parse(readFileSync(join(INSTALL, 'pnpm-lock.yaml'), 'utf8'))
    // Minimal-UPDATE gate on SUBSTANCE (versions + edges), not on pnpm's
    // peer-hash snapshot keys, which legitimately re-key when a new
    // importer edge joins. Rules: every base package keeps its exact
    // name@version; every base dependency edge keeps its exact
    // name@version; removals forbidden; the only new packages are the
    // dsh-agent-team file: entry (plus its declared edges at base
    // versions).
    const strip = (key) => key.split('(')[0]
    const edgeSet = (lock) => {
      const out = new Set()
      for (const [k, v] of Object.entries(lock?.snapshots ?? {})) {
        const self = strip(k)
        for (const [name, ver] of Object.entries({ ...(v?.dependencies ?? {}), ...(v?.optionalDependencies ?? {}) })) out.add(`${self} -> ${name}@${String(ver).split('(')[0]}`)
      }
      return out
    }
    const pkgSet = (lock) => new Set(Object.keys(lock?.snapshots ?? {}).map(strip))
    const basePkgs = pkgSet(baseLock)
    const newPkgs = pkgSet(newLock)
    const baseEdges = edgeSet(baseLock)
    const newEdges = edgeSet(newLock)
    const removedPkgs = [...basePkgs].filter((p) => !newPkgs.has(p))
    const addedPkgs = [...newPkgs].filter((p) => !basePkgs.has(p))
    const brokenEdges = [...baseEdges].filter((e) => !newEdges.has(e))
    // Additions are legal ONLY as (a) the dsh-agent-team file: entry or
    // (b) packages that base dependency EDGES already reference at the
    // same name@version (base materialized a subset — e.g. platform
    // optionals for other OSes — none of which an offline install can
    // fetch or link here anyway).
    const baseEdgeTargets = new Set([...baseEdges].map((e) => e.split(' -> ')[1]))
    // Version-move check: no base package NAME may gain a different
    // VERSION in the new lock. (This is the cordis-4.0.5 class of drift.)
    const versionsByName = (set) => {
      const m = new Map()
      for (const p of set) {
        const at = p.lastIndexOf('@')
        const name = p.slice(0, at)
        if (!m.has(name)) m.set(name, new Set())
        m.get(name).add(p.slice(at + 1))
      }
      return m
    }
    const baseV = versionsByName(basePkgs)
    const newV = versionsByName(newPkgs)
    const movedNames = [...baseV.keys()].filter((n) => [...(baseV.get(n) ?? [])].some((v) => !(newV.get(n) ?? new Set()).has(v)))
    // Additions are RECORDED and classified; the hard seal against new
    // runtime bytes is the final --offline install from the pinned
    // fixture store (only fixture-linked bytes exist here; everything
    // else is skipped as a non-applicable optional or fails loudly).
    const unreferencedAdds = addedPkgs.filter((p) => !p.startsWith('dsh-agent-team@') && !baseEdgeTargets.has(p))
    const irregular = removedPkgs.length > 0 || brokenEdges.length > 0 || movedNames.length > 0
      || Object.keys(newLock?.importers?.['.']?.dependencies ?? {}).length !== Object.keys(baseLock?.importers?.['.']?.dependencies ?? {}).length + 1
    writeFileSync(join(RUN_DIR, 'lock-diff.json'), JSON.stringify({ removedPkgs, movedNames, brokenEdges, addedCount: addedPkgs.length, unreferencedAdds, irregular }, null, 2))
    if (irregular) throw new Error(`lock update NOT minimal (drift gate): removed=${removedPkgs.length} movedNames=${movedNames.join(',') || '-'} brokenEdges=${brokenEdges.length} (${brokenEdges[0] ?? ''} | ${movedNames[0] ?? ''})`)
    log(`lock diff gate: ${basePkgs.size} base packages + ${baseEdges.size} base edges preserved, zero version moves; ${addedPkgs.length} additions recorded (${unreferencedAdds.length} beyond base-referenced: platform optionals, not linkable offline from the pinned store) — minimal update verified`)
  }
  const installLogFd = openSync(join(RUN_DIR, 'install.log'), 'a')
  // --ignore-scripts matches the fixture's proven state (.modules.yaml
  // pendingBuilds: node-pty/koffi/etc. unbuilt — the real host boots fine
  // that way) and is deterministic to boot.
  execFileSync('pnpm', ['install', '--frozen-lockfile', '--offline', '--ignore-workspace', '--ignore-scripts', `--store-dir=${STORE}`], { cwd: INSTALL, stdio: ['ignore', installLogFd, installLogFd] })
  execFileSync('chmod', ['-R', 'a-w', INSTALL], { stdio: 'ignore' })
  budget('install', INSTALL, WORLD_BUDGET.installBytesMax)
  }
  // ② entry resolved from the installed exports map (signed layout)
  const PKG_DIR = join(INSTALL, 'node_modules', 'dsh-agent-team')
  const installedManifest = JSON.parse(readFileSync(join(PKG_DIR, 'package.json'), 'utf8'))
  const hostExport = installedManifest?.exports?.['./host']
  if (typeof hostExport !== 'string') throw new Error(`installed exports['./host'] missing (signed layout mismatch)`)
  const HOST_ENTRY = join(PKG_DIR, hostExport.replace(/^\.\//, ''))
  if (!existsSync(HOST_ENTRY)) throw new Error(`exports-resolved host entry absent: ${HOST_ENTRY}`)
  log(`plugin entry resolved via exports['./host']: ${HOST_ENTRY}`)

  // blueprint (saved-source catalog = the real team.create path) — the
  // canonical v3 doc (root 01:1x final structure; real-parser validated)
  writeFileSync(join(HOME, 'blueprints', 'a5m2-sched-c2.yaml'), SAVED_BP_V3_YAML)

  if (DRY) {
    // no-boot dry path: REAL pre-flight to the boot boundary; STOP before
    // any listen/spawn; cleanup handles validated in shape.
    const dryPatch = join(HOME, 'dry-patch.yml')
    writePatch(dryPatch, pathToFileURL(HOST_ENTRY).href)
    const receipts = {
      dry: true, reachedBootBoundary: true, booted: false,
      portsAwaited: { host: HOST_PORT, hostIdle: !(await portInUse(HOST_PORT)), mock: MOCK_PORT, mockIdle: !(await portInUse(MOCK_PORT)) },
      manifestEntry: HOST_ENTRY, patchWritten: dryPatch,
      reuseInstall: REUSE_INSTALL, reuseLockSha256: REUSE_INSTALL !== null ? REUSE_LOCK_SHA256 : null,
      cleanupHandles: ['mock.close()', 'instance.stop()', 'waitForPortFree(HOST_PORT)', 'waitForPortFree(MOCK_PORT)'],
      budgetInstallBytes: duBytes(INSTALL),
    }
    writeFileSync(join(RUN_DIR, 'dry-receipts.json'), JSON.stringify(receipts, null, 2))
    log(`DRY receipts: ${JSON.stringify(receipts).slice(0, 400)}`)
    await cleanup()
    finish(cleanupOk ? 0 : 1) // ⑤ teardown NOT-OK forbids a green exit
    return
  }

  // ── mock model (⑦ closes every conversation; ⑧/⑨ receipts) ─────────────
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
    const text = lastUserText(req)
    const tools = req?.tools ?? req?.body?.tools ?? null // ⑧ member's OWN request only
    if (text.startsWith('TOOLS-CHECK') && Array.isArray(tools) && memberToolsSeen.length === 0) {
      for (const t of tools) {
        const n = typeof t === 'string' ? t : t?.function?.name ?? t?.name ?? t?.id
        if (typeof n === 'string') memberToolsSeen.push(n)
      }
      TRANSCRIPT.push({ channel: 'receipt', kind: 'member-tool-surface', tools: memberToolsSeen })
    }
    for (const m of req?.messages ?? req?.body?.messages ?? []) { // ⑨ role:tool correlation
      if (m?.role === 'tool') {
        const callId = typeof m?.tool_call_id === 'string' ? m.tool_call_id : ''
        const txt = typeof m?.content === 'string' ? m.content : JSON.stringify(m?.content ?? '')
        if (callId.length > 0 && !callResults.some((r) => r.callId === callId)) {
          const known = steps.get(callId)
          callResults.push({ callId, step: known?.step ?? null, toolName: known?.tool ?? 'unknown', text: txt })
        }
        continue
      }
      // Root reviewer card (388 harvest only knew role:tool): the real Host
      // Messages are NATIVE shape — assistant.content carries {type:'tool_use',
      // id} blocks and user.content carries {type:'tool_result', tool_use_id,
      // content, is_error} blocks (image b811 proven block shapes, helper
      // :725-775). Pair ONLY against ids this mock issued (steps map = same
      // call), feeding the SAME callResults sink so resultFor/emitOrClose see
      // them. Otherwise later resultFor would time out.
      if (!Array.isArray(m?.content)) continue
      for (const b of m.content) {
        if (b?.type !== 'tool_result') continue
        const callId = typeof b.tool_use_id === 'string' ? b.tool_use_id : ''
        if (callId.length === 0 || callResults.some((r) => r.callId === callId)) continue
        const known = steps.get(callId)
        if (known === undefined) continue // same-call pairing only
        const txt = typeof b.content === 'string' ? b.content : JSON.stringify(b.content ?? '')
        callResults.push({ callId, step: known.step, toolName: known.tool, text: txt, isError: b.is_error === true })
      }
    }
  }
  function decide({ req }) {
    harvest(req)
    const text = lastUserText(req)
    const mk = (step, name, args) => {
      const callId = `call-c2-${NONCE}-${step}`
      steps.set(callId, { step, tool: name })
      return { kind: 'tool-call', toolCalls: [{ id: callId, name, arguments: args }] }
    }
    const stepFor = (marker) => `member:${marker}`
    const emitOrClose = (marker, build) => (callResults.some((r) => r.step === stepFor(marker))
      ? { kind: 'text', content: `TURN-DONE ${NONCE}` } // ⑦ result seen -> close
      : (steps.has(`pending:${marker}`)
        ? { kind: 'text', content: `TURN-WAIT ${NONCE}` } // emitted, result not back yet: NEVER resend
        : (() => {
          steps.set(`pending:${marker}`, { step: stepFor(marker), tool: 'pending' })
          const spec = build()
          return mk(stepFor(marker), spec.name, spec.args)
        })()))
    if (text.startsWith('A5M2-C2-LEADER')) return emitOrClose(text, () => ({ name: 'team_create_member', args: { rootSessionId: currentRoot, requestToken: `c2-create-${NONCE}`, delegationTemplateId: 'sched-worker', label: 'sched1' } }))
    if (text.startsWith('TOOLS-CHECK')) return { kind: 'text', content: `ACK-C0 ${NONCE}` }
    if (text.startsWith('SEED-')) return emitOrClose(text, () => ({ name: 'schedule_create', args: { title: SEED_TITLES[Number(text.slice(5))], prompt: `a5m2 seed ${SEED_TITLES[Number(text.slice(5))]}`, after_seconds: 86_400 } })) // ⑤
    if (text.startsWith('LIST')) return emitOrClose(text, () => ({ name: 'schedule_list', args: {} }))
    if (text.startsWith('DELETE-ALPHA')) return emitOrClose(text, () => ({ name: 'schedule_delete', args: { id: seedIds[0] ?? 'unresolved' } }))
    if (text.startsWith('DELETE-BETA')) return emitOrClose(text, () => ({ name: 'schedule_delete', args: { id: seedIds[1] ?? 'unresolved' } }))
    if (text.startsWith('DELETE-ABSENT')) return emitOrClose(text, () => ({ name: 'schedule_delete', args: { id: ABSENT_ID } }))
    return { kind: 'text', content: `TURN-DONE ${NONCE}` }
  }

  // Root 23:03 ②③④: control facts over the PUBLIC wire only. Pages
  // team.getLedgerPage (pr-d :751-781 pattern: data.entries under the
  // .data-wrapped value, fail-loud on error pages); every row payload is
  // safeParse'd (durable tables store canonical JSON STRINGS, pr-d
  // :720-741); factType matched EXACTLY and payload.requestId compared
  // with strict equality — no JSON.stringify().includes, no regex.
  function safeParse(v) {
    if (v === null || v === undefined) return {}
    if (typeof v === 'object') return v
    try { return JSON.parse(v) } catch { return { raw: String(v).slice(0, 400) } }
  }
  async function controlFacts() {
    const byType = {
      'control-request-recorded': [],
      'control-decision-recorded': [],
      'control-allow-consumed': [],
      'control-request-abandoned': [],
    }
    let afterSequence = 0
    for (let pageNo = 0; pageNo < 50; pageNo += 1) {
      const page = await remoteCallReady('team.getLedgerPage', { teamSessionId: currentRoot, afterSequence, limit: 500 }, `c2-ledger-${pageNo + 1}`, 1)
      const pageErr = resultError(page.body)
      if (pageErr !== null) throw new Error(`team.getLedgerPage failed (page ${pageNo + 1}, afterSequence=${afterSequence}): ${pageErr.code} ${String(pageErr.message).slice(0, 300)}`)
      const data = resultData(page.body)
      const entries = Array.isArray(data?.entries) ? data.entries : []
      for (const e of entries) {
        if (byType[e?.factType] !== undefined) byType[e.factType].push({ sequence: e.sequence, payload: safeParse(e.payload) })
      }
      const next = data?.nextAfterSequence
      if (next === null || next === undefined || entries.length === 0) break
      afterSequence = Number(next)
    }
    return byType
  }
  // Pending = recorded MINUS decided MINUS abandoned, by strict
  // payload.requestId equality (root 23:03 ③; no raw-status guessing).
  async function pendingRequestIds() {
    const byType = await controlFacts()
    const ids = (list) => new Set(list.map((e) => e.payload?.requestId).filter((r) => typeof r === 'string'))
    const decided = ids(byType['control-decision-recorded'])
    const abandoned = ids(byType['control-request-abandoned'])
    return byType['control-request-recorded']
      .map((e) => e.payload?.requestId)
      .filter((r) => typeof r === 'string' && !decided.has(r) && !abandoned.has(r))
  }
  async function hasFact(requestId, factType) {
    const byType = await controlFacts()
    const hits = (byType[factType] ?? []).filter((e) => e.payload?.requestId === requestId)
    return hits.length > 0 ? hits[0] : false
  }

  // Member discovery (root 01:0x card): ONLY kind==='team-member' bindings
  // whose rootSessionId === currentRoot (binding-service.js:167-171 exact
  // record {instanceId, kind:'team-member', rootSessionId, sessionId}) joined
  // to the templateId==='sched-worker' template record by instanceId — the
  // unique sched-worker of the CURRENT team root. No any-session heuristic:
  // the bootstrap anchor root's leader/member facts can never surface here.
  function domainFacts() {
    const f = join(HOME, 'storages', 'team_domain.json')
    if (!existsSync(f)) return null
    const doc = safeParse(readFileSync(f, 'utf8'))
    const memberBindings = new Map() // instanceId -> sessionId (root-scoped)
    const templates = new Map() // instanceId -> templateId
    const seen = new Set()
    const walk = (n) => {
      if (typeof n === 'string') {
        if (n.length > 1 && (n.startsWith('{') || n.startsWith('[')) && !seen.has(n)) { seen.add(n); walk(safeParse(n)) }
        return
      }
      if (n === null || typeof n !== 'object') return
      if (Array.isArray(n)) { n.forEach(walk); return }
      if (n.kind === 'team-member' && n.rootSessionId === currentRoot && typeof n.sessionId === 'string' && typeof n.instanceId === 'string') {
        memberBindings.set(n.instanceId, n.sessionId)
      }
      if (typeof n.templateId === 'string' && typeof n.instanceId === 'string') {
        // join safety comes from the root-scoped binding map alone: the
        // anchor's instance ids can never appear in memberBindings.
        templates.set(n.instanceId, n.templateId)
      }
      for (const v of Object.values(n)) walk(v)
    }
    walk(doc)
    const hits = [...new Set([...memberBindings.entries()]
      .filter(([instanceId]) => templates.get(instanceId) === 'sched-worker')
      .map(([, sessionId]) => sessionId))]
    return hits.length === 1 ? hits[0] : null // unique-or-nothing: never guess, never anchor
  }
  async function driveGoverned(memberSession, marker, toolName, decision, tag) {
    const before = new Set(await pendingRequestIds())
    await apiPrompt(memberSession, marker, tag)
    const requestId = await waitFor(`new pending control request (${tag}, ${toolName})`, 120_000, async () => {
      const now = await pendingRequestIds()
      const fresh = now.filter((r) => !before.has(r))
      if (fresh.length === 0) return null
      if (fresh.length > 1) throw new Error(`${tag}: expected exactly ONE new pending control request, saw ${fresh.length}: ${fresh.join(',')}`)
      return fresh[0]
    })
    if (decision !== null) {
      const res = await remoteCallReady('team.resolveControl', { teamSessionId: currentRoot, requestId, decision, note: `sched-c2 ${tag}` }, tag, 4)
      if (resultError(res.body) !== null) throw new Error(`resolveControl ${decision} ${tag}: ${JSON.stringify(resultError(res.body)).slice(0, 300)}`)
    }
    return requestId
  }
  const resultFor = (step) => waitFor(`${step} tool result`, 90_000, () => {
    const hit = callResults.find((r) => r.step === step)
    return hit ? hit.text : null
  })

  // ── boot ────────────────────────────────────────────────────────────────
  currentCriterion = 'boot'
  mock = await startMockModel({ port: MOCK_PORT, decide, log: (l) => TRANSCRIPT.push({ channel: 'mock', line: String(l).slice(0, 200) }) })
  process.env.DEEPSEEK_BASE_URL = `http://127.0.0.1:${MOCK_PORT}`
  // Center card 00:4x (aligns proven image b811 :1413 shape): the Host child
  // (inherits this env) needs a credential present for the mock route. This
  // is an EXPLICIT NON-SECRET dummy (world-NONCE scoped), valid ONLY against
  // the 127.0.0.1 mock. No real key, no global config, no account touched.
  process.env.DEEPSEEK_API_KEY = `c2-mock-${NONCE}`
  const instLogDir = join(RUN_DIR, 'instance')
  mkdirSync(instLogDir, { recursive: true })
  instance = new DshInstance({ hostTree: HOST_TREE, dshHome: HOME, port: HOST_PORT, clientCommitHash: CLIENT_COMMIT_HASH, logDir: instLogDir }) // ⑩ before start
  writePatch(instance.patchFile, pathToFileURL(HOST_ENTRY).href)
  const started = await instance.start({ timeoutMs: 240_000 })
  const m = /^http:\/\/127\.0\.0\.1:(\d+)\/\?token=([A-Za-z0-9_-]+)$/.exec(started.url)
  if (m === null) throw new Error('unexpected boot url shape')
  origin = `http://127.0.0.1:${m[1]}`
  const auth = await fetch(`${origin}/?token=${m[2]}`, { redirect: 'manual', signal: AbortSignal.timeout(30_000) })
  if (auth.status !== 303 || auth.headers.get('set-cookie') === null) throw new Error(`authenticate status=${auth.status} (expected 303 + set-cookie)`)
  cookie = auth.headers.get('set-cookie').split(';', 1)[0]
  log(`host booted at ${origin}`)

  // ④ Team root = SYNTHETIC UNUSED session id (center card 00:2x; proven image
  // b811 shape a5m2-todo-c2.mjs:171/:1510/:1515): team.create MINTS the root
  // itself. NO session/create for the team root — an already-opened ordinary
  // session carries a held active write handle and Team-mode refuses a second
  // agent under one session (host session-persistence/src/errors.ts:34; the
  // product's own conflict class s6-remote.js:757-758). All later PUBLIC
  // addressing (apiPrompt, resolveControl, ledger pages, member discovery)
  // targets the minted team session through currentRoot.
  currentCriterion = 'setup'
  currentRoot = `session-a5m2c2-p-${RUN_STAMP}`
  // READ-ONLY readiness barrier first (root 02:1x); after it passes the
  // write request team.create is issued EXACTLY ONCE (never retried).
  await teamReadyBarrier()
  const team = await remoteCall('team.create', { rootSessionId: currentRoot, blueprintId: BP_ID }, 'c2-create', 1)
  const teamErr = resultError(team.body)
  if (teamErr !== null) throw new Error(`team.create: ${JSON.stringify(teamErr).slice(0, 400)}`)
  log(`team created at root session ${currentRoot}`)

  await apiPrompt(currentRoot, `A5M2-C2-LEADER ${NONCE}`, 'c2-leader')
  const memberSession = await waitFor('member session in team_domain', 120_000, () => domainFacts())
  log(`member session ${memberSession}`)

  // C0 visibility receipt BEFORE any seed
  currentCriterion = 'C0'
  await apiPrompt(memberSession, `TOOLS-CHECK ${NONCE}`, 'c2-c0')
  await waitFor('member tool surface', 60_000, () => (memberToolsSeen.length > 0 ? true : null))
  const need = ['schedule_create', 'schedule_list', 'schedule_delete']
  const missing = need.filter((n) => !memberToolsSeen.includes(n))
  check('C0', 'member surface visibly carries legal create + governed pair', missing.length === 0,
    `visible=${memberToolsSeen.join(',')} missing=${missing.join(',') || 'none'}`)

  // seeds: legal native create; exactly one id per receipt
  currentCriterion = 'seed'
  const seedIds = []
  for (let i = 0; i < 3; i += 1) {
    await apiPrompt(memberSession, `SEED-${i}`, `c2-seed${i}`)
    const res = await resultFor(stepOuter(`SEED-${i}`))
    const ids = [...String(res).matchAll(/sch_[A-Za-z0-9_-]+/g)].map((x) => x[0])
    if (ids.length !== 1) throw new Error(`seed ${i} ids=${ids.length} result=${String(res).slice(0, 250)}`)
    seedIds.push(ids[0])
  }
  budget('state', HOME, WORLD_BUDGET.stateBytesMax)

  function stepOuter(marker) { return `member:${marker}` }

  // C1
  currentCriterion = 'C1'
  {
    const requestId = await driveGoverned(memberSession, 'LIST-1', 'schedule_list', 'allow', 'c2-c1')
    const res = await resultFor(stepOuter('LIST-1'))
    const consumed = await hasFact(requestId, 'control-allow-consumed')
    check('C1', 'list returns all three real records after ALLOW; control-allow-consumed for THIS requestId',
      SEED_TITLES.every((t) => res.includes(t)) && seedIds.every((id) => res.includes(id)) && consumed !== false,
      `requestId=${requestId} consumedFact=${JSON.stringify(consumed).slice(0, 200)} result=${String(res).slice(0, 300)}`)
  }
  // C2
  currentCriterion = 'C2'
  {
    await driveGoverned(memberSession, 'DELETE-ALPHA', 'schedule_delete', 'allow', 'c2-c2del')
    await driveGoverned(memberSession, 'LIST-2', 'schedule_list', 'allow', 'c2-c2lst')
    const res = await resultFor(stepOuter('LIST-2'))
    check('C2', 'granted delete ALPHA -> successor list lacks ALPHA keeps BETA+GAMMA',
      !res.includes(seedIds[0]) && res.includes(seedIds[1]) && res.includes(seedIds[2]), `list=${String(res).slice(0, 300)}`)
  }
  // C3
  currentCriterion = 'C3'
  {
    const requestId = await driveGoverned(memberSession, 'DELETE-BETA', 'schedule_delete', 'deny', 'c2-c3')
    await driveGoverned(memberSession, 'LIST-3', 'schedule_list', 'allow', 'c2-c3lst')
    const res = await resultFor(stepOuter('LIST-3'))
    const consumed = await hasFact(requestId, 'control-allow-consumed')
    check('C3', 'public DENY on delete BETA -> BETA still listed; no control-allow-consumed for the denied requestId',
      res.includes(seedIds[1]) && consumed === false, `requestId=${requestId} consumedFact=${JSON.stringify(consumed)} list=${String(res).slice(0, 250)}`)
  }
  // C4 — ⑥ public session/cancel + EXACT control-request-abandoned fact
  currentCriterion = 'C4'
  {
    const before = new Set(await pendingRequestIds())
    await apiPrompt(memberSession, 'LIST-4-ABANDON', 'c2-c4')
    const requestId = await waitFor('new pending control request (c2-c4)', 120_000, async () => {
      const fresh = (await pendingRequestIds()).filter((r) => !before.has(r))
      if (fresh.length === 0) return null
      if (fresh.length > 1) throw new Error(`c2-c4: expected exactly ONE new pending request, saw ${fresh.join(',')}`)
      return fresh[0]
    })
    await apiCancel(memberSession, 'c2-c4-cancel')
    const abandonFact = await waitFor(`control-request-abandoned for ${requestId}`, 90_000, async () => await hasFact(requestId, 'control-request-abandoned'))
    await driveGoverned(memberSession, 'LIST-5', 'schedule_list', 'allow', 'c2-c4lst')
    const res = await resultFor(stepOuter('LIST-5'))
    check('C4', 'public session/cancel -> control-request-abandoned for the exact requestId; records unchanged',
      res.includes(seedIds[1]) && res.includes(seedIds[2]) && !res.includes(seedIds[0]),
      `requestId=${requestId} abandonFact=${JSON.stringify(abandonFact).slice(0, 200)}`)
  }
  // C5
  currentCriterion = 'C5'
  {
    await driveGoverned(memberSession, 'DELETE-ABSENT', 'schedule_delete', 'allow', 'c2-c5')
    const res = await resultFor(stepOuter('DELETE-ABSENT'))
    check('C5', 'absent-id granted delete returns the real error value (invalid_selector)', res.includes('invalid_selector'), `result=${String(res).slice(0, 300)}`)
  }

  await cleanup()
  finish(results.every((r) => r.ok) && cleanupOk ? 0 : 1) // ⑤ teardown NOT-OK forbids 0
}
main().then(
  () => {},
  async (e) => {
    const rc = String(e?.message ?? '').startsWith('CRIT-FAIL') ? 1 : 2
    log(`FATAL (${currentCriterion}): ${String(e?.stack ?? e).slice(0, 500)}`)
    await cleanup()
    finish(rc)
  },
)
