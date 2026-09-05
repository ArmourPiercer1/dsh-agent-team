/**
 * MemberInstancesRepository — the `member_instances` store: the durable
 * MemberInstance records, keyed by the canonical member identity key
 * (`memberIdentityKey({ rootSessionId, instanceId })`).
 *
 * Instance ids are unique WITHIN a team (the same instance id may exist
 * under different root sessions); the uniqueness rule is enforced through
 * the frozen contracts assertion `assertInstanceIdUniqueWithinTeam`,
 * preserved in `details.contractsCode`.
 *
 * @module @dsh-agent-team/storage/repositories/member-instances
 */
import { assertInstanceIdUniqueWithinTeam, assertNoLegacyFields, createMemberIdentity, createMemberInstanceRecord, deserializeMemberInstanceRecord, isMemberLifecycleState, memberIdentityKey, parseInstanceId, parseMemberIdentityKey, parseRootSessionId, serializeMemberInstanceRecord, } from '../../contracts/src/index.js';
import { normalizeValidationError, teamDomainError } from '../schema/index.js';
import { BaseRepository } from './base.js';
/**
 * The `member_instances` repository.
 */
export class MemberInstancesRepository extends BaseRepository {
    /**
     * @param handle - the open `team_domain` handle.
     */
    constructor(handle) {
        super(handle, 'member_instances');
    }
    /**
     * Durably put one MemberInstance record, keyed by member identity.
     * Idempotent when the identical bytes are stored; a different record at
     * the same key raises `RECORD_DUPLICATE` with
     * `contractsCode: 'DUPLICATE_INSTANCE_ID'` (scoped by root session).
     * @param input - the contracts v1 input (schemaVersion is stamped here).
     * @returns the frozen stamped record.
     */
    async put(input) {
        let record;
        try {
            assertNoLegacyFields(input, 'MemberInstanceRecord');
            record = createMemberInstanceRecord(input);
        }
        catch (error) {
            throw normalizeValidationError(error, this.storeName);
        }
        const key = memberIdentityKey(createMemberIdentity(record.rootSessionId, record.instanceId));
        await this.putRecord(key, serializeMemberInstanceRecord(record), (existing) => {
            let other;
            try {
                other = deserializeMemberInstanceRecord(existing);
            }
            catch (error) {
                throw normalizeValidationError(error, this.storeName, key);
            }
            try {
                assertInstanceIdUniqueWithinTeam(record.rootSessionId, record.instanceId, [other]);
            }
            catch (error) {
                throw this.conflictError(error, key);
            }
        });
        return record;
    }
    /**
     * Read one MemberInstance record by (root session id, instance id).
     * @returns the frozen record, or `undefined` when absent.
     * @throws `RECORD_INVALID` (contracts codes preserved) for malformed
     *   ids, or a malformed/non-canonical stored row.
     */
    get(rootSessionId, instanceId) {
        let key;
        try {
            key = memberIdentityKey(createMemberIdentity(parseRootSessionId(rootSessionId), parseInstanceId(instanceId)));
        }
        catch (error) {
            throw normalizeValidationError(error, this.storeName, rootSessionId);
        }
        return this.readRecord(key, deserializeMemberInstanceRecord, serializeMemberInstanceRecord);
    }
    /**
     * List every MemberInstance record of one team, sorted by instance id
     * (byte order).
     * @param rootSessionId - the team (root session id) to list.
     */
    list(rootSessionId) {
        let root;
        try {
            root = String(parseRootSessionId(rootSessionId));
        }
        catch (error) {
            throw normalizeValidationError(error, this.storeName, rootSessionId);
        }
        const records = [];
        for (const [key, raw] of this.snapshotEntries()) {
            let identity;
            try {
                identity = parseMemberIdentityKey(key);
            }
            catch (error) {
                throw normalizeValidationError(error, this.storeName, key);
            }
            if (identity.rootSessionId !== root)
                continue;
            records.push(this.readRecordFromRaw(key, raw, deserializeMemberInstanceRecord, serializeMemberInstanceRecord));
        }
        records.sort((a, b) => (a.instanceId < b.instanceId ? -1 : a.instanceId > b.instanceId ? 1 : 0));
        return records;
    }
    /**
     * Durably commit one lifecycle transition with a compare-and-swap on the
     * stored row: the transition applies only when the stored row is a v1
     * member record whose identity matches the request, whose
     * `lifecycle === args.from`, and whose
     * `activityVersion === args.expectedActivityVersion`.
     *
     * This is the R4/CR-10 durable layer behind `LifecycleCommitPort`:
     * the P8-S2-era delete+put pattern let a stale reader overwrite a
     * concurrent writer; here the read-modify-write is one atomic seam
     * `update` on the domain write chain (the same seam call as
     * `advanceGeneration`), so two writers racing on the same expected
     * version cannot both commit (W8).
     *
     * Conflict classification stays inside the closed v1 error set (no new
     * codes; `packages/contracts/**` untouched):
     * - a v2 leader row (the P8-S2 record union keeps leaders in this same
     *   table) -> `RECORD_INVALID` `problem: 'cas-leader-not-operable'`
     *   (leaders are lifecycle-inoperable, invariant 13);
     * - a stored row whose identity does not match the request (corruption)
     *   -> `RECORD_INVALID` `problem: 'cas-identity-mismatch'`;
     * - a stale from-state or activity version -> `RECORD_DUPLICATE`
     *   `problem: 'cas-mismatch'` with the expected/found pairs (the
     *   "somebody moved this row" conflict RECORD_DUPLICATE already carries
     *   for put races);
     * - a missing key -> `SEAM_FAILURE` via the public seam `missing-key`
     *   (the closed v1 set has no RECORD_MISSING; a CAS on a row that does
     *   not exist is a domain-invariant violation the real wiring cannot
     *   produce, so the loud failure is intended — same rule as
     *   `advanceGeneration`).
     *
     * On success the stored row's `lifecycle` becomes `args.to` and
     * `activityVersion` is bumped by exactly 1 (the domain FSM's version
     * discipline, mirrored in the durable layer). The freshly deserialized
     * committed row is returned.
     *
     * `args.operation` is accepted for diagnostics and caller symmetry with
     * the port; FSM legality of from -> to via `operation` is validated
     * upstream (the domain FSM dry-run), never re-implemented here.
     *
     * @param args - root/instance identity, the expected version and
     *   from-state read by the caller, the FSM operation, and the target
     *   state to commit.
     * @returns the committed record (lifecycle = `args.to`,
     *   activityVersion = `args.expectedActivityVersion + 1`).
     */
    async commitTransition(args) {
        let root;
        let instanceId;
        try {
            root = String(parseRootSessionId(args.rootSessionId));
            instanceId = String(parseInstanceId(args.instanceId));
        }
        catch (error) {
            throw normalizeValidationError(error, this.storeName, args.rootSessionId);
        }
        if (!isMemberLifecycleState(args.from) || !isMemberLifecycleState(args.to)) {
            throw teamDomainError('RECORD_INVALID', `commitTransition: invalid lifecycle state (from='${String(args.from)}' to='${String(args.to)}')`, { store: this.storeName, instanceId, problem: 'invalid-lifecycle-state' });
        }
        const key = memberIdentityKey(createMemberIdentity(parseRootSessionId(root), parseInstanceId(instanceId)));
        const nextRaw = await this.updateRaw(key, (current) => {
            let record;
            try {
                record = deserializeMemberInstanceRecord(String(current));
            }
            catch (error) {
                throw normalizeValidationError(error, this.storeName, key);
            }
            // P8-S2 record union: deserializeMemberInstanceRecord returns v2
            // leader rows cast to the v1 surface; the runtime stamp is the only
            // discriminator.
            if (record.schemaVersion === 2) {
                throw teamDomainError('RECORD_INVALID', 'commitTransition: v2 leader rows are lifecycle-inoperable (invariant 13)', { store: this.storeName, instanceId, problem: 'cas-leader-not-operable' });
            }
            if (record.rootSessionId !== root || record.instanceId !== instanceId) {
                throw teamDomainError('RECORD_INVALID', 'commitTransition: stored row identity does not match the requested identity', {
                    store: this.storeName,
                    problem: 'cas-identity-mismatch',
                    expectedInstanceId: instanceId,
                    foundInstanceId: record.instanceId,
                });
            }
            if (record.lifecycle !== args.from || record.activityVersion !== args.expectedActivityVersion) {
                throw teamDomainError('RECORD_DUPLICATE', 'commitTransition: the row moved since the caller read it (CAS mismatch)', {
                    store: this.storeName,
                    instanceId,
                    problem: 'cas-mismatch',
                    expectedLifecycle: args.from,
                    expectedActivityVersion: args.expectedActivityVersion,
                    foundLifecycle: record.lifecycle,
                    foundActivityVersion: record.activityVersion,
                });
            }
            return serializeMemberInstanceRecord({ ...record, lifecycle: args.to, activityVersion: record.activityVersion + 1 });
        });
        let next;
        try {
            next = deserializeMemberInstanceRecord(String(nextRaw));
        }
        catch (error) {
            throw normalizeValidationError(error, this.storeName, key);
        }
        return next;
    }
    /**
     * Durably delete one MemberInstance record.
     * @returns `true` when the record existed, `false` otherwise.
     */
    async delete(rootSessionId, instanceId) {
        let key;
        try {
            key = memberIdentityKey(createMemberIdentity(parseRootSessionId(rootSessionId), parseInstanceId(instanceId)));
        }
        catch (error) {
            throw normalizeValidationError(error, this.storeName, rootSessionId);
        }
        return this.deleteRow(key);
    }
}
//# sourceMappingURL=member-instances.js.map