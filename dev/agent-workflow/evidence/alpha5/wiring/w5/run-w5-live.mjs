#!/usr/bin/env node
/**
 * run-w5-live.mjs — W5 LIVE runner (Alpha.5 wiring phase, lane W5).
 *
 * Boots a TEST Host instance on port 3183 (IF-2: W5's port; :3080 probed
 * read-only before/after, never touched), DSH_HOME =
 * `tests/homes/a5w5-<mode>-<stamp>` (IF-3, TEST_METHODS §7, deleted at
 * teardown unless --keep), mounts `a5w5-assembly-row.mjs` through the PUBLIC
 * profile-patch seam on the pinned pristine host @639ed01539 (IF-4, reused
 * built, porcelain checked before AND after), drives a REAL session on the
 * scripted mock model, and reads the live process back through the row's own
 * routes.
 *
 * Modes (the RED-first shape of a wiring lane):
 *   gated    the admission-gated assembly (target: all criteria GREEN)
 *   ungated  the SAME tool defs without the guard install and without the
 *            PR2 admission face — the same criteria MUST go RED: this is the
 *            measured proof the gate (not the prose) carries the refusals.
 *
 * Model-driven chain (one scripted turn, six calls, fuse at 12 requests):
 *   1 a5w5_search  on the policy-COVERED repo    → presented + grant
 *   2 a5w5_bash    printf 'alpha\nbeta\n'        → presented (parity leg)
 *   3 a5w5_bash    echo out; echo err>&2; exit 3 → presented (parity leg)
 *   4 a5w5_bash    seq 1 4000                    → presented + spill pointer
 *   5 a5w5_search  on the policy-OUTSIDE dir     → typed refusal (⑤ over-priv)
 *   6 a5w5_unbound_probe (registered post-publish) → guard refusal (⑤ unbound)
 *
 * Honesty rules: criteria computed from LIVE route reads captured at
 * observation time; a missing leg FAILS, nothing back-filled; the launch
 * token is redacted at capture (`REDACTED-<sha8>`).
 *
 * EXIT: 0 all criteria pass (GREEN) · 2 a criterion failed (RED) · 1 fatal.
 */
