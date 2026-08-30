/**
 * P6-T4 NEGATIVES (task card): the failure paths a control plane must
 * make impossible —
 * - unknown target (a valid-format instance id with no durable record);
 * - self-approval where unauthorized (the resolver ROLE CLOSURE beats the
 *   envelope — invariant 37: a member is never a resolver, even when its
 *   member envelope carries `resolve-control`; the user-approval kind
 *   admits only the human);
 * - a decision without a request;
 * - the double-spend of an allow (two tool-layer instances, one durable
 *   allow — exactly one execution);
 * - malformed inputs (every closed-set / shape violation, zero rows);
 * - the requester envelope boundary (a template without `request-control`);
 * - the resolver envelope boundary (a team envelope without
 *   `resolve-control` — the human is still not envelope-bound, inv 34);
 * - a stale CALLER (the caller check precedes the target check);
 * - the scope mismatch (an allow authorizes its EXACT scope snapshot);
 * - and the defensive ambiguity invariant (a corrupted durable state with
 *   two unconsumed allows for one scope — the guard refuses to guess,
 *   constructible only by bypassing the service's own writers).
 *
 * Test pattern of this repo (the plain-node shim's `it` is synchronous):
 * every async scenario runs at MODULE level (top-level await, the
 * p6t1/p6t2 pattern) and captures its results; the `it` bodies are pure
 * synchronous assertions over the captured values.
 */

import { describe, expect, it } from 'vitest'
import {
  CONTROL_DECISION_VALUES,
  CONTROL_ERROR_CODES,
  CONTROL_GUARD_BLOCK_REASONS,
  CONTROL_REQUEST_KINDS,
  CONTROL_RESOLVER_ROLES,
} from '../control/index.js'
import { TEAM_RUNTIME_ERROR_CODES } from '../admission/index.js'
import {
  P6T4_BLUEPRINT_SOURCE,
  P6T4_ROOT,
  P6T4_SEEDS,
  controlFacts,
  createFakeToolPipeline,
  createP6T4Service,
  createP6T4World,
  destroyP6T1World,
  expectControlRejection,
  expectFirst,
  expectRuntimeRejection,
  flipLifecycle,
  humanCaller,
  leaderCaller,
  makeScope,
  memberCaller,
  writeRawControlFact,
} from './p6t4-helpers.js'
import type { FakeToolExecution } from './p6t4-helpers.js'

const WORKER_ID = String(P6T4_SEEDS.worker.instanceId)
const SCRIBE_ID = String(P6T4_SEEDS.scribe.instanceId)

type Rejection = {
  readonly code: string
  readonly details?: Record<string, unknown>
}

// --- scenario 1: unknown target -------------------------------------------------------
let s1: { readonly rejected: Rejection; readonly facts: number }
{
  const world = await createP6T4World('p6t4-neg-1', ['leader', 'worker'])
  try {
    const service = createP6T4Service(world)
    const rejected = await expectRuntimeRejection(
      () =>
        service.requestControl({
          rootSessionId: P6T4_ROOT,
          caller: leaderCaller(),
          kind: CONTROL_REQUEST_KINDS.LEADER_APPROVAL,
          targetInstanceId: 'inst-p6t4ghost',
          actionName: 'write-file',
          toolName: 'fs.write',
          correlation: 'corr-p6t4-neg-ghost',
        }),
      TEAM_RUNTIME_ERROR_CODES.INSTANCE_NOT_FOUND,
    )
    s1 = {
      rejected: { code: rejected.code, details: rejected.details },
      facts: controlFacts(world).length,
    }
  } finally {
    await destroyP6T1World(world)
  }
}

