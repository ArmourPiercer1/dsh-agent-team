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
 * - Human authority → the host-known operator principal, identified by an
 *   OWNED root session — the bound root OR any TeamSession root this host
 *   durably owns (P9-S8: teams created after boot through `team.create` /
 *   `handoff.create` are addressable with their own root identity channel).
 *   A client-claimed `humanId` of a root the host does not own is a spoof
 *   and is rejected.
 * - Leader/Member authority → the Session + TeamDomain identity: the
 *   claimed instance must resolve to a durable member row of one of the
 *   host's owned roots (the leader through its durable leader row; a member
 *   never through the leader row).
 *
 * Every rejection is a typed {@link TeamPluginError} (a string `code`), so
 * the remote dispatcher's pass-through invariant (a typed domain error keeps
 * its code + message; the source identity rides under `details.cause`)
 * reports the boundary violation to the caller instead of acting on the
 * spoofed claim.
 *
 * Read-only: the derivation only READS the durable member rows (to resolve
 * instance claims); it never writes.
 *
 * T12-B4 — the trusted PrincipalContext: the transport (the DSH web seam)
 * provides NO per-caller identity at the plugin handler boundary; every
 * call that reaches a mounted handler has already passed the connection
 * gate (HMAC-signed per-home cookie + loopback/Host fence + same-origin,
 * enforced 401/403 upstream of dispatch; the host binds 127.0.0.1 only).
 * The authority basis of every derivation is therefore "the single
 * anonymous authenticated OPERATOR of this DSH_HOME," recorded by a
 * {@link ServerPrincipalContext} token — never by the payload's `caller` /
 * `actor` claims, which remain CLAIMS that only select/validate scope
 * against host-owned durable facts (A32, unchanged).
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

// --- the trusted PrincipalContext (T12-B4) -----------------------------------------------

/**
 * The closed transport vocabulary of the server principal context.
 * The ONLY supported transport is the DSH web seam's connection gate
 * (the authenticated-operator gate upstream of dispatch).
 */
export const SERVER_PRINCIPAL_TRANSPORTS = {
  /** The DSH web seam's connection gate: HMAC-signed per-home cookie +
   *  loopback/Host fence + same-origin, enforced 401/403 BEFORE dispatch;
   *  the host binds 127.0.0.1 only. */
  CONNECTION_GATE: 'connection-gate',
} as const

export type ServerPrincipalTransport =
  (typeof SERVER_PRINCIPAL_TRANSPORTS)[keyof typeof SERVER_PRINCIPAL_TRANSPORTS]

/**
 * The trusted PrincipalContext of the server (T12-B4) — the seam contract
 * for every call that reaches a mounted remote handler.
 *
 * Authority model:
 *
 * 1. **The gate is upstream.** No authenticated principal can reach a
 *    mounted handler unauthenticated: the transport enforces 401/403
 *    BEFORE dispatch (the connection gate). The context records that basis
 *    — it is NOT a per-caller identity, and it carries none.
 * 2. **The operator class is the trust ceiling.** The transport provides
 *    NO per-caller identity at the plugin handler boundary: one anonymous
 *    authenticated OPERATOR per DSH_HOME. No finer-grained caller class
 *    exists, so no payload claim can be granted more than the operator
 *    ceiling.
 * 3. **Per-request scope comes from host-owned durable facts only.** The
 *    payload's `caller` / `actor` fields are CLAIMS: they select/validate
 *    scope against the bound root session and the durable member rows
 *    (A32). An inconsistent claim is a typed rejection under the EXISTING
 *    `TEAM_REMOTE_PRINCIPAL_INVALID` / `TEAM_REMOTE_FOREIGN_TEAM` codes —
 *    claims NEVER grant authority, and no new wire code is introduced.
 *
 * The token carries NO identity data (no per-caller ids, no accounts, no
 * cookie parsing): it is a basis record and a structural trust marker,
 * verified by {@link isServerPrincipalContext} on the derivation path.
 */
export interface ServerPrincipalContext {
  /** The transport that mounted the handler (the closed vocabulary). */
  readonly transport: ServerPrincipalTransport
  /** The trust ceiling: the single authenticated operator class. */
  readonly operatorClass: 'operator'
}

