/**
 * P8-T4 push model — the reconnect backoff rule (pure).
 *
 * Aligned with the P2-T6 reconnect characterization (the remote RPC seam
 * over the frozen `REMOTE_RPC_CHANNEL`):
 *
 *   - the two seam states are `connected` / `reconnecting` (R1);
 *   - on loss: state → `reconnecting`, the attempt counter increments,
 *     and the retry delay is exponential with a hard cap:
 *     `cap(attempt) = min(maxMs, baseMs · factor^(attempt−1))` (R2);
 *   - the concrete delay lies within `[cap/2, cap]` (R2: the observed
 *     delay never leaves half the cap up to the cap);
 *   - restart-after-stop re-enters `connected` with ZERO state-change
 *     events because the last seam state persists across the stop (R1);
 *   - state-change reporting is deduplicated: a transition to the state
 *     already current emits nothing (R1 / R3).
 *
 * The engine keeps no timers: the backoff is a computed delay the
 * client schedules through an injected `delay` function (the test
 * fixture drives it with a deterministic clock; a deployment injects a
 * real timer). This module only computes caps, bounds, delays and
 * state transitions.
 *
 * Pure module: no I/O, no node: builtins, no runtime environment
 * assumptions. Erasable TS only.
 * @module @dsh-agent-team/remote/push/reconnect
 */

import type { PushBackoffConfig, ReconnectState } from './types.js'

/**
 * A local (never wire-crossed) error for a backoff picker result outside
 * the frozen `[cap/2, cap]` bounds or a malformed delay.
 */
export class PushBackoffRangeError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'PushBackoffRangeError'
  }
}

/**
 * The exponential backoff cap for one loss attempt (P2-T6 R2 formula):
 * `min(maxMs, baseMs · factor^(attempt−1))`.
 * @param attempt - the 1-based loss attempt number.
 * @param cfg - the backoff configuration.
 * @returns the cap in milliseconds (integer).
 * @throws {PushBackoffRangeError} on a malformed attempt or configuration.
 */
export function backoffCapMs(attempt: number, cfg: PushBackoffConfig): number {
  if (!Number.isInteger(attempt) || attempt < 1) {
    throw new PushBackoffRangeError(`backoff attempt must be a positive integer: ${attempt}`)
  }
  if (!Number.isInteger(cfg.baseMs) || cfg.baseMs < 1) {
    throw new PushBackoffRangeError(`backoff baseMs must be a positive integer: ${cfg.baseMs}`)
  }
  if (!Number.isInteger(cfg.maxMs) || cfg.maxMs < 1) {
    throw new PushBackoffRangeError(`backoff maxMs must be a positive integer: ${cfg.maxMs}`)
  }
  if (!(cfg.factor >= 1)) {
    throw new PushBackoffRangeError(`backoff factor must be >= 1: ${cfg.factor}`)
  }
  const raw = cfg.baseMs * cfg.factor ** (attempt - 1)
  const cap = Math.min(cfg.maxMs, raw)
  return Math.floor(cap)
}

/**
 * The deterministic default delay picker: the lower bound of the frozen
 * `[cap/2, cap]` window (floor of half the cap, at least 1 ms). A
 * deployment may inject a picker anywhere inside the window; the engine
 * validates the result.
 * @param capMs - the backoff cap for the attempt.
 * @returns the delay in milliseconds, within `[capMs/2, capMs]`.
 */
export function defaultDelayPicker(capMs: number): number {
  return Math.max(1, Math.floor(capMs / 2))
}

/**
 * Pick the concrete retry delay for one backoff cap and validate it
 * against the frozen R2 bounds.
 * @param capMs - the backoff cap for the attempt.
 * @param pick - the delay picker (default: the deterministic lower bound).
 * @returns the delay in milliseconds, guaranteed within `[capMs/2, capMs]`.
 * @throws {PushBackoffRangeError} when the picker result leaves the window.
 */
export function pickBackoffDelayMs(
  capMs: number,
  pick: (cap: number) => number = defaultDelayPicker,
): number {
  const delay = pick(capMs)
  const lower = capMs / 2
  if (!Number.isInteger(delay) || delay < lower || delay > capMs) {
    throw new PushBackoffRangeError(
      `backoff delay ${delay} outside the frozen bounds [${lower}, ${capMs}]`,
    )
  }
  return delay
}

/**
 * The loss transition: any seam state under a channel loss becomes
 * `reconnecting` (P2-T6 R1).
 * @param current - the current seam state, or `null` before the first.
 * @returns the state after the loss.
 */
export function stateOnLoss(current: ReconnectState | null): ReconnectState {
  void current
  return 'reconnecting'
}

/**
 * The success transition: a completed pull/retry restores `connected`.
 * @returns the state after the successful round trip.
 */
export function stateOnConnect(): ReconnectState {
  return 'connected'
}

/**
 * Whether a state change event must be emitted for a transition (R1/R3
 * deduplication): `true` only when the new state differs from the last
 * emitted one; a restart that re-enters the persisted state emits
 * nothing.
 * @param last - the last emitted seam state (persisted across stops).
 * @param next - the state to transition to.
 * @returns whether the transition is a change.
 */
export function isStateChange(last: ReconnectState | null, next: ReconnectState): boolean {
  return last !== next
}
