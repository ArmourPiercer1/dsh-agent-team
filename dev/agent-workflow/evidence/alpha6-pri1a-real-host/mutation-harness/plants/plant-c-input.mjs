#!/usr/bin/env node
/**
 * PLANT C — an arm's INPUT mutated, the arm left pristine (F-I1a3-4, the limit the wording now discloses).
 *
 * `const previousBootPid = Number(config.previousBootPid)` becomes `Number(0)`, which is OUTSIDE the graded
 * span of `ARM_REOPEN_PROBE` (the `const freshProcess = …` two-liner below it). The leg reddens and the FAIL
 * block prints arm bytes that are honestly, literally correct — they ARE the predicate it graded — while the
 * reason the leg went red is one line above them. That is why "quotes the bytes it was graded from" is scoped
 * to ARM bytes: an arm's inputs are not quoted, and a mutation of an input reddens the leg with these bytes
 * unchanged. The block stays self-diagnosing because the values line states the pid it saw.
 */
import { readFileSync, writeFileSync } from 'node:fs'

const OLD_LINE = '      const previousBootPid = Number(config.previousBootPid)'
const NEW_LINE = '      const previousBootPid = Number(0)'
const target = process.env.PRI1A_TARGET
if (!target) { console.log('plant-c: PRI1A_TARGET is required'); process.exit(1) }
if (process.env.PRI1A_NEW_LINE !== NEW_LINE) { console.log(`plant-c: the run declared a different new line: ${String(process.env.PRI1A_NEW_LINE)}`); process.exit(1) }
const text = readFileSync(target, 'utf8')
const lines = text.split('\n')
const hits = lines.map((l, i) => (l === OLD_LINE ? i + 1 : 0)).filter(Boolean)
if (hits.length !== 1) { console.log(`plant-c: the input line occurs ${String(hits.length)} times, not once — refusing to plant`); process.exit(1) }
lines[hits[0] - 1] = NEW_LINE
writeFileSync(target, lines.join('\n'))
const written = readFileSync(target, 'utf8').split('\n')
if (written[hits[0] - 1] !== NEW_LINE) { console.log(`plant-c: line ${String(hits[0])} on disk is not what was declared: <${String(written[hits[0] - 1])}>`); process.exit(1) }
console.log(`plant-c: read back from disk — line ${String(hits[0])} = <${String(written[hits[0] - 1])}> replaced in place, nothing inserted or removed`)
console.log(`plant-c: line ${String(hits[0])} replaced; the graded span starts on line ${String(hits[0] + 2)} and is untouched`)
