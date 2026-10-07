/**
 * a4p5-self-mutation.test.ts — A4-PR5 lane C: mutations that target the
 * LEADER's own overlay, batch all-or-nothing, and the revoke-that-reveals.
 *
 * Laws pinned:
 *
 *  1. The BENEFICIARY of a self-mutation is derived from the TARGET IDENTITY,
 *     never from the ceiling context's label. The production ceiling reader
 *     answers `beneficiaryAuthority: 'member'` for every target (reported);
 *     trusting it would route a Leader self-expansion into a case the Leader
 *     itself reviews — a self-approval rung the ladder forbids (the walk
 *     starts ONE RUNG ABOVE the beneficiary: `leader` beneficiary ⇒ the ask
 *     can only rest at `human-user` or above).
 *  2. A Leader SELF-TIGHTENING needs no authority (no rise -> the ceiling
 *     gate is never reached) and commits directly even at a v3 team.
 *  3. A revoke that reveals a lower allow IS a rise (design v2 effective
 *     semantics) and goes through the proposal like any other expansion —
 *     then commits inline on allow, as ONE snapshot without the revoked rule.
 *  4. The batch is ALL-OR-NOTHING: one region the approved rungs cannot reach
 *     terminates the WHOLE mutation (nothing proposes, nothing commits); two
 *     approvable regions open ONE case with one proposal row per rule.
 *
 * @module @dsh-agent-team/runtime/test/a4p5-self-mutation
 */

import { describe, expect, it } from 'vitest'
import * as approvalLane from '../governance/permission-approval.js'
import {
  createGovernanceMutationService,
  type GovernancePermissionMutationArgs,
  type PermissionResourceMatcher,
  type PermissionStaticLayerFacts,
} from '../governance/index.js'
import type { PermissionAuthorityCeilingContext } from '../governance/types.js'
import { createGovernanceProposalStore } from '../governance/proposal-store.js'
import { createTeamOperationCoordinator } from '../coordination/index.js'
import type { OverrideRecordView, OverrideStorePort, PolicyReader } from '../mutation/index.js'
import type { PolicyStateTransitionRecord } from '../mutation/types.js'
import type { GovernanceTransitionCache, GovernanceTransitionCommit } from '../governance/types.js'
import { LEADER_INSTANCE_ID } from '../../contracts/src/index.js'
import type { AuthorityEnvelopeDocuments, AuthorityDocumentSlot } from '../governance/authority-ceiling.js'
import type { AuthorityEnvelope } from '../../domain/authority-envelope/src/index.js'
import { createP6T4Service, createP6T4World, destroyP6T1World, humanCaller, leaderCaller, P6T4_ROOT, P6T4_SEEDS } from './p6t4-helpers.js'
import { openWorld, snapshotInput } from './permission-overlay-helpers.js'
import { renderPermissionResourceText as approvalLane_render } from '../governance/index.js'

const WORKER_ID = String(P6T4_SEEDS.worker.instanceId)
const NOW = '2026-10-07T09:00:00.000Z'
const FILE_A = 'output/a.json'
const FILE_B = 'output/b.json'
const FILE_C = 'output/c.json'

const exact = (resource: string): PermissionResourceMatcher => ({ kind: 'exact', resource })

class NoopOverrides implements OverrideStorePort {
  async list(_rootSessionId: string): Promise<readonly OverrideRecordView[]> {
    return []
  }
  async put(record: unknown): Promise<unknown> {
    return record
  }
}
class NoopTransitions implements GovernanceTransitionCache {
  appendTransition(_teamSessionId: string, _transition: PolicyStateTransitionRecord): void {}
  listTransitions(_teamSessionId: string): readonly PolicyStateTransitionRecord[] {
    return []
  }
}
class NoopCommit implements GovernanceTransitionCommit {
  async commit(_rootSessionId: string, _transition: PolicyStateTransitionRecord): Promise<void> {}
}
const NEVER_CONSULTED: PolicyReader = {
  readBlueprintEnvelope(): never {
    throw new Error('fixture: capability envelope read')
  },
  readTemplatePolicy(): never {
    throw new Error('fixture: template policy read')
  },
  readExternalFacts(): never {
    throw new Error('fixture: external facts read')
  },
}

