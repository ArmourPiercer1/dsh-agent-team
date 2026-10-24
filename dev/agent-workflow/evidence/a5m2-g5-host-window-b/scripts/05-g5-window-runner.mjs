#!/usr/bin/env node
/**
 * A5M2 G5 host-window runner — Window B (root B-slot dispatch 2026-10-28):
 * PREP ONLY — NOT booting; execution awaits root's separate A/B-no-conflict GO.
 * ONE boot, exactly TWO real governed G5 calls — one ALLOW chain and one DENY
 * chain of the READ arm (get_goal) — over the public wire only. NO direct arm
 * calls, NO invented Host API, NO placeholder asserts:
 * every call shape is copied from the FOURTH-successful Team-window runner
 * (tests/kits/a5m2-schedule-c2/a5m2-schedule-c2.mjs, cited line by line).
 *
 * The public chain is the A-window's REAL launched runner (8e62 g3 lane, cited
 * line by line there); only the G5 family surface differs: the mount intent is
 * the closed `teamToolPlane.g5Goal` bit (the mount arm in the pack's
 * agent-bindings, blob cd9df2f3…), the PA lane is the SAME plane paAdmit seat
 * (the G5 bridge composes {open, edge, closePlan} onto it), and the goal names
 * are NOT in the 37646 blueprint PERMISSION_TOOL_NAMES vocabulary — the ask is
 * FAMILY-STRUCTURAL (tool-admission approval case -> durable Control request),
 * no blueprint rule is possible or needed. fsInstance is ABSENT BY DESIGN: the
 * G5 family mounts no fs family; the A-window's COMPLETE four-field
 * ControlledFsInstance shape (fs/rootDir/realmId/kind:absolute-path) applies
 * ONLY if an fs-governed family is enabled in this world — no field guessed.
 *
 * BOOT remains behind the root's ruling: A5M2_G5_WINDOW=GRANTED. Without it
 * the runner prints a NOT_RUN receipt and exits NON-ZERO (rc 3) — NOT_RUN is
 * never a green line. A no-boot dry path (A5M2_G5_DRY=1) runs the REAL
 * pre-flight to the boot boundary (install -> entry resolution -> patch) and
 * stops BEFORE any spawn; dry proves only up-to-boundary facts.
 *
 * PRODUCT is an EXPLICIT INPUT, never an old pin (root: no 161e4/699cc/874f
 * masquerading as the new pack):
 *   A5M2_G5_INSTALL_DIR   the f86-built fixture install dir (READ-ONLY
 *                           reuse; default is f86's named path below). The
 *                           runner NEVER installs, lock-updates or chmods —
 *                           root FS narrow-audit order (a recursive chmod
 *                           would reach the shared store's hardlinks).
 *   A5M2_G5_COMPOSED_SHA  optional; when given MUST equal the pinned product
 * This runner's own full SHA is recorded separately (runner-identity.json).
 *
 * Evidence law: RUN_DIR keeps raw transcripts/instance logs; the HOME world is
 * NEVER deleted by this runner (root: keep old HOME/raw — teardown does NOT
 * rm evidence); cleanup stops the Host + mock and verifies ports + this
 * runner's own world lock only.
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

const COMPOSED_SHA = '37646ac288dbd0ee3c998343dc91fd1a8da7a2d5' // fixed product (root B-slot dispatch)
const G5_BLOB_SERVICE = '8a98ee550cfb21a8cd427be7a73b2f83793f6ffff9a7f36d3def162070a3ab5a' // pack dist == lane delegate src, byte-identical (this tree measured)
const G5_BLOB_WIRING = 'c87f3db5aef3b2064fe16b18c516758d66dddca7683aec07fdf0351134b8c2e7'
const G5_BLOB_BINDINGS = 'cd9df2f3e610c41b2dbe5330189cbc24251379b4eb1f04aa97bf1ae5bb280435' // the mount-arm carrier
const LOCK_SHA256 = '7685317ff1ba675f6d3f6b012907360579c3c85bd1bc3319d0248483bde3c659' // the installed fixture's pnpm-lock (read-only reuse; absent/drift => fail closed, NEVER re-installed)
const PACK_BYTES_MAX = 8_000_000
const HOST_PORT = 3184 // B window; A owns 3183/3498, 3080 stable, 3180/3181 durable — disjoint by construction
const MOCK_PORT = 3499
const WORLD_PREFIX = 'a5m2-g5-hw-b'
const BP_ID = 'team.a5m2-g5-hw'
const WINDOW_GO = process.env.A5M2_G5_WINDOW === 'GRANTED'
const DRY = process.env.A5M2_G5_DRY === '1'
// SYNC CARD 2026-10-28 (root order): ONLY these parameter/expectation
// constants moved with the product 5c313418 -> 37646ac2; d66's execution
// logic is untouched. The old pack hash 0a3f11b2... MUST NOT be inherited —
// the NEW tgz hash arrives as an explicit receipt input, no default.
// driver SHA (the d66 signed logic, carried by HEAD) and product SHA (below)
// are separate facts and stay recorded separately in runner-identity.json.
const INSTALL_DIR = process.env.A5M2_G5_INSTALL_DIR ?? null // f86's NEW final full path, REQUIRED (locator swapped with the repack)
const PACK_COMPOSED = process.env.A5M2_G5_COMPOSED_SHA ?? null
const EXPECTED_PACK_SHA = process.env.A5M2_G5_PACK_SHA256 ?? null // REQUIRED: full hash from f86's new receipt (sha256: prefix)
const EXPECTED_TGZ_NAME = process.env.A5M2_G5_TGZ_NAME ?? 'dsh-agent-team-0.1.1-alpha.2.tgz' // same tree -> same name unless the receipt says otherwise
const EXPECTED_TGZ_DIR_PREFIX = 'out-37646ac2-' // full dir arrives in the receipt; the segment must carry the new product prefix

function notRun(reason) {
  console.log(JSON.stringify({ implemented: true, booted: false, dry: DRY, verdict: 'NOT_RUN', reason }, null, 2))
  process.exit(3) // NOT_RUN is NON-ZERO by root order
}
if (!WINDOW_GO && !DRY) notRun('window env A5M2_G5_WINDOW not GRANTED (root A/B-no-conflict GO pending) — nothing booted')
if (PACK_COMPOSED !== null && PACK_COMPOSED !== COMPOSED_SHA) notRun(`A5M2_G5_COMPOSED_SHA ${PACK_COMPOSED} is not the pinned product ${COMPOSED_SHA}`)
if (INSTALL_DIR === null) notRun('A5M2_G5_INSTALL_DIR is REQUIRED: f86\'s new final full fixture path from the new receipt (locator swapped with the repack)')
if (EXPECTED_PACK_SHA === null) notRun('A5M2_G5_PACK_SHA256 is REQUIRED: the NEW tgz full hash from f86\'s receipt — the old 0a3f11b2 hash is retired and must not be inherited')
if (!EXPECTED_PACK_SHA.startsWith('sha256:')) notRun('A5M2_G5_PACK_SHA256 must carry the sha256: prefix')

const ROOT_DIR = findTestRepoRoot(dirname(fileURLToPath(import.meta.url)))
if (ROOT_DIR === null) { console.error('findTestRepoRoot returned null'); process.exit(3) }
const HOST_TREE = join(ROOT_DIR, 'tests', 'deepseek-harness-test-use')
if (!existsSync(HOST_TREE)) notRun(`639 host checkout absent at ${HOST_TREE}`)

// (root FS narrow-audit: the old bf4 fixture/lock/store preconditions are REMOVED;
// the only install face is the f86 fixture below, read-only.)

const ANCHOR_V3_YAML = [
  '---', 'schemaVersion: 3', `blueprintId: ${BP_ID}.boot-anchor`, 'revision: "1"',
  'leader:', '  templateId: leader', '  persona: "You are the leader of the A5M2 G5 window B team."',
  'members:', '  - templateId: g5-worker', '    persona: "You are a worker of the A5M2 G5 window B team."',
  'memberEnvelopes: []', 'requirements: []',
  'permissionMutationEnvelope:', '  rules: []',
  'teamHardEnvelope:', '  rules: []',
  'policyStates: []', 'metadata: {}', '---', '',
].join('\n')
// worker: NO team tools, NO skills/mcp, default deny, ask ONLY on the governed
// G5 READ arm pair — the real family-structural PA approval lane, allow + deny.
const SAVED_BP_V3_YAML = [
  '---', 'schemaVersion: 3', `blueprintId: ${BP_ID}`, 'revision: "1"',
  'leader:', '  templateId: leader', '  persona: "You are the leader of the A5M2 G5 window B team."',
  'members:', '  - templateId: g5-worker',
  '    persona: "You are the G5 worker. Follow the marker instructions literally and only."',
  '    capabilities:', '      teamTools:', '        kind: deny',
  '      builtinToolDeny:', // COVERAGE LAW (root correction: managed = OWNERSHIP, not a vocabulary claim; nothing is exempt from delivery). A-window-2 measured the final-surface set this world shares (refusal alpha2-permission-coverage-unmanaged-tools, 15 names). Here the G5 trio create_goal/get_goal/update_goal is OWNED by the mounted plane rows (GLUE-5: agent-bindings :6993-7005 passes a5PlaneOwnNames into the gate under the team-tool authority owner) — denying them would deny THIS window's tested subject, so the removal set is A's 15 MINUS the trio = the 12 names below, each carrying no ownership record in this isolated test world. Removal is exposure-shrink for the test, not a product verdict.
  '        - ask_user_question', '        - exit_plan_mode',
  '        - glob', '        - grep', '        - job_kill',
  '        - job_list', '        - job_output', '        - present', '        - skill',
  '        - web_fetch', '        - web_search', '        - workflow',
  '      skills:', '        kind: deny', '      mcp:', '        kind: deny',
  '      permissions:', '        default: deny', '        allow: []', '        ask: []', '        deny: []',
  '        # NO goal rule is possible at 37646: the goal names are outside the closed',
  '        # PERMISSION_TOOL_NAMES vocabulary; the G5 PA ask is family-STRUCTURAL via',
  '        # the plane paAdmit seat (tool-admission approval case), never a lane rule.',
  'teamEnvelope:', '  allow:',
  '    - assign-task', '    - create-member', '    - send-message',
  '    - report-progress', '    - request-control', '    - resolve-control',
  '  deny: []',
  'memberEnvelopes: []', 'requirements: []',
  'permissionMutationEnvelope:', '  rules: []',
  'teamHardEnvelope:', '  rules: []',
  'policyStates: []', 'metadata: {}', '---', '',
].join('\n')

const NONCE = Math.random().toString(36).slice(2, 8)
const RUN_STAMP = new Date().toISOString().replace(/[:.]/g, '-')
const HOME = join(ROOT_DIR, 'tests', 'homes', `${WORLD_PREFIX}${DRY ? '-dry' : ''}-${RUN_STAMP}Z`)
const FSROOT = join(HOME, 'fsroot') // manifest rootDir = THIS new world, never cwd
const RUN_DIR = join(ROOT_DIR, 'dev', 'agent-workflow', 'evidence', 'a5m2-g5-host-window-b', `runs-${DRY ? 'dry-' : ''}${RUN_STAMP}`)
const TRANSCRIPT = []
const results = []
const steps = new Map()
const callResults = []
const memberToolsSeen = []
let currentCriterion = 'setup'
let mock = null
let instance = null // registered BEFORE start (fourth-window ⑩)
let cleanupOk = true
const log = (line) => { console.log(`[g5-hw] ${line}`) }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
function check(critId, name, ok, detail) {
  results.push({ critId, name, ok, detail: String(detail).slice(0, 600) })
  log(`${critId} ${ok ? 'PASS' : 'FAIL'} — ${name}`)
  if (!ok) throw new Error(`CRIT-FAIL ${critId}: ${name}`)
}
const sha256 = (file) => createHash('sha256').update(readFileSync(file)).digest('hex')
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
    writeFileSync(join(RUN_DIR, 'results.json'), JSON.stringify({ stamp: RUN_STAMP, dry: DRY, rc, composedSha: COMPOSED_SHA, results, transcript: TRANSCRIPT.slice(-400) }, null, 2))
  } finally { process.exit(rc) }
}
async function cleanup() {
  const notes = []
  try { if (mock !== null) { await mock.close(); notes.push('mock closed') } } catch (e) { notes.push(`mock close ERR ${String(e).slice(0, 120)}`) }
  try { if (instance !== null) { const r = await instance.stop({ timeoutMs: 30_000 }); notes.push(`instance stopped killed=${r.killed} portFree=${r.portFree}`) } } catch (e) { notes.push(`instance stop ERR ${String(e).slice(0, 120)}`) }
  for (const p of [HOST_PORT, MOCK_PORT]) {
    try { const free = await waitForPortFree(p, 10_000); notes.push(`port ${p} free=${free}`) } catch (e) { notes.push(`port ${p} ERR ${String(e).slice(0, 120)}`) }
  }
  // THIS runner's own world lock only; HOME and raw are NEVER deleted (root law).
  try { const lk = join(HOME, 'a5m2-g5-hw-lock.json'); if (existsSync(lk)) notes.push('world lock retained (evidence)') } catch { /* keep */ }
  const ok = !notes.some((n) => n.includes('ERR') || n.includes('free=false'))
  cleanupOk = ok
  log(`cleanup (${ok ? 'OK' : 'NOT-OK'}): ${notes.join(' | ')}`)
  return { ok, notes }
}

