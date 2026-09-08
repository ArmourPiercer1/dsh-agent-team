/**
 * F9U (F3/F11/F9/T1.4 repair round r1, gate-review supplements) — the
 * client-local control-surface model (pure):
 *
 *  - supplement 3: the CLOSED human resolver-role map (the client-local
 *    frozen mirror of the host `CONTROL_RESOLVER_ROLES` — the kind-aware
 *    affordance authority: a closed kind whose role set includes
 *    'human' grants the command; an unknown / absent kind fails closed)
 *    and the requested-authority read (UI §26.2 "requested authority");
 *  - supplement 4: the served-version probe interpretation (the closed
 *    classification of the side-effect-free v4 probe's typed response:
 *    a pre-v4 build → 'read-only'; a v4-served build → 'enabled').
 *
 * No React, no DOM: the model is the pure decision core both the panel
 * (TeamLedger) and the view's probe (TeamView) consume.
 */
import { describe, expect, it } from 'vitest'
import {
  buildRemoteError,
  buildRemoteSuccess,
  REMOTE_CONTRACT_VERSION,
  REMOTE_CONTRACT_VERSION_V4,
} from '../../remote/src/index.js'
import {
  CONTROL_RESOLVER_ROLES,
  HUMAN_RESOLVER_ROLE,
  interpretResolveControlProbe,
  RESOLVE_CONTROL_PROBE_REQUEST_ID,
  requestedAuthorityForKind,
  humanMayResolveControlKind,
} from '../src/model/control-surface.js'

/** The probe's provenance context (a v4-stamped envelope). */
const PROBE_CTX = {
  method: 'team.resolveControl',
  endpoint: 'team.resolveControl',
  contractVersion: REMOTE_CONTRACT_VERSION_V4,
  requestToken: null,
}

describe('F9U — the closed human resolver-role map (supplement 3)', () => {
  it('mirrors the FROZEN closed role set exactly (the three closed kinds, no more, no less)', () => {
    expect(Object.keys(CONTROL_RESOLVER_ROLES).sort()).toEqual([
      'envelope-mutation',
      'leader-approval',
      'user-approval',
    ])
    const leaderRoles = CONTROL_RESOLVER_ROLES['leader-approval']
    const userRoles = CONTROL_RESOLVER_ROLES['user-approval']
    const envelopeRoles = CONTROL_RESOLVER_ROLES['envelope-mutation']
    expect(leaderRoles).toBeDefined()
    expect(userRoles).toBeDefined()
    expect(envelopeRoles).toBeDefined()
    if (leaderRoles === undefined || userRoles === undefined || envelopeRoles === undefined) {
      throw new Error('a closed kind is missing from the mirror')
    }
    expect([...leaderRoles]).toEqual(['leader', 'human'])
    expect([...userRoles]).toEqual(['human'])
    expect([...envelopeRoles]).toEqual(['leader', 'human'])
    expect(HUMAN_RESOLVER_ROLE).toBe('human')
  })

  it('grants the human for every closed kind (the role set includes human)', () => {
    expect(humanMayResolveControlKind('leader-approval')).toBe(true)
    expect(humanMayResolveControlKind('user-approval')).toBe(true)
    expect(humanMayResolveControlKind('envelope-mutation')).toBe(true)
  })

  it('FAILS CLOSED for unknown / future / absent kinds (the panel shows, the command does not)', () => {
    expect(humanMayResolveControlKind(undefined)).toBe(false)
    expect(humanMayResolveControlKind('')).toBe(false)
    expect(humanMayResolveControlKind('future-kind')).toBe(false)
    expect(humanMayResolveControlKind('USER-APPROVAL')).toBe(false)
    expect(humanMayResolveControlKind('user-approval ')).toBe(false)
  })

  it('reads the requested authority as the closed role set (and ABSENT for unknown kinds)', () => {
    const userAuthority = requestedAuthorityForKind('user-approval')
    const leaderAuthority = requestedAuthorityForKind('leader-approval')
    expect(userAuthority).toBeDefined()
    expect(leaderAuthority).toBeDefined()
    if (userAuthority === undefined || leaderAuthority === undefined) {
      throw new Error('a closed kind has no requested authority')
    }
    expect([...userAuthority]).toEqual(['human'])
    expect([...leaderAuthority]).toEqual(['leader', 'human'])
    expect(requestedAuthorityForKind('future-kind')).toBeUndefined()
    expect(requestedAuthorityForKind(undefined)).toBeUndefined()
  })
})

describe('F9U — the served-version probe (supplement 4)', () => {
  it('probes with the closed empty requestId (the first value outside the 1..255 token rule)', () => {
    // The probe must be side-effect-free BY CONSTRUCTION: a v4 host
    // rejects the params before any port work, a pre-v4 host never
    // parses the method at all.
    expect(RESOLVE_CONTROL_PROBE_REQUEST_ID).toBe('')
  })

  it("classifies a PRE-V4 build as 'read-only' (the v4-only method is unknown to its closed catalog)", () => {
    expect(interpretResolveControlProbe(buildRemoteError(
      'unknown-method',
      "endpoint 'team.resolveControl' is not a method of the closed Remote contract catalog",
      { ...PROBE_CTX, contractVersion: REMOTE_CONTRACT_VERSION },
      { reason: 'unknown-endpoint' },
    ))).toBe('read-only')
  })

  it("classifies an envelope the build does not serve as 'read-only' (contract-version-unsupported)", () => {
    expect(interpretResolveControlProbe(buildRemoteError(
      'contract-version-unsupported',
      'remote contract version 4 is not supported (supported: [1,2,3])',
      { ...PROBE_CTX, contractVersion: REMOTE_CONTRACT_VERSION },
      { field: 'version' },
    ))).toBe('read-only')
  })

  it("classifies a method unavailable at the request's version as 'read-only' (method-version-unsupported)", () => {
    expect(interpretResolveControlProbe(buildRemoteError(
      'method-version-unsupported',
      "method 'team.resolveControl' is not available at contract version 3",
      PROBE_CTX,
      { reason: 'version' },
    ))).toBe('read-only')
  })

  it("classifies a V4-served build as 'enabled' (the probe's typed malformed-params reached the v4 method)", () => {
    expect(interpretResolveControlProbe(buildRemoteError(
      'malformed-params',
      "method 'team.resolveControl' param field 'requestId' must be a string of 1..255 characters",
      PROBE_CTX,
      { field: 'requestId', reason: 'invalid-value' },
    ))).toBe('enabled')
  })

  it("classifies ANY typed control-vocabulary error as 'enabled' (the v4 method was reached)", () => {
    expect(interpretResolveControlProbe(buildRemoteError(
      'CONTROL_REQUEST_NOT_FOUND',
      'ControlService: no pending control request with id probe (root team-leader)',
      PROBE_CTX,
      { reason: 'domain-error' },
    ))).toBe('enabled')
  })

  it("classifies a success as 'enabled' (defensive: a v4 host that answered the probe)", () => {
    expect(interpretResolveControlProbe(buildRemoteSuccess(
      { decision: {} },
      PROBE_CTX,
    ))).toBe('enabled')
  })
})
