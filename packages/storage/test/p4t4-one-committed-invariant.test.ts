/**
 * p4t4-one-committed-invariant — the ONE-COMMITTED-INSTANCE invariant tests
 * (mandatory P4-T4 test): for one (rootSessionId, instanceId) there is
 * NEVER more than one committed MemberInstance, and repeated
 * provisioning/recovery converges to exactly the Development Plan §17.4
 * expected final state:
 *
 *   "one committed MemberInstance OR no committed MemberInstance +
 *    diagnosable orphan"
 *
 * Part 1 — the 10-boundary fault-injection matrix (Development Plan §17.4,
 * frozen): each boundary gets a FRESH world; the crash is simulated by
 * arming the seam (`setCrashAfterWrites`) so the drive stops mid-`provision`
 * at that seam write, then RE-DRIVING with `recover` (real process crashes
 * are P4-T5's job). Seam-write arithmetic (fresh world):
 * W1 op PREPARED, W2 child recorded on op row, W3 member record, W4 binding,
 * W5 ledger counter boot, W6 counter bump, W7 fact, W8 generation stamp
 * advance (G8-S1), W9 COMMITTED row.
 * Boundary → offset map: B1 0, B2 1, B3 1, B4 2, B5 3, B6 4, B7 9 (no crash),
 * B8 4, B9 8, B10 9 (no crash). B2 and B3 share one seam boundary because
 * the adapter call performs NO seam write (documented honestly in the
 * evidence). B6 and B8 share the same seam state for the same reason.
 *
 * Part 2 — never two committed: same-request replay is a 0-write no-op with
 * the same ledger sequence; a different allocation token or a changed intent
 * for the SAME member is a loud `RECORD_DUPLICATE`/`idempotency-conflict`
 * that writes nothing; a SECOND member (different instanceId) commits
 * independently; the SAME instanceId under a DIFFERENT root (shared domain)
 * derives a DIFFERENT operationId and commits independently — per
 * (rootSessionId, instanceId) the committed count is always exactly one.
 *
 * Part 3 — the allowed "no committed" final state: a stalled (unrecovered)
 * S3 world has NO ledger fact and a diagnosable orphan.
 *
 * @module @dsh-agent-team/storage/test/p4t4-one-committed-invariant
 */

import { describe, expect, it } from 'vitest'

import { JOURNAL_PROBLEMS } from '../operations/index.js'
import { OPERATION_PHASES } from '../schema/index.js'
import {
  PROVISIONING_DIAGNOSTIC_CODES,
  PROVISIONING_STAGES,
  FakeAgentFactoryAdapter,
  createProvisioningCoordinator,
  provisioningOperationId,
  type ProvisionResult,
  type ProvisioningStatus,
} from '../provisioning/index.js'
import { P4_FIXTURE, asTeamDomainError, capture, detail, teamSessionInput } from './p4-helpers.js'
import {
  armCrashAt,
  createP4t4World,
  driveToState,
  isSeamFailure,
  provisionRequest,
  type P4t4World,
} from './p4t4-helpers.js'

const ROOT = String(P4_FIXTURE.rootSessionId)
const OTHER_ROOT = String(P4_FIXTURE.otherRootSessionId)
const INSTANCE = String(P4_FIXTURE.instanceId)
const BETA_INSTANCE = String(P4_FIXTURE.secondInstanceId)
const ALPHA_OP_ID = provisioningOperationId(ROOT, INSTANCE)

// ------------------------------------------------- part 1: the 10-boundary matrix

interface BoundarySpec {
  readonly id: string
  readonly boundary: string
  readonly offset: number
  readonly crashes: boolean
  readonly expectedRecoveryWrites: number
  readonly expectedPostCrashStage: string
}

interface BoundaryData {
  readonly spec: BoundarySpec
  readonly world: P4t4World
  readonly runOk: boolean
  readonly runError: unknown
  readonly crashWrites: number
  readonly preCreateCalls: number
  readonly preChildren: number
  readonly preStatus: ProvisioningStatus
  readonly preOrphans: number
  readonly preFacts: number
  readonly opChildAfterCrash: string | undefined
  readonly recoverOk: boolean
  readonly recoverValue: ProvisionResult | undefined
  readonly recoverError: unknown
  readonly recoveryWrites: number
  readonly postCreateCalls: number
  readonly postChildren: number
  readonly postStatus: ProvisioningStatus
  readonly postOrphans: number
  readonly postMemberCount: number
  readonly postFactCount: number
  readonly postOpPhase: string | undefined
  readonly postOpId: string
  readonly noOpWrites: number
}

