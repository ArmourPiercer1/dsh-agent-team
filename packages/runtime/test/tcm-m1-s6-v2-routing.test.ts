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
 * Covers (G1 — the production wiring the M1 comments anticipated):
 *  - a v1 request to the v2-only `team.admitInitialWork` → typed
 *    `method-version-unsupported` AFTER the envelope parse (details echo
 *    the request's own v1 version);
 *  - a v2 request to a v1 method (`team.getProjection`) → success with
 *    provenance echoing contractVersion 2;
 *  - a v2 `team.create` WITH `workspace` → parsed under the v2 schema
 *    (no `malformed-params`) and served through the v2 workspace-aware
 *    team-create port (the `workspace` fourth argument rides to the port
 *    verbatim — the G1-wired `teamCreateV2`); the v1 `team.create`
 *    request keeps byte-compatible behavior (the `initialWork` fourth
 *    argument is delivered to the v1 port verbatim — the v1 repair runs
 *    the Root strategy behind that same call);
 *  - a v2 `team.admitInitialWork` → served through the v2-only
 *    team-admit port (the `attachedContext`-optional fourth argument
 *    rides verbatim; the port's outcome record is the success `data`).
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

  // Recording v1 team-create port (the frozen 4-arg extension) + the two
  // G1-wired v2 team-create ports + a valid projection port.
  const createCalls: Array<[string, string, number | undefined, Record<string, unknown> | undefined]> = []
  const v2CreateCalls: Array<[string, string, number | undefined, string | undefined]> = []
  const admitCalls: Array<[string, string, string, string | undefined]> = []
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
    teamCreateV2: {
      create(
        rootSessionId: string,
        blueprintId: string,
        blueprintRevision: number | undefined,
        workspace: string | undefined,
      ) {
        v2CreateCalls.push([rootSessionId, blueprintId, blueprintRevision, workspace])
        return Promise.resolve({
          path: 'fresh-root',
          durable: { rootSessionId },
          bind: { rootSessionId, blueprintId },
        })
      },
    },
    teamAdmitInitialWork: {
      admit(
        rootSessionId: string,
        requestToken: string,
        prompt: string,
        attachedContext: string | undefined,
      ) {
        admitCalls.push([rootSessionId, requestToken, prompt, attachedContext])
        return Promise.resolve({
          mode: 'fresh',
          rootSessionId,
          requestToken,
          payloadFingerprint: 'sha256:fake-fingerprint',
          sequence: 1,
          terminalSequence: 2,
          delivered: true,
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
  // malformed-params); G1 serves it through the v2 workspace-aware port
  // (the workspace field rides to the port verbatim).
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

  // (5) v2 team.admitInitialWork: G1 serves it through the v2-only
  // team-admit port (the outcome record is the success data).
  const v2Admit = await dispatch('team.admitInitialWork', {
    version: REMOTE_CONTRACT_VERSION_V2,
    params: { rootSessionId: ROOT_SID, requestToken: TOKEN, prompt: PROMPT },
  })

  return {
    createCalls,
    v2CreateCalls,
    admitCalls,
    v1ToV2Only,
    v2GetProjection,
    v2CreateWithWorkspace,
    v1CreateWithWork,
    v2Admit,
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

  it('a v2 team.create WITH workspace routes to the v2 workspace-aware port (workspace rides verbatim, provenance 2)', () => {
    expect(M1.v2CreateWithWorkspace.ok).toBe(true)
    if (!M1.v2CreateWithWorkspace.ok) throw new Error('TCM-M1 guard: expected success')
    const data = dataOf(M1.v2CreateWithWorkspace)
    expect(Object.keys(data).sort()).toEqual(['bind', 'durable', 'path'])
    expect(data['path']).toBe('fresh-root')
    expect(M1.v2CreateWithWorkspace.value.provenance.contractVersion).toBe(REMOTE_CONTRACT_VERSION_V2)
    // G1 — the v2 port received the parsed v2 request: the workspace
    // field verbatim, NO initialWork (absent in the v2 closed set).
    expect(M1.v2CreateCalls.length).toBe(1)
    expect(M1.v2CreateCalls[0]).toEqual([ROOT_SID, BP_ID, undefined, WORKSPACE])
  })

  it('a v1 team.create keeps byte-compatible behavior (initialWork rides to the v1 port, provenance 1)', () => {
    expect(M1.v1CreateWithWork.ok).toBe(true)
    if (!M1.v1CreateWithWork.ok) throw new Error('TCM-M1 guard: expected success')
    expect(M1.v1CreateWithWork.value.provenance.contractVersion).toBe(REMOTE_CONTRACT_VERSION)
    // The v1 port is the ONLY one the v1 request touched (the v2 create
    // above went to the v2 port).
    expect(M1.createCalls.length).toBe(1)
    expect(M1.createCalls[0]).toEqual([ROOT_SID, BP_ID, undefined, { prompt: PROMPT }])
  })

  it('a v2 team.admitInitialWork routes to the v2-only team-admit port (outcome record is the success data)', () => {
    expect(M1.v2Admit.ok).toBe(true)
    if (!M1.v2Admit.ok) throw new Error('TCM-M1 guard: expected success')
    expect(M1.v2Admit.value.provenance.contractVersion).toBe(REMOTE_CONTRACT_VERSION_V2)
    const data = dataOf(M1.v2Admit)
    expect(Object.keys(data).sort()).toEqual([
      'delivered',
      'mode',
      'payloadFingerprint',
      'requestToken',
      'rootSessionId',
      'sequence',
      'terminalSequence',
    ])
    expect(data['mode']).toBe('fresh')
    // The port received the parsed v2 request verbatim (the optional
    // attachedContext absent → undefined, not an own key).
    expect(M1.admitCalls.length).toBe(1)
    expect(M1.admitCalls[0]).toEqual([ROOT_SID, TOKEN, PROMPT, undefined])
  })
})
