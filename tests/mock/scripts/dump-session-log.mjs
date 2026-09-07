/**
 * dump-session-log.mjs (tests/mock run) — dump a session.jsonl.zstd:
 * line kinds, permission presets, the "Current DSH file policy" prompt line,
 * model provider/model, and the first N model-request tools arrays.
 * Usage: node dump-session-log.mjs <path-to-session.jsonl.zstd>
 * (Extended from dev/agent-workflow/evidence/playwright-acceptance-v2/dump-session-log.mjs)
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
const policies = []
const models = []

const walkTools = (node, depth) => {
  if (depth > 6 || node === null || typeof node !== 'object') return
  if (Array.isArray(node.tools)) {
    const names = node.tools.map((t) => (t && (t.function ? t.function.name : t.name)) ?? '?')
    if (names.length && toolArrays.length < 8) toolArrays.push(names)
    return
  }
  for (const v of Object.values(node)) walkTools(v, depth + 1)
}

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
  walkTools(o, 0)
}

// Text-level scans (prompt sections, provider ids) over the whole file.
for (const pat of [
  /Current DSH file policy: ([a-z-]+)/g,
  /provider(?:Id)?["'=:\s]+([a-z0-9-]+)/g,
]) {
  let m
  while ((m = pat.exec(text)) !== null) {
    if (pat.source.includes('file policy')) {
      if (!policies.includes(m[1])) policies.push(m[1])
    } else {
      models.push(m[1])
    }
  }
}

console.log('FILE:', file)
console.log('LINES:', lines.length)
console.log('KINDS:', JSON.stringify(kinds))
if (presets.length) console.log('PRESETS:', JSON.stringify([...new Set(presets)]))
if (policies.length) console.log('FILE_POLICY:', JSON.stringify([...new Set(policies)]))
const modelFreq = {}
for (const m of models) modelFreq[m] = (modelFreq[m] || 0) + 1
console.log('PROVIDER_HITS:', JSON.stringify(modelFreq))
toolArrays.forEach((names, i) => {
  const team = names.filter((n) => String(n).startsWith('team_'))
  const mcp = names.filter((n) => String(n).startsWith('mcp__'))
  console.log(`TOOLS[${i}] count=${names.length} team_*=${team.length} mcp__*=${mcp.length}`)
  console.log('  ', names.join(', '))
})
if (toolArrays.length === 0) console.log('TOOLS: none found in log')
