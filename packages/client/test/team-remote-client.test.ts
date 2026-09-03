/**
 * P9-T3 (S2-A) — the Team Remote client over the frozen public seam.
 *
 * Coverage: envelope assembly is exclusive to this module (channel
 * `/team-remote`, payload `{ version, params }`); success and typed-error
 * outcomes pass through intact (never exception-ified, never re-wrapped);
 * the ONLY rejection kind is the frozen `PushTransportLossError`
 * (carrier rejection and malformed server-envelope both map to it); the
 * typed wrappers spread the frozen param objects verbatim and
 * `getLedgerPage` applies the frozen wire defaults (0 / 50).
 *
 * Shim-constrained spec (run-tests.mjs): the `it()` bodies are
 * synchronous assertions on captured scenario state; the async scenarios
 * run at module level (top-level await, the P8-T3 round-trip pattern).
 * Matchers used: toBe / toEqual / toThrow (+ .not) only.
 */
import { describe, expect, it } from 'vitest'
import {
  REMOTE_CONTRACT_VERSION,
  REMOTE_RPC_CHANNEL,
  PushTransportLossError,
  buildRemoteError,
  buildRemoteSuccess,
  type RemoteMemberSendParams,
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

const successEnvelope = (): RemoteResponse =>
  buildRemoteSuccess(
    { projection: { teamSessionId: 't1', generation: 1 } },
    {
      method: 'team.getProjection',
      endpoint: 'team.getProjection',
      contractVersion: REMOTE_CONTRACT_VERSION,
      requestToken: null,
      projectionGeneration: 1,
    },
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

const envelopeScenario = await (async () => {
  const { carrier, calls } = makeCarrier(() => successEnvelope())
  const client = createTeamRemoteClient(carrier)
  const response = await client.call('team.getProjection', { teamSessionId: 't1' })
  return { calls, response }
})()

const getProjectionWrapperScenario = await (async () => {
  const { carrier, calls } = makeCarrier(() => successEnvelope())
  const client = createTeamRemoteClient(carrier)
  await client.getProjection('t-42')
  return { calls }
})()

const ledgerPageScenario = await (async () => {
  const { carrier, calls } = makeCarrier(() => successEnvelope())
  const client = createTeamRemoteClient(carrier)
  await client.getLedgerPage('t1')
  await client.getLedgerPage('t1', 7, 25)
  return { calls }
})()

const catalogListScenario = await (async () => {
  const { carrier, calls } = makeCarrier(() => successEnvelope())
  const client = createTeamRemoteClient(carrier)
  await client.catalogList()
  return { calls }
})()

const memberSendScenario = await (async () => {
  const { carrier, calls } = makeCarrier(() => successEnvelope())
  const client = createTeamRemoteClient(carrier)
  const params: RemoteMemberSendParams = {
    teamSessionId: 't1',
    caller: { kind: 'human', humanId: 'h1' },
    recipientInstanceId: 'm1',
    body: 'hello',
    requestToken: 'ik-1',
  }
  await client.memberSend(params)
  return { calls }
})()

const wrapperMappingScenario = await (async () => {
  const { carrier, calls } = makeCarrier(() => successEnvelope())
  const client = createTeamRemoteClient(carrier)
  const pairs: Array<[() => Promise<RemoteResponse>, string]> = [
    [() => client.catalogGet({ blueprintId: 'b1' }), 'catalog.get'],
    [
      () => client.intentProbe({ blueprintId: 'b1', environmentFacts: [] }),
      'intent.probe',
    ],
    [
      () => client.teamCreate({ rootSessionId: 's0', blueprintId: 'b1' }),
      'team.create',
    ],
    [
      () =>
        client.memberCreate({
          teamSessionId: 't1',
          caller: { kind: 'human', humanId: 'h1' },
          requestToken: 'rt1',
        }),
      'member.create',
    ],
    [
      () =>
        client.memberFollowup({
          teamSessionId: 't1',
          caller: { kind: 'human', humanId: 'h1' },
          targetInstanceId: 'm1',
          requestToken: 'rt2',
        }),
      'member.followup',
    ],
    [() => client.memberArchive({ teamSessionId: 't1', instanceId: 'm1' }), 'member.archive'],
    [() => client.memberRestore({ teamSessionId: 't1', instanceId: 'm1' }), 'member.restore'],
    [() => client.memberDispose({ teamSessionId: 't1', instanceId: 'm1' }), 'member.dispose'],
    [
      () => client.overrideGet({ teamSessionId: 't1', capability: 'model' }),
      'override.get',
    ],
    [
      () =>
        client.overrideSet({
          teamSessionId: 't1',
          capability: 'model',
          value: { kind: 'deny' },
          actor: { kind: 'leader' },
        }),
      'override.set',
    ],
    [
      () =>
        client.overrideReset({
          teamSessionId: 't1',
          capability: 'model',
          actor: { kind: 'leader' },
        }),
      'override.reset',
    ],
    [() => client.policyStateGet({ teamSessionId: 't1' }), 'policyState.get'],
    [
      () =>
        client.policyStateSet({
          teamSessionId: 't1',
          target: { stateId: 'st1' },
          actor: { kind: 'leader' },
        }),
      'policyState.set',
    ],
    [() => client.compatibilityGet({ teamSessionId: 't1' }), 'compatibility.get'],
    [
      () =>
        client.compatibilityAck({
          teamSessionId: 't1',
          requirementId: 'r1',
          acknowledgedBy: 'h1',
        }),
      'compatibility.ack',
    ],
    [
      () => client.compatibilityReprobe({ teamSessionId: 't1', trigger: 'NEW_ACTIVATION' }),
      'compatibility.reprobe',
    ],
    [() => client.handoffPrepare({ sourceSessionId: 's1' }), 'handoff.prepare'],
    [
      () => client.handoffCreate({ sourceSessionId: 's1', requestToken: 'rt3' }),
      'handoff.create',
    ],
    [() => client.legacyInspect({ dshHome: 'C:/x' }), 'legacy.inspect'],
  ]
  for (const [run] of pairs) {
    await run()
  }
  const endpoints = pairs.map(([, method]) => method)
  return { calls, endpoints }
})()

const successIntactScenario = await (async () => {
  const envelope = successEnvelope()
  const { carrier } = makeCarrier(() => envelope)
  const client = createTeamRemoteClient(carrier)
  const result = await capture(() =>
    client.call('team.getProjection', { teamSessionId: 't1' }),
  )
  return { envelope, result }
})()

const typedErrorScenario = await (async () => {
  const envelope = buildRemoteError('not-found', 'no such team', {
    method: 'team.getProjection',
    endpoint: 'team.getProjection',
    contractVersion: REMOTE_CONTRACT_VERSION,
    requestToken: null,
  })
  const { carrier } = makeCarrier(() => envelope)
  const client = createTeamRemoteClient(carrier)
  const result = await capture(() =>
    client.call('team.getProjection', { teamSessionId: 'ghost' }),
  )
  return { envelope, result }
})()

const carrierRejectScenario = await (async () => {
  const carrier: TeamRpcCarrier = {
    call: async (_channel, _endpoint, _payload) => {
      throw new Error('boom: fetch failed')
    },
  }
  const client = createTeamRemoteClient(carrier)
  const result = await capture(() => client.call('team.getProjection', { teamSessionId: 't1' }))
  return { result }
})()

const malformedSuccessScenario = await (async () => {
  const { carrier } = makeCarrier(
    () => ({ ok: true, value: 'garbage' }) as unknown as TeamRpcResult,
  )
  const client = createTeamRemoteClient(carrier)
  const result = await capture(() => client.call('team.getProjection', { teamSessionId: 't1' }))
  return { result }
})()

const malformedErrorScenario = await (async () => {
  const { carrier } = makeCarrier(
    () => ({ ok: false, error: { code: 'x' } }) as unknown as TeamRpcResult,
  )
  const client = createTeamRemoteClient(carrier)
  const result = await capture(() => client.call('team.getProjection', { teamSessionId: 't1' }))
  return { result }
})()

// ---------------------------------------------------------------------------
// Synchronous assertions on the captured scenarios
// ---------------------------------------------------------------------------

describe('createTeamRemoteClient — envelope assembly (S2-A)', () => {
  it('assembles the frozen envelope { version, params } on the frozen channel', () => {
    expect(envelopeScenario.calls.length).toBe(1)
    expect(envelopeScenario.calls[0]!.channel).toBe(REMOTE_RPC_CHANNEL)
    expect(envelopeScenario.calls[0]!.endpoint).toBe('team.getProjection')
    expect(envelopeScenario.calls[0]!.payload).toEqual({
      version: REMOTE_CONTRACT_VERSION,
      params: { teamSessionId: 't1' },
    })
  })

  it('getProjection wraps the catalog method with the closed param object', () => {
    expect(getProjectionWrapperScenario.calls[0]!.endpoint).toBe('team.getProjection')
    expect(getProjectionWrapperScenario.calls[0]!.payload).toEqual({
      version: REMOTE_CONTRACT_VERSION,
      params: { teamSessionId: 't-42' },
    })
  })

  it('getLedgerPage applies the frozen wire defaults (afterSequence 0, limit 50)', () => {
    const { calls } = ledgerPageScenario
    expect(calls[0]!.endpoint).toBe('team.getLedgerPage')
    expect(calls[0]!.payload).toEqual({
      version: REMOTE_CONTRACT_VERSION,
      params: { teamSessionId: 't1', afterSequence: 0, limit: 50 },
    })
    expect(calls[1]!.payload).toEqual({
      version: REMOTE_CONTRACT_VERSION,
      params: { teamSessionId: 't1', afterSequence: 7, limit: 25 },
    })
  })

  it('catalogList sends the empty closed param object', () => {
    expect(catalogListScenario.calls[0]!.endpoint).toBe('catalog.list')
    expect(catalogListScenario.calls[0]!.payload).toEqual({
      version: REMOTE_CONTRACT_VERSION,
      params: {},
    })
  })

  it('memberSend spreads the frozen param object verbatim', () => {
    const { calls } = memberSendScenario
    expect(calls[0]!.endpoint).toBe('member.send')
    expect(calls[0]!.payload).toEqual({
      version: REMOTE_CONTRACT_VERSION,
      params: {
        teamSessionId: 't1',
        caller: { kind: 'human', humanId: 'h1' },
        recipientInstanceId: 'm1',
        body: 'hello',
        requestToken: 'ik-1',
      },
    })
  })

  it('every wrapper maps to its frozen catalog method name', () => {
    const { calls, endpoints } = wrapperMappingScenario
    expect(calls.length).toBe(endpoints.length)
    for (let i = 0; i < endpoints.length; i++) {
      expect(calls[i]!.endpoint).toBe(endpoints[i]!)
    }
  })
})

describe('createTeamRemoteClient — outcome discipline (S2-A / G2)', () => {
  it('returns a success envelope intact (value + provenance, no re-wrap)', () => {
    const { envelope, result } = successIntactScenario
    expect(result.caught).toBe(undefined)
    expect(result.response).toBe(envelope)
    expect(result.response?.ok).toBe(true)
    if (result.response !== undefined && result.response.ok) {
      expect(result.response.value.provenance.method).toBe('team.getProjection')
      expect(result.response.value.provenance.projectionGeneration).toBe(1)
    }
  })

  it('returns a typed RPC error intact — resolves, never rejects (G2)', () => {
    const { envelope, result } = typedErrorScenario
    expect(result.caught).toBe(undefined)
    expect(result.response).toBe(envelope)
    expect(result.response?.ok).toBe(false)
    if (result.response !== undefined && !result.response.ok) {
      expect(result.response.error.code).toBe('not-found')
      expect(result.response.error.details.method).toBe('team.getProjection')
    }
  })

  it('carrier rejection rejects with the frozen PushTransportLossError', () => {
    const { result } = carrierRejectScenario
    expect(result.response).toBe(undefined)
    expect(result.caught).not.toBe(undefined)
    expect((result.caught as Error).name).toBe('PushTransportLossError')
    expect((result.caught as Error).message).toBe(
      'team-remote transport: team.getProjection — boom: fetch failed',
    )
  })

  it('a malformed carrier result (not a RemoteResponse) rejects as channel loss', () => {
    const { result } = malformedSuccessScenario
    expect(result.response).toBe(undefined)
    expect(result.caught).not.toBe(undefined)
    expect((result.caught as Error).name).toBe('PushTransportLossError')
    expect((result.caught as Error).message).toBe(
      'team-remote transport: team.getProjection — malformed seam envelope',
    )
  })

  it('a carrier result with a malformed error block rejects as channel loss', () => {
    const { result } = malformedErrorScenario
    expect(result.response).toBe(undefined)
    expect(result.caught).not.toBe(undefined)
    expect((result.caught as Error).name).toBe('PushTransportLossError')
  })
})
