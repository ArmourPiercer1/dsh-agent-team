#!/usr/bin/env node
// client-diff.mjs <before.txt> <after.txt> — client-lane comparison as TEST-NAME SETS.
// Compares (file, full test name) identity sets and the failed-name sets, never counts alone.
import { readFileSync } from 'node:fs'

const [a, b] = process.argv.slice(2)
const load = (p) =>
  readFileSync(p, 'utf8')
    .split('\n')
    .filter(Boolean)
    .map((l) => {
      const [file, full, status] = l.split('::')
      return { file, full, status, key: `${file}::${full}` }
    })
const before = load(a)
const after = load(b)
const byKey = (rows) => new Map(rows.map((r) => [r.key, r]))
const bKey = byKey(before)
const aKey = byKey(after)

const added = [...aKey.keys()].filter((k) => !bKey.has(k))
const removed = [...bKey.keys()].filter((k) => !aKey.has(k))
const red = (rows) => new Set(rows.filter((r) => r.status === 'failed').map((r) => r.key))
const redBefore = red(before)
const redAfter = red(after)
const newReds = [...redAfter].filter((k) => !redBefore.has(k))
const fixedReds = [...redBefore].filter((k) => !redAfter.has(k))
const flipped = [...aKey.keys()].filter((k) => {
  const x = bKey.get(k)
  const y = aKey.get(k)
  return x && y && x.status !== y.status && x.status !== 'failed' && y.status !== 'failed'
})
const filesBefore = new Set(before.map((r) => r.file))
const filesAfter = new Set(after.map((r) => r.file))

console.log(`before: ${before.length} legs in ${filesBefore.size} files | after: ${after.length} legs in ${filesAfter.size} files`)
console.log(`name set identical: ${added.length === 0 && removed.length === 0}`)
for (const k of added) console.log(`  + leg only in AFTER : ${k}`)
for (const k of removed) console.log(`  - leg only in BEFORE: ${k}`)
console.log(`failed BEFORE: ${redBefore.size} | failed AFTER: ${redAfter.size}`)
console.log(`NEW reds : ${newReds.length}`)
for (const k of newReds) console.log(`  NEW RED ${k}`)
console.log(`FIXED reds: ${fixedReds.length}`)
for (const k of fixedReds) console.log(`  FIXED ${k}`)
console.log(`other status transitions (non-red): ${flipped.length}`)
for (const k of flipped) console.log(`  ${bKey.get(k).status} -> ${aKey.get(k).status}: ${k}`)
console.log(`files only before: ${[...filesBefore].filter((f) => !filesAfter.has(f)).join(', ') || '(none)'}`)
console.log(`files only after : ${[...filesAfter].filter((f) => !filesBefore.has(f)).join(', ') || '(none)'}`)
process.exit(newReds.length === 0 && added.length === 0 && removed.length === 0 ? 0 : 1)
