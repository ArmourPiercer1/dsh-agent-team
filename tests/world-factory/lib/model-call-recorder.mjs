/**
 * tests/world-factory/lib/model-call-recorder.mjs — an IN-PROCESS recording
 * pass-through at the provider boundary.
 *
 * WHY IT EXISTS. The real-model acceptance driver needs to observe what the
 * model actually emitted (assistant text, tool_use blocks with their input) and
 * what was returned to it (tool results), because in `--model real` there is no
 * mock request array to read. Round 119 proved the route through a diagnostic
 * pass-through recorder (`dev/agent-workflow/evidence/d-boot-feasibility/
 * real-model/diagnostic/d4-rec-proxy.mjs`): two real requests, HTTP 200, 43
 * tools on the second. This module GENERALISES that proven recorder into the
 * driver as a library — same seam (the host's public `DEEPSEEK_BASE_URL`), no
 * second mechanism, no upstream patch (CORE PATCH BUDGET = 0).
 *
 * WHAT IT RECORDS (per model call): the request's model id, tool surface and
 * message roles; the assistant reply's text, reasoning and tool_use blocks
 * (`id`, `name`, BUILT `input`); every `tool_result` the NEXT request carries
 * (the results returned to the model). It NEVER records a header, so the
 * `x-api-key` / `authorization` header is not written anywhere.
 *
 * TRANSPORT. It listens on 127.0.0.1 on an OS-assigned port (not a test-host
 * port band: this is a loopback helper, not a Host) and forwards each request
 * to the configured upstream ORIGIN, keeping the incoming path verbatim. The
 * host is pointed at `http://127.0.0.1:<port><upstream pathname>`, exactly the
 * override round 119 used. `accept-encoding: identity` is forced so the reply
 * body can be parsed (round 119's diagnostic lost the reply text because the
 * forwarded request kept the host's `gzip` accept-encoding).
 *
 * @module tests/world-factory/lib/model-call-recorder
 */
import { appendFileSync, mkdirSync } from 'node:fs'
import { request as httpRequest } from 'node:http'
import { createServer } from 'node:http'
import { request as httpsRequest } from 'node:https'
import { dirname } from 'node:path'

/** A reply body larger than this is truncated for parsing (never for forwarding). */
const MAX_REPLY_BYTES = 8 * 1024 * 1024
const TEXT_LIMIT = 4000
const SYSTEM_LIMIT = 4000

const truncate = (value, limit = TEXT_LIMIT) => {
  const text = String(value ?? '')
  return text.length > limit ? `${text.slice(0, limit)}<TRUNCATED ${text.length - limit} chars>` : text
}

/** Anthropic content-block text, or an OpenAI string, or JSON. */
export function contentText(content) {
  if (typeof content === 'string') return content
  if (Array.isArray(content)) return content.map((block) => (typeof block === 'string' ? block : String(block?.text ?? ''))).join('')
  if (content === null || content === undefined) return ''
  return JSON.stringify(content)
}

function safeJson(text) {
  try { return JSON.parse(text) } catch { return null }
}

/** Split an SSE body into its JSON payloads (ignores `event:` lines and comments). */
function ssePayloads(text) {
  const out = []
  for (const line of String(text).split('\n')) {
    const trimmed = line.trim()
    if (!trimmed.startsWith('data:')) continue
    const payload = trimmed.slice(5).trim()
    if (payload === '' || payload === '[DONE]') continue
    const parsed = safeJson(payload)
    if (parsed !== null) out.push(parsed)
  }
  return out
}

/**
 * Parse an Anthropic Messages reply (SSE or plain JSON) into
 * `{ text, thinking, toolUses: [{id, name, input}], stopReason, usage, eventTypes }`.
 *
 * Tool input arrives in two shapes and BOTH are handled: `content_block_start`
 * may already carry the full `input` (plain JSON responses, some gateways), or
 * it arrives empty and is streamed as `input_json_delta.partial_json` fragments.
 */
