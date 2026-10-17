#!/usr/bin/env node
/**
 * run-we2-live.mjs — W-E2 LIVE runner (Alpha.5 wiring phase, W-E2).
 *
 * Boots a TEST Host instance on port 3183 (self-proved free; :3080 probed
 * read-only before/after, never touched), DSH_HOME =
 * `tests/homes/a5e2-<mode>-<stamp>` (TEST_METHODS §7, deleted at teardown
 * unless --keep), mounts `a5e2-domain-mock-row.mjs` through the PUBLIC
 * profile-patch seam on the pinned pristine host (0.2.0-rc.2, IF-4, reused
 * read-only, porcelain checked before AND after), drives REAL sessions on
 * the scripted mock model, and reads the live process back through the
 * row's own routes.
 *
 * Modes (the RED-first shape of a wiring lane):
 *   gated    guard + PR2 admission face installed (target: all GREEN)
 *   ungated  the same tool defs without the guard and without the kernel —
 *            the TEAM-permit half of the veto matrix MUST go RED (this is
 *            the measured proof the gate, not the prose, carries those
 *            refusals); the DomainPermit half keeps refusing on its own.
 *
 * Model-driven chain (turn 2, six calls):
 *   1 a5e2_domain_act main  v0     → ACTED (TeamPermit ∧ DomainPermit) + CAS 0→1
 *   2 a5e2_domain_act aux   v0     → TeamPermit refusal (device unarmed in policy)
 *   3 a5e2_domain_act belt  v0     → DomainPermit refusal (lease holder is member B)
 *   4 a5e2_domain_act main  v999   → DomainPermit refusal (CAS stale)
 *   5 a5e2_domain_act ghost v0     → fail-closed unresolved-domain-reference
 *   6 a5e2_unbound_probe (post-publish) → guard call-edge refusal
 * Turns 3/4 (separate prompts, bracketed): host-NATIVE `edit` / `read_image`
 * legs — a MEASUREMENT of the native face (file-bytes delta / image round
 * trip + the guard-observation delta around them). No editor/image tool is
 * assembled: none exists in any Team package (README gap facts).
 *
 * Honesty rules: criteria computed from LIVE route reads captured at
 * observation time; a missing leg FAILS, nothing back-filled; the launch
 * token is redacted at capture (`REDACTED-<sha8>`).
 *
 * EXIT: 0 all criteria pass (GREEN) · 2 a criterion failed (RED) · 1 fatal.
 */
