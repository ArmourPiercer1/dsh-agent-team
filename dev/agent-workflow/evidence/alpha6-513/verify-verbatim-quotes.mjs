#!/usr/bin/env node
/**
 * Alpha.6 #513 — the two claims this lane keeps making about its own records, turned into an instrument instead
 * of a memory.
 *
 * Why this file exists (the defect it retires): review round 3 asked for two verbatim quotes to be byte-exact and
 * the fix reported "compared by program, not by eye". The program was an ad-hoc inline script that was never
 * committed, so by round 4 the sentence pointed at a program that no longer existed — a claim that happens to be
 * true is still a claim no reader can re-run (report `6540893481` finding G-R3-10, disposition `6540893725`,
 * round-4 finding F-R4-9). Round 4 also found a permanent log line designating a path inside gitignored scratch as
 * the resting place of a record (F-R4-1); the designation was wrong about the file existing, but the shape — a
 * durable record whose truth depends on a directory that is not in git — is the real defect.
 *
 * So this script does two things and prints one verdict line each:
 *
 *  1. VERBATIM — re-derives the two load-bearing quotes from the document that publishes them (the S0 addendum's
 *     own fenced block and blockquote — the PUBLISHED rendering, not a copy kept for the test) and compares them
 *     byte-for-byte against `s0-revalidation-20261030.md:75` and `:79`. Unwrap = strip the `> ` prefix from each
 *     blockquote line and join with no separator, which is the method the lane documented in round 3.
 *
 *  2. SCRATCH-POINTER — lists every log line that names a path under `.artifacts/**` as a resting place for a
 *     record, pins those lines by content hash (not line number: the log only grows), and refuses any that no
 *     human has accepted with a reason in the same diff.
 *
 * WHAT IS ACTUALLY CLOSED, stated per attack because the last two rounds of this header over-claimed.
 * Each of these was proven green by a reviewer's mutation and is red now, with the token it prints:
 *   - the check silently comparing nothing because the source moved under it (round 5 F-R5-7) → `source-moved`;
 *   - a pinned designation copied byte-for-byte (round 5 F-R5-8) → `pinned-designation-duplicated`;
 *   - a whitespace-only edit of a pinned line (round 5 INFO) → pins hash raw lines, so it reads as a new line;
 *   - a zero-width character inside `.artifacts` so the mention stops matching (round 6) → detection runs on a
 *     normalised copy while the hash stays raw, so the line is still found and no longer matches its pin;
 *   - a second copy of the quote planted anywhere in the publishing document, so the check reads the copy while
 *     the published quote rots (round 6 F-R6-1, the one that made the previous version of this header a lie) →
 *     `section-block-count` / `unaccounted-block`;
 *   - naming the scratch path on one line and the designating words on another, which used to walk past the
 *     detector entirely (round 4 F-R4-1, round 6 INFO) → inside the live window the rule is vocabulary-free, so
 *     word choice and line wrapping no longer decide what is a designation.
 *
 * WHAT STAYS OPEN, on purpose, because pretending otherwise is the failure mode this file keeps documenting:
 *   - A designation **outside** the live window still needs the closed word list (「落盘」/「正本」) to be seen.
 *     That list is finite and therefore closable; what protects history is that it was already audited, not that
 *     the pattern is unescapable.
 *   - The pins make forgery *visible and expensive*, never impossible: every closure above costs an attacker a
 *     hash swap plus a written reason inside the same diff, and a formatter pass over this log would break the
 *     raw-line pins by a single trailing space. The check is a witness, not a wall.
 *   - Nothing runs this file automatically. As of round 6, `grep -rn verify-verbatim-quotes` finds only this file
 *     and the log entries about it — cite it as "re-run by hand before publishing a quote", not as a gate.
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

/** Zero-width and bidi marks: invisible to a reader, fatal to a regex (round 6 INFO). */
const INVISIBLE = /[\u200B-\u200F\u2028-\u202E\u2060\uFEFF]/g

