/**
 * P6-T1 S-recovery — the cross-system crash window (Architecture §18,
 * DevPlan §17.3; invariant 46): PREPARED → idempotent effects → ledger fact
 * → COMMITTED, roll-forward never rollback, stable operation identity
 * prevents double-create. The testkit `FileStorageSeam` crash arms (the
 * durable write N+1 throws `CrashFault`, tmp left behind, target untouched)
 * are the fault channel; `restartP6T1World` is the process-restart model
 * (fresh ephemeral ports, same durable medium).
 *
 *  - R1 crash at the CHILD_SESSION_CREATED durable marker (the PREPARED row
 *    is durable, the child effect ran, the child id is NOT yet recorded):
 *    recovery re-drives, the (fresh) factory is called again and idempotency
 *    returns the SAME child, exactly one ledger fact, COMMITTED;
 *  - R2 crash after the child id is recorded: recovery does NOT call the
 *    factory again (the recorded child is authoritative), same child;
 *  - R3 crash after the member record: recovery completes (no factory call);
 *  - R4 crash inside the terminal drive (before any ledger write): recovery
 *    completes (no factory call);
 *  - R5 a COMMITTED operation after a restart replays with replayed:true and
 *    ZERO durable writes;
 *  - R6 a FAILED row (abandoned journal operation) fails LOUDLY
 *    (OPERATION_FAILED with the stored diagnostic) and never roll-forwards;
 *    a new logical operation (new token) creates fine;
 *  - R7 a barrier fault (BARRIER_REJECTED) leaves a PREPARED row with no
 *    child; recovery completes;
 *  - R8 a factory fault (CHILD_SESSION_CREATION_FAILED) leaves a PREPARED
 *    row with no child; recovery completes.
 *
 * Mock-first (ruling R28); top-level-await snapshot pattern.
 *
 * @module @dsh-agent-team/runtime/test/p6t1-recovery
 */

import { describe, expect, it } from 'vitest'
import {
  ACTIVATION_ERROR_CODES,
  activationOperationIdentity,
} from '../activation/index.js'
import type { ActivationResult, MemberActivationRequest } from '../activation/index.js'
import { createOperationJournal } from '../../storage/operations/index.js'
import { PROVISION_INTENT_TYPE } from '../../storage/provisioning/index.js'
import { OPERATION_PHASES } from '../../storage/schema/index.js'
import {
  P6T1_FIXTURE,
  assertActivationCode,
  createP6T1World,
  destroyP6T1World,
  makeRequest,
  restartP6T1World,
} from './p6t1-helpers.js'
import type { P6T1World } from './p6t1-helpers.js'

const ROOT = String(P6T1_FIXTURE.rootSessionId)

async function runActivate(
  world: P6T1World,
  request: MemberActivationRequest,
): Promise<{ result: ActivationResult | undefined; error: unknown }> {
  try {
    return { result: await world.provider.activate(request), error: undefined }
  } catch (error) {
    return { result: undefined, error }
  }
}

