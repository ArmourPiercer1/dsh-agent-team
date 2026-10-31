#!/usr/bin/env node
/**
 * Alpha.6 #513 — two claims this lane keeps making about its own records, turned into an instrument.
 *
 * Why the file exists: round 3 asked for two verbatim quotes to be byte-exact and the fix said "compared by
 * program, not by eye" — the program was an uncommitted inline script, so by round 4 the sentence pointed at
 * something that no longer existed (F-R4-9). Round 4 also found a permanent log line naming a path in gitignored
 * scratch as where a record lives (F-R4-1). So: (1) re-derive the two published renderings and compare them
 * byte-for-byte against the source document, pinned by content hash; (2) list every log line that designates a
 * scratch path, pinned by raw content hash with a written reason.
 *
 * READ THIS BEFORE TRUSTING A GREEN RUN. Five consecutive rounds, the closure claim in this header has been false
 * on arrival, each time for a different reason, each time found by the next reviewer:
 *   round 4 — the check compared a rendering that no longer matched its source (fixed: `source-moved`);
 *   round 5 — a designation copied byte-for-byte, and a whitespace edit slipping past (fixed: duplicates red,
 *             pins hash raw lines);
 *   round 6 — uniqueness of the anchor was not the fix. The check read the first block *after* the anchor, so a
 *             correct copy planted beside the published one read clean over a corrupted quote (fixed: accounting);
 *   round 7 — accounting only counted blocks this scanner *spells* the way it spells them. Publish the corrupted
 *             quote as `~~~text`, a bare `` ``` ``, four backticks, or `>text`, and hide the correct bytes in a
 *             ```text fence inside an HTML comment, and the run prints `verdict=byte-equal` over a rendering no
 *             reader has ever seen — or over no published quote at all (fixed here).
 * The pattern is not carelessness. Every one of these bound to a **shape in the raw text** and then spoke about
 * **what the document publishes**. Those are different things, and the gap between them is where all five rounds died.
 *
 * WHAT IS CLOSED NOW, and by what mechanism:
 *   - Binding is by LABEL, not by shape or position. The published quote's fence carries an info string containing
 *     `dsh-quote:<name>`; a quote that renders as a blockquote is labelled by a `<!-- dsh-quote:<name> -->` line
 *     directly above it. Exactly one such label may exist; the labelled block IS the quote and must be byte-equal
 *     to the pinned source line. Delete the quote and the label goes with it ⇒ `designated-missing`. Duplicate the
 *     label ⇒ `label-duplicated`. The round-7 attacks all relied on the check reading a block other than the one it
 *     was told to read; there is no longer such a read.
 *   - Every block in the document, in **every** marker spelling this file can see — `` ``` ``, `~~~`, longer runs,
 *     with or without an info string, plus every `>`-prefixed run — must be accounted for: the designated quote, or
 *     byte-equal to a pinned source line, or named in `ACCOUNTED_BLOCKS` with a reason. HTML comments are NOT
 *     skipped: a fence inside a comment is still a block that exists, so the hiding place became a finding instead
 *     of an invisibility cloak.
 *   - Restyling is probed, not assumed away. Two 30-character probes from the head and tail of the source line are
 *     searched for on every line outside the labelled block, after folding (NFKC, invisible marks removed, whitespace
 *     collapsed). Publish the row as an indented code block, a table cell or a paragraph and something still
 *     contains those 30 characters ⇒ `quote-restyled`.
 *   - Pointer detection folds before matching and hashes raw. Folding is NFKC plus `\p{Cf}`, `\p{Zl}`, `\p{Zp}`,
 *     `\p{Cs}` and a small homoglyph table, so soft hyphen, U+061C, U+180E, tag characters, U+FFF9, full-width stops
 *     and Cyrillic look-alikes are seen rather than hidden; inside the live window the rule needs no vocabulary.
 *   - A pin **absent from the file** is a finding regardless of scope. Aging out of the window is not — the line is
 *     still in the log. Round 7 (F-R7-3) was right that a deleted line and an aged line used to answer identically.
 *   - Findings print full 64-character digests, because round 7 (F-R7-4) caught the published law "a pin is pasted
 *     from output" being unexecutable against a tool that printed 12 characters.
 *
 * WHAT STAYS OPEN, as the shapes that would still fool it — a list of "closed" items has been wrong four times:
 *   - The label is a convention in a document this lane edits. An editor may rename the label and the quote
 *     together; what that costs is a written reason in the same diff. That is a record, not a wall.
 *   - A restyle that does not reproduce 30 consecutive characters of the source (an acronym, a translation, a
 *     screenshot of the row) is no longer a quotation of it, and is not detected as one.
 *   - Outside the live window the pointer detector still needs its closed word list; that list is finite and
 *     therefore closable, and what protects history is that it was audited once, not that the pattern is unescapable.
 *   - Nothing runs this file. `grep -rn verify-verbatim-quotes` finds only this file and the log entries about it.
 *     It is "re-run by hand before publishing a quote", not a gate.
 *   - Ordinary edits cost pins, undisclosed before round 7, measured rather than guessed: re-saving the log CRLF
 *     prints `found=0 findings=6 verdict=regression` — every pin's raw-line hash changes, so the repair is re-pinning
 *     all six, with no forward fix short of that. A formatter adding a trailing space reddens any pin it touches.
 *     Adding any block anywhere in the publishing document costs an `ACCOUNTED_BLOCKS` entry naming it.
 *   - Round 6's section rule (`a quote must be the only block in its own section`) is GONE, and that is deliberate:
 *     it drew sections from raw `^#` lines, so a `#` inside a fenced sample re-drew the map and reddened both quotes
 *     for an unrelated edit. Label binding does not need it, and `# 围栏内注释行` now measures `rc=0`. Removing a
 *     check has to be as loud as adding one, so it is stated here rather than left to `git log`.
 *
 * Read-only by construction: three tracked files opened, nothing written.
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

/** Format/line-separator/unassigned characters, plus a look-alike table (round 7 F-R7-2: 11 code points were not a set). */
const INVISIBLE = /[\p{Cf}\p{Zl}\p{Zp}\p{Cs}⁠﻿￼￠]/gu
const HOMOGLYPHS = new Map([
  ['а', 'a'], ['е', 'e'], ['о', 'o'], ['с', 'c'], ['р', 'p'],
  ['у', 'y'], ['х', 'x'], ['і', 'i'], ['ѕ', 's'], ['ј', 'j'],
  ['．', '.'], ['。', '.'], ['｡', '.'], ['․', '.'], ['／', '/'],
])

