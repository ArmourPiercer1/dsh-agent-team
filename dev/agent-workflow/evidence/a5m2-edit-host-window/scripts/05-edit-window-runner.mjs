#!/usr/bin/env node
/**
 * A5M2 EDIT host-window runner — Window A FINAL (root centralized cards 2026-10-28):
 * ONE boot, exactly TWO real governed EDIT calls — one ALLOW chain and one DENY
 * chain — over the public wire only. NO direct arm calls, NO invented Host API:
 * every call shape is copied from the FOURTH-successful Team-window runner
 * (tests/kits/a5m2-schedule-c2/a5m2-schedule-c2.mjs, cited line by line).
 *
 * BOOT remains behind the root's ruling: A5M2_EDIT_WINDOW=GRANTED. Without it
 * the runner prints a NOT_RUN receipt and exits NON-ZERO (rc 3) — NOT_RUN is
 * never a green line. A no-boot dry path (A5M2_EDIT_DRY=1) runs the REAL
 * pre-flight to the boot boundary (install -> entry resolution -> patch) and
 * stops BEFORE any spawn; dry proves only up-to-boundary facts.
 *
 * PRODUCT is an EXPLICIT INPUT, never an old pin (root: no 161e4/699cc/874f
 * masquerading as the new pack):
 *   A5M2_EDIT_INSTALL_DIR   the f86-built fixture install dir (READ-ONLY
 *                           reuse; default is f86's named path below). The
 *                           runner NEVER installs, lock-updates or chmods —
 *                           root FS narrow-audit order (a recursive chmod
 *                           would reach the shared store's hardlinks).
 *   A5M2_EDIT_COMPOSED_SHA  optional; when given MUST equal the pinned product
 * This runner's own full SHA is recorded separately (runner-identity.json).
 *
 * Evidence law: RUN_DIR keeps raw transcripts/instance logs; the HOME world is
 * NEVER deleted by this runner (root: keep old HOME/raw — teardown does NOT
 * rm evidence); cleanup stops the Host + mock and verifies ports + this
 * runner's own world lock only.
 */
