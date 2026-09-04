/**
 * P9-T10 (P9-S7) — the three governance command categories over the Team
 * Remote client: `override.*`, `policyState.*`, `compatibility.*`.
 *
 * Coverage (plan §P9-S7 "Command flows: override/policy/compat typed
 * errors"): a typed RPC error on each category's mutation surface
 * (override.set, policyState.set, compatibility.reprobe) resolves — never
 * rejects — with the closed wire error block preserved verbatim (code +
 * message, the frozen provenance in `details`); a success passes the
 * `value` + `provenance` through intact (the carrier result IS the
 * RemoteResponse verbatim — the T4 "no re-wrap" rule); and a transport
 * rejection on the same surface rejects with the frozen
 * `PushTransportLossError` (the ONLY rejection kind).
 *
 * The params ride the client's own frozen builders (the team-governance
 * param builders), so the payload assertions compare the exact wire
 * objects the UI would send.
 *
 * Shim-constrained spec (run-tests.mjs): the `it()` bodies are synchronous
 * assertions on captured scenario state; the async scenarios run at module
 * level (top-level await, the P8-T3 round-trip pattern).
 * Matchers used: toBe / toEqual / toThrow (+ .not) only.
 */
import { describe, expect, it } from 'vitest'
import {
  REMOTE_CONTRACT_VERSION,
  REMOTE_RPC_CHANNEL,
  PushTransportLossError,
  buildRemoteError,
  buildRemoteSuccess,
  type RemoteResponse,
} from '../../remote/src/index.js'
import {
  compatibilityAckParams,
  compatibilityReprobeParams,
  overrideGetParams,
  overrideSetParams,
  policyStateSetParams,
} from '../src/model/team-governance.js'
import { createTeamRemoteClient } from '../src/transport/team-remote-client.js'
import type { TeamRpcCarrier, TeamRpcResult } from '../src/transport/host-seams.js'

interface CallRecord {
  readonly endpoint: string
  readonly payload: unknown
}

/** One scripted carrier: records every call, answers with a fixed result. */
function makeCarrier(answer: () => TeamRpcResult) {
  const calls: CallRecord[] = []
  const carrier: TeamRpcCarrier = {
    call: async (channel, endpoint, payload) => {
      if (channel !== REMOTE_RPC_CHANNEL) {
        throw new Error(`categories test: unexpected channel ${String(channel)}`)
      }
      calls.push({ endpoint, payload })
      return answer()
    },
  }
  return { carrier, calls }
}

function errorEnvelope(code: string, message: string, method: string): RemoteResponse {
  return buildRemoteError(code, message, {
    method,
    endpoint: method,
    contractVersion: REMOTE_CONTRACT_VERSION,
    requestToken: null,
  })
}

function successEnvelope(value: object, method: string): RemoteResponse {
  return buildRemoteSuccess(value, {
    method,
    endpoint: method,
    contractVersion: REMOTE_CONTRACT_VERSION,
    requestToken: null,
  })
}

/** Capture one awaited call: `{ response?, caught? }` — exactly one set. */
async function capture(
  run: () => Promise<RemoteResponse>,
): Promise<{ readonly response?: RemoteResponse; readonly caught?: unknown }> {
  try {
    return { response: await run() }
  } catch (error) {
    return { caught: error }
  }
}

// ---------------------------------------------------------------------------
// Module-level scenarios
// ---------------------------------------------------------------------------

const overrideSetScenario = await (async () => {
  const params = overrideSetParams('team-1', 'permissions', { kind: 'deny' }, 'instance', 'inst-1')
  const { carrier, calls } = makeCarrier(() =>
    errorEnvelope('malformed-params', 'override.set: the value cell is outside the closed set', 'override.set'),
  )
  const client = createTeamRemoteClient(carrier)
  const result = await capture(() => client.overrideSet(params))
  return { calls, result, params }
})()

const policyStateSetScenario = await (async () => {
  const params = policyStateSetParams('team-1', 's-1', {
    permissions: { value: { kind: 'deny' } },
  })
  const { carrier, calls } = makeCarrier(() =>
    errorEnvelope('malformed-params', 'policyState.set: cell permissions is outside the closed set', 'policyState.set'),
  )
  const client = createTeamRemoteClient(carrier)
  const result = await capture(() => client.policyStateSet(params))
  return { calls, result, params }
})()

const compatibilityReprobeScenario = await (async () => {
  const params = compatibilityReprobeParams('team-1', 'CAPABILITY_GENERATION_CHANGE')
  const { carrier, calls } = makeCarrier(() =>
    errorEnvelope('internal-error', 'compatibility.reprobe: the backing probe lane is unavailable', 'compatibility.reprobe'),
  )
  const client = createTeamRemoteClient(carrier)
  const result = await capture(() => client.compatibilityReprobe(params))
  return { calls, result, params }
})()

