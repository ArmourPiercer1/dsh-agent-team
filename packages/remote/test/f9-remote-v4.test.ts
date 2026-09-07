/**
 * f9-remote-v4.test.ts — F9 (F3/F11/F9/T1.4 repair round r1): the Remote
 * contract v4 / v4-only-method surface of `@dsh-agent-team/remote`.
 *
 * Must-covers (F9 task card, remote half; adjudications U1–U4):
 *  - persistent contract: the 27-method versioned union (23 v1 + 1
 *    v2-only + 2 v3-only + 1 v4-only), the frozen v1 baseline constant
 *    still 1, the closed v4-only set exactly `['team.resolveControl']`,
 *    the closed v4 field set `{teamSessionId, requestId, decision,
 *    note?}` and the closed decision set `['allow','deny']`, the
 *    version-aware availability matrix (v1/v2/v3 reject the v4-only
 *    method; v4 admits the full surface);
 *  - version routing: a v1 / v2 / v3 request to `team.resolveControl` →
 *    typed `method-version-unsupported` (checked in the version-aware
 *    param parser, AFTER the envelope parse — the endpoint passes the
 *    pre-envelope closed-catalog check);
 *  - closed v4 params: the frozen field set is ENFORCED — a client-
 *    provided `caller` / `role` / `actor` field is an `unknown-field`
 *    (adjudication U3: the wire carries NO caller/role fields; the host
 *    derives the human principal); missing required fields →
 *    `missing-required`; out-of-closed-set `decision` / malformed
 *    `requestId` / `teamSessionId` / oversized `note` → `invalid-value`;
 *    a non-record params block → `malformed-request` at the envelope
 *    boundary;
 *  - success: the v4 request forwards `teamSessionId` / `requestId` /
 *    `decision` / `note` verbatim to the `teamResolveControl` port
 *    (port call logged exactly once), the success `data` is
 *    `{ decision: <durable ControlDecision record> }` validated against
 *    the closed v4 shape, and the provenance `contractVersion` echoes 4;
 *  - backing error allow-list (invariant 4b): the seven F9-emitted
 *    CONTROL_* wire codes + `TEAM_REMOTE_TEAM_RESOLVE_CONTROL_UNAVAILABLE`
 *    pass through with code + message (details.reason 'domain-error' +
 *    the source identity under details.cause); an out-of-vocabulary
 *    `Error.code` (ENOENT) degrades to `internal-error` with no leak;
 *  - v1/v2/v3 wire behavior is PRESERVED (a v1 `team.getProjection`
 *    round-trips on the v1 envelope; the v2-only and v3-only methods
 *    still succeed on their own version).
 *
 * Test pattern of this repo (the plain-node shim's `it` is synchronous):
 * every async scenario runs at MODULE level (top-level await) and
 * captures its results; the `it` bodies are pure synchronous assertions.
 *
 * Matchers: toBe/toEqual/toBeGreaterThan (+.not) only.
 */

import { describe, expect, it } from 'vitest'

import {
  isRemoteMethodAvailableInVersion,
  remoteCategoryOf,
  REMOTE_CONTRACT_VERSION,
  REMOTE_CONTRACT_VERSION_V2,
  REMOTE_CONTRACT_VERSION_V3,
  REMOTE_CONTRACT_VERSION_V4,
  REMOTE_CONTRACT_ERROR_CODES,
  REMOTE_METHOD_NAMES,
  REMOTE_TEAM_RESOLVE_CONTROL_DECISIONS,
  REMOTE_TEAM_RESOLVE_CONTROL_FIELDS,
  REMOTE_V2_ONLY_METHODS,
  REMOTE_V3_ONLY_METHODS,
  REMOTE_V4_ONLY_METHODS,
  type RemoteErrorResult,
  type RemoteSafeRecord,
} from '../src/index.js'
import {
  expectError,
  expectSuccess,
  makeDispatcher,
  p8t3Wire,
  p8t3WireV2,
  p8t3WireV3,
  p8t3WireV4,
  P8T3_TEAM_SESSION_ID,
} from './p8t3-helpers.js'

// ---------------------------------------------------------------------------
// Scenario constants
// ---------------------------------------------------------------------------