export function parseAnthropicReply(bodyText, contentType = '') {
  const out = { text: '', thinking: '', toolUses: [], stopReason: null, usage: null, eventTypes: [], mode: null }
  const plain = !String(contentType).includes('text/event-stream') && safeJson(bodyText) !== null
  if (plain) {
    const body = safeJson(bodyText)
    out.mode = 'json'
    for (const block of Array.isArray(body?.content) ? body.content : []) {
      if (block?.type === 'text') out.text += String(block.text ?? '')
      if (block?.type === 'thinking') out.thinking += String(block.thinking ?? '')
      if (block?.type === 'tool_use') out.toolUses.push({ id: block.id ?? null, name: block.name ?? null, input: block.input ?? null })
    }
    out.stopReason = body?.stop_reason ?? null
    out.usage = body?.usage ?? null
    return out
  }
  out.mode = 'sse'
  const open = new Map()
  let nextIndex = 0
  for (const event of ssePayloads(bodyText)) {
    const type = String(event?.type ?? '')
    if (type !== '') out.eventTypes.push(type)
    if (type === 'message_start') {
      out.usage = event?.message?.usage ?? out.usage
    }
    if (type === 'content_block_start') {
      const block = event?.content_block ?? {}
      const index = Number.isInteger(event?.index) ? event.index : nextIndex
      nextIndex = Math.max(nextIndex, index + 1)
      if (block?.type === 'tool_use') {
        open.set(index, { id: block.id ?? null, name: block.name ?? null, json: '', input: block.input ?? null })
      } else if (block?.type === 'text' && typeof block.text === 'string') {
        out.text += block.text
      } else if (block?.type === 'thinking' && typeof block.thinking === 'string') {
        out.thinking += block.thinking
      }
    }
    if (type === 'content_block_delta') {
      const delta = event?.delta ?? {}
      if (delta?.type === 'text_delta') out.text += String(delta.text ?? '')
      if (delta?.type === 'thinking_delta') out.thinking += String(delta.thinking ?? '')
      if (delta?.type === 'input_json_delta') {
        const index = Number.isInteger(event?.index) ? event.index : 0
        const slot = open.get(index)
        if (slot !== undefined) slot.json += String(delta.partial_json ?? '')
      }
    }
    if (type === 'content_block_stop') {
      const index = Number.isInteger(event?.index) ? event.index : 0
      const slot = open.get(index)
      if (slot !== undefined) {
        let input = slot.input
        if (slot.json !== '') {
          const parsed = safeJson(slot.json)
          if (parsed !== null) input = parsed
        }
        out.toolUses.push({ id: slot.id, name: slot.name, input })
        open.delete(index)
      }
    }
    if (type === 'message_delta') {
      out.stopReason = event?.delta?.stop_reason ?? out.stopReason
      out.usage = event?.usage ?? out.usage
    }
  }
  return out
}

/** One request message, summarised rather than stored whole (the shape is what evidence needs). */
function summarizeMessage(message, index) {
  const content = message?.content
  const blocks = Array.isArray(content) ? content : []
  const toolResults = blocks
    .filter((block) => block?.type === 'tool_result')
    .map((block) => ({
      toolUseId: block?.tool_use_id ?? null,
      isError: block?.is_error === true,
      text: truncate(contentText(block?.content)),
    }))
  // OpenAI-shaped tool results (the mock's format) as well as Anthropic's.
  if (String(message?.role ?? '') === 'tool' && message?.tool_call_id !== undefined) {
    toolResults.push({ toolUseId: message.tool_call_id, isError: false, text: truncate(contentText(content)) })
  }
  const toolUses = blocks
    .filter((block) => block?.type === 'tool_use')
    .map((block) => ({ id: block?.id ?? null, name: block?.name ?? null, inputText: truncate(JSON.stringify(block?.input ?? null)) }))
  for (const call of Array.isArray(message?.tool_calls) ? message.tool_calls : []) {
    toolUses.push({ id: call?.id ?? null, name: call?.function?.name ?? null, inputText: truncate(String(call?.function?.arguments ?? '')) })
  }
  return {
    index,
    role: message?.role ?? null,
    text: truncate(contentText(content)),
    toolResults,
    toolUses,
  }
}

/** The request-body facts a judge may read: model, tools, roles, per-message shape. */
function summarizeRequest(body) {
  const messages = Array.isArray(body?.messages) ? body.messages : []
  const system = typeof body?.system === 'string'
    ? body.system
    : Array.isArray(body?.system) ? body.system.map((block) => contentText(block)).join('\n') : ''
  return {
    model: body?.model ?? null,
    stream: body?.stream ?? null,
    toolNames: Array.isArray(body?.tools) ? body.tools.map((tool) => String(tool?.name ?? tool?.function?.name ?? '')) : [],
    messageRoles: messages.map((message) => String(message?.role ?? '')),
    systemHead: truncate(system, SYSTEM_LIMIT),
    messages: messages.map(summarizeMessage),
  }
}

/**
 * Start the recording pass-through.
 *
 * @param {{upstream?: string, sinkPath?: string|null, log?: (line: string) => void}} [opts]
 * @returns {Promise<{baseUrl: string, port: number, upstream: string,
 *   records: () => object[], toolNames: () => string[], stop: () => Promise<void>,
 *   snapshot: () => object}>}
 */
