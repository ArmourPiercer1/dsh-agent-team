/**
 * Alpha.6 PR5 — restricted Officer access.
 *
 * The Officer sees only the CURRENT pending legs the trusted reviewer port
 * assigns to it; no full-team list, no legacy rows, no management surface.
 */
import { describe, expect, it } from 'vitest'
import { CONTROL_REQUEST_KINDS, createControlService } from '../control/index.js'
import type { ControlRequestRecord } from '../control/index.js'
import {
  P6T4_NOW,
  P6T4_ROOT,
  P6T4_SEEDS,
  createP6T4World,
  destroyP6T1World,
  humanCaller,
  leaderCaller,
  memberCaller,
} from './p6t4-helpers.js'

const WORKER = String(P6T4_SEEDS.worker.instanceId)

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
      operationFingerprint: 'fp-a6-pr5',
      authorityScope: { operationClass: 'fs.write', matcher: { kind: 'exact', resource: 'a6-pr5:file' } },
      correlation,
    },
    actionName: 'write-file',
    toolName: 'fs.write',
    summary: 'a6-pr5 leg',
    reviewPayload: { schema: 'a6-pr5-opaque', note: 'restricted view test leg' },
    paApprovalCaseId: 'tadm:root:worker:effects:g4',
    operationOwnerTemplateId: 'worker',
    operationToolDefinitionIdentity: 'tool-def-write',
    operationToolOwner: 'dsh.fs',
    operationToolName: 'write',
    authorityGeneration: 4,
    blueprintContentHash: 'hash-a6-pr5',
    blueprintRevision: 'r1',
    perEffectRequiredAuthorities: ['leader'],
  })
  if (outcome.kind !== 'leg') throw new Error(`expected a leg, got ${outcome.kind}`)
  return outcome.leg
}

describe('A6-PR5 restricted Officer access', () => {
  it('returns only the current legs assigned to this instance, with no legacy/team rows', async () => {
    const world = await createP6T4World('a6-pr5-access', ['leader', 'worker'])
    try {
      const service = createControlService({
        teamDomain: world.domain,
        blueprintCatalog: world.catalog,
        externalPolicyFacts: world.ports.externalPolicyFacts,
        now: () => P6T4_NOW,
        currentReviewerForTransfer: async () => ({ instanceId: WORKER }),
      })
      const leg = await makeLeg(service, 'corr-a6-pr5-access')
      const tasks = await service.listMyReviewTasks({
        rootSessionId: P6T4_ROOT,
        caller: memberCaller(WORKER),
      })
      expect(tasks).toHaveLength(1)
      expect(tasks[0]).toMatchObject({
        approvalCaseId: leg.approvalCaseId,
        currentLegRequestId: leg.requestId,
        legOrdinal: 1,
        reviewAuthority: 'leader',
        actionName: 'write-file',
        toolName: 'fs.write',
      })
      // The Leader is not shown another reviewer's task, and a Human caller
      // never gets an instance-scoped list.
      expect(await service.listMyReviewTasks({ rootSessionId: P6T4_ROOT, caller: leaderCaller() })).toHaveLength(0)
      expect(await service.listMyReviewTasks({ rootSessionId: P6T4_ROOT, caller: humanCaller() })).toHaveLength(0)
    } finally {
      await destroyP6T1World(world)
    }
  })

  it('drops an assigned task after transfer and never exposes another Officer\'s case', async () => {
    const world = await createP6T4World('a6-pr5-access-transfer', ['leader', 'worker'])
    try {
      const service = createControlService({
        teamDomain: world.domain,
        blueprintCatalog: world.catalog,
        externalPolicyFacts: world.ports.externalPolicyFacts,
        now: () => P6T4_NOW,
        currentReviewerForTransfer: async () => ({ instanceId: 'inst-someone-else' }),
      })
      const leg = await makeLeg(service, 'corr-a6-pr5-else')
      expect(await service.listMyReviewTasks({
        rootSessionId: P6T4_ROOT,
        caller: memberCaller(WORKER),
      })).toHaveLength(0)
      // The trusted port can move the task to this Officer; after an explicit
      // transfer to Leader, the task must disappear from the restricted view.
      const selfService = createControlService({
        teamDomain: world.domain,
        blueprintCatalog: world.catalog,
        externalPolicyFacts: world.ports.externalPolicyFacts,
        now: () => P6T4_NOW,
        currentReviewerForTransfer: async () => ({ instanceId: WORKER }),
      })
      expect(await selfService.listMyReviewTasks({
        rootSessionId: P6T4_ROOT,
        caller: memberCaller(WORKER),
      })).toHaveLength(1)
      await selfService.transferCurrentLeg({
        rootSessionId: P6T4_ROOT,
        caller: memberCaller(WORKER),
        requestId: leg.requestId,
        cause: 'officer-handoff',
      })
      expect(await selfService.listMyReviewTasks({
        rootSessionId: P6T4_ROOT,
        caller: memberCaller(WORKER),
      })).toHaveLength(0)
    } finally {
      await destroyP6T1World(world)
    }
  })

  it('an assigned Officer can allow its current leg and escalate to Human, while an unassigned Member cannot', async () => {
    const world = await createP6T4World('a6-pr5-assigned-actions', ['leader', 'worker'])
    try {
      const service = createControlService({
        teamDomain: world.domain,
        blueprintCatalog: world.catalog,
        externalPolicyFacts: world.ports.externalPolicyFacts,
        now: () => P6T4_NOW,
        currentReviewerForTransfer: async () => ({ instanceId: WORKER }),
      })
      const allowLeg = await makeLeg(service, 'corr-a6-pr5-allow')
      const allowed = await service.resolveControl({
        rootSessionId: P6T4_ROOT,
        caller: memberCaller(WORKER),
        requestId: allowLeg.requestId,
        decision: 'allow',
        assignedOfficer: true,
      })
      expect(allowed.decision).toBe('allow')

      const escalateLeg = await makeLeg(service, 'corr-a6-pr5-escalate')
      const risen = await service.escalateApprovalLeg({
        rootSessionId: P6T4_ROOT,
        caller: memberCaller(WORKER),
        requestId: escalateLeg.requestId,
        assignedOfficer: true,
      })
      expect(risen.nextLeg?.reviewAuthority).toBe('human-user')

      const deniedLeg = await makeLeg(service, 'corr-a6-pr5-unassigned')
      const otherService = createControlService({
        teamDomain: world.domain,
        blueprintCatalog: world.catalog,
        externalPolicyFacts: world.ports.externalPolicyFacts,
        now: () => P6T4_NOW,
        currentReviewerForTransfer: async () => ({ instanceId: 'inst-someone-else' }),
      })
      await expect(otherService.resolveControl({
        rootSessionId: P6T4_ROOT,
        caller: memberCaller(WORKER),
        requestId: deniedLeg.requestId,
        decision: 'allow',
        assignedOfficer: true,
      })).rejects.toThrow(/not the trusted current reviewer|not a resolver/)
    } finally {
      await destroyP6T1World(world)
    }
  })
})
