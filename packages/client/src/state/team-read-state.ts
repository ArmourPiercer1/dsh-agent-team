/**
 * team-view-sync-complete (PR #35 follow-up, frozen §1.2/§1.3) — the
 * client-local model of the v6 `team.getReadState` answer: the
 * authoritative per-session TEAM OWNERSHIP + the freshness PAIR
 * (`durableGeneration` + `liveToken`) the refresh coordinator compares
 * before deciding whether a full `team.getProjection` pull is needed.
 *
 * The read-state is the LIGHTWEIGHT probe (frozen target flow): the
 * visible session is probed on the ~3s cadence with `team.getReadState`
 * (this module), and a full projection pull happens ONLY when the pair
 * (or the ownership identity) actually changed — not on every tick.
 *
 * STRICT parsing (fail closed, never a silent degrade):
 *
 * - a `success` envelope whose value matches the closed wire shape
 *   exactly → the discriminated {@link TeamReadRelation};
 * - a `success` envelope whose value is MALFORMED (a missing /
 *   wrong-typed cell, a contradictory relation, a team relation with a
 *   null or non-`lt-v1-*` token) → `{ status: 'malformed' }` — typed,
 *   logged, and NEVER degraded to `none` (a degraded none would tell
 *   the coordinator "no team" and the view would drop an existing
 *   team);
 * - an `error` envelope (a typed host failure — storage/integrity,
 *   the port-unavailable codes, …) → `{ status: 'remote-error' }` with
 *   the error block stored INTACT (never exception-ified, never
 *   re-interpreted);
 * - a transport-level REJECTION (`PushTransportLossError` — the only
 *   kind the seam carrier rejects with) → `{ status: 'transport-loss' }`.
 *
 * The wire shape mirrors the host's closed `RemoteTeamGetReadStateValue`
 * (the handler enforces it host-side; the client re-validates because
 * an old / mismatched host or a transport tamper must not produce a
 * phantom `none`). The client-local discriminant is `kind` (the wire
 * cell is `relation` — the mapping happens here and only here).
 *
 * Pure module: no React, no I/O. Erasable TS only.
 * @module @dsh-agent-team/client/state/team-read-state
 */

import {
  PushTransportLossError,
  type RemoteResponse,
} from '../../../remote/src/index.js'

// ---------------------------------------------------------------------------
// The client-local relation model (frozen §1.3)
// ---------------------------------------------------------------------------

/** The session IS a TeamSession root (the view opens the root
 *  perspective of `teamSessionId`). */
export interface TeamReadStateTeamRootRelation {
  readonly kind: 'team-root'
  readonly teamSessionId: string
  readonly memberInstanceId: null
  readonly disposed: false
  readonly durableGeneration: number
  readonly liveToken: string
}

/** The session is a member's bound child session (`teamSessionId` is
 *  the owning root; `memberInstanceId` the instance — the view opens
 *  the member perspective of that instance under the root). A DISPOSED
 *  member still resolves here, marked `disposed`. */
export interface TeamReadStateTeamMemberRelation {
  readonly kind: 'team-member'
  readonly teamSessionId: string
  readonly memberInstanceId: string
  readonly disposed: boolean
  readonly durableGeneration: number
  readonly liveToken: string
}

/** A positively confirmed no-team answer (every cell null — the only
 *  way the coordinator may conclude "this session has no team"). */
export interface TeamReadStateNoneRelation {
  readonly kind: 'none'
  readonly teamSessionId: null
  readonly memberInstanceId: null
  readonly disposed: false
  readonly durableGeneration: null
  readonly liveToken: null
}

/** The discriminated union of the three relation answers. */
export type TeamReadRelation =
  | TeamReadStateTeamRootRelation
  | TeamReadStateTeamMemberRelation
  | TeamReadStateNoneRelation

// ---------------------------------------------------------------------------
// The parse outcome (the closed status set)
// ---------------------------------------------------------------------------

export interface TeamReadStateOk {
  readonly status: 'ok'
  readonly relation: TeamReadRelation
}

/** The typed host failure, stored INTACT (the frozen `error` block). */
export interface TeamReadStateRemoteError {
  readonly status: 'remote-error'
  readonly code: string
  readonly message: string
}

/** A `success` envelope whose value does NOT match the closed wire
 *  shape — fail closed; the reason is diagnostic (log it, never
 *  degrade to `none`). */
export interface TeamReadStateMalformed {
  readonly status: 'malformed'
  readonly reason: string
}

/** The transport-level channel loss (the only seam rejection kind). */
export interface TeamReadStateTransportLoss {
  readonly status: 'transport-loss'
  readonly message: string
}

/** The closed outcome of one read-state resolution attempt. */
export type TeamReadStateOutcome =
  | TeamReadStateOk
  | TeamReadStateRemoteError
  | TeamReadStateMalformed
  | TeamReadStateTransportLoss

// ---------------------------------------------------------------------------
// Strict parsing (pure)
// ---------------------------------------------------------------------------

const RELATIONS: readonly string[] = ['team-root', 'team-member', 'none']
const LIVE_TOKEN_PREFIX = 'lt-v1-'

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0
}

function isDurableGeneration(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 1
}

function isLiveToken(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value.length >= LIVE_TOKEN_PREFIX.length &&
    value.startsWith(LIVE_TOKEN_PREFIX)
  )
}

/**
 * Parse ONE v6 `team.getReadState` response into the closed outcome
 * (pure — the async wrapper {@link resolveTeamReadState} owns the
 * transport edge).
 *
 * @param response - the typed `RemoteResponse` (frozen envelope, the
 *   success value or the error block intact).
 * @returns the closed outcome — `ok` only on the exact closed wire
 *   shape; `malformed` (NEVER a degraded `none`) on a broken success
 *   value; `remote-error` intact on a typed host failure; the transport
 *   loss is produced by the async wrapper (a rejection, not a response).
 */