import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { appendFileSync, existsSync, mkdirSync, openSync, readFileSync, readdirSync, statSync, utimesSync, writeFileSync } from 'node:fs'
import { basename, dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { CLIENT_COMMIT_HASH, findTestRepoRoot } from '../../../../../tests/paths.mjs'
import { DshInstance } from '../../../../../tests/characterization/lib/instance.mjs'
import { portInUse, waitForPortFree } from '../../../../../tests/characterization/lib/util.mjs'
import { startMockModel } from '../../../../../packages/tools/harness/mock-deepseek.mjs'

const COMPOSED_SHA = '37646ac288dbd0ee3c998343dc91fd1a8da7a2d5' // root-accepted minimal release fix (direct child of 5c313418: 4 paths, 3 same-blob mirror placements only)
const EDIT_BLOB_EDIT = '5a6db608a4043793e8569998bbe1c8fa5a0695be' // dist arm blob this tree measured
const EDIT_BLOB_SRE = '6a1ec67f062dd77ee7110a6d4d6e3781376f4f35'
const PACK_BYTES_MAX = 8_000_000
const HOST_PORT = 3183
const MOCK_PORT = 3498
const WORLD_PREFIX = 'a5m2-edit-hw-a'
const BP_ID = 'team.a5m2-edit-hw'
const WINDOW_GO = process.env.A5M2_EDIT_WINDOW === 'GRANTED'
const DRY = process.env.A5M2_EDIT_DRY === '1'
// SYNC CARD 2026-10-28 (root order): ONLY these parameter/expectation
// constants moved with the product 5c313418 -> 37646ac2; d66's execution
// logic is untouched. The old pack hash 0a3f11b2... MUST NOT be inherited —
// the NEW tgz hash arrives as an explicit receipt input, no default.
// driver SHA (the d66 signed logic, carried by HEAD) and product SHA (below)
// are separate facts and stay recorded separately in runner-identity.json.
const INSTALL_DIR = process.env.A5M2_EDIT_INSTALL_DIR ?? null // f86's NEW final full path, REQUIRED (locator swapped with the repack)
const PACK_COMPOSED = process.env.A5M2_EDIT_COMPOSED_SHA ?? null
const EXPECTED_PACK_SHA = process.env.A5M2_EDIT_PACK_SHA256 ?? null // REQUIRED: full hash from f86's new receipt (sha256: prefix)
const EXPECTED_TGZ_NAME = process.env.A5M2_EDIT_TGZ_NAME ?? 'dsh-agent-team-0.1.1-alpha.2.tgz' // same tree -> same name unless the receipt says otherwise
const EXPECTED_TGZ_DIR_PREFIX = 'out-37646ac2-' // full dir arrives in the receipt; the segment must carry the new product prefix

function notRun(reason) {
  console.log(JSON.stringify({ implemented: true, booted: false, dry: DRY, verdict: 'NOT_RUN', reason }, null, 2))
  process.exit(3) // NOT_RUN is NON-ZERO by root order
}
if (!WINDOW_GO && !DRY) notRun('window env A5M2_EDIT_WINDOW not GRANTED (root ruling pending) — nothing booted')
if (PACK_COMPOSED !== null && PACK_COMPOSED !== COMPOSED_SHA) notRun(`A5M2_EDIT_COMPOSED_SHA ${PACK_COMPOSED} is not the pinned product ${COMPOSED_SHA}`)
if (INSTALL_DIR === null) notRun('A5M2_EDIT_INSTALL_DIR is REQUIRED: f86\'s new final full fixture path from the new receipt (locator swapped with the repack)')
if (EXPECTED_PACK_SHA === null) notRun('A5M2_EDIT_PACK_SHA256 is REQUIRED: the NEW tgz full hash from f86\'s receipt — the old 0a3f11b2 hash is retired and must not be inherited')
if (!EXPECTED_PACK_SHA.startsWith('sha256:')) notRun('A5M2_EDIT_PACK_SHA256 must carry the sha256: prefix')

const ROOT_DIR = findTestRepoRoot(dirname(fileURLToPath(import.meta.url)))
if (ROOT_DIR === null) { console.error('findTestRepoRoot returned null'); process.exit(3) }
const HOST_TREE = join(ROOT_DIR, 'tests', 'deepseek-harness-test-use')
if (!existsSync(HOST_TREE)) notRun(`639 host checkout absent at ${HOST_TREE}`)

// (root FS narrow-audit: the old bf4 fixture/lock/store preconditions are REMOVED;
// the only install face is the f86 fixture below, read-only.)

const ANCHOR_V3_YAML = [
  '---', 'schemaVersion: 3', `blueprintId: ${BP_ID}.boot-anchor`, 'revision: "1"',
  'leader:', '  templateId: leader', '  persona: "You are the leader of the A5M2 EDIT window A team."',
  'members:', '  - templateId: edit-worker', '    persona: "You are a worker of the A5M2 EDIT window A team."',
  'memberEnvelopes: []', 'requirements: []',
  'permissionMutationEnvelope:', '  rules: []',
  'teamHardEnvelope:', '  rules: []',
  'policyStates: []', 'metadata: {}', '---', '',
].join('\n')
// worker: NO team tools, NO skills/mcp, default deny, ask ONLY on the governed
// edit row (resource any) — the real PA approval lane for exactly one tool.
const SAVED_BP_V3_YAML = [
  '---', 'schemaVersion: 3', `blueprintId: ${BP_ID}`, 'revision: "1"',
  'leader:', '  templateId: leader', '  persona: "You are the leader of the A5M2 EDIT window A team."',
  'members:', '  - templateId: edit-worker',
  '    persona: "You are the edit worker. Follow the marker instructions literally and only."',
  '    capabilities:', '      teamTools:', '        kind: deny',
  '      builtinToolDeny:', // isolation config for THIS EDIT window only (root conditional GO 09:38Z): deny removes these 15 natives from the worker's final surface — they carry NO ownership record on this instance (window-2 refusal named exactly them; coverage managed = ownership-not-declaration per root correction, so this is exposure-shrink, NOT a claim they are unmanageable, and it exempts NO tool from delivery). Window-2's refusal = code alpha2-permission-coverage-unmanaged-tools. 'edit' (the tested resource) stays via the ask lane below.
  '        - ask_user_question', '        - create_goal', '        - exit_plan_mode',
  '        - get_goal', '        - glob', '        - grep', '        - job_kill',
  '        - job_list', '        - job_output', '        - present', '        - skill',
  '        - update_goal', '        - web_fetch', '        - web_search', '        - workflow',
  '      skills:', '        kind: deny', '      mcp:', '        kind: deny',
  // permissions = the CLOSED edit effect set (edit.mjs :232-236 verbatim), one rule each:
  //   tool-invoke('edit')  -> ask lane below (real PA: ask -> Leader decision -> consume/deny)
  //   read  exact target   -> allow (M-02 paired read leg, SAME governed read arm, same locator)
  //   write exact target   -> allow (the content effect I)
  // (F = the bound O_RDWR|O_NOFOLLOW fd discipline INSIDE the arm — a law-fact, not an admission
  // rule.) Root ruling: necessary IO for THIS synthetic world's exact file only; NO external
  // path, NO production profile, NO PA skip; deny lane remains REAL (E2 = control-layer deny,
  // arm CANCELLED before any IO).
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
  // root-A 09:5xZ: ONLY this isolated worker's mutation envelope gains ONE
  // operation — request-control (raising an ask). Shape + operation name are
  // the VERIFIED M1 approval-纵切 law, copied verbatim from
  // tests/kits/pr-d-control-real-host/pr-d-control-real-host.mjs :1284-1293
  // ({templateId, envelope:{allow:[…'request-control'], deny:[]}}); schema law
  // = validate.js :962-978 (templateId must resolve; envelope = validateEnvelope
  // {allow,deny}). NO resolve-control for the worker (cannot answer/approve
  // itself); the Leader + team resolution path is untouched (teamEnvelope above).
  'memberEnvelopes:', '  - templateId: edit-worker', '    envelope:', '      allow:',
  '        - request-control', '      deny: []', 'requirements: []',
  'permissionMutationEnvelope:', '  rules: []',
  'teamHardEnvelope:', '  rules: []',
  'policyStates: []', 'metadata: {}', '---', '',
].join('\n')

const NONCE = Math.random().toString(36).slice(2, 8)
const RUN_STAMP = new Date().toISOString().replace(/[:.]/g, '-')
const HOME = join(ROOT_DIR, 'tests', 'homes', `${WORLD_PREFIX}${DRY ? '-dry' : ''}-${RUN_STAMP}Z`)
const FSROOT = join(HOME, 'fsroot') // manifest rootDir = THIS new world, never cwd
const RUN_DIR = join(ROOT_DIR, 'dev', 'agent-workflow', 'evidence', 'a5m2-edit-host-window', `runs-${DRY ? 'dry-' : ''}${RUN_STAMP}`)
const TRANSCRIPT = []
const results = []
const steps = new Map()
const callResults = []
const memberToolsSeen = []
let currentCriterion = 'setup'
let mock = null
let instance = null // registered BEFORE start (fourth-window ⑩)
let cleanupOk = true
const log = (line) => { console.log(`[edit-hw] ${line}`) }
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
    tl(`FINISH rc=${String(rc)}`)
  } finally { process.exit(rc) }
}
// [root timestamps 2026-10-24] an ISOLATED wallclock timeline for judging
// secondary ordering (teardown vs closed-domain): records cleanup start,
// first-OBSERVED arrivals of new Host-log lines (poll granularity 250ms —
// an OBSERVATION time, honestly labelled, not the writer's time), FATAL,
// and finish-rc. It writes a SEPARATE raw/timeline.log ONLY; the Host's own
// log file is byte-untouched (never reordered, never rewritten); observer
// untouched; not a gate — records only.
function tl(msg) {
  try { appendFileSync(join(RUN_DIR, 'timeline.log'), `${new Date().toISOString()} ${String(msg).slice(0, 340)}\n`) } catch { /* record-only */ }
}
async function cleanup() {
  tl('CLEANUP-BEGIN')
  const notes = []
  try { if (mock !== null) { await mock.close(); notes.push('mock closed') } } catch (e) { notes.push(`mock close ERR ${String(e).slice(0, 120)}`) }
  // [root timestamps] the ordering probe: was the closed-domain/FAILED line
  // ALREADY in the Host log when cleanup began, or does it appear only under
  // stop/teardown? Both sides get a labelled snapshot around instance.stop().
  const hostLogTail = (tag) => {
    try {
      const lines = String(readFileSync(instance === null ? '/dev/null' : instance.logPath, 'utf8')).split('\n')
      tl(`${tag} lines=${String(lines.length)} last=${lines[lines.length - 2] ?? ''}`)
      const failed = lines.filter((l) => l.includes('[dsh-agent-team] bootstrap FAILED') || l.includes('remote mount: FAILED') || l.includes('remote mount: SKIPPED'))
      tl(`${tag} refusal-lines-present=${String(failed.length)}${failed.length > 0 ? ` first=${failed[0].slice(0, 200)}` : ''}`)
    } catch (e) { tl(`${tag} read-ERR ${String(e).slice(0, 120)}`) }
  }
  hostLogTail('HOSTLOG-SNAPSHOT-BEFORE-STOP')
  try { if (instance !== null) { const r = await instance.stop({ timeoutMs: 30_000 }); notes.push(`instance stopped killed=${r.killed} portFree=${r.portFree}`) } } catch (e) { notes.push(`instance stop ERR ${String(e).slice(0, 120)}`) }
  hostLogTail('HOSTLOG-SNAPSHOT-AFTER-STOP')
  for (const p of [HOST_PORT, MOCK_PORT]) {
    try { const free = await waitForPortFree(p, 10_000); notes.push(`port ${p} free=${free}`) } catch (e) { notes.push(`port ${p} ERR ${String(e).slice(0, 120)}`) }
  }
  // THIS runner's own world lock only; HOME and raw are NEVER deleted (root law).
  try { const lk = join(HOME, 'a5m2-edit-hw-lock.json'); if (existsSync(lk)) notes.push('world lock retained (evidence)') } catch { /* keep */ }
  const ok = !notes.some((n) => n.includes('ERR') || n.includes('free=false'))
  cleanupOk = ok
  log(`cleanup (${ok ? 'OK' : 'NOT-OK'}): ${notes.join(' | ')}`)
  return { ok, notes }
}

