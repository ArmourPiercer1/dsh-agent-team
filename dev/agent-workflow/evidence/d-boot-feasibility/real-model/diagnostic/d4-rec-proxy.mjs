// DIAGNOSTIC ONLY — NOT part of the driver and NOT a gate.
// Records the model request BODY (model id, tools, message roles) and the SSE reply, forwards to the
// real provider, and NEVER logs headers (so the x-api-key header is not recorded). Used once, on
// 2026-11-26, to measure the 43-tool surface on the real route; see ../REAL-MODEL-ACCEPTANCE.md §0.4.
/**
 * Diagnostic recording pass-through for the D4 real-model probe.
 * Forwards every request to the real endpoint (default
 * https://api.deepseek.com/anthropic) and records the REQUEST BODY (model id,
 * tool names, message roles) plus the streamed reply's text / tool_use blocks.
 * It never records a header, so no credential is written anywhere.
 *
 * Diagnostic only: this file is NOT part of the driver and is not committed as
 * product code. The driver is run unchanged with DEEPSEEK_BASE_URL pointing here.
 */
import { createServer } from 'node:http'
import { request as httpsRequest } from 'node:https'
import { writeFileSync } from 'node:fs'

const UPSTREAM = new URL(process.env.UPSTREAM ?? 'https://api.deepseek.com/anthropic')
const OUT = process.env.OUT ?? 'd4-rec.json'
const PORT = Number(process.env.PORT ?? 13270)
const records = []

function persist() {
  writeFileSync(OUT, `${JSON.stringify({ upstream: UPSTREAM.href, records }, null, 2)}\n`)
}

function sseEvents(text) {
  const out = []
  for (const line of text.split('\n')) {
    const t = line.trim()
    if (!t.startsWith('data:')) continue
    const payload = t.slice(5).trim()
    if (payload === '' || payload === '[DONE]') continue
    try { out.push(JSON.parse(payload)) } catch { /* partial line */ }
  }
  return out
}

const server = createServer((req, res) => {
  const chunks = []
  req.on('data', (c) => chunks.push(c))
  req.on('end', () => {
    const bodyBuf = Buffer.concat(chunks)
    let body = null
    try { body = JSON.parse(bodyBuf.toString('utf8')) } catch { body = null }
    const rec = {
      at: new Date().toISOString(),
      path: req.url,
      method: req.method,
      model: body?.model ?? null,
      stream: body?.stream ?? null,
      tools: Array.isArray(body?.tools) ? body.tools.map((t) => String(t?.name ?? t?.function?.name ?? '')) : [],
      toolCount: Array.isArray(body?.tools) ? body.tools.length : 0,
      messageRoles: Array.isArray(body?.messages) ? body.messages.map((m) => String(m?.role ?? '')) : [],
      systemPresent: typeof body?.system === 'string' || Array.isArray(body?.system),
      upstreamStatus: null,
      replyText: '',
      replyToolUses: [],
      error: null,
    }
    records.push(rec)

    // Forward the INCOMING path (which already carries the upstream base path,
    // because the host's base URL is proxy origin + upstream pathname) to the
    // upstream ORIGIN. Using `new URL(req.url, UPSTREAM)` here would replace the
    // path and drop `/anthropic` (measured: that produced a 404 from the real
    // endpoint that looked like a model error).
    const target = new URL(req.url ?? '/', UPSTREAM.origin)
    const headers = { ...req.headers, host: target.host }
    const preq = httpsRequest({
      protocol: target.protocol,
      hostname: target.hostname,
      port: target.port || 443,
      path: `${target.pathname}${target.search}`,
      method: req.method,
      headers,
    }, (pres) => {
      rec.upstreamStatus = pres.statusCode ?? null
      res.writeHead(pres.statusCode ?? 502, pres.headers)
      let acc = ''
      pres.on('data', (c) => {
        res.write(c)
        acc += c.toString('utf8')
        if (acc.length > 4_000_000) acc = acc.slice(-2_000_000)
      })
      pres.on('end', () => {
        res.end()
        for (const ev of sseEvents(acc)) {
          if (ev?.type === 'content_block_delta' && ev?.delta?.type === 'text_delta') rec.replyText += String(ev.delta.text ?? '')
          if (ev?.type === 'content_block_start' && ev?.content_block?.type === 'tool_use') {
            rec.replyToolUses.push({ id: ev.content_block.id ?? null, name: ev.content_block.name ?? null })
          }
          if (ev?.type === 'message' && Array.isArray(ev?.content)) {
            for (const b of ev.content) {
              if (b?.type === 'text') rec.replyText += String(b.text ?? '')
              if (b?.type === 'tool_use') rec.replyToolUses.push({ id: b.id ?? null, name: b.name ?? null })
            }
          }
        }
        persist()
      })
    })
    preq.on('error', (e) => {
      rec.error = String(e?.message ?? e)
      persist()
      if (!res.headersSent) res.writeHead(502, { 'content-type': 'application/json' })
      try { res.end(JSON.stringify({ error: { message: rec.error } })) } catch { /* closed */ }
    })
    preq.end(bodyBuf)
  })
})

server.listen(PORT, '127.0.0.1', () => {
  persist()
  console.log(`proxy listening on ${PORT} -> ${UPSTREAM.href}`)
})

for (const sig of ['SIGTERM', 'SIGINT']) {
  process.on(sig, () => { persist(); process.exit(0) })
}
