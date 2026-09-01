/**
 * P8-S6 A32 — the production server-side principal derivation
 * (plan §20.3; closes CR-4).
 *
 * The {@link ServerPrincipalDerivation} seam implementation: it derives the
 * team calling authority from ONE parsed remote request. The remote contract
 * v1 surface is EXTERNAL (an untrusted browser); the client's `caller` /
 * `actor` fields are CLAIMS, never trusted. The host derives the principal
 * from its own durable identity:
 *
 * - Human authority → the host-known operator principal, identified by the
 *   bound root session (the same identity channel as the live glue's
 *   `governanceAuthority` operator branch). A client-claimed `humanId` other
 *   than the bound root is a spoof and is rejected.
 * - Leader/Member authority → the bound Session + TeamDomain identity: the
 *   claimed instance must resolve to a durable member row of the bound root
 *   (the leader through its durable leader row; a member never through the
 *   leader row).
 *
 * Every rejection is a typed {@link TeamPluginError} (a string `code`), so
 * the remote dispatcher's pass-through invariant (a typed domain error keeps
 * its code + message; the source identity rides under `details.cause`)
 * reports the boundary violation to the caller instead of acting on the
 * spoofed claim.
 *
 * Read-only: the derivation only READS the durable member rows (to resolve
 * instance claims); it never writes.
 * @module @dsh-agent-team/runtime/plugin/s6-principal
 */

import type { ActionCaller } from '../../admission/index.js'
import type { RemoteRequest } from '../../../remote/src/contracts/request.js'
import type { TeamDomainRepositories } from '../../../storage/repositories/index.js'
import { TeamPluginError } from './types.js'

/** The stable server-side principal rejection codes (CR-4 boundary). */
export const S6_PRINCIPAL_ERROR_CODES = {
  /** The request addresses a TeamSession this host is not bound to. */
  FOREIGN_TEAM: 'TEAM_REMOTE_FOREIGN_TEAM',
  /** A client-claimed principal that does not resolve to a durable identity. */
  PRINCIPAL_INVALID: 'TEAM_REMOTE_PRINCIPAL_INVALID',
} as const

export type S6PrincipalErrorCode = (typeof S6_PRINCIPAL_ERROR_CODES)[keyof typeof S6_PRINCIPAL_ERROR_CODES]

/** The construction inputs of the production principal derivation. */
export interface ServerPrincipalDerivationOptions {
  /** The bound root session id (this host's single TeamSession). */
  readonly rootSessionId: string
  /** The durable member rows (to resolve instance claims). */
  readonly repositories: TeamDomainRepositories
  /** The bound leader's instance id (the leader authority). */
  readonly leaderInstanceId: string
}

/** True for a plain (non-array, non-null) object. */
function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

/** The closed admission-method set (the `caller`-claiming remote methods). */
const ADMISSION_METHODS = new Set(['member.create', 'member.send', 'member.followup'])
/** The closed mutation-method set (the `actor`-claiming remote methods). */
const MUTATION_METHODS = new Set(['override.set', 'override.reset', 'policyState.set'])

/**
 * Build the production {@link ServerPrincipalDerivation}.
 * @param options - the bound root + the durable member rows + the leader id.
 * @returns the derivation: `(method, request) => ActionCaller`.
 */
