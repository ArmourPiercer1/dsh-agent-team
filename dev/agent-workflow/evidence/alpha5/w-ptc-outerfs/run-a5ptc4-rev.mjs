#!/usr/bin/env node
/**
 * run-a5ptc4-rev.mjs — W-PTC-OUTERFS independent SECURITY-REVIEW live runner (v2).
 *
 * Reviewer lane (OUTERFS 独立安全审查, branch alpha5-ptc-outerfs-rev-sec @
 * 903c062f). Installs the reviewed artifact UNCHANGED (a5ptc4-row.mjs, byte-id
 * with 903c062f) plus an observer-only probe row, then adjudicates the root
 * brief as runnable criteria.
 *
 * Topology lesson from run v1 (runs/a5ptc4-rev-2026-10-17T08-22-55Z): an
 * attached downstream approval lane (remote/GUI bridge shape) HOLDS every
 * foreign ask pending a human answer — pending on the calling session's queue,
 * which serializes and starves every later leg on that session. v2 therefore
 * runs foreign/held legs (RF/RU/RG) on DEDICATED sessions (like real "other
 * team" traffic) and answered legs on sessions A/B.
 *
 *  R1  DELEGATION (foreign, no token, dedicated session): reviewed resolver
 *      answered ZERO; the ask VERBATIM reaches the downstream ask-lane
 *      (session-log approval/asked with the same reason+callId, tool call
 *      pending = delivered to the human bridge lane); zero grants, zero writes.
 *  R2  NEG-1 wrong/unknown grant token: same posture, refused (never granted).
 *  R3  positive anchor: allowed-once grant really widens exactly this call.
 *  R4  NEG-2 REPLAY of the consumed allowed-once token: REQUIRED refused.
 *  R5  NEG-3/5 revocation/stale (grant flipped to reject; expiry stand-in —
 *      no TTL exists in the reviewed resolver): REQUIRED refused.
 *  R6  NEG-4 cross-session ("other team") presentation of a foreign grant
 *      token: REQUIRED refused (attribution check mandatory).
 *  R7  concurrency: sessions A/B in parallel, each ask decided ONLY by its own
 *      grant (tA allow / tB reject), distinct callIds, no cross-talk.
 *  R8  GUI-bridge-in-place posture with the late probe: reviewed side answers
 *      zero; ask pending at the lane; zero side effects.
 *  R9  install/uninstall symmetry (probe disposer symmetric; reviewed resolver
 *      keeps no disposer — permanent {global,prepend} listener).
 *  R10 original permissions not lowered: mode + approval policy constant
 *      before/after on BOTH sessions; secret byte-identical; forbidden dir
 *      contains ONLY the review-controlled files.
 *
 * Port 3184 (self-proven free); world tests/homes/a5ptc4-rev-<stamp> (deleted
 * at teardown unless --keep). EXIT 0 = every criterion behaved as REQUIRED;
 * findings (failed criteria) exit 2 — they are the review product.
 */
