// Pure oracle controls for the M3 candidate oracle. Requests/replies are produced by the REAL
// makeDecideM3() state machine (never hand-made doubles) and tool_result messages use the real
// wire shape ({role:'tool', toolCallId} and content[] parts with string OR text-part content),
// normalized by the ported M1 helpers. The decisive control is NEG-ABORT-MISSING: the exact POS
// evidence with the watch's change/abort legs removed and B's body+legs restored (the M2 baseline
// shape) MUST NOT pass — proving the oracle actually measures the abort, not just "things happened".
import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { evaluateM3Oracle, makeDecideM3, TC1, TC2 } from '../m3-run.mjs'

const SC = new URL('./', import.meta.url).pathname
const J2 = JSON.stringify({ ran: true, tag: 'call2', failed: [] })
const J1ABORT = 'Error: tool call aborted before dispatch'
const SENT_TERM = [{ type: 'message_delta', delta: { stop_reason: 'end_turn' } }, { type: 'message_stop' }]
const tr = (id, content, extra = {}) => ({ role: 'user', content: [{ type: 'tool_result', tool_use_id: id, content, is_error: false, ...extra }] })
const text = (t) => ({ role: 'user', content: [{ type: 'text', text: t }] })

const decide = makeDecideM3()
const io = []
const step = (seq, req) => {
  const reply = decide({ seq, req })
  io.push({ seq, reply_kind: reply?.kind, reply })
  return { seq, status: 200, path: '/v1/messages', body: req, reply, ...(reply.kind === 'text' ? { sent: SENT_TERM } : {}) }
}
const TITLE = step(1, { stream: true, messages: [text('Summarize the session title for the user request.')] })
const CALL1 = step(2, { stream: true, messages: [text('s1m3 2026-10-24T23-58-00Z S1M3-FENCE-PROMPT')] })
// r1 must carry the ABORTED result for TC1 (array content — the real wire shape), r2 the A output.
// The mock's real decide matches tool results by a `tool_result` part carrying `tool_use_id`
// (m3-run.mjs:120-121, inherited from the sealed M2 runner), which is also what the sealed M2
// mock log proves the Host actually sent. is_error: true + array text content = the abort shape.
const R1 = step(3, { stream: true, messages: [tr(TC1, [{ type: 'text', text: J1ABORT }], { is_error: true })] })
const R2 = step(5, { stream: true, messages: [tr(TC2, J2)] })
const withText = (r) => ({ ...r, reply: { kind: 'text', content: 's1-m3-complete' }, sent: SENT_TERM })
if (!(TITLE.reply.kind === 'text' && CALL1.reply.kind === 'tool-call' && JSON.stringify(CALL1.reply).includes(TC1)
  && R1.reply.kind === 'tool-call' && JSON.stringify(R1.reply).includes(TC2) && R2.reply.kind === 'text')) {
  console.log('BAD  real makeDecideM3() did not produce title → tool-call(TC1) → tool-call(TC2) → text')
  process.exit(1)
}
writeFileSync(new URL('./decide-io.evidence.txt', import.meta.url), `${io.map((r) => JSON.stringify(r)).join('\n')}\n`)