/** The lines the quotes must equal, pinned by content hash: without this the check only proves the rendering
 * matches whatever the source says *now* (round 5 F-R5-7). A coordinated edit must move a hash and say why. */
const PINNED_SOURCE_LINES = [
  { name: 'S0:75', line: 75, sha256: '8ba2ab061ffb557639cb6b397c1eb0392294cd33f109a629ea35a70ebd47e8ca',
    reason: 'the host-capability row S0 published; the addendum quotes it as the authority for "no timed wake"' },
  { name: 'S0:79', line: 79, sha256: '8021a192438cc566cf6d4a5819e3ee41ac913220b007076d9e979ea097166149',
    reason: 'the wake-source enumeration S0 published; quoted unwrapped in the same section' },
]

/**
 * Every block of a pinned kind in the publishing document must be accounted for: either it is the designated
 * quote, or it is listed here. That is what closes the round-6 decoy — a planted copy is no longer "before the
 * block we happen to read", it is an unaccounted block in a document whose blocks are all named.
 */
const ACCOUNTED_BLOCKS = [
  {
    sha256: '52783fdb2231711b33a4e6d7866a94633b232ef5f466709b157f96a08e5d07d5',
    reason: 'the addendum\'s own status banner — emphasis prose, not a quotation of S0',
  },
  {
    sha256: '8c5ca70ef005a2e34eacca74a0c086d97888d407fe608dc06bbce15e674492dd',
    reason: 'the section-1 question, posed in a blockquote for emphasis; carries no quoted bytes',
  },
]

/** The last N log lines are audited for `.artifacts` mentions with no vocabulary requirement. */
const SCRATCH_WINDOW_LINES = 80
const SCRATCH_WORDS = ['落盘', '正本']

/**
 * Log lines accepted as naming a scratch path, pinned by raw content hash.
 * `scope: 'permanent'` must remain present forever (it is a designation the history keeps asserting);
 * `scope: 'window'` is a mention that only has to be accepted while it sits inside the live window, because a
 * growing append-only log will carry it out of that window on its own.
 */
