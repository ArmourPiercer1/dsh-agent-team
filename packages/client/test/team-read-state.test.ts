/**
 * team-view-sync-complete (PR #35 follow-up, frozen §1.3) — the
 * client-local `team.getReadState` model: the strict parser over the
 * closed v6 wire value (ok → the discriminated relation; malformed
 * success → typed malformed, NEVER a degraded `none`; typed host error
 * → stored intact; the seam's transport rejection → transport-loss).
 */
import { describe, expect, it } from 'vitest'
import {
  buildRemoteError,
  buildRemoteSuccess,
  PushTransportLossError,
  type RemoteResponse,
} from '../../remote/src/index.js'
import {
  parseTeamReadStateResponse,
  resolveTeamReadState,
  type TeamReadStateClient,
} from '../src/state/team-read-state.js'

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const CTX = {
  method: 'team.getReadState',
  endpoint: 'team.getReadState',
  contractVersion: 6,
  requestToken: null,
  projectionGeneration: 11,
}

function success(data: unknown): RemoteResponse {
  return buildRemoteSuccess(data, CTX)
}

const TEAM_ROOT_VALUE = {
  relation: 'team-root',
  teamSessionId: 'root-1',
  memberInstanceId: null,
  disposed: false,
  durableGeneration: 11,
  liveToken: 'lt-v1-root-one',
}
const TEAM_MEMBER_VALUE = {
  relation: 'team-member',
  teamSessionId: 'root-1',
  memberInstanceId: 'inst-2',
  disposed: true,
  durableGeneration: 11,
  liveToken: 'lt-v1-member-two',
}
const NONE_VALUE = {
  relation: 'none',
  teamSessionId: null,
  memberInstanceId: null,
  disposed: false,
  durableGeneration: null,
  liveToken: null,
}

// ---------------------------------------------------------------------------
// Assertions (the parser is pure — direct calls)
// ---------------------------------------------------------------------------

