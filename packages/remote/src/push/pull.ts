/**
 * P8-T4 push model — the deterministic pull surface (pure).
 *
 * The engine never keeps its own copy of team state: the "pull" is one
 * frozen `team.getProjection` round trip, and the assessment of the
 * response is a pure function of (applied identity, response). This is
 * the "versioned invalidation + pull" half of the card: the client
 * invalidates (re-pulls) on demand, and the generation rule in
 * `generation.ts` decides what the response may do.
 *
 * Two invariants, both Gate G8:
 *   1. A frame is never applied without a generation check — a response
 *      whose frame lacks a positive integer generation, or whose data
 *      generation disagrees with the provenance generation, is rejected
 *      as `inconsistent` (the client treats a server-side inconsistency
 *      like a stale frame: no overwrite).
 *   2. Every RPC-level outcome is typed (the frozen dispatcher never
 *      rejects): `rpc-error` assessments carry the pass-through code and
 *      change no state.
 *
 * Pure module: no I/O, no node: builtins, no runtime environment
 * assumptions. Erasable TS only.
 * @module @dsh-agent-team/remote/push/pull
 */

import type {
  AppliedProjectionIdentity,
  ProjectionSyncAssessment,
  RemotePushFrame,
} from './types.js'
import type { RemoteProjectionValue } from '../contracts/types.js'
import type { RemoteResponse } from '../contracts/response.js'
import { decideFrameVerdict, PUSH_MIN_GENERATION } from './generation.js'

/** The catalog endpoint that serves the whole projection (frozen). */
export const PULL_PROJECTION_ENDPOINT = 'team.getProjection'

/**
 * The minimal structural shape of a pulled projection frame. Kept
 * structural (not an `instanceof` check): the wire boundary delivers
 * plain lossless records, and the frozen dispatcher already ran the
 * lossless-JSON + top-level-field validation (D-4) before the response
 * exists — this is a defensive re-check at the client boundary, not a
 * re-validation of the DTO.
 */
interface PullFrameShape {
  readonly teamSessionId: string
  readonly generation: number
}

/**
 * Read the frame out of a success response, or `null` when the frame is
 * not usable: not a structurally positive-generation projection, or the
 * provenance generation disagrees with the data generation (both map to
 * the `inconsistent` assessment).
 * @param response - a frozen `RemoteResponse` of a projection pull.
 * @returns the frame identity + the full frame, when usable.
 */
function readFrameShape(
  response: RemoteResponse,
): { readonly identity: PullFrameShape; readonly frame: RemotePushFrame } | null {
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
  if (
    typeof teamSessionId !== 'string' ||
    typeof generation !== 'number' ||
    !Number.isInteger(generation) ||
    generation < PUSH_MIN_GENERATION
  ) {
    return null
  }
  const identity: PullFrameShape = { teamSessionId, generation }
  // G8 provenance cross-check: the data generation and the provenance
  // generation must agree (the frozen provenance block exists exactly for
  // staleness/origin detection). A mismatch makes the frame unusable —
  // no assessment can ever apply it.
  if (response.value.provenance.projectionGeneration !== generation) {
    return null
  }
  const frame: RemotePushFrame = {
    projection: projection as RemoteProjectionValue,
    provenance: response.value.provenance,
  }
  return { identity, frame }
}

/**
 * Assess one pulled projection response against the applied identity
 * (pure: no state mutation — the caller applies the assessment).
 * @param applied - the applied identity, or `null` before the first frame.
 * @param response - the frozen `RemoteResponse` of the pull.
 * @returns the closed deterministic assessment (see module doc).
 */
export function assessProjectionSync(
  applied: AppliedProjectionIdentity | null,
  response: RemoteResponse,
): ProjectionSyncAssessment {
  if (!response.ok) {
    return {
      status: 'rpc-error',
      code: response.error.code,
      receivedGeneration: null,
    }
  }
  const shape = readFrameShape(response)
  if (shape === null) {
    return { status: 'inconsistent', receivedGeneration: null }
  }
  const verdict = decideFrameVerdict(applied, shape.identity)
  return { status: verdict, receivedGeneration: shape.identity.generation }
}

/**
 * Extract the frame from a response when — and only when — the frame is
 * usable (success, structurally valid, provenance-consistent). The
 * client calls this AFTER `assessProjectionSync` returned `apply`, so a
 * frame can never reach the applied state without the generation check.
 * @param response - the frozen `RemoteResponse` of the pull.
 * @returns the frame, or `null` when the frame is not usable.
 */
export function extractPushFrame(
  response: RemoteResponse,
): RemotePushFrame | null {
  return readFrameShape(response)?.frame ?? null
}

/**
 * The verdict of `apply` expressed against the applied identity — the
 * one assessment status that permits a state change.
 * @param assessment - a deterministic pull assessment.
 * @returns `true` only for `apply`.
 */
export function isApplyAssessment(assessment: ProjectionSyncAssessment): boolean {
  return assessment.status === 'apply'
}
