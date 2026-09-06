/**
 * d1-s6-remote-v3.test.ts — D1 (Team D1-D6 repair v2): the S6 PRODUCTION
 * dispatcher wiring of the remote contract v3-only methods
 * (`team.listRoots` / `team.ensureRootLive`).
 *
 * The dispatcher under test is the REAL production one
 * (`createS6RemotePorts` + `createS6RemoteDispatcher`): the shared
 * version-aware param parser, the frozen seven invariants, and the
 * shared backing-code allow-list. Only the backing options are simulated
 * (the `listRoots` closure + the repository surface + the bound root).
 *
 * Covers (D1 task card, host-wiring half):
 *  - `team.listRoots` (v3-only) — READ-ONLY host-authority read: served
 *    through the injected `listRoots` port (called exactly once, no
 *    arguments), the success `data` is `{ roots: [...] }` verbatim,
 *    provenance echoes contractVersion 3; NO repository access (the
 *    trip-wire repositories throw on ANY touch) and NO bound-root guard
 *    (no root is addressed — even a host whose bound root is absent from
 *    the list can serve the list);
 *  - fail-closed when the host wiring is ABSENT: no `listRoots` option →
 *    typed `TEAM_REMOTE_TEAM_ROOTS_UNAVAILABLE` (never a silent empty
 *    list);
 *  - the D1 index's integrity failures + the storage typed errors
 *    propagate through the `listRoots` closure UNMAPPED (invariant 4b:
 *    code + message preserved, source identity under details.cause);
 *    an UNtyped throw is re-wrapped as the same unavailable code (the
 *    message preserved for diagnosis);
 *  - `team.ensureRootLive` (v3-only) — TEAM-SCOPED: a FOREIGN root fails
 *    closed with `TEAM_REMOTE_FOREIGN_TEAM` BEFORE the reservation error;
 *    the bound root (D1) fails closed typed with
 *    `TEAM_REMOTE_TEAM_ROOT_LIVE_NOT_IMPLEMENTED` (the handler is wired
 *    by D2 — NEVER a silent success; the promise never rejects);
 *  - version routing: v1/v2 requests to either v3 method → typed
 *    `method-version-unsupported` AFTER the envelope parse (details echo
 *    the request's own version).
 *
 * Test pattern of this repo (the plain-node shim's `it` is synchronous):
 * every async scenario runs at MODULE level (top-level await) and
 * captures its results; the `it` bodies are pure synchronous assertions.
 *
 * Matchers: toBe/toEqual/toBeGreaterThan (+.not) only.
 *
 * @module @dsh-agent-team/runtime/test/d1-s6-remote-v3
 */

import { describe, expect, it } from 'vitest'

import {
  createS6RemoteDispatcher,
  createS6RemotePorts,
  S6_REMOTE_ERROR_CODES,
} from '../src/plugin/s6-remote.js'
import type { S6RemoteOptions } from '../src/plugin/s6-remote.js'
import type { ServerPrincipalDerivation } from '../src/plugin/types.js'
import { TeamOwnershipIndexError } from '../src/team-ownership-index.js'
import type { TeamDomainRepositories } from '../../storage/repositories/index.js'
import {
  REMOTE_CONTRACT_ERROR_CODES,
  REMOTE_CONTRACT_VERSION,
  REMOTE_CONTRACT_VERSION_V2,
  REMOTE_CONTRACT_VERSION_V3,
} from '../../remote/src/index.js'
import type { RemoteResponse } from '../../remote/src/index.js'

const ROOT_SID = 'root-session-d1-s6'
const FOREIGN_SID = 'root-session-foreign-d1'

/** The two durable root wire rows the fake port serves. */
const WIRE_ROWS = [
  {
    rootSessionId: ROOT_SID,
    blueprintId: 'BP-D1-S6',
    revision: '17',
    defaultWorkspace: 'C:/agent-team/work/d1',
    createdAt: '2026-09-01T00:00:00Z',
    generation: 1,
    memberCount: 2,
  },
  {
    rootSessionId: 'root-session-d1-s6-b',
    blueprintId: 'BP-D1-S6-B',
    revision: '3',
    createdAt: '2026-09-01T00:00:00Z',
    generation: 5,
    memberCount: 1,
  },
]

/** Extract the typed error part of a resolved error envelope (asserts the invariant-7 shape). */
function errorOf(response: RemoteResponse): Record<string, unknown> {
  if (response.ok) throw new Error('D1-S6 guard: expected an error result')
  return response.error as unknown as Record<string, unknown>
}

