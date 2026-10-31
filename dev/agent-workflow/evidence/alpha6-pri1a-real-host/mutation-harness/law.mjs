#!/usr/bin/env node
/**
 * The checks PR-I1a's METHOD LAW is made of (F-I1a3-6), so that `mutrun.sh` stays readable and every check
 * here can move the exit code of the run. No dependencies; no output unless asked.
 *
 *   counts <file>                       delimiter/quote/marker/line/byte census, in the format the
 *                                       committed MUTATION-METHOD-LAW.txt files use
 *   occ <file> <token>                  occurrences of a token
 *   lines <file> <token>                line numbers containing a token, JSON
 *   verify <before> <after> <from> <to> the load-bearing check: `after` must be `before` with exactly one
 *                                       line changed, that line's FROM token replaced by the TO token;
 *                                       pass from="" for a pure insertion (a plant that adds a line)
 *   expected <before> <oldLine> <newLine>
 *                                       the census the mutated file MUST have, predicted from the DECLARED
 *                                       old/new lines (pass oldLine="-" for a pure insertion) — an
 *                                       independent prediction, never read back from the mutated bytes
 *   nul <file>                          exit 1 if any NUL byte
 *
 * `verify` is what "nothing else changed" means concretely: it diffs the whole file line by line, so ANY
 * other moved line fails it, and it then requires the one changed line to be the FROM line with FROM
 * replaced by TO — the mutation is confirmed from the bytes, not from `git apply`'s exit code.
 */
import { readFileSync } from 'node:fs'
import { diffLines } from './diff-lines.mjs'

const [cmd, ...rest] = process.argv.slice(2)
const COUNT_KEYS = ['(', ')', '{', '}', '[', ']', '`', '"', "'", ';', '\n', 'step(', 'check(', 'conjunct(', 'emit(', 'function ', '=> ']
// The rendering the committed MUTATION-METHOD-LAW.txt files use, kept byte-comparable on purpose: a
// double-quote key prints inside single quotes, a single-quote key inside double quotes, a newline as \n.
const renderKey = (k) => (k === '"' ? "'\"'" : k === "'" ? '"\'"' : k === '\n' ? "'\\n'" : `'${k}'`)
const count = (text, token) => { let n = 0; let i = 0; while ((i = text.indexOf(token, i)) >= 0) { n += 1; i += 1 }; return n }
const fail = (message) => { console.log(`ASSERT FAIL: ${message}`); process.exit(1) }

if (cmd === 'counts') {
  const text = readFileSync(rest[0], 'utf8')
  const out = COUNT_KEYS.map((k) => `${renderKey(k)}: ${String(count(text, k))}`)
  out.push(`'bytes': ${String(Buffer.byteLength(text))}`, `'lines': ${String(count(text, '\n'))}`)
  console.log(`{${out.join(', ')}}`)
  process.exit(0)
}
if (cmd === 'occ') { console.log(String(count(readFileSync(rest[0], 'utf8'), rest[1]))); process.exit(0) }
if (cmd === 'lines') {
  console.log(JSON.stringify(readFileSync(rest[0], 'utf8').split('\n').map((l, i) => (l.includes(rest[1]) ? i + 1 : 0)).filter(Boolean)))
  process.exit(0)
}
if (cmd === 'nul') {
  const buf = readFileSync(rest[0])
  for (const byte of buf) if (byte === 0) fail('a NUL byte is present')
  console.log('NUL byte scan: none')
  process.exit(0)
}
if (cmd === 'expected') {
  // Independent prediction: the census of the file as it stood, moved by the census of the DECLARED new
  // line minus the census of the DECLARED old line. The declaration comes from the caller (for a committed
  // MUTATION.diff, from that diff's own -/+ lines), never read back out of the mutated file, so a hunk
  // that does something other than what was declared cannot produce its own expected numbers.
  const [beforePath, fromLinePath, toLinePath] = rest
  const text = readFileSync(beforePath, 'utf8')
  const isInsertion = fromLinePath === '-'
  const removedLine = isInsertion ? '' : readFileSync(fromLinePath, 'utf8').replace(/\n$/, '')
  const declaredLine = readFileSync(toLinePath, 'utf8').replace(/\n$/, '')
  // A replacement swaps one line's content in place (its newline stays where it is); an insertion brings its
  // own newline with it. The prediction has to know which, or it is off by one byte and one line ending.
  const addedLine = isInsertion ? `${declaredLine}\n` : declaredLine
  const out = COUNT_KEYS.map((k) => `${renderKey(k)}: ${String(count(text, k) - count(removedLine, k) + count(addedLine, k))}`)
  out.push(
    `'bytes': ${String(Buffer.byteLength(text) - Buffer.byteLength(removedLine) + Buffer.byteLength(addedLine))}`,
    `'lines': ${String(count(text, '\n') - (isInsertion ? 0 : 1) + 1)}`,
  )
  console.log(`{${out.join(', ')}}`)
  process.exit(0)
}
if (cmd === 'verify') {
  const [beforePath, afterPath, from, to] = rest
  const before = readFileSync(beforePath, 'utf8')
  const after = readFileSync(afterPath, 'utf8')
  const changes = diffLines(before, after)
  if (changes.removed.length + changes.added.length === 0) fail('the file did not change at all')
  if (changes.removed.length > 1) fail(`${changes.removed.length} lines were removed, not the one line this law describes: ${JSON.stringify(changes.removed)}`)
  if (changes.added.length !== 1) fail(`${changes.added.length} lines were added, not one: ${JSON.stringify(changes.added)}`)
  if (changes.other) fail('a line changed somewhere other than the graded line')
  const [removedLine] = changes.removed
  const [addedLine] = changes.added
  if (from === '') {
    if (changes.removed.length !== 0) fail(`an insertion must remove nothing, it removed: ${JSON.stringify(removedLine)}`)
    if (addedLine !== to) fail(`the inserted line is not the bytes that were declared:\n  planted:  ${addedLine}\n  declared: ${to}`)
    console.log(`structure assertion: exactly one line was ADDED and it is the declared line, at line ${String(changes.addedAt[0])} — nothing else moved`)
    console.log(`added on line(s): ${JSON.stringify(changes.addedAt)}`)
    process.exit(0)
  }
  if (changes.removed.length !== 1) fail('a replacement must remove exactly one line')
  if (count(removedLine, from) !== 1) fail(`the removed line does not contain the FROM token exactly once: ${JSON.stringify(removedLine)}`)
  if (removedLine.split(from).join(to) !== addedLine) {
    fail(`the added line is not the removed line with FROM replaced by TO:\n  before: ${removedLine}\n  after:  ${addedLine}`)
  }
  if (addedLine.split(to).length !== 2) fail('the TO token is not unique on the mutated line')
  console.log('structure assertion: exactly one line changed, it is the FROM line with the FROM token replaced by the TO token — nothing else moved')
  console.log(`FROM occurred once on the pre-mutation line ${String(changes.removedAt[0])}; TO occurs once on the mutated line`)
  process.exit(0)
}
console.log(`unknown subcommand: ${String(cmd)}`)
process.exit(2)
