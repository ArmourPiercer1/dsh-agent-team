/**
 * u7-uileg0-answer-drive.test.mjs — offline lock for the UI answering-arm
 * wire shapes (u7r3-uileg0 LEG-0 Q1). Committed-wire-shape discipline of
 * `u7-tbash-offline-drive.test.mjs`: every expected shape below is quoted
 * from the pristine host @ 639ed015397 (citations in the lib module), and
 * a fixture RESPONDER replays the host's own recorded answers — no boot,
 * no network. Run: node --test tests/world-factory/u7-uileg0-answer-drive.test.mjs
 *
 * @module tests/world-factory/u7-uileg0-answer-drive.test
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import {
  AUTH_COOKIE_PREFIX,
  REMOTE_MUX_PATH,
  EVENTS_ENDPOINT,
  EVENTS_RESULT_ENDPOINT,
  parseBootUrl,
  buildTokenExchange,
  cookieFromSetCookie,
  validateAnswerBatch,
  buildAnswerRpc,
  interpretAnswerResponse,
  openEventsStreamFrame,
  isReadyFrame,
  isQuestionWaterfallFrame,
  buildWaterfallAnswerResult,
  openAttachWaitFrame,
} from './lib/u7-uileg0-answer.mjs'

// ── recorded host witnesses (file:line of the capture in the host tree) ──

/** web-app/src/index.ts:271 prints `dsh web: <url>`; TEST_METHODS §2.1. */
const BOOT_STDOUT = [
  '[plugin-tree] loaded',
  'dsh web: http://127.0.0.1:3183/?token=Zm9vYmFyLUxhdW5jaFRva2Vu-1',
  'some later log line',
].join('\n')
const BOOT_STDOUT_LAN = 'dsh web: http://127.0.0.1:3183/?token=abc (http://10.0.0.5:3183)\n'

/**
 * The success envelope the gateway answers for a claimed unary endpoint
 * (gateway.host.spec.ts:1325-1333): {type:'server-response',rpcId,result:{ok:true,value}}.
 */
const serverOk = (rpcId, value) => ({ type: 'server-response', rpcId, result: { ok: true, value } })
/** The typed-failure arm (rpc-schema.ts:21-33 result union {ok:false,error:{code,message,details}}). */
const serverErr = (rpcId, code, message = code) => ({
  type: 'server-response', rpcId, result: { ok: false, error: { code, message, details: {} } },
})

// ── 1. boot line → launch token ───────────────────────────────────────────

test('boot line parses to origin + single launch token; junk and multi-token URLs refuse', () => {
  const parsed = parseBootUrl(BOOT_STDOUT)
  assert.deepEqual(parsed, {
    url: 'http://127.0.0.1:3183/?token=Zm9vYmFyLUxhdW5jaFRva2Vu-1',
    origin: 'http://127.0.0.1:3183',
    launchToken: 'Zm9vYmFyLUxhdW5jaFRva2Vu-1',
  })
  const lan = parseBootUrl(BOOT_STDOUT_LAN)
  assert.equal(lan.origin, 'http://127.0.0.1:3183')
  assert.equal(lan.launchToken, 'abc')
  assert.equal(parseBootUrl('nothing here\n'), null)
  assert.equal(parseBootUrl('dsh web: http://127.0.0.1:3183/\n'), null) // no token = not an auth URL
})

// ── 2. token → cookie exchange (browser-auth.ts authorizeIndex) ────────────

test('token exchange rides GET /?token= and only the dsh-auth-* pair is kept', () => {
  const { origin, launchToken } = parseBootUrl(BOOT_STDOUT)
  const exchange = buildTokenExchange(origin, launchToken)
  assert.equal(exchange.method, 'GET')
  assert.equal(exchange.url, 'http://127.0.0.1:3183/?token=Zm9vYmFyLUxhdW5jaFRva2Vu-1')
  assert.equal(exchange.expect, 303)
  // Recorded 303 shape (browser-auth.ts:246-260): 303, location './', HttpOnly Strict cookie.
  const setCookie = `${AUTH_COOKIE_PREFIX}bGVnYWwtaGFzaA=v1.eyJhdXRob3JpdHkiOiIxIiwiaXNzdWVkQXQiOjEsImV4cGlyZXNBdCI6Mn0.sig; Max-Age=86400; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT; HttpOnly; SameSite=Strict`
  assert.equal(cookieFromSetCookie(setCookie), `${AUTH_COOKIE_PREFIX}bGVnYWwtaGFzaA=v1.eyJhdXRob3JpdHkiOiIxIiwiaXNzdWVkQXQiOjEsImV4cGlyZXNBdCI6Mn0.sig`)
  assert.equal(cookieFromSetCookie('other-cookie=1; Path=/'), null)
  assert.equal(cookieFromSetCookie(undefined), null)
})

