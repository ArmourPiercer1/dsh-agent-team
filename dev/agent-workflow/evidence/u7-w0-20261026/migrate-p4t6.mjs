#!/usr/bin/env node
/**
 * u7-w0 one-shot migration: lift every in-file `SCANNED_PATHS_<LANE>` list of
 * packages/testkit/test/p4t6-session-event-scan.test.ts (as of origin/master
 * 88107ad71) into packages/testkit/test/p4t6-bookings/<lane>.json.
 *
 * VERBATIM: the path strings, the inline per-path notes, the comment block that
 * preceded each list (→ `reason`), and the comment block that preceded each list's
 * tie (→ `tieNote`) are copied as text; the tie arithmetic `to - from` is parsed
 * out of the source expression, never retyped. Kept as evidence so the migration
 * is re-derivable: `node migrate-p4t6.mjs <old-test-file> <out-dir> [--check]`.
 * With --check it writes nothing and diffs against the committed bookings.
 */
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const [src, outDir, flag] = process.argv.slice(2)
if (src === undefined || outDir === undefined) {
  console.error('usage: migrate-p4t6.mjs <old p4t6 test file> <out dir> [--check]')
  process.exit(2)
}
const lines = readFileSync(src, 'utf8').split('\n')
// The in-body history prose (the 958 → 983 lineage) stays in the test file; the
// first in-body list's own comment starts after it (measured at 88107ad71: the
// "A4-PR2 (lane A/B/C)" paragraph).
const IN_BODY_FLOOR = lines.findIndex((l) => l.includes('// A4-PR2 (lane A/B/C): one production module plus its three specs.'))
if (IN_BODY_FLOOR < 0) throw new Error('in-body floor marker not found — source is not the 88107ad71 shape')

const DECL = /^\s*const (SCANNED_PATHS_(\w+)|RETIRED_PATHS_U6PR6): readonly string\[\] = \[\s*$/
const lists = []
let prevEnd = -1
let gluedLead = []
for (let i = 0; i < lines.length; i += 1) {
  const m = DECL.exec(lines[i])
  if (m === null) continue
  let j = i + 1
  const paths = []
  const pathNotes = {}
  const listNotes = []
  // one closer at 88107ad71 carries the NEXT list's first comment line glued
  // to it (`]    // A4-PR2: ...`); that text is collected into gluedLead and
  // prepended to the following list's reason.
  for (; !/^\s*\];?\s*(?:\/\/.*)?$/.test(lines[j]); j += 1) {
    const t = lines[j].trim()
    const pm = /^'([^']+)',\s*(?:\/\/\s?(.*))?$/.exec(t)
    if (pm !== null) {
      paths.push(pm[1])
      if (pm[2] !== undefined) pathNotes[pm[1]] = pm[2]
    } else if (t.startsWith('//')) {
      listNotes.push(t.replace(/^\/\/\s?/, ''))
    } else if (t !== '') {
      throw new Error(`unparsed list line ${String(j + 1)}: ${t}`)
    }
  }
  // preceding contiguous `//` block, bounded by the previous list's end and the floor
  const floor = Math.max(prevEnd, i > IN_BODY_FLOOR ? IN_BODY_FLOOR - 1 : -1)
  let k = i - 1
  while (k > floor && lines[k].trim().startsWith('//')) k -= 1
  const reason = [...gluedLead, ...lines.slice(k + 1, i).map((l) => l.trim().replace(/^\/\/\s?/, ''))]
  const glued = /^\s*\];?\s*\/\/\s?(.*)$/.exec(lines[j])
  gluedLead = glued === null ? [] : [glued[1]]
  lists.push({ name: m[1], lane: m[2] ?? 'RETIRED_U6PR6', declLine: i + 1, paths, pathNotes, listNotes, reason })
  prevEnd = j
  i = j
}

