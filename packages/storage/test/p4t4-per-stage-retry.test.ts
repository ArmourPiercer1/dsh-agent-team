/**
 * p4t4-per-stage-retry — the per-stage RETRY tests (mandatory P4-T4 test):
 * every stage method is idempotent — re-running any stage after its durable
 * marker exists performs ZERO seam writes and never re-calls the external
 * adapter, and entering the machine at ANY stage is safe (self-ensuring
 * stages ensure their predecessors), so a repeated provisioning of the same
 * member converges to the same durable result (Development Plan §17.3).
 *
 * Protocol write counts (fresh world, per stage method): allocate = 1 (op
 * PREPARED row); createChildSession = 2 (child recorded on the op row +
 * member record); bindChildSession = 1 (the team-member binding);
 * commitInstance = 5 (ledger counter boot + counter bump + fact +
 * generation stamp advance (G8-S1) + COMMITTED row); a full `provision` =
 * 9. A retry of any completed stage = 0.
 *
 * Also covers: the happy path, the idempotency-conflict guard (same member,
 * different allocation token / intent → loud `RECORD_DUPLICATE` +
 * `idempotency-conflict`, no second member), and `recover` from every
 * durable state S0..S5 (roll-forward with the exact remaining write count).
 *
 * @module @dsh-agent-team/storage/test/p4t4-per-stage-retry
 */

import { describe, expect, it } from 'vitest'

import { JOURNAL_PROBLEMS } from '../operations/index.js'
import { OPERATION_PHASES } from '../schema/index.js'
import { PROVISIONING_STAGES } from '../provisioning/index.js'
import { P4_FIXTURE, asTeamDomainError, capture, detail } from './p4-helpers.js'
import {
  P4T4_STATES,
  createP4t4World,
  driveToState,
  operationIdFor,
  provisionRequest,
  type P4t4World,
} from './p4t4-helpers.js'

const ROOT = String(P4_FIXTURE.rootSessionId)
const INSTANCE = String(P4_FIXTURE.instanceId)

/**
 * Assert the converged committed shape of one world (synchronous; call
 * inside `it` bodies only — assertions are folded into the enclosing test).
 */
function assertCommitted(world: P4t4World, request: ReturnType<typeof provisionRequest>, childSessionId: string) {
  const repositories = world.domain.repositories
  const opId = operationIdFor(world, request)
  const operation = repositories.operations.get(opId)
  expect(operation).not.toBe(undefined)
  expect(operation?.phase).toBe(OPERATION_PHASES.COMMITTED)
  expect(String(operation?.childSessionId)).toBe(childSessionId)
  const members = repositories.memberInstances.list(ROOT)
  expect(members.length).toBe(1)
  const member = members[0]
  expect(String(member?.instanceId)).toBe(INSTANCE)
  expect(String(member?.childSessionId)).toBe(childSessionId)
  const facts = world.domain.repositories.ledger.list()
  expect(facts.length).toBe(1)
  expect(facts[0]?.operationId).toBe(opId)
  expect(world.coordinator.listOrphans().length).toBe(0)
  const status = world.coordinator.status({ instanceId: INSTANCE })
  expect(status.stage).toBe(PROVISIONING_STAGES.INSTANCE_COMMITTED)
  expect(status.committed).toBe(true)
  expect(status.diagnostic).toBe(undefined)
}

// ------------------------------------------------- W-happy: the full happy path

const happy = await createP4t4World()
const happyBase = happy.seam.writeCount
const happyReq = provisionRequest()
const happyResult = await happy.coordinator.provision(happyReq)
const happyWrites = happy.seam.writeCount - happyBase
const happyChild = String(happyResult.childSessionId)

// --------------------------------------------- W-retry: each stage retried twice

const retry = await createP4t4World()
const retryReq = provisionRequest()
const r0 = retry.seam.writeCount
const s1 = await retry.coordinator.allocate(retryReq)
await retry.coordinator.allocate(retryReq)
const wAlloc = retry.seam.writeCount - r0
const r1 = retry.seam.writeCount
const s2 = await retry.coordinator.createChildSession(retryReq)
const adapterCallsAfterChild = retry.adapter.createCalls
const s2b = await retry.coordinator.createChildSession(retryReq)
const wChild = retry.seam.writeCount - r1
const adapterCallsAfterChildRetry = retry.adapter.createCalls
const r2 = retry.seam.writeCount
const s3 = await retry.coordinator.bindChildSession(retryReq)
const s3b = await retry.coordinator.bindChildSession(retryReq)
const wBind = retry.seam.writeCount - r2
const r3 = retry.seam.writeCount
const c1 = await retry.coordinator.commitInstance(retryReq)
const c2 = await retry.coordinator.commitInstance(retryReq)
const wCommit = retry.seam.writeCount - r3
const retryChild = String(c1.childSessionId)

// --------------------------------------------- W-self: self-ensuring entry from any stage