// ── explicit product pin (fail closed) ─────────────────────────────────────
// ── ② explicit fixture reuse (READ-ONLY; absent => fail-closed rc3) ───────
if (INSTALL_DIR === null) notRun('A5M2_G5_INSTALL_DIR is REQUIRED (the pinned read-only fixture path; this runner never installs)')
if (!existsSync(INSTALL_DIR)) notRun(`pinned fixture install dir absent (read-only reuse of the 37646ac2 fixture; this runner does NOT create or install it): ${INSTALL_DIR}`)
{
  const fixManifestPath = join(INSTALL_DIR, 'package.json')
  if (!existsSync(fixManifestPath)) { console.error(`fixture manifest absent: ${fixManifestPath}`); process.exit(3) }
  const fixDeps = JSON.parse(readFileSync(fixManifestPath, 'utf8'))?.dependencies?.['dsh-agent-team']
  if (typeof fixDeps !== 'string' || !fixDeps.startsWith('file:')) { console.error(`fixture manifest plugin file: entry missing (got ${JSON.stringify(fixDeps)})`); process.exit(3) }
  const fileTarget = fixDeps.slice('file:'.length)
  const resolvedTgz = fileTarget.startsWith('/') ? fileTarget : resolve(INSTALL_DIR, fileTarget)
  if (basename(resolvedTgz) !== EXPECTED_TGZ_NAME || !basename(dirname(resolvedTgz)).startsWith(EXPECTED_TGZ_DIR_PREFIX)) { console.error(`fixture file: target is NOT the new pack (want ${EXPECTED_TGZ_DIR_PREFIX}*/${EXPECTED_TGZ_NAME}): ${resolvedTgz}`); process.exit(3) }
  if (!existsSync(resolvedTgz)) { console.error(`new pack tgz absent behind the fixture pointer: ${resolvedTgz}`); process.exit(3) }
  if (statSync(resolvedTgz).size > PACK_BYTES_MAX) { console.error('pack bytes exceed the bound'); process.exit(3) }
  if (`sha256:${sha256(resolvedTgz)}` !== EXPECTED_PACK_SHA) { console.error(`pack sha256 drifted from the pinned ${EXPECTED_PACK_SHA}`); process.exit(2) }
  var tgzPath = resolvedTgz
}
const PKG_DIR_READ = join(INSTALL_DIR, 'node_modules', 'dsh-agent-team')
if (!existsSync(PKG_DIR_READ)) notRun(`f86 fixture not yet installed (node_modules/dsh-agent-team absent): ${PKG_DIR_READ}`)