const BOUNDARIES: BoundarySpec[] = [
  { id: 'B1', boundary: 'before op prepare', offset: 0, crashes: true, expectedRecoveryWrites: 9, expectedPostCrashStage: PROVISIONING_STAGES.NONE },
  { id: 'B2', boundary: 'after op prepare', offset: 1, crashes: true, expectedRecoveryWrites: 8, expectedPostCrashStage: PROVISIONING_STAGES.ALLOCATED },
  { id: 'B3', boundary: 'before child create (same seam state as B2: the adapter call performs no seam write)', offset: 1, crashes: true, expectedRecoveryWrites: 8, expectedPostCrashStage: PROVISIONING_STAGES.ALLOCATED },
  { id: 'B4', boundary: 'after child create', offset: 2, crashes: true, expectedRecoveryWrites: 7, expectedPostCrashStage: PROVISIONING_STAGES.CHILD_SESSION_CREATED },
  { id: 'B5', boundary: 'before SessionBinding', offset: 3, crashes: true, expectedRecoveryWrites: 6, expectedPostCrashStage: PROVISIONING_STAGES.CHILD_SESSION_CREATED },
  { id: 'B6', boundary: 'before MemberInstance commit', offset: 4, crashes: true, expectedRecoveryWrites: 5, expectedPostCrashStage: PROVISIONING_STAGES.CHILD_BOUND },
  { id: 'B7', boundary: 'after MemberInstance commit (no crash)', offset: 9, crashes: false, expectedRecoveryWrites: 0, expectedPostCrashStage: PROVISIONING_STAGES.INSTANCE_COMMITTED },
  { id: 'B8', boundary: 'before ledger (same seam state as B6: the ledger write is the first commit write)', offset: 4, crashes: true, expectedRecoveryWrites: 5, expectedPostCrashStage: PROVISIONING_STAGES.CHILD_BOUND },
  { id: 'B9', boundary: 'before operation committed (fact + stamp durable, COMMITTED row not written)', offset: 8, crashes: true, expectedRecoveryWrites: 1, expectedPostCrashStage: PROVISIONING_STAGES.CHILD_BOUND },
  { id: 'B10', boundary: 'after committed (no crash)', offset: 9, crashes: false, expectedRecoveryWrites: 0, expectedPostCrashStage: PROVISIONING_STAGES.INSTANCE_COMMITTED },
]

async function runBoundary(spec: BoundarySpec): Promise<BoundaryData> {
  const world = await createP4t4World()
  const base = world.seam.writeCount
  if (spec.crashes) armCrashAt(world.seam, base, spec.offset)
  const run = await capture(() => world.coordinator.provision(provisionRequest()))
  const crashWrites = world.seam.writeCount - base
  const preCreateCalls = world.adapter.createCalls
  const preChildren = world.adapter.childrenCreated
  const preStatus = world.coordinator.status({ instanceId: P4_FIXTURE.instanceId })
  const preOrphans = world.coordinator.listOrphans().length
  const preFacts = world.domain.repositories.ledger.entryCount()
  const op = world.domain.repositories.operations.get(ALPHA_OP_ID)
  const opChildAfterCrash = op?.childSessionId !== undefined ? String(op.childSessionId) : undefined
  const preRecoverWrites = world.seam.writeCount
  if (spec.crashes) world.seam.clearCrash()
  const recover = await capture(() => world.coordinator.recover(provisionRequest()))
  const recoveryWrites = world.seam.writeCount - preRecoverWrites
  const postStatus = world.coordinator.status({ instanceId: P4_FIXTURE.instanceId })
  const postOrphans = world.coordinator.listOrphans().length
  const postOp = world.domain.repositories.operations.get(ALPHA_OP_ID)
  const noOpBase = world.seam.writeCount
  const noOp = await capture(() => world.coordinator.recover(provisionRequest()))
  const noOpWrites = world.seam.writeCount - noOpBase
  if (!noOp.ok) throw new Error(`B ${spec.id}: the post-convergence no-op recover must succeed: ${String(noOp.error)}`)
  return {
    spec,
    world,
    runOk: run.ok,
    runError: run.error,
    crashWrites,
    preCreateCalls,
    preChildren,
    preStatus,
    preOrphans,
    preFacts,
    opChildAfterCrash,
    recoverOk: recover.ok,
    recoverValue: recover.ok ? recover.value : undefined,
    recoverError: recover.error,
    recoveryWrites,
    postCreateCalls: world.adapter.createCalls,
    postChildren: world.adapter.childrenCreated,
    postStatus,
    postOrphans,
    postMemberCount: world.domain.repositories.memberInstances.list(ROOT).length,
    postFactCount: world.domain.repositories.ledger.entryCount(),
    postOpPhase: postOp !== undefined ? postOp.phase : undefined,
    postOpId: ALPHA_OP_ID,
    noOpWrites,
  }
}

