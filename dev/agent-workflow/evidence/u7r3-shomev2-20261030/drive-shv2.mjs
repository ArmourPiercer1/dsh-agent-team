#!/usr/bin/env node
/**
 * drive-shv2.mjs — the u7r3-shomev2 C2 lane driver (V2: production DEFAULT-Home
 * live leg; pool C2; budget EXACTLY 2 starts, pre-registered push-confirmed
 * 215362c844, BOOT-BUDGET-20261031C 预登记). One spawn per boot phase, ONE line
 * per spawn in host-start-budget.jsonl written IMMEDIATELY before the spawn.
 *
 * WHAT THIS LANE PROVES (PRODUCTION-HOME-DESIGN (e) V2):
 *   boot1 (write arm): real Host spawned with DSH_HOME UNSET (proven via
 *   /proc/<pid>/environ) and HOME=<workspace-internal operator home>; the
 *   production row config carries plane key agentStateEnabled=true and NO
 *   testHomeGuard key — the family descriptor must build its PRODUCTION store
 *   through the upstream trusted home (resolveDshHome → $HOME/.dsh) and
 *   governed agent-state writes must land EXACTLY under
 *   <opshome>/.dsh/team-state/agent-state/<realmId>/. Real ~/.dsh untouched;
 *   :3080 read-only probed pre/post.
 *   boot2 (restart arm): clean kill, respawn SAME env / SAME operator home /
 *   SAME realm. The row phase is create-or-open (root-binding seam law: boot 2
 *   REOPENS the persisted unit — a fresh 'create' rootSessionId would collide
 *   with the stamped domain). Boot-1 records must read back BYTE-IDENTICAL
 *   (disk sha comparison + a FRESH production store instance over the same
 *   root); a second governed write leg runs on the reopened realm; no ALIAS /
 *   replay violations in the boot-2 log; the resolved home string is witnessed
 *   by file location + an in-process child probe re-derivation (second
 *   consumers — no third boot).
 *
 * BOOT MECHANICS: reused from tests/characterization/lib/instance.mjs (file-fd
 * stdio, `apps/cli/lib/bin.js web --port P --no-open`, BOOT_MARKER readiness,
 * SIGTERM stop). DELIBERATE DISCLOSED DEVIATION: DshInstance forces DSH_HOME
 * in the child env; the production arm must spawn WITHOUT it, so the launch
 * chain is reproduced here minus that key. Everything else is the proven kit
 * imported from the lane worktree at origin/master tip (never edited):
 * profile-patch seam + emitPatchLayer, EXT-contributor disclosure, port
 * leases, in-process mock provider, u7astore assembly/blueprints, and the
 * runner-as-Human through the public team.resolveControl v4 seam.
 * Negative legs (relative/nonexistent Home refusals, guard-true MISSING,
 * consumed-applyId replay) are exercised by SECOND CONSUMERS in-process /
 * child-probe — NO extra boot.
 *
 * Phases (BOOT phases consume budget and are NOT rerunnable after a typed
 * FAIL — RCA from the record + log first, budget law):
 *   node drive-shv2.mjs preflight   # no boot
 *   node drive-shv2.mjs boot1       # START #1 (one budget line)
 *   node drive-shv2.mjs boot2       # START #2 (one budget line)
 *   node drive-shv2.mjs census      # no boot (rerunnable offline witness)
 *
 * @module evidence/u7r3-shomev2-20261030/drive-shv2
 */