/** The F9-emitted CONTROL_* wire codes (the runtime/control service
 *  vocabulary reachable from `resolveControl`) + the S6 unavailability
 *  code (the fail-closed backing absence). The guard codes
 *  (CONTROL_GUARD_MALFORMED / CONTROL_GUARD_AMBIGUOUS) are NOT reachable
 *  from `resolveControl` and stay OUT of the closed backing set. */
const F9_CONTROL_BACKING_CODES = [
  'CONTROL_REQUEST_MALFORMED',
  'CONTROL_TARGET_STALE',
  'CONTROL_REQUEST_NOT_FOUND',
  'CONTROL_REQUEST_DECIDED',
  'CONTROL_RESOLVER_NOT_AUTHORIZED',
  'CONTROL_REQUEST_STALE',
  'CONTROL_EXTERNAL_POLICY_DENIED',
] as const

/** The S6 fail-closed code for an absent control service. */
const F9_UNAVAILABLE_CODE = 'TEAM_REMOTE_TEAM_RESOLVE_CONTROL_UNAVAILABLE'

/** The frozen valid v4 params (the closed set, note present). */
const F9_REQUEST_ID = 'ctl-request-f9-0001'
const F9_NOTE = 'the human decision note'
const F9_VALID_PARAMS = {
  teamSessionId: P8T3_TEAM_SESSION_ID,
  requestId: F9_REQUEST_ID,
  decision: 'allow',
  note: F9_NOTE,
}

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
  // (a) The base dispatcher: the default fake ports (the v4 port logs
  // its call + echoes its arguments into the returned record, stamping
  // the host-stamped human principal + the team scope).
  const base = makeDispatcher()

  // (b) A dispatcher whose `teamResolveControl` port FAILS with each F9
  // backing code (the invariant-4b pass-through battery).
  const backingFailureResponses = new Map<string, RemoteErrorResult>()
  for (const code of [...F9_CONTROL_BACKING_CODES, F9_UNAVAILABLE_CODE]) {
    const failing = makeDispatcher({
      teamResolveControl: {
        resolveControl() {
          throw backingError(code)
        },
      },
    })
    const response = await failing.dispatch('team.resolveControl', p8t3WireV4({ ...F9_VALID_PARAMS, decision: 'deny' }))
    const error = expectError(response)
    backingFailureResponses.set(code, error)
  }

  // (c) A dispatcher whose `teamResolveControl` port fails with an
  // OUT-OF-VOCABULARY code (the invariant-5 no-leak negative).
  const enoent = makeDispatcher({
    teamResolveControl: {
      resolveControl() {
        throw backingError('ENOENT')
      },
    },
  })
  const outOfVocabularyResponse = await enoent.dispatch(
    'team.resolveControl',
    p8t3WireV4({ ...F9_VALID_PARAMS, decision: 'deny' }),
  )

  // (d) The success path (allow, with note — the frozen params verbatim).
  const allowWithNote = await base.dispatch('team.resolveControl', p8t3WireV4(F9_VALID_PARAMS))
  // (e) The success path (deny, WITHOUT note — the note stays absent).
  const denyWithoutNote = await base.dispatch(
    'team.resolveControl',
    p8t3WireV4({
      teamSessionId: P8T3_TEAM_SESSION_ID,
      requestId: F9_REQUEST_ID,
      decision: 'deny',
    }),
  )
  // (f) The note bound: 2048 (max) succeeds, 2049 is invalid-value.
  const noteMax = await base.dispatch(
    'team.resolveControl',
    p8t3WireV4({ ...F9_VALID_PARAMS, decision: 'deny', note: 'n'.repeat(2048) }),
  )
  const noteOversized = await base.dispatch(
    'team.resolveControl',
    p8t3WireV4({ ...F9_VALID_PARAMS, decision: 'deny', note: 'n'.repeat(2049) }),
  )

  // (g) The closed-param negatives (all on the v4 envelope).
  const unknownCallerField = await base.dispatch(
    'team.resolveControl',
    p8t3WireV4({ ...F9_VALID_PARAMS, decision: 'deny', caller: { kind: 'human', humanId: 'spoof' } }),
  )
  const unknownRoleField = await base.dispatch(
    'team.resolveControl',
    p8t3WireV4({ ...F9_VALID_PARAMS, decision: 'deny', role: 'human' }),
  )
  const unknownActorField = await base.dispatch(
    'team.resolveControl',
    p8t3WireV4({ ...F9_VALID_PARAMS, decision: 'deny', actor: 'someone' }),
  )
  const missingTeamSessionId = await base.dispatch(
    'team.resolveControl',
    p8t3WireV4({ requestId: F9_REQUEST_ID, decision: 'deny' }),
  )
  const missingRequestId = await base.dispatch(
    'team.resolveControl',
    p8t3WireV4({ teamSessionId: P8T3_TEAM_SESSION_ID, decision: 'deny' }),
  )
  const missingDecision = await base.dispatch(
    'team.resolveControl',
    p8t3WireV4({ teamSessionId: P8T3_TEAM_SESSION_ID, requestId: F9_REQUEST_ID }),
  )
  const invalidDecision = await base.dispatch(
    'team.resolveControl',
    p8t3WireV4({ ...F9_VALID_PARAMS, decision: 'maybe' }),
  )
  const staleDeniedDecision = await base.dispatch(
    'team.resolveControl',
    p8t3WireV4({ ...F9_VALID_PARAMS, decision: 'stale-denied' }),
  )
  const emptyRequestId = await base.dispatch(
    'team.resolveControl',
    p8t3WireV4({ ...F9_VALID_PARAMS, decision: 'deny', requestId: '' }),
  )
  const whitespaceRequestId = await base.dispatch(
    'team.resolveControl',
    p8t3WireV4({ ...F9_VALID_PARAMS, decision: 'deny', requestId: 'has space' }),
  )
  const invalidTeamSessionId = await base.dispatch(
    'team.resolveControl',
    p8t3WireV4({ ...F9_VALID_PARAMS, decision: 'deny', teamSessionId: 'has space' }),
  )
  const emptyNote = await base.dispatch(
    'team.resolveControl',
    p8t3WireV4({ ...F9_VALID_PARAMS, decision: 'deny', note: '' }),
  )
  const nullNote = await base.dispatch(
    'team.resolveControl',
    p8t3WireV4({ ...F9_VALID_PARAMS, decision: 'deny', note: null }),
  )
  const nonRecordParams = await base.dispatch('team.resolveControl', p8t3WireV4('not an object' as unknown as Record<string, unknown>))
  const nullParams = await base.dispatch('team.resolveControl', { version: REMOTE_CONTRACT_VERSION_V4, params: null })

  // (h) Version routing: v1 / v2 / v3 requests to the v4-only method
  // (typed AFTER the envelope parse).
  const v1ToV4Only = await base.dispatch('team.resolveControl', p8t3Wire(F9_VALID_PARAMS))
  const v2ToV4Only = await base.dispatch('team.resolveControl', p8t3WireV2(F9_VALID_PARAMS))
  const v3ToV4Only = await base.dispatch('team.resolveControl', p8t3WireV3(F9_VALID_PARAMS))

  // (i) v1/v2/v3 wire behavior PRESERVED (the round-trips).
  const v1Projection = await base.dispatch('team.getProjection', p8t3Wire({ teamSessionId: P8T3_TEAM_SESSION_ID }))
  const v2AdmitOnV1 = await base.dispatch('team.admitInitialWork', p8t3Wire({
    rootSessionId: 'root-session-f9-v2',
    requestToken: 'tok-f9-v2',
    prompt: 'the initial work',
  }))
  const v3ListRoots = await base.dispatch('team.listRoots', p8t3WireV3({}))

  return {
    baseCalls: base.ports.calls,
    backingFailureResponses,
    outOfVocabulary: outOfVocabularyResponse,
    allowWithNote,
    denyWithoutNote,
    noteMax,
    noteOversized,
    unknownCallerField,
    unknownRoleField,
    unknownActorField,
    missingTeamSessionId,
    missingRequestId,
    missingDecision,
    invalidDecision,
    staleDeniedDecision,
    emptyRequestId,
    whitespaceRequestId,
    invalidTeamSessionId,
    emptyNote,
    nullNote,
    nonRecordParams,
    nullParams,
    v1ToV4Only,
    v2ToV4Only,
    v3ToV4Only,
    v1Projection,
    v2AdmitOnV1,
    v3ListRoots,
  }
})()

