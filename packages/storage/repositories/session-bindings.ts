/**
 * SessionBindingsRepository — the `session_bindings` store: the durable
 * session-kind bindings, keyed by session id (one row per bound session).
 *
 * Three frozen kinds (contracts v1): `ordinary` (a plain session),
 * `team-root` (a session that is the root of a team), and `team-member`
 * (a member child session bound to a team, carrying root session id +
 * instance id). The vNext session model has no Team SessionEvents — the
 * binding row is the durable record that a member child session belongs
 * to a team, independent of any SessionEvent storage (the AC this task
 * must prove).
 *
 * Uniqueness: a session id may be bound exactly once. Re-binding a
 * `team-member` session raises `RECORD_DUPLICATE` with
 * `contractsCode: 'SESSION_ALREADY_BOUND'` (the frozen contracts
 * assertion); re-binding a session of a different kind raises the
 * store-level `session-already-bound` problem.
 *
 * @module @dsh-agent-team/storage/repositories/session-bindings
 */

import {
  SESSION_BINDING_KINDS,
  assertChildSessionBindingUnique,
  deserializeSessionBinding,
  parseSessionBinding,
  parseSessionId,
  serializeSessionBinding,
} from '../../contracts/src/index.js'
import type { ChildSessionId, SessionBindingDto, SessionBindingKind } from '../../contracts/src/index.js'
import { normalizeValidationError, teamDomainError } from '../schema/index.js'
import type { StorageDomainHandle } from '../schema/index.js'
import { BaseRepository } from './base.js'

function isSessionBindingKind(value: unknown): value is SessionBindingKind {
  return (Object.values(SESSION_BINDING_KINDS) as readonly string[]).includes(value as string)
}

/**
 * The `session_bindings` repository.
 */
export class SessionBindingsRepository extends BaseRepository {
  /**
   * @param handle - the open `team_domain` handle.
   */
  constructor(handle: StorageDomainHandle) {
    super(handle, 'session_bindings')
  }

  /**
   * Durably put one session binding, keyed by session id.
   * Idempotent when the identical bytes are stored; an occupied key
   * raises `RECORD_DUPLICATE` (same-kind team-member rebinds keep the
   * contracts `SESSION_ALREADY_BOUND`; cross-kind rebinds raise the typed
   * `session-already-bound` problem).
   * @param binding - the unknown input, parsed via the frozen contracts
   *   `parseSessionBinding` (no factory exists by design).
   * @returns the frozen binding.
   */
  async put(binding: unknown): Promise<SessionBindingDto> {
    let record: SessionBindingDto
    try {
      record = parseSessionBinding(binding)
    } catch (error) {
      throw normalizeValidationError(error, this.storeName)
    }
    const key = String(record.sessionId)
    await this.putRecord(key, serializeSessionBinding(record), (existing) => {
      let other: SessionBindingDto
      try {
        other = deserializeSessionBinding(existing)
      } catch (error) {
        throw normalizeValidationError(error, this.storeName, key)
      }
      if (other.kind !== record.kind) {
        throw teamDomainError(
          'RECORD_DUPLICATE',
          `session '${record.sessionId}' is already bound as kind '${other.kind}'; cannot rebind as kind '${record.kind}'`,
          { store: this.storeName, key, problem: 'session-already-bound', existingKind: other.kind, newKind: record.kind },
        )
      }
      if (other.kind === SESSION_BINDING_KINDS.TEAM_MEMBER) {
        try {
          assertChildSessionBindingUnique(record.sessionId as ChildSessionId, [other])
        } catch (error) {
          throw this.conflictError(error, key)
        }
      }
      throw teamDomainError(
        'RECORD_DUPLICATE',
        `session '${record.sessionId}' is already bound as kind '${other.kind}'`,
        { store: this.storeName, key, problem: 'duplicate-binding' },
      )
    })
    return record
  }

  /**
   * Read one session binding by session id.
   * @returns the frozen binding, or `undefined` when absent.
   * @throws `RECORD_INVALID` (contracts code preserved) for a malformed
   *   session id, or a malformed/non-canonical stored row.
   */
  get(sessionId: string): SessionBindingDto | undefined {
    let key: string
    try {
      key = String(parseSessionId(sessionId))
    } catch (error) {
      throw normalizeValidationError(error, this.storeName, sessionId)
    }
    return this.readRecord(key, deserializeSessionBinding, serializeSessionBinding)
  }

  /**
   * List every binding of one kind, sorted by session id (byte order).
   * @param kind - the frozen binding kind (`ordinary` | `team-root` |
   *   `team-member`).
   * @throws `RECORD_INVALID` (problem `bad-binding-kind`) for a
   *   non-frozen kind.
   */
  listByKind(kind: string): SessionBindingDto[] {
    if (!isSessionBindingKind(kind)) {
      throw teamDomainError(
        'RECORD_INVALID',
        `unknown session binding kind '${kind}'; the frozen kinds are: ${Object.values(SESSION_BINDING_KINDS).join(', ')}`,
        { store: this.storeName, problem: 'bad-binding-kind' },
      )
    }
    const records: SessionBindingDto[] = []
    for (const [key, raw] of this.snapshotEntries()) {
      const record = this.readRecordFromRaw(key, raw, deserializeSessionBinding, serializeSessionBinding)
      if (record.kind === kind) records.push(record)
    }
    records.sort((a, b) => (a.sessionId < b.sessionId ? -1 : a.sessionId > b.sessionId ? 1 : 0))
    return records
  }

  /**
   * Durably delete one session binding.
   * @returns `true` when the binding existed, `false` otherwise.
   */
  async delete(sessionId: string): Promise<boolean> {
    let key: string
    try {
      key = String(parseSessionId(sessionId))
    } catch (error) {
      throw normalizeValidationError(error, this.storeName, sessionId)
    }
    return this.deleteRow(key)
  }
}
