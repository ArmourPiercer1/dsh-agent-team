// Print the LAST model-request tools array (name list) found in a session log.
import { readFileSync } from 'node:fs'
import { zstdDecompressSync } from 'node:zlib'

const file = process.argv[2]
if (!file) { console.error('usage: node last-tools.mjs <log>'); process.exit(2) }

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
let last = null
let lastSeq = -1
for (const l of lines) {
  let o
  try { o = JSON.parse(l) } catch { continue }
  const seq = o.seq ?? -1
  const arr = findTools(o)
  if (arr && arr.length && seq >= lastSeq) { last = arr; lastSeq = seq }
}
function findTools(node, depth = 0) {
  if (depth > 6 || node === null || typeof node !== 'object') return null
  if (Array.isArray(node.tools) && node.tools.length) return node.tools
  for (const v of Object.values(node)) {
    const r = findTools(v, depth + 1)
    if (r) return r
  }
  return null
}
if (!last) { console.log('NO TOOLS FOUND'); process.exit(1) }
const names = last.map(t => (t && (t.function ? t.function.name : t.name)) ?? '?')
const team = names.filter(n => String(n).startsWith('team_'))
const mcp = names.filter(n => String(n).startsWith('mcp__'))
console.log('LAST-TOOLS seq=', lastSeq, 'count=', names.length, 'team_*=', team.length, 'mcp__*=', mcp.length)
console.log('team:', team.join(','))
console.log('mcp:', mcp.join(','))
