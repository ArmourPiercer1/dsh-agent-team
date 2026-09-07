/**
 * d1-remote-v3.test.ts — D1 (Team D1-D6 repair v2): the Remote contract
 * v3 / v3-only-method surface of `@dsh-agent-team/remote`.
 *
 * Must-covers (D1 task card, remote half):
 *  - catalog facts: the 27-method versioned union (23 v1 + 1 v2-only +
 *    2 v3-only + 1 v4-only — the v4 bump is F9, `team.resolveControl`),
 *    the frozen v1 baseline constant still 1, the closed v3-only set,
 *    the version-aware availability matrix (v1/v2 reject the v3 methods,
 *    v3 admits everything except the v4-only method, v4 admits all);
 *  - `team.listRoots` (v3-only): the closed param set is EMPTY (a non-
 *    empty params object → `malformed-params` unknown-field; no fields to
 *    forward), the success `data` is `{ roots: [...] }` from the
 *    `teamRoots` port (port call logged), and the provenance
 *    `contractVersion` echoes 3;
 *  - `team.ensureRootLive` (v3-only): the closed param set is
 *    `['teamSessionId']` (unknown-field / missing / malformed id
 *    negatives), `teamSessionId` is forwarded verbatim to the
 *    `teamEnsureRootLive` port, and the success value is validated
 *    against the closed shape `{ rootSessionId, mode: "team",
 *    live: true }` (a malformed port value → `internal-error` port
 *    contract);
 *  - version routing: a v1 or v2 request to EITHER v3 method →
 *    `method-version-unsupported` (typed AFTER the envelope parse — the
 *    endpoint passes the pre-envelope closed-catalog check);
 *  - backing error allow-list: the D1-emitted and D2-reserved v3 wire
 *    codes + the three D1 index integrity codes pass through with code +
 *    message (invariant 4b); an out-of-vocabulary `Error.code` (ENOENT)
 *    degrades to `internal-error` with no leak;
 *  - v1/v2 wire behavior is PRESERVED (a v1 `team.getProjection` still
 *    round-trips; the v1-only and v2-only methods are still rejected on
 *    the wrong version).
 *
 * Test pattern of this repo (the plain-node shim's `it` is synchronous):
 * every async scenario runs at MODULE level (top-level await) and
 * captures its results; the `it` bodies are pure synchronous assertions.
 *
 * Matchers: toBe/toEqual/toBeGreaterThan (+.not) only.
 */

import { describe, expect, it } from 'vitest'

import {
  createRemoteDispatcher,
  isRemoteMethodAvailableInVersion,
  REMOTE_CONTRACT_VERSION,
  REMOTE_CONTRACT_VERSION_V2,
  REMOTE_CONTRACT_VERSION_V3,
  REMOTE_CONTRACT_VERSION_V4,
  REMOTE_CONTRACT_ERROR_CODES,
  REMOTE_METHOD_NAMES,
  REMOTE_TEAM_ENSURE_ROOT_LIVE_FIELDS,
  REMOTE_TEAM_LIST_ROOTS_FIELDS,
  REMOTE_V2_ONLY_METHODS,
  REMOTE_V3_ONLY_METHODS,
  REMOTE_V4_ONLY_METHODS,
  SUPPORTED_REMOTE_CONTRACT_VERSIONS,
  type RemoteErrorResult,
  type RemoteSafeRecord,
} from '../src/index.js'
import {
  expectError,
  expectSuccess,
  makeDispatcher,
  makeFakePorts,
  P8T3_ROOTS,
  P8T3_TEAM_SESSION_ID,
  p8t3Wire,
  p8t3WireV2,
  p8t3WireV3,
} from './p8t3-helpers.js'

// ---------------------------------------------------------------------------
// Scenario constants
// ---------------------------------------------------------------------------

/** The D1-emitted v3 wire codes + the D2-reserved v3 wire codes + the
 *  three D1 index integrity codes (the closed backing allow-list). */
const D1_V3_BACKING_CODES = [
  'TEAM_REMOTE_TEAM_ROOTS_UNAVAILABLE',
  'TEAM_REMOTE_TEAM_ROOT_LIVE_NOT_IMPLEMENTED',
  'TEAM_REMOTE_TEAM_ROOT_LIVE_PORT_UNAVAILABLE',
  'TEAM_REMOTE_TEAM_ROOT_LIVE_NO_DURABLE_ARTIFACT',
  'TEAM_REMOTE_TEAM_ROOT_LIVE_OUTSIDE_TEAM',
  'TEAM_REMOTE_TEAM_ROOT_LIVE_START_FAILED',
  'TEAM_OWNERSHIP_INDEX_ROOT_BINDING_MISMATCH',
  'TEAM_OWNERSHIP_INDEX_MEMBER_BINDING_MISMATCH',
  'TEAM_OWNERSHIP_INDEX_MEMBER_BINDING_CONFLICT',
] as const

