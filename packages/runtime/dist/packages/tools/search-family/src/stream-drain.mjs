/**
 * u7 grep-drain — THE STREAM DRAIN LAW the two async confined-rg rows share
 * (anchored search `search-backend.mjs`, anchored glob `glob-backend.mjs`).
 * Small on purpose, and used by those two rows and nobody else.
 *
 * WHY IT EXISTS. The provider's `exited` is the launcher's 'exit' event, and
 * Node may fire 'exit' while the child's stdio 'data' callbacks are still
 * pending (child_process docs: "stdio streams might still be open"). A row that
 * reads its buffers at `exited` judges a walk it has not finished hearing. The
 * glob row learned this in the g6b-flake rounds (stdout end-collection, round-8)
 * and the grep row did not: under census load (hosted run 40397268848) its
 * stderr classifier saw an empty string, and the same race on the coverage law
 * ADMITTED a walk whose `Permission denied` line had not arrived yet
 * (`packages/runtime/test/u7-grep-late-stream.test.ts`).
 *
 * WHAT IT OWNS: mechanics only — the watch, the bound, the release. It owns no
 * verdict and no wording: each row decides what an undrained stream means under
 * its own completion law and refuses through its own `failure()` face.
 *
 *  1. `watchStreamEnd(stream)` — installed BEFORE the settle race, so a terminal
 *     event that arrives first is never missed. The FIRST of 'end' | 'close' |
 *     'error' settles it, with its name: only 'end' is a stream that was heard
 *     to its last byte; 'close' without 'end' is a torn-down pipe and 'error' a
 *     dead one. `release()` takes every handler off (idempotent), so a
 *     long-lived assembly accumulates no listeners.
 *  2. `awaitBounded(promise, boundMs)` — the drain is BOUNDED: the value, or
 *     `null` when the bound expired first. The timer is unref'd and cleared on
 *     both exits, so a drain leaves no timer behind.
 *
 * THE BOUND, `STREAM_DRAIN_MS` = 250 ms, IS the glob row's measured cap-family
 * constant (`GLOB_STDERR_DRAIN_MS` aliases it; round-4 `probe3_streamarm` endwait 0/400 lost reads; evidence
 * `dev/agent-workflow/evidence/alpha5/g6b-flake/step-b/README.md` "cap 取值依据").
 * It is awaited only AFTER the owned terminate: the launcher closes fds 0/1/2
 * before it waits, so once 'exit' fires no writer holds the pipes and the
 * normal path settles in microtasks; the bound only covers a provider that
 * breaks that promise. An expired bound is NEVER read as success.
 *
 * @module search-family/stream-drain
 */
import { setTimeout as sleepTimer, clearTimeout as clearTimer } from 'node:timers'

/** Upper bound on waiting for a child's streams AFTER it exited (drain, not
 *  lifetime). ONE constant for both rows: the glob row's `GLOB_STDERR_DRAIN_MS`
 *  is this value (it is owned HERE so the import graph stays acyclic — the
 *  grep row already imports the glob row). */
export const STREAM_DRAIN_MS = 250

/**
 * Watch one stream to its terminal event.
 * @param stream a Readable (the provider handle's `stdout` / `stderr`)
 * @returns {{ ended: Promise<'end'|'close'|'error'>, release: () => void }}
 */
export function watchStreamEnd(stream) {
  let release = () => {}
  const ended = new Promise((resolve) => {
    const onEnd = () => resolve('end')
    const onClose = () => resolve('close')
    const onError = () => resolve('error')
    stream.once('end', onEnd)
    stream.once('close', onClose)
    stream.once('error', onError)
    release = () => {
      release = () => {} // idempotent: a row's `finally` may call it again
      stream.off('end', onEnd)
      stream.off('close', onClose)
      stream.off('error', onError)
    }
  })
  return { ended, release: () => release() }
}

/**
 * Await `promise` for at most `boundMs`.
 * @returns the settled value, or `null` when the bound expired first
 */
export async function awaitBounded(promise, boundMs = STREAM_DRAIN_MS) {
  let timer = null
  try {
    return await Promise.race([
      promise,
      new Promise((resolve) => { timer = sleepTimer(() => resolve(null), boundMs).unref?.() ?? null }),
    ])
  } finally {
    if (timer !== null) clearTimer(timer)
  }
}
