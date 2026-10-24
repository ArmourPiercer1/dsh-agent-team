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
 *   A5M2_EDIT_PACK_TGZ      path to the f86-produced tgz (sole pack owner)
 *   A5M2_EDIT_PACK_SHA256   its exact sha256 (measured and compared here)
 *   A5M2_EDIT_COMPOSED_SHA  MUST equal 5c31341803318ab35465908bf93b1f77f5cad16a
 * This runner's own full SHA is recorded separately (runner-identity.json).
 *
 * Evidence law: RUN_DIR keeps raw transcripts/instance logs; the HOME world is
 * NEVER deleted by this runner (root: keep old HOME/raw — teardown does NOT
 * rm evidence); cleanup stops the Host + mock and verifies ports + this
 * runner's own world lock only.
 */
import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, openSync, readFileSync, readdirSync, statSync, utimesSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { CLIENT_COMMIT_HASH, findTestRepoRoot } from '../../../../../tests/paths.mjs'
import { DshInstance } from '../../../../../tests/characterization/lib/instance.mjs'
import { portInUse, waitForPortFree } from '../../../../../tests/characterization/lib/util.mjs'
import { startMockModel } from '../../../../../packages/tools/harness/mock-deepseek.mjs'

const COMPOSED_SHA = '5c31341803318ab35465908bf93b1f77f5cad16a' // root-pinned product candidate (f86 packs exactly this)
const EDIT_BLOB_EDIT = '5a6db608a4043793e8569998bbe1c8fa5a0695be' // dist arm blob this tree measured
const EDIT_BLOB_SRE = '6a1ec67f062dd77ee7110a6d4d6e3781376f4f35'
const PACK_BYTES_MAX = 8_000_000
const HOST_PORT = 3183
const MOCK_PORT = 3498
const WORLD_PREFIX = 'a5m2-edit-hw-a'
const BP_ID = 'team.a5m2-edit-hw'
const WINDOW_GO = process.env.A5M2_EDIT_WINDOW === 'GRANTED'
const DRY = process.env.A5M2_EDIT_DRY === '1'
const PACK_TGZ = process.env.A5M2_EDIT_PACK_TGZ ?? null
const PACK_SHA = process.env.A5M2_EDIT_PACK_SHA256 ?? null
const PACK_COMPOSED = process.env.A5M2_EDIT_COMPOSED_SHA ?? null

function notRun(reason) {
  console.log(JSON.stringify({ implemented: true, booted: false, dry: DRY, verdict: 'NOT_RUN', reason }, null, 2))
  process.exit(3) // NOT_RUN is NON-ZERO by root order
}
if (!WINDOW_GO && !DRY) notRun('window env A5M2_EDIT_WINDOW not GRANTED (root ruling pending) — nothing booted')
if (PACK_TGZ === null || PACK_SHA === null) notRun('explicit product inputs missing: A5M2_EDIT_PACK_TGZ + A5M2_EDIT_PACK_SHA256 are REQUIRED (no old pins)')
if (PACK_COMPOSED !== null && PACK_COMPOSED !== COMPOSED_SHA) notRun(`A5M2_EDIT_COMPOSED_SHA ${PACK_COMPOSED} is not the pinned product ${COMPOSED_SHA}`)
if (!PACK_SHA.startsWith('sha256:')) notRun('A5M2_EDIT_PACK_SHA256 must carry the sha256: prefix')

const ROOT_DIR = findTestRepoRoot(dirname(fileURLToPath(import.meta.url)))
if (ROOT_DIR === null) { console.error('findTestRepoRoot returned null'); process.exit(3) }
const HOST_TREE = join(ROOT_DIR, 'tests', 'deepseek-harness-test-use')
if (!existsSync(HOST_TREE)) notRun(`639 host checkout absent at ${HOST_TREE}`)

