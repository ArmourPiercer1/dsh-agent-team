/**
 * u7r3-uif4-answer.mjs — the LIVE answering arm for the u7r3-uif4 C2 lane.
 *
 * DISCLOSURE (read this first): the pinned wire helpers below are a VERBATIM
 * inline of the LEG-0 offline fixture that PR #489 carries at
 * `tests/world-factory/lib/u7-uileg0-answer.mjs` (branch
 * `task/u7r3-uileg0-20261030` @ ffeaf68d6e3b4c66d9c0edf7609ce1cb172bd60b).
 * #489 was NOT merged at this lane's spawn (origin/master tip
 * e2f14c71bd65e3671ed72bffe9b7092db8d1b3b8), so the lane orders require the
 * client to be INLINED HERE rather than imported or recreated in the tracked
 * tree: this lane edits no file #489 owns. When #489 lands, this vendoring
 * block should be replaced by an import of the merged module.
 *
 * On top of the pinned shapes this module adds the ONE thing LEG-0 could not
 * do offline: a real carrier. `MuxSocket` is a dependency-free RFC 6455
 * client (cookie-carrying upgrade — Node's global WebSocket cannot set a
 * header), the same shape the 0.1.7-era spike kit proved against a real host
 * (`raw WebSocket client (RFC 6455, cookie-carrying upgrade, no deps)`);
 * `createEventsAnswerer` rides it as the GUI does: open `$events`, read the
 * `ready{clientId}` frame, answer each pending `user-questions/request`
 * waterfall through POST /api/$events/result.
 *
 * Zero authority lives here: every route is one the browser itself uses, and
 * the answerer only ever settles a waterfall the Host delivered to THIS
 * stream generation (clientId+eventId).
 *
 * @module tests/world-factory/lib/u7r3-uif4-answer
 */
import { randomBytes } from 'node:crypto'
import { request as httpRequest } from 'node:http'

// ─────────────────────────────────────────────────────────────────────────────
// VENDORED FROM PR #489 `tests/world-factory/lib/u7-uileg0-answer.mjs`
// (host citations are to the pristine test-use tree @ 639ed015397290b3745d163aafe02ffee4aa3f84).
// ─────────────────────────────────────────────────────────────────────────────

/** The mux route every Remote stream rides (api/gateway/src/stream-protocol.ts:7). */
export const REMOTE_MUX_PATH = '/api/remote.mux'

/** Logical forwarded-event stream endpoint (stream-protocol.ts:10). */
export const EVENTS_ENDPOINT = '$events'

/** Unary event-result endpoint (stream-protocol.ts:13; claimed at gateway index.ts:326). */
export const EVENTS_RESULT_ENDPOINT = '$events/result'

/** Empty standard open payload for the event stream (stream-protocol.ts:16). */
export const EVENTS_OPEN_PAYLOAD = Object.freeze({ args: {} })

/** The exact forwarded question event (api/remotes/src/remote-events.ts:45, mode 'waterfall'). */
export const QUESTION_EVENT = 'user-questions/request'

/**
 * The unary answer RPC for a CONTINUED question (face B). Pinned for the
 * record even though the legacy variant never reaches the `continued` state:
 * the lane must be able to say WHY face B is not the arm it rode.
 * (rpc-schema.ts:35-40; gateway.host.spec.ts:1317-1330; the service's own law
 * is packages/interaction/user-questions/src/index.ts:164-205.)
 */
