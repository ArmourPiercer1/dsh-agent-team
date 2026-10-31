#!/usr/bin/env node
/**
 * Round-19 plant (F-I1a4-1 reproductions) — insert ONE declared line immediately after a line that
 * matches `anchor` EXACTLY ONCE, then read it back from disk. This is the generic shape of the round-4
 * insertion plants: plant D inserted a comment carrying a span signature after `const freshProcess =`;
 * plant A2 inserted a byte-copy of the signature line at the same place. The anchor is matched by
 * exact equality after nothing — a plant that could hit twice refuses, and a line already present
 * refuses to be planted twice.
 *
 * env: PRI1A_TARGET (abs target), PRI1A_NEW_LINE (the exact line), PRI1A_ANCHOR (the exact whole line
 *      to plant after). Exit nonzero (failing the run) unless both are unique on the current bytes.
 */
import { readFileSync, writeFileSync } from 'node:fs'

const target = process.env.PRI1A_TARGET
const line = process.env.PRI1A_NEW_LINE
const anchor = process.env.PRI1A_ANCHOR
if (!target || line === undefined || !anchor) { console.log('plant-insert-after: PRI1A_TARGET, PRI1A_NEW_LINE and PRI1A_ANCHOR are required'); process.exit(1) }
const lines = readFileSync(target, 'utf8').split('\n')
const hits = lines.map((l, i) => (l === anchor ? i : -1)).filter((i) => i >= 0)
if (hits.length !== 1) { console.log(`plant-insert-after: the anchor line occurs ${String(hits.length)} times, not once — refusing to plant`); process.exit(1) }
if (lines.some((l) => l === line)) { console.log('plant-insert-after: the exact line is already present — refusing to plant it twice'); process.exit(1) }
const at = hits[0] + 1
lines.splice(at, 0, line)
writeFileSync(target, lines.join('\n'))
const written = readFileSync(target, 'utf8').split('\n')
if (written[at] !== line) { console.log(`plant-insert-after: line ${String(at + 1)} on disk is not what was declared: <${String(written[at])}>`); process.exit(1) }
console.log(`plant-insert-after: read back from disk — line ${String(at + 1)} = <${String(written[at])}>, inserted immediately after line ${String(hits[0] + 1)} (the exact anchor line)`)
