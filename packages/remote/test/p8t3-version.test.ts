/**
 * p8t3-version.test.ts — P8-T3 mandatory test 4: VERSION MISMATCH +
 * unknown endpoint + malformed envelope (brief §91; design note §6
 * invariants 1/2/3).
 *
 *  - an unsupported/unknown contract version → typed
 *    `contract-version-unsupported` (a positive integer OUTSIDE the
 *    supported set) — never a handler throw;
 *  - a non-integer / missing version → typed `malformed-request`;
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

import { expectError, makeDispatcher, p8t3Wire, P8T3_TEAM_SESSION_ID } from './p8t3-helpers.js'
import {
  REMOTE_CONTRACT_VERSION,
  REMOTE_CONTRACT_ERROR_CODES,
} from '../src/index.js'

// Module level (top-level await): drive the real dispatcher over the fake
// ports and capture every negative scenario result.
const RT = await (async () => {
  const { dispatch } = makeDispatcher()

  const version2 = await dispatch('catalog.list', { version: 2, params: {} })
  const version99 = await dispatch('team.getProjection', {
    version: 99,
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
    version99,
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

describe('P8-T3 version mismatch + envelope negatives', () => {
  it('an unsupported contract version (2) → contract-version-unsupported, no throw', () => {
    const error = expectError(RT.version2)
    expect(error.error.code).toBe(REMOTE_CONTRACT_ERROR_CODES.CONTRACT_VERSION_UNSUPPORTED)
    expect(error.error.code).toBe('contract-version-unsupported')
    const details = error.error.details as unknown as Record<string, unknown>
    expect(details['method']).toBe('catalog.list')
    expect(details['endpoint']).toBe('catalog.list')
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
