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
import { appendFileSync, existsSync, lstatSync, mkdirSync, openSync, readFileSync, readdirSync, statSync, symlinkSync, utimesSync, writeFileSync } from 'node:fs'
import { basename, dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { CLIENT_COMMIT_HASH, findTestRepoRoot } from '../../../../../tests/paths.mjs'
import { DshInstance } from '../../../../../tests/characterization/lib/instance.mjs'
import { portInUse, waitForPortFree } from '../../../../../tests/characterization/lib/util.mjs'
import { startMockModel } from '../../../../../packages/tools/harness/mock-deepseek.mjs'

const COMPOSED_SHA = '2fb129cfa23e138248fecc834a42c92238af95fe' // SYNC CARD 2026-10-25 (root PREP authorize, NOT a Host GO): 2fb129cfa / package sha 8077defca120247f3f73dc61867c0b85d4fedfbf84a145284b2a165a2ee8958a / lock 5dffdafaebfc691b26d6e3c2d1124c8a11d0bb919b784738ddbfb0d962e90088 / INSTALL install-8077defc — the line where 87/88 permission grant/revoke are WIRED (root.js :3014-3040 createTeamTools permission seam; :3034 fail-closed without the fs provider seam). 694b remains the historical evidence base; NO same-SHA claim. Arm blobs RE-MEASURED on install-8077defc via git hash-object: identical. // SYNC CARD 2026-10-24c (root pin GO): int 694b0c0e (parent a27f1a46, descends 4a26ac9a; release surface = 4 dist .mjs agent-bindings/team-tool-plane/subagent-spawn-adapters/subagent-spawn-wiring); constants-only sync, d66 execution logic untouched
const EDIT_BLOB_EDIT = '5a6db608a4043793e8569998bbe1c8fa5a0695be' // RE-MEASURED (git hash-object) against install-d703affb at this sync: identical (spawn-face changes did not touch the edit arm)
const EDIT_BLOB_SRE = '6a1ec67f062dd77ee7110a6d4d6e3781376f4f35' // likewise RE-MEASURED against install-d703affb: identical
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
const EXPECTED_TGZ_DIR_PREFIX = 'out-2fb129cf-' // receipt names out-694b0c0e-20261024T130252Z; the NAME only saves a glob — the fail-closed field check (:225 class) stays the authority

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
  // [E8/E9 carrier per B's 8788 cheat-sheet (d1fd0dbb, read-only reuse)] the
  // BLUEPRINT carrier syntax is {kind, path} (schema.js:213-216); the WIRE
  // grant matcher is {kind, value}; the runtime overlay is {kind, resource} —
  // three closed grammars, never interchanged.
  'permissionMutationEnvelope:', '  rules:', '    - operationClass: edit', '      matcher:', '        kind: exact', '        path: notes.txt', '      maximumEffect: allow',
  'teamHardEnvelope:', '  rules:', '    - operationClass: edit', '      matcher:', '        kind: exact', '        path: notes.txt', '      maximumEffect: allow',
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
  // [E6 supply per root final ruling] canonical EXACT read+write for THIS
  // window's own HOME FSROOT link2.txt ONLY — not the directory, no glob,
  // no external path. edit stays ask; the Leader answers THIS request only.
  '          - tool: read', '            resource:', '              kind: exact',
  `              path: '@@LINK2_ABS@@'`,
  '          - tool: write', '            resource:', '              kind: exact',
  `              path: '@@LINK2_ABS@@'`,
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
  // [E8/E9 carrier per B's 8788 cheat-sheet (d1fd0dbb, read-only reuse)] the
  // BLUEPRINT carrier syntax is {kind, path} (schema.js:213-216); the WIRE
  // grant matcher is {kind, value}; the runtime overlay is {kind, resource} —
  // three closed grammars, never interchanged.
  'permissionMutationEnvelope:', '  rules:', '    - operationClass: edit', '      matcher:', '        kind: exact', '        path: notes.txt', '      maximumEffect: allow',
  'teamHardEnvelope:', '  rules:', '    - operationClass: edit', '      matcher:', '        kind: exact', '        path: notes.txt', '      maximumEffect: allow',
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
const memberToolDefs = []
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
    `        defaultWorkspace: ${JSON.stringify(FSROOT)}`, // root functional-window GO: member.workspace == THIS FSROOT; an explicit value ALWAYS wins in withDefaultWorkspace (host.ts :1032), so no Host cwd ever reaches a matcher
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
    // new TERMINATED Host-log line — OBSERVATION time at <=pollMs
    // granularity, honest about not being the writer's own timestamp.
    // Cursor law (root single-point fix): consume complete lines only.
    // split('\n') ends with an empty artifact when the text ends in a
    // newline (the normal case that the old condition wrongly skipped
    // ENTIRELY — zero lines recorded), and with a PARTIAL fragment when it
    // does not. Terminated-line count is lines.length-1 in both cases; the
    // unfinished tail stays unconsumed (cursor does not advance) for the
    // next poll — a partially-observed line is never recorded.
    const lines = text.split('\n')
    while (seenLines < lines.length - 1) {
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
function editWorkerInstanceId() {
  const f = join(HOME, 'storages', 'team_domain.json')
  if (!existsSync(f)) return null
  const doc = safeParse(readFileSync(f, 'utf8'))
  const templates = new Map()
  const byTemplate = new Map()
  const seen = new Set()
  const walk = (n) => {
    if (typeof n === 'string') { if (n.length > 1 && (n.startsWith('{') || n.startsWith('[')) && !seen.has(n)) { seen.add(n); walk(safeParse(n)) } return }
    if (n === null || typeof n !== 'object') return
    if (Array.isArray(n)) { n.forEach(walk); return }
    if (typeof n.templateId === 'string' && typeof n.instanceId === 'string') { templates.set(n.instanceId, n.templateId); byTemplate.set(n.templateId, n.instanceId) }
    for (const v of Object.values(n)) walk(v)
  }
  walk(doc)
  return byTemplate.get('edit-worker') ?? null
}
async function ledgerFactsAll(factType, needle) {
  const hits = []
  let afterSequence = 0
  for (let pageNo = 0; pageNo < 50; pageNo += 1) {
    const page = await remoteCallReady('team.getLedgerPage', { teamSessionId: currentRoot, afterSequence, limit: 500 }, `ehw-ledger-a-${pageNo + 1}`, 1)
    const data = resultData(page.body)
    const entries = Array.isArray(data?.entries) ? data.entries : []
    for (const e of entries) {
      if (e?.type !== factType && e?.factType !== factType) continue
      if (needle === undefined || JSON.stringify(e?.payload ?? e).includes(needle)) hits.push({ sequence: e.sequence ?? e.seq ?? null, payload: e.payload ?? null })
    }
    const next = data?.afterSequence ?? data?.nextAfterSequence
    if (typeof next !== 'number' || entries.length === 0) break
    afterSequence = next
  }
  hits.sort((a, b) => (a.sequence ?? 0) - (b.sequence ?? 0))
  return hits
}
function permissionRuleShape(fact) {
  const p = fact?.payload ?? {}
  const rule = Array.isArray(p.rules) ? p.rules[0] : (p.rule ?? p ?? {})
  const m = rule.matcher ?? rule ?? {}
  const target = m.resource ?? m.path ?? m.value ?? null
  const op = p.operation ?? p.op ?? rule.operation ?? rule.effect ?? null
  return {
    matcherKind: m.kind ?? null,
    target: typeof target === 'string' ? target : null,
    op: op ?? null,
    hasExactRule: m.kind === 'exact' && typeof target === 'string' && /(^|\/)notes\.txt$/.test(target),
  }
}
async function ledgerFactPresent(factType, needle) {
  let afterSequence = 0
  for (let pageNo = 0; pageNo < 50; pageNo += 1) {
    const page = await remoteCallReady('team.getLedgerPage', { teamSessionId: currentRoot, afterSequence, limit: 500 }, `ehw-ledger-f-${pageNo + 1}`, 1)
    const data = resultData(page.body)
    const entries = Array.isArray(data?.entries) ? data.entries : []
    for (const e of entries) {
      if (e?.type !== factType && e?.factType !== factType) continue
      if (needle === undefined || JSON.stringify(e?.payload ?? e).includes(needle)) return { sequence: e.sequence ?? e.seq ?? null, payload: e.payload ?? null }
    }
    const next = data?.afterSequence ?? data?.nextAfterSequence
    if (typeof next !== 'number' || entries.length === 0) break
    afterSequence = next
  }
  return null
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
async function driveGoverned(memberSession, marker, decision, tag, trackTarget = null) {
  const before = new Set(await pendingRequestIds())
  await apiPrompt(memberSession, marker, tag)
  const requestId = await waitFor(`new pending control request (${tag})`, 120_000, async () => {
    const fresh = (await pendingRequestIds()).filter((r) => !before.has(r))
    if (fresh.length === 0) return null
    if (fresh.length > 1) throw new Error(`${tag}: expected exactly ONE new pending request, saw ${fresh.length}`)
    return fresh[0]
  })
  // pending-state effect probe (root work-card): the target's sha/mtime are
  // measured AFTER the pending row exists and BEFORE resolve — no effect may
  // have happened while only a request was pending.
  const atPending = trackTarget !== null ? { sha: sha256(trackTarget), mtimeMs: statSync(trackTarget).mtimeMs } : null
  const res = await remoteCallReady('team.resolveControl', { teamSessionId: currentRoot, requestId, decision, note: `edit-hw ${tag}` }, tag, 4)
  if (resultError(res.body) !== null) throw new Error(`resolveControl ${decision} ${tag}: ${JSON.stringify(resultError(res.body)).slice(0, 300)}`)
  return { requestId, atPending }
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
  // [batch E4 per work-card] LEXICAL escape only this window: a relative
  // '..' spelling pointing at a canary in THIS window's own HOME (outside
  // FSROOT). NOT a symlink test (real symlink + exact link target via PA,
  // O_NOFOLLOW refusing post-consume at edit:250/260, stays a later leg —
  // this window must not demand zero pending/consume there).
  const CANARY = join(HOME, 'outside-canary.txt')
  writeFileSync(CANARY, 'CANARY-SENTINEL\n', 'utf8')
  const canaryShaBefore = sha256(CANARY)
  const canaryMtimeBeforeMs = statSync(CANARY).mtimeMs
  // [E6 symlink fixture] own-HOME symlink whose NAME is lawfully under the
  // instance root (no '..', not absolute): the pure-lexical anchor law PASSES
  // it; the write must then be refused POST-CONSUME by O_NOFOLLOW
  // (edit.mjs :250/260 region) — allow happens, bytes must not move.
  const SYM_LINK = join(FSROOT, 'link2.txt')
  const SYM_TARGET = join(HOME, 'own-target.txt')
  writeFileSync(SYM_TARGET, 'TARGET-SENTINEL\n', 'utf8')
  try { symlinkSync(SYM_TARGET, SYM_LINK) } catch { /* existing evidence world */ }
  const symTargetShaBefore = sha256(SYM_TARGET)
  // [E7 cross-envelope fixture] a SECOND lawful file in the root that this
  // member's envelope does NOT name (envelope level only — a true second
  // OWNER needs per-session mock routing, declared absent, NOT faked).
  const XB = join(FSROOT, 'notes-b.txt')
  writeFileSync(XB, 'bravo\n', 'utf8')
  const xbShaBefore = sha256(XB)

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
  writeFileSync(join(HOME, 'blueprints', 'a5m2-edit-hw.yaml'), SAVED_BP_V3_YAML.replaceAll('@@TARGET_ABS@@', join(FSROOT, 'notes.txt')).replaceAll('@@LINK2_ABS@@', join(FSROOT, 'link2.txt')))

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
        memberToolDefs.push(t)
      }
      TRANSCRIPT.push({ channel: 'receipt', kind: 'member-tool-surface', tools: memberToolsSeen })
    }
    for (const m of req?.messages ?? req?.body?.messages ?? []) {
      if (m?.role === 'tool') {
        const callId = typeof m?.tool_call_id === 'string' ? m.tool_call_id : ''
        if (callId.length > 0 && !callResults.some((r) => r.callId === callId)) {
          const known = steps.get(callId)
          callResults.push({ callId, step: known?.step ?? null, toolName: known?.tool ?? 'unknown', text: typeof m?.content === 'string' ? m.content : JSON.stringify(m?.content ?? ''), isError: m?.is_error === true })
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
    if (text.startsWith('EDIT-REASK')) return emitOrClose(text, () => ({ name: 'edit', args: { file_path: 'notes.txt', old_string: 'BETA-ALLOWED', new_string: 'BETA-REASKED' } })) // E3: INDEPENDENT marker/callId — proves a new call does NOT inherit the old allow; NOT a same-token replay claim
    if (text.startsWith('EDIT-ESCAPE')) return emitOrClose(text, () => ({ name: 'edit', args: { file_path: '../outside-canary.txt', old_string: 'C', new_string: 'X' } })) // E4: lexical '..' escape to the HOME canary
    if (text.startsWith('EDIT-SYMLINK')) return emitOrClose(text, () => ({ name: 'edit', args: { file_path: 'link2.txt', old_string: 'T', new_string: 'X' } })) // E6: lexical-passing symlink; refusal is expected POST-CONSUME at the write (O_NOFOLLOW)
    if (text.startsWith('EDIT-XENVELOPE')) return emitOrClose(text, () => ({ name: 'edit', args: { file_path: 'notes-b.txt', old_string: 'bravo', new_string: 'BRAVO-B' } })) // E7: lawful in-root path OUTSIDE this member's envelope (envelope-level cross check; NOT a second owner)
    if (text.startsWith('GRANT-EDIT')) return emitOrClose(text, () => ({ name: 'team_grant_permission', args: { rootSessionId: currentRoot, requestToken: `ehw-grant-${NONCE}`, targetInstanceId: editWorkerInstanceId(), rules: [{ operationClass: 'edit', matcher: { kind: 'exact', value: 'notes.txt' }, effect: 'allow' }] } })) // WIRE matcher = {kind, value} per the cheat-sheet; server-side canonicalization at the target member's durable effective workspace
    if (text.startsWith('REVOKE-EDIT')) return emitOrClose(text, () => ({ name: 'team_revoke_permission', args: { rootSessionId: currentRoot, requestToken: `ehw-revoke-${NONCE}`, targetInstanceId: editWorkerInstanceId(), rules: [{ operationClass: 'edit', matcher: { kind: 'exact', value: 'notes.txt' }, effect: 'allow' }] } })) // 88 same shape/name-swap per the cheat-sheet; reveal-as-expansion rides the SAME mutation authority
    if (text.startsWith('EDIT-POSTGRANT')) return emitOrClose(text, () => ({ name: 'edit', args: { file_path: 'notes.txt', old_string: 'BETA-ALLOWED', new_string: 'BETA-GRANTED' } })) // independent marker; behavior AFTER the grant is RECORDED honestly (overlay-consumed vs still-ask), never pre-claimed
    if (text.startsWith('EDIT-POSTREVOKE')) return emitOrClose(text, () => ({ name: 'edit', args: { file_path: 'notes.txt', old_string: 'gamma', new_string: 'GAMMA-REVOKED' } })) // root card 2: targets the INDEPENDENT 'gamma' row present in EVERY prior state of this file — a residual allow MUST move bytes to hide; behavior is additionally required
    if (text.startsWith('TOOLS-CHECK')) return { kind: 'text', content: `ACK-C0 ${NONCE}` }
    if (text.startsWith('EDIT-ALLOW')) return emitOrClose(text, () => ({ name: 'edit', args: { file_path: 'notes.txt', old_string: 'beta', new_string: 'BETA-ALLOWED' } })) // root ruling: the EDIT row's anchor contract is RELATIVE-to-root (edit.mjs :89-94 path.isAbsolute refuses); workspace/FSROOT stay aligned so the relative spelling resolves to the SAME target via canonicalLocator :233-236
    if (text.startsWith('EDIT-DENY')) return emitOrClose(text, () => ({ name: 'edit', args: { file_path: 'notes.txt', old_string: 'alpha', new_string: 'ALPHA-DENIED' } })) // same single-variable ruling as the allow arm
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
  // [E-pending0] HEALTH CHECK per work-card: the slate is empty before the
  // first governed call (the pending-state EFFECT probe lives inside
  // driveGoverned: sha/mtime measured after pending, before resolve).
  currentCriterion = 'E-pending0'
  const pend0 = await pendingRequestIds()
  check('E-pending0', 'no pending control requests before the first governed call', pend0.length === 0, `pending=${JSON.stringify(pend0)}`)

  // [E0-schema PROBE, root protocol fix] the Host's wire conversion is
  // llm-deepseek serialize.ts:160-164 (RUNTIME lib/types/serialize.js:168-172):
  //   tools.map(tool => ({ name, description, input_schema: tool.parameters,
  //                        ...defer_loading? }))
  // The mock receives the Messages request verbatim, so the wire tool object
  // is {name, description, input_schema} — the old decoder that read only
  // function.parameters/parameters produced ABSENT. The decoder now also
  // reads input_schema (narrow, protocol-faithful addition).
  // SEMANTICS: this leg is an INDEPENDENT FORENSIC PROBE — ok:null,
  // blocking:false. It is NEVER marked PASS (schema-shape evidence is not a
  // contract signature), and a shortfall here must NOT chain-stop
  // E1-E4 (safety-preflight failures elsewhere still stop). The actual wire
  // def's necessary fields are RECORDED for offline review; nothing here is
  // reconstructed afterwards.
  currentCriterion = 'E0-schema'
  const editDef = memberToolDefs.find((t) => (typeof t === 'string' ? t : t?.function?.name ?? t?.name) === 'edit') ?? null
  const editParams = editDef?.function?.parameters ?? editDef?.parameters ?? editDef?.input_schema ?? null
  const propKeys = editParams && typeof editParams.properties === 'object' ? Object.keys(editParams.properties).sort().join(',') : 'ABSENT'
  const reqKeys = Array.isArray(editParams?.required) ? [...editParams.required].sort().join(',') : 'ABSENT'
  const wireDefFields = editDef === null ? 'DEF-ABSENT' : JSON.stringify({
    topLevelKeys: Object.keys(editDef).sort(),
    name: editDef?.function?.name ?? editDef?.name ?? null,
    descBytes: Buffer.byteLength(String(editDef?.function?.description ?? editDef?.description ?? '')),
    schemaType: editParams?.type ?? null,
    propKeys, required: reqKeys,
  })
  const shapeMatches = propKeys === 'file_path,justification,new_string,old_string,replace_all,sandbox_permissions' && reqKeys === 'file_path,new_string,old_string'
  results.push({
    critId: 'E0-schema', blocking: false, ok: null,
    name: 'edit row wire schema SHAPE probe (independent, non-blocking, NEVER a PASS claim; serialize.ts:160-164 wire shape)',
    // verdict kept OUT of ok on purpose: 'shape-matches-list' / 'UNKNOWN-or-mismatch'
    verdict: shapeMatches ? 'shape-matches-list (still not a contract PASS)' : 'UNKNOWN-or-mismatch',
    detail: `wireDef=${wireDefFields}`,
  })
  log(`E0-schema PROBE (non-blocking, no PASS): verdict=${shapeMatches ? 'shape-matches-list' : 'UNKNOWN-or-mismatch'} wireDef=${wireDefFields.slice(0, 300)}`)

  currentCriterion = 'E1'
  const shaBefore = sha256(target)
  const stBefore = statSync(target)
  const dr1 = await driveGoverned(memberSession, 'EDIT-ALLOW', 'allow', 'ehw-e1', target)
  const allowReq = dr1.requestId
  const allowRes = await resultFor(stepOuter('EDIT-ALLOW'))
  const shaAfter = sha256(target)
  const stAfter = statSync(target)
  const consumed = await hasFact(allowReq, 'control-allow-consumed')
  check('E1', 'ALLOW -> control-allow-consumed fact + REAL bytes changed + mtime advanced + result not a refusal',
    consumed !== false && shaBefore !== shaAfter && readFileSync(target, 'utf8') === 'alpha\nBETA-ALLOWED\ngamma\n'
    && stAfter.mtimeMs > stBefore.mtimeMs && !/APPROVAL_DENIED|refused-edit|pa-handoff-refused/.test(String(allowRes)),
    `requestId=${allowReq} consumed=${JSON.stringify(consumed).slice(0, 200)} shaBefore=${shaBefore} shaAfter=${shaAfter} mtimeBeforeMs=${stBefore.mtimeMs} mtimeAfterMs=${stAfter.mtimeMs} result=${String(allowRes).slice(0, 250)}`)

  // E2: DENY chain — zero executed bytes on the SAME target
  currentCriterion = 'E2'
  const denyShaBefore = sha256(target)
  const denyStBefore = statSync(target)
  utimesSync(target, denyStBefore.atime, denyStBefore.mtime) // freeze clocks: a touch-open would still show
  const dr2 = await driveGoverned(memberSession, 'EDIT-DENY', 'deny', 'ehw-e2', target)
  const denyReq = dr2.requestId
  const denyRes = await resultFor(stepOuter('EDIT-DENY'))
  const denyConsumed = await hasFact(denyReq, 'control-allow-consumed')
  // [oracle fix per root ruling 2026-10-24] the deny leg is judged SEMANTIC and
  // TYPED — not by the execution-edge 'cf-class' string (that marker belongs to
  // the write/read edge refusals in team-tool-plane and was an oracle
  // mis-binding for PA pre-arm denies; ruled non-contractual here). Required,
  // all bound to the SAME requestId: (a) typed refusal code
  // APPROVAL_DENIED, (b) the durable-request binding string naming THIS
  // requestId answered deny, (c) the ledger control-decision-recorded fact for
  // this requestId exists (the real same-request decision), (d) NO
  // control-allow-consumed fact, (e) zero side effects — and the byte/mtime
  // VALUES are recorded in the detail THIS window (root: a before-value not
  // saved cannot later be claimed as independently recomputed; here it is).
  const denyDecision = await hasFact(denyReq, 'control-decision-recorded')
  const denyShaAfter = sha256(target)
  const denyMtimeAfterMs = statSync(target).mtimeMs
  check('E2', 'DENY -> typed APPROVAL_DENIED bound to the SAME requestId + same-request decision fact + zero side effects WITH recorded values + NO allow-consumed fact',
    denyShaBefore === denyShaAfter && Math.abs(denyMtimeAfterMs - denyStBefore.mtimeMs) < 1
    && String(denyRes).includes('APPROVAL_DENIED')
    && String(denyRes).includes(`durable Control request ${denyReq} answered deny`)
    && denyDecision !== false && denyConsumed === false,
    `requestId=${denyReq} consumed=${JSON.stringify(denyConsumed)} decisionFact=${denyDecision === false ? 'ABSENT' : JSON.stringify({ sequence: denyDecision.sequence, keys: Object.keys(denyDecision.payload ?? {}).slice(0, 10) })} shaBefore=${denyShaBefore} shaAfter=${denyShaAfter} mtimeBeforeMs=${denyStBefore.mtimeMs} mtimeAfterMs=${denyMtimeAfterMs} shaAtPending=${String(dr2.atPending?.sha)} shaAtPendingEqualsBefore=${String(dr2.atPending?.sha === denyShaBefore)} result=${String(denyRes).slice(0, 300)}`)

  // [E3 per work-card] one-shot re-ask with an INDEPENDENT marker/callId/result
  // ('EDIT-REASK' — the old EDIT-ALLOW reuse would hit TURN-DONE and read the
  // stale result). Proves a NEW call does NOT inherit the old allow (a fresh
  // pending row with a different requestId must appear); it is NOT a
  // same-token replay claim. The fresh row is denied; bytes stay frozen.
  currentCriterion = 'E3'
  const dr3 = await driveGoverned(memberSession, 'EDIT-REASK', 'deny', 'ehw-e3', target)
  const reaskReq = dr3.requestId
  const reaskRes = await resultFor(stepOuter('EDIT-REASK'))
  check('E3', 'one-shot: independent EDIT-REASK call asks a NEW pending (different requestId), is unconsumed after deny, bytes frozen — not a same-token replay claim',
    reaskReq !== allowReq && reaskReq !== denyReq
    && sha256(target) === denyShaAfter && dr3.atPending?.sha === denyShaAfter
    && (await hasFact(reaskReq, 'control-allow-consumed')) === false
    && String(reaskRes).includes('APPROVAL_DENIED'),
    `newRequestId=${reaskReq} allowReq=${allowReq} denyReq=${denyReq} shaNow=${sha256(target)} expectSha=${denyShaAfter} shaAtPending=${String(dr3.atPending?.sha)} result=${String(reaskRes).slice(0, 250)}`)

  // [E4 per work-card] lexical '..' escape to THIS window's OWN HOME canary
  // (no symlink this window; no permission extension). Real prompt, typed
  // refusal expected at the anchor law; the canary must be byte-frozen and
  // still a regular file. No zero-pending/zero-consume requirement here
  // (those belong to the later real-symlink/PA leg).
  currentCriterion = 'E4'
  await apiPrompt(memberSession, 'EDIT-ESCAPE', 'ehw-e4') // root review fix: bare marker like E1/E2/E3 — the NONCE suffix made stepFor carry it while resultFor waited without it, a guaranteed timeout
  const escapeRes = await resultFor(stepOuter('EDIT-ESCAPE'))
  const canaryFrozen = sha256(CANARY) === canaryShaBefore && Math.abs(statSync(CANARY).mtimeMs - canaryMtimeBeforeMs) < 1
  const canaryStillRegular = (() => { try { return lstatSync(CANARY).isFile() && !lstatSync(CANARY).isSymbolicLink() } catch { return false } })()
  check('E4', "lexical '../outside-canary.txt' escape refuses typed at the anchor law; HOME canary byte-frozen (sha + <1ms mtime tolerance) and still a regular file",
    /ANCHOR|P_EDIT|refused-edit|APPROVAL_DENIED/.test(String(escapeRes)) && canaryFrozen && canaryStillRegular,
    `result=${String(escapeRes).slice(0, 280)} canarySha=${sha256(CANARY)} canaryShaBefore=${canaryShaBefore} canaryMtimeMs=${statSync(CANARY).mtimeMs}/${canaryMtimeBeforeMs} stillRegular=${String(canaryStillRegular)}`)

  // [E5 WITHDRAWN per root final ruling 2026-10-24 — UNVERIFIED, obligation
  // NOT downgraded] the same-wire-id probe is NOT a token replay: the fixed
  // 639 registry creates the execution token INTERNALLY
  // (packages/core/tools/src/index.ts :1905-1907 createExecutionToken() =
  // Symbol('dsh.tool.execution'); :1393 inside createExecution(); type :319;
  // ToolExecution.token :397), and the 694b handoff (:4175-4211) / body
  // (:4369-4400) key by that REAL exec.token object/symbol — the wire callId
  // is not the token. The probe also looped without emitOrClose, its 6s catch
  // swallowed RPC/exit errors (false pass), and beta was already rewritten by
  // E1 so no matching effect existed. Token single-use/reuse lives at the
  // product's internal layer (plane-effect-backends :1133/1137
  // 'exec-token-terminal', :1189 'exec-token-replay'); an outer same-token
  // double-dispatch has NO public seam — reconciliation: NO dedicated
  // integration negative exists in this lane's kits (gap LISTED, product-side
  // territory; no backdoor built).
  // [E6 symlink POST-CONSUME] the lexical law passes this path (name under the
  // root, no '..', not absolute), so PA asks and the operator ALLOWS; the
  // write must then refuse via O_NOFOLLOW (edit :250/260 region) with ZERO
  // bytes on the own-HOME target. consumed-fact existence is EXPECTED here —
  // this leg must NOT demand zero pending/consume.
  currentCriterion = 'E6'
  const dr6 = await driveGoverned(memberSession, 'EDIT-SYMLINK', 'allow', 'ehw-e6', SYM_TARGET)
  const sym6Res = await resultFor(stepOuter('EDIT-SYMLINK'))
  const sym6Consumed = (await hasFact(dr6.requestId, 'control-allow-consumed')) !== false
  const symTargetFrozen = sha256(SYM_TARGET) === symTargetShaBefore
  const symStillLink = (() => { try { return lstatSync(SYM_LINK).isSymbolicLink() } catch { return false } })()
  // STRICT oracle per root final ruling: consumption MUST have happened (a
  // pre-dispatch refusal, e.g. APPROVAL_DENIED, FAILS this leg — the point is
  // the POST-CONSUME symlink/O_NOFOLLOW refusal), and the refusal text must
  // belong to the REAL symlink-alias/O_NOFOLLOW family — an arbitrary refusal
  // does not pass.
  check('E6', 'symlink under root passes lexical law, ALLOW CONSUMES, the WRITE refuses POST-CONSUME in the symlink/O_NOFOLLOW family with own-target bytes frozen and the link intact (arbitrary refusal does NOT pass)',
    sym6Consumed === true && symTargetFrozen && symStillLink
    && /symlink-alias|target name is a symlink alias \(O_NOFOLLOW\)/i.test(String(sym6Res)) // root final: 694b edit.mjs :259-260 maps ONLY ELOOP to cfReason='symlink-alias' detail 'target name is a symlink alias (O_NOFOLLOW); nothing was written'; :265 EACCES is path-rejected and does NOT count as the symlink proof
    && !/APPROVAL_DENIED/.test(String(sym6Res)),
    `requestId=${dr6.requestId} consumed=${String(sym6Consumed)} targetFrozen=${String(symTargetFrozen)} stillLink=${String(symStillLink)} result=${String(sym6Res).slice(0, 300)}`)

  // [E7 cross-ENVELOPE (level 1, named honestly)] a lawful in-root file that
  // this member's envelope does NOT name must be refused (pre-dispatch refuse
  // OR ask-then-deny), target frozen, no allow-consumed. NOT a second owner:
  // true cross-owner needs per-session mock routing — declared ABSENT below,
  // no internal side-channel was built.
  currentCriterion = 'E7'
  const pendBefore7 = new Set(await pendingRequestIds())
  await apiPrompt(memberSession, 'EDIT-XENVELOPE', 'ehw-e7')
  let xReq = null
  try {
    xReq = await waitFor('x-envelope pending', 8_000, async () => {
      const fresh = (await pendingRequestIds()).filter((r) => !pendBefore7.has(r))
      return fresh.length > 0 ? fresh[0] : null
    })
  } catch { xReq = null }
  let xPath = 'pre-dispatch-refuse (no pending row)'
  if (xReq !== null) {
    xPath = 'ask-lane (pending created) -> deny'
    await remoteCallReady('team.resolveControl', { teamSessionId: currentRoot, requestId: xReq, decision: 'deny', note: 'edit-hw e7 cleanup' }, 'ehw-e7d', 4)
  }
  const xRes = await resultFor(stepOuter('EDIT-XENVELOPE'))
  const xConsumed = xReq === null ? false : (await hasFact(xReq, 'control-allow-consumed')) !== false
  check('E7', "path-not-in-scope (NOT cross-owner, level-1 only): in-root 'notes-b.txt' refused (lane recorded honestly), target-b frozen, no allow-consumed",
    /refused|P_EDIT|ANCHOR|denied|APPROVAL_DENIED/.test(String(xRes)) && sha256(XB) === xbShaBefore && xConsumed === false,
    `lane=${xPath} requestId=${String(xReq)} consumed=${String(xConsumed)} xbSha=${sha256(XB)} xbShaBefore=${xbShaBefore} result=${String(xRes).slice(0, 280)}`)

  // [E8a hard] grant 87: EXECUTED (no status:rejected, no error) + durable
  // permission-mutated ledger fact whose payload carries the rule verbatim.
  currentCriterion = 'E8a'
  await apiPrompt(currentRoot, 'GRANT-EDIT', 'ehw-e8')
  const grantHit = await waitFor('GRANT-EDIT result', 60_000, () => callResults.find((r) => r.step === stepOuter('GRANT-EDIT')) ?? null)
  const e8Fact = await ledgerFactPresent('permission-mutated', 'notes.txt')
  const e8Shape = permissionRuleShape(e8Fact)
  check('E8a', 'grant (87): structured success (captured isError===false, no rejection text) AND durable permission-mutated fact with the EXACT rule on the notes.txt target (substring is not enough; op recorded)',
    e8Fact !== null && grantHit?.isError === false && !/rejected|NOT_LEADER|unwired/i.test(String(grantHit?.text))
    && e8Shape.hasExactRule === true,
    `factSeq=${String(e8Fact?.sequence)} shape=${JSON.stringify(e8Shape)} isError=${String(grantHit?.isError)} result=${String(grantHit?.text).slice(0, 240)}`)

  // [E8b probe, non-blocking] EDIT behavior after the grant overlay is
  // RECORDED, never pre-claimed: either the PA lane consumed the overlay
  // (no pending, bytes move — overlay-consumed) or it still asks (pending
  // appears — EDIT lane unaffected). Both outcomes are recorded verbatim;
  // a pending row is DENIED for cleanup.
  currentCriterion = 'E8b'
  const e8bShaBefore = sha256(target)
  const pendBefore8 = new Set(await pendingRequestIds())
  await apiPrompt(memberSession, 'EDIT-POSTGRANT', 'ehw-e8b')
  let e8bReq = null
  try {
    e8bReq = await waitFor('post-grant pending?', 8_000, async () => {
      const fresh = (await pendingRequestIds()).filter((r) => !pendBefore8.has(r))
      return fresh.length > 0 ? fresh[0] : null
    })
  } catch { e8bReq = null }
  let e8bRes = 'N/A (awaiting result)'
  if (e8bReq !== null) {
    await remoteCallReady('team.resolveControl', { teamSessionId: currentRoot, requestId: e8bReq, decision: 'deny', note: 'edit-hw e8b cleanup' }, 'ehw-e8bd', 4)
    e8bRes = await resultFor(stepOuter('EDIT-POSTGRANT'))
  } else {
    e8bRes = await resultFor(stepOuter('EDIT-POSTGRANT'))
  }
  results.push({
    critId: 'E8b', blocking: false, ok: null,
    name: 'post-grant EDIT behavior probe (recorded honestly; consumed-vs-still-ask, NEVER a PASS claim)',
    verdict: e8bReq !== null
      ? 'still-ask (pending created; denied for cleanup)'
      : (/refused|P_EDIT|IO_POLICY|APPROVAL_DENIED|denied|Error/i.test(String(e8bRes))
        ? 'no-pending, outcome NOT success — cause NOT recorded, NO overlay-effect claim'
        : (sha256(target) !== e8bShaBefore
          ? 'overlay-effect (bytes moved on success)'
          : 'no-pending, no byte move — cause NOT recorded, NO overlay-effect claim')),
    detail: `pending=${String(e8bReq)} shaBefore=${e8bShaBefore} shaNow=${sha256(target)} result=${String(e8bRes).slice(0, 260)}`,
  })
  log(`E8b PROBE (non-blocking): pending=${String(e8bReq)} sha ${e8bShaBefore.slice(0, 12)}->${sha256(target).slice(0, 12)}`)

  // [E9a hard] revoke 88: EXECUTED without rejection + a SECOND durable
  // permission-mutated fact. If 88 answers status:rejected, FAIL as-is
  // (carrier coverage is part of the fixture; no silent pass).
  currentCriterion = 'E9a'
  await apiPrompt(currentRoot, 'REVOKE-EDIT', 'ehw-e9')
  const revokeHit = await waitFor('REVOKE-EDIT result', 60_000, () => callResults.find((r) => r.step === stepOuter('REVOKE-EDIT')) ?? null)
  const revokeOutcome = String(revokeHit?.text ?? '')
  // [root false-pass card 1 fix] the FIRST permission-mutated row from seq 0
  // would happily be E8a's GRANT — the revoke must be proven by a NEW fact
  // strictly after the grant fact, with a DISTINCT payload, plus structured
  // success on the call itself (not merely the absence of 'rejected').
  const e9All = await ledgerFactsAll('permission-mutated', 'notes.txt')
  const e9New = e9All.filter((f) => e8Fact?.sequence != null && typeof f.sequence === 'number' && f.sequence > e8Fact.sequence)
  const e9Last = e9New.length > 0 ? e9New[e9New.length - 1] : null
  const e9PayloadDistinct = e9Last !== null && JSON.stringify(e9Last.payload) !== JSON.stringify(e8Fact?.payload)
  const e9Shape = permissionRuleShape(e9Last)
  const e9OpOk = e9Shape.op === null ? true : /revoke/i.test(String(e9Shape.op)) // op field, WHEN present, must be the revoke family
  const e9Structured = revokeHit?.isError === false && String(revokeOutcome).length > 0 && !/rejected|NOT_LEADER|unwired|error/i.test(String(revokeOutcome))
  check('E9a', 'revoke (88): structured success (captured isError===false) AND a NEW permission-mutated fact STRICTLY after the grant seq, DISTINCT payload, EXACT rule on notes.txt, op (when present) = revoke family',
    e9Last !== null && e9PayloadDistinct && e9Structured && e9Shape.hasExactRule === true && e9OpOk,
    `grantSeq=${String(e8Fact?.sequence)} newSeq=${String(e9Last?.sequence)} shape=${JSON.stringify(e9Shape)} payloadDistinct=${String(e9PayloadDistinct)} isError=${String(revokeHit?.isError)} result=${String(revokeOutcome).slice(0, 240)}`)

  // [E9b hard, zero-residue] after the revoke, a fresh EDIT must NOT execute
  // silently: bytes MUST be unchanged. A pending row reappearing is the
  // expected regression-to-ask shape (DENIED for cleanup, recorded).
  currentCriterion = 'E9b'
  const e9bShaBefore = sha256(target)
  const pendBefore9 = new Set(await pendingRequestIds())
  await apiPrompt(memberSession, 'EDIT-POSTREVOKE', 'ehw-e9b')
  // [root false-pass card 2 fix] the old fixed old_string 'BETA-ALLOWED'
  // could be ABSENT by now (E8b may have rewritten it to BETA-GRANTED), so a
  // residual allow would "pass" by finding no match — sha-unchanged alone was
  // a false-pass path. This leg targets the INDEPENDENT 'gamma' row, which
  // every state of this window provably still contains, so an executing
  // residual WOULD move bytes. And passing now requires BEHAVIOR: either a
  // real PA pending that we deny with NO consume on the SAME requestId, or a
  // typed permission refusal in the result — never bare sha-unchanged.
  let e9bReq = null
  try {
    e9bReq = await waitFor('post-revoke pending?', 8_000, async () => {
      const fresh = (await pendingRequestIds()).filter((r) => !pendBefore9.has(r))
      return fresh.length > 0 ? fresh[0] : null
    })
  } catch { e9bReq = null }
  let e9bRes = 'N/A'
  if (e9bReq !== null) {
    await remoteCallReady('team.resolveControl', { teamSessionId: currentRoot, requestId: e9bReq, decision: 'deny', note: 'edit-hw e9b cleanup' }, 'ehw-e9bd', 4)
    e9bRes = await resultFor(stepOuter('EDIT-POSTREVOKE'))
  } else {
    await new Promise((res) => setTimeout(res, 2_000))
    e9bRes = await resultFor(stepOuter('EDIT-POSTREVOKE'))
  }
  const e9bNoConsume = e9bReq === null ? null : (await hasFact(e9bReq, 'control-allow-consumed')) === false
  const e9bTypedRefusal = /refused|P_EDIT|IO_POLICY|APPROVAL_DENIED|denied/.test(String(e9bRes)) && !/Edited/.test(String(e9bRes))
  const e9bDeniedLane = e9bReq !== null && e9bNoConsume === true && !/Edited/.test(String(e9bRes))
  check('E9b', "post-revoke residue on the 'gamma' canary (provably present in EVERY prior state): bytes unchanged AND behavior proves non-execution — real PA pending denied with no consume on the SAME requestId, or a typed permission refusal; bare sha-unchanged does NOT pass",
    sha256(target) === e9bShaBefore && (e9bDeniedLane || e9bTypedRefusal),
    `pending=${String(e9bReq)} noConsume=${String(e9bNoConsume)} typedRefusal=${String(e9bTypedRefusal)} deniedLane=${String(e9bDeniedLane)} shaBefore=${e9bShaBefore} shaNow=${sha256(target)} result=${String(e9bRes).slice(0, 260)}`)

  await cleanup()
  // non-blocking probe rows (ok:null, blocking:false) never decide the rc; real criteria (ok true/false) do.
  finish(results.every((r) => r.blocking === false || r.ok === true) && cleanupOk ? 0 : 1)
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
