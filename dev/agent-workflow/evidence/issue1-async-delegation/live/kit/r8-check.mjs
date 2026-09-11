#!/usr/bin/env node
/**
 * r8-check.mjs — issue #1 (R8 live-host final acceptance) check.
 *
 * Drives the plan §29 acceptance + the plan §18 same-member concurrent
 * async probe against the booted R8 world (r8-boot.mjs state.json):
 *
 *   Phase 0 — row health re-verify (toolCount 11, the expected live
 *             sessions).
 *   Phase 1 — the leader drill (remote team.admitInitialWork v2, ONE
 *             model turn, the scripted mock chain):
 *               1. team_delegate inst-r8a async  (r8L-delA)
 *               2. team_delegate inst-r8b async  (r8L-delB)
 *               3. team_collect [tokA, tokB]     (r8L-col1 — IN FLIGHT)
 *               4. final text LEADER-DONE
 *             The repair is PROVEN when the chain completes with
 *               t_delB_issued < t_ma_done
 *             (the leader regained model control and issued the second
 *             tool call before member A's ~20 s work finished — plan
 *             §29 hard condition t_B_admitted < t_A_done) and when
 *               t_mb_start < t_ma_done
 *             (A/B execution intervals overlap — plan §29 "最好进一步
 *             证明" leg).
 *   Phase 2 — the terminal collect (p6t6 /tool as the leader): both
 *             works settled `succeeded`, the memberResult served
 *             verbatim from the durable settlement fact (CCR-5), and a
 *             SECOND identical collect (durable idempotent read).
 *   Phase 3 — the §18 same-member probe: TWO concurrent async
 *             team_follow_up calls on inst-r8a (fired together). The
 *             frozen conclusion is one of:
 *               A "upstream-queues-correctly" — both admitted, both
 *                 settle, the member turns are SERIALIZED (fu2's turn
 *                 starts only after fu1's turn's model response
 *                 flushed); distinct per-turn results, no interleave.
 *               B "rejected-with-typed-error" — one/both rejected with
 *                 a typed in-flight error (record the exact message).
 *               C "interleave-risk" — results swapped/associated wrong
 *                 (the plan §18 minimal constraint would be required —
 *                 this must NOT be the observed outcome).
 *   Phase 4 — assertions JSON + verdict (exit 0 only when every hard
 *             check passes and the §18 conclusion is A or B).
 *
 * Evidence: r8-check-<stamp>.json + r8-check-<stamp>.log (this dir).
 *
 * Usage env: R8_STAMP (defaults to the newest r8state-*.json).
 */
import {
  appendFileSync,
  existsSync,
  readFileSync,
  readdirSync,
  writeFileSync,
} from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const EV = dirname(fileURLToPath(import.meta.url))
let STAMP = process.env.R8_STAMP
let STATE_FILE = STAMP
  ? join(EV, `r8state-${STAMP}.json`)
  : null
if (STATE_FILE === null) {
  const files = readdirSync(EV).filter((f) => f.startsWith('r8state-') && f.endsWith('.json')).sort()
  if (files.length === 0) throw new Error('no r8state-*.json in this dir — run r8-boot.mjs boot first')
  STATE_FILE = join(EV, files[files.length - 1])
  STAMP = files[files.length - 1].slice('r8state-'.length, -'.json'.length)
}
const state = JSON.parse(readFileSync(STATE_FILE, 'utf8'))
const { origin, cookie, port, rootSessionId, mockLogPath, proxyLogPath } = state
const PROXY_PORT = state.proxyPort

const CHECK_LOG = join(EV, `r8-check-${STAMP}.log`)
const CHECK_JSON = join(EV, `r8-check-${STAMP}.json`)
const log = (line) => {
  const stamped = `[${new Date().toISOString()}] ${line}`
  appendFileSync(CHECK_LOG, stamped + '\n')
  console.log(stamped)
}
const checks = []
function check(id, desc, expect, actual, pass, detail) {
  checks.push({ id, desc, expect, actual, pass: !!pass, detail: detail ?? null })
  log(`${pass ? 'PASS' : 'FAIL'} ${id}: ${desc}${detail !== undefined && detail !== null ? ` — ${typeof detail === 'string' ? detail.slice(0, 300) : JSON.stringify(detail).slice(0, 300)}` : ''}`)
}
function die(msg) {
  log(`FAIL — ${msg}`)
  writeFileSync(CHECK_JSON, JSON.stringify({ stamp: STAMP, verdict: 'INCOMPLETE', error: msg, checks }, null, 2))
  process.exit(1)
}

