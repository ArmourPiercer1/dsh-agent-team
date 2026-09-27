/**
 * live-token — the deterministic semantic-live-state token of one team
 * (team-view-sync-complete, frozen decisions 3 + 7).
 *
 * The v6 projection frame carries TWO freshness cells (frozen decision 4):
 * the durable `generation` (durable-only — it advances only on a durable
 * write) and the `liveToken` (the semantic live state — it changes only
 * when the LIVE state that an authoritative source can speak for changes).
 *
 * Frozen decision 3: the live token is a DETERMINISTIC OPAQUE string
 * derived from the sorted semantic live state — AT LEAST the member
 * instance id + its residency. NO clock facts may enter the token:
 * `lastActivityAt` (the overlay stamps it with `now()` on resident rows),
 * `runningSince`, `generatedAt` and any bare numeric counter (which would
 * zero on a host restart and be mistaken for a duplicate) are EXCLUDED.
 *
 * Frozen decision 7: the live scope is the states with an authoritative
 * source ONLY (the overlay's `resident` / `resuming` / `cold`):
 * `currentAction` / task progress are NOT invented (no runtime producer
 * exists for them). A DISPOSED member contributes the marker `absent`
 * (the overlay skips DISPOSED rows — their exclusion IS the live state
 * change a disposal causes, so the token moves on dispose exactly like
 * on a residency change).
 *
 * Token format (`lt-v1`): `lt-v1-` + sha256 hex over the canonical JSON
 * (key-sorted — `canonicalJsonStringify`) of the SORTED
 * `[instanceId, residency]` pairs (sorted by instance id, byte order).
 * The prefix carries the format version: a future change of the pair
 * encoding or the exclusion rule bumps the prefix and invalidates the
 * old tokens in one step (a new token value — the client treats it as
 * "live changed", never as stale).
 *
 * Pure module: no I/O, no timers, no node: builtins beyond the shared
 * sha256 primitive, no repository access — the CALLER gathers the durable
 * member rows + the live overlay snapshot and hands the module its
 * inputs (so the module stays testable with plain doubles).
 *
 * @module @dsh-agent-team/runtime/plugin/live-token
 */

import { canonicalJsonStringify } from '../../../contracts/src/index.js'
import { sha256Hex } from '../../../domain/blueprint/src/index.js'

/** The live-token format prefix (the format version of the token — see
 *  the module doc). */
export const LIVE_TOKEN_PREFIX = 'lt-v1-'

/** The `absent` residency marker of a DISPOSED member (the overlay skips
 *  DISPOSED rows — their exclusion is the live state; the marker makes it
 *  explicit and stable inside the token). NOT one of the frozen
 *  RESIDENCY_STATES — it names "no live facts by durable lifecycle", not
 *  a runtime residency. */
export const LIVE_TOKEN_RESIDENCY_ABSENT = 'absent'

/** One semantic live-state pair of a team member (the sorted token input). */
export interface TeamLiveStatePair {
  /** The member's stable instance id (the composite identity, invariant
   *  18 — the leader row carries its own). */
  readonly instanceId: string
  /** The member's residency: one of the frozen RESIDENCY_STATES values,
   *  or {@link LIVE_TOKEN_RESIDENCY_ABSENT} for a DISPOSED member. */
  readonly residency: string
}

/** A structural projection of the live overlay snapshot (the real
 *  overlay's `ReadonlyMap<InstanceId, MemberLiveActivityDto>` satisfies
 *  it — method-style `get`, so the branded key stays compatible). */
export interface LiveTokenSnapshot {
  /** Look up one instance's live activity (its `residency` cell);
   *  `undefined` when the instance has no live facts (a DISPOSED row). */
  get(instanceId: string): { readonly residency: string } | undefined
}

/**
 * Gather the SORTED semantic live-state pairs of one team (frozen
 * decision 3: deterministic — the same durable rows + the same snapshot
 * always produce the same pairs).
 *
 * @param memberRows - the team's durable member rows (instance ids only;
 *  the v2 leader row included — it IS a member instance of its team).
 * @param snapshot - the live overlay snapshot (the authoritative live
 *  source; only its `residency` cell is read — NO clock facts).
 * @returns the pairs sorted by instance id (byte order).
 */
export function teamLiveStatePairs(
  memberRows: ReadonlyArray<{ readonly instanceId: string }>,
  snapshot: LiveTokenSnapshot,
): TeamLiveStatePair[] {
  const sorted = [...memberRows].sort((a, b) =>
    a.instanceId < b.instanceId ? -1 : a.instanceId > b.instanceId ? 1 : 0,
  )
  const pairs: TeamLiveStatePair[] = []
  for (const row of sorted) {
    const activity = snapshot.get(row.instanceId)
    pairs.push({
      instanceId: row.instanceId,
      residency: activity !== undefined ? activity.residency : LIVE_TOKEN_RESIDENCY_ABSENT,
    })
  }
  return pairs
}

/**
 * Compute the opaque live token of ONE sorted pair list (frozen decision
 * 3: deterministic — the same pairs always produce the same token; a
 * different pair list — a residency change, a member created/disposed —
 * produces a different token).
 *
 * @param pairs - the semantic live-state pairs (sorted — the caller
 *  orders them; the encoding does not re-sort).
 * @returns `lt-v1-<sha256 hex>` (a non-empty opaque string).
 */
export function liveTokenFromPairs(pairs: ReadonlyArray<TeamLiveStatePair>): string {
  const wire = pairs.map((pair) => [pair.instanceId, pair.residency])
  return `${LIVE_TOKEN_PREFIX}${sha256Hex(canonicalJsonStringify(wire))}`
}

/**
 * Compute the live token of one team from its durable member rows + the
 * live overlay snapshot (the composition of the two pure steps above).
 *
 * @param memberRows - the team's durable member rows (instance ids only).
 * @param snapshot - the live overlay snapshot.
 * @returns the team's opaque live token (`lt-v1-<sha256 hex>`).
 */
export function computeTeamLiveToken(
  memberRows: ReadonlyArray<{ readonly instanceId: string }>,
  snapshot: LiveTokenSnapshot,
): string {
  return liveTokenFromPairs(teamLiveStatePairs(memberRows, snapshot))
}