function writePatch(patchPath, hostEntryHref) {
  mkdirSync(dirname(patchPath), { recursive: true })
  writeFileSync(patchPath, [
    `- insert:`,
    '    - id: dsh-agent-team',
    `      name: ${JSON.stringify(hostEntryHref)}`,
    '      config:',
    "        bootPhase: 'create'",
    `        rootSessionId: ${JSON.stringify(`session-a5m2g5hw-boot-${RUN_STAMP}`)}`,
    '        blueprintSource: |-',
    ...ANCHOR_V3_YAML.replace(/\n$/, '').split('\n').map((l) => `          ${l}`),
    `        blueprintDir: ${JSON.stringify(join(HOME, 'blueprints'))}`,
    '        seedMembers: []',
    '        generation: 1',
    '        staticModel:', '          provider: deepseek-official', '          model: a5m2-g5-window-model',
    '        deniedSelection: null', '        mcpServers: []', '        mcpServer: null',
    '        environmentFacts: []', '        externalPolicyFacts:', '          hard: {}', '          capabilityExists: {}',
    '        teamToolPlane:', // THE G5 GATE: the closed intent bit ONLY (the arm reads NOTHING else from config — every goal fact is a live read)
    '          g5Goal: true',
    "          realmId: 'a5m2-g5-hw-realm'", // pinned so a5PlaneRealmId is static (the fallback would embed the dynamic teamRoot into every placement identity)
    '          # fsInstance intentionally ABSENT: no fs-governed family is enabled.',
    '          # If one ever is, the A-window contract applies verbatim: the COMPLETE',
    '          # four-field shape fs/rootDir/realmId/kind:absolute-path with realmId',
    '          # EQUAL to the plane realmId — a partial shape is a config defect and',
    '          # the mount is refused (A-window measured fact, no guessing).',
  ].join('\n'))
}

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
const apiPrompt = (sessionId, text, tag) => sessionRpc('prompt', { requestId: `ghw-prompt-${NONCE}-${tag}-${promptSeq += 1}`, sessionId, mode: 'queue', content: [{ type: 'text', text }] }, tag)

