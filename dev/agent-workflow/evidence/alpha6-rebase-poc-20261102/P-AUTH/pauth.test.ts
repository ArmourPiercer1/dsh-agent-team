/**
 * P-AUTH — can a NON-Leader, case-scoped Officer resolve a `leader-approval`
 * without changing the base permission law or impersonating the Leader?
 *
 * This probe runs against the REAL durable ControlService over the REAL
 * P6-T4 TeamDomain world (not a fake): request -> durable leg -> resolve ->
 * one durable decision, then the existing guard is exercised.
 *
 * Leg 1 (CURRENT LAW, must pass today): a Member caller is refused at the
 *   role-closure gate (`CONTROL_RESOLVER_NOT_AUTHORIZED`) even though the
 *   worker template's envelope carries `resolve-control`; the Leader is
 *   accepted. This is the fact PR #536 §5.1 states.
 * Leg 2 (SEAM PROBE, only under the throwaway case-scoped prototype patch):
 *   ONE designated non-Leader instance resolves the SAME request through the
 *   SAME entry; the decision lands in the SAME ledger with that instance as
 *   decider; the guard then consumes it; a second non-designated Member is
 *   still refused. The prototype is applied by run-prototype.sh and reverted.
 */
import { describe, expect, it } from 'vitest'
import {
  controlFacts,
  createP6T4Service,
  createP6T4World,
  destroyP6T1World,
  expectControlRejection,
  leaderCaller,
  memberCaller,
  P6T4_ROOT,
  P6T4_SEEDS,
} from '../../../../../packages/runtime/test/p6t4-helpers.js'
import type { P6T1World } from '../../../../../packages/runtime/test/p6t1-helpers.js'

const WORKER = String(P6T4_SEEDS.worker.instanceId)
const SECOND = String(P6T4_SEEDS.worker2.instanceId)
const DESIGNATED_OFFICER = SECOND

async function withWorld<T>(fn: (world: P6T1World) => Promise<T>): Promise<T> {
  const world = await createP6T4World('a6-pauth-probe', ['leader', 'worker', 'worker2'])
  try {
    return await fn(world)
  } finally {
    await destroyP6T1World(world)
  }
}

async function askLeaderApproval(service: ReturnType<typeof createP6T4Service>, correlation: string) {
  return service.requestControl({
    rootSessionId: P6T4_ROOT,
    caller: memberCaller(WORKER),
    kind: 'leader-approval',
    targetInstanceId: WORKER,
    actionName: 'write-file',
    toolName: 'fs.write',
    correlation,
  })
}

describe('P-AUTH/L1 — CURRENT LAW: a Member is never a resolver for leader-approval', () => {
  it('the ask is durable; the worker is refused; the leader is accepted', async () => {
    await withWorld(async (world) => {
      const service = createP6T4Service(world)
      const request = await askLeaderApproval(service, 'corr-pauth-l1')
      expect(request.kind).toBe('leader-approval')

      const refused = await expectControlRejection(
        () =>
          service.resolveControl({
            rootSessionId: P6T4_ROOT,
            caller: memberCaller(WORKER),
            requestId: request.requestId,
            decision: 'allow',
          }),
        'CONTROL_RESOLVER_NOT_AUTHORIZED',
      )
      expect(refused.details?.role).toBe('member')
      expect(refused.details?.allowedRoles).toEqual(['leader', 'human'])

      const decision = await service.resolveControl({
        rootSessionId: P6T4_ROOT,
        caller: leaderCaller(),
        requestId: request.requestId,
        decision: 'allow',
      })
      expect(decision.decision).toBe('allow')
      expect(decision.decider).toMatchObject({ kind: 'instance', instanceId: String(P6T4_SEEDS.leader.instanceId) })
    })
  })

  it('the worker template DOES carry the resolve-control envelope op — the refusal is role closure, not envelope', async () => {
    await withWorld(async (world) => {
      const service = createP6T4Service(world)
      const request = await askLeaderApproval(service, 'corr-pauth-envelope')
      const refused = await expectControlRejection(
        () =>
          service.resolveControl({
            rootSessionId: P6T4_ROOT,
            caller: memberCaller(WORKER),
            requestId: request.requestId,
            decision: 'allow',
          }),
        'CONTROL_RESOLVER_NOT_AUTHORIZED',
      )
      // The order is documented at service.ts: role closure BEFORE envelope.
      // The P6-T4 worker template already allows `resolve-control`, so the
      // only base-law gate in the way is the closed role table.
      expect(refused.code).toBe('CONTROL_RESOLVER_NOT_AUTHORIZED')
    })
  })
})

const PROTOTYPE_ACTIVE = process.env.A6_PAUTH_PROTOTYPE === '1'

describe.skipIf(!PROTOTYPE_ACTIVE)('P-AUTH/L2 — the throwaway case-scoped seam (prototype patch applied)', () => {
  it('the designated non-Leader resolves; the ledger decider is that instance; the guard consumes the allow', async () => {
    await withWorld(async (world) => {
      const service = createP6T4Service(world)
      const request = await askLeaderApproval(service, 'corr-pauth-l2')

      const decision = await service.resolveControl({
        rootSessionId: P6T4_ROOT,
        caller: memberCaller(DESIGNATED_OFFICER),
        requestId: request.requestId,
        decision: 'allow',
      })
      expect(decision.decision).toBe('allow')
      expect(decision.decider).toMatchObject({ kind: 'instance', instanceId: DESIGNATED_OFFICER })

      const state = await service.listControlState(P6T4_ROOT)
      const row = state.requests.find((r) => r.requestId === request.requestId)
      expect(row?.status).toBe('decided')

      const verdict = await service.guardOperation({
        rootSessionId: P6T4_ROOT,
        targetInstanceId: WORKER,
        actionName: 'write-file',
        toolName: 'fs.write',
        correlation: 'corr-pauth-l2',
      })
      expect(verdict.allowed).toBe(true)
      // The allow was consumed by the EXISTING guard/grant path — the prototype
      // changed no execution law, it only admitted the resolver.
      expect(controlFacts(world, 'control-allow-consumed')).toHaveLength(1)
    })
  })

  it('a NON-designated member is still refused (the seam is case+principal scoped, not a role widening)', async () => {
    await withWorld(async (world) => {
      const service = createP6T4Service(world)
      const request = await askLeaderApproval(service, 'corr-pauth-l2-neg')
      await expectControlRejection(
        () =>
          service.resolveControl({
            rootSessionId: P6T4_ROOT,
            caller: memberCaller(WORKER),
            requestId: request.requestId,
            decision: 'allow',
          }),
        'CONTROL_RESOLVER_NOT_AUTHORIZED',
      )
    })
  })

  it('a second decision on the same request is still terminal (no double write)', async () => {
    await withWorld(async (world) => {
      const service = createP6T4Service(world)
      const request = await askLeaderApproval(service, 'corr-pauth-l2-terminal')
      await service.resolveControl({
        rootSessionId: P6T4_ROOT,
        caller: memberCaller(DESIGNATED_OFFICER),
        requestId: request.requestId,
        decision: 'deny',
      })
      await expectControlRejection(
        () =>
          service.resolveControl({
            rootSessionId: P6T4_ROOT,
            caller: leaderCaller(),
            requestId: request.requestId,
            decision: 'allow',
          }),
        'CONTROL_REQUEST_DECIDED',
      )
    })
  })
})
