import { makeFixture } from '../../00-baseline/p00-fixture.mjs'
import { libUrl, HERE } from '../p09-shared.mjs'
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
const logPath = join(HERE, 'probe-scratch', 'repro-calls.jsonl')
writeFileSync(logPath, '')
const f = await makeFixture()
const logs = []
f.ctx.logger.warn = (m) => logs.push(['warn', String(m)])
f.ctx.logger.error = (m) => logs.push(['error', String(m)])
f.ctx.logger.info = (m) => logs.push(['info', String(m)])
await f.ctx.plugin(await import(libUrl('mcp', 'mcp-client')), {
  transport: 'stdio', serverName: 'probe', command: process.execPath,
  args: [join(HERE, 'p09-mcp-mock-server.mjs')], env: { P09_MCP_CALL_LOG: logPath }, cwd: HERE, failOnStartupError: true,
})
console.log('schemas', f.ctx.tools.schemas().map(s=>s.name))
console.log('logs', JSON.stringify(logs, null, 1))
console.log('child log\n' + readFileSync(logPath, 'utf8'))
await f.ctx.dispose()
