/**
 * OverridesRepository — the `overrides` store: durable governance
 * overrides, keyed by the canonical identity key
 * (`governanceOverrideKey({ kind, recordId, scope, rootSessionId,
 * instanceId? })`).
 *
 * The store separates agent autonomy overlays (attributable to the agent
 * authority via `origin`) from human overrides (never carrying `origin`)
 * — the cross-field rules of `parseGovernanceOverride` make an untraceable
 * patch impossible (Architecture §14.3 D).
 *
 * @module @dsh-agent-team/storage/repositories/overrides
 */
import type { GovernanceOverrideIdentity, GovernanceOverrideRecord, StorageDomainHandle } from '../schema/index.js';
import { BaseRepository } from './base.js';
/**
 * The `overrides` repository.
 */
export declare class OverridesRepository extends BaseRepository {
    /**
     * @param handle - the open `team_domain` handle.
     */
    constructor(handle: StorageDomainHandle);
    /**
     * Durably put one governance override, keyed by identity.
     * Idempotent when the identical bytes are stored; a different record at
     * the same identity raises `RECORD_DUPLICATE` (problem
     * `duplicate-override`).
     * @param override - the unknown input, parsed via
     *   `parseGovernanceOverride` (closed shape, cross-field rules).
     * @returns the frozen record.
     */
    put(override: unknown): Promise<GovernanceOverrideRecord>;
    /**
     * Read one governance override by identity.
     * @param identity - the identity components (plain strings; `instanceId`
     *   for instance scope).
     * @returns the frozen record, or `undefined` when absent.
     */
    get(identity: GovernanceOverrideIdentity): GovernanceOverrideRecord | undefined;
    /**
     * List every override of one team (both scopes), sorted by record id
     * (byte order).
     * @param rootSessionId - the team (root session id) to list.
     */
    list(rootSessionId: string): GovernanceOverrideRecord[];
    /**
     * Durably delete one governance override.
     * @param identity - the identity components.
     * @returns `true` when the override existed, `false` otherwise.
     */
    delete(identity: GovernanceOverrideIdentity): Promise<boolean>;
}
//# sourceMappingURL=overrides.d.ts.map