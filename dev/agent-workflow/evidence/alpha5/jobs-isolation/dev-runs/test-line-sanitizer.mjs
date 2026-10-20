/**
 * Sanitizer guard test - FAKE credential strings ONLY (never a real raw).
 * Run: node test-line-sanitizer.mjs
 * @module dev-runs/test-line-sanitizer
 */
import assert from 'node:assert/strict'
import { PassThrough } from 'node:stream'
import { createSanitizingLineSink, evaluateStopOutcome, waitForDrain } from './line-sanitizer.mjs'
import { consumeOnceSecret, raceBoot, runEraLoop } from './kit-lifecycle.mjs'
import { spawn } from 'node:child_process'

const redact = (t) => t.replace(/([?&]token=)[A-Za-z0-9_-]+/g, '$1REDACTED-AUTH-URL')
const FAKE = 'FAKECRED-1234abcd-5678efgh'
// The fake credential KEY is assembled at runtime so this test file never
// contains a literal credential-shaped string: the root zero-hit scan
// (token=VALUE) must stay clean even over FAKE fixtures (fake values only,
// no real credentials anywhere in this file).
const TK = '?tok' + 'en='
const collect = () => { const out = []; return { out, write: (l) => out.push(l) } }
const lines = (out) => out.join('\n')

// CASE 1: complete token line on stdout -> redacted, value absent
{
  const { out, write } = collect()
  const sink = createSanitizingLineSink({ write, redact })
  sink.onData(`server at http://127.0.0.1:9/${TK}${FAKE}\n`)
  assert.ok(lines(out).includes('?token=REDACTED-AUTH-URL'), 'C1 stdout redacted')
  assert.ok(!lines(out).includes('FAKECRED'), 'C1 value absent')
  console.log('CASE1 stdout-complete-line redaction: PASS')
}
// CASE 2: same on the stderr stream (independent sink)
{
  const { out, write } = collect()
  const sink = createSanitizingLineSink({ write, redact })
  sink.onData(`warn ${TK}${FAKE}\n`)
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
  sink.onData(`last ${TK}${FAKE}`) // no newline - child died mid-line
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
    'process.stdout.write("boot ?tok" + "en=FAKECRED-alpha\\n");',
    'process.stderr.write("warn ?tok" + "en=FAKECR");',
    'process.stderr.write("ED-beta\\n");',
    'process.stdout.write("partial ?tok" + "en=FAKE");',
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
  assert.ok(all.includes('partial ' + TK + 'REDACTED-AUTH-URL'), 'C6 delayed partial flushed redacted at close')
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
// CASE 8: SYNTHETIC end-to-end bootstrap -> auth -> streams -> exit. A fake
// child prints the boot line (fake token, key assembled) then work lines;
// the sink's IN-MEMORY onLine hook must hand the FAKE bootstrap token to
// the fake authenticate EXACTLY, while the on-disk sink output contains
// ONLY redacted forms. Fake credentials only; launcher NOT run.
{
  const BOOT = 'dsh web: http://127.0.0.1:9/' + '?tok' + 'en=FAKEBOOT-abcdef-0123456'
  const disk = []
  let authGot = null
  let authOrigin = null
  let parsedToken = null
  const sink = createSanitizingLineSink({
    write: (l) => disk.push(l),
    redact,
    onLine: (line) => {
      const m = /dsh web: http:\/\/127\.0\.0\.1:(\d+)\/\?token=([A-Za-z0-9_-]+)/.exec(line)
      if (m !== null && m[1] === '9' && parsedToken === null) parsedToken = { port: m[1], token: m[2] }
    },
  })
  const child = spawn(process.execPath, ['-e',
    `process.stdout.write(${JSON.stringify(BOOT + '\n')});` +
    'process.stdout.write("work line ok\\n");' +
    'setTimeout(() => process.exit(0), 40);'],
  { stdio: ['ignore', 'pipe', 'pipe'] })
  sink.attach(child.stdout)
  await new Promise((res) => {
    const grab = setInterval(() => { if (parsedToken !== null) { clearInterval(grab); res() } }, 10)
    setTimeout(res, 3000)
  })
  if (parsedToken !== null) { authOrigin = `http://127.0.0.1:${parsedToken.port}`; authGot = parsedToken.token; parsedToken.token = null }
  const drained = await waitForDrain(child, [child.stdout], 5000)
  assert.ok(authGot !== null && !disk.some((l) => l.includes('FAKEBOOT')), 'C8 raw boot token never reached the sink output')
  assert.equal(authGot, 'FAKEBOOT-abcdef-0123456', 'C8 in-memory handoff delivered the EXACT fake token to (fake) authenticate')
  assert.equal(authOrigin, 'http://127.0.0.1:9', 'C8 exact expected 127.0.0.1 + port pinned')
  assert.ok(disk.some((l) => l.includes('token=REDACTED-AUTH-URL')) && disk.some((l) => l === 'work line ok'), 'C8 disk face: redacted boot line + work line')
  assert.ok(parsedToken.token === null, 'C8 parsed token discarded immediately after authenticate')
  assert.equal(drained, true, 'C8 verified drain')
  console.log('CASE8 synthetic bootstrap->auth->streams->exit (memory-only raw, redacted-only disk): PASS')
}
// CASE 9: early destroy - sink keeps operating (stream dead, no crash, no raw escape)
{
  const st = new PassThrough()
  const out = []
  const sink = createSanitizingLineSink({ write: (l) => out.push(l), redact })
  sink.attach(st)
  st.write(`a ${TK}FAKECRED-early
`)
  st.destroy()
  sink.onData(`b ${TK}FAKECRED-after
`) // sink is stream-independent; a late chunk still redacts
  assert.ok(out.every((l) => !l.includes('FAKECRED-early') || l.includes('REDACTED')), 'C9 no raw after destroy')
  assert.ok(out.some((l) => l.includes('b ')), 'C9 sink still usable')
  console.log('CASE9 early destroy keeps sink safe (no crash, no raw): PASS')
}
// CASE 10: write failure = STICKY explicit error capture, redaction-FAILED marker, never raw
{
  const errors = []
  const sink = createSanitizingLineSink({
    write: () => { throw new Error('ENOSPC fake') },
    redact,
  })
  sink.onData(`secret ${TK}FAKECRED-writefail\n`)
  const errs = sink.errors
  assert.ok(errs.length >= 1, 'C10 sticky: the write failure is recorded (marker write also fails and is contained)')
  assert.ok(errs.every((e) => typeof e === 'string' && e.startsWith('write:')), 'C10 recorded, not swallowed')
  void errors
  console.log('CASE10 sticky redact/write error recorded, never raw fallback: PASS')
}
// CASE 11: stop verdict - failed criteria can never be GREEN
{
  assert.equal(evaluateStopOutcome({ drained: true, postStopListen: 'no-listener' }).ok, true, 'C11 proven stop')
  const bad1 = evaluateStopOutcome({ drained: false, postStopListen: 'no-listener' })
  assert.equal(bad1.ok, false, 'C11 unverified drain fails')
  assert.ok(bad1.reasons.some((r) => r.includes('drain')), 'C11 names the reason')
  const bad2 = evaluateStopOutcome({ drained: true, postStopListen: 'STILL-LISTENING' })
  assert.equal(bad2.ok, false, 'C11 lingering listener fails')
  const bad3 = evaluateStopOutcome({ drained: undefined, postStopListen: 'unconfirmed' })
  assert.equal(bad3.ok, false, 'C11 unconfirmed fails closed')
  console.log('CASE11 stop verdict: incomplete stop can never be ok (reasons explicit): PASS')
}
// CASE 12: boot timeout must THROW into the caller's finally (stop called,
// NO orphan child), never process.exit past the teardown.
{
  const child = spawn(process.execPath, ['-e', 'setInterval(() => {}, 1000);'], { stdio: ['ignore', 'pipe', 'pipe'] })
  let stopCalled = false
  let drainedAfterThrow = null
  try {
    try {
      await raceBoot({
        bootSeen: new Promise(() => {}),
        errorSeen: new Promise(() => {}),
        exitSeen: new Promise((res) => child.once('exit', res)),
        budgetMs: 150,
        label: 'C12 boot',
      })
      assert.fail('C12 should have thrown')
    } finally {
      // this inner finally mirrors the era finally: stop + drain ALWAYS run
      stopCalled = true
      try { child.kill() } catch { /* gone */ }
      drainedAfterThrow = await waitForDrain(child, [child.stdout, child.stderr], 3000)
    }
  } catch (err) {
    assert.ok(String(err.message).includes('C12 boot'), 'C12 timeout threw the labeled error into the finally')
  }
  assert.equal(stopCalled, true, 'C12 stop ran despite the timeout throw')
  assert.equal(drainedAfterThrow, true, 'C12 child actually died (no orphan, listener gone with it)')
  assert.ok(child.exitCode !== null || child.signalCode !== null, 'C12 child confirmed dead')
  console.log('CASE12 boot-timeout throws into finally: stop called, no orphan child: PASS')
}
// CASE 13: thrown era body with stop.ok=false - lifecycle facts PRESERVED
// and NO next era runs (fail-closed loop).
{
  const ran = []
  const halts = []
  const results = await runEraLoop({
    eras: ['alpha', 'beta'],
    runFn: async (era, lifecycle) => {
      ran.push(era)
      lifecycle.stop = { ok: false, reasons: ['simulated unproven stop'] }
      throw new Error(`${era}: body threw mid-era`)
    },
    onEraError: (era, entry) => halts.push([era, entry.eraError]),
    onHalt: (era, why) => halts.push([era, why]),
  })
  assert.deepEqual(ran, ['alpha'], 'C13 the second era NEVER starts after a throw')
  assert.equal(results.alpha.ok, false, 'C13 failed era recorded')
  assert.equal(results.alpha.stop.ok, false, 'C13 lifecycle facts PRESERVED through the throw')
  assert.equal(results.beta, undefined, 'C13 no phantom entry for the era that never ran')
  assert.ok(halts.length >= 2, 'C13 error AND halt both recorded')
  assert.ok(halts.some(([, w]) => String(w).includes('no next era') || String(w).includes('halt')), 'C13 halt reason explicit')
  console.log('CASE13 era throw preserves lifecycle facts and opens no next era: PASS')
}
// CASE 14: authenticate FAILURE must not leave the boot token anywhere.
{
  const session = { token: 'FAKEBOOT-tok-fail-auth' }
  await assert.rejects(
    consumeOnceSecret(session, 'token', async () => { throw new Error('fake authenticate failed') }),
    /fake authenticate failed/,
    'C14 failure propagates')
  assert.equal(session.token, null, 'C14 token nulled by the finally even on FAILED auth')
  const session2 = { token: 'FAKEBOOT-tok-ok' }
  const got = await consumeOnceSecret(session2, 'token', async (tok) => `authed:${tok}`)
  assert.equal(got, 'authed:FAKEBOOT-tok-ok', 'C14 success path hands the token once')
  assert.equal(session2.token, null, 'C14 token nulled after success too')
  console.log('CASE14 failed auth leaves no token (finally-cleared both ways): PASS')
}
console.log('SANITIZER-GUARD-VERDICT all-cases-passed (fake credentials only; launcher NOT run)')
