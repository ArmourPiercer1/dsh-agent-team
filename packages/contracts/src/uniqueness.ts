/**
 * Uniqueness / scoping assertions over contract values.
 *
 * Pure checks over already-parsed contract values that encode the
 * cardinality invariants of the object model. They take the existing
 * records as input (the caller owns the roster) and throw the corresponding
 * contract error — no authority, no I/O.
 *
 * Frozen Architecture facts (invariant numbers refer to Architecture §42):
 *
 * - **One Root Session -> 0 or 1 TeamSession** (invariant 8) →
 *   {@link assertTeamSessionUnique}.
 * - **`instanceId` unique within one TeamSession** (Architecture §10.2;
 *   the composite key, invariant 18, is what makes "within" precise) →
 *   {@link assertInstanceIdUniqueWithinTeam}.
 * - **Every MemberInstance binds exactly one durable child Session**
 *   (invariant 23; a child session is never shared) →
 *   {@link assertChildSessionBindingUnique}.
 *
 * Pure module: no I/O, no live Agent, no runtime environment assumptions.
 * @module @dsh-agent-team/contracts/uniqueness
 */

import type { RootSessionId } from './ids/session-id.js'
import type { InstanceId } from './ids/instance-id.js'
import type { ChildSessionId } from './ids/session-id.js'
import type { TeamSessionRecordDto } from './dto/team-session-record.js'
import type { MemberInstanceRecordDto } from './dto/member-instance-record.js'
import type { SessionBindingDto, SessionBindingTeamMember } from './dto/session-binding.js'
import { teamContractError } from './errors.js'

/**
 * Assert that no TeamSession is already recorded for this root session
 * (invariant 8: one Root Session -> 0 or 1 TeamSession).
 * @param rootSessionId - the root session id about to be bound.
 * @param existing - the already-recorded TeamSession records.
 * @throws `DUPLICATE_TEAM_SESSION` when a record already binds this root.
 */
export function assertTeamSessionUnique(
  rootSessionId: RootSessionId,
  existing: readonly TeamSessionRecordDto[],
): void {
  const clash = existing.find((record) => record.rootSessionId === rootSessionId)
  if (clash !== undefined) {
    throw teamContractError(
      'DUPLICATE_TEAM_SESSION',
      `root session '${rootSessionId}' already has a TeamSession (invariant: 0 or 1 per root); switch blueprints through a new TeamIntent / new Root Session`,
      { rootSessionId },
    )
  }
}

/**
 * Assert that no member with this instance id exists in this TeamSession.
 *
 * Scoping is by the composite key: records under a different
 * `rootSessionId` are ignored — the same instance id under another team
 * is a different member (invariant 18).
 * @param rootSessionId - the TeamSession (root session id) being checked.
 * @param instanceId - the instance id about to be minted.
 * @param existing - the already-recorded member records (any teams).
 * @throws `DUPLICATE_INSTANCE_ID` when the same team already has this instance id.
 */
export function assertInstanceIdUniqueWithinTeam(
  rootSessionId: RootSessionId,
  instanceId: InstanceId,
  existing: readonly MemberInstanceRecordDto[],
): void {
  const clash = existing.find(
    (record) =>
      record.rootSessionId === rootSessionId && record.instanceId === instanceId,
  )
  if (clash !== undefined) {
    throw teamContractError(
      'DUPLICATE_INSTANCE_ID',
      `TeamSession '${rootSessionId}' already has instance '${instanceId}'; instanceId is unique within one TeamSession`,
      { rootSessionId, instanceId },
    )
  }
}

/**
 * Assert that no member binding already claims this child session
 * (invariant 23: each MemberInstance binds exactly one durable child
 * Session; a child session belongs to at most one member).
 * @param childSessionId - the child session id about to be bound.
 * @param existing - the already-recorded session binding rows.
 * @throws `SESSION_ALREADY_BOUND` when a team-member binding already carries this child session.
 */
export function assertChildSessionBindingUnique(
  childSessionId: ChildSessionId,
  existing: readonly SessionBindingDto[],
): void {
  const memberBindings = existing.filter(
    (binding): binding is SessionBindingTeamMember => binding.kind === 'team-member',
  )
  const clash = memberBindings.find((binding) => binding.sessionId === childSessionId)
  if (clash !== undefined) {
    throw teamContractError(
      'SESSION_ALREADY_BOUND',
      `child session '${childSessionId}' is already bound to member ('${clash.rootSessionId}', '${clash.instanceId}'); a child session is never shared between members`,
      { childSessionId },
    )
  }
}
