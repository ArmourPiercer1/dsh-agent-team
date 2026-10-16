#!/usr/bin/env node
/**
 * p09-mcp-mock-server.mjs — minimal stdio MCP mock server (Team-owned TEST FIXTURE).
 *
 * Implements ONLY the wire subset the pinned MCP client needs:
 *   initialize / notifications/initialized / tools/list / tools/call(echo) / ping
 * One `echo` tool: returns `echo:<message> pid=<process.pid>` (pid self-report =
 * REAL OS process evidence). Every tools/call is appended as one JSON line to
 * the call-log file given by env P09_MCP_CALL_LOG — the child-side ground
 * truth counter for "did the native MCP body actually reach the server".
 *
 * NO network access, NO dependencies (hand-rolled NDJSON JSON-RPC 2.0 over
 * stdin/stdout so the fixture exercises exactly the pinned client's framing).
 *
 * Usage: node p09-mcp-mock-server.mjs            (call log via P09_MCP_CALL_LOG)
 */
import { appendFileSync } from 'node:fs'

const LOG = process.env.P09_MCP_CALL_LOG ?? ''
const PID = process.pid
const TOOLS = [{
  name: 'echo',
  description: 'Echo the message back and report the server process id.',
  inputSchema: {
    type: 'object',
    properties: { message: { type: 'string', description: 'Text to echo back.' } },
    required: ['message'],
  },
}]

const log = (line) => { if (LOG !== '') { try { appendFileSync(LOG, `${JSON.stringify({ at: Date.now(), pid: PID, ...line })}\n`) } catch { /* fixture log best-effort */ } } }
const send = (msg) => { process.stdout.write(`${JSON.stringify(msg)}\n`) }
const reply = (id, result) => send({ jsonrpc: '2.0', id, result })
const fail = (id, code, message) => send({ jsonrpc: '2.0', id, error: { code, message } })

log({ ev: 'spawn' })

let buffer = ''
process.stdin.setEncoding('utf8')
process.stdin.on('data', (chunk) => {
  buffer += chunk
  for (;;) {
    const nl = buffer.indexOf('\n')
    if (nl === -1) break
    const line = buffer.slice(0, nl).trim()
    buffer = buffer.slice(nl + 1)
    if (line === '') continue
    let msg
    try { msg = JSON.parse(line) } catch { continue }
    handle(msg)
  }
})
process.stdin.on('end', () => { log({ ev: 'stdin-end' }); process.exit(0) })
process.on('SIGTERM', () => { log({ ev: 'sigterm' }); process.exit(0) })
process.on('SIGINT', () => { log({ ev: 'sigint' }); process.exit(0) })

function handle(msg) {
  const { id, method, params } = msg
  const isRequest = id !== undefined && id !== null
  switch (method) {
    case 'initialize':
      log({ ev: 'initialize', client_protocol: params?.protocolVersion ?? null })
      // Echo the client's requested protocol version (SDK 2.x versionNegotiation auto).
      reply(id, {
        protocolVersion: params?.protocolVersion ?? '2025-06-18',
        capabilities: { tools: { listChanged: false } },
        serverInfo: { name: 'p09-mock-mcp', version: '0.0.0' },
        instructions: undefined,
      })
      return
    case 'notifications/initialized':
      log({ ev: 'initialized' })
      return
    case 'ping':
      if (isRequest) reply(id, {})
      return
    case 'tools/list':
      log({ ev: 'tools/list' })
      reply(id, { tools: TOOLS })
      return
    case 'tools/call': {
      const name = params?.name
      const args = params?.arguments ?? {}
      log({ ev: 'tools/call', name, message: String(args.message ?? '') })
      if (name !== 'echo') {
        reply(id, { content: [{ type: 'text', text: `unknown tool: ${String(name)}` }], isError: true })
        return
      }
      reply(id, { content: [{ type: 'text', text: `echo:${String(args.message)} pid=${PID}` }] })
      return
    }
    default:
      if (isRequest && !String(method).startsWith('notifications/')) fail(id, -32601, `method not found: ${String(method)}`)
  }
}
