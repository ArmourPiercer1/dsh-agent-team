/**
 * p4t4-orphan-detect — the ORPHAN-DETECTION tests (mandatory P4-T4 test):
 * every durable state in which a child session has been durably recorded
 * but the member is NOT committed is a *diagnosable orphan* (Development
 * Plan §17.4: "one committed MemberInstance OR no committed MemberInstance
 * + diagnosable orphan"). The orphan diagnostic names the exact missing
 * pieces (`record` / `binding` / `commit`), and `listOrphans()` enumerates
 * every orphan of THIS team (scoped by the operation intent payload root),
 * sorted by instanceId.
 *
 * Boundary states covered (Development Plan §17.4 fault-injection matrix,
 * see p4t4-helpers for the S0..S5 mapping):
 * - W-none: no durable state → NONE + MEMBER_NOT_PROVISIONED, no orphans;
 * - W-S1  : ALLOCATED (op PREPARED, no child) → NOT an orphan (the external
 *           effect has not happened yet; nothing was recorded externally);
 * - W-S2  : CHILD_SESSION_CREATED → orphan, missing ['binding','commit'];
 * - W-S3  : CHILD_BOUND → orphan, missing ['commit'];
 * - W-S4  : CHILD_BOUND + fact durable (op not committed) → orphan, missing
 *           ['commit'], exactly one ledger fact;
 * - W-B4  : crash mid-`provision` right after the child was recorded
 *           (boundary 4, seam offset 2) → orphan, missing
 *           ['record','binding','commit']; re-drive converges with the
 *           EXISTING child (no second external effect);
 * - W-multi: two members stalled at different stages → two orphans, sorted;
 * - W-cross: two coordinators over the SAME domain, different roots → each
 *           coordinator lists only its own team's orphans;
 * - W-recover: an orphan disappears once recovery commits the member.
 *
 * @module @dsh-agent-team/storage/test/p4t4-orphan-detect
 */

import { describe, expect, it } from 'vitest'

import { OPERATION_PHASES } from '../schema/index.js'
import {
  PROVISIONING_DIAGNOSTIC_CODES,
  PROVISIONING_STAGES,
  FakeAgentFactoryAdapter,
  createProvisioningCoordinator,
  type ProvisioningDiagnostic,
} from '../provisioning/index.js'
import { P4_FIXTURE } from './p4-helpers.js'
import {
  armCrashAt,
  createP4t4World,
  driveToState,
  isSeamFailure,
  operationIdFor,
  provisionRequest,
} from './p4t4-helpers.js'

const ROOT = String(P4_FIXTURE.rootSessionId)
const INSTANCE = String(P4_FIXTURE.instanceId)

/** Read the `missing` array out of a diagnostic's context (throws if absent). */
function missingOf(diagnostic: ProvisioningDiagnostic): unknown {
  if (diagnostic.context === undefined) throw new Error('diagnostic is missing its context')
  return diagnostic.context['missing']
}

function expectOrphan(diagnostic: unknown, label: string): ProvisioningDiagnostic {
  if (diagnostic === undefined || typeof diagnostic !== 'object') {
    throw new Error(`${label}: expected an orphan diagnostic, got ${String(diagnostic)}`)
  }
  const d = diagnostic as ProvisioningDiagnostic
  if (d.code !== PROVISIONING_DIAGNOSTIC_CODES.ORPHANED_CHILD_SESSION) {
    throw new Error(`${label}: expected ORPHANED_CHILD_SESSION, got ${d.code}`)
  }
  return d
}

// -------------------------------------------------- W-none: no durable state

const none = await createP4t4World()
const noneStatus = none.coordinator.status({ instanceId: P4_FIXTURE.instanceId })
const noneOrphans = none.coordinator.listOrphans()

// ------------------------------------------------------ W-S1: ALLOCATED only

const s1w = await createP4t4World()
await s1w.coordinator.allocate(provisionRequest())
const s1Status = s1w.coordinator.status({ instanceId: P4_FIXTURE.instanceId })
const s1Orphans = s1w.coordinator.listOrphans()

// -------------------------------------------------- W-S2: CHILD_SESSION_CREATED

const s2w = await createP4t4World()
await s2w.coordinator.createChildSession(provisionRequest())
const s2Status = s2w.coordinator.status({ instanceId: P4_FIXTURE.instanceId })
const s2Child = s2Status.childSessionId ?? ''
const s2Orphans = s2w.coordinator.listOrphans()

