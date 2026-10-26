/**
 * process-family/src/shell-mechanics — the PROCESS family's shell-class
 * settlement MECHANICS (U6 PR3; U6-SLICE-PLAN PR3: "move
 * plane-effect-backends.mjs:678-1073 + the shell decide class tables
 * into the contribution"). Moved VERBATIM from the center file at master
 * cd54f3b7c (SYSTEM_RX / raceShellSettle / shellCancelled /
 * SHELL_STREAM_DRAIN_MS / drainShellStdio — every law comment carried
 * with the code: the closed tie law exited > timedOut > aborted, the
 * closed AgentCancelCause cancel law, the drain-on-exit completeness
 * law). The center file (`plane-effect-backends.mjs`) keeps the OLD
 * export surface as a re-export so every pinned consumer (a5b2-exit-code-
 * fidelity, a5b3-cancel-leg, alpha5-glue7-plane-backends) resolves
 * UNCHANGED — the PR2 fs-family precedent.
 *
 * @module process-family/shell-mechanics
 */
import { setTimeout as sleepTimer, clearTimeout as clearSleepTimer } from 'node:timers'

/** System path entries the confined shell needs to boot `/bin/sh` (rx only). */
export const SYSTEM_RX = (path) => ({ path, accessBits: { execute: true, readFile: true, readDir: true } })

/**
 * The shell backend over the CONFINED Process provider (P-B assembly face +
 * P-LSP streaming arm). The provider owns every law: probe capture, launcher
 * byte-pin double gate, one-shot plan, lease states, terminate escalation.
 * This adapter only shapes the a5p5 call into a `SpawnRequest` and the
 * streaming handle back into a `ShellOutcome` (streaming raw bytes into the
 * pipeline's spill sink while the lease is ACTIVE, per the spill law).
 */
/**
 * THE SETTLE RACE (B3; pinned by a5b3-cancel-leg.test.ts C8/C9 with DETERMINISTIC
 * injection — a controlled deferred for `exited`, an injected fake `sleep` for the
 * timeout leg — never a timing bet). The race's registration order is a CLOSED TIE
 * LAW — `exited > timedOut > aborted`: when several facts already exist at setup,
 * Promise.race settles on the FIRST registered leg, so
 *  - a payload that reported its own end OUTRANKS a cancel that arrived in the
 *    same window (the measured code is the truth; 根②: no dual truth), and
 *  - the timeout leg OUTRANKS the abort leg registered after it (根③: the
 *    timed-out form owns the answer; the `!timedOut` guard in `shellCancelled`
 *    keeps that law even if a late abort lands while the timeout arm is still
 *    terminating the payload).
 * The first settlement is FINAL (Promise semantics): a later fact can never
 * rewrite the winner — exactly one of {exit code, timed-out, aborted} is ever
 * observed for one call. `sleep` is injectable so the legs pin THIS function
 * instead of a spec-side reimplementation; production calls pass no sleep.
 *
 * NO LEG REJECTS — that is why removing the listener in `.then` is complete
 * (root 16:30Z ①, proven from the contract, not vibes): `exited` is the
 * provider's stream handle, constructed RESOLVE-ONLY at provider.ts:657-660;
 * even a rejected `proc.exit` is absorbed there into a resolve of
 * `{code:null, signal:'exit-error'}` (provider.ts:649-653); the timeout leg
 * resolves through the timer callback; the abort leg only ever resolves. The
 * race therefore has no rejection path that could strand the listener.
 * CLEANUP, ENUMERATED HONESTLY (root 16:30Z ②): this round ADDED the abort
 * listener and REMOVES it once the race settles (the new surface, cleaned).
 * The timeout timer keeps its HISTORICAL shape byte-for-byte: no handle kept,
 * never cleared — an early winner leaves it scheduled to fire into a decided
 * race, exactly as the pre-B3 shell race and the still-untouched search arm
 * (:496) do. This is a preserved pre-existing property, not a full-cleanup
 * claim. PRE-ABORT BOUNDARY (root 16:30Z ③, measured before worded): the race
 * is registered AFTER the provider spawn, so a signal that already fired still
 * finds a spawned payload — the spawn-side outDir (provider.ts:496-497) proves
 * the call reached spawn regardless of what the payload then does. This row's
 * honest act is the immediate controlled `terminate()`; measured, its
 * first-tick SIGTERM landed before the payload's first statement ran (row
 * settled in ~240ms, no payload side effect), so whether any payload STATEMENT
 * ever executes is not row-determined — C11 records that fact without betting
 * either direction,
 * and no wording may turn "terminated under control, fast" into "never
 * started" or "always ran". The host does not route such a call here at all —
 * its dispatch pre-check (core/tools/src/index.ts:1572-1574) answers
 * `toolAbortedBeforeDispatchResult` before `execute`; this leg is the belt
 * for direct/non-host callers of the seam.
 */