// ---------------------------------------------------------------------------
// Assertions (synchronous `it` bodies over the captured results)
// ---------------------------------------------------------------------------

describe('F9 (remote contract v4): catalog facts', () => {
  it('the catalog is the 27-method versioned union; the v4-only set is exactly team.resolveControl', () => {
    expect(REMOTE_METHOD_NAMES.length).toBe(27)
    expect(REMOTE_METHOD_NAMES.includes('team.resolveControl')).toBe(true)
    expect([...REMOTE_V4_ONLY_METHODS].sort()).toEqual(['team.resolveControl'])
    // the v4-only method is disjoint from the v2/v3-only surfaces and
    // the frozen v1 methods are all still present (23)
    const v1Count =
      REMOTE_METHOD_NAMES.length -
      REMOTE_V2_ONLY_METHODS.length -
      REMOTE_V3_ONLY_METHODS.length -
      REMOTE_V4_ONLY_METHODS.length
    expect(v1Count).toBe(23)
  })

  it('the frozen v1 baseline constant is still 1; v4 is a distinct stamp (U1: one bump)', () => {
    expect(REMOTE_CONTRACT_VERSION).toBe(1)
    expect(REMOTE_CONTRACT_VERSION_V2).toBe(2)
    expect(REMOTE_CONTRACT_VERSION_V3).toBe(3)
    expect(REMOTE_CONTRACT_VERSION_V4).toBe(4)
  })

  it('the closed v4 field set and decision set are frozen (U3: NO caller/role fields)', () => {
    expect([...REMOTE_TEAM_RESOLVE_CONTROL_FIELDS].sort()).toEqual([
      'decision',
      'note',
      'requestId',
      'teamSessionId',
    ])
    expect([...REMOTE_TEAM_RESOLVE_CONTROL_DECISIONS].sort()).toEqual(['allow', 'deny'])
    // the closed set carries no identity fields
    expect(REMOTE_TEAM_RESOLVE_CONTROL_FIELDS.includes('caller')).toBe(false)
    expect(REMOTE_TEAM_RESOLVE_CONTROL_FIELDS.includes('role')).toBe(false)
    expect(REMOTE_TEAM_RESOLVE_CONTROL_FIELDS.includes('actor')).toBe(false)
  })

  it('the v4-only method lives in the team category (U2: the existing team category)', () => {
    expect(remoteCategoryOf('team.resolveControl')).toBe('team')
  })

  it('the availability matrix: v1/v2/v3 reject the v4-only method; v4 admits the full surface', () => {
    expect(isRemoteMethodAvailableInVersion('team.resolveControl', 1)).toBe(false)
    expect(isRemoteMethodAvailableInVersion('team.resolveControl', 2)).toBe(false)
    expect(isRemoteMethodAvailableInVersion('team.resolveControl', 3)).toBe(false)
    expect(isRemoteMethodAvailableInVersion('team.resolveControl', 4)).toBe(true)
    // the v4 bump admits the whole v1–v3 surface too (no method lost)
    expect(isRemoteMethodAvailableInVersion('team.getProjection', 4)).toBe(true)
    expect(isRemoteMethodAvailableInVersion('team.admitInitialWork', 4)).toBe(true)
    expect(isRemoteMethodAvailableInVersion('team.listRoots', 4)).toBe(true)
    expect(isRemoteMethodAvailableInVersion('team.ensureRootLive', 4)).toBe(true)
  })
})

