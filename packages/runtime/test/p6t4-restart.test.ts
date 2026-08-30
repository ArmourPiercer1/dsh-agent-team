/**
 * P6-T4 MUST-TEST — "restart": the control state is DURABLE in the
 * TeamDomain (append-only ledger facts). A unit restart (re-instantiate
 * the module + re-open the repositories over the SAME durable store —
 * `restartP6T1World`) loses no control state: pending requests, recorded
 * decisions and consumption marks are recovered by a FRESH service over
 * the reopened domain; an unconsumed allow survives the restart and is
 * still consumable exactly once (invariant 41: TeamDomain is the durable
 * authority; invariant 45: the in-process holds no cached authority).
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
  ControlGuardVerdict,
  ControlRequestRecord,
} from '../control/index.js'
import {
  P6T4_ROOT,
  P6T4_SEEDS,
  createFakeToolPipeline,
  createP6T4Service,
  createP6T4World,
  destroyP6T1World,
  expectFirst,
  leaderCaller,
  makeScope,
  memberCaller,
  restartP6T1World,
} from './p6t4-helpers.js'
import type { FakeToolExecution } from './p6t4-helpers.js'

const WORKER_ID = String(P6T4_SEEDS.worker.instanceId)

// --- scenario 1: pending request + recorded decision survive the restart -----------
let s1: {
  readonly requestId: string
  readonly decisionSequence: number
  readonly correlation: string
  readonly recoveredRequest: ControlRequestRecord
  readonly recoveredDecision: ControlDecisionRecord
  readonly preRestartConsumptions: number
  readonly first: FakeToolExecution
  readonly second: FakeToolExecution
  readonly executed: number
  readonly postRestartConsumptions: number
  readonly consumption: ControlConsumptionRecord
}
{
  const world = await createP6T4World('p6t4-rs-1', ['leader', 'worker'])
  const scope = makeScope({ correlation: 'corr-p6t4-restart' })
  const service = createP6T4Service(world)
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
    note: 'survives the restart',
  })

  // UNIT RESTART: re-instantiate + re-open the repositories over the
  // same durable store.
  const restarted = await restartP6T1World(world)
  try {
    // A FRESH service over the reopened domain recovers the full state.
    const fresh = createP6T4Service(restarted)
    const state = await fresh.listControlState(P6T4_ROOT)

    // The unconsumed allow survives: it executes exactly once on the
    // fresh service, and the re-attempt is blocked.
    const pipeline = createFakeToolPipeline(fresh)
    const first = await pipeline.execute(scope)
    const second = await pipeline.execute(scope)
    const after = await fresh.listControlState(P6T4_ROOT)
    s1 = {
      requestId: request.requestId,
      decisionSequence: decision.decisionSequence,
      correlation: scope.correlation,
      recoveredRequest: expectFirst(state.requests, 'request'),
      recoveredDecision: expectFirst(state.decisions, 'decision'),
      preRestartConsumptions: state.consumptions.length,
      first,
      second,
      executed: pipeline.executed().length,
      postRestartConsumptions: after.consumptions.length,
      consumption: expectFirst(after.consumptions, 'consumption'),
    }
  } finally {
    await destroyP6T1World(restarted)
  }
}

// --- scenario 2: a pre-restart consumption survives ---------------------------------
let s2: {
  readonly verdict: FakeToolExecution
  readonly consumptions: number
  readonly executed: number
}
{
  const world = await createP6T4World('p6t4-rs-2', ['leader', 'worker'])
  const scope = makeScope({ correlation: 'corr-p6t4-restart-consumed' })
  const service = createP6T4Service(world)
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
  // Consume the allow BEFORE the restart.
  const pipeline = createFakeToolPipeline(service)
  await pipeline.execute(scope)

  const restarted = await restartP6T1World(world)
  try {
    const fresh = createP6T4Service(restarted)
    const pipeline = createFakeToolPipeline(fresh)
    const verdict = await pipeline.execute(scope)
    const state = await fresh.listControlState(P6T4_ROOT)
    s2 = {
      verdict,
      consumptions: state.consumptions.length,
      executed: pipeline.executed().length,
    }
  } finally {
    await destroyP6T1World(restarted)
  }
}

// --- scenario 3: a pending request across the restart -------------------------------
let s3: {
  readonly pendingVerdict: ControlGuardVerdict
  readonly allowed: FakeToolExecution
}
{
  const world = await createP6T4World('p6t4-rs-3', ['leader', 'worker'])
  const scope = makeScope({ correlation: 'corr-p6t4-restart-pending' })
  const service = createP6T4Service(world)
  const request = await service.requestControl({
    rootSessionId: P6T4_ROOT,
    caller: memberCaller(WORKER_ID),
    kind: CONTROL_REQUEST_KINDS.LEADER_APPROVAL,
    targetInstanceId: WORKER_ID,
    actionName: scope.actionName,
    toolName: scope.toolName,
    correlation: scope.correlation,
  })
  const requestId = request.requestId

  const restarted = await restartP6T1World(world)
  try {
    // The fresh service still sees the request as pending.
    const fresh = createP6T4Service(restarted)
    const pendingVerdict = await fresh.guardOperation(scope)
    // The decision is recorded AFTER the restart, on the fresh service.
    await fresh.resolveControl({
      rootSessionId: P6T4_ROOT,
      caller: leaderCaller(),
      requestId,
      decision: 'allow',
    })
    const pipeline = createFakeToolPipeline(fresh)
    const allowed = await pipeline.execute(scope)
    s3 = { pendingVerdict, allowed }
  } finally {
    await destroyP6T1World(restarted)
  }
}

describe('p6t4 restart (MUST-TEST: pending request + recorded decision recover)', () => {
  it('pending request + recorded decision survive the restart; the unconsumed allow is recovered and consumed exactly once', () => {
    expect(s1.recoveredRequest.requestId).toBe(s1.requestId)
    expect(s1.recoveredRequest.status).toBe('decided')
    expect(s1.recoveredRequest.correlation).toBe(s1.correlation)
    expect(s1.recoveredDecision.decision).toBe(CONTROL_DECISION_VALUES.ALLOW)
    expect(s1.recoveredDecision.requestId).toBe(s1.requestId)
    expect(s1.recoveredDecision.decisionSequence).toBe(s1.decisionSequence)
    expect(s1.recoveredDecision.note).toBe('survives the restart')
    expect(s1.preRestartConsumptions).toBe(0)
    expect(s1.first.allowed).toBe(true)
    expect(s1.first.requestId).toBe(s1.requestId)
    expect(s1.first.decisionSequence).toBe(s1.decisionSequence)
    expect(s1.second.allowed).toBe(false)
    expect(s1.second.reason).toBe(CONTROL_GUARD_BLOCK_REASONS.ALLOW_CONSUMED)
    expect(s1.executed).toBe(1)
    expect(s1.postRestartConsumptions).toBe(1)
    expect(s1.consumption.requestId).toBe(s1.requestId)
    expect(s1.consumption.decisionSequence).toBe(s1.decisionSequence)
  })

  it('a pre-restart consumption survives: the guard reports allow-consumed over the reopened domain', () => {
    expect(s2.verdict.allowed).toBe(false)
    expect(s2.verdict.reason).toBe(CONTROL_GUARD_BLOCK_REASONS.ALLOW_CONSUMED)
    expect(s2.consumptions).toBe(1)
    expect(s2.executed).toBe(0)
  })

  it('a pending request across the restart: the fresh service reports request-pending, then resolves and executes', () => {
    expect(s3.pendingVerdict.allowed).toBe(false)
    if (s3.pendingVerdict.allowed === false) {
      expect(s3.pendingVerdict.reason).toBe(
        CONTROL_GUARD_BLOCK_REASONS.REQUEST_PENDING,
      )
    }
    expect(s3.allowed.allowed).toBe(true)
    expect(typeof s3.allowed.decisionSequence).toBe('number')
    if (typeof s3.allowed.decisionSequence === 'number') {
      expect(s3.allowed.decisionSequence).toBeGreaterThan(0)
    }
  })
})