// ── 3. continued-answer RPC (typert.remote-client.d.ts + answer():165-205) ─

test('answer RPC is a client-request envelope with the generated wire args {agentId,callId,answer}', () => {
  const built = buildAnswerRpc({
    rpcId: 'rpc-1',
    sessionId: 'session-u7fui-team-1',
    callId: 'tool-call-1',
    answers: [{ id: 'q1', selected: ['Proceed'] }],
  })
  assert.equal(built.refusal, undefined)
  assert.equal(built.url, '/api/userQuestions/answer')
  assert.deepEqual(built.body, {
    type: 'client-request',
    rpcId: 'rpc-1',
    method: 'userQuestions/answer',
    payload: { args: { agentId: 'session-u7fui-team-1', callId: 'tool-call-1', answer: { answers: [{ id: 'q1', selected: ['Proceed'] }] } } },
  })
})

test('BAD_ANSWER preflight (service index.ts:176-182): each question exactly once, else zero wire', () => {
  const qs = [{ id: 'q1' }, { id: 'q2' }]
  assert.equal(validateAnswerBatch(qs, [{ id: 'q1', selected: [] }, { id: 'q2', custom: 'typed' }]), null)
  assert.match(validateAnswerBatch(qs, [{ id: 'q1', selected: [] }]), /BAD_ANSWER/)
  assert.match(validateAnswerBatch(qs, [{ id: 'q1' }, { id: 'q1' }]), /unique/)
  assert.match(validateAnswerBatch(qs, [{ id: 'q1' }, { id: 'q3' }]), /exactly once/)
  assert.match(validateAnswerBatch(qs, []), /EMPTY_ANSWERS/)
  const built = buildAnswerRpc({ rpcId: 'r', sessionId: 's', callId: 'c', questions: qs, answers: [{ id: 'q1' }] })
  assert.equal(built.body, null)
  assert.match(built.refusal, /BAD_ANSWER/)
})

test('answer outcomes classify by the SERVICE law, never optimistic success', () => {
  // value true = REPLY_QUEUED semantics: accepted but admission-pending (answer():168).
  assert.deepEqual(interpretAnswerResponse(serverOk('rpc-1', true), 'rpc-1'), { kind: 'accepted' })
  // value false = not in the `continued` state (answer():166): open/unknown/closed.
  assert.deepEqual(interpretAnswerResponse(serverOk('rpc-1', false), 'rpc-1'), { kind: 'not-continued' })
  assert.deepEqual(interpretAnswerResponse(serverErr('rpc-1', 'REPLY_QUEUED'), 'rpc-1'), { kind: 'already-queued' })
  assert.deepEqual(interpretAnswerResponse(serverErr('rpc-1', 'DELEGATED_CALLER'), 'rpc-1'), { kind: 'lane-refusal', code: 'DELEGATED_CALLER' })
  assert.deepEqual(interpretAnswerResponse(serverErr('rpc-1', 'CALLER_NOT_LIVE'), 'rpc-1'), { kind: 'lane-refusal', code: 'CALLER_NOT_LIVE' })
  assert.deepEqual(interpretAnswerResponse(serverErr('rpc-1', 'BAD_ANSWER'), 'rpc-1'), { kind: 'driver-bug', code: 'BAD_ANSWER' })
  // Correlation mismatch and shape garbage are transport failures, never answers.
  assert.deepEqual(interpretAnswerResponse(serverOk('rpc-2', true), 'rpc-1'), { kind: 'transport-failure' })
  assert.deepEqual(interpretAnswerResponse(null, 'rpc-1'), { kind: 'transport-failure' })
  assert.deepEqual(interpretAnswerResponse(serverOk('rpc-1', 'yes'), 'rpc-1'), { kind: 'transport-failure' })
})

// ── 4. open-waterfall arm: $events over the mux + $events/result ──────────

test('mux open frame for $events and frame recognition (stream-protocol.ts:7-15,53-60)', () => {
  assert.equal(REMOTE_MUX_PATH, '/api/remote.mux')
  assert.deepEqual(openEventsStreamFrame('ev-1'), { type: 'open', streamId: 'ev-1', endpoint: EVENTS_ENDPOINT, payload: { args: {} } })
  assert.equal(isReadyFrame({ type: 'ready', clientId: 'client-1', host: { home: '/x' } }), true)
  assert.equal(isReadyFrame({ type: 'emit', event: 'x', args: [] }), false)
  const wf = {
    type: 'waterfall',
    event: 'user-questions/request',
    eventId: 'evt-9',
    agentId: 'agent-scope-1',
    request: { questions: [{ id: 'q1', question: 'Proceed?', options: [{ label: 'Proceed' }] }] },
  }
  assert.equal(isQuestionWaterfallFrame(wf), true)
  assert.equal(isQuestionWaterfallFrame({ ...wf, event: 'approval/request' }), false)
  assert.equal(isQuestionWaterfallFrame({ ...wf, request: { questions: 'nope' } }), false)
})