// fixture + warm store: this tree first, main checkout fallback (both are the
// SAME fs; the reused trees are verified read-only and never written).
function fixtureHomes() {
  for (const base of [join(ROOT_DIR, 'tests', 'homes'), '/srv/workspace/dsh-plugins/dsh-agent-team/tests/homes']) {
    if (existsSync(join(base, '.a5m2-bf4-fixture-20261023T20-55-19Z', 'install', 'pnpm-lock.yaml'))) return base
  }
  return null
}
const HOMES_BASE = fixtureHomes()
if (HOMES_BASE === null) notRun('bf4 fixture install absent in both candidate tests/homes')
const FIXTURE_DIR = join(HOMES_BASE, '.a5m2-bf4-fixture-20261023T20-55-19Z', 'install')
const FIXTURE_LOCK_SHA256 = '163ed8991902f7dc07fd828181c0184cb09377a1aa28cbb0fff0cc6bd788310c'
const STORE = join(HOMES_BASE, '.pnpmm-r18-store')

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
  '    capabilities:', '      teamTools:', '        kind: deny', '      builtinToolDeny: []',
  '      skills:', '        kind: deny', '      mcp:', '        kind: deny',
  '      permissions:', '        default: deny', '        allow: []', '        ask:',
  '          - tool: edit', '            resource:', '              kind: any',
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
  try { const lk = join(HOME, 'a5m2-edit-hw-lock.json'); if (existsSync(lk)) notes.push('world lock retained (evidence)') } catch { /* keep */ }
  const ok = !notes.some((n) => n.includes('ERR') || n.includes('free=false'))
  cleanupOk = ok
  log(`cleanup (${ok ? 'OK' : 'NOT-OK'}): ${notes.join(' | ')}`)
  return { ok, notes }
}

