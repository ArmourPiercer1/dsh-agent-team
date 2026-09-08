// print the first N user/message rows of one session's durable log (read-only)
import { sessionLogPath, logRows } from 'file:///D:/AgentDev/dsh-plugins/dsh-agent-team/tests/mock/scripts/common.mjs'

const sessionId = process.argv[2]
const n = Number(process.argv[3] ?? 5)
const logPath = sessionLogPath(sessionId)
if (!logPath) { console.error('no log for ' + sessionId); process.exit(2) }
console.log('log=' + logPath)
const rows = logRows(logPath)
console.log('rows=' + rows.length)
let shown = 0
for (const r of rows) {
  const d = r.raw
  if (d.type === 'user/message') {
    const content = JSON.stringify(d.content ?? '')
    console.log(`[user] seq=${r.seq} turn=${r.turn} ${content.slice(0, 160)}`)
    if (++shown >= n) break
  }
}
const last = rows[rows.length - 1]
console.log('last row: type=' + (last?.type ?? 'none') + ' seq=' + (last?.seq ?? '?'))