// ---------------------------------------------------------------------------
// R1 — crash at the CHILD_SESSION_CREATED marker (write #4 after seed;
// P8-S4A: the single compatibility authority's inline re-probe writes the
// compatibility row + the team-session generation stamp BEFORE the first
// activation write, so every crash arm below shifts +2 to keep the SAME
// logical crash point — the probe writes are deterministic and idempotent)
// ---------------------------------------------------------------------------
let r1: {
  readonly crashName: string | undefined
  readonly crashCode: string | undefined
  readonly opPhaseAtCrash: string | undefined
  readonly childRecordedAtCrash: string | undefined
  readonly membersAtCrash: number
  readonly oldFactoryCalls: number
  readonly preCrashWrites: number
  readonly recovered: ActivationResult | undefined
  readonly recoverError: unknown
  readonly newFactoryCalls: number
  readonly recoveredPhase: string | undefined
  readonly recoveryTables: string[]
  readonly recoveryLedgerEntries: number
  readonly recoveryTotalWrites: number
}
{
  const identity = activationOperationIdentity(ROOT, 'leader-explicit', 'tok-p6t1-r1')
  const world = await createP6T1World('p6t1x-r1')
  try {
    const request = makeRequest({ requestToken: 'tok-p6t1-r1' })
    // +3 (was +1 pre-P8-S4A): crash on the child-marker write, unchanged
    // logical point after the probe's 2 compatibility writes.
    world.seam.armCrashAfterWrites(world.seedWriteCount + 3)
    const crashed = await runActivate(world, request)
    const opRow = world.domain.repositories.operations.get(identity.operationId)
    const crashSnapshot = {
      crashName: crashed.error instanceof Error ? crashed.error.name : String(crashed.error),
      crashCode:
        crashed.error instanceof Error
          ? ((crashed.error as { code?: unknown }).code as string | undefined)
          : undefined,
      opPhaseAtCrash: opRow?.phase,
      childRecordedAtCrash: opRow?.childSessionId === undefined ? undefined : String(opRow.childSessionId),
      membersAtCrash: world.domain.repositories.memberInstances.list(ROOT).length,
      oldFactoryCalls: world.childFactory.calls.length,
      preCrashWrites: world.seam.writeCount - world.seedWriteCount,
    }
    // Process restart: fresh ephemeral ports, same durable medium.
    const restarted = await restartP6T1World(world)
    try {
      const recoveredRun = await runActivate(restarted, request)
      const recoveredRow = restarted.domain.repositories.operations.get(identity.operationId)
      const writes = restarted.writesSinceSeed()
      r1 = {
        ...crashSnapshot,
        recovered: recoveredRun.result,
        recoverError: recoveredRun.error,
        newFactoryCalls: restarted.childFactory.calls.length,
        recoveredPhase: recoveredRow?.phase,
        recoveryTables: writes.map((w) => w.table),
        recoveryLedgerEntries: writes.filter(
          (w) => w.table === 'ledger' && /^\d+$/.test(w.key),
        ).length,
        recoveryTotalWrites: writes.length,
      }
    } finally {
      await destroyP6T1World(restarted)
    }
  } finally {
    await destroyP6T1World(world).catch(() => undefined)
  }
}

describe('P6-T1 R1: crash at the child-session durable marker — recovery roll-forwards', () => {
  it('the crash leaves exactly the PREPARED row (no child recorded, no member, one factory call)', () => {
    expect(r1.crashName).toBe('TeamDomainError')
    expect(r1.crashCode).toBe('SEAM_FAILURE')
    expect(r1.opPhaseAtCrash).toBe(OPERATION_PHASES.PREPARED)
    expect(r1.childRecordedAtCrash).toBe(undefined)
    expect(r1.membersAtCrash).toBe(0)
    expect(r1.oldFactoryCalls).toBe(1)
    // P8-S4A: 3 writes precede the crash point now (compatibility row +
    // generation stamp + the PREPARED row); the crash point itself is
    // unchanged (the child-marker write).
    expect(r1.preCrashWrites).toBe(3)
  })

  it('recovery re-drives to COMMITTED: the fresh factory is called once and returns the SAME child', () => {
    expect(r1.recoverError).toBe(undefined)
    const result = r1.recovered
    if (result?.kind !== 'activated') {
      throw new Error(`R1: expected activated after recovery, got ${String(result)}`)
    }
    const identity = activationOperationIdentity(ROOT, 'leader-explicit', 'tok-p6t1-r1')
    expect(result.instanceId).toBe(identity.instanceId)
    expect(result.operationId).toBe(identity.operationId)
    expect(result.replayed).toBe(false)
    expect(result.ledgerSequence).toBeGreaterThan(0)
    expect(r1.newFactoryCalls).toBe(1)
    expect(r1.recoveredPhase).toBe(OPERATION_PHASES.COMMITTED)
  })

  it('recovery performs exactly the remaining durable writes (child marker, member, binding, 3 ledger, G8-S1 stamp, commit) and ONE ledger fact', () => {
    const tables = r1.recoveryTables.filter((t) => t !== 'ledger')
    expect(tables).toEqual([
      'operations',
      'member_instances',
      'session_bindings',
      'team_sessions',
      'operations',
    ])
    expect(r1.recoveryLedgerEntries).toBe(1)
    expect(r1.recoveryTotalWrites).toBe(8)
  })
})

