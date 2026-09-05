/**
 * CompatibilityRepository — the `compatibility` store: the durable
 * compatibility state per TeamSession, keyed by root session id (one row
 * per team).
 *
 * The state carries the frozen P3-aligned status, the environment/input
 * fingerprint, the requirement outcomes, and the explicit human
 * acknowledgements (the `DEGRADED_ACKNOWLEDGED` path). Storage validates
 * the closed shape only; the semantic evaluation of requirements stays in
 * the P3 policy domain.
 *
 * @module @dsh-agent-team/storage/repositories/compatibility
 */
import type { CompatibilityStateRecord, StorageDomainHandle } from '../schema/index.js';
import { BaseRepository } from './base.js';
/**
 * The `compatibility` repository.
 */
export declare class CompatibilityRepository extends BaseRepository {
    /**
     * @param handle - the open `team_domain` handle.
     */
    constructor(handle: StorageDomainHandle);
    /**
     * Durably put one compatibility state, keyed by root session id.
     * Idempotent when the identical bytes are stored; a different state at
     * the same key raises `RECORD_DUPLICATE` (problem
     * `duplicate-compatibility-state`).
     * @param state - the unknown input, parsed via
     *   `parseCompatibilityState` (closed shape).
     * @returns the frozen record.
     */
    put(state: unknown): Promise<CompatibilityStateRecord>;
    /**
     * Read one compatibility state by root session id.
     * @returns the frozen record, or `undefined` when absent.
     * @throws `RECORD_INVALID` (contracts code preserved) for a malformed
     *   root session id, or a malformed/non-canonical stored row.
     */
    get(rootSessionId: string): CompatibilityStateRecord | undefined;
    /**
     * List every compatibility state of one team. There is at most one row
     * per root session (the key is the root session id), so this returns a
     * single-element or empty array; it exists so store audits can iterate
     * uniformly across repositories.
     * @param rootSessionId - the team (root session id) to list.
     */
    list(rootSessionId: string): CompatibilityStateRecord[];
    /**
     * Durably delete one compatibility state.
     * @returns `true` when the state existed, `false` otherwise.
     */
    delete(rootSessionId: string): Promise<boolean>;
}
//# sourceMappingURL=compatibility.d.ts.map