// ── helpers ─────────────────────────────────────────────────────────────────
async function fetchJson(url, init, timeoutMs = 30_000) {
  try {
    const res = await fetch(url, { ...init, signal: AbortSignal.timeout(timeoutMs) })
    const text = await res.text()
    let body
    try { body = JSON.parse(text) } catch { body = text }
    return { status: res.status, body, text }
  } catch (e) {
    return { status: null, body: { readError: String(e?.message ?? e) } }
  }
}
async function remoteCall(method, params, version = 1) {
  return fetchJson(`${origin}/team-remote/${method}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie },
    body: JSON.stringify({
      type: 'client-request',
      rpcId: `r8c-${Date.now().toString(16)}${Math.floor(Math.random() * 1e6).toString(16)}`,
      method,
      payload: { version, params },
    }),
  }, 120_000)
}
async function p6t6Health() {
  return fetchJson(`http://127.0.0.1:${port}/__p6t6/health`, undefined, 10_000)
}
async function p6t6Tool(name, args, as, callId, timeoutMs = 60_000) {
  return fetchJson(`http://127.0.0.1:${port}/__p6t6/tool`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ name, args, as, callId }),
  }, timeoutMs)
}
function readLog(p) {
  if (!existsSync(p)) return ''
  return readFileSync(p, 'utf8')
}
async function waitUntil(fn, timeoutMs, label) {
  const deadline = Date.now() + timeoutMs
  for (;;) {
    const v = await fn()
    if (v) return v
    if (Date.now() >= deadline) throw new Error(`timeout waiting: ${label}`)
    await new Promise((r) => setTimeout(r, 1000))
  }
}
function iso(line) {
  const m = line.match(/^\[([^\]]+)\]/)
  return m ? Date.parse(m[1]) : null
}
// Parse the proxy log: per-identity request lines with received=/flushed= ms.
function proxyEvents(identity) {
  const out = []
  for (const line of readLog(proxyLogPath).split('\n')) {
    if (!line.includes(`identity=${identity} `) || !line.includes('proxy ')) continue
    const recv = line.match(/received=(\d+)/)
    const flushed = line.match(/flushed=(\d+)/)
    if (recv && flushed) out.push({ received: Number(recv[1]), flushed: Number(flushed[1]) })
  }
  return out.sort((a, b) => a.received - b.received)
}
function mockLineTimestamp(substr) {
  for (const line of readLog(mockLogPath).split('\n')) {
    if (line.includes(substr)) return iso(line)
  }
  return null
}
function mockLineAfter(firstSubstr, secondSubstr) {
  // The ts of the first mock-log line containing BOTH substrings after the
  // line containing firstSubstr (strictly later line).
  const lines = readLog(mockLogPath).split('\n')
  let past = false
  for (const line of lines) {
    if (past && line.includes(secondSubstr)) return iso(line)
    if (line.includes(firstSubstr)) past = true
  }
  return null
}
function extractFromResult(content) {
  if (typeof content !== 'string') return null
  try {
    const obj = JSON.parse(content)
    if (obj && typeof obj === 'object') {
      if (typeof obj.requestToken === 'string') return obj
      if (obj.effect && typeof obj.effect === 'object') return obj
    }
  } catch { /* not JSON */ }
  return null
}
// The /tool route returns {ok, value} where value is the tool result
// (object or JSON string — handle both).
function toolResultOf(res) {
  if (res.status !== 200) return null
  if (res.body?.ok === false) return { rejected: true, error: res.body?.error }
  let v = res.body?.value
  if (typeof v === 'string') {
    try { v = JSON.parse(v) } catch { return { raw: v } }
  }
  return v
}

