/**
 * P6-T4 MUST-TEST — "external deny": an external hard policy that denies
 * the operation's capability cell makes the allow IMPOSSIBLE — even a
 * human/leader allow fails closed (Architecture 25.4, invariant 34: the
 * human exceeds the TEAM autonomy boundary, never the external hard
 * policy). The failure is DURABLE: a `deny` decision with reason
 * `external-policy` is recorded FIRST (the request is closed), then
 * CONTROL_EXTERNAL_POLICY_DENIED is thrown.
 *
 * Cell semantics (fail closed, documented):
 * - the probed cell is `capabilityDomain` when present, else `tools` when
 *   the operation names a tool, else NO cell (an operation that names no
 *   capability is not probed — the Team-owned admission that gated the
 *   request is the whole check);
 * - an ABSENT cell = "no host restriction" (passes);
 * - a hard `deny` cell refuses;
 * - a hard allow-list must NAME the operation's tool (an operation with
 *   no named tool matches no item — refused);
 * - `capabilityExists: false` refuses (the capability does not exist for
 *   this team's host).
 *
 * The policy facts are probed LIVE at allow-resolution (the mutable port
 * below is mutated between calls; the same port reference survives a
 * restart). Deny decisions never probe.
 *
 * Test pattern of this repo (the plain-node shim's `it` is synchronous):
 * every async scenario runs at MODULE level (top-level await, the
 * p6t1/p6t2 pattern) and captures its results; the `it` bodies are pure
 * synchronous assertions over the captured values.
 */

import { describe, expect, it } from 'vitest'
import {
  CONTROL_DECISION_REASONS,
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
  mutableExternalPolicyFacts,
} from './p6t4-helpers.js'
import type { FakeToolExecution } from './p6t4-helpers.js'

const WORKER_ID = String(P6T4_SEEDS.worker.instanceId)

// --- scenario 1: hard-deny tools cell — even a human allow fails closed ------------
let s1: {
  readonly rejectedHuman: {
    readonly code: string
    readonly details?: Record<string, unknown>
  }
  readonly rejectedLeader: {
    readonly code: string
    readonly details?: Record<string, unknown>
  }
  readonly decision: ControlDecisionRecord
  readonly verdict: FakeToolExecution
  readonly executed: number
}
{
  const policy = mutableExternalPolicyFacts({
    hard: { tools: { kind: 'deny' } },
    capabilityExists: {},
  })
  const world = await createP6T4World('p6t4-ep-1', ['leader', 'worker'], {
    externalPolicyFacts: policy.facts,
  })
  try {
    const service = createP6T4Service(world)
    const pipeline = createFakeToolPipeline(service)
    const scope = makeScope({ correlation: 'corr-p6t4-ep-deny' })
    const request = await service.requestControl({
      rootSessionId: P6T4_ROOT,
      caller: memberCaller(WORKER_ID),
      kind: CONTROL_REQUEST_KINDS.LEADER_APPROVAL,
      targetInstanceId: WORKER_ID,
      actionName: scope.actionName,
      toolName: scope.toolName,
      correlation: scope.correlation,
    })

    // The human owner — the highest team authority — still cannot.
    const rejectedHuman = await expectControlRejection(
      () =>
        service.resolveControl({
          rootSessionId: P6T4_ROOT,
          caller: humanCaller(),
          requestId: request.requestId,
          decision: 'allow',
        }),
      CONTROL_ERROR_CODES.CONTROL_EXTERNAL_POLICY_DENIED,
    )

    // Durable: the deny row exists (reason external-policy), the request
    // is closed — a leader retry cannot overturn it.
    const state = await service.listControlState(P6T4_ROOT)
    const decision = expectFirst(state.decisions, 'decision')
    const rejectedLeader = await expectControlRejection(
      () =>
        service.resolveControl({
          rootSessionId: P6T4_ROOT,
          caller: leaderCaller(),
          requestId: request.requestId,
          decision: 'allow',
        }),
      CONTROL_ERROR_CODES.CONTROL_REQUEST_DECIDED,
    )

    // The guard blocks the scope; nothing ever executes.
    const verdict = await pipeline.execute(scope)
    s1 = {
      rejectedHuman: {
        code: rejectedHuman.code,
        details: rejectedHuman.details,
      },
      rejectedLeader: {
        code: rejectedLeader.code,
        details: rejectedLeader.details,
      },
      decision,
      verdict,
      executed: pipeline.executed().length,
    }
  } finally {
    await destroyP6T1World(world)
  }
}

