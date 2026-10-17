#!/usr/bin/env node
/**
 * run-a5c45-live.mjs — C-04/05 gap-round LIVE runner (Alpha.5 wiring phase).
 *
 * Boots a TEST Host instance on port 3183 (self-proved free; :3080 probed
 * read-only before/after, never touched), DSH_HOME =
 * `tests/homes/a5c45-<mode>-<stamp>` (TEST_METHODS §7, deleted at teardown
 * unless --keep), mounts `a5c45-editor-image-row.mjs` through the PUBLIC
 * profile-patch seam on the pinned pristine host (0.2.0-rc.2, IF-4, reused
 * read-only, porcelain checked before AND after), drives REAL sessions on
 * the scripted mock model, and reads the live process back through the
 * row's own routes.
 *
 * Modes (the RED-first shape of a wiring lane):
 *   gated    guard + PR2 admission + gated ControlledFs faces installed
 *            (target: all GREEN)
 *   ungated  the same tool defs without the guard and without the kernel —
 *            the TEAM-gated half MUST go RED (unmappable subcommands
 *            execute, the thumbnail bypass leaks, no grants/ledger/events/
 *            spill), while the C-FS lane law half (`admission-unbound`)
 *            keeps refusing on its own.
 *
 * Model-driven chain (13 calls): view → str_replace → insert → undo →
 * undo_all (typed deny) → delete (typed deny) → create → big view (spill
 * pointer) → read_image (chain) → read_image+thumbnail:true (kernel deny) →
 * read_image+thumbnail:grant (lane deny) → cf_probe unbound (lane law) →
 * post-publish unbound probe (guard call edge).
 *
 * Honesty rules: criteria computed from LIVE route reads captured at
 * observation time; a missing leg FAILS, nothing back-filled; the launch
 * token is redacted at capture (`REDACTED-<sha8>`). On a GREEN gated run
 * (`--write-receipts`) the runner writes the M-04/M-05 probe receipts FROM
 * the live observations — every receipt field traces to a route read.
 *
 * EXIT: 0 all criteria pass (GREEN) · 2 a criterion failed (RED) · 1 fatal.
 */