// --- scenario 2: self-approval (role closure beats the envelope) ----------------------
let s2: {
  readonly rejected: Rejection
  readonly decisions: number
  readonly verdict: FakeToolExecution
  readonly executed: number
}
{
  const world = await createP6T4World('p6t4-neg-2', ['leader', 'worker'])
  try {
    const service = createP6T4Service(world)
    const pipeline = createFakeToolPipeline(service)
    const scope = makeScope({ correlation: 'corr-p6t4-neg-self' })
    const request = await service.requestControl({
      rootSessionId: P6T4_ROOT,
      caller: memberCaller(WORKER_ID),
      kind: CONTROL_REQUEST_KINDS.LEADER_APPROVAL,
      targetInstanceId: WORKER_ID,
      actionName: scope.actionName,
      toolName: scope.toolName,
      correlation: scope.correlation,
    })

    // The worker's member envelope DOES carry resolve-control — the
    // rejection must therefore come from the role closure, not the
    // envelope.
    const rejected = await expectControlRejection(
      () =>
        service.resolveControl({
          rootSessionId: P6T4_ROOT,
          caller: memberCaller(WORKER_ID),
          requestId: request.requestId,
          decision: 'allow',
        }),
      CONTROL_ERROR_CODES.CONTROL_RESOLVER_NOT_AUTHORIZED,
    )
    const state = await service.listControlState(P6T4_ROOT)
    const verdict = await pipeline.execute(scope)
    s2 = {
      rejected: { code: rejected.code, details: rejected.details },
      decisions: state.decisions.length,
      verdict,
      executed: pipeline.executed().length,
    }
  } finally {
    await destroyP6T1World(world)
  }
}

// --- scenario 3: user-approval admits only the human ----------------------------------
let s3: {
  readonly rejectedLeader: Rejection
  readonly decisionValue: string
}
{
  const world = await createP6T4World('p6t4-neg-3', ['leader', 'worker'])
  try {
    const service = createP6T4Service(world)
    const scope = makeScope({ correlation: 'corr-p6t4-neg-user' })
    const request = await service.requestControl({
      rootSessionId: P6T4_ROOT,
      caller: memberCaller(WORKER_ID),
      kind: CONTROL_REQUEST_KINDS.USER_APPROVAL,
      targetInstanceId: WORKER_ID,
      actionName: scope.actionName,
      toolName: scope.toolName,
      correlation: scope.correlation,
    })

    const rejectedLeader = await expectControlRejection(
      () =>
        service.resolveControl({
          rootSessionId: P6T4_ROOT,
          caller: leaderCaller(),
          requestId: request.requestId,
          decision: 'allow',
        }),
      CONTROL_ERROR_CODES.CONTROL_RESOLVER_NOT_AUTHORIZED,
    )

    // The human IS the resolver for this kind.
    const decision = await service.resolveControl({
      rootSessionId: P6T4_ROOT,
      caller: humanCaller(),
      requestId: request.requestId,
      decision: 'allow',
    })
    s3 = {
      rejectedLeader: {
        code: rejectedLeader.code,
        details: rejectedLeader.details,
      },
      decisionValue: decision.decision,
    }
  } finally {
    await destroyP6T1World(world)
  }
}

// --- scenario 4: a decision without a request -----------------------------------------
let s4: { readonly rejected: Rejection; readonly facts: number }
{
  const world = await createP6T4World('p6t4-neg-4', ['leader', 'worker'])
  try {
    const service = createP6T4Service(world)
    const rejected = await expectControlRejection(
      () =>
        service.resolveControl({
          rootSessionId: P6T4_ROOT,
          caller: leaderCaller(),
          requestId: 'ctrl-p6t4-ghost-request',
          decision: 'allow',
        }),
      CONTROL_ERROR_CODES.CONTROL_REQUEST_NOT_FOUND,
    )
    s4 = {
      rejected: { code: rejected.code, details: rejected.details },
      facts: controlFacts(world).length,
    }
  } finally {
    await destroyP6T1World(world)
  }
}