/**
 * Structural trust guard for a {@link ServerPrincipalContext} token.
 * A token is trusted only when it structurally carries the
 * connection-gate basis AND the operator ceiling — a forged or partial
 * object (a missing field, a different transport) is NOT trusted, and
 * every consumer that consults the context fails closed on it.
 */
export function isServerPrincipalContext(value: unknown): value is ServerPrincipalContext {
  if (!isPlainRecord(value)) return false
  return (
    value['transport'] === SERVER_PRINCIPAL_TRANSPORTS.CONNECTION_GATE &&
    value['operatorClass'] === 'operator'
  )
}

/**
 * Create the trusted PrincipalContext for the transport that mounted the
 * remote handler (T12-B4).
 *
 * Only the connection gate is a supported transport: it is the sole
 * authority basis under which a derivation may run (see the
 * {@link ServerPrincipalContext} authority model). Any other transport
 * value is rejected at creation with the existing typed code — there is
 * no wire-visible consequence, the context never crosses the wire.
 *
 * @param options - the closed transport vocabulary entry.
 * @returns the frozen, identity-free basis token.
 */
export function createServerPrincipalContext(options: {
  readonly transport: ServerPrincipalTransport
}): ServerPrincipalContext {
  if (options.transport !== SERVER_PRINCIPAL_TRANSPORTS.CONNECTION_GATE) {
    throw new TeamPluginError(
      S6_PRINCIPAL_ERROR_CODES.PRINCIPAL_INVALID,
      `unknown principal-context transport '${String(options.transport)}' — the only supported transport is the connection gate`,
      { reason: 'principal-context-unknown-transport' },
    )
  }
  return Object.freeze({
    transport: SERVER_PRINCIPAL_TRANSPORTS.CONNECTION_GATE,
    operatorClass: 'operator' as const,
  })
}

