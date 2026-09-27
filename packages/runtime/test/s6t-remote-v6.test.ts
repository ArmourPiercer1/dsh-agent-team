/**
 * s6t-remote-v6.test.ts — team-view-sync-complete: the S6 PRODUCTION
 * dispatcher wiring of the remote contract v6 surface: the v6-only
 * `team.getReadState` query and the v6 freshness PAIR of
 * `team.getProjection` (frozen decisions 1 + 3 + 4).
 *
 * The dispatcher under test is the REAL production one
 * (`createS6RemotePorts` + `createS6RemoteDispatcher`) — the shared
 * version-aware param parser, the frozen invariants, and the shared
 * backing-code allow-list. Only the backing options are simulated (the
 * `readState` closure + the `liveToken` closure + the projection
 * service + the bound root).
 *
 * Covers:
 *  - `team.getReadState` (v6-only) — the closed read-state value is
 *    served through the injected `readState` port VERBATIM (an ordinary
 *    session → confirmed none; a disposed member → team-member with
 *    `disposed: true` + the durable generation), provenance echoes
 *    contractVersion 6; NO bound-root guard (the query is host-wide —
 *    a session of ANY owned team, or ordinary, is servable);
 *  - fail-closed when the host wiring is ABSENT: no `readState`
 *    option → typed `TEAM_REMOTE_TEAM_READ_STATE_PORT_UNAVAILABLE`
 *    (never a silent none);
 *  - the resolver's typed integrity failures (TEAM_ROW_ABSENT) + the
 *    storage typed errors (RECORD_INVALID) propagate through the port
 *    UNMAPPED (invariant 4b: code + message preserved, source identity
 *    under details.cause); an UNtyped throw is re-wrapped as the same
 *    port-unavailable code; the promise never rejects;
 *  - version routing: v1/v5 requests to `team.getReadState` → typed
 *    `method-version-unsupported` (the closed supported set of the
 *    method is {6});
 *  - `team.getProjection` (v6) — the SAME durable projection PLUS the
 *    two additive freshness cells INSIDE data.projection:
 *    `durableGeneration` === the durable generation + the `liveToken`
 *    from the injected port; provenance contractVersion 6 +
 *    projectionGeneration === the generation;
 *  - `team.getProjection` (v5) — the FROZEN byte-identical shape: the
 *    nine v1 fields only, NO v6 cells (the additive contract never
 *    rewrites the old wire);
 *  - the live-token port FAILS CLOSED: absent → typed
 *    `TEAM_REMOTE_TEAM_LIVE_TOKEN_PORT_UNAVAILABLE` (a v6 frame must
 *    always carry its token cell); an untyped port throw → re-wrapped
 *    to the same code.
 *
 * Test pattern of this repo (the plain-node shim's `it` is
 * synchronous): every async scenario runs at MODULE level (top-level
 * await) and captures its results; the `it` bodies are pure
 * synchronous assertions.
 *
 * Matchers: toBe/toEqual/toBeGreaterThan (+.not) only.
 *
 * @module @dsh-agent-team/runtime/test/s6t-remote-v6
 */

import { describe, expect, it } from 'vitest'

import {
  createS6RemoteDispatcher,
  createS6RemotePorts,
  S6_REMOTE_ERROR_CODES,
} from '../src/plugin/s6-remote.js'
import type { S6RemoteOptions } from '../src/plugin/s6-remote.js'
import type { ServerPrincipalDerivation } from '../src/plugin/types.js'
import { TeamPluginError } from '../src/plugin/types.js'
import type { TeamDomainRepositories } from '../../storage/repositories/index.js'
import {
  REMOTE_CONTRACT_ERROR_CODES,
  REMOTE_CONTRACT_VERSION,
  REMOTE_CONTRACT_VERSION_V5,
  REMOTE_CONTRACT_VERSION_V6,
} from '../../remote/src/index.js'
import type { RemoteResponse } from '../../remote/src/index.js'
import type { RemoteTeamGetReadStateValue } from '../../remote/src/contracts/types.js'

