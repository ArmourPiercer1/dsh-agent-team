#!/usr/bin/env node
// check-scenarios.mjs — verifies SCENARIOS.md cites REAL registered leg identities.
//
// A citation is a backticked span of the form `packages/<...>.test.ts > <describe> > <title>`
// (single- or double-backtick delimited; double where the real title itself contains backticks).
// A span whose last segment ends in "…" (the document's truncation marker) is matched as a PREFIX;
// anything else must match the vitest JSON registry VERBATIM.
// Shorthand citations (`… > <title>` / `> <title>`, used where a row already named the file) are
// checked against the final segment of every registered identity.
// Finally: every literal "packages/….test.ts > " occurrence in the document must sit inside a
// parsed citation, so a span broken by nested backticks is reported instead of silently skipped.
//
// Registry: scratch/registered-legs-before.tsv — file \t describe \t title \t status \t fullName
// (the product of `pnpm exec vitest run --reporter=json --outputFile.json=…` on this tree).
// Exit 0 only when every citation resolves.

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const EV = join(dirname(fileURLToPath(import.meta.url)), '..')
// The index writer quoted 49 of the 6277 fullName fields (titles containing commas/quotes were
// emitted as CSV-quoted cells inside a TSV). Unquoting restores the exact vitest title.
const unq = (v) => (v.startsWith('"') && v.endsWith('"') ? v.slice(1, -1).replace(/""/g, '"') : v)
const doc = readFileSync(join(EV, 'SCENARIOS.md'), 'utf8')
const rows = readFileSync(join(EV, 'scratch/registered-legs-before.tsv'), 'utf8')
  .split(/\r?\n/)
  .filter(Boolean)
  .map((l) => l.split('\t').map((c) => unq(c.replace(/\r$/, ''))))
  .filter((p) => p.length >= 5)

const registry = new Map()
for (const [path, , , status, full] of rows) registry.set(`${path} > ${full}`, status)
const keys = [...registry.keys()]

const lineOf = (index) => doc.slice(0, index).split('\n').length
const cites = []
const spans = []
for (const re of [/``([^\n]*?)``/g, /(?<!`)`([^`\n]+)`(?!`)/g]) {
  let m
  while ((m = re.exec(doc))) {
    const raw = m[1]
    if (!raw.includes(' > ')) continue
    const isFull = raw.startsWith('packages/')
    const isShort = /^[…>]/.test(raw.trim())
    if (!isFull && !isShort) continue
    cites.push({ raw, line: lineOf(m.index), full: isFull })
    spans.push([m.index, m.index + m[0].length])
  }
}
const inCitation = (index) => spans.some(([a, b]) => index >= a && index < b)

const problems = []
const ok = []
const shortOk = []
for (const { raw, line, full } of cites) {
  if (full) {
    const prefix = raw.endsWith('…')
    const needle = prefix ? raw.slice(0, -1).replace(/\s+$/, '') : raw
    const hits = keys.filter((k) => (prefix ? k.startsWith(needle) : k === needle))
    if (hits.length === 1) ok.push({ line, id: hits[0], status: registry.get(hits[0]) })
    else if (hits.length === 0) problems.push({ line, raw, why: 'NOT REGISTERED' })
    else problems.push({ line, raw, why: `AMBIGUOUS (${hits.length} legs match)`, hits })
    continue
  }
  const parts = raw.replace(/^…\s*/, '').replace(/^>\s*/, '').split(' > ').map((s) => s.trim())
  const tail = parts[parts.length - 1]
  const truncated = tail.endsWith('…')
  const needle = truncated ? tail.slice(0, -1).replace(/\s+$/, '') : tail
  const hits = keys.filter((k) => {
    const last = k.slice(k.lastIndexOf(' > ') + 3)
    return truncated ? last.startsWith(needle) : last === needle
  })
  if (hits.length >= 1) shortOk.push({ line, id: hits[0], n: hits.length })
  else problems.push({ line, raw, why: 'NOT REGISTERED (shorthand)' })
}

// Integrity pass: no citation may be silently unparseable.
for (const m of doc.matchAll(/packages\/\S+\.test\.ts > /g)) {
  if (!inCitation(m.index)) problems.push({ line: lineOf(m.index), raw: m[0], why: 'UNPARSEABLE citation (nested backticks?)' })
}

const reds = ok.filter((o) => o.status !== 'passed')
console.log(`citations checked: ${cites.filter((c) => c.full).length} full-path + ${cites.length - cites.filter((c) => c.full).length} shorthand`)
console.log(`resolved: ${ok.length + shortOk.length} (full-path ${ok.length}, shorthand ${shortOk.length})`)
console.log(`resolved full-path legs that are NOT passing at this base: ${reds.length}`)
for (const r of reds) console.log(`  NOT-PASSED [${r.status}] L${r.line}: ${r.id}`)
if (problems.length) {
  console.log(`\nPROBLEMS (${problems.length}):`)
  for (const p of problems) {
    console.log(`  L${p.line}: ${p.why}\n    cited: ${p.raw}`)
    for (const h of (p.hits ?? []).slice(0, 4)) console.log(`      candidate: ${h}`)
  }
  process.exit(1)
}
console.log('\nEvery cited identity resolves to a registered leg.')