describe('F9 (remote contract v4): version routing (v1-v3 rejection preserved)', () => {
  it('a v1 request to team.resolveControl → method-version-unsupported (typed after envelope parse)', () => {
    const error = expectError(RT.v1ToV4Only)
    expect(error.error.code).toBe(REMOTE_CONTRACT_ERROR_CODES.METHOD_VERSION_UNSUPPORTED)
    expect(error.error.code).toBe('method-version-unsupported')
    const details = error.error.details as unknown as Record<string, unknown>
    expect(details['method']).toBe('team.resolveControl')
    expect(details['field']).toBe('method')
    expect(details['reason']).toBe('method-not-available-in-version')
    // the request version is the v1 envelope (the check is version-aware)
    expect(details['contractVersion']).toBe(REMOTE_CONTRACT_VERSION)
  })

  it('a v2 request to team.resolveControl → method-version-unsupported', () => {
    const error = expectError(RT.v2ToV4Only)
    expect(error.error.code).toBe('method-version-unsupported')
    const details = error.error.details as unknown as Record<string, unknown>
    expect(details['method']).toBe('team.resolveControl')
    expect(details['contractVersion']).toBe(REMOTE_CONTRACT_VERSION_V2)
  })

  it('a v3 request to team.resolveControl → method-version-unsupported', () => {
    const error = expectError(RT.v3ToV4Only)
    expect(error.error.code).toBe('method-version-unsupported')
    const details = error.error.details as unknown as Record<string, unknown>
    expect(details['method']).toBe('team.resolveControl')
    expect(details['contractVersion']).toBe(REMOTE_CONTRACT_VERSION_V3)
  })
})

