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

import { parseRootSessionId } from '../../contracts/src/index.js'
import {
  deserializeCompatibilityState,
  normalizeValidationError,
  parseCompatibilityState,
  serializeCompatibilityState,
  teamDomainError,
} from '../schema/index.js'
import type { CompatibilityStateRecord, StorageDomainHandle } from '../schema/index.js'
import { BaseRepository } from './base.js'

/**
 * The `compatibility` repository.
 */
export class CompatibilityRepository extends BaseRepository {
  /**
   * @param handle - the open `team_domain` handle.
   */
  constructor(handle: StorageDomainHandle) {
    super(handle, 'compatibility')
  }

  /**
   * Durably put one compatibility state, keyed by root session id.
   * Idempotent when the identical bytes are stored; a different state at
   * the same key raises `RECORD_DUPLICATE` (problem
   * `duplicate-compatibility-state`).
   * @param state - the unknown input, parsed via
   *   `parseCompatibilityState` (closed shape).
   * @returns the frozen record.
   */
  async put(state: unknown): Promise<CompatibilityStateRecord> {
    let record: CompatibilityStateRecord
    try {
      record = parseCompatibilityState(state)
    } catch (error) {
      throw normalizeValidationError(error, this.storeName)
    }
    const key = String(record.rootSessionId)
    await this.putRecord(key, serializeCompatibilityState(record), (existing) => {
      try {
        deserializeCompatibilityState(existing)
      } catch (error) {
        throw normalizeValidationError(error, this.storeName, key)
      }
      throw teamDomainError(
        'RECORD_DUPLICATE',
        `a compatibility state for root session '${record.rootSessionId}' already exists`,
        { store: this.storeName, key, problem: 'duplicate-compatibility-state' },
      )
    })
    return record
  }

  /**
   * Read one compatibility state by root session id.
   * @returns the frozen record, or `undefined` when absent.
   * @throws `RECORD_INVALID` (contracts code preserved) for a malformed
   *   root session id, or a malformed/non-canonical stored row.
   */
  get(rootSessionId: string): CompatibilityStateRecord | undefined {
    let key: string
    try {
      key = String(parseRootSessionId(rootSessionId))
    } catch (error) {
      throw normalizeValidationError(error, this.storeName, rootSessionId)
    }
    return this.readRecord(key, deserializeCompatibilityState, serializeCompatibilityState)
  }

  /**
   * List every compatibility state of one team. There is at most one row
   * per root session (the key is the root session id), so this returns a
   * single-element or empty array; it exists so store audits can iterate
   * uniformly across repositories.
   * @param rootSessionId - the team (root session id) to list.
   */
  list(rootSessionId: string): CompatibilityStateRecord[] {
    let root: string
    try {
      root = String(parseRootSessionId(rootSessionId))
    } catch (error) {
      throw normalizeValidationError(error, this.storeName, rootSessionId)
    }
    const records: CompatibilityStateRecord[] = []
    for (const [key, raw] of this.snapshotEntries()) {
      const record = this.readRecordFromRaw(key, raw, deserializeCompatibilityState, serializeCompatibilityState)
      if (record.rootSessionId === root) records.push(record)
    }
    records.sort((a, b) => (a.rootSessionId < b.rootSessionId ? -1 : a.rootSessionId > b.rootSessionId ? 1 : 0))
    return records
  }

  /**
   * Durably delete one compatibility state.
   * @returns `true` when the state existed, `false` otherwise.
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