describe('team-view-sync-complete — the client read-state parser (strict, fail closed)', () => {
  it('parses the team-root relation (the root perspective identity + the pair)', () => {
    const outcome = parseTeamReadStateResponse(success(TEAM_ROOT_VALUE))
    expect(outcome.status).toBe('ok')
    if (outcome.status !== 'ok') throw new Error('guard')
    expect(outcome.relation.kind).toBe('team-root')
    expect(outcome.relation.teamSessionId).toBe('root-1')
    expect(outcome.relation.memberInstanceId).toBeNull()
    expect(outcome.relation.disposed).toBe(false)
    expect(outcome.relation.durableGeneration).toBe(11)
    expect(outcome.relation.liveToken).toBe('lt-v1-root-one')
  })

  it('parses the team-member relation (the member perspective identity + disposed + the pair)', () => {
    const outcome = parseTeamReadStateResponse(success(TEAM_MEMBER_VALUE))
    expect(outcome.status).toBe('ok')
    if (outcome.status !== 'ok') throw new Error('guard')
    expect(outcome.relation.kind).toBe('team-member')
    expect(outcome.relation.teamSessionId).toBe('root-1')
    expect(outcome.relation.memberInstanceId).toBe('inst-2')
    expect(outcome.relation.disposed).toBe(true)
    expect(outcome.relation.durableGeneration).toBe(11)
    expect(outcome.relation.liveToken).toBe('lt-v1-member-two')
  })

  it('parses the confirmed-none relation (every cell null)', () => {
    const outcome = parseTeamReadStateResponse(success(NONE_VALUE))
    expect(outcome.status).toBe('ok')
    if (outcome.status !== 'ok') throw new Error('guard')
    expect(outcome.relation.kind).toBe('none')
    expect(outcome.relation.teamSessionId).toBeNull()
    expect(outcome.relation.memberInstanceId).toBeNull()
    expect(outcome.relation.durableGeneration).toBeNull()
    expect(outcome.relation.liveToken).toBeNull()
  })

  // -- the MALFORMED battery: a broken success value is typed malformed,
  //    NEVER a degraded `none` (the coordinator must not drop a team).

  const malformedBattery: ReadonlyArray<{ readonly label: string; readonly value: unknown }> = [
    { label: 'data not an object', value: 'team' },
    { label: 'a missing relation cell', value: { teamSessionId: 'root-1', memberInstanceId: null, disposed: false, durableGeneration: 11, liveToken: 'lt-v1-x' } },
    { label: 'a non-vocabulary relation', value: { ...TEAM_ROOT_VALUE, relation: 'leader' } },
    { label: 'a team-root with a null liveToken', value: { ...TEAM_ROOT_VALUE, liveToken: null } },
    { label: 'a team-root with a missing liveToken', value: { relation: 'team-root', teamSessionId: 'root-1', memberInstanceId: null, disposed: false, durableGeneration: 11 } },
    { label: 'a team-root with a non-lt-v1 liveToken', value: { ...TEAM_ROOT_VALUE, liveToken: 'gen-11' } },
    { label: 'a team-root with a non-null memberInstanceId', value: { ...TEAM_ROOT_VALUE, memberInstanceId: 'inst-9' } },
    { label: 'a team-root with disposed true', value: { ...TEAM_ROOT_VALUE, disposed: true } },
    { label: 'a team-member with a null memberInstanceId', value: { ...TEAM_MEMBER_VALUE, memberInstanceId: null } },
    { label: 'a team-member with a null liveToken', value: { ...TEAM_MEMBER_VALUE, liveToken: null } },
    { label: 'a team-member with a non-boolean disposed', value: { ...TEAM_MEMBER_VALUE, disposed: 'no' } },
    { label: 'a team relation with a null durableGeneration', value: { ...TEAM_ROOT_VALUE, durableGeneration: null } },
    { label: 'a team relation with a zero durableGeneration', value: { ...TEAM_ROOT_VALUE, durableGeneration: 0 } },
    { label: 'a team relation with a null teamSessionId', value: { ...TEAM_ROOT_VALUE, teamSessionId: null } },
    { label: 'a none with a non-null liveToken', value: { ...NONE_VALUE, liveToken: 'lt-v1-x' } },
    { label: 'a none with a non-null teamSessionId', value: { ...NONE_VALUE, teamSessionId: 'root-1' } },
    { label: 'a none with disposed true', value: { ...NONE_VALUE, disposed: true } },
    { label: 'a none with a non-null durableGeneration', value: { ...NONE_VALUE, durableGeneration: 3 } },
  ]
  for (const { label, value } of malformedBattery) {
    it(`MALFORMED → typed (never a degraded none): ${label}`, () => {
      const outcome = parseTeamReadStateResponse(success(value))
      expect(outcome.status).toBe('malformed')
      if (outcome.status !== 'malformed') throw new Error('guard')
      expect(outcome.reason.length).toBeGreaterThan(0)
    })
  }

  it('a typed host error is stored INTACT (never exception-ified, never re-interpreted)', () => {
    const outcome = parseTeamReadStateResponse(
      buildRemoteError('TEAM_READ_STATE_OWNERSHIP_CONFLICT', 'ambiguous ownership', CTX),
    )
    expect(outcome.status).toBe('remote-error')
    if (outcome.status !== 'remote-error') throw new Error('guard')
    expect(outcome.code).toBe('TEAM_READ_STATE_OWNERSHIP_CONFLICT')
    expect(outcome.message).toBe('ambiguous ownership')
  })
})

describe('team-view-sync-complete — resolveTeamReadState (the transport edge, never rejects)', () => {
  it('the seam transport loss (PushTransportLossError) → transport-loss with its message', async () => {
    const client: TeamReadStateClient = {
      getReadStateV6: () => Promise.reject(new PushTransportLossError('seam channel lost')),
    }
    const outcome = await resolveTeamReadState(client, 'ordinary-1')
    expect(outcome.status).toBe('transport-loss')
    if (outcome.status !== 'transport-loss') throw new Error('guard')
    expect(outcome.message).toBe('seam channel lost')
  })

  it('an UNEXPECTED rejection kind is still classified as transport-loss (never a degraded none)', async () => {
    const client: TeamReadStateClient = {
      getReadStateV6: () => Promise.reject(new Error('boom: internal bug')),
    }
    const outcome = await resolveTeamReadState(client, 'ordinary-1')
    expect(outcome.status).toBe('transport-loss')
    if (outcome.status !== 'transport-loss') throw new Error('guard')
    expect(outcome.message).toBe('boom: internal bug')
  })

  it('the ok path resolves the relation through the seam', async () => {
    const calls: string[] = []
    const client: TeamReadStateClient = {
      getReadStateV6: (sessionId) => {
        calls.push(sessionId)
        return Promise.resolve(success(NONE_VALUE))
      },
    }
    const outcome = await resolveTeamReadState(client, 'ordinary-1')
    expect(calls).toEqual(['ordinary-1'])
    expect(outcome.status).toBe('ok')
    if (outcome.status !== 'ok') throw new Error('guard')
    expect(outcome.relation.kind).toBe('none')
  })
})
