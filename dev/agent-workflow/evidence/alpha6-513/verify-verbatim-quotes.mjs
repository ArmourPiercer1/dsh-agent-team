#!/usr/bin/env node
/**
 * Alpha.6 #513 round-4 — the two claims this lane keeps making about its own records, turned into an
 * instrument instead of a memory.
 *
 * Why this file exists (the defect it retires): review round 3 asked for two verbatim quotes to be byte-exact
 * and the fix reported "compared by program, not by eye". The program was an ad-hoc inline script that was never
 * committed, so by round 4 the sentence pointed at a program that no longer existed — a claim that happens to be
 * true is still a claim no reader can re-run (report `6540893481` finding G-R3-10, disposition `6540893725`,
 * round-4 finding F-R4-9). Round 4 also found a permanent log line designating a path inside gitignored scratch
 * as the resting place of a record (F-R4-1); the designation was wrong about the file existing, but the shape —
 * a durable record whose truth depends on a directory that is not in git — is the real defect.
 *
 * So this script does two things and prints one verdict line each:
 *
 *  1. VERBATIM — re-derives the two load-bearing quotes from the document that carries them (the S0 addendum's
 *     own fenced block and blockquote, i.e. the PUBLISHED rendering, not a copy kept for the test) and compares
 *     them byte-for-byte against `s0-revalidation-20261030.md:75` and `:79`. Unwrap = strip the `> ` prefix from
 *     each blockquote line and join with no separator, which is the method the lane documented in round 3.
 *
 *  2. SCRATCH-POINTER — walks the append-only session log and lists every line that designates a path under
 *     `.artifacts/**` as a resting place for a record (「落盘」 or 「正本」 in the same line as such a path).
 *     Those lines are pinned by content hash, not by line number, because the log only grows and a number would
 *     drift. A new designation turns this red until a human adds its hash and a reason to the list in the same
 *     diff — which is the point: the instrument makes the act visible and expensive, it does not make it
 *     impossible, and this comment says so out loud rather than claiming a guarantee it cannot give.
 *
 * Its boundary, learned the hard way in the very commit that adds it (round 4): the detector is **line-scoped** —
 * a path on one line and 落盘/正本 on the next is not a designation as far as this check is concerned. The log entry
 * documenting F-R4-1 does exactly that, and passed. Evading it needs no malice, only ordinary line wrapping. It
 * stays because a real designation is almost always written as one clause ("正本 = <path>"), but anyone citing this
 * check has to cite its shape with it.
 *
 * Read-only by construction: it opens three tracked files and writes nothing.
 *
 * @module dev/agent-workflow/evidence/alpha6-513/verify-verbatim-quotes
 */

import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../../..')
const SOURCE_DOC = 'docs/plans/memo/alpha6-review-separation/s0-revalidation-20261030.md'
const ADDENDUM = 'docs/plans/memo/alpha6-review-separation/s0-addendum-timed-wake-carrier-20261031.md'
const LOG = 'dev/agent-workflow/SESSION_ROUTER_LOG.md'

/** Designations accepted as of head `59f1f8132` (measured 3), each with why it stays. */
const PINNED_SCRATCH_POINTERS = [
  {
    // A 2026-10 line about PR #385's lint leg over `.artifacts/**`. The path is the SUBJECT of that sentence, not
    // the resting place of a record — the detector is deliberately literal and counts it anyway, so the line is
    // accepted here with its reason rather than worked around with a cleverer pattern.
    sha256: '7a65186074fb99b06ba0610ba7295fcfd7038f73474989a3efabb2206a9303f3',
    reason: 'pre-existing #385 lint-leg entry: names .artifacts/** as the thing being linted, not as a record store',
  },
  {
    // Round-4 finding F-R4-1's own target line. The log is append-only, so the sentence cannot be edited out;
    // it is pinned and retired by a dated forward note instead.
    sha256: '1cf193b2bfbf1e5ea4aed81512d1149a4baca428550c291f3f9904317b9bde1f',
    reason: 'the round-3 entry whose disk clause F-R4-1 named; retired forward by line, history not rewritten',
  },
  {
    // The G-R3-8 disposition line, which necessarily quotes the dangling path it is retiring.
    sha256: '376b36ce0b8b7bf3c9492773e60c09909ceb033ab9c32f582af9b5e6fd7f0118',
    reason: 'the G-R3-8 disposition line: quoting the path it retires is the point of the sentence',
  },
]

/** Read a tracked file relative to the repo root, failing closed. */
function readTracked(relative) {
  const path = join(REPO_ROOT, relative)
  try {
    return readFileSync(path, 'utf8')
  } catch (error) {
    throw new Error(`cannot read tracked file ${relative}: ${String(error)}`)
  }
}

/** The 1-based physical line of a tracked file, newline not included. */
function lineOf(text, oneBased) {
  const lines = text.split('\n')
  const line = lines[oneBased - 1]
  if (line === undefined) throw new Error(`${oneBased} is past the end of the file (${lines.length} lines)`)
  return line
}