// ---------------------------------------------------------------------------
// R2 — crash after the child id is recorded (write #5 throws; +2 shift:
// the P8-S4A compatibility probe writes precede every activation write)
// ---------------------------------------------------------------------------
let r2: {
  readonly crashName: string | undefined
  readonly crashCode: string | undefined
  readonly opPhaseAtCrash: string | undefined
  readonly childRecordedAtCrash: string | undefined
  readonly membersAtCrash: number
  readonly newFactoryCalls: number
  readonly recoveredChild: string | undefined
  readonly recoverError: unknown
  readonly recoveredPhase: string | undefined
}
{
  const identity = activationOperationIdentity(ROOT, 'leader-explicit', 'tok-p6t1-r2')
  const world = await createP6T1World('p6t1x-r2')
  try {
    const request = makeRequest({ requestToken: 'tok-p6t1-r2' })
    // +4 (was +2 pre-P8-S4A): same logical point (member-record write).
    world.seam.armCrashAfterWrites(world.seedWriteCount + 4)
    const crashed = await runActivate(world, request)
    const opRow = world.domain.repositories.operations.get(identity.operationId)
    const crashSnapshot = {
      crashName: crashed.error instanceof Error ? crashed.error.name : String(crashed.error),
      crashCode:
        crashed.error instanceof Error
          ? ((crashed.error as { code?: unknown }).code as string | undefined)
          : undefined,
      opPhaseAtCrash: opRow?.phase,
      childRecordedAtCrash: opRow?.childSessionId === undefined ? undefined : String(opRow.childSessionId),
      membersAtCrash: world.domain.repositories.memberInstances.list(ROOT).length,
    }
    const restarted = await restartP6T1World(world)
    try {
      const recoveredRun = await runActivate(restarted, request)
      const recoveredRow = restarted.domain.repositories.operations.get(identity.operationId)
      r2 = {
        ...crashSnapshot,
        newFactoryCalls: restarted.childFactory.calls.length,
        recoveredChild:
          recoveredRun.result?.kind === 'activated' ? recoveredRun.result.childSessionId : undefined,
        recoverError: recoveredRun.error,
        recoveredPhase: recoveredRow?.phase,
      }
    } finally {
      await destroyP6T1World(restarted)
    }
  } finally {
    await destroyP6T1World(world).catch(() => undefined)
  }
}

describe('P6-T1 R2: crash after the child id is recorded — recovery never re-runs the external effect', () => {
  it('the crash leaves the PREPARED row with the child recorded (no member yet)', () => {
    expect(r2.crashName).toBe('TeamDomainError')
    expect(r2.crashCode).toBe('SEAM_FAILURE')
    expect(r2.opPhaseAtCrash).toBe(OPERATION_PHASES.PREPARED)
    expect(r2.childRecordedAtCrash).toBe(`session-child-p6t1-${activationOperationIdentity(ROOT, 'leader-explicit', 'tok-p6t1-r2').instanceId.slice(5)}`)
    expect(r2.membersAtCrash).toBe(0)
  })

  it('recovery uses the recorded child (ZERO factory calls) and commits the same child', () => {
    expect(r2.recoverError).toBe(undefined)
    expect(r2.newFactoryCalls).toBe(0)
    const identity = activationOperationIdentity(ROOT, 'leader-explicit', 'tok-p6t1-r2')
    expect(r2.recoveredChild).toBe(`session-child-p6t1-${identity.instanceId.slice(5)}`)
    expect(r2.recoveredPhase).toBe(OPERATION_PHASES.COMMITTED)
  })
})

// ---------------------------------------------------------------------------
// R3 — crash after the member record (write #6 throws; +2 shift: the
// P8-S4A compatibility probe writes precede every activation write)
// ---------------------------------------------------------------------------
let r3: {
  readonly crashName: string | undefined
  readonly crashCode: string | undefined
  readonly membersAtCrash: number
  readonly newFactoryCalls: number
  readonly recovered: ActivationResult | undefined
  readonly recoverError: unknown
  readonly recoveredPhase: string | undefined
}
{
  const identity = activationOperationIdentity(ROOT, 'leader-explicit', 'tok-p6t1-r3')
  const world = await createP6T1World('p6t1x-r3')
  try {
    const request = makeRequest({ requestToken: 'tok-p6t1-r3' })
    // +5 (was +3 pre-P8-S4A): same logical point (session-binding write).
    world.seam.armCrashAfterWrites(world.seedWriteCount + 5)
    const crashed = await runActivate(world, request)
    const membersAtCrash = world.domain.repositories.memberInstances.list(ROOT).length
    const restarted = await restartP6T1World(world)
    try {
      const recoveredRun = await runActivate(restarted, request)
      const recoveredRow = restarted.domain.repositories.operations.get(identity.operationId)
      r3 = {
        crashName: crashed.error instanceof Error ? crashed.error.name : String(crashed.error),
        crashCode:
          crashed.error instanceof Error
            ? ((crashed.error as { code?: unknown }).code as string | undefined)
            : undefined,
        membersAtCrash,
        newFactoryCalls: restarted.childFactory.calls.length,
        recovered: recoveredRun.result,
        recoverError: recoveredRun.error,
        recoveredPhase: recoveredRow?.phase,
      }
    } finally {
      await destroyP6T1World(restarted)
    }
  } finally {
    await destroyP6T1World(world).catch(() => undefined)
  }
}

