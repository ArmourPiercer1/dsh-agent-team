/**
 * d4-evidence-consistency.test.mjs — SEC-02's machine check: a d4 evidence README must not
 * contradict the machine record in the same directory.
 *
 * WHY THIS EXISTS. `dev/agent-workflow/evidence/d-boot-feasibility/d4/README.md` said
 * `d4:routed-wake` was REFUTED for months after `results.json` in that same tree recorded it
 * PROVEN. A reviewer who read only the README would have signed the capability off backwards. The
 * prose was corrected on 2026-11-25 (with the history retained); this arm is the ratchet that makes
 * the same drift red next time instead of silent.
 *
 * WHAT IT CHECKS, and its honest bounds:
 *   1. the README's declared measurement head equals `probe-digest.json#head` — a verdict is only
 *      "for the same head" if both documents name the same head;
 *   2. the README's §2 per-judge table has exactly the judge set `results.json` produced, and every
 *      verdict token is equal;
 *   3. the `overall` row equals `results.json#overall`, and the two boots agree;
 *   4. the §4.2/§3 historical text is allowed to say REFUTED only inside an explicitly marked
 *      `[HISTORICAL` block — a bare current-tense REFUTED for a PROVEN judge fails.
 *
 * It is deliberately a prose/JSON comparison, not a semantic re-measurement: it cannot prove the
 * probe ran, only that the two documents in the evidence tree tell the same story. That is exactly
 * the defect class SEC-02 named.
 */

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { test } from 'node:test'

const EVIDENCE = new URL('../../dev/agent-workflow/evidence/d-boot-feasibility/d4/', import.meta.url)
const README = fileURLToPath(new URL('README.md', EVIDENCE))
const RESULTS = fileURLToPath(new URL('results.json', EVIDENCE))
const PROBE_DIGEST = fileURLToPath(new URL('probe-digest.json', EVIDENCE))

const readme = readFileSync(README, 'utf8')
const boots = JSON.parse(readFileSync(RESULTS, 'utf8'))
const digest = JSON.parse(readFileSync(PROBE_DIGEST, 'utf8'))

/** `officer-up` -> `officerUp`; `ask-execute-2` -> `askExecute2`. The README's judge names are the
 * kebab form of the `results.json` verdict keys. */
const camelOf = (kebab) => kebab.split('-').map((part, index) => (index === 0 ? part : part[0].toUpperCase() + part.slice(1))).join('')

/** The §2 table, and only it: the corrected table sits between the §2 heading and the per-judge
 * prose. Later historical sections are not parsed as current verdicts. */
const section = readme.slice(readme.indexOf('## 2. Per-judge results'))
const tableStart = section.indexOf('| judge | verdict | boots |')
const tableEnd = section.indexOf('\n\n', section.indexOf('| overall |'))
assert.ok(tableStart !== -1 && tableEnd !== -1, 'the README must carry the §2 per-judge table')
const table = section.slice(tableStart, tableEnd)
const rows = table.split('\n').filter((line) => line.startsWith('|') && !line.startsWith('| judge') && !line.startsWith('| ---'))
const parsed = rows.map((line) => {
  const cells = line.split('|').map((cell) => cell.trim()).filter((cell) => cell !== '')
  return { judge: cells[0].replaceAll('`', ''), verdict: cells[1].replaceAll('*', '') }
})

const bootVerdicts = boots.map((boot) => boot.verdicts)

test('SEC-02 — the d4 README declares the same measurement head as probe-digest.json', () => {
  const match = readme.match(/Measurement head:\s*`([0-9a-f]{40})`/)
  assert.ok(match, 'the README must declare its measurement head explicitly (so "same head" is checkable)')
  assert.equal(match[1], digest.head, 'the README measurement head must be the head the probe digest binds')
  assert.match(digest.head, /^[0-9a-f]{40}$/u)
})

test('SEC-02 — the two d4 boots agree before either is compared with the prose', () => {
  assert.equal(boots.length, 2, 'the d4 record is a two-boot agreement record')
  assert.deepEqual(
    Object.keys(bootVerdicts[0]).sort(),
    Object.keys(bootVerdicts[1]).sort(),
    'the two boots must measure the same judge set',
  )
  for (const key of Object.keys(bootVerdicts[0])) {
    assert.equal(bootVerdicts[0][key].verdict, bootVerdicts[1][key].verdict, `the two boots disagree on ${key}`)
  }
  assert.equal(boots[0].overall, boots[1].overall, 'the two boots disagree on overall')
})