const CID1 = 'cid-1111'; const CID2 = 'cid-2222'
const FP = '0123abcdeffedcba'
function legs(prefix, body, callId, tag, ok = true) {
  return ['marker-ran', 'read-ran', 'process-ran'].map((l) => ({ leg: l, body, callId, tag, ok, sentinelBytes: 12, echoOut: `s1m3-echo ${body} ${tag}` }))
}
function guardRows(callId, { aborted = true, retained = true, delivered = 1, disposerKind = 'api-disposer', watchDisposed = 'called', restored = true } = {}) {
  const R = []
  R.push({ leg: 'guard-armed', callId, tag: 'call1', approvedFp: FP, approvedPresent: true })
  R.push({ leg: 'guard-watch-installed', callId, tag: 'call1', disposerKind, incomingAlreadyAborted: false })
  if (aborted) {
    for (let i = 1; i <= delivered; i += 1) R.push({ leg: 'guard-change-delivered', callId, tag: 'call1', delivery: i })
    R.push({ leg: 'guard-abort-fired', callId, tag: 'call1', callerReasonPreserved: false })
  }
  R.push({ leg: 'guard-signal-replaced', callId, tag: 'call1', retained })
  R.push({ leg: 'guard-exit', callId, tag: 'call1', phase: 'settled', abortedBeforeDispatch: aborted, resultCode: aborted ? 'ABORTED_BEFORE_DISPATCH' : 'none', isError: aborted })
  R.push({ leg: 'guard-finally', callId, tag: 'call1', disposerKind, watchDisposed, signalRestored: restored, changeSeen: delivered, abortFired: aborted ? 1 : 0 })
  return R
}
function baseRows(o = {}) {
  const { abort = true, body2 = 'A', cid1 = CID1, cid2 = CID2, swap = true, restore = true, control = true,
    guardOnCall2 = true, regTwice = false, enters = 2, ...g } = o
  const R = []
  R.push({ leg: 'register', body: 'A', ok: true })
  if (regTwice) R.push({ leg: 'register', body: 'A', ok: true })
  if (enters >= 1) R.push({ leg: 'fence-enter', callId: cid1, tag: 'call1', fence_call: 1, body_visible_before: 'A' })
  R.push(...guardRows(cid1, { ...g, aborted: abort }))
  if (swap) R.push({ leg: 'fence-swapped', callId: cid1, tag: 'call1', from: 'A', to: 'B' })
  if (!abort) {
    R.push(...legs('B', 'B', cid1, 'call1'), { leg: 'body-ran', body: 'B', callId: cid1, tag: 'call1', ran: true, failed: [] })
  }
  if (restore) R.push({ leg: 'fence-restored', callId: cid1, tag: 'call1', to: 'A' })
  if (enters >= 2) R.push({ leg: 'fence-enter', callId: cid2, tag: 'call2', fence_call: 2, body_visible_before: 'A' })
  if (control) R.push({ leg: 'fence-control', callId: cid2, tag: 'call2', body_visible_before: 'A' })
  if (guardOnCall2) R.push({ leg: 'guard-bypass', callId: cid2, tag: 'call2', guard_call: 2 })
  R.push(...legs('A', body2, cid2, 'call2'), { leg: 'body-ran', body: body2, callId: cid2, tag: 'call2', ran: true, failed: [] })
  return R
}
function mk(rows, markers, opts = {}) {
  const dir = join(SC, `case-${Math.random().toString(36).slice(2, 8)}`)
  mkdirSync(join(dir, 'markers'), { recursive: true })
  writeFileSync(join(dir, 'ledger.jsonl'), rows.map((r) => JSON.stringify(r)).join('\n') + '\n')
  for (const m of markers) writeFileSync(join(dir, 'markers', m), 'x')
  const mock = { requests: opts.requests ?? [TITLE, CALL1, R1, R2] }
  const out = evaluateM3Oracle({
    ev: { ledger: join(dir, 'ledger.jsonl'), markerDir: join(dir, 'markers') },
    promptRes: { status: opts.promptStatus ?? 200 }, sessionId: opts.sessionId ?? 'sess-1',
    noTokenStatus: opts.noTokenStatus ?? 401, mock, final: true,
  })
  rmSync(dir, { recursive: true, force: true })
  return out
}
const POS_MARKERS = ['A-call2.marker']
const base = () => mk(baseRows(), POS_MARKERS)

let ok = 0; let bad = 0
const expectPass = (label, out) => {
  const all = Object.values(out.checks).every(Boolean)
  const good = all && out.settled === true && out.outcome === 'delivered-change-abort'
  console.log(`${good ? 'ok  ' : 'BAD '} ${label} → settled=${String(out.settled)} outcome=${out.outcome}`)
  good ? ok += 1 : bad += 1
}
const expectFail = (label, out, mustBeFalse) => {
  const all = Object.values(out.checks).every(Boolean)
  const hit = mustBeFalse === undefined ? true : out.checks[mustBeFalse] === false
  const good = (!all || !out.settled) && hit
  console.log(`${good ? 'ok  ' : 'BAD '} ${label} → allChecksTrue=${String(all)} settled=${String(out.settled)} outcome=${out.outcome}` +
    (mustBeFalse ? ` ${mustBeFalse}=${String(out.checks[mustBeFalse])}` : ''))
  good ? ok += 1 : bad += 1
}

