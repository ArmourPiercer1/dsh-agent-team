// Print the text content blocks of the last assistant/message in a session log.
import { readFileSync } from 'node:fs'
import { zstdDecompressSync } from 'node:zlib'
const file = process.argv[2]
if (!file) { console.error('usage: node last-assistant-text.mjs <log>'); process.exit(2) }
function decompressAll(buf) {
  const MAGIC = Buffer.from([0x28, 0xb5, 0x2f, 0xfd])
  const starts = []
  let off = 0
  for (;;) { const i = buf.indexOf(MAGIC, off); if (i === -1) break; starts.push(i); off = i + 4 }
  const bounds = [...starts, buf.length]
  const parts = []
  let pending
  for (let k = 0; k < bounds.length - 1; k++) {
    const chunk = buf.subarray(bounds[k], bounds[k + 1])
    const cand = pending === undefined ? chunk : Buffer.concat([pending, chunk])
    try { parts.push(zstdDecompressSync(cand)); pending = undefined } catch { pending = cand }
  }
  if (pending !== undefined) parts.push(zstdDecompressSync(pending))
  return Buffer.concat(parts)
}
const text = decompressAll(readFileSync(file)).toString('utf8')
const lines = text.split('\n').filter(Boolean)
let lastMsg = null
for (const l of lines) {
  let o
  try { o = JSON.parse(l) } catch { continue }
  if (o.type === 'assistant/message' && o.data && o.data.message) lastMsg = o
}
if (!lastMsg) { console.log('NONE'); process.exit(1) }
for (const c of lastMsg.data.message.content) {
  if (c.type === 'text') console.log('TEXT:\n' + c.text)
}
