import { pathToFileURL } from 'node:url'
import { join } from 'node:path'
import { writeFileSync, readFileSync } from 'node:fs'
import { TEST_USE } from '../p09-shared.mjs'
const { Client } = await import(pathToFileURL(join(TEST_USE, packages/mcp/mcp-client/node_modules/@modelcontextprotocol/client/dist/index.mjs')).href)
const { StdioClientTransport } = await import(pathToFileURL(join(TEST_USE, packages/mcp/mcp-client/node_modules/@modelcontextprotocol/client/dist/stdio.mjs')).href)
const HERE = process.cwd() + '/dev/agent-workflow/evidence/alpha5-adapter-p0/09-web-jobs-mcp'
const logPath = join(HERE, 'probe-scratch', 'repro-sdk.jsonl')
writeFileSync(logPath, '')
const t0 = Date.now()
const client = new Client({ name: 'raw-probe', version: '0.0.0' }, { capabilities: {}, versionNegotiation: { mode: 'auto' } })
const transport = new StdioClientTransport({ command: process.execPath, args: [join(HERE, 'p09-mcp-mock-server.mjs')], env: { P09_MCP_CALL_LOG: logPath }, cwd: HERE })
try {
  await client.connect(transport)
  console.log('connected after', Date.now() - t0, 'ms, serverPid', transport.pid)
  const tools = await client.listTools()
  console.log('tools', JSON.stringify(tools.tools.map(t=>t.name)))
  const r = await client.callTool({ name: 'echo', arguments: { message: 'sdk-direct' } })
  console.log('call', JSON.stringify(r))
} catch (err) { console.error('CONNECT_FAILED', err) }
console.log('child log\n' + readFileSync(logPath, 'utf8'))
await client.close().catch(()=>{})
setTimeout(()=>process.exit(0), 300)