// ── explicit product pin (fail closed) ─────────────────────────────────────
const tgzPath = PACK_TGZ.startsWith('/') ? PACK_TGZ : join(ROOT_DIR, PACK_TGZ)
if (!existsSync(tgzPath)) notRun(`f86 pack tgz absent: ${tgzPath}`)
if (!existsSync(tgzPath) || !/^dsh-agent-team-.*\.tgz$/.test(tgzPath.split('/').pop() ?? '')) { console.error('pack tgz name mismatch'); process.exit(3) }
if (statSync(tgzPath).size > PACK_BYTES_MAX) { console.error('pack bytes exceed the bound'); process.exit(3) }
if (`sha256:${sha256(tgzPath)}` !== PACK_SHA) { console.error(`pack sha256 drifted from the explicit input ${PACK_SHA}`); process.exit(2) }
const fixtureLockPath = join(FIXTURE_DIR, 'pnpm-lock.yaml')
const fixtureManifestPath = join(FIXTURE_DIR, 'package.json')
if (sha256(fixtureLockPath) !== FIXTURE_LOCK_SHA256) { console.error('bf4 fixture lock drifted'); process.exit(3) }
if (!existsSync(STORE)) { console.error(`warm store absent: ${STORE}`); process.exit(3) }

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
    `          fsInstance:`,
    `            rootDir: ${JSON.stringify(FSROOT)}`, '',
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
  writeFileSync(join(HOME, 'a5m2-edit-hw-lock.json'), JSON.stringify({ world: HOME, pid: process.pid, runner: '05-edit-window-runner.mjs', composedSha: COMPOSED_SHA, packSha256: PACK_SHA, stamp: RUN_STAMP }, null, 2))
  try {
    const selfSha = execFileSync('git', ['-C', ROOT_DIR, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim()
    writeFileSync(join(RUN_DIR, 'runner-identity.json'), JSON.stringify({ runnerFullSha: selfSha, runnerFileSha256: sha256(fileURLToPath(import.meta.url)), composedSha: COMPOSED_SHA, packTgz: tgzPath, packSha256: PACK_SHA, armBlobExpectations: { edit: EDIT_BLOB_EDIT, sre: EDIT_BLOB_SRE } }, null, 2))
  } catch { /* identity best-effort; window verdict never depends on it */ }
  // the governed target file, under the fsInstance rootDir = THIS world
  writeFileSync(join(FSROOT, 'notes.txt'), 'alpha\nbeta\ngamma\n', 'utf8')

  // install: fixture manifest/lock + ONLY the file: entry (fourth-window chain)
  const INSTALL = join(HOME, `install-${PACK_SHA.slice('sha256:'.length, 'sha256:'.length + 9)}`)
  mkdirSync(INSTALL, { recursive: true })
  const fixtureManifest = JSON.parse(readFileSync(fixtureManifestPath, 'utf8'))
  writeFileSync(join(INSTALL, 'package.json'), JSON.stringify({
    name: fixtureManifest.name, version: fixtureManifest.version, private: true,
    dependencies: { ...fixtureManifest.dependencies, 'dsh-agent-team': `file:${tgzPath}` },
  }, null, 2))
  writeFileSync(join(INSTALL, 'pnpm-lock.yaml'), readFileSync(fixtureLockPath, 'utf8'))
  const lockLogFd = openSync(join(RUN_DIR, 'lockupdate.log'), 'a')
  execFileSync('pnpm', ['install', '--lockfile-only', '--ignore-workspace', `--store-dir=${STORE}`], { cwd: INSTALL, stdio: ['ignore', lockLogFd, lockLogFd] })
  {
    // fourth-window substance diff gate: no base package may be REMOVED, no
    // base edge BROKEN, no base package NAME may move VERSION; additions are
    // recorded (only the file: entry plus base-referenced material).
    const yaml = (await import('yaml')).default ?? (await import('yaml'))
    const baseLock = yaml.parse(readFileSync(fixtureLockPath, 'utf8'))
    const newLock = yaml.parse(readFileSync(join(INSTALL, 'pnpm-lock.yaml'), 'utf8'))
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
    const versionsByName = (set) => {
      const m = new Map()
      for (const p of set) {
        const at = p.lastIndexOf('@')
        if (!m.has(p.slice(0, at))) m.set(p.slice(0, at), new Set())
        m.get(p.slice(0, at)).add(p.slice(at + 1))
      }
      return m
    }
    const basePkgs = pkgSet(baseLock); const newPkgs = pkgSet(newLock)
    const baseEdges = edgeSet(baseLock); const newEdges = edgeSet(newLock)
    const removedPkgs = [...basePkgs].filter((p) => !newPkgs.has(p))
    const brokenEdges = [...baseEdges].filter((e) => !newEdges.has(e))
    const baseV = versionsByName(basePkgs); const newV = versionsByName(newPkgs)
    const movedNames = [...baseV.keys()].filter((n) => [...(baseV.get(n) ?? [])].some((v) => !(newV.get(n) ?? new Set()).has(v)))
    writeFileSync(join(RUN_DIR, 'lock-diff.json'), JSON.stringify({ removedPkgs, movedNames, brokenEdges, addedCount: [...newPkgs].filter((p) => !basePkgs.has(p)).length }, null, 2))
    if (removedPkgs.length > 0 || brokenEdges.length > 0 || movedNames.length > 0) throw new Error(`lock update NOT minimal: removed=${removedPkgs.length} moved=${movedNames.join(',') || '-'} brokenEdges=${brokenEdges.length}`)
    log('lock diff gate: base packages/edges preserved, zero version moves — minimal update verified')
  }
  const installLogFd = openSync(join(RUN_DIR, 'install.log'), 'a')
  execFileSync('pnpm', ['install', '--frozen-lockfile', '--offline', '--ignore-workspace', '--ignore-scripts', `--store-dir=${STORE}`], { cwd: INSTALL, stdio: ['ignore', installLogFd, installLogFd] })
  execFileSync('chmod', ['-R', 'a-w', INSTALL], { stdio: 'ignore' })
  const PKG_DIR = join(INSTALL, 'node_modules', 'dsh-agent-team')
  const installedManifest = JSON.parse(readFileSync(join(PKG_DIR, 'package.json'), 'utf8'))
  const hostExport = installedManifest?.exports?.['./host']
  if (typeof hostExport !== 'string') throw new Error('installed exports["./host"] missing')
  const HOST_ENTRY = join(PKG_DIR, hostExport.replace(/^\.\//, ''))
  if (!existsSync(HOST_ENTRY)) throw new Error(`host entry absent: ${HOST_ENTRY}`)
  // the DIST ARM actually inside the new pack (same-blob release law)
  const distArm = join(PKG_DIR, 'packages/runtime/dist/packages/runtime/src/plugin/live/governed-families/edit.mjs')
  if (!existsSync(distArm)) throw new Error(`the installed pack carries NO dist edit arm: ${distArm}`)
  log(`plugin entry via exports['./host']; dist edit arm present in pack: ${distArm}`)
  writeFileSync(join(HOME, 'blueprints', 'a5m2-edit-hw.yaml'), SAVED_BP_V3_YAML)

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
    log(`FATAL (${currentCriterion}): ${String(e?.stack ?? e).slice(0, 500)}`)
    await cleanup()
    finish(rc)
  },
)