import { spawn, spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { closeSync, existsSync, mkdirSync, openSync, readFileSync, rmSync, writeFileSync, readdirSync } from 'node:fs'
import { createServer } from 'node:net'
import { dirname, join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

import { startMockModel } from '../../../../../../packages/tools/harness/mock-deepseek.mjs'
import { TEST_USE_BASELINE_SHA, CLIENT_COMMIT_HASH } from '../../../../../../tests/paths.mjs'

const args = process.argv.slice(2)
const argValue = (n, d) => { const i = args.indexOf(`--${n}`); return i === -1 ? d : args[i + 1] }
const MODE = argValue('mode', 'gated')
const KEEP = args.includes('--keep')
const HERE = dirname(new URL(import.meta.url).pathname)
const WORKTREE = resolve(argValue('worktree', resolve(HERE, '..', '..', '..', '..', '..', '..')))
const RUN_STAMP = new Date().toISOString().slice(0, 19).replace(/[:]/g, '-') + 'Z'
const EVIDENCE_DIR = resolve(argValue('evidence-dir', join(WORKTREE, 'dev', 'agent-workflow', 'evidence', 'alpha5', 'wiring', 'w5', 'runs', `${MODE}-${RUN_STAMP}`)))
mkdirSync(EVIDENCE_DIR, { recursive: true })

const HOST_PORT = Number(argValue('port', 3183))
const TESTUSE_CANDIDATES = [
  argValue('testuse', ''),
  join(WORKTREE, 'tests', 'deepseek-harness-test-use'),
  '/srv/workspace/dsh-plugins/dsh-agent-team/.worktrees/dsh-020rc2-upgrade/tests/deepseek-harness-test-use',
].filter((p) => p !== '' && existsSync(p))
const TESTUSE = resolve(TESTUSE_CANDIDATES[0] ?? '')
const HOST_BIN = join(TESTUSE, 'apps', 'cli', 'lib', 'bin.js')
const DIST_PACKAGES = join(WORKTREE, 'packages', 'runtime', 'dist', 'packages')
const LANE_BUILD = resolve(argValue('lane-build', join(WORKTREE, 'tests', 'homes', '.a5w5-build')))
const ROW_PATH = join(HERE, 'a5w5-assembly-row.mjs')
const WORLD_ROOT = join(WORKTREE, 'tests', 'homes', `a5w5-${MODE}-${RUN_STAMP}`)
const HOME = WORLD_ROOT
const REPO = join(HOME, 'repo')
const SPILL = join(HOME, 'spill')
const OUTSIDE = join(HOME, 'outside')
const LEDGER = join(EVIDENCE_DIR, 'assembly-ledger.jsonl')
const INSTANCE_RAW = join(EVIDENCE_DIR, 'instance.raw.log')
const INSTANCE_LOG = join(EVIDENCE_DIR, 'instance.log')
const TOKEN = `A5W5TOK-${createHash('sha256').update(String(Math.random()) + RUN_STAMP).digest('hex').slice(0, 12)}`

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

// ── preflight helpers ────────────────────────────────────────────────────────
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
  writeEvidence('criteria.json', { mode: MODE, status: finalStatus, criteria: CRITERIA })
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

async function main() {
  console.log(`a5w5 runner mode=${MODE} stamp=${RUN_STAMP} port=${HOST_PORT}`)
  if (!['gated', 'ungated'].includes(MODE)) die(`unknown mode ${MODE}`)

  const head = gitAt(TESTUSE, 'rev-parse', 'HEAD')
  const porcelainBefore = gitAt(TESTUSE, 'status', '--porcelain')
  check('L-W5-PIN', 'the test-use host is the pinned pristine 0.2.0-rc.2 runtime @639ed01539', head === TEST_USE_BASELINE_SHA && porcelainBefore === '', `head=${head.slice(0, 10)} porcelain=${porcelainBefore === '' ? 0 : 'DIRTY'} at ${TESTUSE}`)
  const sharedDiff = spawnSync('git', ['-C', WORKTREE, 'status', '--porcelain', '--', 'packages', 'scripts', 'vitest.config.ts'], { encoding: 'utf8' }).stdout.trim()
  check('L-W5-IF5', 'IF-5 shared surface (packages/, scripts/, root vitest.config) is byte-untouched by this lane', sharedDiff === '', sharedDiff === '' ? 'porcelain empty' : sharedDiff.split('\n').slice(0, 4).join(' | '))
  check('L-W5-LANE', 'the lane ESM build + runtime dist are present', existsSync(join(LANE_BUILD, 'packages/tools/a5p5-tools/src/index.js')) && existsSync(join(DIST_PACKAGES, 'runtime/tool-dispatch/install.js')), `lane=${LANE_BUILD}`)
  const hostFree = await portFree(HOST_PORT)
  let mockPort = 0
  for (const p of [3493, 3492, 3491, 3494, 3495]) { if (await portFree(p)) { mockPort = p; break } }
  check('L-W5-PORTS', `host port ${HOST_PORT} (IF-2: W5) free and a mock port from the 349x family free`, hostFree && mockPort > 0, `hostFree=${hostFree} mock=${mockPort}`)
  const stableBefore = await stableProbe()
  if (!hostFree || mockPort === 0) die('ports not free')

  // lane settlement constants (read from the SAME build the row runs)
  const spillMod = await import(new URL(`file://${join(LANE_BUILD, 'packages/tools/a5p5-tools/src/spill.js')}`).href)
  const SIX = spillMod.SETTLEMENT_EVENTS

  // ── world + patch (public profile-patch seam only) ──────────────────────
  mkdirSync(REPO, { recursive: true })
  mkdirSync(SPILL, { recursive: true })
  mkdirSync(OUTSIDE, { recursive: true })
  mkdirSync(join(HOME, 'profiles', 'web'), { recursive: true })
  writeFileSync(join(REPO, 'a.txt'), `alpha line\nsecond ${TOKEN} line\nthird line\n`)
  writeFileSync(join(REPO, 'b.txt'), `no match here\nanother ${TOKEN} tail\n`)
  writeFileSync(join(OUTSIDE, 'secret.txt'), `OUTSIDE-${TOKEN}\n`)
  writeFileSync(join(HOME, 'profiles', 'web', 'cordis.patch.yml'), [
    `# a5w5 W5 live-assembly patch (run ${RUN_STAMP}, mode ${MODE}): the test-side assembly row via the public profile-patch seam; zero production-row mounts in this world.`,
    '- insert:',
    '    - id: a5w5-assembly',
    `      name: ${JSON.stringify(pathToFileURL(ROW_PATH).href)}`,
    '      config: {}',
    '',
  ].join('\n'))

  // ── mock model: the six-call chain ──────────────────────────────────────
  const MK = `A5W5_${MODE.toUpperCase()}_${RUN_STAMP.replace(/[^A-Za-z0-9]/g, '')}`
  const MK1 = `${MK}_SET`
  const MK2 = `${MK}_RUN`
  const toolCall = (name, a) => ({ kind: 'tool-call', toolCalls: [{ id: `call-${Math.random().toString(36).slice(2, 10)}`, name, arguments: a }] })
  const bodyOf = (rec) => (rec !== null && typeof rec === 'object' ? ('body' in rec ? (rec.body ?? null) : rec) : null)
  const messagesOf = (req) => bodyOf(req)?.messages ?? []
  const textOf = (m) => (typeof m?.content === 'string' ? m.content : JSON.stringify(m.content ?? ''))
  const newToolResults = (req) => {
    const out = []
    for (const m of messagesOf(req)) {
      if (Array.isArray(m?.content)) {
        for (const b of m.content) {
          if (b?.type !== 'tool_result') continue
          const c = b.content
          if (typeof c === 'string') out.push(c)
          else if (Array.isArray(c)) out.push(c.map((x) => x?.text ?? '').join(''))
          else out.push(JSON.stringify(c ?? ''))
        }
      }
    }
    return out.map(normText)
  }
  // ordered chain: each call has a RESULT MARKER; the script advances the
  // queue whenever the union of everything seen contains the head marker.
  const CHAIN = [
    { name: 'a5w5_search', args: { pattern: TOKEN, path: REPO, output_mode: 'content' }, marker: 'search · content' },
    { name: 'a5w5_bash', args: { command: "printf 'alpha\\nbeta\\n'", cwd: REPO }, marker: 'beta' },
    { name: 'a5w5_bash', args: { command: 'echo out; echo err >&2; exit 3', cwd: REPO }, marker: 'bash · exit=3' },
    { name: 'a5w5_bash', args: { command: 'seq 1 4000', cwd: REPO }, marker: '4000' },
    { name: 'a5w5_search', args: { pattern: `OUTSIDE`, path: OUTSIDE, output_mode: 'content' }, marker: '@@refused-or-outside@@' },
    { name: 'a5w5_unbound_probe', args: {}, marker: '@@probe@@' },
  ]
  const seenUnion = new Set()
  let queueIdx = 0
  let chainReqs = 0
  let probeIssues = 0
  const transcript = []
  const script = () => {
    const has = (pat) => [...seenUnion].some((t) => t.includes(pat))
    const head = CHAIN[queueIdx]
    if (head !== undefined) {
      const m = head.marker
      const hit = m === '@@refused-or-outside@@'
        ? has('A5W5-REFUSED') || has(`OUTSIDE-${TOKEN}`)
        : m === '@@probe@@'
          ? probeIssues > 1 // the probe was asked twice: the edge answered either way (refusal or body), advance
          : has(m)
      if (hit) queueIdx += 1
    }
    chainReqs += 1
    if (chainReqs > 12) return { kind: 'text', content: `${MK}_FUSED chain fuse: ${String(chainReqs)} scripted requests.` }
    const next = CHAIN[queueIdx]
    if (next === undefined) {
      return { kind: 'text', content: `${MK}_DONE ${[...seenUnion].map((r) => r.slice(0, 40)).join(' | ')}` }
    }
    if (next.name === 'a5w5_unbound_probe') probeIssues += 1
    return toolCall(next.name, next.args)
  }
  mock = await startMockModel({
    port: mockPort,
    log: (m) => console.log(m),
    decide: ({ req }) => {
      for (const t of newToolResults(req)) { if (!seenUnion.has(t)) { seenUnion.add(t); transcript.push(t) } }
      const turnText = messagesOf(req).map(textOf).join(' ')
      if (!turnText.includes(MK2)) {
        if (turnText.includes(MK1)) return { kind: 'text', content: `${MK1}_OK` }
        return { kind: 'text', content: 'a5w5-mock: unscripted request, completing quietly.' }
      }
      return script()
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
      DEEPSEEK_API_KEY: 'a5w5-mock-key',
      A5W5_DIST: DIST_PACKAGES,
      A5W5_LANE: LANE_BUILD,
      A5W5_LEDGER: LEDGER,
      A5W5_WORLD: HOME,
      A5W5_OUTSIDE: OUTSIDE,
      A5W5_TOKEN: TOKEN,
      A5W5_MODE: MODE,
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
  check('L-W5-BOOT', 'the test Host booted on port 3183 with the token gate live (303 + set-cookie)', auth.status === 303 && cookie !== null, `status=${auth.status}`)

  await waitFor(30_000, async () => {
    const h = await fetchJson(`${origin}/__a5w5/health`).catch(() => null)
    return h?.status === 200 && h.body.applied === true ? h : false
  }, 'row apply via /__a5w5/health')

  const created = await fetchJson(`${origin}/api/session/create`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie: cookie ?? '' },
    body: JSON.stringify({ type: 'client-request', rpcId: `a5w5-c-${Math.random().toString(36).slice(2, 10)}`, method: 'session/create', payload: { args: { request: {} } } }),
  }, 30_000)
  const sessionId = created.body?.result?.value?.sessionId ?? created.body?.value?.sessionId ?? null
  check('L-W5-CREATE', 'the host public session/create entry returned a real sessionId', created.status === 200 && typeof sessionId === 'string' && sessionId !== '', `status=${created.status} sid=${String(sessionId).slice(0, 24)}`)

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
  const setupRes = await apiPrompt(`${MK1} This is a setup turn. Do not call any tools. Reply with the single word OK.`, 'a5w5-setup')
  check('L-W5-TURN1', 'the real session ran a setup turn to a model reply (an Agent now exists behind the session)', setupRes.status === 200, `status=${setupRes.status}`)
  const agentRow = await waitFor(60_000, async () => {
    const a = await fetchJson(`${origin}/__a5w5/agents`).catch(() => null)
    const rows = a?.body?.agents ?? []
    return rows.find((r) => r.session === sessionId || r.id === sessionId) ?? (rows.length > 0 ? rows[0] : false)
  }, 'the session Agent to appear via ctx.agents (public service)')
  check('L-W5-AGENT', 'the session Agent is reachable through the PUBLIC ctx.agents seam (core-plugin pattern)', (agentRow?.hasCtx ?? false) === true, `agent=${JSON.stringify(agentRow).slice(0, 120)}`)

  const asmRes = await fetchJson(`${origin}/__a5w5/assemble`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ sessionId }) }, 30_000)
  check('L-W5-ASSEMBLE', 'the live assembly started on the real Agent', asmRes.status === 200 && asmRes.body.ok === true, JSON.stringify(asmRes.body).slice(0, 120))
  await waitFor(90_000, async () => {
    const j = await fetchJson(`${origin}/__a5w5/journal`).catch(() => null)
    return (j?.body?.rows ?? []).some((r) => r.leg === 'assembly-complete') ? true : ((j?.body?.rows ?? []).some((r) => r.leg === 'assembly-failed' || r.leg === 'guard-install-refused') ? 'refused' : false)
  }, 'the in-assembly legs (guard/bind/publish/probe/lifecycle/six) to complete')

  const promptRes = await apiPrompt(`${MK2} Follow the scripted tool calls exactly, one at a time, then answer DONE.`, 'a5w5-run')
  check('L-W5-PROMPT', 'the real session accepted the scripted turn', promptRes.status === 200, `status=${promptRes.status}`)

  const done = await waitFor(240_000, () => {
    const reqs = mock.requests ?? []
    return reqs.some((r) => JSON.stringify(r.reply ?? '').includes(`${MK}_DONE`) || JSON.stringify(r.reply ?? '').includes(`${MK}_FUSED`)) ? { count: reqs.length } : false
  }, 'the scripted model chain to reach its terminal reply')
  check('L-W5-TURN', 'the scripted six-call tool chain ran to its terminal reply', done !== false, `mockRequests=${String(done?.count)}`)
  await new Promise((r) => setTimeout(r, 1500)) // settled edges

  // ── read the LIVE process back through the row's routes ─────────────────
  const state = await fetchJson(`${origin}/__a5w5/state`)
  const journal = await fetchJson(`${origin}/__a5w5/journal`)
  const rawParity = await fetchJson(`${origin}/__a5w5/raw-parity`)
  writeEvidence('live-state.json', state.body)
  writeEvidence('live-journal.json', journal.body)
  writeEvidence('raw-parity.json', rawParity.body)
  writeEvidence('transcript-union.json', redact(JSON.stringify(transcript, null, 2)).slice(0, 400_000))
  writeEvidence('mock-capture.json', redact(JSON.stringify((mock.requests ?? []).map((r) => ({ seq: r.seq, reply: r.reply, status: r.status })), null, 2)).slice(0, 200_000))
  writeEvidence('prompt-response.json', promptRes)
  if (existsSync(LEDGER)) writeFileSync(join(EVIDENCE_DIR, 'assembly-ledger.final.jsonl'), redact(readFileSync(LEDGER, 'utf8')))

  const asms = state.body?.assemblies ?? {}
  const labels = Object.keys(asms)
  check('L-W5-ASSEMBLED', 'the row observed a REAL session Agent and ran the live assembly on it', labels.length >= 1, `agents=${labels.join(',')}`)
  const asm = labels.length > 0 ? asms[labels[0]] : {}
  const guard = asm.guard ?? {}
  const toolCalls = asm.toolCalls ?? []
  const transcriptText = transcript.join('\n')

  // ① registration + guard face
  check('L-W5-GUARD', 'the PR1 guard installed, bound its two tool names and PUBLISHED armed on the real Agent scope; the live change-channel later reads proven (the post-assembly registration DELIVERED on the live subscription)', guard.installOk === true && guard.bindOwnOk === true && guard.publishedOk === true && guard.channelAtPublish === 'armed' && (guard.channel === 'armed' || guard.channel === 'proven'), JSON.stringify(guard))
  check('L-W5-REG', 'the aliased tool names a5w5_search + a5w5_bash (+ the post-assembly probe) are on the live scoped registry', Array.isArray(asm.registryNames) && ['a5w5_search', 'a5w5_bash', 'a5w5_unbound_probe'].every((n) => asm.registryNames.includes(n)), JSON.stringify(asm.registryNames ?? null))

  // ① model-driven search + bash through bind→grant→exec, transcript proven
  const searchCall = toolCalls.find((c) => c.tool === 'search' && c.stage === 'admitted')
  const bashCalls = toolCalls.filter((c) => c.tool === 'bash' && c.stage === 'admitted')
  const printfCall = bashCalls.find((c) => String(c.presented ?? '').includes('beta'))
  const bigCall = bashCalls.find((c) => String(c.presented ?? '').includes('4000'))
  check('L-W5-E2E-SEARCH', 'a REAL model-driven search ran the FULL PR2 flow in the dispatch path: bind→grant (grantId minted) → admitted → exec=1 → presented with the lane footer', searchCall !== undefined && typeof searchCall.grantId === 'string' && searchCall.resultKind === 'presented' && (searchCall.backendExecAfter - searchCall.backendExecBefore) === 1 && String(searchCall.presented).includes('search · content') && transcriptText.includes('a5p5-meta'), searchCall === undefined ? 'no admitted search call' : `grant=${String(searchCall.grantId)} execDelta=${String((searchCall.backendExecAfter ?? 0) - (searchCall.backendExecBefore ?? 0))} kind=${String(searchCall.resultKind)}`)
  check('L-W5-E2E-BASH', 'a REAL model-driven shell call ran bind→grant→exec and presented bash · exit=0', printfCall !== undefined && printfCall.resultKind === 'presented' && String(printfCall.presented).includes('bash · exit=0'), printfCall === undefined ? 'no admitted bash printf call' : `kind=${String(printfCall.resultKind)}`)
  check('L-W5-TRANSCRIPT', 'both presentations rode the REAL dispatch path into the model transcript (tool_result bytes seen by the model)', /search · content/.test(transcriptText) && /bash · exit=0/.test(transcriptText) && /a5p5-meta /.test(transcriptText), `transcriptRows=${transcript.length}`)

  // spill pointer on the big call + file on disk
  const bigPointer = bigCall?.spillPointer ?? null
  let spillOnDiskBytes = null
  try { spillOnDiskBytes = bigPointer !== null ? readFileSync(join(SPILL, `${bigPointer.spillId}.spill`)).length : null } catch { /* missing */ }
  check('L-W5-SPILL-POINTER', 'the big shell output presented a spill pointer whose file exists on disk with matching bytes (world-bound controlled path)', bigPointer !== null && typeof bigPointer.bytes === 'number' && bigPointer.bytes > 0 && spillOnDiskBytes === bigPointer.bytes, `pointer=${JSON.stringify(bigPointer)} disk=${String(spillOnDiskBytes)}`)

  // one-shot exec edge
  const oneshotOk = [searchCall, printfCall].every((c) => c !== undefined && c.execEdgeFirst?.ok === true && c.execEdgeReplay?.ok === false && c.ledgerConsumed === 1)
  check('L-W5-ONESHOT', 'every admitted call consumed its grant at the exec edge EXACTLY ONCE (first consume ok, deliberate replay typed-refused, ledger consumed=1)', oneshotOk, `search=${JSON.stringify(searchCall?.execEdgeFirst ?? null)}|${JSON.stringify(searchCall?.execEdgeReplay ?? null)} bash=${JSON.stringify(printfCall?.execEdgeFirst ?? null)}|${JSON.stringify(printfCall?.execEdgeReplay ?? null)} consumed=${String(searchCall?.ledgerConsumed)}/${String(printfCall?.ledgerConsumed)}`)

  // ② spill lifecycle (live, on this host's disk)
  const life = asm.lifecycle ?? {}
  check('L-W5-LIFE-OPENWRITE', 'spill lifecycle LIVE: openSink + ACTIVE writes (all port facts live)', life.open?.ok === true && life.written?.ok === true && (life.written?.bytes ?? 0) > 0, JSON.stringify({ open: life.open, written: life.written }))
  check('L-W5-LIFE-READ', 'spill read (authorized) returned byte-identical payload with attribution', life.read?.ok === true && life.read?.matches === true && life.read?.attribution?.realmId === 'a5w5-realm', JSON.stringify({ ok: life.read?.ok, matches: life.read?.matches, attribution: life.read?.attribution }))
  check('L-W5-LIFE-RECHECK', 'authorization RE-CHECK at read time: deny → typed spill-read-denied with ZERO payload reads', life.recheck?.refused === true && life.recheck?.refusal?.code === 'spill-read-denied' && life.recheck?.payloadReadDelta === 0, JSON.stringify(life.recheck ?? null))
  check('L-W5-LIFE-CLOSE', 'settle→finalize→close ran across the settled edge; a write after close is typed spill-write-after-close', life.close?.settledOk === true && life.close?.finalizedOk === true && life.close?.closedOk === true && life.close?.state === 'closed' && life.close?.writeAfterClose?.code === 'spill-write-after-close', JSON.stringify(life.close ?? null))
  check('L-W5-LIFE-IDINUSE', 'id-in-use REPLAY: re-opening the settled spillId is typed spill-id-in-use BEFORE any write-port call; payload + meta byte-identical (terminal fact preserved)', life.idInUse?.refused === true && life.idInUse?.refusal?.code === 'spill-id-in-use' && life.idInUse?.writePortDelta === 0 && life.idInUse?.payloadUnchanged === true && life.idInUse?.metaUnchanged === true, JSON.stringify(life.idInUse ?? null))
  check('L-W5-LIFE-FRESH', 'a FRESH store handle enumerates the residue with attribution + settlement (law 3, disk-not-memory)', Array.isArray(life.freshResidue) && life.freshResidue.length === 1 && life.freshResidue[0].attribution?.realmId === 'a5w5-realm' && life.freshResidue[0].settlement?.kind === 'completed', JSON.stringify(life.freshResidue ?? null))

  // ④ six event names: live lease settles + observation-stream census
  const six = asm.six ?? {}
  const sixRows = six.rows ?? []
  check('L-W5-EVENTS6-SETTLE', 'all six master full-prefix settlement names settle a live lease (verbatim), the retired short form is refused spill-settlement-event-unknown', sixRows.length === 6 && sixRows.every((r) => r.accepted === true && r.fullPrefix === true) && six.offSet?.refused === true && six.offSet?.refusal?.code === 'spill-settlement-event-unknown', JSON.stringify({ accepted: sixRows.filter((r) => r.accepted).length, off: six.offSet?.refusal?.code ?? null }))
  const census = asm.eventCensus ?? {}
  // The master@452a04c0 dispatcher-call- emission face: the six settlement
  // names (install.ts:651/662/673/686/763, lane constants above) PLUS the
  // call-lease lifecycle names (scoped-dispatcher.ts:528/535/545/559).
  const MASTER_CALL_NAMES = [...SIX, 'dispatcher-call-begin', 'dispatcher-call-end', 'dispatcher-call-refused']
  const callStream = Object.entries(census).filter(([n]) => n.startsWith('dispatcher-call-'))
  const streamInSet = callStream.every(([n]) => MASTER_CALL_NAMES.includes(n))
  const shortFormHits = Object.keys(census).filter((n) => /^call-/.test(n)) // retired v1.0 short forms must never appear
  const perNameCounts = Object.fromEntries(SIX.map((n) => [n, census[n] ?? 0]))
  check('L-W5-EVENTS6-STREAM', 'every dispatcher-call-* name on the LIVE observation stream is a master-emitted full-prefix name (six settlement names + begin/end/refused); NO retired short form appears; settlement-six stream counts recorded', streamInSet && shortFormHits.length === 0, `settlementSix=${JSON.stringify(perNameCounts)} streamCallNames=${JSON.stringify(Object.fromEntries(callStream))} guardDenial=${String(census['guard-denial'] ?? 0)} callRefused=${String(census['dispatcher-call-refused'] ?? 0)}`)
  writeEvidence('events6.json', { settlement_constants: SIX, live_settle: six, live_stream_census: census })

  // ⑤ negative controls (verbatim)
  const overpriv = toolCalls.find((c) => c.tool === 'search' && String(c.args?.path ?? '').includes('/outside')) ?? toolCalls.filter((c) => c.tool === 'search').slice(-1)[0]
  check('L-W5-OVERPRIV', 'ungranted call (policy-outside read): the PR2 kernel refused with its OWN typed vocabulary, verbatim, and NOTHING executed (grant null, presented null, backend exec delta 0)', overpriv !== undefined && overpriv.grantId === null && overpriv.presented === null && (overpriv.backendExecAfter ?? -1) === (overpriv.backendExecBefore ?? -2) && /A5W5-REFUSED/.test(transcriptText), overpriv === undefined ? 'no outside call row' : `stage=${String(overpriv.stage)} code=${JSON.stringify(overpriv.decisionVerbatim ?? null).slice(0, 160)}`)
  check('L-W5-DENY-ZERO', 'denied presentation is ZERO-BYTES payload with ZERO spill residue (live re-test of the parity-suite law)', overpriv !== undefined && overpriv.payloadBytes === 0 && overpriv.spillFilesDelta === 0, `payloadBytes=${String(overpriv?.payloadBytes)} spillDelta=${String(overpriv?.spillFilesDelta)}`)
  check('L-W5-UNBOUND', 'the post-assembly probe name is refused at the call edge by the live guard (TOOL_BINDING_UNVERIFIED face in the transcript) and its BODY never ran', (asm.probeBodyCount ?? -1) === 0 && /UNVERIFIED|denied|denial|not governed|refused/i.test(transcriptText), `probeBodyCount=${String(asm.probeBodyCount)} transcriptHit=${/UNVERIFIED|denied|denial|not governed|refused/i.test(transcriptText)}`)

  // ③ parity: governed vs raw, same inputs
  const rawRows = rawParity.body?.raw ?? []
  const rawByLabel = Object.fromEntries(rawRows.map((r) => [r.label, r]))
  const outcomes = asm.backendOutcomes ?? []
  const byCmd = (label) => {
    const raw = rawByLabel[label]
    const cmd = label === 'printf' ? "printf 'alpha\\nbeta\\n'" : label === 'stderr-exit3' ? 'echo out; echo err >&2; exit 3' : label === 'big-seq' ? 'seq 1 4000' : null
    const out = cmd !== null ? outcomes.find((o) => o.command === cmd) : outcomes.find((o) => o.argv !== undefined)
    return { raw, out }
  }
  const parity = []
  for (const label of ['printf', 'stderr-exit3', 'big-seq', 'grep-token']) {
    const { raw, out } = byCmd(label)
    if (label === 'grep-token') {
      // byte-leg through the spill: the governed backend wrote the RAW grep
      // stdout as the spill payload — compare it to the raw leg's stdout.
      const sp = searchCall?.spillPointer ?? null
      let spillSha = null
      try { spillSha = sp !== null ? `sha256:${createHash('sha256').update(readFileSync(join(SPILL, `${sp.spillId}.spill`))).digest('hex')}` : null } catch { /* missing */ }
      parity.push({ label, governed: { spillId: sp?.spillId ?? null, spillBytes: sp?.bytes ?? null, spillSha, outcomeRawSha: out?.rawStdoutSha ?? null, totalMatches: out?.totalMatches ?? null }, raw, equal: raw !== undefined && out !== undefined && spillSha !== null && spillSha === raw.stdoutSha && sp?.bytes === raw.stdoutBytes && out?.rawStdoutSha === raw.stdoutSha })
    } else {
      parity.push({ label, governed: out ?? null, raw: raw ?? null, equal: raw !== undefined && out !== undefined && out.stdoutSha === raw.stdoutSha && out.stderrSha === raw.stderrSha && out.exit === raw.exit })
    }
  }
  const grepParity = parity.find((p) => p.label === 'grep-token')
  check('L-W5-PARITY-SHELL', 'shell parity (governed vs RAW, same inputs): stdout/stderr sha + exit IDENTICAL for printf / stderr+exit3 / big-seq', ['printf', 'stderr-exit3', 'big-seq'].every((l) => parity.find((p) => p.label === l)?.equal === true), JSON.stringify(parity.filter((p) => p.label !== 'grep-token').map((p) => ({ l: p.label, eq: p.equal }))))
  check('L-W5-PARITY-SEARCH', 'search parity byte-leg: the governed spill payload is BYTE-IDENTICAL to the raw grep leg stdout (same argv), presentation is the renderer layer over the same bytes', grepParity?.equal === true, JSON.stringify({ spillBytes: grepParity?.governed?.spillBytes, rawBytes: grepParity?.raw?.stdoutBytes }))
  writeEvidence('parity.json', parity)

  // ── closure facts ────────────────────────────────────────────────────────
  const stableAfter = await stableProbe()
  check('L-W5-STABLE', 'the stable :3080 instance was only probed, never operated, status unchanged', String(stableBefore) === String(stableAfter), `before=${String(stableBefore)} after=${String(stableAfter)}`)
  const porcelainAfter = gitAt(TESTUSE, 'status', '--porcelain')
  check('L-W5-PRISTINE', 'the test-use runtime stayed pristine (porcelain empty, HEAD unmoved)', porcelainAfter === '' && gitAt(TESTUSE, 'rev-parse', 'HEAD') === TEST_USE_BASELINE_SHA, `porcelain=${porcelainAfter === '' ? 0 : 'DIRTY'}`)

  const failed = CRITERIA.filter((c) => !c.pass)
  writeEvidence('run-receipt.md', [
    `# a5w5 ${MODE} run ${RUN_STAMP}`,
    ``,
    `- host: ${TESTUSE} @ ${TEST_USE_BASELINE_SHA.slice(0, 10)} (pinned 0.2.0-rc.2)`,
    `- port ${HOST_PORT} · mock ${mockPort} · world ${KEEP ? `KEPT: ${HOME}` : 'deleted at teardown'}`,
    `- lane build: ${LANE_BUILD} · dist: ${DIST_PACKAGES}`,
    `- criteria: ${CRITERIA.length - failed.length}/${CRITERIA.length} pass${failed.length > 0 ? ` (RED: ${failed.map((c) => c.id).join(', ')})` : ''}`,
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
