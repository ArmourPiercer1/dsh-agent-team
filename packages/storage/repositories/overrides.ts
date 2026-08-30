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

import { parseRootSessionId } from '../../contracts/src/index.js'
import {
  deserializeGovernanceOverride,
  governanceOverrideKey,
  normalizeValidationError,
  parseGovernanceOverride,
  serializeGovernanceOverride,
  teamDomainError,
} from '../schema/index.js'
import type { GovernanceOverrideIdentity, GovernanceOverrideRecord, StorageDomainHandle } from '../schema/index.js'
import { BaseRepository } from './base.js'

/**
 * The `overrides` repository.
 */
export class OverridesRepository extends BaseRepository {
  /**
   * @param handle - the open `team_domain` handle.
   */
  constructor(handle: StorageDomainHandle) {
    super(handle, 'overrides')
  }

  /**
   * Durably put one governance override, keyed by identity.
   * Idempotent when the identical bytes are stored; a different record at
   * the same identity raises `RECORD_DUPLICATE` (problem
   * `duplicate-override`).
   * @param override - the unknown input, parsed via
   *   `parseGovernanceOverride` (closed shape, cross-field rules).
   * @returns the frozen record.
   */
  async put(override: unknown): Promise<GovernanceOverrideRecord> {
    let record: GovernanceOverrideRecord
    try {
      record = parseGovernanceOverride(override)
    } catch (error) {
      throw normalizeValidationError(error, this.storeName)
    }
    const key = governanceOverrideKey({
      kind: record.kind,
      recordId: record.recordId,
      rootSessionId: record.rootSessionId,
      scope: record.scope,
      instanceId: record.instanceId,
    })
    await this.putRecord(key, serializeGovernanceOverride(record), (existing) => {
      try {
        deserializeGovernanceOverride(existing)
      } catch (error) {
        throw normalizeValidationError(error, this.storeName, key)
      }
      throw teamDomainError(
        'RECORD_DUPLICATE',
        `an override with identity key '${key}' already exists in store 'overrides'`,
        { store: this.storeName, key, problem: 'duplicate-override' },
      )
    })
    return record
  }

  /**
   * Read one governance override by identity.
   * @param identity - the identity components (plain strings; `instanceId`
   *   for instance scope).
   * @returns the frozen record, or `undefined` when absent.
   */
  get(identity: GovernanceOverrideIdentity): GovernanceOverrideRecord | undefined {
    const key = governanceOverrideKey(identity)
    return this.readRecord(key, deserializeGovernanceOverride, serializeGovernanceOverride)
  }

  /**
   * List every override of one team (both scopes), sorted by record id
   * (byte order).
   * @param rootSessionId - the team (root session id) to list.
   */
  list(rootSessionId: string): GovernanceOverrideRecord[] {
    let root: string
    try {
      root = String(parseRootSessionId(rootSessionId))
    } catch (error) {
      throw normalizeValidationError(error, this.storeName, rootSessionId)
    }
    const records: GovernanceOverrideRecord[] = []
    for (const [key, raw] of this.snapshotEntries()) {
      const record = this.readRecordFromRaw(key, raw, deserializeGovernanceOverride, serializeGovernanceOverride)
      if (record.rootSessionId === root) records.push(record)
    }
    records.sort((a, b) => (a.recordId < b.recordId ? -1 : a.recordId > b.recordId ? 1 : 0))
    return records
  }

  /**
   * Durably delete one governance override.
   * @param identity - the identity components.
   * @returns `true` when the override existed, `false` otherwise.
   */
  delete(identity: GovernanceOverrideIdentity): Promise<boolean> {
    const key = governanceOverrideKey(identity)
    return this.deleteRow(key)
  }
}
