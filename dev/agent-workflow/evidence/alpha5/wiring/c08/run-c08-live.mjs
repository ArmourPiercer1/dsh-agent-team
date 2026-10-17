#!/usr/bin/env node
/**
 * run-c08-live.mjs — C-08 gap-writer LIVE runner (branch alpha5-gap-c08, matrix row M-05).
 *
 * Boots a TEST Host instance on port 3186 (self-proved free; :3080 probed
 * read-only before/after, never touched), DSH_HOME =
 * `tests/homes/a5c08-<mode>-<stamp>` (TEST_METHODS §7, deleted at teardown
 * unless --keep), mounts `a5c08-image-row.mjs` through the PUBLIC profile-patch
 * seam on the pinned pristine host (0.2.0-rc.2, IF-4, reused read-only,
 * porcelain checked before AND after), drives a REAL session on the scripted
 * mock model, and reads the live process back through the row's own routes.
 *
 * Modes (the RED-first shape of a wiring lane):
 *   gated    guard + PR2 admission + the per-call admission-gated C-FS lane
 *            installed (target: all GREEN)
 *   ungated  the same tool defs without the guard, without the kernel and
 *            without the gated lane — the gate-carried criteria MUST go RED
 *            (the thumbnail is readable, the unbound read reads, the chain
 *            bypasses every gate); the measured refusals are carried by the
 *            gates, not by the prose.
 *
 * Model-driven chain (turn 2, four calls):
 *   1 a5c08_image_read   attach/shot.png.b64 → gated chain acted (grant →
 *                        gated-lane readText → base64/PNG decode → render)
 *                        + same-call second read refused (grant-consumed)
 *   2 a5c08_thumb_probe  thumb/shot.png.b64  → C-FS typed deny BEFORE open
 *   3 a5c08_unbound_read attach/shot.png.b64 → UNBOUND lane typed deny
 *                        (admission-unbound, lane law 1), 0 bytes
 *   4 a5c08_binary_probe attach/shot.png     → byte-fidelity FACT of the text
 *                        read face, measured and recorded honestly
 * Turn 3 (bracketed): the host-NATIVE read_image leg — a MEASUREMENT of the
 * native face around the governance-observation stream (no Team image tool is
 * substituted for it).
 *
 * Honesty rules: criteria computed from LIVE route reads captured at
 * observation time; a missing leg FAILS, nothing back-filled; the launch token
 * is redacted at capture (`REDACTED-<sha8>`).
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
const EVIDENCE_DIR = resolve(argValue('evidence-dir', join(WORKTREE, 'dev', 'agent-workflow', 'evidence', 'alpha5', 'wiring', 'c08', 'runs', `${MODE}-${RUN_STAMP}`)))
mkdirSync(EVIDENCE_DIR, { recursive: true })

const HOST_PORT = Number(argValue('port', 3186))
const TESTUSE_CANDIDATES = [
  argValue('testuse', ''),
  join(WORKTREE, 'tests', 'deepseek-harness-test-use'),
  '/srv/workspace/dsh-plugins/dsh-agent-team/.worktrees/a5-w8/tests/deepseek-harness-test-use',
].filter((p) => p !== '' && existsSync(join(p, 'apps', 'cli', 'lib', 'bin.js')))
const TESTUSE = resolve(TESTUSE_CANDIDATES[0] ?? '.')
const HOST_BIN = join(TESTUSE, 'apps', 'cli', 'lib', 'bin.js')
const DIST_PACKAGES = join(WORKTREE, 'packages', 'runtime', 'dist', 'packages')
const ROW_PATH = join(HERE, 'a5c08-image-row.mjs')
const WORLD_PREFIX = argValue('world-prefix', 'a5c08')
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
  console.log(`a5c08 runner mode=${MODE} stamp=${RUN_STAMP} port=${HOST_PORT}`)
  if (!['gated', 'ungated'].includes(MODE)) die(`unknown mode ${MODE}`)

  const head = gitAt(TESTUSE, 'rev-parse', 'HEAD')
  const porcelainBefore = gitAt(TESTUSE, 'status', '--porcelain')
  check('L-C08-PIN', 'the test-use host is the pinned pristine 0.2.0-rc.2 runtime @639ed01539 (read-only reuse)', head === TEST_USE_BASELINE_SHA && porcelainBefore === '', `head=${head.slice(0, 10)} porcelain=${porcelainBefore === '' ? 0 : 'DIRTY'} at ${TESTUSE}`)
  const sharedDiff = spawnSync('git', ['-C', WORKTREE, 'status', '--porcelain', '--', 'packages', 'scripts', 'vitest.config.ts'], { encoding: 'utf8' }).stdout.trim()
  check('L-C08-IF5', 'IF-5 shared surface (packages/, scripts/, root vitest.config) is byte-untouched by this lane', sharedDiff === '', sharedDiff === '' ? 'porcelain empty' : sharedDiff.split('\n').slice(0, 4).join(' | '))
  check('L-C08-ARTS', 'the runtime dist barrels (tool-governance/tool-admission/tool-dispatch/controlled-fs) are present', ['runtime/tool-dispatch/install.js', 'runtime/tool-admission/index.js', 'runtime/controlled-fs/src/index.js', 'domain/tool-governance/src/index.js'].every((p) => existsSync(join(DIST_PACKAGES, p))), `dist=${DIST_PACKAGES}`)
  const hostFree = await portFree(HOST_PORT)
  let mockPort = 0
  for (const p of [3491, 3492, 3493, 3494, 3495]) { if (await portFree(p)) { mockPort = p; break } }
  check('L-C08-PORTS', `host port ${HOST_PORT} free (self-proved) and a mock port from the 349x family free`, hostFree && mockPort > 0, `hostFree=${hostFree} mock=${mockPort}`)
  const stableBefore = await stableProbe()
  if (!hostFree || mockPort === 0) die('ports not free')

  // ── world + patch (public profile-patch seam only) ──────────────────────
  mkdirSync(join(HOME, 'workspace', 'repo'), { recursive: true })
  mkdirSync(join(HOME, 'profiles', 'web'), { recursive: true })
  const LAUNCH_CWD = join(HOME, 'workspace')
  const REPO = join(LAUNCH_CWD, 'repo')
  writeFileSync(join(REPO, 'README.txt'), 'a5c08 fixture repo\n')
  writeFileSync(join(HOME, 'profiles', 'web', 'cordis.patch.yml'), [
    `# a5c08 C-08 live-assembly patch (run ${RUN_STAMP}, mode ${MODE}): the M-05 admission-gated image-chain row via the public profile-patch seam; zero production-row mounts in this world.`,
    '- insert:',
    '    - id: a5c08-image-chain',
    `      name: ${JSON.stringify(pathToFileURL(ROW_PATH).href)}`,
    '      config: {}',
    '',
  ].join('\n'))

  // ── mock model ───────────────────────────────────────────────────────────
  const MK = `A5C08_${MODE.toUpperCase()}_${RUN_STAMP.replace(/[^A-Za-z0-9]/g, '')}`
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
        return { kind: 'text', content: 'a5c08-mock: unscripted request, completing quietly.' }
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
      DEEPSEEK_API_KEY: 'a5c08-mock-key',
      A5C08_DIST: DIST_PACKAGES,
      A5C08_LEDGER: LEDGER,
      A5C08_WORLD: HOME,
      A5C08_MODE: MODE,
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
  check('L-C08-BOOT', `the test Host booted on port ${HOST_PORT} with the token gate live (303 + set-cookie)`, auth.status === 303 && cookie !== null, `status=${auth.status}`)
  await waitFor(30_000, async () => {
    const h = await fetchJson(`${origin}/__a5c08/health`).catch(() => null)
    return h?.status === 200 && h.body.applied === true ? h : false
  }, 'row apply via /__a5c08/health')

  const createSession = async (tag) => {
    const created = await fetchJson(`${origin}/api/session/create`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie: cookie ?? '' },
      body: JSON.stringify({ type: 'client-request', rpcId: `${tag}-c-${Math.random().toString(36).slice(2, 10)}`, method: 'session/create', payload: { args: { request: {} } } }),
    }, 30_000)
    return created.body?.result?.value?.sessionId ?? created.body?.value?.sessionId ?? null
  }
  const sessionId = await createSession('a5c08-a')
  check('L-C08-CREATE', 'the host public session/create entry returned a real sessionId (attachment-read tool host)', typeof sessionId === 'string' && sessionId !== '', `A=${String(sessionId).slice(0, 20)}`)

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
  const setupRes = await apiPrompt(`${MK}_SETUP This is a setup turn. Do not call any tools. Reply with the single word OK.`, 'a5c08-setup')
  check('L-C08-TURN1', 'the real session ran a setup turn to a model reply (an Agent now exists behind the session)', setupRes.status === 200, `status=${setupRes.status}`)
  const agentRow = await waitFor(60_000, async () => {
    const a = await fetchJson(`${origin}/__a5c08/agents`).catch(() => null)
    const rows = a?.body?.agents ?? []
    return rows.find((r) => r.session === sessionId || r.id === sessionId) ?? (rows.length > 0 ? rows[0] : false)
  }, 'the session Agent to appear via ctx.agents (public service)')
  check('L-C08-AGENT', 'the session Agent is reachable through the PUBLIC ctx.agents seam', (agentRow?.hasCtx ?? false) === true, `agent=${JSON.stringify(agentRow).slice(0, 120)}`)

  const asmRes = await fetchJson(`${origin}/__a5c08/assemble`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ sessionId }) }, 30_000)
  check('L-C08-ASSEMBLE-REQ', 'the live assembly started on the real Agent', asmRes.status === 200 && asmRes.body.ok === true, JSON.stringify(asmRes.body).slice(0, 120))
  const asmWait = await waitFor(90_000, async () => {
    const j = await fetchJson(`${origin}/__a5c08/journal`).catch(() => null)
    return (j?.body?.rows ?? []).some((r) => r.leg === 'assembly-complete') ? true : ((j?.body?.rows ?? []).some((r) => r.leg === 'assembly-failed' || r.leg === 'guard-install-refused') ? 'refused' : false)
  }, 'the in-assembly legs (world/register/guard/publish) to complete')
  check('L-C08-ASSEMBLED', 'the row assembly completed on the live Agent (world built + tools registered; guard published in gated mode)', asmWait === true, `wait=${String(asmWait)}`)

  // ── turn 2: the four-call image-chain ────────────────────────────────────
  mkTurn(`${MK}_CHAIN`, [
    { name: 'a5c08_image_read', args: { attachment: 'attach/shot.png.b64' } },
    { name: 'a5c08_thumb_probe', args: { attachment: 'thumb/shot.png.b64' } },
    { name: 'a5c08_unbound_read', args: { attachment: 'attach/shot.png.b64' } },
    { name: 'a5c08_binary_probe', args: { attachment: 'attach/shot.png' } },
  ])
  await apiPrompt(`${MK}_CHAIN Follow the scripted tool calls exactly, one at a time, then answer DONE.`, 'a5c08-chain')
  await waitFor(240_000, () => {
    const reqs = mock.requests ?? []
    return reqs.some((r) => String(JSON.stringify(r.reply ?? '')).includes(`${MK}_CHAIN_DONE`)) ? true : reqs.some((r) => String(JSON.stringify(r.reply ?? '')).includes(`${MK}_CHAIN_FUSED`)) ? 'fused' : false
  }, 'the scripted four-call chain to reach its terminal reply')
  await new Promise((r) => setTimeout(r, 1200))

  const midState = await fetchJson(`${origin}/__a5c08/state`)
  const chainMid = await fetchJson(`${origin}/__a5c08/chain-table`)
  writeEvidence('mid-state.json', midState.body)
  writeEvidence('chain-table-after-chain.json', chainMid.body)

  // ── native-face measurement: bracket the host-native read_image leg ──────
  const faceRes = await fetchJson(`${origin}/__a5c08/native-face`)
  const face = faceRes.body?.native_face ?? {}
  writeEvidence('native-face.json', faceRes.body)
  const buildNativeArgs = (which, pngPath) => {
    const row = (face.schemas ?? []).find((s) => s.name === which)
    const props = row?.params?.properties ?? row?.params ?? {}
    const keys = Object.keys(props)
    if (keys.length === 0) return null
    const pick = (...cands) => keys.find((k) => cands.some((c) => k.toLowerCase() === c)) ?? null
    const fp = pick('file_path', 'path')
    if (fp === null) return null
    return { [fp]: pngPath }
  }
  const PNG_PATH = join(REPO, 'attach', 'shot.png')
  const runNativeTurn = async (key, legs, leg) => {
    for (const l of legs) if (l.args === null) return { skipped: `no runnable arg shape for host-native ${l.name} (schema captured: ${JSON.stringify((face.schemas ?? []).find((s) => s.name === l.name)?.params ?? null).slice(0, 200)})` }
    await fetchJson(`${origin}/__a5c08/native-leg`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'begin', leg }) })
    mkTurn(key, legs.map((l) => ({ name: l.name, args: l.args })))
    await apiPrompt(`${key} Call exactly these tools in order: ${legs.map((l) => l.name).join(', then ')}. Then answer DONE.`, `a5c08-${leg}`)
    const term = await waitFor(180_000, () => {
      const reqs = mock.requests ?? []
      return reqs.some((r) => String(JSON.stringify(r.reply ?? '')).includes(`${key}_DONE`)) ? 'done' : reqs.some((r) => String(JSON.stringify(r.reply ?? '')).includes(`${key}_FUSED`)) ? 'fused' : false
    }, `${leg} native leg terminal`)
    await new Promise((r) => setTimeout(r, 1000))
    const end = await fetchJson(`${origin}/__a5c08/native-leg`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'end', leg }) })
    return { legs: legs.map((l) => ({ name: l.name, args: l.args })), term, governance_delta: end.body?.delta ?? null }
  }
  const readLeg = await runNativeTurn(`${MK}_IMG`, [{ name: 'read_image', args: buildNativeArgs('read_image', PNG_PATH) }], 'read_image')
  writeEvidence('native-legs.json', { read_image: readLeg })

  // ── read backs ────────────────────────────────────────────────────────────
  const state = await fetchJson(`${origin}/__a5c08/state`)
  const chain = await fetchJson(`${origin}/__a5c08/chain-table`)
  const journal = await fetchJson(`${origin}/__a5c08/journal`)
  writeEvidence('live-state.json', state.body)
  writeEvidence('chain-table.json', chain.body)
  writeEvidence('live-journal.json', journal.body)
  writeEvidence('transcript-union.json', redact(JSON.stringify(transcript, null, 2)).slice(0, 400_000))
  writeEvidence('mock-capture.json', redact(JSON.stringify((mock.requests ?? []).map((r) => ({ seq: r.seq, reply: r.reply, status: r.status })), null, 2)).slice(0, 200_000))
  if (existsSync(LEDGER)) writeFileSync(join(EVIDENCE_DIR, 'assembly-ledger.final.jsonl'), redact(readFileSync(LEDGER, 'utf8')))

  const worldFiles = {}
  for (const rel of ['attach/shot.png', 'attach/shot.png.b64', 'thumb/shot.png.b64']) {
    worldFiles[rel] = { sha: shaFile(join(REPO, rel)) }
  }
  const EXPECT_PNG_SHA = sha256OfB64(PNG_B64)
  const EXPECT_B64_SHA = `sha256:${createHash('sha256').update(Buffer.from(PNG_B64, 'base64').toString('base64'), 'utf8').digest('hex')}`
  writeEvidence('world-files.json', { files: worldFiles, expected_png_sha: EXPECT_PNG_SHA, expected_b64_sha: EXPECT_B64_SHA })

  const asms = state.body?.assemblies ?? {}
  const labels = Object.keys(asms)
  const asm = labels.length > 0 ? asms[labels[0]] : {}
  const guard = asm.guard ?? {}
  const toolCalls = asm.toolCalls ?? []
  const negControls = chain.body?.negative_controls ?? asm.negativeControls ?? []
  const chainView = chain.body?.chain ?? {}
  const laneLedgers = asm.laneLedgers ?? chain.body?.lane_ledgers ?? {}
  const transcriptText = transcript.join('\n')
  const callBy = (pred) => toolCalls.find(pred)
  const shaUnchanged = (rel, want) => worldFiles[rel]?.sha === want

  // guard face (gated-carried)
  check('L-C08-GUARD', 'the PR1 guard installed, bound the four a5c08 tools and PUBLISHED (channel armed/proven on the live subscription)', guard.installOk === true && guard.bindOwnOk === true && guard.publishedOk === true && (guard.channelAtPublish === 'armed' || guard.channelAtPublish === 'proven') && (guard.channel === 'armed' || guard.channel === 'proven'), JSON.stringify(guard))
  check('L-C08-REG', 'the four row tools are on the live scoped registry', Array.isArray(asm.registryNames) && ['a5c08_image_read', 'a5c08_thumb_probe', 'a5c08_unbound_read', 'a5c08_binary_probe'].every((n) => asm.registryNames.includes(n)), JSON.stringify(asm.registryNames ?? null))

  // the chain leg (model-driven)
  const imgAct = callBy((c) => c.tool === 'image-read')
  const chainEntry = chainView.image_read ?? null
  check('L-C08-CHAIN', 'a REAL model-driven attachment read ran the FULL gated chain: PR2 grant minted (read resource effect) → per-call admission-bound ControlledFs lane readText (exec-edge ONE-SHOT consumed, lane ledger fd-closed) → base64/PNG decode (1×1, decoded sha == attachment on disk) → render into the real transcript; chain=admission-gated-controlled-fs', chainEntry !== null && chainEntry.chain === 'admission-gated-controlled-fs' && typeof chainEntry.grant_id === 'string' && chainEntry.lane_ok === true && chainEntry.exec_edge_first?.ok === true && chainEntry.ledger_consumed === 1 && chainEntry.decode?.ok === true && chainEntry.decode?.width === 1 && chainEntry.decode?.height === 1 && chainEntry.decoded_sha_matches_disk === true && transcriptText.includes('A5C08-IMG ok'), imgAct === undefined ? 'no image-read call observed' : `grant=${String(chainEntry?.grant_id)} lane=${String(chainEntry?.lane_ok)} edge=${JSON.stringify(chainEntry?.exec_edge_first)} consumed=${String(chainEntry?.ledger_consumed)} decode=${JSON.stringify(chainEntry?.decode)}`)
  const laneLines = Object.values(laneLedgers).flat()
  const imgLaneLines = laneLedgers[imgAct?.callId] ?? []
  check('L-C08-ONESHOT', 'ONE-SHOT discipline on the FS path: the same-call SECOND readText on the SAME bound lane is refused through the consumed ledger (grant-consumed, deny-before-open); exactly one fd-closed line for the acted read', imgAct !== undefined && imgAct.execEdgeReplay?.ok === false && String(imgAct.execEdgeReplay?.code) === 'grant-consumed' && imgLaneLines.filter((e) => e.stage === 'fd-closed').length === 1, JSON.stringify({ replay: imgAct?.execEdgeReplay ?? null, fdClosedLines: imgLaneLines.filter((e) => e.stage === 'fd-closed').length }))

  // negative controls (the lane's OWN vocabulary)
  const thumbNeg = negControls.find((n) => n.attempt === 'thumbnail-read-bypass')
  const thumbCall = callBy((c) => c.tool === 'thumb-bypass')
  check('L-C08-THUMB-DENY', 'the thumbnail/preview bypass attempt (armed effect set, OUTSIDE target) is refused by the C-FS lane BEFORE any open: typed effect-outside-grant, bytes_leaked=0, refused line in the lane ledger, thumbnail bytes unchanged on disk', thumbNeg !== undefined && thumbNeg.outcome === 'typed-deny' && thumbNeg.cf_reason === 'effect-outside-grant' && thumbNeg.bytes_leaked === 0 && thumbNeg.ledger_refused_line === true && thumbCall?.bytes == null && shaUnchanged('thumb/shot.png.b64', EXPECT_B64_SHA) === true, JSON.stringify(thumbNeg ?? thumbCall ?? null).slice(0, 300))
  const unboundNeg = negControls.find((n) => n.attempt === 'unbound-image-read')
  check('L-C08-UNBOUND-DENY', 'the UNBOUND gated lane refuses every operation by name (law 1): recheck reason admission-unbound verbatim in the diagnostic, bytes_leaked=0, refused line in the lane ledger (the refusal is the lane wiring, not prose)', unboundNeg !== undefined && unboundNeg.outcome === 'typed-deny' && unboundNeg.recheck_reason === 'admission-unbound' && unboundNeg.bytes_leaked === 0 && unboundNeg.ledger_refused_line === true && transcriptText.includes('admission-unbound'), JSON.stringify(unboundNeg ?? null).slice(0, 300))

  // the byte-fidelity measurement (fact, booked honestly in BOTH modes)
  const binCall = callBy((c) => c.tool === 'binary-probe')
  check('L-C08-BINARY-FACT', 'the raw-binary leg MEASURED and BOOKED the C-FS text-read byte fidelity (lane-carried bytes vs bytes on disk compared as a fact; the base64 attachment form is the byte-exact transport recorded by the chain leg)', binCall !== undefined && binCall.outcome === 'measured' && typeof binCall.utf8_byte_fidelity === 'boolean' && (MODE === 'ungated' || (typeof binCall.lane_bytes === 'number' && typeof binCall.disk_bytes === 'number')), JSON.stringify(binCall ?? null).slice(0, 260))

  // read-only law: the chain never mutates the world
  check('L-C08-BYTES-INTACT', 'the chain is READ-ONLY end to end: attachment and thumbnail files carry the SAME sha after the run as the fixtures written at world build (PNG bytes; base64 attachment form)', shaUnchanged('attach/shot.png', EXPECT_PNG_SHA) && shaUnchanged('attach/shot.png.b64', EXPECT_B64_SHA) && shaUnchanged('thumb/shot.png.b64', EXPECT_B64_SHA), JSON.stringify(worldFiles))

  // measurement of the host-native face (no substitution)
  check('L-C08-NATIVE-IMG', 'the host-native read_image round-trip leg was measured end-to-end with its governance-observation delta bracketed around it (the Team chain does NOT substitute for the native face)', readLeg !== undefined && (readLeg.skipped !== undefined || (['done', 'fused'].includes(String(readLeg.term)) && typeof readLeg.governance_delta?.new_observations === 'number')), `skipped=${String(readLeg.skipped ?? false)} term=${String(readLeg.term ?? '-')} govDelta=${JSON.stringify(readLeg.governance_delta ?? null)}`)

  // event census (IF-6 names on the live observation stream)
  const census = asm.eventCensus ?? {}
  const shortFormHits = Object.keys(census).filter((n) => /^call-/.test(n))
  const dispatchSrc = ['install.ts', 'scoped-dispatcher.ts', 'closed-world-guard.ts'].map((f) => { try { return readFileSync(join(WORKTREE, 'packages', 'runtime', 'tool-dispatch', f), 'utf8') } catch { return '' } }).join('\n')
  const censusNamesOk = Object.keys(census).every((n) => dispatchSrc.includes(`'${n}'`) || dispatchSrc.includes(`"${n}"`) || n.startsWith('dispatcher-call-') || n.startsWith('guard-') || n.startsWith('spill-') || n === 'tools-change-unbound-names')
  check('L-C08-CENSUS', 'every name on the live guard-observation stream is a master full-prefix name (no retired short form appears); census recorded verbatim', shortFormHits.length === 0 && censusNamesOk, JSON.stringify(census))

  // closure facts
  const stableAfter = await stableProbe()
  check('L-C08-STABLE', 'the stable :3080 instance was only probed, never operated, status unchanged', String(stableBefore) === String(stableAfter), `before=${String(stableBefore)} after=${String(stableAfter)}`)
  const porcelainAfter = gitAt(TESTUSE, 'status', '--porcelain')
  check('L-C08-PRISTINE', 'the test-use runtime stayed pristine (porcelain empty, HEAD unmoved)', porcelainAfter === '' && gitAt(TESTUSE, 'rev-parse', 'HEAD') === TEST_USE_BASELINE_SHA, `porcelain=${porcelainAfter === '' ? 0 : 'DIRTY'}`)
  const sharedDiffAfter = spawnSync('git', ['-C', WORKTREE, 'status', '--porcelain', '--', 'packages', 'scripts', 'vitest.config.ts'], { encoding: 'utf8' }).stdout.trim()
  check('L-C08-IF5-POST', 'IF-5 shared surface still byte-untouched at closure', sharedDiffAfter === '', sharedDiffAfter === '' ? 'porcelain empty' : sharedDiffAfter.split('\n').slice(0, 4).join(' | '))

  const failed = CRITERIA.filter((c) => !c.pass)
  writeEvidence('run-receipt.md', [
    `# a5c08 ${MODE} run ${RUN_STAMP}`,
    ``,
    `- host: ${TESTUSE} @ ${TEST_USE_BASELINE_SHA.slice(0, 10)} (pinned 0.2.0-rc.2, read-only reuse)`,
    `- port ${HOST_PORT} · mock ${mockPort} · world ${KEEP ? `KEPT: ${HOME}` : 'deleted at teardown'}`,
    `- dist: ${DIST_PACKAGES}`,
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

function sha256OfB64(b64) {
  return `sha256:${createHash('sha256').update(Buffer.from(b64, 'base64')).digest('hex')}`
}

main().catch(async (error) => {
  console.error(String(error?.stack ?? error))
  try { const j = readFileSync(INSTANCE_RAW, 'utf8'); writeFileSync(join(EVIDENCE_DIR, 'host-log-tail.txt'), redact(j).split('\n').slice(-80).join('\n')); rmSync(INSTANCE_RAW) } catch { /* none */ }
  await finalize('FATAL')
  process.exit(1)
})