describe('F9 (remote contract v4): closed params (the frozen field set is enforced)', () => {
  it('a client-provided caller field is an unknown-field (U3: the wire carries no identity)', () => {
    const error = expectError(RT.unknownCallerField)
    expect(error.error.code).toBe(REMOTE_CONTRACT_ERROR_CODES.MALFORMED_PARAMS)
    const details = error.error.details as unknown as Record<string, unknown>
    expect(details['field']).toBe('caller')
    expect(details['reason']).toBe('unknown-field')
  })

  it('a client-provided role field is an unknown-field', () => {
    const error = expectError(RT.unknownRoleField)
    expect(error.error.code).toBe('malformed-params')
    const details = error.error.details as unknown as Record<string, unknown>
    expect(details['field']).toBe('role')
    expect(details['reason']).toBe('unknown-field')
  })

  it('a client-provided actor field is an unknown-field', () => {
    const error = expectError(RT.unknownActorField)
    expect(error.error.code).toBe('malformed-params')
    const details = error.error.details as unknown as Record<string, unknown>
    expect(details['field']).toBe('actor')
    expect(details['reason']).toBe('unknown-field')
  })

  it('missing teamSessionId / requestId / decision → missing-required', () => {
    const missingTeam = expectError(RT.missingTeamSessionId)
    expect(missingTeam.error.code).toBe('malformed-params')
    expect((missingTeam.error.details as unknown as Record<string, unknown>)['field']).toBe('teamSessionId')
    expect((missingTeam.error.details as unknown as Record<string, unknown>)['reason']).toBe('missing-required')

    const missingRequest = expectError(RT.missingRequestId)
    expect(missingRequest.error.code).toBe('malformed-params')
    expect((missingRequest.error.details as unknown as Record<string, unknown>)['field']).toBe('requestId')

    const missingDecision = expectError(RT.missingDecision)
    expect(missingDecision.error.code).toBe('malformed-params')
    expect((missingDecision.error.details as unknown as Record<string, unknown>)['field']).toBe('decision')
  })

  it('an out-of-closed-set decision → invalid-value; the closed set is exactly allow | deny (U3)', () => {
    const error = expectError(RT.invalidDecision)
    expect(error.error.code).toBe('malformed-params')
    const details = error.error.details as unknown as Record<string, unknown>
    expect(details['field']).toBe('decision')
    expect(details['reason']).toBe('invalid-value')
    expect(error.error.message.includes('allow')).toBe(true)
    expect(error.error.message.includes('deny')).toBe(true)
  })

  it('stale-denied (a durable-plane decision value) is NOT a wire decision (the wire set is allow | deny)', () => {
    const error = expectError(RT.staleDeniedDecision)
    expect(error.error.code).toBe('malformed-params')
    expect((error.error.details as unknown as Record<string, unknown>)['reason']).toBe('invalid-value')
  })

  it('an empty / whitespace requestId → invalid-value (the opaque-token rule)', () => {
    const empty = expectError(RT.emptyRequestId)
    expect(empty.error.code).toBe('malformed-params')
    expect((empty.error.details as unknown as Record<string, unknown>)['reason']).toBe('invalid-value')
    const whitespace = expectError(RT.whitespaceRequestId)
    expect(whitespace.error.code).toBe('malformed-params')
    expect((whitespace.error.details as unknown as Record<string, unknown>)['field']).toBe('requestId')
  })

  it('a malformed teamSessionId → the frozen P3 INVALID_ROOT_SESSION_ID (deviation D-1)', () => {
    const error = expectError(RT.invalidTeamSessionId)
    expect(error.error.code).toBe('INVALID_ROOT_SESSION_ID')
    expect((error.error.details as unknown as Record<string, unknown>)['field']).toBe('teamSessionId')
  })

  it('an empty / null note → invalid-value (the note is 1..2048 chars, any content)', () => {
    const empty = expectError(RT.emptyNote)
    expect(empty.error.code).toBe('malformed-params')
    expect((empty.error.details as unknown as Record<string, unknown>)['field']).toBe('note')
    expect((empty.error.details as unknown as Record<string, unknown>)['reason']).toBe('invalid-value')
    const nullNote = expectError(RT.nullNote)
    expect(nullNote.error.code).toBe('malformed-params')
    expect((nullNote.error.details as unknown as Record<string, unknown>)['field']).toBe('note')
  })

  it('a 2049-char note → invalid-value; a 2048-char note succeeds (the bound)', () => {
    const oversized = expectError(RT.noteOversized)
    expect(oversized.error.code).toBe('malformed-params')
    expect((oversized.error.details as unknown as Record<string, unknown>)['reason']).toBe('invalid-value')
    const atMax = expectSuccess(RT.noteMax)
    // the fake port echoes its arguments: the 2048-char note round-trips
    const decision = (atMax.value.data as unknown as Record<string, unknown>)['decision'] as unknown as Record<string, unknown>
    expect((decision['note'] as string).length).toBe(2048)
  })

  it('a non-record / null params block → malformed-request at the envelope boundary', () => {
    const stringParams = expectError(RT.nonRecordParams)
    expect(stringParams.error.code).toBe(REMOTE_CONTRACT_ERROR_CODES.MALFORMED_REQUEST)
    const nullParams = expectError(RT.nullParams)
    expect(nullParams.error.code).toBe('malformed-request')
  })
})