export function parseTeamReadStateResponse(
  response: RemoteResponse,
): TeamReadStateOutcome {
  if (!response.ok) {
    return {
      status: 'remote-error',
      code: response.error.code,
      message: response.error.message,
    }
  }
  // The read-state value rides `data` DIRECTLY (no `projection`
  // wrapper — unlike the projection method, whose value is
  // `{ projection }`).
  const value: unknown = response.value.data
  if (!isPlainRecord(value)) {
    return { status: 'malformed', reason: `data is not an object (got ${String(value)})` }
  }
  const relation = value['relation']
  if (typeof relation !== 'string' || !RELATIONS.includes(relation)) {
    return {
      status: 'malformed',
      reason: `relation must be one of ${RELATIONS.join(' | ')} (got ${String(relation)})`,
    }
  }
  if (relation === 'none') {
    // The positively confirmed no-team answer: EVERY cell null / the
    // frozen constant. Any deviation is malformed (a `none` with a
    // token would be a contradiction).
    if (
      value['teamSessionId'] !== null ||
      value['memberInstanceId'] !== null ||
      value['disposed'] !== false ||
      value['durableGeneration'] !== null ||
      value['liveToken'] !== null
    ) {
      return {
        status: 'malformed',
        reason: 'a none answer must carry null teamSessionId / memberInstanceId / durableGeneration / liveToken and disposed false',
      }
    }
    return {
      status: 'ok',
      relation: {
        kind: 'none',
        teamSessionId: null,
        memberInstanceId: null,
        disposed: false,
        durableGeneration: null,
        liveToken: null,
      },
    }
  }
  const teamSessionId = value['teamSessionId']
  if (!isNonEmptyString(teamSessionId)) {
    return {
      status: 'malformed',
      reason: `a team answer must carry a non-empty teamSessionId (got ${String(teamSessionId)})`,
    }
  }
  const durableGeneration = value['durableGeneration']
  if (!isDurableGeneration(durableGeneration)) {
    return {
      status: 'malformed',
      reason: `a team answer must carry its safe-integer durableGeneration >= 1 (got ${String(durableGeneration)})`,
    }
  }
  // PR #35 follow-up (frozen): a team relation ALWAYS carries its
  // liveToken — the probe must detect a live-only change without a full
  // projection pull; a null / non-`lt-v1-*` token is malformed (NEVER
  // a degraded `none`, and the coordinator never accepts a team
  // relation without its token).
  const liveToken = value['liveToken']
  if (!isLiveToken(liveToken)) {
    return {
      status: 'malformed',
      reason: `a team answer must carry its non-empty lt-v1-* liveToken (got ${String(liveToken)})`,
    }
  }
  if (relation === 'team-root') {
    if (value['memberInstanceId'] !== null || value['disposed'] !== false) {
      return {
        status: 'malformed',
        reason: 'a team-root answer carries no member instance and is never disposed',
      }
    }
    return {
      status: 'ok',
      relation: {
        kind: 'team-root',
        teamSessionId,
        memberInstanceId: null,
        disposed: false,
        durableGeneration,
        liveToken,
      },
    }
  }
  // team-member
  const memberInstanceId = value['memberInstanceId']
  if (!isNonEmptyString(memberInstanceId)) {
    return {
      status: 'malformed',
      reason: `a team-member answer must carry a non-empty memberInstanceId (got ${String(memberInstanceId)})`,
    }
  }
  if (typeof value['disposed'] !== 'boolean') {
    return {
      status: 'malformed',
      reason: `a team-member answer must carry a boolean disposed (got ${String(value['disposed'])})`,
    }
  }
  return {
    status: 'ok',
    relation: {
      kind: 'team-member',
      teamSessionId,
      memberInstanceId,
      disposed: value['disposed'],
      durableGeneration,
      liveToken,
    },
  }
}

// ---------------------------------------------------------------------------
// The async resolution (the transport edge)
// ---------------------------------------------------------------------------

/** The minimal client seam the resolver needs (the production
 *  `TeamRemoteClient` satisfies it; tests pass doubles). */
export interface TeamReadStateClient {
  readonly getReadStateV6: (sessionId: string) => Promise<RemoteResponse>
}

/**
 * Resolve ONE session's authoritative read-state over the v6 wire
 * (the frozen §1.2 probe step): `team.getReadState` → the closed
 * outcome. Rejects NEVER — every outcome (including the transport
 * loss, which is the seam's only rejection kind) arrives as the
 * closed {@link TeamReadStateOutcome}.
 *
 * @param teamRemote - the v6 client (or a double).
 * @param sessionId - the session id to classify (the CURRENT session —
 *   NOT a team root id: the read-state answers per-session ownership).
 */
export async function resolveTeamReadState(
  teamRemote: TeamReadStateClient,
  sessionId: string,
): Promise<TeamReadStateOutcome> {
  let response: RemoteResponse
  try {
    response = await teamRemote.getReadStateV6(sessionId)
  } catch (error) {
    // The frozen seam contract: PushTransportLossError is the ONLY
    // rejection kind. Anything else is an internal client bug — keep
    // it classified as a loss (the coordinator treats it as
    // "probe unavailable", never as "no team").
    if (error instanceof PushTransportLossError) {
      return { status: 'transport-loss', message: error.message }
    }
    return {
      status: 'transport-loss',
      message: error instanceof Error ? error.message : String(error),
    }
  }
  return parseTeamReadStateResponse(response)
}
