/**
 * u7-uileg0-answer.mjs — the OFFLINE answering-arm wire helpers for a
 * pending `ask_user_question` (u7r3-uileg0 LEG-0, Q1). Pure functions,
 * zero I/O, zero authority (the u7-tbash offline-drive precedent: this
 * module computes wire shapes; a live runner owns every fetch/socket).
 *
 * EVERY shape here is pinned to the pristine test-use host @ 639ed015397
 * (0.2.0-rc.2) and cited to file:line in comments; the companion
 * `u7-uileg0-answer-drive.test.mjs` locks them against drift. Host paths
 * are relative to `tests/deepseek-harness-test-use/`.
 *
 * The public answering faces this module rides (all HTTP/WS, all the GUI
 * itself uses — no private API anywhere):
 *  1. token→cookie exchange:  GET /?token=<launch>  → 303 + dsh-auth-* cookie
 *     (packages/client/connection/src/browser-auth.ts:225-260; the launch
 *     token is printed by `dsh web` at packages/bundle/web-app/src/index.ts:262-271).
 *  2. continued-question RPC: POST /api/userQuestions/answer
 *     (generated face: packages/interaction/user-questions/lib/typert.remote-client.d.ts
 *     `userQuestions/answer(agentId: SessionId, callId, answer)`; the service
 *     answers ONLY `continued` questions — packages/interaction/user-questions/src/index.ts:165-168).
 *  3. open-waterfall arm: WS /api/remote.mux, endpoint `$events`
 *     (REMOTE_STREAM_MUX_PATH + REMOTE_EVENT_STREAM_ENDPOINT,
 *     packages/api/gateway/src/stream-protocol.ts:7-15; auth = the same
 *     cookie on the upgrade, gateway echo-stream test :46-48), settle with
 *     POST /api/$events/result payload {args:{clientId,eventId,outcome}}
 *     (packages/api/gateway/src/client/remote-events.ts:211-225).
 *
 * @module tests/world-factory/lib/u7-uileg0-answer
 */

/** Cookie prefix the host mints for a token exchange (browser-auth.ts:12). */
export const AUTH_COOKIE_PREFIX = 'dsh-auth-'

/** The mux route every Remote stream rides (stream-protocol.ts:7). */
export const REMOTE_MUX_PATH = '/api/remote.mux'

/** Logical forwarded-event stream endpoint (stream-protocol.ts:10). */
export const EVENTS_ENDPOINT = '$events'

/** Unary event-result endpoint (stream-protocol.ts:13; claimed at gateway index.ts:326). */
export const EVENTS_RESULT_ENDPOINT = '$events/result'

/** Empty standard open payload for the event stream (stream-protocol.ts:16). */
export const EVENTS_OPEN_PAYLOAD = Object.freeze({ args: {} })

/** The exact forwarded question event (packages/api/remotes/src/remote-events.ts:45). */
export const QUESTION_EVENT = 'user-questions/request'

/**
 * Extract the authenticated boot URL + launch token from host stdout.
 * The web app prints `dsh web: <url with ?token=…>` (optionally suffixed
 * with ` (LAN: …)`) when it is ready (web-app/src/index.ts:271; the same
 * line is TEST_METHODS §2.1's readiness witness). Only the FIRST such line
 * is consumed; LAN duplicates are ignored.
 * @param {string} stdoutText
 * @returns {{url: string, origin: string, launchToken: string} | null}
 */
export function parseBootUrl(stdoutText) {
  const lines = String(stdoutText).split('\n')
  for (const line of lines) {
    const m = /dsh web: (https?:\/\/\S+?)(?: \(([^\s]*)\))?\s*$/.exec(line)
    if (m === null) continue
    let url
    try { url = new URL(m[1]) } catch { continue }
    const tokens = url.searchParams.getAll('token')
    if (tokens.length !== 1) continue
    url.searchParams.delete('token')
    return { url: m[1], origin: url.origin, launchToken: tokens[0] }
  }
  return null
}

/**
 * The token exchange request: a GET on the root path carrying exactly one
 * `token` query param; a match answers 303 + Set-Cookie and redirects to
 * `./` (browser-auth.ts authorizeIndex:238-260). Every other request shape
 * is the same minimal 401 — the driver must never guess a second route.
 * @param {string} origin
 * @param {string} launchToken
 */
export function buildTokenExchange(origin, launchToken) {
  return { method: 'GET', url: `${origin}/?token=${encodeURIComponent(launchToken)}`, expect: 303 }
}