const PINNED_SCRATCH_POINTERS = [
  {
    // A 2026-10 line about PR #385's lint leg over `.artifacts/**`. The path is the SUBJECT of that sentence, not
    // the resting place of a record — the detector is deliberately literal, so the line is accepted with its
    // reason instead of worked around with a cleverer pattern.
    sha256: '7a65186074fb99b06ba0610ba7295fcfd7038f73474989a3efabb2206a9303f3', scope: 'permanent',
    reason: 'pre-existing #385 lint-leg entry: names .artifacts/** as the thing being linted, not as a record store',
  },
  {
    // Round-4 finding F-R4-1's own target line. The log is append-only, so the sentence cannot be edited out;
    // it is pinned and retired by a dated forward note instead.
    sha256: 'a188a93e42a9822b296ac5451fb02cdabcb989507f3c0f800c59a5517c82f1f6', scope: 'permanent',
    reason: 'the round-3 entry whose disk clause F-R4-1 named; retired forward by line, history not rewritten',
  },
  {
    // The G-R3-8 disposition line, which necessarily quotes the dangling path it is retiring.
    sha256: '298fbcc6dd92fcd6c2c2b4b271f8b03507a1bb1703e9cb95897c6a863a13daf1', scope: 'permanent',
    reason: 'the G-R3-8 disposition line: quoting the path it retires is the point of the sentence',
  },
  {
    // Round-4's F-R4-1 disposition, which cites the report path to argue the file exists. In the live window at
    // the time of pinning; it names a path and no designating word, which is exactly what the window rule is for.
    sha256: 'e686905678d96b9c40672ce19abfa5d7fd48a2d3f2d7a737fcd655b980ecb1da', scope: 'window',
    reason: 'the F-R4-1 rebuttal quoting the report path it says does exist; a mention, not a designation',
  },
  {
    // The round-5 entry describing this detector's own widening. Naming the pattern is how the round-5 record
    // explains itself, so it is accepted rather than reworded to dodge the check.
    sha256: '165093eb9530101562352128cf0bc620d837e2de7a289c17b703849c7d118251', scope: 'window',
    reason: 'the round-5 entry describing the detector pattern it just widened; a mention, not a designation',
  },
  {
    // The round-6 entry describing this detector's own normalisation rule. The window rule caught it the moment it
    // was written, and the honest answer to that is a pin with a reason — not rewording the sentence so the
    // detector stops seeing it. Accepted while in the window; a mention of the directory, not a designation.
    sha256: '0a6f721b763941538c89f8725fcd51eded420a60bafba24394cf1ea9a202e728', scope: 'window',
    reason: 'the round-6 entry explaining zero-width normalisation; naming the directory is the subject, not a store',
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

function sha256(text) {
  return createHash('sha256').update(text).digest('hex')
}

/**
 * Every block of one kind in a document, with its 1-based start line.
 * `mode: 'fence'`  — a ```text block, indent stripped.
 * `mode: 'quote'` — a maximal run of `> ` lines, prefix stripped, joined raw (the round-3 unwrap method).
 */
function blocksOfKind(document, mode) {
  const lines = document.split('\n')
  const blocks = []
  for (let index = 0; index < lines.length; index += 1) {
    if (mode === 'fence') {
      if (lines[index].trim() !== '```text') continue
      const indent = lines[index].match(/^\s*/)[0]
      const body = []
      let cursor = index + 1
      for (; cursor < lines.length && lines[cursor].trim() !== '```'; cursor += 1) {
        body.push(lines[cursor].startsWith(indent) ? lines[cursor].slice(indent.length) : lines[cursor])
      }
      if (cursor >= lines.length) throw new Error(`unterminated \`\`\`text fence at line ${index + 1}`)
      blocks.push({ start: index + 1, end: cursor + 1, text: body.join('\n') })
      index = cursor
      continue
    }
    if (!lines[index].trimStart().startsWith('> ')) continue
    const body = []
    let cursor = index
    for (; cursor < lines.length && lines[cursor].trimStart().startsWith('> '); cursor += 1) {
      body.push(lines[cursor].trimStart().slice(2))
    }
    blocks.push({ start: index + 1, end: cursor, text: body.join('') })
    index = cursor - 1
  }
  return blocks
}

/** The ATX-heading section enclosing a line index, as [from, to) line indices. */
function sectionOf(document, index) {
  const lines = document.split('\n')
  const levelOf = (line) => {
    const match = /^(#{1,6})\s/.exec(line)
    return match === null ? 0 : match[1].length
  }
  let level = 0
  for (let cursor = index; cursor >= 0; cursor -= 1) {
    const found = levelOf(lines[cursor])
    if (found > 0) { level = found; break }
  }
  let from = 0
  for (let cursor = index; cursor >= 0; cursor -= 1) {
    const found = levelOf(lines[cursor])
    if (found > 0 && found <= level) { from = cursor; break }
  }
  let to = lines.length
  const inner = level === 0 ? 6 : level
  for (let cursor = index + 1; cursor < lines.length; cursor += 1) {
    const found = levelOf(lines[cursor])
    if (found > 0 && found <= inner) { to = cursor; break }
  }
  return [from, to]
}

const CASES = [
  { name: 'S0:75', anchor: '第 75 行，逐字', mode: 'fence', line: 75 },
  { name: 'S0:79', anchor: '第 79 行（逐字）', mode: 'quote', line: 79 },
]

const report = []
let drift = 0

function checkQuote(document, source, one) {
  const sourceLine = lineOf(source, one.line)
  const pin = PINNED_SOURCE_LINES.find((pinned) => pinned.name === one.name)
  // A missing pin is not "nothing to check" (round 6 INFO: `pin !== undefined` used to skip silently the moment a
  // name drifted). Refuse instead.
  if (pin === undefined) throw new Error(`no source pin declared for ${one.name}`)
  const sourceSha = sha256(sourceLine)
  if (pin.sha256 !== sourceSha) {
    return `DSH-VERBATIM name=${one.name} verdict=source-moved pinned=${pin.sha256.slice(0, 12)} actual=${sourceSha.slice(0, 12)}`
  }

  const lines = document.split('\n')
  const hits = lines.reduce((all, line, index) => (line.includes(one.anchor) ? [...all, index] : all), [])
  if (hits.length === 0) throw new Error(`anchor ${JSON.stringify(one.anchor)} not found in ${ADDENDUM}`)
  if (hits.length > 1) {
    throw new Error(`anchor ${JSON.stringify(one.anchor)} is ambiguous: ${hits.length} occurrences at line(s) ` +
      hits.map((found) => found + 1).join(','))
  }
  const anchor = hits[0]

  // Round 5's "uniqueness is the whole fix" was false, and round 6 proved it green: a correct copy planted
  // between the anchor and the published block is the block this function used to read, so corrupting the
  // published one changed nothing. The binding is therefore not positional at all any more — the document's
  // blocks are accounted for as a set, and the quote's own section is allowed exactly one.
  const all = blocksOfKind(document, one.mode)
  const [from, to] = sectionOf(document, anchor)
  const inSection = all.filter((block) => block.start > from && block.start < to)
  if (inSection.length !== 1) {
    return `DSH-VERBATIM name=${one.name} verdict=section-block-count expected=1 found=${inSection.length} ` +
      `section_lines=${from + 1}-${to} blocks=${inSection.map((block) => block.start).join(',')}`
  }
  const designated = inSection[0]
  if (designated.start <= anchor) {
    return `DSH-VERBATIM name=${one.name} verdict=block-before-anchor block=${designated.start} anchor=${anchor + 1}`
  }
  // An exact second copy is not harmless: it is the copy that will still read clean after the published one
  // rots, which is stage one of the round-6 decoy attack. A quote occurs once in the document that quotes it.
  const exact = all.filter((block) => block.text === sourceLine)
  if (exact.length > 1) {
    return `DSH-VERBATIM name=${one.name} verdict=quote-duplicated count=${exact.length} ` +
      `lines=${exact.map((block) => block.start).join(',')} — exactly one copy of a verbatim quote may exist`
  }
  const accounted = new Set(ACCOUNTED_BLOCKS.map((block) => block.sha256))
  const orphans = all.filter((block) => block.text !== sourceLine && !accounted.has(sha256(block.text)))
  if (orphans.length > 0) {
    return `DSH-VERBATIM name=${one.name} verdict=unaccounted-block count=${orphans.length} ` +
      `lines=${orphans.map((block) => block.start).join(',')} ` +
      `sha256=${orphans.map((block) => sha256(block.text).slice(0, 12)).join(',')} — every block of this kind must ` +
      'be the quote or be listed in ACCOUNTED_BLOCKS with a reason'
  }
  const equal = designated.text === sourceLine
  return `DSH-VERBATIM name=${one.name} verdict=${equal ? 'byte-equal' : 'drift'}` +
    ` chars=${[...designated.text].length} bytes=${Buffer.byteLength(designated.text, 'utf8')}` +
    ` source_chars=${[...sourceLine].length} source_bytes=${Buffer.byteLength(sourceLine, 'utf8')}` +
    ` sha256=${sha256(designated.text).slice(0, 12)}` + (equal ? '' : ' — PUBLISHED RENDERING DIFFERS FROM SOURCE')
}

function checkScratchPointers(log) {
  const lines = log.split('\n')
  const windowStart = Math.max(0, lines.length - SCRATCH_WINDOW_LINES)
  const found = []
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index]
    // Detection runs on a copy with invisible marks removed; the hash stays over the RAW line, so inserting a
    // zero-width character into a pinned line gets it flagged as an unaccepted new line rather than hidden
    // (round 6 INFO).
    const visible = line.replace(INVISIBLE, '')
    if (!/\.artifacts\b/.test(visible)) continue
    const named = SCRATCH_WORDS.some((word) => visible.includes(word))
    // Inside the live window the rule is vocabulary-free: this is where a record is being written right now, and
    // the round-4/round-6 evasion was always "put the path on one line and the words on another".
    if (!named && index < windowStart) continue
    found.push({
      line: index + 1,
      sha256: sha256(line),
      scope: named ? 'named' : 'window',
      text: line.trim().slice(0, 90),
    })
  }
  const pinned = new Map(PINNED_SCRATCH_POINTERS.map((one) => [one.sha256, one]))
  const output = []
  for (const one of found) {
    output.push(`DSH-SCRATCH-POINTER line=${one.line} accepted=${pinned.has(one.sha256)} trigger=${one.scope} ` +
      `sha256=${one.sha256.slice(0, 12)} text=${one.text}`)
  }
  const unaccepted = found.filter((one) => !pinned.has(one.sha256))
  // Only permanent pins are required to survive: a window mention leaves the window by the log growing, which is
  // not a finding and must never be fixed by deleting history.
  const vanished = PINNED_SCRATCH_POINTERS.filter((one) => one.scope === 'permanent' &&
    !found.some((one2) => one2.sha256 === one.sha256))
  for (const one of vanished) {
    output.push(`DSH-SCRATCH-POINTER line=- accepted=false reason=pinned-line-no-longer-present sha256=${one.sha256.slice(0, 12)}`)
  }
  const duplicates = PINNED_SCRATCH_POINTERS.map((one) => ({
    sha256: one.sha256,
    lines: found.filter((one2) => one2.sha256 === one.sha256).map((one2) => one2.line),
  })).filter((one) => one.lines.length > 1)
  for (const one of duplicates) {
    output.push(`DSH-SCRATCH-POINTER line=${one.lines.join(',')} accepted=false ` +
      `reason=pinned-designation-duplicated sha256=${one.sha256.slice(0, 12)}`)
  }
  return {
    output,
    findings: unaccepted.length + vanished.length + duplicates.length,
    found: found.length,
  }
}

try {
  const source = readTracked(SOURCE_DOC)
  const addendum = readTracked(ADDENDUM)
  for (const one of CASES) {
    try {
      const line = checkQuote(addendum, source, one)
      report.push(line)
      if (!line.includes('verdict=byte-equal')) drift += 1
    } catch (error) {
      drift += 1
      report.push(`DSH-VERBATIM name=${one.name} verdict=unlocatable reason=` +
        String(error).replace(/\s+/g, ' ').slice(0, 140))
    }
  }
  console.log(report.join('\n'))
  console.log(`DSH-VERBATIM-VERDICT quotes=${CASES.length} drift=${drift} verdict=${drift === 0 ? 'ok' : 'drift'} ` +
    `source=${SOURCE_DOC} rendering=${ADDENDUM}`)

  const scratch = checkScratchPointers(readTracked(LOG))
  console.log(scratch.output.join('\n'))
  console.log(`DSH-SCRATCH-POINTER-VERDICT found=${scratch.found} pinned=${PINNED_SCRATCH_POINTERS.length} ` +
    `window=${SCRATCH_WINDOW_LINES} findings=${scratch.findings} ` +
    `verdict=${scratch.findings === 0 ? 'ok' : 'regression'} log=${LOG}`)
  process.exit(drift === 0 && scratch.findings === 0 ? 0 : 1)
} catch (error) {
  // A crash used to exit 1 with no DSH-* token, so a wrapper grepping for the verdict line saw silence and a
  // human reading a log saw nothing to notice (round 6 INFO-10).
  console.log(`DSH-VERBATIM-VERDICT quotes=0 drift=1 verdict=unrunnable reason=` +
    String(error).replace(/\s+/g, ' ').slice(0, 140))
  process.exit(1)
}
