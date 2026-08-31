/**
 * p8t3-invalid-ids.test.ts — P8-T3 mandatory test 2: INVALID IDs (brief
 * §89; design note D-3).
 *
 * Malformed TeamSessionId / InstanceId / TemplateId / BlueprintId inputs
 * are rejected by the LOCAL mirror of the frozen P3 ID rule and surface at
 * the remote boundary as TYPED errors carrying the EXACT frozen P3 code
 * values (never a throw, never a generic failure):
 *
 *   TeamSessionId  → INVALID_ROOT_SESSION_ID   (invariant 9: a
 *                      TeamSessionId IS a RootSessionId)
 *   InstanceId     → INVALID_INSTANCE_ID
 *   TemplateId     → INVALID_TEMPLATE_ID
 *   BlueprintId    → INVALID_BLUEPRINT_ID
 *
 * Test pattern of this repo (the plain-node shim's `it` is synchronous):
 * every async scenario runs at MODULE level (top-level await) and captures
 * its results; the `it` bodies are pure synchronous assertions.
 *
 * Matchers: toBe/toEqual/toBeGreaterThan (+.not) only.
 */

import { describe, expect, it } from 'vitest'

import {
  expectError,
  makeDispatcher,
  p8t3Wire,
  P8T3_BLUEPRINT_ID,
  P8T3_REQUEST_TOKEN,
  P8T3_TEAM_SESSION_ID,
  P8T3_TEMPLATE_ID,
} from './p8t3-helpers.js'
import { REMOTE_CONTRACT_VERSION } from '../src/index.js'

/** The exact frozen P3 ID error codes mirrored onto the remote wire. */
const FROZEN = {
  TEAM_SESSION: 'INVALID_ROOT_SESSION_ID',
  INSTANCE: 'INVALID_INSTANCE_ID',
  TEMPLATE: 'INVALID_TEMPLATE_ID',
  BLUEPRINT: 'INVALID_BLUEPRINT_ID',
} as const

// Module level (top-level await): drive the real dispatcher over the fake
// ports and capture every scenario result for the synchronous assertions.
const RT = await (async () => {
  const whitespace = makeDispatcher()
  const teamSessionWhitespace = await whitespace.dispatch(
    'team.getProjection',
    p8t3Wire({ teamSessionId: 'root 1' }),
  )

  const control = makeDispatcher()
  const teamSessionControl = await control.dispatch(
    'team.getProjection',
    p8t3Wire({ teamSessionId: 'root\u00011' }),
  )

  const empty = makeDispatcher()
  const teamSessionEmpty = await empty.dispatch(
    'team.getProjection',
    p8t3Wire({ teamSessionId: '' }),
  )

  const overlong = makeDispatcher()
  const teamSessionOverlong = await overlong.dispatch(
    'team.getProjection',
    p8t3Wire({ teamSessionId: 'r'.repeat(256) }),
  )

  const instanceCaller = makeDispatcher()
  const malformedInstanceCaller = await instanceCaller.dispatch(
    'member.create',
    p8t3Wire({
      teamSessionId: P8T3_TEAM_SESSION_ID,
      caller: { kind: 'instance', instanceId: 'inst 1' },
      requestToken: P8T3_REQUEST_TOKEN,
    }),
  )

  const template = makeDispatcher()
  const malformedTemplate = await template.dispatch(
    'member.create',
    p8t3Wire({
      teamSessionId: P8T3_TEAM_SESSION_ID,
      caller: { kind: 'human', humanId: 'h-1' },
      requestToken: P8T3_REQUEST_TOKEN,
      delegationTemplateId: `${P8T3_TEMPLATE_ID} x`,
    }),
  )

  const blueprint = makeDispatcher()
  const malformedBlueprint = await blueprint.dispatch(
    'catalog.get',
    p8t3Wire({ blueprintId: `${P8T3_BLUEPRINT_ID}\u007f` }),
  )

  const attribution = makeDispatcher()
  const attributionResponse = await attribution.dispatch(
    'team.getProjection',
    p8t3Wire({ teamSessionId: 'root 1' }),
  )

  const boundary = makeDispatcher()
  const boundary255 = await boundary.dispatch(
    'team.getProjection',
    p8t3Wire({ teamSessionId: 'r'.repeat(255) }),
  )

  return {
    teamSessionWhitespace,
    teamSessionControl,
    teamSessionEmpty,
    teamSessionOverlong,
    malformedInstanceCaller,
    malformedTemplate,
    malformedBlueprint,
    attributionResponse,
    boundary255,
    boundaryCalls: boundary.ports.calls,
  }
})()

describe('P8-T3 invalid IDs: malformed inputs → exact frozen P3 codes', () => {
  it('a TeamSessionId with whitespace → INVALID_ROOT_SESSION_ID', () => {
    const error = expectError(RT.teamSessionWhitespace)
    expect(error.error.code).toBe(FROZEN.TEAM_SESSION)
  })

  it('a TeamSessionId with an ASCII control char → INVALID_ROOT_SESSION_ID', () => {
    const error = expectError(RT.teamSessionControl)
    expect(error.error.code).toBe(FROZEN.TEAM_SESSION)
  })

  it('an empty TeamSessionId → INVALID_ROOT_SESSION_ID', () => {
    const error = expectError(RT.teamSessionEmpty)
    expect(error.error.code).toBe(FROZEN.TEAM_SESSION)
  })

  it('an over-long (>255 chars) TeamSessionId → INVALID_ROOT_SESSION_ID', () => {
    const error = expectError(RT.teamSessionOverlong)
    expect(error.error.code).toBe(FROZEN.TEAM_SESSION)
  })

  it('a malformed instance id (member caller) → INVALID_INSTANCE_ID', () => {
    const error = expectError(RT.malformedInstanceCaller)
    expect(error.error.code).toBe(FROZEN.INSTANCE)
  })

  it('a malformed template id (delegation) → INVALID_TEMPLATE_ID', () => {
    const error = expectError(RT.malformedTemplate)
    expect(error.error.code).toBe(FROZEN.TEMPLATE)
  })

  it('a malformed blueprint id → INVALID_BLUEPRINT_ID', () => {
    const error = expectError(RT.malformedBlueprint)
    expect(error.error.code).toBe(FROZEN.BLUEPRINT)
  })

  it('the ID error carries the provenance-folded details (G8 attribution)', () => {
    const error = expectError(RT.attributionResponse)
    const details = error.error.details as unknown as Record<string, unknown>
    expect(details['method']).toBe('team.getProjection')
    expect(details['endpoint']).toBe('team.getProjection')
    expect(details['contractVersion']).toBe(REMOTE_CONTRACT_VERSION)
    // The request failed before any token parse: the echo stays null.
    expect(details['requestToken']).toBe(null)
    // The failing field is attributed.
    expect(details['field']).toBe('teamSessionId')
    expect(Object.prototype.hasOwnProperty.call(details, 'field')).toBe(true)
    // The message is wire-safe: it names the rule, never a stack.
    expect(typeof error.error.message).toBe('string')
    expect(error.error.message.length).toBeGreaterThan(0)
  })

  it('a valid 255-char TeamSessionId is ACCEPTED (boundary exactness)', () => {
    // The boundary is exactly 255: 255 passes (the fake port serves it).
    expect(RT.boundary255.ok).toBe(true)
    expect(RT.boundaryCalls).toEqual(['team.getProjection'])
  })
})
