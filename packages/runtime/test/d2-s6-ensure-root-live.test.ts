/**
 * d2-s6-ensure-root-live.test.ts — D2 (Team D1-D6 repair v2): the S6
 * PRODUCTION handler of the remote contract v3-only `team.ensureRootLive`
 * (the explicit open-in-Team-mode guarantee — the D1 placeholder is
 * replaced by the live glue's Team-mode ensure, A3 Q2).
 *
 * The dispatcher under test is the REAL production one
 * (`createS6RemotePorts` + `createS6RemoteDispatcher`): the shared
 * version-aware param parser, the frozen seven invariants, and the
 * shared backing-code allow-list. Only the backing options are simulated
 * (the `ensureRootLive` closure + the `isOwnedRoot` predicate + the
 * bound root).
 *
 * Covers (D2 task card, host half):
 *  - SUCCESS — an owned durable root: the glue port is called exactly
 *    once with the addressed rootSessionId and the v3 success data is
 *    the closed shape `{ rootSessionId, mode: "team", live: true }`
 *    (provenance echoes contractVersion 3);
 *  - the P9-S8 guard — the bound root AND a durably owned root
 *    (`isOwnedRoot`) are accepted; a foreign/unknown root fails closed
 *    typed `TEAM_REMOTE_FOREIGN_TEAM` BEFORE the port runs (the port is
 *    never called);
 *  - fail-closed when the host wiring is ABSENT: no `ensureRootLive`
 *    option → typed `TEAM_REMOTE_TEAM_ROOT_LIVE_PORT_UNAVAILABLE`
 *    (the D-3 `startRootAgent` discipline mirrored);
 *  - TYPED error mapping of the port's rejections (the A3 Q2 vocabulary):
 *    (b) the registry collision rejection (`agent "<id>" is already
 *    registered` — the session is already live OUTSIDE the Team glue) →
 *    `TEAM_REMOTE_TEAM_ROOT_LIVE_OUTSIDE_TEAM` (fail closed, never a
 *    silent adoption);
 *    (c) the glue's no-durable-artifact rejection (`neither live nor
 *    durable`) → `TEAM_REMOTE_TEAM_ROOT_LIVE_NO_DURABLE_ARTIFACT`;
 *    (d) every other glue failure → `TEAM_REMOTE_TEAM_ROOT_LIVE_START_FAILED`
 *    (the message preserved for diagnosis);
 *  - the READ-ONLY repositories contract: the handler performs no
 *    repository access (the trip-wire repositories throw on any touch).
 *
 * Test pattern of this repo (the plain-node shim's `it` is synchronous):
 * every async scenario runs at MODULE level (top-level await) and
 * captures its results; the `it` bodies are pure synchronous assertions.
 *
 * Matchers: toBe/toEqual/toBeGreaterThan (+.not) only.
 *
 * @module @dsh-agent-team/runtime/test/d2-s6-ensure-root-live
 */

import { describe, expect, it } from 'vitest'

import {
  createS6RemoteDispatcher,
  createS6RemotePorts,
  S6_REMOTE_ERROR_CODES,
} from '../src/plugin/s6-remote.js'
import type { S6RemoteOptions } from '../src/plugin/s6-remote.js'
import type { ServerPrincipalDerivation } from '../src/plugin/types.js'
import type { TeamDomainRepositories } from '../../storage/repositories/index.js'
import { REMOTE_CONTRACT_VERSION_V3 } from '../../remote/src/index.js'
import type { RemoteResponse } from '../../remote/src/index.js'

const ROOT_SID = 'root-session-d2-s6'
const OWNED_SID = 'root-session-d2-owned'
const FOREIGN_SID = 'root-session-foreign-d2'

/** Extract the typed error part of a resolved error envelope (asserts the invariant-7 shape). */
function errorOf(response: RemoteResponse): Record<string, unknown> {
  if (response.ok) throw new Error('D2-S6 guard: expected an error result')
  return response.error as unknown as Record<string, unknown>
}

/** Extract the success data part of a resolved success envelope. */
function dataOf(response: RemoteResponse): Record<string, unknown> {
  if (!response.ok) throw new Error('D2-S6 guard: expected a success result')
  return response.value.data as Record<string, unknown>
}

