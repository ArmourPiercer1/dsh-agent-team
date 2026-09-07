/**
 * f9-control-exactly-once.test.ts — F9 (F3/F11/F9/T1.4 repair round r1):
 * the DURABLE exactly-once + resolver-authority semantics of
 * `team.resolveControl` over the REAL control service (A25) behind the
 * REAL S6 production dispatcher + REAL T12-B4 principal derivation.
 *
 * Acceptance mapping:
 *  - F9H-T1 (exactly-once): a human allow through the v4 wire is durable
 *    via the host-stamped human principal; a second resolve of the SAME
 *    request → typed CONTROL_REQUEST_DECIDED with exactly ONE decision
 *    row (and one raw durable fact); the last-mile guard consumes the
 *    allow EXACTLY ONCE (a second identical attempt is blocked
 *    allow-consumed); after a unit RESTART (re-instantiate + re-open
 *    over the same durable store) the decision is still durable, the
 *    re-resolve is still rejected, and the guard still blocks.
 *  - F9H-T2 (unauthorized agent): an INSTANCE caller (member or leader)
 *    resolving its own user-approval request → typed
 *    CONTROL_RESOLVER_NOT_AUTHORIZED with ZERO side effects (the request
 *    stays pending, no decision row, no raw fact, the guard still blocks
 *    request-pending). The frozen CONTROL_RESOLVER_ROLES closure is
 *    UNCHANGED: `user-approval` admits the human role ONLY; a member is
 *    never a resolver for any kind (invariant 37).
 *
 * The wire under test is the full production path: the v4 envelope →
 * the shared version-aware param parser (the closed field set — NO
 * caller/role fields) → the REAL derivation (the host-stamped human
 * operator, the invariant 9 identity channel) → the S6 port (the
 * bound-root guard) → the REAL control service (the authority).
 *
 * Test pattern of this repo (the plain-node shim's `it` is synchronous):
 * every async scenario runs at MODULE level (top-level await) and
 * captures its results; the `it` bodies are pure synchronous
 * assertions.
 *
 * Matchers: toBe/toEqual/toBeGreaterThan (+.not) only.
 *
 * @module @dsh-agent-team/runtime/test/f9-control-exactly-once
 */

import { describe, expect, it } from 'vitest'

import {
  CONTROL_DECISION_VALUES,
  CONTROL_GUARD_BLOCK_REASONS,
  CONTROL_REQUEST_KINDS,
} from '../control/index.js'
import type {
  ControlConsumptionRecord,
  ControlDecisionRecord,
  ControlRequestRecord,
  ControlService,
} from '../control/index.js'
import {
  createS6RemoteDispatcher,
  createS6RemotePorts,
} from '../src/plugin/s6-remote.js'
import type { S6RemoteOptions } from '../src/plugin/s6-remote.js'
import { createServerPrincipalDerivation } from '../src/plugin/s6-principal.js'
import type { ActionCaller } from '../admission/index.js'
import {
  REMOTE_CONTRACT_VERSION_V4,
} from '../../remote/src/index.js'
import type { RemoteResponse, RemoteSafeRecord } from '../../remote/src/index.js'
import type { P6T1World } from './p6t1-helpers.js'
import {
  P6T4_ROOT,
  P6T4_NOW,
  P6T4_SEEDS,
  controlFacts,
  createFakeToolPipeline,
  createP6T4Service,
  createP6T4World,
  destroyP6T1World,
  expectControlRejection,
  expectFirst,
  humanCaller,
  leaderCaller,
  makeScope,
  memberCaller,
  restartP6T1World,
} from './p6t4-helpers.js'
import type { FakeToolExecution } from './p6t4-helpers.js'

const WORKER_ID = String(P6T4_SEEDS.worker.instanceId)
const LEADER_ID = String(P6T4_SEEDS.leader.instanceId)

/** Extract the typed error part of a resolved error envelope. */
function errorOf(response: RemoteResponse): Record<string, unknown> {
  if (response.ok) throw new Error('F9-EoC guard: expected an error result')
  return response.error as unknown as Record<string, unknown>
}

/**
 * Build the REAL production S6 dispatcher over one world + one real
 * control service: the v4 wire → shared param parser → REAL derivation
 * (host-stamped human) → S6 port (bound-root guard) → the A25 service
 * (the authority — UNCHANGED).
 */
