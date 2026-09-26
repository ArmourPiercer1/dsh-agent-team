/**
 * c1-remote-v5.test.ts — C1 (restart-0.1.7-rc.1 recovery, guide §10 +
 * §10.2 + §13.5, verdict gate-5): the Remote contract v5 /
 * v5-only-method surface of `@dsh-agent-team/remote`.
 *
 * The v5 bump adds EXACTLY ONE method: `team.prepareOrdinaryOpen` — the
 * one-shot ordinary-mode activation PERMIT (the client-side
 * `openOrdinaryMode` two-phase sequence awaits it BEFORE the native
 * session open). It is a Team control-plane RPC (the host validates the
 * teamSessionId and stamps the one-shot permit with a TTL) — it performs
 * ZERO Team ensure and ZERO Team Agent side effects.
 *
 * Must-covers (C1 task card, remote half; the catalog-fact pins — the
 * 28-method union, the supported set [1,2,3,4,5], the closed v5-only
 * set, the availability matrix — live in d1-remote-v3 / tcm-m1-remote-v2
 * / f9-remote-v4 and were moved with this bump):
 *  - version routing: a v1 / v2 / v3 / v4 request to
 *    `team.prepareOrdinaryOpen` → typed `method-version-unsupported`
 *    (checked in the version-aware param parser, AFTER the envelope
 *    parse — the endpoint passes the pre-envelope closed-catalog check);
 *  - closed v5 params: the frozen field set `{teamSessionId}` is
 *    ENFORCED — a client-provided extra field → `malformed-params`
 *    (unknown-field); a missing `teamSessionId` → `malformed-params`
 *    (missing-required); a malformed id (whitespace) →
 *    `INVALID_ROOT_SESSION_ID`;
 *  - success: the v5 request forwards `teamSessionId` verbatim to the
 *    `teamPrepareOrdinaryOpen` port (port call logged exactly once), the
 *    success `data` is the port value validated against the at-least
 *    shape `{ rootSessionId, permitted: true }` (a missing / non-string
 *    `rootSessionId` or a non-`true` `permitted` → `internal-error` port
 *    contract), EXTRA fields pass through verbatim (D-4), and the
 *    provenance `contractVersion` echoes 5;
 *  - backing error allow-list (invariant 4b): the C1-emitted
 *    `TEAM_REMOTE_TEAM_ORDINARY_OPEN_PORT_UNAVAILABLE` + the existing
 *    `TEAM_REMOTE_FOREIGN_TEAM` code pass through with code + message
 *    (details.reason 'domain-error'); an out-of-vocabulary `Error.code`
 *    (ENOENT) degrades to `internal-error` with no leak.
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
  REMOTE_CONTRACT_ERROR_CODES,
  REMOTE_CONTRACT_VERSION_V5,
  REMOTE_ID_ERROR_CODES,
  REMOTE_TEAM_PREPARE_ORDINARY_OPEN_FIELDS,
  remoteCategoryOf,
  type RemoteErrorResult,
  type RemoteSafeRecord,
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
} from './p8t3-helpers.js'

// ---------------------------------------------------------------------------
// Scenario constants
// ---------------------------------------------------------------------------

/** The v5-emitted + pre-existing wire codes that MUST pass through typed
 *  (invariant 4b) — the C1 port-unavailability code joins the existing
 *  `TEAM_REMOTE_FOREIGN_TEAM` code. */
const C1_V5_BACKING_CODES = [
  'TEAM_REMOTE_TEAM_ORDINARY_OPEN_PORT_UNAVAILABLE',
  'TEAM_REMOTE_FOREIGN_TEAM',
] as const

/** One typed backing error (an `Error` carrying its closed `code`). */
function backingError(code: string): Error {
  const error = new Error(`backing: ${code}`)
  ;(error as Error & { code: string }).code = code
  return error
}