// ── explicit product pin (fail closed) ─────────────────────────────────────
// ── ② explicit f86 fixture reuse (READ-ONLY; absent => fail-closed rc3) ───
if (!existsSync(INSTALL_DIR)) notRun(`f86 fixture install dir absent (awaiting f86's NEW pack/fixture receipt for 37646ac2; this runner does NOT create or install it): ${INSTALL_DIR}`)
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
    `        rootSessionId: ${JSON.stringify(`session-a5m2edithw-boot-${RUN_STAMP}`)}`,
    '        blueprintSource: |-',
    ...ANCHOR_V3_YAML.replace(/\n$/, '').split('\n').map((l) => `          ${l}`),
    `        blueprintDir: ${JSON.stringify(join(HOME, 'blueprints'))}`,
    '        seedMembers: []',
    '        generation: 1',
    '        staticModel:', '          provider: deepseek-official', '          model: a5m2-edit-window-model',
    '        deniedSelection: null', '        mcpServers: []', '        mcpServer: null',
    '        environmentFacts: []', '        externalPolicyFacts:', '          hard: {}', '          capabilityExists: {}',
    '        teamToolPlane:', // the EDIT gate: closed key + SAME governed fs root (world, not cwd)
    '          editEnabled: true',
    "          realmId: 'a5m2-edit-hw-realm'", // pinned so a5PlaneRealmId is static (agent-bindings :2629 fallback would embed the dynamic teamRoot)
    '          fsInstance:', // COMPLETE ControlledFsInstance shape (37646 law, admission-binding :109-132 + controlled-fs.d.ts:28-33): fs id + rootDir + realmId EQUAL to the plane's + kind absolute-path
    "            fs: 'a5m2-edit-hw-fs'",
    `            rootDir: ${JSON.stringify(FSROOT)}`,
    "            realmId: 'a5m2-edit-hw-realm'",
    "            kind: 'absolute-path'", '',
    // Root diagnostic GO prep (2026-10-24): a SECOND row in THIS test
    // composition = the read-only teamRoot.live.observations consumer
    // (08-pa-observation-consumer.mjs; public seam host.ts :4100-4107/:4144 +
    // agent-bindings :1049/:10444, inject pattern host.ts :2959-2967). Product
    // bytes/permissions/approval timing UNTOUCHED; no new package/RPC; the
    // consumer mutates nothing and writes only $DSH_HOME/pa-observations.log.
    // The RELATIVE-path fixture input is DELIBERATELY RETAINED this run (root
    // convergence: reproduce, only ADD observation to capture leg.detail); the
    // absolute-path fixture fix stays a separate unexecuted draft
    // (../drafts/absolute-path-fixture.DRAFT.md).
    `- insert:`,
    '    - id: a5m2-pa-observer',
    `      name: ${JSON.stringify(pathToFileURL(join(dirname(fileURLToPath(import.meta.url)), '08-pa-observation-consumer.mjs')).href)}`,
    '      config: {}', '',
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
const apiPrompt = (sessionId, text, tag) => sessionRpc('prompt', { requestId: `ehw-prompt-${NONCE}-${tag}-${promptSeq += 1}`, sessionId, mode: 'queue', content: [{ type: 'text', text }] }, tag)