export function raceShellSettle({ exited, timeoutMs, signal, sleep = sleepTimer }) {
  let onAbort = null
  const abortLeg = signal === undefined
    ? null
    : new Promise((r) => {
      onAbort = () => { r({ aborted: true }) }
      if (signal.aborted === true) onAbort() // 根①: already fired before the call — settles at setup, deterministically
      else signal.addEventListener('abort', onAbort, { once: true })
    })
  return Promise.race([
    exited,
    new Promise((r) => sleep(() => r({ timedOut: true }), timeoutMs)),
    ...(abortLeg === null ? [] : [abortLeg]),
  ]).then((winner) => {
    if (signal !== undefined && onAbort !== null) signal.removeEventListener('abort', onAbort)
    return winner
  })
}

/**
 * THE CLOSED CANCELLED LAW (B3; table-pinned by C10, exercised end to end by
 * C1-C6): `cancelled` is minted ONLY for the two arms of the host's closed
 * AgentCancelCause union that mean "someone asked this call to stop" — `user` and
 * `parent`. The range is MEASURED, not imagined (根⑤): the union is exactly
 * user|parent|hook|disposed at the baseline (host
 * packages/core/session/src/types.ts:189-193; C10 re-reads the declaration from
 * the baseline checkout — resolved through tests/paths.mjs, and FAILING CLOSED
 * when it cannot be read, so a source-side change trips the leg before the law
 * ever ships and no environment lacking the source can tally it as verified).
 * `hook`/`disposed` HONOR the abort — the
 * payload is still terminated through the frozen arm — but keep the death shape
 * (`exit=not-observed`, cancelled false): a hook firing or a teardown is not
 * someone pressing cancel, and the renderer must never claim it was. A cause
 * outside the union's shape (no object, no EXACT discriminator) is not a cause at
 * all. `timedOut` owns its own form (根③); a signal that never fired is not a
 * cancel. The settlement vocabulary is untouched: the six closed names, an
 * aborted body being exactly a `dispatcher-call-terminated-after-body-start`.
 */
export function shellCancelled({ timedOut, aborted, reason }) {
  const kind = reason !== null && typeof reason === 'object' ? /** @type {{ kind?: unknown }} */ (reason).kind : undefined
  return !timedOut && aborted === true && (kind === 'user' || kind === 'parent')
}