// --- scenario 2: an allow-list that does not NAME the tool fails closed -------------
let s2: {
  readonly rejected: {
    readonly code: string
    readonly details?: Record<string, unknown>
  }
  readonly decision: ControlDecisionRecord
}
{
  const policy = mutableExternalPolicyFacts({
    hard: { tools: { kind: 'allow', items: ['fs.read'] } },
    capabilityExists: {},
  })
  const world = await createP6T4World('p6t4-ep-2', ['leader', 'worker'], {
    externalPolicyFacts: policy.facts,
  })
  try {
    const service = createP6T4Service(world)
    const scope = makeScope({ correlation: 'corr-p6t4-ep-unlisted' })
    const request = await service.requestControl({
      rootSessionId: P6T4_ROOT,
      caller: memberCaller(WORKER_ID),
      kind: CONTROL_REQUEST_KINDS.LEADER_APPROVAL,
      targetInstanceId: WORKER_ID,
      actionName: scope.actionName,
      toolName: scope.toolName,
      correlation: scope.correlation,
    })
    const rejected = await expectControlRejection(
      () =>
        service.resolveControl({
          rootSessionId: P6T4_ROOT,
          caller: humanCaller(),
          requestId: request.requestId,
          decision: 'allow',
        }),
      CONTROL_ERROR_CODES.CONTROL_EXTERNAL_POLICY_DENIED,
    )
    const state = await service.listControlState(P6T4_ROOT)
    s2 = {
      rejected: { code: rejected.code, details: rejected.details },
      decision: expectFirst(state.decisions, 'decision'),
    }
  } finally {
    await destroyP6T1World(world)
  }
}

// --- scenario 3: capabilityExists:false fails closed even when the list matches -----
let s3: {
  readonly rejected: {
    readonly code: string
    readonly details?: Record<string, unknown>
  }
}
{
  const policy = mutableExternalPolicyFacts({
    hard: { tools: { kind: 'allow', items: ['fs.write'] } },
    capabilityExists: { tools: false },
  })
  const world = await createP6T4World('p6t4-ep-3', ['leader', 'worker'], {
    externalPolicyFacts: policy.facts,
  })
  try {
    const service = createP6T4Service(world)
    const scope = makeScope({ correlation: 'corr-p6t4-ep-absent' })
    const request = await service.requestControl({
      rootSessionId: P6T4_ROOT,
      caller: memberCaller(WORKER_ID),
      kind: CONTROL_REQUEST_KINDS.LEADER_APPROVAL,
      targetInstanceId: WORKER_ID,
      actionName: scope.actionName,
      toolName: scope.toolName,
      correlation: scope.correlation,
    })
    const rejected = await expectControlRejection(
      () =>
        service.resolveControl({
          rootSessionId: P6T4_ROOT,
          caller: leaderCaller(),
          requestId: request.requestId,
          decision: 'allow',
        }),
      CONTROL_ERROR_CODES.CONTROL_EXTERNAL_POLICY_DENIED,
    )
    s3 = { rejected: { code: rejected.code, details: rejected.details } }
  } finally {
    await destroyP6T1World(world)
  }
}

// --- scenario 4: a matching allow-list lets the allow pass --------------------------
let s4: {
  readonly decision: ControlDecisionRecord
  readonly verdict: FakeToolExecution
  readonly executed: number
}
{
  const policy = mutableExternalPolicyFacts({
    hard: { tools: { kind: 'allow', items: ['fs.write'] } },
    capabilityExists: {},
  })
  const world = await createP6T4World('p6t4-ep-4', ['leader', 'worker'], {
    externalPolicyFacts: policy.facts,
  })
  try {
    const service = createP6T4Service(world)
    const pipeline = createFakeToolPipeline(service)
    const scope = makeScope({ correlation: 'corr-p6t4-ep-allowed' })
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
    })
    const verdict = await pipeline.execute(scope)
    s4 = { decision, verdict, executed: pipeline.executed().length }
  } finally {
    await destroyP6T1World(world)
  }
}

