/**
 * d1-team-remote-v3.test.ts — D1 (Team D1-D6 repair v2): the client
 * transport wrappers of the remote contract v3-only methods
 * (`team.listRoots` / `team.ensureRootLive`).
 *
 * Coverage (D1 task card, client-transport half):
 *  - envelope assembly: channel `/team-remote`, payload
 *    `{ version: 3, params }` — the v3 wrappers are the ONLY v3-stamping
 *    wrappers (every other wrapper keeps its v1/v2 stamp);
 *  - `teamListRootsV3` stamps `{ version: 3, params: {} }` (the closed
 *    param set is EMPTY — a zero-field payload);
 *  - `teamEnsureRootLiveV3(teamSessionId)` stamps
 *    `{ version: 3, params: { teamSessionId } }` (the closed param set is
 *    exactly `['teamSessionId']` — nothing else rides);
 *  - outcome pass-through: a success envelope and a TYPED error envelope
 *    (the D1 reserved `TEAM_REMOTE_TEAM_ROOT_LIVE_NOT_IMPLEMENTED` and
 *    the `TEAM_REMOTE_TEAM_ROOTS_UNAVAILABLE` fail-closed codes) resolve
 *    INTACT through the v3 wrappers — never exception-ified, never
 *    re-wrapped, the provenance `contractVersion` still 3;
 *  - the ONLY rejection kind is still the frozen
 *    `PushTransportLossError` (carrier rejection) — the v3 wrappers add
 *    no new rejection kind.
 *
 * Shim-constrained spec (run-tests.mjs): the `it()` bodies are
 * synchronous assertions on captured scenario state; the async scenarios
 * run at module level (top-level await).
 *
 * Matchers used: toBe / toEqual / toThrow (+ .not) only.
 */

import { describe, expect, it } from 'vitest'

import {
  REMOTE_CONTRACT_VERSION,
  REMOTE_CONTRACT_VERSION_V2,
  REMOTE_CONTRACT_VERSION_V3,
  REMOTE_RPC_CHANNEL,
  buildRemoteError,
  buildRemoteSuccess,
  type RemoteResponse,
} from '../../remote/src/index.js'
import { createTeamRemoteClient } from '../src/transport/team-remote-client.js'
import type { TeamRpcCarrier, TeamRpcResult } from '../src/transport/host-seams.js'

interface CallRecord {
  readonly channel: string
  readonly endpoint: string
  readonly payload: unknown
}

/** One scripted carrier: records every call, answers with a fixed result. */
function makeCarrier(answer: () => TeamRpcResult) {
  const calls: CallRecord[] = []
  const carrier: TeamRpcCarrier = {
    call: async (channel, endpoint, payload) => {
      calls.push({ channel, endpoint, payload })
      return answer()
    },
  }
  return { carrier, calls }
}

/** The v3 `team.listRoots` success envelope (the D1 closed wire row shape). */
const listRootsSuccess = (): RemoteResponse =>
  buildRemoteSuccess(
    {
      roots: [
        {
          rootSessionId: 'root-session-d1',
          blueprintId: 'BP-D1',
          revision: '17',
          defaultWorkspace: 'C:/agent-team/work/d1',
          createdAt: '2026-09-01T00:00:00Z',
          generation: 1,
          memberCount: 2,
        },
      ],
    },
    {
      method: 'team.listRoots',
      endpoint: 'team.listRoots',
      contractVersion: REMOTE_CONTRACT_VERSION_V3,
      requestToken: null,
      projectionGeneration: null,
      effectSequence: null,
    },
  )

/** The D1 reserved `team.ensureRootLive` typed error (the host fails closed until D2). */
const ensureRootLiveNotImplemented = (): RemoteResponse =>
  buildRemoteError(
    'TEAM_REMOTE_TEAM_ROOT_LIVE_NOT_IMPLEMENTED',
    "team.ensureRootLive is reserved: the host handler (the live glue's Team-mode ensure) is not wired yet — the durable root row of 'root-session-d1' is untouched",
    {
      method: 'team.ensureRootLive',
      endpoint: 'team.ensureRootLive',
      contractVersion: REMOTE_CONTRACT_VERSION_V3,
      requestToken: null,
    },
    { reason: 'domain-error' },
  )