// --- scenario 5: the double-spend of an allow -----------------------------------------
let s5: {
  readonly first: FakeToolExecution
  readonly second: FakeToolExecution
  readonly executedA: number
  readonly executedB: number
  readonly consumptionRequestId: string
  readonly consumptionDecisionSequence: number
}
{
  const world = await createP6T4World('p6t4-neg-5', ['leader', 'worker'])
  try {
    const service = createP6T4Service(world)
    const scope = makeScope({ correlation: 'corr-p6t4-neg-twice' })
    const request = await service.requestControl({
      rootSessionId: P6T4_ROOT,
      caller: memberCaller(WORKER_ID),
      kind: CONTROL_REQUEST_KINDS.LEADER_APPROVAL,
      targetInstanceId: WORKER_ID,
      actionName: scope.actionName,
      toolName: scope.toolName,
      correlation: scope.correlation,
    })
    await service.resolveControl({
      rootSessionId: P6T4_ROOT,
      caller: leaderCaller(),
      requestId: request.requestId,
      decision: 'allow',
    })

    // Two tool-layer instances (two pipelines / different callers'
    // pipelines, one durable allow).
    const pipelineA = createFakeToolPipeline(service)
    const pipelineB = createFakeToolPipeline(service)
    const first = await pipelineA.execute(scope)
    const second = await pipelineB.execute(scope)

    // Durable: one consumption, attributed to the winning verdict.
    const state = await service.listControlState(P6T4_ROOT)
    const consumption = expectFirst(state.consumptions, 'consumption')
    s5 = {
      first,
      second,
      executedA: pipelineA.executed().length,
      executedB: pipelineB.executed().length,
      consumptionRequestId: consumption.requestId,
      consumptionDecisionSequence: consumption.decisionSequence,
    }
  } finally {
    await destroyP6T1World(world)
  }
}

// --- scenario 6: the defensive ambiguity invariant -------------------------------------
let s6: {
  readonly requestsBefore: number
  readonly requestIdA: string
  readonly requestIdB: string
  readonly decisionsBefore: number
  readonly consumptionsBefore: number
  readonly rejected: Rejection
  readonly consumptionsAfter: number
}
{
  const world = await createP6T4World('p6t4-neg-6', ['leader', 'worker'])
  try {
    const service = createP6T4Service(world)
    const scope = makeScope({ correlation: 'corr-p6t4-neg-ambig' })
    const request = await service.requestControl({
      rootSessionId: P6T4_ROOT,
      caller: memberCaller(WORKER_ID),
      kind: CONTROL_REQUEST_KINDS.LEADER_APPROVAL,
      targetInstanceId: WORKER_ID,
      actionName: scope.actionName,
      toolName: scope.toolName,
      correlation: scope.correlation,
    })
    await service.resolveControl({
      rootSessionId: P6T4_ROOT,
      caller: leaderCaller(),
      requestId: request.requestId,
      decision: 'allow',
    })

    // Corrupt the durable state by duplicating the request fact with the
    // service's OWN payload (same requestId) — a state the service's
    // writers can never produce (idempotency returns the existing row).
    const requestRow = expectFirst(
      controlFacts(world, 'control-request-recorded'),
      'request row',
    )
    await writeRawControlFact(world, 'control-request-recorded', requestRow.payload)

    const state = await service.listControlState(P6T4_ROOT)
    const rejected = await expectControlRejection(
      () => service.guardOperation(scope),
      CONTROL_ERROR_CODES.CONTROL_GUARD_AMBIGUOUS,
    )

    // The guard refused to guess: nothing was consumed.
    const after = await service.listControlState(P6T4_ROOT)
    s6 = {
      requestsBefore: state.requests.length,
      requestIdA: state.requests[0]?.requestId ?? '',
      requestIdB: state.requests[1]?.requestId ?? '',
      decisionsBefore: state.decisions.length,
      consumptionsBefore: state.consumptions.length,
      rejected: { code: rejected.code, details: rejected.details },
      consumptionsAfter: after.consumptions.length,
    }
  } finally {
    await destroyP6T1World(world)
  }
}