export async function startModelCallRecorder({ upstream = 'https://api.deepseek.com/anthropic', sinkPath = null, log = () => {} } = {}) {
  const upstreamUrl = new URL(upstream)
  const records = []
  let seq = 0
  let inFlight = 0

  const persist = (record) => {
    if (sinkPath === null) return
    try {
      mkdirSync(dirname(sinkPath), { recursive: true })
      appendFileSync(sinkPath, `${JSON.stringify(record)}\n`)
    } catch (error) {
      log(`recorder persist note: ${String(error?.message ?? error)}`)
    }
  }

  const server = createServer((req, res) => {
    const chunks = []
    req.on('data', (chunk) => chunks.push(chunk))
    req.on('end', () => {
      const bodyBuffer = Buffer.concat(chunks)
      const body = safeJson(bodyBuffer.toString('utf8'))
      const summary = summarizeRequest(body)
      seq += 1
      const record = {
        seq,
        at: new Date().toISOString(),
        method: req.method ?? null,
        path: req.url ?? null,
        model: summary.model,
        stream: summary.stream,
        toolNames: summary.toolNames,
        toolCount: summary.toolNames.length,
        messageRoles: summary.messageRoles,
        systemHead: summary.systemHead,
        messages: summary.messages,
        status: null,
        reply: { text: '', thinking: '', toolUses: [], stopReason: null, usage: null },
        error: null,
        elapsedMs: null,
      }
      records.push(record)
      const started = Date.now()
      // FORWARD THE INCOMING PATH VERBATIM to the upstream ORIGIN. `new URL(req.url, upstream)`
      // would REPLACE the path and drop the base prefix (round 119's attempt-2 404).
      const targetPath = req.url ?? '/'
      const headers = { ...req.headers, host: upstreamUrl.host, 'accept-encoding': 'identity' }
      delete headers.connection
      delete headers['keep-alive']
      const requestFn = upstreamUrl.protocol === 'https:' ? httpsRequest : httpRequest
      inFlight += 1
      const upstreamReq = requestFn({
        protocol: upstreamUrl.protocol,
        hostname: upstreamUrl.hostname,
        port: upstreamUrl.port === '' ? (upstreamUrl.protocol === 'https:' ? 443 : 80) : Number(upstreamUrl.port),
        path: targetPath,
        method: req.method,
        headers,
      }, (upstreamRes) => {
        record.status = upstreamRes.statusCode ?? null
        const responseHeaders = { ...upstreamRes.headers }
        delete responseHeaders['content-encoding']
        delete responseHeaders['content-length']
        delete responseHeaders['transfer-encoding']
        try { res.writeHead(upstreamRes.statusCode ?? 502, responseHeaders) } catch { /* client gone */ }
        let acc = ''
        let bytes = 0
        upstreamRes.on('data', (chunk) => {
          try { res.write(chunk) } catch { /* client gone */ }
          bytes += chunk.length
          if (bytes <= MAX_REPLY_BYTES) acc += chunk.toString('utf8')
        })
        upstreamRes.on('end', () => {
          try { res.end() } catch { /* client gone */ }
          if (bytes <= MAX_REPLY_BYTES) {
            try {
              const parsed = parseAnthropicReply(acc, String(upstreamRes.headers['content-type'] ?? ''))
              record.reply = {
                text: truncate(parsed.text),
                thinking: truncate(parsed.thinking),
                toolUses: parsed.toolUses.map((block) => ({
                  id: block.id,
                  name: block.name,
                  input: block.input === undefined ? null : block.input,
                })),
                stopReason: parsed.stopReason,
                usage: parsed.usage,
              }
            } catch (error) {
              record.error = `reply parse: ${String(error?.message ?? error)}`
            }
          } else {
            record.error = `reply exceeded ${String(MAX_REPLY_BYTES)} bytes; not parsed`
          }
          record.elapsedMs = Date.now() - started
          persist(record)
          inFlight -= 1
          log(`recorder: ${String(record.method)} ${String(record.path)} -> ${String(record.status)} model=${String(record.model)} tools=${String(record.toolCount)} tool_uses=${String(record.reply.toolUses.length)}`)
        })
        upstreamRes.on('error', (error) => {
          record.error = String(error?.message ?? error)
          record.elapsedMs = Date.now() - started
          persist(record)
          inFlight -= 1
        })
      })
      upstreamReq.on('error', (error) => {
        record.error = String(error?.message ?? error)
        record.elapsedMs = Date.now() - started
        persist(record)
        inFlight -= 1
        if (!res.headersSent) res.writeHead(502, { 'content-type': 'application/json' })
        try { res.end(JSON.stringify({ error: { message: record.error } })) } catch { /* closed */ }
      })
      upstreamReq.end(bodyBuffer)
    })
  })

  await new Promise((done, fail) => {
    server.once('error', fail)
    server.listen(0, '127.0.0.1', () => done())
  })
  const address = server.address()
  const port = typeof address === 'object' && address !== null ? address.port : null
  if (port === null) throw new Error('the model-call recorder did not get a loopback port')
  const prefix = upstreamUrl.pathname === '/' ? '' : upstreamUrl.pathname.replace(/\/$/u, '')
  const baseUrl = `http://127.0.0.1:${String(port)}${prefix}`
  log(`recorder listening on ${baseUrl} -> ${upstreamUrl.origin}${prefix}`)

  return {
    baseUrl,
    port,
    upstream: `${upstreamUrl.origin}${prefix}`,
    records: () => records.slice(),
    toolNames: () => [...new Set(records.flatMap((record) => record.toolNames))],
    inFlight: () => inFlight,
    snapshot: () => ({
      upstream: `${upstreamUrl.origin}${prefix}`,
      baseUrl,
      calls: records.length,
      toolNames: [...new Set(records.flatMap((record) => record.toolNames))],
      records: records.slice(),
    }),
    stop: () => new Promise((done) => {
      server.close(() => done())
      setTimeout(done, 2000)
    }),
  }
}