// ── Phase 0 — row health ────────────────────────────────────────────────────
log(`check started (stamp=${STAMP} origin=${origin} root=${rootSessionId})`)
const health = await p6t6Health()
check('R0-1-health', 'row health ok with toolCount 11 (the eleven-tool catalog incl. team_collect)',
  'ok + toolCount 11',
  health.body ? `ok=${health.body?.ok} toolCount=${health.body?.toolCount}` : `HTTP ${health.status}`,
  health.status === 200 && health.body?.ok === true && health.body?.toolCount === 11,
  JSON.stringify(health.body).slice(0, 300))
const expectedLive = [rootSessionId, 'session-r8a-a', 'session-r8b-b']
check('R0-2-live-sessions', 'the expected three live sessions',
  JSON.stringify(expectedLive), JSON.stringify(health.body?.liveSessions ?? []),
  JSON.stringify(health.body?.liveSessions ?? []) === JSON.stringify(expectedLive))

// ── Phase 1 — the leader drill (the scripted chain) ─────────────────────────
const leaderWork = remoteCall('team.admitInitialWork', {
  rootSessionId,
  requestToken: 'r8-lead-1',
  prompt: 'Run the issue1 async delegation drill now.',
}, 2)
log('phase 1: team.admitInitialWork fired (v2, background)')

const leaderDoneAt = await waitUntil(
  () => (readLog(mockLogPath).includes('LEADER-DONE') ? Date.now() : null),
  90_000, 'the leader chain to reach LEADER-DONE')
log(`phase 1: mock script reached LEADER-DONE at ${new Date(leaderDoneAt).toISOString()}`)

const leaderWorkRes = await leaderWork
check('R1-1-turn-settled', 'leader drill turn settled (admitInitialWork returned ok)',
  'ok=true', JSON.stringify(leaderWorkRes.body?.result ?? leaderWorkRes.body).slice(0, 200),
  leaderWorkRes.body?.result?.ok === true, JSON.stringify(leaderWorkRes.body).slice(0, 250))

// Receipt tokens (from the full-content evidence lines).
const mockLog = readLog(mockLogPath)
const receiptALine = mockLog.split('\n').find((l) => l.includes('r8 receipt-delA=')) ?? null
const receiptBLine = mockLog.split('\n').find((l) => l.includes('r8 receipt-delB=')) ?? null
const collect1Line = mockLog.split('\n').find((l) => l.includes('r8 collect1-result=')) ?? null
const parseReceipt = (line, label) => {
  if (!line) return { content: null, token: null, ts: null, effect: null }
  const content = line.slice(line.indexOf('=') + 1)
  const obj = extractFromResult(content)
  return {
    content,
    token: obj?.requestToken ?? null,
    ts: iso(line),
    effect: obj?.effect ?? null,
    label,
  }
}
const receiptA = parseReceipt(receiptALine, 'delA')
const receiptB = parseReceipt(receiptBLine, 'delB')
check('R1-2-receipt-shapes', 'both async admission receipts: work-admitted, settled=false, workStatus=admitted, NO memberResult',
  'kind=work-admitted settled=false workStatus=admitted',
  `A=${JSON.stringify(receiptA.effect)?.slice(0, 160)} B=${JSON.stringify(receiptB.effect)?.slice(0, 160)}`,
  receiptA.effect?.kind === 'work-admitted' && receiptA.effect?.settled === false && receiptA.effect?.workStatus === 'admitted'
    && receiptA.effect?.memberResult === undefined
    && receiptB.effect?.kind === 'work-admitted' && receiptB.effect?.settled === false && receiptB.effect?.workStatus === 'admitted'
    && receiptB.effect?.memberResult === undefined,
  `tokA=${receiptA.token} tokB=${receiptB.token}`)
const tokA = receiptA.token
const tokB = receiptB.token
if (tokA === null || tokB === null) die(`could not extract the work request tokens (A=${tokA} B=${tokB})`)

