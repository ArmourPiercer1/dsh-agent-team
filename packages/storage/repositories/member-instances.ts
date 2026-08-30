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

import {
  assertInstanceIdUniqueWithinTeam,
  assertNoLegacyFields,
  createMemberIdentity,
  createMemberInstanceRecord,
  deserializeMemberInstanceRecord,
  memberIdentityKey,
  parseInstanceId,
  parseMemberIdentityKey,
  parseRootSessionId,
  serializeMemberInstanceRecord,
} from '../../contracts/src/index.js'
import type { MemberInstanceRecordDto, MemberInstanceRecordInput, RemoteSafeRecord } from '../../contracts/src/index.js'
import { normalizeValidationError } from '../schema/index.js'
import type { StorageDomainHandle } from '../schema/index.js'
import { BaseRepository } from './base.js'

/**
 * The `member_instances` repository.
 */
export class MemberInstancesRepository extends BaseRepository {
  /**
   * @param handle - the open `team_domain` handle.
   */
  constructor(handle: StorageDomainHandle) {
    super(handle, 'member_instances')
  }

  /**
   * Durably put one MemberInstance record, keyed by member identity.
   * Idempotent when the identical bytes are stored; a different record at
   * the same key raises `RECORD_DUPLICATE` with
   * `contractsCode: 'DUPLICATE_INSTANCE_ID'` (scoped by root session).
   * @param input - the contracts v1 input (schemaVersion is stamped here).
   * @returns the frozen stamped record.
   */
  async put(input: MemberInstanceRecordInput): Promise<MemberInstanceRecordDto> {
    let record: MemberInstanceRecordDto
    try {
      assertNoLegacyFields(input as unknown as RemoteSafeRecord, 'MemberInstanceRecord')
      record = createMemberInstanceRecord(input)
    } catch (error) {
      throw normalizeValidationError(error, this.storeName)
    }
    const key = memberIdentityKey(createMemberIdentity(record.rootSessionId, record.instanceId))
    await this.putRecord(key, serializeMemberInstanceRecord(record), (existing) => {
      let other: MemberInstanceRecordDto
      try {
        other = deserializeMemberInstanceRecord(existing)
      } catch (error) {
        throw normalizeValidationError(error, this.storeName, key)
      }
      try {
        assertInstanceIdUniqueWithinTeam(record.rootSessionId, record.instanceId, [other])
      } catch (error) {
        throw this.conflictError(error, key)
      }
    })
    return record
  }

  /**
   * Read one MemberInstance record by (root session id, instance id).
   * @returns the frozen record, or `undefined` when absent.
   * @throws `RECORD_INVALID` (contracts codes preserved) for malformed
   *   ids, or a malformed/non-canonical stored row.
   */
  get(rootSessionId: string, instanceId: string): MemberInstanceRecordDto | undefined {
    let key: string
    try {
      key = memberIdentityKey(createMemberIdentity(parseRootSessionId(rootSessionId), parseInstanceId(instanceId)))
    } catch (error) {
      throw normalizeValidationError(error, this.storeName, rootSessionId)
    }
    return this.readRecord(key, deserializeMemberInstanceRecord, serializeMemberInstanceRecord)
  }

  /**
   * List every MemberInstance record of one team, sorted by instance id
   * (byte order).
   * @param rootSessionId - the team (root session id) to list.
   */
  list(rootSessionId: string): MemberInstanceRecordDto[] {
    let root: string
    try {
      root = String(parseRootSessionId(rootSessionId))
    } catch (error) {
      throw normalizeValidationError(error, this.storeName, rootSessionId)
    }
    const records: MemberInstanceRecordDto[] = []
    for (const [key, raw] of this.snapshotEntries()) {
      let identity: ReturnType<typeof parseMemberIdentityKey>
      try {
        identity = parseMemberIdentityKey(key)
      } catch (error) {
        throw normalizeValidationError(error, this.storeName, key)
      }
      if (identity.rootSessionId !== root) continue
      records.push(this.readRecordFromRaw(key, raw, deserializeMemberInstanceRecord, serializeMemberInstanceRecord))
    }
    records.sort((a, b) => (a.instanceId < b.instanceId ? -1 : a.instanceId > b.instanceId ? 1 : 0))
    return records
  }

  /**
   * Durably delete one MemberInstance record.
   * @returns `true` when the record existed, `false` otherwise.
   */
  async delete(rootSessionId: string, instanceId: string): Promise<boolean> {
    let key: string
    try {
      key = memberIdentityKey(createMemberIdentity(parseRootSessionId(rootSessionId), parseInstanceId(instanceId)))
    } catch (error) {
      throw normalizeValidationError(error, this.storeName, rootSessionId)
    }
    return this.deleteRow(key)
  }
}
