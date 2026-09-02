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
 * @param {(ctx: { seq: number, req: object }) => object} opts.decide -
 *   maps one parsed request to a reply descriptor:
 *   - { kind: 'text', content: string }
 *   - { kind: 'tool-call', toolCalls: [{ id: string, name: string, arguments: object|string }] }
 *   - { kind: 'error', status: number, message: string, code?: string, type?: string }
 * @param {function(string): void} [opts.log]
 * @returns {Promise<{ port: number, requests: object[], close: () => Promise<void> }>}
 */
export async function startMockModel({ port, decide, log = () => {} }) {
  const requests = []
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
    req.on('end', () => {
      try {
        handle(req, res, body)
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

  function handle(req, res, rawBody) {
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

    if (req.method !== 'POST' || (req.url ?? '').split('?')[0] !== '/chat/completions') {
      record.status = req.method !== 'POST' ? 405 : 404
      res.writeHead(record.status, { 'content-type': 'application/json' })
      res.end(JSON.stringify({ error: { message: `mock: ${req.method} ${req.url} not served (only POST /chat/completions)`, type: 'invalid_request_error', code: 'not-found' } }))
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
      reply = decide({ seq: record.seq, req: parsed })
    } catch (err) {
      record.status = 500
      record.error = `decide() threw: ${String((err && err.stack) ?? err)}`
      res.writeHead(500, { 'content-type': 'application/json' })
      res.end(JSON.stringify({ error: { message: `mock decide() failed: ${String((err && err.message) ?? err)}`, type: 'internal_error', code: 'decide-failed' } }))
      log(`mock: ${record.seq} decide() threw: ${String((err && err.message) ?? err)}`)
      return
    }
    record.reply = reply

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