// The in-flight collect (the leader's step 3 — both works still running).
const collect1Obj = extractFromResult(collect1Line ? collect1Line.slice(collect1Line.indexOf('=') + 1) : null)
const c1entries = collect1Obj?.effect?.entries ?? []
const c1a = c1entries.find((e) => e?.requestToken === tokA) ?? null
const c1b = c1entries.find((e) => e?.requestToken === tokB) ?? null
check('R1-3-collect-in-flight', 'the in-flight collect: BOTH works report status=running (resumePossible=true) — neither settled yet',
  'both entries running',
  `A=${JSON.stringify(c1a)?.slice(0, 140)} B=${JSON.stringify(c1b)?.slice(0, 140)}`,
  c1a?.status === 'running' && c1b?.status === 'running',
  `entries=${c1entries.length}`)

// ── The timing proof (the plan §29 hard condition + overlap) ────────────────
// t_delB_issued = the ts of the mock-log line where the leader's model
// issued delegate B (trigger=tool:r8L-delA → tool-call:r8L-delB). That
// request reaches the mock ONLY AFTER the delA receipt returned to the
// leader's agent loop — i.e. the leader already had model control.
const tDelAReceipt = mockLineTimestamp('trigger=tool:r8L-delA')
const tDelBReceipt = mockLineTimestamp('trigger=tool:r8L-delB')
const tCollect1 = mockLineTimestamp('trigger=tool:r8L-col1')
log(`TIMING t_delA_receipt=${tDelAReceipt} t_delB_issued(=t_delA_receipt line)≈${tDelAReceipt} t_delB_receipt=${tDelBReceipt} t_collect1=${tCollect1}`)
check('R1-6-chain-order', 'chain order: delA receipt < delB receipt < collect1 (the leader serially issued the tools inside ONE model turn)',
  'tDelAReceipt < tDelBReceipt < tCollect1',
  `${tDelAReceipt} < ${tDelBReceipt} < ${tCollect1}`,
  tDelAReceipt !== null && tDelBReceipt !== null && tCollect1 !== null && tDelAReceipt < tDelBReceipt && tDelBReceipt < tCollect1)
// The member flush timings (t_ma_done / t_mb_start) only exist in the
// proxy log once each member turn has FLUSHED (one line per request,
// logged after the R8_MEMBER_DELAY_MS delay) — at this point in the run
// NEITHER has flushed yet. R1-4/R1-5/R1-7 are therefore evaluated after
// Phase 2 (below), where the terminal collect has proven both turns
// settled (hence flushed). First run of this check evaluated them here
// and read an empty proxy log (r8-check-2026-09-11T20-45-12.log — 3
// FAILs, all t_*_null; the underlying product behavior was already
// correct — see that world's proxy log flushed= lines).

// ── Phase 2 — the terminal collect (durable memberResult, CCR-5) ────────────
const collectFinal = await waitUntil(async () => {
  const res = await p6t6Tool('team_collect', { rootSessionId, requestToken: 'r8-col-final', requestTokens: [tokA, tokB] }, rootSessionId, 'r8-col-final')
  const v = toolResultOf(res)
  const entries = v?.effect?.entries ?? []
  const done = entries.length === 2 && entries.every((e) => e?.status !== 'running')
  return done ? { res, v, entries } : null
}, 90_000, 'both works to settle (terminal collect)')
const feA = collectFinal.entries.find((e) => e?.requestToken === tokA) ?? null
const feB = collectFinal.entries.find((e) => e?.requestToken === tokB) ?? null
check('R2-1-terminal-succeeded', 'terminal collect: BOTH works status=succeeded with the durable memberResult (CCR-5)',
  'both succeeded + memberResult',
  `A=${JSON.stringify(feA)?.slice(0, 200)} B=${JSON.stringify(feB)?.slice(0, 200)}`,
  feA?.status === 'succeeded' && feB?.status === 'succeeded'
    && feA?.memberResult?.status === 'succeeded' && feB?.memberResult?.status === 'succeeded')
