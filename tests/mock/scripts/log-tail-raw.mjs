// Print the last N raw event lines (kind/seq/when + truncated payload) from a multi-frame zstd session log.
// Usage: node log-tail-raw.mjs <session.jsonl.zstd> [n]
import { readFileSync } from 'node:fs'
import { zstdDecompressSync } from 'node:zlib'

const file = process.argv[2]
const n = Number(process.argv[3] ?? 6)
if (!file) { console.error('usage: node log-tail-raw.mjs <log> [n]'); process.exit(2) }

function decompressAll(buf) {
  const MAGIC = Buffer.from([0x28, 0xb5, 0x2f, 0xfd])
  const starts = []
  let off = 0
  for (;;) {
    const i = buf.indexOf(MAGIC, off)
    if (i === -1) break
    starts.push(i)
    off = i + 4
  }
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
for (const l of lines.slice(-n)) {
  let o
  try { o = JSON.parse(l) } catch { console.log('RAW(non-json):', l.slice(0, 160)); continue }
  const k = o.type ?? o.kind ?? '?'
  const seq = o.seq ?? (o.data && o.data.seq) ?? '?'
  const when = o.when ?? (o.data && o.data.createdAt) ?? (o.data && o.data.at) ?? ''
  let payload = l
  try {
    const clone = JSON.parse(l)
    delete clone.seq; delete clone.when
    payload = JSON.stringify(clone)
  } catch { /* keep raw */ }
  console.log(`${k} seq=${seq} ${when} ${payload.slice(0, 260)}`)
}
