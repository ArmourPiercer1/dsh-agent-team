/**
 * team-read-state — the ONE durable session-affiliation resolver behind
 * the remote contract v6 `team.getReadState` query (team-view-sync-
 * complete, frozen decision 1).
 *
 * The wire contract (frozen decisions 1 + 4):
 *
 *   - the TeamDomain durable rows are the SOLE authority: a read answers
 *     `team-root` / `team-member` only on a durable row claim, and
 *     `none` ONLY on a positively confirmed no-affiliation (a binding
 *     row of kind `ordinary`, or a completed durable scan that found no
 *     claim);
 *   - a disposed member STILL resolves as `team-member` with
 *     `disposed: true` (the DISPOSED rows are retained forever — no
 *     historical grant deletion, no data migration);
 *   - EVERY storage/integrity failure FAILS CLOSED as a typed error —
 *     the resolver never translates a failure into a `none` answer
 *     (the dispatcher passes the typed code through, invariant 4b).
 *
 * Resolution order (the binding row is authoritative when present; the
 * durable rows corroborate in the crash window where the binding write
 * has not yet landed):
 *
 *   1. a session-binding row EXISTS (any kind):
 *        - `ordinary`   → confirmed `none`;
 *        - `team-root`  → `team-root` (the TeamSession row MUST exist —
 *                         its `generation` is the durable generation;
 *                         a missing row is the typed
 *                         TEAM_READ_STATE_TEAM_ROW_ABSENT);
 *        - `team-member`→ `team-member` (the TeamSession row MUST exist
 *                         for the generation AND the MemberInstance row
 *                         MUST exist — its `lifecycle === 'DISPOSED'`
 *                         is the `disposed` cell; a missing row is the
 *                         typed TEAM_READ_STATE_TEAM_ROW_ABSENT /
 *                         TEAM_READ_STATE_MEMBER_ROW_ABSENT).
 *   2. NO binding row (the crash window): the durable rows corroborate —
 *        - the session id carries its own TeamSession row (or IS the
 *          boot root) → `team-root`;
 *        - the session id is a member CHILD of one of the domain's team
 *          roots (the boot root first, then the listed team roots — the
 *          same traversal order the ownership resolver uses) →
 *          `team-member` (the member row's lifecycle is the `disposed`
 *          cell);
 *   3. NEITHER (the scan COMPLETED without error) → confirmed `none`.
 *
 * The module is PURE: synchronous, deterministic, no side effects, no
 * service reads beyond the passed repositories, and structurally typed
 * (the minimal repository projection the algorithm touches — mirrors
 * `team-session-ownership.ts`, so the fence / glue / remote layers keep
 * sharing ONE durable read vocabulary).
 *
 * @module @dsh-agent-team/runtime/plugin/team-read-state
 */

import type {
  LeaderInstanceRecordDto,
  MemberInstanceRecordDto,
  SessionBindingDto,
  TeamSessionRecordDto,
} from '../../../contracts/src/index.js'
import type { RemoteTeamGetReadStateValue } from '../../../remote/src/contracts/types.js'
import { TeamPluginError } from './types.js'

/** The closed integrity-failure vocabulary of the resolver (fail closed;
 *  every code rides the dispatcher's closed backing allow-list —
 *  invariant 4b pass-through). */
export const TEAM_READ_STATE_ERROR_CODES = {
  /** A claimed team-root / team-member affiliation whose `team_sessions`
   *  row is missing (the generation carrier is absent). */
  TEAM_ROW_ABSENT: 'TEAM_READ_STATE_TEAM_ROW_ABSENT',
  /** A claimed team-member affiliation whose `member_instances` row is
   *  missing (the disposed/lifecycle carrier is absent). */
  MEMBER_ROW_ABSENT: 'TEAM_READ_STATE_MEMBER_ROW_ABSENT',
  /** (PR #35 follow-up P2) the no-binding ownership scan found MORE
   *  THAN ONE durable member row claiming the same child session
   *  (two roots, or two rows under one root): the ownership is
   *  genuinely ambiguous — failing closed instead of the silent
   *  first-wins (the client must not attach the wrong team). */
  OWNERSHIP_CONFLICT: 'TEAM_READ_STATE_OWNERSHIP_CONFLICT',
} as const

type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never

/** The resolver's DURABLE-ONLY answer (PR #35 follow-up): the closed
 *  read-state value WITHOUT its `liveToken` cell — the resolver is PURE
 *  over the durable TeamDomain rows and has no live-overlay seam, so the
 *  token is NOT computed here: the S6 production dispatcher (s6-remote)
 *  merges the SAME live-token closure the v6 projection uses onto the
 *  team relations (`lt-v1-*`), and `null` onto a `none` answer, before
 *  the value reaches the wire (the frozen closed wire shape stays the
 *  full {@link RemoteTeamGetReadStateValue}). DISTRIBUTIVE omit — the
 *  relation discriminant stays intact so the dispatcher's
 *  none/team narrowing is preserved. */
