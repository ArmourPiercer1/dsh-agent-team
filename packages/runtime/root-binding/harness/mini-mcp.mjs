/**
 * mini-mcp.mjs — one minimal streamable-http MCP endpoint for the P5-T5
 * real-instance harness (the capability facet's live mcp seam target).
 *
 * Serves initialize / notifications / tools/list / tools/call over plain JSON
 * (Content-Type application/json, no SSE) — sufficient for the
 * `@deepseek-ai/dsh-mcp-client` startup handshake and one tool round-trip.
 * The single tool is `ping` (args: `{msg}` -> text `pong:<msg>`); mounted
 * under serverName `p5t5mini` it appears in the agent view as
 * `mcp__p5t5mini__ping`.
 *
 * Port band 3481-3485 (P2-T4 used 3491-3495; no overlap). Binds
 * 127.0.0.1 only; the harness closes it during teardown so no port is left
 * held (port-release self-check).
 *
 * Pattern source: tests/characterization/probes/capabilities/index.mjs
 * startMiniMcpServer/mcpRpc (P4-T4 evidence), adapted.
 * @module @dsh-agent-team/runtime/root-binding/harness/mini-mcp
 */
import { createServer } from 'node:http'

/** The one tool the mini endpoint serves. */
const MINI_TOOL = {
  name: 'ping',
  description: 'P5-T5 mini MCP echo tool',
  inputSchema: {
    type: 'object',
    properties: { msg: { type: 'string' } },
    required: ['msg'],
    additionalProperties: false,
  },
}

/**
 * JSON-RPC dispatch for the mini endpoint. `null` = notification (202).
 * @param {unknown} msg - the parsed JSON-RPC message.
 * @returns {object|null} the JSON-RPC reply, or null for notifications.
 */
function mcpRpc(msg) {
  const id = msg === null || typeof msg !== 'object' ? null : msg.id
  const method = msg === null || typeof msg !== 'object' ? undefined : msg.method
  const params = msg === null || typeof msg !== 'object' || msg.params === undefined ? {} : msg.params
  const ok = (result) => ({ jsonrpc: '2.0', id, result })
  const fail = (code, message) => ({ jsonrpc: '2.0', id, error: { code, message } })
  switch (method) {
    case 'initialize':
      return ok({
        protocolVersion: (params && params.protocolVersion) || '2025-06-18',
        capabilities: { tools: { listChanged: false } },
        serverInfo: { name: 'p5t5-mini-mcp', version: '0.0.1' },
      })
    case 'notifications/initialized':
    case 'notifications/cancelled':
      return null
    case 'tools/list':
      return ok({ tools: [MINI_TOOL] })
    case 'tools/call':
      if (params.name === 'ping') {
        const text = `pong:${String((params.arguments && params.arguments.msg) ?? '')}`
        return ok({ content: [{ type: 'text', text }], isError: false })
      }
      return fail(-32602, `unknown tool: ${String(params.name)}`)
    default:
      if (id === null) return null
      return fail(-32601, `method not found: ${String(method)}`)
  }
}

/**
 * Start the mini endpoint on the first free candidate port.
 * @param {number[]} portCandidates - ports to try, in order.
 * @returns {Promise<{port: number, server: import('node:http').Server}>} the bound server.
 */
export function startMiniMcpServer(portCandidates) {
  return new Promise((resolve, reject) => {
    const server = createServer((req, res) => {
      if (req.method === 'DELETE' && req.url === '/mcp') {
        res.writeHead(200)
        res.end()
        return
      }
      if (req.method !== 'POST' || req.url !== '/mcp') {
        res.writeHead(404, { 'content-type': 'application/json' })
        res.end(JSON.stringify({ jsonrpc: '2.0', id: null, error: { code: -32000, message: 'not found' } }))
        return
      }
      const chunks = []
      req.on('data', (c) => chunks.push(c))
      req.on('end', () => {
        let msg
        try {
          msg = JSON.parse(Buffer.concat(chunks).toString('utf8') || 'null')
        } catch {
          res.writeHead(400, { 'content-type': 'application/json' })
          res.end(JSON.stringify({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'parse error' } }))
          return
        }
        const reply = mcpRpc(msg)
        if (reply === null) {
          res.writeHead(202)
          res.end()
          return
        }
        res.writeHead(200, { 'content-type': 'application/json' })
        res.end(JSON.stringify(reply))
      })
    })
    const attempt = (i) => {
      if (i >= portCandidates.length) {
        reject(new Error(`p5t5: no free mini-MCP port among ${portCandidates.join(', ')}`))
        return
      }
      const port = portCandidates[i]
      const onError = (error) => {
        if (error.code === 'EADDRINUSE') attempt(i + 1)
        else reject(error)
      }
      server.once('error', onError)
      server.listen(port, '127.0.0.1', () => {
        server.removeListener('error', onError)
        resolve({ port, server })
      })
    }
    attempt(0)
  })
}

/**
 * Close the mini server, swallowing a double close; also drops keep-alive
 * sockets so the harness process can exit cleanly.
 * @param {{port?: number, server?: import('node:http').Server}|null|undefined} mini - the started server.
 * @returns {Promise<void>}
 */
export function closeMiniServer(mini) {
  return new Promise((resolve) => {
    if (mini === null || mini === undefined || mini.server === undefined) return resolve()
    try {
      mini.server.close(() => resolve())
      mini.server.closeAllConnections?.()
    } catch {
      resolve()
    }
  })
}