const selfCommit = await createP4t4World()
const selfCommitReq = provisionRequest()
const selfCommitResult = await selfCommit.coordinator.commitInstance(selfCommitReq)
const selfCommitChild = String(selfCommitResult.childSessionId)

const selfBind = await createP4t4World()
const selfBindReq = provisionRequest()
const selfBindStatus = await selfBind.coordinator.bindChildSession(selfBindReq)
const selfBindMemberCount = selfBind.domain.repositories.memberInstances.list(ROOT).length
const selfBindBase = selfBind.seam.writeCount
const selfBindRecover = await selfBind.coordinator.recover(selfBindReq)
const selfBindRecoverWrites = selfBind.seam.writeCount - selfBindBase
const selfBindChild = String(selfBindRecover.childSessionId)

// ------------------------------------------- W-conflict: same member, different identity

const conflict = await createP4t4World()
const conflictReq = provisionRequest()
await conflict.coordinator.provision(conflictReq)
const conflictChild = String(conflict.coordinator.status({ instanceId: INSTANCE }).childSessionId)
const conflictWritesAfterCommit = conflict.seam.writeCount
const conflictToken = await capture(() =>
  conflict.coordinator.provision(provisionRequest({ allocationToken: 'a-different-token' })),
)
const conflictLabel = await capture(() => conflict.coordinator.provision(provisionRequest({ label: 'Renamed' })))
const conflictReplayWritesBase = conflict.seam.writeCount
const conflictReplay = await conflict.coordinator.provision(conflictReq)
const conflictReplayWrites = conflict.seam.writeCount - conflictReplayWritesBase

// ----------------------------------------------- W-recover: recover from every state

interface RecoverRun {
  readonly state: (typeof P4T4_STATES)[number]
  readonly world: P4t4World
  readonly writes: number
  readonly ok: boolean
  readonly childSessionId: string | undefined
}
const recoverRuns: RecoverRun[] = []
for (const state of P4T4_STATES) {
  const world = await createP4t4World()
  await driveToState(world, state)
  const base = world.seam.writeCount
  const run = await capture(() => world.coordinator.recover(provisionRequest()))
  recoverRuns.push({
    state,
    world,
    writes: world.seam.writeCount - base,
    ok: run.ok,
    childSessionId: run.ok && run.value !== undefined ? String(run.value.childSessionId) : undefined,
  })
}
const recoverByState = (state: (typeof P4T4_STATES)[number]): RecoverRun | undefined =>
  recoverRuns.find((run) => run.state === state)

// ---------------------------------------------------------------- assertions

describe('happy path: one full provisioning drive commits the member exactly once', () => {
  it('reaches INSTANCE_COMMITTED with the committed durable shape', () => {
    expect(happyResult.stage).toBe(PROVISIONING_STAGES.INSTANCE_COMMITTED)
    expect(happyResult.committed).toBe(true)
    expect(String(happyResult.childSessionId)).toBe(happyChild)
    expect(happyResult.effectsApplied).toBe(0)
    expect(happyResult.effectsSkipped).toBe(0)
    assertCommitted(happy, happyReq, happyChild)
  })

  it('performs exactly the nine protocol seam writes (op, child, member, binding, counter boot, counter bump, fact, stamp advance, committed)', () => {
    expect(happyWrites).toBe(9)
  })

  it('calls the external adapter exactly once and mints exactly one child', () => {
    expect(happy.adapter.createCalls).toBe(1)
    expect(happy.adapter.childrenCreated).toBe(1)
    expect(String(happy.adapter.childSessionIdFor(ROOT, INSTANCE))).toBe(happyChild)
  })

  it('writes one ledger fact attributed to the provisioning operation', () => {
    const facts = happy.domain.repositories.ledger.list()
    expect(facts.length).toBe(1)
    expect(facts[0]?.operationId).toBe(operationIdFor(happy, happyReq))
    expect(facts[0]?.factType).toBe('provision-member-instance')
  })
})

