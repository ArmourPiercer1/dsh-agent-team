// t12v-session-timeline.mjs <dshHome> <sessionId> [maxLines]
// Prints each session-log record: index, timestamp(s), type, and a truncated
// content view — for diagnosing turn-start latency. Self-contained: walks
// multi-frame zstd with node:zlib.
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { zstdDecompressSync } from 'node:zlib'

const [, , dshHome, sessionId, maxLinesRaw] = process.argv
if (!dshHome || !sessionId) {
  console.error('usage: node t12v-session-timeline.mjs <dshHome> <sessionId> [maxLines]')
  process.exit(2)
}
const maxLines = maxLinesRaw === undefined ? Infinity : Number(maxLinesRaw)

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    const st = statSync(p)
    if (st.isDirectory()) walk(p, out)
    else if (p.endsWith('session.jsonl.zstd')) out.push(p)
  }
  return out
}
const candidates = walk(join(dshHome, 'sessions'))
const file = candidates.find((f) => f.includes(`\\${sessionId}\\`) || f.includes(`/${sessionId}/`))
if (file === undefined) {
  console.error('session file not found for', sessionId)
  console.error('candidates:', candidates.join(' | '))
  process.exit(3)
}

// multi-frame zstd: each materialized append is a NEW zstd frame without a
// content size; node:zlib's zstdDecompressSync only decodes the FIRST frame.
// Walk frame starts by magic, use them as segment bounds, carry the pending
// partial across segments (a frame whose bytes contain a magic sequence
// straddles a boundary). Verbatim algorithm of the T12 runner.
const MAGIC = Buffer.from([0x28, 0xb5, 0x2f, 0xfd])
const raw = readFileSync(file)
const starts = []
{
  let off = 0
  for (;;) {
    const i = raw.indexOf(MAGIC, off)
    if (i === -1) break
    starts.push(i)
    off = i + 4
  }
}
const bounds = [...starts, raw.length]
const parts = []
let pending = undefined
for (let k = 0; k < bounds.length - 1; k++) {
  const chunk = raw.subarray(bounds[k], bounds[k + 1])
  const candidate = pending === undefined ? chunk : Buffer.concat([pending, chunk])
  try {
    parts.push(zstdDecompressSync(candidate))
    pending = undefined
  } catch {
    pending = candidate
  }
}
if (pending !== undefined) parts.push(zstdDecompressSync(pending))
const text = Buffer.concat(parts).toString('utf8')
const lines = text.split('\n').filter((l) => l.length > 0)
console.log(`file: ${file}`)
console.log(`records: ${lines.length}`)
for (let i = 0; i < lines.length && i < maxLines; i++) {
  let rec
  try { rec = JSON.parse(lines[i]) } catch { console.log(`[${i}] <unparsed> ${lines[i].slice(0, 200)}`); continue }
  const ts = rec.ts ?? rec.timestamp ?? rec.time ?? rec.createdAt ?? rec.at ?? ''
  const type = rec.type ?? rec.event ?? rec.kind ?? ''
  let view = ''
  try {
    const { ts: _t, timestamp: _ts, time: _ti, createdAt: _c, at: _a, type: _ty, ...rest } = rec
    view = JSON.stringify(rest)
  } catch { view = String(rec) }
  console.log(`[${i}] ${ts} ${type} :: ${view.slice(0, 320)}`)
}