/**
 * The published rendering of one quote, taken out of the document that publishes it.
 * `mode: 'fence'`  — the ```text block that follows the anchor bullet, indent stripped.
 * `mode: 'quote'` — the consecutive `> ` lines that follow the anchor bullet, prefix stripped, joined raw.
 */
function renderingOf(document, anchorText, mode) {
  const lines = document.split('\n')
  const anchor = lines.findIndex((line) => line.includes(anchorText))
  if (anchor === -1) throw new Error(`anchor ${JSON.stringify(anchorText)} not found in ${ADDENDUM}`)
  if (mode === 'fence') {
    const open = lines.findIndex((line, index) => index > anchor && line.trim() === '```text')
    if (open === -1) throw new Error(`no \`\`\`text fence after ${JSON.stringify(anchorText)}`)
    const indent = lines[open].match(/^\s*/)[0]
    const body = []
    for (let index = open + 1; index < lines.length; index += 1) {
      if (lines[index].trim() === '```') return body.join('\n')
      body.push(lines[index].startsWith(indent) ? lines[index].slice(indent.length) : lines[index])
    }
    throw new Error(`unterminated fence after ${JSON.stringify(anchorText)}`)
  }
  const body = []
  for (let index = anchor + 1; index < lines.length; index += 1) {
    const line = lines[index]
    if (!line.trimStart().startsWith('> ')) {
      if (body.length === 0) throw new Error(`no blockquote directly after ${JSON.stringify(anchorText)}`)
      return body.join('')
    }
    body.push(line.trimStart().slice(2))
  }
  throw new Error(`unterminated blockquote after ${JSON.stringify(anchorText)}`)
}

const report = []
let drift = 0

const source = readTracked(SOURCE_DOC)
const addendum = readTracked(ADDENDUM)

const CASES = [
  { name: 'S0:75', anchor: '第 75 行，逐字', mode: 'fence', line: 75 },
  { name: 'S0:79', anchor: '第 79 行（逐字）', mode: 'quote', line: 79 },
]

for (const one of CASES) {
  const sourceLine = lineOf(source, one.line)
  let rendering
  try {
    rendering = renderingOf(addendum, one.anchor, one.mode)
  } catch (error) {
    report.push(`DSH-VERBATIM name=${one.name} verdict=unlocatable reason=${String(error).replace(/\s+/g, ' ').slice(0, 120)}`)
    drift += 1
    continue
  }
  const equal = rendering === sourceLine
  if (!equal) drift += 1
  report.push(
    `DSH-VERBATIM name=${one.name} verdict=${equal ? 'byte-equal' : 'drift'}` +
      ` chars=${[...rendering].length} bytes=${Buffer.byteLength(rendering, 'utf8')}` +
      ` source_chars=${[...sourceLine].length} source_bytes=${Buffer.byteLength(sourceLine, 'utf8')}` +
      ` sha256=${createHash('sha256').update(rendering).digest('hex').slice(0, 12)}`,
  )
}

console.log(report.join('\n'))
console.log(
  `DSH-VERBATIM-VERDICT quotes=${CASES.length} drift=${drift} verdict=${drift === 0 ? 'ok' : 'drift'} ` +
    `source=${SOURCE_DOC} rendering=${ADDENDUM}`,
)

const log = readTracked(LOG)
const found = []
const lines = log.split('\n')
for (let index = 0; index < lines.length; index += 1) {
  const line = lines[index]
  if (!/\.artifacts\/\S/.test(line)) continue
  if (!line.includes('落盘') && !line.includes('正本')) continue
  found.push({ line: index + 1, sha256: createHash('sha256').update(line.trim()).digest('hex'), text: line.trim().slice(0, 90) })
}
const pinned = new Set(PINNED_SCRATCH_POINTERS.map((one) => one.sha256))
const unaccepted = found.filter((one) => !pinned.has(one.sha256))
const vanished = PINNED_SCRATCH_POINTERS.filter((one) => !found.some((one2) => one2.sha256 === one.sha256))
for (const one of found) {
  console.log(`DSH-SCRATCH-POINTER line=${one.line} accepted=${pinned.has(one.sha256)} sha256=${one.sha256.slice(0, 12)} text=${one.text}`)
}
for (const one of vanished) {
  console.log(`DSH-SCRATCH-POINTER line=- accepted=false reason=pinned-line-no-longer-present sha256=${one.sha256.slice(0, 12)}`)
}
const scratchFindings = unaccepted.length + vanished.length
console.log(
  `DSH-SCRATCH-POINTER-VERDICT found=${found.length} pinned=${PINNED_SCRATCH_POINTERS.length} ` +
    `findings=${scratchFindings} verdict=${scratchFindings === 0 ? 'ok' : 'regression'} log=${LOG}`,
)

process.exit(drift === 0 && scratchFindings === 0 ? 0 : 1)