function fold(value) {
  const normalised = value.normalize('NFKC').replace(INVISIBLE, '')
  let out = ''
  for (const char of normalised) out += HOMOGLYPHS.get(char) ?? char
  return out.replace(/\s+/g, ' ')
}

/** The lines the quotes must equal, pinned by content hash (round 5 F-R5-7: without a pin the check only proves
 * the rendering matches whatever the source says *now*). */
const PINNED_SOURCE_LINES = [
  { name: 'S0:75', line: 75, sha256: '8ba2ab061ffb557639cb6b397c1eb0392294cd33f109a629ea35a70ebd47e8ca',
    reason: 'the host-capability row S0 published; the addendum quotes it as the authority for "no timed wake"' },
  { name: 'S0:79', line: 79, sha256: '8021a192438cc566cf6d4a5819e3ee41ac913220b007076d9e979ea097166149',
    reason: 'the wake-source enumeration S0 published; quoted unwrapped in the same section' },
]

/**
 * Every block in the publishing document must be accounted for. Blocks not equal to a pinned source line are named
 * here with the reason they exist; adding a block means naming it in the diff.
 */
const ACCOUNTED_BLOCKS = [
  { sha256: '52783fdb2231711b33a4e6d7866a94633b232ef5f466709b157f96a08e5d07d5',
    reason: "the addendum's own status banner — emphasis prose, not a quotation of S0" },
  { sha256: '8c5ca70ef005a2e34eacca74a0c086d97888d407fe608dc06bbce15e674492dd',
    reason: 'the section-1 question, posed in a blockquote for emphasis; carries no quoted bytes' },
]

const SCRATCH_WINDOW_LINES = 80
const SCRATCH_WORDS = ['落盘', '正本']
const SCRATCH_MENTION = /(?:\.artifacts|artifacts\/)/

