// Full-tree double-capture comparator (GLUE-7 round).
// Usage: node compare-redsets.mjs <capture1.log> <capture2.log>
// Prints totals, the per-test red set of each run, and whether the two sets
// are identical, plus identity against the published red-9 baseline
// (p6t3-mediation x5, p6t3-restart x2, p6t6 x1, t2 x1).
import { readFileSync } from 'node:fs'

const [f1, f2] = process.argv.slice(2)
if (!f1 || !f2) { console.log('usage: compare-redsets.mjs <log1> <log2>'); process.exit(1) }
const parse = (f) => {
  const s = readFileSync(f, 'utf8')
  const totals = {
    files: /Test Files\s+(\d+) failed \| (\d+) passed \((\d+)\)/.exec(s)?.slice(1).map(Number) ?? null,
    tests: /Tests\s+(\d+) failed \| (\d+) passed \((\d+)\)/.exec(s)?.slice(1).map(Number) ?? null,
  }
  const red = new Set()
  // vitest lists failing tests as: FAIL <file> > <suite path…> > <test name>
  for (const m of s.matchAll(/FAIL\s+(\S+\.test\.\w+)\s+>\s+(.+)/g)) {
    red.add((m[1] ?? '').trim() + ' > ' + (m[2] ?? '').trim().replace(/\s+\d+ms$/, ''))
  }
  return { totals, red }
}
const a = parse(f1)
const b = parse(f2)
const PUBLISHED = [
  'packages/runtime/test/p6t3-mediation.test.ts',
  'packages/runtime/test/p6t3-mediation.test.ts',
  'packages/runtime/test/p6t3-mediation.test.ts',
  'packages/runtime/test/p6t3-mediation.test.ts',
  'packages/runtime/test/p6t3-mediation.test.ts',
  'packages/runtime/test/p6t3-restart.test.ts',
  'packages/runtime/test/p6t3-restart.test.ts',
  'packages/tools/test/p6t6-actions.test.ts',
  'packages/domain/test/t2-blueprint-hash.test.ts',
]
const fileCount = (r) => {
  const m = new Map()
  for (const x of r) { const f = x.split(' > ')[0]; m.set(f, (m.get(f) ?? 0) + 1) }
  return m
}
const fa = fileCount(a.red)
const pub = new Map()
for (const p of PUBLISHED) pub.set(p, (pub.get(p) ?? 0) + 1)
let idOk = fa.size === pub.size
for (const [k, v] of pub) if (fa.get(k) !== v) idOk = false
for (const [k, v] of fa) if (pub.get(k) !== v) idOk = false
const extra = [...a.red].filter((x) => ![...pub.keys()].includes(x.split(' > ')[0]))
console.log('run1 totals files=' + JSON.stringify(a.totals.files) + ' tests=' + JSON.stringify(a.totals.tests))
console.log('run2 totals files=' + JSON.stringify(b.totals.files) + ' tests=' + JSON.stringify(b.totals.tests))
console.log('run1 red legs=' + a.red.size + ' run2 red legs=' + b.red.size)
console.log('double-capture red sets identical: ' + (a.red.size === b.red.size && [...a.red].every((x) => b.red.has(x))))
console.log('red-file counts run1: ' + JSON.stringify(Object.fromEntries(fa)))
console.log('identity with published 9 (file x leg-count): ' + idOk)
if (extra.length > 0) { console.log('EXTRA red (outside published 9):'); for (const x of extra.slice(0, 12)) console.log('  ' + x.slice(0, 150)) }
