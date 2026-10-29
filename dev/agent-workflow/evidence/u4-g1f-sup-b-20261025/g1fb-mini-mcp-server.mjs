/**
 * g1fb-mini-mcp-server.mjs — local STDIO mini MCP server fixture for PoC-4b.
 *
 * Pattern source: packages/runtime/root-binding/harness/mini-mcp.mjs (the
 * repo's mini-MCP fixture, streamable-http) — the transport is ADAPTED to
 * stdio (newline-delimited JSON-RPC per the MCP stdio transport) because the
 * host mcp-client mounts stdio rows straight from the public profile patch
 * seam; the discovery/call shape (one `ping`-style tool, pong reply) is kept.
 *
 * Environment:
 *   G1F_MCP_NAME      server name (marker prefix)                     (required)
 *   G1F_MCP_MARKDIR   directory where EVERY handled tools/call writes
 *                     `mcp-<name>-<msg>.served` — the SERVER-SIDE effect
 *                     oracle, fully independent of the tool return value (required)
 *   G1F_MCP_TOOL      tool name (default: ping)
 *   G1F_MCP_WAKE      optional file path: the initialize response waits
 *                     (bounded) until this file exists → the tool reaches the
 *                     Host (and the model surface) strictly LATE, after the
 *                     test session was created — the late-binding cell.
 * @module dev/agent-workflow/evidence/u4-g1f-sup-b-20261025/g1fb-mini-mcp-server
 */
import { appendFileSync, existsSync, mkdirSync } from 'node:fs'
import { createInterface } from 'node:readline'

const NAME = process.env['G1F_MCP_NAME'] ?? 'unnamed'
const MARKDIR = process.env['G1F_MCP_MARKDIR'] ?? ''
const TOOL = process.env['G1F_MCP_TOOL'] ?? 'ping'
const WAKE = process.env['G1F_MCP_WAKE'] ?? ''

const log = (o) => { process.stderr.write(`${JSON.stringify({ server: NAME, ...o })}\n`) }

function send(msg) {
  process.stdout.write(`${JSON.stringify(msg)}\n`)
}

async function waitWake() {
  if (WAKE === '' || existsSync(WAKE)) return
  const until = Date.now() + 120_000
  while (!existsSync(WAKE) && Date.now() < until) {
    await new Promise((r) => { setTimeout(r, 200) })
  }
}

async function handle(req) {
  const id = req?.id
  switch (req?.method) {
    case 'initialize': {
      await waitWake()
      send({
        jsonrpc: '2.0', id,
        result: {
          protocolVersion: req?.params?.protocolVersion ?? '2024-11-05',
          capabilities: { tools: {} },
          serverInfo: { name: `g1fb-mini-${NAME}`, version: '0.1.0' },
        },
      })
      log({ phase: 'initialized' })
      return
    }
    case 'tools/list': {
      send({
        jsonrpc: '2.0', id,
        result: {
          tools: [{
            name: TOOL,
            description: `G1F mini MCP ${TOOL} (${NAME})`,
            inputSchema: { type: 'object', properties: { msg: { type: 'string' }, tag: { type: 'string' } }, required: ['msg'], additionalProperties: false },
          }],
        },
      })
      log({ phase: 'tools-list' })
      return
    }
    case 'tools/call': {
      const msg = String(req?.params?.arguments?.msg ?? 'x')
      // SERVER-SIDE MARKER: the independent effect oracle for PoC-4b.
      if (MARKDIR !== '') {
        mkdirSync(MARKDIR, { recursive: true })
        appendFileSync(`${MARKDIR}/mcp-${NAME}-${msg.replace(/[^A-Za-z0-9._-]/g, '_')}.served`, `served at ${new Date().toISOString()}\n`)
      }
      send({ jsonrpc: '2.0', id, result: { content: [{ type: 'text', text: `pong:${msg}` }], isError: false } })
      log({ phase: 'tools-call', msg })
      return
    }
    case 'notifications/initialized':
    case 'notifications/cancelled':
      return // notifications: no response
    case 'ping':
      send({ jsonrpc: '2.0', id, result: {} })
      return
    default: {
      if (id !== undefined) send({ jsonrpc: '2.0', id, error: { code: -32601, message: `method not found: ${String(req?.method)}` } })
    }
  }
}

const rl = createInterface({ input: process.stdin })
rl.on('line', (line) => {
  const t = line.trim()
  if (t === '') return
  let parsed
  try { parsed = JSON.parse(t) } catch { log({ phase: 'bad-line', raw: t.slice(0, 80) }); return }
  void handle(parsed)
})
rl.on('close', () => process.exit(0))
log({ phase: 'fixture-up' })
