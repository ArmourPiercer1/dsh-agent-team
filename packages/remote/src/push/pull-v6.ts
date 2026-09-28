/**
 * team-view-sync-complete Phase 2 — the v6 pair-identity pull surface
 * (pure).
 *
 * Contract v6 carries the client freshness identity as the frozen PAIR
 * `{ durableGeneration, liveToken }` (frozen design decision 4):
 *
 * - `durableGeneration` — the durable whole-projection generation (===
 *   the wire `generation`; the v6 value names it explicitly). It stays
 *   DURABLE-ONLY: live state never advances it.
 * - `liveToken` — a deterministic opaque token over the semantic live
 *   state (sorted per-member `{ instanceId, residency }`; no clock
 *   stamps, no process counters). It changes ONLY when the semantic live
 *   state changes.
 *
 * The frozen pair verdict (against the applied identity):
 *
 * | applied vs received                              | status    |
 * | ------------------------------------------------ | --------- |
 * | applied = null (first frame)                     | `apply`   |
 * | different `teamSessionId`                        | `foreign` |
 * | durableGeneration strictly NEWER                 | `apply`   |
 * | durableGeneration EQUAL, liveToken DIFFERENT     | `apply`   |
 * | durableGeneration EQUAL, liveToken EQUAL         | `duplicate` |
 * | durableGeneration strictly OLDER                 | `stale`   |
 *
 * The two `apply` cases are deliberately the SAME status: the applied
 * `generation` (durable) is the client's single ledger-refresh trigger —
 * a live-only advance applies the frame WITHOUT advancing the durable
 * generation, so the mount's generation-advance subscription naturally
 * does NOT refresh the ledger (frozen decision 4: "live-only → apply the
 * overlay, NO ledger refresh"). `durableGeneration`/`liveToken` are
 * NEVER mutated by the assessment — the assessment only decides.
 *
 * Pure module: no I/O, no node: builtins, no runtime environment
 * assumptions. Erasable TS only.
 * @module @dsh-agent-team/remote/push/pull-v6
 */

import type { ProjectionSyncAssessment } from './types.js'
import type { RemoteProvenance, RemoteResponse } from '../contracts/response.js'
import type {
  RemoteProjectionValue,
  RemoteProjectionValueV6,
} from '../contracts/types.js'
import { isStrictlyNewerGeneration, PUSH_MIN_GENERATION } from './generation.js'

/**
 * The client-side applied v6 freshness identity: the frozen PAIR,
 * anchored to one team. Recorded after every `apply`.
 */
export interface AppliedProjectionIdentityV6 {
  readonly teamSessionId: string
  /** The durable whole-projection generation of the applied frame. */
  readonly durableGeneration: number
  /** The deterministic live token of the applied frame. */
  readonly liveToken: string
}

/** A v6 push frame: the v6 projection (the base shape + the two
 *  additive freshness fields) plus the provenance. */
export interface RemotePushFrameV6 {
  readonly projection: RemoteProjectionValueV6
  readonly provenance: RemoteProvenance
}

/** The minimal structural shape of a usable v6 frame. */
interface PullFrameShapeV6 {
  readonly teamSessionId: string
  readonly durableGeneration: number
  readonly liveToken: string
}

/**
 * Read the v6 frame out of a success response, or `null` when the frame
 * is not usable: not a success, no structurally valid v6 projection
 * (non-positive-integer `durableGeneration`, empty/absent `liveToken`,
 * or a `durableGeneration` that DISAGREES with the base `generation`
 * cell), or the provenance generation disagrees with the data
 * generation (both map to the `inconsistent` assessment — no
 * v6 frame may apply while internally inconsistent).
 * @param response - a frozen `RemoteResponse` of a v6 projection pull.
 * @returns the v6 frame identity + the full v6 frame, when usable.
 */
