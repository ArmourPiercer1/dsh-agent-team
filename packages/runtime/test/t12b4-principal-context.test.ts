/**
 * T12-B4 — the trusted server PrincipalContext (the seam contract of the
 * A32 derivation).
 *
 * The authority model under test (see the `ServerPrincipalContext` JSDoc):
 * the transport provides NO per-caller identity at the plugin handler
 * boundary; every call reaching a mounted handler has already passed the
 * connection gate (401/403 upstream of dispatch). The context records that
 * basis — the operator class is the trust ceiling, and per-request scope is
 * derived from host-owned durable facts only (payload claims NEVER grant
 * authority; A32 unchanged, no new wire code).
 *
 * Scenarios (module top level — the sync shim forbids async it()):
 *  1. the connection-gate context token (created + structurally trusted);
 *  2. forged / partial tokens are NOT trusted (the structural guard);
 *  3. an unknown transport is rejected at creation (existing typed code);
 *  4. a derivation installed WITH the context consults it and stays
 *     transparent for non-claim methods (the host operator);
 *  5. a derivation installed with a BROKEN context is impossible to build
 *     (fail-fast, the existing TEAM_REMOTE_PRINCIPAL_INVALID code);
 *  6. a spoofed elevated-scope claim is STILL rejected with the context
 *     present (A32 preserved);
 *  7. the MOUNTED ENTRY (the production dispatcher) typed-rejects every
 *     request when its context is broken (the existing wire code; no
 *     derivation runs);
 *  8. the default connection-gate context is transparent (a real closed
 *     backing code still passes through — the gate is not a new wall).
 *
 * Matchers: toBe/toEqual/toBeGreaterThan (+.not) only.
 *
 * @module @dsh-agent-team/runtime/test/t12b4-principal-context
 */

import { describe, expect, it } from 'vitest'

import {
  S6_PRINCIPAL_ERROR_CODES,
  SERVER_PRINCIPAL_TRANSPORTS,
  createServerPrincipalContext,
  createServerPrincipalDerivation,
  isServerPrincipalContext,
} from '../src/plugin/s6-principal.js'
import type { ServerPrincipalContext } from '../src/plugin/s6-principal.js'
import { createS6RemoteDispatcher } from '../src/plugin/s6-remote.js'
import type { S6RemotePorts } from '../src/plugin/s6-remote.js'
import { TeamPluginError } from '../src/plugin/types.js'
import type { ServerPrincipalDerivation } from '../src/plugin/types.js'
import { REMOTE_CONTRACT_VERSION } from '../../remote/src/index.js'
import type { RemoteResponse } from '../../remote/src/index.js'
import type { RemoteRequest } from '../../remote/src/contracts/request.js'
import type { TeamDomainRepositories } from '../../storage/repositories/index.js'

/** The bound root session id of the scenarios. */
const ROOT_SID = 'session-t12b4'

/** The code of a caught TeamPluginError (null-ish when not one). */
function caughtCode(error: unknown): string | null {
  return error instanceof TeamPluginError ? error.code : null
}

