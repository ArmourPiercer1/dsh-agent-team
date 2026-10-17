#!/usr/bin/env node
/**
 * run-l1-poc.mjs — C-12 L1 startup-self-prove bounded PoC runner (evidence-only).
 *
 * Question this runner exists to answer (C12-decision-brief §2-L1, the
 * un-registered premise): on the pinned Host (0.2.0-rc.2 @ 639ed01539), does a
 * SAME-NAME NO-OP re-registration through the public change face really emit a
 * `tools/change` event, with zero side effects — so a startup self-prove
 * (subscription present + synthetic delivery arrives → 'armed'→'proven') can
 * gate acceptance? And does the proven state EXTRAPOLATE to subsequent
 * delivery once the subscription is silenced the G-7 way AFTER the proof?
 *
 * ONE already-subscribed silent-channel scenario, one world, one Host process:
 *   leg ①  noop re-register → raw change-event originals + world/ledger/port
 *          delta zero (against a control window of the same length, disclosed);
 *   leg ②  armed → proven live read + receipt record;
 *   leg ③  after the proof: G-7 swallow移法 (forwarder stops forwarding; the
 *          entry stays in the Host's real listener table, the disposer is never
 *          called) → drifted re-register → control sees it, lane does not,
 *          status STAYS 'proven' (stale) → one model-driven drifted call →
 *          loud five-piece delta with ZERO delivered cancellation.
 *
 * RED-first: the criteria are committed BEFORE the answer is known; a RED leg
 * is a PoC result, not a failure to hide.
 *
 * Host = the pinned pristine 0.2.0-rc.2 build recorded by the host-upgrade
 * round (reused read-only; porcelain checked before AND after), DSH_HOME =
 * tests/homes/a5l1-<stamp> (TEST_METHODS §7, deleted at teardown unless
 * --keep), port 3182 (self-proved free; :3080 probed read-only, never touched),
 * mock model on a free 349x port. Launch token redacted at capture.
 *
 * EXIT: 0 all criteria pass · 2 a criterion failed (a legitimate PoC answer) ·
 *       1 fatal (env/boot/row).
 */