/** One typed backing error (an `Error` carrying its closed `code`). */
function backingError(code: string): Error {
  const error = new Error(`backing: ${code}`)
  ;(error as Error & { code: string }).code = code
  return error
}

// ---------------------------------------------------------------------------
// Module level (top-level await): drive the real dispatcher over the fake
// ports and capture every scenario result.
// ---------------------------------------------------------------------------

const RT = await (async () => {
  // (a) The base dispatcher: the default fake ports (the v3 ports log
  // their calls + echo their arguments into the returned records).
  const base = makeDispatcher()

  // (b) A dispatcher whose `teamRoots` port FAILS with each v3 backing
  // code (the invariant-4b pass-through battery).
  const rootsFailureResponses = new Map<string, RemoteErrorResult>()
  for (const code of D1_V3_BACKING_CODES) {
    const failing = createRemoteDispatcher(
      makeFakePorts({
        teamRoots: {
          listRoots() {
            throw backingError(code)
          },
        },
      }),
    )
    const response = await failing('team.listRoots', p8t3WireV3({}))
    rootsFailureResponses.set(code, expectError(response))
  }

  // (c) An out-of-vocabulary backing code (Node ENOENT-style): must
  // degrade to `internal-error` with no leak (invariant 5).
  const enoentDispatcher = createRemoteDispatcher(
    makeFakePorts({
      teamRoots: {
        listRoots() {
          throw backingError('ENOENT')
        },
      },
    }),
  )
  const enoentResponse = await enoentDispatcher('team.listRoots', p8t3WireV3({}))

  // (d) A `teamRoots` port returning a MALFORMED root row (missing
  // rootSessionId): the handler's D-4 top-level check → `internal-error`
  // port contract (never a silent pass-through).
  const malformedRowDispatcher = createRemoteDispatcher(
    makeFakePorts({
      teamRoots: {
        listRoots() {
          return [{ blueprintId: 'bp-x', revision: '1', createdAt: '2026-08-29T00:00:01.000Z', generation: 1, memberCount: 0 }]
        },
      },
    }),
  )
  const malformedRowResponse = await malformedRowDispatcher('team.listRoots', p8t3WireV3({}))

  // (e) A `teamEnsureRootLive` port returning a MALFORMED success value
  // (mode !== 'team'): the handler's closed-shape check → `internal-error`.
  const malformedEnsureDispatcher = createRemoteDispatcher(
    makeFakePorts({
      teamEnsureRootLive: {
        ensureRootLive() {
          return { rootSessionId: P8T3_TEAM_SESSION_ID, mode: 'ordinary', live: true }
        },
      },
    }),
  )
  const malformedEnsureResponse = await malformedEnsureDispatcher(
    'team.ensureRootLive',
    p8t3WireV3({ teamSessionId: P8T3_TEAM_SESSION_ID }),
  )

  // --- team.listRoots (v3-only) --------------------------------------------

  const listRootsOk = await base.dispatch('team.listRoots', p8t3WireV3({}))
  const listRootsData = listRootsOk.ok ? (listRootsOk.value.data as RemoteSafeRecord) : undefined
  const listRootsProvenance = listRootsOk.ok ? listRootsOk.value.provenance : undefined

  const listRootsUnknownField = await base.dispatch('team.listRoots', p8t3WireV3({ root: 'root-1' }))
  const listRootsNonRecordParam = await base.dispatch('team.listRoots', {
    version: REMOTE_CONTRACT_VERSION_V3,
    params: ['not-a-record'],
  } as unknown as Record<string, unknown>)

  // --- team.ensureRootLive (v3-only) ----------------------------------------

  const ensureOk = await base.dispatch(
    'team.ensureRootLive',
    p8t3WireV3({ teamSessionId: P8T3_TEAM_SESSION_ID }),
  )
  const ensureData = ensureOk.ok ? (ensureOk.value.data as RemoteSafeRecord) : undefined
  const ensureProvenance = ensureOk.ok ? ensureOk.value.provenance : undefined

  const ensureUnknownField = await base.dispatch(
    'team.ensureRootLive',
    p8t3WireV3({ teamSessionId: P8T3_TEAM_SESSION_ID, workspace: '/w/x' }),
  )
  const ensureMissingField = await base.dispatch('team.ensureRootLive', p8t3WireV3({}))
  const ensureBadId = await base.dispatch('team.ensureRootLive', p8t3WireV3({ teamSessionId: 'bad id' }))

  // --- version routing (v1/v2 requests to the v3-only methods) --------------

  const listRootsOnV1 = await base.dispatch('team.listRoots', p8t3Wire({}))
  const listRootsOnV2 = await base.dispatch('team.listRoots', p8t3WireV2({}))
  const ensureOnV1 = await base.dispatch('team.ensureRootLive', p8t3Wire({ teamSessionId: P8T3_TEAM_SESSION_ID }))
  const ensureOnV2 = await base.dispatch('team.ensureRootLive', p8t3WireV2({ teamSessionId: P8T3_TEAM_SESSION_ID }))

  // --- v1/v2 wire behavior preserved -----------------------------------------

  const v1Projection = await base.dispatch('team.getProjection', p8t3Wire({ teamSessionId: P8T3_TEAM_SESSION_ID }))
  const v2AdmitOnV1 = await base.dispatch(
    'team.admitInitialWork',
    p8t3Wire({ rootSessionId: P8T3_TEAM_SESSION_ID, requestToken: 'tok-1', prompt: 'p' }),
  )

  return {
    base,
    rootsFailureResponses,
    enoentResponse,
    malformedRowResponse,
    malformedEnsureResponse,
    listRootsOk,
    listRootsData,
    listRootsProvenance,
    listRootsUnknownField,
    listRootsNonRecordParam,
    ensureOk,
    ensureData,
    ensureProvenance,
    ensureUnknownField,
    ensureMissingField,
    ensureBadId,
    listRootsOnV1,
    listRootsOnV2,
    ensureOnV1,
    ensureOnV2,
    v1Projection,
    v2AdmitOnV1,
  }
})()