const boundaryData: BoundaryData[] = []
for (const spec of BOUNDARIES) {
  boundaryData.push(await runBoundary(spec))
}
const row = (id: string): BoundaryData => {
  const found = boundaryData.find((d) => d.spec.id === id)
  if (found === undefined) throw new Error(`missing boundary row ${id}`)
  return found
}

// ------------------------------------------------- part 2: never two committed

const two = await createP4t4World()
await two.coordinator.provision(provisionRequest())
const twoReplayBase = two.seam.writeCount
const twoReplay = await two.coordinator.provision(provisionRequest())
const twoReplayWrites = two.seam.writeCount - twoReplayBase
const twoConflictBase = two.seam.writeCount
const twoToken = await capture(() => two.coordinator.provision(provisionRequest({ allocationToken: 'p4t4-other-token' })))
const twoLabel = await capture(() => two.coordinator.provision(provisionRequest({ label: 'Renamed Alpha' })))
const twoConflictWrites = two.seam.writeCount - twoConflictBase
const betaReq = provisionRequest({
  instanceId: P4_FIXTURE.secondInstanceId,
  label: 'Beta Researcher',
  allocationToken: 'p4t4-alloc-beta-2',
})
const twoBeta = await two.coordinator.provision(betaReq)
const twoMembers = two.domain.repositories.memberInstances.list(ROOT)
const twoFacts = two.domain.repositories.ledger.list()
const twoAlphaCount = twoMembers.filter((m) => String(m.instanceId) === INSTANCE).length
const twoBetaCount = twoMembers.filter((m) => String(m.instanceId) === BETA_INSTANCE).length
const twoOrphans = two.coordinator.listOrphans()

// Same instanceId under a DIFFERENT root over the SAME shared domain.
// G8-S1: the cross-root team row must exist before the first fact — the
// generation-stamp hook (hook A) advances it on every new fact.
await two.domain.repositories.teamSessions.put(teamSessionInput(P4_FIXTURE.otherRootSessionId))
const crossAdapter = new FakeAgentFactoryAdapter()
const cross = createProvisioningCoordinator({
  domain: two.domain,
  rootSessionId: P4_FIXTURE.otherRootSessionId,
  adapter: crossAdapter,
})
const crossOpId = provisioningOperationId(OTHER_ROOT, INSTANCE)
const crossResult = await cross.provision(provisionRequest({ label: 'Alpha Researcher (root-2)', allocationToken: 'p4t4-alloc-alpha-root2' }))
const crossOp = two.domain.repositories.operations.get(crossOpId)
const crossMembers = two.domain.repositories.memberInstances.list(OTHER_ROOT)
const crossFacts = two.domain.repositories.ledger.list()

// ------------------------------------------ part 3: the allowed "no committed" state

const allowed = await createP4t4World()
await driveToState(allowed, 'S3')
const allowedFacts = allowed.domain.repositories.ledger.entryCount()
const allowedStatus = allowed.coordinator.status({ instanceId: P4_FIXTURE.instanceId })
const allowedOrphans = allowed.coordinator.listOrphans()

// ---------------------------------------------------------------- assertions