/** The malformed port-value battery (label + the raw value). */
const BAD_PORT_VALUES: ReadonlyArray<{ readonly label: string; readonly value: unknown }> = [
  { label: 'missing rootSessionId', value: { permitted: true } },
  { label: 'a non-string rootSessionId', value: { rootSessionId: 42, permitted: true } },
  { label: 'an empty rootSessionId', value: { rootSessionId: '', permitted: true } },
  { label: 'permitted: false', value: { rootSessionId: P8T3_TEAM_SESSION_ID, permitted: false } },
  { label: 'permitted: "yes"', value: { rootSessionId: P8T3_TEAM_SESSION_ID, permitted: 'yes' } },
  { label: 'missing permitted', value: { rootSessionId: P8T3_TEAM_SESSION_ID } },
]

// ---------------------------------------------------------------------------
// Module level (top-level await): drive the real dispatcher over the fake
// ports and capture every scenario result.
// ---------------------------------------------------------------------------

const RT = await (async () => {
  // (a) The base dispatcher: the default fake ports (the v5 port logs
  // its calls and returns { rootSessionId, permitted: true }).
  const base = makeDispatcher()
  const success = await base.dispatch(
    'team.prepareOrdinaryOpen',
    p8t3WireV5({ teamSessionId: P8T3_TEAM_SESSION_ID }),
  )

  // (b) A port value that carries EXTRA fields: the at-least shape must
  // pass them through verbatim (D-4).
  const extrasDispatcher = createRemoteDispatcher(
    makeFakePorts({
      teamPrepareOrdinaryOpen: {
        prepareOrdinaryOpen(teamSessionId) {
          return {
            rootSessionId: teamSessionId,
            permitted: true,
            expiresAt: '2026-09-24T00:00:00.000Z',
            permitId: 'permit-c1-v5-1',
          }
        },
      },
    }),
  )
  const successWithExtras = await extrasDispatcher(
    'team.prepareOrdinaryOpen',
    p8t3WireV5({ teamSessionId: P8T3_TEAM_SESSION_ID }),
  )

  // (c) Malformed port values (port contract → `internal-error`): the
  // at-least shape is ENFORCED.
  const badPortResponses: RemoteErrorResult[] = []
  for (const { value } of BAD_PORT_VALUES) {
    const failing = createRemoteDispatcher(
      makeFakePorts({
        teamPrepareOrdinaryOpen: {
          prepareOrdinaryOpen() {
            return value as RemoteSafeRecord
          },
        },
      }),
    )
    const response = await failing(
      'team.prepareOrdinaryOpen',
      p8t3WireV5({ teamSessionId: P8T3_TEAM_SESSION_ID }),
    )
    badPortResponses.push(expectError(response))
  }

  // (d) Version routing: v1–v4 requests to the v5-only method.
  const onV1 = await base.dispatch(
    'team.prepareOrdinaryOpen',
    p8t3Wire({ teamSessionId: P8T3_TEAM_SESSION_ID }),
  )
  const onV2 = await base.dispatch(
    'team.prepareOrdinaryOpen',
    p8t3WireV2({ teamSessionId: P8T3_TEAM_SESSION_ID }),
  )
  const onV3 = await base.dispatch(
    'team.prepareOrdinaryOpen',
    p8t3WireV3({ teamSessionId: P8T3_TEAM_SESSION_ID }),
  )
  const onV4 = await base.dispatch(
    'team.prepareOrdinaryOpen',
    p8t3WireV4({ teamSessionId: P8T3_TEAM_SESSION_ID }),
  )

  // (e) Closed v5 params negatives.
  const unknownField = await base.dispatch(
    'team.prepareOrdinaryOpen',
    p8t3WireV5({ teamSessionId: P8T3_TEAM_SESSION_ID, caller: 'human' }),
  )
  const missingRequired = await base.dispatch(
    'team.prepareOrdinaryOpen',
    p8t3WireV5({}),
  )
  const badId = await base.dispatch(
    'team.prepareOrdinaryOpen',
    p8t3WireV5({ teamSessionId: 'root 1' }),
  )

  // (f) The typed backing-error pass-through battery (invariant 4b).
  const backingFailureResponses = new Map<string, RemoteErrorResult>()
  for (const code of C1_V5_BACKING_CODES) {
    const failing = createRemoteDispatcher(
      makeFakePorts({
        teamPrepareOrdinaryOpen: {
          prepareOrdinaryOpen() {
            throw backingError(code)
          },
        },
      }),
    )
    const response = await failing(
      'team.prepareOrdinaryOpen',
      p8t3WireV5({ teamSessionId: P8T3_TEAM_SESSION_ID }),
    )
    backingFailureResponses.set(code, expectError(response))
  }

  // (g) An out-of-vocabulary backing code (Node ENOENT-style): must
  // degrade to `internal-error` with no leak (invariant 5).
  const enoentDispatcher = createRemoteDispatcher(
    makeFakePorts({
      teamPrepareOrdinaryOpen: {
        prepareOrdinaryOpen() {
          throw backingError('ENOENT')
        },
      },
    }),
  )
  const enoent = await enoentDispatcher(
    'team.prepareOrdinaryOpen',
    p8t3WireV5({ teamSessionId: P8T3_TEAM_SESSION_ID }),
  )

  return {
    base,
    success,
    successWithExtras,
    badPortResponses,
    onV1,
    onV2,
    onV3,
    onV4,
    unknownField,
    missingRequired,
    badId,
    backingFailureResponses,
    enoent,
  }
})()