function buildS6OverService(world: P6T1World, service: ControlService) {
  const opts = {
    rootSessionId: P6T4_ROOT,
    repositories: world.domain.repositories,
    now: () => P6T4_NOW,
    resolveControl: async (args: {
      readonly rootSessionId: string
      readonly caller: ActionCaller
      readonly requestId: string
      readonly decision: 'allow' | 'deny'
      readonly note?: string
    }): Promise<RemoteSafeRecord> => {
      const record = await service.resolveControl({
        rootSessionId: args.rootSessionId,
        caller: args.caller,
        requestId: args.requestId,
        decision: args.decision,
        ...(args.note !== undefined ? { note: args.note } : {}),
      })
      return record as unknown as RemoteSafeRecord
    },
  } as unknown as S6RemoteOptions
  const ports = createS6RemotePorts(opts)
  const derivation = createServerPrincipalDerivation({
    rootSessionId: P6T4_ROOT,
    repositories: world.domain.repositories,
    leaderInstanceId: LEADER_ID,
  })
  return createS6RemoteDispatcher(ports, derivation)
}

// ---------------------------------------------------------------------------
// Scenario 1 (F9H-T1): human allow through the v4 wire — durable,
// exactly-once, restart-proof.
// ---------------------------------------------------------------------------
const S1 = await (async () => {
  const world = await createP6T4World('f9-eoc-1', ['leader', 'worker'])
  try {
    const service = createP6T4Service(world)
    const dispatch = buildS6OverService(world, service)
    const scope = makeScope({ correlation: 'corr-f9-eoc-1' })

    // The worker requests EXPLICIT USER approval (user-approval kind —
    // the human-only resolver closure).
    const request = await service.requestControl({
      rootSessionId: P6T4_ROOT,
      caller: memberCaller(WORKER_ID),
      kind: CONTROL_REQUEST_KINDS.USER_APPROVAL,
      targetInstanceId: WORKER_ID,
      actionName: scope.actionName,
      toolName: scope.toolName,
      correlation: scope.correlation,
    })

    // (1) The HUMAN resolve through the v4 wire (the host stamps the
    // human principal — the wire carries no caller field).
    const allowResponse = await dispatch('team.resolveControl', {
      version: REMOTE_CONTRACT_VERSION_V4,
      params: {
        teamSessionId: P6T4_ROOT,
        requestId: request.requestId,
        decision: 'allow',
        note: 'the human allows the write',
      },
    })

    // (2) A SECOND resolve of the SAME request (exactly-once).
    const secondResponse = await dispatch('team.resolveControl', {
      version: REMOTE_CONTRACT_VERSION_V4,
      params: {
        teamSessionId: P6T4_ROOT,
        requestId: request.requestId,
        decision: 'allow',
      },
    })

    const stateBeforeRestart = await service.listControlState(P6T4_ROOT)
    const rawDecisionFactsBeforeRestart = controlFacts(world, 'control-decision-recorded').length

    // (3) The last-mile guard consumes the allow EXACTLY ONCE.
    const pipeline = createFakeToolPipeline(service)
    const verdict1 = await pipeline.execute(scope)
    const verdict2 = await pipeline.execute(scope)

    // (4) The unit RESTART (re-instantiate + re-open over the SAME
    // durable store — the unit-restart model, invariant 45).
    const world2 = await restartP6T1World(world)
    const service2 = createP6T4Service(world2)
    const dispatch2 = buildS6OverService(world2, service2)

    // (5) The re-resolve after the restart (still exactly-once).
    const restartResponse = await dispatch2('team.resolveControl', {
      version: REMOTE_CONTRACT_VERSION_V4,
      params: {
        teamSessionId: P6T4_ROOT,
        requestId: request.requestId,
        decision: 'deny',
      },
    })
    const stateAfterRestart = await service2.listControlState(P6T4_ROOT)
    const rawDecisionFactsAfterRestart = controlFacts(world2, 'control-decision-recorded').length

    // (6) The guard still blocks after the restart.
    const pipeline2 = createFakeToolPipeline(service2)
    const verdict3 = await pipeline2.execute(scope)

    return {
      request,
      allowResponse,
      secondResponse,
      stateBeforeRestart,
      rawDecisionFactsBeforeRestart,
      verdict1,
      verdict2,
      restartResponse,
      stateAfterRestart,
      rawDecisionFactsAfterRestart,
      verdict3,
    }
  } finally {
    await destroyP6T1World(world)
  }
})()