// ties: expect(SCANNED_PATHS_X.length).toBe(<expr>)
const TIE = /^\s*expect\(SCANNED_PATHS_(\w+)\.length\)\.toBe\((.*)\)\s*(?:\/\/\s?(.*))?$/
const ties = new Map()
for (let i = 0; i < lines.length; i += 1) {
  const m = TIE.exec(lines[i])
  if (m === null) continue
  let k = i - 1
  while (k >= 0 && lines[k].trim().startsWith('//')) k -= 1
  const note = lines.slice(k + 1, i).map((l) => l.trim().replace(/^\/\/\s?/, ''))
  const expr = m[2].trim()
  let tie
  const plain = /^(\d+) - (\d+)$/.exec(expr)
  const minusRetired = /^(\d+) - (\d+) - RETIRED_PATHS_U6PR6\.filter\(\(p\) => p\.endsWith\('([^']+)'\)\)\.length$/.exec(expr)
  if (plain !== null) tie = { from: Number(plain[2]), to: Number(plain[1]) }
  else if (minusRetired !== null) tie = { from: Number(minusRetired[2]), to: Number(minusRetired[1]), retiredSuffix: minusRetired[3] }
  else if (expr === 'RETIRED_PATHS_U6PR6.length') tie = { netNeutralWithRetired: true }
  else throw new Error(`unparsed tie at ${String(i + 1)}: ${expr}`)
  const prev = ties.get(m[1])
  if (prev !== undefined) {
    // the A5SRGP tie is written twice at 88107ad71; identical arithmetic is one tie
    if (JSON.stringify(prev.tie) !== JSON.stringify(tie)) throw new Error(`conflicting ties for ${m[1]}`)
    prev.duplicateTieLines.push(i + 1)
    continue
  }
  ties.set(m[1], { tie, note, inlineNote: m[3] ?? null, line: i + 1, duplicateTieLines: [] })
}

