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
import type { StreamingSpawnHandle, StreamingOptions } from '../../sandbox-provider/provider.js'
import type { ProviderLease } from '../../sandbox-provider/provider.js'
import type { ProviderResult } from '../../sandbox-provider/contract-stub.js'

/** The native-compatible handle surface (`ctx.subprocess.spawn` shape). */
export interface ConfinedSubprocessHandle {
  readonly pid: number
  readonly stdin: Writable
  readonly stdout: Readable
  readonly stderr: Readable
  /** Live accumulated output (both streams), updated as data arrives. */
  readonly collected: { stdout: string; stderr: string }
  /** Resolves when the process is observed to exit. */
  readonly done: Promise<{ code: number | null; signal: string | null }>
  /** Native alias of `done`. */
  waitForExit(): Promise<{ code: number | null; signal: string | null }>
  /** Signal escalation and lease settlement (idempotent, provider-owned). */
  terminate(options?: StreamingOptions): Promise<ProviderResult<ProviderLease>>
}

/**
 * Wrap a live confined handle with the native-compatible surface. The
 * `collected` record accumulates the decoded text of both streams; attaching
 * this wrapper does NOT consume the streams (a consumer may still read them).
 */
export function toSubprocessHandle(live: StreamingSpawnHandle): ConfinedSubprocessHandle {
  const collected = { stdout: '', stderr: '' }
  live.stdout.on('data', (chunk: unknown) => {
    collected.stdout += String(chunk)
  })
  live.stderr.on('data', (chunk: unknown) => {
    collected.stderr += String(chunk)
  })
  return Object.freeze({
    pid: live.pid,
    stdin: live.stdin,
    stdout: live.stdout,
    stderr: live.stderr,
    collected,
    done: live.exited,
    waitForExit: () => live.exited,
    terminate: (options?: StreamingOptions) => live.terminate(options),
  })
}