function envelope(
  ...rules: { matcher: PermissionResourceMatcher; effect: 'allow' | 'ask' | 'deny' }[]
): AuthorityEnvelope {
  return {
    rules: rules.map((rule) => ({
      operationClass: 'write',
      matcher: rule.matcher,
      maximumEffect: rule.effect,
    })),
  } as AuthorityEnvelope
}

const CARRIER_ALLOW = envelope({ matcher: exact(FILE_A), effect: 'allow' }, { matcher: exact(FILE_B), effect: 'allow' })

function openWorld3(initialHard: AuthorityDocumentSlot = { status: 'absent' }) {
  const hard = { slot: initialHard }
  const staticFacts = { facts: { layers: [] } as PermissionStaticLayerFacts }
  return { hard, staticFacts, build: async (name: string) => buildWorld(name, hard, staticFacts) }
}

async function buildWorld(
  name: string,
  hard: { slot: AuthorityDocumentSlot },
  staticFacts: { facts: PermissionStaticLayerFacts },
) {
  const p6 = await createP6T4World(`a4p5c-${name}`)
  const overlay = await openWorld(`a4p5c-${name}`)
  const proposals = createGovernanceProposalStore({ ledger: p6.domain.repositories.ledger as never, now: () => NOW })
  const control = createP6T4Service(p6)
  const controlRef: { current: ControlServiceLike | undefined } = { current: control }
  type ControlServiceLike = approvalLane.PermissionMutationApprovalPort
  const governance = createGovernanceMutationService({
    chain: createTeamOperationCoordinator(),
    overrides: new NoopOverrides(),
    transitions: new NoopTransitions(),
    transitionCommit: new NoopCommit(),
    policy: NEVER_CONSULTED,
    registeredMembers: async () => [],
    policyStates: () => ['default'],
    now: () => NOW,
    permissionLane: {
      overlay: overlay.port,
      permissionEnvelope: () => CARRIER_ALLOW,
      staticLayers: () => staticFacts.facts,
      authorityCeiling: async (_t: string, _m: string, actor: 'leader' | 'human'): Promise<PermissionAuthorityCeilingContext> => ({
        // The production shape VERBATIM — the reader labels every target
        // `member`; the service must derive the Leader position itself.
        beneficiaryAuthority: 'member',
        initiatorAuthority: actor === 'leader' ? 'leader' : 'human-user',
        documents: {
          teamHardEnvelope: hard.slot,
          permissionMutationEnvelope: { status: 'declared', document: CARRIER_ALLOW },
        } satisfies AuthorityEnvelopeDocuments,
      }),
    },
    approval: approvalLane.lateBoundPermissionMutationApprovalPort(controlRef),
    proposals,
  })
  let counter = 0
  return {
    governance,
    control,
    proposals,
    overlay,
    close: async () => {
      await overlay.store.close()
      overlay.destroy()
      await destroyP6T1World(p6)
    },
    mutate: async (
      args: Partial<GovernancePermissionMutationArgs> & {
        rules: readonly { operationClass: string; matcher: PermissionResourceMatcher; effect: 'allow' | 'ask' | 'deny' }[]
      },
    ) =>
      (await governance.mutatePermission({
        authority: { kind: 'leader' },
        teamSessionId: P6T4_ROOT,
        memberInstanceId: WORKER_ID,
        kind: 'grant_instance',
        mutationId: `mut-${String(++counter)}`,
        reason: 'fixture',
        ...args,
      } as GovernancePermissionMutationArgs)) as unknown as Record<string, unknown>,
    seedOverlay: (
      memberInstanceId: string,
      rules: { operation: string; resource: string; effect: 'allow' | 'ask' | 'deny' }[],
      generation: number,
    ) =>
      overlay.port.append(
        snapshotInput(generation, {
          teamSessionId: P6T4_ROOT,
          memberInstanceId,
          // PR1 store shape, PR3 carrier grammar (see the lane-B harness).
          rules: rules.map((rule) => ({
            operation: rule.operation,
            resource: approvalLane_render({ kind: 'exact', resource: rule.resource }),
            effect: rule.effect,
          })) as never,
        }) as never,
      ),
  }
}