// ------------------------------------------------------ W-S3: CHILD_BOUND

const s3w = await createP4t4World()
await s3w.coordinator.bindChildSession(provisionRequest())
const s3Status = s3w.coordinator.status({ instanceId: P4_FIXTURE.instanceId })
const s3Orphans = s3w.coordinator.listOrphans()

// ---------------------------------- W-S4: bound + fact durable, op not committed

const s4w = await createP4t4World()
await driveToState(s4w, 'S4')
const s4Status = s4w.coordinator.status({ instanceId: P4_FIXTURE.instanceId })
const s4Facts = s4w.domain.repositories.ledger.entryCount()
const s4Orphans = s4w.coordinator.listOrphans()

// ------------------------------------- W-B4: crash right after child recorded

const b4 = await createP4t4World()
const b4Base = b4.seam.writeCount
armCrashAt(b4.seam, b4Base, 2)
const b4Provision = await (async () => {
  try {
    await b4.coordinator.provision(provisionRequest())
    return { ok: true }
  } catch (error) {
    return { ok: false, error }
  }
})()
const b4Status = b4.coordinator.status({ instanceId: P4_FIXTURE.instanceId })
const b4Orphans = b4.coordinator.listOrphans()
const b4Op = b4.domain.repositories.operations.get(operationIdFor(b4, provisionRequest()))
const b4CrashWrites = b4.seam.writeCount - b4Base
const b4MemberCountAfterCrash = b4.domain.repositories.memberInstances.list(ROOT).length
const b4PreRecover = b4.seam.writeCount
b4.seam.clearCrash()
const b4Recover = await (async () => {
  try {
    const value = await b4.coordinator.recover(provisionRequest())
    return { ok: true, value }
  } catch (error) {
    return { ok: false, error }
  }
})()
const b4RecoverWrites = b4.seam.writeCount - b4PreRecover
const b4AfterRecover = b4.coordinator.status({ instanceId: P4_FIXTURE.instanceId })
const b4OrphansAfter = b4.coordinator.listOrphans()

// ------------------------------------------------- W-multi: two stalled members

const multi = await createP4t4World()
const betaReq = provisionRequest({
  instanceId: P4_FIXTURE.secondInstanceId,
  label: 'Beta Researcher',
  allocationToken: 'p4t4-alloc-beta-1',
})
await driveToState(multi, 'S3') // alpha stalled at CHILD_BOUND
await driveToState(multi, 'S2', betaReq) // beta stalled at CHILD_SESSION_CREATED
const multiOrphans = multi.coordinator.listOrphans()
const multiAlpha = multi.coordinator.status({ instanceId: P4_FIXTURE.instanceId })
const multiBeta = multi.coordinator.status(betaReq)

// ------------------------------------- W-cross: two roots, one shared domain

const cross = await createP4t4World()
await driveToState(cross, 'S2') // alpha orphan under root-1
const crossAdapter2 = new FakeAgentFactoryAdapter()
const crossCoord2 = createProvisioningCoordinator({
  domain: cross.domain,
  rootSessionId: P4_FIXTURE.otherRootSessionId,
  adapter: crossAdapter2,
})
await crossCoord2.createChildSession(
  provisionRequest({
    instanceId: P4_FIXTURE.secondInstanceId,
    label: 'Beta Researcher',
    allocationToken: 'p4t4-cross-beta-1',
  }),
)
const crossOrphans1 = cross.coordinator.listOrphans()
const crossOrphans2 = crossCoord2.listOrphans()
const crossOpCount = cross.domain.repositories.operations.list().length

// --------------------------------------------------- W-recover: orphan clears

const recov = await createP4t4World()
await driveToState(recov, 'S3')
const recovOrphansBefore = recov.coordinator.listOrphans()
const recovResult = await recov.coordinator.recover(provisionRequest())
const recovOrphansAfter = recov.coordinator.listOrphans()
const recovStatus = recov.coordinator.status({ instanceId: P4_FIXTURE.instanceId })

// ---------------------------------------------------------------- assertions

