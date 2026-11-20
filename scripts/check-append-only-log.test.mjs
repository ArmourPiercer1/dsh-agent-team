import assert from 'node:assert/strict'
import { test } from 'node:test'

import { checkAppendOnly } from './check-append-only-log.mjs'

const BASE = '## e1\nbody one\n## e2\nbody two\n'

test('an unchanged log passes with zero added', () => {
  const r = checkAppendOnly({ baseText: BASE, headText: BASE })
  assert.equal(r.verdict, 'pass')
  assert.equal(r.added, 0)
  assert.equal(r.lines, 4)
})

test('a genuine append passes and reports the count', () => {
  const r = checkAppendOnly({ baseText: BASE, headText: `${BASE}## e3\nbody three\n` })
  assert.equal(r.verdict, 'pass')
  assert.equal(r.added, 2)
  assert.equal(r.lines, 6)
})

test('CRLF vs LF and a missing trailing newline are not rewrites', () => {
  const r = checkAppendOnly({ baseText: BASE.replace(/\n/g, '\r\n'), headText: `${BASE}## e3\nbody three` })
  assert.equal(r.verdict, 'pass')
})

test('MUTANT truncated log (the #800 shape: only the newest entries survive) is RED', () => {
  const r = checkAppendOnly({ baseText: BASE, headText: '## e2\nbody two\n' })
  assert.equal(r.verdict, 'fail')
  assert.match(r.reason, /LOG_TRUNCATED_OR_REWRITTEN/u)
  assert.equal(r.removed, 4)
})

test('MUTANT reworded historical line is RED', () => {
  const r = checkAppendOnly({ baseText: BASE, headText: '## e1\nbody one REWORDED\n## e2\nbody two\n' })
  assert.equal(r.verdict, 'fail')
})

test('MUTANT reordered entries are RED', () => {
  const r = checkAppendOnly({ baseText: BASE, headText: '## e2\nbody two\n## e1\nbody one\n' })
  assert.equal(r.verdict, 'fail')
})

test('MUTANT a synthetic entry inserted in the middle is RED (append-only, not insert-anywhere)', () => {
  const r = checkAppendOnly({ baseText: BASE, headText: '## e1\nbody one\n## eX\nsynthetic\n## e2\nbody two\n' })
  assert.equal(r.verdict, 'fail')
})

test('non-vacuity: the pass arms above are the only shapes that pass', () => {
  const bad = [
    ['## e1\nbody one\n', 'empty-after-first'],
    ['## e1\nbody one\n\n## e2\nbody two\n', 'extra blank line'],
    ['## e1\nbody one\n## e2\nbody 2\n', 'same-length rewrite'],
  ]
  for (const [text, why] of bad) {
    const r = checkAppendOnly({ baseText: BASE, headText: text })
    assert.equal(r.verdict, 'fail', `expected RED for ${why}`)
  }
})