/**
 * Log lines accepted as naming a scratch path, pinned by raw content hash.
 * `permanent` must stay findable by the detector forever; `window` only has to be a mention the live window saw.
 * Either kind must still be PRESENT in the file: aging out is not the same as being deleted (round 7 F-R7-3).
 */
const PINNED_SCRATCH_POINTERS = [
  { sha256: '7a65186074fb99b06ba0610ba7295fcfd7038f73474989a3efabb2206a9303f3', scope: 'permanent',
    reason: 'pre-existing #385 lint-leg entry: names .artifacts/** as the thing being linted, not as a record store' },
  { sha256: 'a188a93e42a9822b296ac5451fb02cdabcb989507f3c0f800c59a5517c82f1f6', scope: 'permanent',
    reason: 'the round-3 entry whose disk clause F-R4-1 named; retired forward by line, history not rewritten' },
  { sha256: '298fbcc6dd92fcd6c2c2b4b271f8b03507a1bb1703e9cb95897c6a863a13daf1', scope: 'permanent',
    reason: 'the G-R3-8 disposition line: quoting the path it retires is the point of the sentence' },
  { sha256: 'e686905678d96b9c40672ce19abfa5d7fd48a2d3f2d7a737fcd655b980ecb1da', scope: 'window',
    reason: 'the F-R4-1 rebuttal quoting the report path it says does exist; a mention, not a designation' },
  { sha256: '165093eb9530101562352128cf0bc620d837e2de7a289c17b703849c7d118251', scope: 'window',
    reason: 'the round-5 entry describing the detector pattern it just widened; a mention, not a designation' },
  { sha256: '0a6f721b763941538c89f8725fcd51eded420a60bafba24394cf1ea9a202e728', scope: 'window',
    reason: 'the round-6 entry explaining zero-width normalisation; naming the directory is the subject, not a store' },
]

function readTracked(relative) {
  try {
    return readFileSync(join(REPO_ROOT, relative), 'utf8')
  } catch (error) {
    throw new Error(`cannot read tracked file ${relative}: ${String(error)}`)
  }
}

function sha256(text) {
  return createHash('sha256').update(text).digest('hex')
}