/** Extract the success data part of a resolved success envelope. */
function dataOf(response: RemoteResponse): Record<string, unknown> {
  if (!response.ok) throw new Error('D1-S6 guard: expected a success result')
  return response.value.data as Record<string, unknown>
}

/** The trip-wire repositories: ANY access is a test failure. */
function tripWireRepositories(): { repos: TeamDomainRepositories; touched: string[] } {
  const touched: string[] = []
  const trip = (name: string): never => {
    touched.push(name)
    throw new Error(`D1-S6 guard: team.listRoots / team.ensureRootLive must not touch repositories.${name}`)
  }
  const repos = {
    teamSessions: { list: () => trip('teamSessions.list'), get: () => trip('teamSessions.get'), put: () => trip('teamSessions.put') },
    memberInstances: { list: () => trip('memberInstances.list'), get: () => trip('memberInstances.get'), put: () => trip('memberInstances.put') },
    sessionBindings: { get: () => trip('sessionBindings.get'), put: () => trip('sessionBindings.put'), listByKind: () => trip('sessionBindings.listByKind') },
    schemaMeta: { listStamps: () => trip('schemaMeta.listStamps'), size: 0 },
    overrides: { list: () => trip('overrides.list') },
    compatibility: { get: () => trip('compatibility.get') },
    operations: { list: () => trip('operations.list') },
    ledger: { list: () => trip('ledger.list'), count: () => trip('ledger.count') },
  } as unknown as TeamDomainRepositories
  return { repos, touched }
}

/** Build the production ports over a minimal (but trip-wired) options object. */
function makePorts(options: {
  readonly listRoots?: () => Promise<readonly Record<string, unknown>[]>
}): { ports: ReturnType<typeof createS6RemotePorts>; touched: string[] } {
  const { repos, touched } = tripWireRepositories()
  const opts = {
    rootSessionId: ROOT_SID,
    repositories: repos,
    ...(options.listRoots === undefined ? {} : { listRoots: options.listRoots }),
  } as unknown as S6RemoteOptions
  const ports = createS6RemotePorts(opts)
  return { ports, touched }
}

// Module level (top-level await): drive the REAL production dispatcher
// over the fake options and capture every scenario result.
const D1 = await (async () => {
  const noPrincipal: ServerPrincipalDerivation = () => {
    throw new Error('D1-S6 guard: principal derivation must not run for these methods')
  }

  // (a) The full host wiring: the listRoots port serves the two rows.
  let listRootsCalls = 0
  const { ports, touched } = makePorts({
    listRoots: () => {
      listRootsCalls += 1
      return Promise.resolve(WIRE_ROWS)
    },
  })
  const dispatch = createS6RemoteDispatcher(ports, noPrincipal)

  const listRootsV3 = await dispatch('team.listRoots', { version: REMOTE_CONTRACT_VERSION_V3, params: {} })
  const listRootsV1 = await dispatch('team.listRoots', { version: REMOTE_CONTRACT_VERSION, params: {} })
  const listRootsV2 = await dispatch('team.listRoots', { version: REMOTE_CONTRACT_VERSION_V2, params: {} })

  const ensureV3Bound = await dispatch('team.ensureRootLive', {
    version: REMOTE_CONTRACT_VERSION_V3,
    params: { teamSessionId: ROOT_SID },
  })
  const ensureV3Foreign = await dispatch('team.ensureRootLive', {
    version: REMOTE_CONTRACT_VERSION_V3,
    params: { teamSessionId: FOREIGN_SID },
  })
  const ensureV1 = await dispatch('team.ensureRootLive', {
    version: REMOTE_CONTRACT_VERSION,
    params: { teamSessionId: ROOT_SID },
  })
  const ensureV2 = await dispatch('team.ensureRootLive', {
    version: REMOTE_CONTRACT_VERSION_V2,
    params: { teamSessionId: ROOT_SID },
  })

  // (b) The ABSENT host wiring: no listRoots option.
  const absent = makePorts({})
  const dispatchAbsent = createS6RemoteDispatcher(absent.ports, noPrincipal)
  const listRootsAbsent = await dispatchAbsent('team.listRoots', { version: REMOTE_CONTRACT_VERSION_V3, params: {} })

  // (c) The D1 index integrity failure: the closure rethrows it UNMAPPED.
  const indexFailure = makePorts({
    listRoots: () =>
      Promise.reject(
        new TeamOwnershipIndexError(
          'TEAM_OWNERSHIP_INDEX_ROOT_BINDING_MISMATCH',
          "root 'r' is bound as kind 'ordinary' but its TeamSession record requires the 'team-root' binding",
          { rootSessionId: 'r', foundKind: 'ordinary', expectedKind: 'team-root' },
        ),
      ),
  })
  const dispatchIndexFailure = createS6RemoteDispatcher(indexFailure.ports, noPrincipal)
  const listRootsIndexFailure = await dispatchIndexFailure('team.listRoots', {
    version: REMOTE_CONTRACT_VERSION_V3,
    params: {},
  })

  // (d) The storage typed error (RECORD_INVALID): rethrown UNMAPPED.
  const storageFailure = makePorts({
    listRoots: () => {
      const error = new Error('team_domain/team_sessions: row is not valid JSON')
      ;(error as Error & { code: string }).code = 'RECORD_INVALID'
      return Promise.reject(error)
    },
  })
  const dispatchStorageFailure = createS6RemoteDispatcher(storageFailure.ports, noPrincipal)
  const listRootsStorageFailure = await dispatchStorageFailure('team.listRoots', {
    version: REMOTE_CONTRACT_VERSION_V3,
    params: {},
  })

  // (e) An UNtyped throw: re-wrapped as the unavailable code.
  const untypedFailure = makePorts({
    listRoots: () => Promise.reject(new Error('boom: the listRoots closure exploded')),
  })
  const dispatchUntyped = createS6RemoteDispatcher(untypedFailure.ports, noPrincipal)
  const listRootsUntyped = await dispatchUntyped('team.listRoots', {
    version: REMOTE_CONTRACT_VERSION_V3,
    params: {},
  })

  return {
    touched,
    listRootsCallsRef: { get calls() { return listRootsCalls } },
    listRootsV3,
    listRootsV1,
    listRootsV2,
    ensureV3Bound,
    ensureV3Foreign,
    ensureV1,
    ensureV2,
    listRootsAbsent,
    listRootsIndexFailure,
    listRootsStorageFailure,
    listRootsUntyped,
  }
})()

