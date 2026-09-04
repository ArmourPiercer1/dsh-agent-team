// t12v-logdump.mjs — read-only dump of a durable session log (multi-frame zstd).
// Usage: node t12v-logdump.mjs <dshHome> <sessionId> [maxPerLine]
import fs from 'node:fs'
import path from 'node:path'
import { zstdDecompressSync } from 'node:zlib'

const dshHome = process.argv[2]
const sessionId = process.argv[3]
const maxPerLine = Number(process.argv[4] ?? 220)
if (!dshHome || !sessionId) {
  console.error('usage: node t12v-logdump.mjs <dshHome> <sessionId> [maxPerLine]')
  process.exit(2)
}

function decompressZstdStream(buf) {
  const MAGIC = Buffer.from([0x28, 0xb5, 0x2f, 0xfd])
  const starts = []
  let off = 0
  for (;;) {
    const i = buf.indexOf(MAGIC, off)
    if (i === -1) break
    starts.push(i)
    off = i + 4
  }
  if (starts.length === 0) throw new Error('no zstd frame in stream')
  const bounds = [...starts, buf.length]
  const parts = []
  let pending = undefined
  for (let k = 0; k < bounds.length - 1; k++) {
    const chunk = buf.subarray(bounds[k], bounds[k + 1])
    const candidate = pending === undefined ? chunk : Buffer.concat([pending, chunk])
    try {
      parts.push(zstdDecompressSync(candidate))
      pending = undefined
    } catch {
      pending = candidate
    }
  }
  if (pending !== undefined) parts.push(zstdDecompressSync(pending))
  return Buffer.concat(parts)
}

function findFile(root, id) {
  const stack = [path.join(root, 'sessions')]
  while (stack.length > 0) {
    const dir = stack.pop()
    let entries
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true })
    } catch {
      continue
    }
    for (const e of entries) {
      const p = path.join(dir, e.name)
      if (e.isDirectory()) {
        if (e.name === sessionId) {
          const f = path.join(p, 'session.jsonl.zstd')
          if (fs.existsSync(f)) return f
        }
        stack.push(p)
      } else if (e.name === 'session.jsonl.zstd' && dir.endsWith(id)) {
        return p
      }
    }
  }
  return null
}

const file = findFile(dshHome, sessionId)
if (file === null) {
  console.error('session file not found for', sessionId)
  process.exit(3)
}
console.log('file:', file)
const text = decompressZstdStream(fs.readFileSync(file)).toString('utf8')
const lines = text.split('\n').filter((l) => l !== '')
console.log('lines:', lines.length)
lines.forEach((l, i) => {
  let summary
  try {
    const o = JSON.parse(l)
    const role = o.role ?? o.type ?? o.kind ?? '?'
    const content = typeof o.content === 'string' ? o.content : JSON.stringify(o.content) ?? ''
    const tc = Array.isArray(o.tool_calls) && o.tool_calls.length > 0
      ? ' tool_calls=[' + o.tool_calls.map((t) => t?.function?.name ?? t?.name ?? '?').join(',') + ']'
      : ''
    const tid = o.tool_call_id ? ' tool_call_id=' + o.tool_call_id : ''
    summary = '[' + i + '] ' + role + tc + tid + ' :: ' + String(content).slice(0, maxPerLine)
  } catch {
    summary = '[' + i + '] RAW :: ' + l.slice(0, maxPerLine)
  }
  console.log(summary)
})