expectPass('POS  delivered-change-abort (B 0 legs, ABORTED_BEFORE_DISPATCH, A control runs)', base())
// ── the decisive negative control: M2 baseline shape (no abort, B actually ran) ──
expectFail('NEG-ABORT-MISSING  same evidence WITHOUT change/abort and WITH B body+legs',
  mk(baseRows({ abort: false }), [...POS_MARKERS, 'B-call1.marker']), 'call1_zero_body_invocations')
expectFail('NEG  B marker present', mk(baseRows({ abort: false }), [...POS_MARKERS, 'B-call1.marker']), 'markers_exclude_B')
expectFail('NEG  signal not retained by the host object', mk(baseRows({ retained: false }), POS_MARKERS), 'signal_replaced_and_retained')
expectFail('NEG  watch never reclaimed', mk(baseRows({ watchDisposed: 'threw:boom' }), POS_MARKERS), 'watch_reclaimed_in_finally')
expectFail('NEG  signal not restored in finally', mk(baseRows({ restored: false }), POS_MARKERS), 'signal_restored_after_call1')
expectFail('NEG  no change delivery to the watch', mk(baseRows({ delivered: 0 }), POS_MARKERS), 'change_delivered_to_watch')
expectFail('NEG  swap arm did not happen', mk(baseRows({ swap: false }), POS_MARKERS), 'swap_arm_still_observed')
expectFail('NEG  A not restored after the swap', mk(baseRows({ restore: false }), POS_MARKERS), 'a_restored_after_swap')
expectFail('NEG  control call ran body B', mk(baseRows({ body2: 'B' }), POS_MARKERS), 'call2_ran_body_A_control')
expectFail('NEG  guard also wrapped the control call', mk(baseRows({ guardOnCall2: false }), POS_MARKERS), 'guard_bypassed_on_control_call')
expectFail('NEG  A registered twice', mk(baseRows({ regTwice: true }), POS_MARKERS), 'register_a_once')
expectFail('NEG  fence entered once', mk(baseRows({ enters: 1 }), POS_MARKERS), 'fence_entered_twice')
expectFail('NEG  wrong markers on disk', mk(baseRows(), ['A-call2.marker', 'A-call1.marker']), 'markers_exactly_A_call2')
expectFail('NEG  prompt not admitted', mk(baseRows(), POS_MARKERS, { promptStatus: 500 }), 'prompt_admitted_200')
expectFail('NEG  no session', mk(baseRows(), POS_MARKERS, { sessionId: '' }), 'session_created')
expectFail('NEG  token gate not 401', mk(baseRows(), POS_MARKERS, { noTokenStatus: 200 }), 'token_gate_401')
expectFail('NEG  r2 has no terminal frame (turn unfinished ⇒ pending)',
  mk(baseRows(), POS_MARKERS, { requests: [TITLE, CALL1, R1, { ...R2, sent: [] }] }), 'result_delivered_call2_final_text')
expectFail('NEG  r1 carries a success result instead of the abort',
  mk(baseRows(), POS_MARKERS, { requests: [TITLE, CALL1, { ...R1, body: { messages: [tr(TC1, JSON.stringify({ ran: true, tag: 'call1', failed: [] }), { is_error: false })] } }, R2] }),
  'call1_result_aborted_before_dispatch')
expectFail('NEG  r2 output is not the A verdict',
  mk(baseRows(), POS_MARKERS, { requests: [TITLE, CALL1, R1, { ...R2, body: { messages: [tr(TC2, 'not json')] } }] }),
  'call2_control_real_output')
// ordering state: everything true but the turn not finished ⇒ must stay pending, never PASS
const pend = mk(baseRows(), POS_MARKERS, { requests: [TITLE, CALL1, R1, { ...R2, reply: { kind: 'tool-call', toolCalls: [{ id: 'x' }] }, sent: undefined }] })
const pendGood = pend.settled === false && pend.outcome !== 'delivered-change-abort'
console.log(`${pendGood ? 'ok  ' : 'BAD '} NEG-PENDING unfinished turn → settled=${String(pend.settled)} outcome=${pend.outcome}`)
pendGood ? ok += 1 : bad += 1

console.log(`\n  ok=${ok} bad=${bad}`)
process.exit(bad === 0 ? 0 : 1)