// --- scenario 5: an operation that names NO capability is not probed ----------------
let s5: {
  readonly decision: ControlDecisionRecord
  readonly verdict: FakeToolExecution
}
{
  const policy = mutableExternalPolicyFacts({
    hard: { tools: { kind: 'deny' } },
    capabilityExists: {},
  })
  const world = await createP6T4World('p6t4-ep-5', ['leader', 'worker'], {
    externalPolicyFacts: policy.facts,
  })
  try {
    const service = createP6T4Service(world)
    const scope = makeScope({
      toolName: undefined,
      actionName: 'run-step',
      correlation: 'corr-p6t4-ep-nocell',
    })
    const request = await service.requestControl({
      rootSessionId: P6T4_ROOT,
      caller: memberCaller(WORKER_ID),
      kind: CONTROL_REQUEST_KINDS.LEADER_APPROVAL,
      targetInstanceId: WORKER_ID,
      actionName: scope.actionName,
      correlation: scope.correlation,
    })
    // No tool named, no capability domain: the external hard policy
    // expresses no cell for this operation — the allow is possible.
    const decision = await service.resolveControl({
      rootSessionId: P6T4_ROOT,
      caller: leaderCaller(),
      requestId: request.requestId,
      decision: 'allow',
    })
    const pipeline = createFakeToolPipeline(service)
    const verdict = await pipeline.execute(scope)
    s5 = { decision, verdict }
  } finally {
    await destroyP6T1World(world)
  }
}

// --- scenario 6: an explicit capabilityDomain uses THAT cell (live re-probe) --------
let s6: {
  readonly rejectedSkillsDeny: {
    readonly code: string
    readonly details?: Record<string, unknown>
  }
  readonly newDecision: ControlDecisionRecord
  readonly newVerdict: FakeToolExecution
}
{
  const policy = mutableExternalPolicyFacts({
    hard: { skills: { kind: 'deny' } },
    capabilityExists: {},
  })
  const world = await createP6T4World('p6t4-ep-6', ['leader', 'worker'], {
    externalPolicyFacts: policy.facts,
  })
  try {
    const service = createP6T4Service(world)
    const skillsScope = makeScope({
      capabilityDomain: 'skills',
      actionName: 'use-skill',
      correlation: 'corr-p6t4-ep-skills-denied',
    })
    const request = await service.requestControl({
      rootSessionId: P6T4_ROOT,
      caller: memberCaller(WORKER_ID),
      kind: CONTROL_REQUEST_KINDS.LEADER_APPROVAL,
      targetInstanceId: WORKER_ID,
      actionName: skillsScope.actionName,
      toolName: skillsScope.toolName,
      capabilityDomain: skillsScope.capabilityDomain,
      correlation: skillsScope.correlation,
    })
    const rejectedSkillsDeny = await expectControlRejection(
      () =>
        service.resolveControl({
          rootSessionId: P6T4_ROOT,
          caller: leaderCaller(),
          requestId: request.requestId,
          decision: 'allow',
        }),
      CONTROL_ERROR_CODES.CONTROL_EXTERNAL_POLICY_DENIED,
    )

    // The policy is probed LIVE: once the skills cell is lifted (only a
    // tools deny remains), a NEW skills-domain request passes.
    policy.set({
      hard: { tools: { kind: 'deny' } },
      capabilityExists: {},
    })
    const newScope = makeScope({
      capabilityDomain: 'skills',
      actionName: 'use-skill',
      correlation: 'corr-p6t4-ep-skills-pass',
    })
    const fresh = await service.requestControl({
      rootSessionId: P6T4_ROOT,
      caller: memberCaller(WORKER_ID),
      kind: CONTROL_REQUEST_KINDS.LEADER_APPROVAL,
      targetInstanceId: WORKER_ID,
      actionName: newScope.actionName,
      toolName: newScope.toolName,
      capabilityDomain: newScope.capabilityDomain,
      correlation: newScope.correlation,
    })
    const newDecision = await service.resolveControl({
      rootSessionId: P6T4_ROOT,
      caller: leaderCaller(),
      requestId: fresh.requestId,
      decision: 'allow',
    })
    const pipeline = createFakeToolPipeline(service)
    const newVerdict = await pipeline.execute(newScope)
    s6 = {
      rejectedSkillsDeny: {
        code: rejectedSkillsDeny.code,
        details: rejectedSkillsDeny.details,
      },
      newDecision,
      newVerdict,
    }
  } finally {
    await destroyP6T1World(world)
  }
}

