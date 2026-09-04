/**
 * P8-T4 push model — the whole-projection generation rule (pure).
 *
 * The server-side truth is the monotonic `generation` of the frozen
 * `RemoteProjectionValue` (>= 1, contracts/types). The client-side rule
 * is the exact mirror of the frozen P8-T1 stale guard
 * (`isStaleTeamProjection`, packages/contracts/projection):
 *
 *   stale  ⇔  same teamSessionId AND incoming.generation <= current
 *
 * which, on a per-client basis, decomposes into the closed verdict set
 * (`generation.ts` decides; `pull.ts` lifts the decision onto a frozen
 * `RemoteResponse`):
 *
 *   first frame (nothing applied yet)            → apply
 *   different teamSessionId                      → foreign
 *   incoming.generation >  applied.generation    → apply
 *   incoming.generation == applied.generation    → duplicate
 *   incoming.generation <  applied.generation    → stale
 *
 * Gate G8 consequence: a frame is applied IFF it is strictly newer, so a
 * delayed / duplicated / out-of-order response can never overwrite a new
 * state.
 *
 * Pure module: no I/O, no node: builtins, no runtime environment
 * assumptions. Erasable TS only.
 * @module @dsh-agent-team/remote/push/generation
 */

import type { AppliedProjectionIdentity, FrameVerdict } from './types.js'

/**
 * The minimum legal projection generation (frozen: `generation >= 1`
 * safe integer, contracts/types).
 */
export const PUSH_MIN_GENERATION = 1

/**
 * Whether a candidate generation is strictly newer than the applied
 * generation.
 * @param candidate - the incoming frame's generation.
 * @param applied - the applied generation, or `null` before the first
 *   frame.
 * @returns `true` when the frame must replace the applied state.
 */
export function isStrictlyNewerGeneration(
  candidate: number,
  applied: number | null,
): boolean {
  if (applied === null) {
    return candidate >= PUSH_MIN_GENERATION
  }
  return candidate > applied
}

/**
 * Decide the closed verdict of one incoming frame against the applied
 * state (the mirror of the frozen stale guard, see module doc).
 * @param applied - the applied identity, or `null` before the first frame.
 * @param incoming - the frame identity (`teamSessionId` + `generation`).
 * @returns the closed `FrameVerdict`.
 */
export function decideFrameVerdict(
  applied: AppliedProjectionIdentity | null,
  incoming: { readonly teamSessionId: string; readonly generation: number },
): FrameVerdict {
  if (applied === null) {
    return 'apply'
  }
  if (applied.teamSessionId !== incoming.teamSessionId) {
    return 'foreign'
  }
  if (isStrictlyNewerGeneration(incoming.generation, applied.generation)) {
    return 'apply'
  }
  if (incoming.generation === applied.generation) {
    return 'duplicate'
  }
  return 'stale'
}
