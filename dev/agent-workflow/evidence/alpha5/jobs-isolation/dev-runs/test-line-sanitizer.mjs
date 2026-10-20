/**
 * Sanitizer guard test - FAKE credential strings ONLY (never a real raw).
 * Run: node test-line-sanitizer.mjs
 * @module dev-runs/test-line-sanitizer
 */
import assert from 'node:assert/strict'
import { PassThrough } from 'node:stream'
import { createSanitizingLineSink } from './line-sanitizer.mjs'

const redact = (t) => t.replace(/([?&]token=)[A-Za-z0-9_-]+/g, '$1REDACTED-AUTH-URL')
const FAKE = 'FAKECRED-1234abcd-5678efgh'
const collect = () => { const out = []; return { out, write: (l) => out.push(l) } }
const lines = (out) => out.join('\n')

// CASE 1: complete token line on stdout -> redacted, value absent
{
  const { out, write } = collect()
  const sink = createSanitizingLineSink({ write, redact })
  sink.onData(`server at http://127.0.0.1:9/?token=${FAKE}\n`)
  assert.ok(lines(out).includes('?token=REDACTED-AUTH-URL'), 'C1 stdout redacted')
  assert.ok(!lines(out).includes('FAKECRED'), 'C1 value absent')
  console.log('CASE1 stdout-complete-line redaction: PASS')
}
// CASE 2: same on the stderr stream (independent sink)
{
  const { out, write } = collect()
  const sink = createSanitizingLineSink({ write, redact })
  sink.onData(`warn ?token=${FAKE}\n`)
  assert.ok(lines(out).includes('?token=REDACTED-AUTH-URL') && !lines(out).includes('FAKECRED'), 'C2 stderr redacted')
  console.log('CASE2 stderr-stream redaction: PASS')
}
// CASE 3: token SPLIT ACROSS write boundaries (four chunks, splits inside
// the scheme, the value, and right before the value tail) - nothing
// emitted until the newline; then ONE redacted line
{
  const { out, write } = collect()
  const sink = createSanitizingLineSink({ write, redact })
  sink.onData('GET http://127.0.0.1:9/?to')
  assert.equal(lines(out), '', 'C3 nothing emitted while partial')
  sink.onData(`ken=${FAKE.slice(0, 12)}`)
  sink.onData(FAKE.slice(12))
  assert.equal(lines(out), '', 'C3 still buffered through split token')
  sink.onData('\nsecond line\n')
  const all = lines(out)
  assert.ok(all.includes('?token=REDACTED-AUTH-URL'), 'C3 split token redacted whole')
  assert.ok(!all.includes('FAKECRED') && !all.includes('ken=' + FAKE.slice(0, 6)), 'C3 no fragment of the value emitted')
  assert.ok(all.includes('second line'), 'C3 following line flows')
  console.log('CASE3 cross-chunk split-token buffering: PASS')
}
// CASE 4: trailing PARTIAL line is redacted and flushed at close (no drain leak, no raw tail)
{
  const { out, write } = collect()
  const sink = createSanitizingLineSink({ write, redact })
  sink.onData(`last ?token=${FAKE}`) // no newline - child died mid-line
  assert.equal(out.length, 0, 'C4 nothing before close')
  sink.onEnd()
  assert.ok(lines(out).includes('?token=REDACTED-AUTH-URL') && !lines(out).includes('FAKECRED'), 'C4 partial flushed redacted')
  console.log('CASE4 close-time partial flush (redacted): PASS')
}
// CASE 5: two streams interleave with independent carries - a partial on
// one stream never joins a line from the other (no phantom splice, no leak)
{
  const a = collect(); const b = collect()
  const sa = createSanitizingLineSink({ write: a.write, redact })
  const sb = createSanitizingLineSink({ write: b.write, redact })
  sa.onData(`x ?token=${FAKE.slice(0, 8)}`)
  sb.onData(`y ?token=${FAKE.slice(8)}\n`)
  sb.onEnd(); sa.onEnd()
  assert.ok(!lines(a.out).includes('FAKECRED') && !lines(b.out).includes('FAKECRED'), 'C5 no leak across streams')
  assert.ok(lines(a.out).includes('x ') && lines(b.out).includes('y '), 'C5 streams stay separate')
  assert.ok(lines(a.out).includes('?token=REDACTED-AUTH-URL'), 'C5A redacted on close')
  console.log('CASE5 independent per-stream carries: PASS')
}
console.log('SANITIZER-GUARD-VERDICT all-cases-passed (fake credentials only; launcher NOT run)')
