/**
 * Alpha.5 P1-07 — `spawn(): SubprocessHandle` compatibility over the confined
 * streaming arm.
 *
 * The native consumers of `ctx.subprocess.spawn()` expect a LIVE handle:
 * stdin/stdout/stderr, a collected output record, a completion promise, an
 * idempotent terminate, and a wait-for-exit. This module maps the confined
 * provider's streaming arm onto exactly that shape, so a confined process is a
 * drop-in for the native one — with the ceiling compiled into the profile
 * BEFORE the process exists (see `runner.ts`).
 *
 * It never creates a process itself: `spawnConfinedSubprocess` is a pure
 * adapter over an already-planned confined run.
 *
 * @module @dsh-agent-team/runtime/team-sandbox/subprocess
 */

import type { Readable, Writable } from 'node:stream'
import type { ProviderLease, ProviderResult, StreamingOptions, StreamingSpawnHandle } from '../../sandbox-provider/index.js'

export interface SubprocessHandleOptions {
  /**
   * Accumulate both streams into `collected`. OFF by default: attaching `data`
   * listeners puts a stream into flowing mode and would steal chunks from a
   * later `for await` reader (the native grep/readline consumers). A caller that
   * wants `collected` opts in and must not also read the same stream.
   */
  readonly capture?: boolean
}

/** The native-compatible handle surface (`ctx.subprocess.spawn` shape). */
export interface ConfinedSubprocessHandle {
  readonly pid: number
  readonly stdin: Writable
  readonly stdout: Readable
  readonly stderr: Readable
  /** Accumulated output when `capture: true`; always empty otherwise. */
  readonly collected: { stdout: string; stderr: string }
  /** Whether `collected` is being accumulated. */
  readonly capturing: boolean
  /** Resolves when the process is observed to exit. */
  readonly done: Promise<{ code: number | null; signal: string | null }>
  /** Native alias of `done`. */
  waitForExit(): Promise<{ code: number | null; signal: string | null }>
  /** Signal escalation and lease settlement (idempotent, provider-owned). */
  terminate(options?: StreamingOptions): Promise<ProviderResult<ProviderLease>>
}

/**
 * Wrap a live confined handle with the native-compatible surface. Streams are
 * NOT consumed unless `capture: true`; with capture on, the wrapper owns the
 * `data` events (see {@link SubprocessHandleOptions.capture}).
 */
export function toSubprocessHandle(
  live: StreamingSpawnHandle,
  options: SubprocessHandleOptions = {},
): ConfinedSubprocessHandle {
  const capture = options.capture === true
  const collected = { stdout: '', stderr: '' }
  if (capture) {
    live.stdout.on('data', (chunk: unknown) => {
      collected.stdout += String(chunk)
    })
    live.stderr.on('data', (chunk: unknown) => {
      collected.stderr += String(chunk)
    })
  }
  return Object.freeze({
    pid: live.pid,
    stdin: live.stdin,
    stdout: live.stdout,
    stderr: live.stderr,
    collected,
    capturing: capture,
    done: live.exited,
    waitForExit: () => live.exited,
    terminate: (options?: StreamingOptions) => live.terminate(options),
  })
}
