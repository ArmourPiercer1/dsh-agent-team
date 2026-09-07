/**
 * pw2 evidence helper: dump a session.jsonl.zstd — line kinds + the first
 * model-request tools array (name list) found in the file.
 * Usage: node dump-session-log.mjs <path-to-session.jsonl.zstd>
 */
import { readFileSync } from 'node:fs'
import { zstdDecompressSync } from 'node:zlib'

const file = process.argv[2]
if (!file) {
  console.error('usage: node dump-session-log.mjs <session.jsonl.zstd>')
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
const kinds = {}
const toolArrays = []
const presets = []
for (const l of lines) {
  let o
  try {
    o = JSON.parse(l)
  } catch {
    continue
  }
  const k = o.type ?? o.kind ?? '?'
  kinds[k] = (kinds[k] || 0) + 1
  if (o.data && o.data.preset !== undefined) presets.push(o.data.preset)
  // locate tools arrays in parsed objects (any depth, shallow walk)
  const walk = (node, depth) => {
    if (depth > 6 || node === null || typeof node !== 'object') return
    if (Array.isArray(node.tools)) {
      const names = node.tools.map(t => (t && (t.function ? t.function.name : t.name)) ?? '?')
      if (names.length && toolArrays.length < 8) toolArrays.push(names)
      return
    }
    for (const v of Object.values(node)) walk(v, depth + 1)
  }
  walk(o, 0)
}
console.log('FILE:', file)
console.log('LINES:', lines.length)
console.log('KINDS:', JSON.stringify(kinds))
if (presets.length) console.log('PRESET:', JSON.stringify([...new Set(presets)]))
toolArrays.forEach((names, i) => {
  const team = names.filter(n => String(n).startsWith('team_'))
  console.log(`TOOLS[${i}] count=${names.length} team_*=${team.length}`)
  console.log('  ', names.join(', '))
})
if (toolArrays.length === 0) console.log('TOOLS: none found in log')