export function createServerPrincipalDerivation(
  options: ServerPrincipalDerivationOptions,
): (input: { readonly method: string; readonly request: RemoteRequest }) => ActionCaller {
  const { rootSessionId, repositories, leaderInstanceId } = options

  function paramsOf(request: RemoteRequest): Record<string, unknown> {
    return request.params as unknown as Record<string, unknown>
  }

  function foreignTeam(method: string, claimed: unknown): never {
    throw new TeamPluginError(
      S6_PRINCIPAL_ERROR_CODES.FOREIGN_TEAM,
      `remote method '${method}' addresses TeamSession '${String(claimed)}' but this host is bound to '${rootSessionId}'`,
      { reason: 'foreign-team', requested: String(claimed), bound: rootSessionId },
    )
  }

  function principalInvalid(message: string, reason: string): never {
    throw new TeamPluginError(S6_PRINCIPAL_ERROR_CODES.PRINCIPAL_INVALID, message, { reason })
  }

  function assertTeamScoped(method: string, params: Record<string, unknown>): void {
    const teamSessionId = params['teamSessionId']
    if (typeof teamSessionId !== 'string' || teamSessionId !== rootSessionId) {
      foreignTeam(method, teamSessionId)
    }
  }

  /** Does a durable member row (leader OR member) exist under this id? */
  function durableInstanceExists(instanceId: string): boolean {
    for (const record of repositories.memberInstances.list(rootSessionId)) {
      if (record.instanceId === instanceId) return true
    }
    return false
  }

  /** Derive the admission caller from the client's `caller` claim. */
  function deriveAdmissionCaller(method: string, params: Record<string, unknown>): ActionCaller {
    assertTeamScoped(method, params)
    const caller = params['caller']
    if (!isPlainRecord(caller)) {
      principalInvalid(`remote method '${method}' carries no usable caller claim`, 'malformed-caller')
    }
    const kind = caller['kind']
    if (kind === 'human') {
      const humanId = caller['humanId']
      if (typeof humanId !== 'string' || humanId !== rootSessionId) {
        principalInvalid(
          `remote method '${method}' claims human principal '${String(humanId)}' but the host-known operator is '${rootSessionId}'`,
          'spoofed-human',
        )
      }
      return { kind: 'human', humanId: rootSessionId }
    }
    if (kind === 'instance') {
      const instanceId = caller['instanceId']
      if (typeof instanceId !== 'string' || !durableInstanceExists(instanceId)) {
        principalInvalid(
          `remote method '${method}' claims instance principal '${String(instanceId)}' that does not resolve to a durable member of '${rootSessionId}'`,
          'unknown-instance',
        )
      }
      return { kind: 'instance', instanceId }
    }
    principalInvalid(
      `remote method '${method}' carries an unrecognizable caller claim (kind '${String(kind)}')`,
      'malformed-caller',
    )
  }

  /** Derive the mutation actor from the client's `actor` claim. */
  function deriveMutationActor(method: string, params: Record<string, unknown>): ActionCaller {
    assertTeamScoped(method, params)
    const actor = params['actor']
    if (!isPlainRecord(actor)) {
      principalInvalid(`remote method '${method}' carries no usable actor claim`, 'malformed-actor')
    }
    const kind = actor['kind']
    if (kind === 'human') {
      // A human mutation actor is the host-known operator (bound root).
      return { kind: 'human', humanId: rootSessionId }
    }
    if (kind === 'leader') {
      if (!durableInstanceExists(leaderInstanceId)) {
        principalInvalid(
          `remote method '${method}' claims a leader authority but no durable leader row exists under '${rootSessionId}'`,
          'unknown-leader',
        )
      }
      return { kind: 'instance', instanceId: leaderInstanceId }
    }
    if (kind === 'member') {
      const member = actor['member']
      if (!isPlainRecord(member)) {
        principalInvalid(`remote method '${method}' carries a malformed member actor claim`, 'malformed-member')
      }
      const memberRoot = member['rootSessionId']
      const memberInstance = member['instanceId']
      if (typeof memberRoot !== 'string' || memberRoot !== rootSessionId) {
        principalInvalid(
          `remote method '${method}' claims a member of TeamSession '${String(memberRoot)}' but this host is bound to '${rootSessionId}'`,
          'wrong-team',
        )
      }
      if (typeof memberInstance !== 'string') {
        principalInvalid(`remote method '${method}' carries a malformed member instance id`, 'malformed-member')
      }
      if (memberInstance === leaderInstanceId) {
        principalInvalid(
          `remote method '${method}' claims the leader instance '${leaderInstanceId}' as an ordinary member`,
          'leader-is-not-a-member',
        )
      }
      if (!durableInstanceExists(memberInstance)) {
        principalInvalid(
          `remote method '${method}' claims member instance '${memberInstance}' that does not resolve to a durable member of '${rootSessionId}'`,
          'unknown-instance',
        )
      }
      return { kind: 'instance', instanceId: memberInstance }
    }
    principalInvalid(
      `remote method '${method}' carries an unrecognizable actor claim (kind '${String(kind)}')`,
      'malformed-actor',
    )
  }

  /** Derive the compatibility-ack operator from the client's `acknowledgedBy`. */
  function deriveAckCaller(params: Record<string, unknown>): ActionCaller {
    assertTeamScoped('compatibility.ack', params)
    const acknowledgedBy = params['acknowledgedBy']
    if (typeof acknowledgedBy !== 'string' || acknowledgedBy !== rootSessionId) {
      principalInvalid(
        `compatibility.ack claims acknowledgedBy '${String(acknowledgedBy)}' but the host-known operator is '${rootSessionId}'`,
        'spoofed-ack-by',
      )
    }
    return { kind: 'human', humanId: rootSessionId }
  }

  return (input: { readonly method: string; readonly request: RemoteRequest }): ActionCaller => {
    const method = input.method
    const params = paramsOf(input.request)
    if (ADMISSION_METHODS.has(method)) return deriveAdmissionCaller(method, params)
    if (MUTATION_METHODS.has(method)) return deriveMutationActor(method, params)
    if (method === 'compatibility.ack') return deriveAckCaller(params)
    // Every other method (queries, team.create, lifecycle, handoff, legacy,
    // catalog, intent) is a host-initiated operation: the host operator.
    return { kind: 'human', humanId: rootSessionId }
  }
}

