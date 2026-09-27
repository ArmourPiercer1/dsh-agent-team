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
import type { LeaderInstanceRecordDto, MemberInstanceRecordDto, SessionBindingDto, TeamSessionRecordDto } from '../../../contracts/src/index.js';
import type { RemoteTeamGetReadStateValue } from '../../../remote/src/contracts/types.js';
/** The closed integrity-failure vocabulary of the resolver (fail closed;
 *  every code rides the dispatcher's closed backing allow-list —
 *  invariant 4b pass-through). */
export declare const TEAM_READ_STATE_ERROR_CODES: {
    /** A claimed team-root / team-member affiliation whose `team_sessions`
     *  row is missing (the generation carrier is absent). */
    readonly TEAM_ROW_ABSENT: "TEAM_READ_STATE_TEAM_ROW_ABSENT";
    /** A claimed team-member affiliation whose `member_instances` row is
     *  missing (the disposed/lifecycle carrier is absent). */
    readonly MEMBER_ROW_ABSENT: "TEAM_READ_STATE_MEMBER_ROW_ABSENT";
};
/** The minimal structural projection of the opened TeamDomain the
 *  resolver reads (the real `TeamDomain.repositories` satisfies it; the
 *  test worlds pass the equivalent doubles). */
export interface TeamReadStateDomain {
    readonly repositories: {
        /** The durable session-kind binding rows. `get` may THROW
         *  (a malformed id / row / storage failure) — the resolver
         *  propagates it unchanged (fail closed). */
        readonly sessionBindings: {
            get(sessionId: string): SessionBindingDto | undefined;
        };
        /** The durable TeamSession rows (the generation carrier). */
        readonly teamSessions: {
            get(rootSessionId: string): TeamSessionRecordDto | undefined;
            list(): ReadonlyArray<TeamSessionRecordDto>;
        };
        /** The durable MemberInstance rows (the lifecycle carrier). The
         *  repository's documented type lie applies (a v2 leader row can
         *  arrive under the member type) — the resolver discriminates
         *  structurally, never by instance id. */
        readonly memberInstances: {
            get(rootSessionId: string, instanceId: string): MemberInstanceRecordDto | LeaderInstanceRecordDto | undefined;
            list(rootSessionId: string): ReadonlyArray<MemberInstanceRecordDto>;
        };
    };
}
/**
 * Resolve ONE DSH session's durable Team affiliation + the owning
 * TeamSession's durable generation (the v6 read-state query).
 *
 * @param domain - the opened TeamDomain (structural projection).
 * @param bootRootSessionId - this row's boot root session id.
 * @param sessionId - the session id to classify (already wire-validated
 *   by the closed params parser).
 * @returns the CLOSED read-state value (every field present; `null`
 *   cells typed).
 * @throws the storage layer's typed row errors (RECORD_INVALID / …) and
 *   the resolver's TEAM_READ_STATE_* integrity codes — ALWAYS on a
 *   failure (fail closed; the dispatcher passes the code through).
 */
export declare function resolveSessionReadState(domain: TeamReadStateDomain, bootRootSessionId: string, sessionId: string): RemoteTeamGetReadStateValue;
//# sourceMappingURL=team-read-state.d.ts.map