/**
 * p8t3-version.test.ts — P8-T3 mandatory test 4: VERSION MISMATCH +
 * unknown endpoint + malformed envelope (brief §91; design note §6
 * invariants 1/2/3) — UPDATED for the TCM vNext §15.3 versioned contract
 * (supported set = {1, 2, 3} since the D1 Team-D1-D6-repair-v2 v3 bump):
 *
 *  - a SUPPORTED version (1, 2, 3, or 4 — since the F9 repair bump)
 *    routes the request: a v2 request to a v1-legal method succeeds with
 *    provenance echoing version 2, and a v4 request succeeds with
 *    provenance echoing version 4;
 *  - an unsupported contract version → typed
 *    `contract-version-unsupported` (a positive integer OUTSIDE the
 *    supported set, e.g. 5 — the pin moved from 4 after the F9 bump) —
 *    never a handler throw;
 *  - a non-integer / missing version → typed `malformed-request`;
 *  - a v1 request to the v2-only `team.admitInitialWork` method → typed
 *    `method-version-unsupported` (checked in the version-aware param
 *    parser, AFTER the envelope parse — TCM vNext §15.3);
 *  - an unknown endpoint → typed `unknown-method`, checked BEFORE the
 *    envelope (so even a garbage payload reports `unknown-method`);
 *  - a malformed envelope on a known endpoint → typed `malformed-request`
 *    (missing params, unknown top-level field, non-record payload,
 *    non-lossless params) or `malformed-params` (unknown method field).
 *
 * Every case RESOLVES to an error result; the promise never rejects
 * (invariant 7).
 *
 * Test pattern of this repo (the plain-node shim's `it` is synchronous):
 * every async scenario runs at MODULE level (top-level await) and captures
 * its results; the `it` bodies are pure synchronous assertions.
 *
 * Matchers: toBe/toEqual/toBeGreaterThan (+.not) only.
 */

import { describe, expect, it } from 'vitest'

import { expectError, makeDispatcher, p8t3Wire, p8t3WireV2, p8t3WireV4, P8T3_TEAM_SESSION_ID } from './p8t3-helpers.js'
import {
  REMOTE_CONTRACT_VERSION,
  REMOTE_CONTRACT_VERSION_V2,
  REMOTE_CONTRACT_VERSION_V4,
  REMOTE_CONTRACT_ERROR_CODES,
} from '../src/index.js'

// Module level (top-level await): drive the real dispatcher over the fake
// ports and capture every scenario result.
const RT = await (async () => {
  const { dispatch } = makeDispatcher()

  // TCM vNext §15.3: version 2 is now SUPPORTED — a v2 request to a
  // v1-legal method succeeds with provenance echoing the request version.
  const version2 = await dispatch('catalog.list', p8t3WireV2({}))
  // F9 (contract v4): version 4 is now SUPPORTED — a v4 request to a
  // v1-legal method succeeds with provenance echoing the request version.
  const version4 = await dispatch('catalog.list', p8t3WireV4({}))
  // A v1 request to the v2-only method: typed after the envelope parse.
  const v1ToV2OnlyMethod = await dispatch(
    'team.admitInitialWork',
    p8t3Wire({
      rootSessionId: 'root-session-p8t3-v2',
      requestToken: 'tok-p8t3-v2',
      prompt: 'the initial work',
    }),
  )
  const version99 = await dispatch('team.getProjection', {
    version: 99,
    params: { teamSessionId: P8T3_TEAM_SESSION_ID },
  })
  // A future version outside the closed supported set {1, 2, 3, 4} (TCM
  // vNext §15.3: the unsupported-version negative was pinned at 4 since
  // the D1 Team-D1-D6-repair-v2 v3 bump admitted contract version 3; the
  // F9 repair bump admitted contract version 4, so the pin moves to 5).
  const version5 = await dispatch('team.getProjection', {
    version: 5,
    params: { teamSessionId: P8T3_TEAM_SESSION_ID },
  })
  const version15 = await dispatch('catalog.list', { version: 1.5, params: {} })
  const versionString = await dispatch('catalog.list', { version: '1', params: {} })
  const versionMissing = await dispatch('catalog.list', { params: {} })
  // Garbage envelope: the endpoint check happens BEFORE the envelope.
  const unknownEndpointGarbage = await dispatch('nope.notInCatalog', {
    version: 'garbage',
    params: null,
  })
  const unknownEndpointValidPayload = await dispatch(
    'team.getProjections',
    p8t3Wire({ teamSessionId: P8T3_TEAM_SESSION_ID }),
  )
  const paramsMissing = await dispatch('catalog.list', { version: 1 })
  const extraField = await dispatch('catalog.list', {
    version: 1,
    params: {},
    extra: 'x',
  })
  const payloadString = await dispatch('catalog.list', 'not an object')
  const payloadNull = await dispatch('catalog.list', null)
  const payloadArray = await dispatch('catalog.list', [1, 2])
  const paramsNaN = await dispatch('catalog.list', { version: 1, params: { nan: Number.NaN } })
  // catalog.list has an EMPTY closed field set: any key is unknown.
  const unknownMethodField = await dispatch('catalog.list', p8t3Wire({ bogus: 1 }))
  // team.getLedgerPage requires teamSessionId.
  const missingRequiredField = await dispatch('team.getLedgerPage', p8t3Wire({ limit: 5 }))

  return {
    version2,
    version4,
    v1ToV2OnlyMethod,
    version99,
    version5,
    version15,
    versionString,
    versionMissing,
    unknownEndpointGarbage,
    unknownEndpointValidPayload,
    paramsMissing,
    extraField,
    payloadString,
    payloadNull,
    payloadArray,
    paramsNaN,
    unknownMethodField,
    missingRequiredField,
  }
})()

