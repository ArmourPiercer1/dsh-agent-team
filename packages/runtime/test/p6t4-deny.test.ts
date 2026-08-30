/**
 * P6-T4 MUST-TEST — "deny": a durable deny blocks the scope forever. The
 * deny decision is recorded (durable, with the decider and the note), the
 * guard returns the `decision-deny` verdict (never an execution), and a
 * SECOND resolution attempt — by ANY principal — is rejected with
 * CONTROL_REQUEST_DECIDED: the first decision is authoritative (the
 * append-only ledger has no rewrite). A denied scope may be requested
 * AGAIN under a NEW correlation (a new request is a new question).
 *
 * Test pattern of this repo (the plain-node shim's `it` is synchronous):
 * every async scenario runs at MODULE level (top-level await) and captures
 * its results; the `it` bodies are pure synchronous assertions.
 */

import { describe, expect, it } from 'vitest'
import {
  CONTROL_DECISION_VALUES,
  CONTROL_ERROR_CODES,
  CONTROL_GUARD_BLOCK_REASONS,
  CONTROL_REQUEST_KINDS,
} from '../control/index.js'
import type { ControlDecisionRecord } from '../control/index.js'
import {
  P6T4_ROOT,
  P6T4_SEEDS,
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
} from './p6t4-helpers.js'
import type { FakeToolExecution } from './p6t4-helpers.js'

const WORKER_ID = String(P6T4_SEEDS.worker.instanceId)
const LEADER_ID = String(P6T4_SEEDS.leader.instanceId)

// --- scenario 1: deny → blocked, zero executions ------------------------------------
let s1: {
  readonly requestId: string
  readonly verdict: FakeToolExecution
  readonly executed: number
  readonly decisions: readonly ControlDecisionRecord[]
  readonly consumptions: number
}
{
  const world = await createP6T4World('p6t4-dn-1', ['leader', 'worker'])
  try {
    const service = createP6T4Service(world)
    const pipeline = createFakeToolPipeline(service)
    const scope = makeScope({ correlation: 'corr-p6t4-dn-1' })

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
      decision: 'deny',
      note: 'not on this target',
    })
    const verdict = await pipeline.execute(scope)
    const state = await service.listControlState(P6T4_ROOT)
    s1 = {
      requestId: request.requestId,
      verdict,
      executed: pipeline.executed().length,
      decisions: state.decisions,
      consumptions: state.consumptions.length,
    }
  } finally {
    await destroyP6T1World(world)
  }
}

// --- scenario 2: second resolution is rejected; the first decision is authoritative --
let s2: {
  readonly rejectedSecond: {
    readonly code: string
    readonly details?: Record<string, unknown>
  }
  readonly decisions: readonly ControlDecisionRecord[]
  readonly verdict: FakeToolExecution
}
{
  const world = await createP6T4World('p6t4-dn-2', ['leader', 'worker'])
  try {
    const service = createP6T4Service(world)
    const pipeline = createFakeToolPipeline(service)
    const scope = makeScope({ correlation: 'corr-p6t4-dn-2' })

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
      decision: 'deny',
    })
    // The human owner attempts to overturn the deny — rejected.
    const rejectedSecond = await expectControlRejection(
      () =>
        service.resolveControl({
          rootSessionId: P6T4_ROOT,
          caller: humanCaller(),
          requestId: request.requestId,
          decision: 'allow',
        }),
      CONTROL_ERROR_CODES.CONTROL_REQUEST_DECIDED,
    )
    const verdict = await pipeline.execute(scope)
    const state = await service.listControlState(P6T4_ROOT)
    s2 = {
      rejectedSecond: { code: rejectedSecond.code, details: rejectedSecond.details },
      decisions: state.decisions,
      verdict,
    }
  } finally {
    await destroyP6T1World(world)
  }
}

