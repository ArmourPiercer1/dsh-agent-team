/**
 * c6-remote-v6.test.ts — the remote contract v6 bump (team-view-sync-
 * complete, Phase 2; frozen design decisions, 2026-09-28):
 *
 *  - catalog facts: the closed v6 field set of `team.getReadState` is
 *    exactly `{ sessionId }`; the method lives in the frozen `team`
 *    category; `REMOTE_V6_ONLY_METHODS` is exactly `['team.getReadState']`
 *    and the method is available in v6 and ONLY in v6;
 *  - version routing (v1–v5 → `method-version-unsupported`): a request to
 *    the v6-only method on any frozen version is a typed rejection AFTER
 *    the envelope parse;
 *  - `team.getReadState` success: the CLOSED wire value (every field
 *    required, `null` cells typed — never absent) for the world root
 *    (`team-root`) and a confirmed `none`; the provenance echoes 6;
 *  - the closed value is ENFORCED: unknown fields, missing fields, a
 *    non-vocabulary relation, and cross-field contradictions (a `none`
 *    with non-null cells; a `team-member` missing its cells) all fail
 *    with the `internal-error` port contract — never a silent `none`
 *    (fail closed, frozen decision 1);
 *  - a storage-layer typed failure of the read-state port PASSES THROUGH
 *    typed (invariant 4b) — the storage error is never translated into a
 *    `none` answer (fail closed, frozen decision 1);
 *  - the v6 projection freshness pair: a v6 `team.getProjection` carries
 *    `durableGeneration` (=== `generation`) + a non-empty `liveToken`
 *    inside `data.projection`; a v5 response does NOT carry either field
 *    (v1–v5 are unchanged — byte-identical frozen shape);
 *  - closed params: an extra field → `malformed-params` (unknown-field);
 *    a missing `sessionId` → `malformed-params` (missing-required); a
 *    malformed `sessionId` (whitespace) → `INVALID_SESSION_ID`;
 *  - the v6 pull assessment (`assessProjectionSyncV6`): the frozen pair
 *    verdict — first frame `apply`; a strictly newer durable generation
 *    `apply`; an EQUAL durable generation with a DIFFERENT liveToken
 *    `apply` (the live-only case — same status, no durable advance); both
 *    cells equal `duplicate`; an older durable generation `stale`; a
 *    different team `foreign`; a typed RPC error `rpc-error`; an
 *    internally inconsistent frame (durable cell disagrees with
 *    generation / missing liveToken / provenance mismatch)
 *    `inconsistent`.
 *
 * Test pattern of this repo (the plain-node shim's `it` is synchronous):
 * every async scenario runs at MODULE level (top-level await) and
 * captures its results; the `it` bodies are pure synchronous assertions.
 *
 * Matchers: toBe/toEqual/toBeGreaterThan (+.not) only.
 */

import { describe, expect, it } from 'vitest'

import {
  assessProjectionSyncV6,
  isRemoteMethodAvailableInVersion,
  REMOTE_CONTRACT_ERROR_CODES,
  REMOTE_CONTRACT_VERSION_V6,
  REMOTE_ID_ERROR_CODES,
  REMOTE_TEAM_GET_READ_STATE_FIELDS,
  REMOTE_V6_ONLY_METHODS,
  appliedIdentityFromV6,
  type AppliedProjectionIdentityV6,
  type RemoteProvenance,
  type RemoteResponse,
  type RemoteTeamGetReadStateValue,
  remoteCategoryOf,
} from '../src/index.js'
import {
  expectError,
  expectSuccess,
  makeDispatcher,
  makeFakePorts,
  P8T3_TEAM_SESSION_ID,
  p8t3Wire,
  p8t3WireV2,
  p8t3WireV3,
  p8t3WireV4,
  p8t3WireV5,
  p8t3WireV6,
} from './p8t3-helpers.js'

// ---------------------------------------------------------------------------
// Scenario constants
// ---------------------------------------------------------------------------

/** The v6 read-state storage-failure code (the closed storage code from
 *  the dispatcher's backing allow-list, invariant 4b — a
 *  storage/integrity failure). */
const C6_READ_STATE_BACKING_CODE = 'RECORD_INVALID'

/** One typed backing error (an `Error` carrying its closed `code`). */
function backingError(code: string): Error {
  const error = new Error(`backing: ${code}`)
  ;(error as Error & { code: string }).code = code
  return error
}