// ---------------------------------------------------------------------------
// Assertions (synchronous `it` bodies over the captured results)
// ---------------------------------------------------------------------------

describe('C1 (remote contract v5): catalog facts', () => {
  it('the closed v5 field set is exactly {teamSessionId} and the method lives in the team category', () => {
    expect([...REMOTE_TEAM_PREPARE_ORDINARY_OPEN_FIELDS].sort()).toEqual(['teamSessionId'])
    expect(remoteCategoryOf('team.prepareOrdinaryOpen')).toBe('team')
  })
})

describe('C1 (remote contract v5): team.prepareOrdinaryOpen success', () => {
  it('a v5 request with the closed params succeeds: the port is called exactly once (verbatim teamSessionId)', () => {
    const success = expectSuccess(RT.success)
    expect(RT.base.ports.calls.filter(call => call === 'team.prepareOrdinaryOpen')).toEqual([
      'team.prepareOrdinaryOpen',
    ])
    expect(success.value.data).toEqual({
      rootSessionId: P8T3_TEAM_SESSION_ID,
      permitted: true,
    })
  })

  it('the provenance echoes contract version 5 and the endpoint + method', () => {
    const success = expectSuccess(RT.success)
    expect(success.value.provenance.contractVersion).toBe(REMOTE_CONTRACT_VERSION_V5)
    expect(success.value.provenance.method).toBe('team.prepareOrdinaryOpen')
    expect(success.value.provenance.endpoint).toBe('team.prepareOrdinaryOpen')
  })

  it('extra port value fields pass through verbatim (the at-least shape is not a closed shape — D-4)', () => {
    const success = expectSuccess(RT.successWithExtras)
    expect(success.value.data).toEqual({
      rootSessionId: P8T3_TEAM_SESSION_ID,
      permitted: true,
      expiresAt: '2026-09-24T00:00:00.000Z',
      permitId: 'permit-c1-v5-1',
    })
  })

  it('every malformed port value → internal-error port contract (the at-least shape is enforced)', () => {
    for (let i = 0; i < BAD_PORT_VALUES.length; i++) {
      const error = RT.badPortResponses[i]
      if (error === undefined) throw new Error('missing captured response')
      expect(error.ok).toBe(false)
      if (error.ok) throw new Error('expected an error result')
      expect(error.error.code).toBe(REMOTE_CONTRACT_ERROR_CODES.INTERNAL_ERROR)
      // no leak: the wire never carries the thrown value
      expect(JSON.stringify(error.error).includes('backing:')).toBe(false)
    }
  })
})