const ROOT_SID = 'root-session-s6t-v6'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Extract the typed error part of a resolved error envelope (asserts the invariant-7 shape). */
function errorOf(response: RemoteResponse): Record<string, unknown> {
  if (response.ok) throw new Error('S6T-V6 guard: expected an error result')
  return response.error as unknown as Record<string, unknown>
}

/** Extract the success data part of a resolved success envelope. */
function dataOf(response: RemoteResponse): Record<string, unknown> {
  if (!response.ok) throw new Error('S6T-V6 guard: expected a success result')
  return response.value.data as Record<string, unknown>
}

/** Extract the provenance part of a resolved success envelope. */
function provenanceOf(response: RemoteResponse): Record<string, unknown> {
  if (!response.ok) throw new Error('S6T-V6 guard: expected a success result')
  return response.value.provenance as unknown as Record<string, unknown>
}

/** The trip-wire repositories: ANY access is a test failure. */
function tripWireRepositories(): { repos: TeamDomainRepositories; touched: string[] } {
  const touched: string[] = []
  const trip = (name: string): never => {
    touched.push(name)
    throw new Error(`S6T-V6 guard: the v6 read-state / live-token ports must not touch repositories.${name}`)
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

/** The durable projection row the fake projection service serves (the nine frozen v1 fields). */
const PROJECTION_ROW = {
  schemaVersion: 1,
  teamSessionId: ROOT_SID,
  blueprint: { blueprintId: 'BP-S6T-V6', blueprintRevision: 1 },
  generation: 11,
  generatedAt: '2026-09-27T00:00:00.000Z',
  root: { rootSessionId: ROOT_SID },
  templates: [],
  members: [],
  ledger: { total: 0 },
}

/** The frozen read-state values the fake port serves. */
const READ_STATE_NONE: RemoteTeamGetReadStateValue = {
  relation: 'none',
  teamSessionId: null,
  memberInstanceId: null,
  disposed: false,
  durableGeneration: null,
}
const READ_STATE_DISPOSED_MEMBER: RemoteTeamGetReadStateValue = {
  relation: 'team-member',
  teamSessionId: ROOT_SID,
  memberInstanceId: 'inst-2',
  disposed: true,
  durableGeneration: 11,
}

/** Build the production ports over the trip-wired options object. */
function makePorts(options: {
  readonly readState?: (sessionId: string) => RemoteTeamGetReadStateValue | Promise<RemoteTeamGetReadStateValue>
  readonly liveToken?: (teamSessionId: string) => string | Promise<string>
  readonly projection?: { project: (teamSessionId: string) => unknown }
}): { ports: ReturnType<typeof createS6RemotePorts>; touched: string[] } {
  const { repos, touched } = tripWireRepositories()
  const opts = {
    rootSessionId: ROOT_SID,
    repositories: repos,
    ...(options.projection === undefined
      ? { projection: { project: () => PROJECTION_ROW } }
      : { projection: options.projection }),
    ...(options.readState === undefined ? {} : { readState: options.readState }),
    ...(options.liveToken === undefined ? {} : { liveToken: options.liveToken }),
  } as unknown as S6RemoteOptions
  const ports = createS6RemotePorts(opts)
  return { ports, touched }
}

// Module level (top-level await): drive the REAL production dispatcher
// over the fake options and capture every scenario result.
const S6T = await (async () => {
  const noPrincipal: ServerPrincipalDerivation = () => {
    throw new Error('S6T-V6 guard: principal derivation must not run for these methods')
  }

  // (a) getReadState over the FULL host wiring (the readState port).
  let readStateCalls: string[] = []
  const readStatePort: (sessionId: string) => RemoteTeamGetReadStateValue = (sessionId) => {
    readStateCalls.push(sessionId)
    if (sessionId === 'ordinary-1') return READ_STATE_NONE
    return READ_STATE_DISPOSED_MEMBER
  }
  const { ports, touched } = makePorts({ readState: readStatePort })
  const dispatch = createS6RemoteDispatcher(ports, noPrincipal)

  const readStateNone = await dispatch('team.getReadState', {
    version: REMOTE_CONTRACT_VERSION_V6,
    params: { sessionId: 'ordinary-1' },
  })
  const readStateMember = await dispatch('team.getReadState', {
    version: REMOTE_CONTRACT_VERSION_V6,
    params: { sessionId: 'child-2' },
  })

  // (b) Version routing: v1 / v5 requests to the v6-only method.
  const readStateV1 = await dispatch('team.getReadState', {
    version: REMOTE_CONTRACT_VERSION,
    params: { sessionId: 'ordinary-1' },
  })
  const readStateV5 = await dispatch('team.getReadState', {
    version: REMOTE_CONTRACT_VERSION_V5,
    params: { sessionId: 'ordinary-1' },
  })

  // (c) The ABSENT readState wiring.
  const absentReadState = makePorts({})
  const dispatchAbsentReadState = createS6RemoteDispatcher(absentReadState.ports, noPrincipal)
  const readStatePortAbsent = await dispatchAbsentReadState('team.getReadState', {
    version: REMOTE_CONTRACT_VERSION_V6,
    params: { sessionId: 'ordinary-1' },
  })

  // (d) The resolver's typed integrity failure: rethrown UNMAPPED (4b).
  const integrityFailure = makePorts({
    readState: () => {
      throw new TeamPluginError(
        'TEAM_READ_STATE_TEAM_ROW_ABSENT',
        "team.getReadState: the durable TeamDomain carries no team_sessions row for TeamSession 'root-x' — failing closed",
        { reason: 'team-row-absent', teamSessionId: 'root-x' },
      )
    },
  })
  const dispatchIntegrity = createS6RemoteDispatcher(integrityFailure.ports, noPrincipal)
  const readStateIntegrity = await dispatchIntegrity('team.getReadState', {
    version: REMOTE_CONTRACT_VERSION_V6,
    params: { sessionId: 'root-x' },
  })

  // (e) The storage typed error (RECORD_INVALID): rethrown UNMAPPED (4b).
  const storageFailure = makePorts({
    readState: () => {
      const error = new Error('team_domain/session_bindings: row is not valid JSON')
      ;(error as Error & { code: string }).code = 'RECORD_INVALID'
      throw error
    },
  })
  const dispatchStorage = createS6RemoteDispatcher(storageFailure.ports, noPrincipal)
  const readStateStorage = await dispatchStorage('team.getReadState', {
    version: REMOTE_CONTRACT_VERSION_V6,
    params: { sessionId: 'corrupt-1' },
  })

  // (f) The UNTYPED throw: re-wrapped as the port-unavailable code.
  const untypedFailure = makePorts({
    readState: () => {
      throw new Error('boom: unexpected internal failure')
    },
  })
  const dispatchUntyped = createS6RemoteDispatcher(untypedFailure.ports, noPrincipal)
  const readStateUntyped = await dispatchUntyped('team.getReadState', {
    version: REMOTE_CONTRACT_VERSION_V6,
    params: { sessionId: 'ordinary-1' },
  })

  // (g) getProjection v6: the freshness PAIR inside data.projection.
  let liveTokenCalls: string[] = []
  const { ports: projPorts, touched: projTouched } = makePorts({
    liveToken: (teamSessionId) => {
      liveTokenCalls.push(teamSessionId)
      return `lt-v1-fake-${teamSessionId}-g11`
    },
  })
  const dispatchProj = createS6RemoteDispatcher(projPorts, noPrincipal)
  const projectionV6 = await dispatchProj('team.getProjection', {
    version: REMOTE_CONTRACT_VERSION_V6,
    params: { teamSessionId: ROOT_SID },
  })

  // (h) getProjection v5: the FROZEN shape — no v6 cells.
  const projectionV5 = await dispatchProj('team.getProjection', {
    version: REMOTE_CONTRACT_VERSION_V5,
    params: { teamSessionId: ROOT_SID },
  })

  // (i) The ABSENT live-token wiring: a v6 frame cannot be served.
  const absentLiveToken = makePorts({})
  const dispatchAbsentLiveToken = createS6RemoteDispatcher(absentLiveToken.ports, noPrincipal)
  const projectionV6LiveTokenAbsent = await dispatchAbsentLiveToken('team.getProjection', {
    version: REMOTE_CONTRACT_VERSION_V6,
    params: { teamSessionId: ROOT_SID },
  })

  // (j) The UNTYPED live-token throw: re-wrapped to the same code.
  const liveTokenUntyped = makePorts({
    liveToken: () => {
      throw new Error('boom: overlay unavailable')
    },
  })
  const dispatchLiveTokenUntyped = createS6RemoteDispatcher(liveTokenUntyped.ports, noPrincipal)
  const projectionV6LiveTokenUntyped = await dispatchLiveTokenUntyped('team.getProjection', {
    version: REMOTE_CONTRACT_VERSION_V6,
    params: { teamSessionId: ROOT_SID },
  })

  return {
    readStateCalls,
    touched,
    readStateNone,
    readStateMember,
    readStateV1,
    readStateV5,
    readStatePortAbsent,
    readStateIntegrity,
    readStateStorage,
    readStateUntyped,
    liveTokenCalls,
    projTouched,
    projectionV6,
    projectionV5,
    projectionV6LiveTokenAbsent,
    projectionV6LiveTokenUntyped,
  }
})()

// ---------------------------------------------------------------------------
// team.getReadState (v6-only)
// ---------------------------------------------------------------------------

describe('team-view-sync-complete — S6 production dispatcher: team.getReadState (v6-only, frozen decision 1)', () => {
  it('serves the confirmed-none value verbatim for an ordinary session (port called exactly once with the wire sessionId)', () => {
    const data = dataOf(S6T.readStateNone)
    expect(data['relation']).toBe('none')
    expect(data['teamSessionId']).toBeNull()
    expect(data['memberInstanceId']).toBeNull()
    expect(data['disposed']).toBe(false)
    expect(data['durableGeneration']).toBeNull()
    expect(S6T.readStateCalls).toContain('ordinary-1')
    expect(S6T.touched).toEqual([]) // no repository access — the port is the only backing
  })

  it('serves the disposed-member value verbatim (relation + instance id + disposed: true + the durable generation)', () => {
    const data = dataOf(S6T.readStateMember)
    expect(data['relation']).toBe('team-member')
    expect(data['teamSessionId']).toBe(ROOT_SID)
    expect(data['memberInstanceId']).toBe('inst-2')
    expect(data['disposed']).toBe(true)
    expect(data['durableGeneration']).toBe(11)
    expect(S6T.readStateCalls).toContain('child-2')
  })

  it('echoes contractVersion 6 in the provenance (the v6 wire)', () => {
    expect(provenanceOf(S6T.readStateNone)['contractVersion']).toBe(REMOTE_CONTRACT_VERSION_V6)
    expect(provenanceOf(S6T.readStateNone)['method']).toBe('team.getReadState')
  })

  it('a v1 request → method-version-unsupported (the closed supported set is {6})', () => {
    const error = errorOf(S6T.readStateV1)
    expect(error['code']).toBe(REMOTE_CONTRACT_ERROR_CODES.METHOD_VERSION_UNSUPPORTED)
  })

  it('a v5 request → method-version-unsupported (details echo v5)', () => {
    const error = errorOf(S6T.readStateV5)
    expect(error['code']).toBe(REMOTE_CONTRACT_ERROR_CODES.METHOD_VERSION_UNSUPPORTED)
    const details = error['details'] as Record<string, unknown>
    expect(details['contractVersion']).toBe(REMOTE_CONTRACT_VERSION_V5)
  })

  it('ABSENT host wiring → typed TEAM_REMOTE_TEAM_READ_STATE_PORT_UNAVAILABLE (never a silent none)', () => {
    const error = errorOf(S6T.readStatePortAbsent)
    expect(error['code']).toBe(S6_REMOTE_ERROR_CODES.TEAM_READ_STATE_PORT_UNAVAILABLE)
  })

  it('the resolver integrity failure (TEAM_ROW_ABSENT) passes through UNMAPPED (invariant 4b: code + message preserved)', () => {
    const error = errorOf(S6T.readStateIntegrity)
    expect(error['code']).toBe('TEAM_READ_STATE_TEAM_ROW_ABSENT')
    expect(String(error['message'])).toContain('failing closed')
  })

  it('the storage typed error (RECORD_INVALID) passes through UNMAPPED (the closed backing vocabulary)', () => {
    const error = errorOf(S6T.readStateStorage)
    expect(error['code']).toBe('RECORD_INVALID')
  })

  it('an UNTYPED port throw is re-wrapped as the port-unavailable code (the message preserved for diagnosis)', () => {
    const error = errorOf(S6T.readStateUntyped)
    expect(error['code']).toBe(S6_REMOTE_ERROR_CODES.TEAM_READ_STATE_PORT_UNAVAILABLE)
    expect(String(error['message'])).toContain('boom: unexpected internal failure')
  })
})

// ---------------------------------------------------------------------------
// team.getProjection (the v6 freshness pair + the frozen v5 shape)
// ---------------------------------------------------------------------------

describe('team-view-sync-complete — S6 production dispatcher: team.getProjection v6 pair (frozen decisions 3 + 4)', () => {
  it('the v6 frame carries the PAIR inside data.projection: durableGeneration === generation + the liveToken from the port', () => {
    const data = dataOf(S6T.projectionV6)
    const projection = data['projection'] as Record<string, unknown>
    expect(projection['generation']).toBe(11)
    expect(projection['durableGeneration']).toBe(11)
    expect(projection['liveToken']).toBe(`lt-v1-fake-${ROOT_SID}-g11`)
    // The nine frozen v1 fields are UNCHANGED.
    expect(projection['schemaVersion']).toBe(1)
    expect(projection['teamSessionId']).toBe(ROOT_SID)
    expect(S6T.liveTokenCalls).toEqual([ROOT_SID])
    expect(S6T.projTouched).toEqual([])
  })

  it('the v6 provenance echoes contractVersion 6 + projectionGeneration === the generation', () => {
    const provenance = provenanceOf(S6T.projectionV6)
    expect(provenance['contractVersion']).toBe(REMOTE_CONTRACT_VERSION_V6)
    expect(provenance['projectionGeneration']).toBe(11)
  })

  it('the v5 frame stays FROZEN: the nine v1 fields only, NO v6 cells (the additive contract never rewrites the old wire)', () => {
    const data = dataOf(S6T.projectionV5)
    const projection = data['projection'] as Record<string, unknown>
    expect(projection['generation']).toBe(11)
    expect('durableGeneration' in projection).toBe(false)
    expect('liveToken' in projection).toBe(false)
    expect(provenanceOf(S6T.projectionV5)['contractVersion']).toBe(REMOTE_CONTRACT_VERSION_V5)
  })

  it('ABSENT live-token wiring → typed TEAM_REMOTE_TEAM_LIVE_TOKEN_PORT_UNAVAILABLE (a v6 frame without its token cell is impossible)', () => {
    const error = errorOf(S6T.projectionV6LiveTokenAbsent)
    expect(error['code']).toBe(S6_REMOTE_ERROR_CODES.TEAM_LIVE_TOKEN_PORT_UNAVAILABLE)
  })

  it('an UNTYPED live-token throw is re-wrapped to the same code', () => {
    const error = errorOf(S6T.projectionV6LiveTokenUntyped)
    expect(error['code']).toBe(S6_REMOTE_ERROR_CODES.TEAM_LIVE_TOKEN_PORT_UNAVAILABLE)
  })
})