/** A legal closed v6 read-state value (team-root). */
/** The deterministic fake live token (a non-empty `lt-v1-*` string —
 *  the same shape the production token closure produces). */
const FAKE_LIVE_TOKEN =
  'lt-v1-0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef'
const FAKE_LIVE_TOKEN_2 =
  'lt-v1-fedcba9876543210fedcba9876543210fedcba9876543210fedcba9876543210'

const ROOT_READ_STATE: RemoteTeamGetReadStateValue = {
  relation: 'team-root',
  teamSessionId: P8T3_TEAM_SESSION_ID,
  memberInstanceId: null,
  disposed: false,
  durableGeneration: 7,
  liveToken: FAKE_LIVE_TOKEN,
}

/** A legal closed v6 read-state value (team-member, disposed). */
const MEMBER_READ_STATE: RemoteTeamGetReadStateValue = {
  relation: 'team-member',
  teamSessionId: P8T3_TEAM_SESSION_ID,
  memberInstanceId: 'inst-1',
  disposed: true,
  durableGeneration: 7,
  liveToken: FAKE_LIVE_TOKEN_2,
}

/** A legal closed v6 read-state value (none). */
const NONE_READ_STATE: RemoteTeamGetReadStateValue = {
  relation: 'none',
  teamSessionId: null,
  memberInstanceId: null,
  disposed: false,
  durableGeneration: null,
  liveToken: null,
}

/** The malformed port-value battery (label + the raw value) — the closed
 *  value is ENFORCED (every case → `internal-error` port contract). */
const BAD_READ_STATE_VALUES: ReadonlyArray<{ readonly label: string; readonly value: unknown }> = [
  { label: 'an unknown extra field', value: { ...ROOT_READ_STATE, hint: 'team' } },
  { label: 'missing relation', value: { teamSessionId: P8T3_TEAM_SESSION_ID, memberInstanceId: null, disposed: false, durableGeneration: 7 } },
  { label: 'a non-vocabulary relation', value: { ...ROOT_READ_STATE, relation: 'leader' } },
  { label: 'none with a non-null teamSessionId', value: { ...NONE_READ_STATE, teamSessionId: P8T3_TEAM_SESSION_ID } },
  { label: 'none with a non-null durableGeneration', value: { ...NONE_READ_STATE, durableGeneration: 3 } },
  { label: 'none with disposed true', value: { ...NONE_READ_STATE, disposed: true } },
  { label: 'team-member with a null memberInstanceId', value: { ...MEMBER_READ_STATE, memberInstanceId: null } },
  { label: 'team-member with a null durableGeneration', value: { ...MEMBER_READ_STATE, durableGeneration: null } },
  { label: 'team-root with a non-null memberInstanceId', value: { ...ROOT_READ_STATE, memberInstanceId: 'inst-1' } },
  { label: 'team-root with disposed true', value: { ...ROOT_READ_STATE, disposed: true } },
  { label: 'a non-boolean disposed', value: { ...ROOT_READ_STATE, disposed: 'no' } },
  { label: 'a zero durableGeneration', value: { ...ROOT_READ_STATE, durableGeneration: 0 } },
  { label: 'a non-string teamSessionId', value: { ...ROOT_READ_STATE, teamSessionId: 42 } },
  // PR #35 follow-up: the liveToken cell (a team relation CANNOT carry a
  // null/empty token — the host fails the read typed; `none` CANNOT carry
  // a token).
  { label: 'missing liveToken', value: { relation: 'team-root', teamSessionId: P8T3_TEAM_SESSION_ID, memberInstanceId: null, disposed: false, durableGeneration: 7 } },
  { label: 'team-root with a null liveToken', value: { ...ROOT_READ_STATE, liveToken: null } },
  { label: 'team-root with an empty liveToken', value: { ...ROOT_READ_STATE, liveToken: '' } },
  { label: 'team-root with a non-lt-v1 liveToken', value: { ...ROOT_READ_STATE, liveToken: 'gen-7' } },
  { label: 'team-member with a null liveToken', value: { ...MEMBER_READ_STATE, liveToken: null } },
  { label: 'none with a non-null liveToken', value: { ...NONE_READ_STATE, liveToken: FAKE_LIVE_TOKEN } },
]

// ---------------------------------------------------------------------------
// Module level (top-level await): drive the real dispatcher over the fake
// ports and capture every scenario result.
// ---------------------------------------------------------------------------