import { spawn, spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import {
  closeSync, copyFileSync, existsSync, lstatSync, mkdirSync, openSync,
  readFileSync, readdirSync, realpathSync, statSync, writeFileSync,
} from 'node:fs'
import { createConnection } from 'node:net'
import { dirname, join, relative, resolve, sep } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
export const EV = HERE
export const REPO = resolve(HERE, '../../../..') // the lane worktree root
export const HOST_TREE = join(REPO, 'tests', 'deepseek-harness-test-use')
export const OPS = join(REPO, 'opshome') // the fresh operator home (HOME=)
export const DSHH = join(OPS, '.dsh') // what the host must DERIVE as its home
const LOGS = join(EV, 'logs')
const STATE_FILE = join(EV, 'boot-state.json')
const BUDGET = join(EV, 'host-start-budget.jsonl')
const MARKER_FILE = join(EV, 'census-marker')
const REAL_HOME = '/home/user/.dsh' // the real operator home — READ-ONLY census
const STABLE_URL = 'http://127.0.0.1:3080'
const HOST_SHA_PIN = '639ed015397290b3745d163aafe02ffee4aa3f84'
const BOOT_MARKER = /dsh web: http:\/\/127\.0\.0\.1:(\d+)\/\?token=([A-Za-z0-9_-]+)/
const STORE_FACE = join(REPO, 'packages/runtime/dist/packages/tools/agent-state-family/src/fs-state-store.mjs')
const ROW_FACE = join(REPO, 'packages/runtime/dist/packages/runtime/src/plugin/host.js')
const now = () => new Date().toISOString()
const utcStamp = (d = new Date()) => {
  const iso = d.toISOString()
  return `${iso.slice(0, 10).replace(/-/g, '')}T${iso.slice(11, 19).replace(/:/g, '-')}Z`
}
const sha256File = (p) => createHash('sha256').update(readFileSync(p)).digest('hex')
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const log = (m) => process.stdout.write(`[shv2] ${now()} ${m}\n`)

// ── kit imports (lane worktree at origin/master tip — never edited) ────────
const wf = await import(pathToFileURL(join(REPO, 'tests/world-factory/lib/world-factory.mjs')).href)
const u6 = await import(pathToFileURL(join(REPO, 'tests/world-factory/lib/u6-fs-assembly.mjs')).href)
const storeMod = await import(pathToFileURL(STORE_FACE).href)
const leaseMod = await import(pathToFileURL(join(REPO, 'tests/world-factory/lib/port-lease.mjs')).href)
const mockMod = await import(pathToFileURL(join(REPO, 'packages/tools/harness/mock-deepseek.mjs')).href)
const paths = await import(pathToFileURL(join(REPO, 'tests/paths.mjs')).href)
const { emitPatchLayer, EXT_CONTRIBUTOR_DISABLE, fetchJson, authenticate, apiPrompt } = wf
const { remoteCall, hasMarker, surfaceNamesOf, messagesOf, textOf, toolCall } = u6
const { acquireFirstFreeLease, scanAllLeases } = leaseMod
const LEASE_ROOT = join(REPO, '.artifacts/tmp/port-leases')

function loadState() {
  try { return JSON.parse(readFileSync(STATE_FILE, 'utf8')) } catch { return null }
}
function saveState(s) { writeFileSync(STATE_FILE, JSON.stringify(s, null, 2) + '\n') }

function git(...args) {
  const r = spawnSync('git', args, { encoding: 'utf8' })
  if (r.status !== 0) throw new Error(`git ${args.join(' ')} failed: ${r.stderr}`)
  return r.stdout.trim()
}

function hostBaseCheck(phase) {
  const head = git('-C', HOST_TREE, 'rev-parse', 'HEAD')
  const porcelain = git('-C', HOST_TREE, 'status', '--porcelain')
  return { phase, head, porcelainEmpty: porcelain === '', ok: head === HOST_SHA_PIN && porcelain === '' }
}

function loadAuthority() {
  try {
    return { pointerPath: 'dev/engineering/current-authority.json', pointer: JSON.parse(readFileSync(join(REPO, 'dev/engineering/current-authority.json'), 'utf8')) }
  } catch { return null }
}

/** The child env manifest: everything the host process gets. ALL DSH_*
 *  (the harness's own DSH_HOME, DSH_PROFILE_DIR, DSH_WEB_URL included) and
 *  provider credential keys are SCRUBBED; HOME + provider base + the
 *  deterministic build pin are the only DSH/DEEPSEEK keys that ride. */
function buildChildEnv({ mockPort }) {
  const env = {}
  const scrubbed = []
  for (const [k, v] of Object.entries(process.env)) {
    if (/^DSH_/.test(k) || /API_KEY$/.test(k) || /API_TOKEN$/.test(k) || k === 'DEEPSEEK_BASE_URL') { scrubbed.push(k); continue }
    env[k] = v
  }
  env.HOME = OPS
  env.DSH_CLIENT_COMMIT_HASH = paths.CLIENT_COMMIT_HASH
  env.DEEPSEEK_BASE_URL = `http://127.0.0.1:${mockPort}`
  env.DEEPSEEK_API_KEY = 'u7r3v2-fake-key' // mock — no real credential ever crosses
  return { env, scrubbed: scrubbed.sort() }
}

function procEnvironProof(pid) {
  const raw = readFileSync(`/proc/${pid}/environ`, 'utf8').split('\0').filter((l) => l !== '')
  const keys = raw.map((l) => (l.includes('=') ? l.slice(0, l.indexOf('=')) : l))
  return {
    readAt: now(),
    dshHomeAbsent: raw.filter((l) => /^DSH_HOME=/.test(l)).length === 0,
    dshKeysPresent: keys.filter((k) => /^DSH_/.test(k)).sort(),
    homeEntry: raw.find((l) => l.startsWith('HOME=')) ?? null,
    homeEqualsOpshome: raw.includes(`HOME=${OPS}`),
  }
}

function portFreeProbe(port) {
  return new Promise((res) => {
    const s = createConnection({ host: '127.0.0.1', port }, () => { s.destroy(); res({ port, free: false, at: now() }) })
    s.setTimeout(1500, () => { s.destroy(); res({ port, free: true, at: now() }) })
    s.on('error', () => { s.destroy(); res({ port, free: true, at: now() }) })
  })
}

/** Boot-mechanics twin of DshInstance.start WITHOUT the DSH_HOME env key. */
async function spawnHost({ port, env, logDir, label }) {
  mkdirSync(logDir, { recursive: true })
  const logPath = join(logDir, `instance-port${port}.log`)
  writeFileSync(logPath, '', { flag: 'w' })
  const outFd = openSync(logPath, 'a')
  const child = spawn(
    process.execPath,
    ['apps/cli/lib/bin.js', 'web', '--port', String(port), '--no-open'],
    { cwd: HOST_TREE, stdio: ['ignore', outFd, outFd], env },
  )
  closeSync(outFd)
  const exitInfo = { exited: false, code: undefined, signal: undefined }
  child.on('error', (e) => { exitInfo.exited = true; exitInfo.code = 'spawn-error'; exitInfo.signal = String(e?.message) })
  child.on('close', (code, signal) => { exitInfo.exited = true; exitInfo.code = code; exitInfo.signal = signal })
  const environ = procEnvironProof(child.pid) // read FIRST, before any await on boot
  const deadline = Date.now() + 150_000
  let m = null
  while (m === null && Date.now() < deadline && !exitInfo.exited) {
    try {
      const mm = BOOT_MARKER.exec(readFileSync(logPath, 'utf8'))
      if (mm !== null) m = mm
    } catch { /* not yet */ }
    if (m === null) await sleep(400)
  }
  if (m === null) {
    const tail = readFileSync(logPath, 'utf8').split('\n').slice(-30).join('\n')
    throw new Error(`BOOT FAILED (${label}): exited=${exitInfo.exited} code=${String(exitInfo.code)} signal=${String(exitInfo.signal)}\n--- log tail ---\n${tail}`)
  }
  return { child, pid: child.pid, port: Number(m[1]), token: m[2], logPath, environ }
}

async function stopHost(handle, port) {
  const { child } = handle
  const exited = new Promise((res) => {
    child.once('close', (code, signal) => res({ code, signal }))
    setTimeout(() => res({ timeout: true }), 15_000)
  })
  try { child.kill('SIGTERM') } catch { /* already gone */ }
  const outcome = await exited
  let portFree = false
  for (let i = 0; i < 40; i += 1) {
    if ((await portFreeProbe(port)).free) { portFree = true; break }
    await sleep(400)
  }
  return { cleanExit: outcome.timeout !== true, exitCode: outcome.code ?? null, exitSignal: outcome.signal ?? null, portFree }
}

function writeBudgetLine({ runId, suite, world, phase }) {
  writeFileSync(BUDGET, JSON.stringify({ at: now(), runId, suite, world, phase }) + '\n', { flag: 'a' })
}

function walkFiles(root, rel = '') {
  const out = []
  let names = []
  try { names = readdirSync(join(root, rel)) } catch { return out }
  for (const n of names.sort()) {
    const r = rel === '' ? n : `${rel}/${n}`
    const st = lstatSync(join(root, r))
    if (st.isDirectory()) out.push(...walkFiles(root, r))
    else if (st.isFile()) out.push({ rel: r, bytes: st.size, sha256: sha256File(join(root, r)), mtime: st.mtime.toISOString() })
  }
  return out
}

async function waitUntil(pred, { timeoutMs = 60_000, everyMs = 500 } = {}) {
  const t0 = Date.now()
  for (;;) {
    let hit = false
    try { hit = (await pred()) === true } catch { hit = false }
    if (hit) return { hit: true, waitedMs: Date.now() - t0 }
    if (Date.now() - t0 > timeoutMs) return { hit: false, waitedMs: Date.now() - t0 }
    await sleep(everyMs)
  }
}

const stableProbe = () => fetchJson(`${STABLE_URL}/`, undefined, 10_000)
const findNewer = (root, marker, limit = 40) => {
  const r = spawnSync('find', [root, '-maxdepth', '3', '-newer', marker], { encoding: 'utf8', timeout: 30_000 })
  const lines = (r.stdout ?? '').split('\n').filter((l) => l !== '')
  return { at: now(), root, marker, count: lines.length, paths: lines.slice(0, limit), truncated: lines.length > limit }
}

// ── production-arm row config + profile patch ──────────────────────────────
function productionRowConfig(assembly) {
  const cfg = assembly.teamRowConfig()
  delete cfg.teamToolPlane.testHomeGuard // THE production arm: the key is ABSENT
  if ('testHomeGuard' in cfg.teamToolPlane) throw new Error('testHomeGuard survived')
  if (cfg.teamToolPlane.agentStateEnabled !== true) throw new Error('agentStateEnabled not true')
  return cfg
}

function patchRows(assembly, presetMod, cfg) {
  const basePlugins = [
    presetMod.personaRow({ text: 'You are a coding agent powered by the {{model}} model.', suffix: 'Your working directory is {{cwd}}.' }),
    { id: 'tool-fs', name: '@deepseek-ai/dsh-tool-fs' },
    { id: 'tool-fs-search', name: '@deepseek-ai/dsh-tool-fs-search', config: { sampleOverCapGlobResults: false } },
  ]
  return [
    { id: 'dsh-agent-team', name: pathToFileURL(ROW_FACE).href, config: cfg },
    presetMod.presetDeclarationRow({
      id: assembly.BASE_PRESET_ID, displayName: 'u7r3v2 base',
      description: `u7r3v2 production-arm base preset (${assembly.BASE_PRESET_ID})`,
      plugins: basePlugins,
    }),
  ]
}

function writePatch({ rows, header }) {
  mkdirSync(join(DSHH, 'profiles', 'web'), { recursive: true })
  const p = join(DSHH, 'profiles', 'web', 'cordis.patch.yml')
  writeFileSync(p, `${emitPatchLayer(header, rows)}\n${EXT_CONTRIBUTOR_DISABLE}`)
  return readFileSync(p, 'utf8')
}

// ── the runner-as-Human resolver (public seams, u7-astore precedent) ───────
function makeApprover({ origin, cookie, teamSessionId, controlRows, resolutions, approverErrors, logger }) {
  const unwrap = (body) => { const x = body?.result?.value; return x && typeof x === 'object' && 'data' in x ? x.data : x }
  const ledgerRows = async () => {
    const byType = { 'control-request-recorded': [], 'control-decision-recorded': [], 'control-allow-consumed': [], 'control-request-abandoned': [] }
    let afterSequence = 0
    for (let pageNo = 0; pageNo < 20; pageNo += 1) {
      const page = await remoteCall(fetchJson, origin, cookie, 'team.getLedgerPage', { teamSessionId, afterSequence, limit: 500 }, 'u7r3-ledger', 1)
      if (page?.status !== 200 || page?.body?.result?.ok === false) throw new Error(`team.getLedgerPage failed: ${String(page?.status)}`)
      const data2 = unwrap(page.body)
      const entries = Array.isArray(data2?.entries) ? data2.entries : []
      for (const e of entries) {
        if (byType[e?.factType] === undefined) continue
        let payload = e.payload
        if (typeof payload === 'string') { try { payload = JSON.parse(payload) } catch { payload = {} } }
        byType[e.factType].push({ payload: payload ?? {} })
      }
      const next = data2?.nextAfterSequence
      if (next === null || next === undefined || entries.length === 0) break
      afterSequence = Number(next)
    }
    const settled = new Set([...byType['control-decision-recorded'], ...byType['control-allow-consumed'], ...byType['control-request-abandoned']].map((x) => String(x.payload?.requestId ?? '')))
    return byType['control-request-recorded'].filter((x) => x.payload?.requestId !== undefined).map((x) => ({
      requestId: String(x.payload.requestId), toolName: x.payload.toolName ?? null, summary: String(x.payload.summary ?? '').slice(0, 140),
      status: settled.has(String(x.payload.requestId)) ? 'settled' : 'pending',
    }))
  }
  const nameRe = /todo_write|create_goal|get_goal|update_goal|exit_plan_mode/
  let stop = false
  const loop = (async () => {
    while (!stop) {
      try {
        for (const r of await ledgerRows()) {
          controlRows.set(r.requestId, r)
          if (r.status === 'pending' && nameRe.test(`${String(r.toolName ?? '')} ${r.summary}`) && !resolutions.some((x) => x.requestId === r.requestId)) {
            const res = await remoteCall(fetchJson, origin, cookie, 'team.resolveControl', { teamSessionId, requestId: r.requestId, decision: 'allow', note: 'u7r3v2-c2-human-approval' }, 'u7r3-approve', 4)
            resolutions.push({ requestId: r.requestId, toolName: r.toolName, status: res?.status ?? null, ok: res?.status === 200 && res?.body?.result?.ok === true })
            logger(`approval allow ${String(r.toolName)} req=${r.requestId.slice(0, 14)} status=${String(res?.status)}`)
          }
        }
      } catch (err) { approverErrors.push(String(err?.message ?? err).slice(0, 200)) }
      await sleep(900)
    }
  })()
  return { stop: () => { stop = true }, loop }
}

function exchangesOf(req, lane, names) {
  const out = []
  if (req === null) return out
  const msgs = messagesOf(req)
  for (let i = 0; i < msgs.length; i += 1) {
    const m = msgs[i]
    if (m?.role !== 'assistant' || !Array.isArray(m?.content)) continue
    for (const b of m.content) {
      if (b?.type !== 'tool_use' || !names.includes(String(b?.name ?? ''))) continue
      let head = ''
      for (let j = i + 1; j < msgs.length && head === ''; j += 1) {
        for (const rb of Array.isArray(msgs[j]?.content) ? msgs[j].content : []) {
          if (rb?.type === 'tool_result' && (rb.tool_use_id === undefined || rb.tool_use_id === b.id)) {
            head = (Array.isArray(rb.content) ? rb.content : []).map((c) => c?.text ?? '').join('') || String(rb.content ?? '')
          }
        }
      }
      out.push({ lane, name: String(b.name), input: b.input ?? null, head: String(head).slice(0, 500) })
    }
  }
  return out
}

const grepLog = (logPath, re) => {
  try { return readFileSync(logPath, 'utf8').split('\n').filter((l) => re.test(l)) } catch { return [] }
}

// ── second-consumer probes (in-process / child — NEVER a boot) ─────────────
function negativeProbesBoot1() {
  const { resolveAgentStateHome } = storeMod
  const out = {
    at: now(),
    law: 'resolveAgentStateHome of the SAME dist face the host mounted, called as an independent second consumer (in-process; refusals are pure resolves, zero writes)',
    probes: [],
  }
  const push = (name, r, expect) => out.probes.push({
    name, expect,
    got: r.ok === true ? { ok: true, home: r.home } : { ok: false, code: r.code, detail: String(r.detail).slice(0, 180) },
    matches: expect === 'ok' ? r.ok === true : r.code === expect,
  })
  push('relative-DSH_HOME/production-arm', resolveAgentStateHome({ env: { DSH_HOME: 'relative/path' }, testHomeGuard: false }), 'AGENT_STATE_STORE_HOME_INVALID')
  push('nonexistent-DSH_HOME/production-arm', resolveAgentStateHome({ env: { DSH_HOME: join(OPS, 'definitely-not-there') }, testHomeGuard: false }), 'AGENT_STATE_STORE_HOME_INVALID')
  push('unset-DSH_HOME/test-guard-true', resolveAgentStateHome({ env: {}, testHomeGuard: true }), 'AGENT_STATE_STORE_HOME_MISSING')
  push('relative-DSH_HOME/test-guard-true', resolveAgentStateHome({ env: { DSH_HOME: 'relative/path' }, testHomeGuard: true }), 'AGENT_STATE_STORE_HOME_INVALID')
  return out
}

/** A SEPARATE node process under the child env manifest shape (HOME set,
 *  DSH_HOME absent): answers the boot arm's own law as a captured STRING. The
 *  file location under <opshome>/.dsh remains the primary homeSource witness;
 *  nothing is patched to log it. */
function childHomeDerivationProbe() {
  const src = [
    `const m = await import(${JSON.stringify(pathToFileURL(STORE_FACE).href)});`,
    `const hp = await import(${JSON.stringify(pathToFileURL(join(HOST_TREE, 'packages/util/home-paths/lib/index.js')).href)}).catch(() => null);`,
    'const r = m.resolveAgentStateHome({ testHomeGuard: false });',
    'process.stdout.write(JSON.stringify({',
    '  storeLaw: r.ok === true ? { ok: true, home: r.home } : { ok: false, code: r.code },',
    '  upstreamResolveDshHome: hp?.resolveDshHome ? hp.resolveDshHome(undefined, process.env) : null,',
    '  envHome: process.env.HOME ?? null, hasDSH: "DSH_HOME" in process.env }));',
  ].join('\n')
  const env = { PATH: process.env.PATH, HOME: OPS } // DSH_HOME absent by construction
  const r = spawnSync(process.execPath, ['--input-type=module', '-e', src], { env, encoding: 'utf8', timeout: 30_000 })
  let parsed = null
  try { parsed = JSON.parse(r.stdout ?? '') } catch { /* keep null */ }
  return { at: now(), spawnOk: r.status === 0, parsed, stderr: (r.stderr ?? '').slice(0, 300) }
}

// ── phases ─────────────────────────────────────────────────────────────────
async function preflight() {
  const rec = { schema: 'u7r3v2-preflight/1', startedAt: now() }
  if (existsSync(OPS)) throw new Error(`opshome must NOT exist for a fresh run: ${OPS} (budget law: a rerun needs a fresh lane state)`)
  rec.hostBase = hostBaseCheck('preflight')
  if (!rec.hostBase.ok) throw new Error(`host base check failed: ${JSON.stringify(rec.hostBase)}`)
  rec.pluginHead = { head: git('-C', REPO, 'rev-parse', 'HEAD'), porcelainEmpty: git('-C', REPO, 'status', '--porcelain') === '' }
  rec.authority = loadAuthority()
  rec.faces = { row: pathToFileURL(ROW_FACE).href, store: pathToFileURL(STORE_FACE).href, rowSha: sha256File(ROW_FACE), storeSha: sha256File(STORE_FACE) }
  // fresh operator home + the profiles dir (the patch layer rides pre-boot;
  // the host derives <HOME>/.dsh itself — we only seed the public seam file)
  mkdirSync(join(DSHH, 'profiles', 'web'), { recursive: true })
  mkdirSync(join(OPS, 'workspace'), { recursive: true })
  // real-home receipts (READ-ONLY)
  writeFileSync(MARKER_FILE, '') // touched at preflight = census baseline
  const rc = statSync(REAL_HOME)
  writeFileSync(join(EV, 'home-mtime-receipt.txt'),
    `real operator home READ-ONLY census (never written by this lane)\n` +
    `path: ${REAL_HOME}\n` +
    `pre-run (preflight ${now()}): mtimeMs=${rc.mtimeMs} mtime=${rc.mtime.toISOString()} ctimeMs=${rc.ctimeMs}\n` +
    `team-state/ present pre-run: ${String(existsSync(join(REAL_HOME, 'team-state')))}\n` +
    `baseline marker: census-marker touched at ${now()}\n`)
  const hostPort = paths.portsOfBands(paths.HOST_PORT_BANDS)[0]
  const mockPort = paths.portsOfBands(paths.MOCK_PORT_BANDS)[0]
  rec.portProbePreLease = { host: await portFreeProbe(hostPort), mock: await portFreeProbe(mockPort) }
  rec.ssListen3180family = spawnSync('ss', ['-ltn'], { encoding: 'utf8' }).stdout.split('\n').filter((l) => /:(31\d\d|34\d\d)\s/.test(l))
  rec.stablePre = await stableProbe()
  rec.notes = [
    'The runner env carries the harness DSH_HOME/DSH_PROFILE_DIR; boot phases SCRUB every DSH_* from the child env and prove absence via /proc.',
    ':3080 probed read-only pre/post every boot; real ~/.dsh census via receipt + find -newer baseline.',
    'No p6t6 observer row on the production arm: packages/tools/harness/plugin.mjs:166-167 REFUSES to set up without the DSH_HOME env — the discriminating config is verified by the store LAW instead (files land only where the production default-law answers; boot1 record binds the exact plane-config bytes).',
  ]
  writeFileSync(join(EV, 'preflight.json'), JSON.stringify(rec, null, 2) + '\n')
  log(`preflight ok; hostBase=${rec.hostBase.ok} pluginHead=${rec.pluginHead.head} portProbe=${JSON.stringify(rec.portProbePreLease)}`)
}

async function assembleBoot({ stamp, bootPhaseLabel, extraHeader, teamCreateSessionSuffix = '', useDecide2 = false }) {
  const state = loadState()
  if (state?.stamp === undefined) throw new Error('boot-state.json missing — boot1 must run first')
  const assemblyMod = await import(pathToFileURL(join(REPO, 'tests/world-factory/lib/u7astore-assembly.mjs')).href)
  const presetMod = await import(pathToFileURL(join(REPO, 'tests/kits/_shared/preset-seam.mjs')).href)
  // SAME runStamp => same ROOT/CREATE_ROOT/realm/preset ids — the law under
  // test is booting the SAME persisted unit twice (boot2: create-or-open).
  const assembly = assemblyMod.createU7AStoreAssembly({ repoRoot: REPO, home: DSHH, runStamp: state.stamp, reportDir: join(LOGS, stamp) })
  const cfg = productionRowConfig(assembly)
  if (bootPhaseLabel === 'boot2') cfg.bootPhase = 'create-or-open' // seam law: boot 2 REOPENS
  const patchText = writePatch({
    rows: patchRows(assembly, presetMod, cfg),
    header: extraHeader,
  })
  return { assemblyMod, assembly, cfg, patchText, state }
}

async function boot1() {
  const stamp = utcStamp()
  const runId = `u7r3v2-shv2-1-${stamp}`
  const rec = {
    schema: 'u5-run-record/1', runId, suite: 'u7r3-shv2', startedAt: now(),
    selectedCases: [
      'shv2:environ-dsh-home-unset', 'shv2:environ-home-opshome', 'shv2:production-config',
      'shv2:store-mounted', 'shv2:state-under-opshome', 'shv2:member-write-leg-typed-ok',
      'shv2:leader-write-legs', 'shv2:real-home-untouched', 'shv2:locks-recorded',
      'shv2:negative-probes', 'shv2:stable-unchanged', 'shv2:leak-check',
    ],
  }
  saveState({ stamp })
  const { assemblyMod, assembly, cfg, patchText } = await assembleBoot({
    stamp, bootPhaseLabel: 'boot1',
    extraHeader: [
      'u7r3-shomev2 C2 boot1 (production DEFAULT-Home arm): the production Team',
      'row with plane key agentStateEnabled:true and NO testHomeGuard key —',
      'the family resolves the host home through the upstream trusted default',
      '($HOME/.dsh). No p6t6 observer: it refuses to mount without DSH_HOME.',
    ],
  })
  rec.bindings = {
    teamSha: git('-C', REPO, 'rev-parse', 'HEAD'),
    hostSha: HOST_SHA_PIN,
    hostBasePre: hostBaseCheck('boot1-pre'),
    authority: loadAuthority(),
    hostTree: HOST_TREE,
    pluginFaces: { row: pathToFileURL(ROW_FACE).href, store: pathToFileURL(STORE_FACE).href },
    pluginFaceDigests: { hostJs: sha256File(ROW_FACE), storeFs: sha256File(STORE_FACE) },
    leaseRoot: LEASE_ROOT,
    opshome: OPS,
    hostDerivedHome: DSHH,
    realHomeCensusTarget: REAL_HOME,
    planeConfigBytesWitness: {
      realmId: cfg.teamToolPlane.realmId,
      agentStateEnabled: cfg.teamToolPlane.agentStateEnabled,
      testHomeGuardKeyPresent: 'testHomeGuard' in cfg.teamToolPlane,
      bootPhase: cfg.bootPhase,
    },
    storeBaseRelativeToOpsHome: relative(OPS, assembly.STORE_ROOT).split(sep).join('/'),
    bootBudget: 'pool C2, EXACTLY 2 starts (pre-registered 215362c844); this is start #1 of 2',
  }
  if (!rec.bindings.hostBasePre.ok) throw new Error(`host base pre-check failed: ${JSON.stringify(rec.bindings.hostBasePre)}`)
  assembly.writePreBootFiles() // anchor blueprint + workspace (+ inert p6t6 directive, disclosed: no p6t6 row mounted)
  writeFileSync(join(EV, 'profile-patch-boot1.yml'), patchText)

  const hostLease = await acquireFirstFreeLease({ leaseRoot: LEASE_ROOT, world: 'u7r3shv2', purpose: 'host', include: paths.portsOfBands(paths.HOST_PORT_BANDS), preferred: [] })
  const mockLease = await acquireFirstFreeLease({ leaseRoot: LEASE_ROOT, world: 'u7r3shv2', purpose: 'mock-provider', include: paths.portsOfBands(paths.MOCK_PORT_BANDS), preferred: [] })
  rec.bindings.portProof = {
    leasedHost: hostLease.port, leasedMock: mockLease.port,
    freeBeforeBind: { host: await portFreeProbe(hostLease.port), mock: await portFreeProbe(mockLease.port) },
    bands: { host: paths.HOST_PORT_BANDS, mock: paths.MOCK_PORT_BANDS },
  }
  const mock = await mockMod.startMockModel({ port: mockLease.port, decide: assemblyMod.makeU7AStoreDecide({ assembly }), log: () => {} })
  const { env, scrubbed } = buildChildEnv({ mockPort: mock.port })
  rec.envManifest = {
    setKeys: ['HOME', 'DSH_CLIENT_COMMIT_HASH', 'DEEPSEEK_BASE_URL', 'DEEPSEEK_API_KEY(fake)'],
    homeValue: OPS,
    dshClientCommitHash: paths.CLIENT_COMMIT_HASH,
    dshHomeInChildEnv: 'DSH_HOME' in env, // MUST be false
    scrubbedKeys: scrubbed,
    proof: 'asserted via /proc/<pid>/environ immediately after spawn (below)',
  }
  if ('DSH_HOME' in env) throw new Error('env builder leaked DSH_HOME')

  // THE SPAWN — budget line FIRST (per-spawn counting)
  writeBudgetLine({ runId, suite: 'u7r3-shv2', world: `opshome-${stamp}`, phase: 'shv2-boot1' })
  const handle = await spawnHost({ port: hostLease.port, env, logDir: join(LOGS, stamp), label: 'boot1' })
  rec.boots = [{ phase: 'shv2-boot1', pid: handle.pid, port: handle.port, logPath: handle.logPath, token: '<launch-token, not recorded>' }]
  rec.environProof = handle.environ
  const stablePre = await stableProbe()
  rec.globalPreChecks = { stableInstance: { at: now(), status: stablePre.status } }
  rec.negativeProbes = negativeProbesBoot1() // negative legs INSIDE the start#1 window, no boot
  rec.homeSourceProbeBoot1 = childHomeDerivationProbe()

  const origin = `http://127.0.0.1:${handle.port}`
  try {
    let cookie = null
    for (let i = 0; i < 60 && cookie === null; i += 1) {
      try { cookie = await authenticate(origin, handle.token) } catch { await sleep(1000) }
    }
    if (cookie === null) throw new Error('authentication never succeeded')
    // readiness WITHOUT p6t6: the production row's own /team-remote answers
    const mounted = await waitUntil(async () => {
      const p = await remoteCall(fetchJson, origin, cookie, 'team.getLedgerPage', { teamSessionId: assembly.ROOT, afterSequence: 0, limit: 1 }, 'u7r3-ready', 1)
      return p?.status === 200 && p?.body?.result?.ok === true
    }, { timeoutMs: 120_000, everyMs: 1500 })
    rec.rowMountReady = mounted
    if (!mounted.hit) throw new Error('/team-remote never went ready (row mount or root-session failure — RCA from host log)')
    let discOk = false
    for (let i = 0; i < 40 && !discOk; i += 1) {
      const st = await apiPrompt(origin, cookie, assembly.ROOT, assembly.markers.MK_DISC, 'u7r3v2')
      discOk = st.status === 200
      if (!discOk) await sleep(1500)
    }
    if (!discOk) throw new Error('discovery prompt never returned 200')
    const discW = await waitUntil(() => mock.requests.some((r) => hasMarker(r, assembly.markers.MK_DISC) && surfaceNamesOf(r).length > 0), { timeoutMs: 150_000 })
    if (!discW.hit) throw new Error('discovery turn never reached the mock provider')
    const disc = mock.requests.filter((r) => hasMarker(r, assembly.markers.MK_DISC)).map((r) => surfaceNamesOf(r)).sort((a, b) => b.length - a.length)[0]
    const denyList = [...new Set(disc)].sort().filter((n) => !n.startsWith('team_') && !assemblyMod.AGENT_STATE_NAMES.includes(n))
    assembly.writeMainBlueprint(denyList)
    const created = await remoteCall(fetchJson, origin, cookie, 'team.create', { rootSessionId: assembly.CREATE_ROOT, blueprintId: assembly.BP_MAIN_ID, initialWork: { prompt: assembly.markers.MK_L1 } })
    rec.teamCreate = { status: created.status, ok: created.body?.result?.ok === true, body: JSON.stringify(created.body ?? null).slice(0, 600) }
    if (!(created.status === 200 && created.body?.result?.ok === true)) throw new Error(`team.create failed: ${String(created.status)}`)
    const unwrap = (body) => { const x = body?.result?.value; return x && typeof x === 'object' && 'data' in x ? x.data : x }
    const teamSessionId = unwrap(created.body)?.rootSessionId ?? assembly.CREATE_ROOT

    const controlRows = new Map(); const resolutions = []; const approverErrors = []
    const approver = makeApprover({ origin, cookie, teamSessionId, controlRows, resolutions, approverErrors, logger: log })
    const replySeen = (content) => mock.requests.some((r) => r.reply?.kind === 'text' && r.reply.content === content)
    const toolSeen = (name) => mock.requests.some((r) => (r.reply?.toolCalls ?? []).some((c) => c?.name === name))
    const parked = await waitUntil(() => replySeen('U7AS_L1_WAITING_FOR_HUMAN'), { timeoutMs: 90_000 })
    rec.l1Parked = parked
    const goalPrompt = await apiPrompt(origin, cookie, assembly.CREATE_ROOT, assembly.markers.MK_GOAL, 'u7r3v2-human')
    rec.goalPrompt = { status: goalPrompt.status }
    const goalTurn = await waitUntil(() => toolSeen('team_delegate'), { timeoutMs: 240_000 })
    const wakeCadence = async (content, deadlineMs, tag) => {
      const t0 = Date.now(); let lastWake = 0; let wakes = 0
      for (;;) {
        if (replySeen(content)) return true
        if (Date.now() - t0 > deadlineMs) return replySeen(content)
        if (Date.now() - lastWake > 3000 && wakes < 14) {
          wakes += 1; lastWake = Date.now()
          await apiPrompt(origin, cookie, assembly.CREATE_ROOT, `U7AS_PHASE_${tag}`, 'u7r3v2-wake').catch(() => {})
        }
        await sleep(350)
      }
    }
    const workerDone = await wakeCadence('U7AS_WORKER_DONE', 240_000, 'w')
    const leaderDone = await wakeCadence('U7AS_L1_DONE', 120_000, 'z')
    await sleep(4_000)
    approver.stop(); try { await approver.loop } catch { /* flag exit */ }

    const logLines = grepLog(handle.logPath, /placement-feed rows=|a5-agent-state|PLANE_AGENT_STATE|ALIAS|REPLAY|mount-REFUSED|placement-REFUSED/)
    const requests = mock.requests
    const workerEnv = `[team-work requestToken=${assembly.tokens('d1')}`
    const isWorker = (r) => JSON.stringify(messagesOf(r).filter((m) => m?.role === 'user').map((m) => m.content)).includes(workerEnv)
    const lastOf = (pred) => { const xs = requests.filter(pred); return xs.length === 0 ? null : xs[xs.length - 1] }
    const leaderReq = lastOf((r) => !isWorker(r) && hasMarker(r, assembly.markers.MK_GOAL))
    const workerReq = lastOf(isWorker)
    rec.digest = {
      lanes: { goalTurn: goalTurn.hit, workerDone, leaderDone }, teamSessionId,
      exchanges: [...exchangesOf(leaderReq, 'leader', assemblyMod.AGENT_STATE_NAMES), ...exchangesOf(workerReq, 'worker', assemblyMod.AGENT_STATE_NAMES)],
      controlRows: [...controlRows.values()], resolutions, approverErrors,
      placement: logLines.filter((l) => l.includes('placement-feed rows=') && l.includes('create_goal')).map((l) => l.slice(0, 300)),
      storeLine: logLines.filter((l) => l.includes('agent-state store=fs')).map((l) => l.slice(0, 260)),
      logHits: logLines.slice(-40).map((l) => l.slice(0, 260)),
    }
  } catch (error) {
    rec.driveError = String(error?.message ?? error).slice(0, 800)
    rec.driveLogTail = readFileSync(handle.logPath, 'utf8').split('\n').slice(-40)
  }

  rec.stop = await stopHost(handle, handle.port)
  try { await mock.close() } catch { /* best effort */ }
  try { hostLease.release?.(); mockLease.release?.() } catch { /* best effort */ }
  const disk = assembly.readStoreOnDisk()
  rec.disk = disk
  const files = walkFiles(assembly.STORE_ROOT)
  rec.realmTree = files
  rec.locks = files.filter((f) => f.rel.startsWith('locks/'))
  const capDir = join(EV, 'capture-boot1')
  mkdirSync(capDir, { recursive: true })
  for (const f of files) {
    const dst = join(capDir, f.rel)
    mkdirSync(dirname(dst), { recursive: true })
    copyFileSync(join(assembly.STORE_ROOT, f.rel), dst)
  }
  rec.captureManifest = files
  const touched = findNewer(REAL_HOME, MARKER_FILE, 30)
  rec.realHomeCheck = {
    teamStateExists: existsSync(join(REAL_HOME, 'team-state')),
    touchedSinceBaseline: touched,
    laneRealmOrTeamStateAmongTouched: touched.paths.filter((p) => p.includes('team-state') || p.includes(cfg.teamToolPlane.realmId)).length,
  }
  rec.hostBasePost = hostBaseCheck('boot1-post')
  const stablePost = await stableProbe()
  rec.globalPostChecks = { stableInstance: { pre: stablePre.status, post: stablePost.status, unchanged: stablePre.status === stablePost.status }, hostPorcelainEmpty: rec.hostBasePost.porcelainEmpty }
  rec.finishedAt = now()
  rec.verdict = deriveBoot1(rec)
  writeFileSync(join(EV, 'run-shv2-1.json'), JSON.stringify(rec, null, 2) + '\n')
  const st = loadState()
  saveState({ ...st, realm: cfg.teamToolPlane.realmId, root: assembly.ROOT, create: assembly.CREATE_ROOT, boot1RunId: runId })
  log(`boot1 verdicts: ${JSON.stringify(rec.verdict)}`)
  if (Object.values(rec.verdict).includes('FAIL')) {
    log('TYPED FAIL: budget law — RCA from run-shv2-1.json + logs BEFORE any further boot; do NOT rerun a boot phase blind.')
    process.exitCode = 1
  }
}

function deriveBoot1(rec) {
  const V = {}
  V['shv2:environ-dsh-home-unset'] = rec.environProof?.dshHomeAbsent === true ? 'PASS' : 'FAIL'
  V['shv2:environ-home-opshome'] = rec.environProof?.homeEqualsOpshome === true ? 'PASS' : 'FAIL'
  V['shv2:production-config'] = rec.bindings?.planeConfigBytesWitness?.testHomeGuardKeyPresent === false
    && rec.bindings?.planeConfigBytesWitness?.agentStateEnabled === true
    && rec.envManifest?.dshHomeInChildEnv === false ? 'PASS' : 'FAIL'
  V['shv2:store-mounted'] = (rec.digest?.storeLine?.length ?? 0) > 0 && (rec.digest?.placement?.length ?? 0) > 0 && rec.rowMountReady?.hit === true ? 'PASS' : 'FAIL'
  V['shv2:state-under-opshome'] = rec.disk?.rootExists === true && rec.disk?.realUnderHome === true ? 'PASS' : 'FAIL'
  const todoWrites = (rec.disk?.writes ?? []).filter((w) => w.op === 'todos/apply')
  const todoHead = (rec.digest?.exchanges ?? []).find((e) => e.lane === 'worker' && e.name === 'todo_write')?.head ?? null
  V['shv2:member-write-leg-typed-ok'] = todoWrites.length >= 1 && todoHead !== null && !String(todoHead).startsWith('Error') && !String(todoHead).startsWith('refused') ? 'PASS' : 'FAIL'
  const goalWrites = (rec.disk?.writes ?? []).filter((w) => w.op === 'goal/apply')
  V['shv2:leader-write-legs'] = goalWrites.length >= 1 && (rec.disk?.records ?? []).some((r) => r.goal !== null) ? 'PASS' : 'FAIL'
  V['shv2:real-home-untouched'] = rec.realHomeCheck?.teamStateExists === false && rec.realHomeCheck?.laneRealmOrTeamStateAmongTouched === 0 ? 'PASS' : 'REVIEW'
  V['shv2:locks-recorded'] = 'RECORDED'
  V['shv2:negative-probes'] = (rec.negativeProbes?.probes ?? []).every((p) => p.matches) ? 'PASS' : 'FAIL'
  V['shv2:stable-unchanged'] = rec.globalPostChecks?.stableInstance?.unchanged === true ? 'PASS' : 'FAIL'
  V['shv2:leak-check'] = rec.stop?.portFree === true && rec.stop?.cleanExit === true ? 'PASS' : 'FAIL'
  return V
}

async function boot2() {
  const stamp2 = utcStamp()
  const runId = `u7r3v2-shv2-2-${stamp2}`
  const { assemblyMod, assembly, cfg, patchText, state } = await assembleBoot({
    stamp: stamp2,
    bootPhaseLabel: 'boot2',
    extraHeader: [
      'u7r3-shomev2 C2 boot2 (restart arm): SAME operator home, SAME realm,',
      'bootPhase create-or-open (seam law: reopen the persisted unit),',
      'still NO testHomeGuard — the production arm answers again.',
    ],
  })
  if (cfg.teamToolPlane.realmId !== state.realm) throw new Error(`realm drift: ${cfg.teamToolPlane.realmId} !== boot1 ${state.realm}`)
  const CLAIM2 = `U7R3V2_CLAIM2_${state.stamp}`
  const MK_GOAL2 = `U7R3V2_GOAL2_${state.stamp}`
  const MK_L1_B2 = `U7R3V2_L1B2_${state.stamp}`
  const rec = {
    schema: 'u5-run-record/1', runId, suite: 'u7r3-shv2', startedAt: now(), restartOf: state.stamp,
    selectedCases: [
      'shv2:boot2-environ', 'shv2:boot2-store-mounted-same-realm', 'shv2:boot2-write-leg-typed-ok',
      'shv2:readback-byte-identical', 'shv2:readback-fresh-store-instance', 'shv2:replay-refusal',
      'shv2:locks-replay-healthy', 'shv2:homeSource-default', 'shv2:stable-unchanged', 'shv2:leak-check',
    ],
  }
  rec.bindings = {
    teamSha: git('-C', REPO, 'rev-parse', 'HEAD'),
    hostSha: HOST_SHA_PIN,
    hostBasePre: hostBaseCheck('boot2-pre'),
    authority: loadAuthority(),
    hostTree: HOST_TREE,
    pluginFaceDigests: { hostJs: sha256File(ROW_FACE), storeFs: sha256File(STORE_FACE) },
    leaseRoot: LEASE_ROOT,
    opshome: OPS,
    sameHomeAndRealmAsBoot1: true,
    realm: state.realm,
    planeConfigBytesWitness: {
      realmId: cfg.teamToolPlane.realmId,
      agentStateEnabled: cfg.teamToolPlane.agentStateEnabled,
      testHomeGuardKeyPresent: 'testHomeGuard' in cfg.teamToolPlane,
      bootPhase: cfg.bootPhase,
      rootSessionId: cfg.rootSessionId,
    },
    restartLaw: 'root-binding/harness/seam.mjs header: boot 2 REOPENS the persisted unit through openTeamDomain; a fresh create rootSessionId would collide with the stamped domain — hence create-or-open (resolves to resume for the existing root).',
    bootBudget: 'pool C2, EXACTLY 2 starts (pre-registered 215362c844); this is start #2 of 2',
  }
  if (!rec.bindings.hostBasePre.ok) throw new Error(`host base pre-check failed: ${JSON.stringify(rec.bindings.hostBasePre)}`)
  writeFileSync(join(EV, 'profile-patch-boot2.yml'), patchText)

  const hostLease = await acquireFirstFreeLease({ leaseRoot: LEASE_ROOT, world: 'u7r3shv2', purpose: 'host', include: paths.portsOfBands(paths.HOST_PORT_BANDS), preferred: [] })
  const mockLease = await acquireFirstFreeLease({ leaseRoot: LEASE_ROOT, world: 'u7r3shv2', purpose: 'mock-provider', include: paths.portsOfBands(paths.MOCK_PORT_BANDS), preferred: [] })
  rec.bindings.portProof = {
    leasedHost: hostLease.port, leasedMock: mockLease.port,
    freeBeforeBind: { host: await portFreeProbe(hostLease.port), mock: await portFreeProbe(mockLease.port) },
  }
  // boot2 drive: the SAME realm answers a SECOND governed write+read leg
  // (leader create_goal(claim2) → get_goal → DONE). One team session only.
  const decide2 = ({ req }) => {
    const t = messagesOf(req).map(textOf).join('\n')
    if (t.includes('Generate the session title')) return { kind: 'text', content: 'u7r3v2 b2 session' }
    if (t.includes(MK_GOAL2)) {
      const used = []
      for (const m of messagesOf(req)) { if (m?.role !== 'assistant' || !Array.isArray(m?.content)) continue; for (const b of m.content) if (b?.type === 'tool_use') used.push(String(b?.name ?? '')) }
      if (!used.includes('create_goal')) return toolCall('create_goal', { objective: CLAIM2, max_goal_rounds: 3 })
      if (!used.includes('get_goal')) return toolCall('get_goal', {})
      return { kind: 'text', content: 'U7R3V2_B2_DONE' }
    }
    return { kind: 'text', content: 'U7R3V2_NOOP' }
  }
  const mock = await mockMod.startMockModel({ port: mockLease.port, decide: decide2, log: () => {} })
  const { env, scrubbed } = buildChildEnv({ mockPort: mock.port })
  rec.envManifest = { setKeys: ['HOME', 'DSH_CLIENT_COMMIT_HASH', 'DEEPSEEK_BASE_URL', 'DEEPSEEK_API_KEY(fake)'], homeValue: OPS, dshHomeInChildEnv: 'DSH_HOME' in env, scrubbedKeys: scrubbed }
  if ('DSH_HOME' in env) throw new Error('env builder leaked DSH_HOME')

  writeBudgetLine({ runId, suite: 'u7r3-shv2', world: `opshome-${state.stamp}(restart)`, phase: 'shv2-boot2' })
  const handle = await spawnHost({ port: hostLease.port, env, logDir: join(LOGS, stamp2), label: 'boot2' })
  rec.boots = [{ phase: 'shv2-boot2', pid: handle.pid, port: handle.port, logPath: handle.logPath, token: '<launch-token, not recorded>' }]
  rec.environProof = handle.environ
  const stablePre = await stableProbe()
  const origin = `http://127.0.0.1:${handle.port}`
  const CREATE2 = `${assembly.CREATE_ROOT}` // SAME main team session id — the unit was reopened, not re-minted
  try {
    let cookie = null
    for (let i = 0; i < 60 && cookie === null; i += 1) {
      try { cookie = await authenticate(origin, handle.token) } catch { await sleep(1000) }
    }
    if (cookie === null) throw new Error('authentication never succeeded')
    const mounted = await waitUntil(async () => {
      const p = await remoteCall(fetchJson, origin, cookie, 'team.getLedgerPage', { teamSessionId: assembly.ROOT, afterSequence: 0, limit: 1 }, 'u7r3-ready2', 1)
      return p?.status === 200 && p?.body?.result?.ok === true
    }, { timeoutMs: 120_000, everyMs: 1500 })
    rec.rowMountReady = mounted
    if (!mounted.hit) throw new Error('/team-remote never went ready on the reopened unit (RCA from host log)')
    // resume witness: the anchor team session carries its boot-1 ledger
    const anchorLedger = await remoteCall(fetchJson, origin, cookie, 'team.getLedgerPage', { teamSessionId: assembly.ROOT, afterSequence: 0, limit: 5 }, 'u7r3-anchor2', 1)
    rec.anchorLedgerAfterResume = { status: anchorLedger?.status, entries: Array.isArray(anchorLedger?.body?.result?.value?.data?.entries) ? anchorLedger.body.result.value.data.entries.length : null }
    // the second governed leg on the REOPENED realm: fresh main session (b2),
    // same blueprint/dir, new claim2. New session ids never collide.
    const created = await remoteCall(fetchJson, origin, cookie, 'team.create', { rootSessionId: `${assembly.CREATE_ROOT}-b2`, blueprintId: assembly.BP_MAIN_ID, initialWork: { prompt: MK_L1_B2 } })
    rec.teamCreate2 = { status: created.status, ok: created.body?.result?.ok === true, body: JSON.stringify(created.body ?? null).slice(0, 500) }
    if (!(created.status === 200 && created.body?.result?.ok === true)) throw new Error(`team.create(b2) failed: ${String(created.status)}`)
    const teamSessionId2 = `${assembly.CREATE_ROOT}-b2`
    const controlRows = new Map(); const resolutions = []; const approverErrors = []
    const approver = makeApprover({ origin, cookie, teamSessionId: teamSessionId2, controlRows, resolutions, approverErrors, logger: log })
    const goalPrompt = await apiPrompt(origin, cookie, teamSessionId2, MK_GOAL2, 'u7r3v2-human2')
    rec.goalPrompt2 = { status: goalPrompt.status }
    const doneW = await waitUntil(() => mock.requests.some((r) => r.reply?.kind === 'text' && r.reply.content === 'U7R3V2_B2_DONE'), { timeoutMs: 240_000 })
    rec.b2Done = doneW
    await sleep(3_000)
    approver.stop(); try { await approver.loop } catch { /* flag */ }
    const lastOf = (pred) => { const xs = mock.requests.filter(pred); return xs.length === 0 ? null : xs[xs.length - 1] }
    const leaderReq2 = lastOf((r) => hasMarker(r, MK_GOAL2))
    rec.digest2 = {
      exchanges: exchangesOf(leaderReq2, 'leader-b2', assemblyMod.AGENT_STATE_NAMES),
      controlRows: [...controlRows.values()], resolutions, approverErrors, teamSessionId2, claim2: CLAIM2,
    }
  } catch (error) {
    rec.driveError = String(error?.message ?? error).slice(0, 800)
    rec.driveLogTail = readFileSync(handle.logPath, 'utf8').split('\n').slice(-40)
  }
  rec.stop = await stopHost(handle, handle.port)
  try { await mock.close() } catch { /* */ }
  try { hostLease.release?.(); mockLease.release?.() } catch { /* */ }

  // ── restart-arm verifiers (offline, zero boot) ──────────────────────────
  const realmRoot = assembly.STORE_ROOT // same realm, same home
  const filesNow = walkFiles(realmRoot)
  const boot1rec = JSON.parse(readFileSync(join(EV, 'run-shv2-1.json'), 'utf8'))
  const manifest = boot1rec.captureManifest ?? []
  const nowByRel = new Map(filesNow.map((f) => [f.rel, f]))
  const mismatches = []
  for (const f of manifest) {
    const cur = nowByRel.get(f.rel)
    if (cur === undefined) { mismatches.push({ rel: f.rel, reason: 'MISSING' }); continue }
    if (cur.sha256 === f.sha256) continue
    if (f.rel === 'ledger/writes.jsonl' || f.rel === 'ledger/attempts.jsonl') {
      const old = readFileSync(join(EV, 'capture-boot1', f.rel), 'utf8')
      const cur2 = readFileSync(join(realmRoot, f.rel), 'utf8')
      if (!cur2.startsWith(old)) mismatches.push({ rel: f.rel, reason: 'LEDGER-PREFIX-BROKEN' })
      continue
    }
    mismatches.push({ rel: f.rel, reason: 'BYTES-CHANGED' })
  }
  rec.byteIdentity = { boot1Files: manifest.length, missingOrChanged: mismatches, verdict: mismatches.length === 0 ? 'IDENTICAL' : 'DRIFT' }

  const fresh = storeMod.createFsStateStore({ rootDir: realmRoot, anchorDir: realpathSync(DSHH), realmId: state.realm })
  const boot1Goal = (boot1rec.disk?.records ?? []).find((r) => r.goal !== null) ?? null
  const boot1Todo = (boot1rec.disk?.records ?? []).find((r) => Array.isArray(r.todos)) ?? null
  const goalNow = boot1Goal ? await fresh.readGoal(boot1Goal.key) : null
  const todosNow = boot1Todo ? await fresh.readTodos(boot1Todo.key) : null
  const claim2Record = (fresh && filesNow.length > 0) ? null : null // (records read below through the fresh instance)
  const b2Key = `agent:${assembly.CREATE_ROOT}-b2`
  const goal2 = await fresh.readGoal(b2Key)
  rec.freshStoreReread = {
    boot1GoalKey: boot1Goal?.key ?? null,
    boot1GoalEqualsDisk: goalNow !== null && JSON.stringify(goalNow) === JSON.stringify(boot1Goal?.goal ?? null),
    boot1TodosEqualDisk: todosNow !== null && JSON.stringify(todosNow) === JSON.stringify(boot1Todo?.todos ?? null),
    claim2GoalReadBack: goal2 !== null && String(goal2?.objective ?? '') === CLAIM2,
  }
  // replay refusal through the SAME fresh instance (second consumer, no boot)
  const goalApplyId = (boot1rec.disk?.writes ?? []).find((w) => w.op === 'goal/apply')?.applyId ?? null
  let replayProbe = { skipped: 'no boot-1 goal applyId on disk' }
  if (goalApplyId !== null && boot1Goal !== null) {
    const writesBefore = statSync(join(realmRoot, 'ledger/writes.jsonl')).size
    const res = await fresh.applyGoal(boot1Goal.key, {
      expectedRevision: (boot1Goal.goal?.revision ?? 1) + 1,
      next: { ...(boot1Goal.goal ?? {}), revision: (boot1Goal.goal?.revision ?? 1) + 1 },
      applyId: goalApplyId,
    })
    replayProbe = {
      applyId: goalApplyId,
      code: res?.code ?? null,
      detail: String(res?.detail ?? '').slice(0, 200),
      writesBytesUnchanged: statSync(join(realmRoot, 'ledger/writes.jsonl')).size === writesBefore,
    }
  }
  rec.replayProbe = replayProbe
  const logLines2 = grepLog(handle.logPath, /placement-feed rows=|a5-agent-state|PLANE_AGENT_STATE|ALIAS|REPLAY|REFUSED/)
  rec.boot2Log = {
    storeLine: logLines2.filter((l) => l.includes('agent-state store=fs')).map((l) => l.slice(0, 260)),
    placement: logLines2.filter((l) => l.includes('placement-feed rows=') && l.includes('create_goal')).map((l) => l.slice(0, 300)),
    aliasViolations: logLines2.filter((l) => /ALIAS/.test(l)).length,
    mountRefusals: logLines2.filter((l) => /mount-REFUSED|placement-REFUSED|PLANE_AGENT_STATE/.test(l)).length,
    hits: logLines2.slice(-40).map((l) => l.slice(0, 260)),
  }
  rec.homeSourceProbeBoot2 = childHomeDerivationProbe()
  rec.realmTreeAfter = walkFiles(realmRoot) // AFTER the replay probe (attempts line appended — disclosed)
  const touched = findNewer(REAL_HOME, MARKER_FILE, 30)
  rec.realHomeCheck = {
    teamStateExists: existsSync(join(REAL_HOME, 'team-state')),
    touchedSinceBaseline: touched,
    laneRealmOrTeamStateAmongTouched: touched.paths.filter((p) => p.includes('team-state') || p.includes(state.realm)).length,
  }
  rec.hostBasePost = hostBaseCheck('boot2-post')
  const stablePost = await stableProbe()
  rec.globalPostChecks = { stableInstance: { pre: stablePre.status, post: stablePost.status, unchanged: stablePre.status === stablePost.status }, hostPorcelainEmpty: rec.hostBasePost.porcelainEmpty }
  rec.finishedAt = now()
  rec.verdict = deriveBoot2(rec)
  writeFileSync(join(EV, 'run-shv2-2.json'), JSON.stringify(rec, null, 2) + '\n')
  log(`boot2 verdicts: ${JSON.stringify(rec.verdict)}`)
  if (Object.values(rec.verdict).includes('FAIL')) {
    log('TYPED FAIL: RCA from run-shv2-2.json + logs first; both budget lines are spent — report, do NOT re-boot.')
    process.exitCode = 1
  }
}

function deriveBoot2(rec) {
  const V = {}
  V['shv2:boot2-environ'] = rec.environProof?.dshHomeAbsent === true && rec.environProof?.homeEqualsOpshome === true ? 'PASS' : 'FAIL'
  V['shv2:boot2-store-mounted-same-realm'] = (rec.boot2Log?.storeLine?.length ?? 0) > 0 && (rec.boot2Log?.placement?.length ?? 0) > 0 && rec.boot2Log?.mountRefusals === 0 ? 'PASS' : 'FAIL'
  const cg = (rec.digest2?.exchanges ?? []).find((e) => e.name === 'create_goal')?.head ?? null
  V['shv2:boot2-write-leg-typed-ok'] = rec.digest2 !== undefined && cg !== null && !String(cg).startsWith('Error') && !String(cg).startsWith('refused') && String(cg).includes(rec.digest2.claim2) ? 'PASS' : 'FAIL'
  V['shv2:readback-byte-identical'] = rec.byteIdentity?.verdict === 'IDENTICAL' ? 'PASS' : 'FAIL'
  V['shv2:readback-fresh-store-instance'] = rec.freshStoreReread?.boot1GoalEqualsDisk === true && rec.freshStoreReread?.boot1TodosEqualDisk === true && rec.freshStoreReread?.claim2GoalReadBack === true ? 'PASS' : 'FAIL'
  V['shv2:replay-refusal'] = rec.replayProbe?.code === 'STATE_APPLY_REPLAY' && rec.replayProbe?.writesBytesUnchanged === true ? 'PASS' : 'FAIL'
  V['shv2:locks-replay-healthy'] = (rec.boot2Log?.aliasViolations ?? 1) === 0 && (rec.boot2Log?.mountRefusals ?? 1) === 0 && V['shv2:boot2-write-leg-typed-ok'] === 'PASS' ? 'PASS' : 'FAIL'
  const derived = rec.homeSourceProbeBoot2?.parsed ?? null
  const derivedHome = derived?.storeLaw?.home ?? null
  V['shv2:homeSource-derived-home'] = derivedHome
  V['shv2:homeSource-default'] = rec.homeSourceProbeBoot2?.spawnOk === true && derivedHome === realpathSync(DSHH) && derived?.hasDSH === false ? 'PASS' : 'FAIL'
  V['shv2:stable-unchanged'] = rec.globalPostChecks?.stableInstance?.unchanged === true ? 'PASS' : 'FAIL'
  V['shv2:leak-check'] = rec.stop?.portFree === true && rec.stop?.cleanExit === true ? 'PASS' : 'FAIL'
  return V
}

async function census() {
  const state = loadState() ?? {}
  const rec = { schema: 'u7r3v2-census/1', at: now() }
  const tree = spawnSync('find', [OPS, '-maxdepth', '6'], { encoding: 'utf8', timeout: 120_000 })
  writeFileSync(join(EV, 'opshome-tree.txt'), `${(tree.stdout ?? '').split('\n').filter((l) => l !== '').sort().join('\n')}\n`)
  rec.opshomeEntries = (tree.stdout ?? '').split('\n').filter((l) => l !== '').length
  const rc = statSync(REAL_HOME)
  const touched = findNewer(REAL_HOME, MARKER_FILE, 60)
  const teamTouched = touched.paths.filter((p) => p.includes('team-state') || (state.realm !== undefined && p.includes(state.realm)))
  const pre = readFileSync(join(EV, 'home-mtime-receipt.txt'), 'utf8')
  const receiptHead = pre.split('post-run')[0]
  writeFileSync(join(EV, 'home-mtime-receipt.txt'),
    `${receiptHead}post-run (census ${now()}): mtimeMs=${rc.mtimeMs} mtime=${rc.mtime.toISOString()} ctimeMs=${rc.ctimeMs}\n` +
    `team-state/ present post-run: ${String(existsSync(join(REAL_HOME, 'team-state')))}\n` +
    `find ${REAL_HOME} -maxdepth 3 -newer census-marker: ${touched.count} entr(ies)\n` +
    `attribution note: the :3080 stable instance AND this very harness session write their own state under the real ~/.dsh continuously; the lane law is that NOTHING of this lane's namespace appears there:\n` +
    touched.paths.map((p) => `  ${p}`).join('\n') + '\n' +
    `team-state / lane-realm paths among them (MUST be 0): ${teamTouched.length}\n`)
  rec.realHome = { touchedCount: touched.count, teamStateOrRealmTouched: teamTouched.length, teamStateExists: existsSync(join(REAL_HOME, 'team-state')) }
  rec.budgetLines = existsSync(BUDGET) ? readFileSync(BUDGET, 'utf8').split('\n').filter((l) => l !== '').length : 0
  rec.portLeaseClaimsMine = scanAllLeases(LEASE_ROOT).filter((e) => String(e.by?.world ?? '').startsWith('u7r3shv2')).map((e) => ({ port: e.port, alive: e.alive }))
  rec.stable = await stableProbe()
  writeFileSync(join(EV, 'census.json'), JSON.stringify(rec, null, 2) + '\n')
  log(`census: opshome entries=${rec.opshomeEntries} real-home team-state/lane touched=${rec.realHome.teamStateOrRealmTouched} budgetLines=${rec.budgetLines}`)
}

const phase = process.argv[2]
if (phase === 'preflight') await preflight()
else if (phase === 'boot1') await boot1()
else if (phase === 'boot2') await boot2()
else if (phase === 'census') await census()
else { console.error('usage: drive-shv2.mjs preflight|boot1|boot2|census'); process.exit(2) }
process.exit(process.exitCode ?? 0)
