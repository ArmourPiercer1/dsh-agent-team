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
  controlFacts,
  createFakeToolPipeline,
  createP6T4Service,
  constantAuthorityRecheck,
  createP6T4World,
  destroyP6T1World,
  expectFirst,
  humanCaller,
  leaderCaller,
  makeScope,
  memberCaller,
  restartP6T1World,
} from './p6t4-helpers.js'
import type { FakeToolExecution } from './p6t4-helpers.js'

const WORKER_ID = String(P6T4_SEEDS.worker.instanceId)

/**
 * The authority point A4-PR7 Task 7.0 requires on every operation case (ADR
 * A1-14). This file's subject is what SURVIVES a restart, so the point is a
 * constant and the fresh ceiling the guard re-runs over it is pinned constant
 * (`constantAuthorityRecheck`) — the authority law itself is
 * `a4p7-a1-14-consumption-revalidation.test.ts`. What this file DOES pin about
 * the point is that it is durable: a service constructed over a re-opened store
 * must re-read the same point and still consume the allow it re-read.
 */
const AUTHORITY_SCOPE = {
  operationClass: 'fs.write',
  matcher: { kind: 'exact', resource: 'p6t4-fixture:fileA' },
} as const

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

// --- scenario 4: an approval CASE chain reconstructs across the restart (A4-PR3) -----
//
// The case is a DERIVED view (ADR A1-17): everything a fresh service reports
// about it must come out of the leg rows, the terminal decision rows and the
// escalation facts — never out of anything the previous instance held. So the
// restart is asserted at the CASE surface: the ordinal chain, the escalation,
// the `reviewedBy` principals, the case-level (not leg-level) pending list, the
// refusal of the closed leg, and exactly-once consumption of the risen leg's
// allow AFTER a second restart.
let s4: {
  readonly approvalCaseId: string
  readonly ordinalsAfterRestart: readonly (number | undefined)[]
  readonly escalationCount: number
  readonly reviewedByCount: number
  readonly currentLegOrdinal: number | undefined
  readonly statusAfterRestart: string
  readonly openCaseCount: number
  readonly retriedLegOrdinal: number | undefined
  readonly closedLegResolveCode: string
  readonly guardReasonAfterRestart: string
  readonly allowFirst: boolean
  readonly allowSecondReason: string
  readonly guardAfterSecondRestart: string
  readonly consumptionCount: number
}
{
  const world = await createP6T4World('p6t4-rst-4', ['leader', 'worker'])
  const scope = makeScope({
    correlation: 'corr-p6t4-rst-4',
    operationFingerprint: 'fp-p6t4-rst-4',
    authorityScope: AUTHORITY_SCOPE,
  })
  // The recheck port is re-created for the restarted service (the restart model
  // builds a WHOLE new unit): the port is a wiring fact of the composition, not
  // durable state, and the point it is asked about IS durable — that asymmetry
  // is part of what the scenario shows.
  const recheck = constantAuthorityRecheck()
  try {
    const service = createP6T4Service(world, { authorityRevalidation: recheck.port })
    const created = await service.requestApprovalLeg({
      rootSessionId: P6T4_ROOT,
      caller: memberCaller(WORKER_ID),
      kind: CONTROL_REQUEST_KINDS.LEADER_APPROVAL,
      reviewAuthority: 'leader',
      requiredAuthorityAtCreation: 'leader',
      identity: {
        subject: { kind: 'instance', instanceId: WORKER_ID },
        beneficiaryAuthority: 'member',
        requestedEffect: 'ask',
        operationFingerprint: 'fp-p6t4-rst-4',
        authorityScope: AUTHORITY_SCOPE,
        correlation: scope.correlation,
      },
      actionName: scope.actionName,
      toolName: scope.toolName,
    })
    if (created.kind !== 'leg') throw new Error('the case needs a first leg')
    const approvalCaseId = created.leg.approvalCaseId ?? 'missing'
    const escalated = await service.escalateApprovalLeg({
      rootSessionId: P6T4_ROOT,
      caller: leaderCaller(),
      requestId: created.leg.requestId,
      reason: 'the leader recuses',
    })
    const nextRequestId = escalated.nextLeg?.requestId ?? 'missing'
    const restarted = await restartP6T1World(world)
    let captured: Omit<typeof s4, never>
    try {
      const fresh = createP6T4Service(restarted, { authorityRevalidation: recheck.port })
      const read = await fresh.readApprovalCaseState({ rootSessionId: P6T4_ROOT, approvalCaseId })
      if (read.kind !== 'case') throw new Error(`the case must survive the restart, got ${read.kind}`)
      const openCases = await fresh.listOpenApprovalCases({ rootSessionId: P6T4_ROOT })
      const retried = await fresh.requestApprovalLeg({
        rootSessionId: P6T4_ROOT,
        caller: memberCaller(WORKER_ID),
        kind: CONTROL_REQUEST_KINDS.LEADER_APPROVAL,
        reviewAuthority: 'leader',
        requiredAuthorityAtCreation: 'leader',
        identity: {
          subject: { kind: 'instance', instanceId: WORKER_ID },
          beneficiaryAuthority: 'member',
          requestedEffect: 'ask',
          operationFingerprint: 'fp-p6t4-rst-4',
          authorityScope: AUTHORITY_SCOPE,
          correlation: scope.correlation,
        },
        actionName: scope.actionName,
        toolName: scope.toolName,
      })
      let closedLegResolveCode = 'did-not-throw'
      try {
        await fresh.resolveControl({
          rootSessionId: P6T4_ROOT,
          caller: humanCaller(),
          requestId: created.leg.requestId,
          decision: CONTROL_DECISION_VALUES.ALLOW,
        })
      } catch (error) {
        closedLegResolveCode =
          typeof error === 'object' && error !== null && 'code' in error
            ? String((error as { code: unknown }).code)
            : 'unknown-error'
      }
      const guardAfterRestart = await fresh.guardOperation(scope)
      await fresh.resolveControl({
        rootSessionId: P6T4_ROOT,
        caller: humanCaller(),
        requestId: nextRequestId,
        decision: CONTROL_DECISION_VALUES.ALLOW,
      })
      const firstAllow = await fresh.guardOperation(scope)
      const secondAllow = await fresh.guardOperation(scope)
      const secondRestart = await restartP6T1World(restarted)
      let guardAfterSecondRestart = 'unsettled'
      let consumptionCount = -1
      try {
        const again = createP6T4Service(secondRestart)
        const guard = await again.guardOperation(scope)
        guardAfterSecondRestart =
          guard.allowed === true ? 'ALLOWED-AGAIN' : guard.reason
        consumptionCount = controlFacts(secondRestart, 'control-allow-consumed').length
      } finally {
        await destroyP6T1World(secondRestart)
      }
      captured = {
        approvalCaseId,
        ordinalsAfterRestart: read.state.legs.map((leg) => leg.legOrdinal),
        escalationCount: read.state.escalations.length,
        reviewedByCount: read.state.reviewedBy.length,
        currentLegOrdinal: read.state.currentLeg?.legOrdinal,
        statusAfterRestart: read.state.status,
        openCaseCount: openCases.length,
        retriedLegOrdinal: retried.kind === 'leg' ? retried.leg.legOrdinal : undefined,
        closedLegResolveCode,
        guardReasonAfterRestart:
          guardAfterRestart.allowed === true ? 'ALLOWED' : guardAfterRestart.reason,
        allowFirst: firstAllow.allowed,
        allowSecondReason: secondAllow.allowed === true ? 'ALLOWED-AGAIN' : secondAllow.reason,
        guardAfterSecondRestart,
        consumptionCount,
      }
    } finally {
      await destroyP6T1World(restarted)
    }
    s4 = captured
  } finally {
    /* the restarted worlds own the store; each destroyed above */
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

  it('an approval case reconstructs across TWO restarts: the chain, the escalation, the reviewedBy set and exactly one consumption (A4-PR3)', () => {
    expect(s4.ordinalsAfterRestart).toEqual([1, 2])
    expect(s4.escalationCount).toBe(1)
    expect(s4.reviewedByCount).toBe(1)
    expect(s4.currentLegOrdinal).toBe(2)
    expect(s4.statusAfterRestart).toBe('open')
    // A1-11: the pending list is per CASE, not per leg.
    expect(s4.openCaseCount).toBe(1)
    // The retry after the restart returns the CURRENT leg — never a third row.
    expect(s4.retriedLegOrdinal).toBe(2)
    // The escalated-away leg is terminal: a fresh service refuses to decide it.
    expect(s4.closedLegResolveCode).toBe('CONTROL_REQUEST_DECIDED')
    expect(s4.guardReasonAfterRestart).toBe(CONTROL_GUARD_BLOCK_REASONS.REQUEST_PENDING)
    expect(s4.allowFirst).toBe(true)
    expect(s4.allowSecondReason).toBe(CONTROL_GUARD_BLOCK_REASONS.ALLOW_CONSUMED)
    expect(s4.guardAfterSecondRestart).toBe(CONTROL_GUARD_BLOCK_REASONS.ALLOW_CONSUMED)
    expect(s4.consumptionCount).toBe(1)
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