const RT = await (async () => {
  const base = makeDispatcher()

  // (a) getReadState: the world root → team-root (the closed value).
  // PR #35 follow-up: the C6 test drives the read-state port with its OWN
  // deterministic fixture (the p8t3 default world keeps its own fake
  // token for the p8t3 suites; `base` still serves the (f)/(g) projection
  // scenarios over the default world).
  const rootReadStateDispatcher = makeDispatcher({
    teamReadState: {
      readState() {
        return ROOT_READ_STATE
      },
    },
  })
  const rootReadState = await rootReadStateDispatcher.dispatch(
    'team.getReadState',
    p8t3WireV6({ sessionId: P8T3_TEAM_SESSION_ID }),
  )

  // (b) getReadState: a session with no affiliation → confirmed none
  // (the `none` answer carries `liveToken: null`).
  const noneReadStateDispatcher = makeDispatcher({
    teamReadState: {
      readState() {
        return NONE_READ_STATE
      },
    },
  })
  const noneReadState = await noneReadStateDispatcher.dispatch(
    'team.getReadState',
    p8t3WireV6({ sessionId: 'ordinary-session-1' }),
  )

  // (c) getReadState: a port returning a team-member (disposed) value —
  // the cross-field invariants hold for the member relation.
  const memberDispatcher = makeDispatcher({
    teamReadState: {
      readState() {
        return MEMBER_READ_STATE
      },
    },
  })
  const memberReadState = await memberDispatcher.dispatch(
    'team.getReadState',
    p8t3WireV6({ sessionId: 'child-session-1' }),
  )

  // (d) Malformed port values (port contract → `internal-error`).
  const badPortResponses: RemoteResponse[] = []
  for (const { value } of BAD_READ_STATE_VALUES) {
    const failing = makeDispatcher({
      teamReadState: {
        readState() {
          return value as never
        },
      },
    })
    const response = await failing.dispatch(
      'team.getReadState',
      p8t3WireV6({ sessionId: P8T3_TEAM_SESSION_ID }),
    )
    badPortResponses.push(response)
  }

  // (e) Fail closed: a storage-layer typed failure passes through typed
  // (invariant 4b) — never a silent `none` success.
  const failingPort = makeDispatcher({
    teamReadState: {
      readState() {
        throw backingError(C6_READ_STATE_BACKING_CODE)
      },
    },
  })
  const storageFailure = await failingPort.dispatch(
    'team.getReadState',
    p8t3WireV6({ sessionId: P8T3_TEAM_SESSION_ID }),
  )

  // (f) The v6 projection: the freshness pair inside data.projection.
  const v6Projection = await base.dispatch(
    'team.getProjection',
    p8t3WireV6({ teamSessionId: P8T3_TEAM_SESSION_ID }),
  )

  // (g) The v5 projection: the EXACT frozen shape (no v6 fields —
  // v1–v5 are unchanged).
  const v5Projection = await base.dispatch(
    'team.getProjection',
    p8t3WireV5({ teamSessionId: P8T3_TEAM_SESSION_ID }),
  )

  // (h) Version routing: v1–v5 requests to the v6-only method.
  const v1Routing = await base.dispatch('team.getReadState', p8t3Wire({ sessionId: P8T3_TEAM_SESSION_ID }))
  const v2Routing = await base.dispatch('team.getReadState', p8t3WireV2({ sessionId: P8T3_TEAM_SESSION_ID }))
  const v3Routing = await base.dispatch('team.getReadState', p8t3WireV3({ sessionId: P8T3_TEAM_SESSION_ID }))
  const v4Routing = await base.dispatch('team.getReadState', p8t3WireV4({ sessionId: P8T3_TEAM_SESSION_ID }))
  const v5Routing = await base.dispatch('team.getReadState', p8t3WireV5({ sessionId: P8T3_TEAM_SESSION_ID }))

  // (i) Closed params negatives.
  const extraField = await base.dispatch('team.getReadState', p8t3WireV6({ sessionId: P8T3_TEAM_SESSION_ID, hint: 'team' }))
  const missingSessionId = await base.dispatch('team.getReadState', p8t3WireV6({}))
  const malformedSessionId = await base.dispatch('team.getReadState', p8t3WireV6({ sessionId: 'bad session id' }))

  return {
    rootReadState,
    noneReadState,
    memberReadState,
    badPortResponses,
    storageFailure,
    v6Projection,
    v5Projection,
    v1Routing,
    v2Routing,
    v3Routing,
    v4Routing,
    v5Routing,
    extraField,
    missingSessionId,
    malformedSessionId,
  }
})()