/** The D1 `team.listRoots` fail-closed typed error (the host wiring is absent). */
const listRootsUnavailable = (): RemoteResponse =>
  buildRemoteError(
    'TEAM_REMOTE_TEAM_ROOTS_UNAVAILABLE',
    'team.listRoots cannot read the durable root ownership list: the host wiring does not provide the listRoots port — failing closed (never a silent empty list)',
    {
      method: 'team.listRoots',
      endpoint: 'team.listRoots',
      contractVersion: REMOTE_CONTRACT_VERSION_V3,
      requestToken: null,
    },
    { reason: 'domain-error' },
  )

/** Capture one awaited call: `{ response?, caught? }` — exactly one set. */
async function capture(
  run: () => Promise<RemoteResponse>,
): Promise<{ readonly response?: RemoteResponse; readonly caught?: unknown }> {
  try {
    const response = await run()
    return { response }
  } catch (error) {
    return { caught: error }
  }
}

// ---------------------------------------------------------------------------
// Module-level scenarios (the shim's it() bodies are synchronous)
// ---------------------------------------------------------------------------

const listRootsScenario = await (async () => {
  const { carrier, calls } = makeCarrier(() => listRootsSuccess())
  const client = createTeamRemoteClient(carrier)
  const result = await capture(() => client.teamListRootsV3())
  return { calls, result }
})()

const ensureRootLiveScenario = await (async () => {
  const { carrier, calls } = makeCarrier(() => ensureRootLiveNotImplemented())
  const client = createTeamRemoteClient(carrier)
  const result = await capture(() => client.teamEnsureRootLiveV3('root-session-d1'))
  return { calls, result }
})()

const ensureRootLiveSuccessScenario = await (async () => {
  const { carrier, calls } = makeCarrier(() =>
    buildRemoteSuccess(
      { rootSessionId: 'root-session-d1', mode: 'team', live: true },
      {
        method: 'team.ensureRootLive',
        endpoint: 'team.ensureRootLive',
        contractVersion: REMOTE_CONTRACT_VERSION_V3,
        requestToken: null,
        projectionGeneration: null,
        effectSequence: null,
      },
    ),
  )
  const client = createTeamRemoteClient(carrier)
  const result = await capture(() => client.teamEnsureRootLiveV3('root-session-d1'))
  return { calls, result }
})()

const listRootsUnavailableScenario = await (async () => {
  const { carrier, calls } = makeCarrier(() => listRootsUnavailable())
  const client = createTeamRemoteClient(carrier)
  const result = await capture(() => client.teamListRootsV3())
  return { calls, result }
})()

const carrierRejectionScenario = await (async () => {
  const calls: CallRecord[] = []
  const carrier: TeamRpcCarrier = {
    call: async (channel, endpoint, payload) => {
      calls.push({ channel, endpoint, payload })
      throw new Error('the transport was torn down mid-flight')
    },
  }
  const client = createTeamRemoteClient(carrier)
  const result = await capture(() => client.teamListRootsV3())
  return { calls, result }
})()

const versionStampingScenario = await (async () => {
  const { carrier, calls } = makeCarrier(() => listRootsSuccess())
  const client = createTeamRemoteClient(carrier)
  await client.call('team.getProjection', { teamSessionId: 't1' })
  await client.teamCreateV2({ rootSessionId: 't1', blueprintId: 'BP-D1' })
  await client.teamListRootsV3()
  await client.teamEnsureRootLiveV3('t1')
  return { calls }
})()

// ---------------------------------------------------------------------------
// Assertions (synchronous it() bodies over the captured scenario state)
// ---------------------------------------------------------------------------

