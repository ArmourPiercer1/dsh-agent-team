/**
 * P6-T4 MUST-TEST — "allow once": a durable allow authorizes its exact
 * scope EXACTLY ONCE. The guard's check-and-reserve durably consumes the
 * allow on the first allowed execution (the `control-allow-consumed`
 * fact); every later attempt against the same scope — by the same or a
 * different tool layer — finds the consumption and is blocked
 * (`allow-consumed`). A retried/duplicate REQUEST (same scope identity)
 * is idempotent: it returns the existing durable row, writes nothing new,
 * and never re-attributes the request.
 *
 * Test pattern of this repo (the plain-node shim's `it` is synchronous):
 * every async scenario runs at MODULE level (top-level await, the
 * p6t1/p6t2 pattern) and captures its results; the `it` bodies are pure
 * synchronous assertions over the captured values.
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
} from '../control/index.js'
import {
  P6T4_ROOT,
  P6T4_SEEDS,
  controlFacts,
  createFakeToolPipeline,
  createP6T4Service,
  createP6T4World,
  destroyP6T1World,
  expectFirst,
  humanCaller,
  leaderCaller,
  makeScope,
  memberCaller,
} from './p6t4-helpers.js'
import type { FakeToolExecution } from './p6t4-helpers.js'

const WORKER_ID = String(P6T4_SEEDS.worker.instanceId)
const LEADER_ID = String(P6T4_SEEDS.leader.instanceId)

// --- scenario 1: allow → execute → second attempt blocked -------------------------
let s1: {
  readonly request: ControlRequestRecord
  readonly decision: ControlDecisionRecord
  readonly verdict1: FakeToolExecution
  readonly verdict2: FakeToolExecution
  readonly executed: number
  readonly state: {
    readonly requests: readonly ControlRequestRecord[]
    readonly decisions: readonly ControlDecisionRecord[]
    readonly consumptions: readonly ControlConsumptionRecord[]
  }
  readonly rawRequestFacts: number
  readonly rawDecisionFacts: number
  readonly rawConsumptionFacts: number
}
{
  const world = await createP6T4World('p6t4-ao-1', ['leader', 'worker'])
  try {
    const service = createP6T4Service(world)
    const pipeline = createFakeToolPipeline(service)
    const scope = makeScope()

    const request = await service.requestControl({
      rootSessionId: P6T4_ROOT,
      caller: memberCaller(WORKER_ID),
      kind: CONTROL_REQUEST_KINDS.LEADER_APPROVAL,
      targetInstanceId: WORKER_ID,
      actionName: scope.actionName,
      toolName: scope.toolName,
      correlation: scope.correlation,
    })
    const decision = await service.resolveControl({
      rootSessionId: P6T4_ROOT,
      caller: leaderCaller(),
      requestId: request.requestId,
      decision: 'allow',
      note: 'ok to write',
    })
    const verdict1 = await pipeline.execute(scope)
    const verdict2 = await pipeline.execute(scope)
    const state = await service.listControlState(P6T4_ROOT)
    s1 = {
      request,
      decision,
      verdict1,
      verdict2,
      executed: pipeline.executed().length,
      state,
      rawRequestFacts: controlFacts(world, 'control-request-recorded').length,
      rawDecisionFacts: controlFacts(world, 'control-decision-recorded').length,
      rawConsumptionFacts: controlFacts(world, 'control-allow-consumed').length,
    }
  } finally {
    await destroyP6T1World(world)
  }
}

// --- scenario 2: idempotent retry by a different requester -------------------------
let s2: {
  readonly first: ControlRequestRecord
  readonly second: ControlRequestRecord
  readonly rawRequestFacts: number
}
{
  const world = await createP6T4World('p6t4-ao-2', ['leader', 'worker'])
  try {
    const service = createP6T4Service(world)
    const scope = makeScope({ correlation: 'corr-p6t4-ao-idem' })
    const first = await service.requestControl({
      rootSessionId: P6T4_ROOT,
      caller: memberCaller(WORKER_ID),
      kind: CONTROL_REQUEST_KINDS.LEADER_APPROVAL,
      targetInstanceId: WORKER_ID,
      actionName: scope.actionName,
      toolName: scope.toolName,
      correlation: scope.correlation,
    })
    // A retry of the SAME logical request by a DIFFERENT principal (the
    // human owner re-submitting): idempotency over the scope identity.
    const second = await service.requestControl({
      rootSessionId: P6T4_ROOT,
      caller: humanCaller(),
      kind: CONTROL_REQUEST_KINDS.LEADER_APPROVAL,
      targetInstanceId: WORKER_ID,
      actionName: scope.actionName,
      toolName: scope.toolName,
      correlation: scope.correlation,
    })
    s2 = {
      first,
      second,
      rawRequestFacts: controlFacts(world, 'control-request-recorded').length,
    }
  } finally {
    await destroyP6T1World(world)
  }
}

// --- scenario 3: new correlation = new request; never-requested = no-request -------
let s3: {
  readonly verdictConsumed: FakeToolExecution
  readonly verdictConsumedAgain: FakeToolExecution
  readonly verdictNoRequest: FakeToolExecution
  readonly verdictNew: FakeToolExecution
  readonly executed: number
  readonly requests: number
  readonly decisions: number
  readonly consumptions: number
}
{
  const world = await createP6T4World('p6t4-ao-3', ['leader', 'worker'])
  try {
    const service = createP6T4Service(world)
    const pipeline = createFakeToolPipeline(service)

    const scopeA = makeScope({ correlation: 'corr-p6t4-ao-corr-a' })
    const requestA = await service.requestControl({
      rootSessionId: P6T4_ROOT,
      caller: memberCaller(WORKER_ID),
      kind: CONTROL_REQUEST_KINDS.LEADER_APPROVAL,
      targetInstanceId: WORKER_ID,
      actionName: scopeA.actionName,
      toolName: scopeA.toolName,
      correlation: scopeA.correlation,
    })
    await service.resolveControl({
      rootSessionId: P6T4_ROOT,
      caller: leaderCaller(),
      requestId: requestA.requestId,
      decision: 'allow',
    })
    const verdictConsumed = await pipeline.execute(scopeA)
    const verdictConsumedAgain = await pipeline.execute(scopeA)

    // A correlation nobody ever requested: simply no request.
    const scopeB = makeScope({ correlation: 'corr-p6t4-ao-never' })
    const verdictNoRequest = await pipeline.execute(scopeB)

    // A NEW correlation is a NEW logical request (and a new allow).
    const scopeC = makeScope({ correlation: 'corr-p6t4-ao-corr-c' })
    const requestC = await service.requestControl({
      rootSessionId: P6T4_ROOT,
      caller: memberCaller(WORKER_ID),
      kind: CONTROL_REQUEST_KINDS.LEADER_APPROVAL,
      targetInstanceId: WORKER_ID,
      actionName: scopeC.actionName,
      toolName: scopeC.toolName,
      correlation: scopeC.correlation,
    })
    await service.resolveControl({
      rootSessionId: P6T4_ROOT,
      caller: leaderCaller(),
      requestId: requestC.requestId,
      decision: 'allow',
    })
    const verdictNew = await pipeline.execute(scopeC)

    const state = await service.listControlState(P6T4_ROOT)
    s3 = {
      verdictConsumed,
      verdictConsumedAgain,
      verdictNoRequest,
      verdictNew,
      executed: pipeline.executed().length,
      requests: state.requests.length,
      decisions: state.decisions.length,
      consumptions: state.consumptions.length,
    }
  } finally {
    await destroyP6T1World(world)
  }
}

describe('p6t4 allow-once (MUST-TEST: an allow is applied exactly once)', () => {
  it('an allow executes the operation exactly once; a second identical attempt is blocked (allow-consumed)', () => {
    expect(s1.request.status).toBe('pending')
    expect(/^ctrl-[a-z0-9]{24}$/.test(s1.request.requestId)).toBe(true)
    expect(s1.request.requester).toEqual({
      kind: 'instance',
      instanceId: WORKER_ID,
      role: 'member',
    })
    expect(s1.decision.decision).toBe(CONTROL_DECISION_VALUES.ALLOW)
    expect(s1.decision.note).toBe('ok to write')
    expect(s1.decision.decider).toEqual({
      kind: 'instance',
      instanceId: LEADER_ID,
      role: 'leader',
    })
    expect(s1.verdict1.allowed).toBe(true)
    expect(s1.verdict1.requestId).toBe(s1.request.requestId)
    expect(s1.verdict1.decisionSequence).toBe(s1.decision.decisionSequence)
    expect(s1.verdict2.allowed).toBe(false)
    expect(s1.verdict2.reason).toBe(CONTROL_GUARD_BLOCK_REASONS.ALLOW_CONSUMED)
    expect(s1.verdict2.requestId).toBe(s1.request.requestId)
    expect(s1.executed).toBe(1)
  })

  it('the durable state carries exactly one request / one allow decision / one consumption of the exact scope, with one raw fact per family', () => {
    expect(s1.state.requests.length).toBe(1)
    const request = expectFirst(s1.state.requests, 'request')
    expect(request.status).toBe('decided')
    expect(request.requestId).toBe(s1.request.requestId)
    expect(request.correlation).toBe('corr-p6t4-w1')
    expect(s1.state.decisions.length).toBe(1)
    const decision = expectFirst(s1.state.decisions, 'decision')
    expect(decision.decision).toBe(CONTROL_DECISION_VALUES.ALLOW)
    expect(decision.requestSequence).toBe(request.requestSequence)
    expect(decision.decisionSequence).toBeGreaterThan(decision.requestSequence)
    expect(decision.scope).toEqual({
      rootSessionId: P6T4_ROOT,
      targetInstanceId: WORKER_ID,
      actionName: 'write-file',
      toolName: 'fs.write',
      correlation: 'corr-p6t4-w1',
    })
    expect(s1.state.consumptions.length).toBe(1)
    const consumption = expectFirst(s1.state.consumptions, 'consumption')
    expect(consumption.requestId).toBe(request.requestId)
    expect(consumption.decisionSequence).toBe(decision.decisionSequence)
    expect(consumption.scope).toEqual(decision.scope)
    expect(s1.rawRequestFacts).toBe(1)
    expect(s1.rawDecisionFacts).toBe(1)
    expect(s1.rawConsumptionFacts).toBe(1)
  })

  it('an idempotent retry by a DIFFERENT requester returns the same durable row (zero new rows, original requester preserved)', () => {
    expect(s2.second.requestId).toBe(s2.first.requestId)
    expect(s2.second.requestSequence).toBe(s2.first.requestSequence)
    expect(s2.second.status).toBe('pending')
    // The original requester stands: idempotency never re-attributes.
    expect(s2.second.requester).toEqual({
      kind: 'instance',
      instanceId: WORKER_ID,
      role: 'member',
    })
    expect(s2.rawRequestFacts).toBe(1)
  })

  it('a new correlation is a NEW request (a new execution); a never-requested correlation is simply no-request', () => {
    expect(s3.verdictConsumed.allowed).toBe(true)
    expect(s3.verdictConsumedAgain.allowed).toBe(false)
    expect(s3.verdictConsumedAgain.reason).toBe(CONTROL_GUARD_BLOCK_REASONS.ALLOW_CONSUMED)
    expect(s3.verdictNoRequest.allowed).toBe(false)
    expect(s3.verdictNoRequest.reason).toBe(CONTROL_GUARD_BLOCK_REASONS.NO_REQUEST)
    expect(s3.verdictNew.allowed).toBe(true)
    expect(s3.executed).toBe(2)
    expect(s3.requests).toBe(2)
    expect(s3.decisions).toBe(2)
    expect(s3.consumptions).toBe(2)
  })
})