describe('10-boundary crash matrix (Development Plan §17.4): re-driving from every boundary converges to exactly one committed member', () => {
  for (const data of boundaryData) {
    const spec = data.spec
    it(`${spec.id} (${spec.boundary}): ${spec.crashes ? 'the drive stops mid-protocol and recover converges with the exact remaining writes' : 'the full 9-write protocol completes without a crash'}`, () => {
      if (spec.crashes) {
        expect(data.runOk).toBe(false)
        expect(isSeamFailure(data.runError)).toBe(true)
        expect(data.crashWrites).toBe(spec.offset)
        expect(data.recoverOk).toBe(true)
        if (data.recoverOk && data.recoverValue !== undefined) {
          expect(data.recoverValue.stage).toBe(PROVISIONING_STAGES.INSTANCE_COMMITTED)
          expect(data.recoverValue.committed).toBe(true)
        }
        expect(data.recoveryWrites).toBe(spec.expectedRecoveryWrites)
      } else {
        expect(data.runOk).toBe(true)
        expect(data.crashWrites).toBe(9)
        expect(data.recoverOk).toBe(true)
        expect(data.recoveryWrites).toBe(0)
      }
      // The convergence invariants — identical for every boundary.
      expect(data.postStatus.stage).toBe(PROVISIONING_STAGES.INSTANCE_COMMITTED)
      expect(data.postStatus.committed).toBe(true)
      expect(data.postStatus.diagnostic).toBe(undefined)
      expect(data.postMemberCount).toBe(1)
      expect(data.postFactCount).toBe(1)
      expect(data.postOpPhase).toBe(OPERATION_PHASES.COMMITTED)
      expect(data.postOpId).toBe(ALPHA_OP_ID)
      expect(data.postOrphans).toBe(0)
      expect(data.postChildren).toBe(1)
      expect(data.noOpWrites).toBe(0)
    })
  }

  it('B1 (before op prepare): nothing durable, the external effect never happened; recovery mints the child exactly once', () => {
    const d = row('B1')
    expect(d.preCreateCalls).toBe(0)
    expect(d.preChildren).toBe(0)
    expect(d.preStatus.stage).toBe(PROVISIONING_STAGES.NONE)
    expect(d.preStatus.diagnostic?.code).toBe(PROVISIONING_DIAGNOSTIC_CODES.MEMBER_NOT_PROVISIONED)
    expect(d.preOrphans).toBe(0)
    expect(d.postCreateCalls).toBe(1)
    expect(d.postChildren).toBe(1)
  })

  it('B2/B3 (after op prepare / before child create): the adapter already minted the child but the crash lost the record; re-drive re-mints the SAME deterministic child', () => {
    for (const id of ['B2', 'B3']) {
      const d = row(id)
      expect(d.preCreateCalls).toBe(1)
      expect(d.preChildren).toBe(1)
      expect(d.preStatus.stage).toBe(PROVISIONING_STAGES.ALLOCATED)
      expect(d.preStatus.diagnostic).toBe(undefined) // nothing recorded in TeamDomain yet: no orphan
      expect(d.preOrphans).toBe(0)
      expect(d.opChildAfterCrash).toBe(undefined) // the child id was never durably recorded
      expect(d.postCreateCalls).toBe(2) // re-driven adapter call (idempotent on (root, instance))
      expect(d.postChildren).toBe(1) // the SAME child, minted once
      expect(String(d.postStatus.childSessionId)).toBe(String(d.world.adapter.childSessionIdFor(ROOT, INSTANCE)))
    }
  })

  it('B4 (after child create): the child IS recorded but the member record was lost; re-drive reuses the recorded child (no second external effect) and the orphan names record+binding+commit before convergence', () => {
    const d = row('B4')
    expect(d.preCreateCalls).toBe(1)
    expect(d.preChildren).toBe(1)
    expect(d.preStatus.stage).toBe(PROVISIONING_STAGES.CHILD_SESSION_CREATED)
    expect(d.preStatus.diagnostic?.code).toBe(PROVISIONING_DIAGNOSTIC_CODES.ORPHANED_CHILD_SESSION)
    expect(d.preStatus.diagnostic?.context?.['missing']).toEqual(['record', 'binding', 'commit'])
    expect(d.opChildAfterCrash).toBe(String(d.world.adapter.childSessionIdFor(ROOT, INSTANCE)))
    expect(d.preOrphans).toBe(1)
    expect(d.postCreateCalls).toBe(1) // the recorded child was REUSED, not re-created
    expect(d.postChildren).toBe(1)
  })

  it('B5 (before SessionBinding): orphan names binding+commit; B6/B8 (before commit/ledger): orphan names only commit; B9 (before operation committed): the fact is already durable (1 fact) and only the COMMITTED row is missing', () => {
    const b5 = row('B5')
    expect(b5.preStatus.diagnostic?.code).toBe(PROVISIONING_DIAGNOSTIC_CODES.ORPHANED_CHILD_SESSION)
    expect(b5.preStatus.diagnostic?.context?.['missing']).toEqual(['binding', 'commit'])
    expect(b5.preOrphans).toBe(1)
    expect(b5.postCreateCalls).toBe(1)
    for (const id of ['B6', 'B8']) {
      const d = row(id)
      expect(d.preStatus.diagnostic?.code).toBe(PROVISIONING_DIAGNOSTIC_CODES.ORPHANED_CHILD_SESSION)
      expect(d.preStatus.diagnostic?.context?.['missing']).toEqual(['commit'])
      expect(d.preOrphans).toBe(1)
      expect(d.preFacts).toBe(0)
      expect(d.postCreateCalls).toBe(1)
    }
    const b9 = row('B9')
    expect(b9.preStatus.diagnostic?.code).toBe(PROVISIONING_DIAGNOSTIC_CODES.ORPHANED_CHILD_SESSION)
    expect(b9.preStatus.diagnostic?.context?.['missing']).toEqual(['commit'])
    expect(b9.preFacts).toBe(1) // the fact survived the crash; only the COMMITTED row is missing
    expect(b9.preStatus.committed).toBe(false) // committed requires BOTH halves
    expect(b9.postCreateCalls).toBe(1)
  })
})

