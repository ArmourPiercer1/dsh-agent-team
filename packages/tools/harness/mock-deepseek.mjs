/**
 * mock-deepseek.mjs — the T12-vertical deterministic DeepSeek-compatible
 * endpoint (plain node:http, ZERO dependencies).
 *
 * Wire contract (SPEC-STRICT, mirrors the real dsh-llm-deepseek adapter):
 *   - endpoint: POST {base}/chat/completions, body
 *     { model, messages, stream: true, stream_options: { include_usage: true },
 *       tools?, temperature?, max_tokens?, stop?, thinking?, reasoning_effort? }
 *   - every SSE event is `data: <json>\n\n`; the stream MUST end with
 *     `data: [DONE]\n\n` (an EOF before the marker is a STREAM_CLOSED
 *     LlmError in the real adapter).
 *   - chunk: {"choices":[{"delta":{...},"finish_reason":null|...,"index":0}]}
 *     plus an optional trailing usage-only chunk {"choices":[],"usage":{...}}.
 *     finish_reason is non-null ONLY on the terminal choice; nothing
 *     follows the terminal chunk except the optional usage-only chunk.
 *   - text completion: 1..n content chunks -> terminal finish_reason:"stop"
 *     -> optional usage-only chunk -> [DONE].
 *   - tool-call completion: fragments sharing `index` (id + function.name on
 *     the FIRST fragment, arguments split across fragments) -> terminal
 *     finish_reason:"tool_calls" -> optional usage-only chunk -> [DONE].
 *   - non-2xx body: {"error":{"message","type","code"}}.
 *   - the request carries `authorization: Bearer <key>` and
 *     `accept: text/event-stream`; both are recorded per request.
 *
 * Reply selection is fully delegated to the injected `decide` callback so
 * the script table (scenario markers + nonces) lives in the runner. The
 * mock records EVERY request (headers + parsed body) and EVERY event it
 * sends, for the evidence capture log.
 */

import { createServer } from 'node:http'
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

/**
 * Desensitization for model-request fixtures written out of the mock.
 *
 * A captured request is the ground truth for the host's wire shape, so a kit
 * that wants a UNIT-verified decoder needs those envelopes as fixtures — but a
 * raw envelope embeds everything the model call carried: absolute workspace
 * paths (persona, tool results, `dsh_session_log`, `dsh_plugin_packages`),
 * session ids, and any credential-shaped text. The mock logs credentials in its
 * evidence and must not launder them into committed fixtures, so the rule lives
 * HERE, in the component that captures them:
 *
 *   - boot tokens / query tokens,
 *   - web session cookies (`dsh-auth-…`) and Cookie/Authorization headers,
 *   - bearer / api-key values,
 *   - absolute POSIX and Windows paths,
 *   - the host-internal payload keys (`dsh_session_log`,
 *     `dsh_plugin_packages`) — replaced by a presence marker, since they carry
 *     host paths and no message-shape information,
 *   - long strings truncated with an explicit `<TRUNCATED n>` marker so a
 *     fixture never silently hides content it dropped.
 *
 * Exported so the redaction itself is unit-testable.
 */
