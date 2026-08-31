/**
 * mini-mcp.mjs — one minimal streamable-http MCP endpoint for the P7-T7
 * real-instance harness: the PUBLIC surface through which an external MCP
 * client can reach the legacy Team Session reader inside the booted host
 * process.
 *
 * Serves initialize / notifications / tools/list / tools/call over plain
 * JSON (Content-Type application/json, no SSE) — sufficient for the MCP
 * handshake and one tool round-trip. The single tool is
 * `p7t7_legacy_read` (args: `{action, projectDir?, workspaceCwd?}`): the
 * action token is dispatched to the reader's `dispatchReaderAction` over
 * the real-FS home port (the host process's DSH_HOME). The reader's typed
 * errors come back as `isError` content carrying the closed error code
 * and details; a successful inspect returns the inspection view as
 * lossless JSON text.
 *
 * Port band 3491-3495 (first free; the harness runs sequentially, never
 * concurrently with another task's harness). Binds 127.0.0.1 only; the
 * harness closes it during row teardown so no port is left held
 * (port-release self-check).
 *
 * Pattern source: packages/runtime/root-binding/harness/mini-mcp.mjs
 * (P5-T5/P6-T6 real-instance harnesses), adapted.
 * @module @dsh-agent-team/legacy/session-reader/e2e/mini-mcp
 */
import { createServer } from 'node:http'

/** The one tool the mini endpoint serves. */
const MINI_TOOL = {
  name: 'p7t7_legacy_read',
  description:
    'Read-only inspect of the legacy Team Session metadata under DSH_HOME. ' +
    'action must be "inspect" (the only implemented reader action); every other action is rejected with a typed error. ' +
    'Optional projectDir scopes the session scan to one project key; optional workspaceCwd enables the workspace roster overlay.',
  inputSchema: {
    type: 'object',
    properties: {
      action: { type: 'string' },
      projectDir: { type: 'string' },
      workspaceCwd: { type: 'string' },
    },
    required: ['action'],
    additionalProperties: false,
  },
}

/**
 * Dispatch one `tools/call` for the reader tool.
 * @param {object} env - { readerModule, homePort }.
 * @param {object} args - the tool arguments.
 * @returns {object} the MCP tool result ({content, isError}).
 */
function callReaderTool(env, args) {
  const { readerModule, homePort } = env
  const request = { dshHome: process.env.DSH_HOME }
  if (typeof args.projectDir === 'string' && args.projectDir.length > 0) {
    request.projectDir = args.projectDir
  }
  if (typeof args.workspaceCwd === 'string' && args.workspaceCwd.length > 0) {
    request.workspaceCwd = args.workspaceCwd
  }
  try {
    const view = readerModule.dispatchReaderAction(homePort, args.action, request)
    return {
      content: [{ type: 'text', text: JSON.stringify(view) }],
      isError: false,
    }
  } catch (error) {
    const typed = readerModule.isLegacyReaderError(error)
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            error: true,
            ...(typed ? { code: error.code, details: error.details } : {}),
            message: error instanceof Error ? error.message : String(error),
          }),
        },
      ],
      isError: true,
    }
  }
}

/**
 * JSON-RPC dispatch for the mini endpoint. `null` = notification (202).
 * @param {object} env - { readerModule, homePort }.
 * @param {unknown} msg - the parsed JSON-RPC message.
 * @returns {object|null} the JSON-RPC reply, or null for notifications.
 */
function mcpRpc(env, msg) {
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
        serverInfo: { name: 'p7t7-mini-mcp', version: '0.0.1' },
      })
    case 'notifications/initialized':
    case 'notifications/cancelled':
      return null
    case 'tools/list':
      return ok({ tools: [MINI_TOOL] })
    case 'tools/call':
      if (params.name === 'p7t7_legacy_read') {
        const args = (params.arguments && typeof params.arguments === 'object') ? params.arguments : {}
        return ok(callReaderTool(env, args))
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
 * @param {object} env - { readerModule, homePort }.
 * @returns {Promise<{port: number, server: import('node:http').Server}>} the bound server.
 */
export function startMiniMcpServer(portCandidates, env) {
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
        const reply = mcpRpc(env, msg)
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
        reject(new Error(`p7t7: no free mini-MCP port among ${portCandidates.join(', ')}`))
        return
      }
      const port = portCandidates[i]
      server.once('error', (error) => {
        if (String(error?.code ?? '').startsWith('EADDR')) {
          attempt(i + 1)
        } else {
          reject(error)
        }
      })
      server.listen(port, '127.0.0.1', () => {
        server.removeAllListeners('error')
        resolve({ port, server })
      })
    }
    attempt(0)
  })
}

/**
 * Close the mini server (idempotent; resolves even on double-close).
 * @param {{port: number, server: import('node:http').Server}|null|undefined} mini
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
