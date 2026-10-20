/**
 * Root sanitizer-guard source-review fix: a per-stream line-buffered
 * sanitizing sink. ONE instance per stream (stdout and stderr NEVER share
 * the carry buffer - interleaved lines from two streams cannot splice a
 * phantom line or leak a per-stream partial). A line is only passed to
 * `redact` once it is COMPLETE (its newline has arrived), so a credential
 * split across write boundaries is redacted as a whole; the trailing
 * partial line is redacted and flushed on stream close. Drain is VERIFIED,
 * never a fixed sleep: waitForDrain below observes child exit + both stream
 * closes with a bounded timeout, and a timeout is an EXPLICIT incomplete
 * (silent loss is the failure mode this guards).
 * The earlier broken shape defined a sink but never consumed the pipes -
 * empty logs and a chatty child would have stalled on a full pipe. This
 * module exists so the behavior is importable and testable WITHOUT ever
 * running the launcher or touching real credentials.
 * @module dev-runs/line-sanitizer
 */
export function createSanitizingLineSink({ write, redact, onLine }) {
  let carry = ''
  let closed = false
  const errors = [] // STICKY capture failures: explicit, never silent.
  const emit = (line) => {
    // The RAW line is offered to onLine strictly IN MEMORY (the kit
    // extracts the bootstrap marker here and never lets the raw form touch
    // disk). A line whose redaction or write FAILS is recorded and dropped
    // as an explicit marker - NEVER written raw as a fallback.
    if (onLine !== undefined) {
      try { onLine(line) } catch (err) { errors.push(`onLine: ${String(err?.message ?? err).slice(0, 120)}`) }
    }
    try {
      write(redact(line))
    } catch (err) {
      errors.push(`write: ${String(err?.message ?? err).slice(0, 120)}`)
      try { write('[REDACTION-FAILED: line dropped, never written raw]') } catch { /* fd is gone */ }
    }
  }
  const onData = (chunk) => {
    if (closed) return
    carry += String(chunk)
    const lines = carry.split('\n')
    carry = lines.pop() ?? '' // the trailing PARTIAL line stays in the carry
    for (const line of lines) emit(line)
  }
  const onEnd = () => {
    if (closed) return
    closed = true
    if (carry.length > 0) { emit(carry); carry = '' }
  }
  return {
    onData,
    onEnd,
    /** Attach to a Readable (sets encoding; wires data + close). */
    attach(stream) {
      stream.setEncoding('utf8')
      stream.on('data', onData)
      stream.on('close', onEnd)
      return this
    },
    get pending() { return carry },
    get errors() { return errors.slice() },
  }
}

/**
 * Verify a real drain: resolve true when the child has EXITED and both
 * output streams have CLOSED; resolve false when the bounded budget elapses
 * first - the caller MUST record that as DRAIN-INCOMPLETE (never silently
 * proceed). A fixed sleep before closing the log fd is not a drain and is
 * banned by this shape.
 * @param child - the spawned child (may already be gone).
 * @param streams - the child's output streams (stdout, stderr).
 * @param budgetMs - bounded wait before declaring incomplete.
 * @returns resolves true = verified drain; false = bounded timeout hit.
 */
export function waitForDrain(child, streams, budgetMs) {
  const closedOf = (stream) => new Promise((res) => {
    // destroyed / readableEnded are NOT closed: only the actual 'close'
    // (after the final flush) counts, so the fd closes strictly after the
    // sink's trailing partial has been written.
    if (stream === null || stream === undefined || stream.closed === true) { res(); return }
    stream.once('close', res)
  })
  const exited = new Promise((res) => {
    if (child !== null && child !== undefined && (child.exitCode !== null || child.signalCode !== null)) { res(); return }
    child.once('exit', res)
  })
  return Promise.race([
    Promise.all([exited, ...streams.map(closedOf)]).then(() => true),
    new Promise((res) => setTimeout(() => res(false), budgetMs)),
  ])
}

/**
 * The era-stop verdict - ONE place, so 'ALL GREEN' can never survive an
 * incomplete stop: verified drain AND post-stop listener absence are both
 * required; every failure names its reason (never silent).
 * @param state - { drained, postStopListen } from the kit run.
 * @returns { ok, reasons } ok=false lists every unmet condition.
 */
export function evaluateStopOutcome({ drained, postStopListen }) {
  const reasons = []
  if (drained !== true) reasons.push('drain not verified (child exit + both stream closes unobserved; late output may be missing)')
  if (postStopListen !== 'no-listener') reasons.push(`post-stop listener state '${String(postStopListen)}' is not a proven stop`)
  return { ok: reasons.length === 0, reasons }
}