export const FIXTURE_REDACTIONS = [
  [/(https?:\/\/[^\s"'`]+?\?token=)[A-Za-z0-9_-]{8,}/g, '$1<REDACTED-TOKEN>'],
  [/\b(token|api_key|apikey|access_token)=["']?[A-Za-z0-9_\-.=]{8,}/gi, '$1=<REDACTED>'],
  [/dsh-auth-[A-Za-z0-9_-]{6,}(=[A-Za-z0-9._\-%=]{6,})?/g, 'dsh-auth-<REDACTED>=<REDACTED>'],
  [/\bBearer\s+[A-Za-z0-9._-]{6,}/gi, 'Bearer <REDACTED>'],
  [/\/(?:home|srv|Users|mnt|var|tmp|opt|workspace)\/[^\s"'`,)\]}\\]*/g, '<ABSOLUTE_PATH>'],
  [/(?:[A-Za-z]:\\|\\\\)[^\s"'`,)\]}]+/g, '<ABSOLUTE_PATH>'],
]

/** Keys whose VALUES are host-internal payloads (paths, session logs). */
export const FIXTURE_REDACTED_KEYS = new Set(['dsh_session_log', 'dsh_plugin_packages'])

/**
 * Deep-copy `value` with the redactions above applied.
 * @param {unknown} value
 * @param {{ maxTextLength?: number }} [opts]
 */
export function sanitizeForFixture(value, opts = {}) {
  const maxTextLength = opts.maxTextLength ?? 1200
  if (typeof value === 'string') {
    let out = value
    for (const [re, repl] of FIXTURE_REDACTIONS) out = out.replace(re, repl)
    return out.length > maxTextLength ? `${out.slice(0, maxTextLength)}<TRUNCATED ${out.length - maxTextLength} chars>` : out
  }
  if (Array.isArray(value)) return value.map((item) => sanitizeForFixture(item, { maxTextLength }))
  if (value !== null && typeof value === 'object') {
    const out = {}
    for (const [key, inner] of Object.entries(value)) {
      out[key] = FIXTURE_REDACTED_KEYS.has(key)
        ? `<REDACTED:${key} presence=${inner === undefined ? 'absent' : 'present'} chars=${(() => { try { return JSON.stringify(inner).length } catch { return -1 } })()}>`
        : sanitizeForFixture(inner, { maxTextLength })
    }
    return out
  }
  return value
}

const MAX_BODY = 16 * 1024 * 1024

/**
 * Split a string into at most two contiguous pieces (deterministic; the
 * first piece ends at the midpoint, rounded up). One piece for short text.
 * @param {string} text
 * @returns {string[]}
 */
function splitChunks(text) {
  if (text.length <= 16) return [text]
  const mid = Math.ceil(text.length / 2)
  return [text.slice(0, mid), text.slice(mid)]
}

/**
 * Split a JSON arguments string into at most three contiguous fragments
 * (deterministic thirds).
 * @param {string} argsJson
 * @returns {string[]}
 */
function splitArgs(argsJson) {
  const n = argsJson.length
  if (n === 0) return ['']
  if (n <= 24) return [argsJson]
  const a = Math.ceil(n / 3)
  const b = Math.ceil((2 * n) / 3)
  return [argsJson.slice(0, a), argsJson.slice(a, b), argsJson.slice(b)]
}

/**
 * Start the mock on 127.0.0.1:<port>.
 * @param {object} opts
 * @param {number} opts.port - the fixed port to listen on (0 = ephemeral).
 * @param {(ctx: { seq: number, req: object }) => object | Promise<object>} opts.decide -
 *   maps one parsed request to a reply descriptor (sync return, or a
 *   Promise resolving to one — an async decide keeps the model call in
 *   flight until it resolves; sync decides are unaffected):
 *   - { kind: 'text', content: string }
 *   - { kind: 'tool-call', toolCalls: [{ id: string, name: string, arguments: object|string }] }
 *   - { kind: 'error', status: number, message: string, code?: string, type?: string }
 * @param {function(string): void} [opts.log]
 * @param {{ dir: string, select?: (record: object, body: object) => string | null, limit?: number, maxTextLength?: number }} [opts.fixtures]
 *   DESENSITIZED FIXTURE CAPTURE for unit-verifiable decoders: after each
 *   request is answered, `select(record, body)` may return a fixture name (e.g.
 *   `'agent-with-result'`); returning null/undefined skips it. The written file
 *   is `sanitizeForFixture`-ed (tokens, cookies, credentials, absolute paths,
 *   host-internal payload keys removed; long strings truncated) plus the
 *   scripted reply, and the run is capped by `limit` (default 16) so a looping
 *   run cannot fill the disk. This is the ONLY sanctioned way for a kit to
 *   publish a wire envelope: the raw capture never leaves the process.
 * @returns {Promise<{ port: number, requests: object[], close: () => Promise<void> }>}
 */
export async function startMockModel({ port, decide, log = () => {}, fixtures = undefined }) {
  const requests = []
  let fixturesWritten = 0
  const writeFixture = (record, parsed, reply) => {
    if (fixtures === undefined || typeof fixtures?.dir !== 'string') return
    try {
      const limit = fixtures.limit ?? 16
      if (fixturesWritten >= limit) return
      const picked = typeof fixtures.select === 'function' ? fixtures.select(record, parsed) : `req-${String(record.seq).padStart(4, '0')}`
      if (typeof picked !== 'string' || picked.length === 0) return
      const safe = picked.replace(/[^A-Za-z0-9._-]+/g, '-')
      fixturesWritten += 1
      mkdirSync(fixtures.dir, { recursive: true })
      const path = join(fixtures.dir, `${safe}-${String(record.seq).padStart(4, '0')}.json`)
      writeFileSync(path, JSON.stringify({
        __fixture: 'desensitized model-request envelope captured by packages/tools/harness/mock-deepseek.mjs',
        capturedAt: record.receivedAt,
        seq: record.seq,
        redactions: 'tokens, session cookies, bearer/api keys, absolute paths, dsh_session_log/dsh_plugin_packages payloads; long strings truncated with an explicit marker',
        request: sanitizeForFixture(parsed, { maxTextLength: fixtures.maxTextLength ?? 1200 }),
        reply: sanitizeForFixture(reply, { maxTextLength: fixtures.maxTextLength ?? 1200 }),
      }, null, 2) + '\n')
      log(`mock: ${record.seq} fixture -> ${path}`)
    } catch (err) {
      log(`mock: ${record.seq} fixture write failed: ${String((err && err.message) ?? err)}`)
    }
  }
  const server = createServer((req, res) => {
    let body = ''
    req.on('data', (chunk) => {
      body += chunk
      if (body.length > MAX_BODY) {
        try {
          res.writeHead(413, { 'content-type': 'application/json' })
          res.end(JSON.stringify({ error: { message: 'request body too large', type: 'invalid_request_error', code: 'body-too-large' } }))
        } catch { /* client gone */ }
        req.destroy()
      }
    })
    req.on('end', async () => {
      try {
        await handle(req, res, body)
      } catch (err) {
        log(`mock: unhandled error: ${String((err && err.stack) ?? err)}`)
        if (!res.headersSent) {
          res.writeHead(500, { 'content-type': 'application/json' })
        }
        try {
          res.end(JSON.stringify({ error: { message: `mock internal error: ${String((err && err.message) ?? err)}`, type: 'internal_error', code: 'mock-internal' } }))
        } catch { /* client gone */ }
      }
    })
  })

  async function handle(req, res, rawBody) {
    const record = {
      seq: requests.length + 1,
      method: req.method,
      path: req.url,
      receivedAt: new Date().toISOString(),
      headers: {
        authorization: req.headers['authorization'] ?? null,
        accept: req.headers['accept'] ?? null,
        'content-type': req.headers['content-type'] ?? null,
      },
      body: null,
      reply: null,
      sent: [],
      status: null,
      error: null,
    }
    requests.push(record)

    const route = (req.url ?? '').split('?')[0]
    const messagesApi = route === '/v1/messages'
    const chatCompletions = route === '/chat/completions'
    if (req.method !== 'POST' || (!messagesApi && !chatCompletions)) {
      record.status = req.method !== 'POST' ? 405 : 404
      res.writeHead(record.status, { 'content-type': 'application/json' })
      res.end(JSON.stringify({ error: { message: `mock: ${req.method} ${req.url} not served (only POST /chat/completions and POST /v1/messages)`, type: 'invalid_request_error', code: 'not-found' } }))
      log(`mock: ${record.seq} ${req.method} ${req.url} -> ${record.status}`)
      return
    }

    let parsed
    try {
      parsed = rawBody === '' ? null : JSON.parse(rawBody)
    } catch (err) {
      record.status = 400
      record.error = `body is not JSON: ${String((err && err.message) ?? err)}`
      res.writeHead(400, { 'content-type': 'application/json' })
      res.end(JSON.stringify({ error: { message: record.error, type: 'invalid_request_error', code: 'invalid-json' } }))
      log(`mock: ${record.seq} -> 400 ${record.error}`)
      return
    }
    record.body = parsed

    if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
      record.status = 400
      record.error = 'body must be a JSON object'
      res.writeHead(400, { 'content-type': 'application/json' })
      res.end(JSON.stringify({ error: { message: record.error, type: 'invalid_request_error', code: 'invalid-body' } }))
      return
    }
    if (parsed.stream !== true) {
      record.status = 400
      record.error = `mock only serves stream:true (got ${JSON.stringify(parsed.stream)})`
      res.writeHead(400, { 'content-type': 'application/json' })
      res.end(JSON.stringify({ error: { message: record.error, type: 'invalid_request_error', code: 'stream-required' } }))
      return
    }

    let reply
    try {
      // decide may be sync OR async: an async decide keeps the response
      // (the client's model call) in flight until it resolves — the
      // liveness-window scenario (a deliberately long recipient turn).
      // Sync decides behave exactly as before (Promise.resolve passthrough).
      reply = await Promise.resolve(decide({ seq: record.seq, req: parsed }))
    } catch (err) {
      record.status = 500
      record.error = `decide() threw: ${String((err && err.stack) ?? err)}`
      res.writeHead(500, { 'content-type': 'application/json' })
      res.end(JSON.stringify({ error: { message: `mock decide() failed: ${String((err && err.message) ?? err)}`, type: 'internal_error', code: 'decide-failed' } }))
      log(`mock: ${record.seq} decide() threw: ${String((err && err.message) ?? err)}`)
      return
    }
    record.reply = reply
    writeFixture(record, parsed, reply)

    if (reply.kind === 'error') {
      record.status = reply.status
      res.writeHead(reply.status, { 'content-type': 'application/json' })
      res.end(JSON.stringify({ error: { message: reply.message, type: reply.type ?? 'internal_error', code: reply.code ?? 'mock-error' } }))
      log(`mock: ${record.seq} -> ${reply.status} error reply`)
      return
    }

    res.writeHead(200, {
      'content-type': 'text/event-stream',
      'cache-control': 'no-cache',
      connection: 'keep-alive',
    })
    const send = (obj) => {
      const wire = `data: ${JSON.stringify(obj)}\n\n`
      record.sent.push(obj)
      res.write(wire)
    }

    let promptTokens = 0
    let completionTokens = 0
    if (messagesApi) {
      // DeepSeek Messages API (DSH 0.1.7): Anthropic-style SSE events.
      // message_start -> content_block_start/delta/stop (per block) ->
      // message_delta(stop_reason) -> message_stop. The 0.1.7 translator
      // requires message_stop after settled blocks + a stop reason, and a
      // tool_use block's final input JSON to parse to a JSON object.
      const model = typeof parsed.model === 'string' ? parsed.model : 'mock-model'
      promptTokens = countTokens(parsed.messages)
      send({ type: 'message_start', message: { id: `msg_u8_${record.seq}`, type: 'message', role: 'assistant', model, content: [], usage: { input_tokens: promptTokens, output_tokens: 0 } } })
      if (reply.kind === 'text') {
        const content = String(reply.content ?? '')
        send({ type: 'content_block_start', index: 0, content_block: { type: 'text', text: '' } })
        for (const piece of splitChunks(content)) {
          send({ type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: piece } })
          completionTokens += piece.length
        }
        send({ type: 'content_block_stop', index: 0 })
        send({ type: 'message_delta', delta: { stop_reason: 'end_turn' }, usage: { output_tokens: completionTokens } })
        send({ type: 'message_stop' })
        record.status = 200
        log(`mock: ${record.seq} [messages] text reply (${content.length} chars): ${JSON.stringify(content.slice(0, 80))}`)
        res.end()
        return
      }
      if (reply.kind === 'tool-call') {
        const calls = Array.isArray(reply.toolCalls) ? reply.toolCalls : [reply.toolCalls]
        calls.forEach((call, i) => {
          const argsJson = typeof call.arguments === 'string' ? call.arguments : JSON.stringify(call.arguments ?? {})
          send({ type: 'content_block_start', index: i, content_block: { type: 'tool_use', id: String(call.id ?? `toolu_u8_${record.seq}_${i}`), name: String(call.name), input: {} } })
          for (const fragment of splitArgs(argsJson)) {
            send({ type: 'content_block_delta', index: i, delta: { type: 'input_json_delta', partial_json: fragment } })
          }
          completionTokens += argsJson.length + String(call.name).length
          send({ type: 'content_block_stop', index: i })
        })
        send({ type: 'message_delta', delta: { stop_reason: 'tool_use' }, usage: { output_tokens: completionTokens } })
        send({ type: 'message_stop' })
        record.status = 200
        log(`mock: ${record.seq} [messages] tool-call reply: ${calls.map((c) => c.name).join(',')}`)
        res.end()
        return
      }
      record.status = 500
      record.error = `unknown reply kind: ${JSON.stringify(reply && reply.kind)}`
      res.writeHead(500, { 'content-type': 'application/json' })
      res.end(JSON.stringify({ error: { message: record.error, type: 'internal_error', code: 'bad-reply' } }))
      return
    }

    if (reply.kind === 'text') {
      const content = String(reply.content ?? '')
      send({ choices: [{ delta: { role: 'assistant', content: '' }, index: 0 }], usage: undefined })
      for (const piece of splitChunks(content)) {
        send({ choices: [{ delta: { content: piece }, index: 0 }] })
        completionTokens += piece.length
      }
      send({ choices: [{ delta: {}, finish_reason: 'stop', index: 0 }] })
      promptTokens = countTokens(parsed.messages)
      send({ choices: [], usage: { prompt_tokens: promptTokens, completion_tokens: completionTokens, total_tokens: promptTokens + completionTokens } })
      res.write('data: [DONE]\n\n')
      record.status = 200
      log(`mock: ${record.seq} text reply (${content.length} chars): ${JSON.stringify(content.slice(0, 80))}`)
    } else if (reply.kind === 'tool-call') {
      const calls = Array.isArray(reply.toolCalls) ? reply.toolCalls : [reply.toolCalls]
      send({ choices: [{ delta: { role: 'assistant', content: null }, index: 0 }], usage: undefined })
      calls.forEach((call, i) => {
        const argsJson = typeof call.arguments === 'string' ? call.arguments : JSON.stringify(call.arguments ?? {})
        const first = { index: i, id: String(call.id ?? `call_${record.seq}_${i}`), type: 'function', function: { name: String(call.name), arguments: '' } }
        const fragments = splitArgs(argsJson)
        send({ choices: [{ delta: { tool_calls: [{ ...first, function: { name: first.function.name, arguments: fragments[0] } }] }, index: 0 }] })
        for (let k = 1; k < fragments.length; k++) {
          send({ choices: [{ delta: { tool_calls: [{ index: i, function: { arguments: fragments[k] } }] }, index: 0 }] })
        }
        completionTokens += argsJson.length + String(call.name).length
      })
      send({ choices: [{ delta: {}, finish_reason: 'tool_calls', index: 0 }] })
      promptTokens = countTokens(parsed.messages)
      send({ choices: [], usage: { prompt_tokens: promptTokens, completion_tokens: completionTokens, total_tokens: promptTokens + completionTokens } })
      res.write('data: [DONE]\n\n')
      record.status = 200
      log(`mock: ${record.seq} tool-call reply: ${calls.map((c) => c.name).join(',')}`)
    } else {
      record.status = 500
      record.error = `unknown reply kind: ${JSON.stringify(reply && reply.kind)}`
      res.writeHead(500, { 'content-type': 'application/json' })
      res.end(JSON.stringify({ error: { message: record.error, type: 'internal_error', code: 'bad-reply' } }))
      return
    }
    res.end()
  }

  await new Promise((resolveListen, rejectListen) => {
    server.once('error', rejectListen)
    server.listen(port, '127.0.0.1', () => resolveListen())
  })
  const actualPort = server.address().port
  log(`mock: listening on 127.0.0.1:${actualPort}`)
  return {
    port: actualPort,
    requests,
    close: () => new Promise((resolveClose) => server.close(() => resolveClose())),
  }
}

/** A deterministic coarse token count (whitespace-split) for usage fields. */
function countTokens(messages) {
  let n = 0
  for (const m of Array.isArray(messages) ? messages : []) {
    const c = typeof m?.content === 'string' ? m.content : JSON.stringify(m?.content ?? '')
    n += Math.max(1, Math.ceil(c.length / 4))
  }
  return n
}