/**
 * Pull the `name=value` pair out of one Set-Cookie header when (and only
 * when) it is the browser-session cookie. HttpOnly/SameSite=Strict
 * (browser-auth.ts:103) mean only the exchange above can ever mint it.
 * @param {string} setCookieHeader
 * @returns {string|null} e.g. `dsh-auth-<b64url>: v1.<payload>.<sig>` pair only
 */
export function cookieFromSetCookie(setCookieHeader) {
  const pair = String(setCookieHeader ?? '').split(';', 1)[0].trim()
  const eq = pair.indexOf('=')
  if (eq === -1) return null
  if (!pair.slice(0, eq).trim().startsWith(AUTH_COOKIE_PREFIX)) return null
  return pair
}

/**
 * Preflight the host's BAD_ANSWER law BEFORE the wire: the batch must name
 * each question of the call EXACTLY ONCE (service index.ts:176-182).
 * @param {readonly {id: string}[]} questions the pending call's questions
 * @param {readonly {id: string, selected?: readonly string[], custom?: string}[]} answers
 * @returns {string|null} a typed refusal reason, or null when legal
 */
export function validateAnswerBatch(questions, answers) {
  if (!Array.isArray(answers) || answers.length === 0) return 'EMPTY_ANSWERS: one item per question is required'
  const ids = answers.map((a) => a && a.id)
  if (ids.some((id) => typeof id !== 'string' || id.length === 0)) return 'BAD_ANSWER: every item must name a question id'
  if (new Set(ids).size !== ids.length) return 'BAD_ANSWER: question ids must be unique in one batch'
  const wanted = new Set((questions ?? []).map((q) => q.id))
  if (wanted.size !== answers.length || [...ids].some((id) => !wanted.has(id))) {
    return `BAD_ANSWER: the batch must name each of the call's ${String(wanted.size)} questions exactly once`
  }
  return null
}

/**
 * The unary answer RPC for a CONTINUED question. Envelope shape is the
 * Connection client-request contract (packages/client/connection/src/
 * rpc-schema.ts:35-40 `type/rpcId/method/payload`; a live witness:
 * packages/api/gateway/tests/gateway.host.spec.ts:1317-1330). The wire
 * argument names come from the generated face (`agentId`, `callId`,
 * `answer` — typert.remote-client.d.ts).
 * @param {{rpcId: string, sessionId: string, callId: string,
 *          questions?: readonly object[], answers: object[]}} input
 * @returns {{url: string, body: object, refusal?: string}}
 */
export function buildAnswerRpc({ rpcId, sessionId, callId, questions, answers }) {
  if (questions !== undefined) {
    const refusal = validateAnswerBatch(questions, answers)
    if (refusal !== null) return { url: `/api/userQuestions/answer`, body: null, refusal }
  }
  return {
    url: '/api/userQuestions/answer',
    body: {
      type: 'client-request',
      rpcId: String(rpcId),
      method: 'userQuestions/answer',
      payload: { args: { agentId: sessionId, callId, answer: { answers } } },
    },
  }
}

/**
 * Classify one decoded server-response envelope for `userQuestions/answer`
 * (success {type:'server-response',rpcId,result:{ok:true,value}} and the
 * {ok:false,error:{code,…}} arm: rpc-schema.ts:43-47,21-33). Meanings are
 * the SERVICE's own law (interaction/user-questions/src/index.ts):
 *  - accepted        → value true: a reply is QUEUED until the agent admits
 *                      its user message (answer():168-205 — still pending!)
 *  - not-continued   → value false: the call is not in the `continued`
 *                      projection state (open, unknown, or already closed)
 *                      (answer():166)
 *  - already-queued  → REPLY_QUEUED: one reply per question (answer():170-174)
 *  - lane-refusal    → CALLER_NOT_LIVE / DELEGATED_CALLER: the agentId did
 *                      not name the exact LIVE ROOT agent (assertLiveRoot:130-141)
 *  - driver-bug      → BAD_ANSWER (service re-checks preflight:176-182)
 * @param {object} message decoded server-response
 * @param {string} rpcId the id the driver sent (correlation is the driver's)
 */
export function interpretAnswerResponse(message, rpcId) {
  if (message === null || typeof message !== 'object') return { kind: 'transport-failure' }
  if (message.type !== 'server-response' || message.rpcId !== rpcId) return { kind: 'transport-failure' }
  const result = message.result
  if (result === null || typeof result !== 'object') return { kind: 'transport-failure' }
  if (result.ok === true) {
    if (result.value === true) return { kind: 'accepted' }
    if (result.value === false) return { kind: 'not-continued' }
    return { kind: 'transport-failure' }
  }
  const code = result?.error?.code ?? result?.error?.name
  if (code === 'REPLY_QUEUED') return { kind: 'already-queued' }
  if (code === 'CALLER_NOT_LIVE' || code === 'DELEGATED_CALLER') return { kind: 'lane-refusal', code }
  if (code === 'BAD_ANSWER') return { kind: 'driver-bug', code }
  return { kind: 'error', code: code ?? 'unknown' }
}