/** The construction inputs of the production principal derivation. */
export interface ServerPrincipalDerivationOptions {
  /** The bound root session id (this host's boot root TeamSession). */
  readonly rootSessionId: string
  /**
   * P9-S8 — the durable-ownership predicate over TeamSession roots (the
   * roots this host durably owns). The claim checks accept a principal id
   * of the bound root OR of any owned root, so teams created after boot
   * through `team.create` / `handoff.create` are addressable with their
   * own human identity (invariant 9: the team's root session id). Absent:
   * the T12 single-root semantics (bound root only). A claimed id neither
   * bound nor owned is still a spoof (fail-closed).
   */
  readonly isOwnedRoot?: (teamSessionId: string) => boolean
  /** The durable member rows (to resolve instance claims). */
  readonly repositories: TeamDomainRepositories
  /** The bound leader's instance id (the leader authority). */
  readonly leaderInstanceId: string
  /** T12-B4 — the trusted PrincipalContext of the transport that mounted
   *  this derivation (the connection-gate authority basis). OPTIONAL so
   *  the pre-B4 installation keeps its exact A32 behavior; when present
   *  it is consulted on EVERY derivation (construction fail-fast + per
   *  call, before any payload claim is read). A broken token is a typed
   *  rejection under the existing `TEAM_REMOTE_PRINCIPAL_INVALID` code —
   *  no new wire code. */
  readonly principalContext?: ServerPrincipalContext
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
 *
 * T12-B4: when installed with a {@link ServerPrincipalContext} (the
 * production remote surfaces do), the context is consulted on the
 * derivation path itself — at construction (fail-fast: a broken token is
 * impossible to install) and on EVERY call (the live token is re-verified
 * BEFORE any payload claim is read). The context is the transport's
 * authority basis; the payload claims only select/validate scope (A32).
 *
 * @param options - the bound root + the durable member rows + the leader
 *   id + (optionally) the trusted principal context.
 * @returns the derivation: `(method, request) => ActionCaller`.
 */
export function createServerPrincipalDerivation(
  options: ServerPrincipalDerivationOptions,
): (input: { readonly method: string; readonly request: RemoteRequest }) => ActionCaller {
  const { rootSessionId, repositories, leaderInstanceId, principalContext, isOwnedRoot } = options

  /** The bound-root acceptance: the bound root OR a durably owned root
   *  (P9-S8 — a team created after boot by this host). Without the
   *  predicate (single-root fixtures) this is the T12 bound-root-only
   *  check. */
  function ownsRoot(teamSessionId: string): boolean {
    return teamSessionId === rootSessionId || (isOwnedRoot?.(teamSessionId) ?? false)
  }

  // T12-B4 — fail-fast: a derivation installed with a BROKEN context is
  // impossible to build (the token must structurally carry the
  // connection-gate authority basis). An absent context is the pre-B4
  // installation path: behavior unchanged.
  if (principalContext !== undefined && !isServerPrincipalContext(principalContext)) {
    throw new TeamPluginError(
      S6_PRINCIPAL_ERROR_CODES.PRINCIPAL_INVALID,
      'the principal derivation was installed with a context that does not carry the connection-gate authority basis',
      { reason: 'principal-context-broken' },
    )
  }

  function paramsOf(request: RemoteRequest): Record<string, unknown> {
    return request.params as unknown as Record<string, unknown>
  }

  function foreignTeam(method: string, claimed: unknown): never {
    throw new TeamPluginError(
      S6_PRINCIPAL_ERROR_CODES.FOREIGN_TEAM,
      `remote method '${method}' addresses TeamSession '${String(claimed)}' which this host does not own (bound root '${rootSessionId}')`,
      { reason: 'foreign-team', requested: String(claimed), bound: rootSessionId },
    )
  }

  function principalInvalid(message: string, reason: string): never {
    throw new TeamPluginError(S6_PRINCIPAL_ERROR_CODES.PRINCIPAL_INVALID, message, { reason })
  }

  function assertTeamScoped(method: string, params: Record<string, unknown>): void {
    const teamSessionId = params['teamSessionId']
    if (typeof teamSessionId !== 'string' || !ownsRoot(teamSessionId)) {
      foreignTeam(method, teamSessionId)
    }
  }

  /** Does a durable member row (leader OR member) exist under ANY owned
   *  root (P9-S8 — instance claims on a team created after boot resolve
   *  against that team's own durable rows)? */
  function durableInstanceExists(instanceId: string): boolean {
    const roots = new Set<string>([rootSessionId])
    for (const record of repositories.teamSessions.list()) {
      roots.add(record.rootSessionId)
    }
    for (const root of roots) {
      for (const record of repositories.memberInstances.list(root)) {
        if (record.instanceId === instanceId) return true
      }
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
      if (typeof humanId !== 'string' || !ownsRoot(humanId)) {
        principalInvalid(
          `remote method '${method}' claims human principal '${String(humanId)}' which is not an owned root (bound root '${rootSessionId}')`,
          'spoofed-human',
        )
      }
      return { kind: 'human', humanId }
    }
    if (kind === 'instance') {
      const instanceId = caller['instanceId']
      if (typeof instanceId !== 'string' || !durableInstanceExists(instanceId)) {
        principalInvalid(
          `remote method '${method}' claims instance principal '${String(instanceId)}' that does not resolve to a durable member of this host's owned roots (bound root '${rootSessionId}')`,
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
      // A human mutation actor is the host-known operator: the human id of
      // the addressed (assertTeamScoped-validated, owned) root (P9-S8 —
      // invariant 9 identity channel; single-root worlds: the bound root).
      return { kind: 'human', humanId: String(params['teamSessionId']) }
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
      if (typeof memberRoot !== 'string' || !ownsRoot(memberRoot)) {
        principalInvalid(
          `remote method '${method}' claims a member of TeamSession '${String(memberRoot)}' which this host does not own (bound root '${rootSessionId}')`,
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
    if (typeof acknowledgedBy !== 'string' || !ownsRoot(acknowledgedBy)) {
      principalInvalid(
        `compatibility.ack claims acknowledgedBy '${String(acknowledgedBy)}' which is not an owned root (bound root '${rootSessionId}')`,
        'spoofed-ack-by',
      )
    }
    return { kind: 'human', humanId: acknowledgedBy }
  }

  return (input: { readonly method: string; readonly request: RemoteRequest }): ActionCaller => {
    // T12-B4 — the context is consulted on the derivation path itself, on
    // every call, BEFORE any payload claim is read: the transport's
    // authority basis is re-verified against the live token. The payload
    // NEVER supplies or repairs the basis — a broken context is a typed
    // rejection under the existing code (fail-closed).
    if (principalContext !== undefined && !isServerPrincipalContext(principalContext)) {
      principalInvalid(
        'the transport principal context no longer carries the connection-gate authority basis',
        'principal-context-broken',
      )
    }
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

