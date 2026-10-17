#!/usr/bin/env node
/**
 * a5g4-negctl-kit.mjs — GLUE-4 scoped-visibility negative control (Alpha.5 wiring).
 *
 * QUESTION (the GLUE-4 reconnaissance gate): can a PUBLIC assembly surface make
 * the native tool face (`read/write/edit/read_image/bash`) visible to the
 * Guard's trusted GLOBAL read (`tools.schemas()` with NO scope — the exact read
 * production `nativeNames` is derived from, agent-bindings.mjs) WITHOUT changing
 * the model-facing catalog of any NON-team session? Root's hard requirement:
 * the production entry must never register globally in a way that expands
 * every member's power (least privilege), and the negative control is literally
 * "a non-team session's globalNames do not change".
 *
 * METHOD (two worlds, ONE delta):
 *   baseline     = pinned web host + the read-only observer row only. The web
 *                  bundle disables the root tool-fs/tool-bash rows, so the
 *                  trusted GLOBAL face is empty (the bind-diag law, re-proved).
 *   globalmount  = the SAME world plus the two top-level profile-patch rows
 *                  (`@deepseek-ai/dsh-tool-fs`, `@deepseek-ai/dsh-tool-bash`) —
 *                  exactly the bind-diag hostplane fix demo, i.e. the shape a
 *                  production entry (root cordis.patch.yml) would ship.
 * In BOTH worlds we create TWO ordinary (NON-team) sessions through the public
 * `session/create` entry, selecting the two SHIPPED presets by id —
 * `standard` (mounts tool-fs/tool-bash inside its preset realm) and `minimal`
 * (ships NO tool-fs/tool-bash rows at all) — run one mock-model turn each so a
 * real Agent exists, then read through the observer:
 *   FACE 1 globalNames, and FACE 2 every live Agent's model-facing catalog
 *   `tools.schemas(agent)` — plus the wire-side catalog (the `tools[]` array of
 *   the outbound model request captured by the scripted mock) as an
 *   independent second reading.
 *
 * CRITERIA (computed across the two runs, nothing inferred):
 *   G4 baseline globalNames == []                 (the web-face law, re-proved)
 *   G5 globalmount globalNames ⊇ the five names   (global mount works)
 *   G6 `standard` non-team catalog delta == ∅     (own preset copy shadows)
 *   G7 `minimal` non-team delta ⊇ {read,write,edit,read_image}
 *       ⇒ MEASURED EXPANSION: the public global mount reaches a non-team
 *       session that does not shadow, and NO public row syntax gates it.
 *   G8 globalNames flipped []→5 process-wide      (the literal negative
 *       control "non-team globalNames unchanged" is IMPOSSIBLE with a global
 *       mount: the trusted face is one process-wide registry view).
 *
 * Honesty rules: every criterion comes from LIVE route/wire reads captured at
 * observation time; a missing leg FAILS, nothing back-filled; launch tokens are
 * redacted at capture; both worlds are swept (TEST_METHODS §7); :3080 is
 * probed read-only before/after and never operated; the test-use host is the
 * pinned pristine runtime, porcelain-checked before AND after; no
 * DSH_PERMISSION_MODE knob anywhere (no tool ever executes — catalog reads
 * only).
 *
 * EXIT: 0 all criteria pass (GREEN) · 2 a criterion failed (RED) · 1 fatal.
 */