export type SessionReadStateDurableValue = DistributiveOmit<RemoteTeamGetReadStateValue, 'liveToken'>

/** The minimal structural projection of the opened TeamDomain the
 *  resolver reads (the real `TeamDomain.repositories` satisfies it; the
 *  test worlds pass the equivalent doubles). */
export interface TeamReadStateDomain {
  readonly repositories: {
    /** The durable session-kind binding rows. `get` may THROW
     *  (a malformed id / row / storage failure) — the resolver
     *  propagates it unchanged (fail closed). */
    readonly sessionBindings: {
      get(sessionId: string): SessionBindingDto | undefined
    }
    /** The durable TeamSession rows (the generation carrier). */
    readonly teamSessions: {
      get(rootSessionId: string): TeamSessionRecordDto | undefined
      list(): ReadonlyArray<TeamSessionRecordDto>
    }
    /** The durable MemberInstance rows (the lifecycle carrier). The
     *  repository's documented type lie applies (a v2 leader row can
     *  arrive under the member type) — the resolver discriminates
     *  structurally, never by instance id. */
    readonly memberInstances: {
      get(
        rootSessionId: string,
        instanceId: string,
      ): MemberInstanceRecordDto | LeaderInstanceRecordDto | undefined
      list(rootSessionId: string): ReadonlyArray<MemberInstanceRecordDto>
    }
  }
}

/** The confirmed-`none` value (every durable cell present, null cells
 *  typed — the liveToken cell belongs to the dispatcher's merge). */
function confirmedNone(): SessionReadStateDurableValue {
  return {
    relation: 'none',
    teamSessionId: null,
    memberInstanceId: null,
    disposed: false,
    durableGeneration: null,
  }
}

/**
 * The team-row integrity guard: the affiliation claim names a
 * TeamSession whose durable row MUST exist (its `generation` is the
 * answer's `durableGeneration` cell). Absent → the typed
 * TEAM_READ_STATE_TEAM_ROW_ABSENT (fail closed — NEVER a guess, never a
 * `none`).
 */
function requireTeamRow(
  repositories: TeamReadStateDomain['repositories'],
  rootSessionId: string,
): TeamSessionRecordDto {
  const row = repositories.teamSessions.get(rootSessionId)
  if (row === undefined) {
    throw new TeamPluginError(
      TEAM_READ_STATE_ERROR_CODES.TEAM_ROW_ABSENT,
      `team.getReadState: the durable TeamDomain carries no team_sessions row for TeamSession '${rootSessionId}' (a claimed team affiliation without its generation carrier) — failing closed`,
      { reason: 'team-row-absent', teamSessionId: rootSessionId },
    )
  }
  return row
}

/**
 * Resolve ONE DSH session's durable Team affiliation + the owning
 * TeamSession's durable generation (the v6 read-state query).
 *
 * @param domain - the opened TeamDomain (structural projection).
 * @param bootRootSessionId - this row's boot root session id.
 * @param sessionId - the session id to classify (already wire-validated
 *   by the closed params parser).
 * @returns the CLOSED read-state value WITHOUT its `liveToken` cell
 *   (every durable field present; `null` cells typed — the S6
 *   dispatcher merges the token, PR #35 follow-up).
 * @throws the storage layer's typed row errors (RECORD_INVALID / …) and
 *   the resolver's TEAM_READ_STATE_* integrity codes — ALWAYS on a
 *   failure (fail closed; the dispatcher passes the code through).
 */
