#!/usr/bin/env node
/**
 * make-fixtures.mjs — build the G2 regression fixtures out of the REAL hosted runner bytes.
 *
 * Provenance rules (this is evidence, not a test-fixture convenience):
 *  - `hosted-census-capture-1.raw.txt` is a verbatim copy of the hosted capture taken by the
 *    coordinator from the failing GitHub run (`.tmp-coord/a1/census-transcripts/`). Nothing
 *    here touches it.
 *  - The coloured client-lane fixtures are ASSEMBLED from that file: the summary lines and the
 *    `team-governance` FAIL line are extracted byte-for-byte; the only edits are the COUNTS on
 *    the two summary lines (the hosted capture reports the census's 508-file totals, the client
 *    lane has 55) and the two `team-creation-panel` FAIL lines, which the hosted capture does not
 *    contain in full — they are rebuilt from the hosted FAIL token sequence (`ESC[41m ESC[1m
 *    FAIL ESC[22m ESC[49m ` and the `ESC[2m > ESC[22m` separators) with the byte-exact test
 *    names from `CLIENT_BASELINE_FAILURES`. Which bytes are hosted and which are assembled is
 *    restated in FINDINGS.md; the property under test — "ANSI-coloured vitest output still
 *    parses" — is carried by the ANSI token sequence, and every escape byte here is that
 *    sequence copied out of the hosted file, not re-typed from memory.
 *
 * Usage: node make-fixtures.mjs   (run from this directory)
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const HOSTED = join(HERE, 'fixtures', 'hosted-census-capture-1.raw.txt')
const raw = readFileSync(HOSTED, 'latin1') // latin1 read = byte-preserving extraction; the extracted lines are ASCII and are re-written as UTF-8
const lines = raw.split('\n')

const findLine = (pred, label) => {
  const hit = lines.find(pred)
  if (hit === undefined) throw new Error(`hosted line not found: ${label}`)
  return hit.replace(/\r$/, '')
}

const summaryFiles = findLine((l) => l.includes('Test Files') && l.includes('\u001B['), 'the ANSI-coloured `Test Files` summary line')
const summaryTests = findLine((l) => /^\u001B\[2m {6}Tests /.test(l), 'the ANSI-coloured `Tests` summary line')
const failGov = findLine(
  (l) => l.includes('FAIL') && l.includes('team-governance.client.spec.tsx') && l.includes('\u001B[41m'),
  'the ANSI-coloured team-governance FAIL identity line',
)

// The hosted FAIL token and separator, sliced out of the hosted line rather than re-typed.
const esc = '\u001B'
const failToken = `${esc}[41m${esc}[1m FAIL ${esc}[22m${esc}[49m `
if (!failGov.includes(failToken)) throw new Error('the hosted FAIL line does not carry the expected token sequence')
const sep = `${esc}[2m > ${esc}[22m`
if (!failGov.includes(sep)) throw new Error('the hosted FAIL line does not carry the expected separator sequence')

const B1 = 'test/team-creation-panel.client.spec.tsx > TeamCreationPanel > selecting a blueprint loads the detail block and fires the persona-fact probe (S5-A, UI §6/§7)'
const B2 = 'test/team-creation-panel.client.spec.tsx > TeamCreationPanel > switching the runtime preset re-runs the probe with the new persona fact (UI §7.3)'
const colouredFail = (identity) => failToken + identity.split(' > ').join(sep)

// Client-lane counts, written over the hosted summary lines with the ANSI bytes untouched.
const clientSummaryFiles = summaryFiles
  .replace('5 failed', '2 failed')
  .replace('503 passed', '53 passed')
  .replace('(508)', '(55)')
const clientSummaryTests = summaryTests
  .replace('10 failed', '3 failed')
  .replace('6363 passed', '877 passed')
  .replace('(6373)', '(880)')
if (clientSummaryTests === summaryTests || clientSummaryFiles === summaryFiles) {
  throw new Error('the count substitution matched nothing — the hosted summary shape moved; re-derive, do not hand-edit')
}

const banner = (title) =>
  `# fixture: ${title}\n# assembled by make-fixtures.mjs from fixtures/hosted-census-capture-1.raw.txt (hosted bytes verbatim;\n# provenance of every line is in FINDINGS.md). ANSI escape bytes are the hosted token sequence.\n`

const trioBody = [
  `\u001B[1m\u001B[46m RUN \u001B[39m\u001B[24m v4.1.11 /home/runner/work/dsh-agent-team/dsh-agent-team/packages/client`,
  colouredFail(B1),
  colouredFail(B2),
  `    ${failGov.trimStart()}`,
  clientSummaryFiles,
  clientSummaryTests,
  `\u001B[2m   Start at  ${'00:00:00'}\u001B[22m`,
].join('\n') + '\n'

writeFileSync(join(HERE, 'fixtures', 'client-lane-coloured-trio.raw.txt'), banner('coloured client lane, exactly the three disclosed baseline failures') + trioBody, 'utf8')

const FOURTH = 'test/whatever-broke-next.client.spec.tsx > WhateverBrokeNext > a fourth failure outside the disclosed baseline'
const fourthText =
  banner('the same coloured transcript plus a SYNTHESISED fourth failure; counts updated to match') +
  [
    `\u001B[1m\u001B[46m RUN \u001B[39m\u001B[24m v4.1.11 /home/runner/work/dsh-agent-team/dsh-agent-team/packages/client`,
    colouredFail(B1),
    colouredFail(B2),
    colouredFail(FOURTH),
    `    ${failGov.trimStart()}`,
    clientSummaryFiles.replace('2 failed', '3 failed'),
    clientSummaryTests.replace('3 failed', '4 failed').replace('877 passed', '876 passed'),
  ].join('\n') + '\n'
writeFileSync(join(HERE, 'fixtures', 'client-lane-coloured-fourth-failure.raw.txt'), fourthText, 'utf8')

// The same lane unstyled — the local shape, proving the fallback still reads what it always read.
const strip = (s) => s.replace(/\u001B\[[0-9;]*m/g, '')
writeFileSync(
  join(HERE, 'fixtures', 'client-lane-plain-trio.raw.txt'),
  banner('the same client-lane report with the ANSI bytes removed (the local, unstyled shape)') + strip(trioBody),
  'utf8',
)

writeFileSync(
  join(HERE, 'fixtures', 'client-lane-no-summary.raw.txt'),
  banner('a lane that died before it summarised: progress lines only, no `Test Files`/`Tests` line') +
    [
      `\u001B[1m\u001B[46m RUN \u001B[39m\u001B[24m v4.1.11 /home/runner/work/dsh-agent-team/dsh-agent-team/packages/client`,
      ` \u001B[32m✓\u001B[39m test/team-ledger-model.client.spec.ts \u001B[2m(\u001B[22m\u001B[2m27 tests\u001B[22m\u001B[2m)\u001B[22m\u001B[33m 122\u001B[2mms\u001B[22m\u001B[39m`,
      `\u001B[2m\u001B[22m\u001B[31m\u001B[1mELIFECYCLE\u001B[22m\u001B[39m Command failed with exit code 137.`,
    ].join('\n') + '\n',
  'utf8',
)

// A summary ANCHOR that exists and whose counts cannot be read — the black-box case the task
// names: the instrument must say what shape it saw, not "no summary at all".
writeFileSync(
  join(HERE, 'fixtures', 'client-lane-summary-unparseable.raw.txt'),
  banner('a summary-shaped pair of lines whose counts cannot be parsed (truncated/hostile shape)') +
    [
      clientSummaryFiles.replace(`${esc}[1m${esc}[31m2 failed${esc}[39m${esc}[22m${esc}[2m | ${esc}[22m${esc}[1m${esc}[32m53 passed${esc}[39m${esc}[22m${esc}[90m (55)${esc}[39m`, `unknown \u0014\u0014 truncated \u0014\u0014`),
      clientSummaryTests.replace(`${esc}[1m${esc}[31m3 failed${esc}[39m${esc}[22m${esc}[2m | ${esc}[22m${esc}[1m${esc}[32m877 passed${esc}[39m${esc}[22m${esc}[90m (880)${esc}[39m`, `\u001B[1m ??? ??? ??? \u001B[22m`),
    ].join('\n') + '\n',
  'utf8',
)

console.log('fixtures written: coloured-trio, coloured-fourth-failure, plain-trio, no-summary, summary-unparseable')
