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
import { canonicalJsonStringify } from '../../../contracts/src/index.js';
import { sha256Hex } from '../../../domain/blueprint/src/index.js';
/** The live-token format prefix (the format version of the token — see
 *  the module doc). */
export const LIVE_TOKEN_PREFIX = 'lt-v1-';
/** The `absent` residency marker of a DISPOSED member (the overlay skips
 *  DISPOSED rows — their exclusion is the live state; the marker makes it
 *  explicit and stable inside the token). NOT one of the frozen
 *  RESIDENCY_STATES — it names "no live facts by durable lifecycle", not
 *  a runtime residency. */
export const LIVE_TOKEN_RESIDENCY_ABSENT = 'absent';
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
export function teamLiveStatePairs(memberRows, snapshot) {
    const sorted = [...memberRows].sort((a, b) => a.instanceId < b.instanceId ? -1 : a.instanceId > b.instanceId ? 1 : 0);
    const pairs = [];
    for (const row of sorted) {
        const activity = snapshot.get(row.instanceId);
        pairs.push({
            instanceId: row.instanceId,
            residency: activity !== undefined ? activity.residency : LIVE_TOKEN_RESIDENCY_ABSENT,
        });
    }
    return pairs;
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
export function liveTokenFromPairs(pairs) {
    const wire = pairs.map((pair) => [pair.instanceId, pair.residency]);
    return `${LIVE_TOKEN_PREFIX}${sha256Hex(canonicalJsonStringify(wire))}`;
}
/**
 * Compute the live token of one team from its durable member rows + the
 * live overlay snapshot (the composition of the two pure steps above).
 *
 * THIS IS THE LIGHTWEIGHT (READ-STATE) PATH: the caller has only the
 * durable member rows + the Team-scoped overlay snapshot — not a full
 * projection. The production `team.getReadState` uses this (the v6
 * projection does NOT — see {@link computeLiveTokenFromProjectedMembers}).
 *
 * @param memberRows - the team's durable member rows (instance ids only).
 * @param snapshot - the team's live overlay snapshot (Team-scoped — the
 *  overlay port is `snapshot(teamSessionId)` since PR #35 second
 *  follow-up P0-1).
 * @returns the team's opaque live token (`lt-v1-<sha256 hex>`).
 */
export function computeTeamLiveToken(memberRows, snapshot) {
    return liveTokenFromPairs(teamLiveStatePairs(memberRows, snapshot));
}
/**
 * Compute the live token of one team FROM ITS OWN PROJECTION (PR #35
 * second follow-up P0-2 — the same-snapshot guarantee): the sorted
 * `[instanceId, residency]` pairs come from the projection's
 * ALREADY-MATERIALIZED member rows, so the token and the frame's
 * `members[].liveActivity` can never come from two different live
 * snapshots.
 *
 * The mapping preserves the existing semantic token meaning exactly: a
 * projected `liveActivity !== null` contributes its `residency`; a
 * projected `liveActivity === null` (the fold maps the overlay's absence
 * of a DISPOSED row to `null`) contributes {@link
 * LIVE_TOKEN_RESIDENCY_ABSENT} — the same `absent` marker the
 * durable-rows + snapshot path derives for the same team in the same live
 * state. A v6 `team.getProjection` response therefore carries a token
 * that is a pure function of its own `data.projection` content:
 * re-computing the token from any received frame reproduces the served
 * token (the client-side same-snapshot check).
 *
 * @param members - the projection's member rows (every durable member
 *  including DISPOSED — the projection source/fold retains them; only
 *  `instanceId` + `liveActivity` are read).
 * @returns the team's opaque live token (`lt-v1-<sha256 hex>` — the
 *  format is UNCHANGED from {@link computeTeamLiveToken}).
 */
export function computeLiveTokenFromProjectedMembers(members) {
    const sorted = [...members].sort((a, b) => a.instanceId < b.instanceId ? -1 : a.instanceId > b.instanceId ? 1 : 0);
    return liveTokenFromPairs(sorted.map((member) => ({
        instanceId: member.instanceId,
        residency: member.liveActivity !== null
            ? member.liveActivity.residency
            : LIVE_TOKEN_RESIDENCY_ABSENT,
    })));
}
//# sourceMappingURL=live-token.js.map