// ---------------------------------------------------------------------------
// v6 pull-assessment fixtures (the frozen pair verdict)
// ---------------------------------------------------------------------------

function v6Provenance(generation: number): RemoteProvenance {
  return {
    origin: 'team-remote',
    method: 'team.getProjection',
    endpoint: 'team.getProjection',
    contractVersion: 6,
    requestToken: null,
    projectionGeneration: generation,
    effectSequence: null,
  }
}

function v6Response(generation: number, liveToken: string): RemoteResponse {
  return {
    ok: true,
    value: {
      data: {
        projection: {
          schemaVersion: 1,
          teamSessionId: P8T3_TEAM_SESSION_ID,
          blueprint: { blueprintId: 'bp-1', revision: 2 },
          generation,
          durableGeneration: generation,
          liveToken,
          generatedAt: '2026-09-28T00:00:00.000Z',
          root: { rootSessionId: P8T3_TEAM_SESSION_ID },
          templates: [],
          members: [],
          ledger: { entries: [], total: 0 },
        },
      },
      provenance: v6Provenance(generation),
    },
  }
}

const APPLIED_V6: AppliedProjectionIdentityV6 = {
  teamSessionId: P8T3_TEAM_SESSION_ID,
  durableGeneration: 7,
  liveToken: 'lt-a',
}

const AV = {
  // the frozen pair verdict matrix (frozen decision 4)
  firstFrame: assessProjectionSyncV6(null, v6Response(1, 'lt-1')),
  durableAdvance: assessProjectionSyncV6(APPLIED_V6, v6Response(8, 'lt-a')),
  liveOnly: assessProjectionSyncV6(APPLIED_V6, v6Response(7, 'lt-b')),
  duplicate: assessProjectionSyncV6(APPLIED_V6, v6Response(7, 'lt-a')),
  stale: assessProjectionSyncV6(APPLIED_V6, v6Response(6, 'lt-a')),
  foreign: assessProjectionSyncV6(
    { ...APPLIED_V6, teamSessionId: 'other-root' },
    v6Response(7, 'lt-a'),
  ),
  rpcError: assessProjectionSyncV6(APPLIED_V6, {
    ok: false,
    error: {
      code: 'TEAM_REMOTE_LEDGER_PAGE_REJECTED',
      message: 'rejected',
      details: {
        method: 'team.getProjection',
        endpoint: 'team.getProjection',
        contractVersion: 6,
        requestToken: null,
      },
    },
  }),
  inconsistentDurableMismatch: assessProjectionSyncV6(APPLIED_V6, {
    ok: true,
    value: {
      data: {
        projection: {
          schemaVersion: 1,
          teamSessionId: P8T3_TEAM_SESSION_ID,
          blueprint: {},
          generation: 7,
          durableGeneration: 9,
          liveToken: 'lt-a',
          generatedAt: '2026-09-28T00:00:00.000Z',
          root: {},
          templates: [],
          members: [],
          ledger: {},
        },
      },
      provenance: v6Provenance(7),
    },
  }),
  inconsistentMissingToken: assessProjectionSyncV6(APPLIED_V6, {
    ok: true,
    value: {
      data: {
        projection: {
          schemaVersion: 1,
          teamSessionId: P8T3_TEAM_SESSION_ID,
          blueprint: {},
          generation: 7,
          durableGeneration: 7,
          generatedAt: '2026-09-28T00:00:00.000Z',
          root: {},
          templates: [],
          members: [],
          ledger: {},
        },
      },
      provenance: v6Provenance(7),
    },
  }),
  inconsistentProvenance: assessProjectionSyncV6(APPLIED_V6, {
    ok: true,
    value: {
      data: {
        projection: {
          schemaVersion: 1,
          teamSessionId: P8T3_TEAM_SESSION_ID,
          blueprint: {},
          generation: 7,
          durableGeneration: 7,
          liveToken: 'lt-a',
          generatedAt: '2026-09-28T00:00:00.000Z',
          root: {},
          templates: [],
          members: [],
          ledger: {},
        },
      },
      // the provenance generation DISAGREES with the data generation.
      provenance: v6Provenance(5),
    },
  }),
}

// ---------------------------------------------------------------------------
// Assertions
// ---------------------------------------------------------------------------