describe('P6-T1 R3: crash after the member record — recovery completes', () => {
  it('leaves the member record (no binding) and recovers without any factory call', () => {
    expect(r3.crashName).toBe('TeamDomainError')
    expect(r3.crashCode).toBe('SEAM_FAILURE')
    expect(r3.membersAtCrash).toBe(1)
    expect(r3.newFactoryCalls).toBe(0)
    expect(r3.recoverError).toBe(undefined)
    expect(r3.recovered?.kind).toBe('activated')
    expect(r3.recoveredPhase).toBe(OPERATION_PHASES.COMMITTED)
  })
})

// ---------------------------------------------------------------------------
// R4 — crash inside the terminal drive (write #7 throws, before any ledger
// write; +2 shift: the P8-S4A compatibility probe writes precede every
// activation write)
// ---------------------------------------------------------------------------
let r4: {
  readonly crashName: string | undefined
  readonly crashCode: string | undefined
  readonly ledgerEntriesAtCrash: number
  readonly newFactoryCalls: number
  readonly recovered: ActivationResult | undefined
  readonly recoverError: unknown
  readonly recoveredPhase: string | undefined
  readonly recoveryTotalWrites: number
}
{
  const identity = activationOperationIdentity(ROOT, 'leader-explicit', 'tok-p6t1-r4')
  const world = await createP6T1World('p6t1x-r4')
  try {
    const request = makeRequest({ requestToken: 'tok-p6t1-r4' })
    // +6 (was +4 pre-P8-S4A): same logical point (the generation-stamp write).
    world.seam.armCrashAfterWrites(world.seedWriteCount + 6)
    const crashed = await runActivate(world, request)
    const writesAtCrash = world.writesSinceSeed()
    const ledgerEntriesAtCrash = writesAtCrash.filter(
      (w) => w.table === 'ledger' && /^\d+$/.test(w.key),
    ).length
    const restarted = await restartP6T1World(world)
    try {
      const recoveredRun = await runActivate(restarted, request)
      const recoveredRow = restarted.domain.repositories.operations.get(identity.operationId)
      r4 = {
        crashName: crashed.error instanceof Error ? crashed.error.name : String(crashed.error),
        crashCode:
          crashed.error instanceof Error
            ? ((crashed.error as { code?: unknown }).code as string | undefined)
            : undefined,
        ledgerEntriesAtCrash,
        newFactoryCalls: restarted.childFactory.calls.length,
        recovered: recoveredRun.result,
        recoverError: recoveredRun.error,
        recoveredPhase: recoveredRow?.phase,
        recoveryTotalWrites: restarted.seam.writeCount - restarted.seedWriteCount,
      }
    } finally {
      await destroyP6T1World(restarted)
    }
  } finally {
    await destroyP6T1World(world).catch(() => undefined)
  }
}

describe('P6-T1 R4: crash inside the terminal drive — the ledger fact lands exactly once', () => {
  it('leaves all pre-drive state (child, member, binding) and NO ledger entry', () => {
    expect(r4.crashName).toBe('TeamDomainError')
    expect(r4.crashCode).toBe('SEAM_FAILURE')
    expect(r4.ledgerEntriesAtCrash).toBe(0)
  })

  it('recovery drives the terminal without any factory call (the commit drive: 3 ledger + G8-S1 stamp + 1 commit)', () => {
    expect(r4.newFactoryCalls).toBe(0)
    expect(r4.recoverError).toBe(undefined)
    expect(r4.recovered?.kind).toBe('activated')
    expect(r4.recoveredPhase).toBe(OPERATION_PHASES.COMMITTED)
    expect(r4.recoveryTotalWrites).toBe(5)
  })
})

