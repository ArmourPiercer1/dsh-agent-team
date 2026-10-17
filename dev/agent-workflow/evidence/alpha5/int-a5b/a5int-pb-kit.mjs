#!/usr/bin/env node
/**
 * a5int-pb-kit.mjs — P-B-R2 LIVE positive-control runner (pb §6 binding feed).
 *
 * Boots a TEST Host on port 3184 (this lane's self-proved-free port; :3080 is
 * probed read-only before/after and never touched), DSH_HOME =
 * `tests/homes/a5int-pb-<stamp>` (TEST_METHODS §7, deleted at teardown unless
 * --keep), mounts `a5int-pb-row.mjs` through the PUBLIC profile-patch seam on
 * the pinned pristine host @639ed01539 (porcelain-checked before AND after),
 * creates THREE real sessions on the scripted mock model, and reads the live
 * process back through the row's own routes.
 *
 * The one name `read`, three live answers (the §6 wiring as ONE story):
 *   red    un-fed name on a published guard   → VERBATIM refusal, Body never runs
 *   green  placement + feed + bind + publish  → the placed Body RUNS, fixture
 *          bytes ride the wire back to the model; then drift → refusal (+
 *          mutated Body never runs), moved-back → STILL refusal (permanent
 *          withdrawal), explicit re-bind → runs again
 *   realm  placement + cross-realm feed entry → typed bind refusal, nothing
 *          publishes, the Body never runs; a wire call is refused too
 * Plus the GLUE-6 bounding leg: a PLANE-shape String-render def that BINDS
 * (placed, un-fed → the production placement-attribution path), DISPATCHES
 * (Body runs — dispatcher layer green) and whose host result-assembly answer
 * is recorded VERBATIM (the `content.some is not a function` crash belongs
 * to GLUE-6's parallel fix — cited, never patched here).
 *
 * Honesty rules: criteria computed from LIVE route reads + mock wire captures
 * at observation time; a missing leg FAILS, nothing back-filled; the launch
 * token is redacted at capture.
 *
 * EXIT: 0 all criteria pass (GREEN) · 2 a criterion failed (RED) · 1 fatal.
 */