async function teamReadyBarrier(budgetMs = 180_000) {
  const deadline = Date.now() + budgetMs
  let polls = 0
  for (;;) {
    polls += 1
    const res = await remoteCall('team.listRoots', {}, 'ghw-ready', 3)
    const err = resultError(res.body)
    if (err === null) { log(`team runtime READY (polls=${polls})`); return }
    const starting = err.code === 'internal-error' && err.details?.reason === 'runtime-not-ready' && String(err.message).includes('state: starting')
    if (!starting) throw new Error(`readiness barrier STOP (polls=${polls}): ${JSON.stringify(err).slice(0, 400)}`)
    if (Date.now() >= deadline) throw new Error('readiness barrier budget exhausted while starting')
    await sleep(1500)
  }
}
function safeParse(v) {
  if (v === null || v === undefined) return {}
  if (typeof v === 'object') return v
  try { return JSON.parse(v) } catch { return { raw: String(v).slice(0, 400) } }
}
async function controlFacts() {
  const byType = { 'control-request-recorded': [], 'control-decision-recorded': [], 'control-allow-consumed': [], 'control-request-abandoned': [] }
  let afterSequence = 0
  for (let pageNo = 0; pageNo < 50; pageNo += 1) {
    const page = await remoteCallReady('team.getLedgerPage', { teamSessionId: currentRoot, afterSequence, limit: 500 }, `ghw-ledger-${pageNo + 1}`, 1)
    const pageErr = resultError(page.body)
    if (pageErr !== null) throw new Error(`team.getLedgerPage failed: ${JSON.stringify(pageErr).slice(0, 200)}`)
    const data = resultData(page.body)
    const entries = Array.isArray(data?.entries) ? data.entries : []
    for (const e of entries) if (byType[e?.factType] !== undefined) byType[e.factType].push({ sequence: e.sequence, payload: safeParse(e.payload) })
    const next = data?.nextAfterSequence
    if (next === null || next === undefined || entries.length === 0) break
    afterSequence = Number(next)
  }
  return byType
}
async function pendingRequestIds() {
  const byType = await controlFacts()
  const ids = (list) => new Set(list.map((e) => e.payload?.requestId).filter((r) => typeof r === 'string'))
  const decided = ids(byType['control-decision-recorded'])
  const abandoned = ids(byType['control-request-abandoned'])
  return byType['control-request-recorded'].map((e) => e.payload?.requestId)
    .filter((r) => typeof r === 'string' && !decided.has(r) && !abandoned.has(r))
}
async function hasFact(requestId, factType) {
  const byType = await controlFacts()
  const hits = (byType[factType] ?? []).filter((e) => e.payload?.requestId === requestId)
  return hits.length > 0 ? hits[0] : false
}
function domainFacts() {
  const f = join(HOME, 'storages', 'team_domain.json')
  if (!existsSync(f)) return null
  const doc = safeParse(readFileSync(f, 'utf8'))
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
  const hits = [...new Set([...memberBindings.entries()].filter(([i]) => templates.get(i) === 'g5-worker').map(([, s]) => s))]
  return hits.length === 1 ? hits[0] : null
}
async function driveGoverned(memberSession, marker, decision, tag) {
  const before = new Set(await pendingRequestIds())
  await apiPrompt(memberSession, marker, tag)
  const requestId = await waitFor(`new pending control request (${tag})`, 120_000, async () => {
    const fresh = (await pendingRequestIds()).filter((r) => !before.has(r))
    if (fresh.length === 0) return null
    if (fresh.length > 1) throw new Error(`${tag}: expected exactly ONE new pending request, saw ${fresh.length}`)
    return fresh[0]
  })
  const res = await remoteCallReady('team.resolveControl', { teamSessionId: currentRoot, requestId, decision, note: `g5-hw ${tag}` }, tag, 4)
  if (resultError(res.body) !== null) throw new Error(`resolveControl ${decision} ${tag}: ${JSON.stringify(resultError(res.body)).slice(0, 300)}`)
  return requestId
}
const resultFor = (step) => waitFor(`${step} tool result`, 90_000, () => {
  const hit = callResults.find((r) => r.step === step)
  return hit ? hit.text : null
})