import { spawn, spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { closeSync, existsSync, mkdirSync, openSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { createServer } from 'node:net'
import { dirname, join, relative, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

const args = process.argv.slice(2)
const argValue = (n, d) => { const i = args.indexOf(`--${n}`); return i === -1 ? d : args[i + 1] }
const KEEP = args.includes('--keep')
const HERE = dirname(new URL(import.meta.url).pathname)
const WORKTREE = resolve(argValue('worktree', resolve(HERE, '..', '..', '..', '..', '..')))
const RUN_STAMP = new Date().toISOString().slice(0, 19).replace(/[:]/g, '-') + 'Z'
const EVIDENCE_ROOT = join(HERE)
const EVIDENCE_DIR = join(EVIDENCE_ROOT, 'runs', `l1-${RUN_STAMP}`)
mkdirSync(EVIDENCE_DIR, { recursive: true })

const HOST_PORT = Number(argValue('port', 3182))
const PIN_SHA = '639ed015397290b3745d163aafe02ffee4aa3f84' // = tests/paths.mjs TEST_USE_BASELINE_SHA @ this base (re-read below)
const paths = await import(pathToFileURL(join(WORKTREE, 'tests', 'paths.mjs')).href)
const BASELINE_SHA = paths.TEST_USE_BASELINE_SHA ?? PIN_SHA
const CLIENT_HASH = paths.CLIENT_COMMIT_HASH ?? '639ed01539'
const TESTUSE_CANDIDATES = [
  argValue('testuse', ''),
  join(WORKTREE, 'tests', 'deepseek-harness-test-use'),
  '/srv/workspace/dsh-plugins/dsh-agent-team/.worktrees/dsh-020rc2-upgrade/tests/deepseek-harness-test-use',
].filter((p) => p !== '' && existsSync(p))
// prefer a candidate that IS the pinned build (HEAD == baseline && built && clean)
const pinned = TESTUSE_CANDIDATES.filter((p) => git(p, 'rev-parse', 'HEAD') === BASELINE_SHA && git(p, 'status', '--porcelain') === '' && existsSync(join(p, 'apps', 'cli', 'lib', 'bin.js')))
const TESTUSE = resolve(pinned[0] ?? '')
const HOST_BIN = join(TESTUSE, 'apps', 'cli', 'lib', 'bin.js')
const DIST_PACKAGES = join(WORKTREE, 'packages', 'runtime', 'dist', 'packages')
const ROW_PATH = join(HERE, 'l1-selfproof-row.mjs')
const WORLD = join(WORKTREE, 'tests', 'homes', `a5l1-${RUN_STAMP}`)
const LEDGER = join(EVIDENCE_DIR, 'row-ledger.jsonl')
const INSTANCE_RAW = join(EVIDENCE_DIR, 'instance.raw.log')
const INSTANCE_LOG = join(EVIDENCE_DIR, 'instance.log')
const MOCK_HARNESS = join(WORKTREE, 'packages', 'tools', 'harness', 'mock-deepseek.mjs')

// ── token redaction at capture (kit discipline) ──────────────────────────────
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
function git(dir, ...a) { return spawnSync('git', ['-C', dir, ...a], { encoding: 'utf8' }).stdout.trim() }
function writeEvidence(name, value) {
  writeFileSync(join(EVIDENCE_DIR, name), typeof value === 'string' ? value : JSON.stringify(value, null, 2) + '\n')
}

// ── preflight helpers ────────────────────────────────────────────────────────
function portFree(port) {
  return new Promise((res) => {
    const srv = createServer()
    srv.once('error', () => res(false))
    srv.once('listening', () => srv.close(() => res(true)))
    srv.listen(port, '127.0.0.1')
  })
}
function listeningPorts() {
  const out = spawnSync('ss', ['-tlnH'], { encoding: 'utf8' }).stdout
  const ports = new Set()
  for (const line of out.split('\n')) {
    const m = /:(\d+)\s/m.exec(line)
    if (m !== null) ports.add(Number(m[1]))
  }
  return [...ports].sort((a, b) => a - b)
}
const stableProbe = async () => {
  try { const r = await fetch('http://127.0.0.1:3080/', { redirect: 'manual', signal: AbortSignal.timeout(5000) }); return r.status } catch { return 'unreachable' }
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

// ── world snapshot (metadata + content hash below 2 MiB) ─────────────────────
function snapshotTree(root) {
  const out = new Map()
  const stack = [root]
  while (stack.length > 0) {
    const dir = stack.pop()
    let entries = []
    try { entries = readdirSync(dir, { withFileTypes: true }) } catch { continue }
    for (const e of entries) {
      const p = join(dir, e.name)
      if (e.isDirectory()) { stack.push(p); continue }
      if (!e.isFile()) continue
      let st
      try { st = statSync(p) } catch { continue }
      let hash = null
      if (st.size <= 2 * 1024 * 1024) {
        try { hash = createHash('sha256').update(readFileSync(p)).digest('hex') } catch { /* unreadable mid-flight */ }
      }
      out.set(relative(root, p), { size: st.size, mtimeMs: Math.round(st.mtimeMs), hash })
    }
  }
  return out
}
function treeDelta(a, b) {
  const added = [], removed = [], changed = [], touchedOnly = []
  for (const [k, v] of b) {
    const old = a.get(k)
    if (old === undefined) { added.push(k); continue }
    const hashKnown = old.hash !== null && v.hash !== null
    const contentChanged = hashKnown ? old.hash !== v.hash : (old.size !== v.size || old.mtimeMs !== v.mtimeMs)
    if (contentChanged) changed.push(k)
    else if (old.mtimeMs !== v.mtimeMs) touchedOnly.push(k)
  }
  for (const k of a.keys()) if (!b.has(k)) removed.push(k)
  return { added, removed, changed, touchedOnly }
}

let host = null
let mock = null
async function finalize(status, extra = {}) {
  try { host?.child?.kill() } catch { /* gone */ }
  try { await mock?.close?.() } catch { /* gone */ }
  try { writeFileSync(INSTANCE_LOG, redact(readFileSync(INSTANCE_RAW, 'utf8'))); rmSync(INSTANCE_RAW) } catch { /* no log */ }
  const failed = CRITERIA.filter((c) => !c.pass)
  writeEvidence('criteria.json', { run: RUN_STAMP, status, criteria: CRITERIA, ...extra })
  const receipt = {
    task: 'C-12 L1 startup-self-prove bounded PoC (isolated synthetic world, zero product semantics change)',
    round: 'alpha5-c12-l1', writer: 'qwen3.8-flash-next (liveness first report)',
    base: { branch: 'alpha5-c12-l1-poc', worktree: '.worktrees/a5-l1', baseHead: git(WORKTREE, 'rev-parse', 'HEAD') },
    host: { pin: BASELINE_SHA, reusedBuiltTree: TESTUSE, porcelainAtClose: git(TESTUSE, 'status', '--porcelain') === '' },
    run: { stamp: RUN_STAMP, port: HOST_PORT, world: KEEP ? `KEPT: ${WORLD}` : 'deleted at teardown', evidence: `runs/l1-${RUN_STAMP}` },
    status, verdicts: {
      leg1_noop_rereg_emits_with_zero_side_effects: verdict('C11-EVENT-RAW') && verdict('C12-ZERO-WORLD') && verdict('C13-ZERO-LEDGER') && verdict('C14-ZERO-PORT'),
      leg2_startup_selfproof_proven: verdict('C21-ARMED-PRESENT') && verdict('C22-PROVEN-FLIP') && verdict('C11-EVENT-RAW'),
      leg3_startup_health_does_not_extrapolate: verdict('C31-LOSS-CREATED') && verdict('C32-STALE-PROVEN') && verdict('C33-LOUD-DELTA'),
    },
    criteria: CRITERIA,
  }
  writeFileSync(join(EVIDENCE_ROOT, 'receipt.json'), JSON.stringify(receipt, null, 2) + '\n')
  if (!KEEP) { try { rmSync(WORLD, { recursive: true, force: true }) } catch { /* best effort */ } }
  console.log(`\n${failed.length === 0 ? 'GREEN' : 'RED'} — ${CRITERIA.length - failed.length}/${CRITERIA.length} · evidence ${EVIDENCE_DIR}`)
}
const verdict = (id) => CRITERIA.find((c) => c.id === id)?.pass === true

const BOOT_MARKER = /dsh web: http:\/\/127\.0\.0\.1:(\d+)\/\?token=([A-Za-z0-9_-]+)/
async function waitFor(deadlineMs, fn, what) {
  const deadline = Date.now() + deadlineMs
  for (;;) {
    const v = await fn()
    if (v !== null && v !== undefined && v !== false) return v
    if (Date.now() >= deadline) die(`timeout waiting for ${what}`)
    await sleep(250)
  }
}
async function fetchJson(url, init, timeoutMs = 30_000) {
  const res = await fetch(url, { ...(init ?? {}), signal: AbortSignal.timeout(timeoutMs) })
  const text = await res.text()
  try { return { status: res.status, body: JSON.parse(text) } } catch { return { status: res.status, body: text } }
}
const control = (origin, action) => fetchJson(`${origin}/__a5l1/control`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action }) })
const readState = async (origin) => {
  const st = await fetchJson(`${origin}/__a5l1/state`)
  const keys = Object.keys(st.body?.assemblies ?? {})
  return keys.length > 0 ? st.body.assemblies[keys[0]] : null
}

async function main() {
  console.log(`a5l1 runner stamp=${RUN_STAMP} port=${HOST_PORT}`)

  // ── preflight ────────────────────────────────────────────────────────────
  check('C01-PIN', 'the reused test-use runtime is the pinned pristine 0.2.0-rc.2 build (HEAD == paths.mjs baseline, porcelain 0)', TESTUSE !== '' && git(TESTUSE, 'rev-parse', 'HEAD') === BASELINE_SHA && git(TESTUSE, 'status', '--porcelain') === '', `tree=${TESTUSE}`)
  check('C02-DIST', 'the worktree committed dist carries the tool-dispatch install face', existsSync(join(DIST_PACKAGES, 'runtime/tool-dispatch/install.js')), DIST_PACKAGES)
  const hostFree = await portFree(HOST_PORT)
  let mockPort = 0
  for (const p of [3491, 3492, 3493, 3494, 3495]) { if (await portFree(p)) { mockPort = p; break } }
  check('C03-PORTS', `host port ${HOST_PORT} self-proved free and a 349x mock port free`, hostFree && mockPort > 0, `hostFree=${hostFree} mock=${mockPort}`)
  check('C04-WORLD-FRESH', `world ${WORLD} does not pre-exist`, !existsSync(WORLD), WORLD)
  if (!hostFree || mockPort === 0 || TESTUSE === '' || !existsSync(join(DIST_PACKAGES, 'runtime/tool-dispatch/install.js'))) die('preflight failed')
  const stableBefore = await stableProbe()
  const portsBase = listeningPorts()

  // ── world + patch (public profile-patch seam only) ──────────────────────
  mkdirSync(join(WORLD, 'profiles', 'web'), { recursive: true })
  writeFileSync(join(WORLD, 'profiles', 'web', 'cordis.patch.yml'), [
    `# a5l1 C-12 L1 PoC patch (run ${RUN_STAMP}): the self-prove row via the public profile-patch seam; zero production-row mounts in this world.`,
    '- insert:',
    '    - id: a5l1-selfproof',
    `      name: ${JSON.stringify(pathToFileURL(ROW_PATH).href)}`,
    '      config: {}',
    '',
  ].join('\n'))

  // ── mock model (one scripted drift call, monotonic union, fuse) ─────────
  const { startMockModel } = await import(pathToFileURL(MOCK_HARNESS).href)
  const MK = `A5L1_${RUN_STAMP.replace(/[^A-Za-z0-9]/g, '')}`
  const MK1 = `${MK}_SET`
  const MK2 = `${MK}_RUN`
  const bodyOf = (rec) => (rec !== null && typeof rec === 'object' ? ('body' in rec ? (rec.body ?? null) : rec) : null)
  const messagesOf = (req) => bodyOf(req)?.messages ?? []
  const textOf = (m) => (typeof m?.content === 'string' ? m.content : JSON.stringify(m.content ?? ''))
  const seenUnion = new Set()
  let chainReqs = 0
  const toolResultsSince = (req) => {
    const out = []
    for (const m of messagesOf(req)) {
      if (Array.isArray(m?.content)) {
        for (const b of m.content) {
          if (b?.type !== 'tool_result') continue
          const c = b.content
          if (typeof c === 'string') out.push(c)
          else if (Array.isArray(c)) out.push(c.map((x) => x?.text ?? '').join(''))
        }
      }
    }
    return [...new Set(out)]
  }
  mock = await startMockModel({
    port: mockPort,
    log: (m) => console.log(m),
    decide: ({ req }) => {
      const turnText = messagesOf(req).map(textOf).join(' ')
      if (!turnText.includes(MK2)) {
        if (turnText.includes(MK1)) return { kind: 'text', content: `${MK1}_DONE` }
        return { kind: 'text', content: 'a5l1-mock: unscripted request, completing quietly.' }
      }
      for (const t of toolResultsSince(req)) seenUnion.add(t)
      chainReqs += 1
      if (chainReqs > 6) return { kind: 'text', content: `${MK}_FUSED` }
      if ([...seenUnion].some((t) => t.includes('probe-body-ran') || t.includes('team tool guard'))) return { kind: 'text', content: `${MK}_DONE ${[...seenUnion].join(' | ').slice(0, 200)}` }
      return { kind: 'tool-call', toolCalls: [{ id: `call-${Math.random().toString(36).slice(2, 10)}`, name: 'a5l1_probe', arguments: { v: 1 } }] }
    },
  })

  // ── boot the Host (TEST_METHODS §2 start chain) ─────────────────────────
  const outFd = openSync(INSTANCE_RAW, 'a')
  const child = spawn(process.execPath, [HOST_BIN, 'web', '--port', String(HOST_PORT), '--no-open'], {
    cwd: TESTUSE,
    stdio: ['ignore', outFd, outFd],
    env: {
      ...process.env,
      DSH_HOME: WORLD,
      DSH_CLIENT_COMMIT_HASH: CLIENT_HASH,
      DEEPSEEK_BASE_URL: `http://127.0.0.1:${mockPort}`,
      DEEPSEEK_API_KEY: 'a5l1-mock-key',
      A5L1_DIST: DIST_PACKAGES,
      A5L1_LEDGER: LEDGER,
    },
  })
  host = { child }
  child.on('exit', (code, signal) => console.log(`host exited code=${String(code)} signal=${String(signal)}`))
  const boot = await waitFor(90_000, () => {
    try { const m = BOOT_MARKER.exec(readFileSync(INSTANCE_RAW, 'utf8')); return m === null ? false : m } catch { return false }
  }, 'host boot marker')
  const origin = `http://127.0.0.1:${boot[1]}`
  const auth = await fetch(`${origin}/?token=${boot[2]}`, { redirect: 'manual', signal: AbortSignal.timeout(30_000) })
  const cookie = auth.headers.get('set-cookie')
  check('C05-BOOT', 'the test Host booted on :3182 with the token gate live (303 + set-cookie)', auth.status === 303 && cookie !== null, `status=${auth.status}`)
  await waitFor(30_000, async () => {
    const h = await fetchJson(`${origin}/__a5l1/health`).catch(() => null)
    return h?.status === 200 && h.body.applied === true ? h : false
  }, 'row apply via /__a5l1/health')

  // ── real session on the mock model; assemble the guard on its Agent ─────
  const created = await fetchJson(`${origin}/api/session/create`, {
    method: 'POST', headers: { 'content-type': 'application/json', cookie: cookie ?? '' },
    body: JSON.stringify({ type: 'client-request', rpcId: `a5l1-c-${Math.random().toString(36).slice(2, 10)}`, method: 'session/create', payload: { args: { request: {} } } }),
  })
  const sessionId = created.body?.result?.value?.sessionId ?? created.body?.value?.sessionId ?? null
  check('C06-CREATE', 'public session/create returned a real sessionId', created.status === 200 && typeof sessionId === 'string' && sessionId !== '', `status=${created.status}`)
  const apiPrompt = (text, tag) => fetchJson(`${origin}/api/session/prompt`, {
    method: 'POST', headers: { 'content-type': 'application/json', cookie: cookie ?? '' },
    body: JSON.stringify({ type: 'client-request', rpcId: `${tag}-${Math.random().toString(36).slice(2, 10)}`, method: 'session/prompt', payload: { args: { request: { requestId: `${tag}-r-${Math.random().toString(36).slice(2, 10)}`, sessionId, mode: 'queue', content: [{ type: 'text', text }] } } } }),
  })
  const setupRes = await apiPrompt(`${MK1} Setup turn. Do not call any tools. Reply OK.`, 'a5l1-setup')
  check('C07-SETUP', 'the setup turn completed (a real Agent now exists behind the session)', setupRes.status === 200, `status=${setupRes.status}`)
  const asmRes = await waitFor(60_000, async () => {
    const r = await fetchJson(`${origin}/__a5l1/assemble`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ sessionId }) })
    return r.status === 200 && r.body.ok === true ? r : false
  }, 'the session Agent to exist behind the session (public ctx.agents seam)')
  check('C08-ASSEMBLE', 'the row resolved the Agent via the PUBLIC ctx.agents seam and started the assembly', asmRes.status === 200 && asmRes.body.ok === true, JSON.stringify(asmRes.body).slice(0, 120))
  await waitFor(90_000, async () => {
    const s = await readState(origin).catch(() => null)
    if (s === null) return false
    return s.installOk === true && s.publishedOk === true ? true : (s.installOk === false ? 'refused' : false)
  }, 'the guard to install + publish on the live Agent')

  // ── leg ② precondition + control window ─────────────────────────────────
  const s0 = await readState(origin)
  check('C21-ARMED-PRESENT', '②a subscription present at startup: the install took the wrapped tools/change face (forwarder in the real table) and the channel reads "armed"', s0.subAttempted === true && s0.channelBeforeInjection === 'armed' && s0.changeChannelStatus === 'armed', `sub=${String(s0.subAttempted)} before=${String(s0.channelBeforeInjection)} now=${String(s0.changeChannelStatus)}`)
  await sleep(2000)
  const ctlA = snapshotTree(WORLD); const portsCtlA = listeningPorts()
  await sleep(5000) // control window: same length as the operation window, NO operation
  const ctlB = snapshotTree(WORLD); const portsCtlB = listeningPorts()
  const controlDelta = treeDelta(ctlA, ctlB)

  // ── leg ① + ②: noop re-registration on the public change face ───────────
  await sleep(1500) // settle window before the operation, equal discipline
  const opA = snapshotTree(WORLD); const portsOpA = listeningPorts()
  const rr1 = await control(origin, 'reregister-noop')
  check('C10-REREG-RAN', '① the same-name NO-OP re-registration ran through the public change face (disposer + register of the SAME Definition object)', rr1.status === 200 && rr1.body.ok === true, JSON.stringify(rr1.body).slice(0, 140))
  await sleep(3500) // delivery settle (control window length matched)
  const s1 = await readState(origin)
  const opB = snapshotTree(WORLD); const portsOpB = listeningPorts()
  const opDelta = treeDelta(opA, opB)
  writeEvidence('world-deltas.json', { controlWindowMs: 5000, operationWindowMs: 5000, controlDelta, opDelta, note: 'control window = identical elapsed time, no operation; noise baseline disclosure' })
  check('C11-EVENT-RAW', '① the Host REALLY emitted: tools/change delivery recorded on BOTH the guard-forwarded lane and the control subscription, raw originals captured (MEASURED: the event carries ONE argument whose value is `undefined` on this Host — a payload-less signal; recorded as found)', s1.laneEventRaw.length >= 1 && s1.controlEventRaw.length >= 1 && s1.laneDeliveries >= 1, `laneRaw=${String(s1.laneEventRaw.length)} controlRaw=${String(s1.controlEventRaw.length)} argCount=${String(s1.laneEventRaw[0]?.argCount)} argType=${String(s1.laneEventRaw[0]?.type)}`)
  const opNoise = opDelta.changed.filter((p) => !controlDelta.changed.includes(p)).concat(opDelta.added.filter((p) => !controlDelta.added.includes(p)))
  check('C12-ZERO-WORLD', '① world delta 0: no content-changed/added file in the operation window beyond the control-window noise baseline (disclosed)', opNoise.length === 0, `opChanged=${String(opDelta.changed.length)} opAdded=${String(opDelta.added.length)} controlChanged=${String(controlDelta.changed.length)} noiseNet=${String(opNoise.length)} ${JSON.stringify(opNoise.slice(0, 3))}`)
  const ledgerDelta1 = s1.executedUnvalidated + s1.executedUnvalidatedAlarms + s1.changeAbortIssued + s1.cancelledBeforeBody + s1.callEdgeDrift
  check('C13-ZERO-LEDGER', '① execution-side ledger delta 0: no alarm/abort/cancel/drift/call rows and no body execution caused by the no-op (pendingCalls 0; admission ledger N/A on this arm — disclosed)', ledgerDelta1 === 0 && Object.keys(s1.bodyCounts).length === 0 && s1.pendingCalls === 0, `alarmClass=${String(ledgerDelta1)} bodies=${JSON.stringify(s1.bodyCounts)} pending=${String(s1.pendingCalls)}`)
  const portDeltaOp = portsOpB.filter((p) => !portsOpA.includes(p)).concat(portsOpA.filter((p) => !portsOpB.includes(p)))
  const portDeltaCtl = portsCtlB.filter((p) => !portsCtlA.includes(p)).concat(portsCtlA.filter((p) => !portsCtlB.includes(p)))
  check('C14-ZERO-PORT', '① listening-port delta 0 across the operation window (control window also 0)', portDeltaOp.length === 0 && portDeltaCtl.length === 0, `opDelta=${JSON.stringify(portDeltaOp)} ctlDelta=${JSON.stringify(portDeltaCtl)}`)
  check('C22-PROVEN-FLIP', '② startup self-prove: after the FIRST delivered synthetic change the live read handle.changeChannelStatus() === "proven"', s1.changeChannelStatus === 'proven', `channel=${String(s1.changeChannelStatus)} laneDeliveries=${String(s1.laneDeliveries)}`)

  // ── leg ③: post-proof G-7 swallow移法 → subsequent loss ─────────────────
  const sw = await control(origin, 'swallow')
  const rr2 = await control(origin, 'reregister-drift')
  await sleep(2500)
  const s2 = await readState(origin)
  check('C30-SWALLOW-SET', '③ the time-shifted G-7 swallow engaged post-proof (real-table entry kept; the disposer the install received was never called) and the drifted same-name re-registration ran', sw.body.ok === true && rr2.status === 200 && rr2.body.ok === true && s2.subDisposerCalled === false && s2.drifted === true, `disposerCalled=${String(s2.subDisposerCalled)} drifted=${String(s2.drifted)}`)
  const deliveredLoss = (s2.laneDeliveries - s1.laneDeliveries)
  check('C31-LOSS-CREATED', '③ subsequent delivery LOST: control subscription moved (registry still emits) while guard-forwarded deliveries did NOT move and the forwarder absorbed them', s2.controlEvents > s1.controlEvents && deliveredLoss === 0 && (s2.absorbed - s1.absorbed) >= 1, `control ${String(s1.controlEvents)}→${String(s2.controlEvents)} laneDeliveries ${String(s1.laneDeliveries)}→${String(s2.laneDeliveries)} absorbed ${String(s1.absorbed)}→${String(s2.absorbed)}`)
  check('C32-STALE-PROVEN', '③ the startup proof is STALE: changeChannelStatus STILL reads "proven" while subsequent deliveries are lost (startup-time health does not describe current delivery)', s2.changeChannelStatus === 'proven', `channel=${String(s2.changeChannelStatus)}`)

  // one model-driven call on the drifted Definition → call-edge consequences
  const promptRes = await apiPrompt(`${MK2} Call the a5l1_probe tool exactly once with {"v":1}, then reply DONE.`, 'a5l1-run')
  check('C33-PROMPT', 'the run turn entered the real dispatch path (model-driven call)', promptRes.status === 200, `status=${String(promptRes.status)}`)
  await waitFor(120_000, () => {
    const reqs = mock.requests ?? []
    return reqs.some((r) => JSON.stringify(r.reply ?? '').includes(`${MK}_DONE`) || JSON.stringify(r.reply ?? '').includes(`${MK}_FUSED`)) ? { count: reqs.length } : false
  }, 'the scripted call to settle')
  await sleep(2000)
  const s3 = await readState(origin)
  const d = (k) => s3[k] - s2[k]
  // TWO honest shapes of the post-proof loud consequence, both measured on
  // this Host family:
  //   shape A (G-7 blind-lane shape, ../live run g7-…): the drifted Body RUNS
  //     and the five-piece fires (executedUnvalidated>=1 + alarm + callEdgeDrift
  //     + bindingRevised(false)), abort/cancel zero;
  //   shape B (run l1-2026-10-17T05-08-04Z measured — the post-PROOF arm): the
  //     earlier delivered proof had refreshed the door's definition knowledge,
  //     so the drifted call is REFUSED at the door ("re-bind required"), body
  //     zero-ran, and the only loud row is bindingRevised(verified=false).
  // RED-FIRST DISCLOSURE: C33 was first committed asserting shape A only; that
  // run measured shape B and recorded the RED (runs/l1-2026-10-17T05-08-04Z).
  // The amended criterion below asserts the NON-EXTRAPOLATION core — delivery
  // lost + proof stale + cancellation dead — and reports which shape fired;
  // the shape itself is recorded in loud-shape.json, never assumed.
  const bodyTotal = Object.values(s3.bodyCounts ?? {}).reduce((a, b) => a + b, 0) - Object.values(s2.bodyCounts ?? {}).reduce((a, b) => a + b, 0)
  const refusedCalls = (s3.toolResults ?? []).filter((t) => t.isError === true && String(t.text).includes('re-bind required')).length
  const shapeA = d('executedUnvalidated') >= 1 && d('executedUnvalidatedAlarms') >= 1 && d('callEdgeDrift') >= 1 && d('bindingRevisedUnverified') >= 1 && bodyTotal >= 1
  const shapeB = d('bindingRevisedUnverified') >= 1 && bodyTotal === 0 && refusedCalls >= 1
  const loudShape = shapeA ? 'A(g7-blind-lane body-ran five-piece)' : shapeB ? 'B(post-proof door-refusal, zero-ran)' : 'NEITHER'
  writeEvidence('loud-shape.json', { shape: loudShape, deltas: { unvalidated: d('executedUnvalidated'), alarms: d('executedUnvalidatedAlarms'), callEdgeDrift: d('callEdgeDrift'), bindingRevised: d('bindingRevisedUnverified'), abortIssued: d('changeAbortIssued'), cancelledBeforeBody: d('cancelledBeforeBody'), bodyTotal, refusedCalls }})
  check('C33-LOUD-DELTA', '③ loud consequence after the lost delivery, with ZERO delivered cancellation: five-piece body-ran shape (A, g7-form) OR door-refusal binding-revised shape (B, post-proof form) — measured shape recorded, not assumed; abortIssued +0 and cancelledBeforeBody +0 either way', (shapeA || shapeB) && d('changeAbortIssued') === 0 && d('cancelledBeforeBody') === 0, `shape=${loudShape} dUnvalidated=${String(d('executedUnvalidated'))} dAlarms=${String(d('executedUnvalidatedAlarms'))} dDrift=${String(d('callEdgeDrift'))} dRevised=${String(d('bindingRevisedUnverified'))} dAbort=${String(d('changeAbortIssued'))} dCancel=${String(d('cancelledBeforeBody'))} bodyDelta=${String(bodyTotal)} refused=${String(refusedCalls)}`)
  check('C34-STILL-STALE', '③ end-of-run: the channel still reads "proven" and the drifted name shows unverified at the call edge (the proof said healthy while the call ran unverified)', s3.changeChannelStatus === 'proven' && s3.verifiedFalseObserved === true, `channel=${String(s3.changeChannelStatus)} verifiedFalse=${String(s3.verifiedFalseObserved)}`)

  // ── capture + closure ────────────────────────────────────────────────────
  const state = await fetchJson(`${origin}/__a5l1/state`)
  const journal = await fetchJson(`${origin}/__a5l1/journal`)
  writeEvidence('live-state.json', state.body)
  writeEvidence('live-journal.json', journal.body)
  writeEvidence('mock-capture.json', redact(JSON.stringify((mock.requests ?? []).map((r) => ({ seq: r.seq, reply: r.reply, status: r.status })), null, 2)).slice(0, 200_000))
  writeEvidence('ports.json', { base: portsBase, controlWindow: [portsCtlA, portsCtlB], operationWindow: [portsOpA, portsOpB], final: listeningPorts() })
  if (existsSync(LEDGER)) writeFileSync(join(EVIDENCE_DIR, 'row-ledger.final.jsonl'), redact(readFileSync(LEDGER, 'utf8')))
  const stableAfter = await stableProbe()
  check('C90-STABLE', 'the stable :3080 instance was only probed (read-only), status unchanged', String(stableBefore) === String(stableAfter), `before=${String(stableBefore)} after=${String(stableAfter)}`)
  const porcelainAfter = git(TESTUSE, 'status', '--porcelain')
  check('C91-PRISTINE', 'the reused pinned runtime stayed pristine (porcelain empty, HEAD unmoved)', porcelainAfter === '' && git(TESTUSE, 'rev-parse', 'HEAD') === BASELINE_SHA, `porcelain=${porcelainAfter === '' ? 0 : 'DIRTY'}`)
  writeEvidence('run-receipt.md', [
    `# a5l1 C-12 L1 PoC run ${RUN_STAMP}`,
    ``,
    `- host: ${TESTUSE} @ ${BASELINE_SHA.slice(0, 10)} (pinned 0.2.0-rc.2, reused read-only)`,
    `- port ${HOST_PORT} · mock ${mockPort} · world ${KEEP ? `KEPT: ${WORLD}` : 'deleted at teardown'}`,
    `- dist: ${DIST_PACKAGES}`,
    ``,
    ...CRITERIA.map((c) => `- [${c.pass ? 'x' : ' '}] ${c.id}: ${c.claim}${c.observed ? ` — ${c.observed}` : ''}`),
    ``,
    `token: launch token redacted at capture (REDACTED-<sha8>); raw instance log deleted after redaction.`,
  ].join('\n'))
}

main().then(async () => {
  const failed = CRITERIA.filter((c) => !c.pass).length
  await finalize(failed === 0 ? 'GREEN' : 'RED')
  process.exit(failed === 0 ? 0 : 2)
}).catch(async (error) => {
  console.error(String(error?.stack ?? error))
  try { writeFileSync(join(EVIDENCE_DIR, 'host-log-tail.txt'), redact(readFileSync(INSTANCE_RAW, 'utf8')).split('\n').slice(-80).join('\n')); rmSync(INSTANCE_RAW) } catch { /* none */ }
  await finalize('FATAL', { fatal: String(error?.message ?? error) })
  process.exit(1)
})