describe('C1 (remote contract v5): version routing (v1–v4 → method-version-unsupported)', () => {
  it('a v1 request → method-version-unsupported (typed after the envelope parse)', () => {
    const error = expectError(RT.onV1)
    expect(error.error.code).toBe(REMOTE_CONTRACT_ERROR_CODES.METHOD_VERSION_UNSUPPORTED)
    expect(error.error.details?.reason).toBe('method-not-available-in-version')
  })

  it('a v2 request → method-version-unsupported', () => {
    const error = expectError(RT.onV2)
    expect(error.error.code).toBe(REMOTE_CONTRACT_ERROR_CODES.METHOD_VERSION_UNSUPPORTED)
  })

  it('a v3 request → method-version-unsupported', () => {
    const error = expectError(RT.onV3)
    expect(error.error.code).toBe(REMOTE_CONTRACT_ERROR_CODES.METHOD_VERSION_UNSUPPORTED)
  })

  it('a v4 request → method-version-unsupported (the v5 bump is closed)', () => {
    const error = expectError(RT.onV4)
    expect(error.error.code).toBe(REMOTE_CONTRACT_ERROR_CODES.METHOD_VERSION_UNSUPPORTED)
  })
})

describe('C1 (remote contract v5): closed params', () => {
  it('a client-provided extra field → malformed-params (unknown-field)', () => {
    const error = expectError(RT.unknownField)
    expect(error.error.code).toBe(REMOTE_CONTRACT_ERROR_CODES.MALFORMED_PARAMS)
    expect(error.error.details?.reason).toBe('unknown-field')
    expect(error.error.details?.field).toBe('caller')
  })

  it('a missing teamSessionId → malformed-params (missing-required)', () => {
    const error = expectError(RT.missingRequired)
    expect(error.error.code).toBe(REMOTE_CONTRACT_ERROR_CODES.MALFORMED_PARAMS)
    expect(error.error.details?.reason).toBe('missing-required')
    expect(error.error.details?.field).toBe('teamSessionId')
  })

  it('a malformed teamSessionId (whitespace) → INVALID_ROOT_SESSION_ID', () => {
    const error = expectError(RT.badId)
    expect(error.error.code).toBe(REMOTE_ID_ERROR_CODES.INVALID_ROOT_SESSION_ID)
  })
})

describe('C1 (remote contract v5): backing error allow-list (invariant 4b)', () => {
  it('the C1 port-unavailability code passes through with code + message (no degradation)', () => {
    const error = RT.backingFailureResponses.get('TEAM_REMOTE_TEAM_ORDINARY_OPEN_PORT_UNAVAILABLE')
    expect(error !== undefined).toBe(true)
    if (error === undefined) throw new Error('missing captured response')
    expect(error.error.code).toBe('TEAM_REMOTE_TEAM_ORDINARY_OPEN_PORT_UNAVAILABLE')
    expect(error.error.message).toBe('backing: TEAM_REMOTE_TEAM_ORDINARY_OPEN_PORT_UNAVAILABLE')
    const details = error.error.details as unknown as Record<string, unknown> | undefined
    expect(details?.['reason']).toBe('domain-error')
  })

  it('the pre-existing TEAM_REMOTE_FOREIGN_TEAM code still passes through (no regression)', () => {
    const error = RT.backingFailureResponses.get('TEAM_REMOTE_FOREIGN_TEAM')
    expect(error !== undefined).toBe(true)
    if (error === undefined) throw new Error('missing captured response')
    expect(error.error.code).toBe('TEAM_REMOTE_FOREIGN_TEAM')
    expect(error.error.message).toBe('backing: TEAM_REMOTE_FOREIGN_TEAM')
    const details = error.error.details as unknown as Record<string, unknown> | undefined
    expect(details?.['reason']).toBe('domain-error')
  })

  it('an out-of-vocabulary backing code (ENOENT) degrades to internal-error with no leak', () => {
    const error = expectError(RT.enoent)
    expect(error.error.code).toBe(REMOTE_CONTRACT_ERROR_CODES.INTERNAL_ERROR)
    const wire = JSON.stringify(error.error)
    expect(wire.includes('ENOENT')).toBe(false)
    expect(wire.includes('backing:')).toBe(false)
  })
})
