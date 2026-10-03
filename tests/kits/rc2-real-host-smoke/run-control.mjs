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
 *   - the control may kill only the bound child, or its explicitly owned POSIX
 *     process group (spawned detached), never a port scan or pattern match;
 *   - the owner awaits stopChild() before disposal or world removal; Windows
 *     uses direct-child cleanup and does not promise descendant containment;
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
    childExited: false,
    childProcessGroup: false,
    childStopPromise: null,
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

  /** The child.killed flag means "signal sent", not "process exited". */
  const stopChild = ({ graceMs = 1_000, killWaitMs = 3_000 } = {}) => {
    if (state.childStopPromise !== null) return state.childStopPromise
    const child = state.child
    if (child === null) return Promise.resolve({ pid: null, exited: true, escalated: false, processGroup: false })
    const group = state.childProcessGroup
    const pid = child.pid
    stopWatchdog()
    const childExited = () => state.childExited || child.exitCode !== null || child.signalCode !== null
    const groupAlive = () => {
      if (!group || pid === undefined) return false
      try { process.kill(-pid, 0); return true } catch (error) {
        if (error.code === 'ESRCH') return false
        throw error
      }
    }
    const gone = () => (pid === undefined || childExited()) && !groupAlive()
    const signal = (name) => {
      try {
        if (group && pid !== undefined) process.kill(-pid, name)
        else if (pid !== undefined && !childExited()) child.kill(name)
      } catch (error) {
        if (error.code !== 'ESRCH') throw error
      }
    }
    const waitUntilGone = async (timeoutMs) => {
      const deadline = Date.now() + timeoutMs
      while (!gone()) {
        if (Date.now() >= deadline) return false
        await new Promise((resolve) => setTimeout(resolve, Math.min(20, Math.max(1, deadline - Date.now()))))
      }
      return true
    }
    state.childStopPromise = (async () => {
      let escalated = false
      if (!gone()) {
        if (graceMs > 0) {
          signal('SIGTERM')
          await waitUntilGone(graceMs)
        }
        // The leader may have exited while a shell descendant ignored SIGTERM.
        // Group liveness, not just leader exit, decides whether to escalate.
        if (!gone()) {
          escalated = true
          signal('SIGKILL')
          if (!(await waitUntilGone(killWaitMs))) {
            throw new Error(`owned ${group ? 'process group' : 'child'} ${pid} did not exit after SIGKILL`)
          }
        }
      }
      log(`RUN CONTROL: owned ${group ? 'process group' : 'child'} stopped (pid=${pid ?? 'not spawned'})`)
      return { pid: pid ?? null, exited: true, escalated, processGroup: group }
    })()
    // Abort callbacks cannot await. Keep the rejection observed until the owner
    // awaits the same promise in finally; a failure must still reject there.
    state.childStopPromise.catch(() => {})
    return state.childStopPromise
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
    void stopChild({ graceMs: 0 })
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
    /** Bind only our spawned child; processGroup requires a detached POSIX spawn. */
    bindChild(child, { lifetimeMs, watchdogIntervalMs, processGroup = false } = {}) {
      if (state.child !== null && state.child !== child) throw new Error('cannot replace an owned child before cleanup')
      state.child = child
      state.childStartedAt = Date.now()
      state.childExited = child.exitCode !== null || child.signalCode !== null
      state.childProcessGroup = processGroup && process.platform !== 'win32'
      state.childStopPromise = null
      stopWatchdog()
      child.once('exit', () => {
        state.childExited = true
        if (!state.childProcessGroup) stopWatchdog()
      })
      child.once('error', () => {
        if (child.pid === undefined) {
          state.childExited = true
          stopWatchdog()
        }
      })
      const ms = lifetimeMs ?? budget.limits.childLifetimeMs
      budget.limits.childLifetimeMs = ms
      if (state.aborted) {
        void stopChild({ graceMs: 0 })
        return { lifetimeMs: ms }
      }
      if (state.childExited) return { lifetimeMs: ms }
      state.watchdog = setInterval(() => {
        const elapsed = Date.now() - state.childStartedAt
        const v = budget.noteChildLifetime(elapsed)
        if (v === null) return
        state.watchdogFired = true
        stopWatchdog()
        requestAbort(v.detail, { elapsedMs: elapsed, pid: child?.pid ?? null })
      }, watchdogIntervalMs ?? Math.min(5_000, Math.max(1, ms)))
      // Never keep the loop alive by itself: the run's own work does that.
      if (typeof state.watchdog.unref === 'function') state.watchdog.unref()
      return { lifetimeMs: ms }
    },
    requestAbort,
    stopChild,
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
      void stopChild({ graceMs: 0 })
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
    /** After awaiting stopChild(): stop the watchdog and unbind the child. */
    dispose() {
      stopWatchdog()
      state.child = null
      state.armed = false
      return { watchdogFired: state.watchdogFired, violation: state.violation, budget: budget.snapshot() }
    },
  }
}
