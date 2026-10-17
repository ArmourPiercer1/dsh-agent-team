#!/usr/bin/env node
/**
 * run-live-assembly.mjs — PR3 LIVE-assembly slice runner (Scope-4 live round).
 *
 * Boots a TEST Host instance on port 3186 (the 318x family; the stable :3080
 * is probed read-only before and after and never touched), DSH_HOME =
 * `tests/homes/a5live-<stamp>` (TEST_METHODS §7, deleted at teardown unless
 * --keep), mounts the test-side assembly row
 * (`a5live-assembly-row.mjs`) through the PUBLIC profile-patch seam, drives a
 * REAL session on the mock model only, and reads the live process through the
 * row's own routes (`/__a5live/*`) — the kit criteria, live version.
 *
 * Phases (each its own world, --phase):
 *   s1s2  Phase 1  ControlledFs gated face in a real session: unbound typed
 *                  refusal + PR2 bind→grant→one controlled read, in-assembly
 *                  AND E2E through a real model-driven tool call.
 *   g6    G-6      live guard, legal registry change DELIVERED:
 *                  changeChannelStatus() flips to 'proven' (live read), the
 *                  dispatcher-change-abort-issued rows ride out as event text.
 *   g7    G-7      live guard, SWALLOWED subscription (kit G-4 form): loud
 *                  five-piece + control/proxy proof, channel stays 'armed'.
 *
 * Honesty rules held by construction: criteria are computed from LIVE route
 * reads captured at observation time; a missing leg FAILS, nothing is
 * back-filled; the launch token is redacted at capture (`REDACTED-<sha8>`).
 *
 * EXIT: 0 all criteria pass · 2 a criterion failed · 1 fatal (env/boot/row).
 */
