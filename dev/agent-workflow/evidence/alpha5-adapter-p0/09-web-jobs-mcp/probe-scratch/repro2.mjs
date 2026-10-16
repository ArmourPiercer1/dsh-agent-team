import { makeFixture } from '../../00-baseline/p00-fixture.mjs'
import { libUrl, HERE } from '../p09-shared.mjs'
import { writeFileSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
const logPath = join(HERE, 'probe-scratch', 'repro2-calls.jsonl')
writeFileSync(logPath, '')
const f = await makeFixture()
const logs = []
const sink = (lvl) => (msg, ...rest) => { logs.push([lvl, String(msg), ...(rest.length ? [JSON.stringify(rest).slice(0,200)] : [])]); }
const fakeLogger = Object.assign(sink('log'), { debug: sink('debug'), info: sink('info'), warn: sink('warn'), error: sink('error'), fatal: sink('fatal') })
Object.defineProperty(f.ctx, 'logger', { value: fakeLogger, configurable: true, writable: true })
console.log('logger replaced?', f.ctx.logger === fakeLogger)
const fiber = await f.ctx.plugin(await import(libUrl('mcp', 'mcp-client')), {
  transport: 'stdio', serverName: 'probe', command: process.execPath,
  args: [join(HERE, 'p09-mcp-mock-server.mjs')], env: { P09_MCP_CALL_LOG: logPath }, cwd: HERE, failOnStartupError: true,
  reconnect: { enabled: false },
})
console.log('fiber.state', fiber?.state, 'schemas', f.ctx.tools.schemas().map(s=>s.name))
console.log('LOGS:'); for (const l of logs) console.log(' ', JSON.stringify(l))
console.log('child log\n' + readFileSync(logPath, 'utf8'))
