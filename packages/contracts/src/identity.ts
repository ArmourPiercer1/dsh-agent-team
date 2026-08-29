/**
 * Member identity: the composite runtime identity of a MemberInstance.
 *
 * Frozen Architecture facts (invariant numbers refer to Architecture §42):
 *
 * - **Member runtime identity = `(rootSessionId, instanceId)`** (invariant
 *   18, §10.2). `instanceId` is unique within one TeamSession; the
 *   composite key prevents cross-TeamSession confusion.
 * - **TeamSessionId = RootSessionId** (invariant 9), so the first component
 *   of the key IS the TeamSession id: a member identity names its team
 *   without a separate team id.
 * - **label / templateId / groupId are NOT runtime identities**
 *   (invariant 19): the same templateId + label under two instanceIds are
 *   two different members (§10.2 example).
 * - **LeaderInstance** is the only special member (invariant 14): the Root
 *   Agent/Session of the TeamSession, with no childSessionId (§9.2). It
 *   participates in the unified identity model with a RESERVED instance id
 *   (`LEADER_INSTANCE_ID`) so instance-first message addressing (§24.1)
 *   and ledger actor identity work for the leader without a second
 *   vocabulary.
 *
 * Pure module: no I/O, no live Agent, no runtime environment assumptions.
 * @module @dsh-agent-team/contracts/identity
 */

import { parseInstanceId } from './ids/instance-id.js'
import type { InstanceId } from './ids/instance-id.js'
import { parseRootSessionId } from './ids/session-id.js'
import type { RootSessionId, TeamSessionId } from './ids/session-id.js'
import { canonicalJsonStringify, deepFreeze } from './remote-safe.js'
import type { RemoteSafeRecord } from './remote-safe.js'
import { teamContractError } from './errors.js'

/**
 * The composite runtime identity of one MemberInstance, including the
 * (special) LeaderInstance.
 */
export interface MemberIdentity {
  /** The TeamSession the member belongs to (its root session id, invariant 9). */
  readonly rootSessionId: RootSessionId
  /** The member's stable instance id, unique within that TeamSession. */
  readonly instanceId: InstanceId
}

/** Reserved instance id of the LeaderInstance of a TeamSession (see module docs). */
export const LEADER_INSTANCE_ID: InstanceId = 'inst-leader' as InstanceId

/**
 * The stable serialization key of a member identity: the canonical (sorted-
 * key) JSON of the two components. Two identities produce the same key iff
 * they are the same member; a different rootSessionId always changes the
 * key, which is what makes cross-TeamSession confusion impossible at the
 * string level.
 * @param identity - the member identity.
 * @returns the canonical JSON key, e.g. `{"instanceId":"inst-a","rootSessionId":"session-1"}`.
 */
export function memberIdentityKey(identity: MemberIdentity): string {
  const record: RemoteSafeRecord = {
    instanceId: identity.instanceId,
    rootSessionId: identity.rootSessionId,
  }
  return canonicalJsonStringify(record)
}

/**
 * Parse a member identity key produced by {@link memberIdentityKey}.
 *
 * Strict: the input must be exactly the canonical encoding of two valid
 * components (extra or missing fields, malformed ids, or a different key
 * order are all rejected).
 * @param key - the identity key string.
 * @returns the parsed member identity.
 * @throws `MALFORMED_DTO` when the key is not canonical encoding of a
 *   member identity, and the id-specific code when a component is malformed.
 */
export function parseMemberIdentityKey(key: string): MemberIdentity {
  let parsed: unknown
  try {
    parsed = JSON.parse(key)
  } catch {
    throw teamContractError(
      'MALFORMED_DTO',
      'member identity key is not valid JSON',
      { key },
    )
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw teamContractError(
      'MALFORMED_DTO',
      'member identity key must encode a plain object',
      { key },
    )
  }
  const record = parsed as RemoteSafeRecord
  const fields = Object.keys(record).sort()
  if (fields.length !== 2 || fields[0] !== 'instanceId' || fields[1] !== 'rootSessionId') {
    throw teamContractError(
      'MALFORMED_DTO',
      'member identity key must encode exactly the fields instanceId and rootSessionId',
      { key, fields },
    )
  }
  const identity = createMemberIdentity(
    parseRootSessionId(record['rootSessionId']),
    parseInstanceId(record['instanceId']),
  )
  if (memberIdentityKey(identity) !== key) {
    throw teamContractError(
      'MALFORMED_DTO',
      'member identity key is not in canonical encoding',
      { key },
    )
  }
  return identity
}

/**
 * Build a member identity from its two components.
 *
 * Both inputs must already be branded (use the `parse*` functions first).
 * The result is deeply frozen: identities are immutable values.
 * @param rootSessionId - the TeamSession (root session) the member belongs to.
 * @param instanceId - the member's stable instance id.
 * @returns the frozen composite identity.
 */
export function createMemberIdentity(
  rootSessionId: RootSessionId,
  instanceId: InstanceId,
): MemberIdentity {
  return deepFreeze({ rootSessionId, instanceId })
}

/**
 * Build the member identity of the (special) LeaderInstance of a TeamSession.
 * @param teamSessionId - the TeamSession id (which is its root session id, invariant 9).
 * @returns the leader's composite identity under the reserved `inst-leader` id.
 */
export function leaderMemberIdentityOf(teamSessionId: TeamSessionId): MemberIdentity {
  return createMemberIdentity(teamSessionId, LEADER_INSTANCE_ID)
}

/**
 * Are two member identities the same member (same TeamSession, same instance)?
 * @param a - first identity.
 * @param b - second identity.
 * @returns `true` iff both components are equal.
 */
export function memberIdentitiesEqual(
  a: MemberIdentity,
  b: MemberIdentity,
): boolean {
  return (
    a.rootSessionId === b.rootSessionId && a.instanceId === b.instanceId
  )
}

/**
 * Assert that a member identity belongs to the given TeamSession.
 *
 * This is the guard against the cross-TeamSession confusion the composite
 * key exists to prevent (invariant 18): an identity minted under root A
 * must never be accepted in the context of root B, even when the
 * `instanceId` values collide.
 * @param identity - the member identity to check.
 * @param teamSessionId - the TeamSession context (its root session id).
 * @throws `IDENTITY_SCOPE_MISMATCH` when `identity.rootSessionId` differs from `teamSessionId`.
 */
export function assertMemberIdentityInTeam(
  identity: MemberIdentity,
  teamSessionId: TeamSessionId,
): void {
  if (identity.rootSessionId !== teamSessionId) {
    throw teamContractError(
      'IDENTITY_SCOPE_MISMATCH',
      `member identity belongs to TeamSession '${identity.rootSessionId}' but was used in TeamSession '${teamSessionId}'; instanceId values are only unique within one TeamSession`,
      {
        identityRootSessionId: identity.rootSessionId,
        teamSessionId,
        instanceId: identity.instanceId,
      },
    )
  }
}