describe('no durable state: NONE with MEMBER_NOT_PROVISIONED, and no orphans', () => {
  it('reports stage NONE, not committed, and the member-not-provisioned diagnostic', () => {
    expect(noneStatus.stage).toBe(PROVISIONING_STAGES.NONE)
    expect(noneStatus.committed).toBe(false)
    expect(noneStatus.diagnostic?.code).toBe(PROVISIONING_DIAGNOSTIC_CODES.MEMBER_NOT_PROVISIONED)
  })

  it('lists zero orphans', () => {
    expect(noneOrphans.length).toBe(0)
  })
})

describe('ALLOCATED (crash before the external effect): NOT an orphan', () => {
  it('reports stage ALLOCATED with no diagnostic (no child was recorded externally)', () => {
    expect(s1Status.stage).toBe(PROVISIONING_STAGES.ALLOCATED)
    expect(s1Status.committed).toBe(false)
    expect(s1Status.diagnostic).toBe(undefined)
    expect(s1w.adapter.childrenCreated).toBe(0)
  })

  it('lists zero orphans', () => {
    expect(s1Orphans.length).toBe(0)
  })
})

describe('CHILD_SESSION_CREATED: a diagnosable orphan naming the missing pieces', () => {
  it('reports stage CHILD_SESSION_CREATED with the ORPHANED_CHILD_SESSION diagnostic', () => {
    expect(s2Status.stage).toBe(PROVISIONING_STAGES.CHILD_SESSION_CREATED)
    expect(s2Status.committed).toBe(false)
    const d = expectOrphan(s2Status.diagnostic, 'W-S2 status')
    expect(String(d.rootSessionId)).toBe(ROOT)
    expect(d.instanceId).toBe(INSTANCE)
    expect(d.stage).toBe(PROVISIONING_STAGES.CHILD_SESSION_CREATED)
    expect(d.childSessionId).toBe(s2Child)
    expect(d.operationId).toBe(operationIdFor(s2w, provisionRequest()))
    expect(d.childSessionId).toBe(String(s2w.adapter.childSessionIdFor(ROOT, INSTANCE)))
  })

  it('names exactly the missing binding and commit (the member record exists at this stage)', () => {
    const d = expectOrphan(s2Status.diagnostic, 'W-S2 missing')
    expect(missingOf(d)).toEqual(['binding', 'commit'])
  })

  it('listOrphans reports exactly this one orphan', () => {
    expect(s2Orphans.length).toBe(1)
    const d = s2Orphans[0]
    expect(d?.instanceId).toBe(INSTANCE)
    expect(d?.code).toBe(PROVISIONING_DIAGNOSTIC_CODES.ORPHANED_CHILD_SESSION)
  })
})

describe('CHILD_BOUND: the orphan persists until commit, naming only the missing commit', () => {
  it('reports stage CHILD_BOUND with the ORPHANED_CHILD_SESSION diagnostic', () => {
    expect(s3Status.stage).toBe(PROVISIONING_STAGES.CHILD_BOUND)
    expect(s3Status.committed).toBe(false)
    const d = expectOrphan(s3Status.diagnostic, 'W-S3')
    expect(d.stage).toBe(PROVISIONING_STAGES.CHILD_BOUND)
    expect(missingOf(d)).toEqual(['commit'])
  })

  it('listOrphans reports exactly this one orphan', () => {
    expect(s3Orphans.length).toBe(1)
    expect(s3Orphans[0]?.instanceId).toBe(INSTANCE)
  })
})

describe('S4 (ledger fact durable, operation row not committed): still an orphan', () => {
  it('reports stage CHILD_BOUND with missing [commit] and NOT committed (both halves of commit required)', () => {
    expect(s4Status.stage).toBe(PROVISIONING_STAGES.CHILD_BOUND)
    expect(s4Status.committed).toBe(false)
    const d = expectOrphan(s4Status.diagnostic, 'W-S4')
    expect(missingOf(d)).toEqual(['commit'])
  })

  it('has exactly one ledger fact, and listOrphans reports the orphan', () => {
    expect(s4Facts).toBe(1)
    expect(s4Orphans.length).toBe(1)
    expect(s4Orphans[0]?.instanceId).toBe(INSTANCE)
  })
})

