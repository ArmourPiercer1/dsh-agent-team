// Pure oracle controls. Replies come from the REAL makeDecideM2() state machine (root cause of the
// previous defect: hand-made 'toolCall' doubles were inconsistent with the mock contract, whose
// literal is 'tool-call' — mock-deepseek.mjs:133,:322,:360; record.reply = reply verbatim :274).
// `sent` (the SSE termination frames) is produced by the mock writer, not by decide, so it is
// attached only to text replies.
import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { evaluateM2Oracle, makeDecideM2, TC1, TC2 } from '../m2-run.mjs'

const SC = new URL('./', import.meta.url).pathname
const J1 = JSON.stringify({ ran: true, tag: 'call1', failed: [] })
const J2 = JSON.stringify({ ran: true, tag: 'call2', failed: [] })
const SENT_TERM = [{ type: 'message_delta', delta: { stop_reason: 'end_turn' } }, { type: 'message_stop' }]
const tr = (id, content, extra = {}) => ({ role: 'user', content: [{ type: 'tool_result', tool_use_id: id, content, ...extra }] })
const text = (t) => ({ role: 'user', content: [{ type: 'text', text: t }] })

const decide = makeDecideM2()
const io = []
const step = (seq, req) => {
  const reply = decide({ seq, req })
  io.push({ seq, req_kind: Array.isArray(req.messages?.[0]?.content) ? req.messages[0].content[0]?.type : 'n/a', reply })
  return { seq, status: 200, path: '/v1/messages', body: req, reply, ...(reply.kind === 'text' ? { sent: SENT_TERM } : {}) }
}
const TITLE = step(1, { stream: true, messages: [text('Summarize the session title for the user request.')] })
const CALL1 = step(2, { stream: true, messages: [text('s1m2 2026-10-24T23-20-00Z S1M2-FENCE-PROMPT')] })
const R1 = step(3, { stream: true, messages: [tr(TC1, J1)] })
const R2 = step(5, { stream: true, messages: [tr(TC2, J2)] })
const withText = (r) => ({ ...r, reply: { kind: 'text', content: 's1-m2-complete' }, sent: SENT_TERM })
const withSent = (r, sent) => ({ ...r, sent })

writeFileSync(new URL('./decide-io.evidence.txt', import.meta.url), io.map((r) => JSON.stringify(r)).join('\n') + '\n')
if (!(TITLE.reply.kind === 'text' && CALL1.reply.kind === 'tool-call' && JSON.stringify(CALL1.reply).includes(TC1)
  && R1.reply.kind === 'tool-call' && JSON.stringify(R1.reply).includes(TC2) && R2.reply.kind === 'text')) {
  console.log('BAD  the real decide state machine did not produce the expected sequence'); process.exit(1)
}

const CID1 = 'cid-aaaa'; const CID2 = 'cid-bbbb'
function baseRows({ body1 = 'B', body2 = 'A', cid1 = CID1, cid2 = CID2, bodyCid1 = null, swapLeg = true, swapCallId = CID1, restoreCallId = CID1, control = true, ran1 = true } = {}) {
  const R = []; const add = (o) => R.push({ at: 'x', ...o })
  add({ leg: 'register', body: 'A', ok: true })
  add({ leg: 'fence-enter', callId: cid1, tag: 'call1', fence_call: 1, body_visible_before: 'A' })
  if (swapLeg) add({ leg: 'fence-swapped', callId: swapCallId, tag: 'call1', from: 'A', to: 'B' })
  for (const l of ['marker-ran', 'read-ran', 'process-ran']) add({ leg: l, body: body1, callId: bodyCid1 ?? cid1, tag: 'call1', ok: true, sentinelBytes: 40, echoOut: `s1m2-echo ${body1} call1` })
  add({ leg: 'body-ran', body: body1, callId: bodyCid1 ?? cid1, tag: 'call1', ran: ran1, failed: ran1 ? [] : ['marker'] })
  add({ leg: 'fence-restored', callId: restoreCallId, tag: 'call1', to: 'A' })
  add({ leg: 'fence-enter', callId: cid2, tag: 'call2', fence_call: 2, body_visible_before: 'A' })
  if (control) add({ leg: 'fence-control', callId: cid2, tag: 'call2', body_visible_before: 'A' })
  for (const l of ['marker-ran', 'read-ran', 'process-ran']) add({ leg: l, body: body2, callId: cid2, tag: 'call2', ok: true, sentinelBytes: 40, echoOut: `s1m2-echo ${body2} call2` })
  add({ leg: 'body-ran', body: body2, callId: cid2, tag: 'call2', ran: true, failed: [] })
  return R
}
function mk(rows, markers, requests, opts = {}) {
  const dir = join(SC, `case-${Math.random().toString(36).slice(2, 8)}`)
  mkdirSync(join(dir, 'markers'), { recursive: true })
  writeFileSync(join(dir, 'ledger.jsonl'), rows.map((r) => JSON.stringify(r)).join('\n') + '\n')
  for (const m of markers) writeFileSync(join(dir, 'markers', m), 'x')
  const out = evaluateM2Oracle({ ev: { ledger: join(dir, 'ledger.jsonl'), markerDir: join(dir, 'markers') }, promptRes: { status: 200 }, sessionId: 'sess-1', noTokenStatus: 401, mock: { requests }, final: opts.final ?? true })
  rmSync(dir, { recursive: true, force: true })
  return out
}
const full = baseRows()
const PASS_M = ['B-call1.marker', 'A-call2.marker']
const OK_REQ = [TITLE, CALL1, R1, R2]
let bad = 0
const show = (name, o, want) => { const okk = o.pass === want; if (!okk) bad += 1; console.log(`${okk ? 'ok ' : 'BAD'}  [want pass=${want} got=${o.pass}]  ${name}  outcome=${o.outcome} pending=${o.pending} settled=${o.settled}  failing=${JSON.stringify(Object.entries(o.checks).filter(([, v]) => !v).map(([k]) => k))}`) }