describe('C6 (remote contract v6): catalog facts', () => {
  it('the closed v6 field set is exactly {sessionId} and the method lives in the team category', () => {
    expect([...REMOTE_TEAM_GET_READ_STATE_FIELDS].sort()).toEqual(['sessionId'])
    expect(remoteCategoryOf('team.getReadState')).toBe('team')
  })

  it('the closed v6-only set is exactly team.getReadState; the method is available in v6 and ONLY in v6', () => {
    expect([...REMOTE_V6_ONLY_METHODS].sort()).toEqual(['team.getReadState'])
    for (const version of [1, 2, 3, 4, 5]) {
      expect(isRemoteMethodAvailableInVersion('team.getReadState', version)).toBe(false)
    }
    expect(isRemoteMethodAvailableInVersion('team.getReadState', 6)).toBe(true)
    // the frozen v1–v5 methods stay available in v6 (additive bump)
    expect(isRemoteMethodAvailableInVersion('team.getProjection', 6)).toBe(true)
    expect(isRemoteMethodAvailableInVersion('team.prepareOrdinaryOpen', 6)).toBe(true)
  })
})

describe('C6 (remote contract v6): team.getReadState success', () => {
  it('the world root resolves to team-root: the CLOSED value (every field, null cells typed) + the provenance echoes 6', () => {
    const success = expectSuccess(RT.rootReadState)
    expect(success.value.data).toEqual(ROOT_READ_STATE)
    expect(success.value.provenance.contractVersion).toBe(REMOTE_CONTRACT_VERSION_V6)
    expect(success.value.provenance.method).toBe('team.getReadState')
    expect(success.value.provenance.endpoint).toBe('team.getReadState')
  })

  it('a session with no affiliation resolves to a confirmed none: null cells, never a storage guess', () => {
    const success = expectSuccess(RT.noneReadState)
    expect(success.value.data).toEqual(NONE_READ_STATE)
  })

  it('a team-member (disposed) value is legal: its cells are present, disposed true, and the relation marks the durable lifecycle', () => {
    const success = expectSuccess(RT.memberReadState)
    expect(success.value.data).toEqual(MEMBER_READ_STATE)
  })
})

describe('C6 (remote contract v6): the closed read-state value is enforced (fail closed)', () => {
  it('every malformed port value → internal-error port contract (never a silent none)', () => {
    expect(RT.badPortResponses.length).toBe(BAD_READ_STATE_VALUES.length)
    for (const response of RT.badPortResponses) {
      const error = expectError(response)
      expect(error.error.code).toBe(REMOTE_CONTRACT_ERROR_CODES.INTERNAL_ERROR)
      expect(error.error.code).toBe('internal-error')
    }
  })

  it('a storage-layer typed failure PASSES THROUGH typed (invariant 4b) — never translated into a none answer', () => {
    const error = expectError(RT.storageFailure)
    expect(error.error.code).toBe(C6_READ_STATE_BACKING_CODE)
    const wire = JSON.stringify(error.error)
    expect(wire.includes(C6_READ_STATE_BACKING_CODE)).toBe(true)
    // and it is an ERROR result, never a success carrying `none`.
    expect(error.ok).toBe(false)
  })
})

describe('C6 (remote contract v6): the v6 projection freshness pair', () => {
  it('a v6 getProjection carries durableGeneration (=== generation) + a non-empty liveToken inside data.projection', () => {
    const success = expectSuccess(RT.v6Projection)
    const data = success.value.data
    if (typeof data !== 'object' || data === null) throw new Error('expected a record data cell')
    const projection = (data as Record<string, unknown>)['projection'] as Record<string, unknown>
    const generation = projection['generation'] as number
    expect(typeof generation).toBe('number')
    expect(projection['durableGeneration']).toBe(generation)
    const liveToken = projection['liveToken']
    expect(typeof liveToken).toBe('string')
    expect((liveToken as string).length).toBeGreaterThan(0)
    expect(success.value.provenance.projectionGeneration).toBe(generation)
  })

  it('a v5 getProjection does NOT carry either v6 field (v1–v5 are unchanged — the frozen shape)', () => {
    const success = expectSuccess(RT.v5Projection)
    const data = success.value.data
    if (typeof data !== 'object' || data === null) throw new Error('expected a record data cell')
    const projection = (data as Record<string, unknown>)['projection'] as Record<string, unknown>
    expect('durableGeneration' in projection).toBe(false)
    expect('liveToken' in projection).toBe(false)
    expect(success.value.provenance.contractVersion).toBe(5)
  })
})

