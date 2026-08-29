/**
 * Session id contracts: the DSH session id as seen by the Team contract,
 * plus the Team identity rules built on top of it.
 *
 * Frozen Architecture facts (invariant numbers refer to Architecture §42):
 *
 * - **TeamSessionId = RootSessionId** (invariant 9). A TeamSession is
 *   identified by its root DSH session id; no separate TeamSession UUID
 *   exists (Architecture §8.2). The type alias `TeamSessionId =
 *   RootSessionId` encodes this at the type level.
 * - **One Root Session -> 0 or 1 TeamSession** (invariant 8).
 * - **Every MemberInstance binds exactly one durable child DSH Session**
 *   (invariant 23); the child session id uses the same structural rules.
 *
 * The upstream DSH session id is an opaque branded string (upstream public
 * contract; minted as `session-<n>` by the session store). The vNext
 * boundary rules here only reject structurally unusable values:
 * non-empty, <= 255 chars, no control characters, no whitespace.
 *
 * Pure module: no I/O, no live Agent, no runtime environment assumptions.
 * @module @dsh-agent-team/contracts/ids/session-id
 */

import type { Brand } from './brand.js'
import { assertIsString, assertStringRules } from './common.js'
import { teamContractError } from '../errors.js'

/** Maximum structural length of any DSH session id in vNext contracts. */
export const SESSION_ID_MAX_LENGTH = 255

/**
 * A DSH session id (generic context): the opaque upstream session identity.
 * @see {@link https://github.com/deepseek-ai/deepseek-harness SessionId}
 */
export type SessionId = string & Brand<'SessionId'>

/**
 * The id of the root DSH Session that a TeamSession binds.
 *
 * This IS the TeamSessionId (invariant 9): `TeamSessionId` is an alias of
 * this type, and a `TeamSessionRecordDto.rootSessionId` doubles as the
 * TeamSession id.
 */
export type RootSessionId = string & Brand<'RootSessionId'>

/**
 * The TeamSession id.
 *
 * FROZEN (invariant 9): `TeamSessionId = RootSessionId`. No independent
 * TeamSession UUID is minted (Architecture §8.2) because a TeamSession is
 * not detachable, cannot bind a second root, and shares the lifecycle of
 * its Root Session's historical identity.
 */
export type TeamSessionId = RootSessionId

/**
 * The id of the durable child DSH Session bound to one MemberInstance
 * (invariant 23). Same structural rules as the generic session id.
 */
export type ChildSessionId = string & Brand<'ChildSessionId'>

function assertSessionIdValue(
  raw: unknown,
  field: string,
  code: 'INVALID_SESSION_ID' | 'INVALID_ROOT_SESSION_ID' | 'INVALID_CHILD_SESSION_ID',
): string {
  const value = assertIsString(raw, field, code)
  assertStringRules(value, { field, code, maxLength: SESSION_ID_MAX_LENGTH })
  return value
}

/**
 * Parse and validate a generic DSH session id.
 * @param raw - the unknown input.
 * @returns the branded `SessionId`.
 * @throws `INVALID_SESSION_ID` when the value violates the session id rule.
 */
export function parseSessionId(raw: unknown): SessionId {
  return assertSessionIdValue(raw, 'sessionId', 'INVALID_SESSION_ID') as SessionId
}

/**
 * Parse and validate a root session id (i.e. the id of a TeamSession's root,
 * which is its TeamSessionId per invariant 9).
 * @param raw - the unknown input.
 * @returns the branded `RootSessionId`.
 * @throws `INVALID_ROOT_SESSION_ID` when the value violates the session id rule.
 */
export function parseRootSessionId(raw: unknown): RootSessionId {
  return assertSessionIdValue(raw, 'rootSessionId', 'INVALID_ROOT_SESSION_ID') as RootSessionId
}

/**
 * Parse and validate a TeamSession id.
 *
 * Identity function of {@link parseRootSessionId} (invariant 9); kept as a
 * separate entry point so call sites read the Team vocabulary.
 * @param raw - the unknown input.
 * @returns the branded `TeamSessionId` (identical to `RootSessionId`).
 * @throws `INVALID_ROOT_SESSION_ID` when the value violates the session id rule.
 */
export function parseTeamSessionId(raw: unknown): TeamSessionId {
  return parseRootSessionId(raw)
}

/**
 * Parse and validate a member child session id.
 * @param raw - the unknown input.
 * @returns the branded `ChildSessionId`.
 * @throws `INVALID_CHILD_SESSION_ID` when the value violates the session id rule.
 */
export function parseChildSessionId(raw: unknown): ChildSessionId {
  return assertSessionIdValue(raw, 'childSessionId', 'INVALID_CHILD_SESSION_ID') as ChildSessionId
}

/** Type guard for the generic session id rule. */
export function isSessionId(raw: unknown): raw is SessionId {
  try {
    parseSessionId(raw)
    return true
  } catch {
    return false
  }
}

/** Type guard for the root session / TeamSession id rule. */
export function isRootSessionId(raw: unknown): raw is RootSessionId {
  try {
    parseRootSessionId(raw)
    return true
  } catch {
    return false
  }
}

/** Type guard for the member child session id rule. */
export function isChildSessionId(raw: unknown): raw is ChildSessionId {
  try {
    parseChildSessionId(raw)
    return true
  } catch {
    return false
  }
}

/**
 * The TeamSession record id accessor: per invariant 9 the team session id is
 * the root session id, so this returns the same branded value. Provided so
 * producers read the Team vocabulary without re-deriving the invariant.
 * @param rootSessionId - the root session id of a TeamSession.
 * @returns the TeamSession id (identical value).
 */
export function teamSessionIdOf(rootSessionId: RootSessionId): TeamSessionId {
  return rootSessionId
}