import { spawn } from 'node:child_process'
import { createHash } from 'node:crypto'
import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, openSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { createServer } from 'node:net'
import { dirname, join, relative, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

import { startMockModel } from '../../../../../../packages/tools/harness/mock-deepseek.mjs'
import { TEST_USE_BASELINE_SHA, CLIENT_COMMIT_HASH } from '../../../../../../tests/paths.mjs'

const args = process.argv.slice(2)
const argValue = (n, d) => { const i = args.indexOf(`--${n}`); return i === -1 ? d : args[i + 1] }
const KEEP = args.includes('--keep')
const HERE = dirname(new URL(import.meta.url).pathname)
const WORKTREE = resolve(argValue('worktree', resolve(HERE, '..', '..', '..', '..', '..', '..')))
const RUN_STAMP = new Date().toISOString().slice(0, 19).replace(/[:]/g, '-') + 'Z'
const EVIDENCE_DIR = resolve(argValue('evidence-dir', join(WORKTREE, 'dev', 'agent-workflow', 'evidence', 'alpha5', 'wiring', 'glue4-prodentry', `runs`, RUN_STAMP)))
mkdirSync(EVIDENCE_DIR, { recursive: true })

const HOST_PORT = Number(argValue('port', 3187))
const TESTUSE = resolve(argValue('testuse', join(WORKTREE, 'tests', 'deepseek-harness-test-use')))
const HOST_BIN = join(TESTUSE, 'apps', 'cli', 'lib', 'bin.js')
const ROW_PATH = join(HERE, 'a5g4-observer-row.mjs')
const WORLD_PREFIX = argValue('world-prefix', 'a5g4')

const FIVE = ['bash', 'edit', 'read', 'read_image', 'write']
const FS_FOUR = ['edit', 'read', 'read_image', 'write']
const PRESETS = ['standard', 'minimal']

// ── redaction at capture ─────────────────────────────────────────────────────
const hex8 = (s) => createHash('sha256').update(s).digest('hex').slice(0, 8)
const REDACTIONS = [
  [/(https?:\/\/[^\s"'`]+?\?token=)([A-Za-z0-9_-]{8,})/g, (_m, head, tok) => head + `<REDACTED-${hex8(tok)}>`],
  [/\b(token|api_key|apikey|access_token)=["']?[A-Za-z0-9_\-.=]{8,}/gi, (m0) => m0.split('=')[0] + '=<REDACTED>'],
  [/dsh-auth-[A-Za-z0-9_-]{6,}/g, 'dsh-auth-<REDACTED>'],
  [/\bBearer\s+[A-Za-z0-9._-]{6,}/gi, 'Bearer <REDACTED>'],
]
const redact = (text) => REDACTIONS.reduce((t, [re, r]) => t.replace(re, r), text)

const CRITERIA = []
function check(id, claim, cond, observed) {
  CRITERIA.push({ id, claim, pass: cond === true, observed })
  console.log(`${cond === true ? 'PASS' : 'FAIL'} ${id} — ${claim}${observed === undefined ? '' : ` [${observed}]`}`)
}
const die = (msg) => { throw new Error(`FATAL: ${msg}`) }

function portFree(port) {
  return new Promise((res) => {
    const srv = createServer()
    srv.once('error', () => res(false))
    srv.once('listening', () => srv.close(() => res(true)))
    srv.listen(port, '127.0.0.1')
  })
}
async function portFreeWait(port, timeoutMs = 20_000) {
  const deadline = Date.now() + timeoutMs
  for (;;) {
    if (await portFree(port)) return true
    if (Date.now() >= deadline) return false
    await new Promise((r) => setTimeout(r, 300))
  }
}
function gitAt(dir, ...a) { return spawnSync('git', ['-C', dir, ...a], { encoding: 'utf8' }).stdout.trim() }
const stableProbe = async () => {
  try { const r = await fetch('http://127.0.0.1:3080/', { redirect: 'manual', signal: AbortSignal.timeout(5000) }); return r.status } catch { return 'unreachable' }
}

function writeEvidence(name, value) {
  writeFileSync(join(EVIDENCE_DIR, name), typeof value === 'string' ? value : JSON.stringify(value, null, 2) + '\n')
}
const repoRel = (p) => relative(WORKTREE, p).split('\\').join('/')

const BOOT_MARKER = /dsh web: http:\/\/127\.0\.0\.1:(\d+)\/\?token=([A-Za-z0-9_-]+)/
async function waitFor(deadlineMs, fn, what) {
  const deadline = Date.now() + deadlineMs
  for (;;) {
    const v = await fn()
    if (v !== null && v !== undefined && v !== false) return v
    if (Date.now() >= deadline) die(`timeout waiting for ${what}`)
    await new Promise((r) => setTimeout(r, 250))
  }
}
async function fetchJson(url, init, timeoutMs = 30_000) {
  const res = await fetch(url, { ...(init ?? {}), signal: AbortSignal.timeout(timeoutMs) })
  const text = await res.text()
  try { return { status: res.status, body: JSON.parse(text) } } catch { return { status: res.status, body: text } }
}

/** One world: boot → two preset sessions → observer facts → sweep. */
async function runWorld({ mode, mock, MK }) {
  const HOME = join(WORKTREE, 'tests', 'homes', `${WORLD_PREFIX}-${mode}-${RUN_STAMP}`)
  const INSTANCE_RAW = join(EVIDENCE_DIR, `instance-${mode}.raw.log`)
  const INSTANCE_LOG = join(EVIDENCE_DIR, `instance-${mode}.log`)
  let host = null
  let ok = false
  const facts = { mode, home: repoRel(HOME), ok: false }
  try {
    if (!(await portFreeWait(HOST_PORT))) die(`host port ${HOST_PORT} not free before ${mode} world`)
    mkdirSync(join(HOME, 'workspace'), { recursive: true })
    const LAUNCH_CWD = join(HOME, 'workspace')
    mkdirSync(join(HOME, 'profiles', 'web'), { recursive: true })
    const patch = [
      `# a5g4 GLUE-4 negative-control patch (run ${RUN_STAMP}, mode ${mode}): observer row${mode === 'globalmount' ? ' + the TWO top-level tool rows (the production-entry shape: @deepseek-ai/dsh-tool-fs / @deepseek-ai/dsh-tool-bash re-enabled as root profile rows)' : ' only (web bundle keeps the root tool rows disabled)'} — public profile-patch seam only.`,
      '- insert:',
      '    - id: a5g4-observer',
      `      name: ${JSON.stringify(pathToFileURL(ROW_PATH).href)}`,
      '      config: {}',
    ]
    if (mode === 'globalmount') {
      patch.push(
        '    - id: tool-fs',
        "      name: '@deepseek-ai/dsh-tool-fs'",
        '    - id: tool-bash',
        "      name: '@deepseek-ai/dsh-tool-bash'",
      )
    }
    patch.push('')
    writeFileSync(join(HOME, 'profiles', 'web', 'cordis.patch.yml'), patch.join('\n'))

    const outFd = openSync(INSTANCE_RAW, 'a')
    const child = spawn(process.execPath, [HOST_BIN, 'web', '--port', String(HOST_PORT), '--no-open'], {
      cwd: LAUNCH_CWD,
      stdio: ['ignore', outFd, outFd],
      env: {
        ...process.env,
        DSH_HOME: HOME,
        DSH_CLIENT_COMMIT_HASH: CLIENT_COMMIT_HASH,
        DEEPSEEK_BASE_URL: `http://127.0.0.1:${mock.port}`,
        DEEPSEEK_API_KEY: 'a5g4-mock-key',
      },
    })
    host = child
    child.on('exit', (code, signal) => console.log(`[${mode}] host exited code=${String(code)} signal=${String(signal)}`))
    const boot = await waitFor(90_000, () => {
      try { const m = BOOT_MARKER.exec(readFileSync(INSTANCE_RAW, 'utf8')); return m === null ? false : m } catch { return false }
    }, `${mode} host boot marker`)
    const origin = `http://127.0.0.1:${boot[1]}`
    const token = boot[2]
    const auth = await fetch(`${origin}/?token=${token}`, { redirect: 'manual', signal: AbortSignal.timeout(30_000) })
    const cookie = auth.headers.get('set-cookie')
    if (!(auth.status === 303 && cookie !== null)) die(`${mode} token gate returned ${String(auth.status)} (expected 303 + set-cookie)`)
    await waitFor(30_000, async () => {
      const h = await fetchJson(`${origin}/__a5g4/health`).catch(() => null)
      return h?.status === 200 && h.body.applied === true ? h : false
    }, `${mode} observer apply via /__a5g4/health`)

    for (const preset of PRESETS) {
      const created = await fetchJson(`${origin}/api/session/create`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', cookie: cookie ?? '' },
        body: JSON.stringify({ type: 'client-request', rpcId: `a5g4-${preset}-c-${Math.random().toString(36).slice(2, 10)}`, method: 'session/create', payload: { args: { request: { agentPreset: preset } } } }),
      }, 60_000)
      const sessionId = created.body?.result?.value?.sessionId ?? created.body?.value?.sessionId ?? null
      if (typeof sessionId !== 'string' || sessionId === '') die(`${mode}: session/create for preset=${preset} returned no sessionId: ${JSON.stringify(created.body).slice(0, 200)}`)
      const res0 = created.body?.result?.value ?? created.body?.value ?? {}
      facts[preset] = { sessionId, echoedPreset: res0.agentPreset ?? null }
      const promptRes = await fetchJson(`${origin}/api/session/prompt`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', cookie: cookie ?? '' },
        body: JSON.stringify({
          type: 'client-request',
          rpcId: `a5g4-${preset}-p-${Math.random().toString(36).slice(2, 10)}`,
          method: 'session/prompt',
          payload: { args: { request: { requestId: `a5g4-${preset}-r-${Math.random().toString(36).slice(2, 10)}`, sessionId, mode: 'queue', content: [{ type: 'text', text: `${MK}_${mode.toUpperCase()}_${preset.toUpperCase()}_SETUP This is a setup turn. Do not call any tools. Reply with the single word OK.` }] } } },
        }),
      }, 240_000)
      facts[preset].setupStatus = promptRes.status
      facts[preset].setupBody = redact(JSON.stringify(promptRes.body)).slice(0, 600)
    }

    // A turn only counts when the MARKER reached the mock (the prompt RPC is
    // accepted before the turn completes); without a wire request the wire
    // face is honestly absent.
    await waitFor(120_000, async () => {
      const all = PRESETS.every((preset) => (mock.requests ?? []).some((r) => JSON.stringify(r.body?.messages ?? []).includes(`${MK}_${mode.toUpperCase()}_${preset.toUpperCase()}_SETUP`)))
      return all ? true : false
    }, `both ${mode} preset turns to reach the mock model`)

    // Wait until BOTH agents exist behind the observer (agents.list grows), then read faces.
    const observed = await waitFor(90_000, async () => {
      const f = await fetchJson(`${origin}/__a5g4/facts`).catch(() => null)
      if (f?.status !== 200) return false
      const live = (f.body.agents ?? []).filter((a) => Array.isArray(a.scopedNames))
      return live.length >= PRESETS.length ? f.body : false
    }, 'observer facts with both preset Agents live')
    facts.globalNames = observed.globalNames
    facts.globalPresent = observed.globalPresent
    facts.observations = observed.observations
    // Map each live agent to its preset by wire-capture order: the observer
    // returns agents in creation order; the mock captured each session's first
    // request (tools[] = that agent's wire catalog, user text carries the
    // preset marker).
    const wireByPreset = {}
    const captureDump = []
    for (const r of mock.requests ?? []) {
      const text = JSON.stringify(r.body?.messages ?? [])
      captureDump.push({
        seq: r.seq,
        path: r.path,
        status: r.status,
        hasTools: Array.isArray(r.body?.tools),
        toolsCount: Array.isArray(r.body?.tools) ? r.body.tools.length : null,
        markers: [`${MK}_BASELINE_STANDARD`, `${MK}_BASELINE_MINIMAL`, `${MK}_GLOBALMOUNT_STANDARD`, `${MK}_GLOBALMOUNT_MINIMAL`].filter((m) => text.includes(`${m}_SETUP`)),
        userTexts: (r.body?.messages ?? []).filter((m) => m?.role === 'user').map((m) => String(typeof m.content === 'string' ? m.content : JSON.stringify(m.content)).slice(0, 80)),
      })
      for (const preset of PRESETS) {
        if (text.includes(`${MK}_${mode.toUpperCase()}_${preset.toUpperCase()}_SETUP`) && Array.isArray(r.body?.tools)) {
          wireByPreset[preset] = r.body.tools.map((t) => String(t?.name ?? '')).filter((n) => n !== '').sort()
        }
      }
    }
    facts.captureDump = captureDump
    facts.wireCatalogs = wireByPreset
    const agentsById = {}
    for (const a of observed.agents ?? []) agentsById[a.session] = a
    for (const preset of PRESETS) {
      const sid = facts[preset]?.sessionId
      const a = agentsById[sid]
      facts[preset].scopedNames = a?.scopedNames ?? null
      facts[preset].perName = a?.perName ?? null
    }
    ok = true
    facts.ok = true
    return facts
  } finally {
    writeEvidence(`world-${mode}.partial.json`, facts)
    try { if (host !== null) host.kill() } catch { /* gone */ }
    await new Promise((r) => setTimeout(r, 1000))
    try { writeFileSync(INSTANCE_LOG, redact(readFileSync(INSTANCE_RAW, 'utf8'))); rmSync(INSTANCE_RAW) } catch { /* no log */ }
    if (!KEEP) { try { rmSync(HOME, { recursive: true, force: true }) } catch { /* best effort */ } }
    facts.swept = !existsSync(HOME)
    if (!ok && !KEEP) console.log(`[${mode}] world sweep done (world had failed: ${repoRel(HOME)})`)
  }
}

async function main() {
  console.log(`a5g4 negctl runner stamp=${RUN_STAMP} port=${HOST_PORT}`)

  const head = gitAt(TESTUSE, 'rev-parse', 'HEAD')
  const porcelainBefore = gitAt(TESTUSE, 'status', '--porcelain')
  check('G1', `the test-use host is the pinned pristine 0.2.0-rc.2 runtime @${TEST_USE_BASELINE_SHA.slice(0, 10)} (read-only reuse)`, head === TEST_USE_BASELINE_SHA && porcelainBefore === '', `head=${head.slice(0, 10)} porcelain=${porcelainBefore === '' ? 0 : 'DIRTY'} at ${repoRel(TESTUSE)}`)
  const sharedDiff = spawnSync('git', ['-C', WORKTREE, 'status', '--porcelain', '--', 'packages', 'scripts', 'vitest.config.ts', 'cordis.patch.yml'], { encoding: 'utf8' }).stdout.trim()
  check('G1b', 'IF-5 shared surface (packages/, scripts/, root vitest.config, root cordis.patch.yml) is byte-untouched by this measurement', sharedDiff === '', sharedDiff === '' ? 'porcelain empty' : sharedDiff.split('\n').slice(0, 4).join(' | '))
  const hostFree = await portFree(HOST_PORT)
  let mockPort = 0
  for (const p of [3491, 3492, 3493, 3494, 3495]) { if (await portFree(p)) { mockPort = p; break } }
  check('G2a', `host port ${HOST_PORT} free (self-proved) and a mock port from the 349x family free`, hostFree && mockPort > 0, `hostFree=${hostFree} mock=${mockPort}`)
  const stableBefore = await stableProbe()
  if (!hostFree || mockPort === 0) die('ports not free')

  const MK = `A5G4_${RUN_STAMP.replace(/[^A-Za-z0-9]/g, '')}`
  const mock = await startMockModel({
    port: mockPort,
    log: (m) => console.log(m),
    decide: ({ req }) => {
      const text = JSON.stringify(req?.messages ?? [])
      for (const mode of ['baseline', 'globalmount']) {
        for (const preset of PRESETS) {
          if (text.includes(`${MK}_${mode.toUpperCase()}_${preset.toUpperCase()}_SETUP`)) return { kind: 'text', content: `${MK}_${mode.toUpperCase()}_${preset.toUpperCase()}_OK` }
        }
      }
      return { kind: 'text', content: 'a5g4-mock: unscripted request, completing quietly.' }
    },
  })

  let baseline = null
  let globalmount = null
  try {
    baseline = await runWorld({ mode: 'baseline', mock, MK })
    globalmount = await runWorld({ mode: 'globalmount', mock, MK })
  } finally {
    try { await mock.close() } catch { /* gone */ }
  }
  const stableAfter = await stableProbe()
  check('G2b', ':3080 stable instance untouched (read-only probe before/after)', String(stableBefore) === String(stableAfter), `${String(stableBefore)} → ${String(stableAfter)}, operated=false`)

  writeEvidence('world-baseline.json', baseline)
  writeEvidence('world-globalmount.json', globalmount)

  check('G3', 'both worlds booted, both preset sessions ran a setup turn, observer facts captured', baseline.ok === true && globalmount.ok === true, `baseline.ok=${baseline.ok} globalmount.ok=${globalmount.ok} swept=${baseline.swept}/${globalmount.swept}`)

  const setEq = (a, b) => {
    if (!Array.isArray(a) || !Array.isArray(b)) return false
    const sa = [...new Set(a)].sort(), sb = [...new Set(b)].sort()
    return sa.length === sb.length && sa.every((v, i) => v === sb[i])
  }
  const diff = (a, b) => (Array.isArray(b) ? [...new Set(b)] : []).filter((n) => (Array.isArray(a) ? a : []).includes(n) === false)

  // G4 — the web-face law: with only the observer mounted the trusted GLOBAL face is empty.
  check('G4', 'baseline: the trusted GLOBAL face tools.schemas() is EMPTY on the web bundle (bind-diag law re-proved on a team-free world)', Array.isArray(baseline.globalNames) && baseline.globalNames.length === 0, JSON.stringify(baseline.globalNames))

  // G5 — global mount makes the five names globally visible.
  const g5 = FIVE.every((n) => (globalmount.globalNames ?? []).includes(n))
  check('G5', 'globalmount: the two top-level tool rows put all five native names on the trusted GLOBAL face', g5, JSON.stringify(globalmount.globalNames))

  // G6 — the `standard` non-team session: catalog unchanged (its own preset copy shadows the global layer).
  const stdA = baseline.standard?.scopedNames ?? null
  const stdB = globalmount.standard?.scopedNames ?? null
  const stdWireA = baseline.wireCatalogs?.standard ?? null
  const stdWireB = globalmount.wireCatalogs?.standard ?? null
  check('G6', 'negative control (shadowing preset): the standard non-team session model-facing catalog is set-IDENTICAL across the two worlds (registry face AND wire face)',
    setEq(stdA, stdB) && setEq(stdWireA, stdWireB),
    `registry delta=+${JSON.stringify(diff(stdA, stdB))}/-${JSON.stringify(diff(stdB, stdA))} wire delta=+${JSON.stringify(diff(stdWireA, stdWireB))}`)

  // G7 — the `minimal` non-team session: MEASURED EXPANSION (no preset copy to shadow).
  const minA = baseline.minimal?.scopedNames ?? null
  const minB = globalmount.minimal?.scopedNames ?? null
  const minWireA = baseline.wireCatalogs?.minimal ?? null
  const minWireB = globalmount.wireCatalogs?.minimal ?? null
  const added = diff(minA, minB)
  const addedWire = diff(minWireA, minWireB)
  const g7 = FS_FOUR.every((n) => added.includes(n)) && FS_FOUR.every((n) => addedWire.includes(n))
  check('G7', 'EXPANSION MEASURED: the minimal non-team session (no tool-fs/tool-bash in its preset) GAINS read/write/edit/read_image in BOTH the registry-scoped and the wire catalog when the global rows are mounted — no public row syntax gates top-level rows by agentPreset/policy',
    g7, `registry +${JSON.stringify(added)} wire +${JSON.stringify(addedWire)} (minimal baseline catalog=${JSON.stringify(minA)})`)

  // G8 — the literal negative control is impossible: the global face is ONE process-wide view.
  const g8 = (baseline.globalNames ?? []).length === 0 && (globalmount.globalNames ?? []).length > 0
  check('G8', 'the literal negative control "a non-team session globalNames unchanged" cannot hold with a global mount: the trusted face is a single process-wide registry view that flipped []→' + JSON.stringify(globalmount.globalNames) + ' for EVERY session in the process',
    g8, `baseline=${JSON.stringify(baseline.globalNames)} globalmount=${JSON.stringify(globalmount.globalNames)}`)

  const red = CRITERIA.filter((c) => !c.pass)
  writeEvidence('criteria.json', { runStamp: RUN_STAMP, criteria: CRITERIA, baseline: { globalNames: baseline.globalNames }, globalmount: { globalNames: globalmount.globalNames } })
  console.log(`VERDICT ${red.length === 0 ? 'GREEN' : `RED (${red.map((c) => c.id).join(',')})`}`)
  process.exit(red.length === 0 ? 0 : 2)
}

main().then(
  () => process.exit(0),
  async (error) => {
    console.log(`FATAL ${redact(String(error?.stack ?? error)).split('\n').slice(0, 6).join(' | ')}`)
    writeEvidence('fatal.json', { error: redact(String(error?.message ?? error)) })
    process.exit(1)
  },
)