describe('P8-T3 version mismatch + envelope negatives (versioned contract, TCM vNext §15.3)', () => {
  it('a supported v2 request to a v1-legal method → success, provenance echoes version 2', () => {
    const success = RT.version2
    expect(success.ok).toBe(true)
    if (!success.ok) throw new Error('expected a success result')
    expect(success.value.provenance.contractVersion).toBe(REMOTE_CONTRACT_VERSION_V2)
    expect(success.value.provenance.method).toBe('catalog.list')
    expect(success.value.provenance.endpoint).toBe('catalog.list')
  })

  it('a supported v4 request to a v1-legal method → success, provenance echoes version 4 (F9 bump)', () => {
    const success = RT.version4
    expect(success.ok).toBe(true)
    if (!success.ok) throw new Error('expected a success result')
    expect(success.value.provenance.contractVersion).toBe(REMOTE_CONTRACT_VERSION_V4)
    expect(success.value.provenance.method).toBe('catalog.list')
    expect(success.value.provenance.endpoint).toBe('catalog.list')
  })

  it('a v1 request to the v2-only team.admitInitialWork → method-version-unsupported (typed after envelope parse)', () => {
    const error = expectError(RT.v1ToV2OnlyMethod)
    expect(error.error.code).toBe(REMOTE_CONTRACT_ERROR_CODES.METHOD_VERSION_UNSUPPORTED)
    expect(error.error.code).toBe('method-version-unsupported')
    const details = error.error.details as unknown as Record<string, unknown>
    expect(details['method']).toBe('team.admitInitialWork')
    expect(details['endpoint']).toBe('team.admitInitialWork')
    // The envelope parsed — the provenance context carries the request's
    // own (v1) version, not the constant.
    expect(details['contractVersion']).toBe(REMOTE_CONTRACT_VERSION)
    expect(details['field']).toBe('method')
    expect(details['reason']).toBe('method-not-available-in-version')
    expect(typeof error.error.message).toBe('string')
    expect(error.error.message.length).toBeGreaterThan(0)
  })

  it('an unsupported contract version (5) → contract-version-unsupported, no throw', () => {
    const error = expectError(RT.version5)
    expect(error.error.code).toBe(REMOTE_CONTRACT_ERROR_CODES.CONTRACT_VERSION_UNSUPPORTED)
    expect(error.error.code).toBe('contract-version-unsupported')
    const details = error.error.details as unknown as Record<string, unknown>
    expect(details['method']).toBe('team.getProjection')
    expect(details['endpoint']).toBe('team.getProjection')
    // The served version is the constant (the request never got far
    // enough to change the provenance context).
    expect(details['contractVersion']).toBe(REMOTE_CONTRACT_VERSION)
    expect(details['field']).toBe('version')
    expect(typeof error.error.message).toBe('string')
    expect(error.error.message.length).toBeGreaterThan(0)
  })

  it('a future version (99) is equally unsupported (closed supported set)', () => {
    const error = expectError(RT.version99)
    expect(error.error.code).toBe('contract-version-unsupported')
  })

  it('a non-positive-integer version (1.5) → malformed-request', () => {
    const error = expectError(RT.version15)
    expect(error.error.code).toBe(REMOTE_CONTRACT_ERROR_CODES.MALFORMED_REQUEST)
    const details = error.error.details as unknown as Record<string, unknown>
    expect(details['field']).toBe('version')
  })

  it('a string version → malformed-request', () => {
    const error = expectError(RT.versionString)
    expect(error.error.code).toBe('malformed-request')
  })

  it('a missing version → malformed-request (field: version)', () => {
    const error = expectError(RT.versionMissing)
    expect(error.error.code).toBe('malformed-request')
    const details = error.error.details as unknown as Record<string, unknown>
    expect(details['field']).toBe('version')
  })

  it('an unknown endpoint → unknown-method, even with a garbage payload (invariant 1)', () => {
    const error = expectError(RT.unknownEndpointGarbage)
    expect(error.error.code).toBe(REMOTE_CONTRACT_ERROR_CODES.UNKNOWN_METHOD)
    expect(error.error.code).toBe('unknown-method')
    const details = error.error.details as unknown as Record<string, unknown>
    expect(details['method']).toBe('nope.notInCatalog')
    expect(details['endpoint']).toBe('nope.notInCatalog')
    expect(details['reason']).toBe('unknown-endpoint')
  })

  it('an unknown endpoint with a fully valid-looking payload → still unknown-method', () => {
    const error = expectError(RT.unknownEndpointValidPayload)
    expect(error.error.code).toBe('unknown-method')
  })

  it('a missing params on a known endpoint → malformed-request (field: params)', () => {
    const error = expectError(RT.paramsMissing)
    expect(error.error.code).toBe('malformed-request')
    const details = error.error.details as unknown as Record<string, unknown>
    expect(details['field']).toBe('params')
  })

  it('an unknown top-level envelope field → malformed-request (closed envelope)', () => {
    const error = expectError(RT.extraField)
    expect(error.error.code).toBe('malformed-request')
    const details = error.error.details as unknown as Record<string, unknown>
    expect(details['field']).toBe('extra')
  })

  it('a non-record payload → malformed-request', () => {
    expect(expectError(RT.payloadString).error.code).toBe('malformed-request')
    expect(expectError(RT.payloadNull).error.code).toBe('malformed-request')
    expect(expectError(RT.payloadArray).error.code).toBe('malformed-request')
  })

  it('non-lossless params (NaN) → internal-error (boundary integrity)', () => {
    const error = expectError(RT.paramsNaN)
    expect(error.error.code).toBe(REMOTE_CONTRACT_ERROR_CODES.INTERNAL_ERROR)
    expect(JSON.stringify(error.error).includes('NaN')).toBe(false)
  })

  it('an unknown method field → malformed-params (field: the field)', () => {
    const error = expectError(RT.unknownMethodField)
    expect(error.error.code).toBe(REMOTE_CONTRACT_ERROR_CODES.MALFORMED_PARAMS)
    expect(error.error.code).toBe('malformed-params')
    const details = error.error.details as unknown as Record<string, unknown>
    expect(details['field']).toBe('bogus')
    expect(details['method']).toBe('catalog.list')
    expect(details['reason']).toBe('unknown-field')
  })

  it('a missing required method field → malformed-params (reason: missing-required)', () => {
    const error = expectError(RT.missingRequiredField)
    expect(error.error.code).toBe('malformed-params')
    const details = error.error.details as unknown as Record<string, unknown>
    expect(details['field']).toBe('teamSessionId')
    expect(details['reason']).toBe('missing-required')
  })
})
