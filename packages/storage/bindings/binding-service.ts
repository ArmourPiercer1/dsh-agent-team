/**
 * SessionBindingService — the durable session-binding layer of TeamDomain
 * (TaskDoc §11.5 P4-T3) over the P4-T1 store repositories.
 *
 * The binding row is the durable fact that a DSH session is
 * `ordinary | team-root | team-member` (Architecture §14.3 C, §36.1).
 * This service adds the cross-record creation rules the single-store
 * repository cannot express, while all storage discipline (canonical
 * bytes, uniqueness, typed conflicts) stays in the injected repositories:
 *
 * - **resolve(sessionId)** — the cold-hydration query: every relevant DSH
 *   session must be resolvable to a binding kind (or `unbound`); a session
 *   with no row carries NO Team authority (§14.3 C).
 * - **createTeamRootBinding(R)** — rejected with a typed `RECORD_INVALID`
 *   (problem `root-session-not-a-team`) when no TeamSession record exists
 *   for R: a session cannot claim root status of a team that does not
 *   exist (the "wrong root" rejection at creation time).
 * - **createTeamMemberBinding(R, i, C)** — rejected with typed
 *   `RECORD_INVALID` when (a) no MemberInstanceRecord (R, i) exists
 *   (problem `member-record-missing` — an orphan binding at creation
 *   time), or (b) the record's childSessionId ≠ C (problem
 *   `binding-contradicts-record` — the durable child binding is never
 *   re-pointed, invariant 24; this is what keeps an ordinary fork of a
 *   member child session from becoming a member). A child session that is
 *   already bound raises the repository's typed `RECORD_DUPLICATE`
 *   (contracts `SESSION_ALREADY_BOUND` preserved).
 *
 * An ordinary session fork (or any session that is not a team root or a
 * committed member child) stays `unbound`: Team queries over it return
 * empty, and no team-root/team-member binding is creatable for it
 * (Architecture §35.3).
 *
 * Durable state only: no live Agent, no DSH runtime call, no side effect
 * outside the injected repositories.
 *
 * @module @dsh-agent-team/storage/bindings/binding-service
 */

import {
  parseChildSessionId,
  parseInstanceId,
  parseRootSessionId,
  parseSessionId,
} from '../../contracts/src/index.js'
import type {
  ChildSessionId,
  InstanceId,
  RootSessionId,
  SessionBindingOrdinary,
  SessionBindingTeamMember,
  SessionBindingTeamRoot,
  SessionId,
} from '../../contracts/src/index.js'
import { normalizeValidationError, teamDomainError } from '../schema/index.js'
import type { TeamDomainStore } from '../schema/index.js'
import type { TeamDomainRepositories } from '../repositories/index.js'

/** The store whose key-space every binding write touches. */
const BINDING_STORE: TeamDomainStore = 'session_bindings'

/**
 * The cold-hydration resolution of one DSH session (Architecture §36.1):
 * the Team plugin decides the Team surface from exactly this answer.
 */
export type BindingResolution =
  | /** No TeamDomain binding row: the session carries no Team authority. */
  { readonly status: 'unbound' }
  | /** A plain DSH session explicitly recorded as non-Team. */
  { readonly status: 'ordinary'; readonly binding: SessionBindingOrdinary }
  | /** The session is the root of a TeamSession (its id IS the TeamSessionId). */
  { readonly status: 'team-root'; readonly binding: SessionBindingTeamRoot }
  | /** The session is the durable child of one MemberInstance. */
  { readonly status: 'team-member'; readonly binding: SessionBindingTeamMember }

/**
 * The durable session-binding layer over the TeamDomain repositories.
 */
export class SessionBindingService {
  private readonly repositories: TeamDomainRepositories

  /**
   * @param repositories - the open TeamDomain repositories (injected; the
   *   `session_bindings`, `member_instances`, and `team_sessions` stores
   *   are the only ones touched).
   */
  constructor(repositories: TeamDomainRepositories) {
    this.repositories = repositories
  }

  /** The repository bundle this service operates on. */
  get repos(): TeamDomainRepositories {
    return this.repositories
  }

  /**
   * Resolve one DSH session to its Team binding kind (cold hydration).
   *
   * @param sessionId - the unknown session id input (parsed via the frozen
   *   contracts parser).
   * @returns `unbound` when no binding row exists; otherwise the frozen
   *   binding with its `kind`-narrowed shape.
   * @throws `RECORD_INVALID` (contracts code preserved) for a malformed
   *   session id, or a malformed/non-canonical stored row.
   */
  resolve(sessionId: string): BindingResolution {
    let key: string
    try {
      key = String(parseSessionId(sessionId))
    } catch (error) {
      throw normalizeValidationError(error, BINDING_STORE, sessionId)
    }
    const binding = this.repositories.sessionBindings.get(key)
    if (binding === undefined) return { status: 'unbound' }
    if (binding.kind === 'ordinary') return { status: 'ordinary', binding }
    if (binding.kind === 'team-root') return { status: 'team-root', binding }
    return { status: 'team-member', binding }
  }