// --- scenario 7: malformed inputs -------------------------------------------------------
let s7: {
  readonly reqKind: Rejection
  readonly reqCorrelation: Rejection
  readonly reqCapabilityDomain: Rejection
  readonly reqRoot: Rejection
  readonly resDecision: Rejection
  readonly resRequestId: Rejection
  readonly guardRoot: Rejection
  readonly guardTarget: Rejection
  readonly guardAction: Rejection
  readonly guardCapabilityDomain: Rejection
  readonly facts: number
}
{
  const world = await createP6T4World('p6t4-neg-7', ['leader', 'worker'])
  try {
    const service = createP6T4Service(world)
    const base = makeScope({ correlation: 'corr-p6t4-neg-malformed' })

    // --- requestControl stage ---
    const reqKind = await expectControlRejection(
      () =>
        service.requestControl({
          rootSessionId: P6T4_ROOT,
          caller: memberCaller(WORKER_ID),
          kind: 'bogus-kind' as never,
          targetInstanceId: WORKER_ID,
          actionName: base.actionName,
          toolName: base.toolName,
          correlation: base.correlation,
        }),
      CONTROL_ERROR_CODES.CONTROL_REQUEST_MALFORMED,
    )
    const reqCorrelation = await expectControlRejection(
      () =>
        service.requestControl({
          rootSessionId: P6T4_ROOT,
          caller: memberCaller(WORKER_ID),
          kind: CONTROL_REQUEST_KINDS.LEADER_APPROVAL,
          targetInstanceId: WORKER_ID,
          actionName: base.actionName,
          toolName: base.toolName,
          correlation: '',
        }),
      CONTROL_ERROR_CODES.CONTROL_REQUEST_MALFORMED,
    )
    const reqCapabilityDomain = await expectControlRejection(
      () =>
        service.requestControl({
          rootSessionId: P6T4_ROOT,
          caller: memberCaller(WORKER_ID),
          kind: CONTROL_REQUEST_KINDS.LEADER_APPROVAL,
          targetInstanceId: WORKER_ID,
          actionName: base.actionName,
          toolName: base.toolName,
          capabilityDomain: 'bogus-domain' as never,
          correlation: base.correlation,
        }),
      CONTROL_ERROR_CODES.CONTROL_REQUEST_MALFORMED,
    )
    const reqRoot = await expectControlRejection(
      () =>
        service.requestControl({
          rootSessionId: 'bad root',
          caller: memberCaller(WORKER_ID),
          kind: CONTROL_REQUEST_KINDS.LEADER_APPROVAL,
          targetInstanceId: WORKER_ID,
          actionName: base.actionName,
          toolName: base.toolName,
          correlation: base.correlation,
        }),
      CONTROL_ERROR_CODES.CONTROL_REQUEST_MALFORMED,
    )

    // --- resolveControl stage ---
    const resDecision = await expectControlRejection(
      () =>
        service.resolveControl({
          rootSessionId: P6T4_ROOT,
          caller: leaderCaller(),
          requestId: 'ctrl-p6t4-ghost-request',
          decision: 'maybe' as never,
        }),
      CONTROL_ERROR_CODES.CONTROL_REQUEST_MALFORMED,
    )
    const resRequestId = await expectControlRejection(
      () =>
        service.resolveControl({
          rootSessionId: P6T4_ROOT,
          caller: leaderCaller(),
          requestId: '',
          decision: 'allow',
        }),
      CONTROL_ERROR_CODES.CONTROL_REQUEST_MALFORMED,
    )

    // --- guardOperation stage ---
    const guardRoot = await expectControlRejection(
      () => service.guardOperation({ ...base, rootSessionId: 'bad root' }),
      CONTROL_ERROR_CODES.CONTROL_GUARD_MALFORMED,
    )
    const guardTarget = await expectControlRejection(
      () => service.guardOperation({ ...base, targetInstanceId: 'not-an-id' }),
      CONTROL_ERROR_CODES.CONTROL_GUARD_MALFORMED,
    )
    const guardAction = await expectControlRejection(
      () => service.guardOperation({ ...base, actionName: '' }),
      CONTROL_ERROR_CODES.CONTROL_GUARD_MALFORMED,
    )
    const guardCapabilityDomain = await expectControlRejection(
      () =>
        service.guardOperation({
          ...base,
          capabilityDomain: 'bogus-domain' as never,
        }),
      CONTROL_ERROR_CODES.CONTROL_GUARD_MALFORMED,
    )

    s7 = {
      reqKind: { code: reqKind.code, details: reqKind.details },
      reqCorrelation: {
        code: reqCorrelation.code,
        details: reqCorrelation.details,
      },
      reqCapabilityDomain: {
        code: reqCapabilityDomain.code,
        details: reqCapabilityDomain.details,
      },
      reqRoot: { code: reqRoot.code, details: reqRoot.details },
      resDecision: { code: resDecision.code, details: resDecision.details },
      resRequestId: { code: resRequestId.code, details: resRequestId.details },
      guardRoot: { code: guardRoot.code, details: guardRoot.details },
      guardTarget: { code: guardTarget.code, details: guardTarget.details },
      guardAction: { code: guardAction.code, details: guardAction.details },
      guardCapabilityDomain: {
        code: guardCapabilityDomain.code,
        details: guardCapabilityDomain.details,
      },
      facts: controlFacts(world).length,
    }
  } finally {
    await destroyP6T1World(world)
  }
}