test('waterfall answer settles through POST /api/$events/result with exactly {clientId,eventId,outcome}', () => {
  const built = buildWaterfallAnswerResult({
    rpcId: 'rpc-2',
    clientId: 'client-1',
    eventId: 'evt-9',
    answers: [{ id: 'q1', selected: ['Proceed'] }],
  })
  assert.equal(built.url, `/api/${EVENTS_RESULT_ENDPOINT}`)
  assert.deepEqual(built.body, {
    type: 'client-request',
    rpcId: 'rpc-2',
    method: EVENTS_RESULT_ENDPOINT,
    payload: {
      args: {
        clientId: 'client-1',
        eventId: 'evt-9',
        outcome: { kind: 'result', value: { answers: [{ id: 'q1', selected: ['Proceed'] }] } },
      },
    },
  })
})

// ── 5. fixture RESPONDER: the shapes answer a recorded host interaction ────

test('end-to-end offline drive: boot line → 303 cookie → waterfall answer → late-answer RPC', async () => {
  // A minimal in-test stand-in for the host HTTP/WS half: it accepts ONLY
  // the pinned shapes and replays the recorded answers. It proves the
  // helpers COMPOSE; a live run of this exact sequence is the f4-pos leg.
  const seen = []
  const handle = (path, body) => {
    seen.push([path, body?.method ?? 'GET'])
    if (path === '/?token=Zm9vYmFyLUxhdW5jaFRva2Vu-1') {
      return { status: 303, headers: { location: './', 'set-cookie': `${AUTH_COOKIE_PREFIX}aGFzaA=v1.body.sig` } }
    }
    if (path === '/api/$events/result' && body?.payload?.args?.outcome?.kind === 'result') return serverOk(body.rpcId, undefined)
    if (path === '/api/userQuestions/answer') {
      const args = body?.payload?.args
      if (args?.agentId !== 'session-x' || typeof args.callId !== 'string' || !Array.isArray(args.answer?.answers)) {
        return serverErr(body.rpcId, 'BAD_ANSWER')
      }
      return serverOk(body.rpcId, args.callId === 'call-open' ? false : true)
    }
    throw new Error(`fixture host refuses unrecorded ${path}`)
  }
  const { origin, launchToken } = parseBootUrl(BOOT_STDOUT)
  const exchange = buildTokenExchange(origin, launchToken)
  const ex = handle(new URL(exchange.url).pathname + new URL(exchange.url).search, undefined)
  assert.equal(ex.status, 303)
  const cookie = cookieFromSetCookie(ex.headers['set-cookie'])
  assert.ok(cookie.startsWith(AUTH_COOKIE_PREFIX))
  // Arm A: the waterfall frame arrived on the $events stream; settle it.
  const settle = buildWaterfallAnswerResult({ rpcId: 'rpc-a', clientId: 'client-1', eventId: 'evt-9', answers: [{ id: 'q1', selected: ['Proceed'] }] })
  const a = handle(settle.url, settle.body)
  assert.equal(a.result.ok, true)
  // Arm B: a timed call expired to `continued` and is answered late.
  const late = buildAnswerRpc({ rpcId: 'rpc-b', sessionId: 'session-x', callId: 'call-late', questions: [{ id: 'q1' }], answers: [{ id: 'q1', selected: ['Proceed'] }] })
  assert.deepEqual(interpretAnswerResponse(handle(late.url, late.body), 'rpc-b'), { kind: 'accepted' })
  // An OPEN (not continued) call must read false — answering early through THIS
  // face is a driver bug; the waterfall arm owns open calls.
  const early = buildAnswerRpc({ rpcId: 'rpc-c', sessionId: 'session-x', callId: 'call-open', answers: [{ id: 'q1', selected: ['x'] }] })
  assert.deepEqual(interpretAnswerResponse(handle(early.url, early.body), 'rpc-c'), { kind: 'not-continued' })
  assert.deepEqual(seen, [
    ['/?token=Zm9vYmFyLUxhdW5jaFRva2Vu-1', 'GET'],
    ['/api/$events/result', '$events/result'],
    ['/api/userQuestions/answer', 'userQuestions/answer'],
    ['/api/userQuestions/answer', 'userQuestions/answer'],
  ])
})

test('attachWait witness frame carries the generated wire args', () => {
  assert.deepEqual(openAttachWaitFrame('w-1', 'session-x', 'call-late'), {
    type: 'open',
    streamId: 'w-1',
    endpoint: 'userQuestions/attachWait',
    payload: { args: { agentId: 'session-x', callId: 'call-late' } },
  })
})