check('R2-2-memberresult-verbatim', 'memberResult bodies verbatim: MEMBER-A-DONE-TURN1 / MEMBER-B-DONE-TURN1, per-token requestToken',
  'bodies match the per-turn marker text',
  `A.body=${JSON.stringify(feA?.memberResult?.body)} B.body=${JSON.stringify(feB?.memberResult?.body)}`,
  feA?.memberResult?.body === 'MEMBER-A-DONE-TURN1' && feB?.memberResult?.body === 'MEMBER-B-DONE-TURN1'
    && feA?.memberResult?.requestToken === tokA && feB?.memberResult?.requestToken === tokB)
const collectFinal2 = await p6t6Tool('team_collect', { rootSessionId, requestToken: 'r8-col-final-2', requestTokens: [tokA, tokB] }, rootSessionId, 'r8-col-final-2')
const v2 = toolResultOf(collectFinal2)
const e2 = v2?.effect?.entries ?? []
check('R2-3-idempotent-durable-read', 'a SECOND collect of the same tokens serves the SAME terminal entries (durable, read-only, no re-execution)',
  'entries deep-equal',
  `second=${JSON.stringify(e2)?.slice(0, 200)}`,
  JSON.stringify(e2) === JSON.stringify(collectFinal.entries))

// ── The timing proof (the plan §29 hard condition + overlap) — after Phase 2,
// where both member turns have flushed (the terminal collect proved it) ──────
const maEv = proxyEvents('worker-a')
const mbEv = proxyEvents('worker-b')
const tMaStart = maEv[0]?.received ?? null
const tMaDone = maEv[0]?.flushed ?? null
const tMbStart = mbEv[0]?.received ?? null
const tMbDone = mbEv[0]?.flushed ?? null
log(`TIMING t_ma_start=${tMaStart} t_ma_done=${tMaDone} t_mb_start=${tMbStart} t_mb_done=${tMbDone}`)
const ts = { tDelAReceipt, tDelBReceipt, tCollect1, tMaStart, tMaDone, tMbStart, tMbDone, leaderDoneAt, tokA, tokB }
check('R1-4-hard-tB-before-Adone', 'HARD (plan §29): t_B_admitted < t_A_done — the leader issued delegate B (second tool call, model control regained) before member A finished',
  't_delB_issued < t_ma_done',
  `${tDelAReceipt} < ${tMaDone} = ${tDelAReceipt !== null && tMaDone !== null && tDelAReceipt < tMaDone}`,
  tDelAReceipt !== null && tMaDone !== null && tDelAReceipt < tMaDone)
check('R1-5-overlap', 'A/B execution intervals overlap: member B\'s work turn started before member A\'s finished',
  't_mb_start < t_ma_done',
  `${tMbStart} < ${tMaDone} = ${tMbStart !== null && tMaDone !== null && tMbStart < tMaDone}`,
  tMbStart !== null && tMaDone !== null && tMbStart < tMaDone)
check('R1-7-delB-receipt-before-Adone', 'delegate B was ADMITTED (receipt returned) while A was still in flight',
  't_delB_receipt < t_ma_done',
  `${tDelBReceipt} < ${tMaDone} = ${tDelBReceipt !== null && tMaDone !== null && tDelBReceipt < tMaDone}`,
  tDelBReceipt !== null && tMaDone !== null && tDelBReceipt < tMaDone)

// ── Phase 3 — the §18 same-member concurrent async probe ────────────────────
log('phase 3: §18 same-member probe — two CONCURRENT async team_follow_up on inst-r8a')
const maBefore = proxyEvents('worker-a').length
const fu1 = p6t6Tool('team_follow_up', {
  rootSessionId,
  requestToken: 'r8-fu1',
  targetInstanceId: 'inst-r8a',
  prompt: 'FU-1: process the first follow-up slice of the r8 workload.',
  async: true,
}, rootSessionId, 'r8-fu1', 60_000)
const fu2 = p6t6Tool('team_follow_up', {
  rootSessionId,
  requestToken: 'r8-fu2',
  targetInstanceId: 'inst-r8a',
  prompt: 'FU-2: process the second follow-up slice of the r8 workload.',
  async: true,
}, rootSessionId, 'r8-fu2', 60_000)
const [fu1Res, fu2Res] = await Promise.all([fu1, fu2])
const fu1V = toolResultOf(fu1Res)
const fu2V = toolResultOf(fu2Res)
const fu1Rejected = fu1V?.rejected === true
const fu2Rejected = fu2V?.rejected === true
log(`phase 3: fu1 ok=${fu1V && !fu1Rejected ? 'true' : `REJECTED ${JSON.stringify(fu1V?.error ?? fu1Res.body).slice(0, 200)}`} fu2 ok=${fu2V && !fu2Rejected ? 'true' : `REJECTED ${JSON.stringify(fu2V?.error ?? fu2Res.body).slice(0, 200)}`}`)

