/**
 * F9 (F3/F11/F9/T1.4 repair round r1) — the `teamResolveControlV4`
 * client wrapper: the ONLY wrapper that stamps contract version **4**
 * (U1: the single F9 v4 bump; the v1 constant stays 1 and every v1-v3
 * wrapper keeps the frozen wire behavior).
 *
 * Coverage:
 *  - the envelope is `{ version: 4, params }` on the frozen
 *    `/team-remote` channel, endpoint `team.resolveControl`;
 *  - the closed v4 params `{ teamSessionId, requestId, decision, note? }`
 *    are spread verbatim — an omitted `note` stays ABSENT (the wire
 *    carries no caller/role/actor field; the host derives the human
 *    principal from the validated owned session — INV-9.3 + T12-B4);
 *  - success and typed-error outcomes resolve intact (never
 *    exception-ified, never re-wrapped — invariant 4b);
 *  - the ONLY rejection kind is the frozen `PushTransportLossError`
 *    (the endpoint is named in the message).
 *
 * Shim-constrained spec (run-tests.mjs): the `it()` bodies are
 * synchronous assertions on captured scenario state; the async scenarios
 * run at module level (top-level await, the team-remote-client.test.ts
 * pattern). Matchers used: toBe / toEqual (+ .not) only.
 */