/** The trip-wire repositories: ANY access is a test failure. */
function tripWireRepositories(): { repos: TeamDomainRepositories; touched: string[] } {
  const touched: string[] = []
  const trip = (name: string): never => {
    touched.push(name)
    throw new Error(`D2-S6 guard: team.ensureRootLive must not touch repositories.${name}`)
  }
  const repos = {
    teamSessions: { list: () => trip('teamSessions.list'), get: () => trip('teamSessions.get'), put: () => trip('teamSessions.put') },
    memberInstances: { list: () => trip('memberInstances.list'), get: () => trip('memberInstances.get'), put: () => trip('memberInstances.put') },
    sessionBindings: { get: () => trip('sessionBindings.get'), put: () => trip('sessionBindings.put'), listByKind: () => trip('sessionBindings.listByKind') },
    schemaMeta: { listStamps: () => trip('schemaMeta.listStamps'), size: 0 },
    overrides: { list: () => trip('overrides.list') },
    compatibility: { get: () => trip('compatibility.get') },
    operations: { list: () => trip('operations.list') },
    ledger: { list: () => trip('ledger.list'), count: () => trip('ledger.count') },
  } as unknown as TeamDomainRepositories
  return { repos, touched }
}

/** The scripted glue port: records the addressed roots, answers per the given script. */
function makeEnsurePort(
  script: (rootSessionId: string) => Promise<void> | void,
): {
  ensure: (rootSessionId: string) => Promise<void>
  calls: string[]
} {
  const calls: string[] = []
  const ensure = async (rootSessionId: string): Promise<void> => {
    calls.push(rootSessionId)
    await script(rootSessionId)
  }
  return { ensure, calls }
}

/** Build the production ports over a minimal (but trip-wired) options object. */
function makePorts(options: {
  readonly ensure?: (rootSessionId: string) => Promise<void>
  readonly isOwnedRoot?: (teamSessionId: string) => boolean
}): { ports: ReturnType<typeof createS6RemotePorts>; touched: string[] } {
  const { repos, touched } = tripWireRepositories()
  const opts = {
    rootSessionId: ROOT_SID,
    repositories: repos,
    ...(options.ensure === undefined ? {} : { ensureRootLive: options.ensure }),
    ...(options.isOwnedRoot === undefined ? {} : { isOwnedRoot: options.isOwnedRoot }),
  } as unknown as S6RemoteOptions
  const ports = createS6RemotePorts(opts)
  return { ports, touched }
}

