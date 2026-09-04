// T12-V15: extract item-2 capture-fidelity evidence from a mock capture file.
// Usage: node t12v-capture-evidence.mjs <capture.json>
import { readFileSync } from 'node:fs'
const path = process.argv[2]
const cap = JSON.parse(readFileSync(path, 'utf8'))
const reqs = cap.requests ?? []
console.log(`capture: ${cap.endpoint ?? '?'} total=${cap.totalRequests ?? reqs.length} requests=${reqs.length}`)
for (const r of reqs) {
  const body = r
  const msgs = Array.isArray(body.messages) ? body.messages : []
  const systems = msgs.filter((m) => m.role === 'system')
  const tools = Array.isArray(body.tools) ? body.tools : []
  const toolNames = tools.map((t) => (t && t.function && t.function.name) || '?')
  const personaHits = systems.filter((s) => {
    const c = typeof s.content === 'string' ? s.content : JSON.stringify(s.content ?? '')
    return c.includes('T12V worker persona') || c.includes('persona')
  })
  const maxContent = msgs.reduce((mx, m) => {
    const c = typeof m.content === 'string' ? m.content : JSON.stringify(m.content ?? '')
    return Math.max(mx, c.length)
  }, 0)
  const mcpTools = toolNames.filter((n) => String(n).startsWith('mcp__'))
  console.log(
    `req${r.seq} model=${body.model ?? '?'} stream=${body.stream ?? '?'} ` +
    `msgs=${msgs.length} systems=${systems.length} systemChars=${systems.map((s) => (typeof s.content === 'string' ? s.content.length : JSON.stringify(s.content ?? '').length)).join('/') || 0} ` +
    `persona=${systems.length > 0 && personaHits.length > 0 ? 'YES(' + personaHits.length + ')' : (systems.length > 0 ? 'no-hit' : 'none')} ` +
    `tools=${tools.length} mcpTools=[${mcpTools.join(',') || 'none'}] maxMsgLen=${maxContent} ` +
    `firstUser=${JSON.stringify((msgs.find((m) => m.role === 'user')?.content ?? '').slice(0, 90))}`
  )
}