// Prose-only ties at 88107ad71: these paragraphs describe a lane's tie but no
// `expect(...)` line follows them; they sat inside the comment block above the
// A476GAPS tie. Split out by their opening sentence and returned to their lane.
const ORPHAN_TIE_PROSE = [
  { lane: 'A474FAILCLOSED', start: 'The A4-PR7 Task 7.4 fail-closed tie' },
  { lane: 'A4P76PIN', start: 'The A4-PR7 Task 7.6 ceiling-pin tie' },
]
const orphanNotes = new Map()
for (const [lane, t] of ties) {
  const starts = ORPHAN_TIE_PROSE.map((o) => ({ ...o, at: t.note.findIndex((l) => l.startsWith(o.start)) })).filter((o) => o.at >= 0).sort((a, b) => a.at - b.at)
  if (starts.length === 0) continue
  // each orphan runs to the next orphan start, or to the next paragraph that
  // opens with "The " (the owning tie's own prose)
  const cuts = []
  for (let n = 0; n < starts.length; n += 1) {
    let end = starts[n + 1]?.at ?? t.note.length
    for (let q = starts[n].at + 1; q < end; q += 1) if (/^The /.test(t.note[q])) { end = q; break }
    cuts.push([starts[n].at, end, starts[n].lane])
  }
  for (const [a, b, owner] of cuts) orphanNotes.set(owner, t.note.slice(a, b))
  t.note = t.note.filter((_, idx) => !cuts.some(([a, b]) => idx >= a && idx < b))
  void lane
}
// The sum site's leading comment (immediately above `expect(scanResult.filesScanned)`)
// describes the int-r3 KIT driver booking; it returns to that lane's reason.
const sumAt = lines.findIndex((l) => /^\s*expect\(scanResult\.filesScanned\)\.toBe\($/.test(l))
let sk = sumAt - 1
while (sk >= 0 && lines[sk].trim().startsWith('//')) sk -= 1
const sumSiteProse = lines.slice(sk + 1, sumAt).map((l) => l.trim().replace(/^\/\/\s?/, ''))
// A4-PR0 / A4-PR1 are the two lists the 983 base already counts (they are in the
// presence loop, NOT in the derived sum); every other list is summed on top of it.
const IN_BASE = new Set(['A4PR0', 'A4PR1'])

const retired = lists.find((l) => l.name === 'RETIRED_PATHS_U6PR6')
const bookings = lists.filter((l) => l.name !== 'RETIRED_PATHS_U6PR6')
const out = {}
for (const b of bookings) {
  const t = ties.get(b.lane) ?? null
  const booking = {
    schema: 'p4t6-booking/1',
    lane: b.lane,
    paths: b.paths,
    expectedDelta: null,
    reason: b.reason.join('\n'),
  }
  if (IN_BASE.has(b.lane)) booking.countedInBase = true
  if (b.lane === 'A5INTR3_KIT') booking.reason = [...b.reason, ...sumSiteProse].join('\n')
  if (booking.reason.trim() === '') booking.reason = '(no comment preceded this list at 88107ad71; the lane prose lives in tieNote)'
  if (Object.keys(b.pathNotes).length > 0) booking.pathNotes = b.pathNotes
  if (b.listNotes.length > 0) booking.listNotes = b.listNotes.join('\n')
  if (t !== null) {
    if (t.tie.netNeutralWithRetired === true) {
      booking.expectedDelta = { netNeutral: true }
      booking.retires = retired.paths
      booking.retiresNotes = retired.pathNotes
      booking.retiresReason = retired.reason.join('\n')
    } else {
      booking.expectedDelta = { from: t.tie.from, to: t.tie.to }
      if (t.tie.retiredSuffix !== undefined) {
        const gone = retired.paths.filter((p) => p.endsWith(t.tie.retiredSuffix))
        if (gone.length !== 1) throw new Error(`retired suffix ${t.tie.retiredSuffix} resolves to ${String(gone.length)} paths`)
        booking.retiredLater = gone
      }
    }
    booking.tieNote = [...t.note, ...(t.inlineNote !== null ? [t.inlineNote] : [])].join('\n')
    // the two int-r3 ties sit under ONE comment at 88107ad71 (it precedes the first)
    if (booking.tieNote.trim() === '') booking.tieNote = '(this tie shared the comment above the preceding tie at 88107ad71 — see a5intr3.json tieNote)'
  } else if (orphanNotes.has(b.lane)) {
    booking.tieNote = ['PROSE-ONLY TIE at 88107ad71 (the paragraph below had no `expect(...)` line; the lane is still counted in the exact total and every path asserted present):', ...orphanNotes.get(b.lane)].join('\n')
  } else if (IN_BASE.has(b.lane)) {
    booking.tieNote = b.lane === 'A4PR1'
      ? 'Counted INSIDE the 983 base (the 978 -> 983 movement in the base lineage comment of the test file). Tie at 88107ad71: `expect(SCANNED_PATHS_A4PR1.length).toBe(983 - 978)` — kept as expectedDelta.'
      : 'Counted INSIDE the 983 base (the 968 -> 971 and 973 -> 978 movements in the base lineage comment of the test file); asserted present by path, never summed on top of the base.'
  } else {
    booking.tieNote = 'NO TIE at 88107ad71: this list carried no `expect(<list>.length).toBe(to - from)` line in the pre-migration file; it is still counted in the exact total and every path is still asserted present.'
  }
  booking.migratedFrom = `packages/testkit/test/p4t6-session-event-scan.test.ts@88107ad71 const SCANNED_PATHS_${b.lane} (line ${String(b.declLine)})${t !== null ? `; tie line ${String(t.line)}${t.duplicateTieLines.length > 0 ? ` (repeated verbatim at line ${t.duplicateTieLines.join(', ')})` : ''}` : ''}`
  out[`${b.lane.toLowerCase().replace(/_/g, '-')}.json`] = JSON.stringify(booking, null, 2) + '\n'
}
for (const lane of ties.keys()) if (!bookings.some((b) => b.lane === lane)) throw new Error(`tie without list: ${lane}`)

if (flag === '--check') {
  const have = readdirSync(outDir).filter((n) => n.endsWith('.json')).sort()
  let bad = 0
  for (const [name, text] of Object.entries(out)) {
    let cur = null
    try { cur = readFileSync(join(outDir, name), 'utf8') } catch { /* missing */ }
    if (cur !== text) { console.log(`DIFF ${name}`); bad += 1 }
  }
  const extra = have.filter((n) => !(n in out))
  console.log(`migrated=${String(Object.keys(out).length)} committed=${String(have.length)} differing=${String(bad)} extra-in-dir=${extra.join(',') || '(none)'}`)
  process.exit(bad === 0 ? 0 : 1)
}
mkdirSync(outDir, { recursive: true })
for (const [name, text] of Object.entries(out)) writeFileSync(join(outDir, name), text)
console.log(`wrote ${String(Object.keys(out).length)} bookings; ${String(bookings.reduce((n, b) => n + b.paths.length, 0))} paths; ties ${String(ties.size)}; retired ${String(retired.paths.length)}`)