// ---------------------------------------------------------------------------
// Assertions (synchronous `it` bodies over the captured results)
// ---------------------------------------------------------------------------

describe('D1 (S6 host wiring): team.listRoots (v3-only, read-only)', () => {
  it('a v3 request succeeds: data is { roots: [...] } verbatim from the port, provenance contractVersion 3', () => {
    expect(D1.listRootsV3.ok).toBe(true)
    if (!D1.listRootsV3.ok) throw new Error('D1-S6 guard: expected success')
    expect(D1.listRootsV3.value.provenance.contractVersion).toBe(REMOTE_CONTRACT_VERSION_V3)
    expect(D1.listRootsV3.value.provenance.method).toBe('team.listRoots')
    const data = dataOf(D1.listRootsV3)
    expect(Object.keys(data)).toEqual(['roots'])
    expect(data['roots']).toEqual(WIRE_ROWS)
  })

  it('the listRoots port is called exactly once, with no arguments', () => {
    expect(D1.listRootsCallsRef.calls).toBe(1)
  })

  it('the READ-ONLY contract: no repository access of any kind (the trip-wire was never touched)', () => {
    expect(D1.touched).toEqual([])
  })

  it('a v1 request → method-version-unsupported (typed after the envelope parse, details echo v1)', () => {
    const error = errorOf(D1.listRootsV1)
    expect(error['code']).toBe(REMOTE_CONTRACT_ERROR_CODES.METHOD_VERSION_UNSUPPORTED)
    const details = error['details'] as Record<string, unknown>
    expect(details['contractVersion']).toBe(REMOTE_CONTRACT_VERSION)
    expect(details['reason']).toBe('method-not-available-in-version')
  })

  it('a v2 request → method-version-unsupported (details echo v2)', () => {
    const error = errorOf(D1.listRootsV2)
    expect(error['code']).toBe(REMOTE_CONTRACT_ERROR_CODES.METHOD_VERSION_UNSUPPORTED)
    const details = error['details'] as Record<string, unknown>
    expect(details['contractVersion']).toBe(REMOTE_CONTRACT_VERSION_V2)
  })
})

