// Defensive dump of tool-call / tool-role messages across a capture.
import { readFileSync } from 'node:fs'
const cap = JSON.parse(readFileSync(process.argv[2], 'utf8'))
const lo = process.argv[3] ? Number(process.argv[3]) : 1
const hi = process.argv[4] ? Number(process.argv[4]) : 999
for (const r of cap.requests) {
  if (r.seq < lo || r.seq > hi) continue
  const msgs = r.messages ?? []
  const tcMsgs = msgs.filter((m) => m.role === 'assistant' && Array.isArray(m.tool_calls))
  const tmMsgs = msgs.filter((m) => m.role === 'tool')
  console.log(`req${r.seq} model=${r.model} msgs=${msgs.length} assistantWithToolCalls=${tcMsgs.length} toolRoleMsgs=${tmMsgs.length}`)
  for (const m of tcMsgs) {
    for (const t of m.tool_calls ?? []) {
      const fn = t?.function
      console.log(`   tool_call: id=${t?.id} name=${fn?.name ?? '(no function key)'} raw=${JSON.stringify(t).slice(0, 200)}`)
    }
  }
  for (const m of tmMsgs) {
    console.log(`   tool-role: id=${m.tool_call_id} content=${JSON.stringify(m.content).slice(0, 200)}`)
  }
}