describe('D1 (client transport): teamListRootsV3', () => {
  it('stamps the closed EMPTY param set with contract version 3 on the frozen channel', () => {
    expect(listRootsScenario.calls.length).toBe(1)
    const call = listRootsScenario.calls[0] as CallRecord
    expect(call.channel).toBe(REMOTE_RPC_CHANNEL)
    expect(call.endpoint).toBe('team.listRoots')
    expect(call.payload).toEqual({ version: REMOTE_CONTRACT_VERSION_V3, params: {} })
    expect(call.payload).toEqual({ version: 3, params: {} })
  })

  it('the success envelope resolves intact (the { roots: [...] } data + provenance contractVersion 3)', () => {
    const { response } = listRootsScenario.result
    expect(response).toBeDefined()
    expect(response?.ok).toBe(true)
    if (response?.ok) {
      expect(response.value.provenance.contractVersion).toBe(REMOTE_CONTRACT_VERSION_V3)
      expect(response.value.data).toEqual({
        roots: [
          {
            rootSessionId: 'root-session-d1',
            blueprintId: 'BP-D1',
            revision: '17',
            defaultWorkspace: 'C:/agent-team/work/d1',
            createdAt: '2026-09-01T00:00:00Z',
            generation: 1,
            memberCount: 2,
          },
        ],
      })
    }
  })

  it('the fail-closed TEAM_REMOTE_TEAM_ROOTS_UNAVAILABLE typed error resolves intact (never exception-ified)', () => {
    const { response, caught } = listRootsUnavailableScenario.result
    expect(caught).toBeUndefined()
    expect(response?.ok).toBe(false)
    if (response && !response.ok) {
      expect(response.error.code).toBe('TEAM_REMOTE_TEAM_ROOTS_UNAVAILABLE')
      expect(response.error.details.contractVersion).toBe(REMOTE_CONTRACT_VERSION_V3)
    }
  })
})

describe('D1 (client transport): teamEnsureRootLiveV3', () => {
  it('stamps the closed { teamSessionId } param set with contract version 3 on the frozen channel', () => {
    expect(ensureRootLiveScenario.calls.length).toBe(1)
    const call = ensureRootLiveScenario.calls[0] as CallRecord
    expect(call.channel).toBe(REMOTE_RPC_CHANNEL)
    expect(call.endpoint).toBe('team.ensureRootLive')
    expect(call.payload).toEqual({ version: REMOTE_CONTRACT_VERSION_V3, params: { teamSessionId: 'root-session-d1' } })
    expect(call.payload).toEqual({ version: 3, params: { teamSessionId: 'root-session-d1' } })
  })

  it('the D1 reserved TEAM_REMOTE_TEAM_ROOT_LIVE_NOT_IMPLEMENTED typed error resolves intact (the method is inert until D2 — no client-side error)', () => {
    const { response, caught } = ensureRootLiveScenario.result
    expect(caught).toBeUndefined()
    expect(response?.ok).toBe(false)
    if (response && !response.ok) {
      expect(response.error.code).toBe('TEAM_REMOTE_TEAM_ROOT_LIVE_NOT_IMPLEMENTED')
      expect(response.error.details.contractVersion).toBe(REMOTE_CONTRACT_VERSION_V3)
    }
  })

  it('the closed success shape { rootSessionId, mode: team, live: true } resolves intact', () => {
    const { response } = ensureRootLiveSuccessScenario.result
    expect(response?.ok).toBe(true)
    if (response?.ok) {
      expect(response.value.provenance.contractVersion).toBe(REMOTE_CONTRACT_VERSION_V3)
      expect(response.value.data).toEqual({ rootSessionId: 'root-session-d1', mode: 'team', live: true })
    }
  })
})

describe('D1 (client transport): the rejection kind is unchanged', () => {
  it('a carrier rejection still maps to the frozen PushTransportLossError (the v3 wrappers add no new rejection kind)', () => {
    const { caught } = carrierRejectionScenario.result
    expect(caught).toBeDefined()
    expect((caught as Error).name).toBe('PushTransportLossError')
  })
})

describe('D1 (client transport): the version stamping discipline is unchanged', () => {
  it('each wrapper stamps exactly its own contract version (v1 generic, v2 create/admit, v3 the two D1 methods)', () => {
    const calls = versionStampingScenario.calls
    expect(calls.length).toBe(4)
    expect((calls[0] as CallRecord).payload).toEqual(
      expect.objectContaining({ version: REMOTE_CONTRACT_VERSION }),
    )
    expect((calls[1] as CallRecord).payload).toEqual(
      expect.objectContaining({ version: REMOTE_CONTRACT_VERSION_V2 }),
    )
    expect((calls[2] as CallRecord).payload).toEqual(
      expect.objectContaining({ version: REMOTE_CONTRACT_VERSION_V3 }),
    )
    expect((calls[3] as CallRecord).payload).toEqual(
      expect.objectContaining({ version: REMOTE_CONTRACT_VERSION_V3 }),
    )
  })
})