// --- scenario 3: a denied scope is re-requestable under a NEW correlation -----------
let s3: {
  readonly decisions: readonly ControlDecisionRecord[]
  readonly verdictNew: FakeToolExecution
  readonly executed: number
}
{
  const world = await createP6T4World('p6t4-dn-3', ['leader', 'worker'])
  try {
    const service = createP6T4Service(world)
    const pipeline = createFakeToolPipeline(service)

    const scopeDenied = makeScope({ correlation: 'corr-p6t4-dn-3a' })
    const requestDenied = await service.requestControl({
      rootSessionId: P6T4_ROOT,
      caller: memberCaller(WORKER_ID),
      kind: CONTROL_REQUEST_KINDS.LEADER_APPROVAL,
      targetInstanceId: WORKER_ID,
      actionName: scopeDenied.actionName,
      toolName: scopeDenied.toolName,
      correlation: scopeDenied.correlation,
    })
    await service.resolveControl({
      rootSessionId: P6T4_ROOT,
      caller: leaderCaller(),
      requestId: requestDenied.requestId,
      decision: 'deny',
    })

    // A NEW correlation is a NEW request about the same operation.
    const scopeNew = makeScope({ correlation: 'corr-p6t4-dn-3b' })
    const requestNew = await service.requestControl({
      rootSessionId: P6T4_ROOT,
      caller: memberCaller(WORKER_ID),
      kind: CONTROL_REQUEST_KINDS.LEADER_APPROVAL,
      targetInstanceId: WORKER_ID,
      actionName: scopeNew.actionName,
      toolName: scopeNew.toolName,
      correlation: scopeNew.correlation,
    })
    await service.resolveControl({
      rootSessionId: P6T4_ROOT,
      caller: leaderCaller(),
      requestId: requestNew.requestId,
      decision: 'allow',
    })
    const verdictNew = await pipeline.execute(scopeNew)
    const state = await service.listControlState(P6T4_ROOT)
    s3 = {
      decisions: state.decisions,
      verdictNew,
      executed: pipeline.executed().length,
    }
  } finally {
    await destroyP6T1World(world)
  }
}

describe('p6t4 deny (MUST-TEST: a durable deny blocks, and it is final)', () => {
  it('a deny blocks the scope with the decision-deny verdict; nothing executes; the durable row carries the decider and the note', () => {
    expect(s1.verdict.allowed).toBe(false)
    expect(s1.verdict.reason).toBe(CONTROL_GUARD_BLOCK_REASONS.DECISION_DENY)
    expect(s1.verdict.requestId).toBe(s1.requestId)
    expect(s1.executed).toBe(0)
    expect(s1.decisions.length).toBe(1)
    const decision = expectFirst(s1.decisions, 'decision')
    expect(decision.decision).toBe(CONTROL_DECISION_VALUES.DENY)
    expect(decision.decider).toEqual({
      kind: 'instance',
      instanceId: LEADER_ID,
      role: 'leader',
    })
    expect(decision.note).toBe('not on this target')
    expect(decision.reason).toBe(undefined)
    expect(s1.consumptions).toBe(0)
  })

  it('a second resolution is rejected (CONTROL_REQUEST_DECIDED): the first decision is authoritative, even against the human', () => {
    expect(s2.rejectedSecond.code).toBe(CONTROL_ERROR_CODES.CONTROL_REQUEST_DECIDED)
    expect(s2.decisions.length).toBe(1)
    const decision = expectFirst(s2.decisions, 'decision')
    expect(decision.decision).toBe(CONTROL_DECISION_VALUES.DENY)
    // The scope is still blocked by the original deny.
    expect(s2.verdict.allowed).toBe(false)
    expect(s2.verdict.reason).toBe(CONTROL_GUARD_BLOCK_REASONS.DECISION_DENY)
  })

  it('a denied scope is re-requestable under a NEW correlation (a new request is a new question); decisions sort by durable sequence', () => {
    expect(s3.decisions.length).toBe(2)
    const ordered = [...s3.decisions].sort(
      (a, b) => a.decisionSequence - b.decisionSequence,
    )
    expect(ordered[0]?.decision).toBe(CONTROL_DECISION_VALUES.DENY)
    expect(ordered[1]?.decision).toBe(CONTROL_DECISION_VALUES.ALLOW)
    expect(s3.verdictNew.allowed).toBe(true)
    expect(s3.executed).toBe(1)
  })
})