// --- scenario 8: the requester envelope boundary ---------------------------------------
let s8: { readonly rejected: Rejection; readonly facts: number }
{
  const world = await createP6T4World('p6t4-neg-8', [
    'leader',
    'worker',
    'scribe',
  ])
  try {
    const service = createP6T4Service(world)
    // The scribe template carries NO request-control op.
    const rejected = await expectRuntimeRejection(
      () =>
        service.requestControl({
          rootSessionId: P6T4_ROOT,
          caller: memberCaller(SCRIBE_ID),
          kind: CONTROL_REQUEST_KINDS.LEADER_APPROVAL,
          targetInstanceId: SCRIBE_ID,
          actionName: 'write-file',
          toolName: 'fs.write',
          correlation: 'corr-p6t4-neg-scribe',
        }),
      TEAM_RUNTIME_ERROR_CODES.ENVELOPE_OUT_OF_BOUNDS,
    )
    s8 = {
      rejected: { code: rejected.code, details: rejected.details },
      facts: controlFacts(world).length,
    }
  } finally {
    await destroyP6T1World(world)
  }
}

// --- scenario 9: the resolver envelope boundary (team envelope only) -------------------
let s9: {
  readonly rejectedLeader: Rejection
  readonly blocked: FakeToolExecution
  readonly decisionValue: string
  readonly verdict: FakeToolExecution
  readonly executed: number
}
{
  // The P6-T4 blueprint with ONE line removed: the team envelope's
  // `resolve-control` allow (the 4-space indent; the worker's member
  // envelope carries the same op at 8-space indent and is untouched).
  const stripped = P6T4_BLUEPRINT_SOURCE.split('\n')
    .filter((line) => line !== '    - resolve-control')
    .join('\n')
  const world = await createP6T4World('p6t4-neg-9', ['leader', 'worker'], {
    blueprintSource: stripped,
  })
  try {
    const service = createP6T4Service(world)
    const pipeline = createFakeToolPipeline(service)
    const scope = makeScope({ correlation: 'corr-p6t4-neg-tenv' })

    // The member request still passes (its own envelope carries
    // request-control; the team envelope still allows it).
    const request = await service.requestControl({
      rootSessionId: P6T4_ROOT,
      caller: memberCaller(WORKER_ID),
      kind: CONTROL_REQUEST_KINDS.LEADER_APPROVAL,
      targetInstanceId: WORKER_ID,
      actionName: scope.actionName,
      toolName: scope.toolName,
      correlation: scope.correlation,
    })

    // The leader is role-authorized but envelope-OUT: the team envelope
    // no longer grants resolve-control.
    const rejectedLeader = await expectRuntimeRejection(
      () =>
        service.resolveControl({
          rootSessionId: P6T4_ROOT,
          caller: leaderCaller(),
          requestId: request.requestId,
          decision: 'allow',
        }),
      TEAM_RUNTIME_ERROR_CODES.ENVELOPE_OUT_OF_BOUNDS,
    )
    const blocked = await pipeline.execute(scope)

    // The human exceeds the TEAM envelope (never the external hard
    // policy): the same request resolves and the guard admits.
    const decision = await service.resolveControl({
      rootSessionId: P6T4_ROOT,
      caller: humanCaller(),
      requestId: request.requestId,
      decision: 'allow',
    })
    const verdict = await pipeline.execute(scope)
    s9 = {
      rejectedLeader: {
        code: rejectedLeader.code,
        details: rejectedLeader.details,
      },
      blocked,
      decisionValue: decision.decision,
      verdict,
      executed: pipeline.executed().length,
    }
  } finally {
    await destroyP6T1World(world)
  }
}

