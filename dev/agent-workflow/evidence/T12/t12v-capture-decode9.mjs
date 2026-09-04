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
      lastUser = c
      break
    }
  }
  const tools = Array.isArray(r.tools) ? r.tools : []
  out.push(`#${r.seq ?? '?'} model=${r.model} msgs=${msgs.length} tools=[${tools.join(',')}] lastUser=${JSON.stringify(lastUser.slice(0, 90))} at=${r.receivedAt ?? ''}`)
}
console.log(out.join('\n'))
