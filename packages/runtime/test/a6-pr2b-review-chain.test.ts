/**
 * Alpha.6 PR2b — the Control-side delegated chain.
 *
 * This suite proves the durable leg/decision mechanics that the PA bridge will
 * use: a Member candidate binds the exact case/leg/scope and the global
 * resolver table is untouched; an Officer escalation creates a Human successor
 * carrying the same frozen identity and PA manifest metadata; the case-aware
 * wait follows that successor to its final allow/deny.
 */
import { describe, expect, it } from 'vitest'
import {
  CONTROL_ERROR_CODES,
  CONTROL_REQUEST_KINDS,
} from '../control/index.js'
import type { ControlRequestRecord } from '../control/index.js'
import { ReviewCapabilityCandidate } from '../review-authority/index.js'
import type { ReviewCapability } from '../review-authority/index.js'
import {
  P6T4_ROOT,
  P6T4_SEEDS,
  assertControlCode,
  createP6T4Service,
  createP6T4World,
  destroyP6T1World,
  humanCaller,
  memberCaller,
  writeRawControlFact,
} from './p6t4-helpers.js'

const WORKER = String(P6T4_SEEDS.worker.instanceId)
const SCOPE = {
  rootSessionId: P6T4_ROOT,
  subject: { kind: 'instance', instanceId: WORKER },
  actionName: 'write-file',
  toolName: 'fs.write',
  correlation: 'corr-a6-pr2b',
  operationFingerprint: 'fp-a6-pr2b',
} as const

function candidateFor(
  leg: ControlRequestRecord,
  entry: 'allow' | 'deny' | 'escalate',
  overrides: Partial<ReviewCapability> = {},
): ReviewCapabilityCandidate {
  return ReviewCapabilityCandidate.of({
    principal: { kind: 'instance', instanceId: WORKER, role: 'member' },
    source: 'blueprint-officer',
    entry,
    effectiveReviewAuthority: 'leader',
    approvalCaseId: String(leg.approvalCaseId),
    currentLegRequestId: leg.requestId,
    legOrdinal: Number(leg.legOrdinal),
    scope: {
      ...SCOPE,
      correlation: leg.correlation,
      operationFingerprint: leg.operationFingerprint ?? SCOPE.operationFingerprint,
    },
    scopeFingerprint: 'scope-a6-pr2b',
    blueprintContentHash: 'hash-a6-pr2b',
    blueprintRevision: 'r1',
    authorityGeneration: 4,
    operationOwner: { rootSessionId: P6T4_ROOT, instanceId: WORKER, templateId: 'worker' },
    operationTool: { definitionIdentity: 'tool-def-write', owner: 'dsh.fs', name: 'write' },
    ...overrides,
  })
}

async function makeLeg(service: ReturnType<typeof createP6T4Service>, correlation: string): Promise<ControlRequestRecord> {
  const outcome = await service.requestApprovalLeg({
    rootSessionId: P6T4_ROOT,
    caller: memberCaller(WORKER),
    kind: CONTROL_REQUEST_KINDS.LEADER_APPROVAL,
    reviewAuthority: 'leader',
    requiredAuthorityAtCreation: 'leader',
    identity: {
      subject: { kind: 'instance', instanceId: WORKER },
      beneficiaryAuthority: 'member',
      requestedEffect: 'ask',
      operationFingerprint: 'fp-a6-pr2b',
      authorityScope: { operationClass: 'fs.write', matcher: { kind: 'exact', resource: 'a6-pr2b:file' } },
      correlation,
    },
    actionName: 'write-file',
    toolName: 'fs.write',
    summary: 'a6-pr2b leg',
    reviewPayload: { schema: 'a6-pr2b-opaque', note: 'strict PA manifest placeholder' },
    paApprovalCaseId: 'tadm:root:worker:effects:g4',
    operationOwnerTemplateId: 'worker',
    operationToolDefinitionIdentity: 'tool-def-write',
    operationToolOwner: 'dsh.fs',
    operationToolName: 'write',
    authorityGeneration: 4,
    blueprintContentHash: 'hash-a6-pr2b',
    blueprintRevision: 'r1',
    perEffectRequiredAuthorities: ['leader'],
  })
  if (outcome.kind !== 'leg') throw new Error(`expected a leg, got ${outcome.kind}`)
  return outcome.leg
}

