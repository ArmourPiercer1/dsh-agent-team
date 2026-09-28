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
 *    computed FROM THE SAME PROJECTION'S already-materialized member
 *    rows (PR #35 second follow-up P0-2 — the same-snapshot guarantee:
 *    the frame and the token can never come from two different live
 *    snapshots; the lightweight `liveToken` port is NOT consulted on
 *    the v6 projection path — a counting overlay proves exactly ONE
 *    snapshot read per v6 getProjection);
 *  - `team.getProjection` (v5) — the FROZEN byte-identical shape: the
 *    nine v1 fields only, NO v6 cells (the additive contract never
 *    rewrites the old wire);
 *  - the live-token port (the LIGHTWEIGHT read-state probe path only,
 *    P0-2) FAILS CLOSED: absent on a team relation → typed
 *    `TEAM_REMOTE_TEAM_LIVE_TOKEN_PORT_UNAVAILABLE` (never a team
 *    relation with a null token); an untyped port throw → re-wrapped
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
import type { SessionReadStateDurableValue } from '../src/plugin/team-read-state.js'
import {
  computeLiveTokenFromProjectedMembers,
  computeTeamLiveToken,
  type ProjectedLiveMember,
} from '../src/plugin/live-token.js'

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

/**
 * The fake STABLE live state of the world (the leader is resident, the
 * worker is cold) expressed as the projection's already-materialized
 * `members[].liveActivity` cells — the same-snapshot token input (PR #35
 * second follow-up P0-2). The deterministic token is derived from these
 * cells by BOTH independent pure paths and must agree:
 *
 * - `computeLiveTokenFromProjectedMembers` (the v6 projection path —
 *   the token comes FROM the projection's own member rows);
 * - `computeTeamLiveToken` over the durable member rows + the
 *   equivalent overlay snapshot (the lightweight read-state probe
 *   path — the production `liveToken` closure).
 */
const FAKE_PROJECTION_MEMBERS: readonly ProjectedLiveMember[] = [
  { instanceId: 'inst-leader', liveActivity: { residency: 'resident' } },
  { instanceId: 'inst-a', liveActivity: { residency: 'cold' } },
]
const STABLE_PROJECTION_TOKEN = computeLiveTokenFromProjectedMembers(FAKE_PROJECTION_MEMBERS)
const STABLE_SNAPSHOT_TOKEN = computeTeamLiveToken(
  [{ instanceId: 'inst-leader' }, { instanceId: 'inst-a' }],
  {
    get: (id) =>
      id === 'inst-leader'
        ? { residency: 'resident' }
        : id === 'inst-a'
          ? { residency: 'cold' }
          : undefined,
  },
)

/** The durable projection row the fake projection service serves (the nine frozen v1 fields;
 *  the member rows carry the FAKE STABLE live state's already-materialized cells). */
const PROJECTION_ROW = {
  schemaVersion: 1,
  teamSessionId: ROOT_SID,
  blueprint: { blueprintId: 'BP-S6T-V6', blueprintRevision: 1 },
  generation: 11,
  generatedAt: '2026-09-27T00:00:00.000Z',
  root: { rootSessionId: ROOT_SID },
  templates: [],
  members: FAKE_PROJECTION_MEMBERS.map((member) => ({
    instanceId: member.instanceId,
    liveActivity: member.liveActivity === null ? null : { ...member.liveActivity },
  })),
  ledger: { total: 0 },
}

/** The frozen DURABLE read-state values the fake port serves (PR #35
 *  follow-up: the port answers WITHOUT the liveToken cell — the
 *  dispatcher merges it from the SAME live-token closure the v6
 *  projection uses). */
const READ_STATE_NONE: SessionReadStateDurableValue = {
  relation: 'none',
  teamSessionId: null,
  memberInstanceId: null,
  disposed: false,
  durableGeneration: null,
}
const READ_STATE_DISPOSED_MEMBER: SessionReadStateDurableValue = {
  relation: 'team-member',
  teamSessionId: ROOT_SID,
  memberInstanceId: 'inst-2',
  disposed: true,
  durableGeneration: 11,
}
const READ_STATE_ROOT: SessionReadStateDurableValue = {
  relation: 'team-root',
  teamSessionId: ROOT_SID,
  memberInstanceId: null,
  disposed: false,
  durableGeneration: 11,
}

/** The deterministic fake live token served by the LIGHTWEIGHT
 *  read-state probe path (the production `liveToken` closure shape — a
 *  non-empty `lt-v1-*` string): the SAME stable live state's token as
 *  the projection's members (stable-state consistency — §3.3). */
