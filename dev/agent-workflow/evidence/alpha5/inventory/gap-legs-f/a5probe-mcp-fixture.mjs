/**
 * a5probe-mcp-fixture.mjs — the leg3 fixture MCP endpoint (F-route, gap legs runner).
 *
 * Shape source: packages/runtime/root-binding/harness/mini-mcp.mjs (the pinned
 * generation's proven fixture — plain JSON over POST /mcp, no SSE), with two
 * deliberate deltas for this round:
 *   - the single tool is `echo` (returns `echo:<msg>`) — the R draft's tool name;
 *   - every tools/call is counted INCREMENTALLY and appended to a call-log file
 *     given by A5LEGS_MCP_LOG (server-side execution witness = dynRan receipt).
 * DEVIATION vs the R draft: the draft said "stdio" fixture; the pinned row-config
 * supply form (`mcpServers: [{ name, port }]`, proven by tests/kits/
 * f15-mcp-live-loss-smoke) is streamable-http over loopback. Still 100%
 * synthetic, loopback-only, single tool — the draft's intent (禁真实外部 server)
 * is honored; recorded in F-RESULTS.md.
 */
import { createServer } from 'node:http'
import { appendFileSync } from 'node:fs'

const ECHO_TOOL = {
  name: 'echo',
  description: 'a5legs leg3 governance-probe echo tool',
  inputSchema: {
    type: 'object',
    properties: { msg: { type: 'string' } },
    required: ['msg'],
    additionalProperties: false,
  },
}

function ok(id, result) { return { jsonrpc: '2.0', id, result } }
function fail(id, code, message) { return { jsonrpc: '2.0', id, error: { code, message } } }

let calls = 0

function mcpRpc(msg) {
  const method = String(msg?.method ?? '')
  const id = msg?.id ?? null
  const params = msg?.params ?? {}
  switch (method) {
    case 'initialize':
      return ok(id, {
        protocolVersion: '2024-11-05',
        capabilities: { tools: { listChanged: false } },
        serverInfo: { name: 'a5legs-a5probe', version: '0.0.1' },
      })
    case 'notifications/initialized':
      return null
    case 'tools/list':
      return ok(id, { tools: [ECHO_TOOL] })
    case 'tools/call': {
      if (params.name === 'echo') {
        calls += 1
        const line = `${new Date().toISOString()} call#${calls} args=${JSON.stringify(params.arguments ?? {})}\n`
        if (process.env.A5LEGS_MCP_LOG !== undefined && process.env.A5LEGS_MCP_LOG !== '') {
          try { appendFileSync(process.env.A5LEGS_MCP_LOG, line) } catch { /* best-effort */ }
        }
        return ok(id, {
          content: [{ type: 'text', text: `echo:${String(params.arguments?.msg ?? '')}#call${calls}` }],
          isError: false,
        })
      }
      return fail(id, -32602, `unknown tool: ${String(params.name)}`)
    }
    default:
      if (id === null) return null
      return fail(id, -32601, `method not found: ${method}`)
  }
}

export function startFixture(portCandidates) {
  return new Promise((resolve, reject) => {
    const server = createServer((req, res) => {
      if (req.method === 'DELETE' && req.url === '/mcp') { res.writeHead(200); res.end(); return }
      if (req.method !== 'POST' || req.url !== '/mcp') {
        res.writeHead(404, { 'content-type': 'application/json' })
        res.end(JSON.stringify({ jsonrpc: '2.0', id: null, error: { code: -32000, message: 'not found' } }))
        return
      }
      const chunks = []
      req.on('data', (c) => chunks.push(c))
      req.on('end', () => {
        let msg
        try { msg = JSON.parse(Buffer.concat(chunks).toString('utf8') || 'null') } catch {
          res.writeHead(400, { 'content-type': 'application/json' })
          res.end(JSON.stringify({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'parse error' } }))
          return
        }
        const reply = mcpRpc(msg)
        if (reply === null) { res.writeHead(202); res.end(); return }
        res.writeHead(200, { 'content-type': 'application/json' })
        res.end(JSON.stringify(reply))
      })
    })
    const tryPort = (i) => {
      if (i >= portCandidates.length) { reject(new Error('fixture: no free candidate port')); return }
      server.once('error', () => tryPort(i + 1))
      server.once('listening', () => resolve({ port: server.address().port, server, calls: () => calls }))
      server.listen(portCandidates[i], '127.0.0.1')
    }
    tryPort(0)
  })
}

export function stopFixture(mini) {
  try { mini.server.close() } catch { /* gone */ }
}
