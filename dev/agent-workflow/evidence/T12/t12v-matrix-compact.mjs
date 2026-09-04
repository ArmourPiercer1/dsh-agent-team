// Read-only: compact per-assertion matrix from a t12v-summary json (names truncated to 96 chars)
import { readFileSync } from 'node:fs'
const p = process.argv[2]
const j = JSON.parse(readFileSync(p, 'utf8'))
const out = []
out.push(`nonce=${j.nonce ?? '?'} phases=${(j.phases ?? []).join(',')}`)
for (const [key, s] of Object.entries(j.scenarios ?? {})) {
  if (!s || typeof s !== 'object' || !Array.isArray(s.assertions)) continue
  const ok = s.assertions.filter((a) => a.ok).length
  out.push(`\n=== ${key} :: ${s.criterion ?? ''} :: pass=${s.pass} ${ok}/${s.assertions.length} :: ${Math.round(s.durationMs)} ms${s.error ? ' :: ERROR: ' + String(s.error).slice(0, 120) : ''}`)
  for (const a of s.assertions) {
    out.push(`  [${a.ok ? 'OK ' : 'FAIL'}] ${String(a.name ?? '').slice(0, 96)}`)
  }
}
console.log(out.join('\n'))
