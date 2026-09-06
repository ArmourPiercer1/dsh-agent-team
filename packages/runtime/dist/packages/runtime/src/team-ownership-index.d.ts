/**
 * D1 (Team D1-D6 repair v2) — the pure durable ownership / root-identity
 * index of the TeamDomain.
 *
 * This module answers ONE question from durable rows only: "which Team
 * roots exist, and for each, what is its blueprint identity, generation,
 * creation time, and member/child-session attribution?" It is the
 * production backing of the remote contract v3-only `team.listRoots`
 * method (host wiring in `plugin/s6-remote.ts`; the client feed of the
 * Team UI zero state).
 *
 * **Purity**: the module reads through an already-open
 * {@link TeamDomainRepositories} facade (`teamSessions`,
 * `memberInstances`, `sessionBindings` only). It performs NO repository
 * writes, NO agent effects, NO host-backend I/O, NO clock or random
 * reads — the output is a pure function of the durable rows.
 *
 * **Determinism (rebuild-identical)**: roots come from
 * `teamSessions.list()` (sorted by root session id, repository contract)
 * and attribution entries are re-sorted by instance id (the repository's
 * own sort order). Rebuilding the index twice over the same rows —
 * including after closing and re-opening the domain — yields
 * byte-identical output (`JSON.stringify` of the row array).
 *
 * **Fail-closed contract (exact conditions, pinned by
 * `test/d1-team-ownership-index.test.ts`)** — the index NEVER degrades
 * to a silent empty or partial list; every inconsistency is a typed
 * {@link TeamOwnershipIndexError} whose string `code` is a member of the
 * closed remote backing vocabulary (`REMOTE_BACKING_ERROR_CODE_SET` in
 * `packages/remote/src/handlers/dispatch.ts`) and therefore survives
 * both dispatchers unchanged (invariant 4b):
 *
 * 1. **Corrupt / undecodable row** — a row that fails repository parsing
 *    (malformed JSON, unknown fields, bad ids) raises the storage layer's
 *    own typed error (`RECORD_INVALID` / `MALFORMED_DTO` / …) from the
 *    read itself; the index propagates it as-is (never swallowed).
 * 2. **`TEAM_OWNERSHIP_INDEX_ROOT_BINDING_MISMATCH`** — a root's
 *    `sessionBindings` row EXISTS but its `kind` is not `team-root`
 *    (e.g. `ordinary` or `team-member`): the root identity is
 *    contradicted by the binding layer.
 * 3. **`TEAM_OWNERSHIP_INDEX_MEMBER_BINDING_MISMATCH`** — a member's
 *    child-session binding row EXISTS but its `kind` is not
 *    `team-member` (e.g. `ordinary` or `team-root`); or a v1 member
 *    record somehow lacks its required `childSessionId` (unreachable
 *    through the validated repositories — the guard is defensive and
 *    still fails closed).
 * 4. **`TEAM_OWNERSHIP_INDEX_MEMBER_BINDING_CONFLICT`** — a `team-member`
 *    binding row exists for a member's child session but does NOT agree
 *    with the member record: `binding.rootSessionId !== record.rootSessionId`,
 *    `binding.instanceId !== record.instanceId`, or
 *    `binding.sessionId !== record.childSessionId` (the composite member
 *    identity, invariant 18, is the reconciliation key).
 *
 * **Documented NON-failures** (legitimate intermediate states, NOT
 * inconsistencies):
 * - a root record WITHOUT a `team-root` binding row: the fresh-root
 *   write order commits the TeamSession record FIRST and puts the
 *   binding row after (a crash between the two leaves exactly this
 *   state — see `root-binding/fresh-root.ts` step 4);
 * - a member child session WITHOUT a binding row: the per-session kind
 *   is optional in the index output (`kind` absent) — the member record
 *   still carries its `childSessionId` (invariant 23) and the
 *   attribution row is emitted with `kind` undefined.
 *
 * **Leader exclusion**: `memberCount` and `attribution` EXCLUDE the
 * Leader row (`instanceId === 'inst-leader'`) in BOTH its v2 form
 * (`schemaVersion: 2`, no `childSessionId`/`lifecycle` — the Leader IS
 * the Root Session, invariant 13) and its legacy v1 harness form
 * (`instanceId: 'inst-leader'` WITH a `childSessionId`).
 *
 * **Wire shape (frozen by D1, consumed by D2/D3)**: the remote-safe row
 * of the v3 `team.listRoots` response is exactly
 * `{ rootSessionId, blueprintId, revision, defaultWorkspace?, createdAt,
 * generation, memberCount }` — produced by {@link toTeamRootWireRow}
 * (the full in-memory row additionally carries `attribution`, which the
 * wire row deliberately omits).
 *
 * Pure module: no I/O, no host backend, no runtime environment
 * assumptions. @module @dsh-agent-team/runtime/team-ownership-index
 */
import type { TeamDomainRepositories } from '../../storage/repositories/index.js';
import type { RemoteSafeRecord } from '../../remote/src/contracts/remote-safe.js';
/**
 * The closed vocabulary of the index's typed integrity failures. Every
 * code is a member of `REMOTE_BACKING_ERROR_CODE_SET` (closed remote
 * backing vocabulary) so the error passes both dispatchers unchanged
 * (invariant 4b). Corrupt (undecodable) rows are NOT re-coded here: the
 * storage layer's `RECORD_INVALID` / `MALFORMED_DTO` vocabulary already
 * covers them and passes through unchanged.
 */