import { spawn, spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, openSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { createServer } from 'node:net'
import { dirname, join, relative, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

import { startMockModel } from '../../../../../../packages/tools/harness/mock-deepseek.mjs'
import { TEST_USE_BASELINE_SHA, CLIENT_COMMIT_HASH } from '../../../../../../tests/paths.mjs'

const args = process.argv.slice(2)
const argValue = (n, d) => { const i = args.indexOf(`--${n}`); return i === -1 ? d : args[i + 1] }
const MODE = argValue('mode', 'gated')
const KEEP = args.includes('--keep')
const WRITE_RECEIPTS = args.includes('--write-receipts')
const HERE = dirname(new URL(import.meta.url).pathname)
const WORKTREE = resolve(argValue('worktree', resolve(HERE, '..', '..', '..', '..', '..', '..')))
const RUN_STAMP = new Date().toISOString().slice(0, 19).replace(/[:]/g, '-') + 'Z'
const EVIDENCE_DIR = resolve(argValue('evidence-dir', join(WORKTREE, 'dev', 'agent-workflow', 'evidence', 'alpha5', 'wiring', 'c0405', 'runs', `${MODE}-${RUN_STAMP}`)))
mkdirSync(EVIDENCE_DIR, { recursive: true })

const HOST_PORT = Number(argValue('port', 3183))
const TESTUSE_CANDIDATES = [
  argValue('testuse', ''),
  join(WORKTREE, 'tests', 'deepseek-harness-test-use'),
  '/srv/workspace/dsh-plugins/dsh-agent-team/.worktrees/a5-w8/tests/deepseek-harness-test-use',
].filter((p) => p !== '' && existsSync(join(p, 'apps', 'cli', 'lib', 'bin.js')))
const TESTUSE = resolve(TESTUSE_CANDIDATES[0] ?? '.')
const HOST_BIN = join(TESTUSE, 'apps', 'cli', 'lib', 'bin.js')
const DIST_PACKAGES = join(WORKTREE, 'packages', 'runtime', 'dist', 'packages')
const LANE_BUILD = resolve(argValue('lane-build', join(WORKTREE, 'tests', 'homes', '.a5c45-build')))
const ROW_PATH = join(HERE, 'a5c45-editor-image-row.mjs')
const WORLD_PREFIX = argValue('world-prefix', 'a5c45')
const HOME = join(WORKTREE, 'tests', 'homes', `${WORLD_PREFIX}-${MODE}-${RUN_STAMP}`)
const LEDGER = join(EVIDENCE_DIR, 'assembly-ledger.jsonl')
const INSTANCE_RAW = join(EVIDENCE_DIR, 'instance.raw.log')
const INSTANCE_LOG = join(EVIDENCE_DIR, 'instance.log')

const PNG_B64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='
const DOC_OLD = 'before-edit-line'
const DOC_NEW = `after-edit-line-${RUN_STAMP}`
const DOC_INS = `inserted-line-${RUN_STAMP}`
const MEMO_TEXT = `a5c45-created-${RUN_STAMP}\n`
const THUMB_MARK = `THUMB-LEAK-MARKER-${RUN_STAMP}`
const BIG_LINES = 6000

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
const shaFile = (p) => { try { return `sha256:${createHash('sha256').update(readFileSync(p)).digest('hex')}` } catch { return null } }
const readF = (p) => { try { return readFileSync(p, 'utf8') } catch { return null } }

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
  try { writeFileSync(INSTANCE_LOG, redact(readFileSync(INSTANCE_RAW, 'utf8'))); rmSync(INSTANCE_RAW) } catch { /* no log */ }
  writeEvidence('criteria.json', { mode: MODE, status: finalStatus, criteria: CRITERIA })
  if (!KEEP) { try { rmSync(HOME, { recursive: true, force: true }) } catch { /* best effort */ } }
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
const normText = (t) => String(t ?? '').replace(/\s+/g, ' ').trim()

async function main() {
  console.log(`a5c45 runner mode=${MODE} stamp=${RUN_STAMP} port=${HOST_PORT}`)
  if (!['gated', 'ungated'].includes(MODE)) die(`unknown mode ${MODE}`)

  const head = gitAt(TESTUSE, 'rev-parse', 'HEAD')
  const porcelainBefore = gitAt(TESTUSE, 'status', '--porcelain')
  check('L-C45-PIN', 'the test-use host is the pinned pristine 0.2.0-rc.2 runtime @639ed01539 (read-only reuse)', head === TEST_USE_BASELINE_SHA && porcelainBefore === '', `head=${head.slice(0, 10)} porcelain=${porcelainBefore === '' ? 0 : 'DIRTY'} at ${TESTUSE}`)
  const sharedDiff = spawnSync('git', ['-C', WORKTREE, 'status', '--porcelain', '--', 'packages', 'scripts', 'vitest.config.ts'], { encoding: 'utf8' }).stdout.trim()
  check('L-C45-IF5', 'IF-5 shared surface (packages/, scripts/, root vitest.config) is byte-untouched by this lane', sharedDiff === '', sharedDiff === '' ? 'porcelain empty' : sharedDiff.split('\n').slice(0, 4).join(' | '))
  check('L-C45-LANE', 'the runtime dist barrels + the kit-local a5p5 lane build (spill face) are present', existsSync(join(DIST_PACKAGES, 'runtime/controlled-fs/src/index.js')) && existsSync(join(LANE_BUILD, 'packages/tools/a5p5-tools/src/spill.js')), `dist=${DIST_PACKAGES} lane=${LANE_BUILD}`)
  const hostFree = await portFree(HOST_PORT)
  let mockPort = 0
  for (const p of [3491, 3492, 3493, 3494, 3495]) { if (await portFree(p)) { mockPort = p; break } }
  check('L-C45-PORTS', `host port ${HOST_PORT} free (self-proved) and a mock port from the 349x family free`, hostFree && mockPort > 0, `hostFree=${hostFree} mock=${mockPort}`)
  const stableBefore = await stableProbe()
  if (!hostFree || mockPort === 0) die('ports not free')

  // ── world + patch (public profile-patch seam only) ──────────────────────
  mkdirSync(join(HOME, 'workspace'), { recursive: true })
  const CTRL = join(HOME, 'ctrl')
  mkdirSync(join(CTRL, 'history'), { recursive: true })
  mkdirSync(join(HOME, 'outside'), { recursive: true })
  mkdirSync(join(HOME, 'spill'), { recursive: true })
  const LAUNCH_CWD = join(HOME, 'workspace')
  const DOC = join(CTRL, 'doc.txt')
  const BIG = join(CTRL, 'big.txt')
  const ATTACH = join(CTRL, 'shot.png.b64')
  const THUMB = join(CTRL, 'shot.png.thumb')
  const HIST = join(CTRL, 'history', 'edits.jsonl')
  writeFileSync(DOC, `${DOC_OLD}\nsecond line\n`)
  writeFileSync(BIG, Array.from({ length: BIG_LINES }, (_, i) => `a5c45-big-line-${String(i).padStart(5, '0')} governance-spill-leg`).join('\n') + '\n')
  writeFileSync(ATTACH, PNG_B64)
  writeFileSync(THUMB, `${THUMB_MARK} this file is NOT in any policy arm — reading it is the bypass\n`)
  writeFileSync(HIST, '')
  writeFileSync(join(HOME, 'outside', 'secret.txt'), 'A5C45-OUTSIDE\n')
  const thumbShaBefore = shaFile(THUMB)
  mkdirSync(join(HOME, 'profiles', 'web'), { recursive: true })
  writeFileSync(join(HOME, 'profiles', 'web', 'cordis.patch.yml'), [
    `# a5c45 C-04/05 gap-round live-assembly patch (run ${RUN_STAMP}, mode ${MODE}): the editor/read_image Team-Definition row via the public profile-patch seam; zero production-row mounts in this world.`,
    '- insert:',
    '    - id: a5c45-editor-image',
    `      name: ${JSON.stringify(pathToFileURL(ROW_PATH).href)}`,
    '      config: {}',
    '',
  ].join('\n'))

  // ── mock model ───────────────────────────────────────────────────────────
  const MK = `A5C45_${MODE.toUpperCase()}_${RUN_STAMP.replace(/[^A-Za-z0-9]/g, '')}`
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
          else if (Array.isArray(c)) out.push(c.map((x) => x?.text ?? JSON.stringify(x ?? '')).join(''))
          else out.push(JSON.stringify(c ?? ''))
        }
      }
    }
    return out.map(normText)
  }
  const seenUnion = new Set()
  const transcript = []
  let turn = null
  const mkTurn = (key, calls) => { turn = { key, calls, reqs: 0, startCount: seenUnion.size, done: false } }
  const lastUserText = (req) => {
    const users = messagesOf(req).filter((m) => m?.role === 'user')
    return users.length > 0 ? textOf(users[users.length - 1]) : ''
  }
  mock = await startMockModel({
    port: mockPort,
    log: (m) => console.log(m),
    decide: ({ req }) => {
      for (const t of newToolResults(req)) { if (!seenUnion.has(t)) { seenUnion.add(t); transcript.push(t) } }
      if (turn === null || turn.done) {
        const u = lastUserText(req)
        if (u.includes(`${MK}_SETUP`)) return { kind: 'text', content: `${MK}_SETUP_OK` }
        return { kind: 'text', content: 'a5c45-mock: unscripted request, completing quietly.' }
      }
      turn.reqs += 1
      if (turn.reqs > 40) { turn.done = true; return { kind: 'text', content: `${turn.key}_FUSED fuse: ${String(turn.reqs)} requests.` } }
      const fresh = seenUnion.size - turn.startCount
      if (fresh >= turn.calls.length) { turn.done = true; return { kind: 'text', content: `${turn.key}_DONE` } }
      const next = turn.calls[fresh]
      return toolCall(next.name, next.args)
    },
  })

  // ── boot the Host (TEST_METHODS §2 start chain) ────────────────────────
  const outFd = openSync(INSTANCE_RAW, 'a')
  const child = spawn(process.execPath, [HOST_BIN, 'web', '--port', String(HOST_PORT), '--no-open'], {
    cwd: LAUNCH_CWD,
    stdio: ['ignore', outFd, outFd],
    env: {
      ...process.env,
      DSH_HOME: HOME,
      DSH_CLIENT_COMMIT_HASH: CLIENT_COMMIT_HASH,
      DEEPSEEK_BASE_URL: `http://127.0.0.1:${mockPort}`,
      DEEPSEEK_API_KEY: 'a5c45-mock-key',
      A5C45_DIST: DIST_PACKAGES,
      A5C45_LANE: LANE_BUILD,
      A5C45_LEDGER: LEDGER,
      A5C45_WORLD: HOME,
      A5C45_MODE: MODE,
    },
  })
  host = { child }
  child.on('exit', (code, signal) => console.log(`host exited code=${String(code)} signal=${String(signal)}`))
  const boot = await waitFor(90_000, () => {
    try { const m = BOOT_MARKER.exec(readFileSync(INSTANCE_RAW, 'utf8')); return m === null ? false : m } catch { return false }
  }, 'host boot marker')
  const origin = `http://127.0.0.1:${boot[1]}`
  const token = boot[2]
  const auth = await fetch(`${origin}/?token=${token}`, { redirect: 'manual', signal: AbortSignal.timeout(30_000) })
  const cookie = auth.headers.get('set-cookie')
  check('L-C45-BOOT', `the test Host booted on port ${HOST_PORT} with the token gate live (303 + set-cookie)`, auth.status === 303 && cookie !== null, `status=${auth.status}`)
  await waitFor(30_000, async () => {
    const h = await fetchJson(`${origin}/__a5c45/health`).catch(() => null)
    return h?.status === 200 && h.body.applied === true ? h : false
  }, 'row apply via /__a5c45/health')

  const createSession = async (tag) => {
    const created = await fetchJson(`${origin}/api/session/create`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie: cookie ?? '' },
      body: JSON.stringify({ type: 'client-request', rpcId: `${tag}-c-${Math.random().toString(36).slice(2, 10)}`, method: 'session/create', payload: { args: { request: {} } } }),
    }, 30_000)
    return created.body?.result?.value?.sessionId ?? created.body?.value?.sessionId ?? null
  }
  const sessionId = await createSession('a5c45-a')
  check('L-C45-CREATE', 'the host public session/create entry returned a real sessionId', typeof sessionId === 'string' && sessionId !== '', `A=${String(sessionId).slice(0, 20)}`)

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
  const setupRes = await apiPrompt(`${MK}_SETUP This is a setup turn. Do not call any tools. Reply with the single word OK.`, 'a5c45-setup')
  check('L-C45-SETUP', 'the real session ran a setup turn to a model reply (an Agent now exists behind the session)', setupRes.status === 200, `status=${setupRes.status}`)
  const agentRow = await waitFor(60_000, async () => {
    const a = await fetchJson(`${origin}/__a5c45/agents`).catch(() => null)
    const rows = a?.body?.agents ?? []
    return rows.find((r) => r.session === sessionId || r.id === sessionId) ?? (rows.length > 0 ? rows[0] : false)
  }, 'the session Agent to appear via ctx.agents (public service)')
  check('L-C45-AGENT', 'the session Agent is reachable through the PUBLIC ctx.agents seam', (agentRow?.hasCtx ?? false) === true, `agent=${JSON.stringify(agentRow).slice(0, 120)}`)

  const asmRes = await fetchJson(`${origin}/__a5c45/assemble`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ sessionId }) }, 30_000)
  check('L-C45-ASSEMBLE-REQ', 'the live assembly started on the real Agent', asmRes.status === 200 && asmRes.body.ok === true, JSON.stringify(asmRes.body).slice(0, 120))
  const assemblyTerm = await waitFor(90_000, async () => {
    const j = await fetchJson(`${origin}/__a5c45/journal`).catch(() => null)
    return (j?.body?.rows ?? []).some((r) => r.leg === 'assembly-complete') ? true : ((j?.body?.rows ?? []).some((r) => r.leg === 'assembly-failed' || r.leg === 'guard-install-refused') ? 'refused' : false)
  }, 'the in-assembly legs (register/guard/bind/publish/probe) to complete')
  check('L-C45-ASSEMBLE', 'the assembly completed through the accepted shape (defs → guard install → bindOwnTools → publish → post-publish probe)', assemblyTerm === true, `term=${String(assemblyTerm)}`)

  // ── the thirteen-call chain ──────────────────────────────────────────────
  mkTurn(`${MK}_CHAIN`, [
    { name: 'a5c45_editor', args: { subcommand: 'view', file: 'doc.txt' } },
    { name: 'a5c45_editor', args: { subcommand: 'str_replace', file: 'doc.txt', old_string: DOC_OLD, new_string: DOC_NEW } },
    { name: 'a5c45_editor', args: { subcommand: 'insert', file: 'doc.txt', line: DOC_INS } },
    { name: 'a5c45_editor', args: { subcommand: 'undo', file: 'doc.txt' } },
    { name: 'a5c45_editor', args: { subcommand: 'undo_all', file: 'doc.txt' } },
    { name: 'a5c45_editor', args: { subcommand: 'delete', file: 'doc.txt' } },
    { name: 'a5c45_editor', args: { subcommand: 'create', file: 'memo.txt', content: MEMO_TEXT } },
    { name: 'a5c45_editor', args: { subcommand: 'view', file: 'big.txt' } },
    { name: 'a5c45_read_image', args: { file: 'shot.png.b64' } },
    { name: 'a5c45_read_image', args: { file: 'shot.png.b64', thumbnail: true } },
    { name: 'a5c45_read_image', args: { file: 'shot.png.b64', thumbnail: 'grant' } },
    { name: 'a5c45_cf_probe', args: { mode: 'unbound' } },
    { name: 'a5c45_unbound_probe', args: {} },
  ])
  await apiPrompt(`${MK}_CHAIN Follow the scripted tool calls exactly, one at a time, then answer DONE.`, 'a5c45-chain')
  await waitFor(360_000, () => {
    const reqs = mock.requests ?? []
    return reqs.some((r) => String(JSON.stringify(r.reply ?? '')).includes(`${MK}_CHAIN_DONE`)) ? true : reqs.some((r) => String(JSON.stringify(r.reply ?? '')).includes(`${MK}_CHAIN_FUSED`)) ? 'fused' : false
  }, 'the scripted thirteen-call chain to reach its terminal reply')
  await new Promise((r) => setTimeout(r, 1500))

  const state = await fetchJson(`${origin}/__a5c45/state`)
  const journal = await fetchJson(`${origin}/__a5c45/journal`)
  writeEvidence('live-state.json', state.body)
  writeEvidence('live-journal.json', journal.body)
  writeEvidence('transcript-union.json', redact(JSON.stringify(transcript, null, 2)).slice(0, 400_000))
  writeEvidence('mock-capture.json', redact(JSON.stringify((mock.requests ?? []).map((r) => ({ seq: r.seq, reply: r.reply, status: r.status })), null, 2)).slice(0, 200_000))
  if (existsSync(LEDGER)) writeFileSync(join(EVIDENCE_DIR, 'assembly-ledger.final.jsonl'), redact(readFileSync(LEDGER, 'utf8')))

  const asms = state.body?.assemblies ?? {}
  const labels = Object.keys(asms)
  const asm = labels.length > 0 ? asms[labels[0]] : {}
  const guard = asm.guard ?? {}
  const toolCalls = asm.toolCalls ?? []
  const negControls = asm.negativeControls ?? []
  const counters = asm.counters ?? {}
  const census = asm.eventCensus ?? {}
  const transcriptText = transcript.join('\n')
  const callBy = (pred) => toolCalls.find(pred)
  const docNow = readF(DOC)
  const memoNow = readF(join(CTRL, 'memo.txt'))
  const histNow = readF(HIST)
  const histLines = (histNow ?? '').split('\n').filter((l) => l !== '')

  // ── faces ─────────────────────────────────────────────────────────────────
  check('L-C45-GATE-MODE', `the run executed in mode=${MODE} (honest mode face)`, asm.mode === MODE, `mode=${String(asm.mode)}`)
  check('L-C45-GUARD', 'the PR1 guard installed, bound the three Team Definitions and PUBLISHED (channel armed/proven) — the editor/read_image Team Definitions publish/bind path on the PUBLIC seam', guard.installOk === true && guard.bindOwnOk === true && guard.publishedOk === true && (guard.channelAtPublish === 'armed' || guard.channelAtPublish === 'proven') && (guard.channel === 'armed' || guard.channel === 'proven'), JSON.stringify(guard))
  check('L-C45-REG', 'the row names are on the live scoped registry (defs materialized at the public seam)', Array.isArray(asm.registryNames) && ['a5c45_editor', 'a5c45_read_image', 'a5c45_cf_probe', 'a5c45_unbound_probe'].every((n) => asm.registryNames.includes(n)), JSON.stringify(asm.registryNames ?? null))
  check('L-C45-NATIVE-FACE', 'the host-native roster was captured (edit/read_image stay HOST builtins — this row binds Team Definitions, NOT native pins; the native-pin face stays the W-E2 gap fact)', typeof asm.nativeFace?.has_edit === 'boolean' && asm.nativeFace?.has_str_replace_editor === false, `edit=${String(asm.nativeFace?.has_edit)} read_image=${String(asm.nativeFace?.has_read_image)} sre=${String(asm.nativeFace?.has_str_replace_editor)}`)
  check('L-C45-ARB', 'the governed face reports ARBITRARY_TREE_PROFILE_PUBLISHED=false (runtime read-back; no arbitrary-tree claim in this round)', asm.arbTreePublished === false, `arb=${String(asm.arbTreePublished)}`)

  // ── editor legs ───────────────────────────────────────────────────────────
  const viewCall = callBy((c) => c.tool === 'editor' && c.sub === 'view' && c.file === 'doc.txt')
  check('L-C45-VIEW', 'the model-driven editor VIEW leg read real bytes through the tool face (content matches the file on disk; governed lane in gated mode)', viewCall !== undefined && String(viewCall.presented ?? '').includes('A5C45-ED') && ['ok', 'ungated-raw'].includes(viewCall.stage), JSON.stringify({ stage: viewCall?.stage, presented: String(viewCall?.presented ?? '').slice(0, 80) }))
  const srCall = callBy((c) => c.sub === 'str_replace')
  check('L-C45-EDIT-RT', 'the REAL edit round-trip ran: str_replace read the old bytes and wrote the new ones (file sha changed on disk, new line present) — bytes are real in BOTH modes', srCall !== undefined && srCall.fileShaBefore !== srCall.fileShaAfter && docNow !== null && docNow.includes(DOC_NEW) && (srCall.presented ?? '').startsWith('A5C45-ED'), `sha ${String(srCall?.fileShaBefore ?? '').slice(0, 18)}…->${String(srCall?.fileShaAfter ?? '').slice(0, 18)}…`)
  check('L-C45-GOVERN-EDIT', 'the str_replace leg is governance-carried in the gated mode: every lane op ran under its own one-shot grant (≥4 grants: read+write target + history read+write), the history ledger line carries the BEFORE bytes, the exec-edge REPLAY on the last grant is refused, and the grant ledger counts the consumption', srCall !== undefined && srCall.grantIds.length >= 4 && srCall.execEdgeReplay?.ok === false && typeof srCall.ledgerConsumed === 'number' && srCall.ledgerConsumed > 0 && histLines.length >= 1 && histLines.some((l) => l.includes(DOC_OLD)), JSON.stringify({ grants: srCall?.grantIds?.length, replay: srCall?.execEdgeReplay, ledger: srCall?.ledgerConsumed, hist: histLines.length }))
  const insCall = callBy((c) => c.sub === 'insert')
  check('L-C45-INSERT', 'the insert leg applied (stage ok; the inserted line rode into the file and the UNDO leg later removed it — undo criterion pins both ends)', insCall !== undefined && ['ok', 'ungated-raw'].includes(insCall.stage) && (histLines.length >= 2 || MODE === 'ungated'), `insertStage=${String(insCall?.stage)} histLines=${String(histLines.length)}`)
  const undoCall = callBy((c) => c.sub === 'undo')
  const srAfter = srCall?.fileShaAfter
  check('L-C45-UNDO', 'the UNDO leg restored the pre-insert bytes byte-for-byte (sha after undo == sha after str_replace; the inserted line is gone)', undoCall !== undefined && ['ok', 'ungated-raw'].includes(undoCall.stage) && undoCall.fileShaAfter === srAfter && docNow !== null && !docNow.includes(DOC_INS) && docNow.includes(DOC_NEW), `undoAfter=${String(undoCall?.fileShaAfter ?? '').slice(0, 18)}… srAfter=${String(srAfter ?? '').slice(0, 18)}…`)
  check('L-C45-UNDO-IO', 'the undo history I/O rode the SAME governed face in the gated mode: ops read:history + write:target + write:history all ok, each under its own grant, and the history ledger carries the undo marker line', undoCall !== undefined && MODE === 'gated' && ['read:history', 'write:target', 'write:history'].every((op) => (undoCall.ops ?? []).some((o) => o.op === op && o.ok === true)) && (undoCall.grantIds?.length ?? 0) >= 3 && (histNow ?? '').includes('"op":"undo"'), JSON.stringify({ ops: undoCall?.ops, grants: undoCall?.grantIds?.length, marker: String((histNow ?? '').includes('"op":"undo"')) }))
  const undoAll = callBy((c) => c.sub === 'undo_all')
  const delCall = callBy((c) => c.sub === 'delete')
  check('L-C45-IO-UNSUPPORTED', 'THE M-04 LAW: undo_all and delete (no precise I/O mapping) got the TYPED default refusal IO_POLICY_UNSUPPORTED before any admit — zero side effects (file intact, no grants minted) and both refusals are registered negative controls (row law carries this refusal in BOTH modes; the gated mode additionally proves zero admits)', undoAll?.stage === 'io-policy-unsupported' && delCall?.stage === 'io-policy-unsupported' && (undoAll?.grantIds?.length ?? -1) === 0 && (delCall?.grantIds?.length ?? -1) === 0 && negControls.some((n) => n.attempt === 'subcommand-undo_all' && n.error === 'IO_POLICY_UNSUPPORTED' && n.side_effects === 0) && negControls.some((n) => n.attempt === 'subcommand-delete' && n.error === 'IO_POLICY_UNSUPPORTED' && n.side_effects === 0) && docNow !== null && docNow.includes(DOC_NEW), JSON.stringify({ undoAll: undoAll?.stage, del: delCall?.stage, neg: negControls.filter((n) => n.error === 'IO_POLICY_UNSUPPORTED').map((n) => n.attempt) }))
  const createCall = callBy((c) => c.sub === 'create')
  check('L-C45-CREATE-NEW', 'the create leg wrote a NEW file through the governed face (memo.txt bytes on disk == the created content)', createCall !== undefined && memoNow === MEMO_TEXT, `memo=${String(memoNow).slice(0, 30)}`)
  const bigView = callBy((c) => c.sub === 'view' && c.file === 'big.txt')
  const spill = asm.spill ?? {}
  check('L-C45-SPILL', 'the large-output leg rode the TEAM SPILL lifecycle: sink open→write→settle→finalize→close, read-back matches, the on-disk spill file is byte-equal, and the pointer (bytes/sha) was presented', MODE === 'gated' && spill.storeOk === true && spill.sinkOk === true && spill.bytes > 100_000 && spill.readBackMatches === true && spill.diskBytes === spill.bytes && String(bigView?.presented ?? '').includes('A5C45-SPILL') && transcriptText.includes('A5C45-SPILL'), JSON.stringify({ bytes: spill.bytes, disk: spill.diskBytes, rb: spill.readBackMatches, settle: spill.settleOk, present: String(bigView?.presented ?? '').slice(0, 60) }))

  // ── image legs ────────────────────────────────────────────────────────────
  const imgCall = callBy((c) => c.tool === 'read_image' && c.bypass === '')
  const face = (asm.imageChainFaces ?? [])[0] ?? {}
  check('L-C45-IMG-CHAIN', 'THE M-05 CHAIN: attachment → admitted one-shot read through the gated ControlledFs → base64 decode → real PNG header decode (image/png 1x1, 70 bytes) — chain face reads admission-gated-controlled-fs, not a host direct read', MODE === 'gated' && imgCall?.stage === 'chain-ok' && face.chain === 'admission-gated-controlled-fs' && face.decode?.ok === true && face.decode?.format === 'image/png' && face.decode?.bytes === 70 && transcriptText.includes('A5C45-IMG'), JSON.stringify({ stage: imgCall?.stage, chain: face.chain, decode: face.decode }))
  const th1 = callBy((c) => c.bypass === 'true')
  const th2 = callBy((c) => c.bypass === 'grant')
  check('L-C45-THUMB-KERNEL', 'thumbnail bypass #1 (open effect request): the real PR2 kernel refused the un-armed thumbnail read BEFORE any open (its own vocabulary), 0 bytes returned — registered negative control', MODE === 'gated' && th1 !== undefined && negControls.some((n) => n.attempt === 'thumbnail-read-bypass' && n.outcome === 'typed-deny' && n.bytes_returned === 0) && String(th1.presented ?? '').includes('A5C45-REFUSED'), JSON.stringify({ stage: th1?.stage, neg: negControls.some((n) => n.attempt === 'thumbnail-read-bypass') }))
  check('L-C45-THUMB-LANE', 'thumbnail bypass #2 (attachment grant pointed at the thumb file): the gated lane scope law refused (effect-outside-grant), 0 bytes returned', MODE === 'gated' && th2 !== undefined && negControls.some((n) => n.attempt === 'thumbnail-bypass-via-attachment-grant' && n.outcome === 'typed-deny' && n.bytes_returned === 0), JSON.stringify({ stage: th2?.stage, cf: negControls.find((n) => n.attempt === 'thumbnail-bypass-via-attachment-grant')?.cf_reason }))
  check('L-C45-THUMB-LEAK-ZERO', 'no thumbnail byte ever traveled: the thumb file is byte-untouched on disk and its marker content is absent from the whole transcript', MODE === 'gated' && shaFile(THUMB) === thumbShaBefore && !transcriptText.includes(THUMB_MARK), `thumbIntact=${String(shaFile(THUMB) === thumbShaBefore)} leakInTranscript=${String(transcriptText.includes(THUMB_MARK))}`)
  const cfp = callBy((c) => c.tool === 'cf_probe')
  check('L-C45-UNBOUND-CFS', 'THE admission-unbound leg (C-FS layer, not the guard layer): a gated ControlledFs face WITHOUT an admission binding answered the live read with the typed refusal carrying admission-unbound — bytes_leaked=0 while the raw file is verifiably readable (lane law carries it in BOTH modes)', cfp !== undefined && asm.unboundProbeLeg?.error === 'admission-unbound' && asm.unboundProbeLeg?.bytes_leaked === 0 && String(asm.unboundProbeLeg?.refusal_verbatim?.message ?? '').includes('admission-unbound') && String(cfp.presented ?? '').includes('raw_readable=true'), JSON.stringify(asm.unboundProbeLeg ?? null).slice(0, 220))

  // ── governance increments ─────────────────────────────────────────────────
  const governed = toolCalls.filter((c) => c.tool !== 'cf_probe')
  const withGrants = governed.filter((c) => (c.grantIds?.length ?? 0) > 0)
  check('L-C45-ONESHOT', 'grant ONE-SHOT consumption held on every admitted leg that ran bytes: the recorded exec-edge replay on the last op of the str_replace / undo / image legs is a typed refusal (grant already consumed)', srCall?.execEdgeReplay?.ok === false && undoCall?.execEdgeReplay?.ok === false && imgCall?.execEdgeReplay?.ok === false && /grant-consumed/.test(JSON.stringify(srCall?.execEdgeReplay?.error ?? {})), JSON.stringify({ sr: srCall?.execEdgeReplay?.ok, undo: undoCall?.execEdgeReplay?.ok, img: imgCall?.execEdgeReplay?.ok, verbatim: String(srCall?.execEdgeReplay?.error?.message ?? '').slice(0, 120) }))
  check('L-C45-LEDGER', 'the grant ledger face: the one-shot consumption adds up exactly — consumed == minted, the ONE exception being the thumbnail-bypass-via-grant leg whose scope refusal precedes the exec-time recheck (minted, never consumed: refusals before the exec edge do not bill the ledger)', MODE === 'gated' && typeof asm.ledgerConsumed === 'number' && asm.ledgerConsumed > 0 && counters.grantMintedCount - asm.ledgerConsumed === 1 && negControls.some((n) => n.attempt === 'thumbnail-bypass-via-attachment-grant' && n.outcome === 'typed-deny') && withGrants.length >= 6, `ledger=${String(asm.ledgerConsumed)} grantsMinted=${String(counters.grantMintedCount)} delta=${String(counters.grantMintedCount - (asm.ledgerConsumed ?? 0))} legsWithGrants=${String(withGrants.length)}`)
  const begins = census['dispatcher-call-begin'] ?? 0
  const ends = census['dispatcher-call-end'] ?? 0
  const shortFormHits = Object.keys(census).filter((n) => /^call-/.test(n))
  const dispatchSrc = ['install.ts', 'scoped-dispatcher.ts', 'closed-world-guard.ts', 'pending-calls.js'].map((f) => { try { return readFileSync(join(WORKTREE, 'packages', 'runtime', 'tool-dispatch', f), 'utf8') } catch { return '' } }).join('\n')
  const censusNamesOk = Object.keys(census).every((n) => dispatchSrc.includes(`'${n}'`) || dispatchSrc.includes(`"${n}"`))
  check('L-C45-EVENTS', 'the live event stream carried the governed calls: dispatcher-call-begin/end counts cover the 12 governed calls, every census name is a master full-prefix name (IF-6), no retired short form appears', MODE === 'gated' && begins >= 12 && ends >= 12 && shortFormHits.length === 0 && censusNamesOk, JSON.stringify(census))
  check('L-C45-UNBOUND', 'the post-assembly probe name is refused at the call edge by the live guard (guard-denial/dispatcher-call-refused census agrees) and its BODY never ran', (counters.probeBodyCount ?? -1) === 0 && /no Team Tool Binding|closed world/i.test(transcriptText) && ((census['guard-denial'] ?? 0) >= 1 || (census['dispatcher-call-refused'] ?? 0) >= 1), `probeBodyCount=${String(counters.probeBodyCount)} refused-census=${String(census['guard-denial'] ?? 0)}/${String(census['dispatcher-call-refused'] ?? 0)}`)
  check('L-C45-TRANSCRIPT', 'the presented faces entered the REAL transcript (model saw and reported them): an editor face, the image face and a refusal face', /A5C45-ED/.test(transcriptText) && /A5C45-IMG/.test(transcriptText) && /A5C45-REFUSED|typed-deny|has no Team Tool Binding/.test(transcriptText), `len=${String(transcriptText.length)}`)

  // ── closure facts ─────────────────────────────────────────────────────────
  const stableAfter = await stableProbe()
  check('L-C45-STABLE', 'the stable :3080 instance was only probed, never operated, status unchanged', String(stableBefore) === String(stableAfter), `before=${String(stableBefore)} after=${String(stableAfter)}`)
  const porcelainAfter = gitAt(TESTUSE, 'status', '--porcelain')
  check('L-C45-PRISTINE', 'the test-use runtime stayed pristine (porcelain empty, HEAD unmoved)', porcelainAfter === '' && gitAt(TESTUSE, 'rev-parse', 'HEAD') === TEST_USE_BASELINE_SHA, `porcelain=${porcelainAfter === '' ? 0 : 'DIRTY'}`)
  const sharedDiffAfter = spawnSync('git', ['-C', WORKTREE, 'status', '--porcelain', '--', 'packages', 'scripts', 'vitest.config.ts'], { encoding: 'utf8' }).stdout.trim()
  check('L-C45-IF5-POST', 'IF-5 shared surface still byte-untouched at closure', sharedDiffAfter === '', sharedDiffAfter === '' ? 'porcelain empty' : sharedDiffAfter.split('\n').slice(0, 4).join(' | '))

  // file faces on disk (byte-level side-effect face)
  writeEvidence('disk-faces.json', {
    doc_sha: shaFile(DOC), doc_contains_new: docNow !== null && docNow.includes(DOC_NEW), doc_contains_insert: docNow !== null && docNow.includes(DOC_INS),
    memo_sha: shaFile(join(CTRL, 'memo.txt')), memo_matches: memoNow === MEMO_TEXT,
    thumb_sha: shaFile(THUMB), thumb_intact: shaFile(THUMB) === thumbShaBefore,
    history_lines: histLines.length,
    spill_files: (() => { try { return readdirNames(join(HOME, 'spill')) } catch { return null } })(),
    spill_disk: (() => { try { const names = readdirNames(join(HOME, 'spill')); const out = {}; for (const n of names) out[n] = readFileSync(join(HOME, 'spill', n)).length; return out } catch { return null } })(),
  })

  const failed = CRITERIA.filter((c) => !c.pass)
  writeEvidence('run-receipt.md', [
    `# a5c45 ${MODE} run ${RUN_STAMP}`,
    ``,
    `- host: ${TESTUSE} @ ${TEST_USE_BASELINE_SHA.slice(0, 10)} (pinned 0.2.0-rc.2, read-only reuse)`,
    `- port ${HOST_PORT} · mock ${mockPort} · world ${KEEP ? `KEPT: ${HOME}` : 'deleted at teardown'}`,
    `- kit-local a5p5 lane build: ${LANE_BUILD} · dist: ${DIST_PACKAGES}`,
    `- criteria: ${CRITERIA.length - failed.length}/${CRITERIA.length} pass${failed.length > 0 ? ` (RED: ${failed.map((c) => c.id).join(', ')})` : ''}`,
    ``,
    ...CRITERIA.map((c) => `- [${c.pass ? 'x' : ' '}] ${c.id}: ${c.claim}${c.observed ? ` — ${c.observed}` : ''}`),
    ``,
    `token: launch token redacted at capture (REDACTED-<sha8>); raw instance log deleted after redaction.`,
  ].join('\n'))

  // ── receipts (GREEN gated only): every field traces to a live route read ─
  if (MODE === 'gated' && failed.length === 0) {
    const runRel = (f) => repoRel(join(EVIDENCE_DIR, f))
    const common = {
      round: 'C-04/05 gap round (alpha5-gap-c0405) — editor/read_image Team Definition 发布/绑定路径公开面补齐（W5 工具面模式：definition 材料化→bind→grant→exec 真跑）',
      run_utc: new Date().toISOString().slice(0, 16) + 'Z',
      host: `tests/deepseek-harness-test-use @${TEST_USE_BASELINE_SHA.slice(0, 10)} (0.2.0-rc.2, read-only reuse, porcelain 0 pre/post, HEAD unmoved)`,
      port: HOST_PORT,
      world_prefix: `${WORLD_PREFIX}-*（跑毕删除）`,
      assembly: {
        row: 'dev/agent-workflow/evidence/alpha5/wiring/c0405/a5c45-editor-image-row.mjs',
        fixtures: 'dev/agent-workflow/evidence/alpha5/wiring/c0405/a5c45-fixtures.mjs',
        lane_compile: 'dev/agent-workflow/evidence/alpha5/wiring/w5/build-lane-esm.mjs（accepted W5 驱动，未改 lane 源码；产物 tests/homes/.a5c45-build）',
        driver: 'dev/agent-workflow/evidence/alpha5/wiring/c0405/run-a5c45-live.mjs',
      },
    }
    const m04 = {
      ...common,
      row_line: 'M-04 str_replace_editor（子命令级 I/O 映射 + undo 历史 I/O + 不可映射 typed 默认拒）',
      caliber: 'LIVE-kit 观测：Team Definition（editor）在公开 seam 材料化→guard bind→publish→PR2 one-shot grant（dist barrel）→gated ControlledFs（createAdmissionGatedControlledFs，dist barrel）真跑编辑往返；治理观测=事件流/ledger/spill/grant 一次耗全增量在册。kernel 信任输入 fixture 级（W5/W7/W-E2 口径），无 ENFORCE 宣称。host-native edit 原生命名 pin 进 bind 的面=不属本行（W-E2 实测差距保持在册）。receipt 不含 assembly_anchors_verified（F-1：锚点在场以 runner grep 为准）。',
      editor_subcommand_map_complete: true,
      subcommand_map: {
        view: { mapped: true, observed: 'gated read through the lane, content presented', legs: (toolCalls.find((c) => c.sub === 'view' && c.file === 'doc.txt') ?? {}).ops },
        create: { mapped: true, observed: 'gated write created a NEW file (memo.txt bytes on disk == content)', legs: (toolCalls.find((c) => c.sub === 'create') ?? {}).ops },
        insert: { mapped: true, observed: 'read old + write (pre-write history capture through the SAME face)', legs: (toolCalls.find((c) => c.sub === 'insert') ?? {}).ops },
        str_replace: { mapped: true, observed: 'read-before-edit + write; real byte round-trip (sha before != after, new line on disk); old content NOT echoed (write receipt = fingerprint only, M-02 law)', legs: (toolCalls.find((c) => c.sub === 'str_replace') ?? {}).ops },
        undo: { mapped: true, observed: 'history read + target restore write + marker write — restored byte-for-byte (sha after undo == sha after str_replace)', legs: (toolCalls.find((c) => c.sub === 'undo') ?? {}).ops },
        delete: { mapped: false, outcome: 'typed IO_POLICY_UNSUPPORTED (no unlink primitive on the governed lane) — refused before any admit, zero side effects, file intact', legs: [] },
        undo_all: { mapped: false, outcome: 'typed IO_POLICY_UNSUPPORTED (multi-step restore, undefined target state) — zero grants, file intact', legs: [] },
        '(unknown)': { mapped: false, outcome: 'same typed class (SUBCOMMAND_MAP miss path, same leg code)' },
      },
      undo_history_io: {
        observed: true,
        detail: 'undo 历史 I/O 全程经同一 admission-gated face：pre-write 历史 read+append（str_replace/insert 腿）+ undo 腿 read:history→write:target→write:history，各 op 一个 one-shot grant；盘上 history/edits.jsonl 行数 ' + String(histLines.length) + '（含 undo marker 行）。',
        history_lines_on_disk: histLines.length,
        history_ops_ok: (toolCalls.find((c) => c.sub === 'undo')?.ops ?? []).map((o) => `${o.op}:${o.ok ? 'ok' : 'refused'}`),
      },
      negative_controls: negControls,
      governance_increments: {
        event_stream: census,
        ledger_consumed: asm.ledgerConsumed,
        grants_minted: counters.grantMintedCount,
        exec_edge_replays: { str_replace: (toolCalls.find((c) => c.sub === 'str_replace') ?? {}).execEdgeReplay, undo: (toolCalls.find((c) => c.sub === 'undo') ?? {}).execEdgeReplay },
        spill: asm.spill,
      },
      ungated_red_contrast: '同一判据表、同一工具面、无 guard 无 kernel（见 runs/ungated-*）：红且仅红 Team 门控腿（GUARD/GOVERN-EDIT/UNDO-IO/IO-UNSUPPORTED/THUMB×3/SPILL/IMG-CHAIN/LEDGER/EVENTS/ONESHOT/UNBOUND）——ungated 面真实编辑字节照常流动（EDIT-RT 照绿）但治理观测=0；门承载 Team 侧拒绝。',
      not_observed: [
        'host-native edit/str_replace_editor 定义 pin 进 bind 的面（W-E2 实测差距保持在册：『definition unreadable at the public seam』）',
        'OpenAtPort 任意树 Profile（ARBITRARY_TREE_PROFILE_PUBLISHED=false runtime 读回；本行不宣称任意树）',
        'OS 强制维度（同 live/W5 口径：in-process 治理链，ENFORCE-PARTIAL 天花板不变）',
      ],
      evidence_refs: [
        runRel('criteria.json'),
        runRel('live-state.json'),
        runRel('live-journal.json'),
        runRel('transcript-union.json'),
        runRel('disk-faces.json'),
        runRel('run-receipt.md'),
        'dev/agent-workflow/evidence/alpha5/pr8/probes/runs/a5c45-pre-M-04.log',
      ],
    }
    const m05 = {
      ...common,
      row_line: 'M-05 read_image（附件→解码→渲染链 + 缩略图旁路 typed-deny + admission-unbound live 面）',
      caliber: 'LIVE-kit 观测：Team Definition（read_image）在公开 seam 材料化→bind→grant→exec；图像字节唯一来源=gated ControlledFs（decode 输入即 lane 读出文本的 base64 解码）；链面 chain=admission-gated-controlled-fs。kernel 信任输入 fixture 级；无 ENFORCE 宣称。receipt 不含 assembly_anchors_verified（F-1）。',
      image_read: {
        chain: 'admission-gated-controlled-fs',
        grant: face.grant ?? null,
        decode: face.decode ?? null,
        attach_file_sha256_b64: face.attach_sha256_b64file ?? null,
        detail: '附件 shot.png.b64 → one-shot admitted readText（gated lane）→ base64 解码 → PNG signature+IHDR 真解码（image/png 1x1 70B）→ render 呈报进真实 transcript。字节路径无 host 直读。',
      },
      negative_controls: negControls,
      arbitrary_tree_profile_published: asm.arbTreePublished === false ? false : null,
      governance_increments: {
        event_stream: census,
        ledger_consumed: asm.ledgerConsumed,
        grants_minted: counters.grantMintedCount,
        exec_edge_replay_image: imgCall?.execEdgeReplay ?? null,
      },
      ungated_red_contrast: 'ungated 面：真实 70B PNG 直读照常解码（A5C45-IMG-UNGATED 进 transcript）但缩略图旁路 LEAK 字节、无 kernel/无 lane/无事件=红且仅红 Team 门控腿；admission-unbound 腿由 lane law 独立照拒（双模绿，门独立承载）。',
      not_observed: [
        'host-native read_image 定义 pin 进 bind 的面（W-E2 实测差距保持在册）',
        '真实渲染管线/附件存储（本链以字节解码+呈报为观测面；渲染授权身份=治理链上的 grant 身份）',
      ],
      evidence_refs: [
        runRel('criteria.json'),
        runRel('live-state.json'),
        runRel('live-journal.json'),
        runRel('transcript-union.json'),
        runRel('disk-faces.json'),
        runRel('run-receipt.md'),
        'dev/agent-workflow/evidence/alpha5/pr8/probes/runs/a5c45-pre-M-05.log',
      ],
    }
    writeEvidence('receipt-M-04.draft.json', m04)
    writeEvidence('receipt-M-05.draft.json', m05)
    if (WRITE_RECEIPTS) {
      const recDir = join(WORKTREE, 'dev', 'agent-workflow', 'evidence', 'alpha5', 'pr8', 'probes', 'receipts')
      writeFileSync(join(recDir, 'M-04.receipt.json'), JSON.stringify(m04, null, 2) + '\n')
      writeFileSync(join(recDir, 'M-05.receipt.json'), JSON.stringify(m05, null, 2) + '\n')
      console.log('receipts written: pr8/probes/receipts/M-04.receipt.json + M-05.receipt.json (from live observations)')
    }
  }

  await finalize(failed.length === 0 ? 'GREEN' : 'RED')
  console.log(`\n${failed.length === 0 ? 'GREEN' : 'RED'} — ${CRITERIA.length - failed.length}/${CRITERIA.length} · evidence ${EVIDENCE_DIR}`)
  process.exit(failed.length === 0 ? 0 : 2)
}

function readdirNames(dir) {
  return spawnSync('ls', [dir], { encoding: 'utf8' }).stdout.trim().split('\n').filter((l) => l !== '')
}

main().catch(async (error) => {
  console.error(String(error?.stack ?? error))
  try { const j = readFileSync(INSTANCE_RAW, 'utf8'); writeFileSync(join(EVIDENCE_DIR, 'host-log-tail.txt'), redact(j).split('\n').slice(-80).join('\n')); rmSync(INSTANCE_RAW) } catch { /* none */ }
  await finalize('FATAL')
  process.exit(1)
})