describe('the Leader mutating its OWN overlay', () => {
  it('self-EXPANSION asks the rung above the LEADER (never a self-review rung), whatever the context labels', async () => {
    const w0 = openWorld3()
    const w = await w0.build('self-expand')
    try {
      const result = await w.mutate({
        memberInstanceId: LEADER_INSTANCE_ID,
        rules: [{ operationClass: 'write', matcher: exact(FILE_A), effect: 'allow' }],
      })
      expect(result['reason']).toBe(approvalLane.PERMISSION_MUTATION_PENDING_REASON)
      expect(result['requiredAuthority']).toBe('human-user')
      const read = await w.control.readApprovalCaseState({
        rootSessionId: P6T4_ROOT,
        approvalCaseId: result['approvalCaseId'] as string,
      })
      if (read.kind !== 'case') throw new Error('fixture: no case')
      expect(read.state.identity.beneficiaryAuthority).toBe('leader')
      expect(read.state.identity.subject).toEqual({ kind: 'instance', instanceId: LEADER_INSTANCE_ID })
      expect(await w.overlay.port.latest({ teamSessionId: P6T4_ROOT, memberInstanceId: LEADER_INSTANCE_ID })).toBeUndefined()
    } finally {
      await w.close()
    }
  })

  it('a self-EXPANSION allowed by the Human User commits inline into the Leader overlay', async () => {
    const w0 = openWorld3()
    const w = await w0.build('self-commit')
    try {
      const rules = [{ operationClass: 'write' as const, matcher: exact(FILE_A), effect: 'allow' as const }]
      const pending = await w.mutate({ memberInstanceId: LEADER_INSTANCE_ID, rules })
      const read = await w.control.readApprovalCaseState({
        rootSessionId: P6T4_ROOT,
        approvalCaseId: pending['approvalCaseId'] as string,
      })
      if (read.kind !== 'case' || read.state.currentLeg === undefined) throw new Error('fixture: no leg')
      await w.control.resolveControl({
        rootSessionId: P6T4_ROOT,
        caller: humanCaller(),
        requestId: read.state.currentLeg.requestId,
        decision: 'allow',
      })
      const result = await w.mutate({ memberInstanceId: LEADER_INSTANCE_ID, rules })
      expect(result['changed']).toBe(true)
      const latest = await w.overlay.port.latest({ teamSessionId: P6T4_ROOT, memberInstanceId: LEADER_INSTANCE_ID })
      expect(latest?.metadata.generation).toBe(1)
    } finally {
      await w.close()
    }
  })

  it('a self-TIGHTENING needs no proposal at all (no rise -> gate silent)', async () => {
    const w0 = openWorld3()
    const w = await w0.build('self-tighten')
    try {
      await w.seedOverlay(LEADER_INSTANCE_ID, [{ operation: 'write', resource: FILE_A, effect: 'allow' }], 1)
      const result = await w.mutate({
        memberInstanceId: LEADER_INSTANCE_ID,
        rules: [{ operationClass: 'write', matcher: exact(FILE_A), effect: 'deny' }],
      })
      expect(result['changed']).toBe(true)
      const rows = (await w.proposals.listProposals({ teamSessionId: P6T4_ROOT })).filter((r) => r.kind === 'record')
      expect(rows.length).toBe(0)
      const open = await w.control.listOpenApprovalCases({ rootSessionId: P6T4_ROOT })
      expect(open.length).toBe(0)
    } finally {
      await w.close()
    }
  })
})

