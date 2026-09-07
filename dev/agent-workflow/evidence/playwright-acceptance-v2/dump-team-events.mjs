/**
 * pw2 evidence helper: dump team_* tool/call + tool/result lines from a
 * session.jsonl.zstd (the D2 result wire shape + the calls issued).
 * Usage: node dump-team-events.mjs <path>
 */
import { readFileSync } from 'node:fs'
import { zstdDecompressSync } from 'node:zlib'

const file = process.argv[2]
if (!file) {
  console.error('usage: node dump-team-events.mjs <session.jsonl.zstd>')
  process.exit(2)
}

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
    try {
      parts.push(zstdDecompressSync(cand))
      pending = undefined
    } catch {
      pending = cand
    }
  }
  if (pending !== undefined) parts.push(zstdDecompressSync(pending))
  return Buffer.concat(parts)
}

const text = decompressAll(readFileSync(file)).toString('utf8')
const lines = text.split('\n').filter(Boolean)
for (const l of lines) {
  let o
  try {
    o = JSON.parse(l)
  } catch {
    continue
  }
  if (o.type === 'tool/call' || o.type === 'tool/result') {
    const d = o.data ?? o
    const name = d.name ?? d.toolName ?? (d.call && d.call.name) ?? '?'
    const args = d.args ?? d.input ?? (d.call && d.call.args) ?? null
    const result = d.result ?? d.output ?? d.value ?? null
    const isTeam = String(name).startsWith('team_')
    if (!isTeam) continue
    console.log(`=== seq=${o.seq} ${o.type} ${name}`)
    if (args !== null) console.log('  args: ' + JSON.stringify(args).slice(0, 600))
    if (result !== null) console.log('  result: ' + JSON.stringify(result).slice(0, 1500))
  }
  if (o.type === 'user/message') {
    const d = o.data ?? o
    const content = typeof d.content === 'string' ? d.content : JSON.stringify(d.content ?? d.text ?? '')
    if (content.includes('team-work') || content.includes('[team')) {
      console.log(`=== seq=${o.seq} user/message (member task envelope): ` + content.slice(0, 400))
    }
  }
  if (o.type === 'session/title') {
    console.log(`=== seq=${o.seq} session/title: ` + JSON.stringify(o.data).slice(0, 300))
  }
}