// Module level (top-level await): drive the context + derivation + mounted
// dispatcher scenarios and capture every result.
const B4 = await (async () => {
  // (1) The token: created + structurally trusted + frozen.
  const token = createServerPrincipalContext({
    transport: SERVER_PRINCIPAL_TRANSPORTS.CONNECTION_GATE,
  })
  const tokenChecks = {
    trusted: isServerPrincipalContext(token),
    frozen: Object.isFrozen(token),
    transport: token.transport,
    operatorClass: token.operatorClass,
  }

  // (2) Forged / partial tokens are NOT trusted.
  const guard = {
    noGate: isServerPrincipalContext({ transport: 'no-gate', operatorClass: 'operator' }),
    missingOperatorClass: isServerPrincipalContext({ transport: 'connection-gate' }),
    null: isServerPrincipalContext(null),
  }

  // (3) An unknown transport is rejected at creation (existing typed code).
  let unknownTransportCode: string | null = null
  try {
    // a runtime probe: the type narrows the transport, the guard must still
    // reject a value that slipped through (e.g. a cast from untrusted data).
    createServerPrincipalContext({
      transport: 'no-gate' as typeof SERVER_PRINCIPAL_TRANSPORTS['CONNECTION_GATE'],
    })
  } catch (error) {
    unknownTransportCode = caughtCode(error)
  }

  // (4)/(5)/(6) The derivation path consults the context.
  const repositories = {
    memberInstances: { list: () => [] },
  } as unknown as TeamDomainRepositories

  const validDerivation = createServerPrincipalDerivation({
    rootSessionId: ROOT_SID,
    repositories,
    leaderInstanceId: 'inst-leader',
    principalContext: token,
  })

  // (4) valid context + a non-claim method → the host operator (the
  // context is consulted, the path is transparent).
  const validHuman = validDerivation({
    method: 'team.getProjection',
    request: {
      version: REMOTE_CONTRACT_VERSION,
      params: { teamSessionId: ROOT_SID },
    } as unknown as RemoteRequest,
  })

  // (5) broken context → construction is impossible (fail-fast).
  let brokenConstructionCode: string | null = null
  try {
    createServerPrincipalDerivation({
      rootSessionId: ROOT_SID,
      repositories,
      leaderInstanceId: 'inst-leader',
      principalContext: {
        transport: 'no-gate',
        operatorClass: 'operator',
      } as unknown as ServerPrincipalContext,
    })
  } catch (error) {
    brokenConstructionCode = caughtCode(error)
  }

  // (6) valid context + a SPOOFED elevated-scope claim → still rejected
  // (A32 preserved WITH the context present; no new code).
  let spoofedCode: string | null = null
  try {
    validDerivation({
      method: 'member.create',
      request: {
        version: REMOTE_CONTRACT_VERSION,
        params: {
          teamSessionId: ROOT_SID,
          caller: { kind: 'instance', instanceId: 'inst-ghost' },
          requestToken: 'tok-b4-1',
        },
      } as unknown as RemoteRequest,
    })
  } catch (error) {
    spoofedCode = caughtCode(error)
  }

  // (7) The MOUNTED ENTRY typed-rejects every request when its context is
  // broken. The fake port throws if the gate does NOT reject first.
  const principal = (
    () => ({ kind: 'human', humanId: ROOT_SID })
  ) as unknown as ServerPrincipalDerivation
  const unreachablePorts = {
    projection: {
      project() {
        throw new Error('unreachable — the connection-gate check must reject first')
      },
    },
  } as unknown as S6RemotePorts
  const brokenMount = createS6RemoteDispatcher(
    unreachablePorts,
    principal,
    {
      transport: 'no-gate',
      operatorClass: 'operator',
    } as unknown as ServerPrincipalContext,
  )
  const brokenMountFirst = await brokenMount('team.getProjection', {
    version: REMOTE_CONTRACT_VERSION,
    params: { teamSessionId: ROOT_SID },
  })
  const brokenMountSecond = await brokenMount('catalog.get', {
    version: REMOTE_CONTRACT_VERSION,
    params: {},
  })

  // (8) Positive control: the default (connection-gate) context is
  // transparent — a real closed backing code still passes through.
  const typed = Object.assign(
    new Error('the member instance is not a durable row of the bound root'),
    { code: 'LIFECYCLE_MEMBER_NOT_FOUND' },
  )
  const typedPorts = {
    projection: {
      project() {
        throw typed
      },
    },
  } as unknown as S6RemotePorts
  const defaultMountResponse = await createS6RemoteDispatcher(typedPorts, principal)(
    'team.getProjection',
    { version: REMOTE_CONTRACT_VERSION, params: { teamSessionId: ROOT_SID } },
  )

  return {
    tokenChecks,
    guard,
    unknownTransportCode,
    validHuman,
    brokenConstructionCode,
    spoofedCode,
    brokenMountFirst,
    brokenMountSecond,
    defaultMountResponse,
  }
})()

describe('T12-B4: the trusted server PrincipalContext', () => {
  it('createServerPrincipalContext mints the frozen connection-gate basis token', () => {
    expect(B4.tokenChecks.trusted).toBe(true)
    expect(B4.tokenChecks.frozen).toBe(true)
    expect(B4.tokenChecks.transport).toBe('connection-gate')
    expect(B4.tokenChecks.operatorClass).toBe('operator')
  })

  it('forged or partial tokens are NOT trusted (the structural guard)', () => {
    expect(B4.guard.noGate).toBe(false)
    expect(B4.guard.missingOperatorClass).toBe(false)
    expect(B4.guard.null).toBe(false)
  })

  it('an unknown transport is rejected at creation under the existing typed code', () => {
    expect(B4.unknownTransportCode).toBe(S6_PRINCIPAL_ERROR_CODES.PRINCIPAL_INVALID)
  })

  it('a derivation installed WITH the context consults it and derives the host operator for non-claim methods', () => {
    expect(B4.validHuman).toEqual({ kind: 'human', humanId: ROOT_SID })
  })

  it('a derivation installed with a broken context is impossible to build (fail-fast, existing code)', () => {
    expect(B4.brokenConstructionCode).toBe(S6_PRINCIPAL_ERROR_CODES.PRINCIPAL_INVALID)
  })

  it('a spoofed elevated-scope claim is STILL rejected with the context present (A32 preserved, no new code)', () => {
    expect(B4.spoofedCode).toBe(S6_PRINCIPAL_ERROR_CODES.PRINCIPAL_INVALID)
  })

  it('the mounted entry typed-rejects EVERY request when its context is broken (the existing wire code; the port never runs)', () => {
    const first = B4.brokenMountFirst
    const second = B4.brokenMountSecond
    for (const response of [first, second] as RemoteResponse[]) {
      expect(response.ok).toBe(false)
      if (response.ok) continue
      expect(response.error.code).toBe(S6_PRINCIPAL_ERROR_CODES.PRINCIPAL_INVALID)
      // The forged transport value never leaks onto the wire.
      const wire = JSON.stringify(response)
      expect(wire.includes('no-gate')).toBe(false)
      expect(wire.includes('unreachable')).toBe(false)
    }
  })

  it('the default connection-gate context is transparent (a real closed backing code still passes through)', () => {
    const response = B4.defaultMountResponse
    expect(response.ok).toBe(false)
    if (!response.ok) {
      expect(response.error.code).toBe('LIFECYCLE_MEMBER_NOT_FOUND')
    }
  })
})