// ---------------------------------------------------------------------------
// Scenario 2 (F9H-T2): the UNAUTHORIZED agent — a member (and a leader)
// resolving its own user-approval request; ZERO side effects.
// ---------------------------------------------------------------------------
const S2 = await (async () => {
  const world = await createP6T4World('f9-eoc-2', ['leader', 'worker'])
  try {
    const service = createP6T4Service(world)
    const scope = makeScope({ correlation: 'corr-f9-eoc-2' })

    const request = await service.requestControl({
      rootSessionId: P6T4_ROOT,
      caller: memberCaller(WORKER_ID),
      kind: CONTROL_REQUEST_KINDS.USER_APPROVAL,
      targetInstanceId: WORKER_ID,
      actionName: scope.actionName,
      toolName: scope.toolName,
      correlation: scope.correlation,
    })

    // The MEMBER (the requester itself) attempts the resolve (invariant
    // 37: a member is never a resolver, even with the resolve-control
    // op in its envelope).
    const memberAttempt = await expectControlRejection(
      () =>
        service.resolveControl({
          rootSessionId: P6T4_ROOT,
          caller: memberCaller(WORKER_ID),
          requestId: request.requestId,
          decision: 'allow',
        }),
      'CONTROL_RESOLVER_NOT_AUTHORIZED',
    )

    // The LEADER cannot stand in for the user either (user-approval →
    // the human role ONLY).
    const leaderAttempt = await expectControlRejection(
      () =>
        service.resolveControl({
          rootSessionId: P6T4_ROOT,
          caller: leaderCaller(),
          requestId: request.requestId,
          decision: 'allow',
        }),
      'CONTROL_RESOLVER_NOT_AUTHORIZED',
    )

    // ZERO side effects: the request is still pending, no decision row,
    // no raw durable fact; the guard still blocks request-pending.
    const state = await service.listControlState(P6T4_ROOT)
    const rawDecisionFacts = controlFacts(world, 'control-decision-recorded').length
    const pipeline = createFakeToolPipeline(service)
    const verdict = await pipeline.execute(scope)

    // And the HUMAN (the only allowed role) can still resolve it: the
    // rejection left the request untouched.
    const humanResolve = await service.resolveControl({
      rootSessionId: P6T4_ROOT,
      caller: humanCaller(P6T4_ROOT),
      requestId: request.requestId,
      decision: 'allow',
    })
    const stateAfterHuman = await service.listControlState(P6T4_ROOT)

    return {
      request,
      memberAttempt,
      leaderAttempt,
      state,
      rawDecisionFacts,
      verdict,
      humanResolve,
      stateAfterHuman,
    }
  } finally {
    await destroyP6T1World(world)
  }
})()

// ---------------------------------------------------------------------------
// Assertions (synchronous `it` bodies over the captured results)
// ---------------------------------------------------------------------------

