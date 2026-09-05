/**
 * tcm-m1-s6-v2-routing.test.ts — TCM M1 (plan §15.3/§15.6): version
 * routing at the S6 PRODUCTION dispatcher site (the async mirror of the
 * pure remote dispatcher).
 *
 * The dispatcher under test is the REAL production one
 * (`createS6RemoteDispatcher`): the shared version-aware param parser
 * (closed per-version field sets), the frozen seven invariants, and the
 * shared backing-code allow-list (REMOTE_BACKING_ERROR_CODE_SET — the
 * seven TCM team-create v2 codes ride through BOTH dispatchers from the
 * single definition). Only the backing ports are simulated (the same
 * pattern as t12h4-s6-fail-closed): the principal derivation is a
 * trip-wire — the methods under test carry no claim.
 *
 * Covers:
 *  - a v1 request to the v2-only `team.admitInitialWork` → typed
 *    `method-version-unsupported` AFTER the envelope parse (details echo
 *    the request's own v1 version);
 *  - a v2 request to a v1 method (`team.getProjection`) → success with
 *    provenance echoing contractVersion 2;
 *  - a v2 `team.create` WITH `workspace` → parsed under the v2 schema
 *    (no `malformed-params`): the pre-G1 production behavior serves it
 *    through the v1 team-create port WITHOUT `initialWork` (the v2
 *    `workspace` field is accepted at the wire and ignored pre-G1 — G1
 *    wires the workspace-aware port); the v1 `team.create` request keeps
 *    byte-compatible behavior (the `initialWork` fourth argument is
 *    delivered to the v1 port verbatim);
 *  - a v2 `team.admitInitialWork` → fail-closed `internal-error` pre-G1
 *    (no handler case yet: the TEAM category handler's unknown-method
 *    tripwire is untyped — invariant 5; G1 adds the v2 port + case).
 *
 * Test pattern of this repo (the plain-node shim's `it` is synchronous):
 * every async scenario runs at MODULE level (top-level await) and
 * captures its results; the `it` bodies are pure synchronous assertions.
 *
 * Matchers: toBe/toEqual/toBeGreaterThan (+.not) only.
 *
 * @module @dsh-agent-team/runtime/test/tcm-m1-s6-v2-routing
 */

import { describe, expect, it } from 'vitest'

import { createS6RemoteDispatcher } from '../src/plugin/s6-remote.js'
import type { S6RemotePorts } from '../src/plugin/s6-remote.js'
import type { ServerPrincipalDerivation } from '../src/plugin/types.js'
import {
  REMOTE_CONTRACT_ERROR_CODES,
  REMOTE_CONTRACT_VERSION,
  REMOTE_CONTRACT_VERSION_V2,
} from '../../remote/src/index.js'
import type { RemoteResponse } from '../../remote/src/index.js'

const ROOT_SID = 'root-session-tcm-m1-s6'
const BP_ID = 'BP-TCM-M1-S6'
const WORKSPACE = '/w/proj-tcm-m1-s6'
const TOKEN = 'tok-tcm-m1-s6'
const PROMPT = 'the initial work'

/** A valid whole-projection record (all REMOTE_PROJECTION_FIELDS). */
const PROJECTION: Record<string, unknown> = {
  schemaVersion: 1,
  teamSessionId: ROOT_SID,
  blueprint: { blueprintId: BP_ID, revision: 1 },
  generation: 4,
  generatedAt: '2026-09-05T00:00:04.000Z',
  root: { rootSessionId: ROOT_SID },
  templates: [],
  members: [],
  ledger: {
    latestSequence: 0,
    totalEntries: 0,
    byCategory: {},
    pendingControlCount: 0,
  },
}

/** Extract the typed error part of a resolved error envelope (asserts the invariant-7 shape). */
function errorOf(response: RemoteResponse): Record<string, unknown> {
  if (response.ok) throw new Error('TCM-M1 guard: expected an error result')
  return response.error as unknown as Record<string, unknown>
}

/** Extract the success data part of a resolved success envelope. */
function dataOf(response: RemoteResponse): Record<string, unknown> {
  if (!response.ok) throw new Error('TCM-M1 guard: expected a success result')
  return response.value.data as Record<string, unknown>
}