// ---------------------------------------------------------------------------
// Assertions (synchronous `it` bodies over the captured results)
// ---------------------------------------------------------------------------

describe('D1 (remote contract v3): catalog facts', () => {
  it('the catalog is the 27-method versioned union (23 v1 + 1 v2-only + 2 v3-only + 1 v4-only)', () => {
    expect(REMOTE_METHOD_NAMES.length).toBe(27)
    expect(REMOTE_METHOD_NAMES.includes('team.listRoots')).toBe(true)
    expect(REMOTE_METHOD_NAMES.includes('team.ensureRootLive')).toBe(true)
    // F9: the v4-only method is in the union; the frozen v1 methods are
    // all still present (23) + the v2-only one
    expect(REMOTE_METHOD_NAMES.includes('team.resolveControl')).toBe(true)
    expect(REMOTE_METHOD_NAMES.length - REMOTE_V2_ONLY_METHODS.length - REMOTE_V3_ONLY_METHODS.length - REMOTE_V4_ONLY_METHODS.length).toBe(23)
  })

  it('the v1 baseline constant is still 1 and the supported set is [1, 2, 3, 4] (the F9 v4 bump)', () => {
    expect(REMOTE_CONTRACT_VERSION).toBe(1)
    expect(REMOTE_CONTRACT_VERSION_V2).toBe(2)
    expect(REMOTE_CONTRACT_VERSION_V3).toBe(3)
    expect(REMOTE_CONTRACT_VERSION_V4).toBe(4)
    expect([...SUPPORTED_REMOTE_CONTRACT_VERSIONS].sort((a, b) => a - b)).toEqual([1, 2, 3, 4])
  })

  it('the closed v3-only set is exactly the two D1 methods; the closed v4-only set is exactly team.resolveControl', () => {
    expect([...REMOTE_V3_ONLY_METHODS].sort()).toEqual(['team.ensureRootLive', 'team.listRoots'])
    expect([...REMOTE_V2_ONLY_METHODS].sort()).toEqual(['team.admitInitialWork'])
    expect([...REMOTE_V4_ONLY_METHODS].sort()).toEqual(['team.resolveControl'])
  })

  it('the availability matrix: v3-only methods are v3-only; v1/v2 methods stay available in v3; the v4-only method is v4-only', () => {
    // v1: no v2-only, no v3-only, no v4-only
    expect(isRemoteMethodAvailableInVersion('team.admitInitialWork', 1)).toBe(false)
    expect(isRemoteMethodAvailableInVersion('team.listRoots', 1)).toBe(false)
    expect(isRemoteMethodAvailableInVersion('team.ensureRootLive', 1)).toBe(false)
    expect(isRemoteMethodAvailableInVersion('team.resolveControl', 1)).toBe(false)
    // v2: no v3-only, no v4-only
    expect(isRemoteMethodAvailableInVersion('team.listRoots', 2)).toBe(false)
    expect(isRemoteMethodAvailableInVersion('team.ensureRootLive', 2)).toBe(false)
    expect(isRemoteMethodAvailableInVersion('team.resolveControl', 2)).toBe(false)
    // v3: everything EXCEPT the v4-only method
    expect(isRemoteMethodAvailableInVersion('team.listRoots', 3)).toBe(true)
    expect(isRemoteMethodAvailableInVersion('team.ensureRootLive', 3)).toBe(true)
    expect(isRemoteMethodAvailableInVersion('team.admitInitialWork', 3)).toBe(true)
    expect(isRemoteMethodAvailableInVersion('team.getProjection', 3)).toBe(true)
    expect(isRemoteMethodAvailableInVersion('team.resolveControl', 3)).toBe(false)
    // v4: everything (the F9 bump admits the full v1-v3 surface too)
    expect(isRemoteMethodAvailableInVersion('team.getProjection', 4)).toBe(true)
    expect(isRemoteMethodAvailableInVersion('team.admitInitialWork', 4)).toBe(true)
    expect(isRemoteMethodAvailableInVersion('team.listRoots', 4)).toBe(true)
    expect(isRemoteMethodAvailableInVersion('team.ensureRootLive', 4)).toBe(true)
    expect(isRemoteMethodAvailableInVersion('team.resolveControl', 4)).toBe(true)
    // non-catalog method: never available
    expect(isRemoteMethodAvailableInVersion('team.notACatalogMethod', 3)).toBe(false)
    expect(isRemoteMethodAvailableInVersion('team.notACatalogMethod', 4)).toBe(false)
  })

  it('the closed param field sets are frozen (listRoots: none; ensureRootLive: teamSessionId)', () => {
    expect([...REMOTE_TEAM_LIST_ROOTS_FIELDS].sort()).toEqual([])
    expect([...REMOTE_TEAM_ENSURE_ROOT_LIVE_FIELDS].sort()).toEqual(['teamSessionId'])
  })
})