import { describe, expect, it } from 'vitest'
import {
  REMOTE_CONTRACT_VERSION_V4,
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

// (1) allow + note: the v4 envelope with the closed params verbatim.
const allowScenario = await (async () => {
  const success = buildRemoteSuccess(
    {
      decision: {
        requestId: 'ctrl-f9-0001',
        decision: 'allow',
        decider: { kind: 'human', humanId: 't1' },
        scope: { rootSessionId: 't1' },
        requestSequence: 1,
        decisionSequence: 2,
        createdAt: '2026-08-29T00:00:09.000Z',
      },
    },
    {
      method: 'team.resolveControl',
      endpoint: 'team.resolveControl',
      contractVersion: REMOTE_CONTRACT_VERSION_V4,
      requestToken: null,
    },
  )
  const { carrier, calls } = makeCarrier(() => success)
  const client = createTeamRemoteClient(carrier)
  const result = await capture(() =>
    client.teamResolveControlV4({
      teamSessionId: 't1',
      requestId: 'ctrl-f9-0001',
      decision: 'allow',
      note: 'the human allows the write',
    }),
  )
  return { success, calls, result }
})()

// (2) deny WITHOUT note: the closed set — the `note` key stays absent.
const denyScenario = await (async () => {
  const success = buildRemoteSuccess(
    { decision: { requestId: 'ctrl-f9-0002', decision: 'deny' } },
    {
      method: 'team.resolveControl',
      endpoint: 'team.resolveControl',
      contractVersion: REMOTE_CONTRACT_VERSION_V4,
      requestToken: null,
    },
  )
  const { carrier, calls } = makeCarrier(() => success)
  const client = createTeamRemoteClient(carrier)
  await client.teamResolveControlV4({
    teamSessionId: 't1',
    requestId: 'ctrl-f9-0002',
    decision: 'deny',
  })
  return { calls }
})()

// (3) A typed control error served to the v4 wrapper: resolves INTACT.
const typedErrorScenario = await (async () => {
  const envelope = buildRemoteError(
    'CONTROL_REQUEST_DECIDED',
    'the request already carries a durable decision (the first decision is authoritative)',
    {
      method: 'team.resolveControl',
      endpoint: 'team.resolveControl',
      contractVersion: REMOTE_CONTRACT_VERSION_V4,
      requestToken: null,
    },
    { reason: 'domain-error' },
  )
  const { carrier, calls } = makeCarrier(() => envelope)
  const client = createTeamRemoteClient(carrier)
  const result = await capture(() =>
    client.teamResolveControlV4({
      teamSessionId: 't1',
      requestId: 'ctrl-f9-0001',
      decision: 'deny',
    }),
  )
  return { envelope, calls, result }
})()

// (4) A carrier rejection: the frozen PushTransportLossError.
const carrierRejectScenario = await (async () => {
  const carrier: TeamRpcCarrier = {
    call: async (_channel, _endpoint, _payload) => {
      throw new Error('boom: fetch failed')
    },
  }
  const client = createTeamRemoteClient(carrier)
  const result = await capture(() =>
    client.teamResolveControlV4({
      teamSessionId: 't1',
      requestId: 'ctrl-f9-0001',
      decision: 'allow',
    }),
  )
  return { result }
})()

// ---------------------------------------------------------------------------
// Synchronous assertions on the captured scenarios
// ---------------------------------------------------------------------------

describe('F9 — teamResolveControlV4 (the v4-only human control surface)', () => {
  it('stamps contract version 4 on team.resolveControl over the frozen channel (allow + note verbatim)', () => {
    expect(allowScenario.calls.length).toBe(1)
    expect(allowScenario.calls[0]?.channel).toBe(REMOTE_RPC_CHANNEL)
    expect(allowScenario.calls[0]?.endpoint).toBe('team.resolveControl')
    expect(allowScenario.calls[0]?.payload).toEqual({
      version: REMOTE_CONTRACT_VERSION_V4,
      params: {
        teamSessionId: 't1',
        requestId: 'ctrl-f9-0001',
        decision: 'allow',
        note: 'the human allows the write',
      },
    })
  })

  it('spreads the closed v4 params verbatim — an omitted note stays absent (no caller / role / actor field ever)', () => {
    expect(denyScenario.calls.length).toBe(1)
    expect(denyScenario.calls[0]?.endpoint).toBe('team.resolveControl')
    const payload = denyScenario.calls[0]?.payload as {
      readonly version: number
      readonly params: Record<string, unknown>
    }
    expect(payload.version).toBe(REMOTE_CONTRACT_VERSION_V4)
    expect(Object.keys(payload.params).sort()).toEqual([
      'decision',
      'requestId',
      'teamSessionId',
    ])
    expect(payload.params['note']).toBeUndefined()
    expect(payload.params['caller']).toBeUndefined()
    expect(payload.params['role']).toBeUndefined()
    expect(payload.params['actor']).toBeUndefined()
  })

  it('returns a success envelope intact (data.decision + provenance.contractVersion 4)', () => {
    const { success, result } = allowScenario
    expect(result.caught).toBe(undefined)
    expect(result.response).toBe(success)
    expect(result.response?.ok).toBe(true)
    if (result.response !== undefined && result.response.ok) {
      expect(result.response.value.provenance.contractVersion).toBe(REMOTE_CONTRACT_VERSION_V4)
      expect(result.response.value.provenance.method).toBe('team.resolveControl')
      const data = result.response.value.data as Record<string, unknown>
      const decision = data['decision'] as Record<string, unknown>
      expect(decision['decider']).toEqual({ kind: 'human', humanId: 't1' })
    }
  })

  it('returns a typed control error intact — resolves, never rejects (invariant 4b)', () => {
    const { envelope, result } = typedErrorScenario
    expect(result.caught).toBe(undefined)
    expect(result.response).toBe(envelope)
    expect(result.response?.ok).toBe(false)
    if (result.response !== undefined && !result.response.ok) {
      expect(result.response.error.code).toBe('CONTROL_REQUEST_DECIDED')
      expect(result.response.error.details.reason).toBe('domain-error')
      expect(result.response.error.details.contractVersion).toBe(REMOTE_CONTRACT_VERSION_V4)
    }
  })

  it('carrier rejection rejects with the frozen PushTransportLossError (the endpoint named)', () => {
    const { result } = carrierRejectScenario
    expect(result.response).toBe(undefined)
    expect(result.caught).not.toBe(undefined)
    expect((result.caught as Error).name).toBe('PushTransportLossError')
    expect((result.caught as Error).message).toBe(
      'team-remote transport: team.resolveControl — boom: fetch failed',
    )
  })
})