const FENCE_LINE = /^\s*(`{3,}|~{3,})(.*)$/
const QUOTE_LINE = /^\s*>/

/**
 * Every block in the document, in every marker spelling this file can see, plus every `>`-prefixed run. HTML
 * comments are deliberately not skipped — a fence hidden in a comment is still a block that exists.
 */
function allBlocks(document) {
  const lines = document.split('\n')
  const blocks = []
  for (let index = 0; index < lines.length; index += 1) {
    const fence = FENCE_LINE.exec(lines[index])
    if (fence !== null) {
      const marker = fence[1]
      const indent = lines[index].slice(0, lines[index].trimStart().length)
      const closer = new RegExp('^\\s*' + (marker[0] === '`' ? '`' : '~') + '{' + marker.length + ',}\\s*$')
      const body = []
      let cursor = index + 1
      for (; cursor < lines.length && !closer.test(lines[cursor]); cursor += 1) {
        body.push(lines[cursor].startsWith(indent) ? lines[cursor].slice(indent.length) : lines[cursor])
      }
      if (cursor >= lines.length) throw new Error('unterminated ' + marker + ' fence opened at line ' + (index + 1))
      blocks.push({ kind: 'fence', start: index + 1, end: cursor + 1, info: fence[2].trim(), text: body.join('\n') })
      index = cursor
      continue
    }
    if (QUOTE_LINE.test(lines[index])) {
      const body = []
      let cursor = index
      for (; cursor < lines.length && QUOTE_LINE.test(lines[cursor]); cursor += 1) {
        body.push(lines[cursor].trimStart().replace(/^>\s?/, ''))
      }
      blocks.push({ kind: 'quote', start: index + 1, end: cursor, info: '', text: body.join('') })
      index = cursor - 1
    }
  }
  return blocks
}

const CASES = [
  { name: 'S0:75', anchor: '第 75 行，逐字', mode: 'fence', line: 75 },
  { name: 'S0:79', anchor: '第 79 行（逐字）', mode: 'fence', line: 79 },
]

function labelOf(block) {
  const match = /dsh-quote:([A-Za-z0-9:_-]+)/.exec(block.info)
  return match === null ? null : match[1]
}

function checkQuote(document, source, one) {
  const sourceLine = source.split('\n')[one.line - 1]
  if (sourceLine === undefined) throw new Error('line ' + one.line + ' is past the end of ' + SOURCE_DOC)
  const pin = PINNED_SOURCE_LINES.find((pinned) => pinned.name === one.name)
  if (pin === undefined) throw new Error('no source pin declared for ' + one.name + ' — refusing instead of skipping')
  const sourceSha = sha256(sourceLine)
  if (pin.sha256 !== sourceSha) {
    return 'DSH-VERBATIM name=' + one.name + ' verdict=source-moved pinned=' + pin.sha256 + ' actual=' + sourceSha
  }

  const lines = document.split('\n')
  const anchorHits = lines.reduce((all, line, index) => (line.includes(one.anchor) ? [...all, index] : all), [])
  if (anchorHits.length !== 1) {
    throw new Error('anchor ' + JSON.stringify(one.anchor) + ' found ' + anchorHits.length + ' times, at line(s) ' +
      anchorHits.map((found) => found + 1).join(','))
  }
  const anchor = anchorHits[0]
  const blocks = allBlocks(document)
  const labelled = one.mode === 'fence'
    ? blocks.filter((block) => labelOf(block) === one.name)
    : blocks.filter((block) => block.kind === 'quote' &&
        ((lines[block.start - 2] ?? '').trim() === '<!-- dsh-quote:' + one.name + ' -->'))
  if (labelled.length !== 1) {
    return 'DSH-VERBATIM name=' + one.name + ' verdict=' + (labelled.length === 0 ? 'designated-missing' : 'label-duplicated') +
      ' label=dsh-quote:' + one.name + ' found=' + labelled.length +
      ' lines=' + labelled.map((block) => block.start).join(',') +
      ' — the quote is the block carrying this label, so zero or two of them publish nothing verifiable'
  }
  const designated = labelled[0]
  if (designated.start <= anchor) {
    return 'DSH-VERBATIM name=' + one.name + ' verdict=block-before-anchor block=' + designated.start +
      ' anchor=' + (anchor + 1)
  }

  // Every block in every spelling must be accounted for, and a verbatim quote may appear exactly once.
  const accounted = new Set(ACCOUNTED_BLOCKS.map((block) => block.sha256))
  const pinnedTexts = new Set(PINNED_SOURCE_LINES.map((pinned) => source.split('\n')[pinned.line - 1]))
  const orphans = blocks.filter((block) => block !== designated && block.text !== sourceLine &&
    !pinnedTexts.has(block.text) && !accounted.has(sha256(block.text)))
  if (orphans.length > 0) {
    return 'DSH-VERBATIM name=' + one.name + ' verdict=unaccounted-block count=' + orphans.length + ' ' +
      orphans.map((block) => 'line=' + block.start + ' sha256=' + sha256(block.text)).join(' ') +
      ' — every block of any marker spelling must be a quote or be named in ACCOUNTED_BLOCKS with a reason'
  }
  const copies = blocks.filter((block) => block !== designated && block.text === sourceLine)
  if (copies.length > 0) {
    return 'DSH-VERBATIM name=' + one.name + ' verdict=quote-duplicated count=' + (copies.length + 1) +
      ' lines=' + [designated.start, ...copies.map((block) => block.start)].join(',') + ' — a verbatim quote occurs once'
  }

  // Restyle probe: publishing the row somewhere else still has to reproduce 30 consecutive characters of it.
  const probes = [sourceLine.slice(0, 30), sourceLine.slice(-30)].map((probe) => fold(probe))
  const restyled = lines.reduce((hits, line, index) => {
    const inside = index + 1 >= designated.start && index + 1 <= designated.end
    if (inside) return hits
    const folded = fold(line)
    return probes.some((probe) => folded.includes(probe)) ? [...hits, index + 1] : hits
  }, [])
  if (restyled.length > 0) {
    return 'DSH-VERBATIM name=' + one.name + ' verdict=quote-restyled lines=' + restyled.join(',') +
      ' — the source text appears outside the labelled block, so something other than the labelled block publishes it'
  }

  const equal = designated.text === sourceLine
  return 'DSH-VERBATIM name=' + one.name + ' verdict=' + (equal ? 'byte-equal' : 'drift') +
    ' chars=' + [...designated.text].length + ' bytes=' + Buffer.byteLength(designated.text, 'utf8') +
    ' source_bytes=' + Buffer.byteLength(sourceLine, 'utf8') + ' sha256=' + sha256(designated.text) +
    (equal ? '' : ' — LABELLED BLOCK DIFFERS FROM SOURCE')
}

function checkScratchPointers(log) {
  const lines = log.split('\n')
  const windowStart = Math.max(0, lines.length - SCRATCH_WINDOW_LINES)
  const found = []
  for (let index = 0; index < lines.length; index += 1) {
    const raw = lines[index]
    const visible = fold(raw)
    if (!SCRATCH_MENTION.test(visible)) continue
    const named = SCRATCH_WORDS.some((word) => visible.includes(word))
    if (!named && index < windowStart) continue
    found.push({ line: index + 1, sha256: sha256(raw), scope: named ? 'named' : 'window', text: raw.trim().slice(0, 88) })
  }
  const output = found.map((one) => 'DSH-SCRATCH-POINTER line=' + one.line +
    ' accepted=' + PINNED_SCRATCH_POINTERS.some((pin) => pin.sha256 === one.sha256) +
    ' trigger=' + one.scope + ' sha256=' + one.sha256 + ' text=' + one.text)
  const unaccepted = found.filter((one) => !PINNED_SCRATCH_POINTERS.some((pin) => pin.sha256 === one.sha256))
  // Any kind of pin no longer in the FILE is a finding. Leaving the window is not.
  const present = new Set(lines.map((line) => sha256(line)))
  for (const pin of PINNED_SCRATCH_POINTERS.filter((item) => !present.has(item.sha256))) {
    output.push('DSH-SCRATCH-POINTER line=- accepted=false reason=pinned-line-absent-from-file scope=' + pin.scope +
      ' sha256=' + pin.sha256)
  }
  for (const pin of PINNED_SCRATCH_POINTERS.filter((item) => found.filter((one) => one.sha256 === item.sha256).length > 1)) {
    output.push('DSH-SCRATCH-POINTER accepted=false reason=pinned-designation-duplicated sha256=' + pin.sha256)
  }
  return { output, findings: unaccepted.length + PINNED_SCRATCH_POINTERS.filter((pin) => !present.has(pin.sha256)).length,
    found: found.length }
}

try {
  const source = readTracked(SOURCE_DOC)
  const addendum = readTracked(ADDENDUM)
  let drift = 0
  for (const one of CASES) {
    try {
      const line = checkQuote(addendum, source, one)
      if (!line.includes('verdict=byte-equal')) drift += 1
      console.log(line)
    } catch (error) {
      drift += 1
      console.log('DSH-VERBATIM name=' + one.name + ' verdict=unlocatable reason=' +
        String(error).replace(/\s+/g, ' ').slice(0, 160))
    }
  }
  console.log('DSH-VERBATIM-VERDICT quotes=' + CASES.length + ' drift=' + drift +
    ' verdict=' + (drift === 0 ? 'ok' : 'drift') + ' source=' + SOURCE_DOC + ' rendering=' + ADDENDUM)

  const scratch = checkScratchPointers(readTracked(LOG))
  console.log(scratch.output.join('\n'))
  console.log('DSH-SCRATCH-POINTER-VERDICT found=' + scratch.found + ' pinned=' + PINNED_SCRATCH_POINTERS.length +
    ' window=' + SCRATCH_WINDOW_LINES + ' findings=' + scratch.findings +
    ' verdict=' + (scratch.findings === 0 ? 'ok' : 'regression') + ' log=' + LOG)
  process.exit(drift === 0 && scratch.findings === 0 ? 0 : 1)
} catch (error) {
  console.log('DSH-VERBATIM-VERDICT quotes=0 drift=1 verdict=unrunnable reason=' +
    String(error).replace(/\s+/g, ' ').slice(0, 160))
  process.exit(1)
}