export function resolveSessionReadState(
  domain: TeamReadStateDomain,
  bootRootSessionId: string,
  sessionId: string,
): SessionReadStateDurableValue {
  const repositories = domain.repositories
  const sid = String(sessionId)

  // --- (1) the binding row is authoritative when it exists -------------
  // A malformed id / a malformed or non-canonical stored row / a storage
  // failure THROWS here and propagates unchanged (fail closed).
  const binding = repositories.sessionBindings.get(sid)
  if (binding !== undefined) {
    if (binding.kind === 'ordinary') {
      // A positively confirmed no-affiliation: the row EXISTS and says
      // ordinary — the only `none` this branch can produce.
      return confirmedNone()
    }
    const root = binding.kind === 'team-root' ? binding.sessionId : binding.rootSessionId
    const team = requireTeamRow(repositories, root)
    if (binding.kind === 'team-root') {
      // A root cannot be disposed (the TeamSession row carries no
      // lifecycle; the DISPOSED vocabulary is a member concept).
      return {
        relation: 'team-root',
        teamSessionId: root,
        memberInstanceId: null,
        disposed: false,
        durableGeneration: team.generation,
      }
    }
    // team-member: the instance row MUST exist (the lifecycle carrier).
    const member = repositories.memberInstances.get(root, binding.instanceId)
    if (member === undefined) {
      throw new TeamPluginError(
        TEAM_READ_STATE_ERROR_CODES.MEMBER_ROW_ABSENT,
        `team.getReadState: TeamSession '${root}' carries no member_instances row for instance '${binding.instanceId}' (a claimed member affiliation without its lifecycle carrier) — failing closed`,
        {
          reason: 'member-row-absent',
          teamSessionId: root,
          instanceId: binding.instanceId,
        },
      )
    }
    // Structural lifecycle read (the documented type lie: a v2 leader
    // row never appears under a member BINDING — the binding names a
    // member instance — but read the field defensively either way).
    const lifecycle = (member as { readonly lifecycle?: unknown }).lifecycle
    return {
      relation: 'team-member',
      teamSessionId: root,
      memberInstanceId: binding.instanceId,
      disposed: lifecycle === 'DISPOSED',
      durableGeneration: team.generation,
    }
  }

  // --- (2) no binding row: corroborate through the durable rows --------
  // (the crash window in which the binding write has not yet landed).
  // (a) the session id carries its own TeamSession row — it IS a team
  // root of this domain (or the boot root, which owns itself even in a
  // world whose row was never stamped).
  if (sid === bootRootSessionId) {
    const row = repositories.teamSessions.get(sid)
    if (row === undefined) {
      // A boot root WITHOUT its team_sessions row: the generation carrier
      // is absent — the projection port fails closed for the same
      // condition (TEAM_PROJECTION_SOURCE_TEAM_SESSION_ABSENT), so the
      // read-state query must not guess either.
      throw new TeamPluginError(
        TEAM_READ_STATE_ERROR_CODES.TEAM_ROW_ABSENT,
        `team.getReadState: the boot root TeamSession '${sid}' carries no team_sessions row (no generation carrier) — failing closed`,
        { reason: 'team-row-absent', teamSessionId: sid },
      )
    }
    return {
      relation: 'team-root',
      teamSessionId: sid,
      memberInstanceId: null,
      disposed: false,
      durableGeneration: row.generation,
    }
  }
  const ownRow = repositories.teamSessions.get(sid)
  if (ownRow !== undefined) {
    return {
      relation: 'team-root',
      teamSessionId: sid,
      memberInstanceId: null,
      disposed: false,
      durableGeneration: ownRow.generation,
    }
  }
  // (b) the session id is a member CHILD of one of the domain's team
  // roots: the boot root first, then the listed team roots (the same
  // traversal order the ownership resolver uses). A storage failure in
  // ANY list/get THROWS and propagates (fail closed — an UNFINISHED scan
  // is never a `none`).
  //
  // (PR #35 follow-up P2) the scan COLLECTS every durable claim instead
  // of stopping at the first matching member row: when MORE THAN ONE
  // member row claims the same child session — under two different
  // roots, or two rows under the same root — the ownership is genuinely
  // ambiguous and the answer fails CLOSED with the typed
  // TEAM_READ_STATE_OWNERSHIP_CONFLICT (a silent first-wins would let
  // the client attach the WRONG team). The boot root is scanned once
  // even when its row also appears in the listed rows (dedupe).
  const claims: Array<{ readonly root: string; readonly member: MemberInstanceRecordDto }> = []
  const scannedRoots = new Set<string>()
  const scanRoot = (root: string): void => {
    if (scannedRoots.has(root)) return
    scannedRoots.add(root)
    for (const member of repositories.memberInstances.list(root)) {
      if (member.childSessionId === sid) claims.push({ root, member })
    }
  }
  scanRoot(bootRootSessionId)
  for (const row of repositories.teamSessions.list()) {
    scanRoot(row.rootSessionId)
  }
  if (claims.length > 1) {
    const rootIds = [...new Set(claims.map((claim) => claim.root))]
    throw new TeamPluginError(
      TEAM_READ_STATE_ERROR_CODES.OWNERSHIP_CONFLICT,
      `team.getReadState: ${claims.length} durable member rows claim child session '${sid}' across ${rootIds.length} team root(s) (${rootIds.join(', ')}) — ambiguous ownership, failing closed (never a first-wins)`,
      { reason: 'ownership-conflict', sessionId: sid, roots: rootIds },
    )
  }
  const single = claims.length === 1 ? claims[0] : undefined
  if (single !== undefined) {
    const team = requireTeamRow(repositories, single.root)
    return {
      relation: 'team-member',
      teamSessionId: single.root,
      memberInstanceId: single.member.instanceId,
      disposed: single.member.lifecycle === 'DISPOSED',
      durableGeneration: team.generation,
    }
  }

  // --- (3) the scan COMPLETED without error and found no claim --------
  // A positively confirmed no-affiliation: `none`.
  return confirmedNone()
}
