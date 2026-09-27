import { readFileSync } from 'fs'
import { zstdDecompressSync } from 'zlib'
const file = process.argv[2]
const buf = readFileSync(file)
const MAGIC = Buffer.from([0x28,0xb5,0x2f,0xfd])
let idx = 0, starts = []
while ((idx = buf.indexOf(MAGIC, idx)) !== -1) { starts.push(idx); idx += 4 }
let text = ''
for (let i = 0; i < starts.length; i++) {
  const end = i + 1 < starts.length ? starts[i + 1] : buf.length
  text += zstdDecompressSync(buf.subarray(starts[i], end)).toString('utf8')
}
const lines = text.trim().split('\n')
for (const l of lines) {
  const e = JSON.parse(l)
  const d = e.data ?? {}
  const m = d.message ?? d
  let desc = ''
  if (e.type === 'tool/call') desc = `name=${d.name}`
  else if (e.type === 'tool/result') desc = `callId=${d.message?.callId ?? d.callId ?? '?'}`
  else if (e.type === 'assistant/message') desc = JSON.stringify((m.content ?? [])[0]?.type ?? '').slice(0,60)
  else if (e.type === 'user/message') {
    const c = m.content
    const t = typeof c === 'string' ? c : (Array.isArray(c) ? c.map((b) => b?.type === 'tool_result' ? 'tool_result' : (b?.text ?? '').slice(0,50)).join('|') : '')
    desc = String(t).slice(0,100)
  }
  console.log(String(e.seq).padEnd(4), (e.type ?? '?').padEnd(28), desc)
}