// Module level (top-level await): drive the REAL production dispatcher
// over the fake options and capture every scenario result.
const D2 = await (async () => {
  const noPrincipal: ServerPrincipalDerivation = () => {
    throw new Error('D2-S6 guard: principal derivation must not run for this method')
  }
  // (a) SUCCESS — the bound root, the glue port resolves.
  const successPort = makeEnsurePort(() => undefined)
  const success = makePorts({ ensure: successPort.ensure })
  const dispatchSuccess = createS6RemoteDispatcher(success.ports, noPrincipal)
  const successResponse = await dispatchSuccess('team.ensureRootLive', {
    version: REMOTE_CONTRACT_VERSION_V3,
    params: { teamSessionId: ROOT_SID },
  })

  // (b) SUCCESS — a DURABLY OWNED root (P9-S8, not the bound root).
  const ownedPort = makeEnsurePort(() => undefined)
  const owned = makePorts({
    ensure: ownedPort.ensure,
    isOwnedRoot: (sid) => sid === OWNED_SID,
  })
  const dispatchOwned = createS6RemoteDispatcher(owned.ports, noPrincipal)
  const ownedResponse = await dispatchOwned('team.ensureRootLive', {
    version: REMOTE_CONTRACT_VERSION_V3,
    params: { teamSessionId: OWNED_SID },
  })

  // (c) GUARD — a foreign/unknown root fails closed BEFORE the port runs.
  const foreignPort = makeEnsurePort(() => undefined)
  const foreign = makePorts({ ensure: foreignPort.ensure })
  const dispatchForeign = createS6RemoteDispatcher(foreign.ports, noPrincipal)
  const foreignResponse = await dispatchForeign('team.ensureRootLive', {
    version: REMOTE_CONTRACT_VERSION_V3,
    params: { teamSessionId: FOREIGN_SID },
  })

  // (d) FAIL-CLOSED — the host wiring is absent (no ensureRootLive option).
  const absent = makePorts({})
  const dispatchAbsent = createS6RemoteDispatcher(absent.ports, noPrincipal)
  const absentResponse = await dispatchAbsent('team.ensureRootLive', {
    version: REMOTE_CONTRACT_VERSION_V3,
    params: { teamSessionId: ROOT_SID },
  })

  // (e) TYPED — already live OUTSIDE the Team glue: the registry
  // collision rejection (core/agent enter(), the upstream's authoritative
  // collision boundary — a second agent under one session id is
  // structurally impossible, A3 Q1).
  const outsidePort = makeEnsurePort(() => {
    throw new Error(`agent "${ROOT_SID}" is already registered`)
  })
  const outside = makePorts({ ensure: outsidePort.ensure })
  const dispatchOutside = createS6RemoteDispatcher(outside.ports, noPrincipal)
  const outsideResponse = await dispatchOutside('team.ensureRootLive', {
    version: REMOTE_CONTRACT_VERSION_V3,
    params: { teamSessionId: ROOT_SID },
  })

  // (f) TYPED — no durable session artifact: the glue's own
  // "neither live nor durable" rejection (agent-bindings ensureLiveAgent).
  const noDurablePort = makeEnsurePort(() => {
    throw new Error(`p6t6: session '${ROOT_SID}' is neither live nor durable — no agent to execute a tool on`)
  })
  const noDurable = makePorts({ ensure: noDurablePort.ensure })
  const dispatchNoDurable = createS6RemoteDispatcher(noDurable.ports, noPrincipal)
  const noDurableResponse = await dispatchNoDurable('team.ensureRootLive', {
    version: REMOTE_CONTRACT_VERSION_V3,
    params: { teamSessionId: ROOT_SID },
  })

  // (g) TYPED — every other glue failure: the start path blew up.
  const startFailedPort = makeEnsurePort(() => {
    throw new Error('model provider exploded mid-resume')
  })
  const startFailed = makePorts({ ensure: startFailedPort.ensure })
  const dispatchStartFailed = createS6RemoteDispatcher(startFailed.ports, noPrincipal)
  const startFailedResponse = await dispatchStartFailed('team.ensureRootLive', {
    version: REMOTE_CONTRACT_VERSION_V3,
    params: { teamSessionId: ROOT_SID },
  })

  return {
    successResponse,
    successCalls: successPort.calls,
    successTouched: success.touched,
    ownedResponse,
    ownedCalls: ownedPort.calls,
    foreignResponse,
    foreignCalls: foreignPort.calls,
    absentResponse,
    outsideResponse,
    noDurableResponse,
    startFailedResponse,
  }
})()

// ---------------------------------------------------------------------------
// Assertions (synchronous `it` bodies over the captured results)
// ---------------------------------------------------------------------------

describe('D2 (S6 host handler): team.ensureRootLive success', () => {
  it('an owned durable root: the port is called exactly once with the rootSessionId and the closed v3 shape resolves', () => {
    expect(D2.successResponse.ok).toBe(true)
    if (!D2.successResponse.ok) throw new Error('D2-S6 guard: expected success')
    expect(D2.successResponse.value.provenance.contractVersion).toBe(REMOTE_CONTRACT_VERSION_V3)
    expect(D2.successResponse.value.provenance.method).toBe('team.ensureRootLive')
    const data = dataOf(D2.successResponse)
    expect(Object.keys(data)).toEqual(['rootSessionId', 'mode', 'live'])
    expect(data).toEqual({ rootSessionId: ROOT_SID, mode: 'team', live: true })
  })

  it('the glue port is called exactly once with the addressed bound root', () => {
    expect(D2.successCalls).toEqual([ROOT_SID])
  })

  it('the READ-ONLY contract: no repository access of any kind (the trip-wire was never touched)', () => {
    expect(D2.successTouched).toEqual([])
  })

  it('a durably OWNED root (P9-S8, not the bound root) is accepted and ensured', () => {
    expect(D2.ownedResponse.ok).toBe(true)
    if (D2.ownedResponse.ok) {
      expect(dataOf(D2.ownedResponse)).toEqual({ rootSessionId: OWNED_SID, mode: 'team', live: true })
    }
    expect(D2.ownedCalls).toEqual([OWNED_SID])
  })
})