import { spawn, spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, openSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
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
const EVIDENCE_DIR = resolve(argValue('evidence-dir', join(WORKTREE, 'dev', 'agent-workflow', 'evidence', 'alpha5', 'wiring', 'we2', 'runs', `${MODE}-${RUN_STAMP}`)))
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
const JOBS_BUILD = resolve(argValue('jobs-build', join(WORKTREE, 'node_modules', '.a5e2-jobs-build')))
const ROW_PATH = join(HERE, 'a5e2-domain-mock-row.mjs')
const WORLD_PREFIX = argValue('world-prefix', 'a5e2')
const HOME = join(WORKTREE, 'tests', 'homes', `${WORLD_PREFIX}-${MODE}-${RUN_STAMP}`)
const LEDGER = join(EVIDENCE_DIR, 'assembly-ledger.jsonl')
const INSTANCE_RAW = join(EVIDENCE_DIR, 'instance.raw.log')
const INSTANCE_LOG = join(EVIDENCE_DIR, 'instance.log')

const PNG_B64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='

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
  console.log(`a5e2 runner mode=${MODE} stamp=${RUN_STAMP} port=${HOST_PORT}`)
  if (!['gated', 'ungated'].includes(MODE)) die(`unknown mode ${MODE}`)

  const head = gitAt(TESTUSE, 'rev-parse', 'HEAD')
  const porcelainBefore = gitAt(TESTUSE, 'status', '--porcelain')
  check('L-E2-PIN', 'the test-use host is the pinned pristine 0.2.0-rc.2 runtime @639ed01539 (read-only reuse)', head === TEST_USE_BASELINE_SHA && porcelainBefore === '', `head=${head.slice(0, 10)} porcelain=${porcelainBefore === '' ? 0 : 'DIRTY'} at ${TESTUSE}`)
  const sharedDiff = spawnSync('git', ['-C', WORKTREE, 'status', '--porcelain', '--', 'packages', 'scripts', 'vitest.config.ts'], { encoding: 'utf8' }).stdout.trim()
  check('L-E2-IF5', 'IF-5 shared surface (packages/, scripts/, root vitest.config) is byte-untouched by this lane', sharedDiff === '', sharedDiff === '' ? 'porcelain empty' : sharedDiff.split('\n').slice(0, 4).join(' | '))
  check('L-E2-ARTS', 'the runtime dist barrels + the kit-local jobs-gateway build are present', existsSync(join(DIST_PACKAGES, 'runtime/tool-dispatch/install.js')) && existsSync(join(JOBS_BUILD, 'index.js')), `dist=${DIST_PACKAGES} jobs=${JOBS_BUILD}`)
  const hostFree = await portFree(HOST_PORT)
  let mockPort = 0
  for (const p of [3491, 3492, 3493, 3494, 3495]) { if (await portFree(p)) { mockPort = p; break } }
  check('L-E2-PORTS', `host port ${HOST_PORT} free (self-proved) and a mock port from the 349x family free`, hostFree && mockPort > 0, `hostFree=${hostFree} mock=${mockPort}`)
  const stableBefore = await stableProbe()
  if (!hostFree || mockPort === 0) die('ports not free')

  // ── world + patch (public profile-patch seam only) ──────────────────────
  // the native-file legs run through the HOST's own sandbox: the instance's
  // workspace root is its launch cwd, so the world's repo lives UNDER the
  // launch workspace (a5w7-kit precedent: cwd = HOME/workspace).
  mkdirSync(join(HOME, 'workspace', 'repo'), { recursive: true })
  mkdirSync(join(HOME, 'profiles', 'web'), { recursive: true })
  const LAUNCH_CWD = join(HOME, 'workspace')
  const REPO = join(LAUNCH_CWD, 'repo')
  const DOC = join(REPO, 'doc.txt')
  const PNG = join(REPO, 'shot.png')
  const EDIT_OLD = 'before-edit-line'
  const EDIT_NEW = `after-edit-line-${RUN_STAMP}`
  writeFileSync(DOC, `${EDIT_OLD}\nsecond line\n`)
  writeFileSync(PNG, Buffer.from(PNG_B64, 'base64'))
  writeFileSync(join(HOME, 'profiles', 'web', 'cordis.patch.yml'), [
    `# a5e2 W-E2 live-assembly patch (run ${RUN_STAMP}, mode ${MODE}): the Domain-mock tool-family row via the public profile-patch seam; zero production-row mounts in this world.`,
    '- insert:',
    '    - id: a5e2-domain-mock',
    `      name: ${JSON.stringify(pathToFileURL(ROW_PATH).href)}`,
    '      config: {}',
    '',
  ].join('\n'))

  // ── mock model ───────────────────────────────────────────────────────────
  const MK = `A5E2_${MODE.toUpperCase()}_${RUN_STAMP.replace(/[^A-Za-z0-9]/g, '')}`
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
  let turn = null // { key, calls: [{name,args}], reqs, startCount, done }
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
        return { kind: 'text', content: 'a5e2-mock: unscripted request, completing quietly.' }
      }
      turn.reqs += 1
      if (turn.reqs > 16) { turn.done = true; return { kind: 'text', content: `${turn.key}_FUSED fuse: ${String(turn.reqs)} requests.` } }
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
      DEEPSEEK_API_KEY: 'a5e2-mock-key',
      A5E2_DIST: DIST_PACKAGES,
      A5E2_JOBS: JOBS_BUILD,
      A5E2_LEDGER: LEDGER,
      A5E2_WORLD: HOME,
      A5E2_MODE: MODE,
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
  check('L-E2-BOOT', `the test Host booted on port ${HOST_PORT} with the token gate live (303 + set-cookie)`, auth.status === 303 && cookie !== null, `status=${auth.status}`)
  await waitFor(30_000, async () => {
    const h = await fetchJson(`${origin}/__a5e2/health`).catch(() => null)
    return h?.status === 200 && h.body.applied === true ? h : false
  }, 'row apply via /__a5e2/health')

  const createSession = async (tag) => {
    const created = await fetchJson(`${origin}/api/session/create`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie: cookie ?? '' },
      body: JSON.stringify({ type: 'client-request', rpcId: `${tag}-c-${Math.random().toString(36).slice(2, 10)}`, method: 'session/create', payload: { args: { request: {} } } }),
    }, 30_000)
    return created.body?.result?.value?.sessionId ?? created.body?.value?.sessionId ?? null
  }
  const sessionId = await createSession('a5e2-a')
  const sessionIdB = await createSession('a5e2-b')
  check('L-E2-CREATE', 'the host public session/create entry returned TWO real sessionIds (member A tool host + member B identity)', typeof sessionId === 'string' && sessionId !== '' && typeof sessionIdB === 'string' && sessionIdB !== '' && sessionId !== sessionIdB, `A=${String(sessionId).slice(0, 20)} B=${String(sessionIdB).slice(0, 20)}`)

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
  const setupRes = await apiPrompt(`${MK}_SETUP This is a setup turn. Do not call any tools. Reply with the single word OK.`, 'a5e2-setup')
  check('L-E2-TURN1', 'the real session ran a setup turn to a model reply (an Agent now exists behind the session)', setupRes.status === 200, `status=${setupRes.status}`)
  const agentRow = await waitFor(60_000, async () => {
    const a = await fetchJson(`${origin}/__a5e2/agents`).catch(() => null)
    const rows = a?.body?.agents ?? []
    return rows.find((r) => r.session === sessionId || r.id === sessionId) ?? (rows.length > 0 ? rows[0] : false)
  }, 'the session Agent to appear via ctx.agents (public service)')
  check('L-E2-AGENT', 'the session Agent is reachable through the PUBLIC ctx.agents seam', (agentRow?.hasCtx ?? false) === true, `agent=${JSON.stringify(agentRow).slice(0, 120)}`)

  const asmRes = await fetchJson(`${origin}/__a5e2/assemble`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ sessionId, memberBRootSessionId: sessionIdB }) }, 30_000)
  check('L-E2-ASSEMBLE-REQ', 'the live assembly started on the real Agent', asmRes.status === 200 && asmRes.body.ok === true, JSON.stringify(asmRes.body).slice(0, 120))
  await waitFor(90_000, async () => {
    const j = await fetchJson(`${origin}/__a5e2/journal`).catch(() => null)
    return (j?.body?.rows ?? []).some((r) => r.leg === 'assembly-complete') ? true : ((j?.body?.rows ?? []).some((r) => r.leg === 'assembly-failed' || r.leg === 'guard-install-refused') ? 'refused' : false)
  }, 'the in-assembly legs (gateway/mock/register/guard/publish) to complete')

  // ── turn 2: the six-call domain-mock chain ──────────────────────────────
  mkTurn(`${MK}_CHAIN`, [
    { name: 'a5e2_domain_act', args: { device: 'a5e2.device/main', op: 'spin', expected_version: 0 } },
    { name: 'a5e2_domain_act', args: { device: 'a5e2.device/aux', op: 'spin', expected_version: 0 } },
    { name: 'a5e2_domain_act', args: { device: 'a5e2.device/belt', op: 'spin', expected_version: 0 } },
    { name: 'a5e2_domain_act', args: { device: 'a5e2.device/main', op: 'spin', expected_version: 999 } },
    { name: 'a5e2_domain_act', args: { device: 'a5e2.device/ghost', op: 'spin', expected_version: 0 } },
    { name: 'a5e2_unbound_probe', args: {} },
  ])
  await apiPrompt(`${MK}_CHAIN Follow the scripted tool calls exactly, one at a time, then answer DONE.`, 'a5e2-chain')
  await waitFor(240_000, () => {
    const reqs = mock.requests ?? []
    return reqs.some((r) => String(JSON.stringify(r.reply ?? '')).includes(`${MK}_CHAIN_DONE`)) ? true : reqs.some((r) => String(JSON.stringify(r.reply ?? '')).includes(`${MK}_CHAIN_FUSED`)) ? 'fused' : false
  }, 'the scripted six-call chain to reach its terminal reply')
  await new Promise((r) => setTimeout(r, 1200))

  const midState = await fetchJson(`${origin}/__a5e2/state`)
  const vetoMid = await fetchJson(`${origin}/__a5e2/veto-table`)
  writeEvidence('mid-state.json', midState.body)
  writeEvidence('veto-table-after-chain.json', vetoMid.body)

  // ── native-face measurement: read it, then run the two bracketed legs ───
  const faceRes = await fetchJson(`${origin}/__a5e2/native-face`)
  const face = faceRes.body?.native_face ?? {}
  writeEvidence('native-face.json', faceRes.body)
  const buildNativeArgs = (which) => {
    const row = (face.schemas ?? []).find((s) => s.name === which)
    const props = row?.params?.properties ?? row?.params ?? {}
    const keys = Object.keys(props)
    if (keys.length === 0) return null
    const pick = (...cands) => keys.find((k) => cands.some((c) => k.toLowerCase() === c)) ?? null
    if (which === 'edit') {
      const fp = pick('file_path', 'path'), os = pick('old_string', 'old'), ns = pick('new_string', 'new')
      if (fp === null || os === null || ns === null) return null
      return { [fp]: DOC, [os]: EDIT_OLD, [ns]: EDIT_NEW }
    }
    const fp = pick('file_path', 'path')
    if (fp === null) return null
    return { [fp]: which === 'read' ? DOC : PNG }
  }
  const runNativeTurn = async (key, legs, leg) => {
    // legs = ordered host-native tool calls for this bracketed measurement turn
    for (const l of legs) if (l.args === null) return { skipped: `no runnable arg shape for host-native ${l.name} (schema captured: ${JSON.stringify((face.schemas ?? []).find((s) => s.name === l.name)?.params ?? null).slice(0, 200)})` }
    await fetchJson(`${origin}/__a5e2/native-leg`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'begin', leg }) })
    mkTurn(key, legs.map((l) => ({ name: l.name, args: l.args })))
    await apiPrompt(`${key} Call exactly these tools in order: ${legs.map((l) => l.name).join(', then ')}. Then answer DONE.`, `a5e2-${leg}`)
    const term = await waitFor(180_000, () => {
      const reqs = mock.requests ?? []
      return reqs.some((r) => String(JSON.stringify(r.reply ?? '')).includes(`${key}_DONE`)) ? 'done' : reqs.some((r) => String(JSON.stringify(r.reply ?? '')).includes(`${key}_FUSED`)) ? 'fused' : false
    }, `${leg} native leg terminal`)
    await new Promise((r) => setTimeout(r, 1000))
    const end = await fetchJson(`${origin}/__a5e2/native-leg`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'end', leg }) })
    return { legs: legs.map((l) => ({ name: l.name, args: l.args })), term, governance_delta: end.body?.delta ?? null }
  }
  const docShaBefore = shaFile(DOC)
  const editLeg = await runNativeTurn(`${MK}_EDIT`, [
    { name: 'read', args: buildNativeArgs('read') },
    { name: 'edit', args: buildNativeArgs('edit') },
  ], 'edit')
  const docShaAfter = shaFile(DOC)
  const readLeg = await runNativeTurn(`${MK}_IMG`, [{ name: 'read_image', args: buildNativeArgs('read_image') }], 'read_image')
  writeEvidence('native-legs.json', { edit: editLeg, edit_file_sha_before: docShaBefore, edit_file_sha_after: docShaAfter, read_image: readLeg })

  // ── interlock probe + live reads back ───────────────────────────────────
  const interlock = await fetchJson(`${origin}/__a5e2/interlock-probe`)
  const state = await fetchJson(`${origin}/__a5e2/state`)
  const veto = await fetchJson(`${origin}/__a5e2/veto-table`)
  const journal = await fetchJson(`${origin}/__a5e2/journal`)
  writeEvidence('live-state.json', state.body)
  writeEvidence('veto-table.json', veto.body)
  writeEvidence('live-journal.json', journal.body)
  writeEvidence('interlock-probe.json', interlock.body)
  writeEvidence('transcript-union.json', redact(JSON.stringify(transcript, null, 2)).slice(0, 400_000))
  writeEvidence('mock-capture.json', redact(JSON.stringify((mock.requests ?? []).map((r) => ({ seq: r.seq, reply: r.reply, status: r.status })), null, 2)).slice(0, 200_000))
  if (existsSync(LEDGER)) writeFileSync(join(EVIDENCE_DIR, 'assembly-ledger.final.jsonl'), redact(readFileSync(LEDGER, 'utf8')))
  // device files as on disk (byte-level side-effect face)
  const deviceDump = {}
  for (const slugName of ['main', 'aux', 'belt']) {
    const p = join(HOME, 'domain', 'devices', `${slugName}.json`)
    try { deviceDump[slugName] = JSON.parse(readFileSync(p, 'utf8')) } catch { deviceDump[slugName] = null }
  }
  let deviceLedgerLines = []
  try { deviceDump.ledger = readFileSync(join(HOME, 'domain', 'device-actions.jsonl'), 'utf8').trim().split('\n').filter((l) => l !== '') } catch { deviceDump.ledger = null }

  const asms = state.body?.assemblies ?? {}
  const labels = Object.keys(asms)
  const asm = labels.length > 0 ? asms[labels[0]] : {}
  const guard = asm.guard ?? {}
  const toolCalls = asm.toolCalls ?? []
  const vetoMatrix = asm.vetoMatrix ?? []
  const negControls = asm.negativeControls ?? []
  const transcriptText = transcript.join('\n')
  const devices = asm.mockSnapshot ?? {}
  const midDevices = vetoMid.body?.device_states_on_disk ?? {} // AFTER the model chain, BEFORE the interlock probe
  const callBy = (pred) => toolCalls.find(pred)

  // guard face
  check('L-E2-GUARD', 'the PR1 guard installed, bound a5e2_domain_act and PUBLISHED (channel armed/proven on the live subscription)', guard.installOk === true && guard.bindOwnOk === true && guard.publishedOk === true && (guard.channelAtPublish === 'armed' || guard.channelAtPublish === 'proven') && (guard.channel === 'armed' || guard.channel === 'proven'), JSON.stringify(guard))
  check('L-E2-REG', 'a5e2_domain_act + the post-publish probe are on the live scoped registry', Array.isArray(asm.registryNames) && ['a5e2_domain_act', 'a5e2_unbound_probe'].every((n) => asm.registryNames.includes(n)), JSON.stringify(asm.registryNames ?? null))
  check('L-E2-IDENTITY', 'the jobs-gateway PUBLIC BARREL admitted both member jobs; canonical owner keys are distinct (rootSessionIds are host session facts; instanceIds disclosed as row-local)', asm.gateway?.ownerA?.admitted === true && asm.gateway?.ownerB?.admitted === true && asm.gateway?.ownerA?.key !== asm.gateway?.ownerB?.key && String(asm.gateway?.identity_disclosure ?? '').includes('row-local'), JSON.stringify({ a: asm.gateway?.ownerA, b: asm.gateway?.ownerB, lease: asm.gateway?.leaseState }))

  // veto matrix legs (model-driven)
  const mainAct = callBy((c) => c.device === 'a5e2.device/main' && c.outcome === 'acted')
  check('L-E2-ACTED', 'a REAL model-driven device act ran the FULL dual-permit flow: PR2 grant minted → domain interlock+CAS allow → exec-edge ONE-SHOT consume → the single side effect (CAS 0→1) → presented', mainAct !== undefined && typeof mainAct.grantId === 'string' && mainAct.execEdgeFirst?.ok === true && mainAct.execEdgeReplay?.ok === false && mainAct.ledgerConsumed === 1 && mainAct.deviceDelta === 1 && String(mainAct.presented).includes('A5E2-ACTED') && (devices['a5e2.device/main']?.version ?? -1) >= 1 && transcriptText.includes('A5E2-ACTED'), mainAct === undefined ? 'no acted main call' : `grant=${String(mainAct.grantId)} edge=${JSON.stringify(mainAct.execEdgeFirst)}|${JSON.stringify(mainAct.execEdgeReplay)} ledger=${String(mainAct.ledgerConsumed)}`)
  const auxDeny = callBy((c) => c.device === 'a5e2.device/aux')
  check('L-E2-TEAM-DENY', 'TeamPermit veto (aux unarmed in policy; Domain side would allow): the REAL PR2 kernel refused with its own vocabulary, device delta 0, aux CAS untouched at 0', auxDeny !== undefined && auxDeny.team_permit === false && auxDeny.deviceDelta === 0 && auxDeny.grantId === null && (midDevices['a5e2.device/aux']?.version ?? -1) === 0 && vetoMatrix.some((v) => v.team_permit === false && v.domain_permit === true && v.outcome === 'denied'), JSON.stringify(auxDeny ?? null).slice(0, 300))
  const beltDeny = callBy((c) => c.device === 'a5e2.device/belt')
  check('L-E2-DOMAIN-DENY', 'DomainPermit veto (lease holder is member B; kernel ADMITTED): typed DOMAIN_DENIED verbatim, device delta 0, belt CAS untouched', beltDeny !== undefined && beltDeny.team_permit === true && typeof beltDeny.grantId === 'string' && beltDeny.code === 'DOMAIN_DENIED' && beltDeny.deviceDelta === 0 && (midDevices['a5e2.device/belt']?.version ?? -1) === 0 && vetoMatrix.some((v) => v.team_permit === true && v.domain_permit === false && v.outcome === 'denied' && v.error === 'DOMAIN_DENIED'), JSON.stringify(beltDeny ?? null).slice(0, 300))
  const casDeny = callBy((c) => c.device === 'a5e2.device/main' && String(c.detail ?? '').includes('cas-version-stale'))
  check('L-E2-DOMAIN-CAS', 'the CAS half of the mock interlock refuses a stale expected_version even for the lease holder (main v999): typed DOMAIN_DENIED, delta 0', casDeny !== undefined && casDeny.code === 'DOMAIN_DENIED' && casDeny.deviceDelta === 0, JSON.stringify(casDeny ?? null).slice(0, 240))
  const ghostDeny = callBy((c) => String(c.detail ?? '').includes('unresolved-domain-reference'))
  check('L-E2-UNRESOLVED', 'unresolved domain reference fails CLOSED before any grant is minted (no binding guessed), device delta 0', ghostDeny !== undefined && ghostDeny.grantId === null && ghostDeny.code === 'DOMAIN_DENIED' && ghostDeny.deviceDelta === 0 && negControls.some((n) => n.attempt === 'unresolved-domain-reference' && n.outcome === 'typed-deny'), JSON.stringify(ghostDeny ?? null).slice(0, 240))
  const vetoLedger = vetoMid.body ?? {}
  check('L-E2-VETO-ZERO', 'veto ⇒ 0 side effects, BYTE-LEVEL: after the model chain the action ledger carries EXACTLY the one acted line and the vetoed devices sit at version 0', (vetoLedger.action_ledger_lines ?? -1) === 1 && (midDevices['a5e2.device/aux']?.version ?? -1) === 0 && (midDevices['a5e2.device/belt']?.version ?? -1) === 0 && vetoMatrix.filter((v) => v.outcome === 'denied').every((v) => v.side_effects === 0), `ledger=${String(vetoLedger.action_ledger_lines)} aux=${String(midDevices['a5e2.device/aux']?.version)} belt=${String(midDevices['a5e2.device/belt']?.version)}`)
  check('L-E2-UNBOUND', 'the post-assembly probe name is refused at the call edge by the live guard and its BODY never ran', (asm.probeBodyCount ?? -1) === 0 && /no Team Tool Binding|UNVERIFIED|refused|denied/i.test(transcriptText), `probeBodyCount=${String(asm.probeBodyCount)}`)
  check('L-E2-INTERLOCK', 'the mock device IS actable by its lease holder (B, gateway owner key): refusal was attribution-based, not a dead device; the foreign act stays refused', interlock.body?.owner_b_act?.ok === true && interlock.body?.foreign_a_act?.code === 'DOMAIN_DENIED' && interlock.body?.action_lines_delta === 1, JSON.stringify({ b: interlock.body?.owner_b_act, a: interlock.body?.foreign_a_act, delta: interlock.body?.action_lines_delta }))

  // pinned absent anchor (M-13 A5 leg, same instrument as W7/W8)
  const anchorGrep = spawnSync('grep', ['-r', '-n', '--include=*.ts', '--include=*.js', '--include=*.mjs', '--include=*.json', '--include=*.md', 'job_start', TESTUSE], { encoding: 'utf8', timeout: 240_000 })
  const anchorHits = (anchorGrep.stdout ?? '').split('\n').filter((l) => l.trim() !== '').length
  check('L-E2-ANCHOR', 'the pinned absent-anchor job_start stays absent: ZERO hits across the host tree AND no job-start-shaped name on the live roster', anchorHits === 0 && asm.rosterHasJobStart === false, `grepHits=${String(anchorHits)} roster=${String(asm.rosterHasJobStart)}`)
  writeEvidence('anchor-scan.json', { grep_exit: anchorGrep.status, hits: anchorHits, roster_has_job_start: asm.rosterHasJobStart ?? null })

  // editor / read_image MEASUREMENT face (gap facts, booked as measurements)
  check('L-E2-NATIVE-FACE', 'the real Agent NATIVE tool face was captured through the public tools.schemas() view (names + the edit/write/read_image parameter schemas)', Array.isArray(face.names) && face.names.length > 0 && typeof face.has_edit === 'boolean' && typeof face.has_read_image === 'boolean' && face.has_str_replace_editor === false, `total=${String(face.total)} edit=${String(face.has_edit)} read_image=${String(face.has_read_image)} str_replace_editor=${String(face.has_str_replace_editor)}`)
  check('L-E2-NATIVE-EDIT-LEG', 'the host-native edit leg was measured end-to-end with its governance-observation delta (file-byte delta recorded verbatim; NO Team editor is assembled)', editLeg !== undefined && (editLeg.skipped !== undefined || (editLeg.term === 'done' && typeof editLeg.governance_delta?.new_observations === 'number')), `skipped=${String(editLeg.skipped ?? false)} term=${String(editLeg.term ?? '-')} govDelta=${JSON.stringify(editLeg.governance_delta ?? null)} fileDelta=${String(docShaBefore !== docShaAfter)}`)
  check('L-E2-NATIVE-IMG-LEG', 'the host-native read_image round-trip leg was measured end-to-end with its governance-observation delta (real PNG on disk; NO Team image tool is assembled)', readLeg !== undefined && (readLeg.skipped !== undefined || (readLeg.term === 'done' && typeof readLeg.governance_delta?.new_observations === 'number')), `skipped=${String(readLeg.skipped ?? false)} term=${String(readLeg.term ?? '-')} govDelta=${JSON.stringify(readLeg.governance_delta ?? null)}`)

  // event census (IF-6 names on the live observation stream)
  const census = asm.eventCensus ?? {}
  const shortFormHits = Object.keys(census).filter((n) => /^call-/.test(n))
  const dispatchSrc = ['install.ts', 'scoped-dispatcher.ts', 'closed-world-guard.ts', 'pending-calls.js'].map((f) => { try { return readFileSync(join(WORKTREE, 'packages', 'runtime', 'tool-dispatch', f), 'utf8') } catch { return '' } }).join('\n')
  const censusNamesOk = Object.keys(census).every((n) => dispatchSrc.includes(`'${n}'`) || dispatchSrc.includes(`"${n}"`) || n.startsWith('dispatcher-call-') || n.startsWith('guard-') || n.startsWith('spill-') || n === 'tools-change-unbound-names')
  check('L-E2-CENSUS', 'every name on the live guard-observation stream is a master full-prefix name (no retired short form appears); census recorded verbatim', shortFormHits.length === 0 && censusNamesOk, JSON.stringify(census))

  // closure facts
  const stableAfter = await stableProbe()
  check('L-E2-STABLE', 'the stable :3080 instance was only probed, never operated, status unchanged', String(stableBefore) === String(stableAfter), `before=${String(stableBefore)} after=${String(stableAfter)}`)
  const porcelainAfter = gitAt(TESTUSE, 'status', '--porcelain')
  check('L-E2-PRISTINE', 'the test-use runtime stayed pristine (porcelain empty, HEAD unmoved)', porcelainAfter === '' && gitAt(TESTUSE, 'rev-parse', 'HEAD') === TEST_USE_BASELINE_SHA, `porcelain=${porcelainAfter === '' ? 0 : 'DIRTY'}`)
  const sharedDiffAfter = spawnSync('git', ['-C', WORKTREE, 'status', '--porcelain', '--', 'packages', 'scripts', 'vitest.config.ts'], { encoding: 'utf8' }).stdout.trim()
  check('L-E2-IF5-POST', 'IF-5 shared surface still byte-untouched at closure', sharedDiffAfter === '', sharedDiffAfter === '' ? 'porcelain empty' : sharedDiffAfter.split('\n').slice(0, 4).join(' | '))
  writeEvidence('device-states-final.json', deviceDump)

  const failed = CRITERIA.filter((c) => !c.pass)
  writeEvidence('run-receipt.md', [
    `# a5e2 ${MODE} run ${RUN_STAMP}`,
    ``,
    `- host: ${TESTUSE} @ ${TEST_USE_BASELINE_SHA.slice(0, 10)} (pinned 0.2.0-rc.2, read-only reuse)`,
    `- port ${HOST_PORT} · mock ${mockPort} · world ${KEEP ? `KEPT: ${HOME}` : 'deleted at teardown'}`,
    `- jobs-gateway kit-local build: ${JOBS_BUILD} · dist: ${DIST_PACKAGES}`,
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
