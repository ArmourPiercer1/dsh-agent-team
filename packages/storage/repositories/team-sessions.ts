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

import {
  assertNoLegacyFields,
  assertTeamSessionUnique,
  createTeamSessionRecord,
  deserializeTeamSessionRecord,
  parseRootSessionId,
  serializeTeamSessionRecord,
} from '../../contracts/src/index.js'
import type { RemoteSafeRecord, TeamSessionRecordDto, TeamSessionRecordInput } from '../../contracts/src/index.js'
import { normalizeValidationError } from '../schema/index.js'
import type { StorageDomainHandle } from '../schema/index.js'
import { BaseRepository } from './base.js'

/**
 * The `team_sessions` repository.
 */
export class TeamSessionsRepository extends BaseRepository {
  /**
   * @param handle - the open `team_domain` handle.
   */
  constructor(handle: StorageDomainHandle) {
    super(handle, 'team_sessions')
  }

  /**
   * Durably put one TeamSession record, keyed by root session id.
   * Idempotent when the identical bytes are stored; a different record at
   * the same key raises `RECORD_DUPLICATE` with
   * `contractsCode: 'DUPLICATE_TEAM_SESSION'`.
   * @param input - the contracts v1 input (schemaVersion is stamped here).
   * @returns the frozen stamped record.
   */
  async put(input: TeamSessionRecordInput): Promise<TeamSessionRecordDto> {
    let record: TeamSessionRecordDto
    try {
      assertNoLegacyFields(input as unknown as RemoteSafeRecord, 'TeamSessionRecord')
      record = createTeamSessionRecord(input)
    } catch (error) {
      throw normalizeValidationError(error, this.storeName)
    }
    const key = String(record.rootSessionId)
    await this.putRecord(key, serializeTeamSessionRecord(record), (existing) => {
      let other: TeamSessionRecordDto
      try {
        other = deserializeTeamSessionRecord(existing)
      } catch (error) {
        throw normalizeValidationError(error, this.storeName, key)
      }
      try {
        assertTeamSessionUnique(record.rootSessionId, [other])
      } catch (error) {
        throw this.conflictError(error, key)
      }
    })
    return record
  }

  /**
   * Read one TeamSession record by root session id.
   * @returns the frozen record, or `undefined` when absent.
   * @throws `RECORD_INVALID` (contracts code preserved) for a malformed
   *   root session id, or a malformed/non-canonical stored row.
   */
  get(rootSessionId: string): TeamSessionRecordDto | undefined {
    let key: string
    try {
      key = String(parseRootSessionId(rootSessionId))
    } catch (error) {
      throw normalizeValidationError(error, this.storeName, rootSessionId)
    }
    return this.readRecord(key, deserializeTeamSessionRecord, serializeTeamSessionRecord)
  }

  /**
   * List every TeamSession record, sorted by root session id (byte order).
   */
  list(): TeamSessionRecordDto[] {
    const records: TeamSessionRecordDto[] = []
    for (const [key, raw] of this.snapshotEntries()) {
      records.push(this.readRecordFromRaw(key, raw, deserializeTeamSessionRecord, serializeTeamSessionRecord))
    }
    records.sort((a, b) => (a.rootSessionId < b.rootSessionId ? -1 : a.rootSessionId > b.rootSessionId ? 1 : 0))
    return records
  }

  /**
   * Durably delete one TeamSession record.
   * @returns `true` when the record existed, `false` otherwise.
   */
  async delete(rootSessionId: string): Promise<boolean> {
    let key: string
    try {
      key = String(parseRootSessionId(rootSessionId))
    } catch (error) {
      throw normalizeValidationError(error, this.storeName, rootSessionId)
    }
    return this.deleteRow(key)
  }
}
