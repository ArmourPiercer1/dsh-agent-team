/**
 * mini-standalone.mjs — standalone mini-MCP endpoint in its OWN process.
 *
 * The campaign boot (boot.mjs) normally starts the two mini-MCP servers
 * IN-PROCESS (same PID as the boot orchestrator), which makes them
 * unkillable independently — the plan's T3.8b (running kill/reconnect) is
 * then unexecutable. With MOCK_EXTERNAL_MINIS=1 boot.mjs spawns this script
 * as separate node processes so each mini can be killed/restarted alone
 * while the 3181 host stays up.
 *
 * Usage: node mini-standalone.mjs <port>
 * Prints MINI_READY port=<port> once listening; stays alive until killed.
 */
import { startMiniMcpServer } from '../../../packages/runtime/root-binding/harness/mini-mcp.mjs'

const port = Number(process.argv[2] || 0)
if (!port || Number.isNaN(port) || !Number.isInteger(port)) {
  console.error('usage: node mini-standalone.mjs <port>')
  process.exit(2)
}
const server = await startMiniMcpServer([port])
console.log(`MINI_READY port=${server.port}`)
process.on('SIGTERM', () => process.exit(0))
process.on('SIGINT', () => process.exit(0))
setInterval(() => {}, 1 << 30) // keep-alive