  /**
   * Durably bind a root session as the root of an EXISTING TeamSession.
   *
   * @param rootSessionId - the root DSH session id (== TeamSessionId,
   *   invariant 9).
   * @returns the frozen `team-root` binding.
   * @throws `RECORD_INVALID` (problem `root-session-not-a-team`) when no
   *   TeamSession record exists for the root; the repository's typed
   *   `RECORD_DUPLICATE` / `RECORD_INVALID` for occupied or malformed
   *   inputs.
   */
  async createTeamRootBinding(rootSessionId: string): Promise<SessionBindingTeamRoot> {
    let root: string
    try {
      root = String(parseRootSessionId(rootSessionId))
    } catch (error) {
      throw normalizeValidationError(error, BINDING_STORE, rootSessionId)
    }
    if (this.repositories.teamSessions.get(root) === undefined) {
      throw teamDomainError(
        'RECORD_INVALID',
        `root session '${root}' has no TeamSession record; it cannot be bound as team-root`,
        { store: BINDING_STORE, key: root, problem: 'root-session-not-a-team' },
      )
    }
    const binding = await this.repositories.sessionBindings.put({
      kind: 'team-root',
      schemaVersion: 1,
      sessionId: root as RootSessionId,
    })
    if (binding.kind !== 'team-root') {
      throw teamDomainError(
        'RECORD_INVALID',
        `team-root binding creation returned kind '${binding.kind}'`,
        { store: BINDING_STORE, key: root, problem: 'unexpected-binding-kind' },
      )
    }
    return binding
  }

  /**
   * Durably bind a child session to an EXISTING MemberInstance of an
   * EXISTING team.
   *
   * The binding is the durable realization of invariant 23 (every
   * MemberInstance binds exactly one durable child Session) and is never
   * re-pointed (invariant 24): the child session must be the one the
   * record already carries.
   *
   * @param rootSessionId - the team root the member belongs to.
   * @param instanceId - the member's instance id (composite identity,
   *   invariant 18).
   * @param childSessionId - the durable child DSH session to bind.
   * @returns the frozen `team-member` binding.
   * @throws `RECORD_INVALID` (problem `member-record-missing`) when no
   *   MemberInstanceRecord exists for (rootSessionId, instanceId);
   *   `RECORD_INVALID` (problem `binding-contradicts-record`) when the
   *   record's childSessionId differs (a fork of the member child, or any
   *   other session, cannot take the binding); the repository's typed
   *   `RECORD_DUPLICATE` when the child session is already bound.
   */
  async createTeamMemberBinding(
    rootSessionId: string,
    instanceId: string,
    childSessionId: string,
  ): Promise<SessionBindingTeamMember> {
    let root: string
    let instance: string
    let child: string
    try {
      root = String(parseRootSessionId(rootSessionId))
      instance = String(parseInstanceId(instanceId))
      child = String(parseChildSessionId(childSessionId))
    } catch (error) {
      throw normalizeValidationError(error, BINDING_STORE, childSessionId)
    }
    const record = this.repositories.memberInstances.get(root, instance)
    if (record === undefined) {
      throw teamDomainError(
        'RECORD_INVALID',
        `no MemberInstanceRecord exists for ('${root}', '${instance}'); a team-member binding would be orphan`,
        { store: BINDING_STORE, key: child, problem: 'member-record-missing', rootSessionId: root, instanceId: instance },
      )
    }
    if (String(record.childSessionId) !== child) {
      throw teamDomainError(
        'RECORD_INVALID',
        `MemberInstanceRecord ('${root}', '${instance}') is bound to child session '${String(record.childSessionId)}'; the durable child binding is never re-pointed`,
        {
          store: BINDING_STORE,
          key: child,
          problem: 'binding-contradicts-record',
          rootSessionId: root,
          instanceId: instance,
          expectedChildSessionId: String(record.childSessionId),
          givenChildSessionId: child,
        },
      )
    }
    const binding = await this.repositories.sessionBindings.put({
      instanceId: instance as InstanceId,
      kind: 'team-member',
      rootSessionId: root as RootSessionId,
      schemaVersion: 1,
      sessionId: child as ChildSessionId,
    })
    if (binding.kind !== 'team-member') {
      throw teamDomainError(
        'RECORD_INVALID',
        `team-member binding creation returned kind '${binding.kind}'`,
        { store: BINDING_STORE, key: child, problem: 'unexpected-binding-kind' },
      )
    }
    return binding
  }

  /**
   * Durably record a plain DSH session as `ordinary` (no Team authority).
   *
   * Optional: an unbound session already resolves as non-Team; the row
   * exists so the tri-state of §14.3 C is explicit in the store.
   *
   * @param sessionId - the DSH session id.
   * @returns the frozen `ordinary` binding.
   */
  async createOrdinaryBinding(sessionId: string): Promise<SessionBindingOrdinary> {
    let key: string
    try {
      key = String(parseSessionId(sessionId))
    } catch (error) {
      throw normalizeValidationError(error, BINDING_STORE, sessionId)
    }
    const binding = await this.repositories.sessionBindings.put({
      kind: 'ordinary',
      schemaVersion: 1,
      sessionId: key as SessionId,
    })
    if (binding.kind !== 'ordinary') {
      throw teamDomainError(
        'RECORD_INVALID',
        `ordinary binding creation returned kind '${binding.kind}'`,
        { store: BINDING_STORE, key, problem: 'unexpected-binding-kind' },
      )
    }
    return binding
  }

  /**
   * Durably remove one session binding (e.g. when a member is disposed and
   * its child session record is removed by the lifecycle owner).
   *
   * @param sessionId - the DSH session id.
   * @returns `true` when a binding existed, `false` otherwise.
   */
  async removeBinding(sessionId: string): Promise<boolean> {
    return this.repositories.sessionBindings.delete(sessionId)
  }
}
