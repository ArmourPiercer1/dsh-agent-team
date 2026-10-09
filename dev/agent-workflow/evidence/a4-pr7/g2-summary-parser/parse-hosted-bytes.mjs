#!/usr/bin/env node
/**
 * parse-hosted-bytes.mjs — the G2 green witness: grade the hosted-derived fixtures with the
 * SHIPPED parser (`scripts/a4-client-lane-report.mjs`), outside vitest, on the same bytes the
 * red transcript graded with the origin/master parser. Red and green transcripts therefore
 * differ in exactly one thing: the parser.
 *
 * Usage: node parse-hosted-bytes.mjs            (grades the standard matrix, prints a table)
 */
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { classifyClientLaneReport } from '../../../../../scripts/a4-client-lane-report.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const FIX = join(HERE, 'fixtures')
const read = (n) => readFileSync(join(FIX, n), 'utf8')

const cases = [
  {
    name: 'hosted census capture (verbatim GitHub-runner bytes)',
    run: { out: read('hosted-census-capture-1.raw.txt'), missingTrioFiles: [] },
    expect: 'failed — with the summary SEEN (never "no vitest summary at all")',
  },
  {
    name: 'client lane, coloured, disclosed trio',
    run: { out: read('client-lane-coloured-trio.raw.txt'), code: 1, missingTrioFiles: [] },
    expect: 'passed — three disclosed failures by name',
  },
  {
    name: 'client lane, same bytes unstyled',
    run: { out: read('client-lane-plain-trio.raw.txt'), code: 1, missingTrioFiles: [] },
    expect: 'passed — identical verdict, styling did not move it',
  },
  {
    name: 'client lane, coloured, + a synthesised FOURTH failure',
    run: { out: read('client-lane-coloured-fourth-failure.raw.txt'), code: 1, missingTrioFiles: [] },
    expect: 'failed — naming the intruder',
  },
  {
    name: 'client lane, no summary at all',
    run: { out: read('client-lane-no-summary.raw.txt'), missingTrioFiles: [] },
    expect: 'refused — "no vitest summary at all" (the refusal survives)',
  },
  {
    name: 'client lane, summary present but unparseable',
    run: { out: read('client-lane-summary-unparseable.raw.txt'), missingTrioFiles: [] },
    expect: 'refused — naming the shape, NOT claiming absence',
  },
  {
    name: 'client lane, real JSON report from the forced-colour run, text stream destroyed',
    run: { out: '(text stream replaced by noise)', jsonText: read('client-lane-report.sample.json'), code: 1, missingTrioFiles: [] },
    expect: 'passed — machine-readable first',
  },
  {
    name: 'client lane, LIVE forced-colour capture (env -u NO_COLOR -u TERM FORCE_COLOR=1), text only',
    run: { out: read('client-lane-forced-colour.raw.txt'), jsonText: null, code: 1, missingTrioFiles: [] },
    expect: 'passed — the coloured text fallback reads what the old parser called "no summary"',
  },
]

let bad = 0
for (const c of cases) {
  let r
  try {
    r = classifyClientLaneReport(c.run)
  } catch (e) {
    r = { verdict: 'threw', why: String(e) }
    bad += 1
  }
  console.log(`\n### ${c.name}\nexpect: ${c.expect}\nverdict: ${r.verdict}\nobserved: ${r.observed}\nwhy: ${r.why.replace(/\u001B\[[0-9;]*m/g, '<ESC>')}`)
}
// A cheap self-check the transcript can be trusted with: the coloured trio and its plain twin
// must agree in verdict, or "styling may not move a verdict" is prose again.
const coloured = classifyClientLaneReport({ out: read('client-lane-coloured-trio.raw.txt'), code: 1, missingTrioFiles: [] }).verdict
const plain = classifyClientLaneReport({ out: read('client-lane-plain-trio.raw.txt'), code: 1, missingTrioFiles: [] }).verdict
console.log(`\nstyle-independence: coloured=${coloured} plain=${plain} ${coloured === plain ? 'AGREE' : 'DISAGREE — BUG'}`)
if (coloured !== plain) bad += 1
process.exit(bad === 0 ? 0 : 1)