describe('F9 (remote contract v4): team.resolveControl success (port forwarding + provenance)', () => {
  it('a v4 allow request succeeds: data is { decision: <durable record> }, provenance echoes 4', () => {
    const success = expectSuccess(RT.allowWithNote)
    expect(success.value.provenance.contractVersion).toBe(REMOTE_CONTRACT_VERSION_V4)
    expect(success.value.provenance.method).toBe('team.resolveControl')
    expect(success.value.provenance.endpoint).toBe('team.resolveControl')
    const data = success.value.data as unknown as Record<string, unknown>
    const decision = data['decision'] as unknown as Record<string, unknown>
    // the frozen v4 success shape (the durable ControlDecision record)
    expect(decision['requestId']).toBe(F9_REQUEST_ID)
    expect(decision['decision']).toBe('allow')
    expect(decision['note']).toBe(F9_NOTE)
    expect(decision['requestSequence']).toBe(1)
    expect(decision['decisionSequence']).toBe(2)
    expect(decision['createdAt']).toBe('2026-08-29T00:00:09.000Z')
    // the host-stamped human principal + the team scope (the fake port
    // mirrors the production stamping contract)
    expect(decision['decider']).toEqual({ kind: 'human', humanId: P8T3_TEAM_SESSION_ID })
    expect(decision['scope']).toEqual({ teamSessionId: P8T3_TEAM_SESSION_ID })
  })

  it('a v4 deny request WITHOUT note: the note key stays absent (optional fields do not materialize)', () => {
    const success = expectSuccess(RT.denyWithoutNote)
    const decision = (success.value.data as unknown as Record<string, unknown>)['decision'] as unknown as Record<string, unknown>
    expect(decision['decision']).toBe('deny')
    expect('note' in (decision as object)).toBe(false)
  })

  it('the port is called exactly once with the frozen params (read the fake log)', () => {
    const resolveCalls = RT.baseCalls.filter((call) => call === 'team.resolveControl')
    // (a) allow-with-note + (e) deny-without-note + (f) note-max: three
    // successful v4 requests reached the port on the base dispatcher.
    expect(resolveCalls.length).toBe(3)
  })

  it('the params are forwarded verbatim (the echo proves teamSessionId/requestId/decision/note)', () => {
    // the fake port echoes its arguments into the returned record
    const allow = expectSuccess(RT.allowWithNote)
    const allowDecision = (allow.value.data as unknown as Record<string, unknown>)['decision'] as unknown as Record<string, unknown>
    expect(allowDecision['requestId']).toBe(F9_REQUEST_ID)
    expect(allowDecision['scope']).toEqual({ teamSessionId: P8T3_TEAM_SESSION_ID })
    expect(allowDecision['decider']).toEqual({ kind: 'human', humanId: P8T3_TEAM_SESSION_ID })
    expect(allowDecision['note']).toBe(F9_NOTE)
    const deny = expectSuccess(RT.denyWithoutNote)
    const denyDecision = (deny.value.data as unknown as Record<string, unknown>)['decision'] as unknown as Record<string, unknown>
    expect(denyDecision['decision']).toBe('deny')
  })
})