test('SEC-02 — the README §2 verdicts equal results.json (no inverted or omitted judge)', () => {
  const machine = camelOf
  const expected = new Map()
  for (const [key, value] of Object.entries(bootVerdicts[0])) expected.set(key, value.verdict)
  const declared = new Map()
  for (const row of parsed) {
    if (row.judge === 'overall') continue
    assert.match(row.judge, /^d4:[a-z0-9-]+$/u, `the §2 table row ${JSON.stringify(row.judge)} is not a d4 judge`)
    declared.set(machine(row.judge.slice('d4:'.length)), row.verdict)
  }
  const missing = [...expected.keys()].filter((key) => !declared.has(key))
  const extra = [...declared.keys()].filter((key) => !expected.has(key))
  assert.deepEqual(missing, [], `the README §2 table omits machine judges: ${missing.join(', ')}`)
  assert.deepEqual(extra, [], `the README §2 table names judges results.json does not have: ${extra.join(', ')}`)
  for (const [key, verdict] of expected) {
    assert.equal(declared.get(key), verdict, `the README says ${key}=${declared.get(key)} but results.json says ${verdict}`)
  }
})

test('SEC-02 — the README overall verdict equals results.json overall', () => {
  const overall = parsed.find((row) => row.judge === 'overall')
  assert.ok(overall, 'the §2 table must carry the overall row')
  assert.equal(overall.verdict, boots[0].overall)
})

test('SEC-02 — a current-tense REFUTED may not stand outside an explicitly marked historical block', () => {
  // The corrected README is allowed to keep the round-87/88 text, but a disproven claim about a judge
  // that results.json records PROVEN must sit in a marked historical region (a `[HISTORICAL` section, a
  // banner blockquote, or a line that says "at that head"/"round 87"/"kept as history"). This catches
  // the other half of the original defect: fixing the table but leaving a current-tense "the routed
  // wake does not happen" paragraph.
  const proven = new Set(
    Object.entries(bootVerdicts[0])
      .filter(([, value]) => value.verdict === 'PROVEN')
      .map(([key]) => key),
  )
  assert.ok(proven.has('routedWake'), 'the machine record this arm protects must actually record routedWake as PROVEN')
  const kebabOf = (key) => key.replace(/[A-Z]/gu, (letter) => `-${letter.toLowerCase()}`)
  const provenKebab = [...proven].map(kebabOf)

  const lines = readme.split('\n')
  // 1. A blockquote block is historical if ANY line in the block carries a history/banner marker.
  const blockHistorical = new Array(lines.length).fill(false)
  for (let index = 0; index < lines.length; index++) {
    if (!lines[index].startsWith('>')) continue
    let end = index
    while (end < lines.length && lines[end].startsWith('>')) end++
    const block = lines.slice(index, end).join('\n')
    if (/\[HISTORICAL|\[SUPERSEDED|CORRECTION — 2026-11-25/u.test(block)) {
      for (let mark = index; mark < end; mark++) blockHistorical[mark] = true
    }
    index = end
  }
  // 2. A `[HISTORICAL` heading makes its section historical until a heading of the same or higher rank.
  const sectionHistorical = new Array(lines.length).fill(false)
  let openRank = 0
  for (let index = 0; index < lines.length; index++) {
    const heading = lines[index].match(/^(#{1,4}) /u)
    if (heading !== null) {
      const rank = heading[1].length
      if (openRank !== 0 && rank <= openRank) openRank = 0
      if (/\[HISTORICAL|\[SUPERSEDED/u.test(lines[index])) openRank = rank
    }
    if (openRank !== 0) sectionHistorical[index] = true
  }
  const isHistorical = (index) => blockHistorical[index] || sectionHistorical[index] || /\[HISTORICAL|\[SUPERSEDED|at that head|at round|round-8[0-9]|round 8[0-9]|kept as history/u.test(lines[index])

  const disputes = /\bREFUTED\b|does not happen|remains UNPROVEN|stays \*\*REFUTED\*\*/u
  const offenders = []
  for (let index = 0; index < lines.length; index++) {
    const line = lines[index]
    if (!disputes.test(line)) continue
    // Match the exact judge token, so `ask-execute` is not found inside `ask-execute-process`.
    const mentioned = provenKebab.filter((kebab) => {
      const token = new RegExp(`(?:^|[^a-z0-9-])${kebab.replaceAll('-', '[- ]')}(?![a-z0-9-])`, 'iu')
      return token.test(line)
    })
    if (mentioned.length === 0) continue
    if (isHistorical(index)) continue
    offenders.push(`line ${index + 1} (${mentioned.join(', ')}): ${line.trim()}`)
  }
  assert.deepEqual(offenders, [], `current-tense REFUTED/disproven text about a PROVEN judge outside a historical block:\n${offenders.join('\n')}`)
})