describe('D2 (S6 host handler): the bound-root guard (TEAM-SCOPED, fail-closed)', () => {
  it('a FOREIGN/unknown root fails closed TEAM_REMOTE_FOREIGN_TEAM BEFORE the port runs', () => {
    const error = errorOf(D2.foreignResponse)
    expect(error['code']).toBe('TEAM_REMOTE_FOREIGN_TEAM')
    expect(String(error['message'])).toContain(`'${FOREIGN_SID}'`)
    expect(String(error['message'])).toContain(`bound root '${ROOT_SID}'`)
  })

  it('the glue port was NEVER called for the foreign root', () => {
    expect(D2.foreignCalls).toEqual([])
  })
})

describe('D2 (S6 host handler): the typed failure vocabulary (A3 Q2)', () => {
  it('an ABSENT ensureRootLive option → typed TEAM_REMOTE_TEAM_ROOT_LIVE_PORT_UNAVAILABLE (fail closed, the D-3 discipline mirrored)', () => {
    const error = errorOf(D2.absentResponse)
    expect(error['code']).toBe(S6_REMOTE_ERROR_CODES.TEAM_ROOT_LIVE_PORT_UNAVAILABLE)
    expect(error['code']).toBe('TEAM_REMOTE_TEAM_ROOT_LIVE_PORT_UNAVAILABLE')
    const details = error['details'] as Record<string, unknown>
    // invariant 4b pass-through: the source identity rides under cause
    expect(details['reason']).toBe('domain-error')
    expect((details['cause'] as Record<string, unknown>)['code']).toBe('TEAM_REMOTE_TEAM_ROOT_LIVE_PORT_UNAVAILABLE')
    expect(String(error['message'])).toContain('does not provide the ensureRootLive port')
  })

  it('the registry collision rejection (already live OUTSIDE the Team glue) → TEAM_REMOTE_TEAM_ROOT_LIVE_OUTSIDE_TEAM (never a silent adoption)', () => {
    const error = errorOf(D2.outsideResponse)
    expect(error['code']).toBe(S6_REMOTE_ERROR_CODES.TEAM_ROOT_LIVE_OUTSIDE_TEAM)
    expect(error['code']).toBe('TEAM_REMOTE_TEAM_ROOT_LIVE_OUTSIDE_TEAM')
    const details = error['details'] as Record<string, unknown>
    expect(details['reason']).toBe('domain-error')
    expect((details['cause'] as Record<string, unknown>)['code']).toBe('TEAM_REMOTE_TEAM_ROOT_LIVE_OUTSIDE_TEAM')
    expect(String(error['message'])).toContain(`'${ROOT_SID}'`)
    expect(String(error['message'])).toContain('already live outside the Team glue')
  })

  it('the glue no-durable-artifact rejection → TEAM_REMOTE_TEAM_ROOT_LIVE_NO_DURABLE_ARTIFACT', () => {
    const error = errorOf(D2.noDurableResponse)
    expect(error['code']).toBe(S6_REMOTE_ERROR_CODES.TEAM_ROOT_LIVE_NO_DURABLE_ARTIFACT)
    expect(error['code']).toBe('TEAM_REMOTE_TEAM_ROOT_LIVE_NO_DURABLE_ARTIFACT')
    expect(String(error['message'])).toContain(`'${ROOT_SID}'`)
    expect(String(error['message'])).toContain('no durable session artifact')
  })

  it('every other glue failure → TEAM_REMOTE_TEAM_ROOT_LIVE_START_FAILED (the message preserved for diagnosis)', () => {
    const error = errorOf(D2.startFailedResponse)
    expect(error['code']).toBe(S6_REMOTE_ERROR_CODES.TEAM_ROOT_LIVE_START_FAILED)
    expect(error['code']).toBe('TEAM_REMOTE_TEAM_ROOT_LIVE_START_FAILED')
    expect(String(error['message'])).toContain('model provider exploded mid-resume')
  })
})