const fakeLiveToken = (_teamSessionId: string): string => STABLE_SNAPSHOT_TOKEN

/** Build the production ports over the trip-wired options object. */
function makePorts(options: {
  readonly readState?: (sessionId: string) => SessionReadStateDurableValue | Promise<SessionReadStateDurableValue>
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
  const readStatePort: (sessionId: string) => SessionReadStateDurableValue = (sessionId) => {
    readStateCalls.push(sessionId)
    if (sessionId === 'ordinary-1') return READ_STATE_NONE
    if (sessionId === ROOT_SID) return READ_STATE_ROOT
    return READ_STATE_DISPOSED_MEMBER
  }
  let readStateTokenCalls: string[] = []
  const { ports, touched } = makePorts({
    readState: readStatePort,
    liveToken: (teamSessionId) => {
      readStateTokenCalls.push(teamSessionId)
      return fakeLiveToken(teamSessionId)
    },
  })
  const dispatch = createS6RemoteDispatcher(ports, noPrincipal)

  const readStateNone = await dispatch('team.getReadState', {
    version: REMOTE_CONTRACT_VERSION_V6,
    params: { sessionId: 'ordinary-1' },
  })
  // Snapshot IMMEDIATELY after the none answer: the live-token closure
  // must not have been called yet (a `none` answer never computes a
  // token) — the later team answers add their calls afterwards.
  const tokenCallsAfterNone = [...readStateTokenCalls]
  const readStateMember = await dispatch('team.getReadState', {
    version: REMOTE_CONTRACT_VERSION_V6,
    params: { sessionId: 'child-2' },
  })
  const readStateRoot = await dispatch('team.getReadState', {
    version: REMOTE_CONTRACT_VERSION_V6,
    params: { sessionId: ROOT_SID },
  })

  // (a2) CONSISTENCY (PR #35 follow-up): at the same moment, the SAME
  // host wiring answers getReadState and getProjection with the same
  // durableGeneration + liveToken pair (the read-state is the lightweight
  // probe of the same authority the projection serves).
  const projectionConsistency = await dispatch('team.getProjection', {
    version: REMOTE_CONTRACT_VERSION_V6,
    params: { teamSessionId: ROOT_SID },
  })

  // (i2) A team relation whose live-token wiring is ABSENT: fail closed
  // typed (NEVER a team relation with a null token).
  const absentReadStateToken = makePorts({ readState: readStatePort })
  const dispatchAbsentReadStateToken = createS6RemoteDispatcher(
    absentReadStateToken.ports,
    noPrincipal,
  )
  const readStateTokenAbsent = await dispatchAbsentReadStateToken('team.getReadState', {
    version: REMOTE_CONTRACT_VERSION_V6,
    params: { sessionId: 'child-2' },
  })

  // (j2) The UNTYPED live-token throw on a team relation: re-wrapped to
  // the same port-unavailable code (fail closed).
  const readStateTokenUntyped = makePorts({
    readState: readStatePort,
    liveToken: () => {
      throw new Error('boom: overlay unavailable')
    },
  })
  const dispatchReadStateTokenUntyped = createS6RemoteDispatcher(
    readStateTokenUntyped.ports,
    noPrincipal,
  )
  const readStateTokenUntypedResponse = await dispatchReadStateTokenUntyped('team.getReadState', {
    version: REMOTE_CONTRACT_VERSION_V6,
    params: { sessionId: ROOT_SID },
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

  // (g) getProjection v6: the freshness PAIR inside data.projection —
  // the token computed FROM THE SAME PROJECTION (P0-2). The live-token
  // port is a TRIP WIRE: the v6 projection path must never consult it
  // (a second live read is the exact bug P0-2 removes).
  let liveTokenCalls: string[] = []
  const { ports: projPorts, touched: projTouched } = makePorts({
    liveToken: (teamSessionId) => {
      liveTokenCalls.push(teamSessionId)
      throw new Error('S6T-V6 guard: the v6 projection path must not call the liveToken port (P0-2 same-snapshot)')
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

  // (i) The v6 projection is served WITHOUT the live-token wiring (the
  // port is the read-state probe's authority only — the projection's
  // token is computed from its own snapshot's members, P0-2).
  const absentLiveToken = makePorts({})
  const dispatchAbsentLiveToken = createS6RemoteDispatcher(absentLiveToken.ports, noPrincipal)
  const projectionV6LiveTokenAbsent = await dispatchAbsentLiveToken('team.getProjection', {
    version: REMOTE_CONTRACT_VERSION_V6,
    params: { teamSessionId: ROOT_SID },
  })

  // (j) §3.2 the SAME-SNAPSHOT decisiveness (a fake overlay whose FIRST
  // snapshot reports the leader RESIDENT and whose SECOND would report
  // COLD): one v6 getProjection reads the snapshot EXACTLY ONCE — the
  // frame's leader is resident and the served token is the
  // first-snapshot's token (a second read for the token would have
  // served the cold state's token instead — the old two-snapshot bug).
  let snapshotCalls = 0
  const residentState: Record<string, { residency: string }> = {
    'inst-leader': { residency: 'resident' },
    'inst-a': { residency: 'cold' },
  }
  const coldState: Record<string, { residency: string }> = {
    'inst-leader': { residency: 'cold' },
    'inst-a': { residency: 'cold' },
  }
  const countingSnapshot = (): Record<string, { residency: string }> => {
    snapshotCalls += 1
    return snapshotCalls === 1 ? residentState : coldState
  }
  const countingProject = (teamSessionId: string): unknown => {
    // The fake projection service: materialize the member live cells
    // from ONE Team-scoped snapshot read (the fold's contract).
    const snap = countingSnapshot()
    return {
      ...PROJECTION_ROW,
      teamSessionId,
      members: (Object.keys(snap) as (keyof typeof snap)[]).map((id) => ({
        instanceId: id,
        liveActivity: { ...snap[id] },
      })),
    }
  }
  const { ports: countingPorts } = makePorts({ projection: { project: countingProject } })
  const dispatchCounting = createS6RemoteDispatcher(countingPorts, noPrincipal)
  const projectionSameSnapshot = await dispatchCounting('team.getProjection', {
    version: REMOTE_CONTRACT_VERSION_V6,
    params: { teamSessionId: ROOT_SID },
  })
  const sameSnapshotCalls = snapshotCalls
  // The independent expected tokens (pure, no shared state):
  const firstSnapshotToken = computeTeamLiveToken(
    [{ instanceId: 'inst-leader' }, { instanceId: 'inst-a' }],
    { get: (id) => residentState[id] },
  )
  const secondSnapshotToken = computeTeamLiveToken(
    [{ instanceId: 'inst-leader' }, { instanceId: 'inst-a' }],
    { get: (id) => coldState[id] },
  )

  return {
    readStateCalls,
    readStateTokenCalls,
    tokenCallsAfterNone,
    touched,
    readStateNone,
    readStateMember,
    readStateRoot,
    projectionConsistency,
    readStateTokenAbsent,
    readStateTokenUntypedResponse,
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
    snapshotCalls: sameSnapshotCalls,
    projectionSameSnapshot,
    firstSnapshotToken,
    secondSnapshotToken,
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
    // PR #35 follow-up: the none answer carries a NULL token (there is no
    // owning TeamSession) and the live-token closure is NEVER called for
    // it (snapshot taken immediately after the none answer, before any
    // team answer could add a call).
    expect(data['liveToken']).toBeNull()
    expect(S6T.tokenCallsAfterNone).toEqual([])
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
    // PR #35 follow-up: the team relation carries the liveToken merged
    // by the dispatcher from the SAME live-token closure the v6
    // projection uses (never null for a team relation).
    expect(data['liveToken']).toBe(fakeLiveToken(ROOT_SID))
    expect(S6T.readStateCalls).toContain('child-2')
  })

  it('serves the team-root value + the merged liveToken (the lightweight probe of the root)', () => {
    const data = dataOf(S6T.readStateRoot)
    expect(data['relation']).toBe('team-root')
    expect(data['teamSessionId']).toBe(ROOT_SID)
    expect(data['memberInstanceId']).toBeNull()
    expect(data['disposed']).toBe(false)
    expect(data['durableGeneration']).toBe(11)
    expect(data['liveToken']).toBe(fakeLiveToken(ROOT_SID))
  })

  it('CONSISTENCY (PR #35 follow-up + P0-2): in the stable state, getReadState and getProjection answer the SAME durableGeneration + liveToken pair — the lightweight probe token (durable rows + snapshot) and the projection token (the projection members) agree on one live state', () => {
    // The two INDEPENDENT pure derivations of the token agree on the
    // same stable live state (the format is unchanged: lt-v1-*).
    expect(STABLE_PROJECTION_TOKEN).toBe(STABLE_SNAPSHOT_TOKEN)
    expect(STABLE_PROJECTION_TOKEN.startsWith('lt-v1-')).toBe(true)
    const readData = dataOf(S6T.readStateRoot)
    const projData = dataOf(S6T.projectionConsistency)
    const projection = projData['projection'] as Record<string, unknown>
    expect(readData['durableGeneration']).toBe(projection['durableGeneration'])
    expect(readData['durableGeneration']).toBe(11)
    expect(readData['liveToken']).toBe(projection['liveToken'])
    expect(readData['liveToken']).toBe(STABLE_PROJECTION_TOKEN)
  })

  it('a team relation with an ABSENT live-token wiring → typed TEAM_REMOTE_TEAM_LIVE_TOKEN_PORT_UNAVAILABLE (never a team relation with a null token)', () => {
    const error = errorOf(S6T.readStateTokenAbsent)
    expect(error['code']).toBe(S6_REMOTE_ERROR_CODES.TEAM_LIVE_TOKEN_PORT_UNAVAILABLE)
  })

  it('an UNTYPED live-token throw on a team relation is re-wrapped to the same code (fail closed)', () => {
    const error = errorOf(S6T.readStateTokenUntypedResponse)
    expect(error['code']).toBe(S6_REMOTE_ERROR_CODES.TEAM_LIVE_TOKEN_PORT_UNAVAILABLE)
    expect(String(error['message'])).toContain('boom: overlay unavailable')
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

describe('team-view-sync-complete — S6 production dispatcher: team.getProjection v6 pair (frozen decisions 3 + 4, P0-2 same-snapshot)', () => {
  it('the v6 frame carries the PAIR inside data.projection: durableGeneration === generation + the liveToken computed FROM THE SAME PROJECTION (no liveToken port call)', () => {
    const data = dataOf(S6T.projectionV6)
    const projection = data['projection'] as Record<string, unknown>
    expect(projection['generation']).toBe(11)
    expect(projection['durableGeneration']).toBe(11)
    // P0-2: the token is a pure function of the served frame's own
    // members[].liveActivity cells (recomputing from the received frame
    // reproduces the served token — the client same-snapshot check).
    const members = projection['members'] as Array<{ instanceId: string; liveActivity: { residency: string } | null }>
    expect(computeLiveTokenFromProjectedMembers(members)).toBe(projection['liveToken'])
    expect(projection['liveToken']).toBe(STABLE_PROJECTION_TOKEN)
    // The lightweight liveToken port was NEVER consulted on the v6
    // projection path (the trip-wire port would have thrown).
    expect(S6T.liveTokenCalls).toEqual([])
    // The nine frozen v1 fields are UNCHANGED.
    expect(projection['schemaVersion']).toBe(1)
    expect(projection['teamSessionId']).toBe(ROOT_SID)
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

  it('the v6 projection is served WITHOUT the live-token wiring (the port is the read-state probe authority only — the projection token comes from its own snapshot)', () => {
    const data = dataOf(S6T.projectionV6LiveTokenAbsent)
    const projection = data['projection'] as Record<string, unknown>
    expect(projection['generation']).toBe(11)
    expect(projection['durableGeneration']).toBe(11)
    expect(projection['liveToken']).toBe(STABLE_PROJECTION_TOKEN)
  })

  it('§3.2 SAME-SNAPSHOT: one v6 getProjection reads the overlay EXACTLY ONCE — the frame is the first (resident) snapshot and the served token is the first-snapshot token (never the second/cold one)', () => {
    expect(S6T.snapshotCalls).toBe(1)
    const data = dataOf(S6T.projectionSameSnapshot)
    const projection = data['projection'] as Record<string, unknown>
    const members = projection['members'] as Array<{ instanceId: string; liveActivity: { residency: string } | null }>
    const leader = members.find((member) => member.instanceId === 'inst-leader')
    expect(leader?.liveActivity).toEqual({ residency: 'resident' })
    // The served token is the FIRST snapshot's token; a second snapshot
    // read for the token would have served the cold state's token
    // (the old two-snapshot bug) — and the two tokens differ.
    expect(S6T.firstSnapshotToken).not.toBe(S6T.secondSnapshotToken)
    expect(projection['liveToken']).toBe(S6T.firstSnapshotToken)
    expect(projection['liveToken']).not.toBe(S6T.secondSnapshotToken)
    // The client-side recomputation reproduces the served token.
    expect(computeLiveTokenFromProjectedMembers(members)).toBe(projection['liveToken'])
  })
})