describe('A6-PR2b durable delegated chain', () => {
  it('binds a Member candidate to the exact leg; no candidate and a foreign case are refused', async () => {
    const world = await createP6T4World('a6-pr2b-gate', ['leader', 'worker'])
    try {
      const service = createP6T4Service(world)
      const leg = await makeLeg(service, 'corr-a6-pr2b-gate')
      expect(leg.paApprovalCaseId).toBe('tadm:root:worker:effects:g4')
      expect(leg.operationOwnerTemplateId).toBe('worker')
      expect(leg.operationToolDefinitionIdentity).toBe('tool-def-write')

      await expect(service.resolveControl({
        rootSessionId: P6T4_ROOT, caller: memberCaller(WORKER), requestId: leg.requestId, decision: 'allow',
      })).rejects.toSatisfy((error: unknown) => {
        assertControlCode(error, CONTROL_ERROR_CODES.CONTROL_RESOLVER_NOT_AUTHORIZED)
        return true
      })

      const foreign = candidateFor(leg, 'allow', { approvalCaseId: 'case-foreign' })
      await expect(service.resolveControl({
        rootSessionId: P6T4_ROOT, caller: memberCaller(WORKER), requestId: leg.requestId, decision: 'allow', reviewCapability: foreign,
      })).rejects.toSatisfy((error: unknown) => {
        assertControlCode(error, CONTROL_ERROR_CODES.CONTROL_RESOLVER_NOT_AUTHORIZED)
        return true
      })

      const decision = await service.resolveControl({
        rootSessionId: P6T4_ROOT,
        caller: memberCaller(WORKER),
        requestId: leg.requestId,
        decision: 'allow',
        reviewCapability: candidateFor(leg, 'allow'),
      })
      expect(decision.decision).toBe('allow')
      expect(decision.decider).toEqual({ kind: 'instance', instanceId: WORKER, role: 'member' })
      expect(decision.reviewCapability).toMatchObject({
        source: 'blueprint-officer', entry: 'allow', effectiveReviewAuthority: 'leader',
        operationOwnerTemplateId: 'worker', operationToolDefinitionIdentity: 'tool-def-write',
      })
    } finally {
      await destroyP6T1World(world)
    }
  })

  it('malformed capability evidence is OMITTED from the decision row, never dropping the durable decision', async () => {
    const world = await createP6T4World('a6-pr2b-bad-evidence', ['leader', 'worker'])
    try {
      const service = createP6T4Service(world)
      const leg = await makeLeg(service, 'corr-a6-pr2b-bad-evidence')
      await writeRawControlFact(world, 'control-decision-recorded', {
        requestId: leg.requestId,
        decision: 'allow',
        decider: { kind: 'instance', instanceId: WORKER, role: 'member' },
        scope: {
          rootSessionId: P6T4_ROOT,
          subject: { kind: 'instance', instanceId: WORKER },
          targetInstanceId: WORKER,
          actionName: 'write-file',
          toolName: 'fs.write',
          correlation: 'corr-a6-pr2b-bad-evidence',
          operationFingerprint: 'fp-a6-pr2b',
          authorityScope: { operationClass: 'fs.write', matcher: { kind: 'exact', resource: 'a6-pr2b:file' } },
        },
        requestSequence: leg.requestSequence,
        reviewCapability: { source: 'not-a-source', entry: 'allow' },
      })
      const st = await service.listControlState(P6T4_ROOT)
      const decision = st.decisions.find((d) => d.requestId === leg.requestId)
      expect(decision).toBeDefined()
      expect(decision?.decision).toBe('allow')
      expect(decision?.reviewCapability).toBeUndefined()
      expect(st.requests.find((r) => r.requestId === leg.requestId)?.status).toBe('decided')
    } finally {
      await destroyP6T1World(world)
    }
  })

  it('Officer escalation creates a Human successor with the same identity/manifest and the case wait returns the final Human allow', async () => {
    const world = await createP6T4World('a6-pr2b-chain', ['leader', 'worker'])
    try {
      const service = createP6T4Service(world)
      const leg = await makeLeg(service, 'corr-a6-pr2b-chain')
      const pending = service.awaitApprovalCaseDecision({
        rootSessionId: P6T4_ROOT,
        approvalCaseId: String(leg.approvalCaseId),
      })
      await new Promise((resolve) => setTimeout(resolve, 10))
      const escalation = await service.escalateApprovalLeg({
        rootSessionId: P6T4_ROOT,
        caller: memberCaller(WORKER),
        requestId: leg.requestId,
        reviewCapability: candidateFor(leg, 'escalate'),
        reason: 'needs Human authority',
      })
      expect(escalation.caseOutcome).toBe('escalated')
      expect(escalation.terminalDecision.reviewCapability).toMatchObject({
        source: 'blueprint-officer', entry: 'escalate', effectiveReviewAuthority: 'leader',
      })
      const successor = escalation.nextLeg
      expect(successor).toBeDefined()
      if (successor === undefined) return
      expect(successor.reviewAuthority).toBe('human-user')
      expect(successor.paApprovalCaseId).toBe(leg.paApprovalCaseId)
      expect(successor.reviewPayloadDigest).toBe(leg.reviewPayloadDigest)
      expect(successor.operationOwnerTemplateId).toBe('worker')
      await service.resolveControl({
        rootSessionId: P6T4_ROOT,
        caller: humanCaller('human-a6-pr2b'),
        requestId: successor.requestId,
        decision: 'allow',
      })
      const final = await pending
      expect(final.requestId).toBe(successor.requestId)
      expect(final.decision).toBe('allow')
      expect(final.decider).toEqual({ kind: 'human', humanId: 'human-a6-pr2b' })
    } finally {
      await destroyP6T1World(world)
    }
  })

  it('Human deny ends the case wait; an Officer cannot decide the Human successor', async () => {
    const world = await createP6T4World('a6-pr2b-deny', ['leader', 'worker'])
    try {
      const service = createP6T4Service(world)
      const leg = await makeLeg(service, 'corr-a6-pr2b-deny')
      const pending = service.awaitApprovalCaseDecision({
        rootSessionId: P6T4_ROOT,
        approvalCaseId: String(leg.approvalCaseId),
      })
      await new Promise((resolve) => setTimeout(resolve, 10))
      const escalation = await service.escalateApprovalLeg({
        rootSessionId: P6T4_ROOT,
        caller: memberCaller(WORKER),
        requestId: leg.requestId,
        reviewCapability: candidateFor(leg, 'escalate'),
      })
      const successor = escalation.nextLeg
      if (successor === undefined) throw new Error('expected a Human successor')
      await expect(service.resolveControl({
        rootSessionId: P6T4_ROOT,
        caller: memberCaller(WORKER),
        requestId: successor.requestId,
        decision: 'allow',
        reviewCapability: candidateFor(successor, 'allow'),
      })).rejects.toSatisfy((error: unknown) => {
        assertControlCode(error, CONTROL_ERROR_CODES.CONTROL_RESOLVER_NOT_AUTHORIZED)
        return true
      })
      await service.resolveControl({
        rootSessionId: P6T4_ROOT,
        caller: humanCaller('human-a6-pr2b-deny'),
        requestId: successor.requestId,
        decision: 'deny',
      })
      const final = await pending
      expect(final.requestId).toBe(successor.requestId)
      expect(final.decision).toBe('deny')
    } finally {
      await destroyP6T1World(world)
    }
  })
})
