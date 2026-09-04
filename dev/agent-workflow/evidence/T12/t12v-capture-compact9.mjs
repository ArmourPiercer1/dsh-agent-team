import { readFileSync } from 'node:fs'
const cap = JSON.parse(readFileSync('D:/AgentDev/dsh-plugins/dsh-agent-team/dev/agent-workflow/evidence/T12/t12v-mock-capture.json', 'utf8'))
const out = []
for (const r of cap.requests ?? cap) {
  const msgs = r.messages ?? []
  let lastUser = ''
  for (let i = msgs.length - 1; i >= 0; i--) {
    const m = msgs[i]
    if (m && m.role === 'user') {
      const c = typeof m.content === 'string' ? m.content : JSON.stringify(m.content ?? '')
      lastUser = c.replace(/\n/g, ' ')
      break
    }
  }
  const tools = Array.isArray(r.tools) ? r.tools : []
  const hasMcp = tools.some(t => String(t).includes('mcp'))
  const replyKind = r.reply && r.reply.kind ? r.reply.kind : (r.sent && r.sent.length ? 'sent' : '?')
  out.push(`#${String(r.seq ?? '?').padStart(2)} ${String(r.model ?? '').padEnd(13)} m=${String(msgs.length).padStart(2)} tools=${tools.length}${hasMcp ? '(MCP!)' : ''} at=${String(r.receivedAt ?? '').slice(11, 19)} reply=${replyKind} user="${lastUser.slice(0, 58)}"`)
}
console.log(out.join('\n'))
