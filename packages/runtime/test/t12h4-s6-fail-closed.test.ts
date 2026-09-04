/**
 * T12-H4 — the S6 PRODUCTION dispatcher's fail-closed error mapping
 * (the mirror site of the pure remote dispatcher's invariant 4b
 * narrowing).
 *
 * The regression: an `Error` with a Node-style `code` ('ENOENT') and a
 * filesystem path in its message, raised inside a handler of the
 * production dispatcher. 'ENOENT' is NOT a member of the closed backing
 * vocabulary (REMOTE_BACKING_ERROR_CODE_SET), so the dispatcher MUST map it
 * to `internal-error` with a generic message — the client-facing wire
 * envelope must contain neither the code nor the path.
 *
 * The positive control proves the legitimate 4b path is preserved at this
 * site: a REAL closed backing code (LIFECYCLE_MEMBER_NOT_FOUND) still
 * passes through with code + message + cause identity.
 *
 * Drives `createS6RemoteDispatcher` directly with a throwing fake port
 * (the same pattern as p8s7r1): the dispatcher under test is the REAL
 * production one (closed param parsing + the frozen invariants); only the
 * backing port is simulated. The principal derivation is a trip-wire that
 * throws if invoked — `team.getProjection` carries no claim.
 *
 * Test pattern of this repo (the plain-node shim's `it` is synchronous):
 * every async scenario runs at MODULE level (top-level await) and captures
 * its results; the `it` bodies are pure synchronous assertions.
 *
 * Matchers: toBe/toEqual/toBeGreaterThan (+.not) only.
 *
 * @module @dsh-agent-team/runtime/test/t12h4-s6-fail-closed
 */

import { describe, expect, it } from 'vitest'

import { createS6RemoteDispatcher } from '../src/plugin/s6-remote.js'
import type { S6RemotePorts } from '../src/plugin/s6-remote.js'
import type { ServerPrincipalDerivation } from '../src/plugin/types.js'
import { REMOTE_CONTRACT_VERSION } from '../../remote/src/index.js'
import type { RemoteResponse } from '../../remote/src/index.js'

/** The bound root session id every team-scoped method addresses. */
const ROOT_SID = 'session-t12h4-s6'

/** Extract the typed error part of a resolved error envelope (asserts the invariant-7 shape). */
function errorOf(response: RemoteResponse): Record<string, unknown> {
  if (response.ok) throw new Error('T12-H4 guard: expected an error result')
  return response.error as unknown as Record<string, unknown>
}

// Module level (top-level await): drive the REAL production dispatcher over
// the throwing fake ports and capture every scenario result.
const T12 = await (async () => {
  // The trip-wire principal: `team.getProjection` must never derive.
  const noPrincipal: ServerPrincipalDerivation = () => {
    throw new Error('T12-H4 guard: principal derivation must not run for team.getProjection')
  }

  // (1) THE LEAK SCENARIO: a Node-style failure (code 'ENOENT' + a path in
  // the message) raised inside the projection handler.
  const enoent = Object.assign(
    new Error('ENOENT: no such file or directory, open /secret/path/projection.json'),
    { code: 'ENOENT' },
  )
  const enoentPorts = {
    projection: {
      project() {
        throw enoent
      },
    },
  } as unknown as S6RemotePorts
  const enoentResponse = await createS6RemoteDispatcher(enoentPorts, noPrincipal)(
    'team.getProjection',
    { version: REMOTE_CONTRACT_VERSION, params: { teamSessionId: ROOT_SID } },
  )

  // (2) POSITIVE CONTROL: a REAL closed backing code with details still
  // passes through (the legitimate 4b path at the production site).
  const typed = Object.assign(
    new Error('the member instance is not a durable row of the bound root'),
    { code: 'LIFECYCLE_MEMBER_NOT_FOUND', details: { instanceId: 'inst-ghost' } },
  )
  const typedPorts = {
    projection: {
      project() {
        throw typed
      },
    },
  } as unknown as S6RemotePorts
  const typedResponse = await createS6RemoteDispatcher(typedPorts, noPrincipal)(
    'team.getProjection',
    { version: REMOTE_CONTRACT_VERSION, params: { teamSessionId: ROOT_SID } },
  )

  return { enoentResponse, typedResponse }
})()

describe('T12-H4: the S6 production dispatcher fails closed on out-of-vocabulary codes', () => {
  it('a plain Error with code ENOENT + a path in the message → internal-error; the wire carries neither the code nor the path', () => {
    // The assertion runs on the ACTUAL wire envelope the production
    // dispatcher produced (invariant 7: it resolved — the envelope IS the
    // client-facing reply the seam would send).
    const error = errorOf(T12.enoentResponse)
    expect(error['code']).toBe('internal-error')
    expect(error['message']).toBe('internal error in remote handler')
    const details = error['details'] as Record<string, unknown>
    expect(details['reason']).toBe('untyped-error')
    // Provenance still attributable.
    expect(details['method']).toBe('team.getProjection')
    expect(details['endpoint']).toBe('team.getProjection')
    expect(details['contractVersion']).toBe(REMOTE_CONTRACT_VERSION)
    // No leak of the Node code, the filesystem path, or the thrown message
    // — anywhere in the client-facing envelope.
    const wire = JSON.stringify(T12.enoentResponse)
    expect(wire.includes('ENOENT')).toBe(false)
    expect(wire.includes('/secret/path')).toBe(false)
    expect(wire.includes('projection.json')).toBe(false)
    expect(wire.includes('no such file or directory')).toBe(false)
  })

  it('a REAL closed backing code (LIFECYCLE_MEMBER_NOT_FOUND) still passes through with cause identity', () => {
    const error = errorOf(T12.typedResponse)
    expect(error['code']).toBe('LIFECYCLE_MEMBER_NOT_FOUND')
    expect(error['message']).toBe(
      'the member instance is not a durable row of the bound root',
    )
    const details = error['details'] as Record<string, unknown>
    expect(details['reason']).toBe('domain-error')
    const cause = details['cause'] as Record<string, unknown>
    expect(cause).toEqual({
      code: 'LIFECYCLE_MEMBER_NOT_FOUND',
      message: 'the member instance is not a durable row of the bound root',
      details: { instanceId: 'inst-ghost' },
    })
  })
})