// ---------------------------------------------------------------------------
// R5 — committed + restart + same token → replayed, ZERO durable writes
// ---------------------------------------------------------------------------
let r5: {
  readonly first: ActivationResult | undefined
  readonly second: ActivationResult | undefined
  readonly error: unknown
  readonly replayWrites: number
  readonly replayProjections: number
}
{
  const world = await createP6T1World('p6t1x-r5')
  try {
    const request = makeRequest({ requestToken: 'tok-p6t1-r5' })
    const firstRun = await runActivate(world, request)
    const restarted = await restartP6T1World(world)
    try {
      const secondRun = await runActivate(restarted, request)
      r5 = {
        first: firstRun.result,
        second: secondRun.result,
        error: firstRun.error ?? secondRun.error,
        replayWrites: restarted.seam.writeCount - restarted.seedWriteCount,
        replayProjections: restarted.projections.length,
      }
    } finally {
      await destroyP6T1World(restarted)
    }
  } finally {
    await destroyP6T1World(world).catch(() => undefined)
  }
}

describe('P6-T1 R5: a committed activation survives a restart as an idempotent replay', () => {
  it('replays activated+replayed with the same instance/child/operation and ZERO durable writes', () => {
    expect(r5.error).toBe(undefined)
    const first = r5.first
    const second = r5.second
    if (first?.kind !== 'activated' || second?.kind !== 'activated') {
      throw new Error(`R5: expected two activated: ${String(first)} / ${String(second)}`)
    }
    expect(first.replayed).toBe(false)
    expect(second.replayed).toBe(true)
    expect(second.instanceId).toBe(first.instanceId)
    expect(second.childSessionId).toBe(first.childSessionId)
    expect(second.operationId).toBe(first.operationId)
    expect(r5.replayWrites).toBe(0)
    expect(r5.replayProjections).toBe(1)
  })
})

// ---------------------------------------------------------------------------
// R6 — a FAILED row fails loudly (no roll-forward of an abandoned operation)
// ---------------------------------------------------------------------------
let r6: {
  readonly failedActivate: unknown
  readonly writesOnFailedActivate: number
  readonly retry: { result: ActivationResult | undefined; error: unknown }
}
{
  const world = await createP6T1World('p6t1x-r6')
  try {
    const identity = activationOperationIdentity(ROOT, 'leader-explicit', 'tok-p6t1-failed')
    // Abandon the logical operation through the REAL journal protocol.
    const journal = createOperationJournal(world.domain, ROOT)
    await journal.prepare({
      operationId: identity.operationId,
      idempotencyKey: identity.idempotencyKey,
      intent: {
        type: PROVISION_INTENT_TYPE,
        payload: {
          label: 'abandoned-member',
          instanceId: identity.instanceId,
          rootSessionId: ROOT,
          templateId: 'worker',
        },
      },
    })
    await journal.fail(identity.operationId, 'simulated abandon')

    const before = world.seam.writeCount
    const failedRun = await runActivate(world, makeRequest({ requestToken: 'tok-p6t1-failed' }))
    const afterFailed = world.seam.writeCount
    const retry = await runActivate(
      world,
      makeRequest({ requestToken: 'tok-p6t1-failed-retry' }),
    )
    r6 = {
      failedActivate: failedRun.error,
      writesOnFailedActivate: afterFailed - before,
      retry,
    }
  } finally {
    await destroyP6T1World(world)
  }
}

describe('P6-T1 R6: a FAILED durable operation never roll-forwards', () => {
  it('the same token fails loudly with OPERATION_FAILED + the stored diagnostic (zero writes)', () => {
    const code = assertActivationCode(r6.failedActivate, ACTIVATION_ERROR_CODES.OPERATION_FAILED)
    const identity = activationOperationIdentity(ROOT, 'leader-explicit', 'tok-p6t1-failed')
    expect(code.details?.['operationId']).toBe(identity.operationId)
    expect(code.details?.['failureDiagnostic']).toBe('simulated abandon')
    expect(r6.writesOnFailedActivate).toBe(0)
  })

  it('a new logical operation (new token) creates fine', () => {
    expect(r6.retry.error).toBe(undefined)
    expect(r6.retry.result?.kind).toBe('activated')
    if (r6.retry.result?.kind === 'activated') {
      expect(r6.retry.result.replayed).toBe(false)
      expect(r6.retry.result.instanceId).not.toBe(
        activationOperationIdentity(ROOT, 'leader-explicit', 'tok-p6t1-failed').instanceId,
      )
    }
  })
})

