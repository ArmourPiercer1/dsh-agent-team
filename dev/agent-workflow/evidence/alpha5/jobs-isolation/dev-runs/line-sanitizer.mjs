/**
 * Root sanitizer-guard source-review fix: a per-stream line-buffered
 * sanitizing sink. ONE instance per stream (stdout and stderr NEVER share
 * the carry buffer - interleaved lines from two streams cannot splice a
 * phantom line or leak a per-stream partial). A line is only passed to
 * `redact` once it is COMPLETE (its newline has arrived), so a credential
 * split across write boundaries is redacted as a whole; the trailing
 * partial line is redacted and flushed on stream close (drain semantics:
 * writes are synchronous to an fd, so 'close' + flush is the full drain).
 * The earlier broken shape defined a sink but never consumed the pipes -
 * empty logs and a chatty child would have stalled on a full pipe. This
 * module exists so the behavior is importable and testable WITHOUT ever
 * running the launcher or touching real credentials.
 * @module dev-runs/line-sanitizer
 */
export function createSanitizingLineSink({ write, redact }) {
  let carry = ''
  let closed = false
  const emit = (line) => {
    try { write(redact(line)) } catch { /* best-effort: never crash the child's pipe */ }
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
  }
}
