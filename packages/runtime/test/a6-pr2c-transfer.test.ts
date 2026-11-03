/**
 * Alpha.6 PR2c — current-leg transfer and Human-successor visibility.
 *
 * The transfer is a ROUTING fact: one durable row, same per-team lock, no
 * approval capability, no second Assignment ledger. The former Officer keeps
 * every decision it already signed but loses future signing authority; the
 * Leader retains its native override. The event is a non-authority hint for
 * the notification plane.
 */
import { describe, expect, it } from 'vitest'
import {
  CONTROL_ERROR_CODES,
  CONTROL_REQUEST_KINDS,
  createControlService,
} from '../control/index.js'
import type { ControlRequestRecord, ControlReviewEvent } from '../control/index.js'
import { ReviewCapabilityCandidate } from '../review-authority/index.js'
import type { ReviewCapability } from '../review-authority/index.js'
import {
  P6T4_NOW,
  P6T4_ROOT,
  P6T4_SEEDS,
  assertControlCode,
  createP6T4World,
  destroyP6T1World,
  humanCaller,
  leaderCaller,
  memberCaller,
} from './p6t4-helpers.js'

const WORKER = String(P6T4_SEEDS.worker.instanceId)
const SCOPE = {
  rootSessionId: P6T4_ROOT,
  subject: { kind: 'instance', instanceId: WORKER },
  actionName: 'write-file',
  toolName: 'fs.write',
  correlation: 'corr-a6-pr2c',
  operationFingerprint: 'fp-a6-pr2c',
} as const

function candidateFor(
  leg: ControlRequestRecord,
  entry: 'allow' | 'deny' | 'escalate',
): ReviewCapabilityCandidate {
  const capability: ReviewCapability = {
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
    scopeFingerprint: 'scope-a6-pr2c',
    blueprintContentHash: 'hash-a6-pr2c',
    blueprintRevision: 'r1',
    authorityGeneration: 4,
    operationOwner: { rootSessionId: P6T4_ROOT, instanceId: WORKER, templateId: 'worker' },
    operationTool: { definitionIdentity: 'tool-def-write', owner: 'dsh.fs', name: 'write' },
  }
  return ReviewCapabilityCandidate.of(capability)
}

async function makeLeg(
  service: ReturnType<typeof createControlService>,
  correlation: string,
): Promise<ControlRequestRecord> {
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
      operationFingerprint: 'fp-a6-pr2c',
      authorityScope: { operationClass: 'fs.write', matcher: { kind: 'exact', resource: 'a6-pr2c:file' } },
      correlation,
    },
    actionName: 'write-file',
    toolName: 'fs.write',
    summary: 'a6-pr2c leg',
    reviewPayload: { schema: 'a6-pr2c-opaque', note: 'routing-only test leg' },
    paApprovalCaseId: 'tadm:root:worker:effects:g4',
    operationOwnerTemplateId: 'worker',
    operationToolDefinitionIdentity: 'tool-def-write',
    operationToolOwner: 'dsh.fs',
    operationToolName: 'write',
    authorityGeneration: 4,
    blueprintContentHash: 'hash-a6-pr2c',
    blueprintRevision: 'r1',
    perEffectRequiredAuthorities: ['leader'],
  })
  if (outcome.kind !== 'leg') throw new Error(`expected a leg, got ${outcome.kind}`)
  return outcome.leg
}

function serviceWith(
  world: Awaited<ReturnType<typeof createP6T4World>>,
  reviewer: { instanceId: string } | null,
  events: ControlReviewEvent[] = [],
) {
  return createControlService({
    teamDomain: world.domain,
    blueprintCatalog: world.catalog,
    externalPolicyFacts: world.ports.externalPolicyFacts,
    now: () => P6T4_NOW,
    currentReviewerForTransfer: async () => reviewer,
    reviewEvents: (event) => events.push(event),
  })
}

