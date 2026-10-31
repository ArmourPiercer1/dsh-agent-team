#!/usr/bin/env node
/**
 * PLANT A — the reviewer's round-3 plant, reproduced verbatim (F-I1a3-1).
 *
 * One comment line, inserted between the line the round-17 rows-quote descriptor used as its ANCHOR
 * (`state: 'done', mode: 'write',`) and the arm that descriptor pointed two lines ahead to
 * (`writes: { created, replay, transferred, retired }, rows,`). Round 17 quoted the comment as "the bytes it
 * was graded from" while its self-test printed `verdict=pass checks=30 problems=0`; the graded arm sat one
 * line lower. Run it on top of the committed mut-payload hunk so the leg is red and the FAIL block prints.
 *
 * Nothing here is clever: the insertion point is found by an anchor that must occur exactly once, and the
 * script exits nonzero (which fails the run) if that anchor is not unique or already duplicated.
 */
import { readFileSync, writeFileSync } from 'node:fs'

const target = process.env.PRI1A_TARGET
const line = process.env.PRI1A_NEW_LINE
if (!target || !line) { console.log('plant-a: PRI1A_TARGET and PRI1A_NEW_LINE are required'); process.exit(1) }
const lines = readFileSync(target, 'utf8').split('\n')
const ANCHOR = "state: 'done', mode: 'write', detail:"
const hits = lines.map((l, i) => (l.includes(ANCHOR) ? i + 1 : 0)).filter(Boolean)
if (hits.length !== 1) { console.log(`plant-a: the anchor occurs ${String(hits.length)} times (${JSON.stringify(hits)}), not once — refusing to plant`); process.exit(1) }
if (lines.some((l) => l.includes(line))) { console.log('plant-a: the line to plant is already present — refusing to plant it twice'); process.exit(1) }
const at = hits[0] + 1
lines.splice(at, 0, line)
writeFileSync(target, lines.join('\n'))
const written = readFileSync(target, 'utf8').split('\n')
if (written[at] !== line) { console.log(`plant-a: line ${String(at + 1)} on disk is not what was declared: <${String(written[at])}>`); process.exit(1) }
console.log(`plant-a: read back from disk — line ${String(at + 1)} = <${String(written[at])}>, inserted immediately after line ${String(at)} (the line after the unique anchor "${ANCHOR}")`)
console.log(`plant-a: the graded arm — "writes: { created, replay, transferred, retired }, rows," — is now line ${String(at + 2)}`)
