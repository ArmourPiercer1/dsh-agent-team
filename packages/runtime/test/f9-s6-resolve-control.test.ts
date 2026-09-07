/**
 * f9-s6-resolve-control.test.ts — F9 (F3/F11/F9/T1.4 repair round r1):
 * the S6 PRODUCTION dispatcher wiring of the remote contract v4-only
 * method `team.resolveControl` (the human control-resolution command).
 *
 * The dispatcher under test is the REAL production one
 * (`createS6RemotePorts` + `createS6RemoteDispatcher`) with the REAL
 * production principal derivation (`createServerPrincipalDerivation`,
 * the T12-B4 seam): the shared version-aware param parser, the frozen
 * seven invariants, and the shared backing-code allow-list. Only the
 * host's control-service closure (the A25 authority) is simulated — a
 * capturing fake; the durable control-service semantics themselves are
 * pinned in f9-control-exactly-once.test.ts over the real service.
 *
 * Covers (F9 task card, host-wiring half; adjudications U3 + INV-9.3):
 *  - the AUTHORITY: the wire carries NO caller/role/actor fields
 *    (adjudication U3) — a client-provided identity claim is a
 *    `malformed-params` unknown-field BEFORE any derivation or port
 *    work; the decider is HOST-DERIVED: the derivation stamps
 *    `{ kind: 'human', humanId: <validated owned teamSessionId> }`
 *    (the invariant 9 identity channel) and the port receives exactly
 *    that host-stamped caller — the derivation NEVER returns an
 *    instance caller for this method;
 *  - TEAM-SCOPED fail-closed: a FOREIGN teamSessionId fails with
 *    `TEAM_REMOTE_FOREIGN_TEAM` BEFORE any port work (the derivation's
 *    assertTeamScoped runs first — the control-service closure is never
 *    consulted);
 *  - the bound-root port guard runs before the closure (defense in
 *    depth, same order as `team.ensureRootLive`);
 *  - fail-closed when the host wiring is ABSENT: no `resolveControl`
 *    option → typed `TEAM_REMOTE_TEAM_RESOLVE_CONTROL_UNAVAILABLE`
 *    (never a silent success, never a default decision);
 *  - the EXISTING control-service authority is unchanged (A25): the
 *    closure's closed CONTROL_* rejections + the S6 unavailability code
 *    propagate through the dispatcher UNCHANGED (invariant 4b: code +
 *    message preserved, source identity under details.cause); an
 *    untyped throw degrades to `internal-error` with no leak;
 *  - version routing: v1/v2/v3 requests to `team.resolveControl` →
 *    typed `method-version-unsupported` AFTER the envelope parse
 *    (details echo the request's own version) — the v1-v3 rejection
 *    is preserved by the version-aware param parser;
 *  - the READ-ONLY derivation: no repository access of any kind
 *    (the trip-wire repositories throw on ANY touch).
 *
 * Test pattern of this repo (the plain-node shim's `it` is synchronous):
 * every async scenario runs at MODULE level (top-level await) and
 * captures its results; the `it` bodies are pure synchronous assertions.
 *
 * Matchers: toBe/toEqual/toBeGreaterThan (+.not) only.
 *
 * @module @dsh-agent-team/runtime/test/f9-s6-resolve-control
 */

import { describe, expect, it } from 'vitest'

import {
  createS6RemoteDispatcher,
  createS6RemotePorts,
  S6_REMOTE_ERROR_CODES,
} from '../src/plugin/s6-remote.js'
import type { S6RemoteOptions } from '../src/plugin/s6-remote.js'
import { createServerPrincipalDerivation } from '../src/plugin/s6-principal.js'
import type { ActionCaller } from '../admission/index.js'
import type { TeamDomainRepositories } from '../../storage/repositories/index.js'
import {
  REMOTE_CONTRACT_ERROR_CODES,
  REMOTE_CONTRACT_VERSION,
  REMOTE_CONTRACT_VERSION_V2,
  REMOTE_CONTRACT_VERSION_V3,
  REMOTE_CONTRACT_VERSION_V4,
} from '../../remote/src/index.js'
import type { RemoteResponse, RemoteSafeRecord } from '../../remote/src/index.js'

