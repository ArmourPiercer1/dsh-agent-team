#!/usr/bin/env node
/**
 * PLANT B — the same drift class, planted where it cannot be absorbed (F-I1a3-1's other half).
 *
 * PLANT A shifts an arm and the instrument must FOLLOW it. This one inserts a line INSIDE a graded span:
 * the two lines of `const freshProcess = … && previousBootArgv0 !== process.argv0`, which the descriptor
 * `ARM_REOPEN_PROBE` grades as one arm. With a line inside the span, the span's second line no longer
 * carries its signature, so the instrument must print its refusal instead of bytes. Run on top of the
 * committed mut-pid hunk so the leg is red and the FAIL block prints.
 */
import { readFileSync, writeFileSync } from 'node:fs'

const target = process.env.PRI1A_TARGET
const line = process.env.PRI1A_NEW_LINE
if (!target || !line) { console.log('plant-b: PRI1A_TARGET and PRI1A_NEW_LINE are required'); process.exit(1) }
const lines = readFileSync(target, 'utf8').split('\n')
const ANCHOR = 'const freshProcess ='
const hits = lines.map((l, i) => (l.includes(ANCHOR) ? i + 1 : 0)).filter(Boolean)
if (hits.length !== 1) { console.log(`plant-b: the anchor occurs ${String(hits.length)} times (${JSON.stringify(hits)}), not once — refusing to plant`); process.exit(1) }
if (lines.some((l) => l.includes(line))) { console.log('plant-b: the line to plant is already present — refusing to plant it twice'); process.exit(1) }
const at = hits[0]
lines.splice(at, 0, line)
writeFileSync(target, lines.join('\n'))
const written = readFileSync(target, 'utf8').split('\n')
if (written[at] !== line) { console.log(`plant-b: line ${String(at + 1)} on disk is not what was declared: <${String(written[at])}>`); process.exit(1) }
console.log(`plant-b: read back from disk — line ${String(at + 1)} = <${String(written[at])}>, INSIDE the graded span that starts on line ${String(hits[0])}; the arm's second line is now line ${String(at + 2)}`)
console.log(`plant-b: inserted as line ${String(at + 1)}, INSIDE the graded span that starts on line ${String(hits[0])} — the arm's second line is now line ${String(at + 2)}`)