describe('D1 (S6 host wiring): team.listRoots fail-closed (never a silent empty list)', () => {
  it('an ABSENT listRoots option → typed TEAM_REMOTE_TEAM_ROOTS_UNAVAILABLE (diagnostic in the message)', () => {
    const error = errorOf(D1.listRootsAbsent)
    expect(error['code']).toBe(S6_REMOTE_ERROR_CODES.TEAM_ROOTS_UNAVAILABLE)
    expect(error['code']).toBe('TEAM_REMOTE_TEAM_ROOTS_UNAVAILABLE')
    expect(String(error['message'])).toContain('does not provide the listRoots port')
  })

  it('the D1 index integrity failure propagates UNMAPPED (code + message + cause identity, invariant 4b)', () => {
    const error = errorOf(D1.listRootsIndexFailure)
    expect(error['code']).toBe('TEAM_OWNERSHIP_INDEX_ROOT_BINDING_MISMATCH')
    expect(String(error['message'])).toContain("requires the 'team-root' binding")
    const details = error['details'] as Record<string, unknown>
    expect(details['reason']).toBe('domain-error')
    // The index error carries a `details` record — it rides lossless-
    // checked under cause.details (invariant 4b).
    const cause = details['cause'] as Record<string, unknown>
    expect(cause['code']).toBe('TEAM_OWNERSHIP_INDEX_ROOT_BINDING_MISMATCH')
    expect(cause['message']).toContain("requires the 'team-root' binding")
    expect(cause['details']).toEqual({
      rootSessionId: 'r',
      foundKind: 'ordinary',
      expectedKind: 'team-root',
    })
  })

  it('the storage typed error (RECORD_INVALID) propagates UNMAPPED (invariant 4b)', () => {
    const error = errorOf(D1.listRootsStorageFailure)
    expect(error['code']).toBe('RECORD_INVALID')
    expect(String(error['message'])).toContain('row is not valid JSON')
  })

  it('an untyped throw is re-wrapped as TEAM_REMOTE_TEAM_ROOTS_UNAVAILABLE (message preserved)', () => {
    const error = errorOf(D1.listRootsUntyped)
    expect(error['code']).toBe('TEAM_REMOTE_TEAM_ROOTS_UNAVAILABLE')
    expect(String(error['message'])).toContain('boom: the listRoots closure exploded')
  })
})

describe('D1 (S6 host wiring): team.ensureRootLive (v3-only, reserved until D2)', () => {
  it('a FOREIGN root fails closed TEAM_REMOTE_FOREIGN_TEAM BEFORE the reservation error (the bound-root guard runs first)', () => {
    const error = errorOf(D1.ensureV3Foreign)
    expect(error['code']).toBe('TEAM_REMOTE_FOREIGN_TEAM')
    // the guard's diagnostic (the addressed + bound root) rides in the
    // message; the wire details carry the 4b pass-through identity
    const details = error['details'] as Record<string, unknown>
    expect(details['reason']).toBe('domain-error')
    expect(String(error['message'])).toContain(`'${FOREIGN_SID}'`)
    expect(String(error['message'])).toContain(`bound root '${ROOT_SID}'`)
  })

  it('the bound root (D1) fails closed typed TEAM_REMOTE_TEAM_ROOT_LIVE_NOT_IMPLEMENTED — NEVER a silent success', () => {
    const error = errorOf(D1.ensureV3Bound)
    expect(error['code']).toBe(S6_REMOTE_ERROR_CODES.TEAM_ROOT_LIVE_NOT_IMPLEMENTED)
    expect(error['code']).toBe('TEAM_REMOTE_TEAM_ROOT_LIVE_NOT_IMPLEMENTED')
    const details = error['details'] as Record<string, unknown>
    expect(details['reason']).toBe('domain-error')
    const cause = details['cause'] as Record<string, unknown>
    expect(cause['code']).toBe('TEAM_REMOTE_TEAM_ROOT_LIVE_NOT_IMPLEMENTED')
    expect(String(error['message'])).toContain('reserved')
  })

  it('the READ-ONLY contract holds for ensureRootLive as well (the trip-wire was never touched)', () => {
    expect(D1.touched).toEqual([])
  })

  it('a v1 request → method-version-unsupported (details echo v1)', () => {
    const error = errorOf(D1.ensureV1)
    expect(error['code']).toBe(REMOTE_CONTRACT_ERROR_CODES.METHOD_VERSION_UNSUPPORTED)
    const details = error['details'] as Record<string, unknown>
    expect(details['contractVersion']).toBe(REMOTE_CONTRACT_VERSION)
  })

  it('a v2 request → method-version-unsupported (details echo v2)', () => {
    const error = errorOf(D1.ensureV2)
    expect(error['code']).toBe(REMOTE_CONTRACT_ERROR_CODES.METHOD_VERSION_UNSUPPORTED)
    const details = error['details'] as Record<string, unknown>
    expect(details['contractVersion']).toBe(REMOTE_CONTRACT_VERSION_V2)
  })
})