import { spawn, spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { closeSync, existsSync, mkdirSync, openSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { createServer } from 'node:net'
import { dirname, join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

import { startMockModel } from '../../../../../packages/tools/harness/mock-deepseek.mjs'
import { TEST_USE_BASELINE_SHA, CLIENT_COMMIT_HASH } from '../../../../../tests/paths.mjs'

const args = process.argv.slice(2)
const argValue = (n, d) => { const i = args.indexOf(`--${n}`); return i === -1 ? d : args[i + 1] }
const PHASE = argValue('--phase', null) ?? argValue('phase', 's1s2')
const KEEP = args.includes('--keep')
const HERE = dirname(new URL(import.meta.url).pathname)
const WORKTREE = resolve(argValue('worktree', resolve(HERE, '..', '..', '..', '..', '..')))
const RUN_STAMP = new Date().toISOString().slice(0, 19).replace(/[:]/g, '-') + 'Z'
const EVIDENCE_DIR = resolve(argValue('evidence-dir', join(WORKTREE, 'dev', 'agent-workflow', 'evidence', 'alpha5', 'live', 'runs', `${PHASE}-${RUN_STAMP}`)))
mkdirSync(EVIDENCE_DIR, { recursive: true })

const HOST_PORT = Number(argValue('port', 3186))
// the pristine pinned host checkout: prefer this worktree, else the built
// pinned runtime recorded by the 0.2.0-rc.2 host-upgrade round (reused
// read-only; its porcelain is asserted clean before AND after).
const TESTUSE_CANDIDATES = [
  argValue('testuse', ''),
  join(WORKTREE, 'tests', 'deepseek-harness-test-use'),
  '/srv/workspace/dsh-plugins/dsh-agent-team/.worktrees/dsh-020rc2-upgrade/tests/deepseek-harness-test-use',
].filter((p) => p !== '' && existsSync(p))
const TESTUSE = resolve(TESTUSE_CANDIDATES[0] ?? '')
const HOST_BIN = join(TESTUSE, 'apps', 'cli', 'lib', 'bin.js')
const DIST_PACKAGES = join(WORKTREE, 'packages', 'runtime', 'dist', 'packages')
const ROW_PATH = join(HERE, 'a5live-assembly-row.mjs')
const WORLD = join(WORKTREE, 'tests', 'homes', `a5live-${PHASE}-${RUN_STAMP}`)
const HOME = WORLD
const LEDGER = join(EVIDENCE_DIR, 'assembly-ledger.jsonl')
const INSTANCE_RAW = join(EVIDENCE_DIR, 'instance.raw.log')
const INSTANCE_LOG = join(EVIDENCE_DIR, 'instance.log')

// ── redaction at capture (kit discipline: value never leaves evidence) ──────
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

// ── preflight ───────────────────────────────────────────────────────────────
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
  // instance log: redact then delete the raw capture (same step).
  try {
    const raw = readFileSync(INSTANCE_RAW, 'utf8')
    writeFileSync(INSTANCE_LOG, redact(raw))
    rmSync(INSTANCE_RAW)
  } catch { /* no log */ }
  writeEvidence('criteria.json', { phase: PHASE, status: finalStatus, criteria: CRITERIA })
  if (!KEEP) { try { rmSync(WORLD, { recursive: true, force: true }) } catch { /* best effort */ } }
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

async function main() {
  console.log(`a5live runner phase=${PHASE} stamp=${RUN_STAMP}`)
  if (!['s1s2', 'g6', 'g7'].includes(PHASE)) die(`unknown phase ${PHASE}`)
  // pinned runtime: baseline + pristine, before
  const head = gitAt(TESTUSE, 'rev-parse', 'HEAD')
  const porcelainBefore = gitAt(TESTUSE, 'status', '--porcelain')
  check('L-PIN', 'test-use runtime is the pinned pristine baseline', head === TEST_USE_BASELINE_SHA && porcelainBefore === '', `head=${head.slice(0, 10)} porcelain=${porcelainBefore === '' ? 0 : 'DIRTY'} at ${TESTUSE}`)
  check('L-DIST', 'the worktree dist carries the gated face + kernel + install', existsSync(join(DIST_PACKAGES, 'runtime/controlled-fs/src/index.js')) && existsSync(join(DIST_PACKAGES, 'runtime/tool-admission/admission-kernel.js')) && existsSync(join(DIST_PACKAGES, 'runtime/tool-dispatch/install.js')), DIST_PACKAGES)
  const hostFree = await portFree(HOST_PORT)
  let mockPort = 0
  for (const p of [3499, 3498, 3497, 3496, 3495, 3494, 3493, 3492, 3491]) { if (await portFree(p)) { mockPort = p; break } }
  check('L-PORTS', `host port ${HOST_PORT} free and a mock port from the 349x family free`, hostFree && mockPort > 0, `hostFree=${hostFree} mock=${mockPort}`)
  const stableBefore = await stableProbe()
  if (!hostFree || mockPort === 0) die('ports not free')

  // ── world + patch (public profile-patch seam only) ──────────────────────
  mkdirSync(join(HOME, 'profiles', 'web'), { recursive: true })
  mkdirSync(join(HOME, 'a5live-fs'), { recursive: true })
  writeFileSync(join(HOME, 'profiles', 'web', 'cordis.patch.yml'), [
    `# a5live PR3 live-assembly patch (run ${RUN_STAMP}, phase ${PHASE}): the test-side assembly row via the public profile-patch seam; zero production-row mounts in this world.`,
    '- insert:',
    `    - id: a5live-assembly`,
    `      name: ${JSON.stringify(pathToFileURL(ROW_PATH).href)}`,
    `      config: {}`,
    '',
  ].join('\n'))

  // ── mock model: the per-phase scripts ──────────────────────────────────
  const MK = `A5LIVE_${PHASE.toUpperCase()}_${RUN_STAMP.replace(/[^A-Za-z0-9]/g, '')}`
  const MK1 = `${MK}_SET`
  const MK2 = `${MK}_RUN`
  const toolCall = (name, a) => ({ kind: 'tool-call', toolCalls: [{ id: `call-${Math.random().toString(36).slice(2, 10)}`, name, arguments: a }] })
  const bodyOf = (rec) => (rec !== null && typeof rec === 'object' ? ('body' in rec ? (rec.body ?? null) : rec) : null)
  const messagesOf = (req) => bodyOf(req)?.messages ?? []
  const textOf = (m) => (typeof m?.content === 'string' ? m.content : JSON.stringify(m.content ?? ''))
  const normText = (t) => String(t ?? '').replace(/\s+/g, ' ').trim()
  const toolResultsSince = (req, marker) => {
    const msgs = messagesOf(req)
    let start = -1
    for (let i = msgs.length - 1; i >= 0; i -= 1) if (textOf(msgs[i]).includes(marker)) { start = i; break }
    const out = []
    for (let i = start + 1; i < msgs.length; i += 1) {
      const m = msgs[i]
      if (m?.role === 'tool') out.push(typeof m.content === 'string' ? m.content : JSON.stringify(m.content ?? ''))
      else if (Array.isArray(m?.content)) {
        // wire truth (measured 2026-10-16): tool_result blocks ride in USER messages
        for (const b of m.content) {
          if (b?.type !== 'tool_result') continue
          const c = b.content
          if (typeof c === 'string') out.push(c)
          else if (Array.isArray(c)) out.push(c.map((x) => x?.text ?? '').join(''))
          else out.push(JSON.stringify(c ?? ''))
        }
      }
    }
    return [...new Set(out.map(normText))].filter((t) => t !== '')
  }
  const reqSamples = []
  // the host snapshot may show only the newest round (measured 2026-10-16);
  // scripts are monotonic over a union of everything seen, with a hard fuse.
  const seenUnion = new Set()
  let chainReqs = 0
  let issued = 0
  const script = (results) => {
    for (const t of results) seenUnion.add(t)
    chainReqs += 1
    const has = (pat) => [...seenUnion].some((t) => t.includes(pat))
    if (chainReqs > 12) return { kind: 'text', content: `${MK}_FUSED chain fuse: ${String(chainReqs)} scripted requests.` }
    if (PHASE === 's1s2') {
      if (has('A5LIVE-BOUND stage=flow-complete')) return { kind: 'text', content: `${MK}_FS_DONE ${[...seenUnion].join(' | ').slice(0, 300)}` }
      if (has('A5LIVE-UNBOUND refused=true')) return toolCall('a5live_fs_read', { mode: 'bound', tag: MK2 })
      return toolCall('a5live_fs_read', { mode: 'unbound', tag: MK2 })
    }
    const done = seenUnion.size
    if (done >= 3) return { kind: 'text', content: `${MK}_DRIFT_DONE ${[...seenUnion].map((r) => r.slice(0, 60)).join(' | ')}` }
    return toolCall('a5live_drift', { v: done + 1 })
  }
  mock = await startMockModel({
    port: mockPort,
    log: (m) => console.log(m),
    decide: ({ req }) => {
      if (JSON.stringify(req ?? '').includes(MK2) && reqSamples.length < 3) reqSamples.push(req)
      const turnText = messagesOf(req).map(textOf).join(' ')
      if (!turnText.includes(MK2)) {
        if (turnText.includes(MK1)) return { kind: 'text', content: `${MK1}_DONE` }
        return { kind: 'text', content: 'a5live-mock: unscripted request, completing quietly.' }
      }
      return script(toolResultsSince(req, MK2), req)
    },
  })

  // ── boot the Host (TEST_METHODS §2 start chain) ────────────────────────
  const outFd = openSync(INSTANCE_RAW, 'a')
  const child = spawn(process.execPath, [HOST_BIN, 'web', '--port', String(HOST_PORT), '--no-open'], {
    cwd: TESTUSE,
    stdio: ['ignore', outFd, outFd],
    env: {
      ...process.env,
      DSH_HOME: HOME,
      DSH_CLIENT_COMMIT_HASH: CLIENT_COMMIT_HASH,
      DEEPSEEK_BASE_URL: `http://127.0.0.1:${mockPort}`,
      DEEPSEEK_API_KEY: 'a5live-mock-key',
      A5LIVE_DIST: DIST_PACKAGES,
      A5LIVE_LEDGER: LEDGER,
      A5LIVE_FSWORLD: join(HOME, 'a5live-fs'),
      A5LIVE_MODE: PHASE,
    },
  })
  host = { child }
  child.on('exit', (code, signal) => console.log(`host exited code=${String(code)} signal=${String(signal)}`))
  const boot = await waitFor(90_000, () => {
    try {
      const m = BOOT_MARKER.exec(readFileSync(INSTANCE_RAW, 'utf8'))
      return m === null ? false : m
    } catch { return false }
  }, 'host boot marker')
  const origin = `http://127.0.0.1:${boot[1]}`
  const token = boot[2]
  const auth = await fetch(`${origin}/?token=${token}`, { redirect: 'manual', signal: AbortSignal.timeout(30_000) })
  const cookie = auth.headers.get('set-cookie')
  check('L-BOOT', 'the test Host booted on the recorded port with the token gate live (303 + set-cookie)', auth.status === 303 && cookie !== null, `status=${auth.status}`)

  // row applied?
  await waitFor(30_000, async () => {
    const h = await fetchJson(`${origin}/__a5live/health`).catch(() => null)
    return h?.status === 200 && h.body.applied === true ? h : false
  }, 'row apply via /__a5live/health')

  // ── drive the real session (public creation entry first: create-then-prompt,
  //    a pre-decided sessionId does NOT create on prompt — kit-measured) ─────
  const created = await fetchJson(`${origin}/api/session/create`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie: cookie ?? '' },
    body: JSON.stringify({ type: 'client-request', rpcId: `a5live-c-${Math.random().toString(36).slice(2, 10)}`, method: 'session/create', payload: { args: { request: {} } } }),
  }, 30_000)
  const sessionId = created.body?.result?.value?.sessionId ?? created.body?.value?.sessionId ?? null
  check('L-CREATE', 'the host public session/create entry returned a real sessionId', created.status === 200 && typeof sessionId === 'string' && sessionId !== '', `status=${created.status} sid=${String(sessionId).slice(0, 24)}`)

  // turn 1 (setup): creates the session's Agent; the mock answers with text only.
  const apiPrompt = (text, tag) => fetchJson(`${origin}/api/session/prompt`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie: cookie ?? '' },
    body: JSON.stringify({
      type: 'client-request',
      rpcId: `${tag}-${Math.random().toString(36).slice(2, 10)}`,
      method: 'session/prompt',
      payload: { args: { request: { requestId: `${tag}-r-${Math.random().toString(36).slice(2, 10)}`, sessionId, mode: 'queue', content: [{ type: 'text', text }] } } },
    }),
  }, 240_000)
  const setupRes = await apiPrompt(`${MK1} This is a setup turn. Do not call any tools. Reply with the single word OK.`, 'a5live-setup')
  check('L-TURN1', 'the real session ran a setup turn to a model reply (an Agent now exists behind the session)', setupRes.status === 200, `status=${setupRes.status}`)
  const agentRow = await waitFor(60_000, async () => {
    const a = await fetchJson(`${origin}/__a5live/agents`).catch(() => null)
    const rows = a?.body?.agents ?? []
    return rows.find((r) => r.session === sessionId || r.id === sessionId) ?? (rows.length > 0 ? rows[0] : false)
  }, 'the session Agent to appear via ctx.agents (public service)')
  check('L-AGENT', 'the session Agent is reachable through the PUBLIC ctx.agents seam (core-plugin pattern)', (agentRow?.hasCtx ?? false) === true, `agent=${JSON.stringify(agentRow).slice(0, 120)}`)

  // assemble INTO that live agent through the row's explicit seam
  const asmRes = await fetchJson(`${origin}/__a5live/assemble`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ sessionId }) }, 30_000)
  check('L-ASSEMBLE-START', 'the live assembly started on the real Agent', asmRes.status === 200 && asmRes.body.ok === true, JSON.stringify(asmRes.body).slice(0, 120))
  await waitFor(90_000, async () => {
    const st = await fetchJson(`${origin}/__a5live/state`).catch(() => null)
    const labels = Object.keys(st?.body?.assemblies ?? {})
    if (labels.length === 0) return false
    const a = st.body.assemblies[labels[0]]
    if (PHASE === 's1s2') return a.assembly?.unbound !== undefined && a.assembly?.bound !== undefined ? true : false
    return a.guard !== null && a.guard !== undefined && a.guard.installOk === true ? true : ((a.assembly?.installError !== undefined || a.guard?.installOk === false) ? 'refused' : false)
  }, 'the in-assembly legs to complete on the live Agent')

  // turn 2: the scripted tool chain (tools/bindings were installed before it)
  const promptRes = await apiPrompt(`${MK2} Follow the scripted tool calls exactly, one at a time, then answer DONE.`, 'a5live-run')
  console.log(`prompt -> ${promptRes.status}`)
  check('L-PROMPT', 'the real session accepted the scripted turn (the model reached the mock or the turn completed)', promptRes.status === 200, `status=${promptRes.status} body=${JSON.stringify(promptRes.body).slice(0, 160)}`)

  // let the scripted chain run; the mock's final text is the completion signal.
  const done = await waitFor(180_000, () => {
    const reqs = mock.requests ?? []
    const last = reqs[reqs.length - 1]
    const sawDone = reqs.some((r) => JSON.stringify(r.reply ?? '').includes(`${MK}_FS_DONE`) || JSON.stringify(r.reply ?? '').includes(`${MK}_DRIFT_DONE`) || JSON.stringify(r.reply ?? '').includes(`${MK}_FUSED`))
    return sawDone ? { count: reqs.length } : (host.child.killed ? false : false)
  }, 'the scripted model chain to reach its terminal reply')
  check('L-TURN', 'the scripted tool chain ran to its terminal reply', done !== false, `mockRequests=${String(done?.count)}`)
  await new Promise((r) => setTimeout(r, 1500)) // settled edges

  // ── read the LIVE process back through the row's routes ─────────────────
  const state = await fetchJson(`${origin}/__a5live/state`)
  const journal = await fetchJson(`${origin}/__a5live/journal`)
  writeEvidence('live-state.json', state.body)
  writeEvidence('live-journal.json', journal.body)
  if (reqSamples.length > 0) writeEvidence('mock-req-sample.json', JSON.parse(redact(JSON.stringify(reqSamples[reqSamples.length - 1], null, 1)).replace(/"__redacted__"/g, '"<red>"')))
  writeEvidence('mock-capture.json', redact(JSON.stringify((mock.requests ?? []).map((r) => ({ seq: r.seq, reply: r.reply, status: r.status })), null, 2)).slice(0, 200_000))
  writeEvidence('prompt-response.json', promptRes)
  if (existsSync(LEDGER)) writeFileSync(join(EVIDENCE_DIR, 'assembly-ledger.final.jsonl'), redact(readFileSync(LEDGER, 'utf8')))

  const asms = state.body?.assemblies ?? {}
  const labels = Object.keys(asms)
  check('L-ASSEMBLED', 'the row observed a REAL session Agent (agent/created) and ran the live assembly on it', labels.length >= 1, `agents=${labels.join(',')}`)
  const asm = labels.length > 0 ? asms[labels[0]] : {}

  if (PHASE === 's1s2') {
    const a = asm.assembly ?? {}
    const u = a.unbound ?? {}
    check('L-S1-UNBOUND', 'UNBOUND gated lane refused with the typed C-FS denial naming admission-unbound (live session; the raw file WAS readable)', u.ok === false && u.refusal?.code === 'TOOL_BINDING_UNVERIFIED' && u.refusal?.cfClass === 'denied' && u.refusal?.cfReason === 'effect-outside-grant' && String(u.refusal?.message).includes('admission-unbound') && u.readRawWouldSucceed === true, `code=${String(u.refusal?.code)} cfClass=${String(u.refusal?.cfClass)} cfReason=${String(u.refusal?.cfReason)} stage=${String(u.laneLedgerStage)}`)
    const b = a.bound ?? {}
    check('L-S2-GRANT', 'bind→grant: PR2 admit returned an admitted grant in the live session', b.stage === 'flow-complete' && typeof b.admittedGrantId === 'string', `stage=${String(b.stage)} grant=${String(b.admittedGrantId)}`)
    check('L-S2-READ', 'one controlled read executed through the gated lane; content matches; the exec-time port saw the BOUND fingerprint; the ledger shows exactly one consumption', b.firstOk === true && b.firstTextMatches === true && b.portCallCount >= 1 && b.presentedFingerprintIsBound === true && b.ledgerConsumedCount === 1, `firstOk=${String(b.firstOk)} matches=${String(b.firstTextMatches)} port=${String(b.portCallCount)} fpBound=${String(b.presentedFingerprintIsBound)} consumed=${String(b.ledgerConsumedCount)}`)
    check('L-S2-ONESHOT', 'the one-shot grant refuses a second exec at the live exec edge', b.secondOk === false, `secondRefusal=${JSON.stringify(b.secondRefusal)}`)
    const e2e = asm.toolResults ?? []
    const e2u = e2e.find((t) => t.kind === 'e2e-unbound')
    const e2b = e2e.find((t) => t.kind === 'e2e-bound')
    check('L-S3-E2E', 'the refusal and the read ALSO ran E2E through a model-driven tool call (body executed in the real dispatch path)', e2u?.ok === false && e2u?.cfReason === 'effect-outside-grant' && e2b?.ok === true, `unbound=${JSON.stringify(e2u ?? null).slice(0, 120)} bound=${JSON.stringify(e2b ?? null).slice(0, 120)}`)
  } else if (PHASE === 'g6') {
    const g = asm.guard ?? {}
    check('L-G6-INSTALL', 'the PR1 guard installed, published and armed on the REAL session Agent scope (changeChannelStatus reads "armed" pre-change)', g.installOk === true && g.bindOwnOk === true && g.publishedOk === true && g.channelBeforeInjection === 'armed', `install=${String(g.installOk)} publish=${String(g.publishedOk)} before=${String(g.channelBeforeInjection)}`)
    const legal = (journal.body.rows ?? []).filter((r) => r.leg === 'legal-re-register')
    check('L-G6-LEGAL-CHANGE', 'one LEGAL registry change (a same-row re-registration of its own Definition) ran inside the live session', legal.length >= 1, `reRegistrations=${String(legal.length)}`)
    check('L-G6-PROVEN', 'G-6 live: after the first delivered registry-change notification handle.changeChannelStatus() reads "proven" (test-face live read)', g.changeChannelStatus === 'proven', `changeChannelStatus=${String(g.changeChannelStatus)}`)
    const abortRows = g.abortIssuedRows ?? []
    check('L-G6-ABORT-EVENT', 'the delivered configuration shows the targeted cancellation path live: dispatcher-change-abort-issued carries the event originals', abortRows.length >= 1 && (g.cancelledBeforeBody ?? 0) >= 1 && g.bodyCounts?.v1 === 0, `issued=${String(g.changeAbortIssued)} cancelledBeforeBody=${String(g.cancelledBeforeBody)} bodyV1=${String(g.bodyCounts?.v1)}`)
    check('L-G6-NO-ALARM', 'the delivered configuration produced NO executed-unvalidated alarm (cancellation, not loud-withdrawal, covered it)', g.executedUnvalidated === 0, `unvalidated=${String(g.executedUnvalidated)}`)
    check('L-G6-RECOVERY', 'the refused next call re-bound by the trusted assembly executes again (same arm, no extrapolation)', (g.bodyCounts?.v2 ?? 0) + (g.bodyCounts?.v3 ?? 0) >= 1 && g.rebind?.attempted === true && g.rebind?.ok === true, `rebind=${JSON.stringify(g.rebind ?? null)} v2=${String(g.bodyCounts?.v2)} v3=${String(g.bodyCounts?.v3)}`)
  } else {
    const g = asm.guard ?? {}
    check('L-G7-INSTALL', 'the guard installed on the REAL session Agent scope with the SWALLOWED tools/change subscription (assembly indistinguishable: install/publish ok, channel "armed")', g.installOk === true && g.publishedOk === true && g.channelBeforeInjection === 'armed' && g.changeChannelStatus === 'armed', `install=${String(g.installOk)} publish=${String(g.publishedOk)} channel=${String(g.changeChannelStatus)}`)
    check('L-G7-EMISSION-PROVEN', 'the REAL registry emitted while the lane stayed silent: the row-owned control subscription moved AND the swallow proxy absorbed deliveries', (g.controlEvents ?? 0) >= 1 && (g.proxyEmissions ?? 0) >= 1, `control=${String(g.controlEvents)} proxy=${String(g.proxyEmissions)}`)
    const ledgers = (journal.body.rows ?? []).filter((r) => r.leg === 'drift-body' && r.version === 2)
    check('L-G7-LOUND-PIECE', 'the five-piece loud posture on the LIVE observation stream: executedUnvalidated>=1 AND alarms(severity=alarm)>=1 AND callEdgeDrift(reason=definition-drift)>=1 AND bindingRevised(verified=false)>=1 AND issued===0 AND cancelled===0', (g.executedUnvalidated ?? 0) >= 1 && (g.executedUnvalidatedAlarms ?? 0) >= 1 && (g.callEdgeDrift ?? 0) >= 1 && (g.bindingRevisedUnverified ?? 0) >= 1 && g.changeAbortIssued === 0 && g.cancelledBeforeBody === 0, `unvalidated=${String(g.executedUnvalidated)} alarms=${String(g.executedUnvalidatedAlarms)} drift=${String(g.callEdgeDrift)} revised=${String(g.bindingRevisedUnverified)} issued=${String(g.changeAbortIssued)} cancelled=${String(g.cancelledBeforeBody)}`)
    check('L-G7-ARMED-VERIFIED-FALSE', 'the silent configuration: the channel stayed "armed" end of run and a call edge showed the drifted name unverified', g.changeChannelStatus === 'armed' && g.verifiedFalseObserved === true, `channel=${String(g.changeChannelStatus)} verifiedFalseObserved=${String(g.verifiedFalseObserved)}`)
    check('L-G7-MOVED-BODY-RAN', 'the moved Body DID run under the swallowed channel (a body ran — the loud report exists because it could not be cancelled)', ledgers.length >= 1, `movedBodyExecutions=${String(ledgers.length)}`)
  }

  // ── closure facts ────────────────────────────────────────────────────────
  const stableAfter = await stableProbe()
  check('L-STABLE', 'the stable :3080 instance was only probed, never operated, status unchanged', String(stableBefore) === String(stableAfter), `before=${String(stableBefore)} after=${String(stableAfter)}`)
  const porcelainAfter = gitAt(TESTUSE, 'status', '--porcelain')
  check('L-PRISTINE', 'the test-use runtime stayed pristine (porcelain empty, HEAD unmoved)', porcelainAfter === '' && gitAt(TESTUSE, 'rev-parse', 'HEAD') === TEST_USE_BASELINE_SHA, `porcelain=${porcelainAfter === '' ? 0 : 'DIRTY'}`)

  const failed = CRITERIA.filter((c) => !c.pass)
  writeEvidence('run-receipt.md', [
    `# a5live ${PHASE} run ${RUN_STAMP}`,
    ``,
    `- host: ${TESTUSE} @ ${TEST_USE_BASELINE_SHA.slice(0, 10)} (pinned 0.2.0-rc.2)`,
    `- port ${HOST_PORT} · mock ${mockPort} · world ${KEEP ? `KEPT: ${WORLD}` : 'deleted at teardown'}`,
    `- dist: ${DIST_PACKAGES}`,
    `- criteria: ${CRITERIA.length - failed.length}/${CRITERIA.length} pass`,
    ``,
    ...CRITERIA.map((c) => `- [${c.pass ? 'x' : ' '}] ${c.id}: ${c.claim}${c.observed ? ` — ${c.observed}` : ''}`),
    ``,
    `token: launch token redacted at capture (REDACTED-<sha8>); raw instance log deleted after redaction.`,
  ].join('\n'))
  await finalize(failed.length === 0 ? 'GREEN' : 'RED')
  console.log(`\n${failed.length === 0 ? 'GREEN' : 'RED'} — ${CRITERIA.length - failed.length}/${CRITERIA.length} · evidence ${EVIDENCE_DIR}`)
  process.exit(failed.length === 0 ? 0 : 2)
}

main().catch(async (error) => {
  console.error(String(error?.stack ?? error))
  try { const j = readFileSync(INSTANCE_RAW, 'utf8'); writeFileSync(join(EVIDENCE_DIR, 'host-log-tail.txt'), redact(j).split('\n').slice(-80).join('\n')); rmSync(INSTANCE_RAW) } catch { /* none */ }
  await finalize('FATAL')
  process.exit(1)
})