describe('F9 (remote contract v4): backing error allow-list (invariant 4b)', () => {
  it('every F9-emitted CONTROL_* wire code + the unavailability code passes through with code + message', () => {
    expect(RT.backingFailureResponses.size).toBe(8)
    for (const code of [...F9_CONTROL_BACKING_CODES, F9_UNAVAILABLE_CODE]) {
      const error = RT.backingFailureResponses.get(code)
      if (error === undefined) throw new Error(`missing captured failure for ${code}`)
      expect(error.error.code).toBe(code)
      expect(error.error.message).toBe(`backing: ${code}`)
      const details = error.error.details as unknown as Record<string, unknown>
      expect(details['reason']).toBe('domain-error')
      const cause = details['cause'] as unknown as Record<string, unknown>
      expect(cause['code']).toBe(code)
      expect(cause['message']).toBe(`backing: ${code}`)
      // the provenance context rides along (the v4 request)
      expect(details['contractVersion']).toBe(REMOTE_CONTRACT_VERSION_V4)
    }
  })

  it('an out-of-vocabulary code (ENOENT) degrades to internal-error with no leak', () => {
    const error = expectError(RT.outOfVocabulary)
    expect(error.error.code).toBe(REMOTE_CONTRACT_ERROR_CODES.INTERNAL_ERROR)
    expect(error.error.message).toBe('internal error in remote handler')
    const wire = JSON.stringify(error.error)
    expect(wire.includes('ENOENT')).toBe(false)
    expect(wire.includes('backing:')).toBe(false)
    const details = error.error.details as unknown as Record<string, unknown>
    expect(details['reason']).toBe('untyped-error')
  })
})

describe('F9 (remote contract v4): v1/v2/v3 wire behavior is preserved', () => {
  it('a v1 team.getProjection still round-trips on the v1 envelope (provenance 1)', () => {
    const success = expectSuccess(RT.v1Projection)
    expect(success.value.provenance.contractVersion).toBe(REMOTE_CONTRACT_VERSION)
    const data = success.value.data as unknown as Record<string, unknown>
    expect('projection' in data).toBe(true)
  })

  it('a v1 request to the v2-only team.admitInitialWork is still rejected (the v1-v3 matrix holds)', () => {
    const error = expectError(RT.v2AdmitOnV1)
    expect(error.error.code).toBe('method-version-unsupported')
  })

  it('a v3 team.listRoots still round-trips on the v3 envelope (provenance 3)', () => {
    const success = expectSuccess(RT.v3ListRoots)
    expect(success.value.provenance.contractVersion).toBe(REMOTE_CONTRACT_VERSION_V3)
    const data = success.value.data as unknown as Record<string, unknown>
    expect(Array.isArray(data['roots'])).toBe(true)
    expect((data['roots'] as unknown[]).length).toBeGreaterThan(0)
  })
})