describe('per-stage retry: every stage is idempotent (no re-write, no re-effect)', () => {
  it('deriveStatus reflects each stage as it completes', () => {
    expect(s1.stage).toBe(PROVISIONING_STAGES.ALLOCATED)
    expect(s1.committed).toBe(false)
    expect(s2.stage).toBe(PROVISIONING_STAGES.CHILD_SESSION_CREATED)
    expect(s3.stage).toBe(PROVISIONING_STAGES.CHILD_BOUND)
    expect(s2b.stage).toBe(PROVISIONING_STAGES.CHILD_SESSION_CREATED)
    expect(s3b.stage).toBe(PROVISIONING_STAGES.CHILD_BOUND)
    expect(c1.stage).toBe(PROVISIONING_STAGES.INSTANCE_COMMITTED)
    expect(c2.stage).toBe(PROVISIONING_STAGES.INSTANCE_COMMITTED)
    expect(c2.committed).toBe(true)
  })

  it('allocate writes the op row once; the retry performs 0 writes', () => {
    expect(wAlloc).toBe(1)
  })

  it('createChildSession writes child + member record (2 writes); the retry performs 0 writes and does NOT call the adapter again', () => {
    expect(wChild).toBe(2)
    expect(adapterCallsAfterChild).toBe(1)
    expect(adapterCallsAfterChildRetry).toBe(1)
  })

  it('bindChildSession writes the binding once (1 write); the retry performs 0 writes', () => {
    expect(wBind).toBe(1)
  })

  it('commitInstance performs the 5-write terminal (counter boot, counter bump, fact, stamp advance, committed); the retry performs 0 writes', () => {
    expect(wCommit).toBe(5)
    expect(c1.ledgerSequence).toBe(c2.ledgerSequence)
    expect(c2.effectsApplied).toBe(0)
    expect(c2.effectsSkipped).toBe(0)
  })

  it('the retried member is committed exactly once with no orphan', () => {
    assertCommitted(retry, retryReq, retryChild)
  })
})

describe('self-ensuring stages: the machine can be entered at any stage', () => {
  it('commitInstance on a fresh world drives the FULL chain and commits', () => {
    expect(selfCommitResult.stage).toBe(PROVISIONING_STAGES.INSTANCE_COMMITTED)
    expect(selfCommitResult.committed).toBe(true)
    expect(selfCommit.adapter.createCalls).toBe(1)
    assertCommitted(selfCommit, selfCommitReq, selfCommitChild)
  })

  it('bindChildSession on a fresh world ensures the earlier stages (stops at CHILD_BOUND, not committed)', () => {
    expect(selfBindStatus.stage).toBe(PROVISIONING_STAGES.CHILD_BOUND)
    expect(selfBindStatus.committed).toBe(false)
    expect(selfBindMemberCount).toBe(1)
  })

  it('recover then rolls forward from CHILD_BOUND with exactly the 5-write terminal', () => {
    expect(selfBindRecoverWrites).toBe(5)
    expect(selfBindRecover.stage).toBe(PROVISIONING_STAGES.INSTANCE_COMMITTED)
    assertCommitted(selfBind, selfBindReq, selfBindChild)
  })
})

describe('idempotency guard: same member, different identity is a loud conflict (no second member)', () => {
  it('a different allocation token for the same member conflicts (RECORD_DUPLICATE + idempotency-conflict)', () => {
    expect(conflictToken.ok).toBe(false)
    const error = asTeamDomainError(conflictToken.error)
    expect(error.code).toBe('RECORD_DUPLICATE')
    expect(detail(error, 'problem')).toBe(JOURNAL_PROBLEMS.IDEMPOTENCY_CONFLICT)
  })

  it('a changed intent (label) for the same member conflicts the same way', () => {
    expect(conflictLabel.ok).toBe(false)
    const error = asTeamDomainError(conflictLabel.error)
    expect(error.code).toBe('RECORD_DUPLICATE')
    expect(detail(error, 'problem')).toBe(JOURNAL_PROBLEMS.IDEMPOTENCY_CONFLICT)
  })

  it('the conflicts wrote nothing and left exactly one committed member and one fact', () => {
    expect(conflict.seam.writeCount).toBe(conflictWritesAfterCommit)
    assertCommitted(conflict, conflictReq, conflictChild)
  })

  it('re-submitting the SAME request is a no-op replay (0 writes, same committed result)', () => {
    expect(conflictReplayWrites).toBe(0)
    expect(conflictReplay.stage).toBe(PROVISIONING_STAGES.INSTANCE_COMMITTED)
    expect(conflictReplay.committed).toBe(true)
    expect(conflictReplay.ledgerSequence).toBe(1)
  })
})

describe('recover: re-driving from every durable state S0..S5 converges to the same committed member', () => {
  it('every recovery run converged (no rejected recover)', () => {
    for (const run of recoverRuns) {
      expect(run.ok).toBe(true)
    }
  })

  it('roll-forward performs exactly the REMAINING protocol writes per state (S0:9, S1:8, S2:6, S3:5, S4:1, S5:0)', () => {
    expect(recoverByState('S0')?.writes).toBe(9)
    expect(recoverByState('S1')?.writes).toBe(8)
    expect(recoverByState('S2')?.writes).toBe(6)
    expect(recoverByState('S3')?.writes).toBe(5)
    expect(recoverByState('S4')?.writes).toBe(1)
    expect(recoverByState('S5')?.writes).toBe(0)
  })

  it('every recovered member is committed exactly once (one member, one fact, no orphan)', () => {
    for (const run of recoverRuns) {
      expect(run.ok).toBe(true)
      if (run.ok && run.childSessionId !== undefined) {
        assertCommitted(run.world, provisionRequest(), run.childSessionId)
      }
    }
  })
})
