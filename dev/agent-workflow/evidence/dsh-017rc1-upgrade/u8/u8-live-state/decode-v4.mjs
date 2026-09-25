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
console.log('events:', lines.length)
for (const l of lines) {
  const e = JSON.parse(l)
  const t = e.type ?? '?'
  const d = e.data ?? {}
  let desc = ''
  const blocks = d.message?.content ?? d.content ?? []
  if (Array.isArray(blocks)) {
    desc = blocks.map((b) => {
      if (b.type === 'tool_result') return 'tool_result(' + (b.tool_use_id ?? '?') + ' err=' + String(b.is_error ?? false) + ')'
      if (b.type === 'tool_use') return 'tool_use:' + b.name
      return 'text:' + JSON.stringify((b.text ?? '').slice(0, 70))
    }).join(' | ')
  }
  console.log(e.seq, t, desc)
}