// ---------------------------------------------------------------------------
// R7 — barrier fault: BARRIER_REJECTED, PREPARED row, no child; recovery completes
// ---------------------------------------------------------------------------
let r7: {
  readonly barrierError: unknown
  readonly opPhaseAfterFault: string | undefined
  readonly childRecordedAfterFault: boolean
  readonly membersAfterFault: number
  readonly factoryCallsAfterFault: number
  readonly recovery: { result: ActivationResult | undefined; error: unknown }
  readonly factoryCallsAfterRecovery: number
}
{
  const identity = activationOperationIdentity(ROOT, 'leader-explicit', 'tok-p6t1-r7')
  const world = await createP6T1World('p6t1x-r7')
  try {
    const request = makeRequest({ requestToken: 'tok-p6t1-r7' })
    world.durability.failNextEnsureDurable(new Error('simulated barrier fault'))
    const first = await runActivate(world, request)
    const opRow = world.domain.repositories.operations.get(identity.operationId)
    const snapshot = {
      barrierError: first.error,
      opPhaseAfterFault: opRow?.phase,
      childRecordedAfterFault: opRow?.childSessionId !== undefined,
      membersAfterFault: world.domain.repositories.memberInstances.list(ROOT).length,
      factoryCallsAfterFault: world.childFactory.calls.length,
    }
    const recovery = await runActivate(world, request)
    r7 = {
      ...snapshot,
      recovery,
      factoryCallsAfterRecovery: world.childFactory.calls.length,
    }
  } finally {
    await destroyP6T1World(world)
  }
}

describe('P6-T1 R7: a durability-barrier fault leaves a recoverable PREPARED row', () => {
  it('the first attempt fails BARRIER_REJECTED with no child recorded and no member', () => {
    assertActivationCode(r7.barrierError, ACTIVATION_ERROR_CODES.BARRIER_REJECTED)
    expect(r7.opPhaseAfterFault).toBe(OPERATION_PHASES.PREPARED)
    expect(r7.childRecordedAfterFault).toBe(false)
    expect(r7.membersAfterFault).toBe(0)
    expect(r7.factoryCallsAfterFault).toBe(1)
  })

  it('the same-token re-drive completes (the factory is idempotent: second call, same child)', () => {
    expect(r7.recovery.error).toBe(undefined)
    const result = r7.recovery.result
    if (result?.kind !== 'activated') {
      throw new Error(`R7: expected activated recovery, got ${String(result)}`)
    }
    expect(result.replayed).toBe(false)
    expect(r7.factoryCallsAfterRecovery).toBe(2)
  })
})

// ---------------------------------------------------------------------------
// R8 — factory fault: CHILD_SESSION_CREATION_FAILED, PREPARED row; recovery completes
// ---------------------------------------------------------------------------
let r8: {
  readonly factoryError: unknown
  readonly opPhaseAfterFault: string | undefined
  readonly membersAfterFault: number
  readonly factoryCallsAfterFault: number
  readonly recovery: { result: ActivationResult | undefined; error: unknown }
  readonly factoryCallsAfterRecovery: number
}
{
  const identity = activationOperationIdentity(ROOT, 'leader-explicit', 'tok-p6t1-r8')
  const world = await createP6T1World('p6t1x-r8')
  try {
    const request = makeRequest({ requestToken: 'tok-p6t1-r8' })
    world.childFactory.failNext(new Error('simulated factory fault'))
    const first = await runActivate(world, request)
    const opRow = world.domain.repositories.operations.get(identity.operationId)
    const snapshot = {
      factoryError: first.error,
      opPhaseAfterFault: opRow?.phase,
      membersAfterFault: world.domain.repositories.memberInstances.list(ROOT).length,
      factoryCallsAfterFault: world.childFactory.calls.length,
    }
    const recovery = await runActivate(world, request)
    r8 = {
      ...snapshot,
      recovery,
      factoryCallsAfterRecovery: world.childFactory.calls.length,
    }
  } finally {
    await destroyP6T1World(world)
  }
}

describe('P6-T1 R8: a child-session factory fault leaves a recoverable PREPARED row', () => {
  it('the first attempt fails CHILD_SESSION_CREATION_FAILED with no member', () => {
    assertActivationCode(r8.factoryError, ACTIVATION_ERROR_CODES.CHILD_SESSION_CREATION_FAILED)
    expect(r8.opPhaseAfterFault).toBe(OPERATION_PHASES.PREPARED)
    expect(r8.membersAfterFault).toBe(0)
    expect(r8.factoryCallsAfterFault).toBe(1)
  })

  it('the same-token re-drive completes', () => {
    expect(r8.recovery.error).toBe(undefined)
    expect(r8.recovery.result?.kind).toBe('activated')
    expect(r8.factoryCallsAfterRecovery).toBe(2)
  })
})