// --- scenario 10: a stale caller --------------------------------------------------------
let s10: { readonly rejected: Rejection; readonly facts: number }
{
  const world = await createP6T4World('p6t4-neg-10', ['leader', 'worker'])
  try {
    const service = createP6T4Service(world)
    await flipLifecycle(world, WORKER_ID, 'DISPOSED')
    const rejected = await expectRuntimeRejection(
      () =>
        service.requestControl({
          rootSessionId: P6T4_ROOT,
          caller: memberCaller(WORKER_ID),
          kind: CONTROL_REQUEST_KINDS.LEADER_APPROVAL,
          targetInstanceId: WORKER_ID,
          actionName: 'write-file',
          toolName: 'fs.write',
          correlation: 'corr-p6t4-neg-deadcaller',
        }),
      TEAM_RUNTIME_ERROR_CODES.CALLER_ROLE_STALE,
    )
    s10 = {
      rejected: { code: rejected.code, details: rejected.details },
      facts: controlFacts(world).length,
    }
  } finally {
    await destroyP6T1World(world)
  }
}

// --- scenario 11: the scope mismatch -----------------------------------------------------
let s11: {
  readonly drifted: FakeToolExecution
  readonly executedAfterDrift: number
  readonly exact: FakeToolExecution
  readonly executed: number
  readonly consumptions: number
}
{
  const world = await createP6T4World('p6t4-neg-11', ['leader', 'worker'])
  try {
    const service = createP6T4Service(world)
    const pipeline = createFakeToolPipeline(service)
    // Requested (and allowed) WITHOUT a capabilityDomain.
    const exact = makeScope({ correlation: 'corr-p6t4-neg-scope' })
    const request = await service.requestControl({
      rootSessionId: P6T4_ROOT,
      caller: memberCaller(WORKER_ID),
      kind: CONTROL_REQUEST_KINDS.LEADER_APPROVAL,
      targetInstanceId: exact.targetInstanceId,
      actionName: exact.actionName,
      toolName: exact.toolName,
      correlation: exact.correlation,
    })
    await service.resolveControl({
      rootSessionId: P6T4_ROOT,
      caller: leaderCaller(),
      requestId: request.requestId,
      decision: 'allow',
    })

    // Same identity (the idempotency key excludes capabilityDomain), but
    // a DIFFERENT scope: the durable decision snapshot does not cover
    // this — the guard fails closed without consuming.
    const drifted = await pipeline.execute(
      makeScope({
        correlation: exact.correlation,
        actionName: exact.actionName,
        toolName: exact.toolName,
        targetInstanceId: exact.targetInstanceId,
        capabilityDomain: 'skills',
      }),
    )

    // The exact scope is still unconsumed and is admitted (once).
    const executedAfterDrift = pipeline.executed().length
    const exactVerdict = await pipeline.execute(exact)
    const state = await service.listControlState(P6T4_ROOT)
    s11 = {
      drifted,
      executedAfterDrift,
      exact: exactVerdict,
      executed: pipeline.executed().length,
      consumptions: state.consumptions.length,
    }
  } finally {
    await destroyP6T1World(world)
  }
}

