import { readFileSync } from 'node:fs'
const cap = JSON.parse(readFileSync('D:/AgentDev/dsh-plugins/dsh-agent-team/dev/agent-workflow/evidence/T12/t12v-mock-capture.json', 'utf8'))
const r5 = (cap.requests ?? cap).find(r => (r.seq ?? 0) === 5)
const out = []
const MARKER = 'T12V_USE_MCP_mtkjdrmw6cee19'
for (let i = 0; i < (r5.messages ?? []).length; i++) {
  const m = r5.messages[i]
  const kind = Array.isArray(m.content) ? 'array[' + m.content.length + ']' : typeof m.content
  const c = typeof m.content === 'string' ? m.content : JSON.stringify(m.content ?? '')
  out.push(`--- msg[${i}] role=${m.role} contentKind=${kind} len=${c.length} hasMarker=${c.includes(MARKER)}`)
  out.push(c.slice(0, 400).replace(/\n/g, '\\n'))
}
out.push('=== marker found in any message: ' + (r5.messages ?? []).some(m => JSON.stringify(m).includes(MARKER)))
console.log(out.join('\n'))