/**
 * Open the forwarded-event stream on the mux (WS carrier): the frame the
 * client sends is the same `{type:'open', streamId, endpoint, payload}`
 * the mux test uses for a declared stream (gateway echo-stream test :53;
 * `$events` open payload is REMOTE_EVENT_STREAM_PAYLOAD). Auth rides the
 * upgrade request's cookie header (echo-stream test :45-48).
 */
export function openEventsStreamFrame(streamId) {
  return { type: 'open', streamId: String(streamId), endpoint: EVENTS_ENDPOINT, payload: EVENTS_OPEN_PAYLOAD }
}

/**
 * Dated 2026-10-30 live correction (coordinator, from lane u7r3-uif4 start p2
 * live witness; original text of the two predicates below kept unchanged):
 * the live 0.2.0-rc.2 mux DOWNLINK wraps every envelope in a transport frame
 * `{item|end|error, streamId, value?}` — the envelope rides inside `value`
 * (gateway stream-protocol.ts:33-73,252-258; stream-server.ts:176-235; live:
 * uif4 p2 answer-wire, 75 item frames, answer verbatim in tool_result).
 * Matching top-level `frame.type` on the wire silently hangs a client — the
 * exact defect that aborted uif4 start p1 (RCA-start1-abort.md). unwrapMuxFrame
 * accepts BOTH layers: envelopes passed directly (host-internal/gateway side)
 * and item-wrapped downlink frames (browser/WS side).
 */
export function unwrapMuxFrame(frame) {
  if (frame !== null && typeof frame === 'object' && 'item' in frame
    && frame.value !== null && typeof frame.value === 'object') return frame.value
  return frame
}

/**
 * Is this downlink frame the ready frame binding later HTTP results to
 * this stream generation? Carries the opaque clientId (stream-protocol.ts:34-41).
 */
export function isReadyFrame(frame) {
  const env = unwrapMuxFrame(frame)
  return env !== null && typeof env === 'object' && env.type === 'ready'
    && typeof env.clientId === 'string'
}

/**
 * Is this downlink frame the Agent-scoped waterfall for one pending ask?
 * Shape: {type:'waterfall', event, eventId, agentId, request} where the
 * request carries {questions, agent?} (stream-protocol.ts:53-60;
 * projectRemoteEventRequest:149-156; the event name is allowlisted as a
 * waterfall forward at api/remotes/src/remote-events.ts:45).
 */
export function isQuestionWaterfallFrame(frame) {
  const env = unwrapMuxFrame(frame)
  return env !== null && typeof env === 'object' && env.type === 'waterfall'
    && env.event === QUESTION_EVENT
    && typeof env.eventId === 'string' && typeof env.agentId === 'string'
    && env.request !== null && typeof env.request === 'object'
    && Array.isArray(env.request.questions)
}

/**
 * Settle one delivered waterfall with the human's answer: the client-side
 * send is `connection.rpc.call('/api', '$events/result', { args: result })`
 * (client/remote-events.ts:219-224), so over HTTP this is a client-request
 * to /api/$events/result whose payload.args is EXACTLY
 * {clientId,eventId,outcome} — parseRemoteEventResult admits no other key
 * (stream-protocol.ts:99-115). Answering = outcome.kind 'result' carrying
 * the AskUserQuestionAnswer (types.ts:69-72); delegating is kind 'next'.
 * @param {{rpcId: string, clientId: string, eventId: string, answers: object[]}} input
 */
export function buildWaterfallAnswerResult({ rpcId, clientId, eventId, answers }) {
  return {
    url: `/api/${EVENTS_RESULT_ENDPOINT}`,
    body: {
      type: 'client-request',
      rpcId: String(rpcId),
      method: EVENTS_RESULT_ENDPOINT,
      payload: { args: { clientId, eventId, outcome: { kind: 'result', value: { answers } } } },
    },
  }
}

/**
 * The timed foreground countdown face (optional witness arm): a second mux
 * stream on `userQuestions/attachWait(agentId, callId)` yielding
 * {remainingMs} frames until the wait ends (typert.remote-client.d.ts;
 * service attachWait:215-223). Closing the stream releases the claim — the
 * driver opens it ONLY while it intends to answer.
 */
export function openAttachWaitFrame(streamId, sessionId, callId) {
  return {
    type: 'open',
    streamId: String(streamId),
    endpoint: 'userQuestions/attachWait',
    payload: { args: { agentId: sessionId, callId } },
  }
}