describe('p6t4 external hard policy (MUST-TEST: an external deny makes the allow impossible)', () => {
  it('a hard-deny tools cell blocks even a HUMAN allow (fail closed); the durable deny reason is external-policy and the request is closed', () => {
    expect(s1.rejectedHuman.code).toBe(
      CONTROL_ERROR_CODES.CONTROL_EXTERNAL_POLICY_DENIED,
    )
    expect(s1.decision.decision).toBe(CONTROL_DECISION_VALUES.DENY)
    expect(s1.decision.reason).toBe(CONTROL_DECISION_REASONS.EXTERNAL_POLICY)
    expect(s1.decision.decider).toEqual({
      kind: 'human',
      humanId: 'human-p6t4-owner',
    })
    // The first decision is authoritative: the leader retry is rejected.
    expect(s1.rejectedLeader.code).toBe(
      CONTROL_ERROR_CODES.CONTROL_REQUEST_DECIDED,
    )
    // The guard blocks the scope; nothing ever executes.
    expect(s1.verdict.allowed).toBe(false)
    expect(s1.verdict.reason).toBe(CONTROL_GUARD_BLOCK_REASONS.DECISION_DENY)
    expect(s1.executed).toBe(0)
  })

  it('an allow-list that does not NAME the tool fails closed (an unnamed tool matches no item)', () => {
    expect(s2.rejected.code).toBe(
      CONTROL_ERROR_CODES.CONTROL_EXTERNAL_POLICY_DENIED,
    )
    expect(s2.decision.decision).toBe(CONTROL_DECISION_VALUES.DENY)
    expect(s2.decision.reason).toBe(CONTROL_DECISION_REASONS.EXTERNAL_POLICY)
  })

  it('capabilityExists:false fails closed even with a matching allow-list', () => {
    expect(s3.rejected.code).toBe(
      CONTROL_ERROR_CODES.CONTROL_EXTERNAL_POLICY_DENIED,
    )
  })

  it('a matching allow-list lets the allow pass (absent capabilityExists = the capability is assumed present)', () => {
    expect(s4.decision.decision).toBe(CONTROL_DECISION_VALUES.ALLOW)
    expect(s4.decision.reason).toBe(undefined)
    expect(s4.verdict.allowed).toBe(true)
    expect(s4.executed).toBe(1)
  })

  it('an operation that names NO capability (no toolName, no capabilityDomain) is not probed: it passes despite a hard deny on tools (documented boundary)', () => {
    expect(s5.decision.decision).toBe(CONTROL_DECISION_VALUES.ALLOW)
    expect(s5.decision.reason).toBe(undefined)
    expect(s5.verdict.allowed).toBe(true)
  })

  it('an explicit capabilityDomain uses THAT cell: a skills hard-deny blocks a skills-domain request; a tools deny does not (live re-probe on the next request)', () => {
    expect(s6.rejectedSkillsDeny.code).toBe(
      CONTROL_ERROR_CODES.CONTROL_EXTERNAL_POLICY_DENIED,
    )
    expect(s6.rejectedSkillsDeny.details?.capabilityDomain).toBe('skills')
    expect(s6.newDecision.decision).toBe(CONTROL_DECISION_VALUES.ALLOW)
    expect(s6.newVerdict.allowed).toBe(true)
  })
})