import { spawn, spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { createServer } from 'node:net'
import { existsSync, mkdirSync, openSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync, copyFileSync } from 'node:fs'
import { basename, dirname, join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

import { startMockModel } from '../../../../../packages/tools/harness/mock-deepseek.mjs'
import { TEST_USE_BASELINE_SHA, CLIENT_COMMIT_HASH } from '../../../../../tests/paths.mjs'

const args = process.argv.slice(2)
const argValue = (n, d) => { const i = args.indexOf(`--${n}`); return i === -1 ? d : args[i + 1] }
const KEEP = args.includes('--keep')
const HERE = dirname(new URL(import.meta.url).pathname)
const WORKTREE = resolve(argValue('worktree', resolve(HERE, '..', '..', '..', '..', '..')))
const RUN_STAMP = new Date().toISOString().slice(0, 19).replace(/:/g, '-') + 'Z'
const RUN = `a5ptc4-rev-${RUN_STAMP}`
const EVIDENCE_DIR = resolve(join(HERE, 'runs', `${RUN}`))
mkdirSync(EVIDENCE_DIR, { recursive: true })

const HOST_PORT = Number(argValue('port', 3184))
const TESTUSE = resolve(argValue('testuse', '/srv/workspace/dsh-plugins/dsh-agent-team/.worktrees/dsh-020rc2-upgrade/tests/deepseek-harness-test-use'))
const LAUNCHER = resolve(argValue('launcher', '/srv/workspace/dsh-plugins/dsh-agent-team/tests/deepseek-harness-test-use/native/system/packages/linux-x64/bin/landlock-run'))
const HOST_BIN = join(TESTUSE, 'apps', 'cli', 'lib', 'bin.js')
const ROW_PATH = join(HERE, 'a5ptc4-row.mjs')
const PROBE_PATH = join(HERE, 'rev-probe-pkg', 'rev-sec-probe.mjs')
const HOME = join(WORKTREE, 'tests', 'homes', RUN)
const WS = join(HOME, 'ws')
const FORB = join(WORKTREE, 'tests', 'homes', `${RUN}-forb`)
const SECRET = join(FORB, 'secret.txt')
const LEDGER = join(EVIDENCE_DIR, 'assembly-ledger.jsonl')
const REV_LEDGER = join(EVIDENCE_DIR, 'rev-ledger.jsonl')
const INSTANCE_RAW = join(EVIDENCE_DIR, 'instance.raw.log')
const INSTANCE_LOG = join(EVIDENCE_DIR, 'instance.log')
const SECRET_VALUE = `A5PTC4-REV-SECRET-${RUN_STAMP}`

const REDACTIONS = [
  [/(https?:\/\/[^\s"'`]+?\?token=)([A-Za-z0-9_-]{8,})/g, (_m, head, tok) => head + `<REDACTED-${createHash('sha256').update(tok).digest('hex').slice(0, 8)}>`],
  [/\b(token|api_key|apikey|access_token)=["']?[A-Za-z0-9_\-.=]{8,}/gi, (m0) => m0.split('=')[0] + '=<REDACTED>'],
  [/dsh-auth-[A-Za-z0-9_-]{6,}/g, 'dsh-auth-<REDACTED>'],
]
const redact = (t) => REDACTIONS.reduce((x, [re, r]) => x.replace(re, r), t)

const CRITERIA = []
const check = (id, claim, cond, observed) => {
  CRITERIA.push({ id, claim, pass: cond === true, observed: typeof observed === 'string' ? observed : JSON.stringify(observed ?? null) })
  console.log(`${cond === true ? 'PASS' : 'FAIL'} ${id} — ${claim}`)
  if (observed !== undefined) console.log(`     observed: ${typeof observed === 'string' ? observed.slice(0, 700) : JSON.stringify(observed ?? null).slice(0, 700)}`)
}
const die = (msg) => { throw new Error(`FATAL: ${msg}`) }

const portFree = (port) => new Promise((res) => { const s = createServer(); s.once('error', () => res(false)); s.once('listening', () => s.close(() => res(true))); s.listen(port, '127.0.0.1') })
const gitAt = (dir, ...a) => spawnSync('git', ['-C', dir, ...a], { encoding: 'utf8' }).stdout.trim()
const sha256 = (buf) => createHash('sha256').update(buf).digest('hex')
const stableProbe = async () => { try { const r = await fetch('http://127.0.0.1:3080/', { redirect: 'manual', signal: AbortSignal.timeout(5000) }); return r.status } catch { return 'unreachable' } }
const lsDir = (dir) => { try { return readdirSync(dir).sort() } catch { return [] } }
const readIfExists = (p) => { try { return readFileSync(p, 'utf8') } catch { return null } }

let host = null
let mock = null
let stableBefore = null
async function finalize(status) {
  try { host?.child?.kill() } catch { /* gone */ }
  try { await mock?.close?.() } catch { /* gone */ }
  await new Promise((r) => setTimeout(r, 400))
  try { writeFileSync(INSTANCE_LOG, redact(readFileSync(INSTANCE_RAW, 'utf8'))); rmSync(INSTANCE_RAW) } catch { /* no log */ }
  try {
    const copies = []
    const walk = (dir) => {
      for (const e of readdirSync(dir, { withFileTypes: true })) {
        const p = join(dir, e.name)
        if (e.isDirectory()) walk(p)
        else if (e.isFile() && /^session\..*\.jsonl(\.zstd)?$/.test(e.name) && statSync(p).size < 8_000_000) {
          mkdirSync(join(EVIDENCE_DIR, 'session-logs'), { recursive: true })
          const dest = join(EVIDENCE_DIR, 'session-logs', `${basename(dirname(p))}__${e.name}`)
          copyFileSync(p, dest)
          copies.push(dest.replace(`${EVIDENCE_DIR}/`, ''))
          try {
            const dec = spawnSync('zstd', ['-d', '-c', p], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
            if (Number(dec.status) === 0) writeFileSync(`${dest}.redacted.txt`, redact(String(dec.stdout ?? '')))
          } catch { /* decode best-effort */ }
        }
      }
    }
    if (existsSync(HOME)) walk(HOME)
    if (copies.length > 0) writeEvidence('session-logs-copied.json', copies)
  } catch { /* diagnostics only */ }
  if (!KEEP) {
    try { rmSync(HOME, { recursive: true, force: true }) } catch { /* best effort */ }
    try { rmSync(FORB, { recursive: true, force: true }) } catch { /* best effort */ }
  }
  writeEvidence('criteria.json', { run: RUN, mode: 'REVIEW-v2', launcherSha, status, criteria: CRITERIA })
}
const writeEvidence = (name, value) => writeFileSync(join(EVIDENCE_DIR, name), typeof value === 'string' ? value : JSON.stringify(value, null, 2) + '\n')

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
async function pollUntil(deadlineMs, fn, what) {
  const deadline = Date.now() + deadlineMs
  for (;;) {
    const v = await fn()
    if (v !== null && v !== undefined && v !== false) return v
    if (Date.now() >= deadline) return { __held: what }
    await new Promise((r) => setTimeout(r, 250))
  }
}
async function fetchJson(url, init, timeoutMs = 30_000) {
  const res = await fetch(url, { ...(init ?? {}), signal: AbortSignal.timeout(timeoutMs) })
  const text = await res.text()
  try { return { status: res.status, body: JSON.parse(text) } } catch { return { status: res.status, body: text } }
}

const launcherSha = (() => { try { return sha256(readFileSync(LAUNCHER)) } catch { return null } })()

const prog = (body) => [
  "const fs = await import('node:fs');",
  'const pid = process.pid;',
  body,
].join('\n')
const PROGRAM_ESC = (leg) => prog(`
const w = await tools.a5ptc4_echo({ tag: '${leg}-body' });
let writeCode = 'wrote';
try { fs.writeFileSync('${FORB}/${leg}-target.txt', 'A5PTC4-REV-BODY-RAN-' + pid); } catch (e) { writeCode = String(e.code); }
return { pid, ppid: process.ppid, echo: w, writeCode, canary: 'A5PTC4-REV-BODY-RAN' };`)

const VERBATIM_REJECT = 'the user rejected escalating this program to "danger-full-access"'

async function main() {
  stableBefore = await stableProbe()
  console.log(`stable-instance :3080 probe (pre) = ${stableBefore}`)
  if (!(await portFree(HOST_PORT))) die(`port ${HOST_PORT} busy`)
  const pinnedHead = gitAt(TESTUSE, 'rev-parse', 'HEAD')
  const porcelain0 = gitAt(TESTUSE, 'status', '--porcelain') === ''
  check('P-PIN', `host tree pinned @${TEST_USE_BASELINE_SHA.slice(0, 10)} porcelain=0`, pinnedHead === TEST_USE_BASELINE_SHA && porcelain0, `head=${pinnedHead.slice(0, 12)} porcelain=${porcelain0}`)

  mkdirSync(WS, { recursive: true })
  mkdirSync(FORB, { recursive: true })
  writeFileSync(SECRET, `${SECRET_VALUE}\n`)
  const secretShaPre = sha256(readFileSync(SECRET))
  const probeRun = spawnSync(LAUNCHER, ['--probe'], { encoding: 'utf8', timeout: 4000 })
  writeEvidence('os-preflight.json', { launcher: LAUNCHER, sha256: launcherSha, probe: { exit: probeRun.status, stdout: String(probeRun.stdout ?? '').trim() } })
  check('P-OS-PREFLIGHT', 'Landlock launcher present (--probe exit 0)', probeRun.status === 0, String(probeRun.stdout ?? '').trim())

  mkdirSync(join(HOME, 'profiles', 'web'), { recursive: true })
  writeFileSync(join(HOME, 'profiles', 'web', 'cordis.patch.yml'), [
    `# a5ptc4-rev SECURITY review patch (run ${RUN}): reviewed row byte-identical to 903c062f + observer probe row.`,
    '- insert:',
    '    - id: a5ptc4-outerfs',
    `      name: ${JSON.stringify(pathToFileURL(ROW_PATH).href)}`,
    '      config: {}',
    '    - id: a5ptc4-rev-probe',
    `      name: ${JSON.stringify(pathToFileURL(PROBE_PATH).href)}`,
    '      config: {}',
    '',
  ].join('\n'))

  const MK = RUN.replace(/[^A-Za-z0-9]/g, '').toUpperCase()
  // marker → forbidden-target file stem; justification carries the grant token
  const ESC_LEGS = { RF: 'rev-f', RU: 'rev-u', RA: 'rev-a', RP: 'rev-replay', RC: 'rev-policy', RX: 'rev-x', QA: 'rev-qa', QB: 'rev-qb', RG: 'rev-g' }
  const JUST = {
    RF: 'reviewer-leg-RF please widen to write the fixture (no grant token here at all)',
    RU: 'A5PTC4-TOKEN:t-nope reviewer-leg-RU unknown token, never granted',
    RA: 'A5PTC4-TOKEN:t-r reviewer-leg-RA first use of an allowed-once grant (session A)',
    RP: 'A5PTC4-TOKEN:t-r reviewer-leg-RP REPLAY of the already-consumed grant token',
    RC: 'A5PTC4-TOKEN:t-r reviewer-leg-RC same token AFTER revocation (grant flipped to reject; expiry stand-in)',
    RX: 'A5PTC4-TOKEN:t-x reviewer-leg-RX token granted for session A presented by SESSION-B foreign-team stand-in',
    QA: 'A5PTC4-TOKEN:tA reviewer-leg-QA session-A own grant allow in a parallel pair',
    QB: 'A5PTC4-TOKEN:tB reviewer-leg-QB session-B own grant reject in a parallel pair',
    RG: 'reviewer-leg-RG foreign no-token ask with late probe and attached bridge lane in place',
  }
  let reqs = 0
  mock = await startMockModel({
    port: 0,
    decide: ({ req }) => {
      reqs += 1
      if (reqs > 80) return { kind: 'text', content: `${MK}_FUSED fuse at ${reqs}` }
      const body = req?.body ?? req ?? {}
      const msgs = body.messages ?? []
      const users = msgs.filter((m) => m?.role === 'user')
      const last = users[users.length - 1]
      const lastText = typeof last?.content === 'string' ? last.content : JSON.stringify(last?.content ?? '')
      const hit = Object.keys(ESC_LEGS).find((l) => lastText.includes(`${MK}_${l} `) || lastText.endsWith(`${MK}_${l}`))
      if (hit == null) return lastText.includes('_SET_') ? { kind: 'text', content: `${MK}_SET_OK` } : { kind: 'text', content: 'a5ptc4-rev-mock: quiet.' }
      const idx = msgs.indexOf(last)
      const after = msgs.slice(idx + 1)
      const results = after.flatMap((m) => Array.isArray(m?.content) ? m.content.filter((b) => b?.type === 'tool_result') : [])
      if (results.length > 0) {
        const t = results.map((b) => { const c = b.content; return typeof c === 'string' ? c : Array.isArray(c) ? c.map((x) => x?.text ?? '').join('') : JSON.stringify(c ?? '') }).join(' | ')
        return { kind: 'text', content: `${MK}_DONE_${hit} ${t.slice(0, 900)}` }
      }
      const callArgs = { code: PROGRAM_ESC(ESC_LEGS[hit]), description: `a5ptc4-rev ${hit}: per-call governance review leg` }
      callArgs.sandbox_permissions = 'danger-full-access'
      callArgs.justification = JUST[hit]
      // deterministic callId → review can correlate ask/asked/result lines
      return { kind: 'tool-call', toolCalls: [{ id: `call-${MK}-${hit}`, name: 'run_code', arguments: callArgs }] }
    },
  })

  const outFd = openSync(INSTANCE_RAW, 'a')
  const child = spawn(process.execPath, [HOST_BIN, 'web', '--port', String(HOST_PORT), '--no-open'], {
    cwd: TESTUSE,
    stdio: ['ignore', outFd, outFd],
    env: {
      ...process.env,
      DSH_HOME: HOME,
      DSH_CLIENT_COMMIT_HASH: CLIENT_COMMIT_HASH,
      DEEPSEEK_BASE_URL: `http://127.0.0.1:${mock.port}`,
      DEEPSEEK_API_KEY: 'a5ptc4-rev-mock-key',
      A5PTC4_ASSEMBLE: '1',
      A5PTC4_TESTUSE: TESTUSE,
      A5PTC4_LEDGER: LEDGER,
      A5PTC4_LAUNCHER: LAUNCHER,
      A5PTC4_RUN: RUN,
      A5PTC4_REV_LEDGER: REV_LEDGER,
    },
  })
  host = { child }
  child.on('exit', (code, signal) => console.log(`host exited code=${String(code)} signal=${String(signal)}`))
  const boot = await waitFor(90_000, () => {
    try { const m = BOOT_MARKER.exec(readFileSync(INSTANCE_RAW, 'utf8')); return m === null ? false : m } catch { return false }
  }, 'host boot marker')
  const origin = `http://127.0.0.1:${boot[1]}`
  const cookie = (await fetch(`${origin}/?token=${boot[2]}`, { redirect: 'manual', signal: AbortSignal.timeout(30_000) })).headers.get('set-cookie')
  check('L-BOOT', `host booted on ${HOST_PORT} (port self-proven free) with token gate`, cookie !== null, `cookie=${cookie !== null}`)
  await waitFor(30_000, async () => { const h = await fetchJson(`${origin}/__rev/health`).catch(() => null); return h?.status === 200 && h.body.applied === true ? h : false }, 'probe row apply')
  await waitFor(30_000, async () => { const h = await fetchJson(`${origin}/__a5ptc4/health`).catch(() => null); return h?.status === 200 && h.body.applied === true ? h : false }, 'reviewed row apply')

  const api = (method, payload, timeoutMs = 240_000) => fetchJson(`${origin}/api/session/${method}`, {
    method: 'POST', headers: { 'content-type': 'application/json', cookie: cookie ?? '' },
    body: JSON.stringify({ type: 'client-request', rpcId: `rev-${Math.random().toString(36).slice(2, 10)}`, method: `session/${method}`, payload: { args: { request: payload } } }),
  }, timeoutMs)
  const createSession = async () => {
    const r = await api('create', { requestId: `rev-c-${Math.random().toString(36).slice(2, 10)}`, cwd: WS }, 60_000)
    return r.body?.result?.value?.sessionId ?? r.body?.value?.sessionId ?? null
  }
  const sidA = await createSession()
  const sidB = await createSession()
  const sidF1 = await createSession() // throwaway: held foreign legs
  const sidF2 = await createSession()
  const sidF3 = await createSession()
  check('L-CREATE', 'five sessions created through the public entry (A/B answered, F1/F2/F3 dedicated foreign)', [sidA, sidB, sidF1, sidF2, sidF3].every((s) => typeof s === 'string' && s !== ''), `A=${String(sidA).slice(0, 18)} B=${String(sidB).slice(0, 18)}`)
  const prompt = (sid, text) => api('prompt', { requestId: `rev-r-${Math.random().toString(36).slice(2, 10)}`, sessionId: sid, mode: 'queue', content: [{ type: 'text', text }] }, 240_000)

  await prompt(sidA, `${MK}_SET_A setup turn A; reply OK`)
  await prompt(sidB, `${MK}_SET_B setup turn B; reply OK`)
  await prompt(sidF1, `${MK}_SET_F1 setup turn F1; reply OK`)
  await prompt(sidF2, `${MK}_SET_F2 setup turn F2; reply OK`)
  await prompt(sidF3, `${MK}_SET_F3 setup turn F3; reply OK`)
  const assemble = async (sid, expect) => {
    await waitFor(90_000, async () => { const r = await fetchJson(`${origin}/__a5ptc4/assemble`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ sessionId: sid }) }).catch(() => null); return r?.body?.ok === true ? r : false }, 'assemble route')
    const v = await waitFor(120_000, async () => {
      const rows = ((await fetchJson(`${origin}/__a5ptc4/journal`).catch(() => null))?.body?.rows) ?? []
      if (rows.some((r) => r.leg === 'assembly-failed')) return 'failed'
      return rows.filter((r) => r.leg === 'assembly-complete').length >= expect ? true : false
    }, `assembly #${expect}`)
    if (v === 'failed') die('assembly failed during wait')
  }
  await assemble(sidA, 1)
  await assemble(sidB, 2)
  // v2 lesson: run_code only dispatches on ASSEMBLED sessions (unknown-tool
  // refusal otherwise) → assemble the dedicated foreign-leg sessions too.
  await assemble(sidF1, 3)
  await assemble(sidF2, 4)
  await assemble(sidF3, 5)
  const jrows = async () => ((await fetchJson(`${origin}/__a5ptc4/journal`).catch(() => null))?.body?.rows) ?? []
  const state = async () => (await fetchJson(`${origin}/__a5ptc4/state`)).body?.assemblies ?? {}
  const labels = Object.keys(await state())
  check('L-ASSEMBLY', 'both session assemblies completed (witness tools + guard + per-agent resolver face)', labels.length >= 2, `labels=${JSON.stringify(labels)}`)
  const labelOf = (sid, fallback) => labels.find((l) => l.includes(String(sid).replace(/[^A-Za-z0-9._-]/g, '_').slice(0, 80))) ?? labels.find((l) => l.includes(String(sid).slice(0, 8))) ?? fallback
  const labelA = labelOf(sidA, labels[0])
  const labelB = labelOf(sidB, labels[1] ?? labels[0])
  const runsOf = async (label) => (await state())?.[label]?.runs ?? []
  const approvals = async () => ((await fetchJson(`${origin}/__a5ptc4/approvals`).catch(() => null))?.body?.rows) ?? []
  const grantFeed = async (token, decision) => { await fetchJson(`${origin}/__a5ptc4/grant`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ token, decision }) }) }
  const probes = async () => (await fetchJson(`${origin}/__rev/probes`).catch(() => null))?.body ?? { probeA: [], probeB: [] }
  const hooks = async (tag) => { const h = (await fetchJson(`${origin}/__rev/hooks`).catch(() => null))?.body; writeEvidence(`hooks-${tag}.json`, h); return h }

  // session-log scanner: find the session's v4 log under HOME, decode, return
  // lines containing BOTH needles (approval/asked events with verbatim reason).
  const sessionLogLines = (sid, needle) => {
    const shorts = [String(sid), String(sid).replace(/^session-/, '')]
    const out = []
    const walk = (dir) => {
      for (const e of readdirSync(dir, { withFileTypes: true })) {
        const p = join(dir, e.name)
        if (e.isDirectory()) { if (shorts.some((s) => p.includes(s)) || dir === HOME) walk(p) } else if (/^session\..*\.jsonl\.zstd$/.test(e.name) && shorts.some((s) => p.includes(s))) {
          const dec = spawnSync('zstd', ['-d', '-c', p], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
          if (Number(dec.status) === 0) for (const line of String(dec.stdout ?? '').split('\n')) if (line.includes(needle) || line.includes(`call-${MK}-${needle}`)) out.push(line.slice(0, 1200))
        }
      }
    }
    try { walk(HOME) } catch { /* raced */ }
    return out
  }

  const bootHooks = await hooks('boot')
  const modeOf = async (sid) => (await fetchJson(`${origin}/__a5ptc4/mode`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ sessionId: sid }) })).body
  const modeA0 = await modeOf(sidA)
  const modeB0 = await modeOf(sidB)

  await grantFeed('t-r', 'allow')
  await grantFeed('t-x', 'allow')
  await grantFeed('tA', 'allow')
  await grantFeed('tB', 'reject')

  const runLeg = async (label, sid, marker, waitMs = 90_000) => {
    const before = (await runsOf(label)).length
    await prompt(sid, `${MK}_${marker} review leg ${marker}`)
    const settled = await pollUntil(waitMs, async () => {
      const runs = await runsOf(label)
      return runs.length > before ? runs[runs.length - 1] : false
    }, `${marker} settle`)
    return { run: settled?.__held ? null : settled, held: settled?.__held !== undefined }
  }
  const journalAsk = async (marker) => {
    const callId = `call-${MK}-${marker}`
    return (await jrows()).filter((r) => r.leg === 'approval-ask' && (r.callId === callId || String(r.reasonHead ?? '').includes(`reviewer-leg-${marker}`)))
  }
  // asked-pending proof: the session log carries approval/asked {id, callId,
  // verbatim reason} for the ask and NO approval/decided for that id ⇒ the ask
  // was neither answered by us nor swallowed — it is PENDING on the lane.
  const askedPending = (askedLines, callId) => {
    let askedId = null
    for (const l of askedLines) {
      try {
        const r = JSON.parse(l)
        if (r?.type === 'approval/asked' && String(r?.data?.callId) === callId) askedId = String(r.data.id)
      } catch { /* truncated line */ }
    }
    return askedId
  }
  const approvalsFor = async (marker) => (await approvals()).filter((x) => x.callId === `call-${MK}-${marker}` || String(x.reasonHead ?? '').includes(`reviewer-leg-${marker}`))
  const parseRun = (run) => { try { return JSON.parse(/(\{.*\})/s.exec(String(run?.text ?? ''))?.[1] ?? 'null') } catch { return null } }

  // ── R1 foreign no-token ask (dedicated session F1) ────────────────────────
  await prompt(sidF1, `${MK}_RF review leg RF`)
  const askedRF = await pollUntil(60_000, async () => { const l = sessionLogLines(sidF1, 'RF'); return l.length > 0 ? l : false }, 'approval/asked for RF')
  await new Promise((r) => setTimeout(r, 15_000)) // window in which any answer/execution could land
  const jRF = await journalAsk('RF')
  const aRF = await approvalsFor('RF')
  const pr = await probes()
  const askedRFnow = Array.isArray(askedRF) ? askedRF : sessionLogLines(sidF1, 'RF')
  const rfAskedId = askedPending(askedRFnow, `call-${MK}-RF`)
  const rfDecided = rfAskedId !== null && sessionLogLines(sidF1, rfAskedId).some((l) => l.includes('approval/decided') && l.includes(rfAskedId))
  writeEvidence('leg-RF.json', { journal: jRF, approvals: aRF, askedLines: askedRFnow, askedId: rfAskedId, decided: rfDecided, probeA_saw_RF: pr.probeA.filter((x) => x.reason.includes('reviewer-leg-RF')).length, probeB_saw_RF: pr.probeB.filter((x) => x.reason.includes('reviewer-leg-RF')).length })
  check('R1-DELEGATION-ZERO-ANSWER-VERBATIM-DOWNSTREAM', 'R1 foreign no-token ask: reviewed resolver answered ZERO (journal decision=foreign outcome=pass-through, no outcome row) AND the ask reached the downstream ask-lane VERBATIM (session-log approval/asked carries the same callId+reason) and is still PENDING (no approval/decided for that ask id — not swallowed, not pre-empted), zero writes',
    jRF.some((x) => x.decision === 'foreign' && x.outcome === 'pass-through')
    && aRF.length === 0
    && rfAskedId !== null && !rfDecided
    && !existsSync(join(FORB, 'rev-f-target.txt')),
    `journal=${JSON.stringify(jRF.map(({ leg, ...x }) => x)).slice(0, 400)} approvals_N=${aRF.length} askedId=${rfAskedId} decided=${rfDecided} probeA_saw=${pr.probeA.filter((x) => x.reason.includes('reviewer-leg-RF')).length} (0 = the attached lane holds ahead of a later probe)`)

  // ── R2 negative-1: unknown token (dedicated session F2) ───────────────────
  await prompt(sidF2, `${MK}_RU review leg RU`)
  const askedRU = await pollUntil(60_000, async () => { const l = sessionLogLines(sidF2, 'RU'); return l.length > 0 ? l : false }, 'approval/asked for RU')
  await new Promise((r) => setTimeout(r, 15_000))
  const jRU = await journalAsk('RU')
  const aRU = await approvalsFor('RU')
  const askedRUnow = Array.isArray(askedRU) ? askedRU : sessionLogLines(sidF2, 'RU')
  const ruAskedId = askedPending(askedRUnow, `call-${MK}-RU`)
  const ruDecided = ruAskedId !== null && sessionLogLines(sidF2, ruAskedId).some((l) => l.includes('approval/decided') && l.includes(ruAskedId))
  writeEvidence('leg-RU.json', { journal: jRU, approvals: aRU, askedLines: askedRUnow, askedId: ruAskedId, decided: ruDecided })
  check('R2-NEG-WRONG-CALLID-REFUSED-NEVER-GRANTED', 'R2 negative-control wrong/unknown grant token: resolver answered NOTHING beyond pass-through (decision=unknown outcome=pass-through; never granted — refused via the host lane), ask verbatim-visible downstream and PENDING (not swallowed), zero writes',
    jRU.some((x) => x.decision === 'unknown' && x.outcome === 'pass-through')
    && aRU.length === 0
    && ruAskedId !== null && !ruDecided
    && !existsSync(join(FORB, 'rev-u-target.txt')),
    `journal=${JSON.stringify(jRU.map(({ leg, ...x }) => x)).slice(0, 400)} approvals_N=${aRU.length} askedId=${ruAskedId} decided=${ruDecided} targetWritten=${existsSync(join(FORB, 'rev-u-target.txt'))}`)

  // ── R3 positive anchor (session A) ────────────────────────────────────────
  const r3 = await runLeg(labelA, sidA, 'RA')
  const leg3 = parseRun(r3.run)
  const appRA = (await approvals()).find((x) => x.token === 't-r' && x.callId.endsWith('-RA'))
  writeEvidence('leg-RA.json', { run: r3.run, leg3, appRA })
  check('R3-ALLOWED-ONCE-WIDENS-THIS-CALL', 'R3 positive anchor: grant allow → allowed-once → forbidden target really written this one call (sandbox.mode=danger-full-access for the ONE call)',
    readIfExists(join(FORB, 'rev-a-target.txt')) === 'A5PTC4-REV-BODY-RAN-' + leg3?.pid && appRA?.outcome === 'allowed-once' && r3.run?.raw?.value?.sandbox?.mode === 'danger-full-access',
    `target=${JSON.stringify(readIfExists(join(FORB, 'rev-a-target.txt')))} appRA=${JSON.stringify(appRA)} sandbox=${JSON.stringify(r3.run?.raw?.value?.sandbox)}`)

  // ── R4 negative-2: REPLAY of the consumed allowed-once token ──────────────
  const r4 = await runLeg(labelA, sidA, 'RP')
  const replayWrites = existsSync(join(FORB, 'rev-replay-target.txt'))
  const appRP = (await approvals()).filter((x) => x.token === 't-r')
  const jRP = (await jrows()).filter((x) => x.leg === 'approval-ask' && x.callId.endsWith('-RP'))
  writeEvidence('leg-RP.json', { run: r4.run, replayWrites, appRP, jRP })
  check('R4-NEG-REPLAY-MUST-BE-REFUSED', 'R4 negative-control replay of an already-consumed allowed-once grant (same token, new callId): REQUIRED refused (grant is one-shot) and zero new writes',
    !replayWrites && String(r4.run?.text ?? '').includes(VERBATIM_REJECT),
    `replayTargetWritten=${replayWrites} journalRP=${JSON.stringify(jRP.map((x) => ({ decision: x.decision, outcome: x.outcome, callId: String(x.callId).slice(-4) })))} runText=${String(r4.run?.text ?? '(held)').slice(0, 200)}`)

  // ── R5 negative-3/5: revocation / stale grant ─────────────────────────────
  await grantFeed('t-r', 'reject')
  const r5 = await runLeg(labelA, sidA, 'RC')
  const policyWrites = existsSync(join(FORB, 'rev-policy-target.txt'))
  const jRC = (await jrows()).filter((x) => x.leg === 'approval-ask' && x.callId.endsWith('-RC'))
  writeEvidence('leg-RC.json', { run: r5.run, policyWrites, jRC })
  check('R5-NEG-REVOKED-STALE-MUST-BE-REFUSED', 'R5 negative-control after REVOCATION (grant flipped to reject; expiry stand-in — no TTL exists): a stale re-presentation MUST be refused with zero new writes',
    !policyWrites && String(r5.run?.text ?? '').includes(VERBATIM_REJECT),
    `policyTargetWritten=${policyWrites} journalRC=${JSON.stringify(jRC.map((x) => ({ decision: x.decision, outcome: x.outcome })))} runText=${String(r5.run?.text ?? '(held)').slice(0, 200)}`)

  // ── R6 negative-4: cross-session presentation (session B) ─────────────────
  const r6 = await runLeg(labelB, sidB, 'RX')
  const xWrites = existsSync(join(FORB, 'rev-x-target.txt'))
  const appRX = (await approvals()).filter((x) => x.token === 't-x')
  writeEvidence('leg-RX.json', { run: r6.run, xWrites, appRX, labelA, labelB })
  check('R6-NEG-FOREIGN-SESSION-MUST-BE-REFUSED', 'R6 negative-control token granted for session A presented by SESSION B (foreign-team stand-in): REQUIRED refused — the resolver must only adjudicate asks VERIFIABLY owned by its Team/member (host fields agent/callId bound to a Grant), not token-shaped strings in model text',
    !xWrites && String(r6.run?.text ?? '').includes(VERBATIM_REJECT),
    `xTargetWritten=${xWrites} widened=${JSON.stringify(r6.run?.raw?.value?.sandbox)} runText=${String(r6.run?.text ?? '(held)').slice(0, 160)} t-x-ledger=${JSON.stringify(appRX.map((x) => ({ seq: x.seq, agent: String(x.agent).slice(0, 24), outcome: x.outcome })))}`)

  // ── R7 concurrency: parallel pair ─────────────────────────────────────────
  const beforeQA = (await runsOf(labelA)).length
  const beforeQB = (await runsOf(labelB)).length
  await prompt(sidA, `${MK}_QA review leg QA`)
  await prompt(sidB, `${MK}_QB review leg QB`)
  const qa = await pollUntil(90_000, async () => { const runs = await runsOf(labelA); return runs.length > beforeQA ? runs[runs.length - 1] : false }, 'QA settle')
  const qb = await pollUntil(90_000, async () => { const runs = await runsOf(labelB); return runs.length > beforeQB ? runs[runs.length - 1] : false }, 'QB settle')
  const appFinal = await approvals()
  const rowQA = appFinal.filter((x) => x.token === 'tA')
  const rowQB = appFinal.filter((x) => x.token === 'tB')
  writeEvidence('leg-QA-QB.json', { qa: qa?.__held ? null : qa, qb: qb?.__held ? null : qb, rowQA, rowQB })
  check('R7-CONCURRENCY-ISOLATION', 'R7 two sessions in parallel: tA (A, allow) allowed+wrote, tB (B, reject) refused verbatim+zero writes; distinct callIds; each ask decided only by its own grant; agents match',
    existsSync(join(FORB, 'rev-qa-target.txt')) && !existsSync(join(FORB, 'rev-qb-target.txt'))
    && rowQA.length === 1 && rowQB.length === 1
    && rowQA[0]?.outcome === 'allowed-once' && rowQB[0]?.outcome === 'rejected'
    && String(qa?.text ?? '').includes('A5PTC4-REV-BODY-RAN') && String(qb?.text ?? '').includes(VERBATIM_REJECT)
    && rowQA[0]?.agent === labelA && rowQB[0]?.agent === labelB
    && rowQA[0]?.callId !== rowQB[0]?.callId,
    `qaWritten=${existsSync(join(FORB, 'rev-qa-target.txt'))} qbWritten=${existsSync(join(FORB, 'rev-qb-target.txt'))} rowQA=${JSON.stringify(rowQA.map((x) => ({ outcome: x.outcome, agent: String(x.agent).slice(0, 20), callId: String(x.callId).slice(-6) })))} rowQB=${JSON.stringify(rowQB.map((x) => ({ outcome: x.outcome, agent: String(x.agent).slice(0, 20), callId: String(x.callId).slice(-6) })))}`)

  // ── R8 GUI-bridge-in-place posture: late probe + attached lane (F3) ───────
  await fetchJson(`${origin}/__rev/register-probeB`, { method: 'POST' })
  const midHooks = await hooks('mid')
  await prompt(sidF3, `${MK}_RG review leg RG`)
  const askedRG = await pollUntil(60_000, async () => { const l = sessionLogLines(sidF3, 'RG'); return l.length > 0 ? l : false }, 'approval/asked for RG')
  await new Promise((r) => setTimeout(r, 20_000))
  const pr8 = await probes()
  const jRG = await journalAsk('RG')
  const aRG = await approvalsFor('RG')
  const askedRGnow = Array.isArray(askedRG) ? askedRG : sessionLogLines(sidF3, 'RG')
  const rgAskedId = askedPending(askedRGnow, `call-${MK}-RG`)
  const rgDecided = rgAskedId !== null && sessionLogLines(sidF3, rgAskedId).some((l) => l.includes('approval/decided') && l.includes(rgAskedId))
  writeEvidence('leg-RG.json', { journal: jRG, approvals: aRG, askedLines: askedRGnow, askedId: rgAskedId, decided: rgDecided, probeA: pr8.probeA.filter((x) => x.reason.includes('reviewer-leg-RG')), probeB: pr8.probeB.filter((x) => x.reason.includes('reviewer-leg-RG')), midHooks })
  check('R8-GUI-BRIDGE-POSTURE-NO-PREEMPT', 'R8 foreign ask with late probe + attached approval lane in place: reviewed side answered ZERO; ask verbatim at the lane and PENDING (or answered downstream if a human lane were live); zero grants, zero writes, zero answers from our side',
    jRG.some((x) => x.decision === 'foreign' && x.outcome === 'pass-through')
    && aRG.length === 0
    && !existsSync(join(FORB, 'rev-g-target.txt'))
    && (pr8.probeB.some((x) => x.reason.includes('reviewer-leg-RG')) || (rgAskedId !== null && !rgDecided)),
    `askedId=${rgAskedId} decided=${rgDecided} probeB_saw=${pr8.probeB.filter((x) => x.reason.includes('reviewer-leg-RG')).length} (0 = attached lane holds ahead of later probe; ask pending, ours silent)`)

  // ── R9 install/uninstall symmetry ─────────────────────────────────────────
  const cB0 = (await fetchJson(`${origin}/__rev/hooks`)).body.count
  await fetchJson(`${origin}/__rev/uninstall-probeB`, { method: 'POST' })
  const cB1 = (await fetchJson(`${origin}/__rev/hooks`)).body.count
  const finalHooks = await hooks('final')
  const globalStill = finalHooks.rows.filter((r) => r.global === true).length
  writeEvidence('uninstall-symmetry.json', { cB0, cB1, finalHooks, note: 'probeB: ctx.on disposer = symmetric install/uninstall (public face). The reviewed resolver in a5ptc4-row.mjs DISCARDS the disposer (lines 174/180: ctx.on(...) results not retained) → the {global,prepend} listener is permanent for the process lifetime; no uninstall route exists.' })
  check('R9-UNINSTALL-ASYMMETRY-DOCUMENTED', 'R9 install/uninstall symmetry: probe shows the symmetric shape (count -1 on dispose); reviewed resolver retains NO disposer (its {global,prepend} listener still in census after all legs) — asymmetry recorded as a finding',
    cB1 === cB0 - 1 && globalStill >= 1,
    `probeB count ${cB0}->${cB1}; global listeners still present=${globalStill}; total=${finalHooks.count}`)

  // ── R10 original permissions not lowered ──────────────────────────────────
  const modeA1 = await modeOf(sidA)
  const modeB1 = await modeOf(sidB)
  const forbFinal = lsDir(FORB)
  const allowedTargets = new Set(['secret.txt', 'rev-a-target.txt', 'rev-replay-target.txt', 'rev-policy-target.txt', 'rev-x-target.txt', 'rev-qa-target.txt', 'os-preflight-ws.txt'])
  check('R10-ORIGINAL-PERMS-NOT-LOWERED', 'R10 root acceptance: per-session mode AND approval policy are constant before/after (workspace-write; policy value unchanged — host session-init value, never written by this kit); secret byte-identical; forbidden dir holds ONLY review-controlled target files (each = a recorded decision), nothing uncontrolled',
    modeA0?.mode === 'workspace-write' && modeA1?.mode === 'workspace-write' && modeB0?.mode === 'workspace-write' && modeB1?.mode === 'workspace-write'
    && String(modeA0?.approvalPolicy) === String(modeA1?.approvalPolicy) && String(modeB0?.approvalPolicy) === String(modeB1?.approvalPolicy)
    && sha256(readFileSync(SECRET)) === secretShaPre
    && forbFinal.every((f) => allowedTargets.has(f)),
    `A ${modeA0?.mode}/${modeA0?.approvalPolicy}->${modeA1?.mode}/${modeA1?.approvalPolicy} B ${modeB0?.mode}/${modeB0?.approvalPolicy}->${modeB1?.mode}/${modeB1?.approvalPolicy} secretUnchanged=${sha256(readFileSync(SECRET)) === secretShaPre} forbDir=${JSON.stringify(forbFinal)}`)

  const stableAfter = await stableProbe()
  check('P-STABLE-UNTOUCHED', `:3080 stable untouched (pre=${stableBefore} post=${stableAfter}); bound only ${HOST_PORT}`, stableBefore === stableAfter && stableBefore === 401, `pre=${stableBefore} post=${stableAfter}`)
  const pinnedHeadPost = gitAt(TESTUSE, 'rev-parse', 'HEAD')
  check('P-PRISTINE-POST', 'pinned host tree byte-clean after the run', pinnedHeadPost === TEST_USE_BASELINE_SHA && gitAt(TESTUSE, 'status', '--porcelain') === '', `head=${pinnedHeadPost.slice(0, 12)}`)

  const passCount = CRITERIA.filter((c) => c.pass).length
  const failCount = CRITERIA.length - passCount
  console.log(`\n[REVIEW] criteria: ${passCount}/${CRITERIA.length} pass, ${failCount} fail (failures = security findings against the root brief)`)
  await finalize(failCount === 0 ? 'REVIEW-ALL-REQUIRED-PASS' : 'REVIEW-FINDINGS-PRESENT')
  process.exit(failCount === 0 ? 0 : 2)
}

main().catch(async (error) => {
  console.error(String(error?.stack ?? error))
  try { writeEvidence('fatal.json', { message: String(error?.message ?? error), criteriaSoFar: CRITERIA }) } catch { /* last resort */ }
  await finalize('FATAL')
  process.exit(1)
})