const ROOT_SID = 'root-session-f9-s6'
const FOREIGN_SID = 'root-session-f9-foreign'
const LEADER_ID = 'inst-leader-f9-s6'
const REQUEST_ID = 'ctrl-f9-s6-0000000000000001'
const NOTE = 'the human decision note'

/** The durable decision record the fake closure echoes (the closed v4
 *  success shape the real control service returns). */
const DECISION_RECORD: RemoteSafeRecord = {
  requestId: REQUEST_ID,
  decision: 'allow',
  decider: { kind: 'human', humanId: ROOT_SID },
  reason: 'the durable reason',
  note: NOTE,
  scope: {
    rootSessionId: ROOT_SID,
    targetInstanceId: 'inst-p6t4seedw01',
    actionName: 'write-file',
    toolName: 'fs.write',
    correlation: 'corr-f9-s6-0001',
  },
  requestSequence: 1,
  decisionSequence: 2,
  createdAt: '2026-09-01T09:00:00Z',
}

/** Extract the typed error part of a resolved error envelope. */
function errorOf(response: RemoteResponse): Record<string, unknown> {
  if (response.ok) throw new Error('F9-S6 guard: expected an error result')
  return response.error as unknown as Record<string, unknown>
}

/** Extract the success data part of a resolved success envelope. */
function dataOf(response: RemoteResponse): Record<string, unknown> {
  if (!response.ok) throw new Error('F9-S6 guard: expected a success result')
  return response.value.data as Record<string, unknown>
}