let conclusion = null
let conclusionDetail = null
if (fu1Rejected || fu2Rejected) {
  // Conclusion B — observed enforcement: record the exact typed error(s).
  conclusion = 'rejected-with-typed-error'
  conclusionDetail = {
    fu1: fu1Rejected ? fu1V.error : 'admitted',
    fu2: fu2Rejected ? fu2V.error : 'admitted',
  }
  check('R3-1-typed-rejection', '§18 probe: at least one follow-up REJECTED with a typed error (recorded verbatim)',
    'ok:false with an error message',
    JSON.stringify(conclusionDetail),
    true, JSON.stringify(conclusionDetail).slice(0, 400))
  // The admitted one (if any) must still settle correctly.
  const admitted = []
  if (!fu1Rejected) admitted.push({ token: fu1V?.requestToken ?? 'r8-fu1', body: 'MEMBER-A-DONE-TURN2', which: 'fu1' })
  if (!fu2Rejected) admitted.push({ token: fu2V?.requestToken ?? 'r8-fu2', body: 'MEMBER-A-DONE-TURN3', which: 'fu2' })
  if (admitted.length > 0) {
    const settled = await waitUntil(async () => {
      const res = await p6t6Tool('team_collect', { rootSessionId, requestToken: 'r8-col-fu', requestTokens: admitted.map((a) => a.token) }, rootSessionId, 'r8-col-fu')
      const v = toolResultOf(res)
      const entries = v?.effect?.entries ?? []
      return entries.length === admitted.length && entries.every((e) => e?.status !== 'running') ? { entries } : null
    }, 120_000, 'the admitted follow-up(s) to settle')
    check('R3-2-admitted-settles', '§18 probe: the admitted follow-up settled succeeded with its own result',
      'succeeded + memberResult',
      JSON.stringify(settled.entries).slice(0, 300),
      settled.entries.every((e) => e?.status === 'succeeded' && e?.memberResult?.status === 'succeeded'))
  }
} else {
  // Both admitted — Conclusion A (upstream queues) or C (interleave risk).
  const fu1Tok = fu1V?.requestToken ?? null
  const fu2Tok = fu2V?.requestToken ?? null
  check('R3-0-both-admitted', '§18 probe: BOTH concurrent follow-ups on the same member were ADMITTED (async receipts)',
    'both ok with work-admitted receipts',
    `fu1Tok=${fu1Tok} fu2Tok=${fu2Tok} fu1Effect=${JSON.stringify(fu1V?.effect)?.slice(0, 140)}`,
    fu1Tok !== null && fu2Tok !== null
      && fu1V?.effect?.kind === 'work-admitted' && fu1V?.effect?.settled === false
      && fu2V?.effect?.kind === 'work-admitted' && fu2V?.effect?.settled === false)
  const settled = await waitUntil(async () => {
    const res = await p6t6Tool('team_collect', { rootSessionId, requestToken: 'r8-col-fu', requestTokens: [fu1Tok, fu2Tok] }, rootSessionId, 'r8-col-fu')
    const v = toolResultOf(res)
    const entries = v?.effect?.entries ?? []
    return entries.length === 2 && entries.every((e) => e?.status !== 'running') ? { entries } : null
  }, 150_000, 'both same-member follow-ups to settle')
  const se1 = settled.entries.find((e) => e?.requestToken === fu1Tok) ?? null
  const se2 = settled.entries.find((e) => e?.requestToken === fu2Tok) ?? null
  check('R3-1-both-settle', '§18 probe: BOTH same-member follow-ups settled (status=succeeded, durable memberResult)',
    'both succeeded + memberResult',
    `fu1=${JSON.stringify(se1)?.slice(0, 160)} fu2=${JSON.stringify(se2)?.slice(0, 160)}`,
    se1?.status === 'succeeded' && se2?.status === 'succeeded'
      && se1?.memberResult?.status === 'succeeded' && se2?.memberResult?.status === 'succeeded')
  const b1 = se1?.memberResult?.body
  const b2 = se2?.memberResult?.body
  const interleave = !(b1 && b2 && b1 !== b2)
  // Serialization: the member's proxy requests — the follow-up turns are the
  // NEW worker-a lines (index maBefore and maBefore+1). fu2's turn must
  // START (model request received) only after fu1's turn's model response
  // FLUSHED — the upstream serialized the same-session turns.
  const maAfter = proxyEvents('worker-a')
  const fu1Ev = maAfter[maBefore] ?? null
  const fu2Ev = maAfter[maBefore + 1] ?? null
  const serialized = fu1Ev !== null && fu2Ev !== null && fu2Ev.received >= fu1Ev.flushed
  log(`phase 3: serialization fu1Ev=${JSON.stringify(fu1Ev)} fu2Ev=${JSON.stringify(fu2Ev)} serialized=${serialized}`)
  check('R3-2-serialized-turns', '§18 probe: the same-session turns SERIALIZED — fu2\'s turn started only after fu1\'s model response flushed',
    'fu2.received >= fu1.flushed',
    `${fu2Ev?.received} >= ${fu1Ev?.flushed} = ${serialized}`,
    serialized)
  check('R3-3-distinct-results', '§18 probe: the two follow-up results are DISTINCT per-turn markers (no result interleave / mis-association)',
    'bodies distinct + each a per-turn marker',
    `b1=${JSON.stringify(b1)} b2=${JSON.stringify(b2)}`,
    !interleave && /^MEMBER-A-DONE-TURN[23]$/.test(b1) && /^MEMBER-A-DONE-TURN[23]$/.test(b2))
  if (!interleave && serialized) {
    conclusion = 'upstream-queues-correctly'
    conclusionDetail = {
      frozen: '同一 member 可接受多个 async work，但实际 turn 串行排队。',
      evidence: 'both concurrent async follow-ups on inst-r8a admitted; both settled succeeded with distinct per-turn memberResults; fu2 turn start >= fu1 turn model-response flush (serialized).',
    }
  } else {
    conclusion = 'interleave-risk'
    conclusionDetail = { interleave, serialized, b1, b2 }
  }
}
check('R3-4-conclusion', '§18 frozen conclusion reached (A upstream-queues-correctly or B rejected-with-typed-error; C interleave-risk = FAIL)',
  'A or B',
  conclusion,
  conclusion === 'upstream-queues-correctly' || conclusion === 'rejected-with-typed-error',
  JSON.stringify(conclusionDetail).slice(0, 400))

// ── Phase 4 — verdict ───────────────────────────────────────────────────────
const allPass = checks.every((c) => c.pass)
const verdict = allPass ? 'R8-PASS' : 'R8-FAIL'
const summary = {
  stamp: STAMP,
  verdict,
  plan: {
    hard: 't_B_admitted < t_A_done (R1-4)',
    overlap: 'A/B execution intervals overlap (R1-5)',
    leaderControl: 'the leader regains model control before the first teammate finishes and issues the second tool call (R1-4/R1-6/R1-7)',
  },
  timing: ts,
  s18: { conclusion, detail: conclusionDetail },
  checks,
  evidence: {
    mockLog: mockLogPath,
    proxyLog: proxyLogPath,
    instanceLog: state.logPath,
    dumpConfig: state.dumpPath,
    catalog: join(EV, `catalog-list-${STAMP}.json`),
  },
  completedAt: new Date().toISOString(),
}
writeFileSync(CHECK_JSON, JSON.stringify(summary, null, 2))
log(`check JSON → ${CHECK_JSON}`)
log(`${verdict} — ${checks.filter((c) => c.pass).length}/${checks.length} checks passed; §18 conclusion: ${conclusion}`)
process.exit(allPass ? 0 : 1)