describe('never two committed: the one-committed-instance invariant for (rootSessionId, instanceId)', () => {
  it('re-submitting the SAME request after commit is a 0-write no-op replay with the same ledger sequence', () => {
    expect(twoReplayWrites).toBe(0)
    expect(twoReplay.stage).toBe(PROVISIONING_STAGES.INSTANCE_COMMITTED)
    expect(twoReplay.committed).toBe(true)
    expect(twoReplay.ledgerSequence).toBe(1)
  })

  it('a different allocation token for the SAME member is a loud idempotency conflict (RECORD_DUPLICATE + idempotency-conflict) that writes nothing', () => {
    expect(twoToken.ok).toBe(false)
    const error = asTeamDomainError(twoToken.error)
    expect(error.code).toBe('RECORD_DUPLICATE')
    expect(detail(error, 'problem')).toBe(JOURNAL_PROBLEMS.IDEMPOTENCY_CONFLICT)
  })

  it('a changed intent (label) for the SAME member conflicts the same way; together they wrote nothing and left exactly one committed alpha and one fact', () => {
    expect(twoLabel.ok).toBe(false)
    const error = asTeamDomainError(twoLabel.error)
    expect(error.code).toBe('RECORD_DUPLICATE')
    expect(detail(error, 'problem')).toBe(JOURNAL_PROBLEMS.IDEMPOTENCY_CONFLICT)
    expect(twoConflictWrites).toBe(0)
    expect(twoMembers.length).toBe(2) // alpha + beta (provisioned below), never a second alpha
    expect(twoAlphaCount).toBe(1)
    expect(twoFacts.length).toBe(2)
    expect(twoOrphans.length).toBe(0)
  })

  it('a SECOND member (inst-beta) in the same team commits independently: two members, two facts, one committed per instance', () => {
    expect(twoBeta.stage).toBe(PROVISIONING_STAGES.INSTANCE_COMMITTED)
    expect(twoBeta.committed).toBe(true)
    expect(twoBeta.ledgerSequence).toBe(2)
    expect(twoBetaCount).toBe(1)
  })

  it('the SAME instanceId under a DIFFERENT root (shared domain) derives a DIFFERENT operationId and commits independently — per-(root,instance) is still exactly one', () => {
    expect(crossOpId).not.toBe(ALPHA_OP_ID)
    expect(crossResult.stage).toBe(PROVISIONING_STAGES.INSTANCE_COMMITTED)
    expect(crossResult.committed).toBe(true)
    expect(crossOp?.phase).toBe(OPERATION_PHASES.COMMITTED)
    expect(crossMembers.length).toBe(1)
    expect(String(crossMembers[0]?.instanceId)).toBe(INSTANCE)
    expect(two.domain.repositories.operations.get(ALPHA_OP_ID)?.phase).toBe(OPERATION_PHASES.COMMITTED)
    expect(crossFacts.length).toBe(3) // alpha(root-1) + beta(root-1) + alpha(root-2)
  })
})

describe('allowed final state: no committed MemberInstance + diagnosable orphan (the §17.4 "OR" branch)', () => {
  it('a stalled S3 world has NO ledger fact (nothing committed) and the member record is not committed', () => {
    expect(allowedFacts).toBe(0)
    expect(allowedStatus.stage).toBe(PROVISIONING_STAGES.CHILD_BOUND)
    expect(allowedStatus.committed).toBe(false)
  })

  it('the stalled member is a diagnosable orphan, so the final state is never a silent loss', () => {
    expect(allowedOrphans.length).toBe(1)
    expect(allowedOrphans[0]?.instanceId).toBe(INSTANCE)
    expect(allowedStatus.diagnostic?.code).toBe(PROVISIONING_DIAGNOSTIC_CODES.ORPHANED_CHILD_SESSION)
    expect(allowedStatus.diagnostic?.context?.['missing']).toEqual(['commit'])
  })
})