async function teamReadyBarrier(budgetMs = 180_000) {
  const deadline = Date.now() + budgetMs
  let polls = 0
  for (;;) {
    polls += 1
    const res = await remoteCall('team.listRoots', {}, 'ehw-ready', 3)
    const err = resultError(res.body)
    if (err === null) { log(`team runtime READY (polls=${polls})`); return }
    const starting = err.code === 'internal-error' && err.details?.reason === 'runtime-not-ready' && String(err.message).includes('state: starting')
    if (!starting) throw new Error(`readiness barrier STOP (polls=${polls}): ${JSON.stringify(err).slice(0, 400)}`)
    if (Date.now() >= deadline) throw new Error('readiness barrier budget exhausted while starting')
    await sleep(1500)
  }
}

// [root minimal driver fix 2026-10-24, reusing the VERIFIED fourth-window
// barrier] Root's one-point card from A5M2-B-TEAM (commit
// 7f6bbd46c1ca536cb09feae85f627940f40b7bb4, evidence/alpha5/live/
// a5m2-team-c2-runner.mjs) ported near-verbatim: the `dsh web:` URL banner
// does NOT mean the Team route exists — host.js awaits createTeamDomain
// first and registers the Team Remote later. So before the FIRST team RPC
// this driver waits for THIS run's host log to carry the registration
// site's OWN line `[dsh-agent-team] remote mount: MOUNTED channel=/team-
// remote`; SKIPPED / mount FAILED / bootstrap FAILED stop typed and first,
// child exit stops as HOST_CHILD_EXITED, timeout stops as
// REMOTE_MOUNT_NEVER_APPEARED — NOT a generic 405 retry; the post-mount
// readiness stays the ORIGINAL teamReadyBarrier (unknown answers stop, no
// retry). Adaptations (disclosed): this driver's HOME-byte budget is
// monitored by the 06 wrapper, so the C2-local checkWorldBudget call is
// dropped; the C2 windowDeadlineAt clamp is dropped — the outer 300s own-
// group watchdog is this driver's bound. Window-6's ordering stays
// recorded UNKNOWN; this fix only closes the "banner != route" gap that
// window-6 exposed (root-verified: 05 fired the first RPC right after the
// banner and NO_RESULT stopped without the MOUNTED gate the fourth
// successful window had).
const REMOTE_MOUNT_MARKER = '[dsh-agent-team] remote mount: MOUNTED channel=/team-remote'
const REMOTE_MOUNT_REFUSALS = Object.freeze([
  { name: 'REMOTE_MOUNT_SKIPPED', pattern: /\[dsh-agent-team\] remote mount: SKIPPED/ },
  { name: 'REMOTE_MOUNT_FAILED', pattern: /\[dsh-agent-team\] remote mount: FAILED/ },
  { name: 'PLUGIN_BOOTSTRAP_FAILED', pattern: /\[dsh-agent-team\] bootstrap FAILED/ },
])
async function remoteMountGate({ readLog, childGone = () => false, budgetMs = 120_000, pollMs = 250 }) {
  const deadline = Date.now() + budgetMs
  let polls = 0
  let seenLines = 0
  for (;;) {
    polls += 1
    if (childGone() === true) throw new Error('HOST_CHILD_EXITED before the Team Remote mounted: no team RPC was attempted')
    const text = String(readLog() ?? '')
    // observation timestamps (root 2026-10-24): first-seen arrival of each
    // new Host-log line — OBSERVATION time at <=pollMs granularity, honest
    // about not being the writer's own timestamp.
    const lines = text.split('\n')
    while (seenLines < lines.length && lines[lines.length - 1] !== '') {
      const line = lines[seenLines]
      if (line.length > 0) tl(`HOSTLOG-observed L${String(seenLines + 1)}: ${line}`)
      seenLines += 1
    }
    const found = REMOTE_MOUNT_REFUSALS.find((entry) => entry.pattern.test(text))
    if (found !== undefined) {
      const line = text.split('\n').find((row) => found.pattern.test(row)) ?? found.name
      throw new Error(`${found.name}: ${line.trim().slice(0, 300)}`)
    }
    const mounted = text.split('\n').find((row) => row.includes(REMOTE_MOUNT_MARKER))
    if (mounted !== undefined) return { mounted: true, polls, line: mounted.trim().slice(0, 200) }
    if (Date.now() > deadline) throw new Error(`REMOTE_MOUNT_NEVER_APPEARED after ${String(polls)} polls: no '${REMOTE_MOUNT_MARKER}' line in this run's host log (the URL banner is not the route)`)
    await sleep(pollMs)
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
    const page = await remoteCallReady('team.getLedgerPage', { teamSessionId: currentRoot, afterSequence, limit: 500 }, `ehw-ledger-${pageNo + 1}`, 1)
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
  const hits = [...new Set([...memberBindings.entries()].filter(([i]) => templates.get(i) === 'edit-worker').map(([, s]) => s))]
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
  const res = await remoteCallReady('team.resolveControl', { teamSessionId: currentRoot, requestId, decision, note: `edit-hw ${tag}` }, tag, 4)
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
  if (hostBusy || mockBusy) throw new Error(`ports busy at start: host=${hostBusy} mock=${mockBusy} (plan: 3183/3498; 3080 stable, 3180/3181 durable never touched)`)
  if (existsSync(HOME) && readdirSync(HOME).length > 0) throw new Error(`home ${HOME} exists non-empty — fail closed`)
  for (const p of [HOME, join(HOME, 'blueprints'), join(HOME, 'storages'), FSROOT, RUN_DIR]) mkdirSync(p, { recursive: true })
  if (process.env.A5M2_EDIT_HOME_POINTER) { // explicit HOME hand-off to the monitor (no globbing; written BEFORE boot so a boot failure is still auditable)
    try { writeFileSync(process.env.A5M2_EDIT_HOME_POINTER, `${HOME}\n`) } catch { /* monitor hint best-effort; window verdict never depends on it */ }
  }
  writeFileSync(join(HOME, 'a5m2-edit-hw-lock.json'), JSON.stringify({ world: HOME, pid: process.pid, runner: '05-edit-window-runner.mjs', composedSha: COMPOSED_SHA, packSha256: EXPECTED_PACK_SHA, stamp: RUN_STAMP }, null, 2))
  try {
    const selfSha = execFileSync('git', ['-C', ROOT_DIR, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim()
    writeFileSync(join(RUN_DIR, 'runner-identity.json'), JSON.stringify({ runnerFullSha: selfSha, runnerFileSha256: sha256(fileURLToPath(import.meta.url)), composedSha: COMPOSED_SHA, packTgz: tgzPath, packSha256: EXPECTED_PACK_SHA, installDir: INSTALL_DIR, armBlobExpectations: { edit: EDIT_BLOB_EDIT, sre: EDIT_BLOB_SRE } }, null, 2))
  } catch { /* identity best-effort; window verdict never depends on it */ }
  // the governed target file, under the fsInstance rootDir = THIS world
  writeFileSync(join(FSROOT, 'notes.txt'), 'alpha\nbeta\ngamma\n', 'utf8')

  // ── ②③ REAL entry resolution from the f86 fixture (READ-ONLY: no install,
  // no lockfile-only, no chmod — root FS narrow-audit order) ──────────────
  {
    const installedManifest = JSON.parse(readFileSync(join(PKG_DIR_READ, 'package.json'), 'utf8'))
    const hostExport = installedManifest?.exports?.['./host']
    if (typeof hostExport !== 'string') throw new Error('fixture plugin exports["./host"] missing')
    var HOST_ENTRY = resolve(PKG_DIR_READ, hostExport.replace(/^\.\//, ''))
    if (!existsSync(HOST_ENTRY)) throw new Error(`host entry absent: ${HOST_ENTRY}`)
    var distArm = join(PKG_DIR_READ, 'packages/runtime/dist/packages/runtime/src/plugin/live/governed-families/edit.mjs')
    if (!existsSync(distArm)) throw new Error(`the f86 fixture carries NO dist edit arm: ${distArm}`)
    log(`plugin entry resolved from the f86 fixture exports['./host']: ${HOST_ENTRY}; dist edit arm present`)
  }
  writeFileSync(join(HOME, 'blueprints', 'a5m2-edit-hw.yaml'), SAVED_BP_V3_YAML.replaceAll('@@TARGET_ABS@@', join(FSROOT, 'notes.txt')))

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

  // ── mock model: marker -> ONE edit tool call; closes on its result ──────
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
      const callId = `call-ehw-${NONCE}-${step}`
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
    if (text.startsWith('A5M2-EDITHW-LEADER')) return emitOrClose(text, () => ({ name: 'team_create_member', args: { rootSessionId: currentRoot, requestToken: `ehw-create-${NONCE}`, delegationTemplateId: 'edit-worker', label: 'edit1' } }))
    if (text.startsWith('TOOLS-CHECK')) return { kind: 'text', content: `ACK-C0 ${NONCE}` }
    if (text.startsWith('EDIT-ALLOW')) return emitOrClose(text, () => ({ name: 'edit', args: { file_path: 'notes.txt', old_string: 'beta', new_string: 'BETA-ALLOWED' } }))
    if (text.startsWith('EDIT-DENY')) return emitOrClose(text, () => ({ name: 'edit', args: { file_path: 'notes.txt', old_string: 'alpha', new_string: 'ALPHA-DENIED' } }))
    return { kind: 'text', content: `TURN-DONE ${NONCE}` }
  }

  // ── boot (ONE boot for the whole window) ─────────────────────────────────
  currentCriterion = 'boot'
  mock = await startMockModel({ port: MOCK_PORT, decide, log: (l) => TRANSCRIPT.push({ channel: 'mock', line: String(l).slice(0, 200) }) })
  process.env.DEEPSEEK_BASE_URL = `http://127.0.0.1:${MOCK_PORT}`
  process.env.DEEPSEEK_API_KEY = `ehw-mock-${NONCE}` // explicit NON-SECRET dummy, mock-only
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

  // [root fix, 7f6bbd barrier] the URL banner is NOT the route — wait for
  // the plugin's OWN registration line before ANY team RPC (typed refusals
  // stop first; no team call happens before it).
  const mountGate = await remoteMountGate({
    readLog: () => String(readFileSync(instance.logPath, 'utf8')),
    childGone: () => instance.child === undefined || instance.child.exitCode !== null || instance.child.signalCode !== null,
    budgetMs: 120_000,
  })
  log(`remote mount gate PASS (polls=${mountGate.polls}) ${mountGate.line}`)

  currentCriterion = 'setup'
  currentRoot = `session-a5m2edithw-p-${RUN_STAMP}`
  await teamReadyBarrier()
  const team = await remoteCall('team.create', { rootSessionId: currentRoot, blueprintId: BP_ID }, 'ehw-create', 1)
  if (resultError(team.body) !== null) throw new Error(`team.create: ${JSON.stringify(resultError(team.body)).slice(0, 400)}`)
  await apiPrompt(currentRoot, `A5M2-EDITHW-LEADER ${NONCE}`, 'ehw-leader')
  const memberSession = await waitFor('member session in team_domain', 120_000, () => domainFacts())
  log(`member session ${memberSession}`)

  // E0: the governed edit row is really mounted in the member's tool table
  currentCriterion = 'E0'
  await apiPrompt(memberSession, `TOOLS-CHECK ${NONCE}`, 'ehw-c0')
  await waitFor('member tool surface', 60_000, () => (memberToolsSeen.length > 0 ? true : null))
  check('E0', 'member surface carries the governed edit row', memberToolsSeen.includes('edit'), `visible=${memberToolsSeen.join(',')}`)

  const target = join(FSROOT, 'notes.txt')
  const stepOuter = (marker) => `member:${marker}`

  // E1: ALLOW chain — real PA consumption, real bytes, real facts
  currentCriterion = 'E1'
  const shaBefore = sha256(target)
  const stBefore = statSync(target)
  const allowReq = await driveGoverned(memberSession, 'EDIT-ALLOW', 'allow', 'ehw-e1')
  const allowRes = await resultFor(stepOuter('EDIT-ALLOW'))
  const shaAfter = sha256(target)
  const stAfter = statSync(target)
  const consumed = await hasFact(allowReq, 'control-allow-consumed')
  check('E1', 'ALLOW -> control-allow-consumed fact + REAL bytes changed + mtime advanced + result not a refusal',
    consumed !== false && shaBefore !== shaAfter && readFileSync(target, 'utf8') === 'alpha\nBETA-ALLOWED\ngamma\n'
    && stAfter.mtimeMs > stBefore.mtimeMs && !String(allowRes).includes('cf-class=denied'),
    `requestId=${allowReq} consumed=${JSON.stringify(consumed).slice(0, 200)} result=${String(allowRes).slice(0, 250)}`)

  // E2: DENY chain — zero executed bytes on the SAME target
  currentCriterion = 'E2'
  const denyShaBefore = sha256(target)
  const denyStBefore = statSync(target)
  utimesSync(target, denyStBefore.atime, denyStBefore.mtime) // freeze clocks: a touch-open would still show
  const denyReq = await driveGoverned(memberSession, 'EDIT-DENY', 'deny', 'ehw-e2')
  const denyRes = await resultFor(stepOuter('EDIT-DENY'))
  const denyConsumed = await hasFact(denyReq, 'control-allow-consumed')
  check('E2', 'DENY -> zero executed bytes (sha + mtime double-check) + result carries in-band refusal + NO allow-consumed fact',
    denyShaBefore === sha256(target) && Math.abs(statSync(target).mtimeMs - denyStBefore.mtimeMs) < 1
    && String(denyRes).includes('cf-class=denied') && denyConsumed === false,
    `requestId=${denyReq} consumed=${JSON.stringify(denyConsumed)} result=${String(denyRes).slice(0, 300)}`)

  await cleanup()
  finish(results.every((r) => r.ok) && cleanupOk ? 0 : 1)
}
main().then(
  () => {},
  async (e) => {
    const rc = String(e?.message ?? '').startsWith('CRIT-FAIL') ? 1 : 2
    tl(`FATAL (${currentCriterion}) rc=${String(rc)} msg=${String(e?.message ?? e).slice(0, 240)}`)
    log(`FATAL (${currentCriterion}): ${String(e?.stack ?? e).slice(0, 500)}`)
    await cleanup()
    finish(rc)
  },
)