function readV6FrameShape(
  response: RemoteResponse,
): { readonly identity: PullFrameShapeV6; readonly frame: RemotePushFrameV6 } | null {
  if (!response.ok) {
    return null
  }
  const data = response.value.data
  if (typeof data !== 'object' || data === null) {
    return null
  }
  const record = data as Record<string, unknown>
  const projection = record['projection']
  if (typeof projection !== 'object' || projection === null) {
    return null
  }
  const projRecord = projection as Record<string, unknown>
  const teamSessionId = projRecord['teamSessionId']
  const generation = projRecord['generation']
  const durableGeneration = projRecord['durableGeneration']
  const liveToken = projRecord['liveToken']
  if (
    typeof teamSessionId !== 'string' ||
    typeof generation !== 'number' ||
    !Number.isInteger(generation) ||
    generation < PUSH_MIN_GENERATION ||
    typeof durableGeneration !== 'number' ||
    !Number.isInteger(durableGeneration) ||
    durableGeneration < PUSH_MIN_GENERATION ||
    typeof liveToken !== 'string' ||
    liveToken.length === 0
  ) {
    return null
  }
  // v6 internal consistency: the named durable cell must agree with the
  // base generation cell (the v6 value is the frozen PAIR — the two
  // cells describe the SAME durable generation).
  if (durableGeneration !== generation) {
    return null
  }
  // G8 provenance cross-check (same authority as the v1-v5 pull): the
  // data generation and the provenance generation must agree.
  if (response.value.provenance.projectionGeneration !== generation) {
    return null
  }
  const identity: PullFrameShapeV6 = { teamSessionId, durableGeneration, liveToken }
  const frame: RemotePushFrameV6 = {
    projection: projection as RemoteProjectionValue & RemoteProjectionValueV6,
    provenance: response.value.provenance,
  }
  return { identity, frame }
}

/**
 * Assess one pulled v6 projection response against the applied v6
 * identity (pure: no state mutation — the caller applies the
 * assessment).
 *
 * The frozen pair verdict (module doc table): first frame or a durable
 * advance or a live-token-only change → `apply`; both cells equal →
 * `duplicate`; an older durable generation → `stale`; a different team →
 * `foreign`; a typed RPC error or an internally inconsistent frame →
 * `rpc-error` / `inconsistent` (no state change).
 *
 * NOTE: the live-only `apply` deliberately returns the SAME status as
 * the durable `apply` — the applied durable generation is the client's
 * single ledger-refresh trigger, and it is unchanged by a live-only
 * apply (frozen decision 4).
 *
 * @param applied - the applied v6 identity, or `null` before the first
 *   v6 frame.
 * @param response - the frozen `RemoteResponse` of the v6 pull.
 * @returns the closed deterministic assessment.
 */
export function assessProjectionSyncV6(
  applied: AppliedProjectionIdentityV6 | null,
  response: RemoteResponse,
): ProjectionSyncAssessment {
  if (!response.ok) {
    return {
      status: 'rpc-error',
      code: response.error.code,
      receivedGeneration: null,
    }
  }
  const shape = readV6FrameShape(response)
  if (shape === null) {
    return { status: 'inconsistent', receivedGeneration: null }
  }
  const { identity } = shape
  if (applied === null) {
    // First frame: establishes the applied pair.
    return { status: 'apply', receivedGeneration: identity.durableGeneration }
  }
  if (applied.teamSessionId !== identity.teamSessionId) {
    return { status: 'foreign', receivedGeneration: identity.durableGeneration }
  }
  if (isStrictlyNewerGeneration(identity.durableGeneration, applied.durableGeneration)) {
    // Durable advanced: apply (the client refreshes its ledger on the
    // generation advance — the mount's subscription, unchanged).
    return { status: 'apply', receivedGeneration: identity.durableGeneration }
  }
  if (identity.durableGeneration < applied.durableGeneration) {
    // Older durable generation: stale — never overwrite.
    return { status: 'stale', receivedGeneration: identity.durableGeneration }
  }
  // durableGeneration EQUAL (both directions covered above):
  if (identity.liveToken !== applied.liveToken) {
    // Live-only change: apply the overlay WITHOUT advancing the durable
    // generation (no ledger refresh — frozen decision 4).
    return { status: 'apply', receivedGeneration: identity.durableGeneration }
  }
  return { status: 'duplicate', receivedGeneration: identity.durableGeneration }
}

/**
 * Extract the v6 frame from a response when — and only when — the frame
 * is usable (success, structurally valid v6 frame, provenance-
 * consistent). The client calls this AFTER `assessProjectionSyncV6`
 * returned `apply`, so a frame can never reach the applied state
 * without the pair check.
 * @param response - the frozen `RemoteResponse` of the v6 pull.
 * @returns the v6 frame, or `null` when the frame is not usable.
 */
export function extractPushFrameV6(response: RemoteResponse): RemotePushFrameV6 | null {
  return readV6FrameShape(response)?.frame ?? null
}

/**
 * The v6 applied-identity builder: the closed record of one applied v6
 * frame (pure).
 * @param projection - the applied v6 projection value.
 * @returns the applied v6 identity (the frozen PAIR anchored to the
 *   team).
 */
export function appliedIdentityFromV6(
  projection: RemoteProjectionValueV6,
): AppliedProjectionIdentityV6 {
  return {
    teamSessionId: projection.teamSessionId,
    durableGeneration: projection.durableGeneration,
    liveToken: projection.liveToken,
  }
}