show('POS real decide sequence (title idle, tc1, tc2, final text)', mk(full, PASS_M, OK_REQ), true)
show('NEG early binding (call1 ran A)', mk(baseRows({ body1: 'A' }), ['A-call1.marker', 'A-call2.marker'], OK_REQ), false)
show('NEG zero bodies', mk(baseRows().filter((r) => !['body-ran', 'marker-ran', 'read-ran', 'process-ran'].includes(r.leg)), [], [TITLE, CALL1]), false)
show('NEG final with no result request', mk(full, PASS_M, [TITLE, CALL1]), false)
show('NEG protocol violation: R1 answered with text (built from the real R1 object)', mk(full, PASS_M, [TITLE, CALL1, withText(R1), R2]), false)
show('NEG R2 without native termination frames', mk(full, PASS_M, [TITLE, CALL1, R1, withSent(R2, [])]), false)
show('NEG extra marker', mk(full, [...PASS_M, 'B-call2.marker'], OK_REQ), false)
show('NEG one leg failed', mk(baseRows().map((r) => (r.leg === 'read-ran' && r.callId === CID1 ? { ...r, ok: false } : r)), PASS_M, OK_REQ), false)
show('NEG swap never happened', mk(baseRows({ swapLeg: false }), PASS_M, OK_REQ), false)
show('NEG body-ran ran=false', mk(baseRows({ ran1: false }), PASS_M, OK_REQ), false)
show('NEG tool_result is_error', mk(full, PASS_M, [TITLE, CALL1, { ...R1, body: { messages: [tr(TC1, J1, { is_error: true })] } }, R2]), false)
show('NEG fake string result', mk(full, PASS_M, [TITLE, CALL1, { ...R1, body: { messages: [tr(TC1, 'ran true failed empty')] } }, R2]), false)
show('NEG wrong tool_use_id', mk(full, PASS_M, [TITLE, CALL1, { ...R1, body: { messages: [tr('other-id', J1)] } }, R2]), false)
show('NEG fence legs bound to a callId no body used', mk(baseRows({ swapCallId: 'cid-zzzz', restoreCallId: 'cid-zzzz' }), PASS_M, OK_REQ), false)
show('NEG body callId does NOT correspond to the fence callId', mk(baseRows({ bodyCid1: 'cid-different' }), PASS_M, OK_REQ), false)
show('NEG control arm missing (call2 also swapped)', mk(baseRows({ control: false }), PASS_M, OK_REQ), false)
show('NEG restore leg bound to the wrong callId', mk(baseRows({ restoreCallId: 'cid-wrong' }), PASS_M, OK_REQ), false)
show('NEG untriggered tool name in ledger', mk([...baseRows(), { leg: 'note', callId: CID2, text: 's1_m1_other' }], PASS_M, OK_REQ), false)

console.log('\n--- ordering (intermediate async states stay pending; replies are real decide outputs) ---')
const body1Only = baseRows().filter((r) => r.callId === CID1 || r.leg === 'register')
const s1 = mk(body1Only, ['B-call1.marker'], [TITLE, CALL1], { final: false })
const s2 = mk(body1Only, ['B-call1.marker'], [TITLE, CALL1, R1], { final: false })
const s3 = mk(full, PASS_M, [TITLE, CALL1, R1], { final: false })
const s4 = mk(full, PASS_M, OK_REQ, { final: false })
console.log(`${s1.pending && !s1.pass ? 'ok ' : 'BAD'}  S1 body1 only                     pending=${s1.pending} outcome=${s1.outcome}`)
console.log(`${s2.pending && !s2.pass ? 'ok ' : 'BAD'}  S2 R1 arrived (reply.kind=${R1.reply.kind}), tc2 issued  pending=${s2.pending} outcome=${s2.outcome}`)
console.log(`${s3.pending && !s3.pass ? 'ok ' : 'BAD'}  S3 body2 done, R2 in flight       pending=${s3.pending} outcome=${s3.outcome}`)
console.log(`${s4.pass && s4.settled ? 'ok ' : 'BAD'}  S4 R2 final text + termination    pass=${s4.pass} outcome=${s4.outcome}`)
if (R1.reply.kind !== 'tool-call') { console.log('BAD  R1 is not the real tool-call reply'); bad += 1 }
if (![s1, s2, s3].every((o) => o.pending === true && o.pass === false) || s4.pass !== true) bad += 1
console.log(bad === 0 ? '\nALL CONTROLS OK' : `\n${bad} CONTROLS BAD`)
process.exit(bad === 0 ? 0 : 1)
