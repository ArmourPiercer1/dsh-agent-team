// T12-V15: window-latch correlation for one run.
// Parses: (1) instance [t12v-wl] glue lines, (2) durable session.jsonl.zstd
// record timestamps, (3) mock capture receivedAt. Emits a per-child-session
// timeline so the silence window owner can be pinned (row glue vs core).
// Usage: node t12v-run13-correlate.mjs <evidenceDir> <homeADir>
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { zstdDecompressSync } from 'node:zlib'

const [evDir, homeA] = process.argv.slice(2, 4)

// ── 1. glue lines ─────────────────────────────────────────────────────────
function glueLines(label) {
  const p = join(evDir, 'instances', label, `instance-port${PORTS[label]}.log`)
  if (!existsSync(p)) return []
  const out = []
  for (const line of readFileSync(p, 'utf8').split('\n')) {
    const m = line.match(/^\[t12v-wl\] (\S+) (\S+) sid=(\S+)(?: (.*))?$/)
    if (m) out.push({ ts: Date.parse(m[1]), iso: m[1], event: m[2], sid: m[3], extra: m[4] ?? '' })
  }
  return out
}
const PORTS = { A1: '3181', A2: '3182', B1: '3183', C1: '3184' }

const a1 = glueLines('A1')
const a2 = glueLines('A2')
console.log(`glue lines: A1=${a1.length} A2=${a2.length}`)

// ── 2. session logs (zstd) ───────────────────────────────────────────────
function findSessionLogs(root) {
  const found = []
  if (!existsSync(root)) return found
  const walk = (dir) => {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const p = join(dir, e.name)
      if (e.isDirectory()) walk(p)
      else if (e.name.endsWith('.jsonl.zstd')) found.push(p)
    }
  }
  walk(root)
  return found
}
function sessionRecords(p) {
  // Durable session.jsonl.zstd files are CONCATENATED zstd frames (one per
  // record, magic 28 B5 2F FD); zstdDecompressSync decodes only the first
  // frame, so scan magic positions and decode each sub-frame separately.
  const buf = readFileSync(p)
  const isMagic = (i) => buf[i] === 0x28 && buf[i + 1] === 0xb5 && buf[i + 2] === 0x2f && buf[i + 3] === 0xfd
  const frames = []
  let pos = 0
  while (pos + 4 <= buf.length && !isMagic(pos)) pos++
  while (pos + 4 <= buf.length) {
    let next = buf.length
    for (let i = pos + 4; i + 4 <= buf.length; i++) {
      if (isMagic(i)) { next = i; break }
    }
    try { frames.push(zstdDecompressSync(buf.subarray(pos, next))) } catch { /* skip bad frame */ }
    pos = next
  }
  const out = []
  for (const fr of frames) {
    for (const line of fr.toString('utf8').split('\n')) {
      if (!line.trim()) continue
      try {
        const rec = JSON.parse(line)
        out.push(rec)
      } catch { /* skip */ }
    }
  }
  return out
}
const logs = findSessionLogs(homeA)
console.log(`\nsession logs under home-a: ${logs.length}`)
for (const p of logs) {
  const recs = sessionRecords(p)
  const name = p.split('session-')[1]?.split(/[\\/]/)[0] ?? p
  console.log(`\n== ${name} (${recs.length} records) ==`)
  for (const rec of recs) {
    const tsRaw = rec.ts ?? rec.timestamp ?? rec.at ?? rec.receivedAt ?? rec.time ?? ''
    const ts = typeof tsRaw === 'number' ? new Date(tsRaw).toISOString() : tsRaw
    const kind = rec.type ?? rec.kind ?? rec.event ?? '?'
    const detail = JSON.stringify(rec).slice(0, 140).replace(/\s+/g, ' ')
    console.log(`  ${ts} ${kind} ${detail}`)
  }
}

// ── 3. mock capture ──────────────────────────────────────────────────────
const capPath = join(evDir, 't12v-mock-capture.json')
if (existsSync(capPath)) {
  const cap = JSON.parse(readFileSync(capPath, 'utf8'))
  console.log(`\nmock capture: ${cap.totalRequests} requests`)
  for (const r of cap.requests ?? []) {
    const firstUser = JSON.stringify((r.messages ?? []).find((m) => m.role === 'user')?.content ?? '').slice(0, 70)
    console.log(`  req${r.seq} ${r.receivedAt} model=${r.model} tools=${(r.tools ?? []).length} ${firstUser}`)
  }
}

// ── 4. per-child glue timeline ───────────────────────────────────────────
console.log('\n== glue timeline (A1 + A2, child & root lines) ==')
const all = [...a1.map((l) => ({ ...l, inst: 'A1' })), ...a2.map((l) => ({ ...l, inst: 'A2' }))]
all.sort((x, y) => x.ts - y.ts)
let prev = 0
for (const l of all) {
  const gap = l.ts - prev
  prev = l.ts
  const flag = gap > 5000 ? `  <<<<< GAP ${Math.round(gap / 1000)}s` : ''
  console.log(`${l.iso} [${l.inst}] ${l.event} ${l.sid} ${l.extra}${flag}`)
}