import { spawn, spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { closeSync, existsSync, mkdirSync, openSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { createServer } from 'node:net'
import { dirname, join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

import { startMockModel } from '../../../../../packages/tools/harness/mock-deepseek.mjs'
import { TEST_USE_BASELINE_SHA, CLIENT_COMMIT_HASH, testUseTree, homeDir } from '../../../../../tests/paths.mjs'

const args = process.argv.slice(2)
const argValue = (n, d) => { const i = args.indexOf(`--${n}`); return i === -1 ? d : args[i + 1] }
const KEEP = args.includes('--keep')
const HERE = dirname(new URL(import.meta.url).pathname)
const WORKTREE = resolve(argValue('worktree', resolve(HERE, '..', '..', '..', '..', '..')))
const RUN_STAMP = new Date().toISOString().slice(0, 19).replace(/[:]/g, '-') + 'Z'
const EVIDENCE_DIR = resolve(argValue('evidence-dir', join(HERE, 'runs', RUN_STAMP)))
mkdirSync(EVIDENCE_DIR, { recursive: true })

const HOST_PORT = Number(argValue('port', 3184))
const TESTUSE_CANDIDATES = [
  argValue('testuse', ''),
  join(WORKTREE, 'tests', 'deepseek-harness-test-use'),
  '/srv/workspace/dsh-plugins/dsh-agent-team/.worktrees/dsh-020rc2-upgrade/tests/deepseek-harness-test-use',
  '/srv/workspace/dsh-plugins/dsh-agent-team/tests/deepseek-harness-test-use',
].filter((p) => p !== '' && existsSync(p))
const TESTUSE = resolve(testUseTree(WORKTREE) !== '' && existsSync(testUseTree(WORKTREE)) ? testUseTree(WORKTREE) : (TESTUSE_CANDIDATES[0] ?? ''))
const HOST_BIN = join(TESTUSE, 'apps', 'cli', 'lib', 'bin.js')
const DIST_PACKAGES = join(WORKTREE, 'packages', 'runtime', 'dist', 'packages')
const ROW_PATH = join(HERE, 'a5int-pb-row.mjs')
const WORLD_ROOT = homeDir(WORKTREE, `a5int-pb-${RUN_STAMP}`)
const HOME = WORLD_ROOT
const REPO = join(HOME, 'repo')
const LEDGER = join(EVIDENCE_DIR, 'assembly-ledger.jsonl')
const INSTANCE_RAW = join(EVIDENCE_DIR, 'instance.raw.log')
const INSTANCE_LOG = join(EVIDENCE_DIR, 'instance.log')
const TOKEN = `A5PBR2TOK-${createHash('sha256').update(String(Math.random()) + RUN_STAMP).digest('hex').slice(0, 12)}`
const VERBATIM_NO_FALLBACK = 'team tool guard: the Tool Binding for "read" cannot be verified at dispatch time (no fallback to the native body)'

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
function gitAt(dir, ...a) { return spawnSync('git', ['-C', dir, ...a], { encoding: 'utf8' }).stdout.trim() }
const stableProbe = async () => {
  try { const r = await fetch('http://127.0.0.1:3080/', { redirect: 'manual', signal: AbortSignal.timeout(5000) }); return r.status } catch { return 'unreachable' }
}

let host = null
let mock = null
let finalStatus = 'RUNNING'
async function finalize(status) {
  finalStatus = status
  try { if (host?.child !== undefined) host.child.kill() } catch { /* gone */ }
  try { if (mock?.close !== undefined) await mock.close() } catch { /* gone */ }
  try {
    const raw = readFileSync(INSTANCE_RAW, 'utf8')
    writeFileSync(INSTANCE_LOG, redact(raw))
    rmSync(INSTANCE_RAW)
  } catch { /* no log */ }
  writeEvidence('criteria.json', { status: finalStatus, criteria: CRITERIA })
  if (!KEEP) { try { rmSync(HOME, { recursive: true, force: true }) } catch { /* best effort */ } }
}
function writeEvidence(name, value) {
  writeFileSync(join(EVIDENCE_DIR, name), typeof value === 'string' ? value : JSON.stringify(value, null, 2) + '\n')
}

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
const normText = (t) => String(t ?? '').replace(/\s+/g, ' ').trim()

const PHASES = {
  1: { lane: 'red', tool: 'read', args: () => ({ path: join(REPO, 'target.txt') }) },
  2: { lane: 'green', tool: 'read', args: () => ({ path: join(REPO, 'target.txt') }) },
  3: { lane: 'green', tool: 'read', args: () => ({ path: join(REPO, 'target.txt') }) },
  4: { lane: 'green', tool: 'read', args: () => ({ path: join(REPO, 'target.txt') }) },
  5: { lane: 'green', tool: 'read', args: () => ({ path: join(REPO, 'target.txt') }) },
  6: { lane: 'green', tool: 'a5pbr2_render_probe', args: () => ({}) },
  7: { lane: 'realm', tool: 'read', args: () => ({ path: join(REPO, 'target.txt') }) },
}

async function main() {
  console.log(`a5pbr2 runner stamp=${RUN_STAMP} port=${HOST_PORT}`)

  const head = gitAt(TESTUSE, 'rev-parse', 'HEAD')
  const porcelainBefore = gitAt(TESTUSE, 'status', '--porcelain')
  check('C-PIN', 'the test-use host is the pinned pristine 0.2.0-rc.2 runtime @639ed01539, porcelain clean', head === TEST_USE_BASELINE_SHA && porcelainBefore === '', `head=${head.slice(0, 10)} porcelain=${porcelainBefore === '' ? 0 : 'DIRTY'}`)
  const hostFree = await portFree(HOST_PORT)
  let mockPort = 0
  for (const p of [3496, 3497, 3498, 3494, 3495]) { if (await portFree(p)) { mockPort = p; break } }
  check('C-PORTS', `host port ${HOST_PORT} self-proved free + a mock port from the 349x family free`, hostFree && mockPort > 0, `hostFree=${hostFree} mock=${mockPort}`)
  const stableBefore = await stableProbe()
  check('C-3080-BEFORE', 'the stable :3080 instance answers read-only before this run (probe only, never touched)', stableBefore !== 'unreachable', `status=${String(stableBefore)}`)
  if (!hostFree || mockPort === 0) die('ports not free')
  if (!existsSync(join(DIST_PACKAGES, 'runtime/tool-dispatch/install.js'))) die(`dist mirror missing at ${DIST_PACKAGES}`)

  // ── world + patch (public profile-patch seam only; zero production rows) ──
  mkdirSync(REPO, { recursive: true })
  mkdirSync(join(HOME, 'profiles', 'web'), { recursive: true })
  writeFileSync(join(REPO, 'target.txt'), `a5pbr2 governed-read fixture\nline2 ${TOKEN} line3\n`)
  writeFileSync(join(HOME, 'profiles', 'web', 'cordis.patch.yml'), [
    `# a5pbr2 P-B §6 binding-feed live patch (run ${RUN_STAMP}): the kit assembly row via the public profile-patch seam; zero production-row mounts in this world (the W5 world shape).`,
    '- insert:',
    '    - id: a5int-pb-binding-feed',
    `      name: ${JSON.stringify(pathToFileURL(ROW_PATH).href)}`,
    '      config: {}',
    '',
  ].join('\n'))

  // ── mock model: phase-stateless decider ───────────────────────────────────
  const bodyOf = (rec) => (rec !== null && typeof rec === 'object' ? ('body' in rec ? (rec.body ?? null) : rec) : null)
  const messagesOf = (req) => bodyOf(req)?.messages ?? []
  const textOf = (m) => (typeof m?.content === 'string' ? m.content : JSON.stringify(m.content ?? ''))
  const toolResultsIn = (m) => {
    const out = []
    if (Array.isArray(m?.content)) {
      for (const b of m.content) {
        if (b?.type !== 'tool_result') continue
        const c = b.content
        if (typeof c === 'string') out.push(c)
        else if (Array.isArray(c)) out.push(c.map((x) => x?.text ?? '').join(''))
        else out.push(JSON.stringify(c ?? ''))
      }
    }
    return out.map(normText)
  }
  const wire = { red: [], green: [], realm: [] }
  const toolCall = (name, a) => ({ kind: 'tool-call', toolCalls: [{ id: `call-${Math.random().toString(36).slice(2, 10)}`, name, arguments: a }] })
  mock = await startMockModel({
    port: mockPort,
    log: () => {},
    decide: ({ req }) => {
      const msgs = messagesOf(req)
      const text = msgs.map(textOf).join(' ')
      const marks = [...text.matchAll(/A5PBR2P([1-7])\b/g)]
      const m = marks.length > 0 ? marks[marks.length - 1] : null // the CURRENT phase: the LAST marker in history, not the first
      if (m === null) {
        if (!text.includes('A5PBR2')) return { kind: 'text', content: 'a5int-pb-mock: unscripted request, completing quietly.' }
        return { kind: 'text', content: 'A5PBR2 SETUP OK' }
      }
      const n = Number(m[1])
      const last = msgs[msgs.length - 1]
      const results = toolResultsIn(last)
      if (results.length > 0) {
        for (const r of results) wire[PHASES[n].lane].push({ phase: n, at: new Date().toISOString(), result: r })
        return { kind: 'text', content: `A5PBR2P${n}_DONE` }
      }
      const ph = PHASES[n]
      return toolCall(ph.tool, ph.args())
    },
  })

  // ── boot the Host (TEST_METHODS §2 start chain) ───────────────────────────
  const outFd = openSync(INSTANCE_RAW, 'a')
  const child = spawn(process.execPath, [HOST_BIN, 'web', '--port', String(HOST_PORT), '--no-open'], {
    cwd: TESTUSE,
    stdio: ['ignore', outFd, outFd],
    env: {
      ...process.env,
      DSH_HOME: HOME,
      DSH_CLIENT_COMMIT_HASH: CLIENT_COMMIT_HASH,
      DEEPSEEK_BASE_URL: `http://127.0.0.1:${mockPort}`,
      DEEPSEEK_API_KEY: 'a5int-pb-mock-key',
      A5PBR2_DIST: DIST_PACKAGES,
      A5PBR2_LEDGER: LEDGER,
      A5PBR2_WORLD: HOME,
      A5PBR2_TOKEN: TOKEN,
    },
  })
  host = { child }
  child.on('exit', (code, signal) => console.log(`host exited code=${String(code)} signal=${String(signal)}`))
  try {
    const boot = await waitFor(90_000, () => {
      try {
        const mm = BOOT_MARKER.exec(readFileSync(INSTANCE_RAW, 'utf8'))
        return mm === null ? false : mm
      } catch { return false }
    }, 'host boot marker')
    const origin = `http://127.0.0.1:${boot[1]}`
    const token = boot[2]
    const auth = await fetch(`${origin}/?token=${token}`, { redirect: 'manual', signal: AbortSignal.timeout(30_000) })
    const cookie = auth.headers.get('set-cookie')
    check('C-BOOT', `the test Host booted on port ${HOST_PORT} with the token gate live (303 + set-cookie)`, auth.status === 303 && cookie !== null, `status=${auth.status}`)
    await waitFor(30_000, async () => {
      const h = await fetchJson(`${origin}/__a5pbr2/health`).catch(() => null)
      return h?.status === 200 && h.body.applied === true ? h : false
    }, 'row apply via /__a5pbr2/health')
    check('C-ROW', 'the kit row applied inside the live host and imported the COMMITTED dist tool-dispatch barrel (feed face present)', true)

    // ── three sessions, one setup turn each (an Agent must exist first) ──
    const apiPrompt = (sessionId, text, tag) => fetchJson(`${origin}/api/session/prompt`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie: cookie ?? '' },
      body: JSON.stringify({
        type: 'client-request',
        rpcId: `${tag}-${Math.random().toString(36).slice(2, 10)}`,
        method: 'session/prompt',
        payload: { args: { request: { requestId: `${tag}-r-${Math.random().toString(36).slice(2, 10)}`, sessionId, mode: 'queue', content: [{ type: 'text', text }] } } },
      }),
    }, 240_000)
    const sessions = {}
    for (const role of ['red', 'green', 'realm']) {
      const created = await fetchJson(`${origin}/api/session/create`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', cookie: cookie ?? '' },
        body: JSON.stringify({ type: 'client-request', rpcId: `a5int-pb-c-${Math.random().toString(36).slice(2, 10)}`, method: 'session/create', payload: { args: { request: {} } } }),
      }, 30_000)
      const sessionId = created.body?.result?.value?.sessionId ?? created.body?.value?.sessionId ?? null
      if (typeof sessionId !== 'string' || sessionId === '') die(`session/create failed for role ${role}: status=${created.status}`)
      sessions[role] = sessionId
      const setup = await apiPrompt(sessionId, `A5PBR2 setup turn (${role}). Do not call any tools. Reply with the single word OK.`, `a5int-pb-setup-${role}`)
      if (setup.status !== 200) die(`setup turn failed for ${role}: ${setup.status}`)
    }
    check('C-SESSIONS', 'three real sessions created and driven (an Agent exists behind each)', Object.keys(sessions).length === 3, JSON.stringify(Object.keys(sessions)))

    // ── assemblies (the row runs the whole §4.1 order per role) ──
    const facts = {}
    for (const role of ['red', 'green', 'realm']) {
      const asmRes = await fetchJson(`${origin}/__a5pbr2/assemble`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ sessionId: sessions[role], role }),
      }, 60_000)
      facts[role] = asmRes.body ?? { status: asmRes.status }
    }
    writeEvidence('assemble-facts.json', facts)
    check('C-RED-ASSEMBLY', 'red world assembled: guard installed, published, `read` observed UNBOUND (no feed, measured empty global face)', facts.red?.fact?.installOk === true && facts.red?.fact?.publishedOk === true, JSON.stringify(facts.red?.fact?.guardProbeRead ?? facts.red).slice(0, 160))
    check('C-GREEN-ASSEMBLY', 'green world assembled: placement + realm-paired install + FEED-verified bind + publish', facts.green?.fact?.bindOwnOk === true && facts.green?.fact?.publishedOk === true && facts.green?.fact?.verified === true && facts.green?.fact?.feedVerifiedObserved === true, `verified=${String(facts.green?.fact?.verified)} origin=${String(facts.green?.fact?.origin)}`)
    check('C-REALM-REFUSAL', 'realm world: cross-realm feed entry typed bind REFUSAL (Realm 不可混淆), nothing published', facts.realm?.fact?.bindOwnOk === false && facts.realm?.fact?.refusedObserved === true, String(facts.realm?.fact?.bindError?.message ?? '').slice(0, 140))

    // ── the wire phases ──
    const promptPhase = async (n, role) => {
      const res = await apiPrompt(sessions[role], `A5PBR2P${n} phase ${n} (${role}): call the requested tool exactly once.`, `a5int-pb-p${n}`)
      await waitFor(60_000, () => wire[PHASES[n].lane].some((e) => e.phase === n) ? true : false, `wire capture for phase ${n}`)
      if (res.status !== 200) die(`phase ${n} prompt status ${res.status}`)
      return wire[PHASES[n].lane].filter((e) => e.phase === n).at(-1).result
    }
    const r1 = await promptPhase(1, 'red')
    check('C-RED-WIRE', 'live RED, on the wire: un-fed `read` meets the VERBATIM refusal', r1.includes('no fallback to the native body') && r1.includes('cannot be verified at dispatch time'), r1.slice(0, 160))
    const stateAfterRed = await fetchJson(`${origin}/__a5pbr2/state`)
    const redLabel = Object.keys(stateAfterRed.body.assemblies).find((k) => stateAfterRed.body.assemblies[k].role === 'red')
    check('C-RED-ZERO-FALLBACK', 'the un-fed double Body NEVER executed (no-fallback witness on the live host)', stateAfterRed.body.assemblies[redLabel].bodyCounts.double === 0, `double=${String(stateAfterRed.body.assemblies[redLabel].bodyCounts.double)}`)

    const r2 = await promptPhase(2, 'green')
    check('C-GREEN-POSITIVE', 'live POSITIVE (§6 reachability): the PLACED, FEED-BOUND read RAN for real — fixture bytes + TOKEN rode the wire back', r2.includes('TOKEN-SEEN') && r2.includes(TOKEN), r2.slice(0, 180))
    const stateAfterGreen = await fetchJson(`${origin}/__a5pbr2/state`)
    const greenLabel = Object.keys(stateAfterGreen.body.assemblies).find((k) => stateAfterGreen.body.assemblies[k].role === 'green')
    check('C-GREEN-BODY-1', 'the placed Body executed exactly once (dispatcher abstained on the feed-verified Binding)', stateAfterGreen.body.assemblies[greenLabel].bodyCounts.placed === 1, `placed=${String(stateAfterGreen.body.assemblies[greenLabel].bodyCounts.placed)}`)

    const step = async (s) => {
      const res = await fetchJson(`${origin}/__a5pbr2/step`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ role: 'green', step: s }) }, 30_000)
      if (res.status !== 200) die(`step ${s} failed: ${JSON.stringify(res.body).slice(0, 200)}`)
      return res.body
    }
    await step('drift')
    const r3 = await promptPhase(3, 'green')
    check('C-DRIFT-REFUSAL', 'live §6 semantics 1: after the placement moved, `read` meets the DRIFT refusal', r3.includes('definition drift') || r3.includes('now resolves to a different ToolDefinition'), r3.slice(0, 160))
    const stateAfterDrift = await fetchJson(`${origin}/__a5pbr2/state`)
    check('C-DRIFT-V2-ZERO', 'the mutated Body never ran', stateAfterDrift.body.assemblies[greenLabel].bodyCounts.v2 === 0, `v2=${String(stateAfterDrift.body.assemblies[greenLabel].bodyCounts.v2)}`)

    await step('restore')
    const r4 = await promptPhase(4, 'green')
    check('C-MOVED-BACK-REFUSAL', 'revocation is permanent: the moved-back identity does NOT re-admit (still refused; only an explicit re-bind restores)', r4.includes('definition drift') || r4.includes('now resolves to a different ToolDefinition'), r4.slice(0, 160))

    await step('rebind')
    const r5 = await promptPhase(5, 'green')
    check('C-REBIND-RUNS', 'the explicit re-bind by the owning assembly is the documented way back: the placed Body runs again, bytes on the wire', r5.includes('TOKEN-SEEN'), r5.slice(0, 120))
    const stateAfterRebind = await fetchJson(`${origin}/__a5pbr2/state`)
    check('C-REBIND-BODY-2', 'the placed Body count advanced to 2 (exactly the two allowed legs)', stateAfterRebind.body.assemblies[greenLabel].bodyCounts.placed === 2, `placed=${String(stateAfterRebind.body.assemblies[greenLabel].bodyCounts.placed)}`)

    const g6 = await step('glue6')
    let r6 = null
    let glue6Ok = false
    if (g6?.fact?.probeBound === true) {
      r6 = await promptPhase(6, 'green')
      const stateAfterG6 = await fetchJson(`${origin}/__a5pbr2/state`)
      glue6Ok = stateAfterG6.body.assemblies[greenLabel].bodyCounts.renderProbe === 1
    }
    check('C-GLUE6-BOUNDED', 'GLUE-6 bounding leg: the String-render PLANE-shape def DISPATCHED and its Body RAN (dispatcher layer green); the host result-assembly answer is recorded VERBATIM below — the crash belongs to GLUE-6 (#308), cited not patched', glue6Ok, `probeBound=${String(g6?.fact?.probeBound)} result=${String(r6).slice(0, 120)}`)

    const r7 = await promptPhase(7, 'realm')
    check('C-REALM-WIRE', 'realm world on the wire: with the bind refused, `read` is refused too and the placed Body never ran', !r7.includes('REALM-BODY-RAN') && (r7.includes('cannot be verified') || r7.includes('ungoverned') || r7.includes('guard') || r7.includes('refus')), r7.slice(0, 160))
    const stateEnd = await fetchJson(`${origin}/__a5pbr2/state`)
    const realmLabel = Object.keys(stateEnd.body.assemblies).find((k) => stateEnd.body.assemblies[k].role === 'realm')
    check('C-REALM-ZERO-BODY', 'the realm-world placement Body never executed', stateEnd.body.assemblies[realmLabel].bodyCounts.placed === 0, `placed=${String(stateEnd.body.assemblies[realmLabel].bodyCounts.placed)}`)

    writeEvidence('wire-capture.json', wire)
    writeEvidence('row-state.json', stateEnd.body)
    const globalFace = stateEnd.body.assemblies[redLabel]?.globalFaceNames ?? null
    check('C-GLOBAL-FACE', 'the MEASURED unscoped global face carries nothing governable (the bind-diag law, re-measured live)', Array.isArray(globalFace) && !globalFace.includes('read'), JSON.stringify(globalFace))

    await finalize('DONE')
  } catch (error) {
    writeEvidence('fatal.json', { error: String(error?.stack ?? error).slice(0, 1200) })
    await finalize('FATAL')
    throw error
  }

  const failed = CRITERIA.filter((c) => !c.pass)
  console.log(`verdict=${failed.length === 0 ? 'GREEN' : 'RED'} pass=${String(CRITERIA.length - failed.length)} fail=${String(failed.length)} evidence=${EVIDENCE_DIR}`)
  const stableAfter = await stableProbe()
  check('C-3080-AFTER', `the stable :3080 instance answers exactly as before (${String(stableBefore)}), untouched`, stableAfter === stableBefore, `status=${String(stableAfter)}`)
  const porcelainAfter = gitAt(TESTUSE, 'status', '--porcelain')
  check('C-PIN-AFTER', 'the pinned test-use runtime is still porcelain-clean', porcelainAfter === '', porcelainAfter.split('\n')[0] ?? 'clean')
  const portFreed = await portFree(HOST_PORT)
  check('C-PORT-AFTER', `port ${HOST_PORT} is free again (host torn down)`, portFreed, `free=${String(portFreed)}`)
  writeEvidence('criteria.json', { status: finalStatus, criteria: CRITERIA })
  writeFileSync(join(EVIDENCE_DIR, 'verdict.txt'), `stamp=${RUN_STAMP} verdict=${failed.length === 0 ? 'GREEN' : 'RED'} pass=${String(CRITERIA.length - failed.length)} fail=${String(failed.length)}\n`)
  process.exit(failed.length === 0 ? 0 : 2)
}

main().catch((error) => {
  console.error(String(error?.stack ?? error))
  process.exit(1)
})
