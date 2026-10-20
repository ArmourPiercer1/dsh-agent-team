/**
 * Sanitizer guard test - FAKE credential strings ONLY (never a real raw).
 * Run: node test-line-sanitizer.mjs
 * @module dev-runs/test-line-sanitizer
 */
import assert from 'node:assert/strict'
import { PassThrough } from 'node:stream'
import { createSanitizingLineSink, waitForDrain } from './line-sanitizer.mjs'
import { spawn } from 'node:child_process'

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
// CASE 6: full REAL-SPAWN lifecycle - spawn a child that writes a complete
// token line on stdout, one on stderr, then a PARTIAL token line it only
// completes after a delay, then exits (no trailing newline). Attach per-
// stream sinks; the drain verifier must report true; the collected log must
// be fully redacted including the flushed partial. Fake credentials only;
// the launcher is NOT run.
{
  const out = []
  const childScript = [
    'process.stdout.write("boot ?token=FAKECRED-alpha\\n");',
    'process.stderr.write("warn ?token=FAKECR");',
    'process.stderr.write("ED-beta\\n");',
    'process.stdout.write("partial ?token=FAKE");',
    'setTimeout(() => { process.stdout.write("CRED-gamma"); }, 60);',
    'setTimeout(() => { process.exit(3); }, 120);',
  ].join(' ')
  const child = spawn(process.execPath, ['-e', childScript],
    { stdio: ['ignore', 'pipe', 'pipe'] })
  const sinkOut = createSanitizingLineSink({ write: (l) => out.push(l), redact })
  const sinkErr = createSanitizingLineSink({ write: (l) => out.push('E:' + l), redact })
  sinkOut.attach(child.stdout)
  sinkErr.attach(child.stderr)
  const drained = await waitForDrain(child, [child.stdout, child.stderr], 5000)
  assert.equal(drained, true, 'C6 verified drain (child exit + both stream closes)')
  const all = out.join('\n')
  assert.ok(!all.includes('FAKECRED'), 'C6 zero credential fragments in the full lifecycle')
  assert.equal((all.match(/token=REDACTED-AUTH-URL/g) ?? []).length, 3, 'C6 three token lines redacted (stdout complete, stderr split, flushed partial)')
  assert.ok(all.includes('E:warn ?token=REDACTED-AUTH-URL'), 'C6 stderr stream rode its own sink')
  assert.ok(all.includes('partial ?token=REDACTED-AUTH-URL'), 'C6 delayed partial flushed redacted at close')
  console.log('CASE6 real-spawn lifecycle (attach, split, delayed partial, exit+close drain): PASS')
}
// CASE 7: bounded timeout on a NON-draining child must be an EXPLICIT
// incomplete (never silent): fake child that never exits + live streams.
{
  const st1 = new PassThrough(); const st2 = new PassThrough()
  const fakeChild = { exitCode: null, signalCode: null, once() { /* never fires */ } }
  const t0 = Date.now()
  const drained = await waitForDrain(fakeChild, [st1, st2], 150)
  assert.equal(drained, false, 'C7 timeout -> false')
  assert.ok(Date.now() - t0 >= 140, 'C7 actually waited the budget')
  st1.destroy(); st2.destroy()
  console.log('CASE7 bounded drain timeout reports incomplete explicitly: PASS')
}
console.log('SANITIZER-GUARD-VERDICT all-cases-passed (fake credentials only; launcher NOT run)')