describe('A6-PR2c current-leg transfer', () => {
  it('the trusted Officer writes ONE durable routing fact and the former Officer loses future signing', async () => {
    const world = await createP6T4World('a6-pr2c-handoff', ['leader', 'worker'])
    try {
      const events: ControlReviewEvent[] = []
      const service = serviceWith(world, { instanceId: WORKER }, events)
      const leg = await makeLeg(service, 'corr-a6-pr2c-handoff')
      const transfer = await service.transferCurrentLeg({
        rootSessionId: P6T4_ROOT,
        caller: memberCaller(WORKER),
        requestId: leg.requestId,
        cause: 'officer-handoff',
        reason: 'busy with another case',
      })
      expect(transfer.target).toBe('leader')
      expect(transfer.currentLegRequestId).toBe(leg.requestId)
      expect(transfer.actor).toEqual({ kind: 'officer', instanceId: WORKER })
      const state = await service.listControlState(P6T4_ROOT)
      expect(state.transfers).toHaveLength(1)
      expect(events.filter((e) => e.kind === 'current-leg-transferred')).toHaveLength(1)

      // Idempotent retry: same fact, no second row, no second event.
      const again = await service.transferCurrentLeg({
        rootSessionId: P6T4_ROOT,
        caller: memberCaller(WORKER),
        requestId: leg.requestId,
        cause: 'officer-handoff',
      })
      expect(again).toEqual(transfer)
      expect((await service.listControlState(P6T4_ROOT)).transfers).toHaveLength(1)
      expect(events.filter((e) => e.kind === 'current-leg-transferred')).toHaveLength(1)

      // The former Officer cannot resolve the transferred leg...
      await expect(service.resolveControl({
        rootSessionId: P6T4_ROOT,
        caller: memberCaller(WORKER),
        requestId: leg.requestId,
        decision: 'allow',
        reviewCapability: candidateFor(leg, 'allow'),
      })).rejects.toSatisfy((error: unknown) => {
        assertControlCode(error, CONTROL_ERROR_CODES.CONTROL_RESOLVER_NOT_AUTHORIZED)
        return true
      })
      // ...but the Leader's native override still can.
      const decision = await service.resolveControl({
        rootSessionId: P6T4_ROOT,
        caller: leaderCaller(),
        requestId: leg.requestId,
        decision: 'allow',
      })
      expect(decision.decision).toBe('allow')
      expect(decision.decider.kind).toBe('instance')
    } finally {
      await destroyP6T1World(world)
    }
  })

  it('an untrusted member, a wrong reviewer, and a terminal leg are all refused with zero transfers', async () => {
    const world = await createP6T4World('a6-pr2c-refuse', ['leader', 'worker'])
    try {
      const service = serviceWith(world, { instanceId: 'inst-someone-else' })
      const leg = await makeLeg(service, 'corr-a6-pr2c-refuse')
      await expect(service.transferCurrentLeg({
        rootSessionId: P6T4_ROOT,
        caller: memberCaller(WORKER),
        requestId: leg.requestId,
        cause: 'officer-handoff',
      })).rejects.toSatisfy((error: unknown) => {
        assertControlCode(error, CONTROL_ERROR_CODES.CONTROL_RESOLVER_NOT_AUTHORIZED)
        return true
      })
      expect((await service.listControlState(P6T4_ROOT)).transfers).toHaveLength(0)

      // No reviewer port at all is a refusal, never "any member may transfer".
      const noPort = createControlService({
        teamDomain: world.domain,
        blueprintCatalog: world.catalog,
        externalPolicyFacts: world.ports.externalPolicyFacts,
        now: () => P6T4_NOW,
      })
      await expect(noPort.transferCurrentLeg({
        rootSessionId: P6T4_ROOT,
        caller: memberCaller(WORKER),
        requestId: leg.requestId,
        cause: 'officer-handoff',
      })).rejects.toSatisfy((error: unknown) => {
        assertControlCode(error, CONTROL_ERROR_CODES.CONTROL_RESOLVER_NOT_AUTHORIZED)
        return true
      })

      // A decided/abandoned leg is not a current leg to transfer.
      await noPort.resolveControl({
        rootSessionId: P6T4_ROOT,
        caller: leaderCaller(),
        requestId: leg.requestId,
        decision: 'allow',
      })
      await expect(noPort.transferCurrentLeg({
        rootSessionId: P6T4_ROOT,
        caller: memberCaller(WORKER),
        requestId: leg.requestId,
        cause: 'officer-handoff',
      })).rejects.toSatisfy((error: unknown) => {
        assertControlCode(error, CONTROL_ERROR_CODES.CONTROL_REQUEST_DECIDED)
        return true
      })
      expect((await noPort.listControlState(P6T4_ROOT)).transfers).toHaveLength(0)
    } finally {
      await destroyP6T1World(world)
    }
  })

  it('trusted runtime takeover uses the SAME fact, requires explicit evidence, and still blocks the Officer', async () => {
    const world = await createP6T4World('a6-pr2c-unavailable', ['leader', 'worker'])
    try {
      const events: ControlReviewEvent[] = []
      const service = createControlService({
        teamDomain: world.domain,
        blueprintCatalog: world.catalog,
        externalPolicyFacts: world.ports.externalPolicyFacts,
        now: () => P6T4_NOW,
        trustedRuntimeTakeover: async () => ({ ok: true }),
        reviewEvents: (event) => events.push(event),
      })
      const leg = await makeLeg(service, 'corr-a6-pr2c-unavailable')
      const transfer = await service.transferCurrentLeg({
        rootSessionId: P6T4_ROOT,
        requestId: leg.requestId,
        cause: 'officer-unavailable',
        actor: 'trusted-team-runtime',
      })
      expect(transfer.actor).toEqual({ kind: 'trusted-team-runtime' })
      expect(transfer.cause).toBe('officer-unavailable')
      expect((await service.listControlState(P6T4_ROOT)).transfers).toHaveLength(1)
      expect(events.filter((e) => e.kind === 'current-leg-transferred')).toHaveLength(1)

      await expect(service.resolveControl({
        rootSessionId: P6T4_ROOT,
        caller: memberCaller(WORKER),
        requestId: leg.requestId,
        decision: 'allow',
        reviewCapability: candidateFor(leg, 'allow'),
      })).rejects.toSatisfy((error: unknown) => {
        assertControlCode(error, CONTROL_ERROR_CODES.CONTROL_RESOLVER_NOT_AUTHORIZED)
        return true
      })
      // The takeover is routing only; the Leader still decides natively.
      const decision = await service.resolveControl({
        rootSessionId: P6T4_ROOT,
        caller: leaderCaller(),
        requestId: leg.requestId,
        decision: 'allow',
      })
      expect(decision.decision).toBe('allow')
    } finally {
      await destroyP6T1World(world)
    }
  })

  it('unavailable takeover without trusted evidence or with a refusal writes no fact', async () => {
    const world = await createP6T4World('a6-pr2c-unavailable-refuse', ['leader', 'worker'])
    try {
      const legService = serviceWith(world, { instanceId: WORKER })
      const leg = await makeLeg(legService, 'corr-a6-pr2c-unavailable-refuse')
      const noPort = createControlService({
        teamDomain: world.domain,
        blueprintCatalog: world.catalog,
        externalPolicyFacts: world.ports.externalPolicyFacts,
        now: () => P6T4_NOW,
      })
      await expect(noPort.transferCurrentLeg({
        rootSessionId: P6T4_ROOT,
        requestId: leg.requestId,
        cause: 'officer-unavailable',
        actor: 'trusted-team-runtime',
      })).rejects.toSatisfy((error: unknown) => {
        assertControlCode(error, CONTROL_ERROR_CODES.CONTROL_RESOLVER_NOT_AUTHORIZED)
        return true
      })
      const refusing = createControlService({
        teamDomain: world.domain,
        blueprintCatalog: world.catalog,
        externalPolicyFacts: world.ports.externalPolicyFacts,
        now: () => P6T4_NOW,
        trustedRuntimeTakeover: async () => ({ ok: false, detail: 'officer is busy, not unavailable' }),
      })
      await expect(refusing.transferCurrentLeg({
        rootSessionId: P6T4_ROOT,
        requestId: leg.requestId,
        cause: 'officer-unavailable',
        actor: 'trusted-team-runtime',
      })).rejects.toSatisfy((error: unknown) => {
        assertControlCode(error, CONTROL_ERROR_CODES.CONTROL_RESOLVER_NOT_AUTHORIZED)
        return true
      })
      expect((await noPort.listControlState(P6T4_ROOT)).transfers).toHaveLength(0)
    } finally {
      await destroyP6T1World(world)
    }
  })

  it('emits the Human-current-leg visibility event after an Officer escalation, without minting a transfer', async () => {
    const world = await createP6T4World('a6-pr2c-human-event', ['leader', 'worker'])
    try {
      const events: ControlReviewEvent[] = []
      const service = serviceWith(world, { instanceId: WORKER }, events)
      const leg = await makeLeg(service, 'corr-a6-pr2c-human-event')
      const escalation = await service.escalateApprovalLeg({
        rootSessionId: P6T4_ROOT,
        caller: memberCaller(WORKER),
        requestId: leg.requestId,
        reviewCapability: candidateFor(leg, 'escalate'),
        reason: 'human authority needed',
      })
      expect(escalation.nextLeg?.reviewAuthority).toBe('human-user')
      const humanEvents = events.filter((e) => e.kind === 'human-current-leg')
      expect(humanEvents).toHaveLength(1)
      expect(humanEvents[0]).toMatchObject({
        approvalCaseId: leg.approvalCaseId,
        currentLegRequestId: escalation.nextLeg?.requestId,
      })
      expect((await service.listControlState(P6T4_ROOT)).transfers).toHaveLength(0)

      // The Officer must not be able to approve the Human successor.
      const humanLeg = escalation.nextLeg
      if (humanLeg === undefined) throw new Error('expected a Human leg')
      await expect(service.resolveControl({
        rootSessionId: P6T4_ROOT,
        caller: memberCaller(WORKER),
        requestId: humanLeg.requestId,
        decision: 'allow',
        reviewCapability: candidateFor(humanLeg, 'allow'),
      })).rejects.toSatisfy((error: unknown) => {
        assertControlCode(error, CONTROL_ERROR_CODES.CONTROL_RESOLVER_NOT_AUTHORIZED)
        return true
      })
      // Human still can.
      const allowed = await service.resolveControl({
        rootSessionId: P6T4_ROOT,
        caller: humanCaller('human-a6-pr2c'),
        requestId: humanLeg.requestId,
        decision: 'allow',
      })
      expect(allowed.decision).toBe('allow')
    } finally {
      await destroyP6T1World(world)
    }
  })
})