describe('p6t4 negatives (every unauthorized / impossible path fails closed)', () => {
  it('unknown target: a valid-format instance id with no durable record is the facade INSTANCE_NOT_FOUND, with zero rows', () => {
    expect(s1.rejected.code).toBe(TEAM_RUNTIME_ERROR_CODES.INSTANCE_NOT_FOUND)
    expect(s1.facts).toBe(0)
  })

  it('self-approval: a member resolving its OWN request is unauthorized even when its envelope carries resolve-control (role closure, invariant 37)', () => {
    expect(s2.rejected.code).toBe(
      CONTROL_ERROR_CODES.CONTROL_RESOLVER_NOT_AUTHORIZED,
    )
    expect(s2.rejected.details?.['kind']).toBe(
      CONTROL_REQUEST_KINDS.LEADER_APPROVAL,
    )
    expect(s2.rejected.details?.['role']).toBe('member')
    expect(s2.rejected.details?.['allowedRoles']).toEqual(
      CONTROL_RESOLVER_ROLES[CONTROL_REQUEST_KINDS.LEADER_APPROVAL],
    )
    // No decision row exists, and the guard still reports pending.
    expect(s2.decisions).toBe(0)
    expect(s2.verdict.allowed).toBe(false)
    expect(s2.verdict.reason).toBe(CONTROL_GUARD_BLOCK_REASONS.REQUEST_PENDING)
    expect(s2.executed).toBe(0)
  })

  it('user-approval kind: the leader cannot stand in for the user (the kind admits only the human)', () => {
    expect(s3.rejectedLeader.code).toBe(
      CONTROL_ERROR_CODES.CONTROL_RESOLVER_NOT_AUTHORIZED,
    )
    expect(s3.rejectedLeader.details?.['kind']).toBe(
      CONTROL_REQUEST_KINDS.USER_APPROVAL,
    )
    expect(s3.rejectedLeader.details?.['role']).toBe('leader')
    expect(s3.rejectedLeader.details?.['allowedRoles']).toEqual(
      CONTROL_RESOLVER_ROLES[CONTROL_REQUEST_KINDS.USER_APPROVAL],
    )
    // The human IS the resolver for this kind.
    expect(s3.decisionValue).toBe(CONTROL_DECISION_VALUES.ALLOW)
  })

  it('decision without a request: an unknown requestId is CONTROL_REQUEST_NOT_FOUND, with zero rows', () => {
    expect(s4.rejected.code).toBe(
      CONTROL_ERROR_CODES.CONTROL_REQUEST_NOT_FOUND,
    )
    expect(s4.rejected.details?.['requestId']).toBe('ctrl-p6t4-ghost-request')
    expect(s4.facts).toBe(0)
  })

  it('double-spend: two tool-layer instances against one durable allow — exactly one executes', () => {
    expect(s5.first.allowed).toBe(true)
    expect(s5.second.allowed).toBe(false)
    expect(s5.second.reason).toBe(CONTROL_GUARD_BLOCK_REASONS.ALLOW_CONSUMED)
    expect(s5.executedA).toBe(1)
    expect(s5.executedB).toBe(0)
    // Durable: one consumption, attributed to the winning verdict.
    expect(s5.consumptionRequestId).toBe(String(s5.first.requestId))
    expect(s5.consumptionDecisionSequence).toBe(
      typeof s5.first.decisionSequence === 'number'
        ? s5.first.decisionSequence
        : -1,
    )
  })

  it('ambiguous durable state: two unconsumed allows for one scope — the guard throws CONTROL_GUARD_AMBIGUOUS and never consumes (defensive invariant, constructible only by raw ledger facts)', () => {
    expect(s6.requestsBefore).toBe(2)
    expect(s6.requestIdA).toBe(s6.requestIdB)
    expect(s6.decisionsBefore).toBe(1)
    expect(s6.consumptionsBefore).toBe(0)
    expect(s6.rejected.code).toBe(
      CONTROL_ERROR_CODES.CONTROL_GUARD_AMBIGUOUS,
    )
    const requestIds = s6.rejected.details?.['requestIds']
    expect(Array.isArray(requestIds)).toBe(true)
    if (Array.isArray(requestIds)) {
      expect(requestIds).toEqual([s6.requestIdA, s6.requestIdA])
    }
    // The guard refused to guess: nothing was consumed.
    expect(s6.consumptionsAfter).toBe(0)
  })

  it('malformed inputs: every closed-set / shape violation is rejected with the exact stage+field, and ZERO rows', () => {
    // --- requestControl stage ---
    expect(s7.reqKind.code).toBe(CONTROL_ERROR_CODES.CONTROL_REQUEST_MALFORMED)
    expect(s7.reqKind.details?.['stage']).toBe('request')
    expect(s7.reqKind.details?.['field']).toBe('kind')
    expect(s7.reqCorrelation.code).toBe(
      CONTROL_ERROR_CODES.CONTROL_REQUEST_MALFORMED,
    )
    expect(s7.reqCorrelation.details?.['stage']).toBe('request')
    expect(s7.reqCorrelation.details?.['field']).toBe('correlation')
    expect(s7.reqCapabilityDomain.code).toBe(
      CONTROL_ERROR_CODES.CONTROL_REQUEST_MALFORMED,
    )
    expect(s7.reqCapabilityDomain.details?.['stage']).toBe('request')
    expect(s7.reqCapabilityDomain.details?.['field']).toBe('capabilityDomain')
    expect(s7.reqRoot.code).toBe(CONTROL_ERROR_CODES.CONTROL_REQUEST_MALFORMED)
    expect(s7.reqRoot.details?.['stage']).toBe('request')
    expect(s7.reqRoot.details?.['field']).toBe('rootSessionId')
    // --- resolveControl stage ---
    expect(s7.resDecision.code).toBe(
      CONTROL_ERROR_CODES.CONTROL_REQUEST_MALFORMED,
    )
    expect(s7.resDecision.details?.['stage']).toBe('resolve')
    expect(s7.resDecision.details?.['field']).toBe('decision')
    expect(s7.resRequestId.code).toBe(
      CONTROL_ERROR_CODES.CONTROL_REQUEST_MALFORMED,
    )
    expect(s7.resRequestId.details?.['stage']).toBe('resolve')
    expect(s7.resRequestId.details?.['field']).toBe('requestId')
    // --- guardOperation stage ---
    expect(s7.guardRoot.code).toBe(CONTROL_ERROR_CODES.CONTROL_GUARD_MALFORMED)
    expect(s7.guardRoot.details?.['stage']).toBe('guard')
    expect(s7.guardRoot.details?.['field']).toBe('rootSessionId')
    expect(s7.guardTarget.code).toBe(
      CONTROL_ERROR_CODES.CONTROL_GUARD_MALFORMED,
    )
    expect(s7.guardTarget.details?.['stage']).toBe('guard')
    expect(s7.guardTarget.details?.['field']).toBe('targetInstanceId')
    expect(s7.guardAction.code).toBe(
      CONTROL_ERROR_CODES.CONTROL_GUARD_MALFORMED,
    )
    expect(s7.guardAction.details?.['stage']).toBe('guard')
    expect(s7.guardAction.details?.['field']).toBe('actionName')
    expect(s7.guardCapabilityDomain.code).toBe(
      CONTROL_ERROR_CODES.CONTROL_GUARD_MALFORMED,
    )
    expect(s7.guardCapabilityDomain.details?.['stage']).toBe('guard')
    expect(s7.guardCapabilityDomain.details?.['field']).toBe('capabilityDomain')
    // Every malformed input was rejected in the read phase: the durable
    // store never saw a control row.
    expect(s7.facts).toBe(0)
  })

  it('requester envelope: a template without request-control is the facade ENVELOPE_OUT_OF_BOUNDS, with zero rows', () => {
    expect(s8.rejected.code).toBe(
      TEAM_RUNTIME_ERROR_CODES.ENVELOPE_OUT_OF_BOUNDS,
    )
    expect(s8.facts).toBe(0)
  })

  it('resolver envelope: a team envelope without resolve-control blocks the LEADER (the human is not envelope-bound — invariant 34)', () => {
    expect(s9.rejectedLeader.code).toBe(
      TEAM_RUNTIME_ERROR_CODES.ENVELOPE_OUT_OF_BOUNDS,
    )
    expect(s9.blocked.allowed).toBe(false)
    expect(s9.blocked.reason).toBe(CONTROL_GUARD_BLOCK_REASONS.REQUEST_PENDING)
    expect(s9.decisionValue).toBe(CONTROL_DECISION_VALUES.ALLOW)
    expect(s9.verdict.allowed).toBe(true)
    expect(s9.executed).toBe(1)
  })

  it('stale caller: a DISPOSED requester is rejected by the CALLER check (which precedes the target check), zero rows', () => {
    expect(s10.rejected.code).toBe(
      TEAM_RUNTIME_ERROR_CODES.CALLER_ROLE_STALE,
    )
    expect(s10.facts).toBe(0)
  })

  it('scope mismatch: an allow authorizes its EXACT scope snapshot — an added capabilityDomain is refused, the exact scope is admitted', () => {
    expect(s11.drifted.allowed).toBe(false)
    expect(s11.drifted.reason).toBe(CONTROL_GUARD_BLOCK_REASONS.SCOPE_MISMATCH)
    expect(s11.executedAfterDrift).toBe(0)
    expect(s11.exact.allowed).toBe(true)
    expect(s11.executed).toBe(1)
    expect(s11.consumptions).toBe(1)
  })
})