export declare const TEAM_OWNERSHIP_INDEX_ERROR_CODES: {
    /** A root's binding row exists with a kind other than `team-root`. */
    readonly ROOT_BINDING_MISMATCH: "TEAM_OWNERSHIP_INDEX_ROOT_BINDING_MISMATCH";
    /** A member's child binding row exists with a kind other than `team-member`. */
    readonly MEMBER_BINDING_MISMATCH: "TEAM_OWNERSHIP_INDEX_MEMBER_BINDING_MISMATCH";
    /** A `team-member` binding row contradicts the member record identity. */
    readonly MEMBER_BINDING_CONFLICT: "TEAM_OWNERSHIP_INDEX_MEMBER_BINDING_CONFLICT";
};
/** The frozen error-code type of {@link TeamOwnershipIndexError}. */
export type TeamOwnershipIndexErrorCode = (typeof TEAM_OWNERSHIP_INDEX_ERROR_CODES)[keyof typeof TEAM_OWNERSHIP_INDEX_ERROR_CODES];
/**
 * The typed fail-closed integrity error of the ownership index. Carries
 * the closed-vocabulary string `code` (invariant 4b pass-through) plus a
 * remote-safe `details` record naming the offending rows.
 */
export declare class TeamOwnershipIndexError extends Error {
    /** The closed backing-vocabulary code (never re-mapped by the dispatchers). */
    readonly code: TeamOwnershipIndexErrorCode;
    /** Remote-safe failure details (offending rows), lossless-JSON-checked upstream. */
    readonly details: RemoteSafeRecord;
    constructor(code: TeamOwnershipIndexErrorCode, message: string, details: RemoteSafeRecord);
}
/** One member's child-session attribution (the per-session kind is optional). */
export interface TeamRootMemberAttribution {
    /** The member's stable instance id (composite identity, invariant 18). */
    readonly instanceId: string;
    /** The durable child session bound to the instance (invariant 23). */
    readonly childSessionId: string;
    /**
     * The child session's binding kind, from the `sessionBindings` row —
     * `'team-member'` when the row exists and agrees; ABSENT (undefined)
     * when no binding row exists for the child (documented non-failure).
     */
    readonly kind?: string;
}
/** One durable Team root, as read from the TeamDomain (in-memory row). */
export interface TeamRootOwnershipRow {
    /** The root DSH session id — which is the TeamSessionId (invariant 9). */
    readonly rootSessionId: string;
    /** The immutable blueprint identity (invariant 10). */
    readonly blueprintId: string;
    /** The blueprint revision of the snapshot binding (human-readable, e.g. `17`). */
    readonly revision: string;
    /** The team default workspace (absent when not set, §21.2). */
    readonly defaultWorkspace?: string;
    /** Creation timestamp, ISO-8601. */
    readonly createdAt: string;
    /** The TeamSession record generation (starts at 1). */
    readonly generation: number;
    /**
     * The number of member instances of the root, EXCLUDING the Leader row
     * (`inst-leader`) in both its v2 and legacy v1 forms.
     */
    readonly memberCount: number;
    /** The per-member child-session attribution, sorted by instance id. */
    readonly attribution: readonly TeamRootMemberAttribution[];
}
/**
 * The remote-safe row of the v3 `team.listRoots` response — the closed
 * wire shape frozen by D1 (D2/D3 consume exactly this shape):
 * `{ rootSessionId, blueprintId, revision, defaultWorkspace?, createdAt,
 * generation, memberCount }`.
 */
export interface TeamRootWireRow {
    readonly rootSessionId: string;
    readonly blueprintId: string;
    /** The blueprint revision of the snapshot binding (human-readable string). */
    readonly revision: string;
    readonly defaultWorkspace?: string;
    readonly createdAt: string;
    readonly generation: number;
    readonly memberCount: number;
}
/**
 * Build the durable ownership index over the TeamDomain.
 *
 * @param repositories - the open TeamDomain repositories (only
 *   `teamSessions`, `memberInstances`, and `sessionBindings` are read).
 * @returns the root rows, sorted by root session id (the repository's
 *   own `teamSessions.list()` order), each with its member attribution
 *   sorted by instance id.
 * @throws {@link TeamOwnershipIndexError} on the three integrity
 *   conditions (see the module docstring); or the storage layer's typed
 *   errors (`RECORD_INVALID`, …) on a corrupt/undecodable row — every
 *   failure propagates, the index never returns a silent empty list.
 */
export declare function buildTeamRootOwnershipIndex(repositories: TeamDomainRepositories): readonly TeamRootOwnershipRow[];
/**
 * Map one in-memory ownership row to the closed v3 wire row of the
 * `team.listRoots` response (frozen by D1): the remote-safe subset —
 * NO attribution (child session ids stay host-side in D1), NO handoff
 * provenance, NO record internals.
 *
 * @param row - one {@link TeamRootOwnershipRow}.
 * @returns the fresh wire row (a plain lossless-JSON record; the
 *   `defaultWorkspace` key is ABSENT, not undefined, when unset).
 */
export declare function toTeamRootWireRow(row: TeamRootOwnershipRow): TeamRootWireRow;
//# sourceMappingURL=team-ownership-index.d.ts.map