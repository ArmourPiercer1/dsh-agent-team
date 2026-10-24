#!/usr/bin/env node
/**
 * A5M2 CONTROL host-window runner — minimal governed-Control vertical slice.
 * Scope per the root's a738 narrow review: 83 REQUEST -> 85 DISCOVERY -> 84
 * DECISION on the designated requestId -> IDENTITY REFUSAL (the member's own
 * resolve attempt refused, no extra durable decision fact). The EDIT/
 * consumption leg is REMOVED (A's known unclosed second leg; NOT covered here
 * and NOT claimed — consumption stays explicitly UNTESTED, so this window
 * never declares a full C2 on its own).
 *
 * Every Control decision/read is a REAL tool-registry toolCall; RPC rides
 * OBSERVATION ONLY (the transcript check proves no RPC write ever decided).
 *   L1 leader  toolCall team_create_member
 *   L2 member  toolCall team_request_control  (record 83, PA-armed CONTROL row
 *              via the deployer closed key g1PureQuery.control:true — the real
 *              takeover, not just the native; durable control-request-recorded)
 *   L3 leader  toolCall team_list_pending_control (85 discovery must answer
 *              with the designated request) -> toolCall team_resolve_control
 *              ALLOW (84) on THAT requestId
 *   L4 member  toolCall team_resolve_control ATTEMPT -> REFUSED (the member's
 *              surface carries no resolver)
 *
 * Outer-layer arrangement per the root's FINAL B ruling, carried onto the
 * hand-off fix pack e58349dd (694b descendant; vocabulary registration
 * 0c15d1448c: 83/84/87/88 ruleable on the 85 invocation-only
 * pattern; envelope + native resolver identity UNTOUCHED): per-role exact
 * kind:any SINGLE-TOOL allow rules (projecting exact realm|tool:name, NOT
 * alltools) — MEMBER: team_request_control only; LEADER: create_member +
 * list_pending_control + resolve_control (no 83 — the leader does not
 * request). Everything else stays default deny on BOTH roles; 87/88 carry
 * no rules here (not this scenario's roles). Pins swapped from the f86
 * receipt recomputed read-only by B (tgz e3e845f0..0bc9f = 4,337,935 B;
 * lock d23fe07c..d9c0; fixture pkg a435be55..81374). 37646-era claims are
 * retired; the old PR-D/native behaviour never proved the new CONTROL arm.
 *
 * BOOT is behind the root's ruling: A5M2_CONTROL_WINDOW=GRANTED. Without it:
 * NOT_RUN receipt, rc 3. A5M2_CONTROL_DRY=1 runs the REAL pre-flight to the
 * boot boundary and stops BEFORE any spawn — its receipt is NOT_RUN/
 * booted:false, never a green PASS (root a738 ④).
 *
 * PRODUCT (mount law = A's fifth-window runner verbatim): HOST =
 * ROOT_DIR/tests/deepseek-harness-test-use (639 CLI tree; the npm install dir
 * is NEVER the Host). PRODUCT = INSTALL_DIR (37646 npm-form fixture, READ-ONLY
 * triple pin) -> exports['./host'] -> public cordis profile-patch insert
 * (CORE PATCH BUDGET 0). Fixed: host 3184, mock 3499 (pre-check only, NEVER
 * kill foreign); fresh explicit tests/homes/a5m2-ctl-hw-<UTC>Z (fail closed if
 * non-empty; NEVER deleted). MOUNTED barrier before the first RPC (root
 * one-point card; ported from A's committed fix a7f7c0e8e / 7f6bbd46c law).
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

const COMPOSED_SHA = '7feb6a5e22bf7c531c1d679c786618b826b6ccdd' // standard package supplied 2026-10-24: static producer InvocationOnly exclusion fix INSIDE (87/88's two typed closures re-verifiable); overlay98f NOT inside — post-grant business effect must NOT be preset // fresh-member profile producer pack (strict 2fb child-of-f923; face = 1 dist agent-bindings blob c9c3a787..; int tip 18c3327e6 = product-identical per root; the FOUR prior window failures stay FAILED, not recomputed away)
const EXPECTED_PACK_SHA = 'sha256:8e1eb73096b921128d585343015923e71c70c4edbe0af888294af2ceefda2146' // f86 receipt, recomputed by B read-only (4,348,510 B)
const EXPECTED_LOCK_SHA = 'sha256:08fd5788e9b80432f30d2649ea473b2d8bf55003556188152eba2bb5b800e9de' // f86 step-B FINAL lock, recomputed by B read-only (612,696 B, integrity=2fb tgz MATCH)
const EXPECTED_TGZ_NAME = 'dsh-agent-team-0.1.1-alpha.2.tgz'
const EXPECTED_TGZ_DIR_PREFIX = 'out-7feb6a5e-'
const PACK_BYTES_MAX = 8_000_000
const HOST_PORT = 3184 // root-pinned for B
const MOCK_PORT = 3499 // root-pinned for B
const WORLD_PREFIX = 'a5m2-ctl-hw'
const BP_ID = 'team.a5m2-ctl-hw'
const WINDOW_GO = process.env.A5M2_CONTROL_WINDOW === 'GRANTED'
const DRY = process.env.A5M2_CONTROL_DRY === '1'
const INSTALL_DIR = process.env.A5M2_CONTROL_INSTALL_DIR
  ?? '/srv/workspace/dsh-plugins/dsh-agent-team/.worktrees/pack-int/install-8e1eb730' // f86 frozen-offline install (RC=0, +532 reused, down 0); absence fail-closes rc3

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

// ── blueprints: BOTH roles governed with a complete outer permission
//    arrangement for THIS scenario (root a738 ③); default deny everywhere else;
//    member teamTools face = request-control only (no resolver, no self-approve)
const ANCHOR_V3_YAML = [
  '---', 'schemaVersion: 3', `blueprintId: ${BP_ID}.boot-anchor`, 'revision: "1"',
  'leader:', '  templateId: leader', '  persona: "You are the leader of the A5M2 CONTROL window team."',
  'members:', '  - templateId: ctl-worker', '    persona: "You are a worker of the A5M2 CONTROL window team."',
  'memberEnvelopes: []', 'requirements: []',
  'permissionMutationEnvelope:', '  rules: []',
  'teamHardEnvelope:', '  rules: []',
  'policyStates: []', 'metadata: {}', '---', '',
].join('\n')
const RUN_STAMP = new Date().toISOString().replace(/[:.]/g, '-')
const HOME = join(ROOT_DIR, 'tests', 'homes', `${WORLD_PREFIX}-${DRY ? 'dry-' : ''}${RUN_STAMP}Z`) // fresh EXPLICIT home (root-pinned law)
const FIXTURE_DIR = join(HOME, 'read-fixture') // root final card: instance cwd was HostTree — the fixture lives in THIS run's HOME
const FIXTURE_POSIX = (x) => String(x).replace(/\\/g, '/')
let WORKSPACE_CANONICAL = FIXTURE_POSIX(FIXTURE_DIR) // placeholder until the HOST-PUBLIC registration answers (root ruling); reassigned below
let FIXTURE_FILE = WORKSPACE_CANONICAL + '/package.json' // carrier/WIRE/tool-input all read THIS at runtime: the real canonical, never a self-claimed literal
const buildSavedBp = () => [ // MATERIALIZE AT WRITE TIME (after registration) — a module-baked literal would freeze the placeholder
  '---', 'schemaVersion: 3', `blueprintId: ${BP_ID}`, 'revision: "1"',
  'leader:', '  templateId: leader', '  persona: "You are the leader of the A5M2 CONTROL window team. Resolve member control requests through your team tools when instructed; keep answers brief."',
  '  capabilities:', '    teamTools:', '      kind: allow', '      items:', // LeaderTemplate capabilities REQUIRE teamTools (validate.ts:967 — the real parse
  '        - team_create_member', '        - team_list_pending_control', // caught its absence): the closed leader face for THIS scenario, exact three.
  '        - team_resolve_control',
  '        - team_grant_permission', '        - team_revoke_permission', // root one-shot fix delta #1: the two approved CONTROL tools, leader-only
  '    builtinToolDeny:', // capabilities is ALL-OR-NOTHING once present (validate.ts:966-970) —
  '      - ask_user_question', '      - create_goal', '      - exit_plan_mode', // full closed shape, kit leaderBlock law: teamTools/builtinToolDeny/skills/mcp/(permissions).
  '      - get_goal', '      - glob', '      - grep', '      - job_kill',
  '      - job_list', '      - job_output', '      - present', '      - skill',
  '      - update_goal', '      - web_fetch', '      - web_search', '      - workflow',
  '    skills:', '      kind: allow', '      items: []',
  '    mcp:', '      kind: allow', '      items: []',
  '    permissions:', '      default: deny', '      allow:', // NEW PRODUCT 4a26ac9a: all THREE leader scenario faces are ruleable —
  '          - tool: team_create_member', '            resource:', '              kind: any', // exact kind:any SINGLE-TOOL rules (exact realm|tool:name projections,
  '          - tool: team_list_pending_control', '            resource:', '              kind: any', // NOT alltools). 83 stays OFF the leader (it does not request); the rest deny.
  '          - tool: team_resolve_control', '            resource:', '              kind: any',
  '          - tool: team_grant_permission', '            resource:', '              kind: any', // delta #2: single-tool exact invocation allows;
  '          - tool: team_revoke_permission', '            resource:', '              kind: any', // member/envelopes/ceilings otherwise UNTOUCHED
  '      ask: []', '      deny: []',
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
  '      permissions:', // NEW PRODUCT 4a26ac9a (registration 0c15d1448c made the 83 face ruleable):
  '        default: deny', '        allow:', // exact kind:any SINGLE-TOOL rule for 83 (projects exact realm|tool:name,
  '          - tool: team_request_control', '            resource:', '              kind: any', // NOT alltools); everything else stays deny. Envelope + native identity stand.
  '        ask: []', '        deny: []', // closed permissions shape stays complete (validator requires ask/deny).
  '  - templateId: ctl-resolver', // L5 NATIVE-IDENTITY canary (root batch card): the resolve op IS BOUND
  '    persona: "You are the resolver-canary worker. Follow the marker instructions literally and only."', // to a member — service.js:2004-2010 (invariant 37: a member is NEVER a resolver,
  '    capabilities:', '      teamTools:', '        kind: allow', '        items:', // EVEN WITH the resolve-control op) must still refuse CONTROL_RESOLVER_NOT_AUTHORIZED.
  '          - team_request_control', '          - team_resolve_control', // the BOUND op (binding != resolver premise)
  '      builtinToolDeny:', // A's isolation list verbatim (identical exposure to ctl-worker plus the bound op)
  '        - ask_user_question', '        - create_goal', '        - exit_plan_mode',
  '        - get_goal', '        - glob', '        - grep', '        - job_kill',
  '        - job_list', '        - job_output', '        - present', '        - skill',
  '        - update_goal', '        - web_fetch', '        - web_search', '        - workflow',
  '      skills:', '        kind: deny', '      mcp:', '        kind: deny',
  '      permissions:', '        default: deny', '        allow:', // exact kind:any SINGLE-TOOL rules for BOTH bound ops (same closed vocabulary law).
  '          - tool: team_request_control', '            resource:', '              kind: any',
  '          - tool: team_resolve_control', '            resource:', '              kind: any',
  '        ask: []', '        deny: []',
  'teamEnvelope:', '  allow:',
  '    - assign-task', '    - create-member', '    - send-message',
  '    - report-progress', '    - request-control', '    - resolve-control',
  '  deny: []',
  // member mutation envelope: request-control ONLY (verified M1 shape). NO
  // resolve, NO self-approve — L4 proves the refusal.
  'memberEnvelopes:', '  - templateId: ctl-worker', '    envelope:', '      allow:',
  '        - request-control', '      deny: []', // ctl-worker envelope UNCHANGED (root's bounded approval)
  '  - templateId: ctl-resolver', // window-3 raw: inBounds=[] — the canary member had NO envelope entry,
  '    envelope:', '      allow:', // its own request died at the envelope layer (TEAM_RUNTIME_ENVELOPE_OUT_OF_BOUNDS,
  '        - request-control', '        - resolve-control', // fail-closed, correctly). Root bounded approval: ONLY the two ops this leg
  '      deny: []', // needs — request-control to produce a REAL pending; resolve-control to reach the NATIVE
  'requirements: []', // reviewer-closure code. Envelope allowance != native identity passing (L5 oracle unchanged).
  'permissionMutationEnvelope:', '  rules:', // L6/L7 CARRIER — the GRAMMAR TRIO, each spelled per its ORIGINAL SOURCE:
  '    - operationClass: read', // (1) BLUEPRINT carrier matcher = {kind, path} (schema.js:213-216 FILE_MATCHER_FIELDS) —
  '      matcher:', '        kind: exact', //     what THIS block below uses, validated by parseBlueprint OFFLINE.
  `        path: ${FIXTURE_FILE}`, // THREE-WAY CONSISTENT absolute canonical: carrier path == WIRE value == tool input (root 三处一致) // (2) WIRE grant rule matcher = {kind, value} (tools.js parsePermissionRules, value<=4096).
  // (3) RUNTIME overlay matcher = {kind, resource} (permission-mutation.js validateMatcher).
  '      maximumEffect: allow',
  'teamHardEnvelope:', '  rules:', // schemaVersion-3 CEILING-2 (never merged with the carrier; both must cover).
  '    - operationClass: read',
  '      matcher:', '        kind: exact',
  `        path: ${FIXTURE_FILE}`, // THREE-WAY CONSISTENT absolute canonical: carrier path == WIRE value == tool input (root 三处一致)
  '      maximumEffect: allow',
  'policyStates: []', 'metadata: {}', '---', '',
].join('\n')

const NONCE = Math.random().toString(36).slice(2, 8)
const RUN_DIR = join(ROOT_DIR, 'dev', 'agent-workflow', 'evidence', 'a5m2-control-host-window', `runs-${DRY ? 'dry-' : ''}${RUN_STAMP}`)
const TRANSCRIPT = []
const checks = []
const steps = new Map()      // callId -> {step, tool} — callIds UNIQUE per emission (root a738: no dedupe/mixing)
const callResults = []       // harvested tool results (THE registry-execution witness)
const memberToolsSeen = []   // filled ONLY from the member's real TOOLS-CHECK request (root a738 ②)
const leaderToolsSeen = []  // filled ONLY from the LEADER's real TOOLS-CHECK-L request — parse pass is NOT visibility (root)
const readOkWitness = (res, nonce) => res !== null && res.isError !== true
  && String(res?.text ?? '').includes(`A5M2-CTLHW-PROBE-${nonce}`) // SAME-call structured success AND window-unique probe content (name-only NOT enough)
const permissionMutatedWitness = (res, expected) => { // REAL 2fb 87/88 result (tools.js) — root 76eba review: exact-match THIS call's identity
  if (res === null || res.isError !== false) return false // acceptance = structured parse AND isError===false
  try {
    const j = JSON.parse(String(res.text ?? ''))
    return j?.status === 'permission-mutated'
      && j?.rootSessionId === expected.rootSessionId // THIS window's root — a foreign root row never passes
      && j?.targetInstanceId === expected.targetInstanceId // THIS member instance, exact
      && j?.verb === expected.verb // grant leg proves grant; revoke leg proves revoke
      && typeof j?.changed === 'boolean'
  } catch { return false }
}
const explicitRefusalWitness = (res, nonce) => {
  const t = String(res?.text ?? '')
  if (t.includes(`A5M2-CTLHW-PROBE-${nonce}`)) return false // ANY leak of the expected read result means this was not a refusal
  if (/"(code|status)"\s*:\s*"[^"]*(denied|deny|rejected|refused|blocked)/i.test(t)) return true // explicit typed refusal code/status
  return res?.isError === true && /\b(denied|deny|refus\w*|blocked|not authorized|no authority)\b/i.test(t) // harness-level explicit error wording
} // arbitrary 'permission' strings NEVER pass (root final card)
const member2ToolsSeen = []  // L5 canary: the ctl-resolver member's OWN surface (TOOLS-CHECK2)
let callSeq = 0
let currentCriterion = 'setup'
let mock = null
let instance = null
let origin = null
let cookie = null
let launchToken = null // THIS launch's token, memory-only (639 protocol: valid across Connection reload — root 639-source ruling); NEVER logged
let currentRoot = null

function log(msg) { console.log(`[ctlhw] ${msg}`) }
function sha256(file) { return `sha256:${createHash('sha256').update(readFileSync(file)).digest('hex')}` }
async function sleep(ms) { return new Promise((r) => setTimeout(r, ms)) }
function check(criterion, name, ok, detail) {
  checks.push({ criterion, name, ok: ok === true, detail: detail === undefined ? null : String(detail) }) // receipt-preservation: summary detail NEVER truncated (694b/e583 raws proved the truncation eats typed details at the exact breakpoint the root needs)
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
  // root a738 ④: DRY never PASSes — its honest verdict is NOT_RUN/booted:false
  // (rc 3), even when every preflight step succeeded.
  const preflightOk = checks.length > 0 && checks.every((c) => c.ok) && code === 0
  const pass = !DRY && preflightOk
  const verdict = DRY ? 'NOT_RUN' : (pass ? 'PASS' : 'FAIL')
  const summary = {
    runner: '05-control-window-runner.mjs', scenario: 'control-slice-83-85-84-identity', dry: DRY,
    booted: !DRY && instance !== null, verdict,
    scopeNote: 'consumption/EDIT leg NOT covered this window (explicitly UNTESTED, root a738 scope) — full C2 is NOT claimed by this receipt',
    ports: { host: HOST_PORT, mock: MOCK_PORT }, world: HOME, runDir: RUN_DIR,
    checks, stamps: { nonce: NONCE, runStamp: RUN_STAMP },
  }
  try {
    mkdirSync(RUN_DIR, { recursive: true })
    writeFileSync(join(RUN_DIR, 'summary.json'), JSON.stringify(summary, null, 2))
    writeFileSync(join(RUN_DIR, 'transcript.jsonl'), TRANSCRIPT.map((t) => JSON.stringify(t)).join('\n'))
    writeFileSync(join(RUN_DIR, 'toolcalls.jsonl'), toolCallLog.map((t) => JSON.stringify(t)).join('\n')) // MINIMAL: callId/step/tool/isError/text<=800/args<=800 only
  } catch { /* evidence best-effort; verdict unchanged */ }
  console.log(JSON.stringify({ verdict, pass, failed: checks.filter((c) => !c.ok).length, checks: checks.length, runDir: RUN_DIR }, null, 2))
  process.exit(DRY ? 3 : (pass ? 0 : (code === 0 ? 2 : code)))
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
    '        teamToolPlane:',
    "          realmId: 'a5m2-ctl-hw-realm'", // pins a5PlaneRealmId (trusted identity pairing fact of every arm row)
    '          g1PureQuery:', // THE CONTROL takeover (root a738 ③): the deployer CLOSED KEY that arms the
    '            control: true', // B-CONTROL write rows 83/84 as PA governed rows over the captured natives
    '',                          // (agent-bindings :5452-5788 law: EXACTLY true, closed grammar; any other
  ].join('\n'))                   // value REFUSES the mount typed — never a silently widening config)
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
/** READ-ONLY durable attachment (root card; NEVER writes): team_domain.json carries the tenth
 * store `permission_overlays` (storage/schema/stores.js; schema/permission-overlay.js:8-26,106-123:
 * identity{teamSessionId,memberInstanceId}, metadata{generation,previousSnapshotId},
 * provenance{mutationId,...}, state.rules[] = {operation,resource,effect}, effect allow|ask|deny). */