export function buildAnswerRpc({ rpcId, sessionId, callId, answers }) {
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
 * The batch law the service enforces (index.ts:176-182): one item per
 * question, unique ids, no extras. Preflight so a driver bug is never
 * mistaken for a product refusal.
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

/** Open the forwarded-event stream on the mux (gateway echo-stream test :53). */
export function openEventsStreamFrame(streamId) {
  return { type: 'open', streamId: String(streamId), endpoint: EVENTS_ENDPOINT, payload: EVENTS_OPEN_PAYLOAD }
}

/** Is this the ready frame binding later HTTP results to this generation? */
export function isReadyFrame(frame) {
  return frame !== null && typeof frame === 'object' && frame.type === 'ready'
    && typeof frame.clientId === 'string'
}

/** Is this the Agent-scoped waterfall for one pending ask? (stream-protocol.ts:53-60,149-156) */
export function isQuestionWaterfallFrame(frame) {
  return frame !== null && typeof frame === 'object' && frame.type === 'waterfall'
    && frame.event === QUESTION_EVENT
    && typeof frame.eventId === 'string' && typeof frame.agentId === 'string'
    && frame.request !== null && typeof frame.request === 'object'
    && Array.isArray(frame.request.questions)
}

/**
 * THE LIVE-CARRIER LAW THE FIRST BOOT TAUGHT (start#1 RCA, p1 run-abort):
 * the `$events` downlink is NOT a bare event frame. The mux server only ever
 * sends `{type:'item'|'end'|'error', streamId, value?}` (gateway
 * stream-protocol.ts:252-258, parseRemoteStreamServerMessage; stream-server.ts
 * :176-235 sends `{type:'item', streamId, value}` per source value), and the
 * event envelope — `{type:'ready'|'emit'|'waterfall'|'cancel', …}` — rides
 * INSIDE `value` (RemoteEventDownlinkFrame, stream-protocol.ts:33-73). The
 * pinned top-level predicates above are LEG-0's offline reading and match the
 * INNER object, not the transport frame. Unwrapping is therefore the carrier's
 * job, and both shapes are recorded so the wire cell reports the live truth.
 */
export function unwrapEventFrame(frame) {
  if (frame !== null && typeof frame === 'object'
    && (frame.type === 'item' || frame.type === 'data')
    && frame.value !== null && typeof frame.value === 'object') {
    return frame.value
  }
  return frame
}

/** The transport-level error frame, if this is one (stream-protocol.ts:255). */
export function isTransportErrorFrame(frame) {
  return frame !== null && typeof frame === 'object' && frame.type === 'error'
    && frame.error !== null && typeof frame.error === 'object'
}

/**
 * Settle one delivered waterfall with the human's answer: the client send is
 * `connection.rpc.call('/api', '$events/result', { args: result })`
 * (api/gateway/src/client/remote-events.ts:211-225) and
 * `parseRemoteEventResultPayload` admits exactly {args:{clientId,eventId,outcome}}
 * (gateway index.ts:1117-1125; stream-protocol.ts:99-115).
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
 * Classify one decoded server-response envelope for a unary RPC
 * (rpc-schema.ts:43-47,21-33). Kept for face-B classification.
 */
export function interpretAnswerResponse(message, rpcId) {
  if (message === null || typeof message !== 'object') return { kind: 'transport-failure' }
  if (message.type !== 'server-response' || message.rpcId !== rpcId) return { kind: 'transport-failure' }
  const result = message.result
  if (result === null || typeof result !== 'object') return { kind: 'transport-failure' }
  if (result.ok === true) {
    if (result.value === true) return { kind: 'accepted' }
    if (result.value === false) return { kind: 'not-continued' }
    return { kind: 'ok' }
  }
  const code = result?.error?.code ?? result?.error?.name
  if (code === 'REPLY_QUEUED') return { kind: 'already-queued' }
  if (code === 'CALLER_NOT_LIVE' || code === 'DELEGATED_CALLER') return { kind: 'lane-refusal', code }
  if (code === 'BAD_ANSWER') return { kind: 'driver-bug', code }
  return { kind: 'error', code: code ?? 'unknown' }
}

// ─────────────────────────────────────────────────────────────────────────────
// THE LIVE CARRIER — the part LEG-0 left as NOT_VERIFIED (its §NOT_VERIFIED-2).
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Minimal RFC 6455 client with a cookie-carrying upgrade. Client frames are
 * masked text frames; server frames are read unmasked, fragmentation-aware,
 * ping→pong. Enough for /api/remote.mux and nothing more.
 */
export class MuxSocket {
  /**
   * @param {string} url ws:// URL (the host's own port, no TLS on the World)
   * @param {{cookie?: string, timeoutMs?: number, onFrame?: (f: object) => void, onLog?: (s: string) => void}} [opts]
   */
  constructor(url, { cookie = null, timeoutMs = 20_000, onFrame = null, onLog = null } = {}) {
    const u = new URL(url)
    this.host = u.hostname
    this.port = u.port === '' ? 80 : Number(u.port)
    this.path = u.pathname + u.search
    this.cookie = cookie
    this.timeoutMs = timeoutMs
    this.onFrame = onFrame
    this.onLog = onLog ?? (() => {})
    this.socket = null
    this.buffer = Buffer.alloc(0)
    this.fragments = []
    this.closed = false
    this.closeError = null
    this.textFrames = 0
    this._waiters = []
    this._open = new Promise((res, rej) => { this._openRes = res; this._openRej = rej })
  }

  connect() {
    const req = httpRequest({
      host: this.host,
      port: this.port,
      path: this.path,
      method: 'GET',
      headers: {
        connection: 'Upgrade',
        upgrade: 'websocket',
        'sec-websocket-key': randomBytes(16).toString('base64'),
        'sec-websocket-version': '13',
        ...(this.cookie === null ? {} : { cookie: this.cookie }),
      },
    })
    const timer = setTimeout(() => this._fail(new Error('ws upgrade timeout')), this.timeoutMs)
    const clear = () => clearTimeout(timer)
    req.on('upgrade', (res, socket, head) => {
      clear()
      if (res.statusCode !== 101) {
        socket.destroy()
        this._fail(new Error(`ws upgrade rejected: HTTP ${String(res.statusCode)}`))
        return
      }
      this.socket = socket
      if (head !== undefined && head.length > 0) this.buffer = Buffer.from(head)
      socket.on('data', (chunk) => { this.buffer = Buffer.concat([this.buffer, chunk]); this._pump() })
      socket.on('close', () => {
        if (this.closed) return
        this.closed = true
        this.closeError = new Error('ws closed by host')
        for (const w of this._waiters) w.rej(this.closeError)
        this._waiters = []
      })
      socket.on('error', (e) => this._fail(e))
      this._openRes()
      if (this.buffer.length > 0) this._pump()
    })
    req.on('response', (res) => {
      clear()
      const status = res.statusCode
      res.resume()
      this._fail(new Error(`ws upgrade rejected: HTTP ${String(status)}`))
    })
    req.on('error', (e) => { clear(); this._fail(e) })
    req.end()
    return this._open
  }

  _fail(err) {
    if (this.closed) return
    this.closed = true
    this.closeError = err
    this._openRej?.(err)
    for (const w of this._waiters) w.rej(err)
    this._waiters = []
    try { this.socket?.destroy() } catch { /* already gone */ }
  }

  /** @param {object} frame */
  send(frame) {
    if (this.closed) throw new Error(`ws already closed: ${String(this.closeError?.message ?? '')}`)
    const payload = Buffer.from(JSON.stringify(frame), 'utf8')
    const mask = randomBytes(4)
    let header
    if (payload.length < 126) {
      header = Buffer.from([0x81, 0x80 | payload.length])
    } else if (payload.length < 65536) {
      header = Buffer.alloc(4)
      header[0] = 0x81; header[1] = 0x80 | 126; header.writeUInt16BE(payload.length, 2)
    } else {
      header = Buffer.alloc(10)
      header[0] = 0x81; header[1] = 0x80 | 127; header.writeBigUInt64BE(BigInt(payload.length), 2)
    }
    const masked = Buffer.alloc(payload.length)
    for (let i = 0; i < payload.length; i += 1) masked[i] = payload[i] ^ mask[i % 4]
    this.socket.write(Buffer.concat([header, mask, masked]))
  }

  _sendRaw(opcode, payload) {
    if (this.closed) return
    const mask = randomBytes(4)
    const header = Buffer.from([0x80 | opcode, 0x80 | payload.length, ...mask])
    const masked = Buffer.alloc(payload.length)
    for (let i = 0; i < payload.length; i += 1) masked[i] = payload[i] ^ mask[i % 4]
    try { this.socket.write(Buffer.concat([header, masked])) } catch { /* dying socket */ }
  }

  _pump() {
    for (;;) {
      if (this.buffer.length < 2) return
      const b0 = this.buffer[0]
      const b1 = this.buffer[1]
      const fin = (b0 & 0x80) !== 0
      const opcode = b0 & 0x0f
      const masked = (b1 & 0x80) !== 0
      let len = b1 & 0x7f
      let offset = 2
      if (len === 126) {
        if (this.buffer.length < offset + 2) return
        len = this.buffer.readUInt16BE(offset); offset += 2
      } else if (len === 127) {
        if (this.buffer.length < offset + 8) return
        len = Number(this.buffer.readBigUInt64BE(offset)); offset += 8
      }
      let maskKey = null
      if (masked) {
        if (this.buffer.length < offset + 4) return
        maskKey = this.buffer.subarray(offset, offset + 4); offset += 4
      }
      if (this.buffer.length < offset + len) return
      let payload = Buffer.from(this.buffer.subarray(offset, offset + len))
      if (maskKey !== null) {
        for (let i = 0; i < payload.length; i += 1) payload[i] ^= maskKey[i % 4]
      }
      this.buffer = this.buffer.subarray(offset + len)
      if (opcode === 0x8) { this._closeLocally(); continue }
      if (opcode === 0x9) { this._sendRaw(0xa, payload); continue }
      if (opcode === 0xa) continue
      if (opcode === 0x1 || opcode === 0x2 || opcode === 0x0) {
        if (opcode === 0x0) this.fragments.push(payload)
        else this.fragments = [payload]
        if (fin) {
          const full = Buffer.concat(this.fragments)
          this.fragments = []
          this._emitText(full.toString('utf8'))
        }
        continue
      }
      // unknown opcode: drop the frame, never desync the stream
    }
  }

  _emitText(text) {
    this.textFrames += 1
    let frame = null
    try { frame = JSON.parse(text) } catch { frame = { type: 'unparsed', text: text.slice(0, 400) } }
    if (this.onFrame !== null) this.onFrame(frame)
    const waiters = this._waiters
    this._waiters = []
    for (const w of waiters) w.res(frame)
  }

  /**
   * Resolve with the next text frame. WITH A DEADLINE: an idle-but-open stream
   * must never park a caller forever (start#1 stalled exactly here — the
   * `$events` stream is silent between events by design). Resolves null on
   * timeout, rejects only when the socket itself dies.
   */
  nextFrame(timeoutMs = 1000) {
    return new Promise((res, rej) => {
      if (this.closed) { rej(this.closeError ?? new Error('ws closed')); return }
      const entry = { res, rej }
      const timer = setTimeout(() => {
        const at = this._waiters.indexOf(entry)
        if (at >= 0) this._waiters.splice(at, 1)
        res(null)
      }, Math.max(50, Math.min(5000, Number(timeoutMs) || 1000)))
      entry.res = (frame) => { clearTimeout(timer); res(frame) }
      entry.rej = (err) => { clearTimeout(timer); rej(err) }
      this._waiters.push(entry)
    })
  }

  _closeLocally() {
    if (this.closed) return
    this.closed = true
    this._sendRaw(0x8, Buffer.alloc(0))
    try { this.socket?.end() } catch { /* gone */ }
    try { this.socket?.destroy() } catch { /* gone */ }
  }

  close() { this._closeLocally() }
}

/**
 * The runner-side answerer: one `$events` stream, every pinned predicate
 * applied to what the Host ACTUALLY sent, and one settlement per delivered
 * waterfall. Everything it saw is returned as witness — including the case of
 * a stream that opens cleanly and never receives a waterfall.
 *
 * @param {{port: number, cookie: string, log?: (s: string) => void,
 *          pickAnswer?: (q: object) => {id: string, selected: string[], custom?: string}}} opts
 */
export function createEventsAnswerer({ port, cookie, log = () => {}, pickAnswer = null }) {
  const facts = {
    opened: false, openError: null, readyFrame: null, clientId: null,
    frames: [], waterfallFrames: [], answered: [], refusals: [], closedAt: null, closeError: null,
    // live-shape witnesses (the start#1 RCA: the pinned predicates describe the
    // INNER envelope while the transport carries item/end/error — record both).
    transportTypes: {}, transportErrors: [], unwrappedFrames: 0, streamEnded: false,
  }
  const defaultPick = (q) => {
    const options = Array.isArray(q?.options) ? q.options : []
    const label = options.length > 0 ? options[0]?.label : undefined
    if (typeof label === 'string' && label.length > 0) return { id: String(q.id), selected: [label] }
    return { id: String(q.id), selected: [], custom: 'uif4-live-answer' }
  }
  const pick = pickAnswer ?? defaultPick
  const socket = new MuxSocket(`ws://127.0.0.1:${String(port)}${REMOTE_MUX_PATH}`, {
    cookie,
    onFrame: (raw) => {
      // Record the TRANSPORT frame (capped), then apply the pinned predicates
      // to the event envelope it carries. Both layers are witnesses: the cell
      // reports the live shape, not the hoped-for one.
      if (facts.frames.length < 40) facts.frames.push(raw)
      facts.transportTypes[raw?.type ?? 'unknown'] = (facts.transportTypes[raw?.type ?? 'unknown'] ?? 0) + 1
      if (isTransportErrorFrame(raw)) {
        facts.transportErrors.push({ streamId: raw.streamId ?? null, error: raw.error })
        log(`$events transport error frame: ${JSON.stringify(raw.error).slice(0, 160)}`)
        return
      }
      if (raw?.type === 'end') { facts.streamEnded = true; return }
      const frame = unwrapEventFrame(raw)
      if (frame !== raw) facts.unwrappedFrames += 1
      if (isReadyFrame(frame) && facts.readyFrame === null) {
        facts.readyFrame = { clientId: frame.clientId, host: frame.host ?? null, transport: raw?.type ?? null }
        facts.clientId = frame.clientId
        log(`$events ready clientId=${String(frame.clientId).slice(0, 12)}… (transport=${String(raw?.type)})`)
        return
      }
      if (isQuestionWaterfallFrame(frame)) {
        facts.waterfallFrames.push({
          event: frame.event, eventId: frame.eventId, agentId: frame.agentId,
          questions: frame.request.questions,
        })
        log(`waterfall ${frame.event} eventId=${String(frame.eventId).slice(0, 12)}… agentId=${String(frame.agentId).slice(0, 24)}`)
      }
    },
  })
  socket.onLog = log

  return {
    facts,
    async start() {
      try {
        await socket.connect()
        socket.send(openEventsStreamFrame('uif4-events'))
        facts.opened = true
        return true
      } catch (error) {
        facts.openError = String(error?.message ?? error).slice(0, 200)
        log(`$events open failed: ${facts.openError}`)
        return false
      }
    },
    /** Wait until the ready frame carrying clientId is observed. */
    async waitReady(timeoutMs) {
      const t0 = Date.now()
      while (facts.clientId === null && Date.now() - t0 < timeoutMs) {
        try {
          // nextFrame has its OWN deadline, so an idle stream can never park
          // this loop: the budget is re-checked every poll (start#1 stalled in
          // an unbounded await exactly here and the run had to be killed).
          await socket.nextFrame(Math.min(700, Math.max(50, timeoutMs - (Date.now() - t0))))
        } catch { break }
      }
      return facts.clientId !== null
    },
    /**
     * Answer every waterfall observed so far (and keep answering while called
     * from the drive loop). One settlement per eventId, idempotent.
     */
    async answerPending(fetchJson) {
      const out = []
      for (const wf of facts.waterfallFrames) {
        if (facts.answered.some((a) => a.eventId === wf.eventId)) continue
        const answers = wf.questions.map((q) => pick(q))
        const batchRefusal = validateAnswerBatch(wf.questions, answers)
        if (batchRefusal !== null) {
          facts.refusals.push({ eventId: wf.eventId, stage: 'preflight', reason: batchRefusal })
          continue
        }
        if (facts.clientId === null) {
          facts.refusals.push({ eventId: wf.eventId, stage: 'no-clientId', reason: 'the $events stream never produced a ready frame' })
          continue
        }
        const built = buildWaterfallAnswerResult({
          rpcId: `uif4-ans-${wf.eventId.slice(0, 8)}`, clientId: facts.clientId, eventId: wf.eventId, answers,
        })
        const res = await fetchJson(`http://127.0.0.1:${String(port)}${built.url}`, {
          method: 'POST',
          headers: { 'content-type': 'application/json', cookie },
          body: JSON.stringify(built.body),
        }, 20_000)
        const entry = {
          eventId: wf.eventId, agentId: wf.agentId, answers,
          httpStatus: res?.status ?? null,
          responseHead: JSON.stringify(res?.body ?? null).slice(0, 240),
          envelope: { url: built.url, method: built.body.method, argKeys: Object.keys(built.body.payload.args) },
        }
        facts.answered.push(entry)
        out.push(entry)
        log(`answered eventId=${String(wf.eventId).slice(0, 12)}… status=${String(entry.httpStatus)} body=${entry.responseHead.slice(0, 120)}`)
      }
      return out
    },
    stop() { facts.closedAt = new Date().toISOString(); socket.close() },
  }
}