// Module level (top-level await): drive the REAL production dispatcher
// over the fake ports and capture every scenario result.
const M1 = await (async () => {
  // The trip-wire principal: the methods under test must never derive.
  const noPrincipal: ServerPrincipalDerivation = () => {
    throw new Error('TCM-M1 guard: principal derivation must not run for these methods')
  }

  // Recording v1 team-create port (the frozen 4-arg extension) + a valid
  // projection port.
  const createCalls: Array<[string, string, number | undefined, Record<string, unknown> | undefined]> = []
  const ports = {
    teamCreate: {
      create(
        rootSessionId: string,
        blueprintId: string,
        blueprintRevision: number | undefined,
        initialWork?: Record<string, unknown>,
      ) {
        createCalls.push([rootSessionId, blueprintId, blueprintRevision, initialWork])
        return Promise.resolve({
          path: 'fresh-root',
          durable: { rootSessionId },
          bind: { rootSessionId, blueprintId },
        })
      },
    },
    projection: {
      project(teamSessionId: string) {
        return Promise.resolve({ ...PROJECTION, teamSessionId })
      },
    },
  } as unknown as S6RemotePorts

  const dispatch = createS6RemoteDispatcher(ports, noPrincipal)

  // (1) v1 → the v2-only method: typed after the envelope parse.
  const v1ToV2Only = await dispatch('team.admitInitialWork', {
    version: REMOTE_CONTRACT_VERSION,
    params: { rootSessionId: ROOT_SID, requestToken: TOKEN, prompt: PROMPT },
  })

  // (2) v2 → a v1 method: legal, provenance echoes version 2.
  const v2GetProjection = await dispatch('team.getProjection', {
    version: REMOTE_CONTRACT_VERSION_V2,
    params: { teamSessionId: ROOT_SID },
  })

  // (3) v2 team.create WITH workspace: parsed under the v2 schema (no
  // malformed-params); pre-G1 it is served through the v1 port WITHOUT
  // initialWork (the workspace field is accepted at the wire, ignored
  // pre-G1 — G1 wires the workspace-aware port).
  const v2CreateWithWorkspace = await dispatch('team.create', {
    version: REMOTE_CONTRACT_VERSION_V2,
    params: { rootSessionId: ROOT_SID, blueprintId: BP_ID, workspace: WORKSPACE },
  })

  // (4) v1 team.create with initialWork: byte-compatible v1 behavior at
  // the production site (the fourth argument rides to the v1 port).
  const v1CreateWithWork = await dispatch('team.create', {
    version: REMOTE_CONTRACT_VERSION,
    params: {
      rootSessionId: ROOT_SID,
      blueprintId: BP_ID,
      initialWork: { prompt: PROMPT },
    },
  })

  // (5) v2 team.admitInitialWork: fail-closed pre-G1 (no handler case —
  // the TEAM category's unknown-method tripwire is untyped → invariant 5).
  const v2AdmitPreG1 = await dispatch('team.admitInitialWork', {
    version: REMOTE_CONTRACT_VERSION_V2,
    params: { rootSessionId: ROOT_SID, requestToken: TOKEN, prompt: PROMPT },
  })

  return {
    createCalls,
    v1ToV2Only,
    v2GetProjection,
    v2CreateWithWorkspace,
    v1CreateWithWork,
    v2AdmitPreG1,
  }
})()

describe('TCM M1: the S6 production dispatcher routes by request version (plan §15.3)', () => {
  it('a v1 request to the v2-only team.admitInitialWork → method-version-unsupported (typed after envelope parse)', () => {
    const error = errorOf(M1.v1ToV2Only)
    expect(error['code']).toBe(REMOTE_CONTRACT_ERROR_CODES.METHOD_VERSION_UNSUPPORTED)
    expect(error['code']).toBe('method-version-unsupported')
    const details = error['details'] as Record<string, unknown>
    expect(details['method']).toBe('team.admitInitialWork')
    expect(details['endpoint']).toBe('team.admitInitialWork')
    // The envelope parsed — the provenance context carries the request's
    // own (v1) version.
    expect(details['contractVersion']).toBe(REMOTE_CONTRACT_VERSION)
    expect(details['field']).toBe('method')
    expect(details['reason']).toBe('method-not-available-in-version')
  })

  it('a v2 request to a v1 method (team.getProjection) → success with provenance contractVersion 2', () => {
    expect(M1.v2GetProjection.ok).toBe(true)
    if (!M1.v2GetProjection.ok) throw new Error('TCM-M1 guard: expected success')
    expect(M1.v2GetProjection.value.provenance.contractVersion).toBe(REMOTE_CONTRACT_VERSION_V2)
    expect(M1.v2GetProjection.value.provenance.method).toBe('team.getProjection')
    const data = dataOf(M1.v2GetProjection)
    expect((data['projection'] as Record<string, unknown>)['teamSessionId']).toBe(ROOT_SID)
  })

  it('a v2 team.create WITH workspace parses under the v2 schema (no malformed-params; served v1-style pre-G1)', () => {
    expect(M1.v2CreateWithWorkspace.ok).toBe(true)
    if (!M1.v2CreateWithWorkspace.ok) throw new Error('TCM-M1 guard: expected success')
    const data = dataOf(M1.v2CreateWithWorkspace)
    expect(Object.keys(data).sort()).toEqual(['bind', 'durable', 'path'])
    expect(data['path']).toBe('fresh-root')
    expect(M1.v2CreateWithWorkspace.value.provenance.contractVersion).toBe(REMOTE_CONTRACT_VERSION_V2)
    // The v1 port received the parsed v2 request WITHOUT initialWork
    // (absent in the v2 closed set) — no crash, no malformed-params.
    expect(M1.createCalls.length).toBe(2)
    expect(M1.createCalls[0]).toEqual([ROOT_SID, BP_ID, undefined, undefined])
  })

  it('a v1 team.create keeps byte-compatible behavior (initialWork rides to the v1 port, provenance 1)', () => {
    expect(M1.v1CreateWithWork.ok).toBe(true)
    if (!M1.v1CreateWithWork.ok) throw new Error('TCM-M1 guard: expected success')
    expect(M1.v1CreateWithWork.value.provenance.contractVersion).toBe(REMOTE_CONTRACT_VERSION)
    expect(M1.createCalls.length).toBe(2)
    expect(M1.createCalls[1]).toEqual([ROOT_SID, BP_ID, undefined, { prompt: PROMPT }])
  })

  it('a v2 team.admitInitialWork fails closed pre-G1 (internal-error, no new wire code)', () => {
    const error = errorOf(M1.v2AdmitPreG1)
    expect(error['code']).toBe(REMOTE_CONTRACT_ERROR_CODES.INTERNAL_ERROR)
    expect(error['message']).toBe('internal error in remote handler')
    const details = error['details'] as Record<string, unknown>
    expect(details['contractVersion']).toBe(REMOTE_CONTRACT_VERSION_V2)
    expect(details['reason']).toBe('untyped-error')
  })
})
