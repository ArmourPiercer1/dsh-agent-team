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
import type { MemberInstanceRecordDto, MemberInstanceRecordInput, MemberLifecycleState } from '../../contracts/src/index.js';
import type { StorageDomainHandle } from '../schema/index.js';
import { BaseRepository } from './base.js';
/**
 * The `member_instances` repository.
 */
export declare class MemberInstancesRepository extends BaseRepository {
    /**
     * @param handle - the open `team_domain` handle.
     */
    constructor(handle: StorageDomainHandle);
    /**
     * Durably put one MemberInstance record, keyed by member identity.
     * Idempotent when the identical bytes are stored; a different record at
     * the same key raises `RECORD_DUPLICATE` with
     * `contractsCode: 'DUPLICATE_INSTANCE_ID'` (scoped by root session).
     * @param input - the contracts v1 input (schemaVersion is stamped here).
     * @returns the frozen stamped record.
     */
    put(input: MemberInstanceRecordInput): Promise<MemberInstanceRecordDto>;
    /**
     * Read one MemberInstance record by (root session id, instance id).
     * @returns the frozen record, or `undefined` when absent.
     * @throws `RECORD_INVALID` (contracts codes preserved) for malformed
     *   ids, or a malformed/non-canonical stored row.
     */
    get(rootSessionId: string, instanceId: string): MemberInstanceRecordDto | undefined;
    /**
     * List every MemberInstance record of one team, sorted by instance id
     * (byte order).
     * @param rootSessionId - the team (root session id) to list.
     */
    list(rootSessionId: string): MemberInstanceRecordDto[];
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
    commitTransition(args: {
        rootSessionId: string;
        instanceId: string;
        expectedActivityVersion: number;
        from: MemberLifecycleState;
        operation: string;
        to: MemberLifecycleState;
    }): Promise<MemberInstanceRecordDto>;
    /**
     * Durably delete one MemberInstance record.
     * @returns `true` when the record existed, `false` otherwise.
     */
    delete(rootSessionId: string, instanceId: string): Promise<boolean>;
}
//# sourceMappingURL=member-instances.d.ts.map