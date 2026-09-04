// scratch: print raw JSON of first turn/start + first user/message records
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { zstdDecompressSync } from 'node:zlib'

const home = process.argv[2]
const sid = process.argv[3]
const dir = join(home, 'sessions', '--C-agent-team-work-t12v-child-a--', sid)
const raw = readFileSync(join(dir, 'session.jsonl.zstd'))
// verbatim magic-boundary walk (same as runner)
const MAGIC = [0x28, 0xb5, 0x2f, 0xfd]
function startsOf(buf) {
  const out = []
  for (let i = 0; i + 4 <= buf.length; i++) {
    if (buf[i] === MAGIC[0] && buf[i + 1] === MAGIC[1] && buf[i + 2] === MAGIC[2] && buf[i + 3] === MAGIC[3]) out.push(i)
  }
  return out
}
const starts = startsOf(raw)
const bounds = [...starts, raw.length]
const parts = []
let pending = undefined
for (let b = 0; b < bounds.length - 1; b++) {
  const candidate = Buffer.from(raw.subarray(bounds[b], bounds[b + 1]))
  const next = b + 1
  try {
    parts.push(zstdDecompressSync(candidate))
  } catch {
    pending = Buffer.concat(pending === undefined ? [candidate] : [pending, candidate])
    if (next === bounds.length - 1) { try { parts.push(zstdDecompressSync(pending)) } catch { /* keep pending */ } }
    else { pending = undefined; /* retry next segment start */ }
  }
}
if (pending !== undefined) { try { parts.push(zstdDecompressSync(pending)) } catch { /* ignore */ } }
const text = Buffer.concat(parts).toString('utf8')
const lines = text.split('\n').filter((l) => l.trim() !== '')
const recs = lines.map((l) => { try { return JSON.parse(l) } catch { return null } }).filter(Boolean)
const firstTurn = recs.find((r) => r.type === 'turn/start')
const firstUser = recs.find((r) => r.type === 'user/message')
console.log('firstTurn raw:', firstTurn ? JSON.stringify(firstTurn).slice(0, 400) : null)
console.log('firstUser raw:', firstUser ? JSON.stringify(firstUser).slice(0, 400) : null)