const overrideGetSuccessScenario = await (async () => {
  const params = overrideGetParams('team-1', 'permissions')
  // The `override.get` success value (UI §19 wire): null = no override.
  const value = { override: null }
  const { carrier, calls } = makeCarrier(() => successEnvelope(value, 'override.get'))
  const client = createTeamRemoteClient(carrier)
  const result = await capture(() => client.overrideGet(params))
  return { calls, result, params, value }
})()

const transportLossScenario = await (async () => {
  const { carrier, calls } = makeCarrier(() => {
    throw new Error('carrier channel torn down')
  })
  const client = createTeamRemoteClient(carrier)
  const result = await capture(() =>
    client.compatibilityAck(compatibilityAckParams('team-1', 'req-1', 'human-team-1')),
  )
  return { calls, result }
})()

// ---------------------------------------------------------------------------
// Assertions
// ---------------------------------------------------------------------------

describe('P9-T10 (P9-S7) command flows — override / policyState / compatibility', () => {
  it('override.set: the typed error resolves intact (code + message verbatim, never rejects)', () => {
    const { calls, result, params } = overrideSetScenario
    expect(result.caught).toBe(undefined)
    const response = result.response
    if (response === undefined) throw new Error('missing: response')
    expect(response.ok).toBe(false)
    if (response.ok) throw new Error('unreachable: success arm')
    expect(response.error.code).toBe('malformed-params')
    expect(response.error.message).toBe('override.set: the value cell is outside the closed set')
    expect(calls.length).toBe(1)
    const call = calls[0]
    if (call === undefined) throw new Error('missing: call')
    expect(call.endpoint).toBe('override.set')
    expect((call.payload as { params: unknown }).params).toEqual(params)
  })

  it('policyState.set: the typed error resolves intact (the frozen block is preserved)', () => {
    const { calls, result, params } = policyStateSetScenario
    expect(result.caught).toBe(undefined)
    const response = result.response
    if (response === undefined) throw new Error('missing: response')
    expect(response.ok).toBe(false)
    if (response.ok) throw new Error('unreachable: success arm')
    expect(response.error.code).toBe('malformed-params')
    expect(response.error.message).toBe('policyState.set: cell permissions is outside the closed set')
    const call = calls[0]
    if (call === undefined) throw new Error('missing: call')
    expect(call.endpoint).toBe('policyState.set')
    expect((call.payload as { params: unknown }).params).toEqual(params)
  })

  it('compatibility.reprobe: the typed error resolves intact (backing codes pass through)', () => {
    const { calls, result, params } = compatibilityReprobeScenario
    expect(result.caught).toBe(undefined)
    const response = result.response
    if (response === undefined) throw new Error('missing: response')
    expect(response.ok).toBe(false)
    if (response.ok) throw new Error('unreachable: success arm')
    expect(response.error.code).toBe('internal-error')
    expect(response.error.message).toBe('compatibility.reprobe: the backing probe lane is unavailable')
    expect(response.error.details.method).toBe('compatibility.reprobe')
    expect(response.error.details.contractVersion).toBe(REMOTE_CONTRACT_VERSION)
    const call = calls[0]
    if (call === undefined) throw new Error('missing: call')
    expect(call.endpoint).toBe('compatibility.reprobe')
    expect((call.payload as { params: unknown }).params).toEqual(params)
  })

  it('override.get: the success value + provenance pass through intact (no re-wrap)', () => {
    const { calls, result, params, value } = overrideGetSuccessScenario
    expect(result.caught).toBe(undefined)
    const response = result.response
    if (response === undefined) throw new Error('missing: response')
    expect(response.ok).toBe(true)
    if (!response.ok) throw new Error('unreachable: error arm')
    expect(response.value.data).toEqual(value)
    expect(response.value.provenance.method).toBe('override.get')
    expect(response.value.provenance.contractVersion).toBe(REMOTE_CONTRACT_VERSION)
    const call = calls[0]
    if (call === undefined) throw new Error('missing: call')
    expect(call.endpoint).toBe('override.get')
    expect((call.payload as { params: unknown }).params).toEqual(params)
  })

  it('a transport rejection rejects with the frozen PushTransportLossError (the only rejection kind)', () => {
    const { result } = transportLossScenario
    expect(result.response).toBe(undefined)
    expect(result.caught instanceof PushTransportLossError).toBe(true)
  })
})