describe('C6 (remote contract v6): version routing (v1–v5 → method-version-unsupported)', () => {
  for (const [label, response] of [
    ['v1', RT.v1Routing],
    ['v2', RT.v2Routing],
    ['v3', RT.v3Routing],
    ['v4', RT.v4Routing],
    ['v5', RT.v5Routing],
  ] as const) {
    it(`a ${label} request → method-version-unsupported (typed after the envelope parse)`, () => {
      const error = expectError(response)
      expect(error.error.code).toBe(REMOTE_CONTRACT_ERROR_CODES.METHOD_VERSION_UNSUPPORTED)
    })
  }
})

describe('C6 (remote contract v6): closed params', () => {
  it('a client-provided extra field → malformed-params (unknown-field)', () => {
    const error = expectError(RT.extraField)
    expect(error.error.code).toBe(REMOTE_CONTRACT_ERROR_CODES.MALFORMED_PARAMS)
    const details = error.error.details as unknown as Record<string, unknown>
    expect(details['reason']).toBe('unknown-field')
    expect(details['field']).toBe('hint')
  })

  it('a missing sessionId → malformed-params (missing-required)', () => {
    const error = expectError(RT.missingSessionId)
    expect(error.error.code).toBe(REMOTE_CONTRACT_ERROR_CODES.MALFORMED_PARAMS)
    const details = error.error.details as unknown as Record<string, unknown>
    expect(details['reason']).toBe('missing-required')
    expect(details['field']).toBe('sessionId')
  })

  it('a malformed sessionId (whitespace) → INVALID_SESSION_ID', () => {
    const error = expectError(RT.malformedSessionId)
    expect(error.error.code).toBe(REMOTE_ID_ERROR_CODES.INVALID_SESSION_ID)
  })
})

describe('C6 (remote contract v6): the v6 pair verdict (assessProjectionSyncV6)', () => {
  it('the first frame is apply (it establishes the applied pair)', () => {
    expect(AV.firstFrame.status).toBe('apply')
    expect(AV.firstFrame.receivedGeneration).toBe(1)
  })

  it('a strictly newer durable generation is apply (the client refreshes its ledger on the advance)', () => {
    expect(AV.durableAdvance.status).toBe('apply')
    expect(AV.durableAdvance.receivedGeneration).toBe(8)
  })

  it('an EQUAL durable generation with a DIFFERENT liveToken is apply (the live-only case — the SAME status, no durable advance, no ledger refresh)', () => {
    expect(AV.liveOnly.status).toBe('apply')
    expect(AV.liveOnly.receivedGeneration).toBe(7)
  })

  it('both cells equal is duplicate (no state change)', () => {
    expect(AV.duplicate.status).toBe('duplicate')
  })

  it('an older durable generation is stale (never overwrite)', () => {
    expect(AV.stale.status).toBe('stale')
    expect(AV.stale.receivedGeneration).toBe(6)
  })

  it('a different team is foreign', () => {
    expect(AV.foreign.status).toBe('foreign')
  })

  it('a typed RPC error is rpc-error with the pass-through code', () => {
    expect(AV.rpcError.status).toBe('rpc-error')
    expect(AV.rpcError.code).toBe('TEAM_REMOTE_LEDGER_PAGE_REJECTED')
  })

  it('an internally inconsistent frame is inconsistent: the durable cell must agree with generation, the token must be present, and the provenance must agree (G8)', () => {
    expect(AV.inconsistentDurableMismatch.status).toBe('inconsistent')
    expect(AV.inconsistentMissingToken.status).toBe('inconsistent')
    expect(AV.inconsistentProvenance.status).toBe('inconsistent')
  })

  it('appliedIdentityFromV6 records the frozen PAIR anchored to the team (deterministic, pure)', () => {
    const identity = appliedIdentityFromV6({
      schemaVersion: 1,
      teamSessionId: P8T3_TEAM_SESSION_ID,
      blueprint: {},
      generation: 7,
      durableGeneration: 7,
      liveToken: 'lt-x',
      generatedAt: '2026-09-28T00:00:00.000Z',
      root: {},
      templates: [],
      members: [],
      ledger: {},
    })
    expect(identity).toEqual({
      teamSessionId: P8T3_TEAM_SESSION_ID,
      durableGeneration: 7,
      liveToken: 'lt-x',
    })
  })
})