describe('D1 (remote contract v3): team.listRoots', () => {
  it('a v3 request with the empty closed params succeeds: data is { roots: [...] } from the port', () => {
    const success = expectSuccess(RT.listRootsOk)
    expect(RT.listRootsData).toBeDefined()
    expect((RT.listRootsData as RemoteSafeRecord)['roots']).toEqual([...P8T3_ROOTS])
    expect(success.value.data).toEqual({ roots: [...P8T3_ROOTS] })
    // the port was called exactly once (READ-ONLY: nothing else was touched)
    expect(RT.base.ports.calls).toContain('team.listRoots')
  })

  it('the success provenance echoes contractVersion 3 (the request version)', () => {
    expect(RT.listRootsProvenance).toBeDefined()
    expect(RT.listRootsProvenance?.contractVersion).toBe(3)
    expect(RT.listRootsProvenance?.method).toBe('team.listRoots')
  })

  it('a non-empty params object is malformed-params unknown-field (the closed set is EMPTY)', () => {
    const error = expectError(RT.listRootsUnknownField)
    expect(error.error.code).toBe(REMOTE_CONTRACT_ERROR_CODES.MALFORMED_PARAMS)
    expect(error.error.details?.reason).toBe('unknown-field')
    expect(error.error.details?.field).toBe('root')
  })

  it('a non-record params block is rejected at the envelope boundary (malformed-request)', () => {
    const error = expectError(RT.listRootsNonRecordParam)
    expect(error.error.code).toBe(REMOTE_CONTRACT_ERROR_CODES.MALFORMED_REQUEST)
  })
})