async function main() {
  currentCriterion = 'preflight'
  const hostBusy = await portInUse(HOST_PORT)
  const mockBusy = await portInUse(MOCK_PORT)
  if (hostBusy || mockBusy) throw new Error(`ports busy at start: host=${hostBusy} mock=${mockBusy} (plan: 3184/3499 (A owns 3183/3498); 3080 stable, 3180/3181 durable never touched)`)
  if (existsSync(HOME) && readdirSync(HOME).length > 0) throw new Error(`home ${HOME} exists non-empty — fail closed`)
  for (const p of [HOME, join(HOME, 'blueprints'), join(HOME, 'storages'), FSROOT, RUN_DIR]) mkdirSync(p, { recursive: true })
  if (process.env.A5M2_G5_HOME_POINTER) { // explicit HOME hand-off to the monitor (no globbing; written BEFORE boot so a boot failure is still auditable)
    try { writeFileSync(process.env.A5M2_G5_HOME_POINTER, `${HOME}\n`) } catch { /* monitor hint best-effort; window verdict never depends on it */ }
  }
  writeFileSync(join(HOME, 'a5m2-g5-hw-lock.json'), JSON.stringify({ world: HOME, pid: process.pid, runner: '05-g5-window-runner.mjs', composedSha: COMPOSED_SHA, packSha256: EXPECTED_PACK_SHA, stamp: RUN_STAMP }, null, 2))
  try {
    const selfSha = execFileSync('git', ['-C', ROOT_DIR, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim()
    writeFileSync(join(RUN_DIR, 'runner-identity.json'), JSON.stringify({ runnerFullSha: selfSha, runnerFileSha256: sha256(fileURLToPath(import.meta.url)), composedSha: COMPOSED_SHA, packTgz: tgzPath, packSha256: EXPECTED_PACK_SHA, installDir: INSTALL_DIR, armBlobExpectations: { g5GoalService: G5_BLOB_SERVICE, g5GoalWiring: G5_BLOB_WIRING, agentBindings: G5_BLOB_BINDINGS, fixtureLock: LOCK_SHA256 } }, null, 2))
  } catch { /* identity best-effort; window verdict never depends on it */ }
  // NO fs target: the G5 family governs no fs. The fsroot dir stays (world
  // layout habit); teamToolPlane carries NO fsInstance, so no governed-fs
  // mount is even attempted here.

  // ── ②③ REAL entry resolution from the f86 fixture (READ-ONLY: no install,
  // no lockfile-only, no chmod — root FS narrow-audit order) ──────────────
  {
    const installedManifest = JSON.parse(readFileSync(join(PKG_DIR_READ, 'package.json'), 'utf8'))
    const hostExport = installedManifest?.exports?.['./host']
    if (typeof hostExport !== 'string') throw new Error('fixture plugin exports["./host"] missing')
    var HOST_ENTRY = resolve(PKG_DIR_READ, hostExport.replace(/^\.\//, ''))
    if (!existsSync(HOST_ENTRY)) throw new Error(`host entry absent: ${HOST_ENTRY}`)
    var distArm = join(PKG_DIR_READ, 'packages/runtime/dist/packages/runtime/src/plugin/live/governed-families/g5-goal-service.mjs')
    const distWiring = join(PKG_DIR_READ, 'packages/runtime/dist/packages/runtime/src/plugin/live/governed-families/g5-goal-wiring.mjs')
    const distBindings = join(PKG_DIR_READ, 'packages/runtime/dist/packages/runtime/src/plugin/live/agent-bindings.mjs')
    for (const [f, blob, label] of [[distArm, G5_BLOB_SERVICE, 'g5-goal-service'], [distWiring, G5_BLOB_WIRING, 'g5-goal-wiring'], [distBindings, G5_BLOB_BINDINGS, 'agent-bindings (mount arm)']]) {
      if (!existsSync(f)) throw new Error(`the pinned fixture carries NO dist ${label}: ${f}`)
      if (sha256(f) !== blob) throw new Error(`dist ${label} blob drifted from the pinned product ${blob}`)
    }
    const lockPath = join(INSTALL_DIR, 'pnpm-lock.yaml')
    if (!existsSync(lockPath) || sha256(lockPath) !== LOCK_SHA256) throw new Error(`the read-only fixture lock is absent or drifted (pinned ${LOCK_SHA256}) — NEVER re-install here`)
    log(`plugin entry resolved from the pinned fixture exports['./host']: ${HOST_ENTRY}; G5 dist trio byte-identical to the pinned blobs; fixture lock verified read-only`)
  }
  // REAL blueprint validation (root order 2026-10-28: 用真实validateBlueprintDocument，
  // 不只syntax): the packed parseBlueprint IS the production gate — frontmatter
  // split -> YAML decode -> validateBlueprintDocument -> content hash -> deep
  // freeze (pack validate.js :1143). Both documents this window ships run
  // through it BEFORE anything boots; a throw is a config defect (FATAL rc2).
  {
    currentCriterion = 'bp-validate'
    const bpValidate = join(PKG_DIR_READ, 'packages/runtime/dist/packages/domain/blueprint/src/validate.js')
    if (!existsSync(bpValidate)) throw new Error(`packed blueprint validator absent: ${bpValidate}`)
    const mod = await import(pathToFileURL(bpValidate).href)
    if (typeof mod.parseBlueprint !== 'function' || typeof mod.validateBlueprintDocument !== 'function') throw new Error('packed validator exposes neither parseBlueprint nor validateBlueprintDocument')
    for (const [label, doc] of [['anchor', ANCHOR_V3_YAML], ['saved', SAVED_BP_V3_YAML]]) {
      const bp = mod.parseBlueprint(doc) // all-or-nothing TeamContractError on ANY violation
      TRANSCRIPT.push({ channel: 'receipt', kind: 'blueprint-validated', document: label, blueprintId: bp.blueprintId, schemaVersion: bp.schemaVersion, contentHash: bp.contentHash })
      log(`blueprint ${label} validated by the REAL validator: ${bp.blueprintId} v${bp.schemaVersion} hash=${String(bp.contentHash).slice(0, 16)}…`)
    }
  }
  writeFileSync(join(HOME, 'blueprints', 'a5m2-g5-hw.yaml'), SAVED_BP_V3_YAML)

  if (DRY) {
    const dryPatch = join(HOME, 'dry-patch.yml')
    writePatch(dryPatch, pathToFileURL(HOST_ENTRY).href)
    writeFileSync(join(RUN_DIR, 'dry-receipts.json'), JSON.stringify({
      dry: true, reachedBootBoundary: true, booted: false,
      portsAwaited: { host: HOST_PORT, hostIdle: !(await portInUse(HOST_PORT)), mock: MOCK_PORT, mockIdle: !(await portInUse(MOCK_PORT)) },
      manifestEntry: HOST_ENTRY, fsRoot: FSROOT, patchWritten: dryPatch,
    }, null, 2))
    await cleanup()
    finish(cleanupOk ? 0 : 1)
    return
  }

  // ── mock model: marker -> ONE governed tool call; closes on its result ──
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
    const tools = req?.tools ?? req?.body?.tools ?? null
    if (text.startsWith('TOOLS-CHECK') && Array.isArray(tools) && memberToolsSeen.length === 0) {
      for (const t of tools) {
        const n = typeof t === 'string' ? t : t?.function?.name ?? t?.name ?? t?.id
        if (typeof n === 'string') memberToolsSeen.push(n)
      }
      TRANSCRIPT.push({ channel: 'receipt', kind: 'member-tool-surface', tools: memberToolsSeen })
    }
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
      const callId = `call-ghw-${NONCE}-${step}`
      steps.set(callId, { step, tool: name })
      return { kind: 'tool-call', toolCalls: [{ id: callId, name, arguments: args }] }
    }
    const stepFor = (marker) => `member:${marker}`
    const emitOrClose = (marker, build) => (callResults.some((r) => r.step === stepFor(marker))
      ? { kind: 'text', content: `TURN-DONE ${NONCE}` }
      : (steps.has(`pending:${marker}`)
        ? { kind: 'text', content: `TURN-WAIT ${NONCE}` }
        : (() => {
          steps.set(`pending:${marker}`, { step: stepFor(marker), tool: 'pending' })
          const spec = build()
          return mk(stepFor(marker), spec.name, spec.args)
        })()))
    if (text.startsWith('A5M2-G5HW-LEADER')) return emitOrClose(text, () => ({ name: 'team_create_member', args: { rootSessionId: currentRoot, requestToken: `ghw-create-${NONCE}`, delegationTemplateId: 'g5-worker', label: 'g5-1' } }))
    if (text.startsWith('TOOLS-CHECK')) return { kind: 'text', content: `ACK-C0 ${NONCE}` }
    // THE READ-ARM PAIR (root B-slot: 先 get_goal 一条真实 allow/deny). Identical
    // args on both legs — the ONLY difference in the window is the Control decision.
    if (text.startsWith('G5-ALLOW')) return emitOrClose(text, () => ({ name: 'get_goal', args: {} }))
    if (text.startsWith('G5-DENY')) return emitOrClose(text, () => ({ name: 'get_goal', args: {} }))
    return { kind: 'text', content: `TURN-DONE ${NONCE}` }
  }

  // ── boot (ONE boot for the whole window) ─────────────────────────────────
  currentCriterion = 'boot'
  mock = await startMockModel({ port: MOCK_PORT, decide, log: (l) => TRANSCRIPT.push({ channel: 'mock', line: String(l).slice(0, 200) }) })
  process.env.DEEPSEEK_BASE_URL = `http://127.0.0.1:${MOCK_PORT}`
  process.env.DEEPSEEK_API_KEY = `ghw-mock-${NONCE}` // explicit NON-SECRET dummy, mock-only
  const instLogDir = join(RUN_DIR, 'instance')
  mkdirSync(instLogDir, { recursive: true })
  instance = new DshInstance({ hostTree: HOST_TREE, dshHome: HOME, port: HOST_PORT, clientCommitHash: CLIENT_COMMIT_HASH, logDir: instLogDir })
  writePatch(instance.patchFile, pathToFileURL(HOST_ENTRY).href)
  const started = await instance.start({ timeoutMs: 240_000 })
  const m = /^http:\/\/127\.0\.0\.1:(\d+)\/\?token=([A-Za-z0-9_-]+)$/.exec(started.url)
  if (m === null) throw new Error('unexpected boot url shape')
  origin = `http://127.0.0.1:${m[1]}`
  const auth = await fetch(`${origin}/?token=${m[2]}`, { redirect: 'manual', signal: AbortSignal.timeout(30_000) })
  if (auth.status !== 303 || auth.headers.get('set-cookie') === null) throw new Error(`authenticate status=${auth.status}`)
  cookie = auth.headers.get('set-cookie').split(';', 1)[0]
  log(`host booted at ${origin}`)

  currentCriterion = 'setup'
  currentRoot = `session-a5m2g5hw-p-${RUN_STAMP}`
  await teamReadyBarrier()
  const team = await remoteCall('team.create', { rootSessionId: currentRoot, blueprintId: BP_ID }, 'ghw-create', 1)
  if (resultError(team.body) !== null) throw new Error(`team.create: ${JSON.stringify(resultError(team.body)).slice(0, 400)}`)
  await apiPrompt(currentRoot, `A5M2-G5HW-LEADER ${NONCE}`, 'ghw-leader')
  const memberSession = await waitFor('member session in team_domain', 120_000, () => domainFacts())
  log(`member session ${memberSession}`)

  // E0: the G5 family is REALLY mounted over this member — all three governed
  // rows on the member's model face (the arm replaced the natives).
  currentCriterion = 'E0'
  await apiPrompt(memberSession, `TOOLS-CHECK ${NONCE}`, 'ghw-c0')
  await waitFor('member tool surface', 60_000, () => (memberToolsSeen.length > 0 ? true : null))
  check('E0', 'member surface carries the governed G5 trio',
    memberToolsSeen.includes('get_goal') && memberToolsSeen.includes('create_goal') && memberToolsSeen.includes('update_goal'),
    `visible=${memberToolsSeen.join(',')}`)

  const stepOuter = (marker) => `member:${marker}`

  // E1: ALLOW chain on the READ arm — real PA admission consumed and the row
  // really serves the port: a goal-less world answers the canonical
  // { "goal": null } projection (goalValue, tool-goal/src/index.ts:157-173:
  // goal undefined -> { goal: null }) — IN BAND in the model-visible result.
  currentCriterion = 'E1'
  const allowReq = await driveGoverned(memberSession, 'G5-ALLOW', 'allow', 'ghw-e1')
  const allowRes = await resultFor(stepOuter('G5-ALLOW'))
  const consumed = await hasFact(allowReq, 'control-allow-consumed')
  check('E1', 'ALLOW -> control-allow-consumed fact + served canonical goalValue projection (NOT a refusal)',
    consumed !== false && String(allowRes).includes('"goal":null'),
    `requestId=${allowReq} consumed=${JSON.stringify(consumed).slice(0, 200)} result=${String(allowRes).slice(0, 250)}`)

  // E2: DENY chain — the same call, decided deny. Zero execution is pinned by
  // THREE public faces: (a) NO control-allow-consumed fact ever exists for the
  // requestId (durable consumption never happened), (b) the durable
  // control-decision-recorded fact IS present (the deny rode the same ledger,
  // never silently dropped), (c) the model-visible result carries NO served
  // projection — the canonical '"goal":null' answer is exactly what a denied
  // call must never print — and instead carries the refusal band (the bridge
  // re-throws the seat's deny VERBATIM, no re-labelling).
  currentCriterion = 'E2'
  const denyReq = await driveGoverned(memberSession, 'G5-DENY', 'deny', 'ghw-e2')
  const denyRes = await resultFor(stepOuter('G5-DENY'))
  const denyConsumed = await hasFact(denyReq, 'control-allow-consumed')
  const denyDecision = await hasFact(denyReq, 'control-decision-recorded')
  check('E2', 'DENY -> zero execution (no allow-consumed fact) + durable decision fact + in-band refusal, NO served projection',
    denyConsumed === false && denyDecision !== false
    && !String(denyRes).includes('"goal":null') && /denied|refus|P_G5|pa-/i.test(String(denyRes)),
    `requestId=${denyReq} decision=${JSON.stringify(denyDecision).slice(0, 200)} result=${String(denyRes).slice(0, 300)}`)

  await cleanup()
  finish(results.every((r) => r.ok) && cleanupOk ? 0 : 1)
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
