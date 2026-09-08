// raw table keys for forensics (read-only)
import { loadDomain } from 'file:///D:/AgentDev/dsh-plugins/dsh-agent-team/tests/mock/scripts/common.mjs'

const dom = loadDomain()
for (const [t, rows] of Object.entries(dom.tables)) {
  const keys = Object.keys(rows)
  console.log(`== ${t} (${keys.length} rows)`)
  for (const k of keys) {
    const v = rows[k]
    const obj = typeof v === 'string' ? JSON.parse(v) : v
    const brief = JSON.stringify(obj)
    console.log(`  key=${k}  ${brief.length > 400 ? brief.slice(0, 400) + '…' : brief}`)
  }
}