describe('D1 (remote contract v3): team.ensureRootLive', () => {
  it('a v3 request forwards teamSessionId verbatim to the port and echoes the closed success shape', () => {
    const success = expectSuccess(RT.ensureOk)
    expect(RT.ensureData).toBeDefined()
    expect((RT.ensureData as RemoteSafeRecord)['rootSessionId']).toBe(P8T3_TEAM_SESSION_ID)
    expect((RT.ensureData as RemoteSafeRecord)['mode']).toBe('team')
    expect((RT.ensureData as RemoteSafeRecord)['live']).toBe(true)
    expect(success.value.data).toEqual({ rootSessionId: P8T3_TEAM_SESSION_ID, mode: 'team', live: true })
    expect(RT.base.ports.calls).toContain('team.ensureRootLive')
  })

  it('the success provenance echoes contractVersion 3 (the request version)', () => {
    expect(RT.ensureProvenance?.contractVersion).toBe(3)
    expect(RT.ensureProvenance?.method).toBe('team.ensureRootLive')
  })

  it('an unknown field is malformed-params unknown-field (closed set: teamSessionId only)', () => {
    const error = expectError(RT.ensureUnknownField)
    expect(error.error.code).toBe(REMOTE_CONTRACT_ERROR_CODES.MALFORMED_PARAMS)
    expect(error.error.details?.reason).toBe('unknown-field')
    expect(error.error.details?.field).toBe('workspace')
  })

  it('a missing teamSessionId is malformed-params missing-required', () => {
    const error = expectError(RT.ensureMissingField)
    expect(error.error.code).toBe(REMOTE_CONTRACT_ERROR_CODES.MALFORMED_PARAMS)
    expect(error.error.details?.reason).toBe('missing-required')
    expect(error.error.details?.field).toBe('teamSessionId')
  })

  it('a malformed teamSessionId → the mirrored frozen P3 code INVALID_ROOT_SESSION_ID (field teamSessionId)', () => {
    const error = expectError(RT.ensureBadId)
    expect(error.error.code).toBe('INVALID_ROOT_SESSION_ID')
    expect(error.error.details?.field).toBe('teamSessionId')
  })

  it('a port success value violating the closed shape (mode !== team) is internal-error (port contract)', () => {
    const error = expectError(RT.malformedEnsureResponse)
    expect(error.error.code).toBe(REMOTE_CONTRACT_ERROR_CODES.INTERNAL_ERROR)
  })

  it('a port root row violating the closed shape (missing rootSessionId) is internal-error (port contract)', () => {
    const error = expectError(RT.malformedRowResponse)
    expect(error.error.code).toBe(REMOTE_CONTRACT_ERROR_CODES.INTERNAL_ERROR)
  })
})

describe('D1 (remote contract v3): version routing (v1/v2 → method-version-unsupported)', () => {
  it('a v1 request to team.listRoots → method-version-unsupported (typed after the envelope parse)', () => {
    const error = expectError(RT.listRootsOnV1)
    expect(error.error.code).toBe(REMOTE_CONTRACT_ERROR_CODES.METHOD_VERSION_UNSUPPORTED)
    expect(error.error.details?.reason).toBe('method-not-available-in-version')
  })

  it('a v2 request to team.listRoots → method-version-unsupported', () => {
    const error = expectError(RT.listRootsOnV2)
    expect(error.error.code).toBe(REMOTE_CONTRACT_ERROR_CODES.METHOD_VERSION_UNSUPPORTED)
  })

  it('a v1 request to team.ensureRootLive → method-version-unsupported', () => {
    const error = expectError(RT.ensureOnV1)
    expect(error.error.code).toBe(REMOTE_CONTRACT_ERROR_CODES.METHOD_VERSION_UNSUPPORTED)
  })

  it('a v2 request to team.ensureRootLive → method-version-unsupported', () => {
    const error = expectError(RT.ensureOnV2)
    expect(error.error.code).toBe(REMOTE_CONTRACT_ERROR_CODES.METHOD_VERSION_UNSUPPORTED)
  })
})

describe('D1 (remote contract v3): backing error allow-list (invariant 4b)', () => {
  it('every D1-emitted + D2-reserved v3 wire code + the three index integrity codes passes through with code + message', () => {
    for (const code of D1_V3_BACKING_CODES) {
      const result = RT.rootsFailureResponses.get(code)
      expect(result).toBeDefined()
      expect(result?.error.code).toBe(code)
      expect(result?.error.message).toBe(`backing: ${code}`)
      // the typed identity rides under details.cause (invariant 4b)
      expect(result?.error.details?.cause).toEqual({ code, message: `backing: ${code}` })
    }
  })

  it('an out-of-vocabulary backing code (ENOENT) degrades to internal-error with no leak', () => {
    const error = expectError(RT.enoentResponse)
    expect(error.error.code).toBe(REMOTE_CONTRACT_ERROR_CODES.INTERNAL_ERROR)
    expect(error.error.message).toBe('internal error in remote handler')
  })
})

describe('D1 (remote contract v3): v1/v2 wire behavior is preserved', () => {
  it('a v1 team.getProjection still round-trips on the v1 envelope', () => {
    const success = expectSuccess(RT.v1Projection)
    expect(success.value.provenance.contractVersion).toBe(1)
    expect(success.value.data).toBeDefined()
  })

  it('a v1 request to the v2-only team.admitInitialWork still → method-version-unsupported', () => {
    const error = expectError(RT.v2AdmitOnV1)
    expect(error.error.code).toBe(REMOTE_CONTRACT_ERROR_CODES.METHOD_VERSION_UNSUPPORTED)
  })
})
