/**
 * run-control.mjs — who owns the spawned host, and how a failure reaches them.
 *
 * THE DEFECT THIS EXISTS FOR (independent review of PR #62 @ 0ff5bbe1,
 * 2026-10-03): the rc2 kit's storm guard called `dieFatal()`, which called
 * `process.exit(2)` from inside the mock's `decide` callback. `main()`'s
 * `finally` — the ONLY place that stops the child host and closes the mock —
 * never ran, so a guard trip left a host process (and its world) behind; and
 * nothing bounded the child's lifetime independently of the waits, so a stuck
 * host could outlive the run. A resource limit that leaks the resource it was
 * protecting is not a limit.
 *
 * THE CONTRACT:
 *   - the kit's `main()` is the OWNER of the child host + the mock;
 *   - every failure path (budget violation, unexpected wire shape, a throw in a
 *     leg, SIGINT/SIGTERM) unwinds INTO that owner by throwing `RunAborted`, so
 *     `finally` always releases the resources;
 *   - only the top-level script may call `process.exit`, and only after the
 *     owner's cleanup has completed;
 *   - the control may kill EXACTLY the process it was given (`bindChild`), never
 *     a port scan, a pattern match, or anyone else's host;
 *   - an independent watchdog bounds the child's lifetime by wall time,
 *     separately from every wait, and firing it goes through the same unwind.
 *
 * `requestAbort()` (no throw) is for contexts where throwing is wrong — the
 * mock's `decide` callback and signal handlers; `abort()` = requestAbort + throw
 * for the normal call stack. Both are idempotent: the first cause is the one
 * that gets recorded and reported.
 */

import { createRunBudget } from './run-budget.mjs'

export class RunAborted extends Error {
  constructor(reason, violation) {
    super(`run aborted: ${reason}`)
    this.name = 'RunAborted'
    this.reason = reason
    this.violation = violation ?? null
    this.exitCode = 2
  }
}

/**
 * @param {object} opts
 * @param {(line: string) => void} opts.log
 * @param {(name: string, content: unknown) => void} [opts.writeEvidence]
 * @param {Partial<import('./run-budget.mjs').DEFAULT_BUDGET>} [opts.limits]
 * @param {{ decideReplyOnError?: boolean }} [opts.behaviour]
 */
export function createRunControl(opts) {
  const { log = () => {}, writeEvidence = () => {}, limits = {} } = opts ?? {}
  const controller = new AbortController()
  const budget = createRunBudget(limits)
  const state = {
    armed: false,
    violation: null,
    child: null,
    childStartedAt: 0,
    watchdog: null,
    watchdogFired: false,
    signalsInstalled: false,
    aborted: false,
  }

  const recordViolation = (violation, extra) => {
    if (state.violation !== null) return state.violation
    state.violation = { ...violation, extra: extra ?? null, at: new Date().toISOString(), budget: budget.snapshot() }
    try {
      writeEvidence('run-abort.json', state.violation)
    } catch {
      /* evidence is best-effort; the abort itself must still happen */
    }
    log(`RUN CONTROL: ${violation.kind} — ${violation.detail} (evidence: run-abort.json)`)
    return state.violation
  }

  const killOwnChild = (why) => {
    const child = state.child
    if (child === null || child === undefined) return false
    if (typeof child.killed === 'boolean' ? child.killed : child.exitCode !== null) return false
    try {
      child.kill('SIGKILL')
      log(`RUN CONTROL: killed this run's own child (pid=${child.pid}) — ${why}`)
      return true
    } catch (err) {
      log(`RUN CONTROL: killing own child failed: ${String((err && err.message) ?? err)}`)
      return false
    }
  }

  const stopWatchdog = () => {
    if (state.watchdog !== null) {
      clearInterval(state.watchdog)
      state.watchdog = null
    }
  }

  const onSignal = (signal) => {
    log(`RUN CONTROL: received ${signal} — unwinding through the owner's cleanup`)
    requestAbort(`received ${signal}`)
  }

  /** No-throw abort, for `decide` callbacks and signal handlers. */
  const requestAbort = (reason, extra) => {
    const violation = recordViolation({ kind: 'aborted', detail: reason }, extra)
    state.aborted = true
    killOwnChild(reason)
    if (!controller.signal.aborted) {
      try {
        controller.abort(new RunAborted(reason, violation))
      } catch {
        /* AbortController.abort never throws in practice; never mask the abort */
      }
    }
    return violation
  }

  return {
    budget,
    signal: controller.signal,
    state,
    /** Inside `main`'s try: a fatal must THROW so the owner's finally runs. */
    arm() {
      state.armed = true
    },
    disarm() {
      state.armed = false
    },
    armed: () => state.armed,
    violation: () => state.violation,
    aborted: () => state.aborted,
    /** The only process this control is allowed to kill. */
    bindChild(child, { lifetimeMs, watchdogIntervalMs } = {}) {
      state.child = child
      state.childStartedAt = Date.now()
      stopWatchdog()
      const ms = lifetimeMs ?? budget.limits.childLifetimeMs
      state.watchdog = setInterval(() => {
        const elapsed = Date.now() - state.childStartedAt
        const v = budget.noteChildLifetime(elapsed)
        if (v === null) return
        state.watchdogFired = true
        stopWatchdog()
        requestAbort(v.detail, { elapsedMs: elapsed, pid: child?.pid ?? null })
      }, watchdogIntervalMs ?? 5_000)
      // Never keep the loop alive by itself: the run's own work does that.
      if (typeof state.watchdog.unref === 'function') state.watchdog.unref()
      return { lifetimeMs: ms }
    },
    requestAbort,
    /** Throwing abort, for the normal call stack. */
    abort(reason, extra) {
      const violation = requestAbort(reason, extra)
      throw new RunAborted(reason, violation)
    },
    /** Report a budget violation observed elsewhere (decide entry). */
    reportViolation(violation, extra) {
      if (violation === null || violation === undefined) return null
      const recorded = recordViolation(violation, extra)
      state.aborted = true
      killOwnChild(recorded.detail)
      if (!controller.signal.aborted) {
        try {
          controller.abort(new RunAborted(recorded.detail, recorded))
        } catch {
          /* see requestAbort */
        }
      }
      return recorded
    },
    /** Throws if an abort already happened (cheap check at leg boundaries). */
    check() {
      if (state.aborted) {
        throw new RunAborted(state.violation?.detail ?? 'aborted', state.violation)
      }
    },
    installSignalHandlers() {
      if (state.signalsInstalled) return () => {}
      state.signalsInstalled = true
      const handlers = [['SIGINT', onSignal], ['SIGTERM', onSignal]]
      for (const [name, fn] of handlers) process.on(name, fn)
      return () => {
        for (const [name, fn] of handlers) process.off(name, fn)
        state.signalsInstalled = false
      }
    },
    /** Called from the owner's finally: stop the watchdog, unbind the child. */
    dispose() {
      stopWatchdog()
      state.child = null
      state.armed = false
      return { watchdogFired: state.watchdogFired, violation: state.violation, budget: budget.snapshot() }
    },
  }
}