describe('crash right after the child was recorded (boundary 4): orphan names record+binding+commit, re-drive converges', () => {
  it('the provision rejected with a seam failure after exactly 2 writes (op row + child record)', () => {
    expect(b4Provision.ok).toBe(false)
    expect(isSeamFailure((b4Provision as { error?: unknown }).error)).toBe(true)
    expect(b4CrashWrites).toBe(2)
  })

  it('the durable state is CHILD_SESSION_CREATED with no member record: the operation row still PREPARED with the child', () => {
    expect(b4Status.stage).toBe(PROVISIONING_STAGES.CHILD_SESSION_CREATED)
    expect(b4Status.committed).toBe(false)
    expect(b4MemberCountAfterCrash).toBe(0)
    expect(b4Op?.phase).toBe(OPERATION_PHASES.PREPARED)
    expect(String(b4Op?.childSessionId)).toBe(String(b4.adapter.childSessionIdFor(ROOT, INSTANCE)))
  })

  it('the orphan diagnostic names all three missing pieces: record, binding, commit', () => {
    const d = expectOrphan(b4Status.diagnostic, 'W-B4')
    expect(missingOf(d)).toEqual(['record', 'binding', 'commit'])
  })

  it('listOrphans reports exactly this one orphan', () => {
    expect(b4Orphans.length).toBe(1)
    expect(b4Orphans[0]?.instanceId).toBe(INSTANCE)
  })

  it('re-driving converges to the committed member using the EXISTING child (no second external effect)', () => {
    expect(b4Recover.ok).toBe(true)
    if (b4Recover.ok && b4Recover.value !== undefined) {
      expect(b4Recover.value.stage).toBe(PROVISIONING_STAGES.INSTANCE_COMMITTED)
      expect(b4Recover.value.committed).toBe(true)
    }
    expect(b4RecoverWrites).toBe(6)
    expect(b4.adapter.createCalls).toBe(1)
    expect(b4.adapter.childrenCreated).toBe(1)
  })

  it('after convergence the orphan is gone and the member is committed', () => {
    expect(b4AfterRecover.stage).toBe(PROVISIONING_STAGES.INSTANCE_COMMITTED)
    expect(b4AfterRecover.committed).toBe(true)
    expect(b4AfterRecover.diagnostic).toBe(undefined)
    expect(b4OrphansAfter.length).toBe(0)
  })
})

describe('multiple stalled members: every orphan listed, sorted by instanceId', () => {
  it('lists exactly two orphans, alpha first (sorted), each naming its own missing pieces', () => {
    expect(multiOrphans.length).toBe(2)
    expect(multiOrphans[0]?.instanceId).toBe(INSTANCE)
    expect(multiOrphans[1]?.instanceId).toBe(String(P4_FIXTURE.secondInstanceId))
    const alpha = expectOrphan(multiAlpha.diagnostic, 'W-multi alpha')
    expect(missingOf(alpha)).toEqual(['commit'])
    const beta = expectOrphan(multiBeta.diagnostic, 'W-multi beta')
    expect(missingOf(beta)).toEqual(['binding', 'commit'])
    expect(multiOrphans[1]?.childSessionId).toBe(multiBeta.childSessionId)
  })
})

describe('orphans are scoped to the coordinator team (operation intent payload root filter)', () => {
  it('two coordinators share one domain (two operation rows) but each lists only its own orphan', () => {
    expect(crossOpCount).toBe(2)
    expect(crossOrphans1.length).toBe(1)
    expect(crossOrphans1[0]?.instanceId).toBe(INSTANCE)
    expect(crossOrphans1[0]?.rootSessionId).toBe(ROOT)
    expect(crossOrphans2.length).toBe(1)
    expect(crossOrphans2[0]?.instanceId).toBe(String(P4_FIXTURE.secondInstanceId))
    expect(String(crossOrphans2[0]?.rootSessionId)).toBe(String(P4_FIXTURE.otherRootSessionId))
  })
})

describe('recovery clears the orphan: the committed member is no longer diagnosable as lost', () => {
  it('had exactly one orphan before recovery and zero after', () => {
    expect(recovOrphansBefore.length).toBe(1)
    expect(recovOrphansBefore[0]?.instanceId).toBe(INSTANCE)
    expect(recovResult.stage).toBe(PROVISIONING_STAGES.INSTANCE_COMMITTED)
    expect(recovResult.committed).toBe(true)
    expect(recovOrphansAfter.length).toBe(0)
  })

  it('the recovered member status is committed with no diagnostic', () => {
    expect(recovStatus.stage).toBe(PROVISIONING_STAGES.INSTANCE_COMMITTED)
    expect(recovStatus.committed).toBe(true)
    expect(recovStatus.diagnostic).toBe(undefined)
  })
})