describe('F9 (control exactly-once, F9H-T1): a human allow through the v4 wire is durable and exactly-once', () => {
  it('the v4 human allow succeeds: the durable decision is recorded with the host-stamped human decider + the wire note', () => {
    expect(S1.allowResponse.ok).toBe(true)
    if (!S1.allowResponse.ok) throw new Error('F9-EoC guard: expected success')
    expect(S1.allowResponse.value.provenance.contractVersion).toBe(REMOTE_CONTRACT_VERSION_V4)
    const data = S1.allowResponse.value.data as unknown as Record<string, unknown>
    const decision = data['decision'] as ControlDecisionRecord
    expect(decision.requestId).toBe(S1.request.requestId)
    expect(decision.decision).toBe(CONTROL_DECISION_VALUES.ALLOW)
    expect(decision.note).toBe('the human allows the write')
    // THE AUTHORITY (INV-9.3): the decider is the host-stamped human
    // operator of the validated owned root (the invariant 9 identity
    // channel) — never a client claim, never an instance.
    expect(decision.decider).toEqual({ kind: 'human', humanId: P6T4_ROOT })
  })

  it('a second resolve of the SAME request → typed CONTROL_REQUEST_DECIDED; exactly one decision row + one raw durable fact', () => {
    const error = errorOf(S1.secondResponse)
    expect(error['code']).toBe('CONTROL_REQUEST_DECIDED')
    expect(String(error['message']).includes('already carries a durable decision')).toBe(true)
    const details = error['details'] as Record<string, unknown>
    expect(details['reason']).toBe('domain-error')
    expect(details['contractVersion']).toBe(REMOTE_CONTRACT_VERSION_V4)

    expect(S1.stateBeforeRestart.requests.length).toBe(1)
    const request = expectFirst(S1.stateBeforeRestart.requests, 'request')
    expect(request.status).toBe('decided')
    expect(request.requestId).toBe(S1.request.requestId)
    expect(S1.stateBeforeRestart.decisions.length).toBe(1)
    expect(S1.stateBeforeRestart.consumptions.length).toBe(0)
    expect(S1.rawDecisionFactsBeforeRestart).toBe(1)
  })

  it('the last-mile guard consumes the allow EXACTLY ONCE: the second identical attempt is blocked allow-consumed', () => {
    expect(S1.verdict1.allowed).toBe(true)
    expect(S1.verdict1.requestId).toBe(S1.request.requestId)
    expect(S1.verdict2.allowed).toBe(false)
    expect(S1.verdict2.reason).toBe(CONTROL_GUARD_BLOCK_REASONS.ALLOW_CONSUMED)
    expect(S1.verdict2.requestId).toBe(S1.request.requestId)
  })

  it('after the unit RESTART the decision is still durable, the re-resolve is still rejected, and the guard still blocks', () => {
    const error = errorOf(S1.restartResponse)
    expect(error['code']).toBe('CONTROL_REQUEST_DECIDED')

    expect(S1.stateAfterRestart.requests.length).toBe(1)
    const request = expectFirst(S1.stateAfterRestart.requests, 'request')
    expect(request.status).toBe('decided')
    expect(S1.stateAfterRestart.decisions.length).toBe(1)
    const decision = expectFirst(S1.stateAfterRestart.decisions, 'decision')
    // the durable decision is UNCHANGED by the restart (the first
    // decision is authoritative — the post-restart deny attempt wrote
    // nothing)
    expect(decision.decision).toBe(CONTROL_DECISION_VALUES.ALLOW)
    expect(decision.decider).toEqual({ kind: 'human', humanId: P6T4_ROOT })
    expect(decision.note).toBe('the human allows the write')
    // exactly one consumption (the pre-restart guard check-and-reserve)
    expect(S1.stateAfterRestart.consumptions.length).toBe(1)
    const consumption = expectFirst(S1.stateAfterRestart.consumptions, 'consumption')
    expect(consumption.requestId).toBe(S1.request.requestId)
    expect(S1.rawDecisionFactsAfterRestart).toBe(1)

    // the guard still blocks (the consumption survived the restart)
    expect(S1.verdict3.allowed).toBe(false)
    expect(S1.verdict3.reason).toBe(CONTROL_GUARD_BLOCK_REASONS.ALLOW_CONSUMED)
    expect(S1.verdict3.requestId).toBe(S1.request.requestId)
  })
})

describe('F9 (control authority, F9H-T2): the unauthorized agent is rejected with zero side effects', () => {
  it('a MEMBER resolving its own user-approval request → CONTROL_RESOLVER_NOT_AUTHORIZED (invariant 37; the frozen role closure is unchanged)', () => {
    expect(S2.memberAttempt.code).toBe('CONTROL_RESOLVER_NOT_AUTHORIZED')
    expect(S2.memberAttempt.details?.['role']).toBe('member')
    expect(S2.memberAttempt.details?.['kind']).toBe(CONTROL_REQUEST_KINDS.USER_APPROVAL)
    expect(S2.memberAttempt.details?.['allowedRoles']).toEqual(['human'])
  })

  it('the LEADER cannot stand in for the user either (user-approval admits the human role ONLY)', () => {
    expect(S2.leaderAttempt.code).toBe('CONTROL_RESOLVER_NOT_AUTHORIZED')
    expect(S2.leaderAttempt.details?.['role']).toBe('leader')
    expect(S2.leaderAttempt.details?.['allowedRoles']).toEqual(['human'])
  })

  it('ZERO side effects: the request stays pending, no decision row, no raw fact, the guard still blocks request-pending', () => {
    expect(S2.state.requests.length).toBe(1)
    const request = expectFirst(S2.state.requests, 'request')
    expect(request.status).toBe('pending')
    expect(request.requestId).toBe(S2.request.requestId)
    expect(S2.state.decisions.length).toBe(0)
    expect(S2.state.consumptions.length).toBe(0)
    expect(S2.rawDecisionFacts).toBe(0)
    expect(S2.verdict.allowed).toBe(false)
    expect(S2.verdict.reason).toBe(CONTROL_GUARD_BLOCK_REASONS.REQUEST_PENDING)
  })

  it('the request is still resolvable by the human (the ONLY allowed role): the rejection changed nothing', () => {
    expect(S2.humanResolve.decision).toBe(CONTROL_DECISION_VALUES.ALLOW)
    expect(S2.humanResolve.decider).toEqual({ kind: 'human', humanId: P6T4_ROOT })
    expect(S2.stateAfterHuman.decisions.length).toBe(1)
    const request = expectFirst(S2.stateAfterHuman.requests, 'request')
    expect(request.status).toBe('decided')
  })
})