function overlaySnapshotFacts() {
  try {
    const doc = JSON.parse(readFileSync(join(HOME, 'storages', 'team_domain.json'), 'utf8'))
    const table = doc?.tables?.permission_overlays ?? doc?.permission_overlays ?? null
    if (table === null || table === undefined) return { status: 'NOT_VERIFIED', reason: 'no permission_overlays table readable in team_domain.json this world' }
    const rows = Array.isArray(table) ? table : Object.values(table ?? {})
    return rows.length === 0 ? { status: 'NOT_VERIFIED', reason: 'permission_overlays table present but zero rows readable' } : { status: 'FOUND', rows }
  } catch (e) {
    return { status: 'NOT_VERIFIED', reason: `overlay store not readable read-only: ${String(e).slice(0, 120)}` }
  }
}
async function workspaceRpc(method, request, tag) { // PUBLIC Host face: ctx.remote.workspace.create over the client channel
  const res = await fetchJson(`${origin}/api/workspace/${method}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie },
    body: JSON.stringify({ type: 'client-request', rpcId: `${tag}-${Math.random().toString(36).slice(2, 12)}`, method: `workspace/${method}`, payload: { args: { request } } }),
  })
  TRANSCRIPT.push({ channel: 'workspace-rpc', method, request, status: res.status, body: res.body })
  return res
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

// [root one-point card, B inherits A's gap] the `dsh web:` URL banner does
// NOT mean the Team route exists (host.js awaits createTeamDomain first and
// registers the Team Remote later; A's sixth window fired the first RPC right
// after the banner and stopped on 405/NO_RESULT). BEFORE the first RPC this
// driver waits for THIS run's host log to carry the registration site's OWN
// line `[dsh-agent-team] remote mount: MOUNTED channel=/team-remote`;
// SKIPPED / mount FAILED / bootstrap FAILED stop typed and first, child exit
// stops as HOST_CHILD_EXITED, timeout stops as REMOTE_MOUNT_NEVER_APPEARED —
// NOT a generic 405 retry; post-mount readiness stays the ORIGINAL
// teamReadyBarrier (unknown answers stop, no retry). Ported near-verbatim
// from A's committed minimal fix (.worktrees/a5m2-wire-g3 @ a7f7c0e8e,
// 05-edit-window-runner.mjs:327-364, itself the fourth-window barrier per
// commit 7f6bbd46c1ca536cb09feae85f627940f40b7bb4) — no redesign, no product
// package touched.
const REMOTE_MOUNT_MARKER = '[dsh-agent-team] remote mount: MOUNTED channel=/team-remote'
const REMOTE_MOUNT_REFUSALS = Object.freeze([
  { name: 'REMOTE_MOUNT_SKIPPED', pattern: /\[dsh-agent-team\] remote mount: SKIPPED/ },
  { name: 'REMOTE_MOUNT_FAILED', pattern: /\[dsh-agent-team\] remote mount: FAILED/ },
  { name: 'PLUGIN_BOOTSTRAP_FAILED', pattern: /\[dsh-agent-team\] bootstrap FAILED/ },
])
async function remoteMountGate({ readLog, childGone = () => false, budgetMs = 120_000, pollMs = 250 }) {
  const deadline = Date.now() + budgetMs
  let polls = 0
  for (;;) {
    polls += 1
    if (childGone() === true) throw new Error('HOST_CHILD_EXITED before the Team Remote mounted: no team RPC was attempted')
    const text = String(readLog() ?? '')
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
/** Root 2026-10-24 ruling, encoded as a PURE function (offline-micro-verifiable):
 * a readiness 401 is a REAL auth rejection — recorded as AUTH_REJECTED, never swallowed.
 * Recovery: exactly ONE public GET /?token auth exchange (same origin, THIS launch token;
 * 303 + non-empty set-cookie required), then ONE read-only listRoots. Exchange failure,
 * missing cookie, a SECOND 401 or any NO_RESULT -> immediate STOP. Loop reauth FORBIDDEN.
 * Only a genuine typed starting re-enters the original bounded barrier. */
function authRecoveryVerdict(status, err, reauthUsed) {
  if (status === 401) return reauthUsed ? 'stop-second-auth-rejection' : 'recover-once' // 401 PRIORITY (root 57ff review): a 401 WITH any body is still AUTH_REJECTED — never routed by its body first
  if (status !== 200) return 'stop-other' // ready/starting require SUCCESSFUL HTTP; other transports never retry
  if (err === null) return 'ready'
  const starting = err.code === 'internal-error' && err.details?.reason === 'runtime-not-ready'
    && String(err.message).includes('state: starting') // EXACT original shape restored: failed/stopped runtime-not-ready NEVER retries
  return starting ? 'retry-starting' : 'stop-other'
}
async function teamReadyBarrier(budgetMs = 180_000) {
  const deadline = Date.now() + budgetMs
  let reauthUsed = false // ceiling: exactly ONE recovery exchange per window (root ruling; 08 proves the ceiling offline)
  for (;;) {
    const res = await remoteCall('team.listRoots', {}, 'ctlhw-ready', 3)
    const err = resultError(res.body)
    const verdict = authRecoveryVerdict(res.status, err, reauthUsed)
    if (verdict === 'ready') return
    if (verdict === 'retry-starting') {
      if (Date.now() >= deadline) throw new Error('readiness budget exhausted while starting')
      await sleep(1500)
      continue
    }
    if (verdict === 'stop-second-auth-rejection') throw new Error(`AUTH_REJECTED (2nd, status=401) after the single recovery exchange — STOP, loop reauth forbidden: ${JSON.stringify(err).slice(0, 200)}`)
    if (verdict !== 'recover-once') throw new Error(`readiness barrier STOP: ${JSON.stringify(err).slice(0, 300)}`)
    // FIRST readiness 401: record AUTH_REJECTED explicitly (never swallowed), then ONE public exchange.
    log(`readiness AUTH_REJECTED status=401 (raw err=${JSON.stringify(err).slice(0, 120)}) — ONE public auth exchange: same origin, THIS launch token (values never logged)`)
    if (launchToken === null) throw new Error('AUTH_REJECTED but no launch token in memory — STOP (no fabrication, no retry)')
    const ex = await fetch(`${origin}/?token=${launchToken}`, { redirect: 'manual', signal: AbortSignal.timeout(30_000) })
    const sc = ex.headers.get('set-cookie')
    if (ex.status !== 303 || sc === null || sc.length === 0) throw new Error(`re-auth exchange FAILED status=${String(ex.status)} setCookieNonEmpty=${String(sc !== null && sc.length > 0)} — STOP (ceiling consumed)`)
    cookie = sc.split(';', 1)[0]
    log(`re-auth exchange: status=303 setCookieNonEmpty=true cookieSwapped=true sameOrigin=true (values not logged) — ONE read-only listRoots follows`)
    reauthUsed = true
    const after = await remoteCall('team.listRoots', {}, 'ctlhw-ready-after', 3)
    const errAfter = resultError(after.body)
    const verdictAfter = authRecoveryVerdict(after.status, errAfter, true)
    if (verdictAfter === 'ready') return
    if (verdictAfter !== 'retry-starting') throw new Error(`post-reauth probe verdict=${verdictAfter} status=${String(after.status)} err=${JSON.stringify(errAfter).slice(0, 200)} — STOP (no second exchange, no NO_RESULT swallowing)`)
    if (Date.now() >= deadline) throw new Error('readiness budget exhausted while starting (post-reauth)')
    await sleep(1500) // genuine typed starting -> back into the ORIGINAL bounded barrier
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
function domainFacts() { // read-only durable scan (A's two-map law verbatim)
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
  return [...memberBindings.entries()].map(([instanceId, sessionId]) => ({ instanceId, sessionId, template: templates.get(instanceId) ?? null }))
}
function pickBound(list, template, n) { // exact-n bindings of ONE template (A's two-map law kept)
  if (list === null) return null
  const hits = list.filter((h) => h.template === template)
  return hits.length === n ? hits : null
}

async function cleanup() { // root a738 ⑤: cleanup failures mark the window NON-GREEN
  const notes = []
  let ok = true
  try {
    if (instance !== null) { await instance.stop(); notes.push('host stopped') }
  } catch (e) { ok = false; notes.push(`host-stop ERR ${String(e).slice(0, 120)}`) }
  try { if (mock !== null) { await mock.close(); notes.push('mock closed') } } catch (e) { ok = false; notes.push(`mock-close ERR ${String(e).slice(0, 120)}`) }
  let hostFree = false
  let mockFree = false
  try { hostFree = await waitForPortFree(HOST_PORT, 20_000) } catch { hostFree = false }
  try { mockFree = await waitForPortFree(MOCK_PORT, 20_000) } catch { mockFree = false }
  if (instance !== null) { // only a window that really booted owes free ports
    check('cleanup', `host port ${String(HOST_PORT)} free after stop`, hostFree === true, `free=${String(hostFree)}`)
    check('cleanup', `mock port ${String(MOCK_PORT)} free after stop`, mockFree === true, `free=${String(mockFree)}`)
  }
  if (notes.some((n) => n.includes('ERR'))) ok = false
  check('cleanup', 'host stop completed without error', ok, notes.join(' | ').slice(0, 300))
  notes.push('world retained (root law: NEVER delete HOME/raw)')
  log(`cleanup: ${notes.join(' | ')}`)
  return notes
}

// ── mock model program: Control decisions ride ONLY tool-registry toolCalls ─
function bodyOf(req) { return req?.body ?? req ?? {} }
function lastUserText(req) {
  const msgs = bodyOf(req).messages ?? []
  for (let i = msgs.length - 1; i >= 0; i -= 1) {
    const m = msgs[i]
    if (m?.role !== 'user') continue
    const c = m.content
    if (typeof c === 'string') return c
    if (Array.isArray(c)) {
      // messages-protocol follow-up turns END with a PURE tool_result user
      // message (08 offline check caught this residual blind spot): a block
      // message carrying ONLY results yields '' and the search CONTINUES to
      // the real marker turn — never fall to TURN-DONE on the result block.
      const t = c.filter((p) => p?.type === 'text').map((p) => p.text ?? '').join('\n')
      if (t.length > 0 || !c.some((p) => p?.type === 'tool_result')) return t
    }
  }
  return ''
}
function createGate(res) { // PURE verdict (08 offline-verifiable): non-null WITHOUT isError is only
  // "a real return arrived" — NEVER a business-success claim; a TRUE isError
  // aborts BEFORE any bind wait; the timeout fails honestly. (root 442 原审 residual)
  if (res === null) return { action: 'fail-timeout' }
  if (res.isError === true) return { action: 'abort-refusal' }
  // root 2026-10-24 explicit: a business rejection (status:"rejected") MUST
  // fail-fast and keep the raw EVEN WHEN isError=false — arrival without the
  // error flag is NEVER success and must never burn the 120s bind wait.
  if (/"status"\s*:\s*"rejected"/.test(String(res.text ?? ''))) return { action: 'abort-refusal' }
  return { action: 'proceed-bind' }
}
const toolCallLog = [] // MINIMAL emit/result fields only (root 2026-10-24: no full-payload logging)
function harvest(req) {
  const msgs = bodyOf(req).messages ?? []
  // ── protocol-aware tool results (root 2026-10-24 blind-spot fix): the host
  // may speak OpenAI (role:'tool') OR Anthropic /v1/messages (user.content[]
  // tool_result{tool_use_id,is_error,content}). BOTH map onto ONE callResults
  // lane keyed by the SAME callId we emitted — never mix, never dedupe across.
  for (const m of msgs) {
    if (m?.role === 'user' && Array.isArray(m?.content)) {
      for (const b of m.content) {
        if (b?.type !== 'tool_result') continue
        const callId = typeof b?.tool_use_id === 'string' ? b.tool_use_id : ''
        if (callId.length === 0 || callResults.some((r) => r.callId === callId)) continue
        const known = steps.get(callId)
        const text = typeof b?.content === 'string' ? b.content
          : Array.isArray(b?.content) ? b.content.map((c) => c?.text ?? JSON.stringify(c ?? '')).join('\n')
          : JSON.stringify(b?.content ?? '')
        const isError = b?.is_error === true
        callResults.push({ callId, step: known?.step ?? null, toolName: known?.tool ?? 'unknown', text, isError })
        toolCallLog.push({ kind: 'result', callId, step: known?.step ?? null, tool: known?.tool ?? 'unknown', isError, text: text.slice(0, 800) })
      }
      continue
    }
    if (m?.role === 'assistant') { // emit-side witness (minimal fields)
      const blocks = Array.isArray(m?.content) ? m.content.filter((b) => b?.type === 'tool_use') : []
      for (const b of blocks) {
        const known = steps.get(b?.id)
        toolCallLog.push({ kind: 'call', callId: b?.id ?? null, step: known?.step ?? null, tool: b?.name ?? known?.tool ?? 'unknown', args: JSON.stringify(b?.input ?? {}).slice(0, 800) })
      }
    }
  }
  for (const m of msgs) {
    if (m?.role !== 'tool') continue
    const callId = typeof m?.tool_call_id === 'string' ? m.tool_call_id : ''
    if (callId.length === 0 || callResults.some((r) => r.callId === callId)) continue // unique per emission; never mix
    const known = steps.get(callId)
    const text = typeof m?.content === 'string' ? m.content : JSON.stringify(m?.content ?? '')
    // real role=tool error parsing (root a738): honour explicit flags; the
    // text stays verbatim for the identity-refusal read.
    const isError = m?.isError === true || m?.is_error === true
      || (typeof m?.content === 'object' && m?.content !== null && (m.content.isError === true || m.content.is_error === true))
    callResults.push({ callId, step: known?.step ?? null, toolName: known?.tool ?? 'unknown', text, isError })
    toolCallLog.push({ kind: 'result', callId, step: known?.step ?? null, tool: known?.tool ?? 'unknown', isError, text: text.slice(0, 800) })
  }
}
function markerIndex(msgs, markerPrefix) {
  for (let i = msgs.length - 1; i >= 0; i -= 1) {
    const m = msgs[i]
    if (m?.role !== 'user') continue
    const c = m.content
    const t = typeof c === 'string' ? c : Array.isArray(c) ? c.filter((p) => p?.type === 'text').map((p) => p.text ?? '').join('\n') : ''
    if (t.startsWith(markerPrefix)) return i
  }
  return -1
}
function toolsAfterMarker(msgs, markerPrefix) {
  const idx = markerIndex(msgs, markerPrefix)
  if (idx === -1) return 0
  let n = 0
  for (let i = idx + 1; i < msgs.length; i += 1) {
    const m = msgs[i]
    if (m?.role === 'tool') n += 1
    else if (m?.role === 'user' && Array.isArray(m?.content)) n += m.content.filter((b) => b?.type === 'tool_result').length
  }
  return n
}
function toolMsgsAfter(msgs, markerPrefix) {
  const idx = markerIndex(msgs, markerPrefix)
  const out = []
  for (const m of msgs.slice(idx + 1)) {
    if (m?.role === 'tool') out.push(m)
    else if (m?.role === 'user' && Array.isArray(m?.content)) {
      for (const b of m.content) if (b?.type === 'tool_result') {
        out.push({ content: typeof b.content === 'string' ? b.content : Array.isArray(b.content) ? b.content.map((c) => c?.text ?? '').join('\n') : JSON.stringify(b.content ?? '') })
      }
    }
  }
  return out
}
function extractListedRequestId(content) {
  const m = /"requestId"\s*:\s*"([^"]+)"/.exec(String(content))
  return m === null ? null : m[1]
}
function decide({ req }) {
  harvest(req)
  const body = bodyOf(req)
  const msgs = body.messages ?? []
  const text = lastUserText(req)
  const mk = (step, name, args) => {
    const callId = `call-ctlhw-${NONCE}-${String(++callSeq)}` // UNIQUE per emission (root a738: multi-round safe)
    steps.set(callId, { step, tool: name })
    return { kind: 'tool-call', toolCalls: [{ id: callId, name, arguments: args }] }
  }
  if (text.startsWith(`TOOLS-CHECK2 ${NONCE}`)) { // L5 witness: member2's REAL surface proves the op IS bound
    const seen2 = new Set(member2ToolsSeen)
    for (const t of body.tools ?? []) {
      const name = t?.function?.name ?? t?.name ?? (typeof t === 'string' ? t : null)
      if (typeof name === 'string' && name.length > 0) seen2.add(name)
    }
    member2ToolsSeen.length = 0
    member2ToolsSeen.push(...seen2)
    return { kind: 'text', content: `ACK-C0B ${NONCE}` }
  }
  if (text.startsWith(`TOOLS-CHECK-L ${NONCE}`)) { // L6 witness: the LEADER's REAL request surface (87/88 exposure before any grant)
    const seen = new Set(leaderToolsSeen)
    for (const t of body.tools ?? []) {
      const name = t?.function?.name ?? t?.name ?? (typeof t === 'string' ? t : null)
      if (typeof name === 'string' && name.length > 0) seen.add(name)
    }
    leaderToolsSeen.length = 0
    leaderToolsSeen.push(...seen)
    return { kind: 'text', content: `ACK-C0L ${NONCE}` }
  }
  if (text.startsWith('TOOLS-CHECK')) { // E0 witness: the member's REAL request surface, filled HERE only
    const seen = new Set(memberToolsSeen)
    for (const t of body.tools ?? []) {
      const name = t?.function?.name ?? t?.name ?? (typeof t === 'string' ? t : null)
      if (typeof name === 'string' && name.length > 0) seen.add(name)
    }
    memberToolsSeen.length = 0
    memberToolsSeen.push(...seen)
    return { kind: 'text', content: `ACK-C0 ${NONCE}` }
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
    if (n === 0) return mk('leader:list85', 'team_list_pending_control', { rootSessionId: currentRoot, requestToken: `ctlhw-list-${NONCE}-${String(Date.now())}` })
    if (n === 1) {
      const requestId = extractListedRequestId(toolMsgsAfter(msgs, `A5M2-CTLHW-LEADER-RESOLVE ${NONCE}`)[0]?.content)
      if (requestId === null) return { kind: 'text', content: `CTLHW_EXTRACT_FAIL ${NONCE}` }
      return mk('leader:res84', 'team_resolve_control', { rootSessionId: currentRoot, requestToken: `ctlhw-res-${requestId}`, requestId, decision: 'allow', note: 'a5m2-ctlhw model-tool allow' })
    }
    return { kind: 'text', content: `TURN-DONE ${NONCE}` }
  }
  if (text.startsWith(`A5M2-CTLHW-GRANT87 ${NONCE} tinst=`)) { // 87 LEADER-only grant: fs-class READ allow on package.json (EXPANSION over default:deny — gated by carrier+both ceilings)
    const inst = /tinst=([A-Za-z0-9_-]+)/.exec(text)?.[1] ?? null
    if (inst === null) return { kind: 'text', content: `CTLHW_NO_TINST ${NONCE}` }
    return toolsAfterMarker(msgs, `A5M2-CTLHW-GRANT87 ${NONCE}`) === 0
      ? mk('leader:grant87', 'team_grant_permission', { rootSessionId: currentRoot, requestToken: `ctlhw-grant-${NONCE}`, targetInstanceId: inst, rules: [{ operationClass: 'read', matcher: { kind: 'exact', value: FIXTURE_FILE }, effect: 'allow' }] })
      : { kind: 'text', content: `TURN-DONE ${NONCE}` }
  }
  if (text.startsWith(`A5M2-CTLHW-REVOKE88 ${NONCE} tinst=`)) { // 88 revoke the allow — where nothing looser remains to answer this is TIGHTENING (tools.js:1177 semantics), applies immediately
    const inst = /tinst=([A-Za-z0-9_-]+)/.exec(text)?.[1] ?? null
    if (inst === null) return { kind: 'text', content: `CTLHW_NO_TINST ${NONCE}` }
    return toolsAfterMarker(msgs, `A5M2-CTLHW-REVOKE88 ${NONCE}`) === 0
      ? mk('leader:revoke88', 'team_revoke_permission', { rootSessionId: currentRoot, requestToken: `ctlhw-revoke-${NONCE}`, targetInstanceId: inst, rules: [{ operationClass: 'read', matcher: { kind: 'exact', value: FIXTURE_FILE }, effect: 'allow' }] })
      : { kind: 'text', content: `TURN-DONE ${NONCE}` }
  }
  if (text.startsWith(`A5M2-CTLHW-MEMBER-READ1 ${NONCE}`)) { // baseline consumption witness BEFORE the grant (deny side)
    return toolsAfterMarker(msgs, `A5M2-CTLHW-MEMBER-READ1 ${NONCE}`) === 0
      ? mk('member:readProbe1', 'read', { file_path: FIXTURE_FILE })
      : { kind: 'text', content: `TURN-DONE ${NONCE}` }
  }
  if (text.startsWith(`A5M2-CTLHW-MEMBER-READ2 ${NONCE}`)) { // business consumption UNDER the granted allow (executes)
    return toolsAfterMarker(msgs, `A5M2-CTLHW-MEMBER-READ2 ${NONCE}`) === 0
      ? mk('member:readProbe2', 'read', { file_path: FIXTURE_FILE })
      : { kind: 'text', content: `TURN-DONE ${NONCE}` }
  }
  if (text.startsWith(`A5M2-CTLHW-MEMBER-READ3 ${NONCE}`)) { // chain-back witness AFTER the revoke (deny side again)
    return toolsAfterMarker(msgs, `A5M2-CTLHW-MEMBER-READ3 ${NONCE}`) === 0
      ? mk('member:readProbe3', 'read', { file_path: FIXTURE_FILE })
      : { kind: 'text', content: `TURN-DONE ${NONCE}` }
  }
  if (text.startsWith(`A5M2-CTLHW-LEADER-CREATE2 ${NONCE}`)) { // second member from ctl-resolver (L5 native-identity canary)
    return toolsAfterMarker(msgs, `A5M2-CTLHW-LEADER-CREATE2 ${NONCE}`) === 0
      ? mk('leader:create2', 'team_create_member', { rootSessionId: currentRoot, requestToken: `ctlhw-create2-${NONCE}`, delegationTemplateId: 'ctl-resolver', label: 'ctl2' })
      : { kind: 'text', content: `TURN-DONE ${NONCE}` }
  }
  if (text.startsWith(`A5M2-CTLHW-MEMBER2-REQ ${NONCE} inst=`)) { // member2 requests control on ITSELF -> R83B stays PENDING (never leader-resolved)
    const inst = /inst=([A-Za-z0-9_-]+)/.exec(text)?.[1] ?? null
    if (inst === null) return { kind: 'text', content: `CTLHW_NO_INST2 ${NONCE}` }
    return toolsAfterMarker(msgs, `A5M2-CTLHW-MEMBER2-REQ ${NONCE}`) === 0
      ? mk('member2:req83b', 'team_request_control', { rootSessionId: currentRoot, requestToken: `ctlhw-req2b-${NONCE}`, kind: 'leader-approval', targetInstanceId: inst, actionName: 'ctl-canary-probe', toolName: 'team_resolve_control', summary: `A5M2-CTLHW-R83B ${NONCE}` })
      : { kind: 'text', content: `TURN-DONE ${NONCE}` }
  }
  if (text.startsWith(`A5M2-CTLHW-MEMBER2-RESOLVE ${NONCE} rid=`)) { // BOUND member resolving its OWN pending request -> native role gate must refuse
    const rid = /rid=([A-Za-z0-9_-]+)/.exec(text)?.[1] ?? null
    if (rid === null) return { kind: 'text', content: `CTLHW_NO_RID2 ${NONCE}` }
    return toolsAfterMarker(msgs, `A5M2-CTLHW-MEMBER2-RESOLVE ${NONCE}`) === 0
      ? mk('member2:resolveAttempt', 'team_resolve_control', { rootSessionId: currentRoot, requestToken: `ctlhw-res2-${rid}`, requestId: rid, decision: 'allow', note: 'a5m2-ctlhw BOUND-member attempt (L5 native identity)' })
      : { kind: 'text', content: `TURN-DONE ${NONCE}` }
  }
  if (text.startsWith(`A5M2-CTLHW-MEMBER-RESOLVE-ATTEMPT ${NONCE}`)) { // IDENTITY REFUSAL leg: the requesting member must never resolve
    const rid = /rid=([A-Za-z0-9_-]+)/.exec(text)?.[1] ?? null
    if (rid === null) return { kind: 'text', content: `CTLHW_NO_RID ${NONCE}` }
    return toolsAfterMarker(msgs, `A5M2-CTLHW-MEMBER-RESOLVE-ATTEMPT ${NONCE}`) === 0
      ? mk('member:resolveAttempt', 'team_resolve_control', { rootSessionId: currentRoot, requestToken: `ctlhw-selfres-${NONCE}`, requestId: rid, decision: 'deny', note: 'identity refusal witness' })
      : { kind: 'text', content: `TURN-DONE ${NONCE}` }
  }
  return { kind: 'text', content: `TURN-DONE ${NONCE}` }
}

async function main() {
  currentCriterion = 'preflight'
  const hostBusy = await portInUse(HOST_PORT)
  const mockBusy = await portInUse(MOCK_PORT)
  if (hostBusy || mockBusy) throw new Error(`ports busy at start: host=${hostBusy} mock=${mockBusy} (pinned 3184/3499; never kill foreign)`)
  if (existsSync(HOME) && readdirSync(HOME).length > 0) throw new Error(`home ${HOME} exists non-empty — fail closed`)
  for (const p of [HOME, join(HOME, 'blueprints'), join(HOME, 'storages'), RUN_DIR]) mkdirSync(p, { recursive: true })
if (process.env.A5M2_CONTROL_HOME_POINTER) { // explicit HOME hand-off to the OUTER supervisor (A's
    // pointer law reused verbatim: no globbing; written BEFORE boot so a boot
    // failure is still auditable by the wrapper's budget check)
    try { writeFileSync(process.env.A5M2_CONTROL_HOME_POINTER, `${HOME}\n`) } catch { /* monitor hint best-effort; window verdict never depends on it */ }
  }
  writeFileSync(join(HOME, 'a5m2-ctl-hw-lock.json'), JSON.stringify({ world: HOME, pid: process.pid, runner: '05-control-window-runner.mjs', composedSha: COMPOSED_SHA, packSha256: EXPECTED_PACK_SHA, stamp: RUN_STAMP }, null, 2))
  try {
    const selfSha = execFileSync('git', ['-C', ROOT_DIR, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim()
    writeFileSync(join(RUN_DIR, 'runner-identity.json'), JSON.stringify({ runnerFullSha: selfSha, runnerFileSha256: sha256(fileURLToPath(import.meta.url)), composedSha: COMPOSED_SHA, packTgz: tgzPath, packSha256: EXPECTED_PACK_SHA, installDir: INSTALL_DIR, ports: { host: HOST_PORT, mock: MOCK_PORT } }, null, 2))
  } catch { /* identity best-effort */ }

  { // REAL entry resolution from the f86 fixture (READ-ONLY; A's hookup verbatim)
    const installedManifest = JSON.parse(readFileSync(join(PKG_DIR_READ, 'package.json'), 'utf8'))
    const hostExport = installedManifest?.exports?.['./host']
    if (typeof hostExport !== 'string') throw new Error('fixture plugin exports["./host"] missing')
    var HOST_ENTRY = resolve(PKG_DIR_READ, hostExport.replace(/^\.\//, ''))
    if (!existsSync(HOST_ENTRY)) throw new Error(`host entry absent: ${HOST_ENTRY}`)
    log(`plugin entry resolved from the f86 fixture exports['./host']: ${HOST_ENTRY}`)
  }
  writeFileSync(join(HOME, 'blueprints', 'a5m2-ctl-hw.yaml'), buildSavedBp())

  if (DRY) {
    const dryPatch = join(HOME, 'dry-patch.yml')
    writePatch(dryPatch, pathToFileURL(HOST_ENTRY).href)
    writeFileSync(join(RUN_DIR, 'dry-receipts.json'), JSON.stringify({
      dry: true, reachedBootBoundary: true, booted: false,
      portsAwaited: { host: HOST_PORT, hostIdle: !(await portInUse(HOST_PORT)), mock: MOCK_PORT, mockIdle: !(await portInUse(MOCK_PORT)) },
      manifestEntry: HOST_ENTRY, patchWritten: dryPatch, world: HOME,
    }, null, 2))
    finish(0) // DRY verdict is NOT_RUN by law (root a738 ④), rc 3
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
  launchToken = m[2] // memory-only (host's own web line already carries it; the driver adds NO new persistence)
  const auth = await fetch(`${origin}/?token=${m[2]}`, { redirect: 'manual', signal: AbortSignal.timeout(30_000) })
  if (auth.status !== 303 || auth.headers.get('set-cookie') === null) throw new Error(`authenticate status=${auth.status}`)
  cookie = auth.headers.get('set-cookie').split(';', 1)[0]
  log(`host booted at ${origin}`)

  // [root fix, 7f6bbd barrier via A a7f7c0e8e] the URL banner is NOT the
  // route — wait for the plugin's OWN registration line before ANY team RPC
  // (typed refusals stop first; no team call happens before it).
  const mountGate = await remoteMountGate({
    readLog: () => String(readFileSync(instance.logPath, 'utf8')),
    childGone: () => instance.child === undefined || instance.child.exitCode !== null || instance.child.signalCode !== null,
    budgetMs: 120_000,
  })
  log(`remote mount gate PASS (polls=${mountGate.polls}) ${mountGate.line}`)

  currentCriterion = 'setup'
  currentRoot = `session-a5m2ctlhw-p-${RUN_STAMP}`
  await teamReadyBarrier()
  mkdirSync(FIXTURE_DIR, { recursive: true }) // synthetic HOME-owned fixture BEFORE boot: unique window nonce inside
  writeFileSync(join(FIXTURE_DIR, 'package.json'), JSON.stringify({ name: 'a5m2-ctlhw-fixture', probe: `A5M2-CTLHW-PROBE-${NONCE}` }, null, 2))
  const wsReg = await workspaceRpc('create', { path: FIXTURE_POSIX(FIXTURE_DIR) }, 'ctlhw-wsreg') // PUBLIC registration (639 commands.ts:45-53 create-or-resolve; registry index:236-241 realpath+directory+durable). mkdir != registration.
  const wsErr = resultError(wsReg.body)
  if (wsErr !== null) throw new Error(`workspace/create (public registration) FAILED — STOP, raw kept (root ruling): ${JSON.stringify(wsErr)}`)
  const wsView = resultData(wsReg.body)?.workspace ?? null
  if (typeof wsView?.path !== 'string' || wsView.path.length === 0) throw new Error(`workspace/create answered without a canonical path — STOP, raw kept: ${JSON.stringify(wsReg.body).slice(0, 400)}`)
  WORKSPACE_CANONICAL = wsView.path // the Host's OWN canonical (workspace/registry/index.ts:236-241); created=${String(resultData(wsReg.body)?.created)}
  FIXTURE_FILE = `${WORKSPACE_CANONICAL}/package.json` // three-way exact read values + tool input now use the REAL canonical (root: 以workspace.path canonical绑定)
  const team = await remoteCall('team.create', { rootSessionId: currentRoot, blueprintId: BP_ID, workspace: WORKSPACE_CANONICAL }, 'ctlhw-create', 2) // v2 workspace-aware closed set (params.js:121-124 minus initialWork plus workspace); durable defaultWorkspace == canonicalPath (s6-remote.js:1249-1251,1322-1324); W1 member inheritance
  if (resultError(team.body) !== null) throw new Error(`team.create: ${JSON.stringify(resultError(team.body))}`) // full typed error, uncut
  await apiPrompt(currentRoot, `A5M2-CTLHW-LEADER-CREATE ${NONCE}`, 'ctlhw-leader-create')
  // root 2026-10-24: CHECK THE REAL RETURN FIRST — the create's tool_result
  // (whichever protocol carries it) BEFORE waiting on the bind; a refused/
  // errored create must surface its typed error immediately, not silently.
  const createRes = await waitFor('team_create_member tool result (protocol-aware harvest)', 60_000, () => callResults.find((r) => r.step === 'leader:create') ?? null)
  const gate = createGate(createRes) // a REAL return arrived is wiring-only evidence — NO business-success claim
  check('L1', 'team_create_member REAL return harvested and correlated by callId (arrival only, business semantics NOT asserted)', gate.action !== 'fail-timeout', `gate=${gate.action} isError=${String(createRes?.isError)} text=${String(createRes?.text).slice(0, 400)}`)
  if (gate.action === 'abort-refusal') { // FAIL FAST: the real refusal is recorded; NO 120s bind wait
    throw new Error(`team_create_member REAL refusal (fail-fast, bind never awaited): ${String(createRes.text)}`)
  }
  const member = await waitFor('first member binding in team_domain', 120_000, () => pickBound(domainFacts(), 'ctl-worker', 1)?.[0] ?? null)
  log(`member instance=${member.instanceId} session=${member.sessionId}`)

  await apiPrompt(member.sessionId, `TOOLS-CHECK ${NONCE}`, 'ctlhw-c0')
  await waitFor('member tool surface (real request tools)', 60_000, () => (memberToolsSeen.length > 0 ? true : null))
  check('E0', 'member surface carries team_request_control', memberToolsSeen.includes('team_request_control'), `visible=${memberToolsSeen.join(',')}`)
  check('E0', 'member surface carries NO team_resolve_control (no self-approve)', !memberToolsSeen.includes('team_resolve_control'), `visible=${memberToolsSeen.join(',')}`)

  // L2: 83 via the registry (member model toolCall, PA-armed CONTROL row)
  currentCriterion = 'L2-83'
  await apiPrompt(member.sessionId, `A5M2-CTLHW-MEMBER-REQ ${NONCE} inst=${member.instanceId}`, 'ctlhw-req')
  const req83Result = await waitFor('team_request_control tool result', 120_000, () => callResults.find((r) => r.step === 'member:req83') ?? null)
  check('L2-83', 'team_request_control EXECUTED through the tool registry (harvested tool result, no error flag)', req83Result?.isError !== true, `isError=${String(req83Result?.isError)} text=${String(req83Result?.text).slice(0, 160)}`)
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
  check('L3-85', 'team_list_pending_control EXECUTED through the tool registry', listResult !== null && listResult.isError !== true, String(listResult?.text).slice(0, 160))
  check('L3-85', '85 DISCOVERY answers with the designated request on its page', String(listResult?.text).includes(r83), `requestId=${r83}`)
  const resResult = await waitFor('team_resolve_control tool result', 120_000, () => callResults.find((r) => r.step === 'leader:res84') ?? null)
  check('L3-84', 'team_resolve_control EXECUTED through the tool registry (ALLOW, no error flag)', resResult !== null && resResult.isError !== true, String(resResult?.text).slice(0, 160))
  const factsDecided = await waitFor('durable control-decision-recorded for R83', 60_000, async () => {
    const byType = await controlFacts()
    return (byType['control-decision-recorded'] ?? []).some((e) => e.payload?.requestId === r83 && e.payload?.decision === 'allow') ? byType : null
  })
  check('L3', 'the DESIGNATED request r83 was settled by the model-tool decision (durable)', true, `requestId=${r83}`)

  // L4: IDENTITY REFUSAL — the requesting member's own resolve attempt must be
  // refused, and it must add NO durable decision fact.
  currentCriterion = 'L4-identity'
  await apiPrompt(member.sessionId, `A5M2-CTLHW-MEMBER-RESOLVE-ATTEMPT ${NONCE} rid=${r83}`, 'ctlhw-selfres')
  const selfRes = await waitFor('member resolve-attempt tool result (refusal expected)', 120_000, () => callResults.find((r) => r.step === 'member:resolveAttempt') ?? null)
  // root a738 fix 2: an arbitrary isError or the ABSENCE of "ok":true is NOT
  // a refusal witness — the real successful native answers status=
  // 'control-resolved' without any ok:true either. ACCEPT ONLY the explicit
  // identity code (control/errors.ts:85 CONTROL_RESOLVER_NOT_AUTHORIZED —
  // invariant 37, a member is never a resolver) or an EXPLICIT tool-not-
  // visible shape. An already-decided conflict or any unknown format FAILS
  // this check — never a false negative-control PASS.
  const selfText = String(selfRes?.text ?? '')
  const ALREADY_DECIDED_CONFLICT = /already carries a durable decision/i.test(selfText)
  const EXPLICIT_IDENTITY = selfText.includes('CONTROL_RESOLVER_NOT_AUTHORIZED')
  const EXPLICIT_NOT_VISIBLE = /(?:unknown|no such|no) tool|tool '[^']*' (?:is )?(?:not available|not found|not registered|unavailable)|team_resolve_control (?:is )?(?:not available|not found|not registered|unavailable|not visible)/i.test(selfText)
  // EXACT closed-world Guard refusal family (root 2026-10-24 original ruling:
  // the L4-binding-denial SATISFIES the original oracle — 700-03 permits an
  // explicit not-visible/binding-absent shape, and this window's member has
  // NO resolver at all). closed-world-guard.js:138 emits EXACTLY:
  //   team tool guard: "team_resolve_control" has no Team Tool Binding on this Agent (closed world: ...)
  // Added as a NAMED EXACT family ONLY (this tool name + this guard phrase) —
  // NEVER a blanket "any isError/any error". Already-decided conflicts still FAIL.
  const EXPLICIT_BINDING_DENIED = /team tool guard: "team_resolve_control" has no Team Tool Binding on this Agent \(closed world:/i.test(selfText)
  const refused = !ALREADY_DECIDED_CONFLICT && (EXPLICIT_IDENTITY || EXPLICIT_NOT_VISIBLE || EXPLICIT_BINDING_DENIED)
  check('L4', 'member resolve attempt refused by EXPLICIT identity code, explicit not-visible, OR the exact closed-world Binding-denial guard family (native-identity covered by the L5 canary; unknown formats / resolved-conflicts never pass)', refused === true, `identity=${String(EXPLICIT_IDENTITY)} notVisible=${String(EXPLICIT_NOT_VISIBLE)} bindingDenied(EXACT family)=${String(EXPLICIT_BINDING_DENIED)} conflict=${String(ALREADY_DECIDED_CONFLICT)} isError=${String(selfRes?.isError)} text=${selfText.slice(0, 160)}`)
  const factsFinal = await controlFacts()
  check('L4', 'the identity refusal left NO extra durable decision fact', factsFinal['control-decision-recorded'].length === 1, `decided=${String(factsFinal['control-decision-recorded'].length)}`)

  // ── L5: NATIVE IDENTITY negative control (root 2026-10-24 batch card; PREP —
  // untested until a GO window runs it). types.js:151 leader-approval resolvers
  // = [leader,human]; service.js:2004-2010 role closure (invariant 37: a member
  // is NEVER a resolver, EVEN WITH the resolve-control op). The op IS BOUND to
  // member2 (ctl-resolver), so this is NOT the L4 closed-world binding-denial —
  // it is the CONTROL_RESOLVER_NOT_AUTHORIZED native role-gate path. ──
  currentCriterion = 'L5-native-identity'
  await apiPrompt(currentRoot, `A5M2-CTLHW-LEADER-CREATE2 ${NONCE}`, 'ctlhw-leader-create2')
  const create2 = await waitFor('2nd team_create_member REAL return', 60_000, () => callResults.find((r) => r.step === 'leader:create2') ?? null)
  const gate2 = createGate(create2)
  check('L5', 'member2 (ctl-resolver) create REAL return harvested (arrival only, business NOT asserted)', gate2.action !== 'fail-timeout', `gate=${gate2.action} isError=${String(create2?.isError)} text=${String(create2?.text).slice(0, 400)}`)
  if (gate2.action === 'abort-refusal') throw new Error(`member2 create REAL refusal (fail-fast, no bind wait): ${String(create2?.text)}`)
  const member2 = await waitFor('second member (ctl-resolver) binding', 120_000, () => pickBound(domainFacts(), 'ctl-resolver', 1)?.[0] ?? null)
  log(`member2 instance=${member2.instanceId} session=${member2.sessionId}`)
  await apiPrompt(member2.sessionId, `TOOLS-CHECK2 ${NONCE}`, 'ctlhw-c0b')
  await waitFor('member2 tool surface (real request tools)', 60_000, () => (member2ToolsSeen.length > 0 ? true : null))
  check('L5', 'member2 surface CARRIES team_resolve_control (op REALLY bound+allowed — binding!=resolver premise PROVEN, not assumed)', member2ToolsSeen.includes('team_resolve_control'), `visible=${member2ToolsSeen.join(',')}`)
  await apiPrompt(member2.sessionId, `A5M2-CTLHW-MEMBER2-REQ ${NONCE} inst=${member2.instanceId}`, 'ctlhw-req2b')
  const r83bFast = await waitFor('member2 req83b REAL return (typed business rejection FAILS FAST, raw kept — root card)', 60_000, () => callResults.find((r) => r.step === 'member2:req83b') ?? null)
  if (r83bFast !== null && (r83bFast.isError === true || /"status"\s*:\s*"rejected"/.test(String(r83bFast.text ?? '')))) throw new Error(`R83B REAL business rejection (fail-fast; durable NEVER awaited on a refused canary): ${String(r83bFast.text)}`)
  const r83b = await waitFor('durable control-request-recorded for R83B (member2 own, stays PENDING)', 60_000, async () => {
    const bt = await controlFacts()
    const hit = bt['control-request-recorded'].find((e) => String(e.payload?.summary ?? '').includes(`A5M2-CTLHW-R83B ${NONCE}`))
    return hit === undefined ? null : hit.payload.requestId
  })
  await apiPrompt(member2.sessionId, `A5M2-CTLHW-MEMBER2-RESOLVE ${NONCE} rid=${r83b}`, 'ctlhw-selfres2')
  const res2 = await waitFor('member2 resolve-attempt tool result (NATIVE identity refusal expected)', 120_000, () => callResults.find((r) => r.step === 'member2:resolveAttempt') ?? null)
  const res2Text = String(res2?.text ?? '')
  check('L5', 'NATIVE IDENTITY: BOUND member resolve attempt refused with the EXACT CONTROL_RESOLVER_NOT_AUTHORIZED code (not binding-denial, not conflict, not unknown)', res2Text.includes('CONTROL_RESOLVER_NOT_AUTHORIZED'), `isError=${String(res2?.isError)} text=${res2Text.slice(0, 400)}`)
  const factsL5 = await controlFacts()
  check('L5', 'native-identity refusal added NO decision fact (R83B stays pending): recorded=2 decided=1', factsL5['control-request-recorded'].length === 2 && factsL5['control-decision-recorded'].length === 1, `recorded=${String(factsL5['control-request-recorded'].length)} decided=${String(factsL5['control-decision-recorded'].length)}`)

  // ── L6/L7: 87 grant(read allow, fs exact package.json) -> rule change (LEDGER
  // fact + payload dual proof) -> BUSINESS CONSUMPTION (real read executes) ->
  // 88 revoke -> chain back BEHAVIOURALLY (read denied again, no residue).
  // Grammar is reported from ORIGINAL SOURCES: wire matcher {kind,value}
  // (tools.js parsePermissionRules) vs carrier matcher {kind,resource}
  // (permission-mutation.js validateMatcher). PREPARED — first fires in a GO window. ──
  await apiPrompt(currentRoot, `TOOLS-CHECK-L ${NONCE}`, 'ctlhw-tools-leader')
  await waitFor('LEADER real request surface (visibility, not parse)', 60_000, () => (leaderToolsSeen.length > 0 ? true : null))
  check('L6-87', 'LEADER surface REALLY exposes team_grant_permission (TOOLS-CHECK-L real-request witness; delta #1/#2 landed)', leaderToolsSeen.includes('team_grant_permission'), `visible=${leaderToolsSeen.join(',')}`)
  check('L6-87', 'LEADER surface REALLY exposes team_revoke_permission', leaderToolsSeen.includes('team_revoke_permission'), `visible=${leaderToolsSeen.join(',')}`)
  currentCriterion = 'L6-grant87'
  await apiPrompt(member.sessionId, `A5M2-CTLHW-MEMBER-READ1 ${NONCE}`, 'ctlhw-read-base')
  const read1 = await waitFor('baseline read result (pre-grant refusal expected)', 120_000, () => callResults.find((r) => r.step === 'member:readProbe1') ?? null)
  check('L6-87', 'baseline: member read of the FIXTURE file BEFORE the grant is EXPLICITLY REFUSED (typed code/status or explicit error + ZERO probe leak; default:deny holds)', explicitRefusalWitness(read1, NONCE), `isError=${String(read1?.isError)} text=${String(read1?.text ?? '').slice(0, 300)}`)
  await apiPrompt(currentRoot, `A5M2-CTLHW-GRANT87 ${NONCE} tinst=${member.instanceId}`, 'ctlhw-grant87')
  const grantRes = await waitFor('team_grant_permission REAL return', 60_000, () => callResults.find((r) => r.step === 'leader:grant87') ?? null)
  const grantText = String(grantRes?.text ?? '')
  check('L6-87', 'grant REAL return = the REAL 2fb result family: structured {status:"permission-mutated",verb:"grant",changed} AND isError===false (no invented ledger-fact gate — root ruling)', permissionMutatedWitness(grantRes, { rootSessionId: currentRoot, targetInstanceId: member.instanceId, verb: 'grant' }), `isError=${String(grantRes?.isError)} text=${grantText.slice(0, 400)}`)
  const grantGrantId = `perm-grant-ctlhw-grant-${NONCE}` // provenance.mutationId per source (tools.js:1266): perm-<verb>-<requestToken>
  { // ONE read-only sampling (root ruling): attachment NEVER gates the main legs — no wait, no timeout, no fabricated event.
    const f = overlaySnapshotFacts()
    const snap = f.status === 'FOUND' ? f.rows.filter((r) => r?.provenance?.mutationId === grantGrantId).pop() : null
    if (snap === null || snap === undefined) console.log(`[ctlhw] durable overlay attachment (grant): NOT_VERIFIED — ${f.status === 'NOT_VERIFIED' ? f.reason : `no ${grantGrantId} row at single sampling`} (disclosed; the nonce READ below stays the hard gate)`)
    else check('L6-87', 'durable overlay snapshot (READ-ONLY single sampling): grant mutation row + identity pair + PERSISTED rule {operation,resource,effect} carrying the fixture (not the input spelling)',
      snap?.identity?.memberInstanceId === member.instanceId && typeof snap?.identity?.teamSessionId === 'string'
      && (snap?.state?.rules ?? []).some((r) => JSON.stringify(r).includes('package.json') && r?.effect === 'allow' && 'operation' in r && 'resource' in r && !('operationClass' in r) && !('matcher' in r))
      && typeof snap?.metadata?.generation === 'number', `gen=${String(snap?.metadata?.generation)} rules=${JSON.stringify(snap?.state?.rules ?? []).slice(0, 300)}`)
  }
  await apiPrompt(member.sessionId, `A5M2-CTLHW-MEMBER-READ2 ${NONCE}`, 'ctlhw-consume')
  const read2 = await waitFor('consumption read result (same-call structured success + window-unique probe expected)', 120_000, () => callResults.find((r) => r.step === 'member:readProbe2') ?? null)
  check('L6-consume', 'BUSINESS CONSUMPTION: SAME-CALL structured success AND result CONTAINS this window’s unique probe content (READ via the granted overlay; name-only would NOT pass)', readOkWitness(read2, NONCE), `isError=${String(read2?.isError)} text=${String(read2?.text ?? '').slice(0, 300)}`)
  currentCriterion = 'L7-revoke88'
  await apiPrompt(currentRoot, `A5M2-CTLHW-REVOKE88 ${NONCE} tinst=${member.instanceId}`, 'ctlhw-revoke88')
  const revokeRes = await waitFor('team_revoke_permission REAL return', 60_000, () => callResults.find((r) => r.step === 'leader:revoke88') ?? null)
  const revokeText = String(revokeRes?.text ?? '')
  check('L7-88', 'revoke REAL return = structured {status:"permission-mutated",verb:"revoke",changed} AND isError===false', permissionMutatedWitness(revokeRes, { rootSessionId: currentRoot, targetInstanceId: member.instanceId, verb: 'revoke' }), `isError=${String(revokeRes?.isError)} text=${revokeText.slice(0, 400)}`)
  const revokeMutId = `perm-revoke-ctlhw-revoke-${NONCE}`
  { // ONE read-only sampling; NOT_VERIFIED never interrupts the revoke->read chain-back.
    const f = overlaySnapshotFacts()
    const rowsR = f.status === 'FOUND' ? f.rows.filter((r) => r?.identity?.memberInstanceId === member.instanceId) : []
    const revSnap = rowsR.filter((r) => r?.provenance?.mutationId === revokeMutId).pop()
    const latest = rowsR.slice().sort((a, b) => (a?.metadata?.generation ?? 0) - (b?.metadata?.generation ?? 0)).pop()
    if (revSnap === undefined) console.log(`[ctlhw] durable overlay attachment (revoke): NOT_VERIFIED — ${f.status === 'NOT_VERIFIED' ? f.reason : `no ${revokeMutId} row at single sampling`} (disclosed; the behavioral chain-back read below stays the hard gate)`)
    else check('L7-88', 'durable overlay chain (READ-ONLY single sampling): revoke row carries previousSnapshotId chain AND the LATEST snapshot for this member no longer carries the allow rule',
      typeof revSnap?.metadata?.previousSnapshotId === 'string'
      && latest?.provenance?.mutationId === revokeMutId
      && !(latest?.state?.rules ?? []).some((r) => JSON.stringify(r).includes('package.json') && r?.effect === 'allow'), `chain=${JSON.stringify(rowsR.map((r) => [r?.metadata?.generation, r?.provenance?.mutationId]))}`.slice(0, 300))
  }
  await apiPrompt(member.sessionId, `A5M2-CTLHW-MEMBER-READ3 ${NONCE}`, 'ctlhw-read-back')
  const read3 = await waitFor('chain-back read result (explicit refusal again expected)', 120_000, () => callResults.find((r) => r.step === 'member:readProbe3') ?? null)
  check('L7-88', 'chain back with NO RESIDUE: post-revoke read EXPLICITLY REFUSED (typed code/status + zero probe leak) — no leftover allow answers', explicitRefusalWitness(read3, NONCE), `isError=${String(read3?.isError)} text=${String(read3?.text ?? '').slice(0, 300)}`)
  const factsEnd = await controlFacts()
  check('V', 'ledger: recorded=2 decided=1 (REAL control-ledger constraint KEPT per root; NO mutated=2 hard gate — that fact never existed; 87/88 evidence = REAL permission-mutated returns + behavioral read + read-only overlay attachment or disclosed NOT_VERIFIED)', factsEnd['control-request-recorded'].length === 2 && factsEnd['control-decision-recorded'].length === 1, `recorded=${String(factsEnd['control-request-recorded'].length)} decided=${String(factsEnd['control-decision-recorded'].length)}`)
  check('V', 'decisions were NOT RPC-driven (transcript carries NO RPC resolveControl write — observation reads only)', !TRANSCRIPT.some((t) => t.channel === 'team-remote' && t.method === 'team.resolveControl'), 'observation-only transcript verified')

  await cleanup()
  finish(0)
}

main().then(() => { /* finish() exits */ }, async (err) => {
  log(`FATAL: ${String(err?.stack ?? err)}`) // receipt-preservation: FULL stack/message, never truncated
  try { await cleanup() } catch { /* keep evidence */ }
  checks.push({ criterion: 'fatal', name: 'runner completed', ok: false, detail: String(err?.message ?? err) }) // receipt-preservation: full raw error into summary.json
  finish(1)
})