/** The trip-wire repositories: ANY access is a test failure. */
function tripWireRepositories(): { repos: TeamDomainRepositories; touched: string[] } {
  const touched: string[] = []
  const trip = (name: string): never => {
    touched.push(name)
    throw new Error(`F9-S6 guard: team.resolveControl must not touch repositories.${name}`)
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

/** One capturing fake control-service closure (the A25 authority stand-in). */
interface FakeClosure {
  /** Every closure invocation's exact argument record. */
  readonly calls: Array<Record<string, unknown>>
  /** The closure body (override the return / rejection per scenario). */
  closure: (args: {
    readonly rootSessionId: string
    readonly caller: ActionCaller
    readonly requestId: string
    readonly decision: 'allow' | 'deny'
    readonly note?: string
  }) => Promise<RemoteSafeRecord>
}

function makeFakeClosure(
  body: ((args: Parameters<FakeClosure['closure']>[0]) => Promise<RemoteSafeRecord>) | undefined,
): FakeClosure {
  const calls: Array<Record<string, unknown>> = []
  return {
    calls,
    closure: (args) => {
      calls.push({ ...args } as unknown as Record<string, unknown>)
      if (body === undefined) {
        return Promise.resolve(DECISION_RECORD)
      }
      return body(args)
    },
  }
}

/** Build the production ports over the shared trip-wired world. */
function makePorts(
  body: ((args: Parameters<FakeClosure['closure']>[0]) => Promise<RemoteSafeRecord>) | undefined,
  withClosure: boolean,
): {
  ports: ReturnType<typeof createS6RemotePorts>
  touched: string[]
  fake: FakeClosure
} {
  const fake = makeFakeClosure(body)
  const opts = {
    rootSessionId: ROOT_SID,
    repositories: WORLD.repos,
    now: () => '2026-09-01T09:00:00Z',
    ...(withClosure ? { resolveControl: fake.closure } : {}),
  } as unknown as S6RemoteOptions
  const ports = createS6RemotePorts(opts)
  return { ports, touched: WORLD.touched, fake }
}

/** The REAL production principal derivation over the trip-wired world. */
function realDerivation(repos: TeamDomainRepositories) {
  return createServerPrincipalDerivation({
    rootSessionId: ROOT_SID,
    repositories: repos,
    leaderInstanceId: LEADER_ID,
  })
}

// The trip-wire repositories are shared by the ports + the derivation
// (one world, one ownership check surface).
const WORLD = tripWireRepositories()

// Module level (top-level await): drive the REAL production dispatcher
// over the capturing fake closure and capture every scenario result.
const F9 = await (async () => {
  // (a) The full host wiring: the capturing closure (default echo body).
  const a = makePorts(undefined, true)
  const dispatchA = createS6RemoteDispatcher(a.ports, realDerivation(WORLD.repos))
  const allowWithNote = await dispatchA('team.resolveControl', {
    version: REMOTE_CONTRACT_VERSION_V4,
    params: { teamSessionId: ROOT_SID, requestId: REQUEST_ID, decision: 'allow', note: NOTE },
  })
  const denyWithoutNote = await dispatchA('team.resolveControl', {
    version: REMOTE_CONTRACT_VERSION_V4,
    params: { teamSessionId: ROOT_SID, requestId: REQUEST_ID, decision: 'deny' },
  })

  // (b) No identity channel at the S6 boundary: a client-provided
  // `caller` claim is rejected by the closed v4 param set (U3).
  const spoofedCaller = await dispatchA('team.resolveControl', {
    version: REMOTE_CONTRACT_VERSION_V4,
    params: {
      teamSessionId: ROOT_SID,
      requestId: REQUEST_ID,
      decision: 'deny',
      caller: { kind: 'instance', instanceId: LEADER_ID },
    },
  })
  const spoofedRole = await dispatchA('team.resolveControl', {
    version: REMOTE_CONTRACT_VERSION_V4,
    params: { teamSessionId: ROOT_SID, requestId: REQUEST_ID, decision: 'deny', role: 'leader' },
  })

  // (c) FOREIGN team: the derivation fails closed BEFORE any port work.
  const foreign = await dispatchA('team.resolveControl', {
    version: REMOTE_CONTRACT_VERSION_V4,
    params: { teamSessionId: FOREIGN_SID, requestId: REQUEST_ID, decision: 'allow' },
  })

  // (d) Version routing: v1 / v2 / v3 requests to the v4-only method.
  const v1Request = await dispatchA('team.resolveControl', {
    version: REMOTE_CONTRACT_VERSION,
    params: { teamSessionId: ROOT_SID, requestId: REQUEST_ID, decision: 'allow' },
  })
  const v2Request = await dispatchA('team.resolveControl', {
    version: REMOTE_CONTRACT_VERSION_V2,
    params: { teamSessionId: ROOT_SID, requestId: REQUEST_ID, decision: 'allow' },
  })
  const v3Request = await dispatchA('team.resolveControl', {
    version: REMOTE_CONTRACT_VERSION_V3,
    params: { teamSessionId: ROOT_SID, requestId: REQUEST_ID, decision: 'allow' },
  })

  // (e) The ABSENT host wiring: no resolveControl option.
  const absent = makePorts(undefined, false)
  const dispatchAbsent = createS6RemoteDispatcher(absent.ports, realDerivation(WORLD.repos))
  const absentResponse = await dispatchAbsent('team.resolveControl', {
    version: REMOTE_CONTRACT_VERSION_V4,
    params: { teamSessionId: ROOT_SID, requestId: REQUEST_ID, decision: 'allow' },
  })

  // (f) The control-service's closed CONTROL_* rejections: propagate
  // UNCHANGED through the dispatcher (invariant 4b).
  const F9_CONTROL_CODES = [
    'CONTROL_REQUEST_MALFORMED',
    'CONTROL_TARGET_STALE',
    'CONTROL_REQUEST_NOT_FOUND',
    'CONTROL_REQUEST_DECIDED',
    'CONTROL_RESOLVER_NOT_AUTHORIZED',
    'CONTROL_REQUEST_STALE',
    'CONTROL_EXTERNAL_POLICY_DENIED',
  ] as const
  const controlFailures: Array<{ readonly code: string; readonly response: RemoteResponse }> = []
  for (const code of F9_CONTROL_CODES) {
    const f = makePorts(
      () => {
        const error = new Error(`control: ${code}`)
        ;(error as Error & { code: string }).code = code
        return Promise.reject(error)
      },
      true,
    )
    const dispatchF = createS6RemoteDispatcher(f.ports, realDerivation(WORLD.repos))
    const response = await dispatchF('team.resolveControl', {
      version: REMOTE_CONTRACT_VERSION_V4,
      params: { teamSessionId: ROOT_SID, requestId: REQUEST_ID, decision: 'deny' },
    })
    controlFailures.push({ code, response })
  }

  // (g) An UNTYPED closure throw: degrades to internal-error (no leak).
  const untyped = makePorts(
    () => Promise.reject(new Error('boom: the control service exploded')),
    true,
  )
  const dispatchUntyped = createS6RemoteDispatcher(untyped.ports, realDerivation(WORLD.repos))
  const untypedResponse = await dispatchUntyped('team.resolveControl', {
    version: REMOTE_CONTRACT_VERSION_V4,
    params: { teamSessionId: ROOT_SID, requestId: REQUEST_ID, decision: 'deny' },
  })

  return {
    touched: WORLD.touched,
    allowWithNote,
    denyWithoutNote,
    spoofedCaller,
    spoofedRole,
    foreign,
    v1Request,
    v2Request,
    v3Request,
    absentResponse,
    controlFailures,
    untypedResponse,
    fakeCalls: a.fake.calls,
  }
})()

// ---------------------------------------------------------------------------
// Assertions (synchronous `it` bodies over the captured results)
// ---------------------------------------------------------------------------

describe('F9 (S6 host wiring): team.resolveControl authority (host-stamped human principal)', () => {
  it('a v4 allow request succeeds: the host derivation stamps the human operator and the port receives it', () => {
    expect(F9.allowWithNote.ok).toBe(true)
    if (!F9.allowWithNote.ok) throw new Error('F9-S6 guard: expected success')
    expect(F9.allowWithNote.value.provenance.contractVersion).toBe(REMOTE_CONTRACT_VERSION_V4)
    expect(F9.allowWithNote.value.provenance.method).toBe('team.resolveControl')
    const data = dataOf(F9.allowWithNote)
    // the durable decision record under data.decision (the closed v4 shape)
    expect(data['decision']).toEqual(DECISION_RECORD)
  })

  it('the closure is called exactly twice (the two successful v4 requests) with the host-stamped caller', () => {
    expect(F9.fakeCalls.length).toBe(2)
    const first = F9.fakeCalls[0] as Record<string, unknown>
    // the FIRST call: allow + note, verbatim params
    expect(first['rootSessionId']).toBe(ROOT_SID)
    expect(first['requestId']).toBe(REQUEST_ID)
    expect(first['decision']).toBe('allow')
    expect(first['note']).toBe(NOTE)
    // THE AUTHORITY (INV-9.3 + adjudication U3): the caller is the
    // host-derived human operator of the validated owned root — never a
    // client claim, never an instance caller.
    expect(first['caller']).toEqual({ kind: 'human', humanId: ROOT_SID })
    const second = F9.fakeCalls[1] as Record<string, unknown>
    expect(second['decision']).toBe('deny')
    expect(second['caller']).toEqual({ kind: 'human', humanId: ROOT_SID })
  })

  it('the optional note is NOT materialized when the wire omits it (the closed param set)', () => {
    const second = F9.fakeCalls[1] as Record<string, unknown>
    expect('note' in second).toBe(false)
  })

  it('the derivation touches NO repository (the trip-wire was never tripped)', () => {
    expect(F9.touched).toEqual([])
  })
})

describe('F9 (S6 host wiring): no identity channel on the wire (adjudication U3)', () => {
  it('a client-provided caller claim is a malformed-params unknown-field BEFORE any port work', () => {
    const error = errorOf(F9.spoofedCaller)
    expect(error['code']).toBe(REMOTE_CONTRACT_ERROR_CODES.MALFORMED_PARAMS)
    const details = error['details'] as Record<string, unknown>
    expect(details['field']).toBe('caller')
    expect(details['reason']).toBe('unknown-field')
  })

  it('a client-provided role claim is a malformed-params unknown-field', () => {
    const error = errorOf(F9.spoofedRole)
    expect(error['code']).toBe('malformed-params')
    const details = error['details'] as Record<string, unknown>
    expect(details['field']).toBe('role')
    expect(details['reason']).toBe('unknown-field')
  })
})

describe('F9 (S6 host wiring): team-scoped fail-closed (FOREIGN_TEAM before any port work)', () => {
  it('a FOREIGN teamSessionId fails closed TEAM_REMOTE_FOREIGN_TEAM (the derivation runs first)', () => {
    const error = errorOf(F9.foreign)
    expect(error['code']).toBe('TEAM_REMOTE_FOREIGN_TEAM')
    const details = error['details'] as Record<string, unknown>
    expect(details['reason']).toBe('domain-error')
    expect(String(error['message']).includes(`'${FOREIGN_SID}'`)).toBe(true)
    expect(String(error['message']).includes(`bound root '${ROOT_SID}'`)).toBe(true)
  })

  it('the control-service closure was NEVER consulted for the foreign request (only the two bound-root successes reached it)', () => {
    expect(F9.fakeCalls.length).toBe(2)
  })
})

describe('F9 (S6 host wiring): fail-closed when the host wiring is absent', () => {
  it('an ABSENT resolveControl option → typed TEAM_REMOTE_TEAM_RESOLVE_CONTROL_UNAVAILABLE — never a silent success, never a default decision', () => {
    const error = errorOf(F9.absentResponse)
    expect(error['code']).toBe(S6_REMOTE_ERROR_CODES.TEAM_RESOLVE_CONTROL_UNAVAILABLE)
    expect(error['code']).toBe('TEAM_REMOTE_TEAM_RESOLVE_CONTROL_UNAVAILABLE')
    const details = error['details'] as Record<string, unknown>
    expect(details['reason']).toBe('domain-error')
    const cause = details['cause'] as Record<string, unknown>
    expect(cause['code']).toBe('TEAM_REMOTE_TEAM_RESOLVE_CONTROL_UNAVAILABLE')
    expect(String(error['message']).includes('does not provide the control-service closure')).toBe(true)
  })
})

describe('F9 (S6 host wiring): the existing control-service authority is unchanged (invariant 4b)', () => {
  it('every closed CONTROL_* rejection propagates UNCHANGED (code + message + cause identity)', () => {
    expect(F9.controlFailures.length).toBe(7)
    for (const { code, response } of F9.controlFailures) {
      const error = errorOf(response)
      expect(error['code']).toBe(code)
      expect(String(error['message'])).toBe(`control: ${code}`)
      const details = error['details'] as Record<string, unknown>
      expect(details['reason']).toBe('domain-error')
      const cause = details['cause'] as Record<string, unknown>
      expect(cause['code']).toBe(code)
      expect(cause['message']).toBe(`control: ${code}`)
      // the v4 provenance context rides along
      expect(details['contractVersion']).toBe(REMOTE_CONTRACT_VERSION_V4)
    }
  })

  it('an UNTYPED closure throw degrades to internal-error with a generic message and no leak', () => {
    const error = errorOf(F9.untypedResponse)
    expect(error['code']).toBe(REMOTE_CONTRACT_ERROR_CODES.INTERNAL_ERROR)
    expect(error['code']).toBe('internal-error')
    expect(String(error['message'])).toBe('internal error in remote handler')
    const wire = JSON.stringify(error)
    expect(wire.includes('boom')).toBe(false)
    const details = error['details'] as Record<string, unknown>
    expect(details['reason']).toBe('untyped-error')
  })
})

describe('F9 (S6 host wiring): version routing (the v1-v3 rejection is preserved)', () => {
  it('a v1 request → method-version-unsupported (typed after the envelope parse, details echo v1)', () => {
    const error = errorOf(F9.v1Request)
    expect(error['code']).toBe(REMOTE_CONTRACT_ERROR_CODES.METHOD_VERSION_UNSUPPORTED)
    const details = error['details'] as Record<string, unknown>
    expect(details['contractVersion']).toBe(REMOTE_CONTRACT_VERSION)
    expect(details['reason']).toBe('method-not-available-in-version')
    expect(details['method']).toBe('team.resolveControl')
  })

  it('a v2 request → method-version-unsupported (details echo v2)', () => {
    const error = errorOf(F9.v2Request)
    expect(error['code']).toBe('method-version-unsupported')
    const details = error['details'] as Record<string, unknown>
    expect(details['contractVersion']).toBe(REMOTE_CONTRACT_VERSION_V2)
  })

  it('a v3 request → method-version-unsupported (details echo v3)', () => {
    const error = errorOf(F9.v3Request)
    expect(error['code']).toBe('method-version-unsupported')
    const details = error['details'] as Record<string, unknown>
    expect(details['contractVersion']).toBe(REMOTE_CONTRACT_VERSION_V3)
  })
})
