/**
 * TeamSessionsRepository — the `team_sessions` store: the durable
 * TeamSession records, keyed by root session id (one row per team).
 *
 * Write inputs are the frozen contracts v1 INPUT types (branded ids;
 * identity parsing happens in the contracts layer, never re-implemented
 * here); read keys and deletes take plain strings and are parsed through
 * the contracts parsers. The uniqueness rule (at most one TeamSession per
 * root session) is enforced through the frozen contracts assertion
 * `assertTeamSessionUnique`, preserved in `details.contractsCode`.
 *
 * @module @dsh-agent-team/storage/repositories/team-sessions
 */
import type { TeamSessionRecordDto, TeamSessionRecordInput } from '../../contracts/src/index.js';
import type { StorageDomainHandle } from '../schema/index.js';
import { BaseRepository } from './base.js';
/**
 * The `team_sessions` repository.
 */
export declare class TeamSessionsRepository extends BaseRepository {
    /**
     * @param handle - the open `team_domain` handle.
     */
    constructor(handle: StorageDomainHandle);
    /**
     * Durably put one TeamSession record, keyed by root session id.
     * Idempotent when the identical bytes are stored; a different record at
     * the same key raises `RECORD_DUPLICATE` with
     * `contractsCode: 'DUPLICATE_TEAM_SESSION'`.
     * @param input - the contracts v1 input (schemaVersion is stamped here).
     * @returns the frozen stamped record.
     */
    put(input: TeamSessionRecordInput): Promise<TeamSessionRecordDto>;
    /**
     * Read one TeamSession record by root session id.
     * @returns the frozen record, or `undefined` when absent.
     * @throws `RECORD_INVALID` (contracts code preserved) for a malformed
     *   root session id, or a malformed/non-canonical stored row.
     */
    get(rootSessionId: string): TeamSessionRecordDto | undefined;
    /**
     * List every TeamSession record, sorted by root session id (byte order).
     */
    list(): TeamSessionRecordDto[];
    /**
     * Durably advance the team's `generation` stamp by exactly one — the
     * S1-A lag-tolerant push stamp (Gate G8 supplement, adjudicated R60).
     *
     * The increment is one atomic `update` on the domain write chain (the
     * established `allocateSequence` pattern): the write is durable before
     * the in-memory row changes, and two advances of the same team
     * serialize on that chain (monotonic; no concurrent lost update). The
     * stamp is the EXISTING `team_sessions.generation` field — no new row,
     * field, store, or contract.
     *
     * A missing team row rejects through the public seam `missing-key`
     * code and surfaces as `SEAM_FAILURE` (the closed v1 error set has no
     * `RECORD_MISSING`; a stamp advance for a team that does not exist is
     * a domain-invariant violation the real wiring cannot produce, so the
     * loud failure is the intended behavior).
     * @param rootSessionId - the team root to stamp (plain string, parsed).
     * @returns the new generation (a freshly seeded team advances 1 → 2).
     */
    advanceGeneration(rootSessionId: string): Promise<number>;
    /**
     * Durably delete one TeamSession record.
     * @returns `true` when the record existed, `false` otherwise.
     */
    delete(rootSessionId: string): Promise<boolean>;
}
//# sourceMappingURL=team-sessions.d.ts.map