/**
 * B4 DRAIN-ON-EXIT (A5-M1 间歇红): the shell row's completion event is the
 * launcher's PROCESS DEATH (`h.exited`, resolve-only on the child 'exit' event —
 * the confined provider's own defaultSpawnStream in its provider.ts), and
 * Node's own child-process
 * contract is that 'exit' may fire while stdio chunks are still in flight:
 * 'close'/'end', not 'exit', is the stream-end event. The row's post-exit path is
 * microtask-only once the payload is confirmed dead (the provider's terminate
 * loop breaks on its first iteration when `/proc/<pid>` is gone and
 * settleTermination never yields to I/O), so reading `stdout` straight after the
 * settle race captured only whatever had ALREADY been delivered — on a starved
 * event loop the death notification can overtake the still-queued pipe read and
 * the row answers `exit=0` over an EMPTY body (the intermittent CI shape at
 * a5-m1-auth-bridge :1915-1917; renderShellResult prints that capture as
 * `bash · exit=0` + `(empty stdout)`).
 * THE WAIT IS FINITE BY CONSTRUCTION for this row: the stream arm of the
 * launcher closes its OWN fd 0/1/2 before waitpid (landlock-prelauncher.py
 * mode_confined_exec_stream), so the payload is the ONLY pipe writer and its
 * death IS the pipe's EOF — once terminate confirmed the payload gone, 'end' is
 * the next reads' inevitable fact and a normal run pays ONE macrotask.
 * The bound below exists for the single shape that outruns that law: a payload
 * that leaves a DESCENDANT still holding fd 1/2 (`cmd &`). That hole is measured
 * house history, not speculation — the glob row's DRAIN-INCOMPLETE leg
 * (glob-backend.mjs, root ruling ①) recorded that provider stdio streams are NOT
 * guaranteed to close at lease settle, which is exactly why this is a bounded
 * stream-end await and NEVER a fixed sleep.
 * THE COMPLETENESS LAW (root narrow-review ruling, B4): only the real EOF — the
 * stream's 'end' / `readableEnded` — proves the pipe delivered everything the
 * writer flushed before its death. Every other settle point is INCOMPLETE: an
 * early `destroy`, a 'close' without a prior 'end', an 'error', or the bound
 * expiring. A teardown settles the drain IMMEDIATELY (no paying the bound for
 * bytes that can no longer arrive) but answers `complete: false`; the bound
 * answers `complete: false` too. The two incompletions are distinguishable
 * (`shortOf: 'stdio' | 'bound'`) and both reach the row as `truncated: true`
 * plus the DRAIN-INCOMPLETE audit line — bytes stay as captured, and the
 * settlement law above is untouched: exit code / timed-out / cancelled were
 * already decided by `raceShellSettle` and no drain answer rewrites them.
 * A stream that ENDED and was destroyed afterwards stays COMPLETE (the EOF
 * stands; a routine post-end 'close' must not downgrade a healthy run).
 * Two streams settle as an AND: complete only when EVERY present stream ended.
 * `sleep` is injectable exactly like `raceShellSettle`'s; the bound timer is
 * unref'd and cleared once the drain answers, so a pending drain never keeps
 * the process alive nor lingers after its answer.
 */
export const SHELL_STREAM_DRAIN_MS = 2_000

/**
 * Resolves `{ complete: boolean; shortOf: 'bound' | 'stdio' | null }`.
 * `shortOf` names WHICH leg closed an incomplete drain ('stdio' = a teardown
 * or error hit before EOF on some stream; 'bound' = the production bound
 * expired with a pipe still held); `null` only on the complete answer.
 */
export function drainShellStdio({ stdout, stderr, boundMs, sleep = sleepTimer }) {
  return new Promise((resolve) => {
    const streams = [stdout, stderr].filter((s) => s !== null && s !== undefined)
    let finished = false
    let timer = null
    /** @type {Array<{ stream: any, ended: boolean, onEnd: () => void, onClose: () => void, onError: () => void }>} */
    const watched = []
    const finish = (complete, shortOf) => {
      if (finished) return
      finished = true
      for (const w of watched) {
        w.stream.off('end', w.onEnd)
        w.stream.off('close', w.onClose)
        w.stream.off('error', w.onError)
      }
      if (timer !== null && timer !== undefined) clearSleepTimer(timer) // no-op for a custom sleep's handle shape
      resolve({ complete, shortOf })
    }
    let endedCount = 0
    for (const s of streams) {
      if (s.readableEnded === true) { endedCount += 1; continue } // real EOF already stands (even if later destroyed)
      if (s.destroyed === true) { finish(false, 'stdio'); return } // torn down before EOF: nothing can arrive
      const w = { stream: s, ended: false, onEnd: () => {}, onClose: () => {}, onError: () => {} }
      w.onEnd = () => {
        w.ended = true
        endedCount += 1
        if (endedCount === streams.length) finish(true, null) // AND: every stream brought its EOF
      }
      // close/error while THIS stream never saw its 'end': the capture is cut
      // short — settle now (waiting the bound would change nothing) and SAY so.
      w.onClose = () => { if (!w.ended) finish(false, 'stdio') } // post-end 'close' is routine: ignored
      w.onError = () => { if (!w.ended) finish(false, 'stdio') } // an error is not an EOF either
      s.once('end', w.onEnd)
      s.once('close', w.onClose)
      s.once('error', w.onError)
      watched.push(w)
    }
    if (endedCount === streams.length) { finish(true, null); return } // ZERO-COST PATH: real EOFs only — no listeners kept, NO bound armed (pinned by D5)
    timer = sleep(() => finish(false, 'bound'), boundMs)
    if (timer !== null && timer !== undefined) timer?.unref?.()
  })
}