describe('the revoke that reveals a lower allow is an expansion', () => {
  it('proposes (deny -> revealed allow), then commits ONE rule-free snapshot on allow', async () => {
    const w0 = openWorld3()
    w0.staticFacts.facts = {
      layers: [
        { source: 'template', default: 'deny', rules: [{ operationClass: 'write', matcher: exact(FILE_A), effect: 'allow' }] },
      ],
    } as unknown as PermissionStaticLayerFacts
    const w = await w0.build('revoke-reveal')
    try {
      await w.seedOverlay(WORKER_ID, [{ operation: 'write', resource: FILE_A, effect: 'deny' }], 1)
      const pending = await w.mutate({
        kind: 'revoke_permission',
        rules: [{ operationClass: 'write', matcher: exact(FILE_A), effect: 'deny' }],
      })
      expect(pending['reason']).toBe(approvalLane.PERMISSION_MUTATION_PENDING_REASON)
      // What the case asks for is the REVEALED effect, not the revoked rule.
      expect(pending['requiredAuthority']).toBe('leader')
      const read = await w.control.readApprovalCaseState({
        rootSessionId: P6T4_ROOT,
        approvalCaseId: pending['approvalCaseId'] as string,
      })
      if (read.kind !== 'case' || read.state.currentLeg === undefined) throw new Error('fixture: no leg')
      expect(read.state.identity.requestedEffect).toBe('allow')
      await w.control.resolveControl({
        rootSessionId: P6T4_ROOT,
        caller: leaderCaller(),
        requestId: read.state.currentLeg.requestId,
        decision: 'allow',
      })
      const result = await w.mutate({
        kind: 'revoke_permission',
        rules: [{ operationClass: 'write', matcher: exact(FILE_A), effect: 'deny' }],
      })
      expect(result['changed']).toBe(true)
      const snapshot = result['snapshot'] as { state: { rules: unknown[] }; metadata: { generation: number } }
      expect(snapshot.metadata.generation).toBe(2)
      expect(snapshot.state.rules.length).toBe(0)
    } finally {
      await w.close()
    }
  })
})

describe('the batch is all-or-nothing', () => {
  it('ONE region the ladder cannot approve dooms the WHOLE batch: no rows, no commit', async () => {
    const w0 = openWorld3(
      { status: 'declared', document: envelope({ matcher: exact(FILE_B), effect: 'ask' }) },
    )
    const w = await w0.build('batch-doomed')
    try {
      const result = await w.mutate({
        rules: [
          { operationClass: 'write', matcher: exact(FILE_A), effect: 'allow' }, // approvable scope
          { operationClass: 'write', matcher: exact(FILE_B), effect: 'allow' }, // hard-capped scope
        ],
      })
      expect(result['changed']).toBe(false)
      expect(result['reason']).toBe(approvalLane.PERMISSION_MUTATION_TERMINAL_OUTCOMES.AUTHORITY_UNAVAILABLE)
      const rows = (await w.proposals.listProposals({ teamSessionId: P6T4_ROOT })).filter((r) => r.kind === 'record')
      expect(rows.length).toBe(0)
      expect(await w.overlay.port.latest({ teamSessionId: P6T4_ROOT, memberInstanceId: WORKER_ID })).toBeUndefined()
    } finally {
      await w.close()
    }
  })

  it('TWO approvable regions open ONE case with one proposal row per rule', async () => {
    const w0 = openWorld3()
    const w = await w0.build('batch-one-case')
    try {
      const result = await w.mutate({
        rules: [
          { operationClass: 'write', matcher: exact(FILE_A), effect: 'allow' },
          { operationClass: 'write', matcher: exact(FILE_B), effect: 'allow' },
        ],
      })
      expect(result['reason']).toBe(approvalLane.PERMISSION_MUTATION_PENDING_REASON)
      const rows = (await w.proposals.listProposals({ teamSessionId: P6T4_ROOT })).filter((r) => r.kind === 'record')
      expect(rows.length).toBe(2)
      const state = await w.control.listControlState(P6T4_ROOT)
      expect(state.requests.length).toBe(1)
      const open = await w.control.listOpenApprovalCases({ rootSessionId: P6T4_ROOT })
      expect(open.length).toBe(1)
      void FILE_C
    } finally {
      await w.close()
    }
  })
})
